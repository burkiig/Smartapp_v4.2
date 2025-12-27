import React, { useState, useEffect } from 'react';
import { Sidebar } from '../../../shared/components/layout/Sidebar';
import { StatsCard } from '../../../shared/components/ui/StatsCard';
import './AdminDashboardPage.css';

const ADMIN_MENU_ITEMS = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'users', label: 'Users', icon: '👥' },
  { id: 'courses', label: 'Courses', icon: '📚' },
  { id: 'rooms', label: 'Rooms', icon: '🏢' },
  { id: 'system', label: 'System', icon: '⚙️' }
];

export const AdminDashboardPage = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalInstructors: 0,
    totalStudents: 0,
    totalClasses: 0,
    systemHealth: 98
  });

  const [users] = useState([
    { id: 1, username: 'admin', name: 'System Administrator', role: 'admin', email: 'admin@attendance.com', status: 'active' },
    { id: 2, username: 'instructor1', name: 'Dr. Robert Chen', role: 'instructor', email: 'robert.chen@university.edu', status: 'active', department: 'Computer Science' },
    { id: 3, username: 'student1', name: 'John Doe', role: 'student', email: 'john.doe@student.edu', status: 'active', studentId: '2021001' },
  ]);

  const [courses] = useState([
    { id: 1, code: 'CS101', name: 'Introduction to Programming', instructor: 'Dr. Robert Chen', students: 45, schedule: 'Mon, Wed 09:00-10:30', room: 'A-101' },
    { id: 2, code: 'CS102', name: 'Data Structures', instructor: 'Dr. Sarah Johnson', students: 38, schedule: 'Tue, Thu 11:00-12:30', room: 'B-205' },
    { id: 3, code: 'CS103', name: 'Algorithms', instructor: 'Dr. Michael Brown', students: 42, schedule: 'Mon, Wed 14:00-15:30', room: 'C-301' },
    { id: 4, code: 'CS104', name: 'Database Systems', instructor: 'Dr. Robert Chen', students: 40, schedule: 'Tue, Thu 13:00-14:30', room: 'A-102' },
  ]);

  const [rooms] = useState([
    { id: 1, name: 'A-101', capacity: 50, type: 'Lecture Hall', equipment: 'Projector, Whiteboard', status: 'available' },
    { id: 2, name: 'A-102', capacity: 45, type: 'Lecture Hall', equipment: 'Projector, Whiteboard', status: 'available' },
    { id: 3, name: 'B-205', capacity: 40, type: 'Computer Lab', equipment: 'Projector, 40 PCs', status: 'occupied' },
    { id: 4, name: 'C-301', capacity: 60, type: 'Lecture Hall', equipment: 'Projector, Whiteboard, Audio System', status: 'available' },
  ]);

  const [activities, setActivities] = useState([]);

  useEffect(() => {
    fetchStats();
    fetchActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, courses]);

  const fetchStats = () => {
    setStats({
      totalUsers: users.length,
      totalInstructors: users.filter(u => u.role === 'instructor').length,
      totalStudents: users.filter(u => u.role === 'student').length,
      totalClasses: courses.length,
      systemHealth: 98
    });
  };

  const fetchActivities = () => {
    const mockActivities = [
      { type: 'user', action: 'New instructor registered', user: 'Dr. Sarah Johnson', time: '5 mins ago', icon: '👨‍🏫' },
      { type: 'system', action: 'System backup completed', user: 'System', time: '1 hour ago', icon: '💾' },
      { type: 'attendance', action: 'Bulk attendance recorded', user: 'CS101', time: '2 hours ago', icon: '✓' },
      { type: 'user', action: 'New student enrolled', user: 'Jane Smith', time: '3 hours ago', icon: '🎓' },
      { type: 'system', action: 'Database optimized', user: 'System', time: '5 hours ago', icon: '⚙️' },
    ];
    setActivities(mockActivities);
  };

  const renderOverview = () => (
    <div className="admin-overview">
      <div className="page-header">
        <h1>System Overview</h1>
        <p className="page-subtitle">Monitor and manage your attendance system</p>
      </div>

      <div className="stats-grid">
        <StatsCard
          icon="👥"
          title="Total Users"
          value={stats.totalUsers}
          color="blue"
          trend="up"
          trendValue="+12%"
        />
        <StatsCard
          icon="👨‍🏫"
          title="Instructors"
          value={stats.totalInstructors}
          color="purple"
          trend="neutral"
        />
        <StatsCard
          icon="🎓"
          title="Students"
          value={stats.totalStudents}
          color="green"
          trend="up"
          trendValue="+8%"
        />
        <StatsCard
          icon="📚"
          title="Active Courses"
          value={stats.totalClasses}
          color="orange"
        />
        <StatsCard
          icon="💚"
          title="System Health"
          value={`${stats.systemHealth}%`}
          color="green"
          trend="up"
        />
      </div>

      <div className="content-grid">
        <div className="card">
          <div className="card-header">
            <h2>Recent Activity</h2>
          </div>
          <div className="activity-list">
            {activities.map((activity, index) => (
              <div key={index} className="activity-item">
                <span className="activity-icon">{activity.icon}</span>
                <div className="activity-content">
                  <div className="activity-action">{activity.action}</div>
                  <div className="activity-meta">
                    <span className="activity-user">{activity.user}</span>
                    <span className="activity-time">{activity.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Quick Stats</h2>
          </div>
          <div className="quick-stats">
            <div className="quick-stat-item">
              <span className="quick-stat-label">Available Rooms</span>
              <span className="quick-stat-value">{rooms.filter(r => r.status === 'available').length}/{rooms.length}</span>
            </div>
            <div className="quick-stat-item">
              <span className="quick-stat-label">Active Courses</span>
              <span className="quick-stat-value">{courses.length}</span>
            </div>
            <div className="quick-stat-item">
              <span className="quick-stat-label">Total Capacity</span>
              <span className="quick-stat-value">{rooms.reduce((sum, r) => sum + r.capacity, 0)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderUsers = () => (
    <div className="admin-users">
      <div className="page-header">
        <h1>User Management</h1>
        <button className="btn-primary">+ Add User</button>
      </div>
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Username</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td>{user.username}</td>
                <td>{user.email}</td>
                <td><span className={`role-badge ${user.role}`}>{user.role}</span></td>
                <td><span className={`status-badge ${user.status}`}>{user.status}</span></td>
                <td>
                  <button className="btn-icon">✏️</button>
                  <button className="btn-icon">🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderCourses = () => (
    <div className="admin-courses">
      <div className="page-header">
        <h1>Course Management</h1>
        <button className="btn-primary">+ Add Course</button>
      </div>
      <div className="courses-grid">
        {courses.map(course => (
          <div key={course.id} className="course-card">
            <div className="course-header">
              <h3>{course.code}</h3>
              <span className="student-count">{course.students} students</span>
            </div>
            <div className="course-body">
              <p className="course-name">{course.name}</p>
              <p className="course-instructor">👨‍🏫 {course.instructor}</p>
              <p className="course-schedule">📅 {course.schedule}</p>
              <p className="course-room">🏢 {course.room}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderRooms = () => (
    <div className="admin-rooms">
      <div className="page-header">
        <h1>Room Management</h1>
        <button className="btn-primary">+ Add Room</button>
      </div>
      <div className="rooms-grid">
        {rooms.map(room => (
          <div key={room.id} className={`room-card ${room.status}`}>
            <div className="room-header">
              <h3>{room.name}</h3>
              <span className={`status-indicator ${room.status}`}></span>
            </div>
            <div className="room-body">
              <p>📏 Capacity: {room.capacity}</p>
              <p>🏛️ Type: {room.type}</p>
              <p>🔧 {room.equipment}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderSystem = () => (
    <div className="admin-system">
      <div className="page-header">
        <h1>System Settings</h1>
      </div>
      <div className="system-cards">
        <div className="card">
          <h3>System Health</h3>
          <div className="health-indicator">
            <div className="health-bar" style={{ width: `${stats.systemHealth}%` }}></div>
          </div>
          <p>{stats.systemHealth}% - Excellent</p>
        </div>
        <div className="card">
          <h3>Database</h3>
          <button className="btn-secondary">Backup Now</button>
          <p className="text-muted">Last backup: 1 hour ago</p>
        </div>
        <div className="card">
          <h3>Maintenance</h3>
          <button className="btn-secondary">Run Optimization</button>
          <p className="text-muted">Last run: 5 hours ago</p>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverview();
      case 'users':
        return renderUsers();
      case 'courses':
        return renderCourses();
      case 'rooms':
        return renderRooms();
      case 'system':
        return renderSystem();
      default:
        return renderOverview();
    }
  };

  return (
    <div className="admin-dashboard-container">
      <Sidebar
        title="Attendance System"
        subtitle="Admin Panel"
        menuItems={ADMIN_MENU_ITEMS}
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

