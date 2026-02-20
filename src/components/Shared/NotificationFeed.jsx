import React, { useState, useEffect } from "react";
import { supabase } from "../../services/config/supabase";

const NotificationFeed = ({ userId, onClose }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
    subscribeToNotifications();
  }, [userId]);

  const loadNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select(
          `
          *,
          actor:actor_user_id(id, full_name, username, avatar_id, verified)
        `
        )
        .eq("recipient_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error("Failed to load notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToNotifications = () => {
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_user_id=eq.${userId}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const markAsRead = async (notificationId) => {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
    );
  };

  const markAllAsRead = async () => {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("recipient_user_id", userId)
      .eq("is_read", false);

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
        {notification.actor?.avatar_id ? (
          <img
            src={notification.actor.avatar_id}
            alt={notification.actor.full_name}
          />
        ) : (
          <div className="avatar-placeholder">
            {notification.actor?.full_name?.[0] || "G"}
          </div>
        )}
      </div>
      <div className="notification-content">
        <p className="notification-message">{notification.message}</p>
        <span className="notification-time">
          {formatTime(notification.created_at)}
        </span>
      </div>
    </div>
  );
};

function formatTime(timestamp) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}

export default NotificationFeed;