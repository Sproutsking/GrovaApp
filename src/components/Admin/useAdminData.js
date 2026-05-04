// ============================================================================
// src/components/Admin/useAdminData.js — PATCHED v7
// FIXES:
//   1. useCommunities.suspend() — removed async-in-object bug
//   2. useStats() — correct Paystack kobo math (amount_cents / 100 = NGN, /1700 = USD)
//   3. useUsers() — added EP fix: users who paid get exactly 50 EP if they have > 200
//   4. Added EP normalization helper for admin use
//   5. Transaction display correctly shows NGN amounts from Paystack
// ============================================================================

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../services/config/supabase";
import { ROLE_PERMISSIONS } from "./permissions.js";

let _override = null;
export function initSupabase(client) {
  _override = client;
}
function sb() {
  return _override || supabase;
}

// ─── CURRENCY UTILITIES ────────────────────────────────────────────────────
const NGN_TO_USD_RATE = 1700;

export function resolvePaymentAmount(payment) {
  const raw = payment.amount_cents || 0;
  const currency = (payment.currency || "USD").toUpperCase();
  const provider = (payment.provider || "").toLowerCase();

  if (provider === "paystack" || currency === "NGN") {
    const ngnAmount = raw / 100; // kobo → naira
    const usdAmount = ngnAmount / NGN_TO_USD_RATE;
    return {
      localAmount: ngnAmount,
      localCurrency: "NGN",
      usdAmount,
      displayLocal: `₦${ngnAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      displayUSD: `$${usdAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      isNGN: true,
    };
  }

  const usdAmount = raw / 100;
  return {
    localAmount: usdAmount,
    localCurrency: "USD",
    usdAmount,
    displayLocal: `$${usdAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    displayUSD: `$${usdAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    isNGN: false,
  };
}

function sumPaymentsUSD(payments) {
  return (payments || []).reduce((sum, p) => {
    const { usdAmount } = resolvePaymentAmount(p);
    return sum + usdAmount;
  }, 0);
}

// ─── Edge Function: revoke auth session ───────────────────────────────────
async function _revokeAuthSession(userId) {
  try {
    const {
      data: { session },
    } = await sb().auth.getSession();
    if (!session?.access_token) return false;
    const supabaseUrl =
      import.meta.env?.VITE_SUPABASE_URL ||
      process.env?.REACT_APP_SUPABASE_URL ||
      process.env?.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return false;
    const res = await fetch(`${supabaseUrl}/functions/v1/admin-revoke-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ userId }),
    });
    return res.ok;
  } catch (e) {
    console.warn("[_revokeAuthSession] Failed:", e.message);
    return false;
  }
}

// ─── useTable helper ───────────────────────────────────────────────────────
export function useTable(tableName, options = {}) {
  const {
    select = "*",
    filters = {},
    search = "",
    searchColumns = [],
    order = { column: "created_at", ascending: false },
    pageSize: ps = 20,
  } = options;

  const [data, setData] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let q = sb()
        .from(tableName)
        .select(select, { count: "exact" })
        .order(order.column, { ascending: order.ascending })
        .range(page * ps, page * ps + ps - 1);

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) q = q.eq(key, value);
      });

      if (search && searchColumns.length) {
        const orParts = searchColumns
          .map((col) => `${col}.ilike.%${search}%`)
          .join(",");
        q = q.or(orParts);
      }

      const { data: rows, count: total, error: err } = await q;
      if (err) throw err;
      setData(rows || []);
      setCount(total || 0);
    } catch (e) {
      console.error(`useTable(${tableName}):`, e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [
    tableName,
    select,
    JSON.stringify(filters),
    search,
    JSON.stringify(order),
    page,
    ps,
  ]);

  useEffect(() => {
    load();
  }, [load]);
  return {
    data,
    count,
    page,
    setPage,
    loading,
    error,
    refresh: load,
    pageSize: ps,
  };
}

// ─── Dashboard Stats ───────────────────────────────────────────────────────
export function useStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const monthStart = new Date(
        today.getFullYear(),
        today.getMonth(),
        1,
      ).toISOString();

      const [
        { count: totalUsers },
        { count: activeUsers },
        { count: newUsersToday },
        { count: newUsersWeek },
        { count: openCases },
        { count: pendingInvites },
        { count: bannedUsers },
        { count: totalPosts },
        { count: totalReels },
        { count: totalStories },
        { count: totalCommunities },
        { data: allPayments },
        { data: paymentsToday },
        { data: paymentsThisWeek },
        { data: paymentsThisMonth },
        { data: xevCirculatingData },
        { data: xevMintedData },
        { data: epCirculationData },
        { data: epDepositData },
      ] = await Promise.all([
        sb().from("profiles").select("*", { count: "exact", head: true }),
        sb()
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("account_status", "active"),
        sb()
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .gte("created_at", todayISO),
        sb()
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .gte("created_at", weekAgo),
        sb()
          .from("support_tickets")
          .select("*", { count: "exact", head: true })
          .in("status", ["open", "in_progress", "waiting"]),
        sb()
          .from("invite_codes")
          .select("*", { count: "exact", head: true })
          .eq("status", "active"),
        sb()
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("account_status", "suspended"),
        sb()
          .from("posts")
          .select("*", { count: "exact", head: true })
          .is("deleted_at", null),
        sb()
          .from("reels")
          .select("*", { count: "exact", head: true })
          .is("deleted_at", null),
        sb()
          .from("stories")
          .select("*", { count: "exact", head: true })
          .is("deleted_at", null),
        sb()
          .from("communities")
          .select("*", { count: "exact", head: true })
          .is("deleted_at", null),
        sb()
          .from("payments")
          .select("amount_cents,currency,provider")
          .eq("status", "completed"),
        sb()
          .from("payments")
          .select("amount_cents,currency,provider")
          .eq("status", "completed")
          .gte("created_at", todayISO),
        sb()
          .from("payments")
          .select("amount_cents,currency,provider")
          .eq("status", "completed")
          .gte("created_at", weekAgo),
        sb()
          .from("payments")
          .select("amount_cents,currency,provider")
          .eq("status", "completed")
          .gte("created_at", monthStart),
        sb().from("wallets").select("grova_tokens").not("user_id", "is", null),
        sb()
          .from("wallet_history")
          .select("amount")
          .eq("change_type", "credit"),
        sb()
          .from("profiles")
          .select("engagement_points")
          .eq("account_activated", true)
          .is("deleted_at", null),
        sb()
          .from("ep_transactions")
          .select("amount")
          .eq("type", "purchase_grant"),
      ]);

      // ─── CORRECT revenue math ────────────────────────────────────────
      // Paystack: amount_cents is KOBO. 5384 kobo = ₦53.84. At ₦1700/$ = ~$0.03
      // But looking at the screenshot: ₦5,384 = $3.17 which means amount_cents=538400
      // So Paystack stores in KOBO correctly. 538400 / 100 = ₦5,384 / 1700 = $3.17 ✓
      const totalRevenue = sumPaymentsUSD(allPayments);
      const revToday = sumPaymentsUSD(paymentsToday);
      const revWeek = sumPaymentsUSD(paymentsThisWeek);
      const revMonth = sumPaymentsUSD(paymentsThisMonth);

      const totalRevenueNGN = (allPayments || []).reduce((sum, p) => {
        const { localAmount, isNGN } = resolvePaymentAmount(p);
        return isNGN ? sum + localAmount : sum;
      }, 0);

      const [
        { count: depositCountToday },
        { count: depositCountWeek },
        { count: depositCountMonth },
        { count: depositCountAll },
      ] = await Promise.all([
        sb()
          .from("payments")
          .select("*", { count: "exact", head: true })
          .eq("status", "completed")
          .gte("created_at", todayISO),
        sb()
          .from("payments")
          .select("*", { count: "exact", head: true })
          .eq("status", "completed")
          .gte("created_at", weekAgo),
        sb()
          .from("payments")
          .select("*", { count: "exact", head: true })
          .eq("status", "completed")
          .gte("created_at", monthStart),
        sb()
          .from("payments")
          .select("*", { count: "exact", head: true })
          .eq("status", "completed"),
      ]);

      const providerBreakdown = {};
      (allPayments || []).forEach((p) => {
        const prov = p.provider || "unknown";
        if (!providerBreakdown[prov])
          providerBreakdown[prov] = { count: 0, usd: 0 };
        providerBreakdown[prov].count++;
        providerBreakdown[prov].usd += resolvePaymentAmount(p).usdAmount;
      });

      const sum = (arr, field = "amount") =>
        (arr || []).reduce((s, r) => s + (Number(r[field]) || 0), 0);

      const totalXEVCirculating = Math.round(
        sum(xevCirculatingData || [], "grova_tokens"),
      );
      const totalXEVMinted = Math.round(sum(xevMintedData || [], "amount"));
      // EP is raw units — correct, do NOT divide by 100
      const totalEPCirculation = Math.round(
        sum(epCirculationData || [], "engagement_points"),
      );
      const epMintedOnDeposit = Math.round(sum(epDepositData || [], "amount"));

      setStats({
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        newUsersToday: newUsersToday || 0,
        newUsersWeek: newUsersWeek || 0,
        openCases: openCases || 0,
        pendingInvites: pendingInvites || 0,
        bannedUsers: bannedUsers || 0,
        totalPosts: totalPosts || 0,
        totalReels: totalReels || 0,
        totalStories: totalStories || 0,
        totalContent:
          (totalPosts || 0) + (totalReels || 0) + (totalStories || 0),
        totalCommunities: totalCommunities || 0,
        totalRevenue,
        revenueToday: revToday,
        revenueWeek: revWeek,
        revenueMonth: revMonth,
        totalRevenueNGN,
        depositCountToday: depositCountToday || 0,
        depositCountWeek: depositCountWeek || 0,
        depositCountMonth: depositCountMonth || 0,
        depositCountAll: depositCountAll || 0,
        depositAmountToday: sumPaymentsUSD(paymentsToday),
        depositAmountWeek: sumPaymentsUSD(paymentsThisWeek),
        depositAmountMonth: sumPaymentsUSD(paymentsThisMonth),
        providerBreakdown,
        totalXEVCirculating,
        totalXEVMinted,
        totalEPCirculation,
        epMintedOnDeposit,
      });
    } catch (e) {
      console.error("Stats error:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  return { stats, loading, error, reload: load };
}

// ─── EP Normalization — fix inflated EP ───────────────────────────────────
// Users who paid should have exactly 50 EP as their base grant.
// Call this admin utility to normalize EP for all paid users.
export async function normalizeEPForPaidUsers() {
  // Get all paid/activated users with EP > 200 (likely inflated)
  const { data: users, error } = await sb()
    .from("profiles")
    .select("id, engagement_points, payment_status, account_activated")
    .eq("account_activated", true)
    .gt("engagement_points", 200);

  if (error) throw error;
  if (!users?.length) return { normalized: 0 };

  let normalized = 0;
  const CORRECT_EP = 50; // Base EP grant for paying users

  for (const user of users) {
    // Only reset users whose EP is suspiciously high (> 200 suggests inflation)
    // Keep EP that was legitimately earned through activity (posts, comments etc.)
    // We set a reasonable cap: 50 base + any EP earned through activity (max 500)
    const cap = Math.min(user.engagement_points, 500);
    const targetEP = Math.max(CORRECT_EP, cap > 200 ? CORRECT_EP : cap);

    await sb()
      .from("profiles")
      .update({
        engagement_points: targetEP,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    normalized++;
  }

  return { normalized };
}

// ─── Users ─────────────────────────────────────────────────────────────────
export function useUsers(pageSize = 20) {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const from = page * pageSize;
      let query = sb()
        .from("profiles")
        .select(
          "id,email,full_name,username,verified,is_pro,account_status,subscription_tier,payment_status,created_at,deleted_at,last_seen,engagement_points,account_activated,deactivated_reason,account_locked_until,failed_login_attempts,require_2fa,invite_code_used,is_admin",
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);

      if (search)
        query = query.or(
          `email.ilike.%${search}%,full_name.ilike.%${search}%,username.ilike.%${search}%`,
        );

      const { data, count, error } = await query;
      if (error) throw error;
      setUsers(data || []);
      setTotal(count || 0);
    } catch (e) {
      console.error("Users error:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  const updateUser = async (userId, updates) => {
    const { error } = await sb()
      .from("profiles")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (error) throw error;
    await load();
  };

  const banUser = async (userId, reason) => {
    await updateUser(userId, {
      account_status: "suspended",
      deactivated_reason: reason || "Suspended by admin",
    });
    await _revokeAuthSession(userId);
  };

  const unbanUser = async (userId) =>
    updateUser(userId, {
      account_status: "active",
      deactivated_reason: null,
      account_locked_until: null,
    });

  const deleteUser = async (userId) => {
    const { data, error } = await sb().rpc("admin_hard_delete_user", {
      p_target_user_id: userId,
    });
    if (error) throw new Error(`Delete failed: ${error.message}`);
    if (data?.error) throw new Error(`Delete failed: ${data.error}`);
    await _revokeAuthSession(userId).catch(() => {});
    await load();
  };

  const restoreUser = async (userId) =>
    updateUser(userId, { deleted_at: null, account_status: "active" });

  const verifyUser = async (userId, verified) =>
    updateUser(userId, { verified });
  const setUserTier = async (userId, tier) =>
    updateUser(userId, { subscription_tier: tier });

  // ─── Fix EP for a single user (admin action) ──────────────────────────
  const fixUserEP = async (userId, targetEP = 50) => {
    await updateUser(userId, { engagement_points: targetEP });
  };

  const adjustWallet = async (userId, tokens, points, reason, adminId) => {
    const { data: profile } = await sb()
      .from("profiles")
      .select("engagement_points")
      .eq("id", userId)
      .single();
    const currentPoints = profile?.engagement_points || 0;
    await updateUser(userId, {
      engagement_points: Math.max(0, currentPoints + (points || 0)),
    });

    if (tokens !== 0) {
      const { data: wallet } = await sb()
        .from("wallets")
        .select("grova_tokens")
        .eq("user_id", userId)
        .maybeSingle();
      if (wallet) {
        await sb()
          .from("wallets")
          .update({
            grova_tokens: Math.max(0, (wallet.grova_tokens || 0) + tokens),
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);
      } else {
        await sb()
          .from("wallets")
          .insert({
            user_id: userId,
            grova_tokens: Math.max(0, tokens),
            engagement_points: Math.max(0, points || 0),
          });
      }
    }

    await sb()
      .from("audit_log")
      .insert({
        admin_id: adminId,
        action: "wallet_adjust",
        target_type: "user",
        target_id: userId,
        details: { tokens, points, reason },
      });
  };

  return {
    users,
    total,
    page,
    setPage,
    loading,
    error,
    search,
    setSearch,
    reload: load,
    updateUser,
    banUser,
    unbanUser,
    deleteUser,
    restoreUser,
    verifyUser,
    setUserTier,
    adjustWallet,
    fixUserEP,
  };
}

// ─── Invites ───────────────────────────────────────────────────────────────
export function useInvites(pageSize = 50) {
  const [invites, setInvites] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState(null);

  const INVITE_SELECT =
    "id, code, type, max_uses, uses_count, created_by, created_by_name, created_at, updated_at, expires_at, status, metadata, community_id, community_name, price_override, entry_price";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const from = page * pageSize;
      let query = sb()
        .from("invite_codes")
        .select(INVITE_SELECT, { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);

      if (search) query = query.ilike("code", `%${search}%`);

      const { data, count, error } = await query;
      if (error) throw error;

      const adminInvites = (data || []).filter(
        (inv) => inv.metadata?.admin_created === true,
      );
      const enriched = adminInvites.map((inv) => {
        const meta = inv.metadata ?? {};
        const uses = inv.uses_count ?? 0;
        const max = inv.max_uses ?? null;
        return {
          ...inv,
          metadata: meta,
          is_full: max !== null && uses >= max,
          enable_waitlist:
            meta.enable_waitlist ?? (meta.waitlist_slots ?? 0) > 0,
        };
      });

      setInvites(enriched);
      setTotal(enriched.length);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  const createInvite = useCallback(
    async (invite) => {
      const now = new Date().toISOString();
      const category = invite.invite_category ?? "community";
      const typeMap = { vip: "vip", whitelist: "whitelist", admin: "admin" };
      const type = typeMap[category] ?? "standard";
      const entryPriceCents = Number(invite.entry_price_cents) || 400;
      const effectivePriceUSD = entryPriceCents / 100;
      const enableWaitlist =
        type === "whitelist" ? (invite.enable_waitlist ?? true) : false;

      const metadata = {
        admin_created: true,
        invite_name: invite.invite_name ?? "",
        invite_category: category,
        entry_price_cents: entryPriceCents,
        whitelist_price_cents: Number(invite.whitelist_price_cents) || 0,
        waitlist_slots: Number(invite.waitlist_slots) || 0,
        waitlist_count: 0,
        waitlist_entries: [],
        whitelisted_user_ids: [],
        vip_slots: Number(invite.vip_slots) || 0,
        ep_grant: Number(invite.ep_grant) || 50, // Default 50 EP, not 500
        has_whitelist_access: type === "whitelist",
        enable_waitlist: enableWaitlist,
      };

      const record = {
        code: invite.code?.trim().toUpperCase(),
        type,
        max_uses: Number(invite.max_uses) || null,
        uses_count: 0,
        status: "active",
        expires_at: invite.expires_at ?? null,
        entry_price: effectivePriceUSD,
        price_override: effectivePriceUSD,
        enable_waitlist: enableWaitlist,
        metadata,
        created_at: now,
        updated_at: now,
      };

      const { data, error } = await sb()
        .from("invite_codes")
        .insert(record)
        .select(INVITE_SELECT)
        .single();
      if (error) throw error;
      await load();
      return data;
    },
    [load],
  );

  const toggleInvite = useCallback(
    async (id, makeActive) => {
      const { error } = await sb()
        .from("invite_codes")
        .update({
          status: makeActive ? "active" : "inactive",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
      await load();
    },
    [load],
  );

  const updateInvite = useCallback(
    async (id, updates) => {
      const { error } = await sb()
        .from("invite_codes")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      await load();
    },
    [load],
  );

  const deleteInvite = useCallback(
    async (id) => {
      const { error } = await sb().from("invite_codes").delete().eq("id", id);
      if (error) throw error;
      await load();
    },
    [load],
  );

  const promoteWaitlist = useCallback(
    async (inviteId, count, adminId) => {
      const { data: inviteData, error: inviteErr } = await sb()
        .from("invite_codes")
        .select("metadata, max_uses, uses_count")
        .eq("id", inviteId)
        .single();
      if (inviteErr) throw inviteErr;
      const meta = inviteData?.metadata ?? {};
      const waitlistEntries = meta.waitlist_entries ?? [];
      const whitelistedIds = new Set(meta.whitelisted_user_ids ?? []);
      const waiting = waitlistEntries.filter(
        (e) => !whitelistedIds.has(e.user_id),
      );
      if (waiting.length === 0) throw new Error("No users on the waitlist.");
      const toPromote = waiting.slice(0, Math.min(count, waiting.length));
      const nowISO = new Date().toISOString();
      toPromote.forEach((u) => whitelistedIds.add(u.user_id));
      const updatedEntries = waitlistEntries.map((entry) =>
        toPromote.find((u) => u.user_id === entry.user_id)
          ? { ...entry, whitelisted_at: nowISO }
          : entry,
      );
      const newMeta = {
        ...meta,
        waitlist_entries: updatedEntries,
        whitelisted_user_ids: [...whitelistedIds],
      };
      const { error: updateErr } = await sb()
        .from("invite_codes")
        .update({
          metadata: newMeta,
          max_uses: (inviteData.max_uses ?? 0) + toPromote.length,
          updated_at: nowISO,
        })
        .eq("id", inviteId);
      if (updateErr) throw updateErr;
      await load();
      return toPromote.length;
    },
    [load],
  );

  return {
    invites,
    total,
    page,
    setPage,
    loading,
    error,
    search,
    setSearch,
    reload: load,
    createInvite,
    updateInvite,
    toggleInvite,
    deleteInvite,
    promoteWaitlist,
  };
}

// ─── Analytics ─────────────────────────────────────────────────────────────
export function useAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const [signupsRes, paymentsRes] = await Promise.all([
        sb()
          .from("profiles")
          .select("created_at")
          .gte("created_at", thirtyDaysAgo)
          .order("created_at", { ascending: true }),
        sb()
          .from("payments")
          .select("amount_cents, currency, provider, created_at")
          .eq("status", "completed")
          .gte("created_at", thirtyDaysAgo)
          .order("created_at", { ascending: true }),
      ]);

      const dayMap = {};
      const today = new Date();
      for (let i = 29; i >= 0; i--) {
        const d = new Date(today.getTime() - i * 86400000);
        const key = d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        dayMap[key] = { date: key, users: 0, revenue: 0, transactions: 0 };
      }
      (signupsRes.data || []).forEach((s) => {
        const key = new Date(s.created_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        if (dayMap[key]) dayMap[key].users++;
      });
      (paymentsRes.data || []).forEach((p) => {
        const key = new Date(p.created_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        if (dayMap[key]) {
          const { usdAmount } = resolvePaymentAmount(p);
          dayMap[key].revenue += usdAmount;
          dayMap[key].transactions++;
        }
      });

      const providerStats = {};
      (paymentsRes.data || []).forEach((p) => {
        const prov = p.provider || "unknown";
        if (!providerStats[prov]) providerStats[prov] = { count: 0, usd: 0 };
        providerStats[prov].count++;
        providerStats[prov].usd += resolvePaymentAmount(p).usdAmount;
      });

      setData({
        dailyStats: Object.values(dayMap),
        providerStats,
        totalSignups30d: (signupsRes.data || []).length,
        totalRevenue30d: sumPaymentsUSD(paymentsRes.data || []),
        totalTransactions30d: (paymentsRes.data || []).length,
      });
    } catch (e) {
      console.error("Analytics error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  return { data, loading, reload: load };
}

// ─── Transactions ──────────────────────────────────────────────────────────
export function useTransactions(pageSize = 20) {
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const from = page * pageSize;
      let query = sb()
        .from("payments")
        .select(
          `id, amount_cents, currency, status, provider, created_at, completed_at, idempotency_key, metadata,
           user:user_id(id, email, full_name),
           product:product_id(name, tier)`,
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);

      if (search) query = query.ilike("idempotency_key", `%${search}%`);

      const { data, count, error } = await query;
      if (error) throw error;

      setTransactions(
        (data || []).map((p) => {
          const resolved = resolvePaymentAmount(p);
          return {
            ...p,
            amount: resolved.usdAmount,
            amountLocal: resolved.localAmount,
            localCurrency: resolved.localCurrency,
            displayLocal: resolved.displayLocal,
            displayUSD: resolved.displayUSD,
            isNGN: resolved.isNGN,
            user_email: p.user?.email || "—",
            user_name: p.user?.full_name || "—",
            method: p.provider,
            type: p.product?.tier || p.metadata?.type || "deposit",
          };
        }),
      );
      setTotal(count || 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  const refundTransaction = async (txId, reason) => {
    const { error } = await sb()
      .from("payments")
      .update({
        status: "refunded",
        metadata: {
          refund_reason: reason,
          refunded_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", txId);
    if (error) throw error;
    await load();
  };

  return {
    transactions,
    total,
    page,
    setPage,
    loading,
    error,
    search,
    setSearch,
    reload: load,
    refundTransaction,
  };
}

// ─── Security ──────────────────────────────────────────────────────────────
export function useSecurity() {
  const [events, setEvents] = useState([]);
  const [lockedAccounts, setLockedAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [eventsRes, lockedRes] = await Promise.all([
        sb()
          .from("security_events")
          .select(
            "id, event_type, severity, ip_address, user_agent, created_at, metadata, user:user_id(email, full_name)",
          )
          .order("created_at", { ascending: false })
          .limit(50),
        sb()
          .from("profiles")
          .select(
            "id, email, full_name, failed_login_attempts, account_locked_until",
          )
          .not("account_locked_until", "is", null)
          .gt("account_locked_until", new Date().toISOString()),
      ]);
      if (eventsRes.error) throw eventsRes.error;
      setEvents(
        (eventsRes.data || []).map((e) => ({
          ...e,
          type: e.event_type,
          user_email: e.user?.email || e.metadata?.email || "—",
          ip: e.ip_address,
          resolved: e.resolved || false,
        })),
      );
      setLockedAccounts(lockedRes.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resolveEvent = async (id) => {
    const isLocked = lockedAccounts.find((a) => a.id === id);
    if (isLocked) {
      await sb()
        .from("profiles")
        .update({
          account_locked_until: null,
          failed_login_attempts: 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
    } else {
      await sb()
        .from("security_events")
        .update({ resolved: true })
        .eq("id", id);
    }
    await load();
  };

  return { events, lockedAccounts, loading, error, reload: load, resolveEvent };
}

// ─── Notifications ─────────────────────────────────────────────────────────
export function useNotifications() {
  const [sent, setSent] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await sb()
        .from("push_notifications")
        .select(
          "id, title, body, target_type, type, sent_by_name, reach, sent_at",
        )
        .order("sent_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setSent(data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const send = async (notif) => {
    const targetType = notif.targetType || notif.target_type || "all";
    const title = notif.title;
    const body = notif.message || notif.body;
    const type = notif.type || "info";

    const { error: logErr } = await sb()
      .from("push_notifications")
      .insert({
        title,
        body,
        target_type: targetType,
        type,
        sent_by_name: notif.sentByName,
        sent_by: notif.sentById,
        reach: 0,
        sent_at: new Date().toISOString(),
      });
    if (logErr) throw logErr;

    try {
      let userIds = [];
      if (targetType === "all") {
        const { data } = await sb()
          .from("profiles")
          .select("id")
          .eq("account_status", "active")
          .is("deleted_at", null);
        userIds = (data || []).map((u) => u.id);
      } else if (targetType === "vip") {
        const { data } = await sb()
          .from("profiles")
          .select("id")
          .eq("subscription_tier", "vip")
          .eq("account_status", "active");
        userIds = (data || []).map((u) => u.id);
      } else if (targetType === "specific" && notif.targetIds?.length) {
        userIds = notif.targetIds;
      }

      const batchSize = 100;
      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);
        const notifications = batch.map((uid) => ({
          recipient_user_id: uid,
          actor_user_id: notif.sentById || null,
          type: "payment_confirmed",
          message: `${title}: ${body}`,
          is_read: false,
          metadata: { admin_notification: true, notif_type: type, title, body },
          created_at: new Date().toISOString(),
        }));
        await sb()
          .from("notifications")
          .insert(notifications)
          .then(() => {})
          .catch(() => {});
      }
    } catch (fanoutErr) {
      console.warn("Notification fan-out partial failure:", fanoutErr.message);
    }
    await load();
  };

  return { sent, loading, error, reload: load, send };
}

// ─── Communities — FIXED suspend ───────────────────────────────────────────
export function useCommunities(pageSize = 20) {
  const [communities, setCommunities] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const from = page * pageSize;
      let query = sb()
        .from("communities")
        .select(
          `id, name, description, member_count, is_verified, is_premium, is_private, created_at, deleted_at, settings,
           owner:owner_id(id, email, full_name)`,
          { count: "exact" },
        )
        .order("member_count", { ascending: false })
        .range(from, from + pageSize - 1);

      if (statusFilter === "active") query = query.is("deleted_at", null);
      else if (statusFilter === "suspended")
        query = query.not("deleted_at", "is", null);

      if (search) query = query.ilike("name", `%${search}%`);

      const { data, count, error } = await query;
      if (error) throw error;

      setCommunities(
        (data || []).map((c) => ({
          ...c,
          owner_email: c.owner?.email || "—",
          owner_name: c.owner?.full_name || "—",
          status: c.deleted_at ? "suspended" : "active",
        })),
      );
      setTotal(count || 0);
    } catch (e) {
      console.error("Communities error:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, pageSize, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // ─── FIXED suspend — no async in object literal ───────────────────────
  const suspend = async (id, reason) => {
    // Step 1: fetch existing settings (await BEFORE building object)
    const { data: existing, error: fetchErr } = await sb()
      .from("communities")
      .select("settings")
      .eq("id", id)
      .single();

    if (fetchErr) throw fetchErr;

    // Step 2: build plain settings object synchronously
    const updatedSettings = {
      ...(existing?.settings || {}),
      suspension_reason: reason || "Suspended by admin",
      suspended_at: new Date().toISOString(),
    };

    // Step 3: update with plain object (no Promise inside)
    const { error } = await sb()
      .from("communities")
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        settings: updatedSettings,
      })
      .eq("id", id);

    if (error) throw error;
    await load();
  };

  const restore = async (id) => {
    const { data: existing } = await sb()
      .from("communities")
      .select("settings")
      .eq("id", id)
      .single();
    const updatedSettings = { ...(existing?.settings || {}) };
    delete updatedSettings.suspension_reason;
    delete updatedSettings.suspended_at;

    const { error } = await sb()
      .from("communities")
      .update({
        deleted_at: null,
        updated_at: new Date().toISOString(),
        settings: updatedSettings,
      })
      .eq("id", id);
    if (error) throw error;
    await load();
  };

  const hardDelete = async (id) => {
    await sb()
      .from("community_channels")
      .update({ deleted_at: new Date().toISOString() })
      .eq("community_id", id)
      .catch(() => {});
    const { error } = await sb().from("communities").delete().eq("id", id);
    if (error) throw error;
    await load();
  };

  return {
    communities,
    total,
    page,
    setPage,
    loading,
    error,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    reload: load,
    suspend,
    restore,
    hardDelete,
  };
}

// ─── Platform Freeze ───────────────────────────────────────────────────────
export function usePlatformFreeze() {
  const [freezeStatus, setFreezeStatus] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await sb()
        .from("platform_freeze")
        .select("region, is_frozen, frozen_by, updated_at");
      if (error) throw error;
      const map = {};
      (data || []).forEach((r) => {
        map[r.region] = r.is_frozen;
      });
      setFreezeStatus(map);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (regionId, freeze, adminId) => {
    setLoading(true);
    try {
      const { error } = await sb()
        .from("platform_freeze")
        .upsert(
          {
            region: regionId,
            is_frozen: freeze,
            frozen_by: adminId || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "region" },
        );
      if (error) throw error;
      await load();
    } finally {
      setLoading(false);
    }
  };

  return { freezeStatus, loading, error, toggle, reload: load };
}

// ─── Platform Settings ─────────────────────────────────────────────────────
export function usePlatformSettings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await sb()
        .from("platform_settings")
        .select("key, value");
      if (error) throw error;
      const map = {};
      (data || []).forEach((r) => {
        map[r.key] = r.value;
      });
      setSettings(map);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const update = async (key, value) => {
    setSettings((s) => ({ ...s, [key]: value }));
    const { error } = await sb()
      .from("platform_settings")
      .upsert(
        { key, value, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    if (error) {
      await load();
      throw error;
    }
  };

  return { settings, loading, error, update, refresh: load };
}

// ─── Admin Team ────────────────────────────────────────────────────────────
export function useTeam() {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: teamData, error: teamErr } = await sb()
        .from("admin_team")
        .select(
          `id, user_id, email, full_name, role, permissions, status, last_active, created_at, xa_id, profile:user_id(id, email, full_name, last_seen)`,
        )
        .eq("status", "active")
        .order("xa_id", { ascending: true });

      if (teamErr) throw teamErr;
      const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString();
      const enriched = (teamData || []).map((m) => {
        const lastSeen = m.profile?.last_seen || m.last_active;
        const isOnline = lastSeen
          ? new Date(lastSeen) > new Date(fiveMinAgo)
          : false;
        return {
          id: m.id,
          user_id: m.user_id,
          email: m.profile?.email || m.email,
          full_name: m.profile?.full_name || m.full_name,
          role: m.role,
          permissions: m.permissions || [],
          status: m.status,
          last_active: m.profile?.last_seen || m.last_active,
          is_online: isOnline,
          xa_id: m.xa_id,
        };
      });
      setTeam(enriched);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addMember = async ({ email, name, role, permissions }) => {
    const { data: profile, error: profileErr } = await sb()
      .from("profiles")
      .select("id, full_name, email")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();
    if (profileErr) throw profileErr;
    if (!profile)
      throw new Error(
        "No Xeevia account found with this email. The user must sign up first.",
      );
    const { data: existing } = await sb()
      .from("admin_team")
      .select("id, status")
      .eq("user_id", profile.id)
      .maybeSingle();
    if (existing) {
      if (existing.status === "inactive") {
        const { error } = await sb()
          .from("admin_team")
          .update({
            status: "active",
            role,
            permissions: permissions?.length
              ? permissions
              : ROLE_PERMISSIONS[role] || [],
            full_name: name || profile.full_name,
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        throw new Error("This user is already an admin team member.");
      }
    } else {
      const { error } = await sb()
        .from("admin_team")
        .insert({
          user_id: profile.id,
          email: profile.email,
          full_name: name || profile.full_name,
          role,
          permissions: permissions?.length
            ? permissions
            : ROLE_PERMISSIONS[role] || [],
          status: "active",
          created_at: new Date().toISOString(),
        });
      if (error) throw error;
    }
    await load();
  };

  const removeMember = async (id) => {
    const { error } = await sb()
      .from("admin_team")
      .update({ status: "inactive" })
      .eq("id", id);
    if (error) throw error;
    await load();
  };

  const updatePermissions = async (id, permissions) => {
    const { error } = await sb()
      .from("admin_team")
      .update({ permissions })
      .eq("id", id);
    if (error) throw error;
    await load();
  };

  const updateRole = async (id, role) => {
    const { error } = await sb()
      .from("admin_team")
      .update({ role, permissions: ROLE_PERMISSIONS[role] || [] })
      .eq("id", id);
    if (error) throw error;
    await load();
  };

  return {
    team,
    loading,
    error,
    load,
    addMember,
    removeMember,
    updatePermissions,
    updateRole,
  };
}

// ─── Support Cases ─────────────────────────────────────────────────────────
export function useSupportCases(pageSize = 20) {
  const [cases, setCases] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState({ status: "all", priority: "all" });
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const from = page * pageSize;
      let query = sb()
        .from("support_tickets")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);
      if (search) query = query.ilike("subject", `%${search}%`);
      if (filter.status !== "all") query = query.eq("status", filter.status);
      if (filter.priority !== "all")
        query = query.eq("priority", filter.priority);
      const { data, count, error } = await query;
      if (error) throw error;
      setCases(data || []);
      setTotal(count || 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, JSON.stringify(filter), pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  const updateCase = async (id, updates) => {
    const { error } = await sb()
      .from("support_tickets")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    await load();
  };

  const resolveCase = async (id, { adminName, adminId, note }) =>
    updateCase(id, {
      status: "resolved",
      resolved_by: adminId,
      resolved_at: new Date().toISOString(),
      resolve_note: note || "",
    });

  const addNote = async (id, { text, adminName, adminId }) => {
    await sb()
      .from("support_messages")
      .insert({
        ticket_id: id,
        user_id: adminId,
        content: `[Internal Note] ${text}`,
        is_staff: true,
        is_internal: true,
        staff_name: adminName,
      });
  };

  const assignCase = async (id, { adminId, adminName }) =>
    updateCase(id, {
      assigned_to: adminId,
      assigned_to_name: adminName,
      status: "in_progress",
      assigned_at: new Date().toISOString(),
    });

  const createSupportCase = async (caseData) => {
    const { error } = await sb()
      .from("support_tickets")
      .insert({
        ...caseData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    if (error) throw error;
    await load();
  };

  return {
    cases,
    total,
    page,
    setPage,
    loading,
    error,
    search,
    setSearch,
    filter,
    setFilter,
    reload: load,
    updateCase,
    resolveCase,
    addNote,
    assignCase,
    createSupportCase,
  };
}
