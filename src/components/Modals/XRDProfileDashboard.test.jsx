import { getXrdIdentityBindings, getXrdIdentityDetails, getXrdIdentityRowStatus, getXrdPhotoSources, getXrdProfileAvatarCandidates, SOURCE_PLATFORMS } from "./XRDProfileDashboard";

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