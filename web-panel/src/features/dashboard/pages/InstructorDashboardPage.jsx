import React, { useState } from 'react';
import { Sidebar } from '../../../shared/components/layout/Sidebar';
import DashboardView from '../components/DashboardView';
import StudentRegistration from '../../students/components/StudentRegistration';
import { AttendancePage } from '../../attendance/pages';
import { StudentsPage } from '../../attendance/pages/StudentsPage';
import { RecordsPage } from '../../attendance/pages/RecordsPage';
import { WeeklySchedulePage } from '../../schedule/pages/WeeklySchedulePage';
import { SettingsPage } from '../../settings/pages/SettingsPage';
import { FaceScan } from '../../attendance/components/FaceScan';
import { QRScan } from '../../attendance/components/QRScan';
import './InstructorDashboardPage.css';

const INSTRUCTOR_MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'schedule', label: 'Weekly Schedule', icon: '📅' },
  { id: 'face-scan', label: 'Face Scan', icon: '👤' },
  { id: 'qr-scan', label: 'QR Scan', icon: '📱' },
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
        return <DashboardView />;
      case 'schedule':
        return <WeeklySchedulePage />;
      case 'face-scan':
        return <FaceScan onClose={() => setActiveTab('dashboard')} />;
      case 'qr-scan':
        return <QRScan onClose={() => setActiveTab('dashboard')} />;
      case 'register':
        return <StudentRegistration />;
      case 'attendance':
        return <AttendancePage />;
      case 'students':
        return <StudentsPage />;
      case 'reports':
        return <RecordsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardView />;
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

