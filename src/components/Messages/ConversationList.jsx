// components/Messages/ConversationList.jsx — FIXED: UUID preview bug + full screen
import React, { useState, useEffect } from "react";
import { Search, X, MessageCircle, Plus, ArrowLeft } from "lucide-react";
import conversationState from "../../services/messages/ConversationStateManager";
import onlineStatusService from "../../services/messages/onlineStatusService";
import dmMessageService from "../../services/messages/dmMessageService";
import mediaUrlService from "../../services/shared/mediaUrlService";

const ConversationList = ({
  currentUserId,
  onSelect,
  onNewChat,
  onClose,
  loading,
  activeConversationId,
}) => {
  const [search, setSearch] = useState("");
  const [conversations, setConversations] = useState([]);
  const [statusMap, setStatusMap] = useState(new Map());
  const [typingMap, setTypingMap] = useState(new Map());

  useEffect(() => {
    const updateConversations = () => {
      const convs = conversationState.getConversations();
      setConversations([...convs]);
    };
    const unsub = conversationState.subscribe(updateConversations);
    updateConversations();
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onlineStatusService.subscribe((userId, status) => {
      setStatusMap((prev) => {
        const newMap = new Map(prev);
        newMap.set(userId, status);
        return newMap;
      });
    });
    conversations.forEach((conv) => {
      const otherId = conv.user1_id === currentUserId ? conv.user2?.id : conv.user1?.id;
      if (otherId) onlineStatusService.fetchStatus(otherId);
    });
    return unsub;
  }, [conversations, currentUserId]);

  useEffect(() => {
    const unsubscribers = [];
    conversations.forEach((conv) => {
      const unsub = dmMessageService.subscribeToConversation(conv.id, {
        onTyping: (userId, isTyping, userName) => {
          const otherId = conv.user1_id === currentUserId ? conv.user2?.id : conv.user1?.id;
          if (userId === otherId) {
            setTypingMap((prev) => {
              const newMap = new Map(prev);
              if (isTyping) newMap.set(conv.id, userName || "User");
              else newMap.delete(conv.id);
              return newMap;
            });
          }
        },
      });
      unsubscribers.push(unsub);
    });
    return () => unsubscribers.forEach((u) => u());
  }, [conversations, currentUserId]);

  const filtered = conversations.filter((conv) => {
    if (!search) return true;
    const other = conv.user1_id === currentUserId ? conv.user2 : conv.user1;
    const name = (other?.full_name || "").toLowerCase();
    const username = (other?.username || "").toLowerCase();
    return name.includes(search.toLowerCase()) || username.includes(search.toLowerCase());
  });

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const ms = Date.now() - new Date(dateStr);
    if (ms < 60000)    return "now";
    if (ms < 3600000)  return `${Math.floor(ms / 60000)}m`;
    if (ms < 86400000) return `${Math.floor(ms / 3600000)}h`;
    if (ms < 604800000) return `${Math.floor(ms / 86400000)}d`;
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // ── FIX: safely extract preview text, guard against UUID/object bleed ──
  const getPreview = (conv) => {
    const typingName = typingMap.get(conv.id);
    if (typingName) return `${typingName} is typing…`;

    const lm = conv.lastMessage;

    // Guard: lastMessage must be an object with a string content field
    if (!lm || typeof lm !== "object") return "Start a conversation";
    
    const content = lm.content;
    
    // Guard: content must be a non-empty string that isn't a bare UUID
    if (
      !content ||
      typeof content !== "string" ||
      // UUID pattern — if the entire content is a UUID, something went wrong
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(content.trim())
    ) {
      return "Start a conversation";
    }

    const isMe = lm.sender_id === currentUserId;
    return `${isMe ? "You: " : ""}${content.slice(0, 60)}`;
  };

  const getAvatar = (user) => {
    if (!user) return null;
    if (user.avatar_id) return mediaUrlService.getAvatarUrl(user.avatar_id, 200);
    return null;
  };

  return (
    <div className="conv-root">
      {/* ── Header ── */}
      <div className="conv-header">
        <button className="conv-close-full" onClick={onClose} aria-label="Close">
          <ArrowLeft size={20} />
        </button>
        <h2 className="conv-title">Messages</h2>
        <button className="conv-new" onClick={onNewChat} aria-label="New message">
          <Plus size={18} />
        </button>
      </div>

      {/* ── Search ── */}
      <div className="conv-search">
        <Search size={14} className="conv-search-icon" />
        <input
          type="text"
          placeholder="Search conversations…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button className="conv-search-clear" onClick={() => setSearch("")}>
            <X size={12} />
          </button>
        )}
      </div>

      {/* ── List ── */}
      <div className="conv-list">
        {loading && (
          <div className="conv-loading">
            <div className="conv-spinner" />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="conv-empty">
            <MessageCircle size={36} />
            <p>{search ? "No matches found" : "No conversations yet"}</p>
            {!search && (
              <button className="conv-start-btn" onClick={onNewChat}>
                Start a conversation
              </button>
            )}
          </div>
        )}

        {!loading &&
          filtered.map((conv) => {
            const other      = conv.user1_id === currentUserId ? conv.user2 : conv.user1;
            const status     = statusMap.get(other?.id) || { online: false };
            const isActive   = conv.id === activeConversationId;
            const unread     = conv.unreadCount || 0;
            const hasUnread  = !isActive && unread > 0;
            const avatarUrl  = getAvatar(other);
            const isTyping   = typingMap.has(conv.id);
            const preview    = getPreview(conv);

            return (
              <div
                key={conv.id}
                className={`conv-item${hasUnread ? " unread" : ""}${isActive ? " active" : ""}`}
                onClick={() => onSelect(conv)}
              >
                <div className="conv-avatar-wrap">
                  <div className="conv-avatar">
                    {avatarUrl
                      ? <img src={avatarUrl} alt={other?.full_name || "User"} />
                      : (other?.full_name || "U").charAt(0).toUpperCase()
                    }
                  </div>
                  <div className={`conv-dot${status.online ? " online" : ""}`} />
                </div>

                <div className="conv-info">
                  <div className="conv-top">
                    <span className="conv-name">{other?.full_name || "Unknown"}</span>
                    <span className="conv-time">
                      {formatTime(conv.lastMessage?.created_at || conv.last_message_at)}
                    </span>
                  </div>
                  <div className="conv-bottom">
                    <span className={`conv-preview${hasUnread ? " bold" : ""}${isTyping ? " typing" : ""}`}>
                      {preview}
                    </span>
                    {hasUnread && !isTyping && (
                      <span className="conv-badge">{unread > 99 ? "99+" : unread}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      <style>{`
        /* ── Root fills whatever container gives it (full screen dm-panel) ── */
        .conv-root {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #000;
          /* Safe area padding so content isn't under notch or home bar */
          padding-top: env(safe-area-inset-top, 0px);
        }

        /* ── Header ── */
        .conv-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px 10px;
          border-bottom: 1px solid rgba(132, 204, 22, 0.1);
          flex-shrink: 0;
        }
        .conv-title {
          font-size: 18px;
          font-weight: 800;
          color: #fff;
          margin: 0;
          flex: 1;
          text-align: center;
          letter-spacing: -0.3px;
        }
        .conv-close-full {
          width: 36px; height: 36px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          display: flex; align-items: center; justify-content: center;
          color: #84cc16;
          cursor: pointer;
          transition: background 0.2s;
        }
        .conv-close-full:hover { background: rgba(132, 204, 22, 0.1); }
        .conv-new {
          width: 36px; height: 36px;
          border-radius: 10px;
          background: rgba(132, 204, 22, 0.12);
          border: 1px solid rgba(132, 204, 22, 0.25);
          display: flex; align-items: center; justify-content: center;
          color: #84cc16;
          cursor: pointer;
          transition: background 0.2s;
        }
        .conv-new:hover { background: rgba(132, 204, 22, 0.2); }

        /* ── Search ── */
        .conv-search {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 10px 14px;
          padding: 9px 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          flex-shrink: 0;
        }
        .conv-search-icon { color: #555; flex-shrink: 0; }
        .conv-search input {
          flex: 1;
          background: transparent;
          border: none;
          color: #fff;
          font-size: 14px;
          outline: none;
          caret-color: #84cc16;
        }
        .conv-search input::placeholder { color: #444; }
        .conv-search-clear {
          background: none; border: none;
          color: #555; cursor: pointer;
          display: flex; align-items: center;
        }

        /* ── List scroll area ── */
        .conv-list {
          flex: 1;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          padding-bottom: env(safe-area-inset-bottom, 16px);
        }
        .conv-list::-webkit-scrollbar { width: 3px; }
        .conv-list::-webkit-scrollbar-thumb {
          background: rgba(132, 204, 22, 0.2);
          border-radius: 2px;
        }

        /* ── Loading ── */
        .conv-loading {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 60px 20px;
        }
        .conv-spinner {
          width: 28px; height: 28px;
          border: 3px solid rgba(132, 204, 22, 0.15);
          border-top-color: #84cc16;
          border-radius: 50%;
          animation: convSpin 0.7s linear infinite;
        }
        @keyframes convSpin { to { transform: rotate(360deg); } }

        /* ── Empty ── */
        .conv-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 60px 20px;
          gap: 10px;
          color: #444;
          text-align: center;
        }
        .conv-empty p { margin: 0; font-size: 14px; color: #555; }
        .conv-start-btn {
          margin-top: 8px;
          padding: 10px 24px;
          border-radius: 20px;
          background: rgba(132, 204, 22, 0.12);
          border: 1px solid rgba(132, 204, 22, 0.3);
          color: #84cc16;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.2s;
        }
        .conv-start-btn:hover { background: rgba(132, 204, 22, 0.2); }

        /* ── Conversation row ── */
        .conv-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          cursor: pointer;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
          transition: background 0.15s;
          -webkit-tap-highlight-color: transparent;
        }
        .conv-item:hover  { background: rgba(255, 255, 255, 0.03); }
        .conv-item.unread { background: rgba(132, 204, 22, 0.025); }
        .conv-item.active { background: rgba(132, 204, 22, 0.08); }

        /* ── Avatar ── */
        .conv-avatar-wrap { position: relative; flex-shrink: 0; }
        .conv-avatar {
          width: 46px; height: 46px;
          border-radius: 50%;
          background: linear-gradient(135deg, #1a1a1a, #222);
          border: 2px solid rgba(255, 255, 255, 0.07);
          display: flex; align-items: center; justify-content: center;
          font-size: 18px; font-weight: 700; color: #84cc16;
          overflow: hidden;
        }
        .conv-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .conv-dot {
          position: absolute; bottom: 1px; right: 1px;
          width: 12px; height: 12px;
          border-radius: 50%;
          border: 2px solid #000;
          background: #333;
          transition: background 0.3s;
        }
        .conv-dot.online { background: #22c55e; }

        /* ── Text info ── */
        .conv-info { flex: 1; min-width: 0; }
        .conv-top {
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
          flex: 1;
          min-width: 0;
        }
        .conv-time {
          font-size: 11px;
          color: #444;
          flex-shrink: 0;
          margin-left: 8px;
        }
        .conv-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .conv-preview {
          font-size: 13px;
          color: #4a4a4a;
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-weight: 400;
        }
        .conv-preview.bold  { color: #888; font-weight: 600; }
        .conv-preview.typing { color: #84cc16; font-style: italic; }

        /* ── Unread badge ── */
        .conv-badge {
          min-width: 20px; height: 20px;
          padding: 0 5px;
          border-radius: 10px;
          background: #84cc16;
          color: #000;
          font-size: 10px; font-weight: 800;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
};

export default ConversationList;