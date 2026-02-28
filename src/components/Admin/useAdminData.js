// ============================================================================
// src/components/Admin/useAdminData.js
// ALL REAL DATABASE DATA — ZERO MOCK DATA — PRODUCTION GRADE
// xa_id (Xeevia Admin sequential ID) is now selected and assigned throughout
// ============================================================================

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../services/config/supabase";
import { ROLE_PERMISSIONS } from "./permissions.js";

// ─── Convenience alias ─────────────────────────────────────────────────────
let _override = null;
export function initSupabase(client) {
  _override = client;
}
function sb() {
  return _override || supabase;
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
        if (value !== undefined && value !== null) {
          if (value === null) q = q.is(key, null);
          else q = q.eq(key, value);
        }
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
        { data: revenueData },
        { data: revenueToday },
        { data: revenueWeek },
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
        sb().from("payments").select("amount_cents").eq("status", "completed"),
        sb()
          .from("payments")
          .select("amount_cents")
          .eq("status", "completed")
          .gte("created_at", todayISO),
        sb()
          .from("payments")
          .select("amount_cents")
          .eq("status", "completed")
          .gte("created_at", weekAgo),
      ]);

      const totalRevenue =
        (revenueData || []).reduce((s, r) => s + (r.amount_cents || 0), 0) /
        100;
      const revToday =
        (revenueToday || []).reduce((s, r) => s + (r.amount_cents || 0), 0) /
        100;
      const revWeek =
        (revenueWeek || []).reduce((s, r) => s + (r.amount_cents || 0), 0) /
        100;

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

  const banUser = async (userId, reason) =>
    updateUser(userId, {
      account_status: "suspended",
      deactivated_reason: reason,
    });
  const unbanUser = async (userId) =>
    updateUser(userId, {
      account_status: "active",
      deactivated_reason: null,
      account_locked_until: null,
    });
  const deleteUser = async (userId) =>
    updateUser(userId, {
      deleted_at: new Date().toISOString(),
      account_status: "deactivated",
    });
  const restoreUser = async (userId) =>
    updateUser(userId, { deleted_at: null, account_status: "active" });
  const verifyUser = async (userId, verified) =>
    updateUser(userId, { verified });
  const setUserTier = async (userId, tier) =>
    updateUser(userId, { subscription_tier: tier });

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
  };
}

// ─── Invites ───────────────────────────────────────────────────────────────
//
// SCHEMA REALITY CHECK (invite_codes table):
//   REAL columns: id, code, type, max_uses, uses_count, created_by,
//     created_by_name, created_at, updated_at, expires_at, status,
//     metadata (jsonb), community_id, community_name, price_override,
//     entry_price
//
//   NOT in schema (must live in metadata):
//     invite_name, invite_category, invite_label_custom, entry_price_cents,
//     whitelist_price_cents, waitlist_batch_size, whitelist_opens_at,
//     is_active, enable_waitlist, waitlist_count
//
//   MAPPING:
//     is_active   ← derived from status === 'active'
//     entry_price ← real column (USD float, e.g. 4.00)
//     price_override ← real column — used as whitelist price (USD float)
//     All other extended fields → metadata jsonb
//
// NOTE: The invite_codes table has NO is_active column. We use status field.

export function useInvites(pageSize = 50) {
  const [invites, setInvites] = useState([]);
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
      // Only select columns that actually exist in the schema
      let query = sb()
        .from("invite_codes")
        .select(
          "id, code, type, max_uses, uses_count, created_by, created_by_name, created_at, updated_at, expires_at, status, metadata, community_id, community_name, price_override, entry_price",
          { count: "exact" }
        )
        // Only show invites created by admin — exclude community invites and
        // auto-generated codes by filtering on community_id being null OR
        // metadata having our admin-created marker.
        // We also exclude invite_codes that are purely community-generated
        // (community_id is set and metadata.admin_created is not true).
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);

      if (search) query = query.ilike("code", `%${search}%`);

      const { data, count, error } = await query;
      if (error) throw error;

      // Filter to only show admin-created invites (those with our marker in metadata)
      // This prevents community invite codes and any legacy/seeded codes from showing.
      const adminInvites = (data || []).filter(
        (inv) => inv.metadata?.admin_created === true
      );

      // Normalise into a consistent shape that the UI can consume.
      // All extended fields are read from metadata with safe fallbacks.
      const enriched = adminInvites.map((inv) => {
        const meta = inv.metadata ?? {};
        return {
          ...inv,
          // Derived active state from real 'status' column
          is_active: inv.status === "active",
          // Extended fields from metadata
          invite_name:           meta.invite_name           ?? "",
          invite_category:       meta.invite_category       ?? inv.type ?? "community",
          invite_label_custom:   meta.invite_label_custom   ?? null,
          entry_price_cents:     meta.entry_price_cents     ?? Math.round((Number(inv.entry_price) || 4) * 100),
          whitelist_price_cents: meta.whitelist_price_cents ?? Math.round((Number(inv.price_override) || 0) * 100),
          waitlist_batch_size:   meta.waitlist_batch_size   ?? 50,
          whitelist_opens_at:    meta.whitelist_opens_at    ?? inv.whitelist_opens_at ?? null,
          enable_waitlist:       meta.enable_waitlist       ?? true,
          uses_count:            inv.uses_count             ?? 0,
          is_full:               (inv.uses_count ?? 0) >= (inv.max_uses ?? 1),
        };
      });

      setInvites(enriched);
      setTotal(enriched.length);
    } catch (e) {
      console.error("Invites error:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Display name helper ─────────────────────────────────────────────────
  const getInviteDisplayName = useCallback((invite) => {
    if (!invite) return "Unknown";
    const category = invite.invite_category ?? invite.type ?? "community";
    if (category === "custom" && invite.invite_label_custom) {
      return invite.invite_label_custom;
    }
    const labels = {
      community: "Community",
      user:      "User",
      vip:       "VIP",
      standard:  "Standard",
      whitelist: "Whitelist",
      admin:     "Admin",
      custom:    "Custom",
    };
    return labels[category] ?? category.charAt(0).toUpperCase() + category.slice(1);
  }, []);

  // ── Create invite ────────────────────────────────────────────────────────
  // Only writes to columns that actually exist in the schema.
  // All extended/UI fields go into metadata.
  const createInvite = useCallback(async (invite) => {
    const now = new Date().toISOString();
    const category = invite.invite_category ?? "community";
    const isCustom = category === "custom";

    // Map category to the allowed 'type' enum values
    const typeMap = { vip: "vip", whitelist: "whitelist", admin: "admin" };
    const type = typeMap[category] ?? "standard";

    const entryPriceCents     = Number(invite.entry_price_cents)     || 400;
    const whitelistPriceCents = Number(invite.whitelist_price_cents) || 0;

    // Build metadata — this is the source of truth for all extended fields
    const metadata = {
      admin_created:         true,               // ← marker so we know this is admin-created
      invite_name:           invite.invite_name          ?? "",
      invite_category:       category,
      invite_label_custom:   isCustom ? (invite.invite_label_custom ?? null) : null,
      entry_price_cents:     entryPriceCents,
      whitelist_price_cents: whitelistPriceCents,
      waitlist_batch_size:   Number(invite.waitlist_batch_size) || 50,
      whitelist_opens_at:    invite.whitelist_opens_at ?? null,
      enable_waitlist:       true,
      waitlist_count:        0,
      waitlist_entries:      [],
      whitelisted_user_ids:  [],
      target_tier:
        isCustom     ? "standard" :
        category === "vip"       ? "vip" :
        category === "community" ? "whitelist" : "standard",
    };

    // Only insert real schema columns
    const record = {
      code:           invite.code.trim().toUpperCase(),
      type,
      max_uses:       Number(invite.max_uses) || 100,
      uses_count:     0,
      status:         "active",
      expires_at:     invite.expires_at ?? null,
      entry_price:    entryPriceCents / 100,     // real column (USD float)
      price_override: whitelistPriceCents / 100, // real column (USD float)
      metadata,
      created_at:     now,
      updated_at:     now,
    };

    const { data, error } = await sb()
      .from("invite_codes")
      .insert(record)
      .select()
      .single();

    if (error) throw error;
    await load();
    return data;
  }, [load]);

  // ── Toggle invite active state ───────────────────────────────────────────
  // Uses the real 'status' column — no is_active column exists.
  const toggleInvite = useCallback(async (id, makeActive) => {
    const { error } = await sb()
      .from("invite_codes")
      .update({
        status:     makeActive ? "active" : "inactive",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;
    await load();
  }, [load]);

  // ── Update invite ────────────────────────────────────────────────────────
  const updateInvite = useCallback(async (id, updates) => {
    const { error } = await sb()
      .from("invite_codes")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    await load();
  }, [load]);

  // ── Delete invite ────────────────────────────────────────────────────────
  const deleteInvite = useCallback(async (id) => {
    const { error } = await sb().from("invite_codes").delete().eq("id", id);
    if (error) throw error;
    await load();
  }, [load]);

  // ── Get waitlist entries ─────────────────────────────────────────────────
  const getWaitlistEntries = useCallback(async (inviteId) => {
    try {
      const { data: inviteData } = await sb()
        .from("invite_codes")
        .select("metadata, max_uses, uses_count")
        .eq("id", inviteId)
        .single();

      const meta = inviteData?.metadata ?? {};
      const waitlistEntries = meta.waitlist_entries ?? [];
      const whitelistedIds  = new Set(meta.whitelisted_user_ids ?? []);

      if (waitlistEntries.length === 0) return [];

      const userIds = waitlistEntries.map((e) => e.user_id).filter(Boolean);
      let profiles = {};
      if (userIds.length > 0) {
        const { data: profileData } = await sb()
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);
        (profileData || []).forEach((p) => { profiles[p.id] = p; });
      }

      return waitlistEntries.map((entry, idx) => {
        const profile    = profiles[entry.user_id] ?? {};
        const isWhitelisted = whitelistedIds.has(entry.user_id);
        return {
          id:               entry.user_id ?? `waitlist_${idx}`,
          user_id:          entry.user_id,
          full_name:        profile.full_name    ?? entry.full_name ?? "—",
          email:            profile.email        ?? entry.email     ?? "—",
          status:           isWhitelisted ? "whitelisted" : "waiting",
          authenticated_at: entry.authenticated_at ?? null,
          whitelisted_at:   entry.whitelisted_at   ?? null,
          joined_at:        entry.joined_at         ?? null,
          account_activated: !!entry.account_activated,
          position:         idx + 1,
        };
      });
    } catch (e) {
      console.error("getWaitlistEntries error:", e);
      return [];
    }
  }, []);

  // ── Promote waitlist ─────────────────────────────────────────────────────
  const promoteWaitlist = useCallback(async (inviteId, count, adminId) => {
    const { data: inviteData, error: inviteErr } = await sb()
      .from("invite_codes")
      .select("metadata, max_uses, uses_count, entry_price, price_override")
      .eq("id", inviteId)
      .single();

    if (inviteErr) throw inviteErr;

    const meta           = inviteData?.metadata ?? {};
    const waitlistEntries = meta.waitlist_entries ?? [];
    const whitelistedIds  = new Set(meta.whitelisted_user_ids ?? []);
    const waiting         = waitlistEntries.filter((e) => !whitelistedIds.has(e.user_id));

    if (waiting.length === 0) throw new Error("No users on the waitlist.");

    const toPromote = waiting.slice(0, Math.min(count, waiting.length));
    const nowISO    = new Date().toISOString();

    toPromote.forEach((u) => whitelistedIds.add(u.user_id));

    const updatedEntries = waitlistEntries.map((entry) =>
      toPromote.find((u) => u.user_id === entry.user_id)
        ? { ...entry, whitelisted_at: nowISO }
        : entry
    );

    const newMeta = {
      ...meta,
      waitlist_entries:     updatedEntries,
      whitelisted_user_ids: [...whitelistedIds],
    };

    const { error: updateErr } = await sb()
      .from("invite_codes")
      .update({
        metadata:   newMeta,
        max_uses:   (inviteData.max_uses ?? 0) + toPromote.length,
        updated_at: nowISO,
      })
      .eq("id", inviteId);

    if (updateErr) throw updateErr;

    const promotedUserIds = toPromote.map((u) => u.user_id).filter(Boolean);
    if (promotedUserIds.length > 0) {
      for (const uid of promotedUserIds) {
        const { data: profileData } = await sb()
          .from("profiles")
          .select("account_activated, subscription_tier")
          .eq("id", uid)
          .maybeSingle();

        if (profileData && !profileData.account_activated) {
          await sb()
            .from("profiles")
            .update({ subscription_tier: "whitelist", updated_at: nowISO })
            .eq("id", uid);
        }
      }

      await sb()
        .from("audit_log")
        .insert({
          admin_id:    adminId,
          action:      "waitlist_promote",
          target_type: "invite",
          target_id:   inviteId,
          details:     { promoted_count: toPromote.length, promoted_user_ids: promotedUserIds },
          created_at:  nowISO,
        })
        .then(() => {})
        .catch(() => {});
    }

    await load();
    return toPromote.length;
  }, [load]);

  // ── Update waitlist open time ────────────────────────────────────────────
  const updateWaitlistOpenTime = useCallback(async (inviteId, opensAt) => {
    const { data: inviteData } = await sb()
      .from("invite_codes")
      .select("metadata")
      .eq("id", inviteId)
      .single();

    const meta = inviteData?.metadata ?? {};

    const { error } = await sb()
      .from("invite_codes")
      .update({
        metadata:   { ...meta, whitelist_opens_at: opensAt ?? null },
        updated_at: new Date().toISOString(),
      })
      .eq("id", inviteId);

    if (error) throw error;
    await load();
  }, [load]);

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
    // Core CRUD
    createInvite,
    updateInvite,
    toggleInvite,
    deleteInvite,
    // Waitlist management
    getWaitlistEntries,
    promoteWaitlist,
    updateWaitlistOpenTime,
    // Display helpers
    getInviteDisplayName,
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

      const { data: signups } = await sb()
        .from("profiles")
        .select("created_at")
        .gte("created_at", thirtyDaysAgo)
        .order("created_at", { ascending: true });
      const { data: payments } = await sb()
        .from("payments")
        .select("amount_cents, created_at")
        .eq("status", "completed")
        .gte("created_at", thirtyDaysAgo)
        .order("created_at", { ascending: true });

      const dayMap = {};
      const today = new Date();
      for (let i = 29; i >= 0; i--) {
        const d = new Date(today.getTime() - i * 86400000);
        const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        dayMap[key] = { date: key, users: 0, revenue: 0 };
      }

      (signups || []).forEach((s) => {
        const key = new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        if (dayMap[key]) dayMap[key].users++;
      });
      (payments || []).forEach((p) => {
        const key = new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        if (dayMap[key]) dayMap[key].revenue += (p.amount_cents || 0) / 100;
      });

      setData({ dailyStats: Object.values(dayMap) });
    } catch (e) {
      console.error("Analytics error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
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
        (data || []).map((p) => ({
          ...p,
          amount:     (p.amount_cents || 0) / 100,
          user_email: p.user?.email       || "—",
          user_name:  p.user?.full_name   || "—",
          method:     p.provider,
          type:       p.product?.tier     || p.metadata?.type || "—",
        }))
      );
      setTotal(count || 0);
    } catch (e) {
      console.error("Transactions error:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, pageSize]);

  useEffect(() => { load(); }, [load]);

  const refundTransaction = async (txId, reason) => {
    const { error } = await sb()
      .from("payments")
      .update({
        status:     "refunded",
        metadata:   { refund_reason: reason, refunded_at: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      })
      .eq("id", txId);
    if (error) throw error;
    await load();
  };

  return {
    transactions, total, page, setPage, loading, error, search, setSearch,
    reload: load, refundTransaction,
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
          .select("id, email, full_name, failed_login_attempts, account_locked_until")
          .not("account_locked_until", "is", null)
          .gt("account_locked_until", new Date().toISOString()),
      ]);

      if (eventsRes.error) throw eventsRes.error;

      setEvents(
        (eventsRes.data || []).map((e) => ({
          ...e,
          type:       e.event_type,
          user_email: e.user?.email || e.metadata?.email || "—",
          ip:         e.ip_address,
          resolved:   e.resolved || false,
        }))
      );
      setLockedAccounts(lockedRes.data || []);
    } catch (e) {
      console.error("Security error:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resolveEvent = async (id) => {
    const isLocked = lockedAccounts.find((a) => a.id === id);
    if (isLocked) {
      await sb()
        .from("profiles")
        .update({
          account_locked_until:  null,
          failed_login_attempts: 0,
          updated_at:            new Date().toISOString(),
        })
        .eq("id", id);
    } else {
      await sb().from("security_events").update({ resolved: true }).eq("id", id);
    }
    await load();
  };

  const blockIp = async (ip) => {
    const { error } = await sb()
      .from("blocked_ips")
      .upsert({ ip, blocked_at: new Date().toISOString() }, { onConflict: "ip" });
    if (error) throw error;
  };

  return { events, lockedAccounts, loading, error, reload: load, resolveEvent, blockIp };
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
        .select("id, title, body, target_type, type, sent_by_name, reach, sent_at")
        .order("sent_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setSent(data || []);
    } catch (e) {
      console.error("Notifications error:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const send = async (notif) => {
    const { error } = await sb().from("push_notifications").insert({
      title:       notif.title,
      body:        notif.message || notif.body,
      target_type: notif.targetType || notif.target_type || "all",
      type:        notif.type || "info",
      sent_by_name: notif.sentByName,
      sent_by:     notif.sentById,
      reach:       0,
      sent_at:     new Date().toISOString(),
    });
    if (error) throw error;
    await load();
  };

  return { sent, loading, error, reload: load, send };
}

// ─── Communities ───────────────────────────────────────────────────────────
export function useCommunities(pageSize = 20) {
  const [communities, setCommunities] = useState([]);
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
        .from("communities")
        .select(
          `id, name, description, member_count, is_verified, is_premium, is_private, created_at, deleted_at, settings,
           owner:owner_id(id, email, full_name)`,
          { count: "exact" },
        )
        .is("deleted_at", null)
        .order("member_count", { ascending: false })
        .range(from, from + pageSize - 1);

      if (search) query = query.ilike("name", `%${search}%`);

      const { data, count, error } = await query;
      if (error) throw error;

      setCommunities(
        (data || []).map((c) => ({
          ...c,
          owner_email: c.owner?.email     || "—",
          owner_name:  c.owner?.full_name || "—",
          status: "active",
        }))
      );
      setTotal(count || 0);
    } catch (e) {
      console.error("Communities error:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, pageSize]);

  useEffect(() => { load(); }, [load]);

  const suspend = async (id) => {
    const { error } = await sb()
      .from("communities")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    await load();
  };

  const restore = async (id) => {
    const { error } = await sb()
      .from("communities")
      .update({ deleted_at: null })
      .eq("id", id);
    if (error) throw error;
    await load();
  };

  return {
    communities, total, page, setPage, loading, error, search, setSearch,
    reload: load, suspend, restore,
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
      (data || []).forEach((r) => { map[r.region] = r.is_frozen; });
      setFreezeStatus(map);
    } catch (e) {
      console.error("Freeze error:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (regionId, freeze, adminId) => {
    setLoading(true);
    try {
      const { error } = await sb()
        .from("platform_freeze")
        .upsert(
          { region: regionId, is_frozen: freeze, frozen_by: adminId || null, updated_at: new Date().toISOString() },
          { onConflict: "region" }
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
      (data || []).forEach((r) => { map[r.key] = r.value; });
      setSettings(map);
    } catch (e) {
      console.error("Settings error:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = async (key, value) => {
    setSettings((s) => ({ ...s, [key]: value }));
    const { error } = await sb()
      .from("platform_settings")
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) { await load(); throw error; }
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
          `id, user_id, email, full_name, role, permissions, status, last_active, created_at, xa_id,
           profile:user_id(id, email, full_name, last_seen)`,
        )
        .eq("status", "active")
        .order("xa_id", { ascending: true });

      if (teamErr) throw teamErr;

      const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString();

      const enriched = (teamData || []).map((m) => {
        const lastSeen = m.profile?.last_seen || m.last_active;
        const isOnline = lastSeen ? new Date(lastSeen) > new Date(fiveMinAgo) : false;
        return {
          id:          m.id,
          user_id:     m.user_id,
          email:       m.profile?.email     || m.email,
          full_name:   m.profile?.full_name || m.full_name,
          role:        m.role,
          permissions: m.permissions || [],
          status:      m.status,
          last_active: m.profile?.last_seen || m.last_active,
          is_online:   isOnline,
          xa_id:       m.xa_id,
        };
      });

      setTeam(enriched);
    } catch (e) {
      console.error("Team error:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addMember = async ({ email, name, role, permissions }) => {
    const { data: profile, error: profileErr } = await sb()
      .from("profiles")
      .select("id, full_name, email")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();

    if (profileErr) throw profileErr;
    if (!profile)
      throw new Error("No Xeevia account found with this email. The user must sign up first.");

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
            status:      "active",
            role,
            permissions: permissions?.length ? permissions : ROLE_PERMISSIONS[role] || [],
            full_name:   name || profile.full_name,
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        throw new Error("This user is already an admin team member.");
      }
    } else {
      const { error } = await sb().from("admin_team").insert({
        user_id:     profile.id,
        email:       profile.email,
        full_name:   name || profile.full_name,
        role,
        permissions: permissions?.length ? permissions : ROLE_PERMISSIONS[role] || [],
        status:      "active",
        created_at:  new Date().toISOString(),
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
    const { error } = await sb().from("admin_team").update({ permissions }).eq("id", id);
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

  return { team, loading, error, load, addMember, removeMember, updatePermissions, updateRole };
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
      if (filter.status   !== "all") query = query.eq("status",   filter.status);
      if (filter.priority !== "all") query = query.eq("priority", filter.priority);

      const { data, count, error } = await query;
      if (error) throw error;
      setCases(data || []);
      setTotal(count || 0);
    } catch (e) {
      console.error("Cases error:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, JSON.stringify(filter), pageSize]);

  useEffect(() => { load(); }, [load]);

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
      status:      "resolved",
      resolved_by: adminId,
      resolved_at: new Date().toISOString(),
      resolve_note: note || "",
    });

  const addNote = async (id, { text, adminName, adminId }) => {
    await sb().from("support_messages").insert({
      ticket_id:   id,
      user_id:     adminId,
      content:     `[Internal Note] ${text}`,
      is_staff:    true,
      is_internal: true,
      staff_name:  adminName,
    });
  };

  const assignCase = async (id, { adminId, adminName }) =>
    updateCase(id, {
      assigned_to:      adminId,
      assigned_to_name: adminName,
      status:           "in_progress",
      assigned_at:      new Date().toISOString(),
    });

  const createSupportCase = async (caseData) => {
    const { error } = await sb().from("support_tickets").insert({
      ...caseData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    await load();
  };

  const escalateCase = async (id) =>
    updateCase(id, { status: "escalated", escalated_at: new Date().toISOString() });

  return {
    cases, total, page, setPage, loading, error, search, setSearch, filter, setFilter,
    reload: load, updateCase, resolveCase, addNote, assignCase, createSupportCase, escalateCase,
  };
}