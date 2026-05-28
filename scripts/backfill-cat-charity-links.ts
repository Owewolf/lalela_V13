/**
 * One-off backfill for the CAT-always-active simplification.
 *
 * For every community:
 *  1. Ensure a CAT baseline charity exists (auto-seed if missing). Older
 *     communities predating the CAT seed logic will be healed here.
 *  2. For every public listing in the community whose charityId is NULL,
 *     link it to the community's currently-active charity (CAT by default,
 *     the featured charity when a CAT cycle is on) so it contributes to
 *     the active charity's potential pool under the new aggregation rules.
 *
 * Usage:
 *   npx tsx scripts/backfill-cat-charity-links.ts         # dry run
 *   npx tsx scripts/backfill-cat-charity-links.ts --apply # apply updates
 */
import 'dotenv/config';
import prisma from '../server/db.js';

const CLOSED_POST_STATUSES = [
  'sold', 'SOLD',
  'deleted', 'Deleted',
  'expired', 'Expired',
  'archived', 'Archived',
];

async function main() {
  const shouldApply = process.argv.includes('--apply');
  console.log(`[backfill-cat] mode=${shouldApply ? 'APPLY' : 'dry-run'}`);

  const communities = await prisma.community.findMany({
    select: { id: true, name: true, catCycleActive: true, catFeaturedCharityId: true, createdAt: true },
  });

  let totalSeeded = 0;
  let totalRelinked = 0;

  for (const community of communities) {
    let cat = await prisma.charity.findFirst({
      where: { communityId: community.id, isCATCharity: true },
      select: { id: true, currentCampaignStartedAt: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!cat) {
      console.log(`[backfill-cat] community ${community.id} (${community.name}) missing CAT charity`);
      if (shouldApply) {
        cat = await prisma.charity.create({
          data: {
            communityId: community.id,
            name: 'CAT',
            description: 'Community Assistance Tax baseline charity',
            percentage: 15,
            status: 'ACTIVE',
            isFeatured: true,
            isCATCharity: true,
            isVerified: true,
            currentCampaignStartedAt: community.createdAt ?? new Date(),
          } as any,
          select: { id: true, currentCampaignStartedAt: true, createdAt: true },
        });
      }
      totalSeeded += 1;
    } else if (!cat.currentCampaignStartedAt) {
      console.log(`[backfill-cat] community ${community.id} CAT missing currentCampaignStartedAt`);
      if (shouldApply) {
        await prisma.charity.update({
          where: { id: cat.id },
          data: { currentCampaignStartedAt: cat.createdAt ?? new Date() },
        });
      }
    }

    if (!cat) continue;

    // Active charity = featured when CAT cycle is on, else CAT itself.
    let activeCharityId = cat.id;
    if (community.catCycleActive && community.catFeaturedCharityId) {
      const featured = await prisma.charity.findFirst({
        where: { id: community.catFeaturedCharityId, communityId: community.id },
        select: { id: true },
      });
      if (featured) activeCharityId = featured.id;
    }

    const orphanCount = await prisma.post.count({
      where: {
        communityId: community.id,
        type: 'listing',
        charityId: null,
        status: { notIn: CLOSED_POST_STATUSES },
      },
    });

    if (orphanCount > 0) {
      console.log(`[backfill-cat] community ${community.id} relink ${orphanCount} orphan listings -> charity ${activeCharityId}`);
      if (shouldApply) {
        const result = await prisma.post.updateMany({
          where: {
            communityId: community.id,
            type: 'listing',
            charityId: null,
            status: { notIn: CLOSED_POST_STATUSES },
          },
          data: { charityId: activeCharityId },
        });
        totalRelinked += result.count;
      } else {
        totalRelinked += orphanCount;
      }
    }
  }

  console.log(`[backfill-cat] done. communities=${communities.length} seeded=${totalSeeded} relinked=${totalRelinked}`);
}

main()
  .catch((err) => {
    console.error('[backfill-cat] failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
