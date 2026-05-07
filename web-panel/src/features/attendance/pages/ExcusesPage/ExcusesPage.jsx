import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MdCheckCircle, MdCancel, MdRefresh, MdSelectAll, MdDescription } from 'react-icons/md';
import {
  fetchExcuseRecords,
  approveExcuse,
  rejectExcuse,
} from '../../services/excuseService';
import { ExcuseDetailsModal } from '../../components/ExcuseDetailsModal/ExcuseDetailsModal';
import apiClient from '../../../../shared/services/apiClient';
import './ExcusesPage.css';

const STATUS_CLS = { pending: 'badge-pending', approved: 'badge-approved', rejected: 'badge-rejected' };

export const ExcusesPage = () => {
  const { t } = useTranslation();
  const [excuses,      setExcuses]      = useState([]);
  const [courses,      setCourses]      = useState([]);
  const [courseFilter, setCourseFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected,     setSelected]     = useState(new Set());
  const [loading,      setLoading]      = useState(true);
  const [bulkLoading,  setBulkLoading]  = useState(false);
  const [message,      setMessage]      = useState('');
  const [selectedExcuse, setSelectedExcuse] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [excRes, crsRes] = await Promise.allSettled([
        fetchExcuseRecords(),
        apiClient.get('/courses/'),
      ]);
      if (excRes.status === 'fulfilled' && excRes.value.success) {
        setExcuses(excRes.value.data || []);
      }
      if (crsRes.status === 'fulfilled') {
        setCourses(crsRes.value || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = excuses.filter(e => {
    if (courseFilter && String(e.course_id) !== courseFilter) return false;
    if (statusFilter && e.status !== statusFilter) return false;
    return true;
  });

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected(
      selected.size === filtered.length
        ? new Set()
        : new Set(filtered.map(e => e.id))
    );
  };

  const bulkAction = async (status) => {
    if (selected.size === 0) { setMessage(t('excuses.selectFirst')); return; }
    setBulkLoading(true); setMessage('');
    try {
      const res = await apiClient.post('/excuses/bulk-review', {
        ids: Array.from(selected),
        status,
      });
      setMessage(
        t(status === 'approved' ? 'excuses.bulkApproved' : 'excuses.bulkRejected', { count: res.updated }) +
        (res.skipped > 0 ? ` ${t('excuses.skipped', { count: res.skipped })}` : '')
      );
      setSelected(new Set());
      loadData();
    } catch (err) {
      setMessage(err.message || t('common.actionFailed'));
    } finally {
      setBulkLoading(false);
    }
  };

  const singleAction = async (id, status) => {
    try {
      await apiClient.patch(`/excuses/${id}`, { status });
      setExcuses(prev => prev.map(e => e.id === id ? { ...e, status } : e));
    } catch (err) {
      setMessage(err.message || t('common.actionFailed'));
    }
  };

  const handleModalApprove = async (excuseId) => {
    const result = await approveExcuse(excuseId);
    if (result.success) {
      setExcuses(prev => prev.map(e => e.id === excuseId ? { ...e, status: 'approved' } : e));
    }
    return result;
  };

  const handleModalReject = async (excuseId, reason) => {
    const result = await rejectExcuse(excuseId, reason);
    if (result.success) {
      setExcuses(prev =>
        prev.map(e => e.id === excuseId ? { ...e, status: 'rejected', instructorNotes: reason } : e)
      );
    }
    return result;
  };

  return (
    <div className="excuses-page">
      <div className="excuses-header">
        <div>
          <h1 className="page-title">{t('excuses.title')}</h1>
          <p className="page-subtitle">{t('excuses.subtitle')}</p>
        </div>
        <button className="refresh-btn" onClick={loadData}>
          <MdRefresh size={16} style={{ marginRight: 5 }} />{t('common.refresh')}
        </button>
      </div>

      {message && <div className="excuses-message">{message}</div>}

      {/* Filters */}
      <div className="excuses-filters">
        <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)} className="filter-select">
          <option value="">{t('excuses.allCourses')}</option>
          {courses.map(c => (
            <option key={c.id} value={String(c.id)}>{c.code} — {c.name}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="filter-select">
          <option value="">{t('excuses.allStatuses')}</option>
          <option value="pending">{t('excuses.statusPending')}</option>
          <option value="approved">{t('excuses.statusApproved')}</option>
          <option value="rejected">{t('excuses.statusRejected')}</option>
        </select>
      </div>

      {/* Bulk actions */}
      {filtered.length > 0 && (
        <div className="bulk-actions">
          <button className="bulk-btn select-all" onClick={toggleSelectAll}>
            <MdSelectAll size={16} style={{ marginRight: 4 }} />
            {selected.size === filtered.length ? t('excuses.deselectAll') : t('excuses.selectAll')}
          </button>
          {selected.size > 0 && (
            <>
              <span className="selected-count">{t('excuses.selectedCount', { count: selected.size })}</span>
              <button className="bulk-btn approve" onClick={() => bulkAction('approved')} disabled={bulkLoading}>
                <MdCheckCircle size={16} style={{ marginRight: 4 }} />{t('excuses.bulkApproveBtn')}
              </button>
              <button className="bulk-btn reject" onClick={() => bulkAction('rejected')} disabled={bulkLoading}>
                <MdCancel size={16} style={{ marginRight: 4 }} />{t('excuses.bulkRejectBtn')}
              </button>
            </>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>{t('common.loading')}</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>{t('excuses.notFound')}</div>
      ) : (
        <div className="excuses-table-wrapper">
          <table className="excuses-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>{t('excuses.student')}</th>
                <th>{t('excuses.course')}</th>
                <th>{t('excuses.date')}</th>
                <th>{t('excuses.type')}</th>
                <th>{t('excuses.description')}</th>
                <th>{t('excuses.document')}</th>
                <th>{t('excuses.status')}</th>
                <th>{t('excuses.action')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr
                  key={e.id}
                  className={selected.has(e.id) ? 'row-selected' : ''}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(e.id)}
                      onChange={() => toggleSelect(e.id)}
                    />
                  </td>
                  <td>
                    <div className="student-cell">
                      <span className="student-name">{e.studentName}</span>
                      {e.student_number && (
                        <span className="student-number">{t('excuses.studentNoLabel')}: {e.student_number}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className="course-code">{e.courseTitle}</span>
                  </td>
                  <td>{e.classDate}</td>
                  <td>{t(`excuses.types.${e.excuseType}`, e.excuseType)}</td>
                  <td className="desc-cell">{e.description || '—'}</td>
                  <td>
                    {e.hasDocument ? (
                      <button
                        className="doc-icon-btn"
                        title={t('excuses.viewDocument')}
                        onClick={() => setSelectedExcuse(e)}
                      >
                        <MdDescription size={18} />
                        <span>{t('excuses.hasDocument')}</span>
                      </button>
                    ) : (
                      <span className="no-doc">—</span>
                    )}
                  </td>
                  <td>
                    <span className={`excuse-badge ${STATUS_CLS[e.status] || ''}`}>
                      {t(`excuses.status${e.status.charAt(0).toUpperCase() + e.status.slice(1)}`, e.status)}
                    </span>
                  </td>
                  <td>
                    <div className="action-btns">
                      <button
                        className="act-btn detail"
                        onClick={() => setSelectedExcuse(e)}
                        title={t('excuses.viewDetails')}
                      >
                        {t('common.detail')}
                      </button>
                      {e.status === 'pending' && (
                        <>
                          <button className="act-btn approve" onClick={() => singleAction(e.id, 'approved')}>
                            {t('common.approve')}
                          </button>
                          <button className="act-btn reject" onClick={() => singleAction(e.id, 'rejected')}>
                            {t('common.reject')}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedExcuse && (
        <ExcuseDetailsModal
          excuse={selectedExcuse}
          onClose={() => setSelectedExcuse(null)}
          onApprove={handleModalApprove}
          onReject={handleModalReject}
        />
      )}
    </div>
  );
};
