import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import apiClient from '../../../shared/services/apiClient';
import { useSessionQR } from '../hooks/useSessionQR';
import { useInstructorSessionBootstrap } from '../hooks/useInstructorSessionBootstrap';
import { SessionStartForm } from './SessionStartForm';
import './QRScan.css';

export const QRScan = ({ onClose }) => {
  const { t } = useTranslation();
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

  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [projectorMode, setProjectorMode] = useState(false);
  const [showStatic, setShowStatic] = useState(false);

  const [form, setForm] = useState({
    course_id: '',
    room_id: '',
    latitude: '',
    longitude: '',
    date: new Date().toISOString().split('T')[0],
    start_time: '',
    end_time: '',
  });

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
        applyStartSessionResult(result.session);
        setMessage({ text: t('qrScan.sessionStarted'), type: 'success' });
        reload();
      }
    } catch (err) {
      setMessage({ text: err.message || t('qrScan.errorStart'), type: 'error' });
    } finally {
      setStarting(false);
    }
  };

  const handleEndSession = async (sessionId) => {
    try {
      await apiClient.post(`/sessions/${sessionId}/end`);
      setMessage({ text: t('qrScan.sessionEnded'), type: 'success' });
      if (activeQR?.sessionId === sessionId) {
        dismissQR();
        setProjectorMode(false);
      }
      reload();
    } catch (err) {
      setMessage({ text: err.message || t('qrScan.errorEnd'), type: 'error' });
    }
  };

  const handleShowQR = async (sessionId) => {
    try {
      await fetchQRPair(sessionId);
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

  return (
    <div className="qr-scan-container">
      <div className="qr-scan-header">
        <button type="button" className="back-button" onClick={onClose}>
          ←
          {' '}
          {t('common.back')}
        </button>
        <div className="header-content">
          <h2>{t('qrScan.title')}</h2>
          <p>{t('qrScan.subtitle')}</p>
        </div>
      </div>

      {message.text && (
        <div className={`message ${message.type}`}>{message.text}</div>
      )}

      {loading ? (
        <div className="qr-loading">
          <div className="spinner" />
          <p>{t('common.loading')}</p>
        </div>
      ) : (
        <div className="qr-content">
          {activeQR && (
            <>
              {projectorMode && (
                <div className="projector-overlay" onClick={() => setProjectorMode(false)} role="presentation">
                  <div className="projector-qr-wrap" onClick={(e) => e.stopPropagation()}>
                    <img
                      src={showStatic ? activeQR.staticQrImage : activeQR.qrImage}
                      alt="QR Code"
                      className="projector-qr-image"
                    />
                    {!showStatic && (
                      <div className="projector-countdown">
                        Yenileniyor:
                        {' '}
                        <strong>{qrCountdown}s</strong>
                      </div>
                    )}
                    {showStatic && (
                      <div className="projector-static-badge">📌 Statik QR — Oturum boyunca geçerli</div>
                    )}
                    <button
                      type="button"
                      className="projector-close-btn"
                      onClick={() => setProjectorMode(false)}
                    >
                      ✕ Kapat
                    </button>
                  </div>
                </div>
              )}

              <div className="qr-display-section">
                <div className="qr-tab-bar">
                  <button
                    type="button"
                    className={`qr-tab${!showStatic ? ' qr-tab-active' : ''}`}
                    onClick={() => setShowStatic(false)}
                  >
                    🔄 Dinamik QR
                  </button>
                  <button
                    type="button"
                    className={`qr-tab${showStatic ? ' qr-tab-active' : ''}`}
                    onClick={() => setShowStatic(true)}
                    disabled={!activeQR.staticQrImage}
                  >
                    📌 Statik QR (Slayt)
                  </button>
                </div>

                <h3>
                  {t('qrScan.qrCode')}
                  {' '}
                  —
                  {' '}
                  {t('qrScan.sessionNo', { id: activeQR.sessionId })}
                </h3>

                {!showStatic && (
                  <div className="qr-countdown">
                    {t('qrScan.refresh')}
                    :
                    {' '}
                    <strong>{qrCountdown}s</strong>
                  </div>
                )}
                {showStatic && (
                  <div className="qr-static-info">
                    📌 Bu QR oturum boyunca değişmez — slaytınıza ekleyebilirsiniz
                  </div>
                )}

                {(showStatic ? activeQR.staticQrImage : activeQR.qrImage) ? (
                  <img
                    src={showStatic ? activeQR.staticQrImage : activeQR.qrImage}
                    alt="QR Code"
                    className="qr-image"
                  />
                ) : (
                  <p className="no-qr">{t('qrScan.errorLoadQR')}</p>
                )}

                <div className="qr-actions">
                  {!showStatic && (
                    <button type="button" className="rotate-qr-btn" onClick={() => manualRotate()}>
                      {t('qrScan.refreshQR')}
                    </button>
                  )}
                  {showStatic && activeQR.staticQrImage && (
                    <button type="button" className="download-qr-btn" onClick={handleDownloadStaticQR}>
                      ⬇ Statik QR İndir (.png)
                    </button>
                  )}
                  <button type="button" className="projector-btn" onClick={() => setProjectorMode(true)}>
                    🖥 Projektör Modu
                  </button>
                  <button type="button" className="end-btn" onClick={() => handleEndSession(activeQR.sessionId)}>
                    {t('qrScan.endSession')}
                  </button>
                  <button
                    type="button"
                    className="close-qr-btn"
                    onClick={() => {
                      dismissQR();
                      setProjectorMode(false);
                    }}
                  >
                    {t('qrScan.closeQR')}
                  </button>
                </div>
              </div>
            </>
          )}

          {activeSessions.length > 0 && (
            <div className="active-sessions-section">
              <h3>{t('qrScan.activeSessions')}</h3>
              <div className="sessions-list">
                {activeSessions.map((s) => (
                  <div key={s.id} className="session-row">
                    <div className="session-info">
                      <span className="session-title">
                        {t('qrScan.sessionNo', { id: s.id })}
                        {' '}
                        —
                        {' '}
                        {t('qrScan.courseNo', { id: s.course_id })}
                      </span>
                      <span className="session-date">
                        {s.date}
                        {' '}
                        {s.start_time}
                      </span>
                    </div>
                    <div className="session-actions">
                      <button type="button" className="show-qr-btn" onClick={() => handleShowQR(s.id)}>
                        {t('qrScan.showQR')}
                      </button>
                      <button type="button" className="end-btn-sm" onClick={() => handleEndSession(s.id)}>
                        {t('qrScan.end')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
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
      )}
    </div>
  );
};
