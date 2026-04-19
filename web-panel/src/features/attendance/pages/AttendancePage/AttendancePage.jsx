import React, { useState, useMemo, useCallback } from 'react';
import { useAttendance } from '../../hooks/useAttendance';
import { useExcuses } from '../../hooks/useExcuses';
import { FlaggedAttendanceList } from '../../components/FlaggedAttendanceList';
import { Badge } from '../../../../shared/components/ui/Badge';
import { ExcuseDetailsModal } from '../../components/ExcuseDetailsModal';
import './AttendancePage.css';

const STATUS_LABELS = { pending: 'Bekliyor', approved: 'Onaylandı', rejected: 'Reddedildi' };

export const AttendancePage = () => {
  const {
    filteredRecords, loading, activeTab, setActiveTab, tabCounts, approve, reject, undo,
  } = useAttendance();

  const {
    excuseRecords, pendingCount: excusePendingCount, approve: approveExcuse, reject: rejectExcuse,
  } = useExcuses();

  const [showExcuseModal, setShowExcuseModal] = useState(false);
  const [selectedExcuse, setSelectedExcuse] = useState(null);

  const tabs = useMemo(() => [
    { id: 'all', label: 'Tümü', count: tabCounts.all },
    { id: 'flagged', label: 'Bayraklı', count: tabCounts.flagged },
    { id: 'resolved', label: 'Çözülenler', count: tabCounts.resolved },
    { id: 'excuses', label: 'Mazeretler', count: excusePendingCount },
  ], [tabCounts.all, tabCounts.flagged, tabCounts.resolved, excusePendingCount]);

  const handleApprove = useCallback(async (id) => { await approve(id); }, [approve]);
  const handleReject = useCallback(async (id) => { await reject(id); }, [reject]);
  const handleUndo = useCallback(async (id) => { await undo(id); }, [undo]);

  const handleExcuseApprove = useCallback(async (id) => {
    try {
      const result = await approveExcuse(id);
      return result?.success ? { success: true } : { success: false, error: result?.error || 'Mazeret onaylanamadı' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, [approveExcuse]);

  const handleExcuseReject = useCallback(async (id, reason) => {
    try {
      const result = await rejectExcuse(id, reason);
      return result?.success ? { success: true } : { success: false, error: result?.error || 'Mazeret reddedilemedi' };
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
          <p>Mazeret talebi bulunamadı</p>
        </div>
      );
    }

    return (
      <div className="table-wrapper">
        <table className="flagged-table">
          <thead>
            <tr>
              <th>Öğrenci</th>
              <th>Ders</th>
              <th>Tarih</th>
              <th>Mazeret Türü</th>
              <th>Gönderilme</th>
              <th>Durum</th>
              <th>İşlem</th>
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
                    {STATUS_LABELS[excuse.status] || excuse.status}
                  </Badge>
                </td>
                <td>
                  <div className="action-buttons">
                    <button className="action-btn details-btn" onClick={() => handleViewExcuse(excuse)} title="Detay">
                      Detay
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
          <h2>Yoklama Yönetimi</h2>
          <p className="subtitle">Bayraklı kayıtları ve mazeretleri inceleyin</p>
        </div>
        <div className="pending-badge">
          {tabCounts.flagged} Bekleyen İnceleme
        </div>
      </div>

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
          records={filteredRecords}
          onApprove={handleApprove}
          onReject={handleReject}
          onUndo={handleUndo}
          onViewDetails={(record) => handleViewExcuse(record)}
          loading={loading}
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
