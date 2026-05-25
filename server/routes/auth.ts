import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../db.js';
import { issueTokens, verifyRefreshToken, requireAuth } from '../middleware/auth.js';
import {
  otpRateLimiter,
  passwordResetRateLimiter,
  inviteRateLimiter,
} from '../middleware/rateLimit.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/emailService.js';
import {
  sendSms,
  generateOtp,
  buildOtpMessage,
  buildInviteMessage,
} from '../services/smsService.js';
import { getFrontendUrl } from '../lib/urls.js';
import { ME_USER_SELECT, serializeMeUser } from '../lib/userProfile.js';

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

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      phone: phone || null,
      passwordHash,
      name: name.trim(),
    },
  });

  // Create verification token (24h expiry)
  const token = await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      token: uuidv4(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  try {
    await sendVerificationEmail(user.email!, user.name, token.token);
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
  if (!record || record.used || record.expiresAt < new Date()) {
    return res.status(400).json({ error: 'Invalid or expired verification link' });
  }

  await prisma.$transaction([
    prisma.emailVerificationToken.update({ where: { id: record.id }, data: { used: true } }),
    prisma.user.update({ where: { id: record.userId }, data: { emailVerified: true } }),
  ]);

  // Redirect to the web frontend with a success flag so the landing page
  // can show a 'verified — please sign in' banner. On native, the
  // universal link / deep link fallback is handled by APP_DEEP_LINK.
  const frontendUrl = getFrontendUrl();
  const isWebBrowser = (req.headers.accept ?? '').includes('text/html');
  const appUrl = isWebBrowser
    ? `${frontendUrl}?verified=1`
    : (process.env.APP_DEEP_LINK ?? `${frontendUrl}?verified=1`);
  return res.redirect(appUrl);
});

// ─── Resend Verification ──────────────────────────────────────────────────────

router.post('/resend-verification', async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || user.emailVerified) {
    // Return 200 regardless to prevent enumeration
    return res.json({ message: 'If that account exists and is unverified, a new link has been sent.' });
  }

  // Invalidate previous tokens
  await prisma.emailVerificationToken.updateMany({
    where: { userId: user.id, used: false },
    data: { used: true },
  });

  const token = await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      token: uuidv4(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  try {
    await sendVerificationEmail(user.email!, user.name, token.token);
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

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: ME_USER_SELECT,
  });
  if (!user || !user.passwordHash) return res.status(401).json({ error: 'Invalid email or password' });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    // Log failed attempt
    await prisma.auditLog.create({
      data: { userId: user.id, type: 'login_failed', message: 'Failed login attempt', ip: ip ?? req.ip ?? null, status: 'failure' },
    });
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (!user.emailVerified) {
    return res.status(403).json({ error: 'Please verify your email before logging in', code: 'EMAIL_NOT_VERIFIED' });
  }

  const payload = { userId: user.id, email: user.email };
  const { accessToken, refreshToken } = issueTokens(payload);

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await prisma.userSession.create({
    data: {
      userId: user.id,
      refreshToken: refreshToken,
      device: device ?? req.headers['user-agent'] ?? null,
      ip: ip ?? req.ip ?? null,
      expiresAt: expiresAt,
    },
  });

  await prisma.auditLog.create({
    data: { userId: user.id, type: 'login', message: 'Successful login', ip: ip ?? req.ip ?? null },
  });

  return res.json({
    accessToken,
    refreshToken,
    user: serializeMeUser(user),
  });
});

// ─── Refresh Token ────────────────────────────────────────────────────────────

router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken is required' });

  try {
    const payload = verifyRefreshToken(refreshToken);
    const session = await prisma.userSession.findUnique({ where: { refreshToken: refreshToken } });
    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Session expired, please log in again' });
    }

    const tokens = issueTokens({ userId: payload.userId, email: payload.email });

    // Rotate refresh token
    await prisma.userSession.update({
      where: { id: session.id },
      data: { refreshToken: tokens.refreshToken, lastActive: new Date(), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
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
    await prisma.userSession.deleteMany({ where: { refreshToken: refreshToken } });
  }
  return res.json({ message: 'Logged out' });
});

// ─── Forgot Password ──────────────────────────────────────────────────────────

router.post('/forgot-password', passwordResetRateLimiter, async (req, res) => {
  const { email } = req.body as { email?: string };
  // Always return 200 to prevent enumeration
  if (!email) return res.json({ message: 'If that account exists, a reset link has been sent.' });

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (user) {
    // Invalidate previous tokens
    await prisma.passwordResetToken.updateMany({ where: { userId: user.id, used: false }, data: { used: true } });

    const token = await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: uuidv4(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    try {
      await sendPasswordResetEmail(user.email!, user.name, token.token);
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
  if (!record || record.used || record.expiresAt < new Date()) {
    return res.status(400).json({ error: 'Invalid or expired reset link' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction([
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { used: true } }),
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    // Revoke all sessions on password change
    prisma.userSession.deleteMany({ where: { userId: record.userId } }),
  ]);

  return res.json({ message: 'Password reset successfully. Please log in again.' });
});

// ─── Phone OTP: Send ──────────────────────────────────────────────────────────

router.post('/phone/send-otp', otpRateLimiter, async (req, res) => {
  const { phone } = req.body as { phone?: string };
  if (!phone || !phoneRegex.test(phone)) {
    return res.status(400).json({ error: 'Valid E.164 phone number is required (e.g. +27821234567)' });
  }

  const code = generateOtp();
  const expires_at = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  // Invalidate previous login OTPs for this number
  await prisma.otpCode.updateMany({
    where: { phone, used: false, purpose: 'login' },
    data: { used: true },
  });
  await prisma.otpCode.create({ data: { phone, code, purpose: 'login', expiresAt: expires_at } });

  try {
    await sendSms(phone, buildOtpMessage(code, 'login'));
  } catch (err) {
    console.error('[auth/phone/send-otp] SMS error:', err);
    return res.status(503).json({ error: 'Failed to send SMS. Please try again.' });
  }

  return res.json({ message: `OTP sent to ${phone}` });
});

// ─── Phone OTP: Verify (login / signup) ───────────────────────────────────────

router.post('/phone/verify-otp', async (req, res) => {
  const { phone, code, device, ip } = req.body as {
    phone?: string; code?: string; device?: string; ip?: string;
  };

  if (!phone || !code) return res.status(400).json({ error: 'Phone and code are required' });

  const otp = await prisma.otpCode.findFirst({
    where: { phone, code, used: false, purpose: 'login' },
    orderBy: { createdAt: 'desc' },
  });

  if (!otp || otp.expiresAt < new Date()) {
    return res.status(400).json({ error: 'Invalid or expired OTP' });
  }

  await prisma.otpCode.update({ where: { id: otp.id }, data: { used: true } });

  // Find or create user by phone.
  let user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    // Legacy compat: older phone-only accounts were created with a synthetic
    // email like "27821234567@phone.lalela.net". If the phone column was
    // cleared but the synthetic-email row still exists, re-link it rather
    // than creating a duplicate. New accounts no longer get a synthetic email.
    const syntheticEmail = `${phone.replace('+', '')}@phone.lalela.net`;
    const legacy = await prisma.user.findUnique({ where: { email: syntheticEmail } });
    if (legacy) {
      user = await prisma.user.update({
        where: { id: legacy.id },
        data: { phone, phoneVerified: true },
      });
    } else {
      user = await prisma.user.create({
        data: { phone, phoneVerified: true, name: '' },
      });
    }
  } else if (!user.phoneVerified) {
    user = await prisma.user.update({ where: { id: user.id }, data: { phoneVerified: true } });
  }

  const payload = { userId: user.id, email: user.email };
  const { accessToken, refreshToken } = issueTokens(payload);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.userSession.create({
    data: {
      userId: user.id,
      refreshToken: refreshToken,
      device: device ?? req.headers['user-agent'] ?? null,
      ip: ip ?? req.ip ?? null,
      expiresAt: expiresAt,
    },
  });

  const hydratedUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: ME_USER_SELECT,
  });
  if (!hydratedUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.json({
    accessToken,
    refreshToken,
    user: serializeMeUser(hydratedUser),
  });
});

// ─── Phone Link: Send OTP (authenticated) ─────────────────────────────────────
//
// Sends an OTP to a phone number the *current* user wants to attach to their
// account. The OTP is scoped to userId + purpose='link' so it can only be
// consumed by the same authenticated session.

router.post('/link-phone', requireAuth, otpRateLimiter, async (req, res) => {
  const { phone } = req.body as { phone?: string };
  if (!phone || !phoneRegex.test(phone)) {
    return res.status(400).json({ error: 'Valid E.164 phone number is required (e.g. +27821234567)' });
  }

  const userId = req.auth!.userId;

  // Reject if another user already owns this phone.
  const owner = await prisma.user.findUnique({ where: { phone } });
  if (owner && owner.id !== userId) {
    return res.status(409).json({ error: 'This phone number is already linked to another account' });
  }

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  // Invalidate any prior link OTPs for this user + phone.
  await prisma.otpCode.updateMany({
    where: { phone, userId, used: false, purpose: 'link' },
    data: { used: true },
  });
  await prisma.otpCode.create({
    data: { phone, code, purpose: 'link', userId, expiresAt },
  });

  try {
    await sendSms(phone, buildOtpMessage(code, 'link'));
  } catch (err) {
    console.error('[auth/link-phone] SMS error:', err);
    return res.status(503).json({ error: 'Failed to send SMS. Please try again.' });
  }

  return res.json({ message: `Verification code sent to ${phone}` });
});

// ─── Phone Link: Verify OTP (authenticated) ───────────────────────────────────

router.post('/verify-link-phone', requireAuth, async (req, res) => {
  const { phone, code } = req.body as { phone?: string; code?: string };
  if (!phone || !code) return res.status(400).json({ error: 'Phone and code are required' });

  const userId = req.auth!.userId;

  const otp = await prisma.otpCode.findFirst({
    where: { phone, code, used: false, purpose: 'link', userId },
    orderBy: { createdAt: 'desc' },
  });

  if (!otp || otp.expiresAt < new Date()) {
    return res.status(400).json({ error: 'Invalid or expired verification code' });
  }

  // Re-check ownership in case another account claimed the number after send.
  const owner = await prisma.user.findUnique({ where: { phone } });
  if (owner && owner.id !== userId) {
    return res.status(409).json({ error: 'This phone number is already linked to another account' });
  }

  await prisma.$transaction([
    prisma.otpCode.update({ where: { id: otp.id }, data: { used: true } }),
    prisma.user.update({ where: { id: userId }, data: { phone, phoneVerified: true } }),
  ]);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  return res.json({
    message: 'Phone number linked successfully',
    user: user
      ? {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          phoneVerified: user.phoneVerified,
        }
      : null,
  });
});

// ─── Phone Password Reset: Send OTP ───────────────────────────────────────────
//
// Always returns 200 to prevent enumeration. Only dispatches an SMS if a user
// with that phone exists AND has a passwordHash (i.e. has a password to reset
// in the first place — phone-only accounts skip this silently).

router.post('/phone/send-reset-otp', passwordResetRateLimiter, async (req, res) => {
  const { phone } = req.body as { phone?: string };
  const okResponse = { message: 'If that account exists, a reset code has been sent.' };
  if (!phone || !phoneRegex.test(phone)) return res.json(okResponse);

  const user = await prisma.user.findUnique({ where: { phone } });
  if (user?.passwordHash) {
    const code = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.otpCode.updateMany({
      where: { phone, userId: user.id, used: false, purpose: 'reset' },
      data: { used: true },
    });
    await prisma.otpCode.create({
      data: { phone, code, purpose: 'reset', userId: user.id, expiresAt },
    });

    try {
      await sendSms(phone, buildOtpMessage(code, 'reset'));
    } catch (err) {
      console.error('[auth/phone/send-reset-otp] SMS error:', err);
      // Still return 200 to avoid enumeration.
    }
  }

  return res.json(okResponse);
});

// ─── Phone Password Reset: Apply ──────────────────────────────────────────────

router.post('/phone/reset-password', async (req, res) => {
  const { phone, code, newPassword } = req.body as {
    phone?: string; code?: string; newPassword?: string;
  };

  if (!phone || !code || !newPassword) {
    return res.status(400).json({ error: 'phone, code and newPassword are required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) return res.status(400).json({ error: 'Invalid or expired code' });

  const otp = await prisma.otpCode.findFirst({
    where: { phone, code, used: false, purpose: 'reset', userId: user.id },
    orderBy: { createdAt: 'desc' },
  });
  if (!otp || otp.expiresAt < new Date()) {
    return res.status(400).json({ error: 'Invalid or expired code' });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction([
    prisma.otpCode.update({ where: { id: otp.id }, data: { used: true } }),
    prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
    // Revoke all existing sessions — mirrors the email reset flow.
    prisma.userSession.deleteMany({ where: { userId: user.id } }),
  ]);

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      type: 'password_change',
      message: 'Password reset via phone OTP',
      ip: req.ip ?? null,
    },
  });

  return res.json({ message: 'Password reset successfully. Please log in again.' });
});

// ─── SMS Invite (authenticated) ───────────────────────────────────────────────
//
// Sends an invite SMS to a phone number. Creates a single-use
// CommunityInviteLink for the inviter's community and texts the deep link.

router.post('/send-invite', requireAuth, inviteRateLimiter, async (req, res) => {
  const { phone, communityId } = req.body as { phone?: string; communityId?: string };
  if (!phone || !phoneRegex.test(phone)) {
    return res.status(400).json({ error: 'Valid E.164 phone number is required (e.g. +27821234567)' });
  }
  if (!communityId) {
    return res.status(400).json({ error: 'communityId is required' });
  }

  const inviter = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!inviter) return res.status(401).json({ error: 'User not found' });

  // Verify the inviter is a member of the community they're inviting into.
  const membership = await prisma.communityMember.findFirst({
    where: { userId: inviter.id, communityId },
  });
  if (!membership) {
    return res.status(403).json({ error: 'You are not a member of that community' });
  }

  const link = await prisma.communityInviteLink.create({
    data: {
      communityId,
      createdBy: inviter.id,
      maxUses: 1,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
    },
  });

  const joinUrl = `${getFrontendUrl()}/join?code=${link.code}`;

  try {
    await sendSms(
      phone,
      buildInviteMessage({ inviterName: inviter.name, joinUrl }),
    );
  } catch (err) {
    console.error('[auth/send-invite] SMS error:', err);
    return res.status(503).json({ error: 'Failed to send SMS. Please try again.' });
  }

  return res.json({ message: `Invite sent to ${phone}`, code: link.code });
});

// ─── Change Password (authenticated) ──────────────────────────────────────────

router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });

  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user?.passwordHash) return res.status(400).json({ error: 'No password set on this account' });

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  await prisma.auditLog.create({
    data: { userId: user.id, type: 'password_change', message: 'Password changed', ip: req.ip ?? null },
  });

  return res.json({ message: 'Password updated successfully' });
});

// ─── Set Initial Password (authenticated) ─────────────────────────────────────
//
// For accounts that have no password yet (e.g. phone-only signups). Once a
// password is set, the user can sign in via email + password as well.
// Refuses to overwrite an existing password — those flows must go through
// /change-password (requires currentPassword) or /reset-password.

router.post('/set-password', requireAuth, async (req, res) => {
  const { newPassword } = req.body as { newPassword?: string };
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.passwordHash) {
    return res.status(409).json({ error: 'Password already set. Use change-password instead.' });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, lastPasswordChanged: new Date() },
  });

  await prisma.auditLog.create({
    data: { userId: user.id, type: 'password_set', message: 'Initial password set', ip: req.ip ?? null },
  });

  return res.json({ message: 'Password set successfully' });
});

// ─── Link Email (authenticated) ───────────────────────────────────────────────
//
// Attach an email address to the current account (e.g. for phone-only users
// who want to also log in by email). Immediately updates user.email and
// resets emailVerified=false, then sends a verification link. Until the
// link is followed, the email is attached but unverified. Rejects emails
// already owned by another account or blacklisted.

router.post('/link-email', requireAuth, async (req, res) => {
  const { email: rawEmail } = req.body as { email?: string };
  const email = rawEmail?.trim().toLowerCase();
  if (!email || !emailRegex.test(email)) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  const userId = req.auth!.userId;

  const blacklisted = await prisma.blacklistedEmail.findUnique({ where: { email } });
  if (blacklisted) return res.status(403).json({ error: 'This email address cannot be used' });

  const owner = await prisma.user.findUnique({ where: { email } });
  if (owner && owner.id !== userId) {
    return res.status(409).json({ error: 'This email is already linked to another account' });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { email, emailVerified: false },
  });

  // Invalidate any previous verification tokens for this user.
  await prisma.emailVerificationToken.updateMany({
    where: { userId, used: false },
    data: { used: true },
  });

  const token = await prisma.emailVerificationToken.create({
    data: {
      userId,
      token: uuidv4(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  try {
    await sendVerificationEmail(email, updated.name, token.token);
  } catch (err) {
    console.error('[auth/link-email] Failed to send verification email:', err);
    return res.status(503).json({ error: 'Email linked but verification message failed to send. Use "Resend" to try again.' });
  }

  return res.json({
    message: 'Verification email sent. Please check your inbox to confirm the address.',
    user: {
      id: updated.id,
      email: updated.email,
      emailVerified: updated.emailVerified,
    },
  });
});

export default router;
