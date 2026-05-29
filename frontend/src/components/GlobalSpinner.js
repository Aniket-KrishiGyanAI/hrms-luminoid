import React from 'react';
import '../styles/modern-spinner.css';

const GlobalSpinner = ({ size = 'medium', fullScreen = false, text = '' }) => {
  const sizes = {
    small: '40px',
    medium: '60px',
    large: '80px'
  };

  const spinnerSize = sizes[size] || sizes.medium;

  if (fullScreen) {
    return (
      <div className="global-spinner-overlay">
        <div className="global-spinner-container">
          <div className="gradient-spinner" style={{ width: spinnerSize, height: spinnerSize }}></div>
          {text && <div className="spinner-text">{text}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="global-spinner-inline">
      <div className="gradient-spinner" style={{ width: spinnerSize, height: spinnerSize }}></div>
      {text && <div className="spinner-text">{text}</div>}
    </div>
  );
};

export default GlobalSpinner;
