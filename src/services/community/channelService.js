// services/community/channelService.js - INSTANT SWITCHING
import { supabase } from "../config/supabase";

class ChannelService {
  constructor() {
    this.cache = new Map();
    this.lastFetch = new Map();
    this.CACHE_TTL = 5 * 60 * 1000;
  }

  async fetchChannels(communityId) {
    const cacheKey = `channels:${communityId}`;
    const cached = this.cache.get(cacheKey);
    const lastFetch = this.lastFetch.get(cacheKey) || 0;
    const age = Date.now() - lastFetch;

    if (cached && age < this.CACHE_TTL) {
      if (age > 2 * 60 * 1000) {
        this.fetchChannelsFresh(communityId, cacheKey);
      }
      return cached;
    }

    return await this.fetchChannelsFresh(communityId, cacheKey);
  }

  async fetchChannelsFresh(communityId, cacheKey) {
    try {
      let query = supabase
        .from("community_channels")
        .select("*")
        .eq("community_id", communityId)
        .is("deleted_at", null);
      let result = await query.order("category", { ascending: true }).order("position", { ascending: true });

      // Older deployments do not have category yet; position is enough to
      // keep the canonical channel order until migration 026 is applied.
      if (result.error?.code === "42703") {
        result = await query.order("position", { ascending: true });
      }

      if (result.error) throw result.error;

      let channels = result.data || [];
      if (channels.length === 0) {
        channels = await this.restoreDefaultChannels(communityId);
      }
      this.cache.set(cacheKey, channels);
      this.lastFetch.set(cacheKey, Date.now());

      return channels;
    } catch (error) {
      console.error("Error fetching channels:", error);
      return this.cache.get(cacheKey) || [];
    }
  }

  async restoreDefaultChannels(communityId) {
    const defaults = [
      { name: "verification", icon: "✅", description: "Verify yourself to access the community", type: "text", tool_type: "verification", position: 0, is_default: true },
      { name: "announcements", icon: "📢", description: "Official community announcements", type: "announcement", position: 1, is_default: true },
      { name: "welcome", icon: "👋", description: "Welcome new members", type: "text", position: 2, is_default: true },
      { name: "voice", icon: "🔊", description: "Voice conversations", type: "voice", position: 3, is_default: true },
      { name: "support", icon: "🛟", description: "Get help from the community team", type: "text", position: 4, is_default: true },
      { name: "general", icon: "💬", description: "General discussion", type: "text", position: 5, is_default: true },
      { name: "updates", icon: "✦", description: "Xeevia and connected social updates", type: "text", tool_type: "social_updates", position: 6, is_default: true },
    ].map((channel) => ({ ...channel, community_id: communityId, category: "Start here" }));
    let result = await supabase.from("community_channels").insert(defaults).select("*");
    if (result.error?.code === "42703") {
      const legacyDefaults = defaults.map(({ category, tool_type, ...channel }) => channel);
      result = await supabase.from("community_channels").insert(legacyDefaults).select("*");
    }
    if (result.error) throw result.error;
    return result.data || [];
  }

  async createChannel(channelData, communityId) {
    try {
      const { count, error: countError } = await supabase
        .from("community_channels")
        .select("id", { count: "exact", head: true })
        .eq("community_id", communityId)
        .eq("is_default", false)
        .is("deleted_at", null);
      if (countError) throw countError;
      if ((count || 0) >= 9) throw new Error("This community has reached the 9 custom channel limit.");
      let icon = channelData.icon || "💬";
      if (channelData.iconFile) {
        const ext = channelData.iconFile.name.split(".").pop()?.toLowerCase() || "png";
        const path = `channel-icons/${communityId}/${Date.now()}.${ext}`;
        const upload = await supabase.storage.from("community-assets").upload(path, channelData.iconFile, { upsert: true, cacheControl: "3600" });
        if (upload.error) throw upload.error;
        icon = supabase.storage.from("community-assets").getPublicUrl(path).data.publicUrl;
      }
      const payload = {
        community_id: communityId,
        name: channelData.name,
        icon,
        description: channelData.description,
        type: channelData.type || "text",
        is_private: channelData.isPrivate || false,
        category: channelData.category || "Channels",
        category_id: channelData.category_id || null,
        tool_type: channelData.toolType || null,
        integrations: channelData.integrations || {},
        style: channelData.style || {},
      };
      let result = await supabase
        .from("community_channels")
        .insert(payload)
        .select()
        .single();

      if (result.error?.code === "42703") {
        const { category, category_id, tool_type, ...legacyPayload } = payload;
        result = await supabase.from("community_channels").insert(legacyPayload).select().single();
      }
      if (result.error) throw result.error;

      this.cache.delete(`channels:${communityId}`);
      this.lastFetch.delete(`channels:${communityId}`);

      return result.data;
    } catch (error) {
      console.error("Error creating channel:", error);
      throw error;
    }
  }

  async updateChannel(channelId, updates) {
    try {
      const nextUpdates = { ...updates };
      delete nextUpdates.iconFile;
      if (updates.iconFile) {
        const { data: channel, error: channelError } = await supabase
          .from("community_channels")
          .select("community_id")
          .eq("id", channelId)
          .single();
        if (channelError) throw channelError;
        const ext = updates.iconFile.name.split(".").pop()?.toLowerCase() || "png";
        const path = `channel-icons/${channel.community_id}/${Date.now()}.${ext}`;
        const upload = await supabase.storage.from("community-assets").upload(path, updates.iconFile, { upsert: true, cacheControl: "3600" });
        if (upload.error) throw upload.error;
        nextUpdates.icon = supabase.storage.from("community-assets").getPublicUrl(path).data.publicUrl;
      }
      const { data, error } = await supabase
        .from("community_channels")
        .update({ ...nextUpdates, updated_at: new Date().toISOString() })
        .eq("id", channelId)
        .select()
        .single();

      if (error) throw error;

      if (data.community_id) {
        this.cache.delete(`channels:${data.community_id}`);
        this.lastFetch.delete(`channels:${data.community_id}`);
      }

      return data;
    } catch (error) {
      console.error("Error updating channel:", error);
      throw error;
    }
  }

  async deleteChannel(channelId) {
    try {
      const { data: deleted, error } = await supabase.rpc("delete_community_channel", {
        p_channel_id: channelId,
      });

      if (error) throw error;

      const { data: channel } = await supabase
        .from("community_channels")
        .select("community_id")
        .eq("id", channelId)
        .maybeSingle();

      if (channel?.community_id) {
        this.cache.delete(`channels:${channel.community_id}`);
        this.lastFetch.delete(`channels:${channel.community_id}`);
      }

      return Boolean(deleted);
    } catch (error) {
      console.error("Error deleting channel:", error);
      throw error;
    }
  }

  clearCache() {
    this.cache.clear();
    this.lastFetch.clear();
  }
}

export default new ChannelService();