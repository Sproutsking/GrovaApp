import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowLeft,
  MoreVertical,
  Edit2,
  Trash2,
  Check,
  CheckCheck,
  Palette,
  AlertCircle,
  Ban,
  Users,
} from "lucide-react";
import dmMessageService from "../../services/messages/dmMessageService";
import onlineStatusService from "../../services/messages/onlineStatusService";
import MessageInput from "./MessageInput";
import mediaUrlService from "../../services/shared/mediaUrlService";

const CHAT_BACKGROUNDS = [
  "linear-gradient(135deg, #000000 0%, #1a1a1a 100%)",
  "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)",
  "linear-gradient(135deg, #0f0f0f 0%, #1a2a1a 100%)",
];

const ChatView = ({ conversation, currentUser, onBack }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [otherOnline, setOtherOnline] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [selectedBackground, setSelectedBackground] = useState(0);
  const [showDeleteOptions, setShowDeleteOptions] = useState(null);

  const scrollRef = useRef(null);
  const messagesEndRef = useRef(null);
  const unsubRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const initialLoadRef = useRef(false);

  const otherUser = conversation.otherUser;
  const conversationId = conversation.id;

  // ─── LOAD MESSAGES ──────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // Only show loading on initial load
      if (!initialLoadRef.current) {
        setLoading(true);
        initialLoadRef.current = true;
      }

      try {
        // Try to get cached messages first
        const msgs = await dmMessageService.getMessages(conversationId, false);
        if (!cancelled) {
          setMessages(msgs);
        }
      } catch (e) {
        console.error("Failed to load messages:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }

      // Mark as read
      dmMessageService.markAsRead(conversationId, currentUser.id);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [conversationId, currentUser.id]);

  // ─── REALTIME SUBSCRIPTION ──────────────────────────────────────────────

  useEffect(() => {
    const unsub = dmMessageService.subscribeToMessages(
      conversationId,
      (event) => {
        if (event.type === "INSERT" && event.message) {
          setMessages((prev) => {
            const existsById = prev.some((m) => m.id === event.message.id);
            if (existsById) {
              return prev.map((m) =>
                m.id === event.message.id ? event.message : m,
              );
            }

            const optimisticIndex = prev.findIndex(
              (m) =>
                m._optimistic &&
                m.sender_id === event.message.sender_id &&
                m.content === event.message.content,
            );
            if (optimisticIndex !== -1) {
              const next = [...prev];
              next[optimisticIndex] = event.message;
              return next;
            }

            return [...prev, event.message];
          });

          if (event.message.sender_id !== currentUser.id) {
            dmMessageService.markAsRead(conversationId, currentUser.id);
          }
        } else if (event.type === "UPDATE" && event.message) {
          setMessages((prev) =>
            prev.map((m) => (m.id === event.message.id ? event.message : m)),
          );
        } else if (event.type === "DELETE" && event.messageId) {
          setMessages((prev) => prev.filter((m) => m.id !== event.messageId));
        } else if (event.type === "TYPING" && event.userId !== currentUser.id) {
          setOtherTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => {
            setOtherTyping(false);
          }, 3000);
        }
      },
    );

    unsubRef.current = unsub;
    return () => {
      if (unsubRef.current) unsubRef.current();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [conversationId, currentUser.id]);

  // ─── ONLINE STATUS ──────────────────────────────────────────────────────

  useEffect(() => {
    onlineStatusService.fetchStatus(otherUser?.id).then((s) => {
      setOtherOnline(s.online);
    });

    const unsub = onlineStatusService.subscribe((userId, status) => {
      if (userId === otherUser?.id) {
        setOtherOnline(status.online);
      }
    });

    return unsub;
  }, [otherUser?.id]);

  // ─── AUTO SCROLL ────────────────────────────────────────────────────────

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, otherTyping]);

  // ─── HANDLERS ───────────────────────────────────────────────────────────

  const handleSend = useCallback(
    (text) => {
      if (!text?.trim()) return;

      const senderProfile = {
        id: currentUser.id,
        name: currentUser.name || currentUser.fullName,
        username: currentUser.username,
        avatarId: currentUser.avatarId || currentUser.avatar_id,
        avatar: currentUser.avatar,
        verified: currentUser.verified || false,
      };

      const optimistic = dmMessageService.sendMessage(
        conversationId,
        currentUser.id,
        text,
        senderProfile,
      );

      optimistic.then((msg) => {
        setMessages((prev) => [...prev, msg]);
      });
    },
    [conversationId, currentUser],
  );

  const handleEdit = async () => {
    if (!contextMenu || !editText.trim()) return;
    try {
      await dmMessageService.editMessage(contextMenu, editText, currentUser.id);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === contextMenu
            ? {
                ...m,
                content: editText.trim(),
                edited_at: new Date().toISOString(),
              }
            : m,
        ),
      );
    } catch (e) {
      console.error("Edit failed:", e);
    }
    setEditingId(null);
    setContextMenu(null);
    setEditText("");
  };

  const handleDelete = async (messageId, deleteForAll = false) => {
    try {
      await dmMessageService.deleteMessage(
        messageId,
        currentUser.id,
        deleteForAll,
      );
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (e) {
      console.error("Delete failed:", e);
    }
    setContextMenu(null);
    setShowDeleteOptions(null);
  };

  const startEdit = (msg) => {
    setEditingId(msg.id);
    setEditText(msg.content);
    setContextMenu(null);
  };

  // ─── FORMATTING ─────────────────────────────────────────────────────────

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    let hours = d.getHours();
    const mins = d.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${hours}:${mins} ${ampm}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return "Today";
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getReadIcon = (msg) => {
    if (msg.sender_id !== currentUser.id) return null;
    if (msg._optimistic) return <Check size={12} />;
    if (msg.read) return <CheckCheck size={12} className="read-icon read" />;
    if (msg.delivered)
      return <CheckCheck size={12} className="read-icon delivered" />;
    return <Check size={12} className="read-icon pending" />;
  };

  // ─── MESSAGE GROUPING ───────────────────────────────────────────────────

  const groupedMessages = [];
  let lastDate = null;

  messages.forEach((msg, idx) => {
    const msgDate = formatDate(msg.created_at);
    if (msgDate !== lastDate) {
      groupedMessages.push({ type: "date", label: msgDate });
      lastDate = msgDate;
    }

    const isMe = msg.sender_id === currentUser.id;
    const prev = messages[idx - 1];
    const showAvatar = !isMe && (!prev || prev.sender_id !== msg.sender_id);

    groupedMessages.push({ type: "message", msg, isMe, showAvatar });
  });

  // ─── AVATAR HELPERS ─────────────────────────────────────────────────────

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
          loading="eager"
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
    <div className="chat-view-root">
      <div className="chat-header">
        <button className="chat-back-btn" onClick={onBack} aria-label="Back">
          <ArrowLeft size={20} />
        </button>

        <div className="chat-header-info">
          <div className="chat-avatar-sm">{getAvatarContent(otherUser)}</div>
          <div className="chat-header-text">
            <span className="chat-header-name">
              {otherUser?.full_name || "Unknown"}
            </span>
            <span
              className={`chat-header-status ${otherOnline ? "online" : "offline"}`}
            >
              {otherTyping ? "typing..." : otherOnline ? "Online" : "Offline"}
            </span>
          </div>
        </div>

        <button
          className="chat-action-btn"
          onClick={() => setShowActionMenu(!showActionMenu)}
          aria-label="Chat actions"
        >
          <MoreVertical size={20} />
        </button>

        {showActionMenu && (
          <>
            <div
              className="chat-action-overlay"
              onClick={() => setShowActionMenu(false)}
            />
            <div className="chat-action-menu">
              <div className="chat-action-section">
                <span className="chat-action-label">Chat Background</span>
                <div className="chat-bg-options">
                  {["Dark", "Blue", "Green"].map((name, idx) => (
                    <button
                      key={idx}
                      className={`chat-bg-btn ${selectedBackground === idx ? "active" : ""}`}
                      onClick={() => setSelectedBackground(idx)}
                    >
                      <Palette size={14} />
                      <span>{name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <button className="chat-action-item">
                <Users size={16} />
                <span>Start Group Chat</span>
              </button>
              <button className="chat-action-item danger">
                <AlertCircle size={16} />
                <span>Report User</span>
              </button>
              <button className="chat-action-item danger">
                <Ban size={16} />
                <span>Block User</span>
              </button>
            </div>
          </>
        )}
      </div>

      <div
        className="chat-messages"
        ref={scrollRef}
        style={{
          background: CHAT_BACKGROUNDS[selectedBackground],
        }}
      >
        <div className="chat-messages-overlay" />

        {loading && messages.length === 0 && (
          <div className="chat-loading">
            <div className="chat-spinner"></div>
          </div>
        )}

        {!loading &&
          groupedMessages.map((item, idx) => {
            if (item.type === "date") {
              return (
                <div key={`date-${idx}`} className="chat-date-divider">
                  <span>{item.label}</span>
                </div>
              );
            }

            const { msg, isMe, showAvatar } = item;

            if (editingId === msg.id) {
              return (
                <div key={msg.id} className="chat-edit-row">
                  <textarea
                    className="chat-edit-textarea"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleEdit();
                      }
                      if (e.key === "Escape") {
                        setEditingId(null);
                        setEditText("");
                      }
                    }}
                  />
                  <div className="chat-edit-actions">
                    <button
                      className="chat-edit-cancel"
                      onClick={() => {
                        setEditingId(null);
                        setEditText("");
                      }}
                    >
                      Cancel
                    </button>
                    <button className="chat-edit-save" onClick={handleEdit}>
                      Save
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={msg.id || `opt-${idx}`}
                className={`chat-msg-row ${isMe ? "me" : "them"}`}
              >
                {showAvatar && (
                  <div className="chat-msg-avatar">
                    {getAvatarContent(otherUser)}
                  </div>
                )}
                {!showAvatar && !isMe && (
                  <div className="chat-msg-avatar-spacer" />
                )}

                <div
                  className={`chat-bubble ${isMe ? "me" : "them"}`}
                  onContextMenu={(e) => {
                    if (isMe) {
                      e.preventDefault();
                      setContextMenu(msg.id);
                    }
                  }}
                >
                  <span className="chat-bubble-text">{msg.content}</span>
                  <div className="chat-bubble-meta">
                    <span className="chat-bubble-time">
                      {formatTime(msg.created_at)}
                    </span>
                    {msg.edited_at && (
                      <span className="chat-bubble-edited">(edited)</span>
                    )}
                    {isMe && (
                      <span className="chat-bubble-receipt">
                        {getReadIcon(msg)}
                      </span>
                    )}
                  </div>
                </div>

                {contextMenu === msg.id && isMe && (
                  <div className="chat-ctx-menu">
                    <button
                      className="chat-ctx-btn"
                      onClick={() => startEdit(msg)}
                    >
                      <Edit2 size={14} />
                      <span>Edit</span>
                    </button>
                    <button
                      className="chat-ctx-btn danger"
                      onClick={() => setShowDeleteOptions(msg.id)}
                    >
                      <Trash2 size={14} />
                      <span>Delete</span>
                    </button>
                  </div>
                )}

                {showDeleteOptions === msg.id && (
                  <div className="chat-delete-options">
                    <button
                      className="chat-delete-btn"
                      onClick={() => handleDelete(msg.id, false)}
                    >
                      Delete for me
                    </button>
                    <button
                      className="chat-delete-btn danger"
                      onClick={() => handleDelete(msg.id, true)}
                    >
                      Delete for everyone
                    </button>
                    <button
                      className="chat-delete-btn"
                      onClick={() => setShowDeleteOptions(null)}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })}

        {otherTyping && (
          <div className="chat-typing-indicator">
            <div className="chat-msg-avatar">{getAvatarContent(otherUser)}</div>
            <div className="typing-bubble">
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {(contextMenu || showDeleteOptions) && (
        <div
          className="chat-ctx-overlay"
          onClick={() => {
            setContextMenu(null);
            setShowDeleteOptions(null);
          }}
        />
      )}

      <MessageInput
        onSend={handleSend}
        conversationId={conversationId}
        onTyping={() => {
          dmMessageService.sendTypingIndicator?.(
            conversationId,
            currentUser.id,
          );
        }}
      />

      <style>{`
        .chat-view-root {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #000;
          position: relative;
        }

        .chat-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: rgba(0,0,0,0.95);
          border-bottom: 1px solid rgba(132,204,22,0.12);
          flex-shrink: 0;
          position: relative;
          z-index: 10;
        }
        
        .chat-back-btn,
        .chat-action-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          color: #84cc16;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
          flex-shrink: 0;
        }
        .chat-back-btn:hover,
        .chat-action-btn:hover { 
          background: rgba(132,204,22,0.12); 
        }

        .chat-header-info {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;
          min-width: 0;
        }
        
        .chat-avatar-sm {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: linear-gradient(135deg, #1a1a1a, #222);
          border: 2px solid rgba(132,204,22,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 700;
          color: #84cc16;
          flex-shrink: 0;
          overflow: hidden;
          position: relative;
        }
        
        .chat-avatar-sm img,
        .chat-msg-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          position: absolute;
          top: 0;
          left: 0;
        }
        
        .avatar-fallback {
          font-size: 16px;
          font-weight: 700;
          color: #84cc16;
        }
        
        .chat-header-text {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .chat-header-name {
          font-size: 15px;
          font-weight: 700;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .chat-header-status {
          font-size: 12px;
          font-weight: 600;
        }
        .chat-header-status.online { color: #22c55e; }
        .chat-header-status.offline { color: #555; }

        .chat-action-overlay {
          position: fixed;
          inset: 0;
          z-index: 998;
        }
        
        .chat-action-menu {
          position: absolute;
          top: 60px;
          right: 16px;
          background: #1a1a1a;
          border: 1px solid rgba(132,204,22,0.25);
          border-radius: 12px;
          padding: 8px;
          min-width: 220px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.6);
          z-index: 999;
        }
        
        .chat-action-section {
          padding: 8px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          margin-bottom: 8px;
        }
        
        .chat-action-label {
          font-size: 11px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          display: block;
          margin-bottom: 8px;
        }
        
        .chat-bg-options {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        
        .chat-bg-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          color: #888;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .chat-bg-btn:hover {
          background: rgba(132,204,22,0.1);
          border-color: rgba(132,204,22,0.3);
          color: #84cc16;
        }
        .chat-bg-btn.active {
          background: rgba(132,204,22,0.15);
          border-color: rgba(132,204,22,0.4);
          color: #84cc16;
        }
        
        .chat-action-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 10px 12px;
          background: transparent;
          border: none;
          border-radius: 8px;
          color: #ccc;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.15s;
          text-align: left;
        }
        .chat-action-item:hover {
          background: rgba(255,255,255,0.08);
        }
        .chat-action-item.danger {
          color: #ef4444;
        }
        .chat-action-item.danger:hover {
          background: rgba(239,68,68,0.1);
        }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 12px 16px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          scrollbar-width: thin;
          scrollbar-color: rgba(132,204,22,0.2) transparent;
          position: relative;
        }
        
        .chat-messages-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.4);
          pointer-events: none;
        }
        
        .chat-messages > * {
          position: relative;
          z-index: 1;
        }
        
        .chat-messages::-webkit-scrollbar { width: 4px; }
        .chat-messages::-webkit-scrollbar-thumb { 
          background: rgba(132,204,22,0.2); 
          border-radius: 2px; 
        }

        .chat-loading {
          display: flex;
          justify-content: center;
          padding: 30px 0;
        }
        .chat-spinner {
          width: 24px;
          height: 24px;
          border: 3px solid rgba(132,204,22,0.2);
          border-top-color: #84cc16;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .chat-date-divider {
          text-align: center;
          padding: 12px 0 8px;
        }
        .chat-date-divider span {
          font-size: 11px;
          color: #84cc16;
          font-weight: 600;
          background: rgba(0,0,0,0.8);
          padding: 4px 12px;
          border-radius: 12px;
          border: 1px solid rgba(132,204,22,0.2);
        }

        .chat-msg-row {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          position: relative;
        }
        .chat-msg-row.me { flex-direction: row-reverse; }

        .chat-msg-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: linear-gradient(135deg, #1a1a1a, #222);
          border: 1px solid rgba(132,204,22,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
          color: #84cc16;
          flex-shrink: 0;
          overflow: hidden;
          position: relative;
        }
        
        .chat-msg-avatar-spacer {
          width: 28px;
          flex-shrink: 0;
        }

        .chat-bubble {
          max-width: 70%;
          padding: 10px 14px;
          border-radius: 18px;
          position: relative;
          backdrop-filter: blur(10px);
        }
        .chat-bubble.them {
          background: rgba(26,26,26,0.95);
          border: 1px solid rgba(255,255,255,0.1);
          border-bottom-left-radius: 4px;
        }
        .chat-bubble.me {
          background: linear-gradient(135deg, rgba(132,204,22,0.25), rgba(132,204,22,0.15));
          border: 1px solid rgba(132,204,22,0.3);
          border-bottom-right-radius: 4px;
        }

        .chat-bubble-text {
          display: block;
          font-size: 14px;
          color: #fff;
          line-height: 1.5;
          word-break: break-word;
        }

        .chat-bubble-meta {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: 4px;
        }
        .chat-bubble.me .chat-bubble-meta { justify-content: flex-end; }

        .chat-bubble-time {
          font-size: 10px;
          color: #666;
        }
        .chat-bubble-edited {
          font-size: 10px;
          color: #555;
          font-style: italic;
        }
        .chat-bubble-receipt {
          display: flex;
          align-items: center;
        }
        .read-icon { color: #84cc16; }
        .read-icon.delivered { color: #555; }
        .read-icon.pending { color: #444; }

        .chat-typing-indicator {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          animation: fadeIn 0.3s ease;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .typing-bubble {
          background: rgba(26,26,26,0.95);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 18px;
          border-bottom-left-radius: 4px;
          padding: 12px 16px;
          display: flex;
          gap: 4px;
          backdrop-filter: blur(10px);
        }
        
        .typing-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #84cc16;
          animation: typingBounce 1.4s infinite;
        }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
        
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-10px); }
        }

        .chat-ctx-overlay {
          position: fixed;
          inset: 0;
          z-index: 999;
        }
        
        .chat-ctx-menu {
          position: absolute;
          right: 0;
          bottom: 28px;
          background: #1a1a1a;
          border: 1px solid rgba(132,204,22,0.25);
          border-radius: 10px;
          padding: 4px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5);
          z-index: 1000;
          min-width: 120px;
        }
        .chat-msg-row.me .chat-ctx-menu { right: 0; left: auto; }

        .chat-ctx-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 8px 12px;
          background: transparent;
          border: none;
          border-radius: 6px;
          color: #ccc;
          font-size: 13px;
          cursor: pointer;
          transition: background 0.15s;
          text-align: left;
        }
        .chat-ctx-btn:hover { background: rgba(255,255,255,0.08); }
        .chat-ctx-btn.danger { color: #ef4444; }
        .chat-ctx-btn.danger:hover { background: rgba(239,68,68,0.1); }

        .chat-delete-options {
          position: absolute;
          right: 0;
          bottom: 28px;
          background: #1a1a1a;
          border: 1px solid rgba(132,204,22,0.25);
          border-radius: 10px;
          padding: 8px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5);
          z-index: 1000;
          min-width: 180px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        
        .chat-delete-btn {
          padding: 10px 12px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          color: #ccc;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .chat-delete-btn:hover {
          background: rgba(255,255,255,0.1);
        }
        .chat-delete-btn.danger {
          color: #ef4444;
          border-color: rgba(239,68,68,0.3);
        }
        .chat-delete-btn.danger:hover {
          background: rgba(239,68,68,0.15);
        }

        .chat-edit-row {
          padding: 8px 0;
        }
        .chat-edit-textarea {
          width: 100%;
          background: rgba(26,26,26,0.95);
          border: 1px solid rgba(132,204,22,0.3);
          border-radius: 8px;
          padding: 10px 12px;
          color: #fff;
          font-size: 14px;
          font-family: inherit;
          resize: none;
          outline: none;
          min-height: 40px;
          max-height: 100px;
          box-sizing: border-box;
          backdrop-filter: blur(10px);
        }
        .chat-edit-actions {
          display: flex;
          gap: 8px;
          margin-top: 6px;
          justify-content: flex-end;
        }
        .chat-edit-cancel, .chat-edit-save {
          padding: 5px 14px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          border: none;
        }
        .chat-edit-cancel {
          background: rgba(255,255,255,0.06);
          color: #888;
        }
        .chat-edit-cancel:hover { background: rgba(255,255,255,0.1); }
        .chat-edit-save {
          background: linear-gradient(135deg, #84cc16, #65a30d);
          color: #000;
        }
        .chat-edit-save:hover { filter: brightness(1.1); }
      `}</style>
    </div>
  );
};

export default ChatView;
