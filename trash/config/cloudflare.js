// src/services/config/cloudflare.js

// Cloudflare Stream Configuration
export const CLOUDFLARE_STREAM = {
  ACCOUNT_ID: process.env.REACT_APP_CLOUDFLARE_ACCOUNT_ID,
  API_TOKEN: process.env.REACT_APP_CLOUDFLARE_STREAM_TOKEN,
  BASE_URL: `https://api.cloudflare.com/client/v4/accounts/${process.env.REACT_APP_CLOUDFLARE_ACCOUNT_ID}/stream`
};

// Cloudflare Images Configuration
export const CLOUDFLARE_IMAGES = {
  ACCOUNT_ID: process.env.REACT_APP_CLOUDFLARE_IMAGES_ACCOUNT_ID,
  API_TOKEN: process.env.REACT_APP_CLOUDFLARE_IMAGES_TOKEN,
  DELIVERY_HASH: process.env.REACT_APP_CLOUDFLARE_IMAGES_HASH,
  UPLOAD_URL: `https://api.cloudflare.com/client/v4/accounts/${process.env.REACT_APP_CLOUDFLARE_IMAGES_ACCOUNT_ID}/images/v1`,
  DELIVERY_URL: `https://imagedelivery.net/${process.env.REACT_APP_CLOUDFLARE_IMAGES_ACCOUNT_ID}`
};

// Cloudflare Stream Client
export class CloudflareStreamClient {
  constructor() {
    this.accountId = CLOUDFLARE_STREAM.ACCOUNT_ID;
    this.apiToken = CLOUDFLARE_STREAM.API_TOKEN;
    this.baseUrl = CLOUDFLARE_STREAM.BASE_URL;
  }

  // Get headers for API requests
  getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiToken}`,
      'Content-Type': 'application/json'
    };
  }

  // Upload video via TUS protocol
  async initiateUpload(fileSize, fileName) {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Tus-Resumable': '1.0.0',
        'Upload-Length': fileSize.toString(),
        'Upload-Metadata': `name ${btoa(fileName)}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to initiate upload');
    }

    const uploadUrl = response.headers.get('Location');
    return uploadUrl;
  }

  // Upload video chunks
  async uploadChunk(uploadUrl, chunk, offset) {
    const response = await fetch(uploadUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Tus-Resumable': '1.0.0',
        'Upload-Offset': offset.toString(),
        'Content-Type': 'application/offset+octet-stream'
      },
      body: chunk
    });

    if (!response.ok) {
      throw new Error('Failed to upload chunk');
    }

    return response;
  }

  // Get video details
  async getVideoDetails(videoId) {
    const response = await fetch(`${this.baseUrl}/${videoId}`, {
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to get video details');
    }

    return await response.json();
  }

  // Delete video
  async deleteVideo(videoId) {
    const response = await fetch(`${this.baseUrl}/${videoId}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });

    return response.ok;
  }

  // Get HLS playback URL
  getPlaybackUrl(videoId) {
    return `https://customer-${this.accountId}.cloudflarestream.com/${videoId}/manifest/video.m3u8`;
  }

  // Get thumbnail URL
  getThumbnailUrl(videoId, options = {}) {
    const {
      time = '0s',
      width = 640,
      height = 360,
      fit = 'crop'
    } = options;

    return `https://customer-${this.accountId}.cloudflarestream.com/${videoId}/thumbnails/thumbnail.jpg?time=${time}&width=${width}&height=${height}&fit=${fit}`;
  }
}

// Cloudflare Images Client
export class CloudflareImagesClient {
  constructor() {
    this.accountId = CLOUDFLARE_IMAGES.ACCOUNT_ID;
    this.apiToken = CLOUDFLARE_IMAGES.API_TOKEN;
    this.uploadUrl = CLOUDFLARE_IMAGES.UPLOAD_URL;
    this.deliveryUrl = CLOUDFLARE_IMAGES.DELIVERY_URL;
  }

  // Upload image
  async uploadImage(file) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(this.uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error('Failed to upload image');
    }

    const data = await response.json();
    return data.result.id; // Return only the image ID
  }

  // Upload multiple images
  async uploadImages(files) {
    const uploadPromises = files.map(file => this.uploadImage(file));
    return await Promise.all(uploadPromises);
  }

  // Delete image
  async deleteImage(imageId) {
    const response = await fetch(`${this.uploadUrl}/${imageId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`
      }
    });

    return response.ok;
  }

  // Get delivery URL
  getDeliveryUrl(imageId, variant = 'public') {
    return `${this.deliveryUrl}/${imageId}/${variant}`;
  }

  // Get delivery URL with transformations
  getOptimizedUrl(imageId, options = {}) {
    const {
      width,
      height,
      fit = 'cover',
      quality = 85,
      format = 'auto'
    } = options;

    let url = this.getDeliveryUrl(imageId, 'public');
    
    if (width || height) {
      const params = new URLSearchParams();
      if (width) params.append('width', width);
      if (height) params.append('height', height);
      params.append('fit', fit);
      params.append('quality', quality);
      params.append('format', format);
      
      url += `?${params.toString()}`;
    }

    return url;
  }
}

// Export singleton instances
export const streamClient = new CloudflareStreamClient();
export const imagesClient = new CloudflareImagesClient();