import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, roles = [], requireFieldEmployee = false }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return <div className="d-flex justify-content-center p-5">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles.length > 0 && !roles.includes(user?.role)) {
    return <div className="alert alert-danger">Access denied. Insufficient permissions.</div>;
  }

  // Check if field employee access is required
  if (requireFieldEmployee) {
    // Always allow HR and Admin full access
    const hasFullAccess = ['HR', 'ADMIN'].includes(user?.role);
    
    if (hasFullAccess) {
      return children;
    }
    
    // Allow managers to access
    const isManager = user?.role === 'MANAGER';
    
    if (isManager) {
      return children;
    }
    
    // For employees, check if they are field employees
    if (user?.role === 'EMPLOYEE' && !user?.isFieldEmployee) {
      return (
        <div className="container mt-5">
          <div className="alert alert-warning" style={{ borderRadius: 12, padding: '2rem' }}>
            <div style={{ textAlign: 'center' }}>
              <i className="fas fa-lock" style={{ fontSize: '3rem', color: '#f59e0b', marginBottom: '1rem' }} />
              <h4 style={{ fontWeight: 700, marginBottom: '1rem' }}>Field Employee Access Required</h4>
              <p style={{ color: '#64748b', marginBottom: 0 }}>
                This feature is only available for field employees. Please contact your administrator if you need access.
              </p>
            </div>
          </div>
        </div>
      );
    }
    
    // If employee and is field employee, allow access
    if (user?.role === 'EMPLOYEE' && user?.isFieldEmployee) {
      return children;
    }
    
    // Default deny for any other case
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;