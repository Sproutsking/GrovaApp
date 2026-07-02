import { buildVerificationDashboardSections } from "./verificationDashboardModel";

export function buildPublicProfileDashboard(profile, evidenceItems = []) {
  const normalized = Array.isArray(evidenceItems) ? evidenceItems : [];
  const sections = buildVerificationDashboardSections(normalized, {
    username: profile?.username || profile?.fullName || profile?.handle || "profile",
  });

  return {
    profileSummary: {
      displayName: profile?.fullName || profile?.name || profile?.username || "Unknown",
      username: profile?.username || "unknown",
      bio: profile?.bio || null,
      verified: Boolean(profile?.verified),
      trustSignals: normalized.filter((item) => item?.verified).length,
    },
    sections,
  };
}
