import React, { lazy, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "bootstrap/dist/css/bootstrap.min.css";
import "react-toastify/dist/ReactToastify.css";
import "./styles/custom.css";
import "./styles/modern.css";
import "./styles/enhanced.css";
import "./styles/enhanced-navbar.css";
import "./styles/sidebar-dark.css";
import "./styles/mobile-responsive.css";
import "./styles/desktop-enhanced.css";
import "./styles/compact-pages.css";
import "./styles/darkmode.css";
import "./styles/smooth-transitions.css";
import "./styles/modern-spinner.css";

import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import ErrorBoundary from "./components/ErrorBoundary";
import ProtectedRoute from "./components/ProtectedRoute";
import EnhancedLayout from "./components/EnhancedLayout";


import Login from "./pages/Login";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const LeaveManagementHub = lazy(() => import("./pages/LeaveManagementHub"));
const OrganizationHub = lazy(() => import("./pages/OrganizationHub"));
const ApplyLeave = lazy(() => import("./pages/ApplyLeave"));
const MyLeaves = lazy(() => import("./pages/MyLeaves"));
const Approvals = lazy(() => import("./pages/Approvals"));
const LeaveTypes = lazy(() => import("./pages/LeaveTypes"));
const EmployeeDirectory = lazy(() => import("./pages/EmployeeDirectory"));
const TeamCalendar = lazy(() => import("./pages/TeamCalendar"));
const Attendance = lazy(() => import("./pages/Attendance"));
const Files = lazy(() => import("./pages/Files"));
const Announcements = lazy(() => import("./pages/Announcements"));
const EmployeeProfile = lazy(() => import("./pages/EmployeeProfile"));
const Expenses = lazy(() => import("./pages/Expenses"));
const Assets = lazy(() => import("./pages/Assets"));
const Reports = lazy(() => import("./pages/Reports"));
const Departments = lazy(() => import("./pages/Departments"));
const DepartmentDetails = lazy(() => import("./pages/DepartmentDetails"));
const Tasks = lazy(() => import("./pages/Tasks"));
const TaskManagement = lazy(() => import("./pages/TaskManagement"));
const TrainingMaterials = lazy(() => import("./pages/TrainingMaterials"));
const FieldVisitsHub = lazy(() => import("./pages/FieldVisitsHub"));
const MyFieldWork = lazy(() => import("./pages/MyFieldWork"));
const TeamFieldActivity = lazy(() => import("./pages/TeamFieldActivity"));
const FpoFormPage = lazy(() => import("./pages/FpoFormPage"));
const FpoSubmissions = lazy(() => import("./pages/FpoSubmissions"));

const LoadingFallback = () => (
  <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "400px", padding: "2rem" }}>
    <div className="modern-spinner">
      <div className="spinner-ring"></div>
      <div className="spinner-ring"></div>
      <div className="spinner-ring"></div>
      <div className="spinner-text">Loading...</div>
    </div>
  </div>
);

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <Router>
            <div className="App">
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />

              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <EnhancedLayout>
                      <Suspense fallback={<LoadingFallback />}>
                        <Dashboard />
                      </Suspense>
                    </EnhancedLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/leave-management"
                element={
                  <ProtectedRoute>
                    <EnhancedLayout>
                      <Suspense fallback={<LoadingFallback />}>
                        <LeaveManagementHub />
                      </Suspense>
                    </EnhancedLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/organization"
                element={
                  <ProtectedRoute roles={["MANAGER", "HR", "ADMIN"]}>
                    <EnhancedLayout>
                      <Suspense fallback={<LoadingFallback />}>
                        <OrganizationHub />
                      </Suspense>
                    </EnhancedLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/apply-leave"
                element={
                  <ProtectedRoute roles={["EMPLOYEE"]}>
                    <EnhancedLayout>
                      <Suspense fallback={<LoadingFallback />}>
                        <ApplyLeave />
                      </Suspense>
                    </EnhancedLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/my-leaves"
                element={
                  <ProtectedRoute roles={["EMPLOYEE"]}>
                    <EnhancedLayout>
                      <Suspense fallback={<LoadingFallback />}>
                        <MyLeaves />
                      </Suspense>
                    </EnhancedLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/approvals"
                element={
                  <ProtectedRoute roles={["MANAGER", "HR", "ADMIN"]}>
                    <EnhancedLayout>
                      <Suspense fallback={<LoadingFallback />}>
                        <Approvals />
                      </Suspense>
                    </EnhancedLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/leave-types"
                element={
                  <ProtectedRoute roles={["HR", "ADMIN"]}>
                    <EnhancedLayout>
                      <Suspense fallback={<LoadingFallback />}>
                        <LeaveTypes />
                      </Suspense>
                    </EnhancedLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/employee-directory"
                element={
                  <ProtectedRoute roles={["MANAGER", "HR", "ADMIN"]}>
                    <EnhancedLayout>
                      <Suspense fallback={<LoadingFallback />}>
                        <EmployeeDirectory />
                      </Suspense>
                    </EnhancedLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/team-calendar"
                element={
                  <ProtectedRoute roles={["MANAGER", "HR", "ADMIN"]}>
                    <EnhancedLayout>
                      <Suspense fallback={<LoadingFallback />}>
                        <TeamCalendar />
                      </Suspense>
                    </EnhancedLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/attendance"
                element={
                  <ProtectedRoute>
                    <EnhancedLayout>
                      <Suspense fallback={<LoadingFallback />}>
                        <Attendance />
                      </Suspense>
                    </EnhancedLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/files"
                element={
                  <ProtectedRoute>
                    <EnhancedLayout>
                      <Suspense fallback={<LoadingFallback />}>
                        <Files />
                      </Suspense>
                    </EnhancedLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/announcements"
                element={
                  <ProtectedRoute roles={["HR", "ADMIN"]}>
                    <EnhancedLayout>
                      <Suspense fallback={<LoadingFallback />}>
                        <Announcements />
                      </Suspense>
                    </EnhancedLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <EnhancedLayout>
                      <Suspense fallback={<LoadingFallback />}>
                        <EmployeeProfile />
                      </Suspense>
                    </EnhancedLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile/:id"
                element={
                  <ProtectedRoute>
                    <EnhancedLayout>
                      <Suspense fallback={<LoadingFallback />}>
                        <EmployeeProfile />
                      </Suspense>
                    </EnhancedLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/expenses"
                element={
                  <ProtectedRoute>
                    <EnhancedLayout>
                      <Suspense fallback={<LoadingFallback />}>
                        <Expenses />
                      </Suspense>
                    </EnhancedLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/assets"
                element={
                  <ProtectedRoute roles={["HR", "ADMIN"]}>
                    <EnhancedLayout>
                      <Suspense fallback={<LoadingFallback />}>
                        <Assets />
                      </Suspense>
                    </EnhancedLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/reports"
                element={
                  <ProtectedRoute roles={["HR", "ADMIN"]}>
                    <EnhancedLayout>
                      <Suspense fallback={<LoadingFallback />}>
                        <Reports />
                      </Suspense>
                    </EnhancedLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/departments"
                element={
                  <ProtectedRoute roles={["ADMIN"]}>
                    <EnhancedLayout>
                      <Suspense fallback={<LoadingFallback />}>
                        <Departments />
                      </Suspense>
                    </EnhancedLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/departments/:id"
                element={
                  <ProtectedRoute roles={["ADMIN", "HR", "MANAGER"]}>
                    <EnhancedLayout>
                      <Suspense fallback={<LoadingFallback />}>
                        <DepartmentDetails />
                      </Suspense>
                    </EnhancedLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/tasks"
                element={
                  <ProtectedRoute>
                    <EnhancedLayout>
                      <Suspense fallback={<LoadingFallback />}>
                        <Tasks />
                      </Suspense>
                    </EnhancedLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/task-management"
                element={
                  <ProtectedRoute roles={["MANAGER", "HR", "ADMIN"]}>
                    <EnhancedLayout>
                      <Suspense fallback={<LoadingFallback />}>
                        <TaskManagement />
                      </Suspense>
                    </EnhancedLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/training"
                element={
                  <ProtectedRoute>
                    <EnhancedLayout>
                      <Suspense fallback={<LoadingFallback />}>
                        <TrainingMaterials />
                      </Suspense>
                    </EnhancedLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/field-visits"
                element={
                  <ProtectedRoute
                    requireFieldEmployee={true}
                    roles={["EMPLOYEE", "MANAGER", "HR", "ADMIN"]}
                  >
                    <EnhancedLayout>
                      <Suspense fallback={<LoadingFallback />}>
                        <FieldVisitsHub />
                      </Suspense>
                    </EnhancedLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/my-field-work"
                element={
                  <ProtectedRoute
                    requireFieldEmployee={true}
                    roles={["EMPLOYEE"]}
                  >
                    <EnhancedLayout>
                      <Suspense fallback={<LoadingFallback />}>
                        <MyFieldWork />
                      </Suspense>
                    </EnhancedLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/team-field-activity"
                element={
                  <ProtectedRoute roles={["MANAGER", "HR", "ADMIN"]}>
                    <EnhancedLayout>
                      <Suspense fallback={<LoadingFallback />}>
                        <TeamFieldActivity />
                      </Suspense>
                    </EnhancedLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/fpo-form"
                element={
                  <ProtectedRoute>
                    <EnhancedLayout>
                      <Suspense fallback={<LoadingFallback />}>
                        <FpoFormPage />
                      </Suspense>
                    </EnhancedLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/fpo-submissions"
                element={
                  <ProtectedRoute>
                    <EnhancedLayout>
                      <Suspense fallback={<LoadingFallback />}>
                        <FpoSubmissions />
                      </Suspense>
                    </EnhancedLayout>
                  </ProtectedRoute>
                }
              />
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
    </ErrorBoundary>
  );
}

export default App;
