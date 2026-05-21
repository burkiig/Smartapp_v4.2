import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, FlatList, Alert, ActivityIndicator, RefreshControl, Dimensions,
  Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useUser } from '@/context/UserContext';
import InstructorHistory from '@/screens/InstructorHistory';
import { attendance, disputes, courses as coursesApi } from '@/services/api';
import { Colors, Shadows } from '@/config/theme';
import EmptyState from '@/components/EmptyState';

// ── Sabitler ─────────────────────────────────────────────────────────────────
const { width } = Dimensions.get('window');

// JS getDay() → 0=Paz,1=Pzt,...,6=Cmt
const DAY_TR  = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const DAY_EN  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAY_FULL = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

// Geçmiş filtre sabitleri
const FILTERS  = ['Tümü', 'Mevcut', 'Devamsız', 'Geç'];
const FILTER_K = { 'Tümü': null, 'Mevcut': 'present', 'Devamsız': 'absent', 'Geç': 'late' };
const STATUS   = {
  present: { label: 'Mevcut',    icon: 'checkmark-circle', color: Colors.success, bg: Colors.successLight },
  absent:  { label: 'Devamsız',  icon: 'close-circle',     color: Colors.error,   bg: Colors.errorLight   },
  excused: { label: 'Mazeretli', icon: 'document-text',    color: Colors.primary, bg: Colors.primaryLight },
  late:    { label: 'Geç',       icon: 'time',              color: Colors.warning, bg: Colors.warningLight },
};


// ── Yardımcı fonksiyonlar ─────────────────────────────────────────────────────
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
  if (s.start_time && s.end_time) return { start: s.start_time, end: s.end_time };
  if (Array.isArray(s.slots) && s.slots[0]) return { start: s.slots[0].start_time, end: s.slots[0].end_time };
  return null;
}

function minutesSinceMidnight(timeStr) {
  const [h, m] = (timeStr || '00:00').split(':').map(Number);
  return h * 60 + m;
}

function findNextClass(allCourses) {
  const now  = new Date();
  const todayIdx = now.getDay();
  const nowMin   = now.getHours() * 60 + now.getMinutes();

  // Önce bugün kalan dersler
  let candidates = [];
  for (const c of allCourses) {
    const days = getCourseDayIndices(c);
    if (!days.includes(todayIdx)) continue;
    const t = getCourseTime(c);
    if (!t) continue;
    const startMin = minutesSinceMidnight(t.start);
    if (startMin > nowMin) candidates.push({ course: c, dayIdx: todayIdx, daysAhead: 0, startMin });
  }
  if (candidates.length > 0) {
    candidates.sort((a, b) => a.startMin - b.startMin);
    return candidates[0];
  }

  // Bugün kalmadıysa önümüzdeki 7 günde ara
  for (let ahead = 1; ahead <= 7; ahead++) {
    const dayIdx = (todayIdx + ahead) % 7;
    for (const c of allCourses) {
      const days = getCourseDayIndices(c);
      if (!days.includes(dayIdx)) continue;
      const t = getCourseTime(c);
      if (!t) continue;
      candidates.push({ course: c, dayIdx, daysAhead: ahead, startMin: minutesSinceMidnight(t.start) });
    }
    if (candidates.length > 0) {
      candidates.sort((a, b) => a.startMin - b.startMin);
      return candidates[0];
    }
  }
  return null;
}


// ── Öğrenci Ders Programı ekranı ─────────────────────────────────────────────
function StudentSchedule() {
  const router = useRouter();
  const [tab,        setTab]        = useState('schedule');    // 'schedule' | 'history'
  const [courses,    setCourses]    = useState([]);
  const [history,    setHistory]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const [filter,     setFilter]     = useState('Tümü');
  // İtiraz modalı (Alert.prompt Android'de desteklenmiyor)
  const [disputeModal,  setDisputeModal]  = useState(false);
  const [disputeItem,   setDisputeItem]   = useState(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeLoading, setDisputeLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [cRes, hRes] = await Promise.allSettled([
        coursesApi.list(),
        attendance.myHistory(),
      ]);
      if (cRes.status === 'fulfilled') setCourses(Array.isArray(cRes.value) ? cRes.value : []);
      if (hRes.status === 'fulfilled') setHistory(Array.isArray(hRes.value) ? hRes.value : []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // 'history' sekmesi açıkken her 30 saniyede yoklama geçmişini güncelle
  // (öğretmenin yaptığı override değişikliklerini kısa sürede yansıtmak için)
  useEffect(() => {
    if (tab !== 'history') return;
    const refresh = async () => {
      try {
        const res = await attendance.myHistory();
        if (Array.isArray(res)) setHistory(res);
      } catch {}
    };
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [tab]);

  const onRefresh = () => { setRefreshing(true); fetchAll(); };

  const nextClass = useMemo(() => findNextClass(courses), [courses]);

  const dayClasses = useMemo(() =>
    courses.filter(c => getCourseDayIndices(c).includes(selectedDay)),
    [courses, selectedDay]
  );

  // Geçmiş filtrelemesi
  const histFiltered = useMemo(() => {
    const key = FILTER_K[filter];
    return key ? history.filter(r => r.status === key) : history;
  }, [history, filter]);

  const total   = history.length;
  const present = history.filter(r => r.status === 'present' || r.status === 'excused').length;
  const absent  = history.filter(r => r.status === 'absent').length;
  const rate    = total > 0 ? Math.round((present / total) * 100) : 0;
  const barColor = rate >= 80 ? Colors.success : rate >= 60 ? Colors.warning : Colors.error;

  const handleDispute = (item) => {
    if (!item.session_id) { Alert.alert('Uyarı', 'Bu kayıt için oturum bilgisi bulunamadı.'); return; }
    setDisputeItem(item);
    setDisputeReason('');
    setDisputeModal(true);
  };

  const submitDispute = async () => {
    if (!disputeReason.trim()) {
      Alert.alert('Uyarı', 'Lütfen itiraz nedeninizi yazın.');
      return;
    }
    setDisputeLoading(true);
    try {
      await disputes.submit({
        sessionId: disputeItem.session_id,
        courseId: disputeItem.course_id,
        reason: disputeReason.trim(),
      });
      setDisputeModal(false);
      Alert.alert('Başarılı', 'İtirazınız öğretmene iletildi.');
    } catch (err) {
      Alert.alert('Hata', err?.message || 'İtiraz gönderilemedi.');
    } finally {
      setDisputeLoading(false);
    }
  };

  const renderCourseCard = ({ item }) => {
    const t = getCourseTime(item);
    const names = item.instructor_names?.length ? item.instructor_names.join(' · ') : null;
    return (
      <View style={styles.courseCard}>
        <View style={styles.courseIcon}>
          <Ionicons name="book-outline" size={20} color={Colors.primary} />
        </View>
        <View style={styles.courseBody}>
          <Text style={styles.courseCode}>{item.code}</Text>
          <Text style={styles.courseName} numberOfLines={1}>{item.name}</Text>
          {t && (
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={11} color={Colors.textMuted} />
              <Text style={styles.metaText}>{t.start} – {t.end}</Text>
            </View>
          )}
          {names && (
            <View style={styles.metaRow}>
              <Ionicons name="person-outline" size={11} color={Colors.textMuted} />
              <Text style={styles.metaText} numberOfLines={1}>{names}</Text>
            </View>
          )}
        </View>
        <View style={styles.enrollBadge}>
          <Text style={styles.enrollCount}>{item.enrolled_count ?? 0}</Text>
          <Text style={styles.enrollLabel}>öğrenci</Text>
        </View>
      </View>
    );
  };

  const renderHistItem = ({ item }) => {
    const s = (item.is_flagged ? null : STATUS[item.status]) || STATUS.absent;
    const flagged = item.is_flagged;
    const date = new Date(item.marked_at);
    return (
      <View style={styles.histCard}>
        <View style={styles.datePill}>
          <Text style={styles.dateDay}>{date.getDate()}</Text>
          <Text style={styles.dateMon}>{date.toLocaleDateString('tr-TR', { month: 'short' })}</Text>
        </View>
        <View style={styles.histBody}>
          <Text style={styles.histCourse} numberOfLines={1}>
            {item.course_name || item.course_code || `Ders #${item.course_id}`}
          </Text>
          <Text style={styles.histTime}>
            {date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {flagged && item.flag_reason && (
            <View style={styles.flagRow}>
              <Ionicons name="flag" size={11} color={Colors.warning} />
              <Text style={styles.flagText}>{item.flag_reason}</Text>
            </View>
          )}
          {(item.status === 'absent' || item.status === 'pending_review') && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => router.push({
                  pathname: '/excuse-submit',
                  params: {
                    course_id: item.course_id,
                    session_id: item.session_id || '',
                    session_date: item.marked_at ? new Date(item.marked_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
                    course_name: item.course_name || item.course_code || '',
                  },
                })}
              >
                <Ionicons name="document-text-outline" size={12} color={Colors.primary} />
                <Text style={[styles.actionBtnText, { color: Colors.primary }]}>Mazeret</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDanger]} onPress={() => handleDispute(item)}>
                <Ionicons name="alert-circle-outline" size={12} color={Colors.error} />
                <Text style={[styles.actionBtnText, { color: Colors.error }]}>İtiraz</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: flagged ? Colors.warningLight : s.bg }]}>
          <Ionicons name={flagged ? 'flag' : s.icon} size={14} color={flagged ? Colors.warning : s.color} />
          <Text style={[styles.statusText, { color: flagged ? Colors.warning : s.color }]}>
            {flagged ? 'Bayraklı' : s.label}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{tab === 'schedule' ? 'Ders Programım' : 'Yoklama Geçmişim'}</Text>
          <Text style={styles.headerSub}>{tab === 'schedule' ? `${courses.length} derse kayıtlısın` : `${total} kayıt`}</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
          <Ionicons name="refresh-outline" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Sub-tabs */}
      <View style={styles.subTabs}>
        <TouchableOpacity
          style={[styles.subTab, tab === 'schedule' && styles.subTabActive]}
          onPress={() => setTab('schedule')}
        >
          <Ionicons name={tab === 'schedule' ? 'calendar' : 'calendar-outline'} size={15} color={tab === 'schedule' ? Colors.primary : Colors.textMuted} />
          <Text style={[styles.subTabText, tab === 'schedule' && styles.subTabTextActive]}>Program</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.subTab, tab === 'history' && styles.subTabActive]}
          onPress={() => setTab('history')}
        >
          <Ionicons name={tab === 'history' ? 'time' : 'time-outline'} size={15} color={tab === 'history' ? Colors.primary : Colors.textMuted} />
          <Text style={[styles.subTabText, tab === 'history' && styles.subTabTextActive]}>Geçmiş</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : tab === 'schedule' ? (
        /* ── PROGRAM ────────────────────────────────────────── */
        <FlatList
          data={dayClasses}
          renderItem={renderCourseCard}
          keyExtractor={item => item.id.toString()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListHeaderComponent={
            <>
              {/* Sıradaki ders kartı */}
              {nextClass && (
                <LinearGradient colors={['#1E3A8A', '#2563EB']} style={styles.nextCard}>
                  <View style={styles.nextHeader}>
                    <Ionicons name="alarm-outline" size={14} color="rgba(255,255,255,0.8)" />
                    <Text style={styles.nextLabel}>
                      {nextClass.daysAhead === 0
                        ? 'Sıradaki Dersim — Bugün'
                        : nextClass.daysAhead === 1
                        ? 'Sıradaki Dersim — Yarın'
                        : `Sıradaki Dersim — ${DAY_FULL[nextClass.dayIdx]}`}
                    </Text>
                  </View>
                  <Text style={styles.nextCode}>{nextClass.course.code}</Text>
                  <Text style={styles.nextName}>{nextClass.course.name}</Text>
                  <View style={styles.nextMeta}>
                    {(() => { const t = getCourseTime(nextClass.course); return t ? (
                      <>
                        <Ionicons name="time-outline" size={13} color="rgba(255,255,255,0.75)" />
                        <Text style={styles.nextMetaText}>{t.start} – {t.end}</Text>
                      </>
                    ) : null; })()}
                    {nextClass.course.instructor_names?.length > 0 && (
                      <>
                        <Text style={styles.nextMetaDot}>·</Text>
                        <Ionicons name="person-outline" size={13} color="rgba(255,255,255,0.75)" />
                        <Text style={styles.nextMetaText} numberOfLines={1}>
                          {nextClass.course.instructor_names.join(', ')}
                        </Text>
                      </>
                    )}
                  </View>
                </LinearGradient>
              )}

              {/* Gün seçici */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.dayScroll}
                contentContainerStyle={styles.dayScrollContent}
              >
                {[0, 1, 2, 3, 4, 5, 6].map(idx => {
                  const isToday  = idx === new Date().getDay();
                  const isActive = idx === selectedDay;
                  const count    = courses.filter(c => getCourseDayIndices(c).includes(idx)).length;
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.dayBtn, isActive && styles.dayBtnActive, isToday && !isActive && styles.dayBtnToday]}
                      onPress={() => setSelectedDay(idx)}
                    >
                      <Text style={[styles.dayName, isActive && styles.dayNameActive, isToday && !isActive && styles.dayNameToday]}>
                        {DAY_TR[idx]}
                      </Text>
                      {count > 0 && (
                        <View style={[styles.dayDot, isActive && styles.dayDotActive]} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Gün başlığı */}
              <View style={styles.dayTitle}>
                <Text style={styles.dayTitleText}>{DAY_FULL[selectedDay]} Dersleri</Text>
                <Text style={styles.dayTitleCount}>{dayClasses.length} ders</Text>
              </View>
            </>
          }
          ListEmptyComponent={
            <EmptyState
              icon="calendar-outline"
              title="Bu gün için kayıtlı ders yok"
              subtitle="Başka bir güne geçmeyi deneyin"
            />
          }
        />
      ) : (
        /* ── GEÇMİŞ ────────────────────────────────────────── */
        <FlatList
          data={histFiltered}
          renderItem={renderHistItem}
          keyExtractor={item => item.id.toString()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListHeaderComponent={
            <>
              {/* Devam oranı kartı */}
              <LinearGradient colors={['#1E3A8A', '#2563EB']} style={styles.rateCard}>
                <View style={styles.rateRow}>
                  <View>
                    <Text style={styles.rateLabel}>Devam Oranı</Text>
                    <Text style={styles.rateValue}>{rate}%</Text>
                  </View>
                  <View style={styles.rateStats}>
                    <MiniStat label="Toplam"  value={total}   />
                    <MiniStat label="Mevcut"  value={present} />
                    <MiniStat label="Yok"     value={absent}  />
                  </View>
                </View>
                <View style={styles.rateBg}>
                  <View style={[styles.rateFill, { width: `${rate}%`, backgroundColor: barColor }]} />
                </View>
              </LinearGradient>

              {/* Filtreler */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
                {FILTERS.map(f => (
                  <TouchableOpacity key={f} style={[styles.filterTab, filter === f && styles.filterTabActive]} onPress={() => setFilter(f)}>
                    <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={styles.countRow}>
                <Text style={styles.countText}>{histFiltered.length} kayıt</Text>
              </View>
            </>
          }
          ListEmptyComponent={
            <EmptyState
              icon="time-outline"
              title="Yoklama geçmişi bulunamadı"
              subtitle="Henüz katıldığınız bir ders kaydı yok"
            />
          }
        />
      )}

      {/* İtiraz Modalı — Alert.prompt Android'de çalışmadığı için özel modal */}
      <Modal
        visible={disputeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setDisputeModal(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.disputeOverlay}>
          <View style={styles.disputeBox}>
            <Text style={styles.disputeTitle}>İtiraz Gönder</Text>
            <Text style={styles.disputeSub}>İtiraz nedeninizi kısaca açıklayın:</Text>
            <TextInput
              style={styles.disputeInput}
              value={disputeReason}
              onChangeText={setDisputeReason}
              placeholder="Nedeninizi yazın..."
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={3}
              autoFocus
            />
            <View style={styles.disputeBtns}>
              <TouchableOpacity
                style={styles.disputeBtnCancel}
                onPress={() => setDisputeModal(false)}
                disabled={disputeLoading}
              >
                <Text style={styles.disputeBtnCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.disputeBtnSend, disputeLoading && { opacity: 0.6 }]}
                onPress={submitDispute}
                disabled={disputeLoading}
              >
                {disputeLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.disputeBtnSendText}>Gönder</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}


// ── Yardımcı bileşenler ───────────────────────────────────────────────────────
function MiniStat({ label, value }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniVal}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}


// ── Ana export ────────────────────────────────────────────────────────────────
export default function HistoryScreen() {
  const { user } = useUser();
  if (user?.role === 'instructor' || user?.role === 'admin') return <InstructorHistory />;
  return <StudentSchedule />;
}


// ── Stiller ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  centered:{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },

  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.text, letterSpacing: -0.4 },
  headerSub:   { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  refreshBtn:  { width: 38, height: 38, borderRadius: 12, backgroundColor: Colors.primaryMuted, alignItems: 'center', justifyContent: 'center' },

  // Sub-tabs
  subTabs:        { flexDirection: 'row', backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  subTab:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  subTabActive:   { borderBottomColor: Colors.primary },
  subTabText:     { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  subTabTextActive:{ color: Colors.primary },

  // Sıradaki ders
  nextCard:    { marginHorizontal: 16, marginTop: 16, marginBottom: 4, borderRadius: 18, padding: 18, ...Shadows.primary },
  nextHeader:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  nextLabel:   { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 0.5 },
  nextCode:    { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.4 },
  nextName:    { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2, marginBottom: 10 },
  nextMeta:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  nextMetaText:{ fontSize: 12, color: 'rgba(255,255,255,0.75)', flexShrink: 1 },
  nextMetaDot: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },

  // Gün seçici
  dayScroll:        { marginTop: 16 },
  dayScrollContent: { paddingHorizontal: 16, gap: 8 },
  dayBtn:       { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 14, backgroundColor: Colors.card, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border, ...Shadows.xs },
  dayBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dayBtnToday:  { borderColor: Colors.primary },
  dayName:      { fontSize: 12, fontWeight: '700', color: Colors.textMuted },
  dayNameActive:{ color: '#fff' },
  dayNameToday: { color: Colors.primary },
  dayDot:       { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.primary, marginTop: 4 },
  dayDotActive: { backgroundColor: 'rgba(255,255,255,0.7)' },

  dayTitle:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginTop: 16, marginBottom: 8 },
  dayTitleText: { fontSize: 13, fontWeight: '700', color: Colors.text },
  dayTitleCount:{ fontSize: 12, color: Colors.textMuted },

  // Ders kartı
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  courseCard:  { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.card, borderRadius: 14, padding: 14, marginBottom: 8, ...Shadows.xs },
  courseIcon:  { width: 42, height: 42, borderRadius: 12, backgroundColor: Colors.primaryMuted, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  courseBody:  { flex: 1, gap: 3 },
  courseCode:  { fontSize: 14, fontWeight: '700', color: Colors.text },
  courseName:  { fontSize: 12, color: Colors.textSecondary },
  metaRow:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  metaText:    { fontSize: 11, color: Colors.textMuted, flexShrink: 1 },
  enrollBadge: { alignItems: 'center', flexShrink: 0 },
  enrollCount: { fontSize: 16, fontWeight: '800', color: Colors.primary },
  enrollLabel: { fontSize: 10, color: Colors.textMuted },

  // Geçmiş — devam oranı kartı
  rateCard:  { marginHorizontal: 16, marginTop: 16, marginBottom: 4, borderRadius: 20, padding: 20, ...Shadows.primary },
  rateRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  rateLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600', marginBottom: 4 },
  rateValue: { fontSize: 40, fontWeight: '800', color: '#fff', letterSpacing: -1 },
  rateStats: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  miniStat:  { alignItems: 'center', gap: 2 },
  miniVal:   { fontSize: 18, fontWeight: '800', color: '#fff' },
  miniLabel: { fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: '600' },
  rateBg:    { height: 6, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 3, overflow: 'hidden' },
  rateFill:  { height: '100%', borderRadius: 3 },

  // Filtre
  filterScroll:    { maxHeight: 46, marginTop: 12 },
  filterContent:   { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  filterTab:       { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border },
  filterTabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText:      { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  filterTextActive:{ color: '#fff' },
  countRow:        { paddingHorizontal: 16, paddingVertical: 8 },
  countText:       { fontSize: 13, fontWeight: '600', color: Colors.textMuted },

  // Geçmiş kayıt kartı
  histCard:  { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.card, borderRadius: 16, padding: 14, marginBottom: 10, ...Shadows.xs },
  datePill:  { width: 48, alignItems: 'center', backgroundColor: Colors.primaryMuted, borderRadius: 12, paddingVertical: 8, flexShrink: 0 },
  dateDay:   { fontSize: 20, fontWeight: '800', color: Colors.primary },
  dateMon:   { fontSize: 11, fontWeight: '700', color: Colors.primary, textTransform: 'uppercase' },
  histBody:  { flex: 1, gap: 3 },
  histCourse:{ fontSize: 14, fontWeight: '700', color: Colors.text },
  histTime:  { fontSize: 12, color: Colors.textMuted },
  flagRow:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  flagText:  { fontSize: 11, color: Colors.warning, fontWeight: '600' },
  actionRow:       { flexDirection: 'row', gap: 6, marginTop: 6 },
  actionBtn:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: Colors.primaryMuted, borderRadius: 8 },
  actionBtnDanger: { backgroundColor: Colors.errorMuted },
  actionBtnText:   { fontSize: 11, fontWeight: '700' },
  statusBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20, flexShrink: 0 },
  statusText:      { fontSize: 11, fontWeight: '700' },

  emptyText: { fontSize: 14, color: Colors.textMuted, marginTop: 12, textAlign: 'center' },

  // İtiraz modalı
  disputeOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  disputeBox:          { backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12, paddingBottom: 32 },
  disputeTitle:        { fontSize: 18, fontWeight: '800', color: Colors.text },
  disputeSub:          { fontSize: 13, color: Colors.textMuted },
  disputeInput:        { backgroundColor: Colors.bgAlt, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 14, fontSize: 14, color: Colors.text, minHeight: 80, textAlignVertical: 'top' },
  disputeBtns:         { flexDirection: 'row', gap: 10, marginTop: 4 },
  disputeBtnCancel:    { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: Colors.bgAlt, borderWidth: 1, borderColor: Colors.border },
  disputeBtnCancelText:{ fontSize: 15, fontWeight: '600', color: Colors.text },
  disputeBtnSend:      { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: Colors.primary },
  disputeBtnSendText:  { fontSize: 15, fontWeight: '700', color: '#fff' },
});
