import { buildVerificationDashboardSections } from "./verificationDashboardModel";

const normalizeProvider = (provider) => String(provider || "").trim().toLowerCase();

export function buildProfileRecordSummary({
  evidenceItems = [],
  xrdRecords = [],
  identityBindings = [],
  connectedPlatforms = [],
  evidenceCount,
  verifiedCount,
  xrdRecordCount,
  socialLinks = {},
} = {}) {
  const evidence = Array.isArray(evidenceItems) ? evidenceItems : [];
  const claims = Array.isArray(xrdRecords) ? xrdRecords : [];
  const bindings = Array.isArray(identityBindings) ? identityBindings : [];
  const connections = Array.isArray(connectedPlatforms) ? connectedPlatforms : [];
  const sources = new Set();
  const institutions = new Set();

  evidence.forEach((item) => {
    const provider = normalizeProvider(item?.provider);
    if (provider) sources.add(provider);

    const entityType = String(
      item?.entity_type
      || item?.entityType
      || item?.metadata?.entity_type
      || item?.metadata?.entityType
      || "",
    ).toLowerCase();
    if (!["institution", "organization"].includes(entityType)) return;

    const institution = item?.metadata?.institution
      || item?.metadata?.organization
      || item?.title
      || provider;
    if (institution) institutions.add(String(institution).trim().toLowerCase());
  });

  bindings.forEach((binding) => {
    if (binding?.revoked_at || !["claimed", "pending", "bound", "verified"].includes(binding?.status)) return;
    const provider = normalizeProvider(binding?.provider);
    if (provider) sources.add(provider);
    if (binding?.status === "verified" && binding?.assurance_scope === "institutional_attestation" && provider) {
      institutions.add(provider);
    }
  });

  connections.forEach((connection) => {
    if (connection?.auth_status !== "active") return;
    const provider = normalizeProvider(connection?.provider);
    if (provider) sources.add(provider);
  });

  Object.entries(socialLinks || {}).forEach(([provider, url]) => {
    if (typeof url === "string" && /^https?:\/\//i.test(url)) {
      const normalized = normalizeProvider(provider);
      if (normalized) sources.add(normalized);
    }
  });

  return {
    records: (Number.isFinite(evidenceCount) ? evidenceCount : evidence.length)
      + (Number.isFinite(xrdRecordCount) ? xrdRecordCount : claims.length),
    verified: Number.isFinite(verifiedCount)
      ? verifiedCount
      : evidence.filter((item) => item?.verified === true).length,
    sources: sources.size,
    institutions: institutions.size,
  };
}

export function getPublicProfileEvidenceItems(evidenceItems = []) {
  const items = Array.isArray(evidenceItems) ? evidenceItems : [];
  return items.filter((item) => item?.verified === true
    && String(item?.metadata?.visibility || "PUBLIC").toUpperCase() === "PUBLIC"
    && !["comment", "reply", "like"].includes(String(item?.evidence_type || item?.type || "").toLowerCase())
    && !["comment", "reply", "like"].includes(String(item?.metadata?.kind || "").toLowerCase()));
}

export function buildPublicProfileDashboard(profile, evidenceItems = [], { isOwner = false } = {}) {
  const normalized = isOwner
    ? (Array.isArray(evidenceItems) ? evidenceItems : [])
    : getPublicProfileEvidenceItems(evidenceItems);
  const sections = buildVerificationDashboardSections(normalized, {
    username: profile?.username || profile?.fullName || profile?.handle || "profile",
    isOwner,
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
