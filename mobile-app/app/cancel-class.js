import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, Modal, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { courses, sessions } from '@/services/api';
import { Colors, Shadows } from '@/config/theme';

const REASONS = [
  { id: 1, label: 'Hoca müsait değil',   icon: 'person-outline',     value: 'Hoca müsait değil' },
  { id: 2, label: 'Teknik sorun',         icon: 'construct-outline',  value: 'Teknik sorun' },
  { id: 3, label: 'Tatil / Etkinlik',     icon: 'calendar-outline',   value: 'Tatil / Etkinlik' },
  { id: 4, label: 'Acil durum',           icon: 'alert-circle-outline', value: 'Acil durum' },
];

export default function CancelClassScreen() {
  const router = useRouter();
  const [classList,     setClassList]     = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [selectedClass, setSelectedClass] = useState(null);
  const [reasonModal,   setReasonModal]   = useState(false);
  const [confirmModal,  setConfirmModal]  = useState(false);
  const [reason,        setReason]        = useState(REASONS[0].value);
  const [cancelling,    setCancelling]    = useState(false);

  useEffect(() => { loadCourses(); }, []);

  const loadCourses = async () => {
    try {
      const data = await courses.list();
      const mapped = (Array.isArray(data) ? data : []).map(c => {
        let timeStr = '—';
        try {
          const sch = typeof c.schedule === 'string' ? JSON.parse(c.schedule) : c.schedule;
          if (sch?.start_time && sch?.end_time) timeStr = `${sch.start_time} – ${sch.end_time}`;
          else if (sch?.days) timeStr = sch.days.join(', ');
        } catch {}
        return { id: c.id, code: c.code || `#${c.id}`, name: c.name || '', time: timeStr };
      });
      setClassList(mapped);
    } catch {
      Alert.alert('Hata', 'Dersler yüklenemedi.');
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
      Alert.alert('İptal Edildi', 'Ders başarıyla iptal edildi. Öğrenciler bilgilendirildi.');
    } catch (err) {
      Alert.alert('Hata', err?.message || 'İptal işlemi başarısız.');
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Ders İptal</Text>
          <Text style={styles.headerSub}>Dersi seçin ve sebebi belirtin</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Info banner */}
      <View style={styles.banner}>
        <Ionicons name="information-circle-outline" size={18} color={Colors.primary} />
        <Text style={styles.bannerText}>İptal ettiğinizde öğrencilere bildirim gönderilir.</Text>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : classList.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="calendar-outline" size={56} color={Colors.border} />
          <Text style={styles.emptyText}>İptal edilecek ders bulunamadı</Text>
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

      {/* Reason Modal */}
      <Modal visible={reasonModal} transparent animationType="slide" onRequestClose={() => setReasonModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>İptal Sebebi</Text>
            <Text style={styles.sheetSub}>{selectedClass?.code} — {selectedClass?.name}</Text>
            {REASONS.map(r => (
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
                <Text style={styles.cancelBtnText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.nextBtn} onPress={() => { setReasonModal(false); setConfirmModal(true); }}>
                <Text style={styles.nextBtnText}>İleri</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Confirm Modal */}
      <Modal visible={confirmModal} transparent animationType="fade" onRequestClose={() => setConfirmModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIconBox}>
              <Ionicons name="warning" size={40} color={Colors.error} />
            </View>
            <Text style={styles.confirmTitle}>Dersi İptal Et?</Text>
            <Text style={styles.confirmSub}>{selectedClass?.code} — {selectedClass?.name}</Text>
            <View style={styles.confirmDetails}>
              <View style={styles.detailRow}>
                <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} />
                <Text style={styles.detailText}>{reason}</Text>
              </View>
            </View>
            <Text style={styles.confirmWarn}>Bu işlem geri alınamaz. Tüm kayıtlı öğrenciler bilgilendirilecek.</Text>
            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmModal(false)} disabled={cancelling}>
                <Text style={styles.cancelBtnText}>Geri Dön</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={handleConfirm} disabled={cancelling}>
                {cancelling
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.deleteBtnText}>İptal Et</Text>
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
