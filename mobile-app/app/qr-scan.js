import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  Linking,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { attendance } from '@/services/api';
import { Colors } from '@/config/theme';

const { width } = Dimensions.get('window');

export default function QRScanScreen() {
  const router = useRouter();
  const { session_id } = useLocalSearchParams();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState('idle'); // idle | scanning | verifying | success | error
  const [errorMessage, setErrorMessage] = useState('');
  const [scanned, setScanned] = useState(false);
  const [scanLineAnim] = useState(new Animated.Value(0));

  // Scan line animation
  useEffect(() => {
    if (scanState === 'scanning') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
          Animated.timing(scanLineAnim, { toValue: 0, duration: 1800, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [scanState]);

  useEffect(() => {
    if (permission?.granted) {
      setScanState('scanning');
    }
  }, [permission]);

  const handleBarCodeScanned = async ({ data: qrCode }) => {
    if (scanned) return;
    setScanned(true);
    setScanState('verifying');

    try {
      // QR payload: "session_id=X;course_id=Y;token=XXXX"
      // session_id ve token'ı QR içeriğinden çıkar (nav param'a güvenme)
      const parts = {};
      try {
        qrCode.split(';').forEach(p => {
          const [k, v] = p.split('=', 2);
          if (k && v) parts[k.trim()] = v.trim();
        });
      } catch { /* ignore parse errors */ }

      const tokenToSend = parts.token || qrCode;
      const resolvedSessionId = parts.session_id
        ? parseInt(parts.session_id, 10)
        : parseInt(session_id, 10);

      if (!resolvedSessionId || isNaN(resolvedSessionId)) {
        setScanState('error');
        setErrorMessage('QR kod geçersiz veya tanınamadı.');
        return;
      }

      const result = await attendance.scanQR(resolvedSessionId, tokenToSend);

      const isVerified = result?.qr_status === 'verified';

      if (isVerified) {
        setScanState('success');
        setTimeout(() => {
          router.replace({ pathname: '/gps-verify', params: { session_id: resolvedSessionId } });
        }, 800);
      } else {
        setScanState('error');
        setErrorMessage('QR kod doğrulanamadı. Lütfen tekrar deneyin.');
      }
    } catch (err) {
      setScanState('error');
      setErrorMessage(err?.message || 'Sunucuya bağlanılamadı');
    }
  };

  const handleRetry = () => {
    setScanned(false);
    setErrorMessage('');
    setScanState('scanning');
  };

  // ─── Permission states ───────────────────────────────────────────────────

  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerBox}>
          <Ionicons name="camera-outline" size={64} color="#3B82F6" />
          <Text style={styles.permTitle}>İzin İsteniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={['#1E3A8A', '#2563EB']} style={styles.gradient}>
          <View style={styles.centerBox}>
            <Ionicons name="close-circle-outline" size={72} color="#fff" />
            <Text style={styles.permTitle}>Kamera İzni Gerekli</Text>
            <Text style={styles.permSubtitle}>
              QR kod okumak için kamera iznine ihtiyaç var.
            </Text>
            {permission.canAskAgain ? (
              <TouchableOpacity style={styles.actionBtn} onPress={requestPermission}>
                <Ionicons name="camera" size={20} color="#3B82F6" />
                <Text style={styles.actionBtnText}>İzin Ver</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.actionBtn} onPress={Linking.openSettings}>
                <Ionicons name="settings-outline" size={20} color="#3B82F6" />
                <Text style={styles.actionBtnText}>Ayarları Aç</Text>
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

  // ─── Main scan UI ─────────────────────────────────────────────────────────

  const frameSize = width * 0.72;
  const scanLineTranslate = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, frameSize - 4],
  });

  const gradientColors =
    scanState === 'success' ? ['#059669', '#10B981'] :
    scanState === 'error'   ? ['#DC2626', '#EF4444'] :
                              ['#1E3A8A', '#2563EB'];

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>QR Kod Okuyucu</Text>
            <Text style={styles.headerSubtitle}>Adım 1 / 2 — QR Doğrulama</Text>
          </View>
          {/* Step indicator */}
          <View style={styles.stepIndicator}>
            <View style={[styles.stepDot, styles.stepDotActive]} />
            <View style={styles.stepDot} />
          </View>
        </View>

        {/* Camera / Status area */}
        <View style={styles.cameraContainer}>
          {(scanState === 'scanning' || scanState === 'verifying') ? (
            <View style={[styles.cameraFrame, { width: frameSize, height: frameSize }]}>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={scanState === 'scanning' ? handleBarCodeScanned : undefined}
              />

              {/* Corner decorations */}
              <View style={[styles.corner, styles.cornerTopLeft]} />
              <View style={[styles.corner, styles.cornerTopRight]} />
              <View style={[styles.corner, styles.cornerBottomLeft]} />
              <View style={[styles.corner, styles.cornerBottomRight]} />

              {/* Animated scan line */}
              {scanState === 'scanning' && (
                <Animated.View
                  style={[styles.scanLine, { transform: [{ translateY: scanLineTranslate }] }]}
                />
              )}

              {/* Verifying overlay */}
              {scanState === 'verifying' && (
                <View style={styles.verifyingOverlay}>
                  <Ionicons name="sync" size={40} color="#fff" />
                  <Text style={styles.verifyingText}>Doğrulanıyor...</Text>
                </View>
              )}
            </View>
          ) : scanState === 'success' ? (
            <View style={styles.resultCircle}>
              <Ionicons name="checkmark-circle" size={80} color="#fff" />
            </View>
          ) : (
            <View style={styles.resultCircle}>
              <Ionicons name="close-circle" size={80} color="#fff" />
            </View>
          )}

          {/* Status text */}
          <View style={styles.statusBox}>
            <Text style={styles.statusTitle}>
              {scanState === 'idle'       ? 'Hazır'                    :
               scanState === 'scanning'  ? 'QR Kodu Çerçeveye Al'     :
               scanState === 'verifying' ? 'Sunucuda Doğrulanıyor...'  :
               scanState === 'success'   ? 'QR Doğrulandı! ✅'         :
                                           'Doğrulama Başarısız'}
            </Text>
            <Text style={styles.statusSubtitle}>
              {scanState === 'scanning'  ? 'QR kodu otomatik olarak okunacak'      :
               scanState === 'verifying' ? 'Lütfen bekleyin...'                    :
               scanState === 'success'   ? 'GPS doğrulamasına yönlendiriliyorsunuz...' :
               scanState === 'error'     ? errorMessage                            : ''}
            </Text>
          </View>
        </View>

        {/* Action buttons */}
        {scanState === 'error' && (
          <View style={styles.buttonArea}>
            <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
              <Ionicons name="refresh" size={20} color="#3B82F6" />
              <Text style={styles.retryBtnText}>Tekrar Dene</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Security chain footer */}
        <View style={styles.footer}>
          <View style={styles.chainStep}>
            <Ionicons name="qr-code" size={16} color="#fff" />
            <Text style={[styles.chainLabel, styles.chainLabelActive]}>QR Kod</Text>
          </View>
          <View style={styles.chainArrow} />
          <View style={styles.chainStep}>
            <Ionicons name="location-outline" size={16} color="rgba(255,255,255,0.6)" />
            <Text style={styles.chainLabel}>GPS</Text>
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient:  { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    gap: 12,
  },
  backButton: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1 },
  headerTitle:  { fontSize: 18, fontWeight: '700', color: '#fff' },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  stepIndicator: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  stepDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)' },
  stepDotActive: { backgroundColor: '#fff', width: 20, borderRadius: 4 },

  cameraContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 },

  cameraFrame: {
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },

  corner: {
    position: 'absolute', width: 36, height: 36, borderColor: '#fff',
  },
  cornerTopLeft:     { top: 12,  left: 12,  borderTopWidth: 4, borderLeftWidth: 4,   borderTopLeftRadius: 8 },
  cornerTopRight:    { top: 12,  right: 12, borderTopWidth: 4, borderRightWidth: 4,  borderTopRightRadius: 8 },
  cornerBottomLeft:  { bottom: 12, left: 12,  borderBottomWidth: 4, borderLeftWidth: 4,  borderBottomLeftRadius: 8 },
  cornerBottomRight: { bottom: 12, right: 12, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 8 },

  scanLine: {
    position: 'absolute',
    left: 0, right: 0, height: 2,
    backgroundColor: '#93C5FD',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },

  verifyingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  verifyingText: { fontSize: 16, fontWeight: '600', color: '#fff' },

  resultCircle: {
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 6,
  },

  statusBox:     { alignItems: 'center', paddingHorizontal: 32 },
  statusTitle:   { fontSize: 22, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 6 },
  statusSubtitle:{ fontSize: 14, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 20 },

  buttonArea: { paddingHorizontal: 24, paddingBottom: 12 },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 32,
  },
  retryBtnText: { fontSize: 15, fontWeight: '600', color: '#1D4ED8' },

  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 20, paddingHorizontal: 32, gap: 4,
  },
  chainStep:      { alignItems: 'center', gap: 4 },
  chainLabel:     { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  chainLabelActive: { color: '#fff' },
  chainArrow:     { width: 24, height: 1, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 6, marginBottom: 14 },

  centerBox: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 32, gap: 16,
  },
  permTitle:    { fontSize: 20, fontWeight: '700', color: '#fff', textAlign: 'center' },
  permSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 20 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 28,
  },
  actionBtnText: { fontSize: 15, fontWeight: '600', color: '#1D4ED8' },
  backLink:      { paddingVertical: 12 },
  backLinkText:  { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
});
