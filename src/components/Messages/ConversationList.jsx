// components/Messages/ConversationList.jsx — NOVA v6
// Groups appear for ALL members via groupDMService events + localStorage cache.
// groupDMService.init() is called here if not already initialized.

import React, { useState, useEffect, useCallback } from "react";
import { Search, X, MessageCircle, Plus } from "lucide-react";
import conversationState from "../../services/messages/ConversationStateManager";
import onlineStatusService from "../../services/messages/onlineStatusService";
import dmMessageService from "../../services/messages/dmMessageService";
import groupDMService from "../../services/messages/groupDMService";
import mediaUrlService from "../../services/shared/mediaUrlService";

const ConversationList = ({
  currentUserId,
  onSelect,
  onSelectGroup,
  onNewChat,
  onClose,
  loading,
  activeConversationId,
  activeGroupId,
  hideHeader,
}) => {
  const [search, setSearch] = useState("");
  const [conversations, setConversations] = useState([]);
  const [groups, setGroups] = useState([]);
  const [statusMap, setStatusMap] = useState(new Map());
  const [typingMap, setTypingMap] = useState(new Map());

  // ── DM conversations ────────────────────────────────────────────────────
  useEffect(() => {
    const update = () =>
      setConversations([...conversationState.getConversations()]);
    const unsub = conversationState.subscribe(update);
    update();
    return unsub;
  }, []);

  // ── Group chats — visible to ALL members ────────────────────────────────
  useEffect(() => {
    if (!currentUserId) return;

    // 1. Immediately hydrate from localStorage (instant, no network)
    const fromLS = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k?.startsWith("gc_meta_")) continue;
        try {
          const g = JSON.parse(localStorage.getItem(k) || "{}");
          if (
            g?.id &&
            g?.name &&
            Array.isArray(g?.members) &&
            g.members.some((m) => m?.id === currentUserId)
          ) {
            fromLS.push({ ...g, isGroup: true });
          }
        } catch (_) {}
      }
    } catch (_) {}
    if (fromLS.length) setGroups(fromLS);

    // 2. Ensure groupDMService is initialized for this user
    groupDMService.init(currentUserId);

    // 3. Load from DB (merges with cache)
    groupDMService.loadGroups().then((dbGroups) => {
      if (dbGroups.length) {
        setGroups((prev) => {
          const map = new Map(prev.map((g) => [g.id, g]));
          dbGroups.forEach((g) => {
            if (g?.id) map.set(g.id, { ...g, isGroup: true });
          });
          return Array.from(map.values());
        });
      }
    });

    // 4. Live updates — new group created anywhere
    const unsubList = groupDMService.on("group_list", (list) => {
      const valid = list.filter(
        (g) =>
          g?.id &&
          Array.isArray(g?.members) &&
          g.members.some((m) => m?.id === currentUserId),
      );
      setGroups(valid.map((g) => ({ ...g, isGroup: true })));
    });
    const unsubNew = groupDMService.on("new_group", (g) => {
      if (!g?.id) return;
      if (
        !Array.isArray(g?.members) ||
        !g.members.some((m) => m?.id === currentUserId)
      )
        return;
      setGroups((prev) =>
        prev.some((x) => x.id === g.id)
          ? prev.map((x) => (x.id === g.id ? { ...g, isGroup: true } : x))
          : [{ ...g, isGroup: true }, ...prev],
      );
    });
    const unsubUpdated = groupDMService.on("group_updated", (g) => {
      if (!g?.id) return;
      setGroups((prev) =>
        prev.map((x) => (x.id === g.id ? { ...x, ...g, isGroup: true } : x)),
      );
    });

    return () => {
      unsubList();
      unsubNew();
      unsubUpdated();
    };
  }, [currentUserId]);

  // ── Online status ────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onlineStatusService.subscribe((userId, status) => {
      setStatusMap((prev) => {
        const m = new Map(prev);
        m.set(userId, status);
        return m;
      });
    });
    conversations.forEach((conv) => {
      const other =
        conv.user1_id === currentUserId ? conv.user2?.id : conv.user1?.id;
      if (other) onlineStatusService.fetchStatus(other);
    });
    return unsub;
  }, [conversations, currentUserId]);

  // ── Typing indicators ────────────────────────────────────────────────────
  useEffect(() => {
    const unsubs = conversations.map((conv) => {
      return dmMessageService.subscribeToConversation(conv.id, {
        onTyping: (userId, isTyping, userName) => {
          const other =
            conv.user1_id === currentUserId ? conv.user2?.id : conv.user1?.id;
          if (userId === other) {
            setTypingMap((prev) => {
              const m = new Map(prev);
              if (isTyping) m.set(conv.id, userName || "User");
              else m.delete(conv.id);
              return m;
            });
          }
        },
      });
    });
    return () => unsubs.forEach((u) => u?.());
  }, [conversations, currentUserId]);

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const ms = Date.now() - new Date(dateStr);
    if (ms < 60000) return "now";
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m`;
    if (ms < 86400000) return `${Math.floor(ms / 3600000)}h`;
    if (ms < 604800000) return `${Math.floor(ms / 86400000)}d`;
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const getPreview = useCallback(
    (conv) => {
      const typingName = typingMap.get(conv.id);
      if (typingName) return `${typingName} is typing…`;
      const lm = conv.lastMessage;
      if (!lm || typeof lm !== "object") return "Start a conversation";
      const content = lm.content;
      if (
        !content ||
        typeof content !== "string" ||
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          content.trim(),
        )
      )
        return "Start a conversation";
      const isMe = lm.sender_id === currentUserId;
      return `${isMe ? "You: " : ""}${content.slice(0, 60)}`;
    },
    [typingMap, currentUserId],
  );

  const getAvatar = (user) => {
    if (!user?.avatar_id) return null;
    return mediaUrlService.getAvatarUrl(user.avatar_id, 200);
  };

  const sl = search.toLowerCase();
  const filteredConvs = conversations.filter((conv) => {
    if (!sl) return true;
    const other = conv.user1_id === currentUserId ? conv.user2 : conv.user1;
    return (
      (other?.full_name || "").toLowerCase().includes(sl) ||
      (other?.username || "").toLowerCase().includes(sl)
    );
  });
  const filteredGroups = groups.filter(
    (g) => !sl || (g?.name || "").toLowerCase().includes(sl),
  );
  const isEmpty =
    !loading && filteredConvs.length === 0 && filteredGroups.length === 0;

  return (
    <div className="cl-root">
      {!hideHeader && (
        <div className="cl-header">
          <button className="cl-close" onClick={onClose} aria-label="Close">
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
          </button>
          <h2 className="cl-title">Messages</h2>
          <button
            className="cl-new"
            onClick={onNewChat}
            aria-label="New message"
          >
            <Plus size={18} />
          </button>
        </div>
      )}

      <div className="cl-search">
        <Search size={14} className="cl-search-icon" />
        <input
          type="text"
          placeholder="Search conversations…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button className="cl-search-clear" onClick={() => setSearch("")}>
            <X size={12} />
          </button>
        )}
      </div>

      <div className="cl-list">
        {loading && (
          <div className="cl-loading">
            <div className="cl-spinner" />
          </div>
        )}

        {isEmpty && !loading && (
          <div className="cl-empty">
            <MessageCircle size={36} />
            <p>{search ? "No matches found" : "No conversations yet"}</p>
            {!search && (
              <button className="cl-start-btn" onClick={onNewChat}>
                Start a conversation
              </button>
            )}
          </div>
        )}

        {/* ── Group chats — visible to ALL members ── */}
        {filteredGroups.map((group) => {
          const isActive = group.id === activeGroupId;
          const members = Array.isArray(group.members) ? group.members : [];
          const lastMsg = group.lastMessage;
          const preview = lastMsg?.content
            ? lastMsg.user_id === currentUserId
              ? `You: ${lastMsg.content.slice(0, 50)}`
              : lastMsg.content.slice(0, 50)
            : `${members.length} members`;

          return (
            <div
              key={group.id}
              className={`cl-item${isActive ? " cl-active" : ""}`}
              onClick={() => onSelectGroup?.(group)}
            >
              <div className="cl-av-wrap">
                <div className="cl-group-av">{group.icon || "👥"}</div>
              </div>
              <div className="cl-info">
                <div className="cl-top">
                  <span className="cl-name">
                    {group.name}
                    <span className="cl-group-tag">Group</span>
                  </span>
                  <span className="cl-time">
                    {formatTime(group.updated_at || group.created_at)}
                  </span>
                </div>
                <div className="cl-bottom">
                  <span className="cl-preview">{preview}</span>
                  <span className="cl-member-count">
                    {members.length}{" "}
                    <svg
                      width="10"
                      height="10"
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
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {/* ── DM conversations ── */}
        {filteredConvs.map((conv) => {
          const other =
            conv.user1_id === currentUserId ? conv.user2 : conv.user1;
          const status = statusMap.get(other?.id) || { online: false };
          const isActive = conv.id === activeConversationId;
          const unread = conv.unreadCount || 0;
          const hasUnread = !isActive && unread > 0;
          const avatarUrl = getAvatar(other);
          const isTyping = typingMap.has(conv.id);
          const preview = getPreview(conv);

          return (
            <div
              key={conv.id}
              className={`cl-item${hasUnread ? " cl-unread" : ""}${isActive ? " cl-active" : ""}`}
              onClick={() => onSelect(conv)}
            >
              <div className="cl-av-wrap">
                <div className="cl-avatar">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={other?.full_name || "User"} />
                  ) : (
                    (other?.full_name || "U").charAt(0).toUpperCase()
                  )}
                </div>
                <div className={`cl-dot${status.online ? " cl-dot-on" : ""}`} />
              </div>
              <div className="cl-info">
                <div className="cl-top">
                  <span className="cl-name">
                    {other?.full_name || "Unknown"}
                  </span>
                  <span className="cl-time">
                    {formatTime(
                      conv.lastMessage?.created_at || conv.last_message_at,
                    )}
                  </span>
                </div>
                <div className="cl-bottom">
                  <span
                    className={`cl-preview${hasUnread ? " cl-preview-bold" : ""}${isTyping ? " cl-preview-typing" : ""}`}
                  >
                    {preview}
                  </span>
                  {hasUnread && !isTyping && (
                    <span className="cl-badge">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .cl-root{display:flex;flex-direction:column;height:100%;background:#000;overflow:hidden;padding-top:env(safe-area-inset-top,0px);}
        .cl-header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px 10px;border-bottom:1px solid rgba(132,204,22,.1);flex-shrink:0;}
        .cl-title{font-size:18px;font-weight:800;color:#fff;margin:0;flex:1;text-align:center;letter-spacing:-.3px;}
        .cl-close{width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;color:#84cc16;cursor:pointer;transition:background .2s;}
        .cl-close:hover{background:rgba(132,204,22,.1);}
        .cl-new{width:36px;height:36px;border-radius:10px;background:rgba(132,204,22,.12);border:1px solid rgba(132,204,22,.25);display:flex;align-items:center;justify-content:center;color:#84cc16;cursor:pointer;transition:background .2s;}
        .cl-new:hover{background:rgba(132,204,22,.2);}
        .cl-search{display:flex;align-items:center;gap:8px;margin:10px 14px;padding:9px 12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;flex-shrink:0;}
        .cl-search-icon{color:#555;flex-shrink:0;}
        .cl-search input{flex:1;background:transparent;border:none;color:#fff;font-size:14px;outline:none;caret-color:#84cc16;}
        .cl-search input::placeholder{color:#444;}
        .cl-search-clear{background:none;border:none;color:#555;cursor:pointer;display:flex;align-items:center;}
        .cl-list{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding-bottom:env(safe-area-inset-bottom,16px);}
        .cl-list::-webkit-scrollbar{width:3px;}.cl-list::-webkit-scrollbar-thumb{background:rgba(132,204,22,.2);border-radius:2px;}
        .cl-loading{display:flex;justify-content:center;align-items:center;padding:60px 20px;}
        .cl-spinner{width:28px;height:28px;border:3px solid rgba(132,204,22,.15);border-top-color:#84cc16;border-radius:50%;animation:clSpin .7s linear infinite;}
        @keyframes clSpin{to{transform:rotate(360deg)}}
        .cl-empty{display:flex;flex-direction:column;align-items:center;padding:60px 20px;gap:10px;color:#444;text-align:center;}
        .cl-empty p{margin:0;font-size:14px;color:#555;}
        .cl-start-btn{margin-top:8px;padding:10px 24px;border-radius:20px;background:rgba(132,204,22,.12);border:1px solid rgba(132,204,22,.3);color:#84cc16;font-size:13px;font-weight:700;cursor:pointer;transition:background .2s;}
        .cl-start-btn:hover{background:rgba(132,204,22,.2);}
        .cl-item{display:flex;align-items:center;gap:12px;padding:11px 16px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,.025);transition:background .15s;-webkit-tap-highlight-color:transparent;}
        .cl-item:hover{background:rgba(255,255,255,.03);}
        .cl-unread{background:rgba(132,204,22,.025);}
        .cl-active{background:rgba(132,204,22,.07);}
        .cl-av-wrap{position:relative;flex-shrink:0;}
        .cl-avatar{width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,#1a1a1a,#222);border:2px solid rgba(255,255,255,.07);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#84cc16;overflow:hidden;}
        .cl-avatar img{width:100%;height:100%;object-fit:cover;}
        .cl-dot{position:absolute;bottom:1px;right:1px;width:12px;height:12px;border-radius:50%;border:2px solid #000;background:#333;transition:background .3s;}
        .cl-dot.cl-dot-on{background:#22c55e;}
        .cl-group-av{width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,#0d1a00,#1a3300);border:2px solid rgba(132,204,22,.2);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;}
        .cl-info{flex:1;min-width:0;}
        .cl-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:3px;}
        .cl-name{font-size:14px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0;display:flex;align-items:center;gap:6px;}
        .cl-group-tag{font-size:9px;font-weight:700;color:#84cc16;background:rgba(132,204,22,.12);border:1px solid rgba(132,204,22,.25);border-radius:4px;padding:1px 5px;text-transform:uppercase;letter-spacing:.3px;flex-shrink:0;}
        .cl-time{font-size:11px;color:#444;flex-shrink:0;margin-left:8px;}
        .cl-bottom{display:flex;align-items:center;justify-content:space-between;gap:8px;}
        .cl-preview{font-size:13px;color:#4a4a4a;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .cl-preview-bold{color:#888;font-weight:600;}
        .cl-preview-typing{color:#84cc16;font-style:italic;}
        .cl-badge{min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:#84cc16;color:#000;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        .cl-member-count{font-size:11px;color:#555;flex-shrink:0;display:flex;align-items:center;gap:2px;}
      `}</style>
    </div>
  );
};

export default ConversationList;
