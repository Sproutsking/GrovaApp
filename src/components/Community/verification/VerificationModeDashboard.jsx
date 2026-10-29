import React, { useState } from "react";
import { normalizeVerificationConfig } from "./verificationConfig";
import CreateVerificationRoleControl from "./CreateVerificationRoleControl";
import VerificationRoleSelector from "./VerificationRoleSelector";

export default function VerificationModeDashboard({ mode = "quick", value = {}, roles = [], onCreateRole, onPromoteRole, onManageRole, onDeleteRole, canManageRoles = false, onSave, onConfigChange, disabled = false }) {
  const [config, setConfig] = useState(() => normalizeVerificationConfig(value));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isQuick = mode === "quick";
  const method = config.methods[mode];

  const patchMethod = (next) => {
    const nextConfig = {
      ...config,
      methods: {
        ...config.methods,
        [mode]: { ...config.methods[mode], ...next },
      },
    };
    setConfig(nextConfig);
    onConfigChange?.(nextConfig);
  };
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await onSave(config);
    } catch (saveError) {
      setError(saveError.message || "Could not save verification settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="verification-mode-dashboard">
      <section>
        <h3>{isQuick ? "Quick Verify" : "Picture Check"}</h3>
        <p className="mode-help">
          {isQuick
            ? "Members complete a one-tap check. The server enforces any account requirements you enable."
            : "Members solve the picture challenge configured below before the selected role is granted."}
        </p>
        <label className="mode-check">
          <input
            type="checkbox"
            checked={Boolean(method.enabled)}
            disabled={disabled}
            onChange={(event) => patchMethod({ enabled: event.target.checked })}
          />
          Activate {isQuick ? "Quick Verify" : "Picture Check"}
        </label>
        <label>
          Title
          <input value={method.title || ""} disabled={disabled} onChange={(event) => patchMethod({ title: event.target.value })} />
        </label>
        <label>
          Description
          <textarea value={method.description || ""} disabled={disabled} onChange={(event) => patchMethod({ description: event.target.value })} />
        </label>
        <div className="mode-role-select" role="group" aria-label="Role granted after this check">
          <span className="mode-help">Role granted after this check</span>
          <VerificationRoleSelector
            roles={roles}
            selectedRoleId={method.roleId}
            onSelect={(roleId) => patchMethod({ roleId })}
            onPromoteRole={onPromoteRole}
            onManageRole={onManageRole}
            onDeleteRole={onDeleteRole}
            canManageRoles={canManageRoles}
            disabled={disabled || Boolean(config.roleGrant?.enabled)}
          />
          {config.roleGrant?.enabled && <small className="mode-help">Access roles are configured below as member-selectable choices.</small>}
        </div>
          {!config.roleGrant?.enabled && <CreateVerificationRoleControl disabled={disabled} onCreateRole={onCreateRole} onCreated={(role) => patchMethod({ roleId: role.id })} />}
        {isQuick ? (
          <>
            <label>
              Button label
              <input value={method.buttonLabel || ""} disabled={disabled} onChange={(event) => patchMethod({ buttonLabel: event.target.value })} />
            </label>
            <label>
              Minimum account age (days)
              <input
                type="number"
                min="0"
                max="3650"
                value={method.minAccountAgeDays || 0}
                disabled={disabled}
                onChange={(event) => patchMethod({ minAccountAgeDays: Math.max(0, Math.min(3650, Number(event.target.value) || 0)) })}
              />
            </label>
            <label className="mode-check">
              <input type="checkbox" checked={Boolean(method.requireAvatar)} disabled={disabled} onChange={(event) => patchMethod({ requireAvatar: event.target.checked })} />
              Require a profile picture
            </label>
            <label className="mode-check">
              <input type="checkbox" checked={Boolean(method.requireProfileVerified)} disabled={disabled} onChange={(event) => patchMethod({ requireProfileVerified: event.target.checked })} />
              Require a verified profile
            </label>
          </>
        ) : (
          <section className="mode-challenge-help">
            <h4>Picture challenge</h4>
            <p>Add at least two labeled images and choose the correct answer. The challenge must be complete before this method can be enabled.</p>
          </section>
        )}
      </section>
      {error && <p className="mode-error" role="alert">{error}</p>}
      <button type="button" className="mode-save" disabled={disabled || saving} onClick={save}>
        {saving ? "Saving..." : `Save ${isQuick ? "Quick Verify" : "Picture Check"}`}
      </button>
      <style>{`.verification-mode-dashboard{display:flex;flex-direction:column;gap:12px}.verification-mode-dashboard section{display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid var(--surface-border);border-radius:10px;background:rgba(0,0,0,.12)}.verification-mode-dashboard h3,.verification-mode-dashboard h4{margin:0;font-size:calc((13px) + 1px);color:var(--text)}.verification-mode-dashboard label{display:flex;flex-direction:column;gap:5px;color:var(--text-secondary);font-size:calc((11px) + 1px)}.verification-mode-dashboard input,.verification-mode-dashboard textarea,.verification-mode-dashboard select{width:100%;padding:8px;border:1px solid var(--surface-border);border-radius:7px;background:var(--surface);color:var(--text);font:inherit}.verification-mode-dashboard textarea{min-height:65px}.verification-mode-dashboard .mode-check{display:flex;flex-direction:row;align-items:center;gap:7px}.verification-mode-dashboard .mode-check input{width:auto}.mode-help,.mode-challenge-help p{margin:0;color:var(--text-secondary);font-size:calc((10px) + 1px);line-height:1.5}.mode-role-select{display:grid;gap:5px}.verification-mode-dashboard .mode-challenge-help{padding:10px;background:var(--surface);border-radius:8px}.mode-error{margin:0;color:var(--danger);font-size:calc((11px) + 1px)}.mode-save{padding:9px;border:0;border-radius:8px;background:var(--accent);color:#111;font:800 11px inherit;cursor:pointer}`}</style>
    </div>
  );
}
