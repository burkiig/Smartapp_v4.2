import React, { useState, useEffect } from 'react';
import { Button } from '../../../../shared/components/ui/Button';
import { RoleSelector } from '../RoleSelector';
import './LoginForm.css';
import './PasswordToggle.css';

export const LoginForm = ({ onLogin, loading, error }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('instructor');
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    setTimeout(() => setLogoLoaded(true), 100);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(username, password, selectedRole);
  };

  return (
    <div className="login-card">
      <div className="login-header">
        <div className={`login-logo ${logoLoaded ? 'logo-loaded' : ''}`}>
          <div className="logo-shimmer-wrapper">
            <div className="logo-icon-container">
              <span className="logo-icon">🎓</span>
            </div>
            <div className="shimmer-effect"></div>
          </div>
          <div className="logo-text-container">
            <span className="logo-text">Smart Attendance</span>
          </div>
        </div>
        <h1 className="login-title">Smart Attendance System</h1>
        <p className="login-subtitle">Web Panel Login</p>
      </div>

      <RoleSelector
        selectedRole={selectedRole}
        onRoleChange={setSelectedRole}
      />

      <form onSubmit={handleSubmit} className="login-form">
        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">
            <span className="label-icon">👤</span>
            Username
          </label>
          <input
            type="text"
            className="form-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">
            <span className="label-icon">🔒</span>
            Password
          </label>
          <div className="password-input-wrapper">
            <input
              type={showPassword ? 'text' : 'password'}
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
        </div>

        <div className="forgot-password-wrapper">
          <a href="#" className="forgot-password-link" onClick={(e) => {
            e.preventDefault();
            alert('Şifre sıfırlama özelliği yakında eklenecek!');
          }}>
            Şifremi Unuttum?
          </a>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="large"
          fullWidth
          loading={loading}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </Button>

        <div className="demo-credentials">
          <p className="demo-title">Demo Credentials:</p>
          <div className="demo-list">
            <div className="demo-item">
              <span className="demo-role">👨‍🏫 Instructor:</span>
              <span className="demo-creds">instructor1 / pass123</span>
            </div>
            <div className="demo-item">
              <span className="demo-role">🎓 Student:</span>
              <span className="demo-creds">student1 / pass123</span>
            </div>
            <div className="demo-item">
              <span className="demo-role">⚙️ Admin:</span>
              <span className="demo-creds">admin / admin123</span>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

