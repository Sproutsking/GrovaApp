import React, { useState } from "react";
import { challengeIsReady, DEFAULT_VERIFICATION_CONFIG, getSelectableVerificationRoles, isMethodReady, methodIssues, METHOD_META, METHOD_ORDER, normalizeVerificationConfig } from "./verificationConfig";
import VerificationModeDashboard from "./VerificationModeDashboard";
import PictureVerificationDashboard from "./PictureVerificationDashboard";
import RulesVerificationDashboard from "./RulesVerificationDashboard";
import RoleAccessReview from "./RoleAccessReview";

function RoleGrantPage({ config, roles, channels, categories, accessRules, disabled, saving, error, onPatch, onSave }) {
  const [reviewRoleId, setReviewRoleId] = useState(null);
  const [validationError, setValidationError] = useState("");
  const selectableRoles = getSelectableVerificationRoles(roles);
  const selectedRoleIds = config.roleGrant?.roleIds || [];
  const save = () => {
    const eligibleRoleIds = selectedRoleIds.filter((roleId) =>
      selectableRoles.some((role) => role.id === roleId),
    );
    if (config.roleGrant?.enabled && !eligibleRoleIds.length) {
      setValidationError("Choose at least one eligible role before enabling verified role selection.");
      return;
    }
    setValidationError("");
    onSave();
  };
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
            <div key={role.id} className="verification-role-entry">
              <label className="verification-role-option">
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
                <span><strong>{role.name}</strong><small>Rank {Number(role.position) + 1}{role.is_default ? " · default" : ""}</small></span>
              </label>
              <button
                type="button"
                className="verification-role-review-toggle"
                aria-expanded={reviewRoleId === role.id}
                onClick={() => setReviewRoleId((current) => current === role.id ? null : role.id)}
              >
                {reviewRoleId === role.id ? "Hide access review" : "Review permissions & channels"}
              </button>
              {reviewRoleId === role.id && (
                <RoleAccessReview role={role} channels={channels} categories={categories} accessRules={accessRules} />
              )}
            </div>
          ))}
          {!selectableRoles.length && <p>{roles.length
            ? "Move a safe role above the default member role in Roles to make it selectable."
            : "No safe roles are available yet. Create a non-default role without management permissions first."}</p>}
        </div>
      </section>
      <button type="button" className="verification-dashboard-save" disabled={disabled || saving} onClick={save}>{saving ? "Saving..." : "Save role grant"}</button>
      {validationError && <p className="verification-dashboard-error" role="alert">{validationError}</p>}
      {error && <p className="verification-dashboard-error">{error}</p>}
      <style>{`.verification-role-dashboard{display:flex;flex-direction:column;gap:12px}.verification-role-dashboard section{display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid var(--surface-border);border-radius:10px;background:rgba(0,0,0,.12)}.verification-role-dashboard h3{margin:0;font-size:13px;color:var(--text)}.verification-role-dashboard p{margin:0;color:var(--text-secondary);font-size:11px;line-height:1.5}.verification-role-options{display:grid;gap:6px}.verification-role-entry{display:grid;gap:6px;padding:7px;border:1px solid var(--surface-border);border-radius:10px;background:var(--surface)}.verification-role-option{display:flex!important;flex-direction:row!important;align-items:center;gap:9px;padding:4px;border:0;border-radius:0;background:transparent;cursor:pointer}.verification-role-option input,.verification-check input{width:auto;accent-color:var(--accent)}.verification-role-option>span:last-child{display:flex;flex-direction:column;gap:3px}.verification-role-option strong{color:var(--text);font-size:11px}.verification-role-option small{color:var(--text-secondary);font-size:9px}.verification-role-dot{display:grid;place-items:center;width:26px;height:26px;border-radius:8px;color:#111;font-size:13px}.verification-role-review-toggle{justify-self:start;padding:5px 8px;border:1px solid var(--surface-border);border-radius:7px;background:rgba(156,255,0,.06);color:var(--accent);font:700 10px inherit;cursor:pointer}.verification-check{display:flex!important;flex-direction:row!important;align-items:center;gap:7px;color:var(--text-secondary);font-size:11px}.verification-dashboard-save{display:inline-flex;align-items:center;justify-content:center;padding:9px;border:0;border-radius:8px;background:var(--accent);color:#111;font:800 11px inherit;cursor:pointer}.verification-dashboard-error{margin:0;color:var(--danger);font-size:11px}.`}</style>
    </div>
  );
}

export default function VerificationToolDashboard({ value, onSave, disabled = false, focusMode = null, channels = [], roles = [], categories = [], accessRules = [], selectedChannelIds = [], onToggleChannel, channelError = "", onModeSelect }) {
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
      const savedConfig = normalizeVerificationConfig(nextConfig);
      await onSave(savedConfig);
      setConfig(savedConfig);
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
    return <RulesVerificationDashboard value={config.rulesGate} rulesMethod={config.methods.rules} methods={config.methods} roleGrant={config.roleGrant} roles={roles} pictureReady={challengeIsReady(config)} channels={channels} categories={categories} accessRules={accessRules} disabled={disabled} onSave={async ({ rulesMethod, roleGrant, ...rulesGate }) => {
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
    return <RoleGrantPage config={config} roles={roles} channels={channels} categories={categories} accessRules={accessRules} disabled={disabled} saving={saving} error={error} onPatch={patch} onSave={() => handleSave(config)} />;
  }

  const roleMap = new Map(roles.map((role) => [role.id, role]));
  const selectableRoleIds = new Set(getSelectableVerificationRoles(roles).map((role) => role.id));
  const readyMethods = METHOD_ORDER.filter((id) =>
    isMethodReady(id, config.methods[id], roleMap, config.methods, config),
  );
  const methodErrors = (id) => methodIssues(id, config.methods[id], roleMap, config.methods, config)
    .filter((issue) => issue.level === "error")
    .map((issue) => issue.text);
  const selectedRoleCount = config.roleGrant?.enabled
    ? (config.roleGrant.roleIds || []).filter((roleId) => selectableRoleIds.has(roleId)).length
    : [...new Set(METHOD_ORDER.map((id) => config.methods[id]?.roleId).filter(Boolean))]
      .filter((roleId) => selectableRoleIds.has(roleId)).length;
  const hasRulesGateRoute = Boolean(
    config.rulesGate?.enabled
    && config.rulesGate?.rulesChannelId
    && (config.rulesGate?.flow !== "rules_then_verify" || config.rulesGate?.verificationChannelId),
  );
  const hasEntryChannel = selectedChannelIds.length > 0 || hasRulesGateRoute;
  const methodStatus = (id) => {
    const methodId = id === "rules_gate" ? "rules" : id;
    if (!config.methods[methodId]?.enabled) return "Setup";
    return readyMethods.includes(methodId) ? "Ready" : "Needs setup";
  };
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
        <h3>Set up member verification</h3>
        <p>Choose where members enter, configure a check, then select the role they receive. Role permissions and channel visibility stay controlled by Roles &amp; Permissions.</p>
      </div>
      <section className="verification-setup-destinations">
        <div><strong>1. Choose verification channels</strong><small>{hasEntryChannel ? selectedChannelIds.length ? `${selectedChannelIds.length} panel channel${selectedChannelIds.length === 1 ? "" : "s"} selected.` : "Rules Gate channels are configured." : "Members need an entry channel containing the verification panel before they can complete the flow."}</small></div>
        {channels.filter((channel) => channel.type !== "voice").map((channel) => {
          const selected = selectedChannelIds.includes(channel.id);
          return (
            <button type="button" key={channel.id} disabled={disabled || !onToggleChannel} className={selected ? "selected" : ""} onClick={() => onToggleChannel?.(channel.id)}>
              <span>{selected ? "✓" : "+"}</span>#{channel.name}<em>{selected ? "Panel enabled" : "Add panel"}</em>
            </button>
          );
        })}
        {!channels.some((channel) => channel.type !== "voice") && <small>No text channels are available. Create a channel before configuring verification.</small>}
        {channelError && <p className="verification-setup-error" role="alert">{channelError}</p>}
      </section>
      <div className="verification-setup-step"><strong>2. Configure a working check</strong><span>{readyMethods.map((id) => METHOD_META[id].label).join(", ") || "No check is ready yet. Configure a method and select an access role."}</span></div>
      <div className="verification-setup-step"><strong>3. Choose the access role</strong><span>{selectedRoleCount ? `${selectedRoleCount} eligible role${selectedRoleCount === 1 ? "" : "s"} configured` : "No eligible access roles selected. Choose a safe role above the default member role."}</span></div>
      <div className="verification-picker-grid">
        {modes.map((mode) => (
          <div className={`verification-mode-card-wrap${mode.live ? "" : " soon"}`} key={mode.id}>
            <button type="button" className={`verification-mode-card${mode.live ? " live" : " soon"}`} disabled={disabled || !mode.live} onClick={() => selectMode(mode.id)}>
              <span className="verification-mode-state">{mode.live ? (mode.id === "role_grant" ? (selectedRoleCount ? "Configured" : "Needs setup") : methodStatus(mode.id)) : "Coming soon"}</span>
              <strong>{mode.label}</strong>
              <small>{mode.description}</small>
              <em>{mode.live ? "Open this section" : "Not available yet"}</em>
            </button>
            {mode.live && mode.id !== "role_grant" && config.methods[mode.id]?.enabled && methodErrors(mode.id).length > 0 && (
              <ul className="verification-mode-issues">{methodErrors(mode.id).map((issue) => <li key={issue}>{issue}</li>)}</ul>
            )}
            {mode.id === "role_grant" && config.roleGrant?.enabled && !selectedRoleCount && (
              <ul className="verification-mode-issues"><li>Select a safe role ranked above the default member role.</li></ul>
            )}
          </div>
        ))}
      </div>
      <style>{`.verification-mode-picker{display:flex;flex-direction:column;gap:10px}.verification-picker-hero{padding:16px;border:1px solid rgba(156,255,0,.25);border-radius:12px;background:linear-gradient(135deg,rgba(156,255,0,.09),rgba(0,0,0,.14))}.verification-picker-hero>span{font-size:9px;letter-spacing:.14em;font-weight:900;color:#9cff00}.verification-picker-hero h3{margin:5px 0;font-size:20px;color:var(--text)}.verification-picker-hero p{margin:0;color:var(--text-secondary);font-size:11px;line-height:1.5}.verification-setup-destinations,.verification-setup-step{display:grid;gap:7px;padding:12px;border:1px solid var(--surface-border);border-radius:10px;background:var(--surface)}.verification-setup-destinations>div{display:grid;gap:3px}.verification-setup-destinations strong,.verification-setup-step strong{color:var(--text);font-size:11px}.verification-setup-destinations small,.verification-setup-step span{color:var(--text-secondary);font-size:10px;line-height:1.45}.verification-setup-destinations>button{display:flex;align-items:center;gap:8px;padding:8px;border:1px solid var(--surface-border);border-radius:8px;background:rgba(0,0,0,.12);color:var(--text);text-align:left;font:600 11px inherit;cursor:pointer}.verification-setup-destinations>button.selected{border-color:var(--accent-border);background:var(--accent-bg)}.verification-setup-destinations>button:disabled{opacity:.55;cursor:not-allowed}.verification-setup-destinations>button span{display:grid;place-items:center;width:18px;height:18px;border-radius:5px;background:var(--accent-bg);color:var(--accent)}.verification-setup-destinations>button em{margin-left:auto;color:var(--accent);font-size:9px;font-style:normal}.verification-setup-error{margin:0!important;color:var(--danger)!important;font-size:10px}.verification-setup-step{gap:3px}.verification-picker-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.verification-mode-card-wrap{display:grid;align-content:start;gap:6px;min-width:0}.verification-mode-card{position:relative;display:flex;width:100%;flex-direction:column;align-items:flex-start;gap:5px;min-height:128px;padding:13px;border:1px solid var(--surface-border);border-radius:11px;background:var(--surface);color:var(--text);text-align:left;cursor:pointer}.verification-mode-card.live:hover{border-color:rgba(156,255,0,.65);background:rgba(156,255,0,.08)}.verification-mode-card.soon{opacity:.62;cursor:not-allowed}.verification-mode-card strong{font-size:13px}.verification-mode-card small{color:var(--text-secondary);font-size:10px;line-height:1.45}.verification-mode-card em{font-style:normal;color:var(--accent);font-size:9px}.verification-mode-state{display:inline-flex;align-items:center;justify-content:center;padding:4px 6px;border-radius:999px;background:var(--accent-bg);color:var(--accent);font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.verification-mode-card.soon .verification-mode-state{background:rgba(255,255,255,.04);color:var(--text-secondary)}.verification-mode-issues{display:grid;gap:3px;margin:0;padding:7px 8px 7px 24px;border-radius:8px;background:rgba(255,80,80,.07);color:var(--danger);font-size:9px;line-height:1.4}`}</style>
    </div>
  );
}
