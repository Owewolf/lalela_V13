import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { queryKeys } from '../../lib/queryKeys';

export function useCommunityBundle(communityId?: string | null, userId?: string | null) {
  return useQuery({
    queryKey: queryKeys.communityBundle(communityId),
    enabled: Boolean(communityId && userId),
    queryFn: async () => {
      if (!communityId || !userId) {
        return {
          members: [],
          posts: [],
          charities: [],
          charitySuggestions: [],
          businesses: [],
          locations: { members: [], security: [] },
        };
      }

      const [membersRes, postsRes, charitiesRes, charitySuggestionsRes, bizRes, locRes] = await Promise.allSettled([
        api.get(`/communities/${communityId}/members`),
        api.get(`/communities/${communityId}/posts`),
        api.get(`/communities/${communityId}/charities`),
        api.get(`/communities/${communityId}/charity-suggestions`),
        api.get('/businesses'),
        api.get(`/communities/${communityId}/locations`),
      ]);

      return {
        members: membersRes.status === 'fulfilled' ? membersRes.value.data : [],
        posts: postsRes.status === 'fulfilled' ? postsRes.value.data : [],
        charities: charitiesRes.status === 'fulfilled' ? charitiesRes.value.data : [],
        charitySuggestions: charitySuggestionsRes.status === 'fulfilled' ? charitySuggestionsRes.value.data : [],
        businesses: bizRes.status === 'fulfilled' ? bizRes.value.data : [],
        locations: locRes.status === 'fulfilled' ? locRes.value.data : { members: [], security: [] },
      };
    },
    initialData: {
      members: [], posts: [], charities: [], charitySuggestions: [], businesses: [], locations: { members: [], security: [] },
    },
  });
}
