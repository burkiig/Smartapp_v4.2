import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ScrollView, Alert, ActivityIndicator, RefreshControl, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useUser } from '@/context/UserContext';
import { attendance, excuses as excusesApi, disputes as disputesApi } from '@/services/api';
import { Colors, Shadows } from '@/config/theme';
import EmptyState from '@/components/EmptyState';
import { getDateLocale } from '@/i18n';

/* ─── Student placeholder ────────────────────────────────────────────────── */
function StudentPlaceholder() {
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.placeholder}>
        <View style={styles.placeholderIcon}>
          <Ionicons name="shield-checkmark-outline" size={48} color={Colors.textMuted} />
        </View>
        <Text style={styles.placeholderTitle}>{t('instructor.instructorOnly')}</Text>
        <Text style={styles.placeholderSub}>{t('instructor.goToMyHistory')}</Text>
        <TouchableOpacity style={styles.placeholderBtn} onPress={() => router.push('/(tabs)/history')}>
          <Ionicons name="time-outline" size={16} color="#fff" />
          <Text style={styles.placeholderBtnText}>{t('instructor.goToMyHistory')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const BADGE_KEYS = {
  approved: 'attendance.review.approved',
  rejected: 'attendance.review.rejected',
  pending:  'attendance.review.pending',
};
const BADGE_STYLE = {
  approved: { color: Colors.success, bg: Colors.successLight },
  rejected: { color: Colors.error,   bg: Colors.errorLight  },
  pending:  { color: Colors.warning,  bg: Colors.warningLight },
};
const badgeStyle = (status) => BADGE_STYLE[status] || BADGE_STYLE.pending;

/* ─── Main component ─────────────────────────────────────────────────────── */
export default function AttendanceScreen() {
  const { t } = useTranslation();
  const { user } = useUser();
  const role = user?.role;
  const { filter, session_id } = useLocalSearchParams();
  const listRef = useRef(null);
  const hasAppliedSessionFocus = useRef(false);
  const hasAppliedInitialFilter = useRef(false);
  const highlightTimeoutRef = useRef(null);

  const deepLinkFilter = useMemo(
    () => (Array.isArray(filter) ? filter[0] : filter),
    [filter]
  );
  const deepLinkSessionId = useMemo(() => {
    const raw = Array.isArray(session_id) ? session_id[0] : session_id;
    return raw != null ? String(raw) : null;
  }, [session_id]);

  const [activeTab,    setActiveTab]    = useState('pending');
  const [flagged,      setFlagged]      = useState([]);
  const [excuseList,   setExcuseList]   = useState([]);
  const [disputeList,  setDisputeList]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [docLoadingId,  setDocLoadingId]  = useState(null);
  const [highlightedSessionId, setHighlightedSessionId] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      const [f, e, d] = await Promise.allSettled([
        attendance.getFlagged(),
        excusesApi.list(),
        disputesApi.list(),
      ]);
      if (f.status === 'fulfilled') setFlagged(Array.isArray(f.value) ? f.value : []);
      if (e.status === 'fulfilled') setExcuseList(Array.isArray(e.value) ? e.value : []);
      if (d.status === 'fulfilled') setDisputeList(Array.isArray(d.value) ? d.value : []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { if (role !== 'student') fetchAll(); }, [fetchAll, role]);
  useEffect(() => {
    if (hasAppliedInitialFilter.current) return;
    hasAppliedInitialFilter.current = true;
    if (!deepLinkFilter) return;
    const tabByFilter = {
      flagged: 'pending',
      pending: 'pending',
      all: 'all',
      excuses: 'excuses',
      disputes: 'disputes',
    };
    if (tabByFilter[deepLinkFilter]) {
      setActiveTab(tabByFilter[deepLinkFilter]);
    }
  }, [deepLinkFilter]);
  useEffect(() => () => {
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
  }, []);

  if (role === 'student') return <StudentPlaceholder />;

  const onRefresh = () => { setRefreshing(true); fetchAll(); };

  const handleFlagged = async (record, isFlagged, status) => {
    setProcessingId(record.id);
    try {
      const note = !isFlagged && status === 'present' ? t('attendance.teacherOverride')
        : !isFlagged && status === 'absent' ? t('attendance.review.rejected')
        : t('common.cancel');
      await attendance.override(record.id, status === record.status ? 'pending_review' : status, note);
      setFlagged(prev => prev.map(r => r.id === record.id ? { ...r, is_flagged: isFlagged, status } : r));
    } catch (err) { Alert.alert(t('common.error'), err.message || t('common.somethingWrong')); }
    finally { setProcessingId(null); }
  };

  const handleExcuse = async (exc, newStatus) => {
    setProcessingId(`e-${exc.id}`);
    try {
      await excusesApi.review(exc.id, newStatus, '');
      setExcuseList(prev => prev.map(e => e.id === exc.id ? { ...e, status: newStatus } : e));
    } catch (err) { Alert.alert(t('common.error'), err.message || t('common.somethingWrong')); }
    finally { setProcessingId(null); }
  };

  const handleDispute = async (dispute, newStatus) => {
    setProcessingId(`d-${dispute.id}`);
    try {
      await disputesApi.review(dispute.id, newStatus, '');
      setDisputeList(prev => prev.map(d => d.id === dispute.id ? { ...d, status: newStatus } : d));
    } catch (err) { Alert.alert(t('common.error'), err.message || t('common.somethingWrong')); }
    finally { setProcessingId(null); }
  };

  const TABS = [
    { id: 'pending',   label: t('instructor.tabFlagged'),  count: flagged.filter(r => r.is_flagged).length,   color: Colors.warning },
    { id: 'excuses',   label: t('instructor.tabExcuses'), count: excuseList.filter(e => e.status === 'pending').length, color: '#7C3AED' },
    { id: 'disputes',  label: t('instructor.tabDisputes'),  count: disputeList.filter(d => d.status === 'pending').length, color: Colors.error },
    { id: 'all',       label: t('instructor.tabAll'),       count: flagged.length,                             color: Colors.primary },
  ];

  const listData = activeTab === 'excuses' ? excuseList
    : activeTab === 'disputes' ? disputeList
    : activeTab === 'pending'  ? flagged.filter(r => r.is_flagged)
    : flagged;

  useEffect(() => {
    if (!deepLinkSessionId || loading || !listData.length) return;
    if (activeTab !== 'pending' && activeTab !== 'all') return;
    if (hasAppliedSessionFocus.current) return;

    let matchIndex = listData.findIndex(item => String(item.session_id) === deepLinkSessionId);
    if (matchIndex < 0) {
      if (activeTab === 'pending') {
        const hasSessionInAll = flagged.some(item => String(item.session_id) === deepLinkSessionId);
        if (hasSessionInAll) {
          setActiveTab('all');
        } else {
          hasAppliedSessionFocus.current = true;
        }
      } else {
        hasAppliedSessionFocus.current = true;
      }
      return;
    }

    hasAppliedSessionFocus.current = true;
    setHighlightedSessionId(deepLinkSessionId);
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index: matchIndex, animated: true, viewPosition: 0.2 });
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = setTimeout(() => {
        setHighlightedSessionId(null);
      }, 2000);
    });
  }, [activeTab, deepLinkSessionId, flagged, listData, loading]);

  /* ── Render items ─────────────────────────────────────────────────────── */
  const renderFlagged = ({ item }) => {
    const bStyle = badgeStyle(item.status);
    const bLabel = t(BADGE_KEYS[item.status] || BADGE_KEYS.pending);
    const busy = processingId === item.id;
    const nameLabel = item.student_name || t('common.studentWithId', { id: item.student_id });
    const initial = item.student_name ? item.student_name[0].toUpperCase() : '#';
    const isHighlighted = highlightedSessionId && String(item.session_id) === highlightedSessionId;
    const dateLocale = getDateLocale();
    return (
      <View style={[styles.card, isHighlighted && styles.highlightCard]}>
        <View style={styles.cardTop}>
          <View style={styles.studentRow}>
            <View style={[styles.avatarCircle, { backgroundColor: Colors.primaryMuted }]}>
              <Text style={[styles.avatarLetter, { color: Colors.primary }]}>{initial}</Text>
            </View>
            <View>
              <Text style={styles.studentName}>{nameLabel}</Text>
              <Text style={styles.studentSub}>{item.student_number ? `No: ${item.student_number}` : t('common.courseWithId', { id: item.course_id })}</Text>
            </View>
          </View>
          <View style={[styles.pill, { backgroundColor: bStyle.bg }]}>
            <Text style={[styles.pillText, { color: bStyle.color }]}>{bLabel}</Text>
          </View>
        </View>

        {item.marked_at && (
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.metaText}>{new Date(item.marked_at).toLocaleString(dateLocale)}</Text>
          </View>
        )}
        {item.flag_reason && (
          <View style={styles.reasonRow}>
            <Ionicons name="flag" size={13} color={Colors.warning} />
            <Text style={styles.reasonText}>{item.flag_reason}</Text>
          </View>
        )}

        {busy ? <ActivityIndicator color={Colors.primary} style={{ marginTop: 12 }} /> : item.is_flagged ? (
          <View style={styles.actions}>
            <ActionBtn label={t('attendance.review.approved')}  icon="checkmark-circle" color={Colors.success} bg={Colors.successLight} onPress={() => handleFlagged(item, false, 'present')} />
            <ActionBtn label={t('attendance.review.rejected')}  icon="close-circle"     color={Colors.error}   bg={Colors.errorLight}   onPress={() => handleFlagged(item, false, 'absent')} />
          </View>
        ) : (
          <TouchableOpacity style={styles.undoBtn} onPress={() => handleFlagged(item, true, item.status)}>
            <Ionicons name="arrow-undo-outline" size={15} color={Colors.primary} />
            <Text style={styles.undoText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const handleViewDocument = async (excuseId) => {
    setDocLoadingId(excuseId);
    try {
      const res = await excusesApi.getDocumentUrl(excuseId);
      const url = res?.signed_url;
      if (!url) { Alert.alert(t('common.error'), t('common.somethingWrong')); return; }
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert(t('common.error'), t('common.somethingWrong'));
      }
    } catch (err) {
      Alert.alert(t('common.error'), err?.message || t('common.somethingWrong'));
    } finally {
      setDocLoadingId(null);
    }
  };

  const renderExcuse = ({ item }) => {
    const bStyle = badgeStyle(item.status);
    const bLabel = t(BADGE_KEYS[item.status] || BADGE_KEYS.pending);
    const busy = processingId === `e-${item.id}`;
    const docBusy = docLoadingId === item.id;
    const nameLabel = item.student_name || t('common.studentWithId', { id: item.student_id });
    const initial = item.student_name ? item.student_name[0].toUpperCase() : '#';
    const typeLabel = t(`excuse.types.${item.excuse_type}.label`, { defaultValue: item.excuse_type });
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.studentRow}>
            <View style={[styles.avatarCircle, { backgroundColor: '#EDE9FE' }]}>
              <Text style={[styles.avatarLetter, { color: '#7C3AED' }]}>{initial}</Text>
            </View>
            <View>
              <Text style={styles.studentName}>{nameLabel}</Text>
              <Text style={styles.studentSub}>{item.student_number ? `No: ${item.student_number}` : `Ders #${item.course_id}`}</Text>
            </View>
          </View>
          <View style={[styles.pill, { backgroundColor: bStyle.bg }]}>
            <Text style={[styles.pillText, { color: bStyle.color }]}>{bLabel}</Text>
          </View>
        </View>

        <View style={styles.typePill}>
          <Text style={styles.typeText}>{typeLabel}</Text>
        </View>
        {item.description && <Text style={styles.descText}>{item.description}</Text>}
        {item.session_date && (
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.metaText}>{item.session_date}</Text>
          </View>
        )}

        {item.storage_path && (
          <TouchableOpacity
            style={styles.docBtn}
            disabled={docBusy}
            onPress={() => handleViewDocument(item.id)}
          >
            {docBusy
              ? <ActivityIndicator size="small" color="#7C3AED" />
              : <Ionicons name="document-text-outline" size={15} color="#7C3AED" />
            }
            <Text style={styles.docBtnText}>
              {docBusy ? t('common.loading') : t('instructor.viewDocument')}
            </Text>
          </TouchableOpacity>
        )}

        {busy ? <ActivityIndicator color="#7C3AED" style={{ marginTop: 12 }} /> : item.status === 'pending' ? (
          <View style={styles.actions}>
            <ActionBtn label={t('attendance.review.approved')} icon="checkmark-circle" color={Colors.success} bg={Colors.successLight} onPress={() => handleExcuse(item, 'approved')} />
            <ActionBtn label={t('attendance.review.rejected')} icon="close-circle"     color={Colors.error}   bg={Colors.errorLight}   onPress={() => handleExcuse(item, 'rejected')} />
          </View>
        ) : null}
      </View>
    );
  };

  const renderDispute = ({ item }) => {
    const bStyle = badgeStyle(item.status);
    const bLabel = t(BADGE_KEYS[item.status] || BADGE_KEYS.pending);
    const busy = processingId === `d-${item.id}`;
    const nameLabel = item.student_name || t('common.studentWithId', { id: item.student_id });
    const initial = item.student_name ? item.student_name[0].toUpperCase() : '#';
    const dateLocale = getDateLocale();
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.studentRow}>
            <View style={[styles.avatarCircle, { backgroundColor: Colors.errorLight }]}>
              <Text style={[styles.avatarLetter, { color: Colors.error }]}>{initial}</Text>
            </View>
            <View>
              <Text style={styles.studentName}>{nameLabel}</Text>
              <Text style={styles.studentSub}>{item.course_code || t('common.courseWithId', { id: item.course_id })}</Text>
            </View>
          </View>
          <View style={[styles.pill, { backgroundColor: bStyle.bg }]}>
            <Text style={[styles.pillText, { color: bStyle.color }]}>{bLabel}</Text>
          </View>
        </View>

        <View style={styles.reasonRow}>
          <Ionicons name="chatbubble-outline" size={13} color={Colors.primary} />
          <Text style={[styles.reasonText, { color: Colors.textSecondary }]}>{item.reason}</Text>
        </View>
        {item.created_at && (
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.metaText}>{new Date(item.created_at).toLocaleString(dateLocale)}</Text>
          </View>
        )}

        {busy ? <ActivityIndicator color={Colors.error} style={{ marginTop: 12 }} /> : item.status === 'pending' ? (
          <View style={styles.actions}>
            <ActionBtn label={t('attendance.review.approved')} icon="checkmark-circle" color={Colors.success} bg={Colors.successLight} onPress={() => handleDispute(item, 'approved')} />
            <ActionBtn label={t('attendance.review.rejected')} icon="close-circle"     color={Colors.error}   bg={Colors.errorLight}   onPress={() => handleDispute(item, 'rejected')} />
          </View>
        ) : null}
      </View>
    );
  };

  const renderItem = activeTab === 'excuses' ? renderExcuse
    : activeTab === 'disputes' ? renderDispute
    : renderFlagged;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{t('instructor.attendanceMgmtTitle')}</Text>
          <Text style={styles.headerSub}>{t('instructor.attendanceMgmtSub')}</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} disabled={loading} style={styles.refreshBtn}>
          <Ionicons name="refresh-outline" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabsContent}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tab, activeTab === t.id && { backgroundColor: t.color + '15', borderColor: t.color }]}
            onPress={() => setActiveTab(t.id)}
          >
            <Text style={[styles.tabLabel, activeTab === t.id && { color: t.color, fontWeight: '700' }]}>{t.label}</Text>
            <View style={[styles.tabCount, { backgroundColor: activeTab === t.id ? t.color : Colors.border }]}>
              <Text style={[styles.tabCountText, { color: activeTab === t.id ? '#fff' : Colors.textSecondary }]}>{t.count}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* List */}
      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <FlatList
          ref={listRef}
          data={listData}
          renderItem={renderItem}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onScrollToIndexFailed={(info) => {
            const fallbackOffset = Math.max(0, info.averageItemLength * info.index);
            listRef.current?.scrollToOffset({ offset: fallbackOffset, animated: true });
            setTimeout(() => {
              listRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.2 });
            }, 100);
            // Target index hazir degilse deep-link highlight'ini bekletmeden kapat.
            if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
            setHighlightedSessionId(null);
          }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              icon="checkmark-done-circle-outline"
              title={t('instructor.emptyRecords')}
              subtitle={t('instructor.emptyRecordsSub')}
              onRetry={onRefresh}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

function ActionBtn({ label, icon, color, bg, onPress }) {
  return (
    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: bg }]} onPress={onPress}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={[styles.actionBtnText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: Colors.bg },

  // Student placeholder
  placeholder:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 14 },
  placeholderIcon: { width: 88, height: 88, borderRadius: 24, backgroundColor: Colors.bgAlt, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  placeholderTitle:{ fontSize: 20, fontWeight: '700', color: Colors.text },
  placeholderSub:  { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },
  placeholderBtn:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 13, borderRadius: 14, marginTop: 4 },
  placeholderBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Header
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.text, letterSpacing: -0.3 },
  headerSub:   { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  refreshBtn:  { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.primaryMuted, alignItems: 'center', justifyContent: 'center' },

  // Tabs
  tabsScroll:   { maxHeight: 52, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  tabsContent:  { paddingHorizontal: 16, gap: 8, alignItems: 'center', paddingVertical: 8 },
  tab:          { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border },
  tabLabel:     { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  tabCount:     { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, minWidth: 22, alignItems: 'center' },
  tabCountText: { fontSize: 11, fontWeight: '700' },

  // Cards
  listContent: { paddingHorizontal: 20, paddingVertical: 16 },
  card:        { backgroundColor: Colors.card, borderRadius: 16, padding: 16, marginBottom: 12, ...Shadows.sm },
  highlightCard: { borderWidth: 2, borderColor: Colors.warning },

  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  studentRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarCircle:{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarLetter:{ fontSize: 15, fontWeight: '800' },
  studentName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  studentSub:  { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  pill:        { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  pillText:    { fontSize: 11, fontWeight: '700' },

  metaRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  metaText:   { fontSize: 12, color: Colors.textMuted },
  reasonRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 8, backgroundColor: Colors.warningMuted, borderRadius: 8, padding: 8 },
  reasonText: { flex: 1, fontSize: 12, fontWeight: '600', color: Colors.warning, lineHeight: 18 },

  typePill:   { backgroundColor: '#EDE9FE', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 8 },
  typeText:   { fontSize: 12, fontWeight: '700', color: '#7C3AED' },
  descText:   { fontSize: 13, color: Colors.textSecondary, marginBottom: 8, lineHeight: 18 },

  docBtn:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#EDE9FE', borderWidth: 1, borderColor: '#C4B5FD' },
  docBtnText:    { fontSize: 13, fontWeight: '600', color: '#7C3AED' },

  actions:       { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  actionBtnText: { fontSize: 13, fontWeight: '700' },
  undoBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.primaryMuted },
  undoText:      { fontSize: 13, fontWeight: '600', color: Colors.primary },

  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 14, color: Colors.textMuted, marginTop: 12 },
});
