// ============================================================================
// src/components/Auth/AuthContext.jsx — v9 PRODUCTION
// ============================================================================
//
// FIXES vs old version:
//   [1] Profile fetch has a hard 8s AbortController timeout — no more infinite
//       splash screen hangs.
//   [2] After 2 consecutive failures the context resolves cleanly so AppRouter
//       shows AuthWall instead of looping forever.
//   [3] bad_oauth_state / error_code query params are stripped from the URL on
//       mount so they don't re-trigger hasOAuthCodeInUrl() on refresh.
//   [4] Token refresh ERR_CONNECTION_TIMED_OUT is caught — session is cleared
//       and user is sent to AuthWall instead of spamming 9000+ errors.
//   [5] loadProfile does NOT have `profile` in its dependency array —
//       avoids stale closure re-render loops.
//   [6] onAuthStateChange deduplicates by user-id so focus/visibility events
//       don't trigger redundant profile fetches.
//   [7] profileLoading is set to false in ALL code paths (no eternal spinner).
// ============================================================================

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { supabase } from "../../services/config/supabase";

// ── Context ───────────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const PROFILE_TIMEOUT_MS = 8000;
const MAX_FETCH_FAILURES = 2;

// ── Helpers ───────────────────────────────────────────────────────────────────

function cleanOAuthParams() {
  try {
    const url  = new URL(window.location.href);
    const keys = [
      "code", "error", "error_code", "error_description",
      "state", "access_token", "refresh_token", "token_type", "expires_in",
    ];
    let dirty = false;
    keys.forEach((k) => {
      if (url.searchParams.has(k)) { url.searchParams.delete(k); dirty = true; }
    });
    if (dirty) window.history.replaceState({}, "", url.toString());
  } catch { /* never throw */ }
}

function isNetworkError(err) {
  if (!err) return false;
  const msg = String(err?.message || err).toLowerCase();
  return (
    msg.includes("timeout")         ||
    msg.includes("timed out")       ||
    msg.includes("aborted")         ||
    msg.includes("failed to fetch") ||
    msg.includes("networkerror")    ||
    msg.includes("err_connection")
  );
}

// ── Provider ──────────────────────────────────────────────────────────────────
export default function AuthProvider({ children }) {
  const [user,           setUser]           = useState(null);
  const [profile,        setProfile]        = useState(null);
  const [isAdmin,        setIsAdmin]        = useState(false);
  const [adminData,      setAdminData]      = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  // Refs — never cause re-renders, safe inside all callbacks
  const lastFetchedUserId = useRef(null);
  const fetchFailCount    = useRef(0);
  const isMounted         = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // ── Strip OAuth error params on first mount ───────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("error_code") || params.has("error") || params.has("code")) {
      cleanOAuthParams();
    }
  }, []);

  // ── Core profile loader ───────────────────────────────────────────────────
  // IMPORTANT: empty deps array is intentional. This function only writes to
  // state setters and refs — both stable — so it never needs to be recreated.
  // Adding `profile` to deps would create a stale-closure re-render loop.
  const loadProfile = useCallback(async (userId) => {
    if (!userId || !isMounted.current) return;

    // Skip if already successfully fetched for this exact user id
    if (lastFetchedUserId.current === userId) return;

    // Hard stop after too many consecutive failures
    if (fetchFailCount.current >= MAX_FETCH_FAILURES) {
      console.warn("[AuthContext] Max profile fetch failures — bailing out");
      if (isMounted.current) setProfileLoading(false);
      return;
    }

    setProfileLoading(true);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROFILE_TIMEOUT_MS);

    try {
      let query = supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      // .abortSignal() exists in supabase-js v2.x — safe to call
      if (typeof query.abortSignal === "function") {
        query = query.abortSignal(controller.signal);
      }

      const { data, error } = await query;

      clearTimeout(timer);
      if (!isMounted.current) return;

      if (error) throw error;

      // ── Success ──────────────────────────────────────────────────────────
      setProfile(data || null);
      fetchFailCount.current    = 0;
      lastFetchedUserId.current = userId;

      if (data) {
        const adminFlag =
          data.is_admin || data.role === "admin" || data.is_super_admin;
        setIsAdmin(!!adminFlag);
        setAdminData(
          adminFlag
            ? { id: data.id, role: data.role || "admin", permissions: data.permissions || [] }
            : null,
        );
      } else {
        // Profile row doesn't exist yet (brand-new OAuth user) — not a failure
        setIsAdmin(false);
        setAdminData(null);
      }
    } catch (err) {
      clearTimeout(timer);
      if (!isMounted.current) return;

      fetchFailCount.current += 1;
      const kind = isNetworkError(err) ? "timeout/network" : "error";
      console.warn(`[AuthContext] profile fetch: ${kind} (attempt ${fetchFailCount.current})`, err?.message || err);

      if (fetchFailCount.current >= MAX_FETCH_FAILURES) {
        // Give up — AppRouter will render AuthWall
        console.warn("[AuthContext] Giving up profile fetch — resolving with null");
        setProfile(null);
        // Mark userId as "done" so we don't hammer Supabase on every re-render
        lastFetchedUserId.current = userId;
      }
    } finally {
      clearTimeout(timer);
      if (isMounted.current) setProfileLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auth state subscription ───────────────────────────────────────────────
  useEffect(() => {
    let resolved = false;
    const resolve = () => {
      if (!resolved) {
        resolved = true;
        if (isMounted.current) setLoading(false);
      }
    };

    // Read existing session first (handles hard refresh / page reload)
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!isMounted.current) { resolve(); return; }

      if (error) {
        if (isNetworkError(error)) {
          console.warn("[AuthContext] getSession network error — clearing session");
          supabase.auth.signOut().catch(() => {});
        }
        setUser(null);
        setProfile(null);
        resolve();
        return;
      }

      if (session?.user) {
        setUser(session.user);
        loadProfile(session.user.id);
      }
      resolve();
    });

    // Subscribe to future auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted.current) return;

        // ── Signed out ───────────────────────────────────────────────────
        if (event === "SIGNED_OUT" || !session) {
          setUser(null);
          setProfile(null);
          setIsAdmin(false);
          setAdminData(null);
          lastFetchedUserId.current = null;
          fetchFailCount.current    = 0;
          resolve();
          return;
        }

        // ── Token silently refreshed ─────────────────────────────────────
        // Don't re-fetch profile — just update the user object and move on
        if (event === "TOKEN_REFRESHED") {
          if (session?.user) setUser(session.user);
          resolve();
          return;
        }

        // ── Signed in / user updated ─────────────────────────────────────
        if (session?.user) {
          setUser(session.user);
          // Only fetch profile if this is a new user — prevents duplicate
          // fetches on browser focus / visibility change events
          if (session.user.id !== lastFetchedUserId.current) {
            fetchFailCount.current = 0;
            loadProfile(session.user.id);
          }
          resolve();
        }
      },
    );

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  // ── Sign-out helper ───────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("[AuthContext] signOut error:", err?.message);
    }
    if (isMounted.current) {
      setUser(null);
      setProfile(null);
      setIsAdmin(false);
      setAdminData(null);
    }
    lastFetchedUserId.current = null;
    fetchFailCount.current    = 0;
  }, []);

  // ── Force refresh profile (called after avatar / username edit) ──────────
  const refreshProfile = useCallback(async () => {
    if (!user?.id) return;
    lastFetchedUserId.current = null; // force re-fetch
    fetchFailCount.current    = 0;
    await loadProfile(user.id);
  }, [user?.id, loadProfile]);

  const value = {
    user,
    profile,
    isAdmin,
    adminData,
    loading,
    profileLoading,
    signOut,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}