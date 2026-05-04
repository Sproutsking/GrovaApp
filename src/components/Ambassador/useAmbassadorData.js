// ============================================================================
// src/components/Ambassador/useAmbassadorData.js
// AMBASSADOR PROGRAM — FULL DATA LAYER
// Zero mock data. All real Supabase queries.
//
// LEVEL SYSTEM:
//   Level 1 (Scout)    — 0–99   monthly referrals  → 8%  commission
//   Level 2 (Envoy)    — 100–199 monthly referrals → 10% commission
//   Level 3 (Nexus)    — 200–299 monthly referrals → 12% commission
//   Level 4 (Vanguard) — 300–999 monthly referrals → 15% commission
//   Level 5 (Legend)   — 1000+   monthly referrals → 20% commission
//
// LEVEL LOGIC:
//   - Levels are computed from the PREVIOUS calendar month's referral count.
//   - On the 1st of each month, a cron/edge function (or lazy-eval on load)
//     sets ambassador.current_level based on prev_month_referrals.
//   - If a user drops below a tier's threshold, they LOSE the level.
//   - current_level is stored in ambassador_profiles for fast reads.
// ============================================================================

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../../services/config/supabase";

// ─── Level Config ──────────────────────────────────────────────────────────
export const AMBASSADOR_LEVELS = [
  {
    level: 1,
    name: "Scout",
    icon: "🌱",
    minMonthly: 0,
    maxMonthly: 99,
    commissionPct: 8,
    color: "#6ee7b7",
    gradFrom: "#064e3b",
    gradTo: "#065f46",
    badgeBg: "rgba(110,231,183,0.12)",
    badgeBorder: "rgba(110,231,183,0.3)",
  },
  {
    level: 2,
    name: "Envoy",
    icon: "⚡",
    minMonthly: 100,
    maxMonthly: 199,
    commissionPct: 10,
    color: "#60a5fa",
    gradFrom: "#1e3a5f",
    gradTo: "#1e40af",
    badgeBg: "rgba(96,165,250,0.12)",
    badgeBorder: "rgba(96,165,250,0.3)",
  },
  {
    level: 3,
    name: "Nexus",
    icon: "🔥",
    minMonthly: 200,
    maxMonthly: 299,
    commissionPct: 12,
    color: "#f59e0b",
    gradFrom: "#451a03",
    gradTo: "#78350f",
    badgeBg: "rgba(245,158,11,0.12)",
    badgeBorder: "rgba(245,158,11,0.3)",
  },
  {
    level: 4,
    name: "Vanguard",
    icon: "💎",
    minMonthly: 300,
    maxMonthly: 999,
    commissionPct: 15,
    color: "#a78bfa",
    gradFrom: "#2e1065",
    gradTo: "#4c1d95",
    badgeBg: "rgba(167,139,250,0.12)",
    badgeBorder: "rgba(167,139,250,0.3)",
  },
  {
    level: 5,
    name: "Legend",
    icon: "👑",
    minMonthly: 1000,
    maxMonthly: Infinity,
    commissionPct: 20,
    color: "#fbbf24",
    gradFrom: "#451a03",
    gradTo: "#92400e",
    badgeBg: "rgba(251,191,36,0.15)",
    badgeBorder: "rgba(251,191,36,0.4)",
  },
];

export function getLevelConfig(level) {
  return AMBASSADOR_LEVELS.find((l) => l.level === level) || AMBASSADOR_LEVELS[0];
}

export function getLevelFromMonthlyReferrals(count) {
  for (let i = AMBASSADOR_LEVELS.length - 1; i >= 0; i--) {
    if (count >= AMBASSADOR_LEVELS[i].minMonthly) return AMBASSADOR_LEVELS[i].level;
  }
  return 1;
}

// ─── sb() helper ──────────────────────────────────────────────────────────
function sb() {
  return supabase;
}

// ─── useAmbassadorProfile ─────────────────────────────────────────────────
// For the USER view — fetch or create their ambassador profile
export function useAmbassadorProfile(userId) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      // Fetch ambassador profile joined with invite_codes
      const { data: amb, error: ambErr } = await sb()
        .from("ambassador_profiles")
        .select(`
          *,
          invite:invite_code_id (
            id, code, uses_count, max_uses, status, metadata,
            price_override, entry_price
          )
        `)
        .eq("user_id", userId)
        .maybeSingle();

      if (ambErr) throw ambErr;

      if (!amb) {
        setProfile(null);
        setLoading(false);
        return;
      }

      // Compute level from prev month referrals stored in profile
      const computedLevel = getLevelFromMonthlyReferrals(
        amb.prev_month_referrals || 0
      );

      // Check if level needs updating (happens lazily on load)
      if (computedLevel !== amb.current_level) {
        await sb()
          .from("ambassador_profiles")
          .update({
            current_level: computedLevel,
            commission_pct: AMBASSADOR_LEVELS[computedLevel - 1].commissionPct,
            updated_at: new Date().toISOString(),
          })
          .eq("id", amb.id);
        amb.current_level = computedLevel;
        amb.commission_pct = AMBASSADOR_LEVELS[computedLevel - 1].commissionPct;
      }

      // Fetch earnings summary
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { data: earnings } = await sb()
        .from("ambassador_earnings")
        .select("amount, created_at, status")
        .eq("ambassador_id", amb.id);

      const totalEarned = (earnings || [])
        .filter((e) => e.status !== "cancelled")
        .reduce((s, e) => s + Number(e.amount), 0);

      const thisMonthEarned = (earnings || [])
        .filter(
          (e) => e.status !== "cancelled" && e.created_at >= monthStart
        )
        .reduce((s, e) => s + Number(e.amount), 0);

      const pendingPayout = (earnings || [])
        .filter((e) => e.status === "pending")
        .reduce((s, e) => s + Number(e.amount), 0);

      // This month's referral count
      const { count: thisMonthRefs } = await sb()
        .from("ambassador_referrals")
        .select("*", { count: "exact", head: true })
        .eq("ambassador_id", amb.id)
        .gte("created_at", monthStart);

      setProfile({
        ...amb,
        totalEarned,
        thisMonthEarned,
        pendingPayout,
        thisMonthRefs: thisMonthRefs || 0,
        levelConfig: getLevelConfig(amb.current_level),
      });
    } catch (e) {
      console.error("useAmbassadorProfile:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  return { profile, loading, error, reload: load };
}

// ─── useJoinAmbassadorProgram ─────────────────────────────────────────────
export function useJoinAmbassadorProgram() {
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState(null);

  const join = async (userId, userProfile) => {
    setJoining(true);
    setError(null);
    try {
      // Generate unique ambassador code: AMB + username snippet + random
      const base = (userProfile?.username || "amb")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 6);
      const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
      const code = `${base}${suffix}`;

      const now = new Date().toISOString();

      // Create invite_code for this ambassador
      const { data: invite, error: invErr } = await sb()
        .from("invite_codes")
        .insert({
          code,
          type: "standard",
          max_uses: null, // unlimited
          uses_count: 0,
          status: "active",
          entry_price: 1.0,
          price_override: 1.0,
          metadata: {
            ambassador_code: true,
            ambassador_user_id: userId,
            admin_created: false,
            invite_name: `${userProfile?.full_name || "Ambassador"}'s Link`,
            invite_category: "ambassador",
          },
          created_by: userId,
          created_by_name: userProfile?.full_name || "Ambassador",
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (invErr) throw invErr;

      // Create ambassador profile
      const { data: amb, error: ambErr } = await sb()
        .from("ambassador_profiles")
        .insert({
          user_id: userId,
          invite_code_id: invite.id,
          invite_code: code,
          current_level: 1,
          commission_pct: 8,
          total_referrals: 0,
          prev_month_referrals: 0,
          this_month_referrals: 0,
          status: "active",
          joined_at: now,
          created_at: now,
          updated_at: now,
          payout_info: {},
          lifetime_earned: 0,
        })
        .select()
        .single();

      if (ambErr) throw ambErr;

      return { ambassador: amb, invite };
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setJoining(false);
    }
  };

  return { join, joining, error };
}

// ─── useAmbassadorReferrals ───────────────────────────────────────────────
export function useAmbassadorReferrals(ambassadorId, pageSize = 20) {
  const [referrals, setReferrals] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!ambassadorId) return;
    setLoading(true);
    try {
      const from = page * pageSize;
      const { data, count, error } = await sb()
        .from("ambassador_referrals")
        .select(
          `id, created_at, revenue_amount, commission_amount, status,
           referred_user:referred_user_id(id, full_name, username, created_at)`,
          { count: "exact" }
        )
        .eq("ambassador_id", ambassadorId)
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);

      if (error) throw error;
      setReferrals(data || []);
      setTotal(count || 0);
    } catch (e) {
      console.error("useAmbassadorReferrals:", e);
    } finally {
      setLoading(false);
    }
  }, [ambassadorId, page, pageSize]);

  useEffect(() => { load(); }, [load]);

  return { referrals, total, page, setPage, loading, reload: load };
}

// ─── useAmbassadorEarnings ────────────────────────────────────────────────
export function useAmbassadorEarnings(ambassadorId) {
  const [earnings, setEarnings] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!ambassadorId) return;
    setLoading(true);
    try {
      const sixMonthsAgo = new Date(Date.now() - 180 * 86400000).toISOString();

      const { data, error } = await sb()
        .from("ambassador_earnings")
        .select("id, amount, status, created_at, ref_referral_id, payout_at")
        .eq("ambassador_id", ambassadorId)
        .gte("created_at", sixMonthsAgo)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEarnings(data || []);

      // Build chart: last 8 weeks grouped
      const weeks = {};
      for (let i = 7; i >= 0; i--) {
        const d = new Date(Date.now() - i * 7 * 86400000);
        const key = `W${8 - i}`;
        weeks[key] = { label: key, amount: 0, referrals: 0 };
      }
      (data || []).forEach((e) => {
        const age = Math.floor(
          (Date.now() - new Date(e.created_at)) / (7 * 86400000)
        );
        if (age <= 7) {
          const key = `W${8 - age}`;
          if (weeks[key]) {
            weeks[key].amount += Number(e.amount);
            weeks[key].referrals += 1;
          }
        }
      });
      setChartData(Object.values(weeks));
    } catch (e) {
      console.error("useAmbassadorEarnings:", e);
    } finally {
      setLoading(false);
    }
  }, [ambassadorId]);

  useEffect(() => { load(); }, [load]);
  return { earnings, chartData, loading, reload: load };
}

// ─── usePayoutRequest ─────────────────────────────────────────────────────
export function usePayoutRequest() {
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState(null);

  const request = async (ambassadorId, amount, payoutInfo) => {
    setRequesting(true);
    setError(null);
    try {
      const { error: e } = await sb()
        .from("ambassador_payouts")
        .insert({
          ambassador_id: ambassadorId,
          amount,
          status: "pending",
          payout_info: payoutInfo,
          requested_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        });
      if (e) throw e;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setRequesting(false);
    }
  };

  return { request, requesting, error };
}

// ─── ADMIN: useAdminAmbassadors ───────────────────────────────────────────
export function useAdminAmbassadors(pageSize = 20) {
  const [ambassadors, setAmbassadors] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterLevel, setFilterLevel] = useState("all");
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const from = page * pageSize;
      let query = sb()
        .from("ambassador_profiles")
        .select(
          `*,
           user:user_id(id, full_name, username, email, avatar_id, last_seen, account_status),
           invite:invite_code_id(id, code, uses_count, status)`,
          { count: "exact" }
        )
        .order("lifetime_earned", { ascending: false })
        .range(from, from + pageSize - 1);

      if (filterLevel !== "all") query = query.eq("current_level", Number(filterLevel));
      if (search) {
        // We'll filter client-side after fetch for simplicity
      }

      const { data, count, error } = await query;
      if (error) throw error;

      let enriched = (data || []).map((a) => ({
        ...a,
        levelConfig: getLevelConfig(a.current_level),
      }));

      if (search) {
        const s = search.toLowerCase();
        enriched = enriched.filter(
          (a) =>
            (a.user?.full_name || "").toLowerCase().includes(s) ||
            (a.user?.email || "").toLowerCase().includes(s) ||
            (a.user?.username || "").toLowerCase().includes(s) ||
            (a.invite_code || "").toLowerCase().includes(s)
        );
      }

      setAmbassadors(enriched);
      setTotal(count || 0);
    } catch (e) {
      console.error("useAdminAmbassadors:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filterLevel, search]);

  useEffect(() => { load(); }, [load]);

  // ── Admin: Suspend ambassador ────────────────────────────────────────────
  const suspendAmbassador = async (id, reason) => {
    const { error } = await sb()
      .from("ambassador_profiles")
      .update({ status: "suspended", suspend_reason: reason, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    await load();
  };

  // ── Admin: Restore ambassador ────────────────────────────────────────────
  const restoreAmbassador = async (id) => {
    const { error } = await sb()
      .from("ambassador_profiles")
      .update({ status: "active", suspend_reason: null, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    await load();
  };

  // ── Admin: Override level ────────────────────────────────────────────────
  const overrideLevel = async (id, level) => {
    const cfg = getLevelConfig(level);
    const { error } = await sb()
      .from("ambassador_profiles")
      .update({
        current_level: level,
        commission_pct: cfg.commissionPct,
        level_override: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;
    await load();
  };

  // ── Admin: Process payout ────────────────────────────────────────────────
  const processPayout = async (payoutId, ambassadorId, amount) => {
    const { error: pe } = await sb()
      .from("ambassador_payouts")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", payoutId);
    if (pe) throw pe;

    // Mark earnings as paid
    await sb()
      .from("ambassador_earnings")
      .update({ status: "paid", payout_at: new Date().toISOString() })
      .eq("ambassador_id", ambassadorId)
      .eq("status", "pending");

    await load();
  };

  return {
    ambassadors,
    total,
    page,
    setPage,
    loading,
    error,
    search,
    setSearch,
    filterLevel,
    setFilterLevel,
    reload: load,
    suspendAmbassador,
    restoreAmbassador,
    overrideLevel,
    processPayout,
  };
}

// ─── ADMIN: useAdminAmbassadorStats ──────────────────────────────────────
export function useAdminAmbassadorStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [
        { count: totalAmbassadors },
        { count: activeAmbassadors },
        { count: thisMonthReferrals },
        { data: earningsData },
        { data: payoutsPending },
        levelCounts,
      ] = await Promise.all([
        sb().from("ambassador_profiles").select("*", { count: "exact", head: true }),
        sb()
          .from("ambassador_profiles")
          .select("*", { count: "exact", head: true })
          .eq("status", "active"),
        sb()
          .from("ambassador_referrals")
          .select("*", { count: "exact", head: true })
          .gte("created_at", monthStart),
        sb()
          .from("ambassador_earnings")
          .select("amount, status, created_at"),
        sb()
          .from("ambassador_payouts")
          .select("amount, status")
          .eq("status", "pending"),
        Promise.all(
          AMBASSADOR_LEVELS.map((l) =>
            sb()
              .from("ambassador_profiles")
              .select("*", { count: "exact", head: true })
              .eq("current_level", l.level)
              .then(({ count }) => ({ level: l.level, count: count || 0 }))
          )
        ),
      ]);

      const totalEarningsPaid = (earningsData || [])
        .filter((e) => e.status === "paid")
        .reduce((s, e) => s + Number(e.amount), 0);

      const totalEarningsPending = (earningsData || [])
        .filter((e) => e.status === "pending")
        .reduce((s, e) => s + Number(e.amount), 0);

      const pendingPayoutAmount = (payoutsPending || []).reduce(
        (s, e) => s + Number(e.amount),
        0
      );

      setStats({
        totalAmbassadors: totalAmbassadors || 0,
        activeAmbassadors: activeAmbassadors || 0,
        thisMonthReferrals: thisMonthReferrals || 0,
        totalEarningsPaid,
        totalEarningsPending,
        pendingPayoutAmount,
        pendingPayoutCount: (payoutsPending || []).length,
        levelBreakdown: levelCounts,
      });
    } catch (e) {
      console.error("useAdminAmbassadorStats:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  return { stats, loading, reload: load };
}

// ─── ADMIN: useAdminPayouts ───────────────────────────────────────────────
export function useAdminPayouts() {
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("pending");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let query = sb()
        .from("ambassador_payouts")
        .select(
          `*,
           ambassador:ambassador_id(
             id, invite_code, current_level, lifetime_earned,
             user:user_id(id, full_name, username, email)
           )`
        )
        .order("requested_at", { ascending: false })
        .limit(50);

      if (filter !== "all") query = query.eq("status", filter);

      const { data, error } = await query;
      if (error) throw error;
      setPayouts(data || []);
    } catch (e) {
      console.error("useAdminPayouts:", e);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const approvePayout = async (id, ambassadorId) => {
    const { error } = await sb()
      .from("ambassador_payouts")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;

    await sb()
      .from("ambassador_earnings")
      .update({ status: "paid", payout_at: new Date().toISOString() })
      .eq("ambassador_id", ambassadorId)
      .eq("status", "pending");

    await load();
  };

  const rejectPayout = async (id, reason) => {
    const { error } = await sb()
      .from("ambassador_payouts")
      .update({
        status: "rejected",
        reject_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;
    await load();
  };

  return { payouts, loading, filter, setFilter, reload: load, approvePayout, rejectPayout };
}

// ─── Helper: record a referral conversion (called from PaywallGate) ───────
// Call this when a payment is completed and user came via ambassador code.
export async function recordAmbassadorConversion({
  ambassadorId,
  referredUserId,
  paymentId,
  revenueAmountUsd,
}) {
  try {
    // Fetch current ambassador commission
    const { data: amb } = await sb()
      .from("ambassador_profiles")
      .select("id, commission_pct, current_level")
      .eq("id", ambassadorId)
      .single();

    if (!amb) return;

    const commissionPct = amb.commission_pct || 8;
    const commission = (revenueAmountUsd * commissionPct) / 100;
    const now = new Date().toISOString();

    // Insert referral record
    const { data: ref } = await sb()
      .from("ambassador_referrals")
      .insert({
        ambassador_id: ambassadorId,
        referred_user_id: referredUserId,
        payment_id: paymentId,
        revenue_amount: revenueAmountUsd,
        commission_amount: commission,
        commission_pct: commissionPct,
        status: "confirmed",
        created_at: now,
      })
      .select()
      .single();

    // Insert earnings record
    await sb().from("ambassador_earnings").insert({
      ambassador_id: ambassadorId,
      amount: commission,
      status: "pending",
      ref_referral_id: ref?.id,
      created_at: now,
    });

    // Update ambassador totals
    await sb().rpc("increment_ambassador_stats", {
      p_ambassador_id: ambassadorId,
      p_referrals: 1,
      p_lifetime_earned: commission,
    });
  } catch (e) {
    console.error("recordAmbassadorConversion:", e);
  }
}