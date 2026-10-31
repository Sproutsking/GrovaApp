import { buildProfileRecordSummary } from "./publicProfileDashboardModel";

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
});
