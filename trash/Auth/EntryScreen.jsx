// ============================================================================
// src/components/Auth/EntryScreen.jsx  — REBUILT v10
//
// DESIGN: Dark luxury with lime-green accent. Sharp, editorial, premium.
// Two modes: "Sign In" and "Create Account" — same screen, toggled.
//
// GOOGLE BEHAVIOR:
//   Sign In  → signInWithOAuth({ prompt: "select_account" }) — fastest path
//   Sign Up  → signInWithOAuth({ prompt: "consent" }) — full permissions
//   Both handled by handleMethodSelect in AuthFlow — this just fires the event.
//
// SPEED: Click → OAuth redirect in < 100ms. Zero loading states needed.
// ============================================================================

import React, { useState } from "react";

const GOOGLE_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
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

const AUTH_OPTIONS = [
  {
    id: "google",
    label: "Continue with Google",
    icon: GOOGLE_ICON,
    accent: false,
  },
  { id: "email", label: "Continue with Email", icon: "✉️", accent: false },
];

export default function EntryScreen({ onSelectMethod, error, onClearError }) {
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [hoveredBtn, setHoveredBtn] = useState(null);

  const isSignIn = mode === "signin";

  return (
    <div
      style={{
        minHeight: "100dvh",
        background:
          "linear-gradient(160deg, #000000 0%, #080808 40%, #020602 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        fontFamily: "'Syne', 'Space Grotesk', system-ui, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ambient glow */}
      <div
        style={{
          position: "absolute",
          top: "-20%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "600px",
          height: "400px",
          background:
            "radial-gradient(ellipse, rgba(132,204,22,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-10%",
          right: "-10%",
          width: "400px",
          height: "400px",
          background:
            "radial-gradient(ellipse, rgba(132,204,22,0.03) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Logo block */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <div
            style={{
              fontSize: "clamp(36px, 8vw, 52px)",
              fontWeight: 900,
              background:
                "linear-gradient(135deg, #c8f542 0%, #84cc16 60%, #65a30d 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              letterSpacing: "-2px",
              lineHeight: 1,
              marginBottom: "6px",
            }}
          >
            XEEVIA
          </div>
          <div
            style={{
              fontSize: "10px",
              letterSpacing: "4px",
              color: "#2d3e0a",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            Own Your Social
          </div>
        </div>

        {/* Mode toggle */}
        <div
          style={{
            display: "flex",
            gap: "2px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "14px",
            padding: "4px",
            marginBottom: "28px",
          }}
        >
          {[
            { key: "signin", label: "Sign In" },
            { key: "signup", label: "Create Account" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => {
                setMode(key);
                onClearError?.();
              }}
              style={{
                flex: 1,
                padding: "10px 8px",
                background:
                  mode === key
                    ? "linear-gradient(135deg, rgba(132,204,22,0.15) 0%, rgba(101,163,13,0.1) 100%)"
                    : "transparent",
                border:
                  mode === key
                    ? "1px solid rgba(132,204,22,0.3)"
                    : "1px solid transparent",
                borderRadius: "10px",
                cursor: "pointer",
                color: mode === key ? "#84cc16" : "#3f3f46",
                fontSize: "13px",
                fontWeight: 700,
                transition: "all 0.2s ease",
                fontFamily: "inherit",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Headline */}
        <div style={{ marginBottom: "24px" }}>
          <h1
            style={{
              color: "#fff",
              fontSize: "clamp(20px, 4vw, 26px)",
              fontWeight: 800,
              margin: "0 0 6px",
              lineHeight: 1.2,
            }}
          >
            {isSignIn ? "Welcome back" : "Join the economy"}
          </h1>
          <p
            style={{
              color: "#404040",
              fontSize: "13px",
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            {isSignIn
              ? "Sign in to pick up where you left off."
              : "Create an account and start earning from your content."}
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div
            style={{
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: "12px",
              padding: "12px 16px",
              marginBottom: "20px",
              color: "#f87171",
              fontSize: "13px",
              lineHeight: 1.5,
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
            }}
          >
            <span style={{ flexShrink: 0, marginTop: "1px" }}>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Auth options */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            marginBottom: "28px",
          }}
        >
          {AUTH_OPTIONS.map((opt) => {
            const isHovered = hoveredBtn === opt.id;
            const isGoogle = opt.id === "google";
            return (
              <button
                key={opt.id}
                onClick={() => onSelectMethod(opt.id)}
                onMouseEnter={() => setHoveredBtn(opt.id)}
                onMouseLeave={() => setHoveredBtn(null)}
                style={{
                  width: "100%",
                  padding: "14px 18px",
                  background: isHovered
                    ? isGoogle
                      ? "rgba(66,133,244,0.08)"
                      : "rgba(132,204,22,0.08)"
                    : "rgba(255,255,255,0.03)",
                  border: isHovered
                    ? isGoogle
                      ? "1.5px solid rgba(66,133,244,0.3)"
                      : "1.5px solid rgba(132,204,22,0.3)"
                    : "1.5px solid rgba(255,255,255,0.07)",
                  borderRadius: "14px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  transition: "all 0.15s ease",
                  transform: isHovered ? "translateY(-1px)" : "none",
                  boxShadow: isHovered ? "0 4px 20px rgba(0,0,0,0.4)" : "none",
                  fontFamily: "inherit",
                }}
              >
                {/* Icon */}
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: isGoogle
                      ? "rgba(66,133,244,0.1)"
                      : "rgba(132,204,22,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    fontSize: "16px",
                  }}
                >
                  {opt.icon}
                </div>

                {/* Label */}
                <span
                  style={{
                    flex: 1,
                    textAlign: "left",
                    color: isHovered
                      ? isGoogle
                        ? "#8ab4f8"
                        : "#84cc16"
                      : "#e5e5e5",
                    fontSize: "14px",
                    fontWeight: 600,
                    transition: "color 0.15s ease",
                  }}
                >
                  {isSignIn && opt.id === "google"
                    ? "Sign in with Google"
                    : isSignIn && opt.id === "email"
                      ? "Sign in with Email"
                      : opt.label}
                </span>

                {/* Arrow */}
                <span
                  style={{
                    color: "#2a2a2a",
                    fontSize: "16px",
                    transition: "transform 0.15s ease, color 0.15s ease",
                    transform: isHovered ? "translateX(3px)" : "none",
                    color: isHovered
                      ? isGoogle
                        ? "#8ab4f8"
                        : "#84cc16"
                      : "#2a2a2a",
                  }}
                >
                  →
                </span>
              </button>
            );
          })}
        </div>

        {/* Divider + value prop */}
        {!isSignIn && (
          <div
            style={{
              background: "rgba(132,204,22,0.04)",
              border: "1px solid rgba(132,204,22,0.1)",
              borderRadius: "12px",
              padding: "16px 18px",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                fontSize: "10px",
                color: "#2d3e0a",
                letterSpacing: "2px",
                textTransform: "uppercase",
                fontWeight: 700,
                marginBottom: "12px",
              }}
            >
              Why join
            </div>
            {[
              "Earn from every like, comment & view",
              "84% creator revenue share — not platform share",
              "$1 one-time entry — EP deposited instantly",
            ].map((t, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: i < 2 ? "8px" : 0,
                }}
              >
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    borderRadius: "50%",
                    background: "rgba(132,204,22,0.15)",
                    border: "1px solid rgba(132,204,22,0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <span style={{ color: "#84cc16", fontSize: "8px" }}>✓</span>
                </div>
                <span
                  style={{
                    color: "#525252",
                    fontSize: "12px",
                    lineHeight: 1.5,
                  }}
                >
                  {t}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <p
          style={{
            textAlign: "center",
            fontSize: "11px",
            color: "#2a2a2a",
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          By continuing, you agree to our{" "}
          <span style={{ color: "#404040", cursor: "pointer" }}>Terms</span>
          {" & "}
          <span style={{ color: "#404040", cursor: "pointer" }}>
            Privacy Policy
          </span>
        </p>
      </div>
    </div>
  );
}
