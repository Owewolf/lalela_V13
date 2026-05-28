import { useQuery } from '@tanstack/react-query';
import { accountService } from '../../services/accountService';
import { queryKeys } from '../../lib/queryKeys';
import type { UserSession } from '../../types';

export function useCurrentUserSessions(enabled = true) {
  return useQuery({
    queryKey: queryKeys.currentUserSessions(),
    enabled,
    queryFn: async (): Promise<UserSession[]> => accountService.getSessions(),
    initialData: [] as UserSession[],
  });
}