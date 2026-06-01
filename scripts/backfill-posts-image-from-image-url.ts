/**
 * One-off listing media backfill.
 *
 * Copies legacy `imageUrl` values into `postsImage` for listing posts where
 * `postsImage` is missing, so listing hero cards can use a single canonical
 * field consistently across Home, Posts, and Market.
 *
 * Usage:
 *   npx tsx scripts/backfill-posts-image-from-image-url.ts         # dry run
 *   npx tsx scripts/backfill-posts-image-from-image-url.ts --apply # apply updates
 */
import 'dotenv/config';
import prisma from '../server/db.js';

async function main() {
  const shouldApply = process.argv.includes('--apply');
  console.log(`[backfill-posts-image] mode=${shouldApply ? 'APPLY' : 'dry-run'}`);

  const candidates = await prisma.post.findMany({
    where: {
      type: 'listing',
      postsImage: null,
      imageUrl: { not: null },
    },
    select: {
      id: true,
      communityId: true,
      imageUrl: true,
      postsImage: true,
      title: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`[backfill-posts-image] candidates=${candidates.length}`);

  let updated = 0;

  for (const post of candidates) {
    const legacyImage = post.imageUrl?.trim();
    if (!legacyImage) continue;

    console.log(
      `[backfill-posts-image] ${shouldApply ? 'update' : 'would-update'} post=${post.id} community=${post.communityId} title=${JSON.stringify(post.title ?? '')}`
    );

    if (shouldApply) {
      await prisma.post.update({
        where: { id: post.id },
        data: { postsImage: legacyImage },
      });
    }

    updated += 1;
  }

  console.log(`[backfill-posts-image] done. updated=${updated}`);
}

main()
  .catch((err) => {
    console.error('[backfill-posts-image] failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
