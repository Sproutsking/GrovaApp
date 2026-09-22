import React, { useState } from "react";
import { Check, Upload, X } from "lucide-react";
import { challengeIsReady, normalizeVerificationConfig } from "./verificationConfig";

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

export default function PictureVerificationDashboard({ value = {}, onSave, disabled = false }) {
  const initial = normalizeVerificationConfig(value);
  const [config, setConfig] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const cards = Array.from({ length: 6 }, (_, index) => config.challenge.cards[index] || { id: `slot-${index + 1}`, label: "", image: null });
  const patch = (next) => setConfig((current) => ({ ...current, ...next }));
  const updateCard = (index, next) => patch({ challenge: { ...config.challenge, cards: cards.map((card, cardIndex) => cardIndex === index ? { ...card, ...next } : card) } });
  const removeCard = (index) => updateCard(index, { image: null, label: "" });
  const handleFile = async (index, file) => {
    if (!file) return;
    try { updateCard(index, { image: await resizeImage(file) }); }
    catch { setError("Could not process that image."); }
  };
  const filledCards = cards.filter((card) => card.image && card.label.trim()).map((card) => ({ id: card.id, label: card.label.trim(), image: card.image }));
  const ready = challengeIsReady({ ...config, challenge: { ...config.challenge, cards: filledCards } });
  const save = async () => {
    if (!ready) return setError("Add at least two labeled images and choose a correct answer.");
    setSaving(true); setError("");
    try { await onSave({ ...config, pictureEnabled: true, challenge: { cards: filledCards, correctId: config.challenge.correctId } }); }
    catch (saveError) { setError(saveError.message || "Could not save picture verification."); }
    finally { setSaving(false); }
  };

  return <div className="picture-verification-dashboard">
    <section><h3>Picture Check</h3><label className="picture-check"><input type="checkbox" checked={config.pictureEnabled} disabled={disabled} onChange={(event) => patch({ pictureEnabled: event.target.checked })} /> Activate Picture Check</label><label>Title<input value={config.picture.idleTitle} disabled={disabled} onChange={(event) => patch({ picture: { ...config.picture, idleTitle: event.target.value } })} /></label><label>Instruction<textarea value={config.picture.descriptionTemplate} disabled={disabled} onChange={(event) => patch({ picture: { ...config.picture, descriptionTemplate: event.target.value } })} /></label></section>
    <section><h3>Challenge cards</h3><p>Add at least two images, label them, then choose the correct answer.</p><div className="picture-card-grid">{cards.map((card, index) => <div className={`picture-card-slot${config.challenge.correctId === card.id ? " selected" : ""}`} key={card.id}><label className="picture-upload">{card.image ? <><img src={card.image} alt="" /><button type="button" onClick={(event) => { event.preventDefault(); removeCard(index); }} aria-label="Remove image"><X size={12} /></button></> : <><Upload size={17} /><span>Add image</span></>}<input type="file" accept="image/*" disabled={disabled} onChange={(event) => handleFile(index, event.target.files?.[0])} /></label><input value={card.label} disabled={disabled} placeholder="Label" onChange={(event) => updateCard(index, { label: event.target.value })} /><button type="button" disabled={disabled || !card.image || !card.label.trim()} onClick={() => patch({ challenge: { ...config.challenge, correctId: card.id } })}>{config.challenge.correctId === card.id ? <Check size={12} /> : null} Correct answer</button></div>)}</div></section>
    {error && <p className="picture-error">{error}</p>}<button type="button" className="picture-save" disabled={disabled || saving} onClick={save}>{saving ? "Saving..." : "Save Picture Check"}</button>
    <style>{`.picture-verification-dashboard{display:flex;flex-direction:column;gap:12px}.picture-verification-dashboard section{display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid var(--surface-border);border-radius:10px;background:rgba(0,0,0,.12)}.picture-verification-dashboard h3{margin:0;font-size:13px}.picture-verification-dashboard p{margin:0;color:var(--text-secondary);font-size:10px}.picture-verification-dashboard label{display:flex;flex-direction:column;gap:5px;color:var(--text-secondary);font-size:11px}.picture-verification-dashboard input,.picture-verification-dashboard textarea{width:100%;padding:8px;border:1px solid var(--surface-border);border-radius:7px;background:var(--surface);color:var(--text);font:inherit}.picture-verification-dashboard textarea{min-height:56px}.picture-check{display:flex!important;flex-direction:row!important;align-items:center;gap:7px}.picture-check input{width:auto}.picture-card-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.picture-card-slot{display:flex;flex-direction:column;gap:5px;padding:6px;border:1px solid var(--surface-border);border-radius:8px}.picture-card-slot.selected{border-color:var(--accent-border-strong);background:var(--accent-bg)}.picture-upload{position:relative;aspect-ratio:1;align-items:center;justify-content:center;background:var(--surface);border:1px dashed var(--surface-border);cursor:pointer}.picture-upload img{width:100%;height:100%;object-fit:cover}.picture-upload button{position:absolute;top:4px;right:4px;width:22px;height:22px;border:0;border-radius:5px;background:rgba(0,0,0,.7);color:#fff}.picture-upload input{display:none}.picture-card-slot>button{display:flex;align-items:center;justify-content:center;gap:4px;padding:6px;border:1px solid var(--surface-border);border-radius:6px;background:var(--surface);color:var(--text-secondary);font:10px inherit;cursor:pointer}.picture-card-slot>button:disabled{opacity:.45;cursor:not-allowed}.picture-error{color:var(--danger)!important}.picture-save{padding:9px;border:0;border-radius:8px;background:var(--accent);color:#111;font:800 11px inherit;cursor:pointer}.picture-save:disabled{opacity:.5}@media(max-width:520px){.picture-card-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}`}</style>
  </div>;
}
