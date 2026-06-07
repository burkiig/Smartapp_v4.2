import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, RefreshControl, Alert, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useUser } from '@/context/UserContext';
import { dashboard, courses, sessions, attendance } from '@/services/api';
import { Colors, Shadows } from '@/config/theme';

export default function InstructorHome() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useUser();
  const userName = user?.name || user?.username || '';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('greetings.morning') : hour < 18 ? t('greetings.afternoon') : t('greetings.evening');

  const [stats,          setStats]          = useState(null);
  const [today,          setToday]          = useState([]);
  const [allCourses,     setAllCourses]     = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [flagged,        setFlagged]        = useState(0);
  const [loading,        setLoading]        = useState(true);
  const [refresh,        setRefresh]        = useState(false);
  const [starting,       setStarting]       = useState(null);

  // Nabız animasyonu (CANLI banner)
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const fetchData = useCallback(async () => {
    try {
      const [s, c, f, act] = await Promise.allSettled([
        dashboard.stats(),
        courses.list(),
        attendance.getFlagged(),
        sessions.list({ status: 'active' }),
      ]);
      if (s.status === 'fulfilled') setStats(s.value);
      if (c.status === 'fulfilled') {
        const list = c.value || [];
        setAllCourses(list);
        const dayEN = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
        setToday(list.filter(course => {
          try {
            const sch = typeof course.schedule === 'string' ? JSON.parse(course.schedule) : course.schedule;
            if (sch?.days?.includes(dayEN)) return true;
            if (Array.isArray(sch?.slots)) return sch.slots.some(sl => sl.day === dayEN);
            return false;
          } catch { return false; }
        }));
      }
      if (f.status === 'fulfilled') setFlagged((f.value || []).filter(r => r.is_flagged).length);
      if (act.status === 'fulfilled') {
        const raw = act.value;
        setActiveSessions(Array.isArray(raw) ? raw : (raw?.items || raw?.sessions || []));
      }
    } catch {}
    finally { setLoading(false); setRefresh(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefresh(true); fetchData(); };

  const startSession = async (course) => {
    // Use room_id from course metadata if available (set during course setup)
    const room_id = course.room_id || course.default_room_id || null;
    setStarting(course.id);
    try {
      await sessions.start(course.id, room_id ? { room_id } : {});
      Alert.alert(
        t('attendance.sessionStarted'),
        `${course.code} ${t('attendance.sessionActive')}.${room_id ? '' : `\n(${t('attendance.gpsMissing')})`}`,
      );
      fetchData();
    } catch (err) { Alert.alert(t('common.error'), err?.message || t('attendance.startFailed')); }
    finally { setStarting(null); }
  };

  const getTime = (schedule) => {
    try {
      const s = typeof schedule === 'string' ? JSON.parse(schedule) : schedule;
      return s?.start_time && s?.end_time ? `${s.start_time} – ${s.end_time}` : '—';
    } catch { return '—'; }
  };

  const STATS = [
    { label: t('instructor.myCourses'),     value: stats?.total_courses   ?? '—', icon: 'book-outline',        color: Colors.primary },
    { label: t('attendance.enrolled'), value: stats?.total_enrolled  ?? '—', icon: 'people-outline',       color: Colors.success },
    { label: t('attendance.sessionActive'),    value: stats?.active_sessions ?? '—', icon: 'play-circle-outline',  color: Colors.warning },
    { label: t('attendance.flagged'),        value: stats?.flagged_records ?? '—', icon: 'flag-outline',          color: Colors.error   },
  ];

  // Aktif oturumun ders bilgisini bul
  const liveSession  = activeSessions[0] ?? null;
  const liveCourse   = liveSession ? allCourses.find(c => c.id === liveSession.course_id) : null;
  const nextCourse   = today[0] ?? null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting},</Text>
            <Text style={styles.name}>{userName?.split(' ')[0] || t('common.instructorFallback')} 👋</Text>
          </View>
          <TouchableOpacity
            style={styles.notifBtn}
            onPress={() => router.push('/(tabs)/attendance')}
          >
            <Ionicons name="notifications-outline" size={22} color={Colors.text} />
            {flagged > 0 && (
              <View style={styles.notifDot}>
                <Text style={styles.notifCount}>{flagged > 9 ? '9+' : flagged}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
        ) : (
          <>
            {/* Dinamik durum kartı */}
            {liveSession ? (
              /* ── CANLI YOKLAMA ── */
              <LinearGradient colors={['#DC2626', '#B91C1C']} style={styles.statusCard}>
                <View style={styles.statusCardHeader}>
                  <View style={styles.liveRow}>
                    <Animated.View style={[styles.livePulse, { opacity: pulseAnim }]} />
                    <Text style={styles.statusCardBadge}>{t('attendance.liveAttendance')}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.statusCardBtn}
                    onPress={() => router.push({ pathname: '/class-details', params: { courseId: liveSession.course_id, code: liveCourse?.code ?? '', title: liveCourse?.name ?? '' } })}
                  >
                    <Text style={styles.statusCardBtnText}>{t('common.manage')}</Text>
                    <Ionicons name="arrow-forward" size={13} color="#DC2626" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.statusCardCode}>{liveCourse?.code ?? t('common.courseWithId', { id: liveSession.course_id })}</Text>
                <Text style={styles.statusCardName} numberOfLines={1}>{liveCourse?.name ?? t('attendance.sessionActive')}</Text>
                <View style={styles.statusCardMeta}>
                  <Ionicons name="people-outline" size={13} color="rgba(255,255,255,0.75)" />
                  <Text style={styles.statusCardMetaText}>{t('common.enrolledCount', { count: liveCourse?.enrolled_count ?? 0 })}</Text>
                  {activeSessions.length > 1 && (
                    <>
                      <Text style={styles.statusCardMetaDot}>·</Text>
                      <Text style={styles.statusCardMetaText}>+{activeSessions.length - 1} aktif daha</Text>
                    </>
                  )}
                </View>
              </LinearGradient>
            ) : nextCourse ? (
              /* ── SIRADAKİ DERS ── */
              <LinearGradient colors={['#1E3A8A', '#2563EB']} style={styles.statusCard}>
                <View style={styles.statusCardHeader}>
                  <View style={styles.liveRow}>
                    <Ionicons name="alarm-outline" size={14} color="rgba(255,255,255,0.8)" />
                    <Text style={styles.statusCardBadge}>{t('home.nextCourseBadge')}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.statusCardBtn}
                    onPress={() => router.push('/(tabs)/schedule')}
                  >
                    <Text style={styles.statusCardBtnText}>{t('tabs.schedule')}</Text>
                    <Ionicons name="arrow-forward" size={13} color="#2563EB" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.statusCardCode}>{nextCourse.code}</Text>
                <Text style={styles.statusCardName} numberOfLines={1}>{nextCourse.name}</Text>
                <View style={styles.statusCardMeta}>
                  <Ionicons name="time-outline" size={13} color="rgba(255,255,255,0.75)" />
                  <Text style={styles.statusCardMetaText}>{getTime(nextCourse.schedule)}</Text>
                  <Text style={styles.statusCardMetaDot}>·</Text>
                  <Ionicons name="people-outline" size={13} color="rgba(255,255,255,0.75)" />
                  <Text style={styles.statusCardMetaText}>{t('common.studentCount', { count: nextCourse.enrolled_count ?? 0 })}</Text>
                </View>
              </LinearGradient>
            ) : null}

            {/* Stats grid */}
            <View style={styles.statsGrid}>
              {STATS.map(s => (
                <View key={s.label} style={styles.statCard}>
                  <View style={[styles.statIcon, { backgroundColor: s.color + '18' }]}>
                    <Ionicons name={s.icon} size={20} color={s.color} />
                  </View>
                  <Text style={styles.statValue}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>

            {/* Flagged alert */}
            {flagged > 0 && (
              <TouchableOpacity style={styles.alertCard} onPress={() => router.push('/(tabs)/attendance')} activeOpacity={0.8}>
                <View style={styles.alertLeft}>
                  <View style={styles.alertIcon}>
                    <Ionicons name="flag" size={18} color={Colors.warning} />
                  </View>
                  <View>
                    <Text style={styles.alertTitle}>{t('home.flaggedPending', { count: flagged })}</Text>
                    <Text style={styles.alertSub}>{t('instructor.attendanceMgmtTitle')}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.warning} />
              </TouchableOpacity>
            )}

            {/* Today's classes */}
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>{t('home.todayCourses')}</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/schedule')}>
                  <Text style={styles.seeAll}>{t('common.seeAll')}</Text>
                </TouchableOpacity>
              </View>

              {today.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Ionicons name="calendar-outline" size={36} color={Colors.border} />
                  <Text style={styles.emptyText}>{t('home.noClassesToday')}</Text>
                </View>
              ) : today.map(course => (
                <View key={course.id} style={styles.courseCard}>
                  <TouchableOpacity
                    style={styles.courseLeft}
                    onPress={() => router.push({ pathname: '/class-details', params: { code: course.code, title: course.name, courseId: course.id } })}
                    activeOpacity={0.7}
                  >
                    <View style={styles.courseIconBox}>
                      <Ionicons name="book-outline" size={20} color={Colors.primary} />
                    </View>
                    <View style={styles.courseBody}>
                      <Text style={styles.courseCode}>{course.code}</Text>
                      <Text style={styles.courseName} numberOfLines={1}>{course.name}</Text>
                      <View style={styles.courseMeta}>
                        <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
                        <Text style={styles.courseMetaText}>{getTime(course.schedule)}</Text>
                        <Text style={styles.courseDot}>·</Text>
                        <Ionicons name="people-outline" size={12} color={Colors.textMuted} />
                        <Text style={styles.courseMetaText}>{t('common.studentCount', { count: course.enrolled_count ?? 0 })}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.startBtn}
                    onPress={() => startSession(course)}
                    disabled={starting === course.id}
                  >
                    {starting === course.id
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <>
                          <Ionicons name="play" size={13} color="#fff" />
                          <Text style={styles.startBtnText}>{t('common.start')}</Text>
                        </>
                    }
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {/* Quick actions */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('home.quickAccess')}</Text>
              <View style={styles.quickGrid}>
                <QuickCard icon="calendar" label={t('tabs.schedule')}   colors={['#2563EB','#1D4ED8']} onPress={() => router.push('/(tabs)/schedule')} />
                <QuickCard icon="bar-chart" label={t('instructor.reportsTitle')} colors={['#059669','#047857']} onPress={() => router.push('/(tabs)/reports')} />
                <QuickCard icon="flag"     label={t('home.flaggedQuick')}  colors={['#D97706','#B45309']} onPress={() => router.push('/(tabs)/attendance')} />
                <QuickCard icon="person"   label={t('tabs.profile')}    colors={['#7C3AED','#6D28D9']} onPress={() => router.push('/(tabs)/more')} />
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickCard({ icon, label, colors, onPress }) {
  return (
    <TouchableOpacity style={styles.quickCard} onPress={onPress} activeOpacity={0.8}>
      <LinearGradient colors={colors} style={styles.quickGradient}>
        <Ionicons name={icon} size={26} color="#fff" />
        <Text style={styles.quickLabel}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  centered:{ paddingVertical: 60, alignItems: 'center' },

  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  greeting:   { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },
  name:       { fontSize: 22, fontWeight: '800', color: Colors.text, letterSpacing: -0.3 },
  notifBtn:   { width: 42, height: 42, borderRadius: 12, backgroundColor: Colors.bgAlt, alignItems: 'center', justifyContent: 'center' },
  notifDot:   { position: 'absolute', top: 6, right: 6, backgroundColor: Colors.error, borderRadius: 9, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: Colors.card },
  notifCount: { fontSize: 9, fontWeight: '800', color: '#fff' },

  statusCard:         { marginHorizontal: 16, marginTop: 16, marginBottom: 4, borderRadius: 18, padding: 18, ...Shadows.primary },
  statusCardHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  liveRow:            { flexDirection: 'row', alignItems: 'center', gap: 6 },
  livePulse:          { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  statusCardBadge:    { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: 0.6 },
  statusCardBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusCardBtnText:  { fontSize: 12, fontWeight: '700', color: Colors.text },
  statusCardCode:     { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.4, marginBottom: 2 },
  statusCardName:     { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginBottom: 12 },
  statusCardMeta:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusCardMetaText: { fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  statusCardMetaDot:  { fontSize: 12, color: 'rgba(255,255,255,0.4)' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 10 },
  statCard:  { flex: 1, minWidth: '47%', backgroundColor: Colors.card, borderRadius: 14, padding: 14, ...Shadows.xs },
  statIcon:  { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statValue: { fontSize: 26, fontWeight: '800', color: Colors.text, letterSpacing: -0.5, marginBottom: 3 },
  statLabel: { fontSize: 12, color: Colors.textMuted, fontWeight: '500' },

  alertCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 16, backgroundColor: Colors.warningMuted, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.warningLight },
  alertLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  alertIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.warningLight, alignItems: 'center', justifyContent: 'center' },
  alertTitle:{ fontSize: 14, fontWeight: '700', color: Colors.warning },
  alertSub:  { fontSize: 12, color: Colors.warning, opacity: 0.75, marginTop: 2 },

  section:     { paddingHorizontal: 16, marginBottom: 24 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle:{ fontSize: 17, fontWeight: '700', color: Colors.text, letterSpacing: -0.2 },
  seeAll:      { fontSize: 13, fontWeight: '600', color: Colors.primary },

  emptyBox:  { alignItems: 'center', paddingVertical: 28, gap: 8 },
  emptyText: { fontSize: 14, color: Colors.textMuted },

  courseCard:    { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: 14, padding: 14, marginBottom: 10, ...Shadows.xs },
  courseLeft:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  courseIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.primaryMuted, alignItems: 'center', justifyContent: 'center' },
  courseBody:    { flex: 1 },
  courseCode:    { fontSize: 12, fontWeight: '700', color: Colors.primary, letterSpacing: 0.3 },
  courseName:    { fontSize: 14, fontWeight: '600', color: Colors.text, marginTop: 1 },
  courseMeta:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  courseMetaText:{ fontSize: 11, color: Colors.textMuted },
  courseDot:     { fontSize: 11, color: Colors.textMuted },
  startBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginLeft: 8, minWidth: 64, justifyContent: 'center' },
  startBtnText:  { fontSize: 12, fontWeight: '700', color: '#fff' },

  quickGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickCard:    { width: '47.5%', borderRadius: 16, overflow: 'hidden', ...Shadows.sm },
  quickGradient:{ padding: 20, alignItems: 'center', justifyContent: 'center', minHeight: 100, gap: 10 },
  quickLabel:   { fontSize: 13, fontWeight: '700', color: '#fff' },
});
