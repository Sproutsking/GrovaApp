// src/services/security/securityService.js
import { supabase } from '../config/supabase';
import { handleError } from '../shared/errorHandler';

class SecurityService {
  
  // Get security settings
  async getSecuritySettings(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('require_2fa, security_level, password_changed_at')
        .eq('id', userId)
        .single();

      if (error) throw error;

      // Check if 2FA is enabled
      const { data: twoFAData } = await supabase
        .from('two_factor_auth')
        .select('enabled')
        .eq('user_id', userId)
        .single();

      return {
        twoFactorEnabled: twoFAData?.enabled || false,
        securityLevel: data.security_level || 1,
        passwordChangedAt: data.password_changed_at,
        require2FA: data.require_2fa || false
      };

    } catch (error) {
      throw handleError(error, 'Failed to fetch security settings');
    }
  }

  // Get trusted devices
  async getTrustedDevices(userId) {
    try {
      const { data, error } = await supabase
        .from('device_fingerprints')
        .select('*')
        .eq('user_id', userId)
        .eq('is_trusted', true)
        .order('last_seen', { ascending: false });

      if (error) throw error;

      return data || [];

    } catch (error) {
      console.error('Failed to get trusted devices:', error);
      return [];
    }
  }

  // Remove device
  async removeDevice(userId, deviceId) {
    try {
      const { error } = await supabase
        .from('device_fingerprints')
        .update({ is_trusted: false })
        .eq('id', deviceId)
        .eq('user_id', userId);

      if (error) throw error;

      // Log security event
      await this.logSecurityEvent(userId, 'device_untrusted', 'info', {
        device_id: deviceId
      });

      return { success: true };

    } catch (error) {
      throw handleError(error, 'Failed to remove device');
    }
  }

  // Get recent security events
  async getRecentSecurityEvents(userId, limit = 10) {
    try {
      const { data, error } = await supabase
        .from('security_events')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data || [];

    } catch (error) {
      console.error('Failed to get security events:', error);
      return [];
    }
  }

  // Log security event
  async logSecurityEvent(userId, eventType, severity = 'info', metadata = {}) {
    try {
      const { error } = await supabase
        .from('security_events')
        .insert({
          user_id: userId,
          event_type: eventType,
          severity,
          ip_address: await this.getClientIP(),
          user_agent: navigator.userAgent,
          metadata,
          created_at: new Date().toISOString()
        });

      if (error) throw error;

    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  // Generate device fingerprint
  async generateDeviceFingerprint() {
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width,
      screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency,
      navigator.deviceMemory
    ];

    const fingerprint = components.join('|');
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    return hash.toString(36);
  }

  // Get client IP (placeholder - implement with actual IP service)
  async getClientIP() {
    try {
      // You can use a service like ipify or similar
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      return 'unknown';
    }
  }

  // Enable 2FA
  async enable2FA(userId) {
    try {
      // Generate secret for 2FA
      const secret = this.generateSecret();

      const { data, error } = await supabase
        .from('two_factor_auth')
        .insert({
          user_id: userId,
          secret,
          enabled: false, // Will be enabled after verification
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // Log security event
      await this.logSecurityEvent(userId, '2fa_enabled', 'info');

      return {
        success: true,
        secret,
        qrCodeUrl: `otpauth://totp/Grova:${userId}?secret=${secret}&issuer=Grova`
      };

    } catch (error) {
      throw handleError(error, 'Failed to enable 2FA');
    }
  }

  // Disable 2FA
  async disable2FA(userId) {
    try {
      const { error } = await supabase
        .from('two_factor_auth')
        .update({ enabled: false })
        .eq('user_id', userId);

      if (error) throw error;

      // Log security event
      await this.logSecurityEvent(userId, '2fa_disabled', 'warning');

      return { success: true };

    } catch (error) {
      throw handleError(error, 'Failed to disable 2FA');
    }
  }

  // Verify 2FA code
  async verify2FACode(userId, code) {
    try {
      // Get user's 2FA secret
      const { data, error } = await supabase
        .from('two_factor_auth')
        .select('secret')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      // Verify code (implement TOTP verification)
      const isValid = this.verifyTOTP(data.secret, code);

      if (isValid) {
        // Update last used
        await supabase
          .from('two_factor_auth')
          .update({ 
            last_used: new Date().toISOString(),
            enabled: true
          })
          .eq('user_id', userId);

        await this.logSecurityEvent(userId, '2fa_verified', 'info');
      } else {
        await this.logSecurityEvent(userId, '2fa_failed', 'warning');
      }

      return { success: isValid };

    } catch (error) {
      throw handleError(error, 'Failed to verify 2FA code');
    }
  }

  // Generate secret for 2FA
  generateSecret(length = 32) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let secret = '';
    for (let i = 0; i < length; i++) {
      secret += chars[Math.floor(Math.random() * chars.length)];
    }
    return secret;
  }

  // Verify TOTP (placeholder - implement actual TOTP algorithm)
  verifyTOTP(secret, code) {
    // This is a placeholder
    // In production, use a library like otpauth or speakeasy
    return code.length === 6 && /^\d+$/.test(code);
  }

  // Calculate security level
  async calculateSecurityLevel(userId) {
    try {
      let level = 1;

      // Check if 2FA is enabled (+2 levels)
      const { data: twoFA } = await supabase
        .from('two_factor_auth')
        .select('enabled')
        .eq('user_id', userId)
        .single();

      if (twoFA?.enabled) level += 2;

      // Check if password was changed recently (+1 level)
      const { data: profile } = await supabase
        .from('profiles')
        .select('password_changed_at')
        .eq('id', userId)
        .single();

      if (profile?.password_changed_at) {
        const passwordAge = Date.now() - new Date(profile.password_changed_at).getTime();
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        if (passwordAge < thirtyDays) level += 1;
      }

      // Check for trusted devices (+1 level)
      const { data: devices } = await supabase
        .from('device_fingerprints')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_trusted', true);

      if (devices && devices.count > 0) level += 1;

      // Cap at 5
      level = Math.min(level, 5);

      // Update security level
      await supabase
        .from('profiles')
        .update({ security_level: level })
        .eq('id', userId);

      return level;

    } catch (error) {
      console.error('Failed to calculate security level:', error);
      return 1;
    }
  }
}

export default new SecurityService();