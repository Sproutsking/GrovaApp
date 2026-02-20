// src/services/shared/cacheService.js

class CacheService {
  constructor() {
    this.cache = new Map();
    this.timestamps = new Map();
  }

  /**
   * Get cached data
   * @param {string} key - Cache key
   * @returns {any|null} - Cached data or null if expired/not found
   */
  get(key) {
    if (!this.cache.has(key)) {
      return null;
    }

    const timestamp = this.timestamps.get(key);
    const data = this.cache.get(key);

    // Check if expired
    if (timestamp && Date.now() > timestamp) {
      this.cache.delete(key);
      this.timestamps.delete(key);
      return null;
    }

    return data;
  }

  /**
   * Set cache data
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   * @param {number} ttl - Time to live in milliseconds (default: 5 minutes)
   */
  set(key, data, ttl = 300000) {
    this.cache.set(key, data);
    this.timestamps.set(key, Date.now() + ttl);
  }

  /**
   * Invalidate cache by key or pattern
   * @param {string|RegExp} keyOrPattern - Specific key or pattern to match
   */
  invalidate(keyOrPattern) {
    if (typeof keyOrPattern === "string") {
      // Exact match or prefix match
      const keys = Array.from(this.cache.keys());
      keys.forEach((key) => {
        if (key === keyOrPattern || key.startsWith(keyOrPattern)) {
          this.cache.delete(key);
          this.timestamps.delete(key);
        }
      });
    } else if (keyOrPattern instanceof RegExp) {
      // Pattern match
      const keys = Array.from(this.cache.keys());
      keys.forEach((key) => {
        if (keyOrPattern.test(key)) {
          this.cache.delete(key);
          this.timestamps.delete(key);
        }
      });
    }
  }

  /**
   * Invalidate all keys matching pattern (NEW)
   * @param {string} pattern - Pattern to match
   */
  invalidatePattern(pattern) {
    const keys = Array.from(this.cache.keys());
    const deleted = [];

    keys.forEach((key) => {
      if (key.startsWith(pattern)) {
        this.cache.delete(key);
        this.timestamps.delete(key);
        deleted.push(key);
      }
    });

    if (deleted.length > 0) {
      console.log(
        `🗑️ Cleared ${deleted.length} cache entries matching: ${pattern}`,
      );
    }
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
    this.timestamps.clear();
    console.log("🗑️ Cache cleared completely");
  }

  /**
   * Get cache size
   */
  size() {
    return this.cache.size;
  }

  /**
   * Remove expired entries
   */
  cleanup() {
    const now = Date.now();
    const keys = Array.from(this.timestamps.keys());

    keys.forEach((key) => {
      const timestamp = this.timestamps.get(key);
      if (timestamp && now > timestamp) {
        this.cache.delete(key);
        this.timestamps.delete(key);
      }
    });
  }

  /**
   * Start automatic cleanup
   * @param {number} interval - Cleanup interval in milliseconds (default: 1 minute)
   */
  startAutoCleanup(interval = 60000) {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, interval);
  }

  /**
   * Stop automatic cleanup
   */
  stopAutoCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Create singleton instance
const cacheService = new CacheService();

// Start automatic cleanup
cacheService.startAutoCleanup();

export default cacheService;
