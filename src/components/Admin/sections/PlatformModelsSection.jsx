import React from "react";
import { Activity, CheckCircle2, LockKeyhole } from "lucide-react";
import { C } from "../AdminUI.jsx";

const models = [
  ["Unified Home Feed", "HomeView / PostTab / ReelsTab", "Make every active post and reel reachable while keeping newest content first.", "created_at, stable id, deleted_at, page size, content type", "Independent pagination, id deduplication, and complete retrieval until the source is exhausted.", "Ranking never removes an item from the source feed."],
  ["Personalization and Wisdom Ranking", "discoveryPersonalizationModel.rankItems", "Put unseen items newest-first, then use affinity and category diversity for seen items.", "created_at, category, seen ids, session categories, affinity profile", "Balances recency with relevance and periodic surprise-category insertion.", "Ranking changes order only; it does not permanently hide content."],
  ["Explore Recent Surface", "exploreService.getRecentPosts", "Keep Explore backed by the six newest available posts.", "created_at, stable id tie-breaker, deleted_at", "Returns up to six recent posts with profile and reaction data.", "The bounded Explore preview is separate from the complete Home feed."],
  ["Evidence and Integrity Graph", "Explore evidence services / XRC", "Make provenance, relationships, and record integrity inspectable.", "records, links, hashes, actors, timestamps", "Builds traceable evidence views and verification states.", "Integrity proves record consistency, not that an external claim is true."],
];

const PlatformModelsSection = () => (
  <div className="platform-models">
    <style>{`
      .platform-models{max-width:1180px;margin:0 auto;color:${C.text}}.platform-models *{box-sizing:border-box}
      .pm-hero{padding:26px;border:1px solid rgba(163,230,53,.25);border-radius:18px;background:linear-gradient(135deg,#111a12,#111820)}
      .pm-kicker{display:flex;align-items:center;gap:8px;color:${C.accent};font-size:10px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase}.pm-hero h1{margin:12px 0 8px;font-size:30px;letter-spacing:-1px}.pm-hero p{max-width:760px;margin:0;color:${C.muted};font-size:13px;line-height:1.6}
      .pm-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:14px}.pm-card{padding:20px;border:1px solid ${C.border2};border-radius:16px;background:${C.bg1}}.pm-card-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.pm-card h2{margin:0 0 5px;font-size:16px}.pm-owner{color:${C.muted2};font-size:10px}.pm-status{display:flex;align-items:center;gap:5px;color:${C.accent};font-size:10px;font-weight:800;white-space:nowrap}.pm-row{padding-top:14px;margin-top:14px;border-top:1px solid rgba(255,255,255,.07)}.pm-label{display:block;margin-bottom:4px;color:${C.muted2};font-size:9px;font-weight:900;letter-spacing:1px;text-transform:uppercase}.pm-value{color:${C.text2};font-size:12px;line-height:1.55}.pm-note{margin-top:14px;padding:12px;border-left:2px solid ${C.warn};background:rgba(245,158,11,.06);color:#c9b990;font-size:11px;line-height:1.5}@media(max-width:760px){.pm-grid{grid-template-columns:1fr}.pm-hero{padding:20px}}
    `}</style>
    <section className="pm-hero"><div className="pm-kicker"><LockKeyhole size={13}/> CEO only / platform intelligence</div><h1>Models, intent, and cause-effect</h1><p>This registry documents the active decision systems shaping discovery, feed delivery, Explore, and evidence. Ranking influences order; source pagination controls completeness.</p></section>
    <div className="pm-grid">{models.map(([name, owner, intent, inputs, effect, guardrail]) => <article className="pm-card" key={name}><div className="pm-card-head"><div><h2>{name}</h2><div className="pm-owner">{owner}</div></div><span className="pm-status"><CheckCircle2 size={13}/> Active</span></div><div className="pm-row"><span className="pm-label">Intent</span><div className="pm-value">{intent}</div></div><div className="pm-row"><span className="pm-label">Inputs</span><div className="pm-value">{inputs}</div></div><div className="pm-row"><span className="pm-label">Cause to effect</span><div className="pm-value">{effect}</div></div><div className="pm-note"><strong>Guardrail:</strong> {guardrail}</div></article>)}</div>
    <div className="pm-note" style={{marginTop:14}}><Activity size={13} style={{verticalAlign:"-2px",marginRight:6}}/><strong>Operating principle:</strong> completeness is a retrieval contract; personalization is an ordering contract.</div>
  </div>
);

export default PlatformModelsSection;