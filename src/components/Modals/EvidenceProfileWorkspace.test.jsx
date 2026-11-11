import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { buildXrdIdentityDetailRows, getXrdIdentityBindings, getXrdIdentityDetails, getXrdIdentityRowStatus, getXrcRecordSummary, getXrdPhotoSources, getXrdProfileAvatarCandidates, resolveXrdInitialSection, resolveXrcInitialSection, SOURCE_PLATFORMS, XRC_NAV_GROUPS, XrdEvidenceGraph } from "./EvidenceProfileWorkspace";
import ProfileEvidenceWorkspace from "./EvidenceProfileWorkspace";
import XRCProfileDashboard from "./XRCProfileDashboard";
import xrdRecordService from "../../services/evidence/xrdRecordService";

jest.mock("../../services/config/supabase", () => {
  const createQuery = () => {
    const result = { data: [], error: null };
    const query = {
      select: () => query,
      eq: () => query,
      order: () => query,
      limit: () => query,
      in: () => query,
      upsert: () => query,
      insert: () => query,
      update: () => query,
      delete: () => query,
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      single: () => Promise.resolve({ data: null, error: null }),
      then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };
    return query;
  };
  return {
    supabase: {
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "owner-1", user_metadata: {} } }, error: null }) },
      from: () => createQuery(),
    },
  };
});

jest.mock("../../services/xrc", () => ({
  __esModule: true,
  default: {},
  STREAM_TYPES: {},
  XRC_EVENTS: {},
}));

jest.mock("../../services/evidence/evidenceService", () => ({
  __esModule: true,
  default: { getEvidenceEdgesForItemIds: () => Promise.resolve([]) },
}));

jest.mock("../../services/evidence/xrdRecordService", () => ({
  __esModule: true,
  default: {
    listClaims: jest.fn(() => Promise.resolve([])),
    listIdentityBindings: jest.fn(() => Promise.resolve([])),
  },
  compareEvidenceSnapshot: jest.fn(),
}));

jest.mock("../../services/distribution/socialConnectService", () => ({
  __esModule: true,
  default: { getConnections: jest.fn(() => Promise.resolve({})) },
}));

jest.mock("../../contexts/AccountLinkingContext", () => ({
  useAccountLinking: () => ({ openAccountLink: jest.fn() }),
}));

jest.mock("../../services/shared/mediaUrlService", () => ({
  __esModule: true,
  default: {
    resolveAvatarUrls: (source) => {
      if (typeof source === "string" && source) return [source];
      if (Array.isArray(source)) return source.flatMap((item) => [item?.avatarUrl, item?.avatar_url, item?.picture, item?.publicUrl].filter(Boolean));
      const direct = source?.publicUrl || source?.avatarUrl || source?.avatar_url || source?.profile_image_url || source?.picture
        || source?.user_metadata?.avatar_url || source?.user_metadata?.picture;
      if (direct) return [direct];
      return [];
    },
  },
}));

describe("getXrdProfileAvatarCandidates", () => {
  it("keeps the Xeevia profile image and its fallbacks in priority order", () => {
    expect(getXrdProfileAvatarCandidates({
      avatarUrl: "https://images.example/primary.png",
      avatarFallbackUrls: ["https://images.example/fallback.png"],
      avatarId: "stored-avatar-id",
    })).toEqual([
      "https://images.example/primary.png",
      "https://images.example/fallback.png",
      "stored-avatar-id",
    ]);
  });

  it("uses an avatar metadata URL when no direct profile URL is available", () => {
    expect(getXrdProfileAvatarCandidates({
      avatar_metadata: { publicUrl: "https://images.example/metadata.png" },
    })).toEqual(["https://images.example/metadata.png"]);
  });

  it("uses authenticated OAuth metadata as a native Xeevia image fallback", () => {
    expect(getXrdProfileAvatarCandidates({ user_metadata: { picture: "https://images.example/auth-profile.png" } }))
      .toEqual(["https://images.example/auth-profile.png"]);
  });

  it("returns no candidate when the profile has no image data", () => {
    expect(getXrdProfileAvatarCandidates({ id: "profile-without-image" })).toEqual([]);
  });

  it("maps the native profile and connected-source evidence into separate image cards", () => {
    expect(getXrdPhotoSources({ username: "sprouts", avatarUrl: "https://images.example/xeevia.png" }, [
      { id: "github-profile", provider: "GitHub", evidence_type: "profile", metadata: { avatarUrl: "https://images.example/github.png", username: "sprouts-dev" } },
      { id: "github-activity", provider: "GitHub", evidence_type: "activity", metadata: { avatarUrl: "https://images.example/activity.png" } },
    ], [{ id: "google-connection", provider: "google", platform_user_id: "sprouts@example.com", avatarUrl: "https://images.example/google.png" }])).toEqual([
      { id: "xeevia-profile", name: "Xeevia", handle: "@sprouts", urls: ["https://images.example/xeevia.png"], verified: false },
      { id: "github-profile", name: "GitHub", handle: "sprouts-dev", urls: ["https://images.example/github.png"], verified: false },
      { id: "connection:google-connection", name: "Google", handle: "sprouts@example.com", urls: ["https://images.example/google.png"], verified: false },
    ]);
  });
});

describe("getXrdIdentityBindings", () => {
  it("includes the real Xeevia profile when no external networks are connected", () => {
    expect(getXrdIdentityBindings({ id: "profile-1", username: "sprouts" }, [])).toEqual([
      { provider: "Xeevia", account: "@sprouts", status: "Native profile", native: true },
    ]);
  });

  describe("getXrcRecordSummary", () => {
    it("explains identity edits without exposing identity field values", () => {
      expect(getXrcRecordSummary({
        event: "identity_details_updated",
        updated_fields: ["headline", "bio", "visibility"],
        visibility: "public",
      })).toBe("Identity fields changed: headline, bio, visibility · public visibility");
    });

    it("shows platform connection and follow lifecycle details", () => {
      expect(getXrcRecordSummary({
        event: "platform_connected",
        provider: "github",
        connection_method: "oauth_popup",
        auth_status: "active",
      })).toBe("github connected via oauth popup · account_control");
      expect(getXrcRecordSummary({
        event: "follow_added",
        following_id: "profile-2",
      })).toBe("Followed Xeevia profile profile-2");
    });
  });

  it("keeps actual external connection states and does not duplicate Xeevia", () => {
    expect(getXrdIdentityBindings({ id: "profile-1", username: "sprouts" }, [
      { provider: "github", auth_status: "active", hasValidToken: true },
      { provider: "xeevia", auth_status: "active" },
    ])).toEqual([
      { provider: "Xeevia", account: "@sprouts", status: "Native profile", native: true },
      { provider: "github", account: "Account + token", native: false },
    ]);
  });
});

describe("getXrdIdentityDetails", () => {
  it("normalizes owner-authored fields without implying verification", () => {
    expect(getXrdIdentityDetails({ headline: "Builder", bio: "I make things", visibility: "public" })).toEqual({
      headline: "Builder",
      bio: "I make things",
      location: "",
      pronouns: "",
      website: "",
      note: "",
      availability: "",
    });

  });

  it("writes identity detail rows using the field-per-row database schema", () => {
    expect(buildXrdIdentityDetailRows("profile-1", { headline: "Builder", bio: "" }, "public", "2026-10-31T00:00:00.000Z"))
      .toContainEqual({
        profile_id: "profile-1",
        field_key: "headline",
        value: "Builder",
        visibility: "public",
        updated_at: "2026-10-31T00:00:00.000Z",
      });
    expect(buildXrdIdentityDetailRows("profile-1", { headline: "Builder" }, "public", "timestamp"))
      .toHaveLength(7);
  });

  it("keeps XRC-only destinations out of the XRD record dashboard", () => {
    expect(resolveXrdInitialSection("Remarks")).toBe("Records");
    expect(resolveXrdInitialSection("XRC Oracle")).toBe("Overview");
    expect(resolveXrdInitialSection("Chains")).toBe("Overview");
    expect(resolveXrdInitialSection("Activity")).toBe("Overview");
  });
});

describe("getXrdIdentityRowStatus", () => {
  it("does not label an active OAuth connection as verified", () => {
    expect(getXrdIdentityRowStatus({ connection: { auth_status: "active", hasValidToken: true }, evidence: [] }))
      .toEqual({ label: "Connected · token active", tone: "connected" });
  });

  it("labels owner-supplied profile links as unverified", () => {
    expect(getXrdIdentityRowStatus({ connection: { auth_status: "active", connected_via: "profile_link" }, evidence: [] }))
      .toEqual({ label: "Profile URL · unverified", tone: "pending" });
  });

  it("distinguishes source-reported evidence, tracked evidence, and no evidence", () => {
    expect(getXrdIdentityRowStatus({ evidence: [{ verified: true, source: "connector" }] }))
      .toEqual({ label: "Source-reported", tone: "source" });
    expect(getXrdIdentityRowStatus({ evidence: [{ verified: false }] }))
      .toEqual({ label: "Tracked", tone: "tracked" });
    expect(getXrdIdentityRowStatus({ evidence: [] }))
      .toEqual({ label: "No evidence", tone: "neutral" });
  });
});

it("lists Apple as an XRD source supported by the connection service", () => {
  expect(SOURCE_PLATFORMS).toContainEqual(["apple", "Apple"]);
});

it("keeps the XRC navigation broad and opens at its overview", () => {
  expect(XRC_NAV_GROUPS.flatMap(([, sections]) => sections)).toEqual([
    "Overview", "Identity", "Records", "Evidence", "Graph", "Chains", "Activity", "Verification", "Sources",
  ]);
  expect(resolveXrcInitialSection()).toBe("Overview");
  expect(resolveXrcInitialSection("Records")).toBe("Records");
  expect(resolveXrcInitialSection("Oracle")).toBe("Overview");
});

it("renders XRC with its network overview and full desktop/mobile navigation", async () => {
  render(
    <XRCProfileDashboard
      profile={{ id: "owner-1", fullName: "Ada Lovelace", username: "ada" }}
      currentUser={{ id: "owner-1" }}
      targetId="owner-1"
      onClose={jest.fn()}
    />,
  );

  expect(await screen.findByRole("heading", { name: "XRC · Chain of Chains" })).not.toBeNull();
  expect(screen.getByText("Xeevia Record Chain")).not.toBeNull();
  expect(screen.getByRole("navigation", { name: "XRC sections" })).not.toBeNull();
  expect(screen.getAllByRole("button", { name: "Overview" }).length).toBeGreaterThan(0);
  expect(screen.getAllByRole("button", { name: "Records" }).length).toBeGreaterThan(0);
  expect(screen.getAllByRole("button", { name: "Chains" }).length).toBeGreaterThan(0);
  expect(screen.queryByRole("button", { name: "History" })).toBeNull();
});

it("renders the evidence workspace in its default record-evidence mode", async () => {
  render(
    <ProfileEvidenceWorkspace
      profile={{ id: "owner-1", fullName: "Ada Lovelace", username: "ada" }}
      currentUser={{ id: "owner-1" }}
      targetId="owner-1"
      onClose={jest.fn()}
    />,
  );

  expect(screen.getByRole("navigation", { name: "XRD sections" })).not.toBeNull();
  expect(screen.queryByRole("navigation", { name: "XRC sections" })).toBeNull();
});

it("renders an owner's shared XRD as a public page, not an owner dashboard", async () => {
  render(
    <ProfileEvidenceWorkspace
      profile={{ id: "owner-1", fullName: "Ada Lovelace", username: "ada" }}
      currentUser={{ id: "owner-1" }}
      targetId="owner-1"
      presentation="page"
      forcePublicView
      initialSection="Permissions"
      verificationItems={[
        { id: "public-proof", profile_id: "owner-1", title: "Public contribution", verified: true, metadata: { visibility: "PUBLIC" } },
        { id: "private-proof", profile_id: "owner-1", title: "Private contribution", verified: true, metadata: { visibility: "PRIVATE" } },
      ]}
      onClose={jest.fn()}
    />,
  );

  expect(screen.getByRole("main", { name: "Ada Lovelace Xeevia Record" })).not.toBeNull();
  expect(screen.queryByRole("dialog", { name: "Ada Lovelace Xeevia Record" })).toBeNull();
  expect(screen.getByText("PUBLIC PREVIEW")).not.toBeNull();
  expect(screen.queryByRole("button", { name: "Permissions" })).toBeNull();
  expect(screen.queryByRole("button", { name: /return to owner view/i })).toBeNull();
  expect(screen.queryByText("Private contribution")).toBeNull();
});

it("previews the public projection without losing private owner records", async () => {
  render(
    <ProfileEvidenceWorkspace
      profile={{ id: "owner-1", fullName: "Ada Lovelace", username: "ada" }}
      currentUser={{ id: "owner-1" }}
      targetId="owner-1"
      verificationItems={[
        { id: "public-proof", profile_id: "owner-1", title: "Public contribution", verified: true, metadata: { visibility: "PUBLIC" } },
        { id: "private-proof", profile_id: "owner-1", title: "Private contribution", verified: true, metadata: { visibility: "PRIVATE" } },
      ]}
      onClose={jest.fn()}
    />,
  );

  expect(await screen.findByText("Private contribution")).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Preview public XRD" }));
  expect(await screen.findByText("Public contribution")).not.toBeNull();
  await waitFor(() => expect(screen.queryByText("Private contribution")).toBeNull());
  expect(screen.getByText("PUBLIC PREVIEW")).not.toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Return to owner view" }));
  expect(await screen.findByText("Private contribution")).not.toBeNull();
});

it("applies the same public projection to non-owner profile visits", async () => {
  xrdRecordService.listClaims.mockResolvedValueOnce([{
    id: "public-claim",
    title: "Data Science Certificate",
    claim_text: "Completed a data science program.",
    record_type: "credential",
    lifecycle_status: "published",
    visibility: "public",
    evidence_links: [{ evidence_item_id: "public-proof", relation: "supports" }],
  }]);
  render(
    <ProfileEvidenceWorkspace
      profile={{ id: "owner-1", fullName: "Ada Lovelace", username: "ada" }}
      currentUser={{ id: "viewer-1" }}
      targetId="owner-1"
      verificationItems={[
        { id: "public-proof", profile_id: "owner-1", title: "Public contribution", verified: true, metadata: { visibility: "PUBLIC" } },
        { id: "private-proof", profile_id: "owner-1", title: "Private contribution", verified: true, metadata: { visibility: "PRIVATE" } },
      ]}
      onClose={jest.fn()}
    />,
  );

  expect(await screen.findByText("Public contribution")).not.toBeNull();
  expect(await screen.findByText("Data Science Certificate")).not.toBeNull();
  expect(screen.getByText("Evidence linked")).not.toBeNull();
  expect(screen.getByText("Source-reported")).not.toBeNull();
  expect(screen.queryByText("Private contribution")).toBeNull();
  expect(screen.getByText("PUBLIC")).not.toBeNull();
  expect(screen.queryByRole("button", { name: /preview public xrd/i })).toBeNull();
  expect(screen.queryByRole("button", { name: "Remarks" })).toBeNull();
  expect(screen.queryByRole("img", { name: /records verified/i })).toBeNull();
  expect(screen.queryByText("Likes")).toBeNull();
  expect(screen.queryByText("Comments")).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Records" }));
  expect(await screen.findByText("XRD records")).not.toBeNull();
  expect(screen.queryByText("Record state preview")).toBeNull();
});

it("routes anonymous XRD access requests to the XRC records section", async () => {
  const onOpenXRC = jest.fn();
  render(
    <ProfileEvidenceWorkspace
      profile={{ id: "owner-1", fullName: "Ada Lovelace", username: "ada" }}
      currentUser={null}
      targetId="owner-1"
      publicSnapshot={{
        profile: { id: "owner-1", username: "ada" },
        claims: [],
        evidenceItems: [],
        bindings: [],
        identityDetails: {},
      }}
      onOpenXRC={onOpenXRC}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Records" }));
  fireEvent.click(await screen.findByRole("button", { name: "Sign in to XRC to request access" }));

  expect(onOpenXRC).toHaveBeenCalledWith(null, "Records");
});

it("renders and inspects real XRD claim, evidence, and identity-binding nodes", () => {
  const claim = {
    id: "claim-1",
    title: "Maintains Atlas",
    claim_text: "I maintain the Atlas open-source library.",
    lifecycle_status: "published",
    evidence_links: [{ id: "link-1", evidence_item_id: "evidence-1", relation: "supports" }],
  };
  const evidence = {
    id: "evidence-1",
    provider: "github",
    title: "Merged pull request #18",
    evidence_type: "activity",
    connection_id: "connection-1",
  };
  const binding = {
    id: "binding-1",
    provider: "github",
    connection_id: "connection-1",
    binding_method: "oauth_popup",
    assurance_scope: "account_control",
    status: "bound",
  };

  render(
    <XrdEvidenceGraph
      items={[evidence]}
      edges={[]}
      profile={{ fullName: "Ada Lovelace", username: "ada" }}
      connections={[{ id: "connection-1", provider: "github", auth_status: "active", hasValidToken: true }]}
      bindings={[binding]}
      claims={[claim]}
      onPick={jest.fn()}
      onOpenVerification={jest.fn()}
      onOpenChain={jest.fn()}
      onVerifyRecord={jest.fn()}
      onTraceRecord={jest.fn()}
      onOpenIdentity={jest.fn()}
      onOpenClaims={jest.fn()}
    />,
  );

  expect(screen.getByText("Owner linked evidence as supporting this claim; this relation is not independent verification")).toBeTruthy();
  expect(screen.getByText("Identity binding link; assurance is limited to account control")).toBeTruthy();
  expect(screen.getByText("This observation was collected through the linked account connection; it does not prove authorship.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /XRD claim Maintains Atlas/ }));
  expect(screen.getByText("I maintain the Atlas open-source library.")).not.toBeNull();
  expect(screen.getByText(/1 visible evidence relationship attached/)).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /github identity binding, bound, account_control/i }));
  expect(screen.getByText(/Assurance scope: account control/i)).not.toBeNull();
});

it("focuses a requested evidence item when opening the evidence graph", async () => {
  const evidence = { id: "focus-evidence", provider: "GitHub", title: "Focus evidence", evidence_type: "activity" };
  render(
    <XrdEvidenceGraph
      items={[{ id: "other-evidence", title: "Other evidence" }, evidence]}
      edges={[]}
      profile={{ fullName: "Ada Lovelace", username: "ada" }}
      focusEvidenceId="focus-evidence"
    />,
  );

  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Open Focus evidence" })).toHaveClass("selected");
  });
});

it("submits a purposeful evidence access request and shows its pending state", async () => {
  render(
    <ProfileEvidenceWorkspace
      profile={{ id: "owner-1", fullName: "Ada Lovelace", username: "ada" }}
      currentUser={{ id: "viewer-1" }}
      targetId="owner-1"
      verificationItems={[]}
    />,
  );

  fireEvent.click(screen.getAllByRole("button", { name: "Evidence" })[0]);
  fireEvent.click(await screen.findByRole("button", { name: "Request access" }));
  fireEvent.change(screen.getByLabelText("What evidence do you need, and why?"), {
    target: { value: "Please share the project evidence supporting this role." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send request" }));

  expect(await screen.findByText("Request pending")).not.toBeNull();
  expect(screen.getByText(/The owner decides which specific items to share/)).not.toBeNull();
});

it("moves evidence details into focused verification and graph views", async () => {
  const evidence = {
    id: "public-proof",
    profile_id: "owner-1",
    title: "Public proof",
    provider: "GitHub",
    evidence_type: "profile",
    verified: true,
    metadata: { visibility: "PUBLIC" },
  };
  render(
    <ProfileEvidenceWorkspace
      profile={{ id: "owner-1", fullName: "Ada Lovelace", username: "ada" }}
      currentUser={{ id: "viewer-1" }}
      targetId="owner-1"
      verificationItems={[evidence]}
    />,
  );

  fireEvent.click(screen.getAllByRole("button", { name: "Evidence" })[0]);
  fireEvent.click(await screen.findByRole("button", { name: "Open evidence details for Public proof" }));
  fireEvent.click(screen.getByRole("button", { name: /Open verification/i }));
  expect(await screen.findByText("Verification", { selector: "h2" })).not.toBeNull();
  expect(screen.queryByText("EVIDENCE RECORD")).toBeNull();
  expect(await screen.findByRole("group", { name: "Verification record Public proof" })).toHaveAttribute("aria-current", "true");

  fireEvent.click(await screen.findByRole("button", { name: "Open evidence details for Public proof" }));
  fireEvent.click(screen.getByRole("button", { name: /View in evidence graph/i }));
  expect(await screen.findByText("Evidence graph", { selector: "h2" })).not.toBeNull();
  expect(screen.getByRole("button", { name: "Open Public proof" })).toHaveClass("selected");
});

it("shows only explicitly public owner links on a shared XRD", () => {
  render(
    <ProfileEvidenceWorkspace
      profile={{ id: "owner-1", fullName: "Ada Lovelace", username: "ada" }}
      currentUser={null}
      targetId="owner-1"
      initialSection="Links"
      publicSnapshot={{
        profile: { id: "owner-1", username: "ada" },
        claims: [],
        evidenceItems: [],
        bindings: [],
        identityDetails: {},
        links: [
          { id: "public-social", category: "social", label: "GitHub", url: "https://github.com/ada", visibility: "public" },
          { id: "private-portfolio", category: "portfolio", label: "Private portfolio", url: "https://example.com/private", visibility: "private" },
        ],
      }}
    />,
  );

  const githubLink = screen.getByRole("link", { name: /GitHub.*social.*owner-provided/i });
  expect(githubLink).toHaveAttribute("href", "https://github.com/ada");
  expect(githubLink).toHaveAttribute("target", "_blank");
  expect(githubLink).toHaveAttribute("rel", "noopener noreferrer");
  expect(screen.queryByText("Private portfolio")).toBeNull();
});