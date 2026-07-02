export class BaseConnector {
  constructor({ provider, label, supportedTypes = [], capabilities = [], defaultConfig = {} }) {
    this.provider = provider;
    this.label = label;
    this.supportedTypes = supportedTypes;
    this.capabilities = capabilities;
    this.defaultConfig = defaultConfig;
  }

  async connect(context = {}) {
    return {
      provider: this.provider,
      status: "ready",
      connected: true,
      context,
    };
  }

  async fetchProfile() {
    throw new Error(`${this.provider} connector must implement fetchProfile()`);
  }

  async fetchActivity() {
    throw new Error(`${this.provider} connector must implement fetchActivity()`);
  }

  async sync(context = {}) {
    const connection = await this.connect(context);
    const [profileResult, activityResult] = await Promise.all([
      this.fetchProfile(context).catch((error) => ({ error: error.message })),
      this.fetchActivity(context).catch((error) => ({ error: error.message })),
    ]);

    return {
      provider: this.provider,
      connection,
      profile: profileResult,
      activity: activityResult,
    };
  }

  normalizeProfile() {
    throw new Error(`${this.provider} connector must implement normalizeProfile()`);
  }

  normalizeActivity() {
    throw new Error(`${this.provider} connector must implement normalizeActivity()`);
  }
}
