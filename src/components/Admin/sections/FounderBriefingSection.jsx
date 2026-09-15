import React from "react";
import {
  CheckCircle2, CircleDot, Compass, Fingerprint, LockKeyhole, Network,
  Rocket, ShieldCheck, Sparkles, Target, WalletCards,
} from "lucide-react";
import { C } from "../AdminUI.jsx";

const pillars = [
  {
    icon: Fingerprint,
    color: C.accent,
    eyebrow: "01 / Identity",
    title: "A person should not be reduced to one login.",
    text: "Xeevia connects the identities a person chooses to bring together, then keeps the source and permission context visible.",
  },
  {
    icon: Network,
    color: C.info,
    eyebrow: "02 / Evidence",
    title: "Contribution should be easier to inspect.",
    text: "Profiles, activity, relationships, and outcomes become linked records instead of disconnected claims and screenshots.",
  },
  {
    icon: WalletCards,
    color: C.warn,
    eyebrow: "03 / Value",
    title: "Trust should lead to useful outcomes.",
    text: "Evidence can support community access, creator qualification, attribution, campaigns, and eventually settlement.",
  },
];

const nowItems = [
  ["Social surface", "Publishing, discovery, communities, messaging, creator profiles"],
  ["Evidence graph", "Source-linked evidence items, relationships, dashboard views"],
  ["Connector coverage", "Native connectors where available, honest identity records elsewhere"],
  ["Distribution", "Only active, token-backed, adapter-supported destinations are publishable"],
  ["Value rails", "Wallet, EP, local payment, Web3 payment, boost, and campaign foundations"],
];

const nextItems = [
  "Make native evidence ingestion excellent for a small number of high-value providers.",
  "Add freshness, revocation, contradiction, dispute, and selective disclosure states.",
  "Prove one measurable use case where evidence improves a decision over follower counts or resumes.",
  "Connect attribution to outcomes before promising evidence-backed settlement.",
];

const risks = [
  ["Do not overclaim", "Connected is not verified. A profile link is not provider-confirmed activity."],
  ["Protect the boundary", "XRC can show record integrity; it cannot make an external claim true by itself."],
  ["Earn the moat", "The advantage comes from trusted evidence and measured outcomes, not the dashboard alone."],
];

const SectionLabel = ({ children, color = C.accent }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, color, fontSize: 10, fontWeight: 900, letterSpacing: "1.8px", textTransform: "uppercase" }}>
    <span style={{ width: 22, height: 1, background: color, boxShadow: `0 0 10px ${color}` }} />
    {children}
  </div>
);

const FounderBriefingSection = () => (
  <div className="founder-briefing">
    <style>{`
      .founder-briefing { max-width: 1180px; margin: 0 auto; color: ${C.text}; }
      .founder-briefing * { box-sizing: border-box; }
      .founder-hero { position: relative; overflow: hidden; min-height: 410px; padding: clamp(26px, 5vw, 58px); border: 1px solid rgba(163,230,53,.26); border-radius: 28px; background: radial-gradient(circle at 88% 20%, rgba(59,130,246,.18), transparent 28%), radial-gradient(circle at 16% 100%, rgba(163,230,53,.13), transparent 34%), linear-gradient(135deg, #0b120d 0%, #10171a 52%, #101827 100%); box-shadow: 0 24px 80px rgba(0,0,0,.3); }
      .founder-hero:before { content:""; position:absolute; inset:0; opacity:.22; pointer-events:none; background-image: linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px); background-size: 42px 42px; mask-image: linear-gradient(135deg, black, transparent 70%); }
      .founder-hero-copy { position:relative; z-index:1; max-width: 720px; }
      .founder-kicker { display:flex; align-items:center; gap:8px; color:#b8f276; font-size:10px; font-weight:900; letter-spacing:2px; text-transform:uppercase; }
      .founder-title { max-width: 760px; margin: 18px 0 16px; font-size: clamp(36px, 6vw, 76px); line-height:.98; letter-spacing:-3px; font-weight:950; }
      .founder-title em { color:#b8f276; font-style:normal; }
      .founder-lead { max-width: 630px; margin:0; color:#bac5d1; font-size:clamp(14px, 2vw, 18px); line-height:1.65; }
      .founder-hero-meta { display:flex; flex-wrap:wrap; gap:9px; margin-top:28px; }
      .founder-chip { display:inline-flex; align-items:center; gap:7px; padding:8px 11px; border:1px solid rgba(255,255,255,.12); border-radius:999px; background:rgba(0,0,0,.2); color:#dce4ec; font-size:11px; font-weight:700; }
      .founder-orbit { position:absolute; right:8%; top:50%; width:210px; height:210px; transform:translateY(-50%); border:1px solid rgba(163,230,53,.3); border-radius:50%; box-shadow:0 0 70px rgba(163,230,53,.1); }
      .founder-orbit:before, .founder-orbit:after { content:""; position:absolute; inset:22px; border:1px solid rgba(96,165,250,.25); border-radius:50%; transform:rotate(55deg) scaleX(1.55); }
      .founder-orbit:after { inset:54px; border-color:rgba(245,158,11,.32); transform:rotate(-45deg) scaleX(1.45); }
      .founder-orbit-core { position:absolute; inset:76px; display:grid; place-items:center; border:1px solid #b8f276; border-radius:50%; background:#13210f; box-shadow:0 0 30px rgba(163,230,53,.28); }
      .founder-grid { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:14px; margin:18px 0 34px; }
      .founder-pillar, .founder-panel { border:1px solid ${C.border2}; border-radius:18px; background:linear-gradient(145deg, rgba(255,255,255,.055), rgba(255,255,255,.018)); }
      .founder-pillar { padding:20px; min-height:210px; }
      .founder-icon { width:38px; height:38px; display:grid; place-items:center; border-radius:12px; margin-bottom:22px; }
      .founder-eyebrow { margin-bottom:9px; color:#737f8c; font-size:10px; font-weight:900; letter-spacing:1px; text-transform:uppercase; }
      .founder-pillar h3 { margin:0 0 9px; font-size:16px; line-height:1.25; }
      .founder-pillar p, .founder-panel p { margin:0; color:#929eab; font-size:12px; line-height:1.65; }
      .founder-two-col { display:grid; grid-template-columns:1.05fr .95fr; gap:14px; }
      .founder-panel { padding:24px; }
      .founder-panel-head { display:flex; align-items:flex-start; justify-content:space-between; gap:14px; margin-bottom:20px; }
      .founder-panel h2 { margin:6px 0 0; font-size:20px; letter-spacing:-.4px; }
      .founder-status-list { display:grid; gap:2px; }
      .founder-status-row { display:grid; grid-template-columns:10px minmax(0,1fr); gap:12px; padding:12px 0; border-top:1px solid rgba(255,255,255,.07); }
      .founder-status-row strong { display:block; margin-bottom:3px; font-size:12px; color:#e8edf2; }
      .founder-status-row span { color:#8995a1; font-size:11px; line-height:1.5; }
      .founder-dot { width:7px; height:7px; margin-top:5px; border-radius:50%; background:#84cc16; box-shadow:0 0 10px #84cc16; }
      .founder-next-list { display:grid; gap:10px; margin:0; padding:0; list-style:none; }
      .founder-next-item { display:flex; align-items:flex-start; gap:10px; padding:12px; border:1px solid rgba(255,255,255,.07); border-radius:12px; background:rgba(0,0,0,.16); color:#c5d0da; font-size:12px; line-height:1.5; }
      .founder-next-item svg { flex-shrink:0; margin-top:1px; color:#b8f276; }
      .founder-risk-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-top:14px; }
      .founder-risk { padding:15px; border:1px solid rgba(245,158,11,.18); border-radius:14px; background:rgba(245,158,11,.045); }
      .founder-risk strong { display:block; color:#fbbf24; font-size:11px; margin-bottom:5px; }
      .founder-risk span { color:#a79a83; font-size:11px; line-height:1.5; }
      .founder-footer { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-top:22px; padding:18px 4px 4px; color:#6f7b86; font-size:11px; }
      .founder-footer strong { color:#b8f276; }
      @media (max-width: 900px) { .founder-orbit { right:-45px; opacity:.4; } .founder-grid, .founder-two-col { grid-template-columns:1fr; } .founder-pillar { min-height:0; } .founder-risk-grid { grid-template-columns:1fr; } }
      @media (max-width: 520px) { .founder-hero { min-height:470px; border-radius:20px; padding:24px 20px; } .founder-title { letter-spacing:-1.8px; } .founder-orbit { top:auto; right:-46px; bottom:-70px; transform:none; width:190px; height:190px; } .founder-panel { padding:18px; } .founder-footer { align-items:flex-start; flex-direction:column; } }
    `}</style>

    <section className="founder-hero">
      <div className="founder-hero-copy">
        <div className="founder-kicker"><CrownMark /> Founder briefing / private</div>
        <h1 className="founder-title">Make a person's digital life <em>legible.</em></h1>
        <p className="founder-lead">Xeevia is building a permissioned evidence layer that turns fragmented identity, contribution, relationships, and outcomes into a simple story people can inspect and use.</p>
        <div className="founder-hero-meta">
          <span className="founder-chip"><LockKeyhole size={13} color={C.accent} /> CEO only</span>
          <span className="founder-chip"><ShieldCheck size={13} color={C.info} /> Evidence before claims</span>
          <span className="founder-chip"><Target size={13} color={C.warn} /> Contribution over reach</span>
        </div>
      </div>
      <div className="founder-orbit" aria-hidden="true"><div className="founder-orbit-core"><Network size={25} color="#b8f276" /></div></div>
    </section>

    <div className="founder-grid">
      {pillars.map(({ icon: Icon, color, eyebrow, title, text }) => (
        <article className="founder-pillar" key={eyebrow}>
          <div className="founder-icon" style={{ color, background: `${color}16`, border: `1px solid ${color}35` }}><Icon size={18} /></div>
          <div className="founder-eyebrow">{eyebrow}</div>
          <h3>{title}</h3>
          <p>{text}</p>
        </article>
      ))}
    </div>

    <div className="founder-two-col">
      <section className="founder-panel">
        <div className="founder-panel-head"><div><SectionLabel>Reality check</SectionLabel><h2>What exists today</h2></div><CheckCircle2 size={20} color={C.accent} /></div>
        <div className="founder-status-list">{nowItems.map(([title, text]) => <div className="founder-status-row" key={title}><span className="founder-dot" /><div><strong>{title}</strong><span>{text}</span></div></div>)}</div>
      </section>
      <section className="founder-panel">
        <div className="founder-panel-head"><div><SectionLabel color={C.info}>The next proof</SectionLabel><h2>Where we are going</h2></div><Rocket size={20} color={C.info} /></div>
        <ul className="founder-next-list">{nextItems.map((item) => <li className="founder-next-item" key={item}><CircleDot size={14} />{item}</li>)}</ul>
      </section>
    </div>

    <section className="founder-panel" style={{ marginTop: 14 }}>
      <div className="founder-panel-head"><div><SectionLabel color={C.warn}>Founder guardrails</SectionLabel><h2>What must stay true</h2></div><Compass size={20} color={C.warn} /></div>
      <div className="founder-risk-grid">{risks.map(([title, text]) => <div className="founder-risk" key={title}><strong>{title}</strong><span>{text}</span></div>)}</div>
      <div className="founder-footer"><span><Sparkles size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} />The simple surface hides the serious machinery.</span><strong>Evidence → decision → outcome</strong></div>
    </section>
  </div>
);

function CrownMark() {
  return <Sparkles size={13} />;
}

export default FounderBriefingSection;
