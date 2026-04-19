import React, { useState } from 'react';
import { Sidebar } from '../../../shared/components/layout/Sidebar';
import { NotificationBell } from '../../../shared/components/NotificationBell/NotificationBell';
import DashboardView from '../components/DashboardView';
import StudentRegistration from '../../students/components/StudentRegistration';
import { AttendancePage } from '../../attendance/pages';
import { StudentsPage } from '../../attendance/pages/StudentsPage';
import { RecordsPage } from '../../attendance/pages/RecordsPage';
import { WeeklySchedulePage } from '../../schedule/pages/WeeklySchedulePage';
import { SettingsPage } from '../../settings/pages/SettingsPage';
import { ExcusesPage } from '../../attendance/pages/ExcusesPage';
import { DisputeReviewPage } from '../../disputes/DisputeReviewPage';
import { FaceScan } from '../../attendance/components/FaceScan';
import { QRScan } from '../../attendance/components/QRScan';
import './InstructorDashboardPage.css';

const INSTRUCTOR_MENU_ITEMS = [
  { id: 'dashboard',  label: 'Ana Sayfa'         },
  { id: 'schedule',   label: 'Haftalık Program'   },
  { id: 'qr-scan',    label: 'Oturum & QR'       },
  { id: 'face-scan',  label: 'Manuel Yoklama'    },
  { id: 'attendance', label: 'Şüpheli Kayıtlar'  },
  { id: 'excuses',    label: 'Mazeretler'        },
  { id: 'disputes',   label: 'İtirazlar'         },
  { id: 'reports',    label: 'Raporlar'           },
  { id: 'register',   label: 'Öğrenci Ekle'      },
  { id: 'students',   label: 'Öğrenciler'        },
  { id: 'settings',   label: 'Ayarlar'           },
];

export const InstructorDashboardPage = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [preselectedStudent, setPreselectedStudent] = useState(null);

  const handleTabChange = (id) => {
    if (id === 'logout') {
      onLogout();
      return;
    }
    setActiveTab(id);
  };

  const handleManualAttendance = (student) => {
    setPreselectedStudent(student);
    setActiveTab('face-scan');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView onNavigate={handleTabChange} />;
      case 'schedule':
        return <WeeklySchedulePage />;
      case 'face-scan':
        return (
          <FaceScan
            preselectedStudent={preselectedStudent}
            onClose={() => { setPreselectedStudent(null); setActiveTab('dashboard'); }}
          />
        );
      case 'qr-scan':
        return <QRScan onClose={() => setActiveTab('dashboard')} />;
      case 'register':
        return <StudentRegistration />;
      case 'attendance':
        return <AttendancePage />;
      case 'excuses':
        return <ExcusesPage />;
      case 'disputes':
        return <DisputeReviewPage />;
      case 'students':
        return <StudentsPage onManualAttendance={handleManualAttendance} />;
      case 'reports':
        return <RecordsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardView onNavigate={handleTabChange} />;
    }
  };

  return (
    <div className="instructor-dashboard-container">
      <Sidebar
        title="Yoklama Sistemi"
        subtitle="Öğretmen Paneli"
        menuItems={INSTRUCTOR_MENU_ITEMS}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        user={user}
        onLogout={onLogout}
      />

      <div className="instructor-main-wrapper">
        <div className="instructor-top-bar">
          <div className="top-bar-spacer" />
          <NotificationBell />
        </div>
        <main className="main-content">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};
