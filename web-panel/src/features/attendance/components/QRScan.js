import React, { useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '../../../shared/services/apiClient';
import './QRScan.css';

const QR_ROTATE_INTERVAL_MS = 55_000; // rotate 5s before 60s TTL

export const QRScan = ({ onClose }) => {
    const [courses, setCourses] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [activeSessions, setActiveSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [starting, setStarting] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });
    const [activeQR, setActiveQR] = useState(null); // { sessionId, qrImage }
    const [qrCountdown, setQrCountdown] = useState(55);
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
            setMessage({ text: 'Ders seçiniz', type: 'error' });
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
                });
                setMessage({ text: 'Oturum başlatıldı! QR kodu öğrencilerle paylaşın.', type: 'success' });
                startQRRotation(newSessionId);
                loadData();
            }
        } catch (err) {
            setMessage({ text: err.message || 'Oturum başlatılamadı', type: 'error' });
        } finally {
            setStarting(false);
        }
    };

    const handleEndSession = async (sessionId) => {
        try {
            await apiClient.post(`/sessions/${sessionId}/end`);
            setMessage({ text: 'Oturum sonlandırıldı', type: 'success' });
            if (activeQR?.sessionId === sessionId) {
                setActiveQR(null);
                stopQRRotation();
            }
            loadData();
        } catch (err) {
            setMessage({ text: err.message || 'Oturum sonlandırılamadı', type: 'error' });
        }
    };

    const handleShowQR = async (sessionId) => {
        try {
            const result = await apiClient.get(`/sessions/${sessionId}/qr`);
            setActiveQR({ sessionId, qrImage: result.qr_image });
            startQRRotation(sessionId);
        } catch (err) {
            setMessage({ text: err.message || 'QR alınamadı', type: 'error' });
        }
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
                <button className="back-button" onClick={onClose}>← Geri</button>
                <div className="header-content">
                    <h2>Oturum & QR Yönetimi</h2>
                    <p>Yoklama oturumu başlatın, QR kodu görüntüleyin</p>
                </div>
            </div>

            {message.text && (
                <div className={`message ${message.type}`}>{message.text}</div>
            )}

            {loading ? (
                <div className="qr-loading"><div className="spinner"></div><p>Yükleniyor...</p></div>
            ) : (
                <div className="qr-content">
                    {/* QR Display */}
                    {activeQR && (
                        <div className="qr-display-section">
                            <h3>QR Kodu — Oturum #{activeQR.sessionId}</h3>
                            <div className="qr-countdown">
                                Yenileme: <strong>{qrCountdown}s</strong>
                            </div>
                            {activeQR.qrImage ? (
                                <img
                                    src={activeQR.qrImage}
                                    alt="QR Code"
                                    className="qr-image"
                                />
                            ) : (
                                <p className="no-qr">QR görsel yüklenemedi</p>
                            )}
                            <div className="qr-actions">
                                <button className="rotate-qr-btn" onClick={() => rotateQR(activeQR.sessionId)}>
                                    QR Yenile
                                </button>
                                <button className="end-btn" onClick={() => handleEndSession(activeQR.sessionId)}>
                                    Oturumu Sonlandır
                                </button>
                                <button className="close-qr-btn" onClick={() => { setActiveQR(null); stopQRRotation(); }}>
                                    QR'ı Kapat
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Active Sessions */}
                    {activeSessions.length > 0 && (
                        <div className="active-sessions-section">
                            <h3>Aktif Oturumlar</h3>
                            <div className="sessions-list">
                                {activeSessions.map(s => (
                                    <div key={s.id} className="session-row">
                                        <div className="session-info">
                                            <span className="session-title">Oturum #{s.id} — Ders {s.course_id}</span>
                                            <span className="session-date">{s.date} {s.start_time}</span>
                                        </div>
                                        <div className="session-actions">
                                            <button className="show-qr-btn" onClick={() => handleShowQR(s.id)}>QR Göster</button>
                                            <button className="end-btn-sm" onClick={() => handleEndSession(s.id)}>Bitir</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Start New Session Form */}
                    <div className="start-session-section">
                        <h3>Yeni Oturum Başlat</h3>
                        <form onSubmit={handleStartSession} className="session-form">
                            <div className="form-row-qr">
                                <div className="form-group-qr">
                                    <label>Ders *</label>
                                    <select
                                        value={form.course_id}
                                        onChange={e => setForm(f => ({ ...f, course_id: e.target.value }))}
                                        required
                                    >
                                        <option value="">Ders seçiniz</option>
                                        {courses.map(c => (
                                            <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                                        ))}
                                    </select>
                                    {courses.length === 0 && <span className="hint-text">Henüz ders yok</span>}
                                </div>
                                <div className="form-group-qr">
                                    <label>Tarih</label>
                                    <input
                                        type="date"
                                        value={form.date}
                                        onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <div className="form-row-qr">
                                <div className="form-group-qr">
                                    <label>Başlangıç Saati</label>
                                    <input
                                        type="time"
                                        value={form.start_time}
                                        onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                                    />
                                </div>
                                <div className="form-group-qr">
                                    <label>Bitiş Saati</label>
                                    <input
                                        type="time"
                                        value={form.end_time}
                                        onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                                    />
                                </div>
                            </div>

                            {/* Fakülte / Bina Seçimi — GPS otomatik doldurur */}
                            <div className="form-row-qr">
                                <div className="form-group-qr form-group-full">
                                    <label>🏛 Fakülte / Bina <span className="hint-text">(seçilince GPS otomatik dolar)</span></label>
                                    <select
                                        value={form.room_id}
                                        onChange={e => handleRoomChange(e.target.value)}
                                    >
                                        <option value="">— Fakülte seçiniz (opsiyonel) —</option>
                                        {rooms.map(r => (
                                            <option key={r.id} value={r.id}>
                                                {r.name}
                                                {r.latitude ? ` (${Number(r.latitude).toFixed(4)}, ${Number(r.longitude).toFixed(4)})` : ' — GPS tanımlı değil'}
                                            </option>
                                        ))}
                                    </select>
                                    {rooms.length === 0 && (
                                        <span className="hint-text hint-warn">
                                            Kayıtlı fakülte yok — Admin panelinden fakülte ekleyin
                                        </span>
                                    )}
                                    {form.room_id && !rooms.find(r => String(r.id) === String(form.room_id))?.latitude && (
                                        <span className="hint-text hint-warn">
                                            Bu fakülte için GPS tanımlı değil. Koordinatları manuel girin.
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="form-row-qr">
                                <div className="form-group-qr">
                                    <label>Enlem (GPS)</label>
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
                                    <label>Boylam (GPS)</label>
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
                                {starting ? 'Başlatılıyor...' : '▶ Oturum Başlat ve QR Üret'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
