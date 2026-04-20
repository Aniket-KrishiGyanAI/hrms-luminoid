import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import FieldVisits from './FieldVisits';
import MyFieldVisits from './MyFieldVisits';
import VisitPlanner from './VisitPlanner';
import ClientDirectory from './ClientDirectory';
import FieldReports from './FieldReports';
import SelfReportVisit from './SelfReportVisit';


const TABS = [
  { key: 'self',       label: 'Log a Visit',      icon: 'plus-circle',    roles: ['EMPLOYEE'],                   Component: SelfReportVisit, fieldOnly: true },
  { key: 'today',      label: "Today's Visits",   icon: 'map-marker-alt', roles: ['EMPLOYEE'],                   Component: FieldVisits, fieldOnly: true },
  { key: 'history',    label: 'Visit History',     icon: 'history',        roles: ['EMPLOYEE'],                   Component: MyFieldVisits, fieldOnly: true },
  { key: 'planner',    label: 'Visit Planner',     icon: 'calendar-alt',   roles: ['MANAGER', 'HR', 'ADMIN'],     Component: VisitPlanner },

  { key: 'clients',    label: 'Client Directory',  icon: 'building',       roles: ['MANAGER', 'HR', 'ADMIN'],     Component: ClientDirectory },
  { key: 'reports',    label: 'Field Reports',     icon: 'chart-bar',      roles: ['MANAGER', 'HR', 'ADMIN'],     Component: FieldReports },
];

const FieldVisitsHub = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
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
      {/* Mobile: Card Grid Layout */}
      {isMobile ? (
        <div style={{
          background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
          padding: '1rem',
          borderBottom: '1px solid #86efac'
        }}>
          {/* Current Selection Display */}
          <div style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            padding: '0.75rem 1rem',
            borderRadius: 12,
            marginBottom: '1rem',
            boxShadow: '0 4px 12px rgba(16,185,129,0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(10px)'
            }}>
              <i 
                className={`fas fa-${visibleTabs.find(t => t.key === activeTab)?.icon}`} 
                style={{ color: '#ffffff', fontSize: '1.1rem' }} 
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.8)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Current View</div>
              <div style={{ fontSize: '1rem', color: '#ffffff', fontWeight: 700 }}>
                {visibleTabs.find(t => t.key === activeTab)?.label}
              </div>
            </div>
          </div>

          {/* Navigation Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '0.75rem',
            marginBottom: '0.75rem'
          }}>
            {visibleTabs.map(tab => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    background: isActive 
                      ? 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)' 
                      : '#ffffff',
                    border: isActive ? '2px solid #10b981' : '1px solid #e2e8f0',
                    borderRadius: 12,
                    padding: '1rem 0.75rem',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: isActive 
                      ? '0 4px 12px rgba(16,185,129,0.2)' 
                      : '0 2px 6px rgba(0,0,0,0.06)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.5rem',
                    position: 'relative',
                    transform: isActive ? 'scale(1.02)' : 'scale(1)'
                  }}
                >
                  {/* Icon Circle */}
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: isActive 
                      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
                      : 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.3s ease',
                    boxShadow: isActive ? '0 4px 8px rgba(16,185,129,0.3)' : 'none'
                  }}>
                    <i 
                      className={`fas fa-${tab.icon}`} 
                      style={{ 
                        fontSize: '1.25rem',
                        color: isActive ? '#ffffff' : '#10b981',
                        transition: 'all 0.3s ease'
                      }} 
                    />
                  </div>
                  
                  {/* Label */}
                  <div style={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: isActive ? '#10b981' : '#64748b',
                    textAlign: 'center',
                    lineHeight: 1.2
                  }}>
                    {tab.label}
                  </div>

                  {/* Active Indicator */}
                  {isActive && (
                    <div style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: '#10b981',
                      boxShadow: '0 0 0 2px #ffffff, 0 0 8px rgba(16,185,129,0.6)'
                    }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* FPO Client Form Button - Mobile */}
          {user?.role === 'EMPLOYEE' && (
            <button
              onClick={() => window.open('https://docs.google.com/forms/d/e/1FAIpQLSfWH86nivabf5ReP3M1Sm7ysMBElA-ZuDrhEVvfuajKrE3rsw/viewform', '_blank')}
              style={{
                width: '100%',
                padding: '1rem',
                borderRadius: 12,
                border: 'none',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: '#ffffff',
                fontSize: '0.95rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
                transition: 'all 0.3s ease'
              }}
            >
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(10px)'
              }}>
                <i className="fas fa-clipboard-list" style={{ fontSize: '1rem' }} />
              </div>
              <span style={{ flex: 1, textAlign: 'left' }}>FPO Client Form</span>
              <i className="fas fa-external-link-alt" style={{ fontSize: '0.85rem', opacity: 0.8 }} />
            </button>
          )}
        </div>
      ) : (
        /* Desktop: Tab bar */
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
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    padding: '0.65rem 1.1rem',
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
                    minWidth: 'fit-content',
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
                      fontSize: '1rem',
                      color: active ? '#ffffff' : '#10b981'
                    }} 
                  />
                  <span 
                    className="fv-tab-label"
                    style={{ 
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      lineHeight: 1,
                      textAlign: 'center'
                    }}
                  >
                    {tab.label}
                  </span>
                </button>
              );
            })}
            {/* FPO Client Form Button - Desktop */}
            {user?.role === 'EMPLOYEE' && (
              <button
                onClick={() => window.open('https://docs.google.com/forms/d/e/1FAIpQLSfWH86nivabf5ReP3M1Sm7ysMBElA-ZuDrhEVvfuajKrE3rsw/viewform', '_blank')}
                className="fv-tab-button"
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.65rem 1.1rem',
                  borderRadius: 14,
                  border: '2px solid #3b82f6',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  whiteSpace: 'nowrap',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: '#ffffff',
                  boxShadow: '0 4px 12px rgba(59,130,246,0.3), 0 2px 4px rgba(59,130,246,0.2)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  outline: 'none',
                  minWidth: 'fit-content',
                  marginLeft: '0.5rem'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px) scale(1.05)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(59,130,246,0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(59,130,246,0.3), 0 2px 4px rgba(59,130,246,0.2)';
                }}
              >
                <i 
                  className="fas fa-clipboard-list fv-tab-icon" 
                  style={{ 
                    fontSize: '1rem',
                    color: '#ffffff'
                  }} 
                />
                <span 
                  className="fv-tab-label"
                  style={{ 
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    lineHeight: 1,
                    textAlign: 'center'
                  }}
                >
                  FPO Client Form
                </span>
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* Content area */}
      <div style={{ padding: '1rem' }}>
        {ActiveComponent && <ActiveComponent />}
      </div>
    </div>
  );
};

export default FieldVisitsHub;
