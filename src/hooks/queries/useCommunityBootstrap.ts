import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { resolveMediaUrl } from '../../lib/config';
import { queryKeys } from '../../lib/queryKeys';

export function useCommunityBootstrap(userId?: string | null) {
  const INITIAL_CONVERSATION_PAGE_SIZE = 40;

  return useQuery({
    queryKey: queryKeys.communityBootstrap(userId),
    enabled: Boolean(userId),
    queryFn: async () => {
      const [communitiesRes, conversationsRes, notifications] = await Promise.all([
        api.get('/communities'),
        api.get('/conversations', { params: { limit: INITIAL_CONVERSATION_PAGE_SIZE } }),
        api
          .get('/users/me/notifications')
          .then((res) => res.data)
          .catch(() => []),
      ]);

      return {
        communities: communitiesRes.data ?? [],
        conversations: (conversationsRes.data ?? []).map((conversation: any) => ({
          ...conversation,
          otherParticipant: conversation?.otherParticipant
            ? {
                ...conversation.otherParticipant,
                profileImage:
                  resolveMediaUrl(conversation.otherParticipant.profileImage)
                  ?? conversation.otherParticipant.profileImage,
              }
            : conversation?.otherParticipant,
        })),
        notifications,
      };
    },
    initialData: { communities: [], conversations: [], notifications: [] },
    staleTime: 60_000,
    refetchOnMount: false,
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
    retry: 2,
  });
}
