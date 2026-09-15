import React, { useEffect, useState } from "react";
import { Check, ExternalLink, LayoutTemplate, UserPlus } from "lucide-react";
import { getWelcomeTheme } from "./WelcomeChannelCard";
import { supabase } from "../../../services/config/supabase";

const DEFAULTS = { eyebrow: "You found your people", title: "Find your people. Make something memorable.", description: "Introduce yourself, explore the channels, and join the conversation.", features: ["Introduce yourself", "Explore channels", "Meet the community"], primaryLabel: "Introduce yourself", secondaryLabel: "Browse channels", layout: "hero", themeId: "lime-classic", showFeatures: true, showMemberCount: true };

export default function WelcomeCardRenderer({ community, config = {} }) {
  const [savedConfig, setSavedConfig] = useState({});
  useEffect(() => {
    let active = true;
    if (!community?.id) return undefined;
    supabase.from("community_tool_settings").select("config").eq("community_id", community.id).eq("tool_type", "welcome").maybeSingle().then(({ data }) => {
      if (active) setSavedConfig(data?.config || {});
    });
    return () => { active = false; };
  }, [community?.id]);
  const welcome = { ...DEFAULTS, ...savedConfig, ...config };
  const theme = getWelcomeTheme(welcome.themeId);
  const Icon = theme.icon || LayoutTemplate;
  const features = Array.isArray(welcome.features) ? welcome.features : DEFAULTS.features;
  return <section className={`welcome-card welcome-card-${welcome.layout}`} style={{ "--welcome-accent": theme.accent, "--welcome-bg": theme.bg, "--welcome-border": theme.border }}>
    <div className="welcome-card-glow" />
    <div className="welcome-card-topline"><span><Icon size={14} /> {welcome.eyebrow}</span>{welcome.showMemberCount && <small><UserPlus size={12} /> 1,248 members</small>}</div>
    <div className="welcome-card-main"><div className="welcome-card-copy"><strong>Welcome to {community?.name || "the community"}</strong><h1>{welcome.title}</h1><p>{welcome.description}</p>{welcome.showFeatures && <div className="welcome-card-features">{features.map((feature) => <span key={feature}><Check size={12} />{feature}</span>)}</div>}</div><div className="welcome-card-actions"><button type="button"><UserPlus size={14} />{welcome.primaryLabel}</button><button type="button" className="welcome-card-secondary"><ExternalLink size={14} />{welcome.secondaryLabel}</button></div></div>
    <style>{`.welcome-card{position:relative;overflow:hidden;max-width:760px;margin:26px auto;padding:22px;border:1px solid var(--welcome-border);border-radius:18px;background:var(--welcome-bg);color:#f2faef;box-shadow:0 18px 52px rgba(0,0,0,.28)}.welcome-card-glow{position:absolute;right:-55px;top:-70px;width:200px;height:200px;border-radius:50%;background:var(--welcome-accent);opacity:.13;filter:blur(4px)}.welcome-card-topline,.welcome-card-main,.welcome-card-topline span,.welcome-card-topline small,.welcome-card-features,.welcome-card-features span,.welcome-card-actions,.welcome-card-actions button{display:flex;align-items:center}.welcome-card-topline{position:relative;justify-content:space-between;color:var(--welcome-accent);font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.welcome-card-topline span,.welcome-card-topline small{gap:5px}.welcome-card-topline small{color:#a6b5aa;font-size:10px;font-weight:600;letter-spacing:0;text-transform:none}.welcome-card-main{position:relative;justify-content:space-between;gap:20px;margin-top:22px}.welcome-card-copy{max-width:560px}.welcome-card-copy>strong{color:var(--welcome-accent);font-size:10px}.welcome-card h1{margin:6px 0;color:#f2faef;font-size:25px;line-height:1.08}.welcome-card p{margin:0;color:#a6b5aa;font-size:12px;line-height:1.5}.welcome-card-features{flex-wrap:wrap;gap:6px;margin-top:14px}.welcome-card-features span{gap:4px;padding:5px 7px;border:1px solid color-mix(in srgb,var(--welcome-accent) 30%,transparent);border-radius:999px;color:#d6e3d3;font-size:10px}.welcome-card-features svg{color:var(--welcome-accent)}.welcome-card-actions{flex-direction:column;gap:7px;min-width:155px}.welcome-card-actions button{justify-content:center;gap:6px;width:100%;padding:10px;border:1px solid var(--welcome-accent);border-radius:8px;background:var(--welcome-accent);color:#091007;font:700 10px inherit}.welcome-card-actions .welcome-card-secondary{border-color:rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:#d6e3d3}.welcome-card-split .welcome-card-actions{padding:12px;border:1px solid rgba(255,255,255,.12);border-radius:12px;background:rgba(0,0,0,.16)}.welcome-card-compact{padding:16px}.welcome-card-compact .welcome-card-main{margin-top:14px}.welcome-card-compact h1{font-size:19px}.welcome-card-compact .welcome-card-features{margin-top:9px}.welcome-card-compact .welcome-card-actions{min-width:130px}@media(max-width:600px){.welcome-card{margin:14px;padding:16px}.welcome-card-main{flex-direction:column;align-items:stretch}.welcome-card-actions{width:100%;min-width:0}.welcome-card h1{font-size:20px}}`}</style>
  </section>;
}
