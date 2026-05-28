import prisma from '../db.js';

const CLOSED_POST_STATUSES = new Set([
  'sold',
  'SOLD',
  'deleted',
  'Deleted',
  'expired',
  'Expired',
  'archived',
  'Archived',
]);

type DbClient = any;

function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

async function resolveActiveCharity(tx: DbClient, communityId: string) {
  const [community, charities] = await Promise.all([
    tx.community.findUnique({
      where: { id: communityId },
      select: { catCycleActive: true, catFeaturedCharityId: true },
    }),
    tx.charity.findMany({
      where: { communityId },
      select: {
        id: true,
        name: true,
        fundraisingGoal: true,
        raisedAmount: true,
        isCATCharity: true,
        isFeatured: true,
        status: true,
        createdAt: true,
        currentCampaignStartedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const cat = charities.find((charity) => charity.isCATCharity) ?? null;
  const featured = charities.find((charity) => Boolean(charity.isFeatured) && !charity.isCATCharity) ?? null;
  const pointer = community?.catFeaturedCharityId
    ? charities.find((charity) => charity.id === community.catFeaturedCharityId) ?? null
    : null;

  const activeCharity = community?.catCycleActive
    ? featured ?? pointer ?? cat
    : cat ?? pointer ?? featured;

  return { community, activeCharity };
}

async function loadCampaignTotals(tx: DbClient, communityId: string, charity: { id: string; createdAt: Date; currentCampaignStartedAt?: Date | null; fundraisingGoal?: number | null }) {
  const startedAt = charity.currentCampaignStartedAt ?? charity.createdAt;

  // potential / itemsAvailable are point-in-time: every active public listing
  // currently linked to this charity contributes regardless of when it was
  // created (listings re-point to the active charity on each cycle).
  // raised / itemsSold are cycle-scoped: only transactions since the cycle
  // start count toward the running cycle total.
  const [activeListings, raisedAggregate, soldAggregate] = await Promise.all([
    tx.post.findMany({
      where: {
        communityId,
        type: 'listing',
        charityId: charity.id,
        status: { notIn: [...CLOSED_POST_STATUSES] },
      },
      select: { id: true, charityAmount: true, initialQuantity: true },
    }),
    tx.catTransaction.aggregate({
      where: {
        communityId,
        charityId: charity.id,
        createdAt: { gte: startedAt },
      },
      _sum: { catAmount: true },
    }),
    tx.catTransaction.aggregate({
      where: {
        communityId,
        charityId: charity.id,
        createdAt: { gte: startedAt },
        reversedAt: null,
      },
      _sum: { quantitySold: true },
    }),
  ]);

  // Per-listing sold quantity for unreversed transactions (any time), used to
  // compute remaining inventory per listing so multi-unit listings contribute
  // the FULL potential of all remaining units, not just one unit.
  const listingIds = activeListings.map((listing: { id: string }) => listing.id);
  const soldByPostId = new Map<string, number>();
  if (listingIds.length > 0) {
    const grouped = await tx.catTransaction.groupBy({
      by: ['postId'],
      where: {
        communityId,
        postId: { in: listingIds },
        reversedAt: null,
      },
      _sum: { quantitySold: true },
    });
    for (const row of grouped as Array<{ postId: string; _sum: { quantitySold: number | null } }>) {
      soldByPostId.set(row.postId, toNumber(row?._sum?.quantitySold));
    }
  }

  let potentialEarnings = 0;
  for (const listing of activeListings as Array<{ id: string; charityAmount: number | null; initialQuantity: number | null }>) {
    const unitCharity = toNumber(listing.charityAmount);
    if (unitCharity <= 0) continue;
    const initial = Math.max(1, Math.floor(toNumber(listing.initialQuantity) || 1));
    const sold = Math.max(0, Math.floor(toNumber(soldByPostId.get(listing.id))));
    const remaining = Math.max(0, initial - sold);
    potentialEarnings += unitCharity * remaining;
  }

  const soldCount = toNumber(soldAggregate?._sum?.quantitySold);

  return {
    potentialEarnings,
    raisedEarnings: toNumber(raisedAggregate?._sum?.catAmount),
    itemsAvailable: activeListings.length,
    itemsSold: soldCount,
    campaignStartedAt: startedAt,
    goalAmount: toNumber(charity.fundraisingGoal),
  };
}

async function loadCommunityLifetimeRaised(tx: DbClient, communityId: string) {
  // Community lifetime raised = sum of every CAT transaction in the community
  // ever, across CAT baseline AND every featured charity that has run a cycle.
  const aggregate = await tx.catTransaction.aggregate({
    where: { communityId },
    _sum: { catAmount: true },
  });
  return toNumber(aggregate?._sum?.catAmount);
}

export async function getActiveCharityForCommunity(
  tx: DbClient,
  communityId: string,
): Promise<{ id: string; isCATCharity: boolean } | null> {
  const { activeCharity } = await resolveActiveCharity(tx, communityId);
  return activeCharity
    ? { id: activeCharity.id, isCATCharity: Boolean(activeCharity.isCATCharity) }
    : null;
}

export async function getFeaturedCharitySummary(communityId: string, tx: DbClient = prisma) {
  const { community, activeCharity } = await resolveActiveCharity(tx, communityId);

  const lifetimeRaised = community
    ? await loadCommunityLifetimeRaised(tx, communityId)
    : 0;

  if (!community || !activeCharity) {
    return {
      charityId: null,
      name: null,
      goalAmount: 0,
      potentialEarnings: 0,
      raisedEarnings: 0,
      progressPercentage: 0,
      itemsAvailable: 0,
      itemsSold: 0,
      activeCampaign: Boolean(community?.catCycleActive),
      isCATBaseline: false,
      campaignStartedAt: null,
      lifetimeRaised,
      lastUpdated: new Date(),
    };
  }

  const totals = await loadCampaignTotals(tx, communityId, activeCharity);
  const progressPercentage = totals.goalAmount > 0
    ? Math.min(100, Math.round((totals.raisedEarnings / totals.goalAmount) * 100))
    : 0;

  return {
    charityId: activeCharity.id,
    name: activeCharity.name,
    goalAmount: totals.goalAmount,
    potentialEarnings: totals.potentialEarnings,
    raisedEarnings: totals.raisedEarnings,
    progressPercentage,
    itemsAvailable: totals.itemsAvailable,
    itemsSold: totals.itemsSold,
    activeCampaign: Boolean(community.catCycleActive),
    isCATBaseline: Boolean(activeCharity.isCATCharity),
    campaignStartedAt: totals.campaignStartedAt,
    lifetimeRaised,
    lastUpdated: new Date(),
  };
}

export async function getCommunityCharityTotals(communityId: string, tx: DbClient = prisma) {
  const [community, charities] = await Promise.all([
    tx.community.findUnique({
      where: { id: communityId },
      select: { id: true },
    }),
    tx.charity.findMany({
      where: { communityId },
      select: {
        id: true,
        name: true,
        isCATCharity: true,
        fundraisingGoal: true,
        createdAt: true,
        currentCampaignStartedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  if (!community) {
    return [];
  }

  const lifetimeRaised = await loadCommunityLifetimeRaised(tx, communityId);

  return Promise.all(
    charities.map(async (charity) => {
      const totals = await loadCampaignTotals(tx, communityId, charity);
      const progressPercentage = totals.goalAmount > 0
        ? Math.min(100, Math.round((totals.raisedEarnings / totals.goalAmount) * 100))
        : 0;

      return {
        charityId: charity.id,
        name: charity.name,
        isCATCharity: Boolean(charity.isCATCharity),
        goalAmount: totals.goalAmount,
        potentialEarnings: totals.potentialEarnings,
        raisedEarnings: totals.raisedEarnings,
        progressPercentage,
        itemsAvailable: totals.itemsAvailable,
        itemsSold: totals.itemsSold,
        campaignStartedAt: totals.campaignStartedAt,
        lifetimeRaised,
        lastUpdated: new Date(),
      };
    }),
  );
}

async function createCampaignSnapshot(tx: DbClient, params: {
  communityId: string;
  charityId: string;
  reason: string;
}) {
  const charity = await tx.charity.findUnique({
    where: { id: params.charityId },
    select: {
      id: true,
      fundraisingGoal: true,
      createdAt: true,
      currentCampaignStartedAt: true,
    },
  });

  if (!charity) return null;

  const totals = await loadCampaignTotals(tx, params.communityId, {
    id: charity.id,
    createdAt: charity.createdAt,
    currentCampaignStartedAt: charity.currentCampaignStartedAt,
    fundraisingGoal: charity.fundraisingGoal,
  });

  return tx.charityCampaignSnapshot.create({
    data: {
      communityId: params.communityId,
      charityId: params.charityId,
      startedAt: charity.currentCampaignStartedAt ?? charity.createdAt,
      endedAt: new Date(),
      goalAmount: totals.goalAmount,
      finalRaised: totals.raisedEarnings,
      finalPotential: totals.potentialEarnings,
      itemsSold: totals.itemsSold,
      reason: params.reason,
    },
  });
}

export async function rotateFeaturedCharityCampaign(
  communityId: string,
  params: {
    active: boolean;
    featuredCharityId?: string | null;
    reason: string;
  },
  tx: DbClient = prisma,
) {
  const community = await tx.community.findUnique({
    where: { id: communityId },
    select: { catCycleActive: true, catFeaturedCharityId: true },
  });

  if (!community) {
    return null;
  }

  const catCharity = await tx.charity.findFirst({
    where: {
      communityId,
      isCATCharity: true,
      NOT: { status: { in: ['Archived', 'ARCHIVED'] } },
    },
    select: { id: true, isCATCharity: true, createdAt: true, currentCampaignStartedAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const currentActive = community.catCycleActive
    ? (community.catFeaturedCharityId
      ? await tx.charity.findFirst({
        where: { id: community.catFeaturedCharityId, communityId },
        select: { id: true, isCATCharity: true, createdAt: true, currentCampaignStartedAt: true },
      })
      : null)
    : catCharity;

  const targetCharity = params.active && params.featuredCharityId
    ? await tx.charity.findFirst({
      where: { id: params.featuredCharityId, communityId },
      select: { id: true, isCATCharity: true, createdAt: true, currentCampaignStartedAt: true },
    })
    : catCharity;

  if (!targetCharity) {
    throw new Error('Target charity not found');
  }

  const outgoingId = currentActive?.id;
  const incomingId = targetCharity.id;

  if (outgoingId && outgoingId === incomingId) {
    const updatedCommunity = await tx.community.update({
      where: { id: communityId },
      data: {
        catCycleActive: params.active,
        catFeaturedCharityId: incomingId,
      },
    });
    return {
      community: updatedCommunity,
      closedSnapshot: null,
    };
  }

  let closedSnapshot: any = null;
  if (outgoingId && outgoingId !== incomingId) {
    // Snapshot the outgoing cycle (CAT or featured) before resetting it so
    // the community keeps a per-cycle history. CAT runs two totals: each
    // cycle is snapshotted here, lifetime is derived from CatTransaction.
    closedSnapshot = await createCampaignSnapshot(tx, {
      communityId,
      charityId: outgoingId,
      reason: params.reason,
    });

    await tx.charity.update({
      where: { id: outgoingId },
      data: { raisedAmount: 0 },
    });
  }

  // Reset cycle window on the incoming charity (CAT or featured).
  await tx.charity.update({
    where: { id: incomingId },
    data: { currentCampaignStartedAt: new Date(), raisedAmount: 0 },
  });

  // Re-point every active listing to the incoming active charity so the
  // cycle's potential pool reflects the live marketplace state.
  if (outgoingId !== incomingId) {
    await tx.post.updateMany({
      where: {
        communityId,
        type: 'listing',
        status: { notIn: [...CLOSED_POST_STATUSES] },
      },
      data: { charityId: incomingId },
    });
  }

  const updatedCommunity = await tx.community.update({
    where: { id: communityId },
    data: {
      catCycleActive: params.active,
      catFeaturedCharityId: incomingId,
    },
  });

  return {
    community: updatedCommunity,
    closedSnapshot,
  };
}