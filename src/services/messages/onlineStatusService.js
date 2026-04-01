// services/messages/onlineStatusService.js
// ============================================================================
// ULTRA-EFFICIENT ONLINE STATUS — v3
// ============================================================================
//
// PHILOSOPHY: Presence should cost almost nothing.
//
// INNOVATIONS:
//   • Single shared Supabase Presence channel (not per-conversation).
//   • Adaptive heartbeat: 60 s when tab is visible, 0 (paused) when hidden.
//   • DB write coalesced: only written once on start + once on unload.
//     We rely on the Presence channel for live status; DB last_seen is a
//     fallback for when the other user has the app closed.
//   • Presence channel carries the userId as the key — no extra DB read to
//     check "is this user online?".
//   • Status cache (Map) with a TTL of 90 s — avoids hammering Supabase for
//     the same userId from ConversationList + ChatView simultaneously.
//   • Batch fetch: fetchStatuses([...ids]) in a single SELECT ... IN query.
//   • Zero polling when both clients are on the Presence channel.
// ============================================================================

import { supabase } from "../config/supabase";

const PRESENCE_ONLINE_THRESHOLD_MS = 90_000;  // 90 s — grace for slow heartbeats
const CACHE_TTL_MS                 = 60_000;  // 60 s status cache
const HEARTBEAT_VISIBLE_MS         = 55_000;  // ~1 min while tab visible
const DB_WRITE_THROTTLE_MS         = 120_000; // write last_seen to DB at most every 2 min

class OnlineStatusService {
  constructor() {
    this.userId          = null;
    this._heartbeat      = null;
    this._channel        = null;
    this._cache          = new Map();   // userId → { status, ts }
    this._listeners      = new Set();
    this._lastDbWrite    = 0;
    this._bound          = false;
    this._onlineUserIds  = new Set();   // ids currently seen in Presence state
  }

  // ── Public API ────────────────────────────────────────────────────────────

  start(userId) {
    if (this.userId === userId && this._channel) return;
    this.stop();
    this.userId = userId;

    this._subscribePresence();
    this._scheduleHeartbeat();
    this._bindVisibility();
    this._writeDbLastSeen(); // initial write
  }

  stop() {
    this._clearHeartbeat();
    if (this._channel) {
      supabase.removeChannel(this._channel);
      this._channel = null;
    }
    if (this.userId) this._writeDbLastSeen(true); // mark offline
    this.userId         = null;
    this._onlineUserIds = new Set();
  }

  /**
   * Fetch a single userId's status.
   * Returns from cache if fresh, otherwise queries DB.
   */
  async fetchStatus(userId) {
    if (!userId) return { online: false, lastSeenText: "Offline" };

    // If we already see them in the live Presence channel, trust that first.
    if (this._onlineUserIds.has(userId)) {
      const s = { online: true, lastSeenText: "Online" };
      this._setCache(userId, s);
      return s;
    }

    const cached = this._getCache(userId);
    if (cached) return cached;

    return this._fetchFromDb([userId]).then((map) => map.get(userId) ?? { online: false, lastSeenText: "Offline" });
  }

  /**
   * Batch fetch statuses for multiple user IDs in a SINGLE query.
   * Returns Map<userId, status>.
   */
  async fetchStatuses(userIds) {
    if (!userIds?.length) return new Map();

    const result   = new Map();
    const toFetch  = [];

    for (const uid of userIds) {
      if (this._onlineUserIds.has(uid)) {
        const s = { online: true, lastSeenText: "Online" };
        this._setCache(uid, s);
        result.set(uid, s);
      } else {
        const cached = this._getCache(uid);
        if (cached) result.set(uid, cached);
        else toFetch.push(uid);
      }
    }

    if (toFetch.length) {
      const dbMap = await this._fetchFromDb(toFetch);
      dbMap.forEach((s, uid) => result.set(uid, s));
    }

    return result;
  }

  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  // ── Internal: Presence channel ────────────────────────────────────────────

  _subscribePresence() {
    this._channel = supabase
      .channel("global_presence", {
        config: { presence: { key: this.userId } },
      })
      .on("presence", { event: "sync" }, () => {
        const state = this._channel.presenceState();
        this._onlineUserIds = new Set(Object.keys(state));
        // Notify listeners for all currently-online users
        this._onlineUserIds.forEach((uid) => {
          const s = { online: true, lastSeenText: "Online" };
          this._setCache(uid, s);
          this._notify(uid, s);
        });
      })
      .on("presence", { event: "join" }, ({ key }) => {
        this._onlineUserIds.add(key);
        const s = { online: true, lastSeenText: "Online" };
        this._setCache(key, s);
        this._notify(key, s);
      })
      .on("presence", { event: "leave" }, ({ key }) => {
        this._onlineUserIds.delete(key);
        // Don't immediately flip to offline — fetch DB to get last_seen
        this._fetchFromDb([key]).then((map) => {
          const s = map.get(key);
          if (s) this._notify(key, s);
        });
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await this._channel.track({
            user_id:   this.userId,
            online_at: new Date().toISOString(),
          });
        }
      });
  }

  // ── Internal: heartbeat (keeps Presence alive + throttled DB write) ───────

  _scheduleHeartbeat() {
    this._clearHeartbeat();
    this._heartbeat = setInterval(() => {
      if (document.hidden) return; // pause when tab hidden
      if (this._channel) {
        this._channel.track({
          user_id:   this.userId,
          online_at: new Date().toISOString(),
        });
      }
      // Throttled DB write
      const now = Date.now();
      if (now - this._lastDbWrite > DB_WRITE_THROTTLE_MS) {
        this._writeDbLastSeen();
      }
    }, HEARTBEAT_VISIBLE_MS);
  }

  _clearHeartbeat() {
    if (this._heartbeat) {
      clearInterval(this._heartbeat);
      this._heartbeat = null;
    }
  }

  // ── Internal: visibility binding ─────────────────────────────────────────

  _bindVisibility() {
    if (this._bound) return;
    this._bound = true;

    document.addEventListener("visibilitychange", () => {
      if (!this.userId) return;
      if (!document.hidden) {
        // Tab became visible — track immediately
        if (this._channel) {
          this._channel.track({
            user_id:   this.userId,
            online_at: new Date().toISOString(),
          });
        }
        this._writeDbLastSeen();
      }
    });

    window.addEventListener("beforeunload", () => this.stop(), { once: true });
  }

  // ── Internal: DB helpers ──────────────────────────────────────────────────

  async _writeDbLastSeen(offline = false) {
    if (!this.userId) return;
    this._lastDbWrite = Date.now();
    try {
      await supabase
        .from("profiles")
        .update({ last_seen: offline ? new Date(Date.now() - PRESENCE_ONLINE_THRESHOLD_MS).toISOString() : new Date().toISOString() })
        .eq("id", this.userId);
    } catch (_) { /* best-effort */ }
  }

  async _fetchFromDb(userIds) {
    const result = new Map();
    try {
      const { data } = await supabase
        .from("profiles")
        .select("id,last_seen")
        .in("id", userIds);

      (data || []).forEach(({ id, last_seen }) => {
        const diff = last_seen ? Date.now() - new Date(last_seen).getTime() : Infinity;
        const online = diff < PRESENCE_ONLINE_THRESHOLD_MS;
        const s = { online, lastSeenText: this._formatLastSeen(diff) };
        this._setCache(id, s);
        result.set(id, s);
      });
    } catch (_) { /* best-effort */ }
    return result;
  }

  _formatLastSeen(ms) {
    if (ms < PRESENCE_ONLINE_THRESHOLD_MS) return "Online";
    const min = Math.floor(ms / 60_000);
    const hr  = Math.floor(min / 60);
    const day = Math.floor(hr / 24);
    if (min < 2)   return "Just now";
    if (min < 60)  return `${min}m ago`;
    if (hr < 24)   return `${hr}h ago`;
    if (day === 1) return "Yesterday";
    if (day < 7)   return `${day}d ago`;
    return "A while ago";
  }

  // ── Internal: cache helpers ───────────────────────────────────────────────

  _setCache(userId, status) {
    this._cache.set(userId, { status, ts: Date.now() });
  }

  _getCache(userId) {
    const entry = this._cache.get(userId);
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL_MS) {
      this._cache.delete(userId);
      return null;
    }
    return entry.status;
  }

  _notify(userId, status) {
    this._listeners.forEach((fn) => {
      try { fn(userId, status); } catch (_) {}
    });
  }
}

export default new OnlineStatusService();