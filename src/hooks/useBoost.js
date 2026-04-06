// src/hooks/useBoost.js
// ============================================================================
// useBoost — real-time boost status + EP balance + theme management
//
// Owned by UpgradeView (the current user's own boost).
// On every successful write it calls refreshBoostTier(userId) from
// useUserBoostTier so the shared read-cache is immediately invalidated —
// meaning every ProfilePreview and UserProfileModal on screen reflects the
// new tier before the Supabase realtime event even arrives.
//
// Returns:
//   boost           — active boost object or null  (includes active_theme_id)
//   loading         — true on first load
//   epBalance       — current EP (refreshed after every transaction)
//   working         — true during activate/cancel/toggle/theme operations
//   activateBoost   — async (tier, billing, autoRenew, themeId) → result
//   cancelBoost     — async () → result
//   toggleAutoRenew — async (bool) → result
//   updateTheme     — async (themeId) → result
//   refresh         — async () — force re-fetch
// ============================================================================

import { useState, useEffect, useCallback, useRef } from "react";
import boostService            from "../services/boost/boostService";
import { refreshBoostTier }    from "./useUserBoostTier";

export function useBoost(userId) {
  const [boost,     setBoost]     = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [epBalance, setEPBalance] = useState(0);
  const [working,   setWorking]   = useState(false);

  const unsubRef = useRef(null);
  const mounted  = useRef(true);

  // ── Refresh both boost state and EP balance ───────────────────────────
  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const [b, ep] = await Promise.all([
        boostService.getActiveBoost(userId),
        boostService.getEPBalance(userId),
      ]);
      if (!mounted.current) return;
      setBoost(b);
      setEPBalance(ep);
    } catch (e) {
      console.warn("[useBoost] refresh:", e?.message);
    }
  }, [userId]);

  // ── Initial load + realtime subscription ─────────────────────────────
  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    mounted.current = true;

    (async () => {
      setLoading(true);
      await refresh();
      if (!mounted.current) return;
      setLoading(false);

      unsubRef.current = boostService.subscribeToBoostChanges(userId, (nb) => {
        if (!mounted.current) return;
        setBoost(nb);
        boostService
          .getEPBalance(userId)
          .then((ep) => { if (mounted.current) setEPBalance(ep); })
          .catch(() => {});
      });
    })();

    return () => {
      mounted.current = false;
      if (unsubRef.current) unsubRef.current();
    };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Operation wrapper — sets working flag, handles errors ─────────────
  const wrap = useCallback(
    (fn) =>
      async (...args) => {
        if (!userId || working) return { success: false, error: "Not ready" };
        setWorking(true);
        try {
          return await fn(...args);
        } finally {
          setWorking(false);
        }
      },
    [userId, working]
  );

  // ── Activate boost ────────────────────────────────────────────────────
  const handleActivate = wrap(async (tier, billing, autoRenew = false, themeId = null) => {
    const r = await boostService.activateBoost(userId, tier, billing, autoRenew, themeId);
    if (r.success) {
      // Immediately push new tier to every ProfilePreview / UserProfileModal
      refreshBoostTier(userId);
      await refresh();
    }
    return r;
  });

  // ── Cancel boost ──────────────────────────────────────────────────────
  const handleCancel = wrap(async () => {
    const r = await boostService.cancelBoost(userId);
    if (r.success) {
      refreshBoostTier(userId); // clear shared cache immediately
      setBoost(null);
      await refresh();
    }
    return r;
  });

  // ── Toggle auto-renew ─────────────────────────────────────────────────
  const handleToggleAutoRenew = wrap(async (enabled) => {
    const r = await boostService.toggleAutoRenew(userId, enabled);
    if (r.success) {
      setBoost((p) => (p ? { ...p, auto_renew: enabled } : p));
    }
    return r;
  });

  // ── Update active theme ───────────────────────────────────────────────
  const handleUpdateTheme = wrap(async (themeId) => {
    const r = await boostService.updateBoostTheme(userId, themeId);
    if (r.success) {
      // Update local boost state
      setBoost((p) => (p ? { ...p, active_theme_id: themeId } : p));
      // Push new themeId to shared cache so ProfilePreviews update instantly
      refreshBoostTier(userId);
    }
    return r;
  });

  return {
    boost,
    loading,
    epBalance,
    working,
    activateBoost:   handleActivate,
    cancelBoost:     handleCancel,
    toggleAutoRenew: handleToggleAutoRenew,
    updateTheme:     handleUpdateTheme,
    refresh,
  };
}

export default useBoost;