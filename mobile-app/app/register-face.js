import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  Linking,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { face } from './shared/services/api';
import { Colors, Shadows } from './shared/config/theme';

const { width } = Dimensions.get('window');

const STEPS = [
  { label: 'Düz Bakın',   desc: 'Kameraya doğrudan bakın', icon: 'eye-outline' },
  { label: 'Sola Dönün',  desc: 'Başınızı hafifçe sola çevirin', icon: 'arrow-back-outline' },
  { label: 'Sağa Dönün',  desc: 'Başınızı hafifçe sağa çevirin', icon: 'arrow-forward-outline' },
];

export default function RegisterFaceScreen() {
  const router  = useRouter();
  const { onboarding } = useLocalSearchParams();
  const isOnboarding = onboarding === 'true';
  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep]             = useState(1);
  const [processing, setProcessing] = useState(false);
  const [photos, setPhotos]         = useState([]);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const cameraRef = useRef(null);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 1200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // ─── Permission: not yet determined ────────────────────────────────────────

  if (!permission) {
    return (
      <SafeAreaView style={styles.safe}>
        <LinearGradient colors={['#7C3AED', '#A855F7']} style={styles.gradient}>
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.permTitle}>İzin İsteniyor...</Text>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // ─── Permission: denied ─────────────────────────────────────────────────────

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe}>
        <LinearGradient colors={['#7C3AED', '#A855F7']} style={styles.gradient}>
          <View style={styles.centerBox}>
            <View style={styles.permIcon}>
              <Ionicons name="camera-outline" size={48} color="#fff" />
            </View>
            <Text style={styles.permTitle}>Kamera İzni Gerekli</Text>
            <Text style={styles.permSub}>
              Yüz kaydı için kamera erişimi gerekiyor.
            </Text>
            {permission.canAskAgain ? (
              <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
                <Ionicons name="camera" size={18} color="#7C3AED" />
                <Text style={styles.permBtnText}>İzin Ver</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.permBtn} onPress={() => Linking.openSettings()}>
                <Ionicons name="settings-outline" size={18} color="#7C3AED" />
                <Text style={styles.permBtnText}>Ayarları Aç</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
              <Text style={styles.backLinkText}>Geri Dön</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // ─── Capture handler ───────────────────────────────────────────────────────

  const handleCapture = async () => {
    if (!cameraRef.current || processing) return;
    setProcessing(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.7 });
      if (!photo?.base64) {
        Alert.alert('Hata', 'Fotoğraf çekilemedi. Tekrar deneyin.');
        return;
      }

      const newPhotos = [...photos, photo.base64];
      setPhotos(newPhotos);

      if (step < 3) {
        setStep(step + 1);
      } else {
        // Send all 3 photos; backend returns { success: true, message: "..." }
        let enrollOk = false;
        for (const b64 of newPhotos) {
          const result = await face.enroll(b64);
          if (result?.success === true) enrollOk = true;
        }

        if (enrollOk) {
          Alert.alert(
            'Kayıt Başarılı',
            'Yüzünüz başarıyla sisteme kaydedildi.',
            [{
              text: 'Tamam',
              onPress: () => isOnboarding
                ? router.replace('/(tabs)/home')
                : router.back(),
            }]
          );
        } else {
          Alert.alert('Hata', 'Yüz kaydı başarısız oldu. Lütfen tekrar deneyin.');
          setStep(1);
          setPhotos([]);
        }
      }
    } catch (err) {
      Alert.alert('Hata', err?.message || 'Bir hata oluştu. Tekrar deneyin.');
    } finally {
      setProcessing(false);
    }
  };

  const currentStep = STEPS[step - 1];
  const frameSize   = width * 0.72;

  // ─── Main UI ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={['#7C3AED', '#A855F7']} style={styles.gradient}>

        {/* Header */}
        <View style={styles.header}>
          {isOnboarding ? (
            <View style={{ width: 40 }} />
          ) : (
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
          )}
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>
              {isOnboarding ? 'Yüz Kaydı Gerekli' : 'Yüz Kaydı'}
            </Text>
            <Text style={styles.headerSub}>Adım {step} / 3</Text>
          </View>
          {/* Step dots */}
          <View style={styles.dots}>
            {[1, 2, 3].map(s => (
              <View
                key={s}
                style={[
                  styles.dot,
                  s === step && styles.dotActive,
                  s < step   && styles.dotDone,
                ]}
              />
            ))}
          </View>
        </View>

        {/* Onboarding banner */}
        {isOnboarding && (
          <View style={styles.onboardingBanner}>
            <Ionicons name="information-circle-outline" size={18} color="rgba(255,255,255,0.9)" />
            <Text style={styles.onboardingText}>
              Yoklama alabilmek için yüzünüzü bir kez kaydetmeniz gerekiyor.
            </Text>
          </View>
        )}

        {/* Camera */}
        <View style={styles.cameraWrap}>
          <Animated.View
            style={[
              styles.cameraFrame,
              { width: frameSize, height: frameSize, transform: [{ scale: pulseAnim }] },
            ]}
          >
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />

            {/* Corner guides */}
            <View style={[styles.corner, styles.cTL]} />
            <View style={[styles.corner, styles.cTR]} />
            <View style={[styles.corner, styles.cBL]} />
            <View style={[styles.corner, styles.cBR]} />

            {/* Processing overlay */}
            {processing && (
              <View style={styles.processingOverlay}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.processingText}>İşleniyor...</Text>
              </View>
            )}
          </Animated.View>
        </View>

        {/* Step instruction */}
        <View style={styles.instructionBox}>
          <View style={styles.stepIconBox}>
            <Ionicons name={currentStep.icon} size={22} color="#A855F7" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.stepLabel}>{currentStep.label}</Text>
            <Text style={styles.stepDesc}>{currentStep.desc}</Text>
          </View>
        </View>

        {/* Completed indicators */}
        <View style={styles.completedRow}>
          {STEPS.map((s, i) => (
            <View key={i} style={[styles.completedPill, i < step - 1 && styles.completedPillDone]}>
              {i < step - 1
                ? <Ionicons name="checkmark" size={13} color="#fff" />
                : <Text style={styles.completedPillNum}>{i + 1}</Text>
              }
            </View>
          ))}
        </View>

        {/* Capture button */}
        <View style={styles.btnArea}>
          <TouchableOpacity
            style={[styles.captureBtn, processing && styles.captureBtnDisabled]}
            onPress={handleCapture}
            disabled={processing}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={processing ? ['#6B7280', '#4B5563'] : ['#fff', '#F3E8FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.captureBtnGrad}
            >
              {processing ? (
                <ActivityIndicator color="#A855F7" />
              ) : (
                <>
                  <Ionicons name="camera" size={20} color="#7C3AED" />
                  <Text style={styles.captureBtnText}>
                    {step < 3 ? 'Fotoğraf Çek' : 'Kaydet'}
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Tips */}
        <View style={styles.tips}>
          <Text style={styles.tipsTitle}>İpuçları</Text>
          <Text style={styles.tipsText}>• İyi aydınlatılmış bir ortamda olun</Text>
          <Text style={styles.tipsText}>• Gözlük veya maske takmayın</Text>
          <Text style={styles.tipsText}>• Yüzünüzü çerçeve içinde tutun</Text>
        </View>

        {/* Onboarding skip */}
        {isOnboarding && (
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => router.replace('/(tabs)/home')}
          >
            <Text style={styles.skipText}>Sonra Yap</Text>
            <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        )}

      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:     { flex: 1 },
  gradient: { flex: 1 },

  // Header
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, gap: 12 },
  backBtn:      { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1 },
  headerTitle:  { fontSize: 18, fontWeight: '700', color: '#fff' },
  headerSub:    { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  dots:         { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot:          { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotActive:    { backgroundColor: '#fff', width: 20, borderRadius: 4 },
  dotDone:      { backgroundColor: 'rgba(255,255,255,0.7)' },

  // Camera
  cameraWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cameraFrame: {
    borderRadius: 20, overflow: 'hidden', position: 'relative',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 10,
  },

  // Corners
  corner: { position: 'absolute', width: 36, height: 36, borderColor: '#fff' },
  cTL: { top: 12, left: 12, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 10 },
  cTR: { top: 12, right: 12, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 10 },
  cBL: { bottom: 12, left: 12, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 10 },
  cBR: { bottom: 12, right: 12, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 10 },

  processingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', gap: 12 },
  processingText:    { fontSize: 15, fontWeight: '600', color: '#fff' },

  // Instruction box
  instructionBox: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, marginVertical: 14, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: 14 },
  stepIconBox:    { width: 40, height: 40, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  stepLabel:      { fontSize: 15, fontWeight: '700', color: '#fff' },
  stepDesc:       { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  // Completed pills
  completedRow:       { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 16 },
  completedPill:      { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  completedPillDone:  { backgroundColor: 'rgba(255,255,255,0.5)' },
  completedPillNum:   { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },

  // Button
  btnArea:          { paddingHorizontal: 20, marginBottom: 12 },
  captureBtn:       { borderRadius: 16, overflow: 'hidden', ...Shadows.md },
  captureBtnDisabled: { opacity: 0.6 },
  captureBtnGrad:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 17 },
  captureBtnText:   { fontSize: 16, fontWeight: '700', color: '#7C3AED' },

  // Tips
  tips:      { marginHorizontal: 20, marginBottom: 20, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 14 },
  tipsTitle: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.9)', marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase' },
  tipsText:  { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: 4, lineHeight: 18 },

  // Onboarding
  onboardingBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginBottom: 10, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: 12 },
  onboardingText:   { flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.9)', lineHeight: 17 },
  skipBtn:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingBottom: 16 },
  skipText:         { fontSize: 13, color: 'rgba(255,255,255,0.55)', fontWeight: '500' },

  // Permission screens
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  permIcon:  { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  permTitle: { fontSize: 20, fontWeight: '700', color: '#fff', textAlign: 'center' },
  permSub:   { fontSize: 14, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 20 },
  permBtn:   { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28 },
  permBtnText:{ fontSize: 15, fontWeight: '600', color: '#7C3AED' },
  backLink:  { paddingVertical: 12 },
  backLinkText: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
});
