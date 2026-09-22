import React, { useState, useEffect } from "react";
import { PartyPopper, Sparkles, Sun, Waves, Gem, Circle } from "lucide-react";
import { supabase } from "../../../services/config/supabase";

export const WELCOME_CARD_THEMES = [
  { id: "lime-classic", label: "Lime classic", icon: PartyPopper, bg: "linear-gradient(145deg, rgba(29,45,25,.96), rgba(9,15,11,.98))", border: "rgba(156,255,0,.2)", accent: "#9cff00", craft: "banner-hero" },
  { id: "ocean-brief", label: "Ocean brief", icon: Waves, bg: "linear-gradient(145deg, rgba(17,28,40,.97), rgba(8,13,18,.99))", border: "rgba(96,165,250,.22)", accent: "#67e8f9", craft: "side-rail" },
  { id: "sunset-warm", label: "Sunset warm", icon: Sun, bg: "linear-gradient(145deg, rgba(45,28,18,.97), rgba(18,10,7,.99))", border: "rgba(251,146,60,.24)", accent: "#fb923c", craft: "spotlight" },
  { id: "glass-quiet", label: "Glass quiet", icon: Circle, bg: "linear-gradient(145deg, rgba(30,30,34,.9), rgba(14,14,17,.96))", border: "rgba(255,255,255,.14)", accent: "#e5e7eb", craft: "minimal-row" },
  { id: "cosmic-bold", label: "Cosmic bold", icon: Sparkles, bg: "linear-gradient(150deg, #1e0a3c 0%, #3b0764 60%, #1a0630 100%)", border: "rgba(236,72,153,.28)", accent: "#ec4899", craft: "poster" },
  { id: "diamond-mono", label: "Diamond mono", icon: Gem, bg: "linear-gradient(145deg, rgba(20,22,28,.97), rgba(9,10,13,.99))", border: "rgba(167,139,250,.24)", accent: "#a78bfa", craft: "ticket-stub" },
];

export function getWelcomeTheme(id) {
  return WELCOME_CARD_THEMES.find((t) => t.id === id) || WELCOME_CARD_THEMES[0];
}

const HERO_CRAFTS = new Set(["banner-hero", "spotlight", "poster"]);

export function WelcomeCardFrame({ theme, eyebrow = "", kicker = "", heading, description = "", avatar, meta, actions, topRight, footer, density = "regular" }) {
  const craft = theme?.craft || "banner-hero";
  const Icon = theme?.icon;
  const isHero = HERO_CRAFTS.has(craft);
  const eyebrowNode = <span><i className="wc-eyebrow-badge">{Icon && <Icon size={11} />}</i>{eyebrow}</span>;
  const headingNode = <div className={`wc-frame-heading${isHero ? " wc-heading-grad" : ""}`}>{heading}</div>;
  const haloAvatar = avatar && isHero ? <span className="wc-avatar-halo">{avatar}</span> : avatar;

  return (
    <article className={`wc-frame craft-${craft} density-${density}`} style={{ "--wc-accent": theme?.accent, "--wc-bg": theme?.bg, "--wc-border": theme?.border }}>
      <div className="wc-glow" aria-hidden="true" />
      <div className="wc-topline">{eyebrowNode}{topRight}</div>
      <div className="wc-card-content">
        {haloAvatar && <div className="wc-avatar">{haloAvatar}</div>}
        {kicker && <em>{kicker}</em>}
        {headingNode}
        {description && <p>{description}</p>}
        {meta && <div className="wc-meta-row">{meta}</div>}
        {actions && <div className="wc-actions">{actions}</div>}
      </div>
      {footer && <div className="wc-footer">{footer}</div>}
      <style>{`
        .wc-frame{position:relative;overflow:hidden;max-width:720px;margin:14px auto;color:#f4faf1;border-radius:20px;border:1px solid var(--wc-border);background:var(--wc-bg);box-shadow:0 24px 60px -24px rgba(0,0,0,.65),0 0 30px color-mix(in srgb,var(--wc-accent) 12%,transparent)}
        .wc-frame:after{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(100% 80% at 100% 0%,color-mix(in srgb,var(--wc-accent) 16%,transparent),transparent 58%)}
        .wc-glow{position:absolute;right:-70px;top:-80px;width:190px;height:190px;border-radius:50%;background:var(--wc-accent);opacity:.13;filter:blur(28px);pointer-events:none}
        .wc-topline{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:18px 20px 0;color:var(--wc-accent);font-size:9.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.wc-topline span{display:flex;align-items:center;gap:6px}.wc-topline small{display:flex;align-items:center;gap:5px;color:#c3d0c0;font-size:9px;letter-spacing:0;text-transform:none}
        .wc-eyebrow-badge{display:inline-flex;align-items:center;justify-content:center;width:19px;height:19px;border-radius:6px;background:color-mix(in srgb,var(--wc-accent) 18%,transparent);border:1px solid color-mix(in srgb,var(--wc-accent) 55%,transparent);font-style:normal}
        .wc-card-content{position:relative;z-index:1;padding:18px 20px 20px}.wc-card-content em{display:block;margin-top:4px;font-style:normal;color:var(--wc-accent);font-size:10px;font-weight:800}.wc-frame-heading{margin:5px 0;color:#f4faf1;font-size:23px;line-height:1.14;font-weight:850}.wc-heading-grad{background:linear-gradient(175deg,#fff 20%,color-mix(in srgb,var(--wc-accent) 62%,white 38%));-webkit-background-clip:text;background-clip:text;color:transparent}.wc-heading-btn{display:inline-flex;align-items:center;justify-content:center;max-width:100%;margin:1px 0 2px;padding:5px 10px;border:1px solid rgba(255,255,255,.16);border-radius:9px;background:linear-gradient(180deg,rgba(255,255,255,.13),rgba(255,255,255,.045));box-shadow:0 1px 0 rgba(255,255,255,.12) inset,0 8px 18px -14px rgba(0,0,0,.8);font:inherit;font-size:inherit;line-height:1.2;text-align:inherit;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;backdrop-filter:blur(10px);transition:background .16s ease,border-color .16s ease,transform .16s ease}.wc-heading-btn:hover{border-color:color-mix(in srgb,var(--wc-accent) 55%,rgba(255,255,255,.2));background:linear-gradient(180deg,rgba(255,255,255,.19),rgba(255,255,255,.07));transform:translateY(-1px)}.wc-heading-btn:active{transform:translateY(0)}.wc-frame p{margin:7px 0 0;color:#c3d1c0;font-size:12.5px;line-height:1.6}.wc-avatar{margin-bottom:10px}.wc-avatar-halo{display:inline-flex;position:relative}.wc-avatar-halo:before{content:"";position:absolute;inset:-14px;border-radius:50%;background:var(--wc-accent);opacity:.3;filter:blur(16px);z-index:-1}.wc-meta-row{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.wc-meta-row span{display:flex;align-items:center;gap:4px;padding:5px 8px;border:1px solid rgba(255,255,255,.14);border-radius:999px;color:#dfe9dc;font-size:9.5px}.wc-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.wc-actions button{display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 14px;border:1px solid color-mix(in srgb,var(--wc-accent) 55%,transparent);border-radius:10px;background:linear-gradient(178deg,color-mix(in srgb,var(--wc-accent) 100%,white 22%),var(--wc-accent) 85%);color:#08110a;font:800 10.5px inherit;cursor:pointer}.wc-actions button+button{color:#e7f0e4;background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.16)}.wc-actions button:disabled{opacity:.4;cursor:not-allowed}.wc-footer{position:relative;z-index:1;padding:0 20px 14px;color:#819181;font-size:9.5px}.craft-banner-hero .wc-card-content{text-align:center}.craft-banner-hero .wc-avatar,.craft-banner-hero .wc-actions{display:flex;justify-content:center}.craft-side-rail .wc-card-content{padding-top:14px}.craft-spotlight .wc-frame-heading{font-size:27px}.craft-minimal-row .wc-topline{display:none}.craft-minimal-row .wc-card-content{display:flex;align-items:center;gap:12px;padding:12px 14px}.craft-minimal-row .wc-card-content p{display:none}.craft-minimal-row .wc-frame-heading{font-size:15px}.craft-poster .wc-card-content{padding-left:120px;min-height:150px;display:flex;flex-direction:column;justify-content:end}.craft-ticket-stub .wc-card-content{padding-right:140px}
        @media(max-width:600px){.wc-frame{margin:8px 0;border-radius:16px}.wc-topline{padding:14px 15px 0}.wc-card-content{padding:14px 15px 16px}.wc-frame-heading{font-size:19px}.craft-spotlight .wc-frame-heading{font-size:22px}.craft-poster .wc-card-content{padding-left:90px;min-height:135px}.craft-ticket-stub .wc-card-content{padding-right:15px}.craft-minimal-row .wc-card-content{align-items:flex-start;flex-wrap:wrap}.wc-actions{width:100%}.wc-actions button{flex:1;min-width:140px}}
      `}</style>
    </article>
  );
}

export default function WelcomeChannelCard({ community }) {
  const [welcome, setWelcome] = useState({
    title: "Find your people. Make something memorable.",
    description: "Introduce yourself, explore the channels, and join the conversation.",
    themeId: "lime-classic",
  });

  useEffect(() => {
    if (!community?.id) return;
    const fetchWelcome = async () => {
      const { data } = await supabase.from("communities").select("settings").eq("id", community.id).single();
      const wc = data?.settings?.welcome_card;
      if (wc) {
        setWelcome((current) => ({
          title: wc.title || current.title,
          description: wc.description || current.description,
          themeId: wc.themeId || current.themeId,
        }));
      }
    };
    fetchWelcome();
  }, [community?.id]);

  const theme = getWelcomeTheme(welcome.themeId);
  return <WelcomeCardFrame theme={theme} eyebrow="Welcome" kicker={`Welcome to ${community?.name || "the community"}`} heading={welcome.title} description={welcome.description} />;
}