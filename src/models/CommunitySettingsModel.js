// src/models/CommunitySettingsModel.js

class CommunitySettingsModel {
  constructor(data = {}) {
    // Security settings
    this.twoFactorAuth = data.two_factor_auth || data.twoFactorAuth || false;
    this.verificationLevel = data.verification_level || data.verificationLevel || 'medium';
    this.explicitContentFilter = data.explicit_content_filter || data.explicitContentFilter || 'all';
    
    // Notification settings
    this.defaultNotifications = data.default_notifications || data.defaultNotifications || 'mentions';
    this.pushNotifications = data.push_notifications || data.pushNotifications || true;
    this.emailNotifications = data.email_notifications || data.emailNotifications || false;
    
    // Privacy settings
    this.allowJoinRequests = data.allow_join_requests || data.allowJoinRequests || true;
    this.showMemberCount = data.show_member_count || data.showMemberCount || true;
    this.allowInvites = data.allow_invites || data.allowInvites || true;
    
    // Moderation settings
    this.autoModeration = data.auto_moderation || data.autoModeration || false;
    this.spamFilter = data.spam_filter || data.spamFilter || true;
    this.linkFilter = data.link_filter || data.linkFilter || false;
    this.slowMode = data.slow_mode || data.slowMode || 0; // seconds between messages
    
    // Feature settings
    this.allowReactions = data.allow_reactions || data.allowReactions || true;
    this.allowThreads = data.allow_threads || data.allowThreads || true;
    this.allowVoiceChannels = data.allow_voice_channels || data.allowVoiceChannels || true;
  }

  // Validation methods
  validateVerificationLevel(level) {
    const validLevels = ['none', 'low', 'medium', 'high'];
    return validLevels.includes(level);
  }

  validateNotificationSettings(setting) {
    const validSettings = ['all', 'mentions', 'none'];
    return validSettings.includes(setting);
  }

  validateContentFilter(filter) {
    const validFilters = ['none', 'some', 'all'];
    return validFilters.includes(filter);
  }

  // Convert to API format
  toJSON() {
    return {
      two_factor_auth: this.twoFactorAuth,
      verification_level: this.verificationLevel,
      explicit_content_filter: this.explicitContentFilter,
      default_notifications: this.defaultNotifications,
      push_notifications: this.pushNotifications,
      email_notifications: this.emailNotifications,
      allow_join_requests: this.allowJoinRequests,
      show_member_count: this.showMemberCount,
      allow_invites: this.allowInvites,
      auto_moderation: this.autoModeration,
      spam_filter: this.spamFilter,
      link_filter: this.linkFilter,
      slow_mode: this.slowMode,
      allow_reactions: this.allowReactions,
      allow_threads: this.allowThreads,
      allow_voice_channels: this.allowVoiceChannels
    };
  }

  // Create from API response
  static fromAPI(data) {
    return new CommunitySettingsModel(data);
  }
}

// src/services/community/settingsService.js
import { supabase } from '../config/supabase';
import CommunitySettingsModel from '../../models/CommunitySettingsModel';

class SettingsService {
  // Fetch community settings
  async fetchSettings(communityId) {
    try {
      const { data, error } = await supabase
        .from('communities')
        .select('settings')
        .eq('id', communityId)
        .single();

      if (error) throw error;
      return CommunitySettingsModel.fromAPI(data.settings || {});
    } catch (error) {
      console.error('Error fetching settings:', error);
      throw error;
    }
  }

  // Update community settings
  async updateSettings(communityId, userId, settings) {
    try {
      // Verify user has permission
      const hasPermission = await this.verifyPermission(communityId, userId, 'manageCommunity');
      if (!hasPermission) {
        throw new Error('Unauthorized: You do not have permission to modify settings');
      }

      const settingsModel = new CommunitySettingsModel(settings);
      
      const { data, error } = await supabase
        .from('communities')
        .update({ 
          settings: settingsModel.toJSON(),
          updated_at: new Date().toISOString()
        })
        .eq('id', communityId)
        .select('settings')
        .single();

      if (error) throw error;
      return CommunitySettingsModel.fromAPI(data.settings);
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  }

  // Update specific setting
  async updateSetting(communityId, userId, key, value) {
    try {
      const hasPermission = await this.verifyPermission(communityId, userId, 'manageCommunity');
      if (!hasPermission) {
        throw new Error('Unauthorized: You do not have permission to modify settings');
      }

      // Fetch current settings
      const { data: current, error: fetchError } = await supabase
        .from('communities')
        .select('settings')
        .eq('id', communityId)
        .single();

      if (fetchError) throw fetchError;

      const settings = current.settings || {};
      settings[key] = value;

      const { data, error } = await supabase
        .from('communities')
        .update({ 
          settings,
          updated_at: new Date().toISOString()
        })
        .eq('id', communityId)
        .select('settings')
        .single();

      if (error) throw error;
      return CommunitySettingsModel.fromAPI(data.settings);
    } catch (error) {
      console.error('Error updating setting:', error);
      throw error;
    }
  }

  // Verify user permission
  async verifyPermission(communityId, userId, permission) {
    try {
      // Check if owner
      const { data: community } = await supabase
        .from('communities')
        .select('owner_id')
        .eq('id', communityId)
        .single();

      if (community?.owner_id === userId) return true;

      // Check role permissions
      const { data: member } = await supabase
        .from('community_members')
        .select(`
          role:community_roles!role_id(permissions)
        `)
        .eq('community_id', communityId)
        .eq('user_id', userId)
        .single();

      return member?.role?.permissions?.[permission] === true;
    } catch (error) {
      console.error('Error verifying permission:', error);
      return false;
    }
  }

  // Reset settings to default
  async resetSettings(communityId, userId) {
    try {
      const hasPermission = await this.verifyPermission(communityId, userId, 'manageCommunity');
      if (!hasPermission) {
        throw new Error('Unauthorized: You do not have permission to reset settings');
      }

      const defaultSettings = new CommunitySettingsModel({});

      const { data, error } = await supabase
        .from('communities')
        .update({ 
          settings: defaultSettings.toJSON(),
          updated_at: new Date().toISOString()
        })
        .eq('id', communityId)
        .select('settings')
        .single();

      if (error) throw error;
      return CommunitySettingsModel.fromAPI(data.settings);
    } catch (error) {
      console.error('Error resetting settings:', error);
      throw error;
    }
  }

  // Get setting by key
  async getSetting(communityId, key) {
    try {
      const { data, error } = await supabase
        .from('communities')
        .select('settings')
        .eq('id', communityId)
        .single();

      if (error) throw error;
      return data.settings?.[key];
    } catch (error) {
      console.error('Error getting setting:', error);
      return null;
    }
  }

  // Bulk update settings
  async bulkUpdateSettings(communityId, userId, updates) {
    try {
      const hasPermission = await this.verifyPermission(communityId, userId, 'manageCommunity');
      if (!hasPermission) {
        throw new Error('Unauthorized: You do not have permission to modify settings');
      }

      const { data: current, error: fetchError } = await supabase
        .from('communities')
        .select('settings')
        .eq('id', communityId)
        .single();

      if (fetchError) throw fetchError;

      const settings = { ...(current.settings || {}), ...updates };

      const { data, error } = await supabase
        .from('communities')
        .update({ 
          settings,
          updated_at: new Date().toISOString()
        })
        .eq('id', communityId)
        .select('settings')
        .single();

      if (error) throw error;
      return CommunitySettingsModel.fromAPI(data.settings);
    } catch (error) {
      console.error('Error bulk updating settings:', error);
      throw error;
    }
  }
}

export default new SettingsService();
export { CommunitySettingsModel };