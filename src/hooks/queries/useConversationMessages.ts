import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { queryKeys } from '../../lib/queryKeys';

export function useConversationMessages(conversationId?: string | null) {
  return useQuery({
    queryKey: queryKeys.conversationMessages(conversationId),
    enabled: Boolean(conversationId),
    queryFn: async () => {
      if (!conversationId) return [];
      const { data } = await api.get(`/conversations/${conversationId}/messages`);
      return Array.isArray(data) ? data : [];
    },
    initialData: [],
  });
}
