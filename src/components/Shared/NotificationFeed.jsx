import React, { useState, useEffect, useCallback, memo } from "react";
import {
  Heart, MessageCircle, UserPlus, Unlock, Eye,
  Share2, FileText, Film, BookOpen, Trophy, CreditCard,
  CornerDownRight, AtSign, Bell, CheckCheck,
} from "lucide-react";
import notificationService from "../../services/notifications/notificationService";
import { supabase } from "../../services/config/supabase";

// ============================================================================
// NotificationFeed — v2
// ============================================================================
// A lighter feed component (used in mobile views / other contexts).
// Shares the same action-button + deep-link logic as NotificationSidebar.
//
// Props:
//   userId       string
//   currentUser  object  { id, ... }
//   onNavigate   (path: string) => void
//   onClose      () => void  (optional)
// ============================================================================

const ICON_MAP = {
  like:                   <Heart size={14} fill="currentColor" />,
  comment:                <MessageCircle size={14} />,
  comment_reply:          <CornerDownRight size={14} />,
  follow:                 <UserPlus size={14} />,
  unlock:                 <Unlock size={14} />,
  profile_view:           <Eye size={14} />,
  share:                  <Share2 size={14} />,
  new_post:               <FileText size={14} />,
  new_reel:               <Film size={14} />,
  new_story:              <BookOpen size={14} />,
  story_unlocked_by_you:  <Unlock size={14} />,
  milestone_followers:    <Trophy size={14} />,
  payment_confirmed:      <CreditCard size={14} />,
  mention:                <AtSign size={14} />,
};

const COLOR_MAP = {
  like:                   { color: "#ef4444", bg: "rgba(239,68,68,0.15)" },
  comment:                { color: "#3b82f6", bg: "rgba(59,130,246,0.15)" },
  comment_reply:          { color: "#6366f1", bg: "rgba(99,102,241,0.15)" },
  follow:                 { color: "#84cc16", bg: "rgba(132,204,22,0.15)" },
  unlock:                 { color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
  profile_view:           { color: "#06b6d4", bg: "rgba(6,182,212,0.15)" },
  share:                  { color: "#8b5cf6", bg: "rgba(139,92,246,0.15)" },
  new_post:               { color: "#84cc16", bg: "rgba(132,204,22,0.15)" },
  new_reel:               { color: "#f97316", bg: "rgba(249,115,22,0.15)" },
  new_story:              { color: "#ec4899", bg: "rgba(236,72,153,0.15)" },
  story_unlocked_by_you:  { color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
  milestone_followers:    { color: "#fbbf24", bg: "rgba(251,191,36,0.15)" },
  payment_confirmed:      { color: "#10b981", bg: "rgba(16,185,129,0.15)" },
  mention:                { color: "#84cc16", bg: "rgba(132,204,22,0.15)" },
};

// ── Shared URL resolver ───────────────────────────────────────────────────────
function resolveUrl(notif) {
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

function contentLabel(notif) {
  const { type, metadata } = notif;
  if (type === "new_reel") return "Reel";
  if (["new_story", "unlock", "story_unlocked_by_you"].includes(type)) return "Story";
  if (metadata?.content_type === "reel")  return "Reel";
  if (metadata?.content_type === "story") return "Story";
  return "Post";
}

// ── Time formatter ────────────────────────────────────────────────────────────
function formatTime(timestamp) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0)  return `${d}d ago`;
  if (h > 0)  return `${h}h ago`;
  if (m > 0)  return `${m}m ago`;
  return "Just now";
}

// ── Follow-back ───────────────────────────────────────────────────────────────
function useFollowBack(actorId, currentUserId) {
  const [state, setState] = useState("idle");
  const follow = useCallback(async (e) => {
    e.stopPropagation();
    if (!actorId || !currentUserId || state !== "idle") return;
    setState("loading");
    try {
      const { error } = await supabase
        .from("follows")
        .insert({ follower_id: currentUserId, following_id: actorId });
      if (error && error.code !== "23505") throw error;
      setState("done");
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 2000);
    }
  }, [actorId, currentUserId, state]);
  return { state, follow };
}

// ── Action buttons ────────────────────────────────────────────────────────────
const FeedActionButtons = memo(({ notif, onNavigate, currentUserId }) => {
  const url     = resolveUrl(notif);
  const label   = contentLabel(notif);
  const actorId = notif.actor?.id;
  const { type } = notif;

  const { state: followState, follow } = useFollowBack(
    type === "follow" ? actorId : null,
    currentUserId,
  );

  const nav = useCallback((path) => (e) => {
    e.stopPropagation();
    if (path && onNavigate) onNavigate(path);
  }, [onNavigate]);

  if (type === "follow") {
    return (
      <div className="nf__item-actions">
        <button
          className={`nf__action-btn nf__action-btn--primary${followState === "done" ? " nf__action-btn--done" : ""}`}
          onClick={followState === "idle" ? follow : undefined}
          disabled={followState === "loading" || followState === "done"}
        >
          {followState === "loading" ? "…" :
           followState === "done"    ? "Following ✓" :
           "Follow Back"}
        </button>
        <button className="nf__action-btn nf__action-btn--ghost" onClick={nav(`/profile/${actorId}`)}>
          View Profile
        </button>
      </div>
    );
  }

  if (type === "profile_view") {
    return (
      <div className="nf__item-actions">
        <button className="nf__action-btn nf__action-btn--ghost" onClick={nav(`/profile/${actorId}`)}>
          View Profile
        </button>
      </div>
    );
  }

  if (type === "milestone_followers" || type === "payment_confirmed") {
    return (
      <div className="nf__item-actions">
        <button className="nf__action-btn nf__action-btn--ghost" onClick={nav("/account")}>
          View Account
        </button>
      </div>
    );
  }

  if (url) {
    return (
      <div className="nf__item-actions">
        <button className="nf__action-btn nf__action-btn--ghost" onClick={nav(url)}>
          View {label}
        </button>
      </div>
    );
  }

  return null;
});
FeedActionButtons.displayName = "FeedActionButtons";

// ── Single item ───────────────────────────────────────────────────────────────
const NotificationItem = memo(({ notification, onRead, onNavigate, currentUserId }) => {
  const colors  = COLOR_MAP[notification.type] || { color: "#737373", bg: "rgba(255,255,255,0.08)" };
  const icon    = ICON_MAP[notification.type]  || <Bell size={14} />;

  const handleBodyClick = useCallback(() => {
    if (!notification.is_read) onRead(notification.id);
    const url = resolveUrl(notification);
    if (url && onNavigate) onNavigate(url);
  }, [notification, onRead, onNavigate]);

  return (
    <div className={`nf__item${!notification.is_read ? " nf__item--unread" : ""}`}>
      {!notification.is_read && <div className="nf__item-dot" />}

      {/* Clickable body */}
      <div className="nf__item-body" onClick={handleBodyClick} role="button" tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && handleBodyClick()}>
        <div className="nf__avatar-wrap">
          {notification.actor?.avatar ? (
            <img
              className="nf__avatar"
              src={notification.actor.avatar}
              alt={notification.actor.name || ""}
              onError={(e) => { e.target.style.display = "none"; }}
            />
          ) : (
            <div className="nf__avatar nf__avatar--fallback">
              {notification.actor?.name?.[0]?.toUpperCase() || "?"}
            </div>
          )}
          <span className="nf__type-dot" style={{ background: colors.color }}>
            <span style={{ color: "#000" }}>{icon}</span>
          </span>
        </div>

        <div className="nf__content">
          <p className="nf__message">{notification.message}</p>
          {notification.metadata?.comment_preview && (
            <p className="nf__preview">"{notification.metadata.comment_preview}"</p>
          )}
          <span className="nf__time">{formatTime(notification.created_at)}</span>
        </div>
      </div>

      {/* Action buttons */}
      <FeedActionButtons
        notif={notification}
        onNavigate={onNavigate}
        currentUserId={currentUserId}
      />
    </div>
  );
});
NotificationItem.displayName = "NotificationItem";

// ── Main feed component ───────────────────────────────────────────────────────
const NotificationFeed = ({ userId, currentUser, onNavigate, onClose }) => {
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

  const handleRead = useCallback(async (id) => {
    await notificationService.markAsRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    );
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    await notificationService.markAllAsRead(userId);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }, [userId]);

  const handleNavigate = useCallback((path) => {
    if (onNavigate) onNavigate(path);
    if (onClose) onClose();
  }, [onNavigate, onClose]);

  const unread = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="nf">
      <div className="nf__header">
        <span className="nf__title">
          Notifications
          {unread > 0 && <span className="nf__badge">{unread > 99 ? "99+" : unread}</span>}
        </span>
        {unread > 0 && (
          <button className="nf__mark-all" onClick={handleMarkAllRead}>
            <CheckCheck size={13} /> Mark all read
          </button>
        )}
      </div>

      <div className="nf__list">
        {loading ? (
          <div className="nf__loading">
            <div className="nf__spinner" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="nf__empty">
            <span className="nf__empty-icon">🔔</span>
            <p className="nf__empty-text">No notifications yet</p>
          </div>
        ) : (
          notifications.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onRead={handleRead}
              onNavigate={handleNavigate}
              currentUserId={currentUser?.id || userId}
            />
          ))
        )}
      </div>

      <style>{FEED_CSS}</style>
    </div>
  );
};

// ── CSS ───────────────────────────────────────────────────────────────────────
const FEED_CSS = `
  .nf {
    display:flex; flex-direction:column;
    background:#0a0a0a;
    height:100%;
  }

  .nf__header {
    display:flex; align-items:center; justify-content:space-between;
    padding:14px 16px 12px;
    border-bottom:1px solid rgba(255,255,255,.07);
    flex-shrink:0;
  }
  .nf__title {
    font-size:15px; font-weight:800; color:#fff;
    display:flex; align-items:center; gap:8px;
  }
  .nf__badge {
    padding:2px 7px;
    background:rgba(132,204,22,.15); border:1px solid rgba(132,204,22,.3);
    border-radius:20px; color:#84cc16; font-size:10px; font-weight:700;
  }
  .nf__mark-all {
    display:flex; align-items:center; gap:5px;
    padding:5px 10px;
    background:rgba(132,204,22,.08); border:1px solid rgba(132,204,22,.2);
    border-radius:7px; color:#84cc16; font-size:11px; font-weight:600;
    cursor:pointer; transition:all .15s; white-space:nowrap;
  }
  .nf__mark-all:hover { background:rgba(132,204,22,.15); }

  .nf__list {
    flex:1; overflow-y:auto; padding:6px 8px 16px;
    overscroll-behavior:contain;
  }
  .nf__list::-webkit-scrollbar { width:3px; }
  .nf__list::-webkit-scrollbar-thumb { background:rgba(132,204,22,.2); border-radius:3px; }

  .nf__item {
    position:relative;
    border-radius:12px; margin-bottom:4px;
    border:1px solid rgba(255,255,255,.06);
    background:rgba(255,255,255,.02);
    transition:background .15s, border-color .15s;
    overflow:hidden;
    animation:nfIn .22s ease both;
  }
  @keyframes nfIn { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
  .nf__item:hover       { background:rgba(255,255,255,.04); border-color:rgba(255,255,255,.1); }
  .nf__item--unread     { background:rgba(132,204,22,.04); border-color:rgba(132,204,22,.15); }
  .nf__item--unread:hover{ background:rgba(132,204,22,.07); border-color:rgba(132,204,22,.25); }

  .nf__item-dot {
    position:absolute; left:0; top:50%; transform:translateY(-50%);
    width:3px; height:50%; min-height:16px;
    background:linear-gradient(180deg,#a3e635,#65a30d);
    border-radius:0 3px 3px 0;
  }

  /* Body (clickable) */
  .nf__item-body {
    display:flex; align-items:flex-start; gap:10px;
    padding:10px 12px 8px 14px;
    cursor:pointer;
  }
  .nf__item-body:hover { opacity:.9; }

  .nf__avatar-wrap { position:relative; flex-shrink:0; width:40px; height:40px; }
  .nf__avatar {
    width:40px; height:40px; border-radius:50%;
    object-fit:cover;
    border:2px solid rgba(132,204,22,.25);
    display:block;
  }
  .nf__avatar--fallback {
    background:linear-gradient(135deg,#84cc16,#4d7c0f);
    display:flex; align-items:center; justify-content:center;
    font-weight:800; font-size:16px; color:#000;
  }
  .nf__type-dot {
    position:absolute; bottom:-2px; right:-4px;
    width:20px; height:20px; border-radius:50%;
    display:flex; align-items:center; justify-content:center;
    border:2px solid #0a0a0a;
    font-size:10px;
  }

  .nf__content { flex:1; min-width:0; }
  .nf__message {
    font-size:12.5px; color:#d4d4d4; line-height:1.45; margin:0 0 3px;
    display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
    word-break:break-word;
  }
  .nf__item--unread .nf__message { color:#f5f5f5; font-weight:500; }
  .nf__preview {
    font-size:11px; color:#525252; font-style:italic; margin:0 0 3px;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  }
  .nf__time { font-size:10px; color:#484848; }

  /* Action buttons */
  .nf__item-actions {
    display:flex; gap:6px;
    padding:0 12px 10px 62px;
  }
  .nf__action-btn {
    flex:1; padding:6px 10px; border-radius:7px;
    font-size:11px; font-weight:700; cursor:pointer;
    transition:all .15s; border:none; text-align:center; white-space:nowrap;
  }
  .nf__action-btn--primary {
    background:linear-gradient(135deg,#84cc16,#65a30d);
    color:#000;
    box-shadow:0 2px 8px rgba(132,204,22,.2);
  }
  .nf__action-btn--primary:hover:not(:disabled) {
    transform:translateY(-1px);
    box-shadow:0 3px 10px rgba(132,204,22,.3);
  }
  .nf__action-btn--primary:disabled { opacity:.65; cursor:default; }
  .nf__action-btn--done {
    background:rgba(132,204,22,.1); color:#84cc16;
    border:1px solid rgba(132,204,22,.25); box-shadow:none;
  }
  .nf__action-btn--ghost {
    background:rgba(255,255,255,.05); color:#a3a3a3;
    border:1px solid rgba(255,255,255,.1);
  }
  .nf__action-btn--ghost:hover {
    background:rgba(255,255,255,.1); color:#fff;
    border-color:rgba(255,255,255,.2);
  }

  /* Loading */
  .nf__loading {
    display:flex; align-items:center; justify-content:center;
    padding:48px;
  }
  .nf__spinner {
    width:28px; height:28px;
    border:3px solid rgba(132,204,22,.15);
    border-top-color:#84cc16;
    border-radius:50%;
    animation:nfSpin .7s linear infinite;
  }
  @keyframes nfSpin { to{transform:rotate(360deg)} }

  /* Empty */
  .nf__empty {
    display:flex; flex-direction:column; align-items:center;
    padding:52px 24px; gap:10px; text-align:center;
  }
  .nf__empty-icon { font-size:40px; opacity:.15; filter:grayscale(1); }
  .nf__empty-text { color:#4a4a4a; font-size:13px; font-weight:600; }
`;

export default NotificationFeed;