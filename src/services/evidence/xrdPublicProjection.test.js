import { projectXrdPublicView } from "./xrdPublicProjection";

const unsafeScriptUrl = ["java", "script"].join("") + ":alert(1)";

describe("projectXrdPublicView", () => {
  const publicEvidence = {
    id: "public-evidence",
    profile_id: "profile-1",
    verified: true,
    metadata: { visibility: "PUBLIC" },
  };

  it("includes only published public claims and public verified evidence", () => {
    const projection = projectXrdPublicView({
      profileId: "profile-1",
      evidenceItems: [
        publicEvidence,
        { id: "private", profile_id: "profile-1", verified: true, metadata: { visibility: "PRIVATE" } },
        { id: "unverified", profile_id: "profile-1", verified: false, metadata: { visibility: "PUBLIC" } },
        { id: "other-profile", profile_id: "profile-2", verified: true, metadata: { visibility: "PUBLIC" } },
      ],
      claims: [
        { id: "published-public", lifecycle_status: "published", visibility: "public" },
        { id: "draft-public", lifecycle_status: "draft", visibility: "public" },
        { id: "published-private", lifecycle_status: "published", visibility: "private" },
      ],
    });

    expect(projection.evidenceItems).toEqual([
      expect.objectContaining({ id: "public-evidence", verified: true, metadata: { visibility: "PUBLIC" } }),
    ]);
    expect(projection.evidenceItems[0]).not.toHaveProperty("profile_id");
    expect(projection.claims.map(({ id }) => id)).toEqual(["published-public"]);
  });

  it("removes hidden evidence links, graph edges, bindings, and remarks", () => {
    const projection = projectXrdPublicView({
      evidenceItems: [
        publicEvidence,
        { id: "private-evidence", verified: true, metadata: { visibility: "PRIVATE" } },
      ],
      claims: [{
        id: "claim",
        lifecycle_status: "published",
        visibility: "public",
        evidence_links: [
          { evidence_item_id: "public-evidence", relation: "supports" },
          { evidence_item_id: "private-evidence", relation: "supports" },
        ],
      }],
      bindings: [
        { id: "public-binding", visibility: "public" },
        { id: "private-binding", visibility: "private" },
      ],
      edges: [
        { id: "visible-edge", source_id: "public-evidence", target_id: "public-evidence" },
        { id: "private-edge", source_id: "public-evidence", target_id: "public-evidence", metadata: { visibility: "PRIVATE" } },
        { id: "hidden-edge", source_id: "public-evidence", target_id: "private-evidence" },
      ],
      remarks: [
        { id: "visible-remark", status: "published", evidence_item_id: "public-evidence" },
        { id: "hidden-record-remark", status: "published", evidence_item_id: "private-evidence" },
        { id: "withdrawn-remark", status: "withdrawn", evidence_item_id: "public-evidence" },
      ],
    });

    expect(projection.claims[0].evidence_links).toHaveLength(1);
    expect(projection.bindings.map(({ id }) => id)).toEqual(["public-binding"]);
    expect(projection.edges.map(({ id }) => id)).toEqual(["visible-edge"]);
    expect(projection.remarks).toEqual([]);
  });

  it("projects only supplied public identity fields and bases counts on projected items", () => {
    const projection = projectXrdPublicView({
      evidenceItems: [
        publicEvidence,
        { id: "private", verified: true, metadata: { visibility: "PRIVATE" } },
      ],
      identityDetails: { headline: "Builder", bio: "", location: "Hidden location" },
      claims: [
        { id: "public", lifecycle_status: "published", visibility: "public" },
        { id: "draft", lifecycle_status: "draft", visibility: "public" },
      ],
    });

    expect(projection.identityDetails).toEqual({ headline: "Builder", location: "Hidden location" });
    expect(projection.evidenceItems).toHaveLength(1);
    expect(projection.claims).toHaveLength(1);
  });

  it("removes owner-only sources, XRC records, and access state from public view", () => {
    const projection = projectXrdPublicView({
      evidenceItems: [publicEvidence],
      records: [{ record_id: "private-xrc-record" }],
      sourceConnections: [{ id: "private-connection", platform_user_id: "private-handle" }],
      photoConnections: [{ id: "private-photo-connection" }],
      securityEvents: [{ id: "private-security-event" }],
      accessRequests: [{ id: "private-access-request" }],
      evidenceGrants: [{ id: "private-evidence-grant" }],
      userPreferences: { privateSetting: true },
    });

    expect(projection.records).toEqual([]);
    expect(projection.sourceConnections).toEqual([]);
    expect(projection.photoConnections).toEqual([]);
    expect(projection.securityEvents).toEqual([]);
    expect(projection.accessRequests).toEqual([]);
    expect(projection.evidenceGrants).toEqual([]);
    expect(projection.userPreferences).toEqual({});
  });

  it("includes only safe public social, portfolio, and report links", () => {
    const projection = projectXrdPublicView({
      links: [
        { id: "public-social", category: "social", label: "GitHub", url: "https://github.com/ada", visibility: "public" },
        { id: "private-report", category: "report", label: "Private report", url: "https://example.com/private", visibility: "private" },
        { id: "unsafe-link", category: "portfolio", label: "Unsafe", url: unsafeScriptUrl, visibility: "public" },
      ],
    });

    expect(projection.links).toEqual([
      expect.objectContaining({ id: "public-social", category: "social", label: "GitHub" }),
    ]);
  });

  it("removes provider identifiers and owner-only verification data from public entities", () => {
    const projection = projectXrdPublicView({
      evidenceItems: [{
        ...publicEvidence,
        external_id: "private-provider-account-id",
        connection_id: "private-connection-id",
        raw: { token: "private-token" },
        metadata: { visibility: "PUBLIC", status: "confirmed", private_provider_data: "secret" },
      }],
      claims: [{
        id: "public-claim",
        title: "Public claim",
        claim_text: "A public statement.",
        lifecycle_status: "published",
        visibility: "public",
        created_by: "private-actor-id",
        latest_source_check: { summary: "owner-only check" },
        latest_audit_event: { details: { private: true } },
        evidence_links: [{
          evidence_item_id: "public-evidence",
          relation: "supports",
          created_by: "private-actor-id",
        }],
      }],
      bindings: [{
        id: "public-binding",
        provider: "github",
        binding_method: "oauth_popup",
        assurance_scope: "account_control",
        status: "bound",
        visibility: "public",
        connection_id: "private-connection-id",
        external_subject_id: "private-provider-account-id",
        evidence_id: "public-evidence",
      }],
    });

    expect(projection.evidenceItems[0]).not.toHaveProperty("raw");
    expect(projection.evidenceItems[0]).not.toHaveProperty("external_id");
    expect(projection.evidenceItems[0]).not.toHaveProperty("connection_id");
    expect(projection.evidenceItems[0].metadata).toEqual({ visibility: "PUBLIC", status: "confirmed" });
    expect(projection.claims[0]).not.toHaveProperty("created_by");
    expect(projection.claims[0]).not.toHaveProperty("latest_source_check");
    expect(projection.claims[0]).not.toHaveProperty("latest_audit_event");
    expect(projection.claims[0].evidence_links).toEqual([
      { evidence_item_id: "public-evidence", relation: "supports" },
    ]);
    expect(projection.bindings[0]).not.toHaveProperty("connection_id");
    expect(projection.bindings[0]).not.toHaveProperty("external_subject_id");
  });

  it("includes only evidence explicitly granted to this signed-in viewer", () => {
    const projection = projectXrdPublicView({
      profileId: "profile-1",
      grantedEvidenceIds: ["granted-evidence"],
      evidenceItems: [
        publicEvidence,
        {
          id: "granted-evidence",
          profile_id: "profile-1",
          verified: false,
          metadata: { visibility: "PRIVATE", private_provider_data: "removed" },
          external_id: "private-provider-id",
          raw: { token: "never expose" },
        },
        { id: "other-private", profile_id: "profile-1", verified: false, metadata: { visibility: "PRIVATE" } },
      ],
    });

    expect(projection.evidenceItems.map(({ id }) => id)).toEqual(["public-evidence", "granted-evidence"]);
    expect(projection.evidenceItems[1]).not.toHaveProperty("raw");
    expect(projection.evidenceItems[1]).not.toHaveProperty("external_id");
    expect(projection.evidenceItems[1].metadata).toEqual({ visibility: "PRIVATE" });
  });

  it("keeps all owner data unchanged in owner view", () => {
    const ownerData = {
      evidenceItems: [{ id: "private", verified: false }],
      claims: [{ id: "draft", lifecycle_status: "draft", visibility: "private" }],
      bindings: [{ id: "private-binding", visibility: "private" }],
      records: [{ record_id: "owner-xrc-record" }],
    };

    expect(projectXrdPublicView(ownerData, false)).toBe(ownerData);
  });
});
