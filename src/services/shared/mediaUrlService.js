// ============================================================================
// src/services/shared/mediaUrlService.js - COMPLETE WITH STORY SUPPORT
// ============================================================================

import { supabase } from "../config/supabase";

class MediaUrlService {
  
  constructor() {
    this.cloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
    this.urlCache = new Map();
    this._preloadedMedia = new Set();
    
    if (!this.cloudName) {
      console.warn('⚠️ REACT_APP_CLOUDINARY_CLOUD_NAME not set in .env; falling back to Supabase avatar URLs');
    }
  }

  _isHttpUrl(value) {
    return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
  }

  _isVideoUrl(value) {
    return typeof value === 'string' && (
      /\/video\/upload\//i.test(value) ||
      /\.(mp4|webm|mov|m4v|avi)(?:[?#]|$)/i.test(value)
    );
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
      quality = 'auto:best',
      format = 'auto',
      fetch_format = 'auto'
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
  
  getAvatarUrl(avatarId, size = 400) {
    if (!avatarId) return null;

    if (this._isHttpUrl(avatarId)) return avatarId.trim();

    const cloudinaryUrl = this.getImageUrl(avatarId, {
      width: size,
      height: size,
      crop: 'thumb',
      gravity: 'face',
      quality: 'auto:best'
    });

    if (cloudinaryUrl) return cloudinaryUrl;

    try {
      const { data } = supabase.storage.from('avatars').getPublicUrl(avatarId);
      if (data?.publicUrl) return data.publicUrl;
    } catch {}

    return null;
  }

  // ==================== GET POST IMAGE URL ====================
  
  getPostImageUrl(imageId, width = 800) {
    if (!imageId) return null;
    
    return this.getImageUrl(imageId, {
      width,
      crop: 'fill',
      gravity: 'auto',
      quality: 'auto:good'
    });
  }

  // ==================== GET STORY COVER IMAGE URL ====================
  
  getStoryImageUrl(imageId, width = 1200) {
    if (!imageId) return null;
    
    return this.getImageUrl(imageId, {
      width,
      crop: 'fill',
      gravity: 'auto',
      quality: 'auto:good'
    });
  }

  // ==================== GET REEL VIDEO URL ====================
  
  getReelVideoUrl(videoId) {
    if (!videoId) return null;
    
    return this.getVideoUrl(videoId, {
      quality: 'auto:good',
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
          quality: 'auto:good'
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
    console.log('🗑️ URL cache cleared');
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