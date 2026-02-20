// src/services/security/securityService.js — v2 FIXED
//
// KEY FIXES:
//   • getClientIP() is no longer called inside logSecurityEvent()
//     It was making an external fetch to api.ipify.org on EVERY security
//     event, which could block/hang during the OAuth callback flow.
//   • IP is now cached once at startup and reused — never blocks auth.
//   • All .single() calls that could throw 406 replaced with .maybeSingle()

import { supabase } from "../config/supabase";
import { handleError } from "../shared/errorHandler";

class SecurityService {
  constructor() {
    // Cache IP once so logSecurityEvent never makes an outbound fetch
    this._cachedIP = null;
    this._ipFetchPromise = null;
    this._warmupIP(); // fire-and-forget on construction
  }

  // ── IP caching — warm up once, never block auth ───────────────────────────

  _warmupIP() {
    if (this._ipFetchPromise) return this._ipFetchPromise;
    this._ipFetchPromise = fetch("https://api.ipify.org?format=json", {
      signal: AbortSignal.timeout(5000), // 5s max — never hang
    })
      .then((r) => r.json())
      .then((d) => {
        this._cachedIP = d.ip ?? "unknown";
      })
      .catch(() => {
        this._cachedIP = "unknown";
      })
      .finally(() => {
        this._ipFetchPromise = null;
      });
    return this._ipFetchPromise;
  }

  // Returns cached IP immediately — never awaits a network call
  _getIP() {
    return this._cachedIP ?? "unknown";
  }

  // ── Security settings ─────────────────────────────────────────────────────

  async getSecuritySettings(userId) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("require_2fa, security_level, password_changed_at")
        .eq("id", userId)
        .maybeSingle(); // FIX: was .single() — throws 406 if no row

      if (error) throw error;
      if (!data)
        return {
          twoFactorEnabled: false,
          securityLevel: 1,
          passwordChangedAt: null,
          require2FA: false,
        };

      const { data: twoFAData } = await supabase
        .from("two_factor_auth")
        .select("enabled")
        .eq("user_id", userId)
        .maybeSingle();

      return {
        twoFactorEnabled: twoFAData?.enabled || false,
        securityLevel: data.security_level || 1,
        passwordChangedAt: data.password_changed_at,
        require2FA: data.require_2fa || false,
      };
    } catch (error) {
      throw handleError(error, "Failed to fetch security settings");
    }
  }

  // ── Trusted devices ───────────────────────────────────────────────────────

  async getTrustedDevices(userId) {
    try {
      const { data, error } = await supabase
        .from("device_fingerprints")
        .select("*")
        .eq("user_id", userId)
        .eq("is_trusted", true)
        .order("last_seen", { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Failed to get trusted devices:", error);
      return [];
    }
  }

  async removeDevice(userId, deviceId) {
    try {
      const { error } = await supabase
        .from("device_fingerprints")
        .update({ is_trusted: false })
        .eq("id", deviceId)
        .eq("user_id", userId);

      if (error) throw error;

      await this.logSecurityEvent(userId, "device_untrusted", "info", {
        device_id: deviceId,
      });

      return { success: true };
    } catch (error) {
      throw handleError(error, "Failed to remove device");
    }
  }

  // ── Security events ───────────────────────────────────────────────────────

  async getRecentSecurityEvents(userId, limit = 10) {
    try {
      const { data, error } = await supabase
        .from("security_events")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Failed to get security events:", error);
      return [];
    }
  }

  /**
   * Log a security event.
   *
   * KEY FIX: IP is read from cache (_getIP) — synchronous, never awaits
   * an outbound fetch. This means logSecurityEvent can never block or
   * hang the OAuth callback flow.
   */
  async logSecurityEvent(userId, eventType, severity = "info", metadata = {}) {
    try {
      const { error } = await supabase.from("security_events").insert({
        user_id: userId,
        event_type: eventType,
        severity,
        ip_address: this._getIP(), // ← sync cache lookup, never hangs
        user_agent: navigator.userAgent,
        metadata,
        created_at: new Date().toISOString(),
      });

      if (error) throw error;
    } catch (error) {
      console.error("Failed to log security event:", error);
      // Non-critical — swallow silently
    }
  }

  // ── Device fingerprint ────────────────────────────────────────────────────

  async generateDeviceFingerprint() {
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width,
      screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency,
      navigator.deviceMemory,
    ];

    const fingerprint = components.join("|");

    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }

    return hash.toString(36);
  }

  // Kept for backwards compat — now returns cached value
  async getClientIP() {
    if (!this._cachedIP) await this._warmupIP();
    return this._cachedIP ?? "unknown";
  }

  // ── 2FA ───────────────────────────────────────────────────────────────────

  async enable2FA(userId) {
    try {
      const secret = this.generateSecret();

      const { data, error } = await supabase
        .from("two_factor_auth")
        .insert({
          user_id: userId,
          secret,
          enabled: false,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      await this.logSecurityEvent(userId, "2fa_enabled", "info");

      return {
        success: true,
        secret,
        qrCodeUrl: `otpauth://totp/Grova:${userId}?secret=${secret}&issuer=Grova`,
      };
    } catch (error) {
      throw handleError(error, "Failed to enable 2FA");
    }
  }

  async disable2FA(userId) {
    try {
      const { error } = await supabase
        .from("two_factor_auth")
        .update({ enabled: false })
        .eq("user_id", userId);

      if (error) throw error;

      await this.logSecurityEvent(userId, "2fa_disabled", "warning");
      return { success: true };
    } catch (error) {
      throw handleError(error, "Failed to disable 2FA");
    }
  }

  async verify2FACode(userId, code) {
    try {
      const { data, error } = await supabase
        .from("two_factor_auth")
        .select("secret")
        .eq("user_id", userId)
        .maybeSingle(); // FIX: was .single()

      if (error) throw error;
      if (!data) return { success: false };

      const isValid = this.verifyTOTP(data.secret, code);

      if (isValid) {
        await supabase
          .from("two_factor_auth")
          .update({ last_used: new Date().toISOString(), enabled: true })
          .eq("user_id", userId);

        await this.logSecurityEvent(userId, "2fa_verified", "info");
      } else {
        await this.logSecurityEvent(userId, "2fa_failed", "warning");
      }

      return { success: isValid };
    } catch (error) {
      throw handleError(error, "Failed to verify 2FA code");
    }
  }

  generateSecret(length = 32) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let secret = "";
    for (let i = 0; i < length; i++) {
      secret += chars[Math.floor(Math.random() * chars.length)];
    }
    return secret;
  }

  // Placeholder — replace with otpauth or speakeasy in production
  verifyTOTP(secret, code) {
    return code.length === 6 && /^\d+$/.test(code);
  }

  // ── Security level ────────────────────────────────────────────────────────

  async calculateSecurityLevel(userId) {
    try {
      let level = 1;

      const { data: twoFA } = await supabase
        .from("two_factor_auth")
        .select("enabled")
        .eq("user_id", userId)
        .maybeSingle(); // FIX: was .single()

      if (twoFA?.enabled) level += 2;

      const { data: profile } = await supabase
        .from("profiles")
        .select("password_changed_at")
        .eq("id", userId)
        .maybeSingle(); // FIX: was .single()

      if (profile?.password_changed_at) {
        const passwordAge =
          Date.now() - new Date(profile.password_changed_at).getTime();
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        if (passwordAge < thirtyDays) level += 1;
      }

      const { data: devices } = await supabase
        .from("device_fingerprints")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_trusted", true);

      if (devices && devices.count > 0) level += 1;

      level = Math.min(level, 5);

      await supabase
        .from("profiles")
        .update({ security_level: level })
        .eq("id", userId);

      return level;
    } catch (error) {
      console.error("Failed to calculate security level:", error);
      return 1;
    }
  }
}

export default new SecurityService();
