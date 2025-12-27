import React, { useState, useMemo, useCallback } from 'react';
import { useAttendance } from '../../hooks/useAttendance';
import { useExcuses } from '../../hooks/useExcuses';
import { FlaggedAttendanceList } from '../../components/FlaggedAttendanceList';
import { Badge } from '../../../../shared/components/ui/Badge';
import { ExcuseDetailsModal } from '../../components/ExcuseDetailsModal';
import './AttendancePage.css';

export const AttendancePage = () => {
  const {
    filteredRecords,
    loading,
    activeTab,
    setActiveTab,
    tabCounts,
    approve,
    reject,
    undo
  } = useAttendance();

  const {
    excuseRecords,
    pendingCount: excusePendingCount,
    approve: approveExcuse,
    reject: rejectExcuse
  } = useExcuses();

  const [showExcuseModal, setShowExcuseModal] = useState(false);
  const [selectedExcuse, setSelectedExcuse] = useState(null);

  // Memoize tabs to prevent unnecessary re-renders
  const tabs = useMemo(() => [
    { id: 'all', label: 'All', count: tabCounts.all },
    { id: 'pending', label: 'Pending', count: tabCounts.pending },
    { id: 'approved', label: 'Approved', count: tabCounts.approved },
    { id: 'rejected', label: 'Rejected', count: tabCounts.rejected },
    { id: 'excuses', label: 'Excuses', count: excusePendingCount }
  ], [tabCounts.all, tabCounts.pending, tabCounts.approved, tabCounts.rejected, excusePendingCount]);

  // Memoize handlers to prevent unnecessary re-renders
  const handleApprove = useCallback(async (id) => {
    await approve(id);
  }, [approve]);

  const handleReject = useCallback(async (id) => {
    await reject(id);
  }, [reject]);

  const handleUndo = useCallback(async (id) => {
    await undo(id);
  }, [undo]);

  const handleExcuseApprove = useCallback(async (id) => {
    console.log('🟢 handleExcuseApprove called with ID:', id);
    try {
      const result = await approveExcuse(id);
      console.log('🟢 approveExcuse result:', result);
      
      if (result && result.success) {
        console.log('✅ Excuse approved successfully');
        // State will be updated by useExcuses hook automatically
        return { success: true };
      } else {
        console.error('❌ Approve failed:', result);
        return { success: false, error: result?.error || 'Failed to approve excuse' };
      }
    } catch (error) {
      console.error('❌ Error in handleExcuseApprove:', error);
      return { success: false, error: error.message || 'An error occurred' };
    }
  }, [approveExcuse]);

  const handleExcuseReject = useCallback(async (id, reason) => {
    console.log('🔴 handleExcuseReject called with ID:', id, 'Reason:', reason);
    try {
      const result = await rejectExcuse(id, reason);
      console.log('🔴 rejectExcuse result:', result);
      
      if (result && result.success) {
        console.log('✅ Excuse rejected successfully');
        // State will be updated by useExcuses hook automatically
        return { success: true };
      } else {
        console.error('❌ Reject failed:', result);
        return { success: false, error: result?.error || 'Failed to reject excuse' };
      }
    } catch (error) {
      console.error('❌ Error in handleExcuseReject:', error);
      return { success: false, error: error.message || 'An error occurred' };
    }
  }, [rejectExcuse]);

  const handleViewExcuse = useCallback((excuse) => {
    setSelectedExcuse(excuse);
    setShowExcuseModal(true);
  }, []);

  // Memoize excuse table to prevent unnecessary re-renders
  const renderExcuseTable = useMemo(() => {
    if (excuseRecords.length === 0) {
      return (
        <div className="empty-state">
          <div className="empty-icon">📝</div>
          <p>No excuse requests found</p>
        </div>
      );
    }

    // For excuses, we'll use a simple table structure
    // In future, we can create ExcuseList component similar to FlaggedAttendanceList
    return (
      <div className="table-wrapper">
        <table className="flagged-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Course</th>
              <th>Class Date</th>
              <th>Excuse Type</th>
              <th>Submitted</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {excuseRecords.map(excuse => (
              <tr key={excuse.id}>
                <td>
                  <div className="student-cell">
                    <div className="student-avatar">
                      {excuse.student.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div className="student-name">{excuse.student}</div>
                      <div className="student-id">{excuse.studentId}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="course-cell">
                    <div className="course-code">{excuse.course}</div>
                    <div className="course-title">{excuse.courseTitle}</div>
                  </div>
                </td>
                <td>
                  <div className="timestamp">{excuse.classDate}</div>
                </td>
                <td>
                  <Badge variant="info">{excuse.excuseTypeLabel}</Badge>
                </td>
                <td>
                  <div className="timestamp">{excuse.submittedAt}</div>
                </td>
                <td>
                  <Badge 
                    variant={
                      excuse.status === 'pending' ? 'pending' : 
                      excuse.status === 'approved' ? 'approved' : 
                      'rejected'
                    }
                  >
                    {excuse.status.charAt(0).toUpperCase() + excuse.status.slice(1)}
                  </Badge>
                </td>
                <td>
                  <div className="action-buttons">
                    <button 
                      className="action-btn details-btn"
                      onClick={() => handleViewExcuse(excuse)}
                      title="View Details"
                    >
                      👁
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }, [excuseRecords, handleViewExcuse]);

  return (
    <div className="attendance-container">
      {/* Header */}
      <div className="attendance-header">
        <div>
          <h2>Flagged Attendance Records</h2>
          <p className="subtitle">Review and approve attendance records that need manual verification</p>
        </div>
        <div className="pending-badge">
          {tabCounts.pending} Pending Review
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'excuses' ? (
        renderExcuseTable
      ) : (
        <FlaggedAttendanceList
          records={filteredRecords}
          onApprove={handleApprove}
          onReject={handleReject}
          onUndo={handleUndo}
          loading={loading}
        />
      )}

      {/* Excuse Details Modal */}
      {showExcuseModal && selectedExcuse && (
        <ExcuseDetailsModal
          excuse={selectedExcuse}
          onClose={() => {
            console.log('🔵 Modal close requested');
            setShowExcuseModal(false);
            setSelectedExcuse(null);
          }}
          onApprove={handleExcuseApprove}
          onReject={handleExcuseReject}
        />
      )}
    </div>
  );
};

