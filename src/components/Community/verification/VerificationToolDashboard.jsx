import React, { useState } from "react";
import { Check, Upload, X } from "lucide-react";
import { DEFAULT_VERIFICATION_CONFIG, challengeIsReady, normalizeVerificationConfig } from "./verificationConfig";

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

export default function VerificationToolDashboard({ value, onSave, disabled = false }) {
  const initial = normalizeVerificationConfig(value || DEFAULT_VERIFICATION_CONFIG);
  const [config, setConfig] = useState(initial);
  const [slots, setSlots] = useState(createSlots(initial.challenge.cards));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedMode, setSelectedMode] = useState(null);

  const patch = (next) => setConfig((current) => ({ ...current, ...next }));
  const patchSection = (section, next) => setConfig((current) => ({ ...current, [section]: { ...current[section], ...next } }));
  const patchPanel = (key, next) => setConfig((current) => ({ ...current, panels: { ...current.panels, [key]: { ...current.panels[key], ...next } } }));
  const updateSlot = (id, next) => setSlots((current) => current.map((slot) => slot.id === id ? { ...slot, ...next } : slot));
  const clearSlot = (id) => {
    updateSlot(id, { image: null, label: "" });
    if (config.challenge.correctId === id) patch({ challenge: { ...config.challenge, correctId: null } });
  };
  const handleFile = async (id, file) => {
    if (!file) return;
    try { updateSlot(id, { image: await resizeImage(file) }); } catch { setError("Could not process that image."); }
  };
  const filledCards = slots.filter((slot) => slot.image && slot.label.trim()).map((slot) => ({ id: slot.id, label: slot.label.trim(), image: slot.image }));
  const ready = filledCards.length >= 2 && filledCards.some((card) => card.id === config.challenge.correctId);

  const save = async () => {
    setError("");
    if (!config.quickEnabled && !config.pictureEnabled) return setError("Enable at least one verification mode.");
    if (config.pictureEnabled && !ready) return setError("Picture check needs at least two labeled images and a correct answer.");
    setSaving(true);
    try {
      await onSave({ ...config, challenge: { cards: filledCards, correctId: config.challenge.correctId } });
    } catch (saveError) {
      setError(saveError.message || "Could not save verification setup.");
    } finally { setSaving(false); }
  };

  if (!selectedMode) {
    const modes = [
      ["quick", "Quick verify", "One-tap verification with the live member access flow.", true],
      ["picture", "Picture check", "Image challenge verification with configurable answers.", true],
      ["rules_gate", "Rules gate", "Require members to accept your community rules.", false],
      ["reaction_verification", "Reaction verification", "Verify members through a configured reaction role.", false],
      ["wallet_verification", "Wallet verification", "Verify ownership of a supported wallet identity.", false],
      ["email_verification", "Email verification", "Verify members through an approved email flow.", false],
    ];
    return <div className="verification-mode-picker"><div className="verification-picker-hero"><span>VERIFICATION METHODS</span><h3>Choose a verification experience</h3><p>Quick verify and Picture check are live now. More methods are prepared and will be activated as their secure integrations ship.</p></div><div className="verification-picker-grid">{modes.map(([id, label, description, live]) => <button type="button" key={id} className={`verification-mode-card${live ? " live" : " soon"}`} disabled={disabled || !live} onClick={() => { patch({ mode: id }); setSelectedMode(id); }}>{live ? <span className="verification-mode-state">Live</span> : <span className="verification-mode-state">Coming soon</span>}<strong>{label}</strong><small>{description}</small>{live && <em>Configure identity and settings</em>}</button>)}</div><style>{`.verification-mode-picker{display:flex;flex-direction:column;gap:14px}.verification-picker-hero{padding:16px;border:1px solid rgba(156,255,0,.25);border-radius:12px;background:linear-gradient(135deg,rgba(156,255,0,.09),rgba(0,0,0,.14))}.verification-picker-hero>span{font-size:9px;letter-spacing:.14em;font-weight:900;color:#9cff00}.verification-picker-hero h3{margin:5px 0;font-size:20px;color:var(--text)}.verification-picker-hero p{margin:0;color:var(--text-secondary);font-size:11px;line-height:1.5}.verification-picker-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.verification-mode-card{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:5px;min-height:128px;padding:13px;border:1px solid var(--surface-border);border-radius:11px;background:var(--surface);color:var(--text);text-align:left;cursor:pointer}.verification-mode-card.live:hover{border-color:rgba(156,255,0,.65);background:rgba(156,255,0,.08)}.verification-mode-card.soon{opacity:.62;cursor:not-allowed}.verification-mode-card strong{font-size:13px}.verification-mode-card small{color:var(--text-secondary);font-size:10px;line-height:1.45}.verification-mode-card em{margin-top:auto;color:#9cff00;font-size:9px;font-style:normal;font-weight:800}.verification-mode-state{font-size:8px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:#9cff00}.soon .verification-mode-state{color:#9aa2ad}.verification-mode-card.soon:after{content:"";position:absolute;inset:0;border-radius:11px;background:linear-gradient(135deg,transparent,rgba(255,255,255,.025));pointer-events:none}@media(max-width:600px){.verification-picker-grid{grid-template-columns:1fr}}`}</style></div>;
  }

  return (
    <div className="verification-dashboard">
      <section><h3>Identity</h3><label>Bot name<input value={config.name} disabled={disabled} onChange={(event) => patch({ name: event.target.value })} maxLength={40} /></label><div className="verification-avatar-options">{AVATARS.map((avatar) => <button type="button" key={avatar} className={config.avatarIcon === avatar ? "selected" : ""} disabled={disabled} onClick={() => patch({ avatarIcon: avatar })} title={avatar}>{avatar.slice(0, 1).toUpperCase()}</button>)}</div><div className="verification-color-options">{COLORS.map((color) => <button type="button" key={color} className={config.accentColor === color ? "selected" : ""} style={{ background: color }} disabled={disabled} onClick={() => patch({ accentColor: color })} aria-label={color} />)}</div></section>
      <section><h3>Verification modes</h3><div className="verification-mode-row"><button type="button" className={config.mode === "quick" ? "selected" : ""} onClick={() => patch({ mode: "quick" })}>Quick verify</button><button type="button" className={config.mode === "picture" ? "selected" : ""} onClick={() => patch({ mode: "picture" })}>Picture check</button></div><label className="verification-check"><input type="checkbox" checked={config.quickEnabled} disabled={disabled} onChange={(event) => patch({ quickEnabled: event.target.checked })} /> Quick verify enabled</label><label className="verification-check"><input type="checkbox" checked={config.pictureEnabled} disabled={disabled} onChange={(event) => patch({ pictureEnabled: event.target.checked })} /> Picture check enabled</label></section>
      <section><h3>Quick verify copy</h3><label>Title<input value={config.quick.idleTitle} disabled={disabled} onChange={(event) => patchSection("quick", { idleTitle: event.target.value })} /></label><label>Description<textarea value={config.quick.idleDescription} disabled={disabled} onChange={(event) => patchSection("quick", { idleDescription: event.target.value })} /></label><label>Button label<input value={config.quick.buttonLabel} disabled={disabled} onChange={(event) => patchSection("quick", { buttonLabel: event.target.value })} /></label></section>
      <section><h3>Picture check copy</h3><label>Title<input value={config.picture.idleTitle} disabled={disabled} onChange={(event) => patchSection("picture", { idleTitle: event.target.value })} /></label><label>Instruction<textarea value={config.picture.descriptionTemplate} disabled={disabled} onChange={(event) => patchSection("picture", { descriptionTemplate: event.target.value })} /></label></section>
      <section><h3>Info panels</h3>{Object.entries(config.panels).map(([key, panel]) => <label key={key}>{panel.label}<textarea value={panel.text} disabled={disabled} onChange={(event) => patchPanel(key, { text: event.target.value })} /></label>)}</section>
      <section><h3>Picture challenge</h3><p className="verification-help">Add at least two images, label them, then choose the correct answer.</p><div className="verification-challenge-grid">{slots.map((slot) => <div className={`verification-slot${config.challenge.correctId === slot.id ? " selected" : ""}`} key={slot.id}><label className="verification-image-slot">{slot.image ? <><img src={slot.image} alt="" /><button type="button" onClick={(event) => { event.preventDefault(); clearSlot(slot.id); }} aria-label="Remove image"><X size={12} /></button></> : <><Upload size={18} /><span>Add image</span></>}<input type="file" accept="image/*" disabled={disabled} onChange={(event) => handleFile(slot.id, event.target.files?.[0])} /></label><input value={slot.label} disabled={disabled} placeholder="Label" onChange={(event) => updateSlot(slot.id, { label: event.target.value })} /><button type="button" className="verification-correct" disabled={disabled || !slot.image || !slot.label.trim()} onClick={() => patch({ challenge: { ...config.challenge, correctId: slot.id } })}>{config.challenge.correctId === slot.id ? <Check size={13} /> : null} Correct answer</button></div>)}</div></section>
      {error && <p className="verification-dashboard-error">{error}</p>}<button type="button" className="verification-dashboard-save" disabled={disabled || saving} onClick={save}>{saving ? "Saving..." : "Save verification setup"}</button>
      <style>{`.verification-dashboard{display:flex;flex-direction:column;gap:12px}.verification-dashboard section{display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid var(--surface-border);border-radius:10px;background:rgba(0,0,0,.12)}.verification-dashboard h3{margin:0 0 2px;font-size:13px}.verification-dashboard label{display:flex;flex-direction:column;gap:5px;color:var(--text-secondary);font-size:11px}.verification-dashboard input,.verification-dashboard textarea{width:100%;padding:8px;border:1px solid var(--surface-border);border-radius:6px;background:var(--surface);color:var(--text);font:inherit}.verification-dashboard textarea{min-height:58px;resize:vertical}.verification-avatar-options,.verification-color-options,.verification-mode-row{display:flex;gap:6px;flex-wrap:wrap}.verification-avatar-options button,.verification-mode-row button{padding:7px 10px;border:1px solid var(--surface-border);border-radius:7px;background:var(--surface);color:var(--text-secondary);cursor:pointer}.verification-avatar-options button.selected,.verification-mode-row button.selected{border-color:var(--accent-border-strong);color:var(--accent);background:var(--accent-bg)}.verification-color-options button{width:25px;height:25px;border:2px solid transparent;border-radius:50%;cursor:pointer}.verification-color-options button.selected{border-color:#fff}.verification-check{display:flex!important;flex-direction:row!important;align-items:center;gap:7px}.verification-check input{width:auto}.verification-challenge-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.verification-slot{display:flex;flex-direction:column;gap:6px;padding:7px;border:1px solid var(--surface-border);border-radius:8px}.verification-slot.selected{border-color:var(--accent-border-strong)}.verification-image-slot{position:relative;aspect-ratio:1;align-items:center;justify-content:center;background:var(--surface);border:1px dashed var(--surface-border);cursor:pointer}.verification-image-slot img{width:100%;height:100%;object-fit:cover}.verification-image-slot input{display:none}.verification-image-slot button{position:absolute;right:4px;top:4px}.verification-correct{display:flex;align-items:center;gap:4px;border:0;background:transparent;color:var(--text-secondary);font-size:10px;cursor:pointer}.verification-dashboard-save{align-self:flex-end;padding:9px 14px;border:0;border-radius:7px;background:var(--accent);color:#071000;font-weight:800;cursor:pointer}.verification-dashboard-error{margin:0;color:var(--danger);font-size:11px}.verification-help{margin:0;color:var(--text-secondary);font-size:11px}@media(max-width:600px){.verification-challenge-grid{grid-template-columns:repeat(2,1fr)}}`}</style>
    </div>
  );
}
