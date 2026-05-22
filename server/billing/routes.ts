/**
 * Billing routes — mock Stripe implementation.
 *
 * Pricing:
 *   Community activation  → R999 once-off  (community becomes permanently ACTIVE)
 *   Platform membership   → R99/year       (annual subscription)
 *
 * ─── STRIPE MIGRATION (going live) ────────────────────────────────────────────
 *   1. npm install stripe
 *   2. Replace POST /checkout mock with: stripe.checkout.sessions.create(...)
 *   3. In POST /webhook: add stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)
 *      then call handlePaymentSuccess with the event data.
 *   4. Add STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET to .env
 *   Everything else (invoices, emails, cron) stays unchanged.
 * ──────────────────────────────────────────────────────────────────────────────
 */
import { Router } from 'express';
import prisma from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { handlePaymentSuccess } from './paymentService.js';
import { getInvoicePdf, verifyInvoiceAccessToken } from './invoiceService.js';

const router = Router();

router.get('/invoices/:invoiceNumber/pdf', async (req, res) => {
  const { invoiceNumber } = req.params;
  const token = typeof req.query.token === 'string' ? req.query.token : '';

  if (!token || !verifyInvoiceAccessToken(invoiceNumber, token)) {
    return res.status(403).json({ error: 'Invalid invoice link' });
  }

  try {
    const pdf = await getInvoicePdf(invoiceNumber);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${invoiceNumber}.pdf"`);
    return res.send(pdf);
  } catch (err: any) {
    if (err?.code === 'NoSuchKey' || err?.code === 'NoSuchObject' || err?.code === 'NotFound') {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    console.error('[GET /billing/invoices/:invoiceNumber/pdf] error:', err);
    return res.status(500).json({ error: 'Failed to retrieve invoice PDF' });
  }
});

// All other billing routes require auth
router.use(requireAuth);

// ─── Create checkout session (mock) ──────────────────────────────────────────
// Returns a mock session object consumed by MockStripeCheckout.
// STRIPE MIGRATION: replace body with stripe.checkout.sessions.create(...)

router.post('/checkout', async (req, res) => {
  const { type, targetId } = req.body as { type?: string; targetId?: string };

  if (!type || !['membership', 'community'].includes(type)) {
    return res.status(400).json({ error: 'type must be "membership" or "community"' });
  }
  if (type === 'community' && !targetId) {
    return res.status(400).json({ error: 'targetId (communityId) is required for community payment' });
  }

  const session = {
    id: `mock_${Date.now()}`,
    type,
    targetId: targetId ?? null,
    amount: type === 'community' ? 99900 : 9900,
    currency: 'zar',
    paymentType: type === 'community' ? 'once-off' : 'recurring',
    description:
      type === 'community'
        ? 'Community Activation — R999 once-off'
        : 'Platform Membership — R99/year',
    url: `?checkout=true&type=${type}${targetId ? `&communityId=${targetId}` : ''}`,
  };

  return res.json(session);
});

// ─── Simulate payment (mock webhook) ─────────────────────────────────────────
// Called by MockStripeCheckout after the user taps Pay.
// STRIPE MIGRATION: keep the DB logic below, but trigger via POST /webhook instead.

router.post('/simulate-payment', async (req, res) => {
  const { type, targetId } = req.body as { type?: string; targetId?: string };
  const userId = req.auth!.userId;

  if (!type || !['membership', 'community'].includes(type)) {
    return res.status(400).json({ error: 'type must be "membership" or "community"' });
  }

  try {
    if (type === 'community') {
      if (!targetId) {
        return res.status(400).json({ error: 'targetId is required for community payment' });
      }

      const member = await prisma.communityMember.findFirst({
        where: { communityId: targetId, userId },
      });
      if (!member || !['ADMIN', 'OWNER'].includes(member.role)) {
        return res.status(403).json({ error: 'Only community admins can activate a community' });
      }

      const activatedAt = new Date();
      const owner = await prisma.user.findUnique({
        where: { id: userId },
        select: { trialExpiresAt: true },
      });
      const userUpdate: Record<string, unknown> = {};
      if (!owner?.trialExpiresAt) {
        userUpdate.trialExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
        userUpdate.licenseStatus = 'TRIAL';
      }

      const [community] = await prisma.$transaction([
        prisma.community.update({
          where: { id: targetId },
          data: { type: 'ACTIVE', isPaid: true, activatedAt, status: 'ACTIVE' },
        }),
        prisma.user.update({ where: { id: userId }, data: userUpdate }),
      ]);

      // Post-payment: invoice + email (non-blocking — don't fail the payment response)
      handlePaymentSuccess(userId, 'COMMUNITY', targetId).catch(
        (err) => console.error('[billing] handlePaymentSuccess error:', err),
      );

      return res.json({
        message: 'Community activated permanently',
        status: 'ACTIVE',
        community,
      });
    }

    if (type === 'membership') {
      const renewalDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          licenseStatus: 'ACTIVE',
          subscriptionActive: true,
          subscriptionRenewalDate: renewalDate,
        },
      });

      handlePaymentSuccess(userId, 'MEMBERSHIP').catch(
        (err) => console.error('[billing] handlePaymentSuccess error:', err),
      );

      return res.json({
        message: 'Membership subscription activated',
        status: 'ACTIVE',
        renewalDate: renewalDate.toISOString(),
        user: {
          licenseStatus: user.licenseStatus,
          subscriptionActive: user.subscriptionActive,
          subscriptionRenewalDate: user.subscriptionRenewalDate,
        },
      });
    }
  } catch (err: any) {
    console.error('[POST /billing/simulate-payment] error:', err);
    return res.status(500).json({ error: err?.message ?? 'Payment simulation failed' });
  }
});

// ─── Stripe Webhook (stub — ready for production) ────────────────────────────
// STRIPE MIGRATION:
//   1. Parse raw body: app.use('/api/billing/webhook', express.raw({ type: 'application/json' }))
//   2. Verify signature:
//        const sig = req.headers['stripe-signature'];
//        const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
//   3. Handle events:
//        payment_intent.succeeded → handlePaymentSuccess(userId, type, communityId)
//        invoice.paid             → handlePaymentSuccess(userId, 'MEMBERSHIP')
//        invoice.payment_failed   → sendFailedPaymentEmail(...)
//        customer.subscription.updated → update subscriptionRenewalDate in DB

router.post('/webhook', async (_req, res) => {
  // Stub — no-op until real Stripe integration is enabled
  return res.json({ received: true });
});

// ─── Get invoice list ─────────────────────────────────────────────────────────

router.get('/invoices', async (req, res) => {
  const userId = req.auth!.userId;
  const invoices = await prisma.invoice.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(invoices);
});

// ─── Get billing status ───────────────────────────────────────────────────────

router.get('/status', async (req, res) => {
  const userId = req.auth!.userId;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      licenseStatus: true,
      trialExpiresAt: true,
      subscriptionActive: true,
      subscriptionRenewalDate: true,
      lastCommunityId: true,
    },
  });

  const community = user?.lastCommunityId
    ? await prisma.community.findUnique({
        where: { id: user.lastCommunityId },
        select: { type: true, isPaid: true, trialExpiresAt: true, activatedAt: true },
      })
    : null;

  return res.json({
    membership: {
      licenseStatus: user?.licenseStatus ?? 'TRIAL',
      trialExpiresAt: user?.trialExpiresAt,
      subscriptionActive: user?.subscriptionActive ?? false,
      subscriptionRenewalDate: user?.subscriptionRenewalDate,
    },
    community: community
      ? {
          type: community.type,
          isPaid: community.isPaid,
          trialExpiresAt: community.trialExpiresAt,
          activatedAt: community.activatedAt,
        }
      : null,
  });
});

export default router;
