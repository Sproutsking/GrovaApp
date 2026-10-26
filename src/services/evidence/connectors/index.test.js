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

  it("keeps generic connectors honest about unsupported activity", async () => {
    const connector = getConnector("instagram");
    const result = await connector.sync({ profileId: "https://instagram.example/user" });

    expect(result.profile).toMatchObject({
      id: "https://instagram.example/user",
      verified: false,
    });
    expect(result.activity).toEqual([]);
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
