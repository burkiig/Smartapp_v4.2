import { useState, useCallback, useRef, useEffect } from 'react';
import apiClient from '../../../shared/services/apiClient';

const QR_ROTATE_INTERVAL_MS = 55_000;

/**
 * Dynamic QR polling + rotation timer shared by QRScan, Classroom, and Present views.
 */
export function useSessionQR() {
  const [activeQR, setActiveQR] = useState(null);
  const [qrCountdown, setQrCountdown] = useState(55);
  const rotateTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);

  const stopQRRotation = useCallback(() => {
    clearInterval(rotateTimerRef.current);
    clearInterval(countdownTimerRef.current);
    rotateTimerRef.current = null;
    countdownTimerRef.current = null;
  }, []);

  const rotateQR = useCallback(async (sessionId) => {
    try {
      const result = await apiClient.post(`/sessions/${sessionId}/rotate-qr`);
      setActiveQR((prev) => (prev?.sessionId === sessionId
        ? { ...prev, qrImage: result.qr_image }
        : prev));
      setQrCountdown(55);
    } catch (err) {
      console.error('[useSessionQR] rotate-qr error:', err);
    }
  }, []);

  const startQRRotation = useCallback((sessionId) => {
    clearInterval(rotateTimerRef.current);
    clearInterval(countdownTimerRef.current);
    setQrCountdown(55);
    rotateTimerRef.current = setInterval(() => rotateQR(sessionId), QR_ROTATE_INTERVAL_MS);
    countdownTimerRef.current = setInterval(() => {
      setQrCountdown((prev) => (prev <= 1 ? 55 : prev - 1));
    }, 1000);
  }, [rotateQR]);

  useEffect(() => () => stopQRRotation(), [stopQRRotation]);

  const fetchQRPair = useCallback(async (sessionId) => {
    const [dynRes, statRes] = await Promise.allSettled([
      apiClient.get(`/sessions/${sessionId}/qr`),
      apiClient.get(`/sessions/${sessionId}/static-qr`),
    ]);
    const next = {
      sessionId,
      qrImage: dynRes.status === 'fulfilled' ? dynRes.value.qr_image : null,
      staticQrImage: statRes.status === 'fulfilled' ? statRes.value.qr_image : null,
    };
    setActiveQR(next);
    startQRRotation(sessionId);
    return next;
  }, [startQRRotation]);

  const applyStartSessionResult = useCallback((session) => {
    const sessionId = session.id;
    setActiveQR({
      sessionId,
      qrImage: session.qr_image,
      staticQrImage: session.static_qr_image || null,
    });
    startQRRotation(sessionId);
  }, [startQRRotation]);

  const dismissQR = useCallback(() => {
    stopQRRotation();
    setActiveQR(null);
  }, [stopQRRotation]);

  const manualRotate = useCallback(async () => {
    const sid = activeQR?.sessionId;
    if (sid) await rotateQR(sid);
  }, [activeQR, rotateQR]);

  return {
    activeQR,
    qrCountdown,
    fetchQRPair,
    applyStartSessionResult,
    dismissQR,
    manualRotate,
    rotateQR,
    stopQRRotation,
  };
}
