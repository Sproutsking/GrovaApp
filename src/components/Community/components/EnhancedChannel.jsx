// src/components/Community/components/EnhancedChannel.jsx
// USE THIS - DELETE Channel.jsx
import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  Smile,
  Image,
  ChevronRight,
  MoreVertical,
  Edit3,
  Trash2,
  Copy,
  Reply,
  Flag,
  Pin,
} from "lucide-react";
import channelService from "../../../services/community/channelService";

const EnhancedChannel = ({ channel, userId, community, userPermissions }) => {
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [loading, setLoading] = useState(true);
  const [inputExpanded, setInputExpanded] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const unsubscribeRef = useRef(null);

  // Background pattern state
  const [backgroundPattern, setBackgroundPattern] = useState("default");

  useEffect(() => {
    // Load saved background preference
    const saved = localStorage.getItem(`community-bg-${community?.id}`);
    if (saved) setBackgroundPattern(saved);

    // Listen for background changes
    const handleBgChange = (e) => {
      if (e.detail.communityId === community?.id) {
        setBackgroundPattern(e.detail.pattern);
      }
    };
    window.addEventListener("chat-background-change", handleBgChange);
    return () =>
      window.removeEventListener("chat-background-change", handleBgChange);
  }, [community]);

  useEffect(() => {
    if (channel) {
      loadMessages();
      subscribeToMessages();
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [channel]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const data = await channelService.fetchMessages(channel.id);
      setMessages(data);
    } catch (error) {
      console.error("Error loading messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToMessages = () => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    unsubscribeRef.current = channelService.subscribeToMessages(
      channel.id,
      (newMessage) => {
        setMessages((prev) => [...prev, newMessage]);
      },
    );
  };

  const handleSendMessage = async () => {
    const content = messageInput.trim();
    if (!content) return;

    if (editingMessage) {
      try {
        await channelService.updateMessage(editingMessage.id, content);
        setEditingMessage(null);
        setMessageInput("");
        await loadMessages();
      } catch (error) {
        console.error("Error editing message:", error);
      }
      return;
    }

    setMessageInput("");

    try {
      await channelService.sendMessage(channel.id, userId, content);
      // Message will be added via subscription
    } catch (error) {
      console.error("Error sending message:", error);
      setMessageInput(content);
      alert("Failed to send message. Please try again.");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleContextMenu = (e, message) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, message });
  };

  const handleEditMessage = () => {
    if (contextMenu?.message) {
      setEditingMessage(contextMenu.message);
      setMessageInput(contextMenu.message.content);
      inputRef.current?.focus();
    }
    setContextMenu(null);
  };

  const handleDeleteMessage = async () => {
    if (!contextMenu?.message) return;

    if (!window.confirm("Are you sure you want to delete this message?")) {
      setContextMenu(null);
      return;
    }

    try {
      await channelService.deleteMessage(contextMenu.message.id);
      setMessages((prev) =>
        prev.filter((m) => m.id !== contextMenu.message.id),
      );
    } catch (error) {
      console.error("Error deleting message:", error);
      alert("Failed to delete message");
    }
    setContextMenu(null);
  };

  const handleCopyText = () => {
    if (contextMenu?.message) {
      navigator.clipboard.writeText(contextMenu.message.content);
    }
    setContextMenu(null);
  };

  const cancelEdit = () => {
    setEditingMessage(null);
    setMessageInput("");
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const allReactions = [
    "❤️",
    "👍",
    "😂",
    "😮",
    "😢",
    "😡",
    "🔥",
    "🎉",
    "💯",
    "🚀",
    "👏",
    "🙏",
  ];

  const isOwner = community?.owner_id === userId;
  const canManageMessages = userPermissions?.manageMessages || isOwner;

  const getBackgroundClass = () => {
    switch (backgroundPattern) {
      case "dots":
        return "chat-background telegram-dots";
      case "subtle":
        return "chat-background telegram-alt";
      default:
        return "chat-background";
    }
  };

  return (
    <div
      className="channel-view"
      onClick={() => {
        setContextMenu(null);
        setShowEmoji(false);
      }}
    >
      <div className={getBackgroundClass()}></div>

      {/* Messages Container */}
      <div className="messages-container">
        {loading ? (
          <div style={{ textAlign: "center", color: "#666", padding: "20px" }}>
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: "center", color: "#666", padding: "20px" }}>
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className="message-group"
              onContextMenu={(e) => handleContextMenu(e, msg)}
            >
              <div className="message-avatar">{msg.user?.avatar || "👤"}</div>
              <div className="message-content">
                <div className="message-header">
                  <span className="message-author">
                    {msg.user?.full_name || msg.user?.username || "Unknown"}
                  </span>
                  <span className="message-timestamp">
                    {new Date(msg.created_at).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {msg.edited && (
                    <span
                      style={{
                        color: "#666",
                        fontSize: "11px",
                        marginLeft: "4px",
                      }}
                    >
                      (edited)
                    </span>
                  )}
                </div>
                <div className="message-text">{msg.content}</div>
                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                  <div className="message-reactions">
                    {Object.entries(msg.reactions).map(([emoji, count]) => (
                      <div
                        key={emoji}
                        className="reaction"
                        onClick={async () => {
                          try {
                            await channelService.addReaction(msg.id, emoji);
                            await loadMessages();
                          } catch (error) {
                            console.error("Error adding reaction:", error);
                          }
                        }}
                      >
                        {emoji} {count}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Edit Bar */}
      {editingMessage && (
        <div className="message-action-bar">
          <div className="edit-preview">
            <div className="edit-indicator">✎</div>
            <div className="edit-content">
              <div className="edit-label">Editing Message</div>
              <div className="edit-text">{editingMessage.content}</div>
            </div>
            <button className="cancel-action" onClick={cancelEdit}>
              ×
            </button>
          </div>
        </div>
      )}

      {/* Message Input */}
      <div className="message-input-container">
        {showEmoji && (
          <div className="emoji-panel" onClick={(e) => e.stopPropagation()}>
            <div className="emoji-content">
              <div className="emoji-grid">
                {allReactions.map((emoji, i) => (
                  <div
                    key={i}
                    className="emoji-item"
                    onClick={() => {
                      setMessageInput((prev) => prev + emoji);
                      setShowEmoji(false);
                    }}
                  >
                    {emoji}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="input-wrapper">
          <div
            className={`input-left-actions ${inputExpanded ? "hidden" : ""}`}
          >
            <button
              className="input-btn"
              onClick={(e) => {
                e.stopPropagation();
                setShowEmoji(!showEmoji);
              }}
            >
              <Smile size={16} />
            </button>
            <button className="input-btn">
              <Image size={16} />
            </button>
          </div>

          {inputExpanded && (
            <button
              className="expand-toggle"
              onClick={() => setInputExpanded(false)}
            >
              <ChevronRight size={16} />
            </button>
          )}

          <input
            ref={inputRef}
            type="text"
            className="message-input"
            placeholder={`Message #${channel?.name || "channel"}`}
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onFocus={() => setInputExpanded(true)}
            onKeyPress={handleKeyPress}
          />

          <div className="input-actions">
            <button
              className="input-btn send-btn"
              onClick={handleSendMessage}
              disabled={!messageInput.trim()}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{
            top: Math.min(contextMenu.y, window.innerHeight - 300),
            left: Math.min(contextMenu.x, window.innerWidth - 200),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="context-item" onClick={handleCopyText}>
            <Copy size={16} />
            Copy Text
          </div>

          {contextMenu.message.user_id === userId && (
            <>
              <div className="context-item" onClick={handleEditMessage}>
                <Edit3 size={16} />
                Edit Message
              </div>
              <div
                className="context-item danger"
                onClick={handleDeleteMessage}
              >
                <Trash2 size={16} />
                Delete Message
              </div>
            </>
          )}

          {canManageMessages && contextMenu.message.user_id !== userId && (
            <div className="context-item danger" onClick={handleDeleteMessage}>
              <Trash2 size={16} />
              Delete Message
            </div>
          )}

          <div className="context-item">
            <Reply size={16} />
            Reply
          </div>

          <div className="context-item">
            <Pin size={16} />
            Pin Message
          </div>

          {contextMenu.message.user_id !== userId && (
            <div className="context-item danger">
              <Flag size={16} />
              Report
            </div>
          )}
        </div>
      )}

      <style>{`
        .message-action-bar {
          padding: 8px 12px;
          background: rgba(15, 15, 15, 0.95);
          border-top: 1px solid rgba(26, 26, 26, 0.5);
        }

        .edit-preview {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px;
          background: rgba(156, 255, 0, 0.1);
          border-left: 3px solid #9cff00;
          border-radius: 6px;
        }

        .edit-indicator {
          font-size: 16px;
          color: #9cff00;
        }

        .edit-content {
          flex: 1;
          min-width: 0;
        }

        .edit-label {
          font-size: 11px;
          color: #9cff00;
          font-weight: 600;
          margin-bottom: 2px;
        }

        .edit-text {
          font-size: 13px;
          color: #d4d4d4;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .cancel-action {
          width: 24px;
          height: 24px;
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: #fff;
          cursor: pointer;
          font-size: 18px;
          line-height: 1;
          transition: all 0.2s;
        }

        .cancel-action:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .chat-background {
          position: absolute;
          inset: 0;
          opacity: 0.03;
          background-image: 
            repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(156, 255, 0, 0.1) 2px, rgba(156, 255, 0, 0.1) 4px),
            repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(102, 126, 234, 0.1) 2px, rgba(102, 126, 234, 0.1) 4px);
          pointer-events: none;
          z-index: 0;
        }

        .chat-background.telegram-dots {
          background-color: #0a0a0a;
          background-image: 
            radial-gradient(circle, rgba(156, 255, 0, 0.05) 1px, transparent 1px),
            radial-gradient(circle, rgba(102, 126, 234, 0.05) 1px, transparent 1px);
          background-size: 50px 50px, 50px 50px;
          background-position: 0 0, 25px 25px;
          opacity: 1;
        }

        .chat-background.telegram-alt {
          background-image: 
            radial-gradient(circle at 20% 50%, rgba(156, 255, 0, 0.03) 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, rgba(102, 126, 234, 0.03) 0%, transparent 50%),
            repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255, 255, 255, 0.01) 2px, rgba(255, 255, 255, 0.01) 4px);
          opacity: 1;
        }

        .messages-container {
          position: relative;
          z-index: 1;
        }
      `}</style>
    </div>
  );
};

export default EnhancedChannel;
