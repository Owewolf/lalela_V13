import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { resolveMediaUrl } from '../../lib/config';
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

      const [membersRes, postsRes, charitiesRes] = await Promise.all([
        api.get(`/communities/${communityId}/members`),
        api.get(`/communities/${communityId}/posts`),
        api.get(`/communities/${communityId}/charities`),
      ]);

      const [charitySuggestions, businesses, locations] = await Promise.all([
        api.get(`/communities/${communityId}/charity-suggestions`).then((res) => res.data).catch(() => []),
        api.get('/businesses').then((res) => res.data).catch(() => []),
        api.get(`/communities/${communityId}/locations`).then((res) => res.data).catch(() => ({ members: [], security: [] })),
      ]);

      return {
        members: (membersRes.data ?? []).map((member: any) => ({
          ...member,
          image: resolveMediaUrl(member?.image) ?? member?.image,
        })),
        posts: (postsRes.data ?? []).map((post: any) => {
          const listingImage = post?.type === 'listing'
            ? (post?.postsImage ?? post?.imageUrl ?? null)
            : (post?.postsImage ?? null);
          const normalizedAuthorImage = resolveMediaUrl(post?.authorImage ?? null) ?? post?.authorImage ?? null;
          return {
            ...post,
            postsImage: resolveMediaUrl(listingImage) ?? listingImage,
            authorImage: normalizedAuthorImage,
          };
        }),
        charities: charitiesRes.data ?? [],
        charitySuggestions,
        businesses,
        locations: {
          members: (locations?.members ?? []).map((row: any) => ({
            ...row,
            image: resolveMediaUrl(row?.image) ?? row?.image,
          })),
          security: (locations?.security ?? []).map((row: any) => ({
            ...row,
            image: resolveMediaUrl(row?.image) ?? row?.image,
          })),
        },
      };
    },
    initialData: {
      members: [], posts: [], charities: [], charitySuggestions: [], businesses: [], locations: { members: [], security: [] },
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    retry: 2,
  });
}
