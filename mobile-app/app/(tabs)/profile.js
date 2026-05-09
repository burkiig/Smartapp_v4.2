import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useUser } from '@/context/UserContext';
import InstructorProfile from '@/screens/InstructorProfile';
import { auth, face } from '@/services/api';
import { Colors, Shadows, Radius } from '@/config/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useUser();
  const role = user?.role;
  const [profile, setProfile]     = useState(null);
  const [faceStatus, setFaceStatus] = useState(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    if (role !== 'instructor') {
      Promise.allSettled([auth.me(), face.myStatus()]).then(([me, fs]) => {
        if (me.status === 'fulfilled') setProfile(me.value);
        if (fs.status === 'fulfilled') setFaceStatus(fs.value);
      }).finally(() => setLoading(false));
    }
  }, [role]);

  if (role === 'instructor') return <InstructorProfile />;

  const handleLogout = () =>
    Alert.alert('Çıkış Yap', 'Çıkmak istediğinize emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Çıkış Yap', style: 'destructive', onPress: async () => { await logout(); router.replace('/'); } },
    ]);

  const name   = profile?.name || user?.name || user?.username || '—';
  const email  = profile?.email || user?.email || '—';
  const dept   = profile?.department || user?.department || '—';
  const stuNum = profile?.student_number || user?.student_number || '—';
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'ST';
  const joinDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';
  const faceOk   = faceStatus?.is_enrolled === true;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* Hero */}
        <LinearGradient colors={['#1E3A8A', '#2563EB']} style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={[styles.faceDot, { backgroundColor: faceOk ? Colors.success : Colors.error }]}>
            <Ionicons name={faceOk ? 'scan' : 'scan-outline'} size={11} color="#fff" />
          </View>
          <Text style={styles.heroName}>{name}</Text>
          <Text style={styles.heroSub}>Öğrenci · {stuNum}</Text>
        </LinearGradient>

        {loading ? (
          <View style={styles.centered}><ActivityIndicator color={Colors.primary} /></View>
        ) : (
          <>
            {/* Face banner */}
            {!faceOk ? (
              <TouchableOpacity style={styles.warnBanner} onPress={() => router.push('/register-face')}>
                <Ionicons name="warning-outline" size={18} color={Colors.warning} />
                <Text style={styles.warnText}>Yüz kaydı yapılmamış — Kayıt için dokunun</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.warning} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.okBanner} onPress={() => router.push('/register-face')}>
                <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                <Text style={styles.okText}>Yüz tanıma aktif ve hazır</Text>
                <Text style={styles.okSub}>Yeniden kaydet</Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.success} />
              </TouchableOpacity>
            )}

            {/* Info card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Kişisel Bilgiler</Text>
              <InfoRow icon="mail-outline"     color={Colors.primary}  label="E-posta"     value={email} />
              <InfoRow icon="business-outline" color="#7C3AED"         label="Bölüm"       value={dept} />
              <InfoRow icon="card-outline"     color={Colors.warning}  label="Öğrenci No"  value={stuNum} />
              <InfoRow icon="calendar-outline" color={Colors.error}    label="Kayıt Tarihi" value={joinDate} last />
            </View>

            {/* Actions */}
            <View style={styles.section}>
              {!faceOk ? (
                <MenuItem
                  icon="scan-outline"
                  bg={Colors.warningLight}
                  color={Colors.warning}
                  title="Yüz Kaydet"
                  sub="Face ID yoklaması için gerekli"
                  onPress={() => router.push('/register-face')}
                />
              ) : (
                <MenuItem
                  icon="refresh-outline"
                  bg="#F3E8FF"
                  color="#7C3AED"
                  title="Yüzümü Yeniden Kaydet"
                  sub="Tanıma başarısız oluyorsa güncelle"
                  onPress={() => router.push('/register-face')}
                />
              )}
              <MenuItem
                icon="log-out-outline"
                bg={Colors.errorLight}
                color={Colors.error}
                title="Çıkış Yap"
                sub="Hesabınızdan çıkış yapın"
                onPress={handleLogout}
                danger
              />
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

function MenuItem({ icon, bg, color, title, sub, onPress, danger }) {
  return (
    <TouchableOpacity
      style={[styles.menuItem, danger && styles.menuItemDanger]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.menuIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={styles.menuBody}>
        <Text style={[styles.menuTitle, danger && { color: Colors.error }]}>{title}</Text>
        {sub && <Text style={styles.menuSub}>{sub}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  centered:{ paddingVertical: 40, alignItems: 'center' },

  // Hero
  hero:       { paddingTop: 40, paddingBottom: 32, alignItems: 'center', position: 'relative' },
  avatar:     { width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)', marginBottom: 12 },
  avatarText: { fontSize: 32, fontWeight: '800', color: '#fff' },
  faceDot:    { position: 'absolute', top: 88, right: '50%', marginRight: -50, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  heroName:   { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.3, marginTop: 4 },
  heroSub:    { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4, fontWeight: '500' },

  // Banners
  warnBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.warningMuted, borderWidth: 1, borderColor: Colors.warningLight, marginHorizontal: 20, marginTop: 16, borderRadius: 12, padding: 14 },
  warnText:   { flex: 1, fontSize: 13, color: Colors.warning, fontWeight: '600' },
  okBanner:   { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.successMuted, borderWidth: 1, borderColor: Colors.successLight, marginHorizontal: 20, marginTop: 16, borderRadius: 12, padding: 14 },
  okText:     { flex: 1, fontSize: 13, color: Colors.success, fontWeight: '600' },
  okSub:      { fontSize: 11, color: Colors.success, opacity: 0.75, fontWeight: '500' },

  // Card
  card:      { backgroundColor: Colors.card, marginHorizontal: 20, marginTop: 16, borderRadius: 18, padding: 20, ...Shadows.sm },
  cardTitle: { fontSize: 13, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 16 },

  infoRow:       { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  infoIcon:      { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  infoBody:      { flex: 1 },
  infoLabel:     { fontSize: 11, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  infoValue:     { fontSize: 14, fontWeight: '600', color: Colors.text },

  // Menu
  section:        { paddingHorizontal: 20, marginTop: 16, gap: 8 },
  menuItem:       { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.card, borderRadius: 14, padding: 16, ...Shadows.xs },
  menuItemDanger: { borderWidth: 1, borderColor: Colors.errorLight },
  menuIcon:       { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  menuBody:       { flex: 1 },
  menuTitle:      { fontSize: 15, fontWeight: '600', color: Colors.text },
  menuSub:        { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  version: { textAlign: 'center', fontSize: 12, color: Colors.textMuted, marginTop: 28 },
});
