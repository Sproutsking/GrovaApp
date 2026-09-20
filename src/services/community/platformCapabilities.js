export const PLATFORM_CAPABILITIES = {
  xeevia: { label: "Xeevia", identityOnly: false, inboundReady: true, outboundReady: true, inboundAdapter: "internal", outboundAdapter: "internal", canLinkIdentity: true, canImportPosts: true, canImportVideos: true, canDetectLive: false, canPublishOutward: true, requiresOAuth: false, supportsWebhooks: false, supportsPolling: true },
  x: { label: "X", identityOnly: false, inboundReady: false, outboundReady: true, inboundAdapter: null, outboundAdapter: "x", canLinkIdentity: true, canImportPosts: true, canImportVideos: false, canDetectLive: false, canPublishOutward: true, requiresOAuth: true, supportsWebhooks: false, supportsPolling: true },
  facebook: { label: "Facebook", identityOnly: false, inboundReady: false, outboundReady: true, inboundAdapter: null, outboundAdapter: "facebook", canLinkIdentity: true, canImportPosts: true, canImportVideos: true, canDetectLive: true, canPublishOutward: true, requiresOAuth: true, supportsWebhooks: true, supportsPolling: true },
  instagram: { label: "Instagram", identityOnly: false, inboundReady: false, outboundReady: true, inboundAdapter: null, outboundAdapter: "instagram", canLinkIdentity: true, canImportPosts: true, canImportVideos: true, canDetectLive: true, canPublishOutward: true, requiresOAuth: true, supportsWebhooks: true, supportsPolling: true },
  tiktok: { label: "TikTok", identityOnly: false, inboundReady: false, outboundReady: false, inboundAdapter: null, outboundAdapter: null, canLinkIdentity: true, canImportPosts: true, canImportVideos: true, canDetectLive: false, canPublishOutward: false, requiresOAuth: true, supportsWebhooks: false, supportsPolling: true },
  discord: { label: "Discord", identityOnly: false, inboundReady: false, outboundReady: false, inboundAdapter: null, outboundAdapter: null, canLinkIdentity: true, canImportPosts: true, canImportVideos: false, canDetectLive: false, canPublishOutward: false, requiresOAuth: true, supportsWebhooks: true, supportsPolling: true },
  youtube: { label: "YouTube", identityOnly: false, inboundReady: true, outboundReady: false, inboundAdapter: "youtube", outboundAdapter: null, canLinkIdentity: true, canImportPosts: true, canImportVideos: true, canDetectLive: true, canPublishOutward: false, requiresOAuth: true, supportsWebhooks: false, supportsPolling: true },
  twitch: { label: "Twitch", identityOnly: false, inboundReady: true, outboundReady: false, inboundAdapter: "twitch", outboundAdapter: null, canLinkIdentity: true, canImportPosts: false, canImportVideos: true, canDetectLive: true, canPublishOutward: false, requiresOAuth: true, supportsWebhooks: true, supportsPolling: true },
  kick: { label: "Kick", identityOnly: false, inboundReady: false, outboundReady: false, inboundAdapter: null, outboundAdapter: null, canLinkIdentity: true, canImportPosts: false, canImportVideos: false, canDetectLive: true, canPublishOutward: false, requiresOAuth: true, supportsWebhooks: false, supportsPolling: false },
  snapchat: { label: "Snapchat", identityOnly: false, inboundReady: false, outboundReady: false, inboundAdapter: null, outboundAdapter: null, canLinkIdentity: true, canImportPosts: false, canImportVideos: false, canDetectLive: false, canPublishOutward: false, requiresOAuth: true, supportsWebhooks: false, supportsPolling: false },
  google: { label: "Google", identityOnly: true, inboundReady: false, outboundReady: false, inboundAdapter: null, outboundAdapter: null, canLinkIdentity: true, canImportPosts: false, canImportVideos: false, canDetectLive: false, canPublishOutward: false, requiresOAuth: true, supportsWebhooks: false, supportsPolling: false },
  github: { label: "GitHub", identityOnly: true, inboundReady: false, outboundReady: false, inboundAdapter: null, outboundAdapter: null, canLinkIdentity: true, canImportPosts: false, canImportVideos: false, canDetectLive: false, canPublishOutward: false, requiresOAuth: true, supportsWebhooks: true, supportsPolling: true },
  linkedin: { label: "LinkedIn", identityOnly: false, inboundReady: false, outboundReady: true, inboundAdapter: null, outboundAdapter: "linkedin", canLinkIdentity: true, canImportPosts: true, canImportVideos: false, canDetectLive: false, canPublishOutward: true, requiresOAuth: true, supportsWebhooks: false, supportsPolling: true },
};

export const getPlatformCapabilities = (provider) => PLATFORM_CAPABILITIES[provider] || null;

export const getDistributablePlatforms = () => Object.entries(PLATFORM_CAPABILITIES)
  .filter(([, capability]) => capability.outboundReady && capability.outboundAdapter)
  .map(([provider]) => provider);

export const getInboundReadyPlatforms = () => Object.entries(PLATFORM_CAPABILITIES)
  .filter(([, capability]) => capability.inboundReady && capability.inboundAdapter)
  .map(([provider]) => provider);
