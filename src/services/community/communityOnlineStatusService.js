// services/community/communityOnlineStatusService.js
import { supabase } from "../config/supabase";

class CommunityOnlineStatusService {
  constructor() {
    this.userId = null;
    this.communityId = null;
    this.heartbeat = null;
    this.channel = null;
    this.cache = new Map();
    this.listeners = new Set();
  }

  start(userId, communityId) {
    const key = `${userId}_${communityId}`;
    if (this.userId === userId && this.communityId === communityId) return;

    this.stop();

    this.userId = userId;
    this.communityId = communityId;
    this.updatePresence();

    // Update presence every 30 seconds
    this.heartbeat = setInterval(() => this.updatePresence(), 30000);

    // Subscribe to presence channel for this community
    this.channel = supabase
      .channel(`community:${communityId}:presence`)
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
            community_id: this.communityId,
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

    if (this.userId && this.communityId) {
      this.updatePresence(false);
      this.userId = null;
      this.communityId = null;
    }
  }

  async updatePresence(isOnline = true) {
    if (!this.userId || !this.communityId) return;

    try {
      await supabase
        .from("community_members")
        .update({
          is_online: isOnline,
          last_seen: new Date().toISOString(),
        })
        .eq("user_id", this.userId)
        .eq("community_id", this.communityId);
    } catch (error) {
      console.error("Update presence error:", error);
    }
  }

  async fetchStatus(userId) {
    if (!this.communityId) return { online: false, lastSeenText: "Offline" };

    try {
      const { data } = await supabase
        .from("community_members")
        .select("is_online, last_seen")
        .eq("user_id", userId)
        .eq("community_id", this.communityId)
        .single();

      if (!data) return { online: false, lastSeenText: "Offline" };

      // Check if last_seen is within 2 minutes
      const diff = Date.now() - new Date(data.last_seen);
      const online = data.is_online && diff < 120000;
      const lastSeenText = this.formatLastSeen(diff);

      const status = { online, lastSeenText };
      this.cache.set(userId, status);
      this.notify(userId, status);

      return status;
    } catch (error) {
      return { online: false, lastSeenText: "Offline" };
    }
  }

  async fetchMemberStatuses(memberIds) {
    if (!this.communityId || !memberIds.length) return {};

    try {
      const { data } = await supabase
        .from("community_members")
        .select("user_id, is_online, last_seen")
        .eq("community_id", this.communityId)
        .in("user_id", memberIds);

      const statuses = {};
      const now = Date.now();

      (data || []).forEach((member) => {
        const diff = now - new Date(member.last_seen);
        const online = member.is_online && diff < 120000;
        const lastSeenText = this.formatLastSeen(diff);

        statuses[member.user_id] = { online, lastSeenText };
        this.cache.set(member.user_id, { online, lastSeenText });
      });

      return statuses;
    } catch (error) {
      console.error("Error fetching member statuses:", error);
      return {};
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

  getStatus(userId) {
    return this.cache.get(userId) || { online: false, lastSeenText: "Offline" };
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(userId, status) {
    this.cache.set(userId, status);
    this.listeners.forEach((fn) => {
      try {
        fn(userId, status);
      } catch (e) {
        console.error("Listener error:", e);
      }
    });
  }

  clearCache() {
    this.cache.clear();
  }
}

export default new CommunityOnlineStatusService();
