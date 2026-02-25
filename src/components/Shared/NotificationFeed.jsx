import React, { useState, useEffect, useCallback } from "react";
import notificationService from "../../services/notifications/notificationService";

// ============================================================================
// NotificationFeed
// A simpler feed component (used in other contexts besides the sidebar).
// Reads from notificationService so it stays in sync with everything else.
// ============================================================================

const NotificationFeed = ({ userId, onClose }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    const data = await notificationService.getNotifications(userId, 50, true);
    setNotifications(data);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    load();

    const unsub = notificationService.subscribe(() => {
      const cached = notificationService._cache;
      if (cached) setNotifications([...cached]);
    });

    return unsub;
  }, [userId, load]);

  const markAsRead = async (notificationId) => {
    await notificationService.markAsRead(notificationId);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n)),
    );
  };

  const markAllAsRead = async () => {
    await notificationService.markAllAsRead(userId);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  return (
    <div className="notification-feed">
      <div className="notification-header">
        <h3>Notifications</h3>
        <button onClick={markAllAsRead}>Mark all read</button>
      </div>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : notifications.length === 0 ? (
        <div className="empty">No notifications yet</div>
      ) : (
        <div className="notification-list">
          {notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onRead={markAsRead}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const NotificationItem = ({ notification, onRead }) => {
  const handleClick = () => {
    if (!notification.is_read) {
      onRead(notification.id);
    }
  };

  return (
    <div
      className={`notification-item ${!notification.is_read ? "unread" : ""}`}
      onClick={handleClick}
    >
      <div className="notification-avatar">
        {notification.actor?.avatar ? (
          <img
            src={notification.actor.avatar}
            alt={notification.actor.name}
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
        ) : (
          <div className="avatar-placeholder">
            {notification.actor?.name?.[0]?.toUpperCase() || "G"}
          </div>
        )}
      </div>
      <div className="notification-content">
        <p className="notification-message">{notification.message}</p>
        <span className="notification-time">
          {formatTime(notification.created_at)}
        </span>
      </div>
      {!notification.is_read && <div className="unread-dot" />}
    </div>
  );
};

function formatTime(timestamp) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}

export default NotificationFeed;
