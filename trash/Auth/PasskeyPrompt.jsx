// src/components/Auth/PasskeyPrompt.jsx
import React, { useState } from "react";

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.85)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10000,
    padding: "20px",
    animation: "pkFadeIn .3s ease",
  },
  card: {
    background: "#0d0d0e",
    border: "1px solid rgba(132,204,22,0.25)",
    borderRadius: "24px",
    padding: "36px 28px",
    maxWidth: "400px",
    width: "100%",
    textAlign: "center",
    boxShadow: "0 24px 64px rgba(0,0,0,0.8), 0 0 0 1px rgba(132,204,22,0.1)",
    animation: "pkSlideUp .4s cubic-bezier(0.16,1,0.3,1)",
  },
  iconWrap: {
    width: "80px",
    height: "80px",
    borderRadius: "50%",
    background:
      "linear-gradient(135deg,rgba(132,204,22,0.15),rgba(132,204,22,0.05))",
    border: "2px solid rgba(132,204,22,0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 24px",
    fontSize: "36px",
  },
  title: {
    fontSize: "22px",
    fontWeight: 800,
    color: "#fff",
    margin: "0 0 10px",
    letterSpacing: "-0.3px",
  },
  subtitle: {
    fontSize: "14px",
    color: "#71717a",
    margin: "0 0 28px",
    lineHeight: "1.6",
  },
  features: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: "14px",
    padding: "16px",
    marginBottom: "28px",
  },
  featureRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    fontSize: "13px",
    color: "#d4d4d8",
  },
  featureIcon: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    background: "rgba(132,204,22,0.12)",
    color: "#84cc16",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "13px",
    flexShrink: 0,
  },
  enableBtn: {
    width: "100%",
    padding: "15px",
    background: "linear-gradient(135deg,#84cc16,#65a30d)",
    border: "none",
    borderRadius: "14px",
    color: "#000",
    fontSize: "15px",
    fontWeight: 800,
    cursor: "pointer",
    marginBottom: "12px",
    transition: "all .2s",
    fontFamily: "inherit",
  },
  enableBtnDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  skipBtn: {
    background: "none",
    border: "none",
    color: "#52525b",
    fontSize: "13px",
    cursor: "pointer",
    width: "100%",
    padding: "10px",
    transition: "color .2s",
    fontFamily: "inherit",
  },
};

const FEATURES = [
  { icon: "⚡", text: "Sign in instantly without typing a password" },
  { icon: "🔒", text: "More secure than passwords — tied to your device" },
  { icon: "📱", text: "Works with Face ID, fingerprint, or device PIN" },
];

export default function PasskeyPrompt({ onEnable, onSkip }) {
  const [isEnabling, setIsEnabling] = useState(false);

  const handleEnable = async () => {
    if (isEnabling) return;
    setIsEnabling(true);
    try {
      await onEnable();
    } finally {
      setIsEnabling(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <div style={styles.iconWrap}>🔑</div>

        <h2 style={styles.title}>Enable Passkey Login?</h2>
        <p style={styles.subtitle}>
          Use your device's biometric authentication for instant, secure sign-in
        </p>

        <div style={styles.features}>
          {FEATURES.map(({ icon, text }) => (
            <div key={text} style={styles.featureRow}>
              <div style={styles.featureIcon}>{icon}</div>
              <span>{text}</span>
            </div>
          ))}
        </div>

        <button
          onClick={handleEnable}
          disabled={isEnabling}
          style={{
            ...styles.enableBtn,
            ...(isEnabling ? styles.enableBtnDisabled : {}),
          }}
        >
          {isEnabling ? "Setting up…" : "Enable Passkey"}
        </button>

        <button onClick={onSkip} style={styles.skipBtn}>
          Maybe later
        </button>
      </div>

      <style>{`
        @keyframes pkFadeIn  { from{opacity:0}       to{opacity:1} }
        @keyframes pkSlideUp { from{opacity:0;transform:translateY(20px) scale(0.96)}
                               to{opacity:1;transform:translateY(0)     scale(1)} }
      `}</style>
    </div>
  );
}
