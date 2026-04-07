import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import FieldVisits from './FieldVisits';
import MyFieldVisits from './MyFieldVisits';
import VisitPlanner from './VisitPlanner';
import ClientDirectory from './ClientDirectory';
import FieldReports from './FieldReports';
import SelfReportVisit from './SelfReportVisit';
import JourneyPage from './JourneyPage';
import JourneyManagerDashboard from './JourneyManagerDashboard';

const TABS = [
  { key: 'self',       label: 'Log a Visit',      icon: 'plus-circle',    roles: ['EMPLOYEE'],                   Component: SelfReportVisit, fieldOnly: true },
  { key: 'today',      label: "Today's Visits",   icon: 'map-marker-alt', roles: ['EMPLOYEE'],                   Component: FieldVisits, fieldOnly: true },
  { key: 'journey',    label: 'My Journey',        icon: 'route',          roles: ['EMPLOYEE'],                   Component: JourneyPage, fieldOnly: true },
  { key: 'history',    label: 'Visit History',     icon: 'history',        roles: ['EMPLOYEE'],                   Component: MyFieldVisits, fieldOnly: true },
  { key: 'planner',    label: 'Visit Planner',     icon: 'calendar-alt',   roles: ['MANAGER', 'HR', 'ADMIN'],     Component: VisitPlanner },
  { key: 'journey-mgr',label: 'Journey Tracker',   icon: 'map-marked-alt', roles: ['MANAGER', 'HR', 'ADMIN'],     Component: JourneyManagerDashboard },
  { key: 'clients',    label: 'Client Directory',  icon: 'building',       roles: ['MANAGER', 'HR', 'ADMIN'],     Component: ClientDirectory },
  { key: 'reports',    label: 'Field Reports',     icon: 'chart-bar',      roles: ['MANAGER', 'HR', 'ADMIN'],     Component: FieldReports },
];

const FieldVisitsHub = () => {
  const { user } = useAuth();
  const visibleTabs = TABS.filter(t =>
    t.roles.includes(user?.role) && (!t.fieldOnly || user?.isFieldEmployee)
  );
  const [activeTab, setActiveTab] = useState(visibleTabs[0]?.key);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const ActiveComponent = visibleTabs.find(t => t.key === activeTab)?.Component;

  return (
    <div>
      {/* Tab bar - Scrolls with page, horizontally scrollable */}
      <div style={{
        background: 'linear-gradient(to bottom, #ffffff 0%, #f9fafb 100%)',
        borderBottom: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        overflowX: 'auto',
        overflowY: 'hidden',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}>
        <style>{`
          .fv-tabs-container::-webkit-scrollbar {
            display: none;
          }
          @media (max-width: 768px) {
            .fv-tab-button {
              min-width: auto !important;
              padding: 0.65rem 0.75rem !important;
            }
            .fv-tab-icon {
              font-size: 1.1rem !important;
            }
            .fv-tab-label {
              font-size: 0.7rem !important;
              line-height: 1.2 !important;
            }
          }
        `}</style>
        <div className="fv-tabs-container" style={{
          display: 'flex',
          gap: '0.6rem',
          padding: '0.85rem 1rem',
          minWidth: 'max-content'
        }}>
          {visibleTabs.map(tab => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="fv-tab-button"
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: isMobile ? '0.25rem' : '0.5rem',
                  padding: isMobile ? '0.65rem 0.75rem' : '0.65rem 1.1rem',
                  borderRadius: 14,
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  whiteSpace: 'nowrap',
                  background: active 
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
                    : '#ffffff',
                  color: active ? '#ffffff' : '#64748b',
                  boxShadow: active 
                    ? '0 4px 12px rgba(16,185,129,0.3), 0 2px 4px rgba(16,185,129,0.2)' 
                    : '0 2px 6px rgba(0,0,0,0.08)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  outline: 'none',
                  position: 'relative',
                  minWidth: isMobile ? 'auto' : 'fit-content',
                  transform: active ? 'translateY(-2px) scale(1.02)' : 'translateY(0) scale(1)'
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = '#f8fafc';
                    e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
                    e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.12)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = '#ffffff';
                    e.currentTarget.style.transform = 'translateY(0) scale(1)';
                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.08)';
                  }
                }}
              >
                <i 
                  className={`fas fa-${tab.icon} fv-tab-icon`} 
                  style={{ 
                    fontSize: isMobile ? '1.1rem' : '1rem',
                    color: active ? '#ffffff' : '#10b981'
                  }} 
                />
                <span 
                  className="fv-tab-label"
                  style={{ 
                    fontSize: isMobile ? '0.7rem' : '0.85rem',
                    fontWeight: 600,
                    lineHeight: isMobile ? 1.2 : 1,
                    textAlign: 'center'
                  }}
                >
                  {tab.label}
                </span>
                {tab.key === 'journey' && !active && (
                  <span style={{ 
                    width: 8, 
                    height: 8, 
                    borderRadius: '50%', 
                    background: '#10b981', 
                    display: 'inline-block',
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    boxShadow: '0 0 0 2px #fff, 0 0 8px rgba(16,185,129,0.6)',
                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                  }} />
                )}
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Content area */}
      <div style={{ padding: '1rem' }}>
        {ActiveComponent && <ActiveComponent />}
      </div>
    </div>
  );
};

export default FieldVisitsHub;
