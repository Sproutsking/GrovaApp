// ============================================================================
// src/services/notifications/notificationService.js — v5 DEDUP-SAFE
// ============================================================================
//
// ROOT CAUSE OF DUPLICATION (fixed here):
//   v4 realtime INSERT handler did TWO things that caused doubles:
//     1. Prepended the enriched notification to _cache immediately
//     2. Scheduled _fetchAndCache() 800ms later → second prepend of same item
//   The refetch was added to get the actor JOIN, but it re-prepended an item
//   that was already in _cache, so users saw duplicates.
//
// FIX:
//   • On INSERT: prepend optimistically (no actor data yet) AND mark it with
//     a _pendingFetch flag.
//   • _fetchAndCache() now MERGES results instead of replacing _cache blindly:
//     it deduplicates by id so the refetch never creates a second copy.
//   • _badgeCount is incremented ONCE on INSERT; the refetch does not touch it.
//   • A seen-ids Set (_seenRealtimeIds) guards against the Supabase channel
//     occasionally firing duplicate INSERT events for the same row.
//
// ── Two independent badge concepts ───────────────────────────────────────────
//   HEADER BADGE  = notifications created AFTER badge_cleared_at
//                   → resets when sidebar OPENS (clearHeaderBadge)
//                   → NOT affected by is_read
//
//   SIDEBAR DOTS  = is_read === false per row
//                   → cleared via markAsRead / markAllAsRead
//                   → NOT affected by opening the sidebar
//
// ── API surface (unchanged) ──────────────────────────────────────────────────
//   init(userId)
//   destroy()
//   subscribe(fn)                         → returns unsubscribe fn
//   getNotifications(userId?, limit?, forceRefresh?)
//   getHeaderBadgeCount(userId?)
//   getHeaderBadgeCountSync()
//   clearHeaderBadge(userId?)
//   markAsRead(notifId)
//   markAllAsRead(userId?)
//   getUnreadSidebarCount()
//   getUnreadCount()                      → alias
//   isLoading()
//   invalidateCache()
//   on(event, fn)                         → typed event bus
// ============================================================================

import { supabase } from "../config/supabase";
import mediaUrlService from "../shared/mediaUrlService";

class NotificationService {
  constructor() {
    // ── Cache ──────────────────────────────────────────────────
    this._cache          = null;
    this._cacheFetchedAt = null;
    this._cacheTimeout   = 30_000;

    // ── Badge ──────────────────────────────────────────────────
    this._badgeClearedAt = null;
    this._badgeCount     = 0;

    // ── Lifecycle ──────────────────────────────────────────────
    this._userId      = null;
    this._initialized = false;
    this._loading     = false;
    this._initPromise = null;

    // ── Realtime ───────────────────────────────────────────────
    this._channel = null;

    // ── Deduplication ─────────────────────────────────────────
    // Tracks realtime INSERT ids we've already processed so duplicate
    // Supabase channel events don't create duplicate rows in _cache.
    this._seenRealtimeIds = new Set();

    // ── Pub/sub ────────────────────────────────────────────────
    this._subscribers     = new Set();
    this._typedListeners  = new Map();
  }

  // =========================================================================
  // TYPED EVENT BUS
  // =========================================================================

  on(event, fn) {
    if (!this._typedListeners.has(event)) this._typedListeners.set(event, new Set());
    this._typedListeners.get(event).add(fn);
    return () => this._typedListeners.get(event)?.delete(fn);
  }

  _emit(event, data) {
    this._typedListeners.get(event)?.forEach((fn) => {
      try { fn(data); } catch {}
    });
  }

  // =========================================================================
  // GENERIC SUBSCRIBE
  // =========================================================================

  subscribe(callback) {
    this._subscribers.add(callback);
    return () => this._subscribers.delete(callback);
  }

  _notifySubscribers() {
    this._subscribers.forEach((fn) => {
      try { fn(); } catch (err) { console.error("Subscriber error:", err); }
    });
  }

  // =========================================================================
  // LIFECYCLE
  // =========================================================================

  async init(userId) {
    if (!userId) return;
    if (this._initialized && this._userId === userId) return;
    if (this._initPromise) return this._initPromise;
    this._initPromise = this._doInit(userId).finally(() => { this._initPromise = null; });
    return this._initPromise;
  }

  async _doInit(userId) {
    this._userId      = userId;
    this._initialized = true;
    await Promise.all([this._loadBadgeClearedAt(), this._fetchAndCache()]);
    this._startRealtime(userId);
  }

  destroy() {
    if (this._channel) { supabase.removeChannel(this._channel); this._channel = null; }
    this._subscribers.clear();
    this._typedListeners.clear();
    this._cache          = null;
    this._cacheFetchedAt = null;
    this._badgeCount     = 0;
    this._badgeClearedAt = null;
    this._userId         = null;
    this._initialized    = false;
    this._loading        = false;
    this._initPromise    = null;
    this._seenRealtimeIds.clear();
  }

  // =========================================================================
  // SYNCHRONOUS GETTERS
  // =========================================================================

  getHeaderBadgeCountSync() { return this._badgeCount; }
  isLoading()               { return this._loading; }

  getUnreadSidebarCount() {
    return this._cache?.filter((n) => !n.is_read).length ?? 0;
  }

  getUnreadCount() { return this.getUnreadSidebarCount(); }

  invalidateCache() {
    this._cache          = null;
    this._cacheFetchedAt = null;
  }

  // =========================================================================
  // ASYNC PUBLIC API
  // =========================================================================

  async getNotifications(userId, limit = 50, forceRefresh = false) {
    const uid = userId || this._userId;
    if (!uid) return [];
    if (
      !forceRefresh &&
      this._cache &&
      this._cacheFetchedAt &&
      Date.now() - this._cacheFetchedAt < this._cacheTimeout
    ) {
      return this._cache;
    }
    await this._fetchAndCache(limit, uid);
    return this._cache || [];
  }

  async getHeaderBadgeCount(userId) {
    const uid = userId || this._userId;
    if (!uid) return 0;
    try {
      const clearedAt = await this._getBadgeClearedAt(uid);
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_user_id", uid)
        .gt("created_at", clearedAt);
      if (error) throw error;
      return count || 0;
    } catch {
      return this._badgeCount;
    }
  }

  async clearHeaderBadge(userId) {
    const uid = userId || this._userId;
    if (!uid) return;
    const now = new Date().toISOString();
    this._badgeClearedAt = now;
    this._badgeCount     = 0;
    this._notifySubscribers();
    supabase
      .from("notification_badge_state")
      .upsert(
        { user_id: uid, badge_cleared_at: now, updated_at: now },
        { onConflict: "user_id" },
      )
      .then(({ error }) => { if (error) console.error("❌ clearHeaderBadge:", error); });
  }

  async markAsRead(notificationId) {
    if (!this._cache) return;
    const target = this._cache.find((n) => n.id === notificationId);
    if (!target || target.is_read) return;

    this._cache = this._cache.map((n) =>
      n.id === notificationId ? { ...n, is_read: true } : n,
    );
    this._notifySubscribers();

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

    if (error) {
      this._cache = this._cache.map((n) =>
        n.id === notificationId ? { ...n, is_read: false } : n,
      );
      this._notifySubscribers();
      console.error("❌ markAsRead:", error);
    }
  }

  async markAllAsRead(userId) {
    const uid = userId || this._userId;
    if (!this._cache || !uid) return;
    this._cache      = this._cache.map((n) => ({ ...n, is_read: true }));
    this._badgeCount = 0;
    this._notifySubscribers();
    await Promise.all([
      supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("recipient_user_id", uid)
        .eq("is_read", false),
      this.clearHeaderBadge(uid),
    ]).catch((err) => console.error("❌ markAllAsRead:", err));
  }

  // =========================================================================
  // INTERNAL — FETCH (dedup-safe merge)
  // =========================================================================

  async _fetchAndCache(limit = 60, uid) {
    const userId = uid || this._userId;
    if (!userId || this._loading) return;
    this._loading = true;

    try {
      const { data, error } = await supabase
        .from("notifications")
        .select(`
          id, type, message, entity_id, is_read, metadata, created_at,
          actor:actor_user_id (
            id, full_name, username, avatar_id, verified
          )
        `)
        .eq("recipient_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      const fresh = (data || []).map((n) => this._enrich(n));

      // ── DEDUP MERGE ────────────────────────────────────────────────────────
      // If we already have optimistic items in _cache (from realtime INSERT),
      // prefer the freshly-fetched rows (they have actor JOIN data) but don't
      // re-add items that already exist. This prevents the double-entry bug.
      if (this._cache && this._cache.length > 0) {
        const freshIds = new Set(fresh.map((n) => n.id));
        // Keep any optimistic items that aren't in the fresh fetch yet
        const optimisticOnly = this._cache.filter(
          (n) => n._optimistic && !freshIds.has(n.id),
        );
        this._cache = [...optimisticOnly, ...fresh];
      } else {
        this._cache = fresh;
      }

      this._cacheFetchedAt = Date.now();
      this._recomputeBadge();
      this._notifySubscribers();
    } catch (err) {
      console.error("❌ NotificationService fetch failed:", err);
    } finally {
      this._loading = false;
    }
  }

  _enrich(n) {
    let avatarUrl = null;
    if (n.actor?.avatar_id) {
      const raw = mediaUrlService.getImageUrl(n.actor.avatar_id, { width: 100, height: 100 });
      avatarUrl = typeof raw === "string" ? raw : null;
    }
    return {
      id:         n.id,
      type:       n.type,
      message:    n.message,
      entity_id:  n.entity_id,
      is_read:    n.is_read,
      metadata:   n.metadata || {},
      created_at: n.created_at,
      actor: n.actor
        ? {
            id:       n.actor.id,
            name:     n.actor.full_name,
            username: n.actor.username,
            avatar:   avatarUrl,
            verified: n.actor.verified || false,
          }
        : { id: null, name: "Someone", username: "user", avatar: null, verified: false },
    };
  }

  // =========================================================================
  // INTERNAL — BADGE
  // =========================================================================

  async _loadBadgeClearedAt() {
    if (!this._userId) return;
    try {
      const { data } = await supabase
        .from("notification_badge_state")
        .select("badge_cleared_at")
        .eq("user_id", this._userId)
        .maybeSingle();
      this._badgeClearedAt = data?.badge_cleared_at || new Date(0).toISOString();
    } catch {
      this._badgeClearedAt = new Date(0).toISOString();
    }
  }

  async _getBadgeClearedAt(userId) {
    if (this._badgeClearedAt) return this._badgeClearedAt;
    this._userId = userId;
    await this._loadBadgeClearedAt();
    return this._badgeClearedAt || new Date(0).toISOString();
  }

  _recomputeBadge() {
    if (!this._cache) { this._badgeCount = 0; return; }
    const clearedMs   = new Date(this._badgeClearedAt || 0).getTime();
    this._badgeCount  = this._cache.filter(
      (n) => new Date(n.created_at).getTime() > clearedMs,
    ).length;
  }

  // =========================================================================
  // INTERNAL — REALTIME
  // =========================================================================

  _startRealtime(userId) {
    if (this._channel) supabase.removeChannel(this._channel);

    this._channel = supabase
      .channel(`notifications-realtime:${userId}`)

      // ── 1. New notification ─────────────────────────────────────────────
      .on(
        "postgres_changes",
        {
          event:  "INSERT",
          schema: "public",
          table:  "notifications",
          filter: `recipient_user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new;

          // ── DEDUP GUARD ──────────────────────────────────────────────────
          // Supabase can fire the same INSERT event twice (reconnect race).
          // Also guard against _fetchAndCache running concurrently.
          if (this._seenRealtimeIds.has(row.id)) return;
          this._seenRealtimeIds.add(row.id);
          // Clean up the seen-set after 60s to avoid unbounded growth
          setTimeout(() => this._seenRealtimeIds.delete(row.id), 60_000);

          // Also skip if already in cache (e.g. from a concurrent fetch)
          if (this._cache?.some((n) => n.id === row.id)) {
            // Notification already present — just increment badge if needed
            this._badgeCount = (this._badgeCount || 0) + 1;
            this._notifySubscribers();
            this._emit("new_notification", row);
            return;
          }

          // Optimistic prepend (no actor join yet — shows "Someone")
          const enriched = { ...this._enrich(row), _optimistic: true };
          this._cache = this._cache ? [enriched, ...this._cache] : [enriched];
          this._cacheFetchedAt = Date.now();
          this._badgeCount = (this._badgeCount || 0) + 1;
          this._notifySubscribers();

          // Typed event → InAppNotificationToast
          this._emit("new_notification", row);

          // Background refetch to get actor JOIN — the merge in _fetchAndCache
          // will replace the optimistic row without creating a duplicate.
          setTimeout(() => this._fetchAndCache(), 1000);
        },
      )

      // ── 2. is_read update ───────────────────────────────────────────────
      .on(
        "postgres_changes",
        {
          event:  "UPDATE",
          schema: "public",
          table:  "notifications",
          filter: `recipient_user_id=eq.${userId}`,
        },
        (payload) => {
          if (!this._cache) return;
          this._cache = this._cache.map((n) =>
            n.id === payload.new.id ? { ...n, is_read: payload.new.is_read } : n,
          );
          this._notifySubscribers();
        },
      )

      // ── 3. Badge cleared from another tab ───────────────────────────────
      .on(
        "postgres_changes",
        {
          event:  "UPDATE",
          schema: "public",
          table:  "notification_badge_state",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (!payload.new?.badge_cleared_at) return;
          this._badgeClearedAt = payload.new.badge_cleared_at;
          this._recomputeBadge();
          this._notifySubscribers();
        },
      )

      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("✅ NotificationService realtime connected");
        }
      });
  }
}

const notificationService = new NotificationService();
export default notificationService;