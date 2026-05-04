import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, RefreshControl, Dimensions, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useUser } from '@/context/UserContext';
import BottomSheet, { BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { courses, sessions } from '@/services/api';
import { Colors, Shadows } from '@/config/theme';
import HistoryScreen from './history';

const { width } = Dimensions.get('window');

const DAY_TR = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const DAY_EN = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

function InstructorSchedule() {
  const router = useRouter();
  const [selectedDay,  setSelectedDay]  = useState(new Date().getDay());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [allCourses,   setAllCourses]   = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);

  const sheetRef  = useRef(null);
  const snapPoints = useMemo(() => ['65%'], []);

  const fetchData = useCallback(async () => {
    try {
      const [c, s] = await Promise.allSettled([courses.list(), sessions.list()]);
      if (c.status === 'fulfilled') setAllCourses(Array.isArray(c.value) ? c.value : []);
      if (s.status === 'fulfilled') setActiveSessions(Array.isArray(s.value) ? s.value : []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const getCourseDays = (sch) => {
    try {
      const s = typeof sch === 'string' ? JSON.parse(sch) : sch;
      return (s?.days || []).map(d => DAY_EN.indexOf(d)).filter(i => i >= 0);
    } catch { return []; }
  };

  const getCourseTime = (sch) => {
    try {
      const s = typeof sch === 'string' ? JSON.parse(sch) : sch;
      if (s?.start_time && s?.end_time) return `${s.start_time} – ${s.end_time}`;
      return '—';
    } catch { return '—'; }
  };

  const dayClasses = allCourses.filter(c => getCourseDays(c.schedule).includes(selectedDay));

  const getActiveSession = (courseId) =>
    activeSessions.find(s => s.course_id === courseId && s.status === 'active');

  const handleDaySelect = (dayIdx) => {
    setSelectedDay(dayIdx);
    const today = new Date();
    const d = new Date(today);
    d.setDate(today.getDate() + (dayIdx - today.getDay()));
    setSelectedDate(d);
  };

  const handleDateSelect = (day) => {
    const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    setSelectedDate(d);
    setSelectedDay(d.getDay());
    sheetRef.current?.close();
  };

  const getDayNumber = (dayIdx) => {
    const today = new Date();
    const d = new Date(today);
    d.setDate(today.getDate() + (dayIdx - today.getDay()));
    return d.getDate();
  };

  const { daysInMonth, startingDay } = useMemo(() => {
    const first = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const last  = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    return { daysInMonth: last.getDate(), startingDay: first.getDay() };
  }, [currentMonth]);

  const renderBackdrop = useCallback(
    (props) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />,
    []
  );

  const renderItem = ({ item }) => {
    const session = getActiveSession(item.id);
    const isLive  = !!session;
    const time    = getCourseTime(item.schedule);

    return (
      <TouchableOpacity
        style={[styles.card, isLive && styles.cardLive]}
        onPress={() => router.push({ pathname: '/class-details', params: { courseId: item.id, code: item.code, title: item.name } })}
        activeOpacity={0.75}
      >
        <View style={[styles.cardIcon, { backgroundColor: isLive ? Colors.success + '20' : Colors.primaryMuted }]}>
          <Ionicons name={isLive ? 'play-circle' : 'book-outline'} size={22} color={isLive ? Colors.success : Colors.primary} />
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <Text style={styles.courseCode}>{item.code}</Text>
            {isLive && (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>CANLI</Text>
              </View>
            )}
          </View>
          <Text style={styles.courseName} numberOfLines={1}>{item.name}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.metaText}>{time}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Ionicons name="people-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.metaText}>{item.enrolled_count ?? 0} öğrenci</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
      </TouchableOpacity>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Ders Programı</Text>
            <Text style={styles.headerSub}>Haftalık ders takvimi</Text>
          </View>
          <TouchableOpacity style={styles.calBtn} onPress={() => sheetRef.current?.expand()}>
            <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Day Selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroll} contentContainerStyle={styles.dayScrollContent}>
          {[0,1,2,3,4,5,6].map(idx => {
            const isActive = selectedDay === idx;
            return (
              <TouchableOpacity
                key={idx}
                style={[styles.dayBtn, isActive && styles.dayBtnActive]}
                onPress={() => handleDaySelect(idx)}
              >
                <Text style={[styles.dayName, isActive && styles.dayNameActive]}>{DAY_TR[idx]}</Text>
                <Text style={[styles.dayNum, isActive && styles.dayNumActive]}>{getDayNumber(idx)}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Count row */}
        <View style={styles.countRow}>
          <Text style={styles.countText}>{dayClasses.length} ders</Text>
        </View>

        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
        ) : (
          <FlatList
            data={dayClasses}
            renderItem={renderItem}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
            ListEmptyComponent={
              <View style={styles.centered}>
                <Ionicons name="calendar-outline" size={56} color={Colors.border} />
                <Text style={styles.emptyText}>Bu gün için ders yok</Text>
              </View>
            }
          />
        )}

        {/* Calendar Bottom Sheet */}
        <BottomSheet
          ref={sheetRef}
          index={-1}
          snapPoints={snapPoints}
          enablePanDownToClose
          backdropComponent={renderBackdrop}
          backgroundStyle={styles.sheetBg}
          handleIndicatorStyle={styles.sheetHandle}
        >
          <View style={styles.calContainer}>
            {/* Month navigation */}
            <View style={styles.calHeader}>
              <TouchableOpacity
                style={styles.monthBtn}
                onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
              >
                <Ionicons name="chevron-back" size={20} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.monthText}>{MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}</Text>
              <TouchableOpacity
                style={styles.monthBtn}
                onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
              >
                <Ionicons name="chevron-forward" size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {/* Day name headers */}
            <View style={styles.calDayNames}>
              {DAY_TR.map((d, i) => (
                <View key={i} style={styles.calDayName}>
                  <Text style={styles.calDayNameText}>{d}</Text>
                </View>
              ))}
            </View>

            {/* Grid */}
            <View style={styles.calGrid}>
              {Array.from({ length: startingDay }, (_, i) => (
                <View key={`e${i}`} style={styles.calCell} />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day  = i + 1;
                const d    = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                const isSel = d.toDateString() === selectedDate.toDateString();
                const isTod = d.toDateString() === new Date().toDateString();
                return (
                  <TouchableOpacity
                    key={day}
                    style={[styles.calCell, isSel && styles.calCellSel, isTod && !isSel && styles.calCellToday]}
                    onPress={() => handleDateSelect(day)}
                  >
                    <Text style={[styles.calDayText, isSel && styles.calDayTextSel, isTod && !isSel && styles.calDayTextToday]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Today button */}
            <TouchableOpacity
              style={styles.todayBtn}
              onPress={() => {
                const t = new Date();
                setCurrentMonth(t);
                setSelectedDate(t);
                setSelectedDay(t.getDay());
                sheetRef.current?.close();
              }}
            >
              <Ionicons name="today-outline" size={18} color={Colors.primary} />
              <Text style={styles.todayBtnText}>Bugüne Git</Text>
            </TouchableOpacity>
          </View>
        </BottomSheet>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

export default function ScheduleScreen() {
  const { user } = useUser();
  if (user?.role === 'student') return <HistoryScreen />;
  return <InstructorSchedule />;
}

const CELL_SIZE = (width - 40) / 7;

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  centered:{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },

  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  headerTitle: { fontSize: 24, fontWeight: '800', color: Colors.text, letterSpacing: -0.4 },
  headerSub:   { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  calBtn:      { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.primaryMuted, alignItems: 'center', justifyContent: 'center' },

  dayScroll:        { marginVertical: 16 },
  dayScrollContent: { paddingHorizontal: 20, gap: 8 },
  dayBtn:           { width: 54, height: 72, borderRadius: 16, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Colors.border, ...Shadows.xs },
  dayBtnActive:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dayName:          { fontSize: 11, fontWeight: '700', color: Colors.textMuted, marginBottom: 4, textTransform: 'uppercase' },
  dayNameActive:    { color: 'rgba(255,255,255,0.8)' },
  dayNum:           { fontSize: 20, fontWeight: '800', color: Colors.text },
  dayNumActive:     { color: '#fff' },

  countRow:  { paddingHorizontal: 20, paddingBottom: 10 },
  countText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },

  listContent: { paddingHorizontal: 20, paddingBottom: 20 },
  card:        { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.card, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: 'transparent', ...Shadows.xs },
  cardLive:    { borderColor: Colors.success },
  cardIcon:    { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardBody:    { flex: 1, gap: 4 },
  cardTop:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  courseCode:  { fontSize: 14, fontWeight: '700', color: Colors.text },
  liveBadge:   { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.successLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  liveDot:     { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success },
  liveText:    { fontSize: 10, fontWeight: '800', color: Colors.success, letterSpacing: 0.3 },
  courseName:  { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  metaRow:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText:    { fontSize: 11, color: Colors.textMuted },
  metaDot:     { fontSize: 11, color: Colors.textMuted },

  emptyText: { fontSize: 14, color: Colors.textMuted, marginTop: 12 },

  // Bottom Sheet
  sheetBg:     { backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  sheetHandle: { backgroundColor: Colors.border, width: 40, height: 4 },

  calContainer: { flex: 1, paddingHorizontal: 20, paddingBottom: 20 },
  calHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  monthBtn:     { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.bgAlt, alignItems: 'center', justifyContent: 'center' },
  monthText:    { fontSize: 18, fontWeight: '700', color: Colors.text },

  calDayNames:    { flexDirection: 'row', marginBottom: 8 },
  calDayName:     { width: CELL_SIZE, alignItems: 'center', paddingVertical: 6 },
  calDayNameText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },

  calGrid:        { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  calCell:        { width: CELL_SIZE, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  calCellSel:     { backgroundColor: Colors.primary, borderRadius: 12 },
  calCellToday:   { borderWidth: 2, borderColor: Colors.primary, borderRadius: 12 },
  calDayText:     { fontSize: 15, color: Colors.text, fontWeight: '500' },
  calDayTextSel:  { color: '#fff', fontWeight: '700' },
  calDayTextToday:{ color: Colors.primary, fontWeight: '700' },

  todayBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primaryMuted, paddingVertical: 14, borderRadius: 14 },
  todayBtnText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
});
