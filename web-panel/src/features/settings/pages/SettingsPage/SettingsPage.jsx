import React, { useState, useEffect } from 'react';
import { Button } from '../../../../shared/components/ui/Button';
import apiClient from '../../../../shared/services/apiClient';
import './SettingsPage.css';

// ── Admin System Settings Section ─────────────────────────────────────────────
function AdminSystemSettings() {
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
      setMessage('Sistem ayarları kaydedildi');
      // Refresh
      const res = await apiClient.get('/admin/settings/');
      setSettings(res || []);
    } catch (err) {
      setMessage(err.message || 'Kaydetme hatası');
    } finally {
      setSaving(false);
    }
  };

  const LABELS = {
    qr_token_ttl_seconds: 'QR Kod Geçerlilik Süresi (saniye)',
    min_attendance_rate: 'Minimum Devam Oranı (%)',
    geofence_radius_m: 'Konum Doğrulama Yarıçapı (metre)',
  };

  if (settings.length === 0) return null;

  return (
    <div className="settings-section">
      <div className="section-icon">⚙️</div>
      <div className="section-content">
        <h2 className="section-title">Sistem Ayarları (Admin)</h2>
        {message && <div className={`settings-message ${message.includes('hata') ? 'error' : 'success'}`}>{message}</div>}
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
            {saving ? 'Kaydediliyor...' : 'Sistem Ayarlarını Kaydet'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export const SettingsPage = () => {
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
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
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
      const savedUser = JSON.parse(localStorage.getItem('user') || '{}');
      const updated = await apiClient.patch(`/users/${savedUser.id}`, {
        name: name || undefined,
        department: department || undefined,
      });
      localStorage.setItem('user', JSON.stringify({ ...savedUser, ...updated }));
      localStorage.setItem('web_panel_settings', JSON.stringify({
        pushNotifications, notifyFlagged, notifySessionEnds, language, timeFormat,
      }));
      setMessage({ text: 'Ayarlar kaydedildi', type: 'success' });
    } catch (err) {
      setMessage({ text: err.message || 'Kaydetme hatası', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-page-container">
      <div className="settings-header">
        <h1 className="page-title">Ayarlar</h1>
        <p className="page-subtitle">Tercihlerinizi ve bildirimlerinizi yönetin</p>
      </div>

      {message.text && (
        <div className={`settings-message ${message.type}`}>{message.text}</div>
      )}

      <div className="settings-content">
        <div className="settings-section">
          <div className="section-icon section-icon-bell"></div>
          <div className="section-content">
            <h2 className="section-title">Bildirimler</h2>
            <div className="setting-item">
              <div className="setting-info">
                <div className="setting-label">Push Bildirimleri</div>
                <div className="setting-description">Şüpheli yoklama bildirimleri alın</div>
              </div>
              <label className="toggle-switch">
                <input type="checkbox" checked={pushNotifications} onChange={e => setPushNotifications(e.target.checked)} />
                <span className="toggle-slider"></span>
              </label>
            </div>
            <div className="setting-subsection">
              <div className="subsection-title">Bildirim Tercihleri</div>
              <div className="checkbox-item">
                <label className="checkbox-label">
                  <input type="checkbox" checked={notifyFlagged} onChange={e => setNotifyFlagged(e.target.checked)} />
                  <span className="checkbox-text">Şüpheli yoklama kaydı oluştuğunda</span>
                </label>
              </div>
              <div className="checkbox-item">
                <label className="checkbox-label">
                  <input type="checkbox" checked={notifySessionEnds} onChange={e => setNotifySessionEnds(e.target.checked)} />
                  <span className="checkbox-text">Yoklama oturumu sona erdiğinde</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <div className="section-icon section-icon-lang"></div>
          <div className="section-content">
            <h2 className="section-title">Dil & Bölge</h2>
            <div className="form-group">
              <label className="form-label">Dil</label>
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
            <h2 className="section-title">Görünüm</h2>
            <div className="form-group">
              <label className="form-label">Saat Formatı</label>
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
            <h2 className="section-title">Hesap Bilgileri</h2>
            <div className="form-group">
              <label className="form-label">Ad Soyad</label>
              <input type="text" className="form-input" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">E-posta</label>
              <input type="email" className="form-input" value={email} disabled />
              <span className="form-hint">E-posta değiştirilemez</span>
            </div>
            <div className="form-group">
              <label className="form-label">Bölüm</label>
              <input type="text" className="form-input" value={department} onChange={e => setDepartment(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <AdminSystemSettings />

      <div className="settings-footer">
        <Button onClick={handleSave} variant="primary" size="lg" disabled={saving}>
          {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
        </Button>
      </div>
    </div>
  );
};
