import React, { useState, useEffect } from 'react';
import { X, Bell, Heart, MessageSquare, UserPlus, Award, Sparkles, TrendingUp, Clock } from 'lucide-react';

const NotificationSidebar = ({ isOpen, onClose, isMobile }) => {
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      type: 'like',
      user: 'Chidera Okonkwo',
      avatar: 'C',
      action: 'liked your story',
      content: 'The Village Oracle\'s Last Words',
      time: '5m ago',
      read: false
    },
    {
      id: 2,
      type: 'comment',
      user: 'Adaeze Nwankwo',
      avatar: 'A',
      action: 'commented on your post',
      content: '"This is absolutely beautiful! The imagery is stunning..."',
      time: '12m ago',
      read: false
    },
    {
      id: 3,
      type: 'follow',
      user: 'Oluwaseun Ajayi',
      avatar: 'O',
      action: 'started following you',
      time: '1h ago',
      read: true
    },
    {
      id: 4,
      type: 'unlock',
      user: 'Blessing Chukwu',
      avatar: 'B',
      action: 'unlocked your story',
      content: 'Whispers of the Ancestors',
      time: '2h ago',
      read: true,
      earned: 50
    },
    {
      id: 5,
      type: 'achievement',
      action: 'You\'ve earned a new achievement!',
      content: 'Top Creator - Reached 10K views this month',
      time: '5h ago',
      read: true
    }
  ]);

  const [filter, setFilter] = useState('all');

  const getIcon = (type) => {
    switch (type) {
      case 'like': return <Heart size={20} className="notif-icon-like" />;
      case 'comment': return <MessageSquare size={20} className="notif-icon-comment" />;
      case 'follow': return <UserPlus size={20} className="notif-icon-follow" />;
      case 'unlock': return <Sparkles size={20} className="notif-icon-unlock" />;
      case 'achievement': return <Award size={20} className="notif-icon-achievement" />;
      default: return <Bell size={20} />;
    }
  };

  const markAsRead = (id) => {
    setNotifications(notifications.map(n => 
      n.id === id ? { ...n, read: true } : n
    ));
  };

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
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
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
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

        .notif-filters {
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

        .notif-actions {
          padding: 12px 20px;
          border-bottom: 1px solid rgba(132, 204, 22, 0.1);
        }

        .mark-all-read-btn {
          width: 100%;
          padding: 10px;
          background: rgba(132, 204, 22, 0.1);
          border: 1px solid rgba(132, 204, 22, 0.3);
          border-radius: 8px;
          color: #84cc16;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .mark-all-read-btn:hover {
          background: rgba(132, 204, 22, 0.15);
          border-color: #84cc16;
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
        }

        .notif-achievement-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #000;
          flex-shrink: 0;
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
        .notif-icon-follow { color: #8b5cf6; }
        .notif-icon-unlock { color: #fbbf24; }
        .notif-icon-achievement { color: #f59e0b; }

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

        .empty-subtext {
          font-size: 14px;
          color: #525252;
          margin: 0;
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

        .notif-list::-webkit-scrollbar-thumb:hover {
          background: rgba(132, 204, 22, 0.5);
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

          <div className="notif-filters">
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
          </div>
        </div>

        {unreadCount > 0 && (
          <div className="notif-actions">
            <button className="mark-all-read-btn" onClick={markAllAsRead}>
              Mark all as read
            </button>
          </div>
        )}

        <div className="notif-list">
          {filteredNotifications.length > 0 ? (
            filteredNotifications.map(notif => (
              <div 
                key={notif.id} 
                className={`notif-item ${!notif.read ? 'unread' : ''}`}
                onClick={() => markAsRead(notif.id)}
              >
                <div className="notif-item-content">
                  {notif.type === 'achievement' ? (
                    <div className="notif-achievement-icon">
                      {getIcon(notif.type)}
                    </div>
                  ) : (
                    <div className="notif-avatar">
                      {notif.avatar}
                    </div>
                  )}
                  
                  <div className="notif-text">
                    {notif.user && <div className="notif-user">{notif.user}</div>}
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
                      {notif.time}
                    </div>
                  </div>
                  
                  {getIcon(notif.type)}
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <div className="empty-icon">🔔</div>
              <p className="empty-text">No notifications</p>
              <p className="empty-subtext">You're all caught up!</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default NotificationSidebar;