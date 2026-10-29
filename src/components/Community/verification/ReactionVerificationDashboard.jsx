import React, { useState } from "react";
import { Check } from "lucide-react";
import { normalizeVerificationConfig } from "./verificationConfig";
import CreateVerificationRoleControl from "./CreateVerificationRoleControl";
import VerificationRoleSelector from "./VerificationRoleSelector";

const LETTERS = ["A", "B", "C", "D", "E"];

export default function ReactionVerificationDashboard({ value = {}, roles = [], onCreateRole, onPromoteRole, onManageRole, onDeleteRole, canManageRoles = false, onSave, onConfigChange, disabled = false }) {
  const [config, setConfig] = useState(() => normalizeVerificationConfig(value));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const method = config.methods.reaction;
  const updateMethod = (next) => {
    const nextConfig = {
      ...config,
      methods: { ...config.methods, reaction: { ...method, ...next } },
    };
    setConfig(nextConfig);
    onConfigChange?.(nextConfig);
  };

  const setChoiceCount = (count) => {
    const choices = Array.from({ length: count }, (_, index) => ({
      id: LETTERS[index],
      label: LETTERS[index],
    }));
    updateMethod({
      choices,
      correctId: choices.some((choice) => choice.id === method.correctId)
        ? method.correctId
        : choices[0].id,
    });
  };

  const save = async () => {
    if (method.enabled && (!method.choices?.length || !method.choices.some((choice) => choice.id === method.correctId))) {
      setError("Add at least one answer and choose the correct letter.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(config);
    } catch (saveError) {
      setError(saveError.message || "Could not save reaction verification.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="reaction-verification-dashboard">
      <section>
        <h3>Reaction check</h3>
        <p>Give members an instruction and one to five letter buttons. Select which answer is correct; the answer key stays server-side.</p>
        <label className="reaction-check">
          <input type="checkbox" checked={Boolean(method.enabled)} disabled={disabled} onChange={(event) => updateMethod({ enabled: event.target.checked })} />
          Activate Reaction Check
        </label>
        <label>
          Title
          <input value={method.title || ""} disabled={disabled} onChange={(event) => updateMethod({ title: event.target.value })} />
        </label>
        <label>
          Instruction
          <textarea value={method.instruction || ""} disabled={disabled} onChange={(event) => updateMethod({ instruction: event.target.value })} />
        </label>
        <div className="reaction-role-select" role="group" aria-label="Role granted after this check">
          <span>Role granted after this check</span>
          <VerificationRoleSelector
            roles={roles}
            selectedRoleId={method.roleId}
            onSelect={(roleId) => updateMethod({ roleId })}
            onPromoteRole={onPromoteRole}
            onManageRole={onManageRole}
            onDeleteRole={onDeleteRole}
            canManageRoles={canManageRoles}
            disabled={disabled || Boolean(config.roleGrant?.enabled)}
          />
        </div>
        {config.roleGrant?.enabled && <p className="reaction-help">Access roles are configured below as member-selectable choices.</p>}
        {!config.roleGrant?.enabled && <CreateVerificationRoleControl disabled={disabled} onCreateRole={onCreateRole} onCreated={(role) => updateMethod({ roleId: role.id })} />}
      </section>
      <section>
        <h3>Answer buttons</h3>
        <p>Choose one to five letter buttons, then mark the correct answer.</p>
        <div className="reaction-count" role="group" aria-label="Number of reaction answers">
          {LETTERS.map((letter, index) => {
            const count = index + 1;
            return <button type="button" key={letter} aria-pressed={method.choices.length === count} disabled={disabled} onClick={() => setChoiceCount(count)}>{count}</button>;
          })}
        </div>
        <div className="reaction-choices">
          {method.choices.map((choice) => (
            <button type="button" key={choice.id} className={method.correctId === choice.id ? "correct" : ""} aria-pressed={method.correctId === choice.id} disabled={disabled} onClick={() => updateMethod({ correctId: choice.id })}>
              {method.correctId === choice.id && <Check size={14} />}
              <span>{choice.label}</span>
              <small>{method.correctId === choice.id ? "Correct answer" : "Mark as correct"}</small>
            </button>
          ))}
        </div>
      </section>
      {error && <p className="reaction-error" role="alert">{error}</p>}
      <button type="button" className="reaction-save" disabled={disabled || saving} onClick={save}>{saving ? "Saving..." : "Save Reaction Check"}</button>
      <style>{`.reaction-verification-dashboard{display:flex;flex-direction:column;gap:12px}.reaction-verification-dashboard section{display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid var(--surface-border);border-radius:10px;background:rgba(0,0,0,.12)}.reaction-verification-dashboard h3{margin:0;color:var(--text);font-size:calc((13px) + 1px)}.reaction-verification-dashboard p,.reaction-verification-dashboard label,.reaction-help,.reaction-role-select>span{margin:0;color:var(--text-secondary);font-size:calc((10px) + 1px);line-height:1.5}.reaction-verification-dashboard label{display:flex;flex-direction:column;gap:5px}.reaction-verification-dashboard input:not([type=checkbox]),.reaction-verification-dashboard textarea{width:100%;box-sizing:border-box;padding:8px;border:1px solid var(--surface-border);border-radius:7px;background:var(--surface);color:var(--text);font:inherit}.reaction-verification-dashboard textarea{min-height:65px;resize:vertical}.reaction-verification-dashboard .reaction-check{display:flex;flex-direction:row;align-items:center;gap:7px}.reaction-verification-dashboard .reaction-check input{width:auto}.reaction-role-select{display:grid;gap:5px}.reaction-count,.reaction-choices{display:flex;flex-wrap:wrap;gap:7px}.reaction-count button,.reaction-choices button{display:inline-flex;align-items:center;justify-content:center;gap:5px;padding:8px 11px;border:1px solid var(--surface-border);border-radius:8px;background:var(--surface);color:var(--text);cursor:pointer}.reaction-count button[aria-pressed=true],.reaction-choices button.correct{border-color:var(--accent-border);background:var(--accent-bg);color:var(--accent)}.reaction-choices button{min-width:84px;flex-direction:column}.reaction-choices button small{font-size:calc((9px) + 1px);color:var(--text-secondary)}.reaction-error{color:var(--danger)!important}.reaction-save{padding:9px;border:0;border-radius:8px;background:var(--accent);color:#111;font:800 11px inherit;cursor:pointer}`}</style>
    </div>
  );
}
