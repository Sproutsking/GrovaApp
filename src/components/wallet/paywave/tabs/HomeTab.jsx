// paywave/tabs/HomeTab.jsx
// ─────────────────────────────────────────────────────────────
// PURE ₦ NAIRA. No EP. No XEV.
//
// REDESIGN v2 — Premium fintech aesthetic:
//   • Sculptural balance hero card with animated glow and texture
//   • Lime accent strip + status indicators
//   • Premium quick-action grid with color-glowing icons
//   • Polished "free transfer" announcement bar
//   • Distinctive recent-activity section header
//   • Improved transaction row typography
// ─────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback } from "react";
import {
  Bell,
  Eye,
  EyeOff,
  Send,
  Download,
  Smartphone,
  Wifi,
  Tv,
  Zap,
  ChevronRight,
  ArrowLeft,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
} from "lucide-react";
import { supabase } from "../../../../services/config/supabase";
import { useAuth } from "../../../../components/Auth/AuthContext";

const fmtNGN = (n) =>
  Number(n || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const iconFor = (reason = "") => {
  const r = reason.toLowerCase();
  if (r.includes("airtime")) return Smartphone;
  if (r.includes("data")) return Wifi;
  if (r.includes("tv") || r.includes("cable")) return Tv;
  if (r.includes("electric")) return Zap;
  if (r.includes("received") || r.includes("credit")) return ArrowDownLeft;
  return ArrowUpRight;
};

// ── Keyframe CSS injected once ────────────────────────────────
const HOMETAB_CSS = `
  @keyframes ht-pulse {
    0%,100% { opacity: .6; transform: scale(1); }
    50%     { opacity: 1;  transform: scale(1.04); }
  }
  @keyframes ht-glow {
    0%,100% { box-shadow: 0 0 32px rgba(163,230,53,0.06), 0 24px 60px rgba(0,0,0,0.55); }
    50%     { box-shadow: 0 0 56px rgba(163,230,53,0.14), 0 24px 60px rgba(0,0,0,0.55); }
  }
  @keyframes ht-orb {
    0%,100% { transform: translateY(0) scale(1); }
    50%     { transform: translateY(-12px) scale(1.06); }
  }
  @keyframes ht-shimmer {
    0%   { left: -100%; }
    100% { left: 160%; }
  }
  @keyframes ht-fadein {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .ht-card-wrap { animation: ht-glow 4s ease-in-out infinite; }
  .ht-orb1 { animation: ht-orb 7s ease-in-out infinite; }
  .ht-orb2 { animation: ht-orb 9s ease-in-out 1.5s infinite reverse; }
  .ht-row  { animation: ht-fadein .3s ease both; }
  .ht-shimmer-line {
    position: absolute; top: 0; left: -100%; width: 55%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.035), transparent);
    transform: skewX(-18deg);
    animation: ht-shimmer 5s ease-in-out 2s infinite;
    pointer-events: none;
  }
`;

export default function HomeTab({
  pwBalance,
  showBalance,
  setShowBalance,
  notifications,
  setPage,
  onBack,
  onRefresh,
}) {
  const { profile } = useAuth();
  const [recentTxs, setRecentTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
    } catch {
      setUnreadCount((notifications || []).filter((n) => !n.read).length);
    }
  }, [profile?.id, notifications]);

  useEffect(() => {
    fetchUnread();
  }, [fetchUnread]);

  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel(`hw_unread:${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_user_id=eq.${profile.id}`,
        },
        () => {
          fetchUnread();
        },
      )
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

      setRecentTxs(
        (data || []).map((tx) => ({
          id: tx.id,
          type: tx.change_type,
          title:
            tx.reason ||
            (tx.change_type === "credit" ? "Received ₦" : "Sent ₦"),
          amount: Number(tx.amount),
          date: new Date(tx.created_at).toLocaleDateString("en-NG", {
            month: "short",
            day: "numeric",
          }),
        })),
      );
    } catch (err) {
      console.error("HomeTab recent tx:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchRecent();
  }, [fetchRecent]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchRecent();
    fetchUnread();
    onRefresh?.();
  };

  const displayName = profile?.full_name || profile?.username || "User";
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="pw-scroll-px">
      <style>{HOMETAB_CSS}</style>

      {/* ───────────────────────────────────────────────────────
          TOP BAR: [← Back]  [PayWave brand]  [refresh][bell]
      ─────────────────────────────────────────────────────── */}
      <div
        style={{
          paddingTop: 16,
          paddingBottom: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Back */}
        <button className="pw-back" onClick={onBack} title="Back">
          <ArrowLeft size={14} />
        </button>

        {/* Brand wordmark — centered */}
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 7,
                background: "linear-gradient(135deg, #a3e635, #65a30d)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 12px rgba(163,230,53,0.35)",
                flexShrink: 0,
              }}
            >
              <Zap size={12} color="#080e03" strokeWidth={2.5} />
            </div>
            <span
              style={{
                fontFamily: "var(--font-d)",
                fontSize: 17,
                fontWeight: 800,
                letterSpacing: "-0.03em",
                background:
                  "linear-gradient(135deg, #bef264 0%, #a3e635 50%, #65a30d 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              PayWave
            </span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <button
            className="ic-chip"
            onClick={handleRefresh}
            title="Refresh"
            style={{ opacity: refreshing ? 0.5 : 1 }}
          >
            <RefreshCw
              size={12}
              style={{
                animation: refreshing ? "pw-spin 0.8s linear infinite" : "none",
              }}
            />
          </button>
          <button className="ic-chip" onClick={() => setPage("notifications")}>
            <Bell size={13} />
            {unreadCount > 0 && (
              <div className="notif-pip">
                {unreadCount > 9 ? "9+" : unreadCount}
              </div>
            )}
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────
          BALANCE HERO CARD — sculptural premium design
      ─────────────────────────────────────────────────────── */}
      <div
        className="ht-card-wrap"
        style={{
          borderRadius: 22,
          marginBottom: 16,
          position: "relative",
          overflow: "hidden",
          /* Deep layered gradient — dark luxury */
          background:
            "linear-gradient(155deg, #0e1a0a 0%, #0b1309 40%, #070d05 100%)",
          border: "1px solid rgba(163,230,53,0.18)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
        }}
      >
        {/* Lime top accent strip */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background:
              "linear-gradient(90deg, transparent 0%, #84cc16 20%, #a3e635 50%, #65a30d 80%, transparent 100%)",
          }}
        />

        {/* Decorative background orbs */}
        <div
          className="ht-orb1"
          style={{
            position: "absolute",
            top: -50,
            right: -30,
            width: 200,
            height: 200,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(163,230,53,0.07) 0%, transparent 70%)",
            filter: "blur(30px)",
            pointerEvents: "none",
          }}
        />
        <div
          className="ht-orb2"
          style={{
            position: "absolute",
            bottom: -40,
            left: 10,
            width: 160,
            height: 160,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(212,168,71,0.06) 0%, transparent 70%)",
            filter: "blur(24px)",
            pointerEvents: "none",
          }}
        />

        {/* Subtle shimmer sweep */}
        <div className="ht-shimmer-line" />

        {/* Card content */}
        <div style={{ position: "relative", padding: "20px 20px 18px" }}>
          {/* Top row: label + eye toggle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Avatar chip */}
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  background: "linear-gradient(135deg, #a3e635, #65a30d)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--font-d)",
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#080e03",
                  flexShrink: 0,
                  boxShadow: "0 4px 12px rgba(163,230,53,0.3)",
                }}
              >
                {initials[0] || "U"}
              </div>
              <div>
                <div
                  style={{
                    fontSize: 10,
                    color: "rgba(163,230,53,0.6)",
                    fontFamily: "var(--font-d)",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  Naira Balance
                </div>
                <div
                  style={{
                    fontSize: 9.5,
                    color: "rgba(255,255,255,0.3)",
                    fontFamily: "var(--font-b)",
                    marginTop: 1,
                  }}
                >
                  {displayName}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Live indicator */}
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: "#a3e635",
                    boxShadow: "0 0 6px rgba(163,230,53,0.9)",
                    animation: "ht-pulse 2.5s ease-in-out infinite",
                  }}
                />
                <span
                  style={{
                    fontSize: 9,
                    color: "rgba(163,230,53,0.55)",
                    fontFamily: "var(--font-d)",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                  }}
                >
                  LIVE
                </span>
              </div>

              {/* Eye toggle */}
              <button
                onClick={() => setShowBalance(!showBalance)}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 7,
                  width: 28,
                  height: 28,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "rgba(255,255,255,0.4)",
                  transition: "all .15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(163,230,53,0.1)";
                  e.currentTarget.style.color = "#a3e635";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                  e.currentTarget.style.color = "rgba(255,255,255,0.4)";
                }}
              >
                {showBalance ? <Eye size={12} /> : <EyeOff size={12} />}
              </button>
            </div>
          </div>

          {/* Balance number */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontFamily: "var(--font-d)",
                fontSize: 42,
                fontWeight: 800,
                letterSpacing: "-0.05em",
                lineHeight: 1,
                color: showBalance ? "#ffffff" : "rgba(255,255,255,0)",
                textShadow: showBalance
                  ? "0 2px 16px rgba(255,255,255,0.08)"
                  : "none",
                WebkitTextStroke: showBalance
                  ? "0px"
                  : "2px rgba(255,255,255,0.12)",
                transition: "all .3s",
              }}
            >
              {showBalance ? `₦${fmtNGN(pwBalance)}` : "₦ ••••••"}
            </div>

            {/* Sub-labels row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginTop: 8,
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 9px",
                  borderRadius: 20,
                  background: "rgba(163,230,53,0.1)",
                  border: "1px solid rgba(163,230,53,0.2)",
                }}
              >
                <Zap size={9} color="#a3e635" />
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    color: "rgba(163,230,53,0.8)",
                    letterSpacing: "0.05em",
                    fontFamily: "var(--font-d)",
                  }}
                >
                  ZERO FEES
                </span>
              </div>
              <button
                onClick={() => setPage("transactions")}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "rgba(255,255,255,0.3)",
                  fontSize: 11,
                  fontFamily: "var(--font-b)",
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  padding: 0,
                  transition: "color .15s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = "rgba(163,230,53,0.7)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = "rgba(255,255,255,0.3)")
                }
              >
                View History <ChevronRight size={11} />
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              className="btn-lime"
              style={{
                flex: 1,
                padding: "11px 14px",
                fontSize: 13,
                fontWeight: 800,
              }}
              onClick={() => setPage("send")}
            >
              <Send size={13} /> Send ₦
            </button>
            <button
              onClick={() => setPage("receive")}
              style={{
                flex: 1,
                padding: "11px 14px",
                borderRadius: "var(--r-sm)",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "var(--text)",
                fontFamily: "var(--font-d)",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
                transition: "all .18s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
              }}
            >
              <Download size={13} /> Receive
            </button>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────
          FREE TRANSFER ANNOUNCEMENT STRIP
      ─────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          padding: "9px 13px",
          borderRadius: 12,
          background: "rgba(163,230,53,0.04)",
          border: "1px solid rgba(163,230,53,0.1)",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            flexShrink: 0,
            background: "rgba(163,230,53,0.12)",
            border: "1px solid rgba(163,230,53,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Zap size={12} color="#a3e635" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              fontSize: 11.5,
              color: "rgba(255,255,255,0.55)",
              fontFamily: "var(--font-b)",
              lineHeight: 1.5,
            }}
          >
            Send ₦ to any Xeevia user —{" "}
            <strong style={{ color: "var(--lime)" }}>completely free</strong>.
            Only OPay external sends carry a fee.
          </span>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────
          QUICK ACTIONS — premium glowing icon grid
      ─────────────────────────────────────────────────────── */}
      <div className="quick-grid">
        {[
          {
            icon: Smartphone,
            label: "Airtime",
            page: "airtime",
            grad: "linear-gradient(145deg,#9333ea,#6d28d9)",
            glow: "rgba(147,51,234,0.45)",
          },
          {
            icon: Wifi,
            label: "Data",
            page: "data",
            grad: "linear-gradient(145deg,#2563eb,#1d4ed8)",
            glow: "rgba(37,99,235,0.45)",
          },
          {
            icon: Tv,
            label: "TV",
            page: "tv",
            grad: "linear-gradient(145deg,#ea580c,#c2410c)",
            glow: "rgba(234,88,12,0.45)",
          },
          {
            icon: Zap,
            label: "Bills",
            page: "electricity",
            grad: "linear-gradient(145deg,#d4a847,#b45309)",
            glow: "rgba(212,168,71,0.45)",
          },
        ].map((item, i) => (
          <button
            key={i}
            className="quick-btn"
            onClick={() => setPage(item.page)}
          >
            <div
              className="quick-icon"
              style={{
                background: item.grad,
                width: 58,
                height: 58,
                boxShadow: `0 8px 24px ${item.glow}, 0 4px 8px rgba(0,0,0,0.36), inset 0 1px 0 rgba(255,255,255,0.15)`,
              }}
            >
              <item.icon size={24} color="#fff" strokeWidth={1.8} />
            </div>
            <span
              className="quick-label"
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                color: "rgba(255,255,255,0.55)",
              }}
            >
              {item.label}
            </span>
          </button>
        ))}
      </div>

      {/* ───────────────────────────────────────────────────────
          RECENT ACTIVITY — distinctive header + polished list
      ─────────────────────────────────────────────────────── */}
      <div
        style={{
          background: "rgba(255,255,255,0.018)",
          border: "1px solid rgba(255,255,255,0.058)",
          borderRadius: 18,
          overflow: "hidden",
          marginBottom: 8,
        }}
      >
        {/* Section header bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px 12px",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            {/* Accent pill */}
            <div
              style={{
                width: 4,
                height: 16,
                borderRadius: 2,
                background: "linear-gradient(180deg, #a3e635, #65a30d)",
                boxShadow: "0 0 8px rgba(163,230,53,0.5)",
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-d)",
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: "-0.01em",
                color: "var(--text)",
              }}
            >
              Recent Activity
            </span>
          </div>
          <button
            className="sec-link"
            style={{ display: "flex", alignItems: "center", gap: 3 }}
            onClick={() => setPage("transactions")}
          >
            View all <ChevronRight size={11} style={{ display: "inline" }} />
          </button>
        </div>

        {/* Content area */}
        <div style={{ padding: "10px 14px 14px" }}>
          {/* Loading skeletons */}
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    height: 58,
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.03)",
                    animation: "pw-shimmer 1.5s ease-in-out infinite",
                    animationDelay: `${i * 0.1}s`,
                  }}
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && recentTxs.length === 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                padding: "28px 0",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: "rgba(163,230,53,0.06)",
                  border: "1px solid rgba(163,230,53,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Wallet size={18} color="rgba(163,230,53,0.45)" />
              </div>
              <div>
                <div
                  style={{
                    fontFamily: "var(--font-d)",
                    fontWeight: 700,
                    fontSize: 13.5,
                    color: "rgba(255,255,255,0.35)",
                    marginBottom: 3,
                  }}
                >
                  No transactions yet
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: "rgba(255,255,255,0.2)",
                    lineHeight: 1.5,
                  }}
                >
                  Send or receive ₦ to see your activity here
                </div>
              </div>
            </div>
          )}

          {/* Transaction list */}
          {!loading && recentTxs.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {recentTxs.map((tx, idx) => {
                const Icon = iconFor(tx.title);
                const isCredit = tx.type === "credit";
                return (
                  <div
                    key={tx.id}
                    className="ht-row glass click"
                    style={{
                      padding: "11px 13px",
                      animationDelay: `${idx * 0.04}s`,
                    }}
                  >
                    <div className="tx-row">
                      <div className="tx-left">
                        <div className={`tx-icon ${isCredit ? "cr" : ""}`}>
                          <Icon
                            size={13}
                            color={
                              isCredit
                                ? "var(--lime)"
                                : "rgba(255,255,255,0.38)"
                            }
                            strokeWidth={2.2}
                          />
                        </div>
                        <div>
                          <div className="tx-title">{tx.title}</div>
                          <div className="tx-date">{tx.date}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div className={`tx-amt ${isCredit ? "cr" : ""}`}>
                          {isCredit ? "+" : "−"}₦{fmtNGN(tx.amount)}
                        </div>
                        <div className="tx-status">Completed</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom spacer */}
      <div style={{ height: 8 }} />
    </div>
  );
}
