import React, { useState, useRef, useEffect } from "react";
import {
  Crown,
  Shield,
  Star,
  CheckCircle,
  MoreVertical,
  Reply,
  Plus,
  X,
  ChevronDown,
} from "lucide-react";

const MessageList = ({
  messages = [],
  loading = false,
  userId,
  messagesEndRef,
  onContextMenu,
  onReactionClick,
  typingUsers = [],
  channelId,
}) => {
  const [hoveredMessage, setHoveredMessage] = useState(null);
  const [reactionPanelOpen, setReactionPanelOpen] = useState(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [lastSeenMessageId, setLastSeenMessageId] = useState(null);

  const messagesContainerRef = useRef(null);
  const reactionPanelRef = useRef(null);

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

  const quickReactions = ["❤️", "👍", "🔥"];

  useEffect(() => {
    const savedMessageId = sessionStorage.getItem(`lastSeen-${channelId}`);

    if (savedMessageId) {
      setLastSeenMessageId(parseInt(savedMessageId));
      const lastSeenIndex = messages.findIndex(
        (m) => m.id === parseInt(savedMessageId),
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
            lastMsg.id.toString(),
          );
        }
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [messages, channelId]);

  const scrollToBottom = () => {
    messagesEndRef?.current?.scrollIntoView({ behavior: "auto" });
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

  const shouldShowAuthor = (currentMsg, prevMsg) => {
    if (!prevMsg) return true;
    if (currentMsg.user_id !== prevMsg.user_id) return true;
    return (
      new Date(currentMsg.created_at) - new Date(prevMsg.created_at) > 240000
    ); // 4 minutes
  };

  const handleReactionClick = (messageId, emoji) => {
    setReactionPanelOpen(null);
    onReactionClick?.(messageId, emoji);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        reactionPanelRef.current &&
        !reactionPanelRef.current.contains(event.target)
      ) {
        setReactionPanelOpen(null);
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

  return (
    <div className="messages-container" ref={messagesContainerRef}>
      {newMessageCount > 0 && (
        <div className="new-messages-divider">
          <span>
            {newMessageCount} new message{newMessageCount > 1 ? "s" : ""}
          </span>
        </div>
      )}

      {messages.map((message, index) => {
        const isOwnMessage = message.user_id === userId;
        const userData = message.user || {};
        const prevMessage = index > 0 ? messages[index - 1] : null;
        const showAuthor = shouldShowAuthor(message, prevMessage);
        const isHovered = hoveredMessage === message.id;
        const isNew = lastSeenMessageId && message.id > lastSeenMessageId;
        const initial = (
          userData.full_name?.[0] ||
          userData.username?.[0] ||
          "?"
        ).toUpperCase();

        return (
          <div
            key={message.id}
            className={`message-wrapper ${!showAuthor ? "consecutive" : ""} ${isOwnMessage ? "own" : ""} ${isNew ? "new-message" : ""}`}
            onMouseEnter={() => setHoveredMessage(message.id)}
            onMouseLeave={() => setHoveredMessage(null)}
            onContextMenu={(e) => onContextMenu?.(e, message)}
          >
            {showAuthor && (
              <div className={`message-avatar ${isOwnMessage ? "own" : ""}`}>
                {userData.avatar_id ? (
                  <img
                    src={userData.avatar_id}
                    alt={userData.full_name}
                    className="avatar-image"
                  />
                ) : (
                  <div className="avatar-fallback">{initial}</div>
                )}
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

            {!showAuthor && <div className="message-spacer"></div>}

            <div
              className={`message-content ${isOwnMessage ? "own" : ""} ${!showAuthor ? "no-author" : ""}`}
            >
              {showAuthor && (
                <div className={`message-header ${isOwnMessage ? "own" : ""}`}>
                  <span className="author-name">
                    {userData.full_name || userData.username || "Unknown"}
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

              <div className={`message-bubble ${isOwnMessage ? "own" : ""}`}>
                <div className="message-text">
                  {message.content}
                  {message.edited && (
                    <span className="edited-badge">(edited)</span>
                  )}
                </div>
              </div>

              {(message.reactions &&
                Object.keys(message.reactions).length > 0) ||
              isHovered ? (
                <div className="message-reactions">
                  {message.reactions &&
                    Object.entries(message.reactions).map(([emoji, data]) => {
                      const count =
                        typeof data === "number" ? data : data.count || 0;
                      const users =
                        typeof data === "object" ? data.users || [] : [];
                      const hasReacted = users.includes(userId);
                      return (
                        <button
                          key={emoji}
                          className={`reaction-bubble ${hasReacted ? "reacted" : ""}`}
                          onClick={() => handleReactionClick(message.id, emoji)}
                        >
                          <span className="reaction-emoji">{emoji}</span>
                          <span className="reaction-count">{count}</span>
                        </button>
                      );
                    })}
                  {isHovered && (
                    <button
                      className="add-reaction-btn"
                      onClick={() =>
                        setReactionPanelOpen(
                          reactionPanelOpen === message.id ? null : message.id,
                        )
                      }
                    >
                      <Plus size={14} strokeWidth={2.5} />
                    </button>
                  )}
                </div>
              ) : null}

              {reactionPanelOpen === message.id && (
                <div
                  ref={reactionPanelRef}
                  className={`reaction-panel ${isOwnMessage ? "own" : ""}`}
                >
                  <div className="reaction-panel-header">
                    <span>React</span>
                    <button
                      className="close-panel"
                      onClick={() => setReactionPanelOpen(null)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="reaction-grid">
                    {allReactions.map((emoji) => (
                      <button
                        key={emoji}
                        className="reaction-option"
                        onClick={() => handleReactionClick(message.id, emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {isHovered && (
                <div className={`quick-actions ${isOwnMessage ? "own" : ""}`}>
                  {quickReactions.map((emoji) => (
                    <button
                      key={emoji}
                      className="quick-reaction"
                      onClick={() => handleReactionClick(message.id, emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                  <button
                    className="quick-action-btn"
                    onClick={() => console.log("Reply")}
                  >
                    <Reply size={16} />
                  </button>
                  <button
                    className="quick-action-btn"
                    onClick={(e) => onContextMenu?.(e, message)}
                  >
                    <MoreVertical size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
      <div ref={messagesEndRef} />

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

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap');

        .messages-container {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 32px 24px 120px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          position: relative;
          z-index: 1;
        }

        .messages-container::-webkit-scrollbar { width: 8px; }
        .messages-container::-webkit-scrollbar-track { background: rgba(156, 255, 0, 0.05); border-radius: 10px; }
        .messages-container::-webkit-scrollbar-thumb { background: linear-gradient(180deg, rgba(156, 255, 0, 0.5), rgba(255, 215, 0, 0.5)); border-radius: 10px; }

        .new-messages-divider {
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 20px 0;
        }

        .new-messages-divider::before,
        .new-messages-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(156, 255, 0, 0.6), transparent);
        }

        .new-messages-divider span {
          padding: 6px 16px;
          background: rgba(156, 255, 0, 0.15);
          border: 1px solid rgba(156, 255, 0, 0.4);
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          color: #9cff00;
          margin: 0 12px;
        }

        .message-wrapper {
          display: flex;
          gap: 12px;
          width: fit-content;
          max-width: 70%;
          margin-bottom: 16px;
          animation: messageSlideIn 0.1s ease-out;
        }

        .message-wrapper.own { margin-left: auto; flex-direction: row-reverse; }
        .message-wrapper.consecutive { margin-bottom: 4px; }
        .message-wrapper.new-message { animation: messageSlideIn 0.1s ease-out; }

        @keyframes messageSlideIn {
          from { opacity: 0; transform: translateY(3px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .message-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: linear-gradient(135deg, #9cff00, #ffd700);
          padding: 2px;
          position: relative;
          flex-shrink: 0;
        }

        .message-spacer {
          width: 44px;
          flex-shrink: 0;
        }

        .avatar-image, .avatar-fallback {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          border: 2px solid #0a0a0a;
        }

        .avatar-fallback {
          background: linear-gradient(135deg, #9cff00, #ffd700);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          color: #0a0a0a;
        }

        .verified-badge {
          position: absolute;
          bottom: -2px;
          right: -2px;
          width: 18px;
          height: 18px;
          background: #9cff00;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #0a0a0a;
          border: 2px solid #0a0a0a;
        }

        .message-content { flex: 1; display: flex; flex-direction: column; gap: 4px; }
        .message-content.own { align-items: flex-end; }
        .message-content.no-author { margin-top: -10px; }

        .message-header {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
        }

        .message-header.own { flex-direction: row-reverse; }

        .author-name {
          font-weight: 700;
          background: linear-gradient(135deg, #fff, #e0e0e0);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .role-badge { display: flex; filter: drop-shadow(0 0 8px currentColor); }
        .verified-inline { color: #9cff00; filter: drop-shadow(0 0 6px rgba(156, 255, 0, 0.6)); }
        .time-separator { color: rgba(255, 255, 255, 0.3); }
        .message-time { color: rgba(255, 255, 255, 0.4); font-family: 'JetBrains Mono', monospace; font-size: 11px; }

        .message-bubble {
          background: rgba(30, 30, 30, 0.8);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(156, 255, 0, 0.15);
          border-radius: 20px;
          padding: 12px 16px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(156, 255, 0, 0.05);
        }

        .message-bubble.own {
          background: rgba(156, 255, 0, 0.15);
          border-color: rgba(156, 255, 0, 0.3);
          box-shadow: 0 4px 20px rgba(156, 255, 0, 0.2);
        }

        .message-text { color: rgba(255, 255, 255, 0.95); font-size: 14.5px; line-height: 1.6; }
        .edited-badge { color: rgba(255, 255, 255, 0.35); font-size: 10px; font-style: italic; margin-left: 6px; }

        .message-reactions {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 6px;
        }

        .message-content.own .message-reactions { justify-content: flex-end; }

        .reaction-bubble {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 6px 10px;
          background: rgba(20, 20, 20, 0.8);
          border: 1.5px solid rgba(156, 255, 0, 0.15);
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .reaction-bubble:hover {
          background: rgba(30, 30, 30, 0.9);
          border-color: rgba(156, 255, 0, 0.4);
          transform: scale(1.1);
        }

        .reaction-bubble.reacted {
          background: rgba(156, 255, 0, 0.2);
          border-color: rgba(156, 255, 0, 0.5);
        }

        .reaction-emoji { font-size: 16px; }
        .reaction-count { font-size: 12px; font-weight: 700; font-family: 'JetBrains Mono', monospace; }

        .add-reaction-btn {
          width: 32px;
          height: 32px;
          border-radius: 16px;
          background: rgba(20, 20, 20, 0.6);
          border: 1.5px solid rgba(156, 255, 0, 0.15);
          color: #9cff00;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }

        .add-reaction-btn:hover {
          background: rgba(156, 255, 0, 0.2);
          transform: scale(1.1) rotate(90deg);
        }

        .reaction-panel {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 0;
          background: rgba(15, 15, 15, 0.98);
          border: 1.5px solid rgba(156, 255, 0, 0.3);
          border-radius: 18px;
          padding: 14px;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.9), 0 0 60px rgba(156, 255, 0, 0.2);
          z-index: 1000;
          min-width: 320px;
          max-width: 360px;
        }

        .reaction-panel.own { right: 0; left: auto; }

        .reaction-panel-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 14px;
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(156, 255, 0, 0.1);
        }

        .close-panel {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.5);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .close-panel:hover { background: rgba(156, 255, 0, 0.1); color: #9cff00; }

        .reaction-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 10px;
          max-height: 280px;
          overflow-y: auto;
        }

        .reaction-option {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          background: transparent;
          border: 1.5px solid transparent;
          font-size: 26px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }

        .reaction-option:hover {
          background: rgba(156, 255, 0, 0.2);
          border-color: rgba(156, 255, 0, 0.4);
          transform: scale(1.2);
        }

        .quick-actions {
          display: flex;
          gap: 4px;
          padding: 6px;
          background: rgba(10, 10, 10, 0.95);
          border: 1.5px solid rgba(156, 255, 0, 0.3);
          border-radius: 24px;
          position: absolute;
          top: -50px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8), 0 0 40px rgba(156, 255, 0, 0.2);
          z-index: 100;
        }

        .quick-actions.own { right: auto; left: 0; }

        .quick-reaction, .quick-action-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: transparent;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }

        .quick-reaction { font-size: 19px; }
        .quick-action-btn { color: #9cff00; }
        .quick-reaction:hover, .quick-action-btn:hover { transform: scale(1.2); }

        .scroll-to-bottom {
          position: fixed;
          bottom: 90px;
          right: 32px;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: rgba(156, 255, 0, 0.9);
          border: 1.5px solid #9cff00;
          color: #0a0a0a;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 24px rgba(156, 255, 0, 0.4);
          z-index: 1000;
        }

        .scroll-to-bottom:hover { transform: scale(1.1); }

        .new-count-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          min-width: 20px;
          padding: 0 6px;
          height: 20px;
          background: #ffd700;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
          color: #0a0a0a;
          border: 2px solid #0a0a0a;
          font-family: 'JetBrains Mono', monospace;
        }

        .typing-indicator {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          margin-top: 8px;
        }

        .typing-dots {
          display: flex;
          gap: 4px;
        }

        .typing-dots span {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #9cff00;
          animation: typingBounce 1.4s infinite ease-in-out;
        }

        .typing-dots span:nth-child(1) { animation-delay: 0s; }
        .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
        .typing-dots span:nth-child(3) { animation-delay: 0.4s; }

        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.6; }
          30% { transform: translateY(-8px); opacity: 1; }
        }

        .typing-text {
          font-size: 13px;
          color: #9cff00;
          font-weight: 500;
        }

        @media (max-width: 768px) {
          .quick-actions { display: none !important; }
          .messages-container { padding: 20px 16px 100px; }
          .message-wrapper { max-width: 85%; }
          .message-avatar { width: 36px; height: 36px; }
          .message-spacer { width: 36px; }
          .reaction-panel { min-width: 280px; max-width: calc(100vw - 32px); }
        }
      `}</style>
    </div>
  );
};

export default MessageList;
