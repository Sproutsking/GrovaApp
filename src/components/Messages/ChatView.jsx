// components/Messages/ChatView.jsx - WITH GEOMETRIC TAILS ⚡
import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, MoreVertical, Palette, ChevronDown } from "lucide-react";
import dmMessageService from "../../services/messages/dmMessageService";
import onlineStatusService from "../../services/messages/onlineStatusService";
import conversationState from "../../services/messages/ConversationStateManager";
import backgroundService from "../../services/messages/BackgroundService";
import MessageInput from "./MessageInput";
import mediaUrlService from "../../services/shared/mediaUrlService";

const ChatView = ({ conversation, currentUser, onBack }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ online: false, lastSeenText: "Offline" });
  const [typing, setTyping] = useState({ isTyping: false, userName: "" });
  const [showMenu, setShowMenu] = useState(false);
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [selectedBg, setSelectedBg] = useState(
    backgroundService.getConversationBackground(conversation.id)
  );

  const endRef = useRef(null);
  const containerRef = useRef(null);
  const typingTimeout = useRef(null);
  const isAtBottom = useRef(true);
  const unsubscribeChannel = useRef(null);

  const conversationId = conversation.id;
  const otherUser = conversation.otherUser;

  const backgrounds = backgroundService.getBackgrounds();
  const bg = backgrounds[selectedBg];
  const bgStyle = bg?.image
    ? { backgroundImage: `url(${bg.image})`, backgroundSize: "cover" }
    : { background: bg?.value || "#000" };

  const scrollToBottom = (behavior = "smooth") => {
    endRef.current?.scrollIntoView({ behavior });
  };

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 60;
    isAtBottom.current = atBottom;
    setShowJump(!atBottom && messages.length >= 2);
  };

  // Set conversation as active
  useEffect(() => {
    console.log("🎯 [CHAT] Setting conversation active:", conversationId);
    conversationState.setActive(conversationId);
    dmMessageService.markRead(conversationId, currentUser.id);

    return () => {
      console.log("🎯 [CHAT] Clearing conversation active");
      conversationState.clearActive();
    };
  }, [conversationId, currentUser.id]);

  // Load initial messages
  useEffect(() => {
    setLoading(true);

    dmMessageService.loadMessages(conversationId).then((msgs) => {
      setMessages(msgs);
      setLoading(false);
      setTimeout(() => scrollToBottom("auto"), 50);
    });
  }, [conversationId]);

  // ✅ SUBSCRIBE TO REALTIME CONVERSATION CHANNEL
  useEffect(() => {
    console.log("🔌 [CHAT] Subscribing to conversation channel");

    const unsubscribe = dmMessageService.subscribeToConversation(conversationId, {
      onMessage: (message) => {
        console.log("📨 [CHAT] Message received via broadcast");
        
        // Auto-scroll if at bottom
        if (isAtBottom.current) {
          setTimeout(scrollToBottom, 10);
        }
      },
      onTyping: (userId, isTyping, userName) => {
        if (userId === otherUser?.id) {
          setTyping({ isTyping, userName: userName || otherUser?.full_name || "User" });
          
          if (isTyping && isAtBottom.current) {
            setTimeout(scrollToBottom, 100);
          }
        }
      },
      onRead: (userId) => {
        console.log("👁️ [CHAT] Read receipt received");
      },
    });

    unsubscribeChannel.current = unsubscribe;

    return () => {
      if (unsubscribeChannel.current) {
        unsubscribeChannel.current();
      }
    };
  }, [conversationId, otherUser?.id, otherUser?.full_name]);

  // ✅ SUBSCRIBE TO STATE CHANGES (FOR UI UPDATES)
  useEffect(() => {
    const updateMessages = () => {
      const msgs = conversationState.getMessages(conversationId);
      console.log("🔄 [CHAT] State updated:", msgs.length, "messages");
      setMessages([...msgs]); // Force new array reference
    };

    const unsub = conversationState.subscribe(updateMessages);
    
    // Initial load from state
    updateMessages();

    return unsub;
  }, [conversationId]);

  // Subscribe to online status
  useEffect(() => {
    onlineStatusService.fetchStatus(otherUser?.id).then(setStatus);
    const unsub = onlineStatusService.subscribe((uid, st) => {
      if (uid === otherUser?.id) setStatus(st);
    });

    return unsub;
  }, [otherUser?.id]);

  const handleTyping = () => {
    dmMessageService.sendTyping(
      conversationId,
      true,
      currentUser.fullName || currentUser.name
    );
    
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      dmMessageService.sendTyping(conversationId, false);
    }, 2500);
  };

  const handleSend = async (text) => {
    if (!text?.trim()) return;
    
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    dmMessageService.sendTyping(conversationId, false);

    console.log("🚀 [CHAT] Sending message");

    try {
      await dmMessageService.sendMessage(conversationId, currentUser.id, text);
      
      // Auto-scroll after send
      setTimeout(scrollToBottom, 10);
    } catch (error) {
      console.error("❌ [CHAT] Send failed:", error);
    }
  };

  const handleBgChange = (index) => {
    backgroundService.setConversationBackground(conversationId, index);
    setSelectedBg(index);
    setShowBgPicker(false);
  };

  const getStatus = (msg) => {
    if (msg._optimistic || msg._failed === undefined) {
      return <span className="tick gray">✓</span>;
    }
    if (msg._failed) {
      return <span className="tick red">✗</span>;
    }
    const st = conversationState.getMessageStatus(msg.id);
    if (msg.read || st === "read") return <span className="tick green">✓✓</span>;
    if (msg.delivered || st === "delivered") return <span className="tick gray">✓✓</span>;
    return <span className="tick gray">✓</span>;
  };

  const formatTime = (d) => {
    if (!d) return "";
    const date = new Date(d);
    const h = date.getHours() % 12 || 12;
    const m = date.getMinutes().toString().padStart(2, "0");
    return `${h}:${m} ${date.getHours() >= 12 ? "PM" : "AM"}`;
  };

  const getAvatar = (user) => {
    if (!user) return null;
    if (user.avatar_id) return mediaUrlService.getAvatarUrl(user.avatar_id, 200);
    return null;
  };

  const avatarUrl = getAvatar(otherUser);

  return (
    <div className="chat-root">
      <div className="chat-head">
        <button className="chat-back" onClick={onBack}>
          <ArrowLeft size={20} />
        </button>

        <div className="chat-head-info">
          <div className="chat-head-avatar">
            {avatarUrl ? (
              <img src={avatarUrl} alt={otherUser?.full_name} />
            ) : (
              (otherUser?.full_name || "U").charAt(0).toUpperCase()
            )}
          </div>
          <div className="chat-head-text">
            <div className="chat-head-name">{otherUser?.full_name || "Unknown"}</div>
            <div className={`chat-head-status ${status.online ? "online" : ""}`}>
              {typing.isTyping ? "typing..." : status.lastSeenText}
            </div>
          </div>
        </div>

        <button className="chat-more" onClick={() => setShowMenu(!showMenu)}>
          <MoreVertical size={20} />
        </button>

        {showMenu && (
          <>
            <div className="chat-overlay" onClick={() => setShowMenu(false)} />
            <div className="chat-menu">
              <button onClick={() => { setShowBgPicker(true); setShowMenu(false); }}>
                <Palette size={16} /> Change Background
              </button>
            </div>
          </>
        )}

        {showBgPicker && (
          <>
            <div className="chat-overlay" onClick={() => setShowBgPicker(false)} />
            <div className="bg-picker">
              {backgrounds.map((b, i) => (
                <button
                  key={i}
                  className={`bg-opt ${selectedBg === i ? "active" : ""}`}
                  onClick={() => handleBgChange(i)}
                >
                  {b.image ? (
                    <img src={b.image} alt={b.name} />
                  ) : (
                    <div className="bg-prev" style={{ background: b.value }} />
                  )}
                  <span>{b.name}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="chat-msgs" style={bgStyle} ref={containerRef} onScroll={handleScroll}>
        <div className="chat-msgs-overlay" />
        <div className="chat-msgs-content">
          {loading && (
            <div className="chat-loading">
              <div className="chat-spinner" />
            </div>
          )}

          {!loading &&
            messages.map((msg, idx) => {
              const isMe = msg.sender_id === currentUser.id;
              const prev = messages[idx - 1];
              const showTail = !prev || prev.sender_id !== msg.sender_id;
              const showAvatar = !isMe && showTail;

              return (
                <div 
                  key={msg.id || msg._tempId} 
                  className={`chat-msg ${isMe ? "me" : "them"} ${msg._optimistic ? "optimistic" : ""} ${msg._failed ? "failed" : ""}`}
                >
                  {showAvatar && (
                    <div className="chat-avatar">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={otherUser?.full_name} />
                      ) : (
                        (otherUser?.full_name || "U").charAt(0).toUpperCase()
                      )}
                    </div>
                  )}
                  {!showAvatar && !isMe && <div className="chat-avatar-spacer" />}

                  <div className={`chat-bubble ${isMe ? "me" : "them"} ${showTail ? 'has-tail' : ''}`}>
                    <div className="chat-content">{msg.content}</div>
                    <div className="chat-meta">
                      <span className="chat-time">{formatTime(msg.created_at)}</span>
                      {isMe && <span className="chat-status">{getStatus(msg)}</span>}
                    </div>
                  </div>
                </div>
              );
            })}

          {typing.isTyping && (
            <div className="chat-msg them typing-indicator">
              <div className="chat-avatar">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={otherUser?.full_name} />
                ) : (
                  (otherUser?.full_name || "U").charAt(0).toUpperCase()
                )}
              </div>
              <div className="chat-bubble them typing-bubble">
                <div className="typing-dots">
                  <span /><span /><span />
                </div>
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>

        {showJump && (
          <button className="jump-btn" onClick={() => scrollToBottom()}>
            <ChevronDown size={18} />
          </button>
        )}
      </div>

      <MessageInput onSend={handleSend} onTyping={handleTyping} />

      <style>{`
        .chat-root { display: flex; flex-direction: column; height: 100%; background: #000; }
        .chat-head { display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: rgba(0, 0, 0, 0.98); border-bottom: 1px solid rgba(132, 204, 22, 0.15); position: relative; }
        .chat-back, .chat-more { width: 32px; height: 32px; border-radius: 50%; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.08); color: #84cc16; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .chat-head-info { display: flex; align-items: center; gap: 8px; flex: 1; }
        .chat-head-avatar { width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg, #1a1a1a, #222); border: 2px solid rgba(132, 204, 22, 0.3); display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: #84cc16; overflow: hidden; }
        .chat-head-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .chat-head-name { font-size: 14px; font-weight: 700; color: #fff; }
        .chat-head-status { font-size: 11px; color: #555; transition: color 0.3s; }
        .chat-head-status.online { color: #22c55e; }
        .chat-overlay { position: fixed; inset: 0; z-index: 998; }
        .chat-menu { position: absolute; top: 50px; right: 12px; background: #1a1a1a; border: 1px solid rgba(132, 204, 22, 0.25); border-radius: 10px; padding: 6px; z-index: 999; }
        .chat-menu button { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 10px; background: transparent; border: none; border-radius: 6px; color: #ccc; font-size: 13px; cursor: pointer; }
        .bg-picker { position: absolute; top: 50px; right: 12px; background: #1a1a1a; border: 1px solid rgba(132, 204, 22, 0.25); border-radius: 10px; padding: 8px; display: flex; flex-direction: column; gap: 4px; z-index: 999; max-height: 400px; overflow-y: auto; }
        .bg-opt { display: flex; align-items: center; gap: 10px; padding: 6px 10px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 6px; color: #ccc; font-size: 13px; cursor: pointer; }
        .bg-opt.active { background: rgba(132, 204, 22, 0.15); border-color: rgba(132, 204, 22, 0.4); color: #84cc16; }
        .bg-opt img, .bg-prev { width: 32px; height: 32px; border-radius: 6px; object-fit: cover; }
        .chat-msgs { flex: 1; overflow-y: auto; position: relative; }
        .chat-msgs-overlay { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.3); pointer-events: none; }
        .chat-msgs-content { position: relative; z-index: 1; padding: 8px 12px; display: flex; flex-direction: column; gap: 2px; }
        .jump-btn { position: fixed; bottom: 80px; right: 20px; z-index: 5; width: 40px; height: 40px; border-radius: 50%; background: #1a1a1a; border: 1.5px solid rgba(132, 204, 22, 0.45); color: #84cc16; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .chat-loading { display: flex; justify-content: center; padding: 20px; }
        .chat-spinner { width: 20px; height: 20px; border: 2px solid rgba(132, 204, 22, 0.2); border-top-color: #84cc16; border-radius: 50%; animation: spin 0.6s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .chat-msg { display: flex; align-items: flex-end; gap: 8px; animation: slideIn 0.2s ease-out; }
        .chat-msg.me { flex-direction: row-reverse; }
        .chat-msg.optimistic { opacity: 0.7; }
        .chat-msg.failed { opacity: 0.5; }
        .chat-msg.typing-indicator { animation: fadeIn 0.3s ease-out; }
        @keyframes slideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .chat-avatar { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #1a1a1a, #222); border: 2px solid rgba(132, 204, 22, 0.2); display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: #84cc16; overflow: hidden; flex-shrink: 0; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3); }
        .chat-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .chat-avatar-spacer { width: 36px; flex-shrink: 0; }
        .chat-bubble { max-width: 70%; padding: 8px 12px; border-radius: 16px; backdrop-filter: blur(10px); position: relative; }
        .chat-bubble.them { background: rgba(26, 26, 26, 0.95); border: 1px solid rgba(255, 255, 255, 0.1); border-bottom-left-radius: 4px; }
        .chat-bubble.me { background: linear-gradient(135deg, rgba(132, 204, 22, 0.18), rgba(132, 204, 22, 0.12)); border: 1px solid rgba(132, 204, 22, 0.25); border-bottom-right-radius: 4px; }

        /* GEOMETRIC TAILS ⚡ */
        .chat-bubble.them.has-tail { border-bottom-left-radius: 3px; }
        .chat-bubble.them.has-tail::before {
          content: '';
          position: absolute;
          bottom: -1px;
          left: -7px;
          width: 0;
          height: 0;
          border-style: solid;
          border-width: 0 0 10px 8px;
          border-color: transparent transparent rgba(26, 26, 26, 0.95) transparent;
        }
        .chat-bubble.them.has-tail::after {
          content: '';
          position: absolute;
          bottom: -1px;
          left: -8px;
          width: 0;
          height: 0;
          border-style: solid;
          border-width: 0 0 11px 9px;
          border-color: transparent transparent rgba(255, 255, 255, 0.1) transparent;
          z-index: -1;
        }
        .chat-bubble.me.has-tail { border-bottom-right-radius: 3px; }
        .chat-bubble.me.has-tail::before {
          content: '';
          position: absolute;
          bottom: -0.5px;
          right: -7.5px;
          width: 0;
          height: 0;
          border-style: solid;
          border-width: 0 0 10px 8px;
          border-color: transparent transparent rgba(132, 204, 22, 0.15) transparent;
          transform: scaleX(-1);
        }
        .chat-bubble.me.has-tail::after {
          content: '';
          position: absolute;
          bottom: -0.5px;
          right: -8.5px;
          width: 0;
          height: 0;
          border-style: solid;
          border-width: 0 0 11px 9px;
          border-color: transparent transparent rgba(132, 204, 22, 0.25) transparent;
          z-index: -1;
          transform: scaleX(-1);
        }

        .chat-content { font-size: 14px; color: #fff; line-height: 1.5; word-break: break-word; }
        .chat-meta { display: flex; align-items: center; gap: 4px; margin-top: 3px; }
        .chat-msg.me .chat-meta { justify-content: flex-end; }
        .chat-time { font-size: 10px; color: #666; }
        .tick { font-size: 10px; font-weight: 600; }
        .tick.gray { color: #666; }
        .tick.green { color: #22c55e; }
        .tick.red { color: #ef4444; }
        .typing-bubble { padding: 10px 14px; }
        .typing-dots { display: flex; gap: 4px; }
        .typing-dots span { width: 6px; height: 6px; border-radius: 50%; background: #666; animation: bounce 1.2s ease infinite; }
        .typing-dots span:nth-child(2) { animation-delay: 0.15s; }
        .typing-dots span:nth-child(3) { animation-delay: 0.3s; }
        @keyframes bounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-4px); opacity: 1; } }

        @media (max-width: 768px) {
          .chat-avatar { width: 40px; height: 40px; }
          .chat-avatar-spacer { width: 40px; }
          .chat-bubble { max-width: 80%; padding: 7px 11px; border-radius: 14px; }
          .chat-bubble.them.has-tail::before { border-width: 0 0 9px 7px; left: -6px; }
          .chat-bubble.them.has-tail::after { border-width: 0 0 10px 8px; left: -7px; }
          .chat-bubble.me.has-tail::before { border-width: 0 0 9px 7px; right: -6.5px; bottom: -0.5px; }
          .chat-bubble.me.has-tail::after { border-width: 0 0 10px 8px; right: -7.5px; bottom: -0.5px; }
        }
      `}</style>
    </div>
  );
};

export default ChatView;