import React from 'react';
import './App.css';
import { LoginPage } from './pages/LoginPage';
import { useAuth } from './features/auth/hooks';
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
      return <InstructorDashboardPage user={user} onLogout={logout} />;
    case 'student':
      return <StudentDashboardPage user={user} onLogout={logout} />;
    case 'admin':
      return <AdminDashboardPage user={user} onLogout={logout} />;
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

