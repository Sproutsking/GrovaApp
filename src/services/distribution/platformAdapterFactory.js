// ============================================================================
// src/services/distribution/platformAdapterFactory.js
// Factory for creating platform-specific adapters
// ============================================================================

import XAdapter from "./adapters/XAdapter";
import FacebookAdapter from "./adapters/FacebookAdapter";
import InstagramAdapter from "./adapters/InstagramAdapter";
import LinkedInAdapter from "./adapters/LinkedInAdapter";

class PlatformAdapterFactory {
  constructor() {
    this.adapters = {
      x: new XAdapter(),
      facebook: new FacebookAdapter(),
      instagram: new InstagramAdapter(),
      linkedin: new LinkedInAdapter(),
    };
  }

  getAdapter(platform) {
    const key = platform.toLowerCase();
    return this.adapters[key] || null;
  }

  getSupportedPlatforms() {
    return Object.keys(this.adapters);
  }

  registerAdapter(platform, adapter) {
    this.adapters[platform.toLowerCase()] = adapter;
  }
}

export default new PlatformAdapterFactory();
