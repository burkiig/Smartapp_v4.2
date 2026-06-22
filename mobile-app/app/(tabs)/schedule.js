import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, RefreshControl,
  Dimensions, ScrollView, Alert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useUser } from '@/context/UserContext';
import BottomSheet, { BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { courses, sessions, rooms as roomsApi } from '@/services/api';
import { Colors, Shadows } from '@/config/theme';
import HistoryScreen from './history';
import { useCalendar, useCancelReasons } from '@/i18n/helpers';

const { width } = Dimensions.get('window');

const DAY_EN   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// ── Yardımcı ─────────────────────────────────────────────────────────────────
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

function toIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}


// ── Öğretmen Ders Programı ────────────────────────────────────────────────────
function InstructorSchedule() {
  const router = useRouter();
  const { t } = useTranslation();
  const { daysShort, daysFull, months } = useCalendar();
  const cancelReasons = useCancelReasons();

  const [selectedDay,  setSelectedDay]  = useState(new Date().getDay());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [allCourses,   setAllCourses]   = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [faculties,    setFaculties]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [showAll,      setShowAll]      = useState(false);   // toggle "tüm dersler"

  // Oturum başlatma modal'ı
  const [startModal,   setStartModal]   = useState(false);
  const [startCourse,  setStartCourse]  = useState(null);
  const [selFaculty,   setSelFaculty]   = useState(null);
  const [starting,     setStarting]     = useState(false);
  const [facLoading,   setFacLoading]   = useState(false);
  const [cancelReason, setCancelReason] = useState(null);
  const [cancelModal,  setCancelModal]  = useState(false);
  const [cancelCourse, setCancelCourse] = useState(null);
  const [ending,       setEnding]       = useState(null); // session id being ended

  useEffect(() => {
    if (cancelReasons.length > 0 && !cancelReason) {
      setCancelReason(cancelReasons[0]);
    }
  }, [cancelReasons, cancelReason]);

  const sheetRef   = useRef(null);
  const snapPoints = useMemo(() => ['65%'], []);

  // ── Veri yükle ──────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const [c, s] = await Promise.allSettled([
        courses.list(),
        sessions.list({ status: 'active' }),   // sadece aktif oturumlar
      ]);
      if (c.status === 'fulfilled') setAllCourses(Array.isArray(c.value) ? c.value : []);
      if (s.status === 'fulfilled') {
        const raw = s.value;
        setActiveSessions(Array.isArray(raw) ? raw : (raw?.items || raw?.sessions || []));
      }
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  const fetchFaculties = useCallback(async () => {
    if (faculties.length > 0) return;
    setFacLoading(true);
    try {
      const data = await roomsApi.list();
      setFaculties(Array.isArray(data) ? data : []);
    } catch {}
    finally { setFacLoading(false); }
  }, [faculties.length]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  // ── Filtreler ────────────────────────────────────────────────────────────────
  const getActiveSession = useCallback((courseId) =>
    activeSessions.find(s => s.course_id === courseId && s.status === 'active'),
    [activeSessions]
  );

  // Bugünkü dersler (program verisi olup bu günü içerenler)
  const todayClasses = useMemo(() =>
    allCourses.filter(c => getCourseDayIndices(c).includes(selectedDay)),
    [allCourses, selectedDay]
  );

  // Herhangi bir program verisi olmayan / bu güne ait olmayan dersler
  const otherCourses = useMemo(() =>
    allCourses.filter(c => !getCourseDayIndices(c).includes(selectedDay)),
    [allCourses, selectedDay]
  );

  // ── Oturum işlemleri ─────────────────────────────────────────────────────────
  const openStartModal = (course) => {
    setStartCourse(course);
    setSelFaculty(null);
    setStartModal(true);
    fetchFaculties();
  };

  const handleStartSession = async () => {
    if (!selFaculty) { Alert.alert(t('attendance.selectFaculty'), t('attendance.selectBuildingBody')); return; }
    if (!selFaculty.latitude) { Alert.alert(t('attendance.gpsMissing'), t('attendance.gpsMissingBody', { name: selFaculty.name })); return; }
    setStarting(true);
    try {
      await sessions.start(startCourse.id, { room_id: selFaculty.id });
      setStartModal(false);
      Alert.alert(t('attendance.sessionStarted'), t('attendance.sessionStartedCourse', { code: startCourse.code, name: selFaculty.name, radius: selFaculty.geofence_radius }));
      fetchData();
    } catch (err) { Alert.alert(t('attendance.startFailed'), err?.message || t('attendance.startFailed')); }
    finally { setStarting(false); }
  };

  const handleEndSession = (session, courseName) => {
    Alert.alert(
      t('attendance.endConfirmTitle'),
      t('attendance.endConfirmBody'),
      [
        { text: t('common.no'), style: 'cancel' },
        { text: t('attendance.endSession'), style: 'destructive', onPress: async () => {
          setEnding(session.id);
          try {
            await sessions.end(session.id);
            fetchData();
            Alert.alert(t('common.done'), t('attendance.sessionEnded'));
          } catch (err) { Alert.alert(t('common.error'), err?.message || t('attendance.endFailed')); }
          finally { setEnding(null); }
        }},
      ]
    );
  };

  const openCancelModal = (course) => {
    setCancelCourse(course);
    setCancelReason(cancelReasons[0] ?? null);
    setCancelModal(true);
  };

  const handleCancelClass = async () => {
    if (!cancelCourse) return;
    const activeSes = getActiveSession(cancelCourse.id);
    const dayDelta = (selectedDay - new Date().getDay() + 7) % 7;
    const targetDateObj = new Date();
    targetDateObj.setDate(targetDateObj.getDate() + dayDelta);
    const courseTime = getCourseTime(cancelCourse);
    const [startTime, endTime] = courseTime ? courseTime.split(' – ') : [null, null];
    try {
      await sessions.cancel(cancelCourse.id, cancelReason, activeSes?.id, {
        date: toIsoDate(targetDateObj),
        start_time: startTime,
        end_time: endTime,
      });
      setCancelModal(false);
      Alert.alert(t('cancel.cancelled'), t('cancel.courseCancelled', { code: cancelCourse.code }));
      fetchData();
    } catch (err) { Alert.alert(t('common.error'), err?.message || t('cancel.cancelFailed')); }
  };

  // ── Takvim ───────────────────────────────────────────────────────────────────
  const handleDaySelect = (dayIdx) => setSelectedDay(dayIdx);

  const handleDateSelect = (day) => {
    const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
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

  // ── Kart render ──────────────────────────────────────────────────────────────
  const renderCourseCard = ({ item, showScheduleTag = false }) => {
    const session   = getActiveSession(item.id);
    const isLive    = !!session;
    const isEnding  = ending === session?.id;
    const time      = getCourseTime(item);
    const days      = getCourseDayIndices(item);
    const hasSchedule = days.length > 0;

    return (
      <View style={[styles.card, isLive && styles.cardLive]}>
        {/* Top row */}
        <TouchableOpacity
          style={styles.cardMain}
          onPress={() => router.push({ pathname: '/class-details', params: { courseId: item.id, code: item.code, title: item.name } })}
          activeOpacity={0.7}
        >
          <View style={[styles.cardIcon, { backgroundColor: isLive ? Colors.success + '22' : Colors.primaryMuted }]}>
            <Ionicons name={isLive ? 'play-circle' : 'book-outline'} size={22} color={isLive ? Colors.success : Colors.primary} />
          </View>
          <View style={styles.cardBody}>
            <View style={styles.cardTop}>
              <Text style={styles.courseCode}>{item.code}</Text>
              {isLive && (
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>{t('attendance.live')}</Text>
                </View>
              )}
              {!hasSchedule && (
                <View style={styles.noSchBadge}>
                  <Text style={styles.noSchText}>{t('common.notAvailable')}</Text>
                </View>
              )}
            </View>
            <Text style={styles.courseName} numberOfLines={1}>{item.name}</Text>
            <View style={styles.metaRow}>
              {time ? (
                <>
                  <Ionicons name="time-outline" size={11} color={Colors.textMuted} />
                  <Text style={styles.metaText}>{time}</Text>
                  <Text style={styles.metaDot}>·</Text>
                </>
              ) : null}
              <Ionicons name="people-outline" size={11} color={Colors.textMuted} />
              <Text style={styles.metaText}>{t('common.studentCount', { count: item.enrolled_count ?? 0 })}</Text>
            </View>
            {days.length > 0 && (
              <Text style={styles.schedDays} numberOfLines={1}>
                {days.map(d => daysShort[d]).join('  ')}
              </Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={15} color={Colors.textMuted} />
        </TouchableOpacity>

        {/* Action buttons */}
        <View style={styles.cardActions}>
          {isLive ? (
            <>
              <TouchableOpacity
                style={styles.endBtn}
                onPress={() => handleEndSession(session, item.code)}
                disabled={isEnding}
              >
                {isEnding
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="stop-circle" size={14} color="#fff" />}
                <Text style={styles.actionBtnText}>{t('attendance.endSession')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.manageBtn}
                onPress={() => router.push({ pathname: '/class-details', params: { courseId: item.id, code: item.code, title: item.name } })}
              >
                <Ionicons name="list-outline" size={14} color={Colors.primary} />
                <Text style={[styles.actionBtnText, { color: Colors.primary }]}>{t('common.manage')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => openCancelModal(item)}
              >
                <Ionicons name="close-circle-outline" size={14} color={Colors.error} />
                <Text style={[styles.actionBtnText, { color: Colors.error }]}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.startBtn}
                onPress={() => openStartModal(item)}
              >
                <Ionicons name="play-circle" size={14} color="#fff" />
                <Text style={styles.actionBtnText}>{t('attendance.startSession')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.manageBtn}
                onPress={() => router.push({ pathname: '/class-details', params: { courseId: item.id, code: item.code, title: item.name } })}
              >
                <Ionicons name="settings-outline" size={14} color={Colors.primary} />
                <Text style={[styles.actionBtnText, { color: Colors.primary }]}>{t('common.manage')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  const activeCount = activeSessions.filter(s => s.status === 'active').length;
  const today = new Date().getDay();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safe}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>{t('instructor.scheduleTitle')}</Text>
            <Text style={styles.headerSub}>
              {activeCount > 0
                ? `${activeCount} ${t('attendance.live').toLowerCase()}`
                : t('calendar.classCount', { count: allCourses.length })}
            </Text>
          </View>
          <View style={styles.headerBtns}>
            <TouchableOpacity style={styles.iconBtn} onPress={onRefresh}>
              <Ionicons name="refresh-outline" size={20} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => sheetRef.current?.expand()}>
              <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Aktif oturum özet banner */}
        {activeCount > 0 && (
          <LinearGradient colors={[Colors.success, '#059669']} style={styles.liveBanner}>
            <Ionicons name="radio" size={16} color="#fff" />
            <Text style={styles.liveBannerText}>{activeCount} {t('attendance.sessionActive')}</Text>
          </LinearGradient>
        )}

        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
        ) : (
          <FlatList
            style={styles.list}
            data={showAll ? allCourses : todayClasses}
            renderItem={({ item }) => renderCourseCard({ item })}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
            ListHeaderComponent={
              <>
                {/* Gün seçici — FlatList header içinde; dışarıda ScrollView dikey uzayıp kapsül görünümü veriyordu */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.dayScroll}
                  contentContainerStyle={styles.dayScrollContent}
                >
                  {[0, 1, 2, 3, 4, 5, 6].map(idx => {
                    const isActive = selectedDay === idx;
                    const isToday  = idx === today;
                    const cnt      = allCourses.filter(c => getCourseDayIndices(c).includes(idx)).length;
                    return (
                      <TouchableOpacity
                        key={idx}
                        style={[styles.dayBtn, isActive && styles.dayBtnActive, isToday && !isActive && styles.dayBtnToday]}
                        onPress={() => handleDaySelect(idx)}
                      >
                        <Text style={[styles.dayName, isActive && styles.dayNameActive, isToday && !isActive && styles.dayNameToday]}>
                          {daysShort[idx]}
                        </Text>
                        {cnt > 0 && <View style={[styles.dayDot, isActive && styles.dayDotActive]} />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <View style={styles.listHeader}>
                  <Text style={styles.listHeaderText}>
                    {showAll
                      ? `${t('instructor.showAllCourses')} (${allCourses.length})`
                      : `${t('calendar.classesOnDay', { day: daysFull[selectedDay] })} (${todayClasses.length})`}
                  </Text>
                  <TouchableOpacity style={styles.toggleBtn} onPress={() => setShowAll(v => !v)}>
                    <Ionicons name={showAll ? 'calendar-outline' : 'list-outline'} size={14} color={Colors.primary} />
                    <Text style={styles.toggleBtnText}>{showAll ? t('calendar.byDay') : t('calendar.showAll')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            }
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Ionicons name="calendar-outline" size={52} color={Colors.border} />
                <Text style={styles.emptyTitle}>{t('history.emptySchedule')}</Text>
                <Text style={styles.emptySubt}>{t('instructor.emptyScheduleHint')}</Text>
                <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowAll(true)}>
                  <Ionicons name="list-outline" size={15} color={Colors.primary} />
                  <Text style={styles.emptyBtnText}>{t('instructor.showAllCourses')}</Text>
                </TouchableOpacity>
              </View>
            }
          />
        )}

        {/* Yoklama Başlat Modal */}
        <Modal visible={startModal} transparent animationType="slide" onRequestClose={() => setStartModal(false)}>
          <View style={styles.overlay}>
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>{t('attendance.startSession')}</Text>
              <Text style={styles.sheetSub}>{startCourse?.code} — {startCourse?.name}</Text>
              <Text style={[styles.sheetSub, { marginBottom: 12 }]}>{t('attendance.selectBuildingBody')}</Text>

              {facLoading ? (
                <ActivityIndicator color={Colors.primary} size="large" style={{ marginVertical: 32 }} />
              ) : faculties.length === 0 ? (
                <Text style={styles.emptyTitle}>{t('attendance.noBuildingFound')}</Text>
              ) : (
                <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
                  {faculties.map(f => (
                    <TouchableOpacity
                      key={f.id}
                      style={[styles.facItem, selFaculty?.id === f.id && styles.facItemActive]}
                      onPress={() => setSelFaculty(f)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.facName}>{f.name}</Text>
                        {f.latitude
                          ? <Text style={styles.facGps}>📍 {f.latitude?.toFixed(4)}, {f.longitude?.toFixed(4)} — ±{f.geofence_radius}m</Text>
                          : <Text style={[styles.facGps, { color: Colors.error }]}>⚠ {t('attendance.gpsMissing')}</Text>}
                      </View>
                      {selFaculty?.id === f.id && <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              <View style={styles.sheetActions}>
                <TouchableOpacity style={styles.sheetCancel} onPress={() => setStartModal(false)}>
                  <Text style={styles.sheetCancelText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sheetConfirm, (!selFaculty || starting) && { opacity: 0.45 }]}
                  onPress={handleStartSession}
                  disabled={!selFaculty || starting}
                >
                  {starting
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.sheetConfirmText}>{t('common.start')}</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Ders İptali Modal */}
        <Modal visible={cancelModal} transparent animationType="slide" onRequestClose={() => setCancelModal(false)}>
          <View style={styles.overlay}>
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>{t('cancel.title')}</Text>
              <Text style={styles.sheetSub}>{cancelCourse?.code}</Text>
              {cancelReasons.map(r => (
                <TouchableOpacity
                  key={r}
                  style={[styles.reasonRow, cancelReason === r && styles.reasonRowActive]}
                  onPress={() => setCancelReason(r)}
                >
                  <Text style={[styles.reasonText, cancelReason === r && styles.reasonTextActive]}>{r}</Text>
                  {cancelReason === r && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
                </TouchableOpacity>
              ))}
              <View style={styles.sheetActions}>
                <TouchableOpacity style={styles.sheetCancel} onPress={() => setCancelModal(false)}>
                  <Text style={styles.sheetCancelText}>{t('common.giveUp')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.sheetConfirm, { backgroundColor: Colors.error }]} onPress={handleCancelClass}>
                  <Text style={styles.sheetConfirmText}>{t('cancel.cancelAction')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Takvim Bottom Sheet */}
        <BottomSheet
          ref={sheetRef}
          index={-1}
          snapPoints={snapPoints}
          enablePanDownToClose
          backdropComponent={renderBackdrop}
          backgroundStyle={styles.sheetBg}
          handleIndicatorStyle={styles.sheetHandle2}
        >
          <View style={styles.calContainer}>
            <View style={styles.calHeader}>
              <TouchableOpacity style={styles.monthBtn} onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}>
                <Ionicons name="chevron-back" size={20} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.monthText}>{months[currentMonth.getMonth()]} {currentMonth.getFullYear()}</Text>
              <TouchableOpacity style={styles.monthBtn} onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}>
                <Ionicons name="chevron-forward" size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.calDayNames}>
              {daysShort.map((d, i) => (
                <View key={i} style={styles.calDayName}>
                  <Text style={styles.calDayNameText}>{d}</Text>
                </View>
              ))}
            </View>
            <View style={styles.calGrid}>
              {Array.from({ length: startingDay }, (_, i) => <View key={`e${i}`} style={styles.calCell} />)}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const d   = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                const isSel = d.getDay() === selectedDay;
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
            <TouchableOpacity
              style={styles.todayBtn}
              onPress={() => { const t = new Date(); setCurrentMonth(t); setSelectedDay(t.getDay()); sheetRef.current?.close(); }}
            >
              <Ionicons name="today-outline" size={18} color={Colors.primary} />
              <Text style={styles.todayBtnText}>{t('calendar.goToToday')}</Text>
            </TouchableOpacity>
          </View>
        </BottomSheet>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}


// ── Ana export ────────────────────────────────────────────────────────────────
export default function ScheduleScreen() {
  const { user } = useUser();
  if (user?.role === 'student') return <HistoryScreen />;
  return <InstructorSchedule />;
}


// ── Stiller ───────────────────────────────────────────────────────────────────
const CELL_SIZE = (width - 40) / 7;

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  centered:{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },

  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  headerTitle: { fontSize: 24, fontWeight: '800', color: Colors.text, letterSpacing: -0.4 },
  headerSub:   { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  headerBtns:  { flexDirection: 'row', gap: 8 },
  iconBtn:     { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.primaryMuted, alignItems: 'center', justifyContent: 'center' },

  liveBanner:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 10 },
  liveBannerText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  list:             { flex: 1 },
  dayScroll:        { marginTop: 16, flexGrow: 0 },
  dayScrollContent: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  dayBtn:       { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 14, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Colors.border, ...Shadows.xs },
  dayBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dayBtnToday:  { borderColor: Colors.primary },
  dayName:      { fontSize: 12, fontWeight: '700', color: Colors.textMuted },
  dayNameActive:{ color: '#fff' },
  dayNameToday: { color: Colors.primary },
  dayDot:       { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.primary, marginTop: 4 },
  dayDotActive: { backgroundColor: 'rgba(255,255,255,0.7)' },

  listContent:    { paddingHorizontal: 16, paddingBottom: 24 },
  listHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  listHeaderText: { fontSize: 13, fontWeight: '700', color: Colors.text },
  toggleBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: Colors.primaryMuted, borderRadius: 8 },
  toggleBtnText:  { fontSize: 12, fontWeight: '700', color: Colors.primary },

  // Ders kartı
  card:     { backgroundColor: Colors.card, borderRadius: 16, marginBottom: 10, borderWidth: 1.5, borderColor: 'transparent', overflow: 'hidden', ...Shadows.xs },
  cardLive: { borderColor: Colors.success },
  cardMain: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  cardIcon: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardBody: { flex: 1, gap: 3 },
  cardTop:  { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  courseCode:  { fontSize: 14, fontWeight: '700', color: Colors.text },
  courseName:  { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  metaRow:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText:    { fontSize: 11, color: Colors.textMuted },
  metaDot:     { fontSize: 11, color: Colors.textMuted },
  schedDays:   { fontSize: 11, color: Colors.textMuted, fontWeight: '500', marginTop: 2 },

  liveBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.successLight, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  liveDot:    { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.success },
  liveText:   { fontSize: 10, fontWeight: '800', color: Colors.success, letterSpacing: 0.3 },
  noSchBadge: { backgroundColor: Colors.bgAlt, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  noSchText:  { fontSize: 10, fontWeight: '600', color: Colors.textMuted },

  // Aksiyon butonları
  cardActions: { flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingBottom: 12, paddingTop: 2 },
  startBtn:    { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: Colors.success, paddingVertical: 8, borderRadius: 10 },
  endBtn:      { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: Colors.error, paddingVertical: 8, borderRadius: 10 },
  manageBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: Colors.primaryMuted, paddingVertical: 8, borderRadius: 10 },
  cancelBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: Colors.errorMuted || Colors.errorLight, paddingVertical: 8, borderRadius: 10 },
  actionBtnText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  // Boş durum
  emptyBox:   { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginTop: 14, textAlign: 'center' },
  emptySubt:  { fontSize: 13, color: Colors.textMuted, marginTop: 6, textAlign: 'center', lineHeight: 20 },
  emptyBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18, paddingHorizontal: 20, paddingVertical: 11, backgroundColor: Colors.primaryMuted, borderRadius: 12 },
  emptyBtnText:{ fontSize: 13, fontWeight: '700', color: Colors.primary },

  // Modallar
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:        { backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  sheetHandle:  { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 20 },
  sheetTitle:   { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  sheetSub:     { fontSize: 13, color: Colors.textMuted, marginBottom: 6 },
  facItem:      { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, marginBottom: 8, backgroundColor: Colors.bgAlt },
  facItemActive:{ borderColor: Colors.primary, backgroundColor: Colors.primaryMuted },
  facName:      { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 3 },
  facGps:       { fontSize: 11, color: Colors.textMuted },
  reasonRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, marginBottom: 8 },
  reasonRowActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryMuted },
  reasonText:      { fontSize: 14, fontWeight: '500', color: Colors.textSecondary },
  reasonTextActive:{ color: Colors.primary, fontWeight: '600' },
  sheetActions:    { flexDirection: 'row', gap: 12, marginTop: 16 },
  sheetCancel:     { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  sheetCancelText: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  sheetConfirm:    { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center' },
  sheetConfirmText:{ fontSize: 14, fontWeight: '700', color: '#fff' },

  // Bottom Sheet
  sheetBg:     { backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  sheetHandle2:{ backgroundColor: Colors.border, width: 40, height: 4 },
  calContainer:{ flex: 1, paddingHorizontal: 20, paddingBottom: 20 },
  calHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  monthBtn:    { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.bgAlt, alignItems: 'center', justifyContent: 'center' },
  monthText:   { fontSize: 18, fontWeight: '700', color: Colors.text },
  calDayNames: { flexDirection: 'row', marginBottom: 8 },
  calDayName:  { width: CELL_SIZE, alignItems: 'center', paddingVertical: 6 },
  calDayNameText:{ fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  calGrid:     { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  calCell:     { width: CELL_SIZE, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  calCellSel:  { backgroundColor: Colors.primary, borderRadius: 12 },
  calCellToday:{ borderWidth: 2, borderColor: Colors.primary, borderRadius: 12 },
  calDayText:  { fontSize: 15, color: Colors.text, fontWeight: '500' },
  calDayTextSel:  { color: '#fff', fontWeight: '700' },
  calDayTextToday:{ color: Colors.primary, fontWeight: '700' },
  todayBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primaryMuted, paddingVertical: 14, borderRadius: 14 },
  todayBtnText:{ fontSize: 14, fontWeight: '700', color: Colors.primary },
});
