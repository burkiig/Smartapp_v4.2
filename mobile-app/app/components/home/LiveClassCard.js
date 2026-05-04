import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '@/config/theme';

export default function LiveClassCard({ liveClass, onStartAttendance }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.4, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,   duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.wrapper}>
      <LinearGradient
        colors={['#059669', '#047857']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* Header row */}
        <View style={styles.row}>
          <View style={styles.liveBadge}>
            <Animated.View style={[styles.pulseDot, { transform: [{ scale: pulse }] }]} />
            <Text style={styles.liveText}>CANLI</Text>
          </View>
          <Text style={styles.time}>{liveClass.time}</Text>
        </View>

        {/* Course info */}
        <Text style={styles.code}>{liveClass.course}</Text>
        <Text style={styles.title}>{liveClass.title}</Text>

        {/* Meta */}
        <View style={styles.metaRow}>
          <MetaItem icon="location-outline" label={liveClass.room} />
          <MetaItem icon="person-outline"   label={liveClass.instructor} />
        </View>

        {/* CTA */}
        <TouchableOpacity style={styles.cta} onPress={onStartAttendance} activeOpacity={0.88}>
          <Ionicons name="qr-code-outline" size={18} color="#059669" />
          <Text style={styles.ctaText}>Yoklama Al</Text>
          <Ionicons name="arrow-forward" size={16} color="#059669" />
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
}

function MetaItem({ icon, label }) {
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={13} color="rgba(255,255,255,0.8)" />
      <Text style={styles.metaText}>{label || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
  },
  gradient: { padding: 20 },

  row:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  pulseDot:  { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FEF3C7' },
  liveText:  { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 1.2 },
  time:      { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },

  code:  { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.7)', letterSpacing: 0.5, marginBottom: 4 },
  title: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.2, marginBottom: 14 },

  metaRow:  { flexDirection: 'row', gap: 16, marginBottom: 18 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },

  cta:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 13 },
  ctaText: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '700', color: '#059669' },
});
