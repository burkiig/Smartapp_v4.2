import React from 'react';
import './Badge.css';

export const Badge = ({ 
  children, 
  variant = 'default',
  size = 'medium',
  icon,
  className = ''
}) => {
  const variantClass = `badge--${variant}`;
  const sizeClass = `badge--${size}`;

  return (
    <span className={`badge ${variantClass} ${sizeClass} ${className}`}>
      {icon && <span className="badge-icon">{icon}</span>}
      {children}
    </span>
  );
};

