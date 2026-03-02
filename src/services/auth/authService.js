// ============================================================================
// src/services/auth/authService.js — v10 PKCE-FLOW
// ============================================================================
//
// CHANGES FROM v9:
//   [A] Added flowType: "pkce" to signInOAuth() for all providers.
//       This switches from implicit (hash #access_token=) to PKCE (?code=).
//       PKCE is more secure and avoids hash timing races.
//   [B] Removed prompt: "select_account" from Google options.
//       This avoids forcing the account chooser every time (only shows if needed).
//   [C] redirectTo now explicitly uses "/auth/callback" for PKCE exchange.
//   [D] All other logic unchanged.
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

    // PKCE callback route — exchange happens there
    const redirectTo = `${window.location.origin}/auth/callback`;

    const options = {
      redirectTo,
      skipBrowserRedirect: false,
    };

    switch (provider) {
      case "google":
        options.queryParams = {
          access_type: "offline",
          // Removed prompt: "select_account" — avoids forcing chooser every time
        };
        break;

      case "x":
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

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options,
      flowType: "pkce",  // Explicit PKCE — fixes implicit hash loop
    });
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