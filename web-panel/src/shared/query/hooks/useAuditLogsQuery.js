import { keepPreviousData, useQuery } from '@tanstack/react-query';
import apiClient from '../../services/apiClient';

/** Audit logs change infrequently during review; 60s avoids stale UI without polling. */
export const AUDIT_LOGS_STALE_TIME_MS = 60_000;
export const AUDIT_LOGS_GC_TIME_MS = 5 * 60_000;

export const buildAuditLogsQueryKey = ({ page = 1, action = '' } = {}) => [
  'audit-logs',
  { page, action: action || '' },
];

export function fetchAuditLogs({ page = 1, action = '' } = {}) {
  const params = { page, page_size: 50 };
  if (action) params.action = action;
  return apiClient.get('/audit-logs/', { params });
}

export function useAuditLogsQuery({ page, action, enabled = true } = {}) {
  return useQuery({
    queryKey: buildAuditLogsQueryKey({ page, action }),
    queryFn: () => fetchAuditLogs({ page, action }),
    placeholderData: keepPreviousData,
    staleTime: AUDIT_LOGS_STALE_TIME_MS,
    gcTime: AUDIT_LOGS_GC_TIME_MS,
    retry: 2,
    // Manual refresh button is the primary update path; avoid background polling.
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    enabled,
  });
}
