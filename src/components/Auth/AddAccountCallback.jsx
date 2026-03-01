// ============================================================================
// src/components/Auth/AddAccountCallback.jsx
// ============================================================================
//
// This component renders inside the POPUP WINDOW only.
// It is mounted at a route like /auth/popup-callback (or whatever URL
// you configure in buildPopupHTML's callbackUrl).
//
// FLOW:
//   1. Provider (Google/X/Discord/Facebook) redirects to this URL after auth
//   2. Supabase JS picks up the session from the URL hash/params
//   3. We post the user data to window.opener via postMessage
//   4. We sign out LOCAL scope only (clears this popup's session)
//   5. We close the popup
//
// IMPORTANT: This route must be added to your Supabase Redirect URLs list:
//   https://yourapp.vercel.app/auth/popup-callback
//
// ROUTER SETUP (React Router example):
//   <Route path="/auth/popup-callback" element={<AddAccountCallback />} />
//
// ============================================================================

import React, { useEffect, useState } from "react";
import { supabase } from "../../services/config/supabase";

const KEYFRAMES = `
  @keyframes cbSpin { to { transform: rotate(360deg); } }
  @keyframes cbFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
`;

const styles = {
  page: {
    minHeight: "100dvh",
    background: "#080808",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    padding: 24,
    textAlign: "center",
    animation: "cbFadeIn .4s ease",
  },
  logo: {
    fontSize: 28,
    fontWeight: 900,
    letterSpacing: "-1.5px",
    background: "linear-gradient(135deg, #a3e635, #4d7c0f)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    marginBottom: 4,
  },
  tagline: {
    fontSize: 10,
    color: "#2a2a2a",
    letterSpacing: "3.5px",
    textTransform: "uppercase",
    fontWeight: 700,
    marginBottom: 28,
  },
  spinner: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    border: "3px solid rgba(163,230,53,.1)",
    borderTopColor: "#a3e635",
    animation: "cbSpin .75s linear infinite",
  },
  statusText: {
    fontSize: 14,
    color: "#555",
    lineHeight: 1.6,
    maxWidth: 300,
    marginTop: 8,
  },
  successRing: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    background: "rgba(163,230,53,0.08)",
    border: "2px solid rgba(163,230,53,0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 28,
    boxShadow: "0 0 30px rgba(163,230,53,0.15)",
  },
  successTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: "#fff",
  },
  successSub: {
    fontSize: 13,
    color: "#555",
  },
  errorRing: {
    width: 60,
    height: 60,
    borderRadius: "50%",
    background: "rgba(239,68,68,0.08)",
    border: "2px solid rgba(239,68,68,0.25)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 26,
  },
  errorTitle: { fontSize: 16, fontWeight: 800, color: "#f87171" },
  errorMsg:   { fontSize: 13, color: "#555", lineHeight: 1.6, maxWidth: 280 },
  closeBtn: {
    marginTop: 8,
    padding: "10px 24px",
    borderRadius: 11,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.05)",
    color: "#888",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
};

export default function AddAccountCallback() {
  const [phase, setPhase]  = useState("loading"); // loading | success | error
  const [msg,   setMsg]    = useState("Completing sign-in…");
  const [error, setError]  = useState("");

  useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        // Give Supabase JS time to process the URL hash/params
        // (it does this automatically when the client initialises)
        await new Promise(r => setTimeout(r, 500));

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session?.user) {
          throw new Error(sessionError?.message || "No session found after OAuth redirect.");
        }

        const user = session.user;

        if (!mounted) return;
        setMsg("Linking account…");

        // Post result to the main window
        const payload = {
          type: "XEEVIA_ACCOUNT_ADDED",
          user: {
            id:       user.id,
            email:    user.email || "",
            fullName: user.user_metadata?.full_name
                   || user.user_metadata?.name
                   || user.email?.split("@")[0]
                   || "User",
            username: user.user_metadata?.user_name
                   || user.user_metadata?.preferred_username
                   || user.email?.split("@")[0]
                   || "user",
            avatar:   user.user_metadata?.avatar_url
                   || user.user_metadata?.picture
                   || null,
            provider: user.app_metadata?.provider || "oauth",
          },
        };

        // Sign out THIS popup session only — main window is unaffected
        await supabase.auth.signOut({ scope: "local" }).catch(() => {});

        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(payload, window.location.origin);
          if (mounted) {
            setPhase("success");
            setMsg("Account linked!");
          }
          setTimeout(() => { try { window.close(); } catch {} }, 1200);
        } else {
          // Opener closed — store as pending fallback
          try {
            localStorage.setItem("xeevia_pending_account", JSON.stringify(payload.user));
          } catch {}
          if (mounted) {
            setPhase("success");
            setMsg("Done! You can close this window.");
          }
        }
      } catch (err) {
        if (!mounted) return;
        setPhase("error");
        setError(err?.message || "Authentication failed. Please try again.");
      }
    }

    run();
    return () => { mounted = false; };
  }, []);

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div style={styles.page}>
        <div style={styles.logo}>XEEVIA</div>
        <div style={styles.tagline}>Account Setup</div>

        {phase === "loading" && (
          <>
            <div style={styles.spinner}/>
            <p style={styles.statusText}>{msg}</p>
          </>
        )}

        {phase === "success" && (
          <>
            <div style={styles.successRing}>✓</div>
            <div style={styles.successTitle}>Account linked!</div>
            <div style={styles.successSub}>Closing window…</div>
          </>
        )}

        {phase === "error" && (
          <>
            <div style={styles.errorRing}>✕</div>
            <div style={styles.errorTitle}>Sign-in failed</div>
            <div style={styles.errorMsg}>{error}</div>
            <button style={styles.closeBtn} onClick={() => window.close()}>
              Close window
            </button>
          </>
        )}
      </div>
    </>
  );
}