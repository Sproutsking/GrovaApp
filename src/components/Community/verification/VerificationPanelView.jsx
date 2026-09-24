import React, { useEffect, useRef, useState } from "react";
import { BadgeCheck, Check, Fingerprint, Info, Lock, ScanFace, Shuffle, ShieldCheck, Star, X } from "lucide-react";
import { DEFAULT_VERIFICATION_CONFIG, METHOD_META, METHOD_ORDER } from "./verificationConfig";

const ICONS = { shield: ShieldCheck, lock: Lock, badge: BadgeCheck, fingerprint: Fingerprint, scan: ScanFace };
const INFO = { rules: { Icon: ShieldCheck, color: "#e2555c" }, info: { Icon: Info, color: "#5b7ce0" }, perks: { Icon: Star, color: null } };
const LETTERS = "ABCDEFGHIJKL".split("");
const shuffled = (list) => { const a = [...list]; for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function Reward({ m }) {
  if (!m.roleName) return null;
  return <span className="vp-reward"><i style={{ background: m.roleColor || "var(--a)" }} />Unlocks <b>{m.roleIcon} {m.roleName}</b></span>;
}

function RulesBody({ m, locked, busy, onSubmit }) {
  const boxRef = useRef(null);
  const [scrolled, setScrolled] = useState(!m.requireScroll);
  const [each, setEach] = useState({});
  const [agree, setAgree] = useState(false);
  useEffect(() => {
    const el = boxRef.current;
    if (el && (!m.requireScroll || el.scrollHeight <= el.clientHeight + 4)) setScrolled(true);
  }, [m.requireScroll, m.items.length]);
  const eachOk = !m.requireEachRule || m.items.every((item) => each[item.id]);
  const can = scrolled && eachOk && agree && !busy && !locked;
  return (
    <div className="vp-body">
      <h2>{m.title}</h2><p className="vp-desc">{m.description}</p>
      <div className="vp-rules" ref={boxRef} onScroll={(e) => { const el = e.currentTarget; if (el.scrollTop + el.clientHeight >= el.scrollHeight - 6) setScrolled(true); }}>
        {m.items.map((item, i) => (
          <div className="vp-rule" key={item.id}>
            <span className="vp-rule-n">{String(i + 1).padStart(2, "0")}</span>
            <div><strong>{item.title}</strong>{item.body && <p>{item.body}</p>}</div>
            {m.requireEachRule && <input type="checkbox" aria-label={`Accept ${item.title}`} checked={!!each[item.id]} disabled={locked} onChange={(e) => setEach((c) => ({ ...c, [item.id]: e.target.checked }))} />}
          </div>
        ))}
      </div>
      {m.requireScroll && !scrolled && <p className="vp-hint">Scroll to the end of the rules to continue.</p>}
      <label className="vp-agree"><input type="checkbox" checked={agree} disabled={!scrolled || !eachOk || locked} onChange={(e) => setAgree(e.target.checked)} />{m.acceptLabel}</label>
      <button type="button" className="vp-btn" disabled={!can} onClick={() => onSubmit({ accepted: true })}>{busy ? "Verifying…" : m.buttonLabel}</button>
    </div>
  );
}

function QuickBody({ m, locked, busy, onSubmit }) {
  const reqs = [m.minAccountAgeDays > 0 && `Account older than ${m.minAccountAgeDays} day${m.minAccountAgeDays > 1 ? "s" : ""}`, m.requireAvatar && "Profile picture added", m.requireProfileVerified && "Verified profile"].filter(Boolean);
  return (
    <div className="vp-body">
      <h2>{m.title}</h2><p className="vp-desc">{m.description}</p>
      {reqs.length > 0 && <div className="vp-reqs">{reqs.map((r) => <span key={r}><Check size={10} />{r}</span>)}</div>}
      <button type="button" className="vp-btn" disabled={busy || locked} onClick={() => onSubmit({})}>{busy ? "Checking…" : m.buttonLabel}</button>
    </div>
  );
}

function PictureBody({ m, locked, busy, onSubmit }) {
  const sig = m.cards.map((c) => c.id).join("|");
  const [order, setOrder] = useState(() => shuffled(m.cards));
  const [wrong, setWrong] = useState(null);
  useEffect(() => { setOrder(shuffled(m.cards)); setWrong(null); }, [sig]);
  const pick = async (card) => {
    if (busy || locked) return;
    const res = await onSubmit({ answer: card.id });
    if (res && !res.success) { setWrong(card.id); setTimeout(() => setWrong(null), 900); }
  };
  return (
    <div className="vp-body">
      <h2>{m.title}</h2>
      <p className="vp-desc">{(m.instruction || "").replace("{label}", m.targetLabel || "target")}</p>
      <div className="vp-grid">{order.map((card, i) => (
        <button type="button" key={card.id} className={`vp-card${wrong === card.id ? " wrong" : ""}`} onClick={() => pick(card)} disabled={busy || locked}>
          <img src={card.image} alt="" /><span>{LETTERS[i]}</span>
        </button>))}
      </div>
      <div className="vp-letters">{order.map((card, i) => <button type="button" key={card.id} className={wrong === card.id ? "wrong" : ""} onClick={() => pick(card)} disabled={busy || locked}>{LETTERS[i]}</button>)}</div>
      <button type="button" className="vp-link" onClick={() => setOrder(shuffled(m.cards))}><Shuffle size={12} /> New challenge</button>
    </div>
  );
}

export default function VerificationPanelView({ panel, state = {}, busy = false, onComplete, focusMethod = null }) {
  const completed = state.completed || [];
  const cfg = { ...DEFAULT_VERIFICATION_CONFIG.panel, ...(panel?.panel || {}) };
  const ready = METHOD_ORDER.filter((id) => panel?.methods?.[id]?.ready);
  const [active, setActive] = useState(null);
  const [errors, setErrors] = useState({});
  const [openInfo, setOpenInfo] = useState(null);
  useEffect(() => { setActive(null); }, [focusMethod]);

  const current = (active && ready.includes(active) && active) || (focusMethod && ready.includes(focusMethod) && focusMethod) || ready.find((id) => !completed.includes(id)) || ready[0];
  const Icon = ICONS[panel?.icon] || ShieldCheck;
  const accent = panel?.accentColor || "#9cff00";
  const infoPanels = Object.entries(panel?.panels || {}).filter(([, p]) => p.enabled !== false && p.text);
  const doneCount = ready.filter((id) => completed.includes(id)).length;

  const run = async (id, payload) => {
    setErrors((e) => ({ ...e, [id]: null }));
    const res = await onComplete?.(id, payload);
    if (res && !res.success) setErrors((e) => ({ ...e, [id]: res.error || "Could not verify." }));
    return res;
  };

  const renderMethod = (id) => {
    const m = panel.methods[id];
    if (completed.includes(id)) {
      return <div className="vp-success" key={id}><span><Check size={18} /></span><div><h2>{m.successTitle}</h2><p>{m.successDescription}</p><Reward m={m} /></div></div>;
    }
    const missing = (m.requires || []).filter((r) => ready.includes(r) && !completed.includes(r));
    const until = state.locks?.[id];
    const timeLocked = until && new Date(until) > new Date();
    const locked = missing.length > 0 || Boolean(timeLocked);
    const props = { m, locked, busy, onSubmit: (payload) => run(id, payload) };
    return (
      <div className="vp-method" key={id}>
        {missing.length > 0 && <div className="vp-lock"><Lock size={12} />Complete {missing.map((x) => METHOD_META[x].label).join(" and ")} first.</div>}
        {timeLocked && <div className="vp-lock"><Lock size={12} />Locked until {new Date(until).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.</div>}
        {id === "rules" ? <RulesBody {...props} /> : id === "quick" ? <QuickBody {...props} /> : <PictureBody {...props} />}
        {cfg.showReward && <Reward m={m} />}
        {errors[id] && <div className="vp-err">{errors[id]}</div>}
      </div>
    );
  };

  return (
    <section className={`vp vp-${cfg.corners} vp-${cfg.cardStyle} vp-${cfg.density}`} style={{ "--a": accent }}>
      <header className="vp-head">
        <div className="vp-icon"><Icon size={22} /></div>
        <div><div className="vp-kicker">{panel?.name}{cfg.badgeText && <em>{cfg.badgeText}</em>}</div><h1>{panel?.name}</h1><p>{panel?.message}</p></div>
      </header>

      {!ready.length ? <p className="vp-empty">Verification hasn't been set up yet. Check back soon.</p> : (
        <>
          {cfg.showProgress && ready.length > 1 && <div className="vp-progress"><div><i style={{ width: `${(doneCount / ready.length) * 100}%` }} /></div><span>{doneCount} of {ready.length} complete</span></div>}
          {ready.length > 1 && cfg.layout === "tabs" && (
            <div className="vp-tabs">{ready.map((id) => <button type="button" key={id} className={id === current ? "on" : ""} onClick={() => setActive(id)}>{completed.includes(id) && <Check size={11} />}{METHOD_META[id].label}</button>)}</div>
          )}
          {cfg.layout === "stack" ? ready.map(renderMethod) : renderMethod(current)}
        </>
      )}

      {infoPanels.length > 0 && (
        <div className="vp-info-row">{infoPanels.map(([key, p]) => { const { Icon: I, color } = INFO[key] || INFO.info; return <button type="button" key={key} title={p.label} aria-label={p.label} className={openInfo === key ? "on" : ""} style={{ color: color || accent }} onClick={() => setOpenInfo(openInfo === key ? null : key)}><I size={14} /></button>; })}</div>
      )}
      {infoPanels.map(([key, p]) => openInfo === key && <div className="vp-info" key={key}><b>{p.label}</b><span>{p.text}</span><button type="button" aria-label="Close" onClick={() => setOpenInfo(null)}><X size={12} /></button></div>)}
      {cfg.footerText && <footer className="vp-foot">{cfg.footerText}</footer>}

      <style>{`.vp{--r:16px;--gap:14px;--card-bg:rgba(255,255,255,.04);--card-bd:rgba(255,255,255,.1);width:min(100%,620px);margin:14px auto;padding:20px;box-sizing:border-box;border:1px solid color-mix(in srgb,var(--a) 32%,transparent);border-radius:var(--r);background:linear-gradient(150deg,rgba(20,29,22,.97),rgba(8,12,10,.98));color:#eef6ec;box-shadow:0 18px 50px rgba(0,0,0,.35)}.vp-sharp{--r:4px}.vp-pill{--r:28px}.vp-compact{--gap:9px;padding:14px}.vp-solid{--card-bg:#141a15;--card-bd:#1f2a21}.vp-outline{--card-bg:transparent;--card-bd:color-mix(in srgb,var(--a) 45%,transparent)}.vp *{box-sizing:border-box}.vp-head{display:flex;gap:12px;align-items:flex-start;margin-bottom:var(--gap)}.vp-icon{width:44px;height:44px;flex-shrink:0;display:grid;place-items:center;border-radius:calc(var(--r)*.7);color:var(--a);background:color-mix(in srgb,var(--a) 14%,transparent);border:1px solid color-mix(in srgb,var(--a) 45%,transparent)}.vp-kicker{display:flex;gap:6px;align-items:center;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--a)}.vp-kicker em{font-style:normal;padding:2px 6px;border-radius:99px;background:color-mix(in srgb,var(--a) 20%,transparent)}.vp h1{margin:3px 0;font-size:21px}.vp-head p,.vp-desc{margin:0;color:#98ab98;font-size:12px;line-height:1.55}.vp h2{margin:0 0 5px;font-size:16px}.vp-empty{color:#98ab98;font-size:12px}.vp-progress{display:flex;align-items:center;gap:9px;margin-bottom:var(--gap)}.vp-progress>div{flex:1;height:5px;border-radius:9px;background:rgba(255,255,255,.08);overflow:hidden}.vp-progress i{display:block;height:100%;background:var(--a);transition:width .3s}.vp-progress span{font-size:10px;color:#98ab98}.vp-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:var(--gap)}.vp-tabs button{display:inline-flex;align-items:center;gap:5px;padding:7px 11px;border:1px solid var(--card-bd);border-radius:calc(var(--r)*.6);background:transparent;color:#98ab98;font:700 11px inherit;cursor:pointer}.vp-tabs button.on{color:var(--a);border-color:var(--a);background:color-mix(in srgb,var(--a) 10%,transparent)}.vp-method{margin-bottom:var(--gap);padding:var(--gap);border:1px solid var(--card-bd);border-radius:calc(var(--r)*.8);background:var(--card-bg)}.vp-body{display:flex;flex-direction:column;gap:9px}.vp-rules{max-height:250px;overflow-y:auto;display:flex;flex-direction:column;gap:7px;padding:2px}.vp-rule{display:flex;gap:10px;align-items:flex-start;padding:9px;border-radius:calc(var(--r)*.5);background:rgba(0,0,0,.2)}.vp-rule>div{flex:1}.vp-rule-n{font:800 11px monospace;color:var(--a)}.vp-rule strong{font-size:12px}.vp-rule p{margin:3px 0 0;color:#98ab98;font-size:11px;line-height:1.5}.vp-hint{margin:0;color:#e2b04a;font-size:10px}.vp-agree{display:flex;gap:8px;align-items:flex-start;font-size:11px;color:#c8d6c8;line-height:1.45}.vp-btn{align-self:flex-start;padding:10px 20px;border:0;border-radius:calc(var(--r)*.6);background:var(--a);color:#071000;font:900 12px inherit;cursor:pointer}.vp-btn:disabled{opacity:.4;cursor:not-allowed}.vp-reqs{display:flex;flex-wrap:wrap;gap:5px}.vp-reqs span{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:99px;background:rgba(255,255,255,.06);color:#c8d6c8;font-size:10px}.vp-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.vp-card{position:relative;aspect-ratio:1;padding:0;overflow:hidden;border:1px solid var(--card-bd);border-radius:calc(var(--r)*.5);background:#000;cursor:pointer}.vp-card img{width:100%;height:100%;object-fit:cover}.vp-card span{position:absolute;top:5px;right:5px;padding:2px 6px;border-radius:5px;background:rgba(0,0,0,.65);font:800 10px inherit;color:#fff}.vp-card.wrong{border-color:#e2555c;animation:vpShake .35s}@keyframes vpShake{25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}.vp-letters{display:grid;grid-template-columns:repeat(auto-fit,minmax(34px,1fr));gap:6px}.vp-letters button{height:32px;border:1px solid var(--card-bd);border-radius:calc(var(--r)*.4);background:transparent;color:#c8d6c8;font-weight:800;cursor:pointer}.vp-letters button:hover:not(:disabled){border-color:var(--a)}.vp-letters button.wrong{border-color:#e2555c;color:#e2555c}.vp-link{align-self:flex-start;display:inline-flex;gap:5px;align-items:center;border:0;background:none;color:#98ab98;font-size:11px;cursor:pointer}.vp-reward{display:inline-flex;align-items:center;gap:6px;margin-top:9px;padding:4px 10px;border-radius:99px;background:rgba(255,255,255,.06);font-size:10px;color:#98ab98}.vp-reward i{width:8px;height:8px;border-radius:50%}.vp-reward b{color:#eef6ec}.vp-lock{display:flex;align-items:center;gap:6px;margin-bottom:9px;padding:8px 10px;border-radius:calc(var(--r)*.5);background:rgba(226,176,74,.1);color:#e2b04a;font-size:11px}.vp-err{margin-top:9px;padding:9px 10px;border-radius:calc(var(--r)*.5);background:rgba(255,75,65,.1);color:#ffaaa3;font-size:11px}.vp-success{display:flex;gap:12px;align-items:flex-start;margin-bottom:var(--gap);padding:var(--gap);border-radius:calc(var(--r)*.8);background:rgba(63,185,111,.12);border:1px solid rgba(63,185,111,.35)}.vp-success>span{width:34px;height:34px;flex-shrink:0;display:grid;place-items:center;border-radius:50%;background:rgba(63,185,111,.25);color:#7ff0a8}.vp-success p{margin:0;color:#b8f0c8;font-size:12px}.vp-info-row{display:flex;gap:7px}.vp-info-row button{width:30px;height:30px;display:grid;place-items:center;border:1px solid var(--card-bd);border-radius:calc(var(--r)*.5);background:transparent;cursor:pointer}.vp-info-row button.on{border-color:currentColor}.vp-info{display:flex;gap:8px;align-items:flex-start;margin-top:8px;padding:10px;border:1px solid var(--card-bd);border-radius:calc(var(--r)*.5);font-size:11px;color:#98ab98}.vp-info span{flex:1}.vp-info b{color:#eef6ec}.vp-info button{border:0;background:none;color:#98ab98;cursor:pointer}.vp-foot{margin-top:var(--gap);font-size:10px;color:#6c7f6d;text-align:center}@media(max-width:520px){.vp{margin:8px;padding:14px}}`}</style>
    </section>
  );
}
