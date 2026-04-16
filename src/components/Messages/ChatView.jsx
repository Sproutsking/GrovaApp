// components/Messages/ChatView.jsx — NOVA CHAT v6 CRASH-PROOF
// ============================================================================
// v6 FIXES vs v5:
//  [NULL-GUARD]   ChatView outer wrapper validates EVERY required field before
//                 passing to ChatViewInner. Returns null on ANY missing field.
//                 This prevents "Cannot read properties of undefined (reading 'id')"
//                 that occurred when conversation prop arrived momentarily incomplete.
//  [KEY-PROP]     Parent should pass key={conversation.id} to force full remount
//                 when switching conversations — prevents stale hook state.
//  [STABLE-DEPS]  backgroundService.getConversationBackground called inside
//                 useState initializer safely — convId is guaranteed string here.
//  [REPLY]        All reply features preserved from v5.
//  [CSS-EXPORT]   CV_CSS exported for GroupChatView reuse.
// ============================================================================

import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import { supabase } from "../../services/config/supabase";
import dmMessageService from "../../services/messages/dmMessageService";
import onlineStatusService from "../../services/messages/onlineStatusService";
import conversationState from "../../services/messages/ConversationStateManager";
import backgroundService, {
  DOT_OVERLAY_CSS,
} from "../../services/messages/BackgroundService";
import mediaUrlService from "../../services/shared/mediaUrlService";

/* ─── ICONS ─── */
const Ic = {
  Back: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
    </svg>
  ),
  More: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="12" cy="19" r="1.2" />
    </svg>
  ),
  Phone: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
    </svg>
  ),
  Video: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  ),
  Reply: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 00-4-4H4" />
    </svg>
  ),
  Copy: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  ),
  Delete: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M9 6V4h6v2" />
    </svg>
  ),
  Palette: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13.5" cy="6.5" r=".5" /><circle cx="17.5" cy="10.5" r=".5" />
      <circle cx="8.5" cy="7.5" r=".5" /><circle cx="6.5" cy="12.5" r=".5" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 011.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
    </svg>
  ),
  Down: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  Close: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Info: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  Send: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  ),
};

const RANK = { sent: 0, delivered: 1, read: 2 };

// ─── Context Menu ──────────────────────────────────────────────────────────
const ContextMenu = memo(({ msg, pos, isMe, onReply, onCopy, onDelete, onClose }) => {
  const menuRef = useRef(null);
  const [style, setStyle] = useState({ opacity: 0, left: pos.x, top: pos.y });

  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let { x, y } = pos;
    if (x + rect.width > window.innerWidth - 16) x = window.innerWidth - rect.width - 16;
    if (x < 16) x = 16;
    if (y + rect.height > window.innerHeight - 16) y = y - rect.height - 8;
    if (y < 16) y = 16;
    setStyle({ left: x, top: y, opacity: 1 });
  }, [pos]);

  useEffect(() => {
    const h = (e) => { if (!menuRef.current?.contains(e.target)) onClose(); };
    const tid = setTimeout(() => { document.addEventListener("pointerdown", h); }, 50);
    return () => { clearTimeout(tid); document.removeEventListener("pointerdown", h); };
  }, [onClose]);

  const items = [
    { label: "Reply",  icon: <Ic.Reply />,  action: onReply,  color: "#84cc16" },
    { label: "Copy",   icon: <Ic.Copy />,   action: onCopy,   color: "#ccc" },
    isMe && { label: "Info",   icon: <Ic.Info />,   action: () => {}, color: "#60a5fa" },
    isMe && { label: "Delete", icon: <Ic.Delete />, action: onDelete, color: "#ef4444" },
  ].filter(Boolean);

  return (
    <div className="cv-ctx-overlay" onPointerDown={(e) => { e.stopPropagation(); onClose(); }}>
      <div ref={menuRef} className="cv-ctx-menu" style={style} onPointerDown={(e) => e.stopPropagation()}>
        {items.map(({ label, icon, action, color }) => (
          <button key={label} className="cv-ctx-item" style={{ color }}
            onClick={(e) => { e.stopPropagation(); action?.(); onClose(); }}>
            <span className="cv-ctx-icon">{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
});
ContextMenu.displayName = "ContextMenu";

// ─── Reply Quote ────────────────────────────────────────────────────────────
const ReplyQuote = memo(({ replyToId, messages, onScrollTo }) => {
  const original = messages.find((m) => m.id === replyToId);
  if (!original) return null;
  return (
    <div className="cv-rq" onClick={() => onScrollTo?.(replyToId)}>
      <div className="cv-rq-bar" />
      <div className="cv-rq-text">{original.content?.slice(0, 80) || "Message"}</div>
    </div>
  );
});
ReplyQuote.displayName = "ReplyQuote";

// ─── Message Row ─────────────────────────────────────────────────────────────
const MessageRow = memo(({
  msg, isMe, showAv, avatarUrl, otherName, messages,
  onReply, onScrollTo, getTickStatus, fmtTime, currentUserId,
}) => {
  const [swipeX,  setSwipeX]  = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [ctxOpen, setCtxOpen] = useState(false);
  const [ctxPos,  setCtxPos]  = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);
  const [rAnim,   setRAnim]   = useState(false);
  const touchX  = useRef(null);
  const touchY  = useRef(null);
  const lpTimer = useRef(null);
  const rowRef  = useRef(null);
  const TH = 60;

  const openCtx = (x, y) => { setCtxPos({ x, y }); setCtxOpen(true); };

  const onTouchStart = (e) => {
    touchX.current = e.touches[0].clientX;
    touchY.current = e.touches[0].clientY;
    lpTimer.current = setTimeout(() => {
      const r = rowRef.current?.getBoundingClientRect() || {};
      openCtx(r.left + r.width / 2 - 90, r.top - 8);
    }, 500);
  };
  const onTouchMove = (e) => {
    const dx = e.touches[0].clientX - (touchX.current || 0);
    const dy = Math.abs(e.touches[0].clientY - (touchY.current || 0));
    if (dy > 12) { clearTimeout(lpTimer.current); return; }
    if (Math.abs(dx) > 8) {
      clearTimeout(lpTimer.current);
      setSwiping(true);
      setSwipeX(Math.max(-90, Math.min(90, dx)));
    }
  };
  const onTouchEnd = () => {
    clearTimeout(lpTimer.current);
    if (swiping) {
      if (Math.abs(swipeX) >= TH) { setRAnim(true); setTimeout(() => setRAnim(false), 400); onReply?.(msg); }
      setSwiping(false); setSwipeX(0);
    }
  };
  const onContextMenu = (e) => { e.preventDefault(); openCtx(e.clientX, e.clientY); };
  const handleCopy   = () => navigator.clipboard?.writeText(msg.content || "").catch(() => {});
  const handleDelete = async () => {
    if (!isMe) return;
    try { await supabase.from("messages").delete().eq("id", msg.id); } catch (e) { console.warn(e); }
  };

  const renderContent = (c) => {
    if (!c || typeof c !== "string" ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c.trim()))
      return <span className="cv-bad">[message unavailable]</span>;
    if (c.startsWith("↩ Replying to status:")) {
      const match = c.match(/↩ Replying to status: "(.+)"/);
      return (
        <span>
          <span style={{ color: "#84cc16", fontSize: 11, display: "block", marginBottom: 3 }}>↩ Status reply</span>
          {match ? <em style={{ opacity: 0.7 }}>"{match[1]}"</em> : c}
        </span>
      );
    }
    return c;
  };

  return (
    <div
      ref={rowRef}
      className={["cv-msg", isMe ? "cv-me" : "cv-them", msg._optimistic ? "cv-opt" : "", msg._failed ? "cv-fail" : "", rAnim ? "cv-rpulse" : ""].filter(Boolean).join(" ")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onContextMenu={onContextMenu}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      data-msg-id={msg.id}
    >
      {swiping && (
        <div className="cv-swipe-ind" style={{
          opacity: Math.min(1, Math.abs(swipeX) / TH),
          transform: `scale(${0.6 + 0.4 * Math.min(1, Math.abs(swipeX) / TH)})`,
          [isMe ? "right" : "left"]: "calc(100% + 10px)",
        }}><Ic.Reply /></div>
      )}

      {hovered && !swiping && !ctxOpen && (
        <button
          className={`cv-desktop-reply${isMe ? " cv-dr-left" : " cv-dr-right"}`}
          onClick={() => onReply?.(msg)} title="Reply">
          <Ic.Reply />
        </button>
      )}

      {!isMe && (showAv ? (
        <div className="cv-avatar">
          {avatarUrl ? <img src={avatarUrl} alt={otherName} /> : (otherName || "U").charAt(0)}
        </div>
      ) : <div className="cv-avatar-sp" />)}

      <div
        className={["cv-bubble", isMe ? "cv-bme" : "cv-bthem", showAv && !isMe ? "cv-tail-l" : "", showAv && isMe ? "cv-tail-r" : ""].filter(Boolean).join(" ")}
        style={{
          transform: swiping ? `translateX(${swipeX * 0.5}px)` : "translateX(0)",
          transition: swiping ? "none" : "transform 0.25s cubic-bezier(.34,1.56,.64,1)",
        }}
      >
        {msg.reply_to_id && (
          <ReplyQuote replyToId={msg.reply_to_id} messages={messages} onScrollTo={onScrollTo} />
        )}
        <div className="cv-content">{renderContent(msg.content)}</div>
        <div className={`cv-meta${isMe ? " cv-meta-me" : ""}`}>
          <span className="cv-time">{fmtTime(msg.created_at)}</span>
          {isMe && <span className="cv-st">{getTickStatus(msg)}</span>}
        </div>
      </div>

      {ctxOpen && (
        <ContextMenu
          msg={msg} pos={ctxPos} isMe={isMe}
          onReply={() => onReply?.(msg)}
          onCopy={handleCopy}
          onDelete={handleDelete}
          onClose={() => setCtxOpen(false)}
        />
      )}
    </div>
  );
});
MessageRow.displayName = "MessageRow";

// ─── Reply Bar ────────────────────────────────────────────────────────────────
const ReplyBar = memo(({ replyTo, onCancel }) => {
  if (!replyTo) return null;
  return (
    <div className="cv-reply-bar">
      <div className="cv-rb-line" />
      <div className="cv-rb-content">
        <div className="cv-rb-label">Replying to</div>
        <div className="cv-rb-text">{replyTo.content?.slice(0, 80) || "..."}</div>
      </div>
      <button className="cv-rb-x" onClick={onCancel}><Ic.Close /></button>
    </div>
  );
});
ReplyBar.displayName = "ReplyBar";

// ─── Message Input ────────────────────────────────────────────────────────────
const MessageInput = memo(({ onSend, onTyping, replyTo, onCancelReply }) => {
  const [val, setVal] = useState("");
  const taRef = useRef(null);
  const tyTO  = useRef(null);

  useEffect(() => { if (replyTo) taRef.current?.focus(); }, [replyTo]);

  const onChange = (e) => {
    setVal(e.target.value);
    clearTimeout(tyTO.current);
    onTyping?.();
    tyTO.current = setTimeout(() => {}, 2500);
    const ta = taRef.current;
    if (ta) { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 120) + "px"; }
  };

  const submit = () => {
    const t = val.trim();
    if (!t) return;
    onSend(t, replyTo?.id || null);
    setVal("");
    if (taRef.current) taRef.current.style.height = "auto";
    onCancelReply?.();
  };

  return (
    <div className="cv-input-root">
      <ReplyBar replyTo={replyTo} onCancel={onCancelReply} />
      <div className="cv-input-bar">
        <textarea
          ref={taRef} className="cv-input-ta" value={val} onChange={onChange}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), submit())}
          placeholder="Message…" rows={1} maxLength={4000}
        />
        <button className="cv-send-btn" onClick={submit} disabled={!val.trim()} aria-label="Send">
          <Ic.Send />
        </button>
      </div>
    </div>
  );
});
MessageInput.displayName = "MessageInput";

// ════════════════════════════════════════════════════════════════════════════
// ChatView — OUTER WRAPPER (null guard only — NO hooks here)
//
// This is the component exported and used by DMMessagesView.
// It validates every required field before rendering ChatViewInner.
// React hooks cannot be called conditionally, so the guard MUST live here
// in a separate component with no hooks of its own.
// ════════════════════════════════════════════════════════════════════════════
const ChatView = ({ conversation, currentUser, onBack, onStartCall }) => {
  // Full validation — every field that ChatViewInner accesses must be present
  if (!conversation) return null;
  if (typeof conversation !== "object") return null;
  if (typeof conversation.id !== "string" || conversation.id.length === 0) return null;
  if (!conversation.otherUser) return null;
  if (typeof conversation.otherUser !== "object") return null;
  if (typeof conversation.otherUser.id !== "string" || conversation.otherUser.id.length === 0) return null;
  if (!currentUser?.id) return null;

  return (
    <ChatViewInner
      conversation={conversation}
      currentUser={currentUser}
      onBack={onBack}
      onStartCall={onStartCall}
    />
  );
};

// ─── ChatViewInner — all hooks live here ─────────────────────────────────────
const ChatViewInner = ({ conversation, currentUser, onBack, onStartCall }) => {
  const [messages,     setMessages]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [status,       setStatus]       = useState({ online: false, lastSeenText: "Offline" });
  const [typing,       setTyping]       = useState({ isTyping: false, userName: "" });
  const [showMenu,     setShowMenu]     = useState(false);
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [showJump,     setShowJump]     = useState(false);
  const [selectedBg,   setSelectedBg]   = useState(() =>
    backgroundService.getConversationBackground(conversation.id)
  );
  const [readStatus,   setReadStatus]   = useState({});
  const [replyTo,      setReplyTo]      = useState(null);

  const endRef       = useRef(null);
  const containerRef = useRef(null);
  const tyTO         = useRef(null);
  const isAtBottom   = useRef(true);
  const unsubCh      = useRef(null);
  const unsubDB      = useRef(null);
  const msgsRef      = useRef([]);
  useEffect(() => { msgsRef.current = messages; }, [messages]);

  const convId    = conversation.id;
  const otherUser = conversation.otherUser;
  const bgs       = backgroundService.getBackgrounds();
  const activeBg  = bgs[selectedBg];
  const bgStyle   = backgroundService.getBgStyle(selectedBg);
  const isDefault = activeBg?.isDefault === true;

  const scrollToBottom = (b = "smooth") => endRef.current?.scrollIntoView({ behavior: b });

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    isAtBottom.current = scrollHeight - scrollTop - clientHeight < 80;
    setShowJump(!isAtBottom.current && msgsRef.current.length >= 2);
  };

  const patchStatus = useCallback((ids, ns) => {
    if (!ids?.length) return;
    setReadStatus(prev => {
      const next = { ...prev };
      ids.forEach(id => { if (!id) return; if ((RANK[ns] ?? -1) > (RANK[prev[id]] ?? -1)) next[id] = ns; });
      return next;
    });
  }, []);

  const seedFromMessages = useCallback((msgs) => {
    setReadStatus(prev => {
      const next = { ...prev };
      msgs.forEach(m => {
        if (!m.id) return;
        const db = m.read ? "read" : m.delivered ? "delivered" : "sent";
        if (m.sender_id !== currentUser.id) { if (RANK["read"] > (RANK[prev[m.id]] ?? -1)) next[m.id] = "read"; }
        else { if ((RANK[db] ?? 0) > (RANK[prev[m.id]] ?? -1)) next[m.id] = db; }
      });
      return next;
    });
  }, [currentUser.id]);

  const markOurRead = useCallback(() => {
    const ids = msgsRef.current.filter(m => m.sender_id === currentUser.id && m.id).map(m => m.id);
    patchStatus(ids, "read");
  }, [currentUser.id, patchStatus]);

  useEffect(() => {
    conversationState.setActive(convId);
    dmMessageService.markRead(convId, currentUser.id);
    return () => conversationState.clearActive();
  }, [convId, currentUser.id]);

  useEffect(() => {
    setLoading(true); setReadStatus({});
    dmMessageService.loadMessages(convId).then(msgs => {
      setMessages(msgs); setLoading(false); seedFromMessages(msgs);
      setTimeout(() => scrollToBottom("auto"), 50);
    });
  }, [convId, seedFromMessages]);

  useEffect(() => {
    const unsub = dmMessageService.subscribeToConversation(convId, {
      onMessage: (msg) => {
        if (isAtBottom.current) setTimeout(scrollToBottom, 10);
        if (msg.sender_id !== currentUser.id && msg.id) {
          patchStatus([msg.id], "read");
          dmMessageService.markRead(convId, currentUser.id);
        }
      },
      onDelivered: (tempId) => {
        const m = msgsRef.current.find(x => x.id === tempId || x._tempId === tempId);
        if (m?.id && !m.id.startsWith("temp_")) patchStatus([m.id], "delivered");
        patchStatus([tempId], "delivered");
      },
      onRead: (uid) => { if (uid !== currentUser.id) markOurRead(); },
      onTyping: (uid, isTy, uname) => {
        if (uid === otherUser?.id) {
          setTyping({ isTyping: isTy, userName: uname || otherUser?.full_name || "User" });
          if (isTy && isAtBottom.current) setTimeout(scrollToBottom, 100);
        }
      },
    });
    unsubCh.current = unsub;
    return () => { if (unsubCh.current) unsubCh.current(); };
  }, [convId, otherUser?.id, otherUser?.full_name, currentUser.id, patchStatus, markOurRead]);

  useEffect(() => {
    const ch = supabase.channel(`msg-watch:${convId}:${currentUser.id}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "messages",
        filter: `conversation_id=eq.${convId}`,
      }, ({ new: u }) => {
        if (!u?.id || u.sender_id !== currentUser.id) return;
        if (u.read) patchStatus([u.id], "read");
        else if (u.delivered) patchStatus([u.id], "delivered");
      }).subscribe();
    unsubDB.current = ch;
    return () => { if (unsubDB.current) { supabase.removeChannel(unsubDB.current); unsubDB.current = null; } };
  }, [convId, currentUser.id, patchStatus]);

  useEffect(() => {
    const update = () => {
      const msgs = [...conversationState.getMessages(convId)];
      setMessages(msgs); seedFromMessages(msgs);
    };
    const unsub = conversationState.subscribe(update);
    update();
    return unsub;
  }, [convId, seedFromMessages]);

  useEffect(() => {
    onlineStatusService.fetchStatus(otherUser?.id).then(setStatus);
    const unsub = onlineStatusService.subscribe((uid, st) => { if (uid === otherUser?.id) setStatus(st); });
    return unsub;
  }, [otherUser?.id]);

  const handleTypingLocal = () => {
    dmMessageService.sendTyping(convId, true, currentUser.fullName || currentUser.full_name || currentUser.name);
    clearTimeout(tyTO.current);
    tyTO.current = setTimeout(() => dmMessageService.sendTyping(convId, false), 2500);
  };

  const handleSend = async (text, replyToId = null) => {
    if (!text?.trim()) return;
    clearTimeout(tyTO.current);
    dmMessageService.sendTyping(convId, false);
    setReplyTo(null);
    try {
      const sent = await dmMessageService.sendMessage(convId, text, currentUser.id, replyToId);
      if (sent?.id) patchStatus([sent.id], "sent");
      setTimeout(scrollToBottom, 10);
    } catch (e) { console.error("send:", e); }
  };

  const scrollToMessage = useCallback((msgId) => {
    const el = containerRef.current?.querySelector(`[data-msg-id="${msgId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("cv-highlight");
      setTimeout(() => el.classList.remove("cv-highlight"), 1500);
    }
  }, []);

  const getTickStatus = (msg) => {
    if (msg._optimistic) return <span className="cv-tk cv-tk-sent">✓</span>;
    if (msg._failed)     return <span className="cv-tk cv-tk-red">✗</span>;
    const local = readStatus[msg.id];
    const db    = msg.read ? "read" : msg.delivered ? "delivered" : "sent";
    const res   = (RANK[local] ?? -1) >= (RANK[db] ?? -1) ? (local || db) : db;
    if (res === "read")      return <span className="cv-tk cv-tk-read">✓✓</span>;
    if (res === "delivered") return <span className="cv-tk cv-tk-dlvr">✓✓</span>;
    return <span className="cv-tk cv-tk-sent">✓</span>;
  };

  const fmtTime = (d) => {
    if (!d) return "";
    const dt = new Date(d);
    const h  = dt.getHours() % 12 || 12;
    const m  = dt.getMinutes().toString().padStart(2, "0");
    return `${h}:${m} ${dt.getHours() >= 12 ? "PM" : "AM"}`;
  };

  const avatarUrl = otherUser?.avatar_id
    ? mediaUrlService.getAvatarUrl(otherUser.avatar_id, 200) : null;

  return (
    <div className="cv-root">
      {/* ── HEADER ── */}
      <div className="cv-head">
        <button className="cv-back-btn" onClick={onBack}><Ic.Back /></button>
        <div className="cv-head-info">
          <div className="cv-head-av-wrap">
            <div className="cv-head-av">
              {avatarUrl
                ? <img src={avatarUrl} alt={otherUser?.full_name} />
                : (otherUser?.full_name || "U").charAt(0).toUpperCase()}
            </div>
            <div className={`cv-head-dot${status.online ? " cv-dot-on" : ""}`} />
          </div>
          <div className="cv-head-text">
            <div className="cv-head-name">{otherUser?.full_name || "Unknown"}</div>
            <div className={`cv-head-status${status.online ? " cv-st-on" : ""}`}>
              {typing.isTyping
                ? <span className="cv-typing-lbl">typing…</span>
                : status.lastSeenText}
            </div>
          </div>
        </div>
        <div className="cv-head-right">
          {onStartCall && (
            <>
              <button className="cv-call-btn cv-call-audio" onClick={() => onStartCall("audio")} title="Voice call"><Ic.Phone /></button>
              <button className="cv-call-btn cv-call-video" onClick={() => onStartCall("video")} title="Video call"><Ic.Video /></button>
            </>
          )}
          <button className="cv-more-btn" onClick={() => setShowMenu(m => !m)}><Ic.More /></button>
        </div>
        {showMenu && (
          <>
            <div className="cv-overlay" onClick={() => setShowMenu(false)} />
            <div className="cv-menu">
              <button onClick={() => { setShowBgPicker(true); setShowMenu(false); }}>
                <Ic.Palette /><span>Change Background</span>
              </button>
            </div>
          </>
        )}
        {showBgPicker && (
          <>
            <div className="cv-overlay" onClick={() => setShowBgPicker(false)} />
            <div className="cv-bgpicker">
              {bgs.map((b, i) => (
                <button key={i} className={`cv-bgopt${selectedBg === i ? " cv-bgopt-on" : ""}`}
                  onClick={() => { backgroundService.setConversationBackground(convId, i); setSelectedBg(i); setShowBgPicker(false); }}>
                  {b.isDefault ? <div className="cv-bgprev cv-bgprev-grid" />
                    : b.image ? <img src={b.image} alt={b.name} />
                    : <div className="cv-bgprev" style={{ background: b.value }} />}
                  <span>{b.name}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── MESSAGES ── */}
      <div
        className={`cv-msgs${isDefault ? " cv-msgs-default" : ""}`}
        style={bgStyle} ref={containerRef} onScroll={handleScroll}
      >
        <div className="cv-msgs-overlay" />
        <div className="cv-msgs-content">
          {loading && <div className="cv-loading"><div className="cv-spinner" /></div>}
          {!loading && messages.map((msg, idx) => {
            const isMe = msg.sender_id === currentUser.id;
            const prev = messages[idx - 1];
            const tail = !prev || prev.sender_id !== msg.sender_id;
            return (
              <MessageRow
                key={msg.id || msg._tempId}
                msg={msg} isMe={isMe} showAv={!isMe && tail}
                avatarUrl={avatarUrl} otherName={otherUser?.full_name}
                currentUserId={currentUser.id} messages={messages}
                onReply={setReplyTo} onScrollTo={scrollToMessage}
                getTickStatus={getTickStatus} fmtTime={fmtTime}
              />
            );
          })}
          {typing.isTyping && (
            <div className="cv-msg cv-them">
              <div className="cv-avatar">
                {avatarUrl ? <img src={avatarUrl} alt={otherUser?.full_name} /> : (otherUser?.full_name || "U").charAt(0)}
              </div>
              <div className="cv-bubble cv-bthem cv-tail-l cv-typing-bubble">
                <div className="cv-dots"><span /><span /><span /></div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
        {showJump && (
          <button className="cv-jump-btn" onClick={() => scrollToBottom()}><Ic.Down /></button>
        )}
      </div>

      <MessageInput
        onSend={handleSend} onTyping={handleTypingLocal}
        replyTo={replyTo} onCancelReply={() => setReplyTo(null)}
      />
      <style>{CV_CSS}</style>
    </div>
  );
};

export const CV_CSS = `
.cv-root{display:flex;flex-direction:column;height:100%;background:#000;overflow:hidden;position:relative;}
.cv-head{display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top,0px)+10px) 14px 10px;background:rgba(0,0,0,.98);border-bottom:1px solid rgba(132,204,22,.1);position:relative;z-index:10;flex-shrink:0;min-height:56px;}
.cv-back-btn{width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);color:#84cc16;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:background .2s;}
.cv-back-btn:hover{background:rgba(132,204,22,.1);}
.cv-head-info{display:flex;align-items:center;gap:10px;flex:1;min-width:0;}
.cv-head-av-wrap{position:relative;flex-shrink:0;width:38px;height:38px;}
.cv-head-av{width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#1a1a1a,#222);border:2px solid rgba(132,204,22,.25);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:#84cc16;overflow:hidden;}
.cv-head-av img{width:100%;height:100%;object-fit:cover;}
.cv-head-dot{position:absolute;bottom:-1px;right:-1px;width:11px;height:11px;border-radius:50%;border:2.5px solid #000;background:#333;z-index:2;transition:background .3s;}
.cv-head-dot.cv-dot-on{background:#22c55e;}
.cv-head-text{flex:1;min-width:0;}
.cv-head-name{font-size:14px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.cv-head-status{font-size:11px;color:#555;transition:color .3s;}
.cv-head-status.cv-st-on{color:#22c55e;}
.cv-typing-lbl{color:#84cc16;font-style:italic;}
.cv-head-right{display:flex;align-items:center;gap:5px;flex-shrink:0;}
.cv-call-btn{width:32px;height:32px;border-radius:9px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s;}
.cv-call-audio{background:rgba(132,204,22,.08);border:1px solid rgba(132,204,22,.2);color:#84cc16;}
.cv-call-audio:hover{background:rgba(132,204,22,.16);}
.cv-call-video{background:rgba(96,165,250,.08);border:1px solid rgba(96,165,250,.2);color:#60a5fa;}
.cv-call-video:hover{background:rgba(96,165,250,.16);}
.cv-more-btn{width:32px;height:32px;border-radius:9px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);color:#84cc16;display:flex;align-items:center;justify-content:center;cursor:pointer;}
.cv-overlay{position:fixed;inset:0;z-index:20;}
.cv-menu{position:absolute;top:54px;right:12px;background:#111;border:1px solid rgba(132,204,22,.2);border-radius:12px;padding:6px;z-index:30;min-width:180px;}
.cv-menu button{display:flex;align-items:center;gap:8px;width:100%;padding:9px 12px;background:transparent;border:none;border-radius:8px;color:#ccc;font-size:13px;cursor:pointer;}
.cv-menu button:hover{background:rgba(255,255,255,.05);}
.cv-bgpicker{position:absolute;top:54px;right:12px;background:#111;border:1px solid rgba(132,204,22,.2);border-radius:14px;padding:8px;display:flex;flex-direction:column;gap:4px;z-index:30;max-height:70vh;overflow-y:auto;width:200px;}
.cv-bgopt{display:flex;align-items:center;gap:10px;padding:7px 10px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:8px;color:#ccc;font-size:13px;cursor:pointer;text-align:left;transition:background .15s;}
.cv-bgopt:hover{background:rgba(255,255,255,.06);}
.cv-bgopt.cv-bgopt-on{background:rgba(132,204,22,.12);border-color:rgba(132,204,22,.35);color:#84cc16;}
.cv-bgopt img{width:32px;height:32px;border-radius:6px;object-fit:cover;flex-shrink:0;}
.cv-bgprev{width:32px;height:32px;border-radius:6px;flex-shrink:0;}
.cv-bgprev-grid{background:repeating-linear-gradient(90deg,rgba(132,204,22,.25) 0px,rgba(132,204,22,.25) 1px,transparent 1px,transparent 8px),repeating-linear-gradient(0deg,rgba(132,204,22,.25) 0px,rgba(132,204,22,.25) 1px,transparent 1px,transparent 8px),#000;border:1px solid rgba(132,204,22,.3);}
.cv-msgs{flex:1;overflow-y:auto;position:relative;-webkit-overflow-scrolling:touch;}
.cv-msgs::-webkit-scrollbar{width:3px;}.cv-msgs::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:2px;}
.cv-msgs-overlay{position:absolute;inset:0;background:rgba(0,0,0,.22);pointer-events:none;z-index:0;}
.cv-msgs-default .cv-msgs-overlay{background:rgba(0,0,0,.05);}
.cv-msgs-content{position:relative;z-index:1;padding:10px 14px 16px;display:flex;flex-direction:column;gap:2px;}
.cv-loading{display:flex;justify-content:center;padding:40px;}
.cv-spinner{width:22px;height:22px;border:2px solid rgba(132,204,22,.15);border-top-color:#84cc16;border-radius:50%;animation:cvSpin .7s linear infinite;}
@keyframes cvSpin{to{transform:rotate(360deg)}}
.cv-jump-btn{position:absolute;bottom:16px;right:16px;z-index:5;width:38px;height:38px;border-radius:50%;background:rgba(10,10,10,.96);border:1px solid rgba(132,204,22,.4);color:#84cc16;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.6);}
.cv-msg{display:flex;align-items:flex-end;gap:8px;animation:cvMsgIn .18s ease-out both;position:relative;user-select:none;margin-bottom:1px;}
.cv-me{flex-direction:row-reverse;}
.cv-opt{opacity:.65;}.cv-fail{opacity:.45;}
@keyframes cvMsgIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.cv-avatar{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#1a1a1a,#222);border:2px solid rgba(132,204,22,.18);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#84cc16;overflow:hidden;flex-shrink:0;}
.cv-avatar img{width:100%;height:100%;object-fit:cover;}
.cv-avatar-sp{width:34px;flex-shrink:0;}
.cv-bubble{max-width:72%;padding:8px 12px;border-radius:16px;word-break:break-word;will-change:transform;}
.cv-bthem{background:rgba(18,18,18,.97);border:1px solid rgba(255,255,255,.07);}
.cv-bme{background:linear-gradient(135deg,rgba(132,204,22,.2),rgba(101,163,13,.14));border:1px solid rgba(132,204,22,.25);}
.cv-tail-l.cv-bthem{border-bottom-left-radius:4px;}
.cv-tail-r.cv-bme{border-bottom-right-radius:4px;}
.cv-content{font-size:14px;color:#f0f0f0;line-height:1.5;}
.cv-bad{font-size:12px;color:#444;font-style:italic;}
.cv-meta{display:flex;align-items:center;gap:4px;margin-top:3px;}
.cv-meta-me{justify-content:flex-end;}
.cv-time{font-size:10px;color:#555;}
.cv-st{line-height:1;}
.cv-tk{font-size:11px;font-weight:700;display:inline-block;transition:color .25s;}
.cv-tk-sent{color:#444;}.cv-tk-dlvr{color:#888;}.cv-tk-read{color:#22c55e;}.cv-tk-red{color:#ef4444;}
.cv-typing-bubble{padding:10px 14px;}
.cv-dots{display:flex;gap:4px;}
.cv-dots span{width:6px;height:6px;border-radius:50%;background:#555;animation:cvDot 1.2s ease infinite;}
.cv-dots span:nth-child(2){animation-delay:.15s;}.cv-dots span:nth-child(3){animation-delay:.3s;}
@keyframes cvDot{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-5px);opacity:1}}
.cv-swipe-ind{position:absolute;top:50%;transform:translateY(-50%);width:32px;height:32px;border-radius:50%;background:rgba(132,204,22,.15);border:1.5px solid rgba(132,204,22,.5);display:flex;align-items:center;justify-content:center;color:#84cc16;pointer-events:none;z-index:5;}
.cv-rpulse .cv-bubble{animation:cvRPulse .3s ease-out;}
@keyframes cvRPulse{0%{transform:scale(1)}50%{transform:scale(.97)}100%{transform:scale(1)}}
.cv-desktop-reply{position:absolute;top:50%;transform:translateY(-50%);width:30px;height:30px;border-radius:50%;background:rgba(18,18,18,.95);border:1px solid rgba(132,204,22,.3);display:flex;align-items:center;justify-content:center;color:#84cc16;cursor:pointer;z-index:5;animation:cvDRIn .15s ease-out forwards;box-shadow:0 2px 8px rgba(0,0,0,.4);}
.cv-desktop-reply:hover{background:rgba(132,204,22,.12);}
@keyframes cvDRIn{from{opacity:0;scale:.7}to{opacity:1;scale:1}}
.cv-dr-right{right:-38px;}
.cv-dr-left{left:-38px;}
.cv-rq{display:flex;align-items:stretch;gap:6px;padding:5px 8px;margin-bottom:6px;background:rgba(0,0,0,.28);border-radius:8px;cursor:pointer;transition:background .15s;}
.cv-rq:hover{background:rgba(132,204,22,.08);}
.cv-rq-bar{width:3px;border-radius:2px;background:#84cc16;flex-shrink:0;}
.cv-rq-text{font-size:12px;color:rgba(255,255,255,.55);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;}
.cv-highlight .cv-bubble{animation:cvHL .8s ease-out;}
@keyframes cvHL{0%,100%{filter:brightness(1)}40%{filter:brightness(1.5)}}
.cv-ctx-overlay{position:fixed;inset:0;z-index:99980;background:transparent;}
.cv-ctx-menu{position:fixed;background:rgba(10,10,10,.97);border:1px solid rgba(132,204,22,.2);border-radius:14px;padding:6px;min-width:165px;box-shadow:0 16px 48px rgba(0,0,0,.8);animation:cvCtxIn .18s cubic-bezier(.34,1.56,.64,1);z-index:99981;backdrop-filter:blur(16px);}
@keyframes cvCtxIn{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:scale(1)}}
.cv-ctx-item{display:flex;align-items:center;gap:10px;width:100%;padding:10px 14px;background:transparent;border:none;border-radius:9px;font-size:13px;font-weight:600;cursor:pointer;transition:background .12s;text-align:left;}
.cv-ctx-item:hover{background:rgba(255,255,255,.07);}
.cv-ctx-icon{display:flex;align-items:center;justify-content:center;width:18px;flex-shrink:0;}
.cv-reply-bar{display:flex;align-items:center;gap:8px;padding:8px 14px;background:rgba(8,8,8,.98);border-top:1px solid rgba(132,204,22,.15);animation:cvRBIn .2s ease-out;flex-shrink:0;}
@keyframes cvRBIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.cv-rb-line{width:3px;height:36px;border-radius:2px;background:#84cc16;flex-shrink:0;}
.cv-rb-content{flex:1;min-width:0;}
.cv-rb-label{font-size:10px;font-weight:700;color:#84cc16;margin-bottom:2px;}
.cv-rb-text{font-size:12px;color:#666;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.cv-rb-x{width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;cursor:pointer;color:#666;flex-shrink:0;}
.cv-input-root{flex-shrink:0;background:rgba(0,0,0,.98);border-top:1px solid rgba(255,255,255,.06);}
.cv-input-bar{display:flex;align-items:flex-end;gap:8px;padding:10px 14px calc(env(safe-area-inset-bottom,0px)+10px);}
.cv-input-ta{flex:1;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:22px;color:#fff;font-size:14px;padding:10px 16px;outline:none;caret-color:#84cc16;font-family:inherit;resize:none;overflow:hidden;line-height:1.4;min-height:40px;max-height:120px;transition:border-color .2s;}
.cv-input-ta:focus{border-color:rgba(132,204,22,.35);}
.cv-input-ta::placeholder{color:#333;}
.cv-send-btn{width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,rgba(132,204,22,.25),rgba(101,163,13,.2));border:1.5px solid rgba(132,204,22,.45);color:#84cc16;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:all .15s;}
.cv-send-btn:disabled{opacity:.3;cursor:not-allowed;}
.cv-send-btn:not(:disabled):hover{background:linear-gradient(135deg,rgba(132,204,22,.35),rgba(101,163,13,.3));}
@media(max-width:768px){.cv-dr-right,.cv-dr-left{display:none;}}
`;

export default ChatView;