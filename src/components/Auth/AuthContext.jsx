// ============================================================================
// src/components/Auth/AuthContext.jsx — v14 IRON-CLAD
// ============================================================================
//
// WHAT CHANGED FROM v13:
//   [1] SIGNED_OUT completely ignored unless explicitSignOutRef = true.
//       Supabase fires spurious SIGNED_OUT on token refresh failures,
//       network hiccups, tab focus events, and SDK bugs. We ignore ALL
//       of them and silently recover the session instead.
//   [2] onAuthStateChange never clears user/profile on any event except
//       a user-initiated sign-out. It only updates state positively.
//   [3] TOKEN_REFRESHED does not touch profile state at all.
//   [4] Added sessionGuardInterval — every 90s, silently verify the
//       session exists. If not, recover. Never sign out.
//   [5] Dual paid cache (sessionStorage + localStorage) so paywall
//       never flashes across any browser storage scenario.
//   [6] lastGoodUser ref — never wiped except on explicit sign-out.
//       Keeps user state alive through any transient Supabase event.
//   [7] Profile errors NEVER touch user state. Profile retries
//       independently with indefinite backoff.
//   [8] signOut() uses scope:"local" — only ends this device's session.
//       signOutAllDevices() uses scope:"global" for the explicit case.
//   [9] Spurious SIGNED_OUT → silent recovery via sessionRefreshManager.
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
import sessionRefreshManager from "../../services/auth/sessionRefresh";

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

const PROFILE_TIMEOUT_MS   = 15_000;
const PROFILE_RETRY_DELAYS = [2000, 5000, 15000, 30000, 60000, 120000];
const SESSION_GUARD_MS     = 90_000; // Silent session check every 90s

// ── Dual paid cache — sessionStorage + localStorage ──────────────────────────
// Survives hard refresh, tab close, and all browser storage quirks.
const PAID_SS_KEY = "xv_paid";
const PAID_LS_KEY = "xv_paid_ls";

export const ADMIN_ROLE_MAP = {
  ceo_owner:   { label: "CEO / Owner",   level: 100, color: "#a3e635" },
  super_admin: { label: "Super Admin",   level: 90,  color: "#f59e0b" },
  a_admin:     { label: "Admin A",       level: 80,  color: "#60a5fa" },
  b_admin:     { label: "Admin B",       level: 70,  color: "#818cf8" },
  admin:       { label: "Admin",         level: 60,  color: "#94a3b8" },
  support:     { label: "Support",       level: 10,  color: "#6ee7b7" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function isNetworkError(err) {
  if (!err) return false;
  const msg = String(err?.message || err).toLowerCase();
  return (
    msg.includes("timeout")         ||
    msg.includes("timed out")       ||
    msg.includes("aborted")         ||
    msg.includes("failed to fetch") ||
    msg.includes("networkerror")    ||
    msg.includes("err_connection")  ||
    msg.includes("load failed")     ||
    msg.includes("network request failed")
  );
}

function cleanOAuthErrorParams() {
  try {
    const url = new URL(window.location.href);
    const hasError = url.searchParams.has("error") || url.searchParams.has("error_code");
    if (!hasError) return;
    ["error", "error_code", "error_description", "state"].forEach(k => {
      url.searchParams.delete(k);
    });
    window.history.replaceState({}, "", url.toString());
  } catch {}
}

function cleanPKCEParams() {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has("code")) {
      url.searchParams.delete("code");
      url.searchParams.delete("state");
      window.history.replaceState({}, "", url.toString());
    }
  } catch {}
}

// ── Dual paid cache helpers ───────────────────────────────────────────────────
function readPaidCache() {
  try {
    if (sessionStorage.getItem(PAID_SS_KEY) === "1") return true;
    if (localStorage.getItem(PAID_LS_KEY)   === "1") return true;
    return false;
  } catch { return false; }
}

function writePaidCache(val) {
  try {
    if (val) {
      sessionStorage.setItem(PAID_SS_KEY, "1");
      localStorage.setItem(PAID_LS_KEY,   "1");
    } else {
      sessionStorage.removeItem(PAID_SS_KEY);
      localStorage.removeItem(PAID_LS_KEY);
    }
  } catch {}
}

// ── Provider ──────────────────────────────────────────────────────────────────
export default function AuthProvider({ children }) {
  const [user,           setUser]           = useState(null);
  const [profile,        setProfile]        = useState(null);
  const [isAdmin,        setIsAdmin]        = useState(false);
  const [adminData,      setAdminData]      = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const isMounted            = useRef(true);
  // CRITICAL: Only true when user explicitly clicks Sign Out
  const explicitSignOutRef   = useRef(false);
  const lastGoodProfile      = useRef(null);
  const lastGoodUser         = useRef(null); // Never wiped except on explicit sign-out
  const lastFetchedUserId    = useRef(null);
  const paidCacheRef         = useRef(readPaidCache());
  const initDoneRef          = useRef(false);
  const profileRetryTimer    = useRef(null);
  const profileRetryCount    = useRef(0);
  const fetchInFlight        = useRef(false);
  const sessionGuardInterval = useRef(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      clearTimeout(profileRetryTimer.current);
      clearInterval(sessionGuardInterval.current);
    };
  }, []);

  useEffect(() => { cleanOAuthErrorParams(); }, []);

  // ── Set paid (writes both storages) ──────────────────────────────────────
  const setPaid = useCallback((val) => {
    paidCacheRef.current = val;
    writePaidCache(val);
  }, []);

  // ── Admin role loader ─────────────────────────────────────────────────────
  const fetchAdminRole = useCallback(async (userId) => {
    if (!userId) return null;
    try {
      const { data } = await supabase
        .from("admin_team")
        .select("role, permissions, status")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();
      if (!data) return null;
      const roleInfo = ADMIN_ROLE_MAP[data.role] ?? { label: data.role, level: 50, color: "#94a3b8" };
      return {
        id: userId, role: data.role,
        roleLabel: roleInfo.label, roleLevel: roleInfo.level, roleColor: roleInfo.color,
        permissions: data.permissions || [],
        isCEO: data.role === "ceo_owner",
        isSuperAdmin: data.role === "super_admin" || data.role === "ceo_owner",
      };
    } catch { return null; }
  }, []);

  // ── Profile loader ────────────────────────────────────────────────────────
  const loadProfile = useCallback(async (userId, { force = false, retryIndex = 0 } = {}) => {
    if (!userId || !isMounted.current) return;
    if (!force && lastFetchedUserId.current === userId && lastGoodProfile.current) return;
    if (fetchInFlight.current && !force) return;

    fetchInFlight.current = true;
    if (retryIndex === 0) setProfileLoading(true);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROFILE_TIMEOUT_MS);

    try {
      let query = supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (typeof query.abortSignal === "function") {
        query = query.abortSignal(controller.signal);
      }

      const { data, error } = await query;
      clearTimeout(timer);
      if (!isMounted.current) return;
      if (error) throw error;

      profileRetryCount.current = 0;
      clearTimeout(profileRetryTimer.current);
      lastFetchedUserId.current = userId;
      fetchInFlight.current     = false;

      if (data) {
        lastGoodProfile.current = data;
        setProfile(data);

        if (isPaidProfileData(data)) setPaid(true);

        const hasAdminFlag = data.is_admin || data.role === "admin" || data.is_super_admin;
        if (hasAdminFlag) {
          const adminInfo = await fetchAdminRole(userId);
          if (isMounted.current) {
            setIsAdmin(true);
            setAdminData(adminInfo || {
              id: userId, role: "admin", roleLabel: "Admin",
              roleLevel: 60, roleColor: "#94a3b8",
              permissions: data.permissions || [],
              isCEO: false, isSuperAdmin: false,
            });
          }
        } else {
          if (isMounted.current) { setIsAdmin(false); setAdminData(null); }
        }
      } else if (lastGoodProfile.current) {
        // DB returned null but we have a good profile — keep it, never flash paywall
        setProfile(lastGoodProfile.current);
      }
      // Truly new user with no profile row: leave as null so AppRouter can handle

    } catch (err) {
      clearTimeout(timer);
      fetchInFlight.current = false;
      if (!isMounted.current) return;

      console.warn(`[AuthContext] Profile fetch error (retry ${retryIndex}):`, err?.message);

      // NEVER wipe profile on error — always keep last good state
      if (lastGoodProfile.current) {
        setProfile(lastGoodProfile.current);
        lastFetchedUserId.current = userId;
      }

      const delay = PROFILE_RETRY_DELAYS[Math.min(retryIndex, PROFILE_RETRY_DELAYS.length - 1)];
      profileRetryTimer.current = setTimeout(() => {
        if (isMounted.current && userId) {
          loadProfile(userId, { force: true, retryIndex: retryIndex + 1 });
        }
      }, delay);
    } finally {
      clearTimeout(timer);
      fetchInFlight.current = false;
      if (isMounted.current) setProfileLoading(false);
    }
  }, [fetchAdminRole, setPaid]);

  // ── Session guard — silent background verification every 90s ─────────────
  const startSessionGuard = useCallback((userId) => {
    clearInterval(sessionGuardInterval.current);
    sessionGuardInterval.current = setInterval(async () => {
      if (!isMounted.current || !userId || explicitSignOutRef.current) return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // Session alive — update user silently
          if (isMounted.current) {
            lastGoodUser.current = session.user;
            setUser(session.user);
          }
        } else {
          // Session appears missing — recover, never sign out
          console.warn("[AuthContext] Session guard: session missing, recovering...");
          sessionRefreshManager.getValidSession().then(recovered => {
            if (!isMounted.current || explicitSignOutRef.current) return;
            if (recovered?.user) {
              lastGoodUser.current = recovered.user;
              setUser(recovered.user);
            } else if (lastGoodUser.current) {
              // Keep last known user in state — never wipe
              setUser(lastGoodUser.current);
            }
            if (lastGoodProfile.current) setProfile(lastGoodProfile.current);
          });
        }
      } catch { /* Non-fatal */ }
    }, SESSION_GUARD_MS);
  }, []);

  // ── Auth state machine ─────────────────────────────────────────────────────
  useEffect(() => {
    let resolved = false;
    const resolve = () => {
      if (!resolved) { resolved = true; if (isMounted.current) setLoading(false); }
    };

    const hasPKCECode = new URLSearchParams(window.location.search).has("code");

    const init = async () => {
      try {
        if (hasPKCECode) {
          await new Promise(r => setTimeout(r, 800));
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user && isMounted.current) {
            cleanPKCEParams();
            lastGoodUser.current = session.user;
            setUser(session.user);
            loadProfile(session.user.id);
            startSessionGuard(session.user.id);
            if (!initDoneRef.current) {
              initDoneRef.current = true;
              sessionRefreshManager.initialize().catch(() => {});
            }
            resolve();
            return;
          }
        }

        const { data: { session }, error } = await supabase.auth.getSession();
        if (!isMounted.current) { resolve(); return; }

        if (error) {
          console.warn("[AuthContext] Startup getSession error:", error.message);
          // Don't give up — try recovery via sessionRefreshManager
          const recovered = await sessionRefreshManager.getValidSession();
          if (recovered?.user && isMounted.current) {
            lastGoodUser.current = recovered.user;
            setUser(recovered.user);
            loadProfile(recovered.user.id);
            startSessionGuard(recovered.user.id);
            if (!initDoneRef.current) {
              initDoneRef.current = true;
              sessionRefreshManager.initialize().catch(() => {});
            }
          }
          resolve();
          return;
        }

        if (session?.user) {
          lastGoodUser.current = session.user;
          setUser(session.user);
          loadProfile(session.user.id);
          startSessionGuard(session.user.id);
          if (!initDoneRef.current) {
            initDoneRef.current = true;
            sessionRefreshManager.initialize().catch(() => {});
          }
        }
        resolve();
      } catch (err) {
        console.warn("[AuthContext] Init exception:", err?.message);
        // Even on exception, restore last known user
        if (lastGoodUser.current && isMounted.current) {
          setUser(lastGoodUser.current);
          if (lastGoodProfile.current) setProfile(lastGoodProfile.current);
        }
        resolve();
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted.current) return;

      // ── SIGNED_OUT ──────────────────────────────────────────────────────────
      // This is the most critical fix. Supabase fires spurious SIGNED_OUT
      // events constantly: token refresh failures, network drops, tab focus,
      // SDK internal state resets. We IGNORE all of them unless the user
      // physically clicked our Sign Out button (explicitSignOutRef = true).
      if (event === "SIGNED_OUT") {
        if (!explicitSignOutRef.current) {
          console.warn("[AuthContext] Ignoring spurious SIGNED_OUT — recovering silently");
          // Silently recover the session in the background
          setTimeout(() => {
            if (!isMounted.current || explicitSignOutRef.current) return;
            // Restore from refs immediately so UI never flashes
            if (lastGoodUser.current) setUser(lastGoodUser.current);
            if (lastGoodProfile.current) setProfile(lastGoodProfile.current);
            // Then attempt a real session recovery
            sessionRefreshManager.getValidSession().then(recovered => {
              if (!isMounted.current || explicitSignOutRef.current) return;
              if (recovered?.user) {
                lastGoodUser.current = recovered.user;
                setUser(recovered.user);
                if (recovered.user.id !== lastFetchedUserId.current || !lastGoodProfile.current) {
                  loadProfile(recovered.user.id, { force: true });
                } else if (lastGoodProfile.current) {
                  setProfile(lastGoodProfile.current);
                }
              }
            });
          }, 100);
          resolve();
          return;
        }

        // Legitimate explicit sign-out — clear everything
        explicitSignOutRef.current = false;
        clearTimeout(profileRetryTimer.current);
        clearInterval(sessionGuardInterval.current);
        setUser(null);
        setProfile(null);
        setIsAdmin(false);
        setAdminData(null);
        setPaid(false);
        lastFetchedUserId.current = null;
        lastGoodProfile.current   = null;
        lastGoodUser.current      = null;
        profileRetryCount.current = 0;
        initDoneRef.current       = false;
        resolve();
        return;
      }

      // ── TOKEN_REFRESHED — update user only, never touch profile ────────────
      if (event === "TOKEN_REFRESHED") {
        if (session?.user) {
          lastGoodUser.current = session.user;
          setUser(session.user);
          // Profile is still valid — do not touch it under any circumstance
        }
        resolve();
        return;
      }

      // ── SIGNED_IN / USER_UPDATED — update state positively ─────────────────
      if (session?.user) {
        lastGoodUser.current = session.user;
        setUser(session.user);
        if (session.user.id !== lastFetchedUserId.current || !lastGoodProfile.current) {
          profileRetryCount.current = 0;
          loadProfile(session.user.id);
        }
        if (!initDoneRef.current) {
          initDoneRef.current = true;
          sessionRefreshManager.initialize().catch(() => {});
          startSessionGuard(session.user.id);
        }
        resolve();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadProfile, setPaid, startSessionGuard]);

  // ── Explicit sign-out — the ONLY path that ends a session ─────────────────
  // Uses local scope: only ends THIS device's session.
  const signOut = useCallback(async () => {
    // Set flag FIRST so the SIGNED_OUT handler knows this is intentional
    explicitSignOutRef.current = true;
    clearTimeout(profileRetryTimer.current);
    clearInterval(sessionGuardInterval.current);
    sessionRefreshManager.cleanup();
    initDoneRef.current = false;

    if (isMounted.current) {
      setUser(null);
      setProfile(null);
      setIsAdmin(false);
      setAdminData(null);
      setPaid(false);
      lastGoodProfile.current   = null;
      lastGoodUser.current      = null;
      lastFetchedUserId.current = null;
    }

    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch (err) {
      console.warn("[AuthContext] signOut error:", err?.message);
    }
  }, [setPaid]);

  // ── signOutAllDevices — explicit multi-device logout ──────────────────────
  // Only call this from a deliberate "Sign out everywhere" settings action.
  const signOutAllDevices = useCallback(async () => {
    explicitSignOutRef.current = true;
    clearTimeout(profileRetryTimer.current);
    clearInterval(sessionGuardInterval.current);
    sessionRefreshManager.cleanup();
    initDoneRef.current = false;

    if (isMounted.current) {
      setUser(null);
      setProfile(null);
      setIsAdmin(false);
      setAdminData(null);
      setPaid(false);
      lastGoodProfile.current   = null;
      lastGoodUser.current      = null;
      lastFetchedUserId.current = null;
    }

    try {
      await supabase.auth.signOut({ scope: "global" });
    } catch (err) {
      console.warn("[AuthContext] signOutAllDevices error:", err?.message);
      try { await supabase.auth.signOut({ scope: "local" }); } catch {}
    }
  }, [setPaid]);

  // ── Force refresh profile (post-payment, post-edit) ───────────────────────
  const refreshProfile = useCallback(async () => {
    const userId = lastGoodUser.current?.id || profile?.id;
    if (!userId) return;
    clearTimeout(profileRetryTimer.current);
    profileRetryCount.current = 0;
    lastFetchedUserId.current = null;
    await loadProfile(userId, { force: true });
  }, [profile?.id, loadProfile]);

  const getIsPaidCached = useCallback(() => {
    // Check all sources — most permissive wins
    const stored = readPaidCache();
    if (stored && !paidCacheRef.current) paidCacheRef.current = true;
    return paidCacheRef.current;
  }, []);

  return (
    <AuthContext.Provider value={{
      user, profile, isAdmin, adminData,
      loading, profileLoading,
      signOut,
      signOutAllDevices,
      refreshProfile,
      getIsPaidCached,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function isPaidProfileData(profile) {
  if (!profile) return false;
  return (
    profile.account_activated === true        ||
    profile.payment_status    === "paid"      ||
    profile.payment_status    === "vip"       ||
    profile.payment_status    === "free"      ||
    profile.subscription_tier === "standard"  ||
    profile.subscription_tier === "pro"       ||
    profile.subscription_tier === "vip"       ||
    profile.subscription_tier === "whitelist"
  );
}