import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { queryKeys } from '../../lib/queryKeys';

export function useInvitePreview(code?: string | null) {
  return useQuery({
    queryKey: queryKeys.invitePreview(code),
    enabled: Boolean(code),
    queryFn: async () => {
      if (!code) return null;
      const { data } = await api.get(`/communities/join/${code}`);
      return data ?? null;
    },
    initialData: null,
  });
}
