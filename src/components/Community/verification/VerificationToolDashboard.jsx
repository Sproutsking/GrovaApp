import React, { useEffect, useState } from "react";
import { Check, Upload, X } from "lucide-react";
import { challengeIsReady, DANGEROUS_PERMS, DEFAULT_VERIFICATION_CONFIG, normalizeVerificationConfig } from "./verificationConfig";
import VerificationModeDashboard from "./VerificationModeDashboard";
import PictureVerificationDashboard from "./PictureVerificationDashboard";
import RulesVerificationDashboard from "./RulesVerificationDashboard";

const AVATARS = ["shield", "lock", "badge", "fingerprint", "scan"];
const COLORS = ["#c9a66b", "#5b7ce0", "#3fb96f", "#8b7fd6", "#e2555c"];
const createSlots = (cards = []) => Array.from({ length: 6 }, (_, index) => ({
  id: cards[index]?.id || `slot-${index + 1}`,
  label: cards[index]?.label || "",
  image: cards[index]?.image || null,
}));

const resizeImage = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = reject;
  reader.onload = () => {
    const image = new Image();
    image.onerror = reject;
    image.onload = () => {
      const scale = Math.min(1, 160 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
});

function RoleGrantPage({ config, roles, disabled, saving, error, onPatch, onSave }) {
  const defaultRole = roles.find((role) => role.is_default);
  const safeRoles = roles.filter((role) =>
    !role.is_default
    && role.name?.trim().toLowerCase() !== "owner"
    && !DANGEROUS_PERMS.some((permission) => role.permissions?.[permission] === true),
  );
  const selectableRoles = safeRoles.filter((role) => !defaultRole || Number(role.position) < Number(defaultRole.position));
  const selectedRoleIds = config.roleGrant?.roleIds || [];
  return (
    <div className="verification-role-dashboard">
      <section>
        <h3>Roles members can unlock</h3>
        <p>Choose safe, existing roles. If you select more than one, members choose one after passing verification. The highest-ranked role they hold determines their access.</p>
        <label className="verification-check">
          <input
            type="checkbox"
            checked={Boolean(config.roleGrant?.enabled)}
            disabled={disabled}
            onChange={(event) => onPatch({ roleGrant: { ...config.roleGrant, enabled: event.target.checked } })}
          />
          Enable verified role selection
        </label>
        <div className="verification-role-options">
          {selectableRoles.map((role) => (
            <label key={role.id} className="verification-role-option">
              <input
                type="checkbox"
                checked={selectedRoleIds.includes(role.id)}
                disabled={disabled || !config.roleGrant?.enabled}
                onChange={(event) => {
                  const roleIds = event.target.checked
                    ? [...selectedRoleIds, role.id]
                    : selectedRoleIds.filter((id) => id !== role.id);
                  onPatch({ roleGrant: { ...config.roleGrant, roleIds } });
                }}
              />
              <span className="verification-role-dot" style={{ background: role.color || "#84cc16" }}>{role.icon || "♟"}</span>
              <span><strong>{role.name}</strong><small>Rank {role.position + 1} · permissions and channel access are managed in Roles</small></span>
            </label>
          ))}
          {!selectableRoles.length && <p>{safeRoles.length
            ? "Move a safe role above the default member role in Roles to make it selectable."
            : "No safe roles are available yet. Create a non-default role without management permissions first."}</p>}
        </div>
      </section>
      <button type="button" className="verification-dashboard-save" disabled={disabled || saving} onClick={onSave}>{saving ? "Saving..." : "Save role grant"}</button>
      {error && <p className="verification-dashboard-error">{error}</p>}
      <style>{`.verification-role-dashboard{display:flex;flex-direction:column;gap:12px}.verification-role-dashboard section{display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid var(--surface-border);border-radius:10px;background:rgba(0,0,0,.12)}.verification-role-dashboard h3{margin:0;font-size:13px;color:var(--text)}.verification-role-dashboard p{margin:0;color:var(--text-secondary);font-size:11px;line-height:1.5}.verification-role-options{display:grid;gap:6px}.verification-role-option{display:flex!important;flex-direction:row!important;align-items:center;gap:9px;padding:9px;border:1px solid var(--surface-border);border-radius:9px;background:var(--surface);cursor:pointer}.verification-role-option input,.verification-check input{width:auto;accent-color:var(--accent)}.verification-role-option>span:last-child{display:flex;flex-direction:column;gap:3px}.verification-role-option strong{color:var(--text);font-size:11px}.verification-role-option small{color:var(--text-secondary);font-size:9px}.verification-role-dot{display:grid;place-items:center;width:26px;height:26px;border-radius:8px;color:#111;font-size:13px}.verification-check{display:flex!important;flex-direction:row!important;align-items:center;gap:7px;color:var(--text-secondary);font-size:11px}.verification-dashboard-save{display:inline-flex;align-items:center;justify-content:center;padding:9px;border:0;border-radius:8px;background:var(--accent);color:#111;font:800 11px inherit;cursor:pointer}.verification-dashboard-error{margin:0;color:var(--danger);font-size:11px}.`}</style>
    </div>
  );
}

export default function VerificationToolDashboard({ value, onSave, disabled = false, focusMode = null, channels = [], roles = [], onModeSelect }) {
  const initial = normalizeVerificationConfig(value || DEFAULT_VERIFICATION_CONFIG);
  const [config, setConfig] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectMode = (modeId) => {
    onModeSelect?.(modeId);
  };

  const patch = (next) => setConfig((current) => ({ ...current, ...next }));

  const handleSave = async (nextConfig) => {
    setError("");
    setSaving(true);
    try {
      await onSave(nextConfig);
      selectMode(null);
    } catch (saveError) {
      setError(saveError.message || "Could not save verification setup.");
    } finally {
      setSaving(false);
    }
  };

  if (focusMode === "quick") {
    return <VerificationModeDashboard mode="quick" value={config} disabled={disabled} onSave={(next) => handleSave(next)} />;
  }
  if (focusMode === "picture") {
    return <PictureVerificationDashboard value={config} disabled={disabled} onSave={(next) => handleSave({ ...config, ...next })} />;
  }
  if (focusMode === "rules_gate") {
    return <RulesVerificationDashboard value={config.rulesGate} rulesMethod={config.methods.rules} methods={config.methods} roleGrant={config.roleGrant} roles={roles} pictureReady={challengeIsReady(config)} channels={channels} disabled={disabled} onSave={async ({ rulesMethod, roleGrant, ...rulesGate }) => {
      const next = {
        ...config,
        rulesGate,
        roleGrant,
        rulesEnabled: Boolean(rulesGate.enabled),
        methods: { ...config.methods, rules: rulesMethod },
      };
      await handleSave(next);
    }} />;
  }
  if (focusMode === "role_grant") {
    return <RoleGrantPage config={config} roles={roles} disabled={disabled} saving={saving} error={error} onPatch={patch} onSave={() => handleSave(config)} />;
  }

  const modes = [
    { id: "quick", label: "Quick verify", description: "One-tap verification with the live member access flow.", live: true },
    { id: "picture", label: "Picture check", description: "Image challenge verification with configurable answers.", live: true },
    { id: "rules_gate", label: "Rules gate", description: "Members must accept the community rules before they can unlock the role.", live: true },
    { id: "role_grant", label: "Role grant", description: "Select the role that gets granted after a successful verification.", live: true },
    { id: "reaction_verification", label: "Reaction verification", description: "Verify through a reaction challenge.", live: false },
    { id: "wallet_verification", label: "Wallet verification", description: "Verify via a wallet identity flow.", live: false },
  ];

  return (
    <div className="verification-mode-picker">
      <div className="verification-picker-hero">
        <span>VERIFICATION</span>
        <h3>Choose a verification flow</h3>
        <p>Each verification method now lives in its own section. Configure the access gate, role grant, and checks without mixing them into a single dashboard.</p>
      </div>
      <div className="verification-picker-grid">
        {modes.map((mode) => (
          <button type="button" key={mode.id} className={`verification-mode-card${mode.live ? " live" : " soon"}`} disabled={disabled || !mode.live} onClick={() => selectMode(mode.id)}>
            <span className="verification-mode-state">{mode.live ? "Live" : "Coming soon"}</span>
            <strong>{mode.label}</strong>
            <small>{mode.description}</small>
            <em>{mode.live ? "Open this section" : "Not available yet"}</em>
          </button>
        ))}
      </div>
      <style>{`.verification-mode-picker{display:flex;flex-direction:column;gap:14px}.verification-picker-hero{padding:16px;border:1px solid rgba(156,255,0,.25);border-radius:12px;background:linear-gradient(135deg,rgba(156,255,0,.09),rgba(0,0,0,.14))}.verification-picker-hero>span{font-size:9px;letter-spacing:.14em;font-weight:900;color:#9cff00}.verification-picker-hero h3{margin:5px 0;font-size:20px;color:var(--text)}.verification-picker-hero p{margin:0;color:var(--text-secondary);font-size:11px;line-height:1.5}.verification-picker-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.verification-mode-card{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:5px;min-height:128px;padding:13px;border:1px solid var(--surface-border);border-radius:11px;background:var(--surface);color:var(--text);text-align:left;cursor:pointer}.verification-mode-card.live:hover{border-color:rgba(156,255,0,.65);background:rgba(156,255,0,.08)}.verification-mode-card.soon{opacity:.62;cursor:not-allowed}.verification-mode-card strong{font-size:13px}.verification-mode-card small{color:var(--text-secondary);font-size:10px;line-height:1.45}.verification-mode-card em{font-style:normal;color:var(--accent);font-size:9px}.verification-mode-state{display:inline-flex;align-items:center;justify-content:center;padding:4px 6px;border-radius:999px;background:var(--accent-bg);color:var(--accent);font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.verification-mode-card.soon .verification-mode-state{background:rgba(255,255,255,.04);color:var(--text-secondary)}`}</style>
    </div>
  );
}
