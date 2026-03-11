// ============================================================================
// src/components/Modals/EmailVerificationModal.jsx
// Flow: Security Gate (password + optional 2FA) → New Email Entry → Verify OTP
// ============================================================================

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Mail,
  Shield,
  Loader,
  Check,
  ArrowLeft,
  Eye,
  EyeOff,
  Lock,
  KeyRound,
  AlertCircle,
  AtSign,
} from "lucide-react";
import settingsService from "../../services/account/settingsService";

// ─── Styles (shared palette with PhoneVerificationModal) ───────────────────
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

  .evm-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,.88);
    backdrop-filter: blur(10px);
    display: flex; align-items: center; justify-content: center;
    z-index: 9999; padding: 20px;
    animation: fadeIn .2s ease;
  }

  .evm-card {
    background: #0d0d0d;
    border: 1.5px solid rgba(132,204,22,.25);
    border-radius: 28px;
    width: 100%; max-width: 460px;
    overflow: hidden;
    animation: slideUp .3s ease;
    box-shadow: 0 40px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(132,204,22,.08);
  }

  .evm-header {
    padding: 22px 24px;
    background: rgba(132,204,22,.06);
    border-bottom: 1px solid rgba(132,204,22,.15);
    display: flex; align-items: center; justify-content: space-between;
  }
  .evm-header-left { display: flex; align-items: center; gap: 14px; }
  .evm-icon {
    width: 46px; height: 46px; border-radius: 14px;
    background: linear-gradient(135deg,#84cc16,#4d7c0f);
    display: flex; align-items: center; justify-content: center;
    color: #000; flex-shrink: 0;
    box-shadow: 0 4px 16px rgba(132,204,22,.35);
  }
  .evm-title { font-size: 18px; font-weight: 800; color: #fff; margin: 0; }
  .evm-subtitle { font-size: 12px; color: #737373; margin: 3px 0 0; }
  .evm-close {
    background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1);
    border-radius: 10px; width: 36px; height: 36px;
    display: flex; align-items: center; justify-content: center;
    color: #a3a3a3; cursor: pointer; transition: all .2s;
  }
  .evm-close:hover { background: rgba(255,255,255,.1); color: #fff; }

  .evm-steps {
    display: flex; align-items: center; justify-content: center;
    gap: 8px; padding: 18px 24px 0;
  }
  .evm-step-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: rgba(255,255,255,.1); transition: all .3s;
  }
  .evm-step-dot.done { background: #4d7c0f; }
  .evm-step-dot.active { background: #84cc16; width: 24px; border-radius: 4px; }
  .evm-step-line { width: 32px; height: 1px; background: rgba(255,255,255,.08); }

  .evm-body { padding: 24px; }

  .evm-info-text {
    text-align: center; color: #a3a3a3; font-size: 14px;
    margin-bottom: 24px; line-height: 1.65;
  }
  .evm-info-text strong { color: #fff; }
  .evm-info-text .accent { color: #84cc16; font-weight: 700; }

  .evm-error {
    background: rgba(239,68,68,.1); border: 1px solid rgba(239,68,68,.3);
    border-radius: 12px; padding: 12px 14px; color: #ef4444;
    font-size: 13px; margin-bottom: 18px;
    display: flex; align-items: center; gap: 8px;
    animation: shake .35s ease;
  }

  .evm-label {
    font-size: 12px; font-weight: 700; color: #737373;
    text-transform: uppercase; letter-spacing: .6px;
    display: block; margin-bottom: 8px;
  }
  .evm-input-wrap { position: relative; margin-bottom: 16px; }
  .evm-input {
    width: 100%; padding: 13px 44px 13px 14px; box-sizing: border-box;
    background: rgba(255,255,255,.04); border: 1.5px solid rgba(255,255,255,.1);
    border-radius: 12px; color: #fff; font-size: 15px; font-weight: 600;
    transition: all .2s;
  }
  .evm-input::placeholder { color: #525252; }
  .evm-input:focus {
    outline: none;
    border-color: #84cc16;
    background: rgba(132,204,22,.06);
  }
  .evm-input-icon {
    position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
    color: #525252; cursor: pointer;
  }

  .evm-otp-row {
    display: flex; gap: 10px; justify-content: center;
    margin-bottom: 20px;
  }
  .evm-otp-input {
    width: 52px; height: 60px;
    background: rgba(255,255,255,.04); border: 2px solid rgba(255,255,255,.1);
    border-radius: 14px; color: #fff; font-size: 22px; font-weight: 800;
    text-align: center; transition: all .2s;
  }
  .evm-otp-input:focus {
    outline: none; border-color: #84cc16;
    background: rgba(132,204,22,.08);
    transform: scale(1.06);
  }
  .evm-otp-input.filled {
    border-color: rgba(132,204,22,.5);
    background: rgba(132,204,22,.06);
  }

  .evm-btn {
    width: 100%; padding: 15px; border: none; border-radius: 14px;
    font-size: 15px; font-weight: 800; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 10px;
    transition: all .25s;
  }
  .evm-btn-primary {
    background: linear-gradient(135deg,#84cc16,#4d7c0f);
    color: #000;
    box-shadow: 0 4px 20px rgba(132,204,22,.3);
  }
  .evm-btn-primary:hover:not(:disabled) {
    transform: translateY(-3px);
    box-shadow: 0 8px 30px rgba(132,204,22,.5);
  }
  .evm-btn-primary:disabled { opacity: .45; cursor: not-allowed; transform: none; }
  .evm-btn-ghost {
    background: rgba(255,255,255,.05); border: 1.5px solid rgba(255,255,255,.1);
    color: #84cc16; margin-top: 12px;
  }
  .evm-btn-ghost:hover:not(:disabled) {
    background: rgba(132,204,22,.08);
    border-color: rgba(132,204,22,.4);
  }
  .evm-btn-ghost:disabled { opacity: .4; cursor: not-allowed; }

  .evm-back {
    display: inline-flex; align-items: center; gap: 6px;
    color: #737373; font-size: 13px; font-weight: 600;
    background: none; border: none; cursor: pointer;
    margin-bottom: 20px; padding: 0; transition: color .2s;
  }
  .evm-back:hover { color: #84cc16; }

  .evm-optional-hint {
    display: flex; align-items: flex-start; gap: 10px;
    background: rgba(59,130,246,.08); border: 1px solid rgba(59,130,246,.2);
    border-radius: 12px; padding: 13px 14px;
    color: #93c5fd; font-size: 13px; margin-bottom: 20px; line-height: 1.5;
  }

  .evm-warning-banner {
    display: flex; align-items: flex-start; gap: 10px;
    background: rgba(251,191,36,.08); border: 1px solid rgba(251,191,36,.25);
    border-radius: 12px; padding: 13px 14px;
    color: #fbbf24; font-size: 13px; margin-bottom: 20px; line-height: 1.5;
  }
`;

const STEPS = ["security", "email", "verify"];

export default function EmailVerificationModal({
  show,
  onClose,
  userId,
  currentEmail,
  onSuccess,
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex];

  // security gate
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [twoFACode, setTwoFACode] = useState("");
  const [has2FA, setHas2FA] = useState(false);
  const [securityError, setSecurityError] = useState("");

  // email entry
  const [newEmail, setNewEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");

  // OTP
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [countdown, setCountdown] = useState(0);
  const inputRefs = useRef([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Check 2FA
  useEffect(() => {
    if (show && userId) {
      settingsService.userHas2FA(userId).then(setHas2FA);
    }
  }, [show, userId]);

  // Countdown
  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [countdown]);

  // Reset on close
  useEffect(() => {
    if (!show) {
      setStepIndex(0);
      setPassword("");
      setTwoFACode("");
      setNewEmail("");
      setConfirmEmail("");
      setOtp(["", "", "", "", "", ""]);
      setError("");
      setSecurityError("");
      setCountdown(0);
    }
  }, [show]);

  if (!show) return null;

  // ── helpers ──────────────────────────────────────────────────────────────

  const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  // ── handlers ─────────────────────────────────────────────────────────────

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
      setStepIndex(1);
    } finally {
      setLoading(false);
    }
  };

  const handleSendCode = async () => {
    setError("");
    if (!isValidEmail(newEmail)) {
      setError("Please enter a valid email address");
      return;
    }
    if (newEmail.toLowerCase() === currentEmail?.toLowerCase()) {
      setError("This is already your current email address");
      return;
    }
    if (newEmail !== confirmEmail) {
      setError("Email addresses do not match");
      return;
    }
    setLoading(true);
    try {
      await settingsService.sendEmailVerificationCode(userId, newEmail);
      setCountdown(60);
      setStepIndex(2);
    } catch (e) {
      setError(e.message || "Failed to send verification email");
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
      const result = await settingsService.verifyAndChangeEmail(
        userId,
        newEmail,
        code,
      );
      if (!result.success) {
        setError(result.message || "Invalid code. Please try again.");
        setOtp(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
        return;
      }
      onSuccess?.(newEmail);
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
      await settingsService.sendEmailVerificationCode(userId, newEmail);
      setCountdown(60);
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (e) {
      setError(e.message || "Failed to resend code");
    } finally {
      setLoading(false);
    }
  };

  // OTP helpers
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

  // Step meta
  const meta = {
    security: {
      icon: <Lock size={22} />,
      title: "Security Check",
      subtitle: "Confirm your identity",
    },
    email: {
      icon: <Mail size={22} />,
      title: "New Email Address",
      subtitle: "Enter your new email",
    },
    verify: {
      icon: <Shield size={22} />,
      title: "Verify Email",
      subtitle: "Check your inbox",
    },
  };
  const current = meta[step];

  return (
    <>
      <style>{STYLES}</style>
      <div className="evm-overlay" onClick={onClose}>
        <div className="evm-card" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="evm-header">
            <div className="evm-header-left">
              <div className="evm-icon">{current.icon}</div>
              <div>
                <p className="evm-title">{current.title}</p>
                <p className="evm-subtitle">{current.subtitle}</p>
              </div>
            </div>
            <button className="evm-close" onClick={onClose}>
              <X size={16} />
            </button>
          </div>

          {/* Progress */}
          <div className="evm-steps">
            {STEPS.map((s, i) => (
              <React.Fragment key={s}>
                <div
                  className={`evm-step-dot ${i < stepIndex ? "done" : i === stepIndex ? "active" : ""}`}
                />
                {i < STEPS.length - 1 && <div className="evm-step-line" />}
              </React.Fragment>
            ))}
          </div>

          <div className="evm-body">
            {/* ── STEP 0: Security Gate ── */}
            {step === "security" && (
              <>
                <p className="evm-info-text">
                  Changing your email affects your{" "}
                  <strong>login credentials</strong>. Confirm your identity
                  first.
                </p>

                {securityError && (
                  <div className="evm-error">
                    <AlertCircle size={16} />
                    {securityError}
                  </div>
                )}

                <label className="evm-label">Current Password</label>
                <div className="evm-input-wrap">
                  <input
                    type={showPw ? "text" : "password"}
                    className="evm-input"
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
                    className="evm-input-icon"
                    onClick={() => setShowPw(!showPw)}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </span>
                </div>

                {has2FA ? (
                  <>
                    <label className="evm-label">Authenticator Code</label>
                    <div className="evm-input-wrap">
                      <input
                        type="text"
                        inputMode="numeric"
                        className="evm-input"
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
                        className="evm-input-icon"
                        style={{ cursor: "default" }}
                      >
                        <KeyRound size={16} />
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="evm-optional-hint">
                    <Shield size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>
                      Enable two-factor authentication in Security settings for
                      extra protection when changing sensitive account details.
                    </span>
                  </div>
                )}

                <button
                  className="evm-btn evm-btn-primary"
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

            {/* ── STEP 1: New Email Entry ── */}
            {step === "email" && (
              <>
                <button className="evm-back" onClick={() => setStepIndex(0)}>
                  <ArrowLeft size={14} /> Back
                </button>

                <div className="evm-warning-banner">
                  <AlertCircle
                    size={16}
                    style={{ flexShrink: 0, marginTop: 1 }}
                  />
                  <span>
                    Your new email will become your login email. A verification
                    code will be sent to confirm it.
                  </span>
                </div>

                {error && (
                  <div className="evm-error">
                    <AlertCircle size={16} />
                    {error}
                  </div>
                )}

                <label className="evm-label">New Email Address</label>
                <div className="evm-input-wrap">
                  <input
                    type="email"
                    className="evm-input"
                    placeholder="your@newemail.com"
                    value={newEmail}
                    onChange={(e) => {
                      setNewEmail(e.target.value);
                      setError("");
                    }}
                    autoFocus
                  />
                  <span
                    className="evm-input-icon"
                    style={{ cursor: "default" }}
                  >
                    <AtSign size={16} />
                  </span>
                </div>

                <label className="evm-label">Confirm New Email</label>
                <div className="evm-input-wrap">
                  <input
                    type="email"
                    className="evm-input"
                    placeholder="Repeat your new email"
                    value={confirmEmail}
                    onChange={(e) => {
                      setConfirmEmail(e.target.value);
                      setError("");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
                  />
                  <span
                    className="evm-input-icon"
                    style={{ cursor: "default" }}
                  >
                    <Mail size={16} />
                  </span>
                </div>

                <button
                  className="evm-btn evm-btn-primary"
                  onClick={handleSendCode}
                  disabled={loading || !newEmail || !confirmEmail}
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
                      <Mail size={18} /> Send Verification Code
                    </>
                  )}
                </button>
              </>
            )}

            {/* ── STEP 2: OTP Verify ── */}
            {step === "verify" && (
              <>
                <button className="evm-back" onClick={() => setStepIndex(1)}>
                  <ArrowLeft size={14} /> Change Email
                </button>

                <p className="evm-info-text">
                  We sent a 6-digit code to{" "}
                  <span className="accent">{newEmail}</span>.<br />
                  Check your inbox (and spam folder). The code expires in{" "}
                  <strong>10 minutes</strong>.
                </p>

                {error && (
                  <div className="evm-error">
                    <AlertCircle size={16} />
                    {error}
                  </div>
                )}

                <label
                  className="evm-label"
                  style={{ textAlign: "center", display: "block" }}
                >
                  Verification Code
                </label>
                <div className="evm-otp-row" onPaste={handleOtpPaste}>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <input
                      key={i}
                      ref={(el) => (inputRefs.current[i] = el)}
                      type="text"
                      inputMode="numeric"
                      pattern="\d{1}"
                      maxLength={1}
                      className={`evm-otp-input ${otp[i] ? "filled" : ""}`}
                      value={otp[i]}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKey(i, e)}
                      autoFocus={i === 0}
                    />
                  ))}
                </div>

                <button
                  className="evm-btn evm-btn-primary"
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
                      <Check size={18} /> Confirm Email Change
                    </>
                  )}
                </button>

                <button
                  className="evm-btn evm-btn-ghost"
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
