import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useUser } from '@/context/UserContext';
import { auth, dashboard } from '@/services/api';
import { Colors, Shadows } from '@/config/theme';

export default function InstructorProfile() {
  const router = useRouter();
  const { user, logout } = useUser();
  const [profile, setProfile] = useState(null);
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([auth.me(), dashboard.stats()])
      .then(([p, s]) => {
        if (p.status === 'fulfilled') setProfile(p.value);
        if (s.status === 'fulfilled') setStats(s.value);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () =>
    Alert.alert('Çıkış Yap', 'Çıkmak istediğinize emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Çıkış Yap', style: 'destructive', onPress: async () => { await logout(); router.replace('/'); } },
    ]);

  const name     = profile?.name || user?.name || user?.username || '—';
  const email    = profile?.email || user?.email || '—';
  const dept     = profile?.department || user?.department || '—';
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'HO';

  const STATS = [
    { icon: 'book-outline',       color: Colors.primary, value: stats?.total_courses   ?? '—', label: 'Aktif Ders' },
    { icon: 'people-outline',     color: Colors.success, value: stats?.total_enrolled  ?? '—', label: 'Öğrenci' },
    { icon: 'play-circle-outline',color: Colors.warning, value: stats?.active_sessions ?? '—', label: 'Aktif Oturum' },
    { icon: 'flag-outline',       color: Colors.error,   value: stats?.flagged_records ?? '—', label: 'Bayraklı' },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        <LinearGradient colors={['#1E3A8A', '#2563EB']} style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.heroName}>{name}</Text>
          <View style={styles.rolePill}>
            <Text style={styles.roleText}>Öğretim Görevlisi</Text>
          </View>
        </LinearGradient>

        {loading ? (
          <View style={styles.centered}><ActivityIndicator color={Colors.primary} /></View>
        ) : (
          <>
            <View style={styles.statsGrid}>
              {STATS.map(s => (
                <View key={s.label} style={styles.statCard}>
                  <View style={[styles.statIcon, { backgroundColor: s.color + '18' }]}>
                    <Ionicons name={s.icon} size={20} color={s.color} />
                  </View>
                  <Text style={styles.statValue}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Kişisel Bilgiler</Text>
              <InfoRow icon="mail-outline"     color={Colors.primary} label="E-posta" value={email} />
              <InfoRow icon="business-outline" color="#7C3AED"        label="Bölüm"   value={dept} last />
            </View>

            <View style={styles.section}>
              <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
                <Ionicons name="log-out-outline" size={20} color={Colors.error} />
                <Text style={styles.logoutText}>Çıkış Yap</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.version}>Smart Attendance · v1.0.0</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, color, label, value, last }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <View style={[styles.infoIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View style={styles.infoBody}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  centered:{ paddingVertical: 40, alignItems: 'center' },

  hero:       { paddingTop: 40, paddingBottom: 28, alignItems: 'center', gap: 8 },
  avatar:     { width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.45)', marginBottom: 4 },
  avatarText: { fontSize: 32, fontWeight: '800', color: '#fff' },
  heroName:   { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  rolePill:   { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 5, borderRadius: 20 },
  roleText:   { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },

  statsGrid:  { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 10 },
  statCard:   { flex: 1, minWidth: '47%', backgroundColor: Colors.card, borderRadius: 14, padding: 14, alignItems: 'center', ...Shadows.xs },
  statIcon:   { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statValue:  { fontSize: 26, fontWeight: '800', color: Colors.text, letterSpacing: -0.5, marginBottom: 4 },
  statLabel:  { fontSize: 12, color: Colors.textMuted, fontWeight: '500', textAlign: 'center' },

  card:      { backgroundColor: Colors.card, marginHorizontal: 16, borderRadius: 18, padding: 20, ...Shadows.xs },
  cardTitle: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 16 },
  infoRow:       { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  infoIcon:  { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  infoBody:  { flex: 1 },
  infoLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  infoValue: { fontSize: 14, fontWeight: '600', color: Colors.text },

  section:    { paddingHorizontal: 16, marginTop: 16 },
  logoutBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.card, borderRadius: 14, paddingVertical: 15, borderWidth: 1, borderColor: Colors.errorLight, ...Shadows.xs },
  logoutText: { fontSize: 15, fontWeight: '700', color: Colors.error },

  version: { textAlign: 'center', fontSize: 12, color: Colors.textMuted, marginTop: 24 },
});
