import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useUser } from '@/context/UserContext';
import ProfileScreen from './profile';
import { Colors, Shadows } from '@/config/theme';

export default function MoreScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, logout } = useUser();
  const role = user?.role;
  const userName = user?.name || user?.username || '';

  const menu = useMemo(() => [
    {
      title: t('more.management'),
      items: [
        { icon: 'checkmark-circle-outline', color: Colors.primary,  bg: Colors.primaryLight,  label: t('more.attendanceMgmt'), sub: t('more.attendanceMgmtSub'), route: '/(tabs)/attendance' },
        { icon: 'calendar-outline',         color: '#7C3AED',       bg: '#EDE9FE',            label: t('instructor.scheduleTitle'), sub: t('more.scheduleSub'), route: '/(tabs)/schedule'   },
        { icon: 'bar-chart-outline',        color: Colors.success,  bg: Colors.successLight,  label: t('tabs.reports'),         sub: t('more.reportsSub'),        route: '/(tabs)/reports'    },
      ],
    },
    {
      title: t('more.tools'),
      items: [
        { icon: 'scan-outline',         color: Colors.warning, bg: Colors.warningLight, label: t('more.faceRegister'),       sub: t('more.faceRegisterSub'), route: '/register-face', adminOnly: true },
        { icon: 'close-circle-outline', color: Colors.error,   bg: Colors.errorLight,   label: t('more.cancelClass'),      sub: t('more.cancelClassSub'),       route: '/cancel-class'  },
      ],
    },
    {
      title: t('more.account'),
      items: [
        { icon: 'notifications-outline', color: '#0EA5E9', bg: '#E0F2FE', label: t('settings.notifications'),       sub: t('more.notificationsSub'), route: '/settings' },
        { icon: 'lock-closed-outline',   color: Colors.primary, bg: Colors.primaryLight, label: t('more.security'), sub: t('more.securitySub'), route: '/settings' },
      ],
    },
  ], [t]);

  if (role === 'student') return <ProfileScreen />;

  const initials = userName?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'RC';
  const roleLabel = role === 'admin' ? t('roles.admin') : t('roles.instructor');

  const handleLogout = () =>
    Alert.alert(t('common.logout'), t('more.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.logout'), style: 'destructive', onPress: async () => { await logout(); router.replace('/'); } },
    ]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* Profile hero */}
        <LinearGradient colors={['#1E3A8A', '#2563EB']} style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.heroName}>{userName || t('common.userFallback')}</Text>
          <View style={styles.rolePill}>
            <Text style={styles.roleText}>{roleLabel}</Text>
          </View>
        </LinearGradient>

        {/* Menu sections */}
        {menu.map(section => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionLabel}>{section.title}</Text>
            <View style={styles.group}>
              {section.items.filter(item => !item.adminOnly || role === 'admin').map((item, i) => (
                <TouchableOpacity
                  key={item.label}
                  style={[styles.row, i < section.items.filter(it => !it.adminOnly || role === 'admin').length - 1 && styles.rowBorder]}
                  onPress={() => router.push(item.route)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconBox, { backgroundColor: item.bg }]}>
                    <Ionicons name={item.icon} size={20} color={item.color} />
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowLabel}>{item.label}</Text>
                    <Text style={styles.rowSub}>{item.sub}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Logout */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={20} color={Colors.error} />
            <Text style={styles.logoutText}>{t('common.logout')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>{t('common.version')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },

  // Hero
  hero:       { paddingTop: 36, paddingBottom: 28, alignItems: 'center', gap: 8 },
  avatar:     { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.45)', marginBottom: 4 },
  avatarText: { fontSize: 28, fontWeight: '800', color: '#fff' },
  heroName:   { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  rolePill:   { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 4, borderRadius: 20 },
  roleText:   { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },

  // Sections
  section:      { paddingHorizontal: 20, marginTop: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  group:        { backgroundColor: Colors.card, borderRadius: 16, overflow: 'hidden', ...Shadows.xs },

  row:        { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16 },
  rowBorder:  { borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  iconBox:    { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowBody:    { flex: 1 },
  rowLabel:   { fontSize: 15, fontWeight: '600', color: Colors.text },
  rowSub:     { fontSize: 12, color: Colors.textMuted, marginTop: 1 },

  // Logout
  logoutBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.card, borderRadius: 14, paddingVertical: 15, borderWidth: 1, borderColor: Colors.errorLight, ...Shadows.xs },
  logoutText: { fontSize: 15, fontWeight: '700', color: Colors.error },

  version: { textAlign: 'center', fontSize: 12, color: Colors.textMuted, marginTop: 24 },
});
