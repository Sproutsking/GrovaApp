export function hasAdminProfileFlag(profile) {
  // Security rule: admin authority is determined only by the live `admin_team` membership.
  // Profile flags are not trusted and must never grant front-end admin access.
  return false;
}
