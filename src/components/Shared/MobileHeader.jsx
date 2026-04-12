// ============================================================================
// src/components/Header/MobileHeader.jsx
// [4-TAB] Added "news" tab — Posts | Reels | Stories | News
// All other logic (real-time badges, typing animation) unchanged.
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Bell, HeadsetIcon, Clock, TrendingUp } from "lucide-react";
import notificationService from "../../services/notifications/notificationService";
import conversationState from "../../services/messages/ConversationStateManager";
import onlineStatusService from "../../services/messages/onlineStatusService";
import MobileTrendingModal from "./MobileTrendingModal";
import DMMessagesView from "../Messages/DMMessagesView";
import AvatarDropdown from "../Shared/AvatarDropdown";
import { supabase } from "../../services/config/supabase";

// ── Boost colours ─────────────────────────────────────────────────────────────
const TIER_GREETING_COLORS = {
  silver: "#d4d4d4", gold: "#fbbf24", diamond: "#a78bfa",
};
const DIAMOND_THEME_COLORS = {
  "diamond-cosmos": "#a78bfa", "diamond-glacier": "#60a5fa",
  "diamond-emerald": "#34d399", "diamond-rose": "#f472b6",
  "diamond-void": "#e5e5e5", "diamond-inferno": "#ff6b35",
  "diamond-aurora": "#22d3ee",
};
const getGreetingColor = (profile) => {
  const tier    = profile?.subscription_tier ?? profile?.subscriptionTier ?? "standard";
  const themeId = profile?.boost_selections?.themeId ?? null;
  if (!TIER_GREETING_COLORS[tier]) return null;
  if (tier === "diamond" && themeId && DIAMOND_THEME_COLORS[themeId])
    return DIAMOND_THEME_COLORS[themeId];
  return TIER_GREETING_COLORS[tier];
};

// ── Messenger icon ────────────────────────────────────────────────────────────
const MessengerIcon = ({ size = 17, color = "#a3e635" }) => (
  <svg width={size} height={size} viewBox="0 0 17 17" fill="none">
    <path d="M8.5 0.5C3.806 0.5 0 4.045 0 8.401c0 2.494 1.161 4.723 2.984 6.218v3.6l2.794-1.534C6.562 16.826 7.512 17 8.5 17c4.694 0 8.5-3.545 8.5-7.599S13.194 0.5 8.5 0.5Z" fill={color}/>
    <path d="M9 4.5L4.5 9.5h3.8L7.5 13L12 8h-3.8L9 4.5Z" fill="#000" opacity="0.55"/>
  </svg>
);

// ── Custom tab icons ──────────────────────────────────────────────────────────
const PostsTabIcon = ({ active }) => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <rect x="0.75" y="0.75" width="5.5" height="5.5" rx="1.25"
      fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.4"/>
    <rect x="8.75" y="0.75" width="5.5" height="5.5" rx="1.25"
      fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.4"/>
    <rect x="0.75" y="8.75" width="5.5" height="5.5" rx="1.25"
      fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.4"/>
    <rect x="8.75" y="8.75" width="5.5" height="5.5" rx="1.25"
      fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray="1.5 1.5"/>
  </svg>
);

const ReelsTabIcon = ({ active }) => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <circle cx="7.5" cy="7.5" r="6.5"
      fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.4"/>
    <path d="M6 5L10.5 7.5L6 10V5Z"
      fill={active ? "rgba(0,0,0,0.72)" : "currentColor"}/>
  </svg>
);

const StoriesTabIcon = ({ active }) => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <path d="M7.5 1L9.18 5.3H13.8L10.06 7.97L11.41 12.5L7.5 9.6L3.59 12.5L4.94 7.97L1.2 5.3H5.82L7.5 1Z"
      fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
  </svg>
);

// ── [4-TAB] News tab icon ─────────────────────────────────────────────────────
const NewsTabIcon = ({ active }) => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <rect x="0.9" y="2.2" width="13.2" height="10.6" rx="1.6"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor" strokeWidth="1.3"/>
    <rect x="2.5" y="4.4" width="10" height="1.8" rx="0.5"
      fill={active ? "rgba(0,0,0,0.55)" : "currentColor"}/>
    <line x1="2.5" y1="8"    x2="8.5"  y2="8"    stroke={active ? "rgba(0,0,0,0.4)" : "currentColor"} strokeWidth="1" strokeLinecap="round"/>
    <line x1="2.5" y1="10.2" x2="8.5"  y2="10.2" stroke={active ? "rgba(0,0,0,0.4)" : "currentColor"} strokeWidth="1" strokeLinecap="round"/>
    <rect x="9.8" y="7.5" width="2.8" height="3.2" rx="0.6"
      fill={active ? "rgba(0,0,0,0.35)" : "none"}
      stroke={active ? "none" : "currentColor"}
      strokeWidth="1"/>
  </svg>
);

// ── [4-TAB] Home tabs array ───────────────────────────────────────────────────
const HOME_TABS = [
  { id: "posts",   Icon: PostsTabIcon,   label: "Posts"   },
  { id: "reels",   Icon: ReelsTabIcon,   label: "Reels"   },
  { id: "stories", Icon: StoriesTabIcon, label: "Stories" },
  { id: "news",    Icon: NewsTabIcon,    label: "News"    },
];

// ── Fetch unread data ─────────────────────────────────────────────────────────
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
  } catch {
    return { count: conversationState.getTotalUnreadCount() ?? 0, convSet: new Set() };
  }
};

// ── Component ─────────────────────────────────────────────────────────────────
const MobileHeader = ({
  getGreeting,
  onNotificationClick,
  onSupportClick,
  setActiveTab,
  profile,
  userId,
  currentUser,
  onSignOut,
  activeTab,
  activeHomeTab,
  setActiveHomeTab,
}) => {
  const [displayedText,     setDisplayedText]     = useState("");
  const [isTyping,          setIsTyping]           = useState(false);
  const [greetingText,      setGreetingText]       = useState(getGreeting?.() || "Good Morning");
  const [imageLoaded,       setImageLoaded]        = useState(false);
  const [imageError,        setImageError]         = useState(false);
  const [badgeCount,        setBadgeCount]         = useState(() => notificationService.getHeaderBadgeCountSync());
  const [unreadMessages,    setUnreadMessages]     = useState(0);
  const [showTrendingModal, setShowTrendingModal]  = useState(false);
  const [showMessages,      setShowMessages]       = useState(false);

  const timerRef        = useRef(null);
  const typeIntervalRef = useRef(null);
  const showMessagesRef = useRef(showMessages);
  const myConvSetRef    = useRef(new Set());
  const pollRef         = useRef(null);

  useEffect(() => { showMessagesRef.current = showMessages; }, [showMessages]);

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

  const tier       = profile?.subscription_tier ?? profile?.subscriptionTier ?? "standard";
  const themeId    = profile?.boost_selections?.themeId ?? null;
  const hasBoosted = ["silver", "gold", "diamond"].includes(tier);
  const tierColor  = getGreetingColor(profile);

  const syncBadge = useCallback(() => {
    setBadgeCount(notificationService.getHeaderBadgeCountSync());
  }, []);

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
    const msgChannel = supabase
      .channel(`mh-inbound-messages-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const row = payload.new ?? {};
        if (row.sender_id === userId || showMessagesRef.current) return;
        if (myConvSetRef.current.has(row.conversation_id)) setUnreadMessages((prev) => prev + 1);
        else refreshUnread();
      })
      .subscribe();
    const notifChannel = supabase
      .channel(`mh-inbound-notifs-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_user_id=eq.${userId}` }, () => {
        setBadgeCount((prev) => prev + 1);
      })
      .subscribe();
    pollRef.current = setInterval(refreshUnread, 15_000);
    onlineStatusService.start(userId);
    return () => {
      unsubNotif(); unsubConv();
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

  useEffect(() => {
    if (showMessages) setUnreadMessages(0);
    else              refreshUnread();
  }, [showMessages, refreshUnread]);

  useEffect(() => {
    let cancelled = false;
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
      typeText(greetingText, () => {
        timerRef.current = setTimeout(() => {
          unTypeText(greetingText, () => { timerRef.current = setTimeout(cycle, 60_000); });
        }, 240_000);
      });
    };
    const greetingInterval = setInterval(() => {
      const ng = getGreeting?.();
      if (ng && ng !== greetingText) setGreetingText(ng);
    }, 60_000);
    const startDelay = setTimeout(cycle, 500);
    return () => {
      cancelled = true;
      clearTimeout(startDelay); clearTimeout(timerRef.current);
      clearTimeout(typeIntervalRef.current); clearInterval(greetingInterval);
    };
  }, [greetingText, getGreeting]);

  const isOnHome = activeTab === "home";

  return (
    <>
      <style>{mobileHeaderStyles(isTyping, displayedText, tierColor, hasBoosted, isOnHome)}</style>

      <header className="mh-header">
        <div className="mh-content">
          <div className="mh-left">
            <AvatarDropdown
              profile={profile} userId={userId}
              avatarUrl={avatarUrl} fallbackLetter={fallbackLetter}
              isValidAvatar={isValidAvatar} imageLoaded={imageLoaded} imageError={imageError}
              onImageLoad={() => { setImageLoaded(true);  setImageError(false); }}
              onImageError={() => { setImageLoaded(false); setImageError(true); }}
              onOpenAccount={() => setActiveTab("account")}
              onSignOut={onSignOut} isMobile={true}
              boostTier={hasBoosted ? tier    : null}
              boostThemeId={hasBoosted ? themeId : null}
            />
            <div className="mh-greeting-box">
              <Clock size={13} className="mh-greeting-icon" />
              <span className="mh-greeting-text">{displayedText}</span>
            </div>
          </div>

          <div className="mh-actions">
            <button className="mh-btn trending" onClick={() => setShowTrendingModal(true)} aria-label="Trending">
              <TrendingUp size={17} />
            </button>
            <button className="mh-btn messages" onClick={handleMessagesClick} aria-label="Messages">
              <MessengerIcon size={17} color="#a3e635" />
              {unreadMessages > 0 && (
                <span className="mh-badge mh-badge--msg">
                  {unreadMessages > 99 ? "99+" : unreadMessages}
                </span>
              )}
            </button>
            <button className="mh-btn notification" onClick={handleNotificationClick} aria-label="Notifications">
              <Bell size={17} />
              {badgeCount > 0 && (
                <span className="mh-badge mh-badge--notif">
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}
            </button>
            <button className="mh-btn support" onClick={onSupportClick} aria-label="Support">
              <HeadsetIcon size={17} />
            </button>
          </div>
        </div>

        {/* [4-TAB] Tab bar — only on home, now 4 tabs */}
        {isOnHome && (
          <nav className="mh-tab-bar" aria-label="Feed tabs">
            {HOME_TABS.map(({ id, Icon, label }) => {
              const active = activeHomeTab === id;
              return (
                <button
                  key={id}
                  className={`mh-tab${active ? " mh-tab--active" : ""}${id === "news" ? " mh-tab--news" : ""}`}
                  onClick={() => setActiveHomeTab?.(id)}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon active={active} />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>
        )}
      </header>

      <MobileTrendingModal
        isOpen={showTrendingModal}
        onClose={() => setShowTrendingModal(false)}
        currentUser={currentUser}
      />

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

const mobileHeaderStyles = (isTyping, displayedText, tierColor, hasBoosted, isOnHome) => {
  const textStyle = hasBoosted && tierColor
    ? `color: ${tierColor}; text-shadow: 0 0 10px ${tierColor}55;`
    : `background: linear-gradient(135deg,#84cc16 0%,#65a30d 100%);
       -webkit-background-clip: text; -webkit-text-fill-color: transparent;
       background-clip: text;`;
  const cursorColor = hasBoosted && tierColor ? tierColor : "#84cc16";
  const iconColor   = hasBoosted && tierColor ? tierColor : "#84cc16";
  const boxBorder   = hasBoosted && tierColor ? `${tierColor}22` : "rgba(255,255,255,0.07)";
  const boxBg       = hasBoosted && tierColor ? `${tierColor}07` : "rgba(255,255,255,0.02)";

  return `
    .mh-header { position: sticky; top: 0; z-index: 100; background: #000; border-bottom: 1px solid rgba(255,255,255,0.08); margin: 0; padding: 0; }
    .mh-content { display: flex; align-items: center; justify-content: space-between; padding: 6px 12px; gap: 8px; margin: 0; }
    .mh-left { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
    .mh-greeting-box { display: flex; align-items: center; gap: 5px; min-width: 0; min-height: 22px; padding: 2px 8px; background: ${boxBg}; border: 1px solid ${boxBorder}; border-radius: 7px; overflow: hidden; transition: background 0.4s, border-color 0.4s; }
    .mh-greeting-icon { color: ${iconColor}; flex-shrink: 0; opacity: ${displayedText ? "1" : "0"}; transition: opacity 0.3s, color 0.4s; }
    .mh-greeting-text { font-size: 10px; font-weight: 600; ${textStyle} white-space: nowrap; overflow: hidden; text-overflow: ellipsis; position: relative; letter-spacing: 0.1px; }
    .mh-greeting-text::after { content: ""; position: absolute; right: -5px; top: 50%; transform: translateY(-50%); width: 1.5px; height: 85%; background: ${cursorColor}; border-radius: 1px; animation: ${isTyping ? "mhBlink 0.9s ease-in-out infinite" : "none"}; }
    @keyframes mhBlink { 0%,45%{opacity:1} 50%,95%{opacity:0} 100%{opacity:1} }

    .mh-actions { display: flex; align-items: center; gap: 5px; flex-shrink: 0; }
    .mh-btn { position: relative; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.18s; border: 1px solid rgba(255,255,255,0.07); background: rgba(255,255,255,0.02); color: #6b7280; }
    .mh-btn.trending     { border-color: rgba(132,204,22,0.2);  background: rgba(132,204,22,0.04);  color: #84cc16; }
    .mh-btn.messages     { border-color: rgba(163,230,53,0.2);  background: rgba(163,230,53,0.03); }
    .mh-btn.notification { border-color: rgba(132,204,22,0.14); color: #84cc16; }
    .mh-btn.support      { color: #60a5fa; border-color: rgba(96,165,250,0.14); }
    .mh-btn:active       { transform: scale(0.9); }

    .mh-badge { position: absolute; top: -7px; right: -7px; min-width: 17px; height: 17px; padding: 0 4px; border-radius: 9px; font-size: 9.5px; font-weight: 900; display: flex; align-items: center; justify-content: center; border: 2.5px solid #000; line-height: 1; z-index: 2; letter-spacing: -0.2px; animation: mhBadgePop 0.35s cubic-bezier(.34,1.56,.64,1), mhBadgePulse 2.5s ease-in-out 0.35s infinite; }
    .mh-badge--msg   { background: #ff3b30; color: #ffffff; box-shadow: 0 0 0 1px rgba(0,0,0,0.35), 0 2px 8px rgba(255,59,48,0.6); }
    .mh-badge--notif { background: #ff3b30; color: #ffffff; box-shadow: 0 0 0 1px rgba(0,0,0,0.35), 0 2px 8px rgba(255,59,48,0.6); }
    @keyframes mhBadgePop   { from{transform:scale(0);opacity:0} to{transform:scale(1);opacity:1} }
    @keyframes mhBadgePulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.15)} }

    /* [4-TAB] Tab bar */
    .mh-tab-bar { display: flex; border-top: 1px solid rgba(255,255,255,0.06); background: #000; }
    .mh-tab { flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px; height: 38px; background: transparent; border: none; color: rgba(255,255,255,0.35); font-size: 11px; font-weight: 700; cursor: pointer; transition: color 0.18s ease, background 0.18s ease; border-bottom: 2px solid transparent; margin-bottom: -1px; font-family: inherit; }
    .mh-tab:hover { color: rgba(255,255,255,0.7); }
    .mh-tab--active { color: #84cc16; border-bottom-color: #84cc16; background: rgba(132,204,22,0.04); }
    /* News tab uses blue accent */
    .mh-tab--news.mh-tab--active { color: #60a5fa; border-bottom-color: #60a5fa; background: rgba(59,130,246,0.06); }

    @media (min-width: 769px) { .mh-header { display: none; } }
    @media (max-width: 360px) { .mh-greeting-text { font-size: 9px; } .mh-content { padding: 6px 10px; } .mh-btn { width: 30px; height: 30px; } .mh-tab { font-size: 10px; } }
  `;
};

export default MobileHeader;