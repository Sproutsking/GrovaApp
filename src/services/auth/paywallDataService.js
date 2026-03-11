// src/services/auth/paywallDataService.js — v8 AUDIT-FIXED
// ============================================================================
// CHANGES vs v7:
//   [BUG-7] fetchLiveStats: removed supabase.from("waitlist_entries") query.
//           The `waitlist_entries` table does NOT exist in the schema.
//           Waitlist state lives in invite_codes.metadata.waitlist_entries
//           (a JSONB array). waitlistCount is now derived by summing
//           waitlist_entries array lengths across all active whitelist codes.
//           This eliminates the 404 flood that fires every 5 seconds.
// ============================================================================

import { supabase } from "../config/supabase";

const PAYWALL_SETTINGS_KEY = "paywall_config";

const INVITE_SELECT =
  "id, code, type, max_uses, uses_count, created_by, created_by_name, created_at, updated_at, expires_at, status, metadata, community_id, community_name, price_override, entry_price";

const DEFAULT_CONFIG = {
  is_active: true,
  price_usd: 4,
  product_price: 4,
  ep_grant: 300,
  slots_total: 0,
  slots_claimed: 0,
  hero_message: "",
  member_count: 0,
  updated_at: null,
};

// ─── Paywall Config ───────────────────────────────────────────────────────────

export async function fetchPaywallConfig() {
  try {
    const { data, error } = await supabase
      .from("platform_settings")
      .select("id, key, value, updated_at")
      .eq("key", PAYWALL_SETTINGS_KEY)
      .maybeSingle();

    if (error) throw error;
    if (!data) return { ...DEFAULT_CONFIG };

    const v = data.value ?? {};

    const rawPrice =
      v.price_usd !== undefined
        ? v.price_usd
        : v.product_price !== undefined
          ? v.product_price
          : v.entry_price !== undefined
            ? v.entry_price
            : v.public_price !== undefined
              ? v.public_price
              : v.price !== undefined
                ? v.price
                : undefined;

    const parsedPrice = rawPrice !== undefined ? Number(rawPrice) : undefined;
    const resolvedPrice =
      parsedPrice !== undefined && parsedPrice > 0
        ? parsedPrice
        : DEFAULT_CONFIG.price_usd;

    const resolvedEp = Number(
      v.ep_grant ??
        v.public_ep_grant ??
        v.ep_reward ??
        v.ep ??
        v.epGrant ??
        DEFAULT_CONFIG.ep_grant,
    );
    const resolvedHero =
      v.hero_message ??
      v.heroMessage ??
      v.tagline ??
      v.subtitle ??
      DEFAULT_CONFIG.hero_message;

    return {
      _settings_id: data.id,
      price_usd: resolvedPrice,
      product_price: resolvedPrice,
      ep_grant: resolvedEp,
      is_active:
        v.is_active !== undefined ? v.is_active : DEFAULT_CONFIG.is_active,
      slots_total: Number(v.slots_total ?? DEFAULT_CONFIG.slots_total),
      slots_claimed: Number(v.slots_claimed ?? DEFAULT_CONFIG.slots_claimed),
      hero_message: resolvedHero,
      member_count: Number(v.member_count ?? DEFAULT_CONFIG.member_count),
      updated_at: data.updated_at ?? null,
      _raw: v,
    };
  } catch (e) {
    console.warn("[paywallDataService.fetchPaywallConfig] error:", e?.message);
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * fetchLiveStats
 * [BUG-7 FIX] waitlist_entries table does NOT exist in schema.
 * waitlistCount is now derived from invite_codes.metadata JSONB arrays.
 */
export async function fetchLiveStats() {
  try {
    const [totalProfilesRes, activatedRes, paidStatusRes, wlCodesRes] =
      await Promise.allSettled([
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .is("deleted_at", null),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("account_activated", true)
          .is("deleted_at", null),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .in("payment_status", ["paid", "vip", "free"])
          .is("deleted_at", null),
        // Fetch whitelist codes WITH metadata so we can sum waitlist_entries arrays
        supabase
          .from("invite_codes")
          .select("max_uses, uses_count, metadata")
          .eq("type", "whitelist")
          .eq("status", "active"),
      ]);

    const c0 =
      totalProfilesRes.status === "fulfilled"
        ? (totalProfilesRes.value.count ?? 0)
        : 0;
    const c1 =
      activatedRes.status === "fulfilled" ? (activatedRes.value.count ?? 0) : 0;
    const c2 =
      paidStatusRes.status === "fulfilled"
        ? (paidStatusRes.value.count ?? 0)
        : 0;
    const memberCount = Math.max(c0, c1, c2);

    let whitelistTotal = 0;
    let whitelistFilled = 0;
    // [BUG-7] Sum waitlist_entries from JSONB metadata — no separate table needed
    let waitlistCount = 0;

    if (wlCodesRes.status === "fulfilled" && wlCodesRes.value.data) {
      const rows = wlCodesRes.value.data;
      whitelistTotal = rows.reduce((s, r) => s + (Number(r.max_uses) || 0), 0);
      whitelistFilled = rows.reduce(
        (s, r) => s + (Number(r.uses_count) || 0),
        0,
      );
      // Sum waitlist_entries array lengths from metadata JSONB
      waitlistCount = rows.reduce((s, r) => {
        const entries = r.metadata?.waitlist_entries;
        return s + (Array.isArray(entries) ? entries.length : 0);
      }, 0);
    }

    return { memberCount, whitelistTotal, whitelistFilled, waitlistCount };
  } catch (e) {
    console.warn("[paywallDataService.fetchLiveStats] error:", e?.message);
    return {
      memberCount: 0,
      whitelistTotal: 0,
      whitelistFilled: 0,
      waitlistCount: 0,
    };
  }
}

/**
 * updatePaywallConfig
 * Writes ALL price aliases atomically. No drift.
 */
export async function updatePaywallConfig(patch) {
  const current = await fetchPaywallConfig();

  const incomingPrice =
    patch.price_usd !== undefined
      ? Number(patch.price_usd)
      : patch.product_price !== undefined
        ? Number(patch.product_price)
        : patch.entry_price !== undefined
          ? Number(patch.entry_price)
          : (current.price_usd ?? DEFAULT_CONFIG.price_usd);

  const incomingEp =
    patch.ep_grant !== undefined ? Number(patch.ep_grant) : current.ep_grant;
  const incomingHero =
    patch.hero_message !== undefined
      ? patch.hero_message
      : patch.heroMessage !== undefined
        ? patch.heroMessage
        : current.hero_message;

  const merged = {
    is_active:
      patch.is_active !== undefined ? patch.is_active : current.is_active,
    price_usd: incomingPrice,
    product_price: incomingPrice,
    entry_price: incomingPrice,
    public_price: incomingPrice,
    ep_grant: incomingEp,
    slots_total:
      patch.slots_total !== undefined
        ? Number(patch.slots_total)
        : current.slots_total,
    slots_claimed:
      patch.slots_claimed !== undefined
        ? Number(patch.slots_claimed)
        : current.slots_claimed,
    hero_message: incomingHero,
    heroMessage: incomingHero,
    member_count:
      patch.member_count !== undefined
        ? Number(patch.member_count)
        : current.member_count,
  };

  const { error } = await supabase
    .from("platform_settings")
    .upsert(
      {
        key: PAYWALL_SETTINGS_KEY,
        value: merged,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );

  if (error) throw error;
  return merged;
}

// ─── Invite Codes ─────────────────────────────────────────────────────────────

export async function fetchInviteCodeDetails(code) {
  if (!code?.trim()) return null;
  try {
    const { data, error } = await supabase
      .from("invite_codes")
      .select(INVITE_SELECT)
      .eq("code", code.trim().toUpperCase())
      .eq("status", "active")
      .maybeSingle();
    if (error || !data) return null;
    return enrichInviteCode(data);
  } catch (e) {
    console.warn("[paywallDataService.fetchInviteCodeDetails]", e?.message);
    return null;
  }
}

export async function fetchAllInviteCodes() {
  try {
    const { data, error } = await supabase
      .from("invite_codes")
      .select(INVITE_SELECT)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(enrichInviteCode).filter(Boolean);
  } catch (e) {
    console.warn("[paywallDataService.fetchAllInviteCodes]", e?.message);
    return [];
  }
}

export async function createInviteCode({
  code,
  type = "standard",
  maxUses = 100,
  entryPrice = 0,
  expiresAt = null,
  metadata = {},
}) {
  const now = new Date().toISOString();
  const priceUSD = Number(entryPrice) || 0;
  const priceCents = Math.round(priceUSD * 100);
  const enableWaitlist =
    metadata.enable_waitlist != null
      ? !!metadata.enable_waitlist
      : Number(metadata.waitlist_slots) > 0;

  const fullMetadata = {
    ...metadata,
    entry_price_cents: priceCents,
    enable_waitlist: enableWaitlist,
    admin_created: true,
  };
  const record = {
    code: code.toUpperCase().trim(),
    type,
    status: "active",
    max_uses: Number(maxUses) || 100,
    uses_count: 0,
    entry_price: priceUSD,
    price_override: priceUSD,
    metadata: fullMetadata,
    expires_at: expiresAt ?? null,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("invite_codes")
    .insert(record)
    .select(INVITE_SELECT)
    .single();
  if (error) throw error;
  return enrichInviteCode(data);
}

export async function updateInviteCode(id, patch) {
  const { data: current, error: fetchErr } = await supabase
    .from("invite_codes")
    .select("metadata, entry_price, price_override")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) throw fetchErr;

  const currentMeta = current?.metadata ?? {};
  const metaPatch = patch.metadata ?? {};
  const mergedMeta = { ...currentMeta, ...metaPatch };

  if ("enable_waitlist" in metaPatch)
    mergedMeta.enable_waitlist = !!metaPatch.enable_waitlist;
  else if ("waitlist_slots" in metaPatch)
    mergedMeta.enable_waitlist = Number(metaPatch.waitlist_slots) > 0;

  const payload = {
    ...patch,
    metadata: mergedMeta,
    updated_at: new Date().toISOString(),
  };

  const newPrice =
    patch.entry_price !== undefined
      ? Number(patch.entry_price)
      : patch.price_override !== undefined
        ? Number(patch.price_override)
        : null;

  if (newPrice !== null) {
    payload.entry_price = newPrice;
    payload.price_override = newPrice;
    payload.metadata = {
      ...mergedMeta,
      entry_price_cents: Math.round(newPrice * 100),
    };
  }

  delete payload.enable_waitlist;
  delete payload.is_full;
  delete payload.is_expired;

  const { data, error } = await supabase
    .from("invite_codes")
    .update(payload)
    .eq("id", id)
    .select(INVITE_SELECT)
    .single();
  if (error) throw error;
  return enrichInviteCode(data);
}

export async function deleteInviteCode(id) {
  const { error } = await supabase.from("invite_codes").delete().eq("id", id);
  if (error) throw error;
}

export async function toggleInviteCodeStatus(id, currentStatus) {
  const newStatus = currentStatus === "active" ? "inactive" : "active";
  const { data, error } = await supabase
    .from("invite_codes")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(INVITE_SELECT)
    .single();
  if (error) throw error;
  return enrichInviteCode(data);
}

function enrichInviteCode(row) {
  if (!row) return null;
  const meta = row.metadata ?? {};
  const usesCount = row.uses_count ?? 0;
  const maxUses = row.max_uses ?? null;
  const isFull = maxUses !== null && usesCount >= maxUses;
  const isExpired = row.expires_at
    ? new Date(row.expires_at) < new Date()
    : false;
  const enableWaitlist =
    meta.enable_waitlist != null
      ? !!meta.enable_waitlist
      : Number(meta.waitlist_slots) > 0;

  const enrichedMeta = {
    ...meta,
    invite_type: meta.invite_type ?? row.type ?? "standard",
    invite_category: meta.invite_category ?? row.type ?? "standard",
  };

  const resolvedPrice =
    row.price_override != null
      ? Number(row.price_override)
      : meta.entry_price_cents != null
        ? Number(meta.entry_price_cents) / 100
        : row.entry_price != null
          ? Number(row.entry_price)
          : 0;

  const finalRow =
    row.price_override == null
      ? { ...row, price_override: resolvedPrice }
      : { ...row };
  if (!enrichedMeta.entry_price_cents)
    enrichedMeta.entry_price_cents = Math.round(resolvedPrice * 100);

  return {
    ...finalRow,
    metadata: enrichedMeta,
    is_full: isFull,
    is_expired: isExpired,
    enable_waitlist: enableWaitlist,
    invite_name: meta.invite_name ?? "",
    invite_category: enrichedMeta.invite_category,
    ep_grant: Number(meta.ep_grant ?? 500),
  };
}

// ─── Profile helpers ──────────────────────────────────────────────────────────

export function isPaidProfile(profile) {
  if (!profile) return false;
  if (profile.account_activated === true) return true;
  if (["paid", "vip", "free"].includes(profile.payment_status)) return true;
  if (
    profile.subscription_tier &&
    !["free", "pending"].includes(profile.subscription_tier)
  )
    return true;
  return false;
}

// Named export for AuthContext — fetchProfile is not in authService
export async function fetchProfile(userId) {
  if (!userId) return null;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  } catch (e) {
    console.warn("[paywallDataService.fetchProfile]", e?.message);
    return null;
  }
}

export async function saveConnectedWallet(userId, chainType, address, label) {
  if (!userId || !address) return;
  const colMap = {
    EVM: "connected_wallet_evm",
    SOLANA: "connected_wallet_sol",
    CARDANO: "connected_wallet_ada",
  };
  const col = colMap[(chainType ?? "").toUpperCase()];
  if (!col) return;
  try {
    await supabase
      .from("profiles")
      .update({ [col]: address, updated_at: new Date().toISOString() })
      .eq("id", userId);
  } catch (e) {
    console.warn("[saveConnectedWallet] non-fatal:", e?.message);
  }
}

export function resolveEffectivePrice(invite, publicPrice = 4) {
  if (!invite) return publicPrice;
  const po = invite.price_override;
  if (po != null && !isNaN(Number(po))) return Number(po);
  const meta = invite.metadata ?? {};
  if (meta.entry_price_cents != null && !isNaN(Number(meta.entry_price_cents)))
    return Number(meta.entry_price_cents) / 100;
  if (invite.entry_price != null && !isNaN(Number(invite.entry_price)))
    return Number(invite.entry_price);
  return publicPrice;
}

export function buildERC20TransferData(toAddress, amountUSD, tokenDecimals) {
  const rawAmount = Math.round(amountUSD * Math.pow(10, tokenDecimals));
  const amountHex = rawAmount.toString(16).padStart(64, "0");
  const toHex = toAddress.slice(2).toLowerCase().padStart(64, "0");
  return "0xa9059cbb" + toHex + amountHex;
}

// ─── Realtime ─────────────────────────────────────────────────────────────────

export function subscribeToPaywallConfig(onUpdate) {
  const channelName = `paywall-config-rt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "platform_settings" },
      async (payload) => {
        const changedKey = payload?.new?.key ?? payload?.old?.key ?? "";
        if (changedKey && changedKey !== PAYWALL_SETTINGS_KEY) return;
        try {
          const cfg = await fetchPaywallConfig();
          onUpdate?.(cfg);
        } catch (e) {
          console.warn(
            "[subscribeToPaywallConfig] refetch failed:",
            e?.message,
          );
        }
      },
    )
    .subscribe();
}

export function subscribeToInviteCode(id, onUpdate) {
  return supabase
    .channel(`invite-code-rt-${id}-${Date.now()}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "invite_codes",
        filter: `id=eq.${id}`,
      },
      async () => {
        try {
          const { data } = await supabase
            .from("invite_codes")
            .select(INVITE_SELECT)
            .eq("id", id)
            .maybeSingle();
          if (data) onUpdate?.(enrichInviteCode(data));
        } catch (e) {
          console.warn("[subscribeToInviteCode] refetch failed:", e?.message);
        }
      },
    )
    .subscribe();
}
