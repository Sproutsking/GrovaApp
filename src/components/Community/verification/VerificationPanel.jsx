import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, Info, ShieldCheck, Shuffle, Star, X } from "lucide-react";
import { supabase } from "../../../services/config/supabase";
import { challengeIsReady, normalizeVerificationConfig } from "./verificationConfig";

const LETTERS = ["A", "B", "C", "D", "E", "F"];
const shuffle = (cards) => [...cards].sort(() => Math.random() - 0.5).map((card, index) => ({ ...card, letter: LETTERS[index] }));

export default function VerificationPanel({ communityId, userId, onVerified }) {
  const [config, setConfig] = useState(null);
  const [cards, setCards] = useState([]);
  const [targetId, setTargetId] = useState(null);
  const [mode, setMode] = useState("quick");
  const [stage, setStage] = useState("idle");
  const [wrongLetter, setWrongLetter] = useState(null);
  const [openPanel, setOpenPanel] = useState(null);
  const [error, setError] = useState("");
  const timeoutRef = useRef(null);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);
  useEffect(() => {
    let active = true;
    supabase.from("community_tool_settings").select("config").eq("community_id", communityId).eq("tool_type", "verification").maybeSingle().then(({ data }) => {
      if (!active) return;
      const next = normalizeVerificationConfig(data?.config || {});
      setConfig(next);
      setMode(next.mode === "picture" && next.pictureEnabled && challengeIsReady(next) ? "picture" : next.quickEnabled ? "quick" : "picture");
      setCards(shuffle(next.challenge.cards));
      setTargetId(next.challenge.correctId);
    });
    return () => { active = false; };
  }, [communityId]);

  const targetCard = cards.find((card) => card.id === targetId);
  const panels = useMemo(() => config ? [
    { key: "rules", icon: ShieldCheck, color: "#e2555c", ...config.panels.rules },
    { key: "info", icon: Info, color: "#5b7ce0", ...config.panels.info },
    { key: "perks", icon: Star, color: config.accentColor, ...config.panels.perks },
  ] : [], [config]);

  const completeVerification = async (method) => {
    setStage("verifying");
    setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("verify_community_member", { p_community_id: communityId, p_user_id: userId, p_method: method });
      if (rpcError || !data?.success) throw new Error(rpcError?.message || data?.error || "Verification could not be completed.");
      setStage("verified");
      onVerified?.();
    } catch (verifyError) {
      setStage("idle");
      setError(verifyError.message || "Verification could not be completed.");
    }
  };

  const handleQuickVerify = () => {
    if (stage !== "idle") return;
    setStage("checking");
    timeoutRef.current = setTimeout(() => completeVerification("quick"), 650);
  };

  const handlePicturePick = (letter) => {
    if (stage !== "idle") return;
    if (letter === targetCard?.letter) completeVerification("picture");
    else {
      setWrongLetter(letter);
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setWrongLetter(null), 1100);
    }
  };

  if (!config) return <section className="verification-panel"><div className="verification-loading">Loading verification...</div></section>;
  const pictureReady = config.pictureEnabled && challengeIsReady(config);
  const activeMode = mode === "picture" && pictureReady ? "picture" : config.quickEnabled ? "quick" : "picture";

  return (
    <section className="verification-panel" style={{ "--verification-accent": config.accentColor }}>
      <div className="verification-header"><div className="verification-icon"><ShieldCheck size={24} /></div><div><div className="verification-kicker">{config.name}</div><h1>{stage === "verified" ? (activeMode === "picture" ? config.picture.verifiedTitle : config.quick.verifiedTitle) : activeMode === "picture" ? config.picture.idleTitle : config.quick.idleTitle}</h1><p>{stage === "verified" ? (activeMode === "picture" ? config.picture.verifiedDescription : config.quick.verifiedDescription) : config.message}</p></div></div>
      {config.quickEnabled && config.pictureEnabled && pictureReady && stage === "idle" && <div className="verification-mode-tabs"><button type="button" className={activeMode === "quick" ? "selected" : ""} onClick={() => setMode("quick")}>Quick verify</button><button type="button" className={activeMode === "picture" ? "selected" : ""} onClick={() => setMode("picture")}>Picture check</button></div>}
      {stage === "verified" ? <div className="verification-success"><Check size={18} /> Verified. Your community access is being updated.</div> : activeMode === "picture" ? <><p className="verification-instruction">{config.picture.descriptionTemplate.replace("{label}", targetCard?.label || "target")}</p><div className="verification-picture-grid">{cards.map((card) => <div className="verification-picture-card" key={card.id}><img src={card.image} alt="" /><span>{card.letter}</span></div>)}</div><div className="verification-letter-grid">{cards.map((card) => <button type="button" key={card.letter} className={wrongLetter === card.letter ? "wrong" : ""} onClick={() => handlePicturePick(card.letter)}>{card.letter}</button>)}</div>{wrongLetter && <div className="verification-wrong">Not quite - try again.</div>}</> : <div className="verification-actions"><button type="button" className="verification-submit" onClick={handleQuickVerify} disabled={stage !== "idle"}>{stage === "checking" ? "Checking..." : config.quick.buttonLabel}</button></div>}
      {activeMode === "picture" && stage === "idle" && <button type="button" className="verification-shuffle" onClick={() => { setCards(shuffle(config.challenge.cards)); setWrongLetter(null); }}><Shuffle size={14} /> New challenge</button>}
      {error && <div className="verification-error">{error}</div>}
      <div className="verification-info-buttons">{panels.map((panel) => { const PanelIcon = panel.icon; const open = openPanel === panel.key; return <button type="button" key={panel.key} className={open ? "open" : ""} style={{ color: panel.color }} onClick={() => setOpenPanel(open ? null : panel.key)} aria-label={panel.label} title={panel.label}><PanelIcon size={15} /></button>; })}</div>
      {panels.map((panel) => { const PanelIcon = panel.icon; return <div className={`verification-info-panel${openPanel === panel.key ? " open" : ""}`} key={panel.key}><PanelIcon size={15} color={panel.color} /><span>{panel.text}</span><button type="button" onClick={() => setOpenPanel(null)} aria-label="Close"><X size={13} /></button></div>; })}
      <style>{`.verification-panel{max-width:760px;margin:26px auto;padding:24px;border:1px solid color-mix(in srgb,var(--verification-accent) 35%,transparent);border-radius:20px;background:linear-gradient(145deg,rgba(20,31,21,.96),rgba(8,13,10,.98));color:#f3faef;box-shadow:0 20px 60px rgba(0,0,0,.3)}.verification-header{display:flex;gap:14px;align-items:flex-start}.verification-icon{width:48px;height:48px;border-radius:15px;display:flex;align-items:center;justify-content:center;color:var(--verification-accent);background:color-mix(in srgb,var(--verification-accent) 14%,transparent);border:1px solid color-mix(in srgb,var(--verification-accent) 45%,transparent);flex-shrink:0}.verification-kicker{font-size:10px;color:var(--verification-accent);text-transform:uppercase;letter-spacing:.12em;font-weight:800}.verification-panel h1{margin:3px 0;font-size:23px}.verification-panel p{margin:0;color:#94a794;font-size:12px;line-height:1.5}.verification-mode-tabs{display:flex;gap:6px;margin-top:20px}.verification-mode-tabs button,.verification-shuffle{padding:7px 10px;border:1px solid rgba(255,255,255,.1);border-radius:7px;background:transparent;color:#94a794;cursor:pointer}.verification-mode-tabs button.selected{color:var(--verification-accent);border-color:var(--verification-accent);background:rgba(156,255,0,.08)}.verification-actions{display:flex;margin-top:22px}.verification-submit{padding:13px 20px;border:0;border-radius:11px;background:var(--verification-accent);color:#071000;font-weight:800;cursor:pointer}.verification-submit:disabled{opacity:.5}.verification-picture-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}.verification-picture-card{position:relative;aspect-ratio:1;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,.1)}.verification-picture-card img{width:100%;height:100%;object-fit:cover}.verification-picture-card span{position:absolute;top:5px;right:5px;padding:3px 5px;border-radius:4px;background:rgba(0,0,0,.6);font-size:10px;font-weight:800}.verification-letter-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:7px;margin-top:10px}.verification-letter-grid button{height:32px;border:1px solid rgba(255,255,255,.1);border-radius:6px;background:transparent;color:#c8d4c8;font-weight:800;cursor:pointer}.verification-letter-grid button:hover{border-color:var(--verification-accent)}.verification-letter-grid button.wrong{border-color:#e2555c;color:#e2555c}.verification-instruction{margin-top:14px!important}.verification-wrong{margin-top:8px;color:#e2555c;font-size:11px}.verification-shuffle{display:inline-flex;align-items:center;gap:5px;margin-top:10px}.verification-success{display:flex;align-items:center;gap:8px;margin-top:20px;padding:12px;border-radius:10px;background:rgba(63,185,111,.12);color:#b8f0c8;font-size:12px}.verification-error{margin-top:12px;padding:10px;border-radius:9px;color:#ffaaa3;background:rgba(255,75,65,.1);font-size:11px}.verification-info-buttons{display:flex;gap:8px;margin-top:18px}.verification-info-buttons button{width:32px;height:32px;border:1px solid rgba(255,255,255,.1);border-radius:6px;background:transparent;cursor:pointer}.verification-info-buttons button.open{border-color:currentColor}.verification-info-panel{display:none;align-items:flex-start;gap:8px;margin-top:10px;padding:10px;border:1px solid rgba(255,255,255,.1);border-radius:7px;color:#94a794;font-size:11px}.verification-info-panel.open{display:flex}.verification-info-panel span{flex:1}.verification-info-panel button{border:0;background:transparent;color:#94a794;cursor:pointer}@media(max-width:600px){.verification-panel{margin:14px;padding:16px}}`}</style>
    </section>
  );
}
