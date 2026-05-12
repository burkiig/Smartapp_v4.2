import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useUser } from '@/context/UserContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Shadows } from '@/config/theme';
import { auth } from '@/services/api';
import { setupPushNotifications, updateNotificationPreferences } from '@/services/notificationService';

const SETTINGS_KEY = '@smart_attendance_settings';

const DEFAULT_SETTINGS = {
  pushNotifications: true,
  notifyFlagged:     true,
  notifySessionEnds: true,
  notifyClassStart:  true,
};

export default function SettingsScreen() {
  const router = useRouter();
  const { user } = useUser();
  const userName = user?.name || user?.username || '';
  const userEmail = user?.email || '';
  const userDepartment = user?.department || '';
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY).then(raw => {
      if (raw) try { setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) }); } catch {}
    }).catch(() => {});
  }, []);

  const update = async (key, value) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(() => {});

    // Bildirim servisini anlık güncelle (ön plan filtresi için)
    updateNotificationPreferences(next);

    // pushNotifications toggle → backend'e push token kaydet veya sil
    if (key === 'pushNotifications') {
      try {
        if (value) {
          await setupPushNotifications();
        } else {
          await auth.savePushToken('');
        }
      } catch {
        // Non-critical — local state already updated
      }
    }
  };

  const handleReset = () => {
    Alert.alert('Ayarları Sıfırla', 'Tüm ayarlar varsayılanlara döndürülecek.', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Sıfırla', style: 'destructive', onPress: () => {
        setSettings(DEFAULT_SETTINGS);
        AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS)).catch(() => {});
        // Sync in-memory notification filter with reset defaults
        updateNotificationPreferences(DEFAULT_SETTINGS);
      }},
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Ayarlar</Text>
          <Text style={styles.headerSub}>Tercihlerinizi yönetin</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Profile card */}
        <LinearGradient colors={['#1E3A8A', '#2563EB']} style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileInitials}>
              {(userName || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </Text>
          </View>
          <View>
            <Text style={styles.profileName}>{userName || '—'}</Text>
            <Text style={styles.profileEmail}>{userEmail || '—'}</Text>
            {userDepartment && <Text style={styles.profileDept}>{userDepartment}</Text>}
          </View>
        </LinearGradient>

        {/* Bildirimler */}
        <Section icon="notifications" iconColor={Colors.primary} title="Bildirimler">
          <Row label="Anlık Bildirimler"       desc="Yoklama uyarılarını anlık alın"        value={settings.pushNotifications} onChange={v => update('pushNotifications', v)} />
          <Row label="Bayraklı Yoklama"         desc="Bayraklı kayıtlar için bildirim"       value={settings.notifyFlagged}     onChange={v => update('notifyFlagged', v)} last={false} />
          <Row label="Oturum Bitişi"            desc="Yoklama oturumu bittiğinde bildirim"   value={settings.notifySessionEnds} onChange={v => update('notifySessionEnds', v)} last={false} />
          <Row label="Ders Başlangıcı"          desc="Ders başlamak üzereyken bildirim"      value={settings.notifyClassStart}  onChange={v => update('notifyClassStart', v)} last />
        </Section>

        {/* Yoklama Yöntemleri — kurumsal zorunluluk */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconBox, { backgroundColor: Colors.warning + '18' }]}>
              <Ionicons name="shield-checkmark" size={18} color={Colors.warning} />
            </View>
            <Text style={styles.sectionTitle}>Yoklama Yöntemleri</Text>
          </View>
          <View style={[styles.card, styles.infoCard]}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.warning} />
            <Text style={styles.infoText}>
              Yüz tanıma, QR kod ve GPS doğrulama kurumunuz tarafından zorunlu tutulmaktadır.
              Bu ayarlar bireysel olarak değiştirilemez.
            </Text>
          </View>
          {[
            { icon: 'scan-outline',    label: 'QR Kod' },
            { icon: 'eye-outline',     label: 'Yüz Tanıma' },
            { icon: 'location-outline',label: 'GPS Doğrulama' },
          ].map(({ icon, label }) => (
            <View key={label} style={[styles.card, styles.methodRow]}>
              <Ionicons name={icon} size={18} color={Colors.warning} />
              <Text style={styles.methodLabel}>{label}</Text>
              <View style={styles.requiredBadge}>
                <Text style={styles.requiredText}>Zorunlu</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Sıfırla */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
            <Ionicons name="refresh-outline" size={18} color={Colors.error} />
            <Text style={styles.resetBtnText}>Ayarları Varsayılanlara Döndür</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ icon, iconColor, title, children }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIconBox, { backgroundColor: iconColor + '18' }]}>
          <Ionicons name={icon} size={18} color={iconColor} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Row({ label, desc, value, onChange, accent = Colors.primary, last }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <View style={styles.rowInfo}>
        <Text style={styles.rowLabel}>{label}</Text>
        {desc ? <Text style={styles.rowDesc}>{desc}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: Colors.border, true: accent + '50' }}
        thumbColor={value ? accent : Colors.textMuted}
        ios_backgroundColor={Colors.border}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  backBtn:     { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.bgAlt, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, letterSpacing: -0.3 },
  headerSub:   { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  profileCard:     { marginHorizontal: 20, marginTop: 20, borderRadius: 18, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16, ...Shadows.primary },
  profileAvatar:   { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  profileInitials: { fontSize: 20, fontWeight: '800', color: '#fff' },
  profileName:     { fontSize: 16, fontWeight: '700', color: '#fff', letterSpacing: -0.2 },
  profileEmail:    { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  profileDept:     { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 },

  section:       { paddingHorizontal: 20, marginTop: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  sectionIconBox:{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionTitle:  { fontSize: 15, fontWeight: '700', color: Colors.text, letterSpacing: -0.2 },

  card:     { backgroundColor: Colors.card, borderRadius: 16, paddingHorizontal: 16, ...Shadows.xs },
  row:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 },
  rowBorder:{ borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  rowInfo:  { flex: 1, marginRight: 16 },
  rowLabel: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 3 },
  rowDesc:  { fontSize: 12, color: Colors.textMuted },

  resetBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.card, borderRadius: 14, paddingVertical: 15, borderWidth: 1, borderColor: Colors.errorLight, ...Shadows.xs },
  resetBtnText: { fontSize: 14, fontWeight: '700', color: Colors.error },

  infoCard:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, marginBottom: 8, backgroundColor: Colors.warning + '12', borderWidth: 1, borderColor: Colors.warning + '30' },
  infoText:   { flex: 1, fontSize: 12, color: Colors.textMuted, lineHeight: 18 },
  methodRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 6 },
  methodLabel:{ flex: 1, fontSize: 14, fontWeight: '600', color: Colors.text },
  requiredBadge: { backgroundColor: Colors.warning + '20', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  requiredText:  { fontSize: 11, fontWeight: '700', color: Colors.warning },
});
