import React, { useState, useEffect } from 'react';
import { Nav, Navbar, Badge, Dropdown, Form, Button, Offcanvas } from 'react-bootstrap';
import { LinkContainer } from 'react-router-bootstrap';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import NotificationsPanel from './NotificationsPanel';
import { 
  MdDashboard, MdAccessTime, MdEventAvailable, MdCalendarToday, 
  MdPeople, MdSettings, MdCampaign, MdBarChart, MdAccountTree,
  MdFolder, MdPerson, MdReceipt, MdLaptop, MdNotifications,
  MdBrightness4, MdBrightness7, MdMenu, MdLogout, MdHome,
  MdTask, MdCheckCircle, MdAddCircle, MdBusiness, MdAssignment
} from 'react-icons/md';

const EnhancedLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const [showSidebar, setShowSidebar] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (['MANAGER', 'HR', 'ADMIN'].includes(user?.role)) {
      fetchPendingCount();
      const interval = setInterval(fetchPendingCount, 60000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    const checkRoleNotification = async () => {
      if (user?.id) {
        try {
          const res = await api.get(`/api/users/${user.id}`);
          if (res.data.roleChangeNotification?.hasNotification) {
            const Swal = (await import('sweetalert2')).default;
            await Swal.fire({
              icon: 'info',
              title: 'Your Role Has Been Updated',
              html: `
                <div style="text-align: left; padding: 1rem;">
                  <p>Your system role has been changed by the administrator.</p>
                  <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin: 1rem 0;">
                    <p style="margin: 0.5rem 0;"><strong>Previous Role:</strong> ${res.data.roleChangeNotification.oldRole}</p>
                    <p style="margin: 0.5rem 0;"><strong>New Role:</strong> <strong style="color: #28a745;">${res.data.roleChangeNotification.newRole}</strong></p>
                  </div>
                  <p style="color: #0d6efd;">Please logout and login again to access your new permissions.</p>
                </div>
              `,
              confirmButtonText: 'Logout Now',
              confirmButtonColor: '#0d6efd',
              allowOutsideClick: false
            });
            await api.post(`/api/users/${user.id}/clear-notification`);
            logout();
          }
        } catch (err) {}
      }
    };
    checkRoleNotification();
  }, [user, logout]);

  const fetchPendingCount = async () => {
    try {
      const res = await api.get('/api/leave-requests/pending');
      setPendingCount(res.data.length || 0);
    } catch (err) {}
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/employee-directory?search=${searchQuery}`);
      setSearchQuery('');
    }
  };

  const handleLogout = async () => {
    const Swal = (await import('sweetalert2')).default;
    const result = await Swal.fire({
      title: 'Logout',
      text: 'Are you sure you want to logout?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, logout',
      cancelButtonText: 'Cancel'
    });
    if (result.isConfirmed) {
      logout();
    }
  };

  const getMenuItems = () => {
    const items = [
      { path: '/dashboard', label: 'Dashboard', icon: MdDashboard, roles: ['EMPLOYEE', 'MANAGER', 'HR', 'ADMIN'] },
      { path: '/attendance', label: 'Attendance', icon: MdAccessTime, roles: ['EMPLOYEE', 'MANAGER', 'HR', 'ADMIN'] }
    ];

    if (user?.role === 'EMPLOYEE') {
      items.push(
        { path: '/apply-leave', label: 'Apply Leave', icon: MdAddCircle, roles: ['EMPLOYEE'] },
        { path: '/my-leaves', label: 'My Leaves', icon: MdEventAvailable, roles: ['EMPLOYEE'] },
        { path: '/tasks', label: 'My Tasks', icon: MdTask, roles: ['EMPLOYEE'] }
      );
    }

    if (['MANAGER', 'HR', 'ADMIN'].includes(user?.role)) {
      items.push(
        { path: '/approvals', label: 'Approvals', icon: MdCheckCircle, roles: ['MANAGER', 'HR', 'ADMIN'], badge: pendingCount },
        { path: '/task-management', label: 'Task Management', icon: MdAssignment, roles: ['MANAGER', 'HR', 'ADMIN'] },
        { path: '/team-calendar', label: 'Team Calendar', icon: MdCalendarToday, roles: ['MANAGER', 'HR', 'ADMIN'] },
        { path: '/employee-directory', label: 'Directory', icon: MdPeople, roles: ['MANAGER', 'HR', 'ADMIN'] }
      );
    }

    if (['HR', 'ADMIN'].includes(user?.role)) {
      items.push(
        { path: '/leave-types', label: 'Leave Types', icon: MdSettings, roles: ['HR', 'ADMIN'] },
        { path: '/announcements', label: 'Announcements', icon: MdCampaign, roles: ['HR', 'ADMIN'] },
        { path: '/reports', label: 'Reports', icon: MdBarChart, roles: ['HR', 'ADMIN'] }
      );
    }

    if (user?.role === 'ADMIN') {
      items.push(
        { path: '/departments', label: 'Departments', icon: MdAccountTree, roles: ['ADMIN'] }
      );
    }

    items.push(
      { path: '/files', label: 'Files', icon: MdFolder, roles: ['EMPLOYEE', 'MANAGER', 'HR', 'ADMIN'] },
      { path: '/expenses', label: 'Expenses', icon: MdReceipt, roles: ['EMPLOYEE', 'MANAGER', 'HR', 'ADMIN'] }
    );

    if (['HR', 'ADMIN'].includes(user?.role)) {
      items.push({ path: '/assets', label: 'Assets', icon: MdLaptop, roles: ['HR', 'ADMIN'] });
    }

    return items.filter(item => item.roles.includes(user?.role));
  };

  const quickLinks = [
    { path: '/dashboard', icon: MdHome, label: 'Home' },
    { path: '/attendance', icon: MdAccessTime, label: 'Attendance' },
    { path: '/approvals', icon: MdTask, label: 'Approvals', badge: pendingCount, roles: ['MANAGER', 'HR', 'ADMIN'] },
    { path: '/profile', icon: MdPerson, label: 'Profile' }
  ].filter(link => !link.roles || link.roles.includes(user?.role));

  return (
    <div className="enhanced-layout">
      {/* Top Navbar */}
      <Navbar className="enhanced-navbar" fixed="top">
        <div className="navbar-container">
          <div className="navbar-left">
            <Button variant="link" className="menu-toggle" onClick={() => setShowSidebar(true)}>
              <MdMenu size={24} />
            </Button>
            <Navbar.Brand className="brand">
              <MdBusiness size={28} />
              <span className="brand-text">HRMS Pro</span>
            </Navbar.Brand>
          </div>

          <div className="navbar-center">
          </div>

          <div className="navbar-right">
            <Button variant="link" className="nav-icon-btn" onClick={() => navigate(user?.role === 'EMPLOYEE' ? '/tasks' : '/task-management')} title="My Tasks">
              <MdAssignment size={22} />
            </Button>
            
            <NotificationsPanel />
            
            {['MANAGER', 'HR', 'ADMIN'].includes(user?.role) && (
              <Button variant="link" className="nav-icon-btn" onClick={() => navigate('/approvals')}>
                <MdTask size={22} />
                {pendingCount > 0 && <Badge className="notification-badge">{pendingCount}</Badge>}
              </Button>
            )}
            
            <Button variant="link" className="nav-icon-btn" onClick={handleLogout} title="Logout">
              <MdLogout size={22} />
            </Button>
          </div>
        </div>
      </Navbar>

      {/* Sidebar */}
      <Offcanvas show={showSidebar} onHide={() => setShowSidebar(false)} className="enhanced-sidebar" placement="start">
        <Offcanvas.Header className="sidebar-header">
          <Button variant="link" className="custom-close-btn" onClick={() => setShowSidebar(false)}>
            <i className="fas fa-arrow-left"></i>
          </Button>
        </Offcanvas.Header>
        
        <div className="sidebar-user-info">
          <div className="user-avatar-large">
            {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
          </div>
          <div className="user-details">
            <div className="user-name">{user?.firstName} {user?.lastName}</div>
            <Badge bg="primary" className="user-role-badge">{user?.role}</Badge>
          </div>
        </div>

        <Offcanvas.Body className="sidebar-body">
          <Nav className="flex-column">
            {getMenuItems().map(item => {
              const IconComponent = item.icon;
              return (
                <LinkContainer key={item.path} to={item.path}>
                  <Nav.Link 
                    className={location.pathname === item.path ? 'active' : ''}
                    onClick={() => setShowSidebar(false)}
                  >
                    <IconComponent size={20} />
                    <span>{item.label}</span>
                    {item.badge > 0 && <Badge bg="danger">{item.badge}</Badge>}
                  </Nav.Link>
                </LinkContainer>
              );
            })}
          </Nav>

          <div className="sidebar-footer">
            <Button variant="outline-light" className="logout-btn" onClick={() => { handleLogout(); setShowSidebar(false); }}>
              <MdLogout size={20} />
              <span>Logout</span>
            </Button>
          </div>
        </Offcanvas.Body>
      </Offcanvas>

      {/* Main Content */}
      <div className="enhanced-content">
        {children}
      </div>

      {/* Bottom Navigation (Mobile) */}
      <div className="bottom-nav">
        {quickLinks.map(link => {
          const IconComponent = link.icon;
          return (
            <Button
              key={link.path}
              variant="link"
              className={`bottom-nav-item ${location.pathname === link.path ? 'active' : ''}`}
              onClick={() => navigate(link.path)}
            >
              <div className="bottom-nav-icon">
                <IconComponent size={24} />
                {link.badge > 0 && <Badge className="bottom-badge">{link.badge}</Badge>}
              </div>
              <span className="bottom-nav-label">{link.label}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
};

export default EnhancedLayout;
