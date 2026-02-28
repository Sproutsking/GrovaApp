// ============================================================================
// src/components/Shared/InAppNotificationToast.jsx
// ============================================================================
// Listens to:
//   1. notificationService "new_notification" → realtime DB insert
//   2. pushService "push_received" → SW message when app is focused
//
// Shows a native-feeling toast for 5 seconds, stacks up to 3.
// Clicking navigates to the right screen.
// ============================================================================

import React, { useState, useEffect, useCallback, useRef } from "react";
import notificationService from "../../services/notifications/notificationService";
import pushService from "../../services/notifications/pushService";

// ── Icon map ─────────────────────────────────────────────────────────────────
const TYPE_ICON = {
  like:                   "❤️",
  comment:                "💬",
  comment_reply:          "↩️",
  follow:                 "👤",
  profile_view:           "👁️",
  unlock:                 "🔓",
  share:                  "🔁",
  new_post:               "📝",
  new_story:              "📖",
  new_reel:               "🎬",
  story_unlocked_by_you:  "✅",
  milestone_followers:    "🎉",
  payment_confirmed:      "💳",
  mention:                "📣",
};

const TYPE_URL = {
  like:                   (n) => n.entity_id ? `/post/${n.entity_id}`    : "/",
  comment:                (n) => n.entity_id ? `/post/${n.entity_id}`    : "/",
  comment_reply:          (n) => n.entity_id ? `/post/${n.entity_id}`    : "/",
  share:                  (n) => n.entity_id ? `/post/${n.entity_id}`    : "/",
  new_post:               (n) => n.entity_id ? `/post/${n.entity_id}`    : "/",
  new_reel:               (n) => n.entity_id ? `/reel/${n.entity_id}`    : "/",
  new_story:              (n) => n.entity_id ? `/story/${n.entity_id}`   : "/",
  story_unlocked_by_you:  (n) => n.entity_id ? `/story/${n.entity_id}`   : "/",
  unlock:                 (n) => n.entity_id ? `/story/${n.entity_id}`   : "/",
  follow:                 (n) => n.actor_user_id ? `/profile/${n.actor_user_id}` : "/",
  profile_view:           (n) => n.actor_user_id ? `/profile/${n.actor_user_id}` : "/",
  milestone_followers:    ()  => "/account",
  payment_confirmed:      ()  => "/account",
  mention:                (n) => n.entity_id ? `/post/${n.entity_id}`    : "/",
};

function getUrl(notification) {
  const fn = TYPE_URL[notification.type];
  return fn ? fn(notification) : "/";
}

// ── Single toast ─────────────────────────────────────────────────────────────
function Toast({ toast, onDismiss, onNavigate }) {
  const [exiting, setExiting] = useState(false);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 300);
  }, [toast.id, onDismiss]);

  useEffect(() => {
    const t = setTimeout(dismiss, 5000);
    return () => clearTimeout(t);
  }, [dismiss]);

  const icon    = TYPE_ICON[toast.type] || "🔔";
  const isMilestone = toast.type === "milestone_followers" || toast.type === "payment_confirmed";

  return (
    <div
      className={`xv-toast ${exiting ? "xv-toast--exit" : "xv-toast--enter"} ${isMilestone ? "xv-toast--special" : ""}`}
      onClick={() => { onNavigate(getUrl(toast)); dismiss(); }}
    >
      {/* Avatar or icon */}
      <div className="xv-toast__avatar">
        {toast.actor_avatar ? (
          <img src={toast.actor_avatar} alt="" className="xv-toast__avatar-img" />
        ) : (
          <span className="xv-toast__avatar-icon">{icon}</span>
        )}
        <span className="xv-toast__type-badge">{icon}</span>
      </div>

      {/* Content */}
      <div className="xv-toast__body">
        <p className="xv-toast__message">{toast.message}</p>
        {toast.preview && (
          <p className="xv-toast__preview">"{toast.preview}"</p>
        )}
        <p className="xv-toast__time">Just now</p>
      </div>

      {/* Dismiss */}
      <button
        className="xv-toast__close"
        onClick={(e) => { e.stopPropagation(); dismiss(); }}
        aria-label="Dismiss"
      >
        ×
      </button>

      {/* Progress bar */}
      <div className="xv-toast__progress" />

      <style jsx>{`
        .xv-toast {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          background: rgba(10, 10, 10, 0.96);
          border: 1px solid rgba(132, 204, 22, 0.25);
          border-left: 3px solid #84cc16;
          border-radius: 14px;
          width: 340px;
          max-width: calc(100vw - 32px);
          cursor: pointer;
          position: relative;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(132, 204, 22, 0.1);
          backdrop-filter: blur(20px);
          transition: transform 0.15s ease, opacity 0.15s ease;
        }
        .xv-toast:hover {
          border-color: rgba(132, 204, 22, 0.5);
          transform: translateX(-4px);
        }
        .xv-toast--special {
          border-left-color: #f59e0b;
          border-color: rgba(245, 158, 11, 0.3);
        }
        .xv-toast--enter {
          animation: toastSlideIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .xv-toast--exit {
          animation: toastSlideOut 0.3s ease forwards;
        }
        @keyframes toastSlideIn {
          from { transform: translateX(120%); opacity: 0; }
          to   { transform: translateX(0);   opacity: 1; }
        }
        @keyframes toastSlideOut {
          from { transform: translateX(0);   opacity: 1; max-height: 100px; }
          to   { transform: translateX(120%); opacity: 0; max-height: 0; padding: 0; margin: 0; }
        }
        .xv-toast__avatar {
          position: relative;
          flex-shrink: 0;
          width: 42px;
          height: 42px;
        }
        .xv-toast__avatar-img {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid rgba(132, 204, 22, 0.4);
        }
        .xv-toast__avatar-icon {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: rgba(132, 204, 22, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          border: 2px solid rgba(132, 204, 22, 0.3);
        }
        .xv-toast__type-badge {
          position: absolute;
          bottom: -2px;
          right: -4px;
          font-size: 13px;
          line-height: 1;
          background: #000;
          border-radius: 50%;
          padding: 1px;
        }
        .xv-toast__body {
          flex: 1;
          min-width: 0;
        }
        .xv-toast__message {
          font-size: 13.5px;
          font-weight: 600;
          color: #e5e5e5;
          margin: 0 0 2px 0;
          line-height: 1.3;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .xv-toast__preview {
          font-size: 12px;
          color: #737373;
          margin: 0 0 2px 0;
          font-style: italic;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .xv-toast__time {
          font-size: 11px;
          color: #525252;
          margin: 0;
        }
        .xv-toast__close {
          background: none;
          border: none;
          color: #525252;
          font-size: 20px;
          line-height: 1;
          cursor: pointer;
          padding: 0 4px;
          flex-shrink: 0;
          transition: color 0.15s;
        }
        .xv-toast__close:hover { color: #e5e5e5; }
        .xv-toast__progress {
          position: absolute;
          bottom: 0;
          left: 0;
          height: 2px;
          background: linear-gradient(90deg, #84cc16, #65a30d);
          animation: toastProgress 5s linear forwards;
          border-radius: 0 0 0 14px;
        }
        @keyframes toastProgress {
          from { width: 100%; }
          to   { width: 0%; }
        }
        .xv-toast--special .xv-toast__progress {
          background: linear-gradient(90deg, #f59e0b, #d97706);
        }
      `}</style>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function InAppNotificationToast({ navigate }) {
  const [toasts, setToasts] = useState([]);
  const seenIds = useRef(new Set());

  const addToast = useCallback((notification) => {
    // Deduplicate by notification id or a hash of type+message
    const dedupeKey = notification.id || `${notification.type}:${notification.message}`;
    if (seenIds.current.has(dedupeKey)) return;
    seenIds.current.add(dedupeKey);

    const toast = {
      id:            notification.id || `${Date.now()}-${Math.random()}`,
      type:          notification.type,
      message:       notification.message,
      entity_id:     notification.entity_id,
      actor_user_id: notification.actor_user_id,
      actor_avatar:  notification.actor?.avatar || notification.actor_avatar || null,
      preview:       notification.metadata?.comment_preview || notification.metadata?.preview || null,
    };

    setToasts((prev) => {
      // Max 3 visible at once — drop oldest
      const next = [toast, ...prev].slice(0, 3);
      return next;
    });
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleNavigate = useCallback((url) => {
    if (navigate) {
      navigate(url);
    } else {
      window.location.href = url;
    }
  }, [navigate]);

  useEffect(() => {
    // Listen to realtime DB notifications
    const unsubNotif = notificationService.on("new_notification", (raw) => {
      // raw is the pg payload (.new row), enrich minimally for display
      addToast({
        id:            raw.id,
        type:          raw.type,
        message:       raw.message,
        entity_id:     raw.entity_id,
        actor_user_id: raw.actor_user_id,
        metadata:      raw.metadata || {},
      });
    });

    // Listen to push messages when app is focused (SW → pushService → here)
    const unsubPush = pushService.on("push_received", (payload) => {
      addToast({
        id:            `push-${Date.now()}`,
        type:          payload.type,
        message:       payload.body || payload.message || "New notification",
        entity_id:     payload.entity_id,
        actor_user_id: payload.actor_user_id,
        actor_avatar:  payload.actor_avatar || null,
        metadata:      {},
      });
    });

    return () => {
      unsubNotif();
      unsubPush();
    };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="xv-toast-stack">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          toast={toast}
          onDismiss={dismiss}
          onNavigate={handleNavigate}
        />
      ))}
      <style jsx>{`
        .xv-toast-stack {
          position: fixed;
          top: 16px;
          right: 16px;
          z-index: 99999;
          display: flex;
          flex-direction: column;
          gap: 10px;
          pointer-events: none;
        }
        .xv-toast-stack > * {
          pointer-events: auto;
        }
        @media (max-width: 480px) {
          .xv-toast-stack {
            top: 8px;
            right: 8px;
            left: 8px;
          }
        }
      `}</style>
    </div>
  );
}