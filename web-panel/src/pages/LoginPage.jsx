import React from 'react';
import { LoginForm } from '../features/auth/components/LoginForm';
import { useAuth } from '../features/auth/hooks';
import { LanguageSwitcher } from '../shared/components/LanguageSwitcher/LanguageSwitcher';
import './LoginPage.css';

export const LoginPage = () => {
  const { login, isLoading, error } = useAuth();

  const handleLogin = async (username, password) => {
    await login(username, password);
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
            <h2 className="left-app-name">Smart Attendance System</h2>
            <p className="left-tagline">
              Welcome back. Sign in to continue to your workspace.
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
