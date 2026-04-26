// ============================================================================
// src/components/Shared/InAppNotificationToast.jsx — v6 DEDUP + WIRED
// ============================================================================
// Built directly on your exact v5 code you shared.
// Only added: stronger deduplication using contentKey to prevent duplicate toasts
// (especially for likes, follows, comments that may arrive from multiple sources).

import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import notificationService from "../../services/notifications/notificationService";
import { pushService }     from "../../services/notifications/pushService";
import mediaUrlService     from "../../services/shared/mediaUrlService";

const TOAST_DURATION = 5000;
const MAX_TOASTS     = 3;

// Type → emoji
const TYPE_EMOJI = {
  like:                  "❤️",
  comment:               "💬",
  comment_reply:         "↩️",
  follow:                "👤",
  profile_view:          "👁️",
  share:                 "🔗",
  new_post:              "📝",
  new_reel:              "🎬",
  new_story:             "📖",
  milestone_followers:   "🏆",
  payment_confirmed:     "💳",
  mention:               "@",
  dm:                    "💬",
  incoming_call:         "📞",
  general:               "🔔",
};

// ── Single toast item (your exact component) ────────────────────────────────
const ToastItem = memo(({ toast, onDismiss, onNavigate }) => {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));

    timerRef.current = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(toast.id), 350);
    }, toast.duration || TOAST_DURATION);

    return () => clearTimeout(timerRef.current);
  }, [toast.id]);

  const handleClick = useCallback(() => {
    clearTimeout(timerRef.current);
    setVisible(false);
    setTimeout(() => {
      onDismiss(toast.id);
      if (toast.url && onNavigate) onNavigate(toast.url);
    }, 200);
  }, [toast, onDismiss, onNavigate]);

  const handleDismiss = useCallback((e) => {
    e.stopPropagation();
    clearTimeout(timerRef.current);
    setVisible(false);
    setTimeout(() => onDismiss(toast.id), 300);
  }, [toast.id, onDismiss]);

  const emoji = TYPE_EMOJI[toast.type] || "🔔";

  return (
    <div
      className={`iant-toast${visible ? " iant-visible" : " iant-hidden"}`}
      onClick={handleClick}
      role="alert"
      aria-live="polite"
    >
      <div className="iant-left">
        {toast.avatar ? (
          <div className="iant-avatar">
            <img
              src={toast.avatar}
              alt=""
              onError={e => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }}
            />
            <span className="iant-avatar-fb" style={{ display: "none" }}>
              {toast.actorName?.charAt(0)?.toUpperCase() || "?"}
            </span>
            <span className="iant-type-badge">{emoji}</span>
          </div>
        ) : (
          <div className="iant-emoji-avatar">
            <span>{emoji}</span>
          </div>
        )}
      </div>

      <div className="iant-body">
        {toast.title && <div className="iant-title">{toast.title}</div>}
        <div className="iant-msg">{toast.message}</div>
      </div>

      <button
        className="iant-close"
        onClick={handleDismiss}
        aria-label="Dismiss"
      >×</button>
    </div>
  );
});
ToastItem.displayName = "ToastItem";

// ── Main component (your v5 + stronger dedup) ───────────────────────────────
const InAppNotificationToast = ({ navigate, addToastRef }) => {
  const [toasts, setToasts]   = useState([]);
  const seenIds               = useRef(new Set());   // row.id dedup
  const seenContentKeys       = useRef(new Map());   // content fingerprint dedup

  const addToast = useCallback((toast) => {
    if (!toast?.id && !toast?.message) return;

    const id  = toast.id || `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const contentKey = toast.contentKey || `${toast.type}:${toast.message || ''}`;

    // Strong deduplication
    if (seenIds.current.has(id)) return;
    if (seenContentKeys.current.has(contentKey)) return;

    seenIds.current.add(id);
    seenContentKeys.current.set(contentKey, Date.now());

    // Cleanup old entries
    setTimeout(() => seenIds.current.delete(id), 30000);
    setTimeout(() => seenContentKeys.current.delete(contentKey), 45000);

    setToasts(prev => {
      const next = [{ ...toast, id }, ...prev];
      return next.slice(0, MAX_TOASTS);
    });
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Expose addToast via ref for App.jsx (your original)
  useEffect(() => {
    if (addToastRef) {
      addToastRef.current = (toastData) => {
        addToast({
          id:      `ext_${Date.now()}`,
          type:    toastData.type    || "general",
          title:   toastData.title   || null,
          message: toastData.message || "",
          url:     toastData.data?.url || null,
          avatar:  null,
          duration: 5000,
        });
      };
    }
  }, [addToastRef, addToast]);

  // Listen on notificationService (your original + dedup)
  useEffect(() => {
    const unsub = notificationService.on("new_notification", (row) => {
      if (!row?.type || !row?.message) return;

      addToast({
        id:         `notif_${row.id}`,
        contentKey: `notif_${row.id}`,
        type:       row.type,
        title:      null,
        message:    row.message,
        actorName:  null,
        avatar:     null,
        url:        _resolveUrl(row),
        duration:   5500,
      });
    });

    return unsub;
  }, [addToast]);

  // Listen on pushService (your original)
  useEffect(() => {
    const unsub = pushService.on("push_received", (payload) => {
      if (!payload) return;
      const data = payload.data || {};
      const type = data.type || "general";

      if (type === "incoming_call") return; // handled by IncomingCallToast

      const id         = data.notification_id || `push_${Date.now()}`;
      const contentKey = `push_${id}`;

      addToast({
        id,
        contentKey,
        type,
        title:   payload.title || null,
        message: payload.body  || data.message || "",
        avatar:  null,
        url:     data.url || "/",
        duration: 5000,
      });
    });

    return unsub;
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <>
      <div className="iant-container" aria-label="Notifications">
        {toasts.map(toast => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDismiss={dismissToast}
            onNavigate={navigate}
          />
        ))}
      </div>
      <style>{CSS}</style>
    </>
  );
};

// Resolve deep-link URL (your exact function)
function _resolveUrl(row) {
  const { type, entity_id, actor_user_id } = row;
  switch (type) {
    case "like":
    case "comment":
    case "comment_reply":
    case "mention":
    case "new_post":
    case "share":        return entity_id ? `/post/${entity_id}` : "/";
    case "new_reel":     return entity_id ? `/reel/${entity_id}` : "/";
    case "new_story":    return entity_id ? `/story/${entity_id}` : "/";
    case "follow":
    case "profile_view": return actor_user_id ? `/profile/${actor_user_id}` : "/";
    case "payment_confirmed":
    case "milestone_followers": return "/account";
    case "dm":           return "/messages";
    default:             return "/";
  }
}

const CSS = `
  .iant-container {
    position: fixed;
    top: calc(env(safe-area-inset-top, 0px) + 12px);
    right: 12px;
    z-index: 99990;
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: none;
    max-width: min(360px, calc(100vw - 24px));
  }

  .iant-toast {
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(8, 8, 8, 0.98);
    border: 1px solid rgba(132, 204, 22, 0.2);
    border-radius: 16px;
    padding: 12px 14px;
    cursor: pointer;
    pointer-events: all;
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.7),
      0 0 0 1px rgba(132, 204, 22, 0.05);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease;
    transform: translateX(110%);
    opacity: 0;
    will-change: transform, opacity;
  }

  .iant-toast.iant-visible {
    transform: translateX(0);
    opacity: 1;
  }

  .iant-toast.iant-hidden {
    transform: translateX(110%);
    opacity: 0;
  }

  .iant-toast:hover {
    border-color: rgba(132, 204, 22, 0.4);
    background: rgba(12, 12, 12, 0.99);
  }

  .iant-left { flex-shrink: 0; }

  .iant-avatar {
    position: relative;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: linear-gradient(135deg, #1a1a1a, #222);
    border: 2px solid rgba(132, 204, 22, 0.2);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .iant-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .iant-avatar-fb {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    font-weight: 800;
    color: #84cc16;
  }
  .iant-type-badge {
    position: absolute;
    bottom: -2px;
    right: -4px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: rgba(8, 8, 8, 0.95);
    border: 1.5px solid rgba(132, 204, 22, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
  }

  .iant-emoji-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(132, 204, 22, 0.08);
    border: 1.5px solid rgba(132, 204, 22, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
  }

  .iant-body {
    flex: 1;
    min-width: 0;
  }

  .iant-title {
    font-size: 11px;
    font-weight: 800;
    color: #84cc16;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .iant-msg {
    font-size: 13px;
    color: #c4c4c4;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    word-break: break-word;
  }

  .iant-close {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #555;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.15s;
    line-height: 1;
  }
  .iant-close:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  @media (max-width: 480px) {
    .iant-container {
      top: calc(env(safe-area-inset-top, 0px) + 8px);
      right: 8px;
      left: 8px;
      max-width: none;
    }
  }
`;

export default InAppNotificationToast;