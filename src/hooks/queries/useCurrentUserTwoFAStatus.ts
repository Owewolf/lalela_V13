import { useQuery } from '@tanstack/react-query';
import { accountService } from '../../services/accountService';
import { queryKeys } from '../../lib/queryKeys';

export function useCurrentUserTwoFAStatus(enabled = true) {
  return useQuery({
    queryKey: queryKeys.currentUserTwoFA(),
    enabled,
    queryFn: async () => accountService.get2FAStatus(),
  });
}