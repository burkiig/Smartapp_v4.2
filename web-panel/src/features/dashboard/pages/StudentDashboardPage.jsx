import React, { useState, useEffect } from 'react';
import { Sidebar } from '../../../shared/components/layout/Sidebar';
import { StatsCard } from '../../../shared/components/ui/StatsCard';
import { FaceScan } from '../../attendance/components/FaceScan';
import { QRScan } from '../../attendance/components/QRScan';
import './StudentDashboardPage.css';

const STUDENT_MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'face-scan', label: 'Face Scan', icon: '👤' },
  { id: 'qr-scan', label: 'QR Scan', icon: '📱' },
  { id: 'courses', label: 'My Courses', icon: '📚' },
  { id: 'attendance', label: 'Attendance', icon: '✓' },
  { id: 'schedule', label: 'Schedule', icon: '📅' }
];

export const StudentDashboardPage = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [attendanceData, setAttendanceData] = useState([]);
  const [stats, setStats] = useState({
    totalClasses: 0,
    attended: 0,
    percentage: 0,
    thisWeek: 0
  });

  useEffect(() => {
    // Mock data - gerçek uygulamada API'den gelecek
    const mockAttendance = [
      { date: '2024-01-08', course: 'CS101', status: 'present', time: '09:00' },
      { date: '2024-01-08', course: 'CS102', status: 'present', time: '11:00' },
      { date: '2024-01-07', course: 'CS101', status: 'present', time: '09:00' },
      { date: '2024-01-07', course: 'CS103', status: 'absent', time: '14:00' },
      { date: '2024-01-06', course: 'CS102', status: 'present', time: '11:00' },
      { date: '2024-01-05', course: 'CS104', status: 'present', time: '13:00' },
    ];

    setAttendanceData(mockAttendance);

    const attended = mockAttendance.filter(a => a.status === 'present').length;
    const total = mockAttendance.length;
    const percentage = Math.round((attended / total) * 100);

    setStats({
      totalClasses: total,
      attended: attended,
      percentage: percentage,
      thisWeek: 4
    });
  }, []);

  const courses = [
    { code: 'CS101', name: 'Introduction to Programming', attendance: 95 },
    { code: 'CS102', name: 'Data Structures', attendance: 90 },
    { code: 'CS103', name: 'Algorithms', attendance: 85 },
    { code: 'CS104', name: 'Database Systems', attendance: 92 }
  ];

  const renderDashboard = () => (
    <div className="student-overview">
      <div className="page-header">
        <div>
          <h1>Welcome back, {user.name}!</h1>
          <p className="page-subtitle">Student ID: {user.student_id}</p>
        </div>
      </div>

      <div className="stats-grid">
        <StatsCard
          icon="📊"
          title="Overall Attendance"
          value={`${stats.percentage}%`}
          color="blue"
          trend={stats.percentage >= 75 ? 'up' : 'down'}
          size="large"
        />
        <StatsCard
          icon="✓"
          title="Classes Attended"
          value={stats.attended}
          subtitle={`Out of ${stats.totalClasses} classes`}
          color="green"
        />
        <StatsCard
          icon="📅"
          title="Total Classes"
          value={stats.totalClasses}
          color="purple"
        />
        <StatsCard
          icon="📆"
          title="This Week"
          value={stats.thisWeek}
          subtitle="Classes attended"
          color="orange"
        />
      </div>

      <div className="content-grid">
        <div className="card">
          <div className="card-header">
            <h2>My Courses</h2>
            <span className="badge">{courses.length} Courses</span>
          </div>
          <div className="courses-list">
            {courses.map((course) => (
              <div key={course.code} className="course-item">
                <div className="course-info">
                  <div className="course-code">{course.code}</div>
                  <div className="course-name">{course.name}</div>
                </div>
                <div className="course-attendance">
                  <div className="attendance-bar">
                    <div
                      className="attendance-fill"
                      style={{
                        width: `${course.attendance}%`,
                        background: course.attendance >= 75 ? '#10b981' : '#ef4444'
                      }}
                    ></div>
                  </div>
                  <span className="attendance-percentage">{course.attendance}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Recent Attendance</h2>
          </div>
          <div className="attendance-list">
            {attendanceData.slice(0, 5).map((record, index) => (
              <div key={index} className="attendance-record">
                <div className="record-icon">
                  {record.status === 'present' ? '✓' : '✗'}
                </div>
                <div className="record-info">
                  <div className="record-course">{record.course}</div>
                  <div className="record-meta">
                    {record.date} • {record.time}
                  </div>
                </div>
                <span className={`status-badge ${record.status}`}>
                  {record.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderCourses = () => (
    <div className="student-courses">
      <div className="page-header">
        <h1>My Courses</h1>
      </div>
      <div className="courses-grid">
        {courses.map(course => (
          <div key={course.code} className="course-card">
            <div className="course-card-header">
              <h3>{course.code}</h3>
              <span className={`attendance-badge ${course.attendance >= 75 ? 'good' : 'warning'}`}>
                {course.attendance}%
              </span>
            </div>
            <div className="course-card-body">
              <p className="course-title">{course.name}</p>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${course.attendance}%`,
                    background: course.attendance >= 75 ? '#10b981' : '#ef4444'
                  }}
                ></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderAttendance = () => (
    <div className="student-attendance">
      <div className="page-header">
        <h1>Attendance History</h1>
      </div>
      <div className="attendance-table-container">
        <table className="attendance-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Course</th>
              <th>Time</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {attendanceData.map((record, index) => (
              <tr key={index}>
                <td>{record.date}</td>
                <td>{record.course}</td>
                <td>{record.time}</td>
                <td>
                  <span className={`status-badge ${record.status}`}>
                    {record.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderSchedule = () => (
    <div className="student-schedule">
      <div className="page-header">
        <h1>My Schedule</h1>
      </div>
      <div className="schedule-info">
        <p>Schedule view coming soon...</p>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return renderDashboard();
      case 'face-scan':
        return <FaceScan onClose={() => setActiveTab('dashboard')} />;
      case 'qr-scan':
        return <QRScan onClose={() => setActiveTab('dashboard')} />;
      case 'courses':
        return renderCourses();
      case 'attendance':
        return renderAttendance();
      case 'schedule':
        return renderSchedule();
      default:
        return renderDashboard();
    }
  };

  return (
    <div className="student-dashboard-container">
      <Sidebar
        title="Attendance System"
        subtitle="Student Portal"
        menuItems={STUDENT_MENU_ITEMS}
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

