import { useCommunityById } from './useCommunityById';

export function useCommunityQuery(communityId?: string | null) {
  return useCommunityById(communityId);
}
