// components/Messages/ConversationList.jsx - INSTANT UPDATES + TYPING
import React, { useState, useEffect } from "react";
import { Search, X, MessageCircle, Plus } from "lucide-react";
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

  // ✅ SUBSCRIBE TO STATE CHANGES (INSTANT UPDATES)
  useEffect(() => {
    const updateConversations = () => {
      const convs = conversationState.getConversations();
      setConversations([...convs]);
    };

    const unsub = conversationState.subscribe(updateConversations);
    updateConversations();

    return unsub;
  }, []);

  // Subscribe to online status updates
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

  // ✅ SUBSCRIBE TO TYPING INDICATORS FOR ALL CONVERSATIONS
  useEffect(() => {
    const unsubscribers = [];

    conversations.forEach((conv) => {
      const unsub = dmMessageService.subscribeToConversation(conv.id, {
        onTyping: (userId, isTyping, userName) => {
          const otherId = conv.user1_id === currentUserId ? conv.user2?.id : conv.user1?.id;
          
          if (userId === otherId) {
            setTypingMap((prev) => {
              const newMap = new Map(prev);
              if (isTyping) {
                newMap.set(conv.id, userName || "User");
              } else {
                newMap.delete(conv.id);
              }
              return newMap;
            });
          }
        },
      });

      unsubscribers.push(unsub);
    });

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
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
    if (ms < 60000) return "now";
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m`;
    if (ms < 86400000) return `${Math.floor(ms / 3600000)}h`;
    if (ms < 604800000) return `${Math.floor(ms / 86400000)}d`;
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getPreview = (conv) => {
    const typingName = typingMap.get(conv.id);
    if (typingName) return `${typingName} is typing...`;
    
    if (!conv.lastMessage) return "Start a conversation";
    const isMe = conv.lastMessage.sender_id === currentUserId;
    const prefix = isMe ? "You: " : "";
    return `${prefix}${(conv.lastMessage.content || "").slice(0, 60)}`;
  };

  const getAvatar = (user) => {
    if (!user) return null;
    if (user.avatar_id) return mediaUrlService.getAvatarUrl(user.avatar_id, 200);
    return null;
  };

  return (
    <div className="conv-root">
      <div className="conv-header">
        <button className="conv-new" onClick={onNewChat}>
          <Plus size={18} />
        </button>
        <h2 className="conv-title">Messages</h2>
        <button className="conv-close" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <div className="conv-search">
        <Search size={14} />
        <input
          type="text"
          placeholder="Search conversations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button onClick={() => setSearch("")}>
            <X size={12} />
          </button>
        )}
      </div>

      <div className="conv-list">
        {loading && (
          <div className="conv-loading">
            <div className="conv-spinner" />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="conv-empty">
            <MessageCircle size={36} />
            <p>{search ? "No matches" : "No messages yet"}</p>
          </div>
        )}

        {!loading &&
          filtered.map((conv) => {
            const other = conv.user1_id === currentUserId ? conv.user2 : conv.user1;
            const status = statusMap.get(other?.id) || { online: false };
            const isActive = conv.id === activeConversationId;
            const unread = conv.unreadCount || 0;
            const hasUnread = !isActive && unread > 0;
            const avatarUrl = getAvatar(other);
            const isTyping = typingMap.has(conv.id);

            return (
              <div
                key={conv.id}
                className={`conv-item ${hasUnread ? "unread" : ""} ${isActive ? "active" : ""}`}
                onClick={() => onSelect(conv)}
              >
                <div className="conv-avatar-wrap">
                  <div className="conv-avatar">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={other?.full_name || "User"} />
                    ) : (
                      (other?.full_name || "U").charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className={`conv-dot ${status.online ? "online" : ""}`} />
                </div>

                <div className="conv-info">
                  <div className="conv-top">
                    <span className="conv-name">{other?.full_name || "Unknown"}</span>
                    <span className="conv-time">
                      {formatTime(conv.lastMessage?.created_at || conv.last_message_at)}
                    </span>
                  </div>
                  <div className="conv-bottom">
                    <span className={`conv-preview ${hasUnread ? "unread" : ""} ${isTyping ? "typing" : ""}`}>
                      {getPreview(conv)}
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
        .conv-root { display: flex; flex-direction: column; height: 100%; background: #000; }
        .conv-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; }
        .conv-title { font-size: 20px; font-weight: 800; color: #fff; margin: 0; flex: 1; text-align: center; }
        .conv-new, .conv-close {
          width: 32px; height: 32px; border-radius: 50%;
          border: 1px solid rgba(132, 204, 22, 0.3);
          display: flex; align-items: center; justify-content: center; cursor: pointer;
        }
        .conv-new { background: rgba(132, 204, 22, 0.15); color: #84cc16; }
        .conv-close { background: rgba(255, 255, 255, 0.06); color: #666; }
        .conv-search {
          display: flex; align-items: center; gap: 6px;
          margin: 0 12px 10px; padding: 6px 10px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px;
        }
        .conv-search input {
          flex: 1; background: transparent; border: none;
          color: #fff; font-size: 12px; outline: none;
        }
        .conv-search button { background: none; border: none; color: #555; cursor: pointer; }
        .conv-list { flex: 1; overflow-y: auto; }
        .conv-loading { display: flex; justify-content: center; padding: 30px; }
        .conv-spinner {
          width: 24px; height: 24px;
          border: 3px solid rgba(132, 204, 22, 0.2);
          border-top-color: #84cc16; border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .conv-empty {
          display: flex; flex-direction: column; align-items: center;
          padding: 50px 20px; text-align: center; gap: 8px; color: #555;
        }
        .conv-item {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; cursor: pointer;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
          transition: background 0.2s;
        }
        .conv-item:hover { background: rgba(255, 255, 255, 0.04); }
        .conv-item.unread { background: rgba(132, 204, 22, 0.03); }
        .conv-item.active { background: rgba(132, 204, 22, 0.1); }
        .conv-avatar-wrap { position: relative; }
        .conv-avatar {
          width: 40px; height: 40px; border-radius: 50%;
          background: linear-gradient(135deg, #1a1a1a, #222);
          border: 2px solid rgba(255, 255, 255, 0.08);
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; font-weight: 700; color: #84cc16; overflow: hidden;
        }
        .conv-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .conv-dot {
          position: absolute; bottom: 0; right: 0;
          width: 11px; height: 11px; border-radius: 50%;
          border: 2px solid #000; background: #444;
          transition: background 0.3s;
        }
        .conv-dot.online { background: #22c55e; }
        .conv-info { flex: 1; min-width: 0; }
        .conv-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px; }
        .conv-name { font-size: 13px; font-weight: 700; color: #fff; }
        .conv-time { font-size: 10px; color: #444; }
        .conv-bottom { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .conv-preview { 
          font-size: 12px; color: #555; flex: 1; 
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap; 
        }
        .conv-preview.unread { color: #888; font-weight: 600; }
        .conv-preview.typing { color: #84cc16; font-style: italic; }
        .conv-badge {
          min-width: 18px; height: 18px; padding: 0 5px;
          border-radius: 9px; background: #84cc16; color: #000;
          font-size: 10px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
};

export default ConversationList;