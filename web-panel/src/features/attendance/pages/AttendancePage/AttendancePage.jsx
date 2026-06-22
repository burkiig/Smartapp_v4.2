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
  const { t, i18n } = useTranslation();
  const {
    flaggedRecords, filteredRecords, loading, error: attendanceError, activeTab, setActiveTab, tabCounts, approve, reject, undo,
  } = useAttendance();

  const {
    excuseRecords, pendingCount: excusePendingCount, approve: approveExcuse, reject: rejectExcuse,
  } = useExcuses();

  const [showExcuseModal, setShowExcuseModal] = useState(false);
  const [selectedExcuse, setSelectedExcuse] = useState(null);
  // Yoklama kaydı detay modalı (flagged listeden açılır — excuse modal değil)
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [focusedRecordId, setFocusedRecordId] = useState(null);
  const triageSessionId = triageContext?.sessionId ? String(triageContext.sessionId) : null;
  const isFlaggedTriage = Boolean(triageContext?.filter === 'flagged' && triageSessionId);
  const [triageEnabled, setTriageEnabled] = useState(isFlaggedTriage);
  const isTriageScoped = triageEnabled && isFlaggedTriage && activeTab === 'flagged';

  const tabs = useMemo(() => [
    { id: 'all',      label: t('attendancePage.tabs.all'),      count: tabCounts.all      },
    { id: 'flagged',  label: t('attendancePage.tabs.flagged'),  count: tabCounts.flagged  },
    { id: 'resolved', label: t('attendancePage.tabs.resolved'), count: tabCounts.resolved },
    { id: 'excuses',  label: t('attendancePage.tabs.excuses'),  count: excusePendingCount },
  ], [tabCounts.all, tabCounts.flagged, tabCounts.resolved, excusePendingCount, t]);

  useEffect(() => {
    if (!isFlaggedTriage || !triageEnabled) return;
    setActiveTab('flagged');
  }, [isFlaggedTriage, setActiveTab, triageEnabled]);

  const triageRecords = useMemo(() => {
    if (!isTriageScoped) return filteredRecords;
    return flaggedRecords.filter(
      (record) => record.isFlagged && String(record.session_id) === triageSessionId
    );
  }, [filteredRecords, flaggedRecords, isTriageScoped, triageSessionId]);

  useEffect(() => {
    if (!isTriageScoped) return;
    if (triageRecords.length === 0) {
      setFocusedRecordId(null);
      return;
    }
    const currentStillVisible = triageRecords.some((record) => record.id === focusedRecordId);
    if (!currentStillVisible) {
      setFocusedRecordId(triageRecords[0].id);
    }
  }, [focusedRecordId, isTriageScoped, triageRecords]);

  useEffect(() => {
    if (!isTriageScoped || !focusedRecordId) return;
    const rowEl = document.querySelector(`.student-cell[data-record-id="${focusedRecordId}"]`);
    if (rowEl) {
      rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [focusedRecordId, isTriageScoped]);

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
    const nextId = isTriageScoped ? getNextRecordId(id) : null;
    const result = await approve(id);
    if (result?.success && isTriageScoped) {
      setFocusedRecordId(nextId);
    }
  }, [approve, getNextRecordId, isTriageScoped]);

  /**
   * Rejects a flagged record and focuses next pending one.
   */
  const handleReject = useCallback(async (id) => {
    const nextId = isTriageScoped ? getNextRecordId(id) : null;
    const result = await reject(id);
    if (result?.success && isTriageScoped) {
      setFocusedRecordId(nextId);
    }
  }, [getNextRecordId, isTriageScoped, reject]);

  const handleUndo = useCallback(async (id) => { await undo(id); }, [undo]);

  const handleExcuseApprove = useCallback(async (id) => {
    try {
      const result = await approveExcuse(id);
      return result?.success ? { success: true } : { success: false, error: result?.error || t('attendancePage.errorApproveExcuse') };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, [approveExcuse, t]);

  const handleExcuseReject = useCallback(async (id, reason) => {
    try {
      const result = await rejectExcuse(id, reason);
      return result?.success ? { success: true } : { success: false, error: result?.error || t('attendancePage.errorRejectExcuse') };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, [rejectExcuse, t]);

  const handleViewExcuse = useCallback((excuse) => {
    setSelectedExcuse(excuse);
    setShowExcuseModal(true);
  }, []);

  // Flagged yoklama kaydı detay — excuse modal değil, ayrı basit modal
  const handleViewRecord = useCallback((record) => {
    setSelectedRecord(record);
    setShowRecordModal(true);
  }, []);

  const getInitials = (name) => {
    if (!name || name.startsWith('Öğrenci #')) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getRecordStatusLabel = useCallback((status) => (
    t(`flaggedList.statuses.${status}`, status || '—')
  ), [t]);

  const getRecordReasonLabel = useCallback((reasonCode) => {
    if (!reasonCode) return '—';
    return t(`attendancePage.recordDetail.reasonCodes.${reasonCode}`, reasonCode);
  }, [t]);

  const getRecordMethodLabel = useCallback((record) => {
    const steps = record?.verificationSteps || {};
    const parts = [];
    if (steps?.location_ok !== false) parts.push(t('attendancePage.recordDetail.methodParts.gps'));
    if (steps?.face_ok !== false) parts.push(t('attendancePage.recordDetail.methodParts.face'));
    if (steps?.qr_ok !== false) parts.push(t('attendancePage.recordDetail.methodParts.qr'));
    return parts.length > 0 ? parts.join(' + ') : t('attendancePage.recordDetail.methodParts.qr');
  }, [t]);

  const getRecordLocationLabel = useCallback((record) => {
    const steps = record?.verificationSteps || {};
    if (!steps || Object.keys(steps).length === 0) return '—';
    if (steps.fake_gps_detected) {
      const acc = steps.gps_accuracy_m != null ? ` (±${Math.round(steps.gps_accuracy_m)}m)` : '';
      return `${t('attendancePage.recordDetail.locationStates.fakeGps')}${acc}`;
    }
    if (steps.suspicious_accuracy) {
      const acc = steps.gps_accuracy_m != null ? ` (±${Math.round(steps.gps_accuracy_m)}m)` : '';
      return `${t('attendancePage.recordDetail.locationStates.suspiciousGps')}${acc}`;
    }
    if (steps.location_skipped) return t('attendancePage.recordDetail.locationStates.notAvailable');
    if (steps.location_distance_m != null) return `${Math.round(steps.location_distance_m)} m`;
    return '—';
  }, [t]);

  const formatRecordDateTime = useCallback((record) => {
    if (!record?.markedAt) return record?.timestamp || '—';
    const locale = i18n.resolvedLanguage?.startsWith('tr') ? 'tr-TR' : 'en-US';
    try {
      return new Date(record.markedAt).toLocaleString(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return record?.timestamp || '—';
    }
  }, [i18n.resolvedLanguage]);

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
  }, [excuseRecords, handleViewExcuse, t]);

  const handleTabChange = useCallback((tabId) => {
    if (triageEnabled && tabId !== 'flagged') {
      // Once user leaves triage view, show full lists again.
      setTriageEnabled(false);
      setFocusedRecordId(null);
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('filter');
        url.searchParams.delete('session_id');
        url.searchParams.set('tab', 'attendance');
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      }
    }
    setActiveTab(tabId);
  }, [setActiveTab, triageEnabled]);

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

      {attendanceError && (
        <div className="error-banner" role="alert">
          {attendanceError}
        </div>
      )}

      {isTriageScoped && (
        <div className="triage-context-banner" role="status" aria-live="polite">
          {t('attendancePage.triageBanner', { sessionId: triageSessionId })}
        </div>
      )}

      <div className="tabs-container">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => handleTabChange(tab.id)}
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
          onViewDetails={handleViewRecord}
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

      {showRecordModal && selectedRecord && (
        <div className="modal-overlay" onClick={() => setShowRecordModal(false)}>
          <div className="modal-container record-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('attendancePage.recordDetail.title')}</h3>
              <button className="modal-close" onClick={() => setShowRecordModal(false)}>✕</button>
            </div>
            <div className="modal-body record-detail-body">
              <div className="record-detail-grid">
                <div className="record-detail-row">
                  <span className="record-detail-label">{t('attendancePage.recordDetail.student')}</span>
                  <span className="record-detail-value">{selectedRecord.studentName} (#{selectedRecord.studentId})</span>
                </div>
                <div className="record-detail-row">
                  <span className="record-detail-label">{t('attendancePage.recordDetail.course')}</span>
                  <span className="record-detail-value">{selectedRecord.courseTitle}</span>
                </div>
                <div className="record-detail-row">
                  <span className="record-detail-label">{t('attendancePage.recordDetail.date')}</span>
                  <span className="record-detail-value">{formatRecordDateTime(selectedRecord)}</span>
                </div>
                <div className="record-detail-row">
                  <span className="record-detail-label">{t('attendancePage.recordDetail.status')}</span>
                  <span className="record-detail-value record-status-pill">
                    {getRecordStatusLabel(selectedRecord.status)}
                  </span>
                </div>
                <div className="record-detail-row">
                  <span className="record-detail-label">{t('attendancePage.recordDetail.flagReason')}</span>
                  <span className="record-detail-value">
                    {getRecordReasonLabel(selectedRecord.flagReason)}
                  </span>
                </div>
                <div className="record-detail-row">
                  <span className="record-detail-label">{t('attendancePage.recordDetail.method')}</span>
                  <span className="record-detail-value">{getRecordMethodLabel(selectedRecord)}</span>
                </div>
                <div className="record-detail-row">
                  <span className="record-detail-label">{t('attendancePage.recordDetail.location')}</span>
                  <span className="record-detail-value">{getRecordLocationLabel(selectedRecord)}</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowRecordModal(false)}>
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
