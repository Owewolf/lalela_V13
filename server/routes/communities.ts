import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { sendInviteEmail } from '../services/emailService.js';
// UserRole is a string enum in Prisma schema; reference it as a string literal type
type UserRole = 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER';

const router = Router();

// All community routes require auth
router.use(requireAuth);

// ─── List communities for current user ───────────────────────────────────────

router.get('/', async (req, res) => {
  const memberships = await prisma.communityMember.findMany({
    where: { userId: req.auth!.userId, status: 'ACTIVE' },
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
  const { name, description, coverageLat, coverageLng, coverageRadius, coverageLocation, enabledCategories, enabled_categories } = req.body;

  if (!name?.trim()) return res.status(400).json({ error: 'Community name is required' });

  try {
    // A user may only own one TRIAL community at a time.
    const existingTrial = await prisma.community.findFirst({
      where: { ownerId: req.auth!.userId, type: 'TRIAL' },
    });
    if (existingTrial) {
      return res.status(409).json({
        error: 'TRIAL_EXISTS',
        message: 'You already have an active trial community. Upgrade your licence to create additional communities.',
        community_id: existingTrial.id,
      });
    }

    const community = await prisma.community.create({
      data: {
        ownerId: req.auth!.userId,
        name: name.trim(),
        description,
        coverageLat,
        coverageLng,
        coverageRadius,
        coverageLocation,
        enabledCategories: enabledCategories ?? enabled_categories ?? [],
      },
    });

    // Add creator as Admin member — populate cached display fields immediately
    const creator = await prisma.user.findUnique({
      where: { id: req.auth!.userId },
      select: { name: true, profileImage: true, email: true },
    });
    await prisma.communityMember.create({
      data: {
        communityId: community.id,
        userId: req.auth!.userId,
        role: 'Admin',
        name: creator?.name ?? null,
        image: creator?.profileImage ?? null,
        email: creator?.email ?? null,
      },
    });

    // 30-day trial
    const trialEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await prisma.$transaction([
      prisma.community.update({
        where: { id: community.id },
        data: { trialEndDate: trialEnd, type: 'TRIAL' },
      }),
      prisma.user.update({
        where: { id: req.auth!.userId },
        data: { communityCreated: true, accessType: 'Trial', expiryDate: trialEnd },
      }),
    ]);

    return res.status(201).json({ ...community, trialEndDate: trialEnd, type: 'TRIAL' });
  } catch (err: any) {
    console.error('[POST /communities] error:', err);
    return res.status(500).json({ error: err?.message ?? 'Failed to create community' });
  }
});

// ─── License community (mock Stripe success) ──────────────────────────────────

router.post('/:id/license', async (req, res) => {
  const communityId = req.params.id;
  const userId = req.auth!.userId;

  const member = await prisma.communityMember.findFirst({
    where: { communityId, userId },
  });
  if (!member || !['Admin', 'Owner'].includes(member.role)) {
    return res.status(403).json({ error: 'Only community admins can license a community' });
  }

  const licenseId = `LIC_${uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase()}`;
  const licenseExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  const [community] = await prisma.$transaction([
    prisma.community.update({
      where: { id: communityId },
      data: { type: 'LICENSED', licenseId, licenseExpiry, status: 'ACTIVE' },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        licenseStatus: 'LICENSED',
        licenseType: 'SELF',
        accessType: 'Licensed',
        licenseExpiry,
      },
    }),
  ]);

  return res.json(community);
});

// ─── Update community ─────────────────────────────────────────────────────────

router.put('/:id', async (req, res) => {
  // Only admin or owner
  const member = await prisma.communityMember.findFirst({
    where: { communityId: req.params.id, userId: req.auth!.userId },
  });
  if (!member || !['Admin', 'Moderator'].includes(member.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const allowed = ['name', 'description', 'coverageLat', 'coverageLng', 'coverageRadius', 'coverageLocation', 'enabledCategories', 'isEmergencyMode', 'status', 'onboardingStepsCompleted'];
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
    where: { communityId: req.params.id },
    include: { user: { select: { id: true, name: true, profileImage: true, email: true, latitude: true, longitude: true, isSecurityMember: true, locationSharing: true } } },
  });
  // Flatten: cached member fields take priority; fall back to live user fields
  // Always include the user's default location so map pins are always visible
  return res.json(members.map(({ user, ...m }) => ({
    ...m,
    name: m.name || user?.name || null,
    image: m.image || user?.profileImage || null,
    email: m.email || user?.email || null,
    latitude: user?.latitude ?? null,
    longitude: user?.longitude ?? null,
    isSecurityMember: user?.isSecurityMember ?? false,
    locationSharingEnabled: user?.locationSharing ?? false,
  })));
});

router.put('/:id/members/:userId', async (req, res) => {
  const { role, status } = req.body as { role?: string; status?: string };
  const member = await prisma.communityMember.updateMany({
    where: { communityId: req.params.id, userId: req.params.userId },
    data: { ...(role ? { role: role as never } : {}), ...(status ? { status: status as never } : {}) },
  });
  return res.json(member);
});

router.delete('/:id/members/:userId', async (req, res) => {
  await prisma.communityMember.deleteMany({
    where: { communityId: req.params.id, userId: req.params.userId },
  });
  return res.json({ message: 'Member removed' });
});

// ─── Join via invite code ─────────────────────────────────────────────────────

router.post('/join/:code', async (req, res) => {
  const link = await prisma.communityInviteLink.findUnique({ where: { code: req.params.code } });
  if (!link || !link.active || (link.expiresAt && link.expiresAt < new Date())) {
    return res.status(400).json({ error: 'Invalid or expired invite link' });
  }
  if (link.maxUses && link.uses >= link.maxUses) {
    return res.status(400).json({ error: 'This invite link has reached its maximum uses' });
  }

  const existing = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: link.communityId, userId: req.auth!.userId } },
  });
  if (existing) return res.status(409).json({ error: 'Already a member of this community' });

  const joiner = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    select: { name: true, profileImage: true, email: true },
  });

  await prisma.$transaction([
    prisma.communityMember.create({
      data: {
        communityId: link.communityId,
        userId: req.auth!.userId,
        role: link.role,
        name: joiner?.name ?? null,
        image: joiner?.profileImage ?? null,
        email: joiner?.email ?? null,
      },
    }),
    prisma.communityInviteLink.update({
      where: { id: link.id },
      data: { uses: { increment: 1 } },
    }),
  ]);

  return res.json({ message: 'Joined community successfully', communityId: link.communityId });
});

// ─── Invite links ─────────────────────────────────────────────────────────────

router.get('/:id/invite-links', async (req, res) => {
  const links = await prisma.communityInviteLink.findMany({
    where: { communityId: req.params.id },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(links);
});

router.post('/:id/invite-links', async (req, res) => {
  const { role, max_uses, expires_at } = req.body;
  const link = await prisma.communityInviteLink.create({
    data: {
      communityId: req.params.id,
      createdBy: req.auth!.userId,
      code: uuidv4(),
      role: role ?? 'Member',
      maxUses: max_uses ?? null,
      expiresAt: expires_at ? new Date(expires_at) : null,
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
      communityId: req.params.id,
      invitedById: req.auth!.userId,
      invitedEmail: email,
      role: (role ?? 'Member') as UserRole,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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
      communityId: req.params.id,
      ...(type ? { type: type as never } : {}),
      ...(status ? { status: status as never } : { status: { not: 'Deleted' } }),
    },
    orderBy: { createdAt: 'desc' },
    take: Number(limit ?? 50),
    include: { author: { select: { name: true, profileImage: true } } },
  });
  // Flatten author fields — cached columns take priority, fall back to live user data
  return res.json(posts.map(({ author, ...p }) => ({
    ...p,
    authorName: p.authorName || author?.name || null,
    authorImage: p.authorImage || author?.profileImage || null,
    authorRole: p.authorRole || null,
  })));
});

router.post('/:id/posts', async (req, res) => {
  const { type, category, subtype, title, description, image_url, urgency, latitude, longitude, price, is_charity, charity_id, expires_at } = req.body;
  if (!type || !title?.trim()) return res.status(400).json({ error: 'type and title are required' });

  // Fetch author info to populate cached columns
  const authorUser = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    select: { name: true, profileImage: true },
  });
  // Resolve the author's role in this community
  const authorMembership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: req.params.id, userId: req.auth!.userId } },
    select: { role: true },
  });

  const post = await prisma.post.create({
    data: {
      communityId: req.params.id,
      authorId: req.auth!.userId,
      type,
      category,
      subtype,
      title: title.trim(),
      description,
      imageUrl: image_url,
      urgency: urgency ?? 'LOW',
      latitude,
      longitude,
      price,
      isCharity: is_charity ?? false,
      charityId: charity_id,
      expiresAt: expires_at ? new Date(expires_at) : null,
      authorName: authorUser?.name ?? null,
      authorImage: authorUser?.profileImage ?? null,
      authorRole: authorMembership?.role ?? null,
    },
  });
  return res.status(201).json({
    ...post,
    authorName: post.authorName,
    authorImage: post.authorImage,
    authorRole: post.authorRole,
  });
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

  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { name: true, profileImage: true } });

  const member = await prisma.communityMember.findFirst({ where: { communityId: req.params.id, userId: req.auth!.userId } });

  if (isSecurity) {
    await prisma.securityLocation.upsert({
      where: { communityId_userId: { communityId: req.params.id, userId: req.auth!.userId } },
      create: { communityId: req.params.id, userId: req.auth!.userId, latitude, longitude, name: user?.name, image: user?.profileImage },
      update: { latitude, longitude, timestamp: new Date() },
    });
  } else {
    await prisma.memberLocation.upsert({
      where: { communityId_userId: { communityId: req.params.id, userId: req.auth!.userId } },
      create: { communityId: req.params.id, userId: req.auth!.userId, latitude, longitude, name: user?.name, image: user?.profileImage, role: member?.role ?? 'Member' },
      update: { latitude, longitude, timestamp: new Date() },
    });
  }

  return res.json({ message: 'Location updated' });
});

router.get('/:id/locations', async (req, res) => {
  const [members, security] = await Promise.all([
    prisma.memberLocation.findMany({ where: { communityId: req.params.id } }),
    prisma.securityLocation.findMany({ where: { communityId: req.params.id } }),
  ]);
  return res.json({ members, security });
});

// ─── Charities ────────────────────────────────────────────────────────────────

router.get('/:id/charities', async (req, res) => {
  const charities = await prisma.charity.findMany({ where: { communityId: req.params.id } });
  return res.json(charities);
});

router.post('/:id/charities', async (req, res) => {
  const charity = await prisma.charity.create({
    data: { communityId: req.params.id, ...req.body },
  });
  return res.status(201).json(charity);
});

router.put('/:id/charities/:charityId', async (req, res) => {
  const charity = await prisma.charity.update({ where: { id: req.params.charityId }, data: req.body });
  return res.json(charity);
});

// ─── Moderation logs (stub — returns empty list until moderation is built) ────

router.get('/:id/moderation-logs', async (_req, res) => {
  return res.json([]);
});

// ─── Security events (stub — returns empty list until security is built) ──────

router.get('/:id/security-events', async (_req, res) => {
  return res.json([]);
});

// ─── Charity suggestions ──────────────────────────────────────────────────────

router.post('/:id/charity-suggestions', async (req, res) => {
  const suggestion = await prisma.charitySuggestion.create({
    data: { communityId: req.params.id, suggestedBy: req.auth!.userId, ...req.body },
  });
  return res.status(201).json(suggestion);
});

export default router;
