import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAttendance } from '../../hooks/useAttendance';
import { useExcuses } from '../../hooks/useExcuses';
import { FlaggedAttendanceList } from '../../components/FlaggedAttendanceList';
import { Badge } from '../../../../shared/components/ui/Badge';
import { ExcuseDetailsModal } from '../../components/ExcuseDetailsModal';
import './AttendancePage.css';

/**
 * Attendance review page for instructors.
 * Supports deep-link triage context from push notifications.
 */
export const AttendancePage = ({ triageContext = null }) => {
  const { t } = useTranslation();
  const {
    flaggedRecords, filteredRecords, loading, activeTab, setActiveTab, tabCounts, approve, reject, undo,
  } = useAttendance();

  const {
    excuseRecords, pendingCount: excusePendingCount, approve: approveExcuse, reject: rejectExcuse,
  } = useExcuses();

  const [showExcuseModal, setShowExcuseModal] = useState(false);
  const [selectedExcuse, setSelectedExcuse] = useState(null);
  const [focusedRecordId, setFocusedRecordId] = useState(null);
  const triageSessionId = triageContext?.sessionId ? String(triageContext.sessionId) : null;
  const isFlaggedTriage = Boolean(triageContext?.filter === 'flagged' && triageSessionId);

  const tabs = useMemo(() => [
    { id: 'all',      label: t('attendancePage.tabs.all'),      count: tabCounts.all      },
    { id: 'flagged',  label: t('attendancePage.tabs.flagged'),  count: tabCounts.flagged  },
    { id: 'resolved', label: t('attendancePage.tabs.resolved'), count: tabCounts.resolved },
    { id: 'excuses',  label: t('attendancePage.tabs.excuses'),  count: excusePendingCount },
  ], [tabCounts.all, tabCounts.flagged, tabCounts.resolved, excusePendingCount, t]);

  useEffect(() => {
    if (!isFlaggedTriage) return;
    setActiveTab('flagged');
  }, [isFlaggedTriage, setActiveTab]);

  const triageRecords = useMemo(() => {
    if (!isFlaggedTriage) return filteredRecords;
    return flaggedRecords.filter(
      (record) => record.isFlagged && String(record.session_id) === triageSessionId
    );
  }, [filteredRecords, flaggedRecords, isFlaggedTriage, triageSessionId]);

  useEffect(() => {
    if (!isFlaggedTriage) return;
    if (triageRecords.length === 0) {
      setFocusedRecordId(null);
      return;
    }
    const currentStillVisible = triageRecords.some((record) => record.id === focusedRecordId);
    if (!currentStillVisible) {
      setFocusedRecordId(triageRecords[0].id);
    }
  }, [focusedRecordId, isFlaggedTriage, triageRecords]);

  useEffect(() => {
    if (!isFlaggedTriage || !focusedRecordId) return;
    const rowEl = document.querySelector(`.student-cell[data-record-id="${focusedRecordId}"]`);
    if (rowEl) {
      rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [focusedRecordId, isFlaggedTriage]);

  /**
   * Returns next flagged record id for auto-advance.
   */
  const getNextRecordId = useCallback((currentId) => {
    const index = triageRecords.findIndex((record) => record.id === currentId);
    if (index === -1) return triageRecords[0]?.id ?? null;
    if (index >= triageRecords.length - 1) return null;
    return triageRecords[index + 1]?.id ?? null;
  }, [triageRecords]);

  /**
   * Approves a flagged record and focuses next pending one.
   */
  const handleApprove = useCallback(async (id) => {
    const nextId = isFlaggedTriage ? getNextRecordId(id) : null;
    const result = await approve(id);
    if (result?.success && isFlaggedTriage) {
      setFocusedRecordId(nextId);
    }
  }, [approve, getNextRecordId, isFlaggedTriage]);

  /**
   * Rejects a flagged record and focuses next pending one.
   */
  const handleReject = useCallback(async (id) => {
    const nextId = isFlaggedTriage ? getNextRecordId(id) : null;
    const result = await reject(id);
    if (result?.success && isFlaggedTriage) {
      setFocusedRecordId(nextId);
    }
  }, [getNextRecordId, isFlaggedTriage, reject]);

  const handleUndo = useCallback(async (id) => { await undo(id); }, [undo]);

  const handleExcuseApprove = useCallback(async (id) => {
    try {
      const result = await approveExcuse(id);
      return result?.success ? { success: true } : { success: false, error: result?.error || t('attendancePage.errorApproveExcuse') };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, [approveExcuse]);

  const handleExcuseReject = useCallback(async (id, reason) => {
    try {
      const result = await rejectExcuse(id, reason);
      return result?.success ? { success: true } : { success: false, error: result?.error || t('attendancePage.errorRejectExcuse') };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, [rejectExcuse]);

  const handleViewExcuse = useCallback((excuse) => {
    setSelectedExcuse(excuse);
    setShowExcuseModal(true);
  }, []);

  const getInitials = (name) => {
    if (!name || name.startsWith('Öğrenci #')) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const renderExcuseTable = useMemo(() => {
    if (excuseRecords.length === 0) {
      return (
        <div className="empty-state">
          <p>{t('attendancePage.excuses.empty')}</p>
        </div>
      );
    }

    return (
      <div className="table-wrapper">
        <table className="flagged-table">
          <thead>
            <tr>
              <th>{t('attendancePage.excuses.headers.student')}</th>
              <th>{t('attendancePage.excuses.headers.course')}</th>
              <th>{t('attendancePage.excuses.headers.date')}</th>
              <th>{t('attendancePage.excuses.headers.type')}</th>
              <th>{t('attendancePage.excuses.headers.submitted')}</th>
              <th>{t('attendancePage.excuses.headers.status')}</th>
              <th>{t('attendancePage.excuses.headers.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {excuseRecords.map(excuse => (
              <tr key={excuse.id}>
                <td>
                  <div className="student-cell">
                    <div className="student-avatar">{getInitials(excuse.studentName)}</div>
                    <div>
                      <div className="student-name">{excuse.studentName}</div>
                      <div className="student-id">#{excuse.studentId}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="course-cell">
                    <div className="course-code">{excuse.courseTitle}</div>
                  </div>
                </td>
                <td><div className="timestamp">{excuse.classDate}</div></td>
                <td><Badge variant="info">{excuse.excuseTypeLabel}</Badge></td>
                <td><div className="timestamp">{excuse.submittedAt}</div></td>
                <td>
                  <Badge variant={excuse.status === 'pending' ? 'pending' : excuse.status === 'approved' ? 'approved' : 'rejected'}>
                    {t(`attendancePage.excuses.statuses.${excuse.status}`, excuse.status)}
                  </Badge>
                </td>
                <td>
                  <div className="action-buttons">
                    <button className="action-btn details-btn" onClick={() => handleViewExcuse(excuse)} title={t('attendancePage.excuses.detailsBtn')}>
                      {t('attendancePage.excuses.detailsBtn')}
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
      <div className="attendance-header">
        <div>
          <h2>{t('attendancePage.title')}</h2>
          <p className="subtitle">{t('attendancePage.subtitle')}</p>
        </div>
        <div className="pending-badge">
          {tabCounts.flagged} {t('attendancePage.pendingReview')}
        </div>
      </div>

      {isFlaggedTriage && (
        <div className="triage-context-banner" role="status" aria-live="polite">
          {t('attendancePage.triageBanner', { sessionId: triageSessionId })}
        </div>
      )}

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

      {activeTab === 'excuses' ? (
        renderExcuseTable
      ) : (
        <FlaggedAttendanceList
          records={triageRecords}
          onApprove={handleApprove}
          onReject={handleReject}
          onUndo={handleUndo}
          onViewDetails={(record) => handleViewExcuse(record)}
          loading={loading}
          focusedRecordId={focusedRecordId}
        />
      )}

      {showExcuseModal && selectedExcuse && (
        <ExcuseDetailsModal
          excuse={selectedExcuse}
          onClose={() => { setShowExcuseModal(false); setSelectedExcuse(null); }}
          onApprove={handleExcuseApprove}
          onReject={handleExcuseReject}
        />
      )}
    </div>
  );
};
