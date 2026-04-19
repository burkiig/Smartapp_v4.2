import React from 'react';
import './App.css';
import { LoginPage } from './pages/LoginPage';
import { useAuth } from './features/auth/hooks';
import { ErrorBoundary } from './shared/components/ErrorBoundary';
import {
  InstructorDashboardPage,
  AdminDashboardPage,
  StudentDashboardPage
} from './features/dashboard/pages';

function App() {
  const { user, isLoading, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Yükleniyor...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <ErrorBoundary>
        <LoginPage />
      </ErrorBoundary>
    );
  }

  const renderDashboard = () => {
    switch (user.role) {
      case 'instructor':
        return <InstructorDashboardPage user={user} onLogout={logout} />;
      case 'student':
        return <StudentDashboardPage user={user} onLogout={logout} />;
      case 'admin':
        return <AdminDashboardPage user={user} onLogout={logout} />;
      default:
        return (
          <div className="error-container">
            <h2>Geçersiz kullanıcı rolü</h2>
            <p>Hesabınızda tanımsız bir rol var. Sistem yöneticisiyle iletişime geçin.</p>
            <button onClick={logout}>Çıkış Yap</button>
          </div>
        );
    }
  };

  return (
    <ErrorBoundary>
      {renderDashboard()}
    </ErrorBoundary>
  );
}

export default App;
