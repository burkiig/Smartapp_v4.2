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
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { attendance } from '@/services/api';
import { Colors } from '@/config/theme';

const { width } = Dimensions.get('window');

export default function QRScanScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { session_id } = useLocalSearchParams();
  const navTimerRef = useRef(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState('idle'); // idle | scanning | verifying | success | error
  const [errorMessage, setErrorMessage] = useState('');
  const [scanned, setScanned] = useState(false);
  const [scanLineAnim] = useState(new Animated.Value(0));

  // Zoom state: 0.0 (1x) → 1.0 (max)
  const [zoomIndex, setZoomIndex] = useState(0);
  const ZOOM_LEVELS = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
  const ZOOM_LABELS = ['1x', '2x', '3x', '4x', '5x', '6x'];
  const currentZoom = ZOOM_LEVELS[zoomIndex];

  const handleZoomIn = () => setZoomIndex(prev => Math.min(ZOOM_LEVELS.length - 1, prev + 1));
  const handleZoomOut = () => setZoomIndex(prev => Math.max(0, prev - 1));

  useEffect(() => {
    return () => { if (navTimerRef.current) clearTimeout(navTimerRef.current); };
  }, []);

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

    // parts: try dışında tanımla — catch bloğundan da erişilebilsin
    const parts = {};
    try {
      qrCode.split(';').forEach(p => {
        const [k, v] = p.split('=', 2);
        if (k && v) parts[k.trim()] = v.trim();
      });
    } catch { /* ignore parse errors */ }

    try {
      const tokenToSend = parts.token || qrCode;
      const resolvedSessionId = parts.session_id
        ? parseInt(parts.session_id, 10)
        : parseInt(session_id, 10);

      if (!resolvedSessionId || isNaN(resolvedSessionId)) {
        setScanState('error');
        setErrorMessage(t('flows.qr.invalidQr'));
        return;
      }

      const result = await attendance.scanQR(resolvedSessionId, tokenToSend);

      const isVerified = result?.qr_status === 'verified';

      if (isVerified) {
        setScanState('success');
        navTimerRef.current = setTimeout(() => {
          router.replace({ pathname: '/face-scan', params: { session_id: resolvedSessionId } });
        }, 800);
      } else {
        setScanState('error');
        setErrorMessage(t('flows.qr.verifyFailed'));
      }
    } catch (err) {
      const msg = err?.message || '';
      // 409: QR zaten tarandı → yüz doğrulama adımına geç
      if (msg.includes('QR zaten tarandı') || msg.includes('409')) {
        const sid = parts.session_id ? parseInt(parts.session_id, 10) : parseInt(session_id, 10);
        if (sid && !isNaN(sid)) {
          navTimerRef.current = setTimeout(() => {
            router.replace({ pathname: '/face-scan', params: { session_id: sid } });
          }, 400);
          return;
        }
      }
      setScanState('error');
      setErrorMessage(msg || t('common.serverUnreachable'));
    }
  };

  const handleRetry = () => {
    setScanned(false);
    setErrorMessage('');
    setScanState('scanning');
    setZoomIndex(0);
  };

  // ─── Permission states ───────────────────────────────────────────────────

  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerBox}>
          <Ionicons name="camera-outline" size={64} color="#3B82F6" />
          <Text style={styles.permTitle}>{t('flows.face.permissionWait')}</Text>
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
            <Text style={styles.permTitle}>{t('flows.qr.cameraRequired')}</Text>
            <Text style={styles.permSubtitle}>
              {t('flows.qr.cameraRequiredBody')}
            </Text>
            {permission.canAskAgain ? (
              <TouchableOpacity style={styles.actionBtn} onPress={requestPermission}>
                <Ionicons name="camera" size={20} color="#3B82F6" />
                <Text style={styles.actionBtnText}>{t('flows.qr.grantPermission')}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.actionBtn} onPress={Linking.openSettings}>
                <Ionicons name="settings-outline" size={20} color="#3B82F6" />
                <Text style={styles.actionBtnText}>{t('flows.qr.openSettings')}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
              <Text style={styles.backLinkText}>{t('common.back')}</Text>
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
      scanState === 'error' ? ['#DC2626', '#EF4444'] :
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
            <Text style={styles.headerTitle}>{t('flows.qr.title')}</Text>
            <Text style={styles.headerSubtitle}>{t('flows.qr.subtitle')}</Text>
          </View>
          {/* Step indicator */}
          <View style={styles.stepIndicator}>
            <View style={[styles.stepDot, styles.stepDotActive]} />
            <View style={styles.stepDot} />
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
                zoom={currentZoom}
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
                  <Text style={styles.verifyingText}>{t('flows.face.verifying')}</Text>
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

          {/* Zoom controls — only visible while scanning */}
          {(scanState === 'scanning' || scanState === 'verifying') && (
            <View style={styles.zoomControls}>
              <TouchableOpacity
                style={[styles.zoomBtn, zoomIndex === 0 && styles.zoomBtnDisabled]}
                onPress={handleZoomOut}
                disabled={zoomIndex === 0}
                activeOpacity={0.7}
              >
                <Ionicons name="remove" size={22} color={zoomIndex === 0 ? 'rgba(255,255,255,0.25)' : '#fff'} />
              </TouchableOpacity>

              <View style={styles.zoomLevelTrack}>
                {ZOOM_LEVELS.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.zoomTick,
                      i <= zoomIndex && styles.zoomTickActive,
                    ]}
                  />
                ))}
                <Text style={styles.zoomLevelText}>{ZOOM_LABELS[zoomIndex]}</Text>
              </View>

              <TouchableOpacity
                style={[styles.zoomBtn, zoomIndex === ZOOM_LEVELS.length - 1 && styles.zoomBtnDisabled]}
                onPress={handleZoomIn}
                disabled={zoomIndex === ZOOM_LEVELS.length - 1}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={22} color={zoomIndex === ZOOM_LEVELS.length - 1 ? 'rgba(255,255,255,0.25)' : '#fff'} />
              </TouchableOpacity>
            </View>
          )}

          {/* Status text */}
          <View style={styles.statusBox}>
            <Text style={styles.statusTitle}>
              {scanState === 'idle' ? t('flows.qr.ready') :
                scanState === 'scanning' ? t('flows.qr.alignQr') :
                  scanState === 'verifying' ? t('flows.qr.verifying') :
                    scanState === 'success' ? t('flows.qr.verified') :
                      t('flows.qr.failed')}
            </Text>
            <Text style={styles.statusSubtitle}>
              {scanState === 'scanning' ? t('flows.qr.autoScan') :
                scanState === 'verifying' ? t('flows.face.pleaseWait') :
                  scanState === 'success' ? t('flows.qr.redirectingToFace') :
                    scanState === 'error' ? errorMessage : ''}
            </Text>
          </View>
        </View>

        {/* Action buttons */}
        {scanState === 'error' && (
          <View style={styles.buttonArea}>
            <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
              <Ionicons name="refresh" size={20} color="#3B82F6" />
              <Text style={styles.retryBtnText}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Security chain footer */}
        <View style={styles.footer}>
          <View style={styles.chainStep}>
            <Ionicons name="qr-code" size={16} color="#fff" />
            <Text style={[styles.chainLabel, styles.chainLabelActive]}>{t('flows.qr.chainLabel')}</Text>
          </View>
          <View style={styles.chainArrow} />
          <View style={styles.chainStep}>
            <Ionicons name="scan-outline" size={16} color="rgba(255,255,255,0.6)" />
            <Text style={styles.chainLabel}>{t('flows.face.chainLabel')}</Text>
          </View>
          <View style={styles.chainArrow} />
          <View style={styles.chainStep}>
            <Ionicons name="location-outline" size={16} color="rgba(255,255,255,0.6)" />
            <Text style={styles.chainLabel}>{t('flows.gps.chainLabel')}</Text>
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },

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
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  stepIndicator: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)' },
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
  cornerTopLeft: { top: 12, left: 12, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 8 },
  cornerTopRight: { top: 12, right: 12, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 8 },
  cornerBottomLeft: { bottom: 12, left: 12, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 8 },
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

  statusBox: { alignItems: 'center', paddingHorizontal: 32 },
  statusTitle: { fontSize: 22, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 6 },
  statusSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 20 },

  // ── Zoom controls ────────────────────────────────────────────────────────
  zoomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 50,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  zoomBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  zoomLevelTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minWidth: 90,
    justifyContent: 'center',
  },
  zoomTick: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  zoomTickActive: {
    backgroundColor: '#93C5FD',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  zoomLevelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    marginLeft: 6,
    minWidth: 28,
    textAlign: 'center',
  },
  // ─────────────────────────────────────────────────────────────────────────

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
  chainStep: { alignItems: 'center', gap: 4 },
  chainLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  chainLabelActive: { color: '#fff' },
  chainArrow: { width: 24, height: 1, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 6, marginBottom: 14 },

  centerBox: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 32, gap: 16,
  },
  permTitle: { fontSize: 20, fontWeight: '700', color: '#fff', textAlign: 'center' },
  permSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 20 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 28,
  },
  actionBtnText: { fontSize: 15, fontWeight: '600', color: '#1D4ED8' },
  backLink: { paddingVertical: 12 },
  backLinkText: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
});
