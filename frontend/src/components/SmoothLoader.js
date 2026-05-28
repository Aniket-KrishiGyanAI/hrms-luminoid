import React from 'react';

const SmoothLoader = ({ type = 'spinner', size = 'medium', text = '' }) => {
  const sizeClasses = {
    small: { width: '40px', height: '40px' },
    medium: { width: '60px', height: '60px' },
    large: { width: '80px', height: '80px' }
  };

  const currentSize = sizeClasses[size];

  if (type === 'dots') {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100px' }}>
        <div className="dots-spinner">
          <div className="dot"></div>
          <div className="dot"></div>
          <div className="dot"></div>
        </div>
      </div>
    );
  }

  if (type === 'pulse') {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100px' }}>
        <div className="pulse-spinner" style={currentSize}>
          <div className="pulse-ring"></div>
          <div className="pulse-ring"></div>
          <div className="pulse-ring"></div>
        </div>
      </div>
    );
  }

  if (type === 'bars') {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100px' }}>
        <div className="bars-spinner">
          <div className="bar"></div>
          <div className="bar"></div>
          <div className="bar"></div>
          <div className="bar"></div>
          <div className="bar"></div>
        </div>
      </div>
    );
  }

  // Default gradient spinner
  return (
    <div className="d-flex flex-column justify-content-center align-items-center" style={{ minHeight: '100px' }}>
      <div className="gradient-spinner" style={currentSize}></div>
      {text && <div className="mt-3 text-muted" style={{ fontSize: '0.875rem' }}>{text}</div>}
    </div>
  );
};

export default SmoothLoader;
