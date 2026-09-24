import React, { useEffect, useState } from "react";
import { Check, Upload, X } from "lucide-react";
import { DEFAULT_VERIFICATION_CONFIG, normalizeVerificationConfig } from "./verificationConfig";
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

function RoleGrantPage({ config, disabled, saving, error, onPatch, onSave }) {
  return (
    <div className="verification-role-dashboard">
      <section>
        <h3>Role grant</h3>
        <label className="verification-check">
          <input
            type="checkbox"
            checked={Boolean(config.roleGrant?.enabled)}
            disabled={disabled}
            onChange={(event) => onPatch({ roleGrant: { ...config.roleGrant, enabled: event.target.checked } })}
          />
          Grant a role after successful verification
        </label>
        <label>
          Role name
          <input
            value={config.roleGrant?.roleName || "Verified"}
            disabled={disabled || !config.roleGrant?.enabled}
            onChange={(event) => onPatch({ roleGrant: { ...config.roleGrant, roleName: event.target.value } })}
          />
        </label>
        <label>
          Role ID or reference
          <input
            value={config.roleGrant?.roleId || ""}
            disabled={disabled || !config.roleGrant?.enabled}
            onChange={(event) => onPatch({ roleGrant: { ...config.roleGrant, roleId: event.target.value } })}
            placeholder="Optional role reference"
          />
        </label>
        <label>
          Access scope
          <textarea
            value={(config.roleGrant?.channelAccess || []).join(", ")}
            disabled={disabled || !config.roleGrant?.enabled}
            onChange={(event) => onPatch({ roleGrant: { ...config.roleGrant, channelAccess: event.target.value.split(",").map((entry) => entry.trim()).filter(Boolean) } })}
            placeholder="channel ids or access labels"
          />
        </label>
      </section>
      <button type="button" className="verification-dashboard-save" disabled={disabled || saving} onClick={onSave}>{saving ? "Saving..." : "Save role grant"}</button>
      {error && <p className="verification-dashboard-error">{error}</p>}
      <style>{`.verification-role-dashboard{display:flex;flex-direction:column;gap:12px}.verification-role-dashboard section{display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid var(--surface-border);border-radius:10px;background:rgba(0,0,0,.12)}.verification-role-dashboard h3{margin:0;font-size:13px;color:var(--text)}.verification-role-dashboard label{display:flex;flex-direction:column;gap:5px;color:var(--text-secondary);font-size:11px}.verification-role-dashboard input,.verification-role-dashboard textarea{width:100%;padding:8px;border:1px solid var(--surface-border);border-radius:7px;background:var(--surface);color:var(--text);font:inherit}.verification-role-dashboard textarea{min-height:68px;resize:vertical}.verification-check{display:flex!important;flex-direction:row!important;align-items:center;gap:7px}.verification-check input{width:auto}.verification-dashboard-save{display:inline-flex;align-items:center;justify-content:center;padding:9px;border:0;border-radius:8px;background:var(--accent);color:#111;font:800 11px inherit;cursor:pointer}.verification-dashboard-error{margin:0;color:var(--danger);font-size:11px}.`}</style>
    </div>
  );
}

export default function VerificationToolDashboard({ value, onSave, disabled = false, focusMode = null, channels = [], onModeSelect }) {
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
      setSelectedMode(null);
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
    return <RulesVerificationDashboard value={config.rules} channels={channels} disabled={disabled} onSave={async (rulesConfig) => {
      const next = { ...config, rules: { ...config.rules, ...rulesConfig }, rulesEnabled: Boolean(rulesConfig.enabled) };
      await handleSave(next);
    }} />;
  }
  if (focusMode === "role_grant") {
    return <RoleGrantPage config={config} disabled={disabled} saving={saving} error={error} onPatch={patch} onSave={() => handleSave({ ...config, roleGrant: { ...config.roleGrant, enabled: Boolean(config.roleGrant?.enabled) } })} />;
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
