import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCommunity } from '../context/CommunityContext';
import { getSocket } from '../lib/socket';
import { queryKeys } from '../lib/queryKeys';

export function useRealtimeSync() {
  const queryClient = useQueryClient();
  const { currentCommunity } = useCommunity();

  useEffect(() => {
    let active = true;
    let cleanup: (() => void) | undefined;

    const bind = async () => {
      const socket = await getSocket();
      if (!active) return;

      const communityId = currentCommunity?.id;
      if (communityId) {
        socket.emit('join:community', communityId);
      }

      const onCharityUpdated = (payload: any) => {
        const id = payload?.communityId ?? communityId;
        if (!id) return;
        if (payload?.featuredCharity) {
          queryClient.setQueryData(queryKeys.featuredCharity(id), payload.featuredCharity);
        }
        queryClient.invalidateQueries({ queryKey: queryKeys.catHub(id) });
      };

      const onCampaignClosed = (payload: any) => {
        const id = payload?.communityId ?? communityId;
        if (!id) return;
        queryClient.invalidateQueries({ queryKey: queryKeys.featuredCharity(id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.catHub(id) });
      };

      const onPostChange = (payload: any) => {
        const id = payload?.communityId ?? communityId;
        if (!id) return;
        queryClient.invalidateQueries({ queryKey: queryKeys.featuredCharity(id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.catHub(id) });
      };

      socket.on('charity:updated', onCharityUpdated);
      socket.on('campaign:closed', onCampaignClosed);
      socket.on('post:new', onPostChange);
      socket.on('post:updated', onPostChange);
      socket.on('post:deleted', onPostChange);

      cleanup = () => {
        if (communityId) {
          socket.emit('leave:community', communityId);
        }
        socket.off('charity:updated', onCharityUpdated);
        socket.off('campaign:closed', onCampaignClosed);
        socket.off('post:new', onPostChange);
        socket.off('post:updated', onPostChange);
        socket.off('post:deleted', onPostChange);
      };
    };

    bind().catch(() => undefined);

    return () => {
      active = false;
      cleanup?.();
    };
  }, [currentCommunity?.id, queryClient]);
}
