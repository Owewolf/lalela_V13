import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { queryKeys } from '../../lib/queryKeys';
import type { Conversation } from '../../types';

export function useConversationsQuery(userId?: string | null) {
  return useQuery({
    queryKey: queryKeys.conversations(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<Conversation[]> => {
      const { data } = await api.get('/conversations');
      return data ?? [];
    },
    initialData: [] as Conversation[],
  });
}
