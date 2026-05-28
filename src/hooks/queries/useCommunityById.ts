import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { queryKeys } from '../../lib/queryKeys';

export function useCommunityById(communityId?: string | null) {
  return useQuery({
    queryKey: queryKeys.communityById(communityId),
    enabled: Boolean(communityId),
    queryFn: async () => {
      if (!communityId) return null;
      const { data } = await api.get(`/communities/${communityId}`);
      return data ?? null;
    },
    initialData: null,
  });
}
