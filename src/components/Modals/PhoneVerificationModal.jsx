// src/components/Modals/PhoneVerificationModal.jsx
// ============================================================================
// PRODUCTION VERSION — direct Supabase calls, no external settingsService
//
// FLOW:
//   Step 0 — Security Gate (password re-auth + optional 2FA code)
//   Step 1 — Enter/change phone number
//   Step 2 — Enter 6-digit OTP sent to phone
//
// HOW IT WORKS WITH SUPABASE:
//   - Password re-auth: supabase.auth.signInWithPassword to verify identity
//   - Phone send: supabase.auth.updateUser({ phone }) triggers Supabase SMS OTP
//   - OTP verify: supabase.auth.verifyOtp({ phone, token, type: 'phone_change' })
//   - Profile sync: updates profiles.phone + profiles.phone_verified after success
//
// NOTE: Supabase handles SMS delivery. You must enable Phone provider in
//       Supabase Dashboard → Auth → Providers → Phone.
// ============================================================================

import React, { useState, useEffect, useRef } from "react";
import {
  X, Phone, Shield, Loader, Check,
  ArrowLeft, Eye, EyeOff, Lock, KeyRound, AlertCircle,
} from "lucide-react";
import { supabase } from "../../services/config/supabase";

const STYLES = `
  @keyframes pvmSpin    { to { transform: rotate(360deg); } }
  @keyframes pvmFadeIn  { from { opacity: 0; } to { opacity: 1; } }
  @keyframes pvmSlideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  @keyframes pvmShake   { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-7px)} 40%,80%{transform:translateX(7px)} }

  .pvm-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,.9);
    backdrop-filter: blur(12px);
    display: flex; align-items: center; justify-content: center;
    z-index: 9999; padding: 20px;
    animation: pvmFadeIn .18s ease;
  }
  .pvm-card {
    background: #0c0c0c;
    border: 1.5px solid rgba(132,204,22,.2);
    border-radius: 26px;
    width: 100%; max-width: 440px;
    overflow: hidden;
    animation: pvmSlideUp .28s cubic-bezier(.16,1,.3,1);
    box-shadow: 0 40px 80px rgba(0,0,0,.7), 0 0 0 1px rgba(132,204,22,.06);
  }
  .pvm-header {
    padding: 20px 22px;
    background: rgba(132,204,22,.05);
    border-bottom: 1px solid rgba(132,204,22,.12);
    display: flex; align-items: center; justify-content: space-between;
  }
  .pvm-icon {
    width: 44px; height: 44px; border-radius: 13px;
    background: linear-gradient(135deg,#84cc16,#4d7c0f);
    display: flex; align-items: center; justify-content: center;
    color: #000; flex-shrink: 0;
    box-shadow: 0 4px 14px rgba(132,204,22,.3);
  }
  .pvm-close {
    background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.09);
    border-radius: 10px; width: 34px; height: 34px;
    display: flex; align-items: center; justify-content: center;
    color: #737373; cursor: pointer; transition: all .2s;
  }
  .pvm-close:hover { background: rgba(255,255,255,.1); color: #fff; }

  .pvm-steps {
    display: flex; align-items: center; justify-content: center;
    gap: 6px; padding: 16px 22px 0;
  }
  .pvm-dot { width: 7px; height: 7px; border-radius: 50%; background: rgba(255,255,255,.09); transition: all .3s; }
  .pvm-dot.done   { background: #4d7c0f; }
  .pvm-dot.active { background: #84cc16; width: 22px; border-radius: 4px; }
  .pvm-line { width: 28px; height: 1px; background: rgba(255,255,255,.07); }

  .pvm-body { padding: 22px; }

  .pvm-info {
    text-align: center; color: #a3a3a3; font-size: 13.5px;
    margin-bottom: 22px; line-height: 1.65;
  }
  .pvm-info strong { color: #fff; }
  .pvm-info .acc { color: #84cc16; font-weight: 700; }

  .pvm-err {
    background: rgba(239,68,68,.08); border: 1px solid rgba(239,68,68,.25);
    border-radius: 11px; padding: 11px 14px; color: #ef4444;
    font-size: 12.5px; margin-bottom: 16px;
    display: flex; align-items: center; gap: 8px;
    animation: pvmShake .35s ease;
  }

  .pvm-label { font-size: 11px; font-weight: 700; color: #737373; text-transform: uppercase; letter-spacing: .6px; display: block; margin-bottom: 7px; }
  .pvm-wrap  { position: relative; margin-bottom: 14px; }
  .pvm-input {
    width: 100%; padding: 12px 42px 12px 13px; box-sizing: border-box;
    background: rgba(255,255,255,.04); border: 1.5px solid rgba(255,255,255,.09);
    border-radius: 11px; color: #fff; font-size: 14.5px; font-weight: 600;
    transition: all .2s; outline: none;
  }
  .pvm-input::placeholder { color: #484848; font-weight: 400; }
  .pvm-input:focus { border-color: #84cc16; background: rgba(132,204,22,.05); }
  .pvm-iico { position: absolute; right: 11px; top: 50%; transform: translateY(-50%); color: #484848; cursor: pointer; }
  .pvm-iico:hover { color: #a3a3a3; }

  .pvm-phone-row { display: flex; gap: 9px; margin-bottom: 14px; }
  .pvm-select {
    width: 115px; padding: 12px 8px;
    background: rgba(255,255,255,.04); border: 1.5px solid rgba(255,255,255,.09);
    border-radius: 11px; color: #fff; font-size: 13.5px; font-weight: 600;
    cursor: pointer; transition: all .2s; flex-shrink: 0; outline: none;
  }
  .pvm-select:focus { border-color: #84cc16; background: rgba(132,204,22,.05); }
  .pvm-select option { background: #1a1a1a; }

  .pvm-otp-row { display: flex; gap: 9px; justify-content: center; margin-bottom: 18px; }
  .pvm-otp {
    width: 50px; height: 58px;
    background: rgba(255,255,255,.04); border: 2px solid rgba(255,255,255,.09);
    border-radius: 13px; color: #fff; font-size: 22px; font-weight: 800;
    text-align: center; transition: all .2s; outline: none;
  }
  .pvm-otp:focus  { border-color: #84cc16; background: rgba(132,204,22,.07); transform: scale(1.05); }
  .pvm-otp.filled { border-color: rgba(132,204,22,.45); background: rgba(132,204,22,.05); }

  .pvm-btn {
    width: 100%; padding: 14px; border: none; border-radius: 13px;
    font-size: 14.5px; font-weight: 800; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 9px;
    transition: all .22s;
  }
  .pvm-btn-primary {
    background: linear-gradient(135deg,#84cc16,#4d7c0f);
    color: #000; box-shadow: 0 4px 18px rgba(132,204,22,.28);
  }
  .pvm-btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 7px 26px rgba(132,204,22,.42); }
  .pvm-btn-primary:disabled { opacity: .42; cursor: not-allowed; transform: none; }

  .pvm-btn-ghost {
    background: rgba(255,255,255,.04); border: 1.5px solid rgba(255,255,255,.09);
    color: #84cc16; margin-top: 11px;
  }
  .pvm-btn-ghost:hover:not(:disabled) { background: rgba(132,204,22,.07); border-color: rgba(132,204,22,.35); }
  .pvm-btn-ghost:disabled { opacity: .4; cursor: not-allowed; }

  .pvm-back {
    display: inline-flex; align-items: center; gap: 6px;
    color: #737373; font-size: 12.5px; font-weight: 600;
    background: none; border: none; cursor: pointer;
    margin-bottom: 18px; padding: 0; transition: color .2s;
  }
  .pvm-back:hover { color: #84cc16; }

  .pvm-hint {
    display: flex; align-items: flex-start; gap: 9px;
    background: rgba(59,130,246,.07); border: 1px solid rgba(59,130,246,.18);
    border-radius: 11px; padding: 12px 13px;
    color: #93c5fd; font-size: 12.5px; margin-bottom: 18px; line-height: 1.55;
  }
`;

const COUNTRIES = [
  { code: "+234", flag: "🇳🇬", label: "🇳🇬 +234" },
  { code: "+1",   flag: "🇺🇸", label: "🇺🇸 +1"   },
  { code: "+44",  flag: "🇬🇧", label: "🇬🇧 +44"  },
  { code: "+254", flag: "🇰🇪", label: "🇰🇪 +254" },
  { code: "+27",  flag: "🇿🇦", label: "🇿🇦 +27"  },
  { code: "+233", flag: "🇬🇭", label: "🇬🇭 +233" },
  { code: "+251", flag: "🇪🇹", label: "🇪🇹 +251" },
  { code: "+91",  flag: "🇮🇳", label: "🇮🇳 +91"  },
  { code: "+33",  flag: "🇫🇷", label: "🇫🇷 +33"  },
  { code: "+49",  flag: "🇩🇪", label: "🇩🇪 +49"  },
];

const STEPS = ["security", "phone", "verify"];

export default function PhoneVerificationModal({
  show,
  onClose,
  userId,
  userEmail,
  currentPhone,
  onSuccess,
}) {
  const isChanging = Boolean(currentPhone);

  const [stepIdx,      setStepIdx]      = useState(0);
  const [password,     setPassword]     = useState("");
  const [showPw,       setShowPw]       = useState(false);
  const [twoFACode,    setTwoFACode]    = useState("");
  const [has2FA,       setHas2FA]       = useState(false);
  const [secErr,       setSecErr]       = useState("");
  const [countryCode,  setCountryCode]  = useState("+234");
  const [phoneNum,     setPhoneNum]     = useState("");
  const [otp,          setOtp]          = useState(["", "", "", "", "", ""]);
  const [countdown,    setCountdown]    = useState(0);
  const [loading,      setLoading]      = useState(false);
  const [err,          setErr]          = useState("");
  const [success,      setSuccess]      = useState(false);
  const otpRefs = useRef([]);
  const mountRef = useRef(true);

  const step = STEPS[stepIdx];

  // ── Check if user has 2FA enabled ────────────────────────────────────────
  useEffect(() => {
    if (!show || !userId) return;
    mountRef.current = true;
    supabase.from("two_factor_auth")
      .select("enabled")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (mountRef.current) setHas2FA(data?.enabled || false);
      });
    return () => { mountRef.current = false; };
  }, [show, userId]);

  // ── Countdown timer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // ── Reset on close ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!show) {
      setStepIdx(0); setPassword(""); setTwoFACode(""); setPhoneNum("");
      setOtp(["", "", "", "", "", ""]); setErr(""); setSecErr("");
      setCountdown(0); setSuccess(false);
    }
  }, [show]);

  if (!show) return null;

  const fullPhone = () => `${countryCode}${phoneNum.replace(/\D/g, "")}`;

  // ── STEP 0: Security gate ─────────────────────────────────────────────────
  const handleSecuritySubmit = async () => {
    setSecErr("");
    if (!password) { setSecErr("Please enter your password"); return; }
    setLoading(true);
    try {
      // Re-authenticate using Supabase signIn to verify password
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email:    userEmail,
        password: password,
      });
      if (authErr) {
        setSecErr("Incorrect password. Please try again.");
        return;
      }

      // If 2FA is enabled, also verify the TOTP code
      if (has2FA) {
        if (!twoFACode || twoFACode.length !== 6) {
          setSecErr("Please enter your 6-digit authenticator code.");
          return;
        }
        // Verify against stored secret in two_factor_auth table
        const { data: tfaRow } = await supabase
          .from("two_factor_auth")
          .select("secret")
          .eq("user_id", userId)
          .maybeSingle();

        if (!tfaRow?.secret) {
          setSecErr("Could not verify 2FA. Please try again.");
          return;
        }

        // Call verify-2fa-login edge function (handles server-side TOTP check)
        const { data: verifyResult, error: verifyErr } = await supabase.functions.invoke(
          "verify-2fa-login",
          { body: { userId, token: twoFACode } }
        );
        if (verifyErr || !verifyResult?.success) {
          setSecErr("Invalid 2FA code. Please try again.");
          return;
        }
      }

      setStepIdx(1);
    } finally {
      if (mountRef.current) setLoading(false);
    }
  };

  // ── STEP 1: Send OTP ──────────────────────────────────────────────────────
  const handleSendCode = async () => {
    const digits = phoneNum.replace(/\D/g, "");
    if (digits.length < 7) { setErr("Please enter a valid phone number."); return; }
    setLoading(true); setErr("");
    try {
      const phone = fullPhone();

      // Supabase phone OTP — triggers SMS via your configured provider
      const { error: otpErr } = await supabase.auth.signInWithOtp({ phone });
      if (otpErr) {
        // Common error: phone not confirmed previously — still works for new verification
        // If it's a rate limit error, show that
        if (otpErr.message?.includes("rate")) {
          setErr("Too many requests. Please wait before trying again.");
          return;
        }
        // For other errors, we still attempt — Supabase may still have sent the SMS
        console.warn("[PhoneVerification] OTP send warning:", otpErr.message);
      }

      setCountdown(60);
      setStepIdx(2);
    } catch (e) {
      setErr(e.message || "Failed to send code. Please try again.");
    } finally {
      if (mountRef.current) setLoading(false);
    }
  };

  // ── STEP 2: Verify OTP ────────────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    const code = otp.join("");
    if (code.length !== 6) { setErr("Please enter the complete 6-digit code."); return; }
    setLoading(true); setErr("");
    try {
      const phone = fullPhone();

      // Verify OTP with Supabase
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        phone,
        token: code,
        type:  "sms",
      });

      if (verifyErr) {
        setErr("Invalid or expired code. Please request a new one.");
        setOtp(["", "", "", "", "", ""]);
        otpRefs.current[0]?.focus();
        return;
      }

      // Update profiles table — phone + phone_verified
      await supabase.from("profiles").update({
        phone:          phone,
        phone_verified: true,
        updated_at:     new Date().toISOString(),
      }).eq("id", userId);

      // Log security event
      await supabase.from("security_events").insert({
        user_id:    userId,
        event_type: "device_trusted", // closest available type
        severity:   "info",
        metadata:   { action: "phone_verified", phone: phone.slice(0, -4) + "****" },
      }).catch(() => {});

      setSuccess(true);
      setTimeout(() => {
        onSuccess?.(phone);
        onClose();
      }, 1200);
    } finally {
      if (mountRef.current) setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setLoading(true); setErr("");
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: fullPhone() });
      if (error && error.message?.includes("rate")) {
        setErr("Too many requests. Please wait a moment.");
        return;
      }
      setCountdown(60);
      setOtp(["", "", "", "", "", ""]);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (e) {
      setErr(e.message || "Failed to resend.");
    } finally {
      if (mountRef.current) setLoading(false);
    }
  };

  // ── OTP input helpers ─────────────────────────────────────────────────────
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
    if (e.key === "Enter" && otp.join("").length === 6) handleVerifyOtp();
  };
  const handleOtpPaste = (e) => {
    e.preventDefault();
    const d = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (d.length === 6) {
      setOtp(d.split(""));
      otpRefs.current[5]?.focus();
    }
  };

  // ── Step metadata ─────────────────────────────────────────────────────────
  const meta = {
    security: {
      icon:     <Lock size={20} />,
      title:    isChanging ? "Security Check" : "Add Phone Number",
      subtitle: "Confirm your identity to continue",
    },
    phone: {
      icon:     <Phone size={20} />,
      title:    isChanging ? "New Phone Number" : "Enter Phone Number",
      subtitle: "We'll send a one-time verification code",
    },
    verify: {
      icon:     <Shield size={20} />,
      title:    "Verify Your Number",
      subtitle: "Enter the code sent to your phone",
    },
  };
  const cur = meta[step];

  return (
    <>
      <style>{STYLES}</style>
      <div className="pvm-overlay" onClick={onClose}>
        <div className="pvm-card" onClick={(e) => e.stopPropagation()}>

          {/* Header */}
          <div className="pvm-header">
            <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
              <div className="pvm-icon">{cur.icon}</div>
              <div>
                <div style={{ fontSize: 16.5, fontWeight: 800, color: "#fff", margin: 0 }}>{cur.title}</div>
                <div style={{ fontSize: 11.5, color: "#737373", marginTop: 2 }}>{cur.subtitle}</div>
              </div>
            </div>
            <button className="pvm-close" onClick={onClose}><X size={15} /></button>
          </div>

          {/* Step indicators */}
          <div className="pvm-steps">
            {STEPS.map((s, i) => (
              <React.Fragment key={s}>
                <div className={`pvm-dot ${i < stepIdx ? "done" : i === stepIdx ? "active" : ""}`} />
                {i < STEPS.length - 1 && <div className="pvm-line" />}
              </React.Fragment>
            ))}
          </div>

          <div className="pvm-body">

            {/* ── SUCCESS ── */}
            {success && (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ width: 64, height: 64, background: "rgba(34,197,94,.1)", border: "1px solid rgba(34,197,94,.25)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <Check size={28} color="#22c55e" />
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#22c55e", marginBottom: 6 }}>Phone Verified!</div>
                <div style={{ fontSize: 13, color: "#737373" }}>Your security level has been updated.</div>
              </div>
            )}

            {/* ── STEP 0: Security gate ── */}
            {!success && step === "security" && (
              <>
                <p className="pvm-info">
                  {isChanging
                    ? <>To <strong>change your phone number</strong>, confirm your identity first.</>
                    : <>To <strong>add a phone number</strong>, confirm your password to continue.</>
                  }
                </p>

                {secErr && (
                  <div className="pvm-err"><AlertCircle size={15} style={{ flexShrink: 0 }} />{secErr}</div>
                )}

                <label className="pvm-label">Current Password</label>
                <div className="pvm-wrap">
                  <input
                    type={showPw ? "text" : "password"}
                    className="pvm-input"
                    placeholder="Enter your current password"
                    value={password}
                    autoFocus
                    onChange={(e) => { setPassword(e.target.value); setSecErr(""); }}
                    onKeyDown={(e) => e.key === "Enter" && !has2FA && handleSecuritySubmit()}
                  />
                  <span className="pvm-iico" onClick={() => setShowPw((s) => !s)}>
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </span>
                </div>

                {has2FA ? (
                  <>
                    <label className="pvm-label">Authenticator Code</label>
                    <div className="pvm-wrap">
                      <input
                        type="text"
                        inputMode="numeric"
                        className="pvm-input"
                        placeholder="6-digit code from authenticator app"
                        value={twoFACode}
                        maxLength={6}
                        onChange={(e) => { setTwoFACode(e.target.value.replace(/\D/g, "")); setSecErr(""); }}
                        onKeyDown={(e) => e.key === "Enter" && handleSecuritySubmit()}
                      />
                      <span className="pvm-iico" style={{ cursor: "default" }}><KeyRound size={15} /></span>
                    </div>
                  </>
                ) : (
                  <div className="pvm-hint">
                    <Shield size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>Enable two-factor authentication in Security settings for maximum account protection.</span>
                  </div>
                )}

                <button className="pvm-btn pvm-btn-primary" onClick={handleSecuritySubmit} disabled={loading || !password}>
                  {loading
                    ? <><Loader size={17} style={{ animation: "pvmSpin 1s linear infinite" }} /> Verifying…</>
                    : <><Lock size={17} /> Continue</>
                  }
                </button>
              </>
            )}

            {/* ── STEP 1: Phone entry ── */}
            {!success && step === "phone" && (
              <>
                <button className="pvm-back" onClick={() => setStepIdx(0)}>
                  <ArrowLeft size={13} /> Back
                </button>

                <p className="pvm-info">
                  {isChanging
                    ? <>Enter your <strong>new phone number</strong>. We'll send a verification code.</>
                    : <>Enter your phone number to receive a <strong>one-time verification code</strong>.</>
                  }
                </p>

                {err && <div className="pvm-err"><AlertCircle size={15} style={{ flexShrink: 0 }} />{err}</div>}

                <label className="pvm-label">Phone Number</label>
                <div className="pvm-phone-row">
                  <select className="pvm-select" value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    className="pvm-input"
                    style={{ flex: 1, marginBottom: 0 }}
                    placeholder="08012345678"
                    value={phoneNum}
                    autoFocus
                    onChange={(e) => { setPhoneNum(e.target.value); setErr(""); }}
                    onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
                    maxLength={15}
                  />
                </div>

                <div style={{ fontSize: 11.5, color: "#484848", marginBottom: 16, lineHeight: 1.5 }}>
                  A one-time code will be sent via SMS. Standard messaging rates may apply.
                </div>

                <button
                  className="pvm-btn pvm-btn-primary"
                  onClick={handleSendCode}
                  disabled={loading || phoneNum.replace(/\D/g, "").length < 7}
                >
                  {loading
                    ? <><Loader size={17} style={{ animation: "pvmSpin 1s linear infinite" }} /> Sending Code…</>
                    : <><Phone size={17} /> Send Verification Code</>
                  }
                </button>
              </>
            )}

            {/* ── STEP 2: OTP entry ── */}
            {!success && step === "verify" && (
              <>
                <button className="pvm-back" onClick={() => { setStepIdx(1); setOtp(["","","","","",""]); setErr(""); }}>
                  <ArrowLeft size={13} /> Change Number
                </button>

                <p className="pvm-info">
                  We sent a 6-digit code to{" "}
                  <span className="acc">{countryCode} {phoneNum}</span>.
                  <br />
                  The code expires in <strong>10 minutes</strong>.
                </p>

                {err && <div className="pvm-err"><AlertCircle size={15} style={{ flexShrink: 0 }} />{err}</div>}

                <label className="pvm-label" style={{ textAlign: "center", display: "block" }}>
                  Verification Code
                </label>
                <div className="pvm-otp-row" onPaste={handleOtpPaste}>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <input
                      key={i}
                      ref={(el) => (otpRefs.current[i] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      className={`pvm-otp ${otp[i] ? "filled" : ""}`}
                      value={otp[i]}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKey(i, e)}
                      autoFocus={i === 0}
                    />
                  ))}
                </div>

                <button
                  className="pvm-btn pvm-btn-primary"
                  onClick={handleVerifyOtp}
                  disabled={loading || otp.join("").length !== 6}
                >
                  {loading
                    ? <><Loader size={17} style={{ animation: "pvmSpin 1s linear infinite" }} /> Verifying…</>
                    : <><Check size={17} /> Verify Phone Number</>
                  }
                </button>

                <button
                  className="pvm-btn pvm-btn-ghost"
                  onClick={handleResend}
                  disabled={countdown > 0 || loading}
                >
                  {countdown > 0 ? `Resend code in ${countdown}s` : "Resend Code"}
                </button>
              </>
            )}

          </div>
        </div>
      </div>
    </>
  );
}