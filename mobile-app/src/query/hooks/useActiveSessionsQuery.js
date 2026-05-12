import { useQuery } from '@tanstack/react-query';
import { sessions } from '@/services/api';

export const activeSessionsQueryKey = ['sessions', 'active'];

/**
 * Cached active sessions for students; use refetchInterval on screen for live updates.
 */
export function useActiveSessionsQuery(options = {}) {
  return useQuery({
    queryKey: activeSessionsQueryKey,
    queryFn: () => sessions.getActive(),
    select: (data) => (Array.isArray(data) ? data : []),
    ...options,
  });
}
