// ============================================================================
// src/models/ShareModel.js - UNIFIED SHARE SYSTEM
// ============================================================================

import { supabase } from '../services/config/supabase';
import { handleError } from '../services/shared/errorHandler';

class ShareModel {
  
  async shareContent(contentType, contentId, userId, shareType = 'profile') {
    try {
      if (!userId) {
        throw new Error('User must be logged in to share');
      }

      // Record share
      const { error } = await supabase
        .from('shares')
        .insert({
          content_type: contentType,
          content_id: contentId,
          user_id: userId,
          share_type: shareType,
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      // Increment share count
      await this.incrementShareCount(contentType, contentId);

      console.log('✅ Content shared');
      
      return { success: true };

    } catch (error) {
      throw handleError(error, 'Share failed');
    }
  }

  async incrementShareCount(contentType, contentId) {
    try {
      const table = this.getContentTable(contentType);
      
      const { data: current } = await supabase
        .from(table)
        .select('shares')
        .eq('id', contentId)
        .single();

      const newCount = (current?.shares || 0) + 1;

      await supabase
        .from(table)
        .update({ shares: newCount })
        .eq('id', contentId);

    } catch (error) {
      console.error('Failed to increment share count:', error);
    }
  }

  async getShareCount(contentType, contentId) {
    try {
      const table = this.getContentTable(contentType);
      
      const { data } = await supabase
        .from(table)
        .select('shares')
        .eq('id', contentId)
        .single();

      return data?.shares || 0;

    } catch (error) {
      return 0;
    }
  }

  getContentTable(contentType) {
    const tables = {
      post: 'posts',
      reel: 'reels',
      story: 'stories'
    };
    return tables[contentType] || 'posts';
  }
}

const shareModel = new ShareModel(); 

export default shareModel;