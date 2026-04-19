import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function FaceWarning({ onRegister }) {
  return (
    <View style={styles.warningCard}>
      <Ionicons name="warning" size={24} color="#F59E0B" style={styles.icon} />
      <View style={styles.content}>
        <Text style={styles.title}>Yüz Kaydı Yapılmadı</Text>
        <Text style={styles.text}>Yoklama için yüz kaydınızı tamamlayın</Text>
      </View>
      <TouchableOpacity style={styles.button} onPress={onRegister}>
        <Text style={styles.buttonText}>Kaydet</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  icon: {
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 2,
  },
  text: {
    fontSize: 12,
    color: '#92400E',
  },
  button: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
});

