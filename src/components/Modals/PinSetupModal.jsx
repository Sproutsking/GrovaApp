// src/components/Modals/PinSetupModal.jsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import { Lock, X, CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react";
import { supabase } from "../../services/config/supabase";
import TwoFactorSetupModal from "./TwoFactorSetupModal";

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
  const [stepUpCode, setStepUpCode] = useState("");
  const [stepUpToken, setStepUpToken] = useState("");
  const [stepUpEnabled, setStepUpEnabled] = useState(false);
  const [stepUpBusy, setStepUpBusy] = useState(false);
  const [twoFactorSetupOpen, setTwoFactorSetupOpen] = useState(false);
  const hidRef            = useRef(null);
  const mountedRef        = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (step === "enter") setTimeout(() => hidRef.current?.focus(), 100);
  }, [step, phase]);

  const setCur  = (v) => setVals((p) => ({ ...p, [phase]: v }));
  const doShake = () => {
    setShake(true);
    setTimeout(() => { if (mountedRef.current) setShake(false); }, 500);
  };

  const cur    = vals[phase] || [];
  const target = phase === "old" ? (currentPinLength || len) : len;
  const steps  = hasPin ? 3 : 2;
  const stepN  = phase === "old" ? 1 : phase === "new" ? (hasPin ? 2 : 1) : (hasPin ? 3 : 2);

  const advance = useCallback(async (arr) => {
    if (phase === "old")    { setPhase("new");     return; }
    if (phase === "new")    { setPhase("confirm");  return; }

    // Confirm phase — validate match then save
    const newStr = vals.new.join("");
    const cfmStr = arr.join("");

    if (newStr !== cfmStr) {
      setErr("PINs don't match — try again");
      doShake();
      setVals((p) => ({ ...p, new: [], confirm: [] }));
      setPhase("new");
      return;
    }

    try {
      setBusy(true);
      setErr("");
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || authData.user?.id !== userId) {
        throw new Error("Your session changed. Sign in again before updating your PIN.");
      }
      const { data, error: updateError } = await supabase.rpc("set_transaction_pin", {
        p_new_pin: newStr,
        p_current_pin: hasPin ? vals.old.join("") : null,
        p_pin_length: len,
        p_authorization_token: stepUpToken,
      });
      if (updateError) throw updateError;
      if (!data?.success) {
        if (data?.code === "STEP_UP_REQUIRED") {
          setStepUpToken("");
          setVals({ old: [], new: [], confirm: [] });
          setStep("stepup");
          setStepUpCode("");
          setErr(data.error || "Verify again to continue changing your PIN.");
          return;
        }
        setErr(data?.error || "Could not update the transaction PIN.");
        if (hasPin) {
          doShake();
          setVals({ old: [], new: [], confirm: [] });
          setPhase("old");
        }
        return;
      }

      if (mountedRef.current) {
        setDone(true);
        setTimeout(() => {
          if (mountedRef.current) {
            onSuccess?.({ pinLength: len });
            onClose();
          }
        }, 1100);
      }
    } catch (ex) {
      console.error("[PinSetup] Error:", ex);
      if (mountedRef.current) {
        setErr(ex.message || "Failed to save PIN. Please try again.");
        doShake();
      }
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }, [phase, vals, len, hasPin, userId, onSuccess, onClose, stepUpToken]); // eslint-disable-line

  const push = (d) => {
    if (cur.length >= target || busy || done) return;
    const next = [...cur, d];
    setCur(next);
    setErr("");
    if (next.length === target) setTimeout(() => advance(next), 90);
  };

  const pop = () => {
    if (busy || done) return;
    setCur(cur.slice(0, -1));
    setErr("");
  };

  const phLabel = { old: "Current PIN", new: `New ${len}-digit PIN`, confirm: "Confirm New PIN" }[phase];
  const phSub   = { old: "Verify your identity", new: "Choose carefully — don't share this", confirm: "Re-enter to confirm" }[phase];

  const beginPinFlow = async () => {
    try {
      setBusy(true);
      setErr("");
      const { data: twoFactor, error: twoFactorError } = await supabase
        .from("two_factor_auth")
        .select("enabled")
        .eq("user_id", userId)
        .maybeSingle();
      if (twoFactorError) throw twoFactorError;
      setStepUpEnabled(Boolean(twoFactor?.enabled));
      setStep("stepup");
    } catch (error) {
      setErr(error.message || "Could not check authenticator status.");
    } finally {
      setBusy(false);
    }
  };

  const verifyStepUp = async () => {
    if (!/^\d{6}$/.test(stepUpCode)) {
      setErr("Enter the current 6-digit authenticator code.");
      return;
    }
    try {
      setStepUpBusy(true);
      setErr("");
      const { data, error } = await supabase.functions.invoke("verify-2fa-login", {
        body: { token: stepUpCode, purpose: "transaction_pin_change" },
      });
      if (error) throw new Error(error.message || "Authenticator verification failed.");
      if (!data?.success || !data.authorizationToken) {
        throw new Error(data?.error || "Could not authorize this PIN change.");
      }
      setStepUpToken(data.authorizationToken);
      setStep("enter");
      setPhase(hasPin ? "old" : "new");
      setStepUpCode("");
    } catch (error) {
      setErr(error.message || "Authenticator verification failed.");
      setStepUpCode("");
    } finally {
      setStepUpBusy(false);
    }
  };

  // ── CHOOSE SCREEN ─────────────────────────────────────────────────────────
  if (step === "stepup" && twoFactorSetupOpen) {
    return (
      <TwoFactorSetupModal
        show
        userId={userId}
        onClose={() => setTwoFactorSetupOpen(false)}
        onSuccess={() => {
          setStepUpEnabled(true);
          setStepUpCode("");
          setErr("");
        }}
      />
    );
  }

  if (step === "stepup") return (
    <Wrap onClose={onClose}>
      <Card>
        <Hdr title="Confirm it’s you" sub="Authenticator confirmation required" onClose={onClose} />
        <div style={{ padding: "16px" }}>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: "#b5b5b5", marginBottom: 14 }}>
            You're authorizing a {hasPin ? "transaction PIN change" : "new transaction PIN"}. This one-time confirmation expires in five minutes and returns you to this step.
          </div>
          {!stepUpEnabled ? (
            <>
              <div role="alert" style={{ fontSize: 12, lineHeight: 1.6, color: "#fbbf24", marginBottom: 14 }}>
                Set up an authenticator app first. Your PIN flow will remain here while you do.
              </div>
              <PBtn onClick={() => setTwoFactorSetupOpen(true)}>
                <Lock size={13} /> Set up authenticator
              </PBtn>
            </>
          ) : (
            <>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={stepUpCode}
                onChange={(event) => {
                  setStepUpCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                  setErr("");
                }}
                aria-label="Authenticator code"
                placeholder="6-digit authenticator code"
                style={{
                  width: "100%", boxSizing: "border-box", padding: "13px 12px", marginBottom: 12,
                  borderRadius: 9, border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.04)",
                  color: "#fff", fontSize: 18, letterSpacing: ".35em", textAlign: "center",
                }}
              />
              <PBtn onClick={verifyStepUp} disabled={stepUpBusy || stepUpCode.length !== 6}>
                <Lock size={13} /> {stepUpBusy ? "Verifying…" : "Verify and continue"}
              </PBtn>
            </>
          )}
          {err && <div role="alert" style={{ marginTop: 10, color: "#f87171", fontSize: 12 }}>{err}</div>}
          <button onClick={() => setStep("choose")} style={{
            width: "100%", marginTop: 10, padding: 8, background: "transparent",
            border: "1px solid rgba(255,255,255,.05)", borderRadius: 7, color: "#777", fontSize: 11,
          }}>Back to PIN settings</button>
        </div>
      </Card>
    </Wrap>
  );

  if (step === "choose") return (
    <Wrap onClose={onClose}>
      <Card>
        <Hdr title={hasPin ? "Change PIN" : "Set Transaction PIN"} sub="Choose your PIN length" onClose={onClose} />
        <div style={{ padding: "14px 16px 18px" }}>
          <div style={{ marginBottom: 10 }}>
            <p style={{ fontSize: 12, color: "#484848", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 }}>
              Security Level
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
              {PIN_OPTS.map(({ n, label, bars }) => {
                const active = len === n;
                return (
                  <button key={n} onClick={() => setLen(n)} style={{
                    padding:    "13px 10px",
                    borderRadius: 12,
                    cursor:     "pointer",
                    textAlign:  "center",
                    background: active ? "rgba(132,204,22,.1)" : "rgba(255,255,255,.03)",
                    border:     `1.5px solid ${active ? "#84cc16" : "rgba(255,255,255,.07)"}`,
                    transition: "all .15s",
                    boxShadow:  active ? "0 4px 14px rgba(132,204,22,.18)" : "none",
                  }}>
                    <div style={{ fontSize: 25, fontWeight: 900, color: active ? "#84cc16" : "#d4d4d4", lineHeight: 1 }}>{n}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: active ? "#84cc16" : "#505050", margin: "3px 0 6px" }}>{label}</div>
                    <div style={{ display: "flex", gap: 3, justifyContent: "center" }}>
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} style={{
                          width: 5, height: 5, borderRadius: "50%",
                          background: i <= bars
                            ? (active ? "#84cc16" : "rgba(132,204,22,.35)")
                            : "rgba(255,255,255,.06)",
                        }} />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{
            padding: "11px 13px",
            background: "rgba(59,130,246,.05)",
            border: "1px solid rgba(59,130,246,.12)",
            borderRadius: 10,
            marginBottom: 14,
            fontSize: 12.5,
            color: "#5a7bb5",
            lineHeight: 1.6,
          }}>
            💡 Your PIN protects all wallet transactions. You'll need it every time you withdraw or transfer funds.
          </div>

          <PBtn onClick={beginPinFlow} disabled={busy}>
            <Lock size={13} /> Continue with {len}-digit PIN
          </PBtn>
        </div>
      </Card>
    </Wrap>
  );

  // ── ENTER SCREEN ──────────────────────────────────────────────────────────
  return (
    <Wrap onClose={onClose}>
      <Card>
        <Hdr title={phLabel} sub={phSub} onClose={onClose} />
        <div style={{ padding: "12px 16px 18px" }}>

          {/* Progress bar */}
          <div style={{ display: "flex", gap: 3, marginBottom: 14 }}>
            {Array.from({ length: steps }).map((_, i) => (
              <div key={i} style={{
                flex: 1, height: 2, borderRadius: 2,
                background: i < stepN ? "#84cc16" : "rgba(255,255,255,.06)",
                transition: "background .25s",
              }} />
            ))}
          </div>

          {/* PIN display dots */}
          <div style={{
            display:        "flex",
            gap:            target <= 6 ? 7 : target <= 8 ? 5 : 3,
            justifyContent: "center",
            marginBottom:   13,
            animation:      shake ? "pshake .4s ease" : "none",
          }}>
            {Array.from({ length: target }).map((_, i) => {
              const filled = i < cur.length;
              return (
                <div key={i} style={{
                  width:  target <= 6 ? 44 : target <= 8 ? 36 : 27,
                  height: target <= 6 ? 52 : target <= 8 ? 44 : 35,
                  borderRadius: 9, transition: "all .1s",
                  background: done
                    ? "rgba(34,197,94,.1)"
                    : filled ? "rgba(132,204,22,.12)" : "rgba(255,255,255,.03)",
                  border: `1.5px solid ${done ? "rgba(34,197,94,.4)" : filled ? "#84cc16" : "rgba(255,255,255,.07)"}`,
                  display:         "flex",
                  alignItems:      "center",
                  justifyContent:  "center",
                  fontSize:        target <= 6 ? 18 : 14,
                  fontWeight:      800,
                  color:           "#fff",
                  transform:       filled ? "scale(1.05)" : "scale(1)",
                  boxShadow:       filled && !done ? "0 2px 8px rgba(132,204,22,.2)" : "none",
                }}>
                  {filled ? (show ? cur[i] : "●") : ""}
                </div>
              );
            })}
          </div>

          {/* Hidden input to capture physical keyboard */}
          <input
            ref={hidRef}
            type="tel"
            inputMode="numeric"
            readOnly
            autoFocus
            style={{ position: "absolute", opacity: 0, width: 1, height: 1, pointerEvents: "none" }}
            onKeyDown={(e) => {
              if (/^\d$/.test(e.key)) push(e.key);
              if (e.key === "Backspace") pop();
            }}
          />

          {/* Keypad */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], ["vis", "0", "del"]].map((row, ri) => (
              <div key={ri} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                {row.map((k, ki) => {
                  if (k === "vis") return (
                    <NK key={ki} onClick={() => setShow((s) => !s)}>
                      {show ? <EyeOff size={15} color="#555" /> : <Eye size={15} color="#555" />}
                    </NK>
                  );
                  if (k === "del") return (
                    <NK key={ki} onClick={pop}>
                      <svg width="18" height="13" viewBox="0 0 20 14" fill="none">
                        <path d="M7 1H18C19.1 1 20 1.9 20 3V11C20 12.1 19.1 13 18 13H7L1 7L7 1Z" stroke="#555" strokeWidth="1.5" />
                        <path d="M13 5L9 9M9 5L13 9" stroke="#555" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </NK>
                  );
                  return (
                    <NK key={ki} digit onClick={() => push(k)}>
                      <span style={{ fontSize: 20, fontWeight: 700, color: "#d4d4d4" }}>{k}</span>
                    </NK>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Error */}
          {err && !busy && !done && (
            <div style={{
              display:     "flex",
              alignItems:  "center",
              gap:         7,
              padding:     "9px 12px",
              borderRadius: 9,
              marginTop:   10,
              background:  "rgba(239,68,68,.06)",
              border:      "1px solid rgba(239,68,68,.18)",
              color:       "#ef4444",
              fontSize:    12.5,
              fontWeight:  500,
            }}>
              <AlertCircle size={12} style={{ flexShrink: 0 }} /> {err}
            </div>
          )}

          {/* Success */}
          {done && (
            <div style={{
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              gap:            7,
              padding:        "9px",
              borderRadius:   9,
              marginTop:      10,
              background:     "rgba(34,197,94,.08)",
              border:         "1px solid rgba(34,197,94,.2)",
              color:          "#22c55e",
              fontSize:       13,
              fontWeight:     700,
            }}>
              <CheckCircle size={13} /> PIN {hasPin ? "updated" : "created"} successfully!
            </div>
          )}

          {/* Saving indicator */}
          {busy && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, color: "#84cc16", fontSize: 12, marginTop: 10 }}>
              <div style={{ width: 12, height: 12, border: "2px solid rgba(132,204,22,.2)", borderTopColor: "#84cc16", borderRadius: "50%", animation: "pspin .7s linear infinite" }} />
              Saving securely…
            </div>
          )}

          <button onClick={() => { setStep("choose"); setPhase(hasPin ? "old" : "new"); setVals({ old: [], new: [], confirm: [] }); setErr(""); }} style={{
            width: "100%", marginTop: 10, padding: "8px",
            background: "transparent", border: "1px solid rgba(255,255,255,.05)",
            borderRadius: 8, color: "#383838", fontSize: 11.5, cursor: "pointer", fontWeight: 600,
          }}>
            ← Change PIN length
          </button>
        </div>
      </Card>
      <style>{`
        @keyframes pshake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-5px)} 80%{transform:translateX(5px)} }
        @keyframes pspin  { to{transform:rotate(360deg)} }
        @keyframes pup    { from{opacity:0;transform:translateY(18px) scale(.97)} to{opacity:1;transform:none} }
      `}</style>
    </Wrap>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

const NK = ({ onClick, digit, children }) => (
  <button
    onClick={onClick}
    style={{
      height:           50,
      borderRadius:     11,
      cursor:           "pointer",
      background:       digit ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.5)",
      border:           "1px solid rgba(255,255,255,.055)",
      display:          "flex",
      alignItems:       "center",
      justifyContent:   "center",
      transition:       "all .1s",
      WebkitTapHighlightColor: "transparent",
      userSelect:       "none",
      active:           "transform: scale(.94)",
    }}
    onMouseDown={(e) => e.currentTarget.style.transform = "scale(.94)"}
    onMouseUp={(e) => e.currentTarget.style.transform = "scale(1)"}
    onTouchStart={(e) => e.currentTarget.style.transform = "scale(.94)"}
    onTouchEnd={(e) => e.currentTarget.style.transform = "scale(1)"}
  >
    {children}
  </button>
);

const Wrap = ({ onClose, children }) => (
  <div
    onClick={onClose}
    style={{
      position:       "fixed",
      inset:          0,
      background:     "rgba(0,0,0,.94)",
      backdropFilter: "blur(20px)",
      display:        "flex",
      alignItems:     "center",
      justifyContent: "center",
      zIndex:         10010,
      padding:        20,
    }}
  >
    {children}
  </div>
);

const Card = ({ children }) => (
  <div
    onClick={(e) => e.stopPropagation()}
    style={{
      background:   "linear-gradient(155deg,#141414,#0a0a0a)",
      border:       "1px solid rgba(132,204,22,.16)",
      borderRadius: 20,
      width:        "100%",
      maxWidth:     385,
      boxShadow:    "0 30px 90px rgba(0,0,0,.9), 0 0 0 1px rgba(132,204,22,.05)",
      animation:    "pup .25s cubic-bezier(.4,0,.2,1)",
      overflow:     "hidden",
    }}
  >
    {children}
  </div>
);

const Hdr = ({ title, sub, onClose }) => (
  <div style={{
    display:      "flex",
    alignItems:   "center",
    justifyContent: "space-between",
    padding:      "15px 17px 12px",
    borderBottom: "1px solid rgba(255,255,255,.055)",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <div style={{
        width: 33, height: 33, borderRadius: 9,
        background: "rgba(132,204,22,.1)", border: "1px solid rgba(132,204,22,.22)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Lock size={15} color="#84cc16" />
      </div>
      <div>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{title}</div>
        <div style={{ fontSize: 11.5, color: "#454545", marginTop: 2 }}>{sub}</div>
      </div>
    </div>
    <button onClick={onClose} style={{
      width: 26, height: 26, borderRadius: 7,
      background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.06)",
      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#454545",
    }}>
      <X size={12} />
    </button>
  </div>
);

const PBtn = ({ onClick, children, disabled = false }) => (
  <button onClick={onClick} disabled={disabled} style={{
    width:          "100%",
    padding:        "12px",
    borderRadius:   11,
    border:         "none",
    background:     "linear-gradient(135deg,#84cc16,#65a30d)",
    color:          "#000",
    fontSize:       13.5,
    fontWeight:     800,
    cursor:         disabled ? "not-allowed" : "pointer",
    opacity:        disabled ? 0.6 : 1,
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    gap:            7,
    boxShadow:      "0 4px 16px rgba(132,204,22,.28)",
    transition:     "all .15s",
  }}
    onMouseEnter={(e) => { if (!disabled) { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 6px 22px rgba(132,204,22,.38)"; } }}
    onMouseLeave={(e) => { if (!disabled) { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(132,204,22,.28)"; } }}
  >
    {children}
  </button>
);