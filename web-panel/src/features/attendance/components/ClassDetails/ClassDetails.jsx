import React, { useState, useMemo } from 'react';
import { useClassDetails } from '../../hooks/useClassDetails';
import { Badge } from '../../../../shared/components/ui/Badge';
import './ClassDetails.css';

export const ClassDetails = ({ classData, onBack }) => {
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showManualAttendance, setShowManualAttendance] = useState(false);
  const [cancelReason, setCancelReason] = useState('Instructor unavailable');
  
  // Initialize students state with mock data
  const [students, setStudents] = useState([
    { id: 'STU12001', name: 'Alice Anderson', status: 'present', avatar: 'AA' },
    { id: 'STU12002', name: 'Bob Brown', status: 'present', avatar: 'BB' },
    { id: 'STU12003', name: 'Charlie Davis', status: 'absent', avatar: 'CD' },
    { id: 'STU12004', name: 'Diana Evans', status: 'absent', avatar: 'DE', flagged: true },
    { id: 'STU12005', name: 'Ethan Foster', status: 'present', avatar: 'EF' },
    { id: 'STU12006', name: 'Fiona Garcia', status: 'present', avatar: 'FG' },
    { id: 'STU12007', name: 'George Harris', status: 'present', avatar: 'GH' },
    { id: 'STU12008', name: 'Hannah Irving', status: 'absent', avatar: 'HI' },
    { id: 'STU12009', name: 'Ian Johnson', status: 'present', avatar: 'IJ' },
    { id: 'STU12010', name: 'Julie King', status: 'present', avatar: 'JK' }
  ]);

  const { markAttendance: markAttendanceHook, cancelClass: cancelClassHook } = useClassDetails();

  // Mock data
  const classInfo = {
    code: 'CS101',
    title: 'Introduction to Programming',
    room: 'Room 401',
    time: '09:00 - 10:30',
    status: 'Completed',
    totalStudents: 45,
    present: 42,
    absent: 2,
    flagged: 1
  };

  const timeline = [
    { time: '08:55', event: 'Auto attendance session opened', type: 'info' },
    { time: '09:15', event: 'Auto attendance session closed', type: 'info' },
    { time: '09:20', event: '1 student flagged for manual review', type: 'warning' }
  ];

  const sessionInfo = {
    autoAttendance: true,
    duration: '80 minutes',
    attendanceWindow: '08:55 - 09:15',
    location: 'Room 301',
    systemNote: 'The system automatically opened and closed the attendance session. No manual intervention was required.'
  };

  // Calculate stats from students state
  const stats = useMemo(() => {
    const present = students.filter(s => s.status === 'present').length;
    const absent = students.filter(s => s.status === 'absent').length;
    const flagged = students.filter(s => s.flagged).length;
    return { present, absent, flagged, total: students.length };
  }, [students]);

  const handleCancelClass = async () => {
    const result = await cancelClassHook(cancelReason);
    if (result.success) {
      alert(`Class cancelled. Reason: ${cancelReason}`);
      setShowCancelModal(false);
    }
  };

  const handleMarkAttendance = async (studentId, newStatus) => {
    if (!newStatus) return; // Don't update if no status selected
    
    // Update local state immediately for reactive UI
    setStudents(prev => 
      prev.map(student => 
        student.id === studentId ? { ...student, status: newStatus } : student
      )
    );
    
    // Call hook to persist to backend
    await markAttendanceHook(studentId, newStatus);
  };

  if (showManualAttendance) {
    return (
      <div className="class-details">
        <div className="details-header">
          <button className="back-btn" onClick={() => setShowManualAttendance(false)}>
            ← Back to Class Details
          </button>
          <h1 className="details-title">Manual Attendance</h1>
          <p className="details-subtitle">{classInfo.code} - {classInfo.title}</p>
        </div>

        <div className="manual-stats">
          <div className="manual-stat">
            <div className="manual-stat-label">Total Students</div>
            <div className="manual-stat-value">{stats.total}</div>
          </div>
          <div className="manual-stat">
            <div className="manual-stat-label">Present</div>
            <div className="manual-stat-value green">{stats.present}</div>
          </div>
          <div className="manual-stat">
            <div className="manual-stat-label">Absent</div>
            <div className="manual-stat-value red">{stats.absent}</div>
          </div>
        </div>

        <div className="search-box">
          <input 
            type="text" 
            placeholder="Search by name or student number..."
            className="search-input"
          />
        </div>

        <div className="students-table-container">
          <table className="students-table">
            <thead>
              <tr>
                <th><input type="checkbox" /></th>
                <th>Student Number</th>
                <th>Name</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {students.map(student => (
                <tr key={student.id}>
                  <td><input type="checkbox" /></td>
                  <td>{student.id}</td>
                  <td>
                    <div className="student-cell">
                      <div className="student-avatar-small">{student.avatar}</div>
                      <span>{student.name}</span>
                    </div>
                  </td>
                  <td>
                    <Badge 
                      variant={
                        student.status === 'present' ? 'success' : 
                        student.status === 'excused' ? 'info' : 
                        'error'
                      }
                    >
                      {student.status === 'present' ? '✓ Present' : 
                       student.status === 'excused' ? '📝 Excused' : 
                       '○ Absent'}
                    </Badge>
                    {student.flagged && (
                      <Badge variant="warning" size="small" style={{ marginLeft: '8px' }}>
                        • Flagged
                      </Badge>
                    )}
                  </td>
                  <td>
                    <select 
                      className="action-select"
                      value={student.status}
                      onChange={(e) => handleMarkAttendance(student.id, e.target.value)}
                    >
                      <option value="present">Mark Present</option>
                      <option value="absent">Mark Absent</option>
                      <option value="excused">Mark Excused</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="save-section">
          <button className="save-btn">💾 Save Changes</button>
        </div>
      </div>
    );
  }

  return (
    <div className="class-details">
      <div className="details-header">
        <div className="header-top">
          <button className="back-btn" onClick={onBack}>
            ← Back to Dashboard
          </button>
          <div className="header-actions">
            <button className="action-btn secondary" onClick={() => setShowManualAttendance(true)}>
              📝 Manual Attendance
            </button>
            <button className="action-btn secondary">
              📥 Download Report
            </button>
            <button className="action-btn danger" onClick={() => setShowCancelModal(true)}>
              ✕ Cancel Session
            </button>
          </div>
        </div>
        <div className="header-title-section">
          <h1 className="details-title">{classInfo.code} – {classInfo.title}</h1>
          <div className="details-meta">
            <span className="meta-item">📍 {classInfo.room}</span>
            <span className="meta-divider">•</span>
            <span className="meta-item">🕐 {classInfo.time}</span>
            <span className="meta-divider">•</span>
            <span className="meta-status-completed">✓ {classInfo.status}</span>
          </div>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-box">
          <div className="stat-icon blue">👥</div>
          <div className="stat-info">
            <div className="stat-value">{classInfo.totalStudents}</div>
            <div className="stat-label">Total Students</div>
          </div>
        </div>

        <div className="stat-box">
          <div className="stat-icon green">✓</div>
          <div className="stat-info">
            <div className="stat-value">{classInfo.present}</div>
            <div className="stat-label">Present</div>
            <div className="stat-percentage">{Math.round((classInfo.present / classInfo.totalStudents) * 100)}% attendance</div>
          </div>
        </div>

        <div className="stat-box">
          <div className="stat-icon gray">○</div>
          <div className="stat-info">
            <div className="stat-value">{classInfo.absent}</div>
            <div className="stat-label">Absent</div>
          </div>
        </div>

        <div className="stat-box">
          <div className="stat-icon yellow">⚠</div>
          <div className="stat-info">
            <div className="stat-value">{classInfo.flagged}</div>
            <div className="stat-label">Flagged</div>
            <div className="stat-link">Need review</div>
          </div>
        </div>
      </div>

      <div className="content-row">
        <div className="timeline-section">
          <h2 className="section-title">Attendance Timeline</h2>
          <div className="timeline">
            {timeline.map((item, index) => (
              <div key={index} className={`timeline-item ${item.type}`}>
                <div className="timeline-icon">
                  {item.type === 'warning' ? '⚠' : 'ℹ'}
                </div>
                <div className="timeline-content">
                  <div className="timeline-time">{item.time}</div>
                  <div className="timeline-event">{item.event}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="info-section">
          <h2 className="section-title">Session Information</h2>
          <div className="info-grid">
            <div className="info-item">
              <div className="info-label">Auto Attendance</div>
              <div className="info-value">
                <span className="enabled-badge">✓ Enabled</span>
              </div>
            </div>

            <div className="info-item">
              <div className="info-label">Session Duration</div>
              <div className="info-value">{sessionInfo.duration}</div>
            </div>

            <div className="info-item">
              <div className="info-label">Attendance Window</div>
              <div className="info-value">{sessionInfo.attendanceWindow}</div>
            </div>

            <div className="info-item">
              <div className="info-label">Location</div>
              <div className="info-value">{sessionInfo.location}</div>
            </div>
          </div>

          <div className="system-note">
            <div className="note-title">System Note</div>
            <div className="note-content">{sessionInfo.systemNote}</div>
          </div>
        </div>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="modal-overlay" onClick={() => setShowCancelModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Cancel Class Session?</h3>
            <p className="modal-text">
              This will cancel today's class session. Students will be notified and attendance will not be taken.
            </p>
            
            <div className="form-group">
              <label className="form-label">Reason for cancellation</label>
              <select 
                className="form-select"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              >
                <option>Instructor unavailable</option>
                <option>Holiday</option>
                <option>Campus closure</option>
                <option>Other</option>
              </select>
            </div>

            <div className="modal-actions">
              <button className="modal-btn secondary" onClick={() => setShowCancelModal(false)}>
                Keep Class
              </button>
              <button className="modal-btn danger" onClick={handleCancelClass}>
                Cancel Class
              </button>
            </div>

            <p className="modal-note">Note: Manual attendance changes will be logged for transparency.</p>
          </div>
        </div>
      )}
    </div>
  );
};

