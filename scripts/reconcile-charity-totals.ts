import 'dotenv/config';
import prisma from '../server/db.js';

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const apply = args.has('--apply');
  const communityIdArg = process.argv.find((arg) => arg.startsWith('--community='));
  const communityFilter = communityIdArg ? communityIdArg.split('=')[1] : null;

  const charities = await prisma.charity.findMany({
    where: {
      ...(communityFilter ? { communityId: communityFilter } : {}),
      isCATCharity: false,
      NOT: { status: { in: ['Archived', 'ARCHIVED'] } },
    },
    select: {
      id: true,
      name: true,
      communityId: true,
      raisedAmount: true,
      createdAt: true,
      currentCampaignStartedAt: true,
    },
    orderBy: [{ communityId: 'asc' }, { createdAt: 'asc' }],
  });

  let driftCount = 0;
  let reconciledCount = 0;

  for (const charity of charities) {
    const startedAt = charity.currentCampaignStartedAt ?? charity.createdAt;
    const raisedAggregate = await prisma.catTransaction.aggregate({
      where: {
        communityId: charity.communityId,
        charityId: charity.id,
        createdAt: { gte: startedAt },
      },
      _sum: { catAmount: true },
    });

    const expectedRaised = toNumber(raisedAggregate._sum.catAmount);
    const cachedRaised = toNumber(charity.raisedAmount);
    const drift = Math.round((cachedRaised - expectedRaised) * 100) / 100;

    if (drift !== 0) {
      driftCount += 1;
      console.log(
        [
          `[DRIFT] community=${charity.communityId}`,
          `charity=${charity.id}`,
          `name="${charity.name}"`,
          `cached=${cachedRaised.toFixed(2)}`,
          `expected=${expectedRaised.toFixed(2)}`,
          `delta=${drift.toFixed(2)}`,
        ].join(' '),
      );

      if (apply) {
        await prisma.charity.update({
          where: { id: charity.id },
          data: { raisedAmount: expectedRaised },
        });
        reconciledCount += 1;
      }
    }
  }

  console.log('---');
  console.log(`Charities scanned: ${charities.length}`);
  console.log(`Drift detected: ${driftCount}`);
  console.log(`Mode: ${apply ? 'apply' : 'dry-run'}`);
  if (apply) {
    console.log(`Rows updated: ${reconciledCount}`);
  }
}

main()
  .catch((error) => {
    console.error('[reconcile-charity-totals] failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
