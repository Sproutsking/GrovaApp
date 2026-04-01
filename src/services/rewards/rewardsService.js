// src/services/rewards/rewardsService.js — v4 SMART_REV_SHARE
// ============================================================================
// REWARD MODEL — "The Water Model"
//
// Every user has a weekly ENGAGEMENT SCORE computed from their activity:
//   score = Σ(task_weight × daily_completions_this_week)
//
// Task Weights:
//   login       = 5  pts per login day (max 7/week)
//   post_create = 15 pts per post (max 10/week)
//   reel_create = 25 pts per reel (max 5/week)
//   engage_5    = 8  pts per engage batch (max 7/week)
//
// Level Thresholds (weekly score):
//   Silver:   score ≥ 40
//   Gold:     score ≥ 100
//   Diamond:  score ≥ 200
//
// Revenue Pool Allocations (% of total weekly platform revenue):
//   Bronze (no level): 0%
//   Silver:  15%
//   Gold:    30%
//   Diamond: 55%
//
// Within each pool:
//   user_share = user_score / sum_of_all_user_scores_in_level
//   user_EP    = pool_EP × user_share
//
// This is the "water model": revenue pours into each level's container,
// then distributes proportionally. No fixed per-user amounts. Every EP
// distributed is backed by real platform income (no free minting).
//
// The reward_pools table must store: total_revenue, {level}_share (EP),
// {level}_users, {level}_total_score (sum of scores), distributed flag.
//
// Supabase RPC get_user_level_progress returns:
//   current_level, weekly_score, login_days_7, posts_week,
//   reels_week, engagements_week, account_age_days,
//   active_days_30, followers, tasks_14
// ============================================================================

import { supabase } from '../config/supabase';

// ── Core constants ────────────────────────────────────────────────────────────
export const EP_PER_USD      = 100;   // $1 = 100 EP
export const PROTOCOL_FEE    = 0.02;  // 2% on all EP transactions
export const CREATOR_SHARE   = 0.84;  // 84% of tips go to creator
export const XEV_CONVERT_PCT = 0.40;  // 40% of monthly EP auto-converts to $XEV
export const WEEKLY_BONUS_EP = 10;    // Weekly quality bonus

// ── Score system ──────────────────────────────────────────────────────────────
// Points earned per action (used to compute weekly engagement score)
export const TASK_WEIGHTS = {
  login:       5,   // per login day (≤7/week)
  post_create: 15,  // per post published (≤10/week)
  reel_create: 25,  // per reel uploaded (≤5/week)
  engage_5:    8,   // per engage-5 batch (≤7/week)
};

// Weekly caps per task for score calculation
export const TASK_WEEKLY_CAPS = {
  login:       7,
  post_create: 10,
  reel_create: 5,
  engage_5:    7,
};

// Minimum weekly engagement score to qualify for each level
export const LEVEL_SCORE_THRESHOLDS = {
  silver:  40,
  gold:    100,
  diamond: 200,
};

// Pool allocation: what % of total weekly revenue goes to each level
// All three must sum to 100
export const LEVEL_POOL_ALLOCATIONS = {
  silver:  15,
  gold:    30,
  diamond: 55,
};

// ── Daily task config (for UI + service) ─────────────────────────────────────
// giveEP: true means direct EP is minted (only login, 1 EP micro-reward)
// giveEP: false means tracked for score only
export const DAILY_TASKS_CONFIG = [
  { id: "login",       ep: 1, cap: 1, label: "Daily Login",    type: "invite_grant", giveEP: true  },
  { id: "post_create", ep: 0, cap: 5, label: "Publish a Post", type: "bonus_grant",  giveEP: false },
  { id: "reel_create", ep: 0, cap: 3, label: "Upload a Reel",  type: "bonus_grant",  giveEP: false },
  { id: "engage_5",    ep: 0, cap: 1, label: "Engage 5 Posts", type: "bonus_grant",  giveEP: false },
];

// ── Score computation helper ──────────────────────────────────────────────────
/**
 * Compute a user's weekly engagement score from task completion counts.
 * Called client-side when RPC isn't available / for display.
 * @param {Record<string, number>} weeklyCounts  - { task_id: total_completions_this_week }
 * @returns {number} total engagement score
 */
export function computeWeeklyScore(weeklyCounts = {}) {
  return Object.entries(TASK_WEIGHTS).reduce((total, [taskId, weight]) => {
    const cap    = TASK_WEEKLY_CAPS[taskId] ?? Infinity;
    const count  = Math.min(weeklyCounts[taskId] ?? 0, cap);
    return total + weight * count;
  }, 0);
}

/**
 * Determine level from weekly score.
 * @param {number} score
 * @returns {"none"|"silver"|"gold"|"diamond"}
 */
export function scoreTolevel(score) {
  if (score >= LEVEL_SCORE_THRESHOLDS.diamond) return "diamond";
  if (score >= LEVEL_SCORE_THRESHOLDS.gold)    return "gold";
  if (score >= LEVEL_SCORE_THRESHOLDS.silver)  return "silver";
  return "none";
}

/**
 * Compute a user's proportional EP share in their level's pool.
 * @param {number} userScore         - the user's score
 * @param {number} levelTotalScore   - sum of all scores in the level
 * @param {number} levelPoolEP       - total EP in the level's pool this week
 * @returns {number} EP the user earns
 */
export function computeUserPoolShare(userScore, levelTotalScore, levelPoolEP) {
  if (!userScore || !levelTotalScore || !levelPoolEP) return 0;
  return Math.floor(levelPoolEP * (userScore / levelTotalScore));
}

// ── Get EP balance ────────────────────────────────────────────────────────────
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
export async function getRewardsProfile(userId) {
  if (!userId) throw new Error("userId required");

  const [profileRes, dashboardRes, transactionsRes] = await Promise.allSettled([
    supabase.from("profiles").select("engagement_points, subscription_tier, payment_status").eq("id", userId).single(),
    supabase.from("ep_dashboard").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("ep_transactions").select("id, amount, balance_after, type, reason, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
  ]);

  const profile      = profileRes.status      === "fulfilled" ? profileRes.value.data      : null;
  const dashboard    = dashboardRes.status    === "fulfilled" ? dashboardRes.value.data    : null;
  const transactions = transactionsRes.status === "fulfilled" ? (transactionsRes.value.data ?? []) : [];

  return {
    balance:          Number(profile?.engagement_points ?? 0),
    dailyEP:          Number(dashboard?.daily_ep ?? 0),
    weeklyEP:         Number(dashboard?.weekly_ep ?? 0),
    monthlyEP:        Number(dashboard?.monthly_ep ?? 0),
    totalEarned:      Number(dashboard?.total_ep_earned ?? profile?.engagement_points ?? 0),
    transactions,
    subscriptionTier: profile?.subscription_tier ?? "free",
    paymentStatus:    profile?.payment_status ?? "pending",
  };
}

// ── Get today's task completion state ─────────────────────────────────────────
export async function getTodayTaskState(userId) {
  if (!userId) return { claimed: new Set(), counts: {} };

  const today = new Date().toISOString().split("T")[0];
  const { data, error } = await supabase
    .from("daily_task_completions")
    .select("task_id, count")
    .eq("user_id", userId)
    .eq("completed_at", today);

  if (error) {
    console.warn("[rewardsService] getTodayTaskState:", error.message);
    return { claimed: new Set(), counts: {} };
  }

  const counts  = {};
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

// ── Get this week's task counts (for score computation) ───────────────────────
/**
 * Returns total completions per task for the current ISO week (Mon–Sun).
 * Used to compute the user's live weekly score when RPC is unavailable.
 */
export async function getWeeklyTaskCounts(userId) {
  if (!userId) return {};
  const monday = getMonday().toISOString().split("T")[0];
  const { data } = await supabase
    .from("daily_task_completions")
    .select("task_id, count")
    .eq("user_id", userId)
    .gte("completed_at", monday);

  if (!data) return {};

  return data.reduce((acc, row) => {
    acc[row.task_id] = (acc[row.task_id] || 0) + row.count;
    return acc;
  }, {});
}

// ── Claim daily task ──────────────────────────────────────────────────────────
export async function claimDailyTask(userId, taskId) {
  if (!userId || !taskId) throw new Error("userId and taskId required");

  const task = DAILY_TASKS_CONFIG.find(t => t.id === taskId);
  if (!task) throw new Error(`Unknown task: ${taskId}`);

  const today = new Date().toISOString().split("T")[0];

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

  if (existing) {
    await supabase.from("daily_task_completions").update({ count: newCount }).eq("id", existing.id);
  } else {
    await supabase.from("daily_task_completions").insert({ user_id: userId, task_id: taskId, completed_at: today, count: 1 });
  }

  // Only grant EP for tasks that directly mint (only login = 1 EP)
  if (task.giveEP && task.ep > 0) {
    const { error: epErr } = await supabase.rpc("increment_engagement_points", {
      p_user_id:    userId,
      p_amount:     task.ep,
      p_reason:     `Daily task: ${task.label} (${newCount}/${task.cap})`,
      p_payment_id: null,
      p_product_id: null,
    });

    if (epErr) {
      const { data: p } = await supabase.from("profiles").select("engagement_points").eq("id", userId).single();
      if (p) await supabase.from("profiles").update({ engagement_points: (Number(p.engagement_points) || 0) + task.ep }).eq("id", userId);
    }

    return { ep_granted: task.ep, new_count: newCount, capped: newCount >= task.cap };
  }

  // Non-EP task: just track completion (contributes to score via RPC)
  return { ep_granted: 0, new_count: newCount, capped: newCount >= task.cap };
}

// ── Claim weekly bonus ────────────────────────────────────────────────────────
export async function claimWeeklyBonus(userId) {
  if (!userId) throw new Error("userId required");

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: posts } = await supabase.from("posts").select("id, likes, comments_count")
    .eq("user_id", userId).gte("created_at", weekAgo).is("deleted_at", null);

  const qualified = (posts ?? []).some(p => (p.likes || 0) + (p.comments_count || 0) >= 2);
  if (!qualified) throw new Error("Not qualified yet. Post this week and earn ≥2 real engagements.");

  const monday = getMonday();
  const { data: existing } = await supabase.from("ep_transactions").select("id")
    .eq("user_id", userId).eq("type", "bonus_grant")
    .ilike("reason", "%Weekly quality bonus%")
    .gte("created_at", monday.toISOString()).maybeSingle();

  if (existing) throw new Error("Weekly bonus already claimed this week.");

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

// ── Distribute weekly revenue share ──────────────────────────────────────────
/**
 * Called by a weekly cron/edge function (NOT client-side) to distribute
 * revenue pool EP to all qualified users.
 *
 * Algorithm:
 *   1. Fetch current week's reward_pools row.
 *   2. For each level, fetch all users whose weekly_score >= threshold.
 *   3. Compute total_score = sum of all user scores in level.
 *   4. For each user: ep = floor(pool_ep × user_score / total_score).
 *   5. Credit each user via increment_engagement_points.
 *   6. Mark pool as distributed.
 *
 * This function requires service_role / admin context.
 * @param {string} weekStart - ISO date string "YYYY-MM-DD"
 */
export async function distributeWeeklyRevenue(weekStart) {
  const { data: pool, error: poolErr } = await supabase.from("reward_pools")
    .select("*").eq("week_start", weekStart).single();

  if (poolErr || !pool) throw new Error(`No pool found for week ${weekStart}`);
  if (pool.distributed) throw new Error("Already distributed");

  const levels = ["silver", "gold", "diamond"];
  const results = {};

  for (const level of levels) {
    const poolEP     = pool[`${level}_share`] || 0;
    const threshold  = LEVEL_SCORE_THRESHOLDS[level];
    const nextThresh = level === "diamond" ? Infinity : LEVEL_SCORE_THRESHOLDS[levels[levels.indexOf(level) + 1]];

    // Fetch users at this exact level
    const { data: levelUsers } = await supabase.rpc("get_users_at_level", {
      p_week_start:   weekStart,
      p_score_min:    threshold,
      p_score_max:    nextThresh === Infinity ? 999999 : nextThresh - 1,
    });

    if (!levelUsers?.length) {
      results[level] = { users: 0, distributed: 0 };
      continue;
    }

    const totalScore = levelUsers.reduce((s, u) => s + (u.weekly_score || 0), 0);
    let   distributed = 0;

    for (const user of levelUsers) {
      const userEP = Math.floor(poolEP * (user.weekly_score / totalScore));
      if (userEP <= 0) continue;

      await supabase.rpc("increment_engagement_points", {
        p_user_id:    user.user_id,
        p_amount:     userEP,
        p_reason:     `Weekly revenue share — ${level} level (score: ${user.weekly_score}/${totalScore})`,
        p_payment_id: null,
        p_product_id: null,
      }).catch(err => console.warn(`[distribute] user ${user.user_id}:`, err));

      distributed += userEP;
    }

    // Update pool record with actual totals
    await supabase.from("reward_pools").update({
      [`${level}_users`]:       levelUsers.length,
      [`${level}_total_score`]: totalScore,
    }).eq("week_start", weekStart);

    results[level] = { users: levelUsers.length, totalScore, distributed };
  }

  // Mark pool as distributed
  await supabase.from("reward_pools").update({
    distributed:     true,
    distributed_at:  new Date().toISOString(),
  }).eq("week_start", weekStart);

  return results;
}

// ── Deposit EP ────────────────────────────────────────────────────────────────
export async function depositEP(userId, amountUSD, paymentId = null) {
  if (!userId)               throw new Error("userId required");
  if (!amountUSD || amountUSD < 1) throw new Error("Minimum deposit is $1");

  const gross_ep = Math.floor(amountUSD * EP_PER_USD);
  const fee_ep   = Math.round(gross_ep * PROTOCOL_FEE);
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

// ── Spend EP ──────────────────────────────────────────────────────────────────
export async function spendEP(userId, amount, reason) {
  if (!userId)    throw new Error("userId required");
  if (amount <= 0) throw new Error("Amount must be positive");

  const balance = await getEPBalance(userId);
  if (balance < amount) throw new Error(`Insufficient EP. You have ${balance} EP, need ${amount} EP.`);

  const { error: updateErr } = await supabase.from("profiles")
    .update({ engagement_points: balance - amount, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (updateErr) throw new Error(`EP spend failed: ${updateErr.message}`);

  await supabase.from("ep_transactions").insert({
    user_id:       userId,
    amount:        -amount,
    balance_after: balance - amount,
    type:          "spend",
    reason,
    metadata:      { spent: amount, balance_before: balance },
  }).catch(() => {});

  await supabase.from("wallets")
    .update({ engagement_points: Math.max(0, balance - amount) })
    .eq("user_id", userId)
    .catch(() => {});

  return { new_balance: balance - amount };
}

// ── Tip creator ───────────────────────────────────────────────────────────────
export async function tipCreator(senderId, creatorId, amount) {
  if (!senderId || !creatorId) throw new Error("Sender and creator IDs required");
  if (senderId === creatorId)  throw new Error("Cannot tip yourself");
  if (amount < 1)              throw new Error("Minimum tip is 1 EP");

  const fee_ep     = Math.round(amount * PROTOCOL_FEE);
  const creator_ep = Math.round(amount * CREATOR_SHARE);

  await spendEP(senderId, amount, `Tip to creator — ${amount} EP`);

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
export async function getEPLeaderboard(limit = 10) {
  const { data, error } = await supabase.from("profiles")
    .select("id, full_name, username, avatar_id, engagement_points, subscription_tier")
    .eq("account_activated", true).is("deleted_at", null)
    .order("engagement_points", { ascending: false }).limit(limit);
  if (error) throw new Error(`Leaderboard fetch failed: ${error.message}`);
  return data ?? [];
}

// ── EP Transaction history ────────────────────────────────────────────────────
export async function getEPHistory(userId, { limit = 20, offset = 0 } = {}) {
  if (!userId) return [];
  const { data, error } = await supabase.from("ep_transactions")
    .select("id, amount, balance_after, type, reason, created_at, metadata")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw new Error(`EP history fetch failed: ${error.message}`);
  return data ?? [];
}

// ── Realtime EP subscription ──────────────────────────────────────────────────
export function subscribeToEPBalance(userId, onUpdate) {
  return supabase
    .channel(`ep-balance-${userId}`)
    .on("postgres_changes",
      { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
      (payload) => {
        if (payload.new?.engagement_points !== undefined) {
          onUpdate({ new_balance: Number(payload.new.engagement_points) });
        }
      })
    .subscribe();
}

// ── Helper: get this week's Monday ───────────────────────────────────────────
function getMonday() {
  const d   = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default {
  EP_PER_USD, PROTOCOL_FEE, CREATOR_SHARE, WEEKLY_BONUS_EP,
  TASK_WEIGHTS, TASK_WEEKLY_CAPS, LEVEL_SCORE_THRESHOLDS, LEVEL_POOL_ALLOCATIONS,
  DAILY_TASKS_CONFIG,
  computeWeeklyScore, scoreTolevel, computeUserPoolShare,
  getEPBalance, getRewardsProfile, getTodayTaskState,
  getWeeklyTaskCounts,
  claimDailyTask, claimWeeklyBonus,
  distributeWeeklyRevenue,
  depositEP, spendEP, tipCreator,
  getEPLeaderboard, getEPHistory,
  subscribeToEPBalance,
};