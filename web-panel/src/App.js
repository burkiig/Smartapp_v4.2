import React from 'react';
import './App.css';
import { LoginPage } from './pages/LoginPage';
import { useAuth } from './features/auth/hooks';
import InstructorDashboard from './components/InstructorDashboard';
import StudentDashboard from './components/StudentDashboard';
import AdminDashboard from './components/AdminDashboard';

function App() {
  const { user, isLoading, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  // Render appropriate dashboard based on user role
  switch (user.role) {
    case 'instructor':
      return <InstructorDashboard user={user} onLogout={logout} />;
    case 'student':
      return (
        <div className="App">
          <header className="app-header">
            <div className="header-content">
              <h1 className="header-title">Smart Attendance System</h1>
              <p className="header-subtitle">Student Portal</p>
            </div>
            <button className="logout-button" onClick={logout}>
              <span className="logout-icon">🚪</span>
              Logout
            </button>
          </header>
          <StudentDashboard user={user} />
        </div>
      );
    case 'admin':
      return (
        <div className="App">
          <header className="app-header admin-header">
            <div className="header-content">
              <h1 className="header-title">Smart Attendance System</h1>
              <p className="header-subtitle">Admin Portal</p>
            </div>
            <button className="logout-button" onClick={logout}>
              <span className="logout-icon">🚪</span>
              Logout
            </button>
          </header>
          <AdminDashboard user={user} />
        </div>
      );
    default:
      return (
        <div className="error-container">
          <h2>Invalid user role</h2>
          <button onClick={logout}>Logout</button>
        </div>
      );
  }
}

export default App;

