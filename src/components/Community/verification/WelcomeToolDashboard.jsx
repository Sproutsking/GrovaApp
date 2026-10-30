import React, { useEffect, useState } from "react";
import { Check, ExternalLink, LayoutTemplate, Sparkles, UserPlus } from "lucide-react";
import { getWelcomeDesign, getWelcomeTheme, WELCOME_CARD_DESIGNS, WELCOME_CARD_THEMES, WelcomeCardFrame } from "./WelcomeChannelCard";

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
  designId: "banner-hero",
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
  introChannelId: "",
  showPrimaryAction: true,
  showSecondaryAction: true,
};

export const normalizeWelcomeConfig = (value = {}) => ({
  ...DEFAULT_CONFIG,
  ...value,
  features: Array.isArray(value.features) && value.features.length ? value.features.slice(0, 4).map((feature) => String(feature || "")) : DEFAULT_CONFIG.features,
  themeId: getWelcomeTheme(value.themeId).id,
  designId: getWelcomeDesign(value.designId || value.craft).id,
  layout: LAYOUTS.some((item) => item.id === value.layout) ? value.layout : DEFAULT_CONFIG.layout,
});

function Preview({ config, communityName = "your community" }) {
  const theme = getWelcomeTheme(config.themeId);
  const design = getWelcomeDesign(config.designId);
  return (
    <WelcomeCardFrame
      theme={theme}
      design={design}
      density={config.layout === "compact" ? "compact" : "regular"}
      eyebrow={config.eyebrow}
      kicker={`Welcome to ${communityName}`}
      heading={config.title}
      description={config.description}
      layout={config.layout}
      avatar={<span className="welcome-preview-avatar"><Sparkles size={20} /></span>}
      meta={config.showFeatures && <>{config.features.map((feature, index) => feature.trim() && <span key={`${feature}-${index}`}><Sparkles size={11} />{feature}</span>)}</>}
      topRight={config.showMemberCount ? <small><UserPlus size={12} /> New member</small> : null}
      actions={(config.showPrimaryAction || config.showSecondaryAction) && <>{config.showPrimaryAction && <button type="button"><UserPlus size={14} />{config.primaryLabel}</button>}{config.showSecondaryAction && <button type="button"><LayoutTemplate size={14} />{config.secondaryLabel}</button>}</>}
    />
  );
}

export default function WelcomeToolDashboard({ value, communityName, channels = [], disabled = false, onSave }) {
  const [config, setConfig] = useState(() => normalizeWelcomeConfig(value));
  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState(null);
  const theme = getWelcomeTheme(config.themeId);
  useEffect(() => setConfig(normalizeWelcomeConfig(value)), [value]);
  const update = (patch) => {
    setSaveFeedback(null);
    setConfig((current) => normalizeWelcomeConfig({ ...current, ...patch }));
  };
  const applyTemplate = (template) => update({ ...template, template: template.id });
  const updateFeature = (index, text) => update({ features: config.features.map((feature, featureIndex) => featureIndex === index ? text : feature) });
  const save = async () => {
    if (!onSave || disabled || saving) return;
    setSaving(true);
    setSaveFeedback(null);
    try {
      await onSave(normalizeWelcomeConfig(config));
      setSaveFeedback({ type: "success", text: "Welcome experience saved." });
    } catch (error) {
      setSaveFeedback({ type: "error", text: error?.message || "Could not save the welcome experience." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="welcome-builder">
      <div className="welcome-builder-preview-wrap"><div className="welcome-builder-preview-label"><Sparkles size={13} /> Live member preview</div><Preview config={config} communityName={communityName} /></div>
      <div className="welcome-builder-block"><strong>Start with a direction</strong><div className="welcome-builder-template-grid">{TEMPLATES.map((template) => <button type="button" disabled={disabled} key={template.id} className={`welcome-builder-template${config.template === template.id ? " selected" : ""}`} onClick={() => applyTemplate(template)}><span>{config.template === template.id ? <Check size={14} /> : <Sparkles size={14} />}</span><b>{template.label}</b><small>{template.description}</small></button>)}</div></div>
      <div className="welcome-builder-block"><div className="welcome-builder-section-heading"><strong>Card design</strong><small>Choose the structure first. Color is controlled separately below.</small></div><div className="welcome-builder-design-grid">{WELCOME_CARD_DESIGNS.map((design) => <button type="button" disabled={disabled} key={design.id} className={`welcome-builder-design${config.designId === design.id ? " selected" : ""}`} onClick={() => update({ designId: design.id })}><span className="welcome-builder-design-preview"><WelcomeCardFrame theme={theme} design={design} density="compact" eyebrow={design.label} kicker="Welcome to your community" heading="A place to belong" description="A polished welcome for every new member." /></span><span className="welcome-builder-design-name"><b>{design.label}</b>{config.designId === design.id && <Check size={14} />}</span><small>{design.description}</small></button>)}</div><div className="welcome-builder-subsection-label">Density</div><div className="welcome-builder-layouts">{LAYOUTS.map((layout) => <button type="button" disabled={disabled} key={layout.id} className={`welcome-builder-layout${config.layout === layout.id ? " selected" : ""}`} onClick={() => update({ layout: layout.id })}><b>{layout.label}</b><small>{layout.description}</small></button>)}</div></div>
      <div className="welcome-builder-block"><div className="welcome-builder-section-heading"><strong>Color direction</strong><small>Keep the welcome experience rooted in the lime, gold, and black brand language.</small></div><div className="welcome-builder-theme-grid">{WELCOME_CARD_THEMES.map((themeOption) => <button type="button" disabled={disabled} key={themeOption.id} className={`welcome-builder-theme${config.themeId === themeOption.id ? " selected" : ""}`} onClick={() => update({ themeId: themeOption.id })}><span className="welcome-builder-theme-swatch" style={{ background: themeOption.bg, borderColor: themeOption.accent }}><themeOption.icon size={14} color={themeOption.accent} /></span><span><b>{themeOption.label}</b><small>{themeOption.group}</small></span>{config.themeId === themeOption.id && <Check size={14} />}</button>)}</div></div>
      <div className="welcome-builder-block"><strong>Community highlights</strong><small className="welcome-builder-help">Give new members a few clear things to do or discover.</small>{config.features.map((feature, index) => <label key={`feature-${index}`}>Highlight {index + 1}<input disabled={disabled} value={feature} maxLength={48} onChange={(event) => updateFeature(index, event.target.value)} /></label>)}{config.features.length < 4 && <button type="button" className="welcome-builder-add-feature" disabled={disabled} onClick={() => update({ features: [...config.features, "A new community highlight"] })}>+ Add highlight</button>}</div>
      <div className="welcome-builder-block"><strong>Words members see</strong><label>Eyebrow<input disabled={disabled} value={config.eyebrow} maxLength={60} onChange={(event) => update({ eyebrow: event.target.value })} /></label><label>Headline<input disabled={disabled} value={config.title} maxLength={150} onChange={(event) => update({ title: event.target.value })} /></label><label>Description<textarea disabled={disabled} value={config.description} maxLength={500} rows={3} onChange={(event) => update({ description: event.target.value })} /></label><div className="welcome-builder-two-col"><label>Primary action<input disabled={disabled} value={config.primaryLabel} maxLength={32} onChange={(event) => update({ primaryLabel: event.target.value })} /></label><label>Secondary action<input disabled={disabled} value={config.secondaryLabel} maxLength={32} onChange={(event) => update({ secondaryLabel: event.target.value })} /></label></div><label>Introduce yourself opens<select disabled={disabled} value={config.introChannelId} onChange={(event) => update({ introChannelId: event.target.value })}><option value="">Select a channel</option>{channels.filter((channel) => channel.type !== "voice").map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}</select></label><small className="welcome-builder-help">Select or create a channel before activating this welcome experience.</small><label className="welcome-builder-toggle"><input type="checkbox" disabled={disabled} checked={config.showMemberCount} onChange={(event) => update({ showMemberCount: event.target.checked })} /> Show new-member badge</label><label className="welcome-builder-toggle"><input type="checkbox" disabled={disabled} checked={config.showFeatures} onChange={(event) => update({ showFeatures: event.target.checked })} /> Show community highlights</label><label className="welcome-builder-toggle"><input type="checkbox" disabled={disabled} checked={config.showPrimaryAction} onChange={(event) => update({ showPrimaryAction: event.target.checked })} /> Show Introduce yourself</label><label className="welcome-builder-toggle"><input type="checkbox" disabled={disabled} checked={config.showSecondaryAction} onChange={(event) => update({ showSecondaryAction: event.target.checked })} /> Show Browse channels</label></div>
      {saveFeedback && <p className={`welcome-builder-feedback ${saveFeedback.type}`} role={saveFeedback.type === "error" ? "alert" : "status"}>{saveFeedback.text}</p>}
      {onSave && <button type="button" className="welcome-builder-save" disabled={disabled || saving} onClick={save}>{saving ? <><Sparkles size={15} className="welcome-builder-saving-icon" /> Saving…</> : <><ExternalLink size={15} /> Save welcome experience</>}</button>}
      <style>{`.welcome-builder{min-width:0}.welcome-builder-section-heading{display:flex;flex-direction:column;gap:4px}.welcome-builder-section-heading small{color:var(--text-secondary);font-size:calc((10px) + 1px);line-height:1.4}.welcome-builder-design-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.welcome-builder-design{min-width:0;padding:7px;border:1px solid var(--surface-border);border-radius:11px;background:var(--surface);color:var(--text);text-align:left;cursor:pointer}.welcome-builder-design:hover{border-color:var(--accent-border)}.welcome-builder-design.selected{border-color:var(--accent-border-strong);background:var(--accent-bg);box-shadow:0 0 0 1px var(--accent-border)}.welcome-builder-design-preview{display:block;overflow:hidden;height:112px;border-radius:8px;pointer-events:none}.welcome-builder-design-preview .wc-frame{width:100%;height:100%;min-height:0;margin:0;border-radius:8px;box-shadow:none}.welcome-builder-design-preview .wc-topline{padding:8px 9px 0;font-size:calc((6px) + 1px)}.welcome-builder-design-preview .wc-eyebrow-badge{width:12px;height:12px;border-radius:4px}.welcome-builder-design-preview .wc-eyebrow-badge svg{width:7px;height:7px}.welcome-builder-design-preview .wc-card-content{padding:7px 9px}.welcome-builder-design-preview .wc-card-content em{font-size:calc((7px) + 1px)}.welcome-builder-design-preview .wc-frame-heading{margin:3px 0;font-size:calc((12px) + 1px)}.welcome-builder-design-preview .wc-frame p{margin-top:3px;font-size:calc((7px) + 1px);line-height:1.3}.welcome-builder-design-preview .wc-meta-row,.welcome-builder-design-preview .wc-actions,.welcome-builder-design-preview .wc-footer{display:none}.welcome-builder-design-name{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:7px;font-size:calc((10px) + 1px)}.welcome-builder-design-name svg{color:var(--accent)}.welcome-builder-design>small{display:block;margin-top:3px;color:var(--text-secondary);font-size:calc((9px) + 1px)}.welcome-builder-subsection-label{padding-top:4px;color:var(--text-secondary);font-size:calc((9px) + 1px);font-weight:800;letter-spacing:.08em;text-transform:uppercase}.welcome-builder select{appearance:none;padding-right:34px;background-image:linear-gradient(45deg,transparent 50%,var(--text-secondary) 50%),linear-gradient(135deg,var(--text-secondary) 50%,transparent 50%);background-position:calc(100% - 15px) 50%,calc(100% - 10px) 50%;background-size:5px 5px,5px 5px;background-repeat:no-repeat}@media(max-width:600px){.welcome-builder-design-grid{grid-template-columns:1fr}.welcome-builder-design-preview{height:126px}}`}</style>
      <style>{`.welcome-preview-avatar{display:grid;place-items:center;width:52px;height:52px;border:1px solid color-mix(in srgb,var(--wc-accent) 60%,transparent);border-radius:16px;background:linear-gradient(145deg,color-mix(in srgb,var(--wc-accent) 24%,transparent),rgba(0,0,0,.24));color:var(--wc-accent);box-shadow:0 10px 24px rgba(0,0,0,.25)}.welcome-builder-add-feature{align-self:flex-start;padding:7px 10px;border:1px dashed var(--accent-border);border-radius:7px;background:var(--accent-bg-soft);color:var(--accent);font:700 11px inherit;cursor:pointer}.welcome-builder-feedback{margin:0;padding:9px 11px;border-radius:8px;font-size:calc((11px) + 1px)}.welcome-builder-feedback.success{background:rgba(16,185,129,.1);color:#6ee7a1}.welcome-builder-feedback.error{background:rgba(226,85,92,.12);color:#ff9b9b}.welcome-builder-saving-icon{animation:welcomeSaveSpin 1s linear infinite}@keyframes welcomeSaveSpin{to{transform:rotate(360deg)}}`}</style>
      <style>{`.welcome-builder-theme-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.welcome-builder-theme{display:flex;align-items:center;gap:8px;min-width:0;padding:8px;border:1px solid var(--surface-border);border-radius:9px;background:var(--surface);color:var(--text);text-align:left;cursor:pointer}.welcome-builder-theme:hover{border-color:var(--accent-border)}.welcome-builder-theme.selected{border-color:var(--accent-border-strong);background:var(--accent-bg);box-shadow:0 0 0 1px var(--accent-border)}.welcome-builder-theme-swatch{width:28px;height:28px;display:grid;place-items:center;flex:0 0 28px;border:1px solid;border-radius:8px}.welcome-builder-theme>span:nth-child(2){display:flex;flex:1;flex-direction:column;gap:2px;min-width:0}.welcome-builder-theme b{font-size:calc((10px) + 1px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.welcome-builder-theme small{color:var(--text-secondary);font-size:calc((9px) + 1px)}.welcome-builder-theme>svg{color:var(--accent)}@media(max-width:600px){.welcome-builder-theme-grid{grid-template-columns:1fr}}`}</style>
      <style>{`.welcome-builder-save{position:sticky;bottom:10px;z-index:3;min-height:46px;box-shadow:0 10px 26px rgba(0,0,0,.32)}.welcome-builder-save:disabled{opacity:.45}.tool-dashboard:has(.welcome-builder) .tool-dashboard-body{padding-top:10px;background:linear-gradient(180deg,rgba(156,255,0,.035),transparent 32%)}.tool-dashboard:has(.welcome-builder) .tool-dashboard-body>.tool-dashboard-block{border-color:rgba(156,255,0,.18);background:linear-gradient(145deg,rgba(255,255,255,.045),rgba(0,0,0,.16));box-shadow:0 12px 28px rgba(0,0,0,.12)}.tool-dashboard:has(.welcome-builder) .tool-dashboard-body> .tool-dashboard-block:first-child{border-color:rgba(156,255,0,.32);background:linear-gradient(145deg,rgba(156,255,0,.1),rgba(0,0,0,.2))}.tool-dashboard:has(.welcome-builder) .tool-dashboard-body> .tool-dashboard-block select{min-height:40px;padding:0 36px 0 12px;border:1px solid rgba(156,255,0,.22);border-radius:9px;background:#101610;color:var(--text);font-size:calc((12px) + 1px);outline:none}.tool-dashboard:has(.welcome-builder) .tool-dashboard-body> .tool-dashboard-block select:focus{border-color:rgba(156,255,0,.58);box-shadow:0 0 0 3px rgba(156,255,0,.08)}`}</style>
    </div>
  );
}
