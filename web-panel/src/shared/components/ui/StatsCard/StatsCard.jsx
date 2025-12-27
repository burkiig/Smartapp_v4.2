import React from 'react';
import './StatsCard.css';

export const StatsCard = ({ 
  icon, 
  title, 
  value, 
  subtitle, 
  trend,
  trendValue,
  color = 'blue',
  size = 'medium'
}) => {
  const getTrendIcon = () => {
    if (trend === 'up') return '📈';
    if (trend === 'down') return '📉';
    return '➡️';
  };

  const getTrendClass = () => {
    if (trend === 'up') return 'trend-up';
    if (trend === 'down') return 'trend-down';
    return 'trend-neutral';
  };

  return (
    <div className={`stats-card stats-card--${color} stats-card--${size}`}>
      <div className="stats-card__header">
        <div className="stats-card__icon">{icon}</div>
        {trend && (
          <div className={`stats-card__trend ${getTrendClass()}`}>
            <span className="trend-icon">{getTrendIcon()}</span>
            {trendValue && <span className="trend-value">{trendValue}</span>}
          </div>
        )}
      </div>
      
      <div className="stats-card__body">
        <div className="stats-card__value">{value}</div>
        <div className="stats-card__title">{title}</div>
        {subtitle && <div className="stats-card__subtitle">{subtitle}</div>}
      </div>
    </div>
  );
};

