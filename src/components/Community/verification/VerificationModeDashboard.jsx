import React, { useState } from "react";

export default function VerificationModeDashboard({ mode, value = {}, onSave, disabled = false }) {
  const [config, setConfig] = useState({ ...value, [mode + "Enabled"]: value[mode + "Enabled"] !== false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const patch = (next) => setConfig((current) => ({ ...current, ...next }));
  const section = config[mode] || {};
  const patchSection = (next) => patch({ [mode]: { ...section, ...next } });
  const save = async () => {
    setSaving(true); setError("");
    try { await onSave(config); } catch (saveError) { setError(saveError.message || "Could not save verification settings."); }
    finally { setSaving(false); }
  };
  const isQuick = mode === "quick";
  return <div className="verification-mode-dashboard"><section><h3>{isQuick ? "Quick Verify" : "Picture Check"}</h3><label className="mode-check"><input type="checkbox" checked={config[mode + "Enabled"]} disabled={disabled} onChange={(event) => patch({ [mode + "Enabled"]: event.target.checked })} /> Activate {isQuick ? "Quick Verify" : "Picture Check"}</label><label>Title<input value={section.idleTitle || ""} disabled={disabled} onChange={(event) => patchSection({ idleTitle: event.target.value })} /></label><label>{isQuick ? "Description" : "Instruction"}<textarea value={isQuick ? section.idleDescription || "" : section.descriptionTemplate || ""} disabled={disabled} onChange={(event) => patchSection(isQuick ? { idleDescription: event.target.value } : { descriptionTemplate: event.target.value })} /></label>{isQuick && <label>Button label<input value={section.buttonLabel || ""} disabled={disabled} onChange={(event) => patchSection({ buttonLabel: event.target.value })} /></label>}</section>{!isQuick && <section><h3>Picture challenge</h3><p>Add and label the picture challenge cards in the full Verification methods dashboard, then return here to activate this mode.</p></section>}{error && <p className="mode-error">{error}</p>}<button type="button" className="mode-save" disabled={disabled || saving} onClick={save}>{saving ? "Saving..." : `Save ${isQuick ? "Quick Verify" : "Picture Check"}`}</button><style>{`.verification-mode-dashboard{display:flex;flex-direction:column;gap:12px}.verification-mode-dashboard section{display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid var(--surface-border);border-radius:10px;background:rgba(0,0,0,.12)}.verification-mode-dashboard h3{margin:0;font-size:13px}.verification-mode-dashboard label{display:flex;flex-direction:column;gap:5px;color:var(--text-secondary);font-size:11px}.verification-mode-dashboard input,.verification-mode-dashboard textarea{width:100%;padding:8px;border:1px solid var(--surface-border);border-radius:7px;background:var(--surface);color:var(--text);font:inherit}.verification-mode-dashboard textarea{min-height:65px}.mode-check{display:flex!important;flex-direction:row!important;align-items:center;gap:7px}.mode-check input{width:auto}.mode-error{margin:0;color:var(--danger);font-size:11px}.mode-save{padding:9px;border:0;border-radius:8px;background:var(--accent);color:#111;font:800 11px inherit;cursor:pointer}`}</style></div>;
}
