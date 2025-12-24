import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useUser } from '../context/UserContext';

export default function ReportsScreen() {
  const { userType } = useUser();

  // Student ise history göster  
  if (userType === 'student') {
    const StudentHistory = require('./history').default;
    return <StudentHistory />;
  }

  const [stats] = useState({
    totalClasses: 66,
    totalStudents: 234,
    avgAttendance: 92,
    thisWeekClasses: 12,
    thisWeekAttendance: 94,
    flaggedCount: 8,
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Reports</Text>
            <Text style={styles.headerSubtitle}>Statistics and analysis</Text>
          </View>
          <TouchableOpacity style={styles.settingsButton}>
            <Ionicons name="settings-outline" size={24} color="#1F2937" />
          </TouchableOpacity>
        </View>

        {/* Overall Stats */}
        <View style={styles.overallCard}>
          <LinearGradient
            colors={['#5B7FFF', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.overallGradient}
          >
            <Text style={styles.overallTitle}>Overall Attendance Rate</Text>
            <Text style={styles.overallValue}>{stats.avgAttendance}%</Text>
            <View style={styles.overallBar}>
              <View style={[styles.overallProgress, { width: `${stats.avgAttendance}%` }]} />
            </View>
            <Text style={styles.overallSubtitle}>This semester - {stats.totalClasses} classes</Text>
          </LinearGradient>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Summary Statistics</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Ionicons name="calendar" size={24} color="#5B7FFF" />
              <Text style={styles.statValue}>{stats.totalClasses}</Text>
              <Text style={styles.statLabel}>Total Classes</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="people" size={24} color="#10B981" />
              <Text style={styles.statValue}>{stats.totalStudents}</Text>
              <Text style={styles.statLabel}>Total Students</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="trending-up" size={24} color="#F59E0B" />
              <Text style={styles.statValue}>{stats.thisWeekClasses}</Text>
              <Text style={styles.statLabel}>This Week</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="flag" size={24} color="#EF4444" />
              <Text style={styles.statValue}>{stats.flaggedCount}</Text>
              <Text style={styles.statLabel}>Flagged</Text>
            </View>
          </View>
        </View>

        {/* Export Options */}
        <View style={styles.exportSection}>
          <Text style={styles.sectionTitle}>Export Report</Text>
          
          <TouchableOpacity style={styles.exportCard}>
            <View style={styles.exportLeft}>
              <View style={[styles.exportIcon, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="document-text" size={24} color="#EF4444" />
              </View>
              <View>
                <Text style={styles.exportTitle}>PDF Report</Text>
                <Text style={styles.exportSubtitle}>Detailed attendance report</Text>
              </View>
            </View>
            <Ionicons name="download-outline" size={24} color="#6B7280" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.exportCard}>
            <View style={styles.exportLeft}>
              <View style={[styles.exportIcon, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="grid" size={24} color="#10B981" />
              </View>
              <View>
                <Text style={styles.exportTitle}>Excel Spreadsheet</Text>
                <Text style={styles.exportSubtitle}>Raw data (.xlsx)</Text>
              </View>
            </View>
            <Ionicons name="download-outline" size={24} color="#6B7280" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.exportCard}>
            <View style={styles.exportLeft}>
              <View style={[styles.exportIcon, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="bar-chart" size={24} color="#3B82F6" />
              </View>
              <View>
                <Text style={styles.exportTitle}>Chart Report</Text>
                <Text style={styles.exportSubtitle}>Visual analysis (PNG)</Text>
              </View>
            </View>
            <Ionicons name="download-outline" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Period Selection */}
        <View style={styles.periodSection}>
          <Text style={styles.sectionTitle}>Dönem Seç</Text>
          
          <TouchableOpacity style={styles.periodButton}>
            <View style={styles.periodLeft}>
              <Ionicons name="calendar-outline" size={20} color="#5B7FFF" />
              <Text style={styles.periodText}>Daily Report</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.periodButton}>
            <View style={styles.periodLeft}>
              <Ionicons name="calendar-outline" size={20} color="#5B7FFF" />
              <Text style={styles.periodText}>Weekly Report</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.periodButton}>
            <View style={styles.periodLeft}>
              <Ionicons name="calendar-outline" size={20} color="#5B7FFF" />
              <Text style={styles.periodText}>Monthly Report</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.periodButton}>
            <View style={styles.periodLeft}>
              <Ionicons name="calendar-outline" size={20} color="#5B7FFF" />
              <Text style={styles.periodText}>Özel Dönem</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  settingsButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overallCard: {
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#5B7FFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  overallGradient: {
    padding: 20,
  },
  overallTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 8,
  },
  overallValue: {
    fontSize: 48,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  overallBar: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  overallProgress: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 4,
  },
  overallSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
  },
  statsSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  exportSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  exportCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  exportLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  exportIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  exportSubtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
  periodSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  periodButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  periodLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  periodText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1F2937',
  },
});

