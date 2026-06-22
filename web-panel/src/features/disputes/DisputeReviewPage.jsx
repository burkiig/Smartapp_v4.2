import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MdCheckCircle, MdCancel, MdRefresh, MdUndo } from 'react-icons/md';
import apiClient from '../../shared/services/apiClient';
import { formatLocaleDate } from '../../shared/utils/localeFormat';
import './DisputeReviewPage.css';

const STATUS_CLS = { pending: 'badge-pending', approved: 'badge-approved', rejected: 'badge-rejected' };

export const DisputeReviewPage = () => {
  const { t, i18n } = useTranslation();
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState({});
  const [message, setMessage] = useState('');

  const loadDisputes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/disputes/');
      setDisputes(res || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDisputes(); }, [loadDisputes]);

  const review = async (id, status, noteOverride) => {
    try {
      await apiClient.patch(`/disputes/${id}`, {
        status,
        instructor_notes: noteOverride ?? notes[id] ?? null,
      });
      const statusMessageKey = status === 'approved'
        ? 'disputes.approved'
        : status === 'rejected'
          ? 'disputes.rejected'
          : 'common.saved';
      setMessage(t(statusMessageKey));
      loadDisputes();
    } catch (err) {
      setMessage(err.message || t('common.actionFailed'));
    }
  };

  const pending = disputes.filter(d => d.status === 'pending');
  const resolved = disputes.filter(d => d.status !== 'pending');

  return (
    <div className="dispute-review-page">
      <div className="dr-header">
        <div>
          <h1 className="page-title">{t('disputes.title')}</h1>
          <p className="page-subtitle">
            {t('disputes.subtitle', { pending: pending.length, resolved: resolved.length })}
          </p>
        </div>
        <button className="dr-refresh-btn" onClick={loadDisputes}>
          <MdRefresh size={16} style={{ marginRight: 5 }} />{t('common.refresh')}
        </button>
      </div>

      {message && <div className="dr-message">{message}</div>}

      {loading ? (
        <div className="dr-loading">{t('common.loading')}</div>
      ) : disputes.length === 0 ? (
        <div className="dr-empty">{t('disputes.noDisputes')}</div>
      ) : (
        <>
          {pending.length > 0 && (
            <>
              <h2 className="dr-section-title">{t('disputes.pendingTitle')}</h2>
              {pending.map(d => (
                <div key={d.id} className="dispute-card">
                  <div className="dispute-meta">
                    <span className="dispute-course">{d.course_code || `#${d.course_id}`}</span>
                    <span className="dispute-session">{t('disputes.sessionNo', { id: d.session_id })}</span>
                    <span className="dispute-student">{d.student_name || t('disputes.studentHash', { id: d.student_id })}</span>
                    <span className="dispute-date">{formatLocaleDate(d.created_at, i18n.resolvedLanguage)}</span>
                  </div>
                  <p className="dispute-reason">{d.reason}</p>
                  <div className="dispute-actions">
                    <textarea
                      className="dispute-notes"
                      placeholder={t('disputes.instructorNotePlaceholder')}
                      rows={2}
                      value={notes[d.id] || ''}
                      onChange={e => setNotes(n => ({ ...n, [d.id]: e.target.value }))}
                    />
                    <div className="dispute-btns">
                      <button className="dr-btn approve" onClick={() => review(d.id, 'approved')}>
                        <MdCheckCircle size={15} style={{ marginRight: 4 }} />{t('common.approve')}
                      </button>
                      <button className="dr-btn reject" onClick={() => review(d.id, 'rejected')}>
                        <MdCancel size={15} style={{ marginRight: 4 }} />{t('common.reject')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {resolved.length > 0 && (
            <>
              <h2 className="dr-section-title" style={{ marginTop: 28 }}>{t('disputes.resolvedTitle')}</h2>
              <table className="dr-table">
                <thead>
                  <tr>
                    <th>{t('disputes.student')}</th>
                    <th>{t('disputes.course')}</th>
                    <th>{t('disputes.session')}</th>
                    <th>{t('disputes.status')}</th>
                    <th>{t('disputes.note')}</th>
                    <th>{t('disputes.date')}</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {resolved.map(d => (
                    <tr key={d.id}>
                      <td>{d.student_name || `#${d.student_id}`}</td>
                      <td>{d.course_code || `#${d.course_id}`}</td>
                      <td>#{d.session_id}</td>
                      <td><span className={`dr-badge ${STATUS_CLS[d.status] || ''}`}>{t(`disputes.statusLabels.${d.status}`, d.status)}</span></td>
                      <td>
                        <textarea
                          className="dispute-notes dispute-notes-compact"
                          placeholder={t('disputes.instructorNotePlaceholder')}
                          rows={2}
                          value={notes[d.id] ?? d.instructor_notes ?? ''}
                          onChange={e => setNotes(n => ({ ...n, [d.id]: e.target.value }))}
                        />
                      </td>
                      <td>{formatLocaleDate(d.created_at, i18n.resolvedLanguage)}</td>
                      <td>
                        <div className="dispute-btns">
                          <button
                            className="dr-btn approve"
                            onClick={() => review(d.id, 'approved', notes[d.id] ?? d.instructor_notes ?? null)}
                            disabled={d.status === 'approved'}
                            title={t('common.approve')}
                          >
                            <MdCheckCircle size={15} style={{ marginRight: 4 }} />{t('common.approve')}
                          </button>
                          <button
                            className="dr-btn reject"
                            onClick={() => review(d.id, 'rejected', notes[d.id] ?? d.instructor_notes ?? null)}
                            disabled={d.status === 'rejected'}
                            title={t('common.reject')}
                          >
                            <MdCancel size={15} style={{ marginRight: 4 }} />{t('common.reject')}
                          </button>
                          <button
                            className="dr-btn undo"
                            onClick={() => review(d.id, 'pending', notes[d.id] ?? d.instructor_notes ?? null)}
                            disabled={d.status === 'pending'}
                            title={t('common.undo')}
                          >
                            <MdUndo size={15} style={{ marginRight: 4 }} />{t('common.undo')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </div>
  );
};
