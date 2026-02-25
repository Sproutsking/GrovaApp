// src/components/Admin/sections/SupportSection.jsx
// Admin support — real-time ticket list + live chat per ticket
// REDESIGNED: Advanced UI with typing indicators in ticket list,
// better responsiveness, richer information hierarchy, micro-animations
// Avatars: users show real profile photo / initials fallback
// Admins are anonymous — shown as XA-XX badge (never name/photo)

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  MessageSquare, Clock, CheckCircle, User, Search, Send, Shield,
  Loader2, RefreshCw, ArrowLeft, MoreVertical, XCircle, Flag,
  UserCheck, Zap, Circle, Inbox, Trash2, RotateCcw, ChevronDown,
  AlertCircle, TrendingUp, Users, Activity,
} from "lucide-react";
import { supabase } from "../../../services/config/supabase";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const STATUSES = {
  open:        { label: "Open",        color: "#22c55e", bg: "rgba(34,197,94,0.12)",   dot: "#22c55e" },
  in_progress: { label: "In Progress", color: "#3b82f6", bg: "rgba(59,130,246,0.12)",  dot: "#3b82f6" },
  waiting:     { label: "Waiting",     color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  dot: "#f59e0b" },
  resolved:    { label: "Resolved",    color: "#8b5cf6", bg: "rgba(139,92,246,0.12)",  dot: "#8b5cf6" },
  closed:      { label: "Closed",      color: "#6b7280", bg: "rgba(107,114,128,0.12)", dot: "#6b7280" },
};

const PRIORITIES = {
  low:    { label: "Low",    color: "#22c55e", weight: 1 },
  medium: { label: "Medium", color: "#f59e0b", weight: 2 },
  high:   { label: "High",   color: "#ef4444", weight: 3 },
  urgent: { label: "Urgent", color: "#dc2626", weight: 4 },
};

const CATEGORIES = {
  payment:    "💳 Payment",
  content:    "📝 Content",
  account:    "🔐 Account",
  technical:  "⚙️ Technical",
  moderation: "🛡️ Moderation",
  tokens:     "💰 Tokens",
  other:      "💬 General",
};

const STATUS_TABS = [
  { key: "active",      label: "Active",      icon: Zap,          color: "#a3e635" },
  { key: "all",         label: "All",         icon: Inbox,        color: "#9ca3af" },
  { key: "open",        label: "Open",        icon: Circle,       color: "#22c55e" },
  { key: "in_progress", label: "In Progress", icon: MessageSquare,color: "#3b82f6" },
  { key: "waiting",     label: "Waiting",     icon: Clock,        color: "#f59e0b" },
  { key: "resolved",    label: "Resolved",    icon: CheckCircle,  color: "#8b5cf6" },
  { key: "closed",      label: "Closed",      icon: Trash2,       color: "#6b7280" },
];

function ago(ts) {
  if (!ts) return "";
  const m = Math.floor((Date.now() - new Date(ts)) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── AVATAR HELPERS ───────────────────────────────────────────────────────────

function stringToColor(str = "") {
  const palette = [
    "#6366f1","#8b5cf6","#ec4899","#f59e0b",
    "#10b981","#3b82f6","#ef4444","#14b8a6",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

function initials(name = "") {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function resolveAvatar(metadata, avatarId) {
  try {
    if (metadata?.url)  return metadata.url;
    if (metadata?.path) return supabase.storage.from("avatars").getPublicUrl(metadata.path).data.publicUrl;
    if (avatarId)       return supabase.storage.from("avatars").getPublicUrl(avatarId).data.publicUrl;
  } catch (_) {}
  return null;
}

function UserAvatar({ profile, size = 30 }) {
  const [error, setError] = useState(false);
  const name  = profile?.full_name || "";
  const color = stringToColor(name || profile?.id || "user");
  const url   = !error && resolveAvatar(profile?.avatar_metadata, profile?.avatar_id);

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        onError={() => setError(true)}
        style={{
          width: size, height: size, borderRadius: "50%",
          objectFit: "cover", flexShrink: 0,
          border: "2px solid rgba(255,255,255,0.08)",
        }}
      />
    );
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: color, display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px",
      border: "2px solid rgba(255,255,255,0.08)",
    }}>
      {initials(name)}
    </div>
  );
}

function AdminBadge({ adminId, xaId, size = 30 }) {
  const tag   = xaId ? `XA-${String(xaId).padStart(2, "0")}` : adminId ? `XA-${adminId.replace(/-/g, "").slice(-2).toUpperCase()}` : "XA-??";
  const color = stringToColor(adminId || "admin");

  return (
    <div style={{
      height: size, minWidth: size, borderRadius: size / 2, flexShrink: 0,
      background: `linear-gradient(135deg, ${color}22, ${color}44)`,
      border: `1.5px solid ${color}66`,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "0 8px", gap: 4,
    }}>
      <Shield size={size * 0.38} style={{ color, flexShrink: 0 }} />
      <span style={{ fontSize: 10, fontWeight: 800, color, letterSpacing: "0.5px", whiteSpace: "nowrap" }}>
        {tag}
      </span>
    </div>
  );
}

// ─── LIVE TYPING DOTS (reusable mini indicator) ───────────────────────────────

function TypingDots({ color = "#22c55e", size = 4 }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
      {[0, 150, 300].map((delay) => (
        <span key={delay} style={{
          width: size, height: size, borderRadius: "50%", background: color,
          display: "inline-block",
          animation: "typingBounce 1.2s ease-in-out infinite",
          animationDelay: `${delay}ms`,
        }} />
      ))}
    </span>
  );
}

// ─── BADGES ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const s = STATUSES[status] || STATUSES.closed;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 9px", borderRadius: 20,
      background: s.bg, color: s.color,
      fontSize: 10, fontWeight: 700, letterSpacing: "0.3px",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.dot, display: "inline-block",
        ...(["open","in_progress"].includes(status) ? { animation: "pulse 2s infinite" } : {})
      }} />
      {s.label}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const p = PRIORITIES[priority] || PRIORITIES.medium;
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 20,
      background: `${p.color}18`, color: p.color,
      fontSize: 10, fontWeight: 700,
    }}>
      {p.label}
    </span>
  );
}

// ─── STATS BAR ────────────────────────────────────────────────────────────────

function StatsBar({ stats }) {
  const items = [
    { label: "Total",       value: stats.total,          color: "#9ca3af", icon: Inbox },
    { label: "Open",        value: stats.open,           color: "#22c55e", icon: AlertCircle },
    { label: "In Progress", value: stats.in_progress,    color: "#3b82f6", icon: Activity },
    { label: "Waiting",     value: stats.waiting,        color: "#f59e0b", icon: Clock },
    { label: "Resolved",    value: stats.resolved_today, color: "#8b5cf6", icon: TrendingUp },
  ];
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(${items.length},1fr)`,
      marginBottom: 14,
      background: "rgba(255,255,255,0.025)",
      borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.06)",
      overflow: "hidden",
    }}>
      {items.map((item, i) => (
        <div key={item.label} style={{
          padding: "12px 8px",
          textAlign: "center",
          borderRight: i < items.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
          position: "relative",
          overflow: "hidden",
        }}>
          {item.value > 0 && (
            <div style={{
              position: "absolute", inset: 0,
              background: `radial-gradient(ellipse at 50% 100%, ${item.color}08 0%, transparent 70%)`,
              pointerEvents: "none",
            }} />
          )}
          <item.icon size={12} style={{ color: item.color, marginBottom: 4, opacity: 0.7 }} />
          <div style={{ fontSize: 22, fontWeight: 900, color: item.color, lineHeight: 1 }}>{item.value}</div>
          <div style={{ fontSize: 9, color: "#4b5563", marginTop: 3, textTransform: "uppercase", letterSpacing: "0.5px" }}>{item.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── TICKET ROW ───────────────────────────────────────────────────────────────

function TicketRow({ ticket, isSelected, onClick, isUserTyping }) {
  const s = STATUSES[ticket.status] || STATUSES.closed;
  const p = PRIORITIES[ticket.priority] || PRIORITIES.medium;
  const isUrgent = ["urgent", "high"].includes(ticket.priority);
  const isActive = ["open", "in_progress", "waiting"].includes(ticket.status);

  return (
    <div
      onClick={onClick}
      style={{
        padding: "14px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.035)",
        cursor: "pointer",
        background: isSelected
          ? "linear-gradient(90deg, rgba(132,204,22,0.07), rgba(132,204,22,0.02))"
          : isUserTyping
            ? "rgba(34,197,94,0.03)"
            : "transparent",
        borderLeft: `3px solid ${isSelected ? "#a3e635" : isUrgent && !isSelected ? p.color + "60" : "transparent"}`,
        transition: "all 0.15s ease",
        position: "relative",
      }}
      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.025)"; }}
      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = isUserTyping ? "rgba(34,197,94,0.03)" : "transparent"; }}
    >
      {/* Top row: avatar + subject + status */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <UserAvatar profile={ticket.profiles} size={34} />
          {/* Online/typing indicator dot */}
          {isActive && (
            <span style={{
              position: "absolute", bottom: 0, right: 0,
              width: 10, height: 10, borderRadius: "50%",
              background: isUserTyping ? "#22c55e" : s.dot,
              border: "2px solid #0a0a0a",
              animation: isUserTyping ? "pulse 1s infinite" : "none",
            }} />
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
            <div style={{
              fontSize: 13, fontWeight: 700, color: "#f1f5f9",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {ticket.subject}
            </div>
            <StatusBadge status={ticket.status} />
          </div>

          {/* Meta row */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <PriorityBadge priority={ticket.priority} />
            <span style={{ fontSize: 10, color: "#4b5563" }}>·</span>
            <span style={{ fontSize: 10, color: "#6b7280" }}>{ticket.profiles?.full_name || "User"}</span>
            <span style={{ fontSize: 10, color: "#4b5563" }}>·</span>
            <span style={{ fontSize: 10, color: "#6b7280" }}>{CATEGORIES[ticket.category] || "💬 General"}</span>
            {ticket.assigned_to_name && (
              <>
                <span style={{ fontSize: 10, color: "#4b5563" }}>·</span>
                <span style={{ fontSize: 10, color: "#3b82f6" }}>👤 {ticket.assigned_to_name}</span>
              </>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: "#374151", whiteSpace: "nowrap" }}>{ago(ticket.updated_at)}</span>
        </div>
      </div>

      {/* Typing indicator strip */}
      {isUserTyping && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          paddingLeft: 44,
          animation: "fadeInSlide 0.2s ease",
        }}>
          <TypingDots color="#22c55e" size={4} />
          <span style={{ fontSize: 10, color: "#22c55e", fontWeight: 600 }}>
            {ticket.profiles?.full_name || "User"} is typing…
          </span>
        </div>
      )}
    </div>
  );
}

// ─── TYPING INDICATOR (chat) ──────────────────────────────────────────────────

function TypingIndicator({ isUser, userProfile }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, animation: "fadeInSlide 0.2s ease" }}>
      {isUser
        ? <UserAvatar profile={userProfile} size={30} />
        : <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <User size={13} style={{ color: "#9ca3af" }} />
          </div>
      }
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {isUser && userProfile?.full_name && (
          <div style={{ fontSize: 10, color: "#6b7280" }}>{userProfile.full_name}</div>
        )}
        <div style={{
          padding: "10px 16px", borderRadius: "16px 16px 16px 4px",
          background: "rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", gap: 5,
        }}>
          <TypingDots color="#9ca3af" size={7} />
        </div>
      </div>
    </div>
  );
}

// ─── MESSAGE BUBBLE ───────────────────────────────────────────────────────────

function Bubble({ msg, adminUserId }) {
  const isMe       = msg.user_id === adminUserId && msg.is_staff;
  const isInternal = msg.is_internal;

  if (isInternal) {
    return (
      <div style={{
        margin: "8px 0",
        padding: "10px 14px",
        background: "rgba(245,158,11,0.05)",
        border: "1px solid rgba(245,158,11,0.12)",
        borderRadius: 10,
        borderLeft: "3px solid #f59e0b",
      }}>
        <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
          <span>📌 INTERNAL NOTE</span>
          <span style={{ color: "#6b7280", fontWeight: 400 }}>· {msg.staff_name || "Admin"}</span>
        </div>
        <div style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.6 }}>
          {msg.content.replace(/^\[Internal Note\] /, "")}
        </div>
        <div style={{ fontSize: 10, color: "#374151", marginTop: 5 }}>{ago(msg.created_at)}</div>
      </div>
    );
  }

  return (
    <div style={{
      display: "flex",
      justifyContent: isMe ? "flex-end" : "flex-start",
      marginBottom: 16,
      gap: 10,
      alignItems: "flex-end",
      animation: "fadeInSlide 0.2s ease",
    }}>
      {!isMe && (
        msg.is_staff
          ? <AdminBadge adminId={msg.user_id} size={30} />
          : <UserAvatar profile={msg.profiles} size={30} />
      )}

      <div style={{ maxWidth: "70%", display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
        <div style={{ fontSize: 10, color: "#4b5563", marginBottom: 4 }}>
          {isMe
            ? "You"
            : msg.is_staff
              ? `Support · ${msg.staff_name || ""}`
              : msg.profiles?.full_name || "User"}
        </div>
        <div style={{
          padding: "11px 15px",
          borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
          background: isMe
            ? "linear-gradient(135deg,#84cc16,#65a30d)"
            : msg.is_staff ? "rgba(132,204,22,0.07)" : "rgba(255,255,255,0.07)",
          border: msg.is_staff && !isMe ? "1px solid rgba(132,204,22,0.15)" : isMe ? "none" : "1px solid rgba(255,255,255,0.04)",
        }}>
          <div style={{
            fontSize: 13, color: isMe ? "#000" : "#e5e7eb",
            lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word",
          }}>
            {msg.content}
          </div>
        </div>
        <div style={{ fontSize: 10, color: "#374151", marginTop: 4 }}>
          {new Date(msg.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>

      {isMe && <AdminBadge adminId={adminUserId} size={30} />}
    </div>
  );
}

// ─── TICKET DETAIL / CHAT ─────────────────────────────────────────────────────

function TicketDetail({ ticket: init, adminData, teamMembers, onUpdate, onClose }) {
  const [ticket, setTicket]           = useState(init);
  const [messages, setMessages]       = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [reply, setReply]             = useState("");
  const [sending, setSending]         = useState(false);
  const [noteText, setNoteText]       = useState("");
  const [showNote, setShowNote]       = useState(false);
  const [showAssign, setShowAssign]   = useState(false);
  const [showResolve, setShowResolve] = useState(false);
  const [resolveNote, setResolveNote] = useState("");
  const [assignee, setAssignee]       = useState(ticket.assigned_to || "");
  const [showMenu, setShowMenu]       = useState(false);
  const [acting, setActing]           = useState(false);
  const [userTyping, setUserTyping]   = useState(false);
  const [ticketUserProfile, setTicketUserProfile] = useState(ticket.profiles || null);

  const channelRef    = useRef(null);
  const ticketChanRef = useRef(null);
  const presenceRef   = useRef(null);
  const typingTimer   = useRef(null);
  const bottomRef     = useRef(null);
  const mounted       = useRef(true);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, userTyping]);

  useEffect(() => {
    if (!init.user_id) return;
    supabase.from("profiles").select("id, full_name, avatar_id, avatar_metadata").eq("id", init.user_id).single()
      .then(({ data }) => { if (data && mounted.current) setTicketUserProfile(data); });
  }, [init.user_id]);

  useEffect(() => {
    if (!adminData?.user_id || !init.id) return;
    const ch = supabase.channel(`typing-${init.id}`, { config: { presence: { key: adminData.user_id } } });

    const sync = () => {
      const state = ch.presenceState();
      const typing = Object.entries(state).some(
        ([key, presences]) =>
          key !== adminData.user_id &&
          presences.some((p) => p.is_typing && !p.is_staff)
      );
      if (mounted.current) setUserTyping(typing);
    };

    ch.on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe(async (s) => { if (s === "SUBSCRIBED") await ch.track({ is_typing: false, is_staff: true }); });

    presenceRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [adminData?.user_id, init.id]);

  const broadcastTyping = useCallback(async (val) => {
    if (!presenceRef.current) return;
    await presenceRef.current.track({ is_typing: val, is_staff: true });
  }, []);

  const handleReplyChange = (e) => {
    setReply(e.target.value);
    broadcastTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => broadcastTyping(false), 2500);
  };

  useEffect(() => {
    setTicket(init);
    loadMessages();

    if (channelRef.current) supabase.removeChannel(channelRef.current);
    channelRef.current = supabase
      .channel(`admin-msgs-${init.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages", filter: `ticket_id=eq.${init.id}` },
        async (payload) => {
          const { data } = await supabase
            .from("support_messages")
            .select("*, profiles:user_id(id, full_name, avatar_id, avatar_metadata)")
            .eq("id", payload.new.id).single();
          if (data && mounted.current) setMessages((p) => p.some((m) => m.id === data.id) ? p : [...p, data]);
        })
      .subscribe();

    if (ticketChanRef.current) supabase.removeChannel(ticketChanRef.current);
    ticketChanRef.current = supabase
      .channel(`admin-ticket-${init.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "support_tickets", filter: `id=eq.${init.id}` },
        async () => {
          const { data } = await supabase.from("support_tickets").select("*, profiles:user_id(id, full_name, avatar_id, avatar_metadata)").eq("id", init.id).single();
          if (data && mounted.current) setTicket(data);
        })
      .subscribe();

    return () => {
      if (channelRef.current)    supabase.removeChannel(channelRef.current);
      if (ticketChanRef.current) supabase.removeChannel(ticketChanRef.current);
      clearTimeout(typingTimer.current);
    };
  }, [init.id]);

  const loadMessages = async () => {
    setLoadingMsgs(true);
    const { data } = await supabase
      .from("support_messages")
      .select("*, profiles:user_id(id, full_name, avatar_id, avatar_metadata)")
      .eq("ticket_id", init.id)
      .order("created_at", { ascending: true });
    if (mounted.current) { setMessages(data || []); setLoadingMsgs(false); }
  };

  const sendReply = async () => {
    if (!reply.trim() || sending) return;
    setSending(true);
    clearTimeout(typingTimer.current);
    broadcastTyping(false);
    const content = reply.trim();
    setReply("");
    await supabase.from("support_messages").insert({
      ticket_id: ticket.id, user_id: adminData.user_id,
      content, is_staff: true, is_internal: false,
      staff_name: adminData.full_name || "Support",
    });
    if (["open", "in_progress"].includes(ticket.status)) {
      await supabase.from("support_tickets").update({ status: "waiting", updated_at: new Date().toISOString() }).eq("id", ticket.id);
    }
    if (mounted.current) setSending(false);
    onUpdate();
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    setActing(true);
    await supabase.from("support_messages").insert({
      ticket_id: ticket.id, user_id: adminData.user_id,
      content: `[Internal Note] ${noteText.trim()}`,
      is_staff: true, is_internal: true, staff_name: adminData.full_name || "Admin",
    });
    setNoteText(""); setShowNote(false);
    if (mounted.current) setActing(false);
    loadMessages();
  };

  const assignTicket = async () => {
    if (!assignee) return;
    setActing(true);
    const member = teamMembers.find((m) => m.user_id === assignee);
    const name = member?.full_name || "Admin";
    await supabase.from("support_tickets").update({ assigned_to: assignee, assigned_to_name: name, status: "in_progress", updated_at: new Date().toISOString() }).eq("id", ticket.id);
    await supabase.from("support_messages").insert({ ticket_id: ticket.id, user_id: adminData.user_id, content: `[Internal Note] Ticket assigned to ${name} by ${adminData.full_name || "Admin"}.`, is_staff: true, is_internal: true, staff_name: "System" });
    setShowAssign(false);
    if (mounted.current) setActing(false);
    onUpdate(); loadMessages();
  };

  const resolveTicket = async () => {
    setActing(true);
    const stamp = `Resolved by Support on ${new Date().toLocaleString()}`;
    await supabase.from("support_tickets").update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by: adminData.user_id, resolve_note: resolveNote.trim() || null, updated_at: new Date().toISOString() }).eq("id", ticket.id);
    const msg = resolveNote.trim() ? `${resolveNote.trim()}\n\n— ${stamp}` : `This ticket has been resolved.\n\n— ${stamp}`;
    await supabase.from("support_messages").insert({ ticket_id: ticket.id, user_id: adminData.user_id, content: msg, is_staff: true, is_internal: false, staff_name: "Support" });
    setShowResolve(false); setResolveNote("");
    if (mounted.current) setActing(false);
    onUpdate();
  };

  const setPriority = async (priority) => {
    await supabase.from("support_tickets").update({ priority, updated_at: new Date().toISOString() }).eq("id", ticket.id);
    onUpdate();
  };

  const closeTicket = async () => {
    if (!window.confirm("Close this ticket?")) return;
    await supabase.from("support_tickets").update({ status: "closed", closed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", ticket.id);
    onUpdate(); onClose();
  };

  const reopenTicket = async () => {
    await supabase.from("support_tickets").update({ status: "open", updated_at: new Date().toISOString() }).eq("id", ticket.id);
    onUpdate();
  };

  const isActive = ["open", "in_progress", "waiting"].includes(ticket.status);

  const overlayStyle = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
    backdropFilter: "blur(6px)", zIndex: 200,
    display: "flex", alignItems: "center", justifyContent: "center",
  };
  const modalStyle = {
    background: "#111", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 18, padding: 26, width: "100%", maxWidth: 440,
    boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
    animation: "scaleIn 0.18s ease",
  };
  const btnPrimary = {
    flex: 1, padding: 12,
    background: "linear-gradient(135deg,#84cc16,#65a30d)",
    border: "none", borderRadius: 10,
    color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer",
  };
  const btnCancel = {
    flex: 1, padding: 12,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10, color: "#9ca3af", fontSize: 13, cursor: "pointer",
  };
  const ta = {
    width: "100%", padding: "11px 14px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10, color: "#fff", fontSize: 13, outline: "none",
    resize: "vertical", fontFamily: "inherit", boxSizing: "border-box",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#080808" }}>

      {/* ── Header ── */}
      <div style={{
        padding: "0 0 0 0",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(0,0,0,0.5)",
        flexShrink: 0,
      }}>
        {/* Top bar */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 9,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            color: "#9ca3af", flexShrink: 0,
            transition: "all 0.15s",
          }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.09)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
          >
            <ArrowLeft size={14} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {ticket.subject}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
          </div>
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowMenu(!showMenu)} style={{
              width: 32, height: 32, borderRadius: 9,
              background: showMenu ? "rgba(132,204,22,0.1)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${showMenu ? "rgba(132,204,22,0.3)" : "rgba(255,255,255,0.08)"}`,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              color: "#9ca3af", transition: "all 0.15s",
            }}>
              <MoreVertical size={14} />
            </button>
            {showMenu && (
              <>
                <div onClick={() => setShowMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 50 }} />
                <div style={{
                  position: "absolute", right: 0, top: 38, zIndex: 100,
                  background: "#111", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 14, overflow: "hidden", minWidth: 200,
                  boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
                  animation: "scaleIn 0.15s ease",
                }}>
                  {isActive && (
                    <button onClick={() => { setShowMenu(false); setShowAssign(true); }}
                      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 16px", background: "none", border: "none", borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", color: "#e5e7eb", fontSize: 13, fontFamily: "inherit" }}>
                      <UserCheck size={13} style={{ color: "#3b82f6" }} /> Assign to Admin
                    </button>
                  )}
                  {["low","medium","high","urgent"].map((p) => (
                    <button key={p} onClick={() => { setShowMenu(false); setPriority(p); }}
                      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 16px", background: "none", border: "none", borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", color: "#e5e7eb", fontSize: 13, fontFamily: "inherit" }}>
                      <Flag size={13} style={{ color: PRIORITIES[p].color }} /> Set {PRIORITIES[p].label}
                    </button>
                  ))}
                  {isActive && (
                    <button onClick={() => { setShowMenu(false); setShowResolve(true); }}
                      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 16px", background: "none", border: "none", borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", color: "#a3e635", fontSize: 13, fontFamily: "inherit" }}>
                      <CheckCircle size={13} /> Resolve Ticket
                    </button>
                  )}
                  {ticket.status !== "closed" && (
                    <button onClick={() => { setShowMenu(false); closeTicket(); }}
                      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 16px", background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 13, fontFamily: "inherit" }}>
                      <XCircle size={13} /> Close Ticket
                    </button>
                  )}
                  {["closed","resolved"].includes(ticket.status) && (
                    <button onClick={() => { setShowMenu(false); reopenTicket(); }}
                      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 16px", background: "none", border: "none", cursor: "pointer", color: "#e5e7eb", fontSize: 13, fontFamily: "inherit" }}>
                      <RotateCcw size={13} /> Reopen
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* User info bar */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "12px 18px",
        }}>
          <div style={{ position: "relative" }}>
            <UserAvatar profile={ticketUserProfile} size={38} />
            {userTyping && (
              <span style={{
                position: "absolute", bottom: 0, right: 0,
                width: 12, height: 12, borderRadius: "50%",
                background: "#22c55e", border: "2px solid #080808",
                animation: "pulse 1s infinite",
              }} />
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
              {ticketUserProfile?.full_name || "User"}
            </div>
            <div style={{ fontSize: 11, color: "#4b5563", display: "flex", alignItems: "center", gap: 6 }}>
              {userTyping
                ? <><TypingDots color="#22c55e" size={4} /><span style={{ color: "#22c55e", fontWeight: 600 }}>typing…</span></>
                : <span>Opened {ago(ticket.created_at)}{ticket.assigned_to_name ? ` · 👤 ${ticket.assigned_to_name}` : ""}</span>
              }
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setShowNote(true)} style={{
              padding: "6px 12px", background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8,
              cursor: "pointer", fontSize: 11, fontWeight: 600, color: "#9ca3af",
              transition: "all 0.15s",
            }}>
              📌 Note
            </button>
            {isActive && (
              <button onClick={() => setShowAssign(true)} style={{
                padding: "6px 12px", background: "rgba(59,130,246,0.08)",
                border: "1px solid rgba(59,130,246,0.2)", borderRadius: 8,
                cursor: "pointer", fontSize: 11, fontWeight: 600, color: "#3b82f6",
              }}>
                Assign
              </button>
            )}
            {isActive && (
              <button onClick={() => setShowResolve(true)} style={{
                padding: "6px 12px", background: "rgba(132,204,22,0.08)",
                border: "1px solid rgba(132,204,22,0.2)", borderRadius: 8,
                cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#a3e635",
              }}>
                ✅ Resolve
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Messages ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 18px 10px" }}>
        {loadingMsgs ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
            <Loader2 size={22} style={{ color: "#a3e635", animation: "spin 0.8s linear infinite" }} />
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div style={{ fontSize: 42, marginBottom: 12 }}>💬</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>No messages yet</div>
            <div style={{ fontSize: 12, color: "#1f2937", marginTop: 4 }}>Send the first reply below</div>
          </div>
        ) : (
          messages.map((msg, i) => <Bubble key={msg.id || i} msg={msg} adminUserId={adminData.user_id} />)
        )}

        {userTyping && <TypingIndicator isUser userProfile={ticketUserProfile} />}
        <div ref={bottomRef} />
      </div>

      {/* ── Reply input ── */}
      {isActive ? (
        <div style={{
          padding: "12px 18px 16px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(0,0,0,0.4)",
          flexShrink: 0,
        }}>
          <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <AdminBadge adminId={adminData.user_id} xaId={adminData.xa_id} size={22} />
            <span style={{ fontSize: 11, color: "#374151", fontWeight: 500 }}>
              Replying to {ticketUserProfile?.full_name || "User"} — visible to user
            </span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <textarea
              value={reply}
              onChange={handleReplyChange}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
              onBlur={() => { clearTimeout(typingTimer.current); broadcastTyping(false); }}
              placeholder="Type reply… (Enter sends, Shift+Enter new line)"
              rows={3}
              style={{
                flex: 1, padding: "11px 14px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 14, color: "#fff", fontSize: 13,
                outline: "none", resize: "vertical", fontFamily: "inherit",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => { e.target.style.borderColor = "rgba(132,204,22,0.3)"; }}
              onBlurCapture={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; }}
            />
            <button
              onClick={sendReply}
              disabled={sending || !reply.trim()}
              style={{
                width: 46, height: 46, borderRadius: 13,
                background: "linear-gradient(135deg,#84cc16,#65a30d)",
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                opacity: sending || !reply.trim() ? 0.4 : 1,
                transition: "opacity 0.15s, transform 0.1s",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => { if (!sending && reply.trim()) e.currentTarget.style.transform = "scale(1.05)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
            >
              {sending
                ? <Loader2 size={17} style={{ color: "#000", animation: "spin 0.6s linear infinite" }} />
                : <Send size={17} style={{ color: "#000" }} />
              }
            </button>
          </div>
        </div>
      ) : (
        <div style={{
          padding: "14px 18px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(0,0,0,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
        }}>
          <span style={{ fontSize: 13, color: "#4b5563" }}>Ticket is {ticket.status}.</span>
          <button onClick={reopenTicket} style={{
            fontSize: 12, color: "#a3e635",
            background: "rgba(132,204,22,0.08)",
            border: "1px solid rgba(132,204,22,0.2)",
            borderRadius: 8, padding: "5px 14px", cursor: "pointer",
          }}>
            Reopen
          </button>
        </div>
      )}

      {/* ── Modals ── */}
      {showNote && (
        <div style={overlayStyle} onClick={() => setShowNote(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 4 }}>📌 Internal Note</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>Only visible to admin team, never shown to the user.</div>
            <textarea autoFocus value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Write note..." rows={4} style={ta} />
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={() => setShowNote(false)} style={btnCancel}>Cancel</button>
              <button onClick={addNote} disabled={acting || !noteText.trim()} style={btnPrimary}>{acting ? "Saving…" : "Save Note"}</button>
            </div>
          </div>
        </div>
      )}

      {showAssign && (
        <div style={overlayStyle} onClick={() => setShowAssign(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 4 }}>👤 Assign Ticket</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>Choose an admin to handle this ticket.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 260, overflowY: "auto" }}>
              {teamMembers.map((m) => (
                <button key={m.user_id} onClick={() => setAssignee(m.user_id)} style={{
                  padding: "12px 14px",
                  background: assignee === m.user_id ? "rgba(132,204,22,0.1)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${assignee === m.user_id ? "rgba(132,204,22,0.4)" : "rgba(255,255,255,0.06)"}`,
                  borderRadius: 12, cursor: "pointer", textAlign: "left",
                  display: "flex", alignItems: "center", gap: 12, fontFamily: "inherit",
                  transition: "all 0.15s",
                }}>
                  <AdminBadge adminId={m.user_id} xaId={m.xa_id} size={28} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{m.full_name}</div>
                    <div style={{ fontSize: 11, color: "#6b7280" }}>{m.role}</div>
                  </div>
                  {assignee === m.user_id && <CheckCircle size={14} style={{ color: "#a3e635" }} />}
                </button>
              ))}
              {teamMembers.length === 0 && (
                <div style={{ fontSize: 13, color: "#6b7280", textAlign: "center", padding: 24 }}>No team members found.</div>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={() => setShowAssign(false)} style={btnCancel}>Cancel</button>
              <button onClick={assignTicket} disabled={acting || !assignee} style={btnPrimary}>{acting ? "Assigning…" : "Assign"}</button>
            </div>
          </div>
        </div>
      )}

      {showResolve && (
        <div style={overlayStyle} onClick={() => setShowResolve(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 4 }}>✅ Resolve Ticket</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>Optional resolution note sent to the user.</div>
            <textarea autoFocus value={resolveNote} onChange={(e) => setResolveNote(e.target.value)} placeholder="(Optional) Resolution note..." rows={4} style={ta} />
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={() => setShowResolve(false)} style={btnCancel}>Cancel</button>
              <button onClick={resolveTicket} disabled={acting} style={btnPrimary}>{acting ? "Resolving…" : "Mark Resolved"}</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin     { to { transform:rotate(360deg); } }
        @keyframes pulse    { 0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(1.15)} }
        @keyframes fadeInSlide { from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)} }
        @keyframes scaleIn  { from{opacity:0;transform:scale(0.96)}to{opacity:1;transform:scale(1)} }
        @keyframes typingBounce { 0%,60%,100%{transform:translateY(0);opacity:.35}30%{transform:translateY(-6px);opacity:1} }
      `}</style>
    </div>
  );
}

// ─── MAIN SUPPORT SECTION ─────────────────────────────────────────────────────

export default function SupportSection({ adminData }) {
  const [tickets, setTickets]               = useState([]);
  const [loading, setLoading]               = useState(true);
  const [selected, setSelected]             = useState(null);
  const [tab, setTab]                       = useState("active");
  const [search, setSearch]                 = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [page, setPage]                     = useState(1);
  const [total, setTotal]                   = useState(0);
  const [team, setTeam]                     = useState([]);
  const [stats, setStats]                   = useState({ total: 0, open: 0, in_progress: 0, waiting: 0, resolved_today: 0 });
  // Map of ticketId -> bool: whether user is currently typing in that ticket
  const [ticketTypingMap, setTicketTypingMap] = useState({});
  // Mobile panel state
  const [mobileView, setMobileView] = useState("list"); // "list" | "chat"

  const PAGE_SIZE    = 30;
  const feedRef      = useRef(null);
  const mounted      = useRef(true);
  const presenceSubs = useRef({}); // ticketId -> channel

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { loadAll(); }, [tab, search, priorityFilter, page]);
  useEffect(() => {
    loadTeam();
    if (feedRef.current) supabase.removeChannel(feedRef.current);
    feedRef.current = supabase
      .channel("admin-tickets-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => loadAll())
      .subscribe();
    return () => { if (feedRef.current) supabase.removeChannel(feedRef.current); };
  }, []);

  // Subscribe to typing presence for all active tickets to show in list
  useEffect(() => {
    if (!adminData?.user_id || tickets.length === 0) return;

    const activeTicketIds = tickets
      .filter((t) => ["open", "in_progress", "waiting"].includes(t.status))
      .map((t) => t.id);

    // Remove old subs for tickets no longer in view
    Object.keys(presenceSubs.current).forEach((id) => {
      if (!activeTicketIds.includes(id)) {
        supabase.removeChannel(presenceSubs.current[id]);
        delete presenceSubs.current[id];
        setTicketTypingMap((prev) => { const n = { ...prev }; delete n[id]; return n; });
      }
    });

    // Add new subs
    activeTicketIds.forEach((ticketId) => {
      if (presenceSubs.current[ticketId]) return; // already subbed

      const ch = supabase.channel(`typing-list-${ticketId}`, {
        config: { presence: { key: adminData.user_id } },
      });

      const sync = () => {
        const state = ch.presenceState();
        const typing = Object.entries(state).some(
          ([key, presences]) =>
            key !== adminData.user_id &&
            presences.some((p) => p.is_typing && !p.is_staff)
        );
        if (mounted.current) {
          setTicketTypingMap((prev) => ({ ...prev, [ticketId]: typing }));
        }
      };

      ch.on("presence", { event: "sync" }, sync)
        .on("presence", { event: "join" }, sync)
        .on("presence", { event: "leave" }, sync)
        .subscribe(async (s) => {
          if (s === "SUBSCRIBED") {
            await ch.track({ is_typing: false, is_staff: true });
          }
        });

      presenceSubs.current[ticketId] = ch;
    });

    return () => {
      Object.values(presenceSubs.current).forEach((ch) => supabase.removeChannel(ch));
      presenceSubs.current = {};
    };
  }, [tickets, adminData?.user_id]);

  const loadAll    = () => { loadTickets(); loadStats(); };

  const loadTeam = async () => {
    const { data } = await supabase.from("admin_team").select("user_id, full_name, role, xa_id").eq("status", "active");
    if (data && mounted.current) setTeam(data);
  };

  const loadStats = async () => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const [tot, op, ip, wa, res] = await Promise.all([
      supabase.from("support_tickets").select("*", { count: "exact", head: true }).neq("status", "deleted"),
      supabase.from("support_tickets").select("*", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("support_tickets").select("*", { count: "exact", head: true }).eq("status", "in_progress"),
      supabase.from("support_tickets").select("*", { count: "exact", head: true }).eq("status", "waiting"),
      supabase.from("support_tickets").select("*", { count: "exact", head: true }).eq("status", "resolved").gte("resolved_at", today.toISOString()),
    ]);
    if (mounted.current) setStats({
      total: tot.count || 0, open: op.count || 0,
      in_progress: ip.count || 0, waiting: wa.count || 0,
      resolved_today: res.count || 0,
    });
  };

  const loadTickets = async () => {
    setLoading(true);
    try {
      let q = supabase
        .from("support_tickets")
        .select("*, profiles:user_id(id, full_name, avatar_id, avatar_metadata)", { count: "exact" })
        .neq("status", "deleted")
        .order("updated_at", { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
      if (tab === "active") q = q.in("status", ["open", "in_progress", "waiting"]);
      else if (tab !== "all") q = q.eq("status", tab);
      if (priorityFilter !== "all") q = q.eq("priority", priorityFilter);
      if (search.trim()) q = q.ilike("subject", `%${search.trim()}%`);
      const { data, count } = await q;
      if (mounted.current) { setTickets(data || []); setTotal(count || 0); }
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  const handleUpdate = async () => {
    loadAll();
    if (selected) {
      const { data } = await supabase.from("support_tickets").select("*, profiles:user_id(id, full_name, avatar_id, avatar_metadata)").eq("id", selected.id).single();
      if (data && mounted.current) setSelected(data);
    }
  };

  const handleSelectTicket = (ticket) => {
    setSelected(ticket);
    setMobileView("chat");
  };

  const handleCloseDetail = () => {
    setSelected(null);
    setMobileView("list");
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  // Count tickets with active typing
  const typingCount = Object.values(ticketTypingMap).filter(Boolean).length;

  return (
    <>
      <style>{`
        @keyframes spin        { to { transform:rotate(360deg); } }
        @keyframes pulse       { 0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.2)} }
        @keyframes typingBounce{ 0%,60%,100%{transform:translateY(0);opacity:.35}30%{transform:translateY(-6px);opacity:1} }
        @keyframes fadeInSlide { from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)} }
        @keyframes scaleIn     { from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)} }
        @keyframes slideInRight{ from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)} }
        @keyframes slideInLeft { from{opacity:0;transform:translateX(-20px)}to{opacity:1;transform:translateX(0)} }

        .ss-ticket-list::-webkit-scrollbar { width: 3px; }
        .ss-ticket-list::-webkit-scrollbar-track { background: transparent; }
        .ss-ticket-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 99px; }

        .ss-chat-area::-webkit-scrollbar { width: 3px; }
        .ss-chat-area::-webkit-scrollbar-track { background: transparent; }
        .ss-chat-area::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 99px; }

        .ss-tab-btn { transition: all 0.15s ease; }
        .ss-tab-btn:hover { opacity: 1 !important; }

        @media (max-width: 768px) {
          .ss-panel-list  { display: var(--list-display, flex) !important; }
          .ss-panel-chat  { display: var(--chat-display, none) !important; }
        }
      `}</style>

      <div style={{
        display: "flex",
        height: "calc(100vh - 100px)",
        gap: 0,
        position: "relative",
        overflow: "hidden",
      }}>

        {/* ═══════════════════════════════════════════════════
            LEFT PANEL — Ticket List
        ═══════════════════════════════════════════════════ */}
        <div
          className="ss-panel-list"
          style={{
            width: selected ? "380px" : "100%",
            maxWidth: selected ? "380px" : "none",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            borderRight: selected ? "1px solid rgba(255,255,255,0.06)" : "none",
            overflow: "hidden",
            transition: "width 0.25s cubic-bezier(0.4,0,0.2,1), max-width 0.25s cubic-bezier(0.4,0,0.2,1)",
            // Mobile: hide when chatting
            ...(mobileView === "chat" ? { display: "none" } : {}),
          }}
        >
          {/* Stats */}
          <div style={{ flexShrink: 0, padding: selected ? "14px 14px 0" : "0 0 0" }}>
            <StatsBar stats={stats} />

            {/* Live typing count badge */}
            {typingCount > 0 && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 12px", marginBottom: 10,
                background: "rgba(34,197,94,0.06)",
                border: "1px solid rgba(34,197,94,0.15)",
                borderRadius: 10,
                animation: "fadeInSlide 0.2s ease",
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: "50%", background: "#22c55e",
                  display: "inline-block", animation: "pulse 1.2s infinite",
                }} />
                <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>
                  {typingCount} user{typingCount !== 1 ? "s" : ""} typing right now
                </span>
                <TypingDots color="#22c55e" size={4} />
              </div>
            )}

            {/* Search + Refresh row */}
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <div style={{
                flex: 1, display: "flex", alignItems: "center", gap: 8,
                padding: "8px 12px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 11,
                transition: "border-color 0.15s",
              }}>
                <Search size={13} style={{ color: "#4b5563", flexShrink: 0 }} />
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Search tickets…"
                  style={{
                    flex: 1, background: "none", border: "none",
                    color: "#fff", fontSize: 13, outline: "none",
                  }}
                />
                {search && (
                  <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#4b5563", padding: 0, lineHeight: 0 }}>
                    <XCircle size={13} />
                  </button>
                )}
              </div>
              <button onClick={loadAll} style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                color: "#4b5563", transition: "all 0.15s",
              }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#9ca3af"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "#4b5563"; }}
              >
                <RefreshCw size={13} />
              </button>
            </div>

            {/* Priority filter */}
            <div style={{ marginBottom: 10, position: "relative" }}>
              <select
                value={priorityFilter}
                onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
                style={{
                  width: "100%", padding: "8px 32px 8px 12px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 10, color: "#9ca3af", fontSize: 12,
                  outline: "none", cursor: "pointer",
                  appearance: "none", WebkitAppearance: "none",
                }}
              >
                <option value="all">All Priorities</option>
                {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <ChevronDown size={12} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#4b5563", pointerEvents: "none" }} />
            </div>

            {/* Status tabs */}
            <div style={{
              display: "flex", gap: 4, overflowX: "auto", paddingBottom: 10,
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}>
              {STATUS_TABS.map((t) => {
                const isActive = tab === t.key;
                return (
                  <button
                    key={t.key}
                    className="ss-tab-btn"
                    onClick={() => { setTab(t.key); setPage(1); }}
                    style={{
                      padding: "5px 11px",
                      borderRadius: 9,
                      border: `1px solid ${isActive ? `${t.color}60` : "rgba(255,255,255,0.06)"}`,
                      background: isActive ? `${t.color}14` : "transparent",
                      color: isActive ? t.color : "#4b5563",
                      fontSize: 11, fontWeight: 600,
                      cursor: "pointer", whiteSpace: "nowrap",
                      display: "flex", alignItems: "center", gap: 5,
                      opacity: isActive ? 1 : 0.7,
                    }}
                  >
                    <t.icon size={10} />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ticket list */}
          <div className="ss-ticket-list" style={{
            flex: 1, overflowY: "auto",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 14,
            background: "rgba(255,255,255,0.01)",
            marginBottom: 4,
          }}>
            {loading ? (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 200 }}>
                <Loader2 size={22} style={{ color: "#a3e635", animation: "spin 0.8s linear infinite" }} />
              </div>
            ) : tickets.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>📭</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 4 }}>No tickets</div>
                <div style={{ fontSize: 12, color: "#1f2937" }}>
                  {tab === "active" ? "No active tickets right now." : `No ${tab} tickets.`}
                </div>
              </div>
            ) : (
              tickets.map((t) => (
                <TicketRow
                  key={t.id}
                  ticket={t}
                  isSelected={selected?.id === t.id}
                  onClick={() => handleSelectTicket(t)}
                  isUserTyping={!!ticketTypingMap[t.id]}
                />
              ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, paddingBottom: 4 }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{
                  padding: "5px 14px", background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8,
                  color: "#6b7280", fontSize: 12, cursor: "pointer",
                  opacity: page === 1 ? 0.35 : 1,
                }}
              >
                Prev
              </button>
              <span style={{ fontSize: 12, color: "#374151" }}>{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{
                  padding: "5px 14px", background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8,
                  color: "#6b7280", fontSize: 12, cursor: "pointer",
                  opacity: page === totalPages ? 0.35 : 1,
                }}
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════
            RIGHT PANEL — Chat Detail
        ═══════════════════════════════════════════════════ */}
        {selected && (
          <div
            className="ss-panel-chat"
            style={{
              flex: 1,
              overflow: "hidden",
              minWidth: 0,
              animation: "slideInRight 0.22s cubic-bezier(0.4,0,0.2,1)",
              // Mobile: fullscreen when chatting
              ...(mobileView === "chat" ? {
                position: "absolute", inset: 0, width: "100%", zIndex: 10,
              } : {}),
            }}
          >
            <TicketDetail
              ticket={selected}
              adminData={adminData}
              teamMembers={team}
              onUpdate={handleUpdate}
              onClose={handleCloseDetail}
            />
          </div>
        )}

        {/* Empty state when no ticket selected (desktop only, full width list) */}
        {!selected && (
          <div style={{
            display: "none", // only shown when list is narrow — handled by CSS grid
          }} />
        )}
      </div>
    </>
  );
}