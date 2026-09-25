// src/services/config/cloudflare.js

// Cloudflare Stream Configuration
export const CLOUDFLARE_STREAM = {
  ACCOUNT_ID: process.env.REACT_APP_CLOUDFLARE_ACCOUNT_ID || "",
  DELIVERY_URL: `https://customer-${process.env.REACT_APP_CLOUDFLARE_ACCOUNT_ID}.cloudflarestream.com`,
};

// Cloudflare Images Configuration
export const CLOUDFLARE_IMAGES = {
  ACCOUNT_ID: process.env.REACT_APP_CLOUDFLARE_IMAGES_ACCOUNT_ID || "",
  DELIVERY_HASH: process.env.REACT_APP_CLOUDFLARE_IMAGES_HASH,
  DELIVERY_URL: `https://imagedelivery.net/${process.env.REACT_APP_CLOUDFLARE_IMAGES_ACCOUNT_ID}`,
};

// Public delivery URL helpers only. Cloudflare management tokens must stay server-side.
export const streamClient = {
  getPlaybackUrl: (videoId) => `${CLOUDFLARE_STREAM.DELIVERY_URL}/${encodeURIComponent(videoId)}/manifest/video.m3u8`,
  getThumbnailUrl: (videoId, options = {}) => {
    const { time = "0s", width = 640, height = 360, fit = "crop" } = options;
    const params = new URLSearchParams({ time, width: String(width), height: String(height), fit });
    return `${CLOUDFLARE_STREAM.DELIVERY_URL}/${encodeURIComponent(videoId)}/thumbnails/thumbnail.jpg?${params}`;
  },
};

export const imagesClient = {
  getDeliveryUrl: (imageId, variant = "public") => `${CLOUDFLARE_IMAGES.DELIVERY_URL}/${encodeURIComponent(imageId)}/${encodeURIComponent(variant)}`,
  getOptimizedUrl: (imageId, options = {}) => {
    const { width, height, fit = "cover", quality = 85, format = "auto" } = options;
    const url = imagesClient.getDeliveryUrl(imageId);
    if (!width && !height) return url;
    const params = new URLSearchParams();
    if (width) params.append("width", String(width));
    if (height) params.append("height", String(height));
    params.append("fit", fit);
    params.append("quality", String(quality));
    params.append("format", format);
    return `${url}?${params.toString()}`;
  },
};