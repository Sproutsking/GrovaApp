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
  Share2,
  FileText,
  Film,
  BookOpen,
  Trophy,
  CreditCard,
  CornerDownRight,
  AtSign,
  Wallet,
  Zap,
  Settings,
  Globe,
  ArrowUpRight,
  ArrowDownLeft,
  Shield,
  PiggyBank,
  GraduationCap,
  Smartphone,
} from "lucide-react";
import notificationService from "../../services/notifications/notificationService";
import { supabase } from "../../services/config/supabase";

// ============================================================================
// NotificationSidebar — v4
// ============================================================================
// New in v4 (all v3 features preserved):
//   • Category filter strip: All · PayWave · Wallet · System · Social
//   • Per-category unread counts on pills
//   • PayWave notifications rendered with financial icons + colour coding
//   • category inferred from metadata.category or notification type (legacy)
// ============================================================================

// ── Category definitions ──────────────────────────────────────────────────────
const CATEGORIES = [
  { id: "all",     label: "All",    Icon: Bell,     color: "#84cc16" },
  { id: "paywave", label: "PayWave",Icon: Wallet,   color: "#a3e635" },
  { id: "wallet",  label: "Wallet", Icon: Zap,      color: "#a855f7" },
  { id: "system",  label: "System", Icon: Settings, color: "#f59e0b" },
  { id: "social",  label: "Social", Icon: Globe,    color: "#60a5fa" },
];

// Infer category for legacy notifications that don't have metadata.category
function inferCategory(n) {
  const cat = n.metadata?.category;
  if (cat) return cat;
  if (n.metadata?.pw_type) return "paywave";
  const social = ["like","comment","comment_reply","follow","profile_view",
                  "share","new_post","new_reel","new_story","story_unlocked_by_you",
                  "milestone_followers","mention"];
  if (social.includes(n.type)) return "social";
  if (n.type === "payment_confirmed") return "wallet";
  return "system";
}

// ── PayWave type definitions (for rendering inside the sidebar) ───────────────
const PW_TYPE_DEF = {
  transfer_sent:      { Icon: ArrowUpRight,  color: "#f87171", bg: "rgba(248,113,113,0.13)", label: "Sent"        },
  transfer_received:  { Icon: ArrowDownLeft, color: "#a3e635", bg: "rgba(163,230,53,0.13)",  label: "Received"    },
  deposit:            { Icon: ArrowDownLeft, color: "#a3e635", bg: "rgba(163,230,53,0.13)",  label: "Deposit"     },
  withdrawal:         { Icon: ArrowUpRight,  color: "#d4a847", bg: "rgba(212,168,71,0.13)",  label: "Withdrawal"  },
  security_alert:     { Icon: Shield,        color: "#ef4444", bg: "rgba(239,68,68,0.14)",   label: "Security"    },
  stake_update:       { Icon: Zap,           color: "#a855f7", bg: "rgba(168,85,247,0.13)",  label: "Stake"       },
  savings_update:     { Icon: PiggyBank,     color: "#60a5fa", bg: "rgba(96,165,250,0.13)",  label: "Savings"     },
  card_activity:      { Icon: CreditCard,    color: "#f59e0b", bg: "rgba(245,158,11,0.13)",  label: "Card"        },
  scholarship_update: { Icon: GraduationCap, color: "#10b981", bg: "rgba(16,185,129,0.13)",  label: "Scholarship" },
  bill_payment:       { Icon: Smartphone,    color: "#8b5cf6", bg: "rgba(139,92,246,0.13)",  label: "Bills"       },
};

// ── Existing icon + colour maps (v3, unchanged) ───────────────────────────────
const ICON_MAP = {
  like:                   <Heart size={13} />,
  comment:                <MessageCircle size={13} />,
  comment_reply:          <CornerDownRight size={13} />,
  follow:                 <UserPlus size={13} />,
  unlock:                 <Unlock size={13} />,
  profile_view:           <Eye size={13} />,
  share:                  <Share2 size={13} />,
  new_post:               <FileText size={13} />,
  new_reel:               <Film size={13} />,
  new_story:              <BookOpen size={13} />,
  story_unlocked_by_you:  <Unlock size={13} />,
  milestone_followers:    <Trophy size={13} />,
  payment_confirmed:      <CreditCard size={13} />,
  mention:                <AtSign size={13} />,
};

const COLOR_MAP = {
  like:                   { color: "#ef4444", bg: "rgba(239,68,68,0.13)" },
  comment:                { color: "#3b82f6", bg: "rgba(59,130,246,0.13)" },
  comment_reply:          { color: "#6366f1", bg: "rgba(99,102,241,0.13)" },
  follow:                 { color: "#84cc16", bg: "rgba(132,204,22,0.13)" },
  unlock:                 { color: "#f59e0b", bg: "rgba(245,158,11,0.13)" },
  profile_view:           { color: "#06b6d4", bg: "rgba(6,182,212,0.13)" },
  share:                  { color: "#8b5cf6", bg: "rgba(139,92,246,0.13)" },
  new_post:               { color: "#84cc16", bg: "rgba(132,204,22,0.13)" },
  new_reel:               { color: "#f97316", bg: "rgba(249,115,22,0.13)" },
  new_story:              { color: "#ec4899", bg: "rgba(236,72,153,0.13)" },
  story_unlocked_by_you:  { color: "#f59e0b", bg: "rgba(245,158,11,0.13)" },
  milestone_followers:    { color: "#fbbf24", bg: "rgba(251,191,36,0.13)" },
  payment_confirmed:      { color: "#10b981", bg: "rgba(16,185,129,0.13)" },
  mention:                { color: "#84cc16", bg: "rgba(132,204,22,0.13)" },
};

// ── Deep-link resolver (v3, unchanged) ───────────────────────────────────────
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
  if (["new_story","unlock","story_unlocked_by_you"].includes(type)) return "Story";
  if (metadata?.content_type === "reel")  return "Reel";
  if (metadata?.content_type === "story") return "Story";
  return "Post";
}

// ── Time formatter ────────────────────────────────────────────────────────────
function timeAgo(ts) {
  const s = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (s < 60)     return "Just now";
  if (s < 3600)   return `${Math.floor(s/60)}m ago`;
  if (s < 86400)  return `${Math.floor(s/3600)}h ago`;
  if (s < 604800) return `${Math.floor(s/86400)}d ago`;
  return new Date(ts).toLocaleDateString("en-US", { month:"short", day:"numeric" });
}

// ── Follow-back hook ──────────────────────────────────────────────────────────
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

// ── Action buttons (v3, unchanged) ───────────────────────────────────────────
const ActionButtons = memo(({ notif, onNavigate, currentUserId }) => {
  const url     = resolveUrl(notif);
  const label   = contentLabel(notif);
  const actorId = notif.actor?.id;
  const { type } = notif;
  const { state: followState, follow } = useFollowBack(type === "follow" ? actorId : null, currentUserId);

  const handleViewContent = useCallback((e) => {
    e.stopPropagation();
    if (url && onNavigate) onNavigate(url);
  }, [url, onNavigate]);

  const handleViewProfile = useCallback((e) => {
    e.stopPropagation();
    if (actorId && onNavigate) onNavigate(`/profile/${actorId}`);
  }, [actorId, onNavigate]);

  if (type === "follow") return (
    <div className="ni__actions">
      <button
        className={`ni__btn ni__btn--primary${followState==="done"?" ni__btn--done":""}`}
        onClick={followState==="idle" ? follow : undefined}
        disabled={followState==="loading" || followState==="done"}
      >
        {followState==="loading" ? "…" : followState==="done" ? "Following ✓" : followState==="error" ? "Retry" : "Follow Back"}
      </button>
      <button className="ni__btn ni__btn--ghost" onClick={handleViewProfile}>View Profile</button>
    </div>
  );
  if (type === "profile_view") return (
    <div className="ni__actions">
      <button className="ni__btn ni__btn--ghost" onClick={handleViewProfile}>View Profile</button>
    </div>
  );
  if (type === "milestone_followers" || type === "payment_confirmed") return (
    <div className="ni__actions">
      <button className="ni__btn ni__btn--ghost" onClick={handleViewContent}>View Account</button>
    </div>
  );
  if (url) return (
    <div className="ni__actions">
      <button className="ni__btn ni__btn--ghost" onClick={handleViewContent}>View {label}</button>
    </div>
  );
  return null;
});
ActionButtons.displayName = "ActionButtons";

// ── Single notification item ──────────────────────────────────────────────────
// v4 extension: PayWave notifications get a different visual treatment.
const NotifItem = memo(({ notif, onRead, onNavigate, currentUserId }) => {
  const [expanded,  setExpanded]  = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const msgRef = useRef(null);

  const category = inferCategory(notif);
  const isPW     = category === "paywave";
  const pwType   = notif.metadata?.pw_type;
  const pwDef    = isPW && pwType ? PW_TYPE_DEF[pwType] : null;

  // Colors: PayWave uses pw_type colours, others use type colours
  const colors = pwDef
    ? { color: pwDef.color, bg: pwDef.bg }
    : COLOR_MAP[notif.type] || { color: "#737373", bg: "rgba(255,255,255,0.05)" };

  // For PayWave notifs, message is split with \n — only show the first line in the list
  const lines      = (notif.message || "").split("\n");
  const displayMsg = isPW && lines.length > 1 ? lines[0] : notif.message;
  const subLine    = isPW && lines.length > 1 ? lines.slice(1).join(" ").trim() : null;

  useEffect(() => {
    const el = msgRef.current;
    if (!el) return;
    el.style.webkitLineClamp = "unset";
    const full = el.scrollHeight;
    el.style.webkitLineClamp = "2";
    setIsClamped(full > el.clientHeight + 4);
  }, [notif.message]);

  const handleBodyClick = useCallback(() => {
    if (!notif.is_read) onRead(notif.id);
    const url = resolveUrl(notif);
    if (!isPW && url && onNavigate) onNavigate(url);
  }, [notif, onRead, onNavigate, isPW]);

  const toggleExpand = useCallback((e) => {
    e.stopPropagation();
    setExpanded(v => !v);
    if (!notif.is_read) onRead(notif.id);
  }, [notif.id, notif.is_read, onRead]);

  return (
    <div
      className={`ni${notif.is_read ? "" : " ni--unread"}${isPW ? " ni--paywave" : ""}`}
      style={{ "--accent": colors.color, "--accent-bg": colors.bg }}
      aria-label={notif.message}
    >
      {!notif.is_read && <div className="ni__bar" />}

      <div className="ni__top" onClick={handleBodyClick} role="button" tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && handleBodyClick()}>

        {/* Avatar — circle icon for PayWave, user avatar for social */}
        <div className="ni__avatar"
          style={isPW ? { background: colors.bg, border: `1.5px solid ${colors.color}44` } : {}}>
          {isPW && pwDef ? (
            <pwDef.Icon size={17} color={pwDef.color} strokeWidth={2.2} />
          ) : notif.actor?.avatar ? (
            <>
              <img src={notif.actor.avatar} alt=""
                onError={e => { e.target.style.display="none"; e.target.nextSibling.style.display="flex"; }} />
              <span className="ni__avatar-fb" style={{ display:"none" }}>
                {notif.actor?.name?.[0]?.toUpperCase() || "?"}
              </span>
            </>
          ) : (
            <span className="ni__avatar-fb" style={{ display:"flex" }}>
              {notif.actor?.name?.[0]?.toUpperCase() || "?"}
            </span>
          )}
        </div>

        <div className="ni__body">
          <div className={`ni__msg-wrap${expanded ? " ni__msg-wrap--open" : ""}`}>
            <p ref={msgRef} className={`ni__msg${expanded ? " ni__msg--expanded" : ""}`}>
              {displayMsg}
            </p>
          </div>
          {/* Sub-line for PayWave (body text after the \n) */}
          {subLine && <p className="ni__preview">{subLine}</p>}
          {/* Comment preview for social */}
          {!subLine && notif.metadata?.comment_preview && (
            <p className="ni__preview">"{notif.metadata.comment_preview}"</p>
          )}

          <div className="ni__foot">
            <span className="ni__time">{timeAgo(notif.created_at)}</span>
            {isClamped && (
              <button className="ni__expand-btn" onClick={toggleExpand} aria-expanded={expanded}>
                {expanded ? <><ChevronUp size={10}/> Show less</> : <><ChevronDown size={10}/> Show more</>}
              </button>
            )}
            {!notif.is_read && <span className="ni__new-pill">New</span>}
            {/* PayWave type pill */}
            {isPW && pwDef?.label && (
              <span style={{
                padding: "1px 6px", borderRadius: 12, fontSize: 9, fontWeight: 700,
                background: `${pwDef.color}18`,
                border: `1px solid ${pwDef.color}33`,
                color: pwDef.color,
              }}>
                {pwDef.label}
              </span>
            )}
          </div>
        </div>

        <div className="ni__type-icon" style={{ color: colors.color, background: colors.bg }} aria-hidden>
          {isPW && pwDef
            ? <pwDef.Icon size={13} />
            : (ICON_MAP[notif.type] || <Bell size={13} />)
          }
        </div>
      </div>

      {/* No action buttons for PayWave — they're informational */}
      {!isPW && (
        <ActionButtons notif={notif} onNavigate={onNavigate} currentUserId={currentUserId} />
      )}
    </div>
  );
});
NotifItem.displayName = "NotifItem";

// ── Skeleton (v3, unchanged) ──────────────────────────────────────────────────
const Skeleton = memo(() => (
  <div className="ns__skeletons">
    {[0,1,2,3].map(i => (
      <div key={i} className="ns__sk" style={{ animationDelay:`${i*0.1}s` }}>
        <div className="ns__sk-av" />
        <div className="ns__sk-body">
          <div className="ns__sk-line" style={{ width:`${68+i*8}%` }} />
          <div className="ns__sk-line" style={{ width:`${38+i*6}%` }} />
        </div>
      </div>
    ))}
  </div>
));
Skeleton.displayName = "Skeleton";

// ── Empty state copy per category ─────────────────────────────────────────────
const CATEGORY_EMPTY = {
  all:     { bell: "🔔", title: "You're all caught up",         hint: "Notifications from all sections appear here." },
  paywave: { bell: "₦",  title: "No PayWave notifications",     hint: "Transfers, deposits and financial alerts appear here." },
  wallet:  { bell: "⚡", title: "No wallet notifications",      hint: "EP earnings, XEV and wallet events appear here." },
  system:  { bell: "⚙️", title: "No system notifications",      hint: "Platform updates and system messages appear here." },
  social:  { bell: "💬", title: "No social notifications",      hint: "Likes, comments, follows and mentions appear here." },
};

// ── Main sidebar ──────────────────────────────────────────────────────────────
const NotificationSidebar = ({ isOpen, onClose, userId, currentUser, onNavigate }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(false);
  const [retrying,  setRetrying]  = useState(false);
  const [category,  setCategory]  = useState("all");
  const badgeCleared = useRef(false);

  const handleNavigate = useCallback((path) => {
    if (onNavigate) onNavigate(path);
    onClose();
  }, [onNavigate, onClose]);

  // ── Load ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) { badgeCleared.current = false; return; }
    if (!userId) return;

    setLoading(true);
    setError(false);

    if (!badgeCleared.current) {
      badgeCleared.current = true;
      notificationService.clearHeaderBadge(userId);
    }

    notificationService.getNotifications(userId)
      .then(data => { setNotifications(data); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });

    const unsub = notificationService.subscribe(() => {
      setNotifications([...(notificationService._cache || [])]);
    });
    return unsub;
  }, [isOpen, userId]);

  const handleMarkRead    = useCallback(id => notificationService.markAsRead(id), []);
  const handleMarkAllRead = useCallback(() => notificationService.markAllAsRead(userId), [userId]);
  const handleRetry       = useCallback(async () => {
    setRetrying(true); setError(false);
    try {
      const data = await notificationService.getNotifications(userId, 50, true);
      setNotifications(data);
    } catch { setError(true); }
    finally { setRetrying(false); }
  }, [userId]);

  // ── Category filter + counts ───────────────────────────────
  const totalUnread = notifications.filter(n => !n.is_read).length;

  const catCounts = Object.fromEntries(
    CATEGORIES.map(c => [
      c.id,
      c.id === "all"
        ? totalUnread
        : notifications.filter(n => !n.is_read && inferCategory(n) === c.id).length
    ])
  );

  const filtered = category === "all"
    ? notifications
    : notifications.filter(n => inferCategory(n) === category);

  if (!isOpen) return null;

  const emptyInfo = CATEGORY_EMPTY[category] || CATEGORY_EMPTY.all;

  return (
    <>
      <div className="ns-overlay" onClick={onClose} role="dialog" aria-modal aria-label="Notifications">
        <div className="ns" onClick={e => e.stopPropagation()}>

          {/* ── Header ── */}
          <div className="ns__head">
            <div className="ns__head-left">
              <Bell size={15} className="ns__head-icon" />
              <span className="ns__title">Notifications</span>
              {totalUnread > 0 && (
                <span className="ns__badge" aria-label={`${totalUnread} unread`}>
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              )}
            </div>
            <div className="ns__head-right">
              {totalUnread > 0 && (
                <button className="ns__mark-btn" onClick={handleMarkAllRead} title="Mark all as read">
                  <CheckCheck size={13} /> All read
                </button>
              )}
              <button className="ns__close-btn" onClick={onClose} aria-label="Close notifications">
                <X size={17} />
              </button>
            </div>
          </div>

          {/* ── Category filter strip (NEW in v4) ── */}
          <div className="ns__cats">
            {CATEGORIES.map(cat => {
              const cnt = catCounts[cat.id] || 0;
              const on  = category === cat.id;
              const { Icon } = cat;
              return (
                <button
                  key={cat.id}
                  className={`ns__cat-btn${on ? " ns__cat-btn--on" : ""}`}
                  onClick={() => setCategory(cat.id)}
                  style={{ "--cat-color": cat.color }}
                >
                  <Icon size={11} />
                  <span>{cat.label}</span>
                  {cnt > 0 && <span className="ns__cat-cnt">{cnt}</span>}
                </button>
              );
            })}
          </div>

          {/* Section label */}
          {!loading && filtered.length > 0 && (
            <div className="ns__section-label">
              {category === "all" ? "Recent activity" : `${CATEGORIES.find(c=>c.id===category)?.label} activity`}
              &nbsp;·&nbsp;{filtered.length}
            </div>
          )}

          {/* ── Body ── */}
          <div className="ns__list" role="feed">
            {loading ? (
              <Skeleton />
            ) : error ? (
              <div className="ns__state">
                <AlertCircle size={36} className="ns__state-icon--error" />
                <div className="ns__state-title">Failed to load</div>
                <div className="ns__state-hint">Something went wrong. Please try again.</div>
                <button className="ns__retry-btn" onClick={handleRetry} disabled={retrying}>
                  {retrying ? <><RefreshCw size={12} className="ns__spin" /> Retrying…</> : "Try again"}
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="ns__state">
                <div className="ns__state-bell">{emptyInfo.bell}</div>
                <div className="ns__state-title">{emptyInfo.title}</div>
                <div className="ns__state-hint">{emptyInfo.hint}</div>
              </div>
            ) : (
              <>
                {filtered.map(n => (
                  <NotifItem
                    key={n.id}
                    notif={n}
                    onRead={handleMarkRead}
                    onNavigate={handleNavigate}
                    currentUserId={currentUser?.id || userId}
                  />
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
  /* ── Overlay ── */
  .ns-overlay {
    position:fixed; inset:0;
    background:rgba(0,0,0,0.72);
    backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px);
    z-index:10000; animation:nsFadeIn .2s ease;
  }
  @keyframes nsFadeIn { from{opacity:0} to{opacity:1} }

  /* ── Panel ── */
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

  /* ── Header ── */
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
    display:flex; align-items:center; gap:5px; padding:6px 11px;
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

  /* ── Category filter strip (NEW v4) ── */
  .ns__cats {
    display:flex; gap:5px;
    padding:10px 12px;
    border-bottom:1px solid rgba(255,255,255,.05);
    overflow-x:auto; scrollbar-width:none; flex-shrink:0;
  }
  .ns__cats::-webkit-scrollbar { display:none; }

  .ns__cat-btn {
    display:inline-flex; align-items:center; gap:5px;
    padding:5px 11px; border-radius:20px; flex-shrink:0;
    font-size:11.5px; font-weight:600; cursor:pointer;
    background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.07);
    color:rgba(255,255,255,.38); transition:all .15s;
  }
  .ns__cat-btn:hover {
    background:rgba(255,255,255,.07); color:rgba(255,255,255,.65);
  }
  .ns__cat-btn--on {
    background:color-mix(in srgb, var(--cat-color) 12%, transparent);
    border-color:color-mix(in srgb, var(--cat-color) 40%, transparent);
    color:var(--cat-color);
  }
  .ns__cat-cnt {
    padding:1px 5px; border-radius:10px;
    font-size:9px; font-weight:700;
    background:rgba(255,255,255,.1); color:inherit;
  }
  .ns__cat-btn--on .ns__cat-cnt {
    background:color-mix(in srgb, var(--cat-color) 22%, transparent);
  }

  /* ── Section label ── */
  .ns__section-label {
    padding:8px 14px 4px;
    font-size:10px; font-weight:700;
    text-transform:uppercase; letter-spacing:.8px; color:#3a3a3a;
    flex-shrink:0;
  }

  /* ── List ── */
  .ns__list {
    flex:1; overflow-y:auto; padding:4px 6px 16px;
    overscroll-behavior:contain;
  }
  .ns__list::-webkit-scrollbar { width:3px; }
  .ns__list::-webkit-scrollbar-thumb { background:rgba(132,204,22,.2); border-radius:3px; }

  /* ── Notification item ── */
  .ni {
    position:relative; border-radius:13px; margin-bottom:4px;
    border:1px solid transparent;
    background:rgba(255,255,255,.018);
    transition:background .15s, border-color .15s;
    animation:niEnter .25s ease both; overflow:hidden;
  }
  @keyframes niEnter { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  .ni:hover        { background:rgba(255,255,255,.036); border-color:rgba(255,255,255,.07); }
  .ni--unread      { background:rgba(132,204,22,.04); border-color:rgba(132,204,22,.14); }
  .ni--unread:hover{ background:rgba(132,204,22,.07); border-color:rgba(132,204,22,.24); }

  /* PayWave items: subtle gradient tint */
  .ni--paywave.ni--unread {
    background:linear-gradient(135deg,rgba(163,230,53,.04),rgba(168,85,247,.02));
    border-color:rgba(163,230,53,.15);
  }

  .ni__bar {
    position:absolute; left:0; top:50%; transform:translateY(-50%);
    width:3px; height:55%; min-height:20px;
    background:linear-gradient(180deg,#a3e635,#84cc16);
    border-radius:0 3px 3px 0; box-shadow:0 0 6px rgba(132,204,22,.5);
  }

  .ni__top {
    display:flex; align-items:flex-start; gap:10px;
    padding:10px 10px 8px 14px; cursor:pointer; transition:transform .1s;
  }
  .ni__top:hover  { transform:translateX(1px); }
  .ni__top:active { transform:scale(.99); }

  .ni__avatar {
    width:38px; height:38px; border-radius:50%;
    background:linear-gradient(135deg,#84cc16,#4d7c0f);
    display:flex; align-items:center; justify-content:center;
    flex-shrink:0; overflow:hidden;
    border:1.5px solid rgba(132,204,22,.2);
    transition:border-color .15s, transform .15s;
  }
  .ni__top:hover .ni__avatar { border-color:rgba(132,204,22,.4); transform:scale(1.04); }
  .ni__avatar img     { width:100%; height:100%; object-fit:cover; display:block; }
  .ni__avatar-fb      {
    font-weight:800; font-size:15px; color:#000;
    width:100%; height:100%;
    display:flex; align-items:center; justify-content:center;
  }

  .ni__body       { flex:1; min-width:0; }
  .ni__msg-wrap       { overflow:hidden; max-height:3.2em; transition:max-height .3s cubic-bezier(.4,0,.2,1); }
  .ni__msg-wrap--open { max-height:600px; }
  .ni__msg {
    font-size:12.5px; color:#c4c4c4; line-height:1.5; margin:0 0 4px;
    word-break:break-word;
    display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden;
  }
  .ni__msg--expanded  { display:block; -webkit-line-clamp:unset; overflow:visible; }
  .ni--unread .ni__msg{ color:#e8e8e8; font-weight:500; }

  .ni__preview {
    font-size:11.5px; color:#525252; font-style:italic;
    margin:0 0 4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  }

  .ni__foot { display:flex; align-items:center; gap:7px; flex-wrap:wrap; }
  .ni__time { font-size:10px; color:#484848; flex-shrink:0; }
  .ni__expand-btn {
    display:inline-flex; align-items:center; gap:3px;
    font-size:10px; color:#84cc16; font-weight:600;
    background:none; border:none; cursor:pointer; padding:0; transition:opacity .15s;
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

  /* Action buttons */
  .ni__actions { display:flex; gap:6px; padding:0 10px 10px 62px; }
  .ni__btn {
    flex:1; padding:6px 12px; border-radius:8px;
    font-size:11.5px; font-weight:700; cursor:pointer;
    transition:all .15s; border:none; text-align:center; white-space:nowrap;
  }
  .ni__btn--primary {
    background:linear-gradient(135deg,#84cc16,#65a30d); color:#000;
    box-shadow:0 2px 8px rgba(132,204,22,.25);
  }
  .ni__btn--primary:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 4px 12px rgba(132,204,22,.35); }
  .ni__btn--primary:disabled { opacity:.65; cursor:default; }
  .ni__btn--done { background:rgba(132,204,22,.1); color:#84cc16; border:1px solid rgba(132,204,22,.25); box-shadow:none; }
  .ni__btn--ghost { background:rgba(255,255,255,.05); color:#a3a3a3; border:1px solid rgba(255,255,255,.1); }
  .ni__btn--ghost:hover { background:rgba(255,255,255,.1); color:#fff; border-color:rgba(255,255,255,.2); }

  /* Skeleton */
  .ns__skeletons { padding:6px 2px; }
  .ns__sk {
    display:flex; align-items:center; gap:10px; padding:10px; margin-bottom:4px;
    border-radius:13px; background:rgba(255,255,255,.018);
    animation:nsPulse 1.6s ease-in-out infinite;
  }
  .ns__sk-av   { width:38px; height:38px; border-radius:50%; background:rgba(255,255,255,.07); flex-shrink:0; }
  .ns__sk-body { flex:1; display:flex; flex-direction:column; gap:8px; }
  .ns__sk-line { height:10px; border-radius:5px; background:rgba(255,255,255,.07); }
  @keyframes nsPulse { 0%,100%{opacity:.4} 50%{opacity:.8} }

  /* Empty / error */
  .ns__state {
    display:flex; flex-direction:column; align-items:center;
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
    cursor:pointer; transition:all .15s; display:flex; align-items:center; gap:6px;
  }
  .ns__retry-btn:hover    { background:rgba(132,204,22,.16); }
  .ns__retry-btn:disabled { opacity:.6; cursor:not-allowed; }
  .ns__spin { animation:nsRotate .8s linear infinite; }
  @keyframes nsRotate { to{transform:rotate(360deg)} }
  .ns__end-label { text-align:center; font-size:10.5px; color:#363636; padding:12px 0 4px; }
`;

export default NotificationSidebar;