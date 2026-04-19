import React, { useState, useEffect, useCallback } from 'react';
import {
  MdSchool, MdPeople, MdPlayCircle, MdWarning, MdRefresh,
  MdCheckCircle, MdSchedule,
} from 'react-icons/md';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import apiClient from '../../../shared/services/apiClient';
import { ClassDetails } from '../../attendance/components/ClassDetails';
import { SkeletonStatCard, SkeletonTable } from '../../../shared/components/Skeleton';
import './DashboardView.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, Filler);

const DAY_NAMES_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getTodayCourses(courses) {
  const today = DAY_NAMES_EN[new Date().getDay()];
  return courses
    .flatMap(c => {
      const sched = c.schedule;
      if (!sched) return [];
      // New format: { slots: [{day, start_time, end_time}] }
      if (Array.isArray(sched.slots)) {
        return sched.slots
          .filter(slot => slot.day === today)
          .map(slot => ({
            ...c,
            start_time: slot.start_time || null,
            end_time: slot.end_time || null,
          }));
      }
      // Old format: { days: [...], start_time, end_time }
      if (Array.isArray(sched.days) && sched.days.includes(today)) {
        return [{ ...c, start_time: sched.start_time || null, end_time: sched.end_time || null }];
      }
      return [];
    })
    .sort((a, b) => {
      if (!a.start_time) return 1;
      if (!b.start_time) return -1;
      return a.start_time.localeCompare(b.start_time);
    });
}

function isApproaching(start_time) {
  if (!start_time) return false;
  const now = new Date();
  const [h, m] = start_time.split(':').map(Number);
  const classTime = new Date();
  classTime.setHours(h, m, 0, 0);
  const diff = (classTime - now) / 60000; // minutes
  return diff > 0 && diff <= 60;
}

function isOngoing(start_time, end_time) {
  if (!start_time || !end_time) return false;
  const now = new Date();
  const [sh, sm] = start_time.split(':').map(Number);
  const [eh, em] = end_time.split(':').map(Number);
  const start = new Date(); start.setHours(sh, sm, 0, 0);
  const end = new Date(); end.setHours(eh, em, 0, 0);
  return now >= start && now <= end;
}

function DashboardView({ onNavigate }) {
    const [stats, setStats] = useState(null);
    const [activeSessions, setActiveSessions] = useState([]);
    const [recentSessions, setRecentSessions] = useState([]);
    const [flaggedRecords, setFlaggedRecords] = useState([]);
    const [coursePerformance, setCoursePerformance] = useState([]);
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSession, setSelectedSession] = useState(null);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [statsRes, sessionsRes, flaggedRes, perfRes, coursesRes] = await Promise.allSettled([
                apiClient.get('/dashboard/stats'),
                apiClient.get('/sessions/active'),
                apiClient.get('/attendance/flagged'),
                apiClient.get('/dashboard/course-performance'),
                apiClient.get('/courses/'),
            ]);

            if (statsRes.status === 'fulfilled') setStats(statsRes.value);
            if (sessionsRes.status === 'fulfilled') setActiveSessions(sessionsRes.value || []);
            if (flaggedRes.status === 'fulfilled') setFlaggedRecords(flaggedRes.value || []);
            if (perfRes.status === 'fulfilled') setCoursePerformance(perfRes.value || []);
            if (coursesRes.status === 'fulfilled') setCourses(coursesRes.value || []);
            // Fetch recent closed sessions separately
            try {
                const recent = await apiClient.get('/sessions/', { params: { status: 'closed' } });
                const list = Array.isArray(recent) ? recent : [];
                // Sort by date desc, take last 5
                list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
                setRecentSessions(list.slice(0, 5));
            } catch { /* ignore */ }
        } catch (err) {
            console.error('Dashboard fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    const handleEndSession = async (sessionId) => {
        try {
            await apiClient.post(`/sessions/${sessionId}/end`);
            fetchAll();
        } catch (err) {
            console.error('End session error:', err);
        }
    };

    if (loading) {
        return (
            <div className="dashboard">
                <div className="stats-grid-top">
                    {[1,2,3,4].map(i => <SkeletonStatCard key={i} />)}
                </div>
                <div className="dashboard-grid" style={{ marginTop: 24 }}>
                    <div className="dashboard-section"><SkeletonTable rows={4} cols={3} /></div>
                    <div className="dashboard-right-column">
                        <div className="dashboard-section"><SkeletonTable rows={4} cols={2} /></div>
                        <div className="dashboard-section"><SkeletonTable rows={3} cols={2} /></div>
                    </div>
                </div>
            </div>
        );
    }

    if (selectedSession) {
        return <ClassDetails classData={selectedSession} onBack={() => setSelectedSession(null)} />;
    }

    const pendingFlagged = flaggedRecords.filter(r => r.is_flagged && r.status !== 'absent');
    const todayCourses = getTodayCourses(courses);

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <div className="header-left">
                    <h1 className="page-title">Dashboard</h1>
                    <p className="page-subtitle">
                        {new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>
                <button className="refresh-btn" onClick={fetchAll} title="Yenile"><MdRefresh size={18} style={{marginRight:5}}/>Yenile</button>
            </div>

            {/* Stats Cards */}
            <div className="stats-grid-top">
                <div className="stat-card-small">
                    <div className="stat-icon blue"><MdSchool size={22} /></div>
                    <div className="stat-content">
                        <div className="stat-value">{stats?.total_courses ?? 0}</div>
                        <div className="stat-label">Toplam Ders</div>
                    </div>
                </div>
                <div className="stat-card-small">
                    <div className="stat-icon green"><MdPeople size={22} /></div>
                    <div className="stat-content">
                        <div className="stat-value">{stats?.total_enrolled ?? 0}</div>
                        <div className="stat-label">Kayıtlı Öğrenci</div>
                    </div>
                </div>
                <div className="stat-card-small">
                    <div className="stat-icon orange"><MdPlayCircle size={22} /></div>
                    <div className="stat-content">
                        <div className="stat-value">{activeSessions.length}</div>
                        <div className="stat-label">Aktif Oturum</div>
                    </div>
                </div>
                <div className="stat-card-small">
                    <div className="stat-icon yellow"><MdWarning size={22} /></div>
                    <div className="stat-content">
                        <div className="stat-value">{stats?.flagged_records ?? pendingFlagged.length}</div>
                        <div className="stat-label">İnceleme Bekleyen</div>
                    </div>
                </div>
            </div>

            {/* Today's Classes */}
            {todayCourses.length > 0 && (
                <div className="dashboard-section todays-classes">
                    <h2 className="section-title">Bugünün Dersleri</h2>
                    <div className="today-course-list">
                        {todayCourses.map(c => {
                            const approaching = isApproaching(c.start_time);
                            const ongoing = isOngoing(c.start_time, c.end_time);
                            return (
                                <div key={c.id} className={`today-course-item ${approaching ? 'approaching' : ''} ${ongoing ? 'ongoing' : ''}`}>
                                    <div className="today-course-info">
                                        <span className="today-course-code">{c.code}</span>
                                        <span className="today-course-name">{c.name}</span>
                                    </div>
                                    <div className="today-course-right">
                                        {c.start_time && (
                                            <span className="today-course-time">{c.start_time} – {c.end_time}</span>
                                        )}
                                        {approaching && (
                                            <span className="approaching-badge">1 saat içinde</span>
                                        )}
                                        {ongoing && (
                                            <span className="ongoing-badge">Devam ediyor</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Main Content Grid */}
            <div className="dashboard-grid">
                {/* Active Sessions */}
                <div className="dashboard-section schedule-section">
                    <h2 className="section-title">Aktif Oturumlar</h2>
                    {activeSessions.length > 0 ? (
                        <div className="schedule-list">
                            {activeSessions.map(session => (
                                <div
                                    key={session.id}
                                    className="schedule-item clickable"
                                    onClick={() => setSelectedSession(session)}
                                >
                                    <div className="schedule-time">
                                        <MdPlayCircle size={16} style={{color:'#10b981'}} />
                                        <span>{session.start_time || '—'}</span>
                                    </div>
                                    <div className="schedule-details">
                                        <div className="schedule-course">
                                            Oturum #{session.id} — Ders #{session.course_id}
                                        </div>
                                        <div className="schedule-meta">
                                            <span className="schedule-room">{session.date}</span>
                                            <span className="auto-badge">Aktif</span>
                                        </div>
                                    </div>
                                    <div className="schedule-status">
                                        <button
                                            className="end-session-btn"
                                            onClick={e => { e.stopPropagation(); handleEndSession(session.id); }}
                                        >
                                            Bitir
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-sessions">
                            <p>Aktif oturum yok</p>
                            <p className="hint">QR Scan sekmesinden yeni oturum başlatabilirsiniz</p>
                        </div>
                    )}

                    {/* Recent closed sessions */}
                    {recentSessions.length > 0 && (
                        <div style={{ marginTop: 20 }}>
                            <h2 className="section-title">Son Oturumlar</h2>
                            <div className="schedule-list">
                                {recentSessions.map(session => (
                                    <div
                                        key={session.id}
                                        className="schedule-item clickable"
                                        onClick={() => setSelectedSession(session)}
                                    >
                                        <div className="schedule-time">
                                            <MdCheckCircle size={16} style={{ color: '#6b7280' }} />
                                            <span>{session.start_time || '—'}</span>
                                        </div>
                                        <div className="schedule-details">
                                            <div className="schedule-course">
                                                Oturum #{session.id} — Ders #{session.course_id}
                                            </div>
                                            <div className="schedule-meta">
                                                <span className="schedule-room">{session.date}</span>
                                                <span style={{ fontSize: 11, color: '#6b7280', padding: '2px 8px', background: '#f3f4f6', borderRadius: 8 }}>Tamamlandı</span>
                                            </div>
                                        </div>
                                        <div className="schedule-status" style={{ fontSize: 12, color: '#6b7280' }}>
                                            Detay →
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Column */}
                <div className="dashboard-right-column">
                    {/* Pending Flagged Records */}
                    <div className="dashboard-section pending-reviews">
                        <div className="section-header-with-badge">
                            <h2 className="section-title">İnceleme Bekleyen</h2>
                            <span className="count-badge">{pendingFlagged.length}</span>
                        </div>
                        {pendingFlagged.length > 0 ? (
                            <div className="reviews-list">
                                {pendingFlagged.slice(0, 5).map(record => (
                                    <div key={record.id} className="review-item">
                                        <div className="review-student">
                                            {record.student_name || ('Öğrenci #' + record.student_id)}
                                            {record.student_number && (
                                                <span className="review-student-num"> — {record.student_number}</span>
                                            )}
                                        </div>
                                        <div className="review-details">
                                            <span className="review-course">
                                                {record.course_code || record.course_name || ('Ders #' + record.course_id)}
                                            </span>
                                            <span className="review-time">
                                                {record.marked_at
                                                    ? new Date(record.marked_at).toLocaleTimeString('tr-TR')
                                                    : '—'}
                                            </span>
                                        </div>
                                        <div className="review-reason">{record.flag_reason || 'Şüpheli kayıt'}</div>
                                    </div>
                                ))}
                                {pendingFlagged.length > 5 && (
                                    <button
                                        className="see-all-btn"
                                        onClick={() => onNavigate && onNavigate('attendance')}
                                    >
                                        Tamamını göster ({pendingFlagged.length})
                                    </button>
                                )}
                            </div>
                        ) : (
                            <p className="empty-text">İnceleme bekleyen kayıt yok</p>
                        )}
                    </div>

                    {/* Course Performance Chart */}
                    <div className="dashboard-section quick-actions">
                        <h2 className="section-title">Ders Devam Oranları</h2>
                        {coursePerformance.length > 0 ? (
                            <div style={{ maxHeight: 260 }}>
                                <Bar
                                    data={{
                                        labels: coursePerformance.map(c => c.course),
                                        datasets: [{
                                            label: 'Devam (%)',
                                            data: coursePerformance.map(c => c.attendance),
                                            backgroundColor: coursePerformance.map(c =>
                                                c.attendance >= 70 ? 'rgba(16,185,129,0.7)' : 'rgba(239,68,68,0.7)'
                                            ),
                                            borderColor: coursePerformance.map(c =>
                                                c.attendance >= 70 ? '#10b981' : '#ef4444'
                                            ),
                                            borderWidth: 1,
                                            borderRadius: 5,
                                        }],
                                    }}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: {
                                            legend: { display: false },
                                            tooltip: { callbacks: { label: ctx => `${ctx.raw}%` } },
                                        },
                                        scales: {
                                            y: { min: 0, max: 100, ticks: { callback: v => `${v}%` } },
                                        },
                                    }}
                                />
                            </div>
                        ) : (
                            <p className="empty-text">Henüz veri yok</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default DashboardView;
