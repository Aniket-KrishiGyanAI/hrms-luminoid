import { lazy, Suspense } from 'react';

// Lazy load pages
export const Dashboard = lazy(() => import('../pages/Dashboard'));
export const EmployeeDirectory = lazy(() => import('../pages/EmployeeDirectory'));
export const LeaveManagement = lazy(() => import('../pages/LeaveManagement'));
export const Attendance = lazy(() => import('../pages/Attendance'));
export const EmployeeProfile = lazy(() => import('../pages/EmployeeProfile'));

// Loading component
export const PageLoader = () => (
  <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
    <div className="spinner-border text-primary" role="status">
      <span className="visually-hidden">Loading...</span>
    </div>
  </div>
);

// Wrapper component
export const LazyPage = ({ children }) => (
  <Suspense fallback={<PageLoader />}>
    {children}
  </Suspense>
);
