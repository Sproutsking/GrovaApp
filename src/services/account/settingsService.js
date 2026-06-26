// src/services/account/settingsService.js
// ─────────────────────────────────────────────────────────────────────────────
// Unified: Pro/subscription removed. Boost tier (silver/gold/diamond) is the
// only upgrade path. Reads from profile_boosts table, not is_pro column.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "../config/supabase";
import { handleError } from "../shared/errorHandler";
import xrcService, { XRC_EVENTS, STREAM_TYPES } from "../xrc";

class SettingsService {
  // ── GET USER SETTINGS ──────────────────────────────────────────────────────

  async getUserSettings(userId) {
    try {
      console.log("⚙️ Loading settings for user:", userId);

      const [profileRes, boostRes] = await Promise.allSettled([
        supabase.from("profiles")
          .select("*")
          .eq("id", userId)
          .single(),
        supabase.from("profile_boosts")
          .select("boost_tier,expires_at,status,is_system_grant,ep_bonus_pct")
          .eq("user_id", userId)
          .eq("status", "active")
          .maybeSingle(),
      ]);

      if (profileRes.status === "rejected") throw profileRes.reason;
      const profile = profileRes.value.data;
      if (!profile) throw new Error("Profile not found");

      // Notifications — default all OFF
      const defaultPreferences = {
        notify_profile_visits: false,
        notify_comments:       false,
        notify_likes:          false,
        notify_shares:         false,
        notify_followers:      false,
        notify_unlocks:        false,
      };
      const prefs = profile.preferences
        ? { ...defaultPreferences, ...profile.preferences }
        : defaultPreferences;

      // Boost tier (replaces is_pro)
      const boost = boostRes.status === "fulfilled" ? boostRes.value?.data : null;
      const boostTier = boost?.boost_tier ?? "none";
      const hasBoost  = !!boost && boostTier !== "none";

      const settings = {
        notifications: {
          profileVisits: prefs.notify_profile_visits === true,
          comments:      prefs.notify_comments       === true,
          likes:         prefs.notify_likes          === true,
          shares:        prefs.notify_shares         === true,
          newFollowers:  prefs.notify_followers      === true,
          storyUnlocks:  prefs.notify_unlocks        === true,
        },
        privacy: {
          privateAccount: profile.is_private || false,
          showEmail:      profile.show_email  || false,
          showPhone:      profile.show_phone  || false,
        },
        security: {
          require2FA:        profile.require_2fa       || false,
          passwordChangedAt: profile.password_changed_at,
          securityLevel:     profile.security_level    || 1,
        },
        contact: {
          email:         profile.email,
          phone:         profile.phone,
          phoneVerified: profile.phone_verified || false,
        },
        // Unified boost status — no more is_pro
        boost: {
          hasBoost,
          tier:          boostTier,
          expiresAt:     boost?.expires_at    ?? null,
          isSystemGrant: boost?.is_system_grant ?? false,
          epBonusPct:    boost?.ep_bonus_pct  ?? 0,
        },
      };

      console.log("✅ Settings loaded:", settings.boost);
      return settings;
    } catch (error) {
      console.error("❌ Failed to fetch settings:", error);
      throw handleError(error, "Failed to fetch settings");
    }
  }

  // ── UPDATE NOTIFICATION SETTINGS ──────────────────────────────────────────

  async updateNotificationSettings(userId, notificationSettings) {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("preferences")
        .eq("id", userId)
        .single();

      const currentPrefs = profile?.preferences || {};
      const updatedPrefs = {
        ...currentPrefs,
        notify_profile_visits: notificationSettings.profileVisits === true,
        notify_comments:       notificationSettings.comments      === true,
        notify_likes:          notificationSettings.likes         === true,
        notify_shares:         notificationSettings.shares        === true,
        notify_followers:      notificationSettings.newFollowers  === true,
        notify_unlocks:        notificationSettings.storyUnlocks  === true,
      };

      const { error } = await supabase.from("profiles")
        .update({ preferences: updatedPrefs, updated_at: new Date().toISOString() })
        .eq("id", userId);

      if (error) throw error;
      await this._logProfileUpdate(userId, ["preferences"]);
      return { success: true, settings: notificationSettings };
    } catch (error) {
      throw handleError(error, "Failed to update notification settings");
    }
  }

  async _logProfileUpdate(userId, fields) {
    const filteredFields = (fields || []).filter((field) => field !== "updated_at");
    if (filteredFields.length === 0) return;

    xrcService.writeRecord(
      STREAM_TYPES.XARC,
      XRC_EVENTS.profileUpdated(userId, filteredFields),
      userId,
    ).catch((err) => console.error("[XRC] profileUpdated record failed:", err));
  }

  // ── SAVE SETTINGS ───────────────────────────────────────────────────────────────

  async saveSettings(userId, privacySettings, preferences) {
    try {
      const updates = {
        is_private: privacySettings.privateAccount,
        show_email: privacySettings.showEmail,
        show_phone: privacySettings.showPhone,
        preferences,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("profiles").update(updates).eq("id", userId);
      if (error) throw error;
      await this._logProfileUpdate(userId, ["is_private", "show_email", "show_phone", "preferences"]);
      return { success: true };
    } catch (error) {
      throw handleError(error, "Failed to save settings");
    }
  }

  // ── UPDATE PRIVACY SETTINGS ────────────────────────────────────────────────

  async updatePrivacySettings(userId, privacySettings) {
    try {
      const updates = {};
      if (privacySettings.privateAccount !== undefined) updates.is_private = privacySettings.privateAccount;
      if (privacySettings.showEmail      !== undefined) updates.show_email  = privacySettings.showEmail;
      if (privacySettings.showPhone      !== undefined) updates.show_phone  = privacySettings.showPhone;
      updates.updated_at = new Date().toISOString();

      const { error } = await supabase.from("profiles").update(updates).eq("id", userId);
      if (error) throw error;
      await this._logProfileUpdate(userId, Object.keys(updates));
      return { success: true, settings: privacySettings };
    } catch (error) {
      throw handleError(error, "Failed to update privacy settings");
    }
  }

  // ── UPDATE CONTACT INFO ────────────────────────────────────────────────────

  async updateContactInfo(userId, contactInfo) {
    try {
      const updates = {};
      if (contactInfo.email !== undefined) updates.email = contactInfo.email;
      if (contactInfo.phone !== undefined) { updates.phone = contactInfo.phone; updates.phone_verified = false; }
      updates.updated_at = new Date().toISOString();

      const { error } = await supabase.from("profiles").update(updates).eq("id", userId);
      if (error) throw error;
      await this._logProfileUpdate(userId, Object.keys(updates));
      return { success: true };
    } catch (error) {
      throw handleError(error, "Failed to update contact info");
    }
  }

  async verifyPassword(password) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user?.email) return { success: false, message: "Unable to verify password" };

      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });
      if (error) return { success: false, message: error.message };
      return { success: true };
    } catch (error) {
      console.error("verifyPassword error:", error);
      return { success: false, message: error.message || "Unable to verify password" };
    }
  }

  async userHas2FA(userId) {
    try {
      const { data, error } = await supabase
        .from("two_factor_auth")
        .select("enabled")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data?.enabled || false;
    } catch (error) {
      console.error("userHas2FA error:", error);
      return false;
    }
  }

  async sendEmailVerificationCode(userId, email) {
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      console.log(`🔐 EMAIL VERIFICATION CODE for ${email}: ${code}`);
      localStorage.setItem(`verify_code_email_${userId}`, code);
      localStorage.setItem(`verify_email_${userId}`, email);
      return { success: true, message: "Verification code sent" };
    } catch (error) {
      throw handleError(error, "Failed to send verification code");
    }
  }

  async verifyAndChangeEmail(userId, email, verificationCode) {
    try {
      const storedCode  = localStorage.getItem(`verify_code_email_${userId}`);
      const storedEmail = localStorage.getItem(`verify_email_${userId}`);
      if (storedCode !== verificationCode) return { success: false, message: "Invalid verification code" };
      if (storedEmail !== email) return { success: false, message: "Email mismatch" };

      const { error } = await supabase.from("profiles")
        .update({ email, updated_at: new Date().toISOString() })
        .eq("id", userId);
      if (error) throw error;

      localStorage.removeItem(`verify_code_email_${userId}`);
      localStorage.removeItem(`verify_email_${userId}`);
      await this._logProfileUpdate(userId, ["email"]);
      return { success: true, message: "Email updated successfully" };
    } catch (error) {
      throw handleError(error, "Failed to verify email address");
    }
  }

  // ── CHANGE PASSWORD ────────────────────────────────────────────────────────

  async changePassword(currentPassword, newPassword) {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles")
          .update({ password_changed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", user.id);
        await supabase.from("security_events").insert({
          user_id: user.id, event_type: "password_changed", severity: "info", metadata: {},
        });
        await this._logProfileUpdate(user.id, ["password_changed_at"]);
      }
      return { success: true, message: "Password changed successfully" };
    } catch (error) {
      throw handleError(error, "Failed to change password");
    }
  }

  // ── GET BOOST STATUS (replaces getSubscriptionStatus) ─────────────────────

  async getBoostStatus(userId) {
    try {
      const { data, error } = await supabase
        .from("profile_boosts")
        .select("boost_tier,expires_at,status,is_system_grant,ep_bonus_pct,billing")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      if (error) throw error;

      if (!data) return { hasBoost: false, tier: "none", expiresAt: null, isSystemGrant: false, epBonusPct: 0 };

      return {
        hasBoost:      true,
        tier:          data.boost_tier,
        expiresAt:     data.expires_at,
        isSystemGrant: data.is_system_grant || false,
        epBonusPct:    data.ep_bonus_pct    || 0,
        billing:       data.billing,
      };
    } catch (error) {
      console.error("Failed to fetch boost status:", error);
      return { hasBoost: false, tier: "none", expiresAt: null, isSystemGrant: false, epBonusPct: 0 };
    }
  }

  // ── DEPRECATED: kept as stub so old callers don't crash ───────────────────
  // These all forward to boost equivalents or return safe defaults.

  async getSubscriptionStatus(userId) {
    console.warn("⚠️ getSubscriptionStatus is deprecated. Use getBoostStatus instead.");
    const boost = await this.getBoostStatus(userId);
    return {
      isActive:    boost.hasBoost,
      plan:        boost.hasBoost ? boost.tier.charAt(0).toUpperCase() + boost.tier.slice(1) : "Free",
      renewalDate: boost.expiresAt,
    };
  }

  async updateSubscription(userId, plan) {
    console.warn("⚠️ updateSubscription is deprecated. Use UpgradeView / boostService instead.");
    return { success: false, message: "Use Boost (Silver/Gold/Diamond) via UpgradeView." };
  }

  // ── ACCOUNT DELETION ───────────────────────────────────────────────────────

  async requestAccountDeletion(userId) {
    try {
      const { error } = await supabase.from("profiles")
        .update({ deletion_requested_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", userId);
      if (error) throw error;
      await this._logProfileUpdate(userId, ["deletion_requested_at"]);
      await supabase.from("security_events").insert({
        user_id: userId, event_type: "account_deletion_requested", severity: "warning", metadata: {},
      });
      return { success: true, message: "Account deletion requested. Your account will be deleted in 30 days." };
    } catch (error) {
      throw handleError(error, "Failed to request account deletion");
    }
  }

  async cancelAccountDeletion(userId) {
    try {
      const { error } = await supabase.from("profiles")
        .update({ deletion_requested_at: null, updated_at: new Date().toISOString() })
        .eq("id", userId);
      if (error) throw error;
      await this._logProfileUpdate(userId, ["deletion_requested_at"]);
      await supabase.from("security_events").insert({
        user_id: userId, event_type: "account_deletion_cancelled", severity: "info", metadata: {},
      });
      return { success: true, message: "Account deletion cancelled" };
    } catch (error) {
      throw handleError(error, "Failed to cancel account deletion");
    }
  }

  // ── PHONE VERIFICATION ─────────────────────────────────────────────────────

  async sendVerificationCode(userId, phoneNumber) {
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      console.log(`🔐 VERIFICATION CODE for ${phoneNumber}: ${code}`);
      localStorage.setItem(`verify_code_${userId}`, code);
      localStorage.setItem(`verify_phone_${userId}`, phoneNumber);
      return { success: true, message: "Verification code sent" };
    } catch (error) {
      throw handleError(error, "Failed to send verification code");
    }
  }

  async verifyPhoneNumber(userId, phoneNumber, verificationCode) {
    try {
      const storedCode  = localStorage.getItem(`verify_code_${userId}`);
      const storedPhone = localStorage.getItem(`verify_phone_${userId}`);
      if (storedCode  !== verificationCode) return { success: false, message: "Invalid verification code" };
      if (storedPhone !== phoneNumber)      return { success: false, message: "Phone number mismatch" };

      const { error } = await supabase.from("profiles")
        .update({ phone: phoneNumber, phone_verified: true, updated_at: new Date().toISOString() })
        .eq("id", userId);
      if (error) throw error;

      localStorage.removeItem(`verify_code_${userId}`);
      localStorage.removeItem(`verify_phone_${userId}`);
      await this._logProfileUpdate(userId, ["phone", "phone_verified"]);
      return { success: true, message: "Phone number verified" };
    } catch (error) {
      throw handleError(error, "Failed to verify phone number");
    }
  }

  async confirmPhoneVerification(userId, phoneNumber) {
    try {
      const updates = {
        phone:          phoneNumber,
        phone_verified: true,
        updated_at:     new Date().toISOString(),
      };

      const { error } = await supabase.from("profiles")
        .update(updates)
        .eq("id", userId);
      if (error) throw error;

      await this._logProfileUpdate(userId, Object.keys(updates));
      await supabase.from("security_events").insert({
        user_id:    userId,
        event_type: "device_trusted",
        severity:   "info",
        metadata:   { action: "phone_verified", phone: phoneNumber.slice(0, -4) + "****" },
      });

      return { success: true };
    } catch (error) {
      throw handleError(error, "Failed to confirm phone verification");
    }
  }
  async enableTwoFactor(userId, secret, backupCodes) {
    try {
      const { error: dbError } = await supabase
        .from("two_factor_auth")
        .upsert({
          user_id:      userId,
          secret,
          enabled:      true,
          backup_codes: backupCodes,
          verified_at:  new Date().toISOString(),
          last_used:    null,
        }, {
          onConflict: "user_id",
        });
      if (dbError) throw dbError;

      const { error: profileError } = await supabase.from("profiles")
        .update({
          require_2fa:    true,
          security_level: 5,
          updated_at:     new Date().toISOString(),
        })
        .eq("id", userId);
      if (profileError) throw profileError;

      await supabase.from("security_events").insert({
        user_id:    userId,
        event_type: "2fa_enabled",
        severity:   "info",
        metadata:   { timestamp: new Date().toISOString() },
      });

      await this._logProfileUpdate(userId, ["require_2fa", "security_level"]);
      return { success: true };
    } catch (error) {
      throw handleError(error, "Failed to enable two-factor authentication");
    }
  }
  // ── PAYMENT METHODS (stubs) ────────────────────────────────────────────────

  async getPaymentMethods(userId)                    { return []; }
  async addPaymentMethod(userId, paymentData)        { return { success: true }; }
  async removePaymentMethod(userId, paymentMethodId) { return { success: true }; }
}

const settingsService = new SettingsService();
export default settingsService;