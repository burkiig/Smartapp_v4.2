import { useState, useCallback, useRef, useEffect } from 'react';
import apiClient from '../../../shared/services/apiClient';

const DEFAULT_QR_TTL_SECONDS = 20;

/**
 * Dynamic QR polling + rotation timer shared by QRScan, Classroom, and Present views.
 */
export function useSessionQR() {
  const [activeQR, setActiveQR] = useState(null);
  const [qrCountdown, setQrCountdown] = useState(DEFAULT_QR_TTL_SECONDS);
  const [qrTtlSeconds, setQrTtlSeconds] = useState(DEFAULT_QR_TTL_SECONDS);
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
      const ttl = Number(result?.ttl_seconds) > 0 ? Number(result.ttl_seconds) : DEFAULT_QR_TTL_SECONDS;
      setQrTtlSeconds(ttl);
      setQrCountdown(ttl);
    } catch (err) {
      console.error('[useSessionQR] rotate-qr error:', err);
    }
  }, []);

  const startQRRotation = useCallback((sessionId, ttlSeconds = DEFAULT_QR_TTL_SECONDS) => {
    clearInterval(rotateTimerRef.current);
    clearInterval(countdownTimerRef.current);
    const ttl = Number(ttlSeconds) > 0 ? Number(ttlSeconds) : DEFAULT_QR_TTL_SECONDS;
    setQrTtlSeconds(ttl);
    setQrCountdown(ttl);
    const rotateEveryMs = Math.max((ttl - 1) * 1000, 1000);
    rotateTimerRef.current = setInterval(() => rotateQR(sessionId), rotateEveryMs);
    countdownTimerRef.current = setInterval(() => {
      setQrCountdown((prev) => (prev <= 1 ? ttl : prev - 1));
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
    const ttl = dynRes.status === 'fulfilled' && Number(dynRes.value?.ttl_seconds) > 0
      ? Number(dynRes.value.ttl_seconds)
      : DEFAULT_QR_TTL_SECONDS;
    setActiveQR(next);
    startQRRotation(sessionId, ttl);
    return next;
  }, [startQRRotation]);

  const applyStartSessionResult = useCallback((session) => {
    const sessionId = session.id;
    setActiveQR({
      sessionId,
      qrImage: session.qr_image,
      staticQrImage: session.static_qr_image || null,
    });
    const ttl = Number(session?.ttl_seconds) > 0 ? Number(session.ttl_seconds) : DEFAULT_QR_TTL_SECONDS;
    startQRRotation(sessionId, ttl);
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
    qrTtlSeconds,
    fetchQRPair,
    applyStartSessionResult,
    dismissQR,
    manualRotate,
    rotateQR,
    stopQRRotation,
  };
}
