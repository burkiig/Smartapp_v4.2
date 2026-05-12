import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MdSchool, MdPercent, MdListAlt, MdFlag, MdRefresh, MdExpandMore, MdExpandLess,
  MdDownload, MdCheckCircle, MdCancel, MdAssignment,
} from 'react-icons/md';
import apiClient from '../../../../shared/services/apiClient';
import { SkeletonStatCard, SkeletonTable } from '../../../../shared/components/Skeleton';
import './RecordsPage.css';

export const RecordsPage = () => {
  const { t } = useTranslation();
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
        `/api/v1/attendance/export?${params.toString()}`,
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
      alert(err?.response?.data?.detail || err?.message || t('records.overrideError'));
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
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="refresh-btn" onClick={loadData} title={t('common.refresh')}>
            <MdRefresh size={18} style={{ marginRight: 6 }} />{t('common.refresh')}
          </button>
          <button className="refresh-btn" onClick={() => handleExport('excel')} disabled={exporting} title={t('records.exportExcel')}>
            <MdDownload size={18} style={{ marginRight: 6 }} />Excel
          </button>
          <button className="refresh-btn" onClick={() => handleExport('pdf')} disabled={exporting} title={t('records.exportPdf')}>
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
                <div className="stat-label">{t('records.totalCourses')}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><MdPercent size={22} /></div>
              <div className="stat-info">
                <div className="stat-value">{avgAttendance}%</div>
                <div className="stat-label">{t('records.avgAttendance')}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><MdListAlt size={22} /></div>
              <div className="stat-info">
                <div className="stat-value">{records.length}</div>
                <div className="stat-label">{t('records.totalRecords')}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><MdFlag size={22} /></div>
              <div className="stat-info">
                <div className="stat-value">{flaggedCount}</div>
                <div className="stat-label">{t('records.suspicious')}</div>
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
                <table className="records-table">
                  <thead>
                    <tr>
                      <th>{t('records.code')}</th>
                      <th>{t('records.courseName')}</th>
                      <th>{t('records.students')}</th>
                      <th>{t('records.attendanceRate')}</th>
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
                <div className="empty-state"><p>{t('records.notFound')}</p></div>
              ) : sessionGroups ? (
                /* Session-grouped view when a course is selected */
                <div className="session-groups">
                  {sessionGroups.map(([sid, recs]) => {
                    const presentCount = recs.filter(r => r.status === 'present').length;
                    const flaggedCount = recs.filter(r => r.is_flagged).length;
                    const firstDate = recs[0]?.marked_at ? new Date(recs[0].marked_at).toLocaleDateString('tr-TR') : '—';
                    const isExpanded = expandedSessions.has(sid);
                    return (
                      <div key={sid} className="session-group">
                        <div className="session-group-header" onClick={() => toggleSession(sid)}>
                          <div className="session-group-info">
                            <span className="session-label">{t('records.sessionNo', { id: sid })}</span>
                            <span className="session-date">{firstDate}</span>
                            <span className="session-stats">
                              <span className="stat-present">{presentCount} mevcut</span>
                              <span className="stat-total">/ {recs.length} toplam</span>
                              {flaggedCount > 0 && <span className="stat-flagged">{flaggedCount} şüpheli</span>}
                            </span>
                          </div>
                          <span className="session-toggle">
                            {isExpanded ? <MdExpandLess size={20} /> : <MdExpandMore size={20} />}
                          </span>
                        </div>
                        {isExpanded && (
                          <table className="records-table session-records-table">
                            <thead>
                              <tr>
                              <th>{t('records.student')}</th>
                              <th>{t('records.studentNo')}</th>
                              <th>{t('records.dateTime')}</th>
                              <th>{t('records.status')}</th>
                              <th>{t('records.action')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {recs.map(r => {
                                const isSaving = overriding.has(r.id);
                                return (
                                  <tr key={r.id}>
                                    <td>{r.student_name || (t('records.studentHash', { id: r.student_id }))}</td>
                                    <td>{r.student_number || '—'}</td>
                                    <td>{r.marked_at ? new Date(r.marked_at).toLocaleString('tr-TR') : '—'}</td>
                                    <td>
                                      <span className={`status-badge status-${r.status || 'present'} ${r.is_flagged ? 'flagged' : ''}`}>
                                        {t(`records.statuses.${r.status || 'present'}`, r.status || t('records.statuses.present'))}
                                        {r.is_flagged && ' ⚑'}
                                      </span>
                                    </td>
                                    <td>
                                      <div className="override-btns">
                                        {[
                                          { status: 'present', label: t('records.statuses.present'), cls: 'override-btn-present' },
                                          { status: 'excused', label: t('records.statuses.excused'), cls: 'override-btn-excused' },
                                          { status: 'absent',  label: t('records.statuses.absent'),  cls: 'override-btn-absent'  },
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
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Flat view when no course selected */
                <table className="records-table">
                  <thead>
                    <tr>
                      <th>{t('records.student')}</th>
                      <th>{t('records.studentNo')}</th>
                      <th>{t('records.course')}</th>
                      <th>{t('records.date')}</th>
                      <th>{t('records.status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.slice(0, 50).map(r => {
                      const course = courseMap[String(r.course_id)];
                      return (
                        <tr key={r.id}>
                          <td>{r.student_name || t('records.studentHash', { id: r.student_id })}</td>
                          <td>{r.student_number || '—'}</td>
                          <td>
                            {course ? (
                              <span title={course.name}>{course.code}</span>
                            ) : r.course_id}
                          </td>
                          <td>{r.marked_at ? new Date(r.marked_at).toLocaleString('tr-TR') : '—'}</td>
                          <td>
                            <span className={`status-badge status-${r.status || 'present'} ${r.is_flagged ? 'flagged' : ''}`}>
                              {t(`records.statuses.${r.status || 'present'}`, r.status || t('records.statuses.present'))}
                              {r.is_flagged && ` [${t('records.suspicious')}]`}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
