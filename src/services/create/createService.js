// ============================================================================
// src/services/create/createService.js - FIXED WITH PROPER IMAGE HANDLING
// ============================================================================

import { supabase } from '../config/supabase';
import uploadService from '../upload/uploadService';
import { handleError } from '../shared/errorHandler';
import cacheService from '../shared/cacheService';

class CreateService {

  // ==================== POST CREATION ====================
  
  async createPost(postData, userId) {
    try {
      console.log('📝 Creating post...', postData);
      const { content, images, category } = postData;

      if (!content && (!images || images.length === 0)) {
        throw new Error('Post must have content or images');
      }

      let imageIds = [];
      let imageMetadata = [];

      // Upload images if provided
      if (images && images.length > 0) {
        console.log(`⬆️ Uploading ${images.length} images...`);
        
        const uploadResults = await uploadService.uploadImages(images, 'grova/posts');
        console.log('✅ Upload results:', uploadResults);

        imageIds = uploadResults.map(result => result.id);
        imageMetadata = uploadResults.map(result => ({
          id: result.id,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes,
          url: result.url
        }));

        console.log('📊 Image IDs:', imageIds);
        console.log('📊 Image Metadata:', imageMetadata);
      }

      console.log('💾 Inserting post to database...');
      
      const { data, error } = await supabase
        .from('posts')
        .insert({
          user_id: userId,
          content: content || null,
          image_ids: imageIds,
          image_metadata: imageMetadata,
          category: category || 'General',
          likes: 0,
          comments_count: 0,
          shares: 0,
          views: 0
        })
        .select(`
          *,
          profiles:user_id (
            full_name,
            username,
            avatar_id,
            verified
          )
        `)
        .single();

      if (error) {
        console.error('❌ Post insert error:', error);
        throw error;
      }

      console.log('✅ Post created successfully:', data);

      // Invalidate cache
      cacheService.invalidate('posts');

      return data;

    } catch (error) {
      console.error('❌ Create post error:', error);
      throw handleError(error, 'Failed to create post');
    }
  }

  // ==================== REEL CREATION ====================
  
  async createReel(reelData, userId, onProgress) {
    try {
      console.log('🎬 Creating reel...');
      const { video, thumbnail, caption, music, category } = reelData;

      if (!video) {
        throw new Error('Video is required');
      }

      console.log('⬆️ Uploading video to Cloudinary...');
      
      const videoResult = await uploadService.uploadVideo(
        video,
        'grova/reels',
        onProgress
      );

      console.log('✅ Video uploaded:', videoResult.id);

      let thumbnailId = null;
      if (thumbnail) {
        console.log('⬆️ Uploading thumbnail...');
        const thumbResult = await uploadService.uploadImage(
          thumbnail,
          'grova/reels/thumbnails'
        );
        thumbnailId = thumbResult.id;
        console.log('✅ Thumbnail uploaded:', thumbnailId);
      }

      console.log('💾 Inserting reel to database...');
      
      const { data, error } = await supabase
        .from('reels')
        .insert({
          user_id: userId,
          video_id: videoResult.id,
          video_metadata: {
            width: videoResult.width,
            height: videoResult.height,
            duration: videoResult.duration,
            format: videoResult.format,
            bytes: videoResult.bytes,
            url: videoResult.url
          },
          thumbnail_id: thumbnailId,
          caption: caption || null,
          music: music || null,
          category: category || 'Entertainment',
          duration: videoResult.duration ? Math.round(videoResult.duration) : null,
          likes: 0,
          comments_count: 0,
          shares: 0,
          views: 0
        })
        .select(`
          *,
          profiles:user_id (
            full_name,
            username,
            avatar_id,
            verified
          )
        `)
        .single();

      if (error) {
        console.error('❌ Reel insert error:', error);
        throw error;
      }

      cacheService.invalidate('reels');
      console.log('✅ Reel created successfully:', data.id);

      return data;

    } catch (error) {
      console.error('❌ Create reel error:', error);
      throw handleError(error, 'Failed to create reel');
    }
  }

  // ==================== STORY CREATION ====================
  
  async createStory(storyData, userId) {
    try {
      console.log('📖 Creating story...');
      const {
        title,
        preview,
        fullContent,
        coverImage,
        category,
        unlockCost,
        maxAccesses
      } = storyData;

      if (!title || title.trim().length < 3) {
        throw new Error('Title must be at least 3 characters');
      }

      if (!preview || preview.trim().length < 10) {
        throw new Error('Preview must be at least 10 characters');
      }

      if (!fullContent || fullContent.trim().length === 0) {
        throw new Error('Story content is required');
      }

      let coverImageId = null;
      let coverImageMetadata = null;

      if (coverImage) {
        console.log('⬆️ Uploading cover image...');
        const imageResult = await uploadService.uploadImage(
          coverImage,
          'grova/stories'
        );

        coverImageId = imageResult.id;
        coverImageMetadata = {
          width: imageResult.width,
          height: imageResult.height,
          format: imageResult.format,
          bytes: imageResult.bytes,
          url: imageResult.url
        };
        console.log('✅ Cover uploaded:', coverImageId);
      }

      console.log('💾 Inserting story to database...');
      
      const { data, error } = await supabase
        .from('stories')
        .insert({
          user_id: userId,
          title: title.trim(),
          preview: preview.trim(),
          full_content: fullContent.trim(),
          cover_image_id: coverImageId,
          cover_image_metadata: coverImageMetadata,
          category: category || 'Folklore',
          unlock_cost: unlockCost || 0,
          max_accesses: maxAccesses || 1000,
          current_accesses: 0,
          likes: 0,
          comments_count: 0,
          shares: 0,
          views: 0
        })
        .select(`
          *,
          profiles:user_id (
            full_name,
            username,
            avatar_id,
            verified
          )
        `)
        .single();

      if (error) {
        console.error('❌ Story insert error:', error);
        throw error;
      }

      cacheService.invalidate('stories');
      console.log('✅ Story created successfully:', data.id);

      return data;

    } catch (error) {
      console.error('❌ Create story error:', error);
      throw handleError(error, 'Failed to create story');
    }
  }
}

const createService = new CreateService(); 

export default createService;