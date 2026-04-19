import React from 'react';
import { LoginForm } from '../features/auth/components/LoginForm';
import { useAuth } from '../features/auth/hooks';
import './LoginPage.css';

export const LoginPage = () => {
  const { login, isLoading, error } = useAuth();

  const handleLogin = async (username, password) => {
    await login(username, password);
  };

  return (
    <div className="login-page">
      <div className="login-background">
        <div className="login-shape shape-1"></div>
        <div className="login-shape shape-2"></div>
        <div className="login-shape shape-3"></div>
      </div>
      
      <div className="login-container">
        <LoginForm
          onLogin={handleLogin}
          loading={isLoading}
          error={error}
        />
      </div>
    </div>
  );
};

