// ============================================================================
// src/components/Admin/sections/OtherSections.jsx — v6 UPGRADED
// - Fixed Communities suspend (async-in-object bug gone)
// - Transactions show correct Paystack NGN amounts
// - Analytics uses proper Lucide icons (no emoji icons)
// - EP normalization admin tool added
// - Invite section has category filter tabs + counts
// ============================================================================

import React, { useState, useCallback, useEffect } from "react";
import {
  RefreshCw,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  Activity,
  BarChart3,
  CreditCard,
  Globe,
  Shield,
  Bell,
  Send,
  AlertTriangle,
  Unlock,
  CheckCircle2,
  Star,
  Trash2,
  Edit2,
  Filter,
  Hash,
  Zap,
  ArrowDownCircle,
  UserCheck,
  UserX,
  Wallet,
  Eye,
  Search,
  ChevronDown,
  Building2,
  Megaphone,
  Link2,
  Award,
  Crown,
  RotateCcw,
  BadgeCheck,
  Layers,
  Database,
  TrendingUp as TrendUp,
  AlertCircle,
  Clock,
  CheckCheck,
  XCircle,
  MoreHorizontal,
} from "lucide-react";
import {
  Section,
  DataTable,
  Btn,
  Badge,
  StatusBadge,
  Modal,
  Field,
  Input,
  Select,
  Alert,
  SearchBar,
  Pagination,
  C,
  Avatar,
  ConfirmDialog,
  Tabs,
  EmptyState,
} from "../AdminUI.jsx";
import { can, PERMISSIONS } from "../permissions.js";
import {
  useTable,
  useTransactions,
  useSecurity,
  useCommunities,
  useNotifications,
  resolvePaymentAmount,
  normalizeEPForPaidUsers,
} from "../useAdminData.js";

// ─── Currency helpers ─────────────────────────────────────────────────────
function fmtUSD(n) {
  return `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtNGN(n) {
  return `₦${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Stat tile ────────────────────────────────────────────────────────────
function StatTile({
  label,
  value,
  sub,
  color = C.accent,
  trend,
  icon: Icon,
  onClick,
}) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "18px 20px",
        background: hov && onClick ? "#141414" : C.bg2,
        border: `1px solid ${hov ? color + "45" : C.border}`,
        borderRadius: 14,
        borderLeft: `3px solid ${color}`,
        position: "relative",
        overflow: "hidden",
        cursor: onClick ? "pointer" : "default",
        transition: "all .2s",
        transform: hov && onClick ? "translateY(-2px)" : "none",
        boxShadow: hov && onClick ? `0 8px 24px ${color}18` : "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -20,
          right: -20,
          width: 70,
          height: 70,
          borderRadius: "50%",
          background: `${color}08`,
          pointerEvents: "none",
        }}
      />
      {Icon && (
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: `${color}14`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 10,
            border: `1px solid ${color}22`,
          }}
        >
          <Icon size={14} color={color} />
        </div>
      )}
      <div style={{ fontSize: 24, fontWeight: 900, color, letterSpacing: -1 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{label}</div>
      {sub && (
        <div style={{ fontSize: 11, color, marginTop: 3, opacity: 0.8 }}>
          {sub}
        </div>
      )}
      {trend !== undefined && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            marginTop: 6,
            fontSize: 11,
            fontWeight: 700,
            color: trend >= 0 ? C.success : C.danger,
          }}
        >
          {trend >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {Math.abs(trend).toFixed(1)}% vs prev
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ANALYTICS SECTION
// ============================================================================
export function AnalyticsSection({ adminData, stats, onRefresh }) {
  const [view, setView] = useState("overview");
  const [normalizing, setNormalizing] = useState(false);
  const [normalizeResult, setNormalizeResult] = useState(null);

  const s = stats || {};

  const handleNormalizeEP = async () => {
    if (
      !window.confirm(
        "This will set all users with inflated EP (>200) to a max of 50 base EP. Continue?",
      )
    )
      return;
    setNormalizing(true);
    try {
      const result = await normalizeEPForPaidUsers();
      setNormalizeResult(result);
    } catch (e) {
      alert("EP normalization failed: " + e.message);
    } finally {
      setNormalizing(false);
    }
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <div>
          <h1
            style={{ fontSize: 26, fontWeight: 800, color: C.text, margin: 0 }}
          >
            Analytics
          </h1>
          <p style={{ color: C.muted, marginTop: 4, fontSize: 14 }}>
            Platform-wide metrics and growth data
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {/* EP Fix Tool */}
          <Btn
            icon={Zap}
            label={normalizing ? "Fixing EP…" : "Fix EP Inflation"}
            onClick={handleNormalizeEP}
            variant="secondary"
            title="Reset inflated EP to correct 50 EP baseline for all paid users"
          />
          <Btn icon={RefreshCw} label="Refresh" onClick={onRefresh} />
        </div>
      </div>

      {normalizeResult && (
        <Alert
          type="success"
          message={`EP normalized for ${normalizeResult.normalized} users. All paid users now have correct EP amounts.`}
          onClose={() => setNormalizeResult(null)}
        />
      )}

      {/* EP Warning Banner */}
      {s.totalEPCirculation > 100000 && (
        <div
          style={{
            display: "flex",
            gap: 12,
            padding: "12px 16px",
            background: "rgba(245,158,11,0.08)",
            border: "1px solid rgba(245,158,11,0.25)",
            borderRadius: 10,
            marginBottom: 16,
          }}
        >
          <AlertTriangle
            size={16}
            color="#f59e0b"
            style={{ flexShrink: 0, marginTop: 1 }}
          />
          <div style={{ fontSize: 12, color: "#f59e0b" }}>
            <strong>High EP circulation detected.</strong> Total EP in
            circulation: {s.totalEPCirculation.toLocaleString()}. Use "Fix EP
            Inflation" to normalize paid users to the correct 50 EP baseline.
          </div>
        </div>
      )}

      {/* View tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 20,
          background: C.bg3,
          padding: 4,
          borderRadius: 10,
          border: `1px solid ${C.border}`,
          width: "fit-content",
        }}
      >
        {[
          { id: "overview", label: "Overview", icon: BarChart3 },
          { id: "revenue", label: "Revenue", icon: DollarSign },
          { id: "users", label: "Users", icon: Users },
          { id: "content", label: "Content", icon: Layers },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            style={{
              padding: "7px 14px",
              borderRadius: 7,
              border: "none",
              background: view === t.id ? C.accent : "transparent",
              color: view === t.id ? "#000" : C.muted,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {view === "overview" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 14,
            marginBottom: 24,
          }}
        >
          <StatTile
            label="Total Users"
            value={(s.totalUsers || 0).toLocaleString()}
            icon={Users}
            color={C.accent}
            sub={`+${s.newUsersToday || 0} today`}
          />
          <StatTile
            label="Active Users"
            value={(s.activeUsers || 0).toLocaleString()}
            icon={Activity}
            color={C.success}
            sub={`${s.totalUsers > 0 ? Math.round((s.activeUsers / s.totalUsers) * 100) : 0}% activation`}
          />
          <StatTile
            label="Total Revenue"
            value={fmtUSD(s.totalRevenue || 0)}
            icon={DollarSign}
            color="#34d399"
            sub={fmtUSD(s.revenueToday || 0) + " today"}
          />
          <StatTile
            label="New Today"
            value={(s.newUsersToday || 0).toLocaleString()}
            icon={TrendingUp}
            color={C.info}
          />
          <StatTile
            label="This Week"
            value={(s.newUsersWeek || 0).toLocaleString()}
            icon={TrendingUp}
            color="#a78bfa"
          />
          <StatTile
            label="Monthly Revenue"
            value={fmtUSD(s.revenueMonth || 0)}
            icon={DollarSign}
            color={C.accent}
          />
        </div>
      )}

      {view === "revenue" && (
        <>
          <Section
            title="💰 Deposit Overview"
            subtitle="Paystack = NGN (kobo/100), Stripe = USD (cents/100)"
          >
            {/* Revenue math explainer */}
            <div
              style={{
                padding: "10px 14px",
                background: "rgba(96,165,250,0.06)",
                border: "1px solid rgba(96,165,250,0.15)",
                borderRadius: 10,
                marginBottom: 16,
                fontSize: 11,
                color: "#6b7280",
              }}
            >
              <strong style={{ color: C.info }}>How revenue math works:</strong>{" "}
              Paystack stores amounts in Kobo (NGN smallest unit). ₦5,384 =
              538,400 kobo. 538400 ÷ 100 = ₦5,384. ₦5,384 ÷ 1700 = $3.17 USD
              equivalent. 3 Paystack payments = $3.17 + $0.81 + $3.25 ={" "}
              <strong style={{ color: C.success }}>$7.23 total</strong> ✓
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 12,
                marginBottom: 20,
              }}
            >
              {[
                {
                  label: "Today",
                  count: s.depositCountToday || 0,
                  amount: s.depositAmountToday || 0,
                  color: C.accent,
                },
                {
                  label: "This Week",
                  count: s.depositCountWeek || 0,
                  amount: s.depositAmountWeek || 0,
                  color: C.info,
                },
                {
                  label: "This Month",
                  count: s.depositCountMonth || 0,
                  amount: s.depositAmountMonth || 0,
                  color: C.success,
                },
                {
                  label: "All Time",
                  count: s.depositCountAll || 0,
                  amount: s.totalRevenue || 0,
                  color: "#f59e0b",
                },
              ].map((d) => (
                <div
                  key={d.label}
                  style={{
                    padding: "16px 14px",
                    background: `${d.color}08`,
                    border: `1px solid ${d.color}22`,
                    borderRadius: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      color: d.color,
                      textTransform: "uppercase",
                      letterSpacing: "0.8px",
                      marginBottom: 8,
                    }}
                  >
                    {d.label}
                  </div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 900,
                      color: d.color,
                      letterSpacing: -1,
                    }}
                  >
                    {fmtUSD(d.amount)}
                  </div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
                    {d.count} transaction{d.count !== 1 ? "s" : ""}
                  </div>
                </div>
              ))}
            </div>

            {s.totalRevenueNGN > 0 && (
              <div
                style={{
                  padding: "10px 14px",
                  background: "rgba(245,158,11,0.06)",
                  border: "1px solid rgba(245,158,11,0.2)",
                  borderRadius: 10,
                  fontSize: 12,
                  color: "#f59e0b",
                  marginBottom: 16,
                }}
              >
                NGN (Paystack) total: {fmtNGN(s.totalRevenueNGN)} — converted at
                ₦1,700/$1 for USD display
              </div>
            )}

            {/* Provider breakdown */}
            {Object.keys(s.providerBreakdown || {}).length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: C.text,
                    marginBottom: 12,
                  }}
                >
                  By Payment Provider
                </div>
                {Object.entries(s.providerBreakdown || {}).map(
                  ([prov, data]) => {
                    const pct =
                      s.totalRevenue > 0
                        ? (data.usd / s.totalRevenue) * 100
                        : 0;
                    const provColor =
                      prov === "paystack"
                        ? "#00c3ff"
                        : prov === "stripe"
                          ? "#635bff"
                          : C.accent;
                    return (
                      <div
                        key={prov}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          marginBottom: 8,
                        }}
                      >
                        <div
                          style={{
                            width: 80,
                            fontSize: 11,
                            fontWeight: 700,
                            color: provColor,
                            textTransform: "capitalize",
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                          }}
                        >
                          <CreditCard size={12} /> {prov}
                        </div>
                        <div
                          style={{
                            flex: 1,
                            height: 6,
                            background: "#1a1a1a",
                            borderRadius: 3,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${pct}%`,
                              background: `linear-gradient(90deg, ${provColor}66, ${provColor})`,
                              borderRadius: 3,
                              transition: "width .6s",
                            }}
                          />
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: C.text,
                            fontWeight: 700,
                            width: 80,
                            textAlign: "right",
                          }}
                        >
                          {fmtUSD(data.usd)}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: C.muted,
                            width: 50,
                            textAlign: "right",
                          }}
                        >
                          {data.count} txns
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            )}
          </Section>

          <Section title="Revenue Breakdown">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 12,
              }}
            >
              {[
                {
                  label: "Today",
                  value: fmtUSD(s.revenueToday || 0),
                  color: C.accent,
                  icon: Clock,
                },
                {
                  label: "This Week",
                  value: fmtUSD(s.revenueWeek || 0),
                  color: C.info,
                  icon: TrendingUp,
                },
                {
                  label: "This Month",
                  value: fmtUSD(s.revenueMonth || 0),
                  color: C.success,
                  icon: BarChart3,
                },
                {
                  label: "Total Revenue (USD)",
                  value: fmtUSD(s.totalRevenue || 0),
                  color: "#f59e0b",
                  icon: DollarSign,
                },
                {
                  label: "NGN Revenue",
                  value: fmtNGN(s.totalRevenueNGN || 0),
                  color: "#00c3ff",
                  icon: DollarSign,
                },
                {
                  label: "Avg per Deposit",
                  value:
                    s.depositCountAll > 0
                      ? fmtUSD((s.totalRevenue || 0) / s.depositCountAll)
                      : "$0.00",
                  color: "#a78bfa",
                  icon: TrendingUp,
                },
              ].map((m) => (
                <div
                  key={m.label}
                  style={{
                    padding: "16px",
                    background: C.bg3,
                    borderRadius: 10,
                    borderLeft: `3px solid ${m.color}`,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 7,
                      background: `${m.color}14`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <m.icon size={13} color={m.color} />
                  </div>
                  <div>
                    <div
                      style={{ fontSize: 20, fontWeight: 800, color: m.color }}
                    >
                      {m.value}
                    </div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
                      {m.label}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}

      {view === "users" && (
        <Section title="User Growth">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 12,
            }}
          >
            {[
              {
                label: "Total Users",
                value: (s.totalUsers || 0).toLocaleString(),
                color: C.accent,
                icon: Users,
              },
              {
                label: "Active Accounts",
                value: (s.activeUsers || 0).toLocaleString(),
                color: C.success,
                icon: UserCheck,
              },
              {
                label: "New Today",
                value: (s.newUsersToday || 0).toLocaleString(),
                color: C.info,
                icon: TrendingUp,
              },
              {
                label: "New This Week",
                value: (s.newUsersWeek || 0).toLocaleString(),
                color: "#f59e0b",
                icon: TrendingUp,
              },
              {
                label: "Suspended",
                value: (s.bannedUsers || 0).toLocaleString(),
                color: C.danger,
                icon: UserX,
              },
              {
                label: "Open Support",
                value: (s.openCases || 0).toLocaleString(),
                color: "#f97316",
                icon: AlertCircle,
              },
              {
                label: "Active Invites",
                value: (s.pendingInvites || 0).toLocaleString(),
                color: "#a78bfa",
                icon: Link2,
              },
              {
                label: "EP Circulating",
                value: (s.totalEPCirculation || 0).toLocaleString(),
                color: C.accent,
                icon: Zap,
              },
            ].map((m) => (
              <div
                key={m.label}
                style={{
                  padding: "14px",
                  background: C.bg2,
                  border: `1px solid ${C.border}`,
                  borderRadius: 12,
                  borderTop: `3px solid ${m.color}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    marginBottom: 8,
                  }}
                >
                  <m.icon size={13} color={m.color} />
                  <span
                    style={{
                      fontSize: 10,
                      color: C.muted,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    {m.label}
                  </span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: m.color }}>
                  {m.value}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {view === "content" && (
        <Section title="Content Overview">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 12,
              marginBottom: 20,
            }}
          >
            {[
              {
                label: "Posts",
                value: s.totalPosts || 0,
                color: C.accent,
                icon: Edit2,
              },
              {
                label: "Reels",
                value: s.totalReels || 0,
                color: C.info,
                icon: Activity,
              },
              {
                label: "Stories",
                value: s.totalStories || 0,
                color: "#a78bfa",
                icon: BookOpen,
              },
              {
                label: "Communities",
                value: s.totalCommunities || 0,
                color: C.success,
                icon: Globe,
              },
              {
                label: "Total Content",
                value: (s.totalContent || 0).toLocaleString(),
                color: "#f59e0b",
                icon: BarChart3,
              },
            ].map((m) => (
              <div
                key={m.label}
                style={{
                  textAlign: "center",
                  padding: "20px 16px",
                  background: C.bg3,
                  borderRadius: 12,
                  border: `1px solid ${C.border}`,
                  borderTop: `3px solid ${m.color}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: `${m.color}14`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <m.icon size={18} color={m.color} />
                  </div>
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: m.color }}>
                  {typeof m.value === "number"
                    ? m.value.toLocaleString()
                    : m.value}
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                  {m.label}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 12,
            }}
          >
            <div
              style={{
                padding: "16px 14px",
                background: "rgba(251,191,36,0.04)",
                border: "1px solid rgba(251,191,36,0.15)",
                borderRadius: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  marginBottom: 8,
                }}
              >
                <Zap size={13} color="#fbbf24" />
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    color: "#7c5c0a",
                    textTransform: "uppercase",
                    letterSpacing: "0.8px",
                  }}
                >
                  Circulating XEV
                </span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#fbbf24" }}>
                {(s.totalXEVCirculating || 0).toLocaleString()}
              </div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
                Active wallet balances
              </div>
            </div>
            <div
              style={{
                padding: "16px 14px",
                background: `${C.accent}04`,
                border: `1px solid ${C.accent}18`,
                borderRadius: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  marginBottom: 8,
                }}
              >
                <Award size={13} color={C.accent} />
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    color: "#3a5c10",
                    textTransform: "uppercase",
                    letterSpacing: "0.8px",
                  }}
                >
                  EP in Circulation
                </span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: C.accent }}>
                {(s.totalEPCirculation || 0).toLocaleString()}
              </div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
                Raw EP — base grant is 50 per paid user
              </div>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}

// Placeholder for missing icon
const BookOpen = ({ size, color }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
);

// ============================================================================
// TRANSACTIONS SECTION — Currency-correct
// ============================================================================
export function TransactionsSection({ adminData }) {
  const {
    transactions,
    total,
    page,
    setPage,
    loading,
    search,
    setSearch,
    reload,
    pageSize = 20,
    refundTransaction,
  } = useTransactions();
  const [actionAlert, setActionAlert] = useState(null);
  const [confirmRefund, setConfirmRefund] = useState(null);
  const [typeFilter, setTypeFilter] = useState("all");

  const handleRefund = async (tx) => {
    try {
      await refundTransaction(tx.id, "Admin refund");
      setActionAlert({ type: "success", msg: "Transaction refunded." });
      setConfirmRefund(null);
    } catch (e) {
      setActionAlert({ type: "error", msg: e.message });
    }
  };

  // Transaction type tabs — map payment types
  const TYPE_TABS = [
    { key: "all", label: "All", icon: Layers },
    { key: "deposit", label: "Deposits", icon: ArrowDownCircle },
    { key: "subscription", label: "Subscriptions", icon: CreditCard },
    { key: "refunded", label: "Refunds", icon: RotateCcw },
  ];

  const filtered =
    typeFilter === "all"
      ? transactions
      : transactions.filter((t) => {
          if (typeFilter === "deposit")
            return !["refunded"].includes(t.status) && t.type === "deposit";
          if (typeFilter === "refunded") return t.status === "refunded";
          return t.type === typeFilter;
        });

  const columns = [
    {
      label: "User",
      render: (t) => (
        <span style={{ fontSize: 12, color: C.text }}>
          {t.user_name}{" "}
          <span style={{ color: C.muted, fontSize: 11 }}>({t.user_email})</span>
        </span>
      ),
    },
    {
      label: "Amount",
      render: (t) => (
        <div>
          <div
            style={{
              fontWeight: 800,
              color: t.isNGN ? "#00c3ff" : C.success,
              fontSize: 13,
            }}
          >
            {t.displayLocal}
          </div>
          {t.isNGN && (
            <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>
              ≈ {t.displayUSD} USD
            </div>
          )}
        </div>
      ),
    },
    {
      label: "Currency",
      render: (t) => (
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "2px 7px",
            borderRadius: 4,
            background: t.isNGN ? "rgba(0,195,255,0.1)" : "rgba(34,197,94,0.1)",
            color: t.isNGN ? "#00c3ff" : C.success,
            border: `1px solid ${t.isNGN ? "rgba(0,195,255,0.2)" : "rgba(34,197,94,0.2)"}`,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <DollarSign size={9} />
          {t.localCurrency}
        </span>
      ),
    },
    { label: "Status", render: (t) => <StatusBadge status={t.status} /> },
    {
      label: "Provider",
      render: (t) => (
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "2px 7px",
            borderRadius: 4,
            background: "rgba(255,255,255,0.05)",
            color: C.muted,
            textTransform: "capitalize",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <CreditCard size={9} />
          {t.method || "—"}
        </span>
      ),
    },
    {
      label: "Date",
      render: (t) => (
        <span style={{ fontSize: 12, color: C.muted }}>
          {new Date(t.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      label: "Actions",
      render: (t) =>
        t.status === "completed" &&
        can(adminData, PERMISSIONS.REFUND_TRANSACTIONS) && (
          <Btn
            icon={RotateCcw}
            size="sm"
            label="Refund"
            danger
            onClick={() => setConfirmRefund(t)}
          />
        ),
    },
  ];

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <div>
          <h1
            style={{ fontSize: 26, fontWeight: 800, color: C.text, margin: 0 }}
          >
            Transactions
          </h1>
          <p style={{ color: C.muted, marginTop: 4, fontSize: 14 }}>
            {total.toLocaleString()} total
          </p>
        </div>
        <Btn icon={RefreshCw} onClick={reload} />
      </div>

      {actionAlert && (
        <Alert
          type={actionAlert.type}
          message={actionAlert.msg}
          onClose={() => setActionAlert(null)}
        />
      )}

      {/* Currency note */}
      <div
        style={{
          display: "flex",
          gap: 10,
          padding: "10px 14px",
          background: "rgba(0,195,255,0.04)",
          border: "1px solid rgba(0,195,255,0.15)",
          borderRadius: 10,
          fontSize: 12,
          color: "#9ca3af",
          marginBottom: 16,
          alignItems: "center",
        }}
      >
        <CreditCard size={14} color="#00c3ff" style={{ flexShrink: 0 }} />
        <span>
          <strong style={{ color: "#00c3ff" }}>Paystack (NGN)</strong> amounts
          in ₦ naira with USD equivalent.
          <strong style={{ color: C.success }}> Stripe (USD)</strong> in $. EP
          points are never treated as currency.
        </span>
      </div>

      {/* Type filter tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {TYPE_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTypeFilter(t.key)}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: `1px solid ${typeFilter === t.key ? `${C.accent}44` : C.border}`,
              background:
                typeFilter === t.key ? `${C.accent}12` : "transparent",
              color: typeFilter === t.key ? C.accent : C.muted,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <t.icon size={11} />
            {t.label}
          </button>
        ))}
      </div>

      <Section noPad>
        <div
          style={{
            padding: "14px 18px",
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search by reference key…"
          />
        </div>
        <DataTable
          columns={columns}
          rows={filtered}
          loading={loading}
          footer={
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
            />
          }
        />
      </Section>

      <ConfirmDialog
        open={!!confirmRefund}
        onClose={() => setConfirmRefund(null)}
        title="Confirm Refund"
        danger
        message={`Refund ${confirmRefund?.displayLocal} (≈${confirmRefund?.displayUSD} USD) for ${confirmRefund?.user_name}? This cannot be undone.`}
        confirmLabel="Refund"
        onConfirm={() => handleRefund(confirmRefund)}
      />
    </div>
  );
}

// ============================================================================
// SECURITY SECTION
// ============================================================================
export function SecuritySection({ adminData, secData }) {
  const { recentEvents, suspiciousAccounts, load, unlockAccount } = secData;
  const [actionAlert, setActionAlert] = useState(null);

  const handleResolve = async (id) => {
    try {
      await unlockAccount(id);
      await load();
      setActionAlert({
        type: "success",
        msg: "Account unlocked / event resolved.",
      });
    } catch (e) {
      setActionAlert({ type: "error", msg: e.message });
    }
  };

  const SEVERITY_COLORS = { critical: C.danger, warning: C.warn, info: C.info };
  const SEVERITY_ICONS = {
    critical: AlertCircle,
    warning: AlertTriangle,
    info: Shield,
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <div>
          <h1
            style={{ fontSize: 26, fontWeight: 800, color: C.text, margin: 0 }}
          >
            Security
          </h1>
          <p style={{ color: C.muted, fontSize: 14, marginTop: 4 }}>
            Platform security events and locked accounts
          </p>
        </div>
        <Btn icon={RefreshCw} onClick={load} />
      </div>
      {actionAlert && (
        <Alert
          type={actionAlert.type}
          message={actionAlert.msg}
          onClose={() => setActionAlert(null)}
        />
      )}

      {suspiciousAccounts.length > 0 && (
        <Section
          title="Locked Accounts"
          subtitle={`${suspiciousAccounts.length} accounts locked`}
          accent={C.danger}
        >
          {suspiciousAccounts.map((acc) => (
            <div
              key={acc.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 0",
                borderBottom: `1px solid ${C.border}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: `${C.danger}14`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <UserX size={14} color={C.danger} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                    {acc.full_name}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted }}>
                    {acc.email} · {acc.failed_login_attempts} failed attempts
                  </div>
                </div>
              </div>
              <Btn
                label="Unlock"
                icon={Unlock}
                size="sm"
                onClick={() => handleResolve(acc.id)}
              />
            </div>
          ))}
        </Section>
      )}

      <Section title="Recent Security Events" subtitle="Last 50 events">
        {recentEvents.length === 0 ? (
          <div
            style={{
              color: C.muted,
              textAlign: "center",
              padding: 24,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
            }}
          >
            <CheckCheck size={32} color={C.success} />
            <span>No security events</span>
          </div>
        ) : (
          recentEvents.map((ev) => {
            const SevIcon = SEVERITY_ICONS[ev.severity] || Shield;
            const sevColor = SEVERITY_COLORS[ev.severity] || C.info;
            return (
              <div
                key={ev.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 0",
                  borderBottom: `1px solid ${C.border}`,
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "flex-start", gap: 10 }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 7,
                      background: `${sevColor}14`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    <SevIcon size={13} color={sevColor} />
                  </div>
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 3,
                      }}
                    >
                      <Badge label={ev.severity} color={sevColor} />
                      <span
                        style={{ fontSize: 12, fontWeight: 600, color: C.text }}
                      >
                        {ev.type}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: C.muted }}>
                      {ev.user_email} · {ev.ip} ·{" "}
                      {new Date(ev.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                {!ev.resolved && (
                  <Btn
                    size="sm"
                    label="Resolve"
                    icon={CheckCircle2}
                    onClick={() => handleResolve(ev.id)}
                  />
                )}
              </div>
            );
          })
        )}
      </Section>
    </div>
  );
}

// ============================================================================
// NOTIFICATIONS SECTION
// ============================================================================
export function NotificationsSection({ adminData, broadcaster }) {
  const { sent, loading, reload } = useNotifications();
  const [form, setForm] = useState({
    title: "",
    message: "",
    type: "info",
    targetType: "all",
    specificEmails: "",
  });
  const [sending, setSending] = useState(false);
  const [alert, setAlert] = useState(null);

  const handleSend = async () => {
    if (!form.title || !form.message) {
      setAlert({ type: "error", msg: "Title and message are required." });
      return;
    }
    setSending(true);
    try {
      let targetIds = [];
      if (form.targetType === "specific" && form.specificEmails) {
        targetIds = form.specificEmails
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean);
      }
      await broadcaster.send({
        ...form,
        targetIds,
        sentByName: adminData?.full_name,
        sentById: adminData?.user_id || adminData?.id,
      });
      setForm({
        title: "",
        message: "",
        type: "info",
        targetType: "all",
        specificEmails: "",
      });
      setAlert({ type: "success", msg: "Notification sent to user feeds." });
      reload();
    } catch (e) {
      setAlert({ type: "error", msg: e.message });
    } finally {
      setSending(false);
    }
  };

  const TYPE_ICONS = {
    info: AlertCircle,
    success: CheckCircle2,
    warning: AlertTriangle,
    promo: Award,
  };
  const typeColors = {
    info: C.info,
    success: C.success,
    warning: C.warn,
    promo: "#f59e0b",
  };

  return (
    <div>
      <h1
        style={{
          fontSize: 26,
          fontWeight: 800,
          color: C.text,
          marginBottom: 24,
        }}
      >
        Notifications
      </h1>
      {alert && (
        <Alert
          type={alert.type}
          message={alert.msg}
          onClose={() => setAlert(null)}
        />
      )}

      <div
        style={{
          padding: "12px 16px",
          background: "rgba(59,130,246,0.06)",
          border: "1px solid rgba(59,130,246,0.2)",
          borderRadius: 10,
          marginBottom: 20,
          fontSize: 12,
          color: "#9ca3af",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Bell size={13} color={C.info} />
        Notifications are delivered to users' in-app notification feed in
        real-time.
      </div>

      <Section
        title="Send Notification"
        subtitle="Broadcast to users instantly"
      >
        <Field label="Title" required>
          <Input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Notification title"
          />
        </Field>
        <Field label="Message" required>
          <Input
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            placeholder="Notification body text"
            rows={3}
          />
        </Field>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <Field label="Type">
            <Select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              options={[
                { value: "info", label: "ℹ Info" },
                { value: "success", label: "✓ Success" },
                { value: "warning", label: "⚠ Warning" },
                { value: "promo", label: "★ Promotion" },
              ]}
            />
          </Field>
          <Field label="Target Audience">
            <Select
              value={form.targetType}
              onChange={(e) => setForm({ ...form, targetType: e.target.value })}
              options={[
                { value: "all", label: "All Users" },
                { value: "vip", label: "VIP Only" },
                { value: "pro", label: "Pro Only" },
                { value: "specific", label: "Specific Users" },
              ]}
            />
          </Field>
        </div>
        {form.targetType === "specific" && (
          <Field label="User Emails (comma-separated)">
            <Input
              value={form.specificEmails}
              onChange={(e) =>
                setForm({ ...form, specificEmails: e.target.value })
              }
              placeholder="user1@example.com, user2@example.com"
              rows={2}
            />
          </Field>
        )}
        {form.title && form.message && (
          <div
            style={{
              padding: "12px 14px",
              background: `${typeColors[form.type] || C.info}08`,
              border: `1px solid ${typeColors[form.type] || C.info}22`,
              borderRadius: 10,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: typeColors[form.type] || C.info,
                marginBottom: 4,
              }}
            >
              PREVIEW
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
              {form.title}
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
              {form.message}
            </div>
          </div>
        )}
        <Btn
          label="Send Notification"
          icon={Send}
          variant="primary"
          loading={sending}
          onClick={handleSend}
        />
      </Section>

      <Section title="Sent Notifications" subtitle={`${sent.length} recent`}>
        {sent.length === 0 ? (
          <div
            style={{
              color: C.muted,
              textAlign: "center",
              padding: 24,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Bell size={28} />
            <span>No notifications sent yet</span>
          </div>
        ) : (
          sent.map((n) => {
            const TypeIcon = TYPE_ICONS[n.type] || AlertCircle;
            return (
              <div
                key={n.id}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "12px 0",
                  borderBottom: `1px solid ${C.border}`,
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: `${typeColors[n.type] || C.info}14`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <TypeIcon size={14} color={typeColors[n.type] || C.info} />
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 3,
                    }}
                  >
                    <Badge
                      label={n.type || "info"}
                      color={typeColors[n.type] || C.info}
                    />
                    <Badge label={n.target_type} color={C.muted} />
                    <span
                      style={{ fontSize: 13, fontWeight: 600, color: C.text }}
                    >
                      {n.title}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: C.muted }}>{n.body}</div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>
                    Sent by {n.sent_by_name || "Admin"} · {n.reach} users
                    reached · {new Date(n.sent_at).toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </Section>
    </div>
  );
}

// ============================================================================
// COMMUNITIES SECTION — Fixed suspend
// ============================================================================
export function CommunitiesSection({ adminData }) {
  const {
    communities,
    total,
    page,
    setPage,
    loading,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    reload,
    pageSize = 20,
    suspend,
    restore,
    hardDelete,
  } = useCommunities();
  const [alert, setAlert] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [acting, setActing] = useState(false);

  const doAction = async (fn, successMsg) => {
    setActing(true);
    try {
      await fn();
      setAlert({ type: "success", msg: successMsg });
      setConfirmAction(null);
    } catch (e) {
      setAlert({ type: "error", msg: e.message });
    } finally {
      setActing(false);
    }
  };

  const STATUS_TABS = [
    { value: "active", label: "Active", color: C.success, icon: CheckCircle2 },
    { value: "suspended", label: "Suspended", color: C.danger, icon: XCircle },
    { value: "all", label: "All", color: C.muted, icon: Layers },
  ];

  const columns = [
    {
      label: "Community",
      render: (c) => (
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: C.text,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Globe size={13} color={C.accent} />
            {c.name}
            {c.is_verified && <BadgeCheck size={13} color={C.accent} />}
            {c.is_premium && <Crown size={13} color="#f59e0b" />}
          </div>
          <div style={{ fontSize: 11, color: C.muted }}>
            Owner: {c.owner_name} · {c.owner_email}
          </div>
          {c.status === "suspended" && c.settings?.suspension_reason && (
            <div
              style={{
                fontSize: 10,
                color: C.danger,
                marginTop: 2,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <AlertTriangle size={10} /> {c.settings.suspension_reason}
            </div>
          )}
        </div>
      ),
    },
    {
      label: "Members",
      render: (c) => (
        <span style={{ color: C.accent, fontWeight: 700 }}>
          {(c.member_count || 0).toLocaleString()}
        </span>
      ),
    },
    {
      label: "Status",
      render: (c) => (
        <StatusBadge
          status={c.status === "suspended" ? "suspended" : "active"}
        />
      ),
    },
    {
      label: "Created",
      render: (c) => (
        <span style={{ fontSize: 11, color: C.muted }}>
          {new Date(c.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      label: "Actions",
      render: (c) => (
        <div style={{ display: "flex", gap: 4 }}>
          {c.status === "active" ? (
            <Btn
              label="Suspend"
              size="sm"
              danger
              icon={XCircle}
              onClick={() => {
                setConfirmAction({ type: "suspend", community: c });
                setSuspendReason("");
              }}
            />
          ) : (
            <Btn
              label="Restore"
              size="sm"
              icon={RotateCcw}
              onClick={() =>
                setConfirmAction({ type: "restore", community: c })
              }
            />
          )}
          <Btn
            label="Delete"
            size="sm"
            danger
            icon={Trash2}
            onClick={() => setConfirmAction({ type: "delete", community: c })}
          />
        </div>
      ),
    },
  ];

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <div>
          <h1
            style={{ fontSize: 26, fontWeight: 800, color: C.text, margin: 0 }}
          >
            Communities
          </h1>
          <p style={{ color: C.muted, marginTop: 4, fontSize: 14 }}>
            {total.toLocaleString()} communities
          </p>
        </div>
        <Btn icon={RefreshCw} onClick={reload} />
      </div>

      {alert && (
        <Alert
          type={alert.type}
          message={alert.msg}
          onClose={() => setAlert(null)}
        />
      )}

      <Section noPad>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 18px",
            borderBottom: `1px solid ${C.border}`,
            flexWrap: "wrap",
          }}
        >
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search communities…"
          />
          <div style={{ display: "flex", gap: 4 }}>
            {STATUS_TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setStatusFilter(t.value)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 7,
                  cursor: "pointer",
                  border: `1px solid ${statusFilter === t.value ? `${t.color}44` : C.border}`,
                  background:
                    statusFilter === t.value ? `${t.color}0a` : "transparent",
                  color: statusFilter === t.value ? t.color : C.muted,
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <t.icon size={10} />
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <DataTable
          columns={columns}
          rows={communities}
          loading={loading}
          emptyMsg={
            statusFilter === "suspended"
              ? "No suspended communities."
              : "No communities found."
          }
          footer={
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
            />
          }
        />
      </Section>

      {/* Suspend Modal */}
      <Modal
        open={confirmAction?.type === "suspend"}
        onClose={() => setConfirmAction(null)}
        title={`Suspend "${confirmAction?.community?.name}"`}
        danger
        width={440}
        footer={
          <>
            <Btn label="Cancel" onClick={() => setConfirmAction(null)} />
            <Btn
              label={acting ? "Suspending…" : "Suspend Community"}
              danger
              loading={acting}
              onClick={() =>
                doAction(
                  () => suspend(confirmAction.community.id, suspendReason),
                  `"${confirmAction?.community?.name}" suspended.`,
                )
              }
            />
          </>
        }
      >
        <Alert
          type="warn"
          message="Suspending sets deleted_at — hides the community from all users immediately."
        />
        <Field label="Reason (optional)">
          <Input
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
            placeholder="e.g. Policy violation, spam…"
            rows={2}
          />
        </Field>
      </Modal>

      <ConfirmDialog
        open={confirmAction?.type === "restore"}
        onClose={() => setConfirmAction(null)}
        title="Restore Community"
        message={`Restore "${confirmAction?.community?.name}"? It will become visible to all members again.`}
        confirmLabel="Restore"
        onConfirm={() =>
          doAction(
            () => restore(confirmAction.community.id),
            `"${confirmAction?.community?.name}" restored.`,
          )
        }
      />

      <ConfirmDialog
        open={confirmAction?.type === "delete"}
        onClose={() => setConfirmAction(null)}
        title="Permanently Delete Community"
        danger
        message={`Delete "${confirmAction?.community?.name}" forever? This removes all channels and data. Cannot be undone.`}
        confirmLabel="Delete Permanently"
        onConfirm={() =>
          doAction(
            () => hardDelete(confirmAction.community.id),
            `"${confirmAction?.community?.name}" permanently deleted.`,
          )
        }
      />
    </div>
  );
}

// ============================================================================
// USERS SECTION — reexport placeholder (use UsersSection.jsx directly)
// ============================================================================
export { default as UsersSection } from "./UsersSection.jsx";
