import React from 'react';
import './Skeleton.css';

export const Skeleton = ({ width = '100%', height = '20px', borderRadius = '4px', className = '' }) => (
  <div 
    className={`skeleton ${className}`}
    style={{ width, height, borderRadius }}
  />
);

export const SkeletonCard = () => (
  <div className="skeleton-card">
    <Skeleton height="200px" borderRadius="12px" />
  </div>
);

export const SkeletonTable = ({ rows = 5, columns = 5 }) => (
  <div className="skeleton-table">
    <div className="skeleton-table-header">
      {[...Array(columns)].map((_, i) => (
        <Skeleton key={i} height="40px" />
      ))}
    </div>
    {[...Array(rows)].map((_, i) => (
      <div key={i} className="skeleton-table-row">
        {[...Array(columns)].map((_, j) => (
          <Skeleton key={j} height="50px" />
        ))}
      </div>
    ))}
  </div>
);

export const SkeletonText = ({ lines = 3 }) => (
  <div className="skeleton-text">
    {[...Array(lines)].map((_, i) => (
      <Skeleton 
        key={i} 
        width={i === lines - 1 ? '60%' : '100%'} 
        height="16px" 
      />
    ))}
  </div>
);

export const SkeletonAvatar = ({ size = '40px' }) => (
  <Skeleton width={size} height={size} borderRadius="50%" />
);

export const SkeletonDashboard = () => (
  <div className="skeleton-dashboard">
    <div className="skeleton-stats">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="skeleton-stat-card">
          <Skeleton height="80px" borderRadius="12px" />
        </div>
      ))}
    </div>
    <div className="skeleton-content">
      <Skeleton height="400px" borderRadius="12px" />
    </div>
  </div>
);

export default Skeleton;
