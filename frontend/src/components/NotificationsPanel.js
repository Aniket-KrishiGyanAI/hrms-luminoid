import React, { useState, useEffect } from 'react';
import { Dropdown, Badge } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { MdNotifications, MdTask, MdEdit, MdComment, MdAlternateEmail, MdSwapHoriz, MdTrendingUp, MdCheckCircle, MdClose } from 'react-icons/md';
import './NotificationsPanel.css';

const NotificationsPanel = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [show, setShow] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchUnreadCount();
      const interval = setInterval(fetchUnreadCount, 5000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchUnreadCount = async () => {
    try {
      const response = await api.get('/api/notifications/unread-count');
      setUnreadCount(response.data.count);
    } catch (error) {
      if (error.response?.status !== 401) {
        console.error('Error fetching unread count');
      }
    }
  };

  const fetchNotifications = async () => {
    try {
      const response = await api.get('/api/notifications');
      setNotifications(response.data.slice(0, 10));
    } catch (error) {
      if (error.response?.status !== 401) {
        console.error('Error fetching notifications');
      }
    }
  };

  const handleToggle = (isOpen) => {
    setShow(isOpen);
    if (isOpen) {
      fetchNotifications();
    }
  };

  const handleNotificationClick = async (notification) => {
    try {
      await api.put(`/api/notifications/${notification._id}/read`);
      setUnreadCount(prev => Math.max(0, prev - 1));
      setNotifications(prev => prev.map(n => 
        n._id === notification._id ? { ...n, read: true } : n
      ));
      setShow(false);
      
      // Navigate to task details and open it
      const taskId = notification.task._id || notification.task;
      
      // Determine which page to navigate to based on user role
      if (user.role === 'EMPLOYEE') {
        navigate('/tasks', { state: { openTaskId: taskId } });
      } else {
        navigate('/task-management', { state: { openTaskId: taskId } });
      }
    } catch (error) {
      console.error('Error marking as read');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.put('/api/notifications/mark-all-read');
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Error marking all as read');
    }
  };

  const handleDeleteNotification = async (e, notificationId, wasUnread) => {
    e.stopPropagation();
    try {
      await api.delete(`/api/notifications/${notificationId}`);
      setNotifications(prev => prev.filter(n => n._id !== notificationId));
      if (wasUnread) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const getIcon = (type) => {
    const icons = {
      TASK_ASSIGNED: MdTask,
      TASK_UPDATED: MdEdit,
      COMMENT_ADDED: MdComment,
      MENTION: MdAlternateEmail,
      STATUS_CHANGED: MdSwapHoriz,
      PROGRESS_UPDATED: MdTrendingUp
    };
    return icons[type] || MdNotifications;
  };

  const getIconColor = (type) => {
    const colors = {
      TASK_ASSIGNED: '#10b981',
      TASK_UPDATED: '#3b82f6',
      COMMENT_ADDED: '#8b5cf6',
      MENTION: '#f59e0b',
      STATUS_CHANGED: '#06b6d4',
      PROGRESS_UPDATED: '#ec4899'
    };
    return colors[type] || '#10b981';
  };

  const getTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (!user) return null;

  return (
    <Dropdown show={show} onToggle={handleToggle} align="end">
      <Dropdown.Toggle as="div" className="notification-bell-wrapper">
        <div className="notification-bell">
          <MdNotifications size={22} className={unreadCount > 0 ? 'bell-ring' : ''} />
          {unreadCount > 0 && (
            <Badge className="notification-badge-count">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </div>
      </Dropdown.Toggle>

      <Dropdown.Menu className="notification-dropdown-menu">
        <div className="notification-dropdown-header">
          <div className="notification-header-left">
            <MdNotifications size={24} className="header-icon" />
            <div>
              <h6 className="header-title">Notifications</h6>
              <span className="header-subtitle">{unreadCount} unread</span>
            </div>
          </div>
          {unreadCount > 0 && (
            <button className="mark-all-read-btn" onClick={handleMarkAllRead}>
              <MdCheckCircle size={18} />
              <span>Mark all read</span>
            </button>
          )}
        </div>
        
        <div className="notification-dropdown-list">
          {notifications.length > 0 ? (
            notifications.map((notif, index) => {
              const IconComponent = getIcon(notif.type);
              const iconColor = getIconColor(notif.type);
              return (
                <div
                  key={notif._id}
                  className={`notification-dropdown-item ${!notif.read ? 'unread' : ''}`}
                  onClick={() => handleNotificationClick(notif)}
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="notification-item-icon" style={{ background: `${iconColor}15`, color: iconColor }}>
                    <IconComponent size={20} />
                  </div>
                  <div className="notification-item-content">
                    <p className="notification-item-message">{notif.message}</p>
                    <div className="notification-item-footer">
                      <span className="notification-item-time">{getTimeAgo(notif.createdAt)}</span>
                      {!notif.read && <span className="notification-unread-badge">New</span>}
                    </div>
                  </div>
                  <button 
                    className="notification-delete-btn"
                    onClick={(e) => handleDeleteNotification(e, notif._id, !notif.read)}
                    title="Delete"
                  >
                    <MdClose size={16} />
                  </button>
                </div>
              );
            })
          ) : (
            <div className="notification-empty-state">
              <div className="empty-state-icon">
                <MdNotifications size={48} />
              </div>
              <h6 className="empty-state-title">All caught up!</h6>
              <p className="empty-state-text">You have no notifications at the moment</p>
            </div>
          )}
        </div>
      </Dropdown.Menu>
    </Dropdown>
  );
};

export default NotificationsPanel;
