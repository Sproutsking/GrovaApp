import React, { useState } from "react";
import { Check } from "lucide-react";

export default function RulesVerificationDashboard({ value = {}, rulesMethod = {}, methods = {}, pictureReady = false, channels = [], onSave, disabled = false }) {
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const textChannels = channels.filter((channel) => channel.type !== "voice");
  const patch = (next) => setConfig((current) => ({ ...current, ...next }));
  const patchMethod = (next) => setMethod((current) => ({ ...current, ...next }));
  const rulesText = method.items.map((rule) => rule.title).join("\n");

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
      if (!methods[config.secondMethod]?.enabled) return setError(`Enable ${config.secondMethod === "quick" ? "Quick verify" : "Picture check"} before using it after the rules gate.`);
      if (config.secondMethod === "picture" && !pictureReady) return setError("Finish setting up the picture challenge before using it after the rules gate.");
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        ...config,
        rulesMethod: { ...method, enabled: config.enabled, requireScroll: true, items },
      });
    } catch (saveError) { setError(saveError.message || "Could not save rules verification."); }
    finally { setSaving(false); }
  };

  return (
    <div className="rules-verification-dashboard">
      <section>
        <h3>Rules gate</h3>
        <label className="rules-check"><input type="checkbox" checked={config.enabled} disabled={disabled} onChange={(event) => patch({ enabled: event.target.checked })} /> Activate rules verification</label>
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
          <label>Verification step<select value={config.secondMethod} disabled={disabled} onChange={(event) => patch({ secondMethod: event.target.value })}><option value="quick">Quick verify</option><option value="picture">Picture check</option></select></label>
        </>}
      </section>
      {error && <p className="rules-error">{error}</p>}<button type="button" className="rules-save" disabled={disabled || saving} onClick={save}><Check size={14} /> {saving ? "Saving..." : "Save rules verification"}</button>
      <style>{`.rules-verification-dashboard{display:flex;flex-direction:column;gap:12px}.rules-verification-dashboard section{display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid var(--surface-border);border-radius:10px;background:rgba(0,0,0,.12)}.rules-verification-dashboard h3{margin:0;font-size:13px;color:var(--text)}.rules-verification-dashboard label{display:flex;flex-direction:column;gap:5px;color:var(--text-secondary);font-size:11px}.rules-verification-dashboard input,.rules-verification-dashboard textarea,.rules-verification-dashboard select{width:100%;padding:8px;border:1px solid var(--surface-border);border-radius:7px;background:var(--surface);color:var(--text);font:inherit}.rules-verification-dashboard textarea{min-height:56px;resize:vertical}.rules-verification-dashboard .rules-text{min-height:130px}.rules-check{display:flex!important;flex-direction:row!important;align-items:center;gap:7px}.rules-check input{width:auto}.rules-help{margin:0;color:var(--text-secondary);font-size:10px;line-height:1.45}.rules-error{margin:0;color:var(--danger);font-size:11px}.rules-save{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:9px;border:0;border-radius:8px;background:var(--accent);color:#111;font:800 11px inherit;cursor:pointer}`}</style>
    </div>
  );
}
