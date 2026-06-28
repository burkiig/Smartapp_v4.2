import React from 'react';
import { useTranslation } from 'react-i18next';
import { Table } from '../../../../shared/components/ui/Table';
import { Badge } from '../../../../shared/components/ui/Badge';
import './FlaggedAttendanceList.css';

const LEGACY_REASON_CODES = {
  'Mazeret incelemede': 'excuse_pending',
  'Mazeret İncelemede': 'excuse_pending',
};

const LEGACY_REASON_LABELS = {
  excuse_pending: { en: 'Excuse under review', tr: 'Mazeret incelemede' },
};

const getReasonLabel = (t, i18n, record) => {
  const raw = record.flagReason;
  if (!raw) return record.reason || '—';

  const code = LEGACY_REASON_CODES[raw] || raw;
  const legacy = LEGACY_REASON_LABELS[code];
  if (legacy) {
    return legacy[i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'tr'];
  }

  return t(`attendancePage.recordDetail.reasonCodes.${code}`, record.reason || raw);
};

const getMethodLabel = (t, record) => {
  const steps = record.verificationSteps;
  if (!steps) return record.method;
  const parts = [];
  if (steps.location_ok !== false) parts.push(t('attendancePage.recordDetail.methodParts.gps'));
  if (steps.face_ok !== false) parts.push(t('attendancePage.recordDetail.methodParts.face'));
  if (steps.qr_ok !== false) parts.push(t('attendancePage.recordDetail.methodParts.qr'));
  return parts.length ? parts.join(' + ') : t('attendancePage.recordDetail.methodParts.qr');
};

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
  const { t, i18n } = useTranslation();

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
      label: t('flaggedList.columns.student'),
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
      label: t('flaggedList.columns.course'),
      render: (value, record) => (
        <div className="course-cell">
          <div className="course-code">{record.courseTitle}</div>
        </div>
      ),
    },
    {
      key: 'timestamp',
      label: t('flaggedList.columns.datetime'),
      render: (value) => <div className="timestamp">{value}</div>,
    },
    {
      key: 'reason',
      label: t('flaggedList.columns.reason'),
      render: (value, record) => (
        <Badge
          variant={record.flagReason === 'duplicate_attendance' ? 'error' : 'warning'}
        >
          {getReasonLabel(t, i18n, record)}
        </Badge>
      ),
    },
    {
      key: 'method',
      label: t('flaggedList.columns.method'),
      render: (value, record) => (
        <Badge variant="info">{getMethodLabel(t, record)}</Badge>
      ),
    },
    {
      key: 'location',
      label: t('flaggedList.columns.location'),
      render: (value) => (
        <div className="location-cell">
          {value}
        </div>
      ),
    },
    {
      key: 'status',
      label: t('flaggedList.columns.status'),
      render: (value, record) => {
        if (record.isFlagged) {
          return <Badge variant="warning">{t('flaggedList.statuses.flagged')}</Badge>;
        }
        const variant = value === 'present' ? 'approved' : value === 'pending_review' ? 'warning' : 'rejected';
        return <Badge variant={variant}>{t(`records.statuses.${value}`, value)}</Badge>;
      },
    },
    {
      key: 'actions',
      label: t('flaggedList.columns.actions'),
      style: { minWidth: '380px', whiteSpace: 'nowrap' },
      render: (value, record) => (
        <div className="flagged-list-actions">
          <button
            className="flagged-list-action-btn flagged-list-approve-btn"
            onClick={() => onApprove(record.id)}
            title={t('common.approve')}
            disabled={record.status === 'present' && !record.isFlagged}
          >
            {t('common.approve')}
          </button>
          <button
            className="flagged-list-action-btn flagged-list-reject-btn"
            onClick={() => onReject(record.id)}
            title={t('common.reject')}
            disabled={record.status === 'absent' && !record.isFlagged}
          >
            {t('common.reject')}
          </button>
          <button
            className={`flagged-list-action-btn flagged-list-undo-btn ${record.isFlagged ? 'flagged-list-undo-placeholder' : ''}`}
            onClick={() => !record.isFlagged && onUndo(record)}
            title={t('common.undo')}
            disabled={record.isFlagged}
            aria-hidden={record.isFlagged}
            tabIndex={record.isFlagged ? -1 : 0}
          >
            {t('common.undo')}
          </button>
          {onViewDetails && (
            <button
              className="flagged-list-action-btn flagged-list-details-btn"
              onClick={() => onViewDetails(record)}
              title={t('common.detail')}
            >
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
