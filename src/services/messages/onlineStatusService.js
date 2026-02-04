// services/messages/onlineStatusService.js
import { supabase } from "../config/supabase";

class OnlineStatusService {
  constructor() {
    this.userId = null;
    this.heartbeat = null;
    this.channel = null;
    this.cache = new Map();
    this.listeners = new Set();
  }

  start(userId) {
    if (this.userId === userId) return;
    this.stop();

    this.userId = userId;
    this.updatePresence();

    this.heartbeat = setInterval(() => this.updatePresence(), 30000);

    this.channel = supabase
      .channel("presence")
      .on("presence", { event: "sync" }, () => {
        const state = this.channel.presenceState();
        Object.keys(state).forEach((uid) => {
          this.notify(uid, { online: true, lastSeenText: "Online" });
        });
      })
      .on("presence", { event: "join" }, ({ key }) => {
        this.notify(key, { online: true, lastSeenText: "Online" });
      })
      .on("presence", { event: "leave" }, ({ key }) => {
        this.fetchStatus(key);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await this.channel.track({
            user_id: this.userId,
            online_at: new Date().toISOString(),
          });
        }
      });

    window.addEventListener("beforeunload", () => this.stop());
    document.addEventListener("visibilitychange", () => this.updatePresence());
  }

  stop() {
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }

    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }

    if (this.userId) {
      this.updatePresence();
      this.userId = null;
    }
  }

  async updatePresence() {
    if (!this.userId) return;

    try {
      await supabase
        .from("profiles")
        .update({ last_seen: new Date().toISOString() })
        .eq("id", this.userId);
    } catch (error) {
      console.error("Update presence error:", error);
    }
  }

  async fetchStatus(userId) {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("last_seen")
        .eq("id", userId)
        .single();

      if (!data) return { online: false, lastSeenText: "Offline" };

      const diff = Date.now() - new Date(data.last_seen);
      const online = diff < 120000;
      const lastSeenText = this.formatLastSeen(diff);

      const status = { online, lastSeenText };
      this.cache.set(userId, status);
      this.notify(userId, status);

      return status;
    } catch (error) {
      return { online: false, lastSeenText: "Offline" };
    }
  }

  formatLastSeen(ms) {
    const sec = Math.floor(ms / 1000);
    const min = Math.floor(sec / 60);
    const hr = Math.floor(min / 60);
    const day = Math.floor(hr / 24);

    if (sec < 120) return "Online";
    if (min === 1) return "Last seen 1 min ago";
    if (min < 60) return `Last seen ${min} mins ago`;
    if (hr === 1) return "Last seen 1 hour ago";
    if (hr < 24) return `Last seen ${hr} hours ago`;
    if (day === 1) return "Last seen yesterday";
    if (day < 7) return `Last seen ${day} days ago`;
    return "Last seen a while ago";
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(userId, status) {
    this.cache.set(userId, status);
    this.listeners.forEach((fn) => fn(userId, status));
  }
}

export default new OnlineStatusService();