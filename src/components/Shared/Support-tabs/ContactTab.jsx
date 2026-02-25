// src/components/Support/ContactTab.jsx
// User-facing support center — create tickets, live chat with admin
// Tables: support_tickets, support_messages
// Real-time via Supabase Realtime + Presence (typing indicators)

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Send, Loader2, Shield, Trash2, AlertTriangle,
  ChevronRight, ArrowLeft, RefreshCw, User, Zap,
} from "lucide-react";
import { supabase } from "../../../services/config/supabase";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const STATUSES = {
  open:        { label: "Open",        color: "#22c55e", bg: "rgba(34,197,94,0.12)",  dot: "#22c55e" },
  in_progress: { label: "In Progress", color: "#3b82f6", bg: "rgba(59,130,246,0.12)", dot: "#3b82f6" },
  waiting:     { label: "Waiting",     color: "#f59e0b", bg: "rgba(245,158,11,0.12)", dot: "#f59e0b" },
  resolved:    { label: "Resolved",    color: "#8b5cf6", bg: "rgba(139,92,246,0.12)", dot: "#8b5cf6" },
  closed:      { label: "Closed",      color: "#6b7280", bg: "rgba(107,114,128,0.12)",dot: "#6b7280" },
};

const CATEGORIES = [
  { value: "payment",    label: "💳 Payment Issue",      desc: "Deposits, withdrawals, billing" },
  { value: "content",    label: "📝 Content Problem",    desc: "Publishing, editing, removal" },
  { value: "account",    label: "🔐 Account Access",     desc: "Login, security, profile" },
  { value: "technical",  label: "⚙️ Technical Bug",      desc: "App errors, performance" },
  { value: "moderation", label: "🛡️ Moderation Appeal", desc: "Content removal, suspension" },
  { value: "tokens",     label: "💰 Token & Wallet",     desc: "EP, XEV, conversions" },
  { value: "other",      label: "💬 General Inquiry",    desc: "Anything else" },
];

function timeAgo(ts) {
  if (!ts) return "";
  const m = Math.floor((Date.now() - new Date(ts)) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function StatusBadge({ status }) {
  const s = STATUSES[status] || STATUSES.open;
  return (
    <span style={{ padding: "3px 9px", borderRadius: 20, background: s.bg, color: s.color, fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot }} />
      {s.label}
    </span>
  );
}

// ─── AVATAR HELPERS ───────────────────────────────────────────────────────────

// Derive a stable colour from a string (name/id) for the initials avatar
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

// Resolves avatar URL from Supabase storage given avatar_metadata / avatar_id
function resolveAvatar(metadata, avatarId) {
  try {
    if (metadata?.url)    return metadata.url;
    if (metadata?.path)   return supabase.storage.from("avatars").getPublicUrl(metadata.path).data.publicUrl;
    if (avatarId)         return supabase.storage.from("avatars").getPublicUrl(avatarId).data.publicUrl;
  } catch (_) {}
  return null;
}

// User avatar — real photo or initials fallback
function UserAvatar({ profile, size = 28 }) {
  const [error, setError] = useState(false);
  const name   = profile?.full_name || "";
  const color  = stringToColor(name || profile?.id || "user");
  const url    = !error && resolveAvatar(profile?.avatar_metadata, profile?.avatar_id);

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

// Anonymous admin badge — XA-XX, never reveals identity
function AdminBadge({ adminId, size = 28 }) {
  // Derive a short 2-char suffix from the UUID — consistent per admin, untraceable
  const suffix = adminId ? adminId.replace(/-/g, "").slice(-2).toUpperCase() : "??";
  const tag    = `XA-${suffix}`;
  const color  = stringToColor(adminId || "admin");

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

// ─── TYPING INDICATOR BUBBLE ─────────────────────────────────────────────────

function TypingIndicator({ isStaff = true, adminId, userProfile }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
      {isStaff
        ? <AdminBadge adminId={adminId} size={28} />
        : <UserAvatar profile={userProfile} size={28} />
      }
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3 }}>
        {isStaff && (
          <div style={{ fontSize: 10, color: "#a3e635", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
            <Shield size={10} /> Xeevia Support
          </div>
        )}
        <div style={{
          padding: "10px 16px",
          borderRadius: "16px 16px 16px 4px",
          background: isStaff ? "rgba(132,204,22,0.08)" : "rgba(255,255,255,0.06)",
          border: isStaff ? "1px solid rgba(132,204,22,0.18)" : "none",
          display: "flex", alignItems: "center", gap: 5,
        }}>
          {[0, 200, 400].map((delay) => (
            <span key={delay} style={{
              width: 7, height: 7, borderRadius: "50%",
              background: isStaff ? "#a3e635" : "#6b7280",
              display: "inline-block",
              animation: "typingBounce 1.2s ease-in-out infinite",
              animationDelay: `${delay}ms`,
            }} />
          ))}
        </div>
      </div>
      <style>{`
        @keyframes typingBounce {
          0%,60%,100% { transform:translateY(0);   opacity:.35; }
          30%          { transform:translateY(-7px); opacity:1;   }
        }
      `}</style>
    </div>
  );
}

// ─── LIVE CHAT ────────────────────────────────────────────────────────────────

function LiveChat({ ticket: init, userId, userProfile, onBack, onRefresh }) {
  const [ticket, setTicket]           = useState(init);
  const [messages, setMessages]       = useState([]);
  const [newMsg, setNewMsg]           = useState("");
  const [sending, setSending]         = useState(false);
  const [loading, setLoading]         = useState(true);
  const [staffTyping, setStaffTyping] = useState(null); // adminId of who is typing

  const channelRef    = useRef(null);
  const ticketChanRef = useRef(null);
  const presenceRef   = useRef(null);
  const typingTimer   = useRef(null);
  const bottomRef     = useRef(null);
  const inputRef      = useRef(null);
  const mounted       = useRef(true);

  const isActive = ["open", "in_progress", "waiting"].includes(ticket.status);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, staffTyping]);

  // ── Presence typing channel ───────────────────────────────────────────────
  useEffect(() => {
    if (!userId || !ticket.id) return;
    const ch = supabase.channel(`typing-${ticket.id}`, { config: { presence: { key: userId } } });

    const sync = () => {
      const state = ch.presenceState();
      let typingAdminId = null;
      for (const [key, presences] of Object.entries(state)) {
        if (key !== userId && presences.some((p) => p.is_typing && p.is_staff)) {
          typingAdminId = key; break;
        }
      }
      if (mounted.current) setStaffTyping(typingAdminId);
    };

    ch.on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe(async (s) => { if (s === "SUBSCRIBED") await ch.track({ is_typing: false, is_staff: false }); });

    presenceRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [userId, ticket.id]);

  const broadcastTyping = useCallback(async (val) => {
    if (!presenceRef.current) return;
    await presenceRef.current.track({ is_typing: val, is_staff: false });
  }, []);

  const handleInputChange = (e) => {
    setNewMsg(e.target.value);
    broadcastTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => broadcastTyping(false), 2500);
  };

  // ── Messages + ticket subscriptions ──────────────────────────────────────
  useEffect(() => {
    loadMessages();
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    channelRef.current = supabase
      .channel(`user-msgs-${ticket.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages", filter: `ticket_id=eq.${ticket.id}` },
        async (payload) => {
          if (payload.new.is_internal) return;
          const { data } = await supabase
            .from("support_messages")
            .select("*, profiles:user_id(id, full_name, avatar_id, avatar_metadata)")
            .eq("id", payload.new.id).single();
          if (data && mounted.current) setMessages((p) => p.some((m) => m.id === data.id) ? p : [...p, data]);
        })
      .subscribe();

    if (ticketChanRef.current) supabase.removeChannel(ticketChanRef.current);
    ticketChanRef.current = supabase
      .channel(`user-ticket-${ticket.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "support_tickets", filter: `id=eq.${ticket.id}` },
        async () => {
          const { data } = await supabase.from("support_tickets").select("*").eq("id", ticket.id).single();
          if (data && mounted.current) setTicket(data);
        })
      .subscribe();

    return () => {
      if (channelRef.current)    supabase.removeChannel(channelRef.current);
      if (ticketChanRef.current) supabase.removeChannel(ticketChanRef.current);
      clearTimeout(typingTimer.current);
    };
  }, [ticket.id]);

  const loadMessages = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("support_messages")
      .select("*, profiles:user_id(id, full_name, avatar_id, avatar_metadata)")
      .eq("ticket_id", ticket.id)
      .eq("is_internal", false)
      .order("created_at", { ascending: true });
    if (mounted.current) { setMessages(data || []); setLoading(false); }
  };

  const sendMessage = async () => {
    if (!newMsg.trim() || sending || !userId) return;
    setSending(true);
    clearTimeout(typingTimer.current);
    broadcastTyping(false);
    const content = newMsg.trim();
    setNewMsg("");
    await supabase.from("support_messages").insert({ ticket_id: ticket.id, user_id: userId, content, is_staff: false, is_internal: false });
    if (["waiting", "open"].includes(ticket.status)) {
      await supabase.from("support_tickets").update({ status: "in_progress", updated_at: new Date().toISOString() }).eq("id", ticket.id);
    }
    if (mounted.current) setSending(false);
    onRefresh();
    inputRef.current?.focus();
  };

  const closeTicket = async () => {
    if (!window.confirm("Close this ticket? You can always open a new one.")) return;
    await supabase.from("support_tickets").update({ status: "closed", closed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", ticket.id);
    onRefresh(); onBack();
  };

  const cat = CATEGORIES.find((c) => c.value === ticket.category);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* ── Header ── */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.35)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <button onClick={onBack} style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#9ca3af", flexShrink: 0 }}>
            <ArrowLeft size={14} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ticket.subject}</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <StatusBadge status={ticket.status} />
              {cat && <span style={{ fontSize: 11, color: "#6b7280" }}>{cat.label}</span>}
            </div>
          </div>
          <button onClick={loadMessages} style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6b7280" }}>
            <RefreshCw size={12} />
          </button>
        </div>

        {isActive && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 11, color: "#22c55e", fontWeight: 600 }}>Live Support Session</span>
            <span style={{ fontSize: 11, color: "#4b5563", marginLeft: "auto" }}>Avg reply: ~2h</span>
          </div>
        )}
        {ticket.status === "resolved" && (
          <div style={{ padding: "8px 12px", background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)", borderRadius: 8 }}>
            <span style={{ fontSize: 11, color: "#8b5cf6", fontWeight: 600 }}>✅ Resolved by support</span>
            {ticket.resolve_note && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{ticket.resolve_note}</div>}
          </div>
        )}
      </div>

      {/* ── Messages ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 8px", display: "flex", flexDirection: "column", gap: 12 }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
            <Loader2 size={22} style={{ color: "#a3e635", animation: "spin 0.8s linear infinite" }} />
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 20px" }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>💬</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 6 }}>Ticket received</div>
            <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.7 }}>Our team has your ticket and will reply shortly.</div>
          </div>
        ) : messages.map((msg, i) => {
          const isMine  = msg.user_id === userId && !msg.is_staff;
          const isStaff = msg.is_staff;
          // For staff messages we use the anonymous badge; for user messages use their profile
          const senderProfile = msg.profiles;

          return (
            <div key={msg.id || i} style={{ display: "flex", justifyContent: isMine ? "flex-end" : "flex-start", gap: 8, alignItems: "flex-end" }}>

              {/* Left avatar — only for incoming messages */}
              {!isMine && (
                isStaff
                  ? <AdminBadge adminId={msg.user_id} size={28} />
                  : <UserAvatar profile={senderProfile} size={28} />
              )}

              <div style={{ maxWidth: "78%", display: "flex", flexDirection: "column", alignItems: isMine ? "flex-end" : "flex-start" }}>
                {/* Staff label */}
                {isStaff && (
                  <div style={{ fontSize: 10, color: "#a3e635", fontWeight: 700, marginBottom: 3, display: "flex", alignItems: "center", gap: 4 }}>
                    <Shield size={10} /> Xeevia Support
                  </div>
                )}
                <div style={{
                  padding: "9px 13px",
                  borderRadius: isMine ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  background: isMine ? "linear-gradient(135deg,#84cc16,#65a30d)"
                    : isStaff  ? "rgba(132,204,22,0.08)"
                    : "rgba(255,255,255,0.06)",
                  border: isStaff && !isMine ? "1px solid rgba(132,204,22,0.18)" : "none",
                }}>
                  <div style={{ fontSize: 13, color: isMine ? "#000" : "#e5e7eb", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {msg.content}
                  </div>
                </div>
                <div style={{ fontSize: 10, color: "#4b5563", marginTop: 3 }}>
                  {new Date(msg.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>

              {/* Right avatar — only for outgoing (my) messages */}
              {isMine && <UserAvatar profile={userProfile} size={28} />}
            </div>
          );
        })}

        {/* Typing indicator */}
        {staffTyping && (
          <div style={{ animation: "fadeInUp 0.2s ease" }}>
            <TypingIndicator isStaff adminId={staffTyping} />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      {isActive ? (
        <div style={{ padding: "10px 14px 12px", borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.25)", flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            {/* User's own avatar beside input */}
            <UserAvatar profile={userProfile} size={32} />
            <textarea
              ref={inputRef}
              value={newMsg}
              onChange={handleInputChange}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              onBlur={() => { clearTimeout(typingTimer.current); broadcastTyping(false); }}
              placeholder="Type your message… (Enter to send)"
              rows={2}
              style={{ flex: 1, padding: "9px 13px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, color: "#fff", fontSize: 13, outline: "none", resize: "none", fontFamily: "inherit" }}
            />
            <button onClick={sendMessage} disabled={sending || !newMsg.trim() || !userId} style={{ width: 40, height: 40, background: "linear-gradient(135deg,#84cc16,#65a30d)", border: "none", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: sending || !newMsg.trim() || !userId ? 0.45 : 1, flexShrink: 0 }}>
              {sending ? <Loader2 size={15} style={{ color: "#000", animation: "spin 0.6s linear infinite" }} /> : <Send size={15} style={{ color: "#000" }} />}
            </button>
          </div>
          <button onClick={closeTicket} style={{ marginTop: 8, width: "100%", padding: "6px", background: "transparent", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 8, color: "#ef4444", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
            <Trash2 size={11} /> Close Ticket
          </button>
        </div>
      ) : (
        <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.05)", textAlign: "center" }}>
          <span style={{ fontSize: 12, color: "#6b7280" }}>Ticket is {ticket.status}.</span>
        </div>
      )}

      <style>{`
        @keyframes spin     { to { transform:rotate(360deg); } }
        @keyframes pulse    { 0%,100%{opacity:1}50%{opacity:.4} }
        @keyframes fadeInUp { from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );
}

// ─── NEW TICKET FORM ──────────────────────────────────────────────────────────

function NewTicketForm({ userId, existingActive, onCreated }) {
  const [form, setForm]         = useState({ category: "", subject: "", description: "" });
  const [creating, setCreating] = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState(false);

  const submit = async () => {
    if (!userId) { setError("Session not ready. Please wait a moment and try again."); return; }
    if (!form.category || !form.subject.trim() || !form.description.trim()) { setError("Please complete all fields."); return; }
    if (existingActive) { setError("You have an active ticket. Resolve or close it before opening a new one."); return; }
    setCreating(true); setError("");
    try {
      const { data, error: err } = await supabase
        .from("support_tickets")
        .insert({ user_id: userId, category: form.category, subject: form.subject.trim(), description: form.description.trim(), status: "open", priority: "medium" })
        .select().single();
      if (err) throw err;
      await supabase.from("support_messages").insert({ ticket_id: data.id, user_id: userId, content: form.description.trim(), is_staff: false, is_internal: false });
      setSuccess(true);
      setTimeout(() => { setSuccess(false); onCreated(data); }, 1200);
    } catch (e) {
      setError(e.message || "Failed to create ticket.");
    } finally { setCreating(false); }
  };

  if (success) return (
    <div style={{ textAlign: "center", padding: "60px 20px" }}>
      <div style={{ fontSize: 52, marginBottom: 14 }}>✅</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 6 }}>Ticket Created!</div>
      <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.7 }}>Our team will respond within 2-4 hours.</div>
    </div>
  );

  return (
    <div style={{ padding: "0 16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
      {existingActive && (
        <div style={{ padding: "12px 14px", background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.18)", borderRadius: 12 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <AlertTriangle size={14} style={{ color: "#f59e0b", marginTop: 1, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f59e0b", marginBottom: 2 }}>Active ticket exists</div>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>"{existingActive.subject}" — resolve or close it first.</div>
            </div>
          </div>
        </div>
      )}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", marginBottom: 8 }}>Issue Category</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {CATEGORIES.map((cat) => (
            <button key={cat.value} onClick={() => setForm((p) => ({ ...p, category: cat.value }))} style={{ padding: "10px 12px", background: form.category === cat.value ? "rgba(132,204,22,0.1)" : "rgba(255,255,255,0.02)", border: `1px solid ${form.category === cat.value ? "rgba(132,204,22,0.4)" : "rgba(255,255,255,0.06)"}`, borderRadius: 10, cursor: "pointer", textAlign: "left" }}>
              <div style={{ fontSize: 12, color: form.category === cat.value ? "#a3e635" : "#fff", fontWeight: 600, marginBottom: 2 }}>{cat.label}</div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>{cat.desc}</div>
            </button>
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", marginBottom: 6 }}>Subject</div>
        <input value={form.subject} onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))} placeholder="Brief description of your issue" maxLength={100} style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", marginBottom: 6 }}>Describe Your Issue</div>
        <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Include relevant details — the more context you provide, the faster we can help." rows={4} style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#fff", fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
      </div>
      {error && <div style={{ padding: "9px 14px", background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)", borderRadius: 10, color: "#fca5a5", fontSize: 12 }}>{error}</div>}
      <button onClick={submit} disabled={creating || !!existingActive || !userId} style={{ padding: "13px", background: "linear-gradient(135deg,#84cc16,#65a30d)", border: "none", borderRadius: 12, color: "#000", fontSize: 14, fontWeight: 700, cursor: creating || existingActive || !userId ? "not-allowed" : "pointer", opacity: existingActive || !userId ? 0.45 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {creating ? <><Loader2 size={15} style={{ animation: "spin 0.6s linear infinite" }} /> Creating…</> : <><Send size={14} /> Submit Ticket</>}
      </button>
      <div style={{ padding: "12px 14px", background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.12)", borderRadius: 10 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {[{ icon: "⚡", label: "Payment", time: "< 2h" }, { icon: "🔧", label: "Technical", time: "< 4h" }, { icon: "💬", label: "General", time: "< 6h" }].map((item) => (
            <div key={item.label} style={{ flex: 1, padding: "8px", background: "rgba(255,255,255,0.02)", borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 16, marginBottom: 2 }}>{item.icon}</div>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>{item.label}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#3b82f6" }}>{item.time}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: "#4b5563", marginTop: 8, textAlign: "center" }}>Support hours: 9am–10pm WAT, Mon–Sat</div>
      </div>
      <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── TICKET LIST ──────────────────────────────────────────────────────────────

function TicketList({ tickets, loading, onSelect, onNew }) {
  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 50 }}><Loader2 size={22} style={{ color: "#a3e635", animation: "spin 0.8s linear infinite" }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>;
  if (tickets.length === 0) return (
    <div style={{ textAlign: "center", padding: "48px 20px" }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🎫</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 6 }}>No tickets yet</div>
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 18, lineHeight: 1.7 }}>Open a ticket and our team will help you directly.</div>
      <button onClick={onNew} style={{ padding: "10px 22px", background: "linear-gradient(135deg,#84cc16,#65a30d)", border: "none", borderRadius: 10, color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ Open First Ticket</button>
    </div>
  );
  const active = tickets.filter((t) => t.status !== "closed");
  const closed = tickets.filter((t) => t.status === "closed");
  const renderRow = (ticket) => {
    const isActive = ["open","in_progress","waiting"].includes(ticket.status);
    const cat = CATEGORIES.find((c) => c.value === ticket.category);
    return (
      <button key={ticket.id} onClick={() => onSelect(ticket)} style={{ display: "flex", flexDirection: "column", gap: 8, padding: "14px 14px", background: isActive ? "rgba(132,204,22,0.03)" : "rgba(255,255,255,0.01)", border: `1px solid ${isActive ? "rgba(132,204,22,0.15)" : "rgba(255,255,255,0.05)"}`, borderRadius: 12, cursor: "pointer", textAlign: "left", width: "100%", transition: "all 0.12s" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {isActive && <Zap size={10} style={{ color: "#a3e635", marginRight: 4, verticalAlign: "middle" }} />}
              {ticket.subject}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {cat && <span style={{ fontSize: 11, color: "#6b7280" }}>{cat.label}</span>}
              <span style={{ fontSize: 11, color: "#4b5563" }}>· {timeAgo(ticket.updated_at)}</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <StatusBadge status={ticket.status} />
            <ChevronRight size={13} style={{ color: "#4b5563" }} />
          </div>
        </div>
      </button>
    );
  };
  return (
    <div style={{ padding: "0 16px 20px", display: "flex", flexDirection: "column", gap: 6 }}>
      {active.map(renderRow)}
      {closed.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: "#4b5563", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", padding: "8px 0 4px", marginTop: 8 }}>Closed (30-day history)</div>
          {closed.map(renderRow)}
        </>
      )}
    </div>
  );
}

// ─── MAIN CONTACT TAB ─────────────────────────────────────────────────────────

export default function ContactTab({ userId: userIdProp }) {
  const [userId, setUserId]           = useState(userIdProp || null);
  const [userProfile, setUserProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(!userIdProp);
  const [tab, setTab]                 = useState("new");
  const [tickets, setTickets]         = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [activeTicket, setActiveTicket]     = useState(null);
  const mounted = useRef(true);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  // Resolve userId + fetch profile
  useEffect(() => {
    if (userIdProp) { setUserId(userIdProp); setAuthLoading(false); return; }
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session?.user?.id) setUserId(session.user.id);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (cancelled) return;
      setUserId(session?.user?.id || null);
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, [userIdProp]);

  // Load profile once we have userId
  useEffect(() => {
    if (!userId) return;
    supabase.from("profiles").select("id, full_name, avatar_id, avatar_metadata").eq("id", userId).single()
      .then(({ data }) => { if (data && mounted.current) setUserProfile(data); });
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    loadTickets();
    const chan = supabase
      .channel(`user-ticket-list-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets", filter: `user_id=eq.${userId}` }, () => loadTickets())
      .subscribe();
    return () => supabase.removeChannel(chan);
  }, [userId]);

  const loadTickets = async () => {
    if (!userId) return;
    setLoadingTickets(true);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data } = await supabase
      .from("support_tickets").select("*").eq("user_id", userId).neq("status", "deleted")
      .or(`status.neq.closed,closed_at.gte.${thirtyDaysAgo}`)
      .order("updated_at", { ascending: false });
    if (mounted.current) { setTickets(data || []); setLoadingTickets(false); }
  };

  const openChat  = (ticket) => setActiveTicket(ticket);
  const closeChat = () => { setActiveTicket(null); setTab("tickets"); };
  const existingActive = tickets.find((t) => ["open","in_progress","waiting"].includes(t.status));

  if (authLoading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 60 }}>
      <Loader2 size={24} style={{ color: "#a3e635", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
    </div>
  );

  if (!userId) return (
    <div style={{ textAlign: "center", padding: "60px 20px" }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>🔐</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 6 }}>Sign in required</div>
      <div style={{ fontSize: 13, color: "#6b7280" }}>Please log in to access support.</div>
    </div>
  );

  if (activeTicket) return (
    <LiveChat
      ticket={activeTicket}
      userId={userId}
      userProfile={userProfile}
      onBack={closeChat}
      onRefresh={loadTickets}
    />
  );

  return (
    <div>
      <div style={{ padding: "20px 18px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "linear-gradient(135deg,rgba(59,130,246,0.06) 0%,transparent 60%)" }}>
        {/* Header with user avatar */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <UserAvatar profile={userProfile} size={42} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>Support Center</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>We usually respond within 2-4 hours</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[{ key: "new", label: "➕ New Ticket" }, { key: "tickets", label: `🎫 My Tickets${tickets.length > 0 ? ` (${tickets.length})` : ""}` }].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ flex: 1, padding: "9px 12px", borderRadius: 10, border: `1px solid ${tab === t.key ? "rgba(132,204,22,0.4)" : "rgba(255,255,255,0.07)"}`, background: tab === t.key ? "rgba(132,204,22,0.1)" : "rgba(255,255,255,0.02)", color: tab === t.key ? "#a3e635" : "#6b7280", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "new" && existingActive && (
        <div style={{ margin: "12px 16px 0" }}>
          <button onClick={() => openChat(existingActive)} style={{ width: "100%", padding: "12px 14px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 12, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", flexShrink: 0, animation: "pulse 2s infinite" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 1 }}>Active ticket</div>
              <div style={{ fontSize: 12, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{existingActive.subject}</div>
            </div>
            <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 600, flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}>Open Chat <ChevronRight size={12} /></span>
          </button>
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
        </div>
      )}

      <div style={{ paddingTop: 12 }}>
        {tab === "new"
          ? <NewTicketForm userId={userId} existingActive={existingActive || null} onCreated={(ticket) => { loadTickets(); openChat(ticket); }} />
          : <TicketList tickets={tickets} loading={loadingTickets} onSelect={openChat} onNew={() => setTab("new")} />
        }
      </div>
    </div>
  );
}