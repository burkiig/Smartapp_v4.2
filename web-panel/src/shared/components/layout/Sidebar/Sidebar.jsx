import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [isOpen]);

  const handleNavChange = (id) => {
    onTabChange(id);
    setIsOpen(false);
  };

  return (
    <>
      <button
        className="mobile-menu-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle menu"
      >
        {isOpen ? '✕' : '☰'}
      </button>

      {isOpen && (
        <div className="sidebar-overlay" onClick={() => setIsOpen(false)} />
      )}

      <aside className={`sidebar${isOpen ? ' open' : ''}`}>
        <div className="sidebar-header">
          <h2 className="app-title">{title}</h2>
          {subtitle && <p className="app-subtitle">{subtitle}</p>}
        </div>

        <div className="sidebar-body">
          <nav className="sidebar-nav">
            {menuItems.map((item) => (
              <button
                key={item.id}
                className={`nav-item${activeTab === item.id ? ' active' : ''}${item.id === 'logout' ? ' logout-item' : ''}`}
                onClick={() => handleNavChange(item.id)}
              >
                {item.icon && <span className="nav-icon">{item.icon}</span>}
                <span className="nav-label">{item.label}</span>
                {item.badge && <span className="badge">{item.badge}</span>}
              </button>
            ))}
          </nav>

          {user && (
            <div className="sidebar-user-section">
              <div className="user-info">
                <div className="user-avatar">
                  {user.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="user-details">
                  <div className="user-name">{user.name}</div>
                  {user.department && <div className="user-dept">{user.department}</div>}
                </div>
              </div>
              {onLogout && (
                <button className="logout-btn" onClick={onLogout}>
                  {t('nav.logoutBtn')}
                </button>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
