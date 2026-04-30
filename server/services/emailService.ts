import nodemailer from 'nodemailer';

function createTransport() {
  const host = process.env.SMTP_HOST || 'mail.lalela.net';
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = (process.env.SMTP_SECURE ?? 'false').toLowerCase() === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!user || !pass) {
    throw new Error('SMTP_USER and SMTP_PASSWORD must be set');
  }

  return nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
}

const FROM = () => process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@lalela.net';
const BASE_URL = () => process.env.API_BASE_URL || 'https://lalela.net/api';

// ─── Email Verification ───────────────────────────────────────────────────────

export async function sendVerificationEmail(to: string, name: string, token: string) {
  const link = `${BASE_URL()}/auth/verify-email?token=${token}`;
  const t = createTransport();
  await t.sendMail({
    from: FROM(),
    to,
    subject: 'Verify your Lalela account',
    text: `Hi ${name},\n\nClick the link below to verify your email address:\n${link}\n\nThis link expires in 24 hours.`,
    html: `
      <div style="font-family:Arial,sans-serif;color:#1a1c1a;line-height:1.6">
        <h2 style="color:#0d3d47">Welcome to Lalela, ${name}!</h2>
        <p>Click the button below to verify your email address.</p>
        <p style="margin:24px 0">
          <a href="${link}" style="background:#0d3d47;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:700;display:inline-block">
            Verify Email
          </a>
        </p>
        <p>Or copy this link: <a href="${link}">${link}</a></p>
        <p style="color:#737971;font-size:12px;margin-top:24px">This link expires in 24 hours. If you didn't create an account, ignore this email.</p>
      </div>`,
  });
}

// ─── Password Reset ───────────────────────────────────────────────────────────

export async function sendPasswordResetEmail(to: string, name: string, token: string) {
  const link = `${BASE_URL()}/auth/reset-password?token=${token}`;
  const t = createTransport();
  await t.sendMail({
    from: FROM(),
    to,
    subject: 'Reset your Lalela password',
    text: `Hi ${name},\n\nClick the link below to reset your password:\n${link}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`,
    html: `
      <div style="font-family:Arial,sans-serif;color:#1a1c1a;line-height:1.6">
        <h2 style="color:#0d3d47">Password Reset</h2>
        <p>Hi ${name}, we received a request to reset your Lalela password.</p>
        <p style="margin:24px 0">
          <a href="${link}" style="background:#fc7127;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:700;display:inline-block">
            Reset Password
          </a>
        </p>
        <p>Or copy this link: <a href="${link}">${link}</a></p>
        <p style="color:#737971;font-size:12px;margin-top:24px">This link expires in 1 hour. If you didn't request a reset, ignore this email.</p>
      </div>`,
  });
}

// ─── Community Invite ─────────────────────────────────────────────────────────

export async function sendInviteEmail(
  to: string,
  inviteUrl: string,
  communityName: string,
  senderName: string
) {
  const t = createTransport();
  await t.sendMail({
    from: FROM(),
    to,
    subject: `Join ${communityName} on Lalela`,
    text: `${senderName} invited you to join ${communityName} on Lalela.\n\nJoin here: ${inviteUrl}\n\nThis invite link may expire soon.`,
    html: `
      <div style="font-family:Arial,sans-serif;color:#1a1c1a;line-height:1.6">
        <h2 style="color:#0d3d47">You're invited to join ${communityName}</h2>
        <p>${senderName} invited you to join <strong>${communityName}</strong> on Lalela.</p>
        <p style="margin:24px 0">
          <a href="${inviteUrl}" style="background:#0d3d47;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700;display:inline-block">
            Open Invite Link
          </a>
        </p>
        <p>Or copy: <a href="${inviteUrl}">${inviteUrl}</a></p>
        <p style="color:#737971;font-size:12px;margin-top:24px">This invite link may expire, so use it soon.</p>
      </div>`,
  });
}
