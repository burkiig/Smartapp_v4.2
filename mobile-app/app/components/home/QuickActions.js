import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadows } from '../../shared/config/theme';

export default function QuickActions({ hasLiveSession, onStartAttendance, onExcuse, onHistory }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Hızlı İşlemler</Text>

      {/* Primary CTA */}
      <TouchableOpacity style={styles.primaryWrap} onPress={onStartAttendance} activeOpacity={0.85}>
        <LinearGradient
          colors={hasLiveSession ? ['#2563EB', '#1D4ED8'] : ['#475569', '#334155']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.primaryBtn}
        >
          <View style={styles.primaryIconBox}>
            <Ionicons name={hasLiveSession ? 'qr-code' : 'time-outline'} size={28} color="#fff" />
          </View>
          <View style={styles.primaryText}>
            <Text style={styles.primaryTitle}>Yoklama Al</Text>
            <Text style={styles.primarySub}>
              {hasLiveSession ? 'QR → Yüz → Konum' : 'Aktif ders bekleniyor'}
            </Text>
          </View>
          <View style={styles.arrowBox}>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* Secondary actions */}
      <View style={styles.secondaryRow}>
        <ActionCard
          icon="document-text-outline"
          label="Mazeret"
          sublabel="Devamsızlık bildir"
          color={Colors.warning}
          bg={Colors.warningLight}
          onPress={onExcuse}
        />
        <ActionCard
          icon="time-outline"
          label="Geçmiş"
          sublabel="Yoklama kayıtları"
          color={Colors.success}
          bg={Colors.successLight}
          onPress={onHistory}
        />
      </View>
    </View>
  );
}

function ActionCard({ icon, label, sublabel, color, bg, onPress }) {
  return (
    <TouchableOpacity style={styles.actionCard} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.actionIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
      <Text style={styles.actionSub}>{sublabel}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  section:      { paddingHorizontal: 20, marginBottom: 20 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.text, marginBottom: 14, letterSpacing: -0.2 },

  primaryWrap: { borderRadius: 18, marginBottom: 12, ...Shadows.primary },
  primaryBtn:  { flexDirection: 'row', alignItems: 'center', borderRadius: 18, padding: 18, gap: 14 },
  primaryIconBox:{ width: 52, height: 52, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  primaryText: { flex: 1 },
  primaryTitle:{ fontSize: 17, fontWeight: '700', color: '#fff', marginBottom: 3 },
  primarySub:  { fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  arrowBox:    { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },

  secondaryRow: { flexDirection: 'row', gap: 12 },
  actionCard:   { flex: 1, backgroundColor: Colors.card, borderRadius: 16, padding: 16, ...Shadows.sm },
  actionIcon:   { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  actionLabel:  { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 3 },
  actionSub:    { fontSize: 11, color: Colors.textMuted, fontWeight: '500' },
});
