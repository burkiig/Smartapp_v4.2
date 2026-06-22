import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/hooks';
import { LoginPage } from '../../pages/LoginPage';
import { useSessionQR } from '../attendance/hooks/useSessionQR';
import { useSessionPublicStats } from '../attendance/hooks/useSessionPublicStats';
import './PresentAttendancePage.css';

/**
 * Minimal projector-safe view: large QR + anonymous check-in count only.
 */
export default function PresentAttendancePage() {
  const { t } = useTranslation();
  const { sessionId } = useParams();
  const { user, isLoading } = useAuth();
  const sid = Number(sessionId);

  const {
    activeQR,
    qrCountdown,
    fetchQRPair,
    dismissQR,
    manualRotate,
  } = useSessionQR();

  const [showStatic, setShowStatic] = useState(false);
  const [loadError, setLoadError] = useState('');

  const checkedInCount = useSessionPublicStats(activeQR?.sessionId, {
    enabled: Boolean(activeQR?.sessionId) && Boolean(activeQR?.qrImage || activeQR?.staticQrImage),
  });

  useEffect(() => {
    if (!Number.isFinite(sid)) return undefined;

    let cancelled = false;
    (async () => {
      setLoadError('');
      const next = await fetchQRPair(sid);
      if (cancelled) return;
      if (!next.qrImage && !next.staticQrImage) {
        setLoadError(t('classroom.presentLoadError'));
      }
    })();

    return () => {
      cancelled = true;
      dismissQR();
    };
  }, [sid, fetchQRPair, dismissQR, t]);

  if (isLoading) {
    return (
      <div className="present-root present-center">
        <div className="present-spinner" />
        <p>{t('classroom.presentLoading')}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="present-root present-login-shell">
        <LoginPage />
      </div>
    );
  }

  if (user.role !== 'instructor' && user.role !== 'admin') {
    return (
      <div className="present-root present-center present-forbidden">
        <p>{t('classroom.presentUnauthorized')}</p>
      </div>
    );
  }

  if (!Number.isFinite(sid)) {
    return (
      <div className="present-root present-center present-forbidden">
        <p>{t('classroom.presentBadSession')}</p>
      </div>
    );
  }

  const src = showStatic ? activeQR?.staticQrImage : activeQR?.qrImage;

  return (
    <div className="present-root">
      <header className="present-header">
        <h1>{t('classroom.presentTitle')}</h1>
        <p className="present-sub">{t('classroom.presentHint')}</p>
      </header>

      {loadError && (
        <div className="present-banner present-banner--error">{loadError}</div>
      )}

      {activeQR && (activeQR.qrImage || activeQR.staticQrImage) && (
        <>
          <div className="present-tabs">
            <button
              type="button"
              className={`present-tab${!showStatic ? ' present-tab--on' : ''}`}
              onClick={() => setShowStatic(false)}
              disabled={!activeQR.qrImage}
            >
              Dinamik
            </button>
            <button
              type="button"
              className={`present-tab${showStatic ? ' present-tab--on' : ''}`}
              onClick={() => setShowStatic(true)}
              disabled={!activeQR.staticQrImage}
            >
              Statik
            </button>
          </div>

          <p className="present-count">
            {t('classroom.checkedIn', { count: checkedInCount ?? '—' })}
          </p>

          {!showStatic && (
            <p className="present-ttl">
              {t('qrScan.refresh')}
              :
              {' '}
              <strong>{qrCountdown}s</strong>
            </p>
          )}

          {src ? (
            <img src={src} alt="QR" className="present-qr" />
          ) : (
            <p className="present-fallback">{t('qrScan.errorLoadQR')}</p>
          )}

          {!showStatic && activeQR.qrImage && (
            <button type="button" className="present-refresh" onClick={() => manualRotate()}>
              {t('qrScan.refreshQR')}
            </button>
          )}
        </>
      )}
    </div>
  );
}
