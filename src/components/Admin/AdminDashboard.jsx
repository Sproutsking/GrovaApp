// ============================================================================
// src/components/Admin/AdminDashboard.jsx — v7 ISOLATED POWERHOUSE
// ============================================================================
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │  SYSTEM 2 OF 3: ADMIN DASHBOARD — COMPLETELY ISOLATED                  │
// │                                                                         │
// │  This dashboard is rendered as a fixed-position overlay in App.jsx.    │
// │  It sits ABOVE the app DOM. No app section can touch or break it.      │
// │                                                                         │
// │  DATA CONTRACT:                                                         │
// │    - Receives adminData as a prop (read-only snapshot from AuthContext) │
// │    - All DB operations are internal (useAdminData hooks)                │
// │    - Never writes to AuthContext or any app-level state                 │
// │                                                                         │
// │  ISOLATION GUARANTEE:                                                   │
// │    - AdminDashboard has its own scroll context (overflow: hidden)       │
// │    - Fixed position means app re-renders don't affect layout           │
// │    - All hooks are self-contained — they survive any app update        │
// └─────────────────────────────────────────────────────────────────────────┘
//
// CHANGES v7:
//   - DashboardOverview: replaced LivePulse+h1 header block with a
//     typewriter greeting ("Good morning/afternoon/evening, {name}") that
//     erases itself then types "Welcome to the Command Center." — no second
//     Live dot near the heading; the single Live dot stays in the top bar.
//   - MetricCard: full redesign — count-up animation, glow blobs, arc ring
//     with drop-shadow, hover lift + colored box-shadow, gradient accent bar.
//   - LivePulse removed from DashboardOverview header (kept in top bar only).
//
// PATCH (Economy Metrics):
//   - DashboardOverview now renders an Economy Metrics panel below Quick Actions.
//   - Displays: Circulating XEV, Total XEV Minted, EP in Circulation,
//     EP from Deposits, and a Creator Revenue Sharing summary row.
//   - All values sourced from useStats() extended fields in useAdminData.js.
//
// ONLINE MEMBERS: Correctly uses m.user_id (profile UUID) for comparison.
// DATA: 100% real DB data, zero mock data. If data is missing, it's RLS.
//       See: database-rls-policies.sql for the correct policy setup.
// ============================================================================

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Users,
  Ticket,
  BarChart3,
  CreditCard,
  Globe,
  Shield,
  Bell,
  Settings,
  Users2,
  Crown,
  Menu,
  X,
  LogOut,
  ChevronRight,
  Headphones,
  RefreshCw,
  Zap,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  C,
  Btn,
  Alert,
  AdminOnlinePanel,
  LivePulse,
} from "./AdminUI.jsx";
import { getVisibleSections, ROLE_META } from "./permissions.js";
import {
  useStats,
  useUsers,
  useInvites,
  useAnalytics,
  useTransactions,
  useSecurity,
  useNotifications,
  useCommunities,
  usePlatformFreeze,
  usePlatformSettings,
  useTeam,
  useSupportCases,
} from "./useAdminData.js";

import SupportSection from "./sections/SupportSection.jsx";
import {
  UsersSection,
  AnalyticsSection,
  TransactionsSection,
  SecuritySection,
  NotificationsSection,
  CommunitiesSection,
} from "./sections/OtherSections.jsx";
import InviteSection from "./sections/InviteSection.jsx";
import { FreezeSection, SystemSection } from "./sections/SystemSection.jsx";
import TeamSection, { CEOPanel } from "./sections/TeamSection.jsx";

// ─── Nav Items ─────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: "dashboard",     label: "Dashboard",    icon: LayoutDashboard },
  { id: "support",       label: "Support",       icon: Headphones, badge: "cases" },
  { id: "users",         label: "Users",         icon: Users },
  { id: "invites",       label: "Invites",       icon: Ticket },
  { id: "analytics",     label: "Analytics",     icon: BarChart3 },
  { id: "transactions",  label: "Transactions",  icon: CreditCard },
  { id: "communities",   label: "Communities",   icon: Globe },
  { id: "security",      label: "Security",      icon: Shield },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "system",        label: "System",        icon: Settings },
  { id: "team",          label: "Team",          icon: Users2 },
  { id: "ceo",           label: "CEO Panel",     icon: Crown },
];

// ─── Utility: time-of-day greeting ─────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ─── Typewriter hook ────────────────────────────────────────────────────────
// Sequence:
//   1. Type phrase A
//   2. Pause
//   3. Erase phrase A
//   4. Type phrase B
//   5. Pause — then loop back to step 3 (erase B → type A → …)
//
// Returns: { displayed: string, phase: "typing"|"erasing"|"pausing" }
function useTypewriter(phraseA, phraseB, {
  typeSpeed   = 52,
  eraseSpeed  = 28,
  pauseAfterA = 1800,
  pauseAfterB = 3200,
} = {}) {
  const [displayed, setDisplayed]   = useState("");
  const [phase, setPhase]           = useState("typing-a"); // typing-a | pause-a | erase-a | typing-b | pause-b | erase-b
  const timerRef = useRef(null);

  useEffect(() => {
    const clear = () => clearTimeout(timerRef.current);

    function tick() {
      clear();
      setDisplayed((cur) => {
        switch (phase) {
          case "typing-a": {
            if (cur.length < phraseA.length) {
              timerRef.current = setTimeout(tick, typeSpeed);
              return phraseA.slice(0, cur.length + 1);
            }
            // finished typing A — pause
            setPhase("pause-a");
            timerRef.current = setTimeout(() => setPhase("erase-a"), pauseAfterA);
            return cur;
          }
          case "erase-a": {
            if (cur.length > 0) {
              timerRef.current = setTimeout(tick, eraseSpeed);
              return cur.slice(0, -1);
            }
            setPhase("typing-b");
            timerRef.current = setTimeout(tick, typeSpeed);
            return "";
          }
          case "typing-b": {
            if (cur.length < phraseB.length) {
              timerRef.current = setTimeout(tick, typeSpeed);
              return phraseB.slice(0, cur.length + 1);
            }
            setPhase("pause-b");
            timerRef.current = setTimeout(() => setPhase("erase-b"), pauseAfterB);
            return cur;
          }
          case "erase-b": {
            if (cur.length > 0) {
              timerRef.current = setTimeout(tick, eraseSpeed);
              return cur.slice(0, -1);
            }
            setPhase("typing-a");
            timerRef.current = setTimeout(tick, typeSpeed);
            return "";
          }
          default:
            return cur;
        }
      });
    }

    if (phase === "typing-a" || phase === "typing-b" || phase === "erase-a" || phase === "erase-b") {
      timerRef.current = setTimeout(tick, typeSpeed);
    }

    return clear;
  }, [phase, phraseA, phraseB, typeSpeed, eraseSpeed, pauseAfterA, pauseAfterB]);

  const isTyping = phase === "typing-a" || phase === "typing-b";
  return { displayed, isTyping };
}

// ─── Arc ring progress ──────────────────────────────────────────────────────
function ArcRing({ value, max, color, size = 46 }) {
  const pct  = max > 0 ? Math.min(value / max, 1) : 0;
  const r    = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  const cx   = size / 2;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="#1e1e1e" strokeWidth={3} />
      <circle
        cx={cx} cy={cx} r={r} fill="none"
        stroke={color} strokeWidth={3} strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        style={{
          filter: `drop-shadow(0 0 5px ${color}90)`,
          transition: "stroke-dasharray .8s cubic-bezier(.4,0,.2,1)",
        }}
      />
    </svg>
  );
}

// ─── Animated count-up ──────────────────────────────────────────────────────
function CountUp({ target }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    const raw = String(target).replace(/[^0-9.]/g, "");
    const num = parseFloat(raw) || 0;
    const steps = 48;
    let step = 0;
    clearInterval(ref.current);
    ref.current = setInterval(() => {
      step++;
      const eased = 1 - Math.pow(1 - step / steps, 3);
      setDisplay(Math.round(num * eased));
      if (step >= steps) clearInterval(ref.current);
    }, 900 / steps);
    return () => clearInterval(ref.current);
  }, [target]);

  const prefix    = String(target).match(/^[^0-9]*/)?.[0]  || "";
  const hasDec    = String(target).includes(".");
  const formatted = hasDec
    ? display.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : display.toLocaleString();

  return <span>{prefix}{formatted}</span>;
}

// ─── Metric Card (full redesign) ────────────────────────────────────────────
function MetricCard({ icon: Icon, label, value, subValue, trend, trendPositive, color = C.accent, ring, onClick }) {
  const [hov, setHov] = useState(false);
  const clickable = !!onClick;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position:      "relative",
        background:    hov ? "#141414" : "#0f0f0f",
        border:        `1px solid ${hov ? color + "45" : "#1d1d1d"}`,
        borderRadius:  18,
        padding:       "22px 22px 18px",
        cursor:        clickable ? "pointer" : "default",
        overflow:      "hidden",
        transition:    "border-color .2s, background .2s, transform .18s, box-shadow .2s",
        transform:     hov && clickable ? "translateY(-3px)" : "none",
        boxShadow:     hov
          ? `0 12px 40px ${color}18, 0 2px 12px #00000055`
          : "0 2px 8px #00000040",
        display:       "flex",
        flexDirection: "column",
        minHeight:     158,
      }}
    >
      {/* Radial glow blob */}
      <div style={{
        position:      "absolute",
        top:           -40,
        right:         -40,
        width:         130,
        height:        130,
        borderRadius:  "50%",
        background:    `radial-gradient(circle, ${color}1e 0%, transparent 70%)`,
        pointerEvents: "none",
        opacity:       hov ? 1 : 0.55,
        transition:    "opacity .3s",
      }} />

      {/* Top-edge shimmer on hover */}
      <div style={{
        position:   "absolute",
        top:        0,
        left:       20,
        right:      20,
        height:     1,
        background: `linear-gradient(90deg, transparent, ${color}55, transparent)`,
        opacity:    hov ? 1 : 0,
        transition: "opacity .25s",
      }} />

      {/* Icon + label row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{
            width:          34,
            height:         34,
            borderRadius:   10,
            background:     `${color}12`,
            border:         `1px solid ${color}22`,
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            boxShadow:      hov ? `0 0 14px ${color}28` : "none",
            transition:     "box-shadow .2s",
          }}>
            <Icon size={16} color={color} strokeWidth={2} />
          </div>
          <span style={{
            fontSize:      10.5,
            fontWeight:    700,
            color:         C.muted,
            letterSpacing: 1,
            textTransform: "uppercase",
          }}>
            {label}
          </span>
        </div>

        {ring ? (
          <ArcRing value={ring.value} max={ring.max} color={color} size={46} />
        ) : (
          <div style={{
            width:      7,
            height:     7,
            borderRadius: "50%",
            background: color,
            marginTop:  7,
            boxShadow:  `0 0 10px ${color}`,
            animation:  "adminMetricPulse 2s ease infinite",
          }} />
        )}
      </div>

      {/* Main value */}
      <div style={{
        fontSize:           34,
        fontWeight:         900,
        color:              C.text,
        lineHeight:         1,
        letterSpacing:      -2,
        fontVariantNumeric: "tabular-nums",
        marginBottom:       6,
      }}>
        <CountUp target={value} />
      </div>

      {/* Sub value */}
      {subValue && (
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>
          {subValue}
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* Divider */}
      <div style={{ height: 1, background: "#1a1a1a", marginBottom: 12 }} />

      {/* Trend or accent bar */}
      {trend ? (
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {trendPositive
            ? <TrendingUp  size={12} color={C.success} />
            : <TrendingDown size={12} color={C.danger}  />
          }
          <span style={{
            fontSize:   11,
            fontWeight: 700,
            color:      trendPositive ? C.success : C.danger,
          }}>
            {trend}
          </span>
        </div>
      ) : (
        <div style={{
          height:     3,
          borderRadius: 2,
          background: `linear-gradient(90deg, ${color}, ${color}28)`,
          width:      "45%",
        }} />
      )}
    </div>
  );
}

// ─── Dashboard Overview ────────────────────────────────────────────────────
// PATCHED: Economy Metrics panel added below Quick Actions + Online Team grid.
function DashboardOverview({ stats, onNavigate, team, adminData }) {
  const s         = stats || {};
  const openCases = s.openCases || 0;
  const firstName = (adminData?.full_name || "Admin").split(" ")[0];

  const phraseA = `${getGreeting()}, ${firstName}.`;
  const phraseB = "Welcome to the Command Center.";
  const { displayed, isTyping } = useTypewriter(phraseA, phraseB);

  return (
    <div>
      {/* ── Header with typewriter ── */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          fontSize:      24,
          fontWeight:    900,
          color:         C.text,
          margin:        "0 0 6px 0",
          letterSpacing: -0.5,
          minHeight:     32,
          display:       "flex",
          alignItems:    "center",
          gap:           2,
        }}>
          {displayed}
          {/* blinking cursor */}
          <span style={{
            display:       "inline-block",
            width:         2,
            height:        22,
            background:    C.accent,
            borderRadius:  1,
            marginLeft:    3,
            boxShadow:     `0 0 8px ${C.accent}`,
            animation:     "adminCursorBlink .75s step-end infinite",
            verticalAlign: "middle",
          }} />
        </h1>
        <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* ── Key Metrics ── */}
      <div style={{
        display:             "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap:                 14,
        marginBottom:        24,
      }}>
        <MetricCard
          icon={Users}
          label="Total Users"
          value={(s.totalUsers || 0).toLocaleString()}
          subValue={`+${s.newUsersToday || 0} today`}
          trend={s.newUsersWeek > 0 ? `+${s.newUsersWeek} this week` : undefined}
          trendPositive
          color={C.accent}
          ring={{ value: s.activeUsers || 0, max: s.totalUsers || 1 }}
        />
        <MetricCard
          icon={CreditCard}
          label="Revenue"
          value={`$${(s.totalRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subValue={`$${(s.revenueToday || 0).toFixed(2)} today`}
          color={C.success}
        />
        <MetricCard
          icon={Headphones}
          label="Open Cases"
          value={openCases}
          subValue={
            openCases > 10 ? "Needs attention"
            : openCases > 0 ? "In progress"
            : "All clear"
          }
          color={openCases > 10 ? C.danger : openCases > 0 ? C.warn : C.success}
          onClick={() => onNavigate("support")}
        />
        <MetricCard
          icon={BarChart3}
          label="Active Users"
          value={(s.activeUsers || 0).toLocaleString()}
          subValue="Total active accounts"
          color={C.info}
          ring={{ value: s.activeUsers || 0, max: s.totalUsers || 1 }}
        />
      </div>

      {/* ── Quick Actions + Online Team ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16, marginBottom: 24 }}>
        <div style={{
          background:   C.bg2,
          border:       `1px solid ${C.border}`,
          borderRadius: 16,
          padding:      20,
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>
            Quick Actions
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {[
              { label: "Review Cases",  icon: Headphones, nav: "support",       color: C.accent  },
              { label: "Manage Users",  icon: Users,      nav: "users",         color: C.info    },
              { label: "Send Notif.",   icon: Bell,       nav: "notifications", color: C.warn    },
              { label: "Invites",       icon: Ticket,     nav: "invites",       color: C.purple  },
              { label: "Analytics",     icon: BarChart3,  nav: "analytics",     color: C.success },
              { label: "Security",      icon: Shield,     nav: "security",      color: C.danger  },
            ].map((qa) => (
              <button
                key={qa.nav}
                onClick={() => onNavigate(qa.nav)}
                style={{
                  padding:       "14px 12px",
                  background:    `${qa.color}08`,
                  border:        `1px solid ${qa.color}25`,
                  borderRadius:  12,
                  cursor:        "pointer",
                  display:       "flex",
                  flexDirection: "column",
                  alignItems:    "center",
                  gap:           8,
                  transition:    "all .15s",
                  fontFamily:    "inherit",
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = `${qa.color}15`)}
                onMouseOut={(e)  => (e.currentTarget.style.background = `${qa.color}08`)}
              >
                <qa.icon size={20} color={qa.color} />
                <span style={{ fontSize: 11, fontWeight: 600, color: C.text2 }}>
                  {qa.label}
                </span>
              </button>
            ))}
          </div>

          <div style={{
            display:    "flex",
            gap:        16,
            marginTop:  20,
            paddingTop: 16,
            borderTop:  `1px solid ${C.border}`,
          }}>
            {[
              { label: "Suspended",      value: s.bannedUsers   || 0,                          color: C.danger },
              { label: "Active Invites", value: s.pendingInvites || 0,                         color: C.warn   },
              { label: "Content Pieces", value: (s.totalContent  || 0).toLocaleString(),       color: C.info   },
            ].map((st) => (
              <div key={st.label} style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: st.color }}>{st.value}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{st.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* AdminOnlinePanel: currentAdminUserId MUST be the profile UUID (user_id) */}
        <AdminOnlinePanel team={team} currentAdminUserId={adminData?.user_id} />
      </div>

      {/* ── PATCHED: Economy Metrics Panel ────────────────────────────────── */}
      <div style={{
        background:   C.bg2,
        border:       `1px solid ${C.border}`,
        borderRadius: 16,
        padding:      20,
        marginBottom: 24,
      }}>
        {/* Panel header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Economy Metrics</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Live EP & XEV ecosystem health</div>
          </div>
          <div style={{
            display:    "flex",
            alignItems: "center",
            gap:        5,
            padding:    "3px 9px",
            borderRadius: 8,
            background: `${C.accent}08`,
            border:     `1px solid ${C.accent}18`,
          }}>
            <div style={{
              width:        5,
              height:       5,
              borderRadius: "50%",
              background:   C.accent,
              animation:    "adminMetricPulse 2s ease infinite",
            }} />
            <span style={{ fontSize: 9, color: C.accent, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Live
            </span>
          </div>
        </div>

        {/* Four economy stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>

          {/* Circulating XEV */}
          <div style={{
            padding:      "16px 14px",
            background:   "rgba(251,191,36,0.04)",
            border:       "1px solid rgba(251,191,36,0.15)",
            borderRadius: 14,
            borderTop:    "3px solid #fbbf24",
          }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: "#7c5c0a", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>
              Circulating XEV
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#fbbf24", letterSpacing: -1, marginBottom: 4 }}>
              {(s.totalXEVCirculating || 0).toLocaleString()}
            </div>
            <div style={{ fontSize: 10, color: C.muted }}>Active wallet balances</div>
            <div style={{ marginTop: 10, height: 2, background: "rgba(255,255,255,0.04)", borderRadius: 1, overflow: "hidden" }}>
              <div style={{ height: "100%", width: "100%", background: "linear-gradient(90deg,#fbbf24,#fbbf2455)", borderRadius: 1 }} />
            </div>
          </div>

          {/* Total XEV Minted */}
          <div style={{
            padding:      "16px 14px",
            background:   "rgba(251,191,36,0.02)",
            border:       "1px solid rgba(251,191,36,0.1)",
            borderRadius: 14,
            borderTop:    "3px solid rgba(251,191,36,0.5)",
          }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: "#7c5c0a", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>
              Total XEV Minted
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#d4a017", letterSpacing: -1, marginBottom: 4 }}>
              {(s.totalXEVMinted || 0).toLocaleString()}
            </div>
            <div style={{ fontSize: 10, color: C.muted }}>All-time credits (wallet history)</div>
            <div style={{ marginTop: 10, fontSize: 9, color: "rgba(251,191,36,0.4)", fontWeight: 700 }}>
              {s.totalXEVCirculating > 0
                ? `${((s.totalXEVCirculating / Math.max(s.totalXEVMinted, 1)) * 100).toFixed(1)}% still in circulation`
                : "—"
              }
            </div>
          </div>

          {/* EP in Circulation */}
          <div style={{
            padding:      "16px 14px",
            background:   `${C.accent}04`,
            border:       `1px solid ${C.accent}18`,
            borderRadius: 14,
            borderTop:    `3px solid ${C.accent}`,
          }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: "#3a5c10", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>
              EP in Circulation
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: C.accent, letterSpacing: -1, marginBottom: 4 }}>
              {(s.totalEPCirculation || 0).toLocaleString()}
            </div>
            <div style={{ fontSize: 10, color: C.muted }}>Sum of all active user EP</div>
            <div style={{ marginTop: 10, fontSize: 9, color: `${C.accent}55`, fontWeight: 700 }}>
              {s.activeUsers > 0
                ? `~${Math.round((s.totalEPCirculation || 0) / s.activeUsers).toLocaleString()} avg per user`
                : "—"
              }
            </div>
          </div>

          {/* EP from Deposits */}
          <div style={{
            padding:      "16px 14px",
            background:   "rgba(52,211,153,0.04)",
            border:       "1px solid rgba(52,211,153,0.15)",
            borderRadius: 14,
            borderTop:    "3px solid #34d399",
          }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: "#0c4a30", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>
              EP from Deposits
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#34d399", letterSpacing: -1, marginBottom: 4 }}>
              {(s.epMintedOnDeposit || 0).toLocaleString()}
            </div>
            <div style={{ fontSize: 10, color: C.muted }}>Real-money backed EP only</div>
            <div style={{ marginTop: 10, fontSize: 9, color: "rgba(52,211,153,0.5)", fontWeight: 700 }}>
              {s.epMintedOnDeposit > 0
                ? `≈$${((s.epMintedOnDeposit || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} deposited`
                : "No deposits yet"
              }
            </div>
          </div>
        </div>

        {/* Creator Revenue Sharing summary row */}
        <div style={{
          marginTop:  14,
          padding:    "11px 14px",
          background: "rgba(132,204,22,0.04)",
          border:     "1px solid rgba(132,204,22,0.1)",
          borderRadius: 11,
          display:    "flex",
          alignItems: "center",
          gap:        12,
        }}>
          <div style={{ fontSize: 10, color: C.muted, flex: 1 }}>
            <span style={{ color: C.text, fontWeight: 700 }}>Creator Revenue Sharing:</span>{" "}
            Silver gets 2% · Gold gets 5% · Diamond gets 10% of weekly ecosystem revenue ={" "}
            <span style={{ color: C.accent, fontWeight: 800 }}>17% returned to creators</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: C.accent, flexShrink: 0, textAlign: "right" }}>
            ${((s.totalRevenue || 0) * 0.17).toFixed(2)}
            <div style={{ fontSize: 9, color: C.muted, fontWeight: 600 }}>Est. creator pool</div>
          </div>
        </div>
      </div>
      {/* ── END Economy Metrics Panel ─────────────────────────────────────── */}

    </div>
  );
}

// ─── Sidebar ───────────────────────────────────────────────────────────────
function AdminSidebarNav({ adminData, activeSection, onNavigate, stats, collapsed, onToggle }) {
  const visibleSections = getVisibleSections(adminData);
  const roleMeta        = ROLE_META[adminData?.role] || ROLE_META.support;
  const openCases       = stats?.openCases || 0;
  const navItems        = NAV_ITEMS.filter((item) => visibleSections.includes(item.id));

  return (
    <div style={{
      width:         collapsed ? 64 : 220,
      flexShrink:    0,
      background:    C.bg1,
      borderRight:   `1px solid ${C.border}`,
      display:       "flex",
      flexDirection: "column",
      transition:    "width .2s ease",
      overflow:      "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding:        collapsed ? "18px 0" : "18px 16px",
        borderBottom:   `1px solid ${C.border}`,
        display:        "flex",
        alignItems:     "center",
        gap:            10,
        justifyContent: collapsed ? "center" : "space-between",
      }}>
        {!collapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width:          28,
              height:         28,
              borderRadius:   7,
              background:     `linear-gradient(135deg, ${C.accent}, ${C.accent3})`,
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
            }}>
              <Zap size={14} color="#000" />
            </div>
            <span style={{ fontSize: 13, fontWeight: 900, color: C.text, letterSpacing: -0.3 }}>
              XEEVIA
            </span>
          </div>
        )}
        <button
          onClick={onToggle}
          style={{
            width:          28,
            height:         28,
            borderRadius:   6,
            border:         `1px solid ${C.border2}`,
            background:     C.bg3,
            cursor:         "pointer",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            color:          C.muted,
            flexShrink:     0,
          }}
        >
          {collapsed ? <Menu size={14} /> : <X size={14} />}
        </button>
      </div>

      {/* Admin identity */}
      {!collapsed && (
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width:          32,
              height:         32,
              borderRadius:   8,
              flexShrink:     0,
              background:     `${roleMeta.color}20`,
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              fontSize:       13,
              fontWeight:     800,
              color:          roleMeta.color,
            }}>
              {(adminData?.full_name || "A").charAt(0).toUpperCase()}
            </div>
            <div style={{ overflow: "hidden" }}>
              <div style={{
                fontSize:     12,
                fontWeight:   700,
                color:        C.text,
                whiteSpace:   "nowrap",
                overflow:     "hidden",
                textOverflow: "ellipsis",
              }}>
                {adminData?.full_name || "Admin"}
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, color: roleMeta.color }}>
                {roleMeta.label}
                {adminData?.xa_id && (
                  <span style={{ marginLeft: 6, fontFamily: "monospace", opacity: 0.8 }}>
                    XA-{String(adminData.xa_id).padStart(2, "0")}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, padding: "8px 0", overflowY: "auto" }}>
        {navItems.map((item) => {
          const isActive  = activeSection === item.id;
          const badge     = item.badge === "cases" ? openCases : null;
          const showBadge = badge && badge > 0;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              title={collapsed ? item.label : undefined}
              style={{
                width:          "100%",
                padding:        collapsed ? "10px 0" : "9px 14px",
                display:        "flex",
                alignItems:     "center",
                gap:            10,
                justifyContent: collapsed ? "center" : "flex-start",
                background:     isActive ? `${C.accent}12` : "transparent",
                border:         "none",
                borderLeft:     isActive ? `2px solid ${C.accent}` : "2px solid transparent",
                cursor:         "pointer",
                color:          isActive ? C.accent : C.muted,
                fontFamily:     "inherit",
                fontSize:       13,
                fontWeight:     isActive ? 700 : 500,
                transition:     "all .12s",
                position:       "relative",
              }}
              onMouseOver={(e) => { if (!isActive) e.currentTarget.style.color = C.text2; }}
              onMouseOut={(e)  => { if (!isActive) e.currentTarget.style.color = C.muted;  }}
            >
              <item.icon size={16} style={{ flexShrink: 0 }} />
              {!collapsed && (
                <span style={{ flex: 1, textAlign: "left" }}>{item.label}</span>
              )}
              {!collapsed && showBadge && (
                <span style={{
                  minWidth:       18,
                  height:         18,
                  borderRadius:   9,
                  background:     badge > 10 ? C.danger : C.warn,
                  color:          "#fff",
                  fontSize:       10,
                  fontWeight:     700,
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "center",
                  padding:        "0 5px",
                }}>
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
              {collapsed && showBadge && (
                <div style={{
                  position:     "absolute",
                  top:          6,
                  right:        10,
                  width:        8,
                  height:       8,
                  borderRadius: "50%",
                  background:   badge > 10 ? C.danger : C.warn,
                }} />
              )}
            </button>
          );
        })}
      </nav>

      {!collapsed && (
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 10, color: C.muted, textAlign: "center" }}>
            Xeevia Admin v2.0
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main AdminDashboard ───────────────────────────────────────────────────
//
// Props:
//   adminData — read-only snapshot from AuthContext (do not mutate)
//   onClose   — callback to hide the dashboard overlay in App.jsx
//
export default function AdminDashboard({ adminData, onClose }) {
  const [activeSection,    setActiveSection]    = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // All data hooks — completely self-contained, isolated from app hooks
  const { stats, loading: statsLoading, reload: reloadStats } = useStats();
  const usersHook         = useUsers();
  const invitesHook       = useInvites();
  const analyticsHook     = useAnalytics();
  const transactionsHook  = useTransactions();
  const securityHook      = useSecurity();
  const notificationsHook = useNotifications();
  const communitiesHook   = useCommunities();
  const freezeHook        = usePlatformFreeze();
  const platformSettings  = usePlatformSettings();
  const teamHook          = useTeam();
  const casesHook         = useSupportCases();

  const navigate = useCallback((section) => {
    setActiveSection(section);
    window.scrollTo(0, 0);
  }, []);

  // ── Support management ─────────────────────────────────────────────────
  const supportMgmt = {
    cases:       casesHook.cases || [],
    loading:     casesHook.loading,
    load:        casesHook.reload,
    resolveCase: async (id, note, ad) => {
      await casesHook.resolveCase(id, {
        adminName: ad?.full_name,
        adminId:   ad?.user_id || ad?.id,
        action:    "resolved",
        note,
      });
    },
    assignCase: async (id, memberId, memberName) => {
      await casesHook.assignCase(id, { adminId: memberId, adminName: memberName });
    },
    addNote: async (id, text, ad) => {
      await casesHook.addNote(id, {
        text,
        adminName: ad?.full_name,
        adminId:   ad?.user_id || ad?.id,
      });
    },
    getCase:    async (id) => casesHook.cases.find((c) => c.id === id) || null,
    createCase: async (caseData) => { await casesHook.createSupportCase(caseData); },
    escalateCase: async (id) => {
      await casesHook.updateCase(id, {
        status:       "escalated",
        escalated_at: new Date().toISOString(),
      });
    },
  };

  // ── Team management ────────────────────────────────────────────────────
  const teamMgmt = {
    team:              teamHook.team || [],
    loading:           teamHook.loading,
    load:              teamHook.load,
    addMember:         teamHook.addMember,
    removeMember:      teamHook.removeMember,
    updatePermissions: teamHook.updatePermissions,
    updateRole:        teamHook.updateRole,
  };

  // ── User management ────────────────────────────────────────────────────
  const userMgmt = {
    banUser:      usersHook.banUser,
    unbanUser:    usersHook.unbanUser,
    deleteUser:   usersHook.deleteUser,
    restoreUser:  usersHook.restoreUser,
    verifyUser:   usersHook.verifyUser,
    setUserTier:  usersHook.setUserTier,
    adjustWallet: usersHook.adjustWallet,
  };

  // ── Section renderer ───────────────────────────────────────────────────
  const renderSection = () => {
    switch (activeSection) {
      case "dashboard":
        return (
          <DashboardOverview
            stats={stats}
            onNavigate={navigate}
            team={teamHook.team || []}
            adminData={adminData}
          />
        );
      case "support":
        return (
          <SupportSection
            adminData={adminData}
            supportMgmt={supportMgmt}
            teamMgmt={teamMgmt}
          />
        );
      case "users":
        return <UsersSection adminData={adminData} usersHook={usersHook} />;
      case "invites":
        return <InviteSection adminData={adminData} invitesHook={invitesHook} />;
      case "analytics":
        return (
          <AnalyticsSection
            adminData={adminData}
            stats={stats}
            onRefresh={analyticsHook.reload}
          />
        );
      case "transactions":
        return (
          <TransactionsSection
            adminData={adminData}
            txMgmt={{ refund: transactionsHook.refundTransaction }}
          />
        );
      case "communities":
        return (
          <CommunitiesSection
            adminData={adminData}
            contentMgmt={{
              suspend: communitiesHook.suspend,
              restore: communitiesHook.restore,
            }}
          />
        );
      case "security":
        return (
          <SecuritySection
            adminData={adminData}
            secData={{
              recentEvents:       securityHook.events || [],
              suspiciousAccounts: securityHook.lockedAccounts || [],
              load:               securityHook.reload,
              unlockAccount:      securityHook.resolveEvent,
            }}
          />
        );
      case "notifications":
        return (
          <NotificationsSection
            adminData={adminData}
            broadcaster={{
              send: (notif) =>
                notificationsHook.send({
                  ...notif,
                  sentByName: adminData?.full_name,
                  sentById:   adminData?.user_id || adminData?.id,
                }),
            }}
          />
        );
      case "system":
        return (
          <div>
            <SystemSection adminData={adminData} platformSettings={platformSettings} />
            <div style={{ marginTop: 32 }}>
              <FreezeSection adminData={adminData} freezeHook={freezeHook} />
            </div>
          </div>
        );
      case "team":
        return <TeamSection adminData={adminData} teamMgmt={teamMgmt} />;
      case "ceo":
        return (
          <CEOPanel
            adminData={adminData}
            stats={stats}
            teamMgmt={teamMgmt}
            platformSettings={platformSettings}
          />
        );
      default:
        return (
          <div style={{ padding: 40, color: C.muted, textAlign: "center" }}>
            Section not found
          </div>
        );
    }
  };

  return (
    <div
      style={{
        display:    "flex",
        height:     "100vh",
        width:      "100vw",
        background: C.bg,
        fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif",
        color:      C.text,
        overflow:   "hidden",
        // Fixed overlay — sits completely above the app
        position:   "fixed",
        top:        0,
        left:       0,
        zIndex:     10000,
      }}
    >
      <AdminSidebarNav
        adminData={adminData}
        activeSection={activeSection}
        onNavigate={navigate}
        stats={stats}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
      />

      <div style={{
        flex:          1,
        display:       "flex",
        flexDirection: "column",
        overflow:      "hidden",
        minWidth:      0,
      }}>
        {/* Top bar — the ONE live pulse lives here */}
        <div style={{
          height:       52,
          borderBottom: `1px solid ${C.border}`,
          display:      "flex",
          alignItems:   "center",
          padding:      "0 20px",
          gap:          12,
          background:   C.bg1,
          flexShrink:   0,
        }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: C.muted }}>Admin</span>
            <ChevronRight size={12} color={C.muted} />
            <span style={{
              fontSize:      12,
              fontWeight:    600,
              color:         C.text2,
              textTransform: "capitalize",
            }}>
              {activeSection.replace(/_/g, " ")}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Single authoritative Live pulse — only here in the top bar */}
            <LivePulse label="Live" size={6} />
            <Btn icon={RefreshCw} size="sm" onClick={reloadStats} title="Refresh stats" />
            {onClose && (
              <Btn icon={X} size="sm" onClick={onClose} title="Back to app" />
            )}
          </div>
        </div>

        {/* Section content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
          {renderSection()}
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #222; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #333; }

        @keyframes adminCursorBlink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        @keyframes adminMetricPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.35; }
        }
      `}</style>
    </div>
  );
}