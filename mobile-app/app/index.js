import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
  Animated, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useUser } from './_context/UserContext';
import { face } from './shared/services/api';
import { Colors, Shadows, Radius, Spacing } from './shared/config/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useUser();

  const [username, setUsername]         = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [focusedField, setFocusedField] = useState(null);

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

  const handleSignIn = async () => {
    if (!username.trim() || !password.trim()) {
      shake();
      Alert.alert('Eksik Bilgi', 'Kullanıcı adı ve şifrenizi girin.');
      return;
    }
    setLoading(true);
    try {
      const result = await login(username.trim(), password);
      if (result.success) {
        const isStudent = result.user.role === 'student';
        if (isStudent) {
          // Check face enrollment — first-time students prompted to register
          // Use a 5s timeout so a slow network never blocks the login flow
          try {
            const faceStatus = await Promise.race([
              face.myStatus(),
              new Promise((_, reject) => setTimeout(() => reject(new Error('skip')), 5000)),
            ]);
            if (!faceStatus?.is_enrolled) {
              router.replace({ pathname: '/register-face', params: { onboarding: 'true' } });
              return;
            }
          } catch {
            // If check fails or times out, continue to home normally
          }
          router.replace('/(tabs)/home');
        } else {
          router.replace('/(tabs)/dashboard');
        }
      } else {
        shake();
        Alert.alert('Giriş Başarısız', result.error || 'Kullanıcı adı veya şifre hatalı.');
      }
    } catch (err) {
      shake();
      Alert.alert('Bağlantı Hatası', err.message || 'Sunucuya bağlanılamadı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
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
            <Text style={styles.appName}>Smart Attendance</Text>
            <Text style={styles.tagline}>Yoklama yönetim sistemi</Text>
          </View>

          {/* Card */}
          <Animated.View style={[styles.card, { transform: [{ translateX: shakeAnim }] }]}>
            <Text style={styles.cardTitle}>Giriş Yap</Text>
            <Text style={styles.cardSub}>Devam etmek için giriş yapın</Text>

            {/* Username */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Kullanıcı Adı</Text>
              <View style={[styles.inputRow, focusedField === 'user' && styles.inputRowFocused]}>
                <Ionicons name="person-outline" size={18} color={focusedField === 'user' ? Colors.primary : Colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="Kullanıcı adınız"
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
                <Text style={styles.label}>Şifre</Text>
                <TouchableOpacity onPress={() => Alert.alert('Şifre Sıfırlama', 'Sistem yöneticinizle iletişime geçin.')}>
                  <Text style={styles.forgotText}>Şifremi unuttum</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.inputRow, focusedField === 'pass' && styles.inputRowFocused]}>
                <Ionicons name="lock-closed-outline" size={18} color={focusedField === 'pass' ? Colors.primary : Colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="Şifreniz"
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
                  : <Text style={styles.submitText}>Giriş Yap</Text>
                }
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.signupRow}>
              <Text style={styles.signupText}>Hesabınız yok mu? </Text>
              <TouchableOpacity onPress={() => Alert.alert('Kayıt', 'Yeni hesap için sistem yöneticinizle iletişime geçin.')}>
                <Text style={styles.signupLink}>Kayıt Ol</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
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
});
