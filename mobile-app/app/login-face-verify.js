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
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const { logout, setFaceVerified, user } = useUser();

  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning]     = useState(false);
  const [retryCount, setRetryCount]     = useState(0);
  const [statusKey, setStatusKey]       = useState('readyToScan');
  /** False until expo CameraView reports ready — avoids empty/black preview gap after login. */
  const [isCameraReady, setIsCameraReady] = useState(false);
  const cameraRef = useRef(null);
  const navTimerRef = useRef(null);

  useEffect(() => {
    return () => { if (navTimerRef.current) clearTimeout(navTimerRef.current); };
  }, []);

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

  const classifyFaceError = (msg = '') => {
    const text = String(msg || '').toLowerCase();
    if (text.includes('kayıt bulunamadı') || text.includes('yüz kaydı') || text.includes('face') && text.includes('not found') || text.includes('404')) {
      return 'no_reference';
    }
    if (text.includes('yüz bulunamadı') || text.includes('görüntüde yüz') || text.includes('no face') || text.includes('detect')) {
      return 'no_face';
    }
    if (text.includes('liveness') || text.includes('statik görüntü') || text.includes('static image')) {
      return 'liveness';
    }
    if (text.includes('benzerlik') || text.includes('similarity') || text.includes('doğrulaması başarısız') || text.includes('threshold')) {
      return 'similarity';
    }
    return 'unknown';
  };

  const showLocalizedFaceError = (rawMessage = '') => {
    const type = classifyFaceError(rawMessage);
    const titleByType = {
      no_reference: t('flows.face.errors.noReferenceTitle'),
      no_face: t('flows.face.errors.noFaceTitle'),
      liveness: t('flows.face.errors.livenessTitle'),
      similarity: t('flows.face.errors.mismatchTitle'),
      unknown: t('flows.face.errors.unknownTitle'),
    };
    const bodyByType = {
      no_reference: t('flows.face.errors.noReferenceBody'),
      no_face: t('flows.face.errors.noFaceBody'),
      liveness: t('flows.face.errors.livenessBody'),
      similarity: t('flows.face.errors.mismatchBody'),
      unknown: t('flows.face.errors.unknownBody'),
    };
    Alert.alert(titleByType[type] || t('common.error'), bodyByType[type] || t('flows.face.scanFailed'));
  };

  const handleScan = async () => {
    if (!isCameraReady || !cameraRef.current || isScanning) return;
    setIsScanning(true);
    setStatusKey('scanning');

    try {
      // First frame
      const photo1 = await cameraRef.current.takePictureAsync({ base64: false, quality: 1 });
      if (!photo1?.uri) throw new Error(t('flows.face.photoFailed'));

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
        setStatusKey('verified');
        // Mark face as verified — AuthGuard will now allow access
        setFaceVerified(true);
        const dest = (user?.role === 'instructor' || user?.role === 'admin')
          ? '/(tabs)/dashboard'
          : '/(tabs)/home';
        navTimerRef.current = setTimeout(() => router.replace(dest), 600);
      } else {
        const remaining = MAX_RETRIES - (retryCount + 1);
        setRetryCount(prev => prev + 1);

        if (remaining <= 0) {
          // Exhausted retries — force logout
          Alert.alert(
            t('flows.face.errors.loginBlockedTitle'),
            t('flows.face.errors.loginBlockedBody'),
            [{ text: t('common.ok'), onPress: handleForceLogout }],
            { cancelable: false },
          );
        } else {
          setStatusKey('readyToScan');
          Alert.alert(
            t('flows.face.errors.notRecognizedTitle'),
            t('flows.face.errors.notRecognizedBody', { remaining }),
            [{ text: t('common.retry') }],
          );
        }
      }
    } catch (err) {
      setStatusKey('readyToScan');
      showLocalizedFaceError(err?.message || '');
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
            <Text style={styles.permTitle}>{t('flows.face.cameraPermissionRequesting')}</Text>
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
            <Text style={styles.permTitle}>{t('flows.face.cameraRequired')}</Text>
            <Text style={styles.permSub}>
              {t('flows.face.loginCameraRequiredBody')}
            </Text>
            {permission.canAskAgain ? (
              <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
                <Ionicons name="camera" size={18} color="#7C3AED" />
                <Text style={styles.permBtnText}>{t('flows.qr.grantPermission')}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.permBtn} onPress={() => Linking.openSettings()}>
                <Ionicons name="settings-outline" size={18} color="#7C3AED" />
                <Text style={styles.permBtnText}>{t('flows.qr.openSettings')}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.logoutLink} onPress={handleForceLogout}>
              <Text style={styles.logoutLinkText}>{t('common.logout')}</Text>
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
            <Text style={styles.headerTitle}>{t('flows.face.verifyTitle')}</Text>
            <Text style={styles.headerSub}>{t('flows.face.verifySubtitle')}</Text>
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
                <Text style={styles.scanningText}>{t('flows.face.verifying')}</Text>
              </View>
            )}
          </Animated.View>

          <View style={styles.statusWrap}>
            <Text style={styles.statusText}>{t(`flows.face.${statusKey}`)}</Text>
            <Text style={styles.statusSub}>
              {isScanning
                ? t('flows.face.holdStill')
                : t('flows.face.alignFace')}
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
                  <Text style={styles.scanBtnText}>{t('flows.face.faceScanStart')}</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutBtn} onPress={handleForceLogout} activeOpacity={0.7}>
            <Ionicons name="close-outline" size={16} color="rgba(255,255,255,0.55)" />
            <Text style={styles.logoutBtnText}>{t('flows.face.switchAccount')}</Text>
          </TouchableOpacity>
        </View>

        {/* Tips */}
        <View style={styles.tips}>
          <Text style={styles.tipsTitle}>{t('flows.face.tipsTitle')}</Text>
          <Text style={styles.tipsText}>{t('flows.face.tipsGoodLight')}</Text>
          <Text style={styles.tipsText}>{t('flows.face.tipsNoGlasses')}</Text>
          <Text style={styles.tipsText}>{t('flows.face.tipsLookAtCamera')}</Text>
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
              <Text style={styles.cameraWarmupTitle}>{t('auth.identityVerified')}</Text>
              <Text style={styles.cameraWarmupSub}>{t('flows.face.cameraWarmup')}</Text>
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
