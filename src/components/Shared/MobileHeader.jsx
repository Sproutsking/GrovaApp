// ============================================================================
// src/components/Header/MobileHeader.jsx — Updated
// Avatar now opens a dropdown with Account + Logout options.
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Bell, HeadsetIcon, Clock, TrendingUp, MessageCircle } from "lucide-react";
import notificationService from "../../services/notifications/notificationService";
import conversationState from "../../services/messages/ConversationStateManager";
import onlineStatusService from "../../services/messages/onlineStatusService";
import MobileTrendingModal from "./MobileTrendingModal";
import DMMessagesView from "../Messages/DMMessagesView";
import AvatarDropdown from "../Shared/AvatarDropdown";

// ============================================================================
// MobileHeader — v3
// ============================================================================

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
  const [displayedText,     setDisplayedText]     = useState("");
  const [isTyping,          setIsTyping]           = useState(false);
  const [greetingText,      setGreetingText]       = useState(getGreeting?.() || "Good Morning");
  const [imageLoaded,       setImageLoaded]        = useState(false);
  const [imageError,        setImageError]         = useState(false);
  const [badgeCount,        setBadgeCount]         = useState(
    () => notificationService.getHeaderBadgeCountSync()
  );
  const [unreadMessages,    setUnreadMessages]     = useState(0);
  const [showTrendingModal, setShowTrendingModal]  = useState(false);
  const [showMessages,      setShowMessages]       = useState(false);

  const timerRef        = useRef(null);
  const typeIntervalRef = useRef(null);

  // ── Avatar ─────────────────────────────────────────────────────────────
  let avatarUrl = profile?.avatar;
  if (avatarUrl && typeof avatarUrl === "string") {
    const cleanUrl = avatarUrl.split("?")[0];
    if (cleanUrl.includes("supabase")) {
      avatarUrl = `${cleanUrl}?quality=100&width=400&height=400&resize=cover&format=webp`;
    }
  }
  const fallbackLetter = profile?.fullName?.charAt(0)?.toUpperCase() || "U";
  const isValidAvatar =
    avatarUrl &&
    typeof avatarUrl === "string" &&
    !imageError &&
    (avatarUrl.startsWith("http") || avatarUrl.startsWith("blob:"));

  // ── Badge ───────────────────────────────────────────────────────────────
  const syncBadge = useCallback(() => {
    setBadgeCount(notificationService.getHeaderBadgeCountSync());
  }, []);

  useEffect(() => {
    if (!userId) return;

    notificationService.getHeaderBadgeCount(userId).then(setBadgeCount).catch(() => {});
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

  // ── Typing animation ────────────────────────────────────────────────────
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
        else { setIsTyping(false); cb?.(); }
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
        else { setIsTyping(false); cb?.(); }
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

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <>
      <style>{mobileHeaderStyles(isTyping, displayedText)}</style>

      <header className="mh-header">
        <div className="mh-content">
          {/* Left: avatar dropdown + greeting */}
          <div className="mh-left">
            <AvatarDropdown
              profile={profile}
              userId={userId}
              avatarUrl={avatarUrl}
              fallbackLetter={fallbackLetter}
              isValidAvatar={isValidAvatar}
              imageLoaded={imageLoaded}
              imageError={imageError}
              onImageLoad={() => { setImageLoaded(true); setImageError(false); }}
              onImageError={() => { setImageLoaded(false); setImageError(true); }}
              onOpenAccount={() => setActiveTab("account")}
              onSignOut={onSignOut}
              isMobile={true}
            />

            <div className="mh-greeting-box">
              <Clock size={13} className="mh-greeting-icon" />
              <span className="mh-greeting-text">{displayedText}</span>
            </div>
          </div>

          {/* Right: icon buttons */}
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
              onClick={() => { if (currentUser?.id || userId) setShowMessages(true); }}
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

// ── Styles ────────────────────────────────────────────────────────────────────
const mobileHeaderStyles = (isTyping, displayedText) => `
  .mh-header {
    position: sticky; top: 0; z-index: 100;
    background: #000;
    border-bottom: 1px solid rgba(132,204,22,0.12);
  }
  .mh-content {
    display: flex; align-items: center; justify-content: space-between;
    padding: 6px 12px; gap: 8px;
  }
  .mh-left {
    display: flex; align-items: center; gap: 8px;
    flex: 1; min-width: 0;
  }

  /* Greeting */
  .mh-greeting-box {
    display: flex; align-items: center; gap: 5px;
    min-width: 0; min-height: 22px;
    padding: 2px 8px;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(132,204,22,0.12);
    border-radius: 7px; overflow: hidden;
  }
  .mh-greeting-icon {
    color: #84cc16; flex-shrink: 0;
    opacity: ${displayedText ? "1" : "0"};
    transition: opacity 0.3s;
  }
  .mh-greeting-text {
    font-size: 10px; font-weight: 600;
    background: linear-gradient(135deg,#84cc16 0%,#65a30d 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    position: relative; letter-spacing: 0.1px;
  }
  .mh-greeting-text::after {
    content: "";
    position: absolute; right: -5px; top: 50%; transform: translateY(-50%);
    width: 1.5px; height: 85%;
    background: #84cc16; border-radius: 1px;
    animation: ${isTyping ? "mhBlink 0.9s ease-in-out infinite" : "none"};
  }
  @keyframes mhBlink {
    0%,45%{opacity:1} 50%,95%{opacity:0} 100%{opacity:1}
  }

  /* Action buttons */
  .mh-actions { display: flex; align-items: center; gap: 5px; flex-shrink: 0; }
  .mh-btn {
    position: relative;
    width: 32px; height: 32px; border-radius: 8px;
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

  /* Badge */
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
  @keyframes mhBadgePulse {
    0%,100%{transform:scale(1)} 50%{transform:scale(1.14)}
  }

  @media (max-width: 360px) {
    .mh-greeting-text { font-size: 9px; }
    .mh-content { padding: 6px 10px; }
    .mh-btn { width: 30px; height: 30px; }
  }
`;

export default MobileHeader;