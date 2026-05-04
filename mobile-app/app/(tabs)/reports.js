import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useUser } from '@/context/UserContext';
import { dashboard } from '@/services/api';
import { Colors, Shadows } from '@/config/theme';
import HistoryScreen from './history';

function InstructorReports() {
  const [stats,      setStats]      = useState(null);
  const [coursePerf, setCoursePerf] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refresh,    setRefresh]    = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [s, c] = await Promise.allSettled([
        dashboard.stats(),
        dashboard.coursePerformance(),
      ]);
      if (s.status === 'fulfilled') setStats(s.value);
      if (c.status === 'fulfilled') setCoursePerf(Array.isArray(c.value) ? c.value : []);
    } catch {}
    finally { setLoading(false); setRefresh(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = () => { setRefresh(true); fetchData(); };

  const avgAttendance = coursePerf.length > 0
    ? Math.round(coursePerf.reduce((a, c) => a + (c.attendance || 0), 0) / coursePerf.length)
    : 0;

  const barColor = avgAttendance >= 80 ? Colors.success : avgAttendance >= 60 ? Colors.warning : Colors.error;

  const STATS = [
    { icon: 'book-outline',        color: Colors.primary, value: stats?.total_courses   ?? '—', label: 'Toplam Ders' },
    { icon: 'people-outline',      color: Colors.success, value: stats?.total_enrolled  ?? '—', label: 'Kayıtlı' },
    { icon: 'play-circle-outline', color: Colors.warning, value: stats?.active_sessions ?? '—', label: 'Aktif Oturum' },
    { icon: 'flag-outline',        color: Colors.error,   value: stats?.flagged_records ?? '—', label: 'Bayraklı' },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Raporlar</Text>
          <Text style={styles.headerSub}>İstatistikler ve analiz</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
          <Ionicons name="refresh-outline" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refresh} onRefresh={onRefresh} tintColor={Colors.primary} />}
          contentContainerStyle={{ paddingBottom: 32 }}
        >
          {/* Avg rate card */}
          <LinearGradient colors={['#1E3A8A', '#2563EB']} style={styles.rateCard}>
            <Text style={styles.rateLabel}>Ortalama Devam Oranı</Text>
            <Text style={styles.rateValue}>{avgAttendance}%</Text>
            <View style={styles.rateBg}>
              <View style={[styles.rateFill, { width: `${avgAttendance}%`, backgroundColor: barColor }]} />
            </View>
            <Text style={styles.rateSub}>
              {stats?.total_courses ?? 0} ders · {stats?.total_enrolled ?? 0} kayıtlı öğrenci
            </Text>
          </LinearGradient>

          {/* Stats grid */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Özet İstatistikler</Text>
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
          </View>

          {/* Per-course rows */}
          {coursePerf.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ders Bazında Devam</Text>
              {coursePerf.map(c => {
                const rate = c.attendance ?? 0;
                const rateColor = rate >= 75 ? Colors.success : rate >= 50 ? Colors.warning : Colors.error;
                return (
                  <View key={c.course_id} style={styles.courseRow}>
                    <View style={styles.courseLeft}>
                      <Text style={styles.courseCode}>{c.course}</Text>
                      <Text style={styles.courseName} numberOfLines={1}>{c.name}</Text>
                      <View style={styles.courseBar}>
                        <View style={[styles.courseBarFill, { width: `${rate}%`, backgroundColor: rateColor + '80' }]} />
                      </View>
                    </View>
                    <View style={styles.courseRight}>
                      <Text style={[styles.courseRate, { color: rateColor }]}>{rate}%</Text>
                      <Text style={styles.courseStudents}>{c.students ?? 0} öğrenci</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

export default function ReportsScreen() {
  const { user } = useUser();
  if (user?.role === 'student') return <HistoryScreen />;
  return <InstructorReports />;
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  centered:{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },

  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: Colors.text, letterSpacing: -0.4 },
  headerSub:   { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  refreshBtn:  { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.primaryMuted, alignItems: 'center', justifyContent: 'center' },

  rateCard:  { marginHorizontal: 20, marginBottom: 24, borderRadius: 20, padding: 20, ...Shadows.primary },
  rateLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: 6 },
  rateValue: { fontSize: 52, fontWeight: '800', color: '#fff', letterSpacing: -2, marginBottom: 14 },
  rateBg:    { height: 6, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 3, overflow: 'hidden', marginBottom: 12 },
  rateFill:  { height: '100%', borderRadius: 3 },
  rateSub:   { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },

  section:      { paddingHorizontal: 20, marginBottom: 24 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.text, letterSpacing: -0.2, marginBottom: 14 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard:  { flex: 1, minWidth: '47%', backgroundColor: Colors.card, borderRadius: 14, padding: 14, alignItems: 'center', ...Shadows.xs },
  statIcon:  { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statValue: { fontSize: 26, fontWeight: '800', color: Colors.text, letterSpacing: -0.5, marginBottom: 4 },
  statLabel: { fontSize: 12, color: Colors.textMuted, fontWeight: '500', textAlign: 'center' },

  courseRow:      { backgroundColor: Colors.card, borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, ...Shadows.xs },
  courseLeft:     { flex: 1 },
  courseCode:     { fontSize: 13, fontWeight: '700', color: Colors.primary, letterSpacing: 0.3, marginBottom: 2 },
  courseName:     { fontSize: 13, color: Colors.textSecondary, marginBottom: 8 },
  courseBar:      { height: 4, backgroundColor: Colors.borderLight, borderRadius: 2, overflow: 'hidden' },
  courseBarFill:  { height: '100%', borderRadius: 2 },
  courseRight:    { alignItems: 'flex-end', minWidth: 64 },
  courseRate:     { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, marginBottom: 2 },
  courseStudents: { fontSize: 11, color: Colors.textMuted, fontWeight: '500' },
});
