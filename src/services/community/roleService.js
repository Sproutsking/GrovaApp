// src/services/community/roleService.js
import { supabase } from "../config/supabase";
import RoleModel from "../../models/RoleModel";
import { accessRuleAllowsPermission, resolveAccessForRole } from "./accessService";

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
          member_count:community_member_roles(count)
        `,
        )
        .eq("community_id", communityId)
        .order("position", { ascending: true });

      if (error) throw error;

      return (data || []).map((role) => ({
        ...role,
        members: role.member_count?.[0]?.count || 0,
      })).sort((left, right) =>
        Number(String(right.name || "").trim().toLowerCase() === "owner")
        - Number(String(left.name || "").trim().toLowerCase() === "owner")
        || (left.position ?? 99) - (right.position ?? 99),
      );
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
      if (!role) return false;

      const roleModel = RoleModel.fromAPI(role);

      if (roleModel.hasPermission("administrator")) {
        return true;
      }

      if (!role.id) return roleModel.hasPermission("viewChannels");

      const { data: allChannels } = await supabase
        .from("community_channels")
        .select("id,name,category,category_id,is_private")
        .eq("community_id", communityId);

      const targetChannel = (allChannels || []).find((channel) => channel.id === channelName || channel.name === channelName) || null;
      const rules = await this.getAccessRulesForCommunity(communityId);
      const access = resolveAccessForRole({
        roleId: role.id,
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
      throw error;
    }
  }

  async getVisibleChannels(communityId, userId, allChannels) {
    try {
      const role = await this.getUserRole(communityId, userId);
      if (!role) return [];

      const roleModel = RoleModel.fromAPI(role);
      if (roleModel.hasPermission("administrator")) return allChannels || [];

      if (!role.id) return (allChannels || []).filter((channel) => roleModel.hasPermission("viewChannels") && !channel.is_private);

      const [rules, verificationResult] = await Promise.all([
        this.getAccessRulesForCommunity(communityId),
        supabase.rpc("get_verification_panel", { p_community_id: communityId }),
      ]);
      if (verificationResult.error) throw verificationResult.error;
      const verificationConfig = verificationResult.data?.configured
        ? verificationResult.data.config || {}
        : {};
      const rulesGate = verificationConfig.rulesGate || {};
      const rulesAccepted = (verificationResult.data?.completions || []).some((completion) =>
        completion.method === "rules" && ["rules_accepted", "completed"].includes(completion.status),
      );
      return (allChannels || []).filter((channel) => {
        if (rulesGate.enabled && channel.id === rulesGate.rulesChannelId) return true;
        if (
          rulesGate.enabled
          && rulesGate.flow === "rules_then_verify"
          && rulesAccepted
          && channel.id === rulesGate.verificationChannelId
        ) return true;
        const access = resolveAccessForRole({
          roleId: role.id,
          channel,
          categoryId: channel.category_id ?? channel.category ?? null,
          rules,
          defaultOpen: roleModel.hasPermission("viewChannels") && !channel.is_private,
        });
        return access.canView;
      });
    } catch (error) {
      console.error("Error getting visible channels:", error);
      return [];
    }
  }

  async getChannelPermission(communityId, userId, channel, permission) {
    try {
      if (!communityId || !userId || !channel?.id) return false;
      const role = await this.getUserRole(communityId, userId);
      if (!role) return false;
      const roleModel = RoleModel.fromAPI(role);
      if (roleModel.hasPermission("administrator")) return true;
      if (!role.id) return true;

      const rules = await this.getAccessRulesForCommunity(communityId);
      const access = resolveAccessForRole({
        roleId: role.id,
        channel,
        categoryId: channel.category_id ?? channel.category ?? null,
        rules,
        defaultOpen: roleModel.hasPermission("viewChannels") && !channel.is_private,
      });

      if (!accessRuleAllowsPermission(access, permission)) return false;

      const { data: channelOverride, error: channelOverrideError } = await supabase
        .from("channel_permission_overrides")
        .select("state")
        .eq("channel_id", channel.id)
        .eq("role_id", role.id)
        .eq("permission", permission)
        .maybeSingle();
      if (channelOverrideError) throw channelOverrideError;
      if (channelOverride?.state) return channelOverride.state === "allow";

      if (channel.category_id || channel.category) {
        let categoryQuery = supabase
          .from("community_channel_categories")
          .select("id")
          .eq("community_id", communityId);
        categoryQuery = channel.category_id
          ? categoryQuery.eq("id", channel.category_id)
          : categoryQuery.eq("name", channel.category);
        const { data: category, error: categoryError } = await categoryQuery.maybeSingle();
        if (categoryError) throw categoryError;
        if (category?.id) {
          const { data: categoryOverride, error: categoryOverrideError } = await supabase
            .from("category_permission_overrides")
            .select("state")
            .eq("category_id", category.id)
            .eq("role_id", role.id)
            .eq("permission", permission)
            .eq("apply_to_channels", true)
            .maybeSingle();
          if (categoryOverrideError) throw categoryOverrideError;
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
      if (!actorUserId || !(await this.hasPermission(existingRole.community_id, actorUserId, "manageRoles"))) {
        throw new Error("You do not have permission to manage roles");
      }
      const { data: community, error: communityError } = await supabase
        .from("communities")
        .select("owner_id")
        .eq("id", existingRole.community_id)
        .single();
      if (communityError) throw communityError;
      const isOwnerRole = String(existingRole.name || "").trim().toLowerCase() === "owner";
      const isCommunityOwner = community?.owner_id === actorUserId;
      if (isOwnerRole && !isCommunityOwner) {
        throw new Error("Only the community owner can edit the Owner role.");
      }
      const actorRole = await this.getUserRole(existingRole.community_id, actorUserId);
      const targetRole = RoleModel.fromAPI(existingRole);
      if (!isCommunityOwner && (targetRole.isOwner() || (actorRole && !RoleModel.fromAPI(actorRole).canManageRole(targetRole)))) {
        throw new Error("You cannot manage this role");
      }
      const allowedUpdates = (({ name, color, icon, permissions }) => ({ name, color, icon, permissions }))(updates || {});
      if (isOwnerRole) allowedUpdates.name = existingRole.name;
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
    const owner = orderedRoles.find((role) => String(role.name || "").trim().toLowerCase() === "owner");
    const actorRole = await this.getUserRole(communityId, actorUserId);
    if (owner && actorRole && !RoleModel.fromAPI(actorRole).isOwner() && !RoleModel.fromAPI(actorRole).canManageRole(RoleModel.fromAPI(owner))) {
      throw new Error("You cannot reorder the Owner role");
    }
    const fixedOrder = owner
      ? [owner, ...orderedRoles.filter((role) => role.id !== owner.id)]
      : orderedRoles;
    const results = await Promise.all(fixedOrder.map((role, position) =>
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

      const members = data || [];
      const { data: assignments, error: assignmentsError } = await supabase
        .from("community_member_roles")
        .select("user_id, role:community_roles!role_id(id,name,color,icon,position,permissions,is_default)")
        .eq("community_id", communityId);
      if (assignmentsError) throw assignmentsError;
      const [{ data: community, error: communityError }, { data: ownerRoles, error: ownerRoleError }] = await Promise.all([
        supabase.from("communities").select("owner_id").eq("id", communityId).single(),
        supabase.from("community_roles").select("id,name,color,icon,position,permissions,is_default").eq("community_id", communityId).ilike("name", "owner").limit(1),
      ]);
      if (communityError) throw communityError;
      if (ownerRoleError) throw ownerRoleError;
      const ownerRole = ownerRoles?.[0] || { ...RoleModel.createOwnerRole(communityId).toJSON(), id: null };
      const byUser = new Map();
      (assignments || []).forEach((assignment) => {
        if (!assignment.role) return;
        byUser.set(assignment.user_id, [...(byUser.get(assignment.user_id) || []), assignment.role]);
      });

      return members.map((member) => {
        const memberRoles = byUser.get(member.user_id) || [member.role].filter(Boolean);
        if (member.user_id === community?.owner_id && !memberRoles.some((role) => role.id === ownerRole.id)) {
          memberRoles.unshift(ownerRole);
        }
        const assignedRoles = memberRoles
          .sort((left, right) =>
            Number(String(right.name || "").trim().toLowerCase() === "owner")
            - Number(String(left.name || "").trim().toLowerCase() === "owner")
            || (left.position ?? 99) - (right.position ?? 99),
          );
        const role = assignedRoles[0] || member.role;
        return {
          ...member,
          role_id: role?.id || null,
          role,
          roles: assignedRoles,
          user: member.user
            ? { ...member.user, avatar: getAvatarUrl(member.user.avatar_id) }
            : null,
        };
      });
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
      const { data: member, error: memberError } = await supabase
        .from("community_members")
        .select("community_id, user_id")
        .eq("id", memberId)
        .single();
      if (memberError) throw memberError;
      if (!member) throw new Error("Member not found");
      if (actorUserId) {
        const allowed = await this.hasPermission(member.community_id, actorUserId, "assignRoles");
        if (!allowed) throw new Error("You do not have permission to assign roles");
        if (member.user_id === actorUserId) throw new Error("You cannot change your own role");
      }
      const { data: targetRole, error: targetRoleError } = await supabase
        .from("community_roles")
        .select("name")
        .eq("id", roleId)
        .eq("community_id", member.community_id)
        .single();
      if (targetRoleError) throw targetRoleError;
      if (targetRole?.name?.toLowerCase() === "owner") throw new Error("The Owner role cannot be assigned");
      const { error } = await supabase.rpc("assign_community_member_role", {
        p_community_id: member.community_id,
        p_user_id: member.user_id,
        p_role_id: roleId,
      });
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
      const { data: community, error: communityError } = await supabase
        .from("communities")
        .select("owner_id")
        .eq("id", communityId)
        .single();
      if (communityError) throw communityError;
      if (community?.owner_id === userId) {
        const { data: ownerRole, error: ownerRoleError } = await supabase
          .from("community_roles")
          .select("*")
          .eq("community_id", communityId)
          .ilike("name", "owner")
          .limit(1)
          .maybeSingle();
        if (ownerRoleError) throw ownerRoleError;
        return RoleModel.fromAPI(ownerRole || RoleModel.createOwnerRole(communityId));
      }
      const { data, error } = await supabase
        .from("community_member_roles")
        .select("role:community_roles!role_id(*)")
        .eq("community_id", communityId)
        .eq("user_id", userId);

      if (error) throw error;
      const roles = (data || []).map((row) => row.role).filter(Boolean);
      roles.sort((left, right) =>
        Number(String(right.name || "").trim().toLowerCase() === "owner")
        - Number(String(left.name || "").trim().toLowerCase() === "owner")
        || (left.position ?? 99) - (right.position ?? 99),
      );
      return roles[0] ? RoleModel.fromAPI(roles[0]) : null;
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
