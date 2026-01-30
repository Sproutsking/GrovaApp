import React, { useState, useRef, useEffect } from "react";
import {
  Crown,
  Shield,
  Star,
  CheckCircle,
  Plus,
  Check,
  CheckCheck,
  Clock,
  ChevronDown,
} from "lucide-react";
import UserProfileModal from "../../Modals/UserProfileModal";
import ReactDOM from "react-dom";
import mediaUrlService from "../../../services/shared/mediaUrlService";

const MessageList = ({
  messages = [],
  loading = false,
  userId,
  messagesEndRef,
  onContextMenu,
  onReactionClick,
  typingUsers = [],
  channelId,
  pendingMessages = [],
  currentUser,
  userPermissions = {},
  isOwner = false,
  communityId,
}) => {
  const [hoveredMessage, setHoveredMessage] = useState(null);
  const [reactionPanelOpen, setReactionPanelOpen] = useState(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [lastSeenMessageId, setLastSeenMessageId] = useState(null);
  const [reactionPanelPosition, setReactionPanelPosition] = useState(null);
  const [profilePreview, setProfilePreview] = useState(null);
  const [imageLoadStates, setImageLoadStates] = useState({});

  const messagesContainerRef = useRef(null);
  const reactionPanelRef = useRef(null);

  const topReactions = [
    "❤️",
    "👍",
    "😂",
    "🔥",
    "🎉",
    "💯",
    "😮",
    "😢",
    "🙏",
    "👏",
  ];

  const allReactions = [
    "❤️",
    "🔥",
    "😂",
    "😮",
    "😢",
    "😡",
    "👍",
    "👎",
    "🙏",
    "👏",
    "💯",
    "🎉",
    "😍",
    "🥰",
    "😘",
    "🤗",
    "🤔",
    "😏",
    "😎",
    "🤩",
    "🥳",
    "😇",
    "🤯",
    "🥺",
    "💀",
    "👀",
    "🙌",
    "💪",
    "✨",
    "⚡",
    "🌟",
    "💫",
    "🎯",
    "🎊",
    "🎈",
    "🏆",
    "💝",
    "💖",
    "💗",
    "💓",
    "💕",
    "💞",
  ];

  useEffect(() => {
    const savedMessageId = sessionStorage.getItem(`lastSeen-${channelId}`);
    if (savedMessageId) {
      setLastSeenMessageId(parseInt(savedMessageId));
      const lastSeenIndex = messages.findIndex(
        (m) => m.id === parseInt(savedMessageId)
      );
      if (lastSeenIndex !== -1) {
        setNewMessageCount(messages.length - lastSeenIndex - 1);
      }
    }
    scrollToBottom();
  }, [channelId]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const isAtBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight <
        100;
      setShowScrollButton(!isAtBottom);

      if (isAtBottom) {
        setNewMessageCount(0);
        const lastMsg = messages[messages.length - 1];
        if (lastMsg) {
          setLastSeenMessageId(lastMsg.id);
          sessionStorage.setItem(
            `lastSeen-${channelId}`,
            lastMsg.id.toString()
          );
        }
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [messages, channelId]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      200;
    if (isNearBottom) {
      setTimeout(() => scrollToBottom(), 50);
    }
  }, [messages, pendingMessages]);

  const scrollToBottom = () => {
    messagesEndRef?.current?.scrollIntoView({ behavior: "smooth" });
    setNewMessageCount(0);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    const diffInDays = Math.floor((now - date) / 86400000);

    if (diffInDays === 0) {
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
    }
    if (diffInDays === 1) return "Yesterday";
    if (diffInDays < 7) {
      return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()];
    }
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getRoleBadge = (role) => {
    if (!role || role === "member") return null;
    const badges = {
      owner: { icon: Crown, color: "#9cff00" },
      admin: { icon: Shield, color: "#9cff00" },
      moderator: { icon: Star, color: "#ffd700" },
    };
    const badge = badges[role.toLowerCase()];
    if (!badge) return null;
    const Icon = badge.icon;
    return (
      <div className="role-badge" style={{ color: badge.color }}>
        <Icon size={12} />
      </div>
    );
  };

  const getMessageStatus = (message, isOwnMessage) => {
    if (!isOwnMessage) return null;

    if (message.isPending) {
      return <Clock size={14} className="status-icon pending" />;
    }
    if (message.isSent && !message.isDelivered) {
      return <Check size={14} className="status-icon sent" />;
    }
    if (message.isDelivered) {
      return <CheckCheck size={14} className="status-icon delivered" />;
    }
    return <Check size={14} className="status-icon sent" />;
  };

  const shouldShowAuthor = (currentMsg, prevMsg, allMessages, currentIndex) => {
    if (!prevMsg || currentIndex === 0) return true;
    if (currentMsg.user_id !== prevMsg.user_id) return true;

    const timeDiff =
      new Date(currentMsg.created_at) - new Date(prevMsg.created_at);
    const fourMinutes = 4 * 60 * 1000;

    if (timeDiff > fourMinutes) return true;

    for (let i = currentIndex - 1; i >= 0; i--) {
      const msg = allMessages[i];
      const msgTimeDiff =
        new Date(currentMsg.created_at) - new Date(msg.created_at);

      if (msgTimeDiff > fourMinutes) break;
      if (msg.user_id !== currentMsg.user_id) return true;
    }

    return false;
  };

  const getEnhancedAvatar = (userData, messageId) => {
    const profileData = userData.profiles || userData;

    let avatar = null;
    if (profileData.avatar_id) {
      avatar = mediaUrlService.getAvatarUrl(profileData.avatar_id, 200);
    } else if (userData.avatar) {
      avatar = userData.avatar;
    } else if (profileData.avatar) {
      avatar = profileData.avatar;
    } else {
      const name = userData.full_name || userData.username || "Unknown User";
      avatar = name.charAt(0).toUpperCase();
    }

    if (avatar && typeof avatar === "string" && avatar.length > 1) {
      const cleanUrl = avatar.split("?")[0];
      if (cleanUrl.includes("supabase") || cleanUrl.includes("cloudinary")) {
        const targetSize = 40 * 3;
        avatar = avatar.includes("?")
          ? avatar
          : `${cleanUrl}?quality=100&width=${targetSize}&height=${targetSize}&resize=cover&format=webp`;
      }
    }

    return avatar;
  };

  const handleImageLoad = (messageId) => {
    setImageLoadStates((prev) => ({
      ...prev,
      [messageId]: { loaded: true, error: false },
    }));
  };

  const handleImageError = (messageId) => {
    setImageLoadStates((prev) => ({
      ...prev,
      [messageId]: { loaded: false, error: true },
    }));
  };

  const handleReactionClick = (messageId, emoji) => {
    setReactionPanelOpen(null);
    setReactionPanelPosition(null);
    onReactionClick?.(messageId, emoji);
  };

  const openReactionPanel = (messageId, event) => {
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    const container = messagesContainerRef.current;
    const containerRect = container.getBoundingClientRect();

    const spaceAbove = rect.top - containerRect.top;
    const spaceBelow = containerRect.bottom - rect.bottom;

    const panelHeight = 280;
    const panelWidth = 320;

    let top, left, transformOrigin;

    if (spaceBelow >= panelHeight + 10) {
      top = rect.bottom - containerRect.top + container.scrollTop + 8;
      transformOrigin = "top";
    } else if (spaceAbove >= panelHeight + 10) {
      top = rect.top - containerRect.top + container.scrollTop - panelHeight - 8;
      transformOrigin = "bottom";
    } else {
      if (spaceBelow > spaceAbove) {
        top = rect.bottom - containerRect.top + container.scrollTop + 8;
        transformOrigin = "top";
      } else {
        top =
          rect.top - containerRect.top + container.scrollTop - panelHeight - 8;
        transformOrigin = "bottom";
      }
    }

    // Always position to the right of the button
    left = rect.right - containerRect.left + 8;
    const maxLeft = containerRect.width - panelWidth - 10;
    if (left > maxLeft) left = maxLeft;
    if (left < 10) left = 10;

    setReactionPanelPosition({ top, left, transformOrigin });
    setReactionPanelOpen(messageId);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        reactionPanelRef.current &&
        !reactionPanelRef.current.contains(event.target)
      ) {
        setReactionPanelOpen(null);
        setReactionPanelPosition(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getTypingIndicatorText = () => {
    if (!typingUsers || typingUsers.length === 0) return "";
    if (typingUsers.length === 1) return `${typingUsers[0]} is typing...`;
    if (typingUsers.length === 2)
      return `${typingUsers[0]} and ${typingUsers[1]} are typing...`;
    if (typingUsers.length === 3)
      return `${typingUsers[0]}, ${typingUsers[1]} and ${typingUsers[2]} are typing...`;
    return `${typingUsers[0]}, ${typingUsers[1]}, ${typingUsers[2]} and ${typingUsers.length - 3} others are typing...`;
  };

  const allMessages = [
    ...messages.map((m) => ({
      ...m,
      isPending: false,
      isSent: true,
      isDelivered: true,
    })),
    ...pendingMessages.map((m) => ({
      ...m,
      isPending: true,
      isSent: false,
      isDelivered: false,
    })),
  ];

  const handleProfileClick = (user, event) => {
    if (!user) return;
    event.stopPropagation();
    
    const userData = {
      id: user.id || user.user_id || user.userId,
      user_id: user.id || user.user_id || user.userId,
      userId: user.id || user.user_id || user.userId,
      name: user.full_name || user.name || user.author || user.username || "Unknown User",
      full_name: user.full_name || user.name || user.author || user.username || "Unknown User",
      author: user.full_name || user.name || user.author || user.username || "Unknown User",
      username: user.username || "unknown",
      avatar: user.avatar || user.avatar_id,
      avatar_id: user.avatar_id,
      verified: user.verified || false,
    };

    setProfilePreview({
      user: userData,
    });
  };

  return (
    <div className="messages-container" ref={messagesContainerRef}>
      {newMessageCount > 0 && (
        <div className="new-messages-divider">
          <span>
            {newMessageCount} new message{newMessageCount > 1 ? "s" : ""}
          </span>
        </div>
      )}

      {allMessages.map((message, index) => {
        const isOwnMessage = message.user_id === userId;
        const userData = message.user || {};
        const prevMessage = index > 0 ? allMessages[index - 1] : null;
        const showAuthor = shouldShowAuthor(
          message,
          prevMessage,
          allMessages,
          index
        );
        const isHovered = hoveredMessage === message.id;
        const isNew = lastSeenMessageId && message.id > lastSeenMessageId;

        const enhancedAvatar = getEnhancedAvatar(userData, message.id);
        const imageState = imageLoadStates[message.id] || {
          loaded: false,
          error: false,
        };

        const isValidUrl =
          enhancedAvatar &&
          typeof enhancedAvatar === "string" &&
          enhancedAvatar.length > 1 &&
          !imageState.error &&
          (enhancedAvatar.startsWith("http://") ||
            enhancedAvatar.startsWith("https://") ||
            enhancedAvatar.startsWith("blob:"));

        const initial = (
          userData.full_name?.[0] ||
          userData.username?.[0] ||
          "?"
        ).toUpperCase();

        return (
          <div
            key={message.id || message.tempId}
            className="message-group"
            onMouseEnter={() => setHoveredMessage(message.id)}
            onMouseLeave={() => setHoveredMessage(null)}
            onContextMenu={(e) =>
              !message.isPending && onContextMenu?.(e, message)
            }
            style={{ marginTop: showAuthor ? "16px" : "2px" }}
          >
            <div className="message-row">
              {showAuthor && (
                <div
                  className="message-avatar clickable"
                  onClick={(e) => handleProfileClick(userData, e)}
                >
                  {isValidUrl && (
                    <img
                      src={enhancedAvatar}
                      alt={userData.full_name || userData.username}
                      className="avatar-image"
                      loading="eager"
                      decoding="async"
                      onLoad={() => handleImageLoad(message.id)}
                      onError={() => handleImageError(message.id)}
                      crossOrigin="anonymous"
                    />
                  )}
                  <div
                    className="avatar-fallback"
                    style={{
                      opacity:
                        isValidUrl && imageState.loaded && !imageState.error
                          ? 0
                          : 1,
                    }}
                  >
                    {typeof enhancedAvatar === "string" &&
                    enhancedAvatar.length === 1
                      ? enhancedAvatar
                      : initial}
                  </div>
                  {userData.verified && (
                    <div className="verified-badge">
                      <CheckCircle
                        size={10}
                        fill="currentColor"
                        strokeWidth={0}
                      />
                    </div>
                  )}
                </div>
              )}

              {!showAuthor && (
                <div className="avatar-spacer"></div>
              )}

              <div className="message-content-wrapper">
                {showAuthor && (
                  <div className="message-header">
                    <span
                      className="author-name clickable"
                      onClick={(e) => handleProfileClick(userData, e)}
                    >
                      {userData.full_name ||
                        userData.username ||
                        "Unknown User"}
                    </span>
                    {message.role && getRoleBadge(message.role)}
                    {userData.verified && (
                      <CheckCircle
                        size={12}
                        fill="currentColor"
                        strokeWidth={0}
                        className="verified-inline"
                      />
                    )}
                    <span className="time-separator">•</span>
                    <span className="message-time">
                      {formatTime(message.created_at)}
                    </span>
                  </div>
                )}

                <div className="message-bubble-row">
                  <div
                    className={`message-bubble ${message.isPending ? "pending" : ""}`}
                  >
                    <div className="message-text">{message.content}</div>
                    {message.edited && (
                      <span className="edited-badge">(edited)</span>
                    )}
                    {getMessageStatus(message, isOwnMessage)}
                  </div>

                  {isHovered && !message.isPending && (
                    <button
                      className="plus-reaction-btn"
                      onClick={(e) => openReactionPanel(message.id, e)}
                    >
                      <Plus size={16} strokeWidth={2.5} />
                    </button>
                  )}
                </div>

                {message.reactions &&
                  Object.keys(message.reactions).length > 0 && (
                    <div className="message-reactions">
                      {Object.entries(message.reactions).map(
                        ([emoji, data]) => {
                          const count =
                            typeof data === "number" ? data : data.count || 0;
                          const users =
                            typeof data === "object" ? data.users || [] : [];
                          const hasReacted = users.includes(userId);
                          return (
                            <button
                              key={emoji}
                              className={`reaction-bubble ${hasReacted ? "reacted" : ""}`}
                              onClick={() =>
                                handleReactionClick(message.id, emoji)
                              }
                            >
                              <span className="reaction-emoji">{emoji}</span>
                              <span className="reaction-count">{count}</span>
                            </button>
                          );
                        }
                      )}
                    </div>
                  )}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={messagesEndRef} />

      {reactionPanelOpen && reactionPanelPosition && (
        <div
          ref={reactionPanelRef}
          className="reaction-panel"
          style={{
            top: `${reactionPanelPosition.top}px`,
            left: `${reactionPanelPosition.left}px`,
            transformOrigin: reactionPanelPosition.transformOrigin,
          }}
        >
          <div className="reaction-grid">
            {allReactions.map((emoji) => (
              <button
                key={emoji}
                className="reaction-option"
                onClick={() => handleReactionClick(reactionPanelOpen, emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {typingUsers && typingUsers.length > 0 && (
        <div className="typing-indicator">
          <div className="typing-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <span className="typing-text">{getTypingIndicatorText()}</span>
        </div>
      )}

      {showScrollButton && (
        <button className="scroll-to-bottom" onClick={scrollToBottom}>
          <ChevronDown size={20} />
          {newMessageCount > 0 && (
            <span className="new-count-badge">{newMessageCount}</span>
          )}
        </button>
      )}

      {profilePreview &&
        ReactDOM.createPortal(
          <UserProfileModal
            user={profilePreview.user}
            currentUser={currentUser}
            onClose={() => setProfilePreview(null)}
          />,
          document.body
        )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap');

        .messages-container {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 20px 12px 120px;
          display: flex;
          flex-direction: column;
          position: relative;
          z-index: 1;
        }

        .messages-container::-webkit-scrollbar { width: 6px; }
        .messages-container::-webkit-scrollbar-track { background: transparent; }
        .messages-container::-webkit-scrollbar-thumb { 
          background: rgba(156, 255, 0, 0.3); 
          border-radius: 10px; 
        }
        .messages-container::-webkit-scrollbar-thumb:hover { 
          background: rgba(156, 255, 0, 0.5); 
        }

        .new-messages-divider {
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 20px 0;
          position: relative;
        }

        .new-messages-divider::before,
        .new-messages-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(156, 255, 0, 0.5), transparent);
        }

        .new-messages-divider span {
          padding: 4px 14px;
          background: rgba(156, 255, 0, 0.1);
          border: 1px solid rgba(156, 255, 0, 0.3);
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          color: #9cff00;
          margin: 0 10px;
          font-family: 'JetBrains Mono', monospace;
        }

        .message-group {
          display: flex;
          flex-direction: column;
          animation: messageSlideIn 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes messageSlideIn {
          from { 
            opacity: 0; 
            transform: translateY(8px); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0); 
          }
        }

        .message-row {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          max-width: 75%;
          width: fit-content;
          position: relative;
        }

        .message-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #9cff00, #ffd700);
          padding: 2px;
          position: relative;
          flex-shrink: 0;
          margin-top: 4px;
          overflow: hidden;
        }

        .message-avatar.clickable {
          cursor: pointer;
          transition: transform 0.2s ease;
        }

        .message-avatar.clickable:hover {
          transform: scale(1.08);
        }

        .avatar-spacer {
          width: 40px;
          flex-shrink: 0;
        }

        .avatar-image {
          width: 100%;
          height: 100%;
          border-radius: 50%;
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
          filter: brightness(1.15) contrast(1.2) saturate(1.25);
          transition: opacity 0.4s ease-in-out;
        }

        .avatar-fallback {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: linear-gradient(135deg, #9cff00, #ffd700);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 15px;
          color: #0a0a0a;
          border: 2px solid #0a0a0a;
          transition: opacity 0.4s ease-in-out;
        }

        .verified-badge {
          position: absolute;
          bottom: -1px;
          right: -1px;
          width: 16px;
          height: 16px;
          background: #9cff00;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #0a0a0a;
          border: 2px solid #0a0a0a;
          z-index: 10;
        }

        .message-content-wrapper {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
          position: relative;
        }

        .message-header {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          margin-bottom: 4px;
          padding: 0 4px;
        }

        .author-name {
          font-weight: 700;
          background: linear-gradient(135deg, #ffffff, #e0e0e0);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          font-size: 14px;
        }

        .author-name.clickable {
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .author-name.clickable:hover {
          filter: brightness(1.2);
          transform: translateY(-1px);
        }

        .role-badge { 
          display: flex; 
          filter: drop-shadow(0 0 6px currentColor); 
        }
        
        .verified-inline { 
          color: #9cff00; 
          filter: drop-shadow(0 0 4px rgba(156, 255, 0, 0.6)); 
        }
        
        .time-separator { 
          color: rgba(255, 255, 255, 0.25); 
          font-size: 12px;
        }
        
        .message-time { 
          color: rgba(255, 255, 255, 0.4); 
          font-family: 'JetBrains Mono', monospace; 
          font-size: 11px; 
        }

        .message-bubble-row {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
        }

        .plus-reaction-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(26, 26, 26, 0.95);
          border: 2px solid rgba(156, 255, 0, 0.3);
          color: #9cff00;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          flex-shrink: 0;
          opacity: 0;
          animation: plusButtonFadeIn 0.2s ease forwards;
          backdrop-filter: blur(10px);
        }

        @keyframes plusButtonFadeIn {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }

        .plus-reaction-btn:hover {
          background: rgba(156, 255, 0, 0.15);
          border-color: rgba(156, 255, 0, 0.6);
          transform: scale(1.1);
          box-shadow: 0 0 20px rgba(156, 255, 0, 0.3);
        }

        .plus-reaction-btn:active {
          transform: scale(0.95);
        }

        .message-bubble {
          background: rgba(26, 26, 26, 0.85);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(156, 255, 0, 0.12);
          border-radius: 18px;
          padding: 11px 15px;
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
          position: relative;
          display: inline-flex;
          align-items: flex-end;
          gap: 8px;
          transition: all 0.2s ease;
          word-wrap: break-word;
          width: fit-content;
          max-width: 100%;
        }

        .message-bubble:hover {
          background: rgba(30, 30, 30, 0.9);
          border-color: rgba(156, 255, 0, 0.2);
        }

        .message-bubble.pending {
          background: rgba(26, 26, 26, 0.6);
          border-style: dashed;
          opacity: 0.7;
        }

        .message-text { 
          color: rgba(255, 255, 255, 0.95); 
          font-size: 14.5px; 
          line-height: 1.5; 
          word-break: break-word;
          flex: 1;
        }
        
        .edited-badge { 
          color: rgba(255, 255, 255, 0.3); 
          font-size: 10px; 
          font-style: italic; 
          margin-left: 4px; 
        }

        .status-icon {
          flex-shrink: 0;
          margin-bottom: 1px;
        }

        .status-icon.pending {
          color: rgba(255, 255, 255, 0.3);
          animation: pulse 1.5s ease-in-out infinite;
        }

        .status-icon.sent {
          color: rgba(156, 255, 0, 0.5);
        }

        .status-icon.delivered {
          color: #9cff00;
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.7; }
        }

        .message-reactions {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          margin-top: 4px;
          padding: 0 4px;
        }

        .reaction-bubble {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 9px;
          background: rgba(20, 20, 20, 0.8);
          border: 1.5px solid rgba(156, 255, 0, 0.12);
          border-radius: 14px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .reaction-bubble:hover {
          background: rgba(26, 26, 26, 0.95);
          border-color: rgba(156, 255, 0, 0.35);
          transform: scale(1.08);
        }

        .reaction-bubble.reacted {
          background: rgba(156, 255, 0, 0.18);
          border-color: rgba(156, 255, 0, 0.45);
        }

        .reaction-emoji { 
          font-size: 15px; 
          line-height: 1;
        }
        
        .reaction-count { 
          font-size: 11px; 
          font-weight: 700; 
          font-family: 'JetBrains Mono', monospace; 
          color: rgba(255, 255, 255, 0.8);
        }

        .reaction-panel {
          position: absolute;
          background: rgba(12, 12, 12, 0.98);
          border: 1.5px solid rgba(156, 255, 0, 0.25);
          border-radius: 16px;
          padding: 12px;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.9), 0 0 60px rgba(156, 255, 0, 0.15);
          z-index: 1000;
          min-width: 300px;
          max-width: 340px;
          max-height: 280px;
          backdrop-filter: blur(20px);
          animation: reactionPanelAppear 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes reactionPanelAppear {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .reaction-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 6px;
          max-height: 260px;
          overflow-y: auto;
        }

        .reaction-grid::-webkit-scrollbar { 
          display: none;
        }

        .reaction-option {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          background: transparent;
          border: 1.5px solid transparent;
          font-size: 24px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .reaction-option:hover {
          background: rgba(156, 255, 0, 0.15);
          border-color: rgba(156, 255, 0, 0.3);
          transform: scale(1.15);
        }

        .scroll-to-bottom {
          position: fixed;
          bottom: 100px;
          right: 28px;
          width: 46px;
          height: 46px;
          border-radius: 50%;
          background: rgba(156, 255, 0, 0.95);
          border: 1.5px solid #9cff00;
          color: #0a0a0a;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 6px 20px rgba(156, 255, 0, 0.4);
          z-index: 1000;
          transition: all 0.2s ease;
        }

        .scroll-to-bottom:hover { 
          transform: scale(1.08); 
          box-shadow: 0 8px 28px rgba(156, 255, 0, 0.5);
        }

        .new-count-badge {
          position: absolute;
          top: -3px;
          right: -3px;
          min-width: 18px;
          padding: 0 5px;
          height: 18px;
          background: #ffd700;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 700;
          color: #0a0a0a;
          border: 2px solid #0a0a0a;
          font-family: 'JetBrains Mono', monospace;
        }

        .typing-indicator {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          margin-top: 12px;
          margin-left: 52px;
          width: fit-content;
        }

        .typing-dots {
          display: flex;
          gap: 3px;
        }

        .typing-dots span {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #9cff00;
          animation: typingBounce 1.4s infinite ease-in-out;
        }

        .typing-dots span:nth-child(1) { animation-delay: 0s; }
        .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
        .typing-dots span:nth-child(3) { animation-delay: 0.4s; }

        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-6px); opacity: 1; }
        }

        .typing-text {
          font-size: 12px;
          color: #9cff00;
          font-weight: 500;
          opacity: 0.8;
        }

        .clickable {
          cursor: pointer;
        }

        @media (max-width: 768px) {
          .messages-container { 
            padding: 16px 8px 100px; 
          }
          .message-row { 
            max-width: 85%; 
          }
          .message-avatar { 
            width: 36px; 
            height: 36px; 
          }
          .avatar-spacer { 
            width: 36px; 
          }
          .reaction-panel { 
            min-width: 260px; 
            max-width: calc(100vw - 32px); 
          }
          .reaction-grid { 
            grid-template-columns: repeat(6, 1fr); 
          }
          .plus-reaction-btn {
            width: 28px;
            height: 28px;
          }
        }
      `}</style>
    </div>
  );
};

export default MessageList;