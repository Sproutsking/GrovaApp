// src/services/community/permissionService.js
import { supabase } from "../config/supabase";
import RoleModel from "../../models/RoleModel";

function getAvatarUrl(avatarId) {
  if (!avatarId || typeof avatarId !== "string") return "/default-avatar.png";
  if (avatarId.startsWith("http://") || avatarId.startsWith("https://"))
    return avatarId;

  const { data } = supabase.storage.from("avatars").getPublicUrl(avatarId);
  return data?.publicUrl || "/default-avatar.png";
}

class PermissionService {
  /**
   * Fetch all roles for a community
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
        member_count: role.member_count?.[0]?.count || 0,
      }));
    } catch (error) {
      console.error("Error fetching roles:", error);
      throw error;
    }
  }

  /**
   * Fetch all members with their roles and user info
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

      // Transform avatars
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
   * Create a new role
   */
  async createRole(communityId, userId, roleData) {
    try {
      const hasPermission = await this.checkPermission(
        communityId,
        userId,
        "manageRoles",
      );
      if (!hasPermission) {
        throw new Error(
          "Unauthorized: You do not have permission to manage roles",
        );
      }

      const roleModel = new RoleModel({
        ...roleData,
        community_id: communityId,
      });

      const validation = roleModel.validate();
      if (!validation.valid) {
        throw new Error(validation.errors.join(", "));
      }

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
   * Update an existing role
   */
  async updateRole(roleId, userId, updates) {
    try {
      // Get role's community
      const { data: role } = await supabase
        .from("community_roles")
        .select("community_id")
        .eq("id", roleId)
        .single();

      if (!role) throw new Error("Role not found");

      const hasPermission = await this.checkPermission(
        role.community_id,
        userId,
        "manageRoles",
      );
      if (!hasPermission) {
        throw new Error(
          "Unauthorized: You do not have permission to manage roles",
        );
      }

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
   * Delete a role
   */
  async deleteRole(roleId, userId) {
    try {
      // Get role details
      const { data: role } = await supabase
        .from("community_roles")
        .select("community_id, is_default, name")
        .eq("id", roleId)
        .single();

      if (!role) throw new Error("Role not found");
      if (role.is_default) throw new Error("Cannot delete default role");
      if (role.name === "Owner") throw new Error("Cannot delete Owner role");

      const hasPermission = await this.checkPermission(
        role.community_id,
        userId,
        "manageRoles",
      );
      if (!hasPermission) {
        throw new Error(
          "Unauthorized: You do not have permission to manage roles",
        );
      }

      // Check if any members have this role
      const { count } = await supabase
        .from("community_members")
        .select("id", { count: "exact", head: true })
        .eq("role_id", roleId);

      if (count > 0) {
        throw new Error("Cannot delete role that is assigned to members");
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
   * Update a member's role
   */
  async updateMemberRole(memberId, userId, newRoleId, communityId) {
    try {
      const hasPermission = await this.checkPermission(
        communityId,
        userId,
        "assignRoles",
      );
      if (!hasPermission) {
        throw new Error(
          "Unauthorized: You do not have permission to assign roles",
        );
      }

      // Get user's role and target role
      const userRole = await this.getUserRole(communityId, userId);
      const targetRole = await this.getRoleById(newRoleId);

      if (!userRole || !targetRole) {
        throw new Error("Role not found");
      }

      const userRoleModel = RoleModel.fromAPI(userRole);
      const targetRoleModel = RoleModel.fromAPI(targetRole);

      // Check if user can assign this role
      if (!userRoleModel.canManageRole(targetRoleModel)) {
        throw new Error(
          "Cannot assign a role equal to or higher than your own",
        );
      }

      const { error } = await supabase
        .from("community_members")
        .update({ role_id: newRoleId })
        .eq("id", memberId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Error updating member role:", error);
      throw error;
    }
  }

  /**
   * Get user's role in a community
   */
  async getUserRole(communityId, userId) {
    try {
      const { data, error } = await supabase
        .from("community_members")
        .select(`role:community_roles!role_id(*)`)
        .eq("community_id", communityId)
        .eq("user_id", userId)
        .single();

      if (error) return null;
      return data?.role || null;
    } catch (error) {
      console.error("Error getting user role:", error);
      return null;
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

      if (error) return null;
      return data;
    } catch (error) {
      console.error("Error getting role by ID:", error);
      return null;
    }
  }

  /**
   * Check if user has a specific permission
   */
  async checkPermission(communityId, userId, permission) {
    try {
      // Check if owner
      const { data: community } = await supabase
        .from("communities")
        .select("owner_id")
        .eq("id", communityId)
        .single();

      if (community?.owner_id === userId) return true;

      // Get role and check permission
      const role = await this.getUserRole(communityId, userId);
      if (!role) return false;

      const roleModel = RoleModel.fromAPI(role);
      return roleModel.hasPermission(permission);
    } catch (error) {
      console.error("Error checking permission:", error);
      return false;
    }
  }

  /**
   * Get all permissions for a user
   */
  async getUserPermissions(communityId, userId) {
    try {
      // Check if owner
      const { data: community } = await supabase
        .from("communities")
        .select("owner_id")
        .eq("id", communityId)
        .single();

      if (community?.owner_id === userId) {
        const ownerRole = RoleModel.createOwnerRole(communityId);
        return ownerRole.permissions;
      }

      const role = await this.getUserRole(communityId, userId);
      return role ? role.permissions : {};
    } catch (error) {
      console.error("Error getting user permissions:", error);
      return {};
    }
  }

  /**
   * Check if user is owner of community
   */
  async isOwner(communityId, userId) {
    try {
      const { data } = await supabase
        .from("communities")
        .select("owner_id")
        .eq("id", communityId)
        .single();

      return data?.owner_id === userId;
    } catch (error) {
      console.error("Error checking ownership:", error);
      return false;
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
        .single();

      if (error) return null;
      return data;
    } catch (error) {
      console.error("Error getting default role:", error);
      return null;
    }
  }
}

export default new PermissionService();
