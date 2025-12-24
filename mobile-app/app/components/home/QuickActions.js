import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const ACTIONS = [
  { id: 'face', icon: 'scan', color: '#F3E8FF', iconColor: '#A855F7', title: 'Face ID', subtitle: 'Scan your face' },
  { id: 'qr', icon: 'qr-code', color: '#DBEAFE', iconColor: '#3B82F6', title: 'QR Code', subtitle: 'Scan QR code' },
  { id: 'excuse', icon: 'document-text', color: '#FEF3C7', iconColor: '#F59E0B', title: 'Excuse', subtitle: 'Submit excuse' },
  { id: 'history', icon: 'time', color: '#D1FAE5', iconColor: '#10B981', title: 'History', subtitle: 'View records' },
];

export default function QuickActions({ hasFaceRegistered, onFaceScan, onQRScan, onExcuse, onHistory }) {
  const handlePress = (id) => {
    const actions = {
      face: onFaceScan,
      qr: onQRScan,
      excuse: onExcuse,
      history: onHistory,
    };
    actions[id]?.();
  };

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Quick Actions</Text>
      <View style={styles.grid}>
        {ACTIONS.map((action) => (
          <TouchableOpacity
            key={action.id}
            style={styles.card}
            onPress={() => handlePress(action.id)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, { backgroundColor: action.color }]}>
              <Ionicons name={action.icon} size={28} color={action.iconColor} />
            </View>
            <Text style={styles.cardTitle}>{action.title}</Text>
            <Text style={styles.cardSubtitle}>{action.subtitle}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: (width - 52) / 2,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});

