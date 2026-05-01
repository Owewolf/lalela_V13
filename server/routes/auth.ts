import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../db.js';
import { issueTokens, verifyRefreshToken } from '../middleware/auth.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/emailService.js';
import { sendSms, generateOtp } from '../services/smsService.js';

const router = Router();

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^\+[1-9]\d{6,14}$/;

// ─── Register ─────────────────────────────────────────────────────────────────

router.post('/register', async (req, res) => {
  const { email, password, name, phone } = req.body as {
    email?: string; password?: string; name?: string; phone?: string;
  };

  if (!email || !emailRegex.test(email))
    return res.status(400).json({ error: 'Valid email is required' });
  if (!password || password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (!name?.trim())
    return res.status(400).json({ error: 'Name is required' });

  // Check blacklist
  const blacklisted = await prisma.blacklistedEmail.findUnique({ where: { email: email.toLowerCase() } });
  if (blacklisted) return res.status(403).json({ error: 'This email address cannot be used' });

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const password_hash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      phone: phone || null,
      password_hash,
      name: name.trim(),
    },
  });

  // Create verification token (24h expiry)
  const token = await prisma.emailVerificationToken.create({
    data: {
      user_id: user.id,
      token: uuidv4(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  try {
    await sendVerificationEmail(user.email, user.name, token.token);
  } catch (err) {
    console.error('[auth/register] Failed to send verification email:', err);
    // Don't block registration — user can request resend
  }

  return res.status(201).json({
    message: 'Account created. Please check your email to verify your account.',
    userId: user.id,
  });
});

// ─── Verify Email ─────────────────────────────────────────────────────────────

router.get('/verify-email', async (req, res) => {
  const token = req.query.token as string;
  if (!token) return res.status(400).json({ error: 'Token is required' });

  const record = await prisma.emailVerificationToken.findUnique({ where: { token } });
  if (!record || record.used || record.expires_at < new Date()) {
    return res.status(400).json({ error: 'Invalid or expired verification link' });
  }

  await prisma.$transaction([
    prisma.emailVerificationToken.update({ where: { id: record.id }, data: { used: true } }),
    prisma.user.update({ where: { id: record.user_id }, data: { email_verified: true } }),
  ]);

  // Redirect to a deep-link or success page
  const appUrl = process.env.APP_DEEP_LINK ?? 'lalela://verified';
  return res.redirect(appUrl);
});

// ─── Resend Verification ──────────────────────────────────────────────────────

router.post('/resend-verification', async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || user.email_verified) {
    // Return 200 regardless to prevent enumeration
    return res.json({ message: 'If that account exists and is unverified, a new link has been sent.' });
  }

  // Invalidate previous tokens
  await prisma.emailVerificationToken.updateMany({
    where: { user_id: user.id, used: false },
    data: { used: true },
  });

  const token = await prisma.emailVerificationToken.create({
    data: {
      user_id: user.id,
      token: uuidv4(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  try {
    await sendVerificationEmail(user.email, user.name, token.token);
  } catch (err) {
    console.error('[auth/resend] email error:', err);
  }

  return res.json({ message: 'If that account exists and is unverified, a new link has been sent.' });
});

// ─── Login ────────────────────────────────────────────────────────────────────

router.post('/login', async (req, res) => {
  const { email, password, device, ip } = req.body as {
    email?: string; password?: string; device?: string; ip?: string;
  };

  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !user.password_hash) return res.status(401).json({ error: 'Invalid email or password' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    // Log failed attempt
    await prisma.auditLog.create({
      data: { user_id: user.id, type: 'login_failed', message: 'Failed login attempt', ip: ip ?? req.ip ?? null, status: 'failure' },
    });
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (!user.email_verified) {
    return res.status(403).json({ error: 'Please verify your email before logging in', code: 'EMAIL_NOT_VERIFIED' });
  }

  const payload = { userId: user.id, email: user.email };
  const { accessToken, refreshToken } = issueTokens(payload);

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await prisma.userSession.create({
    data: {
      user_id: user.id,
      refresh_token: refreshToken,
      device: device ?? req.headers['user-agent'] ?? null,
      ip: ip ?? req.ip ?? null,
      expires_at: expiresAt,
    },
  });

  await prisma.auditLog.create({
    data: { user_id: user.id, type: 'login', message: 'Successful login', ip: ip ?? req.ip ?? null },
  });

  return res.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      profile_image: user.profile_image,
      profile_completed: user.profile_completed,
      community_created: user.community_created,
      onboarding_completed: user.onboarding_complete,
      last_community_id: user.last_community_id,
      license_status: user.license_status,
      license_type: user.license_type,
      role: user.role,
      status: user.status,
      latitude: user.latitude,
      longitude: user.longitude,
      address: user.address,
      defaultLocation:
        user.latitude != null && user.longitude != null
          ? { name: user.address ?? '', latitude: user.latitude, longitude: user.longitude }
          : undefined,
    },
  });
});

// ─── Refresh Token ────────────────────────────────────────────────────────────

router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken is required' });

  try {
    const payload = verifyRefreshToken(refreshToken);
    const session = await prisma.userSession.findUnique({ where: { refresh_token: refreshToken } });
    if (!session || session.expires_at < new Date()) {
      return res.status(401).json({ error: 'Session expired, please log in again' });
    }

    const tokens = issueTokens({ userId: payload.userId, email: payload.email });

    // Rotate refresh token
    await prisma.userSession.update({
      where: { id: session.id },
      data: { refresh_token: tokens.refreshToken, last_active: new Date(), expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    });

    return res.json(tokens);
  } catch {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// ─── Logout ───────────────────────────────────────────────────────────────────

router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (refreshToken) {
    await prisma.userSession.deleteMany({ where: { refresh_token: refreshToken } });
  }
  return res.json({ message: 'Logged out' });
});

// ─── Forgot Password ──────────────────────────────────────────────────────────

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body as { email?: string };
  // Always return 200 to prevent enumeration
  if (!email) return res.json({ message: 'If that account exists, a reset link has been sent.' });

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (user) {
    // Invalidate previous tokens
    await prisma.passwordResetToken.updateMany({ where: { user_id: user.id, used: false }, data: { used: true } });

    const token = await prisma.passwordResetToken.create({
      data: {
        user_id: user.id,
        token: uuidv4(),
        expires_at: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    try {
      await sendPasswordResetEmail(user.email, user.name, token.token);
    } catch (err) {
      console.error('[auth/forgot-password] email error:', err);
    }
  }

  return res.json({ message: 'If that account exists, a reset link has been sent.' });
});

// ─── Reset Password ───────────────────────────────────────────────────────────

router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body as { token?: string; password?: string };
  if (!token || !password) return res.status(400).json({ error: 'Token and new password are required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const record = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!record || record.used || record.expires_at < new Date()) {
    return res.status(400).json({ error: 'Invalid or expired reset link' });
  }

  const password_hash = await bcrypt.hash(password, 12);
  await prisma.$transaction([
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { used: true } }),
    prisma.user.update({ where: { id: record.user_id }, data: { password_hash } }),
    // Revoke all sessions on password change
    prisma.userSession.deleteMany({ where: { user_id: record.user_id } }),
  ]);

  return res.json({ message: 'Password reset successfully. Please log in again.' });
});

// ─── Phone OTP: Send ──────────────────────────────────────────────────────────

router.post('/phone/send-otp', async (req, res) => {
  const { phone } = req.body as { phone?: string };
  if (!phone || !phoneRegex.test(phone)) {
    return res.status(400).json({ error: 'Valid E.164 phone number is required (e.g. +27821234567)' });
  }

  const code = generateOtp();
  const expires_at = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  // Invalidate previous OTPs for this number
  await prisma.otpCode.updateMany({ where: { phone, used: false }, data: { used: true } });
  await prisma.otpCode.create({ data: { phone, code, expires_at } });

  try {
    await sendSms(phone, `Your Lalela verification code is: ${code}. Valid for 10 minutes.`);
  } catch (err) {
    console.error('[auth/phone/send-otp] SMS error:', err);
    return res.status(503).json({ error: 'Failed to send SMS. Please try again.' });
  }

  return res.json({ message: `OTP sent to ${phone}` });
});

// ─── Phone OTP: Verify ────────────────────────────────────────────────────────

router.post('/phone/verify-otp', async (req, res) => {
  const { phone, code, device, ip } = req.body as {
    phone?: string; code?: string; device?: string; ip?: string;
  };

  if (!phone || !code) return res.status(400).json({ error: 'Phone and code are required' });

  const otp = await prisma.otpCode.findFirst({
    where: { phone, code, used: false },
    orderBy: { created_at: 'desc' },
  });

  if (!otp || otp.expires_at < new Date()) {
    return res.status(400).json({ error: 'Invalid or expired OTP' });
  }

  await prisma.otpCode.update({ where: { id: otp.id }, data: { used: true } });

  // Find or create user by phone
  let user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    user = await prisma.user.create({ data: { phone, phone_verified: true, name: '', email: `${phone.replace('+', '')}@phone.lalela.net` } });
  } else {
    await prisma.user.update({ where: { id: user.id }, data: { phone_verified: true } });
  }

  const payload = { userId: user.id, email: user.email };
  const { accessToken, refreshToken } = issueTokens(payload);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.userSession.create({
    data: { user_id: user.id, refresh_token: refreshToken, device: device ?? null, ip: ip ?? req.ip ?? null, expires_at: expiresAt },
  });

  return res.json({
    accessToken,
    refreshToken,
    user: { id: user.id, email: user.email, name: user.name, profile_completed: user.profile_completed },
  });
});

// ─── Change Password (authenticated) ──────────────────────────────────────────

import { requireAuth } from '../middleware/auth.js';

router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });

  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user?.password_hash) return res.status(400).json({ error: 'No password set on this account' });

  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

  const password_hash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { password_hash } });

  await prisma.auditLog.create({
    data: { user_id: user.id, type: 'password_change', message: 'Password changed', ip: req.ip ?? null },
  });

  return res.json({ message: 'Password updated successfully' });
});

export default router;
