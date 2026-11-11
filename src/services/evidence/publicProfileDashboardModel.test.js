import { buildProfileRecordSummary, buildPublicProfileDashboard, getPublicProfileEvidenceItems } from "./publicProfileDashboardModel";

describe("buildProfileRecordSummary", () => {
  it("counts persisted evidence and claims without treating identity links as verified records", () => {
    expect(buildProfileRecordSummary({
      evidenceItems: [
        { provider: "GitHub", verified: true, entity_type: "organization", title: "Atlas" },
        { provider: "github", verified: false },
      ],
      xrdRecords: [{ id: "claim-1" }],
      identityBindings: [
        { provider: "GitHub", status: "bound", assurance_scope: "account_control" },
        { provider: "Westbridge University", status: "verified", assurance_scope: "institutional_attestation" },
        { provider: "LinkedIn", status: "revoked" },
      ],
      connectedPlatforms: [{ provider: "GitHub", auth_status: "active" }],
      socialLinks: { LinkedIn: "https://linkedin.com/in/alex" },
      evidenceCount: 2,
      verifiedCount: 1,
      xrdRecordCount: 1,
    })).toEqual({
      records: 3,
      verified: 1,
      sources: 3,
      institutions: 2,
    });
  });

  it("uses supplied evidence rows when exact counts are unavailable", () => {
    expect(buildProfileRecordSummary({
      evidenceItems: [{ provider: "GitHub", verified: true }],
      xrdRecords: [{ id: "claim-1" }],
    })).toEqual({
      records: 2,
      verified: 1,
      sources: 1,
      institutions: 0,
    });
  });

  describe("buildPublicProfileDashboard", () => {
    const evidenceItems = [
      { id: "social-public", provider: "x", evidence_type: "profile", verified: true, metadata: { visibility: "PUBLIC" } },
      { id: "portfolio-private", provider: "GitHub", evidence_type: "portfolio", verified: true, metadata: { visibility: "PRIVATE" } },
      { id: "comment-public", provider: "x", evidence_type: "activity", verified: true, metadata: { kind: "comment", visibility: "PUBLIC" } },
      { id: "report-public", provider: "GitHub", evidence_type: "report", verified: true, metadata: { visibility: "PUBLIC" } },
    ];

    it("only includes verified, public evidence and omits engagement from visitor views", () => {
      const publicItems = getPublicProfileEvidenceItems(evidenceItems);
      const dashboard = buildPublicProfileDashboard({ username: "alex" }, evidenceItems);

      expect(publicItems.map((item) => item.id)).toEqual(["social-public", "report-public"]);
      expect(dashboard.sections.map((section) => section.id)).not.toEqual(expect.arrayContaining(["comments", "replies", "likes"]));
      expect(dashboard.sections.find((section) => section.id === "socials").items.map((item) => item.id)).toEqual(["social-public"]);
      expect(dashboard.sections.find((section) => section.id === "reports").items.map((item) => item.id)).toEqual(["report-public"]);
    });

    it("keeps engagement sections available to the profile owner only", () => {
      const dashboard = buildPublicProfileDashboard({ username: "alex" }, evidenceItems, { isOwner: true });

      expect(dashboard.sections.map((section) => section.id)).toEqual(expect.arrayContaining(["comments", "replies", "likes"]));
    });
  });
});
