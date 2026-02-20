// ============================================================================
// src/services/auth/authService.js — v11 FINAL
//
// PRINCIPLES:
//   • signOut() is the only method that touches session state directly
//   • No AbortController on auth calls (breaks PKCE navigator.locks)
//   • checkAdminStatus() is single source of truth for admin detection
//   • All methods return { success, data?, error? } — never throw to caller
// ============================================================================

import { supabase } from "../config/supabase";

class AuthService {
  async signOut() {
    try {
      await supabase.auth.signOut();
    } catch {
      try {
        localStorage.removeItem("xeevia-auth-token");
        await supabase.auth.signOut({ scope: "local" });
      } catch {}
    }
    return { success: true };
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

  // Returns admin row or null
  async checkAdminStatus(userId) {
    if (!userId) return null;
    try {
      const { data } = await supabase
        .from("admin_team")
        .select("role,status,permissions,full_name,email,user_id")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();
      return data ?? null;
    } catch {
      return null;
    }
  }

  async resetPassword(email) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.toLowerCase().trim(),
        { redirectTo: `${window.location.origin}/auth/callback?type=recovery` },
      );
      if (error) throw error;
      return { success: true };
    } catch (err) {
      return { success: false, error: err?.message };
    }
  }

  async updatePassword(newPassword) {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      return { success: true };
    } catch (err) {
      return { success: false, error: err?.message };
    }
  }

  async updateEmail(newEmail) {
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      return { success: true };
    } catch (err) {
      return { success: false, error: err?.message };
    }
  }
}

const authService = new AuthService();
export default authService;
