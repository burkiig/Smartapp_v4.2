import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function LiveClassCard({ liveClass }) {
  return (
    <View style={styles.card}>
      <LinearGradient
        colors={['#10B981', '#059669']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <View style={styles.badge}>
            <View style={styles.dot} />
            <Text style={styles.badgeText}>LIVE NOW</Text>
          </View>
          <Text style={styles.time}>{liveClass.time}</Text>
        </View>

        <Text style={styles.code}>{liveClass.course}</Text>
        <Text style={styles.title}>{liveClass.title}</Text>

        <View style={styles.details}>
          <View style={styles.detailItem}>
            <Ionicons name="location" size={16} color="rgba(255,255,255,0.9)" />
            <Text style={styles.detailText}>{liveClass.room}</Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="person" size={16} color="rgba(255,255,255,0.9)" />
            <Text style={styles.detailText}>{liveClass.instructor}</Text>
          </View>
        </View>

        {!liveClass.attendanceMarked && (
          <View style={styles.warning}>
            <Ionicons name="alert-circle" size={16} color="#FEF3C7" />
            <Text style={styles.warningText}>Attendance not marked yet</Text>
          </View>
        )}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  gradient: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FEF3C7',
    marginRight: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  time: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  code: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  details: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(254, 243, 199, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  warningText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FEF3C7',
  },
});

