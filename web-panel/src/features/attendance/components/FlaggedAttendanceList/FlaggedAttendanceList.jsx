import React from 'react';
import { Table } from '../../../../shared/components/ui/Table';
import { Badge } from '../../../../shared/components/ui/Badge';
import './FlaggedAttendanceList.css';

const getInitials = (name) => {
  return name.split(' ').map(n => n[0]).join('');
};

export const FlaggedAttendanceList = ({ 
  records, 
  onApprove, 
  onReject, 
  onUndo,
  loading = false 
}) => {
  if (loading) {
    return (
      <div className="flagged-list-loading">
        <div className="spinner"></div>
        <p>Loading records...</p>
      </div>
    );
  }

  const columns = [
    {
      key: 'student',
      label: 'Student',
      render: (value, record) => (
        <div className="student-cell">
          <div className="student-avatar">{getInitials(record.student)}</div>
          <div>
            <div className="student-name">{record.student}</div>
            <div className="student-id">{record.studentId}</div>
          </div>
        </div>
      )
    },
    {
      key: 'course',
      label: 'Course',
      render: (value, record) => (
        <div className="course-cell">
          <div className="course-code">{record.course}</div>
          <div className="course-title">{record.courseTitle}</div>
        </div>
      )
    },
    {
      key: 'timestamp',
      label: 'Timestamp',
      render: (value) => <div className="timestamp">{value}</div>
    },
    {
      key: 'reason',
      label: 'Reason',
      render: (value, record) => (
        <div>
          <Badge 
            variant={record.reasonType === 'error' ? 'error' : 'warning'}
            icon={record.reasonType === 'error' ? '⚠️' : '⚠'}
          >
            {record.reason}
          </Badge>
          {record.deviceWarning && (
            <div className="device-warning">⚠️ Device warning</div>
          )}
        </div>
      )
    },
    {
      key: 'method',
      label: 'Method',
      render: (value) => (
        <Badge variant="info">{value}</Badge>
      )
    },
    {
      key: 'location',
      label: 'Location',
      render: (value) => (
        <div className="location-cell">
          <span className="location-icon">📍</span> {value}
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => (
        <Badge variant={value === 'pending' ? 'pending' : value === 'approved' ? 'approved' : 'rejected'}>
          {value.charAt(0).toUpperCase() + value.slice(1)}
        </Badge>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (value, record) => (
        <div className="action-buttons">
          {record.status === 'pending' ? (
            <>
              <button 
                className="action-btn approve-btn"
                onClick={() => onApprove(record.id)}
                title="Approve"
              >
                ✓
              </button>
              <button 
                className="action-btn reject-btn"
                onClick={() => onReject(record.id)}
                title="Reject"
              >
                ✗
              </button>
            </>
          ) : (
            <button 
              className="action-btn undo-btn"
              onClick={() => onUndo(record.id)}
              title="Undo"
            >
              ↶ Undo
            </button>
          )}
          <button className="action-btn details-btn" title="View Details">
            👁
          </button>
        </div>
      )
    }
  ];

  return (
    <Table
      columns={columns}
      data={records}
      emptyMessage="No flagged records found"
      emptyIcon="📋"
    />
  );
};

