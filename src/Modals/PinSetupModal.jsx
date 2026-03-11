// src/components/Modals/PinSetupModal.jsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import { Lock, X, CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react";
import { supabase } from "../../services/config/supabase";

const PIN_OPTS = [
  { n: 4,  label: "Basic",    bars: 1 },
  { n: 6,  label: "Standard", bars: 2 },
  { n: 8,  label: "Strong",   bars: 3 },
  { n: 12, label: "Max",      bars: 4 },
];

export default function PinSetupModal({ userId, hasPin, currentPinLength, onClose, onSuccess }) {
  const [step, setStep]   = useState("choose");
  const [len, setLen]     = useState(currentPinLength || 6);
  const [phase, setPhase] = useState(hasPin ? "old" : "new");
  const [vals, setVals]   = useState({ old: [], new: [], confirm: [] });
  const [show, setShow]   = useState(false);
  const [err, setErr]     = useState("");
  const [busy, setBusy]   = useState(false);
  const [done, setDone]   = useState(false);
  const [shake, setShake] = useState(false);
  const hidRef            = useRef(null);

  const cur    = vals[phase] || [];
  const target = phase === "old" ? (currentPinLength || len) : len;
  const steps  = hasPin ? 3 : 2;
  const stepN  = phase === "old" ? 1 : phase === "new" ? (hasPin ? 2 : 1) : (hasPin ? 3 : 2);

  useEffect(() => { if (step === "enter") hidRef.current?.focus(); }, [step, phase]);

  const setCur   = (v) => setVals(p => ({ ...p, [phase]: v }));
  const doShake  = () => { setShake(true); setTimeout(() => setShake(false), 500); };

  const advance = useCallback(async (arr) => {
    if (phase === "old")    { setPhase("new");    return; }
    if (phase === "new")    { setPhase("confirm"); return; }
    const newStr = vals.new.join(""), cfm = arr.join("");
    if (newStr !== cfm) {
      setErr("PINs don't match"); doShake();
      setVals(p => ({ ...p, new: [], confirm: [] })); setPhase("new"); return;
    }
    try {
      setBusy(true);
      if (hasPin && vals.old.length) {
        const { data: w } = await supabase.from("wallets").select("withdrawal_pin_hash").eq("user_id", userId).maybeSingle();
        if (w?.withdrawal_pin_hash && w.withdrawal_pin_hash !== btoa(vals.old.join("") + userId)) {
          setErr("Current PIN incorrect"); doShake();
          setVals(p => ({ ...p, old: [] })); setPhase("old"); setBusy(false); return;
        }
      }
      const { error: e } = await supabase.from("wallets").update({
        withdrawal_pin_hash: btoa(newStr + userId), pin_length: len, pin_attempts: 0, pin_locked_until: null,
      }).eq("user_id", userId);
      if (e) throw e;
      await supabase.from("security_events").insert({ user_id: userId, event_type: "withdrawal_pin_set", severity: "info", metadata: { pin_length: len } }).catch(() => {});
      setDone(true);
      setTimeout(() => { onSuccess?.({ pinLength: len }); onClose(); }, 1100);
    } catch (ex) { setErr(ex.message || "Save failed"); } finally { setBusy(false); }
  }, [phase, vals, len, hasPin, userId, onSuccess, onClose]);

  const push = (d) => {
    if (cur.length >= target || busy || done) return;
    const next = [...cur, d]; setCur(next); setErr("");
    if (next.length === target) setTimeout(() => advance(next), 90);
  };
  const pop = () => { if (busy || done) return; setCur(cur.slice(0, -1)); setErr(""); };

  const phL = { old: "Current PIN", new: `New ${len}-digit PIN`, confirm: "Confirm PIN" }[phase];
  const phS = { old: "Verify identity", new: "Choose carefully", confirm: "Re-enter to confirm" }[phase];

  if (step === "choose") return (
    <Wrap onClose={onClose}>
      <Card>
        <Hdr title={hasPin ? "Change PIN" : "Set Transaction PIN"} sub="Choose digit count" onClose={onClose} />
        <div style={{ padding: "14px 16px 16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12 }}>
            {PIN_OPTS.map(({ n, label, bars }) => (
              <button key={n} onClick={() => setLen(n)} style={{
                padding: "11px 8px", borderRadius: 11, cursor: "pointer", textAlign: "center",
                background: len === n ? "rgba(132,204,22,.1)" : "rgba(255,255,255,.03)",
                border: `1.5px solid ${len === n ? "#84cc16" : "rgba(255,255,255,.06)"}`,
                transition: "all .15s",
              }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: len === n ? "#84cc16" : "#d4d4d4", lineHeight: 1 }}>{n}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: len === n ? "#84cc16" : "#505050", marginTop: 2 }}>{label}</div>
                <div style={{ display: "flex", gap: 2, justifyContent: "center", marginTop: 4 }}>
                  {[1,2,3,4].map(i => <div key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: i <= bars && len === n ? "#84cc16" : i <= bars ? "#2a2a2a" : "#161616" }} />)}
                </div>
              </button>
            ))}
          </div>
          <PBtn onClick={() => { setStep("enter"); setPhase(hasPin ? "old" : "new"); }}>
            <Lock size={12} /> Continue with {len}-digit PIN
          </PBtn>
        </div>
      </Card>
    </Wrap>
  );

  return (
    <Wrap onClose={onClose}>
      <Card>
        <Hdr title={phL} sub={phS} onClose={onClose} />
        <div style={{ padding: "11px 16px 16px" }}>
          <div style={{ display: "flex", gap: 3, marginBottom: 12 }}>
            {Array.from({ length: steps }).map((_, i) => (
              <div key={i} style={{ flex: 1, height: 2, borderRadius: 2, background: i < stepN ? "#84cc16" : "rgba(255,255,255,.06)", transition: "background .25s" }} />
            ))}
          </div>

          <div style={{ display: "flex", gap: target <= 6 ? 6 : target <= 8 ? 4 : 3, justifyContent: "center", marginBottom: 11, animation: shake ? "pshake .4s ease" : "none" }}>
            {Array.from({ length: target }).map((_, i) => {
              const f = i < cur.length;
              return (
                <div key={i} style={{
                  width:  target <= 6 ? 42 : target <= 8 ? 36 : 28,
                  height: target <= 6 ? 50 : target <= 8 ? 44 : 36,
                  borderRadius: 8, transition: "all .1s",
                  background: done ? "rgba(34,197,94,.1)" : f ? "rgba(132,204,22,.1)" : "rgba(255,255,255,.03)",
                  border: `1.5px solid ${done ? "rgba(34,197,94,.4)" : f ? "#84cc16" : "rgba(255,255,255,.06)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: target <= 6 ? 17 : 13, fontWeight: 800, color: "#fff",
                  transform: f ? "scale(1.04)" : "scale(1)",
                }}>
                  {f ? (show ? cur[i] : "●") : ""}
                </div>
              );
            })}
          </div>

          <input ref={hidRef} type="tel" inputMode="numeric" readOnly autoFocus
            style={{ position: "absolute", opacity: 0, width: 1, height: 1, pointerEvents: "none" }}
            onKeyDown={e => { if (/^\d$/.test(e.key)) push(e.key); if (e.key === "Backspace") pop(); }} />

          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {[["1","2","3"],["4","5","6"],["7","8","9"],["vis","0","del"]].map((row, ri) => (
              <div key={ri} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5 }}>
                {row.map((k, ki) => {
                  if (k === "vis") return <NK key={ki} onClick={() => setShow(s => !s)}>{show ? <EyeOff size={14} color="#444" /> : <Eye size={14} color="#444" />}</NK>;
                  if (k === "del") return (
                    <NK key={ki} onClick={pop}>
                      <svg width="17" height="12" viewBox="0 0 20 14" fill="none">
                        <path d="M7 1H18C19.1 1 20 1.9 20 3V11C20 12.1 19.1 13 18 13H7L1 7L7 1Z" stroke="#444" strokeWidth="1.5"/>
                        <path d="M13 5L9 9M9 5L13 9" stroke="#444" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </NK>
                  );
                  return <NK key={ki} digit onClick={() => push(k)}><span style={{ fontSize: 18, fontWeight: 700, color: "#d4d4d4" }}>{k}</span></NK>;
                })}
              </div>
            ))}
          </div>

          {err && !busy && !done && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", borderRadius: 7, marginTop: 8, background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.16)", color: "#ef4444", fontSize: 11, fontWeight: 500 }}>
              <AlertCircle size={11} />{err}
            </div>
          )}
          {done && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px", borderRadius: 7, marginTop: 8, background: "rgba(34,197,94,.08)", border: "1px solid rgba(34,197,94,.2)", color: "#22c55e", fontSize: 12, fontWeight: 700 }}>
              <CheckCircle size={12} /> PIN {hasPin ? "updated" : "created"}!
            </div>
          )}
          {busy && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: "#84cc16", fontSize: 11, marginTop: 8 }}>
              <div style={{ width: 11, height: 11, border: "2px solid rgba(132,204,22,.2)", borderTopColor: "#84cc16", borderRadius: "50%", animation: "pspin .7s linear infinite" }} /> Saving…
            </div>
          )}
          <button onClick={() => setStep("choose")} style={{ width: "100%", marginTop: 8, padding: "7px", background: "transparent", border: "1px solid rgba(255,255,255,.05)", borderRadius: 7, color: "#383838", fontSize: 10, cursor: "pointer", fontWeight: 600 }}>← Change length</button>
        </div>
      </Card>
      <style>{`@keyframes pshake{0%,100%{transform:translateX(0)}20%{transform:translateX(-7px)}40%{transform:translateX(7px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}@keyframes pspin{to{transform:rotate(360deg)}}`}</style>
    </Wrap>
  );
}

const NK = ({ onClick, digit, children }) => (
  <button onClick={onClick} style={{ height: 48, borderRadius: 10, cursor: "pointer", background: digit ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.5)", border: "1px solid rgba(255,255,255,.05)", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .1s", WebkitTapHighlightColor: "transparent", userSelect: "none" }}>
    {children}
  </button>
);
const Wrap = ({ onClose, children }) => (
  <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.93)", backdropFilter: "blur(18px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10010, padding: 20 }}>
    {children}
  </div>
);
const Card = ({ children }) => (
  <div onClick={e => e.stopPropagation()} style={{ background: "linear-gradient(155deg,#141414,#0a0a0a)", border: "1px solid rgba(132,204,22,.14)", borderRadius: 19, width: "100%", maxWidth: 375, boxShadow: "0 28px 80px rgba(0,0,0,.85)", animation: "pup .25s cubic-bezier(.4,0,.2,1)", overflow: "hidden" }}>
    {children}
    <style>{`@keyframes pup{from{opacity:0;transform:translateY(16px)scale(.97)}to{opacity:1;transform:none}}`}</style>
  </div>
);
const Hdr = ({ title, sub, onClose }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 11px", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 31, height: 31, borderRadius: 8, background: "rgba(132,204,22,.1)", border: "1px solid rgba(132,204,22,.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Lock size={14} color="#84cc16" />
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{title}</div>
        <div style={{ fontSize: 10, color: "#454545", marginTop: 2 }}>{sub}</div>
      </div>
    </div>
    <button onClick={onClose} style={{ width: 25, height: 25, borderRadius: 6, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.05)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#454545" }}><X size={11} /></button>
  </div>
);
const PBtn = ({ onClick, children }) => (
  <button onClick={onClick} style={{ width: "100%", padding: "11px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#84cc16,#65a30d)", color: "#000", fontSize: 12, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
    {children}
  </button>
);