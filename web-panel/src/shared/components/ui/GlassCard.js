import React from 'react';
import PropTypes from 'prop-types';
import './GlassCard.css';

/**
 * GlassCard Component
 * Modern glassmorphism card with blur effect
 */
export const GlassCard = ({
    children,
    className = '',
    variant = 'default',
    hover = false,
    onClick,
    style
}) => {
    const variants = {
        default: 'glass-card-default',
        accent: 'glass-card-accent',
        dark: 'glass-card-dark',
    };

    return (
        <div
            className={`glass-card ${variants[variant]} ${hover ? 'glass-card-hover' : ''} ${className}`}
            onClick={onClick}
            style={style}
        >
            {children}
        </div>
    );
};

GlassCard.propTypes = {
    children: PropTypes.node.isRequired,
    className: PropTypes.string,
    variant: PropTypes.oneOf(['default', 'accent', 'dark']),
    hover: PropTypes.bool,
    onClick: PropTypes.func,
    style: PropTypes.object,
};
