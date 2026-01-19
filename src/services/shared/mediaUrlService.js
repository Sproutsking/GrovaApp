// ============================================================================
// src/services/shared/mediaUrlService.js - COMPLETE FIXED
// ============================================================================

class MediaUrlService {
  
  constructor() {
    this.cloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
    this.urlCache = new Map();
    
    if (!this.cloudName) {
      console.error('❌ REACT_APP_CLOUDINARY_CLOUD_NAME not set in .env');
    }
  }

  // ==================== GET CLOUDINARY IMAGE URL ====================
  
  getImageUrl(publicId, options = {}) {
    if (!publicId || !this.cloudName) {
      console.warn('⚠️ Missing publicId or cloudName:', { publicId, cloudName: this.cloudName });
      return null;
    }

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
    
    console.log('🖼️ Generated image URL:', url);
    return url;
  }

  // ==================== GET CLOUDINARY VIDEO URL ====================
  
  getVideoUrl(publicId, options = {}) {
    if (!publicId || !this.cloudName) {
      console.warn('⚠️ Missing publicId or cloudName:', { publicId, cloudName: this.cloudName });
      return null;
    }

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
    
    const url = `${baseUrl}/video/upload/${transformString}${publicId}`;
    
    console.log('🎬 Generated video URL:', url);
    return url;
  }

  // ==================== GET VIDEO STREAMING URL ====================
  
  getVideoStreamUrl(publicId, quality = 'auto') {
    if (!publicId || !this.cloudName) return null;
    
    // Generate HLS streaming URL for adaptive bitrate
    return `https://res.cloudinary.com/${this.cloudName}/video/upload/sp_auto,q_${quality}/${publicId}.m3u8`;
  }

  // ==================== GET VIDEO THUMBNAIL ====================
  
  getVideoThumbnail(publicId, options = {}) {
    const {
      width = 640,
      height = 360,
      time = '0'
    } = options;

    if (!publicId || !this.cloudName) return null;

    return `https://res.cloudinary.com/${this.cloudName}/video/upload/so_${time},w_${width},h_${height},c_fill,q_auto,f_jpg/${publicId}.jpg`;
  }

  // ==================== GET AVATAR URL ====================
  
  getAvatarUrl(avatarId, size = 400) {
    if (!avatarId) return null;
    
    return this.getImageUrl(avatarId, {
      width: size,
      height: size,
      crop: 'thumb',
      gravity: 'face',
      quality: 'auto:best'
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
          quality: 'auto:best'
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
    publicIds.forEach(id => {
      const url = resourceType === 'video' 
        ? this.getVideoUrl(id)
        : this.getImageUrl(id);
        
      if (url) {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.as = resourceType;
        link.href = url;
        document.head.appendChild(link);
      }
    });
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