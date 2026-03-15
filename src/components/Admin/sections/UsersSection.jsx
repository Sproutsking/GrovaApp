// ============================================================================
// src/components/Admin/sections/UsersSection.jsx — FULL POWER v3
// ============================================================================
//
// PROP: receives { adminData, usersHook } from AdminDashboard
//       usersHook = useUsers() — has banUser, deleteUser, restoreUser etc.
//
// DELETE: Hard delete — calls deleteUser() which:
//   1. Sets account_status = 'deactivated', deleted_at = now() in profiles
//   2. Calls admin-revoke-user Edge Function → auth.admin.deleteUser()
//      so the user is GONE from auth.users and cannot log in ever again
//
// BAN: Sets account_status = 'suspended' + calls Edge Function to kill session
// UNBAN: Sets account_status = 'active'
// RESTORE: Clears deleted_at, sets account_status = 'active'
// VERIFY/TIER/WALLET: All direct DB writes, instant effect
// ============================================================================

import React, { useState } from "react";
import {
  CheckCircle2,
  Trash2,
  Edit2,
  RefreshCw,
  Star,
  Eye,
  Unlock,
  UserX,
  UserCheck,
  Wallet,
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
} from "../AdminUI.jsx";
import { can, PERMISSIONS } from "../permissions.js";

export default function UsersSection({ adminData, usersHook }) {
  const {
    users = [],
    total = 0,
    page = 0,
    setPage,
    search = "",
    setSearch,
    reload,
    loading = false,
    pageSize = 20,
    banUser,
    unbanUser,
    deleteUser,
    restoreUser,
    verifyUser,
    setUserTier,
    adjustWallet,
  } = usersHook || {};

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

  // Client-side filter on top of server search
  const filterFn = (u) => {
    switch (filter) {
      case "active":
        return u.account_status === "active" && !u.deleted_at;
      case "suspended":
        return u.account_status === "suspended";
      case "deleted":
        return !!u.deleted_at || u.account_status === "deactivated";
      case "pro":
        return u.is_pro;
      case "vip":
        return u.subscription_tier === "vip";
      case "unverified":
        return !u.verified;
      default:
        return true;
    }
  };
  const displayUsers = (users || []).filter(filterFn);

  const doAction = async (fn, successMsg = "Done.") => {
    setActionLoading(true);
    setActionAlert(null);
    try {
      await fn();
      setActionModal(null);
      setSelectedUser(null);
      if (reload) await reload();
      setActionAlert({ type: "success", msg: successMsg });
    } catch (e) {
      setActionAlert({ type: "error", msg: e?.message || "Action failed." });
      console.error("[UsersSection]", e);
    } finally {
      setActionLoading(false);
    }
  };

  const filterOptions = [
    { value: "all", label: "All Users" },
    { value: "active", label: "Active" },
    { value: "suspended", label: "Suspended / Banned" },
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
                color: u.deleted_at ? C.muted : C.text,
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
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {/* View */}
          <Btn
            icon={Eye}
            size="sm"
            title="View profile"
            onClick={() => {
              setSelectedUser(u);
              setTierValue(u.subscription_tier || "free");
            }}
          />

          {/* Ban — only for active non-deleted users */}
          {canBan && u.account_status === "active" && !u.deleted_at && (
            <Btn
              icon={UserX}
              size="sm"
              danger
              title="Suspend / Ban"
              onClick={() => {
                setActionModal({ type: "ban", user: u });
                setBanReason("");
              }}
            />
          )}

          {/* Unban */}
          {canBan && u.account_status === "suspended" && (
            <Btn
              icon={UserCheck}
              size="sm"
              title="Unsuspend"
              onClick={() => setActionModal({ type: "unban", user: u })}
            />
          )}

          {/* Edit tier / verify */}
          {canEdit && !u.deleted_at && (
            <Btn
              icon={Edit2}
              size="sm"
              title="Edit tier / verify"
              onClick={() => {
                setSelectedUser(u);
                setTierValue(u.subscription_tier || "free");
              }}
            />
          )}

          {/* Hard Delete — only for non-deleted users */}
          {canDelete && !u.deleted_at && (
            <Btn
              icon={Trash2}
              size="sm"
              danger
              title="Delete account (permanent)"
              onClick={() => setActionModal({ type: "delete", user: u })}
            />
          )}

          {/* Restore */}
          {canRestore &&
            (!!u.deleted_at || u.account_status === "deactivated") && (
              <Btn
                icon={Unlock}
                size="sm"
                title="Restore account"
                onClick={() => setActionModal({ type: "restore", user: u })}
              />
            )}

          {/* Wallet */}
          {canAdjustWallet && (
            <Btn
              icon={Wallet}
              size="sm"
              title="Adjust wallet"
              onClick={() => {
                setActionModal({ type: "wallet", user: u });
                setAdjustForm({ tokens: 0, points: 0, reason: "" });
              }}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* Header */}
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
        <Btn icon={RefreshCw} label="Refresh" onClick={reload} />
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
            onChange={(val) => {
              if (setSearch) setSearch(val);
            }}
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
          rows={displayUsers}
          loading={loading}
          emptyMsg="No users match the current filter."
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

      {/* ── View / Edit Modal ── */}
      <Modal
        open={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title="User Profile"
        width={580}
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

            {canEdit && !selectedUser.deleted_at && (
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
                        doAction(
                          () => setUserTier(selectedUser.id, tierValue),
                          `Tier updated to ${tierValue}.`,
                        )
                      }
                    />
                  </div>
                </Field>
                <Btn
                  label={
                    selectedUser.verified
                      ? "Remove Verification"
                      : "Verify User"
                  }
                  icon={CheckCircle2}
                  variant={selectedUser.verified ? "secondary" : "primary"}
                  loading={actionLoading}
                  onClick={() =>
                    doAction(
                      () => verifyUser(selectedUser.id, !selectedUser.verified),
                      selectedUser.verified
                        ? "Verification removed."
                        : "User verified.",
                    )
                  }
                />
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Ban Modal ── */}
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
                doAction(
                  () => banUser(actionModal.user.id, banReason),
                  "User suspended. Their session has been revoked.",
                )
              }
            />
          </>
        }
      >
        <Alert
          type="warn"
          message="This immediately blocks the user and kills their active session."
        />
        <Field label="Reason (optional)">
          <Input
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
            placeholder="e.g. Spam, violations, fraud…"
            rows={3}
          />
        </Field>
      </Modal>

      {/* ── Unban Confirm ── */}
      <ConfirmDialog
        open={actionModal?.type === "unban"}
        onClose={() => setActionModal(null)}
        title="Unsuspend User"
        message={`Restore full access for ${actionModal?.user?.full_name}? They can log in immediately.`}
        confirmLabel="Unsuspend"
        onConfirm={() =>
          doAction(() => unbanUser(actionModal.user.id), "User unsuspended.")
        }
      />

      {/* ── Hard Delete Confirm ── */}
      <ConfirmDialog
        open={actionModal?.type === "delete"}
        onClose={() => setActionModal(null)}
        title="Permanently Delete Account"
        danger
        message={`This will permanently delete ${actionModal?.user?.full_name}'s auth account. They will NEVER be able to log in again. Their data is retained for records. This cannot be undone.`}
        confirmLabel="Delete Permanently"
        onConfirm={() =>
          doAction(
            () => deleteUser(actionModal.user.id),
            "Account permanently deleted. Auth session destroyed.",
          )
        }
      />

      {/* ── Restore Confirm ── */}
      <ConfirmDialog
        open={actionModal?.type === "restore"}
        onClose={() => setActionModal(null)}
        title="Restore Account"
        message={`Restore ${actionModal?.user?.full_name}'s account? They will regain full platform access.`}
        confirmLabel="Restore"
        onConfirm={() =>
          doAction(() => restoreUser(actionModal.user.id), "Account restored.")
        }
      />

      {/* ── Wallet Adjust Modal ── */}
      <Modal
        open={actionModal?.type === "wallet"}
        onClose={() => setActionModal(null)}
        title={`Adjust Wallet — ${actionModal?.user?.full_name}`}
        width={440}
        footer={
          <>
            <Btn label="Cancel" onClick={() => setActionModal(null)} />
            <Btn
              label="Apply"
              variant="primary"
              loading={actionLoading}
              onClick={() =>
                doAction(
                  () =>
                    adjustWallet(
                      actionModal.user.id,
                      parseInt(adjustForm.tokens) || 0,
                      parseInt(adjustForm.points) || 0,
                      adjustForm.reason,
                      adminData?.user_id,
                    ),
                  "Wallet adjusted.",
                )
              }
            />
          </>
        }
      >
        <Alert
          type="warn"
          message="Positive = credit. Negative = debit. Reason is required."
        />
        <Field label="Grova Token Delta">
          <Input
            value={adjustForm.tokens}
            onChange={(e) =>
              setAdjustForm({ ...adjustForm, tokens: e.target.value })
            }
            type="number"
          />
        </Field>
        <Field label="Engagement Points Delta">
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
            placeholder="e.g. Compensation, beta bonus…"
          />
        </Field>
      </Modal>
    </div>
  );
}
