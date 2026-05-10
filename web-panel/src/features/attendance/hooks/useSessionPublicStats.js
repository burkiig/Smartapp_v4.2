import { useState, useEffect } from 'react';
import apiClient from '../../../shared/services/apiClient';

const DEFAULT_INTERVAL_MS = 8_000;

/**
 * Polls anonymous checked-in count for projector / classroom overlay.
 */
export function useSessionPublicStats(sessionId, { enabled = true, intervalMs = DEFAULT_INTERVAL_MS } = {}) {
  const [checkedInCount, setCheckedInCount] = useState(null);

  useEffect(() => {
    if (!sessionId || !enabled) {
      setCheckedInCount(null);
      return undefined;
    }
    let cancelled = false;

    const load = async () => {
      try {
        const data = await apiClient.get(`/sessions/${sessionId}/public-stats`);
        if (!cancelled) setCheckedInCount(data.checked_in_count ?? 0);
      } catch {
        if (!cancelled) setCheckedInCount(null);
      }
    };

    load();
    const id = setInterval(load, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [sessionId, enabled, intervalMs]);

  return checkedInCount;
}
