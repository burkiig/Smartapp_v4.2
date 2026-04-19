/**
 * excuseService.js — Updated for new FastAPI backend (/api/v1)
 */

import apiClient from '../../../shared/services/apiClient';

const EXCUSE_TYPE_LABELS = {
  medical:          'Sağlık (Doktor Raporu)',
  health:           'Sağlık (Doktor Raporu)',
  family:           'Aile Acil Durumu',
  school_activity:  'Okul Etkinliği',
  transportation:   'Ulaşım',
  other:            'Diğer',
};

function normalizeExcuse(e) {
  return {
    id: e.id,
    student_id: e.student_id,
    studentId: e.student_id,
    studentName: e.student_name || `Öğrenci #${e.student_id}`,
    student: e.student_name || `Öğrenci #${e.student_id}`,
    course_id: e.course_id,
    courseId: e.course_id,
    courseTitle: e.course_name || e.course_code || `Ders #${e.course_id}`,
    course: e.course_name || e.course_code || `Ders #${e.course_id}`,
    classDate: e.session_date || '—',
    sessionDate: e.session_date || '—',
    excuseType: e.excuse_type || 'other',
    excuseTypeLabel: EXCUSE_TYPE_LABELS[e.excuse_type] || e.excuse_type || 'Diğer',
    excuseDescription: e.description || '',
    description: e.description || '',
    documents: e.document_url ? [{ name: 'Belge', url: e.document_url }] : [],
    submittedAt: e.created_at
      ? new Date(e.created_at).toLocaleString('tr-TR')
      : '—',
    createdAt: e.created_at,
    status: e.status || 'pending',
    instructorNotes: e.instructor_notes || '',
  };
}

export const fetchExcuseRecords = async (filters = {}) => {
  try {
    const excuses = await apiClient.get('/excuses/', { params: filters });
    return { success: true, data: (excuses || []).map(normalizeExcuse) };
  } catch (err) {
    console.error('[excuseService] fetchExcuseRecords:', err.message);
    return { success: false, data: [], error: err.message };
  }
};

export const fetchExcuseById = async (excuseId) => {
  try {
    const excuse = await apiClient.get(`/excuses/${excuseId}`);
    return { success: true, data: normalizeExcuse(excuse) };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const approveExcuse = async (excuseId, instructorNotes = '') => {
  try {
    await apiClient.patch(`/excuses/${excuseId}`, {
      status: 'approved',
      instructor_notes: instructorNotes,
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const rejectExcuse = async (excuseId, reason = '') => {
  try {
    await apiClient.patch(`/excuses/${excuseId}`, {
      status: 'rejected',
      instructor_notes: reason,
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const undoExcuse = async (excuseId) => {
  try {
    await apiClient.patch(`/excuses/${excuseId}`, { status: 'pending' });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const submitExcuse = async ({ courseId, sessionId, sessionDate, excuseType, description, documentUrl = '' }) => {
  try {
    const excuse = await apiClient.post('/excuses/', {
      course_id: courseId,
      session_id: sessionId || null,
      session_date: sessionDate,
      excuse_type: excuseType,
      description,
      document_url: documentUrl,
    });
    return { success: true, excuse };
  } catch (err) {
    console.error('[excuseService] submitExcuse:', err.message);
    return { success: false, error: err.message };
  }
};
