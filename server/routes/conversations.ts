import { Router } from 'express';
import prisma from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

// ─── List conversations ───────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  const participations = await prisma.conversationParticipant.findMany({
    where: { userId: req.auth!.userId },
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
  const { otherUserId } = req.body as { otherUserId?: string };
  if (!otherUserId) return res.status(400).json({ error: 'otherUserId is required' });

  const me = req.auth!.userId;

  // Check if direct conversation already exists between these two users
  const existing = await prisma.conversation.findFirst({
    where: {
      type: 'direct',
      participants: { every: { userId: { in: [me, otherUserId] } } },
    },
    include: { participants: { include: { user: { select: { id: true, name: true, profileImage: true } } } } },
  });

  if (existing) return res.json(existing);

  const conversation = await prisma.conversation.create({
    data: {
      type: 'direct',
      participants: {
        create: [
          { userId: me },
          { userId: otherUserId },
        ],
      },
    },
    include: { participants: { include: { user: { select: { id: true, name: true, profileImage: true } } } } },
  });

  return res.status(201).json(conversation);
});

// ─── Create conversation ──────────────────────────────────────────────────────

router.post('/', async (req, res) => {
  const { type, participantIds, listing_id, notice_id, community_id } = req.body as {
    type: string; participantIds: string[]; listing_id?: string; notice_id?: string; community_id?: string;
  };

  const allParticipants = [...new Set([req.auth!.userId, ...(participantIds ?? [])])];

  const conversation = await prisma.conversation.create({
    data: {
      type: type as never,
      listingId: listing_id,
      noticeId: notice_id,
      communityId: community_id,
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
  const { content: text, type, attachment_url } = req.body as { content?: string; type?: string; attachment_url?: string };

  const message = await prisma.message.create({
    data: {
      conversationId: req.params.id,
      userId: req.auth!.userId,
      content: text,
      messageType: type as never ?? 'text',
      attachmentUrl: attachment_url,
      readBy: [req.auth!.userId],
    },
    include: { user: { select: { id: true, name: true, profileImage: true } } },
  });

  // Update conversation last_message
  await prisma.conversation.update({
    where: { id: req.params.id },
    data: { lastMessage: text ?? (type ?? 'attachment'), lastMessageAt: message.createdAt },
  });

  // Increment unread count for all other participants
  await prisma.conversationParticipant.updateMany({
    where: { conversationId: req.params.id, userId: { not: req.auth!.userId } },
    data: { unreadCount: { increment: 1 } },
  });

  return res.status(201).json(message);
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
