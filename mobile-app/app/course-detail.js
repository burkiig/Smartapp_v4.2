/**
 * Ders Detay Ekranı
 * - Sekmeler: Oturumlar | Genel Devam
 * - Oturumlar: her oturuma tıklanınca alt sheet ile öğrenci listesi + Katıldı/Mazeretli/Katılmadı butonları
 * - Genel Devam: öğrenci bazında devam yüzdesi, <%70 kırmızı uyarı
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, RefreshControl,
  ScrollView, Alert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { sessions, attendance as attendanceApi, courses as coursesApi } from '@/services/api';
import { Colors, Shadows } from '@/config/theme';

const ATTEND_BTN = [
  { status: 'present', label: 'Katıldı',   icon: 'checkmark-circle', color: Colors.success, bg: Colors.successLight },
  { status: 'excused', label: 'Mazeretli', icon: 'document-text',    color: Colors.warning, bg: Colors.warningLight },
  { status: 'absent',  label: 'Katılmadı', icon: 'close-circle',     color: Colors.error,   bg: Colors.errorLight   },
];

const STATUS_COLOR = { present: Colors.success, absent: Colors.error, excused: Colors.warning, pending_review: Colors.primary };
const STATUS_LABEL = { present: 'Katıldı', absent: 'Katılmadı', excused: 'Mazeretli', pending_review: 'İncelemede' };

// ── Yardımcı ─────────────────────────────────────────────────────────────────
function initials(name) {
  return (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function CourseDetailScreen() {
  const router = useRouter();
  const { courseId, code, title } = useLocalSearchParams();
  const cId = Number(courseId);

  const [tab,           setTab]           = useState('sessions');
  const [sessionList,   setSessionList]   = useState([]);
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [error,         setError]         = useState('');

  // Genel Devam sekmesi için tüm kurs kayıtları
  const [allCourseRecords, setAllCourseRecords] = useState([]);
  const [summaryLoading,   setSummaryLoading]   = useState(false);

  // Oturum detay modal
  const [modalVisible,  setModalVisible]  = useState(false);
  const [selSession,    setSelSession]    = useState(null);
  const [sessRecords,   setSessRecords]   = useState([]);  // attendance records for sel session
  const [sessLoading,   setSessLoading]   = useState(false);
  const [saving,        setSaving]        = useState(new Set());

  // ── Veri yükle ──────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setError('');
    try {
      const [sessRes, stuRes] = await Promise.allSettled([
        sessions.list({ course_id: cId }),
        coursesApi.students(cId),
      ]);
      if (sessRes.status === 'fulfilled') {
        const raw = sessRes.value;
        const list = Array.isArray(raw) ? raw : (raw?.items || raw?.sessions || []);
        setSessionList(list.sort((a, b) => new Date(b.started_at || 0) - new Date(a.started_at || 0)));
      }
      if (stuRes.status === 'fulfilled') {
        setEnrolledStudents(Array.isArray(stuRes.value) ? stuRes.value : []);
      }
    } catch (err) {
      setError(err?.message || 'Veriler yüklenemedi');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  // ── Oturum detay modalı ──────────────────────────────────────────────────────
  const openSessionDetail = async (sess) => {
    setSelSession(sess);
    setModalVisible(true);
    setSessLoading(true);
    setSessRecords([]);
    try {
      const res = await attendanceApi.getRecords({ course_id: cId, session_id: sess.id, page_size: 200 });
      const raw = Array.isArray(res) ? res : (res?.records || []);
      setSessRecords(raw);
    } catch (err) {
      Alert.alert('Hata', err?.message || 'Yoklama kayıtları yüklenemedi');
    } finally {
      setSessLoading(false);
    }
  };

  // Yoklama durumu değiştir (upsert)
  const handleOverride = useCallback(async (student, newStatus) => {
    if (saving.has(student.id)) return;
    setSaving(prev => new Set(prev).add(student.id));

    const existingRec = sessRecords.find(r => r.student_id === student.id);
    try {
      if (existingRec) {
        await attendanceApi.override(existingRec.id, newStatus, 'Öğretmen tarafından güncellendi');
      } else {
        await attendanceApi.setStatus(selSession.id, student.id, newStatus, 'Öğretmen tarafından oluşturuldu');
      }
      // Optimistik güncelleme
      setSessRecords(prev => {
        const idx = prev.findIndex(r => r.student_id === student.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], status: newStatus };
          return updated;
        }
        return [...prev, { student_id: student.id, session_id: selSession.id, course_id: cId, status: newStatus, id: -Date.now() }];
      });
    } catch (err) {
      Alert.alert('Güncelleme Hatası', err?.message || 'Durum değiştirilemedi');
    } finally {
      setSaving(prev => { const n = new Set(prev); n.delete(student.id); return n; });
    }
  }, [saving, sessRecords, selSession, cId]);

  // Genel Devam sekmesi açıldığında kurs kayıtlarını çek
  useEffect(() => {
    if (tab !== 'summary' || allCourseRecords.length > 0 || summaryLoading) return;
    setSummaryLoading(true);
    attendanceApi.getRecords({ course_id: cId, page_size: 1000 })
      .then(res => {
        const raw = Array.isArray(res) ? res : (res?.records || []);
        setAllCourseRecords(raw);
      })
      .catch(() => {})
      .finally(() => setSummaryLoading(false));
  }, [tab, cId, allCourseRecords.length, summaryLoading]);

  // ── Genel Devam hesapla ──────────────────────────────────────────────────────
  const attendanceSummary = useMemo(() => {
    if (enrolledStudents.length === 0) return [];
    const closedSessions = sessionList.filter(s => s.status === 'closed' || s.status === 'active');
    const totalSessions  = closedSessions.length;

    return enrolledStudents.map(stu => {
      const stuRecords = allCourseRecords.filter(r => r.student_id === stu.id);
      const presentCount = stuRecords.filter(r => r.status === 'present' || r.status === 'excused').length;
      const rate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : null;
      return {
        id: stu.id,
        name: stu.name || stu.username || `Öğrenci ${stu.id}`,
        number: stu.student_number || stu.username || '',
        totalSessions,
        present: presentCount,
        rate,
      };
    });
  }, [enrolledStudents, sessionList, allCourseRecords]);

  // Oturum listesi render
  const renderSession = ({ item }) => {
    const isActive  = item.status === 'active';
    const isClosed  = item.status === 'closed';
    const date = item.started_at ? new Date(item.started_at) : null;
    return (
      <TouchableOpacity
        style={[styles.sessCard, isActive && styles.sessCardLive]}
        onPress={() => openSessionDetail(item)}
        activeOpacity={0.75}
      >
        <View style={[styles.sessIcon, { backgroundColor: isActive ? Colors.success + '22' : Colors.bgAlt }]}>
          <Ionicons name={isActive ? 'radio' : 'time-outline'} size={20} color={isActive ? Colors.success : Colors.textMuted} />
        </View>
        <View style={styles.sessBody}>
          <View style={styles.sessTopRow}>
            <Text style={styles.sessId}>Oturum #{item.id}</Text>
            {isActive && (
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>CANLI</Text>
              </View>
            )}
            {isClosed && <Text style={styles.closedBadge}>Kapalı</Text>}
          </View>
          {date && (
            <Text style={styles.sessMeta}>
              {date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
              {'  '}
              {date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
      </TouchableOpacity>
    );
  };

  // Öğrenci devam satırı (modal içi)
  const renderStudentRow = ({ item: stu }) => {
    const rec     = sessRecords.find(r => r.student_id === stu.id);
    const status  = rec?.status || null;
    const isBusy  = saving.has(stu.id);
    return (
      <View style={styles.stuRow}>
        <View style={styles.stuAvatar}>
          <Text style={styles.stuAvatarText}>{initials(stu.name || stu.username)}</Text>
        </View>
        <View style={styles.stuInfo}>
          <Text style={styles.stuName} numberOfLines={1}>{stu.name || stu.username || `#${stu.id}`}</Text>
          {stu.student_number && <Text style={styles.stuNo}>{stu.student_number}</Text>}
        </View>
        {isBusy ? (
          <ActivityIndicator size="small" color={Colors.primary} style={{ marginRight: 4 }} />
        ) : (
          <View style={styles.overrideBtns}>
            {ATTEND_BTN.map(btn => {
              const isActive = status === btn.status;
              return (
                <TouchableOpacity
                  key={btn.status}
                  style={[styles.overrideBtn, isActive && { backgroundColor: btn.bg, borderColor: btn.color }]}
                  onPress={() => !isActive && handleOverride(stu, btn.status)}
                  disabled={isActive}
                >
                  <Ionicons name={btn.icon} size={14} color={isActive ? btn.color : Colors.textMuted} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  const presentCount = selSession ? sessRecords.filter(r => r.status === 'present').length : 0;
  const totalEnrolled = enrolledStudents.length;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerCode}>{code}</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        </View>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.push({ pathname: '/class-details', params: { courseId: cId, code, title } })}
        >
          <Ionicons name="play-circle-outline" size={22} color={Colors.success} />
        </TouchableOpacity>
      </View>

      {/* Alt sekmeler */}
      <View style={styles.tabs}>
        {[['sessions','Oturumlar'],['summary','Genel Devam']].map(([key, label]) => (
          <TouchableOpacity key={key} style={[styles.tab, tab === key && styles.tabActive]} onPress={() => setTab(key)}>
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={48} color={Colors.border} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchData}>
            <Text style={styles.retryText}>Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
      ) : tab === 'sessions' ? (
        <FlatList
          data={sessionList}
          renderItem={renderSession}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListHeaderComponent={
            <View style={styles.listHdr}>
              <Text style={styles.listHdrText}>{sessionList.length} oturum</Text>
              <Text style={styles.listHdrSub}>{enrolledStudents.length} kayıtlı öğrenci</Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Ionicons name="calendar-outline" size={52} color={Colors.border} />
              <Text style={styles.emptyText}>Henüz oturum başlatılmamış</Text>
            </View>
          }
        />
      ) : (
        /* Genel Devam sekmesi */
        summaryLoading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
        ) : (
          <FlatList
            data={attendanceSummary}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
            ListHeaderComponent={
              <View style={styles.listHdr}>
                <Text style={styles.listHdrText}>{enrolledStudents.length} öğrenci</Text>
                <Text style={styles.listHdrSub}>{sessionList.filter(s => s.status === 'closed').length} tamamlanan oturum</Text>
              </View>
            }
            renderItem={({ item: stu }) => {
              const low = stu.rate !== null && stu.rate < 70;
              return (
                <View style={styles.sumRow}>
                  <View style={[styles.stuAvatar, low && { backgroundColor: Colors.errorLight }]}>
                    <Text style={styles.stuAvatarText}>{initials(stu.name)}</Text>
                  </View>
                  <View style={styles.stuInfo}>
                    <Text style={styles.stuName} numberOfLines={1}>{stu.name}</Text>
                    {stu.number ? <Text style={styles.stuNo}>{stu.number}</Text> : null}
                  </View>
                  <View style={styles.sumRateBox}>
                    {stu.rate === null ? (
                      <Text style={styles.sumNote}>—</Text>
                    ) : (
                      <>
                        <Text style={[styles.sumRate, low && { color: Colors.error }]}>
                          %{stu.rate}
                        </Text>
                        <Text style={styles.sumDetail}>{stu.present}/{stu.totalSessions}</Text>
                        {low && <Text style={styles.sumWarn}>⚠ Düşük</Text>}
                      </>
                    )}
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.centered}>
                <Ionicons name="people-outline" size={52} color={Colors.border} />
                <Text style={styles.emptyText}>Kayıtlı öğrenci yok</Text>
              </View>
            }
          />
        )
      )}

      {/* Oturum Detay Modalı */}
      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={styles.modalSafe}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={22} color={Colors.text} />
            </TouchableOpacity>
            <View style={styles.modalHeaderCenter}>
              <Text style={styles.modalTitle}>Oturum #{selSession?.id}</Text>
              <Text style={styles.modalSub}>
                {selSession?.started_at
                  ? new Date(selSession.started_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
                  : ''}
              </Text>
            </View>
            <View style={{ width: 38 }} />
          </View>

          {/* Özet banner */}
          {!sessLoading && (
            <LinearGradient colors={['#1E3A8A', '#2563EB']} style={styles.modalBanner}>
              <View style={styles.modalBannerItem}>
                <Text style={styles.modalBannerVal}>{totalEnrolled}</Text>
                <Text style={styles.modalBannerLabel}>Toplam</Text>
              </View>
              <View style={styles.modalBannerDiv} />
              <View style={styles.modalBannerItem}>
                <Text style={styles.modalBannerVal}>{presentCount}</Text>
                <Text style={styles.modalBannerLabel}>Katıldı</Text>
              </View>
              <View style={styles.modalBannerDiv} />
              <View style={styles.modalBannerItem}>
                <Text style={styles.modalBannerVal}>{totalEnrolled - presentCount}</Text>
                <Text style={styles.modalBannerLabel}>Katılmadı</Text>
              </View>
              <View style={styles.modalBannerDiv} />
              <View style={styles.modalBannerItem}>
                <Text style={styles.modalBannerVal}>
                  {totalEnrolled > 0 ? `${Math.round(presentCount / totalEnrolled * 100)}%` : '—'}
                </Text>
                <Text style={styles.modalBannerLabel}>Oran</Text>
              </View>
            </LinearGradient>
          )}

          {/* Buton açıklaması */}
          <View style={styles.legendRow}>
            {ATTEND_BTN.map(b => (
              <View key={b.status} style={styles.legendItem}>
                <Ionicons name={b.icon} size={13} color={b.color} />
                <Text style={[styles.legendText, { color: b.color }]}>{b.label}</Text>
              </View>
            ))}
          </View>

          {sessLoading ? (
            <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
          ) : (
            <FlatList
              data={enrolledStudents}
              renderItem={renderStudentRow}
              keyExtractor={item => item.id.toString()}
              contentContainerStyle={styles.modalListContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.centered}>
                  <Text style={styles.emptyText}>Bu derse kayıtlı öğrenci yok</Text>
                </View>
              }
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Stiller ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  centered:{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },

  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, gap: 12 },
  backBtn:      { width: 38, height: 38, borderRadius: 11, backgroundColor: Colors.bgAlt, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1 },
  headerCode:   { fontSize: 11, fontWeight: '700', color: Colors.primary, letterSpacing: 0.5, textTransform: 'uppercase' },
  headerTitle:  { fontSize: 18, fontWeight: '800', color: Colors.text, letterSpacing: -0.3 },
  iconBtn:      { width: 38, height: 38, borderRadius: 11, backgroundColor: Colors.successLight, alignItems: 'center', justifyContent: 'center' },

  tabs:       { flexDirection: 'row', backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  tab:        { flex: 1, paddingVertical: 13, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive:  { borderBottomColor: Colors.primary },
  tabText:    { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  tabTextActive:{ color: Colors.primary },

  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  listHdr:     { paddingVertical: 14 },
  listHdrText: { fontSize: 15, fontWeight: '700', color: Colors.text },
  listHdrSub:  { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  sessCard:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.card, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1.5, borderColor: 'transparent', ...Shadows.xs },
  sessCardLive: { borderColor: Colors.success },
  sessIcon:     { width: 42, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sessBody:     { flex: 1, gap: 4 },
  sessTopRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sessId:       { fontSize: 14, fontWeight: '700', color: Colors.text },
  sessMeta:     { fontSize: 12, color: Colors.textMuted },

  livePill:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.successLight, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  liveDot:     { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.success },
  liveText:    { fontSize: 10, fontWeight: '800', color: Colors.success },
  closedBadge: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, backgroundColor: Colors.bgAlt, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },

  sumRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.card, borderRadius: 14, padding: 12, marginBottom: 8, ...Shadows.xs },
  sumNote: { fontSize: 11, color: Colors.textMuted, flexShrink: 1 },
  // stuSumRow: list-row variant used in the modal student summary list
  stuSumRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },

  emptyText: { fontSize: 14, color: Colors.textMuted, marginTop: 10, textAlign: 'center' },
  errorText: { fontSize: 14, color: Colors.error, marginTop: 12, textAlign: 'center', paddingHorizontal: 24 },
  retryBtn:  { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: Colors.primary, borderRadius: 10 },
  retryText: { color: '#fff', fontWeight: '700' },

  // Modal
  modalSafe:        { flex: 1, backgroundColor: Colors.bg },
  modalHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  closeBtn:         { width: 38, height: 38, borderRadius: 11, backgroundColor: Colors.bgAlt, alignItems: 'center', justifyContent: 'center' },
  modalHeaderCenter:{ flex: 1, alignItems: 'center' },
  modalTitle:       { fontSize: 17, fontWeight: '800', color: Colors.text },
  modalSub:         { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  modalBanner:      { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 16, paddingHorizontal: 20, marginHorizontal: 16, marginTop: 16, borderRadius: 16, ...Shadows.primary },
  modalBannerItem:  { alignItems: 'center', gap: 4 },
  modalBannerVal:   { fontSize: 22, fontWeight: '800', color: '#fff' },
  modalBannerLabel: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  modalBannerDiv:   { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },

  legendRow:  { flexDirection: 'row', justifyContent: 'center', gap: 20, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, marginHorizontal: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText: { fontSize: 11, fontWeight: '600' },

  modalListContent: { paddingHorizontal: 16, paddingBottom: 32 },
  stuRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  stuAvatar:     { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primaryMuted, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stuAvatarText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  stuInfo:       { flex: 1 },
  stuName:       { fontSize: 13, fontWeight: '600', color: Colors.text },
  stuNo:         { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  overrideBtns:  { flexDirection: 'row', gap: 6 },
  overrideBtn:   { width: 32, height: 32, borderRadius: 9, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgAlt },

  sumNote:    { fontSize: 11, color: Colors.textMuted, fontStyle: 'italic' },
  sumRateBox: { alignItems: 'flex-end', minWidth: 56 },
  sumRate:    { fontSize: 16, fontWeight: '800', color: Colors.success },
  sumDetail:  { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  sumWarn:    { fontSize: 10, color: Colors.error, fontWeight: '700', marginTop: 2 },
});
