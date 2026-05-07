import React from 'react';
import { useTranslation } from 'react-i18next';
import { Table } from '../../../../shared/components/ui/Table';
import { Badge } from '../../../../shared/components/ui/Badge';
import './FlaggedAttendanceList.css';

/**
 * Generates initials for avatar fallback rendering.
 */
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
  focusedRecordId = null,
}) => {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="flagged-list-loading">
        <div className="spinner"></div>
        <p>{t('flaggedList.loading')}</p>
      </div>
    );
  }

  const columns = [
    {
      key: 'student',
      label: t('flaggedList.student'),
      render: (value, record) => (
        <div
          className="student-cell"
          data-session-id={String(record.session_id ?? '')}
          data-record-id={String(record.id)}
        >
          <div className="student-avatar">{getInitials(record.studentName)}</div>
          <div>
            <div className={`student-name ${record.id === focusedRecordId ? 'focused-student-name' : ''}`}>
              {record.id === focusedRecordId ? '▶ ' : ''}
              {record.studentName}
            </div>
            <div className="student-id">#{record.studentId}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'courseTitle',
      label: t('flaggedList.course'),
      render: (value, record) => (
        <div className="course-cell">
          <div className="course-code">{record.courseTitle}</div>
        </div>
      ),
    },
    {
      key: 'timestamp',
      label: t('flaggedList.dateTime'),
      render: (value) => <div className="timestamp">{value}</div>,
    },
    {
      key: 'reason',
      label: t('flaggedList.reason'),
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
      label: t('flaggedList.method'),
      render: (value) => <Badge variant="info">{value}</Badge>,
    },
    {
      key: 'location',
      label: t('flaggedList.location'),
      render: (value) => (
        <div className="location-cell">
          {value}
        </div>
      ),
    },
    {
      key: 'status',
      label: t('flaggedList.status'),
      render: (value, record) => {
        if (record.isFlagged) {
          return <Badge variant="warning">{t('flaggedList.flagged')}</Badge>;
        }
        const variant = value === 'present' ? 'approved' : value === 'pending_review' ? 'warning' : 'rejected';
        return <Badge variant={variant}>{t(`records.statuses.${value}`, value)}</Badge>;
      },
    },
    {
      key: 'actions',
      label: t('flaggedList.actions'),
      render: (value, record) => (
        <div className="action-buttons">
          {record.isFlagged ? (
            <>
              <button className="action-btn approve-btn" onClick={() => onApprove(record.id)} title={t('common.approve')}>
                {t('common.approve')}
              </button>
              <button className="action-btn reject-btn" onClick={() => onReject(record.id)} title={t('common.reject')}>
                {t('common.reject')}
              </button>
            </>
          ) : (
            <button className="action-btn undo-btn" onClick={() => onUndo(record.id)} title={t('common.undo')}>
              {t('common.undo')}
            </button>
          )}
          {onViewDetails && (
            <button className="action-btn details-btn" onClick={() => onViewDetails(record)} title={t('common.detail')}>
              {t('common.detail')}
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
      emptyMessage={t('flaggedList.empty')}
    />
  );
};
