import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  MdSchool, MdPercent, MdListAlt, MdFlag, MdRefresh, MdExpandMore, MdExpandLess,
  MdDownload,
} from 'react-icons/md';
import apiClient from '../../../../shared/services/apiClient';
import { SkeletonStatCard, SkeletonTable } from '../../../../shared/components/Skeleton';
import './RecordsPage.css';

export const RecordsPage = () => {
  const [performance, setPerformance] = useState([]);
  const [records, setRecords] = useState([]);
  const [courses, setCourses] = useState([]);
  const [courseFilter, setCourseFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

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
    try {
      const params = new URLSearchParams({ format });
      if (courseFilter) params.set('course_id', courseFilter);
      const response = await fetch(
        `/api/v1/attendance/export?${params.toString()}`,
        { method: 'GET', credentials: 'include' }
      );
      if (!response.ok) throw new Error('Export başarısız');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `yoklama_raporu.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || 'Export hatası');
    } finally {
      setExporting(false);
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
          <h1 className="page-title">Raporlar & Analitik</h1>
          <p className="page-subtitle">Yoklama verileri ve kurs performansı</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="refresh-btn" onClick={loadData} title="Yenile">
            <MdRefresh size={18} style={{ marginRight: 6 }} />Yenile
          </button>
          <button className="refresh-btn" onClick={() => handleExport('excel')} disabled={exporting} title="Excel olarak indir">
            <MdDownload size={18} style={{ marginRight: 6 }} />Excel
          </button>
          <button className="refresh-btn" onClick={() => handleExport('pdf')} disabled={exporting} title="PDF olarak indir">
            <MdDownload size={18} style={{ marginRight: 6 }} />PDF
          </button>
        </div>
      </div>

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
                <div className="stat-label">Toplam Ders</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><MdPercent size={22} /></div>
              <div className="stat-info">
                <div className="stat-value">{avgAttendance}%</div>
                <div className="stat-label">Ort. Devam</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><MdListAlt size={22} /></div>
              <div className="stat-info">
                <div className="stat-value">{records.length}</div>
                <div className="stat-label">Toplam Kayıt</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><MdFlag size={22} /></div>
              <div className="stat-info">
                <div className="stat-value">{flaggedCount}</div>
                <div className="stat-label">Şüpheli</div>
              </div>
            </div>
          </div>

          <div className="content-grid">
            <div className="content-section">
              <h2 className="section-title">Kurs Performansı</h2>
              {performance.length === 0 ? (
                <div className="empty-state">
                  <p>Henüz veri yok</p>
                </div>
              ) : (
                <table className="records-table">
                  <thead>
                    <tr>
                      <th>Kod</th>
                      <th>Ders Adı</th>
                      <th>Öğrenci</th>
                      <th>Devam Oranı</th>
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
              <h2 className="section-title">Yoklama Kayıtları</h2>
              <div className="filter-row">
                <select
                  className="filter-select"
                  value={courseFilter}
                  onChange={e => { setCourseFilter(e.target.value); setExpandedSessions(new Set()); }}
                >
                  <option value="">Tüm Dersler</option>
                  {courses.map(c => (
                    <option key={c.id} value={String(c.id)}>{c.code} — {c.name}</option>
                  ))}
                </select>
              </div>

              {filteredRecords.length === 0 ? (
                <div className="empty-state"><p>Kayıt bulunamadı</p></div>
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
                            <span className="session-label">Oturum #{sid}</span>
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
                                <th>Öğrenci</th>
                                <th>Öğrenci No</th>
                                <th>Tarih / Saat</th>
                                <th>Durum</th>
                              </tr>
                            </thead>
                            <tbody>
                              {recs.map(r => (
                                <tr key={r.id}>
                                  <td>{r.student_name || ('Öğrenci #' + r.student_id)}</td>
                                  <td>{r.student_number || '—'}</td>
                                  <td>{r.marked_at ? new Date(r.marked_at).toLocaleString('tr-TR') : '—'}</td>
                                  <td>
                                    <span className={`status-badge status-${r.status || 'present'} ${r.is_flagged ? 'flagged' : ''}`}>
                                      {r.status === 'present' ? 'Mevcut'
                                        : r.status === 'absent' ? 'Devamsız'
                                        : r.status === 'excused' ? 'Mazeretli'
                                        : r.status === 'pending_review' ? 'İncelemede'
                                        : r.status || 'Mevcut'}
                                      {r.is_flagged && ' [Şüpheli]'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
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
                      <th>Öğrenci</th>
                      <th>Öğrenci No</th>
                      <th>Ders</th>
                      <th>Tarih</th>
                      <th>Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.slice(0, 50).map(r => {
                      const course = courseMap[String(r.course_id)];
                      return (
                        <tr key={r.id}>
                          <td>{r.student_name || ('Öğrenci #' + r.student_id)}</td>
                          <td>{r.student_number || '—'}</td>
                          <td>
                            {course ? (
                              <span title={course.name}>{course.code}</span>
                            ) : r.course_id}
                          </td>
                          <td>{r.marked_at ? new Date(r.marked_at).toLocaleString('tr-TR') : '—'}</td>
                          <td>
                            <span className={`status-badge status-${r.status || 'present'} ${r.is_flagged ? 'flagged' : ''}`}>
                              {r.status === 'present' ? 'Mevcut'
                                : r.status === 'absent' ? 'Devamsız'
                                : r.status === 'excused' ? 'Mazeretli'
                                : r.status === 'pending_review' ? 'İncelemede'
                                : r.status || 'Mevcut'}
                              {r.is_flagged && ' [Şüpheli]'}
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
