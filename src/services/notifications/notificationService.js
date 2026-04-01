// ============================================================================
// src/services/notifications/notificationService.js — v6 BULLETPROOF
// ============================================================================
//
// FIXES vs v5:
//   [N-1]  _fetchAndCache is debounced (not hard-dropped when _loading).
//          Two realtime INSERTs within 1 second no longer leave an optimistic
//          item permanently without actor data.
//   [N-2]  Badge recompute uses >= (not >) to avoid clock-skew where a new
//          notification's created_at equals badge_cleared_at to the millisecond.
//   [N-3]  _seenRealtimeIds dedup is applied BEFORE the cache check, so the
//          "already in cache" branch also increments badge correctly only once.
//   [N-4]  markAllAsRead rolls back badge optimistically and restores on error.
//   [N-5]  Double notification fix: realtime INSERT now checks both
//          _seenRealtimeIds AND _cache before deciding to prepend. If the row
//          is already in _cache from a concurrent fetch, we skip the prepend
//          entirely and do not increment the badge a second time.
//   [N-6]  "new_notification" typed event is emitted ONCE per unique row id,
//          guarded by _seenRealtimeIds — so InAppNotificationToast never
//          receives the same notification twice from this service.
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
    // [N-3] Tracks every realtime INSERT id we've processed.
    // Checked FIRST before any cache or badge logic.
    this._seenRealtimeIds = new Set();

    // [N-1] Debounce: pending refetch timer
    this._refetchTimer = null;

    // ── Pub/sub ────────────────────────────────────────────────
    this._subscribers    = new Set();
    this._typedListeners = new Map();
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
      try { fn(data); } catch (e) { console.error("[NotifService] Event handler error:", e); }
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
      try { fn(); } catch (err) { console.error("[NotifService] Subscriber error:", err); }
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
    if (this._channel)     { supabase.removeChannel(this._channel); this._channel = null; }
    if (this._refetchTimer) { clearTimeout(this._refetchTimer); this._refetchTimer = null; }
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
    pushService_clearBadge(); // tell SW to clear Android app badge
    supabase
      .from("notification_badge_state")
      .upsert(
        { user_id: uid, badge_cleared_at: now, updated_at: now },
        { onConflict: "user_id" }
      )
      .then(({ error }) => { if (error) console.error("❌ clearHeaderBadge:", error); });
  }

  async markAsRead(notificationId) {
    if (!this._cache) return;
    const target = this._cache.find((n) => n.id === notificationId);
    if (!target || target.is_read) return;

    this._cache = this._cache.map((n) =>
      n.id === notificationId ? { ...n, is_read: true } : n
    );
    this._notifySubscribers();

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

    if (error) {
      this._cache = this._cache.map((n) =>
        n.id === notificationId ? { ...n, is_read: false } : n
      );
      this._notifySubscribers();
      console.error("❌ markAsRead:", error);
    }
  }

  async markAllAsRead(userId) {
    const uid = userId || this._userId;
    if (!this._cache || !uid) return;

    // Optimistic update
    const prevCache = this._cache;
    const prevBadge = this._badgeCount;
    this._cache      = this._cache.map((n) => ({ ...n, is_read: true }));
    this._badgeCount = 0;
    this._notifySubscribers();

    try {
      await Promise.all([
        supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("recipient_user_id", uid)
          .eq("is_read", false),
        this.clearHeaderBadge(uid),
      ]);
    } catch (err) {
      // [N-4] Rollback on error
      console.error("❌ markAllAsRead:", err);
      this._cache      = prevCache;
      this._badgeCount = prevBadge;
      this._notifySubscribers();
    }
  }

  // =========================================================================
  // INTERNAL — FETCH (debounced, dedup-safe merge)
  // =========================================================================

  // [N-1] Schedule a refetch — debounced so rapid INSERTs don't pile up
  _scheduleFetch(delayMs = 1000) {
    if (this._refetchTimer) clearTimeout(this._refetchTimer);
    this._refetchTimer = setTimeout(() => {
      this._refetchTimer = null;
      this._fetchAndCache();
    }, delayMs);
  }

  async _fetchAndCache(limit = 60, uid) {
    const userId = uid || this._userId;
    if (!userId) return;
    if (this._loading) {
      // Don't hard-drop — schedule a follow-up instead
      this._scheduleFetch(800);
      return;
    }
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
      if (this._cache && this._cache.length > 0) {
        const freshIds     = new Set(fresh.map((n) => n.id));
        const optimisticOnly = this._cache.filter(
          (n) => n._optimistic && !freshIds.has(n.id)
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
    const clearedMs  = new Date(this._badgeClearedAt || 0).getTime();
    // [N-2] Use >= to handle clock-skew edge case
    this._badgeCount = this._cache.filter(
      (n) => new Date(n.created_at).getTime() >= clearedMs
    ).length;
  }

  // =========================================================================
  // INTERNAL — REALTIME
  // =========================================================================

  _startRealtime(userId) {
    if (this._channel) supabase.removeChannel(this._channel);

    this._channel = supabase
      .channel(`notifications-realtime:${userId}`)

      // ── 1. New notification INSERT ────────────────────────────────────────
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

          // [N-3] & [N-6] PRIMARY DEDUP GATE — checked first, before anything else.
          // This is what fixes the "double notification" bug:
          // Supabase realtime can fire the same INSERT event twice on reconnect.
          // The seen-set blocks the second fire entirely.
          if (this._seenRealtimeIds.has(row.id)) return;
          this._seenRealtimeIds.add(row.id);
          setTimeout(() => this._seenRealtimeIds.delete(row.id), 60_000);

          // [N-5] Check if a concurrent _fetchAndCache already added this row
          if (this._cache?.some((n) => n.id === row.id)) {
            // Already in cache from fetch — emit toast event but don't
            // re-prepend or re-increment badge.
            this._emit("new_notification", row);
            return;
          }

          // Optimistic prepend (no actor join yet)
          const enriched = { ...this._enrich(row), _optimistic: true };
          this._cache      = this._cache ? [enriched, ...this._cache] : [enriched];
          this._cacheFetchedAt = Date.now();
          this._badgeCount     = (this._badgeCount || 0) + 1;
          this._notifySubscribers();

          // [N-6] Emit ONCE per unique id — InAppNotificationToast reacts to this
          this._emit("new_notification", row);

          // [N-1] Debounced background refetch to get actor JOIN data
          this._scheduleFetch(1000);
        }
      )

      // ── 2. is_read update ─────────────────────────────────────────────────
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
            n.id === payload.new.id ? { ...n, is_read: payload.new.is_read } : n
          );
          this._notifySubscribers();
        }
      )

      // ── 3. Badge cleared from another tab ──────────────────────────────────
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
        }
      )

      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("✅ NotificationService realtime connected");
        }
      });
  }
}

// Lazy reference to pushService.clearBadge to avoid circular import
function pushService_clearBadge() {
  try {
    navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_BADGE" });
  } catch (_) {}
}

const notificationService = new NotificationService();
export default notificationService;