// ============================================================================
// src/services/auth/authService.js — v13 IRON-CLAD
// ============================================================================
//
// CHANGES FROM v12:
//   [1] signOut() now uses scope:"local" — only ends THIS device's session.
//       scope:"global" killed every session on every device simultaneously.
//       signOutAllDevices() is now a separate explicit method.
//   [2] Google OAuth gets access_type:"offline" — ensures a refresh token
//       is always issued. Without this, Google may not send a refresh token
//       on re-auth, resulting in a session that can't be silently refreshed.
//   [3] getCurrentUser() has a fallback to getSession() if getUser() fails,
//       so we always return whatever user data we can find.
// ============================================================================

import { supabase } from "../config/supabase";

class AuthService {
  async getSession() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session ?? null;
    } catch { return null; }
  }

  async getCurrentUser() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) return user;
      // Fallback: getSession uses cached data and doesn't require a server call
      const { data: { session } } = await supabase.auth.getSession();
      return session?.user ?? null;
    } catch {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        return session?.user ?? null;
      } catch { return null; }
    }
  }

  async signInOAuth(provider) {
    const supported = ["google", "x", "facebook", "tiktok", "discord"];
    if (!supported.includes(provider)) throw new Error(`Unsupported provider: ${provider}`);

    const redirectTo = `${window.location.origin}/auth/callback`;
    const options    = { redirectTo, skipBrowserRedirect: false };

    switch (provider) {
      case "google":
        // access_type:"offline" ensures a refresh token is always issued.
        // Without this, Google may not provide a refresh token on subsequent
        // sign-ins, which means sessions can't be silently refreshed.
        options.queryParams = { access_type: "offline", prompt: "select_account" };
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
    }

    const { error } = await supabase.auth.signInWithOAuth({ provider, options, flowType: "pkce" });
    if (error) throw error;
    return true;
  }

  async signInOTP(email) {
    const { error } = await supabase.auth.signInWithOtp({
      email:   email.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    });
    if (error) throw error;
  }

  async verifyOTP(email, token) {
    const params = { email: email.trim().toLowerCase(), token: token.trim() };
    const { data, error: err1 } = await supabase.auth.verifyOtp({ ...params, type: "email" });
    if (!err1) return data?.user ?? null;
    const { data: d2, error: err2 } = await supabase.auth.verifyOtp({ ...params, type: "magiclink" });
    if (!err2) return d2?.user ?? null;
    throw new Error(err1?.message || "OTP verification failed. Please request a new code.");
  }

  // ── Local sign-out — ends THIS device's session only ─────────────────────
  // This is what your Sign Out button should call. It does NOT affect sessions
  // on other devices (phone, laptop, tablet etc).
  async signOut() {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch (err) {
      console.warn("[AuthService] signOut error:", err?.message);
      // Manual cleanup as fallback
      try {
        const keys = Object.keys(localStorage).filter(k =>
          k.startsWith("sb-") || k.includes("supabase")
        );
        keys.forEach(k => localStorage.removeItem(k));
      } catch {}
    }
  }

  // ── Global sign-out — ends ALL sessions on ALL devices ───────────────────
  // Only call this from a deliberate "Sign out everywhere" settings action.
  // This invalidates the refresh token server-side, ending every session.
  async signOutAllDevices() {
    try {
      await supabase.auth.signOut({ scope: "global" });
    } catch (err) {
      console.warn("[AuthService] signOutAllDevices error:", err?.message);
      try { await supabase.auth.signOut({ scope: "local" }); } catch {}
    }
  }

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