import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, FlatList, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useUser } from '@/context/UserContext';
import InstructorHistory from '@/screens/InstructorHistory';
import { attendance, disputes } from '@/services/api';
import { Colors, Shadows } from '@/config/theme';

const STATUS = {
  present: { label: 'Mevcut',    icon: 'checkmark-circle', color: Colors.success, bg: Colors.successLight },
  absent:  { label: 'Devamsız',  icon: 'close-circle',     color: Colors.error,   bg: Colors.errorLight   },
  excused: { label: 'Mazeretli', icon: 'document-text',    color: Colors.primary, bg: Colors.primaryLight },
  late:    { label: 'Geç',       icon: 'time',              color: Colors.warning, bg: Colors.warningLight },
};

const FILTERS = ['Tümü', 'Mevcut', 'Devamsız', 'Geç'];
const FILTER_KEY = { 'Tümü': null, 'Mevcut': 'present', 'Devamsız': 'absent', 'Geç': 'late' };

export default function HistoryScreen() {
  const router = useRouter();
  const { user } = useUser();
  const role = user?.role;
  const [filter, setFilter]   = useState('Tümü');
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]     = useState('');

  const fetchHistory = useCallback(async () => {
    try {
      setError('');
      const res = await attendance.myHistory();
      setData(Array.isArray(res) ? res : []);
    } catch (err) {
      setError(err.message || 'Yüklenemedi');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (role !== 'instructor') fetchHistory();
  }, [fetchHistory, role]);

  if (role === 'instructor') return <InstructorHistory />;

  const onRefresh = () => { setRefreshing(true); fetchHistory(); };

  const total   = data.length;
  const present = data.filter(r => r.status === 'present' || r.status === 'excused').length;
  const absent  = data.filter(r => r.status === 'absent').length;
  const rate    = total > 0 ? Math.round((present / total) * 100) : 0;
  const barColor = rate >= 80 ? Colors.success : rate >= 60 ? Colors.warning : Colors.error;

  const filtered = FILTER_KEY[filter]
    ? data.filter(r => r.status === FILTER_KEY[filter])
    : data;

  const handleDispute = (item) => {
    if (!item.session_id) {
      Alert.alert('Uyarı', 'Bu kayıt için oturum bilgisi bulunamadı.');
      return;
    }
    Alert.prompt(
      'İtiraz Gönder',
      'İtiraz nedeninizi kısaca açıklayın:',
      [
        { text: 'İptal', style: 'cancel' },
        { text: 'Gönder', onPress: async (reason) => {
          if (!reason?.trim()) return;
          try {
            await disputes.submit({ sessionId: item.session_id, courseId: item.course_id, reason: reason.trim() });
            Alert.alert('Başarılı', 'İtirazınız öğretmene iletildi.');
          } catch (err) { Alert.alert('Hata', err?.message || 'İtiraz gönderilemedi.'); }
        }},
      ],
      'plain-text'
    );
  };

  const renderItem = ({ item }) => {
    const s = (item.is_flagged ? null : STATUS[item.status]) || STATUS.absent;
    const flagged = item.is_flagged;
    const date = new Date(item.marked_at);

    return (
      <View style={styles.card}>
        {/* Date column */}
        <View style={styles.datePill}>
          <Text style={styles.dateDay}>{date.getDate()}</Text>
          <Text style={styles.dateMon}>{date.toLocaleDateString('tr-TR', { month: 'short' })}</Text>
        </View>

        {/* Body */}
        <View style={styles.cardBody}>
          <Text style={styles.courseName} numberOfLines={1}>
            {item.course_name || item.course_code || `Ders #${item.course_id}`}
          </Text>
          <Text style={styles.cardTime}>
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

        {/* Status badge */}
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
          <Text style={styles.headerTitle}>Geçmişim</Text>
          <Text style={styles.headerSub}>Yoklama kayıtlarınız</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
          <Ionicons name="refresh-outline" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Rate card */}
      <LinearGradient colors={['#1E3A8A', '#2563EB']} style={styles.rateCard}>
        <View style={styles.rateRow}>
          <View>
            <Text style={styles.rateLabel}>Devam Oranı</Text>
            <Text style={styles.rateValue}>{rate}%</Text>
          </View>
          <View style={styles.rateStats}>
            <MiniStat label="Toplam" value={total} />
            <MiniStat label="Mevcut" value={present} />
            <MiniStat label="Yok"    value={absent}  />
          </View>
        </View>
        <View style={styles.rateBg}>
          <View style={[styles.rateFill, { width: `${rate}%`, backgroundColor: barColor }]} />
        </View>
      </LinearGradient>

      {/* Filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Count */}
      <View style={styles.countRow}>
        <Text style={styles.countText}>{filtered.length} kayıt</Text>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchHistory}>
            <Text style={styles.retryText}>Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Ionicons name="calendar-outline" size={56} color={Colors.border} />
              <Text style={styles.emptyText}>Kayıt bulunamadı</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function MiniStat({ label, value }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniVal}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },

  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: Colors.text, letterSpacing: -0.4 },
  headerSub:   { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  refreshBtn:  { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.primaryMuted, alignItems: 'center', justifyContent: 'center' },

  // Rate card
  rateCard:  { marginHorizontal: 20, marginBottom: 16, borderRadius: 20, padding: 20, ...Shadows.primary },
  rateRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  rateLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600', marginBottom: 4 },
  rateValue: { fontSize: 40, fontWeight: '800', color: '#fff', letterSpacing: -1 },
  rateStats: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  miniStat:  { alignItems: 'center', gap: 2 },
  miniVal:   { fontSize: 18, fontWeight: '800', color: '#fff' },
  miniLabel: { fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: '600' },
  rateBg:    { height: 6, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 3, overflow: 'hidden' },
  rateFill:  { height: '100%', borderRadius: 3 },

  // Filters
  filterScroll:  { maxHeight: 44 },
  filterContent: { paddingHorizontal: 20, gap: 8, alignItems: 'center' },
  filterTab:     { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border },
  filterTabActive:{ backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText:    { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  filterTextActive:{ color: '#fff' },

  countRow: { paddingHorizontal: 20, paddingVertical: 10 },
  countText:{ fontSize: 13, fontWeight: '600', color: Colors.textMuted },

  // Cards
  listContent: { paddingHorizontal: 20, paddingBottom: 20 },
  card:        { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.card, borderRadius: 16, padding: 14, marginBottom: 10, ...Shadows.xs },

  datePill: { width: 48, alignItems: 'center', backgroundColor: Colors.primaryMuted, borderRadius: 12, paddingVertical: 8, flexShrink: 0 },
  dateDay:  { fontSize: 20, fontWeight: '800', color: Colors.primary },
  dateMon:  { fontSize: 11, fontWeight: '700', color: Colors.primary, textTransform: 'uppercase' },

  cardBody:   { flex: 1, gap: 3 },
  courseName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  cardTime:   { fontSize: 12, color: Colors.textMuted },
  flagRow:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  flagText:   { fontSize: 11, color: Colors.warning, fontWeight: '600' },

  actionRow:       { flexDirection: 'row', gap: 6, marginTop: 6 },
  actionBtn:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: Colors.primaryMuted, borderRadius: 8 },
  actionBtnDanger: { backgroundColor: Colors.errorMuted },
  actionBtnText:   { fontSize: 11, fontWeight: '700' },

  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20, flexShrink: 0 },
  statusText:  { fontSize: 11, fontWeight: '700' },

  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  errorText: { fontSize: 14, color: Colors.error, marginTop: 12, textAlign: 'center' },
  retryBtn:  { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: Colors.primary, borderRadius: 10 },
  retryText: { color: '#fff', fontWeight: '700' },
  emptyText: { fontSize: 14, color: Colors.textMuted, marginTop: 12 },
});
