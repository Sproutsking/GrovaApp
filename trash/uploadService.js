// src/services/create/uploadService.js
import { streamClient, imagesClient } from '../config/cloudflare';
import { handleError } from '../shared/errorHandler';

class UploadService {
  
  // ==================== IMAGE UPLOAD ====================
  
  /**
   * Upload single image to Cloudflare Images
   * @param {File} file - Image file to upload
   * @returns {Promise<string>} - Cloudflare Image ID (not URL!)
   */
  async uploadImage(file) {
    try {
      // Validate file
      this.validateImage(file);

      // Upload to Cloudflare Images
      const imageId = await imagesClient.uploadImage(file);

      return imageId; // Return ONLY the ID, never the URL
    } catch (error) {
      throw handleError(error, 'Failed to upload image');
    }
  }

  /**
   * Upload multiple images
   * @param {File[]} files - Array of image files
   * @returns {Promise<string[]>} - Array of Cloudflare Image IDs
   */
  async uploadImages(files) {
    try {
      // Validate all files first
      files.forEach(file => this.validateImage(file));

      // Upload all images in parallel
      const imageIds = await imagesClient.uploadImages(files);

      return imageIds; // Array of IDs only
    } catch (error) {
      throw handleError(error, 'Failed to upload images');
    }
  }

  /**
   * Validate image file
   */
  validateImage(file) {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    if (!file) {
      throw new Error('No file provided');
    }

    if (file.size > maxSize) {
      throw new Error('Image must be less than 10MB');
    }

    if (!allowedTypes.includes(file.type)) {
      throw new Error('Invalid image type. Allowed: JPG, PNG, GIF, WEBP');
    }
  }

  /**
   * Delete image from Cloudflare
   */
  async deleteImage(imageId) {
    try {
      await imagesClient.deleteImage(imageId);
      return { success: true };
    } catch (error) {
      throw handleError(error, 'Failed to delete image');
    }
  }

  // ==================== VIDEO UPLOAD ====================
  
  /**
   * Upload video to Cloudflare Stream
   * @param {File} file - Video file to upload
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Object>} - Video data with ID and metadata
   */
  async uploadVideo(file, onProgress = null) {
    try {
      // Validate video
      this.validateVideo(file);

      // Initiate TUS upload
      const uploadUrl = await streamClient.initiateUpload(file.size, file.name);

      // Upload video in chunks
      const chunkSize = 5 * 1024 * 1024; // 5MB chunks
      let offset = 0;

      while (offset < file.size) {
        const chunk = file.slice(offset, offset + chunkSize);
        await streamClient.uploadChunk(uploadUrl, chunk, offset);

        offset += chunkSize;

        // Report progress
        if (onProgress) {
          const progress = Math.min((offset / file.size) * 100, 100);
          onProgress(progress);
        }
      }

      // Extract video ID from upload URL
      const videoId = this.extractVideoIdFromUrl(uploadUrl);

      // Wait for video to be ready (Cloudflare processes it)
      await this.waitForVideoReady(videoId);

      // Get video details
      const videoData = await streamClient.getVideoDetails(videoId);

      return {
        id: videoId, // Return ONLY the ID
        duration: videoData.result.duration,
        width: videoData.result.input.width,
        height: videoData.result.input.height
      };
    } catch (error) {
      throw handleError(error, 'Failed to upload video');
    }
  }

  /**
   * Validate video file
   */
  validateVideo(file) {
    const maxSize = 100 * 1024 * 1024; // 100MB
    const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];

    if (!file) {
      throw new Error('No file provided');
    }

    if (file.size > maxSize) {
      throw new Error('Video must be less than 100MB');
    }

    if (!allowedTypes.includes(file.type)) {
      throw new Error('Invalid video type. Allowed: MP4, MOV, AVI');
    }
  }

  /**
   * Extract video ID from Cloudflare upload URL
   */
  extractVideoIdFromUrl(uploadUrl) {
    const parts = uploadUrl.split('/');
    return parts[parts.length - 1];
  }

  /**
   * Wait for video to be ready (Cloudflare processes it)
   */
  async waitForVideoReady(videoId, maxAttempts = 20) {
    let attempts = 0;

    while (attempts < maxAttempts) {
      const videoData = await streamClient.getVideoDetails(videoId);
      
      if (videoData.result.status.state === 'ready') {
        return true;
      }

      // Wait 2 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }

    throw new Error('Video processing timeout');
  }

  /**
   * Delete video from Cloudflare
   */
  async deleteVideo(videoId) {
    try {
      await streamClient.deleteVideo(videoId);
      return { success: true };
    } catch (error) {
      throw handleError(error, 'Failed to delete video');
    }
  }

  // ==================== AVATAR UPLOAD ====================
  
  /**
   * Upload avatar (can use Cloudflare Images or Supabase Storage)
   * For now using Cloudflare Images for consistency
   */
  async uploadAvatar(file, userId) {
    try {
      // Validate avatar
      this.validateAvatar(file);

      // Upload to Cloudflare Images
      const imageId = await imagesClient.uploadImage(file);

      return imageId; // Return ID only
    } catch (error) {
      throw handleError(error, 'Failed to upload avatar');
    }
  }

  /**
   * Validate avatar file
   */
  validateAvatar(file) {
    const maxSize = 2 * 1024 * 1024; // 2MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (!file) {
      throw new Error('No file provided');
    }

    if (file.size > maxSize) {
      throw new Error('Avatar must be less than 2MB');
    }

    if (!allowedTypes.includes(file.type)) {
      throw new Error('Invalid avatar type. Allowed: JPG, PNG, WEBP');
    }
  }
}

export default new UploadService();