import React, { useState, useEffect, useCallback } from 'react';
import {
  ScrollView,
  StyleSheet,
  Alert,
  RefreshControl,
  Text,
  View,
  Modal,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '@/context/UserContext';
import InstructorHome from '@/screens/InstructorHome';
import Header from '../components/home/Header';
import LiveClassCard from '../components/home/LiveClassCard';
import QuickActions from '../components/home/QuickActions';
import MonthStats from '../components/home/MonthStats';
import RecentActivity from '../components/home/RecentActivity';
import { attendance, dashboard, courses, notifications as notificationsApi } from '@/services/api';
import { useActiveSessionsQuery } from '@/query/hooks/useActiveSessionsQuery';
import { getDateLocale } from '@/i18n';

function getNotificationTarget(item, role) {
  const data = item?.data || {};
  const type = item?.type || data?.type;
  const sessionId = data?.session_id;
  const courseId = data?.course_id;
  const date = data?.date;
  const courseCode = data?.course_code;
  const courseName = data?.course_name;
  const startTime = data?.start_time;
  const endTime = data?.end_time;
  const reason = data?.reason;
  const topic = data?.topic;
  const cancellationId = data?.cancellation_id;

  const dayFromDate = (() => {
    if (!date || typeof date !== 'string') return null;
    const parsed = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return null;
    return String(parsed.getDay());
  })();

  switch (type) {
    case 'session_started':
      if (sessionId) {
        return { pathname: '/qr-scan', params: { session_id: String(sessionId) } };
      }
      return { pathname: '/(tabs)/history', params: { tab: 'schedule' } };
    case 'class_cancelled': {
      const params = { tab: 'schedule' };
      if (dayFromDate !== null) params.day = dayFromDate;
      if (courseId) params.course_id = String(courseId);
      if (date) params.date = date;
      params.notify_type = 'class_cancelled';
      if (courseCode) params.course_code = String(courseCode);
      if (courseName) params.course_name = String(courseName);
      if (startTime) params.start_time = String(startTime);
      if (endTime) params.end_time = String(endTime);
      if (reason) params.reason = String(reason);
      if (topic) params.topic = String(topic);
      if (cancellationId != null) params.cancellation_id = String(cancellationId);
      return { pathname: '/(tabs)/history', params };
    }
    case 'flagged_attendance':
      if (role === 'instructor' || role === 'admin') {
        return {
          pathname: '/(tabs)/attendance',
          params: {
            filter: 'flagged',
            session_id: data?.session_id != null ? String(data.session_id) : undefined,
          },
        };
      }
      return { pathname: '/(tabs)/history', params: { tab: 'history' } };
    case 'dispute_submitted':
      return role === 'instructor' || role === 'admin'
        ? { pathname: '/(tabs)/attendance', params: { filter: 'disputes' } }
        : { pathname: '/(tabs)/history', params: { tab: 'history' } };
    case 'dispute_approved':
    case 'dispute_rejected':
      return { pathname: '/(tabs)/history', params: { tab: 'history' } };
    default:
      return null;
  }
}

function getLocalizedNotificationContent(t, item) {
  const data = item?.data || {};
  const type = item?.type || data?.type;
  const courseIdLabel = data?.course_id ? `#${data.course_id}` : null;
  const sessionIdLabel = data?.session_id ? `#${data.session_id}` : null;
  const studentIdLabel = data?.student_id ? `#${data.student_id}` : null;

  switch (type) {
    case 'session_started':
      return {
        title: t('common.notificationFeed.types.session_started.title'),
        body: t('common.notificationFeed.types.session_started.body', { course: courseIdLabel || '—' }),
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
          title: t('common.notificationFeed.types.class_cancelled.title'),
          body: `${t('common.notificationFeed.types.class_cancelled.body', { course: courseLabel })} (${dateLabel} ${timeLabel}${topicLabel})`,
        };
      }
    case 'flagged_attendance':
      return {
        title: t('common.notificationFeed.types.flagged_attendance.title'),
        body: t('common.notificationFeed.types.flagged_attendance.body', {
          student: studentIdLabel || '—',
          session: sessionIdLabel || '—',
        }),
      };
    case 'dispute_submitted':
      return {
        title: t('common.notificationFeed.types.dispute_submitted.title'),
        body: t('common.notificationFeed.types.dispute_submitted.body', { course: courseIdLabel || '—' }),
      };
    case 'dispute_approved':
      return {
        title: t('common.notificationFeed.types.dispute_approved.title'),
        body: t('common.notificationFeed.types.dispute_approved.body', { course: courseIdLabel || '—' }),
      };
    case 'dispute_rejected':
      return {
        title: t('common.notificationFeed.types.dispute_rejected.title'),
        body: t('common.notificationFeed.types.dispute_rejected.body', { course: courseIdLabel || '—' }),
      };
    default:
      return {
        title: item?.title || t('common.notificationFeed.defaultTitle'),
        body: item?.body || t('common.notificationFeed.defaultBody'),
      };
  }
}

// ─── Öğrenci Ana Ekranı ───────────────────────────────────────────────────────
function StudentHomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useUser();
  const role = user?.role;
  const userName = user?.name || user?.username || '';

  // expo-camera v17 hook-based permission API


  const [courseMap, setCourseMap] = useState({});
  const [stats, setStats] = useState({ percentage: 0, totalDays: 0, present: 0, absent: 0 });
  const [recentActivity, setRecentActivity] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [hasNotification, setHasNotification] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifItems, setNotifItems] = useState([]);
  const [notifActionLoading, setNotifActionLoading] = useState(false);
  const [completedSessionIds, setCompletedSessionIds] = useState(new Set());

  const { data: activeSessions = [], refetch: refetchSessions } = useActiveSessionsQuery({
    refetchInterval: 30_000,
  });
  const liveSession = activeSessions[0] ?? null;

  const fetchData = useCallback(async () => {
    setLoadError(null);
    try {
      await refetchSessions();
      const [coursesRes, statRes, activityRes, notifRes, historyRes] = await Promise.allSettled([
        courses.list(),
        dashboard.stats(),
        dashboard.recentActivity(),
        notificationsApi.count(),
        attendance.myHistory(),
      ]);

      // Ders haritası
      let cMap = {};
      if (coursesRes.status === 'fulfilled' && Array.isArray(coursesRes.value)) {
        coursesRes.value.forEach(c => { cMap[c.id] = c; });
        setCourseMap(cMap);
      }

      // İstatistikler
      if (statRes.status === 'fulfilled' && statRes.value) {
        const s = statRes.value;
        setStats({
          percentage: s.attendance_rate ?? 0,
          totalDays: s.total_sessions ?? 0,
          present: s.total_sessions_attended ?? 0,
          absent: (s.total_sessions ?? 0) - (s.total_sessions_attended ?? 0),
        });
      }

      // Son aktiviteler — component tek obje bekler: { course, time, status }
      if (activityRes.status === 'fulfilled' && activityRes.value?.activities?.length > 0) {
        const first = activityRes.value.activities[0];
        const cInfo = cMap[first.course_id];
        setRecentActivity({
          course: cInfo?.code || cInfo?.name || t('common.courseWithId', { id: first.course_id }),
          time: first.timestamp ? new Date(first.timestamp).toLocaleDateString(getDateLocale()) : '',
          status: first.status || 'absent',
        });
      }

      // Okunmamış bildirim sayısı
      if (notifRes.status === 'fulfilled') {
        const cnt = notifRes.value?.unread_count ?? notifRes.value?.count ?? 0;
        setUnreadCount(cnt);
        setHasNotification(cnt > 0);
      }

      // Tamamlanan yoklamalar (disable logic)
      if (historyRes.status === 'fulfilled' && Array.isArray(historyRes.value)) {
        const ids = new Set(historyRes.value.map(r => String(r.session_id)));
        setCompletedSessionIds(ids);
      } else if (historyRes.status === 'rejected') {
        setCompletedSessionIds(new Set());
      }
    } catch (err) {
      console.error('[HomeScreen] fetchData error:', err?.message || err);
      setLoadError(err?.message || t('common.dataLoadFailed'));
    } finally {
      setRefreshing(false);
    }
  }, [refetchSessions, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const loadNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const payload = await notificationsApi.list({ limit: 50 });
      const list = Array.isArray(payload) ? payload : (payload?.notifications || []);
      setNotifItems(list);
      const count = payload?.unread_count ?? list.filter(n => !n.is_read).length;
      setUnreadCount(count);
      setHasNotification(count > 0);
    } catch (err) {
      Alert.alert(t('common.error'), err?.message || t('common.dataLoadFailed'));
    } finally {
      setNotifLoading(false);
    }
  }, [t]);

  const openNotifications = useCallback(() => {
    setNotifModalVisible(true);
    loadNotifications();
  }, [loadNotifications]);

  const closeNotifications = useCallback(() => {
    setNotifModalVisible(false);
  }, []);

  const markSingleRead = useCallback(async (notificationId) => {
    if (!notificationId) return;
    try {
      await notificationsApi.markRead(notificationId);
      setNotifItems(prev => prev.map(n => (n.id === notificationId ? { ...n, is_read: true } : n)));
      setUnreadCount(prev => {
        const next = Math.max(0, prev - 1);
        setHasNotification(next > 0);
        return next;
      });
    } catch {
      // Non-critical
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifActionLoading(true);
    try {
      await notificationsApi.markAllRead();
      setNotifItems(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      setHasNotification(false);
    } catch (err) {
      Alert.alert(t('common.error'), err?.message || t('common.unexpectedError'));
    } finally {
      setNotifActionLoading(false);
    }
  }, [t]);

  const pruneReadNotifications = useCallback(async () => {
    setNotifActionLoading(true);
    try {
      await notificationsApi.pruneRead();
      setNotifItems(prev => prev.filter(n => !n.is_read));
    } catch (err) {
      Alert.alert(t('common.error'), err?.message || t('common.unexpectedError'));
    } finally {
      setNotifActionLoading(false);
    }
  }, [t]);

  const removeNotification = useCallback(async (item) => {
    if (!item?.id) return;
    setNotifActionLoading(true);
    try {
      await notificationsApi.remove(item.id);
      setNotifItems(prev => prev.filter(n => n.id !== item.id));
      if (!item.is_read) {
        setUnreadCount(prev => {
          const next = Math.max(0, prev - 1);
          setHasNotification(next > 0);
          return next;
        });
      }
    } catch (err) {
      Alert.alert(t('common.error'), err?.message || t('common.unexpectedError'));
    } finally {
      setNotifActionLoading(false);
    }
  }, [t]);

  const onPressNotificationItem = useCallback(async (item) => {
    if (!item?.is_read) await markSingleRead(item.id);
    const target = getNotificationTarget(item, role);
    if (target) {
      router.push(target);
      closeNotifications();
      return;
    }
    const localized = getLocalizedNotificationContent(t, item);
    Alert.alert(localized.title, localized.body);
  }, [closeNotifications, markSingleRead, role, router, t]);

  const formatNotificationTime = useCallback((isoDate) => {
    if (!isoDate) return t('common.justNow');
    const diffMs = Date.now() - new Date(isoDate).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return t('common.justNow');
    if (mins < 60) return t('common.minutesAgo', { count: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t('common.hoursAgo', { count: hours });
    const days = Math.floor(hours / 24);
    return t('common.daysAgo', { count: days });
  }, [t]);

  const handleStartAttendance = () => {
    if (!liveSession) {
      Alert.alert(t('attendance.noActiveSessionTitle'), t('attendance.noActiveSession'));
      return;
    }
    if (completedSessionIds.has(String(liveSession.id))) {
      Alert.alert(t('attendance.alreadyTakenTitle'), t('attendance.alreadyTaken'));
      return;
    }
    router.push({ pathname: '/qr-scan', params: { session_id: liveSession.id } });
  };

  // Aktif ders kartı için nesne oluştur
  const activeCourse = liveSession ? (courseMap[liveSession.course_id] || null) : null;
  const liveClass = liveSession ? {
    course: activeCourse?.code || activeCourse?.name || t('common.courseWithId', { id: liveSession.course_id }),
    title: activeCourse?.name || t('common.sessionWithId', { id: liveSession.id }),
    time: liveSession.start_time
      ? `${liveSession.start_time}${liveSession.end_time ? ' – ' + liveSession.end_time : ''}`
      : (activeCourse?.schedule || '—'),
    room: activeCourse?.room_name || '—',
    instructor: activeCourse?.instructor_name || '—',
  } : null;

  const isAttendanceCompletedForLive =
    !!liveSession && completedSessionIds.has(String(liveSession.id));

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Header
          userName={userName}
          hasNotification={hasNotification}
          unreadCount={unreadCount}
          onRefresh={onRefresh}
          onNotificationPress={openNotifications}
        />

        {loadError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{loadError}</Text>
          </View>
        )}

        {liveClass && (
          <LiveClassCard
            liveClass={liveClass}
            onStartAttendance={handleStartAttendance}
            disabled={isAttendanceCompletedForLive}
          />
        )}

        <QuickActions
          hasLiveSession={!!liveSession}
          onStartAttendance={handleStartAttendance}
          attendanceDisabled={isAttendanceCompletedForLive}
          onExcuse={() => {
            if (liveSession?.course_id) {
              router.push({
                pathname: '/excuse-submit',
                params: {
                  course_id: liveSession.course_id,
                  session_id: liveSession.id || '',
                  course_name: liveClass?.course || '',
                  session_date: new Date().toISOString().slice(0, 10),
                },
              });
            } else {
              // Aktif ders yoksa geçmişten mazeret gönderilmeli
              router.push('/(tabs)/history');
            }
          }}
          onHistory={() => router.push('/(tabs)/history')}
        />

        <MonthStats stats={stats} />

        {recentActivity && (
          <RecentActivity
            activity={recentActivity}
            onViewAll={() => router.push('/(tabs)/history')}
          />
        )}
      </ScrollView>

      <Modal
        visible={notifModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeNotifications}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeNotifications}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('common.notificationsTitle')}</Text>
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.smallBtn, notifActionLoading && styles.smallBtnDisabled]}
                  onPress={markAllRead}
                  disabled={notifActionLoading || unreadCount === 0}
                >
                  <Text style={styles.smallBtnText}>{t('common.markAllRead')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.smallBtn, notifActionLoading && styles.smallBtnDisabled]}
                  onPress={pruneReadNotifications}
                  disabled={notifActionLoading}
                >
                  <Text style={styles.smallBtnText}>{t('common.clearRead')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.closeBtn} onPress={closeNotifications}>
                  <Text style={styles.closeBtnText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {notifLoading ? (
              <View style={styles.modalLoadingWrap}>
                <ActivityIndicator size="small" color="#2563EB" />
                <Text style={styles.modalLoadingText}>{t('common.loading')}</Text>
              </View>
            ) : notifItems.length === 0 ? (
              <View style={styles.emptyNotifWrap}>
                <Text style={styles.emptyNotifText}>{t('common.noNotifications')}</Text>
              </View>
            ) : (
              <ScrollView style={styles.notifList} contentContainerStyle={{ paddingBottom: 8 }}>
                {notifItems.map((item) => {
                  const localized = getLocalizedNotificationContent(t, item);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.notifItem, !item.is_read && styles.notifItemUnread]}
                      activeOpacity={0.8}
                      onPress={() => onPressNotificationItem(item)}
                    >
                      <View style={styles.notifTextWrap}>
                        <Text style={styles.notifTitle} numberOfLines={1}>
                          {localized.title}
                        </Text>
                        <Text style={styles.notifBody} numberOfLines={2}>
                          {localized.body}
                        </Text>
                        <Text style={styles.notifTime}>{formatNotificationTime(item.created_at)}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.deleteNotifBtn}
                        onPress={() => removeNotification(item)}
                        disabled={notifActionLoading}
                      >
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                      </TouchableOpacity>
                      {!item.is_read && <View style={styles.unreadDot} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Ana Yönlendirici ─────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { user } = useUser();
  const role = user?.role;

  if (role === 'instructor' || role === 'admin') {
    return <InstructorHome />;
  }
  return <StudentHomeScreen />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  errorBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  errorText: { color: '#991B1B', fontSize: 14 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    maxHeight: '70%',
    overflow: 'hidden',
  },
  modalHeader: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  smallBtn: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  smallBtnDisabled: { opacity: 0.5 },
  smallBtnText: { color: '#1D4ED8', fontSize: 12, fontWeight: '700' },
  closeBtn: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  closeBtnText: { color: '#334155', fontSize: 12, fontWeight: '700' },
  modalLoadingWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 8 },
  modalLoadingText: { color: '#475569', fontSize: 13 },
  emptyNotifWrap: { paddingVertical: 26, alignItems: 'center' },
  emptyNotifText: { color: '#64748B', fontSize: 14 },
  notifList: { maxHeight: 360 },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 10,
  },
  notifItemUnread: { backgroundColor: '#F8FAFF' },
  notifTextWrap: { flex: 1 },
  notifTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  notifBody: { fontSize: 12, color: '#334155', marginTop: 2, lineHeight: 17 },
  notifTime: { fontSize: 11, color: '#64748B', marginTop: 5 },
  deleteNotifBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
  },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
});
