import React, { useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '../../services/apiClient';
import './NotificationBell.css';

const POLL_INTERVAL = 60000; // 60 seconds

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

export const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const prevCountRef = useRef(0);
  const dropdownRef = useRef(null);

  const handleNotificationClick = useCallback((notification) => {
    if (notification?.type !== 'flagged' || !notification?.sessionId) return;
    const target = `/?tab=attendance&filter=flagged&session_id=${encodeURIComponent(String(notification.sessionId))}`;
    setOpen(false);
    window.location.assign(target);
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const [flaggedRes, excusesRes] = await Promise.allSettled([
        apiClient.get('/attendance/flagged'),
        apiClient.get('/excuses/'),
      ]);

      const items = [];

      if (flaggedRes.status === 'fulfilled') {
        const flagged = flaggedRes.value || [];
        flagged
          .filter(r => r.is_flagged && r.status !== 'absent')
          .forEach(r => {
            items.push({
              id: `flagged-${r.id}`,
              type: 'flagged',
              title: 'Suphelı Yoklama',
              body: `Ogrenci #${r.student_id} — ${r.flag_reason || 'Bayraklı kayıt'}`,
              sessionId: r.session_id,
              time: r.marked_at,
              read: false,
            });
          });
      }

      if (excusesRes.status === 'fulfilled') {
        const excuses = excusesRes.value || [];
        excuses
          .filter(e => e.status === 'pending')
          .forEach(e => {
            items.push({
              id: `excuse-${e.id}`,
              type: 'excuse',
              title: 'Mazeret Basvurusu',
              body: `${e.student_name || ('Ogrenci #' + e.student_id)} mazeret gonderdi`,
              time: e.submitted_at,
              read: false,
            });
          });
      }

      // Check for new items since last poll
      const newCount = items.length;
      if (newCount > prevCountRef.current && prevCountRef.current !== 0) {
        const diff = newCount - prevCountRef.current;
        sendBrowserNotification(
          `${diff} yeni bildirim`,
          diff === 1 ? items[0].body : `${diff} yeni bildirim var`
        );
      }
      prevCountRef.current = newCount;
      setNotifications(items);
    } catch (err) {
      // Silently fail — not critical
    }
  }, []);

  useEffect(() => {
    requestBrowserPermission();
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    try {
      return new Date(ts).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="notif-bell-wrapper" ref={dropdownRef}>
      <button
        className="notif-bell-btn"
        onClick={() => { setOpen(o => !o); if (!open) markAllRead(); }}
        title="Bildirimler"
      >
        <span className="notif-bell-icon">&#9654;</span>
        {unreadCount > 0 && (
          <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-header">
            <span>Bildirimler</span>
            <button className="notif-refresh-btn" onClick={fetchNotifications} title="Yenile">↻</button>
          </div>
          {notifications.length === 0 ? (
            <div className="notif-empty">Yeni bildirim yok</div>
          ) : (
            <div className="notif-list">
              {notifications.slice(0, 20).map(n => (
                <button
                  key={n.id}
                  type="button"
                  className={`notif-item ${n.type} ${n.read ? 'read' : 'unread'}`}
                  onClick={() => handleNotificationClick(n)}
                >
                  <div className="notif-item-icon">
                    {n.type === 'flagged' ? '!' : 'M'}
                  </div>
                  <div className="notif-item-body">
                    <div className="notif-item-title">{n.title}</div>
                    <div className="notif-item-text">{n.body}</div>
                    {n.time && <div className="notif-item-time">{formatTime(n.time)}</div>}
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
