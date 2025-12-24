import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  FlatList,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function ClassDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [activeTab, setActiveTab] = useState('overview'); // overview, students, manual
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('Instructor unavailable');
  const [searchQuery, setSearchQuery] = useState('');

  // Mock data - gerçekte params'tan gelecek
  const classInfo = {
    code: params.code || 'CS201',
    title: params.title || 'Data Structures',
    room: 'Lab 204',
    time: '14:00 - 15:30',
    status: 'in-progress',
    totalStudents: 38,
    present: 28,
    absent: 8,
    flagged: 2
  };

  const [students] = useState([
    { id: 'STU12001', name: 'Alice Anderson', status: 'present', avatar: 'AA' },
    { id: 'STU12002', name: 'Bob Brown', status: 'present', avatar: 'BB' },
    { id: 'STU12003', name: 'Charlie Davis', status: 'absent', avatar: 'CD' },
    { id: 'STU12004', name: 'Diana Evans', status: 'flagged', avatar: 'DE' },
    { id: 'STU12005', name: 'Ethan Foster', status: 'present', avatar: 'EF' },
    { id: 'STU12006', name: 'Fiona Garcia', status: 'present', avatar: 'FG' },
    { id: 'STU12007', name: 'George Harris', status: 'present', avatar: 'GH' },
    { id: 'STU12008', name: 'Hannah Irving', status: 'absent', avatar: 'HI' },
  ]);

  const timeline = [
    { time: '13:55', event: 'Auto attendance session opened', type: 'info' },
    { time: '14:00', event: 'Class started', type: 'success' },
    { time: '14:15', event: '2 students flagged for manual review', type: 'warning' },
  ];

  const handleCancelClass = () => {
    Alert.alert(
      'Cancel Class',
      `Class will be cancelled. Reason: ${cancelReason}`,
      [
        { text: 'Go Back', style: 'cancel' },
        {
          text: 'Cancel Class',
          style: 'destructive',
          onPress: () => {
            setShowCancelModal(false);
            router.back();
          },
        },
      ]
    );
  };

  const handleMarkAttendance = (studentId, newStatus) => {
    Alert.alert('Success', `Attendance for ${studentId} updated to ${newStatus}`);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'present':
        return '#10B981';
      case 'absent':
        return '#EF4444';
      case 'flagged':
        return '#F59E0B';
      default:
        return '#6B7280';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'present':
        return 'Mevcut';
      case 'absent':
        return 'Yok';
      case 'flagged':
        return 'Flagged';
      default:
        return 'Bilinmiyor';
    }
  };

  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderStudentItem = ({ item }) => (
    <View style={styles.studentCard}>
      <View style={styles.studentLeft}>
        <View style={styles.studentAvatar}>
          <Text style={styles.studentAvatarText}>{item.avatar}</Text>
        </View>
        <View>
          <Text style={styles.studentName}>{item.name}</Text>
          <Text style={styles.studentId}>{item.id}</Text>
        </View>
      </View>
      <View style={styles.studentRight}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {getStatusText(item.status)}
          </Text>
        </View>
        {activeTab === 'manual' && (
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => handleMarkAttendance(item.id, 'present')}
            >
              <Ionicons name="checkmark" size={18} color="#10B981" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => handleMarkAttendance(item.id, 'absent')}
            >
              <Ionicons name="close" size={18} color="#EF4444" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{classInfo.code}</Text>
          <Text style={styles.headerSubtitle}>{classInfo.title}</Text>
        </View>
        <TouchableOpacity 
          style={styles.cancelButton}
          onPress={() => setShowCancelModal(true)}
        >
          <Ionicons name="close-circle-outline" size={24} color="#EF4444" />
        </TouchableOpacity>
      </View>

      {/* Stats Card */}
      <View style={styles.statsCard}>
        <LinearGradient
          colors={['#5B7FFF', '#7C3AED']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.statsGradient}
        >
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{classInfo.totalStudents}</Text>
              <Text style={styles.statLabel}>Toplam</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{classInfo.present}</Text>
              <Text style={styles.statLabel}>Mevcut</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{classInfo.absent}</Text>
              <Text style={styles.statLabel}>Yok</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{classInfo.flagged}</Text>
              <Text style={styles.statLabel}>Flagged</Text>
            </View>
          </View>
          <View style={styles.classInfo}>
            <View style={styles.infoItem}>
              <Ionicons name="time-outline" size={16} color="rgba(255,255,255,0.9)" />
              <Text style={styles.infoText}>{classInfo.time}</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="location-outline" size={16} color="rgba(255,255,255,0.9)" />
              <Text style={styles.infoText}>{classInfo.room}</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'overview' && styles.tabActive]}
          onPress={() => setActiveTab('overview')}
        >
          <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>
            Genel
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'students' && styles.tabActive]}
          onPress={() => setActiveTab('students')}
        >
          <Text style={[styles.tabText, activeTab === 'students' && styles.tabTextActive]}>
            Students
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'manual' && styles.tabActive]}
          onPress={() => setActiveTab('manual')}
        >
          <Text style={[styles.tabText, activeTab === 'manual' && styles.tabTextActive]}>
            Manual Attendance
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'overview' && (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Zaman Çizelgesi</Text>
            {timeline.map((item, index) => (
              <View key={index} style={styles.timelineItem}>
                <View style={[
                  styles.timelineDot,
                  { backgroundColor: 
                    item.type === 'success' ? '#10B981' :
                    item.type === 'warning' ? '#F59E0B' : '#5B7FFF'
                  }
                ]} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineTime}>{item.time}</Text>
                  <Text style={styles.timelineEvent}>{item.event}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Session Info</Text>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <Text style={styles.infoRowText}>Auto attendance active</Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="time" size={20} color="#5B7FFF" />
                <Text style={styles.infoRowText}>Süre: 80 dakika</Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="location" size={20} color="#A855F7" />
                <Text style={styles.infoRowText}>Location: {classInfo.room}</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      )}

      {(activeTab === 'students' || activeTab === 'manual') && (
        <>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search student..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#9CA3AF"
            />
          </View>
          <FlatList
            data={filteredStudents}
            renderItem={renderStudentItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        </>
      )}

      {/* Cancel Modal */}
      <Modal
        visible={showCancelModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cancel Class</Text>
            <Text style={styles.modalSubtitle}>Select cancellation reason</Text>

            <TouchableOpacity
              style={[styles.reasonOption, cancelReason === 'Instructor unavailable' && styles.reasonOptionActive]}
              onPress={() => setCancelReason('Instructor unavailable')}
            >
              <Text style={styles.reasonText}>Öğretmen müsait değil</Text>
              {cancelReason === 'Instructor unavailable' && (
                <Ionicons name="checkmark-circle" size={20} color="#5B7FFF" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.reasonOption, cancelReason === 'Technical issues' && styles.reasonOptionActive]}
              onPress={() => setCancelReason('Technical issues')}
            >
              <Text style={styles.reasonText}>Teknik sorun</Text>
              {cancelReason === 'Technical issues' && (
                <Ionicons name="checkmark-circle" size={20} color="#5B7FFF" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.reasonOption, cancelReason === 'Holiday/Event' && styles.reasonOptionActive]}
              onPress={() => setCancelReason('Holiday/Event')}
            >
              <Text style={styles.reasonText}>Tatil/Etkinlik</Text>
              {cancelReason === 'Holiday/Event' && (
                <Ionicons name="checkmark-circle" size={20} color="#5B7FFF" />
              )}
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowCancelModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={handleCancelClass}
              >
                <Text style={styles.modalConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  cancelButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsCard: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#5B7FFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  statsGradient: {
    padding: 20,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  classInfo: {
    flexDirection: 'row',
    gap: 16,
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
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#5B7FFF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#5B7FFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
    marginRight: 12,
  },
  timelineContent: {
    flex: 1,
  },
  timelineTime: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  timelineEvent: {
    fontSize: 14,
    color: '#1F2937',
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoRowText: {
    fontSize: 14,
    color: '#1F2937',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  studentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  studentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  studentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#5B7FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  studentName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  studentId: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  studentRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 6,
  },
  quickActionButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  reasonOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  reasonOptionActive: {
    borderColor: '#5B7FFF',
    backgroundColor: '#EEF2FF',
  },
  reasonText: {
    fontSize: 15,
    color: '#1F2937',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});

