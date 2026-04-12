// ============================================================================
// components/Messages/GroupChatView.jsx — NOVA GROUP CHAT v6 UNIFIED
// ============================================================================
// FULLY UNIFIED with ChatView design — identical bubbles, input, reply system,
// context menu, swipe gestures, background support.
// Only difference: sender names shown above bubbles, group header with members.
// ============================================================================

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  memo,
} from "react";
import groupDMService from "../../services/messages/groupDMService";
import callService from "../../services/messages/callService";
import mediaUrlService from "../../services/shared/mediaUrlService";
import { supabase } from "../../services/config/supabase";
import backgroundService from "../../services/messages/BackgroundService";
import { CV_CSS } from "./ChatView"; // Reuse exact same CSS

/* ─── ICONS ─── */
const Ic = {
  Back: () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  ),
  Phone: () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
    </svg>
  ),
  Video: () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  ),
  Users: () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  Close: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Down: () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  Reply: () => (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 17 4 12 9 7" />
      <path d="M20 18v-2a4 4 0 00-4-4H4" />
    </svg>
  ),
  Copy: () => (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  ),
  Delete: () => (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#ef4444"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M9 6V4h6v2" />
    </svg>
  ),
  Send: () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  ),
  Palette: () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="13.5" cy="6.5" r=".5" />
      <circle cx="17.5" cy="10.5" r=".5" />
      <circle cx="8.5" cy="7.5" r=".5" />
      <circle cx="6.5" cy="12.5" r=".5" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 011.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
    </svg>
  ),
  Edit: () => (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
};

const MEMBER_COLORS = [
  "#84cc16",
  "#22c55e",
  "#60a5fa",
  "#c084fc",
  "#f59e0b",
  "#fb7185",
  "#34d399",
  "#a78bfa",
  "#f97316",
  "#06b6d4",
];
function memberColor(id) {
  if (!id) return MEMBER_COLORS[0];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return MEMBER_COLORS[Math.abs(h) % MEMBER_COLORS.length];
}

/* ─── Avatar ─── */
const UAv = memo(({ user, size = 34 }) => {
  const [err, setErr] = useState(false);
  const id = user?.avatar_id || user?.avatarId;
  const url = !err && id ? mediaUrlService.getAvatarUrl(id, 200) : null;
  const ini = (user?.full_name || user?.name || "?").charAt(0).toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg,#1a1a1a,#222)",
        border: "2px solid rgba(132,204,22,.18)",
        flexShrink: 0,
        fontSize: size * 0.38,
        fontWeight: 700,
        color: "#84cc16",
      }}
    >
      {url ? (
        <img
          src={url}
          alt={user?.full_name || "?"}
          onError={() => setErr(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <span>{ini}</span>
      )}
    </div>
  );
});
UAv.displayName = "UAv";

/* ─── Group Icon ─── */
const GroupIcon = memo(({ group, size = 40 }) => {
  const members = (group?.members || []).filter(Boolean).slice(0, 4);
  if (!members.length) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: "linear-gradient(135deg,#0d1a00,#1a3300)",
          border: "2px solid rgba(132,204,22,.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size * 0.45,
          flexShrink: 0,
        }}
      >
        {group?.icon || "👥"}
      </div>
    );
  }
  const q = Math.floor(size / 2) - 2;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        background: "linear-gradient(135deg,#0d1a00,#1a3300)",
        border: "2px solid rgba(132,204,22,.2)",
        flexShrink: 0,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "1fr 1fr",
        gap: "1px",
        padding: "2px",
      }}
    >
      {members.slice(0, 4).map((m, i) => (
        <div
          key={m?.id || i}
          style={{ borderRadius: "2px", overflow: "hidden" }}
        >
          <UAv user={m} size={q} />
        </div>
      ))}
    </div>
  );
});
GroupIcon.displayName = "GroupIcon";

/* ─── Context Menu ─── */
const ContextMenu = memo(
  ({ pos, isMe, onReply, onCopy, onDelete, onClose }) => {
    const menuRef = useRef(null);
    const [style, setStyle] = useState({ opacity: 0, left: pos.x, top: pos.y });

    useEffect(() => {
      const el = menuRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      let { x, y } = pos;
      if (x + rect.width > window.innerWidth - 16)
        x = window.innerWidth - rect.width - 16;
      if (x < 16) x = 16;
      if (y + rect.height > window.innerHeight - 16) y = y - rect.height - 8;
      if (y < 16) y = 16;
      setStyle({ left: x, top: y, opacity: 1 });
    }, [pos]);

    useEffect(() => {
      const h = (e) => {
        if (!menuRef.current?.contains(e.target)) onClose();
      };
      const tid = setTimeout(() => {
        document.addEventListener("pointerdown", h);
      }, 50);
      return () => {
        clearTimeout(tid);
        document.removeEventListener("pointerdown", h);
      };
    }, [onClose]);

    return (
      <div
        className="cv-ctx-overlay"
        onPointerDown={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <div
          ref={menuRef}
          className="cv-ctx-menu"
          style={style}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            className="cv-ctx-item"
            style={{ color: "#84cc16" }}
            onClick={() => {
              onReply?.();
              onClose();
            }}
          >
            <span className="cv-ctx-icon">
              <Ic.Reply />
            </span>
            <span>Reply</span>
          </button>
          <button
            className="cv-ctx-item"
            style={{ color: "#ccc" }}
            onClick={() => {
              onCopy?.();
              onClose();
            }}
          >
            <span className="cv-ctx-icon">
              <Ic.Copy />
            </span>
            <span>Copy</span>
          </button>
          {isMe && (
            <button
              className="cv-ctx-item"
              style={{ color: "#ef4444" }}
              onClick={() => {
                onDelete?.();
                onClose();
              }}
            >
              <span className="cv-ctx-icon">
                <Ic.Delete />
              </span>
              <span>Delete</span>
            </button>
          )}
        </div>
      </div>
    );
  },
);
ContextMenu.displayName = "ContextMenu";

/* ─── Reply Quote ─── */
const ReplyQuote = memo(({ replyToId, messages, onScrollTo }) => {
  const original = messages.find((m) => m.id === replyToId);
  if (!original) return null;
  return (
    <div className="cv-rq" onClick={() => onScrollTo?.(replyToId)}>
      <div className="cv-rq-bar" />
      <div className="cv-rq-text">
        {original.content?.slice(0, 80) || "Message"}
      </div>
    </div>
  );
});
ReplyQuote.displayName = "ReplyQuote";

/* ─── Message Row — identical to ChatView but with sender name ─── */
const MsgRow = memo(
  ({
    msg,
    isMe,
    showHeader,
    allMembers,
    messages,
    onReply,
    onScrollTo,
    currentUserId,
  }) => {
    const [swipeX, setSwipeX] = useState(0);
    const [swiping, setSwiping] = useState(false);
    const [ctxOpen, setCtxOpen] = useState(false);
    const [ctxPos, setCtxPos] = useState({ x: 0, y: 0 });
    const [hovered, setHovered] = useState(false);
    const touchX = useRef(null);
    const touchY = useRef(null);
    const lpTimer = useRef(null);
    const rowRef = useRef(null);
    const SWIPE_TH = 60;

    const sender = allMembers.find(
      (m) => m?.id === (msg.user_id || msg.sender_id),
    );
    const avatarUrl = useMemo(() => {
      const id = sender?.avatar_id || sender?.avatarId;
      return id ? mediaUrlService.getAvatarUrl(id, 200) : null;
    }, [sender?.avatar_id, sender?.avatarId]);

    const onTouchStart = (e) => {
      touchX.current = e.touches[0].clientX;
      touchY.current = e.touches[0].clientY;
      lpTimer.current = setTimeout(() => {
        const rect = rowRef.current?.getBoundingClientRect() || {};
        setCtxPos({ x: rect.left + rect.width / 2 - 90, y: rect.top - 8 });
        setCtxOpen(true);
      }, 500);
    };
    const onTouchMove = (e) => {
      const dx = e.touches[0].clientX - (touchX.current || 0);
      const dy = Math.abs(e.touches[0].clientY - (touchY.current || 0));
      if (dy > 12) {
        clearTimeout(lpTimer.current);
        return;
      }
      if (Math.abs(dx) > 8) {
        clearTimeout(lpTimer.current);
        setSwiping(true);
        setSwipeX(Math.max(-90, Math.min(90, dx)));
      }
    };
    const onTouchEnd = () => {
      clearTimeout(lpTimer.current);
      if (swiping && Math.abs(swipeX) >= SWIPE_TH) onReply?.(msg);
      setSwiping(false);
      setSwipeX(0);
    };
    const onContextMenu = (e) => {
      e.preventDefault();
      setCtxPos({ x: e.clientX, y: e.clientY });
      setCtxOpen(true);
    };

    const fmtTime = (d) => {
      if (!d) return "";
      const dt = new Date(d);
      return `${dt.getHours() % 12 || 12}:${dt.getMinutes().toString().padStart(2, "0")} ${dt.getHours() >= 12 ? "PM" : "AM"}`;
    };

    return (
      <div
        ref={rowRef}
        className={`cv-msg${isMe ? " cv-me" : " cv-them"}${msg._optimistic ? " cv-opt" : ""}${msg._failed ? " cv-fail" : ""}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onContextMenu={onContextMenu}
        data-msg-id={msg.id}
      >
        {swiping && (
          <div
            className="cv-swipe-ind"
            style={{
              opacity: Math.min(1, Math.abs(swipeX) / SWIPE_TH),
              [isMe ? "right" : "left"]: "calc(100% + 10px)",
            }}
          >
            <Ic.Reply />
          </div>
        )}

        {hovered && !swiping && !ctxOpen && (
          <button
            className={`cv-desktop-reply${isMe ? " cv-dr-left" : " cv-dr-right"}`}
            onClick={() => onReply?.(msg)}
          >
            <Ic.Reply />
          </button>
        )}

        {!isMe &&
          (showHeader ? (
            <div className="cv-avatar">
              {avatarUrl ? (
                <img src={avatarUrl} alt={sender?.full_name || "?"} />
              ) : (
                (sender?.full_name || "?").charAt(0)
              )}
            </div>
          ) : (
            <div className="cv-avatar-sp" />
          ))}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            maxWidth: "72%",
            gap: "1px",
            alignItems: isMe ? "flex-end" : "flex-start",
          }}
        >
          {!isMe && showHeader && (
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: memberColor(sender?.id),
                paddingLeft: 2,
                marginBottom: 1,
              }}
            >
              {sender?.full_name || sender?.name || "Unknown"}
            </div>
          )}
          <div
            className={`cv-bubble ${isMe ? "cv-bme cv-tail-r" : "cv-bthem cv-tail-l"}`}
            style={{
              transform: swiping
                ? `translateX(${swipeX * 0.5}px)`
                : "translateX(0)",
              transition: swiping
                ? "none"
                : "transform 0.25s cubic-bezier(.34,1.56,.64,1)",
            }}
          >
            {msg.reply_to_id && (
              <ReplyQuote
                replyToId={msg.reply_to_id}
                messages={messages}
                onScrollTo={onScrollTo}
              />
            )}
            <div className="cv-content">{msg.content}</div>
            <div className={`cv-meta${isMe ? " cv-meta-me" : ""}`}>
              <span className="cv-time">{fmtTime(msg.created_at)}</span>
              {isMe && (
                <span className="cv-tk cv-tk-read">
                  {msg._optimistic ? "✓" : "✓✓"}
                </span>
              )}
            </div>
          </div>
        </div>

        {ctxOpen && (
          <ContextMenu
            pos={ctxPos}
            isMe={isMe}
            onReply={() => onReply?.(msg)}
            onCopy={() =>
              navigator.clipboard?.writeText(msg.content || "").catch(() => {})
            }
            onDelete={async () => {
              if (!isMe) return;
              try {
                await supabase
                  .from("community_messages")
                  .delete()
                  .eq("id", msg.id)
                  .eq("user_id", currentUserId);
              } catch (e) {
                console.warn(e);
              }
            }}
            onClose={() => setCtxOpen(false)}
          />
        )}
      </div>
    );
  },
);
MsgRow.displayName = "MsgRow";

/* ─── Reply Bar ─── */
const ReplyBar = memo(({ replyTo, onCancel }) => {
  if (!replyTo) return null;
  return (
    <div className="cv-reply-bar">
      <div className="cv-rb-line" />
      <div className="cv-rb-content">
        <div className="cv-rb-label">Replying</div>
        <div className="cv-rb-text">
          {replyTo.content?.slice(0, 80) || "..."}
        </div>
      </div>
      <button className="cv-rb-x" onClick={onCancel}>
        <Ic.Close />
      </button>
    </div>
  );
});

/* ─── Input ─── */
const GCInput = memo(({ onSend, onTyping, replyTo, onCancelReply }) => {
  const [val, setVal] = useState("");
  const taRef = useRef(null);
  useEffect(() => {
    if (replyTo) taRef.current?.focus();
  }, [replyTo]);
  const onChange = (e) => {
    setVal(e.target.value);
    onTyping?.();
    const ta = taRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
    }
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
          ref={taRef}
          className="cv-input-ta"
          value={val}
          onChange={onChange}
          onKeyDown={(e) =>
            e.key === "Enter" && !e.shiftKey && (e.preventDefault(), submit())
          }
          placeholder="Message group…"
          rows={1}
          maxLength={2000}
        />
        <button className="cv-send-btn" onClick={submit} disabled={!val.trim()}>
          <Ic.Send />
        </button>
      </div>
    </div>
  );
});

/* ─── Members Sidebar ─── */
const MembersPanel = ({ members, group, currentUserId, onClose }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      background: "rgba(0,0,0,.65)",
      zIndex: 20,
      display: "flex",
      justifyContent: "flex-end",
      backdropFilter: "blur(4px)",
    }}
    onClick={onClose}
  >
    <div
      style={{
        width: 280,
        height: "100%",
        background: "#070707",
        borderLeft: "1px solid rgba(132,204,22,.15)",
        display: "flex",
        flexDirection: "column",
        animation: "gcvSlideR .25s ease-out",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: "1px solid rgba(255,255,255,.06)",
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
          {group?.icon || "👥"} {group?.name}{" "}
          <span style={{ color: "#555", fontSize: 12 }}>
            · {members.length}
          </span>
        </span>
        <button
          onClick={onClose}
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: "rgba(255,255,255,.04)",
            border: "1px solid rgba(255,255,255,.07)",
            color: "#555",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <Ic.Close />
        </button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {members.map((m) => (
          <div
            key={m?.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 20px",
              borderBottom: "1px solid rgba(255,255,255,.03)",
            }}
          >
            <UAv user={m} size={42} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
                {m?.full_name || "Unknown"}
                {m?.id === currentUserId ? " (You)" : ""}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: m?.is_admin ? "#84cc16" : "#555",
                  marginTop: 1,
                }}
              >
                {m?.is_admin ? "👑 Admin" : "Member"}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
    <style>{`@keyframes gcvSlideR{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
  </div>
);

// ════════════════════════════════════════════════════════════════════════════
// MAIN GROUP CHAT VIEW
// ════════════════════════════════════════════════════════════════════════════
const GroupChatView = ({
  group: initialGroup,
  currentUser,
  onBack,
  onStartCall,
}) => {
  const [group, setGroup] = useState(initialGroup || {});
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState(
    Array.isArray(initialGroup?.members) ? initialGroup.members : [],
  );
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState([]);
  const [showMembers, setShowMembers] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [selectedBg, setSelectedBg] = useState(
    backgroundService.getConversationBackground(group?.id || ""),
  );
  const [replyTo, setReplyTo] = useState(null);

  const endRef = useRef(null);
  const containerRef = useRef(null);
  const isAtBottom = useRef(true);
  const typingMap = useRef(new Map());
  const typingTOs = useRef({});
  const mountedRef = useRef(true);
  const unsubRef = useRef(null);

  const groupId = group?.id || initialGroup?.id;
  const bgs = backgroundService.getBackgrounds();
  const bgStyle = backgroundService.getBgStyle(selectedBg);
  const isDefault = bgs[selectedBg]?.isDefault === true;

  const scrollToBottom = (beh = "smooth") =>
    endRef.current?.scrollIntoView({ behavior: beh });

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    isAtBottom.current = scrollHeight - scrollTop - clientHeight < 80;
    setShowJump(!isAtBottom.current);
  };

  const scrollToMessage = useCallback((msgId) => {
    const el = containerRef.current?.querySelector(`[data-msg-id="${msgId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("cv-highlight");
      setTimeout(() => el.classList.remove("cv-highlight"), 1500);
    }
  }, []);

  useEffect(() => {
    if (!groupId) {
      setLoading(false);
      return;
    }
    mountedRef.current = true;
    (async () => {
      try {
        const msgs = await groupDMService.loadMessages(groupId);
        if (mountedRef.current) {
          setMessages(msgs);
          setLoading(false);
          setTimeout(() => scrollToBottom("auto"), 60);
        }
        if (!members.length) {
          const g = await groupDMService.getGroup(groupId);
          if (g && mountedRef.current) {
            setGroup(g);
            setMembers(Array.isArray(g.members) ? g.members : []);
          }
        }
      } catch (e) {
        console.error("[GCV] load:", e);
        if (mountedRef.current) setLoading(false);
      }
    })();
    return () => {
      mountedRef.current = false;
    };
  }, [groupId]);

  useEffect(() => {
    if (!groupId) return;
    unsubRef.current = groupDMService.subscribeToMessages(groupId, {
      onMessage: (msg) => {
        if (!mountedRef.current) return;
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, { ...msg, sender_id: msg.user_id || msg.sender_id }];
        });
        if (isAtBottom.current) setTimeout(scrollToBottom, 10);
      },
      onTyping: ({ userId, userName, typing: isTy }) => {
        if (!mountedRef.current || userId === currentUser?.id) return;
        if (isTy) {
          typingMap.current.set(userId, userName || "Someone");
          setTyping(Array.from(typingMap.current.values()));
          clearTimeout(typingTOs.current[userId]);
          typingTOs.current[userId] = setTimeout(() => {
            typingMap.current.delete(userId);
            if (mountedRef.current)
              setTyping(Array.from(typingMap.current.values()));
          }, 3000);
        } else {
          typingMap.current.delete(userId);
          setTyping(Array.from(typingMap.current.values()));
        }
      },
    });

    const unsubLocal = groupDMService.on(
      `msgs:${groupId}`,
      ({ type, message, tempId }) => {
        if (!mountedRef.current) return;
        if (type === "optimistic") {
          setMessages((prev) => [...prev, message]);
          setTimeout(scrollToBottom, 10);
        } else if (type === "confirmed")
          setMessages((prev) =>
            prev.map((m) => (m._tempId === tempId ? message : m)),
          );
        else if (type === "failed")
          setMessages((prev) =>
            prev.map((m) =>
              m._tempId === tempId ? { ...m, _failed: true } : m,
            ),
          );
      },
    );

    return () => {
      unsubRef.current?.();
      unsubLocal();
    };
  }, [groupId, currentUser?.id]);

  useEffect(() => {
    if (!groupId) return;
    const unsub = groupDMService.on(`group_updated:${groupId}`, (updated) => {
      if (mountedRef.current) {
        setGroup(updated);
        if (Array.isArray(updated.members)) setMembers(updated.members);
      }
    });
    return unsub;
  }, [groupId]);

  const handleSend = useCallback(
    async (text, replyToId = null) => {
      if (!text?.trim() || !currentUser?.id || !groupId) return;
      setReplyTo(null);
      await groupDMService.sendMessage(
        groupId,
        text,
        {
          id: currentUser.id,
          full_name: currentUser.fullName || currentUser.full_name || "You",
          avatar_id: currentUser.avatarId || currentUser.avatar_id,
        },
        replyToId,
      );
    },
    [groupId, currentUser],
  );

  const handleTyping = useCallback(() => {
    groupDMService.sendTyping(
      groupId,
      true,
      currentUser?.fullName || currentUser?.full_name || "Someone",
    );
  }, [groupId, currentUser]);

  const handleStartCall = useCallback(
    async (callType) => {
      const calleeIds = members
        .filter((m) => m?.id && m.id !== currentUser?.id)
        .map((m) => m.id);
      if (!calleeIds.length) return;
      try {
        const { callId } = await callService.initiateCall({
          calleeIds,
          callType,
          groupName: group.name,
          participants: members,
        });
        for (const calleeId of calleeIds) {
          callService.sendCallPushNotification({
            calleeId,
            callType,
            groupName: group.name,
            callId,
          });
        }
        onStartCall?.({
          callId,
          name: group.name || "Group Call",
          type: callType,
          outgoing: true,
          participants: members
            .filter((m) => m?.id !== currentUser?.id)
            .map((m) => ({
              id: m.id,
              full_name: m.full_name || m.name,
              avatar_id: m.avatar_id,
              name: m.full_name || m.name,
              muted: false,
              camOff: false,
            })),
        });
      } catch (e) {
        console.error("[GCV] startCall:", e);
      }
    },
    [group, members, currentUser, onStartCall],
  );

  if (!groupId) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          background: "#000",
        }}
      >
        <p style={{ color: "#555" }}>Group not found.</p>
        <button
          onClick={onBack}
          style={{
            color: "#84cc16",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="cv-root" style={{ position: "relative" }}>
      {/* HEADER — same structure as ChatView */}
      <div className="cv-head">
        <button className="cv-back-btn" onClick={onBack}>
          <Ic.Back />
        </button>
        <div
          className="cv-head-info"
          style={{ cursor: "pointer" }}
          onClick={() => setShowMembers(true)}
        >
          <GroupIcon group={group} size={38} />
          <div className="cv-head-text">
            <div className="cv-head-name">{group.name || "Group Chat"}</div>
            <div
              className="cv-head-status"
              style={{ color: typing.length > 0 ? "#84cc16" : "#555" }}
            >
              {typing.length > 0
                ? `${typing[0]}${typing.length > 1 ? ` +${typing.length - 1}` : ""} typing…`
                : `${members.length} member${members.length !== 1 ? "s" : ""}`}
            </div>
          </div>
        </div>
        <div className="cv-head-right">
          <button
            className="cv-call-btn cv-call-audio"
            onClick={() => handleStartCall("group")}
            title="Voice call"
          >
            <Ic.Phone />
          </button>
          <button
            className="cv-call-btn cv-call-video"
            onClick={() => handleStartCall("group-video")}
            title="Video call"
          >
            <Ic.Video />
          </button>
          <button
            className="cv-call-btn"
            onClick={() => setShowMembers(true)}
            title="Members"
            style={{ color: "#84cc16" }}
          >
            <Ic.Users />
          </button>
          <button
            className="cv-more-btn"
            onClick={() => setShowMenu((m) => !m)}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="5" r="1.2" />
              <circle cx="12" cy="12" r="1.2" />
              <circle cx="12" cy="19" r="1.2" />
            </svg>
          </button>
        </div>
        {showMenu && (
          <>
            <div className="cv-overlay" onClick={() => setShowMenu(false)} />
            <div className="cv-menu">
              <button
                onClick={() => {
                  setShowBgPicker(true);
                  setShowMenu(false);
                }}
              >
                <Ic.Palette />
                <span>Change Background</span>
              </button>
            </div>
          </>
        )}
        {showBgPicker && (
          <>
            <div
              className="cv-overlay"
              onClick={() => setShowBgPicker(false)}
            />
            <div className="cv-bgpicker">
              {bgs.map((b, i) => (
                <button
                  key={i}
                  className={`cv-bgopt${selectedBg === i ? " cv-bgopt-on" : ""}`}
                  onClick={() => {
                    backgroundService.setConversationBackground(groupId, i);
                    setSelectedBg(i);
                    setShowBgPicker(false);
                  }}
                >
                  {b.isDefault ? (
                    <div className="cv-bgprev cv-bgprev-grid" />
                  ) : b.image ? (
                    <img src={b.image} alt={b.name} />
                  ) : (
                    <div
                      className="cv-bgprev"
                      style={{ background: b.value }}
                    />
                  )}
                  <span>{b.name}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* MESSAGES — same as ChatView */}
      <div
        className={`cv-msgs${isDefault ? " cv-msgs-default" : ""}`}
        style={bgStyle}
        ref={containerRef}
        onScroll={handleScroll}
      >
        <div className="cv-msgs-overlay" />
        <div className="cv-msgs-content">
          {/* Group banner */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              padding: "24px 16px 20px",
              borderBottom: "1px solid rgba(255,255,255,.04)",
              marginBottom: 8,
            }}
          >
            <GroupIcon group={group} size={72} />
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>
              {group.icon || "👥"} {group.name}
            </div>
            <div style={{ fontSize: 12, color: "#555" }}>
              {members.length} members
            </div>
            <button
              onClick={() => setShowMembers(true)}
              style={{
                padding: "7px 20px",
                borderRadius: 20,
                background: "rgba(132,204,22,.1)",
                border: "1px solid rgba(132,204,22,.25)",
                color: "#84cc16",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              View members
            </button>
          </div>

          {loading && (
            <div className="cv-loading">
              <div className="cv-spinner" />
            </div>
          )}

          {!loading &&
            messages.map((msg, idx) => {
              const isMe =
                msg.user_id === currentUser?.id ||
                msg.sender_id === currentUser?.id;
              const prev = messages[idx - 1];
              const showHeader =
                !isMe && (!prev || prev.user_id !== msg.user_id);
              return (
                <MsgRow
                  key={msg.id || msg._tempId || idx}
                  msg={msg}
                  isMe={isMe}
                  showHeader={showHeader}
                  allMembers={members}
                  messages={messages}
                  onReply={setReplyTo}
                  onScrollTo={scrollToMessage}
                  currentUserId={currentUser?.id}
                />
              );
            })}

          {typing.length > 0 && (
            <div className="cv-msg cv-them">
              <div className="cv-avatar-sp" />
              <div className="cv-bubble cv-bthem cv-typing-bubble">
                <div className="cv-dots">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {showJump && (
          <button className="cv-jump-btn" onClick={() => scrollToBottom()}>
            <Ic.Down />
          </button>
        )}
      </div>

      <GCInput
        onSend={handleSend}
        onTyping={handleTyping}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
      />

      {showMembers && (
        <MembersPanel
          members={members}
          group={group}
          currentUserId={currentUser?.id}
          onClose={() => setShowMembers(false)}
        />
      )}

      <style>{CV_CSS}</style>
    </div>
  );
};

export default GroupChatView;
