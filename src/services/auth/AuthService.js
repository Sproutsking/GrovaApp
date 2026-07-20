// AuthService: singleton wrapper around the Supabase client

import { supabase, createIsolatedClient } from "../config/supabase";

class AuthService {
  constructor() {
    this.supabase = supabase;
    this._initialized = true;
    this._authListener = null;
  }

  init() {
    // noop for now — singleton is initialized by import
    this._initialized = true;
  }

  getClient() {
    return this.supabase;
  }

  async getSession() {
    try {
      const { data } = await this.supabase.auth.getSession();
      return data?.session || null;
    } catch (err) {
      console.warn("[AuthService] getSession error:", err?.message || err);
      return null;
    }
  }

  onAuthStateChange(callback) {
    if (this._authListener) this._authListener.unsubscribe();
    this._authListener = this.supabase.auth.onAuthStateChange((event, session) => {
      try {
        callback(event, session);
      } catch (e) {
        console.warn("[AuthService] onAuthStateChange callback error:", e?.message || e);
      }
    });
    return this._authListener;
  }

  async signOut(scope = "local") {
    try {
      await this.supabase.auth.signOut({ scope });
      return true;
    } catch (err) {
      console.warn("[AuthService] signOut error:", err?.message || err);
      return false;
    }
  }

  // Call server-side RPC that returns authoritative profile + enforcement flags
  async getProfile(pUserId) {
    try {
      if (!pUserId) {
        // try session user
        const s = await this.getSession();
        pUserId = s?.user?.id;
      }
      if (!pUserId) return null;

      const res = await this.supabase.rpc("get_session_profile", { p_user_id: pUserId });
      if (res?.error) {
        // If RPC not deployed, fall back to reading profiles table but WARN
        console.warn("[AuthService] get_session_profile RPC error:", res.error.message || res.error);
        const { data, error } = await this.supabase.from("profiles").select("*").eq("id", pUserId).maybeSingle();
        if (error) {
          console.warn("[AuthService] fallback profiles read error:", error.message || error);
          return null;
        }
        return data || null;
      }

      // supabase.rpc returns { data, error } sometimes; handle both shapes
      const data = res?.data ?? res;
      return data || null;
    } catch (err) {
      console.warn("[AuthService] getProfile error:", err?.message || err);
      return null;
    }
  }

  // Utility: create an isolated client for server-only work
  createIsolated(url, key, opts = {}) {
    return createIsolatedClient(url, key, opts);
  }
}

const instance = new AuthService();
export default instance;
export const authService = instance;
