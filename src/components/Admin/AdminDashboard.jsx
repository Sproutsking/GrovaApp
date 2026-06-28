// ============================================================================
// src/components/Admin/AdminDashboard.jsx — v9 PRODUCTION COMPLETE
// ============================================================================
// KEY CHANGES vs v8:
//   - Liquidity added to NAV_ITEMS (between System and Team)
//   - communities case: no longer passes contentMgmt — CommunitiesSection
//     uses its own internal useCommunities() hook
//   - transactions case: no longer passes txMgmt — TransactionsSection
//     uses its own internal useTransactions() hook
//   - ambassador banner: Globe2 Lucide icon (was emoji 🌐)
//   - Quick Actions: all Lucide icons, 9 items in 3×3 grid
//   - Sidebar: nav group labels, tighter spacing
//   - Economy panel: EP note "base grant 50 EP per paid user"
//   - getVisibleSections must include "liquidity" for super_admin+ roles
//     (update permissions.js accordingly)
// ============================================================================

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  LayoutDashboard, Users, Ticket, BarChart3, CreditCard,
  Globe, Globe2, Shield, Bell, Settings, Users2, Crown,
  Menu, X, ChevronRight, Headphones, RefreshCw, Zap,
  TrendingUp, TrendingDown, Star, Droplets, Activity,
  DollarSign,
} from "lucide-react";
import { C, Btn, AdminOnlinePanel, LivePulse } from "./AdminUI.jsx";
import { getVisibleSections, ROLE_META } from "./permissions.js";
import {
  useStats, useUsers, useInvites, useAnalytics,
  useSecurity, useNotifications, usePlatformFreeze,
  usePlatformSettings, useTeam, useSupportCases,
} from "./useAdminData.js";

import SupportSection from "./sections/SupportSection.jsx";
import {
  UsersSection, AnalyticsSection, TransactionsSection,
  SecuritySection, NotificationsSection, CommunitiesSection,
} from "./sections/OtherSections.jsx";
import InviteSection     from "./sections/InviteSection.jsx";
import { FreezeSection, SystemSection } from "./sections/SystemSection.jsx";
import TeamSection, { CEOPanel } from "./sections/TeamSection.jsx";
import AmbassadorSection from "./sections/AmbassadorSection.jsx";
import LiquiditySection  from "./sections/LiquiditySection.jsx";
import ServicesModal     from "../Shared/ServicesModal";

// ─── Nav definition ────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: "dashboard",    label: "Dashboard",     icon: LayoutDashboard },
  { id: "support",      label: "Support",        icon: Headphones,   badge: "cases" },
  { id: "users",        label: "Users",          icon: Users },
  { id: "invites",      label: "Invites",        icon: Ticket },
  { id: "analytics",   label: "Analytics",      icon: BarChart3 },
  { id: "transactions", label: "Transactions",   icon: CreditCard },
  { id: "communities",  label: "Communities",    icon: Globe },
  { id: "security",    label: "Security",       icon: Shield },
  { id: "notifications",label: "Notifications", icon: Bell },
  { id: "system",      label: "System",         icon: Settings },
  { id: "liquidity",   label: "Liquidity",      icon: Droplets },   // ← NEW
  { id: "team",        label: "Team",           icon: Users2 },
  { id: "ambassador",  label: "Ambassadors",    icon: Star },
  { id: "ceo",         label: "CEO Panel",      icon: Crown },
];

// Groups shown above nav items when sidebar is expanded
const NAV_GROUPS = {
  dashboard:     null,
  support:       "Operations",
  users:         null,
  invites:       null,
  analytics:     "Data",
  transactions:  null,
  communities:   null,
  security:      "Platform",
  notifications: null,
  system:        null,
  liquidity:     "Finance",
  team:          "Admin",
  ambassador:    null,
  ceo:           null,
};

// ─── Utility ───────────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ─── Typewriter hook ───────────────────────────────────────────────────────
function useTypewriter(phraseA, phraseB, {
  typeSpeed = 52, eraseSpeed = 28, pauseAfterA = 1800, pauseAfterB = 3200,
} = {}) {
  const [displayed, setDisplayed] = useState("");
  const [phase, setPhase] = useState("typing-a");
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
            setPhase("pause-a");
            timerRef.current = setTimeout(() => setPhase("erase-a"), pauseAfterA);
            return cur;
          }
          case "erase-a": {
            if (cur.length > 0) { timerRef.current = setTimeout(tick, eraseSpeed); return cur.slice(0, -1); }
            setPhase("typing-b"); timerRef.current = setTimeout(tick, typeSpeed); return "";
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
            if (cur.length > 0) { timerRef.current = setTimeout(tick, eraseSpeed); return cur.slice(0, -1); }
            setPhase("typing-a"); timerRef.current = setTimeout(tick, typeSpeed); return "";
          }
          default: return cur;
        }
      });
    }
    if (["typing-a","typing-b","erase-a","erase-b"].includes(phase)) {
      timerRef.current = setTimeout(tick, typeSpeed);
    }
    return clear;
  }, [phase, phraseA, phraseB, typeSpeed, eraseSpeed, pauseAfterA, pauseAfterB]);

  return { displayed };
}

// ─── Arc ring ──────────────────────────────────────────────────────────────
function ArcRing({ value, max, color, size = 46 }) {
  const pct  = max > 0 ? Math.min(value / max, 1) : 0;
  const r    = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  const cx   = size / 2;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="#1e1e1e" strokeWidth={3} />
      <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={3}
        strokeLinecap="round" strokeDasharray={`${dash} ${circ}`}
        style={{ filter: `drop-shadow(0 0 5px ${color}90)`, transition: "stroke-dasharray .8s cubic-bezier(.4,0,.2,1)" }} />
    </svg>
  );
}

// ─── Count-up ──────────────────────────────────────────────────────────────
function CountUp({ target }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const raw = String(target).replace(/[^0-9.]/g, "");
    const num = parseFloat(raw) || 0;
    const steps = 48; let step = 0;
    clearInterval(ref.current);
    ref.current = setInterval(() => {
      step++;
      const eased = 1 - Math.pow(1 - step / steps, 3);
      setDisplay(Math.round(num * eased));
      if (step >= steps) clearInterval(ref.current);
    }, 900 / steps);
    return () => clearInterval(ref.current);
  }, [target]);

  const prefix    = String(target).match(/^[^0-9]*/)?.[0] || "";
  const hasDec    = String(target).includes(".");
  const formatted = hasDec
    ? display.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : display.toLocaleString();
  return <span>{prefix}{formatted}</span>;
}

// ─── Metric Card ───────────────────────────────────────────────────────────
function MetricCard({ icon: Icon, label, value, subValue, trend, trendPositive, color = C.accent, ring, onClick }) {
  const [hov, setHov] = useState(false);
  const clickable = !!onClick;
  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        position: "relative", background: hov ? "#141414" : "#0f0f0f",
        border: `1px solid ${hov ? color + "45" : "#1d1d1d"}`, borderRadius: 18,
        padding: "22px 22px 18px", cursor: clickable ? "pointer" : "default",
        overflow: "hidden",
        transition: "border-color .2s, background .2s, transform .18s, box-shadow .2s",
        transform: hov && clickable ? "translateY(-3px)" : "none",
        boxShadow: hov ? `0 12px 40px ${color}18, 0 2px 12px #00000055` : "0 2px 8px #00000040",
        display: "flex", flexDirection: "column", minHeight: 158,
      }}>
      {/* Radial glow */}
      <div style={{ position: "absolute", top: -40, right: -40, width: 130, height: 130, borderRadius: "50%", background: `radial-gradient(circle, ${color}1e 0%, transparent 70%)`, pointerEvents: "none", opacity: hov ? 1 : 0.55, transition: "opacity .3s" }} />
      {/* Top shimmer */}
      <div style={{ position: "absolute", top: 0, left: 20, right: 20, height: 1, background: `linear-gradient(90deg, transparent, ${color}55, transparent)`, opacity: hov ? 1 : 0, transition: "opacity .25s" }} />

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: `${color}12`, border: `1px solid ${color}22`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: hov ? `0 0 14px ${color}28` : "none", transition: "box-shadow .2s" }}>
            <Icon size={16} color={color} strokeWidth={2} />
          </div>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: C.muted, letterSpacing: 1, textTransform: "uppercase" }}>{label}</span>
        </div>
        {ring
          ? <ArcRing value={ring.value} max={ring.max} color={color} size={46} />
          : <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, marginTop: 7, boxShadow: `0 0 10px ${color}`, animation: "adminMetricPulse 2s ease infinite" }} />
        }
      </div>

      <div style={{ fontSize: 34, fontWeight: 900, color: C.text, lineHeight: 1, letterSpacing: -2, fontVariantNumeric: "tabular-nums", marginBottom: 6 }}>
        <CountUp target={value} />
      </div>
      {subValue && <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>{subValue}</div>}
      <div style={{ flex: 1 }} />
      <div style={{ height: 1, background: "#1a1a1a", marginBottom: 12 }} />
      {trend
        ? <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {trendPositive ? <TrendingUp size={12} color={C.success} /> : <TrendingDown size={12} color={C.danger} />}
            <span style={{ fontSize: 11, fontWeight: 700, color: trendPositive ? C.success : C.danger }}>{trend}</span>
          </div>
        : <div style={{ height: 3, borderRadius: 2, background: `linear-gradient(90deg, ${color}, ${color}28)`, width: "45%" }} />
      }
    </div>
  );
}

// ─── Dashboard Overview ────────────────────────────────────────────────────
function DashboardOverview({ stats, onNavigate, onOpenOracle, team, adminData, dashboardCols, overviewPanelCols, quickActionCols, economyCols }) {
  const s         = stats || {};
  const openCases = s.openCases || 0;
  const firstName = (adminData?.full_name || "Admin").split(" ")[0];
  const phraseA   = `${getGreeting()}, ${firstName}.`;
  const phraseB   = "Welcome to the Command Center.";
  const { displayed } = useTypewriter(phraseA, phraseB);

  const QUICK_ACTIONS = [
    { label: "Review Cases",   icon: Headphones,  nav: "support",       color: C.accent    },
    { label: "Manage Users",   icon: Users,        nav: "users",         color: C.info      },
    { label: "Notifications",  icon: Bell,         nav: "notifications", color: C.warn      },
    { label: "Invites",        icon: Ticket,       nav: "invites",       color: "#8b5cf6"   },
    { label: "Analytics",      icon: BarChart3,    nav: "analytics",     color: C.success   },
    { label: "Ambassadors",    icon: Star,         nav: "ambassador",    color: "#f59e0b"   },
    { label: "Liquidity",      icon: Droplets,     nav: "liquidity",     color: "#38bdf8"   },
    { label: "Communities",    icon: Globe,        nav: "communities",   color: "#34d399"   },
    { label: "Transactions",   icon: CreditCard,   nav: "transactions",  color: "#a78bfa"   },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: C.text, margin: "0 0 6px 0", letterSpacing: -0.5, minHeight: 32, display: "flex", alignItems: "center", gap: 2 }}>
          {displayed}
          <span style={{ display: "inline-block", width: 2, height: 22, background: C.accent, borderRadius: 1, marginLeft: 3, boxShadow: `0 0 8px ${C.accent}`, animation: "adminCursorBlink .75s step-end infinite", verticalAlign: "middle" }} />
        </h1>
        <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Key Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: dashboardCols, gap: 14, marginBottom: 24 }}>
        <MetricCard icon={Users} label="Total Users"
          value={(s.totalUsers || 0).toLocaleString()} subValue={`+${s.newUsersToday || 0} today`}
          trend={s.newUsersWeek > 0 ? `+${s.newUsersWeek} this week` : undefined} trendPositive
          color={C.accent} ring={{ value: s.activeUsers || 0, max: s.totalUsers || 1 }} />
        <MetricCard icon={DollarSign} label="Revenue"
          value={`$${(s.totalRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subValue={`$${(s.revenueToday || 0).toFixed(2)} today`} color={C.success} />
        <MetricCard icon={Headphones} label="Open Cases" value={openCases}
          subValue={openCases > 10 ? "Needs attention" : openCases > 0 ? "In progress" : "All clear"}
          color={openCases > 10 ? C.danger : openCases > 0 ? C.warn : C.success}
          onClick={() => onNavigate("support")} />
        <MetricCard icon={Activity} label="Active Users"
          value={(s.activeUsers || 0).toLocaleString()} subValue="Total active accounts"
          color={C.info} ring={{ value: s.activeUsers || 0, max: s.totalUsers || 1 }} />
      </div>

      {/* Quick Actions + Online Team */}
      <div style={{ display: "grid", gridTemplateColumns: overviewPanelCols, gap: 16, marginBottom: 24 }}>
        <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 6 }}>Quick Actions</div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>Jump to any section instantly</div>
          <div style={{ display: "grid", gridTemplateColumns: quickActionCols, gap: 10 }}>
            {QUICK_ACTIONS.map((qa) => (
              <button key={qa.nav} onClick={() => onNavigate(qa.nav)}
                style={{ padding: "14px 10px", background: `${qa.color}08`, border: `1px solid ${qa.color}20`, borderRadius: 12, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, transition: "all .15s", fontFamily: "inherit" }}
                onMouseOver={(e) => { e.currentTarget.style.background = `${qa.color}16`; e.currentTarget.style.borderColor = `${qa.color}40`; }}
                onMouseOut={(e)  => { e.currentTarget.style.background = `${qa.color}08`; e.currentTarget.style.borderColor = `${qa.color}20`; }}>
                <qa.icon size={19} color={qa.color} />
                <span style={{ fontSize: 10, fontWeight: 600, color: C.text2 }}>{qa.label}</span>
              </button>
            ))}
            <button onClick={onOpenOracle}
              style={{ padding: "14px 10px", background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 12, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, transition: "all .15s", fontFamily: "inherit" }}
              onMouseOver={(e) => { e.currentTarget.style.background = "rgba(168,85,247,0.12)"; e.currentTarget.style.borderColor = "rgba(168,85,247,0.4)"; }}
              onMouseOut={(e) => { e.currentTarget.style.background = "rgba(168,85,247,0.08)"; e.currentTarget.style.borderColor = "rgba(168,85,247,0.2)"; }}>
              <span style={{ fontSize: 19, color: "#a855f7" }}>⛓</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: C.text2 }}>XRC Oracle</span>
            </button>
          </div>

          <div style={{ display: "flex", gap: 16, marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
            {[
              { label: "Suspended",      value: s.bannedUsers    || 0,                   color: C.danger },
              { label: "Active Invites", value: s.pendingInvites || 0,                   color: C.warn   },
              { label: "Content Pieces", value: (s.totalContent  || 0).toLocaleString(), color: C.info   },
            ].map((st) => (
              <div key={st.label} style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: st.color }}>{st.value}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{st.label}</div>
              </div>
            ))}
          </div>
        </div>
        <AdminOnlinePanel team={team} currentAdminUserId={adminData?.user_id} />
      </div>

      {/* Economy Metrics */}
      <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Economy Metrics</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Live EP & XEV ecosystem health · base EP grant: 50 per paying user</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 8, background: `${C.accent}08`, border: `1px solid ${C.accent}18` }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: C.accent, animation: "adminMetricPulse 2s ease infinite" }} />
            <span style={{ fontSize: 9, color: C.accent, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>Live</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: economyCols, gap: 12 }}>
          {[
            { label: "Circulating XEV", value: (s.totalXEVCirculating || 0).toLocaleString(), sub: "Active wallet balances", color: "#fbbf24", topColor: "#fbbf24" },
            { label: "Total XEV Minted", value: (s.totalXEVMinted || 0).toLocaleString(), sub: "All-time wallet credits", color: "#d4a017", topColor: "rgba(251,191,36,0.5)" },
            { label: "EP in Circulation", value: (s.totalEPCirculation || 0).toLocaleString(), sub: s.activeUsers > 0 ? `~${Math.round((s.totalEPCirculation || 0) / s.activeUsers)} avg/user` : "—", color: C.accent, topColor: C.accent },
            { label: "EP from Deposits", value: (s.epMintedOnDeposit || 0).toLocaleString(), sub: s.epMintedOnDeposit > 0 ? `≈$${((s.epMintedOnDeposit || 0) / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })} deposited` : "No deposits yet", color: "#34d399", topColor: "#34d399" },
          ].map((m) => (
            <div key={m.label} style={{ padding: "16px 14px", background: `${m.color}04`, border: `1px solid ${m.color}15`, borderRadius: 14, borderTop: `3px solid ${m.topColor}` }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: m.color, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8, opacity: 0.75 }}>{m.label}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: m.color, letterSpacing: -1, marginBottom: 4 }}>{m.value}</div>
              <div style={{ fontSize: 10, color: C.muted }}>{m.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 14, padding: "11px 14px", background: "rgba(132,204,22,0.04)", border: "1px solid rgba(132,204,22,0.1)", borderRadius: 11, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 10, color: C.muted, flex: 1 }}>
            <span style={{ color: C.text, fontWeight: 700 }}>Creator Revenue Sharing:</span>{" "}
            Silver 2% · Gold 5% · Diamond 10% of weekly ecosystem revenue ={" "}
            <span style={{ color: C.accent, fontWeight: 800 }}>17% returned to creators</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: C.accent, flexShrink: 0, textAlign: "right" }}>
            ${((s.totalRevenue || 0) * 0.17).toFixed(2)}
            <div style={{ fontSize: 9, color: C.muted, fontWeight: 600 }}>Est. creator pool</div>
          </div>
        </div>
      </div>

      {/* Ambassador Banner — Lucide Globe2, no emoji */}
      <div onClick={() => onNavigate("ambassador")}
        style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.07) 0%, rgba(251,191,36,0.03) 100%)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 16, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", transition: "border-color .2s, background .2s" }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(245,158,11,0.4)"; e.currentTarget.style.background = "linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(251,191,36,0.05) 100%)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(245,158,11,0.2)"; e.currentTarget.style.background = "linear-gradient(135deg, rgba(245,158,11,0.07) 0%, rgba(251,191,36,0.03) 100%)"; }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Globe2 size={22} color="#f59e0b" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 2 }}>Ambassador Program</div>
          <div style={{ fontSize: 11, color: C.muted }}>Users earn commissions by referring new members · 8% → 20% based on monthly volume · gamified level system</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, color: "#f59e0b", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
          Manage <ChevronRight size={14} />
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar ───────────────────────────────────────────────────────────────
function AdminSidebarNav({ adminData, activeSection, onNavigate, stats, collapsed, onToggle }) {
  const visibleSections = getVisibleSections(adminData);
  const roleMeta        = ROLE_META[adminData?.role] || ROLE_META.support;
  const openCases       = stats?.openCases || 0;
  const navItems        = NAV_ITEMS.filter((item) => visibleSections.includes(item.id));

  let lastGroup = null;

  return (
    <div style={{ width: collapsed ? 60 : 222, flexShrink: 0, background: C.bg1, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", transition: "width .2s ease", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ padding: collapsed ? "16px 0" : "16px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10, justifyContent: collapsed ? "center" : "space-between" }}>
        {!collapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: `linear-gradient(135deg, ${C.accent}, ${C.accent3})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Zap size={14} color="#000" />
            </div>
            <span style={{ fontSize: 13, fontWeight: 900, color: C.text, letterSpacing: -0.3 }}>XEEVIA</span>
          </div>
        )}
        <button onClick={onToggle} style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${C.border2}`, background: C.bg3, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, flexShrink: 0 }}>
          {collapsed ? <Menu size={13} /> : <X size={13} />}
        </button>
      </div>

      {/* Admin identity */}
      {!collapsed && (
        <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: `${roleMeta.color}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: roleMeta.color }}>
              {(adminData?.full_name || "A").charAt(0).toUpperCase()}
            </div>
            <div style={{ overflow: "hidden" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {adminData?.full_name || "Admin"}
              </div>
              <div style={{ fontSize: 9, fontWeight: 600, color: roleMeta.color }}>
                {roleMeta.label}
                {adminData?.xa_id && (
                  <span style={{ marginLeft: 5, fontFamily: "monospace", opacity: 0.8 }}>
                    XA-{String(adminData.xa_id).padStart(2, "0")}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, padding: "6px 0", overflowY: "auto" }}>
        {navItems.map((item) => {
          const isActive   = activeSection === item.id;
          const badge      = item.badge === "cases" ? openCases : null;
          const showBadge  = badge && badge > 0;
          const groupLabel = !collapsed ? NAV_GROUPS[item.id] : null;
          const showGroup  = groupLabel && groupLabel !== lastGroup;
          if (showGroup) lastGroup = groupLabel;

          return (
            <React.Fragment key={item.id}>
              {showGroup && (
                <div style={{ padding: "10px 14px 3px", fontSize: 9, fontWeight: 800, color: C.muted2, textTransform: "uppercase", letterSpacing: "1.5px" }}>
                  {groupLabel}
                </div>
              )}
              <button onClick={() => onNavigate(item.id)} title={collapsed ? item.label : undefined}
                style={{ width: "100%", padding: collapsed ? "9px 0" : "8px 12px", display: "flex", alignItems: "center", gap: 9, justifyContent: collapsed ? "center" : "flex-start", background: isActive ? `${C.accent}12` : "transparent", border: "none", borderLeft: isActive ? `2px solid ${C.accent}` : "2px solid transparent", cursor: "pointer", color: isActive ? C.accent : C.muted, fontFamily: "inherit", fontSize: 12, fontWeight: isActive ? 700 : 500, transition: "all .12s", position: "relative" }}
                onMouseOver={(e) => { if (!isActive) { e.currentTarget.style.color = C.text2; e.currentTarget.style.background = `${C.border}40`; } }}
                onMouseOut={(e)  => { if (!isActive) { e.currentTarget.style.color = C.muted; e.currentTarget.style.background = "transparent"; } }}>
                <item.icon size={15} style={{ flexShrink: 0 }} />
                {!collapsed && <span style={{ flex: 1, textAlign: "left" }}>{item.label}</span>}
                {!collapsed && showBadge && (
                  <span style={{ minWidth: 18, height: 18, borderRadius: 9, background: badge > 10 ? C.danger : C.warn, color: "#fff", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
                {collapsed && showBadge && (
                  <div style={{ position: "absolute", top: 5, right: 8, width: 7, height: 7, borderRadius: "50%", background: badge > 10 ? C.danger : C.warn }} />
                )}
              </button>
            </React.Fragment>
          );
        })}
      </nav>

      {!collapsed && (
        <div style={{ padding: "10px 14px", borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 9, color: C.muted2, textAlign: "center" }}>Xeevia Admin v2.0</div>
        </div>
      )}
    </div>
  );
}

// ─── Main export ───────────────────────────────────────────────────────────
export default function AdminDashboard({ adminData, onClose, xrcService }) {
  const [activeSection,    setActiveSection]    = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileAdmin,    setIsMobileAdmin]    = useState(false);
  const [showOracle,       setShowOracle]       = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobileAdmin(window.innerWidth <= 900);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const { stats, reload: reloadStats } = useStats();
  const usersHook         = useUsers();
  const invitesHook       = useInvites();
  const analyticsHook     = useAnalytics();
  const securityHook      = useSecurity();
  const notificationsHook = useNotifications();
  const freezeHook        = usePlatformFreeze();
  const platformSettings  = usePlatformSettings();
  const teamHook          = useTeam();
  const casesHook         = useSupportCases();

  const navigate = useCallback((section) => {
    setActiveSection(section);
    window.scrollTo(0, 0);
  }, []);

  const dashboardCols = isMobileAdmin ? "1fr" : "repeat(4, 1fr)";
  const quickActionCols = isMobileAdmin ? "repeat(2, 1fr)" : "repeat(3, 1fr)";
  const economyCols = isMobileAdmin ? "1fr" : "repeat(4, 1fr)";
  const overviewPanelCols = isMobileAdmin ? "1fr" : "1fr 300px";
  const contentPadding = isMobileAdmin ? "16px 16px 24px" : "24px 28px";

  const supportMgmt = {
    cases:        casesHook.cases || [],
    loading:      casesHook.loading,
    load:         casesHook.reload,
    resolveCase:  async (id, note, ad) =>
      casesHook.resolveCase(id, { adminName: ad?.full_name, adminId: ad?.user_id || ad?.id, action: "resolved", note }),
    assignCase:   async (id, memberId, memberName) =>
      casesHook.assignCase(id, { adminId: memberId, adminName: memberName }),
    addNote:      async (id, text, ad) =>
      casesHook.addNote(id, { text, adminName: ad?.full_name, adminId: ad?.user_id || ad?.id }),
    getCase:      async (id) => casesHook.cases.find((c) => c.id === id) || null,
    createCase:   async (caseData) => casesHook.createSupportCase(caseData),
    escalateCase: async (id) => casesHook.updateCase(id, { status: "escalated", escalated_at: new Date().toISOString() }),
  };

  const teamMgmt = {
    team:              teamHook.team || [],
    loading:           teamHook.loading,
    load:              teamHook.load,
    addMember:         teamHook.addMember,
    removeMember:      teamHook.removeMember,
    updatePermissions: teamHook.updatePermissions,
    updateRole:        teamHook.updateRole,
  };

  const renderSection = () => {
    switch (activeSection) {
      case "dashboard":
        return <DashboardOverview
          stats={stats}
          onNavigate={navigate}
          onOpenOracle={() => setShowOracle(true)}
          team={teamHook.team || []}
          adminData={adminData}
          dashboardCols={dashboardCols}
          overviewPanelCols={overviewPanelCols}
          quickActionCols={quickActionCols}
          economyCols={economyCols}
        />;

      case "support":
        return <SupportSection adminData={adminData} supportMgmt={supportMgmt} teamMgmt={teamMgmt} />;

      case "users":
        // UsersSection (OtherSections version) — receives usersHook
        return <UsersSection adminData={adminData} usersHook={usersHook} />;

      case "invites":
        return <InviteSection adminData={adminData} invitesHook={invitesHook} />;

      case "analytics":
        return <AnalyticsSection adminData={adminData} stats={stats} onRefresh={analyticsHook.reload} />;

      case "transactions":
        // TransactionsSection uses its own internal useTransactions() — only needs adminData
        return <TransactionsSection adminData={adminData} />;

      case "communities":
        // CommunitiesSection uses its own internal useCommunities() — only needs adminData
        return <CommunitiesSection adminData={adminData} />;

      case "security":
        return (
          <SecuritySection adminData={adminData} secData={{
            recentEvents:       securityHook.events || [],
            suspiciousAccounts: securityHook.lockedAccounts || [],
            load:               securityHook.reload,
            unlockAccount:      securityHook.resolveEvent,
          }} />
        );

      case "notifications":
        return (
          <NotificationsSection
            adminData={adminData}
            platformSettings={platformSettings}
            broadcaster={{
              send: (notif) => notificationsHook.send({
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

      case "liquidity":
        // LiquiditySection uses its own Supabase calls + liquidityService — only needs adminData
        return <LiquiditySection adminData={adminData} />;

      case "team":
        return <TeamSection adminData={adminData} teamMgmt={teamMgmt} />;

      case "ambassador":
        return <AmbassadorSection adminData={adminData} />;

      case "ceo":
        return <CEOPanel adminData={adminData} stats={stats} teamMgmt={teamMgmt} platformSettings={platformSettings} />;

      default:
        return <div style={{ padding: 40, color: C.muted, textAlign: "center" }}>Section not found</div>;
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw", background: C.bg, fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif", color: C.text, overflow: "hidden", position: "fixed", top: 0, left: 0, zIndex: 10000 }}>
      <AdminSidebarNav adminData={adminData} activeSection={activeSection} onNavigate={navigate} stats={stats} collapsed={sidebarCollapsed || isMobileAdmin} onToggle={() => setSidebarCollapsed((c) => !c)} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        {/* Top bar */}
        <div style={{ height: 50, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", padding: "0 20px", gap: 12, background: C.bg1, flexShrink: 0 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: C.muted }}>Admin</span>
            <ChevronRight size={11} color={C.muted} />
            <span style={{ fontSize: 12, fontWeight: 700, color: C.text2, textTransform: "capitalize" }}>
              {activeSection.replace(/_/g, " ")}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <LivePulse label="Live" size={6} />
            <Btn icon={RefreshCw} size="sm" onClick={reloadStats} title="Refresh stats" />
            {onClose && <Btn icon={X} size="sm" onClick={onClose} title="Back to app" />}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: contentPadding }}>
          {renderSection()}
        </div>
      </div>

      {showOracle && (
        <ServicesModal
          onClose={() => setShowOracle(false)}
          setActiveTab={() => {}}
          currentUser={{ id: adminData?.user_id || adminData?.id, username: adminData?.username || adminData?.email }}
          xrcService={xrcService}
        />
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e1e1e; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #2a2a2a; }
        @keyframes adminCursorBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes adminMetricPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
      `}</style>
    </div>
  );
}