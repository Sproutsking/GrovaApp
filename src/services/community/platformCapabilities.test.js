import { getDistributablePlatforms, getInboundReadyPlatforms, getPlatformCapabilities, PLATFORM_CAPABILITIES } from "./platformCapabilities";
import { SOCIAL_PROVIDERS, SOCIAL_UPDATE_PROVIDER_IDS } from "./socialUpdatesService";

describe("platform capabilities", () => {
  test("defines the inbound and outbound contract for creator platforms", () => {
    expect(getPlatformCapabilities("youtube")).toMatchObject({
      inboundReady: true,
      outboundReady: false,
      inboundAdapter: "youtube",
      canImportVideos: true,
      canDetectLive: true,
      requiresOAuth: true,
      supportsPolling: true,
    });
    expect(getPlatformCapabilities("twitch")).toMatchObject({
      inboundReady: true,
      outboundReady: false,
      inboundAdapter: "twitch",
      canImportVideos: true,
      canDetectLive: true,
      supportsWebhooks: true,
    });
    expect(getPlatformCapabilities("snapchat").inboundReady).toBe(false);
    expect(getPlatformCapabilities("google")).toMatchObject({ identityOnly: true, outboundReady: false });
    expect(getPlatformCapabilities("tiktok")).toMatchObject({ outboundReady: false, inboundReady: false });
    expect(getPlatformCapabilities("kick")).toMatchObject({ identityOnly: false, inboundReady: false, outboundReady: false });
    expect(getDistributablePlatforms()).toEqual(expect.arrayContaining(["x", "facebook", "instagram", "linkedin"]));
    expect(getInboundReadyPlatforms()).toEqual(expect.arrayContaining(["x", "facebook", "instagram", "youtube", "twitch", "github", "reddit", "linkedin"]));
    expect(Object.keys(PLATFORM_CAPABILITIES)).toEqual(expect.arrayContaining(["youtube", "twitch", "tiktok", "snapchat"]));
  });

  test("limits social updates to social activity providers", () => {
    expect(SOCIAL_UPDATE_PROVIDER_IDS).toEqual(expect.arrayContaining(["xeevia", "x", "facebook", "instagram", "youtube", "twitch", "kick", "discord", "reddit", "telegram", "github", "linkedin", "snapchat"]));
    expect(SOCIAL_PROVIDERS.map(({ id }) => id)).toEqual(SOCIAL_UPDATE_PROVIDER_IDS);
    expect(SOCIAL_UPDATE_PROVIDER_IDS).not.toEqual(expect.arrayContaining(["email", "google"]));
  });
});