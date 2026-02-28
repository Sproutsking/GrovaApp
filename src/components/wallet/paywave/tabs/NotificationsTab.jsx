// paywave/tabs/NotificationsTab.jsx  — v1
// ─────────────────────────────────────────────────────────────────────────────
// PayWave-specific real-time notification feed shown inside the PayWave panel.
// Reads from `notifications` where metadata->>'category' = 'paywave'
//
// EXPORTS:
//   default              — the tab component itself
//   createPayWaveNotif() — helper to fire notifications from anywhere in PayWave
//                          writes ONE row → appears in this feed AND the global sidebar
//
// PayWave pw_types:
//   transfer_sent | transfer_received | deposit | withdrawal
//   security_alert | stake_update | savings_update
//   card_activity  | scholarship_update | bill_payment
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, memo } from "react";
import {
  Bell, CheckCheck, RefreshCw,
  ArrowUpRight, ArrowDownLeft, Shield, Zap, PiggyBank,
  CreditCard, GraduationCap, Smartphone,
} from "lucide-react";
import { supabase } from "../../../../services/config/supabase";
import { useAuth } from "../../../../components/Auth/AuthContext";

// ── PayWave type registry ─────────────────────────────────────────────────────
export const PW_NOTIF_TYPES = {
  transfer_sent:      { Icon: ArrowUpRight,  color: "#f87171", bg: "rgba(248,113,113,0.13)", label: "Sent"        },
  transfer_received:  { Icon: ArrowDownLeft, color: "#a3e635", bg: "rgba(163,230,53,0.13)",  label: "Received"    },
  deposit:            { Icon: ArrowDownLeft, color: "#a3e635", bg: "rgba(163,230,53,0.13)",  label: "Deposit"     },
  withdrawal:         { Icon: ArrowUpRight,  color: "#d4a847", bg: "rgba(212,168,71,0.13)",  label: "Withdrawal"  },
  security_alert:     { Icon: Shield,        color: "#ef4444", bg: "rgba(239,68,68,0.14)",   label: "Security"    },
  stake_update:       { Icon: Zap,           color: "#a855f7", bg: "rgba(168,85,247,0.13)",  label: "Stake"       },
  savings_update:     { Icon: PiggyBank,     color: "#60a5fa", bg: "rgba(96,165,250,0.13)",  label: "Savings"     },
  card_activity:      { Icon: CreditCard,    color: "#f59e0b", bg: "rgba(245,158,11,0.13)",  label: "Card"        },
  scholarship_update: { Icon: GraduationCap, color: "#10b981", bg: "rgba(16,185,129,0.13)",  label: "Scholarship" },
  bill_payment:       { Icon: Smartphone,    color: "#8b5cf6", bg: "rgba(139,92,246,0.13)",  label: "Bills"       },
};

// ── Filter tabs ───────────────────────────────────────────────────────────────
const FILTER_TABS = [
  { id: "all",      label: "All",       types: null },
  { id: "transfer", label: "Transfers", types: ["transfer_sent","transfer_received"] },
  { id: "money",    label: "Money",     types: ["deposit","withdrawal","stake_update","savings_update","scholarship_update"] },
  { id: "security", label: "Security",  types: ["security_alert"] },
  { id: "services", label: "Services",  types: ["card_activity","bill_payment"] },
];

const EMPTY = {
  all:      { emoji: "🔔", title: "No PayWave notifications yet",    hint: "Transfers, deposits and alerts will appear here" },
  transfer: { emoji: "↕️", title: "No transfers yet",                hint: "Send or receive ₦ to see activity" },
  money:    { emoji: "💰", title: "No money activity",               hint: "Deposits, stakes and savings appear here" },
  security: { emoji: "🛡️", title: "All clear — no alerts",           hint: "Security events show here" },
  services: { emoji: "⚡", title: "No service activity",             hint: "Card and bill payment events appear here" },
};

// ── Exported notification creator ─────────────────────────────────────────────
// Usage in WalletTab after a successful transfer:
//   import { createPayWaveNotif } from "../tabs/NotificationsTab";
//   await createPayWaveNotif({ userId: profile.id, pwType: "transfer_sent",
//     title: `₦${fmtNGN(amount)} sent to @${recipUser.username}`,
//     body: "Transfer successful · PayWave" });
export async function createPayWaveNotif({ userId, pwType, title, body = "" }) {
  if (!userId || !pwType || !title) return;
  try {
    await supabase.from("notifications").insert({
      recipient_user_id: userId,
      actor_user_id:     userId,
      type:              "payment_confirmed",   // valid existing enum value
      message:           body ? `${title}\n${body}` : title,
      is_read:           false,
      metadata: {
        category: "paywave",
        pw_type:  pwType,
      },
    });
  } catch (err) {
    console.warn("[PayWave] notification insert failed:", err?.message);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 1) return `${m}m ago`;
  return "Just now";
}

// ── Icon badge ────────────────────────────────────────────────────────────────
const TypeBadge = memo(({ pwType }) => {
  const def = PW_NOTIF_TYPES[pwType] || { Icon: Bell, color: "#737373", bg: "rgba(255,255,255,0.08)" };
  const { Icon, color, bg } = def;
  return (
    <div style={{
      width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
      background: bg, border: `1.5px solid ${color}44`,
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: `0 2px 10px ${color}1a`,
    }}>
      <Icon size={17} color={color} strokeWidth={2.2} />
    </div>
  );
});
TypeBadge.displayName = "TypeBadge";

// ── Single notification card ──────────────────────────────────────────────────
const NotifCard = memo(({ notif, onRead }) => {
  const pwType = notif.metadata?.pw_type;
  const def    = PW_NOTIF_TYPES[pwType] || {};
  const lines  = (notif.message || "").split("\n");
  const title  = lines[0] || "PayWave Notification";
  const body   = lines.slice(1).join(" ").trim();
  const unread = !notif.is_read;

  const handleClick = useCallback(() => {
    if (unread) onRead(notif.id);
  }, [notif.id, unread, onRead]);

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === "Enter" && handleClick()}
      onMouseEnter={e => {
        e.currentTarget.style.background = unread ? "rgba(163,230,53,0.07)" : "rgba(255,255,255,0.038)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = unread ? "rgba(163,230,53,0.042)" : "rgba(255,255,255,0.018)";
      }}
      style={{
        position: "relative",
        display: "flex", alignItems: "flex-start", gap: 11,
        padding: "13px 14px 12px",
        borderRadius: 14, marginBottom: 6,
        background: unread ? "rgba(163,230,53,0.042)" : "rgba(255,255,255,0.018)",
        border: `1px solid ${unread ? "rgba(163,230,53,0.18)" : "rgba(255,255,255,0.055)"}`,
        cursor: "pointer", transition: "background .15s, border-color .15s",
        overflow: "hidden",
      }}
    >
      {/* Unread accent bar */}
      {unread && (
        <div style={{
          position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
          width: 3, height: "55%", minHeight: 20,
          background: "linear-gradient(180deg,#a3e635,#65a30d)",
          borderRadius: "0 3px 3px 0",
          boxShadow: "0 0 8px rgba(163,230,53,0.5)",
        }} />
      )}

      <TypeBadge pwType={pwType} />

      <div style={{ flex: 1, minWidth: 0, paddingLeft: unread ? 2 : 0 }}>
        {/* Title + dot */}
        <div style={{
          display: "flex", alignItems: "flex-start",
          justifyContent: "space-between", gap: 6, marginBottom: 3,
        }}>
          <div style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 13, lineHeight: 1.4,
            fontWeight: unread ? 700 : 500,
            color: unread ? "#fff" : "rgba(255,255,255,0.6)",
          }}>
            {title}
          </div>
          {unread && (
            <div style={{
              width: 7, height: 7, borderRadius: "50%", flexShrink: 0, marginTop: 4,
              background: "#a3e635", boxShadow: "0 0 6px rgba(163,230,53,0.7)",
            }} />
          )}
        </div>

        {/* Body */}
        {body && (
          <div style={{
            fontSize: 11.5, color: "rgba(255,255,255,0.38)",
            lineHeight: 1.55, marginBottom: 5, wordBreak: "break-word",
          }}>
            {body}
          </div>
        )}

        {/* Type pill + time */}
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          {def.label && (
            <span style={{
              padding: "2px 8px", borderRadius: 20, fontSize: 9.5, fontWeight: 700,
              background: def.bg || "rgba(255,255,255,0.06)",
              border: `1px solid ${(def.color || "#555")}33`,
              color: def.color || "#888",
            }}>
              {def.label}
            </span>
          )}
          <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.22)" }}>
            {timeAgo(notif.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
});
NotifCard.displayName = "NotifCard";

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonLoader() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7, padding: "6px 0" }}>
      {[1,2,3,4,5].map(i => (
        <div key={i} style={{
          height: 76, borderRadius: 14,
          background: "rgba(255,255,255,0.025)",
          animation: "pwShimmer 1.4s ease-in-out infinite",
          animationDelay: `${i * 0.07}s`,
        }} />
      ))}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ filter }) {
  const m = EMPTY[filter] || EMPTY.all;
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", padding: "56px 24px",
      textAlign: "center", gap: 10,
    }}>
      <div style={{ fontSize: 44, opacity: 0.12, filter: "grayscale(1)" }}>{m.emoji}</div>
      <div style={{
        fontFamily: "'DM Mono', monospace",
        fontSize: 13.5, fontWeight: 700,
        color: "rgba(255,255,255,0.28)",
      }}>
        {m.title}
      </div>
      <div style={{
        fontSize: 12, color: "rgba(255,255,255,0.18)",
        lineHeight: 1.65, maxWidth: 240,
      }}>
        {m.hint}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function NotificationsTab() {
  const { profile } = useAuth();
  const [notifs,     setNotifs]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [filter,     setFilter]     = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifs = useCallback(async (quiet = false) => {
    if (!profile?.id) return;
    if (!quiet) setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, message, is_read, created_at, metadata")
        .eq("recipient_user_id", profile.id)
        .contains("metadata", { category: "paywave" })
        .order("created_at", { ascending: false })
        .limit(100);
      if (!error) setNotifs(data || []);
    } catch { /* silent — table may not exist yet */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [profile?.id]);

  useEffect(() => { fetchNotifs(); }, [fetchNotifs]);

  // Real-time: new row lands instantly
  useEffect(() => {
    if (!profile?.id) return;
    const ch = supabase
      .channel(`pw-notifs:${profile.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "notifications",
        filter: `recipient_user_id=eq.${profile.id}`,
      }, payload => {
        if (payload.new?.metadata?.category === "paywave") {
          setNotifs(prev => [payload.new, ...prev]);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile?.id]);

  const markRead = useCallback(async id => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  }, []);

  const markAll = useCallback(async () => {
    const ids = notifs.filter(n => !n.is_read).map(n => n.id);
    if (!ids.length) return;
    await supabase.from("notifications").update({ is_read: true }).in("id", ids);
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
  }, [notifs]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifs(true);
  }, [fetchNotifs]);

  const unread = notifs.filter(n => !n.is_read).length;

  const tabCounts = Object.fromEntries(
    FILTER_TABS.map(t => [
      t.id,
      t.types
        ? notifs.filter(n => !n.is_read && t.types.includes(n.metadata?.pw_type)).length
        : unread,
    ])
  );

  const filtered = filter === "all"
    ? notifs
    : notifs.filter(n => (FILTER_TABS.find(t => t.id === filter)?.types || []).includes(n.metadata?.pw_type));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg, #0a0e06)" }}>

      {/* ── Header ── */}
      <div style={{
        padding: "0 14px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        flexShrink: 0,
      }}>
        <div style={{
          display: "flex", alignItems: "center",
          justifyContent: "space-between", height: 52,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Bell size={15} color="#a3e635" />
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 15, fontWeight: 800 }}>
              Notifications
            </span>
            {unread > 0 && (
              <span style={{
                padding: "2px 8px",
                background: "rgba(163,230,53,0.12)",
                border: "1px solid rgba(163,230,53,0.3)",
                borderRadius: 20, fontSize: 10, fontWeight: 700, color: "#a3e635",
              }}>
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {unread > 0 && (
              <button onClick={markAll} style={{
                display: "flex", alignItems: "center", gap: 4, padding: "5px 10px",
                background: "rgba(163,230,53,0.08)", border: "1px solid rgba(163,230,53,0.2)",
                borderRadius: 8, color: "#a3e635", fontSize: 11, fontWeight: 600, cursor: "pointer",
              }}>
                <CheckCheck size={12} /> All read
              </button>
            )}
            <button onClick={refresh} style={{
              width: 30, height: 30, borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.35)", cursor: "pointer",
            }}>
              <RefreshCw size={12} style={{ animation: refreshing ? "pwNotifSpin 0.7s linear infinite" : "none" }} />
            </button>
          </div>
        </div>

        {/* Filter tab strip */}
        <div style={{ display: "flex", gap: 5, paddingBottom: 10, overflowX: "auto", scrollbarWidth: "none" }}>
          {FILTER_TABS.map(tab => {
            const cnt = tabCounts[tab.id] || 0;
            const on  = filter === tab.id;
            return (
              <button key={tab.id} onClick={() => setFilter(tab.id)} style={{
                display: "flex", alignItems: "center", gap: 5,
                flexShrink: 0, padding: "5px 12px",
                borderRadius: 20, fontSize: 11.5, fontWeight: 600, cursor: "pointer",
                transition: "all .15s",
                background: on ? "rgba(163,230,53,0.12)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${on ? "rgba(163,230,53,0.35)" : "rgba(255,255,255,0.07)"}`,
                color: on ? "#a3e635" : "rgba(255,255,255,0.38)",
              }}>
                {tab.label}
                {cnt > 0 && (
                  <span style={{
                    padding: "1px 5px", borderRadius: 10, fontSize: 9, fontWeight: 700,
                    background: on ? "rgba(163,230,53,0.25)" : "rgba(255,255,255,0.09)",
                    color: on ? "#a3e635" : "rgba(255,255,255,0.35)",
                  }}>
                    {cnt}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── List ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px 24px", scrollbarWidth: "none" }}>
        {loading
          ? <SkeletonLoader />
          : filtered.length === 0
            ? <EmptyState filter={filter} />
            : filtered.map(n => <NotifCard key={n.id} notif={n} onRead={markRead} />)
        }
      </div>

      <style>{`
        @keyframes pwNotifSpin { to { transform: rotate(360deg); } }
        @keyframes pwShimmer { 0%,100% { opacity: 0.4; } 50% { opacity: 0.8; } }
      `}</style>
    </div>
  );
}