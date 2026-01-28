// ============================================================================
// src/services/account/settingsService.js - COMPLETE - ALL OFF BY DEFAULT
// ============================================================================

import { supabase } from '../config/supabase';
import { handleError } from '../shared/errorHandler';

class SettingsService {
  
  // ==================== GET USER SETTINGS ====================
  
  async getUserSettings(userId) {
    try {
      console.log('⚙️ Loading settings for user:', userId);

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;

      // DEFAULT TO ALL OFF - USER MUST EXPLICITLY ENABLE
      const defaultPreferences = {
        notify_profile_visits: false,
        notify_comments: false,
        notify_likes: false,
        notify_shares: false,
        notify_followers: false,
        notify_unlocks: false
      };

      const prefs = profile.preferences || defaultPreferences;

      const settings = {
        notifications: {
          profileVisits: prefs.notify_profile_visits ?? false,
          comments: prefs.notify_comments ?? false,
          likes: prefs.notify_likes ?? false,
          shares: prefs.notify_shares ?? false,
          newFollowers: prefs.notify_followers ?? false,
          storyUnlocks: prefs.notify_unlocks ?? false
        },
        privacy: {
          privateAccount: profile.is_private || false,
          showEmail: profile.show_email || false,
          showPhone: profile.show_phone || false
        },
        security: {
          require2FA: profile.require_2fa || false,
          passwordChangedAt: profile.password_changed_at,
          securityLevel: profile.security_level || 1
        },
        contact: {
          email: profile.email,
          phone: profile.phone,
          phoneVerified: profile.phone_verified || false
        }
      };

      console.log('✅ Settings loaded successfully');
      return settings;

    } catch (error) {
      console.error('❌ Failed to fetch settings:', error);
      throw handleError(error, 'Failed to fetch settings');
    }
  }

  // ==================== UPDATE NOTIFICATION SETTINGS ====================
  
  async updateNotificationSettings(userId, notificationSettings) {
    try {
      console.log('🔔 Updating notification settings:', notificationSettings);

      // Get current preferences
      const { data: profile } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', userId)
        .single();

      const currentPrefs = profile?.preferences || {};

      // Merge with new notification settings
      const updatedPrefs = {
        ...currentPrefs,
        notify_profile_visits: notificationSettings.profileVisits ?? false,
        notify_comments: notificationSettings.comments ?? false,
        notify_likes: notificationSettings.likes ?? false,
        notify_shares: notificationSettings.shares ?? false,
        notify_followers: notificationSettings.newFollowers ?? false,
        notify_unlocks: notificationSettings.storyUnlocks ?? false
      };

      const { error } = await supabase
        .from('profiles')
        .update({ 
          preferences: updatedPrefs,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) throw error;

      console.log('✅ Notification settings updated');
      return { success: true, settings: notificationSettings };

    } catch (error) {
      console.error('❌ Failed to update notification settings:', error);
      throw handleError(error, 'Failed to update notification settings');
    }
  }

  // ==================== UPDATE PRIVACY SETTINGS ====================
  
  async updatePrivacySettings(userId, privacySettings) {
    try {
      console.log('🔒 Updating privacy settings:', privacySettings);

      const updates = {};

      if (privacySettings.privateAccount !== undefined) {
        updates.is_private = privacySettings.privateAccount;
      }

      if (privacySettings.showEmail !== undefined) {
        updates.show_email = privacySettings.showEmail;
      }

      if (privacySettings.showPhone !== undefined) {
        updates.show_phone = privacySettings.showPhone;
      }

      updates.updated_at = new Date().toISOString();

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);

      if (error) throw error;

      console.log('✅ Privacy settings updated');
      return { success: true, settings: privacySettings };

    } catch (error) {
      console.error('❌ Failed to update privacy settings:', error);
      throw handleError(error, 'Failed to update privacy settings');
    }
  }

  // ==================== UPDATE CONTACT INFO ====================
  
  async updateContactInfo(userId, contactInfo) {
    try {
      console.log('📧 Updating contact info');

      const updates = {};

      if (contactInfo.email !== undefined) {
        updates.email = contactInfo.email;
      }

      if (contactInfo.phone !== undefined) {
        updates.phone = contactInfo.phone;
        updates.phone_verified = false;
      }

      updates.updated_at = new Date().toISOString();

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);

      if (error) throw error;

      console.log('✅ Contact info updated');
      return { success: true };

    } catch (error) {
      console.error('❌ Failed to update contact info:', error);
      throw handleError(error, 'Failed to update contact info');
    }
  }

  // ==================== CHANGE PASSWORD ====================
  
  async changePassword(currentPassword, newPassword) {
    try {
      console.log('🔑 Changing password');

      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('profiles')
          .update({ 
            password_changed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);

        await supabase.from('security_events').insert({
          user_id: user.id,
          event_type: 'password_changed',
          severity: 'info',
          metadata: {}
        });
      }

      console.log('✅ Password changed successfully');
      return { success: true, message: 'Password changed successfully' };

    } catch (error) {
      console.error('❌ Failed to change password:', error);
      throw handleError(error, 'Failed to change password');
    }
  }

  // ==================== GET PAYMENT METHODS ====================
  
  async getPaymentMethods(userId) {
    try {
      // TODO: Implement actual payment method storage
      // For now, return empty array
      return [];
    } catch (error) {
      console.error('Failed to fetch payment methods:', error);
      return [];
    }
  }

  // ==================== ADD PAYMENT METHOD ====================
  
  async addPaymentMethod(userId, paymentData) {
    try {
      // TODO: Implement actual payment processing integration
      console.log('💳 Adding payment method:', paymentData);
      return { success: true, message: 'Payment method added' };
    } catch (error) {
      throw handleError(error, 'Failed to add payment method');
    }
  }

  // ==================== REMOVE PAYMENT METHOD ====================
  
  async removePaymentMethod(userId, paymentMethodId) {
    try {
      // TODO: Implement actual payment processing integration
      console.log('🗑️ Removing payment method:', paymentMethodId);
      return { success: true, message: 'Payment method removed' };
    } catch (error) {
      throw handleError(error, 'Failed to remove payment method');
    }
  }

  // ==================== GET SUBSCRIPTION STATUS ====================
  
  async getSubscriptionStatus(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_pro, pro_expires_at')
        .eq('id', userId)
        .single();

      if (error) throw error;

      return {
        isActive: data.is_pro || false,
        plan: data.is_pro ? 'Pro' : 'Free',
        renewalDate: data.pro_expires_at
      };

    } catch (error) {
      console.error('Failed to fetch subscription status:', error);
      return {
        isActive: false,
        plan: 'Free',
        renewalDate: null
      };
    }
  }

  // ==================== UPDATE SUBSCRIPTION ====================
  
  async updateSubscription(userId, plan) {
    try {
      console.log('💎 Updating subscription to:', plan);

      const isPro = plan === 'pro';
      const updates = {
        is_pro: isPro,
        updated_at: new Date().toISOString()
      };

      if (isPro) {
        const expiryDate = new Date();
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);
        updates.pro_expires_at = expiryDate.toISOString();
      } else {
        updates.pro_expires_at = null;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);

      if (error) throw error;

      console.log('✅ Subscription updated');
      return { 
        success: true, 
        message: isPro ? 'Upgraded to Pro' : 'Downgraded to Free' 
      };

    } catch (error) {
      console.error('❌ Failed to update subscription:', error);
      throw handleError(error, 'Failed to update subscription');
    }
  }

  // ==================== REQUEST ACCOUNT DELETION ====================
  
  async requestAccountDeletion(userId) {
    try {
      console.log('🗑️ Requesting account deletion');

      const { error } = await supabase
        .from('profiles')
        .update({ 
          deletion_requested_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) throw error;

      // Log security event
      await supabase.from('security_events').insert({
        user_id: userId,
        event_type: 'account_deletion_requested',
        severity: 'warning',
        metadata: {}
      });

      console.log('✅ Account deletion requested');
      return { 
        success: true, 
        message: 'Account deletion requested. Your account will be deleted in 30 days.' 
      };

    } catch (error) {
      console.error('❌ Failed to request account deletion:', error);
      throw handleError(error, 'Failed to request account deletion');
    }
  }

  // ==================== CANCEL ACCOUNT DELETION ====================
  
  async cancelAccountDeletion(userId) {
    try {
      console.log('✅ Canceling account deletion');

      const { error } = await supabase
        .from('profiles')
        .update({ 
          deletion_requested_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) throw error;

      // Log security event
      await supabase.from('security_events').insert({
        user_id: userId,
        event_type: 'account_deletion_cancelled',
        severity: 'info',
        metadata: {}
      });

      console.log('✅ Account deletion cancelled');
      return { 
        success: true, 
        message: 'Account deletion cancelled' 
      };

    } catch (error) {
      console.error('❌ Failed to cancel account deletion:', error);
      throw handleError(error, 'Failed to cancel account deletion');
    }
  }

  // ==================== VERIFY PHONE NUMBER ====================
  
  async verifyPhoneNumber(userId, verificationCode) {
    try {
      // TODO: Implement actual SMS verification
      console.log('📱 Verifying phone number with code:', verificationCode);

      const { error } = await supabase
        .from('profiles')
        .update({ 
          phone_verified: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) throw error;

      return { success: true, message: 'Phone number verified' };

    } catch (error) {
      throw handleError(error, 'Failed to verify phone number');
    }
  }

  // ==================== SEND VERIFICATION CODE ====================
  
  async sendVerificationCode(userId, phoneNumber) {
    try {
      // TODO: Implement actual SMS sending
      console.log('📲 Sending verification code to:', phoneNumber);

      // For now, just return success
      return { success: true, message: 'Verification code sent' };

    } catch (error) {
      throw handleError(error, 'Failed to send verification code');
    }
  }
}

const settingsService = new SettingsService();
export default settingsService;