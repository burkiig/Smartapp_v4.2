import React, { useState } from 'react';
import { Sidebar } from '../../../shared/components/layout/Sidebar';
import Dashboard from '../../../components/Dashboard';
import Register from '../../../components/Register';
import { AttendancePage } from '../../attendance/pages';
import { StudentsPage } from '../../attendance/pages/StudentsPage';
import { RecordsPage } from '../../attendance/pages/RecordsPage';
import { WeeklySchedulePage } from '../../schedule/pages/WeeklySchedulePage';
import { SettingsPage } from '../../settings/pages/SettingsPage';
import './InstructorDashboardPage.css';

const INSTRUCTOR_MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'schedule', label: 'Weekly Schedule', icon: '📅' },
  { id: 'attendance', label: 'Flagged Attendance', icon: '✓', badge: 3 },
  { id: 'reports', label: 'Reports', icon: '📄' },
  { id: 'register', label: 'Register Student', icon: '➕' },
  { id: 'students', label: 'Students', icon: '👥' },
  { id: 'settings', label: 'Settings', icon: '⚙️' }
];

export const InstructorDashboardPage = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'schedule':
        return <WeeklySchedulePage />;
      case 'register':
        return <Register />;
      case 'attendance':
        return <AttendancePage />;
      case 'students':
        return <StudentsPage />;
      case 'reports':
        return <RecordsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="instructor-dashboard-container">
      <Sidebar
        title="Attendance System"
        subtitle="Instructor Panel"
        menuItems={INSTRUCTOR_MENU_ITEMS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        user={user}
        onLogout={onLogout}
      />

      <main className="main-content">
        {renderContent()}
      </main>
    </div>
  );
};

