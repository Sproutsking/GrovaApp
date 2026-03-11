// ============================================================================
// src/hooks/useBoost.js
// Reads subscription_tier + boost_selections from Supabase with realtime sync.
// Also exposes boostEnabled flag from selections._enabled.
// ============================================================================

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../services/config/supabase";
import {
  getActiveBorderStyle,
  getActiveFrameOption,
  getActiveBackgroundOption,
  getActiveBorderOption,
  getTierNameColor,
  isBoostedTier,
} from "../services/config/boostAssets";

const useBoost = (userId) => {
  const [tier, setTier] = useState(null);
  const [selections, setSelections] = useState({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await supabase
        .from("profiles")
        .select("subscription_tier, boost_selections")
        .eq("id", userId)
        .maybeSingle();

      if (data) {
        setTier(data.subscription_tier || "free");
        setSelections(data.boost_selections || {});
      }
    } catch (err) {
      console.warn("useBoost load error:", err?.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime — update immediately when tier or selections change
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`boost-hook-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new?.subscription_tier !== undefined)
            setTier(payload.new.subscription_tier);
          if (payload.new?.boost_selections !== undefined)
            setSelections(payload.new.boost_selections || {});
        },
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [userId]);

  const isBoosted = isBoostedTier(tier);
  const boostEnabled = isBoosted && selections?._enabled !== false;

  return {
    tier,
    selections,
    loading,
    boostEnabled,
    isBoosted,
    borderStyle: boostEnabled ? getActiveBorderStyle(tier, selections) : null,
    borderOption: boostEnabled ? getActiveBorderOption(tier, selections) : null,
    frameOption: boostEnabled ? getActiveFrameOption(tier, selections) : null,
    bgOption: boostEnabled ? getActiveBackgroundOption(tier, selections) : null,
    nameColor: boostEnabled ? getTierNameColor(tier) : null,
    reload: load,
  };
};

export default useBoost;
