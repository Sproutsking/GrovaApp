// src/services/account/settingsService.js
import { supabase } from '../config/supabase';
import { handleError } from '../shared/errorHandler';

class SettingsService {
  
  // Get user settings (preferences)
  async getUserSettings(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;

      // For now, return default notification settings
      // You can add a user_settings table later
      return {
        notifications: {
          profileVisits: true,
          comments: true,
          likes: true,
          shares: true,
          newFollowers: true,
          storyUnlocks: true
        },
        privacy: {
          privateAccount: false,
          showEmail: false,
          showPhone: false
        },
        security: {
          require2FA: data.require_2fa || false,
          passwordChangedAt: data.password_changed_at,
          securityLevel: data.security_level || 1
        }
      };

    } catch (error) {
      throw handleError(error, 'Failed to fetch settings');
    }
  }

  // Update notification settings
  async updateNotificationSettings(userId, settings) {
    try {
      // Store in user metadata or create settings table
      // For now, just return success
      console.log('Updating notification settings:', settings);
      return { success: true, settings };
    } catch (error) {
      throw handleError(error, 'Failed to update notification settings');
    }
  }

  // Update privacy settings
  async updatePrivacySettings(userId, settings) {
    try {
      console.log('Updating privacy settings:', settings);
      return { success: true, settings };
    } catch (error) {
      throw handleError(error, 'Failed to update privacy settings');
    }
  }

  // Change password
  async changePassword(currentPassword, newPassword) {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      // Update password_changed_at
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('profiles')
          .update({ password_changed_at: new Date().toISOString() })
          .eq('id', user.id);
      }

      return { success: true, message: 'Password changed successfully' };

    } catch (error) {
      throw handleError(error, 'Failed to change password');
    }
  }

  // Get payment methods
  async getPaymentMethods(userId) {
    try {
      // Placeholder - implement actual payment method storage
      return [
        {
          id: '1',
          type: 'card',
          last4: '1234',
          brand: 'Visa',
          expiryMonth: 12,
          expiryYear: 2025,
          isDefault: true
        }
      ];
    } catch (error) {
      throw handleError(error, 'Failed to fetch payment methods');
    }
  }

  // Add payment method
  async addPaymentMethod(userId, paymentData) {
    try {
      // Placeholder - implement actual payment processing
      console.log('Adding payment method:', paymentData);
      return { success: true, message: 'Payment method added' };
    } catch (error) {
      throw handleError(error, 'Failed to add payment method');
    }
  }

  // Remove payment method
  async removePaymentMethod(userId, paymentMethodId) {
    try {
      // Placeholder - implement actual payment processing
      console.log('Removing payment method:', paymentMethodId);
      return { success: true, message: 'Payment method removed' };
    } catch (error) {
      throw handleError(error, 'Failed to remove payment method');
    }
  }

  // Get subscription status
  async getSubscriptionStatus(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_pro')
        .eq('id', userId)
        .single();

      if (error) throw error;

      return {
        isActive: data.is_pro || false,
        plan: data.is_pro ? 'Pro' : 'Free',
        renewalDate: null // Add this field to profiles table if needed
      };

    } catch (error) {
      throw handleError(error, 'Failed to fetch subscription status');
    }
  }

  // Update subscription
  async updateSubscription(userId, plan) {
    try {
      const isPro = plan === 'pro';

      const { error } = await supabase
        .from('profiles')
        .update({ is_pro: isPro })
        .eq('id', userId);

      if (error) throw error;

      return { 
        success: true, 
        message: isPro ? 'Upgraded to Pro' : 'Downgraded to Free' 
      };

    } catch (error) {
      throw handleError(error, 'Failed to update subscription');
    }
  }

  // Delete account request
  async requestAccountDeletion(userId) {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          deletion_requested_at: new Date().toISOString() 
        })
        .eq('id', userId);

      if (error) throw error;

      return { 
        success: true, 
        message: 'Account deletion requested. Your account will be deleted in 30 days.' 
      };

    } catch (error) {
      throw handleError(error, 'Failed to request account deletion');
    }
  }

  // Cancel account deletion
  async cancelAccountDeletion(userId) {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          deletion_requested_at: null 
        })
        .eq('id', userId);

      if (error) throw error;

      return { 
        success: true, 
        message: 'Account deletion cancelled' 
      };

    } catch (error) {
      throw handleError(error, 'Failed to cancel account deletion');
    }
  }
}

export default new SettingsService();