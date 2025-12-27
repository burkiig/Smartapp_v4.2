import React, { useState } from 'react';
import { Button } from '../../../../shared/components/ui/Button';
import './SettingsPage.css';

export const SettingsPage = () => {
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [notifyFlagged, setNotifyFlagged] = useState(true);
  const [notifySessionEnds, setNotifySessionEnds] = useState(true);
  const [notifyClassStart, setNotifyClassStart] = useState(false);
  const [language, setLanguage] = useState('English');
  const [timeFormat, setTimeFormat] = useState('12-hour (2:30 PM)');
  const [theme, setTheme] = useState('light');
  const [name, setName] = useState('Dr. Robert Chen');
  const [email, setEmail] = useState('robert.chen@university.edu');
  const [department, setDepartment] = useState('Computer Science');

  const handleSave = () => {
    alert('Settings saved successfully!');
  };

  return (
    <div className="settings-page-container">
      <div className="settings-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage your preferences and notifications</p>
      </div>

      <div className="settings-content">
        {/* Notifications */}
        <div className="settings-section">
          <div className="section-icon">🔔</div>
          <div className="section-content">
            <h2 className="section-title">Notifications</h2>
            
            <div className="setting-item">
              <div className="setting-info">
                <div className="setting-label">Email Notifications</div>
                <div className="setting-description">Receive attendance alerts via email</div>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={emailNotifications}
                  onChange={(e) => setEmailNotifications(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="setting-item">
              <div className="setting-info">
                <div className="setting-label">Push Notifications</div>
                <div className="setting-description">Get notified about flagged attendance</div>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={pushNotifications}
                  onChange={(e) => setPushNotifications(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="setting-subsection">
              <div className="subsection-title">Notify me when</div>
              
              <div className="checkbox-item">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={notifyFlagged}
                    onChange={(e) => setNotifyFlagged(e.target.checked)}
                  />
                  <span className="checkbox-text">A student's attendance is flagged</span>
                </label>
              </div>

              <div className="checkbox-item">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={notifySessionEnds}
                    onChange={(e) => setNotifySessionEnds(e.target.checked)}
                  />
                  <span className="checkbox-text">Attendance session ends</span>
                </label>
              </div>

              <div className="checkbox-item">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={notifyClassStart}
                    onChange={(e) => setNotifyClassStart(e.target.checked)}
                  />
                  <span className="checkbox-text">Class is about to start</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Language & Region */}
        <div className="settings-section">
          <div className="section-icon">🌐</div>
          <div className="section-content">
            <h2 className="section-title">Language & Region</h2>
            
            <div className="form-group">
              <label className="form-label">Language</label>
              <select
                className="form-select"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option>English</option>
                <option>Türkçe</option>
                <option>Español</option>
                <option>Français</option>
              </select>
            </div>
          </div>
        </div>

        {/* Display Preferences */}
        <div className="settings-section">
          <div className="section-icon">⚙️</div>
          <div className="section-content">
            <h2 className="section-title">Display Preferences</h2>
            
            <div className="form-group">
              <label className="form-label">Time Format</label>
              <select
                className="form-select"
                value={timeFormat}
                onChange={(e) => setTimeFormat(e.target.value)}
              >
                <option>12-hour (2:30 PM)</option>
                <option>24-hour (14:30)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Theme</label>
              <div className="theme-selector">
                <button
                  className={`theme-option ${theme === 'light' ? 'active' : ''}`}
                  onClick={() => setTheme('light')}
                >
                  <div className="theme-preview light-preview"></div>
                  <span>Light</span>
                </button>
                <button
                  className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
                  onClick={() => setTheme('dark')}
                >
                  <div className="theme-preview dark-preview"></div>
                  <span>Dark</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Account Information */}
        <div className="settings-section">
          <div className="section-icon">👤</div>
          <div className="section-content">
            <h2 className="section-title">Account Information</h2>
            
            <div className="form-group">
              <label className="form-label">Name</label>
              <input
                type="text"
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Department</label>
              <input
                type="text"
                className="form-input"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="settings-footer">
        <Button onClick={handleSave} variant="primary" size="large">
          Save Changes
        </Button>
      </div>
    </div>
  );
};

