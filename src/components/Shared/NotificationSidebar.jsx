// ============================================================================
// src/components/Shared/NotificationSidebar.jsx - SELF-CONTAINED NAVIGATION
// ============================================================================

import React, { useState, useEffect } from "react";
import {
  X,
  Heart,
  MessageCircle,
  UserPlus,
  Share2,
  Unlock,
  Check,
  CheckCheck,
  Settings,
} from "lucide-react";
import notificationService from "../../services/notifications/notificationService";
import authService from "../../services/auth/authService";
import SettingsSection from "../Account/SettingsSection";
import UserProfileModal from "../Modals/UserProfileModal";

const NotificationSidebar = ({ isOpen, onClose, isMobile, currentUser }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  // Internal state for modals
  const [showSettings, setShowSettings] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  const loadNotifications = async () => {
    try {
      setLoading(true);

      const user = await authService.getCurrentUser();
      if (!user) {
        console.log("❌ No user found");
        setNotifications([]);
        return;
      }

      setUserId(user.id);

      console.log("📬 Loading notifications for user:", user.id);

      const notifs = await notificationService.getNotifications(
        user.id,
        50,
        true,
      );
      setNotifications(notifs);

      console.log("✅ Loaded", notifs.length, "notifications");

      if (notifs.length === 0) {
        console.log(
          "ℹ️ No notifications found - check your notification settings or wait for new activity",
        );
      }
    } catch (error) {
      console.error("❌ Failed to load notifications:", error);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "like":
        return <Heart size={20} className="notif-icon like" />;
      case "comment":
        return <MessageCircle size={20} className="notif-icon comment" />;
      case "follow":
        return <UserPlus size={20} className="notif-icon follow" />;
      case "share":
        return <Share2 size={20} className="notif-icon share" />;
      case "unlock":
        return <Unlock size={20} className="notif-icon unlock" />;
      default:
        return <Heart size={20} className="notif-icon" />;
    }
  };

  const getNotificationText = (notification) => {
    const { type, contentType } = notification;

    switch (type) {
      case "like":
        return `liked your ${contentType}`;
      case "comment":
        return `commented on your ${contentType}`;
      case "follow":
        return "started following you";
      case "share":
        return `shared your ${contentType}`;
      case "unlock":
        return `unlocked your ${contentType}`;
      default:
        return "interacted with your content";
    }
  };

  const getTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead(userId);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const handleSettingsClick = (e) => {
    e?.stopPropagation();
    console.log("Opening settings...");
    setShowSettings(true);
  };

  const handleUserClick = (notification, e) => {
    e?.stopPropagation();
    console.log("Opening user profile...");

    if (!notification.actor) {
      console.log("No actor data found");
      return;
    }

    const userData = {
      id: notification.actor.id || notification.actorId,
      user_id: notification.actor.id || notification.actorId,
      name: notification.actor.name,
      author: notification.actor.name,
      avatar: notification.actor.avatar,
      verified: notification.actor.verified || false,
    };

    console.log("User data:", userData);
    setSelectedUser(userData);
    setShowUserProfile(true);

    // Close the notification sidebar to prevent z-index conflicts
    onClose();
  };

  const handleCloseSettings = () => {
    setShowSettings(false);
  };

  const handleCloseUserProfile = () => {
    setShowUserProfile(false);
    setSelectedUser(null);
  };

  if (!isOpen && !showUserProfile) return null;

  // If settings is open, show settings instead of notifications
  if (showSettings) {
    return (
      <>
        <div
          className="notification-sidebar-overlay"
          onClick={handleCloseSettings}
        >
          <div
            className="notification-sidebar settings-view"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="notification-header">
              <button onClick={handleCloseSettings} className="close-btn">
                <X size={20} />
              </button>
              <div className="notification-title">Settings</div>
              <div style={{ width: "40px" }}></div>
            </div>
            <div className="settings-content">
              <SettingsSection userId={userId} />
            </div>
          </div>
        </div>
        <style jsx>{getStyles()}</style>
      </>
    );
  }

  return (
    <>
      {/* Notification Sidebar - Only show when isOpen and not showing profile */}
      {isOpen && (
        <div className="notification-sidebar-overlay" onClick={onClose}>
          <div
            className="notification-sidebar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="notification-header">
              <div className="notification-title">Notifications</div>
              <div className="notification-actions">
                {notifications.length > 0 && (
                  <button className="mark-read-btn" onClick={handleMarkAllRead}>
                    <CheckCheck size={16} />
                    Mark all read
                  </button>
                )}
                <button className="close-btn" onClick={onClose}>
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="notification-list">
              {loading ? (
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                  <div className="loading-text">Loading notifications...</div>
                </div>
              ) : notifications.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🔔</div>
                  <div className="empty-state-text">No notifications yet</div>
                  <div className="empty-state-hint">
                    When someone likes, comments, follows, or shares your
                    content, you'll see it here. Make sure notifications are
                    enabled in settings.
                  </div>
                  <button
                    className="settings-link"
                    onClick={handleSettingsClick}
                  >
                    <Settings size={16} />
                    Check Notification Settings
                  </button>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`notification-item ${notification.read ? "" : "unread"}`}
                  >
                    <div
                      className="notification-avatar"
                      onClick={(e) => handleUserClick(notification, e)}
                    >
                      {notification.actor.avatar &&
                      typeof notification.actor.avatar === "string" &&
                      notification.actor.avatar.startsWith("http") ? (
                        <img
                          src={notification.actor.avatar}
                          alt={notification.actor.name}
                        />
                      ) : (
                        notification.actor.name?.charAt(0)?.toUpperCase() || "U"
                      )}
                    </div>

                    <div className="notification-content">
                      <div className="notification-text">
                        <span
                          className="notification-actor"
                          onClick={(e) => handleUserClick(notification, e)}
                        >
                          {notification.actor.name}
                        </span>{" "}
                        {getNotificationText(notification)}
                      </div>

                      {notification.content?.preview && (
                        <div className="notification-preview">
                          {notification.content.preview}
                        </div>
                      )}

                      <div className="notification-time">
                        {getTimeAgo(notification.createdAt)}
                      </div>
                    </div>

                    <div className="notification-icon-wrapper">
                      {getNotificationIcon(notification.type)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* User Profile Modal - Renders independently */}
      {showUserProfile && selectedUser && (
        <UserProfileModal
          user={selectedUser}
          onClose={handleCloseUserProfile}
          currentUser={currentUser}
          onAuthorClick={(user) => {
            setSelectedUser(user);
            setShowUserProfile(true);
          }}
          onActionMenu={(content) => {
            // Handle action menu if needed
          }}
        />
      )}

      <style jsx>{getStyles()}</style>
    </>
  );
};

// Extracted styles function
const getStyles = () => `
  .notification-sidebar-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(10px);
    z-index: 10000;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .notification-sidebar {
    position: fixed;
    top: 0;
    right: 0;
    width: 420px;
    height: 100vh;
    background: #0a0a0a;
    border-left: 1px solid rgba(132, 204, 22, 0.2);
    display: flex;
    flex-direction: column;
    z-index: 10001;
    animation: slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .notification-sidebar.settings-view {
    overflow-y: auto;
  }

  @keyframes slideInRight {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(0);
    }
  }

  @media (max-width: 768px) {
    .notification-sidebar {
      width: 100%;
      border-left: none;
      border-radius: 24px 24px 0 0;
      bottom: 0;
      top: auto;
      height: 100vh;
      animation: slideInUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    @keyframes slideInUp {
      from {
        transform: translateY(100%);
      }
      to {
        transform: translateY(0);
      }
    }
  }

  .notification-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid rgba(132, 204, 22, 0.2);
    background: rgba(0, 0, 0, 0.98);
    backdrop-filter: blur(20px);
  }

  .notification-title {
    font-size: 20px;
    font-weight: 800;
    color: #fff;
  }

  .notification-actions {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .mark-read-btn {
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
  }

  .mark-read-btn:hover {
    background: rgba(132, 204, 22, 0.15);
    border-color: rgba(132, 204, 22, 0.5);
  }

  .close-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #737373;
    cursor: pointer;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .notification-list {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
  }

  .notification-list::-webkit-scrollbar {
    width: 6px;
  }

  .notification-list::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
  }

  .notification-list::-webkit-scrollbar-thumb {
    background: rgba(132, 204, 22, 0.3);
    border-radius: 3px;
  }

  .notification-item {
    display: flex;
    gap: 12px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(132, 204, 22, 0.1);
    border-radius: 16px;
    margin-bottom: 4px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .notification-item:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(132, 204, 22, 0.3);
    transform: translateX(-4px);
  }

  .notification-item.unread {
    background: rgba(132, 204, 22, 0.05);
    border-color: rgba(132, 204, 22, 0.3);
  }

  .notification-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    color: #000;
    font-size: 20px;
    flex-shrink: 0;
    overflow: hidden;
    border: 2px solid rgba(132, 204, 22, 0.3);
    cursor: pointer;
    transition: all 0.2s;
  }

  .notification-avatar:hover {
    border-color: #84cc16;
    transform: scale(1.05);
  }

  .notification-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .notification-content {
    flex: 1;
    min-width: 0;
  }

  .notification-text {
    font-size: 14px;
    color: #fff;
    margin-bottom: 4px;
    line-height: 1.4;
  }

  .notification-actor {
    font-weight: 700;
    color: #84cc16;
    cursor: pointer;
    transition: all 0.2s;
  }

  .notification-actor:hover {
    text-decoration: underline;
  }

  .notification-preview {
    font-size: 13px;
    color: #737373;
    margin-bottom: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .notification-time {
    font-size: 12px;
    color: #525252;
  }

  .notification-icon-wrapper {
    position: relative;
    flex-shrink: 0;
  }

  .notif-icon {
    padding: 8px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.05);
  }

  .notif-icon.like {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }

  .notif-icon.comment {
    color: #3b82f6;
    background: rgba(59, 130, 246, 0.1);
  }

  .notif-icon.follow {
    color: #84cc16;
    background: rgba(132, 204, 22, 0.1);
  }

  .notif-icon.share {
    color: #8b5cf6;
    background: rgba(139, 92, 246, 0.1);
  }

  .notif-icon.unlock {
    color: #f59e0b;
    background: rgba(245, 158, 11, 0.1);
  }

  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    gap: 16px;
  }

  .loading-spinner {
    width: 48px;
    height: 48px;
    border: 4px solid rgba(132, 204, 22, 0.2);
    border-top-color: #84cc16;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .loading-text {
    color: #737373;
    font-size: 14px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    text-align: center;
  }

  .empty-state-icon {
    font-size: 64px;
    margin-bottom: 16px;
    opacity: 0.3;
  }

  .empty-state-text {
    color: #737373;
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 8px;
  }

  .empty-state-hint {
    color: #525252;
    font-size: 13px;
    line-height: 1.6;
    max-width: 300px;
  }

  .settings-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 12px;
    padding: 10px 20px;
    background: rgba(132, 204, 22, 0.1);
    border: 1px solid rgba(132, 204, 22, 0.3);
    border-radius: 8px;
    color: #84cc16;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .settings-link:hover {
    background: rgba(132, 204, 22, 0.15);
    border-color: #84cc16;
  }

  .settings-content {
    flex: 1;
    overflow-y: auto;
  }
`;

export default NotificationSidebar;
