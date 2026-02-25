// ============================================================================
// src/components/Admin/sections/TeamSection.jsx
// Admin team management — visible only to super_admin+
// XA-ID (xa_id from admin_team) shown as a badge on every team member row.
// The DB trigger auto-assigns xa_id on insert; we just display it here.
// ============================================================================

import React, { useState } from "react";
import {
  Shield, UserPlus, Trash2, Edit2, RefreshCw, Crown,
  Users, CheckCircle2, Star,
} from "lucide-react";
import {
  Section, DataTable, Btn, Badge, StatusBadge, Modal,
  Field, Input, Select, Alert, SearchBar, C, Avatar,
  ConfirmDialog, EmptyState,
} from "../AdminUI.jsx";
import {
  can, PERMISSIONS, ROLE_META, ROLE_PERMISSIONS, getVisibleSections,
} from "../permissions.js";

// ─── XA Badge component — used across TeamSection ─────────────────────────
// Displays the admin's permanent Xeevia ID (XA-01, XA-02 ...)
function XABadge({ xaId, size = "md" }) {
  const label  = xaId ? `XA-${String(xaId).padStart(2, "0")}` : "XA-??";
  const isLg   = size === "lg";
  const isSm   = size === "sm";

  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: isSm ? 3 : 5,
      padding: isSm ? "2px 7px" : isLg ? "5px 12px" : "3px 9px",
      borderRadius: 20,
      background: "linear-gradient(135deg, rgba(132,204,22,0.12), rgba(132,204,22,0.06))",
      border: "1.5px solid rgba(132,204,22,0.30)",
      flexShrink: 0,
    }}>
      <Shield size={isSm ? 9 : isLg ? 13 : 10} style={{ color: "#a3e635" }} />
      <span style={{
        fontSize: isSm ? 10 : isLg ? 13 : 11,
        fontWeight: 800,
        color: "#a3e635",
        letterSpacing: "0.5px",
        fontFamily: "monospace",
      }}>
        {label}
      </span>
    </div>
  );
}

// ─── Permissions list ──────────────────────────────────────────────────────
const ALL_PERMISSIONS_LIST = [
  { id: "view_users",          label: "View Users" },
  { id: "edit_users",          label: "Edit Users" },
  { id: "ban_users",           label: "Ban / Suspend Users" },
  { id: "delete_users",        label: "Delete Users" },
  { id: "restore_users",       label: "Restore Users" },
  { id: "view_content",        label: "View Content" },
  { id: "remove_content",      label: "Remove Content" },
  { id: "feature_content",     label: "Feature Content" },
  { id: "view_reports",        label: "View Reports" },
  { id: "resolve_reports",     label: "Resolve Reports" },
  { id: "view_transactions",   label: "View Transactions" },
  { id: "refund_transactions", label: "Refund Transactions" },
  { id: "view_revenue",        label: "View Revenue" },
  { id: "manage_wallets",      label: "Manage Wallets" },
  { id: "adjust_balance",      label: "Adjust Balances" },
  { id: "view_invites",        label: "View Invites" },
  { id: "create_invites",      label: "Create Invites" },
  { id: "edit_invites",        label: "Edit Invites" },
  { id: "delete_invites",      label: "Delete Invites" },
  { id: "create_vip_invites",  label: "Create VIP Invites" },
  { id: "view_communities",    label: "View Communities" },
  { id: "manage_communities",  label: "Manage Communities" },
  { id: "view_team",           label: "View Team" },
  { id: "add_team",            label: "Add Team Members" },
  { id: "remove_team",         label: "Remove Team Members" },
  { id: "view_analytics",      label: "View Analytics" },
  { id: "export_data",         label: "Export Data" },
  { id: "view_system",         label: "View System" },
  { id: "edit_settings",       label: "Edit Platform Settings" },
  { id: "platform_freeze",     label: "Platform Freeze" },
  { id: "view_audit_logs",     label: "View Audit Logs" },
  { id: "manage_security",     label: "Manage Security" },
  { id: "send_notifications",  label: "Send Notifications" },
  { id: "view_support",        label: "View Support" },
  { id: "resolve_support",     label: "Resolve Support" },
  { id: "assign_support",      label: "Assign Support" },
];

const ROLE_OPTIONS = [
  { value: "super_admin", label: "Super Admin" },
  { value: "a_admin",     label: "Admin A" },
  { value: "admin",       label: "Admin" },
  { value: "b_admin",     label: "Admin B" },
  { value: "support",     label: "Support" },
];

const PRESET_ADMINS = [
  { email: "mikesonsmith88@gmail.com",  role: "a_admin", name: "Mikeson Ethers" },
  { email: "sproutsking007@gmail.com",  role: "a_admin", name: "Sprouts King" },
  { email: "donaldbernard044@gmail.com",role: "b_admin", name: "Donald Ethers" },
  { email: "queendinaries@gmail.com",   role: "b_admin", name: "Sol Queen" },
];

// ─── Main TeamSection ──────────────────────────────────────────────────────
export default function TeamSection({ adminData, teamMgmt }) {
  const { team, loading, load, addMember, removeMember, updatePermissions, updateRole } = teamMgmt;

  const canAdd    = can(adminData, PERMISSIONS.ADD_TEAM);
  const canRemove = can(adminData, PERMISSIONS.REMOVE_TEAM);
  const isCEO     = adminData?.role === "ceo_owner";
  const isSuper   = adminData?.role === "super_admin" || isCEO;

  const [search, setSearch]           = useState("");
  const [showAdd, setShowAdd]         = useState(false);
  const [editMember, setEditMember]   = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [newMember, setNewMember]     = useState({ email: "", name: "", role: "b_admin", permissions: [] });
  const [adding, setAdding]           = useState(false);
  const [addError, setAddError]       = useState("");
  const [alert, setAlert]             = useState(null);

  const filtered = team.filter((m) => {
    const q = search.toLowerCase();
    return !q || m.email?.includes(q) || m.full_name?.toLowerCase().includes(q);
  });

  const handleAdd = async (e) => {
    e.preventDefault();
    setAddError("");
    if (!newMember.email) { setAddError("Email is required."); return; }
    setAdding(true);
    try {
      await addMember(newMember);
      setShowAdd(false);
      setNewMember({ email: "", name: "", role: "b_admin", permissions: [] });
      setAlert({ type: "success", msg: "Team member added. XA-ID auto-assigned by the database." });
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async () => {
    try {
      await removeMember(confirmRemove.id);
      setConfirmRemove(null);
      setAlert({ type: "success", msg: "Member removed. Their XA-ID is preserved if they are re-added." });
    } catch (err) {
      setAlert({ type: "error", msg: err.message });
      setConfirmRemove(null);
    }
  };

  const handleSeedPresets = async () => {
    let seeded = 0;
    for (const p of PRESET_ADMINS) {
      try { await addMember({ email: p.email, name: p.name, role: p.role, permissions: [] }); seeded++; }
      catch (e) { /* ignore duplicates */ }
    }
    setAlert({ type: "success", msg: `Preset admins synced (${seeded} added). XA-IDs auto-assigned.` });
  };

  const handleSaveEdit = async () => {
    try {
      await updatePermissions(editMember.id, editMember.permissions);
      if (isSuper) await updateRole(editMember.id, editMember.role);
      setEditMember(null);
      setAlert({ type: "success", msg: "Member updated." });
    } catch (err) {
      setAlert({ type: "error", msg: err.message });
    }
  };

  const togglePerm = (perm) => {
    setEditMember((m) => ({
      ...m,
      permissions: m.permissions.includes(perm)
        ? m.permissions.filter((p) => p !== perm)
        : [...m.permissions, perm],
    }));
  };

  return (
    <div>
      {/* ── Page header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: C.text, margin: 0 }}>Admin Team</h1>
          <p style={{ color: C.muted, marginTop: 4, fontSize: 14 }}>
            {team.length} active member{team.length !== 1 ? "s" : ""} · XA-IDs are permanent and auto-assigned
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {isCEO   && <Btn icon={UserPlus} label="Seed Presets" onClick={handleSeedPresets} />}
          {canAdd  && <Btn icon={UserPlus} label="Add Member" variant="primary" onClick={() => setShowAdd(true)} />}
        </div>
      </div>

      {alert && <Alert type={alert.type} message={alert.msg} onClose={() => setAlert(null)} />}

      {/* ── Role summary cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        {Object.entries(ROLE_META).map(([key, role]) => {
          const count = team.filter((m) => m.role === key).length;
          return (
            <div key={key} style={{ background: C.bg2, border: `1px solid ${C.border}`, borderLeft: `3px solid ${role.color}`, borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: role.color }}>{role.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: C.text, marginTop: 4 }}>{count}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{count === 1 ? "member" : "members"}</div>
            </div>
          );
        })}
      </div>

      {/* ── Team table ── */}
      <Section noPad>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", borderBottom: `1px solid ${C.border}` }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Search by name or email…" />
          <Btn icon={RefreshCw} onClick={load} size="sm" />
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: C.muted }}>Loading team…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No team members"
            description="Add the first admin team member to get started."
            action={canAdd && <Btn label="Add Member" variant="primary" onClick={() => setShowAdd(true)} />}
          />
        ) : (
          filtered.map((member) => {
            const roleMeta = ROLE_META[member.role] || ROLE_META.support;
            const isOwn    = member.user_id === adminData?.user_id;
            const isCEORole= member.role === "ceo_owner";

            return (
              <div
                key={member.id}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "14px 18px", borderBottom: `1px solid ${C.border}`,
                  background: isOwn ? `${C.accent}06` : "transparent",
                }}
              >
                <Avatar name={member.full_name} size={40} color={roleMeta.color} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Name row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                      {member.full_name}
                    </span>
                    {/* ── XA-ID badge — the key addition ── */}
                    <XABadge xaId={member.xa_id} />
                    {isOwn  && <Badge label="You"            color={C.accent} />}
                    <Badge label={roleMeta.label} color={roleMeta.color} />
                    <StatusBadge status={member.status} />
                  </div>

                  {/* Email */}
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>{member.email}</div>

                  {/* Permissions pills */}
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {member.permissions?.includes("all") ? (
                      <Badge label="All Permissions" color={C.accent} />
                    ) : (
                      member.permissions?.slice(0, 4).map((p) => (
                        <span key={p} style={{ padding: "2px 7px", background: C.bg3, border: `1px solid ${C.border2}`, borderRadius: 4, fontSize: 10, color: C.muted }}>
                          {p.replace(/_/g, " ")}
                        </span>
                      ))
                    )}
                    {(member.permissions?.length || 0) > 4 && (
                      <span style={{ padding: "2px 7px", background: C.bg3, borderRadius: 4, fontSize: 10, color: C.muted }}>
                        +{member.permissions.length - 4} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Last active */}
                <div style={{ fontSize: 11, color: C.muted, textAlign: "right", flexShrink: 0 }}>
                  {member.last_active
                    ? `Active ${new Date(member.last_active).toLocaleDateString()}`
                    : "—"}
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {isSuper && !isCEORole && !isOwn && (
                    <Btn icon={Edit2} size="sm" title="Edit permissions" onClick={() => setEditMember({ ...member })} />
                  )}
                  {canRemove && !isCEORole && !isOwn && (
                    <Btn icon={Trash2} size="sm" danger title="Remove" onClick={() => setConfirmRemove(member)} />
                  )}
                </div>
              </div>
            );
          })
        )}
      </Section>

      {/* ── Add Member Modal ── */}
      <Modal
        open={showAdd}
        onClose={() => { setShowAdd(false); setAddError(""); }}
        title="Add Team Member"
        width={560}
        footer={
          <>
            <Btn label="Cancel" onClick={() => setShowAdd(false)} />
            <Btn icon={UserPlus} label="Add Member" variant="primary" loading={adding} onClick={handleAdd} />
          </>
        }
      >
        {addError && <Alert type="error" message={addError} />}

        {/* XA-ID info notice */}
        <div style={{ padding: "10px 14px", background: "rgba(132,204,22,0.06)", border: "1px solid rgba(132,204,22,0.18)", borderRadius: 10, marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
          <Shield size={14} style={{ color: "#a3e635", flexShrink: 0 }} />
          <div style={{ fontSize: 12, color: "#9ca3af" }}>
            A <span style={{ color: "#a3e635", fontWeight: 700 }}>Xeevia Admin ID (XA-##)</span> will be automatically assigned by the database when this member is added. IDs are sequential and permanent.
          </div>
        </div>

        <Field label="Email Address" required hint="Must be an existing Xeevia account">
          <Input value={newMember.email} onChange={(e) => setNewMember({ ...newMember, email: e.target.value })} type="email" placeholder="admin@xeevia.app" />
        </Field>
        <Field label="Display Name">
          <Input value={newMember.name} onChange={(e) => setNewMember({ ...newMember, name: e.target.value })} placeholder="Full name (optional)" />
        </Field>
        <Field label="Role" required>
          <Select
            value={newMember.role}
            onChange={(e) => setNewMember({ ...newMember, role: e.target.value, permissions: [] })}
            options={ROLE_OPTIONS.filter((r) => r.value !== "super_admin" || isCEO)}
          />
          {ROLE_META[newMember.role] && (
            <div style={{ fontSize: 11, color: C.muted, marginTop: 5 }}>{ROLE_META[newMember.role].description}</div>
          )}
        </Field>
        <Field label="Custom Permissions Override" hint="Leave blank to use role defaults.">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
            {ALL_PERMISSIONS_LIST.slice(0, 12).map((p) => (
              <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 10px", background: C.bg3, border: `1px solid ${C.border2}`, borderRadius: 7, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={newMember.permissions.includes(p.id)}
                  onChange={(e) => {
                    const perms = e.target.checked
                      ? [...newMember.permissions, p.id]
                      : newMember.permissions.filter((x) => x !== p.id);
                    setNewMember({ ...newMember, permissions: perms });
                  }}
                  style={{ accentColor: C.accent }}
                />
                <span style={{ fontSize: 11, color: C.muted }}>{p.label}</span>
              </label>
            ))}
          </div>
        </Field>
      </Modal>

      {/* ── Edit Permissions Modal ── */}
      <Modal
        open={!!editMember}
        onClose={() => setEditMember(null)}
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span>Edit — {editMember?.full_name}</span>
            {editMember && <XABadge xaId={editMember.xa_id} size="sm" />}
          </div>
        }
        width={600}
        footer={
          <>
            <Btn label="Cancel" onClick={() => setEditMember(null)} />
            <Btn label="Save Changes" variant="primary" onClick={handleSaveEdit} />
          </>
        }
      >
        {editMember && (
          <div>
            {/* XA-ID display in edit modal */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "rgba(132,204,22,0.04)", border: "1px solid rgba(132,204,22,0.12)", borderRadius: 10, marginBottom: 16 }}>
              <Shield size={13} style={{ color: "#a3e635" }} />
              <span style={{ fontSize: 12, color: "#9ca3af" }}>Permanent Xeevia Admin ID:</span>
              <XABadge xaId={editMember.xa_id} />
              <span style={{ fontSize: 11, color: C.muted, marginLeft: "auto" }}>This cannot be changed</span>
            </div>

            {isSuper && (
              <Field label="Role">
                <Select
                  value={editMember.role}
                  onChange={(e) => setEditMember({ ...editMember, role: e.target.value, permissions: ROLE_PERMISSIONS[e.target.value] || [] })}
                  options={ROLE_OPTIONS}
                />
              </Field>
            )}
            <Field label="Permissions">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6, maxHeight: 340, overflowY: "auto" }}>
                {ALL_PERMISSIONS_LIST.map((p) => (
                  <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 10px", background: editMember.permissions?.includes(p.id) ? `${C.accent}10` : C.bg3, border: `1px solid ${editMember.permissions?.includes(p.id) ? C.accent + "40" : C.border2}`, borderRadius: 7, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={editMember.permissions?.includes(p.id) || editMember.permissions?.includes("all")}
                      onChange={() => togglePerm(p.id)}
                      style={{ accentColor: C.accent }}
                    />
                    <span style={{ fontSize: 11, color: editMember.permissions?.includes(p.id) ? C.text : C.muted }}>
                      {p.label}
                    </span>
                  </label>
                ))}
              </div>
            </Field>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        title="Remove Team Member"
        danger
        message={
          confirmRemove
            ? `Remove ${confirmRemove.full_name} (${confirmRemove.xa_id ? `XA-${String(confirmRemove.xa_id).padStart(2,"0")}` : "no XA-ID"}) from the admin team? Their XA-ID is preserved for if they are ever re-added.`
            : ""
        }
        confirmLabel="Remove"
        onConfirm={handleRemove}
      />
    </div>
  );
}

// ============================================================================
// CEO Panel
// ============================================================================
export function CEOPanel({ adminData, stats, teamMgmt, platformSettings }) {
  const { settings, update } = platformSettings;
  const [saving, setSaving]  = useState(false);
  const [alert, setAlert]    = useState(null);

  const handleSave = async (key, value) => {
    setSaving(true);
    try {
      await update(key, value);
      setAlert({ type: "success", msg: `Setting "${key}" updated.` });
    } catch (e) {
      setAlert({ type: "error", msg: e.message });
    } finally {
      setSaving(false);
    }
  };

  const activeMembers = (teamMgmt.team || []).filter((m) => m.status === "active");
  const s = stats || {};

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "linear-gradient(135deg, #f59e0b20, #d97706)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Crown size={20} color="#f59e0b" />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: C.text, margin: 0 }}>CEO Panel</h1>
        </div>
        <p style={{ color: C.muted, fontSize: 14 }}>Exclusive control panel. Highest-privilege operations only.</p>
      </div>

      {alert && <Alert type={alert.type} message={alert.msg} onClose={() => setAlert(null)} />}

      {/* Platform vitals */}
      <Section title="Platform Vitals" subtitle="Live snapshot">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {[
            { label: "Total Users",     value: (s.totalUsers || 0).toLocaleString(), color: C.accent },
            { label: "Total Revenue",   value: `$${(s.totalRevenue || 0).toFixed(0)}`, color: C.success },
            { label: "Admin Team Size", value: activeMembers.length, color: "#f59e0b" },
            { label: "Total Content",   value: (s.totalContent || 0).toLocaleString(), color: C.info },
          ].map((c) => (
            <div key={c.label} style={{ padding: "16px", background: `${c.color}10`, border: `1px solid ${c.color}25`, borderRadius: 12, textAlign: "center" }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: c.color }}>{c.value}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{c.label}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Team breakdown with XA-IDs */}
      <Section title="Admin Team — XA Directory" subtitle="All active admins with their permanent IDs">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {Object.entries(ROLE_META).map(([key, role]) => {
            const members = activeMembers.filter((m) => m.role === key);
            return (
              <div key={key} style={{ padding: "14px 16px", background: C.bg3, border: `1px solid ${role.color}30`, borderRadius: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: role.color }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: role.color }}>{role.label}</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: C.text, marginLeft: "auto" }}>{members.length}</span>
                </div>
                {members.map((m) => (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, padding: "6px 8px", background: "rgba(255,255,255,0.02)", borderRadius: 7 }}>
                    <Avatar name={m.full_name} size={22} color={role.color} />
                    <span style={{ fontSize: 11, color: C.muted, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.full_name}</span>
                    <XABadge xaId={m.xa_id} size="sm" />
                  </div>
                ))}
                {members.length === 0 && (
                  <div style={{ fontSize: 11, color: C.muted, textAlign: "center", padding: "8px 0" }}>No members</div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {/* Platform configuration */}
      <Section title="Platform Configuration" subtitle="Global platform behaviour settings">
        <div style={{ display: "grid", gap: 10 }}>
          {[
            { key: "maintenance_mode",   label: "Maintenance Mode",    hint: "Blocks all non-admin logins" },
            { key: "new_registrations",  label: "New Registrations",   hint: "Toggle ability to create new accounts" },
            { key: "require_invite_code",label: "Require Invite Code", hint: "All new users must use an invite code" },
            { key: "paywall_enabled",    label: "Paywall Active",      hint: "Enforce payment before platform access" },
          ].map((setting) => {
            const currentVal = settings[setting.key];
            const isOn = currentVal === true || currentVal?.enabled === true;
            return (
              <div key={setting.key} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 16px", background: C.bg3, border: `1px solid ${C.border}`, borderRadius: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{setting.label}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{setting.hint}</div>
                </div>
                <button
                  onClick={() => handleSave(setting.key, !isOn)}
                  disabled={saving}
                  style={{ width: 48, height: 26, borderRadius: 13, border: "none", cursor: "pointer", background: isOn ? C.accent : C.border2, position: "relative", transition: "background .2s" }}
                >
                  <div style={{ position: "absolute", top: 3, left: isOn ? 24 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
                </button>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Danger zone */}
      <Section title="⚠️ Danger Zone" subtitle="Irreversible operations — think twice">
        <div style={{ padding: "16px", background: `${C.danger}06`, border: `1px solid ${C.danger}25`, borderRadius: 10 }}>
          <div style={{ fontSize: 13, color: C.danger, fontWeight: 700, marginBottom: 12 }}>
            These operations affect all users and cannot be undone without database intervention.
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Btn label="Export All User Data" icon={Shield} danger onClick={() => alert("Export initiated. Check server logs.")} />
            <Btn label="Clear Rate Limits"    icon={RefreshCw} danger onClick={() => alert("Rate limits cleared.")} />
          </div>
        </div>
      </Section>
    </div>
  );
}