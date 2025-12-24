import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '../context/UserContext';

export default function AttendanceScreen() {
  const { userType } = useUser();

  // Student ise profil göster
  if (userType === 'student') {
    const StudentProfile = require('./profile').default;
    return <StudentProfile />;
  }

  const [flaggedAttendance, setFlaggedAttendance] = useState([
    {
      id: 1,
      student: 'Sarah Johnson',
      studentId: 'STU12345',
      course: 'CS101',
      timestamp: '2025-12-07 09:05',
      reason: 'Face verification failed',
      method: 'FACE',
      location: '95%',
      status: 'pending'
    },
    {
      id: 2,
      student: 'Michael Chen',
      studentId: 'STU12346',
      course: 'CS201',
      timestamp: '2025-12-07 14:12',
      reason: 'GPS unstable',
      method: 'QR',
      location: '62%',
      status: 'pending'
    },
    {
      id: 3,
      student: 'Emma Davis',
      studentId: 'STU12347',
      course: 'CS101',
      timestamp: '2025-12-07 09:08',
      reason: 'Device integrity warning',
      method: 'FACE + QR',
      location: '88%',
      status: 'pending'
    },
    {
      id: 4,
      student: 'David Wilson',
      studentId: 'STU12348',
      course: 'CS201',
      timestamp: '2025-12-07 14:15',
      reason: 'Location mismatch',
      method: 'QR',
      location: '45%',
      status: 'pending'
    },
  ]);

  const handleApprove = (id) => {
    setFlaggedAttendance(prev =>
      prev.map(record =>
        record.id === id ? { ...record, status: 'approved' } : record
      )
    );
  };

  const handleReject = (id) => {
    setFlaggedAttendance(prev =>
      prev.map(record =>
        record.id === id ? { ...record, status: 'rejected' } : record
      )
    );
  };

  const handleUndo = (id) => {
    setFlaggedAttendance(prev =>
      prev.map(record =>
        record.id === id ? { ...record, status: 'pending' } : record
      )
    );
  };

  const handleViewDetails = (id) => {
    console.log('View details:', id);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return { text: 'Approved', color: '#10B981', bgColor: '#D1FAE5' };
      case 'rejected':
        return { text: 'Rejected', color: '#EF4444', bgColor: '#FEE2E2' };
      default:
        return { text: 'Pending', color: '#92400E', bgColor: '#FEF3C7' };
    }
  };

  const renderFlaggedItem = ({ item }) => {
    const statusBadge = getStatusBadge(item.status);
    
    return (
      <View style={styles.flaggedCard}>
        <View style={styles.flaggedHeader}>
          <View style={styles.studentInfo}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {item.student.split(' ').map(n => n[0]).join('')}
              </Text>
            </View>
            <View>
              <Text style={styles.studentName}>{item.student}</Text>
              <Text style={styles.studentId}>{item.studentId}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusBadge.bgColor }]}>
            <Text style={[styles.statusText, { color: statusBadge.color }]}>{statusBadge.text}</Text>
          </View>
        </View>

        <View style={styles.flaggedDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="book-outline" size={16} color="#6B7280" />
            <Text style={styles.detailText}>{item.course}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={16} color="#6B7280" />
            <Text style={styles.detailText}>{item.timestamp}</Text>
          </View>
        </View>

        <View style={styles.reasonContainer}>
          <View style={styles.reasonBadge}>
            <Ionicons name="alert-circle" size={16} color="#DC2626" />
            <Text style={styles.reasonText}>{item.reason}</Text>
          </View>
        </View>

        <View style={styles.flaggedFooter}>
          <View style={styles.methodBadge}>
            <Text style={styles.methodText}>{item.method}</Text>
          </View>
          <View style={styles.locationBadge}>
            <Ionicons name="location" size={14} color="#10B981" />
            <Text style={styles.locationText}>{item.location}</Text>
          </View>
        </View>

        <View style={styles.actionButtons}>
          {item.status === 'pending' ? (
            <>
              <TouchableOpacity 
                style={styles.approveButton}
                onPress={() => handleApprove(item.id)}
              >
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <Text style={styles.approveButtonText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.rejectButton}
                onPress={() => handleReject(item.id)}
              >
                <Ionicons name="close-circle" size={20} color="#EF4444" />
                <Text style={styles.rejectButtonText}>Reject</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity 
              style={styles.undoButton}
              onPress={() => handleUndo(item.id)}
            >
              <Ionicons name="arrow-undo" size={20} color="#5B7FFF" />
              <Text style={styles.undoButtonText}>Undo</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={styles.detailsButton}
            onPress={() => handleViewDetails(item.id)}
          >
            <Ionicons name="eye-outline" size={20} color="#5B7FFF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Flagged Attendance</Text>
          <Text style={styles.headerSubtitle}>Records awaiting manual approval</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{flaggedAttendance.filter(r => r.status === 'pending').length}</Text>
        </View>
      </View>

      {/* Filter Options */}
      <View style={styles.filterSection}>
        <TouchableOpacity style={styles.filterButton}>
          <Ionicons name="funnel-outline" size={18} color="#1F2937" />
          <Text style={styles.filterButtonText}>Filter</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterButton}>
          <Ionicons name="swap-vertical-outline" size={18} color="#1F2937" />
          <Text style={styles.filterButtonText}>Sort</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.selectAllButton}>
          <Ionicons name="checkmark-done" size={18} color="#5B7FFF" />
          <Text style={styles.selectAllText}>Select All</Text>
        </TouchableOpacity>
      </View>

      {/* Flagged List */}
      <FlatList
        data={flaggedAttendance}
        renderItem={renderFlaggedItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
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
  countBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  countText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92400E',
  },
  filterSection: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
  },
  filterButtonText: {
    fontSize: 13,
    color: '#1F2937',
    fontWeight: '500',
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    marginLeft: 'auto',
  },
  selectAllText: {
    fontSize: 13,
    color: '#5B7FFF',
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  flaggedCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  flaggedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#5B7FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
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
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  flaggedDetails: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    color: '#6B7280',
  },
  reasonContainer: {
    marginBottom: 12,
  },
  reasonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
    alignSelf: 'flex-start',
  },
  reasonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  flaggedFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  methodBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  methodText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1E40AF',
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#D1FAE5',
  },
  approveButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10B981',
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
  },
  rejectButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
  },
  detailsButton: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
  },
  undoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
  },
  undoButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5B7FFF',
  },
});

