import React from 'react';
import { useTranslation } from 'react-i18next';
import { LoginForm } from '../features/auth/components/LoginForm';
import { useAuth } from '../features/auth/hooks';
import { LanguageSwitcher } from '../shared/components/LanguageSwitcher/LanguageSwitcher';
import './LoginPage.css';

export const LoginPage = () => {
  const { t } = useTranslation();
  const { login, isLoading, error } = useAuth();

  const handleLogin = async (username, password, rememberMe = false) => {
    await login(username, password, rememberMe);
  };

  return (
    <div className="login-page">
      <div className="login-lang-switch">
        <LanguageSwitcher compact />
      </div>
      <div className="login-split-card">

        {/* ── Sol Panel: Branding ────────────────────────────── */}
        <div className="login-left-panel">
          <div className="left-panel-content">
            <div className="left-logo-icon">
              <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden="true">
                <rect x="3"  y="3"  width="17" height="17" rx="4" fill="white" fillOpacity="0.92"/>
                <rect x="24" y="3"  width="17" height="17" rx="4" fill="white" fillOpacity="0.92"/>
                <rect x="3"  y="24" width="17" height="17" rx="4" fill="white" fillOpacity="0.92"/>
                <rect x="24" y="24" width="17" height="17" rx="4" fill="white" fillOpacity="0.42"/>
              </svg>
            </div>
            <h2 className="left-app-name">{t('auth.loginPanel.appName')}</h2>
            <p className="left-tagline">
              {t('auth.loginPanel.tagline')}
            </p>
          </div>
        </div>

        {/* ── Sağ Panel: Form ────────────────────────────────── */}
        <div className="login-right-panel">
          <LoginForm
            onLogin={handleLogin}
            loading={isLoading}
            error={error}
          />
        </div>

      </div>
    </div>
  );
};
