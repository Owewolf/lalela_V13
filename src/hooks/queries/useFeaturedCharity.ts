import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { queryKeys } from '../../lib/queryKeys';
import type { FeaturedCharitySummary } from '../../types';

const EMPTY_FEATURED_CHARITY: FeaturedCharitySummary = {
  charityId: null,
  name: null,
  goalAmount: 0,
  potentialEarnings: 0,
  raisedEarnings: 0,
  progressPercentage: 0,
  itemsAvailable: 0,
  itemsSold: 0,
  activeCampaign: false,
  isCATBaseline: false,
  campaignStartedAt: null,
  lifetimeRaised: 0,
  lastUpdated: null,
};

export function useFeaturedCharity(communityId?: string | null) {
  return useQuery({
    queryKey: queryKeys.featuredCharity(communityId),
    enabled: Boolean(communityId),
    queryFn: async (): Promise<FeaturedCharitySummary> => {
      const { data } = await api.get(`/communities/${communityId}/featured-charity`);
      return data ?? EMPTY_FEATURED_CHARITY;
    },
    initialData: EMPTY_FEATURED_CHARITY,
  });
}
