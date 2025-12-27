import React from 'react';
import './RoleSelector.css';

const roles = [
  { id: 'instructor', name: 'Instructor', icon: '👨‍🏫', color: '#4f46e5' },
  { id: 'student', name: 'Student', icon: '🎓', color: '#059669' },
  { id: 'admin', name: 'Admin', icon: '⚙️', color: '#dc2626' }
];

export const RoleSelector = ({ selectedRole, onRoleChange }) => {
  return (
    <div className="role-selector">
      {roles.map((role) => (
        <button
          key={role.id}
          type="button"
          className={`role-button ${selectedRole === role.id ? 'active' : ''}`}
          onClick={() => onRoleChange(role.id)}
          style={{
            '--role-color': role.color
          }}
        >
          <span className="role-icon">{role.icon}</span>
          <span className="role-name">{role.name}</span>
        </button>
      ))}
    </div>
  );
};
