import React, { useState } from 'react';
import './Attendance.css';
import ExcuseDetailsModal from './ExcuseDetailsModal';

function Attendance() {
  const [activeTab, setActiveTab] = useState('all');
  const [showExcuseModal, setShowExcuseModal] = useState(false);
  const [selectedExcuse, setSelectedExcuse] = useState(null);
  const [flaggedRecords, setFlaggedRecords] = useState([
    {
      id: 1,
      student: 'Sarah Johnson',
      studentId: 'STU12345',
      course: 'CS101',
      courseTitle: 'Introduction to Programming',
      timestamp: '2025-12-07 09:05',
      reason: 'Face verification failed',
      reasonType: 'error',
      method: 'FACE',
      location: '95%',
      status: 'pending'
    },
    {
      id: 2,
      student: 'Michael Chen',
      studentId: 'STU12346',
      course: 'CS201',
      courseTitle: 'Data Structures',
      timestamp: '2025-12-07 14:12',
      reason: 'GPS unstable',
      reasonType: 'warning',
      method: 'QR',
      location: '62%',
      status: 'pending'
    },
    {
      id: 3,
      student: 'Emma Davis',
      studentId: 'STU12347',
      course: 'CS101',
      courseTitle: 'Introduction to Programming',
      timestamp: '2025-12-07 09:08',
      reason: 'Device integrity warning',
      reasonType: 'warning',
      method: 'FACE + QR',
      location: '88%',
      status: 'pending',
      deviceWarning: true
    }
  ]);

  const [excuseRecords, setExcuseRecords] = useState([
    {
      id: 1,
      student: 'Bob Brown',
      studentId: 'STU12002',
      course: 'CS101',
      courseTitle: 'Introduction to Programming',
      classDate: '2025-11-29',
      excuseType: 'health',
      excuseTypeLabel: 'Health (Medical Report)',
      excuseDescription: 'I had a severe headache and visited the doctor. Medical report attached.',
      documents: [
        { name: 'medical_report.pdf', url: '#', type: 'pdf' }
      ],
      submittedAt: '2025-11-29 10:30',
      deadline: '2025-11-30 09:00',
      status: 'pending',
      excuseCount: 2,
    },
    {
      id: 2,
      student: 'Charlie Davis',
      studentId: 'STU12003',
      course: 'CS201',
      courseTitle: 'Data Structures',
      classDate: '2025-11-28',
      excuseType: 'school_activity',
      excuseTypeLabel: 'School Activity',
      excuseDescription: 'I participated in the university basketball tournament.',
      documents: [
        { name: 'tournament_certificate.jpg', url: '#', type: 'image' }
      ],
      submittedAt: '2025-11-28 14:20',
      deadline: '2025-11-29 09:00',
      status: 'pending',
      excuseCount: 1,
    },
    {
      id: 3,
      student: 'Emma Davis',
      studentId: 'STU12347',
      course: 'CS101',
      courseTitle: 'Introduction to Programming',
      classDate: '2025-11-27',
      excuseType: 'family',
      excuseTypeLabel: 'Family Emergency',
      excuseDescription: 'Family emergency - had to attend to urgent family matter.',
      documents: [],
      submittedAt: '2025-11-27 16:45',
      deadline: '2025-11-28 09:00',
      status: 'approved',
      excuseCount: 3,
    },
  ]);

  const tabs = [
    { id: 'all', label: 'All', count: 3 },
    { id: 'pending', label: 'Pending', count: 3 },
    { id: 'approved', label: 'Approved', count: 0 },
    { id: 'rejected', label: 'Rejected', count: 0 }
  ];

  const handleApprove = (id) => {
    setFlaggedRecords(prev => 
      prev.map(record => 
        record.id === id ? { ...record, status: 'approved' } : record
      )
    );
  };

  const handleReject = (id) => {
    setFlaggedRecords(prev => 
      prev.map(record => 
        record.id === id ? { ...record, status: 'rejected' } : record
      )
    );
  };

  const handleUndo = (id) => {
    setFlaggedRecords(prev => 
      prev.map(record => 
        record.id === id ? { ...record, status: 'pending' } : record
      )
    );
  };

  const filteredRecords = flaggedRecords.filter(record => {
    if (activeTab === 'all') return true;
    return record.status === activeTab;
  });

  const handleExcuseApprove = (id) => {
    setExcuseRecords(prev =>
      prev.map(record =>
        record.id === id ? { ...record, status: 'approved' } : record
      )
    );
  };

  const handleExcuseReject = (id, reason) => {
    setExcuseRecords(prev =>
      prev.map(record =>
        record.id === id ? { ...record, status: 'rejected', rejectReason: reason } : record
      )
    );
  };

  const handleViewExcuse = (excuse) => {
    setSelectedExcuse(excuse);
    setShowExcuseModal(true);
  };

  const getTabCounts = () => {
    return {
      all: flaggedRecords.length,
      pending: flaggedRecords.filter(r => r.status === 'pending').length,
      approved: flaggedRecords.filter(r => r.status === 'approved').length,
      rejected: flaggedRecords.filter(r => r.status === 'rejected').length,
      excuses: excuseRecords.filter(r => r.status === 'pending').length
    };
  };

  const tabCounts = getTabCounts();
  const updatedTabs = [
    { id: 'all', label: 'All', count: tabCounts.all },
    { id: 'pending', label: 'Pending', count: tabCounts.pending },
    { id: 'approved', label: 'Approved', count: tabCounts.approved },
    { id: 'rejected', label: 'Rejected', count: tabCounts.rejected },
    { id: 'excuses', label: 'Excuses', count: tabCounts.excuses }
  ];

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('');
  };

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
        {updatedTabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Excuses Tab Content */}
      {activeTab === 'excuses' ? (
        excuseRecords.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <p>No excuse requests found</p>
          </div>
        ) : (
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
                        <div className="student-avatar">{getInitials(excuse.student)}</div>
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
                      <span className="method-badge">{excuse.excuseTypeLabel}</span>
                    </td>
                    <td>
                      <div className="timestamp">{excuse.submittedAt}</div>
                    </td>
                    <td>
                      <span className={`status-badge status-${excuse.status}`}>
                        {excuse.status.charAt(0).toUpperCase() + excuse.status.slice(1)}
                      </span>
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
        )
      ) : filteredRecords.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <p>No flagged records found</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="flagged-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Course</th>
                <th>Timestamp</th>
                <th>Reason</th>
                <th>Method</th>
                <th>Location</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map(record => (
                <tr key={record.id}>
                  <td>
                    <div className="student-cell">
                      <div className="student-avatar">{getInitials(record.student)}</div>
                      <div>
                        <div className="student-name">{record.student}</div>
                        <div className="student-id">{record.studentId}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="course-cell">
                      <div className="course-code">{record.course}</div>
                      <div className="course-title">{record.courseTitle}</div>
                    </div>
                  </td>
                  <td>
                    <div className="timestamp">{record.timestamp}</div>
                  </td>
                  <td>
                    <span className={`reason-badge reason-${record.reasonType}`}>
                      {record.reasonType === 'error' ? '⚠️' : '⚠'} {record.reason}
                    </span>
                    {record.deviceWarning && (
                      <div className="device-warning">⚠️ Device warning</div>
                    )}
                  </td>
                  <td>
                    <span className="method-badge">{record.method}</span>
                  </td>
                  <td>
                    <div className="location-cell">
                      <span className="location-icon">📍</span> {record.location}
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge status-${record.status}`}>
                      {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      {record.status === 'pending' ? (
                        <>
                          <button 
                            className="action-btn approve-btn"
                            onClick={() => handleApprove(record.id)}
                            title="Approve"
                          >
                            ✓
                          </button>
                          <button 
                            className="action-btn reject-btn"
                            onClick={() => handleReject(record.id)}
                            title="Reject"
                          >
                            ✗
                          </button>
                        </>
                      ) : (
                        <button 
                          className="action-btn undo-btn"
                          onClick={() => handleUndo(record.id)}
                          title="Undo"
                        >
                          ↶ Undo
                        </button>
                      )}
                      <button className="action-btn details-btn" title="View Details">
                        👁
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Excuse Details Modal */}
      {showExcuseModal && selectedExcuse && (
        <ExcuseDetailsModal
          excuse={selectedExcuse}
          onClose={() => setShowExcuseModal(false)}
          onApprove={handleExcuseApprove}
          onReject={handleExcuseReject}
        />
      )}
    </div>
  );
}

export default Attendance;

