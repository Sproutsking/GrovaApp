// ============================================================================
// src/services/messages/GroupAdminManager.js — GROUP ADMIN & TIER SYSTEM v1
// ============================================================================
// FEATURES:
//  [G1] Group admin system (2 admins + 1 owner = 3 total admins)
//  [G2] Permission-based access (admin actions vs member actions)
//  [G3] Tier-based member limits:
//       - Normal: 6 members
//       - Silver: 12 members
//       - Gold: 20 members
//       - Diamond: 30 members
//  [G4] Owner can assign/revoke admin status
//  [G5] Admins can manage members, mute/unmute, kick
//  [G6] Group profile image updates
//  [G7] Permission system for visibility
// ============================================================================

import { supabase } from "../config/supabase";

export const TIER_MEMBER_LIMITS = {
  normal: 6,
  silver: 12,
  gold: 20,
  diamond: 30,
};

export const ADMIN_PERMISSIONS = {
  can_manage_members: true,
  can_edit_group_info: true,
  can_delete_messages: true,
  can_kick_members: true,
  can_mute_members: true,
  can_promote_members: false, // Only owner
};

export const MEMBER_PERMISSIONS = {
  can_send_messages: true,
  can_react: true,
  can_reply: true,
  can_edit_own_messages: true,
};

class GroupAdminManager {
  /**
   * Get member tier based on user account type
   */
  getMemberTier(user) {
    if (!user) return "normal";
    
    const profile = user.profile_tier || user.tier || "normal";
    return profile.toLowerCase();
  }

  /**
   * Get max members allowed based on tier
   */
  getMaxMembers(userTier) {
    return TIER_MEMBER_LIMITS[userTier] || TIER_MEMBER_LIMITS.normal;
  }

  /**
   * Validate if user can add new member to group
   */
  canAddMember(group, ownerTier, currentMemberCount) {
    const maxMembers = this.getMaxMembers(ownerTier);
    return currentMemberCount < maxMembers;
  }

  /**
   * Create group admin setup
   */
  async setupGroupAdmins(groupId, ownerId, initialAdminIds = []) {
    try {
      // Owner is automatically admin
      const adminIds = new Set([ownerId]);
      
      // Add up to 2 additional admins
      for (let i = 0; i < Math.min(2, initialAdminIds.length); i++) {
        if (initialAdminIds[i] !== ownerId) {
          adminIds.add(initialAdminIds[i]);
        }
      }

      // Store in group metadata
      await supabase
        .from("group_chats")
        .update({
          owner_id: ownerId,
          admin_ids: Array.from(adminIds),
          updated_at: new Date().toISOString(),
        })
        .eq("id", groupId);

      return Array.from(adminIds);
    } catch (e) {
      console.error("[GroupAdminManager] setupGroupAdmins:", e.message);
      return [ownerId];
    }
  }

  /**
   * Check if user is admin in group
   */
  isAdmin(user, group) {
    if (!user || !group) return false;
    
    const isOwner = group.owner_id === user.id;
    const isAdmin = Array.isArray(group.admin_ids) && 
                    group.admin_ids.includes(user.id);
    
    return isOwner || isAdmin;
  }

  /**
   * Check if user is owner of group
   */
  isOwner(user, group) {
    if (!user || !group) return false;
    return group.owner_id === user.id;
  }

  /**
   * Promote member to admin (owner only)
   */
  async promoteToAdmin(groupId, memberId, currentUser, group) {
    try {
      if (!this.isOwner(currentUser, group)) {
        throw new Error("Only group owner can promote members");
      }

      const adminIds = Array.isArray(group.admin_ids) ? [...group.admin_ids] : [];
      
      // Limit to 2 additional admins (3 total with owner)
      if (adminIds.length >= 2) {
        throw new Error("Group already has maximum admins");
      }

      if (!adminIds.includes(memberId)) {
        adminIds.push(memberId);
      }

      await supabase
        .from("group_chats")
        .update({
          admin_ids: adminIds,
          updated_at: new Date().toISOString(),
        })
        .eq("id", groupId);

      return true;
    } catch (e) {
      console.error("[GroupAdminManager] promoteToAdmin:", e.message);
      return false;
    }
  }

  /**
   * Demote admin to member (owner only)
   */
  async demoteFromAdmin(groupId, adminId, currentUser, group) {
    try {
      if (!this.isOwner(currentUser, group)) {
        throw new Error("Only group owner can demote admins");
      }

      const adminIds = (Array.isArray(group.admin_ids) ? group.admin_ids : [])
        .filter(id => id !== adminId);

      await supabase
        .from("group_chats")
        .update({
          admin_ids: adminIds,
          updated_at: new Date().toISOString(),
        })
        .eq("id", groupId);

      return true;
    } catch (e) {
      console.error("[GroupAdminManager] demoteFromAdmin:", e.message);
      return false;
    }
  }

  /**
   * Update group profile image
   */
  async updateGroupImage(groupId, imageId, currentUser, group) {
    try {
      if (!this.isAdmin(currentUser, group)) {
        throw new Error("Only admins can update group image");
      }

      await supabase
        .from("group_chats")
        .update({
          avatar_id: imageId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", groupId);

      return true;
    } catch (e) {
      console.error("[GroupAdminManager] updateGroupImage:", e.message);
      return false;
    }
  }

  /**
   * Kick member from group (admin+)
   */
  async kickMember(groupId, memberId, currentUser, group) {
    try {
      if (!this.isAdmin(currentUser, group)) {
        throw new Error("Only admins can kick members");
      }

      // Remove from members list
      const members = (Array.isArray(group.members) ? group.members : [])
        .filter(m => m.id !== memberId);

      await supabase
        .from("group_chats")
        .update({
          members: members,
          updated_at: new Date().toISOString(),
        })
        .eq("id", groupId);

      return true;
    } catch (e) {
      console.error("[GroupAdminManager] kickMember:", e.message);
      return false;
    }
  }

  /**
   * Mute member in group (admin+)
   */
  async muteMember(groupId, memberId, currentUser, group, isMuted = true) {
    try {
      if (!this.isAdmin(currentUser, group)) {
        throw new Error("Only admins can mute members");
      }

      const mutedIds = isMuted 
        ? [...(Array.isArray(group.muted_members) ? group.muted_members : []), memberId]
        : (Array.isArray(group.muted_members) ? group.muted_members : [])
            .filter(id => id !== memberId);

      await supabase
        .from("group_chats")
        .update({
          muted_members: mutedIds,
          updated_at: new Date().toISOString(),
        })
        .eq("id", groupId);

      return true;
    } catch (e) {
      console.error("[GroupAdminManager] muteMember:", e.message);
      return false;
    }
  }

  /**
   * Get user permissions in group
   */
  getPermissions(user, group) {
    const isAdmin = this.isAdmin(user, group);
    const isOwner = this.isOwner(user, group);

    return {
      ...MEMBER_PERMISSIONS,
      ...(isAdmin ? ADMIN_PERMISSIONS : {}),
      can_promote_members: isOwner, // Only owner
      is_admin: isAdmin,
      is_owner: isOwner,
    };
  }

  /**
   * Validate group operation
   */
  validateGroupOperation(operation, currentUser, group) {
    const perms = this.getPermissions(currentUser, group);

    const operationPerms = {
      kick_member: perms.can_kick_members,
      mute_member: perms.can_mute_members,
      promote_member: perms.is_owner,
      demote_admin: perms.is_owner,
      update_image: perms.can_edit_group_info,
      delete_message: perms.can_delete_messages,
      delete_group: perms.is_owner,
    };

    return operationPerms[operation] || false;
  }
}

export default new GroupAdminManager();
