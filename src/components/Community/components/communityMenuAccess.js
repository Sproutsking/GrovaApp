export function getCommunityMenuAccess(userPermissions, { isOwner = false, permissionsLoaded = true } = {}) {
  const permissions = permissionsLoaded ? userPermissions || {} : {};
  const isAdministrator = permissions.administrator === true;
  const canManageRoles = isOwner || isAdministrator || permissions.manageRoles === true;
  const canManageCommunity = isOwner || isAdministrator || permissions.manageCommunity === true;
  const canManageChannels = isOwner || isAdministrator || permissions.manageChannels === true;
  const canCreateChannels = isOwner || isAdministrator || permissions.createChannels === true;

  return {
    canManageRoles,
    canManageCommunity,
    canManageChannels,
    canCreateChannels,
    canViewMembers: isOwner || isAdministrator || permissions.viewMembers === true,
    canInviteMembers: isOwner || isAdministrator || permissions.inviteMembers === true || permissions.manageInvites === true,
    canManageBackground: canManageCommunity || canManageChannels,
    canManageCategories: canManageCommunity,
    canManageTools: canManageCommunity,
    canViewAnalytics: canManageCommunity || permissions.viewAnalytics === true,
    canAccessManagement: canManageRoles || canManageCommunity || canManageChannels || canCreateChannels,
  };
}

export function canAccessCommunityMenuView(view, access) {
  switch (view) {
    case "main":
    case "notifications":
      return true;
    case "members":
      return access.canViewMembers;
    case "help":
      return access.canAccessManagement;
    case "settings":
      return access.canManageCommunity;
    case "analytics":
      return access.canViewAnalytics;
    case "roles":
      return access.canManageRoles;
    case "tools":
      return access.canManageTools;
    case "channels":
      return access.canManageChannels;
    case "categories":
      return access.canManageCategories;
    default:
      return false;
  }
}
