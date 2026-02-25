// ============================================================================
// src/components/Admin/sections/OtherSections.jsx
// ============================================================================
//
// PROP CONTRACT — matches exactly what AdminDashboard.jsx passes:
//
//   UsersSection:        { adminData, usersHook }
//   AnalyticsSection:    { adminData, stats, onRefresh }
//   TransactionsSection: { adminData, txMgmt }
//   SecuritySection:     { adminData, secData }
//   NotificationsSection:{ adminData, broadcaster }
//   CommunitiesSection:  { adminData, contentMgmt }
//
// ISOLATED: This file imports its own data via useTable/hooks.
// No shared state with App.jsx or AuthContext.
// ============================================================================

import React, { useState, useCallback } from "react";
import {
  CheckCircle2,
  Trash2,
  Edit2,
  RefreshCw,
  DollarSign,
  Star,
  Eye,
  Unlock,
  UserX,
  UserCheck,
  Wallet,
  BarChart3,
  CreditCard,
  Globe,
  Shield,
  Bell,
  TrendingUp,
  AlertTriangle,
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
} from "../useAdminData.js";

// ============================================================================
// USERS SECTION
// ============================================================================

export function UsersSection({ adminData, usersHook }) {
  // Accept usersHook directly from AdminDashboard
  const {
    users,
    total,
    page,
    setPage,
    loading,
    search,
    setSearch,
    reload: refresh,
    pageSize = 20,
    banUser,
    unbanUser,
    deleteUser,
    restoreUser,
    verifyUser,
    setUserTier,
    adjustWallet,
  } = usersHook;

  const [filter, setFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState(null);
  const [actionModal, setActionModal] = useState(null);
  const [adjustForm, setAdjustForm] = useState({
    tokens: 0,
    points: 0,
    reason: "",
  });
  const [tierValue, setTierValue] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionAlert, setActionAlert] = useState(null);
  const [banReason, setBanReason] = useState("");

  const canEdit = can(adminData, PERMISSIONS.EDIT_USERS);
  const canBan = can(adminData, PERMISSIONS.BAN_USERS);
  const canDelete = can(adminData, PERMISSIONS.DELETE_USERS);
  const canRestore = can(adminData, PERMISSIONS.RESTORE_USERS);
  const canAdjustWallet = can(adminData, PERMISSIONS.ADJUST_BALANCE);

  const doAction = async (fn) => {
    setActionLoading(true);
    setActionAlert(null);
    try {
      await fn();
      setActionModal(null);
      refresh();
      setActionAlert({ type: "success", msg: "Action completed." });
    } catch (e) {
      setActionAlert({ type: "error", msg: e.message });
    } finally {
      setActionLoading(false);
    }
  };

  const filterOptions = [
    { value: "all", label: "All Users" },
    { value: "active", label: "Active" },
    { value: "suspended", label: "Suspended" },
    { value: "deleted", label: "Deleted" },
    { value: "pro", label: "Pro" },
    { value: "vip", label: "VIP" },
    { value: "unverified", label: "Unverified" },
  ];

  const columns = [
    {
      label: "User",
      render: (u) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar
            name={u.full_name}
            size={34}
            color={u.verified ? C.accent : C.muted}
          />
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: C.text,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              {u.full_name}
              {u.verified && <CheckCircle2 size={12} color={C.accent} />}
              {u.is_pro && <Star size={12} color="#f59e0b" />}
            </div>
            <div style={{ fontSize: 11, color: C.muted }}>@{u.username}</div>
          </div>
        </div>
      ),
    },
    {
      label: "Email",
      render: (u) => (
        <span style={{ fontSize: 12, color: C.muted }}>{u.email}</span>
      ),
    },
    {
      label: "Status",
      render: (u) => <StatusBadge status={u.account_status} />,
    },
    {
      label: "Tier",
      render: (u) => <StatusBadge status={u.subscription_tier || "free"} />,
    },
    {
      label: "Points",
      render: (u) => (
        <span style={{ color: C.accent, fontWeight: 700 }}>
          {(u.engagement_points || 0).toLocaleString()}
        </span>
      ),
    },
    {
      label: "Joined",
      render: (u) => (
        <span style={{ fontSize: 12, color: C.muted }}>
          {new Date(u.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      label: "Actions",
      render: (u) => (
        <div style={{ display: "flex", gap: 4 }}>
          <Btn
            icon={Eye}
            size="sm"
            onClick={() => setSelectedUser(u)}
            title="View profile"
          />
          {canBan && u.account_status === "active" && (
            <Btn
              icon={UserX}
              size="sm"
              danger
              onClick={() => setActionModal({ type: "ban", user: u })}
              title="Suspend"
            />
          )}
          {canBan && u.account_status === "suspended" && (
            <Btn
              icon={UserCheck}
              size="sm"
              onClick={() => setActionModal({ type: "unban", user: u })}
              title="Unsuspend"
            />
          )}
          {canEdit && (
            <Btn
              icon={Edit2}
              size="sm"
              onClick={() => {
                setSelectedUser(u);
                setTierValue(u.subscription_tier || "free");
              }}
              title="Edit"
            />
          )}
          {canDelete && !u.deleted_at && (
            <Btn
              icon={Trash2}
              size="sm"
              danger
              onClick={() => setActionModal({ type: "delete", user: u })}
              title="Delete"
            />
          )}
          {canRestore && u.deleted_at && (
            <Btn
              icon={Unlock}
              size="sm"
              onClick={() => setActionModal({ type: "restore", user: u })}
              title="Restore"
            />
          )}
          {canAdjustWallet && (
            <Btn
              icon={Wallet}
              size="sm"
              onClick={() => {
                setActionModal({ type: "wallet", user: u });
                setAdjustForm({ tokens: 0, points: 0, reason: "" });
              }}
              title="Adjust wallet"
            />
          )}
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
            User Management
          </h1>
          <p style={{ color: C.muted, marginTop: 4, fontSize: 14 }}>
            {total.toLocaleString()} total users
          </p>
        </div>
        <Btn icon={RefreshCw} label="Refresh" onClick={refresh} />
      </div>

      {actionAlert && (
        <Alert
          type={actionAlert.type}
          message={actionAlert.msg}
          onClose={() => setActionAlert(null)}
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
            placeholder="Search name, email, username…"
          />
          <Select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            options={filterOptions}
          />
        </div>
        <DataTable
          columns={columns}
          rows={users}
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

      {/* User Detail Modal */}
      <Modal
        open={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title="User Profile"
        width={560}
      >
        {selectedUser && (
          <div>
            <div
              style={{
                display: "flex",
                gap: 14,
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <Avatar
                name={selectedUser.full_name}
                size={56}
                color={selectedUser.verified ? C.accent : C.muted}
              />
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>
                  {selectedUser.full_name}
                </div>
                <div style={{ fontSize: 13, color: C.muted }}>
                  @{selectedUser.username} · {selectedUser.email}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <StatusBadge status={selectedUser.account_status} />
                  <StatusBadge
                    status={selectedUser.subscription_tier || "free"}
                  />
                  {selectedUser.verified && (
                    <Badge label="Verified" color={C.accent} />
                  )}
                </div>
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginBottom: 20,
              }}
            >
              {[
                [
                  "Joined",
                  new Date(selectedUser.created_at).toLocaleDateString(),
                ],
                [
                  "Last Seen",
                  selectedUser.last_seen
                    ? new Date(selectedUser.last_seen).toLocaleDateString()
                    : "—",
                ],
                [
                  "Engagement Points",
                  (selectedUser.engagement_points || 0).toLocaleString(),
                ],
                ["Payment Status", selectedUser.payment_status || "—"],
              ].map(([k, v]) => (
                <div
                  key={k}
                  style={{
                    padding: "10px 12px",
                    background: C.bg3,
                    borderRadius: 8,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: C.muted,
                      textTransform: "uppercase",
                      letterSpacing: ".06em",
                    }}
                  >
                    {k}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: C.text,
                      fontWeight: 600,
                      marginTop: 2,
                    }}
                  >
                    {v}
                  </div>
                </div>
              ))}
            </div>
            {canEdit && (
              <div>
                <Field label="Change Subscription Tier">
                  <div style={{ display: "flex", gap: 8 }}>
                    <Select
                      value={tierValue}
                      onChange={(e) => setTierValue(e.target.value)}
                      options={[
                        { value: "free", label: "Free" },
                        { value: "whitelist", label: "Whitelist" },
                        { value: "standard", label: "Standard" },
                        { value: "pro", label: "Pro" },
                        { value: "vip", label: "VIP" },
                      ]}
                    />
                    <Btn
                      label="Apply"
                      variant="primary"
                      loading={actionLoading}
                      onClick={() =>
                        doAction(() => setUserTier(selectedUser.id, tierValue))
                      }
                    />
                  </div>
                </Field>
                <Btn
                  label={selectedUser.verified ? "Unverify" : "Verify"}
                  icon={CheckCircle2}
                  variant={selectedUser.verified ? "secondary" : "primary"}
                  onClick={() =>
                    doAction(() =>
                      verifyUser(selectedUser.id, !selectedUser.verified),
                    )
                  }
                />
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Ban Modal */}
      <Modal
        open={actionModal?.type === "ban"}
        onClose={() => setActionModal(null)}
        title={`Suspend ${actionModal?.user?.full_name}`}
        danger
        width={440}
        footer={
          <>
            <Btn label="Cancel" onClick={() => setActionModal(null)} />
            <Btn
              label="Suspend User"
              danger
              loading={actionLoading}
              onClick={() =>
                doAction(() => banUser(actionModal.user.id, banReason))
              }
            />
          </>
        }
      >
        <Alert
          type="warn"
          message="Suspending blocks the user from accessing Xeevia."
        />
        <Field label="Reason for suspension">
          <Input
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
            placeholder="e.g. Repeated violations, spam…"
            rows={3}
          />
        </Field>
      </Modal>

      <ConfirmDialog
        open={actionModal?.type === "unban"}
        onClose={() => setActionModal(null)}
        title="Unsuspend User"
        message={`Restore access for ${actionModal?.user?.full_name}?`}
        confirmLabel="Unsuspend"
        onConfirm={() => doAction(() => unbanUser(actionModal.user.id))}
      />

      <ConfirmDialog
        open={actionModal?.type === "delete"}
        onClose={() => setActionModal(null)}
        title="Delete User Account"
        danger
        message={`Soft-delete ${actionModal?.user?.full_name}? Data is retained.`}
        confirmLabel="Delete Account"
        onConfirm={() => doAction(() => deleteUser(actionModal.user.id))}
      />

      <ConfirmDialog
        open={actionModal?.type === "restore"}
        onClose={() => setActionModal(null)}
        title="Restore Account"
        message={`Restore ${actionModal?.user?.full_name}'s account?`}
        confirmLabel="Restore"
        onConfirm={() => doAction(() => restoreUser(actionModal.user.id))}
      />

      <Modal
        open={actionModal?.type === "wallet"}
        onClose={() => setActionModal(null)}
        title={`Adjust Wallet — ${actionModal?.user?.full_name}`}
        width={440}
        footer={
          <>
            <Btn label="Cancel" onClick={() => setActionModal(null)} />
            <Btn
              label="Apply Adjustment"
              variant="primary"
              loading={actionLoading}
              onClick={() =>
                doAction(() =>
                  adjustWallet(
                    actionModal.user.id,
                    parseInt(adjustForm.tokens) || 0,
                    parseInt(adjustForm.points) || 0,
                    adjustForm.reason,
                    adminData.user_id,
                  ),
                )
              }
            />
          </>
        }
      >
        <Alert
          type="warn"
          message="Use positive values to credit, negative to debit."
        />
        <Field label="Token Delta (Grova Tokens)">
          <Input
            value={adjustForm.tokens}
            onChange={(e) =>
              setAdjustForm({ ...adjustForm, tokens: e.target.value })
            }
            type="number"
          />
        </Field>
        <Field label="Points Delta (Engagement Points)">
          <Input
            value={adjustForm.points}
            onChange={(e) =>
              setAdjustForm({ ...adjustForm, points: e.target.value })
            }
            type="number"
          />
        </Field>
        <Field label="Reason" required>
          <Input
            value={adjustForm.reason}
            onChange={(e) =>
              setAdjustForm({ ...adjustForm, reason: e.target.value })
            }
            placeholder="e.g. Bonus for beta testing"
          />
        </Field>
      </Modal>
    </div>
  );
}

// ============================================================================
// ANALYTICS SECTION
// ============================================================================

export function AnalyticsSection({ adminData, stats, onRefresh }) {
  const s = stats || {};
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
        <Btn icon={RefreshCw} label="Refresh" onClick={onRefresh} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 14,
          marginBottom: 24,
        }}
      >
        {[
          {
            label: "Total Users",
            value: (s.totalUsers || 0).toLocaleString(),
            color: C.accent,
          },
          {
            label: "Active Users",
            value: (s.activeUsers || 0).toLocaleString(),
            color: C.success,
          },
          {
            label: "New Today",
            value: (s.newUsersToday || 0).toLocaleString(),
            color: C.info,
          },
          {
            label: "New This Week",
            value: (s.newUsersWeek || 0).toLocaleString(),
            color: C.warn,
          },
          {
            label: "Total Revenue",
            value: `$${(s.totalRevenue || 0).toFixed(2)}`,
            color: C.success,
          },
          {
            label: "Revenue Today",
            value: `$${(s.revenueToday || 0).toFixed(2)}`,
            color: C.accent,
          },
        ].map((m) => (
          <div
            key={m.label}
            style={{
              padding: "18px 20px",
              background: C.bg2,
              border: `1px solid ${C.border}`,
              borderRadius: 14,
              borderLeft: `3px solid ${m.color}`,
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 900, color: m.color }}>
              {m.value}
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
              {m.label}
            </div>
          </div>
        ))}
      </div>

      <Section title="Content Overview">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
          }}
        >
          {[
            { label: "Posts", value: s.totalPosts || 0 },
            { label: "Reels", value: s.totalReels || 0 },
            { label: "Stories", value: s.totalStories || 0 },
            { label: "Communities", value: s.totalCommunities || 0 },
          ].map((m) => (
            <div
              key={m.label}
              style={{
                textAlign: "center",
                padding: "16px",
                background: C.bg3,
                borderRadius: 10,
              }}
            >
              <div style={{ fontSize: 24, fontWeight: 800, color: C.text }}>
                {m.value}
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                {m.label}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ============================================================================
// TRANSACTIONS SECTION
// ============================================================================

export function TransactionsSection({ adminData, txMgmt }) {
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

  const handleRefund = async (tx) => {
    try {
      await refundTransaction(tx.id, "Admin refund");
      setActionAlert({ type: "success", msg: "Transaction refunded." });
    } catch (e) {
      setActionAlert({ type: "error", msg: e.message });
    }
  };

  const columns = [
    {
      label: "User",
      render: (t) => (
        <span style={{ fontSize: 12, color: C.text }}>
          {t.user_name} <span style={{ color: C.muted }}>({t.user_email})</span>
        </span>
      ),
    },
    {
      label: "Amount",
      render: (t) => (
        <span style={{ color: C.success, fontWeight: 700 }}>
          ${t.amount?.toFixed(2)}
        </span>
      ),
    },
    {
      label: "Status",
      render: (t) => <StatusBadge status={t.status} />,
    },
    {
      label: "Method",
      render: (t) => <Badge label={t.method || "—"} color={C.muted} />,
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
            icon={CreditCard}
            size="sm"
            label="Refund"
            danger
            onClick={() => handleRefund(t)}
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
        <h1 style={{ fontSize: 26, fontWeight: 800, color: C.text, margin: 0 }}>
          Transactions
        </h1>
        <Btn icon={RefreshCw} onClick={reload} />
      </div>
      {actionAlert && (
        <Alert
          type={actionAlert.type}
          message={actionAlert.msg}
          onClose={() => setActionAlert(null)}
        />
      )}
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
          rows={transactions}
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
        <h1 style={{ fontSize: 26, fontWeight: 800, color: C.text, margin: 0 }}>
          Security
        </h1>
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
          title="🔒 Locked Accounts"
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
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                  {acc.full_name}
                </div>
                <div style={{ fontSize: 11, color: C.muted }}>
                  {acc.email} · {acc.failed_login_attempts} failed attempts
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
          <div style={{ color: C.muted, textAlign: "center", padding: 24 }}>
            No security events
          </div>
        ) : (
          recentEvents.map((ev) => (
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
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 3,
                  }}
                >
                  <Badge
                    label={ev.severity}
                    color={
                      ev.severity === "critical"
                        ? C.danger
                        : ev.severity === "warning"
                          ? C.warn
                          : C.info
                    }
                  />
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
              {!ev.resolved && (
                <Btn
                  size="sm"
                  label="Resolve"
                  onClick={() => handleResolve(ev.id)}
                />
              )}
            </div>
          ))
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
      await broadcaster.send(form);
      setForm({ title: "", message: "", type: "info", targetType: "all" });
      setAlert({ type: "success", msg: "Notification sent." });
      reload();
    } catch (e) {
      setAlert({ type: "error", msg: e.message });
    } finally {
      setSending(false);
    }
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

      <Section title="Send Notification">
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
            placeholder="Notification body"
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
                { value: "info", label: "Info" },
                { value: "success", label: "Success" },
                { value: "warning", label: "Warning" },
                { value: "promo", label: "Promotion" },
              ]}
            />
          </Field>
          <Field label="Target">
            <Select
              value={form.targetType}
              onChange={(e) => setForm({ ...form, targetType: e.target.value })}
              options={[
                { value: "all", label: "All Users" },
                { value: "vip", label: "VIP Only" },
                { value: "pro", label: "Pro Only" },
              ]}
            />
          </Field>
        </div>
        <Btn
          label="Send Notification"
          icon={Bell}
          variant="primary"
          loading={sending}
          onClick={handleSend}
        />
      </Section>

      <Section title="Sent Notifications" subtitle={`${sent.length} recent`}>
        {sent.length === 0 ? (
          <div style={{ color: C.muted, textAlign: "center", padding: 24 }}>
            No notifications sent yet
          </div>
        ) : (
          sent.map((n) => (
            <div
              key={n.id}
              style={{
                padding: "10px 0",
                borderBottom: `1px solid ${C.border}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 3,
                }}
              >
                <Badge label={n.type || "info"} color={C.info} />
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                  {n.title}
                </span>
              </div>
              <div style={{ fontSize: 11, color: C.muted }}>{n.body}</div>
              <div style={{ fontSize: 10, color: C.muted2, marginTop: 3 }}>
                {n.target_type} · {n.reach} reached ·{" "}
                {new Date(n.sent_at).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </Section>
    </div>
  );
}

// ============================================================================
// COMMUNITIES SECTION
// ============================================================================

export function CommunitiesSection({ adminData, contentMgmt }) {
  const {
    communities,
    total,
    page,
    setPage,
    loading,
    search,
    setSearch,
    reload,
    pageSize = 20,
    suspend,
    restore,
  } = useCommunities();
  const [alert, setAlert] = useState(null);

  const handleSuspend = async (id) => {
    try {
      await suspend(id);
      setAlert({ type: "success", msg: "Community suspended." });
    } catch (e) {
      setAlert({ type: "error", msg: e.message });
    }
  };

  const handleRestore = async (id) => {
    try {
      await restore(id);
      setAlert({ type: "success", msg: "Community restored." });
    } catch (e) {
      setAlert({ type: "error", msg: e.message });
    }
  };

  const columns = [
    {
      label: "Community",
      render: (c) => (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
            {c.icon} {c.name}
            {c.is_verified && (
              <CheckCircle2
                size={12}
                color={C.accent}
                style={{ marginLeft: 5 }}
              />
            )}
          </div>
          <div style={{ fontSize: 11, color: C.muted }}>
            Owner: {c.owner_name}
          </div>
        </div>
      ),
    },
    {
      label: "Members",
      render: (c) => (
        <span style={{ color: C.accent, fontWeight: 700 }}>
          {c.member_count}
        </span>
      ),
    },
    {
      label: "Status",
      render: (c) => (
        <StatusBadge status={c.deleted_at ? "suspended" : "active"} />
      ),
    },
    {
      label: "Actions",
      render: (c) => (
        <div style={{ display: "flex", gap: 4 }}>
          {!c.deleted_at ? (
            <Btn
              label="Suspend"
              size="sm"
              danger
              onClick={() => handleSuspend(c.id)}
            />
          ) : (
            <Btn
              label="Restore"
              size="sm"
              onClick={() => handleRestore(c.id)}
            />
          )}
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
        <h1 style={{ fontSize: 26, fontWeight: 800, color: C.text, margin: 0 }}>
          Communities
        </h1>
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
            padding: "14px 18px",
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search communities…"
          />
        </div>
        <DataTable
          columns={columns}
          rows={communities}
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
    </div>
  );
}
