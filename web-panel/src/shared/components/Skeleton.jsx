import React from 'react';
import './Skeleton.css';

/**
 * Generic skeleton loader.
 *
 * Usage:
 *   <Skeleton width="100%" height="20px" />
 *   <Skeleton variant="circle" width="40px" height="40px" />
 *   <SkeletonTable rows={5} cols={4} />
 *   <SkeletonStatCard />
 */

export const Skeleton = ({ width = '100%', height = '16px', variant = 'rect', style = {} }) => (
  <span
    className={`skeleton skeleton--${variant}`}
    style={{ width, height, ...style }}
    aria-hidden="true"
  />
);

export const SkeletonStatCard = () => (
  <div className="skeleton-stat-card">
    <Skeleton variant="circle" width="44px" height="44px" />
    <div className="skeleton-stat-body">
      <Skeleton width="60px" height="28px" />
      <Skeleton width="100px" height="14px" style={{ marginTop: '6px' }} />
    </div>
  </div>
);

export const SkeletonTableRow = ({ cols = 4 }) => (
  <tr className="skeleton-tr">
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} style={{ padding: '12px 16px' }}>
        <Skeleton height="14px" width={i === 0 ? '80%' : '60%'} />
      </td>
    ))}
  </tr>
);

export const SkeletonTable = ({ rows = 5, cols = 4 }) => (
  <table className="skeleton-table" aria-label="Yükleniyor...">
    <tbody>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonTableRow key={i} cols={cols} />
      ))}
    </tbody>
  </table>
);
