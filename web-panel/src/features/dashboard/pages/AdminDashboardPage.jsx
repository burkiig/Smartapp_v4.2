import React, { useState, useEffect, useCallback } from 'react';
import {
  MdPeople, MdPerson, MdSchool, MdPlayCircle, MdFlag,
  MdCheckCircle, MdWarning, MdAccessTime,
} from 'react-icons/md';
import { Sidebar } from '../../../shared/components/layout/Sidebar';
import { SkeletonStatCard, SkeletonTable } from '../../../shared/components/Skeleton';
import apiClient from '../../../shared/services/apiClient';
import { AuditLogPage } from '../../audit/AuditLogPage';
import { ExcusesPage } from '../../attendance/pages/ExcusesPage';
import './AdminDashboardPage.css';

const ADMIN_MENU_ITEMS = [
  { id: 'overview',   label: 'Genel Bakış'          },
  { id: 'users',      label: 'Kullanıcılar'         },
  { id: 'courses',    label: 'Dersler'              },
  { id: 'rooms',      label: 'Fakülteler'            },
  { id: 'reports',    label: 'Yoklama Raporları'    },
  { id: 'excuses',    label: 'Mazeretler'           },
  { id: 'audit-logs', label: 'Sistem Kayıtları'    },
  { id: 'logout',     label: 'Çıkış'               },
];

const roleTR = { admin: 'Admin', instructor: 'Öğretmen', student: 'Öğrenci' };

// ── AddUserModal ───────────────────────────────────────────────────────────────

function AddUserModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({
    username: '', email: '', password: '', name: '',
    role: 'student', department: '', student_number: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await apiClient.post('/users', form);
      onSuccess(); onClose();
    } catch (err) {
      setError(err.message || 'Kullanici olusturulamadi');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Yeni Kullanici</h2>
          <button className="modal-close" onClick={onClose} aria-label="Kapat">✕</button>
        </div>
        {error && <div className="modal-error">{error}</div>}
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <div className="form-group">
              <label>Kullanici Adi *</label>
              <input value={form.username} onChange={e => set('username', e.target.value)} required placeholder="username" />
            </div>
            <div className="form-group">
              <label>E-posta *</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} required placeholder="email@example.com" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Sifre *</label>
              <input type="password" value={form.password} onChange={e => set('password', e.target.value)} required placeholder="Sifre" />
            </div>
            <div className="form-group">
              <label>Ad Soyad *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} required placeholder="Ad Soyad" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Rol *</label>
              <select value={form.role} onChange={e => set('role', e.target.value)}>
                <option value="student">Öğrenci</option>
                <option value="instructor">Öğretmen</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="form-group">
              <label>Bölüm</label>
              <input value={form.department} onChange={e => set('department', e.target.value)} placeholder="Bilgisayar Mühendisliği" />
            </div>
          </div>
          {form.role === 'student' && (
            <div className="form-group">
              <label>Öğrenci Numarası</label>
              <input value={form.student_number} onChange={e => set('student_number', e.target.value)} placeholder="2021001" />
            </div>
          )}
          <div className="modal-buttons">
            <button type="button" className="btn-cancel" onClick={onClose}>İptal</button>
            <button type="submit" className="btn-save" disabled={loading}>{loading ? 'Kaydediliyor...' : 'Kaydet'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── EditUserModal ──────────────────────────────────────────────────────────────

function EditUserModal({ userData, onClose, onSuccess }) {
  const [form, setForm] = useState({
    name: userData.name || '',
    username: userData.username || '',
    email: userData.email || '',
    password: '',
    role: userData.role || 'student',
    department: userData.department || '',
    student_number: userData.student_number || '',
    is_active: userData.is_active !== false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [faceStatus, setFaceStatus] = useState(null);
  const [faceFile, setFaceFile] = useState(null);
  const [facePreview, setFacePreview] = useState('');
  const [faceLoading, setFaceLoading] = useState(false);
  const [faceMsg, setFaceMsg] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    apiClient.get(`/face/status/${userData.id}`)
      .then(r => setFaceStatus(r.is_enrolled))
      .catch(() => setFaceStatus(false));
  }, [userData.id]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFaceFile(file);
    setFaceMsg('');
    const reader = new FileReader();
    reader.onload = ev => setFacePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleFaceEnroll = () => {
    if (!faceFile) return;
    setFaceLoading(true); setFaceMsg('');
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        await apiClient.post('/face/enroll/student', {
          student_id: userData.id,
          image_base64: ev.target.result,
        });
        setFaceStatus(true);
        setFaceMsg('Yuz kaydi guncellendi.');
        setFaceFile(null); setFacePreview('');
      } catch (err) {
        setFaceMsg('Hata: ' + (err.message || 'Yuz kaydi yapilamadi'));
      } finally { setFaceLoading(false); }
    };
    reader.readAsDataURL(faceFile);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password;
      await apiClient.patch(`/users/${userData.id}`, payload);
      onSuccess(); onClose();
    } catch (err) {
      setError(err.message || 'Guncellenemedi');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content wide" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Kullanici Duzenle</h2>
          <button className="modal-close" onClick={onClose} aria-label="Kapat">✕</button>
        </div>
        {error && <div className="modal-error">{error}</div>}
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-section-title">Temel Bilgiler</div>
          <div className="form-row">
            <div className="form-group">
              <label>Ad Soyad</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Kullanici Adi</label>
              <input value={form.username} onChange={e => set('username', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>E-posta</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Yeni Sifre (bos = degistirme)</label>
              <input type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Degistirmek istemiyorsaniz bos birakin" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Rol</label>
              <select value={form.role} onChange={e => set('role', e.target.value)}>
                <option value="student">Ogrenci</option>
                <option value="instructor">Ogretmen</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="form-group">
              <label>Bolum</label>
              <input value={form.department} onChange={e => set('department', e.target.value)} />
            </div>
          </div>
          {form.role === 'student' && (
            <div className="form-group">
              <label>Ogrenci Numarasi</label>
              <input value={form.student_number} onChange={e => set('student_number', e.target.value)} />
            </div>
          )}
          <div className="form-group">
            <label className="checkbox-label">
              <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
              Hesap Aktif
            </label>
          </div>

          <div className="form-section-title">Yuz Kaydi</div>
          <div className="face-status-row">
            <span>Mevcut Durum:</span>
            {faceStatus === null  && <span className="face-badge loading">Yukleniyor...</span>}
            {faceStatus === true  && <span className="face-badge enrolled">Kayitli</span>}
            {faceStatus === false && <span className="face-badge not-enrolled">Kayit Yok</span>}
          </div>
          <div className="form-group" style={{ marginTop: '10px' }}>
            <label>Yeni Yuz Fotografı Yukle (JPG/PNG)</label>
            <input type="file" accept="image/*" onChange={handleFileChange} />
          </div>
          {facePreview && (
            <div className="face-upload-preview">
              <img src={facePreview} alt="Onizleme" className="face-preview-img" />
              <button type="button" className="btn-save" onClick={handleFaceEnroll} disabled={faceLoading}>
                {faceLoading ? 'Kaydediliyor...' : 'Yuzu Guncelle'}
              </button>
            </div>
          )}
          {faceMsg && (
            <div className={faceMsg.startsWith('Hata') ? 'modal-error' : 'modal-success'}>{faceMsg}</div>
          )}

          <div className="modal-buttons">
            <button type="button" className="btn-cancel" onClick={onClose}>Iptal</button>
            <button type="submit" className="btn-save" disabled={loading}>{loading ? 'Kaydediliyor...' : 'Kaydet'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── ScheduleInput ──────────────────────────────────────────────────────────────

const DAYS_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DAYS_TR = ['Pzt', 'Sal', 'Car', 'Per', 'Cum'];

function ScheduleInput({ value, onChange }) {
  const getSlots = () => {
    if (!value || typeof value !== 'object') return [];
    if (Array.isArray(value.slots)) return value.slots;
    // Migrate old format: { days: [...], start_time, end_time }
    if (Array.isArray(value.days) && value.days.length > 0) {
      return value.days.map(day => ({
        day,
        start_time: value.start_time || '09:00',
        end_time: value.end_time || '10:00',
      }));
    }
    return [];
  };

  const slots = getSlots();

  const addSlot = () => {
    const usedDays = slots.map(s => s.day);
    const nextDay = DAYS_EN.find(d => !usedDays.includes(d)) || DAYS_EN[0];
    onChange({ slots: [...slots, { day: nextDay, start_time: '09:00', end_time: '10:00' }] });
  };

  const updateSlot = (idx, field, val) => {
    const updated = slots.map((s, i) => i === idx ? { ...s, [field]: val } : s);
    onChange({ slots: updated });
  };

  const removeSlot = (idx) => {
    onChange({ slots: slots.filter((_, i) => i !== idx) });
  };

  return (
    <div className="schedule-input-new">
      {slots.map((slot, idx) => (
        <div key={idx} className="schedule-slot-row">
          <select
            value={slot.day}
            onChange={e => updateSlot(idx, 'day', e.target.value)}
            className="slot-day-select"
          >
            {DAYS_EN.map((d, i) => (
              <option key={d} value={d}>{DAYS_TR[i]}</option>
            ))}
          </select>
          <input
            type="time"
            value={slot.start_time}
            onChange={e => updateSlot(idx, 'start_time', e.target.value)}
            className="slot-time-input"
          />
          <span className="slot-sep">—</span>
          <input
            type="time"
            value={slot.end_time}
            onChange={e => updateSlot(idx, 'end_time', e.target.value)}
            className="slot-time-input"
          />
          <button type="button" className="btn-remove-slot" onClick={() => removeSlot(idx)}>
            Sil
          </button>
        </div>
      ))}
      <button type="button" className="btn-add-slot" onClick={addSlot}>
        + Gun Ekle
      </button>
    </div>
  );
}

// ── AddCourseModal ─────────────────────────────────────────────────────────────

function AddCourseModal({ instructors, onClose, onSuccess }) {
  const [form, setForm] = useState({ code: '', name: '', instructor_id: '', schedule: { days: [], start_time: '09:00', end_time: '10:00' }, default_duration_minutes: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await apiClient.post('/courses', {
        ...form,
        instructor_id: form.instructor_id ? Number(form.instructor_id) : null,
        default_duration_minutes: form.default_duration_minutes ? Number(form.default_duration_minutes) : null,
      });
      onSuccess(); onClose();
    } catch (err) {
      setError(err.message || 'Ders olusturulamadi');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Yeni Ders</h2>
          <button className="modal-close" onClick={onClose} aria-label="Kapat">✕</button>
        </div>
        {error && <div className="modal-error">{error}</div>}
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <div className="form-group">
              <label>Ders Kodu *</label>
              <input value={form.code} onChange={e => set('code', e.target.value)} required placeholder="CS101" />
            </div>
            <div className="form-group">
              <label>Ders Adi *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} required placeholder="Veri Yapilari" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Ogretmen</label>
              <select value={form.instructor_id} onChange={e => set('instructor_id', e.target.value)}>
                <option value="">Seciniz</option>
                {instructors.map(i => (
                  <option key={i.id} value={i.id}>{i.name}{i.department ? ` (${i.department})` : ''}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <label>Program</label>
              <ScheduleInput value={form.schedule} onChange={v => set('schedule', v)} />
            </div>
          </div>
          <div className="form-group">
            <label>Varsayılan Oturum Süresi (dakika) — Şablon</label>
            <input
              type="number"
              min="10"
              max="360"
              placeholder="Örn: 90"
              value={form.default_duration_minutes}
              onChange={e => set('default_duration_minutes', e.target.value)}
            />
          </div>
          <div className="modal-buttons">
            <button type="button" className="btn-cancel" onClick={onClose}>Iptal</button>
            <button type="submit" className="btn-save" disabled={loading}>{loading ? 'Kaydediliyor...' : 'Kaydet'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── EditCourseModal ────────────────────────────────────────────────────────────

function EditCourseModal({ course, instructors, onClose, onSuccess }) {
  const defaultSchedule = course.schedule && typeof course.schedule === 'object'
    ? course.schedule
    : { days: [], start_time: '09:00', end_time: '10:00' };
  const [form, setForm] = useState({
    code: course.code || '',
    name: course.name || '',
    instructor_id: course.instructor_id || '',
    schedule: defaultSchedule,
    default_duration_minutes: course.default_duration_minutes || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await apiClient.patch(`/courses/${course.id}`, {
        ...form,
        instructor_id: form.instructor_id ? Number(form.instructor_id) : null,
        default_duration_minutes: form.default_duration_minutes ? Number(form.default_duration_minutes) : null,
      });
      onSuccess(); onClose();
    } catch (err) {
      setError(err.message || 'Guncellenemedi');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Ders Duzenle — {course.code}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Kapat">✕</button>
        </div>
        {error && <div className="modal-error">{error}</div>}
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <div className="form-group">
              <label>Ders Kodu</label>
              <input value={form.code} onChange={e => set('code', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Ders Adi</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Ogretmen Ata</label>
              <select value={form.instructor_id} onChange={e => set('instructor_id', e.target.value)}>
                <option value="">Seciniz</option>
                {instructors.map(i => (
                  <option key={i.id} value={i.id}>{i.name}{i.department ? ` (${i.department})` : ''}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <label>Program</label>
              <ScheduleInput value={form.schedule} onChange={v => set('schedule', v)} />
            </div>
          </div>
          <div className="form-group">
            <label>Varsayılan Oturum Süresi (dakika) — Şablon</label>
            <input
              type="number"
              min="10"
              max="360"
              placeholder="Örn: 90"
              value={form.default_duration_minutes}
              onChange={e => set('default_duration_minutes', e.target.value)}
            />
          </div>
          <div className="modal-buttons">
            <button type="button" className="btn-cancel" onClick={onClose}>Iptal</button>
            <button type="submit" className="btn-save" disabled={loading}>{loading ? 'Kaydediliyor...' : 'Kaydet'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── CourseStudentsModal ────────────────────────────────────────────────────────

function CourseStudentsModal({ course, onClose }) {
  const [enrolled, setEnrolled] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [e, s] = await Promise.all([
        apiClient.get(`/courses/${course.id}/students`),
        apiClient.get('/users?role=student'),
      ]);
      setEnrolled(e || []);
      setAllStudents(Array.isArray(s) ? s : (s?.users || []));
    } catch (err) {
      setError(err.message || 'Yukleme hatasi');
    } finally { setLoading(false); }
  }, [course.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAdd = async () => {
    if (!selectedStudent) return;
    setAdding(true); setError('');
    try {
      await apiClient.post(`/courses/${course.id}/enroll`, { student_id: Number(selectedStudent) });
      setSelectedStudent('');
      await loadData();
    } catch (err) {
      setError(err.message || 'Eklenemedi');
    } finally { setAdding(false); }
  };

  const handleRemove = async (studentId) => {
    if (!window.confirm('Bu ogrenciyi dersten cikarmak istediginizden emin misiniz?')) return;
    try {
      await apiClient.delete(`/courses/${course.id}/enroll/${studentId}`);
      await loadData();
    } catch (err) {
      setError(err.message || 'Cikarilmadi');
    }
  };

  const enrolledIds = new Set(enrolled.map(s => s.id));
  const available = allStudents.filter(s => !enrolledIds.has(s.id));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content wide" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{course.code}: {course.name} — Kayitli Ogrenciler</h2>
          <button className="modal-close" onClick={onClose} aria-label="Kapat">✕</button>
        </div>
        {error && <div className="modal-error">{error}</div>}

        <div className="enroll-add-row">
          <select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)} className="enroll-select">
            <option value="">Ogrenci sec...</option>
            {available.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}{s.student_number ? ` (${s.student_number})` : ''}{s.department ? ` — ${s.department}` : ''}
              </option>
            ))}
          </select>
          <button className="btn-save" onClick={handleAdd} disabled={!selectedStudent || adding}>
            {adding ? 'Ekleniyor...' : 'Ogrenci Ekle'}
          </button>
        </div>

        {loading ? (
          <div className="loading-inline">Yukleniyor...</div>
        ) : (
          <div className="enrolled-list">
            {enrolled.length === 0
              ? <div className="empty-text">Bu derse kayitli ogrenci yok</div>
              : enrolled.map(s => (
                <div key={s.id} className="enrolled-item">
                  <div className="enrolled-info">
                    <span className="enrolled-name">{s.name}</span>
                    {s.student_number && <span className="enrolled-num">{s.student_number}</span>}
                    {s.department && <span className="enrolled-dept">{s.department}</span>}
                  </div>
                  <button className="btn-remove" onClick={() => handleRemove(s.id)}>Cikar</button>
                </div>
              ))
            }
          </div>
        )}
        <div style={{ marginTop: '16px', textAlign: 'right' }}>
          <button className="btn-cancel" onClick={onClose}>Kapat</button>
        </div>
      </div>
    </div>
  );
}

// ── AddRoomModal ───────────────────────────────────────────────────────────────

function AddRoomModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({
    name: '', capacity: '', type: 'Fakulte Binasi', equipment: '',
    latitude: '', longitude: '', geofence_radius: '100',
  });
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleGetLocation = () => {
    if (!navigator.geolocation) { setError('Tarayici konum servisini desteklemiyor.'); return; }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setForm(f => ({ ...f, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) }));
        setGpsLoading(false);
      },
      err => { setError('Konum alinamadi: ' + err.message); setGpsLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await apiClient.post('/rooms', {
        name: form.name,
        capacity: form.capacity ? Number(form.capacity) : null,
        type: form.type, equipment: form.equipment,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        geofence_radius: Number(form.geofence_radius),
      });
      onSuccess(); onClose();
    } catch (err) {
      setError(err.message || 'Fakulte olusturulamadi');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Yeni Fakulte / Bina</h2>
          <button className="modal-close" onClick={onClose} aria-label="Kapat">✕</button>
        </div>
        {error && <div className="modal-error">{error}</div>}
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <div className="form-group">
              <label>Ad *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} required placeholder="Muhendislik Fakultesi" />
            </div>
            <div className="form-group">
              <label>Kapasite</label>
              <input type="number" value={form.capacity} onChange={e => set('capacity', e.target.value)} placeholder="500" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Tur</label>
              <select value={form.type} onChange={e => set('type', e.target.value)}>
                <option>Fakulte Binasi</option>
                <option>Enstitu</option>
                <option>Meslek Yuksekokulu</option>
                <option>Derslik Bloku</option>
                <option>Laboratuvar Binasi</option>
              </select>
            </div>
            <div className="form-group">
              <label>Aciklama</label>
              <input value={form.equipment} onChange={e => set('equipment', e.target.value)} placeholder="Ek bilgi..." />
            </div>
          </div>
          <div className="form-group">
            <button type="button" className="btn-gps" onClick={handleGetLocation} disabled={gpsLoading}>
              {gpsLoading ? 'Konum aliniyor...' : 'GPS Konumumu Otomatik Doldur'}
            </button>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Enlem</label>
              <input type="number" step="any" value={form.latitude} onChange={e => set('latitude', e.target.value)} placeholder="41.015137" />
            </div>
            <div className="form-group">
              <label>Boylam</label>
              <input type="number" step="any" value={form.longitude} onChange={e => set('longitude', e.target.value)} placeholder="28.979530" />
            </div>
          </div>
          <div className="form-group">
            <label>Geofence Yaricapi (metre)</label>
            <input type="number" value={form.geofence_radius} onChange={e => set('geofence_radius', e.target.value)} placeholder="100" />
          </div>
          <div className="modal-buttons">
            <button type="button" className="btn-cancel" onClick={onClose}>Iptal</button>
            <button type="submit" className="btn-save" disabled={loading}>{loading ? 'Kaydediliyor...' : 'Kaydet'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── EditRoomModal ──────────────────────────────────────────────────────────────

function EditRoomModal({ room, onClose, onSuccess }) {
  const [form, setForm] = useState({
    name: room.name || '',
    capacity: room.capacity ?? '',
    type: room.type || 'Fakulte Binasi',
    equipment: room.equipment || '',
    latitude: room.latitude ?? '',
    longitude: room.longitude ?? '',
    geofence_radius: room.geofence_radius ?? '100',
  });
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleGetLocation = () => {
    if (!navigator.geolocation) { setError('Tarayici konum servisini desteklemiyor.'); return; }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setForm(f => ({ ...f, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) }));
        setGpsLoading(false);
      },
      err => { setError('Konum alinamadi: ' + err.message); setGpsLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await apiClient.patch(`/rooms/${room.id}`, {
        name: form.name,
        capacity: form.capacity ? Number(form.capacity) : null,
        type: form.type, equipment: form.equipment,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        geofence_radius: Number(form.geofence_radius),
      });
      onSuccess(); onClose();
    } catch (err) {
      setError(err.message || 'Guncellenemedi');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Fakulte Duzenle — {room.name}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Kapat">✕</button>
        </div>
        {error && <div className="modal-error">{error}</div>}
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <div className="form-group">
              <label>Ad</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Kapasite</label>
              <input type="number" value={form.capacity} onChange={e => set('capacity', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Tur</label>
              <select value={form.type} onChange={e => set('type', e.target.value)}>
                <option>Fakulte Binasi</option>
                <option>Enstitu</option>
                <option>Meslek Yuksekokulu</option>
                <option>Derslik Bloku</option>
                <option>Laboratuvar Binasi</option>
              </select>
            </div>
            <div className="form-group">
              <label>Aciklama</label>
              <input value={form.equipment} onChange={e => set('equipment', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <button type="button" className="btn-gps" onClick={handleGetLocation} disabled={gpsLoading}>
              {gpsLoading ? 'Konum aliniyor...' : 'GPS Konumumu Otomatik Doldur'}
            </button>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Enlem</label>
              <input type="number" step="any" value={form.latitude} onChange={e => set('latitude', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Boylam</label>
              <input type="number" step="any" value={form.longitude} onChange={e => set('longitude', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>Geofence Yaricapi (metre)</label>
            <input type="number" value={form.geofence_radius} onChange={e => set('geofence_radius', e.target.value)} />
          </div>
          <div className="modal-buttons">
            <button type="button" className="btn-cancel" onClick={onClose}>Iptal</button>
            <button type="submit" className="btn-save" disabled={loading}>{loading ? 'Kaydediliyor...' : 'Kaydet'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export const AdminDashboardPage = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userRoleFilter, setUserRoleFilter] = useState('all');

  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [reportCourseFilter, setReportCourseFilter] = useState('');

  const [showAddUser,    setShowAddUser]    = useState(false);
  const [editingUser,    setEditingUser]    = useState(null);
  const [showAddCourse,  setShowAddCourse]  = useState(false);
  const [editingCourse,  setEditingCourse]  = useState(null);
  const [courseStudents, setCourseStudents] = useState(null);
  const [showAddRoom,    setShowAddRoom]    = useState(false);
  const [editingRoom,    setEditingRoom]    = useState(null);

  const handleTabChange = (id) => {
    if (id === 'logout') { onLogout(); return; }
    setActiveTab(id);
  };

  const instructors = users.filter(u => u.role === 'instructor');

  const fetchData = useCallback(async (tab) => {
    setLoading(true);
    try {
      switch (tab) {
        case 'overview': {
          const [s, a] = await Promise.allSettled([
            apiClient.get('/dashboard/stats'),
            apiClient.get('/dashboard/recent-activity'),
          ]);
          if (s.status === 'fulfilled') setStats(s.value);
          if (a.status === 'fulfilled') setRecentActivity(a.value?.activities || []);
          break;
        }
        case 'users': {
          const data = await apiClient.get('/users/');
          setUsers(Array.isArray(data) ? data : (data?.users || []));
          break;
        }
        case 'courses': {
          const [c, u] = await Promise.allSettled([
            apiClient.get('/courses/'),
            apiClient.get('/users?role=instructor'),
          ]);
          if (c.status === 'fulfilled') setCourses(c.value || []);
          if (u.status === 'fulfilled') {
            const raw = u.value;
            const all = Array.isArray(raw) ? raw : (raw?.users || []);
            setUsers(prev => {
              const ids = new Set(all.map(x => x.id));
              return [...prev.filter(p => !ids.has(p.id)), ...all];
            });
          }
          break;
        }
        case 'rooms': {
          const data = await apiClient.get('/rooms/');
          setRooms(data || []);
          break;
        }
        case 'reports': {
          const [rec, crs] = await Promise.allSettled([
            apiClient.get('/attendance/records', { params: { page: 1, page_size: 200 } }),
            apiClient.get('/courses/'),
          ]);
          if (rec.status === 'fulfilled') {
            const v = rec.value;
            setAttendanceRecords(Array.isArray(v) ? v : (v?.records || []));
          }
          if (crs.status === 'fulfilled') setCourses(crs.value || []);
          break;
        }
        default: break;
      }
    } catch (err) {
      console.error('fetchData error:', err);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(activeTab); }, [activeTab, fetchData]);

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Bu kullaniciyi silmek istediginizden emin misiniz?')) return;
    try {
      await apiClient.delete(`/users/${userId}`);
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch (err) { alert(err.message || 'Silinemedi'); }
  };

  const handleDeleteCourse = async (courseId) => {
    if (!window.confirm('Bu dersi silmek istediginizden emin misiniz?')) return;
    try {
      await apiClient.delete(`/courses/${courseId}`);
      setCourses(prev => prev.filter(c => c.id !== courseId));
    } catch (err) { alert(err.message || 'Silinemedi'); }
  };

  const handleDeleteRoom = async (roomId) => {
    if (!window.confirm('Bu fakulteyi silmek istediginizden emin misiniz?')) return;
    try {
      await apiClient.delete(`/rooms/${roomId}`);
      setRooms(prev => prev.filter(r => r.id !== roomId));
    } catch (err) { alert(err.message || 'Silinemedi'); }
  };

  // ── Overview ──────────────────────────────────────────────────────────────────
  const renderOverview = () => (
    <div className="admin-overview">
      <div className="page-header">
        <div>
          <h1>Sistem Genel Bakis</h1>
          <p className="page-subtitle">Yoklama sisteminizi yonetin</p>
        </div>
      </div>
      {loading ? (
        <div>
          <div className="stats-grid">
            {[1,2,3,4,5].map(i => <SkeletonStatCard key={i} />)}
          </div>
          <div className="content-grid" style={{ marginTop: 24 }}>
            <div className="card"><SkeletonTable rows={5} cols={3} /></div>
            <div className="card"><SkeletonTable rows={5} cols={3} /></div>
          </div>
        </div>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-card blue">
              <div className="stat-icon-wrap"><MdPeople size={24} /></div>
              <div className="stat-num">{stats?.total_students ?? 0}</div>
              <div className="stat-lbl">Öğrenci</div>
            </div>
            <div className="stat-card purple">
              <div className="stat-icon-wrap"><MdPerson size={24} /></div>
              <div className="stat-num">{stats?.total_instructors ?? 0}</div>
              <div className="stat-lbl">Öğretmen</div>
            </div>
            <div className="stat-card green">
              <div className="stat-icon-wrap"><MdSchool size={24} /></div>
              <div className="stat-num">{stats?.total_courses ?? 0}</div>
              <div className="stat-lbl">Ders</div>
            </div>
            <div className="stat-card orange">
              <div className="stat-icon-wrap"><MdPlayCircle size={24} /></div>
              <div className="stat-num">{stats?.active_sessions ?? 0}</div>
              <div className="stat-lbl">Aktif Oturum</div>
            </div>
            <div className="stat-card red">
              <div className="stat-icon-wrap"><MdFlag size={24} /></div>
              <div className="stat-num">{stats?.flagged_records ?? 0}</div>
              <div className="stat-lbl">Şüpheli Kayıt</div>
            </div>
          </div>
          <div className="content-grid">
            <div className="card">
              <div className="card-header"><h2>Son Aktiviteler</h2></div>
              <div className="activity-list">
                {recentActivity.length === 0
                  ? <p className="empty-text">Henuz aktivite yok</p>
                  : recentActivity.map((a, i) => (
                    <div key={i} className="activity-item">
                      <span className={`activity-dot ${a.status === 'present' ? 'present' : a.status === 'pending_review' ? 'warning' : 'absent'}`} />
                      <div className="activity-content">
                        <div className="activity-action">
                          Öğrenci #{a.student_id} — Ders #{a.course_id}
                          {a.is_flagged && <span className="flag-badge"><MdFlag size={12} style={{marginRight:3}}/>Şüpheli</span>}
                        </div>
                        <div className="activity-meta">
                          <MdAccessTime size={12} style={{marginRight:4}}/>
                          {a.timestamp ? new Date(a.timestamp).toLocaleString('tr-TR') : '—'}
                        </div>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
            <div className="card">
              <div className="card-header"><h2>Hizli Erisim</h2></div>
              <div className="quick-actions-list">
                <button className="quick-action-item" onClick={() => setActiveTab('users')}>Kullanici Yonetimi</button>
                <button className="quick-action-item" onClick={() => setActiveTab('courses')}>Ders Yonetimi</button>
                <button className="quick-action-item" onClick={() => setActiveTab('rooms')}>Fakulte Yonetimi</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  // ── Users ─────────────────────────────────────────────────────────────────────
  const renderUsers = () => {
    const filtered = userRoleFilter === 'all' ? users : users.filter(u => u.role === userRoleFilter);
    const counts = {
      all:        users.length,
      student:    users.filter(u => u.role === 'student').length,
      instructor: users.filter(u => u.role === 'instructor').length,
      admin:      users.filter(u => u.role === 'admin').length,
    };
    return (
      <div className="admin-users">
        <div className="page-header">
          <h1>Kullanici Yonetimi</h1>
          <button className="btn-primary" onClick={() => setShowAddUser(true)}>+ Kullanici Ekle</button>
        </div>
        <div className="role-tabs">
          {[
            { key: 'all',        label: 'Tumu' },
            { key: 'student',    label: 'Ogrenciler' },
            { key: 'instructor', label: 'Ogretmenler' },
            { key: 'admin',      label: 'Adminler' },
          ].map(t => (
            <button
              key={t.key}
              className={`role-tab${userRoleFilter === t.key ? ' active' : ''}`}
              onClick={() => setUserRoleFilter(t.key)}
            >
              {t.label} ({counts[t.key]})
            </button>
          ))}
        </div>
        {loading ? <div className="loading-inline">Yukleniyor...</div> : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ad Soyad</th>
                  <th>Kullanici Adi</th>
                  <th>E-posta</th>
                  <th>Rol</th>
                  <th>Bolum</th>
                  <th>Ogrenci No</th>
                  <th>Durum</th>
                  <th>Islemler</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0
                  ? <tr><td colSpan="8" className="empty-cell">Kullanici bulunamadi</td></tr>
                  : filtered.map(u => (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td><code>{u.username}</code></td>
                      <td>{u.email}</td>
                      <td><span className={`role-badge ${u.role}`}>{roleTR[u.role] || u.role}</span></td>
                      <td>{u.department || '—'}</td>
                      <td>{u.student_number || '—'}</td>
                      <td><span className={`status-badge ${u.is_active ? 'active' : 'inactive'}`}>{u.is_active ? 'Aktif' : 'Pasif'}</span></td>
                      <td className="actions-cell">
                        <button className="btn-action edit"   onClick={() => setEditingUser(u)}>Duzenle</button>
                        <button className="btn-action delete" onClick={() => handleDeleteUser(u.id)}>Sil</button>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  // ── Courses ───────────────────────────────────────────────────────────────────
  const renderCourses = () => (
    <div className="admin-courses">
      <div className="page-header">
        <h1>Ders Yonetimi</h1>
        <button className="btn-primary" onClick={() => setShowAddCourse(true)}>+ Ders Ekle</button>
      </div>
      {loading ? <div className="loading-inline">Yukleniyor...</div> : (
        <div className="courses-grid">
          {courses.length === 0
            ? <p className="empty-text">Henuz ders yok</p>
            : courses.map(c => {
              const instructor = instructors.find(i => i.id === c.instructor_id);
              return (
                <div key={c.id} className="course-card">
                  <div className="course-header">
                    <h3>{c.code}</h3>
                    <span className="student-count">{c.enrolled_count ?? 0} ogrenci</span>
                  </div>
                  <div className="course-body">
                    <p className="course-name">{c.name}</p>
                    <p className="course-meta">
                      Ogretmen: {instructor
                        ? <strong>{instructor.name}{instructor.department ? ` — ${instructor.department}` : ''}</strong>
                        : <em style={{ color: '#94a3b8' }}>Atanmamis</em>
                      }
                    </p>
                    {c.schedule && typeof c.schedule === 'object' && c.schedule.days?.length > 0 && (
                      <p className="course-meta">Program: {c.schedule.days.map(d => d.slice(0,3)).join(', ')} {c.schedule.start_time}–{c.schedule.end_time}</p>
                    )}
                  </div>
                  <div className="course-actions">
                    <button className="btn-action edit"      onClick={() => setEditingCourse(c)}>Duzenle</button>
                    <button className="btn-action secondary" onClick={() => setCourseStudents(c)}>Ogrenciler</button>
                    <button className="btn-action delete"    onClick={() => handleDeleteCourse(c.id)}>Sil</button>
                  </div>
                </div>
              );
            })
          }
        </div>
      )}
    </div>
  );

  // ── Rooms ─────────────────────────────────────────────────────────────────────
  const renderRooms = () => (
    <div className="admin-rooms">
      <div className="page-header">
        <h1>Fakulte / Bina Yonetimi</h1>
        <button className="btn-primary" onClick={() => setShowAddRoom(true)}>+ Fakulte Ekle</button>
      </div>
      {loading ? <div className="loading-inline">Yukleniyor...</div> : (
        <div className="rooms-grid">
          {rooms.length === 0
            ? <p className="empty-text">Henuz fakulte / bina yok</p>
            : rooms.map(r => (
              <div key={r.id} className="room-card">
                <div className="room-header">
                  <h3>{r.name}</h3>
                  <div className="status-indicator" />
                </div>
                <div className="room-body">
                  {r.type     && <p>Tur: {r.type}</p>}
                  {r.capacity && <p>Kapasite: {r.capacity}</p>}
                  {r.equipment && <p>{r.equipment}</p>}
                  {r.latitude
                    ? <p>GPS: {Number(r.latitude).toFixed(6)}, {Number(r.longitude).toFixed(6)}</p>
                    : <p className="text-warning">GPS konumu tanimli degil</p>
                  }
                  <p>Geofence: {r.geofence_radius} m</p>
                </div>
                <div className="room-actions">
                  <button className="btn-action edit"   onClick={() => setEditingRoom(r)}>Duzenle</button>
                  <button className="btn-action delete" onClick={() => handleDeleteRoom(r.id)}>Sil</button>
                </div>
              </div>
            ))
          }
        </div>
      )}
    </div>
  );

  // ── Reports (read-only) ───────────────────────────────────────────────────────
  const renderReports = () => {
    const filtered = reportCourseFilter
      ? attendanceRecords.filter(r => String(r.course_id) === reportCourseFilter)
      : attendanceRecords;

    const statusTR = { present: 'Katildi', absent: 'Katilmadi', excused: 'Mazeret' };
    const statusCls = { present: 'active', absent: 'inactive', excused: 'excused' };

    return (
      <div className="admin-reports">
        <div className="page-header">
          <div>
            <h1>Yoklama Raporlari</h1>
            <p className="page-subtitle">Tum derslerin yoklama kayitlarini goruntuleyebilirsiniz (salt okunur)</p>
          </div>
        </div>
        <div className="report-filter-row">
          <select
            value={reportCourseFilter}
            onChange={e => setReportCourseFilter(e.target.value)}
            className="enroll-select"
            style={{ maxWidth: '320px' }}
          >
            <option value="">Tum Dersler</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
            ))}
          </select>
          <span className="report-count">{filtered.length} kayit</span>
        </div>
        {loading ? <div className="loading-inline">Yukleniyor...</div> : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ogrenci</th>
                  <th>Ogrenci No</th>
                  <th>Ders</th>
                  <th>Ogretmen</th>
                  <th>Tarih</th>
                  <th>Durum</th>
                  <th>Bayrak</th>
                  <th>Dogrulama</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0
                  ? <tr><td colSpan="8" className="empty-cell">Kayit bulunamadi</td></tr>
                  : filtered.map(r => {
                    const course = courses.find(c => c.id === r.course_id);
                    const instructor = instructors.find(i => i.id === course?.instructor_id);
                    const steps = r.verification_steps || {};
                    return (
                      <tr key={r.id}>
                        <td>{r.student_name || `Ogrenci #${r.student_id}`}</td>
                        <td>{r.student_number || '—'}</td>
                        <td>
                          <span className="course-code-badge">{r.course_code || `#${r.course_id}`}</span>
                          {r.course_name && <span style={{ marginLeft: 6, color: '#64748b', fontSize: '0.8rem' }}>{r.course_name}</span>}
                        </td>
                        <td>{instructor ? instructor.name : '—'}</td>
                        <td style={{ fontSize: '0.82rem', color: '#64748b' }}>
                          {r.marked_at ? new Date(r.marked_at).toLocaleString('tr-TR') : '—'}
                        </td>
                        <td>
                          <span className={`status-badge ${statusCls[r.status] || 'inactive'}`}>
                            {statusTR[r.status] || r.status}
                          </span>
                        </td>
                        <td>
                          {r.is_flagged
                            ? <span className="flag-badge">Bayrakli</span>
                            : <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>—</span>
                          }
                        </td>
                        <td style={{ fontSize: '0.78rem', color: '#64748b' }}>
                          {[
                            steps.qr_ok      !== false ? 'QR'   : null,
                            steps.face_ok    !== false ? 'Yuz'  : null,
                            steps.location_ok !== false ? 'GPS' : null,
                          ].filter(Boolean).join(' + ') || '—'}
                        </td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':    return renderOverview();
      case 'users':       return renderUsers();
      case 'courses':     return renderCourses();
      case 'rooms':       return renderRooms();
      case 'reports':     return renderReports();
      case 'excuses':     return <ExcusesPage />;
      case 'audit-logs':  return <AuditLogPage />;
      default:            return renderOverview();
    }
  };

  return (
    <div className="admin-dashboard-container">
      {showAddUser    && <AddUserModal onClose={() => setShowAddUser(false)} onSuccess={() => fetchData('users')} />}
      {editingUser    && <EditUserModal userData={editingUser} onClose={() => setEditingUser(null)} onSuccess={() => fetchData('users')} />}
      {showAddCourse  && <AddCourseModal instructors={instructors} onClose={() => setShowAddCourse(false)} onSuccess={() => fetchData('courses')} />}
      {editingCourse  && <EditCourseModal course={editingCourse} instructors={instructors} onClose={() => setEditingCourse(null)} onSuccess={() => fetchData('courses')} />}
      {courseStudents && <CourseStudentsModal course={courseStudents} onClose={() => setCourseStudents(null)} />}
      {showAddRoom    && <AddRoomModal onClose={() => setShowAddRoom(false)} onSuccess={() => fetchData('rooms')} />}
      {editingRoom    && <EditRoomModal room={editingRoom} onClose={() => setEditingRoom(null)} onSuccess={() => fetchData('rooms')} />}

      <Sidebar
        title="Attendance System"
        subtitle="Admin Panel"
        menuItems={ADMIN_MENU_ITEMS}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        user={user}
        onLogout={onLogout}
      />
      <main className="main-content">{renderContent()}</main>
    </div>
  );
};
