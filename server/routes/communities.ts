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
import { getFoundationTheme } from '../lib/foundationThemes.js';
import {
  getFeaturedCharitySummary,
  getActiveCharityForCommunity,
  getCommunityCharityTotals,
} from '../services/featuredCharity.js';
import { cycleFeaturedCharity } from '../services/charityCycle.js';
import { io } from '../index.js';
// UserRole is a string enum in Prisma schema; reference it as a string literal type
type UserRole = 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER';

const router = Router();
const CAT_MIN_PERCENTAGE = 15;

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeQuantity(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.floor(parsed);
}

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off', ''].includes(normalized)) return false;
  }
  if (typeof value === 'number') return value !== 0;
  return Boolean(value);
}

async function getSoldQuantityForPost(tx: any, communityId: string, postId: string): Promise<number> {
  const catTx = tx?.catTransaction;
  if (!catTx?.aggregate) return 0;

  const aggregate = await catTx.aggregate({
    where: {
      communityId,
      postId,
      reversedAt: null,
    },
    _sum: { quantitySold: true },
  });

  const sold = Number(aggregate?._sum?.quantitySold ?? 0);
  return Number.isFinite(sold) ? sold : 0;
}

function getStockState(initialQuantity: number, remainingQuantity: number): 'active' | 'low_stock' | 'nearly_sold_out' | 'sold_out' {
  if (remainingQuantity <= 0) return 'sold_out';
  if (initialQuantity <= 0) return 'active';

  const ratio = remainingQuantity / initialQuantity;
  if (ratio <= 0.1) return 'nearly_sold_out';
  if (ratio <= 0.25) return 'low_stock';
  return 'active';
}

function withInventory(post: any, soldQuantity: number) {
  const initialQuantity = Math.max(1, Number(post?.initialQuantity ?? 1));
  const normalizedSold = Math.max(0, Number.isFinite(soldQuantity) ? soldQuantity : 0);
  const remainingQuantity = Math.max(0, initialQuantity - normalizedSold);
  const percentageSold = initialQuantity > 0
    ? Math.min(100, Math.round((normalizedSold / initialQuantity) * 100))
    : 0;

  return {
    ...post,
    initialQuantity,
    soldQuantity: normalizedSold,
    remainingQuantity,
    percentageSold,
    stockState: getStockState(initialQuantity, remainingQuantity),
  };
}

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

async function broadcastFeaturedCharityUpdate(communityId: string) {
  const featuredCharity = await getFeaturedCharitySummary(communityId);
  io.to(`community:${communityId}`).emit('charity:updated', {
    communityId,
    featuredCharity,
  });
}

function broadcastPostEvent(event: 'post:new' | 'post:updated' | 'post:deleted', communityId: string, post: unknown) {
  io.to(`community:${communityId}`).emit(event, { communityId, post });
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
    // A user may only own one *active* (unexpired) TRIAL community at a time.
    // Expired trials (trialExpiresAt < now AND not paid) no longer block new creation —
    // those communities are effectively dormant and the owner can start a fresh trial.
    const existingTrial = await prisma.community.findFirst({
      where: {
        ownerId: req.auth!.userId,
        type: 'TRIAL',
        isPaid: false,
        trialExpiresAt: { gt: new Date() },
      },
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
        // CAT is the always-on default active charity; start its cycle clock
        // immediately so per-cycle aggregations have a well-defined window.
        currentCampaignStartedAt: new Date(),
      } as any,
    });

    const lalelaLightTheme = getFoundationTheme('lalela-light');
    const defaultCommunityTheme = {
      community: { connect: { id: community.id } },
      presetId: lalelaLightTheme.presetId,
      mode: lalelaLightTheme.mode,
      name: lalelaLightTheme.name,
      primaryColor: lalelaLightTheme.primaryColor,
      secondaryColor: lalelaLightTheme.secondaryColor,
      backgroundColor: lalelaLightTheme.backgroundColor,
      surfaceColor: lalelaLightTheme.surfaceColor,
      cardSurfaceColor: lalelaLightTheme.cardSurfaceColor,
      cardSurfaceMutedColor: lalelaLightTheme.cardSurfaceMutedColor,
      cardBorderColor: lalelaLightTheme.cardBorderColor,
      textPrimary: lalelaLightTheme.textPrimary,
      textSecondary: lalelaLightTheme.textSecondary,
      borderRadius: lalelaLightTheme.borderRadius,
      fontFamily: lalelaLightTheme.fontFamily,
      iconUrl: lalelaLightTheme.iconUrl,
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

// ─── Remove / delete community ──────────────────────────────────────────────

router.post('/:id/leave', async (req, res) => {
  const communityId = req.params.id;
  const userId = req.auth!.userId;

  const membership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId } },
    select: { role: true },
  });
  if (!membership) {
    return res.status(404).json({ error: 'Membership not found' });
  }
  if (membership.role === 'OWNER') {
    return res.status(400).json({ error: 'OWNERS_MUST_DELETE_COMMUNITY' });
  }

  await prisma.communityMember.delete({
    where: { communityId_userId: { communityId, userId } },
  });

  const nextMembership = await prisma.communityMember.findFirst({
    where: { userId, status: 'ACTIVE' },
    select: { communityId: true },
    orderBy: { joinedAt: 'asc' },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { lastCommunityId: nextMembership?.communityId ?? null },
  });

  return res.json({ message: 'Left community', communityId });
});

router.delete('/:id', async (req, res) => {
  const communityId = req.params.id;
  const userId = req.auth!.userId;

  const community = await prisma.community.findUnique({
    where: { id: communityId },
    select: { id: true, ownerId: true },
  });
  if (!community) {
    return res.status(404).json({ error: 'Community not found' });
  }
  if (community.ownerId !== userId) {
    return res.status(403).json({ error: 'Only the owner can delete this community' });
  }

  await prisma.community.delete({ where: { id: communityId } });

  const nextMembership = await prisma.communityMember.findFirst({
    where: { userId, status: 'ACTIVE' },
    select: { communityId: true },
    orderBy: { joinedAt: 'asc' },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { lastCommunityId: nextMembership?.communityId ?? null },
  });

  return res.json({ message: 'Community deleted', communityId });
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
    image: user?.profileImage ?? m.image ?? null,
    email: m.email || user?.email || null,
    latitude: user?.latitude ?? null,
    longitude: user?.longitude ?? null,
    isSecurityMember: m.isSecurityMember ?? false,
    emergencyLocationOptIn: m.emergencyLocationOptIn ?? false,
    locationSharingEnabled: user?.locationSharing ?? false,
  })));
});

router.put('/:id/members/:userId', async (req, res) => {
  const { role, status, isSecurityMember, emergencyLocationOptIn } = req.body as {
    role?: string;
    status?: string;
    isSecurityMember?: boolean;
    emergencyLocationOptIn?: boolean;
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
    ...(typeof emergencyLocationOptIn === 'boolean' ? { emergencyLocationOptIn } : {}),
  };
  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'No valid fields provided' });
  }

  const isResponderOnlyUpdate = !role
    && !status
    && (typeof isSecurityMember === 'boolean' || typeof emergencyLocationOptIn === 'boolean');

  try {
    if (isSelfUpdate && isResponderOnlyUpdate) {
      const user = await prisma.user.findUnique({
        where: { id: req.params.userId },
        select: { name: true, profileImage: true, email: true },
      });

      const member = await prisma.communityMember.upsert({
        where: { communityId_userId: { communityId: req.params.id, userId: req.params.userId } },
        update: data,
        create: {
          communityId: req.params.id,
          userId: req.params.userId,
          isSecurityMember: typeof isSecurityMember === 'boolean' ? isSecurityMember : false,
          emergencyLocationOptIn: typeof emergencyLocationOptIn === 'boolean' ? emergencyLocationOptIn : false,
          name: user?.name ?? null,
          image: user?.profileImage ?? null,
          email: user?.email ?? null,
        },
      });
      return res.json(member);
    }

    const member = await prisma.communityMember.update({
      where: { communityId_userId: { communityId: req.params.id, userId: req.params.userId } },
      data,
    });
    return res.json(member);
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ error: 'Member not found in this community' });
    }
    return res.status(500).json({ error: error?.message || 'Failed to update member' });
  }
});

router.put('/:id/me/responder', async (req, res) => {
  const { isSecurityMember, emergencyLocationOptIn } = req.body as {
    isSecurityMember?: boolean;
    emergencyLocationOptIn?: boolean;
  };

  const data: Record<string, unknown> = {
    ...(typeof isSecurityMember === 'boolean' ? { isSecurityMember } : {}),
    ...(typeof emergencyLocationOptIn === 'boolean' ? { emergencyLocationOptIn } : {}),
  };

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'No valid responder fields provided' });
  }

  const userId = req.auth!.userId;
  const communityId = req.params.id;

  const existing = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId } },
    select: { communityId: true },
  });

  if (!existing) {
    return res.status(403).json({ error: 'You are not a member of this community' });
  }

  try {
    const member = await prisma.communityMember.update({
      where: { communityId_userId: { communityId, userId } },
      data,
    });
    return res.json(member);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Failed to update responder settings' });
  }
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
    select: {
      name: true,
      profileImage: true,
      email: true,
      licenseStatus: true,
      trialExpiresAt: true,
      subscriptionActive: true,
      subscriptionRenewalDate: true,
    },
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

  // Grant a 1-year trial whenever the joiner does not currently have an
  // active paid membership and no valid trial window.
  const now = new Date();
  const hasActivePaidMembership =
    joiner?.licenseStatus === 'ACTIVE' &&
    joiner.subscriptionActive === true &&
    !!joiner.subscriptionRenewalDate &&
    new Date(joiner.subscriptionRenewalDate) > now;
  const hasValidTrial =
    joiner?.licenseStatus === 'TRIAL' &&
    !!joiner.trialExpiresAt &&
    new Date(joiner.trialExpiresAt) > now;

  if (!hasActivePaidMembership && !hasValidTrial) {
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

  const soldByPostId = new Map<string, number>();
  const listingIds = posts.filter((post) => post.type === 'listing').map((post) => post.id);
  if (listingIds.length > 0) {
    const catTx = (prisma as any).catTransaction;
    if (catTx?.groupBy) {
      const grouped = await catTx.groupBy({
        by: ['postId'],
        where: {
          communityId: req.params.id,
          postId: { in: listingIds },
          reversedAt: null,
        },
        _sum: { quantitySold: true },
      });
      for (const row of grouped) {
        soldByPostId.set(row.postId, Number(row?._sum?.quantitySold ?? 0));
      }
    } else {
      await Promise.all(
        listingIds.map(async (postId) => {
          const sold = await getSoldQuantityForPost(prisma as any, req.params.id, postId);
          soldByPostId.set(postId, sold);
        })
      );
    }
  }

  // Flatten author fields — cached columns take priority, fall back to live user data
  return res.json(
    posts.map(({ author, ...p }) => {
      const withInventoryFields = p.type === 'listing'
        ? withInventory(p, soldByPostId.get(p.id) ?? 0)
        : p;

      return {
        ...withInventoryFields,
        postsImage: p.type === 'listing' ? (p.postsImage ?? p.imageUrl ?? null) : p.postsImage,
        timestamp: p.createdAt,
        authorName: p.authorName || author?.name || null,
        authorImage: p.authorImage || author?.profileImage || null,
        authorRole: p.authorRole || null,
      };
    })
  );
});

router.post('/:id/posts', async (req, res) => {
  const { type, category, subtype, postSubtype, title, description, image_url, imageUrl, postsImage, urgency, urgencyLevel,
    latitude, longitude, price, communityPrice, initialQuantity, quantityType,
    is_charity, isOpenExchange, is_open_exchange, expires_at, locationName, source,
    authorName: bodyAuthorName, authorRole: bodyAuthorRole, authorImage: bodyAuthorImage } = req.body;
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

  // Every listing automatically carries the community's active charity (CAT
  // by default, the featured charity while a CAT cycle is on). The active
  // charity's `percentage` is the CAT margin (floored at CAT_MIN_PERCENTAGE).
  // The public price and charity amount are derived from the community price
  // and applied server-side — the client never picks the charity nor sets the
  // public price directly.
  let resolvedCharityId: string | null = null;
  let resolvedCharityPercentage: number | null = null;
  let resolvedPublicPrice: number | null = null;
  let resolvedCharityAmount: number | null = null;
  const resolvedCommunityPrice = communityPrice ?? price ?? null;
  const resolvedInitialQuantity = type === 'listing'
    ? Math.max(1, Math.floor(Number(initialQuantity ?? 1) || 1))
    : 1;
  const resolvedQuantityType = type === 'listing'
    ? (typeof quantityType === 'string' && quantityType.trim().length > 0 ? quantityType.trim() : 'items')
    : null;
  const resolvedOpenExchange = type === 'listing'
    ? normalizeBoolean(isOpenExchange ?? is_open_exchange)
    : false;

  if (type === 'listing') {
    const nextListingPrice = Number(resolvedCommunityPrice ?? price ?? 0);
    if (!Number.isFinite(nextListingPrice) || nextListingPrice <= 0) {
      return res.status(400).json({ error: 'Listings must include a value above R0.00' });
    }

    const activeCharity = await getActiveCharityForCommunity(prisma, req.params.id);

    if (activeCharity?.id) {
      const charityRow = await prisma.charity.findUnique({
        where: { id: activeCharity.id },
        select: { percentage: true },
      });
      const rawPercentage = Number(charityRow?.percentage ?? 0);
      resolvedCharityPercentage = Math.max(
        Number.isFinite(rawPercentage) ? rawPercentage : 0,
        CAT_MIN_PERCENTAGE,
      );
      resolvedCharityId = activeCharity.id;
    } else {
      // Defensive: no active charity resolvable. Fall back to CAT minimum so
      // the listing still carries the standard CAT margin.
      resolvedCharityPercentage = CAT_MIN_PERCENTAGE;
      resolvedCharityId = null;
    }

    const localPrice = Number(resolvedCommunityPrice ?? 0);
    if (Number.isFinite(localPrice) && localPrice > 0) {
      resolvedCharityAmount = Math.round(((localPrice * resolvedCharityPercentage) / 100) * 100) / 100;
      resolvedPublicPrice = Math.round((localPrice + resolvedCharityAmount) * 100) / 100;
    } else {
      resolvedCharityAmount = 0;
      resolvedPublicPrice = 0;
    }
  }

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
      postsImage: type === 'listing' ? (postsImage ?? imageUrl ?? image_url ?? null) : (postsImage ?? null),
      urgency: urgency ?? 'LOW',
      urgencyLevel: urgencyLevel ?? null,
      latitude,
      longitude,
      locationName: locationName ?? null,
      price,
      communityPrice: resolvedCommunityPrice,
      publicPrice: resolvedPublicPrice,
      initialQuantity: resolvedInitialQuantity,
      quantityType: resolvedQuantityType,
      isOpenExchange: resolvedOpenExchange,
      isCharity: is_charity ?? false,
      charityId: resolvedCharityId,
      charityPercentage: resolvedCharityPercentage,
      charityAmount: resolvedCharityAmount,
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

  broadcastPostEvent('post:new', req.params.id, {
    ...post,
    postsImage: post.type === 'listing' ? (post.postsImage ?? post.imageUrl ?? null) : post.postsImage,
    timestamp: post.createdAt,
    authorName: post.authorName,
    authorImage: post.authorImage,
    authorRole: post.authorRole,
  });
  await broadcastFeaturedCharityUpdate(req.params.id);

  return res.status(201).json({
    ...post,
    postsImage: post.type === 'listing' ? (post.postsImage ?? post.imageUrl ?? null) : post.postsImage,
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
    'price', 'communityPrice', 'initialQuantity', 'quantityType', 'isOpenExchange',
    'category', 'subtype', 'locationName', 'latitude', 'longitude', 'source', 'expiresAt',
  ];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in req.body) data[key] = key === 'expiresAt' && req.body[key] ? new Date(req.body[key]) : req.body[key];
  }
  // Accept legacy camelCase alias from the mobile client.
  if (!('subtype' in data) && 'postSubtype' in req.body) {
    data.subtype = req.body.postSubtype;
  }
  if (!('isOpenExchange' in data) && 'is_open_exchange' in req.body) {
    data.isOpenExchange = req.body.is_open_exchange;
  }

  if ('initialQuantity' in data) {
    data.initialQuantity = Math.max(1, Math.floor(Number(data.initialQuantity) || 1));
  }
  if ('quantityType' in data && typeof data.quantityType === 'string') {
    data.quantityType = data.quantityType.trim() || 'items';
  }
  if ('isOpenExchange' in data) {
    data.isOpenExchange = normalizeBoolean(data.isOpenExchange);
  }
  if ('price' in data && !('communityPrice' in data)) {
    data.communityPrice = data.price;
  }
  if ('communityPrice' in data && !('price' in data)) {
    data.price = data.communityPrice;
  }
  if (existingPost.type === 'listing' && !('postsImage' in data) && 'imageUrl' in data) {
    data.postsImage = data.imageUrl;
  }

  if (existingPost.type === 'listing' && 'initialQuantity' in data) {
    // Only block if the incoming value actually differs from the stored quantity.
    // Key-presence alone (e.g. description-only edit) must not trigger this guard.
    const incomingQty = Number(data.initialQuantity); // already normalized above
    const storedQty = Math.max(1, Math.floor(Number(existingPost.initialQuantity) || 1));
    const quantityChanged = incomingQty !== storedQty;
    if (quantityChanged) {
      const catTx = (prisma as any).catTransaction;
      const soldAggregate = catTx?.aggregate
        ? await catTx.aggregate({
            where: {
              communityId: req.params.id,
              postId: req.params.postId,
              reversedAt: null,
            },
            _sum: { quantitySold: true },
          })
        : null;
      const soldQuantity = Number(soldAggregate?._sum?.quantitySold ?? 0);
      if (Number.isFinite(soldQuantity) && soldQuantity > 0) {
        return res.status(409).json({ error: 'Quantity cannot be changed after sales have been recorded' });
      }
    }
  }

  // For listings, re-derive charity link + public price whenever the
  // community price is being updated. The client never sets these directly.
  if (existingPost.type === 'listing') {
    const nextListingPrice = 'communityPrice' in data
      ? Number(data.communityPrice ?? 0)
      : 'price' in data
      ? Number(data.price ?? 0)
      : Number(existingPost.communityPrice ?? existingPost.price ?? 0);

    if (!Number.isFinite(nextListingPrice) || nextListingPrice <= 0) {
      return res.status(400).json({ error: 'Listings must include a value above R0.00' });
    }

    const active = await getActiveCharityForCommunity(prisma, req.params.id);
    const charityRow = active?.id
      ? await prisma.charity.findUnique({ where: { id: active.id }, select: { percentage: true } })
      : null;
    const rawPercentage = Number(charityRow?.percentage ?? 0);
    const nextPercentage = Math.max(
      Number.isFinite(rawPercentage) ? rawPercentage : 0,
      CAT_MIN_PERCENTAGE,
    );
    const nextCommunityPrice = 'communityPrice' in data
      ? Number(data.communityPrice ?? 0)
      : nextListingPrice;
    const nextCharityAmount = nextCommunityPrice > 0
      ? Math.round(((nextCommunityPrice * nextPercentage) / 100) * 100) / 100
      : 0;
    const nextPublicPrice = nextCommunityPrice > 0
      ? Math.round((nextCommunityPrice + nextCharityAmount) * 100) / 100
      : 0;

    data.charityId = active?.id ?? null;
    data.charityPercentage = nextPercentage;
    data.charityAmount = nextCharityAmount;
    data.publicPrice = nextPublicPrice;
  }

  const post = await prisma.post.update({
    where: { id: req.params.postId },
    data,
    include: { author: { select: { name: true, profileImage: true } } },
  });
  const { author, ...rest } = post;
  broadcastPostEvent('post:updated', req.params.id, {
    ...rest,
    postsImage: post.type === 'listing' ? (post.postsImage ?? post.imageUrl ?? null) : post.postsImage,
    timestamp: post.createdAt,
    authorName: post.authorName || author?.name || null,
    authorImage: post.authorImage || author?.profileImage || null,
    authorRole: post.authorRole || null,
  });
  await broadcastFeaturedCharityUpdate(req.params.id);
  return res.json({
    ...rest,
    postsImage: post.type === 'listing' ? (post.postsImage ?? post.imageUrl ?? null) : post.postsImage,
    timestamp: post.createdAt,
    authorName: post.authorName || author?.name || null,
    authorImage: post.authorImage || author?.profileImage || null,
    authorRole: post.authorRole || null,
  });
});

router.post('/:id/posts/:postId/sold', async (req, res) => {
  const requestedQuantity = normalizeQuantity(req.body?.quantity ?? 1);
  if (!Number.isInteger(requestedQuantity) || requestedQuantity < 1) {
    return res.status(400).json({ error: 'quantity must be a positive integer' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const post = await tx.post.findFirst({
        where: { id: req.params.postId, communityId: req.params.id },
      });
      if (!post) {
        throw { status: 404, error: 'Post not found' };
      }
      if (post.authorId !== req.auth!.userId) {
        throw { status: 403, error: 'Only the listing owner can mark a post as sold' };
      }
      if (String(post.status).toUpperCase() === 'SOLD') {
        throw { status: 409, error: 'Post already marked as sold' };
      }

      const initialQuantity = Math.max(1, Number((post as any).initialQuantity ?? 1));
      const soldQuantity = await getSoldQuantityForPost(tx, req.params.id, post.id);
      const remainingQuantity = Math.max(0, initialQuantity - soldQuantity);
      if (requestedQuantity > remainingQuantity) {
        throw {
          status: 409,
          error: `Only ${remainingQuantity} item(s) remaining`,
          remainingQuantity,
        };
      }

      const unitPriceAtSale = Number(post.communityPrice ?? post.price ?? 0);
      const catPercentage = Number(post.charityPercentage ?? CAT_MIN_PERCENTAGE);
      const computedUnitCat = roundCurrency((unitPriceAtSale * catPercentage) / 100);
      const unitCatAmount = Number(post.charityAmount ?? computedUnitCat);
      const totalSaleValue = roundCurrency(unitPriceAtSale * requestedQuantity);
      const catAmount = roundCurrency(unitCatAmount * requestedQuantity);

      // CAT attribution rule:
      // - Cycle OFF  => CAT baseline charity is always the beneficiary.
      // - Cycle ON   => currently selected featured charity is the beneficiary.
      const [community, catBaseline] = await Promise.all([
        tx.community.findUnique({ where: { id: req.params.id } }),
        tx.charity.findFirst({
          where: {
            communityId: req.params.id,
            isCATCharity: true,
            NOT: { status: { in: ['Archived', 'ARCHIVED'] } },
          },
          select: { id: true },
          orderBy: { createdAt: 'asc' },
        }),
      ]);

      let targetCharityId: string | null = null;
      if ((community as any)?.catCycleActive) {
        targetCharityId = (community as any)?.catFeaturedCharityId ?? null;
        if (!targetCharityId) {
          const featuredCharity = await tx.charity.findFirst({
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
      } else {
        targetCharityId = catBaseline?.id ?? null;
      }

      const catTx = (tx as any).catTransaction;
      const transaction = catTx
        ? await catTx.create({
            data: {
              communityId: req.params.id,
              postId: post.id,
              sellerId: req.auth!.userId,
              quantitySold: requestedQuantity,
              unitPriceAtSale,
              totalSaleValue,
              catAmount,
              catPercentage,
              charityId: targetCharityId,
            },
          })
        : null;

      if (targetCharityId && catAmount > 0) {
        await tx.charity.update({
          where: { id: targetCharityId },
          data: { raisedAmount: { increment: catAmount } },
        });
      }

      const nextSoldQuantity = soldQuantity + requestedQuantity;
      const nextRemainingQuantity = Math.max(0, initialQuantity - nextSoldQuantity);
      const shouldCloseListing = nextRemainingQuantity === 0;
      const postUpdate = shouldCloseListing
        ? await tx.post.update({
            where: { id: post.id },
            data: { status: 'SOLD', soldAt: new Date() } as any,
          })
        : post;

      const postWithInventory = withInventory(postUpdate, nextSoldQuantity);
      return {
        post: { ...postWithInventory, timestamp: postUpdate.createdAt },
        catTriggered: true,
        catAmount,
        pooledToCharity: Boolean(targetCharityId),
        transaction,
      };
    });

    broadcastPostEvent('post:updated', req.params.id, result.post);
    await broadcastFeaturedCharityUpdate(req.params.id);
    return res.json(result);
  } catch (error: any) {
    if (typeof error?.status === 'number') {
      return res.status(error.status).json({
        error: error.error ?? 'Unable to record sale',
        remainingQuantity: error.remainingQuantity,
      });
    }
    throw error;
  }
});

router.get('/:id/posts/:postId/sales', async (req, res) => {
  const post = await prisma.post.findFirst({
    where: { id: req.params.postId, communityId: req.params.id },
    select: { id: true, authorId: true },
  });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.authorId !== req.auth!.userId) {
    return res.status(403).json({ error: 'Only the listing owner can view sales history' });
  }

  const catTx = (prisma as any).catTransaction;
  if (!catTx?.findMany) {
    return res.json({ sales: [] });
  }

  const sales = await catTx.findMany({
    where: {
      communityId: req.params.id,
      postId: req.params.postId,
      reversedAt: null,
    },
    select: {
      id: true,
      quantitySold: true,
      unitPriceAtSale: true,
      totalSaleValue: true,
      catAmount: true,
      catPercentage: true,
      charityId: true,
      createdAt: true,
      charity: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return res.json({
    sales: sales.map((sale: any) => ({
      id: sale.id,
      quantitySold: Number(sale.quantitySold ?? 1),
      unitPriceAtSale: Number(sale.unitPriceAtSale ?? 0),
      totalSaleValue: Number(sale.totalSaleValue ?? 0),
      catAmount: Number(sale.catAmount ?? 0),
      catPercentage: Number(sale.catPercentage ?? CAT_MIN_PERCENTAGE),
      charityId: sale.charityId ?? null,
      charityName: sale.charity?.name ?? null,
      createdAt: sale.createdAt,
    })),
  });
});

router.delete('/:id/posts/:postId', async (req, res) => {
  const { id: communityId, postId } = req.params;
  if (!postId || postId === 'undefined' || postId === 'null') {
    return res.status(400).json({ error: 'Valid postId is required' });
  }

  try {
    const existing = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, communityId: true, status: true },
    });

    if (!existing) {
      console.warn('[communities/delete-post] post not found', { postId, communityId });
      return res.status(404).json({ error: 'Post not found' });
    }

    if (existing.communityId !== communityId) {
      console.warn('[communities/delete-post] community mismatch', {
        postId,
        requestedCommunity: communityId,
        actualCommunity: existing.communityId,
      });
      return res.status(404).json({ error: 'Post not found in this community' });
    }

    // Idempotent: if already deleted, just confirm without mutating.
    if (String(existing.status || '').toUpperCase() === 'DELETED') {
      broadcastPostEvent('post:deleted', communityId, { id: postId, communityId });
      return res.json({ message: 'Post already deleted', alreadyDeleted: true });
    }

    await prisma.post.update({
      where: { id: postId },
      data: { status: 'Deleted' },
    });

    broadcastPostEvent('post:deleted', communityId, { id: postId, communityId });
    await broadcastFeaturedCharityUpdate(communityId);
    return res.json({ message: 'Post deleted' });
  } catch (error: any) {
    console.error('[communities/delete-post] error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to delete post' });
  }
});

// ─── Member locations ─────────────────────────────────────────────────────────

router.put('/:id/location', async (req, res) => {
  const { latitude, longitude, isSecurity } = req.body as { latitude?: number | string; longitude?: number | string; isSecurity?: boolean | string };
  const parsedLatitude = Number(latitude);
  const parsedLongitude = Number(longitude);
  if (!Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude)) {
    return res.status(400).json({ error: 'latitude and longitude are required' });
  }
  const isSecurityMode = isSecurity === true || isSecurity === 'true';

  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { name: true, profileImage: true } });

  const member = await prisma.communityMember.findFirst({ where: { communityId: req.params.id, userId: req.auth!.userId } });

  if (isSecurityMode) {
    await prisma.securityLocation.upsert({
      where: { communityId_userId: { communityId: req.params.id, userId: req.auth!.userId } },
      create: { communityId: req.params.id, userId: req.auth!.userId, latitude: parsedLatitude, longitude: parsedLongitude, name: user?.name, image: user?.profileImage },
      update: { latitude: parsedLatitude, longitude: parsedLongitude, name: user?.name, image: user?.profileImage, timestamp: new Date() },
    });
  } else {
    await prisma.memberLocation.upsert({
      where: { communityId_userId: { communityId: req.params.id, userId: req.auth!.userId } },
      create: { communityId: req.params.id, userId: req.auth!.userId, latitude: parsedLatitude, longitude: parsedLongitude, name: user?.name, image: user?.profileImage, role: member?.role ?? 'Member' },
      update: { latitude: parsedLatitude, longitude: parsedLongitude, name: user?.name, image: user?.profileImage, timestamp: new Date() },
    });
  }

  return res.json({ message: 'Location updated' });
});

router.delete('/:id/location', async (req, res) => {
  const bodyFlag = (req.body as { isSecurity?: boolean | string } | undefined)?.isSecurity;
  const queryFlag = (req.query as { isSecurity?: string | string[] }).isSecurity;
  const isSecurity = bodyFlag === true
    || bodyFlag === 'true'
    || queryFlag === 'true'
    || (Array.isArray(queryFlag) && queryFlag.includes('true'));

  if (isSecurity) {
    await prisma.securityLocation.deleteMany({
      where: { communityId: req.params.id, userId: req.auth!.userId },
    });
  } else {
    await prisma.memberLocation.deleteMany({
      where: { communityId: req.params.id, userId: req.auth!.userId },
    });
  }

  return res.json({ message: 'Location cleared' });
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

router.get('/:id/charities/totals', async (req, res) => {
  try {
    const totals = await getCommunityCharityTotals(req.params.id);
    return res.json(totals);
  } catch (error: any) {
    console.error('[API Error] 500:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch charity totals' });
  }
});

router.get('/:id/charity-campaigns/history', async (req, res) => {
  try {
    const snapshots = await prisma.charityCampaignSnapshot.findMany({
      where: { communityId: req.params.id },
      include: {
        charity: {
          select: {
            id: true,
            name: true,
            isCATCharity: true,
            logo: true,
          },
        },
      },
      orderBy: { endedAt: 'desc' },
      take: 50,
    });

    const history = snapshots.map((snapshot) => {
      const goalAmount = Number(snapshot.goalAmount ?? 0);
      const finalRaised = Number(snapshot.finalRaised ?? 0);
      const finalPercentage = goalAmount > 0
        ? Math.min(100, Math.round((finalRaised / goalAmount) * 100))
        : null;

      return {
        id: snapshot.id,
        communityId: snapshot.communityId,
        charityId: snapshot.charityId,
        charityName: snapshot.charity?.name ?? 'Unknown Charity',
        isCATCharity: Boolean(snapshot.charity?.isCATCharity),
        logo: snapshot.charity?.logo ?? null,
        startedAt: snapshot.startedAt,
        endedAt: snapshot.endedAt,
        goalAmount,
        finalRaised,
        finalPotential: Number(snapshot.finalPotential ?? 0),
        itemsSold: Number(snapshot.itemsSold ?? 0),
        reason: snapshot.reason,
        finalPercentage,
      };
    });

    return res.json(history);
  } catch (error: any) {
    console.error('[API Error] 500:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch charity campaign history' });
  }
});

router.post('/:id/charities', async (req, res) => {
  try {
    const wantsFeatured = req.body?.isFeatured === true;
    const community = await prisma.community.findUnique({ where: { id: req.params.id } });
    if (!community) return res.status(404).json({ error: 'Community not found' });

    // Never allow a new charity to claim the CAT baseline role via this route.
    const payload: any = { ...req.body, isCATCharity: false };
    if (!payload.isCATCharity) {
      const fundraisingGoal = Number(payload.fundraisingGoal);
      if (!Number.isFinite(fundraisingGoal) || fundraisingGoal <= 0) {
        return res.status(400).json({ error: 'fundraisingGoal_required' });
      }
      payload.fundraisingGoal = fundraisingGoal;
    }

    let charity: any;
    if (wantsFeatured) {
      await prisma.$transaction(async (tx) => {
        // Single-featured enforcement: clear isFeatured on other non-CAT charities.
        await tx.charity.updateMany({
          where: { communityId: req.params.id, isCATCharity: false },
          data: { isFeatured: false },
        });
        charity = await tx.charity.create({
          data: { communityId: req.params.id, ...payload },
        });
        if ((community as any)?.catCycleActive) {
          const cycleResult = await cycleFeaturedCharity(req.params.id, {
            toCharityId: charity.id,
            reason: 'charity_replaced',
          }, tx);
          if (cycleResult.closedSnapshot) {
            io.to(`community:${req.params.id}`).emit('campaign:closed', {
              communityId: req.params.id,
              snapshot: cycleResult.closedSnapshot,
            });
          }
        }
      });
    } else {
      charity = await prisma.charity.create({
        data: { communityId: req.params.id, ...payload },
      });
    }

    const [charities, refreshedCommunity] = await Promise.all([
      prisma.charity.findMany({ where: { communityId: req.params.id } }),
      prisma.community.findUnique({ where: { id: req.params.id } }),
    ]);

    await broadcastFeaturedCharityUpdate(req.params.id);

    return res.status(201).json({ charity, charities, community: refreshedCommunity });
  } catch (error: any) {
    console.error('[API Error] 500:', error);
    return res.status(500).json({ error: error.message || 'Failed to create charity' });
  }
});

router.put('/:id/charities/:charityId', async (req, res) => {
  try {
    const [existingCharity, community] = await Promise.all([
      prisma.charity.findUnique({
        where: { id: req.params.charityId },
        select: {
          id: true,
          name: true,
          isCATCharity: true,
          communityId: true,
          fundraisingGoal: true,
        },
      }),
      prisma.community.findUnique({ where: { id: req.params.id } }),
    ]);
    if (!existingCharity) return res.status(404).json({ error: 'Charity not found' });
    if (!community) return res.status(404).json({ error: 'Community not found' });
    if (existingCharity.communityId !== req.params.id) {
      return res.status(400).json({ error: 'Charity does not belong to this community' });
    }
    if (existingCharity.isCATCharity && typeof req.body?.name === 'string' && req.body.name.trim() !== existingCharity.name) {
      return res.status(400).json({ error: 'The CAT charity name is fixed and cannot be renamed' });
    }
    if (!existingCharity.isCATCharity) {
      const mergedFundraisingGoal =
        req.body?.fundraisingGoal === undefined
          ? Number(existingCharity.fundraisingGoal)
          : Number(req.body.fundraisingGoal);
      if (!Number.isFinite(mergedFundraisingGoal) || mergedFundraisingGoal <= 0) {
        return res.status(400).json({ error: 'fundraisingGoal_required' });
      }
      req.body.fundraisingGoal = mergedFundraisingGoal;
    }

    const wantsFeatured = req.body?.isFeatured === true;
    let charity: any;
    if (wantsFeatured) {
      // CAT baseline cannot be marked as the admin "featured" candidate; it is
      // the automatic fallback whenever the CAT cycle is switched off.
      if (existingCharity.isCATCharity) {
        return res.status(400).json({ error: 'CAT baseline charity cannot be marked as the featured candidate' });
      }
      await prisma.$transaction(async (tx) => {
        // Only one non-CAT charity can be the featured candidate at a time.
        // Leave the CAT charity's isFeatured flag untouched.
        await tx.charity.updateMany({
          where: {
            communityId: req.params.id,
            id: { not: req.params.charityId },
            isCATCharity: false,
          },
          data: { isFeatured: false },
        });

        charity = await tx.charity.update({ where: { id: req.params.charityId }, data: req.body });

        if ((community as any)?.catCycleActive) {
          const cycleResult = await cycleFeaturedCharity(req.params.id, {
            toCharityId: req.params.charityId,
            reason: 'cycle_to_other_featured',
          }, tx);
          if (cycleResult.closedSnapshot) {
            io.to(`community:${req.params.id}`).emit('campaign:closed', {
              communityId: req.params.id,
              snapshot: cycleResult.closedSnapshot,
            });
          }
        }
      });
    } else {
      charity = await prisma.charity.update({ where: { id: req.params.charityId }, data: req.body });
    }

    const [charities, refreshedCommunity] = await Promise.all([
      prisma.charity.findMany({ where: { communityId: req.params.id } }),
      prisma.community.findUnique({ where: { id: req.params.id } }),
    ]);

    await broadcastFeaturedCharityUpdate(req.params.id);

    return res.json({ charity, charities, community: refreshedCommunity });
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

    let catBaseline = await prisma.charity.findFirst({
      where: {
        communityId: req.params.id,
        isCATCharity: true,
        NOT: { status: { in: ['Archived', 'ARCHIVED'] } },
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!catBaseline) {
      // Auto-seed CAT baseline for older communities that predate the CAT seed logic.
      const seeded = await prisma.charity.create({
        data: {
          communityId: req.params.id,
          name: 'CAT',
          description: 'Community Action Token baseline charity',
          percentage: 0,
          status: 'ACTIVE',
          isCATCharity: true,
          isFeatured: false,
          currentCampaignStartedAt: new Date(),
        },
        select: { id: true },
      });
      catBaseline = seeded;
    }

    const resolvedFeaturedId = active ? featuredCharityId : catBaseline.id;
    if (active && !resolvedFeaturedId) {
      return res.status(400).json({ error: 'featuredCharityId is required when activating CAT cycle' });
    }

    if (active) {
      const featured = await prisma.charity.findFirst({
        where: {
          id: resolvedFeaturedId,
          communityId: req.params.id,
          NOT: { status: { in: ['Archived', 'ARCHIVED'] } },
        },
      });
      if (!featured) {
        return res.status(400).json({ error: 'featuredCharityId must reference an active community charity' });
      }
    }

    const cycleResult = await prisma.$transaction(async (tx) => cycleFeaturedCharity(
      req.params.id,
      {
        toCatBaseline: !active,
        toCharityId: active ? resolvedFeaturedId : undefined,
        reason: active ? 'cycle_to_other_featured' : 'cycle_to_cat',
      },
      tx,
    ));
    const community = cycleResult.community;

    const charities = await prisma.charity.findMany({ where: { communityId: req.params.id } });

    if (cycleResult.closedSnapshot) {
      io.to(`community:${req.params.id}`).emit('campaign:closed', {
        communityId: req.params.id,
        snapshot: cycleResult.closedSnapshot,
      });
    }

    await notifyCommunityMembers({
      communityId: req.params.id,
      actorUserId: req.auth!.userId,
      category: 'communityActivity',
      type: 'system',
      title: active ? 'Charity cycle activated' : 'Charity cycle paused',
      message: active
        ? 'CAT contributions from public sold listings are now pooled to the featured charity.'
        : 'CAT contributions from sold public listings now route to CAT baseline charity.',
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
          : 'Public CAT contributions now route to CAT baseline charity.',
        data: {
          type: 'system',
          route: '/settings',
          communityId: req.params.id,
        },
      },
    });

    await broadcastFeaturedCharityUpdate(req.params.id);

    return res.json({
      community,
      catCycleActive: (community as any).catCycleActive,
      catFeaturedCharityId: (community as any).catFeaturedCharityId,
      charities,
    });
  } catch (error: any) {
    console.error('[API Error] 500:', error);
    return res.status(500).json({ error: error.message || 'Failed to update CAT cycle' });
  }
});

router.get('/:id/featured-charity', async (req, res) => {
  try {
    const summary = await getFeaturedCharitySummary(req.params.id);
    return res.json(summary);
  } catch (error: any) {
    console.error('[API Error] 500:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch featured charity summary' });
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

    const community = await prisma.community.findUnique({ where: { id: req.params.id } });

    let createdCharity: any = null;
    if (req.body?.charityData && !existingSuggestion.charityId) {
      const wantsFeatured = req.body.charityData?.isFeatured === true;
      const charityPayload = {
        ...req.body.charityData,
        isCATCharity: false,
        isApprovedSuggestion: true,
        suggestedById: existingSuggestion.suggestedBy,
      };

      if (wantsFeatured) {
        await prisma.$transaction(async (tx) => {
          await tx.charity.updateMany({
            where: { communityId: req.params.id, isCATCharity: false },
            data: { isFeatured: false },
          });
          createdCharity = await tx.charity.create({
            data: { communityId: req.params.id, ...charityPayload },
          });
          if ((community as any)?.catCycleActive) {
            const cycleResult = await cycleFeaturedCharity(req.params.id, {
              toCharityId: createdCharity.id,
              reason: 'charity_replaced',
            }, tx);
            if (cycleResult.closedSnapshot) {
              io.to(`community:${req.params.id}`).emit('campaign:closed', {
                communityId: req.params.id,
                snapshot: cycleResult.closedSnapshot,
              });
            }
          }
        });
      } else {
        createdCharity = await prisma.charity.create({
          data: { communityId: req.params.id, ...charityPayload },
        });
      }
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

    const [charities, refreshedCommunity] = await Promise.all([
      prisma.charity.findMany({ where: { communityId: req.params.id } }),
      prisma.community.findUnique({ where: { id: req.params.id } }),
    ]);

    return res.json({
      suggestion: serializeCharitySuggestion(suggestion),
      charity: createdCharity,
      charities,
      community: refreshedCommunity,
    });
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
    const featuredCharity = await getFeaturedCharitySummary(req.params.id);
    if (!catTx) {
      return res.json({
        totalCATGenerated: 0,
        totalRaisedForCharity: 0,
        activeCycleCharity: null,
        catCycleActive: false,
        recentTransactions: [],
        featuredCharity,
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
      featuredCharity,
    });
  } catch (error: any) {
    console.error('[API Error] 500:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch CAT hub data' });
  }
});

export default router;
