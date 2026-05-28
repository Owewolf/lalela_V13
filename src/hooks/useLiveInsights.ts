import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { queryKeys } from '../lib/queryKeys';

export type CommunityEnergy = 'QUIET' | 'MEDIUM' | 'ACTIVE' | 'HIGH';

export type LiveFeedItem = {
  id: string;
  kind: 'post' | 'join' | 'business' | 'donation';
  icon: string;
  message: string;
  timestamp: string;
};

export interface LiveInsightsCounts {
  postsLast24h: number;
  newMembersLast7d: number;
  alertsActive: number;
  alertsResolved24h: number;
  donationsTotal: number;
  donationsLast24h: number;
  businessesAdded7d: number;
  respondersOnline: number;
  moderatorsOnline: number;
  activeReports: number;
}

export interface LiveInsightsData {
  energy: CommunityEnergy;
  counts: LiveInsightsCounts;
  feed: LiveFeedItem[];
  insights: {
    mostActiveArea: string | null;
    topCategory: string | null;
    activeVolunteers: number;
    engagementScore: number;
  };
}

const POLL_INTERVAL_MS = 30_000;

export function useLiveInsights(communityId: string | undefined | null) {
  const query = useQuery({
    queryKey: queryKeys.liveInsights(communityId),
    enabled: Boolean(communityId && communityId !== 'loading'),
    queryFn: async (): Promise<LiveInsightsData> => {
      const { data } = await api.get(`/communities/${communityId}/live-insights`);
      return data;
    },
    refetchInterval: POLL_INTERVAL_MS,
    retry: 1,
  });

  return {
    data: query.data ?? null,
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    refresh: query.refetch,
  };
}
