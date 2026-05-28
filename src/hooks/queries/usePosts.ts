import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { queryKeys } from '../../lib/queryKeys';
import type { CommunityNotice } from '../../types';

export function usePostsQuery(communityId?: string | null) {
  return useQuery({
    queryKey: queryKeys.posts(communityId),
    enabled: Boolean(communityId),
    queryFn: async (): Promise<CommunityNotice[]> => {
      const { data } = await api.get(`/communities/${communityId}/posts`);
      return data ?? [];
    },
    initialData: [] as CommunityNotice[],
  });
}
