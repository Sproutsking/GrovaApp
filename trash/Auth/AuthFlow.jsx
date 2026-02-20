// ============================================================================
// src/components/Auth/AuthFlow.jsx — v14 FINAL
//
// SIGN UP vs SIGN IN:
//   Both end at onAuthComplete() → app opens instantly.
//   Onboarding (profile, payment) handled by OnboardingGate inside the app.
//
// EMAIL OTP:
//   Uses supabase.auth.signInWithOtp() directly.
//   shouldCreateUser: true handles both new and existing users.
//
// OAUTH:
//   redirectTo built from window.location.origin at call time.
//   AppGate handles the SIGNED_IN event after AuthCallback completes.
// ============================================================================

import React, { useState, useRef, useCallback, useEffect } from "react";
import EntryScreen from "./EntryScreen";
import EmailAuth from "./EmailAuth";
import { supabase } from "../../services/config/supabase";
import { getCallbackUrl } from "../../services/config/authConfig";

const STAGES = {
  ENTRY: "entry",
  EMAIL: "email",
};

const OAUTH_PROVIDERS = {
  google: "google",
  x: "twitter",
  twitter: "twitter",
  discord: "discord",
  facebook: "facebook",
  linkedin: "linkedin_oidc",
  apple: "apple",
};

export default function AuthFlow({ onAuthComplete }) {
  const [stage, setStage] = useState(STAGES.ENTRY);
  const [error, setError] = useState(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // ── routeUser — after email OTP verify ────────────────────────────────────
  // Fetches profile to pass to onAuthComplete.
  // For new users: creates skeleton row in background, opens app immediately.
  // For existing users: passes their profile, opens app immediately.
  const routeUser = useCallback(
    async (authUser) => {
      if (!authUser?.id || !mounted.current) return;

      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select(
            "id,username,account_activated,full_name,is_pro,verified,avatar_id,payment_status",
          )
          .eq("id", authUser.id)
          .maybeSingle();

        if (!mounted.current) return;

        if (!profile) {
          // Brand new user — create skeleton profile row in background
          supabase
            .from("profiles")
            .upsert(
              {
                id: authUser.id,
                email: authUser.email,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "id" },
            )
            .catch(() => {});
        }

        // Open app immediately regardless — OnboardingGate handles the rest
        onAuthComplete(authUser, profile ?? null);
      } catch {
        // Auth succeeded — open app even if profile fetch failed
        if (mounted.current) onAuthComplete(authUser, null);
      }
    },
    [onAuthComplete],
  );

  // ── OAuth handler ─────────────────────────────────────────────────────────
  const handleMethodSelect = useCallback((method) => {
    setError(null);

    if (method === "email") {
      setStage(STAGES.EMAIL);
      return;
    }

    if (method === "web3") {
      setError("Web3 wallet coming soon.");
      return;
    }

    const provider = OAUTH_PROVIDERS[method?.toLowerCase()];
    if (!provider) {
      setError("This login method is not available yet.");
      return;
    }

    const callbackUrl = getCallbackUrl();
    if (process.env.NODE_ENV === "development") {
      console.log("[AuthFlow] OAuth redirectTo:", callbackUrl);
    }

    supabase.auth
      .signInWithOAuth({
        provider,
        options: {
          redirectTo: callbackUrl,
          queryParams: { access_type: "offline", prompt: "select_account" },
        },
      })
      .catch((err) => {
        console.error("[AuthFlow] OAuth error:", err?.message);
        if (mounted.current)
          setError("Network error. Please check your connection.");
      });
  }, []);

  // ── Email OTP verified ────────────────────────────────────────────────────
  const handleEmailSuccess = useCallback(
    async (result) => {
      setError(null);

      try {
        let authUser = result?.user ?? result?.session?.user;

        if (!authUser?.id) {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          authUser = session?.user;
        }

        if (!authUser?.id) {
          if (mounted.current) {
            setError("Session not found. Please try signing in again.");
            setStage(STAGES.ENTRY);
          }
          return;
        }

        if (mounted.current) await routeUser(authUser);
      } catch (err) {
        console.error("[AuthFlow] handleEmailSuccess:", err);
        if (mounted.current) {
          setError("Something went wrong. Please try again.");
          setStage(STAGES.ENTRY);
        }
      }
    },
    [routeUser],
  );

  switch (stage) {
    case STAGES.EMAIL:
      return (
        <EmailAuth
          onSuccess={handleEmailSuccess}
          onBack={() => {
            setStage(STAGES.ENTRY);
            setError(null);
          }}
        />
      );
    case STAGES.ENTRY:
    default:
      return (
        <EntryScreen
          onSelectMethod={handleMethodSelect}
          error={error}
          onClearError={() => setError(null)}
        />
      );
  }
}
