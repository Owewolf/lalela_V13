import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { queryKeys } from '../../lib/queryKeys';
import type { CharityTotalsItem } from '../../types';

export function useCharityTotals(communityId?: string | null) {
  return useQuery({
    queryKey: queryKeys.charityTotals(communityId),
    enabled: Boolean(communityId),
    queryFn: async (): Promise<CharityTotalsItem[]> => {
      const { data } = await api.get(`/communities/${communityId}/charities/totals`);
      return Array.isArray(data) ? data : [];
    },
    initialData: [],
  });
}
