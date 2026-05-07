import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  Linking,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImageManipulator from 'expo-image-manipulator';
import { face } from '@/services/api';
import { useUser } from '@/context/UserContext';
import { Shadows } from '@/config/theme';

const { width } = Dimensions.get('window');
const MAX_RETRIES = 3;

export default function LoginFaceVerifyScreen() {
  const router = useRouter();
  const { logout, setFaceVerified, user } = useUser();

  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning]     = useState(false);
  const [retryCount, setRetryCount]     = useState(0);
  const [statusText, setStatusText]     = useState('Taramaya Hazır');
  /** False until expo CameraView reports ready — avoids empty/black preview gap after login. */
  const [isCameraReady, setIsCameraReady] = useState(false);
  const cameraRef = useRef(null);

  useEffect(() => {
    if (permission?.granted) setIsCameraReady(false);
  }, [permission?.granted]);

  useEffect(() => {
    if (!permission?.granted || isCameraReady) return;
    const id = setTimeout(() => setIsCameraReady(true), 12000);
    return () => clearTimeout(id);
  }, [permission?.granted, isCameraReady]);

  // Subtle pulse animation on the camera frame border
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 1400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const handleScan = async () => {
    if (!isCameraReady || !cameraRef.current || isScanning) return;
    setIsScanning(true);
    setStatusText('Taranıyor...');

    try {
      // First frame
      const photo1 = await cameraRef.current.takePictureAsync({ base64: false, quality: 1 });
      if (!photo1?.uri) throw new Error('Fotoğraf çekilemedi');

      // Resize to 640px wide — keep face recognition accuracy, cut payload size
      const resized1 = await ImageManipulator.manipulateAsync(
        photo1.uri,
        [{ resize: { width: 640 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      // Short wait → second frame for liveness
      await new Promise(r => setTimeout(r, 500));
      let base64_2 = null;
      try {
        const photo2  = await cameraRef.current.takePictureAsync({ base64: false, quality: 1 });
        const resized2 = await ImageManipulator.manipulateAsync(
          photo2.uri,
          [{ resize: { width: 640 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        base64_2 = resized2.base64;
      } catch {
        // Second frame optional
      }

      const result = await face.verify(resized1.base64, base64_2);

      if (result?.verified) {
        setStatusText('Doğrulandı!');
        // Mark face as verified — AuthGuard will now allow access
        setFaceVerified(true);
        const dest = (user?.role === 'instructor' || user?.role === 'admin')
          ? '/(tabs)/dashboard'
          : '/(tabs)/home';
        setTimeout(() => router.replace(dest), 600);
      } else {
        const remaining = MAX_RETRIES - (retryCount + 1);
        setRetryCount(prev => prev + 1);

        if (remaining <= 0) {
          // Exhausted retries — force logout
          Alert.alert(
            'Giriş Engellendi',
            'Çok fazla başarısız deneme. Güvenlik için oturumunuz kapatılıyor.',
            [{ text: 'Tamam', onPress: handleForceLogout }],
            { cancelable: false },
          );
        } else {
          setStatusText('Taramaya Hazır');
          Alert.alert(
            'Yüz Tanınamadı',
            `Yüzünüz doğrulanamadı. ${remaining} deneme hakkınız kaldı.\n\nİyi aydınlatılmış ortamda, gözlük/maske olmadan tekrar deneyin.`,
            [{ text: 'Tekrar Dene' }],
          );
        }
      }
    } catch (err) {
      setStatusText('Taramaya Hazır');
      Alert.alert('Hata', err?.message || 'Yüz taraması sırasında bir hata oluştu.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleForceLogout = async () => {
    await logout();
    router.replace('/');
  };

  // ─── Permission: loading ─────────────────────────────────────────────────

  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={['#7C3AED', '#A855F7']} style={styles.gradient}>
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.permTitle}>Kamera İzni İsteniyor...</Text>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // ─── Permission: denied ──────────────────────────────────────────────────

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={['#7C3AED', '#A855F7']} style={styles.gradient}>
          <View style={styles.centerBox}>
            <View style={styles.permIcon}>
              <Ionicons name="camera-outline" size={48} color="#fff" />
            </View>
            <Text style={styles.permTitle}>Kamera İzni Gerekli</Text>
            <Text style={styles.permSub}>
              Kimlik doğrulama için kamera erişimi zorunludur.
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
            <TouchableOpacity style={styles.logoutLink} onPress={handleForceLogout}>
              <Text style={styles.logoutLinkText}>Çıkış Yap</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // ─── Main UI ─────────────────────────────────────────────────────────────

  const frameSize    = width * 0.76;
  const retriesLeft  = MAX_RETRIES - retryCount;
  const isLastChance = retriesLeft === 1;

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#7C3AED', '#A855F7']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerBadge}>
            <Ionicons name="shield-checkmark" size={18} color="#A855F7" />
          </View>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Kimlik Doğrulama</Text>
            <Text style={styles.headerSub}>Giriş için yüz taraması gerekli</Text>
          </View>
          {/* Retry counter */}
          <View style={[styles.retryBadge, isLastChance && styles.retryBadgeWarn]}>
            <Text style={[styles.retryBadgeText, isLastChance && styles.retryBadgeTextWarn]}>
              {retriesLeft}/{MAX_RETRIES}
            </Text>
          </View>
        </View>

        {/* Camera */}
        <View style={styles.cameraWrap}>
          <Animated.View
            style={[
              styles.cameraFrame,
              { width: frameSize, height: frameSize },
              { transform: [{ scale: pulseAnim }] },
              isLastChance && styles.cameraFrameWarn,
            ]}
          >
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="front"
              onCameraReady={() => setIsCameraReady(true)}
            />

            {/* Corner guides */}
            <View style={[styles.corner, styles.cTL]} />
            <View style={[styles.corner, styles.cTR]} />
            <View style={[styles.corner, styles.cBL]} />
            <View style={[styles.corner, styles.cBR]} />

            {/* Scanning overlay */}
            {isScanning && (
              <View style={styles.scanningOverlay}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.scanningText}>Doğrulanıyor...</Text>
              </View>
            )}
          </Animated.View>

          <View style={styles.statusWrap}>
            <Text style={styles.statusText}>{statusText}</Text>
            <Text style={styles.statusSub}>
              {isScanning
                ? 'Lütfen hareketsiz bekleyin'
                : 'Yüzünüzü çerçeve içine alın, ardından butona basın'}
            </Text>
          </View>
        </View>

        {/* Scan button */}
        <View style={styles.btnArea}>
          <TouchableOpacity
            style={[styles.scanBtn, isScanning && styles.scanBtnDisabled]}
            onPress={handleScan}
            disabled={isScanning}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={isScanning ? ['#6B7280', '#4B5563'] : ['#fff', '#F3E8FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.scanBtnGrad}
            >
              {isScanning ? (
                <ActivityIndicator color="#A855F7" />
              ) : (
                <>
                  <Ionicons name="scan" size={20} color="#7C3AED" />
                  <Text style={styles.scanBtnText}>Yüz Taramasını Başlat</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutBtn} onPress={handleForceLogout} activeOpacity={0.7}>
            <Ionicons name="close-outline" size={16} color="rgba(255,255,255,0.55)" />
            <Text style={styles.logoutBtnText}>Vazgeç — Farklı Hesapla Giriş Yap</Text>
          </TouchableOpacity>
        </View>

        {/* Tips */}
        <View style={styles.tips}>
          <Text style={styles.tipsTitle}>İpuçları</Text>
          <Text style={styles.tipsText}>• Yüzünüzü iyi aydınlatılmış bir ortamda tutun</Text>
          <Text style={styles.tipsText}>• Gözlük veya maske takmayın</Text>
          <Text style={styles.tipsText}>• Kameraya doğrudan bakın ve hareketsiz durun</Text>
        </View>
      </LinearGradient>

      {/* Match login redirect modal — seamless until camera preview is live */}
      {!isCameraReady && (
        <View style={styles.cameraWarmupLayer} pointerEvents="auto">
          <LinearGradient
            colors={['#1E3A8A', '#2563EB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cameraWarmupGradient}
          >
            <View style={styles.cameraWarmupContent}>
              <LinearGradient
                colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
                style={styles.cameraWarmupIconBg}
              >
                <Ionicons name="shield-checkmark" size={36} color="#fff" />
              </LinearGradient>
              <ActivityIndicator color="#fff" size="large" style={{ marginTop: 24 }} />
              <Text style={styles.cameraWarmupTitle}>Kimlik Doğrulandı</Text>
              <Text style={styles.cameraWarmupSub}>Yüz tarama sistemi başlatılıyor...</Text>
            </View>
          </LinearGradient>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient:  { flex: 1 },

  cameraWarmupLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
  },
  cameraWarmupGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraWarmupContent: {
    alignItems: 'center',
  },
  cameraWarmupIconBg: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraWarmupTitle: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.3,
  },
  cameraWarmupSub: {
    marginTop: 6,
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, gap: 12,
  },
  headerBadge: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1 },
  headerTitle:  { fontSize: 18, fontWeight: '700', color: '#fff' },
  headerSub:    { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  retryBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5,
  },
  retryBadgeWarn:     { backgroundColor: '#FEF3C7' },
  retryBadgeText:     { fontSize: 13, fontWeight: '700', color: '#fff' },
  retryBadgeTextWarn: { color: '#92400E' },

  // Camera
  cameraWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, paddingHorizontal: 20 },
  cameraFrame: {
    borderRadius: 20, overflow: 'hidden', position: 'relative',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 10,
  },
  cameraFrameWarn: {
    shadowColor: '#F59E0B',
    shadowOpacity: 0.6,
    elevation: 12,
  },

  // Corners
  corner: { position: 'absolute', width: 36, height: 36, borderColor: '#fff' },
  cTL: { top: 12, left: 12,  borderTopWidth: 3, borderLeftWidth: 3,   borderTopLeftRadius: 10 },
  cTR: { top: 12, right: 12, borderTopWidth: 3, borderRightWidth: 3,  borderTopRightRadius: 10 },
  cBL: { bottom: 12, left: 12,  borderBottomWidth: 3, borderLeftWidth: 3,  borderBottomLeftRadius: 10 },
  cBR: { bottom: 12, right: 12, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 10 },

  scanningOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  scanningText: { fontSize: 16, fontWeight: '600', color: '#fff' },

  statusWrap: { alignItems: 'center' },
  statusText: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 6 },
  statusSub:  { fontSize: 13, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },

  // Buttons
  btnArea: { paddingHorizontal: 20, paddingBottom: 8, gap: 12 },
  scanBtn: { borderRadius: 16, overflow: 'hidden', ...Shadows.md },
  scanBtnDisabled: { opacity: 0.6 },
  scanBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 17,
  },
  scanBtnText: { fontSize: 16, fontWeight: '700', color: '#7C3AED' },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10,
  },
  logoutBtnText: { fontSize: 13, color: 'rgba(255,255,255,0.55)', fontWeight: '500' },

  // Tips
  tips: {
    marginHorizontal: 20, marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 14,
  },
  tipsTitle: {
    fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.9)',
    marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase',
  },
  tipsText: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: 4, lineHeight: 18 },

  // Permission screens
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  permIcon:  {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  permTitle:    { fontSize: 20, fontWeight: '700', color: '#fff', textAlign: 'center' },
  permSub:      { fontSize: 14, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 20 },
  permBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 28,
  },
  permBtnText: { fontSize: 15, fontWeight: '600', color: '#7C3AED' },
  logoutLink:     { paddingVertical: 12 },
  logoutLinkText: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
});
