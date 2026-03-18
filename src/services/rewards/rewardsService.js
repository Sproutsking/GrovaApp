// src/services/rewards/rewardsService.js
// ============================================================================
// Complete Rewards Service — Supabase integrated
// $1 = 100 EP — enforced everywhere
// Handles: EP balance, daily tasks, weekly bonus, deposit, redeem, leaderboard
// ============================================================================

import { supabase } from '../config/supabase';

// ── Constants ─────────────────────────────────────────────────────────────────
export const EP_PER_USD     = 100;   // $1 = 100 EP — core protocol rule
export const PROTOCOL_FEE   = 0.02;  // 2% on all EP transactions
export const CREATOR_SHARE  = 0.84;  // 84% of tips go to creator
export const XEV_CONVERT_PCT = 0.40; // 40% of monthly EP auto-converts to $XEV

export const DAILY_TASKS_CONFIG = [
  { id: "login",       ep: 1,  cap: 1, label: "Daily Login",     type: "invite_grant" },
  { id: "post_create", ep: 1,  cap: 5, label: "Publish a Post",  type: "bonus_grant"  },
  { id: "reel_create", ep: 1,  cap: 3, label: "Upload a Reel",   type: "bonus_grant"  },
  { id: "engage_5",    ep: 1,  cap: 1, label: "Engage 5 Posts",  type: "bonus_grant"  },
];

export const WEEKLY_BONUS_EP = 10;

// ── Get EP balance ────────────────────────────────────────────────────────────
/**
 * Get a user's current EP balance from profiles.
 * @param {string} userId
 * @returns {number} EP balance
 */
export async function getEPBalance(userId) {
  if (!userId) return 0;

  const { data, error } = await supabase
    .from("profiles")
    .select("engagement_points")
    .eq("id", userId)
    .single();

  if (error) throw new Error(`Failed to fetch EP balance: ${error.message}`);
  return Number(data?.engagement_points ?? 0);
}

// ── Get full rewards profile ──────────────────────────────────────────────────
/**
 * Get all rewards data for a user in one call.
 * @param {string} userId
 * @returns {{ balance, dashboard, transactions }}
 */
export async function getRewardsProfile(userId) {
  if (!userId) throw new Error("userId required");

  const [profileRes, dashboardRes, transactionsRes] = await Promise.allSettled([
    supabase
      .from("profiles")
      .select("engagement_points, subscription_tier, payment_status")
      .eq("id", userId)
      .single(),
    supabase
      .from("ep_dashboard")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("ep_transactions")
      .select("id, amount, balance_after, type, reason, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const profile = profileRes.status === "fulfilled" ? profileRes.value.data : null;
  const dashboard = dashboardRes.status === "fulfilled" ? dashboardRes.value.data : null;
  const transactions = transactionsRes.status === "fulfilled" ? (transactionsRes.value.data ?? []) : [];

  return {
    balance:      Number(profile?.engagement_points ?? 0),
    dailyEP:      Number(dashboard?.daily_ep ?? 0),
    weeklyEP:     Number(dashboard?.weekly_ep ?? 0),
    monthlyEP:    Number(dashboard?.monthly_ep ?? 0),
    totalEarned:  Number(dashboard?.total_ep_earned ?? profile?.engagement_points ?? 0),
    transactions,
    subscriptionTier: profile?.subscription_tier ?? "free",
    paymentStatus:    profile?.payment_status ?? "pending",
  };
}

// ── Get today's task completion state ─────────────────────────────────────────
/**
 * Get which daily tasks have been completed today.
 * @param {string} userId
 * @returns {{ claimed: Set<string>, counts: Record<string,number> }}
 */
export async function getTodayTaskState(userId) {
  if (!userId) return { claimed: new Set(), counts: {} };

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  const { data, error } = await supabase
    .from("daily_task_completions")
    .select("task_id, count")
    .eq("user_id", userId)
    .eq("completed_at", today);

  if (error) {
    console.warn("[rewardsService] getTodayTaskState:", error.message);
    return { claimed: new Set(), counts: {} };
  }

  const counts = {};
  const claimed = new Set();

  for (const row of (data ?? [])) {
    counts[row.task_id] = row.count;
    const taskConfig = DAILY_TASKS_CONFIG.find(t => t.id === row.task_id);
    if (taskConfig && row.count >= taskConfig.cap) {
      claimed.add(row.task_id);
    }
  }

  return { claimed, counts };
}

// ── Claim daily task ──────────────────────────────────────────────────────────
/**
 * Claim a daily task reward.
 * @param {string} userId
 * @param {string} taskId  - e.g. "login", "post_create"
 * @returns {{ ep_granted: number, new_count: number, capped: boolean }}
 */
export async function claimDailyTask(userId, taskId) {
  if (!userId || !taskId) throw new Error("userId and taskId required");

  const task = DAILY_TASKS_CONFIG.find(t => t.id === taskId);
  if (!task) throw new Error(`Unknown task: ${taskId}`);

  const today = new Date().toISOString().split("T")[0];

  // Get current count
  const { data: existing } = await supabase
    .from("daily_task_completions")
    .select("id, count")
    .eq("user_id", userId)
    .eq("task_id", taskId)
    .eq("completed_at", today)
    .maybeSingle();

  const currentCount = existing?.count ?? 0;

  if (currentCount >= task.cap) {
    return { ep_granted: 0, new_count: currentCount, capped: true };
  }

  const newCount = currentCount + 1;

  // Upsert the task completion
  if (existing) {
    await supabase
      .from("daily_task_completions")
      .update({ count: newCount })
      .eq("id", existing.id);
  } else {
    await supabase
      .from("daily_task_completions")
      .insert({ user_id: userId, task_id: taskId, completed_at: today, count: 1 });
  }

  // Grant EP
  const { error: epErr } = await supabase.rpc("increment_engagement_points", {
    p_user_id:    userId,
    p_amount:     task.ep,
    p_reason:     `Daily task: ${task.label} (${newCount}/${task.cap})`,
    p_payment_id: null,
    p_product_id: null,
  });

  if (epErr) {
    // Fallback direct update
    const { data: p } = await supabase.from("profiles").select("engagement_points").eq("id", userId).single();
    if (p) await supabase.from("profiles").update({ engagement_points: (Number(p.engagement_points) || 0) + task.ep }).eq("id", userId);
  }

  return { ep_granted: task.ep, new_count: newCount, capped: newCount >= task.cap };
}

// ── Claim weekly bonus ────────────────────────────────────────────────────────
/**
 * Claim the weekly quality bonus (10 EP).
 * @param {string} userId
 * @returns {{ ep_granted: number }}
 */
export async function claimWeeklyBonus(userId) {
  if (!userId) throw new Error("userId required");

  // Check qualification: user must have a post with ≥2 engagements this week
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: posts } = await supabase
    .from("posts")
    .select("id, likes, comments_count")
    .eq("user_id", userId)
    .gte("created_at", weekAgo)
    .is("deleted_at", null);

  const qualified = (posts ?? []).some(p => (p.likes || 0) + (p.comments_count || 0) >= 2);
  if (!qualified) throw new Error("Not qualified yet. Post this week and earn ≥2 real engagements.");

  // Check not already claimed this week
  const monday = getMonday();
  const { data: existing } = await supabase
    .from("ep_transactions")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "bonus_grant")
    .ilike("reason", "%Weekly quality bonus%")
    .gte("created_at", monday.toISOString())
    .maybeSingle();

  if (existing) throw new Error("Weekly bonus already claimed this week.");

  // Grant EP
  const { error } = await supabase.rpc("increment_engagement_points", {
    p_user_id:    userId,
    p_amount:     WEEKLY_BONUS_EP,
    p_reason:     "Weekly quality bonus — ≥2 engagements on post",
    p_payment_id: null,
    p_product_id: null,
  });

  if (error) {
    const { data: p } = await supabase.from("profiles").select("engagement_points").eq("id", userId).single();
    if (p) await supabase.from("profiles").update({ engagement_points: (Number(p.engagement_points) || 0) + WEEKLY_BONUS_EP }).eq("id", userId);
  }

  return { ep_granted: WEEKLY_BONUS_EP };
}

// ── Deposit EP (buy EP with USD) ──────────────────────────────────────────────
/**
 * Process an EP deposit. $1 = 100 EP, 2% fee applied.
 * NOTE: In production this triggers a real payment via Paystack.
 *       This function handles the EP crediting after payment confirmed.
 * @param {string} userId
 * @param {number} amountUSD
 * @param {string} [paymentId]
 * @returns {{ gross_ep, fee_ep, net_ep }}
 */
export async function depositEP(userId, amountUSD, paymentId = null) {
  if (!userId) throw new Error("userId required");
  if (!amountUSD || amountUSD < 1) throw new Error("Minimum deposit is $1");

  const gross_ep = Math.floor(amountUSD * EP_PER_USD);  // $1 = 100 EP
  const fee_ep   = Math.round(gross_ep * PROTOCOL_FEE); // 2% fee
  const net_ep   = gross_ep - fee_ep;

  const { error } = await supabase.rpc("increment_engagement_points", {
    p_user_id:    userId,
    p_amount:     net_ep,
    p_reason:     `EP Deposit: $${amountUSD.toFixed(2)} → ${gross_ep} EP (−${fee_ep} fee = ${net_ep} EP net)`,
    p_payment_id: paymentId,
    p_product_id: null,
  });

  if (error) throw new Error(`EP deposit failed: ${error.message}`);

  return { gross_ep, fee_ep, net_ep };
}

// ── Redeem / spend EP ─────────────────────────────────────────────────────────
/**
 * Spend EP on a boost or redemption item.
 * @param {string} userId
 * @param {number} amount   - EP to spend
 * @param {string} reason   - what they're spending on
 * @returns {{ new_balance: number }}
 */
export async function spendEP(userId, amount, reason) {
  if (!userId) throw new Error("userId required");
  if (amount <= 0) throw new Error("Amount must be positive");

  // Check balance
  const balance = await getEPBalance(userId);
  if (balance < amount) throw new Error(`Insufficient EP. You have ${balance} EP, need ${amount} EP.`);

  // Deduct (negative amount via direct update since RPC only adds)
  const { error: updateErr } = await supabase
    .from("profiles")
    .update({ engagement_points: balance - amount, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (updateErr) throw new Error(`EP spend failed: ${updateErr.message}`);

  // Write spend transaction
  await supabase.from("ep_transactions").insert({
    user_id:       userId,
    amount:        -amount,
    balance_after: balance - amount,
    type:          "spend",
    reason,
    metadata:      { spent: amount, balance_before: balance },
  }).catch(() => {});

  // Update wallet
  await supabase
    .from("wallets")
    .update({ engagement_points: Math.max(0, balance - amount) })
    .eq("user_id", userId)
    .catch(() => {});

  return { new_balance: balance - amount };
}

// ── Tip creator ───────────────────────────────────────────────────────────────
/**
 * Send an EP tip from one user to a creator.
 * 84% to creator, 2% protocol fee, 14% to liquidity pool.
 * @param {string} senderId
 * @param {string} creatorId
 * @param {number} amount   - EP to send
 * @returns {{ sent, creator_receives, fee, reason }}
 */
export async function tipCreator(senderId, creatorId, amount) {
  if (!senderId || !creatorId) throw new Error("Sender and creator IDs required");
  if (senderId === creatorId) throw new Error("Cannot tip yourself");
  if (amount < 1) throw new Error("Minimum tip is 1 EP");

  const fee_ep      = Math.round(amount * PROTOCOL_FEE);
  const creator_ep  = Math.round(amount * CREATOR_SHARE);
  // 14% goes to liquidity pool (not distributed)

  // Deduct from sender
  await spendEP(senderId, amount, `Tip to creator — ${amount} EP`);

  // Credit creator
  const { error } = await supabase.rpc("increment_engagement_points", {
    p_user_id:    creatorId,
    p_amount:     creator_ep,
    p_reason:     `Creator tip received — ${creator_ep} EP (after 2% fee)`,
    p_payment_id: null,
    p_product_id: null,
  });

  if (error) {
    const { data: p } = await supabase.from("profiles").select("engagement_points").eq("id", creatorId).single();
    if (p) await supabase.from("profiles").update({ engagement_points: (Number(p.engagement_points) || 0) + creator_ep }).eq("id", creatorId);
  }

  return { sent: amount, creator_receives: creator_ep, fee: fee_ep };
}

// ── EP Leaderboard ────────────────────────────────────────────────────────────
/**
 * Get top EP earners.
 * @param {number} limit
 * @returns {Array}
 */
export async function getEPLeaderboard(limit = 10) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, username, avatar_id, engagement_points, subscription_tier")
    .eq("account_activated", true)
    .is("deleted_at", null)
    .order("engagement_points", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Leaderboard fetch failed: ${error.message}`);
  return data ?? [];
}

// ── EP Transaction history ────────────────────────────────────────────────────
/**
 * Get EP transaction history for a user.
 * @param {string} userId
 * @param {{ limit, offset }} options
 * @returns {Array}
 */
export async function getEPHistory(userId, { limit = 20, offset = 0 } = {}) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from("ep_transactions")
    .select("id, amount, balance_after, type, reason, created_at, metadata")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`EP history fetch failed: ${error.message}`);
  return data ?? [];
}

// ── Realtime EP subscription ──────────────────────────────────────────────────
/**
 * Subscribe to EP balance changes for a user.
 * @param {string}   userId
 * @param {Function} onUpdate - callback({ new_balance })
 * @returns Supabase channel
 */
export function subscribeToEPBalance(userId, onUpdate) {
  return supabase
    .channel(`ep-balance-${userId}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
      (payload) => {
        if (payload.new?.engagement_points !== undefined) {
          onUpdate({ new_balance: Number(payload.new.engagement_points) });
        }
      }
    )
    .subscribe();
}

// ── Helper: get this week's Monday ───────────────────────────────────────────
function getMonday() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default {
  EP_PER_USD,
  PROTOCOL_FEE,
  CREATOR_SHARE,
  DAILY_TASKS_CONFIG,
  WEEKLY_BONUS_EP,
  getEPBalance,
  getRewardsProfile,
  getTodayTaskState,
  claimDailyTask,
  claimWeeklyBonus,
  depositEP,
  spendEP,
  tipCreator,
  getEPLeaderboard,
  getEPHistory,
  subscribeToEPBalance,
};