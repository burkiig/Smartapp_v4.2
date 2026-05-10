import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { useTranslation } from 'react-i18next';
import apiClient from '../../shared/services/apiClient';
import { useSessionQR } from '../attendance/hooks/useSessionQR';
import { useInstructorSessionBootstrap } from '../attendance/hooks/useInstructorSessionBootstrap';
import { useSessionPublicStats } from '../attendance/hooks/useSessionPublicStats';
import { SessionStartForm } from '../attendance/components/SessionStartForm';
import { openProjectorAttendanceWindow } from './projectorUtils';
import { MaterialZoomFrame } from './MaterialZoomFrame';
import '../attendance/components/QRScan.css';
import './ClassroomPage.css';

const PENDING_QR_KEY = 'smartapp_classroom_pending_qr';
const QR_RAIL_EXIT_MS = 460;
const MATERIALS_STORAGE_KEY = 'smartapp_classroom_materials_v1';
const MATERIALS_ACTIVE_KEY = 'smartapp_classroom_material_active';

function newMaterialId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function readMaterialsFromStorage() {
  try {
    const raw = localStorage.getItem(MATERIALS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => x && x.id && x.url)
      .map((x) => ({
        id: String(x.id),
        title: String(x.title || '').trim() || String(x.url).slice(0, 48),
        url: String(x.url || '').trim(),
      }));
  } catch {
    return [];
  }
}

function readActiveMaterialIdFromStorage(materials) {
  try {
    const saved = localStorage.getItem(MATERIALS_ACTIVE_KEY);
    if (saved && materials.some((m) => m.id === saved)) return saved;
  } catch {
    /* ignore */
  }
  return materials[0]?.id ?? null;
}

/** @param {string | undefined} dateStr @param {string | undefined} timeStr */
function parseSessionLocalEnd(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const dayPart = String(dateStr).split('T')[0];
  const [y, m, d] = dayPart.split('-').map(Number);
  if (!y || !m || !d) return null;
  const match = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

function formatCountdown(ms) {
  if (ms <= 0) return '0:00';
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Slides/Docs/Sheets “edit” URLs → embed-friendly “preview” (Google-hosted only). */
function cleanPresentationLink(originalLink) {
  const raw = String(originalLink || '').trim();
  if (!raw) return '';
  let url = raw;
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  if (/docs\.google\.com/i.test(url)) {
    return url.replace(/\/edit.*$/i, '/preview');
  }
  return url;
}

function getFullscreenElement() {
  const doc = document;
  return doc.fullscreenElement
    || doc.webkitFullscreenElement
    || doc.msFullscreenElement
    || null;
}

async function exitDocumentFullscreen() {
  const fs = getFullscreenElement();
  if (!fs) return;
  try {
    if (document.exitFullscreen) await document.exitFullscreen();
    else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
    else if (document.msExitFullscreen) await document.msExitFullscreen();
  } catch {
    /* ignore — user gesture may be required in some browsers */
  }
}

/** @param {HTMLElement | null} el */
async function requestElementFullscreen(el) {
  if (!el) return false;
  try {
    if (el.requestFullscreen) await el.requestFullscreen();
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    else if (el.msRequestFullscreen) await el.msRequestFullscreen();
    return true;
  } catch {
    return false;
  }
}

function QRContainer({
  activeQR,
  showStatic,
  setShowStatic,
  qrCountdown,
  checkedInCount,
  t,
  manualRotate,
  onOpenProjector,
  onDownloadStatic,
  onEndSession,
  onCloseQR,
  isClosing,
}) {
  const src = showStatic ? activeQR?.staticQrImage : activeQR?.qrImage;
  return (
    <div className={`classroom-qr-container${isClosing ? ' classroom-qr-container--exiting' : ''}`}>
      <div className="classroom-qr-head">
        <h3 className="classroom-qr-title">
          #{activeQR.sessionId}
        </h3>
        <div className="classroom-qr-tabs-inline qr-tab-bar">
          <button
            type="button"
            className={`qr-tab classroom-qr-tab-sm${!showStatic ? ' qr-tab-active' : ''}`}
            onClick={() => setShowStatic(false)}
          >
            🔄
          </button>
          <button
            type="button"
            className={`qr-tab classroom-qr-tab-sm${showStatic ? ' qr-tab-active' : ''}`}
            onClick={() => setShowStatic(true)}
            disabled={!activeQR.staticQrImage}
          >
            📌
          </button>
        </div>
      </div>
      <p className="classroom-qr-checked-inline">
        {t('classroom.checkedIn', { count: checkedInCount ?? '—' })}
      </p>
      {!showStatic && (
        <p className="classroom-qr-ttl-inline">
          {qrCountdown}s
        </p>
      )}
      <div className="classroom-qr-container-img-wrap">
        {src ? (
          <img src={src} alt="" className="classroom-qr-container-img" />
        ) : (
          <p className="no-qr classroom-qr-noimg">{t('qrScan.errorLoadQR')}</p>
        )}
      </div>
      <div className="classroom-qr-iconbar" role="toolbar" aria-label={t('qrScan.qrCode')}>
        <button
          type="button"
          className="classroom-qr-iconbtn"
          title={t('classroom.iconProjector')}
          aria-label={t('classroom.iconProjector')}
          onClick={onOpenProjector}
        >
          🖥
        </button>
        {!showStatic && (
          <button
            type="button"
            className="classroom-qr-iconbtn"
            title={t('classroom.iconRefreshQr')}
            aria-label={t('classroom.iconRefreshQr')}
            onClick={() => manualRotate()}
          >
            🔃
          </button>
        )}
        {showStatic && activeQR.staticQrImage && (
          <button
            type="button"
            className="classroom-qr-iconbtn"
            title={t('classroom.iconDownloadQr')}
            aria-label={t('classroom.iconDownloadQr')}
            onClick={onDownloadStatic}
          >
            ⬇
          </button>
        )}
        <button
          type="button"
          className="classroom-qr-iconbtn classroom-qr-iconbtn--danger"
          title={t('classroom.iconEndSession')}
          aria-label={t('classroom.iconEndSession')}
          onClick={() => onEndSession(activeQR.sessionId)}
        >
          ⏹
        </button>
        <button
          type="button"
          className="classroom-qr-iconbtn"
          title={t('classroom.iconCloseQr')}
          aria-label={t('classroom.iconCloseQr')}
          onClick={onCloseQR}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

/**
 * Instructor workspace: full-width material first; thin attendance strip + prep below; compact QR rail at 75/25.
 */
export function ClassroomPage({ onClose }) {
  const { t, i18n } = useTranslation();
  const {
    courses,
    rooms,
    activeSessions,
    loading,
    reload,
  } = useInstructorSessionBootstrap();
  const {
    activeQR,
    qrCountdown,
    fetchQRPair,
    applyStartSessionResult,
    dismissQR,
    manualRotate,
  } = useSessionQR();

  const startTimeoutRef = useRef(null);
  const exitTimerRef = useRef(null);
  const materialFrameRef = useRef(null);

  const [materialUrlDraft, setMaterialUrlDraft] = useState('');
  const [materials, setMaterials] = useState(readMaterialsFromStorage);
  const [activeMaterialId, setActiveMaterialId] = useState(() => readActiveMaterialIdFromStorage(readMaterialsFromStorage()));
  const [prepMaterialTitle, setPrepMaterialTitle] = useState('');
  const [prepMaterialUrl, setPrepMaterialUrl] = useState('');
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [showStatic, setShowStatic] = useState(false);
  /** 'presentation' | 'prep' — separate main layouts (material vs. class setup). */
  const [mainTab, setMainTab] = useState('presentation');
  const [isAttendanceRunning, setIsAttendanceRunning] = useState(false);
  const [attendanceAutoEndAt, setAttendanceAutoEndAt] = useState(null);
  const [pendingStartAtMs, setPendingStartAtMs] = useState(null);
  const [tick, setTick] = useState(0);
  const [isClosingQr, setIsClosingQr] = useState(false);
  const [isMaterialFullscreen, setIsMaterialFullscreen] = useState(false);

  const [form, setForm] = useState({
    course_id: '',
    room_id: '',
    latitude: '',
    longitude: '',
    date: new Date().toISOString().split('T')[0],
    start_time: '',
    end_time: '',
  });

  const showQrRail = Boolean(isAttendanceRunning && activeQR) || isClosingQr;
  const qrFullscreenSplit = Boolean(isMaterialFullscreen && showQrRail && activeQR);
  const qrAsideVisible = Boolean(showQrRail && activeQR && !qrFullscreenSplit);
  const isSplitLayout = showQrRail;
  const layoutClass = qrAsideVisible ? 'attendance-active' : '';

  const activeMaterial = materials.find((m) => m.id === activeMaterialId);
  const iframeSrc = activeMaterial ? cleanPresentationLink(activeMaterial.url) : '';
  const materialIndex = materials.findIndex((m) => m.id === activeMaterialId);
  const canPrevMaterial = materialIndex > 0;
  const canNextMaterial = materialIndex >= 0 && materialIndex < materials.length - 1;

  useEffect(() => {
    try {
      localStorage.setItem(MATERIALS_STORAGE_KEY, JSON.stringify(materials));
    } catch {
      /* ignore */
    }
  }, [materials]);

  useEffect(() => {
    try {
      if (activeMaterialId) {
        localStorage.setItem(MATERIALS_ACTIVE_KEY, activeMaterialId);
      } else {
        localStorage.removeItem(MATERIALS_ACTIVE_KEY);
      }
    } catch {
      /* ignore */
    }
  }, [activeMaterialId]);

  useEffect(() => {
    if (materials.length === 0) {
      setActiveMaterialId(null);
      return;
    }
    setActiveMaterialId((cur) => {
      if (cur && materials.some((m) => m.id === cur)) return cur;
      return materials[0].id;
    });
  }, [materials]);

  const checkedInCount = useSessionPublicStats(activeQR?.sessionId, {
    enabled: isAttendanceRunning && Boolean(activeQR?.sessionId),
  });

  const clearPendingSchedule = useCallback(() => {
    clearTimeout(startTimeoutRef.current);
    startTimeoutRef.current = null;
    try {
      sessionStorage.removeItem(PENDING_QR_KEY);
    } catch {
      /* ignore */
    }
    setPendingStartAtMs(null);
  }, []);

  const armPendingStart = useCallback((sessionId, startMs, endMs) => {
    clearTimeout(startTimeoutRef.current);
    try {
      sessionStorage.setItem(PENDING_QR_KEY, JSON.stringify({
        sessionId,
        startMs,
        endMs,
      }));
    } catch {
      /* ignore */
    }
    setPendingStartAtMs(startMs);
    const delay = Math.max(0, startMs - Date.now());
    startTimeoutRef.current = setTimeout(async () => {
      startTimeoutRef.current = null;
      try {
        sessionStorage.removeItem(PENDING_QR_KEY);
        await fetchQRPair(sessionId);
        setIsAttendanceRunning(true);
        setAttendanceAutoEndAt(endMs ?? null);
      } catch (err) {
        setMessage({ text: err.message || t('qrScan.errorQR'), type: 'error' });
      }
      setPendingStartAtMs(null);
    }, delay);
  }, [fetchQRPair, t]);

  const finishQrRailClose = useCallback(() => {
    dismissQR();
    setIsAttendanceRunning(false);
    setAttendanceAutoEndAt(null);
    setIsClosingQr(false);
    clearTimeout(exitTimerRef.current);
    exitTimerRef.current = null;
  }, [dismissQR]);

  const beginQrRailExit = useCallback((afterExit) => {
    clearTimeout(exitTimerRef.current);
    setIsClosingQr(true);
    exitTimerRef.current = window.setTimeout(async () => {
      try {
        if (afterExit) await afterExit();
      } catch (err) {
        setMessage({ text: err.message || t('qrScan.errorEnd'), type: 'error' });
        setIsClosingQr(false);
        exitTimerRef.current = null;
        return;
      }
      finishQrRailClose();
    }, QR_RAIL_EXIT_MS);
  }, [finishQrRailClose, t]);

  const performEndSessionCore = useCallback(async (sessionId) => {
    await apiClient.post(`/sessions/${sessionId}/end`);
    setMessage({ text: t('qrScan.sessionEnded'), type: 'success' });
    let pendingId = null;
    try {
      const pr = sessionStorage.getItem(PENDING_QR_KEY);
      if (pr) pendingId = JSON.parse(pr).sessionId;
    } catch {
      /* ignore */
    }
    if (activeQR?.sessionId === sessionId || Number(pendingId) === Number(sessionId)) {
      clearPendingSchedule();
    }
    const keepMaterialFullscreen =
      typeof document !== 'undefined'
      && materialFrameRef.current
      && getFullscreenElement() === materialFrameRef.current;
    await reload(keepMaterialFullscreen ? { silent: true } : {});
  }, [activeQR?.sessionId, clearPendingSchedule, reload, t]);

  const handleEndSession = useCallback(async (sessionId) => {
    try {
      await performEndSessionCore(sessionId);
      if (activeQR?.sessionId === sessionId) {
        dismissQR();
        setIsAttendanceRunning(false);
        setAttendanceAutoEndAt(null);
      }
    } catch (err) {
      setMessage({ text: err.message || t('qrScan.errorEnd'), type: 'error' });
    }
  }, [activeQR?.sessionId, dismissQR, performEndSessionCore, t]);

  const handleCloseQRPanel = useCallback(() => {
    beginQrRailExit(null);
  }, [beginQrRailExit]);

  const handleEndSessionFromQrPanel = useCallback((sessionId) => {
    beginQrRailExit(() => performEndSessionCore(sessionId));
  }, [beginQrRailExit, performEndSessionCore]);

  useEffect(() => () => {
    clearTimeout(exitTimerRef.current);
  }, []);

  useEffect(() => {
    const syncFullscreen = () => {
      const fs = getFullscreenElement();
      const frame = materialFrameRef.current;
      setIsMaterialFullscreen(Boolean(frame && fs === frame));
    };
    document.addEventListener('fullscreenchange', syncFullscreen);
    document.addEventListener('webkitfullscreenchange', syncFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen);
      document.removeEventListener('webkitfullscreenchange', syncFullscreen);
    };
  }, []);

  useEffect(() => {
    if (!isAttendanceRunning) return undefined;
    setMainTab('presentation');
    return undefined;
  }, [isAttendanceRunning]);

  useEffect(() => {
    if (!pendingStartAtMs || isAttendanceRunning) return undefined;
    const id = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, [pendingStartAtMs, isAttendanceRunning]);

  useEffect(() => {
    if (!isAttendanceRunning || attendanceAutoEndAt == null || !activeQR?.sessionId) return undefined;
    const sid = activeQR.sessionId;
    const endAt = attendanceAutoEndAt;
    let intervalId;
    intervalId = setInterval(() => {
      if (Date.now() < endAt) return;
      clearInterval(intervalId);
      void handleEndSession(sid);
    }, 1000);
    return () => clearInterval(intervalId);
  }, [isAttendanceRunning, attendanceAutoEndAt, activeQR?.sessionId, handleEndSession]);

  useEffect(() => () => {
    clearTimeout(startTimeoutRef.current);
  }, []);

  useEffect(() => {
    if (loading) return undefined;

    const openAttendanceWindow = (sessionId, endMs) => {
      void fetchQRPair(sessionId).then(() => {
        setIsAttendanceRunning(true);
        setAttendanceAutoEndAt(endMs ?? null);
      }).catch((err) => {
        setMessage({ text: err.message || t('qrScan.errorQR'), type: 'error' });
      });
    };

    try {
      const raw = sessionStorage.getItem(PENDING_QR_KEY);
      if (raw) {
        const { sessionId, startMs, endMs } = JSON.parse(raw);
        if (Date.now() >= startMs) {
          sessionStorage.removeItem(PENDING_QR_KEY);
          openAttendanceWindow(sessionId, endMs);
        } else if (!startTimeoutRef.current) {
          armPendingStart(sessionId, startMs, endMs);
        }
        return undefined;
      }
    } catch {
      sessionStorage.removeItem(PENDING_QR_KEY);
    }

    if (isAttendanceRunning || activeQR || pendingStartAtMs) return undefined;

    const today = new Date().toISOString().split('T')[0];
    const now = Date.now();
    for (const s of activeSessions) {
      const d = String(s.date).split('T')[0];
      if (d !== today) continue;
      if (!s.start_time) continue;
      const startMs = parseSessionLocalEnd(s.date, s.start_time)?.getTime();
      if (!startMs) continue;
      const endMs = parseSessionLocalEnd(s.date, s.end_time)?.getTime() ?? null;
      if (now < startMs) {
        armPendingStart(s.id, startMs, endMs);
        break;
      }
      if (now >= startMs && (!endMs || now < endMs)) {
        openAttendanceWindow(s.id, endMs);
        break;
      }
    }
    return undefined;
  }, [loading, activeSessions, armPendingStart, fetchQRPair, t, isAttendanceRunning, activeQR, pendingStartAtMs]);

  const handleRoomChange = (roomId) => {
    if (!roomId) {
      setForm((f) => ({ ...f, room_id: '', latitude: '', longitude: '' }));
      return;
    }
    const room = rooms.find((r) => String(r.id) === String(roomId));
    setForm((f) => ({
      ...f,
      room_id: roomId,
      latitude: room?.latitude != null ? String(room.latitude) : '',
      longitude: room?.longitude != null ? String(room.longitude) : '',
    }));
  };

  const handleLoadMaterial = () => {
    const raw = materialUrlDraft.trim();
    if (!raw) return;
    const cleaned = cleanPresentationLink(raw);
    const id = newMaterialId();
    const nextN = materials.length + 1;
    setMaterials((prev) => [...prev, {
      id,
      title: t('classroom.materialDefaultTitle', { n: nextN }),
      url: cleaned,
    }]);
    setActiveMaterialId(id);
    setMessage({ text: '', type: '' });
  };

  const handlePrepAddMaterial = (e) => {
    e.preventDefault();
    const title = prepMaterialTitle.trim();
    const url = prepMaterialUrl.trim();
    if (!url) {
      setMessage({ text: t('classroom.materialsNeedUrl'), type: 'error' });
      return;
    }
    const cleaned = cleanPresentationLink(url);
    const id = newMaterialId();
    setMaterials((prev) => {
      const nextN = prev.length + 1;
      return [...prev, {
        id,
        title: title || t('classroom.materialDefaultTitle', { n: nextN }),
        url: cleaned,
      }];
    });
    setActiveMaterialId(id);
    setPrepMaterialTitle('');
    setPrepMaterialUrl('');
    setMessage({ text: '', type: '' });
  };

  const removeMaterial = (id) => {
    setMaterials((prev) => prev.filter((m) => m.id !== id));
  };

  const clearAllMaterials = () => {
    if (!window.confirm(t('classroom.materialsClearConfirm'))) return;
    setMaterials([]);
    setActiveMaterialId(null);
  };

  const goPrevMaterial = () => {
    if (!canPrevMaterial) return;
    setActiveMaterialId(materials[materialIndex - 1].id);
  };

  const goNextMaterial = () => {
    if (!canNextMaterial) return;
    setActiveMaterialId(materials[materialIndex + 1].id);
  };

  const handleMaterialUrlPaste = (e) => {
    const text = e.clipboardData?.getData('text/plain');
    if (!text?.trim()) return;
    if (!/docs\.google\.com/i.test(text) || !/\/edit/i.test(text)) return;
    e.preventDefault();
    setMaterialUrlDraft(cleanPresentationLink(text));
  };

  const handleMaterialFullscreen = useCallback(async () => {
    const el = materialFrameRef.current;
    if (!el || !iframeSrc) {
      setMessage({ text: t('classroom.fullscreenNeedMaterial'), type: 'error' });
      return;
    }
    if (getFullscreenElement() === el) {
      await exitDocumentFullscreen();
      return;
    }
    setMainTab('presentation');
    const ok = await requestElementFullscreen(el);
    if (!ok) {
      setMessage({ text: t('classroom.fullscreenFailed'), type: 'error' });
    }
  }, [iframeSrc, t]);

  const handleStartSession = async (e) => {
    e.preventDefault();
    if (!form.course_id) {
      setMessage({ text: t('qrScan.errorSelectCourse'), type: 'error' });
      return;
    }
    setStarting(true);
    setMessage({ text: '', type: '' });
    try {
      const result = await apiClient.post('/sessions/start', {
        course_id: Number(form.course_id),
        room_id: form.room_id ? Number(form.room_id) : null,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        date: form.date || null,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
      });
      if (result?.session) {
        clearPendingSchedule();
        const sess = result.session;
        const endDt = parseSessionLocalEnd(sess.date, sess.end_time);
        const startDt = parseSessionLocalEnd(sess.date, sess.start_time);
        const startMs = startDt?.getTime();
        const now = Date.now();
        const endMs = endDt ? endDt.getTime() : null;
        if (sess.start_time && startMs && now < startMs) {
          dismissQR();
          armPendingStart(sess.id, startMs, endMs);
        } else {
          applyStartSessionResult(sess);
          setAttendanceAutoEndAt(endMs);
          setIsAttendanceRunning(true);
        }
        reload();
      }
    } catch (err) {
      setMessage({ text: err.message || t('qrScan.errorStart'), type: 'error' });
    } finally {
      setStarting(false);
    }
  };

  const handleShowQR = async (sessionId) => {
    setMessage({ text: '', type: '' });
    clearPendingSchedule();
    try {
      await fetchQRPair(sessionId);
      const s = activeSessions.find((x) => Number(x.id) === Number(sessionId));
      const endDt = parseSessionLocalEnd(s?.date, s?.end_time);
      setAttendanceAutoEndAt(endDt ? endDt.getTime() : null);
      setIsAttendanceRunning(true);
      setMainTab('presentation');
    } catch (err) {
      setMessage({ text: err.message || t('qrScan.errorQR'), type: 'error' });
    }
  };

  const handleDownloadStaticQR = () => {
    if (!activeQR?.staticQrImage) return;
    const link = document.createElement('a');
    link.href = activeQR.staticQrImage;
    link.download = `yoklama-qr-${activeQR.sessionId}.png`;
    link.click();
  };

  const pendingTimeLabel = pendingStartAtMs
    ? new Date(pendingStartAtMs).toLocaleTimeString(i18n.language || 'tr', {
      hour: '2-digit',
      minute: '2-digit',
    })
    : '';

  const modeLabel = isSplitLayout
    ? t('classroom.modeAttendance')
    : pendingStartAtMs
      ? t('classroom.modeWaiting')
      : t('classroom.modePresentation');

  return (
    <div
      className={`classroom-page classroom-stack${!isSplitLayout ? ' classroom-page--material-focus' : ''}`}
      data-count={tick}
    >
      <div className="classroom-header">
        <button type="button" className="classroom-back" onClick={onClose}>
          ←
          {' '}
          {t('common.back')}
        </button>
        <div className="classroom-header-main">
          <div>
            <h2>{t('classroom.title')}</h2>
            <p className="classroom-subtitle">{t('classroom.subtitle')}</p>
          </div>
          <div className="classroom-mode-bar" role="status">
            <span className="classroom-mode-pill">{modeLabel}</span>
          </div>
        </div>
      </div>

      {message.text && (
        <div className={`classroom-message classroom-message--${message.type}`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="classroom-loading">
          <div className="spinner" />
          <p>{t('common.loading')}</p>
        </div>
      ) : (
        <>
          <div className="classroom-main-tabs" role="tablist" aria-label={t('classroom.mainTabsAriaLabel')}>
            <button
              type="button"
              role="tab"
              id="classroom-tab-presentation"
              aria-controls="classroom-panel-presentation"
              aria-selected={mainTab === 'presentation'}
              className={`classroom-main-tab${mainTab === 'presentation' ? ' classroom-main-tab--active' : ''}`}
              onClick={() => setMainTab('presentation')}
            >
              {t('classroom.tabPresentation')}
            </button>
            <button
              type="button"
              role="tab"
              id="classroom-tab-prep"
              aria-controls="classroom-panel-prep"
              aria-selected={mainTab === 'prep'}
              className={`classroom-main-tab${mainTab === 'prep' ? ' classroom-main-tab--active' : ''}`}
              disabled={isMaterialFullscreen}
              title={isMaterialFullscreen ? t('classroom.tabPrepDisabledFullscreen') : undefined}
              onClick={() => setMainTab('prep')}
            >
              {t('classroom.tabPrep')}
            </button>
          </div>

          {pendingStartAtMs && !isAttendanceRunning && (
            <div
              className="classroom-pending-strip classroom-pending-strip--under-tabs"
              role="status"
              aria-live="polite"
            >
              {t('classroom.pendingFooterStrip', {
                time: pendingTimeLabel,
                countdown: formatCountdown(pendingStartAtMs - Date.now()),
              })}
            </div>
          )}

          {mainTab === 'presentation' && (
          <div
            className="classroom-main-stage"
            id="classroom-panel-presentation"
            role="tabpanel"
            aria-labelledby="classroom-tab-presentation"
          >
            <div className={`classroom-layout ${layoutClass}`}>
              <section className="classroom-material card-panel">
                <h3>{t('classroom.materialHeading')}</h3>
                <p className="classroom-hint">{t('classroom.materialHint')}</p>
                <div className="classroom-url-row">
                  <input
                    type="text"
                    className="classroom-url-input"
                    value={materialUrlDraft}
                    onChange={(e) => setMaterialUrlDraft(e.target.value)}
                    onPaste={handleMaterialUrlPaste}
                    placeholder="https://"
                    autoComplete="off"
                  />
                  <button type="button" className="classroom-url-btn" onClick={handleLoadMaterial}>
                    {t('classroom.materialAddToPlaylist')}
                  </button>
                  <button
                    type="button"
                    className="classroom-fullscreen-btn"
                    onClick={handleMaterialFullscreen}
                    disabled={!iframeSrc}
                    title={isMaterialFullscreen ? t('classroom.materialFullscreenExit') : t('classroom.materialFullscreenEnter')}
                  >
                    {isMaterialFullscreen ? t('classroom.materialFullscreenExit') : t('classroom.materialFullscreenEnter')}
                  </button>
                </div>
                {materials.length > 0 && (
                  <div className="classroom-material-tabs" role="tablist" aria-label={t('classroom.materialsPlaylistTitle')}>
                    {materials.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        role="tab"
                        aria-selected={m.id === activeMaterialId}
                        className={`classroom-material-tab${m.id === activeMaterialId ? ' classroom-material-tab--active' : ''}`}
                        onClick={() => setActiveMaterialId(m.id)}
                      >
                        {m.title}
                      </button>
                    ))}
                  </div>
                )}
                <div className="classroom-material-frame" ref={materialFrameRef}>
                  <div
                    className={`classroom-material-frame-inner${
                      qrFullscreenSplit ? ' classroom-material-frame-inner--fs-split' : ''
                    }`}
                  >
                    <div className="classroom-material-frame-slide">
                      {iframeSrc ? (
                        <MaterialZoomFrame
                          materialSrc={iframeSrc}
                          isSplitLayout={isSplitLayout}
                          t={t}
                          playlistNav={
                            materials.length > 1
                              ? {
                                  canPrev: canPrevMaterial,
                                  canNext: canNextMaterial,
                                  onPrev: goPrevMaterial,
                                  onNext: goNextMaterial,
                                  current: materialIndex + 1,
                                  total: materials.length,
                                }
                              : null
                          }
                        >
                          <iframe
                            title="classroom-material"
                            src={iframeSrc}
                            className="classroom-iframe"
                            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                          />
                        </MaterialZoomFrame>
                      ) : (
                        <div className="classroom-material-placeholder">
                          {t('classroom.materialEmptyPlaylist')}
                        </div>
                      )}
                    </div>
                    {qrFullscreenSplit && (
                      <div
                        className={`classroom-fs-qr-rail card-panel ${
                          isClosingQr ? 'classroom-side--slide-out' : 'classroom-side--slide-in'
                        }`}
                      >
                        <QRContainer
                          activeQR={activeQR}
                          showStatic={showStatic}
                          setShowStatic={setShowStatic}
                          qrCountdown={qrCountdown}
                          checkedInCount={checkedInCount}
                          t={t}
                          manualRotate={manualRotate}
                          onOpenProjector={() => openProjectorAttendanceWindow(activeQR.sessionId)}
                          onDownloadStatic={handleDownloadStaticQR}
                          onEndSession={handleEndSessionFromQrPanel}
                          onCloseQR={handleCloseQRPanel}
                          isClosing={isClosingQr}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {qrAsideVisible && (
                <aside
                  className={`classroom-side classroom-side--qr-rail card-panel ${
                    isClosingQr ? 'classroom-side--slide-out' : 'classroom-side--slide-in'
                  }`}
                >
                  <QRContainer
                    activeQR={activeQR}
                    showStatic={showStatic}
                    setShowStatic={setShowStatic}
                    qrCountdown={qrCountdown}
                    checkedInCount={checkedInCount}
                    t={t}
                    manualRotate={manualRotate}
                    onOpenProjector={() => openProjectorAttendanceWindow(activeQR.sessionId)}
                    onDownloadStatic={handleDownloadStaticQR}
                    onEndSession={handleEndSessionFromQrPanel}
                    onCloseQR={handleCloseQRPanel}
                    isClosing={isClosingQr}
                  />
                </aside>
              )}
            </div>
          </div>
          )}

          {mainTab === 'prep' && (
          <div
            className="classroom-prep-stage"
            id="classroom-panel-prep"
            role="tabpanel"
            aria-labelledby="classroom-tab-prep"
          >
            <div className="classroom-prep card-panel classroom-prep--fullpage is-open">
              <div className="classroom-prep-head classroom-prep-head--static">
                <h3 className="classroom-prep-title">{t('classroom.prepTitle')}</h3>
              </div>
              <p className="classroom-prep-hint">{t('classroom.prepHint')}</p>
              <div className="classroom-materials-prep">
                <div className="classroom-materials-prep-head">
                  <h4 className="classroom-prep-subheading">{t('classroom.materialsPlaylistTitle')}</h4>
                  {materials.length > 0 && (
                    <button type="button" className="classroom-materials-clear" onClick={clearAllMaterials}>
                      {t('classroom.materialsClearAll')}
                    </button>
                  )}
                </div>
                <form className="classroom-materials-add-form" onSubmit={handlePrepAddMaterial}>
                  <input
                    type="text"
                    className="classroom-materials-input"
                    value={prepMaterialTitle}
                    onChange={(e) => setPrepMaterialTitle(e.target.value)}
                    placeholder={t('classroom.materialsAddTitle')}
                    autoComplete="off"
                  />
                  <input
                    type="text"
                    className="classroom-materials-input-wide"
                    value={prepMaterialUrl}
                    onChange={(e) => setPrepMaterialUrl(e.target.value)}
                    placeholder="https://"
                    autoComplete="off"
                  />
                  <button type="submit" className="classroom-materials-add-submit">
                    {t('classroom.materialsAddBtn')}
                  </button>
                </form>
                {materials.length > 0 && (
                  <ul className="classroom-materials-list">
                    {materials.map((m) => (
                      <li key={m.id} className="classroom-materials-list-item">
                        <button
                          type="button"
                          className="classroom-materials-pick"
                          onClick={() => {
                            setActiveMaterialId(m.id);
                            setMainTab('presentation');
                          }}
                        >
                          {m.title}
                        </button>
                        <button
                          type="button"
                          className="classroom-materials-remove"
                          onClick={() => removeMaterial(m.id)}
                          aria-label={t('classroom.materialsDelete')}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {activeSessions.length > 0 && (
                <div className="classroom-sessions">
                  <h4 className="classroom-prep-subheading">{t('qrScan.activeSessions')}</h4>
                  <ul className="classroom-session-list">
                    {activeSessions.map((s) => (
                      <li key={s.id} className="classroom-session-item">
                        <div>
                          <strong>
                            {t('qrScan.sessionNo', { id: s.id })}
                          </strong>
                          <span className="classroom-session-meta">
                            {s.date}
                            {' '}
                            {s.start_time}
                          </span>
                        </div>
                        <div className="classroom-session-btns">
                          <button type="button" className="classroom-mini-btn" onClick={() => handleShowQR(s.id)}>
                            {t('qrScan.showQR')}
                          </button>
                          <button type="button" className="classroom-mini-btn danger" onClick={() => handleEndSession(s.id)}>
                            {t('qrScan.end')}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <SessionStartForm
                form={form}
                setForm={setForm}
                rooms={rooms}
                courses={courses}
                onRoomChange={handleRoomChange}
                onSubmit={handleStartSession}
                starting={starting}
              />
            </div>
          </div>
          )}
        </>
      )}
    </div>
  );
}
