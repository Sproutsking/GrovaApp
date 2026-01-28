// src/components/Modals/TwoFAModal.jsx
import React, { useState } from "react";
import { Shield, Loader } from "lucide-react";
import { supabase } from "../../services/config/supabase";

const TwoFAModal = ({ show, onClose, userId, onSuccess }) => {
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleVerify = async () => {
    if (verificationCode.length !== 6) {
      setError("Please enter a 6-digit code");
      return;
    }

    try {
      setLoading(true);
      setError("");

      // Verify 2FA code
      const { data, error: dbError } = await supabase
        .from("two_factor_auth")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (dbError) throw new Error("2FA not set up");

      // In production, verify the TOTP code here
      // For now, we'll just check if it's 6 digits
      if (verificationCode.length === 6) {
        // Update last used
        await supabase
          .from("two_factor_auth")
          .update({ last_used: new Date().toISOString() })
          .eq("user_id", userId);

        // Log security event
        await supabase.from("security_events").insert({
          user_id: userId,
          event_type: "2fa_verified",
          severity: "info",
          metadata: { timestamp: new Date().toISOString() },
        });

        onSuccess && onSuccess();
        onClose();
      } else {
        throw new Error("Invalid code");
      }
    } catch (err) {
      console.error("2FA verification error:", err);
      setError(err.message || "Invalid verification code");
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
      `}</style>

      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.9)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10000,
          padding: "20px",
        }}
        onClick={onClose}
      >
        <div
          style={{
            background: "#1a1a1a",
            border: "1px solid rgba(132, 204, 22, 0.3)",
            borderRadius: "16px",
            width: "100%",
            maxWidth: "400px",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              padding: "24px",
              borderBottom: "1px solid rgba(132, 204, 22, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h2
              style={{
                fontSize: "20px",
                fontWeight: "700",
                color: "#fff",
                margin: 0,
              }}
            >
              🔒 Two-Factor Authentication
            </h2>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                color: "#a3a3a3",
                fontSize: "32px",
                cursor: "pointer",
                padding: 0,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: "24px" }}>
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <div
                style={{
                  width: "80px",
                  height: "80px",
                  margin: "0 auto 16px",
                  borderRadius: "50%",
                  background: "rgba(132, 204, 22, 0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Shield size={40} style={{ color: "#84cc16" }} />
              </div>
              <p
                style={{
                  color: "#a3a3a3",
                  fontSize: "14px",
                  lineHeight: "1.5",
                }}
              >
                Enter the 6-digit code from your authenticator app
              </p>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <input
                type="text"
                maxLength="6"
                value={verificationCode}
                onChange={(e) =>
                  setVerificationCode(e.target.value.replace(/\D/g, ""))
                }
                placeholder="000000"
                autoFocus
                style={{
                  width: "100%",
                  padding: "16px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(132, 204, 22, 0.2)",
                  borderRadius: "8px",
                  color: "#ffffff",
                  fontSize: "24px",
                  textAlign: "center",
                  letterSpacing: "12px",
                  fontFamily: "monospace",
                  boxSizing: "border-box",
                }}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && verificationCode.length === 6) {
                    handleVerify();
                  }
                }}
              />
            </div>

            {error && (
              <p
                style={{
                  color: "#ef4444",
                  fontSize: "13px",
                  marginBottom: "16px",
                  textAlign: "center",
                }}
              >
                {error}
              </p>
            )}

            <button
              onClick={handleVerify}
              disabled={loading || verificationCode.length !== 6}
              style={{
                width: "100%",
                padding: "14px",
                background:
                  loading || verificationCode.length !== 6
                    ? "#333"
                    : "linear-gradient(135deg, #84cc16 0%, #65a30d 100%)",
                border: "none",
                borderRadius: "12px",
                color:
                  loading || verificationCode.length !== 6 ? "#666" : "#000",
                fontSize: "16px",
                fontWeight: "700",
                cursor:
                  loading || verificationCode.length !== 6
                    ? "not-allowed"
                    : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              {loading ? (
                <>
                  <Loader
                    size={18}
                    style={{ animation: "spin 1s linear infinite" }}
                  />
                  Verifying...
                </>
              ) : (
                "Verify"
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default TwoFAModal;
