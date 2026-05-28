import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { queryKeys } from '../../lib/queryKeys';
import type { AppNotification } from '../../types';

export function useNotificationsQuery(userId?: string | null) {
  return useQuery({
    queryKey: queryKeys.notifications(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<AppNotification[]> => {
      const { data } = await api.get('/users/me/notifications');
      return data ?? [];
    },
    initialData: [] as AppNotification[],
  });
}
