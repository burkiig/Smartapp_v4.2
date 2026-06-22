/**
 * attendanceService.js — Updated for new FastAPI backend (/api/v1)
 */

import apiClient from '../../../shared/services/apiClient';

const FLAG_REASON_LABELS = {
  duplicate_attendance:     'Çift yoklama girişimi',
  location_bypassed:        'GPS doğrulaması atlandı',
  location_skipped:         'GPS koordinatı tanımlı değil',
  face_simulated:           'Yüz tanıma simüle edildi',
  location_and_face_bypass: 'GPS ve yüz tanıma ikisi de atlandı',
  manual_no_face:           'Manuel yoklama (yüzsüz)',
  manual_no_face_ref:       'Yüz referansı bulunamadı',
  face_not_enrolled:        'Yüz kaydı yok',
  face_failed:              'Yüz doğrulaması başarısız',
  fake_gps_detected:        'Sahte GPS tespit edildi',
  suspicious_accuracy:      'Şüpheli GPS hassasiyeti',
  low_accuracy:             'GPS doğruluğu düşük',
  location_failed:          'Konum doğrulaması başarısız',
};

export const STATUS_LABELS = {
  present:        'Mevcut',
  absent:         'Yok',
  excused:        'Mazeretli',
  pending_review: 'İncelemede',
};

function normalizeRecord(r) {
  return {
    id: r.id,
    student_id: r.student_id,
    studentId: r.student_id,
    studentName: r.student_name || `Öğrenci #${r.student_id}`,
    student: r.student_name || `Öğrenci #${r.student_id}`,
    course_id: r.course_id,
    courseId: r.course_id,
    courseTitle: r.course_name || r.course_code || `Ders #${r.course_id}`,
    course: r.course_name || r.course_code || `Ders #${r.course_id}`,
    session_id: r.session_id,
    timestamp: r.marked_at
      ? new Date(r.marked_at).toLocaleString('tr-TR')
      : '—',
    markedAt: r.marked_at,
    reason: FLAG_REASON_LABELS[r.flag_reason] || r.flag_reason || '—',
    reasonType: r.flag_reason === 'duplicate_attendance' ? 'error' : 'warning',
    flagReason: r.flag_reason,
    method: buildMethod(r.verification_steps),
    location: buildLocation(r.verification_steps),
    status: r.status || 'present',
    isFlagged: r.is_flagged,
    is_flagged: r.is_flagged,
    verificationSteps: r.verification_steps,
  };
}

function buildMethod(steps = {}) {
  const parts = [];
  if (steps?.location_ok !== false) parts.push('GPS');
  if (steps?.face_ok !== false)     parts.push('Yüz');
  if (steps?.qr_ok !== false)       parts.push('QR');
  return parts.length ? parts.join(' + ') : 'QR';
}

function buildLocation(steps = {}) {
  if (!steps) return '—';
  if (steps.fake_gps_detected) {
    const acc = steps.gps_accuracy_m != null ? ` (±${Math.round(steps.gps_accuracy_m)}m)` : '';
    return `Sahte GPS${acc}`;
  }
  if (steps.suspicious_accuracy) {
    const acc = steps.gps_accuracy_m != null ? ` (±${steps.gps_accuracy_m}m)` : '';
    return `Şüpheli GPS${acc}`;
  }
  if (steps.location_skipped) return 'Konum yok';
  if (steps.location_distance_m != null) {
    return `${Math.round(steps.location_distance_m)} m`;
  }
  return '—';
}

// ── Flagged attendance ────────────────────────────────────────────────────────

export const fetchFlaggedRecords = async () => {
  try {
    const records = await apiClient.get('/attendance/flagged');
    return { success: true, data: (records || []).map(normalizeRecord) };
  } catch (err) {
    console.error('[attendanceService] fetchFlaggedRecords:', err.message);
    return { success: false, data: [], error: err.message };
  }
};

export const approveFlaggedRecord = async (recordId) => {
  try {
    await apiClient.patch(`/attendance/${recordId}/override`, {
      status: 'present',
      note: 'Öğretmen onayladı',
    });
    return { success: true };
  } catch (err) {
    console.error('[attendanceService] approve:', err.message);
    return { success: false, error: err.message };
  }
};

export const rejectFlaggedRecord = async (recordId) => {
  try {
    await apiClient.patch(`/attendance/${recordId}/override`, {
      status: 'absent',
      note: 'Öğretmen reddetti',
    });
    return { success: true };
  } catch (err) {
    console.error('[attendanceService] reject:', err.message);
    return { success: false, error: err.message };
  }
};

export const undoFlaggedRecord = async (recordId) => {
  try {
    await apiClient.patch(`/attendance/${recordId}/override`, {
      status: 'pending_review',
      note: 'Karar geri alındı',
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

// ── Attendance records ────────────────────────────────────────────────────────

export const fetchAttendanceRecords = async (filters = {}) => {
  try {
    const response = await apiClient.get('/attendance/records', { params: { page: 1, page_size: 100, ...filters } });
    // Backend returns paginated object: { records: [...], total, page, total_pages }
    const data = Array.isArray(response) ? response : (response?.records || []);
    return {
      success: true,
      data,
      total: response?.total || data.length,
      total_pages: response?.total_pages || 1,
    };
  } catch (err) {
    console.error('[attendanceService] fetchAttendanceRecords:', err.message);
    return { success: false, data: [], error: err.message };
  }
};

export const fetchSessionAttendance = async (sessionId) => {
  try {
    const records = await apiClient.get(`/attendance/session/${sessionId}`);
    return { success: true, data: records || [] };
  } catch (err) {
    return { success: false, data: [], error: err.message };
  }
};

// ── Sessions ─────────────────────────────────────────────────────────────────

export const fetchActiveSessions = async () => {
  try {
    const sessions = await apiClient.get('/sessions/active');
    return { success: true, data: sessions || [] };
  } catch (err) {
    return { success: false, data: [], error: err.message };
  }
};

export const startSession = async (courseId, options = {}) => {
  try {
    const result = await apiClient.post('/sessions/start', {
      course_id: courseId,
      ...options,
    });
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const endSession = async (sessionId) => {
  try {
    const result = await apiClient.post(`/sessions/${sessionId}/end`);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const getSessionQR = async (sessionId) => {
  try {
    const result = await apiClient.get(`/sessions/${sessionId}/qr`);
    return { success: true, qr_image: result.qr_image };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const cancelClass = async (courseId, reason, sessionId = null) => {
  try {
    const result = await apiClient.post('/sessions/cancel', {
      course_id: courseId,
      session_id: sessionId,
      reason,
    });
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

// ── Class details ─────────────────────────────────────────────────────────────

export const fetchClassDetails = async (sessionId) => {
  try {
    const session = await apiClient.get(`/sessions/${sessionId}`);
    return { success: true, data: session };
  } catch (err) {
    return { success: false, error: err.message };
  }
};
