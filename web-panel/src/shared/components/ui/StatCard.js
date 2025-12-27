import React from 'react';
import PropTypes from 'prop-types';
import { GlassCard } from './GlassCard';
import './StatCard.css';

/**
 * StatCard Component
 * Glassmorphism card for displaying statistics
 */
export const StatCard = ({
    icon,
    title,
    value,
    subtitle,
    trend,
    trendValue,
    variant = 'default',
    onClick
}) => {
    const getTrendIcon = () => {
        if (!trend) return null;
        if (trend === 'up') return '↗';
        if (trend === 'down') return '↘';
        return '→';
    };

    const getTrendClass = () => {
        if (trend === 'up') return 'trend-up';
        if (trend === 'down') return 'trend-down';
        return 'trend-neutral';
    };

    return (
        <GlassCard
            variant={variant}
            hover={!!onClick}
            onClick={onClick}
            className="stat-card"
        >
            <div className="stat-header">
                {icon && <div className="stat-icon">{icon}</div>}
                <h3 className="stat-title">{title}</h3>
            </div>

            <div className="stat-body">
                <div className="stat-value">{value}</div>
                {subtitle && <div className="stat-subtitle">{subtitle}</div>}
            </div>

            {(trend || trendValue) && (
                <div className={`stat-trend ${getTrendClass()}`}>
                    <span className="trend-icon">{getTrendIcon()}</span>
                    <span className="trend-value">{trendValue}</span>
                </div>
            )}
        </GlassCard>
    );
};

StatCard.propTypes = {
    icon: PropTypes.node,
    title: PropTypes.string.isRequired,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    subtitle: PropTypes.string,
    trend: PropTypes.oneOf(['up', 'down', 'neutral']),
    trendValue: PropTypes.string,
    variant: PropTypes.oneOf(['default', 'accent', 'dark']),
    onClick: PropTypes.func,
};
