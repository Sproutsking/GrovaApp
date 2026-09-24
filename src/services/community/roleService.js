// src/services/community/roleService.js
import { supabase } from "../config/supabase";
import RoleModel from "../../models/RoleModel";
import { resolveAccessForRole } from "./accessService";

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
   * Create a new role (creates a "Novice" role with restricted permissions)
   */
  async createRole(roleData, communityId, actorUserId) {
    try {
      if (!actorUserId || !(await this.hasPermission(communityId, actorUserId, "manageRoles"))) {
        throw new Error("You do not have permission to manage roles");
      }

      // Validate role data
      const validation = RoleModel.validate(roleData);
      if (!validation.valid) {
        throw new Error(validation.errors.join(", "));
      }

      // Keep the default novice role restricted even when older UI text uses "Novis".
      let permissions = roleData.permissions;
      if (["novis", "novice"].includes(roleData.name.trim().toLowerCase())) {
        permissions = this.getNovicePermissions();
      }

      const { data: lastRole } = await supabase
        .from("community_roles")
        .select("position")
        .eq("community_id", communityId)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      const roleModel = new RoleModel({
        ...roleData,
        community_id: communityId,
        position: (lastRole?.position ?? -1) + 1,
        permissions: permissions,
      });

      const payload = roleModel.toJSON();
      if (
        payload.id == null ||
        ["null", "undefined", ""].includes(String(payload.id).trim().toLowerCase())
      ) {
        delete payload.id;
      }

      const { data, error } = await supabase
        .from("community_roles")
        .insert(payload)
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
   * Get the intentionally minimal permissions for a newly joined member.
   */
  getNovicePermissions() {
    return {
      sendMessages: false,
      attachFiles: false,
      embedLinks: false,
      addReactions: true,
      useExternalEmojis: false,
      mentionEveryone: false,
      useSlashCommands: false,
      viewChannels: true, // Can only see verification and welcome channels
      createChannels: false,
      manageChannels: false,
      createPrivateChannels: false,
      viewMembers: false,
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
      readMessageHistory: false,
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

  getNovisPermissions() {
    return this.getNovicePermissions();
  }

  /**
   * Check if user can view a specific channel based on their role
   */
  async canViewChannel(communityId, userId, channelName) {
    try {
      const role = await this.getUserRole(communityId, userId);
      if (!role) return true;

      const roleModel = RoleModel.fromAPI(role);

      if (roleModel.hasPermission("administrator")) {
        return true;
      }

      const { data: membership } = await supabase
        .from("community_members")
        .select("role_id")
        .eq("community_id", communityId)
        .eq("user_id", userId)
        .maybeSingle();

      if (!membership?.role_id) return roleModel.hasPermission("viewChannels");

      const { data: allChannels } = await supabase
        .from("community_channels")
        .select("id,name,category,category_id,is_private")
        .eq("community_id", communityId);

      const targetChannel = (allChannels || []).find((channel) => channel.id === channelName || channel.name === channelName) || null;
      const rules = await this.getAccessRulesForCommunity(communityId);
      const access = resolveAccessForRole({
        roleId: membership.role_id,
        channel: targetChannel,
        categoryId: targetChannel?.category_id ?? targetChannel?.category ?? null,
        rules,
        defaultOpen: roleModel.hasPermission("viewChannels") && !targetChannel?.is_private,
      });

      return access.canView;
    } catch (error) {
      console.error("Error checking channel view permission:", error);
      return false;
    }
  }

  /**
   * Get channels visible to user based on their role
   */
  async getAccessRulesForCommunity(communityId) {
    try {
      const { data, error } = await supabase
        .from("community_access_rules")
        .select("community_id,target_type,target_id,role_id,can_view,can_send")
        .eq("community_id", communityId);
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error loading community access rules:", error);
      return [];
    }
  }

  async getVisibleChannels(communityId, userId, allChannels) {
    try {
      const role = await this.getUserRole(communityId, userId);
      if (!role) return (allChannels || []).filter((channel) => !channel.is_private);

      const roleModel = RoleModel.fromAPI(role);
      if (roleModel.hasPermission("administrator")) return allChannels || [];

      const { data: membership } = await supabase
        .from("community_members")
        .select("role_id")
        .eq("community_id", communityId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!membership?.role_id) return (allChannels || []).filter((channel) => roleModel.hasPermission("viewChannels") && !channel.is_private);

      const rules = await this.getAccessRulesForCommunity(communityId);
      return (allChannels || []).filter((channel) => {
        const access = resolveAccessForRole({
          roleId: membership.role_id,
          channel,
          categoryId: channel.category_id ?? channel.category ?? null,
          rules,
          defaultOpen: roleModel.hasPermission("viewChannels") && !channel.is_private,
        });
        return access.canView;
      });
    } catch (error) {
      console.error("Error getting visible channels:", error);
      return (allChannels || []).filter((channel) => !channel.is_private);
    }
  }

  async getChannelPermission(communityId, userId, channel, permission) {
    try {
      if (!communityId || !userId || !channel?.id) return false;
      const role = await this.getUserRole(communityId, userId);
      if (!role) return false;
      const roleModel = RoleModel.fromAPI(role);
      if (roleModel.hasPermission("administrator")) return true;
      const { data: membership } = await supabase
        .from("community_members")
        .select("role_id")
        .eq("community_id", communityId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!membership?.role_id) return true;

      const rules = await this.getAccessRulesForCommunity(communityId);
      const access = resolveAccessForRole({
        roleId: membership.role_id,
        channel,
        categoryId: channel.category_id ?? channel.category ?? null,
        rules,
        defaultOpen: roleModel.hasPermission("viewChannels") && !channel.is_private,
      });

      if (access.restricted && !access.canView) return false;
      if (permission === "sendMessages" && access.restricted && !access.canSend) return false;
      if (permission === "attachFiles" && access.restricted && !access.canSend) return false;
      if (permission === "addReactions" && access.restricted && !access.canSend) return false;
      if (permission === "mentionEveryone" && access.restricted && !access.canSend) return false;

      const { data: channelOverride } = await supabase
        .from("channel_permission_overrides")
        .select("state")
        .eq("channel_id", channel.id)
        .eq("role_id", membership.role_id)
        .eq("permission", permission)
        .maybeSingle();
      if (channelOverride?.state) return channelOverride.state === "allow";

      if (channel.category) {
        const { data: category } = await supabase
          .from("community_channel_categories")
          .select("id")
          .eq("community_id", communityId)
          .eq("name", channel.category)
          .maybeSingle();
        if (category?.id) {
          const { data: categoryOverride } = await supabase
            .from("category_permission_overrides")
            .select("state")
            .eq("category_id", category.id)
            .eq("role_id", membership.role_id)
            .eq("permission", permission)
            .eq("apply_to_channels", true)
            .maybeSingle();
          if (categoryOverride?.state) return categoryOverride.state === "allow";
        }
      }
      return roleModel.hasPermission(permission);
    } catch (error) {
      console.error("Error checking channel permission:", error);
      return false;
    }
  }

  /**
   * Update role
   */
  async updateRole(roleId, updates, actorUserId) {
    try {
      const { data: existingRole, error: roleError } = await supabase
        .from("community_roles")
        .select("*")
        .eq("id", roleId)
        .single();
      if (roleError || !existingRole) throw new Error("Role not found");
      if (String(existingRole.name || "").trim().toLowerCase() === "owner") {
        throw new Error("The owner role is protected and cannot be edited by other admins.");
      }
      if (!actorUserId || !(await this.hasPermission(existingRole.community_id, actorUserId, "manageRoles"))) {
        throw new Error("You do not have permission to manage roles");
      }
      const actorRole = await this.getUserRole(existingRole.community_id, actorUserId);
      const targetRole = RoleModel.fromAPI(existingRole);
      if (targetRole.isOwner() || (actorRole && !RoleModel.fromAPI(actorRole).canManageRole(targetRole))) {
        throw new Error("You cannot manage this role");
      }
      const allowedUpdates = (({ name, color, icon, permissions }) => ({ name, color, icon, permissions }))(updates || {});
      const { data, error } = await supabase
        .from("community_roles")
        .update({
          ...allowedUpdates,
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

  async reorderRoles(roles, communityId, actorUserId) {
    if (!actorUserId || !(await this.hasPermission(communityId, actorUserId, "manageRoles"))) {
      throw new Error("You do not have permission to manage roles");
    }
    const orderedRoles = (roles || []).filter((role) => role.community_id === communityId);
    const owner = orderedRoles.find((role) => role.name === "Owner");
    const actorRole = await this.getUserRole(communityId, actorUserId);
    if (owner && actorRole && !RoleModel.fromAPI(actorRole).isOwner() && !RoleModel.fromAPI(actorRole).canManageRole(RoleModel.fromAPI(owner))) {
      throw new Error("You cannot reorder the Owner role");
    }
    const results = await Promise.all(orderedRoles.map((role, position) =>
      supabase.from("community_roles").update({ position, updated_at: new Date().toISOString() }).eq("id", role.id).eq("community_id", communityId),
    ));
    const failed = results.find((result) => result.error);
    if (failed) throw failed.error;
    return true;
  }

  /**
   * Delete role
   */
  async deleteRole(roleId) {
    try {
      const { data: role } = await supabase
        .from("community_roles")
        .select("name, is_default")
        .eq("id", roleId)
        .single();

      if (!role) {
        throw new Error("Role not found");
      }
      if (String(role.name || "").trim().toLowerCase() === "owner") {
        throw new Error("The owner role is protected and cannot be deleted.");
      }
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
          role:community_roles!role_id(id, name, color, icon)
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
  async updateMemberRole(memberId, roleId, actorUserId) {
    try {
      const { data: member } = await supabase
        .from("community_members")
        .select("community_id, user_id")
        .eq("id", memberId)
        .single();
      if (!member) throw new Error("Member not found");
      if (actorUserId) {
        const allowed = await this.hasPermission(member.community_id, actorUserId, "assignRoles");
        if (!allowed) throw new Error("You do not have permission to assign roles");
        if (member.user_id === actorUserId) throw new Error("You cannot change your own role");
      }
      const { data: targetRole } = await supabase
        .from("community_roles")
        .select("name")
        .eq("id", roleId)
        .single();
      if (targetRole?.name?.toLowerCase() === "owner") throw new Error("The Owner role cannot be assigned");
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
