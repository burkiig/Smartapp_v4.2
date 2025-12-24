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

const EXCUSE_TYPES = [
  { value: 'health', label: 'Health (Medical Report)', icon: 'medical' },
  { value: 'school_activity', label: 'School Activity (Sports, Conference)', icon: 'trophy' },
  { value: 'family', label: 'Family Emergency / Bereavement', icon: 'people' },
  { value: 'technical', label: 'Technical Issue (Online Class)', icon: 'bug' },
  { value: 'other', label: 'Other', icon: 'ellipsis-horizontal' },
];

export default function ExcuseModal({ visible, onClose, attendanceRecord, onSubmit }) {
  const [selectedType, setSelectedType] = useState('');
  const [description, setDescription] = useState('');
  const [documents, setDocuments] = useState([]);

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setDocuments([...documents, { uri: result.assets[0].uri, type: 'image', name: `photo_${Date.now()}.jpg` }]);
    }
  };

  const handlePickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Gallery permission is required');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setDocuments([...documents, { uri: result.assets[0].uri, type: 'image', name: `image_${Date.now()}.jpg` }]);
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setDocuments([...documents, { uri: asset.uri, type: 'document', name: asset.name }]);
      }
    } catch (error) {
      console.log('Document picker error:', error);
    }
  };

  const handleSubmit = () => {
    if (!selectedType) {
      Alert.alert('Error', 'Please select an excuse type');
      return;
    }

    if (description.trim().length < 10) {
      Alert.alert('Error', 'Please provide a detailed description (min 10 characters)');
      return;
    }

    const excuseData = {
      attendanceId: attendanceRecord.id,
      type: selectedType,
      description: description.trim(),
      documents: documents,
      submittedAt: new Date().toISOString(),
    };

    onSubmit(excuseData);
    
    // Reset form
    setSelectedType('');
    setDescription('');
    setDocuments([]);
    onClose();
  };

  const handleClose = () => {
    setSelectedType('');
    setDescription('');
    setDocuments([]);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Submit Excuse</Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color="#1F2937" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Attendance Info */}
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Class Date</Text>
              <Text style={styles.infoValue}>{attendanceRecord?.date}</Text>
              <View style={styles.warningBox}>
                <Ionicons name="time" size={16} color="#F59E0B" />
                <Text style={styles.warningText}>
                  Excuses must be submitted within 24 hours
                </Text>
              </View>
            </View>

            {/* Excuse Type */}
            <Text style={styles.sectionTitle}>Excuse Type *</Text>
            {EXCUSE_TYPES.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[
                  styles.typeOption,
                  selectedType === type.value && styles.typeOptionSelected,
                ]}
                onPress={() => setSelectedType(type.value)}
              >
                <Ionicons
                  name={type.icon}
                  size={20}
                  color={selectedType === type.value ? '#5B7FFF' : '#6B7280'}
                />
                <Text
                  style={[
                    styles.typeText,
                    selectedType === type.value && styles.typeTextSelected,
                  ]}
                >
                  {type.label}
                </Text>
                {selectedType === type.value && (
                  <Ionicons name="checkmark-circle" size={20} color="#5B7FFF" />
                )}
              </TouchableOpacity>
            ))}

            {/* Description */}
            <Text style={styles.sectionTitle}>Description *</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Explain your reason in detail..."
              placeholderTextColor="#9CA3AF"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              maxLength={500}
            />
            <Text style={styles.charCount}>{description.length}/500</Text>

            {/* Document Upload */}
            <Text style={styles.sectionTitle}>Supporting Documents</Text>
            <View style={styles.uploadButtons}>
              <TouchableOpacity style={styles.uploadButton} onPress={handlePickImage}>
                <Ionicons name="camera" size={20} color="#5B7FFF" />
                <Text style={styles.uploadButtonText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.uploadButton} onPress={handlePickFromGallery}>
                <Ionicons name="images" size={20} color="#5B7FFF" />
                <Text style={styles.uploadButtonText}>Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.uploadButton} onPress={handlePickDocument}>
                <Ionicons name="document" size={20} color="#5B7FFF" />
                <Text style={styles.uploadButtonText}>File</Text>
              </TouchableOpacity>
            </View>

            {/* Documents List */}
            {documents.map((doc, index) => (
              <View key={index} style={styles.documentItem}>
                <Ionicons name="document-attach" size={20} color="#10B981" />
                <Text style={styles.documentName} numberOfLines={1}>
                  {doc.name}
                </Text>
                <TouchableOpacity
                  onPress={() => setDocuments(documents.filter((_, i) => i !== index))}
                >
                  <Ionicons name="close-circle" size={20} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}

            {/* Submit Button */}
            <TouchableOpacity 
              style={[styles.submitButton, (!selectedType || description.trim().length < 10) && styles.submitButtonDisabled]} 
              onPress={handleSubmit}
              disabled={!selectedType || description.trim().length < 10}
            >
              <Text style={styles.submitButtonText}>Submit Excuse</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  infoCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  warningText: {
    fontSize: 12,
    color: '#F59E0B',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
    marginTop: 16,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
    gap: 12,
  },
  typeOptionSelected: {
    borderColor: '#5B7FFF',
    backgroundColor: '#EEF2FF',
  },
  typeText: {
    flex: 1,
    fontSize: 14,
    color: '#6B7280',
  },
  typeTextSelected: {
    color: '#5B7FFF',
    fontWeight: '600',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#1F2937',
    textAlignVertical: 'top',
    minHeight: 100,
  },
  charCount: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 4,
  },
  uploadButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  uploadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#5B7FFF',
    backgroundColor: '#EEF2FF',
  },
  uploadButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5B7FFF',
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    marginBottom: 8,
  },
  documentName: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
  },
  submitButton: {
    backgroundColor: '#5B7FFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

