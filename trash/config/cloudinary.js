// src/services/config/cloudinary.js

// Cloudinary Configuration
export const CLOUDINARY_CONFIG = {
  CLOUD_NAME: process.env.REACT_APP_CLOUDINARY_CLOUD_NAME,
  API_KEY: process.env.REACT_APP_CLOUDINARY_API_KEY,
  API_SECRET: process.env.REACT_APP_CLOUDINARY_API_SECRET,
  UPLOAD_PRESET: process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET,
  
  // Base URLs
  UPLOAD_URL: `https://api.cloudinary.com/v1_1/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME}`,
  DELIVERY_URL: `https://res.cloudinary.com/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME}`
};

// Cloudinary Media Client (handles both images and videos)
export class CloudinaryClient {
  constructor() {
    this.cloudName = CLOUDINARY_CONFIG.CLOUD_NAME;
    this.apiKey = CLOUDINARY_CONFIG.API_KEY;
    this.uploadPreset = CLOUDINARY_CONFIG.UPLOAD_PRESET;
    this.uploadUrl = CLOUDINARY_CONFIG.UPLOAD_URL;
    this.deliveryUrl = CLOUDINARY_CONFIG.DELIVERY_URL;
  }

  // Generate signature for authenticated uploads (if needed)
  async generateSignature(params) {
    // Note: For security, signature generation should be done on backend
    // This is a placeholder - implement server-side signing
    console.warn('Signature generation should be handled server-side');
    return null;
  }

  // Upload image with optimizations
  async uploadImage(file, options = {}) {
    const {
      folder = 'grova/images',
      tags = [],
      transformation = {},
      public_id = null
    } = options;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', this.uploadPreset);
    formData.append('folder', folder);
    
    if (public_id) {
      formData.append('public_id', public_id);
    }
    
    if (tags.length > 0) {
      formData.append('tags', tags.join(','));
    }

    // Add transformation if specified
    if (Object.keys(transformation).length > 0) {
      formData.append('transformation', JSON.stringify(transformation));
    }

    try {
      const response = await fetch(`${this.uploadUrl}/image/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to upload image');
      }

      const data = await response.json();
      
      // Return normalized response
      return {
        id: data.public_id,
        url: data.secure_url,
        width: data.width,
        height: data.height,
        format: data.format,
        resourceType: 'image',
        bytes: data.bytes,
        createdAt: data.created_at
      };
    } catch (error) {
      console.error('Image upload error:', error);
      throw error;
    }
  }

  // Upload multiple images
  async uploadImages(files, options = {}) {
    const uploadPromises = files.map(file => this.uploadImage(file, options));
    return await Promise.all(uploadPromises);
  }

  // Upload video with optimization
  async uploadVideo(file, options = {}) {
    const {
      folder = 'grova/videos',
      tags = [],
      transformation = {},
      public_id = null,
      eager = [
        { streaming_profile: 'hd', format: 'm3u8' }, // HLS for adaptive streaming
        { width: 1280, height: 720, crop: 'limit', quality: 'auto', format: 'mp4' }
      ],
      eager_async = true,
      resource_type = 'video'
    } = options;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', this.uploadPreset);
    formData.append('folder', folder);
    formData.append('resource_type', resource_type);
    
    if (public_id) {
      formData.append('public_id', public_id);
    }
    
    if (tags.length > 0) {
      formData.append('tags', tags.join(','));
    }

    // Add eager transformations for video optimization
    if (eager && eager.length > 0) {
      formData.append('eager', JSON.stringify(eager));
      formData.append('eager_async', eager_async);
    }

    try {
      const response = await fetch(`${this.uploadUrl}/video/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to upload video');
      }

      const data = await response.json();
      
      // Return normalized response
      return {
        id: data.public_id,
        url: data.secure_url,
        width: data.width,
        height: data.height,
        format: data.format,
        duration: data.duration,
        resourceType: 'video',
        bytes: data.bytes,
        playbackUrl: this.getVideoPlaybackUrl(data.public_id),
        hlsUrl: data.eager?.find(e => e.format === 'm3u8')?.secure_url || null,
        createdAt: data.created_at
      };
    } catch (error) {
      console.error('Video upload error:', error);
      throw error;
    }
  }

  // Delete media (image or video)
  async deleteMedia(publicId, resourceType = 'image') {
    // Note: Deletion requires authentication
    // This should be handled via your backend for security
    console.warn('Media deletion should be handled server-side with admin API');
    
    try {
      // This is a placeholder - implement server-side deletion
      const response = await fetch('/api/cloudinary/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          public_id: publicId,
          resource_type: resourceType
        })
      });

      return response.ok;
    } catch (error) {
      console.error('Delete media error:', error);
      return false;
    }
  }

  // Get optimized image URL
  getImageUrl(publicId, options = {}) {
    const {
      width,
      height,
      crop = 'fill',
      quality = 'auto',
      format = 'auto',
      fetch_format = 'auto',
      gravity = 'auto',
      effect,
      transformation
    } = options;

    if (!publicId) return null;

    const transformations = [];

    // Build transformation string
    const params = [];
    if (width) params.push(`w_${width}`);
    if (height) params.push(`h_${height}`);
    if (crop) params.push(`c_${crop}`);
    if (quality) params.push(`q_${quality}`);
    if (gravity) params.push(`g_${gravity}`);
    if (effect) params.push(`e_${effect}`);
    if (format && format !== 'auto') params.push(`f_${format}`);
    if (fetch_format) params.push(`f_${fetch_format}`);

    if (params.length > 0) {
      transformations.push(params.join(','));
    }

    // Add custom transformation if provided
    if (transformation) {
      transformations.push(transformation);
    }

    const transformStr = transformations.length > 0 ? `${transformations.join('/')}/` : '';
    
    return `${this.deliveryUrl}/image/upload/${transformStr}${publicId}`;
  }

  // Get video playback URL
  getVideoUrl(publicId, options = {}) {
    const {
      width,
      height,
      quality = 'auto',
      format = 'mp4',
      transformation
    } = options;

    if (!publicId) return null;

    const params = [];
    if (width) params.push(`w_${width}`);
    if (height) params.push(`h_${height}`);
    if (quality) params.push(`q_${quality}`);
    if (format) params.push(`f_${format}`);

    const transformStr = params.length > 0 ? `${params.join(',')}/` : '';
    const customTransform = transformation ? `${transformation}/` : '';
    
    return `${this.deliveryUrl}/video/upload/${customTransform}${transformStr}${publicId}`;
  }

  // Get HLS streaming URL for adaptive bitrate
  getVideoPlaybackUrl(publicId) {
    if (!publicId) return null;
    return `${this.deliveryUrl}/video/upload/sp_hd/${publicId}.m3u8`;
  }

  // Get video thumbnail
  getVideoThumbnail(publicId, options = {}) {
    const {
      time = '0',
      width = 640,
      height = 360,
      format = 'jpg',
      quality = 'auto'
    } = options;

    if (!publicId) return null;

    const params = [
      `so_${time}`,
      `w_${width}`,
      `h_${height}`,
      `c_fill`,
      `q_${quality}`,
      `f_${format}`
    ].join(',');

    return `${this.deliveryUrl}/video/upload/${params}/${publicId}.${format}`;
  }

  // Generate responsive image srcset
  getResponsiveImageSrcset(publicId, widths = [320, 640, 1024, 1280, 1920]) {
    if (!publicId) return null;

    return widths
      .map(width => {
        const url = this.getImageUrl(publicId, { 
          width, 
          crop: 'scale', 
          quality: 'auto',
          fetch_format: 'auto'
        });
        return `${url} ${width}w`;
      })
      .join(', ');
  }

  // Upload with progress tracking
  async uploadWithProgress(file, type = 'image', options = {}, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      
      formData.append('file', file);
      formData.append('upload_preset', this.uploadPreset);
      formData.append('folder', options.folder || `grova/${type}s`);
      
      if (options.tags) {
        formData.append('tags', options.tags.join(','));
      }

      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const percentComplete = (e.loaded / e.total) * 100;
          onProgress(percentComplete);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          const data = JSON.parse(xhr.responseText);
          resolve({
            id: data.public_id,
            url: data.secure_url,
            resourceType: type,
            ...data
          });
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'));
      });

      xhr.open('POST', `${this.uploadUrl}/${type}/upload`);
      xhr.send(formData);
    });
  }
}

// Export singleton instance
export const cloudinaryClient = new CloudinaryClient();

// Helper functions for common use cases
export const uploadPostImages = (files) => {
  return cloudinaryClient.uploadImages(files, {
    folder: 'grova/posts',
    tags: ['post', 'user-content']
  });
};

export const uploadReelVideo = (file) => {
  return cloudinaryClient.uploadVideo(file, {
    folder: 'grova/reels',
    tags: ['reel', 'video'],
    eager: [
      { streaming_profile: 'hd', format: 'm3u8' },
      { width: 720, height: 1280, crop: 'fill', quality: 'auto', format: 'mp4' }
    ]
  });
};

export const uploadStoryImage = (file) => {
  return cloudinaryClient.uploadImage(file, {
    folder: 'grova/stories',
    tags: ['story', 'cover'],
    transformation: {
      width: 1200,
      height: 630,
      crop: 'fill',
      quality: 'auto'
    }
  });
};

export const uploadAvatar = (file) => {
  return cloudinaryClient.uploadImage(file, {
    folder: 'grova/avatars',
    tags: ['avatar', 'profile'],
    transformation: {
      width: 400,
      height: 400,
      crop: 'fill',
      gravity: 'face',
      quality: 'auto'
    }
  });
};