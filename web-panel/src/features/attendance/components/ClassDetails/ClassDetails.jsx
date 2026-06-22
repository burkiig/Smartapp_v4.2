import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../../../../shared/services/apiClient';
import { Badge } from '../../../../shared/components/ui/Badge';
import './ClassDetails.css';

const STATUS_OPTIONS = [
  { value: 'present', label: 'Katıldı',   color: '#059669', bg: '#D1FAE5' },
  { value: 'absent',  label: 'Katılmadı', color: '#DC2626', bg: '#FEE2E2' },
  { value: 'excused', label: 'Mazeretli', color: '#D97706', bg: '#FEF3C7' },
];

export const ClassDetails = ({ classData, onBack }) => {
  const [session, setSession] = useState(classData);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [overriding, setOverriding] = useState(new Set());
  const [localStatuses, setLocalStatuses] = useState({});

  const normalizeId = (value) => (value == null ? '' : String(value));

  const fetchDetails = useCallback(async () => {
    if (!session?.id) return;
    setLoading(true);
    try {
      const [attnRes, courseRes, studentsRes] = await Promise.allSettled([
        apiClient.get(`/attendance/session/${session.id}`),
        apiClient.get(`/courses/${session.course_id}`),
        apiClient.get(`/courses/${session.course_id}/students`),
      ]);
      if (attnRes.status === 'fulfilled') setAttendanceRecords(attnRes.value || []);
      if (courseRes.status === 'fulfilled') setCourse(courseRes.value);
      if (studentsRes.status === 'fulfilled') setEnrolledStudents(studentsRes.value || []);
    } catch (err) {
      console.error('ClassDetails fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [session?.id, session?.course_id]);

  useEffect(() => { fetchDetails(); }, [fetchDetails]);

  // Auto-refresh attendance list every 10s while session is active
  useEffect(() => {
    if (session?.status !== 'active') return;
    const interval = setInterval(fetchDetails, 10000);
    return () => clearInterval(interval);
  }, [session?.status, fetchDetails]);

  const handleEndSession = async () => {
    try {
      await apiClient.post(`/sessions/${session.id}/end`);
      setSession(prev => ({ ...prev, status: 'closed' }));
    } catch (err) {
      alert(err.message || 'Oturum sonlandırılamadı');
    }
  };

  const handleCancelClass = async () => {
    try {
      await apiClient.post('/sessions/cancel', {
        course_id: session.course_id,
        session_id: session.id,
        reason: cancelReason || 'Ders iptal edildi',
      });
      setShowCancelModal(false);
      onBack();
    } catch (err) {
      alert(err.message || 'İptal işlemi başarısız');
    }
  };

  const handleOverrideRecord = async (record, newStatus) => {
    const key = record.id;
    if (overriding.has(key)) return;
    if ((localStatuses[key] ?? record.status) === newStatus) return;
    setOverriding(prev => new Set([...prev, key]));
    setLocalStatuses(prev => ({ ...prev, [key]: newStatus }));
    try {
      await apiClient.patch(`/attendance/${record.id}/override`, {
        status: newStatus,
        note: 'Öğretmen tarafından güncellendi',
      });
    } catch (err) {
      setLocalStatuses(prev => ({ ...prev, [key]: record.status }));
      alert(err.message || 'Güncelleme başarısız');
    } finally {
      setOverriding(prev => { const n = new Set(prev); n.delete(key); return n; });
    }
  };

  const handleSetStatus = async (studentId, newStatus) => {
    const key = `new-${studentId}`;
    if (overriding.has(key)) return;
    setOverriding(prev => new Set([...prev, key]));
    try {
      await apiClient.put('/attendance/set-status', {
        session_id: session.id,
        student_id: studentId,
        status: newStatus,
        note: 'Öğretmen tarafından oluşturuldu',
      });
      await fetchDetails();
    } catch (err) {
      alert(err.message || 'Güncelleme başarısız');
    } finally {
      setOverriding(prev => { const n = new Set(prev); n.delete(key); return n; });
    }
  };

  // Normalize IDs once to avoid number/string mismatch between endpoints.
  const enrolledIdSet = new Set(enrolledStudents.map(s => normalizeId(s.id)));
  const recordedStudentIds = new Set(
    attendanceRecords
      .map(r => normalizeId(r.student_id))
      .filter(id => enrolledIdSet.has(id))
  );
  // All non-absent records (present + pending_review + excused) count as attended.
  const presentIds = new Set(
    attendanceRecords
      .filter(r => r.status !== 'absent')
      .map(r => normalizeId(r.student_id))
      .filter(id => enrolledIdSet.has(id))
  );
  // Right panel is for students without any attendance record yet.
  const studentsWithoutRecord = enrolledStudents.filter(
    s => !recordedStudentIds.has(normalizeId(s.id))
  );
  const presentCount = presentIds.size;
  const absentCount = Math.max(0, enrolledStudents.length - presentCount);
  const flaggedCount = attendanceRecords.filter(r => r.is_flagged).length;
  const courseName = course ? `${course.code} — ${course.name}` : `Ders #${session.course_id}`;

  if (loading) {
    return (
      <div className="class-details">
        <button className="back-btn" onClick={onBack}>← Geri</button>
        <div className="details-loading">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="class-details">
      <div className="details-header">
        <div className="header-top">
          <button className="back-btn" onClick={onBack}>← Geri</button>
          <div className="header-actions">
            {session.status === 'active' && (
              <button className="action-btn danger" onClick={handleEndSession}>
                Oturumu Bitir
              </button>
            )}
            <button className="action-btn secondary" onClick={() => setShowCancelModal(true)}>
              ✕ Dersi İptal Et
            </button>
          </div>
        </div>
        <div className="header-title-section">
          <h1 className="details-title">{courseName}</h1>
          <div className="details-meta">
            <span className="meta-item">{session.date || '—'}</span>
            <span className="meta-divider">•</span>
            <span className="meta-item">{session.start_time || '—'}{session.end_time ? ` – ${session.end_time}` : ''}</span>
            <span className="meta-divider">•</span>
            <span className={`meta-status-${session.status === 'active' ? 'active' : 'completed'}`}>
              {session.status === 'active' ? '● Aktif' : '✓ Tamamlandı'}
            </span>
          </div>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-box">
          <div className="stat-icon blue">👥</div>
          <div className="stat-info">
            <div className="stat-value">{enrolledStudents.length}</div>
            <div className="stat-label">Kayıtlı Öğrenci</div>
          </div>
        </div>
        <div className="stat-box">
          <div className="stat-icon green">✓</div>
          <div className="stat-info">
            <div className="stat-value">{presentCount}</div>
            <div className="stat-label">Katılan</div>
            <div className="stat-percentage">
              {enrolledStudents.length > 0 ? Math.round((presentCount / enrolledStudents.length) * 100) : 0}%
            </div>
          </div>
        </div>
        <div className="stat-box">
          <div className="stat-icon gray">○</div>
          <div className="stat-info">
            <div className="stat-value">{absentCount}</div>
            <div className="stat-label">Katılmayan</div>
          </div>
        </div>
        <div className="stat-box">
          <div className="stat-icon yellow">!</div>
          <div className="stat-info">
            <div className="stat-value">{flaggedCount}</div>
            <div className="stat-label">Şüpheli</div>
          </div>
        </div>
      </div>

      <div className="content-row">
        <div className="timeline-section">
          <h2 className="section-title">Yoklama Kayıtları</h2>
          {attendanceRecords.length === 0 ? (
            <p className="empty-text">Henüz yoklama kaydı yok</p>
          ) : (
            <div className="students-table-container">
              <table className="students-table">
                <thead>
                  <tr>
                    <th>Öğrenci</th>
                    <th>Zaman</th>
                    <th>Durum / Düzenle</th>
                    <th>Bayrak</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceRecords.map(r => {
                    const currentStatus = localStatuses[r.id] ?? r.status;
                    const isBusy = overriding.has(r.id);
                    return (
                      <tr key={r.id}>
                        <td>
                          <div className="student-cell">
                            <div className="student-avatar-small">
                              {(r.student_name || String(r.student_id)).charAt(0).toUpperCase()}
                            </div>
                            <span>{r.student_name || `Öğrenci #${r.student_id}`}</span>
                          </div>
                        </td>
                        <td>{r.marked_at ? new Date(r.marked_at).toLocaleTimeString('tr-TR') : '—'}</td>
                        <td>
                          <div className="status-btns">
                            {STATUS_OPTIONS.map(opt => {
                              const isActive = currentStatus === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  className={`status-override-btn${isActive ? ' active' : ''}`}
                                  style={isActive ? { background: opt.bg, color: opt.color, borderColor: opt.color } : {}}
                                  disabled={isBusy}
                                  onClick={() => handleOverrideRecord(r, opt.value)}
                                  title={opt.label}
                                >
                                  {isBusy && isActive ? '...' : opt.label}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                        <td>
                          {r.is_flagged ? (
                            <Badge variant="warning">{r.flag_reason || 'Şüpheli'}</Badge>
                          ) : (
                            <span className="ok-text">✓</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="info-section">
          <h2 className="section-title">Katılmayan Öğrenciler</h2>
          {enrolledStudents.length === 0 ? (
            <p className="empty-text">Kayıtlı öğrenci yok</p>
          ) : (
            <div className="absent-list">
              {studentsWithoutRecord.map(s => {
                  const key = `new-${s.id}`;
                  const isBusy = overriding.has(key);
                  return (
                    <div key={s.id} className="absent-item">
                      <div className="student-avatar-small">
                        {(s.name || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="absent-info">
                        <div className="absent-name">{s.name}</div>
                        <div className="absent-detail">{s.student_number || s.email}</div>
                      </div>
                      <div className="status-btns absent-btns">
                        {STATUS_OPTIONS.filter(o => o.value !== 'absent').map(opt => (
                          <button
                            key={opt.value}
                            className="status-override-btn"
                            style={{ color: opt.color, borderColor: opt.color + '66' }}
                            disabled={isBusy || !session.id}
                            onClick={() => handleSetStatus(s.id, opt.value)}
                            title={`${opt.label} olarak işaretle`}
                          >
                            {isBusy ? '...' : opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              {studentsWithoutRecord.length === 0 && (
                <p className="empty-text">Tüm öğrenciler katıldı!</p>
              )}
            </div>
          )}
        </div>
      </div>

      {showCancelModal && (
        <div className="modal-overlay" onClick={() => setShowCancelModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Dersi İptal Et</h3>
            <p className="modal-text">Bu ders iptal edilecek ve öğrencilere bildirim gönderilecek.</p>
            <div className="form-group">
              <label className="form-label">İptal Nedeni</label>
              <select className="form-select" value={cancelReason} onChange={e => setCancelReason(e.target.value)}>
                <option value="">Seçiniz</option>
                <option value="Öğretmen müsait değil">Öğretmen müsait değil</option>
                <option value="Tatil">Tatil</option>
                <option value="Kampüs kapalı">Kampüs kapalı</option>
                <option value="Diğer">Diğer</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="modal-btn secondary" onClick={() => setShowCancelModal(false)}>Vazgeç</button>
              <button className="modal-btn danger" onClick={handleCancelClass}>İptal Et</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
