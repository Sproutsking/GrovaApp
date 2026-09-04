import { supabase } from "../config/supabase";

class CommunityService {
  constructor() {
    this.cache = new Map();
    this.lastFetch = new Map();
    this.presenceChannels = new Map();
    this.CACHE_TTL = 5 * 60 * 1000;
  }

  getCachedCommunities(userId) { return this.cache.get(`communities:${userId}`) || []; }
  getCachedUserCommunities(userId) { return this.cache.get(`user-communities:${userId}`) || []; }

  async fetchCommunities(userId) {
    const key = `communities:${userId}`;
    const cached = this.cache.get(key);
    if (cached && Date.now() - (this.lastFetch.get(key) || 0) < this.CACHE_TTL) return cached;
    const { data, error } = await supabase
      .from("communities")
      .select("*, community_members(count)")
      .or(`is_private.eq.false,owner_id.eq.${userId}`)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const communities = (data || []).map((item) => ({ ...item, member_count: item.member_count || item.community_members?.[0]?.count || 0 }));
    this.cache.set(key, communities);
    this.lastFetch.set(key, Date.now());
    return communities;
  }

  async fetchUserCommunities(userId) {
    const key = `user-communities:${userId}`;
    const cached = this.cache.get(key);
    if (cached && Date.now() - (this.lastFetch.get(key) || 0) < this.CACHE_TTL) return cached;
    const { data, error } = await supabase
      .from("community_members")
      .select("community:communities!community_id(*)")
      .eq("user_id", userId)
      .is("community.deleted_at", null);
    if (error) throw error;
    const communities = (data || []).map((row) => row.community).filter(Boolean);
    this.cache.set(key, communities);
    this.lastFetch.set(key, Date.now());
    return communities;
  }

  async fetchCommunityDetails(communityId) {
    const key = `community:${communityId}`;
    const cached = this.cache.get(key);
    if (cached && Date.now() - (this.lastFetch.get(key) || 0) < this.CACHE_TTL) return cached;
    const { data, error } = await supabase.from("communities").select("*").eq("id", communityId).is("deleted_at", null).single();
    if (error) throw error;
    this.cache.set(key, data);
    this.lastFetch.set(key, Date.now());
    return data;
  }

  async _uploadCommunityIcon(file, userId) {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `community-icons/${userId}/${Date.now()}.${ext}`;
    const upload = await supabase.storage.from("community-assets").upload(path, file, { upsert: true, cacheControl: "3600" });
    if (upload.error) throw upload.error;
    return supabase.storage.from("community-assets").getPublicUrl(path).data.publicUrl;
  }

  async createCommunity(data, userId) {
    const icon = data.iconFile ? await this._uploadCommunityIcon(data.iconFile, userId) : (data.icon || "🌟");
    const { data: community, error } = await supabase.rpc("create_community_with_defaults", {
      p_name: data.name, p_description: data.description || "", p_icon: icon,
      p_banner_gradient: data.bannerGradient || null, p_is_private: Boolean(data.isPrivate), p_owner_id: userId,
    });
    if (error) throw error;
    this.invalidateUserCache(userId);
    return community;
  }

  async updateCommunity(communityId, userId, updates) {
    const current = await this.fetchCommunityDetails(communityId);
    if (current.owner_id !== userId) throw new Error("Only the owner can update community settings");
    const next = {
      name: updates.name,
      description: updates.description || "",
      is_private: updates.isPrivate ?? updates.is_private ?? current.is_private,
      background_theme: updates.backgroundTheme || updates.background_theme || current.background_theme,
      banner_gradient: updates.bannerGradient || updates.banner_gradient || current.banner_gradient,
      icon_border: updates.iconBorder || updates.icon_border || current.icon_border,
      settings: { ...(current.settings || {}), ...(updates.settings || {}), ...(updates.welcomeCard ? { welcome_card: updates.welcomeCard } : {}) },
    };
    if (updates.iconFile) next.icon = await this._uploadCommunityIcon(updates.iconFile, userId);
    else if (updates.icon) next.icon = updates.icon;
    const { data, error } = await supabase.from("communities").update({ ...next, updated_at: new Date().toISOString() }).eq("id", communityId).select().single();
    if (error) throw error;
    this.cache.set(`community:${communityId}`, data);
    return data;
  }

  async joinCommunity(communityId, userId) {
    const { data, error } = await supabase.rpc("join_public_community", { p_community_id: communityId, p_user_id: userId });
    if (error) throw error;
    this.invalidateUserCache(userId);
    return data;
  }

  async joinCommunityViaInvite(code, userId) {
    const { data, error } = await supabase.rpc("join_community_via_invite", { p_code: code, p_user_id: userId });
    if (error) throw error;
    this.invalidateUserCache(userId);
    return data;
  }

  async leaveCommunity(communityId, userId) {
    const { error } = await supabase.from("community_members").delete().eq("community_id", communityId).eq("user_id", userId);
    if (error) throw error;
    this.invalidateUserCache(userId);
    return true;
  }

  async deleteCommunity(communityId, userId) {
    const { data, error } = await supabase.rpc("delete_community", { p_community_id: communityId });
    if (error) throw error;
    if (data === false) throw new Error("Community could not be deleted.");
    this.cache.delete(`community:${communityId}`);
    this.invalidateUserCache(userId);
    return true;
  }

  async createInvite(communityId, userId, options = {}) {
    const code = Math.random().toString(36).slice(2, 10).toUpperCase();
    const { data, error } = await supabase.from("community_invites").insert({ community_id: communityId, code, created_by: userId, max_uses: options.maxUses || null, expires_at: options.expiresIn ? new Date(Date.now() + options.expiresIn).toISOString() : null }).select().single();
    if (error) throw error;
    return data;
  }

  async markOnline(communityId, userId, username) {
    if (this.presenceChannels.has(communityId)) return;
    const channel = supabase.channel(`community-presence-${communityId}`, { config: { presence: { key: userId } } });
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ user_id: userId, username, online_at: new Date().toISOString() });
        await supabase.from("community_members").update({ is_online: true, last_seen: new Date().toISOString() }).eq("community_id", communityId).eq("user_id", userId);
      }
    });
    this.presenceChannels.set(communityId, channel);
  }

  async markOffline(communityId, userId) {
    const channel = this.presenceChannels.get(communityId);
    if (channel) { await channel.untrack(); await supabase.removeChannel(channel); this.presenceChannels.delete(communityId); }
    await supabase.from("community_members").update({ is_online: false, last_seen: new Date().toISOString() }).eq("community_id", communityId).eq("user_id", userId);
  }

  invalidateUserCache(userId) {
    this.cache.delete(`communities:${userId}`);
    this.cache.delete(`user-communities:${userId}`);
    this.lastFetch.delete(`communities:${userId}`);
    this.lastFetch.delete(`user-communities:${userId}`);
  }
}

export default new CommunityService();