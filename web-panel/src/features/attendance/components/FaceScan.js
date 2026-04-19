import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import apiClient from '../../../shared/services/apiClient';
import './FaceScan.css';

export const FaceScan = ({ onClose, preselectedStudent }) => {
    const webcamRef = useRef(null);
    const [hasPermission, setHasPermission] = useState(null);
    const [isScanning, setIsScanning] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    // For manual attendance: select session + student
    const [sessions, setSessions] = useState([]);
    const [students, setStudents] = useState([]);
    const [selectedSession, setSelectedSession] = useState('');
    const [selectedStudent, setSelectedStudent] = useState(
        preselectedStudent ? String(preselectedStudent.id) : ''
    );
    const [loadingData, setLoadingData] = useState(true);

    useEffect(() => {
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(() => setHasPermission(true))
            .catch(() => setHasPermission(false));

        const loadData = async () => {
            try {
                const [sess, studs] = await Promise.allSettled([
                    apiClient.get('/sessions/active'),
                    apiClient.get('/users/students'),
                ]);
                if (sess.status === 'fulfilled') setSessions(sess.value || []);
                if (studs.status === 'fulfilled') setStudents(studs.value || []);
            } catch (err) {
                console.error('FaceScan load error:', err);
            } finally {
                setLoadingData(false);
            }
        };
        loadData();
    }, []);

    const handleScan = async () => {
        if (!selectedSession || !selectedStudent) {
            setMessage({ text: 'Oturum ve öğrenci seçiniz', type: 'error' });
            return;
        }
        if (!webcamRef.current) return;

        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) {
            setMessage({ text: 'Görüntü alınamadı', type: 'error' });
            return;
        }

        try {
            setIsScanning(true);
            setMessage({ text: 'Yüz doğrulanıyor...', type: 'info' });

            await apiClient.post('/attendance/manual', {
                session_id: Number(selectedSession),
                student_id: Number(selectedStudent),
                image_base64: imageSrc,
            });

            const student = students.find(s => String(s.id) === selectedStudent);
            setMessage({
                text: `✓ ${student?.name || 'Öğrenci'} için yoklama kaydedildi`,
                type: 'success',
            });
            setTimeout(() => {
                if (onClose) onClose();
            }, 2000);
        } catch (error) {
            setMessage({
                text: error.message || 'Yoklama kaydedilemedi',
                type: 'error',
            });
        } finally {
            setIsScanning(false);
        }
    };

    if (hasPermission === null) {
        return (
            <div className="face-scan-container">
                <div className="permission-loading">
                    <div className="spinner"></div>
                    <p>Kamera izni bekleniyor...</p>
                </div>
            </div>
        );
    }

    if (hasPermission === false) {
        return (
            <div className="face-scan-container">
                <div className="permission-denied">
                    <span className="icon">!</span>
                    <h3>Kamera İzni Gerekli</h3>
                    <p>Tarayıcı ayarlarından kamera iznini açınız.</p>
                    <button className="btn-secondary" onClick={onClose}>Geri Dön</button>
                </div>
            </div>
        );
    }

    return (
        <div className="face-scan-container">
            <div className="face-scan-header">
                <button className="back-button" onClick={onClose}>← Geri</button>
                <div className="header-content">
                    <h2>Manuel Yüz Yoklaması</h2>
                    <p>Öğretmen tarafından manuel yoklama kaydı</p>
                </div>
            </div>

            {loadingData ? (
                <div className="permission-loading"><div className="spinner"></div><p>Yükleniyor...</p></div>
            ) : (
                <>
                    <div className="manual-selectors">
                        <div className="selector-group">
                            <label>Aktif Oturum *</label>
                            <select value={selectedSession} onChange={e => setSelectedSession(e.target.value)}>
                                <option value="">Oturum seçiniz</option>
                                {sessions.map(s => (
                                    <option key={s.id} value={s.id}>
                                        #{s.id} — Ders {s.course_id} ({s.date})
                                    </option>
                                ))}
                            </select>
                            {sessions.length === 0 && (
                                <span className="no-data-hint">Aktif oturum yok. Önce oturum başlatın.</span>
                            )}
                        </div>
                        <div className="selector-group">
                            <label>Öğrenci *</label>
                            {preselectedStudent ? (
                                <div className="preselected-student">
                                    <strong>{preselectedStudent.name}</strong>
                                    <span> ({preselectedStudent.student_number || preselectedStudent.username})</span>
                                    <button type="button" className="btn-secondary" style={{ marginLeft: '8px', padding: '2px 8px', fontSize: '0.8rem' }} onClick={() => setSelectedStudent('')}>
                                        Degistir
                                    </button>
                                </div>
                            ) : (
                                <select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}>
                                    <option value="">Öğrenci seçiniz</option>
                                    {students.map(s => (
                                        <option key={s.id} value={s.id}>
                                            {s.name} ({s.student_number || s.username})
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>

                    <div className="camera-section">
                        <div className="camera-frame">
                            <Webcam
                                ref={webcamRef}
                                audio={false}
                                screenshotFormat="image/jpeg"
                                videoConstraints={{ width: 640, height: 480, facingMode: 'user' }}
                                className="webcam"
                            />
                            <div className="corner corner-tl"></div>
                            <div className="corner corner-tr"></div>
                            <div className="corner corner-bl"></div>
                            <div className="corner corner-br"></div>
                        </div>

                        <div className="status-container">
                            {message.text ? (
                                <div className={`message ${message.type}`}>{message.text}</div>
                            ) : (
                                <p className="status-text">{isScanning ? 'Taranıyor...' : 'Hazır'}</p>
                            )}
                        </div>
                    </div>

                    <div className="button-section">
                        <button
                            className={`scan-button ${isScanning ? 'scanning' : ''}`}
                            onClick={handleScan}
                            disabled={isScanning || !selectedSession || !selectedStudent}
                        >
                            {isScanning ? 'Kaydediliyor...' : 'Yoklamayı Kaydet'}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};
