// ============================================================================
// src/components/Header/DesktopHeader.jsx — Updated
// Avatar now opens a dropdown with Account + Logout options.
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Clock, Bell, HelpCircle, MessageCircle } from "lucide-react";
import notificationService from "../../services/notifications/notificationService";
import conversationState from "../../services/messages/ConversationStateManager";
import onlineStatusService from "../../services/messages/onlineStatusService";
import DMMessagesView from "../Messages/DMMessagesView";
import AvatarDropdown from "../Shared/AvatarDropdown";

// ============================================================================
// DesktopHeader — v3
// ============================================================================

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
}) => {
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping,      setIsTyping]      = useState(false);
  const [greetingText,  setGreetingText]  = useState(getGreeting());
  const [imageLoaded,   setImageLoaded]   = useState(false);
  const [imageError,    setImageError]    = useState(false);
  const [badgeCount,    setBadgeCount]    = useState(
    () => notificationService.getHeaderBadgeCountSync()
  );
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [showMessages,   setShowMessages]   = useState(false);

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
    const fullText = `${greetingText}, ${currentUser?.name || currentUser?.fullName || "User"}`;
    let cancelled  = false;

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

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <>
      <style>{desktopHeaderStyles(isTyping, displayedText)}</style>

      <header className="dh-header">
        <div className="dh-content">
          {/* Left: avatar dropdown + greeting */}
          <div className="dh-left">
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
              isMobile={false}
            />

            <div className="dh-greeting-box">
              <Clock size={15} className="dh-greeting-icon" />
              <span className="dh-greeting-text">{displayedText}</span>
            </div>
          </div>

          {/* Right: action buttons */}
          <div className="dh-right">
            <button
              className="dh-action-btn messages"
              onClick={() => { if (currentUser?.id || userId) setShowMessages(true); }}
              aria-label="Messages"
            >
              <MessageCircle size={16} />
              <span>Messages</span>
              {unreadMessages > 0 && (
                <span className="dh-badge">
                  {unreadMessages > 99 ? "99+" : unreadMessages}
                </span>
              )}
            </button>

            <button
              className="dh-action-btn notification"
              onClick={onNotificationClick}
              aria-label="Notifications"
            >
              <Bell size={16} />
              <span>Notifications</span>
              {badgeCount > 0 && (
                <span className="dh-badge">
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}
            </button>

            <button
              className="dh-action-btn support"
              onClick={onSupportClick}
              aria-label="Support"
            >
              <HelpCircle size={16} />
              <span>Support</span>
            </button>
          </div>
        </div>
      </header>

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
const desktopHeaderStyles = (isTyping, displayedText) => `
  .dh-header {
    height: 58px;
    position: sticky; top: 0; z-index: 100;
    background: rgba(10,10,10,0.98);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(132,204,22,0.15);
  }
  .dh-content {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 22px; height: 100%;
    max-width: 1400px; margin: 0 auto;
  }
  .dh-left  { display: flex; align-items: center; gap: 12px; }
  .dh-right { display: flex; align-items: center; gap: 8px;  }

  /* Greeting */
  .dh-greeting-box {
    display: flex; align-items: center; gap: 7px;
    padding: 4px 11px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 10px;
    min-height: 30px; min-width: 40px;
  }
  .dh-greeting-icon {
    color: #84cc16; flex-shrink: 0;
    opacity: ${displayedText ? "1" : "0"};
    transition: opacity 0.3s;
  }
  .dh-greeting-text {
    font-size: 12px; font-weight: 600;
    color: rgba(255,255,255,0.65);
    white-space: nowrap; position: relative;
  }
  .dh-greeting-text::after {
    content: "";
    position: absolute; right: -6px; top: 50%; transform: translateY(-50%);
    width: 2px; height: 14px;
    background: #84cc16; border-radius: 1px;
    animation: ${isTyping ? "dhBlink 0.9s ease-in-out infinite" : "none"};
  }
  @keyframes dhBlink {
    0%,45%{opacity:1} 50%,95%{opacity:0} 100%{opacity:1}
  }

  /* Action buttons */
  .dh-action-btn {
    position: relative;
    display: flex; align-items: center; gap: 6px;
    padding: 7px 14px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px;
    font-size: 13px; font-weight: 600;
    cursor: pointer; transition: all 0.18s;
    white-space: nowrap;
  }
  .dh-action-btn.messages    { color: #a3e635; }
  .dh-action-btn.notification{ color: #84cc16; }
  .dh-action-btn.support     { color: #60a5fa; }
  .dh-action-btn.messages:hover     { background: rgba(163,230,53,0.1); border-color: rgba(163,230,53,0.3); transform: translateY(-1px); }
  .dh-action-btn.notification:hover { background: rgba(132,204,22,0.1); border-color: rgba(132,204,22,0.3); transform: translateY(-1px); }
  .dh-action-btn.support:hover      { background: rgba(96,165,250,0.1); border-color: rgba(96,165,250,0.3); transform: translateY(-1px); }

  /* Badge */
  .dh-badge {
    position: absolute; top: -6px; right: -6px;
    min-width: 18px; height: 18px; padding: 0 5px;
    border-radius: 9px;
    background: #ef4444; color: #fff;
    font-size: 10px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    border: 2px solid #0a0a0a;
    animation: dhBadgePulse 2.5s ease-in-out infinite;
  }
  @keyframes dhBadgePulse {
    0%,100%{transform:scale(1)} 50%{transform:scale(1.12)}
  }
`;

export default DesktopHeader;