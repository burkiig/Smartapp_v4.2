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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
  const { course_id, session_id, session_date, course_name } = useLocalSearchParams();

  const today = new Date().toISOString().slice(0, 10);

  const [selectedType, setSelectedType] = useState(null);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(session_date || today);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isValid = selectedType && description.trim().length >= 10;

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
      await excuses.submit({
        courseId: parsedCourseId,
        sessionId: session_id ? parseInt(session_id, 10) : null,
        sessionDate: date,
        excuseType: selectedType,
        description: description.trim(),
      });

      Alert.alert(
        'Mazeret Gönderildi ✅',
        'Mazeretiniz öğretmene iletildi. Değerlendirme sonucu size bildirilecektir.',
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

          {/* Belge notu */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={18} color="#6366F1" />
            <Text style={styles.infoText}>
              Doktor raporu veya diğer belgelerinizi öğretmeninize fiziksel olarak iletebilirsiniz.
            </Text>
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
