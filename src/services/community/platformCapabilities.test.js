import { getDistributablePlatforms, getInboundReadyPlatforms, getPlatformCapabilities, PLATFORM_CAPABILITIES } from "./platformCapabilities";

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
    expect(getInboundReadyPlatforms()).toEqual(expect.arrayContaining(["youtube", "twitch"]));
    expect(Object.keys(PLATFORM_CAPABILITIES)).toEqual(expect.arrayContaining(["youtube", "twitch", "tiktok", "snapchat"]));
  });
});