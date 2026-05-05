/**
 * Cron jobs — daily expiry and renewal reminders.
 * Runs at 08:00 every day.
 *
 * Community trial expiry:  [7, 3, 1] days before trialExpiresAt
 * Member trial expiry:     [30, 7, 1] days before trialExpiresAt
 * Subscription renewal:    [30, 7, 1] days before subscriptionRenewalDate
 *
 * Uses startOfDay/endOfDay windows to prevent duplicate sends on the same day.
 */
import cron from 'node-cron';
import {
  sendTrialExpiryEmail,
  sendRenewalReminderEmail,
} from '../services/emailService.js';
import type { PrismaClient } from '../generated/prisma/index.js';

// ─── Date helpers ─────────────────────────────────────────────────────────────

function targetDayWindow(daysAhead: number): { gte: Date; lt: Date } {
  const now = new Date();
  const target = new Date(now);
  target.setDate(target.getDate() + daysAhead);

  const start = new Date(target);
  start.setHours(0, 0, 0, 0);
  const end = new Date(target);
  end.setHours(23, 59, 59, 999);

  return { gte: start, lt: end };
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────

async function runCommunityTrialExpiryReminders(prisma: PrismaClient) {
  const DAYS = [7, 3, 1];

  for (const daysLeft of DAYS) {
    const window = targetDayWindow(daysLeft);

    const communities = await prisma.community.findMany({
      where: {
        type: 'TRIAL',
        trialExpiresAt: window,
      },
      include: {
        owner: { select: { email: true, name: true } },
      },
    });

    for (const community of communities) {
      if (!community.trialExpiresAt) continue;
      try {
        await sendTrialExpiryEmail({
          to: community.owner.email,
          name: community.owner.name,
          type: 'COMMUNITY',
          daysLeft,
          expiresAt: community.trialExpiresAt,
        });
        console.log(`[cron] community trial expiry (${daysLeft}d) sent to ${community.owner.email}`);
      } catch (err) {
        console.error(`[cron] failed sending community trial expiry to ${community.owner.email}:`, err);
      }
    }
  }
}

async function runMemberTrialExpiryReminders(prisma: PrismaClient) {
  const DAYS = [30, 7, 1];

  for (const daysLeft of DAYS) {
    const window = targetDayWindow(daysLeft);

    const users = await prisma.user.findMany({
      where: {
        licenseStatus: 'TRIAL',
        trialExpiresAt: window,
        deleted: false,
      },
      select: { email: true, name: true, trialExpiresAt: true },
    });

    for (const user of users) {
      if (!user.trialExpiresAt) continue;
      try {
        await sendTrialExpiryEmail({
          to: user.email,
          name: user.name,
          type: 'MEMBERSHIP',
          daysLeft,
          expiresAt: user.trialExpiresAt,
        });
        console.log(`[cron] member trial expiry (${daysLeft}d) sent to ${user.email}`);
      } catch (err) {
        console.error(`[cron] failed sending member trial expiry to ${user.email}:`, err);
      }
    }
  }
}

async function runRenewalReminders(prisma: PrismaClient) {
  const DAYS = [30, 7, 1];
  const AMOUNT = 9900; // R99/year in cents

  for (const daysLeft of DAYS) {
    const window = targetDayWindow(daysLeft);

    const users = await prisma.user.findMany({
      where: {
        subscriptionActive: true,
        subscriptionRenewalDate: window,
        deleted: false,
      },
      select: { email: true, name: true, subscriptionRenewalDate: true },
    });

    for (const user of users) {
      if (!user.subscriptionRenewalDate) continue;
      try {
        await sendRenewalReminderEmail({
          to: user.email,
          name: user.name,
          renewalDate: user.subscriptionRenewalDate,
          daysLeft,
          amount: AMOUNT,
        });
        console.log(`[cron] renewal reminder (${daysLeft}d) sent to ${user.email}`);
      } catch (err) {
        console.error(`[cron] failed sending renewal reminder to ${user.email}:`, err);
      }
    }
  }
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export function startCronJobs(prisma: PrismaClient) {
  // Daily at 08:00
  cron.schedule('0 8 * * *', async () => {
    console.log('[cron] running daily billing reminders...');
    try {
      await Promise.allSettled([
        runCommunityTrialExpiryReminders(prisma),
        runMemberTrialExpiryReminders(prisma),
        runRenewalReminders(prisma),
      ]);
      console.log('[cron] daily billing reminders complete');
    } catch (err) {
      console.error('[cron] daily billing reminders error:', err);
    }
  });

  console.log('[cron] billing reminder jobs scheduled (daily 08:00)');
}
