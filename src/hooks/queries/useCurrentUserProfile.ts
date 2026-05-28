import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { queryKeys } from '../../lib/queryKeys';
import type { UserProfile } from '../../types';

export function useCurrentUserProfile() {
  return useQuery({
    queryKey: queryKeys.currentUserProfile(),
    enabled: false,
    queryFn: async (): Promise<UserProfile> => {
      const { data } = await api.get('/users/me');
      return data;
    },
  });
}