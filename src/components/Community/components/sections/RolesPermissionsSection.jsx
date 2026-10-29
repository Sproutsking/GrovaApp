// src/components/Community/components/sections/RolesPermissionsSection.jsx
// Designed for NARROW sidebar context (~360-400px wide).
// Layout: role list on top → editor below (vertical stack, not side-by-side)
// Selectable permission cards, grouped and searchable.
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus, Shield, ChevronRight, ChevronLeft,
  Check, X, Users, Crown, Save,
} from "lucide-react";
import mediaUrlService from "../../../../services/shared/mediaUrlService";
import RoleAccessPanel from "./RoleAccessPanel";
import RolePermissionCards from "./RolePermissionCards";
import { ROLE_PERMISSION_GROUPS } from "./rolePermissionCatalog";

// ─── Role color swatches ──────────────────────────────────────────────────────
const COLORS = [
  "#95A5A6","#667eea","#9cff00","#FFD700","#f5576c",
  "#f093fb","#4facfe","#43e97b","#fa709a","#ff6b6b",
  "#ffd89b","#00c9ff","#c471ed","#f97316","#10b981",
];

// ─── Main component ───────────────────────────────────────────────────────────
const RolesPermissionsSection = ({
  communityId,
  roles = [],
  members = [],
  canManageRoles = false,
  isCommunityOwner = false,
  initialRoleId = null,
  onInitialRoleOpened,
  onUpdateRole,
  onCreateRole,
  onAssignRole,
  onReorderRoles,
}) => {
  const [orderedRoles, setOrderedRoles] = useState(roles);
  const [draggedRoleId, setDraggedRoleId] = useState(null);

  useEffect(() => { setOrderedRoles(roles); }, [roles]);
  // "list" view → shows role list
  // "edit" view → shows editor for selectedRole
  const [view, setView]               = useState("list");
  const [selectedRole, setSelectedRole] = useState(null);
  const [editedPerms, setEditedPerms]   = useState({});
  const [editedName, setEditedName]     = useState("");
  const [editedColor, setEditedColor]   = useState("#667eea");
  const [editedIcon, setEditedIcon]     = useState("♟");
  const [activeTab, setActiveTab]       = useState("display");
  const [saving, setSaving]             = useState(false);
  const [saved, setSaved]               = useState(false);
  const savedTimeout = useRef(null);
  const [showCreate, setShowCreate]     = useState(false);
  const [newName, setNewName]           = useState("");
  const [error, setError]               = useState("");

  useEffect(() => () => window.clearTimeout(savedTimeout.current), []);

  const openRole = useCallback((role) => {
    setSelectedRole(role);
    const ownerPermissionDefaults = Object.fromEntries(
      ROLE_PERMISSION_GROUPS.flatMap((group) => group.perms.map((permission) => [permission.key, true])),
    );
    setEditedPerms(String(role.name || "").trim().toLowerCase() === "owner"
      ? { ...ownerPermissionDefaults, ...(role.permissions || {}) }
      : role.permissions || {});
    setEditedName(role.name || "");
    setEditedColor(role.color || "#667eea");
    setEditedIcon(role.icon || "♟");
    setActiveTab("display");
    setView("edit");
  }, []);

  useEffect(() => {
    if (!initialRoleId) return;
    const role = roles.find((candidate) => candidate.id === initialRoleId);
    if (!role) return;
    openRole(role);
    onInitialRoleOpened?.();
  }, [initialRoleId, roles, onInitialRoleOpened, openRole]);

  const memberCount = (roleId) => members.filter((member) =>
    member.role_id === roleId || member.roles?.some((role) => role.id === roleId),
  ).length;
  const roleGroups = orderedRoles.reduce((groups, role) => {
    const key = role.name?.trim().toLowerCase() || role.id;
    const existing = groups.find((group) => group.key === key);
    if (existing) {
      existing.roles.push(role);
    } else {
      groups.push({ key, role, roles: [role] });
    }
    return groups;
  }, []);
  const membersForRole = (role) => members.filter((member) =>
    member.role_id === role.id
    || member.roles?.some((assignedRole) => assignedRole.id === role.id)
    || member.role?.name?.trim().toLowerCase() === role.name?.trim().toLowerCase()
  );

  const handleSave = async () => {
    if (!selectedRole || !canEditSelectedRole) return;
    setSaving(true);
    setError("");
    try {
      const updatedRole = await onUpdateRole(selectedRole.id, {
        permissions: editedPerms,
        name: editedName,
        color: editedColor,
        icon: editedIcon,
      });
      setSelectedRole({
        ...selectedRole,
        ...(updatedRole && typeof updatedRole === "object" ? updatedRole : {}),
        permissions: editedPerms,
        name: editedName,
        color: editedColor,
        icon: editedIcon,
      });
      setSaved(true);
      window.clearTimeout(savedTimeout.current);
      savedTimeout.current = window.setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err?.message || "Unable to save role");
      console.error("Save role error:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setError("");
    try {
      await onCreateRole({ name: newName.trim(), color: "#667eea", icon: "♟" });
      setNewName("");
      setShowCreate(false);
    } catch (err) {
      setError(err?.message || "Unable to create role");
      console.error("Create role error:", err);
    }
  };

  const isOwnerRole = selectedRole?.name?.trim().toLowerCase() === "owner";
  const canEditSelectedRole = canManageRoles && (!isOwnerRole || isCommunityOwner);

  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  if (view === "list") {
    return (
      <div className="rps-list-view">
        {/* Header row */}
        <div className="rps-list-head">
            <span className="rps-list-label">ROLES <span className="rps-count">{roleGroups.length}</span></span>
          {canManageRoles && (
            <button className="rps-new-btn" onClick={() => setShowCreate(!showCreate)}>
              <Plus size={13} /> New Role
            </button>
          )}
        </div>

        {/* Create input */}
        {showCreate && (
          <div className="rps-create-row">
            <input
              className="rps-create-inp"
              placeholder="Role name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
            <button className="rps-ok-btn" onClick={handleCreate} disabled={!newName.trim()}>
              <Check size={13} />
            </button>
            <button className="rps-cancel-btn" onClick={() => setShowCreate(false)}>
              <X size={13} />
            </button>
          </div>
        )}
        {error && <div className="rps-error" role="alert">{error}</div>}

        {/* Role rows */}
        <div className="rps-roles-list">
          {orderedRoles.length === 0 && (
            <div className="rps-no-roles">
              <Shield size={24} color="#333" />
              <p>No roles yet</p>
            </div>
          )}
          {roleGroups.map(({ role, roles: groupedRoles }) => (
            <div key={role.id} className={`rps-role-row${draggedRoleId === role.id ? " dragging" : ""}`} draggable={canManageRoles} onDragStart={() => setDraggedRoleId(role.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => {
              if (!draggedRoleId || draggedRoleId === role.id) return;
              const next = [...orderedRoles];
              const from = next.findIndex((entry) => entry.id === draggedRoleId);
              const to = next.findIndex((entry) => entry.id === role.id);
              const [moved] = next.splice(from, 1);
              next.splice(to, 0, moved);
              setOrderedRoles(next);
              setDraggedRoleId(null);
              onReorderRoles?.(next);
            }} onDragEnd={() => setDraggedRoleId(null)} onClick={() => openRole(role)}>
              <span className="rps-role-dot" style={{ background: role.color || "#667eea" }} />
              <span className="rps-role-name">{role.name}</span>
              <span className="rps-role-members"><Users size={10} />{membersForRole(role).length}</span>
              {groupedRoles.length > 1 && <span className="rps-role-merged">{groupedRoles.length} entries</span>}
              <ChevronRight size={14} className="rps-role-arrow" />
            </div>
          ))}
        </div>

        <style>{rpsStyles}</style>
      </div>
    );
  }

  // ── EDIT VIEW ──────────────────────────────────────────────────────────────
  return (
    <div className="rps-edit-view">
      {/* Back bar */}
      <div className="rps-edit-topbar">
        <button className="rps-back-btn" onClick={() => setView("list")}>
          <ChevronLeft size={16} />
        </button>
        <span className="rps-edit-role-dot" style={{ background: editedColor }} />
        <span className="rps-edit-role-name">{selectedRole?.name}</span>
        {canEditSelectedRole && (
          <button
            className={`rps-save-btn${saved ? " saved" : ""}`}
            onClick={handleSave}
            disabled={saving}
          >
            {saving
              ? <span className="rps-spin" />
              : saved
                ? <><Check size={12} /> Saved</>
                : <><Save size={12} /> Save</>
            }
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="rps-tabs">
        <button className={`rps-tab${activeTab === "display" ? " active" : ""}`} onClick={() => setActiveTab("display")}>Display</button>
        <button className={`rps-tab${activeTab === "members" ? " active" : ""}`} onClick={() => setActiveTab("members")}>Members</button>
        <button className={`rps-tab${activeTab === "permissions" ? " active" : ""}`} onClick={() => setActiveTab("permissions")}>Permissions</button>
      </div>

      {/* ── Display tab ── */}
      {activeTab === "display" && (
        <div className="rps-display">
          {/* Name */}
          <div className="rps-field-label">Role Name</div>
          <input
            className="rps-name-inp"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            disabled={!canEditSelectedRole || isOwnerRole}
          />

          {/* Color */}
          <div className="rps-field-label" style={{ marginTop: 14 }}>Role Color</div>
          <div className="rps-color-grid">
            {COLORS.map((c) => (
              <button
                key={c}
                className={`rps-swatch${editedColor === c ? " active" : ""}`}
                style={{ background: c }}
                onClick={() => canEditSelectedRole && setEditedColor(c)}
              >
                {editedColor === c && <Check size={9} color="#000" strokeWidth={3} />}
              </button>
            ))}
          </div>

          <div className="rps-field-label" style={{ marginTop: 14 }}>Role Icon</div>
          <input className="rps-role-icon-input" value={editedIcon} maxLength={2} onChange={(event) => setEditedIcon(event.target.value)} disabled={!canEditSelectedRole} placeholder="♟" />

          {/* Stats */}
          <div className="rps-stats-row">
            <div className="rps-stat-pill">
              <Users size={13} color="#9cff00" />
              <span>{memberCount(selectedRole?.id)} members</span>
            </div>
            <div className="rps-stat-pill">
              <Shield size={13} color="#667eea" />
              <span>{Object.values(editedPerms).filter(Boolean).length} perms</span>
            </div>
          </div>

          {selectedRole?.is_default && (
            <div className="rps-default-tag">Default role for new members</div>
          )}
          {isOwnerRole && (
            <div className="rps-owner-tag"><Crown size={12} color="#FFD700" /> Ownership always grants full access. This role controls assigned members after ownership is transferred.</div>
          )}
        </div>
      )}

      {/* ── Permissions tab ── */}
      {activeTab === "permissions" && (
        <div className="rps-perms">
          {isOwnerRole && (
            <div className="rps-owner-notice">
              <Crown size={13} color="#FFD700" /> Current ownership always grants full access; these role permissions apply to assigned members.
            </div>
          )}
          <RolePermissionCards value={editedPerms} onChange={setEditedPerms} disabled={!canEditSelectedRole} />

          {selectedRole && communityId && (
            <div className="rps-access-panel">
              <div className="rps-field-label" style={{ marginTop: 14 }}>Channel access</div>
              <RoleAccessPanel
                communityId={communityId}
                role={{
                  ...selectedRole,
                  permissions: editedPerms,
                  name: editedName,
                  color: editedColor,
                  icon: editedIcon,
                }}
                roles={roles}
                canManage={canManageRoles}
                onChanged={() => {}}
              />
            </div>
          )}
        </div>
      )}

      {activeTab === "members" && (
        <div className="rps-members">
          <div className="rps-field-label">Members with this role</div>
          {membersForRole(selectedRole || {}).map((member) => (
            <div className="rps-member-row" key={member.id}>
              <div className="rps-member-avatar">
                {member.user?.avatar_id ? (
                  <img src={mediaUrlService.getAvatarUrl(member.user.avatar_id, 80)} alt="" />
                ) : (
                  member.user?.full_name?.[0]?.toUpperCase() || "?"
                )}
              </div>
              <div className="rps-member-info">
                <strong>{member.user?.full_name || member.user?.username || "Unknown user"}</strong>
                <span>@{member.user?.username || "unknown"}</span>
              </div>
            </div>
          ))}
          {membersForRole(selectedRole || {}).length === 0 && (
            <div className="rps-empty-members">No members have this role yet.</div>
          )}
          {canManageRoles && !isOwnerRole && (
            <label className="rps-assign-label">
              <span>Assign this role to a member</span>
              <select defaultValue="" onChange={(event) => {
                if (event.target.value) onAssignRole?.(event.target.value, selectedRole.id);
                event.target.value = "";
              }}>
                <option value="">Choose member...</option>
                {members.filter((member) => !membersForRole(selectedRole || {}).some((roleMember) => roleMember.id === member.id)).map((member) => (
                  <option value={member.id} key={member.id}>{member.user?.full_name || member.user?.username || "Unknown user"}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      <style>{rpsStyles}</style>
    </div>
  );
};

// ─── All styles ───────────────────────────────────────────────────────────────
// Single <style> block shared by both views.
// Designed for narrow sidebar (~340–420px).
const rpsStyles = `
  /* LIST VIEW */
  .rps-list-view{display:flex;flex-direction:column;padding:12px;gap:0}
  .rps-list-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
  .rps-list-label{font-size:calc((10px) + 1px);font-weight:800;color:#555;text-transform:uppercase;letter-spacing:.7px;display:flex;align-items:center;gap:6px}
  .rps-count{background:rgba(255,255,255,.07);border-radius:10px;padding:1px 7px;font-size:calc((10px) + 1px);color:#666}
  .rps-new-btn{display:flex;align-items:center;gap:4px;padding:5px 10px;border-radius:7px;background:rgba(156,255,0,.1);border:1px solid rgba(156,255,0,.25);color:#9cff00;font-size:calc((11px) + 1px);font-weight:800;cursor:pointer;transition:all .15s}
  .rps-new-btn:hover{background:rgba(156,255,0,.18)}

  .rps-create-row{display:flex;gap:5px;margin-bottom:10px}
  .rps-create-inp{flex:1;background:rgba(18,18,18,.95);border:1.5px solid rgba(156,255,0,.3);border-radius:7px;padding:7px 10px;color:#fff;font-size:calc((12px) + 1px);outline:none}
  .rps-ok-btn{width:30px;height:30px;border-radius:7px;background:rgba(156,255,0,.12);border:1px solid rgba(156,255,0,.3);color:#9cff00;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;flex-shrink:0}
  .rps-ok-btn:disabled{opacity:.4;cursor:not-allowed}
  .rps-cancel-btn{width:30px;height:30px;border-radius:7px;background:rgba(255,100,100,.07);border:1px solid rgba(255,100,100,.2);color:#ff6b6b;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}

  .rps-roles-list{display:flex;flex-direction:column;gap:3px}
  .rps-no-roles{display:flex;flex-direction:column;align-items:center;gap:8px;padding:32px 0;color:#333}
  .rps-no-roles p{font-size:calc((12px) + 1px);color:#444;margin:0}

  .rps-role-row{display:flex;align-items:center;gap:9px;padding:10px 12px;background:rgba(16,16,16,.8);border:1px solid rgba(30,30,30,.9);border-radius:9px;cursor:pointer;transition:all .15s}
  .rps-role-row:hover{background:rgba(20,20,20,.95);border-color:rgba(156,255,0,.2);transform:translateX(3px)}
  .rps-role-row.dragging{opacity:.5;border-color:#9cff00}
  .rps-role-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
  .rps-role-name{flex:1;font-size:calc((13px) + 1px);font-weight:700;color:#ccc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .rps-role-row:hover .rps-role-name{color:#fff}
  .rps-role-members{display:flex;align-items:center;gap:3px;font-size:calc((10px) + 1px);color:#555;flex-shrink:0}
  .rps-role-merged{font-size:calc((9px) + 1px);color:#777;padding:2px 5px;border:1px solid rgba(255,255,255,.08);border-radius:5px}
  .rps-role-arrow{color:#444;transition:color .15s}
  .rps-role-row:hover .rps-role-arrow{color:#9cff00}

  /* EDIT VIEW */
  .rps-edit-view{display:flex;flex-direction:column;height:100%;overflow:hidden}

  .rps-edit-topbar{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.05);flex-shrink:0}
  .rps-back-btn{width:28px;height:28px;border-radius:7px;background:rgba(20,20,20,.9);border:1px solid rgba(38,38,38,.9);color:#9cff00;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;flex-shrink:0}
  .rps-back-btn:hover{border-color:rgba(156,255,0,.4);transform:translateX(-2px)}
  .rps-edit-role-dot{width:12px;height:12px;border-radius:50%;flex-shrink:0}
  .rps-edit-role-name{flex:1;font-size:calc((13px) + 1px);font-weight:800;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .rps-save-btn{display:flex;align-items:center;gap:4px;padding:5px 11px;border-radius:7px;background:rgba(156,255,0,.1);border:1.5px solid rgba(156,255,0,.28);color:#9cff00;font-size:calc((11px) + 1px);font-weight:800;cursor:pointer;transition:all .2s;flex-shrink:0;white-space:nowrap}
  .rps-save-btn:hover:not(:disabled){background:rgba(156,255,0,.2)}
  .rps-save-btn.saved{background:rgba(16,185,129,.1);border-color:rgba(16,185,129,.3);color:#10b981}
  .rps-save-btn:disabled{opacity:.5;cursor:not-allowed}
  .rps-spin{width:12px;height:12px;border:2px solid rgba(156,255,0,.2);border-top-color:#9cff00;border-radius:50%;animation:rpsSpin .7s linear infinite;display:inline-block}
  @keyframes rpsSpin{to{transform:rotate(360deg)}}

  .rps-tabs{display:flex;border-bottom:1px solid rgba(255,255,255,.05);flex-shrink:0;padding:0 12px}
  .rps-tab{padding:9px 14px;font-size:calc((12px) + 1px);font-weight:700;color:#555;border:none;background:transparent;cursor:pointer;border-bottom:2px solid transparent;transition:all .15s;margin-bottom:-1px}
  .rps-tab:hover{color:#ccc}
  .rps-tab.active{color:#9cff00;border-bottom-color:#9cff00}

  /* Display tab */
  .rps-display{padding:14px 12px;overflow-y:auto;flex:1}
  .rps-display::-webkit-scrollbar{width:3px}
  .rps-display::-webkit-scrollbar-thumb{background:rgba(156,255,0,.2);border-radius:2px}
  .rps-field-label{font-size:calc((10px) + 1px);font-weight:800;color:#555;text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px}
  .rps-name-inp{width:100%;box-sizing:border-box;background:rgba(16,16,16,.95);border:1.5px solid rgba(38,38,38,.9);border-radius:8px;padding:9px 12px;color:#fff;font-size:calc((13px) + 1px);font-weight:700;outline:none;transition:border-color .2s}
  .rps-role-icon-input{width:64px;height:42px;box-sizing:border-box;text-align:center;background:rgba(16,16,16,.95);border:1.5px solid rgba(38,38,38,.9);border-radius:8px;padding:6px;color:#fff;font-size:calc((22px) + 1px);outline:none}
  .rps-name-inp:focus{border-color:rgba(156,255,0,.4)}
  .rps-name-inp:disabled{background:transparent;border-color:rgba(30,30,30,.5)}

  .rps-color-grid{display:grid;grid-template-columns:repeat(8,1fr);gap:6px;margin-bottom:14px}
  .rps-swatch{aspect-ratio:1;border-radius:6px;border:2px solid transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s}
  .rps-swatch.active{border-color:#fff;transform:scale(1.1);box-shadow:0 2px 8px rgba(0,0,0,.5)}
  .rps-swatch:hover{transform:scale(1.08)}

  .rps-stats-row{display:flex;gap:8px;margin-bottom:10px}
  .rps-stat-pill{display:flex;align-items:center;gap:6px;padding:8px 12px;border-radius:9px;background:rgba(16,16,16,.9);border:1px solid rgba(32,32,32,.9);font-size:calc((11px) + 1px);color:#888;font-weight:700;flex:1}
  .rps-default-tag{padding:7px 10px;border-radius:8px;background:rgba(102,126,234,.08);border:1px solid rgba(102,126,234,.2);color:#667eea;font-size:calc((11px) + 1px);font-weight:700;text-align:center}
  .rps-owner-tag{display:flex;align-items:center;justify-content:center;gap:6px;padding:7px 10px;border-radius:8px;background:rgba(255,215,0,.06);border:1px solid rgba(255,215,0,.18);color:#FFD700;font-size:calc((11px) + 1px);font-weight:700}

  .rps-members{flex:1;overflow-y:auto;padding:14px 12px}
  .rps-member-row{display:flex;align-items:center;gap:9px;min-height:42px;padding:5px 8px;margin-bottom:5px;border-radius:9px;background:rgba(16,16,16,.8);border:1px solid rgba(30,30,30,.9)}
  .rps-member-avatar{width:32px;height:32px;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;background:rgba(156,255,0,.12);border:2px solid rgba(156,255,0,.22);color:#9cff00;font-weight:900;font-size:calc((12px) + 1px);flex-shrink:0}
  .rps-member-avatar img{width:100%;height:100%;object-fit:cover;display:block}
  .rps-member-info{display:flex;flex-direction:column;gap:2px;min-width:0}.rps-member-info strong{font-size:calc((12px) + 1px);color:#ddd;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rps-member-info span{font-size:calc((10px) + 1px);color:#666}
  .rps-empty-members{padding:18px 8px;color:#555;font-size:calc((11px) + 1px);text-align:center}
  .rps-assign-label{display:flex;flex-direction:column;gap:7px;margin-top:14px;font-size:calc((10px) + 1px);font-weight:800;color:#666;text-transform:uppercase;letter-spacing:.5px}
  .rps-assign-label select{padding:9px 10px;border-radius:8px;background:#121212;border:1px solid rgba(156,255,0,.25);color:#bbb;font-size:calc((12px) + 1px);outline:none}
  .rps-access-panel{margin-top:12px;padding-top:6px;border-top:1px solid rgba(255,255,255,.05)}

  /* Permissions tab */
  .rps-perms{flex:1;overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:0}
  .rps-perms::-webkit-scrollbar{width:3px}
  .rps-perms::-webkit-scrollbar-thumb{background:rgba(156,255,0,.18);border-radius:2px}
  .rps-owner-notice{display:flex;align-items:center;gap:7px;padding:9px 10px;border-radius:8px;background:rgba(255,215,0,.05);border:1px solid rgba(255,215,0,.15);color:#FFD700;font-size:calc((11px) + 1px);font-weight:700;margin-bottom:10px}

`;

export default RolesPermissionsSection;