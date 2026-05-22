import nodemailer from 'nodemailer';
import { baseEmailHtml, ctaButton, divider, infoRow } from './emailTemplates.js';
import { getApiBaseUrl, getAppBaseUrl } from '../lib/urls.js';

function createTransport() {
  const host = process.env.SMTP_HOST || 'mail.lalela.net';
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = (process.env.SMTP_SECURE ?? 'false').toLowerCase() === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!user || !pass) throw new Error('SMTP_USER and SMTP_PASSWORD must be set');
  return nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
}

function fromAddress() {
  const configured = process.env.SMTP_FROM?.trim();
  if (configured) {
    const match = configured.match(/<([^>]+)>/);
    return {
      name: 'Lalela',
      address: (match?.[1] ?? configured).trim(),
    };
  }

  return {
    name: 'Lalela',
    address: process.env.SMTP_USER || 'admin@lalela.net',
  };
}

const FROM = () => fromAddress();
const BASE_URL = () => getApiBaseUrl();
const APP_URL = () => getAppBaseUrl();

function fmt(cents: number): string {
  return `R${(cents / 100).toFixed(2)}`;
}

// ─── Email Verification ───────────────────────────────────────────────────────

export async function sendVerificationEmail(to: string, name: string, token: string) {
  const link = `${BASE_URL()}/auth/verify-email?token=${token}`;
  const t = createTransport();
  await t.sendMail({
    from: FROM(), to,
    subject: 'Verify your lalela account',
    text: `Hi ${name},\n\nVerify your email:\n${link}\n\nExpires in 24 hours.`,
    html: baseEmailHtml(`
      <h2 style="color:#0d3d47;margin-top:0">Welcome to lalela, ${name}!</h2>
      <p>Click below to verify your email address and activate your account.</p>
      ${ctaButton('Verify Email', link, '#0d3d47')}
      <p style="color:#737971;font-size:12px;margin-top:24px">Link expires in 24 hours. If you didn't sign up, ignore this email.</p>
    `, 'Verify your email address to get started.'),
  });
}

// ─── Password Reset ───────────────────────────────────────────────────────────

export async function sendPasswordResetEmail(to: string, name: string, token: string) {
  const link = `${BASE_URL()}/auth/reset-password?token=${token}`;
  const t = createTransport();
  await t.sendMail({
    from: FROM(), to,
    subject: 'Reset your lalela password',
    text: `Hi ${name},\n\nReset your password:\n${link}\n\nExpires in 1 hour.`,
    html: baseEmailHtml(`
      <h2 style="color:#0d3d47;margin-top:0">Password Reset</h2>
      <p>Hi ${name}, we received a request to reset your lalela password.</p>
      ${ctaButton('Reset Password', link, '#fc7127')}
      <p style="color:#737971;font-size:12px;margin-top:24px">Link expires in 1 hour. If you didn't request this, ignore this email.</p>
    `, 'Reset your lalela password.'),
  });
}

// ─── Community Invite ─────────────────────────────────────────────────────────

export async function sendInviteEmail(
  to: string,
  inviteUrl: string,
  communityName: string,
  senderName: string,
) {
  const t = createTransport();
  await t.sendMail({
    from: FROM(), to,
    subject: `${senderName} invited you to join ${communityName} on lalela`,
    text: `${senderName} invited you to join ${communityName}.\nJoin: ${inviteUrl}`,
    html: baseEmailHtml(`
      <h2 style="color:#0d3d47;margin-top:0">You're invited!</h2>
      <p><strong>${senderName}</strong> has invited you to join <strong>${communityName}</strong> on Lalela.</p>
      ${ctaButton('Join ' + communityName, inviteUrl, '#0d3d47')}
      <p style="color:#737971;font-size:12px;margin-top:24px">This invite link may expire soon. If you don't know ${senderName}, ignore this email.</p>
    `, `You've been invited to join ${communityName}.`),
  });
}

// ─── Community Created ────────────────────────────────────────────────────────

export async function sendCommunityCreatedEmail(
  to: string,
  name: string,
  communityName: string,
  trialExpiresAt: Date,
) {
  const expiry = trialExpiresAt.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
  const activateUrl = `${APP_URL()}/pricing`;
  const t = createTransport();
  await t.sendMail({
    from: FROM(), to,
    subject: `Your community "${communityName}" is live on lalela!`,
    text: `Hi ${name},\n\n"${communityName}" is live! 30-day trial ends ${expiry}.\nActivate permanently: ${activateUrl}`,
    html: baseEmailHtml(`
      <h2 style="color:#0d3d47;margin-top:0">Your community is live!</h2>
      <p>Hi ${name}, <strong>${communityName}</strong> has been created on lalela. Your <strong>30-day free trial</strong> has started.</p>
      ${divider()}
      <table cellpadding="0" cellspacing="0" style="width:100%">
        ${infoRow('Community', communityName)}
        ${infoRow('Trial ends', expiry)}
        ${infoRow('Activation fee', 'R999 once-off')}
      </table>
      ${divider()}
      ${ctaButton('Activate Community — R999', activateUrl, '#fc7127')}
      <p style="color:#737971;font-size:12px;margin-top:8px;text-align:center">Activation is once-off and permanent — your community never expires.</p>
    `, `${communityName} is live — 30-day trial started.`),
  });
}

// ─── Member Joined Community ──────────────────────────────────────────────────

export async function sendMemberJoinedEmail(
  to: string,
  name: string,
  communityName: string,
  trialExpiresAt: Date,
) {
  const expiry = trialExpiresAt.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
  const renewUrl = `${APP_URL()}/pricing`;
  const t = createTransport();
  await t.sendMail({
    from: FROM(), to,
    subject: `Welcome to ${communityName} on lalela!`,
    text: `Hi ${name},\n\nWelcome to ${communityName}! Your free membership year runs until ${expiry}.`,
    html: baseEmailHtml(`
      <h2 style="color:#0d3d47;margin-top:0">Welcome to ${communityName}!</h2>
      <p>Hi ${name}, you've successfully joined <strong>${communityName}</strong> on lalela. You have a <strong>1-year free membership</strong>.</p>
      ${divider()}
      <table cellpadding="0" cellspacing="0" style="width:100%">
        ${infoRow('Community', communityName)}
        ${infoRow('Free trial ends', expiry)}
        ${infoRow('Renewal fee', 'R99/year')}
      </table>
      ${divider()}
      <p style="color:#737971;font-size:12px;margin-top:4px;text-align:center">After your free year, renew for just R99/year to keep your access.</p>
    `, `Welcome to ${communityName} — your 1-year free membership is active.`),
  });
}

// ─── Payment Confirmation ─────────────────────────────────────────────────────

export async function sendPaymentConfirmationEmail(opts: {
  to: string;
  name: string;
  type: 'COMMUNITY' | 'MEMBERSHIP';
  amount: number;
  invoiceUrl: string;
  invoiceNumber: string;
  nextBillingDate?: Date;
  inviteLink?: string;
}) {
  const { to, name, type, amount, invoiceUrl, invoiceNumber, nextBillingDate, inviteLink } = opts;
  const isCommunity = type === 'COMMUNITY';
  const itemLabel = isCommunity ? 'Community Activation (once-off, permanent)' : 'Platform Membership (annual)';
  const renewalLine = nextBillingDate
    ? infoRow('Next renewal', nextBillingDate.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }))
    : '';
  const inviteSection = inviteLink ? `
    ${divider()}
    <h3 style="color:#0d3d47;margin-bottom:8px">Start Growing Your Community</h3>
    <p>Your community is live. Share the link below to invite your first members:</p>
    ${ctaButton('Invite Members', inviteLink, '#0d3d47')}
    <p style="text-align:center;font-size:12px;color:#737971;margin-top:4px">Or share: <a href="${inviteLink}" style="color:#0d3d47">${inviteLink}</a></p>
  ` : '';

  const t = createTransport();
  await t.sendMail({
    from: FROM(), to,
    subject: isCommunity ? 'Community Activated — Payment Confirmed' : 'Membership Activated — Payment Confirmed',
    text: `Hi ${name},\n\nPayment confirmed!\nItem: ${itemLabel}\nAmount: ${fmt(amount)}\nInvoice: ${invoiceUrl}${inviteLink ? `\nInvite members: ${inviteLink}` : ''}`,
    html: baseEmailHtml(`
      <h2 style="color:#0d3d47;margin-top:0">Payment Confirmed ✓</h2>
      <p>Hi ${name}, thank you! Your ${isCommunity ? 'community activation' : 'platform membership'} is now active.</p>
      ${divider()}
      <table cellpadding="0" cellspacing="0" style="width:100%">
        ${infoRow('Invoice', invoiceNumber)}
        ${infoRow('Item', itemLabel)}
        ${infoRow('Amount paid', fmt(amount))}
        ${renewalLine}
      </table>
      ${divider()}
      ${ctaButton('Download Invoice', invoiceUrl, '#0d3d47')}
      ${inviteSection}
    `, `Payment of ${fmt(amount)} confirmed — thank you!`),
  });
}

// ─── Trial Expiry Warning ─────────────────────────────────────────────────────

export async function sendTrialExpiryEmail(opts: {
  to: string;
  name: string;
  type: 'COMMUNITY' | 'MEMBERSHIP';
  daysLeft: number;
  expiresAt: Date;
}) {
  const { to, name, type, daysLeft, expiresAt } = opts;
  const isCommunity = type === 'COMMUNITY';
  const expiry = expiresAt.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
  const urgencyColor = daysLeft <= 1 ? '#ba1a1a' : daysLeft <= 3 ? '#fc7127' : '#0d3d47';
  const activateUrl = `${APP_URL()}/pricing`;
  const ctaLabel = isCommunity ? 'Activate Community — R999' : 'Renew Membership — R99/year';
  const description = isCommunity
    ? `Your community trial ends on <strong>${expiry}</strong>. After this date, your community will be suspended.`
    : `Your free Lalela membership ends on <strong>${expiry}</strong>. After this date, you'll lose access.`;

  const t = createTransport();
  await t.sendMail({
    from: FROM(), to,
    subject: isCommunity
      ? `Your community expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'} — activate to keep it live`
      : `Your Lalela membership expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
    text: `Hi ${name},\n\n${isCommunity ? 'Your community' : 'Your membership'} expires in ${daysLeft} days (${expiry}).\nActivate: ${activateUrl}`,
    html: baseEmailHtml(`
      <h2 style="color:${urgencyColor};margin-top:0">${daysLeft === 1 ? 'Last day — action required!' : `${daysLeft} days left`}</h2>
      <p>${description}</p>
      ${divider()}
      <table cellpadding="0" cellspacing="0" style="width:100%">
        ${infoRow('Expires', expiry)}
        ${infoRow('Days remaining', String(daysLeft))}
        ${infoRow(isCommunity ? 'Activation' : 'Renewal', isCommunity ? 'R999 once-off' : 'R99/year')}
      </table>
      ${divider()}
      ${ctaButton(ctaLabel, activateUrl, urgencyColor)}
    `, `${daysLeft} day${daysLeft === 1 ? '' : 's'} left — action required.`),
  });
}

// ─── Renewal Reminder ─────────────────────────────────────────────────────────

export async function sendRenewalReminderEmail(opts: {
  to: string;
  name: string;
  renewalDate: Date;
  daysLeft: number;
  amount: number;
}) {
  const { to, name, renewalDate, daysLeft, amount } = opts;
  const renewal = renewalDate.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
  const manageUrl = `${APP_URL()}/pricing`;
  const t = createTransport();
  await t.sendMail({
    from: FROM(), to,
    subject: `Your lalela subscription renews in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
    text: `Hi ${name},\n\nYour lalela subscription (${fmt(amount)}/year) renews on ${renewal}.\nManage: ${manageUrl}`,
    html: baseEmailHtml(`
      <h2 style="color:#0d3d47;margin-top:0">Renewal Reminder</h2>
      <p>Hi ${name}, your lalela membership renews in <strong>${daysLeft} day${daysLeft === 1 ? '' : 's'}</strong>.</p>
      ${divider()}
      <table cellpadding="0" cellspacing="0" style="width:100%">
        ${infoRow('Renewal date', renewal)}
        ${infoRow('Amount', fmt(amount))}
        ${infoRow('Days until renewal', String(daysLeft))}
      </table>
      ${divider()}
      ${ctaButton('Manage Subscription', manageUrl, '#0d3d47')}
      <p style="color:#737971;font-size:12px;margin-top:8px;text-align:center">To cancel before renewal, email us at <a href="mailto:support@lalela.net" style="color:#0d3d47">support@lalela.net</a></p>
    `, `Your subscription renews in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`),
  });
}

// ─── Failed Payment ───────────────────────────────────────────────────────────

export async function sendFailedPaymentEmail(opts: {
  to: string;
  name: string;
  type: 'COMMUNITY' | 'MEMBERSHIP';
}) {
  const { to, name, type } = opts;
  const isCommunity = type === 'COMMUNITY';
  const retryUrl = `${APP_URL()}/pricing`;
  const t = createTransport();
  await t.sendMail({
    from: FROM(), to,
    subject: 'Payment failed — action required',
    text: `Hi ${name},\n\nYour payment for ${isCommunity ? 'community activation' : 'platform membership'} failed.\nRetry: ${retryUrl}\nHelp: support@lalela.net`,
    html: baseEmailHtml(`
      <h2 style="color:#ba1a1a;margin-top:0">Payment Failed</h2>
      <p>Hi ${name}, we were unable to process your payment for <strong>${isCommunity ? 'community activation' : 'Lalela platform membership'}</strong>.</p>
      <p>Please retry your payment to avoid losing access.</p>
      ${divider()}
      ${ctaButton('Retry Payment', retryUrl, '#ba1a1a')}
      <p style="color:#737971;font-size:12px;margin-top:16px;text-align:center">
        Need help? <a href="mailto:admin@lalela.net" style="color:#0d3d47">admin@lalela.net</a>
      </p>
    `, 'Your payment failed — please retry.'),
  });
}
