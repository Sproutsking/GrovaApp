// src/components/Modals/TwoFAModal.jsx
// ============================================================================
// PRODUCTION 2FA VERIFICATION MODAL
// Used during login or before sensitive actions (withdrawals, PIN changes, etc.)
//
// Calls verify-2fa-login edge function for server-side TOTP verification.
// Supports both TOTP codes AND backup codes.
//
// Props:
//   show      — boolean
//   onClose   — () => void
//   userId    — string
//   onSuccess — () => void
//   context   — "login" | "withdrawal" | "sensitive" (optional, affects UI copy)
// ============================================================================

import React, { useState, useRef, useEffect } from "react";
import { Shield, Loader, X, AlertTriangle, Key } from "lucide-react";
import { supabase } from "../../services/config/supabase";

const STYLES = `
  @keyframes tfa2Spin  { to { transform: rotate(360deg); } }
  @keyframes tfa2Fade  { from { opacity: 0; } to { opacity: 1; } }
  @keyframes tfa2Up    { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  @keyframes tfa2Shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-6px)} 40%,80%{transform:translateX(6px)} }
`;

const CONTEXT_COPY = {
  login:      { title: "Two-Factor Authentication",  sub: "Verify your identity to sign in"       },
  withdrawal: { title: "Confirm Withdrawal",          sub: "2FA required for financial actions"    },
  sensitive:  { title: "Security Verification",       sub: "Confirm your identity to continue"    },
  default:    { title: "Two-Factor Authentication",  sub: "Enter the code from your app"          },
};

export default function TwoFAModal({ show, onClose, userId, onSuccess, context = "default" }) {
  const [mode,      setMode]      = useState("totp");  // "totp" | "backup"
  const [otp,       setOtp]       = useState(["", "", "", "", "", ""]);
  const [backup,    setBackup]    = useState("");
  const [loading,   setLoading]   = useState(false);
  const [err,       setErr]       = useState("");
  const otpRefs  = useRef([]);
  const mountRef = useRef(true);

  const copy = CONTEXT_COPY[context] || CONTEXT_COPY.default;

  useEffect(() => {
    mountRef.current = true;
    return () => { mountRef.current = false; };
  }, []);

  useEffect(() => {
    if (!show) {
      setOtp(["","","","","",""]); setBackup(""); setErr(""); setMode("totp");
    }
    if (show && mode === "totp") {
      setTimeout(() => otpRefs.current[0]?.focus(), 80);
    }
  }, [show]); // eslint-disable-line

  if (!show) return null;

  const handleVerify = async () => {
    if (mode === "totp" && otp.join("").length !== 6) {
      setErr("Enter the complete 6-digit code."); return;
    }
    if (mode === "backup" && !backup.trim()) {
      setErr("Enter your backup code."); return;
    }

    setLoading(true); setErr("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const body = mode === "totp"
        ? { token: otp.join("") }
        : { backupCode: backup.trim() };

      const { data, error } = await supabase.functions.invoke("verify-2fa-login", {
        body,
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || "Invalid code. Please try again.");
      }

      // If backup code and few remaining, show a warning
      if (data.warningIfLow) {
        console.warn("[TwoFAModal]", data.warningIfLow);
      }

      if (mountRef.current) {
        onSuccess?.();
        onClose();
      }
    } catch (e) {
      if (mountRef.current) {
        setErr(e.message || "Verification failed.");
        if (mode === "totp") {
          setOtp(["","","","","",""]);
          setTimeout(() => otpRefs.current[0]?.focus(), 50);
        }
      }
    } finally {
      if (mountRef.current) setLoading(false);
    }
  };

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
    if (e.key === "Enter" && otp.join("").length === 6) handleVerify();
  };
  const handleOtpPaste = (e) => {
    e.preventDefault();
    const d = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (d.length === 6) { setOtp(d.split("")); otpRefs.current[5]?.focus(); }
  };

  return (
    <>
      <style>{STYLES}</style>
      <div
        onClick={onClose}
        style={{
          position:       "fixed",
          inset:          0,
          background:     "rgba(0,0,0,.88)",
          backdropFilter: "blur(12px)",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          zIndex:         10000,
          padding:        20,
          animation:      "tfa2Fade .18s ease",
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background:   "#0d0d0d",
            border:       "1.5px solid rgba(132,204,22,.2)",
            borderRadius: 26,
            width:        "100%",
            maxWidth:     400,
            overflow:     "hidden",
            animation:    "tfa2Up .28s cubic-bezier(.16,1,.3,1)",
            boxShadow:    "0 40px 80px rgba(0,0,0,.8), 0 0 0 1px rgba(132,204,22,.06)",
          }}
        >
          {/* Header */}
          <div style={{
            padding:      "20px 22px",
            background:   "rgba(132,204,22,.055)",
            borderBottom: "1px solid rgba(132,204,22,.12)",
            display:      "flex",
            alignItems:   "center",
            justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 13,
                background: "linear-gradient(135deg,#84cc16,#4d7c0f)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#000", boxShadow: "0 4px 14px rgba(132,204,22,.3)",
              }}>
                <Shield size={20} />
              </div>
              <div>
                <div style={{ fontSize: 15.5, fontWeight: 800, color: "#fff" }}>{copy.title}</div>
                <div style={{ fontSize: 11.5, color: "#737373", marginTop: 2 }}>{copy.sub}</div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 10, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", color: "#737373", cursor: "pointer" }}>
              <X size={14} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: "24px" }}>

            {/* Mode switcher */}
            <div style={{ display: "flex", gap: 7, marginBottom: 22 }}>
              {[
                { key: "totp",   label: "🔐 Authenticator App" },
                { key: "backup", label: "🔑 Backup Code"       },
              ].map((m) => (
                <button key={m.key} onClick={() => { setMode(m.key); setErr(""); }} style={{
                  flex: 1, padding: "8px",
                  borderRadius: 10,
                  background: mode === m.key ? "rgba(132,204,22,.1)" : "rgba(255,255,255,.03)",
                  border: `1.5px solid ${mode === m.key ? "rgba(132,204,22,.4)" : "rgba(255,255,255,.07)"}`,
                  color: mode === m.key ? "#a3e635" : "#737373",
                  fontSize: 11.5, fontWeight: 700, cursor: "pointer", transition: "all .18s",
                }}>
                  {m.label}
                </button>
              ))}
            </div>

            {err && (
              <div style={{
                background: "rgba(239,68,68,.07)", border: "1px solid rgba(239,68,68,.22)",
                borderRadius: 11, padding: "10px 13px", color: "#ef4444",
                fontSize: 12.5, marginBottom: 16,
                display: "flex", alignItems: "center", gap: 8,
                animation: "tfa2Shake .35s ease",
              }}>
                <AlertTriangle size={14} style={{ flexShrink: 0 }} /> {err}
              </div>
            )}

            {/* TOTP mode */}
            {mode === "totp" && (
              <>
                <div style={{ textAlign: "center", color: "#a3a3a3", fontSize: 13, marginBottom: 18, lineHeight: 1.65 }}>
                  Open your authenticator app and enter the current <strong style={{ color: "#fff" }}>6-digit code</strong>.
                </div>

                <div style={{ display: "flex", gap: 9, justifyContent: "center", marginBottom: 20 }} onPaste={handleOtpPaste}>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <input
                      key={i}
                      ref={(el) => (otpRefs.current[i] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={otp[i]}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKey(i, e)}
                      autoFocus={i === 0}
                      style={{
                        width: 50, height: 58,
                        background: otp[i] ? "rgba(132,204,22,.07)" : "rgba(255,255,255,.04)",
                        border: `2px solid ${otp[i] ? "rgba(132,204,22,.45)" : "rgba(255,255,255,.09)"}`,
                        borderRadius: 13, color: "#fff", fontSize: 22, fontWeight: 800,
                        textAlign: "center", outline: "none", transition: "all .18s",
                      }}
                    />
                  ))}
                </div>

                <div style={{ fontSize: 11, color: "#484848", textAlign: "center", marginBottom: 18 }}>
                  Code refreshes every 30 seconds
                </div>
              </>
            )}

            {/* Backup code mode */}
            {mode === "backup" && (
              <>
                <div style={{ textAlign: "center", color: "#a3a3a3", fontSize: 13, marginBottom: 18, lineHeight: 1.65 }}>
                  Enter one of your <strong style={{ color: "#fff" }}>backup codes</strong>. Each code works once only.
                </div>
                <input
                  type="text"
                  value={backup}
                  onChange={(e) => { setBackup(e.target.value.toUpperCase()); setErr(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                  placeholder="ABCDE-12345"
                  autoFocus
                  style={{
                    width: "100%", boxSizing: "border-box",
                    padding: "13px 15px",
                    background: "rgba(255,255,255,.04)",
                    border: "1.5px solid rgba(255,255,255,.09)",
                    borderRadius: 12, color: "#fff",
                    fontSize: 16, fontWeight: 700, fontFamily: "monospace",
                    textAlign: "center", letterSpacing: 3, outline: "none",
                    marginBottom: 18, transition: "border-color .2s",
                  }}
                  onFocus={(e) => e.target.style.borderColor = "#84cc16"}
                  onBlur={(e)  => e.target.style.borderColor = "rgba(255,255,255,.09)"}
                />
              </>
            )}

            {/* Verify button */}
            <button
              onClick={handleVerify}
              disabled={loading || (mode === "totp" ? otp.join("").length !== 6 : !backup.trim())}
              style={{
                width: "100%", padding: "14px", border: "none", borderRadius: 13,
                fontSize: 14.5, fontWeight: 800, cursor: "pointer",
                background: loading || (mode === "totp" ? otp.join("").length !== 6 : !backup.trim())
                  ? "rgba(255,255,255,.06)"
                  : "linear-gradient(135deg,#84cc16,#4d7c0f)",
                color: loading || (mode === "totp" ? otp.join("").length !== 6 : !backup.trim())
                  ? "#555" : "#000",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
                boxShadow: "0 4px 18px rgba(132,204,22,.2)", transition: "all .2s",
              }}
            >
              {loading
                ? <><Loader size={17} style={{ animation: "tfa2Spin 1s linear infinite" }} /> Verifying…</>
                : <><Shield size={17} /> Verify</>
              }
            </button>

          </div>
        </div>
      </div>
    </>
  );
}