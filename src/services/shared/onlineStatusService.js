import { supabase } from "../config/supabase";

/**
 * OnlineStatusService
 * - Sends a heartbeat every 60s updating last_seen on profiles
 * - Provides a helper to check if a user is "online" (last_seen within 65s)
 * - Subscribes to real-time changes on profiles.last_seen so the UI updates silently
 */
class OnlineStatusService {
  constructor() {
    this.heartbeatInterval = null;
    this.userId = null;
    this.listeners = new Map(); // targetUserId -> Set<callback>
    this.channel = null;
  }

  /**
   * Start the heartbeat loop for the current logged-in user.
   * Call this once on app mount after auth is confirmed.
   */
  start(userId) {
    if (!userId || this.userId === userId) return;
    this.stop(); // clear any previous
    this.userId = userId;

    // Immediate ping so we register right away
    this._ping();

    // Every 60 seconds
    this.heartbeatInterval = setInterval(() => this._ping(), 60000);
  }

  /**
   * Stop the heartbeat (e.g. on logout)
   */
  stop() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.userId = null;
  }

  /**
   * Internal: update last_seen to now
   */
  async _ping() {
    if (!this.userId) return;
    try {
      await supabase
        .from("profiles")
        .update({ last_seen: new Date().toISOString() })
        .eq("id", this.userId);
    } catch (e) {
      // silent fail — network blip is fine
    }
  }

  /**
   * Returns true if the given last_seen timestamp is within 65 seconds of now.
   * 65s gives a small grace window beyond the 60s heartbeat.
   */
  static isOnline(lastSeen) {
    if (!lastSeen) return false;
    return Date.now() - new Date(lastSeen).getTime() < 65000;
  }

  /**
   * Subscribe to real-time last_seen changes for a specific user.
   * callback receives the new last_seen string.
   * Returns an unsubscribe function.
   */
  watchUser(targetUserId, callback) {
    if (!targetUserId || typeof callback !== "function") return () => {};

    // Register listener
    if (!this.listeners.has(targetUserId)) {
      this.listeners.set(targetUserId, new Set());
    }
    this.listeners.get(targetUserId).add(callback);

    // Ensure we have a realtime channel open (one channel for all watchers)
    this._ensureChannel();

    // Return unsubscribe
    return () => {
      const set = this.listeners.get(targetUserId);
      if (set) {
        set.delete(callback);
        if (set.size === 0) this.listeners.delete(targetUserId);
      }
    };
  }

  _ensureChannel() {
    if (this.channel) return;

    this.channel = supabase
      .channel("online-status-watch")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          // We filter client-side since we may watch multiple users
        },
        (payload) => {
          if (!payload?.new) return;
          const uid = payload.new.id;
          const lastSeen = payload.new.last_seen;
          const set = this.listeners.get(uid);
          if (set) {
            set.forEach((cb) => cb(lastSeen));
          }
        },
      )
      .subscribe();
  }

  /**
   * Fetch the current last_seen for a user (cold check, no subscription)
   */
  async getLastSeen(targetUserId) {
    if (!targetUserId) return null;
    try {
      const { data } = await supabase
        .from("profiles")
        .select("last_seen")
        .eq("id", targetUserId)
        .single();
      return data?.last_seen || null;
    } catch {
      return null;
    }
  }

  /**
   * Cleanup everything (call on app unmount or logout)
   */
  destroy() {
    this.stop();
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.listeners.clear();
  }
}

export default new OnlineStatusService();
