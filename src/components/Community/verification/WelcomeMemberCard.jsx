import React, { useEffect, useState } from "react";
import { Check, ShieldCheck, UserPlus } from "lucide-react";
import { supabase } from "../../../services/config/supabase";
import mediaUrlService from "../../../services/shared/mediaUrlService";
import BoostAvatarRing from "../../Shared/BoostAvatarRing";
import { getBoostNameDesign } from "../../../services/boost/boostThemes";
import { getWelcomeTheme } from "./WelcomeChannelCard";

const DEFAULTS = {
  eyebrow: "You found your people",
  title: "Find your people. Make something memorable.",
  description: "Introduce yourself, explore the channels, and join the conversation.",
  features: ["Introduce yourself", "Explore channels", "Meet the community"],
  primaryLabel: "Introduce yourself",
  secondaryLabel: "Browse channels",
  layout: "hero",
  themeId: "lime-classic",
  showFeatures: true,
  showMemberCount: true,
};

export function getWelcomeMemberId(content) {
  return String(content || "").match(/^\[\[welcome-member:([^\]]+)\]\]/)?.[1] || null;
}

export default function WelcomeMemberCard({ communityId, memberId, community, createdAt }) {
  const [member, setMember] = useState(null);
  const [welcomeConfig, setWelcomeConfig] = useState({});

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [{ data: membership }, { data: setting }] = await Promise.all([
        supabase.from("community_members").select("role_id, role:community_roles(id,name,color,icon)").eq("community_id", communityId).eq("user_id", memberId).maybeSingle(),
        supabase.from("community_tool_settings").select("config").eq("community_id", communityId).eq("tool_type", "welcome").maybeSingle(),
      ]);
      const { data: profile } = await supabase.from("profiles").select("id,username,full_name,avatar_id,avatar_metadata,verified,subscription_tier,boost_selections").eq("id", memberId).maybeSingle();
      if (active) {
        setMember({ ...profile, role: membership?.role || null });
        setWelcomeConfig(setting?.config || {});
      }
    };
    load();
    const channel = supabase.channel(`welcome-member:${communityId}:${memberId}`).on("postgres_changes", { event: "*", schema: "public", table: "community_members", filter: `community_id=eq.${communityId}` }, load).subscribe();
    return () => { active = false; supabase.removeChannel(channel).catch(() => {}); };
  }, [communityId, memberId]);

  const config = { ...DEFAULTS, ...welcomeConfig };
  const theme = getWelcomeTheme(config.themeId);
  const name = member?.full_name || member?.username || "new member";
  const role = member?.role;
  const roleColor = role?.color || theme.accent;
  const design = getBoostNameDesign(member?.subscription_tier, member?.boost_selections?.fontId, member?.boost_selections?.colorId);
  const avatar = mediaUrlService.resolveAvatarUrl(member?.avatar_id || member?.avatar_metadata?.url || member?.avatar_metadata?.publicUrl, 240);
  const Icon = theme.icon;
  const features = Array.isArray(config.features) ? config.features : DEFAULTS.features;

  return <article className={`welcome-member-card welcome-member-card-${config.layout}`} style={{ "--welcome-accent": theme.accent, "--welcome-bg": theme.bg, "--welcome-border": theme.border, "--member-role-color": roleColor }}>
    <div className="welcome-member-glow" />
    <div className="welcome-member-topline"><span><Icon size={14} /> {config.eyebrow}</span>{config.showMemberCount && <small><UserPlus size={12} /> New member</small>}</div>
    <div className="welcome-member-main"><div className="welcome-member-copy"><div className="welcome-member-kicker">Welcome to {community?.name || "the community"}</div><h2>Meet <span style={{ color: design.color?.color || roleColor, fontFamily: design.font?.family, fontWeight: design.font?.weight }}>{name}</span></h2><p>{config.description}</p><div className="welcome-member-meta">{role && <span style={{ color: roleColor, borderColor: `${roleColor}66` }}><ShieldCheck size={12} /> {role.name}</span>}{member?.verified && <span><Check size={12} /> Verified</span>}{member?.subscription_tier && <span>{member.subscription_tier} boost</span>}</div>{config.showFeatures && <div className="welcome-member-features">{features.map((feature) => <span key={feature}>{feature}</span>)}</div>}</div><div className="welcome-member-avatar"><BoostAvatarRing tier={member?.subscription_tier} themeId={member?.boost_selections?.themeId} accentColor={design.color?.color || roleColor} size={92} src={avatar} letter={name.charAt(0).toUpperCase()} showBadge /></div></div>
    <div className="welcome-member-actions"><button type="button"><UserPlus size={14} />{config.primaryLabel}</button><button type="button">{config.secondaryLabel}</button></div>
    <time dateTime={createdAt}>{createdAt ? new Date(createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Just now"}</time>
    <style>{`.welcome-member-card{position:relative;overflow:hidden;max-width:720px;margin:18px auto;padding:22px;border:1px solid var(--welcome-border);border-radius:18px;background:var(--welcome-bg);color:#f2faef;box-shadow:0 18px 52px rgba(0,0,0,.28)}.welcome-member-glow{position:absolute;right:-50px;top:-80px;width:210px;height:210px;border-radius:50%;background:var(--welcome-accent);opacity:.13;filter:blur(4px)}.welcome-member-topline,.welcome-member-topline span,.welcome-member-topline small,.welcome-member-main,.welcome-member-meta,.welcome-member-meta span,.welcome-member-features,.welcome-member-actions,.welcome-member-actions button{display:flex;align-items:center}.welcome-member-topline{position:relative;justify-content:space-between;color:var(--welcome-accent);font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.welcome-member-topline span,.welcome-member-topline small{gap:5px}.welcome-member-topline small{color:#a6b5aa;font-size:10px;letter-spacing:0;text-transform:none}.welcome-member-main{position:relative;justify-content:space-between;gap:24px;margin-top:18px}.welcome-member-copy{min-width:0}.welcome-member-kicker{color:var(--welcome-accent);font-size:10px;font-weight:800}.welcome-member-card h2{margin:7px 0 5px;font-size:25px;line-height:1.08}.welcome-member-card p{margin:0;color:#a6b5aa;font-size:12px;line-height:1.5}.welcome-member-avatar{display:grid;place-items:center;flex:0 0 112px;height:112px;border:1px solid color-mix(in srgb,var(--welcome-accent) 36%,transparent);border-radius:16px;background:rgba(0,0,0,.2)}.welcome-member-meta{flex-wrap:wrap;gap:6px;margin-top:12px}.welcome-member-meta span{gap:4px;padding:5px 7px;border:1px solid rgba(255,255,255,.14);border-radius:999px;color:#d6e3d3;font-size:10px}.welcome-member-features{flex-wrap:wrap;gap:6px;margin-top:12px}.welcome-member-features span{padding:5px 7px;border-radius:999px;background:rgba(255,255,255,.06);color:#c4d1c2;font-size:10px}.welcome-member-actions{position:relative;gap:7px;margin-top:18px}.welcome-member-actions button{justify-content:center;gap:6px;padding:9px 12px;border:1px solid var(--welcome-accent);border-radius:8px;background:var(--welcome-accent);color:#091007;font:700 10px inherit;cursor:pointer}.welcome-member-actions button+button{border-color:rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:#d6e3d3}.welcome-member-card time{display:block;position:relative;margin-top:12px;color:#738477;font-size:10px}@media(max-width:600px){.welcome-member-card{margin:12px;padding:16px}.welcome-member-main{align-items:flex-start}.welcome-member-avatar{flex-basis:82px;width:82px;height:82px}.welcome-member-card h2{font-size:20px}.welcome-member-actions{flex-wrap:wrap}}`}</style>
  </article>;
}
