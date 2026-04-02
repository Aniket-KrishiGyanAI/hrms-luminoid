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
  MdTask, MdCheckCircle, MdAddCircle, MdBusiness, MdAssignment,
  MdAccessTimeFilled, MdCalendarMonth, MdWbSunny, MdNightsStay, MdWbTwilight
} from 'react-icons/md';

const PAGE_META = {
  '/dashboard':          { title: 'Dashboard', icon: 'tachometer-alt' },
  '/attendance':         { title: 'Attendance',          icon: 'clock' },
  '/apply-leave':        { title: 'Apply Leave',          icon: 'calendar-plus' },
  '/my-leaves':          { title: 'My Leaves',            icon: 'calendar-check' },
  '/tasks':              { title: 'My Tasks',             icon: 'tasks' },
  '/approvals':          { title: 'Approvals',            icon: 'check-circle' },
  '/task-management':    { title: 'Task Management',      icon: 'clipboard-list' },
  '/team-calendar':      { title: 'Team Calendar',        icon: 'calendar-alt' },
  '/employee-directory': { title: 'Employee Directory',   icon: 'users' },
  '/leave-types':        { title: 'Leave Types',          icon: 'cog' },
  '/announcements':      { title: 'Announcements',        icon: 'bullhorn' },
  '/reports':            { title: 'Reports',              icon: 'chart-bar' },
  '/departments':        { title: 'Departments',          icon: 'sitemap' },
  '/profile':            { title: 'My Profile',           icon: 'user-circle' },
  '/files':              { title: 'Files',                icon: 'folder-open' },
  '/expenses':           { title: 'Expenses',             icon: 'receipt' },
  '/assets':             { title: 'Assets',               icon: 'laptop' },
};

const EnhancedLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const [showSidebar, setShowSidebar] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [pendingCount, setPendingCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [dashboardQuote, setDashboardQuote] = useState(null);
  const [now, setNow] = useState(new Date());
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const GreetIcon = hour < 12 ? MdWbSunny : hour < 17 ? MdWbTwilight : MdNightsStay;

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (location.pathname === '/dashboard') {
      api.get(
        user?.role === 'MANAGER' ? '/api/dashboard/manager'
        : ['HR','ADMIN'].includes(user?.role) ? '/api/dashboard/hr'
        : '/api/dashboard/employee'
      ).then(res => setDashboardQuote(res.data?.motivationalQuote || null)).catch(() => {});
    }
  }, [location.pathname, user?.role]);

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
      { path: '/profile', label: 'My Profile', icon: MdPerson, roles: ['EMPLOYEE', 'MANAGER', 'HR', 'ADMIN'] },
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

  const meta = PAGE_META[location.pathname] || { title: 'HRMS', icon: 'home' };
  const pageTitle = meta.title;

  const SidebarNav = ({ onNavigate }) => (
    <>
      <div className="sidebar-user-info">
        <div className="user-avatar-large">
          {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
        </div>
        <div className="user-details">
          <div className="user-name">{user?.firstName} {user?.lastName}</div>
          <Badge bg="primary" className="user-role-badge">{user?.role}</Badge>
        </div>
      </div>
      <div className="sidebar-body">
        <Nav className="flex-column">
          {getMenuItems().map(item => {
            const IconComponent = item.icon;
            return (
              <LinkContainer key={item.path} to={item.path}>
                <Nav.Link
                  className={location.pathname === item.path ? 'active' : ''}
                  onClick={onNavigate}
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
          <Button variant="outline-light" className="logout-btn" onClick={() => { handleLogout(); onNavigate && onNavigate(); }}>
            <MdLogout size={20} />
            <span>Logout</span>
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <div className="enhanced-layout">

      {/* ── MOBILE: app-style navbar ── */}
      {isMobile && (
        <>
          {/* Mobile App Navbar */}
          <div className="mobile-app-navbar">
            {/* Hamburger */}
            <button className="mobile-nav-menu-btn" onClick={() => setShowSidebar(true)}>
              <MdMenu size={22} />
            </button>

            {/* Center: App name only */}
            <div className="mobile-nav-center">
              <span className="mobile-nav-appname">HRMS Pro</span>
            </div>

            {/* Right: notifications + avatar */}
            <div className="mobile-nav-right">
              <NotificationsPanel />
              <div className="mobile-nav-avatar" onClick={() => navigate('/profile')}>
                {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
              </div>
            </div>
          </div>

          <Offcanvas show={showSidebar} onHide={() => setShowSidebar(false)} className="enhanced-sidebar" placement="start">
            <Offcanvas.Header className="sidebar-header">
              <Button variant="link" className="custom-close-btn" onClick={() => setShowSidebar(false)}>
                <i className="fas fa-arrow-left"></i>
              </Button>
            </Offcanvas.Header>
            <Offcanvas.Body className="p-0">
              <SidebarNav onNavigate={() => setShowSidebar(false)} />
            </Offcanvas.Body>
          </Offcanvas>

          {/* Quote banner — sticky just below navbar, only on dashboard */}
          {location.pathname === '/dashboard' && dashboardQuote && (
            <div style={{
              position: 'sticky', top: '58px', zIndex: 1039,
              background: 'linear-gradient(135deg, #065f46 0%, #10b981 100%)',
              padding: '0.65rem 1rem',
              color: 'white',
              boxShadow: '0 4px 16px rgba(16,185,129,0.25)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
            }}>
              <div style={{ width: '28px', height: '28px', flexShrink: 0, background: 'rgba(255,255,255,0.15)', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', marginTop: '1px' }}>
                {dashboardQuote.icon ? <i className={dashboardQuote.icon}></i> : <i className="fas fa-quote-right"></i>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 500, fontSize: '0.75rem', lineHeight: 1.5 }}>{dashboardQuote.quote}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem', fontSize: '0.65rem', color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>
                  <div style={{ width: '14px', height: '1.5px', background: 'rgba(255,255,255,0.45)', borderRadius: '2px', flexShrink: 0 }}></div>
                  <span>{dashboardQuote.author}</span>
                </div>
              </div>
            </div>
          )}

          <div className="enhanced-content mobile-content" style={{ paddingTop: '58px' }}>
            {children}
          </div>

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
        </>
      )}

      {/* ── DESKTOP: permanent left sidebar + content ── */}
      {!isMobile && (
        <>
          <div className="desktop-sidebar">
            <SidebarNav />
          </div>

          {/* Desktop top bar */}
          <div className="desktop-topbar">
            {/* Left: page icon + title */}
            <div className="topbar-left">
              <div className="topbar-page-icon">
                <i className={`fas fa-${meta.icon}`}></i>
              </div>
              <div>
                <div className="topbar-page-title">{pageTitle}</div>
                <div className="topbar-greeting"><GreetIcon size={13} /> {greeting}, {user?.firstName}</div>
              </div>
            </div>

            {/* Right: date, time, notifications, user */}
            <div className="topbar-right">
              <div className="topbar-datetime">
                <div className="topbar-time">
                  <MdAccessTimeFilled size={15} />
                  {timeStr}
                </div>
                <div className="topbar-date">
                  <MdCalendarMonth size={13} />
                  {dateStr}
                </div>
              </div>
              <div className="topbar-divider" />
              <NotificationsPanel />
              <div className="topbar-user" onClick={() => navigate('/profile')}>
                <div className="topbar-avatar">
                  {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                </div>
                <div className="topbar-user-info">
                  <span className="topbar-user-name">{user?.firstName} {user?.lastName}</span>
                  <span className="topbar-user-role">{user?.role}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="desktop-content">
            {location.pathname === '/dashboard' && dashboardQuote && (
              <div style={{
                background: 'linear-gradient(135deg, #065f46 0%, #10b981 100%)',
                borderRadius: '1.125rem',
                padding: '1.1rem 1.5rem',
                marginBottom: '1.5rem',
                color: 'white',
                boxShadow: '0 4px 20px rgba(16,185,129,0.28)',
                display: 'flex',
                alignItems: 'center',
                gap: '1.25rem',
              }}>
                <div style={{
                  width: '48px', height: '48px', flexShrink: 0,
                  background: 'rgba(255,255,255,0.15)',
                  borderRadius: '0.875rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.3rem',
                }}>
                  {dashboardQuote.icon
                    ? <i className={dashboardQuote.icon}></i>
                    : <i className="fas fa-quote-right"></i>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 500, fontSize: '0.95rem', lineHeight: 1.6 }}>
                    {dashboardQuote.quote}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.4rem', fontSize: '0.82rem', color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
                    <div style={{ width: '28px', height: '2px', background: 'rgba(255,255,255,0.45)', borderRadius: '2px' }}></div>
                    <span>{dashboardQuote.author}</span>
                  </div>
                </div>
              </div>
            )}
            {children}
          </div>
        </>
      )}

    </div>
  );
};

export default EnhancedLayout;
