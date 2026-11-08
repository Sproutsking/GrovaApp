const isPublicEvidence = (item, profileId) => (
  item?.verified === true
  && String(item?.metadata?.visibility || "PUBLIC").toUpperCase() === "PUBLIC"
  && (!profileId || !item?.profile_id || String(item.profile_id) === String(profileId))
);

const isPublicClaim = (claim) => (
  claim?.lifecycle_status === "published"
  && String(claim?.visibility || "").toLowerCase() === "public"
);

const isPublicEdge = (edge) => {
  const visibility = edge?.visibility ?? edge?.metadata?.visibility;
  return visibility == null || String(visibility).toLowerCase() === "public";
};

const publicEvidenceMetadata = (metadata = {}) => {
  const allowedFields = new Set([
    "visibility",
    "status",
    "username",
    "handle",
    "avatarUrl",
    "avatar_url",
    "profile_image_url",
    "profileImageUrl",
    "entityType",
    "entity_type",
    "institution",
  ]);
  return Object.fromEntries(
    Object.entries(metadata || {}).filter(([key, value]) => allowedFields.has(key) && value != null),
  );
};

export const projectXrdPublicView = (data = {}, isPublicView = true) => {
  if (!isPublicView) return data;

  const {
    evidenceItems = [],
    claims = [],
    bindings = [],
    edges = [],
    identityDetails = {},
    grantedEvidenceIds = [],
    profileId,
  } = data;
  const authorizedIds = new Set((Array.isArray(grantedEvidenceIds) ? grantedEvidenceIds : []).map(String));
  const publicEvidence = (Array.isArray(evidenceItems) ? evidenceItems : [])
    .filter((item) => isPublicEvidence(item, profileId)
      || (item?.id && authorizedIds.has(String(item.id))
        && (!profileId || !item?.profile_id || String(item.profile_id) === String(profileId))))
    .map((item) => {
      const publicItem = { ...item, metadata: publicEvidenceMetadata(item.metadata) };
      delete publicItem.raw;
      delete publicItem.external_id;
      delete publicItem.connection_id;
      delete publicItem.profile_id;
      return publicItem;
    });
  const publicEvidenceIds = new Set(publicEvidence.map((item) => item?.id).filter(Boolean));
  const publicClaims = (Array.isArray(claims) ? claims : [])
    .filter(isPublicClaim)
    .map((claim) => ({
      id: claim.id,
      record_type: claim.record_type,
      title: claim.title,
      claim_text: claim.claim_text,
      structured_claim: claim.structured_claim,
      lifecycle_status: claim.lifecycle_status,
      visibility: claim.visibility,
      created_at: claim.created_at,
      evidence_links: (Array.isArray(claim.evidence_links) ? claim.evidence_links : [])
        .filter((link) => publicEvidenceIds.has(link?.evidence_item_id))
        .map(({ evidence_item_id, relation }) => ({ evidence_item_id, relation })),
    }));

  return {
    ...data,
    evidenceItems: publicEvidence,
    claims: publicClaims,
    bindings: (Array.isArray(bindings) ? bindings : [])
      .filter((binding) => String(binding?.visibility || "").toLowerCase() === "public")
      .map((binding) => ({
        id: binding.id,
        provider: binding.provider,
        binding_method: binding.binding_method,
        assurance_scope: binding.assurance_scope,
        status: binding.status,
        visibility: binding.visibility,
        evidence_id: publicEvidenceIds.has(binding.evidence_id) ? binding.evidence_id : null,
      })),
    edges: (Array.isArray(edges) ? edges : [])
      .filter((edge) => isPublicEdge(edge)
        && publicEvidenceIds.has(edge?.source_id)
        && publicEvidenceIds.has(edge?.target_id))
      .map(({ id, source_id, target_id, relation }) => ({ id, source_id, target_id, relation })),
    identityDetails: Object.fromEntries(
      Object.entries(identityDetails || {}).filter(([, value]) => typeof value === "string" && value.trim()),
    ),
    remarks: [],
    records: [],
    sourceConnections: [],
    photoConnections: [],
    securityEvents: [],
    accessRequests: [],
    evidenceGrants: [],
    userPreferences: {},
  };
};
