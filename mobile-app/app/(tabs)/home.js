import React, { useState, useEffect, useCallback } from 'react';
import { ScrollView, StyleSheet, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUser } from '../_context/UserContext';
import InstructorHome from '../_screens/InstructorHome';
import Header from '../components/home/Header';
import LiveClassCard from '../components/home/LiveClassCard';
import QuickActions from '../components/home/QuickActions';
import MonthStats from '../components/home/MonthStats';
import RecentActivity from '../components/home/RecentActivity';
import { sessions, dashboard, courses } from '../shared/services/api';

// ─── Öğrenci Ana Ekranı ───────────────────────────────────────────────────────
function StudentHomeScreen() {
  const router = useRouter();
  const { userName } = useUser();

  // expo-camera v17 hook-based permission API


  const [liveSession, setLiveSession] = useState(null);
  const [courseMap, setCourseMap] = useState({});
  const [stats, setStats] = useState({ percentage: 0, totalDays: 0, present: 0, absent: 0 });
  const [recentActivity, setRecentActivity] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [sessRes, coursesRes, statRes] = await Promise.allSettled([
        sessions.getActive(),
        courses.list(),
        dashboard.stats(),
      ]);

      // Aktif oturum
      const activeSessions = sessRes.status === 'fulfilled' && Array.isArray(sessRes.value)
        ? sessRes.value : [];
      setLiveSession(activeSessions.length > 0 ? activeSessions[0] : null);

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
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Aktif oturumu 30 saniyede bir kontrol et — sadece sessions/active, diğer endpoint'ler değil
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const result = await sessions.getActive();
        const active = Array.isArray(result) ? result : [];
        setLiveSession(prev => {
          const newId = active[0]?.id ?? null;
          const oldId = prev?.id ?? null;
          return newId === oldId ? prev : (active[0] || null);
        });
      } catch { }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

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
  const { userType } = useUser();

  if (userType === 'instructor' || userType === 'admin') {
    return <InstructorHome />;
  }
  return <StudentHomeScreen />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
});
