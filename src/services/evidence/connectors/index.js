import { BaseConnector } from "../connectorBase";
import { normalizeConnectorPayload } from "../evidenceNormalizer";
import { registerConnector } from "../connectorRegistry";

export class GitHubConnector extends BaseConnector {
  constructor(options = {}) {
    super({
      provider: "github",
      label: "GitHub",
      supportedTypes: ["profile", "activity"],
      capabilities: ["public-profile", "public-activity"],
      defaultConfig: options,
    });

    this.fetcher = options.fetcher || fetch;
    this.baseUrl = options.baseUrl || "https://api.github.com";
  }

  async fetchProfile(context = {}) {
    const username = context.username || context.profileId || context.handle;
    if (!username) throw new Error("GitHub username is required");

    const response = await this.fetcher(`${this.baseUrl}/users/${encodeURIComponent(username)}`);
    if (!response.ok) {
      throw new Error(`GitHub profile lookup failed: ${response.status}`);
    }

    return response.json();
  }

  async fetchActivity(context = {}) {
    const username = context.username || context.profileId || context.handle;
    if (!username) return [];

    const response = await this.fetcher(`${this.baseUrl}/users/${encodeURIComponent(username)}/events/public?per_page=5`);
    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  normalizeProfile(profile, context = {}) {
    return normalizeConnectorPayload({
      provider: this.provider,
      profile,
      metadata: { source: "github", username: context.username || context.profileId || context.handle },
    }).profile;
  }

  normalizeActivity(activity, context = {}) {
    return normalizeConnectorPayload({
      provider: this.provider,
      activity: [activity],
      metadata: { source: "github", username: context.username || context.profileId || context.handle },
    }).activity[0];
  }
}

export class XConnector extends BaseConnector {
  constructor(options = {}) {
    super({
      provider: "x",
      label: "X",
      supportedTypes: ["profile", "activity"],
      capabilities: ["oauth", "public-profile"],
      defaultConfig: options,
    });

    this.fetcher = options.fetcher || fetch;
    this.baseUrl = options.baseUrl || "https://api.twitter.com/2";
  }

  async fetchProfile(context = {}) {
    const username = context.username || context.profileId || context.handle;
    if (!username) throw new Error("X username is required");

    const token = context.accessToken || this.defaultConfig.accessToken;
    if (!token) {
      throw new Error("X access token is required for profile lookup");
    }

    const response = await this.fetcher(`${this.baseUrl}/users/by/username/${encodeURIComponent(username)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`X profile lookup failed: ${response.status}`);
    }

    const json = await response.json();
    return json.data || null;
  }

  async fetchActivity(context = {}) {
    const userId = context.userId || context.profileId || context.externalId;
    if (!userId) return [];

    const token = context.accessToken || this.defaultConfig.accessToken;
    if (!token) return [];

    const response = await this.fetcher(`${this.baseUrl}/users/${encodeURIComponent(userId)}/tweets?max_results=5`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) return [];

    const json = await response.json();
    return Array.isArray(json.data) ? json.data : [];
  }

  normalizeProfile(profile, context = {}) {
    return normalizeConnectorPayload({
      provider: this.provider,
      profile: {
        ...profile,
        username: profile.username || context.username || context.handle || profile.id,
        name: profile.name || profile.username || context.username || context.handle,
        verified: Boolean(profile.verified || profile.verified_type),
      },
      metadata: { source: "x", username: context.username || context.handle || profile.username },
    }).profile;
  }

  normalizeActivity(activity, context = {}) {
    return normalizeConnectorPayload({
      provider: this.provider,
      activity: [{
        ...activity,
        title: activity.text || activity.title || "X post",
        text: activity.text || null,
        created_at: activity.created_at || activity.createdAt || null,
      }],
      metadata: { source: "x", username: context.username || context.handle || null },
    }).activity[0];
  }
}

export function registerDefaultConnectors() {
  registerConnector(new GitHubConnector());
  registerConnector(new XConnector());
}
