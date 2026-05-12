import { useQuery } from '@tanstack/react-query';
import apiClient from '../../services/apiClient';

export const activeSessionsQueryKey = ['sessions', 'active'];

export function useActiveSessionsQuery(options = {}) {
  return useQuery({
    queryKey: activeSessionsQueryKey,
    queryFn: () => apiClient.get('/sessions/active'),
    select: (data) => (Array.isArray(data) ? data : []),
    ...options,
  });
}
