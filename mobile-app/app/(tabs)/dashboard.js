import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, FlatList, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useUser } from '@/context/UserContext';
import { dashboard, courses, sessions } from '@/services/api';
import { Colors, Shadows } from '@/config/theme';
import HomeScreen from './home';

// ── Yardımcı ─────────────────────────────────────────────────────────────────
const DAY_EN   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAY_FULL = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];

function parseSchedule(sch) {
  try { return typeof sch === 'string' ? JSON.parse(sch) : sch; }
  catch { return null; }
}
function getCourseDayIndices(course) {
  const s = parseSchedule(course.schedule);
  if (!s) return [];
  if (Array.isArray(s.slots)) return s.slots.map(sl => DAY_EN.indexOf(sl.day)).filter(i => i >= 0);
  if (Array.isArray(s.days))  return s.days.map(d => DAY_EN.indexOf(d)).filter(i => i >= 0);
  return [];
}
function getCourseTime(course) {
  const s = parseSchedule(course.schedule);
  if (!s) return null;
  if (s.start_time && s.end_time) return `${s.start_time} – ${s.end_time}`;
  if (Array.isArray(s.slots) && s.slots[0]) return `${s.slots[0].start_time} – ${s.slots[0].end_time}`;
  return null;
}
function minutesSinceMidnight(t) {
  const [h, m] = (t || '00:00').split(':').map(Number);
  return h * 60 + m;
}
function findNextClass(allCourses) {
  const now = new Date();
  const todayIdx = now.getDay();
  const nowMin   = now.getHours() * 60 + now.getMinutes();
  let candidates = [];
  for (const c of allCourses) {
    const days = getCourseDayIndices(c);
    if (!days.includes(todayIdx)) continue;
    const t = getCourseTime(c);
    if (!t) continue;
    const startMin = minutesSinceMidnight(t.split(' – ')[0]);
    if (startMin > nowMin) candidates.push({ course: c, daysAhead: 0, startMin });
  }
  if (candidates.length) { candidates.sort((a, b) => a.startMin - b.startMin); return candidates[0]; }
  for (let ahead = 1; ahead <= 7; ahead++) {
    const dayIdx = (todayIdx + ahead) % 7;
    for (const c of allCourses) {
      if (!getCourseDayIndices(c).includes(dayIdx)) continue;
      const t = getCourseTime(c);
      if (!t) continue;
      candidates.push({ course: c, daysAhead: ahead, startMin: minutesSinceMidnight(t.split(' – ')[0]) });
    }
    if (candidates.length) { candidates.sort((a, b) => a.startMin - b.startMin); return candidates[0]; }
  }
  return null;
}

// ── Öğretmen Dashboard ────────────────────────────────────────────────────────
function InstructorDashboard() {
  const router   = useRouter();
  const { user } = useUser();
  const userName = user?.name || user?.username || '';

  const [stats,          setStats]          = useState(null);
  const [allCourses,     setAllCourses]     = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [refresh,        setRefresh]        = useState(false);
  const [error,          setError]          = useState('');

  const fetchData = useCallback(async () => {
    setError('');
    try {
      const [s, c, sess] = await Promise.allSettled([
        dashboard.stats(),
        courses.list(),
        sessions.list({ status: 'active' }),
      ]);
      if (s.status    === 'fulfilled') setStats(s.value);
      if (c.status    === 'fulfilled') setAllCourses(Array.isArray(c.value) ? c.value : []);
      if (sess.status === 'fulfilled') {
        const raw = sess.value;
        setActiveSessions(Array.isArray(raw) ? raw : (raw?.items || raw?.sessions || []));
      }
    } catch (err) {
      setError(err?.message || 'Veriler yüklenemedi');
    } finally {
      setLoading(false);
      setRefresh(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = () => { setRefresh(true); fetchData(); };

  const flagged = stats?.flagged_records ?? 0;
  const activeCount = activeSessions.filter(s => s.status === 'active').length;

  // Aktif oturum kurs bilgisi
  const activeSession = activeSessions.find(s => s.status === 'active') || null;
  const activeCourse  = activeSession
    ? allCourses.find(c => c.id === activeSession.course_id)
    : null;

  const nextClass = useMemo(() => findNextClass(allCourses), [allCourses]);

  const getActiveSessForCourse = (courseId) =>
    activeSessions.find(s => s.course_id === courseId && s.status === 'active');

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* ── Header ─────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Merhaba,</Text>
            <Text style={styles.name}>{userName?.split(' ')[0] || 'Hoca'} 👋</Text>
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
        ) : error ? (
          <View style={styles.centered}>
            <Ionicons name="cloud-offline-outline" size={52} color={Colors.border} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchData}>
              <Text style={styles.retryText}>Tekrar Dene</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* ── Dinamik Durum Banner ────────────────────── */}
            <View style={styles.bannerWrap}>
              {activeCount > 0 && activeCourse ? (
                <LinearGradient colors={['#065F46', '#059669']} style={styles.banner}>
                  <View style={styles.bannerLeft}>
                    <View style={styles.liveRing}>
                      <View style={styles.liveDot} />
                    </View>
                    <View>
                      <Text style={styles.bannerLabel}>CANLI YOKLAMA</Text>
                      <Text style={styles.bannerCode}>{activeCourse.code}</Text>
                      <Text style={styles.bannerName} numberOfLines={1}>{activeCourse.name}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.bannerBtn}
                    onPress={() => router.push({ pathname: '/class-details', params: { courseId: activeCourse.id, code: activeCourse.code, title: activeCourse.name } })}
                  >
                    <Text style={styles.bannerBtnText}>Yönet</Text>
                    <Ionicons name="chevron-forward" size={14} color="#fff" />
                  </TouchableOpacity>
                </LinearGradient>
              ) : nextClass ? (
                <LinearGradient colors={['#1E3A8A', '#2563EB']} style={styles.banner}>
                  <View style={styles.bannerLeft}>
                    <View style={[styles.liveRing, { borderColor: 'rgba(255,255,255,0.3)' }]}>
                      <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.9)" />
                    </View>
                    <View>
                      <Text style={styles.bannerLabel}>
                        {nextClass.daysAhead === 0 ? 'SIRADAKI DERS — BUGÜN' : `SIRADAKI DERS — ${DAY_FULL[(new Date().getDay() + nextClass.daysAhead) % 7]?.toUpperCase()}`}
                      </Text>
                      <Text style={styles.bannerCode}>{nextClass.course.code}</Text>
                      <Text style={styles.bannerName} numberOfLines={1}>
                        {getCourseTime(nextClass.course) || nextClass.course.name}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.bannerBtn}
                    onPress={() => router.push({ pathname: '/class-details', params: { courseId: nextClass.course.id, code: nextClass.course.code, title: nextClass.course.name } })}
                  >
                    <Text style={styles.bannerBtnText}>Aç</Text>
                    <Ionicons name="chevron-forward" size={14} color="#fff" />
                  </TouchableOpacity>
                </LinearGradient>
              ) : (
                <LinearGradient colors={['#1E3A8A', '#2563EB']} style={styles.banner}>
                  <View style={styles.bannerLeft}>
                    <Ionicons name="school-outline" size={28} color="rgba(255,255,255,0.7)" />
                    <View>
                      <Text style={styles.bannerLabel}>HOŞ GELDİNİZ</Text>
                      <Text style={styles.bannerName}>Bugün için ders programında ders yok</Text>
                    </View>
                  </View>
                </LinearGradient>
              )}
            </View>

            {/* ── Hızlı Erişim (2 buton) ─────────────────── */}
            <View style={styles.quickRow}>
              <TouchableOpacity style={styles.quickBtn} onPress={() => router.push('/(tabs)/attendance')}>
                <View style={[styles.quickIcon, { backgroundColor: Colors.warning + '20' }]}>
                  <Ionicons name="flag" size={18} color={Colors.warning} />
                  {flagged > 0 && (
                    <View style={styles.quickBadge}>
                      <Text style={styles.quickBadgeText}>{flagged > 9 ? '9+' : flagged}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.quickLabel}>Bayraklı Kayıtlar</Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickBtn} onPress={() => router.push('/(tabs)/reports')}>
                <View style={[styles.quickIcon, { backgroundColor: Colors.success + '20' }]}>
                  <Ionicons name="bar-chart" size={18} color={Colors.success} />
                </View>
                <Text style={styles.quickLabel}>Raporlar</Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* ── Derslerim listesi ──────────────────────── */}
            <View style={styles.section}>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>Derslerim</Text>
                <Text style={styles.sectionCount}>{allCourses.length} ders</Text>
              </View>

              {allCourses.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Ionicons name="book-outline" size={44} color={Colors.border} />
                  <Text style={styles.emptyText}>Henüz ders atanmamış</Text>
                </View>
              ) : (
                allCourses.map(course => {
                  const sess    = getActiveSessForCourse(course.id);
                  const isLive  = !!sess;
                  const time    = getCourseTime(course);
                  const days    = getCourseDayIndices(course);
                  return (
                    <TouchableOpacity
                      key={course.id}
                      style={[styles.courseCard, isLive && styles.courseCardLive]}
                      onPress={() => router.push({ pathname: '/course-detail', params: { courseId: course.id, code: course.code, title: course.name } })}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.courseIconBox, { backgroundColor: isLive ? Colors.success + '22' : Colors.primaryMuted }]}>
                        <Ionicons name={isLive ? 'play-circle' : 'book-outline'} size={22} color={isLive ? Colors.success : Colors.primary} />
                      </View>
                      <View style={styles.courseBody}>
                        <View style={styles.courseTopRow}>
                          <Text style={styles.courseCode}>{course.code}</Text>
                          {isLive && (
                            <View style={styles.livePill}>
                              <View style={styles.liveDotSm} />
                              <Text style={styles.liveText}>CANLI</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.courseName} numberOfLines={1}>{course.name}</Text>
                        <View style={styles.metaRow}>
                          <Ionicons name="people-outline" size={11} color={Colors.textMuted} />
                          <Text style={styles.metaText}>{course.enrolled_count ?? 0} öğrenci</Text>
                          {time && (
                            <>
                              <Text style={styles.metaDot}>·</Text>
                              <Ionicons name="time-outline" size={11} color={Colors.textMuted} />
                              <Text style={styles.metaText}>{time}</Text>
                            </>
                          )}
                        </View>
                        {days.length > 0 && (
                          <Text style={styles.courseDays} numberOfLines={1}>
                            {days.map(d => ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'][d]).join('  ')}
                          </Text>
                        )}
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Ana export ────────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const { user } = useUser();
  if (user?.role === 'student') return <HomeScreen />;
  return <InstructorDashboard />;
}

// ── Stiller ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  centered:{ paddingVertical: 80, alignItems: 'center' },

  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  greeting:    { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },
  name:        { fontSize: 24, fontWeight: '800', color: Colors.text, letterSpacing: -0.4 },
  notifBtn:    { width: 42, height: 42, borderRadius: 12, backgroundColor: Colors.bgAlt, alignItems: 'center', justifyContent: 'center' },
  notifDot:    { position: 'absolute', top: 5, right: 5, backgroundColor: Colors.error, borderRadius: 9, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: Colors.card },
  notifCount:  { fontSize: 9, fontWeight: '800', color: '#fff' },

  // Dinamik banner
  bannerWrap: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  banner:     { borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...Shadows.primary },
  bannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  liveRing:   { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' },
  liveDot:    { width: 10, height: 10, borderRadius: 5, backgroundColor: '#4ADE80' },
  bannerLabel:{ fontSize: 9, fontWeight: '800', color: 'rgba(255,255,255,0.7)', letterSpacing: 1, marginBottom: 2 },
  bannerCode: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  bannerName: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2, maxWidth: 180 },
  bannerBtn:  { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  bannerBtnText:{ fontSize: 13, fontWeight: '700', color: '#fff' },

  // Hızlı erişim
  quickRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 12, marginBottom: 4 },
  quickBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.card, borderRadius: 14, padding: 14, ...Shadows.xs },
  quickIcon:{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  quickLabel:{ flex: 1, fontSize: 13, fontWeight: '600', color: Colors.text },
  quickBadge:{ position: 'absolute', top: -4, right: -4, backgroundColor: Colors.error, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  quickBadgeText:{ fontSize: 9, fontWeight: '800', color: '#fff' },

  // Dersler
  section:     { paddingHorizontal: 16, marginTop: 20, paddingBottom: 32 },
  sectionRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle:{ fontSize: 17, fontWeight: '800', color: Colors.text, letterSpacing: -0.2 },
  sectionCount:{ fontSize: 13, color: Colors.textMuted, fontWeight: '500' },

  courseCard:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.card, borderRadius: 16, padding: 14, marginBottom: 8, borderWidth: 1.5, borderColor: 'transparent', ...Shadows.xs },
  courseCardLive: { borderColor: Colors.success },
  courseIconBox:  { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  courseBody:     { flex: 1, gap: 3 },
  courseTopRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  courseCode:     { fontSize: 14, fontWeight: '700', color: Colors.text },
  courseName:     { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  courseDays:     { fontSize: 11, color: Colors.primary, fontWeight: '600', marginTop: 2 },
  metaRow:        { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText:       { fontSize: 11, color: Colors.textMuted },
  metaDot:        { fontSize: 11, color: Colors.textMuted },

  livePill:  { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.successLight, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  liveDotSm: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.success },
  liveText:  { fontSize: 10, fontWeight: '800', color: Colors.success, letterSpacing: 0.3 },

  emptyBox:  { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14, color: Colors.textMuted, marginTop: 10 },

  errorText: { fontSize: 14, color: Colors.error, marginTop: 12, textAlign: 'center', paddingHorizontal: 32 },
  retryBtn:  { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: Colors.primary, borderRadius: 10 },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
