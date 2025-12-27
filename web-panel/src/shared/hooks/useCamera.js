import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for camera access and management
 */
export const useCamera = () => {
    const [hasPermission, setHasPermission] = useState(null);
    const [error, setError] = useState(null);
    const [stream, setStream] = useState(null);

    // Request camera permission
    const requestPermission = useCallback(async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                }
            });

            setStream(mediaStream);
            setHasPermission(true);
            setError(null);
            return mediaStream;
        } catch (err) {
            console.error('Camera permission error:', err);
            setHasPermission(false);

            if (err.name === 'NotAllowedError') {
                setError('Camera permission denied. Please allow camera access in your browser settings.');
            } else if (err.name === 'NotFoundError') {
                setError('No camera found on this device.');
            } else {
                setError('Failed to access camera. Please try again.');
            }

            return null;
        }
    }, []);

    // Stop camera stream
    const stopCamera = useCallback(() => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    }, [stream]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopCamera();
        };
    }, [stopCamera]);

    return {
        hasPermission,
        error,
        stream,
        requestPermission,
        stopCamera
    };
};
