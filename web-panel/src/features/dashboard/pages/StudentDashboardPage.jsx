import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Webcam from 'react-webcam';
import { MdSchool, MdCheckCircle, MdWarning, MdHistory, MdRefresh, MdReportProblem } from 'react-icons/md';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
} from 'chart.js';
import { Sidebar } from '../../../shared/components/layout/Sidebar';
import { LanguageSwitcher } from '../../../shared/components/LanguageSwitcher/LanguageSwitcher';
import { SkeletonStatCard, SkeletonTable } from '../../../shared/components/Skeleton';
import apiClient from '../../../shared/services/apiClient';
import './StudentDashboardPage.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const DAYS_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// ── Disputes Panel ───────────────────────────────────────────────────────────
function DisputesPanel({ disputes, courses, onRefresh }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ session_id: '', course_id: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.session_id || !form.course_id || !form.reason.trim()) {
      setError(t('studentDashboard.disputes.errorRequired'));
      return;
    }
    setSubmitting(true); setError(''); setSuccess('');
    try {
      await apiClient.post('/disputes/', {
        session_id: Number(form.session_id),
        course_id: Number(form.course_id),
        reason: form.reason,
      });
      setSuccess(t('studentDashboard.disputes.successSubmit'));
      setForm({ session_id: '', course_id: '', reason: '' });
      onRefresh();
    } catch (err) {
      setError(err.message || t('studentDashboard.disputes.errorSubmit'));
    } finally {
      setSubmitting(false); }
  };

  const statusCls = { pending: 'status-badge pending_review', approved: 'status-badge present', rejected: 'status-badge absent' };

  return (
    <div className="student-disputes">
      <div className="page-header">
        <h1>{t('studentDashboard.disputes.title')}</h1>
        <button className="refresh-btn" onClick={onRefresh}>{t('common.refresh')}</button>
      </div>
      <div className="dispute-form-card">
        <h2>{t('studentDashboard.disputes.newDispute')}</h2>
        <p className="dispute-hint">{t('studentDashboard.disputes.hint')}</p>
        {error && <div className="dispute-error">{error}</div>}
        {success && <div className="dispute-success">{success}</div>}
        <form onSubmit={handleSubmit} className="dispute-form">
          <div className="form-row">
            <label>{t('studentDashboard.disputes.courseLabel')}</label>
            <select value={form.course_id} onChange={e => setForm(f => ({ ...f, course_id: e.target.value }))}>
              <option value="">{t('studentDashboard.disputes.coursePlaceholder')}</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label>{t('studentDashboard.disputes.sessionLabel')}</label>
            <input
              type="number"
              placeholder={t('studentDashboard.disputes.sessionPlaceholder')}
              value={form.session_id}
              onChange={e => setForm(f => ({ ...f, session_id: e.target.value }))}
            />
          </div>
          <div className="form-row">
            <label>{t('studentDashboard.disputes.reasonLabel')}</label>
            <textarea
              rows={3}
              placeholder={t('studentDashboard.disputes.reasonPlaceholder')}
              value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
            />
          </div>
          <button type="submit" className="refresh-btn" disabled={submitting}>
            {submitting ? t('studentDashboard.disputes.submittingBtn') : t('studentDashboard.disputes.submitBtn')}
          </button>
        </form>
      </div>
      <h2 style={{ marginTop: 28, marginBottom: 12 }}>{t('studentDashboard.disputes.past')}</h2>
      {disputes.length === 0 ? (
        <p className="empty-text">{t('studentDashboard.disputes.empty')}</p>
      ) : (
        <table className="attendance-table">
          <thead>
            <tr>
              <th>{t('studentDashboard.disputes.tableHeaders.course')}</th>
              <th>{t('studentDashboard.disputes.tableHeaders.session')}</th>
              <th>{t('studentDashboard.disputes.tableHeaders.reason')}</th>
              <th>{t('studentDashboard.disputes.tableHeaders.status')}</th>
              <th>{t('studentDashboard.disputes.tableHeaders.note')}</th>
              <th>{t('studentDashboard.disputes.tableHeaders.date')}</th>
            </tr>
          </thead>
          <tbody>
            {disputes.map(d => (
              <tr key={d.id}>
                <td>{d.course_code || `#${d.course_id}`}</td>
                <td>#{d.session_id}</td>
                <td>{d.reason}</td>
                <td><span className={statusCls[d.status] || 'status-badge'}>{t(`studentDashboard.disputes.statuses.${d.status}`, d.status)}</span></td>
                <td>{d.instructor_notes || '—'}</td>
                <td>{d.created_at ? new Date(d.created_at).toLocaleDateString('tr-TR') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Web Attendance Component ─────────────────────────────────────────────────
function WebAttendance() {
  const { t } = useTranslation();
  const webcamRef = useRef(null);
  const [step, setStep] = useState('session');   // session | face | location | done | error
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [capturedImage, setCapturedImage] = useState(null);
  const [hasCamera, setHasCamera] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('idle');  // idle | loading | ok | error
  const [gpsData, setGpsData] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiClient.get('/sessions/active');
        setSessions(data || []);
      } catch (e) {
        setError(t('studentDashboard.takeAttendance.errorLoadSessions'));
      } finally {
        setLoadingSessions(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (step === 'face') {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(() => setHasCamera(true))
        .catch(() => setHasCamera(false));
    }
  }, [step]);

  const handleSelectSession = () => {
    if (!selectedSession) { setError(t('studentDashboard.takeAttendance.errorSelectSession')); return; }
    setError('');
    setStep('face');
  };

  const handleCapture = () => {
    if (!webcamRef.current) return;
    const img = webcamRef.current.getScreenshot();
    if (!img) { setError(t('studentDashboard.takeAttendance.errorCapture')); return; }
    setCapturedImage(img);
  };

  const handleGetGPS = () => {
    setGpsStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsData({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setGpsStatus('ok');
      },
      () => {
        setGpsStatus('error');
        setError(t('studentDashboard.takeAttendance.errorGps'));
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const handleSubmit = async () => {
    if (!capturedImage) { setError(t('studentDashboard.takeAttendance.errorNeedPhoto')); return; }
    if (!gpsData) { setError(t('studentDashboard.takeAttendance.errorNeedGps')); return; }
    setSubmitting(true);
    setError('');
    try {
      const res = await apiClient.post('/attendance/web-attend', {
        session_id: Number(selectedSession),
        image_base64: capturedImage,
        latitude: gpsData.latitude,
        longitude: gpsData.longitude,
        accuracy: gpsData.accuracy,
      });
      setResult(res);
      setStep('done');
    } catch (e) {
      setError(e.message || t('studentDashboard.takeAttendance.errorSubmit'));
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setStep('session');
    setSelectedSession('');
    setCapturedImage(null);
    setGpsData(null);
    setGpsStatus('idle');
    setResult(null);
    setError('');
  };

  const WA_STEPS = [
    { key: 'session',  label: t('studentDashboard.takeAttendance.steps.session')  },
    { key: 'face',     label: t('studentDashboard.takeAttendance.steps.face')     },
    { key: 'location', label: t('studentDashboard.takeAttendance.steps.location') },
    { key: 'submit',   label: t('studentDashboard.takeAttendance.steps.submit')   },
  ];

  if (step === 'done' && result) {
    return (
      <div className="wa-container">
        <div className={`wa-result ${result.is_flagged ? 'flagged' : 'success'}`}>
          <div className="wa-result-icon">{result.is_flagged ? '!' : 'OK'}</div>
          <h2>{result.is_flagged ? t('studentDashboard.takeAttendance.resultFlagged') : t('studentDashboard.takeAttendance.resultSuccess')}</h2>
          <p>{result.message}</p>
          {result.is_flagged && (
            <div className="wa-flag-detail">
              <p>{t('studentDashboard.takeAttendance.flaggedInfo')}</p>
              <div className="wa-check-row">
                <span className={`wa-check ${result.face_ok ? 'ok' : 'fail'}`}>
                  {t('studentDashboard.takeAttendance.faceCheck')}: {result.face_ok ? t('common.success') : t('common.failed')}
                </span>
                <span className={`wa-check ${result.location_ok ? 'ok' : 'fail'}`}>
                  {t('studentDashboard.takeAttendance.locationCheck')}: {result.location_ok ? t('common.success') : t('common.failed')}
                </span>
              </div>
            </div>
          )}
          {!result.is_flagged && (
            <div className="wa-check-row">
              <span className="wa-check ok">{t('studentDashboard.takeAttendance.faceCheck')}: {t('common.success')}</span>
              <span className="wa-check ok">{t('studentDashboard.takeAttendance.locationCheck')}: {t('common.success')}</span>
            </div>
          )}
          <button className="wa-btn primary" onClick={reset} style={{ marginTop: '20px' }}>
            {t('studentDashboard.takeAttendance.newAttendance')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="wa-container">
      <div className="wa-header">
        <h1>{t('studentDashboard.takeAttendance.title')}</h1>
        <p className="wa-subtitle">{t('studentDashboard.takeAttendance.subtitle')}</p>
      </div>

      <div className="wa-steps">
        {WA_STEPS.map((s, i) => {
          const idx = WA_STEPS.findIndex(x => x.key === step);
          return (
            <div key={s.key} className={`wa-step ${i <= idx ? 'active' : ''}`}>
              <div className="wa-step-num">{i + 1}</div>
              <div className="wa-step-label">{s.label}</div>
            </div>
          );
        })}
      </div>

      {error && <div className="wa-error">{error}</div>}

      {step === 'session' && (
        <div className="wa-card">
          <h2>{t('studentDashboard.takeAttendance.selectSession')}</h2>
          {loadingSessions ? (
            <p className="wa-hint">{t('common.loading')}</p>
          ) : sessions.length === 0 ? (
            <p className="wa-hint">{t('studentDashboard.takeAttendance.noSessions')}</p>
          ) : (
            <>
              <div className="wa-sessions">
                {sessions.map(s => (
                  <label key={s.id} className={`wa-session-item ${selectedSession === String(s.id) ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="session"
                      value={s.id}
                      checked={selectedSession === String(s.id)}
                      onChange={e => setSelectedSession(e.target.value)}
                      style={{ display: 'none' }}
                    />
                    <div className="wa-session-info">
                      <span className="wa-session-course">{t('studentDashboard.takeAttendance.courseNo', { id: s.course_id })}</span>
                      <span className="wa-session-date">{s.date || '—'}</span>
                    </div>
                    <span className="wa-session-badge">{t('studentDashboard.takeAttendance.active')}</span>
                  </label>
                ))}
              </div>
              <button className="wa-btn primary" onClick={handleSelectSession}>
                {t('common.continue')}
              </button>
            </>
          )}
        </div>
      )}

      {step === 'face' && (
        <div className="wa-card">
          <h2>{t('studentDashboard.takeAttendance.faceRecognition')}</h2>
          <p className="wa-hint">{t('studentDashboard.takeAttendance.faceHint')}</p>
          {hasCamera === false ? (
            <div className="wa-error">{t('studentDashboard.takeAttendance.cameraDenied')}</div>
          ) : (
            <>
              <div className="wa-webcam-wrapper">
                {!capturedImage ? (
                  <>
                    <Webcam
                      ref={webcamRef}
                      audio={false}
                      screenshotFormat="image/jpeg"
                      videoConstraints={{ width: 480, height: 360, facingMode: 'user' }}
                      className="wa-webcam"
                    />
                    <div className="wa-face-guide"></div>
                  </>
                ) : (
                  <img src={capturedImage} alt="captured" className="wa-captured" />
                )}
              </div>
              <div className="wa-btn-row">
                {!capturedImage ? (
                  <button className="wa-btn primary" onClick={handleCapture}>
                    {t('studentDashboard.takeAttendance.captureBtn')}
                  </button>
                ) : (
                  <>
                    <button className="wa-btn secondary" onClick={() => setCapturedImage(null)}>
                      {t('studentDashboard.takeAttendance.retakeBtn')}
                    </button>
                    <button className="wa-btn primary" onClick={() => { setError(''); setStep('location'); }}>
                      {t('common.continue')}
                    </button>
                  </>
                )}
                <button className="wa-btn ghost" onClick={() => setStep('session')}>{t('common.back')}</button>
              </div>
            </>
          )}
        </div>
      )}

      {step === 'location' && (
        <div className="wa-card">
          <h2>{t('studentDashboard.takeAttendance.locationTitle')}</h2>
          <p className="wa-hint">{t('studentDashboard.takeAttendance.locationHint')}</p>
          <div className="wa-gps-status">
            {gpsStatus === 'idle' && (
              <button className="wa-btn primary" onClick={handleGetGPS}>
                {t('studentDashboard.takeAttendance.getLocationBtn')}
              </button>
            )}
            {gpsStatus === 'loading' && <p className="wa-hint">{t('studentDashboard.takeAttendance.gpsLoading')}</p>}
            {gpsStatus === 'ok' && gpsData && (
              <div className="wa-gps-ok">
                <span className="wa-check ok">{t('studentDashboard.takeAttendance.locationObtained')}</span>
                <p className="wa-hint">
                  {gpsData.latitude.toFixed(5)}, {gpsData.longitude.toFixed(5)}
                  {gpsData.accuracy && ` (±${gpsData.accuracy.toFixed(0)}m)`}
                </p>
              </div>
            )}
            {gpsStatus === 'error' && (
              <button className="wa-btn secondary" onClick={handleGetGPS}>{t('common.retry')}</button>
            )}
          </div>
          <div className="wa-btn-row">
            {(gpsStatus === 'ok' || gpsStatus === 'error') && (
              <button
                className="wa-btn primary"
                onClick={() => { setError(''); setStep('submit'); }}
                disabled={gpsStatus !== 'ok'}
              >
                {t('common.continue')}
              </button>
            )}
            <button className="wa-btn ghost" onClick={() => setStep('face')}>{t('common.back')}</button>
          </div>
        </div>
      )}

      {step === 'submit' && (
        <div className="wa-card">
          <h2>{t('studentDashboard.takeAttendance.confirm')}</h2>
          <div className="wa-confirm-grid">
            <div className="wa-confirm-item">
              <span className="wa-confirm-label">{t('studentDashboard.takeAttendance.sessionLabel')}</span>
              <span className="wa-confirm-val">#{selectedSession}</span>
            </div>
            <div className="wa-confirm-item">
              <span className="wa-confirm-label">{t('studentDashboard.takeAttendance.faceCheck')}</span>
              <span className="wa-check ok">{t('studentDashboard.takeAttendance.photoCaptured')}</span>
            </div>
            <div className="wa-confirm-item">
              <span className="wa-confirm-label">{t('studentDashboard.takeAttendance.locationCheck')}</span>
              <span className="wa-check ok">
                {gpsData ? `${gpsData.latitude.toFixed(4)}, ${gpsData.longitude.toFixed(4)}` : '—'}
              </span>
            </div>
          </div>
          <div className="wa-btn-row">
            <button className="wa-btn primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? t('studentDashboard.takeAttendance.submittingBtn') : t('studentDashboard.takeAttendance.submitBtn')}
            </button>
            <button className="wa-btn ghost" onClick={() => setStep('location')}>{t('common.back')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main StudentDashboardPage ────────────────────────────────────────────────
export const StudentDashboardPage = ({ user, onLogout }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('dashboard');

  const STUDENT_MENU_ITEMS = [
    { id: 'dashboard',  label: t('nav.student.dashboard')  },
    { id: 'schedule',   label: t('nav.student.schedule')   },
    { id: 'attendance', label: t('nav.student.attendance') },
    { id: 'take',       label: t('nav.student.takeAttendance') },
    { id: 'disputes',   label: t('nav.student.disputes')   },
  ];
  const [stats, setStats] = useState(null);
  const [courses, setCourses] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyFilter, setHistoryFilter] = useState('');
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleTabChange = (id) => {
    if (id === 'logout') { onLogout(); return; }
    setActiveTab(id);
  };

  const fetchData = useCallback(async (tab) => {
    setLoading(true);
    try {
      switch (tab) {
        case 'dashboard': {
          const [statsRes, coursesRes] = await Promise.allSettled([
            apiClient.get('/dashboard/stats'),
            apiClient.get('/courses/'),
          ]);
          if (statsRes.status === 'fulfilled') setStats(statsRes.value);
          if (coursesRes.status === 'fulfilled') setCourses(coursesRes.value || []);
          break;
        }
        case 'schedule': {
          const data = await apiClient.get('/courses/');
          setCourses(data || []);
          break;
        }
        case 'attendance': {
          const [histRes, coursesRes] = await Promise.allSettled([
            apiClient.get('/attendance/my-history'),
            apiClient.get('/courses/'),
          ]);
          if (histRes.status === 'fulfilled') setHistory(histRes.value || []);
          if (coursesRes.status === 'fulfilled') setCourses(coursesRes.value || []);
          break;
        }
        case 'disputes': {
          const res = await apiClient.get('/disputes/');
          setDisputes(res || []);
          break;
        }
        default: break;
      }
    } catch (err) {
      console.error('Student dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(activeTab); }, [activeTab, fetchData]);

  // ── Overview ────────────────────────────────────────────────────────────────
  const renderDashboard = () => {
    const rate = stats?.attendance_rate ?? 0;
    const attended = stats?.total_sessions_attended ?? 0;
    const total = stats?.total_sessions ?? 0;
    const enrolled = stats?.enrolled_courses ?? 0;

    return (
      <div className="student-overview">
        <div className="page-header">
          <div>
            <h1>{t('studentDashboard.overview.welcome', { name: user.name })}</h1>
            <p className="page-subtitle">
              {user.student_number ? t('studentDashboard.overview.studentNo', { number: user.student_number }) : user.email}
            </p>
          </div>
          <button className="refresh-btn" onClick={() => fetchData('dashboard')}>
            <MdRefresh size={16} style={{marginRight:5}}/>{t('common.refresh')}
          </button>
        </div>
        {loading ? <SkeletonTable rows={5} cols={4} /> : (
          <>
            <div className="stats-grid">
              <div className={`stat-card-lg ${rate >= 75 ? 'green' : 'red'}`}>
                <div className="stat-icon-sm">{rate >= 75 ? <MdCheckCircle size={20}/> : <MdWarning size={20}/>}</div>
                <div className="stat-big">{rate}%</div>
                <div className="stat-lbl-lg">{t('studentDashboard.overview.attendanceRate')}</div>
              </div>
              <div className="stat-card-lg blue">
                <div className="stat-icon-sm"><MdCheckCircle size={20}/></div>
                <div className="stat-big">{attended}</div>
                <div className="stat-lbl-lg">{t('studentDashboard.overview.attended')}</div>
              </div>
              <div className="stat-card-lg purple">
                <div className="stat-icon-sm"><MdHistory size={20}/></div>
                <div className="stat-big">{total}</div>
                <div className="stat-lbl-lg">{t('studentDashboard.overview.totalSessions')}</div>
              </div>
              <div className="stat-card-lg orange">
                <div className="stat-icon-sm"><MdSchool size={20}/></div>
                <div className="stat-big">{enrolled}</div>
                <div className="stat-lbl-lg">{t('studentDashboard.overview.enrolledCourses')}</div>
              </div>
            </div>
            {rate < 75 && (
              <div className="attendance-warning">
                {t('studentDashboard.overview.lowAttendanceWarning', { rate })}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  // ── Schedule ─────────────────────────────────────────────────────────────────
  const renderSchedule = () => {
    const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const grouped = {};
    DAYS_ORDER.forEach(d => { grouped[d] = []; });
    courses.forEach(c => {
      if (c.schedule?.days) {
        c.schedule.days.forEach(day => {
          if (grouped[day] !== undefined) grouped[day].push(c);
        });
      }
    });
    const today = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];

    return (
      <div className="student-schedule">
        <div className="page-header">
          <h1>{t('studentDashboard.schedule.title')}</h1>
          <button className="refresh-btn" onClick={() => fetchData('schedule')}>{t('common.refresh')}</button>
        </div>
        {loading ? <SkeletonTable rows={5} cols={4} /> : (
          <div className="schedule-table-wrapper">
            <table className="schedule-table">
              <thead>
                <tr>
                  {DAYS_ORDER.map(day => (
                    <th key={day} className={day === today ? 'today-col' : ''}>
                      <div>{t(`studentDashboard.schedule.daysShort.${day}`)}</div>
                      <div className="day-full">{t(`studentDashboard.schedule.daysFull.${day}`)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {DAYS_ORDER.map(day => (
                    <td key={day} className={day === today ? 'today-col' : ''}>
                      {grouped[day].length === 0 ? (
                        <span className="no-class">—</span>
                      ) : (
                        grouped[day].map(c => (
                          <div key={c.id} className="sch-course-cell">
                            <div className="sch-code">{c.code}</div>
                            <div className="sch-name">{c.name}</div>
                            {c.schedule?.start_time && (
                              <div className="sch-time">
                                {c.schedule.start_time} – {c.schedule.end_time}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
            {courses.every(c => !c.schedule?.days?.length) && (
              <p className="empty-text" style={{ textAlign: 'center', marginTop: '32px' }}>
                {t('studentDashboard.schedule.noSchedule')}
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  // ── Attendance History ───────────────────────────────────────────────────────
  const renderAttendance = () => {
    const filtered = historyFilter
      ? history.filter(r => String(r.course_id) === historyFilter)
      : history;

    const presentCount = filtered.filter(r => r.status === 'present').length;
    const rate = filtered.length ? Math.round((presentCount / filtered.length) * 100) : 0;

    // Per-course statistics for the bar chart
    const courseStats = {};
    history.forEach(r => {
      const key = String(r.course_id);
      if (!courseStats[key]) {
        courseStats[key] = { code: r.course_code || `#${r.course_id}`, total: 0, present: 0 };
      }
      courseStats[key].total += 1;
      if (r.status === 'present') courseStats[key].present += 1;
    });
    const statEntries = Object.values(courseStats).map(s => ({
      ...s,
      rate: s.total > 0 ? Math.round((s.present / s.total) * 100) : 0,
    }));

    const chartData = {
      labels: statEntries.map(s => s.code),
      datasets: [{
        label: 'Devam Oranı (%)',
        data: statEntries.map(s => s.rate),
        backgroundColor: statEntries.map(s => s.rate >= 70 ? 'rgba(34,197,94,0.75)' : 'rgba(239,68,68,0.75)'),
        borderColor: statEntries.map(s => s.rate >= 70 ? '#16a34a' : '#dc2626'),
        borderWidth: 1,
        borderRadius: 6,
      }],
    };
    const chartOptions = {
      responsive: true,
      plugins: {
        legend: { display: false },
                title: { display: true, text: t('studentDashboard.attendance.chartTitle'), font: { size: 14 } },
        tooltip: { callbacks: { label: ctx => `${ctx.raw}%` } },
      },
      scales: {
        y: { min: 0, max: 100, ticks: { callback: v => `${v}%` } },
      },
    };

    const lowAttendanceCourses = statEntries.filter(s => s.rate < 70);

    return (
      <div className="student-attendance">
        <div className="page-header">
          <h1>{t('studentDashboard.attendance.title')}</h1>
          <button className="refresh-btn" onClick={() => fetchData('attendance')}>{t('common.refresh')}</button>
        </div>
        {loading ? <SkeletonTable rows={5} cols={4} /> : (
          <>
            {/* Per-course bar chart */}
            {statEntries.length > 0 && (
              <div className="att-chart-section">
                {lowAttendanceCourses.length > 0 && (
                  <div className="att-low-warning">
                    <MdWarning size={18} style={{ marginRight: 6, flexShrink: 0 }} />
                    <span>
                      <strong>{t('studentDashboard.attendance.warning')}</strong> {t('studentDashboard.attendance.warningText')}{' '}
                      {lowAttendanceCourses.map(s => `${s.code} (%${s.rate})`).join(', ')}
                    </span>
                  </div>
                )}
                <div className="att-chart-wrapper">
                  <Bar data={chartData} options={chartOptions} />
                </div>
              </div>
            )}

            <div className="att-filter-row">
              <select
                className="att-filter-select"
                value={historyFilter}
                onChange={e => setHistoryFilter(e.target.value)}
              >
                <option value="">{t('studentDashboard.attendance.allCourses')}</option>
                {courses.map(c => (
                  <option key={c.id} value={String(c.id)}>{c.code} — {c.name}</option>
                ))}
              </select>
              {filtered.length > 0 && (
                <div className="att-summary">
                  <span>{t('studentDashboard.attendance.summary', { present: presentCount, total: filtered.length })}</span>
                  <span className={`att-rate ${rate >= 70 ? 'good' : 'bad'}`}>%{rate}</span>
                </div>
              )}
            </div>
            <div className="attendance-table-container">
              <table className="attendance-table">
                <thead>
                  <tr>
                    <th>{t('studentDashboard.attendance.headers.date')}</th>
                    <th>{t('studentDashboard.attendance.headers.course')}</th>
                    <th>{t('studentDashboard.attendance.headers.status')}</th>
                    <th>{t('studentDashboard.attendance.headers.face')}</th>
                    <th>{t('studentDashboard.attendance.headers.location')}</th>
                    <th>{t('studentDashboard.attendance.headers.flag')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan="6" className="empty-cell">{t('studentDashboard.attendance.notFound')}</td></tr>
                  ) : (
                    filtered.map(r => (
                      <tr key={r.id} className={r.is_flagged ? 'flagged-row' : ''}>
                        <td>{r.marked_at ? new Date(r.marked_at).toLocaleDateString('tr-TR') : '—'}</td>
                        <td>
                          <strong>{r.course_code || `#${r.course_id}`}</strong>
                          {r.course_name && <div className="sub-text">{r.course_name}</div>}
                        </td>
                        <td>
                          <span className={`status-badge ${r.status}`}>
                            {t(`studentDashboard.attendance.statuses.${r.status}`, r.status)}
                          </span>
                        </td>
                        <td>
                          {r.verification_steps ? (
                            <span className={`step-badge ${r.verification_steps.face_ok ? 'face' : 'fail'}`}>
                              {r.verification_steps.face_ok ? 'OK' : t('common.error')}
                            </span>
                          ) : '—'}
                        </td>
                        <td>
                          {r.verification_steps ? (
                            <span className={`step-badge ${r.verification_steps.location_ok ? 'gps' : 'fail'}`}>
                              {r.verification_steps.location_ok ? 'OK' : r.verification_steps.location_skipped ? t('studentDashboard.attendance.skipped') : t('common.error')}
                            </span>
                          ) : '—'}
                        </td>
                        <td>
                          {r.is_flagged
                            ? <span className="flag-badge">{t('studentDashboard.attendance.suspicious')}</span>
                            : <span className="ok-badge">{t('studentDashboard.attendance.normal')}</span>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    );
  };

  // ── Disputes ─────────────────────────────────────────────────────────────────
  const renderDisputes = () => (
    <DisputesPanel
      disputes={disputes}
      courses={courses}
      onRefresh={() => fetchData('disputes')}
    />
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':  return renderDashboard();
      case 'schedule':   return renderSchedule();
      case 'attendance': return renderAttendance();
      case 'take':       return <WebAttendance />;
      case 'disputes':   return renderDisputes();
      default:           return renderDashboard();
    }
  };

  return (
    <div className="student-dashboard-container">
      <Sidebar
        title={t('nav.systemTitle')}
        subtitle={t('nav.studentPortal')}
        menuItems={STUDENT_MENU_ITEMS}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        user={user}
        onLogout={onLogout}
      />
      <div className="student-main-wrapper">
        <div className="student-top-bar">
          <div className="top-bar-spacer" />
          <LanguageSwitcher compact />
        </div>
        <main className="main-content">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};
