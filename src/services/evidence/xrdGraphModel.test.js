import { buildXrdClaimEvidenceLinks, getVisibleXrdBindings } from "./xrdGraphModel";

describe("XRD graph model", () => {
  it("only creates claim-evidence links when both endpoints are visible", () => {
    const claims = [{
      id: "claim-1",
      evidence_links: [
        { evidence_item_id: "evidence-1", relation: "supports" },
        { evidence_item_id: "evidence-2", relation: "contradicts" },
        { evidence_item_id: "evidence-3", relation: "related_to" },
      ],
    }];

    expect(buildXrdClaimEvidenceLinks(claims, [{ id: "evidence-1" }])).toEqual([{
      id: "claim-1:evidence-1:supports",
      claimId: "claim-1",
      evidenceId: "evidence-1",
      relation: "supports",
    }]);
  });

  it("keeps historical binding states visible", () => {
    expect(getVisibleXrdBindings([
      { id: "bound", status: "bound" },
      { id: "disputed", status: "disputed" },
      { id: "revoked", status: "revoked" },
      { id: "failed", status: "failed" },
    ]).map(({ id }) => id)).toEqual(["bound", "disputed", "revoked", "failed"]);
  });

  it("caps graph binding nodes to the displayed graph limit", () => {
    const bindings = Array.from({ length: 14 }, (_, index) => ({ id: String(index), status: "bound" }));
    expect(getVisibleXrdBindings(bindings)).toHaveLength(12);
  });
});
