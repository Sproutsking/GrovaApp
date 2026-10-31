import { buildShareUrl } from "../../utils/shareLinks";

export const XRD_VC_CONTEXT = "https://www.w3.org/ns/credentials/v2";
export const XRD_EXTENSION_CONTEXT = "https://xeevia.com/contexts/xrd/v1.jsonld";

const recordUrn = (recordId) => `urn:xrd:${recordId}`;

const safeSourceUrl = (value) => {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
};

const safeStructuredClaim = (value = {}) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const fields = ["role", "organization", "startDate", "endDate", "projectUrl", "project_url", "credentialIssuer", "credentialUrl"];
  return fields.reduce((result, field) => {
    const fieldValue = value[field];
    if (typeof fieldValue !== "string" || !fieldValue.trim()) return result;
    const normalized = field === "projectUrl" || field === "project_url" || field === "credentialUrl"
      ? safeSourceUrl(fieldValue)
      : fieldValue.trim().slice(0, 500);
    if (normalized) result[field] = normalized;
    return result;
  }, {});
};

const portableEvidence = (link) => {
  const item = link?.item || {};
  const url = safeSourceUrl(item.url || item.source_url);
  return {
    relation: link?.relation === "contradicts" ? "contradicts" : "supports",
    source: String(item.provider || "").slice(0, 100),
    evidenceType: String(item.evidence_type || item.type || "").slice(0, 100),
    title: String(item.title || "").slice(0, 300),
    ...(url ? { sourceUrl: url } : {}),
    ...(item.external_id ? { externalId: String(item.external_id).slice(0, 300) } : {}),
    observedAt: item.observed_at || item.created_at || null,
  };
};

const portableSourceCheck = (check) => {
  if (!check) return null;
  return {
    source: String(check.provider || "").slice(0, 100),
    method: String(check.method || "connector_snapshot_comparison").slice(0, 100),
    result: String(check.result_status || "indeterminate"),
    checkedFields: Array.isArray(check.checked_fields) ? check.checked_fields : [],
    summary: String(check.summary || "").slice(0, 1000),
    checkedAt: check.completed_at || null,
    meaning: "A source observation, not an independent verification of the claim.",
  };
};

export function buildPortableXrdCredential({ claim, profile }) {
  if (!claim?.id || !claim?.created_at || !claim?.title || !claim?.claim_text) {
    throw new Error("A saved XRD claim with an ID, timestamp, title, and text is required.");
  }
  if (!profile?.id) {
    throw new Error("The Xeevia profile ID is required to export an XRD claim.");
  }

  const profileUrl = buildShareUrl("profile", profile.id);
  const recordId = recordUrn(claim.id);
  const lifecycleStatus = claim.lifecycle_status || "published";
  const evidence = (Array.isArray(claim.evidence_links) ? claim.evidence_links : [])
    .map(portableEvidence)
    .filter((item) => item.source || item.title || item.sourceUrl);
  const sourceCheck = portableSourceCheck(claim.latest_source_check);

  return {
    "@context": [XRD_VC_CONTEXT, XRD_EXTENSION_CONTEXT],
    id: recordId,
    type: ["VerifiableCredential", "XRDRecord"],
    issuer: {
      id: profileUrl,
      type: "XeeviaProfile",
      name: profile.full_name || profile.fullName || profile.username || "Xeevia profile",
    },
    validFrom: new Date(claim.created_at).toISOString(),
    credentialSubject: {
      id: profileUrl,
      recordId,
      recordType: claim.record_type || "other",
      claimTitle: claim.title,
      claimText: claim.claim_text,
      structuredClaim: safeStructuredClaim(claim.structured_claim),
      claimStatus: "self_asserted",
      recordLifecycleStatus: lifecycleStatus,
      provenanceUrl: profileUrl,
      linkedEvidence: evidence,
      latestSourceCheck: sourceCheck,
      evidenceIncluded: evidence.length > 0,
    },
    xrdIntegrityStatus: "unsigned",
  };
}

export function buildPortableXrdPortfolio({
  claims,
  profile,
  bindings = [],
  evidenceItems = [],
  createdAt = new Date(),
}) {
  if (!profile?.id) {
    throw new Error("The Xeevia profile ID is required to export an XRD portfolio.");
  }
  const evidenceById = new Map((Array.isArray(evidenceItems) ? evidenceItems : [])
    .filter((item) => item?.id)
    .map((item) => [item.id, item]));
  const selectedClaims = (Array.isArray(claims) ? claims : [])
    .filter((claim) => claim?.lifecycle_status === "published");
  if (!selectedClaims.length) {
    throw new Error("Select at least one published XRD record to export.");
  }
  const selectedEvidence = selectedClaims.flatMap((claim) => (Array.isArray(claim.evidence_links) ? claim.evidence_links : [])
    .map((link) => link.item || evidenceById.get(link.evidence_item_id))
    .filter(Boolean));
  const selectedConnectionIds = new Set(selectedEvidence.map((item) => item.connection_id).filter(Boolean).map(String));

  const profileUrl = buildShareUrl("profile", profile.id);
  const records = selectedClaims.map((claim) => {
    if (!claim?.id || !claim?.created_at || !claim?.title || !claim?.claim_text) {
      throw new Error("Every exported XRD record must be saved and complete.");
    }
    const linkedEvidence = (Array.isArray(claim.evidence_links) ? claim.evidence_links : [])
      .map((link) => ({ ...link, item: link.item || evidenceById.get(link.evidence_item_id) }))
      .map(portableEvidence)
      .filter((item) => item.source || item.title || item.sourceUrl)
      .map((item, index) => ({ ...item, id: `urn:xrd:evidence:${claim.id}:${index + 1}` }));
    return {
      id: recordUrn(claim.id),
      type: "XRDRecord",
      recordType: claim.record_type || "other",
      claimTitle: claim.title,
      claimText: claim.claim_text,
      structuredClaim: safeStructuredClaim(claim.structured_claim),
      claimStatus: "self_asserted",
      lifecycleStatus: claim.lifecycle_status,
      visibilityAtExport: claim.visibility || "private",
      createdAt: claim.created_at,
      linkedEvidence,
      latestSourceCheck: portableSourceCheck(claim.latest_source_check),
    };
  });

  const evidenceProviders = new Set(records.flatMap((record) =>
    record.linkedEvidence.map((item) => item.source.toLowerCase()),
  ));
  const relevantBindings = (Array.isArray(bindings) ? bindings : [])
    .filter((binding) => selectedConnectionIds.has(String(binding?.connection_id || ""))
      && evidenceProviders.has(String(binding?.provider || "").toLowerCase()))
    .map((binding) => ({
      id: `urn:xrd:binding:${binding.id}`,
      type: "IdentityBinding",
      provider: String(binding.provider || "").slice(0, 100),
      bindingMethod: String(binding.binding_method || "unknown").slice(0, 100),
      assuranceScope: String(binding.assurance_scope || "unknown").slice(0, 100),
      status: String(binding.status || "unknown").slice(0, 50),
      recordedAt: binding.created_at || null,
      meaning: "This binding describes the account relationship only; it does not verify record authorship or claim truth.",
    }));

  const nodes = [
    { id: profileUrl, type: "XeeviaProfile" },
    ...records.map(({ id, recordType, claimTitle }) => ({ id, type: "XRDRecord", recordType, title: claimTitle })),
    ...records.flatMap((record) => record.linkedEvidence.map((item) => ({
      id: item.id,
      type: "EvidenceObservation",
      source: item.source,
      title: item.title,
    }))),
    ...relevantBindings.map(({ id, provider, status }) => ({ id, type: "IdentityBinding", provider, status })),
  ];
  const edges = records.flatMap((record) => record.linkedEvidence.map((item) => ({
    from: record.id,
    to: item.id,
    relation: item.relation,
    meaning: item.relation === "supports"
      ? "The owner linked this source observation as supporting context; it is not independent verification."
      : "The owner linked this source observation as contradictory context.",
  })));
  const bindingEdges = relevantBindings.map((binding) => ({
    from: profileUrl,
    to: binding.id,
    relation: "has_identity_binding",
    assuranceScope: binding.assuranceScope,
    meaning: binding.meaning,
  }));
  const exportDate = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(exportDate.getTime())) throw new Error("The portfolio export timestamp is invalid.");

  return {
    "@context": [XRD_VC_CONTEXT, XRD_EXTENSION_CONTEXT],
    id: `urn:xrd-portfolio:${profile.id}:${exportDate.toISOString()}`,
    type: "XRDPortfolio",
    schemaVersion: "1.0",
    createdAt: exportDate.toISOString(),
    issuer: {
      id: profileUrl,
      type: "XeeviaProfile",
      name: profile.full_name || profile.fullName || profile.username || "Xeevia profile",
    },
    subject: {
      id: profileUrl,
      username: profile.username || null,
      records,
      identityBindings: relevantBindings,
    },
    relationshipGraph: {
      nodes,
      edges: [...edges, ...bindingEdges],
    },
    integrity: {
      status: "unsigned",
      meaning: "This export is owner-curated and has no cryptographic issuer signature. Its claims and linked observations are not independently verified.",
    },
  };
}

export function downloadPortableXrdCredential(credential, documentRef = document, urlApi = URL) {
  const blob = new Blob([`${JSON.stringify(credential, null, 2)}\n`], {
    type: "application/ld+json",
  });
  const downloadUrl = urlApi.createObjectURL(blob);
  const link = documentRef.createElement("a");
  link.href = downloadUrl;
  link.download = `${credential.id.replace(/[^a-zA-Z0-9-]/g, "-")}.xrd.json`;
  link.click();
  urlApi.revokeObjectURL(downloadUrl);
}

export function downloadPortableXrdPortfolio(portfolio, documentRef = document, urlApi = URL) {
  const blob = new Blob([`${JSON.stringify(portfolio, null, 2)}\n`], {
    type: "application/ld+json",
  });
  const downloadUrl = urlApi.createObjectURL(blob);
  const link = documentRef.createElement("a");
  link.href = downloadUrl;
  const profileKey = String(portfolio.issuer.id.split("/").pop() || "profile").replace(/[^a-zA-Z0-9_-]/g, "-");
  link.download = `xeevia-hiring-record-${profileKey}.xrd.json`;
  link.click();
  urlApi.revokeObjectURL(downloadUrl);
}
