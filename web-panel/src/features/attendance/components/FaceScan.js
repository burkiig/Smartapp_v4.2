import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { config } from '../../../shared/config/env';
import axios from 'axios';
import './FaceScan.css';

export const FaceScan = ({ onClose }) => {
    const webcamRef = useRef(null);
    const [isScanning, setIsScanning] = useState(false);
    const [hasPermission, setHasPermission] = useState(null);
    const [message, setMessage] = useState({ text: '', type: '' });

    useEffect(() => {
        // Check camera permission
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(() => setHasPermission(true))
            .catch(() => setHasPermission(false));
    }, []);

    const handleScan = async () => {
        if (!webcamRef.current) return;

        const imageSrc = webcamRef.current.getScreenshot();

        if (!imageSrc) {
            setMessage({ text: 'Failed to capture image', type: 'error' });
            return;
        }

        try {
            setIsScanning(true);
            setMessage({ text: 'Scanning...', type: 'info' });

            const response = await axios.post(`${config.API_URL}/api/attendance`, {
                image: imageSrc
            });

            if (response.data.success) {
                setMessage({
                    text: `✓ Attendance marked for ${response.data.student_name || 'student'}`,
                    type: 'success'
                });

                setTimeout(() => {
                    if (onClose) onClose();
                }, 2000);
            } else {
                setMessage({
                    text: response.data.message || 'Face not recognized',
                    type: 'error'
                });
            }
        } catch (error) {
            console.error('Face scan error:', error);
            setMessage({
                text: error.response?.data?.message || 'Failed to mark attendance',
                type: 'error'
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
                    <p>Requesting camera permission...</p>
                </div>
            </div>
        );
    }

    if (hasPermission === false) {
        return (
            <div className="face-scan-container">
                <div className="permission-denied">
                    <span className="icon">⚠️</span>
                    <h3>Camera Permission Required</h3>
                    <p>Please allow camera access in your browser settings to use face scanning.</p>
                    <button className="btn-secondary" onClick={onClose}>Go Back</button>
                </div>
            </div>
        );
    }

    return (
        <div className="face-scan-container">
            <div className="face-scan-header">
                <button className="back-button" onClick={onClose}>
                    ← Back
                </button>
                <div className="header-content">
                    <h2>Face ID Attendance</h2>
                    <p>Position your face within the frame</p>
                </div>
            </div>

            <div className="camera-section">
                <div className="camera-frame">
                    <Webcam
                        ref={webcamRef}
                        audio={false}
                        screenshotFormat="image/jpeg"
                        videoConstraints={{
                            width: 640,
                            height: 480,
                            facingMode: "user"
                        }}
                        className="webcam"
                    />

                    {/* Corner decorations */}
                    <div className="corner corner-tl"></div>
                    <div className="corner corner-tr"></div>
                    <div className="corner corner-bl"></div>
                    <div className="corner corner-br"></div>
                </div>

                <div className="status-container">
                    {message.text && (
                        <div className={`message ${message.type}`}>
                            {message.text}
                        </div>
                    )}
                    {!message.text && (
                        <p className="status-text">
                            {isScanning ? 'Hold still during scanning...' : 'Ready to scan'}
                        </p>
                    )}
                </div>
            </div>

            <div className="button-section">
                <button
                    className={`scan-button ${isScanning ? 'scanning' : ''}`}
                    onClick={handleScan}
                    disabled={isScanning}
                >
                    {isScanning ? 'Scanning...' : 'Start Face Scan'}
                </button>
            </div>

            <div className="instructions">
                <h4>Instructions</h4>
                <div className="instruction-item">
                    <span className="number">1</span>
                    <span>Position your face in the center of the frame</span>
                </div>
                <div className="instruction-item">
                    <span className="number">2</span>
                    <span>Ensure good lighting for better recognition</span>
                </div>
                <div className="instruction-item">
                    <span className="number">3</span>
                    <span>Hold still during the scanning process</span>
                </div>
            </div>
        </div>
    );
};
