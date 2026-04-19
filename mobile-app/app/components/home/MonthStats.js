import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../shared/config/theme';

export default function MonthStats({ stats }) {
  const pct = Math.min(Math.max(stats.percentage || 0, 0), 100);
  const barColor = pct >= 80 ? Colors.success : pct >= 60 ? Colors.warning : Colors.error;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Bu Ay</Text>
      <View style={styles.card}>
        {/* Rate row */}
        <View style={styles.rateRow}>
          <View>
            <Text style={styles.rateLabel}>Devam Oranı</Text>
            <Text style={[styles.rateValue, { color: barColor }]}>{pct}%</Text>
          </View>
          <View style={[styles.iconBox, { backgroundColor: barColor + '20' }]}>
            <Ionicons
              name={pct >= 80 ? 'trending-up' : pct >= 60 ? 'remove' : 'trending-down'}
              size={22}
              color={barColor}
            />
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.barBg}>
          <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: barColor }]} />
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatPill icon="calendar-outline" color={Colors.primary} label="Toplam" value={stats.totalDays} />
          <StatPill icon="checkmark-circle-outline" color={Colors.success} label="Mevcut" value={stats.present} />
          <StatPill icon="close-circle-outline" color={Colors.error} label="Yok" value={stats.absent} />
        </View>
      </View>
    </View>
  );
}

function StatPill({ icon, color, label, value }) {
  return (
    <View style={styles.pill}>
      <View style={[styles.pillIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={styles.pillValue}>{value}</Text>
      <Text style={styles.pillLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section:      { paddingHorizontal: 20, marginBottom: 20 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.text, marginBottom: 14, letterSpacing: -0.2 },
  card:         { backgroundColor: Colors.card, borderRadius: 18, padding: 20, ...Shadows.sm },

  rateRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  rateLabel:  { fontSize: 13, color: Colors.textMuted, fontWeight: '500', marginBottom: 4 },
  rateValue:  { fontSize: 38, fontWeight: '800', letterSpacing: -1 },
  iconBox:    { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  barBg:   { height: 6, backgroundColor: Colors.border, borderRadius: 3, marginBottom: 18, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },

  statsRow: { flexDirection: 'row', gap: 10 },
  pill:     { flex: 1, alignItems: 'center', gap: 6 },
  pillIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  pillValue:{ fontSize: 18, fontWeight: '800', color: Colors.text },
  pillLabel:{ fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
});
