// src/components/Header/MobileHeader.jsx
// ============================================================================
// BOOST EDITION — original preserved, additions:
//   [B1] Greeting text color = tier color when boosted
//   [B2] Boost tier/themeId passed to AvatarDropdown
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Bell,
  HeadsetIcon,
  Clock,
  TrendingUp,
  MessageCircle,
} from "lucide-react";
import notificationService from "../../services/notifications/notificationService";
import conversationState from "../../services/messages/ConversationStateManager";
import onlineStatusService from "../../services/messages/onlineStatusService";
import MobileTrendingModal from "./MobileTrendingModal";
import DMMessagesView from "../Messages/DMMessagesView";
import AvatarDropdown from "../Shared/AvatarDropdown";

// [B1] Tier → greeting color
const TIER_GREETING_COLORS = {
  silver: "#d4d4d4",
  gold: "#fbbf24",
  diamond: "#a78bfa",
};
const DIAMOND_THEME_COLORS = {
  "diamond-cosmos": "#a78bfa",
  "diamond-glacier": "#60a5fa",
  "diamond-emerald": "#34d399",
  "diamond-rose": "#f472b6",
  "diamond-void": "#e5e5e5",
  "diamond-inferno": "#ff6b35",
  "diamond-aurora": "#22d3ee",
};
const getGreetingColor = (profile) => {
  const tier =
    profile?.subscription_tier ?? profile?.subscriptionTier ?? "standard";
  const themeId = profile?.boost_selections?.themeId ?? null;
  if (!TIER_GREETING_COLORS[tier]) return null; // null = use default gradient
  if (tier === "diamond" && themeId && DIAMOND_THEME_COLORS[themeId])
    return DIAMOND_THEME_COLORS[themeId];
  return TIER_GREETING_COLORS[tier];
};

const MobileHeader = ({
  getGreeting,
  onNotificationClick,
  onSupportClick,
  setActiveTab,
  profile,
  userId,
  currentUser,
  onSignOut,
}) => {
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [greetingText, setGreetingText] = useState(
    getGreeting?.() || "Good Morning",
  );
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [badgeCount, setBadgeCount] = useState(() =>
    notificationService.getHeaderBadgeCountSync(),
  );
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [showTrendingModal, setShowTrendingModal] = useState(false);
  const [showMessages, setShowMessages] = useState(false);

  const timerRef = useRef(null);
  const typeIntervalRef = useRef(null);

  // ── Avatar ───────────────────────────────────────────────────────────────
  let avatarUrl = profile?.avatar;
  if (avatarUrl && typeof avatarUrl === "string") {
    const cleanUrl = avatarUrl.split("?")[0];
    if (cleanUrl.includes("supabase"))
      avatarUrl = `${cleanUrl}?quality=100&width=400&height=400&resize=cover&format=webp`;
  }
  const fallbackLetter = profile?.fullName?.charAt(0)?.toUpperCase() || "U";
  const isValidAvatar =
    avatarUrl &&
    typeof avatarUrl === "string" &&
    !imageError &&
    (avatarUrl.startsWith("http") || avatarUrl.startsWith("blob:"));

  // [B2]
  const tier =
    profile?.subscription_tier ?? profile?.subscriptionTier ?? "standard";
  const themeId = profile?.boost_selections?.themeId ?? null;
  const hasBoosted = ["silver", "gold", "diamond"].includes(tier);
  const tierColor = getGreetingColor(profile);

  // ── Badge ────────────────────────────────────────────────────────────────
  const syncBadge = useCallback(() => {
    setBadgeCount(notificationService.getHeaderBadgeCountSync());
  }, []);

  useEffect(() => {
    if (!userId) return;
    notificationService
      .getHeaderBadgeCount(userId)
      .then(setBadgeCount)
      .catch(() => {});
    const unsubNotif = notificationService.subscribe(syncBadge);
    const unsubConv = conversationState.subscribe(() => {
      setUnreadMessages(conversationState.getTotalUnreadCount());
    });
    setUnreadMessages(conversationState.getTotalUnreadCount());
    onlineStatusService.start(userId);
    return () => {
      unsubNotif();
      unsubConv();
    };
  }, [userId, syncBadge]);

  // ── Typing animation ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const typeText = (text, cb) => {
      setIsTyping(true);
      let i = 0;
      const tick = () => {
        if (cancelled) return;
        setDisplayedText(text.slice(0, i));
        i++;
        if (i <= text.length) typeIntervalRef.current = setTimeout(tick, 80);
        else {
          setIsTyping(false);
          cb?.();
        }
      };
      tick();
    };

    const unTypeText = (text, cb) => {
      setIsTyping(true);
      let i = text.length;
      const tick = () => {
        if (cancelled) return;
        setDisplayedText(text.slice(0, i));
        i--;
        if (i >= 0) typeIntervalRef.current = setTimeout(tick, 45);
        else {
          setIsTyping(false);
          cb?.();
        }
      };
      tick();
    };

    const cycle = () => {
      typeText(greetingText, () => {
        timerRef.current = setTimeout(() => {
          unTypeText(greetingText, () => {
            timerRef.current = setTimeout(cycle, 60_000);
          });
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
      clearTimeout(startDelay);
      clearTimeout(timerRef.current);
      clearTimeout(typeIntervalRef.current);
      clearInterval(greetingInterval);
    };
  }, [greetingText, getGreeting]);

  return (
    <>
      <style>
        {mobileHeaderStyles(isTyping, displayedText, tierColor, hasBoosted)}
      </style>

      <header className="mh-header">
        <div className="mh-content">
          <div className="mh-left">
            {/* [B2] Pass boost props */}
            <AvatarDropdown
              profile={profile}
              userId={userId}
              avatarUrl={avatarUrl}
              fallbackLetter={fallbackLetter}
              isValidAvatar={isValidAvatar}
              imageLoaded={imageLoaded}
              imageError={imageError}
              onImageLoad={() => {
                setImageLoaded(true);
                setImageError(false);
              }}
              onImageError={() => {
                setImageLoaded(false);
                setImageError(true);
              }}
              onOpenAccount={() => setActiveTab("account")}
              onSignOut={onSignOut}
              isMobile={true}
              boostTier={hasBoosted ? tier : null}
              boostThemeId={hasBoosted ? themeId : null}
            />

            {/* [B1] Greeting box */}
            <div className="mh-greeting-box">
              <Clock size={13} className="mh-greeting-icon" />
              <span className="mh-greeting-text">{displayedText}</span>
            </div>
          </div>

          <div className="mh-actions">
            <button
              className="mh-btn trending"
              onClick={() => setShowTrendingModal(true)}
              aria-label="Trending"
            >
              <TrendingUp size={17} />
            </button>
            <button
              className="mh-btn messages"
              onClick={() => {
                if (currentUser?.id || userId) setShowMessages(true);
              }}
              aria-label="Messages"
            >
              <MessageCircle size={17} />
              {unreadMessages > 0 && (
                <span className="mh-badge">
                  {unreadMessages > 99 ? "99+" : unreadMessages}
                </span>
              )}
            </button>
            <button
              className="mh-btn notification"
              onClick={onNotificationClick}
              aria-label="Notifications"
            >
              <Bell size={17} />
              {badgeCount > 0 && (
                <span className="mh-badge">
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}
            </button>
            <button
              className="mh-btn support"
              onClick={onSupportClick}
              aria-label="Support"
            >
              <HeadsetIcon size={17} />
            </button>
          </div>
        </div>
      </header>

      <MobileTrendingModal
        isOpen={showTrendingModal}
        onClose={() => setShowTrendingModal(false)}
        currentUser={currentUser}
      />

      {showMessages && (
        <DMMessagesView
          currentUser={{
            id: userId || currentUser?.id,
            name: currentUser?.name || currentUser?.fullName || "User",
            fullName: currentUser?.fullName || currentUser?.name || "User",
            username: currentUser?.username || profile?.username || "user",
            avatar: avatarUrl || currentUser?.avatar,
            avatarId: profile?.id || currentUser?.avatarId,
            verified: currentUser?.verified || profile?.verified || false,
          }}
          onClose={() => setShowMessages(false)}
        />
      )}
    </>
  );
};

const mobileHeaderStyles = (isTyping, displayedText, tierColor, hasBoosted) => {
  // When boosted use tier color; otherwise use the default green gradient
  const textStyle =
    hasBoosted && tierColor
      ? `color: ${tierColor}; text-shadow: 0 0 10px ${tierColor}60;`
      : `background: linear-gradient(135deg,#84cc16 0%,#65a30d 100%);
       -webkit-background-clip: text; -webkit-text-fill-color: transparent;
       background-clip: text;`;

  const cursorColor = hasBoosted && tierColor ? tierColor : "#84cc16";
  const iconColor = hasBoosted && tierColor ? tierColor : "#84cc16";
  const boxBorder =
    hasBoosted && tierColor ? `${tierColor}25` : "rgba(132,204,22,0.12)";
  const boxBg =
    hasBoosted && tierColor ? `${tierColor}08` : "rgba(255,255,255,0.02)";

  return `
    .mh-header { position: sticky; top: 0; z-index: 100; background: #000; }
    .mh-content { display: flex; align-items: center; justify-content: space-between; padding: 6px 12px; gap: 8px; }
    .mh-left { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }

    .mh-greeting-box {
      display: flex; align-items: center; gap: 5px;
      min-width: 0; min-height: 22px;
      padding: 2px 8px;
      background: ${boxBg};
      border: 1px solid ${boxBorder};
      border-radius: 7px; overflow: hidden;
      transition: background 0.4s, border-color 0.4s;
    }
    .mh-greeting-icon {
      color: ${iconColor}; flex-shrink: 0;
      opacity: ${displayedText ? "1" : "0"};
      transition: opacity 0.3s, color 0.4s;
    }
    .mh-greeting-text {
      font-size: 10px; font-weight: 600;
      ${textStyle}
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      position: relative; letter-spacing: 0.1px;
    }
    .mh-greeting-text::after {
      content: "";
      position: absolute; right: -5px; top: 50%; transform: translateY(-50%);
      width: 1.5px; height: 85%;
      background: ${cursorColor}; border-radius: 1px;
      animation: ${isTyping ? "mhBlink 0.9s ease-in-out infinite" : "none"};
    }
    @keyframes mhBlink { 0%,45%{opacity:1} 50%,95%{opacity:0} 100%{opacity:1} }

    .mh-actions { display: flex; align-items: center; gap: 5px; flex-shrink: 0; }
    .mh-btn {
      position: relative; width: 32px; height: 32px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: all 0.18s;
      border: 1px solid rgba(255,255,255,0.07);
      background: rgba(255,255,255,0.03); color: #666;
    }
    .mh-btn.trending     { border-color: rgba(132,204,22,0.2);  background: rgba(132,204,22,0.04);  color: #84cc16; }
    .mh-btn.messages     { border-color: rgba(163,230,53,0.2);  background: rgba(163,230,53,0.04);  color: #a3e635; }
    .mh-btn.notification { border-color: rgba(132,204,22,0.15); color: #84cc16; }
    .mh-btn.support      { color: #60a5fa; border-color: rgba(96,165,250,0.15); }
    .mh-btn:active       { transform: scale(0.9); }

    .mh-badge {
      position: absolute; top: -5px; right: -5px;
      min-width: 16px; height: 16px; padding: 0 4px;
      border-radius: 8px;
      background: #ef4444; color: #fff;
      font-size: 9px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      border: 2px solid #000;
      animation: mhBadgePulse 2.5s ease-in-out infinite;
    }
    @keyframes mhBadgePulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.14)} }

    @media (max-width: 360px) {
      .mh-greeting-text { font-size: 9px; }
      .mh-content { padding: 6px 10px; }
      .mh-btn { width: 30px; height: 30px; }
    }
  `;
};

export default MobileHeader;
