// ============================================================================
// src/components/Shared/InAppNotificationToast.jsx — v3 DEDUP-SAFE
// ============================================================================
//
// ARCHITECTURE:
//   TWO event sources feed this toast:
//     1. notificationService.on("new_notification", ...) — Supabase realtime
//        INSERT for social/system/paywave/wallet notifications.
//     2. pushService.on("push_received", ...)            — SW bridge fires this
//        when app is focused and a push arrives (could be a DM or a notif).
//
// DEDUPLICATION STRATEGY:
//   • Every shown toast is tracked by a `shownId` (notification id or a hash
//     of the push payload title+body+timestamp).
//   • Before showing, we check the shown-ids set (TTL 10s). If already shown,
//     we skip silently. This handles the race where both events fire for the
//     same notification.
//   • "push_received" payloads that carry a `data.notification_id` are matched
//     against notificationService's cache — if the realtime event already fired
//     for that id, the push is a duplicate and skipped.
//
// TOAST MODEL:
//   • Max 3 toasts visible at once (oldest auto-dismissed first).
//   • Each toast auto-dismisses after `duration` ms (default 5s).
//   • Tap navigates via `navigate` prop.
//   • Slide-in from top-right on desktop, top on mobile.
//
// Props:
//   navigate  (path: string) => void   — called on toast tap
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import { X, Bell, MessageCircle, Heart, UserPlus, Wallet, Zap } from "lucide-react";
import notificationService from "../../services/notifications/notificationService";
import { pushService } from "../../services/notifications/pushService";

// ── Constants ─────────────────────────────────────────────────────────────────
const MAX_TOASTS   = 3;
const DEFAULT_TTL  = 5000;
const DEDUP_TTL_MS = 10_000;

// ── Icon resolver ─────────────────────────────────────────────────────────────
function resolveIcon(type) {
  switch (type) {
    case "like":              return <Heart size={14} color="#ef4444" />;
    case "comment":
    case "comment_reply":     return <MessageCircle size={14} color="#3b82f6" />;
    case "follow":            return <UserPlus size={14} color="#84cc16" />;
    case "message":
    case "dm":                return <MessageCircle size={14} color="#84cc16" />;
    case "payment_confirmed":
    case "transfer_received":
    case "transfer_sent":     return <Wallet size={14} color="#a3e635" />;
    case "stake_update":      return <Zap size={14} color="#a855f7" />;
    default:                  return <Bell size={14} color="#84cc16" />;
  }
}

// ── Color map ─────────────────────────────────────────────────────────────────
function resolveAccent(type) {
  switch (type) {
    case "like":              return "#ef4444";
    case "comment":
    case "comment_reply":     return "#3b82f6";
    case "follow":            return "#84cc16";
    case "message":
    case "dm":                return "#84cc16";
    case "payment_confirmed":
    case "transfer_received": return "#a3e635";
    case "transfer_sent":     return "#f87171";
    case "stake_update":      return "#a855f7";
    default:                  return "#84cc16";
  }
}

// ── Unique toast id generator ─────────────────────────────────────────────────
let _seq = 0;
function nextId() { return `toast_${++_seq}_${Date.now()}`; }

// ── Main component ────────────────────────────────────────────────────────────
const InAppNotificationToast = ({ navigate }) => {
  const [toasts, setToasts] = useState([]);

  // Set of deduplication keys (notification db id OR content hash), TTL-cleared
  const shownIds = useRef(new Set());

  const markShown = useCallback((key) => {
    shownIds.current.add(key);
    setTimeout(() => shownIds.current.delete(key), DEDUP_TTL_MS);
  }, []);

  const isDuplicate = useCallback((key) => shownIds.current.has(key), []);

  // ── Add toast ──────────────────────────────────────────────────────────────
  const addToast = useCallback((toast) => {
    setToasts((prev) => {
      // If already at max, drop the oldest
      const next = prev.length >= MAX_TOASTS ? prev.slice(1) : prev;
      return [...next, { id: nextId(), duration: DEFAULT_TTL, ...toast }];
    });
  }, []);

  // ── Dismiss toast ──────────────────────────────────────────────────────────
  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Auto-dismiss ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) =>
      setTimeout(() => dismiss(t.id), t.duration),
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismiss]);

  // ── Listen to notificationService realtime events ─────────────────────────
  useEffect(() => {
    const unsub = notificationService.on("new_notification", (raw) => {
      // raw is the DB row (not yet enriched with actor join)
      const dedupKey = raw.id;
      if (isDuplicate(dedupKey)) return;
      markShown(dedupKey);

      addToast({
        dedupKey,
        type:        raw.type    || "general",
        title:       "Xeevia",
        message:     raw.message || "You have a new notification",
        url:         null, // resolved later if user taps
        accent:      resolveAccent(raw.type),
        icon:        resolveIcon(raw.type),
        rawNotifId:  raw.id,
      });
    });
    return unsub;
  }, [addToast, isDuplicate, markShown]);

  // ── Listen to pushService "push_received" (SW → app bridge) ──────────────
  // This fires when the SW received a push while the app was focused.
  // It might duplicate a "new_notification" event (same row, just via push).
  // We deduplicate by notification_id in payload.data if present,
  // otherwise by a content hash.
  useEffect(() => {
    const unsub = pushService.on("push_received", (payload) => {
      // Try to get a stable dedup key
      const notifId   = payload?.data?.notification_id || payload?.data?.entity_id;
      const dedupKey  = notifId
        ? `push_${notifId}`
        : `push_${payload?.title}_${payload?.body}`.slice(0, 80);

      // Also check if this notification id was already shown via realtime event
      if (notifId && isDuplicate(notifId))   return; // realtime beat the push
      if (isDuplicate(dedupKey))              return;
      markShown(dedupKey);
      if (notifId) markShown(notifId); // cross-dedup future realtime event

      const type = payload?.data?.type || "general";
      addToast({
        dedupKey,
        type,
        title:   payload?.title || "Xeevia",
        message: payload?.body  || "You have a new notification",
        url:     payload?.data?.url || null,
        accent:  resolveAccent(type),
        icon:    resolveIcon(type),
      });
    });
    return unsub;
  }, [addToast, isDuplicate, markShown]);

  // ── Tap handler ────────────────────────────────────────────────────────────
  const handleTap = useCallback((toast) => {
    dismiss(toast.id);
    if (!navigate) return;

    // If we have a direct URL use it
    if (toast.url) { navigate(toast.url); return; }

    // Otherwise try to resolve from notificationService cache
    if (toast.rawNotifId && notificationService._cache) {
      const cached = notificationService._cache.find((n) => n.id === toast.rawNotifId);
      if (cached) {
        // Simple resolver (mirrors NotificationSidebar)
        const url = resolveNotifUrl(cached);
        if (url) navigate(url);
      }
    }
  }, [navigate, dismiss]);

  if (toasts.length === 0) return null;

  return (
    <>
      <div className="iant__stack" aria-live="polite" aria-label="Notifications">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="iant__toast"
            style={{ "--accent": t.accent }}
            role="alert"
            onClick={() => handleTap(t)}
          >
            <div className="iant__icon-wrap">{t.icon}</div>
            <div className="iant__body">
              <div className="iant__title">{t.title}</div>
              <div className="iant__msg">{t.message}</div>
            </div>
            <button
              className="iant__close"
              onClick={(e) => { e.stopPropagation(); dismiss(t.id); }}
              aria-label="Dismiss"
            >
              <X size={12} />
            </button>
            <div
              className="iant__progress"
              style={{ animationDuration: `${t.duration}ms` }}
            />
          </div>
        ))}
      </div>
      <style>{CSS}</style>
    </>
  );
};

// ── URL resolver (mirrors NotificationSidebar resolveUrl) ────────────────────
function resolveNotifUrl(notif) {
  const { type, entity_id, actor } = notif;
  const actorId = actor?.id;
  switch (type) {
    case "like":
    case "comment":
    case "comment_reply":
    case "mention":
    case "new_post":
    case "share":          return entity_id ? `/post/${entity_id}`    : null;
    case "new_reel":       return entity_id ? `/reel/${entity_id}`    : null;
    case "new_story":
    case "unlock":
    case "story_unlocked_by_you": return entity_id ? `/story/${entity_id}` : null;
    case "follow":
    case "profile_view":   return actorId   ? `/profile/${actorId}`  : null;
    case "milestone_followers":
    case "payment_confirmed": return "/account";
    default: return null;
  }
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
  .iant__stack {
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 99999;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: 340px;
    width: calc(100vw - 32px);
    pointer-events: none;
  }

  @media (max-width: 768px) {
    .iant__stack {
      top: 12px;
      right: 8px;
      left: 8px;
      max-width: none;
      width: auto;
    }
  }

  .iant__toast {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 36px 12px 12px;
    background: rgba(10, 10, 10, 0.97);
    border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
    border-radius: 14px;
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.7),
      0 0 0 1px color-mix(in srgb, var(--accent) 8%, transparent);
    backdrop-filter: blur(16px);
    cursor: pointer;
    pointer-events: all;
    overflow: hidden;
    animation: iant_in 0.32s cubic-bezier(0.22, 1, 0.36, 1) both;
    transition: transform 0.15s, box-shadow 0.15s;
  }

  .iant__toast:hover {
    transform: translateY(-1px);
    box-shadow:
      0 12px 40px rgba(0, 0, 0, 0.8),
      0 0 0 1px color-mix(in srgb, var(--accent) 20%, transparent);
  }

  @keyframes iant_in {
    from { opacity: 0; transform: translateX(24px) scale(0.95); }
    to   { opacity: 1; transform: translateX(0)    scale(1);    }
  }

  @media (max-width: 768px) {
    @keyframes iant_in {
      from { opacity: 0; transform: translateY(-16px) scale(0.95); }
      to   { opacity: 1; transform: translateY(0)     scale(1);    }
    }
  }

  .iant__icon-wrap {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .iant__body {
    flex: 1;
    min-width: 0;
  }

  .iant__title {
    font-size: 11px;
    font-weight: 700;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 2px;
  }

  .iant__msg {
    font-size: 12.5px;
    color: #d4d4d4;
    line-height: 1.45;
    word-break: break-word;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .iant__close {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 22px;
    height: 22px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.06);
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #555;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    pointer-events: all;
  }

  .iant__close:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
  }

  /* Progress bar — drains over toast duration */
  .iant__progress {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 2px;
    width: 100%;
    background: color-mix(in srgb, var(--accent) 50%, transparent);
    transform-origin: left;
    animation: iant_drain linear forwards;
    animation-duration: inherit;
  }

  @keyframes iant_drain {
    from { transform: scaleX(1); }
    to   { transform: scaleX(0); }
  }
`;

export default InAppNotificationToast;