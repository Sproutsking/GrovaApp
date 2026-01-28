// src/models/RoleModel.js

/**
 * RoleModel - Represents a community role with permissions and hierarchy
 */
class RoleModel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.communityId = data.community_id || data.communityId || null;
    this.name = data.name || "";
    this.color = data.color || "#95A5A6";
    this.position = data.position || 0;
    this.isDefault = data.is_default || data.isDefault || false;
    this.permissions = data.permissions || this.getDefaultPermissions();
    this.createdAt =
      data.created_at || data.createdAt || new Date().toISOString();
    this.updatedAt =
      data.updated_at || data.updatedAt || new Date().toISOString();
    this.memberCount = data.member_count || data.memberCount || 0;
  }

  /**
   * Get default permissions for a new role
   */
  getDefaultPermissions() {
    return {
      // Messaging permissions
      sendMessages: true,
      attachFiles: true,
      embedLinks: true,
      addReactions: true,
      useExternalEmojis: false,
      mentionEveryone: false,
      useSlashCommands: true,

      // Channel permissions
      viewChannels: true,
      createChannels: false,
      manageChannels: false,
      createPrivateChannels: false,

      // Member permissions
      viewMembers: true,
      inviteMembers: false,
      kickMembers: false,
      banMembers: false,
      manageNicknames: false,
      changeOwnNickname: true,

      // Role permissions
      manageRoles: false,
      assignRoles: false,
      viewRoles: true,

      // Moderation permissions
      manageMessages: false,
      pinMessages: false,
      readMessageHistory: true,
      viewAuditLog: false,
      timeoutMembers: false,
      manageWarnings: false,

      // Community permissions
      manageCommunity: false,
      manageWebhooks: false,
      manageInvites: false,
      viewAnalytics: false,
      manageEmojis: false,

      // Advanced permissions
      administrator: false,
      bypassSlowMode: false,
      prioritySpeaker: false,
      moveMembers: false,
    };
  }

  /**
   * Check if role has a specific permission
   */
  hasPermission(permission) {
    // Administrators have all permissions
    if (this.permissions?.administrator === true) {
      return permission !== "administrator";
    }
    return this.permissions?.[permission] === true;
  }

  /**
   * Get role hierarchy level (lower = more powerful)
   */
  getHierarchyLevel() {
    const hierarchy = {
      Owner: 0,
      Admin: 1,
      Moderator: 2,
      Member: 3,
      Guest: 4,
    };
    return hierarchy[this.name] ?? this.position ?? 99;
  }

  /**
   * Check if this role can manage another role
   * Returns true if this role is higher in hierarchy
   */
  canManageRole(targetRole) {
    if (!(targetRole instanceof RoleModel)) return false;

    // Administrator can manage any role except other administrators
    if (this.hasPermission("administrator")) {
      return !targetRole.hasPermission("administrator");
    }

    // Otherwise compare hierarchy levels
    return this.getHierarchyLevel() < targetRole.getHierarchyLevel();
  }

  /**
   * Check if this is an owner role
   */
  isOwner() {
    return this.name === "Owner";
  }

  /**
   * Check if this is an admin role
   */
  isAdmin() {
    return this.hasPermission("administrator");
  }

  /**
   * Check if this is a moderator role
   */
  isModerator() {
    return (
      this.hasPermission("manageMessages") || this.hasPermission("kickMembers")
    );
  }

  /**
   * Get all enabled permissions
   */
  getEnabledPermissions() {
    if (!this.permissions) return [];
    return Object.entries(this.permissions)
      .filter(([_, enabled]) => enabled === true)
      .map(([key]) => key);
  }

  /**
   * Get permission count
   */
  getPermissionCount() {
    return this.getEnabledPermissions().length;
  }

  /**
   * Convert to JSON for API requests
   */
  toJSON() {
    return {
      id: this.id,
      community_id: this.communityId,
      name: this.name,
      color: this.color,
      position: this.position,
      is_default: this.isDefault,
      permissions: this.permissions,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
    };
  }

  /**
   * Convert to display object
   */
  toDisplayObject() {
    return {
      ...this.toJSON(),
      memberCount: this.memberCount,
      hierarchyLevel: this.getHierarchyLevel(),
      permissionCount: this.getPermissionCount(),
      isOwner: this.isOwner(),
      isAdmin: this.isAdmin(),
      isModerator: this.isModerator(),
    };
  }

  /**
   * Create from API response
   */
  static fromAPI(data) {
    if (!data) return null;
    return new RoleModel(data);
  }

  /**
   * Create multiple instances from API array
   */
  static fromAPIArray(dataArray = []) {
    if (!Array.isArray(dataArray)) return [];
    return dataArray.map((data) => RoleModel.fromAPI(data)).filter(Boolean);
  }

  /**
   * Create a new owner role
   */
  static createOwnerRole(communityId) {
    return new RoleModel({
      community_id: communityId,
      name: "Owner",
      color: "#FFD700",
      position: 0,
      is_default: false,
      permissions: {
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
      },
    });
  }

  /**
   * Create a new default member role
   */
  static createMemberRole(communityId) {
    return new RoleModel({
      community_id: communityId,
      name: "Member",
      color: "#95A5A6",
      position: 1,
      is_default: true,
      permissions: {
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
      },
    });
  }

  /**
   * Validate role data
   */
  static validate(data) {
    const errors = [];

    if (!data.name || data.name.trim().length === 0) {
      errors.push("Role name is required");
    }

    if (data.name && (data.name.length < 1 || data.name.length > 50)) {
      errors.push("Role name must be between 1 and 50 characters");
    }

    if (data.color && !/^#[0-9A-F]{6}$/i.test(data.color)) {
      errors.push("Invalid color format (must be hex: #RRGGBB)");
    }

    if (
      data.position !== undefined &&
      (data.position < 0 || data.position > 999)
    ) {
      errors.push("Position must be between 0 and 999");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate this instance
   */
  validate() {
    return RoleModel.validate(this);
  }

  /**
   * Clone this role
   */
  clone() {
    return new RoleModel(this.toJSON());
  }

  /**
   * Compare with another role for sorting
   */
  compareTo(other) {
    if (!(other instanceof RoleModel)) return 0;
    return this.position - other.position;
  }
}

export default RoleModel;
