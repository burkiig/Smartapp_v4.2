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
  const hasUploadedDocument =
    !!e.storage_path && (e.upload_status || 'uploaded') === 'uploaded';

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
    uploadStatus: e.upload_status || 'none',
    uploadError: e.upload_error || null,
    documentMime: e.document_mime || null,
    documentName: e.document_name || null,
    // storage_path is a private storage key; the actual download URL is obtained
    // on demand via GET /excuses/{id}/document (returns a time-limited signed URL).
    hasDocument: hasUploadedDocument,
    documents: hasUploadedDocument
      ? [{ name: e.document_name || 'Belge', excuseId: e.id, storagePath: e.storage_path }]
      : [],
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

export const submitExcuse = async ({ courseId, sessionId, sessionDate, excuseType, description }) => {
  try {
    const excuse = await apiClient.post('/excuses/', {
      course_id: courseId,
      session_id: sessionId || null,
      session_date: sessionDate,
      excuse_type: excuseType,
      description,
    });
    return { success: true, excuse };
  } catch (err) {
    console.error('[excuseService] submitExcuse:', err.message);
    return { success: false, error: err.message };
  }
};

export const fetchExcuseDocumentUrl = async (excuseId, expiresIn = 3600) => {
  try {
    const data = await apiClient.get(`/excuses/${excuseId}/document`, {
      params: { expires_in: expiresIn },
    });
    return { success: true, signedUrl: data.signed_url, expiresIn: data.expires_in };
  } catch (err) {
    console.error('[excuseService] fetchExcuseDocumentUrl:', err.message);
    return { success: false, error: err.message };
  }
};
