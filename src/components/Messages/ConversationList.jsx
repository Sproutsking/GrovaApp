import React, { useState, useEffect } from "react";
import { Search, X, MessageCircle, Plus } from "lucide-react";
import onlineStatusService from "../../services/messages/onlineStatusService";
import mediaUrlService from "../../services/shared/mediaUrlService";

const ConversationList = ({
  conversations = [],
  currentUserId,
  onSelect,
  onNewChat,
  onClose,
  loading = false,
  activeConversationId = null,
}) => {
  const [search, setSearch] = useState("");
  const [onlineMap, setOnlineMap] = useState(new Map());

  useEffect(() => {
    const unsubscribe = onlineStatusService.subscribe((userId, status) => {
      setOnlineMap((prev) => {
        const next = new Map(prev);
        next.set(userId, status.online);
        return next;
      });
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const fetchStatuses = async () => {
      for (const conv of conversations) {
        const otherId =
          conv.user1_id === currentUserId ? conv.user2?.id : conv.user1?.id;
        if (otherId && !onlineMap.has(otherId)) {
          onlineStatusService.fetchStatus(otherId);
        }
      }
    };
    fetchStatuses();
  }, [conversations, currentUserId]);

  const filteredConvs = conversations.filter((conv) => {
    if (!search) return true;
    const other = conv.user1_id === currentUserId ? conv.user2 : conv.user1;
    const name = (other?.full_name || "").toLowerCase();
    const username = (other?.username || "").toLowerCase();
    return (
      name.includes(search.toLowerCase()) ||
      username.includes(search.toLowerCase())
    );
  });

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;

    if (diffMs < 60000) return "now";
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m`;
    if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h`;

    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getPreviewText = (conv) => {
    if (!conv.lastMessage) return "Start a conversation";
    const isMe = conv.lastMessage.sender_id === currentUserId;
    const prefix = isMe ? "You: " : "";
    const content = conv.lastMessage.content || "";
    if (conv.lastMessage.media_type)
      return `${prefix}📎 ${conv.lastMessage.media_type}`;
    return `${prefix}${content.slice(0, 60)}`;
  };

  const getAvatarUrl = (user) => {
    if (!user) return null;

    if (
      user.avatar &&
      typeof user.avatar === "string" &&
      user.avatar.startsWith("http")
    ) {
      return user.avatar;
    }

    if (user.avatar_id) {
      return mediaUrlService.getAvatarUrl(user.avatar_id, 200);
    }

    return null;
  };

  const getAvatarContent = (user) => {
    if (!user) return "U";

    const avatarUrl = getAvatarUrl(user);

    if (avatarUrl) {
      return (
        <img
          src={avatarUrl}
          alt={user.full_name || "User"}
          loading="lazy"
          onError={(e) => {
            const parent = e.target.parentElement;
            if (parent) {
              e.target.style.display = "none";
              const span = document.createElement("span");
              span.textContent = (user.full_name || "U")
                .charAt(0)
                .toUpperCase();
              span.className = "avatar-fallback";
              parent.appendChild(span);
            }
          }}
        />
      );
    }

    return (user.full_name || "U").charAt(0).toUpperCase();
  };

  return (
    <div className="conv-list-root">
      <div className="conv-list-header">
        <button
          className="conv-new-btn"
          onClick={onNewChat}
          aria-label="New message"
        >
          <Plus size={18} />
        </button>
        <h2 className="conv-list-title">Messages</h2>
        <button
          className="conv-close-btn"
          onClick={onClose}
          aria-label="Close messages"
        >
          <X size={18} />
        </button>
      </div>

      <div className="conv-search-wrap">
        <Search size={15} color="#555" />
        <input
          type="text"
          className="conv-search-input"
          placeholder="Search conversations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button className="conv-search-clear" onClick={() => setSearch("")}>
            <X size={14} />
          </button>
        )}
      </div>

      <div className="conv-list-body">
        {loading && (
          <div className="conv-loading">
            <div className="conv-spinner"></div>
          </div>
        )}

        {!loading && filteredConvs.length === 0 && (
          <div className="conv-empty">
            <MessageCircle size={40} color="#333" />
            <p>{search ? "No conversations match" : "No messages yet"}</p>
            <span>
              {search ? "Try a different search" : "Tap + to start a new chat"}
            </span>
          </div>
        )}

        {!loading &&
          filteredConvs.map((conv) => {
            const other =
              conv.user1_id === currentUserId ? conv.user2 : conv.user1;
            const isOnline = onlineMap.get(other?.id) || false;
            const isActive = conv.id === activeConversationId;
            const hasUnread = !isActive && conv.unreadCount > 0;
            const previewText = getPreviewText(conv);
            const timeStr = formatTime(
              conv.lastMessage?.created_at || conv.last_message_at,
            );

            return (
              <div
                key={conv.id}
                className={`conv-item ${hasUnread ? "unread" : ""} ${isActive ? "active" : ""}`}
                onClick={() => onSelect(conv)}
              >
                <div className="conv-avatar-wrap">
                  <div className="conv-avatar">{getAvatarContent(other)}</div>
                  <div
                    className={`conv-online-dot ${isOnline ? "online" : "offline"}`}
                  />
                </div>

                <div className="conv-info">
                  <div className="conv-info-top">
                    <span className="conv-name">
                      {other?.full_name || "Unknown"}
                    </span>
                    <span className="conv-time">{timeStr}</span>
                  </div>
                  <div className="conv-info-bottom">
                    <span
                      className={`conv-preview ${hasUnread ? "unread" : ""}`}
                    >
                      {previewText}
                    </span>
                    {hasUnread && (
                      <span className="conv-unread-badge">
                        {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      <style>{`
        .conv-list-root {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #000;
        }

        .conv-list-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 20px 12px;
        }
        .conv-list-title {
          font-size: 22px;
          font-weight: 800;
          color: #fff;
          margin: 0;
          flex: 1;
          text-align: center;
        }
        .conv-new-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(132,204,22,0.15);
          border: 1px solid rgba(132,204,22,0.3);
          color: #84cc16;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .conv-new-btn:hover {
          background: rgba(132,204,22,0.25);
          transform: scale(1.08);
        }

        .conv-close-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #666;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
        }
        .conv-close-btn:hover {
          background: rgba(239, 68, 68, 0.15);
          border-color: rgba(239, 68, 68, 0.3);
          color: #ef4444;
          transform: scale(1.05);
        }

        .conv-search-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0 16px 12px;
          padding: 9px 12px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
        }
        .conv-search-input {
          flex: 1;
          background: transparent;
          border: none;
          color: #fff;
          font-size: 13px;
          outline: none;
        }
        .conv-search-input::placeholder { color: #444; }
        .conv-search-clear {
          background: none;
          border: none;
          color: #555;
          cursor: pointer;
          display: flex;
          align-items: center;
        }
        .conv-search-clear:hover { color: #84cc16; }

        .conv-list-body {
          flex: 1;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(132,204,22,0.2) transparent;
        }
        .conv-list-body::-webkit-scrollbar { width: 4px; }
        .conv-list-body::-webkit-scrollbar-thumb { background: rgba(132,204,22,0.2); border-radius: 2px; }

        .conv-loading {
          display: flex;
          justify-content: center;
          padding: 40px 0;
        }
        .conv-spinner {
          width: 28px;
          height: 28px;
          border: 3px solid rgba(132,204,22,0.2);
          border-top-color: #84cc16;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .conv-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 60px 20px;
          text-align: center;
        }
        .conv-empty p {
          color: #555;
          font-size: 15px;
          font-weight: 600;
          margin: 0;
        }
        .conv-empty span {
          color: #333;
          font-size: 13px;
        }

        .conv-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          cursor: pointer;
          transition: background 0.15s;
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .conv-item:hover {
          background: rgba(255,255,255,0.04);
        }
        .conv-item.unread {
          background: rgba(132,204,22,0.03);
        }
        .conv-item.unread:hover {
          background: rgba(132,204,22,0.07);
        }
        .conv-item.active {
          background: rgba(132,204,22,0.1);
        }

        .conv-avatar-wrap {
          position: relative;
          flex-shrink: 0;
        }
        .conv-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: linear-gradient(135deg, #1a1a1a, #222);
          border: 2px solid rgba(255,255,255,0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          font-weight: 700;
          color: #84cc16;
          overflow: hidden;
          position: relative;
        }
        .conv-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          position: absolute;
          top: 0;
          left: 0;
        }
        .avatar-fallback {
          font-size: 18px;
          font-weight: 700;
          color: #84cc16;
        }
        .conv-online-dot {
          position: absolute;
          bottom: 1px;
          right: 1px;
          width: 13px;
          height: 13px;
          border-radius: 50%;
          border: 2px solid #000;
        }
        .conv-online-dot.online {
          background: #22c55e;
          box-shadow: 0 0 6px rgba(34,197,94,0.5);
        }
        .conv-online-dot.offline {
          background: #444;
        }

        .conv-info {
          flex: 1;
          min-width: 0;
        }
        .conv-info-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 3px;
        }
        .conv-name {
          font-size: 14px;
          font-weight: 700;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .conv-item.unread .conv-name { color: #fff; }

        .conv-time {
          font-size: 11px;
          color: #444;
          flex-shrink: 0;
          margin-left: 8px;
        }
        .conv-item.unread .conv-time { color: #84cc16; }

        .conv-info-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .conv-preview {
          font-size: 13px;
          color: #555;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
          min-width: 0;
        }
        .conv-preview.unread { color: #888; font-weight: 600; }

        .conv-unread-badge {
          flex-shrink: 0;
          min-width: 20px;
          height: 20px;
          padding: 0 6px;
          border-radius: 10px;
          background: #84cc16;
          color: #000;
          font-size: 11px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
        }
      `}</style>
    </div>
  );
};

export default ConversationList;
