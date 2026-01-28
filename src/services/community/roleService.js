// src/services/community/roleService.js
import { supabase } from "../config/supabase";
import RoleModel from "../../models/RoleModel";

function getAvatarUrl(avatarId) {
  if (!avatarId || typeof avatarId !== "string") {
    return "/default-avatar.png";
  }

  if (avatarId.startsWith("http://") || avatarId.startsWith("https://")) {
    return avatarId;
  }

  const { data } = supabase.storage.from("avatars").getPublicUrl(avatarId);

  return data?.publicUrl || "/default-avatar.png";
}

class RoleService {
  /**
   * Fetch roles for a community
   */
  async fetchRoles(communityId) {
    try {
      const { data, error } = await supabase
        .from("community_roles")
        .select(
          `
          *,
          member_count:community_members(count)
        `,
        )
        .eq("community_id", communityId)
        .order("position", { ascending: true });

      if (error) throw error;

      return (data || []).map((role) => ({
        ...role,
        members: role.member_count?.[0]?.count || 0,
      }));
    } catch (error) {
      console.error("Error fetching roles:", error);
      throw error;
    }
  }

  /**
   * Create a new role (creates a "Novis" role with restricted permissions)
   */
  async createRole(roleData, communityId) {
    try {
      // Validate role data
      const validation = RoleModel.validate(roleData);
      if (!validation.valid) {
        throw new Error(validation.errors.join(", "));
      }

      // If creating a "Novis" role, set restricted permissions
      let permissions = roleData.permissions;
      if (roleData.name.toLowerCase() === "novis") {
        permissions = this.getNovisPermissions();
      }

      const roleModel = new RoleModel({
        ...roleData,
        community_id: communityId,
        permissions: permissions,
      });

      const { data, error } = await supabase
        .from("community_roles")
        .insert(roleModel.toJSON())
        .select()
        .single();

      if (error) throw error;
      return RoleModel.fromAPI(data);
    } catch (error) {
      console.error("Error creating role:", error);
      throw error;
    }
  }

  /**
   * Get restricted permissions for Novis role
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
      viewChannels: true, // Can only see verification and welcome channels
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
   * Check if user can view a specific channel based on their role
   */
  async canViewChannel(communityId, userId, channelName) {
    try {
      const role = await this.getUserRole(communityId, userId);
      if (!role) return false;

      const roleModel = RoleModel.fromAPI(role);

      // Administrator can see everything
      if (roleModel.hasPermission("administrator")) {
        return true;
      }

      // Novis role can only see verification and welcome channels
      if (role.name.toLowerCase() === "novis") {
        const allowedChannels = ["verification", "welcome"];
        return allowedChannels.some((allowed) =>
          channelName.toLowerCase().includes(allowed),
        );
      }

      // Others can view if they have viewChannels permission
      return roleModel.hasPermission("viewChannels");
    } catch (error) {
      console.error("Error checking channel view permission:", error);
      return false;
    }
  }

  /**
   * Get channels visible to user based on their role
   */
  async getVisibleChannels(communityId, userId, allChannels) {
    try {
      const role = await this.getUserRole(communityId, userId);
      if (!role) return [];

      const roleModel = RoleModel.fromAPI(role);

      // Administrator can see all channels
      if (roleModel.hasPermission("administrator")) {
        return allChannels;
      }

      // Novis role can only see verification and welcome channels
      if (role.name.toLowerCase() === "novis") {
        return allChannels.filter((channel) => {
          const channelName = channel.name.toLowerCase();
          return (
            channelName.includes("verification") ||
            channelName.includes("welcome")
          );
        });
      }

      // Others can view all channels if they have viewChannels permission
      if (roleModel.hasPermission("viewChannels")) {
        return allChannels;
      }

      return [];
    } catch (error) {
      console.error("Error getting visible channels:", error);
      return [];
    }
  }

  /**
   * Update role
   */
  async updateRole(roleId, updates) {
    try {
      const { data, error } = await supabase
        .from("community_roles")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", roleId)
        .select()
        .single();

      if (error) throw error;
      return RoleModel.fromAPI(data);
    } catch (error) {
      console.error("Error updating role:", error);
      throw error;
    }
  }

  /**
   * Delete role
   */
  async deleteRole(roleId) {
    try {
      // Check if role is default
      const { data: role } = await supabase
        .from("community_roles")
        .select("is_default")
        .eq("id", roleId)
        .single();

      if (role?.is_default) {
        throw new Error("Cannot delete default role");
      }

      const { error } = await supabase
        .from("community_roles")
        .delete()
        .eq("id", roleId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Error deleting role:", error);
      throw error;
    }
  }

  /**
   * Fetch members with their roles
   */
  async fetchMembers(communityId) {
    try {
      const { data, error } = await supabase
        .from("community_members")
        .select(
          `
          *,
          user:profiles!user_id(id, username, full_name, avatar_id, verified),
          role:community_roles!role_id(id, name, color)
        `,
        )
        .eq("community_id", communityId)
        .order("joined_at", { ascending: false });

      if (error) throw error;

      // Transform raw avatar_id → full public URL
      return (data || []).map((member) => ({
        ...member,
        user: member.user
          ? {
              ...member.user,
              avatar: getAvatarUrl(member.user.avatar_id),
            }
          : null,
      }));
    } catch (error) {
      console.error("Error fetching members:", error);
      throw error;
    }
  }

  /**
   * Update member role
   */
  async updateMemberRole(memberId, roleId) {
    try {
      const { error } = await supabase
        .from("community_members")
        .update({ role_id: roleId })
        .eq("id", memberId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Error updating member role:", error);
      throw error;
    }
  }

  /**
   * Get user's role in community
   */
  async getUserRole(communityId, userId) {
    try {
      const { data, error } = await supabase
        .from("community_members")
        .select(
          `
          role:community_roles!role_id(*)
        `,
        )
        .eq("community_id", communityId)
        .eq("user_id", userId)
        .single();

      if (error) throw error;
      return data?.role ? RoleModel.fromAPI(data.role) : null;
    } catch (error) {
      console.error("Error getting user role:", error);
      return null;
    }
  }

  /**
   * Check if user has a specific permission in a community
   */
  async hasPermission(communityId, userId, permission) {
    try {
      // Check if user is owner
      const { data: community } = await supabase
        .from("communities")
        .select("owner_id")
        .eq("id", communityId)
        .single();

      if (community?.owner_id === userId) {
        return true; // Owners have all permissions
      }

      // Get user's role and check permission
      const role = await this.getUserRole(communityId, userId);
      return role ? role.hasPermission(permission) : false;
    } catch (error) {
      console.error("Error checking permission:", error);
      return false;
    }
  }

  /**
   * Get all permissions for a user in a community
   */
  async getUserPermissions(communityId, userId) {
    try {
      // Check if user is owner
      const { data: community } = await supabase
        .from("communities")
        .select("owner_id")
        .eq("id", communityId)
        .single();

      if (community?.owner_id === userId) {
        // Return all permissions for owner
        const ownerRole = RoleModel.createOwnerRole(communityId);
        return ownerRole.permissions;
      }

      // Get user's role permissions
      const role = await this.getUserRole(communityId, userId);
      return role ? role.permissions : {};
    } catch (error) {
      console.error("Error getting user permissions:", error);
      return {};
    }
  }

  /**
   * Check if user can manage a specific role
   */
  async canManageRole(communityId, userId, targetRoleId) {
    try {
      // Get user's role
      const userRole = await this.getUserRole(communityId, userId);
      if (!userRole) return false;

      // Get target role
      const { data: targetRoleData } = await supabase
        .from("community_roles")
        .select("*")
        .eq("id", targetRoleId)
        .single();

      if (!targetRoleData) return false;

      const targetRole = RoleModel.fromAPI(targetRoleData);
      return userRole.canManageRole(targetRole);
    } catch (error) {
      console.error("Error checking role management permission:", error);
      return false;
    }
  }

  /**
   * Get role by ID
   */
  async getRoleById(roleId) {
    try {
      const { data, error } = await supabase
        .from("community_roles")
        .select("*")
        .eq("id", roleId)
        .single();

      if (error) throw error;
      return RoleModel.fromAPI(data);
    } catch (error) {
      console.error("Error getting role:", error);
      return null;
    }
  }

  /**
   * Get default role for a community
   */
  async getDefaultRole(communityId) {
    try {
      const { data, error } = await supabase
        .from("community_roles")
        .select("*")
        .eq("community_id", communityId)
        .eq("is_default", true)
        .maybeSingle();

      if (error) throw error;
      return data ? RoleModel.fromAPI(data) : null;
    } catch (error) {
      console.error("Error getting default role:", error);
      return null;
    }
  }
}

export default new RoleService();
