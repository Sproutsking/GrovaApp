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
      const { data, error } = await supabase
        .from("community_channels")
        .select("*")
        .eq("community_id", communityId)
        .is("deleted_at", null)
        .order("position", { ascending: true });

      if (error) throw error;

      const channels = data || [];
      this.cache.set(cacheKey, channels);
      this.lastFetch.set(cacheKey, Date.now());

      return channels;
    } catch (error) {
      console.error("Error fetching channels:", error);
      return this.cache.get(cacheKey) || [];
    }
  }

  async createChannel(channelData, communityId) {
    try {
      const { data, error } = await supabase
        .from("community_channels")
        .insert({
          community_id: communityId,
          name: channelData.name,
          icon: channelData.icon || "💬",
          description: channelData.description,
          type: channelData.type || "text",
          is_private: channelData.isPrivate || false,
        })
        .select()
        .single();

      if (error) throw error;

      this.cache.delete(`channels:${communityId}`);
      this.lastFetch.delete(`channels:${communityId}`);

      return data;
    } catch (error) {
      console.error("Error creating channel:", error);
      throw error;
    }
  }

  async updateChannel(channelId, updates) {
    try {
      const { data, error } = await supabase
        .from("community_channels")
        .update({ ...updates, updated_at: new Date().toISOString() })
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
      const { data: channel } = await supabase
        .from("community_channels")
        .select("community_id")
        .eq("id", channelId)
        .single();

      const { error } = await supabase
        .from("community_channels")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", channelId);

      if (error) throw error;

      if (channel?.community_id) {
        this.cache.delete(`channels:${channel.community_id}`);
        this.lastFetch.delete(`channels:${channel.community_id}`);
      }

      return true;
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