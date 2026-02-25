// ============================================================================
// src/components/Auth/AuthContext.jsx — v13 IRONCLAD
// ============================================================================
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │  SYSTEM 1 OF 3: AUTH LAYER — IMMUTABLE, ISOLATED, UNBREAKABLE          │
// │                                                                         │
// │  Source of truth for: user, profile, isAdmin, adminData, loading       │
// │                                                                         │
// │  NOTHING outside this file writes to auth state.                       │
// │  App sections read it. They never mutate it.                           │
// │  Admin dashboard reads adminData as a prop. It never writes back.      │
// └─────────────────────────────────────────────────────────────────────────┘
//
// KEY FIXES IN v13:
//   1. TIMEOUT GUARD — All DB fetches have a 8s timeout. A hung Supabase
//      query (e.g. recursive RLS mid-fix) can never trap the user on the
//      loading screen forever. On timeout: user stays authenticated,
//      profile is null, retry happens on next auth event.
//
//   2. ADMIN FETCH ISOLATION — fetchAdminRecord() is wrapped in its own
//      try/catch with timeout. If admin_team is broken (recursive RLS),
//      the user still logs in normally. isAdmin = false until fixed.
//      Auth NEVER crashes because of a broken admin table.
//
//   3. LOADING STATE GUARANTEE — profileLoading ALWAYS resolves within
//      MAX_LOAD_MS (10 seconds), even if every DB call fails. Users never
//      get trapped on the splash screen.
//
//   4. RACE CONDITION FIX — lastLoadedUserId ref prevents duplicate fetches
//      when INITIAL_SESSION and SIGNED_IN both fire for the same user.
//
//   5. NO SIGN-OUT ON ERROR — Network drops, DB errors, timeouts, 500s
//      NEVER trigger sign-out. Session is preserved unconditionally.
//
// ROLE RESOLUTION ORDER (unchanged from v12 — working correctly):
//   1. admin_team record found → use role verbatim (preserves ceo_owner)
//   2. No team record + profiles.is_admin = true → role = 'admin' (fallback)
//   3. Neither → not admin
// ============================================================================

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { supabase } from "../../services/config/supabase";

// ── Constants ─────────────────────────────────────────────────────────────────
const FETCH_TIMEOUT_MS = 8_000; // Max time for any single DB query
const MAX_LOAD_MS = 10_000; // Absolute max time before loading clears

// ── Context ───────────────────────────────────────────────────────────────────
const AuthContext = createContext({
  user: null,
  profile: null,
  isAdmin: false,
  adminData: null,
  loading: true,
  profileLoading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

// ── Timeout wrapper ───────────────────────────────────────────────────────────
// Wraps any promise with a timeout. On timeout, resolves to `fallback`
// rather than throwing — this keeps the auth flow moving no matter what.
function withTimeout(promise, ms = FETCH_TIMEOUT_MS, fallback = null) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

// ── DB helpers ────────────────────────────────────────────────────────────────

/**
 * Fetch the user's profile row with timeout protection.
 * Returns null on any error or timeout — never throws.
 */
async function fetchProfile(userId) {
  try {
    const result = await withTimeout(
      supabase
        .from("profiles")
        .select(
          [
            "id",
            "full_name",
            "username",
            "avatar_id",
            "avatar_metadata",
            "verified",
            "is_pro",
            "account_activated",
            "is_admin",
            "payment_status",
            "subscription_tier",
            "account_status",
            "email",
            "engagement_points",
            "deactivated_reason",
          ].join(","),
        )
        .eq("id", userId)
        .maybeSingle(),
      FETCH_TIMEOUT_MS,
      { data: null, error: new Error("timeout") },
    );

    if (result?.error) {
      console.warn("[AuthContext] profile fetch:", result.error.message);
      return null;
    }
    return result?.data ?? null;
  } catch (e) {
    console.warn("[AuthContext] profile fetch exception:", e?.message);
    return null;
  }
}

/**
 * Fetch the admin_team record for this user.
 * COMPLETELY ISOLATED — if admin_team has ANY issue (RLS recursion, 500,
 * network error, timeout), this returns null silently.
 * Auth NEVER fails because of a broken admin table.
 */
async function fetchAdminRecord(userId) {
  try {
    const result = await withTimeout(
      supabase
        .from("admin_team")
        .select("id,user_id,role,permissions,status,email,full_name,xa_id")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      FETCH_TIMEOUT_MS,
      { data: null, error: new Error("timeout") },
    );

    if (result?.error) {
      // Log but NEVER propagate — admin fetch failure is non-fatal
      const msg = result.error.message || "";
      if (msg.includes("infinite recursion")) {
        console.warn(
          "[AuthContext] admin_team RLS recursion detected — " +
            "apply fix_rls_policies.sql in Supabase dashboard. " +
            "User will log in without admin privileges until fixed.",
        );
      } else if (!msg.includes("timeout")) {
        console.warn("[AuthContext] admin_team fetch:", msg);
      }
      return null;
    }
    return result?.data ?? null;
  } catch (e) {
    console.warn("[AuthContext] admin_team fetch exception:", e?.message);
    return null;
  }
}

// ── Clean OAuth URL params ────────────────────────────────────────────────────
function cleanOAuthUrl() {
  try {
    const url = new URL(window.location.href);
    const hasOAuth =
      url.searchParams.has("code") || url.searchParams.has("state");
    if (!hasOAuth) return;
    url.searchParams.delete("code");
    url.searchParams.delete("state");
    url.searchParams.delete("error");
    url.searchParams.delete("error_description");
    window.history.replaceState(
      {},
      "",
      url.pathname +
        (url.search && url.search !== "?" ? url.search : "") +
        url.hash,
    );
  } catch {
    // Non-critical
  }
}

// ── Build adminData object ────────────────────────────────────────────────────
function buildAdminData(authUser, profile, adminRecord) {
  const hasTeamRecord = !!adminRecord;
  const isFlaggedAdmin = profile?.is_admin === true;

  if (!hasTeamRecord && !isFlaggedAdmin) return null;

  return {
    user_id: authUser.id,
    role: adminRecord?.role ?? "admin", // NEVER default to a_admin
    permissions: adminRecord?.permissions ?? ["all"],
    email: adminRecord?.email ?? authUser.email ?? "",
    full_name: adminRecord?.full_name ?? profile?.full_name ?? "Admin",
    xa_id: adminRecord?.xa_id ?? null,
    has_team_record: hasTeamRecord,
  };
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminData, setAdminData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);

  const mounted = useRef(true);
  const initialized = useRef(false);
  const lastLoadedUserId = useRef(null);
  const loadingTimeout = useRef(null);

  useEffect(() => {
    mounted.current = true;

    // ABSOLUTE SAFETY NET: If loading is still true after MAX_LOAD_MS,
    // force-clear it. Users are NEVER trapped on splash indefinitely.
    loadingTimeout.current = setTimeout(() => {
      if (mounted.current && (loading || profileLoading)) {
        console.warn("[AuthContext] Loading timeout hit — forcing clear");
        setLoading(false);
        setProfileLoading(false);
      }
    }, MAX_LOAD_MS);

    return () => {
      mounted.current = false;
      clearTimeout(loadingTimeout.current);
    };
  }, []); // eslint-disable-line

  // ── Core loader ─────────────────────────────────────────────────────────────
  const loadUser = useCallback(async (authUser, force = false) => {
    if (!authUser?.id || !mounted.current) return;
    if (!force && lastLoadedUserId.current === authUser.id) return;

    if (mounted.current) setProfileLoading(true);

    try {
      // Always fetch profile and admin record in parallel with timeout protection
      // If admin_team is broken, adminRecord = null, user still logs in normally
      const [p, a] = await Promise.all([
        fetchProfile(authUser.id),
        fetchAdminRecord(authUser.id),
      ]);

      if (!mounted.current) return;

      lastLoadedUserId.current = authUser.id;

      const isAdminUser = !!a || p?.is_admin === true;
      const ad = buildAdminData(authUser, p, a);

      setUser(authUser);
      setProfile(p);
      setIsAdmin(isAdminUser);
      setAdminData(ad);
    } catch (err) {
      // This catch should rarely fire because fetchProfile/fetchAdminRecord
      // both have their own try/catch. Belt-and-suspenders.
      console.warn("[AuthContext] loadUser unexpected error:", err?.message);
      if (mounted.current) {
        // Keep user authenticated — NEVER sign out on error
        setUser(authUser);
        setProfile(null);
        setIsAdmin(false);
        setAdminData(null);
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
        setProfileLoading(false);
        clearTimeout(loadingTimeout.current);
      }
    }
  }, []); // eslint-disable-line

  const clearUser = useCallback(() => {
    if (!mounted.current) return;
    lastLoadedUserId.current = null;
    clearTimeout(loadingTimeout.current);
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
    setAdminData(null);
    setLoading(false);
    setProfileLoading(false);
  }, []);

  // ── Auth state listener ─────────────────────────────────────────────────────
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted.current) return;

      switch (event) {
        case "INITIAL_SESSION":
          if (session?.user) await loadUser(session.user);
          else clearUser();
          break;

        case "SIGNED_IN":
          cleanOAuthUrl();
          if (session?.user) await loadUser(session.user, true);
          break;

        case "SIGNED_OUT":
          clearUser();
          break;

        case "TOKEN_REFRESHED":
          if (session?.user && mounted.current) {
            setUser(session.user);
            await loadUser(session.user, true);
          }
          break;

        case "USER_UPDATED":
          if (session?.user) await loadUser(session.user, true);
          break;

        default:
          break;
      }
    });

    // Fallback in case INITIAL_SESSION doesn't fire
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!mounted.current) return;
        if (session?.user) {
          loadUser(session.user);
        } else {
          clearUser();
        }
      })
      .catch(() => {
        if (mounted.current) clearUser();
      });

    return () => {
      try {
        subscription?.unsubscribe();
      } catch {
        /* silent */
      }
    };
  }, []); // eslint-disable-line

  // ── signOut ─────────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      try {
        localStorage.removeItem("xeevia-auth-token");
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        clearUser();
      }
    }
  }, [clearUser]);

  // ── refreshProfile ──────────────────────────────────────────────────────────
  const refreshProfile = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [p, a] = await Promise.all([
        fetchProfile(user.id),
        fetchAdminRecord(user.id),
      ]);
      if (!mounted.current) return;
      const isAdminUser = !!a || p?.is_admin === true;
      const ad = buildAdminData(user, p, a);
      setProfile(p);
      setIsAdmin(isAdminUser);
      setAdminData(ad);
    } catch (err) {
      console.warn("[AuthContext] refreshProfile error:", err?.message);
      // Keep last known good state — never clear on refresh error
    }
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isAdmin,
        adminData,
        loading,
        profileLoading,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;
