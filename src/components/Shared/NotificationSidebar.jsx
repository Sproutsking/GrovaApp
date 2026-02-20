import React, { useState, useEffect } from "react";
import {
  X,
  Heart,
  MessageCircle,
  UserPlus,
  Share2,
  Unlock,
  CheckCheck,
  Settings,
} from "lucide-react";
import { supabase } from "../../services/config/supabase";
import mediaUrlService from "../../services/shared/mediaUrlService";
import SettingsSection from "../Account/SettingsSection";
import UserProfileModal from "../Modals/UserProfileModal";

const NotificationSidebar = ({ isOpen, onClose, isMobile, currentUser }) => {
  const [notifications, setNotifications] = useState([]);
  const [userId, setUserId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    if (isOpen && currentUser?.id) {
      setUserId(currentUser.id);
      loadNotifications();
      subscribeToNotifications();
    }
  }, [isOpen, currentUser]);

  const loadNotifications = async () => {
    try {
      if (!currentUser?.id) return;

      const { data, error } = await supabase
        .from("notifications")
        .select(
          `
          *,
          actor:actor_user_id(id, full_name, username, avatar_id, verified)
        `,
        )
        .eq("recipient_user_id", currentUser.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const enrichedNotifications = (data || []).map((notif) => ({
        id: notif.id,
        type: notif.type,
        message: notif.message,
        is_read: notif.is_read,
        created_at: notif.created_at,
        entity_id: notif.entity_id,
        actor: notif.actor
          ? {
              id: notif.actor.id,
              name: notif.actor.full_name,
              username: notif.actor.username,
              avatar: notif.actor.avatar_id
                ? mediaUrlService.getImageUrl(notif.actor.avatar_id, {
                    width: 100,
                    height: 100,
                  })
                : null,
              verified: notif.actor.verified,
            }
          : {
              id: null,
              name: "Someone",
              username: "user",
              avatar: null,
              verified: false,
            },
      }));

      setNotifications(enrichedNotifications);
    } catch (error) {
      console.error("❌ Failed to load notifications:", error);
      setNotifications([]);
    }
  };

  const subscribeToNotifications = () => {
    if (!currentUser?.id) return;

    const channel = supabase
      .channel(`notifications:${currentUser.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_user_id=eq.${currentUser.id}`,
        },
        () => {
          loadNotifications();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `recipient_user_id=eq.${currentUser.id}`,
        },
        () => {
          loadNotifications();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
      case "profile_view":
        return <UserPlus size={20} className="notif-icon follow" />;
      default:
        return <Heart size={20} className="notif-icon" />;
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
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("recipient_user_id", userId)
        .eq("is_read", false);

      if (error) throw error;

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const handleUserClick = (notification, e) => {
    e?.stopPropagation();

    if (!notification.actor || !notification.actor.id) return;

    const userData = {
      id: notification.actor.id,
      user_id: notification.actor.id,
      name: notification.actor.name,
      author: notification.actor.name,
      avatar: notification.actor.avatar,
      verified: notification.actor.verified || false,
    };

    setSelectedUser(userData);
    setShowUserProfile(true);
    onClose();
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.is_read) {
      try {
        const { error } = await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("id", notification.id);

        if (!error) {
          setNotifications((prev) =>
            prev.map((n) =>
              n.id === notification.id ? { ...n, is_read: true } : n,
            ),
          );
        }
      } catch (error) {
        console.error("Failed to mark as read:", error);
      }
    }
  };

  if (!isOpen && !showUserProfile) return null;

  if (showSettings) {
    return (
      <>
        <div
          className="notification-sidebar-overlay"
          onClick={() => setShowSettings(false)}
        >
          <div
            className="notification-sidebar settings-view"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="notification-header">
              <button
                onClick={() => setShowSettings(false)}
                className="close-btn"
              >
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

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <>
      {isOpen && (
        <div className="notification-sidebar-overlay" onClick={onClose}>
          <div
            className="notification-sidebar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="notification-header">
              <div className="notification-title">Notifications</div>
              <div className="notification-actions">
                {unreadCount > 0 && (
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
              {notifications.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🔔</div>
                  <div className="empty-state-text">No notifications yet</div>
                  <div className="empty-state-hint">
                    When someone interacts with your content, you'll see it
                    here.
                  </div>
                  <button
                    className="settings-link"
                    onClick={() => setShowSettings(true)}
                  >
                    <Settings size={16} />
                    Notification Settings
                  </button>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`notification-item ${!notification.is_read ? "unread" : ""}`}
                    onClick={() => handleNotificationClick(notification)}
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
                        {notification.message}
                      </div>

                      <div className="notification-time">
                        {getTimeAgo(notification.created_at)}
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

      {showUserProfile && selectedUser && (
        <UserProfileModal
          user={selectedUser}
          onClose={() => {
            setShowUserProfile(false);
            setSelectedUser(null);
          }}
          currentUser={currentUser}
        />
      )}

      <style jsx>{getStyles()}</style>
    </>
  );
};

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
    from { opacity: 0; }
    to { opacity: 1; }
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
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }

  @media (max-width: 768px) {
    .notification-sidebar {
      width: 100%;
      border-left: none;
      border-radius: 24px 24px 0 0;
      bottom: 0;
      top: 0;
      height: 100vh;
      animation: slideInUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    @keyframes slideInUp {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
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
