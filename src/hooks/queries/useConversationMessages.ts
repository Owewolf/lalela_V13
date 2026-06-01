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
    staleTime: 30_000,
    gcTime: 30 * 60 * 1000,
  });
}

export async function prefetchConversationMessages(queryClient: import('@tanstack/react-query').QueryClient, conversationId: string) {
  await queryClient.prefetchQuery({
    queryKey: queryKeys.conversationMessages(conversationId),
    queryFn: async () => {
      const { data } = await api.get(`/conversations/${conversationId}/messages`);
      return Array.isArray(data) ? data : [];
    },
    staleTime: 30_000,
  });
}
