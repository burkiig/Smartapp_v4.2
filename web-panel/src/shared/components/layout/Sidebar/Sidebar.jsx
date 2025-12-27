import React from 'react';
import './Sidebar.css';

export const Sidebar = ({ 
  title = "Attendance System",
  subtitle,
  menuItems = [],
  activeTab,
  onTabChange,
  user,
  onLogout
}) => {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2 className="app-title">{title}</h2>
        {subtitle && <p className="app-subtitle">{subtitle}</p>}
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <button
            key={item.id}
            className={activeTab === item.id ? 'nav-item active' : 'nav-item'}
            onClick={() => onTabChange(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
            {item.badge && <span className="badge">{item.badge}</span>}
          </button>
        ))}
      </nav>

      {user && (
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              {user.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="user-details">
              <div className="user-name">{user.name}</div>
              {user.department && <div className="user-dept">{user.department}</div>}
              {user.student_id && <div className="user-id">{user.student_id}</div>}
            </div>
          </div>
          {onLogout && (
            <button className="logout-btn" onClick={onLogout}>
              <span className="logout-icon">🚪</span>
              Logout
            </button>
          )}
        </div>
      )}
    </aside>
  );
};

