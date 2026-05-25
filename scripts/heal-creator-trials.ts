/**
 * One-off data heal for creators who were incorrectly assigned a 30-day
 * platform trial when creating a community.
 *
 * Usage:
 *   npx tsx scripts/heal-creator-trials.ts         # dry run
 *   npx tsx scripts/heal-creator-trials.ts --apply # apply updates
 */
import 'dotenv/config';
import prisma from '../server/db.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const SHORT_TRIAL_THRESHOLD_DAYS = 60;
const CREATOR_PLATFORM_TRIAL_DAYS = 365;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

async function main() {
  const shouldApply = process.argv.includes('--apply');

  const candidates = await prisma.user.findMany({
    where: {
      communityCreated: true,
      licenseStatus: 'TRIAL',
      trialExpiresAt: { not: null },
    },
    select: {
      id: true,
      createdAt: true,
      trialExpiresAt: true,
      licenseStatus: true,
      communityCreated: true,
    },
  });

  const toFix = candidates
    .filter((user) => {
      if (!user.trialExpiresAt) return false;
      const shortThreshold = addDays(user.createdAt, SHORT_TRIAL_THRESHOLD_DAYS);
      return user.trialExpiresAt <= shortThreshold;
    })
    .map((user) => {
      const targetTrialEnd = addDays(user.createdAt, CREATOR_PLATFORM_TRIAL_DAYS);
      return {
        id: user.id,
        currentTrialEnd: user.trialExpiresAt as Date,
        targetTrialEnd,
      };
    })
    .filter((u) => u.targetTrialEnd > u.currentTrialEnd);

  console.log(`[heal-creator-trials] candidates: ${candidates.length}`);
  console.log(`[heal-creator-trials] fixes needed: ${toFix.length}`);

  if (!toFix.length) {
    console.log('[heal-creator-trials] nothing to fix');
    return;
  }

  if (!shouldApply) {
    console.log('[heal-creator-trials] dry run mode. Re-run with --apply to persist updates.');
    for (const row of toFix.slice(0, 20)) {
      console.log(`- ${row.id}: ${row.currentTrialEnd.toISOString()} -> ${row.targetTrialEnd.toISOString()}`);
    }
    if (toFix.length > 20) {
      console.log(`[heal-creator-trials] ... ${toFix.length - 20} more`);
    }
    return;
  }

  let updated = 0;
  for (const row of toFix) {
    await prisma.user.update({
      where: { id: row.id },
      data: {
        trialExpiresAt: row.targetTrialEnd,
        licenseStatus: 'TRIAL',
      },
    });
    updated += 1;
  }

  console.log(`[heal-creator-trials] updated: ${updated}`);
}

main()
  .catch((err) => {
    console.error('[heal-creator-trials] failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
