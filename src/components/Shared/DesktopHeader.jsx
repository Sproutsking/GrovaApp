// src/components/Header/DesktopHeader.jsx
// ============================================================================
// BRIGHT MODEL + REDESIGNED CENTRE NAV TABS
// [FIX-RT]     Real-time badge is now INSTANT and RELIABLE:
//              • Membership map is pre-built at init and kept in a ref so the
//                realtime INSERT handler never needs an async DB round-trip.
//              • No more race between async membership check and badge increment
//                — if conversation_id is in our convSet, we increment immediately
//                (optimistic UI, same pattern as message send on sender side).
//              • Full DB re-query still runs every 15 s as safety net but is
//                NOT on the hot path for badge updates.
// [FIX-MSG]    Unread count queries via conversations membership (no receiver_id).
// [FIX-BADGE]  Badge colors redesigned — both badges use vivid iOS-red (#ff3b30)
//              with white text for maximum urgency and visual consistency,
//              matching the design intent in the screenshot.
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Clock, Bell, HelpCircle } from "lucide-react";
import notificationService from "../../services/notifications/notificationService";
import conversationState from "../../services/messages/ConversationStateManager";
import onlineStatusService from "../../services/messages/onlineStatusService";
import DMMessagesView from "../Messages/DMMessagesView";
import AvatarDropdown from "../Shared/AvatarDropdown";
import { supabase } from "../../services/config/supabase";

// ── Boost tier colours ────────────────────────────────────────────────────────
const TIER_GREETING_COLORS = {
  silver:  "#d4d4d4",
  gold:    "#fbbf24",
  diamond: "#a78bfa",
};
const DIAMOND_THEME_COLORS = {
  "diamond-cosmos":  "#a78bfa",
  "diamond-glacier": "#60a5fa",
  "diamond-emerald": "#34d399",
  "diamond-rose":    "#f472b6",
  "diamond-void":    "#e5e5e5",
  "diamond-inferno": "#ff6b35",
  "diamond-aurora":  "#22d3ee",
};
const getGreetingColor = (profile) => {
  const tier    = profile?.subscription_tier ?? profile?.subscriptionTier ?? "standard";
  const themeId = profile?.boost_selections?.themeId ?? null;
  if (!TIER_GREETING_COLORS[tier]) return "rgba(255,255,255,0.5)";
  if (tier === "diamond" && themeId && DIAMOND_THEME_COLORS[themeId])
    return DIAMOND_THEME_COLORS[themeId];
  return TIER_GREETING_COLORS[tier];
};

// ── Messenger icon ────────────────────────────────────────────────────────────
const MessengerIcon = ({ size = 15, color = "#a3e635" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <path d="M8 0.5C3.582 0.5 0 3.862 0 8c0 2.34 1.091 4.43 2.8 5.84V17l2.625-1.44C6.23 15.847 7.1 16 8 16c4.418 0 8-3.362 8-7.5S12.418 0.5 8 0.5Z" fill={color}/>
    <path d="M8.5 4L4 9h3.6L7 12.5L11.5 7.5h-3.6L8.5 4Z" fill="#000" opacity="0.55"/>
  </svg>
);

// ── Custom tab icons ──────────────────────────────────────────────────────────
const PostsIcon = ({ active }) => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
    <rect x="0.85" y="0.85" width="6.3" height="6.3" rx="1.4"
      fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5"/>
    <rect x="9.85" y="0.85" width="6.3" height="6.3" rx="1.4"
      fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5"/>
    <rect x="0.85" y="9.85" width="6.3" height="6.3" rx="1.4"
      fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5"/>
    <rect x="9.85" y="9.85" width="6.3" height="6.3" rx="1.4"
      fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="1.8 1.6"/>
  </svg>
);

const ReelsIcon = ({ active }) => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
    {active ? (
      <>
        <circle cx="8.5" cy="8.5" r="7.5" fill="currentColor"/>
        <path d="M7 5.8L12.1 8.5L7 11.2V5.8Z" fill="rgba(0,0,0,0.72)"/>
      </>
    ) : (
      <>
        <circle cx="8.5" cy="8.5" r="7" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M7 5.8L12.1 8.5L7 11.2V5.8Z" fill="currentColor"/>
      </>
    )}
  </svg>
);

const StoriesIcon = ({ active }) => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
    <path
      d="M8.5 1.2L10.4 6.1H15.7L11.4 9L12.9 14.1L8.5 11.1L4.1 14.1L5.6 9L1.3 6.1H6.6L8.5 1.2Z"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round"/>
  </svg>
);

const NAV_TABS = [
  { id: "posts",   Icon: PostsIcon,   label: "Posts"   },
  { id: "reels",   Icon: ReelsIcon,   label: "Reels"   },
  { id: "stories", Icon: StoriesIcon, label: "Stories" },
];

// ── Fetch unread count + build membership map in one query ────────────────────
// Returns { count, convSet } where convSet is a Set of conversation_id strings
// that this user is a member of. The convSet is used by the realtime handler
// to instantly decide whether an incoming INSERT belongs to this user without
// making another async DB call.
const fetchUnreadData = async (userId) => {
  try {
    const { data: convs, error: convErr } = await supabase
      .from("conversations")
      .select("id")
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

    if (convErr || !convs?.length) return { count: 0, convSet: new Set() };

    const convSet = new Set(convs.map((c) => c.id));
    const convIds = Array.from(convSet);

    const { count, error } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .in("conversation_id", convIds)
      .neq("sender_id", userId)
      .eq("read", false);

    return { count: error ? 0 : (count ?? 0), convSet };
  } catch (_) {
    return {
      count: conversationState.getTotalUnreadCount() ?? 0,
      convSet: new Set(),
    };
  }
};

// ── Component ─────────────────────────────────────────────────────────────────
const DesktopHeader = ({
  currentUser,
  getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  },
  onNotificationClick,
  onSupportClick,
  setActiveTab,
  profile,
  userId,
  onSignOut,
  activeHomeTab,
  setActiveHomeTab,
}) => {
  const [displayedText,  setDisplayedText]  = useState("");
  const [isTyping,       setIsTyping]        = useState(false);
  const [greetingText,   setGreetingText]    = useState(getGreeting());
  const [imageLoaded,    setImageLoaded]     = useState(false);
  const [imageError,     setImageError]      = useState(false);
  const [badgeCount,     setBadgeCount]      = useState(() => notificationService.getHeaderBadgeCountSync());
  const [unreadMessages, setUnreadMessages]  = useState(0);
  const [showMessages,   setShowMessages]    = useState(false);

  const timerRef        = useRef(null);
  const typeIntervalRef = useRef(null);
  const showMessagesRef = useRef(false);
  // [FIX-RT] Membership set kept in a ref so the realtime handler always has
  // the latest data without being re-subscribed on every render.
  const myConvSetRef    = useRef(new Set());
  const pollRef         = useRef(null);

  useEffect(() => { showMessagesRef.current = showMessages; }, [showMessages]);

  // ── Avatar ─────────────────────────────────────────────────────────────────
  let avatarUrl = profile?.avatar;
  if (avatarUrl && typeof avatarUrl === "string") {
    const cleanUrl = avatarUrl.split("?")[0];
    if (cleanUrl.includes("supabase"))
      avatarUrl = `${cleanUrl}?quality=100&width=400&height=400&resize=cover&format=webp`;
  }
  const fallbackLetter = profile?.fullName?.charAt(0)?.toUpperCase() || "U";
  const isValidAvatar  =
    avatarUrl && typeof avatarUrl === "string" && !imageError &&
    (avatarUrl.startsWith("http") || avatarUrl.startsWith("blob:"));

  const tier          = profile?.subscription_tier ?? profile?.subscriptionTier ?? "standard";
  const themeId       = profile?.boost_selections?.themeId ?? null;
  const hasBoosted    = ["silver", "gold", "diamond"].includes(tier);
  const greetingColor = getGreetingColor(profile);

  // ── Badge sync ─────────────────────────────────────────────────────────────
  const syncBadge = useCallback(() => {
    setBadgeCount(notificationService.getHeaderBadgeCountSync());
  }, []);

  // [FIX-RT] refreshUnread fetches count AND rebuilds the membership map so
  // subsequent realtime events can be decided synchronously.
  const refreshUnread = useCallback(async () => {
    if (showMessagesRef.current) return;
    const { count, convSet } = await fetchUnreadData(userId);
    myConvSetRef.current = convSet;
    setUnreadMessages(count);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    notificationService.getHeaderBadgeCount(userId).then(setBadgeCount).catch(() => {});
    refreshUnread();

    const unsubNotif = notificationService.subscribe(syncBadge);
    const unsubConv  = conversationState.subscribe(() => { refreshUnread(); });

    // ── [FIX-RT] Realtime: new messages ──────────────────────────────────────
    // The membership check is now SYNCHRONOUS using the pre-built convSet ref.
    // No async DB round-trip on the hot path → badge increments instantly,
    // just like the optimistic message send on the sender side.
    const msgChannel = supabase
      .channel(`dh-msgs-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const row = payload.new ?? {};

          // Skip our own sent messages and suppress while panel is open.
          if (row.sender_id === userId || showMessagesRef.current) return;

          // [FIX-RT] Synchronous membership check — no await, no race.
          if (myConvSetRef.current.has(row.conversation_id)) {
            setUnreadMessages((prev) => prev + 1);
          } else {
            // convSet may be stale if a brand-new conversation was just created.
            // Fall back to a full refresh which also rebuilds the map.
            refreshUnread();
          }
        }
      )
      .subscribe();

    // Realtime: new notifications
    const notifChannel = supabase
      .channel(`dh-notifs-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const row = payload.new ?? {};
          const isForMe =
            row.recipient_user_id === userId ||
            row.user_id           === userId ||
            row.recipient_id      === userId;
          if (isForMe) setBadgeCount((p) => p + 1);
        }
      )
      .subscribe();

    // Polling fallback every 15 s — keeps count accurate without being the
    // primary mechanism. Also refreshes the membership map.
    pollRef.current = setInterval(refreshUnread, 15_000);

    onlineStatusService.start(userId);

    return () => {
      unsubNotif();
      unsubConv();
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(notifChannel);
      clearInterval(pollRef.current);
    };
  }, [userId, syncBadge, refreshUnread]);

  const handleMessagesClick = useCallback(() => {
    if (currentUser?.id || userId) {
      setUnreadMessages(0);
      conversationState.markAllRead?.();
      setShowMessages(true);
    }
  }, [currentUser?.id, userId]);

  const handleNotificationClick = useCallback(() => {
    setBadgeCount(0);
    onNotificationClick?.();
  }, [onNotificationClick]);

  // Reset unread to 0 while panel is open, refresh when it closes
  useEffect(() => {
    if (showMessages) {
      setUnreadMessages(0);
    } else {
      refreshUnread();
    }
  }, [showMessages, refreshUnread]);

  // ── Typing animation ───────────────────────────────────────────────────────
  useEffect(() => {
    const fullText = `${greetingText}, ${currentUser?.name || currentUser?.fullName || "User"}`;
    let cancelled  = false;

    const typeText = (text, cb) => {
      setIsTyping(true); let i = 0;
      const tick = () => {
        if (cancelled) return;
        setDisplayedText(text.slice(0, i)); i++;
        if (i <= text.length) typeIntervalRef.current = setTimeout(tick, 80);
        else { setIsTyping(false); cb?.(); }
      };
      tick();
    };

    const unTypeText = (text, cb) => {
      setIsTyping(true); let i = text.length;
      const tick = () => {
        if (cancelled) return;
        setDisplayedText(text.slice(0, i)); i--;
        if (i >= 0) typeIntervalRef.current = setTimeout(tick, 45);
        else { setIsTyping(false); cb?.(); }
      };
      tick();
    };

    const cycle = () => {
      typeText(fullText, () => {
        timerRef.current = setTimeout(() => {
          unTypeText(fullText, () => {
            timerRef.current = setTimeout(cycle, 60_000);
          });
        }, 240_000);
      });
    };

    const greetingInterval = setInterval(() => {
      const ng = getGreeting();
      if (ng !== greetingText) setGreetingText(ng);
    }, 60_000);

    const startDelay = setTimeout(cycle, 500);

    return () => {
      cancelled = true;
      clearTimeout(startDelay);
      clearTimeout(timerRef.current);
      clearTimeout(typeIntervalRef.current);
      clearInterval(greetingInterval);
    };
  }, [greetingText, currentUser?.name, currentUser?.fullName, getGreeting]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{desktopHeaderStyles(isTyping, displayedText, greetingColor, hasBoosted)}</style>

      <header className="dh-header">
        <div className="dh-content">

          {/* LEFT */}
          <div className="dh-left">
            <AvatarDropdown
              profile={profile} userId={userId}
              avatarUrl={avatarUrl} fallbackLetter={fallbackLetter}
              isValidAvatar={isValidAvatar} imageLoaded={imageLoaded} imageError={imageError}
              onImageLoad={() => { setImageLoaded(true);  setImageError(false); }}
              onImageError={() => { setImageLoaded(false); setImageError(true); }}
              onOpenAccount={() => setActiveTab("account")}
              onSignOut={onSignOut} isMobile={false}
              boostTier={hasBoosted ? tier    : null}
              boostThemeId={hasBoosted ? themeId : null}
            />
            <div className="dh-greeting-box">
              <Clock size={14} className="dh-greeting-icon" />
              <span className="dh-greeting-text">{displayedText}</span>
            </div>
          </div>

          {/* CENTRE tabs */}
          <nav className="dh-nav-strip" aria-label="Feed navigation">
            {NAV_TABS.map(({ id, Icon, label }) => {
              const isActive = activeHomeTab === id;
              return (
                <button
                  key={id}
                  className={`dh-nav-tab${isActive ? " dh-nav-tab--active" : ""}`}
                  onClick={() => setActiveHomeTab?.(id)}
                  aria-label={label}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span className="dh-tab-icon"><Icon active={isActive} /></span>
                  <span className="dh-tab-label">{label}</span>
                </button>
              );
            })}
          </nav>

          {/* RIGHT */}
          <div className="dh-right">
            <button className="dh-action-btn messages" onClick={handleMessagesClick} aria-label="Messages">
              <MessengerIcon size={15} color="#a3e635" />
              <span>Messages</span>
              {unreadMessages > 0 && (
                <span className="dh-badge dh-badge--msg">
                  {unreadMessages > 99 ? "99+" : unreadMessages}
                </span>
              )}
            </button>

            <button className="dh-action-btn notification" onClick={handleNotificationClick} aria-label="Notifications">
              <Bell size={15} />
              <span>Alerts</span>
              {badgeCount > 0 && (
                <span className="dh-badge dh-badge--notif">
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}
            </button>

            <button className="dh-action-btn support" onClick={onSupportClick} aria-label="Support">
              <HelpCircle size={15} />
              <span>Support</span>
            </button>
          </div>
        </div>
      </header>

      {showMessages && (
        <DMMessagesView
          currentUser={{
            id:       userId || currentUser?.id,
            name:     currentUser?.name     || currentUser?.fullName || "User",
            fullName: currentUser?.fullName || currentUser?.name     || "User",
            username: currentUser?.username || profile?.username     || "user",
            avatar:   avatarUrl             || currentUser?.avatar,
            avatarId: profile?.id           || currentUser?.avatarId,
            verified: currentUser?.verified || profile?.verified     || false,
          }}
          onClose={() => setShowMessages(false)}
        />
      )}
    </>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const desktopHeaderStyles = (isTyping, displayedText, greetingColor, hasBoosted) => `
  .dh-header {
    height: 58px;
    position: sticky; top: 0; z-index: 100;
    background: #000;
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }
  .dh-content {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 20px; height: 100%;
    max-width: 1600px; margin: 0 auto;
    position: relative;
  }
  .dh-left  { display: flex; align-items: center; gap: 10px; flex: 1; }
  .dh-right { display: flex; align-items: center; gap: 6px; flex: 1; justify-content: flex-end; }

  .dh-greeting-box {
    display: flex; align-items: center; gap: 6px;
    padding: 4px 10px;
    background: ${hasBoosted ? `${greetingColor}10` : "rgba(255,255,255,0.03)"};
    border: 1px solid ${hasBoosted ? `${greetingColor}28` : "rgba(255,255,255,0.07)"};
    border-radius: 9px;
    min-height: 28px; min-width: 36px;
    transition: background 0.4s, border-color 0.4s;
  }
  .dh-greeting-icon {
    color: ${greetingColor}; flex-shrink: 0;
    opacity: ${displayedText ? "1" : "0"};
    transition: opacity 0.3s, color 0.4s;
  }
  .dh-greeting-text {
    font-size: 12px; font-weight: 600;
    color: ${greetingColor};
    white-space: nowrap; position: relative;
    transition: color 0.4s;
    ${hasBoosted ? `text-shadow: 0 0 10px ${greetingColor}50;` : ""}
  }
  .dh-greeting-text::after {
    content: "";
    position: absolute; right: -5px; top: 50%; transform: translateY(-50%);
    width: 2px; height: 13px;
    background: ${greetingColor}; border-radius: 1px;
    animation: ${isTyping ? "dhBlink 0.9s ease-in-out infinite" : "none"};
  }
  @keyframes dhBlink { 0%,45%{opacity:1} 50%,95%{opacity:0} 100%{opacity:1} }

  .dh-nav-strip {
    position: absolute; left: 50%; transform: translateX(-50%);
    display: flex; align-items: center; gap: 2px;
    padding: 4px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 13px; height: 42px;
  }
  .dh-nav-tab {
    position: relative;
    display: flex; align-items: center; gap: 7px;
    padding: 0 15px; height: 32px;
    border-radius: 9px; border: 1px solid transparent;
    background: transparent; color: rgba(255,255,255,0.38);
    font-size: 12px; font-weight: 700; letter-spacing: 0.01em;
    cursor: pointer;
    transition: color 0.18s, background 0.18s, border-color 0.18s, transform 0.15s, box-shadow 0.18s;
    white-space: nowrap; font-family: inherit; user-select: none;
  }
  .dh-nav-tab:hover { color: rgba(255,255,255,0.75); background: rgba(255,255,255,0.06); transform: translateY(-0.5px); }
  .dh-nav-tab:active { transform: scale(0.97); }
  .dh-nav-tab--active {
    color: #84cc16;
    background: rgba(132,204,22,0.13);
    border-color: rgba(132,204,22,0.32);
    box-shadow: 0 0 12px rgba(132,204,22,0.12), inset 0 1px 0 rgba(132,204,22,0.15);
    transform: translateY(-0.5px);
  }
  .dh-nav-tab--active:hover {
    background: rgba(132,204,22,0.18); border-color: rgba(132,204,22,0.45);
    box-shadow: 0 0 18px rgba(132,204,22,0.2), inset 0 1px 0 rgba(132,204,22,0.2);
  }
  .dh-tab-icon { display: flex; align-items: center; flex-shrink: 0; }
  .dh-tab-label { line-height: 1; }

  .dh-action-btn {
    position: relative;
    display: flex; align-items: center; gap: 6px;
    padding: 6px 12px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 9px;
    font-size: 12.5px; font-weight: 600;
    cursor: pointer; transition: all 0.18s;
    white-space: nowrap; font-family: inherit;
  }
  .dh-action-btn.messages     { color: #a3e635; }
  .dh-action-btn.notification { color: #84cc16; }
  .dh-action-btn.support      { color: #60a5fa; }
  .dh-action-btn.messages:hover     { background: rgba(163,230,53,0.08);  border-color: rgba(163,230,53,0.25); transform: translateY(-1px); }
  .dh-action-btn.notification:hover { background: rgba(132,204,22,0.08);  border-color: rgba(132,204,22,0.25); transform: translateY(-1px); }
  .dh-action-btn.support:hover      { background: rgba(96,165,250,0.08);  border-color: rgba(96,165,250,0.25); transform: translateY(-1px); }
  .dh-action-btn:active { transform: scale(0.97); }

  /* ── Badges ──────────────────────────────────────────────────────────────
     Both badges use the same vivid iOS-red (#ff3b30) for maximum urgency
     and visual consistency — this matches the design intent in the screenshot
     where the red count pops clearly against the dark header background.
     Outer box-shadow ring + thick #000 border ensure both badges always
     read clearly regardless of any icon colour sitting underneath them.
  ── */
  .dh-badge {
    position: absolute; top: -8px; right: -8px;
    min-width: 19px; height: 19px; padding: 0 5px;
    border-radius: 10px; font-size: 10px; font-weight: 900;
    display: flex; align-items: center; justify-content: center;
    border: 2.5px solid #000;
    line-height: 1; z-index: 2; letter-spacing: -0.2px;
    animation: dhBadgePop 0.35s cubic-bezier(.34,1.56,.64,1),
               dhBadgePulse 2.8s ease-in-out 0.35s infinite;
  }

  /* Messages — vivid iOS-red with white text.
     Identical visual treatment to the notification badge so both carry the
     same urgency weight and look cohesive in the header. */
  .dh-badge--msg {
    background: #ff3b30;
    color: #ffffff;
    box-shadow: 0 0 0 1px rgba(0,0,0,0.35), 0 2px 8px rgba(255,59,48,0.6);
  }

  /* Notifications — same vivid iOS red, white number */
  .dh-badge--notif {
    background: #ff3b30;
    color: #ffffff;
    box-shadow: 0 0 0 1px rgba(0,0,0,0.35), 0 2px 8px rgba(255,59,48,0.6);
  }

  @keyframes dhBadgePop   { from{transform:scale(0);opacity:0} to{transform:scale(1);opacity:1} }
  @keyframes dhBadgePulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.14)} }
`;

export default DesktopHeader;