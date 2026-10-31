import {
  buildPortableXrdCredential,
  buildPortableXrdPortfolio,
  downloadPortableXrdCredential,
  downloadPortableXrdPortfolio,
  XRD_EXTENSION_CONTEXT,
  XRD_VC_CONTEXT,
} from "./xrdPortableCredential";

describe("portable XRD credential", () => {
  const claim = {
    id: "claim-123",
    profile_id: "profile-456",
    record_type: "contribution",
    title: "Maintains Atlas",
    claim_text: "I maintain the Atlas open-source library.",
    structured_claim: { role: "Maintainer", project_url: "https://example.com/atlas" },
    lifecycle_status: "published",
    created_at: "2026-10-30T12:00:00.000Z",
  };
  const profile = {
    id: "profile-456",
    username: "ada-builds",
    full_name: "Ada Lovelace",
  };

  it("exports a VC Data Model 2.0-shaped assertion without claiming it is signed", () => {
    const portable = buildPortableXrdCredential({
      claim: {
        ...claim,
        evidence_links: [{
          relation: "supports",
          item: {
            provider: "github",
            evidence_type: "activity",
            title: "Merged pull request #18",
            url: "https://github.com/example/project/pull/18",
            external_id: "pr-18",
            created_at: "2026-10-29T10:00:00.000Z",
            raw: { access_token: "must-not-export" },
          },
        }],
        latest_source_check: {
          provider: "github",
          method: "connector_snapshot_comparison",
          result_status: "matched",
          checked_fields: ["title", "url"],
          summary: "Selected source fields matched.",
          completed_at: "2026-10-30T12:15:00.000Z",
        },
      },
      profile,
    });

    expect(portable["@context"]).toEqual([XRD_VC_CONTEXT, XRD_EXTENSION_CONTEXT]);
    expect(portable.type).toEqual(["VerifiableCredential", "XRDRecord"]);
    expect(portable.issuer).toEqual({
      id: `${window.location.origin}/profile/profile-456`,
      type: "XeeviaProfile",
      name: "Ada Lovelace",
    });
    expect(portable.credentialSubject).toMatchObject({
      id: `${window.location.origin}/profile/profile-456`,
      recordType: "contribution",
      claimTitle: "Maintains Atlas",
      claimText: "I maintain the Atlas open-source library.",
      structuredClaim: { role: "Maintainer", project_url: "https://example.com/atlas" },
      claimStatus: "self_asserted",
      recordLifecycleStatus: "published",
      evidenceIncluded: true,
      linkedEvidence: [{
        relation: "supports",
        source: "github",
        evidenceType: "activity",
        title: "Merged pull request #18",
        sourceUrl: "https://github.com/example/project/pull/18",
        externalId: "pr-18",
        observedAt: "2026-10-29T10:00:00.000Z",
      }],
      latestSourceCheck: {
        source: "github",
        method: "connector_snapshot_comparison",
        result: "matched",
        checkedFields: ["title", "url"],
        summary: "Selected source fields matched.",
        checkedAt: "2026-10-30T12:15:00.000Z",
        meaning: expect.stringContaining("not an independent verification"),
      },
    });
    expect(JSON.stringify(portable)).not.toContain("must-not-export");
    expect(portable.xrdIntegrityStatus).toBe("unsigned");
    expect(portable.proof).toBeUndefined();
  });

  it("omits unsafe evidence links and keeps a record without links visibly self-asserted", () => {
    const portable = buildPortableXrdCredential({
      claim: {
        ...claim,
        evidence_links: [{ relation: "supports", item: { provider: "example", url: `java${"script"}:alert(1)` } }],
      },
      profile,
    });

    expect(portable.credentialSubject.linkedEvidence).toEqual([expect.objectContaining({
      source: "example",
    })]);
    expect(portable.credentialSubject.linkedEvidence[0].sourceUrl).toBeUndefined();
    expect(portable.credentialSubject.evidenceIncluded).toBe(true);
    expect(portable.credentialSubject.claimStatus).toBe("self_asserted");
  });

  it("preserves non-published lifecycle state without presenting it as self-asserted published", () => {
    const portable = buildPortableXrdCredential({
      claim: { ...claim, lifecycle_status: "withdrawn" },
      profile,
    });

    expect(portable.credentialSubject.claimStatus).toBe("self_asserted");
    expect(portable.credentialSubject.recordLifecycleStatus).toBe("withdrawn");
  });

  it("rejects incomplete claims and profiles rather than emitting malformed records", () => {
    expect(() => buildPortableXrdCredential({ claim: {}, profile })).toThrow(/saved XRD claim/i);
    expect(() => buildPortableXrdCredential({ claim, profile: {} })).toThrow(/profile ID/i);
  });

  it("downloads a JSON-LD file with a record-ID-based filename", () => {
    const credential = buildPortableXrdCredential({ claim, profile });
    const link = { click: jest.fn() };
    const documentRef = { createElement: jest.fn(() => link) };
    const urlApi = {
      createObjectURL: jest.fn(() => "blob:xrd"),
      revokeObjectURL: jest.fn(),
    };

    downloadPortableXrdCredential(credential, documentRef, urlApi);

    expect(link.download).toBe("urn-xrd-claim-123.xrd.json");
    expect(link.href).toBe("blob:xrd");
    expect(link.click).toHaveBeenCalledTimes(1);
    expect(urlApi.revokeObjectURL).toHaveBeenCalledWith("blob:xrd");
  });

  it("builds a recruiter-importable portfolio with explicit claim, evidence, and binding edges", () => {
    const portfolio = buildPortableXrdPortfolio({
      claims: [{
        ...claim,
        visibility: "private",
        evidence_links: [{ evidence_item_id: "evidence-1", relation: "supports" }],
      }, {
        ...claim,
        id: "withdrawn-record",
        lifecycle_status: "withdrawn",
      }],
      profile,
      evidenceItems: [{
        id: "evidence-1",
        provider: "github",
        evidence_type: "activity",
        title: "Merged pull request",
        url: "https://github.com/example/project/pull/18",
        connection_id: "connection-1",
        raw: { access_token: "do-not-export" },
      }],
      bindings: [{
        id: "binding-1",
        provider: "github",
        connection_id: "connection-1",
        binding_method: "oauth_popup",
        assurance_scope: "account_control",
        status: "bound",
        external_subject_id: "private-account-id",
      }],
      createdAt: "2026-10-31T12:00:00.000Z",
    });

    expect(portfolio.type).toBe("XRDPortfolio");
    expect(portfolio.schemaVersion).toBe("1.0");
    expect(portfolio.subject.records).toHaveLength(1);
    expect(portfolio.subject.records[0]).toMatchObject({
      claimStatus: "self_asserted",
      visibilityAtExport: "private",
      structuredClaim: {
        role: "Maintainer",
        project_url: "https://example.com/atlas",
      },
    });
    expect(portfolio.subject.identityBindings).toEqual([expect.objectContaining({
      provider: "github",
      assuranceScope: "account_control",
      status: "bound",
    })]);
    expect(portfolio.relationshipGraph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ relation: "supports", meaning: expect.stringContaining("not independent verification") }),
      expect.objectContaining({ relation: "has_identity_binding", assuranceScope: "account_control" }),
    ]));
    expect(JSON.stringify(portfolio)).not.toContain("do-not-export");
    expect(JSON.stringify(portfolio)).not.toContain("private-account-id");
    expect(portfolio.integrity.status).toBe("unsigned");
  });

  it("does not export draft, withdrawn, or superseded records as a hiring portfolio", () => {
    expect(() => buildPortableXrdPortfolio({
      claims: [{ ...claim, lifecycle_status: "draft" }],
      profile,
    })).toThrow(/at least one published/i);
  });

  it("downloads the portfolio with a safe profile-based filename", () => {
    const link = { click: jest.fn() };
    const documentRef = { createElement: jest.fn(() => link) };
    const urlApi = {
      createObjectURL: jest.fn(() => "blob:portfolio"),
      revokeObjectURL: jest.fn(),
    };
    const portfolio = buildPortableXrdPortfolio({
      claims: [claim],
      profile,
      createdAt: "2026-10-31T12:00:00.000Z",
    });

    downloadPortableXrdPortfolio(portfolio, documentRef, urlApi);

    expect(link.download).toBe("xeevia-hiring-record-profile-456.xrd.json");
    expect(link.click).toHaveBeenCalledTimes(1);
    expect(urlApi.revokeObjectURL).toHaveBeenCalledWith("blob:portfolio");
  });
});
