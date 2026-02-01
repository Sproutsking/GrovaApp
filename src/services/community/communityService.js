import { supabase } from "../config/supabase";

function getAvatarUrl(avatarId) {
  if (!avatarId || typeof avatarId !== "string") return "/default-avatar.png";
  if (avatarId.startsWith("http://") || avatarId.startsWith("https://"))
    return avatarId;

  const { data } = supabase.storage.from("avatars").getPublicUrl(avatarId);
  return data?.publicUrl || "/default-avatar.png";
}

class CommunityService {
  /**
   * Fetch all public communities + user's private communities
   */
  async fetchCommunities(userId) {
    try {
      const { data, error } = await supabase
        .from("communities")
        .select("*")
        .or(`is_private.eq.false,owner_id.eq.${userId}`)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching communities:", error);
      throw error;
    }
  }

  /**
   * Fetch user's joined communities
   */
  async fetchUserCommunities(userId) {
    try {
      const { data, error } = await supabase
        .from("community_members")
        .select(
          `
          *,
          community:communities!community_id(*)
        `,
        )
        .eq("user_id", userId)
        .is("community.deleted_at", null);

      if (error) throw error;
      return (data || []).map((m) => m.community).filter(Boolean);
    } catch (error) {
      console.error("Error fetching user communities:", error);
      throw error;
    }
  }

  /**
   * Create a new community with default roles and channels
   */
  async createCommunity(communityData, userId) {
    try {
      // 1. Create community
      const { data: community, error: communityError } = await supabase
        .from("communities")
        .insert({
          name: communityData.name,
          description: communityData.description || "",
          icon: communityData.icon || "🌟",
          banner_gradient:
            communityData.bannerGradient ||
            "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          is_private: communityData.isPrivate || false,
          owner_id: userId,
          member_count: 1,
          online_count: 0,
        })
        .select()
        .single();

      if (communityError) throw communityError;

      // 2. Create default roles in correct order
      const ownerRole = await this.createDefaultRole(
        community.id,
        "Owner",
        0,
        "owner",
      );
      const novisRole = await this.createDefaultRole(
        community.id,
        "Novis",
        2,
        "novis",
      );
      const memberRole = await this.createDefaultRole(
        community.id,
        "Member",
        1,
        "member",
      );

      // 3. Check if owner is already a member
      const { data: existingOwnerMember } = await supabase
        .from("community_members")
        .select("id")
        .eq("community_id", community.id)
        .eq("user_id", userId)
        .maybeSingle();

      // 4. Add owner as member with Owner role
      if (!existingOwnerMember) {
        const { error: memberError } = await supabase
          .from("community_members")
          .insert({
            community_id: community.id,
            user_id: userId,
            role_id: ownerRole.id,
            is_online: true,
          });

        if (memberError) {
          console.error("Error adding owner as member:", memberError);
          throw memberError;
        }
      }

      // 5. Create default channels
      await this.createDefaultChannels(community.id);

      return community;
    } catch (error) {
      console.error("Error creating community:", error);
      throw error;
    }
  }

  /**
   * Create default role with permissions
   */
  async createDefaultRole(communityId, roleName, position, roleType) {
    let permissions;
    let isDefault = false;

    switch (roleType) {
      case "owner":
        permissions = this.getOwnerPermissions();
        break;
      case "novis":
        permissions = this.getNovisPermissions();
        isDefault = true; // Novis is the default joining role
        break;
      case "member":
        permissions = this.getMemberPermissions();
        break;
      default:
        permissions = this.getMemberPermissions();
    }

    const roleColor =
      roleType === "owner"
        ? "#FFD700"
        : roleType === "novis"
          ? "#95A5A6"
          : "#667eea";

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

  /**
   * Get owner permissions (all permissions)
   */
  getOwnerPermissions() {
    return {
      sendMessages: true,
      attachFiles: true,
      embedLinks: true,
      addReactions: true,
      useExternalEmojis: true,
      mentionEveryone: true,
      useSlashCommands: true,
      viewChannels: true,
      createChannels: true,
      manageChannels: true,
      createPrivateChannels: true,
      viewMembers: true,
      inviteMembers: true,
      kickMembers: true,
      banMembers: true,
      manageNicknames: true,
      changeOwnNickname: true,
      manageRoles: true,
      assignRoles: true,
      viewRoles: true,
      manageMessages: true,
      pinMessages: true,
      readMessageHistory: true,
      viewAuditLog: true,
      timeoutMembers: true,
      manageWarnings: true,
      manageCommunity: true,
      manageWebhooks: true,
      manageInvites: true,
      viewAnalytics: true,
      manageEmojis: true,
      administrator: true,
      bypassSlowMode: true,
      prioritySpeaker: true,
      moveMembers: true,
    };
  }

  /**
   * Get Novis (beginner) permissions - very restricted
   */
  getNovisPermissions() {
    return {
      sendMessages: false,
      attachFiles: false,
      embedLinks: false,
      addReactions: false,
      useExternalEmojis: false,
      mentionEveryone: false,
      useSlashCommands: false,
      viewChannels: true, // Can only see verification/welcome channels
      createChannels: false,
      manageChannels: false,
      createPrivateChannels: false,
      viewMembers: true,
      inviteMembers: false,
      kickMembers: false,
      banMembers: false,
      manageNicknames: false,
      changeOwnNickname: false,
      manageRoles: false,
      assignRoles: false,
      viewRoles: false,
      manageMessages: false,
      pinMessages: false,
      readMessageHistory: true,
      viewAuditLog: false,
      timeoutMembers: false,
      manageWarnings: false,
      manageCommunity: false,
      manageWebhooks: false,
      manageInvites: false,
      viewAnalytics: false,
      manageEmojis: false,
      administrator: false,
      bypassSlowMode: false,
      prioritySpeaker: false,
      moveMembers: false,
    };
  }

  /**
   * Get default member permissions
   */
  getMemberPermissions() {
    return {
      sendMessages: true,
      attachFiles: true,
      embedLinks: true,
      addReactions: true,
      useSlashCommands: true,
      viewChannels: true,
      viewMembers: true,
      readMessageHistory: true,
      changeOwnNickname: true,
      viewRoles: true,
      useExternalEmojis: false,
      mentionEveryone: false,
      createChannels: false,
      manageChannels: false,
      createPrivateChannels: false,
      inviteMembers: false,
      kickMembers: false,
      banMembers: false,
      manageNicknames: false,
      manageRoles: false,
      assignRoles: false,
      manageMessages: false,
      pinMessages: false,
      viewAuditLog: false,
      timeoutMembers: false,
      manageWarnings: false,
      manageCommunity: false,
      manageWebhooks: false,
      manageInvites: false,
      viewAnalytics: false,
      manageEmojis: false,
      administrator: false,
      bypassSlowMode: false,
      prioritySpeaker: false,
      moveMembers: false,
    };
  }

  /**
   * Create default channels including verification channel
   */
  async createDefaultChannels(communityId) {
    const channels = [
      {
        name: "verification",
        icon: "✅",
        description: "Verify yourself to access the community",
        type: "text",
        position: 0,
      },
      {
        name: "welcome",
        icon: "👋",
        description: "Welcome new members!",
        type: "text",
        position: 1,
      },
      {
        name: "general",
        icon: "💬",
        description: "General discussion",
        type: "text",
        position: 2,
      },
      {
        name: "announcements",
        icon: "📢",
        description: "Important updates",
        type: "announcement",
        position: 3,
      },
    ];

    const { error } = await supabase
      .from("community_channels")
      .insert(channels.map((ch) => ({ ...ch, community_id: communityId })));

    if (error) throw error;
  }

  /**
   * Generate invite code
   */
  generateInviteCode() {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Generate invite link with settings
   */
  async generateInvite(communityId, userId, settings) {
    try {
      // Verify user has permission to create invites
      const hasPermission = await this.checkInvitePermission(
        communityId,
        userId,
      );
      if (!hasPermission) {
        throw new Error("You don't have permission to create invites");
      }

      // Generate unique invite code
      const code = this.generateInviteCode();

      // Calculate expiry time
      let expiresAt = null;
      if (settings.duration !== "never") {
        const now = new Date();
        switch (settings.duration) {
          case "1h":
            expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
            break;
          case "6h":
            expiresAt = new Date(now.getTime() + 6 * 60 * 60 * 1000);
            break;
          case "24h":
            expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            break;
          case "7d":
            expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            break;
        }
      }

      // Parse max uses
      const maxUses =
        settings.maxUses === "unlimited" ? null : parseInt(settings.maxUses);

      // Create invite in database
      const { data, error } = await supabase
        .from("community_invites")
        .insert({
          community_id: communityId,
          code: code,
          created_by: userId,
          max_uses: maxUses,
          uses: 0,
          expires_at: expiresAt,
        })
        .select()
        .single();

      if (error) throw error;

      // Return full invite URL
      return `${window.location.origin}/communities?invite=${code}`;
    } catch (error) {
      console.error("Error generating invite:", error);
      throw error;
    }
  }

  /**
   * Check if user can create invites
   */
  async checkInvitePermission(communityId, userId) {
    try {
      // Check if owner
      const { data: community } = await supabase
        .from("communities")
        .select("owner_id")
        .eq("id", communityId)
        .single();

      if (community?.owner_id === userId) return true;

      // Check role permissions
      const { data: member } = await supabase
        .from("community_members")
        .select(`role:community_roles!role_id(permissions)`)
        .eq("community_id", communityId)
        .eq("user_id", userId)
        .single();

      return (
        member?.role?.permissions?.manageInvites === true ||
        member?.role?.permissions?.inviteMembers === true
      );
    } catch (error) {
      console.error("Error checking invite permission:", error);
      return false;
    }
  }

  /**
   * Join a community
   */
  async joinCommunity(communityId, userId) {
    try {
      // 1. Verify community exists and is not deleted
      const { data: community, error: communityError } = await supabase
        .from("communities")
        .select("*, owner_id, is_private")
        .eq("id", communityId)
        .is("deleted_at", null)
        .single();

      if (communityError) throw new Error("Community not found");
      if (community.is_private)
        throw new Error("Cannot join private community without invite");

      // 2. Check if already a member
      const { data: existingMember, error: memberCheckError } = await supabase
        .from("community_members")
        .select("id")
        .eq("community_id", communityId)
        .eq("user_id", userId)
        .maybeSingle();

      if (memberCheckError && memberCheckError.code !== "PGRST116") {
        console.error("Member check error:", memberCheckError);
      }

      if (existingMember) {
        throw new Error("Already a member of this community");
      }

      // 3. Get default Novis role
      const { data: defaultRole, error: roleError } = await supabase
        .from("community_roles")
        .select("id")
        .eq("community_id", communityId)
        .eq("is_default", true)
        .maybeSingle();

      let roleId;

      if (roleError && roleError.code !== "PGRST116") {
        console.error("Role fetch error:", roleError);
        throw roleError;
      }

      if (!defaultRole) {
        // Create default Novis role if it doesn't exist
        console.log(
          "Creating missing default Novis role for community:",
          communityId,
        );
        const role = await this.createDefaultRole(
          communityId,
          "Novis",
          2,
          "novis",
        );
        roleId = role.id;
      } else {
        roleId = defaultRole.id;
      }

      // 4. Add user as member with Novis role
      const { error: memberError } = await supabase
        .from("community_members")
        .insert({
          community_id: communityId,
          user_id: userId,
          role_id: roleId,
          is_online: true,
        });

      if (memberError) throw memberError;

      // 5. Update member count
      const { error: updateError } = await supabase
        .from("communities")
        .update({
          member_count: community.member_count + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", communityId);

      if (updateError) {
        console.error("Failed to update member count:", updateError);
      }

      return community;
    } catch (error) {
      console.error("Join community error:", error);
      throw error;
    }
  }

  /**
   * Join community via invite code
   */
  async joinCommunityViaInvite(inviteCode, userId) {
    try {
      // 1. Verify invite
      const { data: invite, error: inviteError } = await supabase
        .from("community_invites")
        .select("*, community:communities!community_id(*)")
        .eq("code", inviteCode)
        .single();

      if (inviteError || !invite) throw new Error("Invalid invite code");
      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        throw new Error("Invite code has expired");
      }
      if (invite.max_uses && invite.uses >= invite.max_uses) {
        throw new Error("Invite code has reached maximum uses");
      }

      // 2. Check if already member
      const { data: existingMember } = await supabase
        .from("community_members")
        .select("id")
        .eq("community_id", invite.community_id)
        .eq("user_id", userId)
        .maybeSingle();

      if (existingMember) throw new Error("Already a member of this community");

      // 3. Get default Novis role
      const { data: defaultRole } = await supabase
        .from("community_roles")
        .select("id")
        .eq("community_id", invite.community_id)
        .eq("is_default", true)
        .maybeSingle();

      let roleId;
      if (!defaultRole) {
        // Create default Novis role if missing
        const role = await this.createDefaultRole(
          invite.community_id,
          "Novis",
          2,
          "novis",
        );
        roleId = role.id;
      } else {
        roleId = defaultRole.id;
      }

      // 4. Add member with Novis role
      const { error: memberError } = await supabase
        .from("community_members")
        .insert({
          community_id: invite.community_id,
          user_id: userId,
          role_id: roleId,
          is_online: true,
        });

      if (memberError) throw memberError;

      // 5. Update invite uses
      await supabase
        .from("community_invites")
        .update({ uses: invite.uses + 1 })
        .eq("id", invite.id);

      // 6. Update member count
      const { data: community } = await supabase
        .from("communities")
        .select("member_count")
        .eq("id", invite.community_id)
        .single();

      if (community) {
        await supabase
          .from("communities")
          .update({
            member_count: (community.member_count || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", invite.community_id);
      }

      return invite.community;
    } catch (error) {
      console.error("Join via invite error:", error);
      throw error;
    }
  }

  /**
   * Leave community
   */
  async leaveCommunity(communityId, userId) {
    try {
      // Cannot leave if owner
      const { data: community } = await supabase
        .from("communities")
        .select("owner_id, member_count")
        .eq("id", communityId)
        .single();

      if (community?.owner_id === userId) {
        throw new Error(
          "Owners cannot leave their community. Transfer ownership or delete the community.",
        );
      }

      // Remove member
      const { error } = await supabase
        .from("community_members")
        .delete()
        .eq("community_id", communityId)
        .eq("user_id", userId);

      if (error) throw error;

      // Update member count
      await supabase
        .from("communities")
        .update({
          member_count: Math.max(0, (community.member_count || 1) - 1),
          updated_at: new Date().toISOString(),
        })
        .eq("id", communityId);

      return true;
    } catch (error) {
      console.error("Leave community error:", error);
      throw error;
    }
  }

  /**
   * Delete community (owner only)
   */
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

      // Soft delete
      const { error } = await supabase
        .from("communities")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", communityId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Delete community error:", error);
      throw error;
    }
  }

  /**
   * Fetch community details
   */
  async fetchCommunityDetails(communityId) {
    try {
      const { data, error } = await supabase
        .from("communities")
        .select("*")
        .eq("id", communityId)
        .is("deleted_at", null)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Fetch community details error:", error);
      throw error;
    }
  }

  /**
   * Update community settings
   */
  async updateCommunity(communityId, userId, updates) {
    try {
      // Verify ownership
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
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", communityId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Update community error:", error);
      throw error;
    }
  }
}

export default new CommunityService();
