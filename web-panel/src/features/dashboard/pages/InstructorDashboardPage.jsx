import React, { useState } from 'react';
import { Sidebar } from '../../../shared/components/layout/Sidebar';
import Dashboard from '../../../components/Dashboard';
import WeeklySchedule from '../../../components/WeeklySchedule';
import Register from '../../../components/Register';
import { AttendancePage } from '../../attendance/pages';
import Students from '../../../components/Students';
import Records from '../../../components/Records';
import Settings from '../../../components/Settings';
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
        return <WeeklySchedule />;
      case 'register':
        return <Register />;
      case 'attendance':
        return <AttendancePage />;
      case 'students':
        return <Students />;
      case 'reports':
        return <Records />;
      case 'settings':
        return <Settings />;
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

