import { Router } from 'express';
import prisma from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// All user routes require auth
router.use(requireAuth);

// ─── Profile ──────────────────────────────────────────────────────────────────

router.get('/me', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    select: {
      id: true, email: true, name: true, first_name: true, last_name: true,
      phone: true, mobile_number: true, address: true, profile_image: true,
      email_verified: true, phone_verified: true, status: true, role: true,
      profile_completed: true, community_created: true, onboarding_complete: true,
      license_status: true, license_expiry: true, license_type: true, auto_renew: true,
      access_type: true, expiry_date: true, member_expiry_date: true,
      two_factor_enabled: true, two_factor_method: true, login_alerts_enabled: true,
      profile_visibility: true, pii_visibility: true,
      last_password_changed: true, security_score: true,
      location_sharing: true, is_security_member: true, emergency_location_opt_in: true,
      latitude: true, longitude: true, last_community_id: true,
      agreed_to_terms: true, marketing_consent: true,
      notification_preferences: true,
      fcm_token: true, push_token: true, push_platform: true,
      pending_invite_code: true,
      created_at: true, updated_at: true,
    },
  });
  if (!user) return res.status(404).json({ error: 'User not found' });
  // Normalize DB column name (onboarding_complete) to client field name (onboarding_completed)
  return res.json({ ...user, onboarding_completed: user.onboarding_complete });
});

router.put('/me', async (req, res) => {
  const allowed = [
    'name', 'first_name', 'last_name', 'phone', 'mobile_number', 'address',
    'profile_image', 'latitude', 'longitude', 'location_sharing',
    'is_security_member', 'emergency_location_opt_in', 'last_community_id',
    'profile_completed', 'onboarding_complete', 'community_created',
    'two_factor_enabled', 'two_factor_method', 'login_alerts_enabled',
    'profile_visibility', 'pii_visibility', 'last_password_changed', 'security_score',
    'agreed_to_terms', 'marketing_consent', 'notification_preferences',
    'license_status', 'license_expiry', 'license_type', 'auto_renew',
    'access_type', 'expiry_date', 'member_expiry_date',
    'pending_invite_code', 'fcm_token',
  ];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in req.body) data[key] = req.body[key];
  }
  // Accept onboarding_completed (client alias) → map to onboarding_complete (DB column)
  if ('onboarding_completed' in req.body) data['onboarding_complete'] = req.body['onboarding_completed'];

  const user = await prisma.user.update({ where: { id: req.auth!.userId }, data });
  return res.json(user);
});

// ─── Push Token ───────────────────────────────────────────────────────────────

router.put('/me/push-token', async (req, res) => {
  const { token, platform } = req.body as { token?: string; platform?: string };
  if (!token || !['ios', 'android'].includes(platform ?? '')) {
    return res.status(400).json({ error: 'token and platform (ios|android) are required' });
  }
  await prisma.user.update({
    where: { id: req.auth!.userId },
    data: { push_token: token, push_platform: platform as 'ios' | 'android' },
  });
  return res.json({ message: 'Push token registered' });
});

// ─── Sessions ─────────────────────────────────────────────────────────────────

router.get('/me/sessions', async (req, res) => {
  const sessions = await prisma.userSession.findMany({
    where: { user_id: req.auth!.userId },
    orderBy: { last_active: 'desc' },
    select: { id: true, device: true, ip: true, location: true, last_active: true, created_at: true },
  });
  return res.json(sessions);
});

router.delete('/me/sessions/:id', async (req, res) => {
  await prisma.userSession.deleteMany({
    where: { id: req.params.id, user_id: req.auth!.userId },
  });
  return res.json({ message: 'Session revoked' });
});

router.delete('/me/sessions', async (req, res) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  // Delete all sessions except the current one (identified by refreshToken)
  await prisma.userSession.deleteMany({
    where: { user_id: req.auth!.userId, ...(refreshToken ? { refresh_token: { not: refreshToken } } : {}) },
  });
  return res.json({ message: 'All other sessions revoked' });
});

// ─── Audit Logs ───────────────────────────────────────────────────────────────

router.get('/me/security/logs', async (req, res) => {
  const logs = await prisma.auditLog.findMany({
    where: { user_id: req.auth!.userId },
    orderBy: { timestamp: 'desc' },
    take: 50,
  });
  return res.json(logs);
});

// ─── Notifications ────────────────────────────────────────────────────────────

router.get('/me/notifications', async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { user_id: req.auth!.userId },
    orderBy: { created_at: 'desc' },
    take: 50,
  });
  return res.json(notifications);
});

router.put('/me/notifications/:id/read', async (req, res) => {
  await prisma.notification.updateMany({
    where: { id: req.params.id, user_id: req.auth!.userId },
    data: { read: true },
  });
  return res.json({ message: 'Marked as read' });
});

router.put('/me/notifications/read-all', async (req, res) => {
  await prisma.notification.updateMany({
    where: { user_id: req.auth!.userId, read: false },
    data: { read: true },
  });
  return res.json({ message: 'All notifications marked as read' });
});

export default router;
