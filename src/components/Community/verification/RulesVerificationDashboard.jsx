import React, { useEffect, useRef, useState } from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import RoleAccessReview from "./RoleAccessReview";
import { getSelectableVerificationRoles, getVerificationRoleIssue, groupVerificationRoles, isMethodReady, normalizeVerificationConfig, toPublicPanel } from "./verificationConfig";
import VerificationPanelView from "./VerificationPanelView";
import CreateVerificationRoleControl from "./CreateVerificationRoleControl";
import VerificationRoleActions from "./VerificationRoleActions";
import VerificationExperienceSettings from "./VerificationExperienceSettings";

export default function RulesVerificationDashboard({ communityId, value = {}, experienceConfig = {}, rulesMethod = {}, methods = {}, roleGrant = {}, roles = [], pictureReady = false, channels = [], categories = [], accessRules = [], onSave, onPublish, publishStatus = "", publishing = false, onCreateRole, onUpdateRole, onPromoteRole, onManageRole, onDeleteRole, canManageRoles = false, disabled = false, standalone = false }) {
  const [experience, setExperience] = useState(() => normalizeVerificationConfig(experienceConfig));
  const [config, setConfig] = useState({
    enabled: false,
    flow: "rules_only",
    rulesChannelId: "",
    verificationChannelId: "",
    secondMethod: "quick",
    ...value,
  });
  const [method, setMethod] = useState({
    ...rulesMethod,
    title: rulesMethod.title || "Read and accept the community rules",
    description: rulesMethod.description || "Please read these rules before requesting access.",
    requireScroll: true,
    items: Array.isArray(rulesMethod.items) && rulesMethod.items.length
      ? rulesMethod.items
      : [
        { id: "rule-1", title: "Be respectful", body: "" },
        { id: "rule-2", title: "Keep the community safe", body: "" },
        { id: "rule-3", title: "No spam or harassment", body: "" },
      ],
  });
  const [grant, setGrant] = useState({
    enabled: Boolean(roleGrant.enabled),
    roleIds: Array.isArray(roleGrant.roleIds) ? roleGrant.roleIds : [],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reviewRoleId, setReviewRoleId] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [editorWidth, setEditorWidth] = useState(48);
  const [previewDevice, setPreviewDevice] = useState("mobile");
  const [dragging, setDragging] = useState(null);
  const layoutRef = useRef(null);
  const textChannels = channels.filter((channel) => channel.type !== "voice");
  const patch = (next) => setConfig((current) => ({ ...current, ...next }));
  const patchMethod = (next) => setMethod((current) => ({ ...current, ...next }));
  const rulesText = method.items.map((rule) => rule.title).join("\n");
  const selectableRoles = getSelectableVerificationRoles(roles);
  const selectableRoleIds = new Set(selectableRoles.map((role) => role.id));
  const roleGroups = groupVerificationRoles(roles);
  const createdRole = (role) => setGrant((current) => ({
    enabled: true,
    roleIds: [...new Set([...current.roleIds, role.id])],
  }));
  const previewConfig = normalizeVerificationConfig({
    ...experience,
    rulesGate: { ...config, enabled: true },
    roleGrant: grant,
    methods: { ...methods, rules: { ...method, enabled: true, requireScroll: true } },
  });
  const previewRoleMap = new Map(roles.map((role) => [role.id, role]));
  const previewPanel = toPublicPanel(previewConfig, previewRoleMap);
  previewPanel.methods.rules = { ...previewPanel.methods.rules, ready: true };

  useEffect(() => {
    if (!dragging) return undefined;
    const resize = (event) => {
      if (dragging === "columns" && layoutRef.current) {
        const bounds = layoutRef.current.getBoundingClientRect();
        const ratio = ((event.clientX - bounds.left) / bounds.width) * 100;
        setEditorWidth(Math.max(30, Math.min(70, ratio)));
      }
    };
    const stop = () => setDragging(null);
    window.addEventListener("pointermove", resize);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointermove", resize);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, [dragging]);

  const renderPreview = (label) => (
    <section className={`rules-preview-device rules-preview-${label.toLowerCase()}`} key={label}>
      <div className="rules-preview-device-heading">
        <span>{label === "Mobile" ? "Mobile preview" : "Desktop preview"}</span>
        <small>{label === "Mobile" ? "Narrow screen" : "Community panel"}</small>
      </div>
      <div className="rules-preview-canvas">
        <VerificationPanelView
          key={`${label}-${method.items.map((rule) => `${rule.id}:${rule.title}:${rule.body}`).join("|")}`}
          panel={previewPanel}
          state={{ completed: [], pending: [] }}
          busy={false}
          onComplete={async () => ({ success: false, error: "Preview only." })}
          focusMethod="rules"
          onlyMethods={["rules"]}
        />
      </div>
    </section>
  );

  const save = async () => {
    const items = rulesText.split("\n").map((title, index) => ({
      id: method.items[index]?.id || `rule-${index + 1}`,
      title: title.trim(),
      body: method.items[index]?.body || "",
    })).filter((item) => item.title);
    if (config.enabled && !items.length) return setError("Add at least one rule members must accept.");
    if (config.enabled && !config.rulesChannelId) return setError("Choose the channel where members will read the rules.");
    if (config.enabled && config.flow === "rules_then_verify") {
      if (!config.verificationChannelId) return setError("Choose the verification channel to unlock after rules acceptance.");
      if (config.verificationChannelId === config.rulesChannelId) return setError("Choose different rules and verification channels.");
      const secondConfig = normalizeVerificationConfig({
        roleGrant: grant,
        methods: { ...methods, rules: method },
      });
      const roleMap = new Map(roles.map((role) => [role.id, role]));
      if (!isMethodReady(config.secondMethod, secondConfig.methods[config.secondMethod], roleMap, secondConfig.methods, secondConfig)) {
        const label = config.secondMethod === "quick" ? "Quick verify" : config.secondMethod === "picture" ? "Picture check" : "Reaction check";
        return setError(`Finish setting up ${label} before using it after the rules gate.`);
      }
      if (config.secondMethod === "picture" && !pictureReady) return setError("Finish setting up the picture challenge before using it after the rules gate.");
    }
    if (grant.enabled && !grant.roleIds.length) {
      return setError("Choose at least one safe role members can receive after verification.");
    }
    if (grant.enabled && grant.roleIds.some((roleId) => !selectableRoleIds.has(roleId))) {
      return setError("Remove unavailable roles or move safe roles above the default member role before saving.");
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        ...config,
        rulesPanelEnabled: true,
        roleGrant: grant,
        experience,
        rulesMethod: { ...method, enabled: config.enabled, requireScroll: true, items },
      });
      return true;
    } catch (saveError) { setError(saveError.message || "Could not save rules verification."); return false; }
    finally { setSaving(false); }
  };
  const saveAndPublish = async () => {
    if (!config.rulesChannelId) {
      setError("Choose the channel where the rules panel should be published.");
      return;
    }
    if (!method.items.some((item) => item.title.trim())) {
      setError("Add at least one rule before publishing the panel.");
      return;
    }
    const saved = await save();
    if (!saved) return;
    try {
      await onPublish?.(config.rulesChannelId);
    } catch (publishError) {
      setError(publishError.message || "Could not publish the rules panel.");
    }
  };
  const promoteRole = async (roleId) => {
    setError("");
    try {
      await onPromoteRole?.(roleId);
    } catch (promotionError) {
      setError(promotionError.message || "Could not update this role's position.");
    }
  };

  return (
    <div className={`rules-verification-dashboard${previewOpen ? "" : " preview-collapsed"}${dragging ? " is-resizing" : ""}`} ref={layoutRef} style={{ "--editor-width": `${editorWidth}%` }}>
      <div className="rules-editor-pane">
        <section>
        <h3>{standalone ? "Community rules" : "Rules gate"}</h3>
        <label className="rules-check"><input type="checkbox" checked={config.enabled} disabled={disabled} onChange={(event) => patch({ enabled: event.target.checked })} /> {standalone ? "Use these rules as a verification gate" : "Activate rules verification"}</label>
        {standalone && <p className="rules-help">Manage the community rules independently here. Enable the verification gate only when members must accept them before unlocking access.</p>}
        <label>After accepting the rules
          <select value={config.flow} disabled={disabled} onChange={(event) => patch({ flow: event.target.value })}>
            <option value="rules_only">Grant the selected role after rules acceptance</option>
            <option value="rules_then_verify">Unlock another verification step first</option>
          </select>
        </label>
        <label>Heading<input value={method.title} disabled={disabled} onChange={(event) => patchMethod({ title: event.target.value })} /></label>
        <label>Supporting text<textarea value={method.description} disabled={disabled} onChange={(event) => patchMethod({ description: event.target.value })} /></label>
        <label>Community rules<textarea className="rules-text" value={rulesText} disabled={disabled} onChange={(event) => patchMethod({ items: event.target.value.split("\n").map((title, index) => ({ id: method.items[index]?.id || `rule-${index + 1}`, title, body: method.items[index]?.body || "" })) })} placeholder="Write one rule per line" /></label>
        <p className="rules-help">Members must reach the end of the rules and confirm they have read them before continuing.</p>
        </section>
        <section>
        <h3>Channel routing</h3>
        <p className="rules-help">The rules channel is always visible to community members. In the two-step flow, the verification channel appears only after rules are accepted.</p>
        <label>Rules channel<select value={config.rulesChannelId} disabled={disabled} onChange={(event) => patch({ rulesChannelId: event.target.value })}><option value="">Choose a channel</option>{textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}</select></label>
        {config.flow === "rules_then_verify" && <>
          <label>Verification channel<select value={config.verificationChannelId} disabled={disabled} onChange={(event) => patch({ verificationChannelId: event.target.value })}><option value="">Choose a channel</option>{textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}</select></label>
          <label>Verification step<select value={config.secondMethod} disabled={disabled} onChange={(event) => patch({ secondMethod: event.target.value })}><option value="quick">Quick verify</option><option value="picture">Picture check</option><option value="reaction">Reaction check</option></select></label>
        </>}
        </section>
        <section>
        <h3>Role granted after verification</h3>
        <label className="rules-check"><input type="checkbox" checked={grant.enabled} disabled={disabled} onChange={(event) => setGrant((current) => ({ ...current, enabled: event.target.checked }))} /> Ask members to choose an access role</label>
        <p className="rules-help">Role permissions and channel access come from the role settings. A member's highest-ranked assigned role determines their access.</p>
        <div className="rules-role-options">
          {roleGroups.map((roleGroup) => {
            const role = roleGroup.roles.find((candidate) => selectableRoleIds.has(candidate.id)) || roleGroup.role;
            const issue = getVerificationRoleIssue(role, roles);
            const eligible = !issue;
            const groupIds = roleGroup.roles.map((candidate) => candidate.id);
            const groupSelected = groupIds.some((id) => grant.roleIds.includes(id));
            return (
            <div className={`rules-role-entry${eligible ? "" : " ineligible"}`} key={roleGroup.key}>
              <VerificationRoleActions role={role} canManage={canManageRoles} onManageRole={onManageRole} onDeleteRole={onDeleteRole} />
              <label className="rules-role-option">
                <input
                  type="checkbox"
                  checked={groupSelected}
                  disabled={disabled || !grant.enabled || (!eligible && !groupSelected)}
                  onChange={(event) => setGrant((current) => ({
                    ...current,
                    roleIds: event.target.checked
                      ? [...new Set([...current.roleIds.filter((id) => !groupIds.includes(id)), role.id])]
                      : current.roleIds.filter((id) => !groupIds.includes(id)),
                  }))}
                />
                <i style={{ background: role.color || "var(--accent)" }}>{role.icon || "♟"}</i>
                <span>
                  <strong>{role.name}</strong>{roleGroup.roles.length > 1 && <small>{roleGroup.roles.length} matching role entries</small>}<small>Rank {Number(role.position) + 1}</small>
                  {!eligible && <small className="rules-role-reason">
                    {issue === "default" ? "Default member role cannot be granted."
                      : issue === "owner" ? "Owner role is protected."
                        : issue === "rank" ? "Move above the default member role to make this eligible."
                          : "High-impact permissions prevent this role from being granted."}
                  </small>}
                </span>
              </label>
              {!role.is_default && role.name?.trim().toLowerCase() !== "owner" && <button type="button" className="rules-review-toggle" aria-expanded={reviewRoleId === role.id} onClick={() => setReviewRoleId((current) => current === role.id ? null : role.id)}>
                {reviewRoleId === role.id ? "Hide access review" : "Review permissions & channels"}
              </button>}
              {reviewRoleId === role.id && <RoleAccessReview role={role} communityId={communityId} roles={roles} canManage={canManageRoles} onUpdateRole={onUpdateRole} />}
              {issue === "rank" && <button type="button" className="rules-review-toggle" disabled={disabled || !onPromoteRole} onClick={() => promoteRole(role.id)}>Move {role.name} above default role</button>}
            </div>
          );
          })}
          {!roles.length && <p className="rules-help">No community roles were loaded. Refresh the dashboard or create a role first.</p>}
        </div>
        <CreateVerificationRoleControl disabled={disabled} onCreateRole={onCreateRole} onCreated={createdRole} />
        </section>
        <VerificationExperienceSettings value={experience} onChange={setExperience} disabled={disabled} />
        {error && <p className="rules-error" role="alert">{error}</p>}
        {publishStatus && <p className="rules-help" role="status">{publishStatus}</p>}
        <div className="rules-save-actions">
          <button type="button" className="rules-save" disabled={disabled || saving || publishing} onClick={save}><Check size={14} /> {saving ? "Saving..." : standalone ? "Save community rules" : "Save rules verification"}</button>
          <button type="button" className="rules-save" disabled={disabled || saving || publishing || !onPublish} onClick={saveAndPublish}><Check size={14} /> {publishing ? "Publishing..." : "Save and publish rules panel"}</button>
        </div>
      </div>
      {previewOpen && <div className="rules-preview-pane">
        <div className="rules-preview-heading">
          <div><strong>Live preview</strong><span>Updates as you edit the rules.</span></div>
          <div className="rules-preview-controls">
            <div className="rules-preview-device-toggle" role="group" aria-label="Preview device">
              <button type="button" className={previewDevice === "mobile" ? "selected" : ""} aria-pressed={previewDevice === "mobile"} onClick={() => setPreviewDevice("mobile")}>Mobile</button>
              <button type="button" className={previewDevice === "desktop" ? "selected" : ""} aria-pressed={previewDevice === "desktop"} onClick={() => setPreviewDevice("desktop")}>Desktop</button>
            </div>
            <button type="button" onClick={() => setPreviewOpen(false)} aria-label="Collapse preview"><EyeOff size={14} /> Hide</button>
          </div>
        </div>
        {renderPreview(previewDevice === "mobile" ? "Mobile" : "Desktop")}
      </div>}
      {previewOpen && <div
        className="rules-resize-divider rules-column-divider"
        role="separator"
        aria-label="Resize rules editor and preview"
        aria-orientation="vertical"
        aria-valuemin={30}
        aria-valuemax={70}
        aria-valuenow={Math.round(editorWidth)}
        tabIndex={0}
        onPointerDown={(event) => { event.preventDefault(); setDragging("columns"); }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") setEditorWidth((width) => Math.max(30, width - 5));
          if (event.key === "ArrowRight") setEditorWidth((width) => Math.min(70, width + 5));
        }}
      />}
      {!previewOpen && <button type="button" className="rules-preview-show" onClick={() => setPreviewOpen(true)}><Eye size={14} /> Show preview</button>}
      <style>{`.rules-verification-dashboard{position:relative;display:grid;grid-template-columns:minmax(320px,var(--editor-width)) 8px minmax(330px,1fr);gap:0;min-height:calc(100dvh - 170px);height:100%;color:var(--text)}.rules-editor-pane{grid-column:1;min-width:0;overflow:auto;display:flex;flex-direction:column;gap:12px;padding:0 12px 12px 0}.rules-editor-pane>section{display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid var(--surface-border);border-radius:10px;background:rgba(0,0,0,.12)}.rules-verification-dashboard h3{margin:0;font-size:calc((13px) + 1px);color:var(--text)}.rules-verification-dashboard label{display:flex;flex-direction:column;gap:5px;color:var(--text-secondary);font-size:calc((11px) + 1px)}.rules-verification-dashboard input,.rules-verification-dashboard textarea,.rules-verification-dashboard select{width:100%;box-sizing:border-box;padding:8px;border:1px solid var(--surface-border);border-radius:7px;background:var(--surface);color:var(--text);font:inherit}.rules-verification-dashboard textarea{min-height:56px;resize:vertical}.rules-verification-dashboard .rules-text{min-height:130px}.rules-check{display:flex!important;flex-direction:row!important;align-items:center;gap:7px}.rules-check input{width:auto}.rules-help{margin:0;color:var(--text-secondary);font-size:calc((10px) + 1px);line-height:1.45}.rules-error{margin:0;color:var(--danger);font-size:calc((11px) + 1px)}.rules-role-options{display:grid;gap:6px}.rules-role-entry{position:relative;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:6px;padding:7px;border:1px solid var(--surface-border);border-radius:9px;background:var(--surface)}.rules-role-entry.ineligible{border-color:rgba(255,190,92,.32)}.rules-role-entry>.verification-role-actions{grid-column:2;grid-row:1}.rules-role-option{grid-column:1;grid-row:1;display:flex!important;flex-direction:row!important;align-items:center;gap:8px;padding:4px;border:0;border-radius:0;background:transparent}.rules-role-option input{width:auto!important}.rules-role-option i{display:grid;place-items:center;width:25px;height:25px;border-radius:7px;color:#111;font-style:normal}.rules-role-option span{display:flex;flex-direction:column;gap:2px}.rules-role-option strong{color:var(--text);font-size:calc((11px) + 1px)}.rules-role-option small{color:var(--text-secondary);font-size:calc((9px) + 1px)}.rules-role-option .rules-role-reason{color:#eac88e}.rules-role-entry>.rules-review-toggle,.rules-role-entry>.verification-role-review{grid-column:1/-1}.rules-review-toggle{justify-self:start;padding:5px 8px;border:1px solid var(--surface-border);border-radius:7px;background:rgba(156,255,0,.06);color:var(--accent);font:700 10px inherit;cursor:pointer}.rules-review-toggle:disabled{opacity:.55;cursor:not-allowed}.rules-save-actions{display:flex;flex-wrap:wrap;gap:8px}.rules-save-actions .rules-save{flex:1 1 190px}.rules-save{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:9px;border:0;border-radius:8px;background:var(--accent);color:#111;font:800 11px inherit;cursor:pointer}.rules-preview-pane{grid-column:3;grid-row:1;min-width:0;min-height:0;display:flex;flex-direction:column;gap:8px;padding-left:12px;overflow:hidden}.rules-preview-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:38px;padding:0 8px;border-bottom:1px solid var(--surface-border);background:var(--surface-strong)}.rules-preview-heading>div:first-child{display:grid;gap:2px}.rules-preview-heading strong{font-size:calc((11px) + 1px)}.rules-preview-heading span,.rules-preview-device-heading small{color:var(--text-secondary);font-size:calc((9px) + 1px)}.rules-preview-controls{display:flex;align-items:center;gap:8px}.rules-preview-heading button{display:inline-flex;align-items:center;gap:5px;padding:5px 8px;border:1px solid var(--surface-border);border-radius:7px;background:var(--surface);color:var(--text-secondary);font:600 9px inherit;cursor:pointer}.rules-preview-device-toggle{display:inline-flex;padding:2px;border:1px solid var(--surface-border);border-radius:8px;background:var(--surface)}.rules-preview-device-toggle button{border:0;background:transparent;color:var(--text-secondary);font-size:calc((9px) + 1px)}.rules-preview-device-toggle button.selected{border-radius:6px;background:var(--accent-bg);color:var(--accent)}.rules-preview-device{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;overflow:hidden;padding:10px;border:1px solid var(--surface-border);border-radius:10px;background:var(--surface)}.rules-preview-device-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 2px 7px}.rules-preview-device-heading>span{font-size:calc((10px) + 1px);font-weight:800}.rules-preview-canvas{flex:1;min-height:0;overflow:auto;padding:6px;border-radius:8px;background:var(--app-background,#0b0d0e)}.rules-preview-mobile .rules-preview-canvas{display:flex;justify-content:center}.rules-preview-mobile .vp{width:min(100%,390px);margin:0;padding:13px;border-radius:20px}.rules-preview-desktop .rules-preview-canvas{display:flex;justify-content:center}.rules-preview-desktop .vp{width:100%;max-width:620px;margin:0 auto;padding:16px}.rules-resize-divider{z-index:2;touch-action:none;background:transparent;outline:none}.rules-resize-divider::after{content:"";display:block;border-radius:99px;background:var(--surface-border);transition:background .15s}.rules-resize-divider:hover::after,.rules-resize-divider:focus-visible::after,.rules-verification-dashboard.is-resizing .rules-resize-divider::after{background:var(--accent)}.rules-column-divider{grid-column:2;grid-row:1;cursor:col-resize;display:grid;place-items:center}.rules-column-divider::after{width:2px;height:100%}.rules-preview-show{position:absolute;right:12px;top:3px;z-index:2;display:inline-flex;align-items:center;gap:5px;padding:6px 9px;border:1px solid var(--surface-border);border-radius:7px;background:var(--surface);color:var(--accent);font:700 10px inherit;cursor:pointer}.rules-verification-dashboard.preview-collapsed{grid-template-columns:minmax(0,1fr)}.rules-verification-dashboard.preview-collapsed .rules-editor-pane{grid-column:1;padding-right:0}.rules-verification-dashboard.is-resizing,.rules-verification-dashboard.is-resizing *{user-select:none;cursor:col-resize}@media(max-width:900px){.rules-verification-dashboard{display:flex;flex-direction:column;height:auto;min-height:0;gap:12px}.rules-editor-pane{order:1;overflow:visible;padding:0}.rules-preview-show{position:static;align-self:flex-start;order:2}.rules-preview-pane{order:3;display:flex;min-height:460px;flex-direction:column;gap:10px;padding:0;overflow:visible}.rules-preview-heading{order:0;height:auto;padding:8px 0;background:transparent;border:0}.rules-preview-device{min-height:380px}.rules-preview-device-heading{flex-shrink:0}.rules-column-divider{display:none}}@media(max-width:520px){.rules-preview-pane{min-height:500px}.rules-preview-device{min-height:430px}.rules-preview-device .vp{padding:12px}}`}</style>
    </div>
  );
}
