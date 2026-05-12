/**
 * NotificationBell
 *
 * Badge count:  polled every 20 s via GET /api/v1/notifications/count (lightweight)
 * Full list:    fetched on dropdown open via GET /api/v1/notifications/
 * Mark read:    PATCH /api/v1/notifications/read-all on dropdown open
 * Browser push: fires when new items arrive between polls (Web Notification API)
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '../../services/apiClient';
import './NotificationBell.css';

const COUNT_POLL_MS = 20_000;   // lightweight badge poll — every 20 s
const LIST_STALE_MS = 60_000;   // re-fetch full list if older than 60 s

const TYPE_ICON = {
  flagged_attendance: '⚠️',
  class_cancelled:    '❌',
  session_started:    '📋',
  excuse_pending:     '📄',
  excuse_reviewed:    '✅',
  system:             '📢',
};

function requestBrowserPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function sendBrowserNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico' });
  }
}

/**
 * Build a safe navigation target from a notification object.
 *
 * Security rules:
 *  - Only integer IDs from data are embedded in URLs (non-integer → fallback).
 *  - Targets are relative paths only (no external URLs).
 *  - Returns null if there is no meaningful target for this notification type.
 */
function buildNavTarget(n) {
  const d = n.data || {};

  // Only allow safe integer IDs — reject anything that is not a finite integer.
  const safeId = (val) => {
    const n = parseInt(val, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  switch (n.type) {
    case 'flagged_attendance': {
      const sid = safeId(d.session_id);
      return sid
        ? `/?tab=attendance&filter=flagged&session_id=${sid}`
        : '/?tab=attendance&filter=flagged';
    }
    case 'class_cancelled':
      return '/?tab=classroom';
    case 'session_started': {
      const sid = safeId(d.session_id);
      return sid ? `/?tab=attendance&session_id=${sid}` : '/?tab=attendance';
    }
    case 'excuse_pending':
    case 'excuse_reviewed':
      return '/?tab=excuses';
    case 'system':
      return null;   // System announcements have no drill-down target
    default:
      return null;
  }
}

export const NotificationBell = () => {
  const [unreadCount, setUnreadCount]     = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen]                   = useState(false);
  const [listLoading, setListLoading]     = useState(false);
  const prevCountRef   = useRef(0);
  const listFetchedAt  = useRef(0);
  const dropdownRef    = useRef(null);

  // ── Lightweight badge poll ───────────────────────────────────────────────
  const fetchCount = useCallback(async () => {
    try {
      const res = await apiClient.get('/notifications/count');
      const count = res?.unread_count ?? 0;
      if (count > prevCountRef.current && prevCountRef.current !== 0) {
        sendBrowserNotification(
          `${count - prevCountRef.current} yeni bildirim`,
          'Bildirimlerinizi görüntülemek için tıklayın.'
        );
      }
      prevCountRef.current = count;
      setUnreadCount(count);
    } catch {
      // non-critical
    }
  }, []);

  // ── Full list fetch ──────────────────────────────────────────────────────
  const fetchList = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await apiClient.get('/notifications/', { params: { limit: 50 } });
      setNotifications(res?.notifications ?? []);
      setUnreadCount(res?.unread_count ?? 0);
      listFetchedAt.current = Date.now();
    } catch {
      // non-critical
    } finally {
      setListLoading(false);
    }
  }, []);

  // ── Mark all read on open ────────────────────────────────────────────────
  const markAllRead = useCallback(async () => {
    try {
      await apiClient.patch('/notifications/read-all');
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      prevCountRef.current = 0;
    } catch {
      // non-critical
    }
  }, []);

  // ── Mark single notification read ────────────────────────────────────────
  const markOneRead = useCallback(async (notifId) => {
    try {
      await apiClient.patch(`/notifications/${notifId}/read`);
      setNotifications(prev =>
        prev.map(n => n.id === notifId ? { ...n, is_read: true } : n)
      );
    } catch {
      // non-critical
    }
  }, []);

  const handleNotificationClick = useCallback(async (n) => {
    if (!n.is_read) markOneRead(n.id);
    const target = buildNavTarget(n);
    if (!target) return;

    // Validate resource existence before navigating, so users don't land
    // on a blank page if the underlying record was deleted since the
    // notification was created.
    const d = n.data || {};
    const safeSessionId = d.session_id && Number.isFinite(parseInt(d.session_id, 10))
      ? parseInt(d.session_id, 10)
      : null;

    if (safeSessionId && (n.type === 'flagged_attendance' || n.type === 'session_started')) {
      try {
        await apiClient.get(`/sessions/${safeSessionId}`);
      } catch {
        // Resource no longer exists — navigate to the fallback tab without the id
        setOpen(false);
        const fallback = n.type === 'flagged_attendance'
          ? '/?tab=attendance&filter=flagged'
          : '/?tab=attendance';
        window.location.assign(fallback);
        return;
      }
    }

    setOpen(false);
    window.location.assign(target);
  }, [markOneRead]);

  // ── Open dropdown ────────────────────────────────────────────────────────
  const handleOpen = useCallback(() => {
    const shouldOpen = !open;
    setOpen(shouldOpen);
    if (shouldOpen) {
      // Fetch list if stale or empty
      if (Date.now() - listFetchedAt.current > LIST_STALE_MS || notifications.length === 0) {
        fetchList();
      }
      // Mark all read (fire-and-forget)
      if (unreadCount > 0) {
        markAllRead();
      }
    }
  }, [open, notifications.length, unreadCount, fetchList, markAllRead]);

  useEffect(() => {
    requestBrowserPermission();
    fetchCount();
    const interval = setInterval(fetchCount, COUNT_POLL_MS);
    return () => clearInterval(interval);
  }, [fetchCount]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatTime = (ts) => {
    if (!ts) return '';
    try {
      return new Date(ts).toLocaleString('tr-TR', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="notif-bell-wrapper" ref={dropdownRef}>
      <button
        className="notif-bell-btn"
        onClick={handleOpen}
        title="Bildirimler"
      >
        <span className="notif-bell-icon">🔔</span>
        {unreadCount > 0 && (
          <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-header">
            <span>Bildirimler</span>
            <button className="notif-refresh-btn" onClick={fetchList} title="Yenile">↻</button>
          </div>

          {listLoading ? (
            <div className="notif-empty">Yükleniyor...</div>
          ) : notifications.length === 0 ? (
            <div className="notif-empty">Yeni bildirim yok</div>
          ) : (
            <div className="notif-list">
              {notifications.slice(0, 30).map(n => (
                <button
                  key={n.id}
                  type="button"
                  className={`notif-item ${n.type} ${n.is_read ? 'read' : 'unread'}`}
                  onClick={() => handleNotificationClick(n)}
                >
                  <div className="notif-item-icon">
                    {TYPE_ICON[n.type] || '🔔'}
                  </div>
                  <div className="notif-item-body">
                    <div className="notif-item-title">{n.title}</div>
                    <div className="notif-item-text">{n.body}</div>
                    {n.created_at && (
                      <div className="notif-item-time">{formatTime(n.created_at)}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
