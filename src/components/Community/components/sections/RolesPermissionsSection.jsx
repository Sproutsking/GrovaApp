// src/components/Community/components/sections/RolesPermissionsSection.jsx
// Designed for NARROW sidebar context (~360-400px wide).
// Layout: role list on top → editor below (vertical stack, not side-by-side)
// Toggle switches for each permission, grouped & searchable.
import React, { useState, useEffect } from "react";
import {
  Plus, Search, Shield, ChevronRight, ChevronLeft,
  Check, X, Users, Crown, Save, Trash2,
} from "lucide-react";

// ─── Permission groups (Discord-style but ours) ───────────────────────────────
const PERM_GROUPS = [
  {
    label: "General",
    perms: [
      { key: "viewChannels",    label: "View Channels",    desc: "See channels & read messages" },
      { key: "manageChannels",  label: "Manage Channels",  desc: "Create, edit, delete channels" },
      { key: "manageRoles",     label: "Manage Roles",     desc: "Create & edit roles below this" },
      { key: "viewAuditLog",    label: "View Audit Log",   desc: "See community action history" },
      { key: "manageCommunity", label: "Manage Community", desc: "Change community settings" },
      { key: "manageInvites",   label: "Manage Invites",   desc: "Create, revoke and view invites" },
      { key: "administrator",   label: "Administrator",    desc: "All permissions — use carefully", danger: true },
    ],
  },
  {
    label: "Members",
    perms: [
      { key: "viewMembers",       label: "View Members",       desc: "See the member list" },
      { key: "inviteMembers",     label: "Invite Members",     desc: "Create invite links" },
      { key: "kickMembers",       label: "Kick Members",       desc: "Remove members" },
      { key: "banMembers",        label: "Ban Members",        desc: "Permanently ban members" },
      { key: "manageNicknames",   label: "Manage Nicknames",   desc: "Change any member's nickname" },
      { key: "changeOwnNickname", label: "Change Own Nickname",desc: "Change your display name" },
      { key: "timeoutMembers",    label: "Timeout Members",    desc: "Temporarily mute members" },
      { key: "assignRoles",       label: "Assign Roles",       desc: "Give members roles below yours" },
    ],
  },
  {
    label: "Messages",
    perms: [
      { key: "sendMessages",       label: "Send Messages",      desc: "Post in text channels" },
      { key: "attachFiles",        label: "Attach Files",       desc: "Upload images & files" },
      { key: "embedLinks",         label: "Embed Links",        desc: "Show link previews" },
      { key: "addReactions",       label: "Add Reactions",      desc: "React to messages" },
      { key: "useExternalEmojis",  label: "External Emojis",    desc: "Use emojis from other communities" },
      { key: "mentionEveryone",    label: "@everyone / @here",  desc: "Ping all / online members" },
      { key: "useSlashCommands",   label: "Slash Commands",     desc: "Use / commands" },
      { key: "manageMessages",     label: "Manage Messages",    desc: "Delete / pin others' messages" },
      { key: "pinMessages",        label: "Pin Messages",       desc: "Pin messages in channels" },
      { key: "readMessageHistory", label: "Message History",    desc: "View past messages" },
      { key: "bypassSlowMode",     label: "Bypass Slow Mode",   desc: "Send without slow mode limit" },
    ],
  },
];

// ─── Tiny toggle switch ───────────────────────────────────────────────────────
const Toggle = ({ on, onChange, disabled }) => (
  <button
    className={`rps-tog${on ? " on" : ""}${disabled ? " dis" : ""}`}
    onClick={() => !disabled && onChange(!on)}
    disabled={disabled}
    role="switch"
    aria-checked={on}
  >
    <span className="rps-tog-thumb" />
  </button>
);

// ─── Role color swatches ──────────────────────────────────────────────────────
const COLORS = [
  "#95A5A6","#667eea","#9cff00","#FFD700","#f5576c",
  "#f093fb","#4facfe","#43e97b","#fa709a","#ff6b6b",
  "#ffd89b","#00c9ff","#c471ed","#f97316","#10b981",
];

// ─── Main component ───────────────────────────────────────────────────────────
const RolesPermissionsSection = ({
  roles = [],
  members = [],
  canManageRoles = false,
  onUpdateRole,
  onCreateRole,
}) => {
  // "list" view → shows role list
  // "edit" view → shows editor for selectedRole
  const [view, setView]               = useState("list");
  const [selectedRole, setSelectedRole] = useState(null);
  const [editedPerms, setEditedPerms]   = useState({});
  const [editedName, setEditedName]     = useState("");
  const [editedColor, setEditedColor]   = useState("#667eea");
  const [permSearch, setPermSearch]     = useState("");
  const [activeTab, setActiveTab]       = useState("permissions");
  const [saving, setSaving]             = useState(false);
  const [saved, setSaved]               = useState(false);
  const [showCreate, setShowCreate]     = useState(false);
  const [newName, setNewName]           = useState("");

  const openRole = (role) => {
    setSelectedRole(role);
    setEditedPerms(role.permissions || {});
    setEditedName(role.name || "");
    setEditedColor(role.color || "#667eea");
    setPermSearch("");
    setActiveTab("permissions");
    setView("edit");
  };

  const memberCount = (roleId) => members.filter((m) => m.role_id === roleId).length;

  const handleSave = async () => {
    if (!selectedRole || !canManageRoles) return;
    setSaving(true);
    try {
      await onUpdateRole(selectedRole.id, {
        permissions: editedPerms,
        name: editedName,
        color: editedColor,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Save role error:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await onCreateRole({ name: newName.trim(), color: "#667eea" });
      setNewName("");
      setShowCreate(false);
    } catch (err) {
      console.error("Create role error:", err);
    }
  };

  const isOwnerRole = selectedRole?.name === "Owner";

  const filteredGroups = PERM_GROUPS.map((g) => ({
    ...g,
    perms: g.perms.filter((p) =>
      !permSearch ||
      p.label.toLowerCase().includes(permSearch.toLowerCase()) ||
      p.desc.toLowerCase().includes(permSearch.toLowerCase())
    ),
  })).filter((g) => g.perms.length > 0);

  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  if (view === "list") {
    return (
      <div className="rps-list-view">
        {/* Header row */}
        <div className="rps-list-head">
          <span className="rps-list-label">ROLES <span className="rps-count">{roles.length}</span></span>
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

        {/* Role rows */}
        <div className="rps-roles-list">
          {roles.length === 0 && (
            <div className="rps-no-roles">
              <Shield size={24} color="#333" />
              <p>No roles yet</p>
            </div>
          )}
          {roles.map((role) => (
            <div key={role.id} className="rps-role-row" onClick={() => openRole(role)}>
              <span className="rps-role-dot" style={{ background: role.color || "#667eea" }} />
              <span className="rps-role-name">{role.name}</span>
              <span className="rps-role-members"><Users size={10} />{memberCount(role.id)}</span>
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
        {canManageRoles && !isOwnerRole && (
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
            disabled={!canManageRoles || isOwnerRole}
          />

          {/* Color */}
          <div className="rps-field-label" style={{ marginTop: 14 }}>Role Color</div>
          <div className="rps-color-grid">
            {COLORS.map((c) => (
              <button
                key={c}
                className={`rps-swatch${editedColor === c ? " active" : ""}`}
                style={{ background: c }}
                onClick={() => canManageRoles && !isOwnerRole && setEditedColor(c)}
              >
                {editedColor === c && <Check size={9} color="#000" strokeWidth={3} />}
              </button>
            ))}
          </div>

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
            <div className="rps-owner-tag"><Crown size={12} color="#FFD700" /> Owner has all permissions</div>
          )}
        </div>
      )}

      {/* ── Permissions tab ── */}
      {activeTab === "permissions" && (
        <div className="rps-perms">
          {/* Search */}
          <div className="rps-perm-search">
            <Search size={12} color="#555" />
            <input
              className="rps-perm-search-inp"
              placeholder="Search permissions…"
              value={permSearch}
              onChange={(e) => setPermSearch(e.target.value)}
            />
            {permSearch && (
              <button className="rps-perm-clear" onClick={() => setPermSearch("")}><X size={11} /></button>
            )}
          </div>

          {isOwnerRole && (
            <div className="rps-owner-notice">
              <Crown size={13} color="#FFD700" /> Owner has all permissions permanently
            </div>
          )}

          {/* Permission groups */}
          {filteredGroups.map((group) => (
            <div key={group.label} className="rps-perm-group">
              <div className="rps-perm-group-label">{group.label}</div>
              {group.perms.map((perm) => {
                const enabled = isOwnerRole ? true : !!editedPerms[perm.key];
                return (
                  <div key={perm.key} className={`rps-perm-row${perm.danger ? " danger" : ""}`}>
                    <div className="rps-perm-info">
                      <div className="rps-perm-label">{perm.label}</div>
                      <div className="rps-perm-desc">{perm.desc}</div>
                    </div>
                    <Toggle
                      on={enabled}
                      onChange={() => setEditedPerms((p) => ({ ...p, [perm.key]: !p[perm.key] }))}
                      disabled={!canManageRoles || isOwnerRole}
                    />
                  </div>
                );
              })}
            </div>
          ))}

          {filteredGroups.length === 0 && (
            <div className="rps-no-match">No permissions match "{permSearch}"</div>
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
  .rps-list-label{font-size:10px;font-weight:800;color:#555;text-transform:uppercase;letter-spacing:.7px;display:flex;align-items:center;gap:6px}
  .rps-count{background:rgba(255,255,255,.07);border-radius:10px;padding:1px 7px;font-size:10px;color:#666}
  .rps-new-btn{display:flex;align-items:center;gap:4px;padding:5px 10px;border-radius:7px;background:rgba(156,255,0,.1);border:1px solid rgba(156,255,0,.25);color:#9cff00;font-size:11px;font-weight:800;cursor:pointer;transition:all .15s}
  .rps-new-btn:hover{background:rgba(156,255,0,.18)}

  .rps-create-row{display:flex;gap:5px;margin-bottom:10px}
  .rps-create-inp{flex:1;background:rgba(18,18,18,.95);border:1.5px solid rgba(156,255,0,.3);border-radius:7px;padding:7px 10px;color:#fff;font-size:12px;outline:none}
  .rps-ok-btn{width:30px;height:30px;border-radius:7px;background:rgba(156,255,0,.12);border:1px solid rgba(156,255,0,.3);color:#9cff00;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;flex-shrink:0}
  .rps-ok-btn:disabled{opacity:.4;cursor:not-allowed}
  .rps-cancel-btn{width:30px;height:30px;border-radius:7px;background:rgba(255,100,100,.07);border:1px solid rgba(255,100,100,.2);color:#ff6b6b;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}

  .rps-roles-list{display:flex;flex-direction:column;gap:3px}
  .rps-no-roles{display:flex;flex-direction:column;align-items:center;gap:8px;padding:32px 0;color:#333}
  .rps-no-roles p{font-size:12px;color:#444;margin:0}

  .rps-role-row{display:flex;align-items:center;gap:9px;padding:10px 12px;background:rgba(16,16,16,.8);border:1px solid rgba(30,30,30,.9);border-radius:9px;cursor:pointer;transition:all .15s}
  .rps-role-row:hover{background:rgba(20,20,20,.95);border-color:rgba(156,255,0,.2);transform:translateX(3px)}
  .rps-role-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
  .rps-role-name{flex:1;font-size:13px;font-weight:700;color:#ccc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .rps-role-row:hover .rps-role-name{color:#fff}
  .rps-role-members{display:flex;align-items:center;gap:3px;font-size:10px;color:#555;flex-shrink:0}
  .rps-role-arrow{color:#444;transition:color .15s}
  .rps-role-row:hover .rps-role-arrow{color:#9cff00}

  /* EDIT VIEW */
  .rps-edit-view{display:flex;flex-direction:column;height:100%;overflow:hidden}

  .rps-edit-topbar{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.05);flex-shrink:0}
  .rps-back-btn{width:28px;height:28px;border-radius:7px;background:rgba(20,20,20,.9);border:1px solid rgba(38,38,38,.9);color:#9cff00;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;flex-shrink:0}
  .rps-back-btn:hover{border-color:rgba(156,255,0,.4);transform:translateX(-2px)}
  .rps-edit-role-dot{width:12px;height:12px;border-radius:50%;flex-shrink:0}
  .rps-edit-role-name{flex:1;font-size:13px;font-weight:800;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .rps-save-btn{display:flex;align-items:center;gap:4px;padding:5px 11px;border-radius:7px;background:rgba(156,255,0,.1);border:1.5px solid rgba(156,255,0,.28);color:#9cff00;font-size:11px;font-weight:800;cursor:pointer;transition:all .2s;flex-shrink:0;white-space:nowrap}
  .rps-save-btn:hover:not(:disabled){background:rgba(156,255,0,.2)}
  .rps-save-btn.saved{background:rgba(16,185,129,.1);border-color:rgba(16,185,129,.3);color:#10b981}
  .rps-save-btn:disabled{opacity:.5;cursor:not-allowed}
  .rps-spin{width:12px;height:12px;border:2px solid rgba(156,255,0,.2);border-top-color:#9cff00;border-radius:50%;animation:rpsSpin .7s linear infinite;display:inline-block}
  @keyframes rpsSpin{to{transform:rotate(360deg)}}

  .rps-tabs{display:flex;border-bottom:1px solid rgba(255,255,255,.05);flex-shrink:0;padding:0 12px}
  .rps-tab{padding:9px 14px;font-size:12px;font-weight:700;color:#555;border:none;background:transparent;cursor:pointer;border-bottom:2px solid transparent;transition:all .15s;margin-bottom:-1px}
  .rps-tab:hover{color:#ccc}
  .rps-tab.active{color:#9cff00;border-bottom-color:#9cff00}

  /* Display tab */
  .rps-display{padding:14px 12px;overflow-y:auto;flex:1}
  .rps-display::-webkit-scrollbar{width:3px}
  .rps-display::-webkit-scrollbar-thumb{background:rgba(156,255,0,.2);border-radius:2px}
  .rps-field-label{font-size:10px;font-weight:800;color:#555;text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px}
  .rps-name-inp{width:100%;box-sizing:border-box;background:rgba(16,16,16,.95);border:1.5px solid rgba(38,38,38,.9);border-radius:8px;padding:9px 12px;color:#fff;font-size:13px;font-weight:700;outline:none;transition:border-color .2s}
  .rps-name-inp:focus{border-color:rgba(156,255,0,.4)}
  .rps-name-inp:disabled{background:transparent;border-color:rgba(30,30,30,.5)}

  .rps-color-grid{display:grid;grid-template-columns:repeat(8,1fr);gap:6px;margin-bottom:14px}
  .rps-swatch{aspect-ratio:1;border-radius:6px;border:2px solid transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s}
  .rps-swatch.active{border-color:#fff;transform:scale(1.1);box-shadow:0 2px 8px rgba(0,0,0,.5)}
  .rps-swatch:hover{transform:scale(1.08)}

  .rps-stats-row{display:flex;gap:8px;margin-bottom:10px}
  .rps-stat-pill{display:flex;align-items:center;gap:6px;padding:8px 12px;border-radius:9px;background:rgba(16,16,16,.9);border:1px solid rgba(32,32,32,.9);font-size:11px;color:#888;font-weight:700;flex:1}
  .rps-default-tag{padding:7px 10px;border-radius:8px;background:rgba(102,126,234,.08);border:1px solid rgba(102,126,234,.2);color:#667eea;font-size:11px;font-weight:700;text-align:center}
  .rps-owner-tag{display:flex;align-items:center;justify-content:center;gap:6px;padding:7px 10px;border-radius:8px;background:rgba(255,215,0,.06);border:1px solid rgba(255,215,0,.18);color:#FFD700;font-size:11px;font-weight:700}

  /* Permissions tab */
  .rps-perms{flex:1;overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:0}
  .rps-perms::-webkit-scrollbar{width:3px}
  .rps-perms::-webkit-scrollbar-thumb{background:rgba(156,255,0,.18);border-radius:2px}

  .rps-perm-search{display:flex;align-items:center;gap:6px;padding:7px 10px;background:rgba(12,12,12,.98);border:1px solid rgba(36,36,36,.9);border-radius:8px;margin-bottom:10px}
  .rps-perm-search-inp{flex:1;background:transparent;border:none;color:#fff;font-size:12px;outline:none}
  .rps-perm-search-inp::placeholder{color:#444}
  .rps-perm-clear{background:none;border:none;color:#555;cursor:pointer;display:flex;align-items:center;padding:0}

  .rps-owner-notice{display:flex;align-items:center;gap:7px;padding:9px 10px;border-radius:8px;background:rgba(255,215,0,.05);border:1px solid rgba(255,215,0,.15);color:#FFD700;font-size:11px;font-weight:700;margin-bottom:10px}

  .rps-perm-group{margin-bottom:14px}
  .rps-perm-group-label{font-size:9px;font-weight:800;color:#444;text-transform:uppercase;letter-spacing:.8px;margin-bottom:5px;padding:0 1px}

  .rps-perm-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 10px;background:rgba(13,13,13,.95);border:1px solid rgba(28,28,28,.9);border-radius:8px;margin-bottom:3px;transition:border-color .12s}
  .rps-perm-row:hover{border-color:rgba(156,255,0,.12)}
  .rps-perm-row.danger{border-color:rgba(255,107,107,.1)}
  .rps-perm-row.danger:hover{border-color:rgba(255,107,107,.25)}
  .rps-perm-info{flex:1;min-width:0}
  .rps-perm-label{font-size:12px;font-weight:700;color:#ccc;margin-bottom:1px}
  .rps-perm-row.danger .rps-perm-label{color:#ffaaaa}
  .rps-perm-desc{font-size:10px;color:#444;line-height:1.35}

  .rps-no-match{text-align:center;color:#444;font-size:12px;padding:20px 0}

  /* Toggle switch */
  .rps-tog{width:38px;height:20px;border-radius:10px;background:rgba(40,40,40,.9);border:none;cursor:pointer;position:relative;flex-shrink:0;padding:0;transition:background .22s}
  .rps-tog.on{background:rgba(156,255,0,.75)}
  .rps-tog.dis{opacity:.38;cursor:not-allowed}
  .rps-perm-row.danger .rps-tog.on{background:rgba(255,107,107,.7)}
  .rps-tog-thumb{position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:50%;background:#fff;transition:transform .22s;box-shadow:0 1px 3px rgba(0,0,0,.4)}
  .rps-tog.on .rps-tog-thumb{transform:translateX(18px)}
`;

export default RolesPermissionsSection;