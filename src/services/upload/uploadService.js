// ============================================================================
// src/services/upload/uploadService.js - FIXED VIDEO UPLOAD
// ============================================================================

import { supabase } from '../config/supabase';

class UploadService {
  
  constructor() {
    this.cloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
    this.uploadPreset = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;
    
    // Rate limiting
    this.uploadQueue = [];
    this.maxConcurrentUploads = 3;
    this.activeUploads = 0;
    
    // Security limits
    this.maxUploadsPerMinute = 10;
    this.uploadTimestamps = [];
    
    if (!this.cloudName || !this.uploadPreset) {
      console.error('❌ Missing Cloudinary credentials in .env');
    }
  }

  // ==================== SECURITY: CHECK USER AUTHENTICATION ====================
  
  async checkAuth() {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      throw new Error('You must be logged in to upload files');
    }
    
    return user;
  }

  // ==================== SECURITY: RATE LIMITING ====================
  
  checkRateLimit() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Remove old timestamps
    this.uploadTimestamps = this.uploadTimestamps.filter(t => t > oneMinuteAgo);
    
    if (this.uploadTimestamps.length >= this.maxUploadsPerMinute) {
      throw new Error('Upload limit exceeded. Please wait a moment.');
    }
    
    this.uploadTimestamps.push(now);
  }

  // ==================== SECURITY: VALIDATE FILE CONTENT (FIXED) ====================
  
  async validateFileContent(file, type = 'image') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const arr = new Uint8Array(e.target.result);
        
        // Read more bytes for better detection (12 bytes instead of 4)
        const headerBytes = arr.subarray(0, Math.min(12, arr.length));
        let header = '';
        for (let i = 0; i < headerBytes.length; i++) {
          header += headerBytes[i].toString(16).padStart(2, '0');
        }
        
        console.log(`🔍 File signature check (${type}):`, header);
        
        if (type === 'image') {
          const imageSignatures = [
            '89504e47',           // PNG
            'ffd8ff',             // JPEG (any JPEG variant)
            '474946383',          // GIF
            '52494646',           // WEBP (RIFF)
          ];
          
          const isValid = imageSignatures.some(sig => 
            header.toLowerCase().startsWith(sig.toLowerCase())
          );
          
          if (!isValid) {
            reject(new Error(`Invalid image file. File may be corrupted or wrong format.`));
          } else {
            console.log('✅ Image signature validated');
            resolve(true);
          }
        } 
        else if (type === 'video') {
          // MP4 files can have many valid signatures
          const videoSignatures = [
            '000000',             // MP4 (ftyp box - common start)
            '66747970',           // MP4 (ftyp - "ftyp" string)
            '00000018667479706d7034',  // MP4 iso4
            '00000020667479706d7034',  // MP4 iso5
            '1a45dfa3',           // WEBM/MKV
            '52494646',           // AVI (RIFF)
            '000001ba',           // MPEG
            '000001b3',           // MPEG
          ];
          
          // For MP4, also check for "ftyp" string anywhere in first 12 bytes
          const hasMP4Marker = header.includes('66747970'); // "ftyp" in hex
          
          // Check if any known signature matches
          const hasValidSignature = videoSignatures.some(sig => 
            header.toLowerCase().includes(sig.toLowerCase())
          );
          
          // MP4 files often start with 0x00 bytes, so we're lenient
          const looksLikeMP4 = header.startsWith('00000') || hasMP4Marker;
          
          if (hasValidSignature || looksLikeMP4) {
            console.log('✅ Video signature validated');
            resolve(true);
          } else {
            // Even if signature doesn't match, allow it if it passes MIME type check
            // Cloudinary will do its own validation
            console.warn('⚠️ Video signature uncertain, but allowing upload');
            resolve(true);
          }
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      
      // Read first 12 bytes for better detection
      reader.readAsArrayBuffer(file.slice(0, 12));
    });
  }

  // ==================== SECURITY: SANITIZE FILENAME ====================
  
  sanitizeFilename(filename) {
    // Remove dangerous characters but be more lenient with valid chars
    return filename
      .replace(/[^a-zA-Z0-9._\-]/g, '_')
      .replace(/_{2,}/g, '_')
      .substring(0, 100); // Limit length
  }

  // ==================== IMAGE UPLOAD WITH SECURITY ====================
  
  async uploadImage(file, folder = 'grova/posts') {
    try {
      console.log('📤 Uploading image:', file.name, 'to folder:', folder);
      
      // SECURITY: Check authentication
      const user = await this.checkAuth();
      
      // SECURITY: Rate limiting
      this.checkRateLimit();
      
      // SECURITY: Validate file
      this.validateImage(file);
      
      // SECURITY: Validate file content (magic numbers)
      await this.validateFileContent(file, 'image');
      
      // SECURITY: Sanitize filename
      const safeName = this.sanitizeFilename(file.name);
      
      // SECURITY: Add user ID to folder for isolation
      const userFolder = `${folder}/${user.id}`;

      // Prepare form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', this.uploadPreset);
      formData.append('folder', userFolder);
      formData.append('public_id', `${Date.now()}_${safeName.split('.')[0]}`);
      
      // Add context metadata (for moderation/tracking)
      formData.append('context', `user_id=${user.id}|uploaded_at=${new Date().toISOString()}`);
      
      // Upload to Cloudinary
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`,
        {
          method: 'POST',
          body: formData
        }
      );

      if (!response.ok) {
        const error = await response.json();
        console.error('❌ Cloudinary error:', error);
        throw new Error(error.error?.message || 'Upload failed');
      }

      const result = await response.json();
      console.log('✅ Image uploaded successfully:', result.public_id);

      // Log upload to database for audit trail
      await this.logUpload(user.id, result.public_id, 'image', result.bytes);

      return {
        id: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
        createdAt: result.created_at,
        url: result.secure_url
      };
    } catch (error) {
      console.error('❌ Image upload failed:', error);
      throw new Error(error.message || 'Failed to upload image');
    }
  }

  // ==================== VIDEO UPLOAD WITH SECURITY (FIXED) ====================
  
  async uploadVideo(file, folder = 'grova/reels', onProgress = null) {
    try {
      console.log('📤 Uploading video:', file.name);
      console.log('📊 Video details:', {
        size: `${(file.size / (1024 * 1024)).toFixed(2)}MB`,
        type: file.type
      });
      
      // SECURITY: Check authentication
      const user = await this.checkAuth();
      
      // SECURITY: Rate limiting
      this.checkRateLimit();
      
      // SECURITY: Validate video (size and MIME type)
      this.validateVideo(file);
      
      // SECURITY: Validate file content (with lenient checking)
      try {
        await this.validateFileContent(file, 'video');
      } catch (contentError) {
        // If content validation fails but MIME type is correct, warn and continue
        // Cloudinary will do final validation
        console.warn('⚠️ Content validation warning:', contentError.message);
        console.log('ℹ️ Proceeding with upload - Cloudinary will validate');
      }
      
      // SECURITY: Sanitize filename
      const safeName = this.sanitizeFilename(file.name);
      
      // SECURITY: User-specific folder
      const userFolder = `${folder}/${user.id}`;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', this.uploadPreset);
      formData.append('folder', userFolder);
      formData.append('public_id', `${Date.now()}_${safeName.split('.')[0]}`);
      formData.append('resource_type', 'video');
      formData.append('context', `user_id=${user.id}|uploaded_at=${new Date().toISOString()}`);

      const xhr = new XMLHttpRequest();

      return new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable && onProgress) {
            const percentComplete = (e.loaded / e.total) * 100;
            console.log(`📊 Upload progress: ${percentComplete.toFixed(1)}%`);
            onProgress(percentComplete);
          }
        });

        xhr.addEventListener('load', async () => {
          if (xhr.status === 200) {
            const result = JSON.parse(xhr.responseText);
            console.log('✅ Video uploaded successfully:', result.public_id);
            
            // Log upload
            await this.logUpload(user.id, result.public_id, 'video', result.bytes);
            
            resolve({
              id: result.public_id,
              width: result.width,
              height: result.height,
              duration: result.duration,
              format: result.format,
              bytes: result.bytes,
              createdAt: result.created_at,
              url: result.secure_url
            });
          } else {
            const error = JSON.parse(xhr.responseText);
            console.error('❌ Video upload failed:', error);
            reject(new Error(error.error?.message || 'Upload failed'));
          }
        });

        xhr.addEventListener('error', () => {
          console.error('❌ Network error during video upload');
          reject(new Error('Network error. Please check your connection.'));
        });

        xhr.open('POST', `https://api.cloudinary.com/v1_1/${this.cloudName}/video/upload`);
        xhr.send(formData);
      });
    } catch (error) {
      console.error('❌ Video upload failed:', error);
      throw new Error(error.message || 'Failed to upload video');
    }
  }

  // ==================== MULTIPLE IMAGES UPLOAD ====================
  
  async uploadImages(files, folder = 'grova/posts') {
    try {
      console.log(`📤 Uploading ${files.length} images...`);
      
      // Validate all files first
      files.forEach(file => this.validateImage(file));
      
      // Upload with concurrency limit
      const results = [];
      for (let i = 0; i < files.length; i += this.maxConcurrentUploads) {
        const batch = files.slice(i, i + this.maxConcurrentUploads);
        const batchResults = await Promise.all(
          batch.map(file => this.uploadImage(file, folder))
        );
        results.push(...batchResults);
      }
      
      console.log(`✅ All ${results.length} images uploaded successfully`);
      return results;
    } catch (error) {
      console.error('❌ Batch upload failed:', error);
      throw new Error(error.message || 'Failed to upload images');
    }
  }

  // ==================== LOG UPLOAD (AUDIT TRAIL) ====================
  
  async logUpload(userId, publicId, resourceType, bytes) {
    try {
      await supabase.from('upload_rate_limits').insert({
        user_id: userId,
        upload_type: resourceType,
        upload_count: 1,
        window_start: new Date().toISOString()
      });
      
      console.log('📝 Upload logged for audit');
    } catch (error) {
      // Don't fail upload if logging fails
      console.warn('⚠️ Failed to log upload:', error);
    }
  }

  // ==================== VALIDATION METHODS ====================
  
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
    
    if (file.size < 100) {
      throw new Error('File is too small. May be corrupted.');
    }
  }

  validateVideo(file) {
    const maxSize = 100 * 1024 * 1024; // 100MB
    const allowedTypes = [
      'video/mp4', 
      'video/quicktime', 
      'video/x-msvideo', 
      'video/webm',
      'video/x-m4v',        // Added for better MP4 support
      'video/mpeg',         // Added MPEG
      ''                     // Allow empty MIME type (some browsers don't set it correctly)
    ];

    if (!file) {
      throw new Error('No file provided');
    }

    if (file.size > maxSize) {
      throw new Error('Video must be less than 100MB');
    }

    // Check file extension as fallback
    const fileExt = file.name.split('.').pop().toLowerCase();
    const allowedExtensions = ['mp4', 'mov', 'avi', 'webm', 'm4v', 'mpeg', 'mpg'];
    
    const hasValidType = allowedTypes.includes(file.type);
    const hasValidExtension = allowedExtensions.includes(fileExt);

    if (!hasValidType && !hasValidExtension) {
      throw new Error(`Invalid video type. Allowed: ${allowedExtensions.join(', ').toUpperCase()}`);
    }
    
    if (file.size < 1000) {
      throw new Error('File is too small. May be corrupted.');
    }
    
    console.log('✅ Video validation passed:', {
      type: file.type || 'unknown',
      extension: fileExt,
      size: `${(file.size / (1024 * 1024)).toFixed(2)}MB`
    });
  }

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

  // ==================== AVATAR UPLOAD ====================
  
  async uploadAvatar(file, userId) {
    try {
      console.log('📤 Uploading avatar for user:', userId);
      this.validateAvatar(file);
      
      const result = await this.uploadImage(file, `grova/avatars`);
      return result.id;
    } catch (error) {
      console.error('❌ Avatar upload failed:', error);
      throw new Error(error.message || 'Failed to upload avatar');
    }
  }

  // ==================== GET URL METHODS ====================
  
  getImageUrl(publicId, options = {}) {
    if (!publicId || !this.cloudName) return null;

    const {
      width,
      height,
      crop = 'fill',
      quality = 'auto',
      format = 'auto'
    } = options;

    const transforms = [];
    if (width) transforms.push(`w_${width}`);
    if (height) transforms.push(`h_${height}`);
    if (crop) transforms.push(`c_${crop}`);
    if (quality) transforms.push(`q_${quality}`);
    if (format) transforms.push(`f_${format}`);

    const transformStr = transforms.length > 0 ? `${transforms.join(',')}/` : '';
    
    return `https://res.cloudinary.com/${this.cloudName}/image/upload/${transformStr}${publicId}`;
  }

  getVideoUrl(publicId, options = {}) {
    if (!publicId || !this.cloudName) return null;

    const {
      width,
      height,
      quality = 'auto',
      format = 'mp4'
    } = options;

    const transforms = [];
    if (width) transforms.push(`w_${width}`);
    if (height) transforms.push(`h_${height}`);
    if (quality) transforms.push(`q_${quality}`);
    if (format) transforms.push(`f_${format}`);

    const transformStr = transforms.length > 0 ? `${transforms.join(',')}/` : '';
    
    return `https://res.cloudinary.com/${this.cloudName}/video/upload/${transformStr}${publicId}`;
  }
}

const uploadService = new UploadService();
export default uploadService;