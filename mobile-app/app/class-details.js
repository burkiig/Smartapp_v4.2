import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, FlatList, TextInput, Modal, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { sessions, rooms as roomsApi, attendance as attendanceApi, courses as coursesApi } from '@/services/api';
import { Colors, Shadows } from '@/config/theme';
import { getDateLocale, useCancelReasons, useAttendanceStatusLabel } from '@/i18n';

const STATUS_META = {
  present: { color: Colors.success, bg: Colors.successLight },
  absent:  { color: Colors.error,   bg: Colors.errorLight   },
  excused: { color: Colors.warning, bg: Colors.warningLight },
};

export default function ClassDetailsScreen() {
  const router  = useRouter();
  const { t } = useTranslation();
  const getStatusLabel = useAttendanceStatusLabel();
  const cancelReasons = useCancelReasons();
  const params   = useLocalSearchParams();
  const courseId  = params.courseId  ? Number(params.courseId)  : null;
  const sessionId = params.sessionId ? Number(params.sessionId) : null;

  const [tab,           setTab]           = useState('overview');
  const [students,      setStudents]      = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [faculties,     setFaculties]     = useState([]);
  const [selFaculty,    setSelFaculty]    = useState(null);
  const [search,        setSearch]        = useState('');
  const [unsaved,       setUnsaved]       = useState(false);
  const [loading,       setLoading]       = useState(false);

  // Modals
  const [facultyModal, setFacultyModal] = useState(false);
  const [cancelModal,  setCancelModal]  = useState(false);
  const [cancelReason, setCancelReason] = useState(null);
  const [starting,     setStarting]     = useState(false);
  const [facLoading,   setFacLoading]   = useState(false);

  useEffect(() => {
    if (cancelReasons.length > 0 && !cancelReason) {
      setCancelReason(cancelReasons[0]);
    }
  }, [cancelReasons, cancelReason]);

  useEffect(() => {
    if (courseId) {
      checkSession(courseId);
      // Belirli bir session_id paramı varsa o oturumun kayıtlarını yükle
      loadStudents(courseId, sessionId || null);
    }
  }, []);

  useEffect(() => {
    if (facultyModal && faculties.length === 0) fetchFaculties();
  }, [facultyModal]);

  const checkSession = async (id) => {
    try {
      const data = await sessions.list({ course_id: id, status: 'active' });
      if (Array.isArray(data) && data.length > 0) setActiveSession(data[0]);
    } catch {}
  };

  const loadStudents = async (id, sessionId = null) => {
    setLoading(true);
    try {
      const recordParams = sessionId ? { course_id: id, session_id: sessionId } : { course_id: id };
      const [enrolled, records] = await Promise.allSettled([
        coursesApi.students(id),
        attendanceApi.getRecords(recordParams),
      ]);
      const statusMap = {};
      if (records.status === 'fulfilled') {
        // Backend paginated response: { records: [...], total, page, ... } veya doğrudan dizi
        const rawRecords = Array.isArray(records.value)
          ? records.value
          : (records.value?.records ?? []);
        rawRecords.forEach(r => {
          statusMap[r.student_id] = { status: r.status, dbId: r.id, recSessionId: r.session_id };
        });
      }
      if (enrolled.status === 'fulfilled' && Array.isArray(enrolled.value) && enrolled.value.length > 0) {
        setStudents(enrolled.value.map(s => {
          const rec  = statusMap[s.id] || {};
          const name = s.name || s.username || t('common.studentWithId', { id: s.id });
          return {
            id: String(s.id),
            dbId: rec.dbId || null,
            recSessionId: rec.recSessionId || null,
            name,
            status: rec.status || 'absent',
            avatar: name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
          };
        }));
      } else if (records.status === 'fulfilled') {
        const recs = Array.isArray(records.value)
          ? records.value
          : (records.value?.records ?? []);
        setStudents(recs.map(r => ({
          id: String(r.student_id),
          dbId: r.id,
          recSessionId: r.session_id,
          name: r.student_name || t('common.studentWithId', { id: r.student_id }),
          status: r.status || 'absent',
          avatar: (r.student_name || `S${r.student_id}`).split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
        })));
      }
    } catch {}
    finally { setLoading(false); }
  };

  const fetchFaculties = async () => {
    setFacLoading(true);
    try {
      const data = await roomsApi.list();
      setFaculties(Array.isArray(data) ? data : []);
    } catch (err) { Alert.alert(t('common.error'), err?.message || t('attendance.facultiesLoadFailed')); }
    finally { setFacLoading(false); }
  };

  const handleStartSession = async () => {
    if (!selFaculty) { Alert.alert(t('attendance.selectFaculty'), t('attendance.selectFacultyBody')); return; }
    if (!selFaculty.latitude) { Alert.alert(t('attendance.gpsMissing'), t('attendance.gpsMissingBody', { name: selFaculty.name })); return; }
    if (!courseId) { Alert.alert(t('common.error'), t('attendance.missingCourse')); return; }
    setStarting(true);
    setFacultyModal(false);
    try {
      const result = await sessions.start(courseId, { room_id: selFaculty.id });
      setActiveSession(result.session);
      Alert.alert(t('attendance.sessionStarted'), t('attendance.sessionStartedBody', { name: selFaculty.name, radius: selFaculty.geofence_radius }));
    } catch (err) { Alert.alert(t('attendance.startFailed'), err?.message || t('attendance.startFailed')); }
    finally { setStarting(false); }
  };

  const handleEndSession = () => {
    if (!activeSession) return;
    Alert.alert(t('attendance.endConfirmTitle'), t('attendance.endConfirmBody'), [
      { text: t('common.no'), style: 'cancel' },
      { text: t('attendance.endSession'), style: 'destructive', onPress: async () => {
        try { await sessions.end(activeSession.id); setActiveSession(null); Alert.alert(t('common.done'), t('attendance.sessionEnded')); }
        catch (err) { Alert.alert(t('common.error'), err?.message); }
      }},
    ]);
  };

  const handleCancelClass = () => {
    if (!courseId) return;
    Alert.alert(t('cancel.title'), t('cancel.reasonPrefix', { reason: cancelReason }), [
      { text: t('common.giveUp'), style: 'cancel' },
      { text: t('cancel.cancelAction'), style: 'destructive', onPress: async () => {
        try {
          await sessions.cancel(courseId, cancelReason, activeSession?.id);
          setActiveSession(null);
          setCancelModal(false);
          Alert.alert(t('cancel.cancelled'), t('cancel.classCancelled'), [{ text: t('common.ok'), onPress: () => router.back() }]);
        } catch (err) { Alert.alert(t('common.error'), err?.message || t('cancel.cancelFailed')); }
      }},
    ]);
  };

  const handleMark = (studentId, newStatus) => {
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, status: newStatus } : s));
    setUnsaved(true);
  };

  const handleSave = async () => {
    const sessionId = activeSession?.id;
    const withRecord   = students.filter(s => s.dbId);
    const withoutRecord = students.filter(s => !s.dbId && sessionId);

    if (withRecord.length === 0 && withoutRecord.length === 0) {
      Alert.alert(t('common.info'), t('attendance.noRecordsToUpdate'));
      return;
    }
    try {
      const ops = [
        ...withRecord.map(s => attendanceApi.override(s.dbId, s.status, t('attendance.teacherManualUpdate'))),
        ...withoutRecord.map(s => attendanceApi.setStatus(sessionId, Number(s.id), s.status, t('attendance.teacherCreated'))),
      ];
      const results = await Promise.allSettled(ops);
      const fail = results.filter(r => r.status === 'rejected').length;
      const total = ops.length;
      setUnsaved(false);
      if (fail > 0) {
        Alert.alert(t('attendance.partialSaved'), t('attendance.partialSavedBody', { success: total - fail, total }));
      } else {
        Alert.alert(t('attendance.saved'), t('attendance.savedStudents', { count: total }));
      }
      // Yüklü listeyi yenile
      if (courseId) loadStudents(courseId, sessionId);
    } catch (err) { Alert.alert(t('common.error'), err?.message); }
  };

  const code    = params.code    || t('common.notAvailable');
  const title   = params.title   || t('common.notAvailable');
  const dateLocale = getDateLocale();
  const present = students.filter(s => s.status === 'present').length;
  const absent  = students.filter(s => s.status === 'absent').length;
  const excused = students.filter(s => s.status === 'excused').length;
  const total   = students.length;

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) || s.id.includes(search)
  );

  const timeline = activeSession
    ? [
        { time: activeSession.started_at ? new Date(activeSession.started_at).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' }) : t('common.notAvailable'), event: t('attendance.sessionStartedEvent'), type: 'success' },
        { time: t('common.notAvailable'), event: `${present} ${getStatusLabel('present')} · ${absent} ${getStatusLabel('absent')} · ${excused} ${getStatusLabel('excused')}`, type: 'info' },
      ]
    : [{ time: t('common.notAvailable'), event: t('attendance.notStartedYet'), type: 'info' }];

  const renderStudent = ({ item }) => {
    const s = STATUS_META[item.status] || STATUS_META.absent;
    return (
      <View style={styles.studentCard}>
        <View style={styles.avatarBox}>
          <Text style={styles.avatarText}>{item.avatar}</Text>
        </View>
        <View style={styles.studentBody}>
          <Text style={styles.studentName}>{item.name}</Text>
          <Text style={styles.studentId}>#{item.id}</Text>
        </View>
        {tab === 'manual' ? (
          <View style={styles.markBtns}>
            {['present', 'excused', 'absent'].map(st => {
              const m = STATUS_META[st];
              const active = item.status === st;
              return (
                <TouchableOpacity
                  key={st}
                  style={[styles.markBtn, active && { backgroundColor: m.bg, borderColor: m.color }]}
                  onPress={() => handleMark(item.id, st)}
                >
                  <Text style={[styles.markBtnText, active && { color: m.color }]}>
                    {getStatusLabel(st)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
            <Text style={[styles.statusText, { color: s.color }]}>{getStatusLabel(item.status)}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{code}</Text>
          <Text style={styles.headerSub} numberOfLines={1}>{title}</Text>
        </View>
        <TouchableOpacity style={styles.cancelIconBtn} onPress={() => setCancelModal(true)}>
          <Ionicons name="close-circle-outline" size={22} color={Colors.error} />
        </TouchableOpacity>
      </View>

      {/* Session bar */}
      <View style={styles.sessionBar}>
        {activeSession ? (
          <TouchableOpacity style={styles.endBtn} onPress={handleEndSession}>
            <Ionicons name="stop-circle" size={18} color="#fff" />
            <Text style={styles.sessionBtnText}>{t('attendance.endSession')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.startBtn} onPress={() => setFacultyModal(true)} disabled={starting}>
            {starting ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="play-circle" size={18} color="#fff" />}
            <Text style={styles.sessionBtnText}>{starting ? t('attendance.starting') : t('attendance.startSession')}</Text>
          </TouchableOpacity>
        )}
        {activeSession && (
          <View style={styles.liveTag}>
            <View style={styles.liveDot} />
            <Text style={styles.liveTagText}>{t('attendance.live')}</Text>
          </View>
        )}
      </View>

      {/* Stats gradient card */}
      <LinearGradient colors={['#1E3A8A', '#2563EB']} style={styles.statsCard}>
        <View style={styles.statsRow}>
          <StatCol label={t('home.statsTotal')}   value={total}   />
          <View style={styles.statDiv} />
          <StatCol label={t('home.statsPresent')}   value={present} />
          <View style={styles.statDiv} />
          <StatCol label={t('instructor.absentStat')} value={absent}  />
          <View style={styles.statDiv} />
          <StatCol label={t('attendance.excusedLabel')}  value={excused} />
        </View>
        {activeSession && (
          <View style={styles.statsSessionInfo}>
            <Ionicons name="time-outline" size={13} color="rgba(255,255,255,0.7)" />
            <Text style={styles.statsSessionText}>
              {activeSession.started_at ? new Date(activeSession.started_at).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' }) : t('common.notAvailable')} — {t('attendance.sessionActive')}
            </Text>
          </View>
        )}
      </LinearGradient>

      {/* Tabs */}
      <View style={styles.tabs}>
        {['overview', 'students', 'manual'].map(tabKey => {
          const labels = {
            overview: t('instructor.classDetailsOverview'),
            students: t('instructor.classDetailsStudents'),
            manual: t('instructor.classDetailsManual'),
          };
          const isActive = tab === tabKey;
          return (
            <TouchableOpacity key={tabKey} style={[styles.tabBtn, isActive && styles.tabBtnActive]} onPress={() => setTab(tabKey)}>
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{labels[tabKey]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      {tab === 'overview' ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.overviewContent}>
          <Text style={styles.sectionTitle}>{t('attendance.sessionActive')}</Text>
          {timeline.map((item, i) => (
            <View key={i} style={styles.timelineItem}>
              <View style={[styles.timelineDot, { backgroundColor: item.type === 'success' ? Colors.success : Colors.primary }]} />
              <View style={styles.timelineBody}>
                <Text style={styles.timelineTime}>{item.time}</Text>
                <Text style={styles.timelineEvent}>{item.event}</Text>
              </View>
            </View>
          ))}
          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>{t('attendance.sessionActive')}</Text>
          <View style={styles.infoCard}>
            <InfoRow icon="checkmark-circle" color={activeSession ? Colors.success : Colors.border} text={activeSession ? t('attendance.sessionActive') : t('attendance.notStartedYet')} />
            <InfoRow icon="people-outline"   color={Colors.primary}  text={t('common.studentCount', { count: total })} />
            <InfoRow icon="location-outline" color="#7C3AED"          text={selFaculty?.name || t('common.notAvailable')} last />
          </View>
        </ScrollView>
      ) : (
        <>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('attendance.searchStudent')}
              placeholderTextColor={Colors.textMuted}
              value={search}
              onChangeText={setSearch}
            />
          </View>
          {loading ? (
            <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
          ) : (
            <FlatList
              data={filtered}
              renderItem={renderStudent}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.centered}>
                  <Ionicons name="people-outline" size={48} color={Colors.border} />
                  <Text style={styles.emptyText}>{t('attendance.noStudentFound')}</Text>
                </View>
              }
            />
          )}
          {tab === 'manual' && unsaved && (
            <View style={styles.savebar}>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Ionicons name="save-outline" size={18} color="#fff" />
                <Text style={styles.saveBtnText}>{t('attendance.saveChanges')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      {/* Faculty Modal */}
      <Modal visible={facultyModal} transparent animationType="slide" onRequestClose={() => setFacultyModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t('attendance.selectFacultyTitle')}</Text>
            <Text style={styles.sheetSub}>{t('attendance.selectFacultyBody')}</Text>
            {facLoading ? (
              <ActivityIndicator color={Colors.primary} size="large" style={{ marginVertical: 32 }} />
            ) : faculties.length === 0 ? (
              <View style={styles.centered}>
                <Text style={styles.emptyText}>{t('attendance.noFacultyFound')}</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                {faculties.map(f => (
                  <TouchableOpacity
                    key={f.id}
                    style={[styles.facItem, selFaculty?.id === f.id && styles.facItemActive]}
                    onPress={() => setSelFaculty(f)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.facName}>{f.name}</Text>
                      {f.latitude
                        ? <Text style={styles.facGps}>📍 {f.latitude.toFixed(4)}, {f.longitude.toFixed(4)} — ±{f.geofence_radius}m</Text>
                        : <Text style={[styles.facGps, { color: Colors.error }]}>⚠ {t('attendance.gpsMissing')}</Text>
                      }
                    </View>
                    {selFaculty?.id === f.id && <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.sheetCancel} onPress={() => setFacultyModal(false)}>
                <Text style={styles.sheetCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.sheetConfirm, !selFaculty && { opacity: 0.4 }]} onPress={handleStartSession} disabled={!selFaculty}>
                <Text style={styles.sheetConfirmText}>{t('attendance.startSession')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cancel Modal */}
      <Modal visible={cancelModal} transparent animationType="slide" onRequestClose={() => setCancelModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t('cancel.title')}</Text>
            <Text style={styles.sheetSub}>{t('cancel.reasonPrefix', { reason: '' }).replace(/{{reason}}:?\s*/, '')}</Text>
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
    </SafeAreaView>
  );
}

function StatCol({ label, value }) {
  return (
    <View style={styles.statCol}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({ icon, color, text, last }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <View style={[styles.infoIconBox, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.infoRowText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  centered:{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },

  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  backBtn:     { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.bgAlt, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  headerCenter:{ flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, letterSpacing: -0.3 },
  headerSub:   { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  cancelIconBtn:{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  sessionBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, gap: 12 },
  startBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.success, paddingVertical: 11, borderRadius: 10 },
  endBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.error, paddingVertical: 11, borderRadius: 10 },
  sessionBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  liveTag:    { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.errorLight, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 },
  liveDot:    { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.error },
  liveTagText:{ fontSize: 11, fontWeight: '800', color: Colors.error },

  statsCard:       { marginHorizontal: 16, marginVertical: 14, borderRadius: 18, padding: 16, ...Shadows.primary },
  statsRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statCol:         { flex: 1, alignItems: 'center' },
  statValue:       { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  statLabel:       { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600', marginTop: 2 },
  statDiv:         { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.2)' },
  statsSessionInfo:{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)' },
  statsSessionText:{ fontSize: 12, color: 'rgba(255,255,255,0.75)' },

  tabs:       { flexDirection: 'row', backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  tabBtn:     { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive:{ borderBottomColor: Colors.primary },
  tabText:    { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  tabTextActive:{ color: Colors.primary },

  overviewContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 },
  sectionTitle:    { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 },

  timelineItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  timelineDot:  { width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0 },
  timelineBody: { flex: 1 },
  timelineTime: { fontSize: 12, fontWeight: '600', color: Colors.textMuted, marginBottom: 2 },
  timelineEvent:{ fontSize: 14, color: Colors.text, fontWeight: '500' },

  divider: { height: 1, backgroundColor: Colors.borderLight, marginVertical: 20 },

  infoCard:      { backgroundColor: Colors.card, borderRadius: 14, padding: 16, ...Shadows.xs },
  infoRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  infoIconBox:   { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  infoRowText:   { fontSize: 14, color: Colors.text, fontWeight: '500' },

  searchBox:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginVertical: 12, backgroundColor: Colors.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, ...Shadows.xs },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text },

  listContent:  { paddingHorizontal: 20, paddingBottom: 20 },
  studentCard:  { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.card, borderRadius: 14, padding: 12, marginBottom: 8, ...Shadows.xs },
  avatarBox:    { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primaryMuted, alignItems: 'center', justifyContent: 'center' },
  avatarText:   { fontSize: 14, fontWeight: '700', color: Colors.primary },
  studentBody:  { flex: 1 },
  studentName:  { fontSize: 14, fontWeight: '600', color: Colors.text },
  studentId:    { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  markBtns:     { flexDirection: 'row', gap: 5 },
  markBtn:      { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgAlt },
  markBtnText:  { fontSize: 11, fontWeight: '700', color: Colors.textMuted },
  statusPill:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText:   { fontSize: 11, fontWeight: '700' },

  emptyText: { fontSize: 14, color: Colors.textMuted, marginTop: 12, textAlign: 'center' },

  savebar:    { paddingHorizontal: 20, paddingVertical: 12, backgroundColor: Colors.card, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  saveBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 13, ...Shadows.primary },
  saveBtnText:{ fontSize: 14, fontWeight: '700', color: '#fff' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:       { backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 20 },
  sheetTitle:  { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  sheetSub:    { fontSize: 13, color: Colors.textMuted, marginBottom: 16 },

  facItem:       { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, marginBottom: 8, backgroundColor: Colors.bgAlt },
  facItemActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryMuted },
  facName:       { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 3 },
  facGps:        { fontSize: 11, color: Colors.textMuted },

  reasonRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, marginBottom: 8 },
  reasonRowActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryMuted },
  reasonText:      { fontSize: 14, fontWeight: '500', color: Colors.textSecondary },
  reasonTextActive:{ color: Colors.primary, fontWeight: '600' },

  sheetActions:     { flexDirection: 'row', gap: 12, marginTop: 16 },
  sheetCancel:      { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  sheetCancelText:  { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  sheetConfirm:     { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center' },
  sheetConfirmText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
