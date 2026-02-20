// ============================================================================
// src/components/Auth/OnboardingGate.jsx — FINAL
//
// PURPOSE:
//   Sits between AppGate and MainApp. Once the user is authenticated,
//   this checks if they need to complete onboarding steps.
//
// CHECKS (in order):
//   1. No username → show ProfileSetup
//   2. Has username but account_activated !== true → show PaymentWall
//   3. Admin users → bypass PaymentWall (admins activate for free)
//   4. Fully onboarded → render children (the real app)
//
// SPEED:
//   • Profile comes from AuthContext (already fetched by AppGate, no extra call)
//   • Only re-fetches after a step completes to get fresh state
//   • Admins skip payment check entirely
// ============================================================================

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "./AppGate";
import ProfileSetup from "./ProfileSetup";
import PaymentWall from "./PaymentWall";
import { supabase } from "../../services/config/supabase";

export default function OnboardingGate({ children }) {
  const { user, profile: ctxProfile, isAdmin } = useAuth();

  // Start with whatever AppGate already fetched — no extra round trip
  const [profile, setProfile] = useState(ctxProfile);
  const [loading, setLoading] = useState(false);

  // Sync if context profile updates (e.g. USER_UPDATED event)
  useEffect(() => {
    if (ctxProfile) setProfile(ctxProfile);
  }, [ctxProfile]);

  // If no profile in context (new Google OAuth user, trigger not set up),
  // fetch it once — lightweight single query
  useEffect(() => {
    if (!ctxProfile && user?.id && !loading) {
      setLoading(true);
      supabase
        .from("profiles")
        .select(
          "id,username,account_activated,full_name,is_pro,verified,avatar_id,payment_status",
        )
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          setProfile(data ?? null);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [ctxProfile, user, loading]);

  // ── Refresh profile after a step completes ────────────────────────────────
  const refreshProfile = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("profiles")
      .select(
        "id,username,account_activated,full_name,is_pro,verified,avatar_id,payment_status",
      )
      .eq("id", user.id)
      .maybeSingle();
    setProfile(data ?? null);
  }, [user]);

  // Still doing initial fetch
  if (!ctxProfile && loading) return null;

  // ── Check 1: No username → ProfileSetup ──────────────────────────────────
  if (!profile?.username?.trim()) {
    return <ProfileSetup user={user} onComplete={refreshProfile} />;
  }

  // ── Check 2: Not activated → PaymentWall (skip for admins) ───────────────
  if (profile.account_activated !== true && !isAdmin) {
    return (
      <PaymentWall
        user={user}
        onPaymentComplete={refreshProfile}
        onBack={() => {}}
      />
    );
  }

  // ── Fully onboarded (or admin) → render the app ───────────────────────────
  return children;
}
