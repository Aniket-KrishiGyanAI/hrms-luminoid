import React, { useState, useEffect } from 'react';
import { Card } from 'react-bootstrap';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import EmployeeDirectory from './EmployeeDirectory';
import Departments from './Departments';

const OrganizationHub = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'employees');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const getTabs = () => {
    const tabs = [
      { key: 'employees', label: 'Employees', icon: 'fa-users', roles: ['MANAGER', 'HR', 'ADMIN'] }
    ];

    if (user?.role === 'ADMIN') {
      tabs.push(
        { key: 'departments', label: 'Departments', icon: 'fa-sitemap', roles: ['ADMIN'] }
      );
    }

    return tabs.filter(tab => tab.roles.includes(user?.role));
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'employees':
        return <EmployeeDirectory />;
      case 'departments':
        return <Departments />;
      default:
        return <EmployeeDirectory />;
    }
  };

  return (
    <div className="organization-hub">
      <style>{`
        .organization-hub {
          animation: fadeIn 0.3s ease-in;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .org-header {
          background: linear-gradient(135deg, #059669 0%, #047857 100%);
          border-radius: 16px;
          padding: 2rem;
          margin-bottom: 1.5rem;
          color: white;
          box-shadow: 0 10px 30px rgba(5, 150, 105, 0.3);
        }

        .org-header h1 {
          font-size: 2rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .org-header p {
          opacity: 0.9;
          margin: 0;
          font-size: 1rem;
        }

        .org-tabs-card {
          background: white;
          border-radius: 16px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          margin-bottom: 1.5rem;
          overflow: hidden;
          border: none;
        }

        .org-tabs {
          display: flex;
          background: linear-gradient(to right, #ecfdf5 0%, #ffffff 100%);
          border-bottom: 2px solid #d1fae5;
          padding: 0;
          margin: 0;
          overflow-x: auto;
          scrollbar-width: thin;
        }

        .org-tabs::-webkit-scrollbar {
          height: 4px;
        }

        .org-tabs::-webkit-scrollbar-thumb {
          background: #059669;
          border-radius: 4px;
        }

        .org-tab {
          flex: 1;
          min-width: 180px;
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

        .org-tab:hover {
          background: rgba(5, 150, 105, 0.05);
          color: #059669;
        }

        .org-tab.active {
          color: #059669;
          background: rgba(5, 150, 105, 0.1);
        }

        .org-tab.active::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, #059669 0%, #047857 100%);
          border-radius: 3px 3px 0 0;
        }

        .org-tab i {
          font-size: 1.1rem;
        }

        .org-content {
          padding: 0;
        }

        .org-content > div {
          animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }

        @media (max-width: 768px) {
          .org-header {
            padding: 1.5rem;
          }

          .org-header h1 {
            font-size: 1.5rem;
          }

          .org-tab {
            min-width: 140px;
            padding: 1rem;
            font-size: 0.85rem;
          }

          .org-tab span {
            display: none;
          }

          .org-tab i {
            font-size: 1.3rem;
          }
        }
      `}</style>

      <div className="org-header">
        <h1>
          <i className="fas fa-building"></i>
          Organization
        </h1>
        <p>
          <i className="fas fa-info-circle me-2"></i>
          Manage employees, departments, and organizational structure
        </p>
      </div>

      <Card className="org-tabs-card">
        <div className="org-tabs">
          {getTabs().map(tab => (
            <button
              key={tab.key}
              className={`org-tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => handleTabChange(tab.key)}
            >
              <i className={`fas ${tab.icon}`}></i>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="org-content">
          {renderTabContent()}
        </div>
      </Card>
    </div>
  );
};

export default OrganizationHub;
