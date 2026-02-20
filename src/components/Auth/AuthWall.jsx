// src/components/Auth/AuthWall.jsx — v8
// CHANGES FROM v7:
// - Email / OTP flow completely removed
// - Only social providers: Google, X, TikTok, Discord

import React, { useState, useRef, useEffect } from "react";
import authService from "../../services/auth/authService";
import PaywallGate from "./PaywallGate";

// ── Brand SVG Icons ───────────────────────────────────────────────────────────

const GoogleSVG = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

const XSVG = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="#e7e7e7"
    aria-hidden="true"
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const FacebookSVG = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="#1877F2"
    aria-hidden="true"
  >
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const DiscordSVG = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="#5865F2"
    aria-hidden="true"
  >
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.031.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

// ── Atmospheric Background ─────────────────────────────────────────────────────
const Atmosphere = () => (
  <div
    aria-hidden="true"
    style={{
      position: "absolute",
      inset: 0,
      overflow: "hidden",
      pointerEvents: "none",
      zIndex: 0,
    }}
  >
    <div
      style={{
        position: "absolute",
        top: "-20%",
        left: "-20%",
        width: "55%",
        height: "55%",
        background:
          "radial-gradient(ellipse at center, rgba(132,204,22,0.11) 0%, transparent 60%)",
      }}
    />
    <div
      style={{
        position: "absolute",
        bottom: "-20%",
        right: "-20%",
        width: "55%",
        height: "55%",
        background:
          "radial-gradient(ellipse at center, rgba(132,204,22,0.09) 0%, transparent 60%)",
      }}
    />
    <div
      style={{
        position: "absolute",
        top: "-10%",
        right: "-10%",
        width: "35%",
        height: "35%",
        background:
          "radial-gradient(ellipse at center, rgba(132,204,22,0.05) 0%, transparent 65%)",
      }}
    />

    <svg
      style={{ position: "absolute", top: 10, left: 10 }}
      width="52"
      height="52"
      viewBox="0 0 52 52"
      fill="none"
    >
      <path
        d="M52 4 H4 V52"
        stroke="rgba(132,204,22,0.5)"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
    <svg
      style={{ position: "absolute", top: 10, right: 10 }}
      width="52"
      height="52"
      viewBox="0 0 52 52"
      fill="none"
    >
      <path
        d="M0 4 H48 V52"
        stroke="rgba(132,204,22,0.5)"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
    <svg
      style={{ position: "absolute", bottom: 10, left: 10 }}
      width="52"
      height="52"
      viewBox="0 0 52 52"
      fill="none"
    >
      <path
        d="M52 48 H4 V0"
        stroke="rgba(132,204,22,0.5)"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
    <svg
      style={{ position: "absolute", bottom: 10, right: 10 }}
      width="52"
      height="52"
      viewBox="0 0 52 52"
      fill="none"
    >
      <path
        d="M0 48 H48 V0"
        stroke="rgba(132,204,22,0.5)"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>

    {[
      { top: 7, left: 7 },
      { top: 7, right: 7 },
      { bottom: 7, left: 7 },
      { bottom: 7, right: 7 },
    ].map((p, i) => (
      <div
        key={i}
        style={{
          position: "absolute",
          ...p,
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "#84cc16",
          boxShadow: "0 0 16px 4px rgba(132,204,22,0.65)",
        }}
      />
    ))}
  </div>
);

// ── Spinner ────────────────────────────────────────────────────────────────────
const Spinner = ({ size = 22, color = "#84cc16" }) => (
  <>
    <div
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        border: `2.5px solid rgba(132,204,22,0.12)`,
        borderTop: `2.5px solid ${color}`,
        borderRadius: "50%",
        animation: "xvSpin .65s linear infinite",
        margin: "0 auto",
      }}
    />
    <style>{`@keyframes xvSpin{to{transform:rotate(360deg)}}`}</style>
  </>
);

// ── AuthButton ─────────────────────────────────────────────────────────────────
function AuthButton({
  icon,
  label,
  onClick,
  disabled,
  glowColor = "132,204,22",
  delay = 0,
}) {
  const [hov, setHov] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      aria-label={label}
      style={{
        width: "100%",
        padding: 0,
        border: "none",
        background: "none",
        cursor: disabled ? "default" : "pointer",
        fontFamily: "inherit",
        marginBottom: 8,
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(12px)",
        transition: `opacity .4s ease ${delay}ms, transform .4s ease ${delay}ms`,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "40px 1fr 40px",
          alignItems: "center",
          padding: "13px 16px",
          borderRadius: 14,
          border: `1.5px solid rgba(${glowColor}, ${hov ? 0.45 : 0.18})`,
          background: hov
            ? `rgba(${glowColor}, 0.08)`
            : `rgba(${glowColor}, 0.03)`,
          boxShadow: hov
            ? `0 6px 32px rgba(${glowColor}, 0.2), inset 0 1px 0 rgba(255,255,255,0.04)`
            : "none",
          transform: hov ? "translateY(-2px)" : "translateY(0)",
          transition: "all .2s ease",
          boxSizing: "border-box",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </span>
        <span
          style={{
            color: "#e8e8e8",
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: "0.15px",
            lineHeight: 1,
            textAlign: "center",
          }}
        >
          {label}
        </span>
        <span />
        {hov && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 14,
              background:
                "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.04) 50%, transparent 60%)",
              pointerEvents: "none",
            }}
          />
        )}
      </div>
    </button>
  );
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const CSS = {
  page: {
    minHeight: "100dvh",
    background: "#020403",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px 20px",
    fontFamily: "'DM Sans', 'Outfit', system-ui, sans-serif",
    position: "relative",
    overflow: "hidden",
  },
  wrap: {
    width: "100%",
    maxWidth: 420,
    position: "relative",
    zIndex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  logo: { textAlign: "center", marginBottom: 32, width: "100%" },
  logoMark: {
    display: "block",
    fontSize: "clamp(38px,9vw,64px)",
    fontWeight: 900,
    letterSpacing: "-3px",
    lineHeight: 1,
    background:
      "linear-gradient(135deg, #e2ffa0 0%, #84cc16 40%, #3d6b08 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    marginBottom: 6,
    animation: "xvFadeUp .6s ease both",
  },
  logoTag: {
    fontSize: 9,
    letterSpacing: "5.5px",
    color: "#192e06",
    textTransform: "uppercase",
    fontWeight: 700,
    animation: "xvFadeUp .6s ease .1s both",
  },
  block: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  h1: {
    color: "#f2f2f2",
    fontSize: "clamp(18px, 4.5vw, 27px)",
    fontWeight: 800,
    letterSpacing: "-0.6px",
    lineHeight: 1.2,
    margin: "0 0 6px",
    textAlign: "center",
    animation: "xvFadeUp .5s ease .15s both",
  },
  sub: {
    color: "#666666",
    fontSize: 13,
    lineHeight: 1.55,
    margin: "0 0 24px",
    textAlign: "center",
    animation: "xvFadeUp .5s ease .2s both",
  },
  err: {
    background: "rgba(239,68,68,0.07)",
    border: "1px solid rgba(239,68,68,0.2)",
    borderRadius: 11,
    color: "#fca5a5",
    fontSize: 13,
    padding: "12px 14px",
    marginBottom: 12,
    display: "flex",
    alignItems: "center",
    gap: 9,
    width: "100%",
    boxSizing: "border-box",
    animation: "xvFadeUp .3s ease both",
  },
  footer: {
    textAlign: "center",
    fontSize: 11,
    color: "#444444",
    marginTop: 20,
    lineHeight: 2,
    width: "100%",
  },
};

const KEYFRAMES = `
  @keyframes xvFadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
`;

// ── LoginScreen ────────────────────────────────────────────────────────────────
function LoginScreen() {
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState("");
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const handleSocial = async (provider) => {
    setError("");
    setLoading(provider);
    try {
      await authService.signInOAuth(provider);
    } catch (e) {
      if (mounted.current) {
        setError(e.message || `${provider} sign-in failed. Try again.`);
        setLoading(null);
      }
    }
  };

  const isBusy = !!loading;
  const providerName =
    loading === "google"
      ? "Google"
      : loading === "x"
        ? "X"
        : loading === "facebook"
          ? "Facebook"
          : "Discord";

  return (
    <div style={CSS.block}>
      <style>{KEYFRAMES}</style>
      <h2 style={CSS.h1}>Welcome to Xeevia</h2>
      <p style={CSS.sub}>Sign in or create an account</p>
      <div
        style={{
          width: 80,
          height: 1,
          background:
            "linear-gradient(90deg, transparent, rgba(132,204,22,0.7), transparent)",
          boxShadow: "0 0 10px 3px rgba(132,204,22,0.2)",
          borderRadius: 2,
          margin: "-12px auto 20px",
        }}
      />

      {error && (
        <div style={CSS.err}>
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {isBusy ? (
        <div
          style={{
            width: "100%",
            padding: "40px 0",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
          }}
        >
          <Spinner size={34} />
          <span style={{ color: "#666666", fontSize: 13, fontWeight: 500 }}>
            Opening {providerName}…
          </span>
        </div>
      ) : (
        <>
          <AuthButton
            icon={<GoogleSVG />}
            label="Continue with Google"
            onClick={() => handleSocial("google")}
            disabled={isBusy}
            glowColor="66,133,244"
            delay={0}
          />
          <AuthButton
            icon={<XSVG />}
            label="Continue with X"
            onClick={() => handleSocial("x")}
            disabled={isBusy}
            glowColor="231,231,231"
            delay={60}
          />
          <AuthButton
            icon={<FacebookSVG />}
            label="Continue with Facebook"
            onClick={() => handleSocial("facebook")}
            disabled={isBusy}
            glowColor="24,119,242"
            delay={120}
          />
          <AuthButton
            icon={<DiscordSVG />}
            label="Continue with Discord"
            onClick={() => handleSocial("discord")}
            disabled={isBusy}
            glowColor="88,101,242"
            delay={180}
          />
        </>
      )}

      <p style={{ ...CSS.footer, animation: "xvFadeUp .5s ease .35s both" }}>
        By continuing you agree to our
        <br />
        <span
          style={{
            color: "#555555",
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          Terms of Service
        </span>
        {" & "}
        <span
          style={{
            color: "#555555",
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          Privacy Policy
        </span>
      </p>
    </div>
  );
}

// ── Splash ────────────────────────────────────────────────────────────────────
export function Splash() {
  return (
    <div style={{ ...CSS.page, flexDirection: "column" }}>
      <style>{KEYFRAMES}</style>
      <Atmosphere />
      <div style={{ textAlign: "center", zIndex: 1 }}>
        <span style={CSS.logoMark}>XEEVIA</span>
        <div style={CSS.logoTag}>Own Your Social</div>
        <div
          style={{
            marginTop: 36,
            display: "flex",
            justifyContent: "center",
            animation: "xvFadeUp .6s ease .3s both",
          }}
        >
          <Spinner size={28} />
        </div>
      </div>
    </div>
  );
}

// ── AuthWall — root export ─────────────────────────────────────────────────────
export default function AuthWall({ paywall = false }) {
  return (
    <div style={CSS.page}>
      <style>{KEYFRAMES}</style>
      <Atmosphere />
      <div style={CSS.wrap}>
        <div style={CSS.logo}>
          <span style={CSS.logoMark}>XEEVIA</span>
          <div style={CSS.logoTag}>Own Your Social</div>
        </div>
        {paywall ? <PaywallGate /> : <LoginScreen />}
      </div>
    </div>
  );
}
