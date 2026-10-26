// components/Community/modals/ChannelPermissionsModal.jsx
// Per-channel permission overrides: which roles can view / send / react, etc.
import React, { useState, useEffect } from "react";
import { X, Lock, MessageSquare, Eye, Smile, Paperclip, AtSign, Shield, Search, Check, RotateCcw } from "lucide-react";
import { supabase } from "../../../services/config/supabase";
import { groupVerificationRoles } from "../verification/verificationConfig";

const PERMISSIONS = [
  { key: "viewChannel",      icon: Eye,          label: "View Channel",       desc: "See this channel in the list and read messages" },
  { key: "sendMessages",     icon: MessageSquare, label: "Send Messages",      desc: "Post messages in this channel" },
  { key: "addReactions",     icon: Smile,         label: "Add Reactions",      desc: "React to messages with emoji" },
  { key: "attachFiles",      icon: Paperclip,     label: "Attach Files",       desc: "Upload images and files" },
  { key: "mentionEveryone",  icon: AtSign,        label: "@everyone / @here",  desc: "Ping all members or online members" },
  { key: "manageMessages",   icon: Shield,        label: "Manage Messages",    desc: "Delete or pin any message" },
];

const PERMISSION_GROUPS = [
  { label: "Channel access", permissions: ["viewChannel"] },
  { label: "Messages", permissions: ["sendMessages", "addReactions", "attachFiles", "mentionEveryone"] },
  { label: "Moderation", permissions: ["manageMessages"] },
];
const STATES = ["inherit", "allow", "deny"];
const STATE_LABELS = { inherit: "Inherit", allow: "Allow", deny: "Deny" };

const ChannelPermissionsModal = ({ channel, category, communityId, roles, onClose, onSave }) => {
  const target = category || channel;
  const isCategory = Boolean(category);
  // Map: { [roleId]: { [permKey]: "inherit"|"allow"|"deny" } }
  const [overrides, setOverrides] = useState({});
  const [selectedRole, setSelectedRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [roleSearch, setRoleSearch] = useState("");
  const [permissionSearch, setPermissionSearch] = useState("");
  const orderedRoles = [...roles].sort((left, right) =>
    Number(String(right.name || "").trim().toLowerCase() === "owner")
      - Number(String(left.name || "").trim().toLowerCase() === "owner")
      || (left.position ?? 99) - (right.position ?? 99)
      || String(left.name || "").localeCompare(String(right.name || "")),
  );
  const roleGroups = groupVerificationRoles(orderedRoles).filter((group) =>
    group.roles.some((role) => `${role.name || ""} ${role.id || ""}`.toLowerCase().includes(roleSearch.toLowerCase())),
  );
  const visiblePermissionGroups = PERMISSION_GROUPS.map((group) => ({
    ...group,
    permissions: group.permissions
      .map((key) => PERMISSIONS.find((permission) => permission.key === key))
      .filter((permission) => permission && `${permission.label} ${permission.desc}`.toLowerCase().includes(permissionSearch.toLowerCase())),
  })).filter((group) => group.permissions.length);

  useEffect(() => {
    loadOverrides();
    setSelectedRole(roleGroups[0]?.role || orderedRoles[0] || null);
  }, [target.id, isCategory, roles]);

  const loadOverrides = async () => {
    try {
      setLoading(true);
      setLoadFailed(false);
      const { data, error } = await supabase
        .from(isCategory ? "category_permission_overrides" : "channel_permission_overrides")
        .select("*")
        .eq(isCategory ? "category_id" : "channel_id", target.id);

      if (error) throw error;

      const map = {};
      (data || []).forEach((row) => {
        if (!map[row.role_id]) map[row.role_id] = {};
        map[row.role_id][row.permission] = row.state; // "allow"|"deny"
      });
      setOverrides(map);
      setErrorMessage("");
    } catch (err) {
      console.error("Load overrides error:", err);
      setLoadFailed(true);
      setErrorMessage(err.message || "Could not load permissions.");
    } finally {
      setLoading(false);
    }
  };

  const roleIdsFor = (roleId) => roleGroups.find((group) => group.role.id === roleId)?.roles.map((role) => role.id) || [roleId];
  const getState = (roleId, permKey) => roleIdsFor(roleId).map((id) => overrides[id]?.[permKey]).find((state) => state && state !== "inherit") || "inherit";

  const setState = (roleId, permKey, state) => {
    setOverrides((prev) => ({
      ...prev,
      ...Object.fromEntries(roleIdsFor(roleId).map((id) => [id, { ...(prev[id] || {}), [permKey]: state }])),
    }));
  };

  const handleSave = async () => {
    if (loading || loadFailed) return;
    setSaving(true);
    setErrorMessage("");
    try {
      const table = isCategory ? "category_permission_overrides" : "channel_permission_overrides";
      const targetColumn = isCategory ? "category_id" : "channel_id";
      const rows = [];
      Object.entries(overrides).forEach(([roleId, perms]) => {
        Object.entries(perms).forEach(([permKey, state]) => {
          if (state !== "inherit") {
            rows.push({
              community_id: communityId,
              ...(isCategory ? { category_id: category.id, apply_to_channels: true } : { channel_id: channel.id }),
              role_id: roleId,
              permission: permKey,
              state,
              updated_at: new Date().toISOString(),
            });
          }
        });
      });

      if (rows.length > 0) {
        const { error: upsertError } = await supabase
          .from(table)
          .upsert(rows, { onConflict: `${targetColumn},role_id,permission` });
        if (upsertError) throw upsertError;
      }

      const { data: existingRows, error: existingError } = await supabase
        .from(table)
        .select("id,role_id,permission")
        .eq(targetColumn, target.id);
      if (existingError) throw existingError;
      const desiredKeys = new Set(rows.map((row) => `${row.role_id}:${row.permission}`));
      const staleIds = (existingRows || [])
        .filter((row) => !desiredKeys.has(`${row.role_id}:${row.permission}`))
        .map((row) => row.id);
      if (staleIds.length > 0) {
        const { error: deleteError } = await supabase.from(table).delete().in("id", staleIds);
        if (deleteError) throw deleteError;
      }

      if (onSave) onSave();
      onClose();
    } catch (err) {
      console.error("Save overrides error:", err);
      setErrorMessage(err.message || "Could not save permissions.");
    } finally {
      setSaving(false);
    }
  };

  const resetRole = (roleId) => {
    setOverrides((prev) => {
      const next = { ...prev };
      roleIdsFor(roleId).forEach((id) => delete next[id]);
      return next;
    });
  };

  const resetSelectedRole = () => selectedRole && resetRole(selectedRole.id);

  const getRoleOverrideCount = (roleId) => roleIdsFor(roleId).reduce((count, id) =>
    count + Object.values(overrides[id] || {}).filter((state) => state !== "inherit").length, 0);

  return (
    <div className="cp-overlay" onClick={onClose}>
      <div className="cp-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="cp-head">
          <div className="cp-title">
            <Lock size={16} color="#9cff00" />
            <span>{isCategory ? target.name : `#${target.name}`}</span>
            <span className="cp-sub">Permissions</span>
          </div>
          <button className="cp-close" onClick={onClose}><X size={17} /></button>
        </div>

        <div className="cp-body">
          <aside className="cp-role-sidebar">
            <div className="cp-role-summary"><strong>Roles</strong><span>{roleGroups.length}</span></div>
            <label className="cp-search cp-role-search"><Search size={14} /><input aria-label="Search roles" value={roleSearch} onChange={(event) => setRoleSearch(event.target.value)} placeholder="Find a role" /></label>
            <div className="role-list" aria-label="Community roles">
              {roleGroups.map(({ role, roles: groupedRoles }) => {
                const overrideCount = groupedRoles.reduce((count, entry) => count + getRoleOverrideCount(entry.id), 0);
                return <button
                  type="button"
                  key={role.id}
                  className={`role-pill${selectedRole?.id === role.id ? " active" : ""}`}
                  aria-pressed={selectedRole?.id === role.id}
                  aria-label={`Select role ${role.name} (${role.id})`}
                  onClick={() => setSelectedRole(role)}
                >
                  <span className="role-dot" style={{ background: role.color || "#667eea" }}>{role.icon || "♟"}</span>
                  <span className="cp-role-name">{role.name}</span>
                  {groupedRoles.length > 1 && <span className="override-badge cp-role-entry-count">{groupedRoles.length}</span>}
                  {overrideCount > 0 && <span className="override-badge">{overrideCount}</span>}
                </button>;
              })}
              {!roleGroups.length && <p className="cp-empty">No roles match your search.</p>}
            </div>
          </aside>

          {/* Permission table for selected role */}
          {selectedRole && (
            <div className="perm-panel">
              <div className="perm-role-head">
                <span className="role-dot-lg" style={{ background: selectedRole.color || "#667eea" }}>{selectedRole.icon || "♟"}</span>
                <div className="cp-selected-role"><strong>{selectedRole.name}</strong><span>{getRoleOverrideCount(selectedRole.id)} overrides configured</span></div>
                <button type="button" className="reset-btn" onClick={resetSelectedRole} disabled={!getRoleOverrideCount(selectedRole.id)}><RotateCcw size={13} /> Reset</button>
              </div>
              <label className="cp-search cp-permission-search"><Search size={14} /><input aria-label="Search channel permissions" value={permissionSearch} onChange={(event) => setPermissionSearch(event.target.value)} placeholder="Find a permission" /></label>
              <div className="perm-list">
                {loading ? (
                  <div className="perm-loading">Loading…</div>
                ) : (
                  visiblePermissionGroups.map((group) => <section className="cp-permission-group" key={group.label}>
                    <header><strong>{group.label}</strong><span>{group.permissions.length} permissions</span></header>
                    <div className="cp-permission-grid">
                      {group.permissions.map((perm) => {
                        const Icon = perm.icon;
                        const state = getState(selectedRole.id, perm.key);
                        return <div className={`perm-row state-${state}`} key={perm.key}>
                          <div className="perm-info">
                            <div className="perm-icon-wrap"><Icon size={15} /></div>
                            <div className="cp-permission-copy">
                              <strong className="perm-label">{perm.label}</strong>
                              <span className="perm-desc">{perm.desc}</span>
                            </div>
                          </div>
                          <div className="cp-state-options" role="group" aria-label={`${perm.label} permission`}>
                            {STATES.map((value) => <button
                              type="button"
                              key={value}
                              className={`cp-state-option ${value}${state === value ? " selected" : ""}`}
                              aria-label={`Set ${perm.label} for ${selectedRole.name} to ${STATE_LABELS[value]}`}
                              aria-pressed={state === value}
                              onClick={() => setState(selectedRole.id, perm.key, value)}
                            >{state === value && <Check size={11} />}{STATE_LABELS[value]}</button>)}
                          </div>
                        </div>;
                      })}
                    </div>
                  </section>)
                )}
                {!loading && !visiblePermissionGroups.length && <p className="cp-empty">No permissions match your search.</p>}
              </div>
              {errorMessage && <p className="perm-error" role="alert">{errorMessage}</p>}

              <div className="perm-legend">
                <span className="leg-item"><span className="dot allow" />Allow</span>
                <span className="leg-item"><span className="dot deny"  />Deny</span>
                <span className="leg-item"><span className="dot inherit"/>Inherit from role</span>
              </div>
            </div>
          )}
          {!selectedRole && <div className="cp-no-role">{loading ? "Loading channel permissions…" : "No community roles are available for this channel."}</div>}
        </div>

        <div className="cp-footer">
          <button className="cancel-btn" onClick={onClose}>Cancel</button>
          <button className="save-btn" onClick={handleSave} disabled={saving || loading || loadFailed}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>

      <style>{`
        .cp-overlay {
          position:fixed; inset:0;
          background:rgba(5,7,10,.48); backdrop-filter:blur(3px); -webkit-backdrop-filter:blur(3px);
          z-index:100004; display:flex; align-items:center; justify-content:center;
          padding:56px 20px 12px; box-sizing:border-box;
        }
        .cp-modal {
          width:min(100%, 540px); height:min(760px, calc(100dvh - 68px)); max-height:100%; min-height:0;
          background:rgba(12,14,18,.98); border:1.5px solid rgba(156,255,0,.18);
          border-radius:18px; display:flex; flex-direction:column;
          animation:modalIn .3s cubic-bezier(.4,0,.2,1);
          overflow:hidden;
          box-shadow:0 32px 90px rgba(0,0,0,.6), 0 0 42px rgba(156,255,0,.08);
        }
        @keyframes modalIn{
          from{opacity:0;transform:translateX(26px) scale(.98)}
          to  {opacity:1;transform:translateX(0) scale(1)}
        }

        @media (min-width: 768px) {
          .cp-overlay {
            justify-content: flex-end;
            align-items:stretch;
            padding:56px 0 0;
          }
          .cp-modal {
            width:min(50vw, 600px);
            max-width:600px;
            height:calc(100dvh - 56px);
            max-height:none;
            border-radius:24px 0 0 24px;
            box-shadow:-18px 0 60px rgba(0,0,0,.48), 0 0 60px rgba(156,255,0,.08);
          }
        }

        @media (max-width: 767px) {
          .cp-overlay {
            padding: 47px 12px 56px;
            align-items: center;
          }
          .cp-modal {
            width: min(100%, 540px);
            height: min(760px, calc(100dvh - 103px));
            max-height:100%;
            border-radius: 18px;
          }
        }

        .cp-head {
          display:flex; align-items:center; justify-content:space-between;
          padding:16px 18px; border-bottom:1px solid rgba(255,255,255,.05);
          flex-shrink:0;
        }
        .cp-title {
          display:flex; align-items:center; gap:8px;
          font-size:15px; font-weight:800; color:#fff;
        }
        .cp-sub { font-size:12px; color:#666; font-weight:600; }
        .cp-close {
          width:30px; height:30px; border-radius:7px;
          background:rgba(255,255,255,.05); border:none;
          color:#888; cursor:pointer;
          display:flex; align-items:center; justify-content:center; transition:all .2s;
        }
        .cp-close:hover { background:rgba(255,100,100,.15); color:#ff6b6b; }

        .cp-body {
          display:flex; gap:0; flex:1; overflow:hidden; min-height:0; height:0;
        }

        /* Role list sidebar */
        .role-list {
          width:140px; flex-shrink:0;
          border-right:1px solid rgba(255,255,255,.05);
          overflow-y:auto; padding:10px 8px;
          display:flex; flex-direction:column; gap:4px;
        }
        .role-list::-webkit-scrollbar{width:3px}
        .role-list::-webkit-scrollbar-thumb{background:rgba(156,255,0,.2);border-radius:2px}
        .role-pill {
          display:flex; align-items:center; gap:7px;
          padding:8px 10px; border-radius:8px; width:100%; text-align:left;
          background:transparent; border:none; color:#888; font-size:12px; font-weight:700;
          cursor:pointer; transition:all .15s; position:relative;
        }
        .role-pill:hover  { background:rgba(255,255,255,.05); color:#fff; }
        .role-pill.active { background:rgba(156,255,0,.1); color:#9cff00; }
        .role-merged-count{margin-left:auto;min-width:15px;padding:1px 4px;border-radius:5px;background:rgba(255,255,255,.08);color:#777;font-size:9px;text-align:center}
        .role-dot {
          width:8px; height:8px; border-radius:50%; flex-shrink:0;
        }
        .override-badge {
          width:6px; height:6px; border-radius:50%;
          background:#9cff00; position:absolute; top:6px; right:6px;
        }

        /* Permission panel */
        .perm-panel {
          flex:1; overflow-y:auto; padding:12px 16px;
          display:flex; flex-direction:column; gap:0;
        }
        .perm-panel::-webkit-scrollbar{width:4px}
        .perm-panel::-webkit-scrollbar-thumb{background:rgba(156,255,0,.2);border-radius:2px}

        .perm-role-head {
          display:flex; align-items:center; gap:8px;
          margin-bottom:12px;
        }
        .role-dot-lg {
          width:12px; height:12px; border-radius:50%; flex-shrink:0;
        }
        .perm-role-name { font-size:14px; font-weight:800; color:#fff; flex:1; }
        .reset-btn {
          padding:4px 10px; border-radius:6px; font-size:11px; font-weight:700;
          background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.08);
          color:#666; cursor:pointer; transition:all .15s;
        }
        .reset-btn:hover { border-color:rgba(255,107,107,.3); color:#ff6b6b; }

        .perm-list { display:flex; flex-direction:column; gap:6px; }
        .perm-loading { color:#555; font-size:13px; padding:20px 0; text-align:center; }
        .perm-error { margin:8px 0 0; color:#ff8b8b; font-size:11px; line-height:1.45; }

        .perm-row {
          display:flex; align-items:center; justify-content:space-between;
          padding:10px 12px; border-radius:10px;
          background:rgba(18,18,18,.95); border:1px solid rgba(42,42,42,.8);
          gap:10px; transition:border-color .15s;
        }
        .perm-row:hover { border-color:rgba(156,255,0,.15); }
        .perm-info { display:flex; align-items:center; gap:10px; flex:1; min-width:0; }
        .perm-icon-wrap {
          width:30px; height:30px; border-radius:7px;
          background:rgba(255,255,255,.05);
          display:flex; align-items:center; justify-content:center;
          color:#888; flex-shrink:0;
        }
        .perm-label { font-size:13px; font-weight:700; color:#ddd; }
        .perm-desc  { font-size:11px; color:#555; margin-top:1px; }

        /* State toggle button */
        .state-toggle {
          display:flex; align-items:center; gap:5px;
          padding:5px 10px; border-radius:7px;
          background:rgba(18,18,18,.95); border:1.5px solid;
          font-size:11px; font-weight:700; cursor:pointer;
          transition:all .18s; white-space:nowrap; flex-shrink:0;
        }
        .state-toggle:hover { filter:brightness(1.15); }

        /* Dots */
        .dot {
          width:7px; height:7px; border-radius:50%; flex-shrink:0;
        }
        .dot.allow   { background:#9cff00; }
        .dot.deny    { background:#ff6b6b; }
        .dot.inherit { background:#555; }

        .perm-legend {
          display:flex; gap:14px; margin-top:14px; padding-top:12px;
          border-top:1px solid rgba(255,255,255,.05);
        }
        .leg-item {
          display:flex; align-items:center; gap:5px;
          font-size:10px; color:#555; font-weight:600;
        }

        /* Footer */
        .cp-footer {
          display:flex; gap:8px; padding:14px 18px;
          border-top:1px solid rgba(255,255,255,.05); flex:0 0 auto; position:relative; z-index:2;
          background:rgba(12,14,18,.99);
        }
        .cancel-btn {
          flex:1; padding:11px; border-radius:10px;
          background:rgba(18,18,18,.95); border:1.5px solid rgba(42,42,42,.9);
          color:#888; font-size:13px; font-weight:700; cursor:pointer; transition:all .2s;
        }
        .cancel-btn:hover { border-color:rgba(255,107,107,.35); color:#ff6b6b; }
        .save-btn {
          flex:2; padding:11px; border-radius:10px;
          background:linear-gradient(135deg,#9cff00,#667eea);
          border:none; color:#000; font-size:13px; font-weight:800; cursor:pointer;
          transition:all .25s; box-shadow:0 4px 14px rgba(156,255,0,.25);
        }
        .save-btn:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 6px 20px rgba(156,255,0,.4); }
        .save-btn:disabled { opacity:.5; cursor:not-allowed; }

        @media(max-width:520px){
          .cp-modal{max-width:100%;border-radius:16px;}
          .role-list{width:110px;}
          .perm-row{flex-direction:column;align-items:flex-start;}
        }
        .cp-modal{--cp-text:#f2f5f2;--cp-muted:#a4ada6;--cp-subtle:#7f8982;background:#0c100e;border-color:rgba(156,255,0,.24)}
        .cp-head,.cp-footer{border-color:rgba(255,255,255,.1)}
        .cp-title{color:var(--cp-text)}.cp-sub{color:var(--cp-muted)}
        .cp-close{color:var(--cp-muted)}.cp-close:hover{color:#ff8585}
        .cp-body{display:grid;grid-template-columns:minmax(180px,220px) minmax(0,1fr);}
        .cp-role-sidebar{display:flex;flex-direction:column;gap:10px;min-width:0;min-height:0;padding:14px 10px;border-right:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.018)}
        .cp-role-summary{display:flex;align-items:center;justify-content:space-between;padding:0 5px;color:var(--cp-text);font-size:12px}
        .cp-role-summary span{padding:2px 7px;border:1px solid rgba(255,255,255,.12);border-radius:999px;color:var(--cp-muted);font-size:10px}
        .cp-search{display:flex;align-items:center;gap:7px;min-width:0;padding:8px 9px;border:1px solid rgba(255,255,255,.12);border-radius:8px;background:rgba(0,0,0,.22);color:var(--cp-muted)}
        .cp-search input{width:100%;min-width:0;border:0;outline:0;background:transparent;color:var(--cp-text);font:inherit;font-size:11px}
        .cp-search input::placeholder{color:var(--cp-subtle)}
        .role-list{width:auto;min-height:0;flex:1;padding:0;border:0;gap:4px}
        .role-list::-webkit-scrollbar-thumb,.perm-panel::-webkit-scrollbar-thumb{background:rgba(156,255,0,.3)}
        .role-pill{min-height:38px;padding:7px 8px;color:var(--cp-muted);font-size:11px}
        .role-pill:hover{background:rgba(255,255,255,.07);color:var(--cp-text)}
        .role-pill.active{background:rgba(156,255,0,.12);color:#c8ff78;box-shadow:inset 2px 0 #9cff00}
        .role-dot{display:grid;place-items:center;width:22px;height:22px;border-radius:6px;color:#111;font-size:12px}
        .cp-role-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .override-badge{position:static;display:grid;place-items:center;width:auto;height:auto;min-width:18px;padding:2px 5px;border-radius:999px;background:rgba(156,255,0,.14);color:#c8ff78;font-size:9px}
        .perm-panel{gap:12px;padding:16px;overscroll-behavior:contain}
        .perm-role-head{margin:0;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,.1)}
        .role-dot-lg{display:grid;place-items:center;width:32px;height:32px;border-radius:9px;color:#111;font-size:16px}
        .cp-selected-role{display:flex;flex:1;min-width:0;flex-direction:column;gap:2px}
        .cp-selected-role strong{overflow:hidden;color:var(--cp-text);font-size:13px;text-overflow:ellipsis;white-space:nowrap}
        .cp-selected-role span{color:var(--cp-muted);font-size:10px}
        .reset-btn{display:flex;align-items:center;gap:5px;color:var(--cp-muted)}
        .reset-btn:disabled{opacity:.4;cursor:not-allowed}
        .cp-permission-search{flex:0 0 auto}
        .perm-list{gap:16px}
        .cp-permission-group{display:grid;gap:8px}
        .cp-permission-group>header{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 2px}
        .cp-permission-group>header strong{color:var(--cp-text);font-size:12px}
        .cp-permission-group>header span{color:var(--cp-muted);font-size:10px}
        .cp-permission-grid{display:grid;gap:7px}
        .perm-row{flex-wrap:wrap;padding:10px;background:rgba(255,255,255,.035);border-color:rgba(255,255,255,.1)}
        .perm-row:hover{border-color:rgba(156,255,0,.3)}
        .perm-info{align-items:flex-start}
        .perm-icon-wrap{width:32px;height:32px;background:rgba(255,255,255,.07);color:#b8c0ba}
        .cp-permission-copy{display:flex;flex-direction:column;gap:3px;min-width:0}
        .perm-label{color:var(--cp-text);font-size:11px}
        .perm-desc{color:var(--cp-muted);font-size:10px;line-height:1.4}
        .cp-state-options{display:flex;gap:3px;flex-shrink:0;padding:3px;border:1px solid rgba(255,255,255,.1);border-radius:8px;background:rgba(0,0,0,.2)}
        .cp-state-option{display:inline-flex;align-items:center;justify-content:center;gap:4px;min-width:58px;padding:6px 7px;border:1px solid transparent;border-radius:6px;background:transparent;color:#a4ada6;font:700 9px inherit;cursor:pointer}
        .cp-state-option:hover{background:rgba(255,255,255,.07);color:var(--cp-text)}
        .cp-state-option.allow.selected{border-color:rgba(156,255,0,.24);background:rgba(156,255,0,.12);color:#c8ff78}
        .cp-state-option.deny.selected{border-color:rgba(255,107,107,.28);background:rgba(255,107,107,.12);color:#ff9696}
        .cp-state-option.inherit.selected{border-color:rgba(255,255,255,.14);background:rgba(255,255,255,.1);color:var(--cp-text)}
        .cp-empty,.cp-no-role{margin:0;padding:14px;color:var(--cp-muted);font-size:11px;line-height:1.5}
        .cp-no-role{display:grid;place-items:center;text-align:center}
        @media(min-width:768px){.cp-modal{width:min(900px,calc(100vw - 36px));max-width:900px}.cp-body{grid-template-columns:minmax(210px,250px) minmax(0,1fr)}}
        .perm-loading{color:var(--cp-muted)}
        .perm-error{padding:9px 10px;border:1px solid rgba(255,107,107,.24);border-radius:8px;background:rgba(255,107,107,.08)}
        .perm-legend{gap:10px;flex-wrap:wrap;border-color:rgba(255,255,255,.1)}
        .leg-item{color:var(--cp-muted)}
        .dot.inherit{background:#8b948d}
        .cancel-btn{color:var(--cp-muted)}
        @media(max-width:767px){
          .cp-body{grid-template-columns:minmax(0,1fr);grid-template-rows:auto minmax(0,1fr)}
          .cp-role-sidebar{gap:8px;padding:10px 12px;border-right:0;border-bottom:1px solid rgba(255,255,255,.1)}
          .cp-role-search{max-width:none}
          .role-list{flex:0 0 auto;flex-direction:row;overflow-x:auto;overflow-y:hidden;padding:1px 0 4px}
          .role-pill{width:auto;max-width:180px;flex:0 0 auto}
          .perm-panel{padding:12px;gap:10px}
          .perm-row{flex-direction:row;align-items:center}
          .cp-state-option{min-width:52px}
        }
        @media(max-width:420px){
          .cp-state-options{width:100%}
          .cp-state-option{flex:1}
          .perm-row{align-items:flex-start}
        }
      `}</style>
    </div>
  );
};

export default ChannelPermissionsModal;