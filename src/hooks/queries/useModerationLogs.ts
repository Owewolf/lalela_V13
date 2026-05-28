import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { queryKeys } from '../../lib/queryKeys';

type ModerationLogParams = {
  limit?: number;
  targetType?: string;
  targetId?: string;
};

export function useModerationLogs(communityId?: string | null, params: ModerationLogParams = {}) {
  return useQuery({
    queryKey: queryKeys.moderationLogs(communityId, params),
    enabled: Boolean(communityId),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.limit != null) searchParams.set('limit', String(params.limit));
      if (params.targetType) searchParams.set('target_type', params.targetType);
      if (params.targetId) searchParams.set('target_id', params.targetId);
      const query = searchParams.toString();
      const { data } = await api.get(`/communities/${communityId}/moderation-logs${query ? `?${query}` : ''}`);
      return Array.isArray(data) ? data : [];
    },
    initialData: [],
  });
}
