// paywave/tabs/HomeTab.jsx
// ─────────────────────────────────────────────────────────────
// PURE ₦ NAIRA. No EP. No XEV. No token references whatsoever.
// PayWave balance = wallets.paywave_balance (Naira ledger).
// Recent activity = wallet_history filtered for PayWave events.
// ─────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback } from "react";
import {
  Bell, Eye, EyeOff, Send, Download, Smartphone,
  Wifi, Tv, Zap, ChevronRight, ArrowLeft, RefreshCw,
  ArrowUpRight, ArrowDownLeft,
} from "lucide-react";
import { supabase } from "../../../../services/config/supabase";
import { useAuth } from "../../../../components/Auth/AuthContext";

const fmtNGN = (n) =>
  Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const iconFor = (reason = "") => {
  const r = reason.toLowerCase();
  if (r.includes("airtime"))              return Smartphone;
  if (r.includes("data"))                return Wifi;
  if (r.includes("tv") || r.includes("cable")) return Tv;
  if (r.includes("electric"))            return Zap;
  if (r.includes("received") || r.includes("credit")) return ArrowDownLeft;
  return ArrowUpRight;
};

export default function HomeTab({
  pwBalance,
  showBalance, setShowBalance,
  notifications, setPage,
  onBack, onRefresh,
}) {
  const { profile } = useAuth();
  const [recentTxs,  setRecentTxs]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── REAL unread count — fetched from notifications table ──
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnread = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_user_id", profile.id)
        .eq("is_read", false)
        .contains("metadata", { category: "paywave" });
      setUnreadCount(count ?? 0);
    } catch (err) {
      // fallback — use prop-based count
      setUnreadCount((notifications || []).filter(n => !n.read).length);
    }
  }, [profile?.id, notifications]);

  useEffect(() => { fetchUnread(); }, [fetchUnread]);

  // Real-time unread updates
  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel(`hw_unread:${profile.id}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "notifications",
        filter: `recipient_user_id=eq.${profile.id}`,
      }, () => { fetchUnread(); })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [profile?.id, fetchUnread]);

  const fetchRecent = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { data } = await supabase
        .from("wallet_history")
        .select("id, change_type, reason, amount, created_at, wallet_type")
        .eq("user_id", profile.id)
        .in("wallet_type", ["paywave", "naira", null])
        .order("created_at", { ascending: false })
        .limit(5);

      setRecentTxs((data || []).map(tx => ({
        id:     tx.id,
        type:   tx.change_type,
        title:  tx.reason || (tx.change_type === "credit" ? "Received ₦" : "Sent ₦"),
        amount: Number(tx.amount),
        date:   new Date(tx.created_at).toLocaleDateString("en-NG", { month: "short", day: "numeric" }),
      })));
    } catch (err) {
      console.error("HomeTab recent tx:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id]);

  useEffect(() => { fetchRecent(); }, [fetchRecent]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchRecent();
    fetchUnread();
    onRefresh?.();
  };

  return (
    <div className="pw-scroll-px">
      {/* ── Top bar: [← Back]  PAYWAVE  [Refresh][Bell] ── */}
      <div style={{ paddingTop: 15, paddingBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>

        {/* Left — back button */}
        <button className="pw-back" onClick={onBack} title="Back" style={{ flexShrink: 0 }}>
          <ArrowLeft size={14} />
        </button>

        {/* Center — PayWave wordmark */}
        <div style={{ flex: 1, textAlign: "center" }}>
          <span style={{ fontFamily: "var(--font-d)", fontSize: 16, fontWeight: 800, letterSpacing: "-0.02em", background: "linear-gradient(135deg, #a3e635, #65a30d)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            PayWave
          </span>
        </div>

        {/* Right — refresh + notifications */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
          <button className="ic-chip" onClick={handleRefresh} title="Refresh" style={{ opacity: refreshing ? 0.5 : 1 }}>
            <RefreshCw size={12} style={{ animation: refreshing ? "pw-spin 0.8s linear infinite" : "none" }} />
          </button>
          <button className="ic-chip" onClick={() => setPage("notifications")}>
            <Bell size={13} />
            {unreadCount > 0 && <div className="notif-pip">{unreadCount > 9 ? "9+" : unreadCount}</div>}
          </button>
        </div>
      </div>

      {/* ── Naira Balance Card ── */}
      <div className="glass" style={{ padding: "20px 18px 16px", marginBottom: 12, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -60, right: -60, width: 180, height: 180, background: "radial-gradient(circle, rgba(163,230,53,0.07) 0%, transparent 70%)", borderRadius: "50%", filter: "blur(20px)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: 16, right: 20, width: 5, height: 5, borderRadius: "50%", background: "var(--gold)", boxShadow: "0 0 8px var(--gold)", opacity: 0.5 }} />
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: "var(--text-soft)", fontSize: 11, letterSpacing: "0.07em", textTransform: "uppercase", fontFamily: "var(--font-b)" }}>Naira Balance</span>
              <button style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-soft)", display: "flex", alignItems: "center", padding: 0 }} onClick={() => setShowBalance(!showBalance)}>
                {showBalance ? <Eye size={11} /> : <EyeOff size={11} />}
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 7px", background: "rgba(163,230,53,0.08)", border: "1px solid rgba(163,230,53,0.18)", borderRadius: 20, fontSize: 9.5, fontWeight: 700, color: "var(--lime)", letterSpacing: "0.04em" }}>
                ⚡ FREE P2P
              </div>
              <button className="sec-link" style={{ display: "flex", alignItems: "center", gap: 2 }} onClick={() => setPage("transactions")}>
                History <ChevronRight size={11} />
              </button>
            </div>
          </div>

          <div style={{ fontFamily: "var(--font-d)", fontSize: 40, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.04em", lineHeight: 1, margin: "6px 0 2px" }}>
            {showBalance ? `₦${fmtNGN(pwBalance)}` : "₦••••••"}
          </div>
          <div style={{ color: "var(--text-soft)", fontSize: 11, marginBottom: 16, fontFamily: "var(--font-b)" }}>
            Internal Naira · Zero-fee transfers
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-lime" style={{ flex: "1 1 0", minWidth: 0 }} onClick={() => setPage("send")}>
              <Send size={13} /> Send ₦
            </button>
            <button className="btn-ghost" style={{ flex: "1 1 0", minWidth: 0 }} onClick={() => setPage("receive")}>
              <Download size={13} /> Receive ₦
            </button>
          </div>
        </div>
      </div>

      {/* ── Free transfer notice ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, background: "rgba(163,230,53,0.04)", border: "1px solid rgba(163,230,53,0.1)", marginBottom: 14, fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-b)", lineHeight: 1.5 }}>
        <Zap size={11} color="var(--lime)" style={{ flexShrink: 0 }} />
        <span>Send ₦ to any Xeevia user — <strong style={{ color: "var(--lime)" }}>completely free</strong>. Only OPay external sends carry a fee.</span>
      </div>

      {/* ── Quick actions ── */}
      <div className="quick-grid">
        {[
          { icon: Smartphone, label: "Airtime",  page: "airtime",     cls: "g-purple" },
          { icon: Wifi,       label: "Data",     page: "data",        cls: "g-blue"   },
          { icon: Tv,         label: "TV",       page: "tv",          cls: "g-orange" },
          { icon: Zap,        label: "Bills",    page: "electricity", cls: "g-yellow" },
        ].map((item, i) => (
          <button key={i} className="quick-btn" onClick={() => setPage(item.page)}>
            <div className={`quick-icon ${item.cls}`}><item.icon size={20} color="#fff" /></div>
            <span className="quick-label">{item.label}</span>
          </button>
        ))}
      </div>

      {/* ── Fancy divider + Recent Activity header ── */}
      <div style={{ position: "relative", margin: "20px 0 0" }}>
        {/* Decorative line with gradient fade */}
        <div style={{
          position: "absolute", top: "50%", left: 0, right: 0,
          height: 1,
          background: "linear-gradient(90deg, transparent 0%, rgba(163,230,53,0.18) 20%, rgba(163,230,53,0.35) 50%, rgba(163,230,53,0.18) 80%, transparent 100%)",
          transform: "translateY(-50%)",
        }} />
        {/* Center diamond accent */}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          width: 6, height: 6,
          background: "rgba(163,230,53,0.5)",
          transform: "translate(-50%, -50%) rotate(45deg)",
          boxShadow: "0 0 8px rgba(163,230,53,0.3)",
        }} />
      </div>

      {/* ── Recent Activity section with distinct background ── */}
      <div style={{
        marginTop: 10,
        background: "rgba(163,230,53,0.025)",
        border: "1px solid rgba(163,230,53,0.09)",
        borderRadius: "var(--r-lg)",
        padding: "14px 14px 12px",
      }}>
        {/* Section header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{
              width: 5, height: 14, borderRadius: 3,
              background: "linear-gradient(180deg, #a3e635, #65a30d)",
              boxShadow: "0 2px 6px rgba(163,230,53,0.3)",
            }} />
            <span className="sec-title">Recent Activity</span>
          </div>
          <button className="sec-link" onClick={() => setPage("transactions")}>
            View all <ChevronRight size={11} style={{ display: "inline", verticalAlign: "middle" }} />
          </button>
        </div>

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1,2,3].map(i => <div key={i} style={{ height: 54, borderRadius: 12, background: "rgba(255,255,255,0.03)", animation: "pw-shimmer 1.4s ease-in-out infinite" }} />)}
        </div>
      )}

      {!loading && recentTxs.length === 0 && (
        <div style={{ textAlign: "center", padding: "28px 0", color: "var(--text-soft)", fontSize: 12, lineHeight: 1.7 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(163,230,53,0.06)", border: "1px solid rgba(163,230,53,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}>
            <Zap size={16} color="rgba(163,230,53,0.4)" />
          </div>
          <div style={{ fontWeight: 600, color: "rgba(255,255,255,0.35)" }}>No transactions yet</div>
          <div style={{ fontSize: 11, marginTop: 3 }}>Send or receive ₦ to get started</div>
        </div>
      )}

      {!loading && recentTxs.length > 0 && (
        <div className="space-y">
          {recentTxs.map(tx => {
            const Icon = iconFor(tx.title);
            const isCredit = tx.type === "credit";
            return (
              <div key={tx.id} className="glass" style={{ padding: "10px 13px" }}>
                <div className="tx-row">
                  <div className="tx-left">
                    <div className={`tx-icon ${isCredit ? "cr" : ""}`}>
                      <Icon size={13} color={isCredit ? "var(--lime)" : "rgba(255,255,255,0.35)"} />
                    </div>
                    <div>
                      <div className="tx-title">{tx.title}</div>
                      <div className="tx-date">{tx.date}</div>
                    </div>
                  </div>
                  <div className={`tx-amt ${isCredit ? "cr" : ""}`}>
                    {isCredit ? "+" : "−"}₦{fmtNGN(tx.amount)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      </div>{/* end activity section */}

      <div style={{ height: 16 }} />
      <style>{`
        @keyframes pw-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes pw-shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
      `}</style>
    </div>
  );
}