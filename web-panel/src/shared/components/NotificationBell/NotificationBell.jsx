/**
 * NotificationBell
 *
 * Badge count:  polled every 20 s via GET /api/v1/notifications/count (lightweight)
 * Full list:    fetched on dropdown open via GET /api/v1/notifications/
 * Mark read:    PATCH /api/v1/notifications/read-all on dropdown open
 * Browser push: fires when new items arrive between polls (Web Notification API)
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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

function getCurrentUserRole() {
  try {
    const raw = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.role || null;
  } catch {
    return null;
  }
}

function getLocalizedNotificationContent(t, notification) {
  const data = notification?.data || {};
  const type = notification?.type || data?.type;
  const courseIdLabel = data?.course_id ? `#${data.course_id}` : null;
  const sessionIdLabel = data?.session_id ? `#${data.session_id}` : null;
  const studentIdLabel = data?.student_id ? `#${data.student_id}` : null;

  switch (type) {
    case 'session_started':
      return {
        title: t('notificationBell.types.session_started.title'),
        body: t('notificationBell.types.session_started.body', { course: courseIdLabel || '—' }),
      };
    case 'class_cancelled':
      {
        const courseLabel = data?.course_code || courseIdLabel || '—';
        const dateLabel = data?.date || '—';
        const timeLabel = data?.start_time
          ? `${data.start_time}${data?.end_time ? `-${data.end_time}` : ''}`
          : '—';
        const topicLabel = data?.topic ? ` | ${data.topic}` : '';
        return {
          title: t('notificationBell.types.class_cancelled.title'),
          body: `${t('notificationBell.types.class_cancelled.body', { course: courseLabel })} (${dateLabel} ${timeLabel}${topicLabel})`,
        };
      }
    case 'flagged_attendance':
      return {
        title: t('notificationBell.types.flagged_attendance.title'),
        body: t('notificationBell.types.flagged_attendance.body', {
          student: studentIdLabel || '—',
          session: sessionIdLabel || '—',
        }),
      };
    case 'dispute_submitted':
      return {
        title: t('notificationBell.types.dispute_submitted.title'),
        body: t('notificationBell.types.dispute_submitted.body', { course: courseIdLabel || '—' }),
      };
    case 'dispute_approved':
      return {
        title: t('notificationBell.types.dispute_approved.title'),
        body: t('notificationBell.types.dispute_approved.body', { course: courseIdLabel || '—' }),
      };
    case 'dispute_rejected':
      return {
        title: t('notificationBell.types.dispute_rejected.title'),
        body: t('notificationBell.types.dispute_rejected.body', { course: courseIdLabel || '—' }),
      };
    case 'system':
      return {
        title: t('notificationBell.types.system.title'),
        body: notification?.body || t('notificationBell.types.system.body'),
      };
    default:
      return {
        title: notification?.title || t('notificationBell.defaultTitle'),
        body: notification?.body || t('notificationBell.defaultBody'),
      };
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
function buildNavTarget(n, userRole) {
  const d = n.data || {};

  // Only allow safe integer IDs — reject anything that is not a finite integer.
  const safeId = (val) => {
    const n = parseInt(val, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  switch (n.type) {
    case 'flagged_attendance': {
      const sid = safeId(d.session_id);
      if (userRole === 'student') return '/?tab=attendance';
      return sid
        ? `/?tab=attendance&filter=flagged&session_id=${sid}`
        : '/?tab=attendance&filter=flagged';
    }
    case 'class_cancelled': {
      const cid = safeId(d.course_id);
      const date = typeof d.date === 'string' ? d.date : null;
      if (userRole === 'student') {
        const params = new URLSearchParams({ tab: 'schedule' });
        if (cid) params.set('course_id', String(cid));
        if (date) params.set('date', date);
        params.set('notify_type', 'class_cancelled');
        if (typeof d.course_name === 'string' && d.course_name) params.set('course_name', d.course_name);
        if (typeof d.course_code === 'string' && d.course_code) params.set('course_code', d.course_code);
        if (typeof d.start_time === 'string' && d.start_time) params.set('start_time', d.start_time);
        if (typeof d.end_time === 'string' && d.end_time) params.set('end_time', d.end_time);
        if (typeof d.reason === 'string' && d.reason) params.set('reason', d.reason);
        if (typeof d.topic === 'string' && d.topic) params.set('topic', d.topic);
        if (d.cancellation_id != null) params.set('cancellation_id', String(d.cancellation_id));
        return `/?${params.toString()}`;
      }
      return '/?tab=schedule';
    }
    case 'session_started': {
      const sid = safeId(d.session_id);
      if (userRole === 'student') {
        return sid ? `/?tab=take&session_id=${sid}` : '/?tab=take';
      }
      return sid ? `/?tab=attendance&session_id=${sid}` : '/?tab=attendance';
    }
    case 'dispute_submitted':
    case 'dispute_approved':
    case 'dispute_rejected':
      return '/?tab=disputes';
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
  const { t, i18n } = useTranslation();
  const userRole = useRef(getCurrentUserRole());
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
          t('notificationBell.newNotificationTitle', { count: count - prevCountRef.current }),
          t('notificationBell.newNotificationBody')
        );
      }
      prevCountRef.current = count;
      setUnreadCount(count);
    } catch {
      // non-critical
    }
  }, [t]);

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
    const target = buildNavTarget(n, userRole.current);
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
          ? (userRole.current === 'student' ? '/?tab=attendance' : '/?tab=attendance&filter=flagged')
          : (userRole.current === 'student' ? '/?tab=take' : '/?tab=attendance');
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
      const locale = i18n.resolvedLanguage === 'en' ? 'en-US' : 'tr-TR';
      return new Date(ts).toLocaleString(locale, {
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
        title={t('notificationBell.title')}
      >
        <span className="notif-bell-icon">🔔</span>
        {unreadCount > 0 && (
          <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-header">
            <span>{t('notificationBell.title')}</span>
            <button className="notif-refresh-btn" onClick={fetchList} title={t('common.refresh')}>↻</button>
          </div>

          {listLoading ? (
            <div className="notif-empty">{t('common.loading')}</div>
          ) : notifications.length === 0 ? (
            <div className="notif-empty">{t('notificationBell.empty')}</div>
          ) : (
            <div className="notif-list">
              {notifications.slice(0, 30).map((n) => {
                const localized = getLocalizedNotificationContent(t, n);
                return (
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
                      <div className="notif-item-title">{localized.title}</div>
                      <div className="notif-item-text">{localized.body}</div>
                      {n.created_at && (
                        <div className="notif-item-time">{formatTime(n.created_at)}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
