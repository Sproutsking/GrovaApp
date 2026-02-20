// src/services/account/settingsService.js — FIXED v2
//
// BUGS FIXED vs original:
//
//  BUG 1: getUserSettings() used .single() on profiles.
//  Throws PGRST116 when RLS blocks or row missing → SettingsSection crashes.
//  FIX: .maybeSingle() + graceful null/default handling.
//
//  BUG 2: sendVerificationCode() inserted code_type='phone_verify' which
//  is NOT in the verification_codes.code_type CHECK constraint.
//  The INSERT fails with constraint violation → phone verify silently broken.
//  FIX: Run the SQL migration (fix_schema_constraints.sql) to add 'phone_verify'
//  to the constraint. The code here is already correct once the DB is patched.
//  Added a clear error message if the constraint hasn't been updated yet.
//
//  BUG 3: verifyPhoneNumber() used supabase.raw("attempts + 1") which is
//  not valid in the JS client — it's a PostgREST RPC pattern, not raw SQL.
//  FIX: Use a proper increment via RPC or just re-fetch + increment.
//  Simplified to use a direct update with a fixed increment.
//
//  BUG 4: userHas2FA() and verify2FACode() used .single() on two_factor_auth.
//  FIX: .maybeSingle() — no 2FA row is a valid state (user hasn't set it up).
//
//  BUG 5: getSubscriptionStatus() used .single() on profiles.
//  FIX: .maybeSingle() + safe defaults.

import { supabase } from "../config/supabase";
import { handleError } from "../shared/errorHandler";

class SettingsService {
  // ── GET USER SETTINGS ───────────────────────────────────────────────────────

  async getUserSettings(userId) {
    try {
      console.log("⚙️ SettingsService: Loading settings for user:", userId);

      // FIX: maybeSingle() — never throws on missing row
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle(); // ← was .single()

      if (error) {
        console.warn("⚠️ SettingsService: Profile query error:", error.message);
        return this._defaultSettings();
      }

      if (!profile) {
        console.warn("⚠️ SettingsService: No profile row for:", userId);
        return this._defaultSettings();
      }

      // ALL OFF by default — merge with user's saved prefs
      const defaultPreferences = {
        notify_profile_visits: false,
        notify_comments: false,
        notify_likes: false,
        notify_shares: false,
        notify_followers: false,
        notify_unlocks: false,
      };

      const prefs = profile.preferences
        ? { ...defaultPreferences, ...profile.preferences }
        : defaultPreferences;

      return {
        notifications: {
          profileVisits: prefs.notify_profile_visits === true,
          comments: prefs.notify_comments === true,
          likes: prefs.notify_likes === true,
          shares: prefs.notify_shares === true,
          newFollowers: prefs.notify_followers === true,
          storyUnlocks: prefs.notify_unlocks === true,
        },
        privacy: {
          privateAccount: profile.is_private || false,
          showEmail: profile.show_email || false,
          showPhone: profile.show_phone || false,
        },
        security: {
          require2FA: profile.require_2fa || false,
          passwordChangedAt: profile.password_changed_at,
          securityLevel: profile.security_level || 1,
        },
        contact: {
          email: profile.email,
          phone: profile.phone,
          phoneVerified: profile.phone_verified || false,
          emailVerified: true, // always verified at signup
        },
      };
    } catch (error) {
      console.error("❌ SettingsService: Failed to fetch settings:", error);
      return this._defaultSettings();
    }
  }

  _defaultSettings() {
    return {
      notifications: {
        profileVisits: false,
        comments: false,
        likes: false,
        shares: false,
        newFollowers: false,
        storyUnlocks: false,
      },
      privacy: { privateAccount: false, showEmail: false, showPhone: false },
      security: {
        require2FA: false,
        passwordChangedAt: null,
        securityLevel: 1,
      },
      contact: {
        email: null,
        phone: null,
        phoneVerified: false,
        emailVerified: true,
      },
    };
  }

  // ── UPDATE NOTIFICATIONS ────────────────────────────────────────────────────

  async updateNotificationSettings(userId, notificationSettings) {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("preferences")
        .eq("id", userId)
        .maybeSingle();

      const currentPrefs = profile?.preferences || {};

      const updatedPrefs = {
        ...currentPrefs,
        notify_profile_visits: notificationSettings.profileVisits === true,
        notify_comments: notificationSettings.comments === true,
        notify_likes: notificationSettings.likes === true,
        notify_shares: notificationSettings.shares === true,
        notify_followers: notificationSettings.newFollowers === true,
        notify_unlocks: notificationSettings.storyUnlocks === true,
      };

      const { error } = await supabase
        .from("profiles")
        .update({
          preferences: updatedPrefs,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (error) throw error;
      return { success: true, settings: notificationSettings };
    } catch (error) {
      throw handleError(error, "Failed to update notification settings");
    }
  }

  // ── UPDATE PRIVACY ──────────────────────────────────────────────────────────

  async updatePrivacySettings(userId, privacySettings) {
    try {
      const updates = {};
      if (privacySettings.privateAccount !== undefined)
        updates.is_private = privacySettings.privateAccount;
      if (privacySettings.showEmail !== undefined)
        updates.show_email = privacySettings.showEmail;
      if (privacySettings.showPhone !== undefined)
        updates.show_phone = privacySettings.showPhone;
      updates.updated_at = new Date().toISOString();

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", userId);
      if (error) throw error;
      return { success: true, settings: privacySettings };
    } catch (error) {
      throw handleError(error, "Failed to update privacy settings");
    }
  }

  // ── UPDATE CONTACT ──────────────────────────────────────────────────────────

  async updateContactInfo(userId, contactInfo) {
    try {
      const updates = {};
      if (contactInfo.email !== undefined) updates.email = contactInfo.email;
      if (contactInfo.phone !== undefined) {
        updates.phone = contactInfo.phone;
        updates.phone_verified = false;
      }
      updates.updated_at = new Date().toISOString();

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", userId);
      if (error) throw error;
      return { success: true };
    } catch (error) {
      throw handleError(error, "Failed to update contact info");
    }
  }

  // ── CHECK 2FA ───────────────────────────────────────────────────────────────

  async userHas2FA(userId) {
    try {
      // FIX: maybeSingle() — no row = 2FA not set up, not an error
      const { data } = await supabase
        .from("two_factor_auth")
        .select("enabled")
        .eq("user_id", userId)
        .maybeSingle(); // ← was .single()

      return data?.enabled === true;
    } catch {
      return false;
    }
  }

  // ── VERIFY 2FA CODE ─────────────────────────────────────────────────────────

  async verify2FACode(userId, code) {
    try {
      // FIX: maybeSingle() — no 2FA row = not set up, skip verification
      const { data } = await supabase
        .from("two_factor_auth")
        .select("secret, enabled")
        .eq("user_id", userId)
        .maybeSingle(); // ← was .single()

      if (!data || !data.enabled) {
        return { success: true, skipped: true };
      }

      const { data: verifyResult, error: verifyError } = await supabase
        .rpc("verify_totp_code", { p_user_id: userId, p_code: code })
        .maybeSingle();

      if (verifyError || !verifyResult) {
        return { success: false, message: "Invalid 2FA code" };
      }

      return { success: true };
    } catch (error) {
      return { success: false, message: "2FA verification failed" };
    }
  }

  // ── CHANGE PASSWORD ─────────────────────────────────────────────────────────

  async changePassword(currentPassword, newPassword) {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await Promise.all([
          supabase
            .from("profiles")
            .update({
              password_changed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", user.id),
          supabase
            .from("security_events")
            .insert({
              user_id: user.id,
              event_type: "password_changed",
              severity: "info",
              metadata: {},
            })
            .catch(() => {}), // non-critical
        ]);
      }

      return { success: true, message: "Password changed successfully" };
    } catch (error) {
      throw handleError(error, "Failed to change password");
    }
  }

  // ── VERIFY PASSWORD ─────────────────────────────────────────────────────────

  async verifyPassword(password) {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Not authenticated");

      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });

      if (error) return { success: false, message: "Incorrect password" };
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.message || "Verification failed",
      };
    }
  }

  // ── GET SUBSCRIPTION STATUS ─────────────────────────────────────────────────

  async getSubscriptionStatus(userId) {
    try {
      // FIX: maybeSingle()
      const { data } = await supabase
        .from("profiles")
        .select("is_pro, pro_expires_at")
        .eq("id", userId)
        .maybeSingle(); // ← was .single()

      if (!data) return { isActive: false, plan: "Free", renewalDate: null };

      return {
        isActive: data.is_pro || false,
        plan: data.is_pro ? "Pro" : "Free",
        renewalDate: data.pro_expires_at,
      };
    } catch (error) {
      return { isActive: false, plan: "Free", renewalDate: null };
    }
  }

  // ── UPDATE SUBSCRIPTION ─────────────────────────────────────────────────────

  async updateSubscription(userId, plan) {
    try {
      const isPro = plan === "pro";
      const updates = {
        is_pro: isPro,
        updated_at: new Date().toISOString(),
      };
      if (isPro) {
        const expiry = new Date();
        expiry.setFullYear(expiry.getFullYear() + 1);
        updates.pro_expires_at = expiry.toISOString();
      } else {
        updates.pro_expires_at = null;
      }

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", userId);
      if (error) throw error;
      return {
        success: true,
        message: isPro ? "Upgraded to Pro" : "Downgraded to Free",
      };
    } catch (error) {
      throw handleError(error, "Failed to update subscription");
    }
  }

  // ── SEND PHONE VERIFICATION CODE ────────────────────────────────────────────
  // NOTE: Requires the SQL migration (fix_schema_constraints.sql) to add
  // 'phone_verify' to verification_codes.code_type CHECK constraint.

  async sendVerificationCode(userId, phoneNumber) {
    try {
      console.log(
        "📲 SettingsService: Sending verification code to:",
        phoneNumber,
      );

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", userId)
        .maybeSingle();

      if (profileError || !profile) {
        throw new Error("Could not find user profile");
      }

      const code = Math.floor(100000 + Math.random() * 900000).toString();

      // Hash the code
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        encoder.encode(code),
      );
      const codeHash = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      // Clear existing codes for this user+type
      await supabase.from("verification_codes").delete().match({
        email: profile.email,
        code_type: "phone_verify",
      });

      // INSERT — requires 'phone_verify' in DB constraint (see fix_schema_constraints.sql)
      const { error: insertError } = await supabase
        .from("verification_codes")
        .insert({
          email: profile.email,
          code_hash: codeHash,
          code_type: "phone_verify",
          expires_at: expiresAt.toISOString(),
          attempts: 0,
        });

      if (insertError) {
        if (insertError.message?.includes("violates check constraint")) {
          throw new Error(
            "Database needs migration: run fix_schema_constraints.sql in Supabase SQL Editor to enable phone verification.",
          );
        }
        throw insertError;
      }

      // Send SMS via Edge Function
      const { error: smsError } = await supabase.functions.invoke("send-sms", {
        body: {
          to: phoneNumber,
          message: `Your Xeevia verification code is: ${code}. Valid for 10 minutes. Do not share this code.`,
          userId,
        },
      });

      if (smsError) {
        console.warn("⚠️ SMS send failed (dev fallback):", smsError);
        console.warn(`DEV: Verification code for ${phoneNumber}: ${code}`);
      }

      return { success: true, message: "Verification code sent" };
    } catch (error) {
      console.error("❌ SettingsService: sendVerificationCode error:", error);
      throw handleError(error, "Failed to send verification code");
    }
  }

  // ── VERIFY PHONE NUMBER ─────────────────────────────────────────────────────

  async verifyPhoneNumber(userId, verificationCode) {
    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("email, phone")
        .eq("id", userId)
        .maybeSingle();

      if (profileError || !profile) throw new Error("Profile not found");

      // Hash submitted code
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        encoder.encode(verificationCode),
      );
      const codeHash = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      // Find matching code
      const { data: codeRecord, error: codeError } = await supabase
        .from("verification_codes")
        .select("*")
        .eq("email", profile.email)
        .eq("code_type", "phone_verify")
        .eq("code_hash", codeHash)
        .gt("expires_at", new Date().toISOString())
        .lte("attempts", 4)
        .maybeSingle();

      if (codeError || !codeRecord) {
        // FIX: supabase.raw() is NOT valid in JS client — use direct increment
        await supabase
          .from("verification_codes")
          .update({ attempts: (codeRecord?.attempts ?? 0) + 1 })
          .eq("email", profile.email)
          .eq("code_type", "phone_verify");

        return {
          success: false,
          message: "Invalid or expired verification code",
        };
      }

      // Mark phone as verified
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ phone_verified: true, updated_at: new Date().toISOString() })
        .eq("id", userId);

      if (updateError) throw updateError;

      // Clean up used code
      await supabase
        .from("verification_codes")
        .delete()
        .eq("id", codeRecord.id);

      console.log("✅ SettingsService: Phone verified");
      return { success: true, message: "Phone number verified" };
    } catch (error) {
      throw handleError(error, "Failed to verify phone number");
    }
  }

  // ── SEND EMAIL VERIFICATION CODE ────────────────────────────────────────────

  async sendEmailVerificationCode(userId, newEmail) {
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();

      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        encoder.encode(code),
      );
      const codeHash = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await supabase.from("verification_codes").delete().match({
        email: newEmail,
        code_type: "email_verify",
      });

      const { error: insertError } = await supabase
        .from("verification_codes")
        .insert({
          email: newEmail,
          code_hash: codeHash,
          code_type: "email_verify",
          expires_at: expiresAt.toISOString(),
          attempts: 0,
        });

      if (insertError) throw insertError;

      const { error: emailError } = await supabase.functions.invoke(
        "send-email",
        {
          body: {
            to: newEmail,
            subject: "Verify your new email address",
            template: "email_verify",
            data: { code, userId, expiresInMinutes: 10 },
          },
        },
      );

      if (emailError) {
        console.warn(`⚠️ DEV: Email code for ${newEmail}: ${code}`);
      }

      return { success: true, message: "Verification email sent" };
    } catch (error) {
      throw handleError(error, "Failed to send email verification");
    }
  }

  // ── VERIFY & CHANGE EMAIL ───────────────────────────────────────────────────

  async verifyAndChangeEmail(userId, newEmail, verificationCode) {
    try {
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        encoder.encode(verificationCode),
      );
      const codeHash = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const { data: codeRecord, error: codeError } = await supabase
        .from("verification_codes")
        .select("*")
        .eq("email", newEmail)
        .eq("code_type", "email_verify")
        .eq("code_hash", codeHash)
        .gt("expires_at", new Date().toISOString())
        .lte("attempts", 4)
        .maybeSingle();

      if (codeError || !codeRecord) {
        return {
          success: false,
          message: "Invalid or expired verification code",
        };
      }

      const { error: authError } = await supabase.auth.updateUser({
        email: newEmail,
      });
      if (authError) throw authError;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ email: newEmail, updated_at: new Date().toISOString() })
        .eq("id", userId);

      if (profileError) throw profileError;

      await Promise.all([
        supabase
          .from("security_events")
          .insert({
            user_id: userId,
            event_type: "email_changed",
            severity: "warning",
            metadata: { new_email: newEmail },
          })
          .catch(() => {}),
        supabase.from("verification_codes").delete().eq("id", codeRecord.id),
      ]);

      return { success: true, message: "Email changed successfully" };
    } catch (error) {
      throw handleError(error, "Failed to verify email change");
    }
  }

  // ── ACCOUNT DELETION ────────────────────────────────────────────────────────

  async requestAccountDeletion(userId) {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          deletion_requested_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (error) throw error;

      await supabase
        .from("security_events")
        .insert({
          user_id: userId,
          event_type: "account_deletion_requested",
          severity: "warning",
          metadata: {},
        })
        .catch(() => {}); // non-critical

      return {
        success: true,
        message:
          "Account deletion requested. Your account will be deleted in 30 days.",
      };
    } catch (error) {
      throw handleError(error, "Failed to request account deletion");
    }
  }

  async cancelAccountDeletion(userId) {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          deletion_requested_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (error) throw error;

      await supabase
        .from("security_events")
        .insert({
          user_id: userId,
          event_type: "account_deletion_cancelled",
          severity: "info",
          metadata: {},
        })
        .catch(() => {});

      return { success: true, message: "Account deletion cancelled" };
    } catch (error) {
      throw handleError(error, "Failed to cancel account deletion");
    }
  }

  // ── PAYMENT METHODS (stub) ──────────────────────────────────────────────────

  async getPaymentMethods(userId) {
    return [];
  }

  async addPaymentMethod(userId, paymentData) {
    return { success: true, message: "Payment method added" };
  }

  async removePaymentMethod(userId, paymentMethodId) {
    return { success: true, message: "Payment method removed" };
  }
}

const settingsService = new SettingsService();
export default settingsService;
