import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { queryKeys } from '../../lib/queryKeys';

export type MemberInsightsSnapshot = {
  totalListings?: number;
  totalNotices?: number;
  totalSuggestions?: number;
  activeListings?: number;
  last30dListings?: number;
  last30dSuggestions?: number;
  topCategories?: string[];
  computedAt?: any;
};

export type MemberRoleHistoryEntry = {
  id: string;
  action: string;
  reason?: string;
  timestamp?: any;
  moderator_id?: string;
};

export function useMemberInsights(communityId?: string | null, userId?: string | null) {
  return useQuery({
    queryKey: queryKeys.memberInsights(communityId, userId),
    enabled: Boolean(communityId && userId),
    queryFn: async () => {
      if (!communityId || !userId) {
        return { profile: null, stats: null, history: [] as MemberRoleHistoryEntry[] };
      }

      const [profileRes, statsRes, historyRes] = await Promise.all([
        api.get(`/users/${userId}/profile`).catch(() => ({ data: null })),
        api.get(`/communities/${communityId}/members/${userId}/stats`).catch(() => ({ data: null })),
        api.get(`/communities/${communityId}/moderation-logs?target_type=user&target_id=${userId}&limit=5`).catch(() => ({ data: [] })),
      ]);

      return {
        profile: profileRes.data ?? null,
        stats: statsRes.data ?? null,
        history: Array.isArray(historyRes.data)
          ? historyRes.data.map((entry: any) => ({ id: entry.id, ...entry }))
          : [],
      };
    },
    initialData: { profile: null, stats: null, history: [] as MemberRoleHistoryEntry[] },
  });
}
