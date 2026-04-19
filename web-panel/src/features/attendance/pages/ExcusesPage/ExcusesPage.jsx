import React, { useState, useEffect, useCallback } from 'react';
import { MdCheckCircle, MdCancel, MdRefresh, MdSelectAll } from 'react-icons/md';
import apiClient from '../../../../shared/services/apiClient';
import './ExcusesPage.css';

const STATUS_TR = { pending: 'Bekliyor', approved: 'Onaylandı', rejected: 'Reddedildi' };
const STATUS_CLS = { pending: 'badge-pending', approved: 'badge-approved', rejected: 'badge-rejected' };
const TYPE_TR = { medical: 'Sağlık', family: 'Aile', other: 'Diğer' };

export const ExcusesPage = () => {
  const [excuses, setExcuses] = useState([]);
  const [courses, setCourses] = useState([]);
  const [courseFilter, setCourseFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [message, setMessage] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [excRes, crsRes] = await Promise.allSettled([
        apiClient.get('/excuses/'),
        apiClient.get('/courses/'),
      ]);
      if (excRes.status === 'fulfilled') setExcuses(excRes.value || []);
      if (crsRes.status === 'fulfilled') setCourses(crsRes.value || []);
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
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(e => e.id)));
    }
  };

  const bulkAction = async (status) => {
    if (selected.size === 0) { setMessage('Önce mazeret seçin'); return; }
    setBulkLoading(true); setMessage('');
    try {
      const res = await apiClient.post('/excuses/bulk-review', {
        ids: Array.from(selected),
        status,
      });
      setMessage(`${res.updated} mazeret ${status === 'approved' ? 'onaylandı' : 'reddedildi'}.${res.skipped > 0 ? ` ${res.skipped} atlandı.` : ''}`);
      setSelected(new Set());
      loadData();
    } catch (err) {
      setMessage(err.message || 'İşlem başarısız');
    } finally {
      setBulkLoading(false);
    }
  };

  const singleAction = async (id, status) => {
    try {
      await apiClient.patch(`/excuses/${id}`, { status });
      loadData();
    } catch (err) {
      setMessage(err.message || 'İşlem başarısız');
    }
  };

  return (
    <div className="excuses-page">
      <div className="excuses-header">
        <div>
          <h1 className="page-title">Mazeret Yönetimi</h1>
          <p className="page-subtitle">Öğrenci mazeretlerini onaylayın veya reddedin</p>
        </div>
        <button className="refresh-btn" onClick={loadData}><MdRefresh size={16} style={{ marginRight: 5 }} />Yenile</button>
      </div>

      {message && <div className="excuses-message">{message}</div>}

      {/* Filters */}
      <div className="excuses-filters">
        <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)} className="filter-select">
          <option value="">Tüm Dersler</option>
          {courses.map(c => <option key={c.id} value={String(c.id)}>{c.code} — {c.name}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="filter-select">
          <option value="">Tüm Durumlar</option>
          <option value="pending">Bekliyor</option>
          <option value="approved">Onaylandı</option>
          <option value="rejected">Reddedildi</option>
        </select>
      </div>

      {/* Bulk actions */}
      {filtered.length > 0 && (
        <div className="bulk-actions">
          <button className="bulk-btn select-all" onClick={toggleSelectAll}>
            <MdSelectAll size={16} style={{ marginRight: 4 }} />
            {selected.size === filtered.length ? 'Tümünü Kaldır' : 'Tümünü Seç'}
          </button>
          {selected.size > 0 && (
            <>
              <span className="selected-count">{selected.size} seçili</span>
              <button className="bulk-btn approve" onClick={() => bulkAction('approved')} disabled={bulkLoading}>
                <MdCheckCircle size={16} style={{ marginRight: 4 }} />Toplu Onayla
              </button>
              <button className="bulk-btn reject" onClick={() => bulkAction('rejected')} disabled={bulkLoading}>
                <MdCancel size={16} style={{ marginRight: 4 }} />Toplu Reddet
              </button>
            </>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>Yükleniyor...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>Mazeret bulunamadı</div>
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
                <th>Öğrenci</th>
                <th>Ders</th>
                <th>Tarih</th>
                <th>Tür</th>
                <th>Açıklama</th>
                <th>Durum</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id} className={selected.has(e.id) ? 'row-selected' : ''}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(e.id)}
                      onChange={() => toggleSelect(e.id)}
                    />
                  </td>
                  <td>Öğrenci #{e.student_id}</td>
                  <td>
                    {courses.find(c => c.id === e.course_id)?.code || `#${e.course_id}`}
                  </td>
                  <td>{e.session_date}</td>
                  <td>{TYPE_TR[e.excuse_type] || e.excuse_type}</td>
                  <td className="desc-cell">{e.description || '—'}</td>
                  <td>
                    <span className={`excuse-badge ${STATUS_CLS[e.status] || ''}`}>
                      {STATUS_TR[e.status] || e.status}
                    </span>
                  </td>
                  <td>
                    {e.status === 'pending' && (
                      <div className="action-btns">
                        <button className="act-btn approve" onClick={() => singleAction(e.id, 'approved')}>
                          Onayla
                        </button>
                        <button className="act-btn reject" onClick={() => singleAction(e.id, 'rejected')}>
                          Reddet
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
