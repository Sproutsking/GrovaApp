// ============================================================================
// components/Messages/GroupChatView.jsx — NOVA GROUP CHAT v2 FINAL
// ============================================================================
// FIXED:
//  [1] Group chats persist in chat list for ALL members via localStorage + DB
//  [2] Avatar images rendered everywhere — no fallback letters if img exists
//  [3] Edit group name and icon
//  [4] Full DM-style background experience
//  [5] Online status dots on avatars correctly positioned ON the border
//  [6] Members can all see the group after creation
//  [7] Guard against initialGroup being undefined — no more crash on mount
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../../services/config/supabase";
import mediaUrlService from "../../services/shared/mediaUrlService";
import MessageInput from "./MessageInput";

/* ─── ICONS ─── */
const Ic = {
  Back:  ()=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  Phone: ()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>,
  Video: ()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>,
  Users: ()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  Edit:  ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Down:  ()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
  Close: ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Check: ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Camera:()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>,
};

const GROUP_ICONS = ["👥","🌟","🚀","💡","🎯","🔥","💎","🌈","⚡","🎮","🎵","📚","🏆","💪","🌍","🎨","🦁","🐺","🦋","🌸"];

/* ─── Avatar with image ─── */
const UAv = ({ user, size=36, showDot=false, online=false }) => {
  const [err, setErr] = useState(false);
  const id  = user?.avatar_id || user?.avatarId;
  const url = !err && id ? mediaUrlService.getAvatarUrl(id, 200) : null;
  const ini = (user?.full_name || user?.name || "?").charAt(0).toUpperCase();

  return (
    <div className="uav-wrap" style={{ width: size, height: size, position: "relative", flexShrink: 0 }}>
      <div className="uav-circle" style={{ width: size, height: size, fontSize: size * 0.38 }}>
        {url
          ? <img src={url} alt={user?.full_name || "?"} onError={() => setErr(true)}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
          : <span style={{ fontWeight: 800, color: "#84cc16" }}>{ini}</span>
        }
      </div>
      {showDot && (
        <div className={`uav-dot${online ? " uav-dot-on" : ""}`}
          style={{ width: size * 0.28, height: size * 0.28, border: `${Math.max(1.5, size * 0.05)}px solid #000` }}/>
      )}
    </div>
  );
};

/* ─── Group Avatar (quad grid) ─── */
const GroupAv = ({ members=[], size=44, icon="👥" }) => {
  const shown = (Array.isArray(members) ? members : []).filter(Boolean).slice(0, 4);
  const q = size / 2 - 2;
  if (shown.length === 0) {
    return (
      <div className="gav-root" style={{ width: size, height: size, fontSize: size * 0.45 }}>
        <span>{icon || "👥"}</span>
      </div>
    );
  }
  if (shown.length === 1) {
    return (
      <div className="gav-root gav-single" style={{ width: size, height: size }}>
        <UAv user={shown[0]} size={size}/>
      </div>
    );
  }
  return (
    <div className="gav-root gav-grid" style={{ width: size, height: size }}>
      {shown.map((m, i) => (
        <div key={m?.id || i} className="gav-cell" style={{ width: q, height: q }}>
          <UAv user={m} size={q}/>
        </div>
      ))}
    </div>
  );
};

/* ─── Typing indicator ─── */
const TypingRow = ({ names }) => {
  if (!names?.length) return null;
  const label = names.length === 1 ? `${names[0]} is typing`
    : names.length === 2 ? `${names[0]} and ${names[1]} are typing`
    : `${names[0]} and ${names.length - 1} others are typing`;
  return (
    <div className="gc-typing">
      <span className="gc-typing-lbl">{label}</span>
      <div className="gc-typing-dots"><span/><span/><span/></div>
    </div>
  );
};

/* ─── Edit Group Modal ─── */
const EditGroupModal = ({ group, currentUser, members, onSave, onClose }) => {
  const [name,   setName]   = useState(group?.name || "");
  const [icon,   setIcon]   = useState(group?.icon || "👥");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const key  = `gc_meta_${group?.id}`;
      const meta = JSON.parse(localStorage.getItem(key) || "{}");
      meta.name = name.trim(); meta.icon = icon;
      localStorage.setItem(key, JSON.stringify(meta));
      onSave({ name: name.trim(), icon });
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <div className="egm-ov" onClick={onClose}>
      <div className="egm-modal" onClick={e => e.stopPropagation()}>
        <div className="egm-hd">
          <button className="egm-cancel" onClick={onClose}>Cancel</button>
          <span className="egm-title">Edit Group</span>
          <button className="egm-save" onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? "…" : "Save"}
          </button>
        </div>
        <div className="egm-body">
          <div className="egm-cur-icon">{icon}</div>
          <p className="egm-lbl">Group Icon</p>
          <div className="egm-icon-grid">
            {GROUP_ICONS.map(ic => (
              <button key={ic} className={`egm-icon-btn${icon===ic?" egm-icon-sel":""}`}
                onClick={() => setIcon(ic)}>{ic}</button>
            ))}
          </div>
          <p className="egm-lbl">Group Name</p>
          <input className="egm-inp" value={name} onChange={e => setName(e.target.value)}
            maxLength={60} placeholder="Group name…"/>
          <p className="egm-members-hd">Members ({(members || []).length})</p>
          <div className="egm-members">
            {(members || []).map(m => (
              <div key={m?.id} className="egm-member">
                <UAv user={m} size={36}/>
                <span className="egm-mname">{m?.full_name}{m?.id===currentUser?.id?" (You)":""}</span>
                {m?.is_admin && <span className="egm-crown">👑</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── Members Panel ─── */
const MembersPanel = ({ members, group, currentUserId, onClose, onEdit }) => (
  <div className="gmp-overlay" onClick={onClose}>
    <div className="gmp-panel" onClick={e => e.stopPropagation()}>
      <div className="gmp-header">
        <span className="gmp-title">{group?.icon||"👥"} {group?.name} · {(members||[]).length}</span>
        <div style={{display:"flex",gap:6}}>
          {(members||[]).find(m=>m?.id===currentUserId)?.is_admin && (
            <button className="gmp-edit-btn" onClick={()=>{onClose();onEdit();}}><Ic.Edit/></button>
          )}
          <button className="gmp-close" onClick={onClose}><Ic.Close/></button>
        </div>
      </div>
      <div className="gmp-list">
        {(members||[]).map(m => {
          const isMe = m?.id === currentUserId;
          return (
            <div key={m?.id} className="gmp-member">
              <UAv user={m} size={42} showDot={true} online={m?.online}/>
              <div className="gmp-info">
                <span className="gmp-name">{m?.full_name}{isMe?" (You)":""}</span>
                <span className="gmp-role">{m?.is_admin?"👑 Admin":m?.online?"Online":"Offline"}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </div>
);

/* ─── Message Bubble ─── */
const MsgBubble = ({ msg, isMe, showAvatar, members }) => {
  const [showReact, setShowReact] = useState(false);
  const safeMems   = Array.isArray(members) ? members : [];
  const sender     = safeMems.find(m => m?.id === (msg?.sender_id || msg?.user_id));
  const senderName = isMe ? "You" : (sender?.full_name || "Unknown");
  const EMOJI      = ["👍","❤️","😂","😮","😢","🔥"];

  const fmtTime = d => {
    if (!d) return "";
    const dt = new Date(d);
    const h  = dt.getHours() % 12 || 12;
    const m  = dt.getMinutes().toString().padStart(2,"0");
    return `${h}:${m} ${dt.getHours()>=12?"PM":"AM"}`;
  };

  const isValid = msg?.content && typeof msg.content === "string" &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(msg.content.trim());

  return (
    <div className={`gcm-wrap${isMe?" gcm-me":" gcm-them"}`}>
      {!isMe && (
        <div className="gcm-av-col">
          {showAvatar ? <UAv user={sender||{full_name:senderName}} size={32}/> : <div className="gcm-av-sp"/>}
        </div>
      )}
      <div className="gcm-col">
        {!isMe && showAvatar && <div className="gcm-sender">{senderName}</div>}
        <div className={`gcm-bubble${isMe?" gcm-me-b":" gcm-them-b"}${msg?._optimistic?" gcm-opt":""}${msg?._failed?" gcm-fail":""}`}
          onDoubleClick={() => setShowReact(p=>!p)}>
          {isValid
            ? <span className="gcm-text">{msg.content}</span>
            : <span className="gcm-bad">[Message unavailable]</span>
          }
          {showReact && (
            <div className="gcm-react-bar">
              {EMOJI.map(e => <button key={e} className="gcm-react-btn" onClick={()=>setShowReact(false)}>{e}</button>)}
            </div>
          )}
        </div>
        <div className={`gcm-meta${isMe?" gcm-meta-me":""}`}>
          <span className="gcm-time">{fmtTime(msg?.created_at)}</span>
          {isMe && <span className="gcm-ticks">{msg?._optimistic?"✓":msg?.read?<span style={{color:"#22c55e"}}>✓✓</span>:msg?.delivered?"✓✓":"✓"}</span>}
        </div>
        {msg?.reactions && Object.keys(msg.reactions).length > 0 && (
          <div className="gcm-react-disp">
            {Object.entries(msg.reactions).map(([e,c])=><span key={e} className="gcm-react-chip">{e} {c}</span>)}
          </div>
        )}
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════
   MAIN GROUP CHAT VIEW
   — group prop defaults to {} so the component never
     crashes when the prop is momentarily undefined
════════════════════════════════════════════════════ */
const GroupChatView = ({ group: initialGroup = {}, currentUser, onBack, onStartCall }) => {
  // ── Safe initial values — guard every field so nothing explodes on mount ──
  const safeInitial = {
    id:      initialGroup?.id      || "",
    name:    initialGroup?.name    || "Group Chat",
    icon:    initialGroup?.icon    || "👥",
    members: Array.isArray(initialGroup?.members) ? initialGroup.members : [],
  };

  const [group,       setGroup]       = useState({ icon:"👥", ...safeInitial });
  const [messages,    setMessages]    = useState([]);
  const [members,     setMembers]     = useState(safeInitial.members);
  const [loading,     setLoading]     = useState(true);
  const [typingNames, setTypingNames] = useState([]);
  const [showMembers, setShowMembers] = useState(false);
  const [showEdit,    setShowEdit]    = useState(false);
  const [showJump,    setShowJump]    = useState(false);
  const [bg,          setBg]          = useState(null);

  const endRef       = useRef(null);
  const containerRef = useRef(null);
  const channelRef   = useRef(null);
  const typingMap    = useRef(new Map());
  const typingTOs    = useRef({});
  const mountedRef   = useRef(true);
  const isAtBottom   = useRef(true);

  // If the group id is empty there is nothing to load — bail early after render
  const groupId = group?.id;

  const scrollToBottom = (beh="smooth") => endRef.current?.scrollIntoView({ behavior: beh });
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    isAtBottom.current = scrollHeight - scrollTop - clientHeight < 80;
    setShowJump(!isAtBottom.current);
  };

  // ── Persist group to localStorage for ALL members ──────────────────────
  useEffect(() => {
    if (!groupId) return;
    const key      = `gc_meta_${groupId}`;
    const existing = JSON.parse(localStorage.getItem(key) || "{}");
    const updated  = { ...existing, id: groupId, name: group.name, icon: group.icon || "👥", members };
    localStorage.setItem(key, JSON.stringify(updated));

    if (channelRef.current && currentUser?.id) {
      channelRef.current.send({
        type: "broadcast", event: "gc_group_meta",
        payload: { id: groupId, name: group.name, icon: group.icon || "👥", members },
      });
    }
  }, [groupId, group.name, group.icon, members, currentUser?.id]);

  // ── Load messages from localStorage + DB ──────────────────────────────
  useEffect(() => {
    if (!groupId) { setLoading(false); return; }
    mountedRef.current = true;

    // Restore messages from localStorage first (instant)
    const localKey = `gc_msgs_${groupId}`;
    try {
      const cached = JSON.parse(localStorage.getItem(localKey) || "[]");
      if (cached.length > 0) { setMessages(cached); setLoading(false); setTimeout(()=>scrollToBottom("auto"),40); }
    } catch { /* corrupt cache — ignore */ }

    // Restore group meta
    const metaKey = `gc_meta_${groupId}`;
    try {
      const meta = JSON.parse(localStorage.getItem(metaKey) || "{}");
      if (meta.name) setGroup(g => ({ ...g, ...meta }));
      if (Array.isArray(meta.members) && meta.members.length > 0) setMembers(meta.members);
    } catch { /* ignore */ }

    // Fetch from DB
    (async () => {
      try {
        const { data, error } = await supabase
          .from("community_messages")
          .select(`id,channel_id,user_id,content,created_at,reactions,attachments`)
          .eq("channel_id", groupId)
          .is("deleted_at", null)
          .order("created_at", { ascending: true })
          .limit(200);

        if (!error && mountedRef.current && Array.isArray(data)) {
          const enriched = data.map(m => ({ ...m, sender_id: m.user_id }));
          setMessages(enriched);
          localStorage.setItem(localKey, JSON.stringify(enriched.slice(-100)));
          setLoading(false);
          setTimeout(() => scrollToBottom("auto"), 60);
        } else {
          if (mountedRef.current) setLoading(false);
        }
      } catch {
        if (mountedRef.current) setLoading(false);
      }
    })();

    return () => { mountedRef.current = false; };
  }, [groupId]);

  // ── Realtime subscription ──────────────────────────────────────────────
  useEffect(() => {
    if (!groupId) return;
    const ch = supabase
      .channel(`gc:${groupId}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "gc_msg" }, ({ payload }) => {
        if (!mountedRef.current) return;
        setMessages(prev => {
          if (prev.some(m => m.id === payload.id || m._tempId === payload._tempId)) return prev;
          const next = [...prev, payload];
          localStorage.setItem(`gc_msgs_${groupId}`, JSON.stringify(next.slice(-100)));
          return next;
        });
        if (isAtBottom.current) setTimeout(scrollToBottom, 10);
      })
      .on("broadcast", { event: "gc_typing" }, ({ payload }) => {
        if (!mountedRef.current || payload?.userId === currentUser?.id) return;
        typingMap.current.set(payload.userId, payload.userName);
        setTypingNames(Array.from(typingMap.current.values()));
        clearTimeout(typingTOs.current[payload.userId]);
        typingTOs.current[payload.userId] = setTimeout(() => {
          typingMap.current.delete(payload.userId);
          if (mountedRef.current) setTypingNames(Array.from(typingMap.current.values()));
        }, 3000);
      })
      .on("broadcast", { event: "gc_group_meta" }, ({ payload }) => {
        if (!mountedRef.current) return;
        if (payload?.name) setGroup(g => ({ ...g, name: payload.name, icon: payload.icon || g.icon }));
        if (Array.isArray(payload?.members) && payload.members.length > 0) setMembers(payload.members);
        localStorage.setItem(`gc_meta_${groupId}`, JSON.stringify(payload));
      })
      .subscribe();

    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); channelRef.current = null; };
  }, [groupId, currentUser?.id]);

  const handleSend = useCallback(async (text) => {
    if (!text?.trim() || !currentUser?.id || !groupId) return;
    const tempId    = `temp_${Date.now()}_${Math.random().toString(36).slice(2,5)}`;
    const optimistic = {
      id: tempId, _tempId: tempId, _optimistic: true,
      channel_id: groupId, user_id: currentUser.id, sender_id: currentUser.id,
      content: text.trim(), created_at: new Date().toISOString(),
    };
    setMessages(prev => {
      const next = [...prev, optimistic];
      localStorage.setItem(`gc_msgs_${groupId}`, JSON.stringify(next.slice(-100)));
      return next;
    });
    setTimeout(scrollToBottom, 10);
    channelRef.current?.send({ type: "broadcast", event: "gc_msg", payload: { ...optimistic, _optimistic: false } });

    try {
      const { data, error } = await supabase
        .from("community_messages")
        .insert({ channel_id: groupId, user_id: currentUser.id, content: text.trim() })
        .select().single();
      if (error) throw error;
      const real = { ...data, sender_id: data.user_id };
      setMessages(prev => {
        const next = prev.map(m => m._tempId === tempId ? real : m);
        localStorage.setItem(`gc_msgs_${groupId}`, JSON.stringify(next.slice(-100)));
        return next;
      });
    } catch {
      setMessages(prev => prev.map(m => m._tempId === tempId ? { ...m, _failed: true } : m));
    }
  }, [groupId, currentUser?.id]);

  const handleTyping = useCallback(() => {
    channelRef.current?.send({
      type: "broadcast", event: "gc_typing",
      payload: { userId: currentUser?.id, userName: currentUser?.fullName || currentUser?.full_name || "Someone" },
    });
  }, [currentUser]);

  const handleStartCall = useCallback((type) => {
    onStartCall?.({
      name: group.name || "Group Call", initial: (group.icon || "👥"),
      type, outgoing: true,
      callId: `call_${groupId}_${Date.now()}`,
      participants: members
        .filter(m => m?.id !== currentUser?.id)
        .map(m => ({
          id: m.id, full_name: m.full_name, name: m.full_name,
          avatar_id: m.avatar_id, avatarId: m.avatar_id,
          muted: false, camOff: false,
        })),
    });
  }, [group, groupId, members, currentUser?.id, onStartCall]);

  const handleGroupSave = useCallback(({ name, icon }) => {
    setGroup(g => ({ ...g, name, icon }));
    if (!groupId) return;
    const metaKey = `gc_meta_${groupId}`;
    const meta    = JSON.parse(localStorage.getItem(metaKey) || "{}");
    meta.name = name; meta.icon = icon;
    localStorage.setItem(metaKey, JSON.stringify(meta));
  }, [groupId]);

  // ── Early exit — if we have no group id, something is badly wrong ──────
  if (!groupId) {
    return (
      <div className="gc-root" style={{ alignItems:"center", justifyContent:"center" }}>
        <div style={{ color:"#555", fontSize:13, padding:24, textAlign:"center" }}>
          Group not found. Please go back and try again.
        </div>
        <button className="gc-back" onClick={onBack} style={{ margin:"0 auto" }}>
          <Ic.Back/>
        </button>
        <style>{GC_CSS}</style>
      </div>
    );
  }

  const otherMembers = members.filter(m => m?.id !== currentUser?.id);

  const BG_OPTIONS = [
    { value:"repeating-linear-gradient(0deg,rgba(132,204,22,.03) 0px,rgba(132,204,22,.03) 1px,transparent 1px,transparent 28px),repeating-linear-gradient(90deg,rgba(132,204,22,.03) 0px,rgba(132,204,22,.03) 1px,transparent 1px,transparent 28px),#000" },
    { value:"#000" },
    { value:"radial-gradient(ellipse 80% 60% at 50% 40%,rgba(34,197,94,.08) 0%,#000 70%),#000" },
    { value:"radial-gradient(ellipse 80% 60% at 50% 40%,rgba(96,165,250,.08) 0%,#000 70%),#000" },
    { value:"radial-gradient(ellipse 80% 60% at 50% 40%,rgba(192,132,252,.08) 0%,#000 70%),#000" },
  ];
  const bgStyle = { background: BG_OPTIONS[bg ?? 0]?.value || "#000" };

  return (
    <div className="gc-root">
      {/* ── HEADER ── */}
      <div className="gc-header">
        <button className="gc-back" onClick={onBack}><Ic.Back/></button>
        <div className="gc-header-info" onClick={() => setShowMembers(true)}>
          <GroupAv members={otherMembers} size={40} icon={group.icon||"👥"}/>
          <div className="gc-header-text">
            <div className="gc-group-name">{group.name || "Group Chat"}</div>
            <div className="gc-member-count">
              {members.length} member{members.length !== 1 ? "s" : ""}
              {typingNames.length > 0 && <span className="gc-typing-hdr"> · typing…</span>}
            </div>
          </div>
        </div>
        <div className="gc-header-actions">
          <button className="gc-action-btn" onClick={() => handleStartCall("group")} title="Voice call"><Ic.Phone/></button>
          <button className="gc-action-btn gc-action-video" onClick={() => handleStartCall("group-video")} title="Video call"><Ic.Video/></button>
          <button className="gc-action-btn" onClick={() => setShowMembers(true)} title="Members"><Ic.Users/></button>
        </div>
      </div>

      {/* ── MESSAGES ── */}
      <div className="gc-messages" ref={containerRef} onScroll={handleScroll} style={bgStyle}>
        <div className="gc-msgs-overlay"/>
        {loading
          ? <div className="gc-loading"><div className="gc-spinner"/></div>
          : (
            <div className="gc-msg-content">
              {/* Group info banner */}
              <div className="gc-info-banner">
                <GroupAv members={otherMembers} size={72} icon={group.icon||"👥"}/>
                <div className="gc-banner-name">{group.icon||"👥"} {group.name}</div>
                <div className="gc-banner-sub">Group · {members.length} members</div>
                <div className="gc-banner-btns">
                  <button className="gc-banner-btn" onClick={() => setShowMembers(true)}>View members</button>
                  {members.find(m=>m?.id===currentUser?.id)?.is_admin && (
                    <button className="gc-banner-btn gc-edit-btn" onClick={() => setShowEdit(true)}><Ic.Edit/> Edit group</button>
                  )}
                </div>
              </div>

              {messages.map((msg, idx) => {
                const isMe       = msg?.sender_id === currentUser?.id || msg?.user_id === currentUser?.id;
                const prev       = messages[idx - 1];
                const showAvatar = !isMe && (!prev || (prev?.sender_id !== msg?.sender_id && prev?.user_id !== msg?.sender_id));
                return (
                  <MsgBubble
                    key={msg?.id || msg?._tempId || idx}
                    msg={{ ...msg, sender_id: msg?.sender_id || msg?.user_id }}
                    isMe={isMe} showAvatar={showAvatar} members={members}
                  />
                );
              })}

              <TypingRow names={typingNames}/>
              <div ref={endRef}/>
            </div>
          )
        }

        {showJump && (
          <button className="gc-jump-btn" onClick={scrollToBottom}><Ic.Down/></button>
        )}
      </div>

      <MessageInput onSend={handleSend} onTyping={handleTyping}/>

      {showMembers && (
        <MembersPanel members={members} group={group} currentUserId={currentUser?.id}
          onClose={() => setShowMembers(false)} onEdit={() => setShowEdit(true)}/>
      )}
      {showEdit && (
        <EditGroupModal group={group} currentUser={currentUser} members={members}
          onSave={handleGroupSave} onClose={() => setShowEdit(false)}/>
      )}

      <style>{GC_CSS}</style>
    </div>
  );
};

const GC_CSS = `
/* ── Root ── */
.gc-root { display:flex;flex-direction:column;height:100%;background:#000;overflow:hidden; }

/* ── Avatar ── */
.uav-wrap { position:relative;flex-shrink:0; }
.uav-circle { border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0d0d0d,#1c1c1c);border:2px solid rgba(132,204,22,.2); }
.uav-circle img { border-radius:50%; }
.uav-dot { position:absolute;bottom:0;right:0;border-radius:50%;background:#555; }
.uav-dot.uav-dot-on { background:#22c55e; }

/* ── Group avatar ── */
.gav-root { border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0d1a00,#1a3300);border:2px solid rgba(132,204,22,.2);flex-shrink:0; }
.gav-single { overflow:hidden; }
.gav-grid { display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:1px;padding:2px; }
.gav-cell { display:flex;align-items:center;justify-content:center;border-radius:3px;overflow:hidden; }

/* ── Header ── */
.gc-header {
  display:flex;align-items:center;gap:10px;
  padding-top: calc(env(safe-area-inset-top, 0px) + 10px);
  padding-right: 14px;
  padding-bottom: 10px;
  padding-left: 14px;
  background:rgba(0,0,0,.98);border-bottom:1px solid rgba(132,204,22,.12);flex-shrink:0;z-index:10;
}
.gc-back { width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);color:#84cc16;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0; }
.gc-header-info { display:flex;align-items:center;gap:10px;flex:1;cursor:pointer;min-width:0; }
.gc-header-text { flex:1;min-width:0; }
.gc-group-name { font-size:14px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
.gc-member-count { font-size:11px;color:#555;margin-top:1px; }
.gc-typing-hdr { color:#84cc16; }
.gc-header-actions { display:flex;gap:6px;flex-shrink:0; }
.gc-action-btn { width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);color:#84cc16;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s; }
.gc-action-btn:hover { background:rgba(132,204,22,.1); }
.gc-action-video { color:#60a5fa; }

/* ── Messages ── */
.gc-messages { flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;position:relative; }
.gc-messages::-webkit-scrollbar { width:3px; }
.gc-messages::-webkit-scrollbar-thumb { background:rgba(132,204,22,.15);border-radius:2px; }
.gc-msgs-overlay { position:absolute;inset:0;background:rgba(0,0,0,.15);pointer-events:none;z-index:0; }
.gc-msg-content { position:relative;z-index:1;padding:12px 14px 16px;display:flex;flex-direction:column;gap:2px; }
.gc-loading { display:flex;justify-content:center;padding:40px; }
.gc-spinner { width:22px;height:22px;border:2px solid rgba(132,204,22,.15);border-top-color:#84cc16;border-radius:50%;animation:gcSpin .7s linear infinite; }
@keyframes gcSpin { to{transform:rotate(360deg)} }

/* ── Info banner ── */
.gc-info-banner { display:flex;flex-direction:column;align-items:center;gap:10px;padding:24px 16px 20px;margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,.04); }
.gc-banner-name { font-size:20px;font-weight:800;color:#fff; }
.gc-banner-sub { font-size:12px;color:#555; }
.gc-banner-btns { display:flex;gap:8px;flex-wrap:wrap;justify-content:center; }
.gc-banner-btn { padding:7px 20px;border-radius:20px;background:rgba(132,204,22,.1);border:1px solid rgba(132,204,22,.25);color:#84cc16;font-size:12px;font-weight:700;cursor:pointer;transition:background .15s;display:flex;align-items:center;gap:6px; }
.gc-banner-btn:hover { background:rgba(132,204,22,.18); }
.gc-edit-btn { background:rgba(96,165,250,.1);border-color:rgba(96,165,250,.25);color:#60a5fa; }
.gc-edit-btn:hover { background:rgba(96,165,250,.18); }

/* ── Typing ── */
.gc-typing { display:flex;align-items:center;gap:8px;padding:6px 0; }
.gc-typing-lbl { font-size:12px;color:#555;font-style:italic; }
.gc-typing-dots { display:flex;gap:3px; }
.gc-typing-dots span { width:5px;height:5px;border-radius:50%;background:#555;animation:tdB 1.2s ease infinite; }
.gc-typing-dots span:nth-child(2){animation-delay:.15s;}
.gc-typing-dots span:nth-child(3){animation-delay:.3s;}
@keyframes tdB { 0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-5px);opacity:1} }

/* ── Jump btn ── */
.gc-jump-btn { position:absolute;bottom:16px;right:16px;z-index:5;width:38px;height:38px;border-radius:50%;background:rgba(10,10,10,.96);border:1px solid rgba(132,204,22,.4);color:#84cc16;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.6); }

/* ── Bubbles ── */
.gcm-wrap { display:flex;align-items:flex-end;gap:8px;animation:msgIn .18s ease-out both; }
.gcm-me { flex-direction:row-reverse; }
@keyframes msgIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
.gcm-av-col { width:32px;flex-shrink:0; }
.gcm-av-sp { width:32px;flex-shrink:0; }
.gcm-col { display:flex;flex-direction:column;max-width:75%;gap:2px; }
.gcm-sender { font-size:11px;color:#555;font-weight:600;padding-left:2px;margin-bottom:1px; }
.gcm-bubble { padding:9px 13px;border-radius:18px;word-break:break-word;position:relative; }
.gcm-them-b { background:rgba(18,18,18,.98);border:1px solid rgba(255,255,255,.06);border-bottom-left-radius:4px; }
.gcm-me-b { background:linear-gradient(135deg,rgba(132,204,22,.22),rgba(101,163,13,.16));border:1px solid rgba(132,204,22,.28);border-bottom-right-radius:4px; }
.gcm-opt { opacity:.65; }
.gcm-fail { opacity:.4; }
.gcm-text { font-size:14px;color:#f0f0f0;line-height:1.5; }
.gcm-bad { font-size:12px;color:#444;font-style:italic; }
.gcm-meta { display:flex;align-items:center;gap:4px;margin-top:2px;padding-left:2px; }
.gcm-meta-me { justify-content:flex-end;padding-right:2px;padding-left:0; }
.gcm-time { font-size:10px;color:#555; }
.gcm-ticks { font-size:11px;font-weight:700;color:#444; }
.gcm-react-bar { display:flex;gap:4px;margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,.07);flex-wrap:wrap; }
.gcm-react-btn { font-size:18px;cursor:pointer;transition:transform .15s;background:none;border:none;padding:2px; }
.gcm-react-btn:hover { transform:scale(1.3); }
.gcm-react-disp { display:flex;gap:4px;flex-wrap:wrap;margin-top:2px; }
.gcm-react-chip { padding:2px 7px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);font-size:11px;color:#ccc; }

/* ── Members panel ── */
.gmp-overlay { position:absolute;inset:0;background:rgba(0,0,0,.6);z-index:20;display:flex;justify-content:flex-end;backdrop-filter:blur(4px); }
.gmp-panel { width:280px;height:100%;background:#080808;border-left:1px solid rgba(132,204,22,.15);display:flex;flex-direction:column;animation:slideR .25s ease-out; }
@keyframes slideR { from{transform:translateX(100%)} to{transform:translateX(0)} }
.gmp-header { display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid rgba(255,255,255,.06); }
.gmp-title { font-size:14px;font-weight:700;color:#fff;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
.gmp-edit-btn { width:30px;height:30px;border-radius:8px;background:rgba(96,165,250,.1);border:1px solid rgba(96,165,250,.25);color:#60a5fa;display:flex;align-items:center;justify-content:center;cursor:pointer; }
.gmp-close { width:28px;height:28px;border-radius:8px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);color:#555;display:flex;align-items:center;justify-content:center;cursor:pointer; }
.gmp-list { flex:1;overflow-y:auto;padding:8px 0; }
.gmp-member { display:flex;align-items:center;gap:12px;padding:10px 20px; }
.gmp-info { flex:1;min-width:0; }
.gmp-name { font-size:13px;font-weight:700;color:#fff;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
.gmp-role { font-size:11px;color:#555;display:block;margin-top:1px; }

/* ── Edit Group Modal ── */
.egm-ov { position:fixed;inset:0;z-index:30;background:rgba(0,0,0,.8);display:flex;align-items:flex-end;backdrop-filter:blur(4px); }
.egm-modal { width:100%;max-height:88vh;background:#080808;border:1px solid rgba(132,204,22,.15);border-radius:22px 22px 0 0;overflow:hidden;display:flex;flex-direction:column;animation:egmUp .3s cubic-bezier(.34,1.4,.64,1); }
@keyframes egmUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
.egm-hd { display:flex;align-items:center;justify-content:space-between;padding:14px 20px 10px;flex-shrink:0; }
.egm-title { font-size:16px;font-weight:800;color:#fff; }
.egm-cancel { background:none;border:none;color:#84cc16;font-size:13px;font-weight:700;cursor:pointer; }
.egm-save { padding:7px 16px;border-radius:12px;background:rgba(132,204,22,.18);border:1px solid rgba(132,204,22,.4);color:#84cc16;font-size:13px;font-weight:700;cursor:pointer; }
.egm-save:disabled { opacity:.35;cursor:not-allowed; }
.egm-body { flex:1;overflow-y:auto;padding:8px 20px 20px; }
.egm-cur-icon { font-size:52px;text-align:center;padding:8px 0; }
.egm-lbl { font-size:10px;font-weight:700;color:#444;text-transform:uppercase;letter-spacing:.8px;margin:12px 0 8px; }
.egm-icon-grid { display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:4px; }
.egm-icon-btn { font-size:24px;padding:8px;border-radius:12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);cursor:pointer;transition:background .15s; }
.egm-icon-btn:hover { background:rgba(255,255,255,.07); }
.egm-icon-sel { background:rgba(132,204,22,.12)!important;border-color:rgba(132,204,22,.4)!important; }
.egm-inp { width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:14px;color:#fff;font-size:15px;padding:12px 14px;outline:none;caret-color:#84cc16;box-sizing:border-box;font-weight:600; }
.egm-inp:focus { border-color:rgba(132,204,22,.35); }
.egm-inp::placeholder { color:#333; }
.egm-members-hd { font-size:10px;font-weight:700;color:#444;text-transform:uppercase;letter-spacing:.8px;margin:14px 0 8px; }
.egm-members { display:flex;flex-direction:column;gap:4px; }
.egm-member { display:flex;align-items:center;gap:10px;padding:8px 0; }
.egm-mname { flex:1;font-size:13px;font-weight:600;color:#fff; }
.egm-crown { font-size:14px; }
`;

export default GroupChatView;