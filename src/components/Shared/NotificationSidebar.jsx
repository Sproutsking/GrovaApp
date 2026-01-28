// ============================================================================
// src/components/Shared/NotificationSidebar.jsx - PERFECT WITH READ TRACKING
// ============================================================================

import React, { useState, useEffect } from 'react';
import { X, Bell, Heart, MessageSquare, Sparkles, Clock, Check, Share2 } from 'lucide-react';
import notificationService from '../../services/notifications/notificationService';
import mediaUrlService from '../../services/shared/mediaUrlService';

const NotificationSidebar = ({ isOpen, onClose, isMobile, userId }) => {
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    if (isOpen && userId) {
      loadNotifications();
      
      // Poll for new notifications every 30 seconds
      const interval = setInterval(loadNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [isOpen, userId]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const data = await notificationService.getNotifications(userId);
      setNotifications(data);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const past = new Date(timestamp);
    const diff = now - past;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return past.toLocaleDateString();
  };

  const getIcon = (type) => {
    switch (type) {
      case 'like': return <Heart size={20} className="notif-icon-like" />;
      case 'comment': return <MessageSquare size={20} className="notif-icon-comment" />;
      case 'share': return <Share2 size={20} className="notif-icon-share" />;
      case 'unlock': return <Sparkles size={20} className="notif-icon-unlock" />;
      default: return <Bell size={20} />;
    }
  };

  const markAsRead = async (id) => {
    await notificationService.markAsRead(id, userId);
    setNotifications(notifications.map(n => 
      n.id === id ? { ...n, read: true } : n
    ));
  };

  const markAllAsRead = async () => {
    setMarking(true);
    await notificationService.markAllAsRead(userId);
    setNotifications(notifications.map(n => ({ ...n, read: true })));
    setMarking(false);
  };

  const getAvatarUrl = (avatarId) => {
    if (!avatarId) return null;
    return mediaUrlService.getAvatarUrl(avatarId, 200);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const filteredNotifications = filter === 'all' 
    ? notifications 
    : notifications.filter(n => !n.read);

  if (!isOpen) return null;

  return (
    <>
      <style>{`
        .notification-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          z-index: 999;
          animation: fadeIn 0.2s ease;
        }

        .notification-sidebar {
          position: fixed;
          top: 0;
          right: 0;
          width: 100%;
          max-width: ${isMobile ? '100%' : '420px'};
          height: 100vh;
          background: #0a0a0a;
          border-left: 1px solid rgba(132, 204, 22, 0.2);
          z-index: 1000;
          display: flex;
          flex-direction: column;
          animation: slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .notif-header {
          padding: 20px;
          border-bottom: 1px solid rgba(132, 204, 22, 0.2);
          background: rgba(132, 204, 22, 0.03);
        }

        .notif-header-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .notif-title-section {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .notif-icon-wrapper {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #000;
        }

        .notif-title {
          font-size: 20px;
          font-weight: 800;
          color: #fff;
          margin: 0;
        }

        .notif-badge {
          background: #ef4444;
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 12px;
          margin-left: 8px;
        }

        .notif-close-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #a3a3a3;
          cursor: pointer;
          transition: all 0.2s;
        }

        .notif-close-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #84cc16;
          border-color: rgba(132, 204, 22, 0.3);
        }

        .notif-tabs {
          display: flex;
          gap: 8px;
        }

        .filter-btn {
          flex: 1;
          padding: 8px 16px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: #a3a3a3;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .filter-btn.active {
          background: rgba(132, 204, 22, 0.15);
          border-color: rgba(132, 204, 22, 0.4);
          color: #84cc16;
        }

        .filter-btn:hover:not(.active) {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .mark-all-btn {
          padding: 8px 16px;
          background: rgba(132, 204, 22, 0.1);
          border: 1px solid rgba(132, 204, 22, 0.3);
          border-radius: 8px;
          color: #84cc16;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
        }

        .mark-all-btn:hover:not(:disabled) {
          background: rgba(132, 204, 22, 0.15);
          border-color: #84cc16;
        }

        .mark-all-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .notif-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
        }

        .notif-item {
          padding: 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          margin-bottom: 8px;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
        }

        .notif-item.unread {
          background: rgba(132, 204, 22, 0.05);
          border-color: rgba(132, 204, 22, 0.2);
        }

        .notif-item.unread::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 3px;
          background: linear-gradient(180deg, #84cc16 0%, #65a30d 100%);
          border-radius: 12px 0 0 12px;
        }

        .notif-item:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(132, 204, 22, 0.3);
          transform: translateX(-2px);
        }

        .notif-item-content {
          display: flex;
          gap: 12px;
        }

        .notif-avatar {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #000;
          font-weight: 700;
          font-size: 18px;
          flex-shrink: 0;
          overflow: hidden;
        }

        .notif-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .notif-text {
          flex: 1;
          min-width: 0;
        }

        .notif-user {
          font-size: 14px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 4px;
        }

        .notif-action {
          font-size: 14px;
          color: #a3a3a3;
          margin-bottom: 4px;
        }

        .notif-content {
          font-size: 13px;
          color: #84cc16;
          font-style: italic;
          margin-bottom: 6px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .notif-earned {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          background: rgba(132, 204, 22, 0.2);
          border-radius: 6px;
          color: #84cc16;
          font-size: 12px;
          font-weight: 700;
          margin-top: 6px;
        }

        .notif-time {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: #666;
          margin-top: 6px;
        }

        .notif-icon-like { color: #ef4444; }
        .notif-icon-comment { color: #3b82f6; }
        .notif-icon-share { color: #8b5cf6; }
        .notif-icon-unlock { color: #fbbf24; }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
        }

        .empty-icon {
          font-size: 64px;
          margin-bottom: 16px;
          opacity: 0.5;
        }

        .empty-text {
          font-size: 16px;
          color: #737373;
          margin: 0 0 8px 0;
        }

        .loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid rgba(132, 204, 22, 0.2);
          border-top-color: #84cc16;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 0 auto;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .notif-list::-webkit-scrollbar {
          width: 6px;
        }

        .notif-list::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.03);
        }

        .notif-list::-webkit-scrollbar-thumb {
          background: rgba(132, 204, 22, 0.3);
          border-radius: 3px;
        }

        .tab-row {
          display: flex;
          gap: 8px;
          align-items: center;
        }
      `}</style>

      <div className="notification-overlay" onClick={onClose}></div>
      
      <div className="notification-sidebar">
        <div className="notif-header">
          <div className="notif-header-top">
            <div className="notif-title-section">
              <div className="notif-icon-wrapper">
                <Bell size={20} />
              </div>
              <div>
                <h2 className="notif-title">
                  Notifications
                  {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
                </h2>
              </div>
            </div>
            <button className="notif-close-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>

          <div className="tab-row">
            <button 
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button 
              className={`filter-btn ${filter === 'unread' ? 'active' : ''}`}
              onClick={() => setFilter('unread')}
            >
              Unread ({unreadCount})
            </button>
            {unreadCount > 0 && (
              <button 
                className="mark-all-btn"
                onClick={markAllAsRead}
                disabled={marking}
              >
                <Check size={14} />
                Mark all
              </button>
            )}
          </div>
        </div>

        <div className="notif-list">
          {loading ? (
            <div className="empty-state">
              <div className="loading-spinner"></div>
              <p className="empty-text">Loading notifications...</p>
            </div>
          ) : filteredNotifications.length > 0 ? (
            filteredNotifications.map(notif => (
              <div 
                key={notif.id} 
                className={`notif-item ${!notif.read ? 'unread' : ''}`}
                onClick={() => markAsRead(notif.id)}
              >
                <div className="notif-item-content">
                  <div className="notif-avatar">
                    {notif.user?.avatar ? (
                      <img src={getAvatarUrl(notif.user.avatar)} alt={notif.user.name} />
                    ) : (
                      notif.user?.name?.charAt(0)?.toUpperCase() || 'U'
                    )}
                  </div>
                  
                  <div className="notif-text">
                    {notif.user && <div className="notif-user">{notif.user.name}</div>}
                    <div className="notif-action">{notif.action}</div>
                    {notif.content && <div className="notif-content">{notif.content}</div>}
                    {notif.earned && (
                      <div className="notif-earned">
                        <Sparkles size={12} />
                        +{notif.earned} GT earned
                      </div>
                    )}
                    <div className="notif-time">
                      <Clock size={12} />
                      {formatTimeAgo(notif.timestamp)}
                    </div>
                  </div>
                  
                  {getIcon(notif.type)}
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <div className="empty-icon">🔔</div>
              <p className="empty-text">
                {filter === 'unread' ? 'No unread notifications' : 'No notifications'}
              </p>
              <p className="empty-subtext" style={{ fontSize: '14px', color: '#525252', margin: 0 }}>
                {filter === 'unread' ? "You're all caught up!" : 'Enable notifications in settings to stay updated'}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default NotificationSidebar;