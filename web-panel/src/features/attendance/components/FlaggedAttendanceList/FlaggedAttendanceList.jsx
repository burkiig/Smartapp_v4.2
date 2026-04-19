import React, { useState } from 'react';
import { Table } from '../../../../shared/components/ui/Table';
import { Badge } from '../../../../shared/components/ui/Badge';
import './FlaggedAttendanceList.css';

const getInitials = (name) => {
  if (!name || name.startsWith('Öğrenci #')) return '??';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

export const FlaggedAttendanceList = ({
  records,
  onApprove,
  onReject,
  onUndo,
  onViewDetails,
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="flagged-list-loading">
        <div className="spinner"></div>
        <p>Kayıtlar yükleniyor...</p>
      </div>
    );
  }

  const columns = [
    {
      key: 'student',
      label: 'Öğrenci',
      render: (value, record) => (
        <div className="student-cell">
          <div className="student-avatar">{getInitials(record.studentName)}</div>
          <div>
            <div className="student-name">{record.studentName}</div>
            <div className="student-id">#{record.studentId}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'courseTitle',
      label: 'Ders',
      render: (value, record) => (
        <div className="course-cell">
          <div className="course-code">{record.courseTitle}</div>
        </div>
      ),
    },
    {
      key: 'timestamp',
      label: 'Tarih / Saat',
      render: (value) => <div className="timestamp">{value}</div>,
    },
    {
      key: 'reason',
      label: 'Sebep',
      render: (value, record) => (
        <Badge
          variant={record.reasonType === 'error' ? 'error' : 'warning'}
        >
          {record.reason}
        </Badge>
      ),
    },
    {
      key: 'method',
      label: 'Yöntem',
      render: (value) => <Badge variant="info">{value}</Badge>,
    },
    {
      key: 'location',
      label: 'Konum',
      render: (value) => (
        <div className="location-cell">
          {value}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Durum',
      render: (value, record) => {
        if (record.isFlagged) {
          return <Badge variant="warning">Bayraklı</Badge>;
        }
        const statusLabels = {
          present: 'Mevcut',
          absent: 'Devamsız',
          excused: 'Mazeretli',
          pending_review: 'İncelemede',
        };
        const variant = value === 'present' ? 'approved' : value === 'pending_review' ? 'warning' : 'rejected';
        return <Badge variant={variant}>{statusLabels[value] || value}</Badge>;
      },
    },
    {
      key: 'actions',
      label: 'İşlemler',
      render: (value, record) => (
        <div className="action-buttons">
          {record.isFlagged ? (
            <>
              <button className="action-btn approve-btn" onClick={() => onApprove(record.id)} title="Onayla">
                Onayla
              </button>
              <button className="action-btn reject-btn" onClick={() => onReject(record.id)} title="Reddet">
                Reddet
              </button>
            </>
          ) : (
            <button className="action-btn undo-btn" onClick={() => onUndo(record.id)} title="Geri Al">
              Geri Al
            </button>
          )}
          {onViewDetails && (
            <button className="action-btn details-btn" onClick={() => onViewDetails(record)} title="Detay">
              Detay
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      data={records}
      emptyMessage="Bayraklı kayıt bulunamadı"
    />
  );
};
