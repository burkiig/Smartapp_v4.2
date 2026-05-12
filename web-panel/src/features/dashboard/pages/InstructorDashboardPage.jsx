import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sidebar } from '../../../shared/components/layout/Sidebar';
import { NotificationBell } from '../../../shared/components/NotificationBell/NotificationBell';
import { LanguageSwitcher } from '../../../shared/components/LanguageSwitcher/LanguageSwitcher';
import DashboardView from '../components/DashboardView';
import { AttendancePage } from '../../attendance/pages';
import { StudentsPage } from '../../attendance/pages/StudentsPage';
import { RecordsPage } from '../../attendance/pages/RecordsPage';
import { WeeklySchedulePage } from '../../schedule/pages/WeeklySchedulePage';
import { SettingsPage } from '../../settings/pages/SettingsPage';
import { ExcusesPage } from '../../attendance/pages/ExcusesPage';
import { DisputeReviewPage } from '../../disputes/DisputeReviewPage';
import { AuditLogPage } from '../../audit/AuditLogPage';
import { FaceScan } from '../../attendance/components/FaceScan';
import { QRScan } from '../../attendance/components/QRScan';
import { ClassroomPage } from '../../classroom/ClassroomPage';
import './InstructorDashboardPage.css';

/**
 * Reads URL parameters and returns flagged triage context if present.
 */
const readTriageContextFromUrl = () => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  const filter = params.get('filter');
  const sessionId = params.get('session_id');
  if (tab !== 'attendance' || filter !== 'flagged' || !sessionId) return null;
  return { tab, filter, sessionId: String(sessionId) };
};

/** Reads the ?tab= query param for direct deep-link navigation from notifications. */
const readTabFromUrl = () => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  const validTabs = [
    'dashboard', 'schedule', 'classroom', 'qr-scan', 'face-scan',
    'attendance', 'excuses', 'disputes', 'audit-logs', 'reports',
    'students', 'settings',
  ];
  return validTabs.includes(tab) ? tab : null;
};

export const InstructorDashboardPage = ({ user, onLogout }) => {
  const { t } = useTranslation();
  const initialTab = useMemo(() => readTabFromUrl() || 'dashboard', []);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [preselectedStudent, setPreselectedStudent] = useState(null);
  const triageContext = useMemo(() => readTriageContextFromUrl(), []);

  const INSTRUCTOR_MENU_ITEMS = [
    { id: 'dashboard',  label: t('nav.instructor.dashboard')  },
    { id: 'schedule',   label: t('nav.instructor.schedule')   },
    { id: 'classroom',  label: t('nav.instructor.classroom')  },
    { id: 'qr-scan',    label: t('nav.instructor.qrScan')     },
    { id: 'face-scan',  label: t('nav.instructor.faceScan')   },
    { id: 'attendance', label: t('nav.instructor.attendance') },
    { id: 'excuses',    label: t('nav.instructor.excuses')    },
    { id: 'disputes',   label: t('nav.instructor.disputes')   },
    { id: 'audit-logs', label: t('nav.instructor.auditLogs')  },
    { id: 'reports',    label: t('nav.instructor.reports')    },
    { id: 'students',   label: t('nav.instructor.students')   },
    { id: 'settings',   label: t('nav.instructor.settings')   },
  ];

  useEffect(() => {
    if (!triageContext) return;
    setActiveTab('attendance');
  }, [triageContext]);

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
      case 'classroom':
        return <ClassroomPage onClose={() => setActiveTab('dashboard')} />;
      case 'face-scan':
        return (
          <FaceScan
            preselectedStudent={preselectedStudent}
            onClose={() => { setPreselectedStudent(null); setActiveTab('dashboard'); }}
          />
        );
      case 'qr-scan':
        return <QRScan onClose={() => setActiveTab('dashboard')} />;
      case 'attendance':
        return <AttendancePage triageContext={triageContext} />;
      case 'excuses':
        return <ExcusesPage />;
      case 'disputes':
        return <DisputeReviewPage />;
      case 'audit-logs':
        return <AuditLogPage />;
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
        title={t('nav.systemTitle')}
        subtitle={t('nav.instructorPanel')}
        menuItems={INSTRUCTOR_MENU_ITEMS}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        user={user}
        onLogout={onLogout}
      />

      <div className="instructor-main-wrapper">
        <div className="instructor-top-bar">
          <div className="top-bar-spacer" />
          <LanguageSwitcher compact />
          <NotificationBell />
        </div>
        <main className="main-content">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};
