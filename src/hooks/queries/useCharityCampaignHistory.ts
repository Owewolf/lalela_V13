import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { queryKeys } from '../../lib/queryKeys';
import type { CharityCampaignHistoryItem } from '../../types';

export function useCharityCampaignHistory(communityId?: string | null) {
  return useQuery({
    queryKey: queryKeys.charityCampaignHistory(communityId),
    enabled: Boolean(communityId),
    queryFn: async (): Promise<CharityCampaignHistoryItem[]> => {
      const { data } = await api.get(`/communities/${communityId}/charity-campaigns/history`);
      return Array.isArray(data) ? data : [];
    },
    initialData: [],
  });
}
