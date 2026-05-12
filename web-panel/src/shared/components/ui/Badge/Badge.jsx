import React from 'react';
import './Badge.css';

export const Badge = ({ 
  children, 
  variant = 'default',
  size = 'medium',
  icon,
  className = '',
  label,
}) => {
  const variantClass = `badge--${variant}`;
  const sizeClass = `badge--${size}`;

  return (
    <span
      className={`badge ${variantClass} ${sizeClass} ${className}`}
      role="status"
      aria-label={label || (typeof children === 'string' ? children : undefined)}
    >
      {icon && <span className="badge-icon" aria-hidden="true">{icon}</span>}
      {children}
    </span>
  );
};

