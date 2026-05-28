import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { queryKeys } from '../../lib/queryKeys';
import type { CommunityMember } from '../../types';

export function useMembersQuery(communityId?: string | null) {
  return useQuery({
    queryKey: queryKeys.members(communityId),
    enabled: Boolean(communityId),
    queryFn: async (): Promise<CommunityMember[]> => {
      const { data } = await api.get(`/communities/${communityId}/members`);
      return data ?? [];
    },
    initialData: [] as CommunityMember[],
  });
}
