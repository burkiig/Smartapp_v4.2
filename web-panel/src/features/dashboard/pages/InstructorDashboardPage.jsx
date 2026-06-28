import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sidebar } from '../../../shared/components/layout/Sidebar';
import { NotificationBell } from '../../../shared/components/NotificationBell/NotificationBell';
import { LanguageSwitcher } from '../../../shared/components/LanguageSwitcher/LanguageSwitcher';
import DashboardView from '../components/DashboardView';
import './InstructorDashboardPage.css';

const AttendancePage = lazy(() =>
  import('../../attendance/pages/AttendancePage/AttendancePage').then((module) => ({
    default: module.AttendancePage,
  }))
);
const StudentsPage = lazy(() =>
  import('../../attendance/pages/StudentsPage/StudentsPage').then((module) => ({
    default: module.StudentsPage,
  }))
);
const RecordsPage = lazy(() =>
  import('../../attendance/pages/RecordsPage/RecordsPage').then((module) => ({
    default: module.RecordsPage,
  }))
);
const WeeklySchedulePage = lazy(() =>
  import('../../schedule/pages/WeeklySchedulePage/WeeklySchedulePage').then((module) => ({
    default: module.WeeklySchedulePage,
  }))
);
const SettingsPage = lazy(() =>
  import('../../settings/pages/SettingsPage/SettingsPage').then((module) => ({
    default: module.SettingsPage,
  }))
);
const ExcusesPage = lazy(() =>
  import('../../attendance/pages/ExcusesPage/ExcusesPage').then((module) => ({
    default: module.ExcusesPage,
  }))
);
const DisputeReviewPage = lazy(() =>
  import('../../disputes/DisputeReviewPage').then((module) => ({
    default: module.DisputeReviewPage,
  }))
);
const AuditLogPage = lazy(() =>
  import('../../audit/AuditLogPage').then((module) => ({
    default: module.AuditLogPage,
  }))
);
const FaceScan = lazy(() =>
  import('../../attendance/components/FaceScan').then((module) => ({
    default: module.FaceScan,
  }))
);
const QRScan = lazy(() =>
  import('../../attendance/components/QRScan').then((module) => ({
    default: module.QRScan,
  }))
);
const ClassroomPage = lazy(() =>
  import('../../classroom/ClassroomPage').then((module) => ({
    default: module.ClassroomPage,
  }))
);

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

  const INSTRUCTOR_MENU_ITEMS = useMemo(() => [
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
  ], [t]);

  useEffect(() => {
    if (!triageContext) return;
    setActiveTab('attendance');
  }, [triageContext]);

  const handleTabChange = useCallback((id) => {
    if (id === 'logout') {
      onLogout();
      return;
    }
    setActiveTab(id);
  }, [onLogout]);

  const handleManualAttendance = useCallback((student) => {
    setPreselectedStudent(student);
    setActiveTab('face-scan');
  }, []);

  const tabFallback = useMemo(
    () => <div className="loading-inline">{t('common.loading')}</div>,
    [t]
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView onNavigate={handleTabChange} />;
      case 'schedule':
        return <Suspense fallback={tabFallback}><WeeklySchedulePage /></Suspense>;
      case 'classroom':
        return <Suspense fallback={tabFallback}><ClassroomPage onClose={() => setActiveTab('dashboard')} /></Suspense>;
      case 'face-scan':
        return (
          <Suspense fallback={tabFallback}>
            <FaceScan
              preselectedStudent={preselectedStudent}
              onClose={() => { setPreselectedStudent(null); setActiveTab('dashboard'); }}
            />
          </Suspense>
        );
      case 'qr-scan':
        return <Suspense fallback={tabFallback}><QRScan onClose={() => setActiveTab('dashboard')} /></Suspense>;
      case 'attendance':
        return <Suspense fallback={tabFallback}><AttendancePage triageContext={triageContext} /></Suspense>;
      case 'excuses':
        return <Suspense fallback={tabFallback}><ExcusesPage /></Suspense>;
      case 'disputes':
        return <Suspense fallback={tabFallback}><DisputeReviewPage /></Suspense>;
      case 'audit-logs':
        return <Suspense fallback={tabFallback}><AuditLogPage /></Suspense>;
      case 'students':
        return <Suspense fallback={tabFallback}><StudentsPage onManualAttendance={handleManualAttendance} /></Suspense>;
      case 'reports':
        return <Suspense fallback={tabFallback}><RecordsPage /></Suspense>;
      case 'settings':
        return <Suspense fallback={tabFallback}><SettingsPage /></Suspense>;
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
