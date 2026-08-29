// services/community/communityService.js - FIXED: Online tracking, invites, image icons
import { supabase } from "../config/supabase";

class CommunityService {
  constructor() {
    this.cache = new Map();
    this.lastFetch = new Map();
    this.CACHE_TTL = 5 * 60 * 1000;
    this._presenceChannels = new Map(); // track realtime presence per community
    this._restoreCachedLists();
  }

  _normalizeCommunityCounts(communities) {
    const count = (value) => {
      if (Array.isArray(value)) return count(value[0]);
      if (value && typeof value === "object") return count(value.count);
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };
    return (communities || []).map((community) => ({
      ...community,
      member_count: count(community.member_count ?? community.member_total),
      online_count: count(community.online_count),
    }));
  }

  _restoreCachedLists() {
    try {
      const stored = JSON.parse(localStorage.getItem("xeevia_community_lists_v1") || "{}");
      Object.entries(stored).forEach(([key, entry]) => {
        if (Array.isArray(entry?.data) && entry.ts) {
          this.cache.set(key, entry.data);
          this.lastFetch.set(key, entry.ts);
        }
      });
    } catch {}
  }

  _persistList(cacheKey, data) {
    try {
      const stored = JSON.parse(localStorage.getItem("xeevia_community_lists_v1") || "{}");
      stored[cacheKey] = { data, ts: this.lastFetch.get(cacheKey) || Date.now() };
      localStorage.setItem("xeevia_community_lists_v1", JSON.stringify(stored));
    } catch {}
  }

  getCachedCommunities(userId) {
    return this.cache.get(`communities:${userId}`) || [];
  }

  getCachedUserCommunities(userId) {
    return this.cache.get(`user-communities:${userId}`) || [];
  }

  // ─── PRESENCE / ONLINE TRACKING ───────────────────────────────────────────

  /**
   * Mark the current user as online in a community.
   * Uses Supabase Realtime Presence so it auto-clears on disconnect.
   */
  async markOnline(communityId, userId, username) {
    const key = `presence:${communityId}`;
    // Avoid duplicate subscriptions
    if (this._presenceChannels.has(key)) return;

    const channel = supabase.channel(`community-presence-${communityId}`, {
      config: { presence: { key: userId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const onlineCount = Object.keys(state).length;
        // Patch the cached community's online_count
        const commKey = `community:${communityId}`;
        const cached = this.cache.get(commKey);
        if (cached) {
          this.cache.set(commKey, { ...cached, online_count: onlineCount });
        }
        // Also update member_online_count in the user-communities cache
        this._patchOnlineInLists(communityId, onlineCount);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: userId, username, online_at: new Date().toISOString() });
          // Also update DB for any static queries
          await supabase
            .from("community_members")
            .update({ is_online: true, last_seen: new Date().toISOString() })
            .eq("community_id", communityId)
            .eq("user_id", userId);
        }
      });

    this._presenceChannels.set(key, channel);
  }

  async markOffline(communityId, userId) {
    const key = `presence:${communityId}`;
    const channel = this._presenceChannels.get(key);
    if (channel) {
      await channel.untrack();
      supabase.removeChannel(channel);
      this._presenceChannels.delete(key);
    }
    // Update DB
    await supabase
      .from("community_members")
      .update({ is_online: false, last_seen: new Date().toISOString() })
      .eq("community_id", communityId)
      .eq("user_id", userId);
  }

  _patchOnlineInLists(communityId, onlineCount) {
    // Patch in allCommunities cache
    for (const [key, val] of this.cache.entries()) {
      if (key.startsWith("communities:") && Array.isArray(val)) {
        const idx = val.findIndex((c) => c.id === communityId);
        if (idx !== -1) {
          const updated = [...val];
          updated[idx] = { ...updated[idx], online_count: onlineCount };
          this.cache.set(key, updated);
        }
      }
      if (key.startsWith("user-communities:") && Array.isArray(val)) {
        const idx = val.findIndex((c) => c.id === communityId);
        if (idx !== -1) {
          const updated = [...val];
          updated[idx] = { ...updated[idx], online_count: onlineCount };
          this.cache.set(key, updated);
        }
      }
    }
  }

  // ─── COMMUNITIES ──────────────────────────────────────────────────────────

  async fetchCommunities(userId) {
    const cacheKey = `communities:${userId}`;
    const cached = this.cache.get(cacheKey);
    const lastFetch = this.lastFetch.get(cacheKey) || 0;
    const age = Date.now() - lastFetch;

    if (cached && age < this.CACHE_TTL) {
      const normalized = this._normalizeCommunityCounts(cached);
      this.cache.set(cacheKey, normalized);
      if (age > 2 * 60 * 1000) this.fetchCommunitiesFresh(userId, cacheKey);
      return normalized;
    }
    return await this.fetchCommunitiesFresh(userId, cacheKey);
  }

  async fetchCommunitiesFresh(userId, cacheKey) {
    try {
      const { data, error } = await supabase
        .from("communities")
        .select("*, member_total:community_members(count), online_count:community_members(count)")
        .or(`is_private.eq.false,owner_id.eq.${userId}`)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const communities = this._normalizeCommunityCounts(data);
      this.cache.set(cacheKey, communities);
      this.lastFetch.set(cacheKey, Date.now());
      this._persistList(cacheKey, communities);
      this._enrichOnlineCounts(communities).then((enriched) => {
        this.cache.set(cacheKey, enriched);
        this._persistList(cacheKey, enriched);
      }).catch(() => {});
      return communities;
    } catch (error) {
      console.error("Error fetching communities:", error);
      return this.cache.get(cacheKey) || [];
    }
  }

  async fetchUserCommunities(userId) {
    const cacheKey = `user-communities:${userId}`;
    const cached = this.cache.get(cacheKey);
    const lastFetch = this.lastFetch.get(cacheKey) || 0;
    const age = Date.now() - lastFetch;

    if (cached && age < this.CACHE_TTL) {
      const normalized = this._normalizeCommunityCounts(cached);
      this.cache.set(cacheKey, normalized);
      if (age > 2 * 60 * 1000) this.fetchUserCommunitiesFresh(userId, cacheKey);
      return normalized;
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

      const communities = this._normalizeCommunityCounts((data || []).map((m) => m.community).filter(Boolean));
      this.cache.set(cacheKey, communities);
      this.lastFetch.set(cacheKey, Date.now());
      this._persistList(cacheKey, communities);
      this._enrichOnlineCounts(communities).then((enriched) => {
        this.cache.set(cacheKey, enriched);
        this._persistList(cacheKey, enriched);
      }).catch(() => {});
      return communities;
    } catch (error) {
      console.error("Error fetching user communities:", error);
      return this.cache.get(cacheKey) || [];
    }
  }

  /** Query actual online member count from DB for each community */
  async _enrichOnlineCounts(communities) {
    if (!communities.length) return communities;
    try {
      const ids = communities.map((c) => c.id);
      const { data } = await supabase
        .from("community_members")
        .select("community_id")
        .in("community_id", ids)
        .eq("is_online", true);

      const countMap = {};
      (data || []).forEach((row) => {
        countMap[row.community_id] = (countMap[row.community_id] || 0) + 1;
      });

      return communities.map((c) => ({
        ...c,
        online_count: countMap[c.id] || 0,
      }));
    } catch {
      return communities;
    }
  }

  async fetchCommunityDetails(communityId) {
    const cacheKey = `community:${communityId}`;
    const cached = this.cache.get(cacheKey);
    const lastFetch = this.lastFetch.get(cacheKey) || 0;
    const age = Date.now() - lastFetch;

    if (cached && age < this.CACHE_TTL) {
      if (age > 2 * 60 * 1000) this.fetchCommunityDetailsFresh(communityId, cacheKey);
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

      // Get online count
      const { count: onlineCount } = await supabase
        .from("community_members")
        .select("id", { count: "exact", head: true })
        .eq("community_id", communityId)
        .eq("is_online", true);

      const { count: memberCount } = await supabase
        .from("community_members")
        .select("id", { count: "exact", head: true })
        .eq("community_id", communityId);

      const community = {
        ...data,
        member_count: memberCount || 0,
        online_count: onlineCount || 0,
      };
      this.cache.set(cacheKey, community);
      this.lastFetch.set(cacheKey, Date.now());
      return community;
    } catch (error) {
      console.error("Error fetching community details:", error);
      return this.cache.get(cacheKey) || null;
    }
  }

  // ─── CREATE / UPDATE / DELETE ─────────────────────────────────────────────

  /**
   * Creates a community. `communityData.iconUrl` can be:
   *  - an emoji string  e.g. "🚀"
   *  - a data-URL / storage path for a device image
   */
  async createCommunity(communityData, userId) {
    try {
      let iconValue = communityData.icon || "🌟";

      // If the user uploaded an image file, store it in Supabase Storage
      if (communityData.iconFile) {
        iconValue = await this._uploadCommunityIcon(communityData.iconFile, userId);
      }

      const { data: community, error } = await supabase
        .from("communities")
        .insert({
          name: communityData.name,
          description: communityData.description || "",
          icon: iconValue,
          banner_gradient:
            communityData.bannerGradient ||
            "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          is_private: communityData.isPrivate || false,
          owner_id: userId,
          member_count: 1,
          online_count: 1,
        })
        .select()
        .single();

      if (error) throw error;

      const ownerRole = await this.createDefaultRole(community.id, "Owner", 0, "owner");
      await this.createDefaultRole(community.id, "Novis", 2, "novis");
      await this.createDefaultRole(community.id, "Member", 1, "member");

      await supabase.from("community_members").insert({
        community_id: community.id,
        user_id: userId,
        role_id: ownerRole.id,
        is_online: true,
        last_seen: new Date().toISOString(),
      });

      await this.createDefaultChannels(community.id);

      this.cache.set(`community:${community.id}`, { ...community, online_count: 1 });
      this.invalidateUserCache(userId);

      return community;
    } catch (error) {
      console.error("Error creating community:", error);
      throw error;
    }
  }

  async _uploadCommunityIcon(file, userId) {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `community-icons/${userId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("community-assets").upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });
    if (error) {
      throw new Error(`Community image upload failed: ${error.message}`);
    }
    const { data } = supabase.storage.from("community-assets").getPublicUrl(path);
    return data.publicUrl;
  }

  async createDefaultRole(communityId, roleName, position, roleType) {
    const permissions = this[`get${roleType.charAt(0).toUpperCase() + roleType.slice(1)}Permissions`]();
    const isDefault = roleType === "novis";
    const roleColor =
      roleType === "owner" ? "#FFD700" : roleType === "novis" ? "#95A5A6" : "#667eea";

    const { data, error } = await supabase
      .from("community_roles")
      .insert({ community_id: communityId, name: roleName, color: roleColor, position, permissions, is_default: isDefault })
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
      { name: "verification", icon: "✅", description: "Verify yourself to access the community", type: "text", tool_type: "verification", position: 0, is_default: true, integrations: {} },
      { name: "announcements", icon: "📢", description: "Official community announcements", type: "announcement", tool_type: null, position: 1, is_default: true, integrations: {} },
      { name: "welcome", icon: "👋", description: "Welcome new members", type: "text", tool_type: null, position: 2, is_default: true, integrations: {} },
      { name: "voice", icon: "🔊", description: "Voice conversations", type: "voice", tool_type: null, position: 3, is_default: true, integrations: {} },
      { name: "support", icon: "🛟", description: "Get help from the community team", type: "text", tool_type: null, position: 4, is_default: true, integrations: {} },
      { name: "general", icon: "💬", description: "General discussion", type: "text", tool_type: null, position: 5, is_default: true, integrations: {} },
      { name: "updates", icon: "✦", description: "Xeevia and connected social updates", type: "text", tool_type: "social_updates", position: 6, is_default: true, integrations: { xeevia: true, x: false, facebook: false, instagram: false, tiktok: false, discord: false } },
    ];
    const modernChannels = channels.map((ch) => ({ ...ch, community_id: communityId, category: "Start here", style: {}, can_lock: false, is_locked: false }))
    let result = await supabase.from("community_channels").insert(modernChannels).select("id, tool_type");
    if (result.error?.code === "42703") {
      const legacyChannels = modernChannels.map(({ category, tool_type, ...channel }) => channel);
      result = await supabase.from("community_channels").insert(legacyChannels).select("id");
    }
    if (result.error) throw result.error;
    const createdChannels = result.data;
    const verifyChannel = createdChannels?.find((channel) => channel.tool_type === "verification");
    await supabase.from("community_tool_settings").upsert([
      { community_id: communityId, tool_type: "verification", enabled: true, channel_id: verifyChannel?.id || null },
      { community_id: communityId, tool_type: "social_updates", enabled: false },
      { community_id: communityId, tool_type: "tickets", enabled: false },
    ], { onConflict: "community_id,tool_type" });
  }

  // ─── JOIN / LEAVE / DELETE / UPDATE ──────────────────────────────────────

  async joinCommunity(communityId, userId) {
    try {
      const { data: community, error } = await supabase.rpc("join_public_community", {
        p_community_id: communityId,
        p_user_id: userId,
      });
      if (error) throw error;
      if (!community) throw new Error("Community could not be joined");

      this.invalidateUserCache(userId);
      this.cache.delete(`community:${communityId}`);
      return community;
    } catch (error) {
      console.error("Join community error:", error);
      throw error;
    }
  }

  // ─── INVITE SYSTEM ────────────────────────────────────────────────────────

  /**
   * Generate an invite link/code for a community.
   * Stores in `community_invites` table: { community_id, code, created_by, expires_at, uses, max_uses }
   */
  async createInvite(communityId, userId, options = {}) {
    try {
      const code = this._generateInviteCode();
      const expiresAt = options.expiresIn
        ? new Date(Date.now() + options.expiresIn).toISOString()
        : null;

      const { data, error } = await supabase
        .from("community_invites")
        .insert({
          community_id: communityId,
          code,
          created_by: userId,
          expires_at: expiresAt,
          max_uses: options.maxUses || null,
          uses: 0,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error creating invite:", error);
      throw error;
    }
  }

  /**
   * Look up an invite code and return { invite, community }.
   */
  async resolveInvite(code) {
    try {
      const { data: invite, error } = await supabase
        .from("community_invites")
        .select("*, community:communities!community_id(*)")
        .eq("code", code.trim().toUpperCase())
        .maybeSingle();

      if (error || !invite) throw new Error("Invite not found or expired");
      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        throw new Error("This invite has expired");
      }
      if (invite.max_uses && invite.uses >= invite.max_uses) {
        throw new Error("This invite has reached its maximum uses");
      }
      return invite;
    } catch (error) {
      console.error("Error resolving invite:", error);
      throw error;
    }
  }

  /**
   * Join a community via invite code.
   * Returns the community so the caller can navigate straight into it.
   */
  async joinCommunityViaInvite(code, userId) {
    try {
      const invite = await this.resolveInvite(code);
      const community = invite.community;

      if (!community || community.deleted_at) throw new Error("Community no longer exists");

      // Check already a member
      const { data: existing } = await supabase
        .from("community_members")
        .select("id")
        .eq("community_id", community.id)
        .eq("user_id", userId)
        .maybeSingle();

      if (!existing) {
        const { error: joinError } = await supabase.rpc("join_public_community", {
          p_community_id: community.id,
          p_user_id: userId,
        });
        if (joinError) throw joinError;

        // The join RPC increments the member count with the membership insert.
        await supabase
          .from("community_invites")
          .update({ uses: (invite.uses || 0) + 1 })
          .eq("id", invite.id);

        this.invalidateUserCache(userId);
        this.cache.delete(`community:${community.id}`);
      }

      return community;
    } catch (error) {
      console.error("Invite join error:", error);
      throw error;
    }
  }

  _generateInviteCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  }

  // ─── LEAVE / DELETE / UPDATE ─────────────────────────────────────────────

  async leaveCommunity(communityId, userId) {
    try {
      const { data: community } = await supabase
        .from("communities")
        .select("owner_id, member_count")
        .eq("id", communityId)
        .single();

      if (community?.owner_id === userId)
        throw new Error("Owners cannot leave. Transfer ownership or delete the community.");

      await supabase
        .from("community_members")
        .delete()
        .eq("community_id", communityId)
        .eq("user_id", userId);

      await supabase
        .from("communities")
        .update({ member_count: Math.max(0, (community.member_count || 1) - 1) })
        .eq("id", communityId);

      await this.markOffline(communityId, userId);
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

      if (community?.owner_id !== userId) throw new Error("Only the owner can delete this community");

      await supabase
        .from("communities")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", communityId);

      await this.markOffline(communityId, userId);
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
      const nextUpdates = {
        name: updates.name,
        description: updates.description || "",
        is_private: updates.isPrivate ?? updates.is_private ?? false,
        background_theme: updates.backgroundTheme || updates.background_theme || "security",
        banner_gradient: updates.bannerGradient || updates.banner_gradient || null,
        icon_border: updates.iconBorder || updates.icon_border || "default",
      };

      // Handle icon image upload
      if (updates.iconFile) {
        nextUpdates.icon = await this._uploadCommunityIcon(updates.iconFile, userId);
      } else if (updates.icon) {
        nextUpdates.icon = updates.icon;
      }

      const { data: community } = await supabase
        .from("communities")
        .select("owner_id")
        .eq("id", communityId)
        .single();

      if (community?.owner_id !== userId)
        throw new Error("Only the owner can update community settings");

      const { data, error } = await supabase
        .from("communities")
        .update({ ...nextUpdates, updated_at: new Date().toISOString() })
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

  // ─── HELPERS ─────────────────────────────────────────────────────────────

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