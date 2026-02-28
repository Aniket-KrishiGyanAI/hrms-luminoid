import React, { useState, useEffect } from 'react';
import { Nav, Navbar, Badge, Dropdown, Form, Button, Offcanvas } from 'react-bootstrap';
import { LinkContainer } from 'react-router-bootstrap';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../utils/api';

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

  const getMenuItems = () => {
    const items = [
      { path: '/dashboard', label: 'Dashboard', icon: 'tachometer-alt', roles: ['EMPLOYEE', 'MANAGER', 'HR', 'ADMIN'] },
      { path: '/attendance', label: 'Attendance', icon: 'clock', roles: ['EMPLOYEE', 'MANAGER', 'HR', 'ADMIN'] }
    ];

    if (user?.role === 'EMPLOYEE') {
      items.push(
        { path: '/apply-leave', label: 'Apply Leave', icon: 'plus-circle', roles: ['EMPLOYEE'] },
        { path: '/my-leaves', label: 'My Leaves', icon: 'calendar-check', roles: ['EMPLOYEE'] }
      );
    }

    if (['MANAGER', 'HR', 'ADMIN'].includes(user?.role)) {
      items.push(
        { path: '/approvals', label: 'Approvals', icon: 'tasks', roles: ['MANAGER', 'HR', 'ADMIN'], badge: pendingCount },
        { path: '/team-calendar', label: 'Team Calendar', icon: 'calendar-alt', roles: ['MANAGER', 'HR', 'ADMIN'] },
        { path: '/employee-directory', label: 'Directory', icon: 'users', roles: ['MANAGER', 'HR', 'ADMIN'] }
      );
    }

    if (['HR', 'ADMIN'].includes(user?.role)) {
      items.push(
        { path: '/leave-types', label: 'Leave Types', icon: 'cogs', roles: ['HR', 'ADMIN'] },
        { path: '/announcements', label: 'Announcements', icon: 'bullhorn', roles: ['HR', 'ADMIN'] },
        { path: '/reports', label: 'Reports', icon: 'chart-bar', roles: ['HR', 'ADMIN'] }
      );
    }

    if (user?.role === 'ADMIN') {
      items.push({ path: '/departments', label: 'Departments', icon: 'sitemap', roles: ['ADMIN'] });
    }

    items.push(
      { path: '/files', label: 'Files', icon: 'folder-open', roles: ['EMPLOYEE', 'MANAGER', 'HR', 'ADMIN'] },
      { path: '/expenses', label: 'Expenses', icon: 'receipt', roles: ['EMPLOYEE', 'MANAGER', 'HR', 'ADMIN'] }
    );

    if (['HR', 'ADMIN'].includes(user?.role)) {
      items.push({ path: '/assets', label: 'Assets', icon: 'laptop', roles: ['HR', 'ADMIN'] });
    }

    return items.filter(item => item.roles.includes(user?.role));
  };

  const quickLinks = [
    { path: '/dashboard', icon: 'home', label: 'Home' },
    { path: '/attendance', icon: 'clock', label: 'Attendance' },
    { path: '/approvals', icon: 'tasks', label: 'Approvals', badge: pendingCount, roles: ['MANAGER', 'HR', 'ADMIN'] },
    { path: '/profile', icon: 'user', label: 'Profile' }
  ].filter(link => !link.roles || link.roles.includes(user?.role));

  return (
    <div className="enhanced-layout">
      {/* Top Navbar */}
      <Navbar className="enhanced-navbar" fixed="top">
        <div className="navbar-container">
          <div className="navbar-left">
            <Button variant="link" className="menu-toggle" onClick={() => setShowSidebar(true)}>
              <i className="fas fa-bars"></i>
            </Button>
            <Navbar.Brand className="brand">
              <i className="fas fa-building"></i>
              <span className="brand-text">HRMS Pro</span>
            </Navbar.Brand>
          </div>

          <div className="navbar-center">
          </div>

          <div className="navbar-right">
            <Button variant="link" className="nav-icon-btn" onClick={toggleTheme} title={isDarkMode ? 'Light Mode' : 'Dark Mode'}>
              <i className={`fas fa-${isDarkMode ? 'sun' : 'moon'}`}></i>
            </Button>
            
            {['MANAGER', 'HR', 'ADMIN'].includes(user?.role) && (
              <Button variant="link" className="nav-icon-btn" onClick={() => navigate('/approvals')}>
                <i className="fas fa-bell"></i>
                {pendingCount > 0 && <Badge className="notification-badge">{pendingCount}</Badge>}
              </Button>
            )}
            
            <Dropdown align="end">
              <Dropdown.Toggle variant="link" className="profile-dropdown">
                <div className="profile-avatar">
                  <i className="fas fa-user"></i>
                </div>
              </Dropdown.Toggle>
              <Dropdown.Menu className="profile-menu">
                <div className="profile-header">
                  <div className="profile-name">{user?.firstName} {user?.lastName}</div>
                  <div className="profile-role">{user?.role}</div>
                </div>
                <Dropdown.Divider />
                <Dropdown.Item onClick={() => navigate('/profile')}>
                  <i className="fas fa-user-circle me-2"></i>My Profile
                </Dropdown.Item>
                <Dropdown.Item onClick={logout}>
                  <i className="fas fa-sign-out-alt me-2"></i>Logout
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
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
            {getMenuItems().map(item => (
              <LinkContainer key={item.path} to={item.path}>
                <Nav.Link 
                  className={location.pathname === item.path ? 'active' : ''}
                  onClick={() => setShowSidebar(false)}
                >
                  <i className={`fas fa-${item.icon}`}></i>
                  <span>{item.label}</span>
                  {item.badge > 0 && <Badge bg="danger">{item.badge}</Badge>}
                </Nav.Link>
              </LinkContainer>
            ))}
          </Nav>

          <div className="sidebar-footer">
            <Button variant="outline-light" className="logout-btn" onClick={() => { logout(); setShowSidebar(false); }}>
              <i className="fas fa-sign-out-alt"></i>
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
        {quickLinks.map(link => (
          <Button
            key={link.path}
            variant="link"
            className={`bottom-nav-item ${location.pathname === link.path ? 'active' : ''}`}
            onClick={() => navigate(link.path)}
          >
            <div className="bottom-nav-icon">
              <i className={`fas fa-${link.icon}`}></i>
              {link.badge > 0 && <Badge className="bottom-badge">{link.badge}</Badge>}
            </div>
            <span className="bottom-nav-label">{link.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
};

export default EnhancedLayout;
