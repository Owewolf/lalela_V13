import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { queryKeys } from '../../lib/queryKeys';
import type { CatHubSummary } from '../../types';

const EMPTY_CAT_HUB: CatHubSummary = {
  totalCATGenerated: 0,
  totalRaisedForCharity: 0,
  catCycleActive: false,
  activeCycleCharity: null,
  recentTransactions: [],
  featuredCharity: undefined,
};

export function useCatHub(communityId?: string | null) {
  return useQuery({
    queryKey: queryKeys.catHub(communityId),
    enabled: Boolean(communityId),
    queryFn: async (): Promise<CatHubSummary> => {
      const { data } = await api.get(`/communities/${communityId}/cat-hub`);
      return data ?? EMPTY_CAT_HUB;
    },
    initialData: EMPTY_CAT_HUB,
  });
}
