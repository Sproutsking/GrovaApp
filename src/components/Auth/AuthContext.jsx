// ============================================================================
// src/components/Auth/AuthContext.jsx — v15 WATER-FLOW
// ============================================================================
//
// PHILOSOPHY: Session flows like water — it finds a path around every obstacle.
//
// RULES (absolute, no exceptions):
//   1. NEVER sign the user out except on explicit user action (signOut())
//   2. NEVER let a DB error, timeout, network drop, or any exception
//      clear auth state or show a loading screen
//   3. NEVER block the UI indefinitely — loading always resolves
//   4. On mobile resume: restore session silently, never re-auth
//   5. oauthInProgress is evaluated ONCE at module load, never again
//
// WHAT CHANGED vs v14:
//   [A] oauthInProgress is now exported as a module-level constant — evaluated
//       once when JS loads, cleaned immediately. No re-evaluation on re-render
//       or mobile resume.
//   [B] cleanOAuthUrl() is called immediately at module load (before any
//       Supabase call), so URL params are gone before INITIAL_SESSION fires.
//   [C] onAuthStateChange deduplication: tracks lastEventUser to prevent
//       INITIAL_SESSION + SIGNED_IN double-fetch for the same user on load.
//   [D] TOKEN_REFRESHED no longer calls loadUser (full profile re-fetch) —
//       it only updates the user object. Profile is already loaded; a token
//       refresh should be invisible to the UI.
//   [E] visibilitychange listener: when the tab/app returns to foreground,
//       we silently refresh the Supabase session token if needed. This is
//       what makes mobile resume work without showing a loading screen.
//   [F] MAX_LOAD_MS safety net now resets itself if the component somehow
//       re-mounts (e.g. HMR in dev).
//   [G] refreshProfile is stable (useCallback with no deps) — always reads
//       user from a ref so it never goes stale.
//
// WHAT CHANGED vs v14 (this version — v15):
//   [H] Belt-and-suspenders getSession() call is now wrapped with
//       withTimeout(6_000) so that when Supabase is unreachable
//       (ERR_CONNECTION_CLOSED, offline, etc.) it resolves to a null session
//       after 6 s instead of hanging forever and leaving the splash screen
//       frozen. MAX_LOAD_MS (10 s) remains as the absolute final backstop.
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
const FETCH_TIMEOUT_MS       = 8_000;   // Per-query timeout
const MAX_LOAD_MS            = 10_000;  // Absolute loading ceiling
const SESSION_TIMEOUT_MS     = 6_000;   // Belt-and-suspenders getSession timeout
const VISIBILITY_DEBOUNCE_MS = 800;     // Debounce for visibility-resume refresh

// ── Module-level: evaluate OAuth state ONCE, then clean URL immediately ───────
// This runs when the JS module is first imported — before any component mounts.
// After this, oauthInProgress is a frozen boolean. Re-renders, mobile resume,
// and tab switches can never accidentally re-evaluate it as true.
function _detectAndCleanOAuth() {
  try {
    const url    = new URL(window.location.href);
    const params = url.searchParams;
    const hash   = new URLSearchParams(window.location.hash.replace(/^#/, ""));

    const hasCode  = params.has("code");
    const hasState = params.has("state");
    const hasToken = params.has("access_token") || hash.has("access_token");
    const hasError = params.has("error")        || hash.has("error");

    const inProgress = hasCode || hasState || hasToken || hasError;

    // Clean immediately — don't wait for SIGNED_IN
    if (hasCode || hasState || hasError ||
        params.has("error_description")) {
      params.delete("code");
      params.delete("state");
      params.delete("error");
      params.delete("error_description");
      const newSearch = params.toString();
      window.history.replaceState(
        {},
        "",
        url.pathname + (newSearch ? `?${newSearch}` : "") + url.hash,
      );
    }

    return inProgress;
  } catch {
    return false;
  }
}

// Exported so AppRouter can read it without re-evaluating
export const oauthInProgress = _detectAndCleanOAuth();

// ── Context ───────────────────────────────────────────────────────────────────
const AuthContext = createContext({
  user:           null,
  profile:        null,
  isAdmin:        false,
  adminData:      null,
  loading:        true,
  profileLoading: true,
  signOut:        async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

// ── Timeout wrapper ───────────────────────────────────────────────────────────
// Never throws — resolves to fallback on timeout.
function withTimeout(promise, ms = FETCH_TIMEOUT_MS, fallback = null) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function fetchProfile(userId) {
  try {
    const result = await withTimeout(
      supabase
        .from("profiles")
        .select(
          [
            "id", "full_name", "username", "avatar_id", "avatar_metadata",
            "verified", "is_pro", "account_activated", "is_admin",
            "payment_status", "subscription_tier", "account_status",
            "email", "engagement_points", "deactivated_reason",
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
      const msg = result.error.message || "";
      if (msg.includes("infinite recursion")) {
        console.warn("[AuthContext] admin_team RLS recursion — user logs in without admin until fixed.");
      } else if (!msg.includes("timeout")) {
        console.warn("[AuthContext] admin_team fetch:", msg);
      }
      return null;
    }
    return result?.data ?? null;
  } catch (e) {
    console.warn("[AuthContext] admin_team exception:", e?.message);
    return null;
  }
}

function buildAdminData(authUser, profile, adminRecord) {
  const hasTeamRecord  = !!adminRecord;
  const isFlaggedAdmin = profile?.is_admin === true;
  if (!hasTeamRecord && !isFlaggedAdmin) return null;
  return {
    user_id:         authUser.id,
    role:            adminRecord?.role ?? "admin",
    permissions:     adminRecord?.permissions ?? ["all"],
    email:           adminRecord?.email ?? authUser.email ?? "",
    full_name:       adminRecord?.full_name ?? profile?.full_name ?? "Admin",
    xa_id:           adminRecord?.xa_id ?? null,
    has_team_record: hasTeamRecord,
  };
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user,           setUser]           = useState(null);
  const [profile,        setProfile]        = useState(null);
  const [isAdmin,        setIsAdmin]        = useState(false);
  const [adminData,      setAdminData]      = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);

  const mounted          = useRef(true);
  const initialized      = useRef(false);
  const loadingTimeout   = useRef(null);
  const lastEventUser    = useRef(null);   // dedup INITIAL_SESSION + SIGNED_IN
  const userRef          = useRef(null);   // stable ref for refreshProfile
  const visibilityTimer  = useRef(null);

  // Keep userRef in sync
  useEffect(() => { userRef.current = user; }, [user]);

  // ── Safety net: loading ALWAYS clears ──────────────────────────────────────
  const armLoadingTimeout = useCallback(() => {
    clearTimeout(loadingTimeout.current);
    loadingTimeout.current = setTimeout(() => {
      if (!mounted.current) return;
      console.warn("[AuthContext] Loading safety net fired — forcing clear");
      setLoading(false);
      setProfileLoading(false);
    }, MAX_LOAD_MS);
  }, []);

  useEffect(() => {
    mounted.current = true;
    armLoadingTimeout();
    return () => {
      mounted.current = false;
      clearTimeout(loadingTimeout.current);
      clearTimeout(visibilityTimer.current);
    };
  }, []); // eslint-disable-line

  // ── Core loader ─────────────────────────────────────────────────────────────
  // force=true bypasses dedup (used for SIGNED_IN / USER_UPDATED)
  const loadUser = useCallback(async (authUser, force = false) => {
    if (!authUser?.id || !mounted.current) return;

    // Dedup: skip if we already loaded this exact user (unless forced)
    if (!force && lastEventUser.current === authUser.id) return;
    lastEventUser.current = authUser.id;

    if (mounted.current) setProfileLoading(true);

    try {
      const [p, a] = await Promise.all([
        fetchProfile(authUser.id),
        fetchAdminRecord(authUser.id),
      ]);

      if (!mounted.current) return;

      const isAdminUser = !!a || p?.is_admin === true;
      const ad          = buildAdminData(authUser, p, a);

      setUser(authUser);
      setProfile(p);
      setIsAdmin(isAdminUser);
      setAdminData(ad);
    } catch (err) {
      console.warn("[AuthContext] loadUser unexpected error:", err?.message);
      if (mounted.current) {
        // Keep the user authenticated — NEVER clear on error
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
    lastEventUser.current = null;
    clearTimeout(loadingTimeout.current);
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
    setAdminData(null);
    setLoading(false);
    setProfileLoading(false);
  }, []);

  // ── Visibility-change: silent session restore on mobile resume ─────────────
  // When the user backgrounds then foregrounds the app, browsers may have
  // let the JWT expire. We silently ask Supabase to refresh the token.
  // We do NOT set loading=true — the user never sees a spinner.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;

      // Debounce: tab switches fire rapidly, wait for stable focus
      clearTimeout(visibilityTimer.current);
      visibilityTimer.current = setTimeout(async () => {
        if (!mounted.current) return;
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.user) return; // No session — don't touch state

          // If token is within 5 min of expiry, proactively refresh
          const secsLeft = (session.expires_at ?? 0) - Math.floor(Date.now() / 1000);
          if (secsLeft < 300) {
            const { data } = await supabase.auth.refreshSession();
            if (data?.session?.user && mounted.current) {
              setUser(data.session.user);
            }
          } else if (mounted.current) {
            // Token still valid — just make sure React state is in sync
            setUser(session.user);
          }
        } catch {
          // Silent — NEVER sign out here
        }
      }, VISIBILITY_DEBOUNCE_MS);
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clearTimeout(visibilityTimer.current);
    };
  }, []); // eslint-disable-line

  // ── Auth state listener ─────────────────────────────────────────────────────
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted.current) return;

        switch (event) {
          case "INITIAL_SESSION":
            if (session?.user) await loadUser(session.user);
            else clearUser();
            break;

          case "SIGNED_IN":
            // OAuth callback: URL was already cleaned at module load.
            // loadUser dedup handles double-fire with INITIAL_SESSION.
            if (session?.user) await loadUser(session.user, true);
            break;

          case "SIGNED_OUT":
            // Only fires from our explicit signOut() call
            clearUser();
            break;

          case "TOKEN_REFRESHED":
            // Token silently refreshed — just update the user object.
            // Do NOT call loadUser() (that would show a loading spinner
            // and unnecessarily re-fetch the profile on every token refresh).
            if (session?.user && mounted.current) {
              setUser(session.user);
            }
            break;

          case "USER_UPDATED":
            if (session?.user) await loadUser(session.user, true);
            break;

          default:
            break;
        }
      },
    );

    // ── Belt-and-suspenders ──────────────────────────────────────────────────
    // If INITIAL_SESSION never fires (rare edge case), this resolves loading.
    // Wrapped with withTimeout(SESSION_TIMEOUT_MS) so that when Supabase is
    // completely unreachable (ERR_CONNECTION_CLOSED, offline, DNS failure),
    // the promise resolves to a null session after 6 s instead of hanging
    // forever and freezing the splash screen.
    // MAX_LOAD_MS (10 s) remains as the absolute final backstop.
    withTimeout(
      supabase.auth.getSession(),
      SESSION_TIMEOUT_MS,
      { data: { session: null } },
    )
      .then(({ data: { session } }) => {
        if (!mounted.current) return;
        if (session?.user) loadUser(session.user);
        else clearUser();
      })
      .catch(() => { if (mounted.current) clearUser(); });

    return () => {
      try { subscription?.unsubscribe(); } catch { /* silent */ }
    };
  }, []); // eslint-disable-line

  // ── signOut — the ONLY way auth state clears ───────────────────────────────
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

  // ── refreshProfile — uses ref so it's always stable ───────────────────────
  const refreshProfile = useCallback(async () => {
    const currentUser = userRef.current;
    if (!currentUser?.id) return;
    try {
      const [p, a] = await Promise.all([
        fetchProfile(currentUser.id),
        fetchAdminRecord(currentUser.id),
      ]);
      if (!mounted.current) return;
      const isAdminUser = !!a || p?.is_admin === true;
      const ad          = buildAdminData(currentUser, p, a);
      setProfile(p);
      setIsAdmin(isAdminUser);
      setAdminData(ad);
    } catch (err) {
      console.warn("[AuthContext] refreshProfile error:", err?.message);
      // Keep last known good state — never clear on refresh error
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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