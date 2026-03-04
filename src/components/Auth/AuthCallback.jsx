// ============================================================================
// src/components/Auth/AuthCallback.jsx
// ============================================================================
//
// This component handles the /auth/callback route for PKCE OAuth.
// Supabase redirects here after Google/X/Facebook/Discord login.
// It waits for the session to be established, then redirects to the app.
//
// ROUTER SETUP (React Router):
//   <Route path="/auth/callback" element={<AuthCallback />} />
//
// ============================================================================

import React, { useEffect, useState } from "react";
import { supabase } from "../../services/config/supabase";

const STYLES = `
  @keyframes cbSpin { to { transform: rotate(360deg); } }
  @keyframes cbFade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
`;

export default function AuthCallback() {
  const [status, setStatus] = useState("loading"); // loading | success | error
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    let mounted = true;

    const handle = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const hash   = window.location.hash;

        // Handle OAuth errors
        const errorCode = params.get("error_code") || params.get("error");
        if (errorCode) {
          const desc = params.get("error_description") || errorCode;
          if (!mounted) return;
          setErrMsg(decodeURIComponent(desc).replace(/\+/g, " "));
          setStatus("error");
          setTimeout(() => {
            window.location.href = "/login";
          }, 2000);
          return;
        }

        // PKCE: Supabase JS automatically exchanges the ?code= param
        // when getSession() is called — we just wait for it.
        // Give it up to 5s to complete the exchange.
        let session = null;
        const deadline = Date.now() + 5000;

        while (Date.now() < deadline) {
          const { data } = await supabase.auth.getSession();
          if (data?.session) { session = data.session; break; }
          await new Promise(r => setTimeout(r, 300));
        }

        if (!session) {
          // Try one more time with a longer wait
          await new Promise(r => setTimeout(r, 1500));
          const { data } = await supabase.auth.getSession();
          session = data?.session ?? null;
        }

        if (!mounted) return;

        if (session) {
          setStatus("success");
          // Clean up URL then redirect to app
          window.history.replaceState({}, "", "/");
          setTimeout(() => {
            window.location.href = "/";
          }, 500);
        } else {
          setErrMsg("Sign-in could not be completed. Please try again.");
          setStatus("error");
          setTimeout(() => {
            window.location.href = "/login";
          }, 2000);
        }
      } catch (err) {
        if (!mounted) return;
        setErrMsg(err?.message || "An error occurred during sign-in.");
        setStatus("error");
        setTimeout(() => {
          window.location.href = "/login";
        }, 2000);
      }
    };

    handle();
    return () => { mounted = false; };
  }, []);

  const pageStyle = {
    minHeight: "100dvh",
    background: "#080808",
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    gap: 20, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    padding: 24, textAlign: "center",
    animation: "cbFade .4s ease",
  };

  return (
    <>
      <style>{STYLES}</style>
      <div style={pageStyle}>
        {/* Logo */}
        <div style={{
          fontSize: 32, fontWeight: 900, letterSpacing: "-1.5px",
          background: "linear-gradient(135deg, #a3e635, #4d7c0f)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          XEEVIA
        </div>

        {status === "loading" && (
          <>
            <div style={{
              width: 44, height: 44, borderRadius: "50%",
              border: "3px solid rgba(163,230,53,.1)", borderTopColor: "#a3e635",
              animation: "cbSpin .75s linear infinite",
            }} />
            <div style={{ fontSize: 14, color: "#444" }}>Completing sign-in…</div>
          </>
        )}

        {status === "success" && (
          <>
            <div style={{
              width: 60, height: 60, borderRadius: "50%",
              background: "rgba(163,230,53,.1)", border: "2px solid rgba(163,230,53,.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 26,
            }}>✓</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#a3e635" }}>Signed in!</div>
            <div style={{ fontSize: 13, color: "#444" }}>Taking you to the app…</div>
          </>
        )}

        {status === "error" && (
          <>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "rgba(239,68,68,.08)", border: "2px solid rgba(239,68,68,.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24,
            }}>✕</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#f87171" }}>Sign-in failed</div>
            <div style={{ fontSize: 13, color: "#555", maxWidth: 300, lineHeight: 1.65 }}>{errMsg}</div>
            <div style={{ fontSize: 12, color: "#444" }}>Redirecting to login…</div>
          </>
        )}
      </div>
    </>
  );
}