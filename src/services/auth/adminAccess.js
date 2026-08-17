export function hasAdminProfileFlag(profile) {
  if (!profile || typeof profile !== "object") return false;

  const role = profile.role || "";
  return !!(
    profile.is_admin ||
    profile.is_super_admin ||
    role === "admin" ||
    role === "super_admin" ||
    role === "ceo_owner" ||
    role === "a_admin" ||
    role === "b_admin" ||
    role === "support"
  );
}
