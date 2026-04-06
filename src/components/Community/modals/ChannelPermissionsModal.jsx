// components/Community/modals/ChannelPermissionsModal.jsx
// Per-channel permission overrides: which roles can view / send / react, etc.
import React, { useState, useEffect } from "react";
import { X, Lock, MessageSquare, Eye, Smile, Paperclip, AtSign, Shield, ChevronDown } from "lucide-react";
import { supabase } from "../../../services/config/supabase";

const PERMISSIONS = [
  { key: "viewChannel",      icon: Eye,          label: "View Channel",       desc: "See this channel in the list and read messages" },
  { key: "sendMessages",     icon: MessageSquare, label: "Send Messages",      desc: "Post messages in this channel" },
  { key: "addReactions",     icon: Smile,         label: "Add Reactions",      desc: "React to messages with emoji" },
  { key: "attachFiles",      icon: Paperclip,     label: "Attach Files",       desc: "Upload images and files" },
  { key: "mentionEveryone",  icon: AtSign,        label: "@everyone / @here",  desc: "Ping all members or online members" },
  { key: "manageMessages",   icon: Shield,        label: "Manage Messages",    desc: "Delete or pin any message" },
];

const STATES = ["inherit", "allow", "deny"]; // tristate like Discord

const StateToggle = ({ value, onChange }) => {
  const cycle = () => {
    const idx = STATES.indexOf(value);
    onChange(STATES[(idx + 1) % STATES.length]);
  };

  const COLOR = { inherit: "#555", allow: "#9cff00", deny: "#ff6b6b" };
  const LABEL = { inherit: "Inherited", allow: "Allowed", deny: "Denied" };

  return (
    <button
      className="state-toggle"
      onClick={cycle}
      style={{ color: COLOR[value], borderColor: `${COLOR[value]}44` }}
      title={`Click to change (current: ${LABEL[value]})`}
    >
      {value === "allow" && <span className="dot allow" />}
      {value === "deny"  && <span className="dot deny"  />}
      {value === "inherit" && <span className="dot inherit" />}
      {LABEL[value]}
    </button>
  );
};

const ChannelPermissionsModal = ({ channel, communityId, roles, onClose, onSave }) => {
  // Map: { [roleId]: { [permKey]: "inherit"|"allow"|"deny" } }
  const [overrides, setOverrides] = useState({});
  const [selectedRole, setSelectedRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadOverrides();
    if (roles.length > 0) setSelectedRole(roles[0]);
  }, [channel.id]);

  const loadOverrides = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("channel_permission_overrides")
        .select("*")
        .eq("channel_id", channel.id);

      if (error && error.code !== "42P01") throw error; // 42P01 = table not exists

      const map = {};
      (data || []).forEach((row) => {
        if (!map[row.role_id]) map[row.role_id] = {};
        map[row.role_id][row.permission] = row.state; // "allow"|"deny"
      });
      setOverrides(map);
    } catch (err) {
      console.error("Load overrides error:", err);
      setOverrides({});
    } finally {
      setLoading(false);
    }
  };

  const getState = (roleId, permKey) => {
    return overrides[roleId]?.[permKey] || "inherit";
  };

  const setState = (roleId, permKey, state) => {
    setOverrides((prev) => ({
      ...prev,
      [roleId]: { ...(prev[roleId] || {}), [permKey]: state },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete existing overrides for this channel
      await supabase
        .from("channel_permission_overrides")
        .delete()
        .eq("channel_id", channel.id);

      // Build rows for non-inherit states
      const rows = [];
      Object.entries(overrides).forEach(([roleId, perms]) => {
        Object.entries(perms).forEach(([permKey, state]) => {
          if (state !== "inherit") {
            rows.push({ channel_id: channel.id, role_id: roleId, permission: permKey, state });
          }
        });
      });

      if (rows.length > 0) {
        await supabase.from("channel_permission_overrides").insert(rows);
      }

      if (onSave) onSave();
      onClose();
    } catch (err) {
      console.error("Save overrides error:", err);
      alert("Failed to save permissions: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const resetRole = (roleId) => {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[roleId];
      return next;
    });
  };

  return (
    <div className="cp-overlay" onClick={onClose}>
      <div className="cp-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="cp-head">
          <div className="cp-title">
            <Lock size={16} color="#9cff00" />
            <span>#{channel.name}</span>
            <span className="cp-sub">Permissions</span>
          </div>
          <button className="cp-close" onClick={onClose}><X size={17} /></button>
        </div>

        <div className="cp-body">
          {/* Role list */}
          <div className="role-list">
            {roles.map((role) => {
              const hasOverrides = Object.values(overrides[role.id] || {}).some((s) => s !== "inherit");
              return (
                <button
                  key={role.id}
                  className={`role-pill${selectedRole?.id === role.id ? " active" : ""}`}
                  onClick={() => setSelectedRole(role)}
                >
                  <span className="role-dot" style={{ background: role.color || "#667eea" }} />
                  {role.name}
                  {hasOverrides && <span className="override-badge" />}
                </button>
              );
            })}
          </div>

          {/* Permission table for selected role */}
          {selectedRole && (
            <div className="perm-panel">
              <div className="perm-role-head">
                <span className="role-dot-lg" style={{ background: selectedRole.color || "#667eea" }} />
                <span className="perm-role-name">{selectedRole.name}</span>
                <button
                  className="reset-btn"
                  onClick={() => resetRole(selectedRole.id)}
                >Reset</button>
              </div>

              <div className="perm-list">
                {loading ? (
                  <div className="perm-loading">Loading…</div>
                ) : (
                  PERMISSIONS.map((perm) => {
                    const Icon = perm.icon;
                    const state = getState(selectedRole.id, perm.key);
                    return (
                      <div className="perm-row" key={perm.key}>
                        <div className="perm-info">
                          <div className="perm-icon-wrap">
                            <Icon size={15} />
                          </div>
                          <div>
                            <div className="perm-label">{perm.label}</div>
                            <div className="perm-desc">{perm.desc}</div>
                          </div>
                        </div>
                        <StateToggle
                          value={state}
                          onChange={(val) => setState(selectedRole.id, perm.key, val)}
                        />
                      </div>
                    );
                  })
                )}
              </div>

              <div className="perm-legend">
                <span className="leg-item"><span className="dot allow" />Allow</span>
                <span className="leg-item"><span className="dot deny"  />Deny</span>
                <span className="leg-item"><span className="dot inherit"/>Inherit from role</span>
              </div>
            </div>
          )}
        </div>

        <div className="cp-footer">
          <button className="cancel-btn" onClick={onClose}>Cancel</button>
          <button className="save-btn" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>

      <style>{`
        .cp-overlay {
          position:fixed; inset:0;
          background:rgba(0,0,0,.75); backdrop-filter:blur(10px);
          z-index:60000; display:flex; align-items:center; justify-content:center;
          padding:20px;
        }
        .cp-modal {
          width:100%; max-width:540px; max-height:88vh;
          background:#0c0c0c; border:1.5px solid rgba(156,255,0,.18);
          border-radius:18px; display:flex; flex-direction:column;
          animation:modalIn .3s cubic-bezier(.4,0,.2,1);
          overflow:hidden;
        }
        @keyframes modalIn{
          from{opacity:0;transform:translateY(20px) scale(.97)}
          to  {opacity:1;transform:translateY(0)    scale(1)  }
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
          display:flex; gap:0; flex:1; overflow:hidden; min-height:0;
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
          border-top:1px solid rgba(255,255,255,.05); flex-shrink:0;
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
      `}</style>
    </div>
  );
};

export default ChannelPermissionsModal;