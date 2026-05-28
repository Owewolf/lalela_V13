import prisma from '../db.js';
import { rotateFeaturedCharityCampaign } from './featuredCharity.js';

type DbClient = any;

type CycleReason =
  | 'cycle_to_other_featured'
  | 'cycle_to_cat'
  | 'charity_replaced'
  | 'manual_complete'
  | string;

interface CycleFeaturedCharityParams {
  toCharityId?: string | null;
  toCatBaseline?: boolean;
  reason: CycleReason;
}

export async function cycleFeaturedCharity(
  communityId: string,
  params: CycleFeaturedCharityParams,
  tx: DbClient = prisma,
) {
  const toCatBaseline = Boolean(params.toCatBaseline);

  let featuredCharityId = params.toCharityId ?? null;
  if (toCatBaseline) {
    const catBaseline = await tx.charity.findFirst({
      where: {
        communityId,
        isCATCharity: true,
        NOT: { status: { in: ['Archived', 'ARCHIVED'] } },
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!catBaseline) {
      throw new Error('CAT baseline charity not found');
    }

    featuredCharityId = catBaseline.id;
  }

  const active = !toCatBaseline;
  if (active && !featuredCharityId) {
    throw new Error('toCharityId is required when cycling to featured charity');
  }

  return rotateFeaturedCharityCampaign(
    communityId,
    {
      active,
      featuredCharityId,
      reason: params.reason,
    },
    tx,
  );
}
