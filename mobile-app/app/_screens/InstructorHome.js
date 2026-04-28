import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useUser } from '../_context/UserContext';
import { dashboard, courses, sessions, attendance } from '../shared/services/api';
import { Colors, Shadows } from '../shared/config/theme';

export default function InstructorHome() {
  const router = useRouter();
  const { user } = useUser();
  const userName = user?.name || user?.username || '';

  const [stats,    setStats]    = useState(null);
  const [today,    setToday]    = useState([]);
  const [flagged,  setFlagged]  = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [refresh,  setRefresh]  = useState(false);
  const [starting, setStarting] = useState(null); // courseId being started

  const fetchData = useCallback(async () => {
    try {
      const [s, c, f] = await Promise.allSettled([
        dashboard.stats(),
        courses.list(),
        attendance.getFlagged(),
      ]);
      if (s.status === 'fulfilled') setStats(s.value);
      if (c.status === 'fulfilled') {
        const dayEN = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
        setToday((c.value || []).filter(course => {
          try {
            const sch = typeof course.schedule === 'string' ? JSON.parse(course.schedule) : course.schedule;
            return sch?.days?.includes(dayEN);
          } catch { return false; }
        }));
      }
      if (f.status === 'fulfilled') setFlagged((f.value || []).filter(r => r.is_flagged).length);
    } catch {}
    finally { setLoading(false); setRefresh(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefresh(true); fetchData(); };

  const startSession = async (course) => {
    setStarting(course.id);
    try {
      await sessions.start(course.id);
      Alert.alert('Oturum Başlatıldı', `${course.code} için yoklama oturumu açıldı.`);
      fetchData();
    } catch (err) { Alert.alert('Hata', err?.message || 'Oturum başlatılamadı.'); }
    finally { setStarting(null); }
  };

  const getTime = (schedule) => {
    try {
      const s = typeof schedule === 'string' ? JSON.parse(schedule) : schedule;
      return s?.start_time && s?.end_time ? `${s.start_time} – ${s.end_time}` : '—';
    } catch { return '—'; }
  };

  const STATS = [
    { label: 'Toplam Ders',     value: stats?.total_courses   ?? '—', icon: 'book-outline',        color: Colors.primary },
    { label: 'Kayıtlı Öğrenci', value: stats?.total_enrolled  ?? '—', icon: 'people-outline',       color: Colors.success },
    { label: 'Aktif Oturum',    value: stats?.active_sessions ?? '—', icon: 'play-circle-outline',  color: Colors.warning },
    { label: 'Bayraklı',        value: stats?.flagged_records ?? '—', icon: 'flag-outline',          color: Colors.error   },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Header */}
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
        ) : (
          <>
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
                    <Text style={styles.alertTitle}>{flagged} kayıt inceleme bekliyor</Text>
                    <Text style={styles.alertSub}>Yoklama Yönetimi'ne git</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.warning} />
              </TouchableOpacity>
            )}

            {/* Today's classes */}
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>Bugünkü Dersler</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/schedule')}>
                  <Text style={styles.seeAll}>Tümünü Gör</Text>
                </TouchableOpacity>
              </View>

              {today.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Ionicons name="calendar-outline" size={36} color={Colors.border} />
                  <Text style={styles.emptyText}>Bugün ders yok</Text>
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
                        <Text style={styles.courseMetaText}>{course.enrolled_count ?? 0} öğrenci</Text>
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
                          <Text style={styles.startBtnText}>Başlat</Text>
                        </>
                    }
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {/* Quick actions */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Hızlı Erişim</Text>
              <View style={styles.quickGrid}>
                <QuickCard icon="calendar" label="Program"   colors={['#2563EB','#1D4ED8']} onPress={() => router.push('/(tabs)/schedule')} />
                <QuickCard icon="bar-chart" label="Raporlar" colors={['#059669','#047857']} onPress={() => router.push('/(tabs)/reports')} />
                <QuickCard icon="flag"     label="Bayraklı"  colors={['#D97706','#B45309']} onPress={() => router.push('/(tabs)/attendance')} />
                <QuickCard icon="person"   label="Profil"    colors={['#7C3AED','#6D28D9']} onPress={() => router.push('/(tabs)/more')} />
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

  // Header
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  greeting:   { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },
  name:       { fontSize: 22, fontWeight: '800', color: Colors.text, letterSpacing: -0.3 },
  notifBtn:   { width: 42, height: 42, borderRadius: 12, backgroundColor: Colors.bgAlt, alignItems: 'center', justifyContent: 'center' },
  notifDot:   { position: 'absolute', top: 6, right: 6, backgroundColor: Colors.error, borderRadius: 9, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: Colors.card },
  notifCount: { fontSize: 9, fontWeight: '800', color: '#fff' },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 10 },
  statCard:  { flex: 1, minWidth: '47%', backgroundColor: Colors.card, borderRadius: 14, padding: 14, ...Shadows.xs },
  statIcon:  { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statValue: { fontSize: 26, fontWeight: '800', color: Colors.text, letterSpacing: -0.5, marginBottom: 3 },
  statLabel: { fontSize: 12, color: Colors.textMuted, fontWeight: '500' },

  // Alert
  alertCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 16, backgroundColor: Colors.warningMuted, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.warningLight },
  alertLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  alertIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.warningLight, alignItems: 'center', justifyContent: 'center' },
  alertTitle:{ fontSize: 14, fontWeight: '700', color: Colors.warning },
  alertSub:  { fontSize: 12, color: Colors.warning, opacity: 0.75, marginTop: 2 },

  // Section
  section:     { paddingHorizontal: 16, marginBottom: 24 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle:{ fontSize: 17, fontWeight: '700', color: Colors.text, letterSpacing: -0.2 },
  seeAll:      { fontSize: 13, fontWeight: '600', color: Colors.primary },

  emptyBox:  { alignItems: 'center', paddingVertical: 28, gap: 8 },
  emptyText: { fontSize: 14, color: Colors.textMuted },

  // Course cards
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

  // Quick grid
  quickGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickCard:    { width: '47.5%', borderRadius: 16, overflow: 'hidden', ...Shadows.sm },
  quickGradient:{ padding: 20, alignItems: 'center', justifyContent: 'center', minHeight: 100, gap: 10 },
  quickLabel:   { fontSize: 13, fontWeight: '700', color: '#fff' },
});
