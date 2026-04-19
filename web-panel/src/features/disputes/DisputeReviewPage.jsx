import React, { useState, useEffect, useCallback } from 'react';
import { MdCheckCircle, MdCancel, MdRefresh } from 'react-icons/md';
import apiClient from '../../shared/services/apiClient';
import './DisputeReviewPage.css';

const STATUS_TR = { pending: 'Bekliyor', approved: 'Onaylandı', rejected: 'Reddedildi' };
const STATUS_CLS = { pending: 'badge-pending', approved: 'badge-approved', rejected: 'badge-rejected' };

export const DisputeReviewPage = () => {
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

  const review = async (id, status) => {
    try {
      await apiClient.patch(`/disputes/${id}`, {
        status,
        instructor_notes: notes[id] || null,
      });
      setMessage(`İtiraz ${status === 'approved' ? 'onaylandı' : 'reddedildi'}.`);
      loadDisputes();
    } catch (err) {
      setMessage(err.message || 'İşlem başarısız');
    }
  };

  const pending = disputes.filter(d => d.status === 'pending');
  const resolved = disputes.filter(d => d.status !== 'pending');

  return (
    <div className="dispute-review-page">
      <div className="dr-header">
        <div>
          <h1 className="page-title">Yoklama İtirazları</h1>
          <p className="page-subtitle">
            {pending.length} bekleyen, {resolved.length} çözümlendi
          </p>
        </div>
        <button className="dr-refresh-btn" onClick={loadDisputes}>
          <MdRefresh size={16} style={{ marginRight: 5 }} />Yenile
        </button>
      </div>

      {message && <div className="dr-message">{message}</div>}

      {loading ? (
        <div className="dr-loading">Yükleniyor...</div>
      ) : disputes.length === 0 ? (
        <div className="dr-empty">Henüz itiraz yok</div>
      ) : (
        <>
          {pending.length > 0 && (
            <>
              <h2 className="dr-section-title">Bekleyen İtirazlar</h2>
              {pending.map(d => (
                <div key={d.id} className="dispute-card">
                  <div className="dispute-meta">
                    <span className="dispute-course">{d.course_code || `#${d.course_id}`}</span>
                    <span className="dispute-session">Oturum #{d.session_id}</span>
                    <span className="dispute-student">{d.student_name || `Öğrenci #${d.student_id}`}</span>
                    <span className="dispute-date">{d.created_at ? new Date(d.created_at).toLocaleDateString('tr-TR') : ''}</span>
                  </div>
                  <p className="dispute-reason">{d.reason}</p>
                  <div className="dispute-actions">
                    <textarea
                      className="dispute-notes"
                      placeholder="Hoca notu (opsiyonel)"
                      rows={2}
                      value={notes[d.id] || ''}
                      onChange={e => setNotes(n => ({ ...n, [d.id]: e.target.value }))}
                    />
                    <div className="dispute-btns">
                      <button className="dr-btn approve" onClick={() => review(d.id, 'approved')}>
                        <MdCheckCircle size={15} style={{ marginRight: 4 }} />Onayla
                      </button>
                      <button className="dr-btn reject" onClick={() => review(d.id, 'rejected')}>
                        <MdCancel size={15} style={{ marginRight: 4 }} />Reddet
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {resolved.length > 0 && (
            <>
              <h2 className="dr-section-title" style={{ marginTop: 28 }}>Çözümlenenler</h2>
              <table className="dr-table">
                <thead>
                  <tr>
                    <th>Öğrenci</th>
                    <th>Ders</th>
                    <th>Oturum</th>
                    <th>Durum</th>
                    <th>Not</th>
                    <th>Tarih</th>
                  </tr>
                </thead>
                <tbody>
                  {resolved.map(d => (
                    <tr key={d.id}>
                      <td>{d.student_name || `#${d.student_id}`}</td>
                      <td>{d.course_code || `#${d.course_id}`}</td>
                      <td>#{d.session_id}</td>
                      <td><span className={`dr-badge ${STATUS_CLS[d.status] || ''}`}>{STATUS_TR[d.status] || d.status}</span></td>
                      <td>{d.instructor_notes || '—'}</td>
                      <td>{d.created_at ? new Date(d.created_at).toLocaleDateString('tr-TR') : '—'}</td>
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
