import React, { useState } from "react";
import {
  AlertTriangle, BadgeCheck, Clock3, FileCheck2, FileText, LockKeyhole,
  RefreshCw, ShieldCheck, WifiOff,
} from "lucide-react";
import { XRD_PROTOTYPE_FIXTURES, XRD_PROTOTYPE_FIXTURE_ORDER } from "./xrdPrototypeFixtures";

const FIXTURE_ICONS = {
  verified: BadgeCheck,
  disputed: AlertTriangle,
  expired: Clock3,
  revoked: ShieldCheck,
  unavailable: WifiOff,
  restricted: LockKeyhole,
  empty: FileText,
  loading: RefreshCw,
  error: AlertTriangle,
};

const XRDPrototypePreview = () => {
  const [activeFixture, setActiveFixture] = useState("verified");
  const fixture = XRD_PROTOTYPE_FIXTURES[activeFixture];
  const Icon = FIXTURE_ICONS[activeFixture];

  return (
    <section className="xrd-fixture-preview" aria-labelledby="xrd-fixture-title">
      <style>{`
        .xrd-fixture-preview{position:relative;overflow:hidden;margin:18px 0 4px;padding:18px;border:1px solid rgba(163,230,53,.28);border-radius:16px;background:radial-gradient(ellipse at 92% 0,rgba(16,185,129,.08),transparent 40%),linear-gradient(180deg,#080b08,#030403)}
        .xrd-fixture-preview:before{position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(rgba(163,230,53,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(163,230,53,.025) 1px,transparent 1px);background-size:22px 22px;content:""}
        .xrd-fixture-preview>*{position:relative}
        .xrd-fixture-heading{display:flex;align-items:flex-start;gap:12px;margin-bottom:15px}
        .xrd-fixture-mark{width:38px;height:38px;display:grid;place-items:center;flex:none;border:1px solid rgba(163,230,53,.28);border-radius:11px;background:rgba(163,230,53,.07);color:#bef264}
        .xrd-fixture-heading h3{margin:0;color:#edf2e8;font-size:15px;font-weight:800}
        .xrd-fixture-heading p{margin:4px 0 0;color:#8c9686;font-size:11px;line-height:1.5}
        .xrd-fixture-label{margin-left:auto;padding:5px 8px;border:1px solid rgba(251,191,36,.25);border-radius:7px;background:rgba(251,191,36,.06);color:#fcd34d;font:700 9px/1.2 ui-monospace,monospace;letter-spacing:.08em;white-space:nowrap}
        .xrd-fixture-tabs{display:flex;gap:6px;overflow-x:auto;margin:0 -2px 13px;padding:2px 2px 7px;scrollbar-width:thin}
        .xrd-fixture-tabs button{min-height:31px;flex:none;padding:0 10px;border:1px solid #252b24;border-radius:8px;background:#050705;color:#969f92;font:650 10px/1 inherit;cursor:pointer;transition:border-color .15s,background .15s,color .15s}
        .xrd-fixture-tabs button:hover{border-color:rgba(163,230,53,.42);color:#eaf3e3}
        .xrd-fixture-tabs button[aria-selected="true"]{border-color:rgba(163,230,53,.55);background:rgba(163,230,53,.09);color:#d9f99d}
        .xrd-fixture-card{display:grid;grid-template-columns:38px minmax(0,1fr);gap:12px;padding:15px;border:1px solid #252b24;border-radius:12px;background:rgba(0,0,0,.62)}
        .xrd-fixture-card.tone-verified{border-color:rgba(163,230,53,.28)}.xrd-fixture-card.tone-disputed,.xrd-fixture-card.tone-expired{border-color:rgba(251,191,36,.24)}.xrd-fixture-card.tone-revoked,.xrd-fixture-card.tone-error{border-color:rgba(248,113,113,.25)}.xrd-fixture-card.tone-unavailable{border-color:rgba(96,165,250,.24)}.xrd-fixture-card.tone-restricted{border-style:dashed;border-color:rgba(196,181,253,.28)}
        .xrd-fixture-icon{width:36px;height:36px;display:grid;place-items:center;border:1px solid #30372d;border-radius:10px;background:#090c08;color:#a3e635}
        .tone-verified .xrd-fixture-icon{color:#a3e635}.tone-disputed .xrd-fixture-icon,.tone-expired .xrd-fixture-icon{color:#fbbf24}.tone-revoked .xrd-fixture-icon,.tone-error .xrd-fixture-icon{color:#f87171}.tone-unavailable .xrd-fixture-icon{color:#60a5fa}.tone-restricted .xrd-fixture-icon{color:#c4b5fd}
        .xrd-fixture-main{min-width:0}.xrd-fixture-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
        .xrd-fixture-title{margin:0;color:#f0f3ed;font-size:14px;font-weight:780;line-height:1.35}
        .xrd-fixture-type{display:block;margin-top:3px;color:#778174;font:600 9px/1.4 ui-monospace,monospace;letter-spacing:.07em;text-transform:uppercase}
        .xrd-fixture-status{flex:none;padding:4px 7px;border:1px solid #30372d;border-radius:99px;color:#c5cec0;background:#0a0c09;font:700 9px/1.2 ui-monospace,monospace}
        .tone-verified .xrd-fixture-status{border-color:rgba(163,230,53,.3);color:#bef264}.tone-disputed .xrd-fixture-status,.tone-expired .xrd-fixture-status{border-color:rgba(251,191,36,.28);color:#fcd34d}.tone-revoked .xrd-fixture-status,.tone-error .xrd-fixture-status{border-color:rgba(248,113,113,.28);color:#fca5a5}.tone-unavailable .xrd-fixture-status{border-color:rgba(96,165,250,.28);color:#93c5fd}.tone-restricted .xrd-fixture-status{border-color:rgba(196,181,253,.28);color:#c4b5fd}
        .xrd-fixture-claim{margin:11px 0 13px;color:#d0d7ca;font-size:12px;line-height:1.6}
        .xrd-fixture-meta{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin:0 0 12px}
        .xrd-fixture-meta div{min-width:0;padding:8px;border:1px solid #1e241d;border-radius:8px;background:#050705}
        .xrd-fixture-meta small{display:block;margin-bottom:4px;color:#778174;font:600 8px/1.3 ui-monospace,monospace;letter-spacing:.06em;text-transform:uppercase}
        .xrd-fixture-meta strong{display:block;overflow-wrap:anywhere;color:#d7dfd1;font-size:10px;font-weight:650;line-height:1.4}
        .xrd-fixture-evidence{display:flex;align-items:center;gap:7px;margin-bottom:10px;color:#b9c3b4;font-size:10px}.xrd-fixture-evidence svg{flex:none;color:#a3e635}
        .xrd-fixture-note{margin:0;padding:9px 10px;border-left:2px solid #50594b;background:rgba(255,255,255,.018);color:#929c8c;font-size:10px;line-height:1.55}
        .tone-disputed .xrd-fixture-note,.tone-expired .xrd-fixture-note{border-color:#fbbf24}.tone-revoked .xrd-fixture-note,.tone-error .xrd-fixture-note{border-color:#f87171}.tone-unavailable .xrd-fixture-note{border-color:#60a5fa}.tone-restricted .xrd-fixture-note{border-color:#c4b5fd}
        .xrd-fixture-chain{display:grid;gap:0;margin-top:12px}.xrd-fixture-chain-row{position:relative;display:grid;grid-template-columns:14px minmax(0,1fr);gap:8px;min-height:25px;color:#a8b2a1;font-size:9px;line-height:1.4}.xrd-fixture-chain-row:not(:last-child):before{position:absolute;top:11px;bottom:-3px;left:5px;width:1px;background:linear-gradient(#55634b,#262b24);content:""}.xrd-fixture-chain-row i{z-index:1;width:11px;height:11px;margin-top:1px;border:2px solid #a3e635;border-radius:50%;background:#050705;box-shadow:0 0 8px rgba(163,230,53,.18)}
        .xrd-fixture-empty,.xrd-fixture-loading,.xrd-fixture-error{grid-column:1/-1;display:grid;justify-items:center;gap:9px;min-height:150px;align-content:center;text-align:center}
        .xrd-fixture-empty svg,.xrd-fixture-loading svg,.xrd-fixture-error svg{color:#929b8d}.xrd-fixture-empty strong,.xrd-fixture-loading strong,.xrd-fixture-error strong{color:#e6ece2;font-size:13px}.xrd-fixture-empty p,.xrd-fixture-loading p,.xrd-fixture-error p{max-width:38ch;margin:0;color:#858f80;font-size:10px;line-height:1.5}
        .xrd-fixture-loading svg{animation:xrdFixtureSpin 1s linear infinite;color:#a3e635}@keyframes xrdFixtureSpin{to{transform:rotate(360deg)}}
        .xrd-fixture-error button{display:inline-flex;align-items:center;gap:6px;padding:7px 10px;border:1px solid rgba(248,113,113,.28);border-radius:8px;background:rgba(248,113,113,.06);color:#fca5a5;font:650 10px inherit;cursor:pointer}
        @media(max-width:620px){.xrd-fixture-preview{padding:13px}.xrd-fixture-label{font-size:8px}.xrd-fixture-meta{grid-template-columns:1fr 1fr}.xrd-fixture-meta div:last-child{grid-column:1/-1}.xrd-fixture-top{flex-direction:column}.xrd-fixture-status{align-self:flex-start}}
        @media(prefers-reduced-motion:reduce){.xrd-fixture-tabs button,.xrd-fixture-loading svg{transition:none;animation:none}}
      `}</style>
      <div className="xrd-fixture-heading">
        <span className="xrd-fixture-mark"><FileCheck2 size={17} /></span>
        <div>
          <h3 id="xrd-fixture-title">Record state preview</h3>
          <p>Prototype-shaped examples for the XRD record, evidence, and provenance views.</p>
        </div>
        <span className="xrd-fixture-label">EXAMPLE DATA</span>
      </div>
      <div className="xrd-fixture-tabs" role="tablist" aria-label="Preview XRD record states">
        {XRD_PROTOTYPE_FIXTURE_ORDER.map((key) => (
          <button
            type="button"
            role="tab"
            id={`xrd-fixture-tab-${key}`}
            aria-selected={activeFixture === key}
            aria-controls="xrd-fixture-panel"
            key={key}
            onClick={() => setActiveFixture(key)}
          >
            {XRD_PROTOTYPE_FIXTURES[key].label}
          </button>
        ))}
      </div>
      <div
        className={`xrd-fixture-card tone-${fixture.tone}`}
        id="xrd-fixture-panel"
        role="tabpanel"
        aria-labelledby={`xrd-fixture-tab-${activeFixture}`}
        data-fixture-state={activeFixture}
      >
        {activeFixture === "empty" ? (
          <div className="xrd-fixture-empty">
            <Icon size={22} />
            <strong>No XRD records yet</strong>
            <p>Connect a permitted source or add a self-authored claim. Empty is a real state, not a verification failure.</p>
          </div>
        ) : activeFixture === "loading" ? (
          <div className="xrd-fixture-loading" role="status">
            <Icon size={22} />
            <strong>Checking the registered source</strong>
            <p>Keep existing evidence visible and identify the source currently being checked.</p>
          </div>
        ) : activeFixture === "error" ? (
          <div className="xrd-fixture-error" role="alert">
            <Icon size={22} />
            <strong>Records could not be loaded</strong>
            <p>The connection failed before a source result was received. Do not mark the claim as mismatched.</p>
            <button type="button" onClick={() => setActiveFixture("loading")}><RefreshCw size={12} />Preview retry</button>
          </div>
        ) : (
          <>
            <div className="xrd-fixture-icon"><Icon size={17} /></div>
            <div className="xrd-fixture-main">
              <div className="xrd-fixture-top">
                <div><h4 className="xrd-fixture-title">{fixture.title}</h4><span className="xrd-fixture-type">{fixture.category}</span></div>
                <span className="xrd-fixture-status">{fixture.label.toUpperCase()}</span>
              </div>
              {fixture.claim && <p className="xrd-fixture-claim">{activeFixture === "restricted" ? "Claim content is hidden by the owner's access policy." : fixture.claim}</p>}
              <div className="xrd-fixture-meta">
                <div><small>Source</small><strong>{fixture.source}</strong></div>
                <div><small>Authority</small><strong>{fixture.authority}</strong></div>
                <div><small>Last check</small><strong>{fixture.checked}</strong></div>
                <div><small>Assessment</small><strong>{fixture.confidence}</strong></div>
                <div><small>Evidence</small><strong>{fixture.evidence}</strong></div>
              </div>
              <p className="xrd-fixture-note">{fixture.note}</p>
              <div className="xrd-fixture-chain" aria-label="Example provenance path">
                {fixture.chain.map((step) => <div className="xrd-fixture-chain-row" key={step}><i aria-hidden="true" /><span>{step}</span></div>)}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default XRDPrototypePreview;