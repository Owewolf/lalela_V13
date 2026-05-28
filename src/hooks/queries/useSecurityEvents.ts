import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { queryKeys } from '../../lib/queryKeys';

type SecurityEventParams = {
  resolved?: boolean;
  severity?: string;
  status?: string;
};

export function useSecurityEvents(communityId?: string | null, params: SecurityEventParams = {}) {
  return useQuery({
    queryKey: queryKeys.securityEvents(communityId, params),
    enabled: Boolean(communityId),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (typeof params.resolved === 'boolean') searchParams.set('resolved', String(params.resolved));
      if (params.severity) searchParams.set('severity', params.severity);
      if (params.status) searchParams.set('status', params.status);
      const query = searchParams.toString();
      const { data } = await api.get(`/communities/${communityId}/security-events${query ? `?${query}` : ''}`);
      return Array.isArray(data) ? data : [];
    },
    initialData: [],
  });
}
