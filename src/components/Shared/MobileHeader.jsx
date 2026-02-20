import React, { useState, useEffect, useRef } from "react";
import {
  Bell,
  HeadsetIcon,
  Clock,
  TrendingUp,
  MessageCircle,
} from "lucide-react";
import { supabase } from "../../services/config/supabase";
import conversationState from "../../services/messages/ConversationStateManager";
import onlineStatusService from "../../services/messages/onlineStatusService";
import MobileTrendingModal from "./MobileTrendingModal";
import DMMessagesView from "../Messages/DMMessagesView";

const MobileHeader = ({
  getGreeting,
  onNotificationClick,
  onSupportClick,
  setActiveTab,
  profile,
  userId,
  currentUser,
}) => {
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [greetingText, setGreetingText] = useState(getGreeting());
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [showTrendingModal, setShowTrendingModal] = useState(false);
  const [showMessages, setShowMessages] = useState(false);

  const timerRef = useRef(null);
  const cycleRef = useRef(null);
  const typeIntervalRef = useRef(null);
  const notificationChannelRef = useRef(null);

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

  useEffect(() => {
    if (userId) {
      onlineStatusService.start(userId);
      loadUnreadCount();
      subscribeToNotifications();

      const unsubConv = conversationState.subscribe(() => {
        setUnreadMessages(conversationState.getTotalUnreadCount());
      });

      setUnreadMessages(conversationState.getTotalUnreadCount());

      return () => {
        unsubConv();
        if (notificationChannelRef.current) {
          supabase.removeChannel(notificationChannelRef.current);
          notificationChannelRef.current = null;
        }
      };
    }
  }, [userId]);

  const loadUnreadCount = async () => {
    if (!userId) return;

    try {
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("recipient_user_id", userId)
        .eq("is_read", false);

      if (!error) {
        setUnreadCount(count || 0);
      }
    } catch (error) {
      console.error("Failed to load unread count:", error);
    }
  };

  const subscribeToNotifications = () => {
    if (!userId || notificationChannelRef.current) return;

    const channel = supabase
      .channel(`notification-count-mobile:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_user_id=eq.${userId}`,
        },
        () => {
          loadUnreadCount();
        },
      )
      .subscribe();

    notificationChannelRef.current = channel;
  };

  const handleMessagesClick = () => {
    if (!currentUser?.id && !userId) return;
    setShowMessages(true);
  };

  const handleMessagesClose = () => {
    setShowMessages(false);
  };

  useEffect(() => {
    const typeText = (text, callback) => {
      setIsTyping(true);
      let index = 0;

      const performTyping = () => {
        if (index <= text.length) {
          setDisplayedText(text.slice(0, index));
          index++;
          typeIntervalRef.current = setTimeout(performTyping, 100);
        } else {
          setIsTyping(false);
          if (callback) callback();
        }
      };

      performTyping();
    };

    const unTypeText = (text, callback) => {
      setIsTyping(true);
      let index = text.length;

      const performUnTyping = () => {
        if (index >= 0) {
          setDisplayedText(text.slice(0, index));
          index--;
          typeIntervalRef.current = setTimeout(performUnTyping, 60);
        } else {
          setIsTyping(false);
          if (callback) callback();
        }
      };

      performUnTyping();
    };

    const startCycle = () => {
      const greetingCheckInterval = setInterval(() => {
        const newGreeting = getGreeting();
        if (newGreeting !== greetingText) {
          setGreetingText(newGreeting);
        }
      }, 60000);

      const initialDelay = setTimeout(() => {
        typeText(greetingText, () => {
          timerRef.current = setTimeout(() => {
            unTypeText(greetingText, () => {
              timerRef.current = setTimeout(() => {
                startCycle();
              }, 60000);
            });
          }, 240000);
        });
      }, 500);

      return () => {
        clearTimeout(initialDelay);
        clearInterval(greetingCheckInterval);
        if (typeIntervalRef.current) {
          clearTimeout(typeIntervalRef.current);
        }
      };
    };

    cycleRef.current = startCycle();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (typeIntervalRef.current) clearTimeout(typeIntervalRef.current);
      if (cycleRef.current) cycleRef.current();
    };
  }, [greetingText, getGreeting]);

  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
  };

  const handleImageError = () => {
    setImageLoaded(false);
    setImageError(true);
  };

  return (
    <>
      <style>{`
        .mobile-header {
          position: sticky;
          top: 0;
          z-index: 100;
          background: #000000;
          border-bottom: 1px solid rgba(132, 204, 22, 0.15);
        }
        .mobile-header-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 12px;
          gap: 8px;
        }
        .mobile-left-section {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
          min-width: 0;
        }
        .mobile-avatar-btn {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          border: 2px solid #84cc16;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          color: #000;
          font-weight: 800;
          font-size: 16px;
          flex-shrink: 0;
          box-shadow: 0 3px 12px rgba(132, 204, 22, 0.4);
          position: relative;
        }
        .mobile-avatar-btn img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          position: absolute;
          top: 0;
          left: 0;
          opacity: ${imageLoaded && !imageError ? "1" : "0"};
          transition: opacity 0.4s;
        }
        .mobile-avatar-placeholder {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          color: #000;
          font-weight: 800;
          opacity: ${imageLoaded && !imageError ? "0" : "1"};
          transition: opacity 0.4s;
        }
        .mobile-avatar-btn:active {
          transform: scale(0.94);
        }
        .mobile-greeting-container {
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
          min-height: 24px;
          padding: 2px 8px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(132, 204, 22, 0.15);
          border-radius: 8px;
        }
        .mobile-greeting-icon {
          color: #84cc16;
          flex-shrink: 0;
          opacity: ${displayedText ? "1" : "0"};
          transition: opacity 0.4s;
        }
        .mobile-greeting-text {
          font-size: 10px;
          font-weight: 600;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          position: relative;
          letter-spacing: 0.2px;
        }
        .mobile-greeting-text::after {
          content: "";
          position: absolute;
          right: -5px;
          top: 50%;
          transform: translateY(-50%);
          width: 1.5px;
          height: 85%;
          background: #84cc16;
          border-radius: 1px;
          animation: ${isTyping ? "smoothBlink 1s ease-in-out infinite" : "none"};
        }
        @keyframes smoothBlink {
          0%, 45% { opacity: 1; }
          50%, 95% { opacity: 0; }
          100% { opacity: 1; }
        }
        .mobile-actions {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }
        .mobile-action-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s;
          position: relative;
          color: #696969;
        }
        .mobile-action-btn.trending {
          background: linear-gradient(135deg, rgba(132, 204, 22, 0.05), rgba(132, 204, 22, 0.08));
          border-color: rgba(132, 204, 22, 0.2);
        }
        .mobile-action-btn.messages {
          background: linear-gradient(135deg, rgba(156, 255, 0, 0.05), rgba(156, 255, 0, 0.08));
          border-color: rgba(156, 255, 0, 0.2);
        }
        .mobile-action-btn.trending:hover {
          background: linear-gradient(135deg, rgba(132, 204, 22, 0.15), rgba(132, 204, 22, 0.12));
          border-color: rgba(132, 204, 22, 0.4);
          color: #84cc16;
        }
        .mobile-action-btn.messages:hover {
          background: linear-gradient(135deg, rgba(156, 255, 0, 0.15), rgba(156, 255, 0, 0.12));
          border-color: rgba(156, 255, 0, 0.4);
          color: #9cff00;
        }
        .mobile-action-btn.notification:hover {
          background: rgba(132, 204, 22, 0.12);
          border-color: rgba(132, 204, 22, 0.3);
        }
        .mobile-action-btn.support:hover {
          background: rgba(59, 130, 246, 0.12);
          border-color: rgba(59, 130, 246, 0.3);
        }
        .mobile-action-btn:active {
          transform: scale(0.92);
        }
        .mobile-notification-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          min-width: 16px;
          height: 16px;
          padding: 0 4px;
          border-radius: 8px;
          background: #ef4444;
          color: #fff;
          font-size: 9px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid #000000;
          animation: smoothPulse 2s ease-in-out infinite;
        }
        @keyframes smoothPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.12); opacity: 0.85; }
        }
        @media (max-width: 360px) {
          .mobile-greeting-text { font-size: 9px; }
          .mobile-header-content { padding: 6px 10px; }
          .mobile-greeting-icon { width: 13px; height: 13px; }
        }
      `}</style>

      <header className="mobile-header">
        <div className="mobile-header-content">
          <div className="mobile-left-section">
            <button
              className="mobile-avatar-btn"
              onClick={() => setActiveTab("account")}
              aria-label="Open account"
            >
              {isValidAvatar && (
                <img
                  src={avatarUrl}
                  alt="Profile"
                  onLoad={handleImageLoad}
                  onError={handleImageError}
                  crossOrigin="anonymous"
                />
              )}
              <div className="mobile-avatar-placeholder">{fallbackLetter}</div>
            </button>

            <div className="mobile-greeting-container">
              <Clock size={14} className="mobile-greeting-icon" />
              <span className="mobile-greeting-text">{displayedText}</span>
            </div>
          </div>

          <div className="mobile-actions">
            <button
              className="mobile-action-btn trending"
              onClick={() => setShowTrendingModal(true)}
              aria-label="Trending"
            >
              <TrendingUp size={18} />
            </button>

            <button
              className="mobile-action-btn messages"
              onClick={handleMessagesClick}
              aria-label="Messages"
            >
              <MessageCircle size={18} />
              {unreadMessages > 0 && (
                <span className="mobile-notification-badge">
                  {unreadMessages > 99 ? "99+" : unreadMessages}
                </span>
              )}
            </button>

            <button
              className="mobile-action-btn notification"
              onClick={onNotificationClick}
              aria-label="Notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="mobile-notification-badge">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            <button
              className="mobile-action-btn support"
              onClick={onSupportClick}
              aria-label="Support"
            >
              <HeadsetIcon size={18} />
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
          onClose={handleMessagesClose}
        />
      )}
    </>
  );
};

export default MobileHeader;
