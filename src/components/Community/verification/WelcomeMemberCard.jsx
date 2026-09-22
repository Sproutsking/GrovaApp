import React, { useEffect, useState } from "react";
import { Check, ShieldCheck, UserPlus } from "lucide-react";
import { supabase } from "../../../services/config/supabase";
import mediaUrlService from "../../../services/shared/mediaUrlService";
import BoostAvatarRing from "../../Shared/BoostAvatarRing";
import { getBoostNameDesign } from "../../../services/boost/boostThemes";
import { getWelcomeDesign, getWelcomeTheme, WelcomeCardFrame } from "./WelcomeChannelCard";

const DEFAULTS = {
  eyebrow: "You found your people",
  title: "Find your people. Make something memorable.",
  description: "Introduce yourself, explore the channels, and join the conversation.",
  primaryLabel: "Introduce yourself",
  secondaryLabel: "Browse channels",
  layout: "hero",
  themeId: "lime-classic",
  showMemberCount: true,
  showPrimaryAction: true,
  showSecondaryAction: true,
};

const AVATAR_SIZE_BY_CRAFT = {
  "banner-hero": 88,
  "side-rail": 80,
  spotlight: 64,
  "minimal-row": 48,
  poster: 108,
  "ticket-stub": 64,
};

export function getWelcomeMemberId(content) {
  return String(content || "").match(/^\[\[welcome-member:([^\]]+)\]/)?.[1] || null;
}

export default function WelcomeMemberCard({ communityId, memberId, community, createdAt, onProfileClick, onIntroduce, onBrowse }) {
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
    const channel = supabase.channel(`welcome-member:${communityId}:${memberId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_members", filter: `community_id=eq.${communityId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `id=eq.${memberId}` }, load)
      .subscribe();
    return () => { active = false; supabase.removeChannel(channel).catch(() => {}); };
  }, [communityId, memberId]);

  const config = { ...DEFAULTS, ...welcomeConfig };
  const theme = getWelcomeTheme(config.themeId);
  const cardDesign = getWelcomeDesign(config.designId || config.craft);
  const name = member?.full_name || member?.username || "new member";
  const role = member?.role;
  const roleColor = role?.color || theme.accent;
  const nameDesign = getBoostNameDesign(member?.subscription_tier, member?.boost_selections?.fontId, member?.boost_selections?.colorId);
  const avatar = mediaUrlService.resolveAvatarUrl(member?.avatar_id || member?.avatar_metadata?.url || member?.avatar_metadata?.publicUrl, 240);
  const avatarSize = AVATAR_SIZE_BY_CRAFT[theme.craft] || 74;

  return <WelcomeCardFrame
    theme={theme}
    design={cardDesign}
    density={config.layout === "compact" ? "compact" : "regular"}
    eyebrow={config.eyebrow}
    kicker={`Welcome to ${community?.name || "the community"}`}
    topRight={config.showMemberCount ? <small><UserPlus size={12} /> New member</small> : null}
    heading={<button type="button" className="wc-heading-btn" onClick={() => onProfileClick?.(member)} style={{ color: roleColor, fontFamily: nameDesign.font?.family, fontWeight: nameDesign.font?.weight }}>{name}</button>}
    description={config.description}
    avatar={<button type="button" onClick={() => onProfileClick?.(member)} aria-label={`Open ${name}'s profile`} style={{ border: 0, background: "transparent", padding: 0, cursor: "pointer", display: "inline-flex" }}><BoostAvatarRing tier={member?.subscription_tier} themeId={member?.boost_selections?.themeId} accentColor={nameDesign.color?.color || roleColor} size={avatarSize} src={avatar} letter={name.charAt(0).toUpperCase()} showBadge /></button>}
    meta={<>{role && <span style={{ color: roleColor, borderColor: `${roleColor}66` }}><ShieldCheck size={12} /> {role.name}</span>}{member?.verified && <span><Check size={12} /> Verified</span>}{member?.subscription_tier && <span>{member.subscription_tier} boost</span>}</>}
    actions={(config.showPrimaryAction || config.showSecondaryAction) && <>{config.showPrimaryAction && <button type="button" onClick={() => onIntroduce?.(config.introChannelId)} disabled={!config.introChannelId}><UserPlus size={14} />{config.primaryLabel}</button>}{config.showSecondaryAction && <button type="button" onClick={() => onBrowse?.()}>{config.secondaryLabel}</button>}</>}
    footer={<time dateTime={createdAt}>{createdAt ? new Date(createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Just now"}</time>}
  />;
}
