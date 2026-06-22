import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MdSchool, MdPercent, MdListAlt, MdFlag, MdRefresh, MdExpandMore, MdExpandLess,
  MdDownload,
} from 'react-icons/md';
import apiClient from '../../../../shared/services/apiClient';
import { getApiBaseUrl } from '../../../../shared/services/apiBaseUrl';
import { formatLocaleDate, formatLocaleDateTime } from '../../../../shared/utils/localeFormat';
import { SkeletonStatCard, SkeletonTable } from '../../../../shared/components/Skeleton';
import './RecordsPage.css';

export const RecordsPage = () => {
  const { t, i18n } = useTranslation();
  const [performance, setPerformance] = useState([]);
  const [records, setRecords] = useState([]);
  const [courses, setCourses] = useState([]);
  const [courseFilter, setCourseFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState(null);
  const [overriding, setOverriding] = useState(new Set()); // record IDs being saved

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [perf, recs, crs] = await Promise.allSettled([
        apiClient.get('/dashboard/course-performance'),
        apiClient.get('/attendance/records', { params: { page: 1, page_size: 100 } }),
        apiClient.get('/courses/'),
      ]);
      if (perf.status === 'fulfilled') setPerformance(perf.value || []);
      if (recs.status === 'fulfilled') {
        // Backend returns paginated object: { records: [...], total, page, ... }
        const payload = recs.value;
        setRecords(Array.isArray(payload) ? payload : (payload?.records || []));
      }
      if (crs.status === 'fulfilled') setCourses(crs.value || []);
    } catch (err) {
      console.error('RecordsPage error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const [expandedSessions, setExpandedSessions] = useState(new Set());

  const filteredRecords = courseFilter
    ? records.filter(r => String(r.course_id) === courseFilter)
    : records;

  const courseMap = Object.fromEntries(courses.map(c => [String(c.id), c]));

  // Group records by session when a course is selected
  const sessionGroups = useMemo(() => {
    if (!courseFilter) return null;
    const groups = {};
    filteredRecords.forEach(r => {
      const sid = r.session_id ?? 'unknown';
      if (!groups[sid]) groups[sid] = [];
      groups[sid].push(r);
    });
    return Object.entries(groups).sort((a, b) => {
      const aDate = a[1][0]?.marked_at || '';
      const bDate = b[1][0]?.marked_at || '';
      return bDate.localeCompare(aDate);
    });
  }, [filteredRecords, courseFilter]);

  const toggleSession = (sid) => {
    setExpandedSessions(prev => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid); else next.add(sid);
      return next;
    });
  };

  const handleExport = async (format) => {
    setExporting(true);
    setExportNotice(null);
    try {
      const params = new URLSearchParams({ format });
      if (courseFilter) params.set('course_id', courseFilter);
      const response = await fetch(
        `${getApiBaseUrl()}/api/v1/attendance/export?${params.toString()}`,
        { method: 'GET', credentials: 'include' }
      );
      if (!response.ok) throw new Error(t('records.exportError'));
      const truncated = String(response.headers.get('X-Export-Truncated') || '').toLowerCase() === 'true';
      const limitRaw = response.headers.get('X-Export-Limit');
      const limit = limitRaw && /^\d+$/.test(limitRaw) ? limitRaw : '5000';
      if (truncated) {
        setExportNotice({
          title: t('records.exportTruncatedTitle'),
          body: t('records.exportTruncatedBody', { limit }),
        });
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `yoklama_raporu.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || t('records.exportError'));
    } finally {
      setExporting(false);
    }
  };

  const handleOverride = async (record, newStatus) => {
    if (overriding.has(record.id)) return;
    setOverriding(prev => new Set(prev).add(record.id));
    try {
      await apiClient.patch(`/attendance/${record.id}/override`, {
        status: newStatus,
        note: t('records.overrideNote'),
      });
      // Optimistic update in local state
      setRecords(prev => prev.map(r =>
        r.id === record.id ? { ...r, status: newStatus, is_flagged: false, flag_reason: null } : r
      ));
    } catch (err) {
      alert(err?.message || t('records.updateFailed'));
    } finally {
      setOverriding(prev => { const n = new Set(prev); n.delete(record.id); return n; });
    }
  };

  const avgAttendance = performance.length
    ? Math.round(performance.reduce((sum, c) => sum + (c.attendance || 0), 0) / performance.length)
    : 0;
  const flaggedCount = records.filter(r => r.is_flagged).length;

  return (
    <div className="records-page-container">
      <div className="records-header">
        <div>
          <h1 className="page-title">{t('records.title')}</h1>
          <p className="page-subtitle">{t('records.subtitle')}</p>
        </div>
        <div className="records-header-actions">
          <button className="refresh-btn" onClick={loadData} title={t('common.refresh')}>
            <MdRefresh size={18} style={{ marginRight: 6 }} />{t('common.refresh')}
          </button>
          <button className="refresh-btn" onClick={() => handleExport('excel')} disabled={exporting} title={t('records.excelTitle')}>
            <MdDownload size={18} style={{ marginRight: 6 }} />Excel
          </button>
          <button className="refresh-btn" onClick={() => handleExport('pdf')} disabled={exporting} title={t('records.pdfTitle')}>
            <MdDownload size={18} style={{ marginRight: 6 }} />PDF
          </button>
        </div>
      </div>

      {exportNotice && (
        <div className="records-export-banner" role="status">
          <strong>{exportNotice.title}</strong>
          <p>{exportNotice.body}</p>
          <button type="button" className="records-export-banner-dismiss" onClick={() => setExportNotice(null)}>
            {t('common.close')}
          </button>
        </div>
      )}

      {loading ? (
        <div className="records-loading">
          <div className="stats-grid">
            {[1,2,3,4].map(i => <SkeletonStatCard key={i} />)}
          </div>
          <div className="content-grid" style={{ marginTop: 24 }}>
            <div className="content-section"><SkeletonTable rows={6} cols={4} /></div>
            <div className="content-section"><SkeletonTable rows={6} cols={5} /></div>
          </div>
        </div>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon"><MdSchool size={22} /></div>
              <div className="stat-info">
                <div className="stat-value">{performance.length}</div>
                <div className="stat-label">{t('records.statCards.totalCourses')}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><MdPercent size={22} /></div>
              <div className="stat-info">
                <div className="stat-value">{avgAttendance}%</div>
                <div className="stat-label">{t('records.statCards.avgAttendance')}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><MdListAlt size={22} /></div>
              <div className="stat-info">
                <div className="stat-value">{records.length}</div>
                <div className="stat-label">{t('records.statCards.totalRecords')}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><MdFlag size={22} /></div>
              <div className="stat-info">
                <div className="stat-value">{flaggedCount}</div>
                <div className="stat-label">{t('records.statCards.suspicious')}</div>
              </div>
            </div>
          </div>

          <div className="content-grid">
            <div className="content-section">
              <h2 className="section-title">{t('records.coursePerformance')}</h2>
              {performance.length === 0 ? (
                <div className="empty-state">
                  <p>{t('common.noData')}</p>
                </div>
              ) : (
                <div className="records-table-wrap">
                  <table className="records-table">
                    <thead>
                      <tr>
                        <th>{t('records.tableHeaders.code')}</th>
                        <th>{t('records.tableHeaders.courseName')}</th>
                        <th>{t('records.tableHeaders.students')}</th>
                        <th>{t('records.tableHeaders.attendanceRate')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {performance.map(c => (
                        <tr key={c.course_id}>
                          <td><strong>{c.course}</strong></td>
                          <td>{c.name}</td>
                          <td>{c.students}</td>
                          <td>
                            <div className="attendance-cell">
                              <div className="progress-bar">
                                <div className="progress-fill" style={{ width: `${c.attendance}%` }}></div>
                              </div>
                              <span className="attendance-value">{c.attendance}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="content-section">
              <h2 className="section-title">{t('records.attendanceRecords')}</h2>
              <div className="filter-row">
                <select
                  className="filter-select"
                  value={courseFilter}
                  onChange={e => { setCourseFilter(e.target.value); setExpandedSessions(new Set()); }}
                >
                  <option value="">{t('records.allCourses')}</option>
                  {courses.map(c => (
                    <option key={c.id} value={String(c.id)}>{c.code} — {c.name}</option>
                  ))}
                </select>
              </div>

              {filteredRecords.length === 0 ? (
                <div className="empty-state"><p>{t('records.noRecords')}</p></div>
              ) : sessionGroups ? (
                /* Session-grouped view when a course is selected */
                <div className="session-groups">
                  {sessionGroups.map(([sid, recs]) => {
                    const presentCount = recs.filter(r => r.status === 'present').length;
                    const flaggedCount = recs.filter(r => r.is_flagged).length;
                    const firstDate = formatLocaleDate(recs[0]?.marked_at, i18n.resolvedLanguage);
                    const isExpanded = expandedSessions.has(sid);
                    return (
                      <div key={sid} className="session-group">
                        <div className="session-group-header" onClick={() => toggleSession(sid)}>
                          <div className="session-group-info">
                            <span className="session-label">{t('records.session', { id: sid })}</span>
                            <span className="session-date">{firstDate}</span>
                            <span className="session-stats">
                              <span className="stat-present">{t('records.presentCount', { count: presentCount })}</span>
                              <span className="stat-total">{t('records.totalCount', { count: recs.length })}</span>
                              {flaggedCount > 0 && <span className="stat-flagged">{t('records.suspiciousCount', { count: flaggedCount })}</span>}
                            </span>
                          </div>
                          <span className="session-toggle">
                            {isExpanded ? <MdExpandLess size={20} /> : <MdExpandMore size={20} />}
                          </span>
                        </div>
                        {isExpanded && (
                          <div className="records-table-wrap">
                            <table className="records-table session-records-table">
                              <thead>
                                <tr>
                                <th>{t('records.tableHeaders.student')}</th>
                                <th>{t('records.tableHeaders.studentNo')}</th>
                                <th>{t('records.tableHeaders.datetime')}</th>
                                <th>{t('records.tableHeaders.status')}</th>
                                <th>{t('records.tableHeaders.actions')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {recs.map(r => {
                                  const isSaving = overriding.has(r.id);
                                  return (
                                    <tr key={r.id}>
                                      <td>{r.student_name || t('records.studentPrefix', { id: r.student_id })}</td>
                                      <td>{r.student_number || '—'}</td>
                                      <td>{formatLocaleDateTime(r.marked_at, i18n.resolvedLanguage)}</td>
                                      <td>
                                        <span className={`status-badge status-${r.status || 'present'} ${r.is_flagged ? 'flagged' : ''}`}>
                                          {t(`records.statuses.${r.status || 'present'}`, r.status || t('records.statuses.present'))}
                                          {r.is_flagged && ' ⚑'}
                                        </span>
                                      </td>
                                      <td>
                                        <div className="override-btns">
                                          {[
                                            { status: 'present', label: t('records.overrideBtns.present'), cls: 'override-btn-present' },
                                            { status: 'excused', label: t('records.overrideBtns.excused'), cls: 'override-btn-excused' },
                                            { status: 'absent',  label: t('records.overrideBtns.absent'),  cls: 'override-btn-absent'  },
                                          ].map(btn => (
                                            <button
                                              key={btn.status}
                                              className={`override-btn ${btn.cls} ${r.status === btn.status ? 'active' : ''}`}
                                              onClick={() => handleOverride(r, btn.status)}
                                              disabled={isSaving || r.status === btn.status}
                                              title={btn.label}
                                            >
                                              {isSaving && r.status !== btn.status ? '…' : btn.label}
                                            </button>
                                          ))}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Flat view when no course selected */
                <div className="records-table-wrap">
                  <table className="records-table">
                    <thead>
                      <tr>
                        <th>{t('records.tableHeaders.student')}</th>
                        <th>{t('records.tableHeaders.studentNo')}</th>
                        <th>{t('records.tableHeaders.course')}</th>
                        <th>{t('records.tableHeaders.datetime')}</th>
                        <th>{t('records.tableHeaders.status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecords.slice(0, 50).map(r => {
                        const course = courseMap[String(r.course_id)];
                        return (
                          <tr key={r.id}>
                            <td>{r.student_name || t('records.studentPrefix', { id: r.student_id })}</td>
                            <td>{r.student_number || '—'}</td>
                            <td>
                              {course ? (
                                <span title={course.name}>{course.code}</span>
                              ) : r.course_id}
                            </td>
                            <td>{formatLocaleDateTime(r.marked_at, i18n.resolvedLanguage)}</td>
                            <td>
                              <span className={`status-badge status-${r.status || 'present'} ${r.is_flagged ? 'flagged' : ''}`}>
                                {t(`records.statuses.${r.status || 'present'}`, r.status || t('records.statuses.present'))}
                                {r.is_flagged && ` [${t('records.statCards.suspicious')}]`}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
