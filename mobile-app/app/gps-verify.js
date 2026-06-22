import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  requestLocationPermission,
  hasLocationPermission,
  getCurrentLocation,
} from '@/services/locationService';
import { attendance } from '@/services/api';
import { useUser } from '@/context/UserContext';
import { useFlagReasonLabel } from '@/i18n';

/**
 * GPS Dogrulama Ekrani — 3'lu guvenlik zincirinin 3. ve son adimi.
 *
 * Params:
 *   session_id: aktif yoklama oturumu ID'si
 *
 * Basarili olunca yoklama tamamlanir ve kullanici ana ekrana yonlendirilir.
 */
export default function GPSVerifyScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const getFlagReasonLabel = useFlagReasonLabel();
  const { user } = useUser();
  const params = useLocalSearchParams();
  const session_id = Array.isArray(params.session_id) ? params.session_id[0] : params.session_id;

  const [step, setStep] = useState('idle'); // idle | requesting | checking | success | denied | outside | error
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [distanceFromClass, setDistanceFromClass] = useState(null);
  const [retryProgress, setRetryProgress] = useState(null);
  const [pulseAnim] = useState(new Animated.Value(1));
  const isSuspiciousLocationResult = useCallback((flagReason) => {
    if (!flagReason) return false;
    const reasons = String(flagReason)
      .split(/\s*\+\s*/)
      .map((reason) => reason.trim())
      .filter(Boolean);
    return reasons.some((reason) => (
      reason === 'location_failed'
      || reason === 'fake_gps_detected'
      || reason === 'suspicious_accuracy'
      || reason === 'low_accuracy'
    ));
  }, []);

  // Pulsing animation for the location icon while checking
  useEffect(() => {
    if (step === 'checking' || step === 'requesting') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 600, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
    pulseAnim.setValue(1);
  }, [step]);

  const startVerification = useCallback(async () => {
    try {
      // Step 1 — Check/request permission
      setStep('requesting');
      const alreadyGranted = await hasLocationPermission();
      if (!alreadyGranted) {
        const { granted, canAskAgain } = await requestLocationPermission();
        if (!granted) {
          setStep(canAskAgain ? 'error' : 'denied');
          setErrorMessage(t('flows.gps.permissionDenied'));
          return;
        }
      }

      // Step 2 — Get location & call backend
      setStep('checking');
      const { latitude, longitude, accuracy, is_mocked } = await getCurrentLocation();
      setGpsAccuracy(accuracy);
      const verification = await attendance.verifyLocation(
        parseInt(session_id, 10),
        latitude,
        longitude,
        accuracy,
        is_mocked
      );
      // Backend 400 fırlatırsa catch'e gider (konum dışı veya hata).
      // Exception yoksa = başarılı = sınıf içinde veya GPS kontrolü atlandı.
      setResult({
        success: true,
        latitude,
        longitude,
        gps_accuracy: accuracy,
        is_mocked,
        is_flagged: verification?.is_flagged || false,
        flag_reason: verification?.flag_reason || null,
      });
      setRetryProgress(null);
      setStep('success');
    } catch (err) {
      const msg = err.message || '';
      if (
        msg.includes('Konum doğrulaması') ||
        msg.includes('Location verification') ||
        msg.includes('outside') ||
        msg.includes('Mesafe:') ||
        msg.includes('Mevcut mesafe:') ||
        msg.includes('Current distance:')
      ) {
        // "Mesafe: 87m", "Mevcut mesafe: 87m" veya "Current distance: 87m"
        const match = msg.match(/(?:Mesafe|Mevcut mesafe|Current distance):\s*([\d.]+)m/i);
        if (match) setDistanceFromClass(Math.round(parseFloat(match[1])));
        const retryMatch = msg.match(/\((\d+)\s*\/\s*(\d+)\)/);
        if (retryMatch) {
          setRetryProgress({ current: Number(retryMatch[1]), total: Number(retryMatch[2]) });
        } else {
          setRetryProgress(null);
        }
        setStep('outside');
        setErrorMessage(t('flows.gps.outsideWarning'));
      } else {
        setStep('error');
        setErrorMessage(t('flows.gps.locationFailedRetry'));
      }
    }
  }, [session_id, t]);

  // Auto-start verification on mount (veya session_id değişirse yeniden başlat)
  useEffect(() => {
    startVerification();
  }, [startVerification]);

  const handleContinue = useCallback(() => {
    const role = user?.role;
    router.replace(role === 'instructor' || role === 'admin' ? '/(tabs)/dashboard' : '/(tabs)/home');
  }, [router, user]);

  // Auto-redirect to home 2.5s after success
  useEffect(() => {
    if (step !== 'success') return;
    const timer = setTimeout(() => handleContinue(), 2500);
    return () => clearTimeout(timer);
  }, [step, handleContinue]);

  const handleRetry = () => {
    setResult(null);
    setErrorMessage('');
    startVerification();
  };

  const handleOpenSettings = () => {
    Linking.openSettings();
  };

  const handleBack = () => {
    router.back();
  };

  // ─── Render helpers ───────────────────────────────────────────────────────

  const renderIdle = () => null;

  const _gpsSignal = (acc) => {
    if (acc === null) return null;
    if (acc < 10) return { label: t('flows.gps.signalExcellent'), color: '#4ADE80' };
    if (acc < 30) return { label: t('flows.gps.signalGood'),      color: '#FCD34D' };
    if (acc < 60) return { label: t('flows.gps.signalMedium'),     color: '#FB923C' };
    return              { label: t('flows.gps.signalWeak'),     color: '#F87171' };
  };

  const renderChecking = () => {
    const signal = _gpsSignal(gpsAccuracy);
    return (
      <View style={styles.centerContent}>
        <Animated.View style={[styles.iconCircle, styles.iconCircleBlue, { transform: [{ scale: pulseAnim }] }]}>
          <Ionicons name="location" size={56} color="#fff" />
        </Animated.View>
        <Text style={styles.statusTitle}>
          {step === 'requesting' ? t('flows.gps.requestingPermission') : t('flows.gps.verifyingLocation')}
        </Text>
        <Text style={styles.statusSubtitle}>
          {step === 'requesting'
            ? t('flows.gps.approveLocation')
            : t('flows.gps.comparing')}
        </Text>
        {signal && (
          <View style={styles.signalBadge}>
            <View style={[styles.signalDot, { backgroundColor: signal.color }]} />
            <Text style={[styles.signalText, { color: signal.color }]}>
              {t('flows.gps.signalLabel', { quality: signal.label, meters: Math.round(gpsAccuracy) })}
            </Text>
          </View>
        )}
        <ActivityIndicator size="large" color="#fff" style={styles.spinner} />
      </View>
    );
  };

  const renderSuccess = () => {
    const isSuspiciousLocation = isSuspiciousLocationResult(result?.flag_reason);
    return (
      <View style={styles.centerContent}>
        <View style={[styles.iconCircle, styles.iconCircleGreen]}>
          <Ionicons name="checkmark-circle" size={64} color="#fff" />
        </View>
        <Text style={styles.statusTitle}>
          {isSuspiciousLocation
            ? t('flows.gps.suspiciousLocationTitle')
            : t('flows.gps.locationVerifiedTitle')}
        </Text>
        <Text style={styles.statusSubtitle}>
          {isSuspiciousLocation
            ? t('flows.gps.suspiciousLocationBody')
            : t('flows.gps.locationVerifiedBody')}
        </Text>

        {result && (
          <View style={styles.infoCard}>
            {result.gps_accuracy ? (
              <View style={styles.infoRow}>
                <Ionicons name="pulse-outline" size={18} color="#059669" />
                <Text style={styles.infoLabel}>{t('flows.gps.gpsAccuracy')}</Text>
                <Text style={styles.infoValue}>±{Math.round(result.gps_accuracy)} m</Text>
              </View>
            ) : null}
            {result.is_flagged && (
              <View style={styles.infoRow}>
                <Ionicons name="flag-outline" size={18} color="#F59E0B" />
                <Text style={[styles.infoLabel, { color: '#F59E0B' }]}>{t('flows.gps.note')}</Text>
                <Text style={[styles.infoValue, { color: '#F59E0B' }]}>
                  {getFlagReasonLabel(result.flag_reason)}
                </Text>
              </View>
            )}
          </View>
        )}

        <TouchableOpacity style={styles.primaryButton} onPress={handleContinue} activeOpacity={0.85}>
          <Ionicons name="checkmark-done-circle" size={22} color="#fff" />
          <Text style={styles.primaryButtonText}>{t('flows.gps.completeReturnHome')}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderOutside = () => (
    <View style={styles.centerContent}>
      <View style={[styles.iconCircle, styles.iconCircleRed]}>
        <Ionicons name="location-outline" size={56} color="#fff" />
      </View>
      <Text style={styles.statusTitle}>{t('flows.gps.outsideClass')}</Text>
      <Text style={styles.statusSubtitle}>
        {t('flows.gps.outsideSub')}
      </Text>

      {distanceFromClass !== null && (
        <View style={styles.distanceBadge}>
          <Ionicons name="navigate-outline" size={20} color="#DC2626" />
          <Text style={styles.distanceText}>
            {t('flows.gps.distance', { meters: distanceFromClass })}
          </Text>
        </View>
      )}

      {errorMessage ? (
        <View style={[styles.infoCard, styles.infoCardRed]}>
          <View style={styles.infoRow}>
            <Ionicons name="alert-circle-outline" size={18} color="#DC2626" />
            <Text style={[styles.infoValue, styles.infoValueRed]}>{errorMessage}</Text>
          </View>
        </View>
      ) : null}
      {retryProgress && (
        <View style={styles.signalBadge}>
          <Ionicons name="refresh" size={16} color="#FCD34D" />
          <Text style={[styles.signalText, { color: '#FCD34D' }]}>
            {t('flows.gps.retryProgress', { current: retryProgress.current, total: retryProgress.total })}
          </Text>
        </View>
      )}

      <View style={styles.warningBox}>
        <Ionicons name="warning-outline" size={18} color="#92400E" />
        <Text style={styles.warningText}>
          {t('flows.gps.outsideWarning')}
        </Text>
      </View>

      <TouchableOpacity style={styles.retryButton} onPress={handleRetry} activeOpacity={0.85}>
        <Ionicons name="refresh" size={20} color="#2563EB" />
        <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderDenied = () => (
    <View style={styles.centerContent}>
      <View style={[styles.iconCircle, styles.iconCircleOrange]}>
        <Ionicons name="ban-outline" size={56} color="#fff" />
      </View>
      <Text style={styles.statusTitle}>{t('flows.gps.permissionRequired')}</Text>
      <Text style={styles.statusSubtitle}>
        {t('flows.gps.permissionRequiredSub')}
      </Text>
      <TouchableOpacity style={styles.primaryButton} onPress={handleOpenSettings} activeOpacity={0.85}>
        <Ionicons name="settings-outline" size={20} color="#fff" />
        <Text style={styles.primaryButtonText}>{t('flows.gps.openSettings')}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderError = () => (
    <View style={styles.centerContent}>
      <View style={[styles.iconCircle, styles.iconCircleOrange]}>
        <Ionicons name="alert-circle-outline" size={56} color="#fff" />
      </View>
      <Text style={styles.statusTitle}>{t('flows.gps.locationFailed')}</Text>
      <Text style={styles.statusSubtitle}>{errorMessage}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={handleRetry} activeOpacity={0.85}>
        <Ionicons name="refresh" size={20} color="#2563EB" />
        <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderContent = () => {
    switch (step) {
      case 'requesting':
      case 'checking': return renderChecking();
      case 'success':  return renderSuccess();
      case 'outside':  return renderOutside();
      case 'denied':   return renderDenied();
      case 'error':    return renderError();
      default:         return renderIdle();
    }
  };

  const gradientColors = {
    idle:       ['#2563EB', '#06B6D4'],
    requesting: ['#2563EB', '#06B6D4'],
    checking:   ['#2563EB', '#06B6D4'],
    success:    ['#059669', '#10B981'],
    outside:    ['#DC2626', '#EF4444'],
    denied:     ['#D97706', '#F59E0B'],
    error:      ['#D97706', '#F59E0B'],
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={gradientColors[step] || gradientColors.idle}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{t('flows.gps.title')}</Text>
            <Text style={styles.headerSubtitle}>{t('flows.gps.subtitle')}</Text>
          </View>
          {/* Step indicator */}
          <View style={styles.stepIndicator}>
            <View style={styles.stepDot} />
            <View style={styles.stepDot} />
            <View style={[styles.stepDot, styles.stepDotActive]} />
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {renderContent()}
        </View>

        {/* Security chain footer */}
        <View style={styles.footer}>
          <View style={styles.chainStep}>
            <Ionicons name="qr-code-outline" size={16} color="rgba(255,255,255,0.5)" />
            <Text style={styles.chainLabel}>{t('flows.qr.chainLabel')}</Text>
          </View>
          <View style={styles.chainArrow} />
          <View style={styles.chainStep}>
            <Ionicons name="scan-outline" size={16} color="rgba(255,255,255,0.5)" />
            <Text style={styles.chainLabel}>{t('flows.face.chainLabel')}</Text>
          </View>
          <View style={styles.chainArrow} />
          <View style={styles.chainStep}>
            <Ionicons name="location" size={16} color="#fff" />
            <Text style={[styles.chainLabel, styles.chainLabelActive]}>{t('flows.gps.chainLabel')}</Text>
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  stepIndicator: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  stepDotActive: {
    backgroundColor: '#fff',
    width: 20,
    borderRadius: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  centerContent: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  iconCircleBlue:   { backgroundColor: 'rgba(255,255,255,0.25)' },
  iconCircleGreen:  { backgroundColor: 'rgba(255,255,255,0.25)' },
  iconCircleRed:    { backgroundColor: 'rgba(255,255,255,0.25)' },
  iconCircleOrange: { backgroundColor: 'rgba(255,255,255,0.25)' },
  statusTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  statusSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  spinner: {
    marginTop: 20,
  },
  signalBadge:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  signalDot:     { width: 8, height: 8, borderRadius: 4 },
  signalText:    { fontSize: 13, fontWeight: '600' },
  distanceBadge: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12, marginBottom: 16 },
  distanceText:  { fontSize: 15, color: '#fff', fontWeight: '500' },
  distanceValue: { fontWeight: '800', fontSize: 18 },
  infoCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    marginBottom: 28,
  },
  infoCardRed: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    flex: 1,
  },
  infoLabelRed: {
    color: 'rgba(255,255,255,0.75)',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  infoValueRed: {
    color: '#FEE2E2',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    width: '100%',
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2563EB',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 32,
    gap: 4,
  },
  chainStep: {
    alignItems: 'center',
    gap: 4,
  },
  chainLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
  },
  chainLabelActive: {
    color: '#fff',
  },
  chainArrow: {
    width: 24,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 6,
    marginBottom: 14,
  },
});
