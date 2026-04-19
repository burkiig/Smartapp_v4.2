import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useUser } from '../_context/UserContext';
import { dashboard, courses } from '../shared/services/api';
import { Colors, Shadows } from '../shared/config/theme';
import HomeScreen from './home';

export default function DashboardScreen() {
  const { userType } = useUser();
  if (userType === 'student') return <HomeScreen />;
  return <InstructorDashboard />;
}

function InstructorDashboard() {
  const router = useRouter();
  const { userName } = useUser();
  const [stats,     setStats]     = useState(null);
  const [nextClass, setNextClass] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [refresh,   setRefresh]   = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [s, c] = await Promise.allSettled([dashboard.stats(), courses.list()]);
      if (s.status === 'fulfilled') setStats(s.value);
      if (c.status === 'fulfilled' && Array.isArray(c.value) && c.value.length > 0) {
        const first = c.value[0];
        let timeStr = '—';
        try {
          const sch = typeof first.schedule === 'string' ? JSON.parse(first.schedule) : first.schedule;
          if (sch?.start_time && sch?.end_time) timeStr = `${sch.start_time} – ${sch.end_time}`;
          else if (sch?.days) timeStr = sch.days.join(', ');
        } catch {}
        setNextClass({ code: first.code, name: first.name, time: timeStr, enrolled: first.enrolled_count ?? 0, courseId: first.id });
      }
    } catch {}
    finally { setLoading(false); setRefresh(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = () => { setRefresh(true); fetchData(); };

  const flagged     = stats?.flagged_records ?? 0;
  const active      = stats?.active_sessions ?? 0;
  const totalCourses= stats?.total_courses   ?? '—';
  const enrolled    = stats?.total_enrolled  ?? '—';

  const STATS = [
    { label: 'Toplam Ders',   value: totalCourses, icon: 'book-outline',       color: Colors.primary },
    { label: 'Kayıtlı',       value: enrolled,     icon: 'people-outline',      color: Colors.success },
    { label: 'Aktif Oturum',  value: active,       icon: 'play-circle-outline', color: Colors.warning },
    { label: 'Bayraklı',      value: flagged,      icon: 'flag-outline',        color: Colors.error   },
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
            <Text style={styles.name}>{userName?.split(' ')[0] || 'Hoca'}</Text>
          </View>
          <TouchableOpacity style={styles.notifBtn} onPress={() => router.push('/(tabs)/attendance')}>
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

            {/* Active session alert */}
            {active > 0 && (
              <TouchableOpacity style={styles.alertCard} onPress={() => router.push('/(tabs)/schedule')} activeOpacity={0.8}>
                <View style={styles.alertLeft}>
                  <View style={styles.alertDot} />
                  <View>
                    <Text style={styles.alertTitle}>{active} aktif yoklama oturumu</Text>
                    <Text style={styles.alertSub}>Program ekranına git</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.success} />
              </TouchableOpacity>
            )}

            {/* Next / first course card */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ders</Text>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => nextClass?.courseId && router.push({ pathname: '/class-details', params: { courseId: nextClass.courseId, code: nextClass.code, title: nextClass.name } })}
              >
                <LinearGradient colors={['#1E3A8A', '#2563EB']} style={styles.courseGrad}>
                  <View style={styles.courseGradTop}>
                    <View>
                      <Text style={styles.courseCode}>{nextClass?.code ?? '—'}</Text>
                      <Text style={styles.courseName} numberOfLines={2}>{nextClass?.name ?? 'Ders yükleniyor...'}</Text>
                    </View>
                    {active > 0 && (
                      <View style={styles.livePill}>
                        <View style={styles.liveDot} />
                        <Text style={styles.liveText}>CANLI</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.courseGradMeta}>
                    <View style={styles.metaItem}>
                      <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.8)" />
                      <Text style={styles.metaText}>{nextClass?.time ?? '—'}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Ionicons name="people-outline" size={14} color="rgba(255,255,255,0.8)" />
                      <Text style={styles.metaText}>{nextClass?.enrolled ?? 0} öğrenci</Text>
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Quick actions */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Hızlı Erişim</Text>
              <View style={styles.quickGrid}>
                <QuickCard icon="calendar"   label="Program"   colors={['#2563EB','#1D4ED8']} onPress={() => router.push('/(tabs)/schedule')} />
                <QuickCard icon="bar-chart"  label="Raporlar"  colors={['#059669','#047857']} onPress={() => router.push('/(tabs)/reports')} />
                <QuickCard icon="flag"       label="Bayraklı"  colors={['#D97706','#B45309']} onPress={() => router.push('/(tabs)/attendance')} />
                <QuickCard icon="person"     label="Profil"    colors={['#7C3AED','#6D28D9']} onPress={() => router.push('/(tabs)/more')} />
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

  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  greeting:    { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },
  name:        { fontSize: 22, fontWeight: '800', color: Colors.text, letterSpacing: -0.3 },
  notifBtn:    { width: 42, height: 42, borderRadius: 12, backgroundColor: Colors.bgAlt, alignItems: 'center', justifyContent: 'center' },
  notifDot:    { position: 'absolute', top: 6, right: 6, backgroundColor: Colors.error, borderRadius: 9, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: Colors.card },
  notifCount:  { fontSize: 9, fontWeight: '800', color: '#fff' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 10 },
  statCard:  { flex: 1, minWidth: '47%', backgroundColor: Colors.card, borderRadius: 14, padding: 14, ...Shadows.xs },
  statIcon:  { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statValue: { fontSize: 26, fontWeight: '800', color: Colors.text, letterSpacing: -0.5, marginBottom: 3 },
  statLabel: { fontSize: 12, color: Colors.textMuted, fontWeight: '500' },

  alertCard:  { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 16, backgroundColor: Colors.successLight, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#A7F3D0' },
  alertLeft:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  alertDot:   { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.success },
  alertTitle: { fontSize: 14, fontWeight: '700', color: Colors.success },
  alertSub:   { fontSize: 12, color: Colors.success, opacity: 0.75, marginTop: 2 },

  section:      { paddingHorizontal: 16, marginBottom: 24 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.text, letterSpacing: -0.2, marginBottom: 14 },

  courseGrad:    { borderRadius: 18, padding: 20, ...Shadows.primary },
  courseGradTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  courseCode:    { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.75)', letterSpacing: 0.5, marginBottom: 4 },
  courseName:    { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.3, maxWidth: 220 },
  livePill:      { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  liveDot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ADE80' },
  liveText:      { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  courseGradMeta:{ flexDirection: 'row', gap: 20 },
  metaItem:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText:      { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },

  quickGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickCard:    { width: '47.5%', borderRadius: 16, overflow: 'hidden', ...Shadows.sm },
  quickGradient:{ padding: 20, alignItems: 'center', justifyContent: 'center', minHeight: 100, gap: 10 },
  quickLabel:   { fontSize: 13, fontWeight: '700', color: '#fff' },
});
