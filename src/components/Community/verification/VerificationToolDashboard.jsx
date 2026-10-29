import React, { useRef, useState } from "react";
import { Send } from "lucide-react";
import { DEFAULT_VERIFICATION_CONFIG, getSelectableVerificationRoles, getVerificationRoleCandidates, getVerificationRoleIssue, groupVerificationRoles, isMethodReady, methodIssues, METHOD_ORDER, normalizeVerificationConfig, toPublicPanel } from "./verificationConfig";
import VerificationModeDashboard from "./VerificationModeDashboard";
import PictureVerificationDashboard from "./PictureVerificationDashboard";
import ReactionVerificationDashboard from "./ReactionVerificationDashboard";
import RoleAccessReview from "./RoleAccessReview";
import VerificationPanelView from "./VerificationPanelView";
import CreateVerificationRoleControl from "./CreateVerificationRoleControl";
import VerificationRoleActions from "./VerificationRoleActions";
import VerificationExperienceSettings from "./VerificationExperienceSettings";

function FocusedVerificationWorkspace({ focusMode, config, roles, channels, selectedChannelIds, onToggleChannel, channelError, setupError, disabled, onConfigChange, onSaveAndPublish, publishStatus, publishing = false, children }) {
  const [previewDevice, setPreviewDevice] = useState("mobile");
  const [previewOpen, setPreviewOpen] = useState(true);
  const roleMap = new Map(roles.map((role) => [role.id, role]));
  const previewMode = focusMode === "role_grant"
    ? METHOD_ORDER.find((id) => config.methods[id]?.enabled)
    : focusMode;
  const previewConfig = previewMode && ["quick", "picture", "reaction"].includes(previewMode)
    ? { ...config, methods: { ...config.methods, [previewMode]: { ...config.methods[previewMode], enabled: true } } }
    : config;
  const previewPanel = toPublicPanel(previewConfig, roleMap, { preview: true });
  if (previewMode && previewPanel.methods[previewMode]) {
    previewPanel.methods[previewMode] = { ...previewPanel.methods[previewMode], ready: true };
  }
  const textChannels = channels.filter((channel) => channel.type !== "voice");
  const selectedDestinations = textChannels.filter((channel) => selectedChannelIds.includes(channel.id));

  return (
    <div className={`verification-focused-workspace verification-focused-workspace-stable${previewOpen ? "" : " preview-collapsed"}`}>
      <div className="verification-focused-editor">
        <section className="verification-focused-channels">
        <div>
          <strong>Send the verification panel to</strong>
          <p>Choose one or more text channels where members can open this check.</p>
        </div>
        <div className="verification-focused-channel-list">
          {textChannels.map((channel) => {
            const selected = selectedChannelIds.includes(channel.id);
            return (
              <button type="button" key={channel.id} disabled={disabled || !onToggleChannel} className={selected ? "selected" : ""} onClick={() => onToggleChannel?.(channel.id)}>
                <span>{selected ? "✓" : "+"}</span>#{channel.name}<em>{selected ? "Panel enabled" : "Add panel"}</em>
              </button>
            );
          })}
          {!textChannels.length && <p>Create a text channel before sending a verification panel.</p>}
        </div>
        {publishStatus && <p className="verification-setup-success" role="status">{publishStatus}</p>}
        {channelError && <p className="verification-setup-error" role="alert">{channelError}</p>}
        </section>
        <VerificationExperienceSettings value={config} onChange={onConfigChange} disabled={disabled} />
        {children}
        <div className="verification-focused-publish-bar">
          <div>
            <strong>Publish verification panel</strong>
            <small role={publishStatus ? "status" : undefined}>
              {publishStatus || (selectedDestinations.length
                ? `Ready for ${selectedDestinations.length} selected channel${selectedDestinations.length === 1 ? "" : "s"}.`
                : "Select at least one destination channel above.")}
            </small>
          </div>
          {setupError && <p className="verification-focused-publish-error" role="alert">{setupError}</p>}
          <button
            type="button"
            className="verification-dashboard-save"
            disabled={disabled || publishing || !onSaveAndPublish || !selectedDestinations.length}
            onClick={onSaveAndPublish}
          >
            <Send size={14} /> {publishing ? "Publishing…" : "Save and publish panel"}
          </button>
        </div>
      </div>
      {previewOpen && <section className="verification-member-preview">
        <div className="verification-preview-header">
          <div><strong>Member panel preview</strong><p>Updates instantly as you configure this check.</p></div>
          <div className="verification-preview-actions">
            <div className="verification-preview-toggle" role="group" aria-label="Preview device">
              <button type="button" className={previewDevice === "mobile" ? "selected" : ""} aria-pressed={previewDevice === "mobile"} onClick={() => setPreviewDevice("mobile")}>Mobile</button>
              <button type="button" className={previewDevice === "desktop" ? "selected" : ""} aria-pressed={previewDevice === "desktop"} onClick={() => setPreviewDevice("desktop")}>Desktop</button>
            </div>
            <button type="button" className="verification-preview-hide" onClick={() => setPreviewOpen(false)}>Hide</button>
          </div>
        </div>
        <div className={`verification-preview-canvas ${previewDevice}`}>
        {previewMode ? (
          <VerificationPanelView
            panel={previewPanel}
            state={{ completed: [], pending: [] }}
            busy={false}
            onComplete={async () => ({ success: false, error: "This is a preview only." })}
            focusMethod={previewMode}
            onlyMethods={[previewMode]}
          />
        ) : (
          <p className="verification-preview-empty">Enable a check to preview its member-facing panel.</p>
        )}
        </div>
      </section>}
      {!previewOpen && <button type="button" className="verification-preview-show" onClick={() => setPreviewOpen(true)}>Show member preview</button>}
      <style>{`
        .verification-focused-workspace.verification-focused-workspace-stable{flex:1 1 auto;height:620px;max-height:calc(100dvh - 230px);min-height:0;grid-template-rows:minmax(0,1fr)}
        .verification-focused-workspace-stable .verification-focused-channels,.verification-focused-workspace-stable .verification-member-preview{gap:7px;padding:10px}
        .verification-focused-workspace-stable .verification-focused-editor{gap:9px}
        .verification-focused-workspace-stable .verification-focused-editor{min-height:0;overflow-y:auto;overscroll-behavior-y:contain;-webkit-overflow-scrolling:touch}
        .verification-focused-workspace-stable .verification-member-preview{min-height:0}
        .verification-focused-publish-bar{position:sticky;bottom:0;z-index:8;display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:auto;padding:10px;border:1px solid var(--accent-border);border-radius:10px;background:color-mix(in srgb,var(--surface-strong) 94%,#000);box-shadow:0 -8px 22px rgba(0,0,0,.22)}
        .verification-focused-publish-bar>div{display:grid;gap:3px;min-width:0}
        .verification-focused-publish-bar strong{color:var(--text);font-size:calc((11px) + 1px)}
        .verification-focused-publish-bar small{color:var(--text-secondary);font-size:calc((9px) + 1px);line-height:1.35}
        .verification-focused-publish-error{flex:1;margin:0;color:var(--danger,#ff8b82);font-size:calc((10px) + 1px);line-height:1.35}
        .verification-focused-publish-bar .verification-dashboard-save{display:inline-flex;align-items:center;justify-content:center;gap:6px;flex-shrink:0;min-height:36px;padding:0 12px}
        .verification-focused-publish-bar .verification-dashboard-save:disabled{opacity:.5;cursor:not-allowed}
        @media(max-width:900px){
          .verification-focused-workspace-stable{flex:0 0 auto;height:auto;max-height:none}
          .verification-focused-workspace-stable .verification-focused-editor{overflow:visible}
          .verification-focused-workspace-stable .verification-member-preview{min-height:460px}
        }
      `}</style>
      <style>{`.verification-focused-workspace{display:grid;grid-template-columns:minmax(320px,1fr) 8px minmax(330px,42%);gap:0;min-height:calc(100dvh - 170px)}.verification-focused-editor{grid-column:1;min-width:0;overflow:auto;display:flex;flex-direction:column;gap:14px;padding:0 12px 12px 0}.verification-focused-channels,.verification-member-preview{display:flex;flex-direction:column;gap:9px;padding:13px;border:1px solid var(--surface-border);border-radius:11px;background:var(--surface)}.verification-focused-channels strong,.verification-member-preview strong{color:var(--text);font-size:calc((12px) + 1px)}.verification-focused-channels p,.verification-member-preview>div p,.verification-preview-empty{margin:3px 0 0;color:var(--text-secondary);font-size:calc((10px) + 1px);line-height:1.45}.verification-focused-channel-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:7px}.verification-focused-channel-list button{display:flex;align-items:center;gap:8px;min-width:0;padding:8px;border:1px solid var(--surface-border);border-radius:8px;background:var(--surface-strong);color:var(--text);text-align:left;font:600 11px inherit;cursor:pointer}.verification-focused-channel-list button.selected{border-color:var(--accent-border);background:var(--accent-bg)}.verification-focused-channel-list button:disabled{opacity:.55;cursor:not-allowed}.verification-focused-channel-list button span{display:grid;place-items:center;width:18px;height:18px;flex-shrink:0;border-radius:5px;background:var(--accent-bg);color:var(--accent)}.verification-focused-channel-list button em{margin-left:auto;color:var(--accent);font-size:calc((9px) + 1px);font-style:normal}.verification-focused-channel-list>p{margin:0;color:var(--text-secondary);font-size:calc((10px) + 1px)}.verification-member-preview{grid-column:3;grid-row:1;min-width:0;min-height:420px;overflow:hidden;padding-left:12px}.verification-preview-header{display:flex;align-items:center;justify-content:space-between;gap:8px}.verification-preview-actions{display:flex;align-items:center;gap:7px}.verification-preview-toggle{display:flex;padding:2px;border:1px solid var(--surface-border);border-radius:8px;background:var(--surface-strong)}.verification-preview-toggle button,.verification-preview-hide{padding:5px 8px;border:0;border-radius:6px;background:transparent;color:var(--text-secondary);font:700 9px inherit;cursor:pointer}.verification-preview-toggle button.selected{background:var(--accent-bg);color:var(--accent)}.verification-preview-hide{border:1px solid var(--surface-border)}.verification-preview-canvas{flex:1;min-height:0;overflow:auto;display:flex;justify-content:center;padding:8px;border-radius:8px;background:var(--app-background,#0b0d0e)}.verification-preview-canvas.mobile .vp{width:min(100%,390px);padding:13px;border-radius:20px}.verification-preview-canvas.desktop .vp{width:100%;max-width:620px}.verification-member-preview .vp{margin:0}.verification-preview-show{align-self:flex-start;grid-column:1;grid-row:1;padding:7px 10px;border:1px solid var(--surface-border);border-radius:7px;background:var(--surface);color:var(--accent);font:700 10px inherit;cursor:pointer}.verification-focused-workspace.preview-collapsed{grid-template-columns:minmax(0,1fr)}.verification-focused-workspace.preview-collapsed .verification-focused-editor{grid-column:1;padding-right:0}@media(max-width:900px){.verification-focused-workspace{display:flex;flex-direction:column;min-height:0;gap:12px}.verification-focused-editor{order:1;overflow:visible;padding:0}.verification-preview-show{order:2}.verification-member-preview{order:3;min-height:460px;padding-left:13px}.verification-preview-header{flex-wrap:wrap}.verification-focused-channel-list{grid-template-columns:1fr}}`}</style>
    </div>
  );
}

function RoleGrantPage({ communityId, config, roles, channels, categories, accessRules, disabled, canManageRoles, saving, error, onPatch, onSave, onCreateRole, onUpdateRole, onPromoteRole, onManageRole, onDeleteRole }) {
  const [reviewRoleId, setReviewRoleId] = useState(null);
  const [validationError, setValidationError] = useState("");
  const candidateRoleGroups = groupVerificationRoles(getVerificationRoleCandidates(roles));
  const selectableRoleIds = new Set(getSelectableVerificationRoles(roles).map((role) => role.id));
  const selectedRoleIds = config.roleGrant?.roleIds || [];
  const promoteRole = async (roleId) => {
    const promoted = await onPromoteRole?.(roleId);
    if (promoted === false) return false;
    onPatch({
      roleGrant: {
        ...config.roleGrant,
        enabled: true,
        roleIds: [...new Set([...selectedRoleIds, roleId])],
      },
    });
    return true;
  };
  const save = () => {
    const eligibleRoleIds = selectedRoleIds.filter((roleId) =>
      selectableRoleIds.has(roleId),
    );
    if (config.roleGrant?.enabled && eligibleRoleIds.length !== selectedRoleIds.length) {
      setValidationError("Remove roles marked unavailable before saving the verified role selection.");
      return;
    }
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
        <p>Choose safe, existing roles. One selected role is granted automatically; with multiple roles, members choose one after passing verification. The highest-ranked role they hold determines their access.</p>
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
          {candidateRoleGroups.map((roleGroup) => {
            const role = roleGroup.roles.find((candidate) => selectableRoleIds.has(candidate.id)) || roleGroup.role;
            const eligible = selectableRoleIds.has(role.id);
            const issue = getVerificationRoleIssue(role, roles);
            const promoteAndSelect = issue === "rank" && Boolean(onPromoteRole);
            const selected = roleGroup.roles.some((entry) => selectedRoleIds.includes(entry.id));
            return (
            <div key={role.id} className={`verification-role-entry${eligible ? "" : " ineligible"}`}>
              <VerificationRoleActions role={role} canManage={canManageRoles} onManageRole={onManageRole} onDeleteRole={onDeleteRole} />
              <label className="verification-role-option">
                <input
                  type="checkbox"
                  checked={selected}
                  disabled={disabled || (!eligible && !selected && !promoteAndSelect)}
                  onChange={(event) => {
                    if (event.target.checked && promoteAndSelect) {
                      void promoteRole(role.id);
                      return;
                    }
                    const groupIds = roleGroup.roles.map((candidate) => candidate.id);
                    const roleIds = event.target.checked
                      ? [...new Set([...selectedRoleIds.filter((id) => !groupIds.includes(id)), role.id])]
                      : selectedRoleIds.filter((id) => !groupIds.includes(id));
                    onPatch({ roleGrant: { ...config.roleGrant, enabled: event.target.checked || config.roleGrant?.enabled, roleIds } });
                  }}
                />
                <span className="verification-role-dot" style={{ background: role.color || "#84cc16" }}>{role.icon || "♟"}</span>
                <span>
                  <strong>{role.name}</strong>
                  {roleGroup.roles.length > 1 && <small>{roleGroup.roles.length} matching role entries</small>}
                  <small>Rank {Number(role.position) + 1}</small>
                  {!eligible && <small className="verification-role-ineligible-reason">
                    {role.is_default ? "Default member roles cannot be verification rewards."
                      : role.name?.trim().toLowerCase() === "owner" ? "The owner role is protected."
                        : getVerificationRoleIssue(role, roles) === "rank" ? "Move this role above the default member role to make it eligible."
                          : "High-impact permissions prevent this role from being granted. Review and adjust it below."}
                  </small>}
                </span>
              </label>
              {!role.is_default && role.name?.trim().toLowerCase() !== "owner" && <button
                type="button"
                className="verification-role-review-toggle"
                aria-expanded={reviewRoleId === role.id}
                onClick={() => setReviewRoleId((current) => current === role.id ? null : role.id)}
              >
                {reviewRoleId === role.id ? "Hide access review" : "Review permissions & channels"}
              </button>}
              {reviewRoleId === role.id && !role.is_default && role.name?.trim().toLowerCase() !== "owner" && (
                <RoleAccessReview
                  role={role}
                  communityId={communityId}
                  roles={roles}
                  canManage={canManageRoles}
                  onUpdateRole={onUpdateRole}
                />
              )}
              {getVerificationRoleIssue(role, roles) === "rank" && (
                <button type="button" className="verification-role-promote" disabled={disabled || !onPromoteRole} onClick={() => promoteRole(role.id)}>
                  Move {role.name} above default role
                </button>
              )}
            </div>
          );
          })}
          {!candidateRoleGroups.length && <p>No community roles were loaded. Refresh the dashboard or create a role first.</p>}
        </div>
        <CreateVerificationRoleControl disabled={disabled} onCreateRole={onCreateRole} onCreated={(role) => onPatch({
          roleGrant: { enabled: true, roleIds: [...new Set([...selectedRoleIds, role.id])] },
        })} />
      </section>
      <button type="button" className="verification-dashboard-save" disabled={disabled || saving} onClick={save}>{saving ? "Saving..." : "Save reward roles"}</button>
      {validationError && <p className="verification-dashboard-error" role="alert">{validationError}</p>}
      {error && <p className="verification-dashboard-error">{error}</p>}
      <style>{`.verification-role-dashboard{display:flex;flex-direction:column;gap:12px}.verification-role-dashboard section{display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid var(--surface-border);border-radius:10px;background:rgba(0,0,0,.12)}.verification-role-dashboard h3{margin:0;font-size:calc((13px) + 1px);color:var(--text)}.verification-role-dashboard p{margin:0;color:var(--text-secondary);font-size:calc((11px) + 1px);line-height:1.5}.verification-role-options{display:grid;gap:6px}.verification-role-entry{position:relative;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:6px;padding:7px;border:1px solid var(--surface-border);border-radius:10px;background:var(--surface)}.verification-role-entry.ineligible{border-color:rgba(255,190,92,.32)}.verification-role-entry>.verification-role-actions{grid-column:2;grid-row:1}.verification-role-option{grid-column:1;grid-row:1;display:flex!important;flex-direction:row!important;align-items:center;gap:9px;padding:4px;border:0;border-radius:0;background:transparent;cursor:pointer}.verification-role-option input,.verification-check input{width:auto;accent-color:var(--accent)}.verification-role-option>span:last-child{display:flex;flex-direction:column;gap:3px}.verification-role-option strong{color:var(--text);font-size:calc((11px) + 1px)}.verification-role-option small{color:var(--text-secondary);font-size:calc((9px) + 1px)}.verification-role-option .verification-role-ineligible-reason{color:#eac88e}.verification-role-dot{display:grid;place-items:center;width:26px;height:26px;border-radius:8px;color:#111;font-size:calc((13px) + 1px)}.verification-role-entry>.verification-role-review-toggle,.verification-role-entry>.verification-role-review{grid-column:1/-1}.verification-role-review-toggle{justify-self:start;padding:5px 8px;border:1px solid var(--surface-border);border-radius:7px;background:rgba(156,255,0,.06);color:var(--accent);font:700 10px inherit;cursor:pointer}.verification-check{display:flex!important;flex-direction:row!important;align-items:center;gap:7px;color:var(--text-secondary);font-size:calc((11px) + 1px)}.verification-dashboard-save{display:inline-flex;align-items:center;justify-content:center;padding:9px;border:0;border-radius:8px;background:var(--accent);color:#111;font:800 11px inherit;cursor:pointer}.verification-dashboard-error{margin:0;color:var(--danger);font-size:calc((11px) + 1px)}.verification-setup-success{margin:0;color:var(--accent);font-size:calc((10px) + 1px)}.`}</style>
    </div>
  );
}

export default function VerificationToolDashboard({ communityId, value, onSave, onPublish, publishStatus = "", publishing = false, onCreateRole, onUpdateRole, onPromoteRole, onManageRole, onDeleteRole, canManageRoles = false, disabled = false, focusMode = null, channels = [], roles = [], categories = [], accessRules = [], selectedChannelIds = [], onToggleChannel, channelError = "", onModeSelect }) {
  const initial = normalizeVerificationConfig(value || DEFAULT_VERIFICATION_CONFIG);
  const [config, setConfig] = useState(initial);
  const experienceConfigRef = useRef(initial);
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
      return true;
    } catch (saveError) {
      setError(saveError.message || "Could not save verification setup.");
      return false;
    } finally {
      setSaving(false);
    }
  };
  const saveAndPublish = async () => {
    const saved = await handleSave(config);
    if (!saved) return;
    try {
      await onPublish?.(config);
    } catch (publishError) {
      setError(publishError.message || "Could not publish the verification panel.");
    }
  };

  const mergeExperienceSettings = (nextConfig) => ({
    ...nextConfig,
    accentColor: experienceConfigRef.current.accentColor,
    completion: experienceConfigRef.current.completion,
    panel: { ...nextConfig.panel, ...experienceConfigRef.current.panel },
  });
  const updateExperienceSettings = (nextConfig) => {
    experienceConfigRef.current = nextConfig;
    setConfig(nextConfig);
  };

  const handlePromoteRole = async (roleId) => {
    setError("");
    try {
      await onPromoteRole?.(roleId);
      return true;
    } catch (promotionError) {
      setError(promotionError.message || "Could not update this role's position.");
      return false;
    }
  };

  if (focusMode === "quick") {
    return (
      <FocusedVerificationWorkspace focusMode={focusMode} config={config} roles={roles} channels={channels} selectedChannelIds={selectedChannelIds} onToggleChannel={onToggleChannel} channelError={channelError} setupError={error} disabled={disabled} onConfigChange={updateExperienceSettings} onSaveAndPublish={saveAndPublish} publishStatus={publishStatus} publishing={publishing || saving}>
        <VerificationModeDashboard mode="quick" value={config} roles={roles} onCreateRole={onCreateRole} onPromoteRole={handlePromoteRole} onManageRole={onManageRole} onDeleteRole={onDeleteRole} canManageRoles={canManageRoles} disabled={disabled} onConfigChange={setConfig} onSave={(next) => handleSave(mergeExperienceSettings(next))} />
      </FocusedVerificationWorkspace>
    );
  }
  if (focusMode === "picture") {
    return (
      <FocusedVerificationWorkspace focusMode={focusMode} config={config} roles={roles} channels={channels} selectedChannelIds={selectedChannelIds} onToggleChannel={onToggleChannel} channelError={channelError} setupError={error} disabled={disabled} onConfigChange={updateExperienceSettings} onSaveAndPublish={saveAndPublish} publishStatus={publishStatus} publishing={publishing || saving}>
        <PictureVerificationDashboard value={config} roles={roles} onCreateRole={onCreateRole} onPromoteRole={handlePromoteRole} onManageRole={onManageRole} onDeleteRole={onDeleteRole} canManageRoles={canManageRoles} disabled={disabled} onConfigChange={setConfig} onSave={(next) => handleSave(mergeExperienceSettings({ ...config, ...next }))} />
      </FocusedVerificationWorkspace>
    );
  }
  if (focusMode === "reaction") {
    return (
      <FocusedVerificationWorkspace focusMode={focusMode} config={config} roles={roles} channels={channels} selectedChannelIds={selectedChannelIds} onToggleChannel={onToggleChannel} channelError={channelError} setupError={error} disabled={disabled} onConfigChange={updateExperienceSettings} onSaveAndPublish={saveAndPublish} publishStatus={publishStatus} publishing={publishing || saving}>
        <ReactionVerificationDashboard value={config} roles={roles} onCreateRole={onCreateRole} onPromoteRole={handlePromoteRole} onManageRole={onManageRole} onDeleteRole={onDeleteRole} canManageRoles={canManageRoles} disabled={disabled} onConfigChange={setConfig} onSave={(next) => handleSave(mergeExperienceSettings(next))} />
      </FocusedVerificationWorkspace>
    );
  }
  if (focusMode === "role_grant") {
    return (
      <FocusedVerificationWorkspace focusMode={focusMode} config={config} roles={roles} channels={channels} selectedChannelIds={selectedChannelIds} onToggleChannel={onToggleChannel} channelError={channelError} setupError={error} disabled={disabled} onConfigChange={updateExperienceSettings} onSaveAndPublish={saveAndPublish} publishStatus={publishStatus} publishing={publishing || saving}>
        <RoleGrantPage communityId={communityId} config={config} roles={roles} channels={channels} categories={categories} accessRules={accessRules} disabled={disabled} canManageRoles={canManageRoles} saving={saving} error={error} onPatch={patch} onSave={() => handleSave(mergeExperienceSettings(config))} onCreateRole={onCreateRole} onUpdateRole={onUpdateRole} onPromoteRole={handlePromoteRole} onManageRole={onManageRole} onDeleteRole={onDeleteRole} />
      </FocusedVerificationWorkspace>
    );
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
  const methodStatus = (id) => {
    const methodId = id === "rules_gate" ? "rules" : id;
    if (!config.methods[methodId]?.enabled) return "Setup";
    return readyMethods.includes(methodId) ? "Ready" : "Needs setup";
  };
  const modes = [
    { id: "quick", label: "Quick verify", description: "One-tap verification with the live member access flow.", live: true },
    { id: "picture", label: "Picture check", description: "Image challenge verification with configurable answers.", live: true },
    { id: "reaction", label: "Reaction check", description: "Answer a simple letter challenge before receiving access.", live: true },
    { id: "role_grant", label: "Reward roles", description: "Choose safe roles members can unlock after passing a check.", live: true },
    { id: "wallet_verification", label: "Wallet verification", description: "Verify via a wallet identity flow.", live: false },
  ];

  return (
    <div className="verification-mode-picker">
      <div className="verification-picker-hero">
        <span>VERIFICATION</span>
        <h3>Choose a verification option</h3>
        <p>Open an option to configure its channels, access role, and the panel members will use. Community rules are managed separately in Tools.</p>
      </div>
      {error && <p className="verification-dashboard-error" role="alert">{error}</p>}
      {publishStatus && <p className="verification-setup-success" role="status">{publishStatus}</p>}
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
      <style>{`.verification-mode-picker{display:flex;flex-direction:column;gap:10px}.verification-picker-hero{padding:16px;border:1px solid rgba(156,255,0,.25);border-radius:12px;background:linear-gradient(135deg,rgba(156,255,0,.09),rgba(0,0,0,.14))}.verification-picker-hero>span{font-size:calc((9px) + 1px);letter-spacing:.14em;font-weight:900;color:#9cff00}.verification-picker-hero h3{margin:5px 0;font-size:calc((20px) + 1px);color:var(--text)}.verification-picker-hero p{margin:0;color:var(--text-secondary);font-size:calc((11px) + 1px);line-height:1.5}.verification-setup-destinations,.verification-setup-step{display:grid;gap:7px;padding:12px;border:1px solid var(--surface-border);border-radius:10px;background:var(--surface)}.verification-setup-destinations>div{display:grid;gap:3px}.verification-setup-destinations strong,.verification-setup-step strong{color:var(--text);font-size:calc((11px) + 1px)}.verification-setup-destinations small,.verification-setup-step span{color:var(--text-secondary);font-size:calc((10px) + 1px);line-height:1.45}.verification-setup-destinations>button{display:flex;align-items:center;gap:8px;padding:8px;border:1px solid var(--surface-border);border-radius:8px;background:rgba(0,0,0,.12);color:var(--text);text-align:left;font:600 11px inherit;cursor:pointer}.verification-setup-destinations>button.selected{border-color:var(--accent-border);background:var(--accent-bg)}.verification-setup-destinations>button:disabled{opacity:.55;cursor:not-allowed}.verification-setup-destinations>button span{display:grid;place-items:center;width:18px;height:18px;border-radius:5px;background:var(--accent-bg);color:var(--accent)}.verification-setup-destinations>button em{margin-left:auto;color:var(--accent);font-size:calc((9px) + 1px);font-style:normal}.verification-setup-error{margin:0!important;color:var(--danger)!important;font-size:calc((10px) + 1px)}.verification-setup-step{gap:3px}.verification-picker-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.verification-mode-card-wrap{display:grid;align-content:start;gap:6px;min-width:0}.verification-mode-card{position:relative;display:flex;width:100%;flex-direction:column;align-items:flex-start;gap:5px;min-height:128px;padding:13px;border:1px solid var(--surface-border);border-radius:11px;background:var(--surface);color:var(--text);text-align:left;cursor:pointer}.verification-mode-card.live:hover{border-color:rgba(156,255,0,.65);background:rgba(156,255,0,.08)}.verification-mode-card.soon{opacity:.62;cursor:not-allowed}.verification-mode-card strong{font-size:calc((13px) + 1px)}.verification-mode-card small{color:var(--text-secondary);font-size:calc((10px) + 1px);line-height:1.45}.verification-mode-card em{font-style:normal;color:var(--accent);font-size:calc((9px) + 1px)}.verification-mode-state{display:inline-flex;align-items:center;justify-content:center;padding:4px 6px;border-radius:999px;background:var(--accent-bg);color:var(--accent);font-size:calc((9px) + 1px);font-weight:800;letter-spacing:.08em;text-transform:uppercase}.verification-mode-card.soon .verification-mode-state{background:rgba(255,255,255,.04);color:var(--text-secondary)}.verification-mode-issues{display:grid;gap:3px;margin:0;padding:7px 8px 7px 24px;border-radius:8px;background:rgba(255,80,80,.07);color:var(--danger);font-size:calc((9px) + 1px);line-height:1.4}`}</style>
      <style>{`.verification-channel-help{margin:0;color:var(--text-secondary);font-size:calc((10px) + 1px);line-height:1.45}.verification-channel-search{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--surface-border);border-radius:8px;background:var(--surface-strong);color:var(--text);font:inherit;font-size:calc((11px) + 1px)}`}</style>
    </div>
  );
}
