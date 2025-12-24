import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function MonthStats({ stats }) {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>This Month</Text>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.subtitle}>Attendance Rate</Text>
          <View style={styles.badge}>
            <Ionicons name="trending-up" size={16} color="#10B981" />
          </View>
        </View>
        <Text style={styles.percentage}>{stats.percentage}%</Text>
        <View style={styles.details}>
          <StatItem label="Total Days" value={stats.totalDays} />
          <View style={styles.divider} />
          <StatItem label="Present" value={stats.present} color="#10B981" />
          <View style={styles.divider} />
          <StatItem label="Absent" value={stats.absent} color="#EF4444" />
        </View>
      </View>
    </View>
  );
}

function StatItem({ label, value, color = '#1F2937' }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
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
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentage: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#5B7FFF',
    marginBottom: 16,
  },
  details: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  divider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 8,
  },
});

