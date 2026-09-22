import React, { useState } from "react";
import { Check } from "lucide-react";

export default function RulesVerificationDashboard({ value = {}, channels = [], onSave, disabled = false }) {
  const [config, setConfig] = useState({
    enabled: false,
    title: "Read and accept the community rules",
    description: "Please read these rules before requesting access.",
    rules: "Be respectful.\nKeep the community safe.\nNo spam or harassment.",
    rulesChannelId: "",
    verificationChannelId: "",
    ...value,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const textChannels = channels.filter((channel) => channel.type !== "voice");
  const patch = (next) => setConfig((current) => ({ ...current, ...next }));

  const save = async () => {
    if (!config.rules.trim()) return setError("Add the rules members must accept.");
    if (!config.rulesChannelId || !config.verificationChannelId) return setError("Choose both the rules channel and verification channel.");
    setSaving(true);
    setError("");
    try { await onSave(config); } catch (saveError) { setError(saveError.message || "Could not save rules verification."); }
    finally { setSaving(false); }
  };

  return (
    <div className="rules-verification-dashboard">
      <section><h3>Rules gate</h3><label className="rules-check"><input type="checkbox" checked={config.enabled} disabled={disabled} onChange={(event) => patch({ enabled: event.target.checked })} /> Activate rules verification</label><label>Heading<input value={config.title} disabled={disabled} onChange={(event) => patch({ title: event.target.value })} /></label><label>Supporting text<textarea value={config.description} disabled={disabled} onChange={(event) => patch({ description: event.target.value })} /></label><label>Community rules<textarea className="rules-text" value={config.rules} disabled={disabled} onChange={(event) => patch({ rules: event.target.value })} placeholder="Write one rule per line" /></label></section>
      <section><h3>Channel routing</h3><p className="rules-help">The rules channel displays the full rules. The verification channel displays the acceptance action.</p><label>Rules channel<select value={config.rulesChannelId} disabled={disabled} onChange={(event) => patch({ rulesChannelId: event.target.value })}><option value="">Choose a channel</option>{textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}</select></label><label>Verification channel<select value={config.verificationChannelId} disabled={disabled} onChange={(event) => patch({ verificationChannelId: event.target.value })}><option value="">Choose a channel</option>{textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}</select></label></section>
      {error && <p className="rules-error">{error}</p>}<button type="button" className="rules-save" disabled={disabled || saving} onClick={save}><Check size={14} /> {saving ? "Saving..." : "Save rules verification"}</button>
      <style>{`.rules-verification-dashboard{display:flex;flex-direction:column;gap:12px}.rules-verification-dashboard section{display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid var(--surface-border);border-radius:10px;background:rgba(0,0,0,.12)}.rules-verification-dashboard h3{margin:0;font-size:13px;color:var(--text)}.rules-verification-dashboard label{display:flex;flex-direction:column;gap:5px;color:var(--text-secondary);font-size:11px}.rules-verification-dashboard input,.rules-verification-dashboard textarea,.rules-verification-dashboard select{width:100%;padding:8px;border:1px solid var(--surface-border);border-radius:7px;background:var(--surface);color:var(--text);font:inherit}.rules-verification-dashboard textarea{min-height:56px;resize:vertical}.rules-verification-dashboard .rules-text{min-height:130px}.rules-check{display:flex!important;flex-direction:row!important;align-items:center;gap:7px}.rules-check input{width:auto}.rules-help{margin:0;color:var(--text-secondary);font-size:10px;line-height:1.45}.rules-error{margin:0;color:var(--danger);font-size:11px}.rules-save{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:9px;border:0;border-radius:8px;background:var(--accent);color:#111;font:800 11px inherit;cursor:pointer}`}</style>
    </div>
  );
}
