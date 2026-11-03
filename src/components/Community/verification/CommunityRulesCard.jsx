import React from "react";
import { BookOpenCheck, Sparkles } from "lucide-react";

export const RULES_CARD_STYLES = [
  { id: "aurora", label: "Aurora" },
  { id: "midnight", label: "Midnight" },
  { id: "minimal", label: "Minimal" },
];

export default function CommunityRulesCard({ title, description, items = [], appearance = "aurora" }) {
  const selectedAppearance = RULES_CARD_STYLES.some((style) => style.id === appearance) ? appearance : "aurora";

  return (
    <article className={`community-rules-card community-rules-card-${selectedAppearance}`} aria-label={`Community rules card, ${selectedAppearance} style`} data-rules-style={selectedAppearance}>
      <header className="community-rules-card-header">
        <div className="community-rules-card-icon"><BookOpenCheck size={18} aria-hidden="true" /></div>
        <div>
          <span className="community-rules-card-eyebrow">Community handbook</span>
          <h1>{title || "Community rules"}</h1>
          {description && <p>{description}</p>}
        </div>
        <Sparkles className="community-rules-card-sparkle" size={17} aria-hidden="true" />
      </header>
      <ol>
        {items.map((rule, index) => (
          <li key={rule.id || `${rule.title}-${index}`}>
            <span className="community-rules-card-number">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <strong>{rule.title}</strong>
              {rule.body && <p>{rule.body}</p>}
            </div>
          </li>
        ))}
      </ol>
      <style>{`
        .community-rules-card{position:relative;isolation:isolate;overflow:hidden;width:calc(100% - 24px);max-width:760px;box-sizing:border-box;margin:16px auto;padding:20px;border:1px solid rgba(156,255,0,.2);border-radius:16px;background:linear-gradient(145deg,#141b16 0%,#0b100d 76%);color:#eef8ed;box-shadow:0 16px 38px rgba(0,0,0,.2),inset 0 1px 0 rgba(255,255,255,.045)}
        .community-rules-card:before{position:absolute;z-index:-1;top:-100px;right:-80px;width:240px;height:220px;border-radius:50%;background:radial-gradient(circle,rgba(156,255,0,.12),transparent 70%);content:"";pointer-events:none}
        .community-rules-card-header{position:relative;display:grid;grid-template-columns:38px minmax(0,1fr) 18px;align-items:start;gap:11px;padding-bottom:15px;border-bottom:1px solid rgba(255,255,255,.08)}
        .community-rules-card-icon{display:grid;place-items:center;width:36px;height:36px;border:1px solid rgba(156,255,0,.25);border-radius:11px;background:rgba(156,255,0,.09);color:#baff76}
        .community-rules-card-eyebrow{display:block;margin:1px 0 5px;color:#a6c58e;font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}
        .community-rules-card h1{margin:0;color:#f4ffed;font-size:clamp(18px,2.2vw,24px);font-weight:850;line-height:1.2;overflow-wrap:anywhere}
        .community-rules-card-header p,.community-rules-card li p{margin:6px 0 0;color:#aab8a9;font-size:12px;line-height:1.55;overflow-wrap:anywhere}
        .community-rules-card-sparkle{margin-top:3px;color:#9cff00;opacity:.8}
        .community-rules-card ol{display:grid;gap:8px;margin:14px 0 0;padding:0;list-style:none}
        .community-rules-card li{display:grid;grid-template-columns:30px minmax(0,1fr);align-items:start;gap:10px;padding:10px 11px;border:1px solid rgba(255,255,255,.065);border-radius:10px;background:rgba(255,255,255,.025)}
        .community-rules-card-number{display:grid;place-items:center;width:27px;height:27px;border-radius:8px;background:rgba(156,255,0,.1);color:#baff76;font:800 10px/1 ui-monospace,monospace}
        .community-rules-card li strong{display:block;padding-top:4px;color:#f0f7ed;font-size:13px;line-height:1.35;overflow-wrap:anywhere}
        .community-rules-card-midnight{border-color:rgba(133,167,255,.26);background:linear-gradient(145deg,#161a28 0%,#0b0d13 78%)}
        .community-rules-card-midnight:before{background:radial-gradient(circle,rgba(126,157,255,.15),transparent 70%)}
        .community-rules-card-midnight .community-rules-card-icon,.community-rules-card-midnight .community-rules-card-number{border-color:rgba(133,167,255,.28);background:rgba(133,167,255,.1);color:#c1d0ff}
        .community-rules-card-midnight .community-rules-card-eyebrow{color:#aab9ee}
        .community-rules-card-midnight .community-rules-card-sparkle{color:#a9bdff}
        .community-rules-card-minimal{border-color:rgba(255,255,255,.12);background:#101311;box-shadow:none}
        .community-rules-card-minimal:before,.community-rules-card-minimal .community-rules-card-sparkle{display:none}
        .community-rules-card-minimal .community-rules-card-icon,.community-rules-card-minimal .community-rules-card-number{border-color:rgba(156,255,0,.2);background:transparent}
        @media(max-width:768px){.community-rules-card{width:calc(100% - 12px);margin:7px auto;padding:13px;border-radius:13px}.community-rules-card-header{grid-template-columns:32px minmax(0,1fr) 14px;gap:8px;padding-bottom:11px}.community-rules-card-icon{width:31px;height:31px;border-radius:9px}.community-rules-card-icon svg{width:16px;height:16px}.community-rules-card-eyebrow{font-size:9px}.community-rules-card-header p,.community-rules-card li p{font-size:11px}.community-rules-card ol{gap:6px;margin-top:10px}.community-rules-card li{grid-template-columns:25px minmax(0,1fr);gap:8px;padding:8px}.community-rules-card-number{width:24px;height:24px}.community-rules-card li strong{padding-top:3px;font-size:12px}}
      `}</style>
    </article>
  );
}
