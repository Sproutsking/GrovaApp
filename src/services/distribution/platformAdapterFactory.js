// src/services/distribution/platformAdapterFactory.js
// ============================================================================
// Registry that maps platform string keys to their adapter instances.
// distributionService.js calls getAdapter(platform) — if this file is missing
// or mis-registered, every publish call fails silently.
// ============================================================================

import XAdapter         from "./adapters/XAdapter";
import FacebookAdapter  from "./adapters/FacebookAdapter";
import InstagramAdapter from "./adapters/InstagramAdapter";
import LinkedInAdapter  from "./adapters/LinkedInAdapter";

class PlatformAdapterFactory {
  constructor() {
    this._adapters = {
      x:         new XAdapter(),
      facebook:  new FacebookAdapter(),
      instagram: new InstagramAdapter(),
      linkedin:  new LinkedInAdapter(),
    };
  }

  getAdapter(platform) {
    const adapter = this._adapters[platform];
    if (!adapter) {
      console.warn(`[PlatformAdapterFactory] No adapter registered for: "${platform}"`);
      return null;
    }
    return adapter;
  }

  getSupportedPlatforms() {
    return Object.keys(this._adapters);
  }
}

export default new PlatformAdapterFactory();