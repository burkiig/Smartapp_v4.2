import React, { useEffect, useState, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { config } from '../../../shared/config/env';
import axios from 'axios';
import './QRScan.css';

export const QRScan = ({ onClose }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });
    const scannerRef = useRef(null);

    useEffect(() => {
        const scanner = new Html5QrcodeScanner(
            "qr-reader",
            {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
            },
            false
        );

        scanner.render(onScanSuccess, onScanError);
        scannerRef.current = scanner;

        async function onScanSuccess(decodedText) {
            setIsProcessing(true);
            setMessage({ text: 'Processing QR code...', type: 'info' });

            try {
                // Parse QR code data (assuming format: student_id)
                const response = await axios.post(`${config.API_URL}/api/attendance/qr`, {
                    qr_data: decodedText
                });

                if (response.data.success) {
                    setMessage({
                        text: `✓ Attendance marked for ${response.data.student_name || 'student'}`,
                        type: 'success'
                    });

                    scanner.clear();

                    setTimeout(() => {
                        if (onClose) onClose();
                    }, 2000);
                } else {
                    setMessage({
                        text: response.data.message || 'Invalid QR code',
                        type: 'error'
                    });
                    setIsProcessing(false);
                }
            } catch (error) {
                console.error('QR scan error:', error);
                setMessage({
                    text: error.response?.data?.message || 'Failed to mark attendance',
                    type: 'error'
                });
                setIsProcessing(false);
            }
        }

        function onScanError(error) {
            // Ignore scanning errors (too verbose)
            if (!error.includes('NotFoundException')) {
                console.warn('QR scan error:', error);
            }
        }

        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(console.error);
            }
        };
    }, [onClose]);

    return (
        <div className="qr-scan-container">
            <div className="qr-scan-header">
                <button className="back-button" onClick={onClose}>
                    ← Back
                </button>
                <div className="header-content">
                    <h2>QR Code Scanner</h2>
                    <p>Scan the QR code to mark attendance</p>
                </div>
            </div>

            <div className="scanner-section">
                <div id="qr-reader" className="qr-reader"></div>

                <div className="status-container">
                    {message.text && (
                        <div className={`message ${message.type}`}>
                            {message.text}
                        </div>
                    )}
                    {!message.text && (
                        <p className="status-text">
                            {isProcessing ? 'Processing...' : 'Position QR code within the frame'}
                        </p>
                    )}
                </div>
            </div>

            <div className="instructions">
                <h4>How to Scan</h4>
                <div className="instruction-item">
                    <span className="number">1</span>
                    <span>Allow camera access when prompted</span>
                </div>
                <div className="instruction-item">
                    <span className="number">2</span>
                    <span>Position the QR code within the blue frame</span>
                </div>
                <div className="instruction-item">
                    <span className="number">3</span>
                    <span>Hold steady until the scan completes</span>
                </div>
            </div>
        </div>
    );
};
