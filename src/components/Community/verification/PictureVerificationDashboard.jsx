import React, { useState } from "react";
import { Check, Upload, X } from "lucide-react";
import { challengeIsReady, normalizeVerificationConfig } from "./verificationConfig";
import CreateVerificationRoleControl from "./CreateVerificationRoleControl";
import VerificationRoleSelector from "./VerificationRoleSelector";

const resizeImage = (file) => new Promise((resolve, reject) => {
  if (!file.type.startsWith("image/")) {
    reject(new Error("Choose an image file."));
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    reject(new Error("Choose an image smaller than 8 MB."));
    return;
  }
  const reader = new FileReader();
  reader.onerror = () => reject(new Error("Could not read that image."));
  reader.onload = () => {
    const image = new Image();
    image.onerror = () => reject(new Error("Could not process that image."));
    image.onload = () => {
      const scale = Math.min(1, 512 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      if (!context) return reject(new Error("Image processing is unavailable in this browser."));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
});

export default function PictureVerificationDashboard({ value = {}, roles = [], onCreateRole, onPromoteRole, onManageRole, onDeleteRole, canManageRoles = false, onSave, onConfigChange, disabled = false }) {
  const [config, setConfig] = useState(() => normalizeVerificationConfig(value));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const method = config.methods.picture;
  const cards = Array.from({ length: 6 }, (_, index) => method.cards[index] || {
    id: `slot-${index + 1}`,
    label: "",
    image: null,
  });

  const updateConfig = (next) => {
    const nextConfig = { ...config, ...next };
    setConfig(nextConfig);
    onConfigChange?.(nextConfig);
  };
  const updateCard = (index, next) => {
    const nextCards = cards.map((card, cardIndex) => cardIndex === index ? { ...card, ...next } : card);
    const nextConfig = {
      ...config,
      challenge: { ...config.challenge, cards: nextCards },
      methods: {
        ...config.methods,
        picture: { ...config.methods.picture, cards: nextCards },
      },
    };
    setConfig(nextConfig);
    onConfigChange?.(nextConfig);
  };
  const handleFile = async (index, file) => {
    if (!file) return;
    setError("");
    try {
      updateCard(index, { image: await resizeImage(file) });
    } catch (imageError) {
      setError(imageError.message || "Could not process that image.");
    }
  };

  const filledCards = cards
    .filter((card) => card.image && String(card.label || "").trim())
    .map((card) => ({ id: card.id, label: card.label.trim(), image: card.image }));
  const correctId = method.correctId || config.challenge.correctId;
  const ready = challengeIsReady({
    ...config,
    methods: { ...config.methods, picture: { ...method, cards: filledCards, correctId } },
    challenge: { ...config.challenge, cards: filledCards, correctId },
  });

  const save = async () => {
    if (method.enabled && !ready) {
      setError("Add at least two labeled images and choose the correct answer before activating Picture Check.");
      return;
    }
    setSaving(true);
    setError("");
    const nextConfig = {
      ...config,
      pictureEnabled: Boolean(method.enabled),
      challenge: { cards: filledCards, correctId },
      methods: {
        ...config.methods,
        picture: { ...method, cards: filledCards, correctId },
      },
    };
    try {
      await onSave(nextConfig);
    } catch (saveError) {
      setError(saveError.message || "Could not save picture verification.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="picture-verification-dashboard">
      <section>
        <h3>Picture Check</h3>
        <p>Members identify the correct image. This method is available only after a complete challenge and access role are configured.</p>
        <div className="picture-role-select" role="group" aria-label="Role granted after this check">
          <span>Role granted after this check</span>
          <VerificationRoleSelector
            roles={roles}
            selectedRoleId={method.roleId}
            onSelect={(roleId) => updateConfig({ methods: { ...config.methods, picture: { ...method, roleId } } })}
            onPromoteRole={onPromoteRole}
            onManageRole={onManageRole}
            onDeleteRole={onDeleteRole}
            canManageRoles={canManageRoles}
            disabled={disabled || Boolean(config.roleGrant?.enabled)}
          />
        </div>
        {config.roleGrant?.enabled && <p>Access roles are configured below as member-selectable choices.</p>}
        {!config.roleGrant?.enabled && <CreateVerificationRoleControl disabled={disabled} onCreateRole={onCreateRole} onCreated={(role) => updateConfig({ methods: { ...config.methods, picture: { ...method, roleId: role.id } } })} />}
        <label className="picture-check">
          <input
            type="checkbox"
            checked={Boolean(method.enabled)}
            disabled={disabled}
            onChange={(event) => updateConfig({
              methods: {
                ...config.methods,
                picture: { ...method, enabled: event.target.checked },
              },
            })}
          />
          Activate Picture Check
        </label>
        <label>
          Title
          <input value={method.title || ""} disabled={disabled} onChange={(event) => updateConfig({
            methods: { ...config.methods, picture: { ...method, title: event.target.value } },
          })} />
        </label>
        <label>
          Instruction
          <textarea value={method.instruction || ""} disabled={disabled} onChange={(event) => updateConfig({
            methods: { ...config.methods, picture: { ...method, instruction: event.target.value } },
          })} />
        </label>
      </section>
      <section>
        <h3>Challenge cards</h3>
        <p>Add at least two images, label them, then choose the correct answer.</p>
        <div className="picture-card-grid">
          {cards.map((card, index) => (
            <div className={`picture-card-slot${correctId === card.id ? " selected" : ""}`} key={card.id}>
              <label className="picture-upload">
                {card.image
                  ? <img src={card.image} alt={card.label || "Challenge card"} />
                  : <><Upload size={17} /><span>Add image</span></>}
                <input type="file" accept="image/*" disabled={disabled} onChange={(event) => handleFile(index, event.target.files?.[0])} />
                {card.image && (
                  <button type="button" disabled={disabled} onClick={(event) => {
                    event.preventDefault();
                    updateCard(index, { image: null, label: "" });
                  }} aria-label="Remove image"><X size={12} /></button>
                )}
              </label>
              <input value={card.label || ""} disabled={disabled} placeholder="Label" onChange={(event) => updateCard(index, { label: event.target.value })} />
              <button
                type="button"
                disabled={disabled || !card.image || !String(card.label || "").trim()}
                onClick={() => updateConfig({
                  challenge: { ...config.challenge, correctId: card.id },
                  methods: {
                    ...config.methods,
                    picture: { ...method, correctId: card.id },
                  },
                })}
              >
                {correctId === card.id ? <Check size={12} /> : null} Correct answer
              </button>
            </div>
          ))}
        </div>
      </section>
      {error && <p className="picture-error" role="alert">{error}</p>}
      <button type="button" className="picture-save" disabled={disabled || saving} onClick={save}>
        {saving ? "Saving..." : "Save Picture Check"}
      </button>
      <style>{`.picture-verification-dashboard{display:flex;flex-direction:column;gap:12px}.picture-verification-dashboard section{display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid var(--surface-border);border-radius:10px;background:rgba(0,0,0,.12)}.picture-verification-dashboard h3{margin:0;font-size:13px;color:var(--text)}.picture-verification-dashboard p{margin:0;color:var(--text-secondary);font-size:10px;line-height:1.45}.picture-verification-dashboard label{display:flex;flex-direction:column;gap:5px;color:var(--text-secondary);font-size:11px}.picture-verification-dashboard input,.picture-verification-dashboard textarea{width:100%;padding:8px;border:1px solid var(--surface-border);border-radius:7px;background:var(--surface);color:var(--text);font:inherit}.picture-verification-dashboard textarea{min-height:56px}.picture-role-select{display:grid;gap:5px}.picture-role-select>span{color:var(--text-secondary);font-size:11px}.picture-check{display:flex!important;flex-direction:row!important;align-items:center;gap:7px}.picture-check input{width:auto}.picture-card-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.picture-card-slot{display:flex;flex-direction:column;gap:5px;padding:6px;border:1px solid var(--surface-border);border-radius:8px}.picture-card-slot.selected{border-color:var(--accent-border-strong);background:var(--accent-bg)}.picture-upload{position:relative;aspect-ratio:1;align-items:center;justify-content:center;background:var(--surface);border:1px dashed var(--surface-border);cursor:pointer}.picture-upload img{width:100%;height:100%;object-fit:cover}.picture-upload button{position:absolute;top:4px;right:4px;width:22px;height:22px;border:0;border-radius:5px;background:rgba(0,0,0,.7);color:#fff}.picture-upload input{display:none}.picture-card-slot>button{display:flex;align-items:center;justify-content:center;gap:4px;padding:6px;border:1px solid var(--surface-border);border-radius:6px;background:var(--surface);color:var(--text-secondary);font:10px inherit;cursor:pointer}.picture-card-slot>button:disabled{opacity:.45;cursor:not-allowed}.picture-error{color:var(--danger)!important}.picture-save{padding:9px;border:0;border-radius:8px;background:var(--accent);color:#111;font:800 11px inherit;cursor:pointer}.picture-save:disabled{opacity:.5}@media(max-width:520px){.picture-card-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}`}</style>
    </div>
  );
}
