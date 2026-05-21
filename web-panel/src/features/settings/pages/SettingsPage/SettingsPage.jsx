import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../../../i18n';
import { Button } from '../../../../shared/components/ui/Button';
import apiClient from '../../../../shared/services/apiClient';
import './SettingsPage.css';

// ── Admin System Settings Section ─────────────────────────────────────────────
function AdminSystemSettings() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState([]);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    apiClient.get('/admin/settings/').then(res => {
      setSettings(res || []);
      const v = {};
      (res || []).forEach(s => { v[s.key] = s.value; });
      setValues(v);
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true); setMessage('');
    try {
      for (const s of settings) {
        if (values[s.key] !== s.value) {
          await apiClient.put(`/admin/settings/${s.key}`, { value: values[s.key] });
        }
      }
      setMessage(t('settings.systemSaved'));
      // Refresh
      const res = await apiClient.get('/admin/settings/');
      setSettings(res || []);
    } catch (err) {
      setMessage(err.message || t('settings.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const LABELS = {
    qr_token_ttl_seconds: t('settings.qrTtlLabel'),
    min_attendance_rate: t('settings.minAttendanceLabel'),
    geofence_radius_m: t('settings.geofenceLabel'),
    fake_gps_max_attempts: t('settings.fakeGpsLabel'),
  };

  if (settings.length === 0) return null;

  return (
    <div className="settings-section">
      <div className="section-icon">⚙️</div>
      <div className="section-content">
        <h2 className="section-title">{t('settings.adminSystemTitle')}</h2>
        {message && <div className={`settings-message ${message.includes('hata') || message.includes('error') ? 'error' : 'success'}`}>{message}</div>}
        {settings.map(s => (
          <div className="form-group" key={s.key}>
            <label className="form-label">{LABELS[s.key] || s.key}</label>
            <input
              type="number"
              className="form-input"
              value={values[s.key] ?? ''}
              onChange={e => setValues(v => ({ ...v, [s.key]: e.target.value }))}
            />
            {s.description && <span className="form-hint">{s.description}</span>}
          </div>
        ))}
        <div style={{ marginTop: 12 }}>
          <Button onClick={handleSave} variant="primary" size="md" disabled={saving}>
            {saving ? t('common.saving') : t('settings.saveSystemBtn')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export const SettingsPage = () => {
  const { t } = useTranslation();
  const [pushNotifications, setPushNotifications] = useState(true);
  const [notifyFlagged, setNotifyFlagged] = useState(true);
  const [notifySessionEnds, setNotifySessionEnds] = useState(true);
  const [language, setLanguage] = useState('Türkçe');
  const [timeFormat, setTimeFormat] = useState('24-hour (14:30)');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    const rawUser = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (rawUser) {
      try {
        const u = JSON.parse(rawUser);
        setName(u.name || '');
        setEmail(u.email || '');
        setDepartment(u.department || '');
      } catch { /* ignore */ }
    }
    const prefs = localStorage.getItem('web_panel_settings');
    if (prefs) {
      try {
        const p = JSON.parse(prefs);
        if (p.pushNotifications !== undefined) setPushNotifications(p.pushNotifications);
        if (p.notifyFlagged !== undefined) setNotifyFlagged(p.notifyFlagged);
        if (p.notifySessionEnds !== undefined) setNotifySessionEnds(p.notifySessionEnds);
        if (p.language) setLanguage(p.language);
        if (p.timeFormat) setTimeFormat(p.timeFormat);
      } catch { /* ignore */ }
    }
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage({ text: '', type: '' });
    try {
      const rawUser = localStorage.getItem('user') || sessionStorage.getItem('user') || '{}';
      const savedUser = JSON.parse(rawUser);
      const updated = await apiClient.patch(`/users/${savedUser.id}`, {
        name: name || undefined,
        department: department || undefined,
      });
      const merged = JSON.stringify({ ...savedUser, ...updated });
      if (localStorage.getItem('user')) {
        localStorage.setItem('user', merged);
      } else {
        sessionStorage.setItem('user', merged);
      }
      localStorage.setItem('web_panel_settings', JSON.stringify({
        pushNotifications, notifyFlagged, notifySessionEnds, language, timeFormat,
      }));
      setMessage({ text: t('settings.saved'), type: 'success' });
      if (language === 'English') i18n.changeLanguage('en');
      else if (language === 'Türkçe') i18n.changeLanguage('tr');
    } catch (err) {
      setMessage({ text: err.message || t('settings.saveError'), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-page-container">
      <div className="settings-header">
        <h1 className="page-title">{t('settings.title')}</h1>
        <p className="page-subtitle">{t('settings.subtitle')}</p>
      </div>

      {message.text && (
        <div className={`settings-message ${message.type}`}>{message.text}</div>
      )}

      <div className="settings-content">
        <div className="settings-section">
          <div className="section-icon section-icon-bell"></div>
          <div className="section-content">
            <h2 className="section-title">{t('settings.notificationsTitle')}</h2>
            <div className="setting-item">
              <div className="setting-info">
                <div className="setting-label">{t('settings.pushNotifications')}</div>
                <div className="setting-description">{t('settings.pushNotificationsDesc')}</div>
              </div>
              <label className="toggle-switch">
                <input type="checkbox" checked={pushNotifications} onChange={e => setPushNotifications(e.target.checked)} />
                <span className="toggle-slider"></span>
              </label>
            </div>
            <div className="setting-subsection">
              <div className="subsection-title">{t('settings.notificationPrefs')}</div>
              <div className="checkbox-item">
                <label className="checkbox-label">
                  <input type="checkbox" checked={notifyFlagged} onChange={e => setNotifyFlagged(e.target.checked)} />
                  <span className="checkbox-text">{t('settings.notifyFlagged')}</span>
                </label>
              </div>
              <div className="checkbox-item">
                <label className="checkbox-label">
                  <input type="checkbox" checked={notifySessionEnds} onChange={e => setNotifySessionEnds(e.target.checked)} />
                  <span className="checkbox-text">{t('settings.notifySessionEnds')}</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <div className="section-icon section-icon-lang"></div>
          <div className="section-content">
            <h2 className="section-title">{t('settings.languageRegion')}</h2>
            <div className="form-group">
              <label className="form-label">{t('settings.language')}</label>
              <select className="form-select" value={language} onChange={e => setLanguage(e.target.value)}>
                <option>Türkçe</option>
                <option>English</option>
              </select>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <div className="section-icon section-icon-settings"></div>
          <div className="section-content">
            <h2 className="section-title">{t('settings.appearance')}</h2>
            <div className="form-group">
              <label className="form-label">{t('settings.timeFormat')}</label>
              <select className="form-select" value={timeFormat} onChange={e => setTimeFormat(e.target.value)}>
                <option>24-hour (14:30)</option>
                <option>12-hour (2:30 PM)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <div className="section-icon">👤</div>
          <div className="section-content">
            <h2 className="section-title">{t('settings.accountInfo')}</h2>
            <div className="form-group">
              <label className="form-label">{t('settings.fullName')}</label>
              <input type="text" className="form-input" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('settings.email')}</label>
              <input type="email" className="form-input" value={email} disabled />
              <span className="form-hint">{t('settings.emailReadOnly')}</span>
            </div>
            <div className="form-group">
              <label className="form-label">{t('settings.department')}</label>
              <input type="text" className="form-input" value={department} onChange={e => setDepartment(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <AdminSystemSettings />

      <div className="settings-footer">
        <Button onClick={handleSave} variant="primary" size="lg" disabled={saving}>
          {saving ? t('common.saving') : t('settings.saveChanges')}
        </Button>
      </div>
    </div>
  );
};
