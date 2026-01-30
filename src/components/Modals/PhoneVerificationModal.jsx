// ============================================================================
// src/components/Modals/PhoneVerificationModal.jsx - COMPLETE PHONE VERIFICATION
// ============================================================================

import React, { useState, useEffect, useRef } from "react";
import { X, Phone, Shield, Loader, Check, ArrowLeft } from "lucide-react";
import settingsService from "../../services/account/settingsService";

const PhoneVerificationModal = ({
  show,
  onClose,
  userId,
  currentPhone,
  onSuccess,
}) => {
  const [step, setStep] = useState(currentPhone ? "verify" : "enter");
  const [phoneNumber, setPhoneNumber] = useState(currentPhone || "");
  const [countryCode, setCountryCode] = useState("+234"); // Default Nigeria
  const [verificationCode, setVerificationCode] = useState([
    "",
    "",
    "",
    "",
    "",
    "",
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const inputRefs = useRef([]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const formatPhoneNumber = (value) => {
    // Remove all non-digits
    const cleaned = value.replace(/\D/g, "");

    // Format as: (XXX) XXX-XXXX
    if (cleaned.length <= 3) {
      return cleaned;
    } else if (cleaned.length <= 6) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    } else {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
    }
  };

  const handlePhoneChange = (e) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
    setError("");
  };

  const validatePhone = () => {
    const cleaned = phoneNumber.replace(/\D/g, "");
    if (cleaned.length < 10) {
      setError("Please enter a valid 10-digit phone number");
      return false;
    }
    return true;
  };

  const handleSendCode = async () => {
    if (!validatePhone()) return;

    try {
      setLoading(true);
      setError("");

      const cleaned = phoneNumber.replace(/\D/g, "");
      const fullNumber = `${countryCode}${cleaned}`;

      // Send verification code via service
      await settingsService.sendVerificationCode(userId, fullNumber);

      // Move to verification step
      setStep("verify");
      setCountdown(60); // 60 second countdown

      console.log("📲 Verification code sent to:", fullNumber);
    } catch (err) {
      console.error("Failed to send code:", err);
      setError(err.message || "Failed to send verification code");
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (index, value) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...verificationCode];
    newCode[index] = value;
    setVerificationCode(newCode);
    setError("");

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyDown = (index, e) => {
    if (e.key === "Backspace" && !verificationCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleCodePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "");

    if (pastedData.length === 6) {
      const newCode = pastedData.split("");
      setVerificationCode(newCode);
      inputRefs.current[5]?.focus();
    }
  };

  const handleVerifyCode = async () => {
    const code = verificationCode.join("");

    if (code.length !== 6) {
      setError("Please enter the 6-digit verification code");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const cleaned = phoneNumber.replace(/\D/g, "");
      const fullNumber = `${countryCode}${cleaned}`;

      // First update the phone number
      await settingsService.updateContactInfo(userId, { phone: fullNumber });

      // Then verify it
      await settingsService.verifyPhoneNumber(userId, code);

      console.log("✅ Phone verified successfully");

      // Call success callback
      if (onSuccess) {
        onSuccess(fullNumber);
      }

      // Close modal
      onClose();
    } catch (err) {
      console.error("Failed to verify code:", err);
      setError(err.message || "Invalid verification code");
      setVerificationCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (countdown > 0) return;

    try {
      setLoading(true);
      setError("");

      const cleaned = phoneNumber.replace(/\D/g, "");
      const fullNumber = `${countryCode}${cleaned}`;

      await settingsService.sendVerificationCode(userId, fullNumber);

      setCountdown(60);
      setVerificationCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();

      console.log("📲 Verification code resent");
    } catch (err) {
      console.error("Failed to resend code:", err);
      setError(err.message || "Failed to resend code");
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  return (
    <>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.9);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 20px;
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .modal-content {
          background: #0a0a0a;
          border: 2px solid rgba(132, 204, 22, 0.3);
          border-radius: 24px;
          width: 100%;
          max-width: 480px;
          overflow: hidden;
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .modal-header {
          padding: 24px;
          border-bottom: 1px solid rgba(132, 204, 22, 0.2);
          background: rgba(132, 204, 22, 0.05);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .modal-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .modal-icon {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #000;
        }

        .modal-body {
          padding: 32px 24px;
        }

        .input-group {
          margin-bottom: 24px;
        }

        .input-label {
          font-size: 13px;
          font-weight: 600;
          color: #a3a3a3;
          margin-bottom: 8px;
          display: block;
        }

        .phone-input-wrapper {
          display: flex;
          gap: 12px;
        }

        .country-code-select {
          width: 100px;
          padding: 14px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(132, 204, 22, 0.3);
          border-radius: 12px;
          color: #fff;
          font-size: 15px;
          font-weight: 600;
        }

        .phone-input {
          flex: 1;
          padding: 14px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(132, 204, 22, 0.3);
          border-radius: 12px;
          color: #fff;
          font-size: 15px;
          font-weight: 600;
        }

        .phone-input:focus, .country-code-select:focus {
          outline: none;
          border-color: #84cc16;
          background: rgba(132, 204, 22, 0.08);
        }

        .code-inputs {
          display: flex;
          gap: 12px;
          justify-content: center;
        }

        .code-input {
          width: 56px;
          height: 64px;
          background: rgba(255, 255, 255, 0.05);
          border: 2px solid rgba(132, 204, 22, 0.3);
          border-radius: 12px;
          color: #fff;
          font-size: 24px;
          font-weight: 700;
          text-align: center;
          transition: all 0.2s;
        }

        .code-input:focus {
          outline: none;
          border-color: #84cc16;
          background: rgba(132, 204, 22, 0.08);
          transform: scale(1.05);
        }

        .info-text {
          text-align: center;
          color: #a3a3a3;
          font-size: 14px;
          margin-bottom: 24px;
          line-height: 1.6;
        }

        .highlight-phone {
          color: #84cc16;
          font-weight: 700;
        }

        .error-message {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 12px;
          padding: 12px;
          color: #ef4444;
          font-size: 13px;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .action-btn {
          width: 100%;
          padding: 16px;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          border: none;
          border-radius: 14px;
          color: #000;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: all 0.3s;
        }

        .action-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(132, 204, 22, 0.4);
        }

        .action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .resend-btn {
          width: 100%;
          padding: 14px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(132, 204, 22, 0.3);
          border-radius: 12px;
          color: #84cc16;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          margin-top: 16px;
          transition: all 0.2s;
        }

        .resend-btn:hover:not(:disabled) {
          background: rgba(132, 204, 22, 0.1);
          border-color: #84cc16;
        }

        .resend-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .back-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          color: #a3a3a3;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          margin-bottom: 24px;
          transition: all 0.2s;
        }

        .back-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #84cc16;
        }
      `}</style>

      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-header-left">
              <div className="modal-icon">
                {step === "verify" ? <Shield size={24} /> : <Phone size={24} />}
              </div>
              <div>
                <h2
                  style={{
                    fontSize: "20px",
                    fontWeight: "800",
                    color: "#fff",
                    margin: 0,
                  }}
                >
                  {step === "verify"
                    ? "Verify Phone Number"
                    : "Add Phone Number"}
                </h2>
                <p
                  style={{
                    fontSize: "13px",
                    color: "#a3a3a3",
                    margin: "4px 0 0 0",
                  }}
                >
                  {step === "verify"
                    ? "Enter the code we sent"
                    : "Secure your account"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                color: "#a3a3a3",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <X size={24} />
            </button>
          </div>

          <div className="modal-body">
            {step === "enter" && (
              <>
                <div className="info-text">
                  Enter your phone number to receive a verification code
                </div>

                {error && <div className="error-message">⚠️ {error}</div>}

                <div className="input-group">
                  <label className="input-label">Phone Number</label>
                  <div className="phone-input-wrapper">
                    <select
                      className="country-code-select"
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                    >
                      <option value="+1">🇺🇸 +1</option>
                      <option value="+44">🇬🇧 +44</option>
                      <option value="+234">🇳🇬 +234</option>
                      <option value="+254">🇰🇪 +254</option>
                      <option value="+27">🇿🇦 +27</option>
                      <option value="+91">🇮🇳 +91</option>
                    </select>
                    <input
                      type="tel"
                      className="phone-input"
                      placeholder="(XXX) XXX-XXXX"
                      value={phoneNumber}
                      onChange={handlePhoneChange}
                      maxLength={16}
                    />
                  </div>
                </div>

                <button
                  className="action-btn"
                  onClick={handleSendCode}
                  disabled={loading || !phoneNumber}
                >
                  {loading ? (
                    <>
                      <Loader
                        size={20}
                        style={{ animation: "spin 1s linear infinite" }}
                      />
                      Sending Code...
                    </>
                  ) : (
                    <>
                      <Phone size={20} />
                      Send Verification Code
                    </>
                  )}
                </button>
              </>
            )}

            {step === "verify" && (
              <>
                {step !== "enter" && (
                  <button className="back-btn" onClick={() => setStep("enter")}>
                    <ArrowLeft size={16} />
                    Change Number
                  </button>
                )}

                <div className="info-text">
                  We sent a 6-digit code to{" "}
                  <span className="highlight-phone">
                    {countryCode} {phoneNumber}
                  </span>
                </div>

                {error && <div className="error-message">⚠️ {error}</div>}

                <div className="input-group">
                  <label
                    className="input-label"
                    style={{ textAlign: "center" }}
                  >
                    Enter Verification Code
                  </label>
                  <div className="code-inputs">
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <input
                        key={index}
                        ref={(el) => (inputRefs.current[index] = el)}
                        type="text"
                        inputMode="numeric"
                        pattern="\d{1}"
                        maxLength={1}
                        className="code-input"
                        value={verificationCode[index]}
                        onChange={(e) =>
                          handleCodeChange(index, e.target.value)
                        }
                        onKeyDown={(e) => handleCodeKeyDown(index, e)}
                        onPaste={index === 0 ? handleCodePaste : undefined}
                        autoFocus={index === 0}
                      />
                    ))}
                  </div>
                </div>

                <button
                  className="action-btn"
                  onClick={handleVerifyCode}
                  disabled={loading || verificationCode.join("").length !== 6}
                >
                  {loading ? (
                    <>
                      <Loader
                        size={20}
                        style={{ animation: "spin 1s linear infinite" }}
                      />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Check size={20} />
                      Verify Phone Number
                    </>
                  )}
                </button>

                <button
                  className="resend-btn"
                  onClick={handleResendCode}
                  disabled={countdown > 0 || loading}
                >
                  {countdown > 0
                    ? `Resend Code in ${countdown}s`
                    : "Resend Verification Code"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default PhoneVerificationModal;
