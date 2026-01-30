// ============================================================================
// src/services/media/videoEditorService.js
// Advanced video editing with templates, merging, and conversion
// ============================================================================

class VideoEditorService {
  constructor() {
    this.cloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
    this.uploadPreset = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;
  }

  // ==================== VIDEO TEMPLATES ====================

  templates = {
    memories: {
      name: "Memories Slideshow",
      transitions: ["fade", "slide"],
      duration: 3, // seconds per image
      music: true,
      effects: ["ken-burns", "fade"],
    },
    comparison: {
      name: "Side by Side",
      layout: "split",
      transitions: ["wipe"],
      duration: 5,
    },
    collage: {
      name: "Photo Collage",
      layout: "grid",
      maxItems: 9,
      duration: 2,
    },
    story: {
      name: "Story Format",
      aspect: "9:16",
      transitions: ["dissolve"],
      duration: 4,
    },
    cinematic: {
      name: "Cinematic",
      effects: ["blur-edges", "color-grade"],
      transitions: ["fade", "zoom"],
      duration: 5,
    },
  };

  // ==================== IMAGES TO VIDEO ====================

  async createVideoFromImages(images, options = {}) {
    try {
      const {
        template = "memories",
        duration = 3,
        transitions = ["fade"],
        music = null,
        aspectRatio = "16:9",
        quality = "auto",
      } = options;

      console.log(`🎬 Creating video from ${images.length} images`);

      // Upload images to Cloudinary if not already
      const uploadedImages = await this.uploadMultipleImages(images);

      // Build video transformation
      const videoParams = this.buildVideoFromImagesParams(
        uploadedImages,
        template,
        duration,
        transitions,
        aspectRatio,
      );

      // Generate video using Cloudinary
      const videoUrl = await this.generateCloudinaryVideo(videoParams);

      return {
        url: videoUrl,
        duration: images.length * duration,
        template: template,
        imageCount: images.length,
      };
    } catch (error) {
      console.error("❌ Failed to create video from images:", error);
      throw error;
    }
  }

  // ==================== MERGE VIDEOS ====================

  async mergeVideos(videos, options = {}) {
    try {
      const {
        transitions = ["fade"],
        trimStart = [],
        trimEnd = [],
        aspectRatio = "16:9",
        quality = "auto",
      } = options;

      console.log(`🎬 Merging ${videos.length} videos`);

      const videoData = await Promise.all(
        videos.map(async (video, index) => {
          const uploaded = await this.uploadVideo(video);
          return {
            publicId: uploaded.public_id,
            duration: uploaded.duration,
            trimStart: trimStart[index] || 0,
            trimEnd: trimEnd[index] || uploaded.duration,
          };
        }),
      );

      const mergedUrl = await this.concatenateVideos(
        videoData,
        transitions,
        aspectRatio,
        quality,
      );

      const totalDuration = videoData.reduce((sum, v) => {
        return sum + (v.trimEnd - v.trimStart);
      }, 0);

      return {
        url: mergedUrl,
        duration: totalDuration,
        videoCount: videos.length,
      };
    } catch (error) {
      console.error("❌ Failed to merge videos:", error);
      throw error;
    }
  }

  // ==================== MIX IMAGES AND VIDEOS ====================

  async createMixedMedia(items, options = {}) {
    try {
      console.log(`🎨 Creating mixed media from ${items.length} items`);

      const processedItems = [];

      for (const item of items) {
        if (item.type === "image") {
          // Convert image to short video clip
          const videoClip = await this.imageToVideoClip(
            item.file,
            options.imageDuration || 3,
          );
          processedItems.push(videoClip);
        } else if (item.type === "video") {
          const uploaded = await this.uploadVideo(item.file);
          processedItems.push({
            publicId: uploaded.public_id,
            duration: uploaded.duration,
          });
        }
      }

      // Merge all clips
      const finalVideo = await this.concatenateVideos(
        processedItems,
        options.transitions || ["fade"],
        options.aspectRatio || "16:9",
        options.quality || "auto",
      );

      return finalVideo;
    } catch (error) {
      console.error("❌ Failed to create mixed media:", error);
      throw error;
    }
  }

  // ==================== VIDEO PREVIEW GENERATION ====================

  async generateVideoPreview(videoFile) {
    try {
      const objectUrl = URL.createObjectURL(videoFile);

      // Create video element
      const video = document.createElement("video");
      video.src = objectUrl;
      video.muted = true;

      return new Promise((resolve, reject) => {
        video.onloadedmetadata = () => {
          const duration = video.duration;

          // Capture thumbnail at 1 second or midpoint
          video.currentTime = Math.min(1, duration / 2);

          video.onseeked = () => {
            const canvas = document.createElement("canvas");
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            const ctx = canvas.getContext("2d");
            ctx.drawImage(video, 0, 0);

            canvas.toBlob(
              (blob) => {
                URL.revokeObjectURL(objectUrl);
                resolve({
                  thumbnail: blob,
                  duration: duration,
                  width: video.videoWidth,
                  height: video.videoHeight,
                  objectUrl: objectUrl,
                });
              },
              "image/jpeg",
              0.8,
            );
          };
        };

        video.onerror = (error) => {
          URL.revokeObjectURL(objectUrl);
          reject(error);
        };
      });
    } catch (error) {
      console.error("❌ Failed to generate video preview:", error);
      throw error;
    }
  }

  // ==================== VIDEO TRIMMING ====================

  async trimVideo(videoFile, startTime, endTime) {
    try {
      const uploaded = await this.uploadVideo(videoFile);

      const trimmedUrl = `https://res.cloudinary.com/${this.cloudName}/video/upload/so_${startTime},eo_${endTime}/${uploaded.public_id}.mp4`;

      return {
        url: trimmedUrl,
        publicId: uploaded.public_id,
        duration: endTime - startTime,
      };
    } catch (error) {
      console.error("❌ Failed to trim video:", error);
      throw error;
    }
  }

  // ==================== HELPER METHODS ====================

  async uploadVideo(videoFile) {
    const formData = new FormData();
    formData.append("file", videoFile);
    formData.append("upload_preset", this.uploadPreset);
    formData.append("resource_type", "video");

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${this.cloudName}/video/upload`,
      {
        method: "POST",
        body: formData,
      },
    );

    if (!response.ok) {
      throw new Error(`Video upload failed: ${response.statusText}`);
    }

    return await response.json();
  }

  async uploadMultipleImages(images) {
    return await Promise.all(images.map((img) => this.uploadImage(img)));
  }

  async uploadImage(imageFile) {
    const formData = new FormData();
    formData.append("file", imageFile);
    formData.append("upload_preset", this.uploadPreset);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`,
      {
        method: "POST",
        body: formData,
      },
    );

    if (!response.ok) {
      throw new Error(`Image upload failed: ${response.statusText}`);
    }

    return await response.json();
  }

  async imageToVideoClip(imageFile, duration = 3) {
    const uploaded = await this.uploadImage(imageFile);

    // Cloudinary can convert image to video with effects
    return {
      publicId: uploaded.public_id,
      duration: duration,
      isImage: true,
    };
  }

  buildVideoFromImagesParams(
    images,
    template,
    duration,
    transitions,
    aspectRatio,
  ) {
    const templateConfig = this.templates[template] || this.templates.memories;

    return {
      images: images.map((img) => img.public_id),
      duration: duration,
      transitions: transitions,
      effects: templateConfig.effects || [],
      aspectRatio: aspectRatio,
    };
  }

  async generateCloudinaryVideo(params) {
    // Use Cloudinary's video creation API
    const baseUrl = `https://res.cloudinary.com/${this.cloudName}/video/upload`;

    // Build transformation string
    let transformation = `w_1280,h_720,c_fill,ar_${params.aspectRatio.replace(":", "_")}`;

    if (params.effects.includes("ken-burns")) {
      transformation += "/e_zoompan";
    }

    // This is simplified - actual implementation would use Cloudinary's SDK
    // For production, use their video stitching API

    return `${baseUrl}/${transformation}/video_from_images.mp4`;
  }

  async concatenateVideos(videos, transitions, aspectRatio, quality) {
    // Use Cloudinary's concatenation feature
    const baseUrl = `https://res.cloudinary.com/${this.cloudName}/video/upload`;

    // Build overlay chain
    let transformation = `w_1280,h_720,c_fill,ar_${aspectRatio.replace(":", "_")},q_${quality}`;

    // Add each video as overlay with transition
    videos.forEach((video, index) => {
      if (index > 0) {
        transformation += `/l_video:${video.publicId},so_${video.trimStart},eo_${video.trimEnd},e_transition`;
      }
    });

    return `${baseUrl}/${transformation}/${videos[0].publicId}.mp4`;
  }

  // ==================== VIDEO EFFECTS ====================

  applyEffect(videoUrl, effect) {
    const effects = {
      "blur-background": "e_blur_region:1000,g_faces",
      "black-white": "e_grayscale",
      sepia: "e_sepia",
      vignette: "e_vignette",
      saturation: "e_saturation:50",
      brightness: "e_brightness:20",
      "slow-motion": "e_accelerate:-50",
      "fast-forward": "e_accelerate:100",
      reverse: "e_reverse",
      boomerang: "e_loop:3,e_reverse",
    };

    const transformation = effects[effect] || "";
    return videoUrl.replace("/upload/", `/upload/${transformation}/`);
  }

  // ==================== ASPECT RATIO CONVERSION ====================

  convertAspectRatio(videoUrl, targetRatio) {
    const ratios = {
      "16:9": "ar_16:9,c_fill",
      "9:16": "ar_9:16,c_fill", // Stories/Reels
      "1:1": "ar_1:1,c_fill", // Square
      "4:5": "ar_4:5,c_fill", // Instagram portrait
      "4:3": "ar_4:3,c_fill",
    };

    const transformation = ratios[targetRatio] || ratios["16:9"];
    return videoUrl.replace("/upload/", `/upload/${transformation}/`);
  }

  // ==================== VIDEO FORMAT CONVERSION ====================

  convertFormat(videoUrl, format) {
    // Supported formats: mp4, webm, mov, avi, flv, mkv
    const validFormats = ["mp4", "webm", "mov", "avi", "flv", "mkv"];

    if (!validFormats.includes(format.toLowerCase())) {
      console.warn(`Invalid format: ${format}. Defaulting to mp4`);
      format = "mp4";
    }

    return videoUrl.replace(/\.[^.]+$/, `.${format}`);
  }

  // ==================== GET VIDEO INFO ====================

  getVideoInfo(videoUrl) {
    // Extract public_id and transformations from Cloudinary URL
    const urlParts = videoUrl.split("/");
    const uploadIndex = urlParts.indexOf("upload");

    if (uploadIndex === -1) {
      return null;
    }

    const publicIdWithExt = urlParts[urlParts.length - 1];
    const publicId = publicIdWithExt.replace(/\.[^.]+$/, "");
    const transformations = urlParts.slice(uploadIndex + 1, -1).join("/");

    return {
      publicId,
      transformations,
      cloudName: this.cloudName,
    };
  }

  // ==================== QUALITY PRESETS ====================

  applyQualityPreset(videoUrl, preset) {
    const presets = {
      low: "q_auto:low,w_480",
      medium: "q_auto:good,w_720",
      high: "q_auto:best,w_1080",
      "ultra-hd": "q_auto:best,w_1920",
    };

    const transformation = presets[preset] || presets.medium;
    return videoUrl.replace("/upload/", `/upload/${transformation}/`);
  }
}

// Create and export a single instance
const videoEditorService = new VideoEditorService();
export default videoEditorService;
