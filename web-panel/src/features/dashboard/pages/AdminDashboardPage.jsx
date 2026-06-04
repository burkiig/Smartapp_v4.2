import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MdPeople, MdPerson, MdSchool, MdPlayCircle, MdFlag,
  MdCheckCircle, MdWarning, MdAccessTime,
} from 'react-icons/md';
import { Sidebar } from '../../../shared/components/layout/Sidebar';
import { LanguageSwitcher } from '../../../shared/components/LanguageSwitcher/LanguageSwitcher';
import { SkeletonStatCard, SkeletonTable } from '../../../shared/components/Skeleton';
import apiClient from '../../../shared/services/apiClient';
import { getApiBaseUrl } from '../../../shared/services/apiBaseUrl';
import { AuditLogPage } from '../../audit/AuditLogPage';
import { ExcusesPage } from '../../attendance/pages/ExcusesPage';
import { DisputeReviewPage } from '../../disputes/DisputeReviewPage';
import './AdminDashboardPage.css';

// ── Leadership role helpers (admin user form) ────────────────────────────────

function buildUserPayload(form, { includePassword = true, forEdit = false } = {}) {
  const payload = {
    name: form.name?.trim(),
    role: form.role,
  };

  if (!forEdit) {
    payload.username = form.username?.trim();
    payload.email = form.email?.trim();
  } else {
    payload.email = form.email?.trim();
    if (form.password?.trim()) {
      payload.password = form.password.trim();
    }
  }

  if (includePassword && !forEdit) {
    payload.password = form.password;
  }

  if (form.role === 'student') {
    payload.department = form.department?.trim() || undefined;
    payload.student_number = form.student_number?.trim() || undefined;
    payload.scope_type = null;
    payload.scope_value = null;
  } else if (form.role === 'instructor' || form.role === 'admin') {
    payload.department = form.department?.trim() || undefined;
    payload.student_number = undefined;
    payload.scope_type = null;
    payload.scope_value = null;
  } else if (form.role === 'rector') {
    payload.scope_type = 'university';
    payload.scope_value = null;
    payload.department = undefined;
    payload.student_number = undefined;
  } else if (form.role === 'dean') {
    if (!form.scope_value) {
      throw new Error('Dekan rolü için bölüm seçimi zorunludur.');
    }
    payload.scope_type = 'department';
    payload.scope_value = form.scope_value;
    payload.department = undefined;
    payload.student_number = undefined;
  }

  if (forEdit && form.is_active !== undefined) {
    payload.is_active = form.is_active;
  }

  return payload;
}

function useDistinctDepartments(enabled) {
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    if (!enabled) return;
    apiClient.get('/admin/distinct-departments')
      .then((res) => setDepartments(res.departments || []))
      .catch(() => setDepartments([]));
  }, [enabled]);

  return departments;
}

// ── CsvImportModal ─────────────────────────────────────────────────────────────

function CsvImportModal({ onClose, onSuccess }) {
  const [file, setFile]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState('');
  const handleImport = async () => {
    if (!file) { setError('Lütfen bir CSV dosyası seçin.'); return; }
    setLoading(true); setError(''); setResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${getApiBaseUrl()}/api/v1/users/bulk-import`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        let detail = data.detail || data.message || 'İçe aktarma başarısız';
        if (Array.isArray(detail)) detail = detail.map(e => e.msg || JSON.stringify(e)).join(', ');
        throw new Error(detail);
      }
      setResult(data);
      if (data.created_count > 0) onSuccess();
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  const downloadTemplate = () => {
    const csv = 'username,email,password,name,role,department,student_number\njohn_doe,john@example.com,Sifre123!,John Doe,student,Bilgisayar Müh.,2021001\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'kullanici_sablonu.csv';
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>CSV ile Toplu Kullanıcı Ekle</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: '0 0 16px' }}>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
            CSV dosyasında şu sütunlar bulunmalıdır:<br />
            <code style={{ fontSize: 12, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>
              username, email, password, name, role, department*, student_number*
            </code>
            <br /><span style={{ fontSize: 11, color: '#94a3b8' }}>* isteğe bağlı</span>
          </p>
          <button
            type="button"
            className="btn-cancel"
            onClick={downloadTemplate}
            style={{ marginBottom: 16, fontSize: 13 }}
          >
            Şablon İndir (.csv)
          </button>
          <div className="form-group">
            <label>CSV Dosyası</label>
            <input
              type="file"
              accept=".csv"
              onChange={e => { setFile(e.target.files[0]); setResult(null); setError(''); }}
            />
          </div>
          {error && <div className="modal-error">{error}</div>}
          {result && (
            <div style={{ marginTop: 12, padding: 12, background: '#f0fdf4', borderRadius: 8, border: '1px solid #86efac' }}>
              <p style={{ fontWeight: 700, color: '#16a34a', marginBottom: 4 }}>
                {result.created_count} kullanıcı eklendi, {result.skipped_count} atlandı.
              </p>
              {result.skipped.length > 0 && (
                <ul style={{ fontSize: 12, color: '#dc2626', margin: 0, paddingLeft: 16 }}>
                  {result.skipped.map((s, i) => (
                    <li key={i}>Satır {s.row} {s.username ? `(${s.username})` : ''}: {s.reason}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="modal-buttons">
          <button type="button" className="btn-cancel" onClick={onClose}>Kapat</button>
          <button type="button" className="btn-save" onClick={handleImport} disabled={loading || !file}>
            {loading ? 'İçe Aktarılıyor...' : 'İçe Aktar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── AddUserModal ───────────────────────────────────────────────────────────────

function AddUserModal({ onClose, onSuccess }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    username: '', email: '', password: '', name: '',
    role: 'student', department: '', student_number: '', scope_value: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const departments = useDistinctDepartments(true);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleRoleChange = (role) => {
    setForm(f => ({
      ...f,
      role,
      scope_value: role === 'dean' ? f.scope_value : '',
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const payload = buildUserPayload(form);
      await apiClient.post('/users', payload);
      onSuccess(); onClose();
    } catch (err) {
      setError(err.message || t('modals.addUser.errorCreate'));
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('modals.addUser.title')}</h2>
          <button className="modal-close" onClick={onClose} aria-label={t('common.close')}>{t('modals.close')}</button>
        </div>
        {error && <div className="modal-error">{error}</div>}
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <div className="form-group">
              <label>{t('modals.addUser.usernameLabel')}</label>
              <input value={form.username} onChange={e => set('username', e.target.value)} required placeholder="username" />
            </div>
            <div className="form-group">
              <label>{t('modals.addUser.emailLabel')}</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} required placeholder="email@example.com" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>{t('modals.addUser.passwordLabel')}</label>
              <input type="password" value={form.password} onChange={e => set('password', e.target.value)} required />
            </div>
            <div className="form-group">
              <label>{t('modals.addUser.fullNameLabel')}</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>{t('modals.addUser.roleLabel')}</label>
              <select value={form.role} onChange={e => handleRoleChange(e.target.value)}>
                <option value="student">{t('modals.addUser.roleStudent')}</option>
                <option value="instructor">{t('modals.addUser.roleInstructor')}</option>
                <option value="admin">{t('modals.addUser.roleAdmin')}</option>
                <option value="dean">{t('modals.addUser.roleDean', 'Dekan')}</option>
                <option value="rector">{t('modals.addUser.roleRector', 'Rektör')}</option>
              </select>
            </div>
            {(form.role === 'student' || form.role === 'instructor' || form.role === 'admin') && (
              <div className="form-group">
                <label>{t('modals.addUser.departmentLabel')}</label>
                <input value={form.department} onChange={e => set('department', e.target.value)} placeholder={t('modals.addUser.departmentPlaceholder')} />
              </div>
            )}
            {form.role === 'dean' && (
              <div className="form-group">
                <label>{t('modals.addUser.scopeDepartment', 'Yetki Alanı (Bölüm)')}</label>
                <select
                  value={form.scope_value}
                  onChange={e => set('scope_value', e.target.value)}
                  required
                >
                  <option value="">{t('modals.addUser.selectDepartment', 'Bölüm seçin...')}</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
                {departments.length === 0 && (
                  <p className="form-hint">{t('modals.addUser.noDepartments', 'Henüz kayıtlı öğrenci bölümü yok. Önce öğrencilere bölüm atayın.')}</p>
                )}
              </div>
            )}
          </div>
          {form.role === 'rector' && (
            <p className="form-hint">{t('modals.addUser.rectorScopeHint', 'Rektör tüm kurum verilerini görür.')}</p>
          )}
          {form.role === 'student' && (
            <div className="form-group">
              <label>{t('modals.addUser.studentNoLabel')}</label>
              <input value={form.student_number} onChange={e => set('student_number', e.target.value)} placeholder="2021001" />
            </div>
          )}
          <div className="modal-buttons">
            <button type="button" className="btn-cancel" onClick={onClose}>{t('modals.addUser.cancelBtn')}</button>
            <button type="submit" className="btn-save" disabled={loading}>{loading ? t('modals.addUser.savingBtn') : t('modals.addUser.saveBtn')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── EditUserModal ──────────────────────────────────────────────────────────────

function EditUserModal({ userData, onClose, onSuccess }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: userData.name || '',
    username: userData.username || '',
    email: userData.email || '',
    password: '',
    role: userData.role || 'student',
    department: userData.department || '',
    student_number: userData.student_number || '',
    scope_value: userData.scope_value || '',
    is_active: userData.is_active !== false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const departments = useDistinctDepartments(form.role === 'dean');
  const [faceStatus, setFaceStatus] = useState(null);
  const [faceFile, setFaceFile] = useState(null);
  const [facePreview, setFacePreview] = useState('');
  const [faceLoading, setFaceLoading] = useState(false);
  const [faceMsg, setFaceMsg] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleRoleChange = (role) => {
    setForm(f => ({
      ...f,
      role,
      scope_value: role === 'dean' ? f.scope_value : '',
    }));
  };

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
        setFaceMsg(t('modals.editUser.faceUpdated'));
        setFaceFile(null); setFacePreview('');
      } catch (err) {
        setFaceMsg(t('modals.editUser.faceError') + ': ' + (err.message || ''));
      } finally { setFaceLoading(false); }
    };
    reader.readAsDataURL(faceFile);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const payload = buildUserPayload(form, { forEdit: true });
      await apiClient.patch(`/users/${userData.id}`, payload);
      onSuccess(); onClose();
    } catch (err) {
      setError(err.message || t('modals.editUser.errorUpdate'));
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content wide" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('modals.editUser.title')}</h2>
          <button className="modal-close" onClick={onClose} aria-label={t('common.close')}>{t('modals.close')}</button>
        </div>
        {error && <div className="modal-error">{error}</div>}
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-section-title">{t('modals.editUser.basicInfo')}</div>
          <div className="form-row">
            <div className="form-group">
              <label>{t('modals.editUser.fullName')}</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div className="form-group">
              <label>{t('modals.editUser.username')}</label>
              <input value={form.username} onChange={e => set('username', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>{t('modals.editUser.email')}</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div className="form-group">
              <label>{t('modals.editUser.newPassword')}</label>
              <input type="password" value={form.password} onChange={e => set('password', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>{t('modals.editUser.role')}</label>
              <select value={form.role} onChange={e => handleRoleChange(e.target.value)}>
                <option value="student">{t('admin.users.roles.student')}</option>
                <option value="instructor">{t('admin.users.roles.instructor')}</option>
                <option value="admin">{t('admin.users.roles.admin')}</option>
                <option value="dean">{t('admin.users.roles.dean', 'Dekan')}</option>
                <option value="rector">{t('admin.users.roles.rector', 'Rektör')}</option>
              </select>
            </div>
            {(form.role === 'student' || form.role === 'instructor' || form.role === 'admin') && (
              <div className="form-group">
                <label>{t('modals.editUser.department')}</label>
                <input value={form.department} onChange={e => set('department', e.target.value)} />
              </div>
            )}
            {form.role === 'dean' && (
              <div className="form-group">
                <label>{t('modals.addUser.scopeDepartment', 'Yetki Alanı (Bölüm)')}</label>
                <select
                  value={form.scope_value}
                  onChange={e => set('scope_value', e.target.value)}
                  required
                >
                  <option value="">{t('modals.addUser.selectDepartment', 'Bölüm seçin...')}</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                  {form.scope_value && !departments.includes(form.scope_value) && (
                    <option value={form.scope_value}>{form.scope_value}</option>
                  )}
                </select>
              </div>
            )}
          </div>
          {form.role === 'rector' && (
            <p className="form-hint">{t('modals.addUser.rectorScopeHint', 'Rektör tüm kurum verilerini görür.')}</p>
          )}
          {form.role === 'student' && (
            <div className="form-group">
              <label>{t('modals.editUser.studentNo')}</label>
              <input value={form.student_number} onChange={e => set('student_number', e.target.value)} />
            </div>
          )}
          <div className="form-group">
            <label className="checkbox-label">
              <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
              {t('modals.editUser.isActive')}
            </label>
          </div>

          <div className="form-section-title">{t('modals.editUser.faceRecord')}</div>
          <div className="face-status-row">
            <span>{t('modals.editUser.faceStatus')}</span>
            {faceStatus === null  && <span className="face-badge loading">{t('modals.editUser.faceLoading')}</span>}
            {faceStatus === true  && <span className="face-badge enrolled">{t('modals.editUser.faceEnrolled')}</span>}
            {faceStatus === false && <span className="face-badge not-enrolled">{t('modals.editUser.faceNotEnrolled')}</span>}
          </div>
          <div className="form-group" style={{ marginTop: '10px' }}>
            <label>{t('modals.editUser.uploadFace')}</label>
            <input type="file" accept="image/*" onChange={handleFileChange} />
          </div>
          {facePreview && (
            <div className="face-upload-preview">
              <img src={facePreview} alt="preview" className="face-preview-img" />
              <button type="button" className="btn-save" onClick={handleFaceEnroll} disabled={faceLoading}>
                {faceLoading ? t('modals.editUser.savingBtn') : t('modals.editUser.updateFace')}
              </button>
            </div>
          )}
          {faceMsg && (
            <div className={faceMsg.startsWith(t('common.error')) ? 'modal-error' : 'modal-success'}>{faceMsg}</div>
          )}

          <div className="modal-buttons">
            <button type="button" className="btn-cancel" onClick={onClose}>{t('modals.editUser.cancelBtn')}</button>
            <button type="submit" className="btn-save" disabled={loading}>{loading ? t('modals.editUser.savingBtn') : t('modals.editUser.saveBtn')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── ScheduleInput ──────────────────────────────────────────────────────────────

const DAYS_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function ScheduleInput({ value, onChange }) {
  const { t } = useTranslation();
  const DAYS_TR = DAYS_EN.map(d => t(`modals.schedule.days.${d}`));
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
            {t('modals.schedule.removeDay')}
          </button>
        </div>
      ))}
      <button type="button" className="btn-add-slot" onClick={addSlot}>
        {t('modals.schedule.addDay')}
      </button>
    </div>
  );
}

// ── InstructorMultiSelect ──────────────────────────────────────────────────────
// Checkbox tabanlı çoklu hoca seçici.

function InstructorMultiSelect({ instructors, selectedIds, onChange }) {
  const { t } = useTranslation();
  const toggle = (id) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(x => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };
  return (
    <div className="instructor-multi-select">
      {instructors.length === 0 && <p style={{ color: '#94a3b8', fontSize: 13 }}>{t('modals.addCourse.noInstructors')}</p>}
      {instructors.map(i => (
        <label key={i.id} className={`instructor-option ${selectedIds.includes(i.id) ? 'selected' : ''}`}>
          <input
            type="checkbox"
            checked={selectedIds.includes(i.id)}
            onChange={() => toggle(i.id)}
          />
          <span className="instructor-name">{i.name}</span>
          {i.department && <span className="instructor-dept">{i.department}</span>}
        </label>
      ))}
    </div>
  );
}

// ── AddCourseModal ─────────────────────────────────────────────────────────────

function AddCourseModal({ instructors, onClose, onSuccess }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    code: '', name: '',
    schedule: { days: [], start_time: '09:00', end_time: '10:00' },
    default_duration_minutes: '',
    shared_class_id: '',
  });
  const [selectedInstructorIds, setSelectedInstructorIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const primaryId = selectedInstructorIds[0] ?? null;
      const created = await apiClient.post('/courses', {
        ...form,
        instructor_id: primaryId,
        default_duration_minutes: form.default_duration_minutes ? Number(form.default_duration_minutes) : null,
        shared_class_id: form.shared_class_id ? Number(form.shared_class_id) : null,
      });
      // Ek hocaları ekle (2. ve sonrası)
      for (const id of selectedInstructorIds.slice(1)) {
        await apiClient.post(`/courses/${created.id}/instructors`, { instructor_id: id }).catch(() => {});
      }
      onSuccess(); onClose();
    } catch (err) {
      setError(err.message || t('modals.addCourse.errorCreate'));
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-content-wide" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('modals.addCourse.title')}</h2>
          <button className="modal-close" onClick={onClose} aria-label={t('common.close')}>{t('modals.close')}</button>
        </div>
        {error && <div className="modal-error">{error}</div>}
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <div className="form-group">
              <label>{t('modals.addCourse.codeLabel')}</label>
              <input value={form.code} onChange={e => set('code', e.target.value)} required placeholder="CS101" />
            </div>
            <div className="form-group">
              <label>{t('modals.addCourse.nameLabel')}</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>
                {t('modals.addCourse.instructorsLabel')}
                {selectedInstructorIds.length > 0 && (
                  <span className="instructor-count-badge">{t('modals.addCourse.selectedCount', { count: selectedInstructorIds.length })}</span>
                )}
              </label>
              <InstructorMultiSelect
                instructors={instructors}
                selectedIds={selectedInstructorIds}
                onChange={setSelectedInstructorIds}
              />
              {selectedInstructorIds.length > 1 && (
                <span className="form-hint">{t('modals.addCourse.primaryHint')}</span>
              )}
            </div>
            <div className="form-group" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <label>{t('modals.addCourse.scheduleLabel')}</label>
              <ScheduleInput value={form.schedule} onChange={v => set('schedule', v)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>{t('modals.addCourse.durationLabel')}</label>
              <input
                type="number" min="10" max="360"
                value={form.default_duration_minutes}
                onChange={e => set('default_duration_minutes', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>{t('modals.addCourse.parallelLabel')}</label>
              <input
                type="number" min="1"
                value={form.shared_class_id}
                onChange={e => set('shared_class_id', e.target.value)}
              />
              <span className="form-hint">{t('modals.addCourse.parallelHint')}</span>
            </div>
          </div>
          <div className="modal-buttons">
            <button type="button" className="btn-cancel" onClick={onClose}>{t('modals.addCourse.cancelBtn')}</button>
            <button type="submit" className="btn-save" disabled={loading}>{loading ? t('modals.addCourse.savingBtn') : t('modals.addCourse.saveBtn')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── EditCourseModal ────────────────────────────────────────────────────────────

function EditCourseModal({ course, instructors, onClose, onSuccess }) {
  const { t } = useTranslation();
  const defaultSchedule = course.schedule && typeof course.schedule === 'object'
    ? course.schedule
    : { days: [], start_time: '09:00', end_time: '10:00' };
  const [form, setForm] = useState({
    code: course.code || '',
    name: course.name || '',
    schedule: defaultSchedule,
    default_duration_minutes: course.default_duration_minutes || '',
    shared_class_id: course.shared_class_id || '',
  });
  const [selectedInstructorIds, setSelectedInstructorIds] = useState(course.instructor_ids || (course.instructor_id ? [course.instructor_id] : []));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    apiClient.get(`/courses/${course.id}/instructors`)
      .then(data => {
        const ids = (data || []).map(i => i.id);
        if (ids.length > 0) setSelectedInstructorIds(ids);
      })
      .catch(() => {});
  }, [course.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const primaryId = selectedInstructorIds[0] ?? null;
      await apiClient.patch(`/courses/${course.id}`, {
        ...form,
        instructor_id: primaryId,
        default_duration_minutes: form.default_duration_minutes ? Number(form.default_duration_minutes) : null,
        shared_class_id: form.shared_class_id ? Number(form.shared_class_id) : null,
      });
      // Hoca listesini senkronize et
      const currentRes = await apiClient.get(`/courses/${course.id}/instructors`).catch(() => []);
      const currentIds = (currentRes || []).map(i => i.id);
      for (const id of selectedInstructorIds) {
        if (!currentIds.includes(id)) {
          await apiClient.post(`/courses/${course.id}/instructors`, { instructor_id: id }).catch(() => {});
        }
      }
      for (const id of currentIds) {
        if (!selectedInstructorIds.includes(id)) {
          await apiClient.delete(`/courses/${course.id}/instructors/${id}`).catch(() => {});
        }
      }
      onSuccess(); onClose();
    } catch (err) {
      setError(err.message || t('modals.editCourse.errorUpdate'));
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-content-wide" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('modals.editCourse.title', { code: course.code })}</h2>
          <button className="modal-close" onClick={onClose} aria-label={t('common.close')}>{t('modals.close')}</button>
        </div>
        {error && <div className="modal-error">{error}</div>}
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <div className="form-group">
              <label>{t('modals.editCourse.codeLabel')}</label>
              <input value={form.code} onChange={e => set('code', e.target.value)} />
            </div>
            <div className="form-group">
              <label>{t('modals.editCourse.nameLabel')}</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>
                {t('modals.addCourse.instructorsLabel')}
                {selectedInstructorIds.length > 0 && (
                  <span className="instructor-count-badge">{t('modals.addCourse.selectedCount', { count: selectedInstructorIds.length })}</span>
                )}
              </label>
              <InstructorMultiSelect
                instructors={instructors}
                selectedIds={selectedInstructorIds}
                onChange={setSelectedInstructorIds}
              />
              {selectedInstructorIds.length > 1 && (
                <span className="form-hint">{t('modals.addCourse.primaryHint')}</span>
              )}
            </div>
            <div className="form-group" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <label>{t('modals.addCourse.scheduleLabel')}</label>
              <ScheduleInput value={form.schedule} onChange={v => set('schedule', v)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>{t('modals.addCourse.durationLabel')}</label>
              <input
                type="number" min="10" max="360" placeholder={t('modals.editCourse.durationPlaceholder')}
                value={form.default_duration_minutes}
                onChange={e => set('default_duration_minutes', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>{t('modals.addCourse.parallelLabel')}</label>
              <input
                type="number" min="1" placeholder={t('modals.editCourse.parallelPlaceholder')}
                value={form.shared_class_id}
                onChange={e => set('shared_class_id', e.target.value)}
              />
              <span className="form-hint">{t('modals.editCourse.parallelHint')}</span>
            </div>
          </div>
          <div className="modal-buttons">
            <button type="button" className="btn-cancel" onClick={onClose}>{t('modals.editCourse.cancelBtn')}</button>
            <button type="submit" className="btn-save" disabled={loading}>{loading ? t('modals.editCourse.savingBtn') : t('modals.editCourse.saveBtn')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── CourseStudentsModal ────────────────────────────────────────────────────────

function CourseStudentsModal({ course, onClose }) {
  const { t } = useTranslation();
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
      setError(err.message || t('modals.courseStudents.errorLoad'));
    } finally { setLoading(false); }
  }, [course.id, t]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAdd = async () => {
    if (!selectedStudent) return;
    setAdding(true); setError('');
    try {
      await apiClient.post(`/courses/${course.id}/enroll`, { student_id: Number(selectedStudent) });
      setSelectedStudent('');
      await loadData();
    } catch (err) {
      setError(err.message || t('modals.courseStudents.errorAdd'));
    } finally { setAdding(false); }
  };

  const handleRemove = async (studentId) => {
    if (!window.confirm(t('modals.courseStudents.confirmRemove'))) return;
    try {
      await apiClient.delete(`/courses/${course.id}/enroll/${studentId}`);
      await loadData();
    } catch (err) {
      setError(err.message || t('modals.courseStudents.errorRemove'));
    }
  };

  const enrolledIds = new Set(enrolled.map(s => s.id));
  const available = allStudents.filter(s => !enrolledIds.has(s.id));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content wide" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('modals.courseStudents.title', { code: course.code, name: course.name })}</h2>
          <button className="modal-close" onClick={onClose} aria-label={t('common.close')}>{t('modals.close')}</button>
        </div>
        {error && <div className="modal-error">{error}</div>}

        <div className="enroll-add-row">
          <select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)} className="enroll-select">
            <option value="">{t('modals.courseStudents.selectPlaceholder')}</option>
            {available.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}{s.student_number ? ` (${s.student_number})` : ''}{s.department ? ` — ${s.department}` : ''}
              </option>
            ))}
          </select>
          <button className="btn-save" onClick={handleAdd} disabled={!selectedStudent || adding}>
            {adding ? t('modals.courseStudents.addingBtn') : t('modals.courseStudents.addBtn')}
          </button>
        </div>

        {loading ? (
          <div className="loading-inline">{t('common.loading')}</div>
        ) : (
          <div className="enrolled-list">
            {enrolled.length === 0
              ? <div className="empty-text">{t('modals.courseStudents.empty')}</div>
              : enrolled.map(s => (
                <div key={s.id} className="enrolled-item">
                  <div className="enrolled-info">
                    <span className="enrolled-name">{s.name}</span>
                    {s.student_number && <span className="enrolled-num">{s.student_number}</span>}
                    {s.department && <span className="enrolled-dept">{s.department}</span>}
                  </div>
                  <button className="btn-remove" onClick={() => handleRemove(s.id)}>{t('modals.courseStudents.removeBtn')}</button>
                </div>
              ))
            }
          </div>
        )}
        <div style={{ marginTop: '16px', textAlign: 'right' }}>
          <button className="btn-cancel" onClick={onClose}>{t('modals.courseStudents.closeBtn')}</button>
        </div>
      </div>
    </div>
  );
}

// ── AddRoomModal ───────────────────────────────────────────────────────────────

function AddRoomModal({ onClose, onSuccess }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: '', capacity: '', type: 'faculty', equipment: '',
    latitude: '', longitude: '', geofence_radius: '100',
  });
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleGetLocation = () => {
    if (!navigator.geolocation) { setError(t('modals.addRoom.errorGps')); return; }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setForm(f => ({ ...f, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) }));
        setGpsLoading(false);
      },
      err => { setError(t('modals.addRoom.errorLocation') + ': ' + err.message); setGpsLoading(false); },
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
      setError(err.message || t('modals.addRoom.errorCreate'));
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('modals.addRoom.title')}</h2>
          <button className="modal-close" onClick={onClose} aria-label={t('common.close')}>{t('modals.close')}</button>
        </div>
        {error && <div className="modal-error">{error}</div>}
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <div className="form-group">
              <label>{t('modals.addRoom.nameLabel')}</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} required />
            </div>
            <div className="form-group">
              <label>{t('modals.addRoom.capacityLabel')}</label>
              <input type="number" value={form.capacity} onChange={e => set('capacity', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>{t('modals.addRoom.typeLabel')}</label>
              <select value={form.type} onChange={e => set('type', e.target.value)}>
                <option value="faculty">{t('modals.addRoom.types.faculty')}</option>
                <option value="institute">{t('modals.addRoom.types.institute')}</option>
                <option value="vocational">{t('modals.addRoom.types.vocational')}</option>
                <option value="classroom">{t('modals.addRoom.types.classroom')}</option>
                <option value="lab">{t('modals.addRoom.types.lab')}</option>
              </select>
            </div>
            <div className="form-group">
              <label>{t('modals.addRoom.descLabel')}</label>
              <input value={form.equipment} onChange={e => set('equipment', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <button type="button" className="btn-gps" onClick={handleGetLocation} disabled={gpsLoading}>
              {gpsLoading ? t('modals.addRoom.gpsLoading') : t('modals.addRoom.gpsBtn')}
            </button>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>{t('modals.addRoom.latLabel')}</label>
              <input type="number" step="any" value={form.latitude} onChange={e => set('latitude', e.target.value)} placeholder="41.015137" />
            </div>
            <div className="form-group">
              <label>{t('modals.addRoom.lngLabel')}</label>
              <input type="number" step="any" value={form.longitude} onChange={e => set('longitude', e.target.value)} placeholder="28.979530" />
            </div>
          </div>
          <div className="form-group">
            <label>{t('modals.addRoom.geofenceLabel')}</label>
            <input type="number" value={form.geofence_radius} onChange={e => set('geofence_radius', e.target.value)} placeholder="100" />
          </div>
          <div className="modal-buttons">
            <button type="button" className="btn-cancel" onClick={onClose}>{t('modals.addRoom.cancelBtn')}</button>
            <button type="submit" className="btn-save" disabled={loading}>{loading ? t('modals.addRoom.savingBtn') : t('modals.addRoom.saveBtn')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── EditRoomModal ──────────────────────────────────────────────────────────────

function EditRoomModal({ room, onClose, onSuccess }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: room.name || '',
    capacity: room.capacity ?? '',
    type: room.type || 'faculty',
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
    if (!navigator.geolocation) { setError(t('modals.addRoom.errorGps')); return; }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setForm(f => ({ ...f, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) }));
        setGpsLoading(false);
      },
      err => { setError(t('modals.addRoom.errorLocation') + ': ' + err.message); setGpsLoading(false); },
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
      setError(err.message || t('modals.editRoom.errorUpdate'));
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('modals.editRoom.title', { name: room.name })}</h2>
          <button className="modal-close" onClick={onClose} aria-label={t('common.close')}>{t('modals.close')}</button>
        </div>
        {error && <div className="modal-error">{error}</div>}
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <div className="form-group">
              <label>{t('modals.addRoom.nameLabel')}</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div className="form-group">
              <label>{t('modals.addRoom.capacityLabel')}</label>
              <input type="number" value={form.capacity} onChange={e => set('capacity', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>{t('modals.addRoom.typeLabel')}</label>
              <select value={form.type} onChange={e => set('type', e.target.value)}>
                <option value="faculty">{t('modals.addRoom.types.faculty')}</option>
                <option value="institute">{t('modals.addRoom.types.institute')}</option>
                <option value="vocational">{t('modals.addRoom.types.vocational')}</option>
                <option value="classroom">{t('modals.addRoom.types.classroom')}</option>
                <option value="lab">{t('modals.addRoom.types.lab')}</option>
              </select>
            </div>
            <div className="form-group">
              <label>{t('modals.addRoom.descLabel')}</label>
              <input value={form.equipment} onChange={e => set('equipment', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <button type="button" className="btn-gps" onClick={handleGetLocation} disabled={gpsLoading}>
              {gpsLoading ? t('modals.addRoom.gpsLoading') : t('modals.addRoom.gpsBtn')}
            </button>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>{t('modals.addRoom.latLabel')}</label>
              <input type="number" step="any" value={form.latitude} onChange={e => set('latitude', e.target.value)} />
            </div>
            <div className="form-group">
              <label>{t('modals.addRoom.lngLabel')}</label>
              <input type="number" step="any" value={form.longitude} onChange={e => set('longitude', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>{t('modals.addRoom.geofenceLabel')}</label>
            <input type="number" value={form.geofence_radius} onChange={e => set('geofence_radius', e.target.value)} />
          </div>
          <div className="modal-buttons">
            <button type="button" className="btn-cancel" onClick={onClose}>{t('modals.editRoom.cancelBtn')}</button>
            <button type="submit" className="btn-save" disabled={loading}>{loading ? t('modals.editRoom.savingBtn') : t('modals.editRoom.saveBtn')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export const AdminDashboardPage = ({ user, onLogout }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('overview');

  const ADMIN_MENU_ITEMS = [
    { id: 'overview',   label: t('nav.admin.overview')   },
    { id: 'users',      label: t('nav.admin.users')      },
    { id: 'courses',    label: t('nav.admin.courses')    },
    { id: 'rooms',      label: t('nav.admin.rooms')      },
    { id: 'reports',    label: t('nav.admin.reports')    },
    { id: 'excuses',    label: t('nav.admin.excuses')    },
    { id: 'disputes',   label: t('nav.admin.disputes')   },
    { id: 'audit-logs', label: t('nav.admin.auditLogs')  },
    { id: 'logout',     label: t('nav.admin.logout')     },
  ];

  const roleTR = {
    admin:      t('admin.users.roles.admin'),
    instructor: t('admin.users.roles.instructor'),
    student:    t('admin.users.roles.student'),
  };
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');

  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [reportCourseFilter, setReportCourseFilter] = useState('');

  const [showAddUser,    setShowAddUser]    = useState(false);
  const [showCsvImport,  setShowCsvImport]  = useState(false);
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
    setFetchError('');
    try {
      switch (tab) {
        case 'overview': {
          const [s, a] = await Promise.allSettled([
            apiClient.get('/dashboard/stats'),
            apiClient.get('/dashboard/recent-activity'),
          ]);
          if (s.status === 'fulfilled') setStats(s.value);
          else setFetchError(s.reason?.message || t('common.loadError', 'Veriler yüklenemedi'));
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
          else setFetchError(c.reason?.message || t('common.loadError', 'Dersler yüklenemedi'));
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
          } else {
            setFetchError(rec.reason?.message || t('common.loadError', 'Kayıtlar yüklenemedi'));
          }
          if (crs.status === 'fulfilled') setCourses(crs.value || []);
          break;
        }
        default: break;
      }
    } catch (err) {
      console.error('fetchData error:', err);
      setFetchError(err?.message || t('common.loadError', 'Veriler yüklenemedi'));
    } finally { setLoading(false); }
  }, [t]);

  useEffect(() => { fetchData(activeTab); }, [activeTab, fetchData]);

  const handleDeleteUser = async (userId) => {
    if (!window.confirm(t('modals.confirmDeleteUser'))) return;
    try {
      await apiClient.delete(`/users/${userId}`);
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch (err) { alert(err.message || t('modals.errorDelete')); }
  };

  const handleDeleteCourse = async (courseId) => {
    if (!window.confirm(t('modals.confirmDeleteCourse'))) return;
    try {
      await apiClient.delete(`/courses/${courseId}`);
      setCourses(prev => prev.filter(c => c.id !== courseId));
    } catch (err) { alert(err.message || t('modals.errorDelete')); }
  };

  const handleDeleteRoom = async (roomId) => {
    if (!window.confirm(t('modals.confirmDeleteRoom'))) return;
    try {
      await apiClient.delete(`/rooms/${roomId}`);
      setRooms(prev => prev.filter(r => r.id !== roomId));
    } catch (err) { alert(err.message || t('modals.errorDelete')); }
  };

  // ── Overview ──────────────────────────────────────────────────────────────────
  const renderOverview = () => (
    <div className="admin-overview">
      <div className="page-header">
        <div>
          <h1>{t('admin.overview.title')}</h1>
          <p className="page-subtitle">{t('admin.overview.subtitle')}</p>
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
              <div className="stat-lbl">{t('admin.overview.students')}</div>
            </div>
            <div className="stat-card purple">
              <div className="stat-icon-wrap"><MdPerson size={24} /></div>
              <div className="stat-num">{stats?.total_instructors ?? 0}</div>
              <div className="stat-lbl">{t('admin.overview.instructors')}</div>
            </div>
            <div className="stat-card green">
              <div className="stat-icon-wrap"><MdSchool size={24} /></div>
              <div className="stat-num">{stats?.total_courses ?? 0}</div>
              <div className="stat-lbl">{t('admin.overview.courses')}</div>
            </div>
            <div className="stat-card orange">
              <div className="stat-icon-wrap"><MdPlayCircle size={24} /></div>
              <div className="stat-num">{stats?.active_sessions ?? 0}</div>
              <div className="stat-lbl">{t('admin.overview.activeSessions')}</div>
            </div>
            <div className="stat-card red">
              <div className="stat-icon-wrap"><MdFlag size={24} /></div>
              <div className="stat-num">{stats?.flagged_records ?? 0}</div>
              <div className="stat-lbl">{t('admin.overview.suspiciousRecords')}</div>
            </div>
          </div>
          <div className="content-grid">
            <div className="card">
              <div className="card-header"><h2>{t('admin.overview.recentActivity')}</h2></div>
              <div className="activity-list">
                {recentActivity.length === 0
                  ? <p className="empty-text">{t('admin.overview.noActivity')}</p>
                  : recentActivity.map((a, i) => (
                    <div key={i} className="activity-item">
                      <span className={`activity-dot ${a.status === 'present' ? 'present' : a.status === 'pending_review' ? 'warning' : 'absent'}`} />
                      <div className="activity-content">
                        <div className="activity-action">
                          {t('dashboard.studentNumber', { id: a.student_id })} — {t('dashboard.courseNumber', { id: a.course_id })}
                          {a.is_flagged && <span className="flag-badge"><MdFlag size={12} style={{marginRight:3}}/>{t('admin.overview.suspicious')}</span>}
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
              <div className="card-header"><h2>{t('admin.overview.quickAccess')}</h2></div>
              <div className="quick-actions-list">
                <button className="quick-action-item" onClick={() => setActiveTab('users')}>{t('admin.overview.userManagement')}</button>
                <button className="quick-action-item" onClick={() => setActiveTab('courses')}>{t('admin.overview.courseManagement')}</button>
                <button className="quick-action-item" onClick={() => setActiveTab('rooms')}>{t('admin.overview.roomManagement')}</button>
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
          <h1>{t('admin.users.title')}</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" onClick={() => setShowCsvImport(true)}>CSV İçe Aktar</button>
            <button className="btn-primary" onClick={() => setShowAddUser(true)}>{t('admin.users.addUser')}</button>
          </div>
        </div>
        <div className="role-tabs">
          {[
            { key: 'all',        label: t('admin.users.all') },
            { key: 'student',    label: t('admin.users.students') },
            { key: 'instructor', label: t('admin.users.instructors') },
            { key: 'admin',      label: t('admin.users.admins') },
          ].map(tab => (
            <button
              key={tab.key}
              className={`role-tab${userRoleFilter === tab.key ? ' active' : ''}`}
              onClick={() => setUserRoleFilter(tab.key)}
            >
              {tab.label} ({counts[tab.key]})
            </button>
          ))}
        </div>
        {loading ? <div className="loading-inline">{t('common.loading')}</div> : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('admin.users.fullName')}</th>
                  <th>{t('admin.users.username')}</th>
                  <th>{t('admin.users.email')}</th>
                  <th>{t('admin.users.role')}</th>
                  <th>{t('admin.users.department')}</th>
                  <th>{t('admin.users.studentNo')}</th>
                  <th>{t('admin.users.status')}</th>
                  <th>{t('admin.users.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0
                  ? <tr><td colSpan="8" className="empty-cell">{t('admin.users.notFound')}</td></tr>
                  : filtered.map(u => (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td><code>{u.username}</code></td>
                      <td>{u.email}</td>
                      <td><span className={`role-badge ${u.role}`}>{roleTR[u.role] || u.role}</span></td>
                      <td>{u.department || '—'}</td>
                      <td>{u.student_number || '—'}</td>
                      <td><span className={`status-badge ${u.is_active ? 'active' : 'inactive'}`}>{u.is_active ? t('admin.users.active') : t('admin.users.inactive')}</span></td>
                      <td className="actions-cell">
                        <button className="btn-action edit"   onClick={() => setEditingUser(u)}>{t('admin.users.editBtn')}</button>
                        <button className="btn-action delete" onClick={() => handleDeleteUser(u.id)}>{t('admin.users.deleteBtn')}</button>
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
        <h1>{t('admin.courses.title')}</h1>
        <button className="btn-primary" onClick={() => setShowAddCourse(true)}>{t('admin.courses.addCourse')}</button>
      </div>
      {loading ? <div className="loading-inline">{t('common.loading')}</div> : (
        <div className="courses-grid">
          {courses.length === 0
            ? <p className="empty-text">{t('admin.courses.noCourses')}</p>
            : courses.map(c => {
              const courseInstructorIds = c.instructor_ids?.length
                ? c.instructor_ids
                : (c.instructor_id ? [c.instructor_id] : []);
              const courseInstructors = courseInstructorIds
                .map(id => instructors.find(i => i.id === id))
                .filter(Boolean);
              return (
                <div key={c.id} className="course-card">
                  <div className="course-header">
                    <h3>{c.code}</h3>
                    <span className="student-count">{t('admin.courses.students_count', { count: c.enrolled_count ?? 0 })}</span>
                  </div>
                  <div className="course-body">
                    <p className="course-name">{c.name}</p>
                    <p className="course-meta">
                      {courseInstructors.length === 0
                        ? <><span>{t('admin.courses.teacher')}: </span><em style={{ color: '#94a3b8' }}>{t('admin.courses.unassigned')}</em></>
                        : courseInstructors.length === 1
                          ? <><span>{t('admin.courses.teacher')}: </span><strong>{courseInstructors[0].name}</strong></>
                          : <><span>{t('admin.courses.teachers')}: </span><strong>{courseInstructors.map(i => i.name).join(', ')}</strong></>
                      }
                    </p>
                    {c.shared_class_id && (
                      <p className="course-meta course-parallel-badge">
                        {t('admin.courses.parallelGroup', { id: c.shared_class_id })}
                      </p>
                    )}
                    {c.schedule && typeof c.schedule === 'object' && c.schedule.days?.length > 0 && (
                      <p className="course-meta">Program: {c.schedule.days.map(d => d.slice(0,3)).join(', ')} {c.schedule.start_time}–{c.schedule.end_time}</p>
                    )}
                  </div>
                  <div className="course-actions">
                    <button className="btn-action edit"      onClick={() => setEditingCourse(c)}>{t('admin.courses.editBtn')}</button>
                    <button className="btn-action secondary" onClick={() => setCourseStudents(c)}>{t('admin.courses.studentsBtn')}</button>
                    <button className="btn-action delete"    onClick={() => handleDeleteCourse(c.id)}>{t('admin.courses.deleteBtn')}</button>
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
        <h1>{t('admin.rooms.title')}</h1>
        <button className="btn-primary" onClick={() => setShowAddRoom(true)}>{t('admin.rooms.addRoom')}</button>
      </div>
      {loading ? <div className="loading-inline">{t('common.loading')}</div> : (
        <div className="rooms-grid">
          {rooms.length === 0
            ? <p className="empty-text">{t('admin.rooms.noRooms')}</p>
            : rooms.map(r => (
              <div key={r.id} className="room-card">
                <div className="room-header">
                  <h3>{r.name}</h3>
                  <div className="status-indicator" />
                </div>
                <div className="room-body">
                  {r.type     && <p>{t('admin.rooms.type')}: {r.type}</p>}
                  {r.capacity && <p>{t('admin.rooms.capacity')}: {r.capacity}</p>}
                  {r.equipment && <p>{r.equipment}</p>}
                  {r.latitude
                    ? <p>GPS: {Number(r.latitude).toFixed(6)}, {Number(r.longitude).toFixed(6)}</p>
                    : <p className="text-warning">{t('admin.rooms.noGps')}</p>
                  }
                  <p>{t('admin.rooms.geofence')}: {r.geofence_radius} m</p>
                </div>
                <div className="room-actions">
                  <button className="btn-action edit"   onClick={() => setEditingRoom(r)}>{t('admin.rooms.editBtn')}</button>
                  <button className="btn-action delete" onClick={() => handleDeleteRoom(r.id)}>{t('admin.rooms.deleteBtn')}</button>
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

    const statusCls = { present: 'active', absent: 'inactive', excused: 'excused' };

    return (
      <div className="admin-reports">
        <div className="page-header">
          <div>
            <h1>{t('admin.reports.title')}</h1>
            <p className="page-subtitle">{t('admin.reports.subtitle')}</p>
          </div>
        </div>
        <div className="report-filter-row">
          <select
            value={reportCourseFilter}
            onChange={e => setReportCourseFilter(e.target.value)}
            className="enroll-select"
            style={{ maxWidth: '320px' }}
          >
            <option value="">{t('admin.reports.allCourses')}</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
            ))}
          </select>
          <span className="report-count">{t('admin.reports.recordCount', { count: filtered.length })}</span>
        </div>
        {loading ? <div className="loading-inline">{t('common.loading')}</div> : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('admin.reports.student')}</th>
                  <th>{t('admin.reports.studentNo')}</th>
                  <th>{t('admin.reports.course')}</th>
                  <th>{t('admin.reports.teacher')}</th>
                  <th>{t('admin.reports.date')}</th>
                  <th>{t('admin.reports.status')}</th>
                  <th>{t('admin.reports.flag')}</th>
                  <th>{t('admin.reports.verification')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0
                  ? <tr><td colSpan="8" className="empty-cell">{t('admin.reports.notFound')}</td></tr>
                  : filtered.map(r => {
                    const course = courses.find(c => c.id === r.course_id);
                    const instructor = instructors.find(i => i.id === course?.instructor_id);
                    const steps = r.verification_steps || {};
                    return (
                      <tr key={r.id}>
                        <td>{r.student_name || t('admin.reports.student') + ` #${r.student_id}`}</td>
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
                            {r.status ? t(`admin.reports.statuses.${r.status}`, r.status) : r.status}
                          </span>
                        </td>
                        <td>
                          {r.is_flagged
                            ? <span className="flag-badge">{t('admin.reports.flagged')}</span>
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
      case 'disputes':    return <DisputeReviewPage />;
      case 'audit-logs':  return <AuditLogPage />;
      default:            return renderOverview();
    }
  };

  return (
    <div className="admin-dashboard-container">
      {showCsvImport  && <CsvImportModal onClose={() => setShowCsvImport(false)} onSuccess={() => fetchData('users')} />}
      {showAddUser    && <AddUserModal onClose={() => setShowAddUser(false)} onSuccess={() => fetchData('users')} />}
      {editingUser    && <EditUserModal userData={editingUser} onClose={() => setEditingUser(null)} onSuccess={() => fetchData('users')} />}
      {showAddCourse  && <AddCourseModal instructors={instructors} onClose={() => setShowAddCourse(false)} onSuccess={() => fetchData('courses')} />}
      {editingCourse  && <EditCourseModal course={editingCourse} instructors={instructors} onClose={() => setEditingCourse(null)} onSuccess={() => fetchData('courses')} />}
      {courseStudents && <CourseStudentsModal course={courseStudents} onClose={() => setCourseStudents(null)} />}
      {showAddRoom    && <AddRoomModal onClose={() => setShowAddRoom(false)} onSuccess={() => fetchData('rooms')} />}
      {editingRoom    && <EditRoomModal room={editingRoom} onClose={() => setEditingRoom(null)} onSuccess={() => fetchData('rooms')} />}

      <Sidebar
        title={t('nav.systemTitle')}
        subtitle={t('nav.adminPanel')}
        menuItems={ADMIN_MENU_ITEMS}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        user={user}
        onLogout={onLogout}
      />
      <div className="admin-main-wrapper">
        <div className="admin-top-bar">
          <div className="top-bar-spacer" />
          <LanguageSwitcher compact />
        </div>
        {fetchError && (
          <div className="error-banner" role="alert" style={{ margin: '0 0 16px' }}>
            {fetchError}
          </div>
        )}
        <main className="main-content">{renderContent()}</main>
      </div>
    </div>
  );
};
