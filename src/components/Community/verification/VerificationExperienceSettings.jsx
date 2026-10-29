import React from "react";
import { normalizeVerificationConfig } from "./verificationConfig";

const THEMES = [
  { id: "midnight", name: "Midnight Lime", detail: "Deep black with a precise signature-lime glow." },
  { id: "aurora", name: "Emerald Aurora", detail: "Layered forest tones with a soft green aurora." },
  { id: "obsidian", name: "Obsidian", detail: "Pure black, clean edges, and restrained lime accents." },
];

export default function VerificationExperienceSettings({ value, onChange, disabled = false }) {
  const config = normalizeVerificationConfig(value);
  const patch = (updates) => onChange?.({ ...config, ...updates });

  return (
    <section className="verification-experience-settings" aria-label="Verification panel design and success message">
      <div>
        <h3>Member experience</h3>
        <p>Choose the verification panel look and the congratulations message members see after their role is granted.</p>
      </div>
      <div className="verification-experience-themes" role="radiogroup" aria-label="Verification panel theme">
        {THEMES.map((theme) => (
          <button
            type="button"
            key={theme.id}
            role="radio"
            aria-checked={config.panel.theme === theme.id}
            className={`verification-experience-theme theme-${theme.id}${config.panel.theme === theme.id ? " selected" : ""}`}
            disabled={disabled}
            onClick={() => patch({ panel: { ...config.panel, theme: theme.id } })}
          >
            <span className="verification-theme-sample"><i /><i /><i /></span>
            <strong>{theme.name}</strong>
            <small>{theme.detail}</small>
          </button>
        ))}
      </div>
      <label>
        Congratulations heading
        <input
          maxLength={80}
          value={config.completion.title}
          disabled={disabled}
          onChange={(event) => patch({ completion: { ...config.completion, title: event.target.value } })}
        />
      </label>
      <label>
        Congratulations message
        <textarea
          maxLength={280}
          rows={3}
          value={config.completion.message}
          disabled={disabled}
          onChange={(event) => patch({ completion: { ...config.completion, message: event.target.value } })}
        />
        <small>Shown once verification succeeds and the selected role has been assigned.</small>
      </label>
      <style>{`.verification-experience-settings{display:grid;gap:10px;padding:13px;border:1px solid var(--surface-border);border-radius:11px;background:var(--surface)}.verification-experience-settings h3{margin:0;color:var(--text);font-size:calc((13px) + 1px)}.verification-experience-settings>div:first-child p{margin:4px 0 0;color:var(--text-secondary);font-size:calc((10px) + 1px);line-height:1.5}.verification-experience-themes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.verification-experience-theme{display:flex;min-width:0;flex-direction:column;align-items:flex-start;gap:5px;padding:8px;border:1px solid var(--surface-border);border-radius:9px;background:var(--panel-strong);color:var(--text);text-align:left;cursor:pointer}.verification-experience-theme.selected{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent-border)}.verification-experience-theme strong{font-size:calc((9px) + 1px)}.verification-experience-theme small{color:var(--text-secondary);font-size:calc((8px) + 1px);line-height:1.35}.verification-theme-sample{display:flex;width:100%;height:31px;align-items:flex-end;gap:3px;padding:5px;border-radius:6px;background:#050505}.verification-theme-sample i{width:22%;height:11px;border-radius:3px;background:rgba(132,204,22,.25)}.verification-theme-sample i:first-child{height:19px;background:#101010;border:1px solid rgba(132,204,22,.55)}.theme-aurora .verification-theme-sample{background:radial-gradient(ellipse at 20% 0%,rgba(34,197,94,.38),transparent 65%),#030604}.theme-obsidian .verification-theme-sample{background:#000;border:1px solid rgba(132,204,22,.3)}.verification-experience-settings label{display:grid;gap:5px;color:var(--text-secondary);font-size:calc((10px) + 1px)}.verification-experience-settings input,.verification-experience-settings textarea{width:100%;box-sizing:border-box;padding:8px;border:1px solid var(--surface-border);border-radius:7px;background:var(--surface-strong);color:var(--text);font:inherit}.verification-experience-settings textarea{resize:vertical}.verification-experience-settings label small{color:var(--text-muted);font-size:calc((9px) + 1px)}@media(max-width:520px){.verification-experience-themes{grid-template-columns:1fr}.verification-experience-theme{display:grid;grid-template-columns:66px 1fr;align-items:center}.verification-experience-theme small{grid-column:2}.verification-theme-sample{grid-row:1/3}}`}</style>
    </section>
  );
}
