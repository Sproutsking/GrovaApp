import { supabase } from "../config/supabase";

class CommunityUnreadService {
  constructor() {
    this._counts = new Map();
    this._channels = new Map();
    this._channelCounts = new Map();
    this._listeners = new Set();
    this._channel = null;
    this._userId = null;
  }

  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  _notify() {
    this._listeners.forEach((listener) => {
      try { listener(); } catch (error) { console.error("[CommunityUnread] listener:", error); }
    });
  }

  getSnapshot() {
    return Object.fromEntries(this._counts);
  }

  getCommunityCount(communityId) {
    return this._counts.get(communityId) || 0;
  }

  getTotalCount() {
    return [...this._counts.values()].reduce((total, count) => total + count, 0);
  }

  async sync(userId, communities = []) {
    if (!userId) return;
    if (this._userId && this._userId !== userId && this._channel) {
      await supabase.removeChannel(this._channel);
      this._channel = null;
      this._channels.clear();
      this._channelCounts.clear();
      this._counts.clear();
    }
    this._userId = userId;
    const communityIds = communities.map((community) => community.id).filter(Boolean);
    if (!communityIds.length) {
      this._counts.clear();
      this._channels.clear();
      this._channelCounts.clear();
      if (this._channel) {
        await supabase.removeChannel(this._channel);
        this._channel = null;
      }
      this._notify();
      return;
    }

    const { data: channels, error: channelError } = await supabase
      .from("community_channels")
      .select("id, community_id")
      .in("community_id", communityIds)
      .is("deleted_at", null);
    if (channelError) throw channelError;

    this._channels = new Map((channels || []).map((channel) => [channel.id, channel.community_id]));
    const channelIds = [...this._channels.keys()];
    const { data: preferences, error: preferenceError } = channelIds.length
      ? await supabase
        .from("channel_notification_preferences")
        .select("channel_id, unread_count")
        .eq("user_id", userId)
        .in("channel_id", channelIds)
      : { data: [], error: null };
    if (preferenceError) throw preferenceError;

    const next = new Map(communityIds.map((id) => [id, 0]));
    this._channelCounts = new Map();
    (preferences || []).forEach((preference) => {
      const communityId = this._channels.get(preference.channel_id);
      if (communityId) {
        const unreadCount = preference.unread_count || 0;
        this._channelCounts.set(preference.channel_id, unreadCount);
        next.set(communityId, (next.get(communityId) || 0) + unreadCount);
      }
    });
    this._counts = next;
    this._startRealtime(userId);
    this._notify();
  }

  async markRead(channelId) {
    const communityId = this._channels.get(channelId);
    if (communityId) {
      const unreadCount = this._channelCounts.get(channelId) || 0;
      this._channelCounts.set(channelId, 0);
      this._counts.set(communityId, Math.max(0, (this._counts.get(communityId) || 0) - unreadCount));
      this._notify();
    }
    const { error } = await supabase.rpc("mark_channel_read", { p_channel_id: channelId });
    if (error) {
      await this.sync(this._userId, [...new Set(this._channels.values())].map((id) => ({ id })));
      throw error;
    }
  }

  _startRealtime(userId) {
    if (this._channel) supabase.removeChannel(this._channel);
    this._channel = supabase
      .channel(`community-unread-global:${userId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "channel_notification_preferences", filter: `user_id=eq.${userId}` }, (payload) => {
        const channelId = payload.new?.channel_id;
        const communityId = this._channels.get(channelId);
        if (!communityId) return;
        this.sync(this._userId, [...new Set(this._channels.values())].map((id) => ({ id }))).catch(() => {});
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_messages" }, (payload) => {
        const message = payload.new;
        const communityId = this._channels.get(message?.channel_id);
        if (!communityId || String(message.user_id) === String(userId)) return;
        this._channelCounts.set(message.channel_id, (this._channelCounts.get(message.channel_id) || 0) + 1);
        this._counts.set(communityId, (this._counts.get(communityId) || 0) + 1);
        this._notify();
      })
      .subscribe();
  }
}

const communityUnreadService = new CommunityUnreadService();
export default communityUnreadService;
