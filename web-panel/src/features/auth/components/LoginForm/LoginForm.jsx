import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { forgotPassword, resetPassword } from '../../services/authService';
import './LoginForm.css';
import './PasswordToggle.css';

/* ── SVG Icons ─────────────────────────────────────────────── */
const EmailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <rect x="1" y="3" width="14" height="10" rx="2" stroke="#94a3b8" strokeWidth="1.4"/>
    <path d="M1.5 4.5L8 9.5L14.5 4.5" stroke="#94a3b8" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);

const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <rect x="3" y="7" width="10" height="8" rx="2" stroke="#94a3b8" strokeWidth="1.4"/>
    <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="#94a3b8" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);

const EyeIcon = ({ open }) =>
  open ? (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M1 9C2.8 5.1 5.6 3 9 3s6.2 2.1 8 6c-1.8 3.9-4.6 6-8 6S2.8 12.9 1 9Z"
        stroke="#94a3b8" strokeWidth="1.4"/>
      <circle cx="9" cy="9" r="2.5" stroke="#94a3b8" strokeWidth="1.4"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M1 9C2.8 5.1 5.6 3 9 3s6.2 2.1 8 6c-1.8 3.9-4.6 6-8 6S2.8 12.9 1 9Z"
        stroke="#94a3b8" strokeWidth="1.4"/>
      <circle cx="9" cy="9" r="2.5" stroke="#94a3b8" strokeWidth="1.4"/>
      <line x1="2" y1="2" x2="16" y2="16" stroke="#94a3b8" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );

/* ── Component ─────────────────────────────────────────────── */
export const LoginForm = ({ onLogin, loading, error }) => {
  const { t } = useTranslation();
  const [loginId, setLoginId]           = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe]     = useState(false);

  // Şifre sıfırlama akışı: 'login' | 'forgot' | 'reset'
  const [mode, setMode]               = useState('login');
  const [resetEmail, setResetEmail]   = useState('');
  const [resetToken, setResetToken]   = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetMsg, setResetMsg]       = useState('');
  const [resetErr, setResetErr]       = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(loginId, password, rememberMe);
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setResetLoading(true);
    setResetErr('');
    const result = await forgotPassword(resetEmail);
    setResetLoading(false);
    if (result.success) {
      setResetMsg(result.message);
      setMode('reset');
    } else {
      setResetErr(result.error);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setResetLoading(true);
    setResetErr('');
    const result = await resetPassword(resetToken, newPassword);
    setResetLoading(false);
    if (result.success) {
      setResetMsg('Şifreniz güncellendi. Giriş yapabilirsiniz.');
      setTimeout(() => { setMode('login'); setResetMsg(''); }, 2000);
    } else {
      setResetErr(result.error);
    }
  };

  /* ── Şifremi Unuttum Ekranı ─────────────────────────────── */
  if (mode === 'forgot' || mode === 'reset') {
    return (
      <div className="login-form-inner">
        <div className="lf-header">
          <h1 className="lf-title">{t('auth.resetTitle', 'Şifre Sıfırlama')}</h1>
          <p className="lf-subtitle">
            {mode === 'forgot'
              ? t('auth.forgotSubtitle', 'E-posta adresinizi girin, sıfırlama talimatları göndereceğiz.')
              : t('auth.resetSubtitle', 'E-posta ile gelen token ve yeni şifrenizi girin.')}
          </p>
        </div>

        <form onSubmit={mode === 'forgot' ? handleForgot : handleReset} className="lf-form" noValidate>

          {resetErr && (
            <div className="lf-error" role="alert">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="7" stroke="#dc2626" strokeWidth="1.4"/>
                <line x1="8" y1="5" x2="8" y2="9" stroke="#dc2626" strokeWidth="1.6" strokeLinecap="round"/>
                <circle cx="8" cy="11.5" r="0.8" fill="#dc2626"/>
              </svg>
              <span>{resetErr}</span>
            </div>
          )}

          {resetMsg && (
            <div className="lf-error" role="status" style={{ background: '#f0fdf4', borderColor: '#16a34a', color: '#15803d' }}>
              <span>{resetMsg}</span>
            </div>
          )}

          {mode === 'forgot' && (
            <div className="lf-field">
              <label className="lf-label" htmlFor="lf-reset-email">{t('auth.emailLabel', 'E-posta')}</label>
              <div className="lf-input-wrap">
                <span className="lf-input-icon"><EmailIcon /></span>
                <input
                  id="lf-reset-email"
                  type="email"
                  className="lf-input"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>
          )}

          {mode === 'reset' && (
            <>
              <div className="lf-field">
                <label className="lf-label" htmlFor="lf-reset-token">{t('auth.resetTokenLabel', 'Sıfırlama Token')}</label>
                <div className="lf-input-wrap">
                  <input
                    id="lf-reset-token"
                    type="text"
                    className="lf-input"
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    placeholder={t('auth.resetTokenPlaceholder', 'E-postanızdaki token')}
                    required
                  />
                </div>
              </div>
              <div className="lf-field">
                <label className="lf-label" htmlFor="lf-new-password">{t('auth.newPasswordLabel', 'Yeni Şifre')}</label>
                <div className="lf-input-wrap">
                  <span className="lf-input-icon"><LockIcon /></span>
                  <input
                    id="lf-new-password"
                    type="password"
                    className="lf-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t('auth.newPasswordPlaceholder', 'Yeni şifreniz')}
                    required
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </>
          )}

          <button type="submit" className="lf-submit-btn" disabled={resetLoading}>
            {resetLoading ? (
              <><span className="lf-spinner" aria-hidden="true" /> {t('common.processing', 'Lütfen bekleyin...')}</>
            ) : mode === 'forgot' ? t('auth.sendResetBtn', 'Sıfırlama Talimatı Gönder') : t('auth.updatePasswordBtn', 'Şifreyi Güncelle')}
          </button>

          <button
            type="button"
            className="lf-forgot"
            style={{ display: 'block', marginTop: 12 }}
            onClick={() => { setMode('login'); setResetErr(''); setResetMsg(''); }}
          >
            {t('auth.backToLogin', 'Giriş ekranına dön')}
          </button>
        </form>
      </div>
    );
  }

  /* ── Normal Giriş Ekranı ────────────────────────────────── */
  return (
    <div className="login-form-inner">

      {/* Header */}
      <div className="lf-header">
        <h1 className="lf-title">{t('auth.title')}</h1>
        <p className="lf-subtitle">{t('auth.subtitle')}</p>
      </div>

      <form onSubmit={handleSubmit} className="lf-form" noValidate>

        {/* ── Hata Mesajı ────────────────────────────────────── */}
        {error && (
          <div className="lf-error" role="alert">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="7" stroke="#dc2626" strokeWidth="1.4"/>
              <line x1="8" y1="5" x2="8" y2="9" stroke="#dc2626" strokeWidth="1.6" strokeLinecap="round"/>
              <circle cx="8" cy="11.5" r="0.8" fill="#dc2626"/>
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* ── E-posta ─────────────────────────────────────────── */}
        <div className="lf-field">
          <label className="lf-label" htmlFor="lf-email">
            {t('auth.emailLabel')}
          </label>
          <div className="lf-input-wrap">
            <span className="lf-input-icon"><EmailIcon /></span>
            <input
              id="lf-email"
              type="text"
              className="lf-input"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="username"
              disabled={loading}
            />
          </div>
        </div>

        {/* ── Şifre ───────────────────────────────────────────── */}
        <div className="lf-field">
          <div className="lf-label-row">
            <label className="lf-label" htmlFor="lf-password">{t('auth.passwordLabel')}</label>
            <button
              type="button"
              className="lf-forgot"
              onClick={() => setMode('forgot')}
            >
              {t('auth.forgotPassword')}
            </button>
          </div>
          <div className="lf-input-wrap">
            <span className="lf-input-icon"><LockIcon /></span>
            <input
              id="lf-password"
              type={showPassword ? 'text' : 'password'}
              className="lf-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              disabled={loading}
            />
            <button
              type="button"
              className="lf-eye-btn"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
            >
              <EyeIcon open={showPassword} />
            </button>
          </div>
        </div>

        {/* ── Beni Hatırla ────────────────────────────────────── */}
        <label className="lf-remember">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            disabled={loading}
          />
          <span>{t('auth.rememberMe')}</span>
        </label>

        {/* ── Giriş Butonu ────────────────────────────────────── */}
        <button
          type="submit"
          className="lf-submit-btn"
          disabled={loading || !loginId || !password}
        >
          {loading ? (
            <>
              <span className="lf-spinner" aria-hidden="true" />
              {t('auth.loggingIn')}
            </>
          ) : (
            t('auth.loginButton')
          )}
        </button>

      </form>
    </div>
  );
};
