import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImageManipulator from 'expo-image-manipulator';
import { attendance } from '@/services/api';

const { width } = Dimensions.get('window');

export default function FaceScanScreen() {
  const router = useRouter();
  const { session_id } = useLocalSearchParams();

  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);
  const cameraRef = useRef(null);

  const handleStartScan = async () => {
    if (!cameraRef.current || isScanning) return;
    setIsScanning(true);

    try {
      // Take first frame (full quality, will be resized below)
      const photo1 = await cameraRef.current.takePictureAsync({ base64: false, quality: 1 });

      if (!photo1?.uri) {
        Alert.alert('Hata', 'Fotoğraf çekilemedi. Lütfen tekrar deneyin.');
        return;
      }

      // Resize to 640px — sufficient for face recognition, reduces payload ~10x
      const resized1 = await ImageManipulator.manipulateAsync(
        photo1.uri,
        [{ resize: { width: 640 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      // Wait briefly and take second frame for liveness detection
      await new Promise(resolve => setTimeout(resolve, 500));

      let photo2Base64 = null;
      try {
        const photo2 = await cameraRef.current.takePictureAsync({ base64: false, quality: 1 });
        const resized2 = await ImageManipulator.manipulateAsync(
          photo2.uri,
          [{ resize: { width: 640 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        photo2Base64 = resized2.base64;
      } catch {
        // Second frame optional — liveness will be skipped on backend
      }

      const result = await attendance.verifyFace(
        parseInt(session_id),
        resized1.base64,
        photo2Base64,
      );

      // Only 'verified' state is success — 'pending' or 'failed' are not
      if (result?.face_status === 'verified') {
        router.replace({
          pathname: '/gps-verify',
          params: { session_id },
        });
      } else {
        Alert.alert(
          'Yüz Tanıma Başarısız',
          'Yüzünüz tanınamadı. Lütfen iyi aydınlatılmış bir ortamda, gözlük ve maske olmadan tekrar deneyin.',
          [{ text: 'Tamam' }]
        );
      }
    } catch (err) {
      Alert.alert('Hata', err?.message || 'Yüz tanıma sırasında bir hata oluştu.');
    } finally {
      setIsScanning(false);
    }
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={['#7C3AED', '#A855F7']} style={styles.gradient}>
          <View style={styles.permissionContainer}>
            <Ionicons name="camera-outline" size={64} color="#fff" />
            <Text style={styles.permissionTitle}>İzin İsteniyor...</Text>
            <Text style={styles.permissionText}>Lütfen bekleyin</Text>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={['#7C3AED', '#A855F7']} style={styles.gradient}>
          <View style={styles.permissionContainer}>
            <Ionicons name="close-circle-outline" size={64} color="rgba(255,255,255,0.9)" />
            <Text style={styles.permissionTitle}>Kamera İzni Gerekli</Text>
            <Text style={styles.permissionText}>
              Yüz tanıma için kamera iznine ihtiyaç var. Lütfen ayarlardan kamera iznini etkinleştirin.
            </Text>
            {permission.canAskAgain ? (
              <TouchableOpacity style={styles.settingsButton} onPress={requestPermission}>
                <Ionicons name="camera" size={20} color="#7C3AED" />
                <Text style={styles.settingsButtonText}>İzin Ver</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.settingsButton} onPress={() => Linking.openSettings()}>
                <Ionicons name="settings-outline" size={20} color="#7C3AED" />
                <Text style={styles.settingsButtonText}>Ayarları Aç</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.backButtonAlt} onPress={() => router.back()}>
              <Text style={styles.backButtonAltText}>Geri Dön</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

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
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Yüz Tanıma</Text>
            <Text style={styles.headerSubtitle}>Adım 2 / 3 — Yüz Doğrulama</Text>
          </View>
          <View style={styles.stepIndicator}>
            <View style={styles.stepDot} />
            <View style={[styles.stepDot, styles.stepDotActive]} />
            <View style={styles.stepDot} />
          </View>
        </View>

        {/* Live Camera View */}
        <View style={styles.cameraContainer}>
          <View style={[styles.cameraFrame, { width: width * 0.78, height: width * 0.78 }]}>
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="front"
            />
            <View style={styles.overlay}>
              {/* Corner decorations */}
              <View style={[styles.corner, styles.cornerTopLeft]} />
              <View style={[styles.corner, styles.cornerTopRight]} />
              <View style={[styles.corner, styles.cornerBottomLeft]} />
              <View style={[styles.corner, styles.cornerBottomRight]} />

              {/* Scanning overlay */}
              {isScanning && (
                <View style={styles.scanningOverlay}>
                  <ActivityIndicator size="large" color="#fff" />
                  <Text style={styles.scanningText}>Yüz taranıyor...</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>
              {isScanning ? 'Taranıyor...' : 'Taramaya Hazır'}
            </Text>
            <Text style={styles.statusSubtext}>
              {isScanning
                ? 'Lütfen hareketsiz bekleyin'
                : 'Yüzünüzü çerçeve içine alın, ardından butona basın'}
            </Text>
          </View>
        </View>

        {/* Scan Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.scanButton, isScanning && styles.scanButtonDisabled]}
            onPress={handleStartScan}
            disabled={isScanning}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={isScanning ? ['#6B7280', '#4B5563'] : ['#7C3AED', '#A855F7']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.scanButtonGradient}
            >
              {isScanning ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.scanButtonText}>Yüz Taramasını Başlat</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Instructions */}
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsTitle}>Talimatlar</Text>
          <View style={styles.instructionItem}>
            <View style={styles.instructionNumber}>
              <Text style={styles.instructionNumberText}>1</Text>
            </View>
            <Text style={styles.instructionText}>Yüzünüzü çerçeve içine ortalayın</Text>
          </View>
          <View style={styles.instructionItem}>
            <View style={styles.instructionNumber}>
              <Text style={styles.instructionNumberText}>2</Text>
            </View>
            <Text style={styles.instructionText}>İyi aydınlatılmış bir ortamda olduğunuzdan emin olun</Text>
          </View>
          <View style={styles.instructionItem}>
            <View style={styles.instructionNumber}>
              <Text style={styles.instructionNumberText}>3</Text>
            </View>
            <Text style={styles.instructionText}>Tarama sırasında hareketsiz durun</Text>
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#A855F7',
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
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
  },
  stepIndicator: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)' },
  stepDotActive: { backgroundColor: '#fff', width: 20, borderRadius: 4 },
  cameraContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingHorizontal: 20,
  },
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#fff',
  },
  cornerTopLeft: { top: 16, left: 16, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 8 },
  cornerTopRight: { top: 16, right: 16, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 8 },
  cornerBottomLeft: { bottom: 16, left: 16, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 8 },
  cornerBottomRight: { bottom: 16, right: 16, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 8 },
  scanningOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  scanningText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  statusContainer: {
    alignItems: 'center',
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 6,
  },
  statusSubtext: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  scanButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  scanButtonDisabled: { opacity: 0.6 },
  scanButtonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  scanButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  instructionsContainer: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 16,
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  instructionNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  instructionNumberText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  instructionText: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255,255,255,0.95)',
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 20,
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
  },
  settingsButtonText: { fontSize: 15, fontWeight: '600', color: '#7C3AED' },
  backButtonAlt: { paddingVertical: 12 },
  backButtonAltText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
});
