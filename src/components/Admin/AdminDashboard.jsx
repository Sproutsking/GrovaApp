// ============================================================================
// src/components/Admin/AdminDashboard.jsx — v6 ISOLATED POWERHOUSE
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
// ONLINE MEMBERS: Correctly uses m.user_id (profile UUID) for comparison.
// DATA: 100% real DB data, zero mock data. If data is missing, it's RLS.
//       See: database-rls-policies.sql for the correct policy setup.
// ============================================================================

import React, { useState, useCallback } from "react";
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
} from "lucide-react";
import {
  C,
  Btn,
  Alert,
  MetricCard,
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
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "support", label: "Support", icon: Headphones, badge: "cases" },
  { id: "users", label: "Users", icon: Users },
  { id: "invites", label: "Invites", icon: Ticket },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "transactions", label: "Transactions", icon: CreditCard },
  { id: "communities", label: "Communities", icon: Globe },
  { id: "security", label: "Security", icon: Shield },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "system", label: "System", icon: Settings },
  { id: "team", label: "Team", icon: Users2 },
  { id: "ceo", label: "CEO Panel", icon: Crown },
];

// ─── Dashboard Overview ────────────────────────────────────────────────────
function DashboardOverview({ stats, onNavigate, team, adminData }) {
  const s = stats || {};
  const openCases = s.openCases || 0;

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 6,
          }}
        >
          <LivePulse color={C.accent} label="Live" />
          <h1
            style={{
              fontSize: 24,
              fontWeight: 900,
              color: C.text,
              margin: 0,
              letterSpacing: -0.5,
            }}
          >
            Command Center
          </h1>
        </div>
        <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>
          Welcome back, {adminData?.full_name || "Admin"}. Here's what's
          happening.
        </p>
      </div>

      {/* Key Metrics */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 14,
          marginBottom: 24,
        }}
      >
        <MetricCard
          icon={Users}
          label="Total Users"
          value={(s.totalUsers || 0).toLocaleString()}
          subValue={`+${s.newUsersToday || 0} today`}
          trend={
            s.newUsersWeek > 0 ? `+${s.newUsersWeek} this week` : undefined
          }
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
            openCases > 10
              ? "Needs attention"
              : openCases > 0
                ? "In progress"
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

      {/* Quick Actions + Online Team */}
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16 }}
      >
        <div
          style={{
            background: C.bg2,
            border: `1px solid ${C.border}`,
            borderRadius: 16,
            padding: 20,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: C.text,
              marginBottom: 16,
            }}
          >
            Quick Actions
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 10,
            }}
          >
            {[
              {
                label: "Review Cases",
                icon: Headphones,
                nav: "support",
                color: C.accent,
              },
              {
                label: "Manage Users",
                icon: Users,
                nav: "users",
                color: C.info,
              },
              {
                label: "Send Notif.",
                icon: Bell,
                nav: "notifications",
                color: C.warn,
              },
              {
                label: "Invites",
                icon: Ticket,
                nav: "invites",
                color: C.purple,
              },
              {
                label: "Analytics",
                icon: BarChart3,
                nav: "analytics",
                color: C.success,
              },
              {
                label: "Security",
                icon: Shield,
                nav: "security",
                color: C.danger,
              },
            ].map((qa) => (
              <button
                key={qa.nav}
                onClick={() => onNavigate(qa.nav)}
                style={{
                  padding: "14px 12px",
                  background: `${qa.color}08`,
                  border: `1px solid ${qa.color}25`,
                  borderRadius: 12,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                  transition: "all .15s",
                  fontFamily: "inherit",
                }}
                onMouseOver={(e) =>
                  (e.currentTarget.style.background = `${qa.color}15`)
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.background = `${qa.color}08`)
                }
              >
                <qa.icon size={20} color={qa.color} />
                <span style={{ fontSize: 11, fontWeight: 600, color: C.text2 }}>
                  {qa.label}
                </span>
              </button>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              gap: 16,
              marginTop: 20,
              paddingTop: 16,
              borderTop: `1px solid ${C.border}`,
            }}
          >
            {[
              {
                label: "Suspended",
                value: s.bannedUsers || 0,
                color: C.danger,
              },
              {
                label: "Active Invites",
                value: s.pendingInvites || 0,
                color: C.warn,
              },
              {
                label: "Content Pieces",
                value: (s.totalContent || 0).toLocaleString(),
                color: C.info,
              },
            ].map((st) => (
              <div key={st.label} style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: st.color }}>
                  {st.value}
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  {st.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AdminOnlinePanel: currentAdminUserId MUST be the profile UUID (user_id) */}
        <AdminOnlinePanel team={team} currentAdminUserId={adminData?.user_id} />
      </div>
    </div>
  );
}

// ─── Sidebar ───────────────────────────────────────────────────────────────
function AdminSidebarNav({
  adminData,
  activeSection,
  onNavigate,
  stats,
  collapsed,
  onToggle,
}) {
  const visibleSections = getVisibleSections(adminData);
  const roleMeta = ROLE_META[adminData?.role] || ROLE_META.support;
  const openCases = stats?.openCases || 0;
  const navItems = NAV_ITEMS.filter((item) =>
    visibleSections.includes(item.id),
  );

  return (
    <div
      style={{
        width: collapsed ? 64 : 220,
        flexShrink: 0,
        background: C.bg1,
        borderRight: `1px solid ${C.border}`,
        display: "flex",
        flexDirection: "column",
        transition: "width .2s ease",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: collapsed ? "18px 0" : "18px 16px",
          borderBottom: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "center",
          gap: 10,
          justifyContent: collapsed ? "center" : "space-between",
        }}
      >
        {!collapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                background: `linear-gradient(135deg, ${C.accent}, ${C.accent3})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Zap size={14} color="#000" />
            </div>
            <span
              style={{
                fontSize: 13,
                fontWeight: 900,
                color: C.text,
                letterSpacing: -0.3,
              }}
            >
              XEEVIA
            </span>
          </div>
        )}
        <button
          onClick={onToggle}
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            border: `1px solid ${C.border2}`,
            background: C.bg3,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: C.muted,
            flexShrink: 0,
          }}
        >
          {collapsed ? <Menu size={14} /> : <X size={14} />}
        </button>
      </div>

      {/* Admin identity */}
      {!collapsed && (
        <div
          style={{
            padding: "12px 16px",
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                flexShrink: 0,
                background: `${roleMeta.color}20`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 800,
                color: roleMeta.color,
              }}
            >
              {(adminData?.full_name || "A").charAt(0).toUpperCase()}
            </div>
            <div style={{ overflow: "hidden" }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: C.text,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {adminData?.full_name || "Admin"}
              </div>
              <div
                style={{ fontSize: 10, fontWeight: 600, color: roleMeta.color }}
              >
                {roleMeta.label}
                {adminData?.xa_id && (
                  <span
                    style={{
                      marginLeft: 6,
                      fontFamily: "monospace",
                      opacity: 0.8,
                    }}
                  >
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
          const isActive = activeSection === item.id;
          const badge = item.badge === "cases" ? openCases : null;
          const showBadge = badge && badge > 0;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              title={collapsed ? item.label : undefined}
              style={{
                width: "100%",
                padding: collapsed ? "10px 0" : "9px 14px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                justifyContent: collapsed ? "center" : "flex-start",
                background: isActive ? `${C.accent}12` : "transparent",
                border: "none",
                borderLeft: isActive
                  ? `2px solid ${C.accent}`
                  : "2px solid transparent",
                cursor: "pointer",
                color: isActive ? C.accent : C.muted,
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                transition: "all .12s",
                position: "relative",
              }}
              onMouseOver={(e) => {
                if (!isActive) e.currentTarget.style.color = C.text2;
              }}
              onMouseOut={(e) => {
                if (!isActive) e.currentTarget.style.color = C.muted;
              }}
            >
              <item.icon size={16} style={{ flexShrink: 0 }} />
              {!collapsed && (
                <span style={{ flex: 1, textAlign: "left" }}>{item.label}</span>
              )}
              {!collapsed && showBadge && (
                <span
                  style={{
                    minWidth: 18,
                    height: 18,
                    borderRadius: 9,
                    background: badge > 10 ? C.danger : C.warn,
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 5px",
                  }}
                >
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
              {collapsed && showBadge && (
                <div
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 10,
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: badge > 10 ? C.danger : C.warn,
                  }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {!collapsed && (
        <div
          style={{ padding: "12px 16px", borderTop: `1px solid ${C.border}` }}
        >
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
  const [activeSection, setActiveSection] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // All data hooks — completely self-contained, isolated from app hooks
  const { stats, loading: statsLoading, reload: reloadStats } = useStats();
  const usersHook = useUsers();
  const invitesHook = useInvites();
  const analyticsHook = useAnalytics();
  const transactionsHook = useTransactions();
  const securityHook = useSecurity();
  const notificationsHook = useNotifications();
  const communitiesHook = useCommunities();
  const freezeHook = usePlatformFreeze();
  const platformSettings = usePlatformSettings();
  const teamHook = useTeam();
  const casesHook = useSupportCases();

  const navigate = useCallback((section) => {
    setActiveSection(section);
    window.scrollTo(0, 0);
  }, []);

  // ── Support management ───────────────────────────────────────────────────
  const supportMgmt = {
    cases: casesHook.cases || [],
    loading: casesHook.loading,
    load: casesHook.reload,
    resolveCase: async (id, note, ad) => {
      await casesHook.resolveCase(id, {
        adminName: ad?.full_name,
        adminId: ad?.user_id || ad?.id,
        action: "resolved",
        note,
      });
    },
    assignCase: async (id, memberId, memberName) => {
      await casesHook.assignCase(id, {
        adminId: memberId,
        adminName: memberName,
      });
    },
    addNote: async (id, text, ad) => {
      await casesHook.addNote(id, {
        text,
        adminName: ad?.full_name,
        adminId: ad?.user_id || ad?.id,
      });
    },
    getCase: async (id) => casesHook.cases.find((c) => c.id === id) || null,
    createCase: async (caseData) => {
      await casesHook.createSupportCase(caseData);
    },
    escalateCase: async (id) => {
      await casesHook.updateCase(id, {
        status: "escalated",
        escalated_at: new Date().toISOString(),
      });
    },
  };

  // ── Team management ──────────────────────────────────────────────────────
  const teamMgmt = {
    team: teamHook.team || [],
    loading: teamHook.loading,
    load: teamHook.load,
    addMember: teamHook.addMember,
    removeMember: teamHook.removeMember,
    updatePermissions: teamHook.updatePermissions,
    updateRole: teamHook.updateRole,
  };

  // ── User management ──────────────────────────────────────────────────────
  const userMgmt = {
    banUser: usersHook.banUser,
    unbanUser: usersHook.unbanUser,
    deleteUser: usersHook.deleteUser,
    restoreUser: usersHook.restoreUser,
    verifyUser: usersHook.verifyUser,
    setUserTier: usersHook.setUserTier,
    adjustWallet: usersHook.adjustWallet,
  };

  // ── Section renderer ─────────────────────────────────────────────────────
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
        return (
          <InviteSection adminData={adminData} invitesHook={invitesHook} />
        );
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
              recentEvents: securityHook.events || [],
              suspiciousAccounts: securityHook.lockedAccounts || [],
              load: securityHook.reload,
              unlockAccount: securityHook.resolveEvent,
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
                  sentById: adminData?.user_id || adminData?.id,
                }),
            }}
          />
        );
      case "system":
        return (
          <div>
            <SystemSection
              adminData={adminData}
              platformSettings={platformSettings}
            />
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
        display: "flex",
        height: "100vh",
        width: "100vw",
        background: C.bg,
        fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif",
        color: C.text,
        overflow: "hidden",
        // Fixed overlay — sits completely above the app
        // App sections cannot interact with or affect this element
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 10000,
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

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          minWidth: 0,
        }}
      >
        {/* Top bar */}
        <div
          style={{
            height: 52,
            borderBottom: `1px solid ${C.border}`,
            display: "flex",
            alignItems: "center",
            padding: "0 20px",
            gap: 12,
            background: C.bg1,
            flexShrink: 0,
          }}
        >
          <div
            style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}
          >
            <span style={{ fontSize: 12, color: C.muted }}>Admin</span>
            <ChevronRight size={12} color={C.muted} />
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: C.text2,
                textTransform: "capitalize",
              }}
            >
              {activeSection.replace(/_/g, " ")}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <LivePulse label="Live" size={6} />
            <Btn
              icon={RefreshCw}
              size="sm"
              onClick={reloadStats}
              title="Refresh stats"
            />
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
      `}</style>
    </div>
  );
}