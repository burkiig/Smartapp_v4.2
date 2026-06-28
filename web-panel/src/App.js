import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import './App.css';
import { useTranslation } from 'react-i18next';
import { LoginPage } from './pages/LoginPage';
import { useAuth } from './features/auth/hooks';
import { ErrorBoundary } from './shared/components/ErrorBoundary';
import PresentAttendancePage from './features/classroom/PresentAttendancePage';

const InstructorDashboardPage = lazy(() =>
  import('./features/dashboard/pages/InstructorDashboardPage').then((module) => ({
    default: module.InstructorDashboardPage,
  }))
);
const AdminDashboardPage = lazy(() =>
  import('./features/dashboard/pages/AdminDashboardPage').then((module) => ({
    default: module.AdminDashboardPage,
  }))
);
const StudentDashboardPage = lazy(() =>
  import('./features/dashboard/pages/StudentDashboardPage').then((module) => ({
    default: module.StudentDashboardPage,
  }))
);
const LeadershipDashboardPage = lazy(() => import('./pages/LeadershipDashboardPage'));

function RolePageFallback({ label }) {
  return (
    <div className="loading-container">
      <div className="loading-spinner" />
      <p>{label}</p>
    </div>
  );
}

function AppMain() {
  const { user, isLoading, logout } = useAuth();
  const { t } = useTranslation();
  const fallbackLabel = t('app.loading');

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
      return (
        <Suspense fallback={<RolePageFallback label={fallbackLabel} />}>
          <LeadershipDashboardPage user={user} onLogout={logout} />
        </Suspense>
      );
    case 'instructor':
      return (
        <Suspense fallback={<RolePageFallback label={fallbackLabel} />}>
          <InstructorDashboardPage user={user} onLogout={logout} />
        </Suspense>
      );
    case 'student':
      return (
        <Suspense fallback={<RolePageFallback label={fallbackLabel} />}>
          <StudentDashboardPage user={user} onLogout={logout} />
        </Suspense>
      );
    case 'admin':
      return (
        <Suspense fallback={<RolePageFallback label={fallbackLabel} />}>
          <AdminDashboardPage user={user} onLogout={logout} />
        </Suspense>
      );
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
