import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import {
  sendCommunityCreatedEmail,
  sendInviteEmail,
  sendMemberJoinedEmail,
} from '../services/emailService.js';
import { handlePaymentSuccess } from '../billing/paymentService.js';
import { getOrCreateCommunityInviteLink } from '../billing/inviteService.js';
import { notifyCommunityMembers } from '../services/notificationService.js';
// UserRole is a string enum in Prisma schema; reference it as a string literal type
type UserRole = 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER';

const router = Router();
const CAT_MIN_PERCENTAGE = 15;

const isAdminRole = (role?: string | null) => role === 'OWNER' || role === 'ADMIN';

function serializeCharitySuggestion(
  suggestion: any
): {
  id: string;
  communityId: string;
  charityId?: string;
  suggestedById: string;
  suggestedByName: string;
  name: string;
  description: string;
  suggestedDonationAmount?: number;
  reason: string;
  website?: string;
  status: 'pending' | 'approved' | 'rejected';
  adminFeedback?: string;
  createdAt: Date;
} {
  return {
    id: suggestion.id,
    communityId: suggestion.communityId,
    charityId: suggestion.charityId ?? undefined,
    suggestedById: suggestion.suggestedBy,
    suggestedByName: suggestion.user?.name ?? suggestion.suggestedByName ?? 'Community Member',
    name: suggestion.name,
    description: suggestion.description ?? '',
    suggestedDonationAmount: suggestion.suggestedDonationAmount ?? undefined,
    reason: suggestion.reason ?? '',
    website: suggestion.website ?? undefined,
    status: (suggestion.status ?? 'pending').toLowerCase(),
    adminFeedback: suggestion.adminFeedback ?? undefined,
    createdAt: suggestion.createdAt,
  };
}

async function getCommunityRole(communityId: string, userId: string): Promise<string | null> {
  const member = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId } },
    select: { role: true },
  });
  return member?.role ?? null;
}

// All community routes require auth
router.use(requireAuth);

// ─── List communities for current user ───────────────────────────────────────

router.get('/', async (req, res) => {
  const memberships = await prisma.communityMember.findMany({
    where: { userId: req.auth!.userId, status: 'ACTIVE' },
    include: { community: true },
  });
  return res.json(memberships.map((m) => ({
    ...m.community,
    userRole: m.role,
    isSecurityMember: m.isSecurityMember,
  })));
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
  const { name, description, coverageLat, coverageLng, coverageRadius, coverageLocation, enabledCategories } = req.body;

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
        enabledCategories: enabledCategories ?? [],
      },
    });

    const catCharity = await prisma.charity.create({
      data: {
        communityId: community.id,
        name: 'CAT',
        description: 'Community Assistance Tax baseline charity',
        percentage: CAT_MIN_PERCENTAGE,
        status: 'ACTIVE',
        isFeatured: true,
        isCATCharity: true,
        isVerified: true,
        locationName: coverageLocation ?? name.trim(),
      } as any,
    });

    const defaultCommunityTheme = {
      communityId: community.id,
      name: `${community.name} Theme`,
      primaryColor: '#0d3d47',
      secondaryColor: '#9c4421',
      backgroundColor: '#fff8f0',
      surfaceColor: '#efeeeb',
      textPrimary: '#0f172a',
      textSecondary: '#64748b',
      borderRadius: '16px',
      fontFamily: 'System',
      iconUrl: null,
      isDefault: false,
    };

    // Add creator as Admin member — populate cached display fields immediately
    const creator = await prisma.user.findUnique({
      where: { id: req.auth!.userId },
      select: { name: true, profileImage: true, email: true, licenseStatus: true },
    });
    await prisma.communityMember.create({
      data: {
        communityId: community.id,
        userId: req.auth!.userId,
        role: 'ADMIN',
        name: creator?.name ?? null,
        image: creator?.profileImage ?? null,
        email: creator?.email ?? null,
      },
    });

    // Community has a 30-day trial, while the creator gets a 1-year platform trial.
    const trialEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const creatorTrialEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const creatorLicenseUpdate = creator?.licenseStatus === 'ACTIVE'
      ? { communityCreated: true }
      : { communityCreated: true, trialExpiresAt: creatorTrialEnd, licenseStatus: 'TRIAL' };

    await prisma.$transaction([
      prisma.community.update({
        where: { id: community.id },
        data: { trialExpiresAt: trialEnd, type: 'TRIAL', catFeaturedCharityId: catCharity.id } as any,
      }),
      prisma.theme.create({
        data: defaultCommunityTheme,
      }),
      prisma.user.update({
        where: { id: req.auth!.userId },
        data: creatorLicenseUpdate,
      }),
    ]);

    if (creator?.email && creator.name) {
      (async () => {
        let inviteLink: string | undefined;
        try {
          inviteLink = await getOrCreateCommunityInviteLink(prisma, community.id, req.auth!.userId);
        } catch (err) {
          console.error('[communities] invite link generation failed:', err);
        }
        await sendCommunityCreatedEmail(creator.email!, creator.name!, community.name, trialEnd, inviteLink);
      })().catch((err) => console.error('[communities] community created email failed:', err));
    }

    return res.status(201).json({
      ...community,
      trialExpiresAt: trialEnd,
      trialEndDate: trialEnd,
      type: 'TRIAL',
    });
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
  if (!member || !['ADMIN', 'OWNER'].includes(member.role)) {
    return res.status(403).json({ error: 'Only community admins can license a community' });
  }

  const creator = await prisma.user.findUnique({
    where: { id: userId },
    select: { licenseStatus: true },
  });

  const creatorTrialEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const activatedAt = new Date();

  const creatorLicenseUpdate = creator?.licenseStatus === 'ACTIVE'
    ? { communityCreated: true }
    : { communityCreated: true, trialExpiresAt: creatorTrialEnd, licenseStatus: 'TRIAL' };

  const [community] = await prisma.$transaction([
    prisma.community.update({
      where: { id: communityId },
      data: { type: 'ACTIVE', isPaid: true, activatedAt, status: 'ACTIVE' },
    }),
    prisma.user.update({
      where: { id: userId },
      data: creatorLicenseUpdate,
    }),
  ]);

  handlePaymentSuccess(userId, 'COMMUNITY', communityId).catch(
    (err) => console.error('[communities] handlePaymentSuccess error:', err),
  );

  return res.json(community);
});

// ─── Update community ─────────────────────────────────────────────────────────

router.put('/:id', async (req, res) => {
  // Only admin or owner
  const member = await prisma.communityMember.findFirst({
    where: { communityId: req.params.id, userId: req.auth!.userId },
  });
  if (!member || !['ADMIN', 'MODERATOR'].includes(member.role)) {
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
    include: { user: { select: { id: true, name: true, profileImage: true, email: true, latitude: true, longitude: true, locationSharing: true } } },
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
    isSecurityMember: m.isSecurityMember ?? false,
    locationSharingEnabled: user?.locationSharing ?? false,
  })));
});

router.put('/:id/members/:userId', async (req, res) => {
  const { role, status, isSecurityMember } = req.body as {
    role?: string;
    status?: string;
    isSecurityMember?: boolean;
  };

  const isSelfUpdate = req.auth!.userId === req.params.userId;
  if (!isSelfUpdate) {
    const actorRole = await getCommunityRole(req.params.id, req.auth!.userId);
    if (!isAdminRole(actorRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
  }

  const data: Record<string, unknown> = {
    ...(role ? { role: role as never } : {}),
    ...(status ? { status: status as never } : {}),
    ...(typeof isSecurityMember === 'boolean' ? { isSecurityMember } : {}),
  };
  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'No valid fields provided' });
  }

  const member = await prisma.communityMember.update({
    where: { communityId_userId: { communityId: req.params.id, userId: req.params.userId } },
    data,
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

// Preview: return community name for the invite code (used by onboarding screen)
router.get('/join/:code', async (req, res) => {
  const link = await prisma.communityInviteLink.findUnique({
    where: { code: req.params.code },
    include: {
      community: {
        select: {
          name: true,
          coverageLat: true,
          coverageLng: true,
          coverageRadius: true,
          coverageLocation: true,
        },
      },
    },
  });
  if (!link || !link.active || (link.expiresAt && link.expiresAt < new Date())) {
    return res.status(400).json({ error: 'Invalid or expired invite link' });
  }

  const coverageArea =
    link.community.coverageLat != null &&
    link.community.coverageLng != null &&
    link.community.coverageLocation
      ? {
          latitude: link.community.coverageLat,
          longitude: link.community.coverageLng,
          radius: link.community.coverageRadius ?? 1,
          locationName: link.community.coverageLocation,
        }
      : null;

  return res.json({ communityName: link.community.name, coverageArea });
});

router.post('/join/:code', async (req, res) => {
  const link = await prisma.communityInviteLink.findUnique({
    where: { code: req.params.code },
    include: {
      community: {
        select: { name: true },
      },
    },
  });
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
    select: { name: true, profileImage: true, email: true, licenseStatus: true, trialExpiresAt: true },
  });

  let memberTrialExpiresAt = joiner?.trialExpiresAt ?? null;

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

  // Always update lastCommunityId so the client knows which community to show
  const userDataUpdate: Record<string, unknown> = { lastCommunityId: link.communityId };

  // Grant the joining user a 1-year trial if they don't already have a license
  if (!joiner?.licenseStatus || joiner.licenseStatus === 'NONE') {
    memberTrialExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    userDataUpdate.licenseStatus = 'TRIAL';
    userDataUpdate.trialExpiresAt = memberTrialExpiresAt;
  }

  await prisma.user.update({
    where: { id: req.auth!.userId },
    data: userDataUpdate,
  });

  if (joiner?.email && joiner.name && memberTrialExpiresAt) {
    sendMemberJoinedEmail(joiner.email, joiner.name, link.community.name, memberTrialExpiresAt).catch(
      (err) => console.error('[communities] member joined email failed:', err),
    );
  }

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
  const { role, maxUses, expiresAt } = req.body;
  const link = await prisma.communityInviteLink.create({
    data: {
      communityId: req.params.id,
      createdBy: req.auth!.userId,
      code: uuidv4(),
      role: role ?? 'Member',
      maxUses: maxUses ?? null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
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
    timestamp: p.createdAt,
    authorName: p.authorName || author?.name || null,
    authorImage: p.authorImage || author?.profileImage || null,
    authorRole: p.authorRole || null,
  })));
});

router.post('/:id/posts', async (req, res) => {
  const { type, category, subtype, postSubtype, title, description, image_url, imageUrl, postsImage, urgency, urgencyLevel,
    latitude, longitude, price, communityPrice, publicPrice, charityAmount, charityPercentage,
    is_charity, charity_id, charityId, expires_at, isPublic, locationName, source,
    authorName: bodyAuthorName, authorRole: bodyAuthorRole, authorImage: bodyAuthorImage } = req.body;
  if (!type || !title?.trim()) return res.status(400).json({ error: 'type and title are required' });

  const resolvedIsPublic = Boolean(isPublic);
  // CAT margin (≥15%) always applies to public listings as the buyer's potential
  // resale earning. A charity is optional — funds route there only when one is set.
  const rawCharityPercentage = Number(charityPercentage ?? 0);
  const resolvedCharityPercentage = resolvedIsPublic
    ? Math.max(Number.isFinite(rawCharityPercentage) ? rawCharityPercentage : 0, CAT_MIN_PERCENTAGE)
    : 0;

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
      subtype: subtype ?? postSubtype ?? null,
      title: title.trim(),
      description,
      imageUrl: imageUrl ?? image_url ?? null,
      postsImage: postsImage ?? null,
      urgency: urgency ?? 'LOW',
      urgencyLevel: urgencyLevel ?? null,
      latitude,
      longitude,
      locationName: locationName ?? null,
      price,
      communityPrice: communityPrice ?? null,
      publicPrice: publicPrice ?? null,
      isPublic: resolvedIsPublic,
      isCharity: is_charity ?? false,
      charityId: charityId ?? charity_id ?? null,
      charityPercentage: resolvedIsPublic ? resolvedCharityPercentage : (charityPercentage ?? null),
      charityAmount: charityAmount ?? null,
      source: source ?? null,
      expiresAt: expires_at ? new Date(expires_at) : null,
      authorName: authorUser?.name ?? null,
      authorImage: authorUser?.profileImage ?? null,
      authorRole: authorMembership?.role ?? null,
    },
  });

  const authorDisplayName = post.authorName || authorUser?.name || 'A community member';
  const isEmergencyNotice =
    type === 'notice' &&
    (String(urgencyLevel ?? '').toLowerCase() === 'emergency' ||
      String(urgency ?? '').toLowerCase() === 'emergency' ||
      String(subtype ?? postSubtype ?? '').toLowerCase() === 'emergency');

  if (type === 'listing') {
    await notifyCommunityMembers({
      communityId: req.params.id,
      actorUserId: req.auth!.userId,
      category: 'listingUpdates',
      type: 'listing',
      title: `New listing: ${post.title}`,
      message: `${authorDisplayName} posted a new listing for the community.`,
      metadata: {
        communityId: req.params.id,
        postId: post.id,
        postType: type,
        route: '/market',
      },
      push: {
        title: 'New community listing',
        body: `${authorDisplayName}: ${post.title}`,
        data: {
          type: 'listing',
          route: '/market',
          communityId: req.params.id,
          postId: post.id,
        },
      },
    });
  } else {
    await notifyCommunityMembers({
      communityId: req.params.id,
      actorUserId: req.auth!.userId,
      category: isEmergencyNotice ? 'securityAlerts' : 'generalNotices',
      mandatory: isEmergencyNotice,
      type: isEmergencyNotice ? 'alert' : 'notice',
      title: isEmergencyNotice ? `Emergency alert: ${post.title}` : `New notice: ${post.title}`,
      message: isEmergencyNotice
        ? `${authorDisplayName} raised an emergency alert for the community.`
        : `${authorDisplayName} posted a new community notice.`,
      metadata: {
        communityId: req.params.id,
        postId: post.id,
        postTitle: post.title,
        postDescription: post.description ?? '',
        authorName: authorDisplayName,
        emergencyId: isEmergencyNotice ? post.id : undefined,
        route: isEmergencyNotice ? `/emergency/${post.id}` : '/(tabs)/posts',
      },
      push: {
        title: isEmergencyNotice ? 'Emergency alert' : 'New community notice',
        body: `${authorDisplayName}: ${post.title}`,
        data: {
          type: isEmergencyNotice ? 'alert' : 'notice',
          route: isEmergencyNotice ? `/emergency/${post.id}` : '/(tabs)/posts',
          communityId: req.params.id,
          emergencyId: isEmergencyNotice ? post.id : '',
          postId: post.id,
        },
      },
    });
  }

  return res.status(201).json({
    ...post,
    timestamp: post.createdAt,
    authorName: post.authorName,
    authorImage: post.authorImage,
    authorRole: post.authorRole,
  });
});

router.put('/:id/posts/:postId', async (req, res) => {
  const existingPost = await prisma.post.findFirst({
    where: { id: req.params.postId, communityId: req.params.id },
  });
  if (!existingPost) return res.status(404).json({ error: 'Post not found' });

  const allowed = [
    'title', 'description', 'imageUrl', 'postsImage', 'status', 'urgency', 'urgencyLevel',
    'price', 'communityPrice', 'publicPrice', 'charityId', 'charityPercentage', 'charityAmount',
    'isPublic', 'category', 'subtype', 'locationName', 'latitude', 'longitude', 'source', 'expiresAt',
  ];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in req.body) data[key] = key === 'expiresAt' && req.body[key] ? new Date(req.body[key]) : req.body[key];
  }
  // Accept legacy camelCase alias from the mobile client.
  if (!('subtype' in data) && 'postSubtype' in req.body) {
    data.subtype = req.body.postSubtype;
  }

  const nextIsPublic = 'isPublic' in data ? Boolean(data.isPublic) : Boolean(existingPost.isPublic);
  const nextCharityPercentage =
    'charityPercentage' in data
      ? Number(data.charityPercentage ?? 0)
      : Number(existingPost.charityPercentage ?? 0);
  if (nextIsPublic && (!Number.isFinite(nextCharityPercentage) || nextCharityPercentage < CAT_MIN_PERCENTAGE)) {
    return res.status(400).json({ error: `Public listings require charityPercentage >= ${CAT_MIN_PERCENTAGE}` });
  }

  if (nextIsPublic) {
    const nextCharityId = ('charityId' in data ? data.charityId : existingPost.charityId) as string | null | undefined;
    if (!nextCharityId) {
      return res.status(400).json({ error: 'Public listings require a charityId' });
    }
  }

  const post = await prisma.post.update({
    where: { id: req.params.postId },
    data,
    include: { author: { select: { name: true, profileImage: true } } },
  });
  const { author, ...rest } = post;
  return res.json({
    ...rest,
    timestamp: post.createdAt,
    authorName: post.authorName || author?.name || null,
    authorImage: post.authorImage || author?.profileImage || null,
    authorRole: post.authorRole || null,
  });
});

router.post('/:id/posts/:postId/sold', async (req, res) => {
  const post = await prisma.post.findFirst({
    where: { id: req.params.postId, communityId: req.params.id },
  });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.authorId !== req.auth!.userId) {
    return res.status(403).json({ error: 'Only the listing owner can mark a post as sold' });
  }

  if (String(post.status).toUpperCase() === 'SOLD') {
    return res.status(409).json({ error: 'Post already marked as sold' });
  }

  const soldAt = new Date();
  const updatedPost = await prisma.post.update({
    where: { id: post.id },
    data: { status: 'SOLD', soldAt } as any,
  });

  // Local sales do not trigger CAT accounting.
  if (!post.isPublic) {
    return res.json({ post: { ...updatedPost, timestamp: updatedPost.createdAt }, catTriggered: false });
  }

  const community = await prisma.community.findUnique({ where: { id: req.params.id } });
  const catAmount = Number(post.charityAmount ?? 0);
  const catPercentage = Number(post.charityPercentage ?? CAT_MIN_PERCENTAGE);

  // Attribution rule:
  // 1) If there is a currently featured charity, sold public listings pool to it.
  // 2) If no featured charity exists, CAT is recorded without charity attribution.
  let targetCharityId: string | null = (community as any)?.catFeaturedCharityId ?? null;

  if (!targetCharityId) {
    const featuredCharity = await prisma.charity.findFirst({
      where: {
        communityId: req.params.id,
        isFeatured: true,
        NOT: { status: { in: ['Archived', 'ARCHIVED'] } },
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
    targetCharityId = featuredCharity?.id ?? null;
  }

  const catTx = (prisma as any).catTransaction;
  const transaction = catTx
    ? await catTx.create({
        data: {
          communityId: req.params.id,
          postId: post.id,
          sellerId: req.auth!.userId,
          catAmount,
          catPercentage,
          charityId: targetCharityId,
        },
      })
    : null;

  if (targetCharityId && catAmount > 0) {
    await prisma.charity.update({
      where: { id: targetCharityId },
      data: { raisedAmount: { increment: catAmount } },
    });
  }

  return res.json({
    post: { ...updatedPost, timestamp: updatedPost.createdAt },
    catTriggered: true,
    catAmount,
    pooledToCharity: Boolean(targetCharityId),
    transaction,
  });
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
  try {
    const charities = await prisma.charity.findMany({ where: { communityId: req.params.id } });
    return res.json(charities);
  } catch (error: any) {
    console.error('[API Error] 500:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch charities' });
  }
});

router.post('/:id/charities', async (req, res) => {
  try {
    const charity = await prisma.charity.create({
      data: { communityId: req.params.id, ...req.body },
    });
    return res.status(201).json(charity);
  } catch (error: any) {
    console.error('[API Error] 500:', error);
    return res.status(500).json({ error: error.message || 'Failed to create charity' });
  }
});

router.put('/:id/charities/:charityId', async (req, res) => {
  try {
    const existingCharity = await prisma.charity.findUnique({
      where: { id: req.params.charityId },
      select: { id: true, name: true, isCATCharity: true },
    });
    if (!existingCharity) return res.status(404).json({ error: 'Charity not found' });
    if (existingCharity.isCATCharity && typeof req.body?.name === 'string' && req.body.name.trim() !== existingCharity.name) {
      return res.status(400).json({ error: 'The CAT charity name is fixed and cannot be renamed' });
    }

    const charity = await prisma.charity.update({ where: { id: req.params.charityId }, data: req.body });
    return res.json(charity);
  } catch (error: any) {
    console.error('[API Error] 500:', error);
    return res.status(500).json({ error: error.message || 'Failed to update charity' });
  }
});

router.post('/:id/cat-cycle', async (req, res) => {
  try {
    const role = await getCommunityRole(req.params.id, req.auth!.userId);
    if (!isAdminRole(role)) {
      return res.status(403).json({ error: 'Only community admins can manage CAT cycle' });
    }

    const { active, featuredCharityId } = req.body as { active?: boolean; featuredCharityId?: string };
    if (typeof active !== 'boolean') {
      return res.status(400).json({ error: 'active must be a boolean' });
    }

    let resolvedFeaturedId: string | null = null;
    if (active) {
      if (!featuredCharityId) {
        return res.status(400).json({ error: 'featuredCharityId is required when activating CAT cycle' });
      }
      const featured = await prisma.charity.findFirst({
        where: {
          id: featuredCharityId,
          communityId: req.params.id,
          status: { in: ['ACTIVE', 'Active', 'active'] },
        },
      });
      if (!featured) {
        return res.status(400).json({ error: 'featuredCharityId must reference an active community charity' });
      }
      resolvedFeaturedId = featured.id;
    }

    const community = await prisma.community.update({
      where: { id: req.params.id },
      data: {
        catCycleActive: active,
        catFeaturedCharityId: active ? resolvedFeaturedId : null,
      } as any,
    });

    await notifyCommunityMembers({
      communityId: req.params.id,
      actorUserId: req.auth!.userId,
      category: 'communityActivity',
      type: 'system',
      title: active ? 'Charity cycle activated' : 'Charity cycle paused',
      message: active
        ? 'CAT contributions from public sold listings are now pooled to the featured charity.'
        : 'CAT contributions from sold public listings now remain as seller earnings.',
      metadata: {
        communityId: req.params.id,
        catCycleActive: active,
        featuredCharityId: resolvedFeaturedId,
        route: '/settings',
      },
      push: {
        title: active ? 'Charity cycle activated' : 'Charity cycle paused',
        body: active
          ? 'Public CAT contributions are now pooled to the featured charity.'
          : 'Public CAT contributions now remain seller earnings.',
        data: {
          type: 'system',
          route: '/settings',
          communityId: req.params.id,
        },
      },
    });

    return res.json({
      community,
      catCycleActive: (community as any).catCycleActive,
      catFeaturedCharityId: (community as any).catFeaturedCharityId,
    });
  } catch (error: any) {
    console.error('[API Error] 500:', error);
    return res.status(500).json({ error: error.message || 'Failed to update CAT cycle' });
  }
});

// ─── Moderation logs (stub — returns empty list until moderation is built) ────

router.get('/:id/moderation-logs', async (_req, res) => {
  return res.json([]);
});

// ─── Live community insights (aggregate) ─────────────────────────────────────
// Returns a single payload powering the dashboard "Community Pulse" experience.
// Numbers are derived from real tables only — never fabricated. Where source
// tables are still stubbed (moderation logs, security events), the relevant
// counts are returned as 0.

router.get('/:id/live-insights', async (req, res) => {
  try {
    const cid = req.params.id;
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const responderActiveSince = new Date(now.getTime() - 15 * 60 * 1000); // online if location updated in last 15 min

    const [
      postsLast24h,
      newMembersLast7d,
      moderatorsTotal,
      respondersOnline,
      charities,
      recentBusinesses,
      recentMembers,
      recentPosts,
      activeReports,
      topCategoryRows,
    ] = await Promise.all([
      prisma.post.count({ where: { communityId: cid, createdAt: { gte: last24h }, status: { not: 'Deleted' } } }),
      prisma.communityMember.count({ where: { communityId: cid, joinedAt: { gte: last7d }, status: 'ACTIVE' } }),
      prisma.communityMember.count({ where: { communityId: cid, role: { in: ['ADMIN', 'MODERATOR', 'OWNER'] }, status: 'ACTIVE' } }),
      prisma.securityLocation.count({ where: { communityId: cid, timestamp: { gte: responderActiveSince } } }),
      prisma.charity.findMany({ where: { communityId: cid }, orderBy: { updatedAt: 'desc' } }),
      prisma.business.findMany({
        where: { communityIds: { has: cid }, createdAt: { gte: last7d } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.communityMember.findMany({
        where: { communityId: cid, joinedAt: { gte: last7d }, status: 'ACTIVE' },
        orderBy: { joinedAt: 'desc' },
        take: 5,
      }),
      prisma.post.findMany({
        where: { communityId: cid, status: { not: 'Deleted' } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.report.count({ where: { communityId: cid, status: 'pending' } }),
      prisma.post.groupBy({
        by: ['category'],
        where: { communityId: cid, createdAt: { gte: last30d }, status: { not: 'Deleted' }, category: { not: '' } },
        _count: { category: true },
        orderBy: { _count: { category: 'desc' } },
        take: 1,
      }),
    ]);

    const donationsTotal = charities.reduce((sum, c) => sum + (c.raisedAmount || 0), 0);
    const featuredCharity = charities.find((c) => c.isFeatured) || charities[0] || null;

    // Volunteers = members flagged as security responders (active)
    const activeVolunteers = await prisma.communityMember.count({
      where: { communityId: cid, isSecurityMember: true, status: 'ACTIVE' },
    });

    // Most active area: location of most recent post that has a name
    const mostActiveArea =
      recentPosts.find((p) => p.locationName && p.locationName.trim().length > 0)?.locationName || null;

    // Energy score (0..3 → QUIET/MEDIUM/ACTIVE/HIGH)
    const energyScore =
      (postsLast24h >= 5 ? 1 : 0) +
      (newMembersLast7d >= 3 ? 1 : 0) +
      (respondersOnline > 0 ? 1 : 0) +
      (recentBusinesses.length > 0 ? 1 : 0);
    const energy: 'QUIET' | 'MEDIUM' | 'ACTIVE' | 'HIGH' =
      energyScore >= 4 ? 'HIGH' : energyScore === 3 ? 'ACTIVE' : energyScore === 2 ? 'MEDIUM' : 'QUIET';

    // Engagement score: simple 0-100 blend of post/member/responder/business activity
    const engagementScore = Math.min(
      100,
      postsLast24h * 8 + newMembersLast7d * 5 + respondersOnline * 10 + recentBusinesses.length * 6,
    );

    // Build a unified feed (latest first) from posts + new members + business approvals
    type FeedKind = 'post' | 'join' | 'business' | 'donation';
    type FeedItem = { id: string; kind: FeedKind; icon: string; message: string; timestamp: string };
    const feed: FeedItem[] = [];

    for (const p of recentPosts.slice(0, 6)) {
      const title = (p.title || 'Untitled').slice(0, 60);
      feed.push({
        id: `post-${p.id}`,
        kind: 'post',
        icon: p.type === 'notice' ? '📢' : p.type === 'listing' ? '🏷️' : '📝',
        message: `${p.authorName || 'A member'} posted "${title}"`,
        timestamp: p.createdAt.toISOString(),
      });
    }
    for (const m of recentMembers) {
      feed.push({
        id: `join-${m.userId}`,
        kind: 'join',
        icon: '👥',
        message: `${m.name || 'A new member'} joined the community`,
        timestamp: m.joinedAt.toISOString(),
      });
    }
    for (const b of recentBusinesses) {
      feed.push({
        id: `biz-${b.id}`,
        kind: 'business',
        icon: '🏪',
        message: `New local business "${b.name}" added`,
        timestamp: b.createdAt.toISOString(),
      });
    }
    // Donation chip — only if featured charity has any raised amount (cannot identify donors)
    if (featuredCharity && (featuredCharity.raisedAmount || 0) > 0) {
      feed.push({
        id: `donation-${featuredCharity.id}`,
        kind: 'donation',
        icon: '❤️',
        message: `R${Math.round(featuredCharity.raisedAmount || 0).toLocaleString()} raised for ${featuredCharity.name}`,
        timestamp: featuredCharity.updatedAt.toISOString(),
      });
    }

    feed.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

    return res.json({
      energy,
      counts: {
        postsLast24h,
        newMembersLast7d,
        alertsActive: 0,            // SecurityEvent table not built
        alertsResolved24h: 0,
        donationsTotal,
        donationsLast24h: 0,        // No transactions table — cannot compute deltas accurately
        businessesAdded7d: recentBusinesses.length,
        respondersOnline,
        moderatorsOnline: moderatorsTotal, // online-state not tracked; report total instead
        activeReports,
      },
      feed: feed.slice(0, 10),
      insights: {
        mostActiveArea,
        topCategory: topCategoryRows[0]?.category || null,
        activeVolunteers,
        engagementScore,
      },
    });
  } catch (error: any) {
    console.error('[API Error] /live-insights:', error);
    return res.status(500).json({ error: error.message || 'Failed to load live insights' });
  }
});

// ─── Security events (stub — returns empty list until security is built) ──────

router.get('/:id/security-events', async (_req, res) => {
  return res.json([]);
});

// ─── Charity suggestions ──────────────────────────────────────────────────────

router.get('/:id/charity-suggestions', async (req, res) => {
  try {
    const suggestions = await prisma.charitySuggestion.findMany({
      where: { communityId: req.params.id },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(suggestions.map(serializeCharitySuggestion));
  } catch (error: any) {
    console.error('[API Error] 500:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch suggestions' });
  }
});

router.post('/:id/charity-suggestions', async (req, res) => {
  try {
    const {
      name,
      description,
      reason,
      website,
      suggestedDonationAmount,
    } = req.body ?? {};

    if (!name?.trim() || !description?.trim() || !reason?.trim()) {
      return res.status(400).json({ error: 'name, description, and reason are required' });
    }

    const normalizedAmount = Number(suggestedDonationAmount);
    if (!Number.isFinite(normalizedAmount) || normalizedAmount < 1 || normalizedAmount > 100) {
      return res.status(400).json({ error: 'suggestedDonationAmount must be between 1 and 100' });
    }

    const suggestion = await prisma.charitySuggestion.create({
      data: {
        communityId: req.params.id,
        suggestedBy: req.auth!.userId,
        name: name.trim(),
        description: description.trim(),
        reason: reason.trim(),
        website: website?.trim() || null,
        suggestedDonationAmount: normalizedAmount,
      },
      include: { user: { select: { name: true } } },
    });

    const suggesterName = suggestion.user?.name ?? 'A community member';
    await notifyCommunityMembers({
      communityId: req.params.id,
      actorUserId: req.auth!.userId,
      category: 'charitySuggestions',
      type: 'charity_suggestion',
      title: 'New charity suggestion',
      message: `${suggesterName} suggested ${suggestion.name} for community support.`,
      metadata: {
        communityId: req.params.id,
        suggestionId: suggestion.id,
        charitySuggestionName: suggestion.name,
        route: '/settings',
      },
      push: {
        title: 'New charity suggestion',
        body: `${suggesterName}: ${suggestion.name}`,
        data: {
          type: 'charity_suggestion',
          route: '/settings',
          communityId: req.params.id,
          suggestionId: suggestion.id,
        },
      },
    });

    return res.status(201).json(serializeCharitySuggestion(suggestion));
  } catch (error: any) {
    console.error('[API Error] 500:', error);
    return res.status(500).json({ error: error.message || 'Failed to create charity suggestion' });
  }
});

// Delete/Archive charity
router.delete('/:id/charities/:charityId', async (req, res) => {
  try {
    const charity = await prisma.charity.delete({ where: { id: req.params.charityId } });
    return res.json({ message: 'Charity deleted', charity });
  } catch (error: any) {
    console.error('[API Error] 500:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete charity' });
  }
});

// Approve charity suggestion
router.patch('/:id/charity-suggestions/:suggestionId/approve', async (req, res) => {
  try {
    const role = await getCommunityRole(req.params.id, req.auth!.userId);
    if (!isAdminRole(role)) {
      return res.status(403).json({ error: 'Only community admins can approve suggestions' });
    }

    const existingSuggestion = await prisma.charitySuggestion.findFirst({
      where: { id: req.params.suggestionId, communityId: req.params.id },
      include: { user: { select: { name: true } } },
    });
    if (!existingSuggestion) return res.status(404).json({ error: 'Suggestion not found' });

    let createdCharity: any = null;
    if (req.body?.charityData && !existingSuggestion.charityId) {
      createdCharity = await prisma.charity.create({
        data: {
          communityId: req.params.id,
          ...req.body.charityData,
          isApprovedSuggestion: true,
          suggestedById: existingSuggestion.suggestedBy,
        },
      });
    }

    const suggestion = await prisma.charitySuggestion.update({
      where: { id: req.params.suggestionId },
      data: {
        status: 'approved',
        adminFeedback: req.body.feedback,
        charityId: createdCharity?.id ?? existingSuggestion.charityId,
      },
      include: { user: { select: { name: true } } },
    });
    return res.json({ suggestion: serializeCharitySuggestion(suggestion), charity: createdCharity });
  } catch (error: any) {
    console.error('[API Error] 500:', error);
    return res.status(500).json({ error: error.message || 'Failed to approve suggestion' });
  }
});

// Reject charity suggestion
router.patch('/:id/charity-suggestions/:suggestionId/reject', async (req, res) => {
  try {
    const role = await getCommunityRole(req.params.id, req.auth!.userId);
    if (!isAdminRole(role)) {
      return res.status(403).json({ error: 'Only community admins can reject suggestions' });
    }

    const suggestion = await prisma.charitySuggestion.update({
      where: { id: req.params.suggestionId },
      data: { status: 'rejected', adminFeedback: req.body.feedback },
      include: { user: { select: { name: true } } },
    });
    return res.json(serializeCharitySuggestion(suggestion));
  } catch (error: any) {
    console.error('[API Error] 500:', error);
    return res.status(500).json({ error: error.message || 'Failed to reject suggestion' });
  }
});

router.get('/:id/cat-hub', async (req, res) => {
  try {
    const catTx = (prisma as any).catTransaction;
    if (!catTx) {
      return res.json({
        totalCATGenerated: 0,
        totalRaisedForCharity: 0,
        activeCycleCharity: null,
        catCycleActive: false,
        recentTransactions: [],
      });
    }

    const [community, txAggregate, charityAggregate, recentTransactions] = await Promise.all([
      prisma.community.findUnique({ where: { id: req.params.id } }),
      catTx.aggregate({ where: { communityId: req.params.id }, _sum: { catAmount: true } }),
      catTx.aggregate({ where: { communityId: req.params.id, charityId: { not: null } }, _sum: { catAmount: true } }),
      catTx.findMany({
        where: { communityId: req.params.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const featuredId = (community as any)?.catFeaturedCharityId as string | null | undefined;
    const activeCycleCharity = featuredId
      ? await prisma.charity.findUnique({ where: { id: featuredId } })
      : null;

    return res.json({
      totalCATGenerated: Number(txAggregate?._sum?.catAmount ?? 0),
      totalRaisedForCharity: Number(charityAggregate?._sum?.catAmount ?? 0),
      activeCycleCharity,
      catCycleActive: Boolean((community as any)?.catCycleActive),
      recentTransactions,
    });
  } catch (error: any) {
    console.error('[API Error] 500:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch CAT hub data' });
  }
});

export default router;
