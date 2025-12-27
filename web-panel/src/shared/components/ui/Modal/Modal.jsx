import React from 'react';
import './Modal.css';

export const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  subtitle,
  children, 
  size = 'medium',
  showCloseButton = true 
}) => {
  if (!isOpen) return null;

  const sizeClass = `modal--${size}`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal ${sizeClass}`} onClick={(e) => e.stopPropagation()}>
        {(title || showCloseButton) && (
          <div className="modal-header">
            {title && (
              <div>
                <h2 className="modal-title">{title}</h2>
                {subtitle && <p className="modal-subtitle">{subtitle}</p>}
              </div>
            )}
            {showCloseButton && (
              <button className="modal-close-btn" onClick={onClose}>
                ✕
              </button>
            )}
          </div>
        )}
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
};

