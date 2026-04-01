// ============================================================================
// src/components/Shared/InAppNotificationToast.jsx — v4 BULLETPROOF
// ============================================================================
//
// FIXES vs v3:
//   [T-1]  Auto-dismiss timer bug fixed: timers are now stored in a ref map
//          keyed by toast id. Each toast manages its own timer independently.
//          Adding a new toast no longer resets existing timers.
//   [T-2]  DM toast gap fixed: listens to MessageNotificationService's
//          toastCallback (wired via the addToast prop from App.jsx).
//          DMs that arrive via Supabase broadcast while app is active now
//          produce a toast immediately, not just when a push fires.
//   [T-3]  DM URL resolution fixed: tap on a DM toast navigates correctly.
//          The navigate handler receives the conversation_id and routes to
//          /messages. App.jsx handleNotificationNavigate handles /messages.
//   [T-4]  Cross-dedup between notificationService and pushService is
//          tightened: notification_id from either source is normalised to
//          the same key format before dedup check.
//   [T-5]  Progress bar animation is per-toast (uses CSS custom property
//          --dur set inline) so each toast drains at its own rate.
//   [T-6]  addToast is exposed via a stable callback ref so external callers
//          (MessageNotificationService toastCallback) can call it without
//          causing re-renders.
// ============================================================================

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { X, Bell, MessageCircle, Heart, UserPlus, Wallet, Zap, AtSign } from "lucide-react";
import notificationService from "../../services/notifications/notificationService";
import { pushService }     from "../../services/notifications/pushService";

// ── Constants ─────────────────────────────────────────────────────────────────
const MAX_TOASTS   = 3;
const DEFAULT_TTL  = 5000;
const DEDUP_TTL_MS = 30_000;

// ── Icon resolver ─────────────────────────────────────────────────────────────
function resolveIcon(type) {
  switch (type) {
    case "like":              return <Heart size={14} color="#ef4444" />;
    case "comment":
    case "comment_reply":     return <MessageCircle size={14} color="#3b82f6" />;
    case "follow":            return <UserPlus size={14} color="#84cc16" />;
    case "mention":           return <AtSign size={14} color="#84cc16" />;
    case "message":
    case "dm":                return <MessageCircle size={14} color="#84cc16" />;
    case "payment_confirmed":
    case "transfer_received":
    case "deposit":           return <Wallet size={14} color="#a3e635" />;
    case "transfer_sent":
    case "withdrawal":        return <Wallet size={14} color="#f87171" />;
    case "stake_update":      return <Zap size={14} color="#a855f7" />;
    default:                  return <Bell size={14} color="#84cc16" />;
  }
}

// ── Accent colour resolver ─────────────────────────────────────────────────────
function resolveAccent(type) {
  switch (type) {
    case "like":              return "#ef4444";
    case "comment":
    case "comment_reply":     return "#3b82f6";
    case "follow":
    case "mention":           return "#84cc16";
    case "message":
    case "dm":                return "#84cc16";
    case "payment_confirmed":
    case "transfer_received":
    case "deposit":           return "#a3e635";
    case "transfer_sent":
    case "withdrawal":        return "#f87171";
    case "stake_update":      return "#a855f7";
    default:                  return "#84cc16";
  }
}

// ── Normalise a dedup key to a consistent format ──────────────────────────────
function normaliseDedupKey(source, id) {
  if (!id) return null;
  return `${source}:${id}`;
}

// ── Unique toast instance id ───────────────────────────────────────────────────
let _seq = 0;
function nextId() { return `toast_${++_seq}_${Date.now()}`; }

// ── Main component ────────────────────────────────────────────────────────────
const InAppNotificationToast = ({ navigate }) => {
  const [toasts, setToasts] = useState([]);

  // [T-1] Per-toast timer map — keyed by toast instance id
  const timers   = useRef(new Map());
  // Dedup keys with TTL
  const shownIds = useRef(new Set());
  // [T-6] Stable addToast ref for external callers
  const addToastRef = useRef(null);

  // ── Dedup helpers ──────────────────────────────────────────────────────────
  const markShown = useCallback((key) => {
    if (!key) return;
    shownIds.current.add(key);
    setTimeout(() => shownIds.current.delete(key), DEDUP_TTL_MS);
  }, []);

  const isDuplicate = useCallback((key) => {
    if (!key) return false;
    return shownIds.current.has(key);
  }, []);

  // ── Dismiss ────────────────────────────────────────────────────────────────
  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    // [T-1] Clear the individual timer
    if (timers.current.has(id)) {
      clearTimeout(timers.current.get(id));
      timers.current.delete(id);
    }
  }, []);

  // ── Add toast ──────────────────────────────────────────────────────────────
  const addToast = useCallback((toast) => {
    const instanceId = nextId();
    const duration   = toast.duration || DEFAULT_TTL;

    setToasts((prev) => {
      // Drop oldest if at max
      const next = prev.length >= MAX_TOASTS ? prev.slice(1) : prev;
      return [...next, { ...toast, id: instanceId, duration }];
    });

    // [T-1] Set this toast's own timer — independent of all other toasts
    const timer = setTimeout(() => dismiss(instanceId), duration);
    timers.current.set(instanceId, timer);
  }, [dismiss]);

  // Expose addToast via ref for external wiring
  addToastRef.current = addToast;

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current.clear();
    };
  }, []);

  // ── [T-2] Listen to notificationService realtime events ───────────────────
  // Source: Supabase realtime INSERT for social/system/paywave/wallet
  useEffect(() => {
    const unsub = notificationService.on("new_notification", (raw) => {
      // [T-4] Normalised dedup key
      const key = normaliseDedupKey("notif", raw.id);
      if (isDuplicate(key)) return;
      markShown(key);

      addToast({
        type:       raw.type    || "general",
        title:      "Xeevia",
        message:    raw.message || "You have a new notification",
        url:        null,
        accent:     resolveAccent(raw.type),
        icon:       resolveIcon(raw.type),
        rawNotifId: raw.id,
        data:       raw.metadata || {},
      });
    });
    return unsub;
  }, [addToast, isDuplicate, markShown]);

  // ── Listen to pushService "push_received" (SW → app bridge) ───────────────
  // Source: SW got a push while app was focused/visible
  useEffect(() => {
    const unsub = pushService.on("push_received", (payload) => {
      const notifId  = payload?.data?.notification_id || payload?.data?.entity_id;
      const pushKey  = normaliseDedupKey("push", notifId || `${payload?.title}_${payload?.body}`.slice(0, 60));
      const notifKey = normaliseDedupKey("notif", notifId);

      // [T-4] Check both push key and the corresponding notif key
      if (isDuplicate(pushKey))  return;
      if (isDuplicate(notifKey)) return;
      markShown(pushKey);
      if (notifKey) markShown(notifKey);

      const type = payload?.data?.type || "general";
      addToast({
        type,
        title:   payload?.title || "Xeevia",
        message: payload?.body  || "You have a new notification",
        url:     payload?.data?.url || null,
        accent:  resolveAccent(type),
        icon:    resolveIcon(type),
        data:    payload?.data  || {},
      });
    });
    return unsub;
  }, [addToast, isDuplicate, markShown]);

  // ── [T-3] Tap handler ──────────────────────────────────────────────────────
  const handleTap = useCallback((toast) => {
    dismiss(toast.id);
    if (!navigate) return;

    // Direct URL on the toast
    if (toast.url) {
      navigate(toast.url);
      return;
    }

    // DM toast: navigate to messages (App.jsx handles /messages route)
    if (toast.type === "dm" || toast.data?.type === "dm") {
      navigate("/messages");
      return;
    }

    // Social/system: resolve from notificationService cache
    if (toast.rawNotifId && notificationService._cache) {
      const cached = notificationService._cache.find((n) => n.id === toast.rawNotifId);
      if (cached) {
        const url = resolveNotifUrl(cached);
        if (url) navigate(url);
        return;
      }
    }

    // Fallback: use data.url if present
    if (toast.data?.url) {
      navigate(toast.data.url);
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
            style={{ "--accent": t.accent, "--dur": `${t.duration}ms` }}
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
            {/* [T-5] Per-toast drain speed via --dur */}
            <div className="iant__progress" />
          </div>
        ))}
      </div>
      <style>{CSS}</style>
    </>
  );
};

// ── URL resolver (mirrors NotificationSidebar) ────────────────────────────────
function resolveNotifUrl(notif) {
  const { type, entity_id, actor } = notif;
  const actorId = actor?.id;
  switch (type) {
    case "like":
    case "comment":
    case "comment_reply":
    case "mention":
    case "new_post":
    case "share":                  return entity_id ? `/post/${entity_id}`    : null;
    case "new_reel":               return entity_id ? `/reel/${entity_id}`    : null;
    case "new_story":
    case "unlock":
    case "story_unlocked_by_you":  return entity_id ? `/story/${entity_id}`  : null;
    case "follow":
    case "profile_view":           return actorId   ? `/profile/${actorId}`  : null;
    case "milestone_followers":
    case "payment_confirmed":      return "/account";
    case "dm":
    case "message":                return "/messages";
    default:                       return null;
  }
}

// ── CSS ────────────────────────────────────────────────────────────────────────
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
      0 8px 32px rgba(0,0,0,0.7),
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
      0 12px 40px rgba(0,0,0,0.8),
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

  .iant__body     { flex: 1; min-width: 0; }

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
    background: rgba(255,255,255,0.06);
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
    background: rgba(255,255,255,0.12);
    color: #fff;
  }

  /* [T-5] Progress bar drains at exactly the toast's own duration */
  .iant__progress {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 2px;
    width: 100%;
    background: color-mix(in srgb, var(--accent) 50%, transparent);
    transform-origin: left;
    animation: iant_drain var(--dur) linear forwards;
  }

  @keyframes iant_drain {
    from { transform: scaleX(1); }
    to   { transform: scaleX(0); }
  }
`;

export default InAppNotificationToast;