// services/community/channelService.js - INSTANT SWITCHING
import { supabase } from "../config/supabase";
import communityCache from "./communityCache";

const RESERVED_DEFAULT_CHANNEL_NAMES = new Set([
  "about-us",
  "announcements",
  "general",
  "gm",
  "official-links",
  "rules",
  "support",
  "ticket",
  "updates",
  "verification",
  "verify",
  "voice",
  "welcome",
]);

class ChannelService {
  constructor() {
    this.cache = new Map();
    this.lastFetch = new Map();
    this.CACHE_TTL = 5 * 60 * 1000;
  }

  async fetchChannels(communityId, { forceRefresh = false } = {}) {
    const cacheKey = `channels:${communityId}`;
    const cached = this.cache.get(cacheKey);
    const lastFetch = this.lastFetch.get(cacheKey) || 0;
    const age = Date.now() - lastFetch;

    if (!forceRefresh && cached && age < this.CACHE_TTL) {
      if (age > 2 * 60 * 1000) {
        this.fetchChannelsFresh(communityId, cacheKey);
      }
      return cached;
    }

    return await this.fetchChannelsFresh(communityId, cacheKey, { fallbackToCache: !forceRefresh });
  }

  async fetchChannelsFresh(communityId, cacheKey, { fallbackToCache = true } = {}) {
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

      const channels = result.data || [];
      this.cache.set(cacheKey, channels);
      this.lastFetch.set(cacheKey, Date.now());

      return channels;
    } catch (error) {
      console.error("Error fetching channels:", error);
      if (!fallbackToCache) throw error;
      return this.cache.get(cacheKey) || [];
    }
  }

  invalidateCommunityChannels(communityId) {
    this.cache.delete(`channels:${communityId}`);
    this.lastFetch.delete(`channels:${communityId}`);
    communityCache.clearCommunity(communityId);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("community:channels-changed", {
        detail: { communityId },
      }));
    }
  }

  async createChannel(channelData, communityId) {
    try {
      const channelName = channelData.name.trim().toLowerCase().replace(/\s+/g, "-");
      if (RESERVED_DEFAULT_CHANNEL_NAMES.has(channelName)) {
        throw new Error(`#${channelName} is a reserved community channel name.`);
      }

      const { data: capacity, error: capacityError } = await supabase.rpc(
        "get_community_custom_channel_capacity",
        { p_community_id: communityId },
      );
      if (capacityError) throw capacityError;
      if (!capacity || typeof capacity.remaining !== "number") {
        throw new Error("Could not verify this community's channel limit.");
      }
      if (capacity.remaining <= 0) {
        throw new Error(`This community has reached its ${capacity.tier} plan limit of ${capacity.limit} custom channels.`);
      }

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

      this.invalidateCommunityChannels(communityId);

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
        this.invalidateCommunityChannels(data.community_id);
      }

      return data;
    } catch (error) {
      console.error("Error updating channel:", error);
      throw error;
    }
  }

  async deleteChannel(channelId) {
    try {
      const { data: channel, error: channelError } = await supabase
        .from("community_channels")
        .select("community_id,name,is_default")
        .eq("id", channelId)
        .maybeSingle();
      if (channelError) throw channelError;
      if (!channel) throw new Error("Channel was not found or is already deleted.");
      if (channel.is_default && channel.name?.trim().toLowerCase() === "general") {
        throw new Error("The built-in #general channel cannot be deleted.");
      }

      const { data: deleted, error } = await supabase.rpc("delete_community_channel", {
        p_channel_id: channelId,
      });

      if (error) {
        const missingRpc = error.code === "PGRST202" || error.code === "42883" || /delete_community_channel|function.*does not exist/i.test(error.message || "");
        if (!missingRpc) throw error;
        const { error: fallbackError } = await supabase
          .from("community_channels")
          .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", channelId)
          .is("deleted_at", null);
        if (fallbackError) throw fallbackError;
      } else if (deleted === false) {
        throw new Error("You do not have permission to delete this channel.");
      }

      if (channel?.community_id) {
        this.invalidateCommunityChannels(channel.community_id);
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