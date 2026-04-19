import React, { useState, useEffect, useCallback } from 'react';
import { MdRefresh, MdSearch } from 'react-icons/md';
import apiClient from '../../shared/services/apiClient';
import './AuditLogPage.css';

export const AuditLogPage = () => {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const loadLogs = useCallback(async (p = 1, action = '') => {
    setLoading(true);
    try {
      const params = { page: p, page_size: 50 };
      if (action) params.action = action;
      const res = await apiClient.get('/audit-logs/', { params });
      setLogs(res.logs || []);
      setTotal(res.total || 0);
      setPage(res.page || 1);
      setTotalPages(res.total_pages || 1);
    } catch (err) {
      console.error('Audit log error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLogs(page, actionFilter); }, [loadLogs, page, actionFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadLogs(1, actionFilter);
  };

  return (
    <div className="audit-log-page">
      <div className="audit-header">
        <div>
          <h1 className="page-title">Sistem Kayıtları (Audit Log)</h1>
          <p className="page-subtitle">Kim, ne zaman, ne yaptı — toplam {total} kayıt</p>
        </div>
        <button className="audit-refresh-btn" onClick={() => loadLogs(page, actionFilter)}>
          <MdRefresh size={16} style={{ marginRight: 5 }} />Yenile
        </button>
      </div>

      <form className="audit-search" onSubmit={handleSearch}>
        <input
          type="text"
          placeholder="İşlem adı filtrele (örn: login, attendance)"
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          className="audit-search-input"
        />
        <button type="submit" className="audit-search-btn">
          <MdSearch size={16} />
        </button>
      </form>

      {loading ? (
        <div className="audit-loading">Yükleniyor...</div>
      ) : logs.length === 0 ? (
        <div className="audit-empty">Kayıt bulunamadı</div>
      ) : (
        <>
          <div className="audit-table-wrapper">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Tarih / Saat</th>
                  <th>İşlem</th>
                  <th>Aktör ID</th>
                  <th>Rol</th>
                  <th>Kaynak</th>
                  <th>Kaynak ID</th>
                  <th>IP</th>
                  <th>Detay</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td className="log-id">{log.id}</td>
                    <td className="log-date">
                      {log.created_at ? new Date(log.created_at).toLocaleString('tr-TR') : '—'}
                    </td>
                    <td>
                      <span className={`action-badge ${log.action?.includes('fail') || log.action?.includes('error') ? 'action-error' : 'action-ok'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td>{log.actor_id ?? '—'}</td>
                    <td>{log.actor_role ?? '—'}</td>
                    <td>{log.resource ?? '—'}</td>
                    <td>{log.resource_id ?? '—'}</td>
                    <td>{log.ip_address ?? '—'}</td>
                    <td className="log-detail">
                      {log.detail ? (
                        <details>
                          <summary>Göster</summary>
                          <pre>{JSON.stringify(log.detail, null, 2)}</pre>
                        </details>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="audit-pagination">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="page-btn"
              >
                ‹ Önceki
              </button>
              <span className="page-info">{page} / {totalPages}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="page-btn"
              >
                Sonraki ›
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
