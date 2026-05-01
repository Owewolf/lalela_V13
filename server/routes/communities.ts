import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { sendInviteEmail } from '../services/emailService.js';
import type { UserRole } from '../generated/prisma/index.js';

const router = Router();

// All community routes require auth
router.use(requireAuth);

// ─── List communities for current user ───────────────────────────────────────

router.get('/', async (req, res) => {
  const memberships = await prisma.communityMember.findMany({
    where: { user_id: req.auth!.userId, status: 'ACTIVE' },
    include: { community: true },
  });
  return res.json(memberships.map((m) => ({ ...m.community, userRole: m.role })));
});

// ─── Get community ────────────────────────────────────────────────────────────

router.get('/:id', async (req, res) => {
  const community = await prisma.community.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { members: true } } },
  });
  if (!community) return res.status(404).json({ error: 'Community not found' });
  return res.json(community);
});

// ─── Create community ─────────────────────────────────────────────────────────

router.post('/', async (req, res) => {
  const { name, description, coverage_lat, coverage_lng, coverage_radius, coverage_location, enabled_categories } = req.body;

  if (!name?.trim()) return res.status(400).json({ error: 'Community name is required' });

  const community = await prisma.community.create({
    data: {
      owner_id: req.auth!.userId,
      name: name.trim(),
      description,
      coverage_lat,
      coverage_lng,
      coverage_radius,
      coverage_location,
      enabled_categories: enabled_categories ?? [],
    },
  });

  // Add creator as Admin member
  await prisma.communityMember.create({
    data: { community_id: community.id, user_id: req.auth!.userId, role: 'Admin' },
  });

  // Set 14-day trial expiry and mark community_created on user
  const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  await prisma.$transaction([
    prisma.community.update({
      where: { id: community.id },
      data: { trial_end_date: trialEnd, type: 'TRIAL' },
    }),
    prisma.user.update({
      where: { id: req.auth!.userId },
      data: { community_created: true, access_type: 'Trial', expiry_date: trialEnd },
    }),
  ]);

  return res.status(201).json({ ...community, trial_end_date: trialEnd, type: 'TRIAL' });
});

// ─── Update community ─────────────────────────────────────────────────────────

router.put('/:id', async (req, res) => {
  // Only admin or owner
  const member = await prisma.communityMember.findFirst({
    where: { community_id: req.params.id, user_id: req.auth!.userId },
  });
  if (!member || !['Admin', 'Moderator'].includes(member.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const allowed = ['name', 'description', 'coverage_lat', 'coverage_lng', 'coverage_radius', 'coverage_location', 'enabled_categories', 'is_emergency_mode', 'status'];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in req.body) data[key] = req.body[key];
  }

  const community = await prisma.community.update({ where: { id: req.params.id }, data });
  return res.json(community);
});

// ─── Members ──────────────────────────────────────────────────────────────────

router.get('/:id/members', async (req, res) => {
  const members = await prisma.communityMember.findMany({
    where: { community_id: req.params.id },
    include: { user: { select: { id: true, name: true, profile_image: true, email: true } } },
  });
  return res.json(members);
});

router.put('/:id/members/:userId', async (req, res) => {
  const { role, status } = req.body as { role?: string; status?: string };
  const member = await prisma.communityMember.updateMany({
    where: { community_id: req.params.id, user_id: req.params.userId },
    data: { ...(role ? { role: role as never } : {}), ...(status ? { status: status as never } : {}) },
  });
  return res.json(member);
});

router.delete('/:id/members/:userId', async (req, res) => {
  await prisma.communityMember.deleteMany({
    where: { community_id: req.params.id, user_id: req.params.userId },
  });
  return res.json({ message: 'Member removed' });
});

// ─── Join via invite code ─────────────────────────────────────────────────────

router.post('/join/:code', async (req, res) => {
  const link = await prisma.communityInviteLink.findUnique({ where: { code: req.params.code } });
  if (!link || !link.active || (link.expires_at && link.expires_at < new Date())) {
    return res.status(400).json({ error: 'Invalid or expired invite link' });
  }
  if (link.max_uses && link.uses >= link.max_uses) {
    return res.status(400).json({ error: 'This invite link has reached its maximum uses' });
  }

  const existing = await prisma.communityMember.findUnique({
    where: { community_id_user_id: { community_id: link.community_id, user_id: req.auth!.userId } },
  });
  if (existing) return res.status(409).json({ error: 'Already a member of this community' });

  await prisma.$transaction([
    prisma.communityMember.create({
      data: { community_id: link.community_id, user_id: req.auth!.userId, role: link.role },
    }),
    prisma.communityInviteLink.update({
      where: { id: link.id },
      data: { uses: { increment: 1 } },
    }),
  ]);

  return res.json({ message: 'Joined community successfully', communityId: link.community_id });
});

// ─── Invite links ─────────────────────────────────────────────────────────────

router.get('/:id/invite-links', async (req, res) => {
  const links = await prisma.communityInviteLink.findMany({
    where: { community_id: req.params.id },
    orderBy: { created_at: 'desc' },
  });
  return res.json(links);
});

router.post('/:id/invite-links', async (req, res) => {
  const { role, max_uses, expires_at } = req.body;
  const link = await prisma.communityInviteLink.create({
    data: {
      community_id: req.params.id,
      created_by: req.auth!.userId,
      code: uuidv4(),
      role: role ?? 'Member',
      max_uses: max_uses ?? null,
      expires_at: expires_at ? new Date(expires_at) : null,
    },
  });
  return res.status(201).json(link);
});

router.delete('/:id/invite-links/:linkId', async (req, res) => {
  await prisma.communityInviteLink.update({
    where: { id: req.params.linkId },
    data: { active: false },
  });
  return res.json({ message: 'Invite link deactivated' });
});

// ─── Email invitations ────────────────────────────────────────────────────────

router.post('/:id/invitations/email', async (req, res) => {
  const { email, role, inviteUrl, senderName } = req.body as {
    email?: string; role?: string; inviteUrl?: string; senderName?: string;
  };

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid recipient email is required' });
  }
  if (!inviteUrl) return res.status(400).json({ error: 'inviteUrl is required' });

  const community = await prisma.community.findUnique({ where: { id: req.params.id } });
  if (!community) return res.status(404).json({ error: 'Community not found' });

  const invitation = await prisma.communityInvitation.create({
    data: {
      community_id: req.params.id,
      invited_by_id: req.auth!.userId,
      invited_email: email,
      role: (role ?? 'Member') as UserRole,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  try {
    await sendInviteEmail(email, inviteUrl, community.name, senderName ?? 'A Lalela community admin');
  } catch (err) {
    console.error('[communities/invite-email] error:', err);
    return res.status(503).json({ error: 'Failed to send invite email' });
  }

  return res.status(201).json({ message: `Invite sent to ${email}`, invitation });
});

// ─── Posts ────────────────────────────────────────────────────────────────────

router.get('/:id/posts', async (req, res) => {
  const { type, status, limit } = req.query;
  const posts = await prisma.post.findMany({
    where: {
      community_id: req.params.id,
      ...(type ? { type: type as never } : {}),
      ...(status ? { status: status as never } : { status: { not: 'Deleted' } }),
    },
    orderBy: { created_at: 'desc' },
    take: Number(limit ?? 50),
  });
  return res.json(posts);
});

router.post('/:id/posts', async (req, res) => {
  const { type, category, subtype, title, description, image_url, urgency, latitude, longitude, price, is_charity, charity_id, expires_at } = req.body;
  if (!type || !title?.trim()) return res.status(400).json({ error: 'type and title are required' });

  const post = await prisma.post.create({
    data: {
      community_id: req.params.id,
      author_id: req.auth!.userId,
      type,
      category,
      subtype,
      title: title.trim(),
      description,
      image_url,
      urgency: urgency ?? 'LOW',
      latitude,
      longitude,
      price,
      is_charity: is_charity ?? false,
      charity_id,
      expires_at: expires_at ? new Date(expires_at) : null,
    },
  });
  return res.status(201).json(post);
});

router.put('/:id/posts/:postId', async (req, res) => {
  const allowed = ['title', 'description', 'image_url', 'status', 'urgency', 'price', 'expires_at'];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in req.body) data[key] = key === 'expires_at' && req.body[key] ? new Date(req.body[key]) : req.body[key];
  }
  const post = await prisma.post.update({ where: { id: req.params.postId }, data });
  return res.json(post);
});

router.delete('/:id/posts/:postId', async (req, res) => {
  await prisma.post.update({ where: { id: req.params.postId }, data: { status: 'Deleted' } });
  return res.json({ message: 'Post deleted' });
});

// ─── Member locations ─────────────────────────────────────────────────────────

router.put('/:id/location', async (req, res) => {
  const { latitude, longitude, isSecurity } = req.body as { latitude: number; longitude: number; isSecurity?: boolean };
  if (!latitude || !longitude) return res.status(400).json({ error: 'latitude and longitude are required' });

  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { name: true, profile_image: true } });

  const member = await prisma.communityMember.findFirst({ where: { community_id: req.params.id, user_id: req.auth!.userId } });

  if (isSecurity) {
    await prisma.securityLocation.upsert({
      where: { community_id_user_id: { community_id: req.params.id, user_id: req.auth!.userId } },
      create: { community_id: req.params.id, user_id: req.auth!.userId, latitude, longitude, name: user?.name, image: user?.profile_image },
      update: { latitude, longitude, timestamp: new Date() },
    });
  } else {
    await prisma.memberLocation.upsert({
      where: { community_id_user_id: { community_id: req.params.id, user_id: req.auth!.userId } },
      create: { community_id: req.params.id, user_id: req.auth!.userId, latitude, longitude, name: user?.name, image: user?.profile_image, role: member?.role ?? 'Member' },
      update: { latitude, longitude, timestamp: new Date() },
    });
  }

  return res.json({ message: 'Location updated' });
});

router.get('/:id/locations', async (req, res) => {
  const [members, security] = await Promise.all([
    prisma.memberLocation.findMany({ where: { community_id: req.params.id } }),
    prisma.securityLocation.findMany({ where: { community_id: req.params.id } }),
  ]);
  return res.json({ members, security });
});

// ─── Charities ────────────────────────────────────────────────────────────────

router.get('/:id/charities', async (req, res) => {
  const charities = await prisma.charity.findMany({ where: { community_id: req.params.id } });
  return res.json(charities);
});

router.post('/:id/charities', async (req, res) => {
  const charity = await prisma.charity.create({
    data: { community_id: req.params.id, ...req.body },
  });
  return res.status(201).json(charity);
});

router.put('/:id/charities/:charityId', async (req, res) => {
  const charity = await prisma.charity.update({ where: { id: req.params.charityId }, data: req.body });
  return res.json(charity);
});

// ─── Charity suggestions ──────────────────────────────────────────────────────

router.post('/:id/charity-suggestions', async (req, res) => {
  const suggestion = await prisma.charitySuggestion.create({
    data: { community_id: req.params.id, suggested_by: req.auth!.userId, ...req.body },
  });
  return res.status(201).json(suggestion);
});

export default router;
