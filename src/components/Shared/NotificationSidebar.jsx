import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import {
  X,
  Heart,
  MessageCircle,
  UserPlus,
  Unlock,
  CheckCheck,
  Eye,
  Bell,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import notificationService from "../../services/notifications/notificationService";

// ============================================================================
// NotificationSidebar
// ============================================================================
// Driven entirely by notificationService.
//
// ── On open ──────────────────────────────────────────────────────────────────
//   1. clearHeaderBadge(userId) → header badge → 0 instantly (optimistic)
//   2. getNotifications(userId) → loads from cache or DB
//   3. subscribe(fn) → live updates for all future changes
//
// ── Badge contract ────────────────────────────────────────────────────────────
//   Header badge cleared on open. Sidebar unread dots = is_read per row.
//   These are independent — opening sidebar does NOT mark rows as read.
//
// ── Expandability ─────────────────────────────────────────────────────────────
//   Each row measures its own text height after mount.
//   If it overflows 2 lines → "Show more / Show less" toggle appears.
// ============================================================================

const ICON_MAP = {
  like: <Heart size={13} />,
  comment: <MessageCircle size={13} />,
  follow: <UserPlus size={13} />,
  unlock: <Unlock size={13} />,
  profile_view: <Eye size={13} />,
};

const COLOR_MAP = {
  like: { color: "#ef4444", bg: "rgba(239,68,68,0.13)" },
  comment: { color: "#3b82f6", bg: "rgba(59,130,246,0.13)" },
  follow: { color: "#84cc16", bg: "rgba(132,204,22,0.13)" },
  unlock: { color: "#f59e0b", bg: "rgba(245,158,11,0.13)" },
  profile_view: { color: "#06b6d4", bg: "rgba(6,182,212,0.13)" },
};

function timeAgo(ts) {
  const s = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// ── Single row ────────────────────────────────────────────────────────────────
const NotifItem = memo(({ notif, onRead }) => {
  const [expanded, setExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const msgRef = useRef(null);
  const colors = COLOR_MAP[notif.type] || {
    color: "#737373",
    bg: "rgba(255,255,255,0.05)",
  };

  // Measure text overflow after mount
  useEffect(() => {
    const el = msgRef.current;
    if (!el) return;
    const prev = el.style.webkitLineClamp;
    el.style.webkitLineClamp = "unset";
    const full = el.scrollHeight;
    el.style.webkitLineClamp = prev;
    setIsClamped(full > el.clientHeight + 4);
  }, [notif.message]);

  const handleClick = useCallback(() => {
    if (!notif.is_read) onRead(notif.id);
  }, [notif.id, notif.is_read, onRead]);

  const toggleExpand = useCallback(
    (e) => {
      e.stopPropagation();
      setExpanded((v) => !v);
      if (!notif.is_read) onRead(notif.id);
    },
    [notif.id, notif.is_read, onRead],
  );

  return (
    <div
      className={`ni${notif.is_read ? "" : " ni--unread"}`}
      onClick={handleClick}
      style={{ "--accent": colors.color, "--accent-bg": colors.bg }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
      aria-label={notif.message}
    >
      {!notif.is_read && <div className="ni__bar" />}

      <div className="ni__avatar">
        {notif.actor?.avatar ? (
          <img
            src={notif.actor.avatar}
            alt=""
            onError={(e) => {
              e.target.style.display = "none";
              e.target.nextSibling.style.display = "flex";
            }}
          />
        ) : null}
        <span
          className="ni__avatar-fb"
          style={{ display: notif.actor?.avatar ? "none" : "flex" }}
        >
          {notif.actor?.name?.[0]?.toUpperCase() || "?"}
        </span>
      </div>

      <div className="ni__body">
        <div className={`ni__msg-wrap${expanded ? " ni__msg-wrap--open" : ""}`}>
          <p
            ref={msgRef}
            className={`ni__msg${expanded ? " ni__msg--expanded" : ""}`}
          >
            {notif.message}
          </p>
        </div>
        <div className="ni__foot">
          <span className="ni__time">{timeAgo(notif.created_at)}</span>
          {isClamped && (
            <button
              className="ni__expand-btn"
              onClick={toggleExpand}
              aria-expanded={expanded}
            >
              {expanded ? (
                <>
                  <ChevronUp size={10} /> Show less
                </>
              ) : (
                <>
                  <ChevronDown size={10} /> Show more
                </>
              )}
            </button>
          )}
          {!notif.is_read && <span className="ni__new-pill">New</span>}
        </div>
      </div>

      <div
        className="ni__type-icon"
        style={{ color: colors.color, background: colors.bg }}
        aria-hidden
      >
        {ICON_MAP[notif.type] || <Bell size={13} />}
      </div>
    </div>
  );
});
NotifItem.displayName = "NotifItem";

// ── Skeleton ──────────────────────────────────────────────────────────────────
const Skeleton = memo(() => (
  <div className="ns__skeletons">
    {[0, 1, 2, 3].map((i) => (
      <div key={i} className="ns__sk" style={{ animationDelay: `${i * 0.1}s` }}>
        <div className="ns__sk-av" />
        <div className="ns__sk-body">
          <div className="ns__sk-line" style={{ width: `${68 + i * 8}%` }} />
          <div className="ns__sk-line" style={{ width: `${38 + i * 6}%` }} />
        </div>
      </div>
    ))}
  </div>
));
Skeleton.displayName = "Skeleton";

// ── Main sidebar ──────────────────────────────────────────────────────────────
const NotificationSidebar = ({ isOpen, onClose, userId }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const badgeCleared = useRef(false);

  // ── Load and subscribe ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      badgeCleared.current = false;
      return;
    }
    if (!userId) return;

    setLoading(true);
    setError(false);

    // 1. Clear header badge the moment sidebar opens (optimistic in service)
    if (!badgeCleared.current) {
      badgeCleared.current = true;
      notificationService.clearHeaderBadge(userId);
    }

    // 2. Fetch from service (cache or DB)
    notificationService
      .getNotifications(userId)
      .then((data) => {
        setNotifications(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });

    // 3. Live updates
    const unsub = notificationService.subscribe(() => {
      // Pull latest from service cache (synchronous)
      setNotifications([...(notificationService._cache || [])]);
    });

    return unsub;
  }, [isOpen, userId]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleMarkRead = useCallback(
    (id) => notificationService.markAsRead(id),
    [],
  );
  const handleMarkAllRead = useCallback(
    () => notificationService.markAllAsRead(userId),
    [userId],
  );

  const handleRetry = useCallback(async () => {
    setRetrying(true);
    setError(false);
    try {
      const data = await notificationService.getNotifications(userId, 50, true);
      setNotifications(data);
    } catch {
      setError(true);
    } finally {
      setRetrying(false);
    }
  }, [userId]);

  const unread = notifications.filter((n) => !n.is_read).length;

  if (!isOpen) return null;

  return (
    <>
      <div
        className="ns-overlay"
        onClick={onClose}
        role="dialog"
        aria-modal
        aria-label="Notifications"
      >
        <div className="ns" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="ns__head">
            <div className="ns__head-left">
              <Bell size={15} className="ns__head-icon" />
              <span className="ns__title">Notifications</span>
              {unread > 0 && (
                <span className="ns__badge" aria-label={`${unread} unread`}>
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </div>
            <div className="ns__head-right">
              {unread > 0 && (
                <button
                  className="ns__mark-btn"
                  onClick={handleMarkAllRead}
                  title="Mark all as read"
                >
                  <CheckCheck size={13} /> All read
                </button>
              )}
              <button
                className="ns__close-btn"
                onClick={onClose}
                aria-label="Close notifications"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          {!loading && notifications.length > 0 && (
            <div className="ns__section-label">Recent activity</div>
          )}

          {/* Body */}
          <div className="ns__list" role="feed">
            {loading ? (
              <Skeleton />
            ) : error ? (
              <div className="ns__state">
                <AlertCircle size={36} className="ns__state-icon--error" />
                <div className="ns__state-title">Failed to load</div>
                <div className="ns__state-hint">
                  Something went wrong. Please try again.
                </div>
                <button
                  className="ns__retry-btn"
                  onClick={handleRetry}
                  disabled={retrying}
                >
                  {retrying ? (
                    <>
                      <RefreshCw size={12} className="ns__spin" /> Retrying…
                    </>
                  ) : (
                    "Try again"
                  )}
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="ns__state">
                <div className="ns__state-bell">🔔</div>
                <div className="ns__state-title">You're all caught up</div>
                <div className="ns__state-hint">
                  Notifications appear here when someone likes, comments,
                  follows, or interacts with your content.
                </div>
              </div>
            ) : (
              <>
                {notifications.map((n) => (
                  <NotifItem key={n.id} notif={n} onRead={handleMarkRead} />
                ))}
                {notifications.length >= 50 && (
                  <div className="ns__end-label">Showing most recent 50</div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <style>{CSS}</style>
    </>
  );
};

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
  .ns-overlay {
    position:fixed; inset:0;
    background:rgba(0,0,0,0.72);
    backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px);
    z-index:10000; animation:nsFadeIn .2s ease;
  }
  @keyframes nsFadeIn { from{opacity:0} to{opacity:1} }

  .ns {
    position:fixed; top:0; right:0;
    width:390px; max-width:100vw; height:100vh;
    background:#0a0a0a;
    border-left:1px solid rgba(132,204,22,.15);
    display:flex; flex-direction:column;
    z-index:10001;
    animation:nsSlideIn .28s cubic-bezier(.22,1,.36,1);
    box-shadow:-20px 0 60px rgba(0,0,0,.7);
  }
  @keyframes nsSlideIn { from{transform:translateX(100%)} to{transform:translateX(0)} }

  @media(max-width:768px) {
    .ns {
      width:100%; border-left:none; border-radius:22px 22px 0 0;
      height:90vh; top:auto; bottom:0;
      animation:nsSlideUp .28s cubic-bezier(.22,1,.36,1);
      box-shadow:0 -12px 50px rgba(0,0,0,.7);
    }
    @keyframes nsSlideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
  }

  .ns__head {
    display:flex; align-items:center; justify-content:space-between;
    padding:14px 16px 12px;
    border-bottom:1px solid rgba(255,255,255,.06);
    flex-shrink:0;
    background:rgba(10,10,10,.96); backdrop-filter:blur(10px);
    position:sticky; top:0; z-index:2;
  }
  .ns__head-left  { display:flex; align-items:center; gap:8px; }
  .ns__head-icon  { color:#84cc16; }
  .ns__title      { font-size:16px; font-weight:800; color:#fff; letter-spacing:-.3px; }
  .ns__badge {
    padding:2px 8px;
    background:rgba(132,204,22,.15); border:1px solid rgba(132,204,22,.35);
    border-radius:20px; color:#84cc16; font-size:10.5px; font-weight:700;
    animation:nsBadgePop .3s cubic-bezier(.34,1.56,.64,1);
  }
  @keyframes nsBadgePop { from{transform:scale(.5);opacity:0} to{transform:scale(1);opacity:1} }
  .ns__head-right { display:flex; align-items:center; gap:6px; }
  .ns__mark-btn {
    display:flex; align-items:center; gap:5px;
    padding:6px 11px;
    background:rgba(132,204,22,.08); border:1px solid rgba(132,204,22,.22);
    border-radius:8px; color:#84cc16; font-size:11.5px; font-weight:600;
    cursor:pointer; transition:all .15s; white-space:nowrap;
  }
  .ns__mark-btn:hover { background:rgba(132,204,22,.16); border-color:rgba(132,204,22,.4); }
  .ns__close-btn {
    width:32px; height:32px; border-radius:8px;
    background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08);
    display:flex; align-items:center; justify-content:center;
    color:#737373; cursor:pointer; transition:all .15s;
  }
  .ns__close-btn:hover { background:rgba(255,255,255,.09); color:#fff; }

  .ns__section-label {
    padding:8px 14px 4px;
    font-size:10px; font-weight:700;
    text-transform:uppercase; letter-spacing:.8px; color:#3a3a3a;
  }

  .ns__list {
    flex:1; overflow-y:auto; padding:4px 6px 16px;
    overscroll-behavior:contain;
  }
  .ns__list::-webkit-scrollbar { width:3px; }
  .ns__list::-webkit-scrollbar-thumb { background:rgba(132,204,22,.2); border-radius:3px; }

  /* Item */
  .ni {
    position:relative; display:flex; align-items:flex-start; gap:10px;
    padding:10px 10px 10px 14px; border-radius:13px; margin-bottom:3px;
    cursor:pointer; border:1px solid transparent;
    background:rgba(255,255,255,.018);
    transition:background .15s, border-color .15s, transform .1s;
    animation:niEnter .25s ease both;
  }
  @keyframes niEnter { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  .ni:hover        { background:rgba(255,255,255,.04); border-color:rgba(255,255,255,.07); transform:translateX(1px); }
  .ni:active       { transform:scale(.99); }
  .ni--unread      { background:rgba(132,204,22,.04); border-color:rgba(132,204,22,.14); }
  .ni--unread:hover{ background:rgba(132,204,22,.07); border-color:rgba(132,204,22,.24); }

  .ni__bar {
    position:absolute; left:-1px; top:50%; transform:translateY(-50%);
    width:3px; height:55%; min-height:20px;
    background:linear-gradient(180deg,#a3e635,#84cc16);
    border-radius:0 3px 3px 0; box-shadow:0 0 6px rgba(132,204,22,.5);
  }

  .ni__avatar {
    width:38px; height:38px; border-radius:50%;
    background:linear-gradient(135deg,#84cc16,#4d7c0f);
    display:flex; align-items:center; justify-content:center;
    flex-shrink:0; overflow:hidden;
    border:1.5px solid rgba(132,204,22,.2);
    transition:border-color .15s, transform .15s;
  }
  .ni:hover .ni__avatar { border-color:rgba(132,204,22,.4); transform:scale(1.04); }
  .ni__avatar img     { width:100%; height:100%; object-fit:cover; display:block; }
  .ni__avatar-fb      { font-weight:800; font-size:15px; color:#000; width:100%; height:100%; align-items:center; justify-content:center; }

  .ni__body           { flex:1; min-width:0; }
  .ni__msg-wrap       { overflow:hidden; transition:max-height .3s cubic-bezier(.4,0,.2,1); max-height:3.2em; }
  .ni__msg-wrap--open { max-height:600px; }
  .ni__msg {
    font-size:12.5px; color:#c4c4c4; line-height:1.5; margin:0 0 5px;
    word-break:break-word;
    display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden;
  }
  .ni__msg--expanded  { display:block; -webkit-line-clamp:unset; overflow:visible; }
  .ni--unread .ni__msg{ color:#e8e8e8; font-weight:500; }

  .ni__foot           { display:flex; align-items:center; gap:7px; flex-wrap:wrap; }
  .ni__time           { font-size:10px; color:#484848; flex-shrink:0; }
  .ni__expand-btn {
    display:inline-flex; align-items:center; gap:3px;
    font-size:10px; color:#84cc16; font-weight:600;
    background:none; border:none; cursor:pointer; padding:0; transition:opacity .15s; flex-shrink:0;
  }
  .ni__expand-btn:hover { opacity:.7; }
  .ni__new-pill {
    font-size:9px; font-weight:700; color:#84cc16;
    background:rgba(132,204,22,.12); border:1px solid rgba(132,204,22,.25);
    border-radius:20px; padding:1px 6px; letter-spacing:.3px;
    animation:nsBadgePop .3s cubic-bezier(.34,1.56,.64,1);
  }
  .ni__type-icon {
    width:27px; height:27px; border-radius:8px;
    display:flex; align-items:center; justify-content:center;
    flex-shrink:0; margin-top:2px;
  }

  /* Skeleton */
  .ns__skeletons { padding:6px 2px; }
  .ns__sk {
    display:flex; align-items:center; gap:10px;
    padding:10px; margin-bottom:4px; border-radius:13px;
    background:rgba(255,255,255,.018);
    animation:nsPulse 1.6s ease-in-out infinite;
  }
  .ns__sk-av   { width:38px; height:38px; border-radius:50%; background:rgba(255,255,255,.07); flex-shrink:0; }
  .ns__sk-body { flex:1; display:flex; flex-direction:column; gap:8px; }
  .ns__sk-line { height:10px; border-radius:5px; background:rgba(255,255,255,.07); }
  @keyframes nsPulse { 0%,100%{opacity:.4} 50%{opacity:.8} }

  /* State */
  .ns__state {
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    padding:60px 24px 40px; text-align:center; gap:8px;
  }
  .ns__state-bell       { font-size:44px; opacity:.18; margin-bottom:6px; filter:grayscale(1); }
  .ns__state-icon--error{ color:#404040; margin-bottom:8px; }
  .ns__state-title      { color:#a3a3a3; font-size:14px; font-weight:700; }
  .ns__state-hint       { color:#4a4a4a; font-size:12px; line-height:1.6; max-width:260px; }
  .ns__retry-btn {
    margin-top:12px; padding:8px 20px;
    background:rgba(132,204,22,.08); border:1px solid rgba(132,204,22,.25);
    border-radius:10px; color:#84cc16; font-size:12.5px; font-weight:600;
    cursor:pointer; transition:all .15s;
    display:flex; align-items:center; gap:6px;
  }
  .ns__retry-btn:hover    { background:rgba(132,204,22,.16); }
  .ns__retry-btn:disabled { opacity:.6; cursor:not-allowed; }
  .ns__spin { animation:nsRotate .8s linear infinite; }
  @keyframes nsRotate { to{transform:rotate(360deg)} }

  .ns__end-label { text-align:center; font-size:10.5px; color:#363636; padding:12px 0 4px; }
`;

export default NotificationSidebar;
