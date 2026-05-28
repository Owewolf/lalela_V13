import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { queryKeys } from '../../lib/queryKeys';
import type { UserBusiness } from '../../types';

export function useBusinessesQuery(communityId?: string | null, ownerId?: string | null) {
  return useQuery({
    queryKey: queryKeys.businesses(communityId, ownerId),
    queryFn: async (): Promise<UserBusiness[]> => {
      const { data } = await api.get('/businesses');
      const businesses = (data ?? []) as UserBusiness[];
      return businesses.filter((business) => {
        const communityMatch = communityId ? (business.communityIds ?? []).includes(communityId) : true;
        const ownerMatch = ownerId ? business.ownerId === ownerId : true;
        return communityMatch && ownerMatch;
      });
    },
    initialData: [] as UserBusiness[],
  });
}
