import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { resolveMediaUrl } from '../../lib/config';
import { queryKeys } from '../../lib/queryKeys';
import type { CommunityMember } from '../../types';

export function useMembersQuery(communityId?: string | null) {
  return useQuery({
    queryKey: queryKeys.members(communityId),
    enabled: Boolean(communityId),
    queryFn: async (): Promise<CommunityMember[]> => {
      const { data } = await api.get(`/communities/${communityId}/members`);
      return (data ?? []).map((member: CommunityMember) => ({
        ...member,
        image: resolveMediaUrl(member.image) ?? member.image,
      }));
    },
    initialData: [] as CommunityMember[],
  });
}
