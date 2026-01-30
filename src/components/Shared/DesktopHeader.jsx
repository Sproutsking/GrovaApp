import React, { useState, useEffect, useRef } from "react";
import { Clock, Bell, HelpCircle } from "lucide-react";
import notificationService from "../../services/notifications/notificationService";

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
  const timerRef = useRef(null);
  const cycleRef = useRef(null);
  const typeIntervalRef = useRef(null);

  // Enhanced avatar URL with quality parameters
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

  // Load notification count
  useEffect(() => {
    if (userId) {
      loadNotificationCount();

      // Poll for new notifications every 30 seconds
      const interval = setInterval(loadNotificationCount, 30000);
      return () => clearInterval(interval);
    }
  }, [userId]);

  const loadNotificationCount = async () => {
    try {
      const count = await notificationService.getUnreadCount(userId);
      setUnreadCount(count);
    } catch (error) {
      console.error("Failed to load notification count:", error);
    }
  };

  useEffect(() => {
    const fullText = `${greetingText}, ${currentUser?.name || "User"}`;

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

    cycleRef.current = startCycle();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (typeIntervalRef.current) clearTimeout(typeIntervalRef.current);
      if (cycleRef.current) cycleRef.current();
    };
  }, [greetingText, currentUser?.name, getGreeting]);

  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
  };

  const handleImageError = (e) => {
    console.error("Desktop header avatar error:", e);
    setImageLoaded(false);
    setImageError(true);
  };

  return (
    <>
      <style>{`
        .desktop-header {
          height: 60px;
          position: sticky;
          top: 0;
          z-index: 100;
          background: rgba(10, 10, 10, 0.98);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(132, 204, 22, 0.2);
        }

        .desktop-header-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 5px 24px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .desktop-left-section {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .desktop-avatar-btn {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: 2.5px solid #84cc16;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          color: #000;
          font-weight: 800;
          font-size: 22px;
          flex-shrink: 0;
          box-shadow: 0 4px 20px rgba(132, 204, 22, 0.5);
          position: relative;
        }

        .desktop-avatar-btn img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          position: absolute;
          top: 0;
          left: 0;
          image-rendering: -webkit-optimize-contrast;
          image-rendering: crisp-edges;
          backface-visibility: hidden;
          transform: translateZ(0);
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          filter: brightness(1.1) contrast(1.15) saturate(1.2) sharpen(1);
          opacity: ${imageLoaded && !imageError ? "1" : "0"};
          transition: opacity 0.4s ease-in-out;
        }

        .desktop-avatar-placeholder {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          color: #000;
          font-weight: 800;
          opacity: ${imageLoaded && !imageError ? "0" : "1"};
          transition: opacity 0.4s ease-in-out;
        }

        .desktop-avatar-btn:hover {
          transform: scale(1.008) translateY(-2px);
        }

        .desktop-avatar-btn:active {
          transform: scale(0.98);
        }

        .desktop-greeting-container {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 5px 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid #4444; 
          border-radius: 14px;
          min-height: 32px;
          min-width: fit-content;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        }

        .desktop-greeting-icon {
          color: #84cc16;
          flex-shrink: 0;
          opacity: ${displayedText ? "1" : "0"};
          transition: opacity 0.4s;
        }

        .desktop-greeting-text {
          font-size: 13px;
          font-weight: 600;
          color: #ffffffad;
          position: relative;
          white-space: nowrap;
          letter-spacing: 0.3px;
        }

        .desktop-greeting-text::after {
          content: '';
          position: absolute;
          right: -8px;
          top: 50%;
          transform: translateY(-50%);
          width: 2px;
          height: 18px;
          background: #84cc16;
          border-radius: 1px;
          animation: ${isTyping ? "smoothBlink 1s ease-in-out infinite" : "none"};
        }

        @keyframes smoothBlink {
          0%, 45% { opacity: 1; }
          50%, 95% { opacity: 0; }
          100% { opacity: 1; }
        }

        .greeting-highlight {
          color: #84cc16;
          font-weight: 700;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .header-action-btn {
          position: relative;
          padding: 10px 16px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
        }

        .header-action-btn.notification {
          color: #84cc16;
        }

        .header-action-btn.support {
          color: #3b82f6;
        }

        .header-action-btn.notification:hover {
          background: rgba(132, 204, 22, 0.15);
          border-color: rgba(132, 204, 22, 0.4);
          transform: translateY(-2px);
        }

        .header-action-btn.support:hover {
          background: rgba(59, 130, 246, 0.15);
          border-color: rgba(59, 130, 246, 0.4);
          transform: translateY(-2px);
        }

        .notification-badge {
          position: absolute;
          top: -6px;
          right: -6px;
          min-width: 20px;
          height: 20px;
          padding: 0 6px;
          border-radius: 10px;
          background: #ef4444;
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid #0a0a0a;
          animation: smoothPulse 2s ease-in-out infinite;
        }

        @keyframes smoothPulse {
          0%, 100% { 
            transform: scale(1); 
            opacity: 1; 
          }
          50% { 
            transform: scale(1.12); 
            opacity: 0.85; 
          }
        }
      `}</style>

      <header className="desktop-header">
        <div className="desktop-header-content">
          <div className="desktop-left-section">
            <button
              className="desktop-avatar-btn"
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
              <div className="desktop-avatar-placeholder">{fallbackLetter}</div>
            </button>

            <div className="desktop-greeting-container">
              <Clock size={18} className="desktop-greeting-icon" />
              <span className="desktop-greeting-text">{displayedText}</span>
            </div>
          </div>

          <div className="header-right">
            <button
              onClick={onNotificationClick}
              className="header-action-btn notification"
            >
              <Bell size={18} />
              <span>Notifications</span>
              {unreadCount > 0 && (
                <span className="notification-badge">{unreadCount}</span>
              )}
            </button>

            <button
              onClick={onSupportClick}
              className="header-action-btn support"
            >
              <HelpCircle size={18} />
              <span>Support</span>
            </button>
          </div>
        </div>
      </header>
    </>
  );
};

export default DesktopHeader;
