// src/services/account/profileTierService.js
// ============================================================================
// Profile Tier Service — Handles boost purchases and tier display
//
// TIER MODEL (clear separation of concerns):
//
//   account_activated + payment_status = access gate
//   ├── payment_status = "paid"  → paid real money
//   ├── payment_status = "free"  → got free invite access
//   └── payment_status = "pending" → has NOT paid yet (blocked by paywall)
//
//   subscription_tier = what level/boost they have WITHIN the platform
//   ├── "standard"   → base paid member (no boost)
//   ├── "whitelist"  → came in via whitelist invite
//   ├── "vip"        → VIP invite access
//   ├── "silver"     → purchased Silver Boost ($4.99/mo)
//   ├── "gold"       → purchased Gold Boost ($9.99/mo)
//   └── "diamond"    → purchased Diamond Boost ($19.99/mo)
//
//   Profile boosts (silver/gold/diamond) are SEPARATE purchases
//   from the entry fee. A user pays $4 to get IN, then optionally
//   pays extra to boost their profile visibility.
// ============================================================================

import { supabase } from '../config/supabase';

export const BOOST_TIERS = {
  silver: {
    id:          "silver",
    name:        "Silver Boost",
    color:       "#c0c0c0",
    ep_bonus_pct: 0,
    feed_boost:  0.15,
    price:       { monthly: 4.99, yearly: 3.99 },
    badge_emoji: "🥈",
    benefits:    ["Silver avatar border", "Priority in Explore", "+15% feed reach", "Silver badge"],
  },
  gold: {
    id:           "gold",
    name:         "Gold Boost",
    color:        "#fbbf24",
    ep_bonus_pct: 5,
    feed_boost:   0.35,
    price:        { monthly: 9.99, yearly: 7.99 },
    badge_emoji:  "👑",
    benefits:     ["Gold animated border", "+35% feed reach", "+5% EP on earnings", "Monthly EP drops", "Gold badge"],
  },
  diamond: {
    id:           "diamond",
    name:         "Diamond Boost",
    color:        "#a78bfa",
    ep_bonus_pct: 15,
    feed_boost:   0.65,
    price:        { monthly: 19.99, yearly: 15.99 },
    badge_emoji:  "💎",
    benefits:     ["Diamond animated border", "+65% feed reach", "+15% EP on all activity", "VIP features", "Free 500EP monthly", "Diamond badge"],
  },
};

// ── Get user's current tier info ──────────────────────────────────────────────
/**
 * Get a user's complete tier/access info.
 * @param {string} userId
 * @returns {{ accessStatus, tierLabel, tierColor, tierEmoji, hasBoost, boostTier, isActivated }}
 */
export async function getUserTierInfo(userId) {
  if (!userId) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("account_activated, payment_status, subscription_tier, subscription_expires, boost_selections")
    .eq("id", userId)
    .single();

  if (error) throw new Error(`Failed to fetch tier info: ${error.message}`);

  return buildTierInfo(profile);
}

/**
 * Build tier display info from a profile row.
 * Can be called with a profile object directly (avoids extra DB call).
 */
export function buildTierInfo(profile) {
  if (!profile) return null;

  const isActivated = profile.account_activated === true;
  const payStatus   = profile.payment_status ?? "pending";
  const tier        = profile.subscription_tier ?? "free";

  // Access status (the paywall question)
  let accessStatus;
  if (!isActivated || payStatus === "pending") {
    accessStatus = "NOT_ACTIVATED";
  } else if (payStatus === "paid") {
    accessStatus = "PAID";
  } else if (payStatus === "free") {
    accessStatus = "FREE_ACCESS";
  } else {
    accessStatus = "NOT_ACTIVATED";
  }

  // Boost tier (within platform upgrade question)
  const boostConfig = BOOST_TIERS[tier] ?? null;
  const hasBoost    = !!boostConfig;

  // Base tier display (no boost)
  const BASE_TIERS = {
    vip:       { label: "VIP Member",        color: "#f59e0b", emoji: "⭐" },
    whitelist: { label: "Whitelist Member",   color: "#a3e635", emoji: "🌿" },
    standard:  { label: "Standard Member",    color: "#94a3b8", emoji: "✓"  },
    free:      { label: "Free Member",        color: "#94a3b8", emoji: "✓"  },
  };

  let tierLabel, tierColor, tierEmoji;
  if (hasBoost) {
    tierLabel = boostConfig.name;
    tierColor = boostConfig.color;
    tierEmoji = boostConfig.badge_emoji;
  } else {
    const base = BASE_TIERS[tier] ?? BASE_TIERS.standard;
    tierLabel  = base.label;
    tierColor  = base.color;
    tierEmoji  = base.emoji;
  }

  return {
    accessStatus,
    tierLabel,
    tierColor,
    tierEmoji,
    hasBoost,
    boostTier:   hasBoost ? tier : null,
    boostConfig: boostConfig,
    isActivated,
    paymentStatus:    payStatus,
    subscriptionTier: tier,
    // Badge to show next to username
    badge: hasBoost ? boostConfig.badge_emoji : (
      tier === "vip" ? "⭐" : tier === "whitelist" ? "🌿" : null
    ),
  };
}

// ── Activate boost tier ───────────────────────────────────────────────────────
/**
 * Activate a profile boost. Called after payment is confirmed.
 * @param {string} userId
 * @param {string} boostTier - "silver" | "gold" | "diamond"
 * @param {string} billing   - "monthly" | "yearly"
 * @param {string} [paymentId]
 */
export async function activateBoost(userId, boostTier, billing = "monthly", paymentId = null) {
  if (!BOOST_TIERS[boostTier]) throw new Error(`Invalid boost tier: ${boostTier}`);
  if (!userId) throw new Error("userId required");

  const config = BOOST_TIERS[boostTier];
  const daysMap = { monthly: 30, yearly: 365 };
  const days = daysMap[billing] ?? 30;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  // Update profile tier
  const { error: profileErr } = await supabase
    .from("profiles")
    .update({
      subscription_tier:    boostTier,
      subscription_expires: expiresAt,
      updated_at:           new Date().toISOString(),
    })
    .eq("id", userId);

  if (profileErr) throw new Error(`Failed to activate boost: ${profileErr.message}`);

  // Record the boost purchase
  await supabase.from("profile_boosts").insert({
    user_id:       userId,
    boost_tier:    boostTier,
    billing,
    price_usd:     config.price[billing],
    ep_bonus_pct:  config.ep_bonus_pct,
    expires_at:    expiresAt,
    status:        "active",
    payment_id:    paymentId,
  }).catch(() => {});

  return { boostTier, expiresAt, config };
}

// ── Cancel / expire boost ─────────────────────────────────────────────────────
/**
 * Expire a boost and revert to standard tier.
 * Called by cron job or manual cancellation.
 */
export async function expireBoost(userId) {
  if (!userId) return;

  // Get current tier to determine what to revert to
  const { data: profile } = await supabase
    .from("profiles")
    .select("payment_status, boost_selections")
    .eq("id", userId)
    .single();

  // Revert to appropriate base tier
  const baseTier = profile?.payment_status === "free" ? "whitelist" : "standard";

  await supabase
    .from("profiles")
    .update({
      subscription_tier:    baseTier,
      subscription_expires: null,
      updated_at:           new Date().toISOString(),
    })
    .eq("id", userId);

  // Mark boost as expired
  await supabase
    .from("profile_boosts")
    .update({ status: "expired" })
    .eq("user_id", userId)
    .eq("status", "active");
}

// ── Get active boost ──────────────────────────────────────────────────────────
export async function getActiveBoost(userId) {
  if (!userId) return null;

  const { data } = await supabase
    .from("profile_boosts")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .maybeSingle();

  return data;
}

// ── Tier badge component helper ───────────────────────────────────────────────
/**
 * Returns the badge config for inline display next to a username.
 * Used by ProfilePreview, UserProfileModal, ProfileSection.
 */
export function getTierBadge(subscriptionTier, paymentStatus) {
  if (!subscriptionTier || paymentStatus === "pending") return null;

  const badges = {
    diamond:   { emoji: "💎", color: "#a78bfa", label: "Diamond",   glow: "rgba(167,139,250,0.4)" },
    gold:      { emoji: "👑", color: "#fbbf24", label: "Gold",       glow: "rgba(251,191,36,0.4)"  },
    silver:    { emoji: "🥈", color: "#c0c0c0", label: "Silver",     glow: "rgba(192,192,192,0.4)" },
    vip:       { emoji: "⭐", color: "#f59e0b", label: "VIP",        glow: "rgba(245,158,11,0.4)"  },
    whitelist: { emoji: "🌿", color: "#a3e635", label: "Whitelist",  glow: "rgba(163,230,53,0.4)"  },
    standard:  null, // No badge for standard members
    free:      null,
  };

  return badges[subscriptionTier] ?? null;
}

export default {
  BOOST_TIERS,
  getUserTierInfo,
  buildTierInfo,
  activateBoost,
  expireBoost,
  getActiveBoost,
  getTierBadge,
};