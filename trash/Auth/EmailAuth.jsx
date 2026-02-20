// ============================================================================
// src/components/Auth/EmailAuth.jsx — v14 FINAL
//
// Uses supabase.auth.signInWithOtp() + supabase.auth.verifyOtp() directly.
// No custom emailVerificationService needed.
// shouldCreateUser: true handles both new signups and returning users.
// Auto-verifies when all 6 digits are entered or pasted.
// ============================================================================

import React, { useState, useRef, useEffect } from "react";
import { supabase } from "../../services/config/supabase";

const OTP_LENGTH = 6;

export default function EmailAuth({ onSuccess, onBack, initialEmail = "" }) {
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState(Array(OTP_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const codeRefs = useRef([]);
  const cooldownRef = useRef(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const startCooldown = () => {
    setCooldown(60);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // ── Send OTP ──────────────────────────────────────────────────────────────
  const handleEmailSubmit = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: { shouldCreateUser: true },
      });
      if (otpError) throw otpError;
      if (mounted.current) {
        setStep("code");
        startCooldown();
        setTimeout(() => codeRefs.current[0]?.focus(), 150);
      }
    } catch (err) {
      if (mounted.current)
        setError(err.message || "Failed to send code. Please try again.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  // ── Verify OTP ────────────────────────────────────────────────────────────
  const handleVerify = async (codeArr) => {
    const digits = codeArr || code;
    const fullCode = digits.join("");
    if (fullCode.length !== OTP_LENGTH || loading) return;

    setLoading(true);
    setError("");
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: fullCode,
        type: "email",
      });
      if (verifyError) throw verifyError;
      if (mounted.current && onSuccess) onSuccess(data);
    } catch (err) {
      if (mounted.current) {
        setError(err.message || "Invalid code. Please try again.");
        setCode(Array(OTP_LENGTH).fill(""));
        setTimeout(() => codeRefs.current[0]?.focus(), 50);
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  // ── Code input ────────────────────────────────────────────────────────────
  const handleCodeChange = (index, value) => {
    if (value.length > 1) {
      const digits = value.replace(/\D/g, "").slice(0, OTP_LENGTH).split("");
      const newCode = Array(OTP_LENGTH).fill("");
      digits.forEach((d, i) => {
        newCode[i] = d;
      });
      setCode(newCode);
      const nextEmpty = newCode.findIndex((d) => d === "");
      codeRefs.current[nextEmpty === -1 ? OTP_LENGTH - 1 : nextEmpty]?.focus();
      if (digits.length === OTP_LENGTH)
        setTimeout(() => handleVerify(newCode), 100);
      return;
    }
    const digit = value.replace(/\D/g, "");
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);
    if (digit && index < OTP_LENGTH - 1) codeRefs.current[index + 1]?.focus();
    if (
      digit &&
      index === OTP_LENGTH - 1 &&
      newCode.join("").length === OTP_LENGTH
    ) {
      setTimeout(() => handleVerify(newCode), 100);
    }
  };

  const handleCodeKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (code[index]) {
        const newCode = [...code];
        newCode[index] = "";
        setCode(newCode);
      } else if (index > 0) {
        codeRefs.current[index - 1]?.focus();
      }
    }
    if (e.key === "ArrowLeft" && index > 0)
      codeRefs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < OTP_LENGTH - 1)
      codeRefs.current[index + 1]?.focus();
  };

  const handleResend = async () => {
    if (cooldown > 0 || loading) return;
    setLoading(true);
    setError("");
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: true },
      });
      if (otpError) throw otpError;
      if (mounted.current) {
        setCode(Array(OTP_LENGTH).fill(""));
        startCooldown();
        setTimeout(() => codeRefs.current[0]?.focus(), 100);
      }
    } catch (err) {
      if (mounted.current) setError(err.message || "Failed to resend.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  const isMobile = window.innerWidth <= 480;

  const wrap = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100dvh",
    background: "#000",
    padding: isMobile ? "12px" : "24px",
  };
  const card = {
    width: "100%",
    maxWidth: "400px",
    background: "#0d0d0e",
    border: "1px solid #1f1f23",
    borderRadius: isMobile ? "16px" : "20px",
    padding: isMobile ? "24px 20px" : "36px 32px",
  };
  const backBtn = {
    background: "none",
    border: "none",
    color: "#71717a",
    cursor: "pointer",
    fontSize: "13px",
    padding: "0",
    marginBottom: isMobile ? "16px" : "20px",
    display: "flex",
    alignItems: "center",
    gap: "5px",
  };
  const iconWrap = {
    width: "52px",
    height: "52px",
    borderRadius: "50%",
    border: "2px solid rgba(163,230,53,0.4)",
    background: "rgba(163,230,53,0.06)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 16px",
    fontSize: "22px",
  };
  const heading = {
    color: "#fff",
    fontSize: isMobile ? "20px" : "22px",
    fontWeight: "700",
    textAlign: "center",
    margin: "0 0 6px",
  };
  const sub = {
    color: "#71717a",
    fontSize: "13px",
    textAlign: "center",
    margin: "0 0 20px",
    lineHeight: "1.5",
  };
  const errBox = {
    background: "rgba(239,68,68,0.08)",
    border: "1px solid rgba(239,68,68,0.25)",
    borderRadius: "10px",
    color: "#f87171",
    fontSize: "13px",
    padding: "10px 12px",
    marginBottom: "14px",
    textAlign: "center",
  };
  const input = {
    width: "100%",
    background: "#18181b",
    border: "1.5px solid #27272a",
    borderRadius: "12px",
    padding: "13px 14px",
    color: "#fff",
    fontSize: "15px",
    outline: "none",
    boxSizing: "border-box",
    marginBottom: "14px",
  };
  const primaryBtn = (disabled) => ({
    width: "100%",
    padding: "13px",
    borderRadius: "12px",
    border: "none",
    background: "linear-gradient(135deg,#84cc16,#65a30d)",
    color: "#000",
    fontWeight: "700",
    fontSize: "15px",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.7 : 1,
  });

  return (
    <div style={wrap}>
      <div style={card}>
        <button
          onClick={
            step === "code"
              ? () => {
                  setStep("email");
                  setError("");
                  setCode(Array(OTP_LENGTH).fill(""));
                }
              : onBack
          }
          style={backBtn}
        >
          ← {step === "code" ? "Change email" : "Back"}
        </button>

        {step === "email" ? (
          <>
            <div style={iconWrap}>✉️</div>
            <h2 style={heading}>Enter your email</h2>
            <p style={sub}>
              We'll send a {OTP_LENGTH}-digit code. No password needed.
            </p>
            {error && <div style={errBox}>{error}</div>}
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleEmailSubmit()}
              autoFocus
              autoComplete="email"
              disabled={loading}
              style={input}
            />
            <button
              onClick={handleEmailSubmit}
              disabled={loading}
              style={primaryBtn(loading)}
            >
              {loading ? "Sending…" : "Continue →"}
            </button>
          </>
        ) : (
          <>
            <div style={iconWrap}>📬</div>
            <h2 style={heading}>Check your email</h2>
            <p style={sub}>
              Code sent to{" "}
              <span style={{ color: "#a3e635", fontWeight: "600" }}>
                {email}
              </span>
            </p>
            {error && <div style={errBox}>{error}</div>}

            <div
              style={{
                display: "flex",
                gap: isMobile ? "6px" : "8px",
                justifyContent: "center",
                marginBottom: "16px",
              }}
            >
              {code.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => (codeRefs.current[i] = el)}
                  type="tel"
                  inputMode="numeric"
                  maxLength={OTP_LENGTH}
                  value={digit}
                  onChange={(e) => handleCodeChange(i, e.target.value)}
                  onKeyDown={(e) => handleCodeKeyDown(i, e)}
                  onFocus={(e) => e.target.select()}
                  disabled={loading}
                  autoComplete={i === 0 ? "one-time-code" : "off"}
                  style={{
                    width: isMobile ? "42px" : "46px",
                    height: isMobile ? "50px" : "54px",
                    background: digit ? "rgba(163,230,53,0.06)" : "#18181b",
                    borderWidth: "2px",
                    borderStyle: "solid",
                    borderColor: digit ? "#a3e635" : "#27272a",
                    borderRadius: "10px",
                    color: "#fff",
                    fontSize: isMobile ? "20px" : "22px",
                    fontWeight: "700",
                    textAlign: "center",
                    outline: "none",
                    caretColor: "#a3e635",
                    transition: "border-color 0.15s, background 0.15s",
                  }}
                />
              ))}
            </div>

            {loading && (
              <div
                style={{
                  textAlign: "center",
                  color: "#84cc16",
                  fontSize: "13px",
                  marginBottom: "10px",
                }}
              >
                Verifying…
              </div>
            )}

            <button
              onClick={() => handleVerify(code)}
              disabled={loading || code.join("").length < OTP_LENGTH}
              style={{
                ...primaryBtn(loading || code.join("").length < OTP_LENGTH),
                marginBottom: "10px",
                transition: "opacity 0.2s",
              }}
            >
              {loading ? "Verifying…" : "Verify Code →"}
            </button>

            <button
              onClick={handleResend}
              disabled={cooldown > 0 || loading}
              style={{
                background: "none",
                border: "none",
                color: cooldown > 0 ? "#3f3f46" : "#a3e635",
                fontSize: "13px",
                cursor: cooldown > 0 ? "default" : "pointer",
                width: "100%",
                padding: "8px",
                textAlign: "center",
              }}
            >
              {cooldown > 0
                ? `Resend in ${cooldown}s`
                : "Didn't get it? Resend"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
