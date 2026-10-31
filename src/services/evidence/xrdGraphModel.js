const VISIBLE_BINDING_STATES = new Set([
  "claimed",
  "pending",
  "bound",
  "verified",
  "disputed",
  "expired",
  "revoked",
  "failed",
]);

export const buildXrdClaimEvidenceLinks = (claims = [], evidenceItems = []) => {
  const visibleEvidenceIds = new Set((Array.isArray(evidenceItems) ? evidenceItems : []).map((item) => item?.id).filter(Boolean));
  return (Array.isArray(claims) ? claims : []).flatMap((claim) => (Array.isArray(claim.evidence_links) ? claim.evidence_links : [])
    .filter((link) => (
      visibleEvidenceIds.has(link.evidence_item_id)
      && ["supports", "contradicts"].includes(link.relation)
    ))
    .map((link) => ({
      id: `${claim.id}:${link.evidence_item_id}:${link.relation}`,
      claimId: claim.id,
      evidenceId: link.evidence_item_id,
      relation: link.relation,
    })));
};

export const getVisibleXrdBindings = (bindings = []) => (Array.isArray(bindings) ? bindings : [])
  .filter((binding) => VISIBLE_BINDING_STATES.has(String(binding?.status || "").toLowerCase()))
  .slice(0, 12);
