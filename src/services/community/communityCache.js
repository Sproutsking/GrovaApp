// services/community/communityCache.js
// Module-scoped (survives component unmount/remount, resets on full page reload).
// Purpose: let ChatTab / ChannelsView paint channels INSTANTLY on the second+
// visit to a community, and let CommunitySidebar prefetch channels in the
// background the moment a user's pointer lands on a community icon — so by
// the time they actually click, the data is already sitting in memory.
//
// This is intentionally dumb (Map + timestamps). It is NOT a replacement for
// real-time sync — channelService / communityMessageService / communityState
// remain the source of truth. This just removes the "blank sidebar for 300ms"
// flash on navigation.

const channelsCache = new Map(); // communityId -> { data, ts }
const inFlight = new Map(); // communityId -> Promise (dedupe concurrent fetches)

const STALE_AFTER_MS = 60_000; // background-refresh channels older than this
const STORAGE_KEY = "xeevia_community_channels_v1";

try {
  const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  Object.entries(stored).forEach(([communityId, entry]) => {
    if (entry?.data && Array.isArray(entry.data)) channelsCache.set(communityId, entry);
  });
} catch {}

const communityCache = {
  getChannels(communityId) {
    const entry = channelsCache.get(communityId);
    return entry ? entry.data : null;
  },

  isStale(communityId) {
    const entry = channelsCache.get(communityId);
    if (!entry) return true;
    return Date.now() - entry.ts > STALE_AFTER_MS;
  },

  setChannels(communityId, data) {
    const entry = { data: Array.isArray(data) ? data : [], ts: Date.now() };
    channelsCache.set(communityId, entry);
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      stored[communityId] = entry;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {}
  },

  /**
   * Fetch-and-cache with de-duplication. Safe to call from multiple
   * components (sidebar prefetch + chat tab mount) at the same time —
   * only one network call actually happens.
   */
  async prefetchChannels(communityId, fetcher) {
    if (!communityId) return null;
    if (this.getChannels(communityId) && !this.isStale(communityId)) {
      return this.getChannels(communityId);
    }
    if (inFlight.has(communityId)) return inFlight.get(communityId);

    const promise = fetcher(communityId)
      .then((data) => {
        this.setChannels(communityId, data);
        inFlight.delete(communityId);
        return data;
      })
      .catch((err) => {
        inFlight.delete(communityId);
        throw err;
      });

    inFlight.set(communityId, promise);
    return promise;
  },

  clearCommunity(communityId) {
    channelsCache.delete(communityId);
    inFlight.delete(communityId);
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      delete stored[communityId];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {}
  },
};

export default communityCache;