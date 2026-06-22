import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MdRefresh, MdSearch, MdFace, MdList, MdWarning, MdCheckCircle } from 'react-icons/md';
import apiClient from '../../shared/services/apiClient';
import { formatLocaleDateTime } from '../../shared/utils/localeFormat';
import './AuditLogPage.css';

// ─── Face Failures Sub-Panel ────────────────────────────────────────────────

function FaceFailuresPanel() {
  const { t, i18n } = useTranslation();
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

  // Explicitly track filter values here for hook dependency clarity.
  useEffect(() => { load(days, minFail); }, [load, days, minFail]);

  const handleApply = () => load(days, minFail);

  const riskLevel = (failRate) => {
    if (failRate >= 75) return 'risk-high';
    if (failRate >= 40) return 'risk-mid';
    return 'risk-low';
  };

  const riskLabel = (failRate) => {
    if (failRate >= 75) return t('audit.riskHigh');
    if (failRate >= 40) return t('audit.riskMid');
    return t('audit.riskLow');
  };

  return (
    <div className="face-failures-panel">
      {/* Filters */}
      <div className="ff-filters">
        <div className="ff-filter-group">
          <label className="ff-label">{t('audit.last')}</label>
          <select
            className="ff-select"
            value={days}
            onChange={e => setDays(Number(e.target.value))}
          >
            <option value={7}>{t('audit.days', { count: 7 })}</option>
            <option value={14}>{t('audit.days', { count: 14 })}</option>
            <option value={30}>{t('audit.days', { count: 30 })}</option>
            <option value={90}>{t('audit.days', { count: 90 })}</option>
          </select>
        </div>
        <div className="ff-filter-group">
          <label className="ff-label">{t('audit.minFail')}</label>
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
          <MdSearch size={16} style={{ marginRight: 4 }} />{t('common.apply')}
        </button>
        <button className="audit-refresh-btn" style={{ alignSelf: 'flex-end' }} onClick={handleApply}>
          <MdRefresh size={16} style={{ marginRight: 4 }} />{t('common.refresh')}
        </button>
      </div>

      {loading ? (
        <div className="audit-loading">{t('common.loading')}</div>
      ) : !data || data.total === 0 ? (
        <div className="ff-empty">
          <MdCheckCircle size={40} color="#10b981" />
          <p>{t('audit.noFaceIssues', { days: data?.days ?? days })}</p>
        </div>
      ) : (
        <>
          <p className="ff-summary">
            {t('audit.faceFailSummary', { days: data.days, total: data.total, minFail })}
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
                    <span className="ff-stat-lbl">{t('audit.failed')}</span>
                  </div>
                  <div className="ff-stat">
                    <span className="ff-stat-val ff-stat-ok">{u.success_count}</span>
                    <span className="ff-stat-lbl">{t('audit.succeeded')}</span>
                  </div>
                  <div className="ff-stat">
                    <span className="ff-stat-val">{u.fail_rate}%</span>
                    <span className="ff-stat-lbl">{t('audit.errorRate')}</span>
                  </div>
                  <div className="ff-stat">
                    <span className="ff-stat-val">
                      {u.avg_confidence != null ? u.avg_confidence.toFixed(3) : '—'}
                    </span>
                    <span className="ff-stat-lbl">{t('audit.avgSimilarity')}</span>
                  </div>
                </div>

                <div className="ff-footer">
                  <span className="ff-footer-item">
                    <MdWarning size={13} style={{ color: '#f59e0b', marginRight: 3 }} />
                    {t('audit.lastFail')}:{' '}
                    {u.last_fail_at
                      ? formatLocaleDateTime(u.last_fail_at, i18n.resolvedLanguage)
                      : '—'}
                  </span>
                  <span className="ff-action-hint">
                    → {t('audit.renewFaceHint')}
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
  const { t, i18n } = useTranslation();
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
          {t('audit.systemLogs')}
        </button>
        <button
          className={`audit-tab ${activeTab === 'face-failures' ? 'audit-tab-active' : ''}`}
          onClick={() => setActiveTab('face-failures')}
        >
          <MdFace size={16} style={{ marginRight: 6 }} />
          {t('audit.faceIssues')}
        </button>
      </div>

      {/* ── Tab: System logs ─────────────────────────────────────────────── */}
      {activeTab === 'logs' && (
        <>
          <div className="audit-header">
            <div>
              <h1 className="page-title">{t('audit.systemLogsTitle')}</h1>
              <p className="page-subtitle">{t('audit.systemLogsSubtitle', { total })}</p>
            </div>
            <button className="audit-refresh-btn" onClick={() => loadLogs(page, actionFilter)}>
              <MdRefresh size={16} style={{ marginRight: 5 }} />{t('common.refresh')}
            </button>
          </div>

          <form className="audit-search" onSubmit={handleSearch}>
            <input
              type="text"
              placeholder={t('audit.filterPlaceholder')}
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
              className="audit-search-input"
            />
            <button type="submit" className="audit-search-btn">
              <MdSearch size={16} />
            </button>
          </form>

          {loading ? (
            <div className="audit-loading">{t('common.loading')}</div>
          ) : logs.length === 0 ? (
            <div className="audit-empty">{t('audit.notFound')}</div>
          ) : (
            <>
              <div className="audit-table-wrapper">
                <table className="audit-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>{t('audit.dateTime')}</th>
                      <th>{t('audit.action')}</th>
                      <th>{t('audit.actorId')}</th>
                      <th>{t('audit.role')}</th>
                      <th>{t('audit.resource')}</th>
                      <th>{t('audit.resourceId')}</th>
                      <th>IP</th>
                      <th>{t('audit.detail')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => (
                      <tr key={log.id}>
                        <td className="log-id">{log.id}</td>
                        <td className="log-date">
                          {formatLocaleDateTime(log.created_at, i18n.resolvedLanguage)}
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
                              <summary>{t('common.show')}</summary>
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
                    ‹ {t('common.prev')}
                  </button>
                  <span className="page-info">{page} / {totalPages}</span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                    className="page-btn"
                  >
                    {t('common.next')} ›
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
              <h1 className="page-title">{t('audit.faceIssuesTitle')}</h1>
              <p className="page-subtitle">{t('audit.faceIssuesSubtitle')}</p>
            </div>
          </div>
          <FaceFailuresPanel />
        </>
      )}
    </div>
  );
};
