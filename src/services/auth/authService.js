// ============================================================================
// src/services/auth/authService.js — v11 FORTRESS FINAL
// ============================================================================
//
// ARCHITECTURE CONTRACT:
//   • ONLY file that calls supabase.auth.* outside AuthContext.
//   • Components get auth state ONLY via useAuth() from AuthContext.
//   • ensureFreshSession() NEVER throws. NEVER signs user out.
//   • All OAuth providers use PKCE flow.
//   • getAuthHeaders() always ensures fresh token before returning.
//
// USAGE PATTERN — before ANY sensitive DB call:
//   await authService.ensureFreshSession();
//   const { data } = await supabase.from("payments")...
//
// ============================================================================

import { supabase } from "../config/supabase";

class AuthService {
  constructor() {
    this._refreshPromise = null; // Deduplicate concurrent refreshes
  }

  // ── Session management ────────────────────────────────────────────────────

  async getSession() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      return session ?? null;
    } catch {
      return null;
    }
  }

  async getCurrentUser() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user ?? null;
    } catch {
      return null;
    }
  }

  /**
   * ensureFreshSession — guarantees a valid, non-expired JWT before DB ops.
   *
   * Strategy:
   *   1. Get current session.
   *   2. If token expires within 2 minutes, refresh proactively.
   *      Only ONE refresh in-flight at a time (deduped via _refreshPromise).
   *   3. Return fresh or existing session.
   *   4. On ANY error: return current session or null. NEVER sign out.
   *
   * Safe to call before every payment, wallet, admin, or sensitive DB op.
   */
  async ensureFreshSession() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return null;

      const nowSecs = Math.floor(Date.now() / 1000);
      const secsLeft = (session.expires_at ?? 0) - nowSecs;
      const BUFFER = 120; // 2 minutes

      if (secsLeft < BUFFER) {
        if (!this._refreshPromise) {
          this._refreshPromise = supabase.auth
            .refreshSession()
            .then(({ data: { session: fresh }, error }) => {
              this._refreshPromise = null;
              if (!error && fresh) return fresh;
              return session; // Fallback to current
            })
            .catch(() => {
              this._refreshPromise = null;
              return session; // Never fail
            });
        }
        return await this._refreshPromise;
      }

      return session;
    } catch (e) {
      console.warn("[authService] ensureFreshSession:", e?.message);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        return session ?? null;
      } catch {
        return null;
      }
    }
  }

  /**
   * getAuthHeaders — returns Authorization header for direct API calls.
   * Always ensures a fresh token first.
   */
  async getAuthHeaders() {
    const session = await this.ensureFreshSession();
    if (!session?.access_token) return {};
    return { Authorization: `Bearer ${session.access_token}` };
  }

  // ── Social OAuth ──────────────────────────────────────────────────────────

  async signInOAuth(provider) {
    const supported = ["google", "x", "facebook", "discord"];
    if (!supported.includes(provider)) {
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
        options.scopes = "tweet.read users.read";
        break;
      case "facebook":
        options.scopes = "email public_profile";
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
    });
    if (error) throw error;
  }

  // ── Sign out ──────────────────────────────────────────────────────────────

  async signOut() {
    try {
      await supabase.auth.signOut();
    } catch {
      try {
        Object.keys(localStorage)
          .filter((k) => k.includes("supabase") || k.includes("xeevia"))
          .forEach((k) => localStorage.removeItem(k));
        await supabase.auth.signOut({ scope: "local" });
      } catch {}
    }
  }

  // ── Admin helpers ─────────────────────────────────────────────────────────

  async checkAdminStatus(userId) {
    if (!userId) return null;
    try {
      await this.ensureFreshSession();
      const { data } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", userId)
        .maybeSingle();
      return data?.is_admin ? { role: "admin" } : null;
    } catch {
      return null;
    }
  }
}

const authService = new AuthService();
export default authService;
