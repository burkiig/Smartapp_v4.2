import React, { useState, useEffect } from 'react';
import { Button } from '../../../../shared/components/ui/Button';
import './LoginForm.css';
import './PasswordToggle.css';

export const LoginForm = ({ onLogin, loading, error }) => {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    setTimeout(() => setLogoLoaded(true), 100);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(loginId, password);
  };

  return (
    <div className="login-card">
      <div className="login-header">
        <div className={`login-logo ${logoLoaded ? 'logo-loaded' : ''}`}>
          <div className="logo-shimmer-wrapper">
            <div className="logo-icon-container">
              <span className="logo-icon">SA</span>
            </div>
            <div className="shimmer-effect"></div>
          </div>
          <div className="logo-text-container">
            <span className="logo-text">Smart Attendance</span>
          </div>
        </div>
        <h1 className="login-title">Akıllı Yoklama Sistemi</h1>
        <p className="login-subtitle">Yönetim Paneli</p>
      </div>

      <form onSubmit={handleSubmit} className="login-form">
        {error && (
          <div className="error-message">
            <span>{error}</span>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">
            Kullanıcı Adı veya E-posta
          </label>
          <input
            type="text"
            className="form-input"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            placeholder="username veya email@örnek.com"
            required
            autoComplete="username"
          />
        </div>

        <div className="form-group">
          <label className="form-label">
            Şifre
          </label>
          <div className="password-input-wrapper">
            <input
              type={showPassword ? 'text' : 'password'}
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Şifrenizi girin"
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
            >
              {showPassword ? 'Gizle' : 'Göster'}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={loading}
        >
          {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
        </Button>
      </form>
    </div>
  );
};

