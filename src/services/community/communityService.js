// services/community/communityService.js - INSTANT SWITCHING
import { supabase } from "../config/supabase";

class CommunityService {
  constructor() {
    this.cache = new Map();
    this.lastFetch = new Map();
    this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  }

  // INSTANT: Get from cache if fresh, fetch in background if stale
  async fetchCommunities(userId) {
    const cacheKey = `communities:${userId}`;
    const cached = this.cache.get(cacheKey);
    const lastFetch = this.lastFetch.get(cacheKey) || 0;
    const age = Date.now() - lastFetch;

    // Return cache immediately if fresh
    if (cached && age < this.CACHE_TTL) {
      // Refresh in background if getting old (>2 min)
      if (age > 2 * 60 * 1000) {
        this.fetchCommunitiesFresh(userId, cacheKey);
      }
      return cached;
    }

    // Fetch fresh
    return await this.fetchCommunitiesFresh(userId, cacheKey);
  }

  async fetchCommunitiesFresh(userId, cacheKey) {
    try {
      const { data, error } = await supabase
        .from("communities")
        .select("*")
        .or(`is_private.eq.false,owner_id.eq.${userId}`)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const communities = data || [];
      this.cache.set(cacheKey, communities);
      this.lastFetch.set(cacheKey, Date.now());

      return communities;
    } catch (error) {
      console.error("Error fetching communities:", error);
      return this.cache.get(cacheKey) || [];
    }
  }

  // INSTANT: User communities with aggressive caching
  async fetchUserCommunities(userId) {
    const cacheKey = `user-communities:${userId}`;
    const cached = this.cache.get(cacheKey);
    const lastFetch = this.lastFetch.get(cacheKey) || 0;
    const age = Date.now() - lastFetch;

    if (cached && age < this.CACHE_TTL) {
      if (age > 2 * 60 * 1000) {
        this.fetchUserCommunitiesFresh(userId, cacheKey);
      }
      return cached;
    }

    return await this.fetchUserCommunitiesFresh(userId, cacheKey);
  }

  async fetchUserCommunitiesFresh(userId, cacheKey) {
    try {
      const { data, error } = await supabase
        .from("community_members")
        .select(`*, community:communities!community_id(*)`)
        .eq("user_id", userId)
        .is("community.deleted_at", null);

      if (error) throw error;

      const communities = (data || [])
        .map((m) => m.community)
        .filter(Boolean);
      
      this.cache.set(cacheKey, communities);
      this.lastFetch.set(cacheKey, Date.now());

      return communities;
    } catch (error) {
      console.error("Error fetching user communities:", error);
      return this.cache.get(cacheKey) || [];
    }
  }

  // INSTANT: Community details with per-community caching
  async fetchCommunityDetails(communityId) {
    const cacheKey = `community:${communityId}`;
    const cached = this.cache.get(cacheKey);
    const lastFetch = this.lastFetch.get(cacheKey) || 0;
    const age = Date.now() - lastFetch;

    if (cached && age < this.CACHE_TTL) {
      if (age > 2 * 60 * 1000) {
        this.fetchCommunityDetailsFresh(communityId, cacheKey);
      }
      return cached;
    }

    return await this.fetchCommunityDetailsFresh(communityId, cacheKey);
  }

  async fetchCommunityDetailsFresh(communityId, cacheKey) {
    try {
      const { data, error } = await supabase
        .from("communities")
        .select("*")
        .eq("id", communityId)
        .is("deleted_at", null)
        .single();

      if (error) throw error;

      this.cache.set(cacheKey, data);
      this.lastFetch.set(cacheKey, Date.now());

      return data;
    } catch (error) {
      console.error("Error fetching community details:", error);
      return this.cache.get(cacheKey) || null;
    }
  }

  // Create community and update cache
  async createCommunity(communityData, userId) {
    try {
      const { data: community, error } = await supabase
        .from("communities")
        .insert({
          name: communityData.name,
          description: communityData.description || "",
          icon: communityData.icon || "🌟",
          banner_gradient: communityData.bannerGradient || "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          is_private: communityData.isPrivate || false,
          owner_id: userId,
          member_count: 1,
        })
        .select()
        .single();

      if (error) throw error;

      // Create default roles
      const ownerRole = await this.createDefaultRole(community.id, "Owner", 0, "owner");
      await this.createDefaultRole(community.id, "Novis", 2, "novis");
      await this.createDefaultRole(community.id, "Member", 1, "member");

      // Add owner as member
      await supabase.from("community_members").insert({
        community_id: community.id,
        user_id: userId,
        role_id: ownerRole.id,
        is_online: true,
      });

      // Create default channels
      await this.createDefaultChannels(community.id);

      // Update cache
      this.cache.set(`community:${community.id}`, community);
      this.invalidateUserCache(userId);

      return community;
    } catch (error) {
      console.error("Error creating community:", error);
      throw error;
    }
  }

  async createDefaultRole(communityId, roleName, position, roleType) {
    const permissions = this[`get${roleType.charAt(0).toUpperCase() + roleType.slice(1)}Permissions`]();
    const isDefault = roleType === "novis";
    const roleColor = roleType === "owner" ? "#FFD700" : roleType === "novis" ? "#95A5A6" : "#667eea";

    const { data, error } = await supabase
      .from("community_roles")
      .insert({
        community_id: communityId,
        name: roleName,
        color: roleColor,
        position,
        permissions,
        is_default: isDefault,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  getOwnerPermissions() {
    return {
      sendMessages: true, attachFiles: true, embedLinks: true, addReactions: true,
      useExternalEmojis: true, mentionEveryone: true, useSlashCommands: true,
      viewChannels: true, createChannels: true, manageChannels: true,
      createPrivateChannels: true, viewMembers: true, inviteMembers: true,
      kickMembers: true, banMembers: true, manageNicknames: true,
      changeOwnNickname: true, manageRoles: true, assignRoles: true,
      viewRoles: true, manageMessages: true, pinMessages: true,
      readMessageHistory: true, viewAuditLog: true, timeoutMembers: true,
      manageWarnings: true, manageCommunity: true, manageWebhooks: true,
      manageInvites: true, viewAnalytics: true, manageEmojis: true,
      administrator: true, bypassSlowMode: true, prioritySpeaker: true,
      moveMembers: true,
    };
  }

  getNovisPermissions() {
    return {
      sendMessages: false, attachFiles: false, embedLinks: false,
      addReactions: false, useExternalEmojis: false, mentionEveryone: false,
      useSlashCommands: false, viewChannels: true, createChannels: false,
      manageChannels: false, createPrivateChannels: false, viewMembers: true,
      inviteMembers: false, kickMembers: false, banMembers: false,
      manageNicknames: false, changeOwnNickname: false, manageRoles: false,
      assignRoles: false, viewRoles: false, manageMessages: false,
      pinMessages: false, readMessageHistory: true, viewAuditLog: false,
      timeoutMembers: false, manageWarnings: false, manageCommunity: false,
      manageWebhooks: false, manageInvites: false, viewAnalytics: false,
      manageEmojis: false, administrator: false, bypassSlowMode: false,
      prioritySpeaker: false, moveMembers: false,
    };
  }

  getMemberPermissions() {
    return {
      sendMessages: true, attachFiles: true, embedLinks: true,
      addReactions: true, useSlashCommands: true, viewChannels: true,
      viewMembers: true, readMessageHistory: true, changeOwnNickname: true,
      viewRoles: true, useExternalEmojis: false, mentionEveryone: false,
      createChannels: false, manageChannels: false, createPrivateChannels: false,
      inviteMembers: false, kickMembers: false, banMembers: false,
      manageNicknames: false, manageRoles: false, assignRoles: false,
      manageMessages: false, pinMessages: false, viewAuditLog: false,
      timeoutMembers: false, manageWarnings: false, manageCommunity: false,
      manageWebhooks: false, manageInvites: false, viewAnalytics: false,
      manageEmojis: false, administrator: false, bypassSlowMode: false,
      prioritySpeaker: false, moveMembers: false,
    };
  }

  async createDefaultChannels(communityId) {
    const channels = [
      { name: "verification", icon: "✅", description: "Verify yourself to access the community", type: "text", position: 0 },
      { name: "welcome", icon: "👋", description: "Welcome new members!", type: "text", position: 1 },
      { name: "general", icon: "💬", description: "General discussion", type: "text", position: 2 },
      { name: "announcements", icon: "📢", description: "Important updates", type: "announcement", position: 3 },
    ];

    await supabase
      .from("community_channels")
      .insert(channels.map((ch) => ({ ...ch, community_id: communityId })));
  }

  async joinCommunity(communityId, userId) {
    try {
      const { data: community } = await supabase
        .from("communities")
        .select("*, owner_id, is_private")
        .eq("id", communityId)
        .is("deleted_at", null)
        .single();

      if (!community) throw new Error("Community not found");
      if (community.is_private) throw new Error("Cannot join private community without invite");

      const { data: existing } = await supabase
        .from("community_members")
        .select("id")
        .eq("community_id", communityId)
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) throw new Error("Already a member");

      const { data: defaultRole } = await supabase
        .from("community_roles")
        .select("id")
        .eq("community_id", communityId)
        .eq("is_default", true)
        .maybeSingle();

      let roleId = defaultRole?.id;
      if (!roleId) {
        const role = await this.createDefaultRole(communityId, "Novis", 2, "novis");
        roleId = role.id;
      }

      await supabase.from("community_members").insert({
        community_id: communityId,
        user_id: userId,
        role_id: roleId,
        is_online: true,
      });

      await supabase
        .from("communities")
        .update({ member_count: community.member_count + 1 })
        .eq("id", communityId);

      this.invalidateUserCache(userId);
      this.cache.delete(`community:${communityId}`);

      return community;
    } catch (error) {
      console.error("Join community error:", error);
      throw error;
    }
  }

  async leaveCommunity(communityId, userId) {
    try {
      const { data: community } = await supabase
        .from("communities")
        .select("owner_id, member_count")
        .eq("id", communityId)
        .single();

      if (community?.owner_id === userId) {
        throw new Error("Owners cannot leave. Transfer ownership or delete the community.");
      }

      await supabase
        .from("community_members")
        .delete()
        .eq("community_id", communityId)
        .eq("user_id", userId);

      await supabase
        .from("communities")
        .update({ member_count: Math.max(0, (community.member_count || 1) - 1) })
        .eq("id", communityId);

      this.invalidateUserCache(userId);
      this.cache.delete(`community:${communityId}`);

      return true;
    } catch (error) {
      console.error("Leave community error:", error);
      throw error;
    }
  }

  async deleteCommunity(communityId, userId) {
    try {
      const { data: community } = await supabase
        .from("communities")
        .select("owner_id")
        .eq("id", communityId)
        .single();

      if (community?.owner_id !== userId) {
        throw new Error("Only the owner can delete this community");
      }

      await supabase
        .from("communities")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", communityId);

      this.invalidateUserCache(userId);
      this.cache.delete(`community:${communityId}`);

      return true;
    } catch (error) {
      console.error("Delete community error:", error);
      throw error;
    }
  }

  async updateCommunity(communityId, userId, updates) {
    try {
      const { data: community } = await supabase
        .from("communities")
        .select("owner_id")
        .eq("id", communityId)
        .single();

      if (community?.owner_id !== userId) {
        throw new Error("Only the owner can update community settings");
      }

      const { data, error } = await supabase
        .from("communities")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", communityId)
        .select()
        .single();

      if (error) throw error;

      this.cache.set(`community:${communityId}`, data);
      return data;
    } catch (error) {
      console.error("Update community error:", error);
      throw error;
    }
  }

  invalidateUserCache(userId) {
    this.cache.delete(`user-communities:${userId}`);
    this.cache.delete(`communities:${userId}`);
  }

  clearCache() {
    this.cache.clear();
    this.lastFetch.clear();
  }
}

export default new CommunityService();