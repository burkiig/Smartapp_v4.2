import React from 'react';
import PropTypes from 'prop-types';
import './Button.css';

/**
 * Modern Button Component
 * Variants: primary, secondary, outline, ghost
 */
export const Button = ({
    children,
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    disabled = false,
    loading = false,
    icon,
    onClick,
    type = 'button',
    className = '',
}) => {
    const baseClass = 'btn';
    const variantClass = `btn-${variant}`;
    const sizeClass = `btn-${size}`;
    const widthClass = fullWidth ? 'btn-full' : '';
    const loadingClass = loading ? 'btn-loading' : '';

    return (
        <button
            type={type}
            className={`${baseClass} ${variantClass} ${sizeClass} ${widthClass} ${loadingClass} ${className}`}
            onClick={onClick}
            disabled={disabled || loading}
        >
            {loading && <span className="btn-spinner"></span>}
            {icon && !loading && <span className="btn-icon">{icon}</span>}
            <span className="btn-text">{children}</span>
        </button>
    );
};

Button.propTypes = {
    children: PropTypes.node.isRequired,
    variant: PropTypes.oneOf(['primary', 'secondary', 'outline', 'ghost', 'danger']),
    size: PropTypes.oneOf(['sm', 'md', 'lg']),
    fullWidth: PropTypes.bool,
    disabled: PropTypes.bool,
    loading: PropTypes.bool,
    icon: PropTypes.node,
    onClick: PropTypes.func,
    type: PropTypes.oneOf(['button', 'submit', 'reset']),
    className: PropTypes.string,
};
