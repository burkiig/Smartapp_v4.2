import React from 'react';
import { Routes, Route } from 'react-router-dom';
import './App.css';
import { useTranslation } from 'react-i18next';
import { LoginPage } from './pages/LoginPage';
import { useAuth } from './features/auth/hooks';
import { ErrorBoundary } from './shared/components/ErrorBoundary';
import {
  InstructorDashboardPage,
  AdminDashboardPage,
  StudentDashboardPage,
} from './features/dashboard/pages';
import PresentAttendancePage from './features/classroom/PresentAttendancePage';
import LeadershipDashboardPage from './pages/LeadershipDashboardPage';

function AppMain() {
  const { user, isLoading, logout } = useAuth();
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <p>{t('app.loading')}</p>
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

  switch (user.role) {
    case 'dean':
    case 'rector':
      return <LeadershipDashboardPage user={user} onLogout={logout} />;
    case 'instructor':
      return <InstructorDashboardPage user={user} onLogout={logout} />;
    case 'student':
      return <StudentDashboardPage user={user} onLogout={logout} />;
    case 'admin':
      return <AdminDashboardPage user={user} onLogout={logout} />;
    default:
      return (
        <div className="error-container">
          <h2>{t('app.invalidRole')}</h2>
          <p>{t('app.invalidRoleDesc')}</p>
          <button type="button" onClick={logout}>{t('app.logout')}</button>
        </div>
      );
  }
}

function App() {
  return (
    <Routes>
      <Route path="/present/attendance/:sessionId" element={<PresentAttendancePage />} />
      <Route path="*" element={<AppMain />} />
    </Routes>
  );
}

export default App;
