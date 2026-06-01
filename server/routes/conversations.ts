import { Router } from 'express';
import type { Prisma } from '../generated/prisma/index.js';
import prisma from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

const buildPairKey = (leftUserId: string, rightUserId: string): string => {
  return [leftUserId, rightUserId].sort().join(':');
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

// ─── List conversations ───────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  const parsedLimit = Number(req.query.limit ?? 50);
  const safeLimit = Number.isFinite(parsedLimit)
    ? Math.max(1, Math.min(100, Math.trunc(parsedLimit)))
    : 50;
  const beforeRaw = typeof req.query.before === 'string' ? req.query.before : null;
  const beforeDate = beforeRaw ? new Date(beforeRaw) : null;
  const hasValidBeforeDate = Boolean(beforeDate && !Number.isNaN(beforeDate.getTime()));

  const participations = await prisma.conversationParticipant.findMany({
    where: {
      userId: req.auth!.userId,
      ...(hasValidBeforeDate
        ? { conversation: { lastMessageAt: { lt: beforeDate! } } }
        : {}),
    },
    include: {
      conversation: {
        include: {
          participants: {
            include: { user: { select: { id: true, name: true, profileImage: true } } },
          },
        },
      },
    },
    orderBy: { conversation: { lastMessageAt: 'desc' } },
    take: safeLimit,
  });

  return res.json(
    participations.map((p) => ({
      ...p.conversation,
      unreadCount: p.unreadCount,
    }))
  );
});

// ─── Get or create direct conversation ───────────────────────────────────────

router.post('/direct', async (req, res) => {
  const { otherUserId, communityId, listingId, noticeId, metadata, contextType } = req.body as {
    otherUserId?: string;
    communityId?: string;
    listingId?: string;
    noticeId?: string;
    metadata?: Record<string, unknown>;
    contextType?: 'listing' | 'notice' | 'direct';
  };
  if (!otherUserId) return res.status(400).json({ error: 'otherUserId is required' });

  const me = req.auth!.userId;
  if (me === otherUserId) return res.status(400).json({ error: 'Cannot start a direct conversation with yourself' });

  const pairKey = buildPairKey(me, otherUserId);
  const resolvedContextType = contextType === 'listing' || contextType === 'notice' ? contextType : 'direct';
  const metadataPatch = isRecord(metadata) ? metadata : {};
  const mergedMetadata = {
    ...metadataPatch,
    type: resolvedContextType,
  };
  const shouldPatchContext = Boolean(
    listingId ||
    noticeId ||
    communityId ||
    Object.keys(metadataPatch).length > 0 ||
    contextType,
  );

  const includeParticipants = { participants: { include: { user: { select: { id: true, name: true, profileImage: true } } } } } as const;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.conversation.findFirst({
        where: {
          type: 'direct',
          pairKey,
        },
        include: includeParticipants,
      });

      let conversation = existing;
      let wasCreated = false;

      if (conversation) {
        if (shouldPatchContext) {
          conversation = await tx.conversation.update({
            where: { id: conversation.id },
            data: {
              communityId: communityId ?? conversation.communityId,
              listingId: resolvedContextType === 'listing'
                ? (listingId ?? conversation.listingId)
                : null,
              noticeId: resolvedContextType === 'notice'
                ? (noticeId ?? conversation.noticeId)
                : null,
              metadata: mergedMetadata,
            },
            include: includeParticipants,
          });
        }
      } else {
        wasCreated = true;
        conversation = await tx.conversation.create({
          data: {
            type: 'direct',
            pairKey,
            communityId,
            listingId,
            noticeId,
            metadata: mergedMetadata,
            participants: {
              create: [
                { userId: me },
                { userId: otherUserId },
              ],
            },
          },
          include: includeParticipants,
        });
      }

      return {
        conversation,
        wasCreated,
      };
    });

    const statusCode = result.wasCreated ? 201 : 200;
    return res.status(statusCode).json({
      ...result.conversation,
    });
  } catch (error: any) {
    if (error?.code !== 'P2002') throw error;

    const existing = await prisma.conversation.findFirst({
      where: { type: 'direct', pairKey },
      include: includeParticipants,
    });
    if (!existing) throw error;
    return res.json(existing);
  }
});

// ─── Create conversation ──────────────────────────────────────────────────────

router.post('/', async (req, res) => {
  const { type, participantIds, listingId, noticeId, communityId, metadata } = req.body as {
    type: string;
    participantIds: string[];
    listingId?: string;
    noticeId?: string;
    communityId?: string;
    metadata?: Record<string, unknown>;
  };

  const normalizedMetadata = isRecord(metadata)
    ? (metadata as Prisma.InputJsonValue)
    : undefined;

  const allParticipants = [...new Set([req.auth!.userId, ...(participantIds ?? [])])];

  const conversation = await prisma.conversation.create({
    data: {
      type: type as never,
      listingId,
      noticeId,
      communityId,
      metadata: normalizedMetadata,
      participants: { create: allParticipants.map((uid) => ({ userId: uid })) },
    },
    include: { participants: { include: { user: { select: { id: true, name: true, profileImage: true } } } } },
  });

  return res.status(201).json(conversation);
});

// ─── Get messages ─────────────────────────────────────────────────────────────

router.get('/:id/messages', async (req, res) => {
  const { before, limit } = req.query;
  const messages = await prisma.message.findMany({
    where: {
      conversationId: req.params.id,
      ...(before ? { createdAt: { lt: new Date(before as string) } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: Number(limit ?? 50),
    include: { user: { select: { id: true, name: true, profileImage: true } } },
  });
  return res.json(messages.reverse()); // return chronological order
});

// ─── Send message ─────────────────────────────────────────────────────────────

router.post('/:id/messages', async (req, res) => {
  const { content, type, attachmentUrl } = req.body as { content?: string; type?: string; attachmentUrl?: string };
  const conversationId = req.params.id;
  const requestedType = (type ?? 'text').trim() || 'text';
  const userId = req.auth!.userId;

  const result = await prisma.$transaction(async (tx) => {
    const conversation = await tx.conversation.findFirst({
      where: {
        id: conversationId,
        participants: { some: { userId } },
      },
      select: { id: true },
    });

    if (!conversation) return null;

    const message = await tx.message.create({
      data: {
        conversationId,
        userId,
        content,
        messageType: requestedType as never,
        attachmentUrl,
        readBy: [userId],
      },
      include: { user: { select: { id: true, name: true, profileImage: true } } },
    });

    await tx.conversation.update({
      where: { id: conversationId },
      data: { lastMessage: content ?? requestedType, lastMessageAt: message.createdAt },
    });

    await tx.conversationParticipant.updateMany({
      where: { conversationId, userId: { not: userId } },
      data: { unreadCount: { increment: 1 } },
    });

    return { message };
  });

  if (!result) return res.status(404).json({ error: 'Conversation not found' });

  return res.status(201).json(result.message);
});

// ─── Mark conversation as read ────────────────────────────────────────────────

router.put('/:id/read', async (req, res) => {
  await prisma.conversationParticipant.updateMany({
    where: { conversationId: req.params.id, userId: req.auth!.userId },
    data: { unreadCount: 0 },
  });
  return res.json({ message: 'Marked as read' });
});

export default router;
