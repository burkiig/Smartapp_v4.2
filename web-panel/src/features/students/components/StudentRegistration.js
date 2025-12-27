import React, { useState, useRef } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';
import { config } from '../../../shared/config/env';
import './StudentRegistration.css';

function StudentRegistration() {
    const [studentId, setStudentId] = useState('');
    const [name, setName] = useState('');
    const [message, setMessage] = useState({ text: '', type: '' });
    const [showCamera, setShowCamera] = useState(false);
    const webcamRef = useRef(null);

    const capture = async () => {
        if (!studentId || !name) {
            setMessage({ text: 'Lütfen tüm alanları doldurun', type: 'error' });
            return;
        }

        const imageSrc = webcamRef.current.getScreenshot();

        try {
            const response = await axios.post(`${config.API_URL}/api/register`, {
                student_id: studentId,
                name: name,
                image: imageSrc
            });

            if (response.data.success) {
                setMessage({ text: 'Öğrenci başarıyla kaydedildi!', type: 'success' });
                setStudentId('');
                setName('');
                setShowCamera(false);
            } else {
                setMessage({ text: response.data.message, type: 'error' });
            }
        } catch (error) {
            setMessage({ text: 'Kayıt sırasında hata oluştu', type: 'error' });
        }
    };

    return (
        <div className="register-container">
            <h2>Register New Student</h2>
            <p>Yeni öğrenci kaydı için bilgileri doldurun ve fotoğraf çekin</p>

            {message.text && (
                <div className={`message ${message.type}`}>
                    {message.type === 'success' ? '✓' : '⚠'} {message.text}
                </div>
            )}

            <div className="form-group">
                <label>Öğrenci No:</label>
                <input
                    type="text"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    placeholder="Öğrenci numarasını girin"
                />
            </div>

            <div className="form-group">
                <label>Ad Soyad:</label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Öğrenci adını girin"
                />
            </div>

            <div className="camera-container">
                {showCamera ? (
                    <Webcam
                        audio={false}
                        ref={webcamRef}
                        screenshotFormat="image/jpeg"
                        className="webcam"
                    />
                ) : (
                    <div className="camera-placeholder">
                        <p>Kamera kapalı</p>
                    </div>
                )}
            </div>

            <div className="button-group">
                <button
                    className="btn btn-primary"
                    onClick={() => setShowCamera(!showCamera)}
                >
                    {showCamera ? 'Kamerayı Kapat' : 'Kamerayı Aç'}
                </button>
                {showCamera && (
                    <button className="btn btn-success" onClick={capture}>
                        Fotoğraf Çek ve Kaydet
                    </button>
                )}
            </div>
        </div>
    );
}

export default StudentRegistration;
