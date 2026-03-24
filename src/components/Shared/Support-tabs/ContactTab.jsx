// src/components/Support/ContactTab.jsx
// User-facing support center — create tickets, live chat with admin
// Tables: support_tickets, support_messages
// Real-time via Supabase Realtime + Presence (typing indicators)

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Send, Loader2, Shield, Trash2, AlertTriangle,
  ChevronRight, ArrowLeft, RefreshCw, Zap, Clock,
  CheckCircle, XCircle, MessageCircle, Plus,
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

const CATEGORIES = [
  { value: "payment",    label: "💳 Payment Issue",       desc: "Deposits, withdrawals, billing"   },
  { value: "content",    label: "📝 Content Problem",     desc: "Publishing, editing, removal"     },
  { value: "account",    label: "🔐 Account Access",      desc: "Login, security, profile"         },
  { value: "technical",  label: "⚙️ Technical Bug",       desc: "App errors, performance"          },
  { value: "moderation", label: "🛡️ Moderation Appeal",  desc: "Content removal, suspension"      },
  { value: "tokens",     label: "💰 Token & Wallet",      desc: "EP, XEV, conversions"             },
  { value: "other",      label: "💬 General Inquiry",     desc: "Anything else"                    },
];

function timeAgo(ts) {
  if (!ts) return "";
  const m = Math.floor((Date.now() - new Date(ts)) / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── BADGES ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const s = STATUSES[status] || STATUSES.open;
  return (
    <span style={{
      padding: "3px 10px", borderRadius: 20, background: s.bg, color: s.color,
      fontSize: 11, fontWeight: 700,
      display: "inline-flex", alignItems: "center", gap: 5,
      border: `1px solid ${s.color}28`,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.dot }} />
      {s.label}
    </span>
  );
}

// ─── AVATAR HELPERS ───────────────────────────────────────────────────────────

function stringToColor(str = "") {
  const palette = ["#6366f1","#8b5cf6","#ec4899","#f59e0b","#10b981","#3b82f6","#ef4444","#14b8a6"];
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

  if (url) return (
    <img src={url} alt={name} onError={() => setError(true)}
      style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "2px solid rgba(255,255,255,0.08)" }} />
  );

  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: `linear-gradient(135deg, ${color}, ${color}88)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.36, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px",
      border: "2px solid rgba(255,255,255,0.08)",
      boxShadow: `0 2px 8px ${color}30`,
    }}>
      {initials(name)}
    </div>
  );
}

function AdminBadge({ adminId, size = 30 }) {
  const suffix = adminId ? adminId.replace(/-/g, "").slice(-2).toUpperCase() : "??";
  const tag    = `XA-${suffix}`;
  const color  = stringToColor(adminId || "admin");

  return (
    <div style={{
      height: size, minWidth: size + 20, borderRadius: size / 2, flexShrink: 0,
      background: `linear-gradient(135deg, ${color}18, ${color}30)`,
      border: `1.5px solid ${color}50`,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "0 10px", gap: 5,
      boxShadow: `0 2px 8px ${color}20`,
    }}>
      <Shield size={size * 0.36} style={{ color, flexShrink: 0 }} />
      <span style={{ fontSize: 10, fontWeight: 800, color, letterSpacing: "0.5px", whiteSpace: "nowrap" }}>
        {tag}
      </span>
    </div>
  );
}

// ─── TYPING INDICATOR ─────────────────────────────────────────────────────────

function TypingIndicator({ isStaff = true, adminId, userProfile }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
      {isStaff ? <AdminBadge adminId={adminId} size={28} /> : <UserAvatar profile={userProfile} size={28} />}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3 }}>
        {isStaff && (
          <div style={{ fontSize: 10, color: "#a3e635", fontWeight: 700, display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
            <Shield size={10} /> Xeevia Support
          </div>
        )}
        <div style={{
          padding: "10px 16px", borderRadius: "16px 16px 16px 4px",
          background: isStaff ? "rgba(132,204,22,0.07)" : "rgba(255,255,255,0.06)",
          border: isStaff ? "1px solid rgba(132,204,22,0.15)" : "none",
          display: "flex", alignItems: "center", gap: 5,
        }}>
          {[0, 160, 320].map((delay) => (
            <span key={delay} style={{
              width: 7, height: 7, borderRadius: "50%",
              background: isStaff ? "#a3e635" : "#6b7280",
              display: "inline-block",
              animation: "ctTyping 1.2s ease-in-out infinite",
              animationDelay: `${delay}ms`,
            }} />
          ))}
        </div>
      </div>
      <style>{`@keyframes ctTyping { 0%,60%,100%{transform:translateY(0);opacity:.35} 30%{transform:translateY(-7px);opacity:1} }`}</style>
    </div>
  );
}

// ─── LIVE CHAT ────────────────────────────────────────────────────────────────

function LiveChat({ ticket: init, userId, userProfile, onBack, onRefresh }) {
  const [ticket,      setTicket]      = useState(init);
  const [messages,    setMessages]    = useState([]);
  const [newMsg,      setNewMsg]      = useState("");
  const [sending,     setSending]     = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [staffTyping, setStaffTyping] = useState(null);

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

  useEffect(() => {
    if (!userId || !ticket.id) return;
    const ch = supabase.channel(`typing-${ticket.id}`, { config: { presence: { key: userId } } });
    const sync = () => {
      const state = ch.presenceState();
      let typingAdminId = null;
      for (const [key, presences] of Object.entries(state)) {
        if (key !== userId && presences.some((p) => p.is_typing && p.is_staff)) { typingAdminId = key; break; }
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

  useEffect(() => {
    loadMessages();
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    channelRef.current = supabase
      .channel(`user-msgs-${ticket.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages", filter: `ticket_id=eq.${ticket.id}` },
        async (payload) => {
          if (payload.new.is_internal) return;
          const { data } = await supabase.from("support_messages")
            .select("*, profiles:user_id(id, full_name, avatar_id, avatar_metadata)")
            .eq("id", payload.new.id).single();
          if (data && mounted.current) setMessages((p) => p.some((m) => m.id === data.id) ? p : [...p, data]);
        }).subscribe();

    if (ticketChanRef.current) supabase.removeChannel(ticketChanRef.current);
    ticketChanRef.current = supabase
      .channel(`user-ticket-${ticket.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "support_tickets", filter: `id=eq.${ticket.id}` },
        async () => {
          const { data } = await supabase.from("support_tickets").select("*").eq("id", ticket.id).single();
          if (data && mounted.current) setTicket(data);
        }).subscribe();

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
      .eq("ticket_id", ticket.id).eq("is_internal", false)
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
    await supabase.from("support_messages").insert({
      ticket_id: ticket.id, user_id: userId, content, is_staff: false, is_internal: false,
    });
    if (["waiting", "open"].includes(ticket.status)) {
      await supabase.from("support_tickets")
        .update({ status: "in_progress", updated_at: new Date().toISOString() }).eq("id", ticket.id);
    }
    if (mounted.current) setSending(false);
    onRefresh();
    inputRef.current?.focus();
  };

  const closeTicket = async () => {
    if (!window.confirm("Close this ticket? You can always open a new one.")) return;
    await supabase.from("support_tickets").update({
      status: "closed", closed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", ticket.id);
    onRefresh(); onBack();
  };

  const cat = CATEGORIES.find((c) => c.value === ticket.category);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <style>{`@keyframes ctSpin{to{transform:rotate(360deg)}} @keyframes ctPulse{0%,100%{opacity:1}50%{opacity:.4}} @keyframes ctFadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Header */}
      <div style={{
        padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(0,0,0,0.4)", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <button onClick={onBack} style={{
            width: 32, height: 32, borderRadius: 9,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "#6b7280", flexShrink: 0, transition: "all .18s",
          }}>
            <ArrowLeft size={14} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {ticket.subject}
            </div>
            <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
              <StatusBadge status={ticket.status} />
              {cat && <span style={{ fontSize: 11, color: "#525252" }}>{cat.label}</span>}
            </div>
          </div>
          <button onClick={loadMessages} style={{
            width: 30, height: 30, borderRadius: 8,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "#525252", transition: "all .18s",
          }}>
            <RefreshCw size={12} />
          </button>
        </div>

        {isActive && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
            background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.15)",
            borderRadius: 10,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", animation: "ctPulse 2s infinite", flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: "#22c55e", fontWeight: 700 }}>Live Support Session</span>
            <span style={{ fontSize: 11, color: "#3a3a3a", marginLeft: "auto" }}>Avg reply: ~2h</span>
          </div>
        )}
        {ticket.status === "resolved" && (
          <div style={{
            padding: "9px 13px", background: "rgba(139,92,246,0.06)",
            border: "1px solid rgba(139,92,246,0.18)", borderRadius: 10,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <CheckCircle size={13} color="#8b5cf6" />
            <div>
              <span style={{ fontSize: 12, color: "#8b5cf6", fontWeight: 700 }}>Resolved by support</span>
              {ticket.resolve_note && <div style={{ fontSize: 11, color: "#525252", marginTop: 2 }}>{ticket.resolve_note}</div>}
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px 10px", display: "flex", flexDirection: "column", gap: 14 }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 50 }}>
            <Loader2 size={22} style={{ color: "#a3e635", animation: "ctSpin 0.8s linear infinite" }} />
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", animation: "ctFadeUp .3s ease" }}>
            <div style={{
              width: 64, height: 64, borderRadius: 20, margin: "0 auto 16px",
              background: "rgba(132,204,22,0.08)", border: "1px solid rgba(132,204,22,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 30,
            }}>💬</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginBottom: 6 }}>Ticket received</div>
            <div style={{ fontSize: 12, color: "#484848", lineHeight: 1.7 }}>Our team has your ticket and will reply shortly.</div>
          </div>
        ) : messages.map((msg, i) => {
          const isMine  = msg.user_id === userId && !msg.is_staff;
          const isStaff = msg.is_staff;
          const senderProfile = msg.profiles;

          return (
            <div key={msg.id || i} style={{ display: "flex", justifyContent: isMine ? "flex-end" : "flex-start", gap: 8, alignItems: "flex-end", animation: "ctFadeUp .2s ease" }}>
              {!isMine && (isStaff ? <AdminBadge adminId={msg.user_id} size={28} /> : <UserAvatar profile={senderProfile} size={28} />)}
              <div style={{ maxWidth: "78%", display: "flex", flexDirection: "column", alignItems: isMine ? "flex-end" : "flex-start" }}>
                {isStaff && (
                  <div style={{ fontSize: 10, color: "#a3e635", fontWeight: 700, marginBottom: 3, display: "flex", alignItems: "center", gap: 4 }}>
                    <Shield size={10} /> Xeevia Support
                  </div>
                )}
                <div style={{
                  padding: "10px 14px",
                  borderRadius: isMine ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  background: isMine
                    ? "linear-gradient(135deg,#84cc16,#65a30d)"
                    : isStaff ? "rgba(132,204,22,0.07)"
                    : "rgba(255,255,255,0.05)",
                  border: isStaff && !isMine ? "1px solid rgba(132,204,22,0.15)" : "none",
                  boxShadow: isMine ? "0 3px 12px rgba(132,204,22,.2)" : "none",
                }}>
                  <div style={{ fontSize: 13, color: isMine ? "#000" : "#e5e7eb", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {msg.content}
                  </div>
                </div>
                <div style={{ fontSize: 10, color: "#363636", marginTop: 3 }}>
                  {new Date(msg.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
              {isMine && <UserAvatar profile={userProfile} size={28} />}
            </div>
          );
        })}

        {staffTyping && (
          <div style={{ animation: "ctFadeUp .2s ease" }}>
            <TypingIndicator isStaff adminId={staffTyping} />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {isActive ? (
        <div style={{
          padding: "10px 14px 14px", borderTop: "1px solid rgba(255,255,255,0.05)",
          background: "rgba(0,0,0,0.3)", flexShrink: 0,
        }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <UserAvatar profile={userProfile} size={32} />
            <textarea
              ref={inputRef}
              value={newMsg}
              onChange={handleInputChange}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              onBlur={() => { clearTimeout(typingTimer.current); broadcastTyping(false); }}
              placeholder="Type your message… (Enter to send)"
              rows={2}
              style={{
                flex: 1, padding: "10px 14px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 13, color: "#fff", fontSize: 13, outline: "none",
                resize: "none", fontFamily: "inherit", lineHeight: 1.6,
                transition: "border-color .18s",
              }}
              onFocus={(e) => e.target.style.borderColor = "rgba(132,204,22,.3)"}
            />
            <button onClick={sendMessage} disabled={sending || !newMsg.trim() || !userId} style={{
              width: 42, height: 42, flexShrink: 0,
              background: "linear-gradient(135deg,#84cc16,#65a30d)",
              border: "none", borderRadius: 13,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: sending || !newMsg.trim() || !userId ? "not-allowed" : "pointer",
              opacity: sending || !newMsg.trim() || !userId ? 0.4 : 1,
              boxShadow: "0 3px 12px rgba(132,204,22,.25)",
              transition: "all .18s",
            }}>
              {sending
                ? <Loader2 size={15} style={{ color: "#000", animation: "ctSpin 0.6s linear infinite" }} />
                : <Send size={15} style={{ color: "#000" }} />}
            </button>
          </div>
          <button onClick={closeTicket} style={{
            marginTop: 9, width: "100%", padding: "7px",
            background: "transparent", border: "1px solid rgba(239,68,68,.12)",
            borderRadius: 9, color: "#ef4444", fontSize: 11, fontWeight: 600,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            transition: "all .18s",
          }}
            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(239,68,68,.06)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
            <XCircle size={12} /> Close Ticket
          </button>
        </div>
      ) : (
        <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.05)", textAlign: "center" }}>
          <span style={{ fontSize: 12, color: "#484848" }}>Ticket is {ticket.status}.</span>
        </div>
      )}
    </div>
  );
}

// ─── NEW TICKET FORM ──────────────────────────────────────────────────────────

function NewTicketForm({ userId, existingActive, onCreated }) {
  const [form,     setForm]     = useState({ category: "", subject: "", description: "" });
  const [creating, setCreating] = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState(false);

  const submit = async () => {
    if (!userId) { setError("Session not ready. Please wait a moment and try again."); return; }
    if (!form.category || !form.subject.trim() || !form.description.trim()) { setError("Please complete all fields."); return; }
    if (existingActive) { setError("You have an active ticket. Resolve or close it before opening a new one."); return; }
    setCreating(true); setError("");
    try {
      const { data, error: err } = await supabase.from("support_tickets")
        .insert({ user_id: userId, category: form.category, subject: form.subject.trim(), description: form.description.trim(), status: "open", priority: "medium" })
        .select().single();
      if (err) throw err;
      await supabase.from("support_messages").insert({
        ticket_id: data.id, user_id: userId, content: form.description.trim(), is_staff: false, is_internal: false,
      });
      setSuccess(true);
      setTimeout(() => { setSuccess(false); onCreated(data); }, 1200);
    } catch (e) { setError(e.message || "Failed to create ticket."); }
    finally { setCreating(false); }
  };

  if (success) return (
    <div style={{ textAlign: "center", padding: "70px 20px" }}>
      <div style={{
        width: 72, height: 72, borderRadius: 22, margin: "0 auto 18px",
        background: "linear-gradient(135deg, rgba(132,204,22,.15), rgba(132,204,22,.05))",
        border: "1px solid rgba(132,204,22,.3)",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38,
      }}>✅</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 8 }}>Ticket Created!</div>
      <div style={{ fontSize: 13, color: "#484848", lineHeight: 1.7 }}>Our team will respond within 2–4 hours.</div>
    </div>
  );

  return (
    <div style={{ padding: "0 16px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
      <style>{`@keyframes ntSpin{to{transform:rotate(360deg)}}`}</style>

      {existingActive && (
        <div style={{
          padding: "13px 15px", background: "rgba(245,158,11,0.06)",
          border: "1px solid rgba(245,158,11,0.2)", borderRadius: 13,
        }}>
          <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
            <AlertTriangle size={14} style={{ color: "#f59e0b", marginTop: 1, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f59e0b", marginBottom: 3 }}>Active ticket exists</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>"{existingActive.subject}" — resolve or close it first.</div>
            </div>
          </div>
        </div>
      )}

      {/* Category */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#525252", marginBottom: 10, letterSpacing: ".5px", textTransform: "uppercase" }}>
          Issue Category
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
          {CATEGORIES.map((cat) => {
            const active = form.category === cat.value;
            return (
              <button key={cat.value} onClick={() => setForm((p) => ({ ...p, category: cat.value }))} style={{
                padding: "11px 12px",
                background: active ? "rgba(132,204,22,0.1)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${active ? "rgba(132,204,22,0.4)" : "rgba(255,255,255,0.06)"}`,
                borderRadius: 11, cursor: "pointer", textAlign: "left",
                boxShadow: active ? "0 2px 10px rgba(132,204,22,.12)" : "none",
                transition: "all .18s",
              }}>
                <div style={{ fontSize: 12, color: active ? "#a3e635" : "#d4d4d4", fontWeight: 700, marginBottom: 2 }}>{cat.label}</div>
                <div style={{ fontSize: 11, color: "#484848" }}>{cat.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Subject */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#525252", marginBottom: 8, letterSpacing: ".5px", textTransform: "uppercase" }}>Subject</div>
        <input value={form.subject} onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
          placeholder="Brief description of your issue" maxLength={100}
          style={{
            width: "100%", padding: "11px 14px",
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 11, color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box",
            transition: "border-color .18s",
          }}
          onFocus={(e) => e.target.style.borderColor = "rgba(132,204,22,.3)"}
          onBlur={(e)  => e.target.style.borderColor = "rgba(255,255,255,.08)"}
        />
      </div>

      {/* Description */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#525252", marginBottom: 8, letterSpacing: ".5px", textTransform: "uppercase" }}>Describe Your Issue</div>
        <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          placeholder="Include relevant details — the more context you provide, the faster we can help."
          rows={4}
          style={{
            width: "100%", padding: "11px 14px",
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 11, color: "#fff", fontSize: 13, outline: "none",
            resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", lineHeight: 1.6,
            transition: "border-color .18s",
          }}
          onFocus={(e) => e.target.style.borderColor = "rgba(132,204,22,.3)"}
          onBlur={(e)  => e.target.style.borderColor = "rgba(255,255,255,.08)"}
        />
      </div>

      {error && (
        <div style={{
          padding: "10px 14px", background: "rgba(239,68,68,0.06)",
          border: "1px solid rgba(239,68,68,0.18)", borderRadius: 11,
          color: "#fca5a5", fontSize: 12, display: "flex", gap: 8, alignItems: "flex-start",
        }}>
          <XCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          {error}
        </div>
      )}

      <button onClick={submit} disabled={creating || !!existingActive || !userId} style={{
        padding: "14px", background: "linear-gradient(135deg,#84cc16,#65a30d)",
        border: "none", borderRadius: 13, color: "#000", fontSize: 14, fontWeight: 800,
        cursor: creating || existingActive || !userId ? "not-allowed" : "pointer",
        opacity: existingActive || !userId ? 0.4 : 1,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        boxShadow: "0 4px 18px rgba(132,204,22,.25)",
        transition: "all .18s",
      }}>
        {creating
          ? <><Loader2 size={15} style={{ animation: "ntSpin 0.6s linear infinite" }} /> Creating…</>
          : <><Send size={14} /> Submit Ticket</>}
      </button>

      {/* SLA preview */}
      <div style={{
        padding: "14px", background: "rgba(59,130,246,0.04)",
        border: "1px solid rgba(59,130,246,0.1)", borderRadius: 13,
      }}>
        <div style={{ display: "flex", gap: 7, marginBottom: 10 }}>
          {[
            { icon: "⚡", label: "Payment",   time: "< 2h" },
            { icon: "🔧", label: "Technical", time: "< 4h" },
            { icon: "💬", label: "General",   time: "< 6h" },
          ].map((item) => (
            <div key={item.label} style={{
              flex: 1, padding: "10px 6px",
              background: "rgba(255,255,255,0.02)", borderRadius: 9, textAlign: "center",
              border: "1px solid rgba(255,255,255,0.05)",
            }}>
              <div style={{ fontSize: 18, marginBottom: 3 }}>{item.icon}</div>
              <div style={{ fontSize: 10, color: "#484848", marginBottom: 3 }}>{item.label}</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#3b82f6" }}>{item.time}</div>
            </div>
          ))}
        </div>
        <div style={{
          fontSize: 11, color: "#363636", textAlign: "center",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
        }}>
          <Clock size={10} />
          Support hours: 9am–10pm WAT, Mon–Sat
        </div>
      </div>
    </div>
  );
}

// ─── TICKET LIST ──────────────────────────────────────────────────────────────

function TicketList({ tickets, loading, onSelect, onNew }) {
  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
      <Loader2 size={22} style={{ color: "#a3e635", animation: "tlSpin 0.8s linear infinite" }} />
      <style>{`@keyframes tlSpin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (tickets.length === 0) return (
    <div style={{ textAlign: "center", padding: "56px 20px" }}>
      <div style={{
        width: 72, height: 72, borderRadius: 22, margin: "0 auto 18px",
        background: "rgba(132,204,22,0.06)", border: "1px solid rgba(132,204,22,0.15)",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32,
      }}>🎫</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 6 }}>No tickets yet</div>
      <div style={{ fontSize: 13, color: "#484848", marginBottom: 20, lineHeight: 1.7 }}>Open a ticket and our team will help you directly.</div>
      <button onClick={onNew} style={{
        padding: "11px 26px", background: "linear-gradient(135deg,#84cc16,#65a30d)",
        border: "none", borderRadius: 11, color: "#000", fontSize: 13, fontWeight: 700,
        cursor: "pointer", boxShadow: "0 3px 14px rgba(132,204,22,.25)",
        display: "inline-flex", alignItems: "center", gap: 7,
      }}>
        <Plus size={14} /> Open First Ticket
      </button>
    </div>
  );

  const active = tickets.filter((t) => t.status !== "closed");
  const closed = tickets.filter((t) => t.status === "closed");

  const renderRow = (ticket) => {
    const isActive = ["open","in_progress","waiting"].includes(ticket.status);
    const cat = CATEGORIES.find((c) => c.value === ticket.category);
    return (
      <button key={ticket.id} onClick={() => onSelect(ticket)} style={{
        display: "flex", flexDirection: "column", gap: 9, padding: "14px 15px",
        background: isActive ? "rgba(132,204,22,0.03)" : "rgba(255,255,255,0.015)",
        border: `1px solid ${isActive ? "rgba(132,204,22,0.15)" : "rgba(255,255,255,0.05)"}`,
        borderRadius: 13, cursor: "pointer", textAlign: "left", width: "100%",
        transition: "all .18s",
      }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = isActive ? "rgba(132,204,22,.3)" : "rgba(255,255,255,.1)"; e.currentTarget.style.transform = "translateX(2px)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = isActive ? "rgba(132,204,22,.15)" : "rgba(255,255,255,.05)"; e.currentTarget.style.transform = "none"; }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#e5e5e5", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {isActive && <Zap size={10} style={{ color: "#a3e635", marginRight: 4, verticalAlign: "middle" }} />}
              {ticket.subject}
            </div>
            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
              {cat && <span style={{ fontSize: 11, color: "#484848" }}>{cat.label}</span>}
              <span style={{ fontSize: 11, color: "#363636" }}>· {timeAgo(ticket.updated_at)}</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <StatusBadge status={ticket.status} />
            <ChevronRight size={13} style={{ color: "#363636" }} />
          </div>
        </div>
      </button>
    );
  };

  return (
    <div style={{ padding: "0 16px 24px", display: "flex", flexDirection: "column", gap: 7 }}>
      {active.map(renderRow)}
      {closed.length > 0 && (
        <>
          <div style={{
            fontSize: 10, color: "#363636", fontWeight: 700, letterSpacing: "1px",
            textTransform: "uppercase", padding: "10px 0 4px", marginTop: 8,
          }}>Closed (30-day history)</div>
          {closed.map(renderRow)}
        </>
      )}
    </div>
  );
}

// ─── MAIN CONTACT TAB ─────────────────────────────────────────────────────────

export default function ContactTab({ userId: userIdProp }) {
  const [userId,        setUserId]        = useState(userIdProp || null);
  const [userProfile,   setUserProfile]   = useState(null);
  const [authLoading,   setAuthLoading]   = useState(!userIdProp);
  const [tab,           setTab]           = useState("new");
  const [tickets,       setTickets]       = useState([]);
  const [loadingTickets,setLoadingTickets]= useState(false);
  const [activeTicket,  setActiveTicket]  = useState(null);
  const mounted = useRef(true);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

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

  useEffect(() => {
    if (!userId) return;
    supabase.from("profiles").select("id, full_name, avatar_id, avatar_metadata").eq("id", userId).single()
      .then(({ data }) => { if (data && mounted.current) setUserProfile(data); });
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    loadTickets();
    const chan = supabase.channel(`user-ticket-list-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets", filter: `user_id=eq.${userId}` }, () => loadTickets())
      .subscribe();
    return () => supabase.removeChannel(chan);
  }, [userId]);

  const loadTickets = async () => {
    if (!userId) return;
    setLoadingTickets(true);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data } = await supabase.from("support_tickets").select("*").eq("user_id", userId).neq("status", "deleted")
      .or(`status.neq.closed,closed_at.gte.${thirtyDaysAgo}`)
      .order("updated_at", { ascending: false });
    if (mounted.current) { setTickets(data || []); setLoadingTickets(false); }
  };

  const openChat  = (ticket) => setActiveTicket(ticket);
  const closeChat = () => { setActiveTicket(null); setTab("tickets"); };
  const existingActive = tickets.find((t) => ["open","in_progress","waiting"].includes(t.status));

  if (authLoading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 70 }}>
      <Loader2 size={24} style={{ color: "#a3e635", animation: "ctaSpin 0.8s linear infinite" }} />
      <style>{`@keyframes ctaSpin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!userId) return (
    <div style={{ textAlign: "center", padding: "70px 20px" }}>
      <div style={{
        width: 64, height: 64, borderRadius: 20, margin: "0 auto 18px",
        background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.15)",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28,
      }}>🔐</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 6 }}>Sign in required</div>
      <div style={{ fontSize: 13, color: "#484848" }}>Please log in to access support.</div>
    </div>
  );

  if (activeTicket) return (
    <LiveChat ticket={activeTicket} userId={userId} userProfile={userProfile} onBack={closeChat} onRefresh={loadTickets} />
  );

  return (
    <div>
      {/* Header */}
      <div style={{
        padding: "22px 18px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        background: "linear-gradient(135deg, rgba(59,130,246,0.05) 0%, transparent 60%)",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 1,
          background: "linear-gradient(90deg, transparent, rgba(59,130,246,.3), transparent)",
        }} />

        {/* User row */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <UserAvatar profile={userProfile} size={46} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", lineHeight: 1.15 }}>Support Center</div>
            <div style={{ fontSize: 12, color: "#484848", marginTop: 3, display: "flex", alignItems: "center", gap: 5 }}>
              <MessageCircle size={10} color="#84cc16" />
              We usually respond within 2–4 hours
            </div>
          </div>
        </div>

        {/* Tab switcher */}
        <div style={{ display: "flex", gap: 7 }}>
          {[
            { key: "new",     label: "➕ New Ticket" },
            { key: "tickets", label: `🎫 My Tickets${tickets.length > 0 ? ` (${tickets.length})` : ""}` },
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex: 1, padding: "9px 12px", borderRadius: 11,
              border: `1px solid ${tab === t.key ? "rgba(132,204,22,0.4)" : "rgba(255,255,255,0.07)"}`,
              background: tab === t.key ? "rgba(132,204,22,0.1)" : "rgba(255,255,255,0.02)",
              color: tab === t.key ? "#a3e635" : "#525252",
              fontSize: 12, fontWeight: 700, cursor: "pointer",
              boxShadow: tab === t.key ? "0 2px 10px rgba(132,204,22,.08)" : "none",
              transition: "all .18s",
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Active ticket banner */}
      {tab === "new" && existingActive && (
        <div style={{ margin: "14px 16px 0" }}>
          <button onClick={() => openChat(existingActive)} style={{
            width: "100%", padding: "13px 15px",
            background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.2)",
            borderRadius: 13, cursor: "pointer", textAlign: "left",
            display: "flex", alignItems: "center", gap: 12,
            transition: "all .18s",
          }}
            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(34,197,94,.08)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "rgba(34,197,94,.05)"}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", flexShrink: 0, animation: "ctPulse 2s infinite" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 2 }}>Active ticket</div>
              <div style={{ fontSize: 12, color: "#484848", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{existingActive.subject}</div>
            </div>
            <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 700, flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}>
              Open Chat <ChevronRight size={12} />
            </span>
          </button>
          <style>{`@keyframes ctPulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
        </div>
      )}

      <div style={{ paddingTop: 14 }}>
        {tab === "new"
          ? <NewTicketForm userId={userId} existingActive={existingActive || null} onCreated={(ticket) => { loadTickets(); openChat(ticket); }} />
          : <TicketList tickets={tickets} loading={loadingTickets} onSelect={openChat} onNew={() => setTab("new")} />}
      </div>
    </div>
  );
}