import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { queryKeys } from '../../lib/queryKeys';
import type { LiveInsightsData } from '../useLiveInsights';

const POLL_INTERVAL_MS = 30_000;

export function useLiveInsightsQuery(communityId?: string | null) {
  return useQuery({
    queryKey: queryKeys.liveInsights(communityId),
    enabled: Boolean(communityId && communityId !== 'loading'),
    queryFn: async (): Promise<LiveInsightsData> => {
      const { data } = await api.get(`/communities/${communityId}/live-insights`);
      return data;
    },
    refetchInterval: POLL_INTERVAL_MS,
    retry: 1,
  });
}
