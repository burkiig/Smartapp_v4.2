import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Colors, Shadows } from '../shared/config/theme';

const EXCUSE_TYPES = [
  { value: 'medical',        label: 'Sağlık (Sağlık Raporu)',           icon: 'medical' },
  { value: 'school_activity',label: 'Okul Etkinliği (Spor, Konferans)', icon: 'trophy' },
  { value: 'family',         label: 'Aile Acil Durumu',                 icon: 'people' },
  { value: 'technical',      label: 'Teknik Sorun (Online Ders)',        icon: 'bug' },
  { value: 'other',          label: 'Diğer',                            icon: 'ellipsis-horizontal' },
];

export default function ExcuseModal({ visible, onClose, attendanceRecord, onSubmit }) {
  const [selectedType, setSelectedType] = useState('');
  const [description,  setDescription]  = useState('');
  const [documents,    setDocuments]    = useState([]);

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('İzin Gerekli', 'Kamera izni gereklidir'); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8 });
    if (!result.canceled) setDocuments([...documents, { uri: result.assets[0].uri, type: 'image', name: `photo_${Date.now()}.jpg` }]);
  };

  const handlePickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('İzin Gerekli', 'Galeri izni gereklidir'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8 });
    if (!result.canceled) setDocuments([...documents, { uri: result.assets[0].uri, type: 'image', name: `image_${Date.now()}.jpg` }]);
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'] });
      if (!result.canceled && result.assets?.length > 0) {
        const asset = result.assets[0];
        setDocuments([...documents, { uri: asset.uri, type: 'document', name: asset.name }]);
      }
    } catch { /* ignore */ }
  };

  const handleSubmit = () => {
    if (!selectedType) { Alert.alert('Hata', 'Lütfen bir mazeret türü seçin'); return; }
    if (description.trim().length < 10) { Alert.alert('Hata', 'Lütfen detaylı bir açıklama yazın (en az 10 karakter)'); return; }
    onSubmit({ attendanceId: attendanceRecord.id, type: selectedType, description: description.trim(), documents, submittedAt: new Date().toISOString() });
    handleClose();
  };

  const handleClose = () => {
    setSelectedType('');
    setDescription('');
    setDocuments([]);
    onClose();
  };

  const canSubmit = !!selectedType && description.trim().length >= 10;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>

          {/* Handle bar */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Mazeret Gönder</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
              <Ionicons name="close" size={20} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

            {/* Info card */}
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Ionicons name="calendar-outline" size={16} color={Colors.primary} />
                <Text style={styles.infoLabel}>Ders Tarihi</Text>
                <Text style={styles.infoValue}>{attendanceRecord?.date || '—'}</Text>
              </View>
              <View style={[styles.infoRow, { marginTop: 8 }]}>
                <Ionicons name="time-outline" size={16} color={Colors.warning} />
                <Text style={[styles.infoLabel, { color: Colors.warning, flex: 1 }]}>
                  Mazeretler 24 saat içinde gönderilmelidir
                </Text>
              </View>
            </View>

            {/* Excuse type */}
            <Text style={styles.sectionTitle}>MAZERET TÜRÜ</Text>
            {EXCUSE_TYPES.map((type) => {
              const selected = selectedType === type.value;
              return (
                <TouchableOpacity
                  key={type.value}
                  style={[styles.typeOption, selected && styles.typeOptionSelected]}
                  onPress={() => setSelectedType(type.value)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.typeIconBox, { backgroundColor: selected ? Colors.primary + '18' : Colors.bgAlt }]}>
                    <Ionicons name={type.icon} size={18} color={selected ? Colors.primary : Colors.textMuted} />
                  </View>
                  <Text style={[styles.typeText, selected && styles.typeTextSelected]}>{type.label}</Text>
                  {selected && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
                </TouchableOpacity>
              );
            })}

            {/* Description */}
            <Text style={styles.sectionTitle}>AÇIKLAMA</Text>
            <TextInput
              style={[styles.textArea, description.length > 0 && styles.textAreaActive]}
              placeholder="Mazeretinizi detaylı olarak açıklayın..."
              placeholderTextColor={Colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              maxLength={500}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{description.length}/500</Text>

            {/* Documents */}
            <Text style={styles.sectionTitle}>DESTEKLEYİCİ BELGELER</Text>
            <View style={styles.uploadRow}>
              <TouchableOpacity style={styles.uploadBtn} onPress={handlePickImage}>
                <Ionicons name="camera" size={18} color={Colors.primary} />
                <Text style={styles.uploadBtnText}>Kamera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.uploadBtn} onPress={handlePickFromGallery}>
                <Ionicons name="images" size={18} color={Colors.primary} />
                <Text style={styles.uploadBtnText}>Galeri</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.uploadBtn} onPress={handlePickDocument}>
                <Ionicons name="document" size={18} color={Colors.primary} />
                <Text style={styles.uploadBtnText}>Dosya</Text>
              </TouchableOpacity>
            </View>

            {documents.map((doc, i) => (
              <View key={i} style={styles.docItem}>
                <Ionicons name="document-attach" size={18} color={Colors.success} />
                <Text style={styles.docName} numberOfLines={1}>{doc.name}</Text>
                <TouchableOpacity onPress={() => setDocuments(documents.filter((_, idx) => idx !== i))}>
                  <Ionicons name="close-circle" size={20} color={Colors.error} />
                </TouchableOpacity>
              </View>
            ))}

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
              activeOpacity={0.85}
            >
              <Ionicons name="send" size={18} color="#fff" />
              <Text style={styles.submitBtnText}>Mazeret Gönder</Text>
            </TouchableOpacity>

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  sheet:   { backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, maxHeight: '92%' },

  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16 },

  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  closeBtn:    { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.bgAlt, alignItems: 'center', justifyContent: 'center' },

  infoCard: { backgroundColor: Colors.primaryMuted, borderRadius: 14, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: Colors.primaryLight },
  infoRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoLabel:{ fontSize: 13, color: Colors.textSecondary },
  infoValue:{ fontSize: 13, fontWeight: '600', color: Colors.text },

  sectionTitle: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10, marginTop: 20 },

  typeOption:         { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 8, backgroundColor: Colors.card },
  typeOptionSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryMuted },
  typeIconBox:        { width: 36, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  typeText:           { flex: 1, fontSize: 14, color: Colors.textSecondary },
  typeTextSelected:   { color: Colors.primary, fontWeight: '600' },

  textArea:       { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, fontSize: 14, color: Colors.text, minHeight: 110, backgroundColor: Colors.bgAlt },
  textAreaActive: { borderColor: Colors.primary, backgroundColor: Colors.card },
  charCount:      { fontSize: 12, color: Colors.textMuted, textAlign: 'right', marginTop: 6 },

  uploadRow:    { flexDirection: 'row', gap: 8, marginBottom: 12 },
  uploadBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.primaryLight, backgroundColor: Colors.primaryMuted },
  uploadBtnText:{ fontSize: 12, fontWeight: '600', color: Colors.primary },

  docItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: Colors.successMuted, borderRadius: 10, marginBottom: 8 },
  docName: { flex: 1, fontSize: 13, color: Colors.text },

  submitBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, marginTop: 24, ...Shadows.primary },
  submitBtnDisabled: { backgroundColor: Colors.textMuted, shadowOpacity: 0 },
  submitBtnText:     { fontSize: 15, fontWeight: '700', color: '#fff' },
});
