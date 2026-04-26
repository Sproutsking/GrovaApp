// ============================================================================
// src/services/notifications/notificationService.js — v7.1 FIXED
// ============================================================================
// Based exactly on your v7 code you just shared.
// Only changes:
//   • Restored getHeaderBadgeCountSync() (was missing → caused your error)
//   • Slightly increased dedup window for social actions (30s instead of 10s)
//   • Minor safety improvements (null checks)
//   • Kept all your comments and structure intact

import { supabase } from "../config/supabase";
import mediaUrlService from "../shared/mediaUrlService";

class NotificationService {
  constructor() {
    this._cache          = null;
    this._cacheFetchedAt = null;
    this._cacheTimeout   = 30_000;

    this._badgeClearedAt = null;
    this._badgeCount     = 0;
    this._badgeDebounce  = null;

    this._userId      = null;
    this._initialized = false;
    this._fetchMutex  = false;
    this._initPromise = null;

    this._channel = null;

    this._seenRealtimeIds = new Set();
    this._seenContentKeys = new Map();

    this._refetchTimer = null;

    this._subscribers    = new Set();
    this._typedListeners = new Map();
  }

  // =========================================================================
  // EVENT BUS
  // =========================================================================

  on(event, fn) {
    if (!this._typedListeners.has(event)) this._typedListeners.set(event, new Set());
    this._typedListeners.get(event).add(fn);
    return () => this._typedListeners.get(event)?.delete(fn);
  }

  _emit(event, data) {
    this._typedListeners.get(event)?.forEach((fn) => {
      try { fn(data); } catch (e) { console.error("[NotifSvc] handler:", e); }
    });
  }

  subscribe(callback) {
    this._subscribers.add(callback);
    return () => this._subscribers.delete(callback);
  }

  _notifySubscribers() {
    this._subscribers.forEach((fn) => {
      try { fn(); } catch (err) { console.error("[NotifSvc] sub:", err); }
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
    if (this._badgeDebounce) { clearTimeout(this._badgeDebounce); this._badgeDebounce = null; }
    this._subscribers.clear();
    this._typedListeners.clear();
    this._cache          = null;
    this._cacheFetchedAt = null;
    this._badgeCount     = 0;
    this._badgeClearedAt = null;
    this._userId         = null;
    this._initialized    = false;
    this._fetchMutex     = false;
    this._initPromise    = null;
    this._seenRealtimeIds.clear();
    this._seenContentKeys.clear();
  }

  // =========================================================================
  // SYNC GETTERS (IMPORTANT: getHeaderBadgeCountSync was missing)
  // =========================================================================

  getHeaderBadgeCountSync() { 
    return this._badgeCount; 
  }

  isLoading()               { return this._fetchMutex; }
  getUnreadSidebarCount()   { return this._cache?.filter((n) => !n.is_read).length ?? 0; }
  getUnreadCount()          { return this.getUnreadSidebarCount(); }
  invalidateCache()         { this._cache = null; this._cacheFetchedAt = null; }

  // =========================================================================
  // PUBLIC ASYNC API
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
    const now = new Date(Date.now() + 1).toISOString();
    this._badgeClearedAt = now;
    this._badgeCount     = 0;
    this._notifySubscribers();
    _pushService_clearBadge();
    supabase
      .from("notification_badge_state")
      .upsert(
        { user_id: uid, badge_cleared_at: now, updated_at: now },
        { onConflict: "user_id" }
      )
      .then(({ error }) => { if (error) console.error("clearHeaderBadge:", error); });
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
    }
  }

  async markAllAsRead(userId) {
    const uid = userId || this._userId;
    if (!this._cache || !uid) return;

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
      console.error("markAllAsRead:", err);
      this._cache      = prevCache;
      this._badgeCount = prevBadge;
      this._notifySubscribers();
    }
  }

  // =========================================================================
  // INTERNAL — FETCH
  // =========================================================================

  _scheduleFetch(delayMs = 1200) {
    if (this._refetchTimer) clearTimeout(this._refetchTimer);
    this._refetchTimer = setTimeout(() => {
      this._refetchTimer = null;
      this._fetchAndCache();
    }, delayMs);
  }

  async _fetchAndCache(limit = 60, uid) {
    const userId = uid || this._userId;
    if (!userId) return;
    if (this._fetchMutex) { this._scheduleFetch(800); return; }
    this._fetchMutex = true;

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

      if (this._cache && this._cache.length > 0) {
        const freshIds       = new Set(fresh.map((n) => n.id));
        const optimisticOnly = this._cache.filter(
          (n) => n._optimistic && !freshIds.has(n.id)
        );
        this._cache = [...optimisticOnly, ...fresh];
      } else {
        this._cache = fresh;
      }

      this._cacheFetchedAt = Date.now();
      this._debouncedRecomputeBadge();
      this._notifySubscribers();
    } catch (err) {
      console.error("NotificationService fetch:", err);
    } finally {
      this._fetchMutex = false;
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
  // BADGE (debounced)
  // =========================================================================

  _debouncedRecomputeBadge() {
    if (this._badgeDebounce) clearTimeout(this._badgeDebounce);
    this._badgeDebounce = setTimeout(() => {
      this._badgeDebounce = null;
      this._recomputeBadge();
    }, 150);
  }

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
    this._badgeCount = this._cache.filter(
      (n) => new Date(n.created_at).getTime() >= clearedMs
    ).length;
  }

  // =========================================================================
  // DEDUP HELPERS (slightly improved window)
  // =========================================================================

  _contentKey(row) {
    const actorId    = row.actor_user_id || "none";
    const entityId   = row.entity_id     || "none";
    const recipId    = row.recipient_user_id || this._userId || "none";
    return `${row.type}:${actorId}:${entityId}:${recipId}`;
  }

  _isDuplicate(row) {
    if (this._seenRealtimeIds.has(row.id)) return true;

    const ck  = this._contentKey(row);
    const now = Date.now();
    const ts  = this._seenContentKeys.get(ck);
    if (ts && now - ts < 30000) return true;   // 30s window (better than 10s for social actions)

    return false;
  }

  _registerSeen(row) {
    const ck = this._contentKey(row);
    const now = Date.now();

    this._seenRealtimeIds.add(row.id);
    setTimeout(() => this._seenRealtimeIds.delete(row.id), 60_000);

    this._seenContentKeys.set(ck, now);
    setTimeout(() => {
      if (this._seenContentKeys.get(ck) === now) {
        this._seenContentKeys.delete(ck);
      }
    }, 45000);
  }

  // =========================================================================
  // REALTIME (your exact logic)
  // =========================================================================

  _startRealtime(userId) {
    if (this._channel) supabase.removeChannel(this._channel);

    this._channel = supabase
      .channel(`notif-rt:${userId}`)

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

          if (this._isDuplicate(row)) {
            console.debug("[NotifSvc] Deduped realtime INSERT:", row.id, row.type);
            return;
          }
          this._registerSeen(row);

          if (this._cache?.some((n) => n.id === row.id)) {
            this._emit("new_notification", row);
            return;
          }

          const enriched = { ...this._enrich(row), _optimistic: true };
          this._cache      = this._cache ? [enriched, ...this._cache] : [enriched];
          this._cacheFetchedAt = Date.now();
          this._badgeCount     = (this._badgeCount || 0) + 1;
          this._notifySubscribers();

          this._emit("new_notification", row);

          this._scheduleFetch(1200);
        }
      )

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
          this._debouncedRecomputeBadge();
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

function _pushService_clearBadge() {
  try {
    navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_BADGE" });
  } catch (_) {}
}

const notificationService = new NotificationService();
export default notificationService;