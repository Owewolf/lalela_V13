import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { queryKeys } from '../../lib/queryKeys';
import type { Charity } from '../../types';

export function useCharitiesQuery(communityId?: string | null) {
  return useQuery({
    queryKey: queryKeys.charities(communityId),
    enabled: Boolean(communityId),
    queryFn: async (): Promise<Charity[]> => {
      const { data } = await api.get(`/communities/${communityId}/charities`);
      return data ?? [];
    },
    initialData: [] as Charity[],
  });
}
