// src/hooks/useUserBoostTier.js
// ============================================================================
// SHARED LIVE BOOST TIER HOOK
//
// Provides always-fresh { tier, themeId } for ANY userId via a single
// module-level cache + one Supabase realtime channel per user.
//
// ARCHITECTURE
// ────────────
//   _cache     Map<userId, {tier, themeId}>   shared in-memory data
//   _listeners Map<userId, Set<setState>>      all mounted hook instances
//   _channels  Map<userId, RealtimeChannel>    one RT channel per user
//   _fetching  Map<userId, bool>               in-flight guard
//
// First mount for a userId  → fetch + open channel
// Subsequent mounts         → read cache instantly, subscribe to updates
// Any postgres_changes fire → re-fetch → notify ALL listeners atomically
// All mounts for userId gone→ channel removed, cache expires in 60 s
//
// WRITE INVALIDATION
// ──────────────────
// Call refreshBoostTier(userId) immediately after any write (activate,
// cancel, theme change) so the cache is cleared before the realtime
// event arrives. useBoost calls this automatically — no manual calls needed
// anywhere else.
//
// USAGE
// ─────
//   const { tier, themeId, loading } = useUserBoostTier(userId);
//
//   tier    — "silver" | "gold" | "diamond" | null
//   themeId — e.g. "diamond-cosmos" | null
//   loading — true only on the very first fetch for this userId
// ============================================================================

import { useState, useEffect, useRef } from "react";
import { supabase } from "../services/config/supabase";

// ── Module-level shared state ─────────────────────────────────────────────

/** @type {Map<string, { tier: string|null, themeId: string|null }>} */
const _cache = new Map();

/** @type {Map<string, Set<Function>>} */
const _listeners = new Map();

/** @type {Map<string, any>} — Supabase RealtimeChannel per user */
const _channels = new Map();

/** @type {Map<string, boolean>} — prevents concurrent fetches */
const _fetching = new Map();

// ── Internal: push latest cache entry to all listeners ───────────────────
function _notify(userId) {
  const fns = _listeners.get(userId);
  if (!fns?.size) return;
  const data = _cache.get(userId) ?? { tier: null, themeId: null };
  fns.forEach((fn) => fn({ ...data, loading: false }));
}

// ── Internal: fetch active boost from DB ─────────────────────────────────
async function _fetchBoost(userId) {
  if (_fetching.get(userId)) return;
  _fetching.set(userId, true);
  try {
    const { data } = await supabase
      .from("profile_boosts")
      .select("boost_tier, active_theme_id, status, expires_at")
      .eq("user_id", userId)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    _cache.set(userId, {
      tier:    data?.boost_tier      ?? null,
      themeId: data?.active_theme_id ?? null,
    });
  } catch {
    // On error keep whatever was cached, or set null so loading clears
    if (!_cache.has(userId)) _cache.set(userId, { tier: null, themeId: null });
  } finally {
    _fetching.set(userId, false);
    _notify(userId);
  }
}

// ── Internal: open one realtime channel per userId (idempotent) ───────────
function _ensureChannel(userId) {
  if (_channels.has(userId)) return;
  const ch = supabase
    .channel(`ubt_${userId}`)
    .on(
      "postgres_changes",
      {
        event:  "*",
        schema: "public",
        table:  "profile_boosts",
        filter: `user_id=eq.${userId}`,
      },
      () => _fetchBoost(userId)
    )
    .subscribe();
  _channels.set(userId, ch);
}

// ── Internal: tear down channel when no listeners remain ──────────────────
function _maybeCleanup(userId) {
  if (_listeners.get(userId)?.size) return; // still active
  const ch = _channels.get(userId);
  if (ch) {
    supabase.removeChannel(ch).catch(() => {});
    _channels.delete(userId);
  }
  // Keep cache warm for 60 s so quick re-mounts don't re-fetch
  setTimeout(() => {
    if (!_listeners.get(userId)?.size) _cache.delete(userId);
  }, 60_000);
}

// ── Public: force-invalidate cache + re-fetch ─────────────────────────────
// Called by useBoost after every write so every ProfilePreview /
// UserProfileModal on screen updates before the Supabase event arrives.
export function refreshBoostTier(userId) {
  if (!userId) return;
  _cache.delete(userId);
  _fetchBoost(userId);
}

// ── The hook ──────────────────────────────────────────────────────────────
export function useUserBoostTier(userId) {
  const [state, setState] = useState(() => {
    if (!userId) return { tier: null, themeId: null, loading: false };
    const cached = _cache.get(userId);
    return cached
      ? { ...cached, loading: false }
      : { tier: null, themeId: null, loading: true };
  });

  // Stable ref to setState so we can safely register it once and deregister
  // by reference without adding setState to effect deps.
  const setRef = useRef(setState);
  setRef.current = setState;

  useEffect(() => {
    if (!userId) return;

    // Use a stable wrapper so the Set identity never changes across renders
    const listener = (v) => setRef.current(v);

    if (!_listeners.has(userId)) _listeners.set(userId, new Set());
    _listeners.get(userId).add(listener);

    // Serve from cache immediately if available; otherwise fetch
    if (_cache.has(userId)) {
      setState({ ..._cache.get(userId), loading: false });
    } else {
      _fetchBoost(userId);
    }

    _ensureChannel(userId);

    return () => {
      _listeners.get(userId)?.delete(listener);
      _maybeCleanup(userId);
    };
  }, [userId]);

  return state;
}

export default useUserBoostTier;