// components/Community/components/MessageList.jsx - 0.5PX SHIFT UP ⚡
import React from "react";
import mediaUrlService from "../../../services/shared/mediaUrlService";

const MessageList = ({
  messages,
  pendingMessages,
  loading,
  userId,
  currentUser,
  messagesEndRef,
  onContextMenu,
  onReactionClick,
}) => {
  const formatTime = (d) => {
    if (!d) return "";
    const date = new Date(d);
    const h = date.getHours() % 12 || 12;
    const m = date.getMinutes().toString().padStart(2, "0");
    return `${h}:${m} ${date.getHours() >= 12 ? "PM" : "AM"}`;
  };

  const getAvatar = (user) => {
    if (!user) return null;
    
    if (user.avatar_id) {
      const url = mediaUrlService.getAvatarUrl(user.avatar_id, 200);
      console.log(`🖼️ Avatar URL for ${user.full_name}:`, url);
      return url;
    }
    
    return null;
  };

  const getInitial = (user) => {
    if (!user) return "?";
    return (user.full_name || user.username || "?").charAt(0).toUpperCase();
  };

  const allMessages = [...messages, ...pendingMessages];

  return (
    <div className="msg-list-wrapper">
      {loading && (
        <div className="msg-loading">
          <div className="msg-spinner" />
        </div>
      )}

      {!loading &&
        allMessages.map((msg, idx) => {
          const isMe = msg.user_id === userId;
          const prev = allMessages[idx - 1];
          
          // Show tail on first message in a cluster (for both "me" and "them")
          const showTail = !prev || prev.user_id !== msg.user_id;
          const showAvatar = !isMe && showTail;
          
          const avatarUrl = getAvatar(msg.user);
          const initial = getInitial(msg.user);

          return (
            <div
              key={msg.id || msg.tempId || msg._tempId}
              className={`msg-item ${isMe ? "me" : "them"} ${msg._optimistic ? "optimistic" : ""} ${msg._failed ? "failed" : ""}`}
              onContextMenu={(e) => onContextMenu?.(e, msg)}
            >
              {showAvatar && (
                <div className="msg-avatar">
                  {avatarUrl ? (
                    <img 
                      src={avatarUrl} 
                      alt={msg.user?.full_name || "User"} 
                      onError={(e) => {
                        console.error("Avatar load error:", e);
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div 
                    className="msg-avatar-fallback"
                    style={{ display: avatarUrl ? 'none' : 'flex' }}
                  >
                    {initial}
                  </div>
                </div>
              )}
              {!showAvatar && !isMe && <div className="msg-avatar-spacer" />}

              <div className={`msg-bubble ${isMe ? "me" : "them"} ${showTail ? 'has-tail' : ''}`}>
                {!isMe && showAvatar && (
                  <div className="msg-user-name">
                    {msg.user?.full_name || msg.user?.username || "Unknown"}
                  </div>
                )}
                <div className="msg-content">{msg.content}</div>
                <div className="msg-meta">
                  <span className="msg-time">{formatTime(msg.created_at)}</span>
                  {msg.edited && <span className="msg-edited">(edited)</span>}
                </div>

                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                  <div className="msg-reactions">
                    {Object.entries(msg.reactions).map(([emoji, data]) => (
                      <button
                        key={emoji}
                        className={`reaction-btn ${data.users?.includes(userId) ? "reacted" : ""}`}
                        onClick={() => onReactionClick?.(msg.id, emoji)}
                      >
                        {emoji} {data.count}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

      <div ref={messagesEndRef} />

      <style>{`
        .msg-list-wrapper {
          position: relative;
          z-index: 1;
          padding: 8px 12px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .msg-loading {
          display: flex;
          justify-content: center;
          padding: 20px;
        }

        .msg-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid var(--accent-glow);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .msg-item {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          animation: slideIn 0.2s ease-out;
        }

        .msg-item.me {
          flex-direction: row-reverse;
        }

        .msg-item.optimistic {
          opacity: 0.7;
        }

        .msg-item.failed {
          opacity: 0.5;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .msg-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 2px solid var(--accent-border);
          overflow: hidden;
          flex-shrink: 0;
          position: relative;
          box-shadow: 0 2px 8px var(--shadow);
        }

        .msg-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .msg-avatar-fallback {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, var(--surface-elevated), var(--surface));
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 700;
          color: var(--accent);
        }

        .msg-avatar-spacer {
          width: 36px;
          flex-shrink: 0;
        }

        .msg-bubble {
          max-width: 70%;
          padding: 8px 12px;
          border-radius: 16px;
          backdrop-filter: blur(10px);
          position: relative;
        }

        /* Base bubble styles WITHOUT tails */
        .msg-bubble.them {
          background: var(--surface-elevated);
          border: 1px solid var(--surface-border);
          border-bottom-left-radius: 4px;
        }

        /* "me" bubble for better blending */
        .msg-bubble.me {
          background: linear-gradient(
            135deg,
            var(--accent-bg-soft),
            rgba(255,255,255,0.04)
          );
          border: 1px solid var(--accent-border);
          border-bottom-right-radius: 4px;
        }

        .msg-bubble.them.has-tail {
          border-bottom-left-radius: 3px;
        }

        .msg-bubble.them.has-tail::before {
          content: '';
          position: absolute;
          bottom: -1px;
          left: -7px;
          width: 0;
          height: 0;
          border-style: solid;
          border-width: 0 0 10px 8px;
          border-color: transparent transparent var(--surface-elevated) transparent;
        }

        .msg-bubble.them.has-tail::after {
          content: '';
          position: absolute;
          bottom: -1px;
          left: -8px;
          width: 0;
          height: 0;
          border-style: solid;
          border-width: 0 0 11px 9px;
          border-color: transparent transparent var(--surface-border) transparent;
          z-index: -1;
        }

        .msg-bubble.me.has-tail {
          border-bottom-right-radius: 3px;
        }

        .msg-bubble.me.has-tail::before {
          content: '';
          position: absolute;
          bottom: -0.5px;
          right: -7.5px;
          width: 0;
          height: 0;
          border-style: solid;
          border-width: 0 0 10px 8px;
          border-color: transparent transparent var(--accent-bg-soft) transparent;
          transform: scaleX(-1);
        }

        .msg-bubble.me.has-tail::after {
          content: '';
          position: absolute;
          bottom: -0.5px;
          right: -8.5px;
          width: 0;
          height: 0;
          border-style: solid;
          border-width: 0 0 11px 9px;
          border-color: transparent transparent var(--accent-border) transparent;
          z-index: -1;
          transform: scaleX(-1);
        }

        .msg-user-name {
          font-size: 12px;
          font-weight: 700;
          color: var(--accent);
          margin-bottom: 3px;
        }

        .msg-content {
          font-size: 14px;
          color: var(--text);
          line-height: 1.5;
          word-break: break-word;
        }

        .msg-meta {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: 3px;
        }

        .msg-time {
          font-size: 10px;
          color: var(--text-muted);
        }

        .msg-edited {
          font-size: 10px;
          color: var(--text-secondary);
          font-style: italic;
        }

        .msg-reactions {
          display: flex;
          gap: 4px;
          margin-top: 4px;
          flex-wrap: wrap;
        }

        .reaction-btn {
          padding: 2px 6px;
          background: var(--surface);
          border: 1px solid var(--surface-border);
          border-radius: 12px;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.2s;
          color: var(--text-secondary);
        }

        .reaction-btn:hover {
          background: var(--accent-bg-soft);
          border-color: var(--accent-border);
          color: var(--accent);
        }

        .reaction-btn.reacted {
          background: var(--accent-bg-soft);
          border-color: var(--accent-border-strong);
          color: var(--accent);
        }

        @media (max-width: 768px) {
          .msg-avatar {
            width: 40px;
            height: 40px;
          }

          .msg-avatar-spacer {
            width: 40px;
          }

          .msg-avatar-fallback {
            font-size: 14px;
          }

          .msg-bubble {
            max-width: 80%;
            padding: 7px 11px;
            border-radius: 14px;
          }

          .msg-user-name {
            font-size: 11px;
          }

          .msg-content {
            font-size: 13px;
          }

          .msg-bubble.them.has-tail::before {
            border-width: 0 0 9px 7px;
            left: -6px;
          }

          .msg-bubble.them.has-tail::after {
            border-width: 0 0 10px 8px;
            left: -7px;
          }

          .msg-bubble.me.has-tail::before {
            border-width: 0 0 9px 7px;
            bottom: -0.5px;
            right: -6.5px;
          }

          .msg-bubble.me.has-tail::after {
            border-width: 0 0 10px 8px;
            bottom: -0.5px;
            right: -7.5px;
          }
        }
      `}</style>
    </div>
  );
};

export default MessageList;