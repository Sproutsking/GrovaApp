import { buildVerificationDashboardSections } from "./verificationDashboardModel";

describe("buildVerificationDashboardSections", () => {
  it("groups evidence into a verification dashboard structure with verified social anchors", () => {
    const items = [
      {
        id: "bio-1",
        provider: "x",
        evidence_type: "profile",
        title: "Alex Morgan",
        summary: "Founder and builder",
        verified: true,
        metadata: { username: "alex", platform: "x" },
      },
      {
        id: "social-1",
        provider: "github",
        evidence_type: "activity",
        title: "Open source contributions",
        summary: "Shipping reusable platform tooling",
        verified: true,
        metadata: { kind: "contribution" },
      },
      {
        id: "report-1",
        provider: "wallet",
        evidence_type: "report",
        title: "Client delivery report",
        summary: "Completed a complex product launch",
        verified: true,
        metadata: { kind: "report" },
      },
      {
        id: "comment-1",
        provider: "x",
        evidence_type: "comment",
        title: "Comment on launch",
        summary: "Great work on the product",
        verified: false,
        metadata: { kind: "comment" },
      },
    ];

    const sections = buildVerificationDashboardSections(items, { username: "alex" });

    expect(sections.find((section) => section.id === "bio")).toBeDefined();
    expect(sections.find((section) => section.id === "socials").items[0]).toMatchObject({
      provider: "x",
      verified: true,
    });
    expect(sections.find((section) => section.id === "reports").items[0].title).toBe("Client delivery report");
    expect(sections.find((section) => section.id === "comments").items[0].evidence_type).toBe("comment");
  });

  it("adds proof labels for identity evidence", () => {
    const sections = buildVerificationDashboardSections([
      {
        id: "identity-1",
        provider: "email",
        evidence_type: "identity",
        title: "Primary email verified",
        summary: "Verified ownership of the account email",
        verified: true,
        metadata: { proofType: "email", verificationLevel: "high" },
      },
    ], { username: "alex" });

    expect(sections.find((section) => section.id === "bio").items[0].proofLabel).toBe("Email verification");
  });
});
