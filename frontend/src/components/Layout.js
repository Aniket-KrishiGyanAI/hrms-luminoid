import React, { useState, useEffect } from 'react';
import { Nav, Navbar, Container, Row, Col, Breadcrumb, Button, Offcanvas, Badge, Dropdown } from 'react-bootstrap';
import { LinkContainer } from 'react-router-bootstrap';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import '../styles/glassmorphism-navbar.css';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [pendingCount, setPendingCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarCollapsed(false);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (['MANAGER', 'HR', 'ADMIN'].includes(user?.role)) {
      fetchPendingCount();
      const interval = setInterval(fetchPendingCount, 60000); // Refresh every minute
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchPendingCount = async () => {
    try {
      const res = await api.get('/api/leave-requests/pending');
      const pending = res.data || [];
      setPendingCount(pending.length);
      setNotifications(pending.slice(0, 5)); // Get top 5 for dropdown
    } catch (error) {
      console.error('Error fetching pending count:', error);
    }
  };

  const getBreadcrumbs = () => {
    const pathnames = location.pathname.split('/').filter(x => x);
    const breadcrumbs = [{ name: 'Home', path: '/dashboard' }];
    
    pathnames.forEach((name, index) => {
      const path = `/${pathnames.slice(0, index + 1).join('/')}`;
      let displayName = name.charAt(0).toUpperCase() + name.slice(1).replace('-', ' ');
      
      // Handle department detail pages - show "Department Details" instead of ID
      if (pathnames[index - 1] === 'departments' && name.length === 24) {
        displayName = 'Department Details';
      }
      
      breadcrumbs.push({
        name: displayName,
        path
      });
    });
    
    return breadcrumbs;
  };

  const getMenuItems = () => {
    const items = [
      { path: '/dashboard', label: 'Dashboard', icon: 'fas fa-tachometer-alt', roles: ['EMPLOYEE', 'MANAGER', 'HR', 'ADMIN'] },
      { path: '/attendance', label: 'Attendance', icon: 'fas fa-clock', roles: ['EMPLOYEE', 'MANAGER', 'HR', 'ADMIN'] }
    ];

    if (user?.role === 'EMPLOYEE') {
      items.push(
        { path: '/apply-leave', label: 'Apply Leave', icon: 'fas fa-plus-circle', roles: ['EMPLOYEE'] },
        { path: '/my-leaves', label: 'My Leaves', icon: 'fas fa-calendar-check', roles: ['EMPLOYEE'] }
      );
    }

    if (['MANAGER', 'HR', 'ADMIN'].includes(user?.role)) {
      items.push(
        { path: '/approvals', label: 'Pending Approvals', icon: 'fas fa-tasks', roles: ['MANAGER', 'HR', 'ADMIN'] },
        { path: '/team-calendar', label: 'Team Calendar', icon: 'fas fa-calendar-alt', roles: ['MANAGER', 'HR', 'ADMIN'] },
        { path: '/employee-directory', label: 'Employee Directory', icon: 'fas fa-users', roles: ['MANAGER', 'HR', 'ADMIN'] }
      );
    }

    if (['HR', 'ADMIN'].includes(user?.role)) {
      items.push(
        { path: '/leave-types', label: 'Leave Types', icon: 'fas fa-cogs', roles: ['HR', 'ADMIN'] },
        { path: '/announcements', label: 'Announcements', icon: 'fas fa-bullhorn', roles: ['HR', 'ADMIN'] },
        { path: '/reports', label: 'Reports', icon: 'fas fa-chart-bar', roles: ['HR', 'ADMIN'] }
      );
    }

    if (user?.role === 'ADMIN') {
      items.push(
        { path: '/departments', label: 'Departments', icon: 'fas fa-sitemap', roles: ['ADMIN'] }
      );
    }

    // Add Files for all users to view
    items.push(
      { path: '/files', label: 'Files & Documents', icon: 'fas fa-folder-open', roles: ['EMPLOYEE', 'MANAGER', 'HR', 'ADMIN'] },
      { path: '/profile', label: 'My Profile', icon: 'fas fa-user-circle', roles: ['EMPLOYEE', 'MANAGER', 'HR'] },
      { path: '/expenses', label: 'Expenses', icon: 'fas fa-receipt', roles: ['EMPLOYEE', 'MANAGER', 'HR', 'ADMIN'] }
    );

    if (['HR', 'ADMIN'].includes(user?.role)) {
      items.push(
        { path: '/assets', label: 'Asset Management', icon: 'fas fa-laptop', roles: ['HR', 'ADMIN'] }
      );
    }

    return items.filter(item => item.roles.includes(user?.role));
  };

  const SidebarContent = () => (
    <>
      <div className="sidebar-brand text-white">
        <div className="d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center">
            <i className="fas fa-building me-2 fs-4"></i>
            {(!sidebarCollapsed || isMobile) && (
              <div>
                <h5 className="mb-0">HRMS Pro</h5>
                <small className="text-light opacity-75">Leave Management</small>
              </div>
            )}
          </div>
          {!isMobile && (
            <Button 
              variant="link" 
              className="text-white p-0"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              <i className={`fas fa-${sidebarCollapsed ? 'chevron-right' : 'chevron-left'}`}></i>
            </Button>
          )}
        </div>
      </div>
      
      <div className="text-white p-3 border-bottom border-secondary">
        <div className="d-flex align-items-center">
          <div className="bg-primary rounded-circle d-flex align-items-center justify-content-center me-3" 
               style={{width: '40px', height: '40px'}}>
            <i className="fas fa-user text-white"></i>
          </div>
          {(!sidebarCollapsed || isMobile) && (
            <div>
              <div className="fw-semibold">{user?.firstName} {user?.lastName}</div>
              <small className="text-light opacity-75">{user?.email}</small>
              <div>
                <span className="badge bg-primary mt-1">{user?.role}</span>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <Nav className="flex-column py-3">
        {getMenuItems().map(item => (
          <LinkContainer key={item.path} to={item.path}>
            <Nav.Link 
              className="text-white-50 d-flex align-items-center"
              onClick={() => isMobile && setShowMobileSidebar(false)}
            >
              <i className={`${item.icon} me-3`}></i>
              {(!sidebarCollapsed || isMobile) && <span>{item.label}</span>}
            </Nav.Link>
          </LinkContainer>
        ))}
        <Nav.Link 
          className="text-white-50 d-flex align-items-center mt-3" 
          onClick={() => {
            logout();
            isMobile && setShowMobileSidebar(false);
          }}
          style={{ cursor: 'pointer' }}
        >
          <i className="fas fa-sign-out-alt me-3"></i>
          {(!sidebarCollapsed || isMobile) && <span>Logout</span>}
        </Nav.Link>
      </Nav>
    </>
  );

  return (
    <div className="app-container">
      {/* Theme Toggle - Hidden since it's now in navbar */}

      {/* Mobile Header */}
      {isMobile && (
        <Navbar bg="primary" variant="dark" className="mobile-header">
          <Button 
            variant="link" 
            className="text-white p-0 me-3"
            onClick={() => setShowMobileSidebar(true)}
          >
            <i className="fas fa-bars fs-4"></i>
          </Button>
          <Navbar.Brand className="mb-0">
            <i className="fas fa-building me-2"></i>
            HRMS Pro
          </Navbar.Brand>
          <Button 
            variant="link" 
            className="text-white p-0 ms-auto"
            onClick={logout}
            title="Logout"
          >
            <i className="fas fa-sign-out-alt fs-5"></i>
          </Button>
        </Navbar>
      )}

      {/* Desktop Sidebar */}
      {!isMobile && (
        <div className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <SidebarContent />
        </div>
      )}

      {/* Mobile Sidebar */}
      <Offcanvas 
        show={showMobileSidebar} 
        onHide={() => setShowMobileSidebar(false)}
        className="sidebar-mobile"
      >
        <Offcanvas.Header closeButton className="text-white">
          <Offcanvas.Title>Menu</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body className="p-0">
          <SidebarContent />
        </Offcanvas.Body>
      </Offcanvas>

      {/* Main Content */}
      <div className={`main-content ${isMobile ? 'mobile' : sidebarCollapsed ? 'collapsed' : ''}`}>

        <div className="content-wrapper">
          {/* Fixed Top Navbar for Desktop */}
          {!isMobile && (
            <div className="top-navbar-enhanced">
              <div className="navbar-section">
                <Breadcrumb className="breadcrumb-modern mb-0">
                  {getBreadcrumbs().map((crumb, index) => (
                    <LinkContainer key={crumb.path} to={crumb.path}>
                      <Breadcrumb.Item active={index === getBreadcrumbs().length - 1}>
                        {crumb.name}
                      </Breadcrumb.Item>
                    </LinkContainer>
                  ))}
                </Breadcrumb>
              </div>
              
              <div className="navbar-actions">
                <div className="action-icon" title="Theme" onClick={toggleTheme} style={{cursor: 'pointer'}}>
                  <i className={`fas fa-${theme === 'light' ? 'moon' : 'sun'}`}></i>
                </div>
                {['MANAGER', 'HR', 'ADMIN'].includes(user?.role) && (
                  <Dropdown align="end">
                    <Dropdown.Toggle as="div" className="action-icon" style={{position: 'relative', cursor: 'pointer'}}>
                      <i className="fas fa-bell"></i>
                      {pendingCount > 0 && (
                        <Badge 
                          bg="danger" 
                          pill 
                          style={{
                            position: 'absolute',
                            top: '-5px',
                            right: '-5px',
                            fontSize: '10px',
                            minWidth: '18px',
                            height: '18px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          {pendingCount > 99 ? '99+' : pendingCount}
                        </Badge>
                      )}
                    </Dropdown.Toggle>
                    <Dropdown.Menu className="notification-dropdown" style={{minWidth: '320px', maxHeight: '400px', overflowY: 'auto'}}>
                      <Dropdown.Header>
                        <div className="d-flex justify-content-between align-items-center">
                          <span className="fw-bold">Notifications</span>
                          <Badge bg="primary" pill>{pendingCount}</Badge>
                        </div>
                      </Dropdown.Header>
                      {notifications.length > 0 ? (
                        <>
                          {notifications.map((notif) => (
                            <Dropdown.Item 
                              key={notif._id} 
                              onClick={() => navigate('/approvals')}
                              className="notification-item"
                            >
                              <div className="d-flex align-items-start">
                                <div className="me-2" style={{color: '#f59e0b'}}>
                                  <i className="fas fa-calendar-alt"></i>
                                </div>
                                <div className="flex-grow-1" style={{fontSize: '0.875rem'}}>
                                  <div className="fw-semibold">
                                    {notif.userId?.firstName} {notif.userId?.lastName}
                                  </div>
                                  <div className="text-muted" style={{fontSize: '0.8rem'}}>
                                    {notif.leaveTypeId?.name} - {notif.days} day(s)
                                  </div>
                                  <small className="text-muted">
                                    {new Date(notif.startDate).toLocaleDateString()}
                                  </small>
                                </div>
                              </div>
                            </Dropdown.Item>
                          ))}
                          <Dropdown.Divider />
                          <Dropdown.Item onClick={() => navigate('/approvals')} className="text-center text-primary fw-semibold">
                            View All ({pendingCount})
                          </Dropdown.Item>
                        </>
                      ) : (
                        <div className="text-center py-4 text-muted">
                          <i className="fas fa-check-circle fs-3 mb-2 d-block"></i>
                          <small>No pending approvals</small>
                        </div>
                      )}
                    </Dropdown.Menu>
                  </Dropdown>
                )}
                <Dropdown align="end">
                  <Dropdown.Toggle as="div" style={{cursor: 'pointer'}}>
                    <div className="user-profile-mini">
                      <div className="profile-avatar-mini">
                        {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                      </div>
                      <div className="profile-info" style={{display: 'flex', flexDirection: 'column'}}>
                        <div className="profile-name" style={{color: '#1e293b', fontWeight: '700', fontSize: '0.9rem'}}>
                          {user?.firstName} {user?.lastName}
                        </div>
                        <div className="profile-role" style={{color: '#64748b', fontWeight: '600', fontSize: '0.75rem'}}>
                          {user?.role}
                        </div>
                      </div>
                    </div>
                  </Dropdown.Toggle>
                  <Dropdown.Menu className="profile-dropdown" style={{minWidth: '220px'}}>
                    <Dropdown.Header style={{
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%) !important',
                      color: 'white',
                      padding: '1.5rem 1rem',
                      borderRadius: '16px 16px 0 0'
                    }}>
                      <div className="text-center">
                        <div className="profile-avatar-large mx-auto mb-2" style={{
                          width: '60px',
                          height: '60px',
                          background: 'rgba(255, 255, 255, 0.25)',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: '1.5rem',
                          fontWeight: 'bold'
                        }}>
                          {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                        </div>
                        <div className="fw-bold">{user?.firstName} {user?.lastName}</div>
                        <small className="text-muted">{user?.email}</small>
                        <div className="mt-1">
                          <Badge style={{
                            background: 'rgba(255, 255, 255, 0.95)',
                            color: '#059669'
                          }}>{user?.role}</Badge>
                        </div>
                      </div>
                    </Dropdown.Header>
                    <Dropdown.Divider />
                    <Dropdown.Item onClick={() => navigate('/profile')}>
                      <i className="fas fa-user me-2"></i>My Profile
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => navigate('/attendance')}>
                      <i className="fas fa-clock me-2"></i>Attendance
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => navigate('/my-leaves')}>
                      <i className="fas fa-calendar-check me-2"></i>My Leaves
                    </Dropdown.Item>
                    <Dropdown.Divider />
                    <Dropdown.Item onClick={toggleTheme}>
                      <i className={`fas fa-${theme === 'light' ? 'moon' : 'sun'} me-2`}></i>
                      {theme === 'light' ? 'Dark' : 'Light'} Mode
                    </Dropdown.Item>
                    <Dropdown.Divider />
                    <Dropdown.Item onClick={logout} className="text-danger">
                      <i className="fas fa-sign-out-alt me-2"></i>Logout
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              </div>
            </div>
          )}
          
          <div className="animate-slide-up">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Layout;