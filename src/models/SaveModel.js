// ============================================================================
// src/models/SaveModel.js - UNIFIED SAVE/BOOKMARK SYSTEM
// ============================================================================

import { supabase } from '../services/config/supabase';
import { handleError } from '../services/shared/errorHandler';

class SaveModel {
  
  async saveContent(contentType, contentId, userId, folder = 'Favorites') {
    try {
      if (!userId) {
        throw new Error('User must be logged in to save');
      }

      // Check if already saved
      const { data: existing } = await supabase
        .from('saved_content')
        .select('id')
        .eq('content_type', contentType)
        .eq('content_id', contentId)
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        // Already saved - unsave
        await supabase
          .from('saved_content')
          .delete()
          .eq('id', existing.id);

        return { saved: false, success: true };
      }

      // Save new
      const { error } = await supabase
        .from('saved_content')
        .insert({
          content_type: contentType,
          content_id: contentId,
          user_id: userId,
          folder: folder,
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      return { saved: true, success: true };

    } catch (error) {
      throw handleError(error, 'Save failed');
    }
  }

  async getSavedContent(userId, contentType = null, folder = null) {
    try {
      let query = supabase
        .from('saved_content')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (contentType) {
        query = query.eq('content_type', contentType);
      }

      if (folder) {
        query = query.eq('folder', folder);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data || [];

    } catch (error) {
      throw handleError(error, 'Get saved content failed');
    }
  }

  async getFolders(userId) {
    try {
      const { data, error } = await supabase
        .from('saved_content')
        .select('folder')
        .eq('user_id', userId);

      if (error) throw error;

      const folders = [...new Set(data?.map(item => item.folder))];
      return folders.length > 0 ? folders : ['Favorites'];

    } catch (error) {
      return ['Favorites'];
    }
  }

  async checkIfSaved(contentType, contentId, userId) {
    try {
      if (!userId) return false;

      const { data } = await supabase
        .from('saved_content')
        .select('id')
        .eq('content_type', contentType)
        .eq('content_id', contentId)
        .eq('user_id', userId)
        .maybeSingle();

      return !!data;

    } catch (error) {
      return false;
    }
  }
}

const saveModel = new SaveModel(); 

export default saveModel;