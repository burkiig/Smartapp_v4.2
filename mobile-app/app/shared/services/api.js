/**
 * Merkezi API Servisi — Updated for FastAPI backend (/api/v1)
 */
import apiAdapter from '../utils/apiAdapter';

// ==================== AUTH ====================

export const auth = {
  /** POST /api/v1/auth/login */
  login: (login, password) =>
    apiAdapter.post('/auth/login', { login, password }),

  /** POST /api/v1/auth/logout */
  logout: () =>
    apiAdapter.post('/auth/logout', {}),

  /** GET /api/v1/auth/me */
  me: () =>
    apiAdapter.get('/auth/me'),

  /** POST /api/v1/auth/refresh — uses refresh token from SecureStore */
  refresh: (refreshToken) =>
    apiAdapter.postWithToken('/auth/refresh', {}, refreshToken),

  /** POST /api/v1/auth/push-token */
  savePushToken: (push_token) =>
    apiAdapter.post('/auth/push-token', { push_token }),
};

// ==================== SESSIONS ====================

export const sessions = {
  /** GET /api/v1/sessions/active */
  getActive: () =>
    apiAdapter.get('/sessions/active'),

  /** GET /api/v1/sessions?course_id=&status= */
  list: (params = {}) => {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
    ).toString();
    return apiAdapter.get(`/sessions${query ? `?${query}` : ''}`);
  },

  /** GET /api/v1/sessions/<id> */
  get: (sessionId) =>
    apiAdapter.get(`/sessions/${sessionId}`),

  /** POST /api/v1/sessions/start */
  start: (courseId, options = {}) =>
    apiAdapter.post('/sessions/start', { course_id: courseId, ...options }),

  /** POST /api/v1/sessions/<id>/end */
  end: (sessionId) =>
    apiAdapter.post(`/sessions/${sessionId}/end`, {}),

  /** POST /api/v1/sessions/cancel */
  cancel: (courseId, reason, sessionId = null) =>
    apiAdapter.post('/sessions/cancel', { course_id: courseId, reason, session_id: sessionId }),
};

// ==================== ATTENDANCE PIPELINE ====================

export const attendance = {
  /**
   * STEP 1 — POST /api/v1/attendance/scan-qr
   */
  scanQR: (sessionId, qrToken) =>
    apiAdapter.post('/attendance/scan-qr', {
      session_id: sessionId,
      qr_token: qrToken,
    }),

  /**
   * STEP 2 — POST /api/v1/attendance/verify-face
   */
  verifyFace: (sessionId, imageBase64, imageBase64_2 = null) =>
    apiAdapter.post('/attendance/verify-face', {
      session_id: sessionId,
      image_base64: imageBase64,
      image_base64_2: imageBase64_2,
    }),

  /**
   * STEP 3 — POST /api/v1/attendance/verify-location
   */
  verifyLocation: (sessionId, latitude, longitude, accuracy = null, is_mocked = null) =>
    apiAdapter.post('/attendance/verify-location', {
      session_id: sessionId,
      latitude,
      longitude,
      accuracy,
      is_mocked,
    }),

  /** GET /api/v1/attendance/attempt/<session_id> — current pipeline state */
  getAttempt: (sessionId) =>
    apiAdapter.get(`/attendance/attempt/${sessionId}`),

  /** GET /api/v1/attendance/my-history */
  myHistory: () =>
    apiAdapter.get('/attendance/my-history'),

  /** GET /api/v1/attendance/records */
  getRecords: (params = {}) => {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
    ).toString();
    return apiAdapter.get(`/attendance/records${query ? `?${query}` : ''}`);
  },

  /** GET /api/v1/attendance/flagged */
  getFlagged: () =>
    apiAdapter.get('/attendance/flagged'),

  /** PATCH /api/v1/attendance/<id>/review */
  review: (recordId, isFlagged, flagReason, status) =>
    apiAdapter.patch(`/attendance/${recordId}/review`, {
      is_flagged: isFlagged,
      flag_reason: flagReason,
      status,
    }),
};

// ==================== FACE ====================

export const face = {
  /** POST /api/v1/face/enroll — student self-enrolls */
  enroll: (imageBase64) =>
    apiAdapter.post('/face/enroll', { image_base64: imageBase64 }),

  /** GET /api/v1/face/my-status */
  myStatus: () =>
    apiAdapter.get('/face/my-status'),
};

// ==================== USERS ====================

export const users = {
  /** GET /api/v1/users/students */
  students: () =>
    apiAdapter.get('/users/students'),

  /** GET /api/v1/users/instructors */
  instructors: () =>
    apiAdapter.get('/users/instructors'),

  /** POST /api/v1/users — create user (admin) */
  create: (userData) =>
    apiAdapter.post('/users', userData),

  /** DELETE /api/v1/users/<id> */
  delete: (userId) =>
    apiAdapter.delete(`/users/${userId}`),
};

// ==================== COURSES ====================

export const courses = {
  /** GET /api/v1/courses/ */
  list: () =>
    apiAdapter.get('/courses/'),

  /** GET /api/v1/courses/<id>/students */
  students: (courseId) =>
    apiAdapter.get(`/courses/${courseId}/students`),

  /** POST /api/v1/courses/<id>/enroll */
  enroll: (courseId, studentId) =>
    apiAdapter.post(`/courses/${courseId}/enroll`, { student_id: studentId, course_id: courseId }),

  /** DELETE /api/v1/courses/<id>/enroll/<student_id> */
  unenroll: (courseId, studentId) =>
    apiAdapter.delete(`/courses/${courseId}/enroll/${studentId}`),
};

// ==================== EXCUSES ====================

export const excuses = {
  /** GET /api/v1/excuses?course_id= */
  list: (params = {}) => {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
    ).toString();
    return apiAdapter.get(`/excuses${query ? `?${query}` : ''}`);
  },

  /** POST /api/v1/excuses/ */
  submit: ({ courseId, sessionId, sessionDate, excuseType, description, documentUrl = '' }) =>
    apiAdapter.post('/excuses/', {
      course_id: courseId,
      session_id: sessionId || null,
      session_date: sessionDate,
      excuse_type: excuseType,
      description,
      document_url: documentUrl,
    }),

  /** PATCH /api/v1/excuses/<id> */
  review: (excuseId, status, notes = '') =>
    apiAdapter.patch(`/excuses/${excuseId}/`, { status, instructor_notes: notes }),
};

// ==================== DISPUTES ====================

export const disputes = {
  /** POST /api/v1/disputes/ — student submits a dispute */
  submit: ({ sessionId, courseId, reason }) =>
    apiAdapter.post('/disputes/', { session_id: sessionId, course_id: courseId, reason }),

  /** GET /api/v1/disputes/ — student: own disputes, instructor: course disputes */
  list: () =>
    apiAdapter.get('/disputes/'),

  /** PATCH /api/v1/disputes/<id> — instructor reviews dispute */
  review: (disputeId, status, instructorNotes = '') =>
    apiAdapter.patch(`/disputes/${disputeId}`, { status, instructor_notes: instructorNotes }),
};

// ==================== ROOMS / FACULTIES ====================

export const rooms = {
  /** GET /api/v1/rooms — list all faculties/buildings with GPS */
  list: () =>
    apiAdapter.get('/rooms/'),
};

// ==================== DASHBOARD ====================

export const dashboard = {
  stats: () =>
    apiAdapter.get('/dashboard/stats'),

  coursePerformance: () =>
    apiAdapter.get('/dashboard/course-performance'),

  recentActivity: () =>
    apiAdapter.get('/dashboard/recent-activity'),
};
