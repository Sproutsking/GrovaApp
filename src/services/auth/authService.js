// ============================================================================
// src/services/auth/authService.js  —  v8
// ============================================================================
//
// PROVIDERS SUPPORTED:
//   • Google   — OAuth 2.0 PKCE via Supabase  (provider key: "google")
//   • X        — OAuth 2.0 PKCE via Supabase  (provider key: "x")
//   • TikTok   — OAuth 2.0 PKCE via Supabase  (provider key: "tiktok")
//   • Discord  — OAuth 2.0 PKCE via Supabase  (provider key: "discord")
//   • Email    — 6-digit OTP via signInWithOtp
//
// SUPABASE DASHBOARD SETUP FOR NEW PROVIDERS:
//
//   TIKTOK:
//     developers.tiktok.com → App → Login Kit
//     Redirect URI: https://rxtijxlvacqjiocdwzrh.supabase.co/auth/v1/callback
//     In Supabase: Auth → Providers → TikTok → enable, paste Client Key + Secret
//
//   DISCORD:
//     discord.com/developers/applications → OAuth2 → Redirects
//     Add: https://rxtijxlvacqjiocdwzrh.supabase.co/auth/v1/callback
//     In Supabase: Auth → Providers → Discord → enable, paste Client ID + Secret
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
    if (!["google", "x", "tiktok", "discord"].includes(provider)) {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    const origin = window.location.origin.replace(/\/+$/, "");
    const redirectTo = `${origin}/`;
    const options = { redirectTo, skipBrowserRedirect: false };

    switch (provider) {
      case "google":
        options.queryParams = {
          access_type: "offline",
          prompt: "select_account",
        };
        break;

      case "x":
        // IMPORTANT: "x" is the correct key for X/Twitter OAuth 2.0 in Supabase JS v2.
        // "twitter" maps to the DEPRECATED OAuth 1.0a — do NOT use it.
        // Supabase dashboard: enable "X / Twitter (OAuth 2.0)", NOT "Twitter (Deprecated)"
        options.scopes = "tweet.read users.read";
        break;

      case "tiktok":
        // Supabase dashboard: Auth → Providers → TikTok
        // TikTok developer portal: developers.tiktok.com
        // Redirect URI: https://rxtijxlvacqjiocdwzrh.supabase.co/auth/v1/callback
        options.scopes = "user.info.basic";
        break;

      case "discord":
        // Supabase dashboard: Auth → Providers → Discord
        // Discord developer portal: discord.com/developers/applications
        // OAuth2 Redirect: https://rxtijxlvacqjiocdwzrh.supabase.co/auth/v1/callback
        options.scopes = "identify email";
        break;

      default:
        break;
    }

    const { error } = await supabase.auth.signInWithOAuth({ provider, options });
    if (error) throw error;
  }

  // ── Email OTP — send ──────────────────────────────────────────────────────
  async signInOTP(email) {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    });
    if (error) throw error;
  }

  // ── Email OTP — verify ────────────────────────────────────────────────────
  async verifyOTP(email, token) {
    const params = { email: email.trim().toLowerCase(), token: token.trim() };

    const { data, error } = await supabase.auth.verifyOtp({ ...params, type: "email" });
    if (!error) return data?.user ?? null;

    const { data: d2, error: e2 } = await supabase.auth.verifyOtp({ ...params, type: "magiclink" });
    if (!e2) return d2?.user ?? null;

    throw error;
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
      const { data } = await supabase.from("profiles").select("is_admin").eq("id", userId).maybeSingle();
      return data?.is_admin ? { role: "admin" } : null;
    } catch { return null; }
  }

  async adminHas2FA() { return false; }
}

const authService = new AuthService();
export default authService;