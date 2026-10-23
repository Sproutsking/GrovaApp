import { getXrdIdentityBindings, getXrdProfileAvatarCandidates, SOURCE_PLATFORMS } from "./XRDProfileDashboard";

jest.mock("../../services/shared/mediaUrlService", () => ({
  __esModule: true,
  default: {
    resolveAvatarUrls: (source) => {
      if (typeof source === "string" && source) return [source];
      if (source?.publicUrl) return [source.publicUrl];
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

  it("returns no candidate when the profile has no image data", () => {
    expect(getXrdProfileAvatarCandidates({ id: "profile-without-image" })).toEqual([]);
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

it("lists Apple as an XRD source supported by the connection service", () => {
  expect(SOURCE_PLATFORMS).toContainEqual(["apple", "Apple"]);
});