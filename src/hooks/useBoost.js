// src/hooks/useBoost.js
// ============================================================================
// useBoost — real-time boost status + EP balance + theme management
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
import boostService from "../services/boost/boostService";

export function useBoost(userId) {
  const [boost,     setBoost]     = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [epBalance, setEPBalance] = useState(0);
  const [working,   setWorking]   = useState(false);
  const unsubRef = useRef(null);
  const mounted  = useRef(true);

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
    } catch (e) { console.warn("[useBoost]", e?.message); }
  }, [userId]);

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
        boostService.getEPBalance(userId).then(ep => { if (mounted.current) setEPBalance(ep); }).catch(()=>{});
      });
    })();
    return () => { mounted.current = false; if (unsubRef.current) unsubRef.current(); };
  }, [userId]); // eslint-disable-line

  const wrap = useCallback((fn) => async (...args) => {
    if (!userId || working) return { success:false, error:"Not ready" };
    setWorking(true);
    try { return await fn(...args); }
    finally { setWorking(false); }
  }, [userId, working]);

  const handleActivate = wrap(async (tier, billing, autoRenew=false, themeId=null) => {
    const r = await boostService.activateBoost(userId, tier, billing, autoRenew, themeId);
    if (r.success) await refresh();
    return r;
  });

  const handleCancel = wrap(async () => {
    const r = await boostService.cancelBoost(userId);
    if (r.success) { setBoost(null); await refresh(); }
    return r;
  });

  const handleToggleAutoRenew = wrap(async (enabled) => {
    const r = await boostService.toggleAutoRenew(userId, enabled);
    if (r.success) setBoost(p => p ? { ...p, auto_renew:enabled } : p);
    return r;
  });

  const handleUpdateTheme = wrap(async (themeId) => {
    const r = await boostService.updateBoostTheme(userId, themeId);
    if (r.success) setBoost(p => p ? { ...p, active_theme_id:themeId } : p);
    return r;
  });

  return {
    boost, loading, epBalance, working,
    activateBoost:   handleActivate,
    cancelBoost:     handleCancel,
    toggleAutoRenew: handleToggleAutoRenew,
    updateTheme:     handleUpdateTheme,
    refresh,
  };
}

export default useBoost;