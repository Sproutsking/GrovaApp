// ============================================================================
// src/services/auth/authService.js — v9 WATER-FLOW
// ============================================================================
//
// WHAT CHANGED vs v8:
//   [A] Added "facebook" to supported OAuth providers. AuthWall.jsx already
//       renders a Facebook button — this was causing a silent failure.
//   [B] redirectTo now always points to the app's origin root ("/") with no
//       trailing slash variance. This matches the Supabase Site URL exactly.
//   [C] signInOAuth now returns a boolean success indicator so callers can
//       distinguish between "redirect initiated" and "error thrown".
//   [D] verifyOTP tries both "email" and "magiclink" types (unchanged) but
//       now rethrows the first error if both fail, with a clearer message.
// ============================================================================

import { supabase } from "../config/supabase";

class AuthService {
  // ── Session ────────────────────────────────────────────────────────────────

  async getSession() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session ?? null;
    } catch { return null; }
  }

  async getCurrentUser() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      return user ?? null;
    } catch { return null; }
  }

  // ── Social OAuth ───────────────────────────────────────────────────────────
  async signInOAuth(provider) {
    const supported = ["google", "x", "facebook", "tiktok", "discord"];
    if (!supported.includes(provider)) {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    // Always redirect to the clean origin root — matches Supabase Site URL
    const redirectTo = `${window.location.origin}/`;

    const options = { redirectTo, skipBrowserRedirect: false };

    switch (provider) {
      case "google":
        options.queryParams = {
          access_type: "offline",
          prompt:      "select_account",
        };
        break;

      case "x":
        // "x" = OAuth 2.0. "twitter" = deprecated OAuth 1.0a — NEVER use twitter.
        options.scopes = "tweet.read users.read";
        break;

      case "facebook":
        options.scopes = "email,public_profile";
        break;

      case "tiktok":
        options.scopes = "user.info.basic";
        break;

      case "discord":
        options.scopes = "identify email";
        break;

      default:
        break;
    }

    const { error } = await supabase.auth.signInWithOAuth({ provider, options });
    if (error) throw error;
    return true;
  }

  // ── Email OTP — send ──────────────────────────────────────────────────────
  async signInOTP(email) {
    const { error } = await supabase.auth.signInWithOtp({
      email:   email.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    });
    if (error) throw error;
  }

  // ── Email OTP — verify ────────────────────────────────────────────────────
  async verifyOTP(email, token) {
    const params = { email: email.trim().toLowerCase(), token: token.trim() };

    const { data, error: err1 } = await supabase.auth.verifyOtp({
      ...params, type: "email",
    });
    if (!err1) return data?.user ?? null;

    const { data: d2, error: err2 } = await supabase.auth.verifyOtp({
      ...params, type: "magiclink",
    });
    if (!err2) return d2?.user ?? null;

    // Both failed — throw a clear message
    throw new Error(err1?.message || "OTP verification failed. Please request a new code.");
  }

  // ── Sign out ──────────────────────────────────────────────────────────────
  async signOut() {
    try {
      await supabase.auth.signOut();
    } catch {
      try {
        localStorage.removeItem("xeevia-auth-token");
        await supabase.auth.signOut({ scope: "local" });
      } catch {}
    }
  }

  // ── Admin helpers ─────────────────────────────────────────────────────────
  async checkAdminStatus(userId) {
    if (!userId) return null;
    try {
      const { data } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", userId)
        .maybeSingle();
      return data?.is_admin ? { role: "admin" } : null;
    } catch { return null; }
  }

  async adminHas2FA() { return false; }
}

const authService = new AuthService();
export default authService;