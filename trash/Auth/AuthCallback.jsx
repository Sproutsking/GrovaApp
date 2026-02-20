// ============================================================================
// src/components/Auth/AuthCallback.jsx — v18 FINAL
//
// ROOT CAUSE (confirmed from screenshots):
//   navigator.locks inside exchangeCodeForSession gets aborted on BOTH
//   StrictMode mount attempts — 800ms isn't long enough because the lock
//   is tied to the PKCE verifier lifecycle, not just StrictMode cleanup.
//
// THE CORRECT FIX:
//   Supabase's client-side JS detects the ?code= param on page load and
//   attempts the exchange automatically when getSession() is called.
//   So: call getSession() FIRST. If it returns a session, we're done.
//   Only call exchangeCodeForSession() manually if getSession() returns null
//   AND we wait long enough for StrictMode to fully settle (2000ms).
//
// FLOW:
//   1. getSession() immediately — Supabase may have auto-exchanged already
//   2. If session found → go to app ✓
//   3. If not → wait 2000ms for StrictMode to finish ALL its mount/unmount cycles
//   4. Try exchangeCodeForSession() once with the full URL
//   5. If still fails → poll getSession() for 8s (sometimes it's just slow)
//   6. If nothing works → show error
//
// Module-level guard ensures only ONE execution path runs even with
// React StrictMode double-mounting.
// ============================================================================

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../services/config/supabase";

// Module-level — survives StrictMode double-mount
let _started = false;
let _done = false;
let _result = null; // { ok: true } | { error: string }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isAbortErr(err) {
  if (!err) return false;
  const msg = (err?.message || String(err)).toLowerCase();
  return (
    err?.name === "AbortError" ||
    msg.includes("aborted") ||
    msg.includes("abort")
  );
}

function isUnrecoverable(msg) {
  if (!msg) return false;
  if (isAbortErr({ message: msg })) return false;
  const lower = msg.toLowerCase();
  return [
    "invalid flow state",
    "no valid flow state",
    "code challenge",
    "already been used",
    "invalid grant",
    "invalid_grant",
  ].some((p) => lower.includes(p));
}

export default function AuthCallback() {
  const mounted = useRef(false);
  const doneRef = useRef(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const dev = process.env.NODE_ENV === "development";
  const log = (...a) => {
    if (dev) console.log("[AuthCallback]", ...a);
  };

  const goToApp = () => {
    log("✓ SUCCESS → app");
    try {
      window.history.replaceState(null, "", "/");
    } catch {}
    window.location.replace("/#home");
  };

  const goToAuth = (msg) => {
    log("✗ FAIL →", msg);
    try {
      window.history.replaceState(null, "", "/");
    } catch {}
    if (mounted.current)
      setErrorMsg(msg || "Sign-in failed. Please try again.");
    setTimeout(() => {
      if (mounted.current) window.location.replace("/");
    }, 3000);
  };

  const finish = (ok, msg) => {
    _result = ok ? { ok: true } : { error: msg };
    _done = true;
    if (!doneRef.current) {
      doneRef.current = true;
      if (ok) goToApp();
      else goToAuth(msg);
    }
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (doneRef.current) return;

    const url = window.location.href;
    let code;
    try {
      code = new URL(url).searchParams.get("code");
    } catch {
      code = null;
    }

    log("Mount. code:", code ? code.slice(0, 8) + "…" : "NONE");

    if (!code) {
      // No code — check for existing session (hash-based or already exchanged)
      supabase.auth
        .getSession()
        .then(({ data }) => {
          if (!doneRef.current) {
            doneRef.current = true;
            if (data?.session?.user) goToApp();
            else goToAuth("No sign-in code found. Please try again.");
          }
        })
        .catch(() => {
          if (!doneRef.current) {
            doneRef.current = true;
            goToAuth();
          }
        });
      return;
    }

    // ── SECOND MOUNT (StrictMode) ──────────────────────────────────────────
    if (_started) {
      log("Second mount — waiting for first mount");
      if (_done && _result?.ok) {
        doneRef.current = true;
        goToApp();
        return;
      }
      if (_done && _result?.error) {
        doneRef.current = true;
        goToAuth(_result.error);
        return;
      }

      // Poll for first mount to finish
      let polls = 0;
      const poll = setInterval(async () => {
        if (doneRef.current) {
          clearInterval(poll);
          return;
        }
        if (_done) {
          clearInterval(poll);
          doneRef.current = true;
          if (_result?.ok) goToApp();
          else goToAuth(_result?.error);
          return;
        }
        try {
          const { data } = await supabase.auth.getSession();
          if (data?.session?.user) {
            clearInterval(poll);
            doneRef.current = true;
            goToApp();
          }
        } catch {}
        if (++polls > 120) {
          clearInterval(poll);
          doneRef.current = true;
          goToAuth("Sign-in timed out.");
        }
      }, 100);
      return () => clearInterval(poll);
    }

    // ── FIRST MOUNT — the only path that does real work ───────────────────
    _started = true;
    _done = false;
    _result = null;

    const run = async () => {
      // ── STEP 1: getSession() first ──────────────────────────────────────
      // Supabase JS SDK detects ?code= on load and may auto-exchange it.
      // If session is already there, skip everything.
      log("Step 1: checking getSession() first...");
      try {
        const { data: sd1 } = await supabase.auth.getSession();
        if (sd1?.session?.user) {
          finish(true);
          return;
        }
      } catch {}

      // ── STEP 2: Wait for StrictMode to fully settle ─────────────────────
      // StrictMode: mount → unmount → remount. The unmount releases locks.
      // 2000ms gives StrictMode time to complete ALL cycles before we
      // attempt exchangeCodeForSession which needs the locks to be free.
      log("Step 2: waiting 2000ms for StrictMode to settle...");
      await sleep(2000);

      // Check session again — maybe Supabase exchanged it during the wait
      try {
        const { data: sd2 } = await supabase.auth.getSession();
        if (sd2?.session?.user) {
          finish(true);
          return;
        }
      } catch {}

      // ── STEP 3: Manual exchange (StrictMode locks now released) ─────────
      log("Step 3: exchangeCodeForSession...");
      let data, error;
      try {
        ({ data, error } = await supabase.auth.exchangeCodeForSession(url));
      } catch (thrown) {
        error = thrown;
      }

      const errMsg =
        error?.message || error?.error_description || String(error ?? "");
      log(
        "Exchange result — err:",
        errMsg || "none",
        "| session:",
        !!data?.session?.user,
      );

      if (data?.session?.user) {
        finish(true);
        return;
      }

      if (error && isUnrecoverable(errMsg)) {
        try {
          Object.keys(localStorage)
            .filter((k) => k.includes("code-verifier"))
            .forEach((k) => localStorage.removeItem(k));
          Object.keys(sessionStorage)
            .filter((k) => k.includes("code-verifier"))
            .forEach((k) => sessionStorage.removeItem(k));
        } catch {}
        const msg = errMsg.toLowerCase().includes("expired")
          ? "Your sign-in link expired. Please sign in again."
          : "Sign-in link was already used. Please sign in again.";
        finish(false, msg);
        return;
      }

      // ── STEP 4: Poll getSession() — covers slow network / async exchange ─
      log("Step 4: polling getSession() for 8s...");
      let polls = 0;
      const poll = setInterval(async () => {
        if (doneRef.current) {
          clearInterval(poll);
          return;
        }
        try {
          const { data: sd } = await supabase.auth.getSession();
          if (sd?.session?.user) {
            clearInterval(poll);
            finish(true);
            return;
          }
        } catch {}
        if (++polls >= 80) {
          // 8 seconds
          clearInterval(poll);
          finish(false, "Sign-in failed. Please try again.");
        }
      }, 100);
    };

    run();
  }, []); // eslint-disable-line

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "linear-gradient(160deg,#000 0%,#060806 50%,#020202 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "24px",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          fontSize: "clamp(44px,11vw,68px)",
          fontWeight: 900,
          letterSpacing: "-3px",
          background:
            "linear-gradient(135deg,#c8f542 0%,#84cc16 55%,#65a30d 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          fontFamily: "'Syne','Space Grotesk',sans-serif",
        }}
      >
        XEEVIA
      </div>

      {errorMsg ? (
        <>
          <div style={{ fontSize: 36 }}>⚠️</div>
          <p
            style={{
              color: "#f87171",
              fontSize: 14,
              textAlign: "center",
              maxWidth: 300,
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            {errorMsg}
          </p>
          <p
            style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, margin: 0 }}
          >
            Redirecting to sign‑in…
          </p>
        </>
      ) : (
        <>
          <div
            style={{
              width: 30,
              height: 30,
              border: "2px solid rgba(132,204,22,0.07)",
              borderTop: "2px solid #84cc16",
              borderRadius: "50%",
              animation: "xvSpin 0.72s linear infinite",
            }}
          />
          <p
            style={{
              color: "rgba(255,255,255,0.35)",
              fontSize: 11,
              letterSpacing: "3px",
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            Completing sign in
          </p>
        </>
      )}
      <style>{`@keyframes xvSpin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
