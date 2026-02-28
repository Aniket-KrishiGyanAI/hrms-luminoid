import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'react-toastify/dist/ReactToastify.css';
import './styles/custom.css';
import './styles/modern.css';
import './styles/enhanced.css';
import './styles/enhanced-navbar.css';
import './styles/sidebar-dark.css';
import './styles/mobile-responsive.css';
import './styles/desktop-enhanced.css';
import './styles/compact-pages.css';
import './styles/darkmode.css';

import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import EnhancedLayout from './components/EnhancedLayout';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ApplyLeave from './pages/ApplyLeave';
import MyLeaves from './pages/MyLeaves';
import Approvals from './pages/Approvals';
import LeaveTypes from './pages/LeaveTypes';
import EmployeeDirectory from './pages/EmployeeDirectory';
import TeamCalendar from './pages/TeamCalendar';
import Attendance from './pages/Attendance';
import Files from './pages/Files';
import Announcements from './pages/Announcements';
import EmployeeProfile from './pages/EmployeeProfile';
import Expenses from './pages/Expenses';
import Assets from './pages/Assets';
import Reports from './pages/Reports';
import Departments from './pages/Departments';
import DepartmentDetails from './pages/DepartmentDetails';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <div className="App">
            <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <EnhancedLayout>
                  <Dashboard />
                </EnhancedLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/apply-leave" element={
              <ProtectedRoute roles={['EMPLOYEE']}>
                <EnhancedLayout>
                  <ApplyLeave />
                </EnhancedLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/my-leaves" element={
              <ProtectedRoute roles={['EMPLOYEE']}>
                <EnhancedLayout>
                  <MyLeaves />
                </EnhancedLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/approvals" element={
              <ProtectedRoute roles={['MANAGER', 'HR', 'ADMIN']}>
                <EnhancedLayout>
                  <Approvals />
                </EnhancedLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/leave-types" element={
              <ProtectedRoute roles={['HR', 'ADMIN']}>
                <EnhancedLayout>
                  <LeaveTypes />
                </EnhancedLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/employee-directory" element={
              <ProtectedRoute roles={['MANAGER', 'HR', 'ADMIN']}>
                <EnhancedLayout>
                  <EmployeeDirectory />
                </EnhancedLayout>
              </ProtectedRoute>
            } />

            <Route path="/team-calendar" element={
              <ProtectedRoute roles={['MANAGER', 'HR', 'ADMIN']}>
                <EnhancedLayout>
                  <TeamCalendar />
                </EnhancedLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/attendance" element={
              <ProtectedRoute>
                <EnhancedLayout>
                  <Attendance />
                </EnhancedLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/files" element={
              <ProtectedRoute>
                <EnhancedLayout>
                  <Files />
                </EnhancedLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/announcements" element={
              <ProtectedRoute roles={['HR', 'ADMIN']}>
                <EnhancedLayout>
                  <Announcements />
                </EnhancedLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/profile" element={
              <ProtectedRoute>
                <EnhancedLayout>
                  <EmployeeProfile />
                </EnhancedLayout>
              </ProtectedRoute>
            } />
            <Route path="/profile/:id" element={
              <ProtectedRoute>
                <EnhancedLayout>
                  <EmployeeProfile />
                </EnhancedLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/expenses" element={
              <ProtectedRoute>
                <EnhancedLayout>
                  <Expenses />
                </EnhancedLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/assets" element={
              <ProtectedRoute roles={['HR', 'ADMIN']}>
                <EnhancedLayout>
                  <Assets />
                </EnhancedLayout>
              </ProtectedRoute>
            } />

            <Route path="/reports" element={
              <ProtectedRoute roles={['HR', 'ADMIN']}>
                <EnhancedLayout>
                  <Reports />
                </EnhancedLayout>
              </ProtectedRoute>
            } />

            <Route path="/departments" element={
              <ProtectedRoute roles={['ADMIN']}>
                <EnhancedLayout>
                  <Departments />
                </EnhancedLayout>
              </ProtectedRoute>
            } />

            <Route path="/departments/:id" element={
              <ProtectedRoute roles={['ADMIN', 'HR', 'MANAGER']}>
                <EnhancedLayout>
                  <DepartmentDetails />
                </EnhancedLayout>
              </ProtectedRoute>
            } />
          </Routes>
          
          <ToastContainer
            position="top-right"
            autoClose={4000}
            hideProgressBar={false}
            newestOnTop
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="light"
            toastClassName="custom-toast"
          />
        </div>
      </Router>
    </AuthProvider>
  </ThemeProvider>
  );
}

export default App;