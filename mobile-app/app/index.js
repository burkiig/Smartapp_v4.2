import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
  Animated, ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useUser } from '@/context/UserContext';
import { face, auth } from '@/services/api';
import { Colors, Shadows, Radius, Spacing } from '@/config/theme';
import LanguageToggle from '@/components/LanguageToggle';

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { login } = useUser();

  const [username, setUsername]         = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const isRedirectingRef = useRef(false);

  // Şifre sıfırlama modal durumu: null | 'forgot' | 'reset'
  const [resetMode, setResetMode]           = useState(null);
  const [resetEmail, setResetEmail]         = useState('');
  const [resetToken, setResetToken]         = useState('');
  const [resetNewPass, setResetNewPass]     = useState('');
  const [resetLoading, setResetLoading]     = useState(false);
  const [resetMsg, setResetMsg]             = useState('');

  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const openForgot = () => {
    setResetEmail('');
    setResetToken('');
    setResetNewPass('');
    setResetMsg('');
    setResetMode('forgot');
  };

  const handleForgot = async () => {
    if (!resetEmail.trim()) {
      Alert.alert(t('common.error'), t('auth.enterEmail'));
      return;
    }
    setResetLoading(true);
    try {
      await auth.forgotPassword(resetEmail.trim());
      setResetMsg(t('auth.resetEmailSent'));
      setResetMode('reset');
    } catch (err) {
      Alert.alert(t('common.error'), err?.message || t('common.somethingWrong'));
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetToken.trim() || !resetNewPass.trim()) {
      Alert.alert(t('common.error'), t('auth.enterTokenAndPassword'));
      return;
    }
    setResetLoading(true);
    try {
      await auth.resetPassword(resetToken.trim(), resetNewPass.trim());
      setResetMode(null);
      Alert.alert(t('common.success'), t('auth.passwordUpdated'));
    } catch (err) {
      Alert.alert(t('common.error'), err?.message || t('auth.tokenInvalid'));
    } finally {
      setResetLoading(false);
    }
  };

  const handleSignIn = async () => {
    if (!username.trim() || !password.trim()) {
      shake();
      Alert.alert(t('common.missingInfo'), t('auth.missingCredentials'));
      return;
    }
    setLoading(true);
    isRedirectingRef.current = false;
    try {
      const result = await login(username.trim(), password);
      if (result.success) {
        // Cover the form immediately — prevents flicker while navigation resolves
        isRedirectingRef.current = true;
        setIsRedirecting(true);

        // All roles must pass face verification — no bypass
        let isEnrolled = false;
        try {
          const faceStatus = await face.myStatus();
          isEnrolled = faceStatus?.is_enrolled === true;
        } catch {
          isRedirectingRef.current = false;
          setIsRedirecting(false);
          shake();
          Alert.alert(t('common.connectionError'), t('auth.faceCheckFailed'));
          return;
        }

        // Wait one frame so the Modal renders before navigation starts
        await new Promise(resolve => requestAnimationFrame(resolve));

        if (!isEnrolled) {
          router.replace({ pathname: '/register-face', params: { login_flow: 'true' } });
        } else {
          router.replace('/login-face-verify');
        }

      } else {
        shake();
        Alert.alert(t('auth.loginFailedTitle'), result.error || t('auth.loginFailed'));
      }
    } catch (err) {
      isRedirectingRef.current = false;
      setIsRedirecting(false);
      shake();
      Alert.alert(t('common.connectionError'), err.message || t('common.serverUnreachable'));
    } finally {
      if (!isRedirectingRef.current) setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.langBar}>
        <LanguageToggle variant="full" />
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero */}
          <View style={styles.hero}>
            <LinearGradient
              colors={['#1E3A8A', '#2563EB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoGradient}
            >
              <Ionicons name="school" size={40} color="#fff" />
            </LinearGradient>
            <Text style={styles.appName}>{t('common.appName')}</Text>
            <Text style={styles.tagline}>{t('common.tagline')}</Text>
          </View>

          {/* Card */}
          <Animated.View style={[styles.card, { transform: [{ translateX: shakeAnim }] }]}>
            <Text style={styles.cardTitle}>{t('auth.loginTitle')}</Text>
            <Text style={styles.cardSub}>{t('auth.loginSubtitle')}</Text>

            {/* Username */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('auth.usernameLabel')}</Text>
              <View style={[styles.inputRow, focusedField === 'user' && styles.inputRowFocused]}>
                <Ionicons name="person-outline" size={18} color={focusedField === 'user' ? Colors.primary : Colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder={t('auth.usernamePlaceholder')}
                  placeholderTextColor={Colors.textMuted}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setFocusedField('user')}
                  onBlur={() => setFocusedField(null)}
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>{t('auth.passwordLabel')}</Text>
                <TouchableOpacity onPress={openForgot}>
                  <Text style={styles.forgotText}>{t('auth.forgotPassword')}</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.inputRow, focusedField === 'pass' && styles.inputRowFocused]}>
                <Ionicons name="lock-closed-outline" size={18} color={focusedField === 'pass' ? Colors.primary : Colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder={t('auth.passwordPlaceholder')}
                  placeholderTextColor={Colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  onFocus={() => setFocusedField('pass')}
                  onBlur={() => setFocusedField(null)}
                  returnKeyType="done"
                  onSubmitEditing={handleSignIn}
                />
                <TouchableOpacity onPress={() => setShowPassword(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSignIn}
              disabled={loading}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={loading ? ['#94A3B8', '#94A3B8'] : ['#2563EB', '#1D4ED8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitGradient}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.submitText}>{t('auth.signIn')}</Text>
                }
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.signupRow}>
              <Text style={styles.signupText}>{t('auth.noAccount')} </Text>
              <TouchableOpacity onPress={() => Alert.alert(t('auth.signUpTitle'), t('auth.signUpContactAdmin'))}>
                <Text style={styles.signupLink}>{t('common.register')}</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Şifre Sıfırlama Modal */}
      <Modal
        visible={resetMode !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setResetMode(null)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalBackdrop}>
          <View style={styles.resetModal}>
            {/* Header */}
            <View style={styles.resetModalHeader}>
              <Text style={styles.resetModalTitle}>
                {resetMode === 'forgot' ? t('auth.resetForgotTitle') : t('auth.resetNewPasswordTitle')}
              </Text>
              <TouchableOpacity onPress={() => setResetMode(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.resetModalSub}>
              {resetMode === 'forgot'
                ? t('auth.resetForgotSub')
                : resetMsg || t('auth.resetTokenSub')}
            </Text>

            {resetMode === 'forgot' && (
              <View style={styles.resetField}>
                <Ionicons name="mail-outline" size={18} color={Colors.textMuted} />
                <TextInput
                  style={styles.resetInput}
                  placeholder={t('auth.emailPlaceholder')}
                  placeholderTextColor={Colors.textMuted}
                  value={resetEmail}
                  onChangeText={setResetEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            )}

            {resetMode === 'reset' && (
              <>
                <View style={styles.resetField}>
                  <Ionicons name="key-outline" size={18} color={Colors.textMuted} />
                  <TextInput
                    style={styles.resetInput}
                    placeholder={t('auth.tokenPlaceholder')}
                    placeholderTextColor={Colors.textMuted}
                    value={resetToken}
                    onChangeText={setResetToken}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                <View style={styles.resetField}>
                  <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} />
                  <TextInput
                    style={styles.resetInput}
                    placeholder={t('auth.newPasswordPlaceholder')}
                    placeholderTextColor={Colors.textMuted}
                    value={resetNewPass}
                    onChangeText={setResetNewPass}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                </View>
              </>
            )}

            <TouchableOpacity
              style={[styles.resetSubmitBtn, resetLoading && { opacity: 0.7 }]}
              onPress={resetMode === 'forgot' ? handleForgot : handleResetPassword}
              disabled={resetLoading}
            >
              {resetLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.resetSubmitText}>
                    {resetMode === 'forgot' ? t('common.send') : t('auth.updatePassword')}
                  </Text>
              }
            </TouchableOpacity>

            {resetMode === 'reset' && (
              <TouchableOpacity onPress={() => setResetMode('forgot')} style={{ marginTop: 12, alignItems: 'center' }}>
                <Text style={styles.forgotText}>{t('auth.resendEmail')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal overlay — native layer, sits above navigation transitions */}
      <Modal
        visible={isRedirecting}
        transparent={false}
        animationType="fade"
        statusBarTranslucent
      >
        <LinearGradient
          colors={['#1E3A8A', '#2563EB']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.redirectOverlay}
        >
          <View style={styles.redirectContent}>
            <LinearGradient
              colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
              style={styles.redirectIconBg}
            >
              <Ionicons name="shield-checkmark" size={36} color="#fff" />
            </LinearGradient>
            <ActivityIndicator color="#fff" size="large" style={{ marginTop: 24 }} />
            <Text style={styles.redirectText}>{t('auth.identityVerified')}</Text>
            <Text style={styles.redirectSub}>{t('auth.preparing')}</Text>
          </View>
        </LinearGradient>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  langBar: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },

  // Hero
  hero:        { alignItems: 'center', paddingTop: Spacing['3xl'], paddingBottom: Spacing['2xl'] },
  logoGradient:{ width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.base, ...Shadows.primary },
  appName:     { fontSize: 26, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },
  tagline:     { fontSize: 14, color: Colors.textMuted, marginTop: 4 },

  // Card
  card:      { backgroundColor: Colors.card, borderRadius: 24, padding: Spacing.xl, ...Shadows.lg },
  cardTitle: { fontSize: 22, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  cardSub:   { fontSize: 14, color: Colors.textMuted, marginBottom: Spacing.xl },

  // Fields
  fieldGroup:      { marginBottom: Spacing.base },
  labelRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label:           { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 8 },
  forgotText:      { fontSize: 13, fontWeight: '600', color: Colors.primary },
  inputRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.bgAlt, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13 },
  inputRowFocused: { borderColor: Colors.primary, backgroundColor: Colors.primaryMuted },
  input:           { flex: 1, fontSize: 15, color: Colors.text },

  // Submit
  submitBtn:         { borderRadius: 14, overflow: 'hidden', marginTop: Spacing.sm, ...Shadows.primary },
  submitBtnDisabled: { opacity: 0.7 },
  submitGradient:    { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  submitText:        { fontSize: 16, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },

  // Footer
  signupRow:  { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.lg },
  signupText: { fontSize: 14, color: Colors.textMuted },
  signupLink: { fontSize: 14, fontWeight: '700', color: Colors.primary },

  // Şifre sıfırlama modal
  modalBackdrop:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  resetModal:      { backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.xl, paddingBottom: Spacing['3xl'] },
  resetModalHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  resetModalTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  resetModalSub:   { fontSize: 13, color: Colors.textMuted, marginBottom: Spacing.lg, lineHeight: 19 },
  resetField:      { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.bgAlt, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 12 },
  resetInput:      { flex: 1, fontSize: 15, color: Colors.text },
  resetSubmitBtn:  { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  resetSubmitText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  // Redirect overlay (inside Modal — fills entire screen)
  redirectOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  redirectContent: {
    alignItems: 'center',
  },
  redirectIconBg: {
    width: 80, height: 80, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  redirectText: {
    marginTop: 16, fontSize: 20, fontWeight: '700',
    color: '#fff', letterSpacing: -0.3,
  },
  redirectSub: {
    marginTop: 6, fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
});
