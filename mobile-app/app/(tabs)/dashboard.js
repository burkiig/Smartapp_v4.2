import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useUser } from '../context/UserContext';

export default function DashboardScreen() {
  const router = useRouter();
  const { userType, userName } = useUser();

  // Student için mevcut home ekranını göster
  if (userType === 'student') {
    const StudentHome = require('./home').default;
    return <StudentHome />;
  }

  // Instructor Dashboard
  const [todayStats] = useState({
    totalClassesToday: 3,
    activeSession: 1,
    flaggedCount: 3,
    studentsOnline: 28
  });

  const [nextClass] = useState({
    course: 'CS201',
    title: 'Data Structures',
    time: '14:00 - 15:30',
    room: 'Lab 204',
    studentsEnrolled: 38,
    studentsPresent: 28
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello,</Text>
            <Text style={styles.userName}>{userName || 'Dr. Robert Chen'}</Text>
          </View>
          <TouchableOpacity style={styles.notificationButton}>
            <Ionicons name="notifications-outline" size={24} color="#1F2937" />
            {todayStats.flaggedCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{todayStats.flaggedCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsGrid}>
          <TouchableOpacity 
            style={[styles.statCard, { borderLeftColor: '#5B7FFF' }]}
            onPress={() => router.push('/(tabs)/schedule')}
          >
            <Ionicons name="calendar-outline" size={24} color="#5B7FFF" />
            <Text style={styles.statValue}>{todayStats.totalClassesToday}</Text>
            <Text style={styles.statLabel}>Today's Classes</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.statCard, { borderLeftColor: '#10B981' }]}
            onPress={() => router.push({
              pathname: '/class-details',
              params: { code: nextClass.course, title: nextClass.title }
            })}
          >
            <Ionicons name="play-circle-outline" size={24} color="#10B981" />
            <Text style={styles.statValue}>{todayStats.activeSession}</Text>
            <Text style={styles.statLabel}>Active Session</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.statCard, { borderLeftColor: '#F59E0B' }]}
            onPress={() => router.push('/(tabs)/attendance')}
          >
            <Ionicons name="flag-outline" size={24} color="#F59E0B" />
            <Text style={styles.statValue}>{todayStats.flaggedCount}</Text>
            <Text style={styles.statLabel}>Flagged</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.statCard, { borderLeftColor: '#A855F7' }]}
            onPress={() => router.push('/(tabs)/more')}
          >
            <Ionicons name="people-outline" size={24} color="#A855F7" />
            <Text style={styles.statValue}>{todayStats.studentsOnline}</Text>
            <Text style={styles.statLabel}>Active Students</Text>
          </TouchableOpacity>
        </View>

        {/* Next Class */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Next Class</Text>
          <TouchableOpacity 
            style={styles.classCard}
            onPress={() => router.push({
              pathname: '/class-details',
              params: { code: nextClass.course, title: nextClass.title }
            })}
          >
            <LinearGradient
              colors={['#5B7FFF', '#7C3AED']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.classGradient}
            >
              <View style={styles.classHeader}>
                <View>
                  <Text style={styles.classCode}>{nextClass.course}</Text>
                  <Text style={styles.classTitle}>{nextClass.title}</Text>
                </View>
                <View style={styles.liveIndicator}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>CANLI</Text>
                </View>
              </View>

              <View style={styles.classInfo}>
                <View style={styles.infoItem}>
                  <Ionicons name="time-outline" size={16} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.infoText}>{nextClass.time}</Text>
                </View>
                <View style={styles.infoItem}>
                  <Ionicons name="location-outline" size={16} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.infoText}>{nextClass.room}</Text>
                </View>
              </View>

              <View style={styles.attendanceBar}>
                <View style={styles.attendanceInfo}>
                  <Text style={styles.attendanceText}>
                    {nextClass.studentsPresent}/{nextClass.studentsEnrolled} Students
                  </Text>
                  <Text style={styles.attendancePercent}>
                    {Math.round((nextClass.studentsPresent / nextClass.studentsEnrolled) * 100)}%
                  </Text>
                </View>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { width: `${(nextClass.studentsPresent / nextClass.studentsEnrolled) * 100}%` }
                    ]} 
                  />
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push({
                pathname: '/class-details',
                params: { code: nextClass.course, title: nextClass.title }
              })}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#EEF2FF' }]}>
                <Ionicons name="play-circle" size={28} color="#5B7FFF" />
              </View>
              <Text style={styles.actionText}>Start Session</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/(tabs)/attendance')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="flag" size={28} color="#F59E0B" />
              </View>
              <Text style={styles.actionText}>View Flagged</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/(tabs)/more')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="people" size={28} color="#10B981" />
              </View>
              <Text style={styles.actionText}>Student List</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/(tabs)/reports')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#F3E8FF' }]}>
                <Ionicons name="document-text" size={28} color="#A855F7" />
              </View>
              <Text style={styles.actionText}>Get Report</Text>
            </TouchableOpacity>
          </View>
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
  greeting: {
    fontSize: 14,
    color: '#6B7280',
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 2,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  classCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#5B7FFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  classGradient: {
    padding: 20,
  },
  classHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  classCode: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  classTitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  classInfo: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
  },
  attendanceBar: {
    marginTop: 8,
  },
  attendanceInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  attendanceText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
  },
  attendancePercent: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 3,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionButton: {
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
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
  },
});

