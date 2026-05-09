import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import apiClient from '../../../shared/services/apiClient';
import './QRScan.css';

const QR_ROTATE_INTERVAL_MS = 55_000; // rotate 5s before 60s TTL

export const QRScan = ({ onClose }) => {
    const { t } = useTranslation();
    const [courses, setCourses] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [activeSessions, setActiveSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [starting, setStarting] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });
    const [activeQR, setActiveQR] = useState(null); // { sessionId, qrImage, staticQrImage }
    const [qrCountdown, setQrCountdown] = useState(55);
    const [projectorMode, setProjectorMode] = useState(false);
    const [showStatic, setShowStatic] = useState(false);
    const rotateTimerRef = useRef(null);
    const countdownTimerRef = useRef(null);

    // Form for starting a new session
    const [form, setForm] = useState({
        course_id: '',
        room_id: '',
        latitude: '',
        longitude: '',
        date: new Date().toISOString().split('T')[0],
        start_time: '',
        end_time: '',
    });

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [c, s, r] = await Promise.allSettled([
                apiClient.get('/courses/'),
                apiClient.get('/sessions/active'),
                apiClient.get('/rooms/'),
            ]);
            if (c.status === 'fulfilled') setCourses(c.value || []);
            if (s.status === 'fulfilled') setActiveSessions(s.value || []);
            if (r.status === 'fulfilled') setRooms(r.value || []);
        } catch (err) {
            console.error('QRScan load error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Fakülte seçilince GPS otomatik doldur
    const handleRoomChange = (roomId) => {
        if (!roomId) {
            setForm(f => ({ ...f, room_id: '', latitude: '', longitude: '' }));
            return;
        }
        const room = rooms.find(r => String(r.id) === String(roomId));
        setForm(f => ({
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
                const newSessionId = result.session.id;
                setActiveQR({
                    sessionId: newSessionId,
                    qrImage: result.session.qr_image,
                    staticQrImage: result.session.static_qr_image || null,
                });
                setMessage({ text: t('qrScan.sessionStarted'), type: 'success' });
                startQRRotation(newSessionId);
                loadData();
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
                setActiveQR(null);
                stopQRRotation();
            }
            loadData();
        } catch (err) {
            setMessage({ text: err.message || t('qrScan.errorEnd'), type: 'error' });
        }
    };

    const handleShowQR = async (sessionId) => {
        try {
            const [dynRes, statRes] = await Promise.allSettled([
                apiClient.get(`/sessions/${sessionId}/qr`),
                apiClient.get(`/sessions/${sessionId}/static-qr`),
            ]);
            setActiveQR({
                sessionId,
                qrImage: dynRes.status === 'fulfilled' ? dynRes.value.qr_image : null,
                staticQrImage: statRes.status === 'fulfilled' ? statRes.value.qr_image : null,
            });
            startQRRotation(sessionId);
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

    const rotateQR = useCallback(async (sessionId) => {
        try {
            const result = await apiClient.post(`/sessions/${sessionId}/rotate-qr`);
            setActiveQR(prev => prev?.sessionId === sessionId
                ? { ...prev, qrImage: result.qr_image }
                : prev
            );
            setQrCountdown(55);
        } catch (err) {
            console.error('[QRScan] rotate-qr error:', err);
        }
    }, []);

    const startQRRotation = useCallback((sessionId) => {
        // Clear existing timers
        clearInterval(rotateTimerRef.current);
        clearInterval(countdownTimerRef.current);

        setQrCountdown(55);
        rotateTimerRef.current = setInterval(() => rotateQR(sessionId), QR_ROTATE_INTERVAL_MS);
        countdownTimerRef.current = setInterval(() => {
            setQrCountdown(prev => (prev <= 1 ? 55 : prev - 1));
        }, 1000);
    }, [rotateQR]);

    // Stop rotation when QR is dismissed or session ends
    const stopQRRotation = useCallback(() => {
        clearInterval(rotateTimerRef.current);
        clearInterval(countdownTimerRef.current);
        rotateTimerRef.current = null;
        countdownTimerRef.current = null;
    }, []);

    // Clean up on unmount
    useEffect(() => () => stopQRRotation(), [stopQRRotation]);

    return (
        <div className="qr-scan-container">
            <div className="qr-scan-header">
                <button className="back-button" onClick={onClose}>← {t('common.back')}</button>
                <div className="header-content">
                    <h2>{t('qrScan.title')}</h2>
                    <p>{t('qrScan.subtitle')}</p>
                </div>
            </div>

            {message.text && (
                <div className={`message ${message.type}`}>{message.text}</div>
            )}

            {loading ? (
                <div className="qr-loading"><div className="spinner"></div><p>{t('common.loading')}</p></div>
            ) : (
                <div className="qr-content">
                    {/* QR Display */}
                    {activeQR && (
                        <>
                        {/* Projektör Modu overlay */}
                        {projectorMode && (
                            <div className="projector-overlay" onClick={() => setProjectorMode(false)}>
                                <div className="projector-qr-wrap" onClick={e => e.stopPropagation()}>
                                    <img
                                        src={showStatic ? activeQR.staticQrImage : activeQR.qrImage}
                                        alt="QR Code"
                                        className="projector-qr-image"
                                    />
                                    {!showStatic && (
                                        <div className="projector-countdown">
                                            Yenileniyor: <strong>{qrCountdown}s</strong>
                                        </div>
                                    )}
                                    {showStatic && (
                                        <div className="projector-static-badge">📌 Statik QR — Oturum boyunca geçerli</div>
                                    )}
                                    <button className="projector-close-btn" onClick={() => setProjectorMode(false)}>✕ Kapat</button>
                                </div>
                            </div>
                        )}

                        <div className="qr-display-section">
                            {/* Sekme seçici */}
                            <div className="qr-tab-bar">
                                <button
                                    className={`qr-tab${!showStatic ? ' qr-tab-active' : ''}`}
                                    onClick={() => setShowStatic(false)}
                                >
                                    🔄 Dinamik QR
                                </button>
                                <button
                                    className={`qr-tab${showStatic ? ' qr-tab-active' : ''}`}
                                    onClick={() => setShowStatic(true)}
                                    disabled={!activeQR.staticQrImage}
                                >
                                    📌 Statik QR (Slayt)
                                </button>
                            </div>

                            <h3>{t('qrScan.qrCode')} — {t('qrScan.sessionNo', { id: activeQR.sessionId })}</h3>

                            {!showStatic && (
                                <div className="qr-countdown">
                                    {t('qrScan.refresh')}: <strong>{qrCountdown}s</strong>
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
                                    <button className="rotate-qr-btn" onClick={() => rotateQR(activeQR.sessionId)}>
                                        {t('qrScan.refreshQR')}
                                    </button>
                                )}
                                {showStatic && activeQR.staticQrImage && (
                                    <button className="download-qr-btn" onClick={handleDownloadStaticQR}>
                                        ⬇ Statik QR İndir (.png)
                                    </button>
                                )}
                                <button className="projector-btn" onClick={() => setProjectorMode(true)}>
                                    🖥 Projektör Modu
                                </button>
                                <button className="end-btn" onClick={() => handleEndSession(activeQR.sessionId)}>
                                    {t('qrScan.endSession')}
                                </button>
                                <button className="close-qr-btn" onClick={() => { setActiveQR(null); stopQRRotation(); setProjectorMode(false); }}>
                                    {t('qrScan.closeQR')}
                                </button>
                            </div>
                        </div>
                        </>
                    )}

                    {/* Active Sessions */}
                    {activeSessions.length > 0 && (
                        <div className="active-sessions-section">
                            <h3>{t('qrScan.activeSessions')}</h3>
                            <div className="sessions-list">
                                {activeSessions.map(s => (
                                    <div key={s.id} className="session-row">
                                        <div className="session-info">
                                            <span className="session-title">{t('qrScan.sessionNo', { id: s.id })} — {t('qrScan.courseNo', { id: s.course_id })}</span>
                                            <span className="session-date">{s.date} {s.start_time}</span>
                                        </div>
                                        <div className="session-actions">
                                            <button className="show-qr-btn" onClick={() => handleShowQR(s.id)}>{t('qrScan.showQR')}</button>
                                            <button className="end-btn-sm" onClick={() => handleEndSession(s.id)}>{t('qrScan.end')}</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Start New Session Form */}
                    <div className="start-session-section">
                        <h3>{t('qrScan.newSession')}</h3>
                        <form onSubmit={handleStartSession} className="session-form">
                            <div className="form-row-qr">
                                <div className="form-group-qr">
                                    <label>{t('qrScan.courseLabel')}</label>
                                    <select
                                        value={form.course_id}
                                        onChange={e => setForm(f => ({ ...f, course_id: e.target.value }))}
                                        required
                                    >
                                        <option value="">{t('qrScan.coursePlaceholder')}</option>
                                        {courses.map(c => (
                                            <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                                        ))}
                                    </select>
                                    {courses.length === 0 && <span className="hint-text">{t('qrScan.noCourses')}</span>}
                                </div>
                                <div className="form-group-qr">
                                    <label>{t('qrScan.dateLabel')}</label>
                                    <input
                                        type="date"
                                        value={form.date}
                                        onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <div className="form-row-qr">
                                <div className="form-group-qr">
                                    <label>{t('qrScan.startTime')}</label>
                                    <input
                                        type="time"
                                        value={form.start_time}
                                        onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                                    />
                                </div>
                                <div className="form-group-qr">
                                    <label>{t('qrScan.endTime')}</label>
                                    <input
                                        type="time"
                                        value={form.end_time}
                                        onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div className="form-row-qr">
                                <div className="form-group-qr form-group-full">
                                    <label>🏛 {t('qrScan.roomLabel')} <span className="hint-text">({t('qrScan.roomHint')})</span></label>
                                    <select
                                        value={form.room_id}
                                        onChange={e => handleRoomChange(e.target.value)}
                                    >
                                        <option value="">{t('qrScan.roomPlaceholder')}</option>
                                        {rooms.map(r => (
                                            <option key={r.id} value={r.id}>
                                                {r.name}
                                                {r.latitude ? ` (${Number(r.latitude).toFixed(4)}, ${Number(r.longitude).toFixed(4)})` : ` — ${t('qrScan.noGps')}`}
                                            </option>
                                        ))}
                                    </select>
                                    {rooms.length === 0 && (
                                        <span className="hint-text hint-warn">
                                            {t('qrScan.noRooms')}
                                        </span>
                                    )}
                                    {form.room_id && !rooms.find(r => String(r.id) === String(form.room_id))?.latitude && (
                                        <span className="hint-text hint-warn">
                                            {t('qrScan.roomNoGps')}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="form-row-qr">
                                <div className="form-group-qr">
                                    <label>{t('qrScan.latLabel')}</label>
                                    <input
                                        type="number"
                                        step="any"
                                        placeholder="41.015137"
                                        value={form.latitude}
                                        onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))}
                                        className={form.room_id && form.latitude ? 'input-auto-filled' : ''}
                                    />
                                </div>
                                <div className="form-group-qr">
                                    <label>{t('qrScan.lngLabel')}</label>
                                    <input
                                        type="number"
                                        step="any"
                                        placeholder="28.979530"
                                        value={form.longitude}
                                        onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))}
                                        className={form.room_id && form.longitude ? 'input-auto-filled' : ''}
                                    />
                                </div>
                            </div>
                            <button type="submit" className="start-btn" disabled={starting}>
                                {starting ? t('qrScan.startingBtn') : t('qrScan.startBtn')}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
