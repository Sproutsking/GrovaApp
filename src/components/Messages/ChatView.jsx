// components/Messages/ChatView.jsx — GRID BACKGROUND + FULL TICK LIFECYCLE
import React, { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, MoreVertical, Palette, ChevronDown } from "lucide-react";
import { supabase } from "../../services/config/supabase";
import dmMessageService from "../../services/messages/dmMessageService";
import onlineStatusService from "../../services/messages/onlineStatusService";
import conversationState from "../../services/messages/ConversationStateManager";
import backgroundService, { DOT_OVERLAY_CSS } from "../../services/messages/BackgroundService";
import MessageInput from "./MessageInput";
import mediaUrlService from "../../services/shared/mediaUrlService";

const ChatView = ({ conversation, currentUser, onBack }) => {
  const [messages,     setMessages]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [status,       setStatus]       = useState({ online: false, lastSeenText: "Offline" });
  const [typing,       setTyping]       = useState({ isTyping: false, userName: "" });
  const [showMenu,     setShowMenu]     = useState(false);
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [showJump,     setShowJump]     = useState(false);
  const [selectedBg,   setSelectedBg]   = useState(
    backgroundService.getConversationBackground(conversation.id)
  );
  const [readStatus, setReadStatus] = useState({});

  const endRef        = useRef(null);
  const containerRef  = useRef(null);
  const typingTimeout = useRef(null);
  const isAtBottom    = useRef(true);
  const unsubChannel  = useRef(null);
  const unsubDB       = useRef(null);
  const messagesRef   = useRef([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const conversationId = conversation.id;
  const otherUser      = conversation.otherUser;

  const backgrounds = backgroundService.getBackgrounds();
  const activeBg    = backgrounds[selectedBg];

  // Use the service's getBgStyle for clean resolution
  const bgStyle     = backgroundService.getBgStyle(selectedBg);
  const isDefaultBg = activeBg?.isDefault === true;

  const scrollToBottom = (behavior = "smooth") =>
    endRef.current?.scrollIntoView({ behavior });

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 80;
    isAtBottom.current = atBottom;
    setShowJump(!atBottom && messagesRef.current.length >= 2);
  };

  // No-downgrade rank system
  const RANK = { sent: 0, delivered: 1, read: 2 };

  const patchStatus = useCallback((ids, newStatus) => {
    if (!ids?.length) return;
    setReadStatus((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        if (!id) return;
        if ((RANK[newStatus] ?? -1) > (RANK[prev[id]] ?? -1)) next[id] = newStatus;
      });
      return next;
    });
  }, []); // eslint-disable-line

  const seedFromMessages = useCallback((msgs) => {
    setReadStatus((prev) => {
      const next = { ...prev };
      msgs.forEach((m) => {
        if (!m.id) return;
        const dbStatus = m.read ? "read" : m.delivered ? "delivered" : "sent";
        const cur      = RANK[prev[m.id]] ?? -1;
        if (m.sender_id !== currentUser.id) {
          if ((RANK["read"]) > cur) next[m.id] = "read";
        } else {
          if ((RANK[dbStatus] ?? 0) > cur) next[m.id] = dbStatus;
        }
      });
      return next;
    });
  }, [currentUser.id]); // eslint-disable-line

  const markOurMessagesRead = useCallback(() => {
    const ids = messagesRef.current
      .filter((m) => m.sender_id === currentUser.id && m.id)
      .map((m) => m.id);
    patchStatus(ids, "read");
  }, [currentUser.id, patchStatus]);

  useEffect(() => {
    conversationState.setActive(conversationId);
    dmMessageService.markRead(conversationId, currentUser.id);
    return () => conversationState.clearActive();
  }, [conversationId, currentUser.id]);

  useEffect(() => {
    setLoading(true);
    setReadStatus({});
    dmMessageService.loadMessages(conversationId).then((msgs) => {
      setMessages(msgs);
      setLoading(false);
      seedFromMessages(msgs);
      setTimeout(() => scrollToBottom("auto"), 50);
    });
  }, [conversationId, seedFromMessages]);

  useEffect(() => {
    const unsub = dmMessageService.subscribeToConversation(conversationId, {
      onMessage: (message) => {
        if (isAtBottom.current) setTimeout(scrollToBottom, 10);
        if (message.sender_id !== currentUser.id && message.id) {
          patchStatus([message.id], "read");
          dmMessageService.markRead(conversationId, currentUser.id);
        }
      },
      onDelivered: (tempId) => {
        const msg = messagesRef.current.find(
          (m) => m.id === tempId || m._tempId === tempId
        );
        if (msg?.id && !msg.id.startsWith("temp_")) patchStatus([msg.id], "delivered");
        patchStatus([tempId], "delivered");
      },
      onRead: (userId) => {
        if (userId !== currentUser.id) markOurMessagesRead();
      },
      onTyping: (userId, isTyping, userName) => {
        if (userId === otherUser?.id) {
          setTyping({ isTyping, userName: userName || otherUser?.full_name || "User" });
          if (isTyping && isAtBottom.current) setTimeout(scrollToBottom, 100);
        }
      },
    });
    unsubChannel.current = unsub;
    return () => { if (unsubChannel.current) unsubChannel.current(); };
  }, [conversationId, otherUser?.id, otherUser?.full_name, currentUser.id,
      patchStatus, markOurMessagesRead]);

  useEffect(() => {
    const channel = supabase
      .channel(`msg-watch:${conversationId}:${currentUser.id}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages",
          filter: `conversation_id=eq.${conversationId}` },
        ({ new: updated }) => {
          if (!updated?.id || updated.sender_id !== currentUser.id) return;
          if (updated.read)           patchStatus([updated.id], "read");
          else if (updated.delivered) patchStatus([updated.id], "delivered");
        }
      ).subscribe();
    unsubDB.current = channel;
    return () => {
      if (unsubDB.current) { supabase.removeChannel(unsubDB.current); unsubDB.current = null; }
    };
  }, [conversationId, currentUser.id, patchStatus]);

  useEffect(() => {
    const update = () => {
      const msgs = [...conversationState.getMessages(conversationId)];
      setMessages(msgs);
      seedFromMessages(msgs);
    };
    const unsub = conversationState.subscribe(update);
    update();
    return unsub;
  }, [conversationId, seedFromMessages]);

  useEffect(() => {
    onlineStatusService.fetchStatus(otherUser?.id).then(setStatus);
    const unsub = onlineStatusService.subscribe((uid, st) => {
      if (uid === otherUser?.id) setStatus(st);
    });
    return unsub;
  }, [otherUser?.id]);

  const handleTyping = () => {
    dmMessageService.sendTyping(conversationId, true,
      currentUser.fullName || currentUser.full_name || currentUser.name);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      dmMessageService.sendTyping(conversationId, false);
    }, 2500);
  };

  const handleSend = async (text) => {
    if (!text?.trim()) return;
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    dmMessageService.sendTyping(conversationId, false);
    try {
      const sent = await dmMessageService.sendMessage(conversationId, text, currentUser.id);
      if (sent?.id) patchStatus([sent.id], "sent");
      setTimeout(scrollToBottom, 10);
    } catch (err) {
      console.error("❌ [CHAT] Send failed:", err);
    }
  };

  const handleBgChange = (index) => {
    backgroundService.setConversationBackground(conversationId, index);
    setSelectedBg(index);
    setShowBgPicker(false);
  };

  const getStatus = (msg) => {
    if (msg._optimistic) return <span className="tick sent">✓</span>;
    if (msg._failed)     return <span className="tick red">✗</span>;
    const local    = readStatus[msg.id];
    const dbStatus = msg.read ? "read" : msg.delivered ? "delivered" : "sent";
    const resolved = (RANK[local] ?? -1) >= (RANK[dbStatus] ?? -1)
      ? (local || dbStatus) : dbStatus;
    if (resolved === "read")      return <span className="tick read">✓✓</span>;
    if (resolved === "delivered") return <span className="tick delivered">✓✓</span>;
    return <span className="tick sent">✓</span>;
  };

  const formatTime = (d) => {
    if (!d) return "";
    const date = new Date(d);
    const h = date.getHours() % 12 || 12;
    const m = date.getMinutes().toString().padStart(2, "0");
    return `${h}:${m} ${date.getHours() >= 12 ? "PM" : "AM"}`;
  };

  const getAvatarUrl = (user) => {
    if (!user?.avatar_id) return null;
    return mediaUrlService.getAvatarUrl(user.avatar_id, 200);
  };

  const avatarUrl = getAvatarUrl(otherUser);

  const renderContent = (content) => {
    if (!content || typeof content !== "string" ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(content.trim()))
      return <span className="chat-content-bad">[message unavailable]</span>;
    return content;
  };

  return (
    <div className="chat-root">
      {/* Header */}
      <div className="chat-head">
        <button className="chat-back" onClick={onBack}><ArrowLeft size={20} /></button>
        <div className="chat-head-info">
          <div className="chat-head-avatar">
            {avatarUrl
              ? <img src={avatarUrl} alt={otherUser?.full_name} />
              : (otherUser?.full_name || "U").charAt(0).toUpperCase()
            }
            <div className={`chat-head-dot${status.online ? " online" : ""}`} />
          </div>
          <div className="chat-head-text">
            <div className="chat-head-name">{otherUser?.full_name || "Unknown"}</div>
            <div className={`chat-head-status${status.online ? " online" : ""}`}>
              {typing.isTyping ? "typing…" : status.lastSeenText}
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
                  className={`bg-opt${selectedBg === i ? " active" : ""}`}
                  onClick={() => handleBgChange(i)}
                >
                  {/* Thumbnail preview */}
                  {b.isDefault ? (
                    <div className="bg-prev bg-prev-grid" />
                  ) : b.image ? (
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

      {/* Messages */}
      <div
        className={`chat-msgs${isDefaultBg ? " bg-default" : ""}`}
        style={bgStyle}
        ref={containerRef}
        onScroll={handleScroll}
      >
        <div className="chat-msgs-overlay" />
        <div className="chat-msgs-content">
          {loading && <div className="chat-loading"><div className="chat-spinner" /></div>}

          {!loading && messages.map((msg, idx) => {
            const isMe       = msg.sender_id === currentUser.id;
            const prev       = messages[idx - 1];
            const showTail   = !prev || prev.sender_id !== msg.sender_id;
            const showAvatar = !isMe && showTail;

            return (
              <div
                key={msg.id || msg._tempId}
                className={[
                  "chat-msg", isMe ? "me" : "them",
                  msg._optimistic ? "optimistic" : "",
                  msg._failed     ? "failed"     : "",
                ].filter(Boolean).join(" ")}
              >
                {showAvatar && (
                  <div className="chat-avatar">
                    {avatarUrl
                      ? <img src={avatarUrl} alt={otherUser?.full_name} />
                      : (otherUser?.full_name || "U").charAt(0).toUpperCase()
                    }
                  </div>
                )}
                {!showAvatar && !isMe && <div className="chat-avatar-spacer" />}
                <div className={["chat-bubble", isMe ? "me" : "them", showTail ? "has-tail" : ""].filter(Boolean).join(" ")}>
                  <div className="chat-content">{renderContent(msg.content)}</div>
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
                {avatarUrl
                  ? <img src={avatarUrl} alt={otherUser?.full_name} />
                  : (otherUser?.full_name || "U").charAt(0).toUpperCase()
                }
              </div>
              <div className="chat-bubble them typing-bubble">
                <div className="typing-dots"><span /><span /><span /></div>
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
        .chat-root { display:flex; flex-direction:column; height:100%; background:#000; overflow:hidden; }

        .chat-head {
          display:flex; align-items:center; gap:10px;
          padding:calc(env(safe-area-inset-top,0px) + 10px) 14px 10px;
          background:rgba(0,0,0,0.98);
          border-bottom:1px solid rgba(132,204,22,0.12);
          position:relative; z-index:10; flex-shrink:0;
        }
        .chat-back,.chat-more {
          width:36px; height:36px; border-radius:10px;
          background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.07);
          color:#84cc16; display:flex; align-items:center; justify-content:center;
          cursor:pointer; flex-shrink:0; transition:background 0.2s;
        }
        .chat-back:hover,.chat-more:hover { background:rgba(132,204,22,0.1); }
        .chat-head-info { display:flex; align-items:center; gap:10px; flex:1; min-width:0; }
        .chat-head-avatar {
          position:relative; width:38px; height:38px; border-radius:50%;
          background:linear-gradient(135deg,#1a1a1a,#222);
          border:2px solid rgba(132,204,22,0.25);
          display:flex; align-items:center; justify-content:center;
          font-size:15px; font-weight:700; color:#84cc16; overflow:hidden; flex-shrink:0;
        }
        .chat-head-avatar img { width:100%; height:100%; object-fit:cover; }
        .chat-head-dot { position:absolute; bottom:0; right:0; width:10px; height:10px; border-radius:50%; border:2px solid #000; background:#333; }
        .chat-head-dot.online { background:#22c55e; }
        .chat-head-text { flex:1; min-width:0; }
        .chat-head-name { font-size:14px; font-weight:700; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .chat-head-status { font-size:11px; color:#555; transition:color 0.3s; }
        .chat-head-status.online { color:#22c55e; }

        .chat-overlay { position:fixed; inset:0; z-index:20; }
        .chat-menu {
          position:absolute; top:54px; right:14px;
          background:#111; border:1px solid rgba(132,204,22,0.2);
          border-radius:12px; padding:6px; z-index:30; min-width:160px;
        }
        .chat-menu button {
          display:flex; align-items:center; gap:8px; width:100%;
          padding:9px 12px; background:transparent; border:none;
          border-radius:8px; color:#ccc; font-size:13px; cursor:pointer;
        }
        .chat-menu button:hover { background:rgba(255,255,255,0.05); }

        /* Background picker */
        .bg-picker {
          position:absolute; top:54px; right:14px;
          background:#111; border:1px solid rgba(132,204,22,0.2);
          border-radius:14px; padding:8px;
          display:flex; flex-direction:column; gap:4px;
          z-index:30; max-height:70vh; overflow-y:auto;
          width:200px;
        }
        .bg-picker::-webkit-scrollbar { width:3px; }
        .bg-picker::-webkit-scrollbar-thumb { background:rgba(132,204,22,0.2); border-radius:2px; }
        .bg-opt {
          display:flex; align-items:center; gap:10px; padding:7px 10px;
          background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06);
          border-radius:8px; color:#ccc; font-size:13px; cursor:pointer;
          text-align:left; transition:background 0.15s;
        }
        .bg-opt:hover { background:rgba(255,255,255,0.06); }
        .bg-opt.active { background:rgba(132,204,22,0.12); border-color:rgba(132,204,22,0.35); color:#84cc16; }
        .bg-opt img { width:32px; height:32px; border-radius:6px; object-fit:cover; flex-shrink:0; }
        .bg-prev { width:32px; height:32px; border-radius:6px; flex-shrink:0; }

        /* Grid thumbnail in picker */
        .bg-prev-grid {
          background:
            repeating-linear-gradient(90deg, rgba(132,204,22,0.25) 0px, rgba(132,204,22,0.25) 1px, transparent 1px, transparent 8px),
            repeating-linear-gradient(0deg,  rgba(132,204,22,0.25) 0px, rgba(132,204,22,0.25) 1px, transparent 1px, transparent 8px),
            #000;
          border:1px solid rgba(132,204,22,0.3);
        }

        /* Messages scroll area */
        .chat-msgs { flex:1; overflow-y:auto; position:relative; -webkit-overflow-scrolling:touch; }
        .chat-msgs::-webkit-scrollbar { width:3px; }
        .chat-msgs::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.08); border-radius:2px; }

        /* ── DEFAULT GRID BACKGROUND — dot overlay via ::before ── */
        ${DOT_OVERLAY_CSS}

        /* Darkening overlay on top of all backgrounds */
        .chat-msgs-overlay {
          position:absolute; inset:0;
          background:rgba(0,0,0,0.22);
          pointer-events:none; z-index:0;
        }
        /* Default bg needs lighter overlay since it's already dark */
        .chat-msgs.bg-default .chat-msgs-overlay { background:rgba(0,0,0,0.05); }

        .chat-msgs-content { position:relative; z-index:1; padding:10px 14px 16px; display:flex; flex-direction:column; gap:2px; }

        .jump-btn {
          position:absolute; bottom:16px; right:16px; z-index:5;
          width:38px; height:38px; border-radius:50%;
          background:rgba(10,10,10,0.95); border:1px solid rgba(132,204,22,0.4);
          color:#84cc16; display:flex; align-items:center; justify-content:center;
          cursor:pointer; box-shadow:0 4px 16px rgba(0,0,0,0.6);
        }

        .chat-loading { display:flex; justify-content:center; padding:40px; }
        .chat-spinner { width:22px; height:22px; border:2px solid rgba(132,204,22,0.15); border-top-color:#84cc16; border-radius:50%; animation:chatSpin 0.7s linear infinite; }
        @keyframes chatSpin { to{transform:rotate(360deg)} }

        .chat-msg { display:flex; align-items:flex-end; gap:8px; animation:msgIn 0.18s ease-out both; }
        .chat-msg.me { flex-direction:row-reverse; }
        .chat-msg.optimistic { opacity:0.65; }
        .chat-msg.failed { opacity:0.45; }
        .chat-msg.typing-indicator { animation:fadeIn 0.25s ease-out; }
        @keyframes msgIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }

        .chat-avatar { width:34px; height:34px; border-radius:50%; background:linear-gradient(135deg,#1a1a1a,#222); border:2px solid rgba(132,204,22,0.18); display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700; color:#84cc16; overflow:hidden; flex-shrink:0; }
        .chat-avatar img { width:100%; height:100%; object-fit:cover; }
        .chat-avatar-spacer { width:34px; flex-shrink:0; }

        .chat-bubble { max-width:72%; padding:8px 12px; border-radius:16px; position:relative; word-break:break-word; }
        .chat-bubble.them { background:rgba(18,18,18,0.97); border:1px solid rgba(255,255,255,0.07); border-bottom-left-radius:4px; }
        .chat-bubble.me { background:linear-gradient(135deg,rgba(132,204,22,0.2),rgba(101,163,13,0.14)); border:1px solid rgba(132,204,22,0.25); border-bottom-right-radius:4px; }
        .chat-bubble.them.has-tail::before { content:''; position:absolute; bottom:-1px; left:-7px; border:solid transparent; border-width:0 0 10px 8px; border-bottom-color:rgba(18,18,18,0.97); }
        .chat-bubble.me.has-tail::before { content:''; position:absolute; bottom:-0.5px; right:-7.5px; border:solid transparent; border-width:0 0 10px 8px; border-bottom-color:rgba(132,204,22,0.17); transform:scaleX(-1); }

        .chat-content { font-size:14px; color:#f0f0f0; line-height:1.5; }
        .chat-content-bad { font-size:12px; color:#444; font-style:italic; }
        .chat-meta { display:flex; align-items:center; gap:4px; margin-top:3px; }
        .chat-msg.me .chat-meta { justify-content:flex-end; }
        .chat-time { font-size:10px; color:#555; }

        .tick { font-size:11px; font-weight:700; display:inline-block; transition:color 0.25s ease; }
        .tick.sent      { color:#444; }
        .tick.delivered { color:#888; }
        .tick.read      { color:#22c55e; }
        .tick.red       { color:#ef4444; }

        .typing-bubble { padding:10px 14px; }
        .typing-dots { display:flex; gap:4px; }
        .typing-dots span { width:6px; height:6px; border-radius:50%; background:#555; animation:tdBounce 1.2s ease infinite; }
        .typing-dots span:nth-child(2) { animation-delay:0.15s; }
        .typing-dots span:nth-child(3) { animation-delay:0.30s; }
        @keyframes tdBounce { 0%,60%,100%{transform:translateY(0);opacity:0.4} 30%{transform:translateY(-5px);opacity:1} }
      `}</style>
    </div>
  );
};

export default ChatView;