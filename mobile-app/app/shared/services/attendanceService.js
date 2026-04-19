/**
 * Mobile Attendance Service — Updated for FastAPI 3-step pipeline
 * Pipeline: QR scan → Face verify → Location verify
 */
import { attendance, sessions, face } from './api';

/**
 * STEP 1: Scan QR code
 * @param {number} sessionId
 * @param {string} qrToken - token from QR payload
 */
export const scanQR = async (sessionId, qrToken) => {
  try {
    const result = await attendance.scanQR(sessionId, qrToken);
    return { success: true, attempt: result };
  } catch (err) {
    return { success: false, message: err?.message || 'QR tarama başarısız' };
  }
};

/**
 * Parse QR payload string "session_id=X;course_id=Y;token=Z"
 */
export const parseQRPayload = (payload) => {
  try {
    const parts = {};
    for (const item of payload.split(';')) {
      const [k, v] = item.split('=');
      parts[k.trim()] = v.trim();
    }
    return {
      sessionId: parseInt(parts.session_id),
      courseId: parseInt(parts.course_id),
      token: parts.token,
    };
  } catch {
    return null;
  }
};

/**
 * STEP 2: Verify face
 * @param {number} sessionId
 * @param {string} imageBase64
 * @param {string|null} imageBase64_2 - second frame for liveness (optional)
 */
export const verifyFace = async (sessionId, imageBase64, imageBase64_2 = null) => {
  try {
    const result = await attendance.verifyFace(sessionId, imageBase64, imageBase64_2);
    return { success: true, attempt: result };
  } catch (err) {
    return { success: false, message: err?.message || 'Yüz doğrulama başarısız' };
  }
};

/**
 * STEP 3: Verify location + finalize attendance
 * @param {number} sessionId
 * @param {number} latitude
 * @param {number} longitude
 * @param {number|null} accuracy - GPS accuracy in metres
 */
export const verifyLocation = async (sessionId, latitude, longitude, accuracy = null) => {
  try {
    const result = await attendance.verifyLocation(sessionId, latitude, longitude, accuracy);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, message: err?.message || 'Konum doğrulama başarısız' };
  }
};

/**
 * Get current pipeline state
 */
export const getAttempt = async (sessionId) => {
  try {
    const result = await attendance.getAttempt(sessionId);
    return { success: true, attempt: result };
  } catch (err) {
    return { success: false, message: err?.message };
  }
};

/**
 * Get student's attendance history
 */
export const getMyHistory = async () => {
  try {
    const records = await attendance.myHistory();
    return { success: true, records: records || [] };
  } catch (err) {
    return { success: false, records: [], message: err?.message };
  }
};

/**
 * Get active sessions
 */
export const getActiveSessions = async () => {
  try {
    const result = await sessions.getActive();
    return { success: true, sessions: result || [] };
  } catch (err) {
    return { success: false, sessions: [], message: err?.message };
  }
};

/**
 * Enroll face (student self-enroll)
 */
export const enrollFace = async (imageBase64) => {
  try {
    const result = await face.enroll(imageBase64);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, message: err?.message || 'Yüz kaydı başarısız' };
  }
};

/**
 * Check own face enrollment status
 */
export const getFaceStatus = async () => {
  try {
    const result = await face.myStatus();
    return { success: true, isEnrolled: result?.is_enrolled || false };
  } catch (err) {
    return { success: false, isEnrolled: false };
  }
};
