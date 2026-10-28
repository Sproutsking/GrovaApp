import React, { useState } from "react";
import { Check, Mail, Send } from "lucide-react";

const DEFAULT_CONFIG = {
  title: "Open a private ticket",
  description: "Tell the community team what you need help with.",
  closeTitle: "Close ticket",
  closeDescription: "Close this ticket when your request is resolved.",
};

export default function TicketToolDashboard({
  value = {},
  channels = [],
  selectedChannelIds = [],
  disabled = false,
  onToggleChannel,
  onSave,
  onPublish,
  publishStatus = "",
  publishing = false,
}) {
  const [config, setConfig] = useState({ ...DEFAULT_CONFIG, ...value });
  const [previewDevice, setPreviewDevice] = useState("mobile");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const textChannels = channels.filter((channel) => channel.type !== "voice");

  const update = (key, nextValue) => setConfig((current) => ({ ...current, [key]: nextValue }));
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const saved = await onSave(config);
      if (saved === false) throw new Error("Could not save ticket settings.");
      return true;
    } catch (saveError) {
      setError(saveError.message || "Could not save ticket settings.");
      return false;
    } finally {
      setSaving(false);
    }
  };
  const saveAndPublish = async () => {
    const saved = await save();
    if (!saved) return;
    try {
      await onPublish?.(selectedChannelIds);
    } catch (publishError) {
      setError(publishError.message || "Could not publish the ticket panel.");
    }
  };

  return (
    <div className="ticket-dashboard">
      <div className="ticket-dashboard-editor">
        <section className="ticket-dashboard-block">
          <strong>Member-facing channel</strong>
          <p>Choose where members can open a private support ticket.</p>
          <div className="ticket-dashboard-channels">
            {textChannels.map((channel) => {
              const selected = selectedChannelIds.includes(channel.id);
              return (
                <button
                  type="button"
                  key={channel.id}
                  disabled={disabled}
                  className={selected ? "selected" : ""}
                  aria-pressed={selected}
                  onClick={() => onToggleChannel?.(channel.id)}
                >
                  <span>{selected ? <Check size={12} /> : "+"}</span>#{channel.name}
                </button>
              );
            })}
            {!textChannels.length && <p>Create a text channel before enabling tickets.</p>}
          </div>
        </section>
        <section className="ticket-dashboard-block">
          <strong>Ticket entry card</strong>
          <label>Title<input value={config.title} maxLength={100} disabled={disabled} onChange={(event) => update("title", event.target.value)} /></label>
          <label>Description<textarea value={config.description} maxLength={400} rows={3} disabled={disabled} onChange={(event) => update("description", event.target.value)} /></label>
        </section>
        <section className="ticket-dashboard-block">
          <strong>Close-ticket message</strong>
          <label>Title<input value={config.closeTitle} maxLength={100} disabled={disabled} onChange={(event) => update("closeTitle", event.target.value)} /></label>
          <label>Description<textarea value={config.closeDescription} maxLength={400} rows={3} disabled={disabled} onChange={(event) => update("closeDescription", event.target.value)} /></label>
        </section>
        {error && <p className="ticket-dashboard-error" role="alert">{error}</p>}
        {publishStatus && <p style={{ margin: 0, color: "var(--accent)", fontSize: 10 }} role="status">{publishStatus}</p>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button type="button" className="ticket-dashboard-save" style={{ flex: "1 1 160px" }} disabled={disabled || saving || publishing} onClick={save}>
            {saving ? "Saving..." : "Save ticket setup"}
          </button>
          <button type="button" className="ticket-dashboard-save" style={{ flex: "1 1 160px" }} disabled={disabled || saving || publishing || !onPublish} onClick={saveAndPublish}>
            {publishing ? "Publishing..." : "Save and publish panel"}
          </button>
        </div>
      </div>

      <section className="ticket-dashboard-preview">
        <header>
          <div><strong>Live member preview</strong><span>Changes appear here as you type.</span></div>
          <div className="ticket-dashboard-device-toggle" role="group" aria-label="Preview device">
            <button type="button" aria-pressed={previewDevice === "mobile"} className={previewDevice === "mobile" ? "selected" : ""} onClick={() => setPreviewDevice("mobile")}>Mobile</button>
            <button type="button" aria-pressed={previewDevice === "desktop"} className={previewDevice === "desktop" ? "selected" : ""} onClick={() => setPreviewDevice("desktop")}>Desktop</button>
          </div>
        </header>
        <div className={`ticket-dashboard-canvas ${previewDevice}`}>
          <article className="ticket-member-card">
            <div className="ticket-member-heading">
              <span className="ticket-member-icon"><Mail size={18} /></span>
              <div><small>PRIVATE SUPPORT</small><h3>{config.title || "Open a private ticket"}</h3><p>{config.description || "Tell the community team what you need help with."}</p></div>
            </div>
            <button type="button" disabled><Send size={14} /> Create private ticket</button>
          </article>
          <article className="ticket-close-preview">
            <strong>{config.closeTitle || "Close ticket"}</strong>
            <span>{config.closeDescription || "Close this ticket when your request is resolved."}</span>
            <button type="button" disabled>Close ticket</button>
          </article>
        </div>
      </section>

      <style>{`.ticket-dashboard{display:grid;grid-template-columns:minmax(300px,1fr) minmax(340px,42%);gap:16px;min-height:460px}.ticket-dashboard-editor{min-width:0;display:flex;flex-direction:column;gap:11px}.ticket-dashboard-block{display:flex;flex-direction:column;gap:8px;padding:13px;border:1px solid var(--surface-border);border-radius:11px;background:rgba(0,0,0,.12)}.ticket-dashboard-block>strong{font-size:12px;color:var(--text)}.ticket-dashboard-block>p{margin:0;color:var(--text-secondary);font-size:10px;line-height:1.45}.ticket-dashboard-block label{display:flex;flex-direction:column;gap:5px;color:var(--text-secondary);font-size:10px}.ticket-dashboard-block input,.ticket-dashboard-block textarea{width:100%;box-sizing:border-box;padding:8px;border:1px solid var(--surface-border);border-radius:7px;background:var(--surface);color:var(--text);font:inherit}.ticket-dashboard-block textarea{resize:vertical}.ticket-dashboard-channels{display:flex;flex-wrap:wrap;gap:6px}.ticket-dashboard-channels button{display:flex;align-items:center;gap:6px;padding:7px 9px;border:1px solid var(--surface-border);border-radius:8px;background:var(--surface);color:var(--text-secondary);font:600 10px inherit;cursor:pointer}.ticket-dashboard-channels button.selected{border-color:var(--accent-border);background:var(--accent-bg);color:var(--accent)}.ticket-dashboard-channels button:disabled{opacity:.55;cursor:not-allowed}.ticket-dashboard-channels button span{display:grid;place-items:center;width:16px;height:16px;border-radius:5px;background:var(--accent-bg);color:var(--accent)}.ticket-dashboard-error{margin:0;color:var(--danger);font-size:11px}.ticket-dashboard-save{padding:10px;border:0;border-radius:8px;background:var(--accent);color:#111;font:800 11px inherit;cursor:pointer}.ticket-dashboard-save:disabled{opacity:.55;cursor:not-allowed}.ticket-dashboard-preview{min-width:0;min-height:440px;display:flex;flex-direction:column;gap:10px;padding:13px;border:1px solid var(--surface-border);border-radius:11px;background:var(--surface)}.ticket-dashboard-preview>header{display:flex;align-items:center;justify-content:space-between;gap:8px}.ticket-dashboard-preview>header>div:first-child{display:grid;gap:3px}.ticket-dashboard-preview>header strong{font-size:11px;color:var(--text)}.ticket-dashboard-preview>header span{font-size:9px;color:var(--text-secondary)}.ticket-dashboard-device-toggle{display:flex;padding:2px;border:1px solid var(--surface-border);border-radius:8px;background:var(--surface-strong)}.ticket-dashboard-device-toggle button{padding:5px 8px;border:0;border-radius:6px;background:transparent;color:var(--text-secondary);font:700 9px inherit;cursor:pointer}.ticket-dashboard-device-toggle button.selected{background:var(--accent-bg);color:var(--accent)}.ticket-dashboard-canvas{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;justify-content:center;gap:12px;padding:14px;border-radius:9px;background:var(--app-background,#0b0d0e)}.ticket-dashboard-canvas.mobile .ticket-member-card,.ticket-dashboard-canvas.mobile .ticket-close-preview{width:min(100%,390px);align-self:center}.ticket-dashboard-canvas.desktop .ticket-member-card,.ticket-dashboard-canvas.desktop .ticket-close-preview{width:100%;max-width:620px;align-self:center}.ticket-member-card,.ticket-close-preview{box-sizing:border-box;padding:16px;border:1px solid rgba(156,255,0,.18);border-radius:13px;background:linear-gradient(145deg,rgba(24,33,25,.96),rgba(9,13,10,.98));color:#eef8ed}.ticket-member-heading{display:flex;align-items:flex-start;gap:11px;margin-bottom:15px}.ticket-member-icon{width:38px;height:38px;flex-shrink:0;display:grid;place-items:center;border:1px solid rgba(156,255,0,.28);border-radius:10px;background:rgba(156,255,0,.1);color:#9cff00}.ticket-member-heading small{color:#9cff00;font-size:9px;font-weight:800;letter-spacing:.1em}.ticket-member-heading h3{margin:4px 0;font-size:16px;overflow-wrap:anywhere}.ticket-member-heading p{margin:0;color:#a2b0a2;font-size:11px;line-height:1.5;overflow-wrap:anywhere}.ticket-member-card>button,.ticket-close-preview>button{display:flex;align-items:center;gap:7px;padding:9px 12px;border:0;border-radius:8px;background:#9cff00;color:#071000;font:800 10px inherit}.ticket-member-card>button:disabled,.ticket-close-preview>button:disabled{opacity:.8}.ticket-close-preview{display:flex;flex-direction:column;gap:7px}.ticket-close-preview strong{font-size:12px}.ticket-close-preview span{color:#a2b0a2;font-size:10px;line-height:1.45}.ticket-close-preview>button{align-self:flex-start;background:#ef6262;color:white}@media(max-width:850px){.ticket-dashboard{grid-template-columns:1fr}.ticket-dashboard-preview{min-height:420px}}`}</style>
    </div>
  );
}
