import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '@/config/theme';

const STATUS_MAP = {
  'Katıldı':   { icon: 'checkmark-circle', color: Colors.success, bg: Colors.successLight },
  'İncelemede':{ icon: 'time',              color: Colors.warning, bg: Colors.warningLight },
  'Katılmadı': { icon: 'close-circle',      color: Colors.error,   bg: Colors.errorLight  },
};

export default function RecentActivity({ activity, onViewAll }) {
  const s = STATUS_MAP[activity.status] || STATUS_MAP['Katılmadı'];

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Son Aktivite</Text>
        <TouchableOpacity onPress={onViewAll}>
          <Text style={styles.viewAll}>Tümünü Gör →</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <View style={[styles.iconBox, { backgroundColor: s.bg }]}>
          <Ionicons name={s.icon} size={24} color={s.color} />
        </View>
        <View style={styles.info}>
          <Text style={styles.course} numberOfLines={1}>{activity.course}</Text>
          <Text style={styles.time}>{activity.time}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: s.bg }]}>
          <Text style={[styles.badgeText, { color: s.color }]}>{activity.status}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section:      { paddingHorizontal: 20, marginBottom: 28 },
  headerRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.text, letterSpacing: -0.2 },
  viewAll:      { fontSize: 13, fontWeight: '600', color: Colors.primary },

  card:   { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.card, borderRadius: 16, padding: 16, ...Shadows.sm },
  iconBox:{ width: 48, height: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  info:   { flex: 1 },
  course: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 3 },
  time:   { fontSize: 12, color: Colors.textMuted },
  badge:  { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '700' },
});
