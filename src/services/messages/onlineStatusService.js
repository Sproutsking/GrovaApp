import { supabase } from "../config/supabase";

/**
 * OnlineStatusService
 * - Sends a heartbeat every 60s to keep the current user marked as online
 * - Listens to realtime presence updates for other users
 * - Caches online status so ChatView / ConversationList can read it instantly
 * - All work happens silently in the background — no UI side-effects here
 */
class OnlineStatusService {
  constructor() {
    this.heartbeatInterval = null;
    this.presenceChannel = null;
    // Map<userId, { online: boolean, lastSeen: Date }>
    this.statusCache = new Map();
    this.listeners = new Set(); // callbacks that want notified on any change
    this.currentUserId = null;
    this.HEARTBEAT_MS = 60000; // 60 seconds
  }

  /**
   * Start the background heartbeat and presence listener.
   * Call once when the authenticated user is known.
   */
  async start(userId) {
    if (!userId || this.currentUserId === userId) return;
    this.stop(); // clean up any previous session
    this.currentUserId = userId;

    // Immediately mark self as online in DB
    await this._updateMyStatus(true);

    // Start periodic heartbeat
    this.heartbeatInterval = setInterval(() => {
      this._updateMyStatus(true);
    }, this.HEARTBEAT_MS);

    // Subscribe to realtime changes on profiles.last_seen
    // We piggy-back on the existing profiles table's last_seen column.
    // Every heartbeat we update last_seen; if last_seen is > 65s ago we treat user as offline.
    this.presenceChannel = supabase
      .channel("online-status-presence")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          // no filter — we listen to all profile updates and cache selectively
        },
        (payload) => {
          this._handleProfileUpdate(payload.new);
        },
      )
      .subscribe();

    // Listen for visibility changes — pause/resume heartbeat
    document.addEventListener("visibilitychange", this._onVisibilityChange);
  }

  /**
   * Stop heartbeat and unsubscribe. Call on logout or unmount.
   */
  async stop() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.presenceChannel) {
      await supabase.removeChannel(this.presenceChannel);
      this.presenceChannel = null;
    }
    document.removeEventListener("visibilitychange", this._onVisibilityChange);
    // Mark self as offline
    if (this.currentUserId) {
      await this._updateMyStatus(false);
    }
  }

  /**
   * Get cached online status for a user.
   * Returns { online: boolean, lastSeen: Date | null }
   * If not in cache, assumes offline.
   */
  getStatus(userId) {
    if (this.statusCache.has(userId)) {
      return this.statusCache.get(userId);
    }
    return { online: false, lastSeen: null };
  }

  /**
   * Fetch fresh status for a specific user from DB (one-off, not cached-only).
   */
  async fetchStatus(userId) {
    if (!userId) return { online: false, lastSeen: null };
    try {
      const { data } = await supabase
        .from("profiles")
        .select("id, last_seen")
        .eq("id", userId)
        .single();

      if (data) {
        const status = this._computeOnlineStatus(data.last_seen);
        this.statusCache.set(userId, status);
        this._notifyListeners(userId, status);
        return status;
      }
    } catch (e) {
      // silent fail
    }
    return { online: false, lastSeen: null };
  }

  /**
   * Subscribe to status changes. Callback receives (userId, { online, lastSeen }).
   * Returns an unsubscribe function.
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // ─── PRIVATE ────────────────────────────────────────────────────────────────

  _onVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      // Tab came back — immediately send a heartbeat
      this._updateMyStatus(true);
      if (!this.heartbeatInterval) {
        this.heartbeatInterval = setInterval(() => {
          this._updateMyStatus(true);
        }, this.HEARTBEAT_MS);
      }
    }
    // We do NOT stop heartbeat on hidden — it keeps running.
    // The server-side staleness check (65s) handles true offline.
  };

  async _updateMyStatus(isOnline) {
    if (!this.currentUserId) return;
    try {
      await supabase
        .from("profiles")
        .update({ last_seen: new Date().toISOString() })
        .eq("id", this.currentUserId);

      // Update own cache
      const status = { online: isOnline, lastSeen: new Date() };
      this.statusCache.set(this.currentUserId, status);
    } catch (e) {
      // silent — heartbeat will retry next cycle
    }
  }

  _handleProfileUpdate(profileRow) {
    if (!profileRow || !profileRow.id) return;
    const status = this._computeOnlineStatus(profileRow.last_seen);
    const prev = this.statusCache.get(profileRow.id);

    // Only update cache + notify if something changed
    if (!prev || prev.online !== status.online) {
      this.statusCache.set(profileRow.id, status);
      this._notifyListeners(profileRow.id, status);
    }
  }

  /**
   * Determine if a user is online based on last_seen timestamp.
   * Threshold: 65 seconds (heartbeat is 60s, so 5s grace).
   */
  _computeOnlineStatus(lastSeen) {
    if (!lastSeen) return { online: false, lastSeen: null };
    const lastSeenDate = new Date(lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - lastSeenDate.getTime();
    const THRESHOLD_MS = 65000; // 65 seconds
    return {
      online: diffMs <= THRESHOLD_MS,
      lastSeen: lastSeenDate,
    };
  }

  _notifyListeners(userId, status) {
    this.listeners.forEach((cb) => {
      try {
        cb(userId, status);
      } catch (e) {
        // ignore listener errors
      }
    });
  }
}

// Singleton
export default new OnlineStatusService();
