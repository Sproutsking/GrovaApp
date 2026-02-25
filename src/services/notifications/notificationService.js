// ============================================================================
// src/services/notifications/notificationService.js
// ============================================================================
// SINGLE SOURCE OF TRUTH for all notification state.
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
// ── API surface (matches production service exactly) ─────────────────────────
//   init(userId)                          → lifecycle start
//   destroy()                             → lifecycle stop
//   subscribe(fn)                         → returns unsubscribe fn
//   getNotifications(userId?, limit?, forceRefresh?) → async Array
//   getHeaderBadgeCount(userId?)          → async number  (DB-authoritative)
//   getHeaderBadgeCountSync()             → number        (in-memory fast path)
//   clearHeaderBadge(userId?)             → async
//   markAsRead(notifId)                   → async
//   markAllAsRead(userId?)                → async
//   getUnreadSidebarCount()               → number (count of is_read=false)
//   getUnreadCount()                      → alias for getUnreadSidebarCount
//   isLoading()                           → boolean
//   invalidateCache()                     → void
//   on(event, fn)                         → typed event bus (returns unsub)
//
// ── Design principles ────────────────────────────────────────────────────────
//   • Singleton — one instance, imported everywhere
//   • subscribe() for generic "something changed" UI re-renders
//   • on("new_notification", fn) for specific event routing (toast)
//   • Optimistic updates — UI instant, DB follows, rollback on error
//   • Single Supabase channel — notifications + badge_state
//   • 30s rolling cache — fast returns, no redundant DB hits
//   • Deduplicates concurrent init() calls via _initPromise
//   • _badgeCount computed in-memory for synchronous reads by headers
//   • _enrich() uses mediaUrlService for avatar URLs (consistent with app)
// ============================================================================

import { supabase } from "../config/supabase";
import mediaUrlService from "../shared/mediaUrlService";

class NotificationService {
  constructor() {
    // ── Cache ──────────────────────────────────────────────────
    this._cache = null; // Array<Notification> | null
    this._cacheFetchedAt = null; // timestamp ms
    this._cacheTimeout = 30_000; // 30s rolling cache

    // ── Badge ──────────────────────────────────────────────────
    this._badgeClearedAt = null; // ISO string (mirrors DB)
    this._badgeCount = 0; // computed in-memory for sync reads

    // ── Lifecycle ──────────────────────────────────────────────
    this._userId = null;
    this._initialized = false;
    this._loading = false;
    this._initPromise = null; // dedup concurrent init() calls

    // ── Realtime ───────────────────────────────────────────────
    this._channel = null; // single combined Supabase channel

    // ── Pub/sub ────────────────────────────────────────────────
    this._subscribers = new Set(); // generic "change" listeners
    this._typedListeners = new Map(); // typed event bus
  }

  // =========================================================================
  // TYPED EVENT BUS
  // on("new_notification", fn)  — consumed by InAppNotificationToast
  // on("push_received", fn)     — consumed by InAppNotificationToast
  // =========================================================================

  on(event, fn) {
    if (!this._typedListeners.has(event))
      this._typedListeners.set(event, new Set());
    this._typedListeners.get(event).add(fn);
    return () => this._typedListeners.get(event)?.delete(fn);
  }

  _emit(event, data) {
    this._typedListeners.get(event)?.forEach((fn) => {
      try {
        fn(data);
      } catch {}
    });
  }

  // =========================================================================
  // GENERIC SUBSCRIBE — all UI components use this
  // Returns an unsubscribe function.
  // =========================================================================

  subscribe(callback) {
    this._subscribers.add(callback);
    return () => this._subscribers.delete(callback);
  }

  _notifySubscribers() {
    this._subscribers.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.error("Subscriber error:", err);
      }
    });
  }

  // =========================================================================
  // LIFECYCLE
  // =========================================================================

  /**
   * Initialize for a user. Idempotent — safe to call multiple times.
   * Deduplicates concurrent calls (e.g. both headers mounting simultaneously).
   */
  async init(userId) {
    if (!userId) return;
    if (this._initialized && this._userId === userId) return;
    if (this._initPromise) return this._initPromise;

    this._initPromise = this._doInit(userId).finally(() => {
      this._initPromise = null;
    });
    return this._initPromise;
  }

  async _doInit(userId) {
    this._userId = userId;
    this._initialized = true;

    // Parallel: badge state + notifications
    await Promise.all([this._loadBadgeClearedAt(), this._fetchAndCache()]);

    this._startRealtime(userId);
  }

  /**
   * Tear down — call on sign-out.
   */
  destroy() {
    if (this._channel) {
      supabase.removeChannel(this._channel);
      this._channel = null;
    }
    this._subscribers.clear();
    this._typedListeners.clear();
    this._cache = null;
    this._cacheFetchedAt = null;
    this._badgeCount = 0;
    this._badgeClearedAt = null;
    this._userId = null;
    this._initialized = false;
    this._loading = false;
    this._initPromise = null;
  }

  // =========================================================================
  // PUBLIC GETTERS (synchronous — for headers / render paths)
  // =========================================================================

  /**
   * Synchronous badge count — computed in-memory.
   * Used by DesktopHeader / MobileHeader subscribe callbacks.
   */
  getHeaderBadgeCountSync() {
    return this._badgeCount;
  }

  /**
   * Whether initial fetch is in progress.
   */
  isLoading() {
    return this._loading;
  }

  /**
   * Count of sidebar unread dots (is_read === false).
   */
  getUnreadSidebarCount() {
    return this._cache?.filter((n) => !n.is_read).length ?? 0;
  }

  /** Alias kept for backward compatibility. */
  getUnreadCount() {
    return this.getUnreadSidebarCount();
  }

  /**
   * Invalidate cache — forces next getNotifications() to hit DB.
   */
  invalidateCache() {
    this._cache = null;
    this._cacheFetchedAt = null;
  }

  // =========================================================================
  // ASYNC PUBLIC API (match real service signatures exactly)
  // =========================================================================

  /**
   * Fetch notifications for a user.
   * Returns cached data if within cacheTimeout unless forceRefresh=true.
   *
   * @param {string}  [userId]       defaults to this._userId
   * @param {number}  [limit=50]
   * @param {boolean} [forceRefresh=false]
   * @returns {Promise<Array>}
   */
  async getNotifications(userId, limit = 50, forceRefresh = false) {
    const uid = userId || this._userId;
    if (!uid) return [];

    // Serve from cache if still fresh
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

  /**
   * DB-authoritative header badge count.
   * Queries the DB for notifications after badge_cleared_at.
   * Use getHeaderBadgeCountSync() for synchronous reads in UI.
   *
   * @param {string} [userId]
   * @returns {Promise<number>}
   */
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
    } catch (err) {
      console.error("❌ getHeaderBadgeCount:", err);
      return this._badgeCount; // fall back to in-memory
    }
  }

  /**
   * Called when NotificationSidebar OPENS.
   * Optimistically resets header badge in-memory (UI instant),
   * then persists to DB non-blocking.
   * Does NOT touch is_read — sidebar dots are independent.
   *
   * @param {string} [userId]
   */
  async clearHeaderBadge(userId) {
    const uid = userId || this._userId;
    if (!uid) return;

    // Optimistic — headers see 0 instantly via subscribe()
    const now = new Date().toISOString();
    this._badgeClearedAt = now;
    this._badgeCount = 0;
    this._notifySubscribers();

    // Persist non-blocking
    supabase
      .from("notification_badge_state")
      .upsert(
        { user_id: uid, badge_cleared_at: now, updated_at: now },
        { onConflict: "user_id" },
      )
      .then(({ error }) => {
        if (error) console.error("❌ clearHeaderBadge:", error);
      });
  }

  /**
   * Mark a single notification as read (removes sidebar unread dot).
   * Optimistic with rollback on DB error.
   *
   * @param {string} notificationId
   */
  async markAsRead(notificationId) {
    if (!this._cache) return;
    const target = this._cache.find((n) => n.id === notificationId);
    if (!target || target.is_read) return; // already read — skip DB call

    // Optimistic
    this._cache = this._cache.map((n) =>
      n.id === notificationId ? { ...n, is_read: true } : n,
    );
    this._notifySubscribers();

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

    if (error) {
      // Rollback
      this._cache = this._cache.map((n) =>
        n.id === notificationId ? { ...n, is_read: false } : n,
      );
      this._notifySubscribers();
      console.error("❌ markAsRead:", error);
    }
  }

  /**
   * Mark ALL as read + clear header badge simultaneously.
   * Optimistic with single DB call per operation.
   *
   * @param {string} [userId]
   */
  async markAllAsRead(userId) {
    const uid = userId || this._userId;
    if (!this._cache || !uid) return;

    // Optimistic
    this._cache = this._cache.map((n) => ({ ...n, is_read: true }));
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
  // INTERNAL — FETCH
  // =========================================================================

  async _fetchAndCache(limit = 60, uid) {
    const userId = uid || this._userId;
    if (!userId || this._loading) return;
    this._loading = true;

    try {
      const { data, error } = await supabase
        .from("notifications")
        .select(
          `
          id, type, message, entity_id, is_read, metadata, created_at,
          actor:actor_user_id (
            id, full_name, username, avatar_id, verified
          )
        `,
        )
        .eq("recipient_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      this._cache = (data || []).map((n) => this._enrich(n));
      this._cacheFetchedAt = Date.now();
      this._recomputeBadge();
      this._notifySubscribers();
    } catch (err) {
      console.error("❌ NotificationService fetch failed:", err);
    } finally {
      this._loading = false;
    }
  }

  /**
   * Enrich a raw DB row into a consistent notification object.
   * Method name matches real service for zero confusion.
   */
  _enrich(n) {
    let avatarUrl = null;
    if (n.actor?.avatar_id) {
      const raw = mediaUrlService.getImageUrl(n.actor.avatar_id, {
        width: 100,
        height: 100,
      });
      avatarUrl = typeof raw === "string" ? raw : null;
    }

    return {
      id: n.id,
      type: n.type,
      message: n.message,
      entity_id: n.entity_id,
      is_read: n.is_read,
      metadata: n.metadata || {},
      created_at: n.created_at,
      actor: n.actor
        ? {
            id: n.actor.id,
            name: n.actor.full_name,
            username: n.actor.username,
            avatar: avatarUrl,
            verified: n.actor.verified || false,
          }
        : {
            id: null,
            name: "Someone",
            username: "user",
            avatar: null,
            verified: false,
          },
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
      // Default to epoch so ALL existing notifications count if never cleared
      this._badgeClearedAt =
        data?.badge_cleared_at || new Date(0).toISOString();
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

  /**
   * Recompute _badgeCount from cache + _badgeClearedAt.
   * Called after every fetch and after badge cleared.
   */
  _recomputeBadge() {
    if (!this._cache) {
      this._badgeCount = 0;
      return;
    }
    const clearedMs = new Date(this._badgeClearedAt || 0).getTime();
    this._badgeCount = this._cache.filter(
      (n) => new Date(n.created_at).getTime() > clearedMs,
    ).length;
  }

  // =========================================================================
  // INTERNAL — REALTIME
  // Single channel, three event listeners (notifications + badge_state)
  // =========================================================================

  _startRealtime(userId) {
    if (this._channel) supabase.removeChannel(this._channel);

    this._channel = supabase
      .channel(`notifications-realtime:${userId}`)

      // 1. New notification arrives
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_user_id=eq.${userId}`,
        },
        (payload) => {
          // Prepend to cache immediately (no actor join — show optimistically)
          const enriched = this._enrich(payload.new);
          if (this._cache) {
            this._cache = [enriched, ...this._cache];
          } else {
            this._cache = [enriched];
          }
          this._cacheFetchedAt = Date.now();
          // Increment badge
          this._badgeCount = (this._badgeCount || 0) + 1;
          this._notifySubscribers();
          // Fire typed event → InAppNotificationToast can also react
          this._emit("new_notification", payload.new);
          // Re-fetch in background to get actor JOIN
          setTimeout(() => this._fetchAndCache(), 800);
        },
      )

      // 2. is_read updated (from another tab / markAllAsRead)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `recipient_user_id=eq.${userId}`,
        },
        (payload) => {
          if (!this._cache) return;
          this._cache = this._cache.map((n) =>
            n.id === payload.new.id
              ? { ...n, is_read: payload.new.is_read }
              : n,
          );
          this._notifySubscribers();
        },
      )

      // 3. Badge cleared from another tab / device
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notification_badge_state",
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

// Singleton
const notificationService = new NotificationService();
export default notificationService;
