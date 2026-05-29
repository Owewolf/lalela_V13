import { Router } from 'express';
import prisma from '../db.js';
import { createNotificationForUsers } from '../services/notificationService.js';
import { requireAuth } from '../middleware/auth.js';
import { ME_USER_SELECT, serializeMeUser } from '../lib/userProfile.js';

const router = Router();

// All user routes require auth
router.use(requireAuth);

// ─── Profile ──────────────────────────────────────────────────────────────────

router.get('/me', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    select: ME_USER_SELECT,
  });
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json(serializeMeUser(user));
});

router.put('/me', async (req, res) => {
  // Map defaultLocation object → flat lat/lng columns
  if (req.body.defaultLocation?.latitude != null) {
    req.body.latitude = req.body.defaultLocation.latitude;
    req.body.longitude = req.body.defaultLocation.longitude;
    if (!req.body.address && req.body.defaultLocation.name) req.body.address = req.body.defaultLocation.name;
  }

  const allowed = [
    'name', 'email', 'firstName', 'lastName', 'phone', 'mobileNumber', 'address',
    'profileImage', 'latitude', 'longitude', 'locationSharing',
    'isSecurityMember', 'emergencyLocationOptIn', 'lastCommunityId',
    'profileCompleted', 'onboardingCompleted', 'communityCreated',
    'twoFactorEnabled', 'twoFactorMethod', 'loginAlertsEnabled',
    'profileVisibility', 'piiVisibility', 'lastPasswordChanged', 'securityScore',
    'agreedToTerms', 'marketingConsent', 'notificationPreferences',
    'autoRenew',
    'pendingInviteCode', 'fcmToken',
    // NOTE: licenseStatus, subscriptionActive, trialExpiresAt, subscriptionRenewalDate
    // are intentionally excluded — only server-side billing logic may write these.
  ];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in req.body) data[key] = req.body[key];
  }
  // Guard: profile_completed can only be set to true if a location is provided
  if (data['profileCompleted'] === true) {
    const current = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { latitude: true, longitude: true, address: true } });
    const hasExistingLocation = current && current.latitude != null && current.longitude != null;
    const hasNewLocation = (req.body.defaultLocation?.latitude && req.body.defaultLocation?.longitude) || (req.body.latitude && req.body.longitude);
    if (!hasExistingLocation && !hasNewLocation) {
      return res.status(400).json({ error: 'Location must be set before completing onboarding.' });
    }
  }

  // Guard: onboarding_complete can only be set to true if profile_completed is already true
  // OR is being set to true in the same request (atomic first-time completion).
  if (data['onboardingCompleted'] === true) {
    const settingProfileNow = data['profileCompleted'] === true;
    if (!settingProfileNow) {
      const current = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { profileCompleted: true } });
      if (!current?.profileCompleted) {
        return res.status(400).json({ error: 'Profile must be completed before finishing onboarding.' });
      }
    }
  }

  // Guard: phone is @unique — drop empty values and skip if already owned by this user;
  // reject if owned by another account.
  if ('phone' in data) {
    const phoneVal = (data['phone'] as string | null | undefined);
    if (!phoneVal || (typeof phoneVal === 'string' && phoneVal.trim() === '')) {
      delete data['phone'];
    } else {
      const existing = await prisma.user.findUnique({ where: { phone: phoneVal as string }, select: { id: true } });
      if (existing) {
        if (existing.id === req.auth!.userId) {
          delete data['phone'];
        } else {
          return res.status(409).json({ error: 'That phone number is already associated with another account.' });
        }
      }
    }
  }

  const user = await prisma.user.update({ where: { id: req.auth!.userId }, data });
  // Reconstruct defaultLocation from flat lat/lng columns
  const defaultLocation =
    user.latitude != null && user.longitude != null
      ? { name: user.address ?? '', latitude: user.latitude, longitude: user.longitude }
      : undefined;
  return res.json({ ...user, defaultLocation });
});

router.delete('/me', async (req, res) => {
  const userId = req.auth!.userId;

  const ownedActiveCommunities = await prisma.community.findMany({
    where: { ownerId: userId, status: 'ACTIVE' },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  });

  if (ownedActiveCommunities.length > 0) {
    return res.status(409).json({
      code: 'OWNED_COMMUNITIES_EXIST',
      error: 'Delete account is blocked while you still own active communities. Delete those communities first.',
      ownedActiveCommunityCount: ownedActiveCommunities.length,
      ownedActiveCommunities,
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  await prisma.$transaction(async (tx) => {
    if (user.email) {
      await tx.blacklistedEmail.upsert({
        where: { email: user.email.toLowerCase() },
        create: {
          email: user.email.toLowerCase(),
          originalUid: user.id,
        },
        update: {
          deletedAt: new Date(),
          originalUid: user.id,
        },
      });
    }

    await tx.user.delete({ where: { id: userId } });
  });

  return res.json({ message: 'Account deleted' });
});

// ─── Push Token ───────────────────────────────────────────────────────────────

router.put('/me/push-token', async (req, res) => {
  const { token, platform } = req.body as { token?: string; platform?: string };
  if (!token || !['ios', 'android'].includes(platform ?? '')) {
    return res.status(400).json({ error: 'token and platform (ios|android) are required' });
  }
  await prisma.user.update({
    where: { id: req.auth!.userId },
    data: { pushToken: token, pushPlatform: platform as 'ios' | 'android' },
  });
  return res.json({ message: 'Push token registered' });
});

// ─── Sessions ─────────────────────────────────────────────────────────────────

router.get('/me/sessions', async (req, res) => {
  const sessions = await prisma.userSession.findMany({
    where: { userId: req.auth!.userId },
    orderBy: { lastActive: 'desc' },
    select: { id: true, device: true, ip: true, location: true, lastActive: true, createdAt: true },
  });
  return res.json(sessions);
});

router.delete('/me/sessions/:id', async (req, res) => {
  await prisma.userSession.deleteMany({
    where: { id: req.params.id, userId: req.auth!.userId },
  });
  return res.json({ message: 'Session revoked' });
});

router.delete('/me/sessions', async (req, res) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  // Delete all sessions except the current one (identified by refreshToken)
  await prisma.userSession.deleteMany({
    where: { userId: req.auth!.userId, ...(refreshToken ? { refreshToken: { not: refreshToken } } : {}) },
  });
  return res.json({ message: 'All other sessions revoked' });
});

// ─── Audit Logs ───────────────────────────────────────────────────────────────

router.get('/me/security/logs', async (req, res) => {
  const logs = await prisma.auditLog.findMany({
    where: { userId: req.auth!.userId },
    orderBy: { timestamp: 'desc' },
    take: 50,
  });
  return res.json(logs);
});

// ─── Notifications ────────────────────────────────────────────────────────────

router.get('/me/notifications', async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.auth!.userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return res.json(notifications);
});

// Backward-compatible create endpoint used by client-side helper.
router.post('/me/notifications', async (req, res) => {
  const { target_userId, title, message, type, metadata } = req.body as {
    target_userId?: string;
    title?: string;
    message?: string;
    type?: string;
    metadata?: unknown;
  };

  if (!target_userId || !title || !message || !type) {
    return res.status(400).json({ error: 'target_userId, title, message and type are required' });
  }

  const [notification] = await createNotificationForUsers({
    recipientUserIds: [target_userId],
    type,
    title,
    message,
    metadata: metadata as Record<string, unknown> | undefined,
    category: type === 'alert' ? 'securityAlerts' : 'communityActivity',
  });

  if (!notification) {
    return res.status(404).json({ error: 'Notification recipient not found or notifications disabled' });
  }

  return res.status(201).json(notification);
});

// Backward-compatible preferences endpoint used by client context.
router.put('/me/notifications', async (req, res) => {
  const prefs = req.body;
  await prisma.user.update({
    where: { id: req.auth!.userId },
    data: { notificationPreferences: prefs as any },
  });
  return res.json({ message: 'Notification preferences updated' });
});

// Backward-compatible mark-read endpoint used by client context.
router.put('/me/notifications/:id', async (req, res) => {
  const readValue = typeof req.body?.read === 'boolean' ? req.body.read : true;
  await prisma.notification.updateMany({
    where: { id: req.params.id, userId: req.auth!.userId },
    data: { read: readValue },
  });
  return res.json({ message: 'Notification updated' });
});

router.put('/me/notifications/:id/read', async (req, res) => {
  await prisma.notification.updateMany({
    where: { id: req.params.id, userId: req.auth!.userId },
    data: { read: true },
  });
  return res.json({ message: 'Marked as read' });
});

router.put('/me/notifications/read-all', async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.auth!.userId, read: false },
    data: { read: true },
  });
  return res.json({ message: 'All notifications marked as read' });
});

router.delete('/me/notifications/:id', async (req, res) => {
  await prisma.notification.deleteMany({
    where: { id: req.params.id, userId: req.auth!.userId },
  });
  return res.json({ message: 'Notification deleted' });
});

export default router;
