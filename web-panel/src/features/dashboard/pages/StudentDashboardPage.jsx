import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import Webcam from 'react-webcam';
import { MdSchool, MdCheckCircle, MdWarning, MdHistory, MdRefresh } from 'react-icons/md';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
} from 'chart.js';
import { Sidebar } from '../../../shared/components/layout/Sidebar';
import { LanguageSwitcher } from '../../../shared/components/LanguageSwitcher/LanguageSwitcher';
import { NotificationBell } from '../../../shared/components/NotificationBell/NotificationBell';
import { SkeletonTable } from '../../../shared/components/Skeleton';
import apiClient from '../../../shared/services/apiClient';
import { useActiveSessionsQuery, activeSessionsQueryKey } from '../../../shared/query/hooks/useActiveSessionsQuery';
import './StudentDashboardPage.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const readStudentTabFromUrl = () => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  const validTabs = ['dashboard', 'schedule', 'attendance', 'excuses', 'take', 'disputes'];
  return validTabs.includes(tab) ? tab : null;
};

const readCancellationContextFromUrl = () => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const notifyType = params.get('notify_type');
  if (notifyType !== 'class_cancelled') return null;
  const courseIdRaw = params.get('course_id');
  const cancellationIdRaw = params.get('cancellation_id');
  const toInt = (value) => {
    const parsed = parseInt(value || '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };
  return {
    course_id: toInt(courseIdRaw),
    cancellation_id: toInt(cancellationIdRaw),
    course_name: params.get('course_name') || '',
    course_code: params.get('course_code') || '',
    date: params.get('date') || '',
    start_time: params.get('start_time') || '',
    end_time: params.get('end_time') || '',
    reason: params.get('reason') || '',
    topic: params.get('topic') || '',
  };
};

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
  const queryClient = useQueryClient();
  const webcamRef = useRef(null);
  const [step, setStep] = useState('session');   // session | face | location | done | error
  const [selectedSession, setSelectedSession] = useState('');
  const [capturedImage, setCapturedImage] = useState(null);
  const [hasCamera, setHasCamera] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('idle');  // idle | loading | ok | error
  const [gpsData, setGpsData] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [locationRetryInfo, setLocationRetryInfo] = useState(null);
  const [completedSessionIds, setCompletedSessionIds] = useState(() => new Set());
  const [loadingHistory, setLoadingHistory] = useState(false);

  const {
    data: sessions = [],
    isPending: loadingSessions,
    isError: sessionsQueryError,
    error: sessionsLoadError,
  } = useActiveSessionsQuery();

  // Disable already completed sessions (prevents duplicate attendance)
  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const hist = await apiClient.get('/attendance/my-history');
      const ids = new Set((hist || []).map(r => String(r.session_id)));
      setCompletedSessionIds(ids);
    } catch {
      setCompletedSessionIds(new Set());
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  useEffect(() => {
    if (step === 'face') {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(() => setHasCamera(true))
        .catch(() => setHasCamera(false));
    }
  }, [step]);

  const handleSelectSession = () => {
    if (!selectedSession) { setError(t('studentDashboard.takeAttendance.errorSelectSession')); return; }
    if (completedSessionIds.has(String(selectedSession))) {
      setError(t('studentDashboard.takeAttendance.alreadyTaken'));
      return;
    }
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
    setLocationRetryInfo(null);
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

  const parseLocationRetryInfo = useCallback((message = '') => {
    if (
      !message ||
      (!message.includes('Konum doğrulaması başarısız') &&
       !message.includes('Location verification failed'))
    ) return null;
    const distanceMatch = message.match(/(?:Mevcut mesafe|Current distance):\s*([\d.]+)m/i);
    const retryMatch = message.match(/\((\d+)\s*\/\s*(\d+)\)/);
    return {
      distanceM: distanceMatch ? Math.round(parseFloat(distanceMatch[1])) : null,
      current: retryMatch ? Number(retryMatch[1]) : null,
      total: retryMatch ? Number(retryMatch[2]) : null,
      message,
    };
  }, []);

  const handleSubmit = async () => {
    if (!capturedImage) { setError(t('studentDashboard.takeAttendance.errorNeedPhoto')); return; }
    if (!gpsData) { setError(t('studentDashboard.takeAttendance.errorNeedGps')); return; }
    if (completedSessionIds.has(String(selectedSession))) {
      setError(t('studentDashboard.takeAttendance.alreadyTaken'));
      return;
    }
    setSubmitting(true);
    setError('');
    setLocationRetryInfo(null);
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
      setCompletedSessionIds(prev => {
        const next = new Set(prev);
        next.add(String(selectedSession));
        return next;
      });
      queryClient.invalidateQueries({ queryKey: activeSessionsQueryKey });
    } catch (e) {
      const msg = e.message || t('studentDashboard.takeAttendance.errorSubmit');
      const retryInfo = parseLocationRetryInfo(msg);
      if (retryInfo) {
        setLocationRetryInfo(retryInfo);
        setStep('location');
      }
      setError(msg);
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
    setLocationRetryInfo(null);
  };

  const WA_STEPS = [
    { key: 'session',  label: t('studentDashboard.takeAttendance.steps.session')  },
    { key: 'face',     label: t('studentDashboard.takeAttendance.steps.face')     },
    { key: 'location', label: t('studentDashboard.takeAttendance.steps.location') },
    { key: 'submit',   label: t('studentDashboard.takeAttendance.steps.submit')   },
  ];

  if (step === 'done' && result) {
    const showGpsCelebration = !result.is_flagged && result.location_ok;
    const distM = result.location_distance_m;
    const accM = gpsData?.accuracy;

    return (
      <div className="wa-container">
        <div className={`wa-result ${result.is_flagged ? 'flagged' : 'success'}`}>
          <div className={`wa-result-icon-wrap${showGpsCelebration ? ' wa-result-icon-wrap--pulse' : ''}`}>
            <div className="wa-result-icon">{result.is_flagged ? '!' : '✓'}</div>
          </div>
          <h2>{result.is_flagged ? t('studentDashboard.takeAttendance.resultFlagged') : t('studentDashboard.takeAttendance.resultSuccess')}</h2>
          <p>{result.message}</p>

          {showGpsCelebration && (
            <div className="wa-gps-feedback" role="status">
              <div className="wa-gps-feedback-title">{t('studentDashboard.takeAttendance.gpsVerifiedTitle')}</div>
              <p className="wa-gps-feedback-text">{t('studentDashboard.takeAttendance.gpsVerifiedBody')}</p>
              {result.location_skipped ? (
                <p className="wa-gps-feedback-meta">{t('studentDashboard.takeAttendance.gpsSkippedHint')}</p>
              ) : (
                <>
                  {typeof distM === 'number' && !Number.isNaN(distM) && (
                    <p className="wa-gps-feedback-meta">
                      {t('studentDashboard.takeAttendance.gpsDistanceHint', { m: Math.round(distM) })}
                    </p>
                  )}
                  {typeof accM === 'number' && !Number.isNaN(accM) && (
                    <p className="wa-gps-feedback-meta">
                      {t('studentDashboard.takeAttendance.gpsAccuracyHint', { m: Math.round(accM) })}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

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
          <button type="button" className="wa-btn primary" onClick={reset} style={{ marginTop: '20px' }}>
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
      {sessionsQueryError && (
        <div className="wa-error" role="alert">
          {sessionsLoadError?.message || t('studentDashboard.takeAttendance.errorLoadSessions')}
        </div>
      )}

      {step === 'session' && (
        <div className="wa-card">
          <h2>{t('studentDashboard.takeAttendance.selectSession')}</h2>
          {loadingSessions ? (
            <p className="wa-hint">{t('common.loading')}</p>
          ) : loadingHistory ? (
            <p className="wa-hint">{t('common.loading')}</p>
          ) : sessions.length === 0 ? (
            <p className="wa-hint">{t('studentDashboard.takeAttendance.noSessions')}</p>
          ) : (
            <>
              <div className="wa-sessions">
                {sessions.map(s => (
                  <label
                    key={s.id}
                    className={`wa-session-item ${selectedSession === String(s.id) ? 'selected' : ''} ${completedSessionIds.has(String(s.id)) ? 'disabled' : ''}`}
                    title={completedSessionIds.has(String(s.id)) ? t('studentDashboard.takeAttendance.alreadyTaken') : ''}
                  >
                    <input
                      type="radio"
                      name="session"
                      value={s.id}
                      checked={selectedSession === String(s.id)}
                      onChange={e => setSelectedSession(e.target.value)}
                      style={{ display: 'none' }}
                      disabled={completedSessionIds.has(String(s.id))}
                    />
                    <div className="wa-session-info">
                      <span className="wa-session-course">{t('studentDashboard.takeAttendance.courseNo', { id: s.course_id })}</span>
                      <span className="wa-session-date">{s.date || '—'}</span>
                    </div>
                    <span className="wa-session-badge">
                      {completedSessionIds.has(String(s.id))
                        ? t('studentDashboard.takeAttendance.taken')
                        : t('studentDashboard.takeAttendance.active')}
                    </span>
                  </label>
                ))}
              </div>
              <button
                className="wa-btn primary"
                onClick={handleSelectSession}
                disabled={!selectedSession || completedSessionIds.has(String(selectedSession))}
              >
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
            {locationRetryInfo && (
              <div className="wa-error" role="alert" style={{ marginBottom: 12 }}>
                {t('studentDashboard.takeAttendance.locationRetryHint', {
                  current: locationRetryInfo.current ?? 1,
                  total: locationRetryInfo.total ?? 2,
                })}
                {typeof locationRetryInfo.distanceM === 'number' && (
                  <div style={{ marginTop: 6 }}>
                    {t('studentDashboard.takeAttendance.gpsDistanceHint', { m: locationRetryInfo.distanceM })}
                  </div>
                )}
              </div>
            )}
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
  const initialTab = useMemo(() => readStudentTabFromUrl() || 'dashboard', []);
  const cancelContext = useMemo(() => readCancellationContextFromUrl(), []);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [selectedScheduleCourse, setSelectedScheduleCourse] = useState(null);
  const [scheduleCancellationNotice, setScheduleCancellationNotice] = useState(cancelContext);

  const STUDENT_MENU_ITEMS = [
    { id: 'dashboard',  label: t('nav.student.dashboard')  },
    { id: 'schedule',   label: t('nav.student.schedule')   },
    { id: 'attendance', label: t('nav.student.attendance') },
    { id: 'excuses',    label: t('nav.student.excuses')    },
    { id: 'take',       label: t('nav.student.takeAttendance') },
    { id: 'disputes',   label: t('nav.student.disputes')   },
  ];
  const [stats, setStats] = useState(null);
  const [courses, setCourses] = useState([]);
  const [history, setHistory] = useState([]);
  const [excusesHistory, setExcusesHistory] = useState([]);
  const [historyFilter, setHistoryFilter] = useState('');
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openingExcuseId, setOpeningExcuseId] = useState(null);

  const formatCourseDays = useCallback((schedule) => {
    if (!schedule || typeof schedule !== 'object') return '—';
    if (Array.isArray(schedule.slots) && schedule.slots.length > 0) {
      return schedule.slots.map(slot => slot.day).join(', ');
    }
    if (Array.isArray(schedule.days) && schedule.days.length > 0) {
      return schedule.days.join(', ');
    }
    return '—';
  }, []);

  const formatCourseTimes = useCallback((schedule) => {
    if (!schedule || typeof schedule !== 'object') return '—';
    if (Array.isArray(schedule.slots) && schedule.slots.length > 0) {
      return schedule.slots
        .map(slot => `${slot.day}: ${slot.start_time || '--:--'} - ${slot.end_time || '--:--'}`)
        .join(' | ');
    }
    if (schedule.start_time || schedule.end_time) {
      return `${schedule.start_time || '--:--'} - ${schedule.end_time || '--:--'}`;
    }
    return '—';
  }, []);

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
        case 'excuses': {
          const [excusesRes, coursesRes] = await Promise.allSettled([
            apiClient.get('/excuses/'),
            apiClient.get('/courses/'),
          ]);
          if (excusesRes.status === 'fulfilled') setExcusesHistory(excusesRes.value || []);
          if (coursesRes.status === 'fulfilled') setCourses(coursesRes.value || []);
          break;
        }
        case 'disputes': {
          const [disputesRes, coursesRes] = await Promise.allSettled([
            apiClient.get('/disputes/'),
            apiClient.get('/courses/'),
          ]);
          if (disputesRes.status === 'fulfilled') setDisputes(disputesRes.value || []);
          if (coursesRes.status === 'fulfilled') setCourses(coursesRes.value || []);
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

  useEffect(() => {
    if (!cancelContext || activeTab !== 'schedule') return;
    setScheduleCancellationNotice(cancelContext);
  }, [activeTab, cancelContext]);

  const handleOpenExcuseDocument = useCallback(async (excuseId) => {
    if (!excuseId) return;
    setOpeningExcuseId(excuseId);
    try {
      const response = await apiClient.get(`/excuses/${excuseId}/document`);
      const signedUrl = response?.signed_url;
      if (!signedUrl) {
        throw new Error(t('studentDashboard.excusesHistory.documentOpenFailed'));
      }
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      const message = err?.message || t('studentDashboard.excusesHistory.documentOpenFailed');
      window.alert(message);
    } finally {
      setOpeningExcuseId(null);
    }
  }, [t]);

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
    const TIME_SLOTS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
    const TODAY_INDEX = (() => { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; })();

    const scheduleByDay = {};
    const seenByDay = {};
    DAYS_ORDER.forEach((d) => {
      scheduleByDay[d] = [];
      seenByDay[d] = new Set();
    });

    courses.forEach((course, idx) => {
      const sch = course.schedule;
      if (!sch) return;
      const colorPalette = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];
      const color = colorPalette[idx % colorPalette.length];

      const pushCourse = (day, start, end) => {
        if (!DAYS_ORDER.includes(day)) return;
        const startTime = start || '09:00';
        const endTime = end || '10:00';
        const dedupeKey = `${course.code || course.id}|${day}|${startTime}|${endTime}`;
        if (seenByDay[day].has(dedupeKey)) return;
        seenByDay[day].add(dedupeKey);

        scheduleByDay[day].push({
          ...course,
          _slotTime: `${startTime} – ${endTime}`,
          _startTime: startTime,
          _endTime: endTime,
          _color: color,
        });
      };

      if (Array.isArray(sch.slots) && sch.slots.length > 0) {
        sch.slots.forEach((slot) => pushCourse(slot.day, slot.start_time, slot.end_time));
      } else if (Array.isArray(sch.days) && sch.days.length > 0) {
        sch.days.forEach((day) => pushCourse(day, sch.start_time, sch.end_time));
      }
    });

    return (
      <div className="student-schedule">
        <div className="page-header">
          <h1>{t('studentDashboard.schedule.title')}</h1>
          <button className="refresh-btn" onClick={() => fetchData('schedule')}>{t('common.refresh')}</button>
        </div>
        {scheduleCancellationNotice && (
          <div className="schedule-cancel-notice">
            <div className="schedule-cancel-title">
              {t('studentDashboard.schedule.cancelNoticeTitle')}
            </div>
            <div className="schedule-cancel-line">
              {(scheduleCancellationNotice.course_code || '#')}{scheduleCancellationNotice.course_name ? ` — ${scheduleCancellationNotice.course_name}` : ''}
            </div>
            <div className="schedule-cancel-line">
              {scheduleCancellationNotice.date || '—'}
              {scheduleCancellationNotice.start_time
                ? ` • ${scheduleCancellationNotice.start_time}${scheduleCancellationNotice.end_time ? ` - ${scheduleCancellationNotice.end_time}` : ''}`
                : ''}
            </div>
            {scheduleCancellationNotice.topic && (
              <div className="schedule-cancel-line">{t('studentDashboard.schedule.cancelNoticeTopic')}: {scheduleCancellationNotice.topic}</div>
            )}
            {scheduleCancellationNotice.reason && (
              <div className="schedule-cancel-line">{t('studentDashboard.schedule.cancelNoticeReason')}: {scheduleCancellationNotice.reason}</div>
            )}
          </div>
        )}
        {loading ? <SkeletonTable rows={5} cols={4} /> : (
          <div className="student-weekly-container">
            <div className="student-weekly-grid">
              <div className="student-time-column">
                <div className="student-time-header"></div>
                {TIME_SLOTS.map(time => <div key={time} className="student-time-slot">{time}</div>)}
              </div>

              {DAYS_ORDER.map((day, dayIndex) => {
                const daySchedule = scheduleByDay[day] || [];
                const isToday = dayIndex === TODAY_INDEX;
                return (
                  <div key={day} className="student-day-column">
                    <div className={`student-day-header ${isToday ? 'today' : ''}`}>
                      <div className="student-day-name">{t(`studentDashboard.schedule.daysFull.${day}`)}</div>
                      {isToday && <div className="student-today-badge">{t('schedule.today')}</div>}
                    </div>
                    <div className="student-day-slots">
                      {TIME_SLOTS.map((time) => {
                        const hour = Number(time.split(':')[0]);
                        const classItems = daySchedule.filter((course) => Number((course._startTime || '00:00').split(':')[0]) === hour);
                        return (
                          <div key={`${day}-${time}`} className={`student-schedule-slot ${classItems.length > 0 ? 'has-class' : ''}`}>
                            {classItems.map((course, idx) => (
                              <button
                                key={`${course.id}-${course.code}-${course._startTime}-${idx}`}
                                type="button"
                                className="student-class-info"
                                style={{ background: course._color }}
                                onClick={() => setSelectedScheduleCourse(course)}
                              >
                                <div className="student-class-code">{course.code}</div>
                                <div className="student-class-name">{course.name}</div>
                                <div className="student-class-time">{course._slotTime}</div>
                              </button>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            {courses.every(c => !c.schedule?.days?.length && !c.schedule?.slots?.length) && (
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

  const renderExcuses = () => {
    const excuseStatusClass = {
      pending: 'status-badge pending_review',
      approved: 'status-badge present',
      rejected: 'status-badge absent',
    };

    return (
      <div className="student-excuse-history">
        <div className="page-header">
          <h1>{t('studentDashboard.excusesHistory.title')}</h1>
          <button className="refresh-btn" onClick={() => fetchData('excuses')}>{t('common.refresh')}</button>
        </div>
        {loading ? <SkeletonTable rows={5} cols={6} /> : (
          excusesHistory.length === 0 ? (
            <p className="empty-text">{t('studentDashboard.excusesHistory.empty')}</p>
          ) : (
            <div className="attendance-table-container">
              <table className="attendance-table">
                <thead>
                  <tr>
                    <th>{t('studentDashboard.excusesHistory.headers.course')}</th>
                    <th>{t('studentDashboard.excusesHistory.headers.sessionDate')}</th>
                    <th>{t('studentDashboard.excusesHistory.headers.type')}</th>
                    <th>{t('studentDashboard.excusesHistory.headers.document')}</th>
                    <th>{t('studentDashboard.excusesHistory.headers.status')}</th>
                    <th>{t('studentDashboard.excusesHistory.headers.note')}</th>
                    <th>{t('studentDashboard.excusesHistory.headers.created')}</th>
                  </tr>
                </thead>
                <tbody>
                  {excusesHistory.map((e) => (
                    <tr key={e.id}>
                      <td>{e.course_code || `#${e.course_id}`}</td>
                      <td>{e.session_date || '—'}</td>
                      <td>{t(`excuses.types.${e.excuse_type}`, e.excuse_type || 'other')}</td>
                      <td>
                        {Boolean(e.storage_path) && (e.upload_status || 'uploaded') === 'uploaded' ? (
                          <button
                            type="button"
                            className="excuse-doc-btn"
                            onClick={() => handleOpenExcuseDocument(e.id)}
                            disabled={openingExcuseId === e.id}
                          >
                            {openingExcuseId === e.id
                              ? t('studentDashboard.excusesHistory.openingDocument')
                              : t('studentDashboard.excusesHistory.openDocument')}
                          </button>
                        ) : (
                          <span className="excuse-doc-status">
                            {(e.upload_status || 'none') === 'pending'
                              ? t('studentDashboard.excusesHistory.documentStates.pending')
                              : (e.upload_status || 'none') === 'failed'
                                ? t('studentDashboard.excusesHistory.documentStates.failed')
                                : t('studentDashboard.excusesHistory.documentStates.none')}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={excuseStatusClass[e.status] || 'status-badge'}>
                          {t(`excuses.statuses.${e.status}`, e.status || 'pending')}
                        </span>
                      </td>
                      <td>{e.instructor_notes || e.description || '—'}</td>
                      <td>{e.created_at ? new Date(e.created_at).toLocaleDateString('tr-TR') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
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
      case 'excuses':    return renderExcuses();
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
          <NotificationBell />
        </div>
        <main className="main-content">
          {renderContent()}
        </main>
      </div>
      {selectedScheduleCourse && (
        <div className="course-detail-overlay" onClick={() => setSelectedScheduleCourse(null)}>
          <div className="course-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="course-detail-header">
              <h3>{t('studentDashboard.schedule.courseDetailTitle')}</h3>
              <button type="button" className="course-detail-close" onClick={() => setSelectedScheduleCourse(null)}>
                {t('common.close')}
              </button>
            </div>
            <div className="course-detail-body">
              <p><strong>{t('studentDashboard.schedule.courseCode')}:</strong> {selectedScheduleCourse.code || '—'}</p>
              <p><strong>{t('studentDashboard.schedule.courseName')}:</strong> {selectedScheduleCourse.name || '—'}</p>
              <p><strong>{t('studentDashboard.schedule.daysLabel')}:</strong> {formatCourseDays(selectedScheduleCourse.schedule)}</p>
              <p><strong>{t('studentDashboard.schedule.timeLabel')}:</strong> {formatCourseTimes(selectedScheduleCourse.schedule)}</p>
              {selectedScheduleCourse.instructor_name && (
                <p><strong>{t('studentDashboard.schedule.instructor')}:</strong> {selectedScheduleCourse.instructor_name}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
