import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { queryKeys } from '../../lib/queryKeys';

export function useCommunityBootstrap(userId?: string | null) {
  return useQuery({
    queryKey: queryKeys.communityBootstrap(userId),
    enabled: Boolean(userId),
    queryFn: async () => {
      const [communitiesRes, conversationsRes] = await Promise.all([
        api.get('/communities'),
        api.get('/conversations'),
      ]);

      const notifications = await api
        .get('/users/me/notifications')
        .then((res) => res.data)
        .catch(() => []);

      return {
        communities: communitiesRes.data ?? [],
        conversations: conversationsRes.data ?? [],
        notifications,
      };
    },
    initialData: { communities: [], conversations: [], notifications: [] },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    retry: 2,
  });
}
