// components/Header/DesktopHeader.jsx - WITH MESSAGE TOAST
import React, { useState, useEffect, useRef } from "react";
import { Clock, Bell, HelpCircle, MessageCircle } from "lucide-react";
import notificationService from "../../services/notifications/notificationService";
import conversationState from "../../services/messages/ConversationStateManager";
import onlineStatusService from "../../services/messages/onlineStatusService";
import messageNotificationService from "../../services/messages/MessageNotificationService";
import DMMessagesView from "../Messages/DMMessagesView";
import { useToast } from "../../contexts/ToastContext";

const DesktopHeader = ({
  currentUser,
  getGreeting,
  onNotificationClick,
  onSupportClick,
  setActiveTab,
  profile,
  userId,
}) => {
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [greetingText, setGreetingText] = useState(getGreeting());
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [showMessages, setShowMessages] = useState(false);

  const timerRef = useRef(null);
  const typeIntervalRef = useRef(null);
  const toast = useToast();

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

      // Initialize message notifications
      messageNotificationService.init(userId, toast.showToast);

      const unsubNotif = notificationService.onUpdate(() => {
        setUnreadCount(notificationService.getUnreadCount());
      });

      const unsubConv = conversationState.subscribe(() => {
        const count = conversationState.getTotalUnreadCount();
        setUnreadMessages(count);
      });

      setUnreadCount(notificationService.getUnreadCount());
      setUnreadMessages(conversationState.getTotalUnreadCount());

      return () => {
        unsubNotif();
        unsubConv();
        messageNotificationService.cleanup();
      };
    }
  }, [userId, toast]);

  const handleMessagesClick = () => {
    if (!currentUser?.id && !userId) return;
    setShowMessages(true);
  };

  const handleMessagesClose = () => {
    setShowMessages(false);
  };

  useEffect(() => {
    const fullText = `${greetingText}, ${currentUser?.name || currentUser?.fullName || "User"}`;

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
        typeText(fullText, () => {
          timerRef.current = setTimeout(() => {
            unTypeText(fullText, () => {
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

    const cycleCleanup = startCycle();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (typeIntervalRef.current) clearTimeout(typeIntervalRef.current);
      if (cycleCleanup) cycleCleanup();
    };
  }, [greetingText, currentUser?.name, currentUser?.fullName, getGreeting]);

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
        .desktop-header {
          height: 58px;
          position: sticky;
          top: 0;
          z-index: 100;
          background: rgba(10,10,10,0.98);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(132,204,22,0.2);
        }
        .desktop-header-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 5px 22px;
          max-width: 1400px;
          margin: 0 auto;
        }
        .desktop-left-section {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .desktop-avatar-btn {
          width: 46px;
          height: 46px;
          border-radius: 50%;
          border: 2px solid #84cc16;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          overflow: hidden;
          transition: all 0.2s;
          color: #000;
          font-weight: 800;
          font-size: 20px;
          flex-shrink: 0;
          box-shadow: 0 4px 18px rgba(132,204,22,0.5);
          position: relative;
        }
        .desktop-avatar-btn img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          position: absolute;
          opacity: ${imageLoaded && !imageError ? "1" : "0"};
          transition: opacity 0.3s;
        }
        .desktop-avatar-placeholder {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: ${imageLoaded && !imageError ? "0" : "1"};
          transition: opacity 0.3s;
        }
        .desktop-avatar-btn:hover {
          transform: scale(1.005) translateY(-1px);
        }
        .desktop-avatar-btn:active {
          transform: scale(0.98);
        }
        .desktop-greeting-container {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 10px;
          background: rgba(255,255,255,0.04);
          border: 1px solid #4444;
          border-radius: 12px;
          min-height: 30px;
        }
        .desktop-greeting-icon {
          color: #84cc16;
          flex-shrink: 0;
          opacity: ${displayedText ? "1" : "0"};
          transition: opacity 0.3s;
        }
        .desktop-greeting-text {
          font-size: 12px;
          font-weight: 600;
          color: #ffffffad;
          position: relative;
          white-space: nowrap;
        }
        .desktop-greeting-text::after {
          content: "";
          position: absolute;
          right: -7px;
          top: 50%;
          transform: translateY(-50%);
          width: 2px;
          height: 16px;
          background: #84cc16;
          border-radius: 1px;
          animation: ${isTyping ? "smoothBlink 1s ease-in-out infinite" : "none"};
        }
        @keyframes smoothBlink {
          0%, 45% { opacity: 1; }
          50%, 95% { opacity: 0; }
          100% { opacity: 1; }
        }
        .header-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .header-action-btn {
          position: relative;
          padding: 8px 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 10px;
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .header-action-btn.messages { color: #9cff00; }
        .header-action-btn.notification { color: #84cc16; }
        .header-action-btn.support { color: #3b82f6; }
        .header-action-btn.messages:hover {
          background: rgba(156,255,0,0.15);
          border-color: rgba(156,255,0,0.4);
          transform: translateY(-1px);
        }
        .header-action-btn.notification:hover {
          background: rgba(132,204,22,0.15);
          border-color: rgba(132,204,22,0.4);
          transform: translateY(-1px);
        }
        .header-action-btn.support:hover {
          background: rgba(59,130,246,0.15);
          border-color: rgba(59,130,246,0.4);
          transform: translateY(-1px);
        }
        .notification-badge {
          position: absolute;
          top: -5px;
          right: -5px;
          min-width: 18px;
          height: 18px;
          padding: 0 5px;
          border-radius: 9px;
          background: #ef4444;
          color: #fff;
          font-size: 10px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid #0a0a0a;
          animation: smoothPulse 2s ease-in-out infinite;
        }
        @keyframes smoothPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.85; }
        }
      `}</style>

      <header className="desktop-header">
        <div className="desktop-header-content">
          <div className="desktop-left-section">
            <button
              className="desktop-avatar-btn"
              onClick={() => setActiveTab("account")}
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
              <div className="desktop-avatar-placeholder">{fallbackLetter}</div>
            </button>

            <div className="desktop-greeting-container">
              <Clock size={17} className="desktop-greeting-icon" />
              <span className="desktop-greeting-text">{displayedText}</span>
            </div>
          </div>

          <div className="header-right">
            <button
              onClick={handleMessagesClick}
              className="header-action-btn messages"
            >
              <MessageCircle size={17} />
              <span>Messages</span>
              {unreadMessages > 0 && (
                <span className="notification-badge">
                  {unreadMessages > 99 ? "99+" : unreadMessages}
                </span>
              )}
            </button>

            <button
              onClick={onNotificationClick}
              className="header-action-btn notification"
            >
              <Bell size={17} />
              <span>Notifications</span>
              {unreadCount > 0 && (
                <span className="notification-badge">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            <button
              onClick={onSupportClick}
              className="header-action-btn support"
            >
              <HelpCircle size={17} />
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
          onClose={handleMessagesClose}
        />
      )}
    </>
  );
};

export default DesktopHeader;