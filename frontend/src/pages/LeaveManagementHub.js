import React, { useState, useEffect } from 'react';
import { Card, Nav, Badge } from 'react-bootstrap';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ApplyLeave from './ApplyLeave';
import MyLeaves from './MyLeaves';
import Approvals from './Approvals';
import TeamCalendar from './TeamCalendar';
import LeaveHistory from './LeaveHistory';
import api from '../utils/api';

const LeaveManagementHub = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'apply');
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (['MANAGER', 'HR', 'ADMIN'].includes(user?.role)) {
      fetchPendingCount();
      const interval = setInterval(fetchPendingCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchPendingCount = async () => {
    try {
      const res = await api.get('/api/leave-requests/pending');
      setPendingCount(res.data?.length || 0);
    } catch (error) {
      console.error('Error fetching pending count:', error);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const getTabs = () => {
    const tabs = [
      { key: 'apply', label: 'Apply Leave', icon: 'fa-plus-circle', roles: ['EMPLOYEE', 'MANAGER', 'HR', 'ADMIN'] },
      { key: 'my-leaves', label: 'My Leaves', icon: 'fa-calendar-alt', roles: ['EMPLOYEE', 'MANAGER', 'HR', 'ADMIN'] }
    ];

    if (['MANAGER', 'HR', 'ADMIN'].includes(user?.role)) {
      tabs.push(
        { key: 'approvals', label: 'Pending Approvals', icon: 'fa-tasks', badge: pendingCount, roles: ['MANAGER', 'HR', 'ADMIN'] },
        { key: 'calendar', label: 'Team Calendar', icon: 'fa-calendar-week', roles: ['MANAGER', 'HR', 'ADMIN'] }
      );
    }

    if (user?.role === 'ADMIN') {
      tabs.push(
        { key: 'history', label: 'Leave History', icon: 'fa-history', roles: ['ADMIN'] }
      );
    }

    return tabs.filter(tab => tab.roles.includes(user?.role));
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'apply':
        return <ApplyLeave />;
      case 'my-leaves':
        return <MyLeaves />;
      case 'approvals':
        return <Approvals />;
      case 'calendar':
        return <TeamCalendar />;
      case 'history':
        return <LeaveHistory />;
      default:
        return <ApplyLeave />;
    }
  };

  return (
    <div className="leave-management-hub">
      <style>{`
        .leave-management-hub {
          animation: fadeIn 0.3s ease-in;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .hub-header {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          border-radius: 16px;
          padding: 2rem;
          margin-bottom: 1.5rem;
          color: white;
          box-shadow: 0 10px 30px rgba(16, 185, 129, 0.3);
        }

        .hub-header h1 {
          font-size: 2rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .hub-header p {
          opacity: 0.9;
          margin: 0;
          font-size: 1rem;
        }

        .hub-tabs-card {
          background: white;
          border-radius: 16px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          margin-bottom: 1.5rem;
          overflow: hidden;
          border: none;
        }

        .hub-tabs {
          display: flex;
          background: linear-gradient(to right, #f8f9fa 0%, #ffffff 100%);
          border-bottom: 2px solid #e9ecef;
          padding: 0;
          margin: 0;
          overflow-x: auto;
          scrollbar-width: thin;
        }

        .hub-tabs::-webkit-scrollbar {
          height: 4px;
        }

        .hub-tabs::-webkit-scrollbar-thumb {
          background: #10b981;
          border-radius: 4px;
        }

        .hub-tab {
          flex: 1;
          min-width: 150px;
          padding: 1.25rem 1.5rem;
          border: none;
          background: transparent;
          color: #6c757d;
          font-weight: 600;
          font-size: 0.95rem;
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          white-space: nowrap;
        }

        .hub-tab:hover {
          background: rgba(16, 185, 129, 0.05);
          color: #10b981;
        }

        .hub-tab.active {
          color: #10b981;
          background: rgba(16, 185, 129, 0.1);
        }

        .hub-tab.active::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, #10b981 0%, #059669 100%);
          border-radius: 3px 3px 0 0;
        }

        .hub-tab i {
          font-size: 1.1rem;
        }

        .hub-tab-badge {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white;
          padding: 0.25rem 0.6rem;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 700;
          min-width: 24px;
          text-align: center;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }

        .hub-content {
          padding: 0;
        }

        .hub-content > div {
          animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }

        @media (max-width: 768px) {
          .hub-header {
            padding: 1.5rem;
          }

          .hub-header h1 {
            font-size: 1.5rem;
          }

          .hub-tab {
            min-width: 120px;
            padding: 1rem;
            font-size: 0.85rem;
          }

          .hub-tab span {
            display: none;
          }

          .hub-tab i {
            font-size: 1.3rem;
          }
        }
      `}</style>

      <div className="hub-header">
        <h1>
          <i className="fas fa-calendar-check"></i>
          Leave Management
        </h1>
        <p>
          <i className="fas fa-info-circle me-2"></i>
          Apply for leaves, track requests, and manage team calendar
        </p>
      </div>

      <Card className="hub-tabs-card">
        <div className="hub-tabs">
          {getTabs().map(tab => (
            <button
              key={tab.key}
              className={`hub-tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => handleTabChange(tab.key)}
            >
              <i className={`fas ${tab.icon}`}></i>
              <span>{tab.label}</span>
              {tab.badge > 0 && (
                <span className="hub-tab-badge">{tab.badge > 99 ? '99+' : tab.badge}</span>
              )}
            </button>
          ))}
        </div>

        <div className="hub-content">
          {renderTabContent()}
        </div>
      </Card>
    </div>
  );
};

export default LeaveManagementHub;
