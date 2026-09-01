// ============================================================================
// src/services/shared/mediaUrlService.js - COMPLETE WITH STORY SUPPORT
// ============================================================================

import { supabase } from "../config/supabase";

// ─── LRU Cache Implementation for preloaded media ───────────────────────────
class LRUCache {
  constructor(maxSize = 500) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  has(key) {
    return this.cache.has(key);
  }

  add(key) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    this.cache.set(key, true);
    if (this.cache.size > this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }
}

class MediaUrlService {
  
  constructor() {
    this.cloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
    this.urlCache = new Map();
    this.optimizedCache = new Map();
    this._preloadedMedia = new LRUCache(500);
    this._avatarUrlCache = new Map();
    
    if (!this.cloudName) {
      console.warn('⚠️ REACT_APP_CLOUDINARY_CLOUD_NAME not set in .env; falling back to Supabase avatar URLs');
    }
  }

  _isHttpUrl(value) {
    return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
  }

  _cacheStamp(value) {
    if (!value || typeof value !== 'string') return '0';
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
    }
    return String(hash || 1);
  }

  _normalizeImageQuery(url, size = 400, force = false) {
    if (!url || typeof url !== 'string') return url;
    const trimmed = url.trim();
    if (!trimmed || (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('blob:'))) {
      return trimmed;
    }

    try {
      const parsed = new URL(trimmed);
      const target = Math.max(80, Number(size) || 400);
      parsed.searchParams.set('width', String(target));
      parsed.searchParams.set('height', String(target));
      parsed.searchParams.set('quality', '100');
      parsed.searchParams.set('resize', 'cover');
      parsed.searchParams.set('format', 'webp');
      parsed.searchParams.set('auto', 'format');
      parsed.searchParams.set('v', force ? String(Date.now()) : this._cacheStamp(trimmed));
      return parsed.toString();
    } catch {
      const separator = trimmed.includes('?') ? '&' : '?';
      const target = Math.max(80, Number(size) || 400);
      const stamp = force ? String(Date.now()) : this._cacheStamp(trimmed);
      return `${trimmed}${separator}width=${target}&height=${target}&quality=100&resize=cover&format=webp&auto=format&v=${stamp}`;
    }
  }

  _isVideoUrl(value) {
    return typeof value === 'string' && (
      /\/video\/upload\//i.test(value) ||
      /\.(mp4|webm|mov|m4v|avi)(?:[?#]|$)/i.test(value)
    );
  }

  _optimizeDirectImageUrl(source, options = {}) {
    if (!this._isHttpUrl(source)) return source;

    const {
      width = 400,
      height = width,
      quality = '100',
      format = 'webp',
      crop = 'fill',
      gravity = 'face',
    } = options;

    try {
      const url = new URL(source.trim());

      if (/res\.cloudinary\.com$/i.test(url.hostname) && /\/image\/upload\//i.test(url.pathname)) {
        const marker = '/image/upload/';
        const markerIndex = url.pathname.indexOf(marker);
        const pathBefore = url.pathname.slice(0, markerIndex + marker.length);
        const pathAfter = url.pathname.slice(markerIndex + marker.length);
        const parts = pathAfter.split('/');
        const hasTransform = /^(?:w_|h_|c_|g_|q_|f_|dpr_)/.test(parts[0] || '');
        const publicPath = hasTransform ? parts.slice(1).join('/') : pathAfter;
        url.pathname = `${pathBefore}w_${width},h_${height},c_${crop},g_${gravity},q_${quality},f_${format === 'auto' ? 'webp' : format},dpr_auto/${publicPath}`;
        return url.toString();
      }

      if (/supabase\.co$/i.test(url.hostname) && /\/storage\/v1\/object\/public\//i.test(url.pathname)) {
        url.searchParams.set('width', String(width));
        url.searchParams.set('height', String(height));
        url.searchParams.set('resize', crop === 'fill' ? 'cover' : 'contain');
        url.searchParams.set('quality', '100');
        url.searchParams.set('format', 'webp');
        return url.toString();
      }
    } catch {}

    return source.trim();
  }

  getOptimizedImageUrl(source, options = {}) {
    if (!source) return null;

    const normalizedOptions = {
      width: 400,
      height: 400,
      quality: '100',
      format: 'webp',
      crop: 'fill',
      gravity: 'face',
      ...options,
    };

    if (typeof source === 'object') {
      const direct = source.url || source.avatar_url || source.avatarUrl || source.image_url || source.publicUrl;
      if (direct) return this.getOptimizedImageUrl(direct, normalizedOptions);
      const id = source.avatar_id || source.id || source.public_id;
      return id ? this.getOptimizedImageUrl(id, normalizedOptions) : null;
    }

    const cacheKey = JSON.stringify({ source, ...normalizedOptions });
    if (this.optimizedCache.has(cacheKey)) {
      return this.optimizedCache.get(cacheKey);
    }

    let optimized;
    if (this._isHttpUrl(source)) {
      optimized = this._optimizeDirectImageUrl(source, normalizedOptions);
    } else {
      optimized = this.getImageUrl(source, { quality: '100', format: 'webp', ...normalizedOptions });
    }

    this.optimizedCache.set(cacheKey, optimized);
    return optimized;
  }

  _stripVideoExtension(value) {
    return typeof value === 'string'
      ? value.replace(/\.(mp4|webm|mov|m4v|avi)(?:[?#].*)?$/i, '')
      : value;
  }

  _markPreloaded(url) {
    if (!url) return;
    this._preloadedMedia.add(url);
  }

  _isPreloaded(url) {
    return !!url && this._preloadedMedia.has(url);
  }

  // Get cache size info for monitoring
  getCacheStats() {
    return {
      preloadedMedia: this._preloadedMedia.size(),
      optimizedCache: this.optimizedCache.size,
      urlCache: this.urlCache.size,
      avatarUrlCache: this._avatarUrlCache.size,
    };
  }

  _appendLink(url, as, rel, type, priority) {
    try {
      const link = document.createElement('link');
      link.rel = rel;
      link.as = as;
      link.href = url;
      if (type) link.type = type;
      if (priority === 'high') link.fetchPriority = 'high';
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    } catch {}
  }

  preloadMediaUrl(url, options = {}) {
    if (!url || typeof url !== 'string' || typeof document === 'undefined') return;
    const type = options.type === 'video' ? 'video' : 'image';
    const priority = options.priority || 'high';
    if (this._isPreloaded(url)) return;
    this._markPreloaded(url);

    const rel = priority === 'low' ? 'prefetch' : 'preload';
    const as = type === 'video' ? 'video' : 'image';
    const mimeType = type === 'video' ? 'video/mp4' : 'image/*';
    this._appendLink(url, as, rel, mimeType, priority);

    if (type === 'image') {
      try {
        const img = new Image();
        img.src = url;
        if (priority === 'high') img.fetchPriority = 'high';
      } catch {}
    } else if (type === 'video') {
      try {
        const video = document.createElement('video');
        video.preload = priority === 'high' ? 'auto' : 'metadata';
        video.muted = true;
        video.playsInline = true;
        video.src = url;
        video.style.display = 'none';
        document.body.appendChild(video);
        setTimeout(() => {
          if (video.parentNode) video.parentNode.removeChild(video);
        }, 20000);
      } catch {}
    }
  }

  preloadMediaUrls(items = [], options = {}) {
    if (!Array.isArray(items)) return;
    items.forEach((item) => {
      if (!item) return;
      if (typeof item === 'string') {
        this.preloadMediaUrl(item, options);
        return;
      }
      if (typeof item.url === 'string') {
        this.preloadMediaUrl(item.url, {
          type: item.type || options.type || 'image',
          priority: item.priority || options.priority || 'high',
        });
      }
    });
  }

  // ==================== GET CLOUDINARY IMAGE URL ====================
  
  getImageUrl(publicId, options = {}) {
    if (!publicId) {
      console.warn('⚠️ Missing publicId or cloudName:', { publicId, cloudName: this.cloudName });
      return null;
    }

    // Database rows may already contain a signed/CDN URL. Never treat it as
    // a Cloudinary public ID or strip its query parameters.
    if (this._isHttpUrl(publicId)) return publicId.trim();

    if (!this.cloudName) return null;

    const {
      width,
      height,
      crop = 'fill',
      gravity = 'auto',
      quality = '100',
      format = 'webp',
      fetch_format = 'webp'
    } = options;

    const baseUrl = `https://res.cloudinary.com/${this.cloudName}`;
    const transforms = [];
    
    // Add transformations
    if (width) transforms.push(`w_${width}`);
    if (height) transforms.push(`h_${height}`);
    if (crop) transforms.push(`c_${crop}`);
    if (gravity) transforms.push(`g_${gravity}`);
    if (quality) transforms.push(`q_${quality}`);
    if (format && format !== 'auto') transforms.push(`f_${format}`);
    if (fetch_format) transforms.push(`f_${fetch_format}`);
    
    // Add automatic optimizations
    transforms.push('dpr_auto');
    
    const transformString = transforms.length > 0 ? `${transforms.join(',')}/` : '';
    
    const url = `${baseUrl}/image/upload/${transformString}${publicId}`;
    
    return url;
  }

  // ==================== GET CLOUDINARY VIDEO URL ====================
  
  getVideoUrl(publicId, options = {}) {
    if (!publicId) {
      console.warn('⚠️ Missing publicId or cloudName:', { publicId, cloudName: this.cloudName });
      return null;
    }

    // Preserve direct, signed, and provider-hosted video URLs verbatim.
    if (this._isHttpUrl(publicId)) return publicId.trim();

    if (!this.cloudName) return null;

    const {
      width,
      height,
      quality = 'auto',
      format = 'mp4'
    } = options;

    const baseUrl = `https://res.cloudinary.com/${this.cloudName}`;
    const transforms = [];
    
    if (width) transforms.push(`w_${width}`);
    if (height) transforms.push(`h_${height}`);
    if (quality) transforms.push(`q_${quality}`);
    if (format) transforms.push(`f_${format}`);
    
    const transformString = transforms.length > 0 ? `${transforms.join(',')}/` : '';
    
    const url = `${baseUrl}/video/upload/${transformString}${this._stripVideoExtension(publicId)}`;
    
    return url;
  }

  // ==================== GET VIDEO STREAMING URL ====================
  
  getVideoStreamUrl(publicId, quality = 'auto') {
    if (!publicId || !this.cloudName) return null;

    if (this._isHttpUrl(publicId)) return publicId.trim();
    
    // Generate HLS streaming URL for adaptive bitrate
    return `https://res.cloudinary.com/${this.cloudName}/video/upload/sp_auto,q_${quality}/${this._stripVideoExtension(publicId)}.m3u8`;
  }

  // ==================== GET VIDEO THUMBNAIL ====================
  
  getVideoThumbnail(publicId, options = {}) {
    const {
      width = 640,
      height = 360,
      time = '0'
    } = options;

    if (!publicId) return null;

    if (this._isHttpUrl(publicId)) {
      const source = publicId.trim();
      if (!/\/video\/upload\//i.test(source)) return this._isVideoUrl(source) ? null : source;

      try {
        const url = new URL(source);
        const marker = '/video/upload/';
        const markerIndex = url.pathname.indexOf(marker);
        const publicPath = url.pathname.slice(markerIndex + marker.length);
        const publicIdPath = this._stripVideoExtension(publicPath);
        const transforms = `so_${time},w_${width},h_${height},c_fill,q_auto,f_jpg`;
        return `${url.origin}${url.pathname.slice(0, markerIndex + marker.length)}${transforms}/${publicIdPath}${url.search}`;
      } catch {
        return null;
      }
    }

    if (!this.cloudName) return null;

    return `https://res.cloudinary.com/${this.cloudName}/video/upload/so_${time},w_${width},h_${height},c_fill,q_auto,f_jpg/${this._stripVideoExtension(publicId)}.jpg`;
  }

  // ==================== GET AVATAR URL ====================
  
  resolveAvatarUrl(avatarSource, size = 400) {
    if (!avatarSource) return null;

    if (typeof avatarSource === 'object') {
      const direct = avatarSource.url || avatarSource.avatar_url || avatarSource.avatarUrl || avatarSource.image_url || avatarSource.publicUrl;
      if (direct) return this.resolveAvatarUrl(direct, size);
      const id = avatarSource.avatar_id || avatarSource.id || avatarSource.public_id;
      if (id) return this.resolveAvatarUrl(id, size);
      return null;
    }

    // Use stable cache key for avatar URLs (based on source + size)
    const cacheKey = `${avatarSource}:${size}`;
    if (this._avatarUrlCache.has(cacheKey)) {
      return this._avatarUrlCache.get(cacheKey);
    }

    let result = null;

    // For already-optimized or direct URLs, enhance them further
    if (this._isHttpUrl(avatarSource)) {
      result = this._optimizeDirectImageUrl(avatarSource, {
        width: size,
        height: size,
        crop: 'fill',
        gravity: 'face',
        quality: '100',
        format: 'webp',
      });
    } else {
      // For Cloudinary public IDs, use HIGHEST quality
      const cloudinaryUrl = this.getImageUrl(avatarSource, {
        width: size,
        height: size,
        crop: 'thumb',
        gravity: 'face',
        quality: '100',
        format: 'webp',
      });

      if (cloudinaryUrl) {
        // Use stable cache hash instead of Date.now()
        const cacheHash = this._cacheStamp(avatarSource);
        result = `${cloudinaryUrl}${cloudinaryUrl.includes('?') ? '&' : '?'}v=${cacheHash}`;
      } else {
        // Fallback to Supabase storage
        try {
          const { data } = supabase.storage.from('avatars').getPublicUrl(avatarSource);
          if (data?.publicUrl) {
            result = this._optimizeDirectImageUrl(data.publicUrl, {
              width: size,
              height: size,
              quality: '100',
              format: 'webp',
            });
          }
        } catch {}
      }
    }

    // Cache the resolved URL to prevent recomputation
    if (result) {
      this._avatarUrlCache.set(cacheKey, result);
      // Prevent cache from growing unbounded (max 200 avatar URLs)
      if (this._avatarUrlCache.size > 200) {
        const oldestKey = this._avatarUrlCache.keys().next().value;
        this._avatarUrlCache.delete(oldestKey);
      }
    }

    return result;
  }

  getAvatarUrl(avatarId, size = 400) {
    return this.resolveAvatarUrl(avatarId, size);
  }

  // ==================== GET POST IMAGE URL ====================
  
  getPostImageUrl(imageId, width = 800) {
    if (!imageId) return null;
    
    return this.getImageUrl(imageId, {
      width,
      crop: 'fill',
      gravity: 'auto',
      quality: '100',
      format: 'webp'
    });
  }

  // ==================== GET STORY COVER IMAGE URL ====================
  
  getStoryImageUrl(imageId, width = 1200) {
    if (!imageId) return null;
    
    return this.getImageUrl(imageId, {
      width,
      crop: 'fill',
      gravity: 'auto',
      quality: '100',
      format: 'webp'
    });
  }

  // ==================== GET REEL VIDEO URL ====================
  
  getReelVideoUrl(videoId) {
    if (!videoId) return null;
    
    return this.getVideoUrl(videoId, {
      quality: 'auto:best',
      format: 'mp4'
    });
  }

  // ==================== GET REEL THUMBNAIL URL ====================
  
  getReelThumbnailUrl(publicId, width = 400) {
    if (!publicId) return null;
    
    return this.getVideoThumbnail(publicId, {
      width,
      height: Math.round(width * 16 / 9),
      time: '0'
    });
  }

  // ==================== GET RESPONSIVE SRCSET ====================
  
  getResponsiveSrcset(imageId, widths = [320, 640, 960, 1280, 1920]) {
    if (!imageId) return null;

    return widths
      .map(width => {
        const url = this.getImageUrl(imageId, {
          width,
          crop: 'scale',
          quality: '100',
          format: 'webp'
        });
        return `${url} ${width}w`;
      })
      .join(', ');
  }

  // ==================== GET PLACEHOLDER URL ====================
  
  getPlaceholderUrl(imageId) {
    return this.getImageUrl(imageId, {
      width: 50,
      quality: 30,
      format: 'jpg'
    });
  }

  // ==================== BATCH URLS ====================
  
  getBatchUrls(publicIds, resourceType = 'image', transformations = {}) {
    return publicIds.map(id => {
      if (resourceType === 'video') {
        return this.getVideoUrl(id, transformations);
      }
      return this.getImageUrl(id, transformations);
    });
  }

  // ==================== CACHE MANAGEMENT ====================
  
  clearCache() {
    this.urlCache.clear();
    this.optimizedCache.clear();
    this._preloadedMedia.clear();
    this._avatarUrlCache.clear();
    console.log('🗑️ All image caches cleared');
  }

  clearPreloadCache() {
    this._preloadedMedia.clear();
    console.log('🗑️ Preload cache cleared');
  }

  clearAvatarCache() {
    this._avatarUrlCache.clear();
    console.log('🗑️ Avatar URL cache cleared');
  }

  removeFromCache(publicId) {
    const keysToDelete = [];
    for (const [key] of this.urlCache) {
      if (key.startsWith(publicId)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.urlCache.delete(key));
  }

  // ==================== PRELOAD URLS ====================
  
  preloadUrls(publicIds, resourceType = 'image') {
    if (!Array.isArray(publicIds)) return;
    const items = publicIds.map((id) => {
      const url = resourceType === 'video'
        ? this.getVideoUrl(id)
        : this.getImageUrl(id);
      return url ? { url, type: resourceType, priority: 'low' } : null;
    }).filter(Boolean);
    this.preloadMediaUrls(items, { priority: 'low' });
  }

  // ==================== UTILITY METHODS ====================
  
  isValidUrl(url) {
    if (!url) return false;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  extractPublicId(url) {
    if (!url) return null;
    
    // Extract public_id from Cloudinary URL
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+)$/);
    return match ? match[1].replace(/\.[^/.]+$/, '') : null;
  }
}

const mediaUrlService = new MediaUrlService();
export default mediaUrlService;