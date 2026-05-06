import React, { useState, useEffect, useCallback } from 'react';
import { MdRefresh, MdSearch, MdFace, MdList, MdWarning, MdCheckCircle } from 'react-icons/md';
import apiClient from '../../shared/services/apiClient';
import './AuditLogPage.css';

// ─── Face Failures Sub-Panel ────────────────────────────────────────────────

function FaceFailuresPanel() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays]       = useState(30);
  const [minFail, setMinFail] = useState(2);

  const load = useCallback(async (d = days, m = minFail) => {
    setLoading(true);
    try {
      const res = await apiClient.get('/audit-logs/face-failures', {
        params: { days: d, min_failures: m },
      });
      setData(res);
    } catch (err) {
      console.error('Face failures error:', err);
    } finally {
      setLoading(false);
    }
  }, [days, minFail]);

  useEffect(() => { load(days, minFail); }, []);

  const handleApply = () => load(days, minFail);

  const riskLevel = (failRate) => {
    if (failRate >= 75) return 'risk-high';
    if (failRate >= 40) return 'risk-mid';
    return 'risk-low';
  };

  const riskLabel = (failRate) => {
    if (failRate >= 75) return 'Yüksek Risk';
    if (failRate >= 40) return 'Orta Risk';
    return 'Düşük Risk';
  };

  return (
    <div className="face-failures-panel">
      {/* Filters */}
      <div className="ff-filters">
        <div className="ff-filter-group">
          <label className="ff-label">Son</label>
          <select
            className="ff-select"
            value={days}
            onChange={e => setDays(Number(e.target.value))}
          >
            <option value={7}>7 gün</option>
            <option value={14}>14 gün</option>
            <option value={30}>30 gün</option>
            <option value={90}>90 gün</option>
          </select>
        </div>
        <div className="ff-filter-group">
          <label className="ff-label">Min. başarısız</label>
          <select
            className="ff-select"
            value={minFail}
            onChange={e => setMinFail(Number(e.target.value))}
          >
            <option value={1}>1+</option>
            <option value={2}>2+</option>
            <option value={5}>5+</option>
            <option value={10}>10+</option>
          </select>
        </div>
        <button className="audit-search-btn" style={{ alignSelf: 'flex-end' }} onClick={handleApply}>
          <MdSearch size={16} style={{ marginRight: 4 }} />Uygula
        </button>
        <button className="audit-refresh-btn" style={{ alignSelf: 'flex-end' }} onClick={handleApply}>
          <MdRefresh size={16} style={{ marginRight: 4 }} />Yenile
        </button>
      </div>

      {loading ? (
        <div className="audit-loading">Yükleniyor...</div>
      ) : !data || data.total === 0 ? (
        <div className="ff-empty">
          <MdCheckCircle size={40} color="#10b981" />
          <p>Son {data?.days ?? days} günde sorunlu yüz kaydı tespit edilmedi.</p>
        </div>
      ) : (
        <>
          <p className="ff-summary">
            Son <strong>{data.days} gün</strong> içinde{' '}
            <strong>{data.total} öğrenci</strong> yüz doğrulamasında
            {' '}{minFail}+ başarısız deneme yaşadı.
            Kayıt fotoğrafı yenilenmesi önerilir.
          </p>

          <div className="ff-grid">
            {data.users.map(u => (
              <div key={u.user_id} className={`ff-card ${riskLevel(u.fail_rate)}`}>
                <div className="ff-card-header">
                  <div className="ff-avatar">
                    {u.name?.charAt(0)?.toUpperCase() ?? '?'}
                  </div>
                  <div className="ff-card-info">
                    <span className="ff-name">{u.name}</span>
                    <span className="ff-sub">
                      {u.student_number ? `#${u.student_number} · ` : ''}{u.username}
                    </span>
                  </div>
                  <span className={`ff-risk-badge ${riskLevel(u.fail_rate)}`}>
                    {riskLabel(u.fail_rate)}
                  </span>
                </div>

                <div className="ff-stats">
                  <div className="ff-stat">
                    <span className="ff-stat-val ff-stat-fail">{u.fail_count}</span>
                    <span className="ff-stat-lbl">Başarısız</span>
                  </div>
                  <div className="ff-stat">
                    <span className="ff-stat-val ff-stat-ok">{u.success_count}</span>
                    <span className="ff-stat-lbl">Başarılı</span>
                  </div>
                  <div className="ff-stat">
                    <span className="ff-stat-val">{u.fail_rate}%</span>
                    <span className="ff-stat-lbl">Hata Oranı</span>
                  </div>
                  <div className="ff-stat">
                    <span className="ff-stat-val">
                      {u.avg_confidence != null ? u.avg_confidence.toFixed(3) : '—'}
                    </span>
                    <span className="ff-stat-lbl">Ort. Benzerlik</span>
                  </div>
                </div>

                <div className="ff-footer">
                  <span className="ff-footer-item">
                    <MdWarning size={13} style={{ color: '#f59e0b', marginRight: 3 }} />
                    Son hata:{' '}
                    {u.last_fail_at
                      ? new Date(u.last_fail_at).toLocaleString('tr-TR')
                      : '—'}
                  </span>
                  <span className="ff-action-hint">
                    → Yüz kaydını yenile
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main AuditLogPage ───────────────────────────────────────────────────────

export const AuditLogPage = () => {
  const [activeTab, setActiveTab] = useState('logs'); // 'logs' | 'face-failures'

  // ── Log list state ──────────────────────────────────────────────────────
  const [logs, setLogs]             = useState([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading]       = useState(true);

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

  useEffect(() => {
    if (activeTab === 'logs') loadLogs(page, actionFilter);
  }, [activeTab, loadLogs, page, actionFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadLogs(1, actionFilter);
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="audit-log-page">
      {/* Tab bar */}
      <div className="audit-tabs">
        <button
          className={`audit-tab ${activeTab === 'logs' ? 'audit-tab-active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          <MdList size={16} style={{ marginRight: 6 }} />
          Sistem Kayıtları
        </button>
        <button
          className={`audit-tab ${activeTab === 'face-failures' ? 'audit-tab-active' : ''}`}
          onClick={() => setActiveTab('face-failures')}
        >
          <MdFace size={16} style={{ marginRight: 6 }} />
          Yüz Sorunları
        </button>
      </div>

      {/* ── Tab: System logs ─────────────────────────────────────────────── */}
      {activeTab === 'logs' && (
        <>
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
        </>
      )}

      {/* ── Tab: Face failures ───────────────────────────────────────────── */}
      {activeTab === 'face-failures' && (
        <>
          <div className="audit-header">
            <div>
              <h1 className="page-title">Yüz Doğrulama Sorunları</h1>
              <p className="page-subtitle">
                Yüz tanımada sürekli başarısız olan öğrenciler — kayıt fotoğrafı yenilenebilir
              </p>
            </div>
          </div>
          <FaceFailuresPanel />
        </>
      )}
    </div>
  );
};
