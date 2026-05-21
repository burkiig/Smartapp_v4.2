/**
 * excuse-submit.js
 *
 * Öğrencinin mazeret dilekçesi gönderdiği ekran.
 * Route params:
 *   course_id    : string | number  (zorunlu)
 *   session_date : string           ('YYYY-MM-DD', opsiyonel — bugün default)
 *   course_name  : string           (görüntülemek için, opsiyonel)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { excuses } from '@/services/api';
import { Colors, Shadows } from '@/config/theme';

const EXCUSE_TYPES = [
  { key: 'medical',         label: 'Sağlık',          icon: '🏥', desc: 'Hastalık veya doktor raporu' },
  { key: 'family',          label: 'Aile',             icon: '👨‍👩‍👧', desc: 'Aile acil durumu' },
  { key: 'school_activity', label: 'Okul Etkinliği',   icon: '🎓', desc: 'Resmi okul etkinliği' },
  { key: 'transportation',  label: 'Ulaşım',           icon: '🚌', desc: 'Ulaşım sorunu' },
  { key: 'other',           label: 'Diğer',            icon: '📋', desc: 'Diğer nedenler' },
];

export default function ExcuseSubmitScreen() {
  const router = useRouter();
  const rawParams = useLocalSearchParams();
  const course_id = Array.isArray(rawParams.course_id) ? rawParams.course_id[0] : rawParams.course_id;
  const session_id = Array.isArray(rawParams.session_id) ? rawParams.session_id[0] : rawParams.session_id;
  const session_date = Array.isArray(rawParams.session_date) ? rawParams.session_date[0] : rawParams.session_date;
  const course_name = Array.isArray(rawParams.course_name) ? rawParams.course_name[0] : rawParams.course_name;

  const today = new Date().toISOString().slice(0, 10);

  const [selectedType, setSelectedType] = useState(null);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(session_date || today);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachment, setAttachment] = useState(null); // { uri, name, mimeType }

  const isValid = selectedType && description.trim().length >= 10;

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin Gerekli', 'Fotoğraf seçmek için galeri iznini verin.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.75,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const name = asset.fileName || `belge_${Date.now()}.jpg`;
      setAttachment({ uri: asset.uri, name, mimeType: asset.mimeType || 'image/jpeg' });
    }
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setAttachment({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType || 'application/octet-stream' });
    }
  };

  const showAttachmentOptions = () => {
    Alert.alert(
      'Belge Ekle',
      'Nasıl eklemek istersiniz?',
      [
        { text: 'Galeriden Fotoğraf', onPress: pickFromGallery },
        { text: 'Dosya Seç (PDF)', onPress: pickDocument },
        { text: 'İptal', style: 'cancel' },
      ]
    );
  };

  const handleSubmit = async () => {
    if (!isValid) {
      Alert.alert('Eksik Bilgi', 'Lütfen mazeret türü seçin ve en az 10 karakter açıklama yazın.');
      return;
    }

    const parsedCourseId = parseInt(course_id, 10);
    if (!parsedCourseId || isNaN(parsedCourseId)) {
      Alert.alert('Hata', 'Ders bilgisi eksik. Lütfen geçmişinizden devamsız olduğunuz dersi seçin.');
      return;
    }

    setIsSubmitting(true);
    try {
      const submitted = await excuses.submit({
        courseId: parsedCourseId,
        sessionId: session_id ? parseInt(session_id, 10) : null,
        sessionDate: date,
        excuseType: selectedType,
        description: description.trim(),
      });

      // Dosya varsa yükle
      if (attachment && submitted?.id) {
        try {
          await excuses.uploadDocument(submitted.id, attachment.uri, attachment.name, attachment.mimeType);
        } catch {
          // Belge yükleme başarısız olsa bile mazeret kaydedildi, kullanıcıyı uyar
          Alert.alert(
            'Kısmen Başarılı',
            'Mazeretiniz gönderildi ancak belge yüklenemedi. Lütfen belgeyi daha sonra tekrar ekleyin.',
            [{ text: 'Tamam', onPress: () => router.back() }]
          );
          return;
        }
      }

      Alert.alert(
        'Mazeret Gönderildi ✅',
        attachment
          ? 'Mazeretiniz ve belgeniz öğretmene iletildi.'
          : 'Mazeretiniz öğretmene iletildi. Değerlendirme sonucu size bildirilecektir.',
        [{ text: 'Tamam', onPress: () => router.back() }]
      );
    } catch (err) {
      Alert.alert('Bağlantı Hatası', err?.message || 'Sunucuya bağlanılamadı.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#1E3A8A', '#2563EB']} style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Mazeret Gönder</Text>
          <Text style={styles.headerSubtitle}>
            {course_name ? `${course_name}` : `Ders #${course_id}`}
          </Text>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

          {/* Tarih */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>📅 Devamsızlık Tarihi</Text>
            <View style={styles.dateBox}>
              <Ionicons name="calendar-outline" size={20} color="#6366F1" />
              <Text style={styles.dateText}>{date}</Text>
            </View>
          </View>

          {/* Mazeret Türü */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>📌 Mazeret Türü</Text>
            <View style={styles.typeGrid}>
              {EXCUSE_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.key}
                  style={[
                    styles.typeCard,
                    selectedType === t.key && styles.typeCardSelected,
                  ]}
                  onPress={() => setSelectedType(t.key)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.typeIcon}>{t.icon}</Text>
                  <Text style={[styles.typeLabel, selectedType === t.key && styles.typeLabelSelected]}>
                    {t.label}
                  </Text>
                  <Text style={styles.typeDesc}>{t.desc}</Text>
                  {selectedType === t.key && (
                    <View style={styles.typeCheckmark}>
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Açıklama */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>✏️ Açıklama</Text>
            <TextInput
              style={styles.descInput}
              multiline
              numberOfLines={5}
              placeholder="Mazeret nedeninizi detaylı açıklayın... (en az 10 karakter)"
              placeholderTextColor="#94A3B8"
              value={description}
              onChangeText={setDescription}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>
              {description.length} karakter {description.length < 10 ? `(en az 10)` : '✓'}
            </Text>
          </View>

          {/* Belge Ekleme */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>📎 Destekleyici Belge (Opsiyonel)</Text>
            {attachment ? (
              <View style={styles.attachmentCard}>
                {attachment.mimeType?.startsWith('image/') ? (
                  <Image source={{ uri: attachment.uri }} style={styles.attachmentPreview} resizeMode="cover" />
                ) : (
                  <View style={styles.attachmentIcon}>
                    <Ionicons name="document-text" size={32} color="#6366F1" />
                  </View>
                )}
                <View style={styles.attachmentInfo}>
                  <Text style={styles.attachmentName} numberOfLines={1}>{attachment.name}</Text>
                  <Text style={styles.attachmentType}>{attachment.mimeType}</Text>
                </View>
                <TouchableOpacity onPress={() => setAttachment(null)} style={styles.attachmentRemove}>
                  <Ionicons name="close-circle" size={22} color={Colors.error} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.attachmentBtn} onPress={showAttachmentOptions} activeOpacity={0.8}>
                <Ionicons name="cloud-upload-outline" size={22} color="#6366F1" />
                <Text style={styles.attachmentBtnText}>Belge / Fotoğraf Ekle</Text>
                <Text style={styles.attachmentBtnHint}>PDF, JPG, PNG desteklenir</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Gönder */}
          <TouchableOpacity
            style={[styles.submitBtn, !isValid && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!isValid || isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="send" size={20} color="#fff" />
                <Text style={styles.submitBtnText}>Mazeret Gönder</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.bottomPad} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: Colors.bg },
  flex:       { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    gap: 14,
  },
  backButton: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerContent: { flex: 1 },
  headerTitle:   { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  headerSubtitle:{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  content: { flex: 1, paddingHorizontal: 20 },

  section: { marginTop: 24 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted, marginBottom: 10,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },

  dateBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.card, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.borderLight,
    ...Shadows.xs,
  },
  dateText: { fontSize: 15, fontWeight: '600', color: Colors.text },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeCard: {
    width: '47%', backgroundColor: Colors.card, borderRadius: 14,
    padding: 14, borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', gap: 4, position: 'relative',
    ...Shadows.xs,
  },
  typeCardSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryMuted },
  typeIcon:  { fontSize: 26 },
  typeLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, textAlign: 'center' },
  typeLabelSelected: { color: Colors.primary },
  typeDesc:  { fontSize: 11, color: Colors.textMuted, textAlign: 'center', lineHeight: 15 },
  typeCheckmark: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: Colors.primary, borderRadius: 10,
    width: 20, height: 20, alignItems: 'center', justifyContent: 'center',
  },

  descInput: {
    backgroundColor: Colors.card, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.borderLight,
    fontSize: 15, color: Colors.text, minHeight: 120,
    ...Shadows.xs,
  },
  charCount: {
    marginTop: 6, fontSize: 12, color: Colors.textMuted, textAlign: 'right',
  },

  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: Colors.primaryMuted, borderRadius: 12, padding: 14,
    marginTop: 20, borderWidth: 1, borderColor: Colors.primaryLight,
  },
  infoText: { flex: 1, fontSize: 13, color: Colors.primary, lineHeight: 18 },

  attachmentBtn: {
    borderWidth: 2, borderColor: '#6366F1', borderStyle: 'dashed',
    borderRadius: 14, padding: 20, alignItems: 'center', gap: 6,
    backgroundColor: '#F5F3FF',
  },
  attachmentBtnText: { fontSize: 15, fontWeight: '700', color: '#6366F1' },
  attachmentBtnHint: { fontSize: 12, color: Colors.textMuted },

  attachmentCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.card, borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: '#6366F1',
    ...Shadows.xs,
  },
  attachmentPreview: { width: 56, height: 56, borderRadius: 10 },
  attachmentIcon: {
    width: 56, height: 56, borderRadius: 10,
    backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center',
  },
  attachmentInfo: { flex: 1 },
  attachmentName: { fontSize: 13, fontWeight: '600', color: Colors.text },
  attachmentType: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  attachmentRemove: { padding: 4 },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: Colors.primary, borderRadius: 16,
    paddingVertical: 16, marginTop: 24,
    ...Shadows.primary,
  },
  submitBtnDisabled: { backgroundColor: Colors.border, shadowOpacity: 0, elevation: 0 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  bottomPad: { height: 40 },
});
