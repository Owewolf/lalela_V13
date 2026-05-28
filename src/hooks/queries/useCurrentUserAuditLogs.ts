import { useQuery } from '@tanstack/react-query';
import { accountService } from '../../services/accountService';
import { queryKeys } from '../../lib/queryKeys';

export function useCurrentUserAuditLogs(enabled = true) {
  return useQuery({
    queryKey: queryKeys.currentUserAuditLogs(),
    enabled,
    queryFn: async () => accountService.getAuditLogs(),
  });
}