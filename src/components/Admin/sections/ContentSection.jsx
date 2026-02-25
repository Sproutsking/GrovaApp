// ============================================================================
// src/components/Admin/sections/UsersSection.jsx
// Full user management — search, view, ban, verify, adjust, etc.
// ============================================================================

import React, { useState } from "react";
import {
  Users,
  Shield,
  CheckCircle2,
  XCircle,
  Trash2,
  Edit2,
  Search,
  RefreshCw,
  AlertTriangle,
  DollarSign,
  Star,
  Eye,
  Lock,
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
  Tabs,
  EmptyState,
} from "../AdminUI.jsx";
import { can, PERMISSIONS } from "../permissions.js";
import { useTable } from "../useAdminData.js";

export default function UsersSection({ adminData, userMgmt }) {
  const {
    banUser,
    unbanUser,
    deleteUser,
    restoreUser,
    verifyUser,
    setUserTier,
    adjustWallet,
  } = userMgmt;

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState(null);
  const [actionModal, setActionModal] = useState(null); // { type, user }
  const [adjustForm, setAdjustForm] = useState({
    tokens: 0,
    points: 0,
    reason: "",
  });
  const [tierValue, setTierValue] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionAlert, setActionAlert] = useState(null);
  const [banReason, setBanReason] = useState("");

  const filterMap = {
    all: {},
    active: { account_status: "active" },
    suspended: { account_status: "suspended" },
    deleted: { account_status: "deactivated" },
    pro: { is_pro: true },
    vip: { subscription_tier: "vip" },
    unverified: { verified: false },
  };

  const {
    data: users,
    count,
    page,
    setPage,
    loading,
    refresh,
    pageSize,
  } = useTable("profiles", {
    select:
      "id,full_name,email,username,verified,is_pro,account_status,subscription_tier,payment_status,created_at,deleted_at,last_seen,engagement_points",
    filters: { ...filterMap[filter], is_admin: false },
    search,
    searchColumns: ["full_name", "email", "username"],
    order: { column: "created_at", ascending: false },
  });

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
              title="Suspend user"
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
            {count.toLocaleString()} total users
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
              total={count}
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
                <div style={{ display: "flex", gap: 8 }}>
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
            placeholder="e.g. Repeated violations, spam, harassment…"
            rows={3}
          />
        </Field>
      </Modal>

      {/* Unban Confirm */}
      <ConfirmDialog
        open={actionModal?.type === "unban"}
        onClose={() => setActionModal(null)}
        title="Unsuspend User"
        message={`Restore access for ${actionModal?.user?.full_name}? They will be able to sign in again.`}
        confirmLabel="Unsuspend"
        onConfirm={() => doAction(() => unbanUser(actionModal.user.id))}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        open={actionModal?.type === "delete"}
        onClose={() => setActionModal(null)}
        title="Delete User Account"
        danger
        message={`Soft-delete ${actionModal?.user?.full_name}? Their data is retained but they cannot access the platform.`}
        confirmLabel="Delete Account"
        onConfirm={() => doAction(() => deleteUser(actionModal.user.id))}
      />

      {/* Restore Confirm */}
      <ConfirmDialog
        open={actionModal?.type === "restore"}
        onClose={() => setActionModal(null)}
        title="Restore Account"
        message={`Restore ${actionModal?.user?.full_name}'s account? They will regain full access.`}
        confirmLabel="Restore"
        onConfirm={() => doAction(() => restoreUser(actionModal.user.id))}
      />

      {/* Wallet Adjust Modal */}
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
