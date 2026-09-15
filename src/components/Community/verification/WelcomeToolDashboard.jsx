import React, { useState } from "react";
import { Check, ExternalLink, LayoutTemplate, Sparkles, UserPlus } from "lucide-react";
import { getWelcomeTheme, WELCOME_CARD_THEMES } from "./WelcomeChannelCard";

const LAYOUTS = [
  { id: "hero", label: "Hero", description: "Large welcome moment with a clear next step." },
  { id: "split", label: "Split", description: "Balanced content and action panel." },
  { id: "compact", label: "Compact", description: "A focused card for busy channels." },
];

const TEMPLATES = [
  { id: "community", label: "Community lounge", eyebrow: "You found your people", title: "Find your people. Make something memorable.", description: "Introduce yourself, explore the channels, and join the conversation.", features: ["Introduce yourself", "Explore channels", "Meet the community"] },
  { id: "creator", label: "Creator hub", eyebrow: "The room is yours", title: "Welcome to the place where ideas become real.", description: "Catch the latest drops, share your work, and find your next collaboration.", features: ["Latest drops", "Creator channels", "Collaboration lounge"] },
  { id: "gaming", label: "Squad HQ", eyebrow: "Ready when you are", title: "Your next great session starts here.", description: "Pick a squad, check the rules, and jump into the action.", features: ["Find a squad", "Check events", "Start playing"] },
  { id: "brand", label: "Brand world", eyebrow: "An invitation inside", title: "Welcome to the inner circle.", description: "Get the signal first, meet the people shaping it, and stay close to what is next.", features: ["News and drops", "Member perks", "Official updates"] },
];

const DEFAULT_CONFIG = {
  template: "community",
  themeId: "lime-classic",
  layout: "hero",
  eyebrow: "You found your people",
  title: "Find your people. Make something memorable.",
  description: "Introduce yourself, explore the channels, and join the conversation.",
  features: ["Introduce yourself", "Explore channels", "Meet the community"],
  primaryLabel: "Introduce yourself",
  secondaryLabel: "Browse channels",
  showFeatures: true,
  showMemberCount: true,
};

export const normalizeWelcomeConfig = (value = {}) => ({
  ...DEFAULT_CONFIG,
  ...value,
  features: Array.isArray(value.features) && value.features.length ? value.features.slice(0, 4) : DEFAULT_CONFIG.features,
  themeId: getWelcomeTheme(value.themeId).id,
  layout: LAYOUTS.some((item) => item.id === value.layout) ? value.layout : DEFAULT_CONFIG.layout,
});

function Preview({ config, communityName = "your community" }) {
  const theme = getWelcomeTheme(config.themeId);
  const Icon = theme.icon;
  return (
    <div className={`welcome-builder-preview welcome-preview-${config.layout}`} style={{ "--welcome-accent": theme.accent, "--welcome-bg": theme.bg, "--welcome-border": theme.border }}>
      <div className="welcome-preview-glow" />
      <div className="welcome-preview-topline"><span><Icon size={14} /> {config.eyebrow}</span>{config.showMemberCount && <small><UserPlus size={12} /> Live member detail</small>}</div>
      <div className="welcome-preview-main"><div className="welcome-preview-copy"><strong>Welcome to {communityName}</strong><h3>{config.title}</h3><p>{config.description}</p>{config.showFeatures && <div className="welcome-preview-features">{config.features.map((feature) => <span key={feature}><Check size={12} />{feature}</span>)}</div>}</div><div className="welcome-preview-actions"><button type="button"><UserPlus size={14} />{config.primaryLabel}</button><button type="button" className="welcome-preview-secondary"><LayoutTemplate size={14} />{config.secondaryLabel}</button></div></div>
    </div>
  );
}

export default function WelcomeToolDashboard({ value, communityName, disabled = false, onSave }) {
  const [config, setConfig] = useState(() => normalizeWelcomeConfig(value));
  const update = (patch) => setConfig((current) => normalizeWelcomeConfig({ ...current, ...patch }));
  const applyTemplate = (template) => update({ ...template, template: template.id });
  const updateFeature = (index, text) => update({ features: config.features.map((feature, featureIndex) => featureIndex === index ? text : feature).filter(Boolean) });

  return (
    <div className="welcome-builder">
      <div className="welcome-builder-preview-wrap"><div className="welcome-builder-preview-label"><Sparkles size={13} /> Live member preview</div><Preview config={config} communityName={communityName} /></div>
      <div className="welcome-builder-block"><strong>Start with a direction</strong><div className="welcome-builder-template-grid">{TEMPLATES.map((template) => <button type="button" disabled={disabled} key={template.id} className={`welcome-builder-template${config.template === template.id ? " selected" : ""}`} onClick={() => applyTemplate(template)}><span>{config.template === template.id ? <Check size={14} /> : <Sparkles size={14} />}</span><b>{template.label}</b><small>{template.description}</small></button>)}</div></div>
      <div className="welcome-builder-block"><strong>Visual language</strong><div className="welcome-builder-row">{WELCOME_CARD_THEMES.map((theme) => <button type="button" disabled={disabled} key={theme.id} title={theme.label} aria-label={theme.label} className={`welcome-builder-swatch${config.themeId === theme.id ? " selected" : ""}`} style={{ background: theme.bg, borderColor: config.themeId === theme.id ? theme.accent : theme.border }} onClick={() => update({ themeId: theme.id })}><theme.icon size={15} color={theme.accent} /></button>)}</div><div className="welcome-builder-layouts">{LAYOUTS.map((layout) => <button type="button" disabled={disabled} key={layout.id} className={`welcome-builder-layout${config.layout === layout.id ? " selected" : ""}`} onClick={() => update({ layout: layout.id })}><b>{layout.label}</b><small>{layout.description}</small></button>)}</div></div>
      <div className="welcome-builder-block"><strong>Words members see</strong><label>Eyebrow<input disabled={disabled} value={config.eyebrow} maxLength={60} onChange={(event) => update({ eyebrow: event.target.value })} /></label><label>Headline<input disabled={disabled} value={config.title} maxLength={150} onChange={(event) => update({ title: event.target.value })} /></label><label>Description<textarea disabled={disabled} value={config.description} maxLength={500} rows={3} onChange={(event) => update({ description: event.target.value })} /></label><div className="welcome-builder-two-col"><label>Primary action<input disabled={disabled} value={config.primaryLabel} maxLength={32} onChange={(event) => update({ primaryLabel: event.target.value })} /></label><label>Secondary action<input disabled={disabled} value={config.secondaryLabel} maxLength={32} onChange={(event) => update({ secondaryLabel: event.target.value })} /></label></div></div>
      <div className="welcome-builder-block"><div className="welcome-builder-block-heading"><strong>Quick-glance features</strong><button type="button" disabled={disabled || config.features.length >= 4} onClick={() => update({ features: [...config.features, "New community perk"] })}>+ Add feature</button></div>{config.features.map((feature, index) => <input disabled={disabled} key={`${index}-${feature}`} value={feature} maxLength={36} onChange={(event) => updateFeature(index, event.target.value)} />)}<label className="welcome-builder-toggle"><input type="checkbox" disabled={disabled} checked={config.showFeatures} onChange={(event) => update({ showFeatures: event.target.checked })} /> Show feature chips</label><label className="welcome-builder-toggle"><input type="checkbox" disabled={disabled} checked={config.showMemberCount} onChange={(event) => update({ showMemberCount: event.target.checked })} /> Show member count</label></div>
      {onSave && <button type="button" className="welcome-builder-save" disabled={disabled} onClick={() => onSave(normalizeWelcomeConfig(config))}><ExternalLink size={15} /> Save welcome experience</button>}
      <style>{`.welcome-builder{display:flex;flex-direction:column;gap:14px;color:var(--text)}.welcome-builder-preview-wrap{display:flex;flex-direction:column;gap:7px}.welcome-builder-preview-label{display:flex;align-items:center;gap:6px;color:var(--accent);font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em}.welcome-builder-preview{position:relative;overflow:hidden;min-height:205px;padding:20px;border:1px solid var(--welcome-border);border-radius:18px;background:var(--welcome-bg);box-shadow:0 18px 46px rgba(0,0,0,.28)}.welcome-preview-glow{position:absolute;right:-50px;top:-65px;width:180px;height:180px;border-radius:50%;background:var(--welcome-accent);opacity:.12;filter:blur(3px)}.welcome-preview-topline,.welcome-preview-main,.welcome-preview-features,.welcome-preview-actions{display:flex;align-items:center}.welcome-preview-topline{position:relative;justify-content:space-between;color:var(--welcome-accent);font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.welcome-preview-topline span,.welcome-preview-topline small{display:flex;align-items:center;gap:5px}.welcome-preview-topline small{color:#a6b5aa;font-size:10px;font-weight:600;text-transform:none;letter-spacing:0}.welcome-preview-main{position:relative;justify-content:space-between;gap:18px;margin-top:22px}.welcome-preview-copy{max-width:500px}.welcome-preview-copy>strong{color:var(--welcome-accent);font-size:10px}.welcome-preview-copy h3{margin:6px 0;color:#f5faf3;font-size:22px;line-height:1.08}.welcome-preview-copy p{margin:0;color:#a6b5aa;font-size:12px;line-height:1.5}.welcome-preview-features{flex-wrap:wrap;gap:6px;margin-top:14px}.welcome-preview-features span{display:flex;align-items:center;gap:4px;padding:5px 7px;border:1px solid color-mix(in srgb,var(--welcome-accent) 30%,transparent);border-radius:999px;color:#d6e3d3;font-size:10px}.welcome-preview-features svg{color:var(--welcome-accent)}.welcome-preview-actions{flex-direction:column;gap:7px;min-width:145px}.welcome-preview-actions button{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;padding:9px 10px;border:1px solid var(--welcome-accent);border-radius:8px;background:var(--welcome-accent);color:#091007;font:700 10px inherit}.welcome-preview-actions .welcome-preview-secondary{border-color:rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:#d6e3d3}.welcome-preview-split .welcome-preview-main{align-items:stretch}.welcome-preview-split .welcome-preview-actions{padding:12px;border:1px solid rgba(255,255,255,.12);border-radius:12px;background:rgba(0,0,0,.16)}.welcome-preview-compact{min-height:150px;padding:15px}.welcome-preview-compact .welcome-preview-main{margin-top:14px}.welcome-preview-compact .welcome-preview-copy h3{font-size:17px}.welcome-preview-compact .welcome-preview-features{margin-top:9px}.welcome-preview-compact .welcome-preview-actions{min-width:118px}.welcome-builder-block{display:flex;flex-direction:column;gap:8px;padding:13px;border:1px solid var(--surface-border);border-radius:11px;background:rgba(0,0,0,.12)}.welcome-builder-block>strong{font-size:12px}.welcome-builder-template-grid,.welcome-builder-layouts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.welcome-builder-template,.welcome-builder-layout{display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:10px;border:1px solid var(--surface-border);border-radius:9px;background:var(--surface);color:var(--text);text-align:left;cursor:pointer}.welcome-builder-template.selected,.welcome-builder-layout.selected{border-color:var(--accent-border-strong);background:var(--accent-bg)}.welcome-builder-template span{height:15px;color:var(--accent)}.welcome-builder-template b,.welcome-builder-layout b{font-size:11px}.welcome-builder-template small,.welcome-builder-layout small{color:var(--text-secondary);font-size:10px;line-height:1.35}.welcome-builder-row{display:flex;gap:7px;flex-wrap:wrap}.welcome-builder-swatch{display:grid;place-items:center;width:38px;height:38px;border:2px solid;border-radius:10px;cursor:pointer}.welcome-builder-swatch.selected{box-shadow:0 0 0 2px var(--surface),0 0 0 4px var(--accent)}.welcome-builder label{display:flex;flex-direction:column;gap:5px;color:var(--text-secondary);font-size:10px}.welcome-builder input:not([type="checkbox"]),.welcome-builder textarea{width:100%;box-sizing:border-box;padding:9px;border:1px solid var(--surface-border);border-radius:7px;background:var(--surface);color:var(--text);font:inherit;font-size:12px;resize:vertical}.welcome-builder-two-col{display:grid;grid-template-columns:1fr 1fr;gap:8px}.welcome-builder-block-heading{display:flex;justify-content:space-between;align-items:center}.welcome-builder-block-heading button{border:0;background:transparent;color:var(--accent);font:700 10px inherit;cursor:pointer}.welcome-builder-toggle{flex-direction:row!important;align-items:center;gap:7px!important}.welcome-builder-toggle input{accent-color:var(--accent)}.welcome-builder-save{display:flex;align-items:center;justify-content:center;gap:7px;padding:11px;border:1px solid var(--accent-border-strong);border-radius:9px;background:var(--accent);color:#071000;font:800 12px inherit;cursor:pointer}.welcome-builder button:disabled,.welcome-builder input:disabled,.welcome-builder textarea:disabled{cursor:not-allowed;opacity:.6}@media(max-width:600px){.welcome-preview-main{flex-direction:column;align-items:stretch}.welcome-preview-actions{width:100%;min-width:0}.welcome-builder-template-grid,.welcome-builder-layouts,.welcome-builder-two-col{grid-template-columns:1fr}.welcome-builder-preview{padding:15px}}`}</style>
    </div>
  );
}
