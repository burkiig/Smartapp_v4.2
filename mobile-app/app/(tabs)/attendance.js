import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ScrollView, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useUser } from '../_context/UserContext';
import { attendance, excuses as excusesApi, disputes as disputesApi } from '../shared/services/api';
import { Colors, Shadows } from '../shared/config/theme';

/* ─── Student placeholder ────────────────────────────────────────────────── */
function StudentPlaceholder() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.placeholder}>
        <View style={styles.placeholderIcon}>
          <Ionicons name="shield-checkmark-outline" size={48} color={Colors.textMuted} />
        </View>
        <Text style={styles.placeholderTitle}>Eğitmenlere Özel</Text>
        <Text style={styles.placeholderSub}>Bu sekme yalnızca öğretmen ve yöneticiler tarafından kullanılabilir.</Text>
        <TouchableOpacity style={styles.placeholderBtn} onPress={() => router.push('/(tabs)/history')}>
          <Ionicons name="time-outline" size={16} color="#fff" />
          <Text style={styles.placeholderBtnText}>Devam Geçmişime Git</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const BADGE = {
  approved: { label: 'Onaylandı', color: Colors.success, bg: Colors.successLight },
  rejected: { label: 'Reddedildi', color: Colors.error,   bg: Colors.errorLight  },
  pending:  { label: 'Beklemede', color: Colors.warning,  bg: Colors.warningLight },
};
const badge = (status) => BADGE[status] || BADGE.pending;

/* ─── Main component ─────────────────────────────────────────────────────── */
export default function AttendanceScreen() {
  const { userType } = useUser();

  const [activeTab,    setActiveTab]    = useState('pending');
  const [flagged,      setFlagged]      = useState([]);
  const [excuseList,   setExcuseList]   = useState([]);
  const [disputeList,  setDisputeList]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [processingId, setProcessingId] = useState(null);

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

  useEffect(() => { if (userType !== 'student') fetchAll(); }, [fetchAll, userType]);

  if (userType === 'student') return <StudentPlaceholder />;

  const onRefresh = () => { setRefreshing(true); fetchAll(); };

  const handleFlagged = async (record, isFlagged, status) => {
    setProcessingId(record.id);
    try {
      await attendance.review(record.id, isFlagged, record.flag_reason, status);
      setFlagged(prev => prev.map(r => r.id === record.id ? { ...r, is_flagged: isFlagged, status } : r));
    } catch (err) { Alert.alert('Hata', err.message || 'İşlem başarısız'); }
    finally { setProcessingId(null); }
  };

  const handleExcuse = async (exc, newStatus) => {
    setProcessingId(`e-${exc.id}`);
    try {
      await excusesApi.review(exc.id, newStatus, '');
      setExcuseList(prev => prev.map(e => e.id === exc.id ? { ...e, status: newStatus } : e));
    } catch (err) { Alert.alert('Hata', err.message || 'İşlem başarısız'); }
    finally { setProcessingId(null); }
  };

  const handleDispute = async (dispute, newStatus) => {
    setProcessingId(`d-${dispute.id}`);
    try {
      await disputesApi.review(dispute.id, newStatus, '');
      setDisputeList(prev => prev.map(d => d.id === dispute.id ? { ...d, status: newStatus } : d));
    } catch (err) { Alert.alert('Hata', err.message || 'İşlem başarısız'); }
    finally { setProcessingId(null); }
  };

  const TABS = [
    { id: 'pending',   label: 'Bayraklı',  count: flagged.filter(r => r.is_flagged).length,   color: Colors.warning },
    { id: 'excuses',   label: 'Mazeretler', count: excuseList.filter(e => e.status === 'pending').length, color: '#7C3AED' },
    { id: 'disputes',  label: 'İtirazlar',  count: disputeList.filter(d => d.status === 'pending').length, color: Colors.error },
    { id: 'all',       label: 'Tümü',       count: flagged.length,                             color: Colors.primary },
  ];

  const listData = activeTab === 'excuses' ? excuseList
    : activeTab === 'disputes' ? disputeList
    : activeTab === 'pending'  ? flagged.filter(r => r.is_flagged)
    : flagged;

  /* ── Render items ─────────────────────────────────────────────────────── */
  const renderFlagged = ({ item }) => {
    const b = badge(item.status);
    const busy = processingId === item.id;
    const nameLabel = item.student_name || `Öğrenci #${item.student_id}`;
    const initial = item.student_name ? item.student_name[0].toUpperCase() : '#';
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.studentRow}>
            <View style={[styles.avatarCircle, { backgroundColor: Colors.primaryMuted }]}>
              <Text style={[styles.avatarLetter, { color: Colors.primary }]}>{initial}</Text>
            </View>
            <View>
              <Text style={styles.studentName}>{nameLabel}</Text>
              <Text style={styles.studentSub}>{item.student_number ? `No: ${item.student_number}` : `Ders #${item.course_id}`}</Text>
            </View>
          </View>
          <View style={[styles.pill, { backgroundColor: b.bg }]}>
            <Text style={[styles.pillText, { color: b.color }]}>{b.label}</Text>
          </View>
        </View>

        {item.marked_at && (
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.metaText}>{new Date(item.marked_at).toLocaleString('tr-TR')}</Text>
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
            <ActionBtn label="Onayla"  icon="checkmark-circle" color={Colors.success} bg={Colors.successLight} onPress={() => handleFlagged(item, false, 'present')} />
            <ActionBtn label="Reddet"  icon="close-circle"     color={Colors.error}   bg={Colors.errorLight}   onPress={() => handleFlagged(item, false, 'absent')} />
          </View>
        ) : (
          <TouchableOpacity style={styles.undoBtn} onPress={() => handleFlagged(item, true, item.status)}>
            <Ionicons name="arrow-undo-outline" size={15} color={Colors.primary} />
            <Text style={styles.undoText}>Geri Al</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderExcuse = ({ item }) => {
    const b = badge(item.status);
    const busy = processingId === `e-${item.id}`;
    const excuseLabels = { medical: 'Sağlık', family: 'Aile', school_activity: 'Okul Etkinliği', transportation: 'Ulaşım', other: 'Diğer' };
    const nameLabel = item.student_name || `Öğrenci #${item.student_id}`;
    const initial = item.student_name ? item.student_name[0].toUpperCase() : '#';
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
          <View style={[styles.pill, { backgroundColor: b.bg }]}>
            <Text style={[styles.pillText, { color: b.color }]}>{b.label}</Text>
          </View>
        </View>

        <View style={styles.typePill}>
          <Text style={styles.typeText}>{excuseLabels[item.excuse_type] || item.excuse_type}</Text>
        </View>
        {item.description && <Text style={styles.descText}>{item.description}</Text>}
        {item.session_date && (
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.metaText}>{item.session_date}</Text>
          </View>
        )}

        {busy ? <ActivityIndicator color="#7C3AED" style={{ marginTop: 12 }} /> : item.status === 'pending' ? (
          <View style={styles.actions}>
            <ActionBtn label="Onayla" icon="checkmark-circle" color={Colors.success} bg={Colors.successLight} onPress={() => handleExcuse(item, 'approved')} />
            <ActionBtn label="Reddet" icon="close-circle"     color={Colors.error}   bg={Colors.errorLight}   onPress={() => handleExcuse(item, 'rejected')} />
          </View>
        ) : null}
      </View>
    );
  };

  const renderDispute = ({ item }) => {
    const b = badge(item.status);
    const busy = processingId === `d-${item.id}`;
    const nameLabel = item.student_name || `Öğrenci #${item.student_id}`;
    const initial = item.student_name ? item.student_name[0].toUpperCase() : '#';
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.studentRow}>
            <View style={[styles.avatarCircle, { backgroundColor: Colors.errorLight }]}>
              <Text style={[styles.avatarLetter, { color: Colors.error }]}>{initial}</Text>
            </View>
            <View>
              <Text style={styles.studentName}>{nameLabel}</Text>
              <Text style={styles.studentSub}>{item.course_code || `Ders #${item.course_id}`}</Text>
            </View>
          </View>
          <View style={[styles.pill, { backgroundColor: b.bg }]}>
            <Text style={[styles.pillText, { color: b.color }]}>{b.label}</Text>
          </View>
        </View>

        <View style={styles.reasonRow}>
          <Ionicons name="chatbubble-outline" size={13} color={Colors.primary} />
          <Text style={[styles.reasonText, { color: Colors.textSecondary }]}>{item.reason}</Text>
        </View>
        {item.created_at && (
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.metaText}>{new Date(item.created_at).toLocaleString('tr-TR')}</Text>
          </View>
        )}

        {busy ? <ActivityIndicator color={Colors.error} style={{ marginTop: 12 }} /> : item.status === 'pending' ? (
          <View style={styles.actions}>
            <ActionBtn label="Onayla" icon="checkmark-circle" color={Colors.success} bg={Colors.successLight} onPress={() => handleDispute(item, 'approved')} />
            <ActionBtn label="Reddet" icon="close-circle"     color={Colors.error}   bg={Colors.errorLight}   onPress={() => handleDispute(item, 'rejected')} />
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
          <Text style={styles.headerTitle}>Yoklama Yönetimi</Text>
          <Text style={styles.headerSub}>Kayıtlar, mazeretler ve itirazlar</Text>
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
          data={listData}
          renderItem={renderItem}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Ionicons name="checkmark-done-circle-outline" size={56} color={Colors.border} />
              <Text style={styles.emptyText}>Kayıt bulunamadı</Text>
            </View>
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

  actions:       { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  actionBtnText: { fontSize: 13, fontWeight: '700' },
  undoBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.primaryMuted },
  undoText:      { fontSize: 13, fontWeight: '600', color: Colors.primary },

  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 14, color: Colors.textMuted, marginTop: 12 },
});
