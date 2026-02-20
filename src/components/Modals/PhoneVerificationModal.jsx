// ============================================================================
// src/components/Modals/PhoneVerificationModal.jsx
// Full flow: Security Gate (password + optional 2FA) → Enter/Change Phone → Verify Code
// ============================================================================

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Phone,
  Shield,
  Loader,
  Check,
  ArrowLeft,
  Eye,
  EyeOff,
  Lock,
  KeyRound,
  AlertCircle,
} from "lucide-react";
import settingsService from "../../services/account/settingsService";

// ─── Styles ────────────────────────────────────────────────────────────────
const STYLES = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes slideUp {
    from { transform: translateY(24px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }
  @keyframes shake {
    0%,100% { transform: translateX(0); }
    20%,60% { transform: translateX(-6px); }
    40%,80% { transform: translateX(6px); }
  }

  .pvm-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,.88);
    backdrop-filter: blur(10px);
    display: flex; align-items: center; justify-content: center;
    z-index: 9999; padding: 20px;
    animation: fadeIn .2s ease;
  }

  .pvm-card {
    background: #0d0d0d;
    border: 1.5px solid rgba(132,204,22,.25);
    border-radius: 28px;
    width: 100%; max-width: 460px;
    overflow: hidden;
    animation: slideUp .3s ease;
    box-shadow: 0 40px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(132,204,22,.08);
  }

  /* — header — */
  .pvm-header {
    padding: 22px 24px;
    background: rgba(132,204,22,.06);
    border-bottom: 1px solid rgba(132,204,22,.15);
    display: flex; align-items: center; justify-content: space-between;
  }
  .pvm-header-left { display: flex; align-items: center; gap: 14px; }
  .pvm-icon {
    width: 46px; height: 46px; border-radius: 14px;
    background: linear-gradient(135deg,#84cc16,#4d7c0f);
    display: flex; align-items: center; justify-content: center;
    color: #000; flex-shrink: 0;
    box-shadow: 0 4px 16px rgba(132,204,22,.35);
  }
  .pvm-title { font-size: 18px; font-weight: 800; color: #fff; margin: 0; }
  .pvm-subtitle { font-size: 12px; color: #737373; margin: 3px 0 0; }
  .pvm-close {
    background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1);
    border-radius: 10px; width: 36px; height: 36px;
    display: flex; align-items: center; justify-content: center;
    color: #a3a3a3; cursor: pointer; transition: all .2s;
  }
  .pvm-close:hover { background: rgba(255,255,255,.1); color: #fff; }

  /* — progress steps — */
  .pvm-steps {
    display: flex; align-items: center; justify-content: center;
    gap: 8px; padding: 18px 24px 0;
  }
  .pvm-step-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: rgba(255,255,255,.1); transition: all .3s;
  }
  .pvm-step-dot.done { background: #4d7c0f; }
  .pvm-step-dot.active { background: #84cc16; width: 24px; border-radius: 4px; }
  .pvm-step-line { width: 32px; height: 1px; background: rgba(255,255,255,.08); }

  /* — body — */
  .pvm-body { padding: 24px; }

  .pvm-info-text {
    text-align: center; color: #a3a3a3; font-size: 14px;
    margin-bottom: 24px; line-height: 1.65;
  }
  .pvm-info-text strong { color: #fff; }
  .pvm-info-text .accent { color: #84cc16; font-weight: 700; }

  /* — error / warning banners — */
  .pvm-error {
    background: rgba(239,68,68,.1); border: 1px solid rgba(239,68,68,.3);
    border-radius: 12px; padding: 12px 14px; color: #ef4444;
    font-size: 13px; margin-bottom: 18px;
    display: flex; align-items: center; gap: 8px;
    animation: shake .35s ease;
  }

  /* — input group — */
  .pvm-label {
    font-size: 12px; font-weight: 700; color: #737373;
    text-transform: uppercase; letter-spacing: .6px;
    display: block; margin-bottom: 8px;
  }
  .pvm-input-wrap { position: relative; margin-bottom: 16px; }
  .pvm-input {
    width: 100%; padding: 13px 44px 13px 14px; box-sizing: border-box;
    background: rgba(255,255,255,.04); border: 1.5px solid rgba(255,255,255,.1);
    border-radius: 12px; color: #fff; font-size: 15px; font-weight: 600;
    transition: all .2s;
  }
  .pvm-input::placeholder { color: #525252; }
  .pvm-input:focus {
    outline: none;
    border-color: #84cc16;
    background: rgba(132,204,22,.06);
  }
  .pvm-input-icon {
    position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
    color: #525252; cursor: pointer;
  }
  .pvm-input-icon:hover { color: #a3a3a3; }

  /* — phone row — */
  .pvm-phone-row { display: flex; gap: 10px; margin-bottom: 16px; }
  .pvm-country {
    width: 110px; padding: 13px 8px;
    background: rgba(255,255,255,.04); border: 1.5px solid rgba(255,255,255,.1);
    border-radius: 12px; color: #fff; font-size: 14px; font-weight: 600;
    cursor: pointer; transition: all .2s; flex-shrink: 0;
  }
  .pvm-country:focus {
    outline: none; border-color: #84cc16;
    background: rgba(132,204,22,.06);
  }
  .pvm-country option { background: #1a1a1a; }

  /* — OTP inputs — */
  .pvm-otp-row {
    display: flex; gap: 10px; justify-content: center;
    margin-bottom: 20px;
  }
  .pvm-otp-input {
    width: 52px; height: 60px;
    background: rgba(255,255,255,.04); border: 2px solid rgba(255,255,255,.1);
    border-radius: 14px; color: #fff; font-size: 22px; font-weight: 800;
    text-align: center; transition: all .2s;
  }
  .pvm-otp-input:focus {
    outline: none; border-color: #84cc16;
    background: rgba(132,204,22,.08);
    transform: scale(1.06);
  }
  .pvm-otp-input.filled {
    border-color: rgba(132,204,22,.5);
    background: rgba(132,204,22,.06);
  }

  /* — buttons — */
  .pvm-btn {
    width: 100%; padding: 15px; border: none; border-radius: 14px;
    font-size: 15px; font-weight: 800; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 10px;
    transition: all .25s;
  }
  .pvm-btn-primary {
    background: linear-gradient(135deg,#84cc16,#4d7c0f);
    color: #000;
    box-shadow: 0 4px 20px rgba(132,204,22,.3);
  }
  .pvm-btn-primary:hover:not(:disabled) {
    transform: translateY(-3px);
    box-shadow: 0 8px 30px rgba(132,204,22,.5);
  }
  .pvm-btn-primary:disabled { opacity: .45; cursor: not-allowed; transform: none; }

  .pvm-btn-ghost {
    background: rgba(255,255,255,.05); border: 1.5px solid rgba(255,255,255,.1);
    color: #84cc16; margin-top: 12px;
  }
  .pvm-btn-ghost:hover:not(:disabled) {
    background: rgba(132,204,22,.08);
    border-color: rgba(132,204,22,.4);
  }
  .pvm-btn-ghost:disabled { opacity: .4; cursor: not-allowed; }

  /* — back link — */
  .pvm-back {
    display: inline-flex; align-items: center; gap: 6px;
    color: #737373; font-size: 13px; font-weight: 600;
    background: none; border: none; cursor: pointer;
    margin-bottom: 20px; padding: 0; transition: color .2s;
  }
  .pvm-back:hover { color: #84cc16; }

  /* — 2FA optional hint — */
  .pvm-optional-hint {
    display: flex; align-items: flex-start; gap: 10px;
    background: rgba(59,130,246,.08); border: 1px solid rgba(59,130,246,.2);
    border-radius: 12px; padding: 13px 14px;
    color: #93c5fd; font-size: 13px; margin-bottom: 20px; line-height: 1.5;
  }
`;

// ─── Component ──────────────────────────────────────────────────────────────

const STEPS = ["security", "phone", "verify"];
// If no existing phone → steps: security → phone → verify
// If changing existing  → same steps, but different headings

export default function PhoneVerificationModal({
  show,
  onClose,
  userId,
  currentPhone,
  onSuccess,
}) {
  const isChanging = Boolean(currentPhone);

  // flow state
  const [stepIndex, setStepIndex] = useState(0); // 0=security, 1=phone, 2=verify
  const step = STEPS[stepIndex];

  // security gate
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [twoFACode, setTwoFACode] = useState("");
  const [has2FA, setHas2FA] = useState(false);
  const [securityError, setSecurityError] = useState("");

  // phone entry
  const [countryCode, setCountryCode] = useState("+234");
  const [phoneNumber, setPhoneNumber] = useState("");

  // OTP
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [countdown, setCountdown] = useState(0);
  const inputRefs = useRef([]);

  // generic
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // check 2FA on mount
  useEffect(() => {
    if (show && userId) {
      settingsService.userHas2FA(userId).then(setHas2FA);
    }
  }, [show, userId]);

  // countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [countdown]);

  // reset on close
  useEffect(() => {
    if (!show) {
      setStepIndex(0);
      setPassword("");
      setTwoFACode("");
      setPhoneNumber("");
      setOtp(["", "", "", "", "", ""]);
      setError("");
      setSecurityError("");
      setCountdown(0);
    }
  }, [show]);

  if (!show) return null;

  // ── helpers ──────────────────────────────────────────────────────────────

  const formatPhone = (v) => {
    const d = v.replace(/\D/g, "");
    if (d.length <= 3) return d;
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}`;
  };

  const fullPhone = () => `${countryCode}${phoneNumber.replace(/\D/g, "")}`;

  // ── step handlers ────────────────────────────────────────────────────────

  const handleSecuritySubmit = async () => {
    setSecurityError("");
    if (!password) {
      setSecurityError("Please enter your password");
      return;
    }
    setLoading(true);
    try {
      const pwResult = await settingsService.verifyPassword(password);
      if (!pwResult.success) {
        setSecurityError(pwResult.message || "Incorrect password");
        return;
      }
      if (has2FA) {
        if (!twoFACode || twoFACode.length !== 6) {
          setSecurityError("Please enter your 6-digit authenticator code");
          return;
        }
        const tfaResult = await settingsService.verify2FACode(
          userId,
          twoFACode,
        );
        if (!tfaResult.success) {
          setSecurityError(tfaResult.message || "Invalid 2FA code");
          return;
        }
      }
      setStepIndex(1); // go to phone entry
    } finally {
      setLoading(false);
    }
  };

  const handleSendCode = async () => {
    const digits = phoneNumber.replace(/\D/g, "");
    if (digits.length < 10) {
      setError("Please enter a valid 10-digit phone number");
      return;
    }
    setLoading(true);
    setError("");
    try {
      // Save new phone first (unverified), then send code
      await settingsService.updateContactInfo(userId, { phone: fullPhone() });
      await settingsService.sendVerificationCode(userId, fullPhone());
      setCountdown(60);
      setStepIndex(2);
    } catch (e) {
      setError(e.message || "Failed to send verification code");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    const code = otp.join("");
    if (code.length !== 6) {
      setError("Please enter the complete 6-digit code");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await settingsService.verifyPhoneNumber(userId, code);
      if (!result.success) {
        setError(result.message || "Invalid code. Please try again.");
        setOtp(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
        return;
      }
      onSuccess?.(fullPhone());
      onClose();
    } catch (e) {
      setError(e.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setLoading(true);
    setError("");
    try {
      await settingsService.sendVerificationCode(userId, fullPhone());
      setCountdown(60);
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (e) {
      setError(e.message || "Failed to resend code");
    } finally {
      setLoading(false);
    }
  };

  // ── OTP input helpers ────────────────────────────────────────────────────

  const handleOtpChange = (i, v) => {
    if (v && !/^\d$/.test(v)) return;
    const next = [...otp];
    next[i] = v;
    setOtp(next);
    setError("");
    if (v && i < 5) inputRefs.current[i + 1]?.focus();
  };

  const handleOtpKey = (i, e) => {
    if (e.key === "Backspace" && !otp[i] && i > 0)
      inputRefs.current[i - 1]?.focus();
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const digits = e.clipboardData.getData("text").replace(/\D/g, "");
    if (digits.length === 6) {
      setOtp(digits.split(""));
      inputRefs.current[5]?.focus();
    }
  };

  // ── step meta ─────────────────────────────────────────────────────────────

  const meta = {
    security: {
      icon: <Lock size={22} />,
      title: isChanging ? "Security Check" : "Add Phone Number",
      subtitle: "Confirm it's you before continuing",
    },
    phone: {
      icon: <Phone size={22} />,
      title: isChanging ? "New Phone Number" : "Enter Phone Number",
      subtitle: "We'll send a one-time code",
    },
    verify: {
      icon: <Shield size={22} />,
      title: "Enter Verification Code",
      subtitle: "Check your messages",
    },
  };

  const current = meta[step];

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{STYLES}</style>
      <div className="pvm-overlay" onClick={onClose}>
        <div className="pvm-card" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="pvm-header">
            <div className="pvm-header-left">
              <div className="pvm-icon">{current.icon}</div>
              <div>
                <p className="pvm-title">{current.title}</p>
                <p className="pvm-subtitle">{current.subtitle}</p>
              </div>
            </div>
            <button className="pvm-close" onClick={onClose}>
              <X size={16} />
            </button>
          </div>

          {/* Progress */}
          <div className="pvm-steps">
            {STEPS.map((s, i) => (
              <React.Fragment key={s}>
                <div
                  className={`pvm-step-dot ${
                    i < stepIndex ? "done" : i === stepIndex ? "active" : ""
                  }`}
                />
                {i < STEPS.length - 1 && <div className="pvm-step-line" />}
              </React.Fragment>
            ))}
          </div>

          {/* Body */}
          <div className="pvm-body">
            {/* ── STEP 0: Security Gate ── */}
            {step === "security" && (
              <>
                <p className="pvm-info-text">
                  {isChanging ? (
                    <>
                      To <strong>change your phone number</strong>, confirm your
                      identity first.
                    </>
                  ) : (
                    <>
                      To <strong>add a phone number</strong>, confirm your
                      password to continue.
                    </>
                  )}
                </p>

                {securityError && (
                  <div className="pvm-error">
                    <AlertCircle size={16} />
                    {securityError}
                  </div>
                )}

                <label className="pvm-label">Password</label>
                <div className="pvm-input-wrap">
                  <input
                    type={showPw ? "text" : "password"}
                    className="pvm-input"
                    placeholder="Enter your current password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setSecurityError("");
                    }}
                    onKeyDown={(e) =>
                      e.key === "Enter" && !has2FA && handleSecuritySubmit()
                    }
                    autoFocus
                  />
                  <span
                    className="pvm-input-icon"
                    onClick={() => setShowPw(!showPw)}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </span>
                </div>

                {has2FA ? (
                  <>
                    <label className="pvm-label">Authenticator Code</label>
                    <div className="pvm-input-wrap">
                      <input
                        type="text"
                        inputMode="numeric"
                        className="pvm-input"
                        placeholder="6-digit code from your authenticator app"
                        value={twoFACode}
                        maxLength={6}
                        onChange={(e) => {
                          setTwoFACode(e.target.value.replace(/\D/g, ""));
                          setSecurityError("");
                        }}
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleSecuritySubmit()
                        }
                      />
                      <span
                        className="pvm-input-icon"
                        style={{ cursor: "default" }}
                      >
                        <KeyRound size={16} />
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="pvm-optional-hint">
                    <Shield size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>
                      Enable two-factor authentication in Security settings for
                      extra account protection.
                    </span>
                  </div>
                )}

                <button
                  className="pvm-btn pvm-btn-primary"
                  onClick={handleSecuritySubmit}
                  disabled={loading || !password}
                >
                  {loading ? (
                    <>
                      <Loader
                        size={18}
                        style={{ animation: "spin 1s linear infinite" }}
                      />{" "}
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Lock size={18} /> Continue
                    </>
                  )}
                </button>
              </>
            )}

            {/* ── STEP 1: Enter Phone ── */}
            {step === "phone" && (
              <>
                <button className="pvm-back" onClick={() => setStepIndex(0)}>
                  <ArrowLeft size={14} /> Back
                </button>

                <p className="pvm-info-text">
                  {isChanging ? (
                    <>
                      Enter the <strong>new phone number</strong> you want to
                      use.
                    </>
                  ) : (
                    <>
                      Enter your phone number to receive a{" "}
                      <strong>verification code</strong>.
                    </>
                  )}
                </p>

                {error && (
                  <div className="pvm-error">
                    <AlertCircle size={16} />
                    {error}
                  </div>
                )}

                <label className="pvm-label">Phone Number</label>
                <div className="pvm-phone-row">
                  <select
                    className="pvm-country"
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                  >
                    <option value="+1">🇺🇸 +1</option>
                    <option value="+44">🇬🇧 +44</option>
                    <option value="+234">🇳🇬 +234</option>
                    <option value="+254">🇰🇪 +254</option>
                    <option value="+27">🇿🇦 +27</option>
                    <option value="+91">🇮🇳 +91</option>
                    <option value="+33">🇫🇷 +33</option>
                    <option value="+49">🇩🇪 +49</option>
                    <option value="+86">🇨🇳 +86</option>
                    <option value="+81">🇯🇵 +81</option>
                  </select>
                  <input
                    type="tel"
                    className="pvm-input"
                    style={{ flex: 1, marginBottom: 0 }}
                    placeholder="(XXX) XXX-XXXX"
                    value={phoneNumber}
                    onChange={(e) => {
                      setPhoneNumber(formatPhone(e.target.value));
                      setError("");
                    }}
                    maxLength={16}
                    autoFocus
                  />
                </div>

                <button
                  className="pvm-btn pvm-btn-primary"
                  style={{ marginTop: 8 }}
                  onClick={handleSendCode}
                  disabled={
                    loading || phoneNumber.replace(/\D/g, "").length < 10
                  }
                >
                  {loading ? (
                    <>
                      <Loader
                        size={18}
                        style={{ animation: "spin 1s linear infinite" }}
                      />{" "}
                      Sending...
                    </>
                  ) : (
                    <>
                      <Phone size={18} /> Send Verification Code
                    </>
                  )}
                </button>
              </>
            )}

            {/* ── STEP 2: Enter OTP ── */}
            {step === "verify" && (
              <>
                <button className="pvm-back" onClick={() => setStepIndex(1)}>
                  <ArrowLeft size={14} /> Change Number
                </button>

                <p className="pvm-info-text">
                  We sent a 6-digit code to{" "}
                  <span className="accent">
                    {countryCode} {phoneNumber}
                  </span>
                  .<br />
                  The code expires in <strong>10 minutes</strong>.
                </p>

                {error && (
                  <div className="pvm-error">
                    <AlertCircle size={16} />
                    {error}
                  </div>
                )}

                <label
                  className="pvm-label"
                  style={{ textAlign: "center", display: "block" }}
                >
                  Verification Code
                </label>
                <div className="pvm-otp-row" onPaste={handleOtpPaste}>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <input
                      key={i}
                      ref={(el) => (inputRefs.current[i] = el)}
                      type="text"
                      inputMode="numeric"
                      pattern="\d{1}"
                      maxLength={1}
                      className={`pvm-otp-input ${otp[i] ? "filled" : ""}`}
                      value={otp[i]}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKey(i, e)}
                      autoFocus={i === 0}
                    />
                  ))}
                </div>

                <button
                  className="pvm-btn pvm-btn-primary"
                  onClick={handleVerify}
                  disabled={loading || otp.join("").length !== 6}
                >
                  {loading ? (
                    <>
                      <Loader
                        size={18}
                        style={{ animation: "spin 1s linear infinite" }}
                      />{" "}
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Check size={18} /> Verify Phone Number
                    </>
                  )}
                </button>

                <button
                  className="pvm-btn pvm-btn-ghost"
                  onClick={handleResend}
                  disabled={countdown > 0 || loading}
                >
                  {countdown > 0 ? `Resend in ${countdown}s` : "Resend Code"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
