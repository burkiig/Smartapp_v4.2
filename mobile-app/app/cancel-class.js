import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, Modal, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { courses, sessions } from '@/services/api';
import { Colors, Shadows } from '@/config/theme';
import { useCancelReasons } from '@/i18n/helpers';

const REASON_ICONS = ['person-outline', 'construct-outline', 'calendar-outline', 'alert-circle-outline'];

export default function CancelClassScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const cancelReasons = useCancelReasons();
  const reasons = useMemo(
    () => cancelReasons.map((label, i) => ({
      id: i + 1,
      label,
      icon: REASON_ICONS[i] || 'alert-circle-outline',
      value: label,
    })),
    [cancelReasons],
  );

  const [classList,     setClassList]     = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [selectedClass, setSelectedClass] = useState(null);
  const [reasonModal,   setReasonModal]   = useState(false);
  const [confirmModal,  setConfirmModal]  = useState(false);
  const [reason,        setReason]        = useState(null);
  const [cancelling,    setCancelling]    = useState(false);

  useEffect(() => {
    if (reasons.length > 0 && !reason) {
      setReason(reasons[0].value);
    }
  }, [reasons, reason]);

  useEffect(() => { loadCourses(); }, []);

  const loadCourses = async () => {
    try {
      const data = await courses.list();
      const mapped = (Array.isArray(data) ? data : []).map(c => {
        let timeStr = t('common.notAvailable');
        try {
          const sch = typeof c.schedule === 'string' ? JSON.parse(c.schedule) : c.schedule;
          if (sch?.start_time && sch?.end_time) timeStr = `${sch.start_time} – ${sch.end_time}`;
          else if (sch?.days) timeStr = sch.days.join(', ');
        } catch {}
        return { id: c.id, code: c.code || `#${c.id}`, name: c.name || '', time: timeStr };
      });
      setClassList(mapped);
    } catch {
      Alert.alert(t('common.error'), t('cancel.coursesLoadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setCancelling(true);
    try {
      await sessions.cancel(selectedClass.id, reason);
      setConfirmModal(false);
      setClassList(prev => prev.filter(c => c.id !== selectedClass.id));
      setSelectedClass(null);
      Alert.alert(t('cancel.cancelled'), t('cancel.cancelSuccess'));
    } catch (err) {
      Alert.alert(t('common.error'), err?.message || t('cancel.cancelOperationFailed'));
    } finally {
      setCancelling(false);
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => { setSelectedClass(item); setReasonModal(true); }}
      activeOpacity={0.75}
    >
      <View style={styles.cardIcon}>
        <Ionicons name="book-outline" size={20} color={Colors.primary} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardCode}>{item.code}</Text>
        <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
        <View style={styles.cardMeta}>
          <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
          <Text style={styles.cardMetaText}>{item.time}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>{t('cancel.cancelClassTitle')}</Text>
          <Text style={styles.headerSub}>{t('cancel.title')}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.banner}>
        <Ionicons name="information-circle-outline" size={18} color={Colors.primary} />
        <Text style={styles.bannerText}>{t('cancel.title')}</Text>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : classList.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="calendar-outline" size={56} color={Colors.border} />
          <Text style={styles.emptyText}>{t('cancel.coursesLoadFailed')}</Text>
        </View>
      ) : (
        <FlatList
          data={classList}
          renderItem={renderItem}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal visible={reasonModal} transparent animationType="slide" onRequestClose={() => setReasonModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t('cancel.title')}</Text>
            <Text style={styles.sheetSub}>{selectedClass?.code} — {selectedClass?.name}</Text>
            {reasons.map(r => (
              <TouchableOpacity
                key={r.id}
                style={[styles.reasonRow, reason === r.value && styles.reasonRowActive]}
                onPress={() => setReason(r.value)}
              >
                <View style={[styles.reasonIcon, reason === r.value && styles.reasonIconActive]}>
                  <Ionicons name={r.icon} size={18} color={reason === r.value ? Colors.primary : Colors.textMuted} />
                </View>
                <Text style={[styles.reasonText, reason === r.value && styles.reasonTextActive]}>{r.label}</Text>
                {reason === r.value && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
              </TouchableOpacity>
            ))}
            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setReasonModal(false)}>
                <Text style={styles.cancelBtnText}>{t('common.giveUp')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.nextBtn} onPress={() => { setReasonModal(false); setConfirmModal(true); }}>
                <Text style={styles.nextBtnText}>{t('common.confirm')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={confirmModal} transparent animationType="fade" onRequestClose={() => setConfirmModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIconBox}>
              <Ionicons name="warning" size={40} color={Colors.error} />
            </View>
            <Text style={styles.confirmTitle}>{t('cancel.confirmTitle')}</Text>
            <Text style={styles.confirmSub}>{selectedClass?.code} — {selectedClass?.name}</Text>
            <View style={styles.confirmDetails}>
              <View style={styles.detailRow}>
                <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} />
                <Text style={styles.detailText}>{reason}</Text>
              </View>
            </View>
            <Text style={styles.confirmWarn}>{t('cancel.cancelFailed')}</Text>
            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmModal(false)} disabled={cancelling}>
                <Text style={styles.cancelBtnText}>{t('common.back')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={handleConfirm} disabled={cancelling}>
                {cancelling
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.deleteBtnText}>{t('cancel.cancelAction')}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  centered:{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  backBtn:     { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.bgAlt, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, letterSpacing: -0.3 },
  headerSub:   { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  banner:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.primaryMuted, marginHorizontal: 20, marginTop: 16, marginBottom: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.primaryLight },
  bannerText: { flex: 1, fontSize: 13, color: Colors.primary, fontWeight: '500' },

  list: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.card, borderRadius: 14, padding: 14, marginBottom: 10, ...Shadows.xs },
  cardIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.primaryMuted, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1 },
  cardCode: { fontSize: 12, fontWeight: '700', color: Colors.primary, letterSpacing: 0.3, marginBottom: 2 },
  cardName: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 4 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardMetaText: { fontSize: 12, color: Colors.textMuted },
  emptyText: { fontSize: 14, color: Colors.textMuted },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },

  sheet:       { backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 20 },
  sheetTitle:  { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  sheetSub:    { fontSize: 14, color: Colors.textMuted, marginBottom: 20 },

  reasonRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, marginBottom: 10 },
  reasonRowActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryMuted },
  reasonIcon:      { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.bgAlt, alignItems: 'center', justifyContent: 'center' },
  reasonIconActive:{ backgroundColor: Colors.primaryLight },
  reasonText:      { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  reasonTextActive:{ color: Colors.primary },

  sheetActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelBtn:    { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  cancelBtnText:{ fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  nextBtn:      { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center' },
  nextBtnText:  { fontSize: 14, fontWeight: '700', color: '#fff' },

  confirmCard:    { backgroundColor: Colors.card, borderRadius: 24, padding: 24, marginHorizontal: 20, alignSelf: 'center', width: '90%', marginTop: 'auto', marginBottom: 'auto' },
  confirmIconBox: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.errorLight, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
  confirmTitle:   { fontSize: 20, fontWeight: '800', color: Colors.text, textAlign: 'center', marginBottom: 4 },
  confirmSub:     { fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginBottom: 16 },
  confirmDetails: { backgroundColor: Colors.bgAlt, borderRadius: 12, padding: 14, marginBottom: 14 },
  detailRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailText:     { fontSize: 14, color: Colors.text, flex: 1 },
  confirmWarn:    { fontSize: 12, color: Colors.error, textAlign: 'center', marginBottom: 4 },
  deleteBtn:      { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.error, alignItems: 'center' },
  deleteBtnText:  { fontSize: 14, fontWeight: '700', color: '#fff' },
});
