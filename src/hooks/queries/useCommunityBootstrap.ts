import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { queryKeys } from '../../lib/queryKeys';

export function useCommunityBootstrap(userId?: string | null) {
  return useQuery({
    queryKey: queryKeys.communityBootstrap(userId),
    enabled: Boolean(userId),
    queryFn: async () => {
      const [commRes, convRes, notifRes] = await Promise.allSettled([
        api.get('/communities'),
        api.get('/conversations'),
        api.get('/users/me/notifications'),
      ]);

      return {
        communities: commRes.status === 'fulfilled' ? commRes.value.data : [],
        conversations: convRes.status === 'fulfilled' ? convRes.value.data : [],
        notifications: notifRes.status === 'fulfilled' ? notifRes.value.data : [],
      };
    },
    initialData: { communities: [], conversations: [], notifications: [] },
  });
}
