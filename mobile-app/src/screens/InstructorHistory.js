import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { dashboard, sessions, courses } from '@/services/api';
import { Colors, Shadows } from '@/config/theme';
import { getDateLocale } from '@/i18n';

const SESSION_STATUS_KEYS = {
  active:    'attendance.live',
  ended:     'instructor.sessionEnded',
  cancelled: 'instructor.sessionCancelled',
};

export default function InstructorHistory() {
  const router = useRouter();
  const { t } = useTranslation();
  const dateLocale = getDateLocale();
  const [stats,      setStats]      = useState(null);
  const [list,       setList]       = useState([]);
  const [courseMap,  setCourseMap]  = useState({});
  const [loading,    setLoading]    = useState(true);
  const [refresh,    setRefresh]    = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [s, l, c] = await Promise.allSettled([
        dashboard.stats(),
        sessions.list(),
        courses.list(),
      ]);
      if (s.status === 'fulfilled') setStats(s.value);
      if (l.status === 'fulfilled') setList(Array.isArray(l.value) ? l.value : []);
      if (c.status === 'fulfilled') {
        const map = {};
        (c.value || []).forEach(course => { map[course.id] = course; });
        setCourseMap(map);
      }
    } catch {}
    finally { setLoading(false); setRefresh(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefresh(true); fetchData(); };

  const renderItem = ({ item }) => {
    const startDate = item.started_at ? new Date(item.started_at) : null;
    const statusKey = SESSION_STATUS_KEYS[item.status] || SESSION_STATUS_KEYS.ended;
    const sStyle = item.status === 'active'
      ? { color: Colors.success, bg: Colors.successLight }
      : item.status === 'cancelled'
      ? { color: Colors.error, bg: Colors.errorLight }
      : { color: Colors.textMuted, bg: Colors.borderLight };
    const course    = courseMap[item.course_id];
    const isActive  = item.status === 'active';

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push({
          pathname: '/class-details',
          params: { courseId: item.course_id, sessionId: item.id, code: course?.code ?? '', title: course?.name ?? '' },
        })}
        activeOpacity={0.75}
      >
        {/* Sol ikon */}
        <View style={[styles.cardIconBox, { backgroundColor: isActive ? Colors.success + '22' : Colors.primaryMuted }]}>
          <Ionicons
            name={isActive ? 'play-circle' : 'book-outline'}
            size={20}
            color={isActive ? Colors.success : Colors.primary}
          />
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.courseCode} numberOfLines={1}>
                {course?.code ?? t('common.courseWithId', { id: item.course_id })}
              </Text>
              <Text style={styles.courseName} numberOfLines={1}>
                {course?.name ?? t('common.sessionWithId', { id: item.id })}
              </Text>
            </View>
            <View style={[styles.pill, { backgroundColor: sStyle.bg }]}>
              <Text style={[styles.pillText, { color: sStyle.color }]}>{t(statusKey)}</Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            {startDate && (
              <>
                <Ionicons name="calendar-outline" size={12} color={Colors.textMuted} />
                <Text style={styles.metaText}>{startDate.toLocaleDateString(dateLocale)}</Text>
                <Text style={styles.metaDot}>·</Text>
                <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
                <Text style={styles.metaText}>
                  {startDate.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
                </Text>
                {course?.enrolled_count != null && (
                  <>
                    <Text style={styles.metaDot}>·</Text>
                    <Ionicons name="people-outline" size={12} color={Colors.textMuted} />
                    <Text style={styles.metaText}>{t('common.studentCount', { count: course.enrolled_count })}</Text>
                  </>
                )}
              </>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{t('instructor.historyTitle')}</Text>
          <Text style={styles.headerSub}>{t('instructor.historySub')}</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
          <Ionicons name="refresh-outline" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <>
          <LinearGradient colors={['#1E3A8A', '#2563EB']} style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <SumStat label={t('instructor.myCourses')}   value={stats?.total_courses   ?? 0} />
              <View style={styles.sumDivider} />
              <SumStat label={t('attendance.enrolled')}        value={stats?.total_enrolled  ?? 0} />
              <View style={styles.sumDivider} />
              <SumStat label={t('attendance.flagged')}       value={stats?.flagged_records ?? 0} />
              <View style={styles.sumDivider} />
              <SumStat label={t('instructor.courseDetailSessions')}         value={list.length} />
            </View>
          </LinearGradient>

          <View style={styles.countRow}>
            <Text style={styles.countText}>{t('history.subHistory', { count: list.length })}</Text>
          </View>

          <FlatList
            data={list}
            renderItem={renderItem}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refresh} onRefresh={onRefresh} tintColor={Colors.primary} />}
            ListEmptyComponent={
              <View style={styles.centered}>
                <Ionicons name="calendar-outline" size={56} color={Colors.border} />
                <Text style={styles.emptyText}>{t('instructor.noSessions')}</Text>
              </View>
            }
          />
        </>
      )}
    </SafeAreaView>
  );
}

function SumStat({ label, value }) {
  return (
    <View style={styles.sumStat}>
      <Text style={styles.sumValue}>{value}</Text>
      <Text style={styles.sumLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  centered:{ paddingVertical: 60, alignItems: 'center' },

  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: Colors.text, letterSpacing: -0.4 },
  headerSub:   { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  refreshBtn:  { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.primaryMuted, alignItems: 'center', justifyContent: 'center' },

  summaryCard: { marginHorizontal: 20, marginBottom: 16, borderRadius: 20, padding: 20, ...Shadows.primary },
  summaryRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sumStat:     { flex: 1, alignItems: 'center' },
  sumValue:    { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  sumLabel:    { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600', marginTop: 3 },
  sumDivider:  { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.2)' },

  countRow:  { paddingHorizontal: 20, paddingBottom: 10 },
  countText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },

  listContent: { paddingHorizontal: 20, paddingBottom: 20 },
  card:        { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.card, borderRadius: 14, padding: 14, marginBottom: 10, ...Shadows.xs },
  cardIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardBody:    { flex: 1, gap: 5 },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  courseCode:  { fontSize: 14, fontWeight: '700', color: Colors.text },
  courseName:  { fontSize: 12, color: Colors.textSecondary, fontWeight: '500', marginTop: 1 },
  pill:        { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20, flexShrink: 0 },
  pillText:    { fontSize: 11, fontWeight: '700' },
  metaRow:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText:    { fontSize: 12, color: Colors.textMuted },
  metaDot:     { fontSize: 12, color: Colors.textMuted },

  emptyText: { fontSize: 14, color: Colors.textMuted, marginTop: 12 },
});
