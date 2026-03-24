// src/services/boost/boostService.js
// ============================================================================
// Boost Service — EP payment, activation, theme switching, real-time updates.
// Economy: $1 = 100 EP.  All pricing mirrors boost_ep_prices DB table.
// ============================================================================

import { supabase } from "../config/supabase";
import { BOOST_TIERS, BOOST_VISUAL } from "../account/profileTierService";

export { BOOST_TIERS, BOOST_VISUAL };

// ── In-memory cache ───────────────────────────────────────────────────────
const _cache = new Map();
const CACHE_TTL = 30_000;
function _set(k, v)  { _cache.set(k, { data:v, at:Date.now() }); }
function _get(k)     { const e=_cache.get(k); if(!e)return null; if(Date.now()-e.at>CACHE_TTL){_cache.delete(k);return null;} return e.data; }
function _del(k)     { _cache.delete(k); }

// ── EP balance ────────────────────────────────────────────────────────────
export async function getEPBalance(userId) {
  const { data, error } = await supabase.from("profiles")
    .select("engagement_points").eq("id", userId).single();
  if (error) throw error;
  return Number(data.engagement_points ?? 0);
}

// ── Active boost ──────────────────────────────────────────────────────────
export async function getActiveBoost(userId) {
  const cached = _get(userId);
  if (cached !== null) return cached;
  const { data, error } = await supabase.rpc("get_active_boost", { p_user_id: userId });
  if (error) throw error;
  const result = data?.active ? data : null;
  _set(userId, result);
  return result;
}

// ── Activate boost (EP payment) ───────────────────────────────────────────
export async function activateBoost(userId, tier, billing, autoRenew=false, themeId=null) {
  _del(userId);
  if (!BOOST_TIERS[tier])                      return { success:false, error:`Invalid tier: ${tier}` };
  if (!["monthly","yearly"].includes(billing)) return { success:false, error:"Invalid billing" };

  const { data, error } = await supabase.rpc("activate_boost", {
    p_user_id:    userId,
    p_tier:       tier,
    p_billing:    billing,
    p_auto_renew: autoRenew,
    p_theme_id:   themeId,
  });
  if (error) return { success:false, error:error.message };
  if (data?.success) {
    _set(userId, {
      active:true, tier, billing,
      ep_cost:data.ep_cost, ep_bonus_pct:data.ep_bonus_pct,
      expires_at:data.expires_at, auto_renew:autoRenew,
      boost_id:data.boost_id, current_ep:data.new_ep_balance,
      is_system_grant:false, active_theme_id:themeId,
    });
  }
  return data ?? { success:false, error:"No response from server" };
}

// ── Cancel boost ──────────────────────────────────────────────────────────
export async function cancelBoost(userId) {
  _del(userId);
  const { data, error } = await supabase.rpc("cancel_boost", { p_user_id:userId });
  if (error) return { success:false, error:error.message };
  return data ?? { success:false };
}

// ── Toggle auto-renew ─────────────────────────────────────────────────────
export async function toggleAutoRenew(userId, autoRenew) {
  _del(userId);
  const { data, error } = await supabase.rpc("toggle_boost_auto_renew", { p_user_id:userId, p_auto_renew:autoRenew });
  if (error) return { success:false, error:error.message };
  return data ?? { success:false };
}

// ── Update theme ──────────────────────────────────────────────────────────
export async function updateBoostTheme(userId, themeId) {
  _del(userId);
  const { data, error } = await supabase.rpc("update_boost_theme", { p_user_id:userId, p_theme_id:themeId });
  if (error) return { success:false, error:error.message };
  return data ?? { success:false };
}

// ── Real-time subscription ────────────────────────────────────────────────
export function subscribeToBoostChanges(userId, onChange) {
  const channel = supabase.channel(`boost_${userId}`)
    .on("postgres_changes",
      { event:"*", schema:"public", table:"profile_boosts", filter:`user_id=eq.${userId}` },
      async () => {
        _del(userId);
        try { onChange(await getActiveBoost(userId)); } catch {}
      }
    ).subscribe();
  return () => supabase.removeChannel(channel);
}

// ── Single user tier lookup ───────────────────────────────────────────────
export async function getUserBoostTier(userId) {
  try { const b = await getActiveBoost(userId); return b?.tier ?? null; }
  catch { return null; }
}

// ── Batch tier fetch (for feed/post cards) ────────────────────────────────
export async function batchGetBoostTiers(userIds) {
  if (!userIds?.length) return {};
  try {
    const { data } = await supabase.from("profile_boosts")
      .select("user_id, boost_tier, is_system_grant")
      .in("user_id", userIds).eq("status", "active")
      .gt("expires_at", new Date().toISOString());
    const result = {};
    for (const uid of userIds) result[uid] = null;
    const byUser = {};
    for (const row of data ?? []) {
      if (!byUser[row.user_id] || row.is_system_grant) byUser[row.user_id] = row.boost_tier;
    }
    Object.assign(result, byUser);
    return result;
  } catch {
    const r = {}; for (const uid of userIds) r[uid]=null; return r;
  }
}

export default {
  getEPBalance, getActiveBoost, activateBoost, cancelBoost,
  toggleAutoRenew, updateBoostTheme, subscribeToBoostChanges,
  getUserBoostTier, batchGetBoostTiers,
};