import { Router } from 'express';
import prisma from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

// ─── List conversations ───────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  const participations = await prisma.conversationParticipant.findMany({
    where: { user_id: req.auth!.userId },
    include: {
      conversation: {
        include: {
          participants: {
            include: { user: { select: { id: true, name: true, profile_image: true } } },
          },
        },
      },
    },
    orderBy: { conversation: { last_message_at: 'desc' } },
  });

  return res.json(
    participations.map((p) => ({
      ...p.conversation,
      unread_count: p.unread_count,
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
      participants: { every: { user_id: { in: [me, otherUserId] } } },
    },
    include: { participants: { include: { user: { select: { id: true, name: true, profile_image: true } } } } },
  });

  if (existing) return res.json(existing);

  const conversation = await prisma.conversation.create({
    data: {
      type: 'direct',
      participants: {
        create: [
          { user_id: me },
          { user_id: otherUserId },
        ],
      },
    },
    include: { participants: { include: { user: { select: { id: true, name: true, profile_image: true } } } } },
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
      listing_id,
      notice_id,
      community_id,
      participants: { create: allParticipants.map((uid) => ({ user_id: uid })) },
    },
    include: { participants: { include: { user: { select: { id: true, name: true, profile_image: true } } } } },
  });

  return res.status(201).json(conversation);
});

// ─── Get messages ─────────────────────────────────────────────────────────────

router.get('/:id/messages', async (req, res) => {
  const { before, limit } = req.query;
  const messages = await prisma.message.findMany({
    where: {
      conversation_id: req.params.id,
      ...(before ? { created_at: { lt: new Date(before as string) } } : {}),
    },
    orderBy: { created_at: 'desc' },
    take: Number(limit ?? 50),
    include: { sender: { select: { id: true, name: true, profile_image: true } } },
  });
  return res.json(messages.reverse()); // return chronological order
});

// ─── Send message ─────────────────────────────────────────────────────────────

router.post('/:id/messages', async (req, res) => {
  const { text, type, attachment_url } = req.body as { text?: string; type?: string; attachment_url?: string };

  const message = await prisma.message.create({
    data: {
      conversation_id: req.params.id,
      sender_id: req.auth!.userId,
      text,
      type: type as never ?? 'text',
      attachment_url,
      read_by: [req.auth!.userId],
    },
    include: { sender: { select: { id: true, name: true, profile_image: true } } },
  });

  // Update conversation last_message
  await prisma.conversation.update({
    where: { id: req.params.id },
    data: { last_message: text ?? (type ?? 'attachment'), last_message_at: message.created_at },
  });

  // Increment unread count for all other participants
  await prisma.conversationParticipant.updateMany({
    where: { conversation_id: req.params.id, user_id: { not: req.auth!.userId } },
    data: { unread_count: { increment: 1 } },
  });

  return res.status(201).json(message);
});

// ─── Mark conversation as read ────────────────────────────────────────────────

router.put('/:id/read', async (req, res) => {
  await prisma.conversationParticipant.updateMany({
    where: { conversation_id: req.params.id, user_id: req.auth!.userId },
    data: { unread_count: 0 },
  });
  return res.json({ message: 'Marked as read' });
});

export default router;
