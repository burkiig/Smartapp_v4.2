import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { notifications } from '@/services/api';
import eventBus from '@/utils/eventBus';

const POLL_MS = 20_000;

/** Polls unread notification count (web NotificationBell parity). */
export function useNotificationBadge(enabled = true) {
  const [unreadCount, setUnreadCount] = useState(0);
  const prevRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await notifications.count();
      const count = res?.unread_count ?? res?.count ?? 0;
      if (count > prevRef.current) {
        eventBus.emit('REFRESH_FLAGGED');
      }
      prevRef.current = count;
      setUnreadCount(count);
    } catch {
      // Non-critical
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    refresh();
    const interval = setInterval(refresh, POLL_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [enabled, refresh]);

  return { unreadCount, refresh };
}
