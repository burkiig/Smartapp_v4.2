import React, { useState, useEffect, useCallback } from 'react';
import { ScrollView, StyleSheet, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUser } from '@/context/UserContext';
import InstructorHome from '@/screens/InstructorHome';
import Header from '../components/home/Header';
import LiveClassCard from '../components/home/LiveClassCard';
import QuickActions from '../components/home/QuickActions';
import MonthStats from '../components/home/MonthStats';
import RecentActivity from '../components/home/RecentActivity';
import { dashboard, courses } from '@/services/api';
import { useActiveSessionsQuery } from '@/query/hooks/useActiveSessionsQuery';

// ─── Öğrenci Ana Ekranı ───────────────────────────────────────────────────────
function StudentHomeScreen() {
  const router = useRouter();
  const { user } = useUser();
  const userName = user?.name || user?.username || '';

  // expo-camera v17 hook-based permission API


  const [courseMap, setCourseMap] = useState({});
  const [stats, setStats] = useState({ percentage: 0, totalDays: 0, present: 0, absent: 0 });
  const [recentActivity, setRecentActivity] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const { data: activeSessions = [], refetch: refetchSessions } = useActiveSessionsQuery({
    refetchInterval: 30_000,
  });
  const liveSession = activeSessions[0] ?? null;

  const fetchData = useCallback(async () => {
    try {
      await refetchSessions();
      const [coursesRes, statRes] = await Promise.allSettled([
        courses.list(),
        dashboard.stats(),
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
    } catch (err) {
      console.error('[HomeScreen] fetchData error:', err?.message || err);
    } finally {
      setRefreshing(false);
    }
  }, [refetchSessions]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const handleStartAttendance = () => {
    if (!liveSession) {
      Alert.alert('Aktif Ders Yok', 'Şu an aktif bir yoklama oturumu bulunmuyor.');
      return;
    }
    router.push({ pathname: '/qr-scan', params: { session_id: liveSession.id } });
  };

  // Aktif ders kartı için nesne oluştur
  const activeCourse = liveSession ? (courseMap[liveSession.course_id] || null) : null;
  const liveClass = liveSession ? {
    course: activeCourse?.code || activeCourse?.name || `Ders #${liveSession.course_id}`,
    title: activeCourse?.name || `Oturum #${liveSession.id}`,
    time: liveSession.start_time
      ? `${liveSession.start_time}${liveSession.end_time ? ' – ' + liveSession.end_time : ''}`
      : (activeCourse?.schedule || '—'),
    room: activeCourse?.room_name || '—',
    instructor: activeCourse?.instructor_name || '—',
  } : null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Header userName={userName} onRefresh={onRefresh} />

        {liveClass && (
          <LiveClassCard
            liveClass={liveClass}
            onStartAttendance={handleStartAttendance}
          />
        )}

        <QuickActions
          hasLiveSession={!!liveSession}
          onStartAttendance={handleStartAttendance}
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
});
