import React, { useState, useEffect } from 'react';
import { Nav, Navbar, Container, Row, Col, Breadcrumb, Button, Offcanvas, Badge, Dropdown } from 'react-bootstrap';
import { LinkContainer } from 'react-router-bootstrap';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { 
  MdDashboard, MdAccessTime, MdEventAvailable, MdCalendarToday, 
  MdPeople, MdSettings, MdCampaign, MdBarChart, MdAccountTree,
  MdFolder, MdPerson, MdReceipt, MdLaptop, MdNotifications,
  MdBrightness4, MdBrightness7, MdMenu, MdLogout, MdHome,
  MdTask, MdCheckCircle, MdAddCircle, MdBusiness, MdAssignment
} from 'react-icons/md';
import '../styles/glassmorphism-navbar.css';
import '../styles/modern-layout.css';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [pendingCount, setPendingCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const markAsRead = async () => {
    setNotifications([]);
    setPendingCount(0);
    setShowNotifications(false);
    
    // Show success feedback
    const toast = document.createElement('div');
    toast.innerHTML = 'All notifications cleared!';
    toast.style.cssText = 'position:fixed;top:20px;right:20px;background:#10b981;color:white;padding:1rem 1.5rem;border-radius:12px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.15);font-weight:600;';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  };

  const clearSingleNotification = (notifId, e) => {
    e.stopPropagation();
    setNotifications(prev => prev.filter(n => n._id !== notifId));
    setPendingCount(prev => Math.max(0, prev - 1));
  };

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
      const interval = setInterval(fetchPendingCount, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchPendingCount = async () => {
    try {
      const res = await api.get('/api/leave-requests/pending');
      const pending = res.data || [];
      const newCount = pending.length;
      
      // Show notification if count increased
      if (newCount > pendingCount && pendingCount > 0) {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('New Leave Request', {
            body: `You have ${newCount} pending approval(s)`,
            icon: '/favicon.ico'
          });
        }
      }
      
      setPendingCount(newCount);
      setNotifications(pending.slice(0, 5));
    } catch (error) {
      console.error('Error fetching pending count:', error);
    }
  };

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

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
      { path: '/dashboard', label: 'Dashboard', icon: MdDashboard, roles: ['EMPLOYEE', 'MANAGER', 'HR', 'ADMIN'] },
      { path: '/attendance', label: 'Attendance', icon: MdAccessTime, roles: ['EMPLOYEE', 'MANAGER', 'HR', 'ADMIN'] },
      { path: '/leave-management', label: 'Leave Management', icon: MdCalendarToday, roles: ['EMPLOYEE', 'MANAGER', 'HR', 'ADMIN'] }
    ];

    if (['MANAGER', 'HR', 'ADMIN'].includes(user?.role)) {
      items.push(
        { path: '/organization', label: 'Organization', icon: MdPeople, roles: ['MANAGER', 'HR', 'ADMIN'] }
      );
    }

    if (['HR', 'ADMIN'].includes(user?.role)) {
      items.push(
        { path: '/leave-types', label: 'Leave Types', icon: MdSettings, roles: ['HR', 'ADMIN'] },
        { path: '/announcements', label: 'Announcements', icon: MdCampaign, roles: ['HR', 'ADMIN'] },
        { path: '/reports', label: 'Reports', icon: MdBarChart, roles: ['HR', 'ADMIN'] }
      );
    }

    items.push(
      { path: '/files', label: 'Files & Documents', icon: MdFolder, roles: ['EMPLOYEE', 'MANAGER', 'HR', 'ADMIN'] },
      { path: '/profile', label: 'My Profile', icon: MdPerson, roles: ['EMPLOYEE', 'MANAGER', 'HR'] },
      { path: '/expenses', label: 'Expenses', icon: MdReceipt, roles: ['EMPLOYEE', 'MANAGER', 'HR', 'ADMIN'] }
    );

    if (['HR', 'ADMIN'].includes(user?.role)) {
      items.push(
        { path: '/assets', label: 'Asset Management', icon: MdLaptop, roles: ['HR', 'ADMIN'] }
      );
    }

    return items.filter(item => item.roles.includes(user?.role));
  };

  const SidebarContent = () => (
    <>
      <div className="sidebar-brand text-white">
        <div className="d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center">
            <MdBusiness size={28} className="me-2" />
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
               style={{width: '40px', height: '40px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: '2px solid rgba(255, 255, 255, 0.3)'}}>
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
        {getMenuItems().map(item => {
          const IconComponent = item.icon;
          return (
            <LinkContainer key={item.path} to={item.path}>
              <Nav.Link 
                className="text-white-50 d-flex align-items-center"
                onClick={() => isMobile && setShowMobileSidebar(false)}
              >
                <IconComponent size={20} className="me-3" />
                {(!sidebarCollapsed || isMobile) && <span>{item.label}</span>}
              </Nav.Link>
            </LinkContainer>
          );
        })}
        <Nav.Link 
          className="text-white-50 d-flex align-items-center mt-3" 
          onClick={() => {
            logout();
            isMobile && setShowMobileSidebar(false);
          }}
          style={{ cursor: 'pointer' }}
        >
          <MdLogout size={20} className="me-3" />
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
        <Navbar variant="dark" className="mobile-header" style={{background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'}}>
          <Button 
            variant="link" 
            className="text-white p-0 me-3"
            onClick={() => setShowMobileSidebar(true)}
          >
            <MdMenu size={24} />
          </Button>
          <Navbar.Brand className="mb-0">
            <MdBusiness size={24} className="me-2" />
            HRMS Pro
          </Navbar.Brand>
          <div className="d-flex align-items-center gap-2">
            {['MANAGER', 'HR', 'ADMIN'].includes(user?.role) && (
              <Button 
                variant="link" 
                className="text-white p-0 position-relative"
                onClick={() => setShowNotifications(true)}
              >
                <MdNotifications size={22} className={pendingCount > 0 ? 'notification-bell-animate' : ''} />
                {pendingCount > 0 && (
                  <Badge 
                    bg="danger" 
                    pill 
                    className="badge-pulse"
                    style={{
                      position: 'absolute',
                      top: '-5px',
                      right: '-5px',
                      fontSize: '9px',
                      minWidth: '16px',
                      height: '16px'
                    }}
                  >
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </Badge>
                )}
              </Button>
            )}
            <Button 
              variant="link" 
              className="text-white p-0"
              onClick={logout}
              title="Logout"
            >
              <MdLogout size={22} />
            </Button>
          </div>
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
        className="mobile-sidebar-offcanvas"
      >
        <Offcanvas.Body className="p-0 d-flex flex-column" style={{background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)', height: '100%'}}>
          {/* Header with Close Button */}
          <div className="mobile-sidebar-header">
            <div className="d-flex align-items-center gap-2">
              <MdBusiness size={20} color="#f59e0b" />
              <div>
                <div className="fw-bold text-white" style={{fontSize: '0.875rem', lineHeight: 1.2}}>HRMS Pro</div>
                <div style={{fontSize: '0.6rem', color: '#94a3b8'}}>Leave Management</div>
              </div>
            </div>
            <button className="mobile-sidebar-close-btn" onClick={() => setShowMobileSidebar(false)} title="Close">
              <MdLogout size={18} style={{transform: 'rotate(180deg)'}} />
            </button>
          </div>

          {/* User Info */}
          <div className="mobile-sidebar-user">
            <div className="mobile-sidebar-avatar">
              {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
            </div>
            <div style={{minWidth: 0, flex: 1}}>
              <div className="fw-bold text-white" style={{fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                {user?.firstName} {user?.lastName}
              </div>
              <div style={{fontSize: '0.65rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{user?.email}</div>
              <span className="mobile-sidebar-role-badge">{user?.role}</span>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="mobile-sidebar-nav flex-grow-1">
            {getMenuItems().map(item => {
              const IconComponent = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <LinkContainer key={item.path} to={item.path}>
                  <a
                    className={`mobile-sidebar-nav-item${isActive ? ' active' : ''}`}
                    onClick={() => setShowMobileSidebar(false)}
                  >
                    <IconComponent size={17} />
                    <span>{item.label}</span>
                    {item.path === '/leave-management' && pendingCount > 0 && (
                      <Badge bg="warning" pill style={{fontSize: '0.55rem', marginLeft: 'auto', padding: '0.15rem 0.4rem'}}>{pendingCount}</Badge>
                    )}
                  </a>
                </LinkContainer>
              );
            })}
          </nav>

          {/* Footer Logout */}
          <div className="mobile-sidebar-footer">
            <button
              className="mobile-sidebar-logout"
              onClick={() => { logout(); setShowMobileSidebar(false); }}
            >
              <MdLogout size={17} />
              <span>Logout</span>
            </button>
          </div>
        </Offcanvas.Body>
      </Offcanvas>

      {/* Mobile Notifications */}
      <Offcanvas 
        show={showNotifications} 
        onHide={() => setShowNotifications(false)}
        placement="end"
        className="mobile-notification-panel"
      >
        <Offcanvas.Header closeButton style={{background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: 'white', borderBottom: 'none'}}>
          <Offcanvas.Title className="d-flex align-items-center gap-2 w-100">
            <MdNotifications size={24} />
            <span className="fw-bold">Leave Requests</span>
            {pendingCount > 0 && (
              <Badge bg="light" text="dark" className="ms-auto badge-pulse">{pendingCount}</Badge>
            )}
          </Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body className="p-0">
          {notifications.length > 0 ? (
            <>
              <div className="notification-list">
                {notifications.map((notif) => (
                  <div 
                    key={notif._id} 
                    onClick={() => { navigate('/leave-management?tab=approvals'); setShowNotifications(false); }}
                    className="notification-card"
                  >
                    <div className="d-flex align-items-start gap-3">
                      <div className="notification-icon-wrapper">
                        <MdCalendarToday size={22} />
                      </div>
                      <div className="flex-grow-1">
                        <div className="fw-bold mb-1" style={{color: '#1e293b'}}>
                          {notif.userId?.firstName} {notif.userId?.lastName}
                        </div>
                        <div className="text-muted mb-1" style={{fontSize: '0.875rem'}}>
                          {notif.leaveTypeId?.name} • {notif.days} day(s)
                        </div>
                        <div className="notification-time">
                          {new Date(notif.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </div>
                      <Button 
                        variant="link" 
                        className="p-1 text-danger" 
                        onClick={(e) => clearSingleNotification(notif._id, e)}
                        style={{minWidth: '32px', fontSize: '1.2rem', lineHeight: 1}}
                        title="Clear"
                      >
                        ×
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="notification-actions">
                <div className="d-grid gap-2">
                  <button className="btn btn-mark-read" onClick={markAsRead}>
                    <MdCheckCircle size={20} className="me-2" />
                    Mark All as Read
                  </button>
                  <button className="btn btn-view-all" onClick={() => { navigate('/leave-management?tab=approvals'); setShowNotifications(false); }}>
                    View All Approvals ({pendingCount})
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-notification-state">
              <div className="empty-icon-wrapper">
                <MdCheckCircle size={50} style={{color: '#10b981'}} />
              </div>
              <h5 className="fw-bold mb-2" style={{color: '#1e293b'}}>All Caught Up!</h5>
              <p className="text-muted">No pending leave requests at the moment</p>
            </div>
          )}
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
                <div className="action-icon" title="My Tasks" onClick={() => navigate(user?.role === 'EMPLOYEE' ? '/tasks' : '/task-management')} style={{cursor: 'pointer'}}>
                  <MdAssignment size={22} />
                </div>
                {['MANAGER', 'HR', 'ADMIN'].includes(user?.role) && (
                  <Dropdown align="end">
                    <Dropdown.Toggle as="div" className="action-icon" style={{position: 'relative', cursor: 'pointer'}}>
                      <MdNotifications size={22} />
                      {pendingCount > 0 && (
                        <Badge 
                          bg="danger" 
                          pill 
                          className="badge-pulse"
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
                          <span className="fw-bold">Leave Requests</span>
                          <Badge bg="warning" pill>{pendingCount}</Badge>
                        </div>
                      </Dropdown.Header>
                      {notifications.length > 0 ? (
                        <>
                          {notifications.map((notif) => (
                            <Dropdown.Item 
                              key={notif._id} 
                              onClick={() => navigate('/leave-management?tab=approvals')}
                              className="notification-item"
                            >
                              <div className="d-flex align-items-start">
                                <div className="me-2" style={{color: '#f59e0b'}}>
                                  <MdCalendarToday size={18} />
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
                                <Button 
                                  variant="link" 
                                  size="sm" 
                                  className="p-1 text-danger" 
                                  onClick={(e) => clearSingleNotification(notif._id, e)}
                                  style={{fontSize: '1.2rem', lineHeight: 1}}
                                  title="Clear"
                                >
                                  ×
                                </Button>
                              </div>
                            </Dropdown.Item>
                          ))}
                          <Dropdown.Divider />
                          <div className="px-3 pb-2">
                            <Button 
                              variant="outline-warning" 
                              size="sm" 
                              className="w-100 mb-2" 
                              onClick={(e) => { e.stopPropagation(); markAsRead(); }}
                            >
                              <MdCheckCircle size={16} className="me-1" />
                              Mark All as Read
                            </Button>
                          </div>
                          <Dropdown.Item onClick={() => navigate('/leave-management?tab=approvals')} className="text-center fw-semibold" style={{color: '#f59e0b'}}>
                            View All Approvals ({pendingCount})
                          </Dropdown.Item>
                        </>
                      ) : (
                        <div className="text-center py-4 text-muted">
                          <MdCheckCircle size={48} className="mb-2 d-block mx-auto" style={{color: '#10b981'}} />
                          <small>No pending leave requests</small>
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
                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
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
                            color: '#d97706'
                          }}>{user?.role}</Badge>
                        </div>
                      </div>
                    </Dropdown.Header>
                    <Dropdown.Divider />
                    <Dropdown.Item onClick={() => navigate('/profile')}>
                      <MdPerson size={18} className="me-2" />My Profile
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => navigate('/attendance')}>
                      <MdAccessTime size={18} className="me-2" />Attendance
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => navigate('/leave-management?tab=my-leaves')}>
                      <MdEventAvailable size={18} className="me-2" />My Leaves
                    </Dropdown.Item>
                    <Dropdown.Divider />
                    <Dropdown.Item onClick={logout} className="text-danger">
                      <MdLogout size={18} className="me-2" />Logout
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

        {/* Mobile Bottom Navigation */}
        {isMobile && (
          <div className="mobile-bottom-nav">
            <div className="nav-item" onClick={() => navigate('/dashboard')}>
              <MdHome size={24} />
              <span>Home</span>
            </div>
            <div className="nav-item" onClick={() => navigate('/attendance')}>
              <MdAccessTime size={24} />
              <span>Attendance</span>
            </div>
            <div className="nav-item nav-item-center" onClick={() => navigate(user?.role === 'EMPLOYEE' ? '/tasks' : '/task-management')}>
              <div className="center-icon">
                <MdTask size={24} />
                {pendingCount > 0 && (
                  <Badge 
                    bg="danger" 
                    pill 
                    className="task-badge"
                  >
                    {pendingCount > 99 ? '99+' : pendingCount}
                  </Badge>
                )}
              </div>
              <span>Tasks</span>
            </div>
            <div className="nav-item" onClick={() => navigate('/profile')}>
              <MdPerson size={24} />
              <span>Profile</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Layout;