import { getConnector, listConnectors } from "../connectorRegistry";
import { CONNECTOR_DEFINITIONS } from "../../connectors/connectorRegistry";
import { registerDefaultConnectors, XConnector } from "./index";

describe("evidence connector coverage", () => {
  beforeEach(() => {
    registerDefaultConnectors();
  });

  it("registers an evidence connector for every declared platform", () => {
    Object.keys(CONNECTOR_DEFINITIONS).forEach((provider) => {
      expect(getConnector(provider)).toBeDefined();
    });

    expect(listConnectors()).toHaveLength(Object.keys(CONNECTOR_DEFINITIONS).length);
  });

  it("uses provider identity metadata instead of fabricating an external profile", async () => {
    const connector = getConnector("instagram");
    const result = await connector.sync({
      profileId: "instagram-user",
      identityData: {
        sub: "instagram-user",
        username: "sprouts",
        full_name: "Sprouts",
        picture: "https://images.example/instagram-avatar.jpg",
      },
    });

    expect(result.profile).toMatchObject({
      id: "instagram-user",
      username: "sprouts",
      name: "Sprouts",
      verified: false,
    });
    expect(result.activity).toEqual([]);
    expect(result.profile.avatar_url).toBe("https://images.example/instagram-avatar.jpg");
  });

  it("uses the authenticated X profile endpoint when the linked identifier is numeric", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: "123", username: "sprouts", name: "Sprouts" } }),
    });
    const connector = new XConnector({ fetcher, baseUrl: "https://api.example/2" });
    await connector.fetchProfile({ profileId: "123", accessToken: "test-token" });

    expect(fetcher.mock.calls[0][0]).toContain("/users/me?");
  });

  it("uses available X identity metadata when no publishing token was granted", async () => {
    const connector = new XConnector({ fetcher: jest.fn() });
    const profile = await connector.fetchProfile({
      username: "sprouts",
      identityData: {
        id: "x-user-1",
        user_name: "sprouts",
        full_name: "Sprouts",
        profile_image_url: "https://images.example/x-avatar.jpg",
      },
    });

    expect(profile).toMatchObject({
      id: "x-user-1",
      username: "sprouts",
      name: "Sprouts",
      profile_image_url: "https://images.example/x-avatar.jpg",
    });
  });

  it("requests and preserves X profile image URLs in connector evidence", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: {
        id: "x-user-1",
        username: "sprouts",
        name: "Sprouts",
        profile_image_url: "https://images.example/x-avatar.jpg",
      } }),
    });
    const connector = new XConnector({ fetcher, baseUrl: "https://api.example/2" });
    const rawProfile = await connector.fetchProfile({ username: "sprouts", accessToken: "test-token" });
    const evidence = connector.normalizeProfile(rawProfile, { username: "sprouts" });

    expect(fetcher.mock.calls[0][0]).toContain("user.fields=profile_image_url");
    expect(evidence.metadata.avatarUrl).toBe("https://images.example/x-avatar.jpg");
  });
});
