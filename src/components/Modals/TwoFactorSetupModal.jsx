// src/components/Modals/TwoFactorSetupModal.jsx
// ============================================================================
// PRODUCTION 2FA SETUP — uses Supabase Edge Functions
//
// Flow:
//   Step 1 — Generate QR code via generate-2fa edge function
//   Step 2 — User scans QR / enters manual key in authenticator app
//   Step 3 — User enters 6-digit TOTP to verify setup
//   Step 4 — Show backup codes (displayed ONCE — user must save)
//
// Props:
//   show     — boolean
//   onClose  — () => void
//   userId   — string
//   onSuccess — () => void  (called after full setup complete)
// ============================================================================

import React, { useState, useEffect, useRef } from "react";
import {
  X, Shield, Loader, Check, Copy, Download,
  AlertTriangle, Eye, EyeOff, RefreshCw, Smartphone,
} from "lucide-react";
import { supabase } from "../../services/config/supabase";

const STYLES = `
  @keyframes tfaSpin    { to { transform: rotate(360deg); } }
  @keyframes tfaFadeIn  { from { opacity: 0; } to { opacity: 1; } }
  @keyframes tfaSlideUp { from { transform: translateY(18px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  @keyframes tfaShake   { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-7px)} 40%,80%{transform:translateX(7px)} }
  @keyframes tfaPulse   { 0%,100%{box-shadow: 0 0 0 0 rgba(132,204,22,0.4)} 50%{box-shadow: 0 0 0 8px rgba(132,204,22,0)} }

  .tfa-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,.92);
    backdrop-filter: blur(14px);
    display: flex; align-items: center; justify-content: center;
    z-index: 10000; padding: 20px;
    animation: tfaFadeIn .18s ease;
  }
  .tfa-card {
    background: #0d0d0d;
    border: 1.5px solid rgba(132,204,22,.22);
    border-radius: 28px;
    width: 100%; max-width: 460px;
    max-height: 92vh; overflow-y: auto;
    animation: tfaSlideUp .3s cubic-bezier(.16,1,.3,1);
    box-shadow: 0 40px 80px rgba(0,0,0,.8), 0 0 0 1px rgba(132,204,22,.07);
  }
  .tfa-card::-webkit-scrollbar { width: 4px; }
  .tfa-card::-webkit-scrollbar-track { background: transparent; }
  .tfa-card::-webkit-scrollbar-thumb { background: rgba(132,204,22,.2); border-radius: 2px; }

  .tfa-header {
    padding: 22px 24px;
    background: rgba(132,204,22,.055);
    border-bottom: 1px solid rgba(132,204,22,.12);
    display: flex; align-items: center; justify-content: space-between;
    position: sticky; top: 0; z-index: 1;
  }
  .tfa-icon {
    width: 46px; height: 46px; border-radius: 14px;
    background: linear-gradient(135deg,#84cc16,#4d7c0f);
    display: flex; align-items: center; justify-content: center;
    color: #000; flex-shrink: 0;
    box-shadow: 0 4px 16px rgba(132,204,22,.32);
  }
  .tfa-close {
    background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.09);
    border-radius: 10px; width: 36px; height: 36px;
    display: flex; align-items: center; justify-content: center;
    color: #737373; cursor: pointer; transition: all .2s;
  }
  .tfa-close:hover { background: rgba(255,255,255,.1); color: #fff; }

  .tfa-body { padding: 24px; }

  .tfa-steps { display: flex; align-items: center; justify-content: center; gap: 7px; margin-bottom: 24px; }
  .tfa-step-dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,.09); transition: all .3s; }
  .tfa-step-dot.done   { background: #4d7c0f; }
  .tfa-step-dot.active { background: #84cc16; width: 26px; border-radius: 4px; animation: tfaPulse 2s ease infinite; }
  .tfa-step-line { width: 30px; height: 1px; background: rgba(255,255,255,.07); }

  .tfa-info { text-align: center; color: #a3a3a3; font-size: 13.5px; margin-bottom: 22px; line-height: 1.65; }
  .tfa-info strong { color: #fff; }
  .tfa-info .acc { color: #84cc16; font-weight: 700; }

  .tfa-err {
    background: rgba(239,68,68,.07); border: 1px solid rgba(239,68,68,.22);
    border-radius: 11px; padding: 11px 14px; color: #ef4444;
    font-size: 12.5px; margin-bottom: 16px;
    display: flex; align-items: center; gap: 8px;
    animation: tfaShake .35s ease;
  }

  .tfa-qr-wrap {
    background: #fff; border-radius: 16px;
    padding: 12px; display: flex; align-items: center; justify-content: center;
    margin: 0 auto 18px; width: fit-content;
    box-shadow: 0 4px 20px rgba(0,0,0,.4);
  }

  .tfa-secret-box {
    background: rgba(132,204,22,.05); border: 1px solid rgba(132,204,22,.2);
    border-radius: 12px; padding: 13px 15px; margin-bottom: 16px;
  }

  .tfa-otp-row { display: flex; gap: 10px; justify-content: center; margin-bottom: 18px; }
  .tfa-otp {
    width: 52px; height: 60px;
    background: rgba(255,255,255,.04); border: 2px solid rgba(255,255,255,.09);
    border-radius: 14px; color: #fff; font-size: 22px; font-weight: 800;
    text-align: center; transition: all .2s; outline: none;
  }
  .tfa-otp:focus  { border-color: #84cc16; background: rgba(132,204,22,.07); transform: scale(1.05); }
  .tfa-otp.filled { border-color: rgba(132,204,22,.45); background: rgba(132,204,22,.05); }

  .tfa-btn {
    width: 100%; padding: 14px; border: none; border-radius: 13px;
    font-size: 14.5px; font-weight: 800; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 9px;
    transition: all .22s;
  }
  .tfa-btn-primary {
    background: linear-gradient(135deg,#84cc16,#4d7c0f);
    color: #000; box-shadow: 0 4px 18px rgba(132,204,22,.28);
  }
  .tfa-btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 7px 26px rgba(132,204,22,.42); }
  .tfa-btn-primary:disabled { opacity: .42; cursor: not-allowed; transform: none; }
  .tfa-btn-ghost {
    background: rgba(255,255,255,.04); border: 1.5px solid rgba(255,255,255,.09);
    color: #a3a3a3; margin-top: 10px;
  }
  .tfa-btn-ghost:hover:not(:disabled) { background: rgba(255,255,255,.08); color: #fff; }

  .tfa-backup-grid {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 8px; margin-bottom: 16px;
  }
  .tfa-backup-code {
    background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.08);
    border-radius: 10px; padding: 10px 12px;
    font-size: 14px; font-weight: 700; color: #e5e5e5;
    font-family: monospace; text-align: center; letter-spacing: 2px;
  }
  .tfa-backup-code.used { opacity: .3; text-decoration: line-through; }

  .tfa-warn {
    background: rgba(245,158,11,.07); border: 1px solid rgba(245,158,11,.2);
    border-radius: 11px; padding: 12px 14px;
    display: flex; align-items: flex-start; gap: 9px;
    color: #f59e0b; font-size: 12.5px; margin-bottom: 18px; line-height: 1.55;
  }
`;

const TOTP_STEPS = ["generate", "scan", "verify", "backup"];

export default function TwoFactorSetupModal({ show, onClose, userId, onSuccess }) {
  const [stepIdx,      setStepIdx]      = useState(0);
  const [qrCode,       setQrCode]       = useState("");
  const [secret,       setSecret]       = useState("");
  const [backupCodes,  setBackupCodes]  = useState([]);
  const [otp,          setOtp]          = useState(["", "", "", "", "", ""]);
  const [showSecret,   setShowSecret]   = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [err,          setErr]          = useState("");
  const [copied,       setCopied]       = useState(false);
  const [copiedCodes,  setCopiedCodes]  = useState(false);
  const [done,         setDone]         = useState(false);
  const otpRefs  = useRef([]);
  const mountRef = useRef(true);

  const step = TOTP_STEPS[stepIdx];

  useEffect(() => {
    mountRef.current = true;
    return () => { mountRef.current = false; };
  }, []);

  useEffect(() => {
    if (!show) {
      setStepIdx(0); setQrCode(""); setSecret(""); setBackupCodes([]);
      setOtp(["","","","","",""]); setErr(""); setDone(false); setCopied(false);
    }
  }, [show]);

  // ── Auto-generate when modal opens ───────────────────────────────────────
  useEffect(() => {
    if (show && step === "generate" && !qrCode) {
      generate2FA();
    }
  }, [show]); // eslint-disable-line

  const generate2FA = async () => {
    setLoading(true); setErr("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("generate-2fa", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw new Error(error.message || "Failed to generate 2FA");
      if (!data?.success) throw new Error(data?.error || "Setup failed");

      if (mountRef.current) {
        setQrCode(data.qrCode);
        setSecret(data.secret);
        setBackupCodes(data.backupCodes);
        setStepIdx(1); // move to scan step
      }
    } catch (e) {
      if (mountRef.current) setErr(e.message || "Failed to initialize 2FA setup. Please try again.");
    } finally {
      if (mountRef.current) setLoading(false);
    }
  };

  // ── Verify TOTP token ─────────────────────────────────────────────────────
  const verifySetup = async () => {
    const token = otp.join("");
    if (token.length !== 6) { setErr("Enter the complete 6-digit code."); return; }
    setLoading(true); setErr("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("verify-2fa-setup", {
        body:    { token },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || "Invalid code. Check your authenticator app and try again.");
      }

      if (mountRef.current) {
        setStepIdx(3); // show backup codes
      }
    } catch (e) {
      if (mountRef.current) {
        setErr(e.message || "Verification failed.");
        setOtp(["","","","","",""]);
        setTimeout(() => otpRefs.current[0]?.focus(), 50);
      }
    } finally {
      if (mountRef.current) setLoading(false);
    }
  };

  const handleComplete = () => {
    setDone(true);
    setTimeout(() => {
      onSuccess?.();
      onClose();
    }, 800);
  };

  const copySecret = async () => {
    await navigator.clipboard.writeText(secret).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyCodes = async () => {
    const text = backupCodes.join("\n");
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2500);
  };

  const downloadCodes = () => {
    const content = [
      "=== Xeevia 2FA Backup Codes ===",
      "Generated: " + new Date().toLocaleString(),
      "",
      "IMPORTANT: Keep these in a safe place.",
      "Each code can only be used ONCE.",
      "If you lose your authenticator, use one of these to regain access.",
      "",
      ...backupCodes.map((c, i) => `${i + 1}. ${c}`),
      "",
      "=== END ===",
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `xeevia-backup-codes-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // OTP input helpers
  const handleOtpChange = (i, v) => {
    if (v && !/^\d$/.test(v)) return;
    const next = [...otp];
    next[i] = v;
    setOtp(next);
    setErr("");
    if (v && i < 5) otpRefs.current[i + 1]?.focus();
  };
  const handleOtpKey = (i, e) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
    if (e.key === "Enter" && otp.join("").length === 6) verifySetup();
  };
  const handleOtpPaste = (e) => {
    e.preventDefault();
    const d = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (d.length === 6) { setOtp(d.split("")); otpRefs.current[5]?.focus(); }
  };

  if (!show) return null;

  return (
    <>
      <style>{STYLES}</style>
      <div className="tfa-overlay" onClick={onClose}>
        <div className="tfa-card" onClick={(e) => e.stopPropagation()}>

          {/* Header */}
          <div className="tfa-header">
            <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
              <div className="tfa-icon"><Shield size={20} /></div>
              <div>
                <div style={{ fontSize: 16.5, fontWeight: 800, color: "#fff" }}>Enable Two-Factor Authentication</div>
                <div style={{ fontSize: 11.5, color: "#737373", marginTop: 2 }}>Protect your account with TOTP</div>
              </div>
            </div>
            <button className="tfa-close" onClick={onClose}><X size={15} /></button>
          </div>

          <div className="tfa-body">

            {/* Step indicators */}
            {step !== "generate" && (
              <div className="tfa-steps">
                {["scan", "verify", "backup"].map((s, i) => (
                  <React.Fragment key={s}>
                    <div className={`tfa-step-dot ${i < stepIdx - 1 ? "done" : i === stepIdx - 1 ? "active" : ""}`} />
                    {i < 2 && <div className="tfa-step-line" />}
                  </React.Fragment>
                ))}
              </div>
            )}

            {/* ── GENERATING ── */}
            {step === "generate" && (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                {loading
                  ? <>
                      <Loader size={32} style={{ color: "#84cc16", animation: "tfaSpin 1s linear infinite", marginBottom: 16 }} />
                      <div style={{ color: "#737373", fontSize: 13 }}>Setting up 2FA…</div>
                    </>
                  : err
                    ? <>
                        <div className="tfa-err" style={{ justifyContent: "center" }}>
                          <AlertTriangle size={15} style={{ flexShrink: 0 }} /> {err}
                        </div>
                        <button className="tfa-btn tfa-btn-primary" onClick={generate2FA} style={{ marginTop: 16 }}>
                          <RefreshCw size={16} /> Try Again
                        </button>
                      </>
                    : null
                }
              </div>
            )}

            {/* ── SCAN QR ── */}
            {step === "scan" && (
              <>
                <p className="tfa-info">
                  Scan this QR code with your authenticator app (<strong>Google Authenticator</strong>, <strong>Authy</strong>, or any TOTP app).
                </p>

                {qrCode && (
                  <div className="tfa-qr-wrap">
                    <img src={qrCode} alt="2FA QR Code" style={{ width: 200, height: 200, display: "block" }} />
                  </div>
                )}

                <div style={{ textAlign: "center", marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: "#484848", marginBottom: 8 }}>Can't scan? Enter this key manually:</div>
                  <div className="tfa-secret-box">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <code style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "#a3e635", letterSpacing: 2, fontFamily: "monospace", wordBreak: "break-all" }}>
                        {showSecret ? secret : "•".repeat(secret.length)}
                      </code>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button onClick={() => setShowSecret((s) => !s)} style={{ background: "none", border: "none", cursor: "pointer", color: "#484848", padding: 4 }}>
                          {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button onClick={copySecret} style={{ background: "none", border: "none", cursor: "pointer", color: copied ? "#84cc16" : "#484848", padding: 4 }}>
                          {copied ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{
                  padding: "12px 14px",
                  background: "rgba(59,130,246,.06)",
                  border: "1px solid rgba(59,130,246,.15)",
                  borderRadius: 11,
                  fontSize: 12,
                  color: "#93c5fd",
                  lineHeight: 1.6,
                  marginBottom: 20,
                  display: "flex",
                  gap: 9,
                  alignItems: "flex-start",
                }}>
                  <Smartphone size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    Open your authenticator app, tap <strong>+</strong> or <strong>Add Account</strong>, then scan the QR code above. The app will show a 6-digit code that changes every 30 seconds.
                  </div>
                </div>

                <button className="tfa-btn tfa-btn-primary" onClick={() => setStepIdx(2)}>
                  <Check size={17} /> I've Scanned the QR Code
                </button>
              </>
            )}

            {/* ── VERIFY ── */}
            {step === "verify" && (
              <>
                <p className="tfa-info">
                  Enter the <strong>6-digit code</strong> from your authenticator app to confirm setup.
                </p>

                {err && <div className="tfa-err"><AlertTriangle size={15} style={{ flexShrink: 0 }} />{err}</div>}

                <label style={{ display: "block", textAlign: "center", fontSize: 11, fontWeight: 700, color: "#737373", textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 14 }}>
                  Verification Code
                </label>

                <div className="tfa-otp-row" onPaste={handleOtpPaste}>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <input
                      key={i}
                      ref={(el) => (otpRefs.current[i] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      className={`tfa-otp ${otp[i] ? "filled" : ""}`}
                      value={otp[i]}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKey(i, e)}
                      autoFocus={i === 0}
                    />
                  ))}
                </div>

                <div style={{ fontSize: 11.5, color: "#484848", textAlign: "center", marginBottom: 18 }}>
                  Code refreshes every 30 seconds. Enter the current code shown in your app.
                </div>

                <button
                  className="tfa-btn tfa-btn-primary"
                  onClick={verifySetup}
                  disabled={loading || otp.join("").length !== 6}
                >
                  {loading
                    ? <><Loader size={17} style={{ animation: "tfaSpin 1s linear infinite" }} /> Verifying…</>
                    : <><Shield size={17} /> Enable 2FA</>
                  }
                </button>

                <button className="tfa-btn tfa-btn-ghost" onClick={() => setStepIdx(1)}>
                  Back to QR Code
                </button>
              </>
            )}

            {/* ── BACKUP CODES ── */}
            {step === "backup" && (
              <>
                <div style={{ textAlign: "center", marginBottom: 18 }}>
                  <div style={{ width: 56, height: 56, background: "rgba(34,197,94,.1)", border: "1px solid rgba(34,197,94,.25)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                    <Check size={24} color="#22c55e" />
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: "#22c55e", marginBottom: 4 }}>2FA Enabled!</div>
                  <div style={{ fontSize: 13, color: "#737373" }}>Save your backup codes before closing</div>
                </div>

                <div className="tfa-warn">
                  <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    These codes are shown <strong>only once</strong>. Store them in a secure place — a password manager, printed paper, or encrypted file. Each code works once only.
                  </div>
                </div>

                <div className="tfa-backup-grid">
                  {backupCodes.map((code, i) => (
                    <div key={i} className="tfa-backup-code">{code}</div>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  <button onClick={copyCodes} style={{
                    flex: 1, padding: "10px", borderRadius: 11, cursor: "pointer",
                    background: copiedCodes ? "rgba(34,197,94,.1)" : "rgba(255,255,255,.04)",
                    border: `1px solid ${copiedCodes ? "rgba(34,197,94,.3)" : "rgba(255,255,255,.09)"}`,
                    color: copiedCodes ? "#22c55e" : "#a3a3a3",
                    fontSize: 12.5, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    transition: "all .2s",
                  }}>
                    {copiedCodes ? <Check size={14} /> : <Copy size={14} />}
                    {copiedCodes ? "Copied!" : "Copy All"}
                  </button>
                  <button onClick={downloadCodes} style={{
                    flex: 1, padding: "10px", borderRadius: 11, cursor: "pointer",
                    background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.09)",
                    color: "#a3a3a3", fontSize: 12.5, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    transition: "all .2s",
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,.08)"; e.currentTarget.style.color = "#fff"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,.04)"; e.currentTarget.style.color = "#a3a3a3"; }}
                  >
                    <Download size={14} /> Download
                  </button>
                </div>

                <button
                  className="tfa-btn tfa-btn-primary"
                  onClick={handleComplete}
                  disabled={done}
                >
                  {done
                    ? <><Loader size={17} style={{ animation: "tfaSpin 1s linear infinite" }} /> Finishing…</>
                    : <><Check size={17} /> I've Saved My Backup Codes</>
                  }
                </button>
              </>
            )}

          </div>
        </div>
      </div>
    </>
  );
}