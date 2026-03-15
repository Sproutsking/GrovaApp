// ============================================================================
// src/components/Auth/AuthContext.jsx — v15 IRON-CLAD + ACCOUNT ENFORCEMENT
// ============================================================================
//
// WHAT CHANGED FROM v14:
//   [NEW] Account enforcement layer added — banned/deleted users are
//         force-signed-out even if their Supabase JWT is still valid.
//         This is the fix for "deleted user can still use the app."
//
//         Implementation:
//           - enforceAccountStatus() calls get_session_profile() RPC
//             (SECURITY DEFINER function in admin-enforcement-SAFE.sql)
//           - Called once after every successful profile load
//           - Called every 60s while app is open (setInterval)
//           - Called on window focus (catches bans while tab was backgrounded)
//           - On ACCOUNT_SUSPENDED → signs out, sets kickReason state
//           - On ACCOUNT_DELETED   → signs out, sets kickReason state
//           - kickReason is exposed in context so UI can show a message
//           - All enforcement calls are try/catch — network errors NEVER
//             cause a sign-out (fail open, not fail closed)
//           - Enforcement is SKIPPED if explicitSignOutRef is already true
//             (avoid double sign-out race)
//
//   Everything from v14 is UNCHANGED:
//   [1] SIGNED_OUT ignored unless explicitSignOutRef = true
//   [2] onAuthStateChange never clears user/profile spuriously
//   [3] TOKEN_REFRESHED does not touch profile state
//   [4] sessionGuardInterval every 90s
//   [5] Dual paid cache (sessionStorage + localStorage)
//   [6] lastGoodUser ref never wiped except on explicit sign-out
//   [7] Profile errors NEVER touch user state
//   [8] signOut() uses scope:"local"
//   [9] Spurious SIGNED_OUT → silent recovery
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

const PROFILE_TIMEOUT_MS = 15_000;
const PROFILE_RETRY_DELAYS = [2000, 5000, 15000, 30000, 60000, 120000];
const SESSION_GUARD_MS = 90_000;
const ENFORCEMENT_INTERVAL_MS = 60_000; // Check account status every 60s

// ── Dual paid cache ───────────────────────────────────────────────────────────
const PAID_SS_KEY = "xv_paid";
const PAID_LS_KEY = "xv_paid_ls";

export const ADMIN_ROLE_MAP = {
  ceo_owner: { label: "CEO / Owner", level: 100, color: "#a3e635" },
  super_admin: { label: "Super Admin", level: 90, color: "#f59e0b" },
  a_admin: { label: "Admin A", level: 80, color: "#60a5fa" },
  b_admin: { label: "Admin B", level: 70, color: "#818cf8" },
  admin: { label: "Admin", level: 60, color: "#94a3b8" },
  support: { label: "Support", level: 10, color: "#6ee7b7" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function isNetworkError(err) {
  if (!err) return false;
  const msg = String(err?.message || err).toLowerCase();
  return (
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("aborted") ||
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("err_connection") ||
    msg.includes("load failed") ||
    msg.includes("network request failed")
  );
}

function cleanOAuthErrorParams() {
  try {
    const url = new URL(window.location.href);
    const hasError =
      url.searchParams.has("error") || url.searchParams.has("error_code");
    if (!hasError) return;
    ["error", "error_code", "error_description", "state"].forEach((k) => {
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

function readPaidCache() {
  try {
    if (sessionStorage.getItem(PAID_SS_KEY) === "1") return true;
    if (localStorage.getItem(PAID_LS_KEY) === "1") return true;
    return false;
  } catch {
    return false;
  }
}

function writePaidCache(val) {
  try {
    if (val) {
      sessionStorage.setItem(PAID_SS_KEY, "1");
      localStorage.setItem(PAID_LS_KEY, "1");
    } else {
      sessionStorage.removeItem(PAID_SS_KEY);
      localStorage.removeItem(PAID_LS_KEY);
    }
  } catch {}
}

// ── Provider ──────────────────────────────────────────────────────────────────
export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminData, setAdminData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  // [NEW] Populated when admin bans/deletes this user while they're logged in
  const [kickReason, setKickReason] = useState(null); // { reason, message } | null

  const isMounted = useRef(true);
  const explicitSignOutRef = useRef(false);
  const lastGoodProfile = useRef(null);
  const lastGoodUser = useRef(null);
  const lastFetchedUserId = useRef(null);
  const paidCacheRef = useRef(readPaidCache());
  const initDoneRef = useRef(false);
  const profileRetryTimer = useRef(null);
  const profileRetryCount = useRef(0);
  const fetchInFlight = useRef(false);
  const sessionGuardInterval = useRef(null);
  // [NEW] Refs for enforcement
  const enforcementInterval = useRef(null);
  const enforcementBusy = useRef(false); // Prevent concurrent checks

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      clearTimeout(profileRetryTimer.current);
      clearInterval(sessionGuardInterval.current);
      // [NEW] Clean up enforcement interval on unmount
      clearInterval(enforcementInterval.current);
      window.removeEventListener("focus", handleWindowFocus.current);
    };
  }, []);

  useEffect(() => {
    cleanOAuthErrorParams();
  }, []);

  // ── Set paid ──────────────────────────────────────────────────────────────
  const setPaid = useCallback((val) => {
    paidCacheRef.current = val;
    writePaidCache(val);
  }, []);

  // ── [NEW] Account enforcement ─────────────────────────────────────────────
  // Calls get_session_profile() RPC. If the account is suspended or deleted,
  // forces sign-out immediately. Fails open on any network/RPC error.
  //
  // IMPORTANT: This NEVER fires for admin users. Admins are exempt from
  // enforcement checks to prevent accidental self-lockout.
  const enforceAccountStatus = useCallback(
    async (userId) => {
      if (!userId) return;
      if (!isMounted.current) return;
      if (explicitSignOutRef.current) return; // Already signing out
      if (enforcementBusy.current) return; // Previous check still running
      if (isAdmin) return; // Admins are exempt

      enforcementBusy.current = true;
      try {
        const { data, error } = await supabase.rpc("get_session_profile", {
          p_user_id: userId,
        });

        // RPC error (function not deployed yet, or network issue) → fail open
        if (error) {
          if (process.env.NODE_ENV === "development") {
            console.warn(
              "[AuthContext] enforcement RPC error (non-fatal):",
              error.message,
            );
          }
          return;
        }

        if (!data) return; // No data → fail open

        // Account is fine — data is the full profile object, no action needed
        if (!data.error) return;

        // ── Account suspended ─────────────────────────────────────────────────
        if (data.error === "ACCOUNT_SUSPENDED") {
          if (!isMounted.current || explicitSignOutRef.current) return;
          console.warn("[AuthContext] Account suspended — forcing sign-out");

          const reason = {
            reason: "suspended",
            message:
              data.reason ||
              "Your account has been suspended. Please contact support.",
          };

          // Set flag before signOut so SIGNED_OUT handler knows this is intentional
          explicitSignOutRef.current = true;
          clearTimeout(profileRetryTimer.current);
          clearInterval(sessionGuardInterval.current);
          clearInterval(enforcementInterval.current);
          sessionRefreshManager.cleanup();

          // Clear all state
          setUser(null);
          setProfile(null);
          setIsAdmin(false);
          setAdminData(null);
          setPaid(false);
          setKickReason(reason); // ← UI can read this to show a message
          lastGoodProfile.current = null;
          lastGoodUser.current = null;
          lastFetchedUserId.current = null;

          await supabase.auth.signOut({ scope: "local" }).catch(() => {});
          return;
        }

        // ── Account deleted/deactivated ───────────────────────────────────────
        if (
          data.error === "ACCOUNT_DELETED" ||
          data.error === "PROFILE_NOT_FOUND"
        ) {
          if (!isMounted.current || explicitSignOutRef.current) return;
          console.warn("[AuthContext] Account deleted — forcing sign-out");

          const reason = {
            reason: "deleted",
            message: "This account has been removed.",
          };

          explicitSignOutRef.current = true;
          clearTimeout(profileRetryTimer.current);
          clearInterval(sessionGuardInterval.current);
          clearInterval(enforcementInterval.current);
          sessionRefreshManager.cleanup();

          setUser(null);
          setProfile(null);
          setIsAdmin(false);
          setAdminData(null);
          setPaid(false);
          setKickReason(reason); // ← UI can read this to show a message
          lastGoodProfile.current = null;
          lastGoodUser.current = null;
          lastFetchedUserId.current = null;

          await supabase.auth.signOut({ scope: "local" }).catch(() => {});
          return;
        }
      } catch (err) {
        // Any unexpected error → fail open, never sign out
        if (process.env.NODE_ENV === "development") {
          console.warn(
            "[AuthContext] enforcement unexpected error (non-fatal):",
            err?.message,
          );
        }
      } finally {
        enforcementBusy.current = false;
      }
    },
    [isAdmin, setPaid],
  );

  // [NEW] Stable ref for the window focus handler so we can remove it on cleanup
  const handleWindowFocus = useRef(() => {});

  // ── [NEW] Start enforcement loop ──────────────────────────────────────────
  // Called once after a successful profile load. Sets up:
  //   - setInterval every 60s
  //   - window focus listener
  const startEnforcement = useCallback(
    (userId) => {
      // Don't enforce for admin users
      if (isAdmin) return;

      clearInterval(enforcementInterval.current);
      window.removeEventListener("focus", handleWindowFocus.current);

      // Create stable focus handler for this userId
      handleWindowFocus.current = () => {
        if (isMounted.current && !explicitSignOutRef.current) {
          enforceAccountStatus(userId);
        }
      };

      // Interval check every 60s
      enforcementInterval.current = setInterval(() => {
        if (isMounted.current && !explicitSignOutRef.current) {
          enforceAccountStatus(userId);
        }
      }, ENFORCEMENT_INTERVAL_MS);

      // Focus check — catches bans while tab was backgrounded
      window.addEventListener("focus", handleWindowFocus.current);
    },
    [isAdmin, enforceAccountStatus],
  );

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
      const roleInfo = ADMIN_ROLE_MAP[data.role] ?? {
        label: data.role,
        level: 50,
        color: "#94a3b8",
      };
      return {
        id: userId,
        role: data.role,
        roleLabel: roleInfo.label,
        roleLevel: roleInfo.level,
        roleColor: roleInfo.color,
        permissions: data.permissions || [],
        isCEO: data.role === "ceo_owner",
        isSuperAdmin: data.role === "super_admin" || data.role === "ceo_owner",
      };
    } catch {
      return null;
    }
  }, []);

  // ── Profile loader ────────────────────────────────────────────────────────
  const loadProfile = useCallback(
    async (userId, { force = false, retryIndex = 0 } = {}) => {
      if (!userId || !isMounted.current) return;
      if (
        !force &&
        lastFetchedUserId.current === userId &&
        lastGoodProfile.current
      )
        return;
      if (fetchInFlight.current && !force) return;

      fetchInFlight.current = true;
      if (retryIndex === 0) setProfileLoading(true);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PROFILE_TIMEOUT_MS);

      try {
        let query = supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();
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
        fetchInFlight.current = false;

        if (data) {
          lastGoodProfile.current = data;
          setProfile(data);

          if (isPaidProfileData(data)) setPaid(true);

          const hasAdminFlag =
            data.is_admin || data.role === "admin" || data.is_super_admin;
          if (hasAdminFlag) {
            const adminInfo = await fetchAdminRole(userId);
            if (isMounted.current) {
              setIsAdmin(true);
              setAdminData(
                adminInfo || {
                  id: userId,
                  role: "admin",
                  roleLabel: "Admin",
                  roleLevel: 60,
                  roleColor: "#94a3b8",
                  permissions: data.permissions || [],
                  isCEO: false,
                  isSuperAdmin: false,
                },
              );
            }
          } else {
            if (isMounted.current) {
              setIsAdmin(false);
              setAdminData(null);
            }
          }

          // [NEW] Start enforcement after successful profile load
          // Non-admin users get their account status monitored from this point.
          // This is the earliest safe point — we now know if they're admin or not.
          if (!hasAdminFlag && !explicitSignOutRef.current) {
            // Run one immediate check, then start the interval
            enforceAccountStatus(userId);
            startEnforcement(userId);
          }
        } else if (lastGoodProfile.current) {
          setProfile(lastGoodProfile.current);
        }
      } catch (err) {
        clearTimeout(timer);
        fetchInFlight.current = false;
        if (!isMounted.current) return;

        console.warn(
          `[AuthContext] Profile fetch error (retry ${retryIndex}):`,
          err?.message,
        );

        if (lastGoodProfile.current) {
          setProfile(lastGoodProfile.current);
          lastFetchedUserId.current = userId;
        }

        const delay =
          PROFILE_RETRY_DELAYS[
            Math.min(retryIndex, PROFILE_RETRY_DELAYS.length - 1)
          ];
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
    },
    [fetchAdminRole, setPaid, enforceAccountStatus, startEnforcement],
  );

  // ── Session guard ─────────────────────────────────────────────────────────
  const startSessionGuard = useCallback((userId) => {
    clearInterval(sessionGuardInterval.current);
    sessionGuardInterval.current = setInterval(async () => {
      if (!isMounted.current || !userId || explicitSignOutRef.current) return;
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user) {
          if (isMounted.current) {
            lastGoodUser.current = session.user;
            setUser(session.user);
          }
        } else {
          console.warn(
            "[AuthContext] Session guard: session missing, recovering...",
          );
          sessionRefreshManager.getValidSession().then((recovered) => {
            if (!isMounted.current || explicitSignOutRef.current) return;
            if (recovered?.user) {
              lastGoodUser.current = recovered.user;
              setUser(recovered.user);
            } else if (lastGoodUser.current) {
              setUser(lastGoodUser.current);
            }
            if (lastGoodProfile.current) setProfile(lastGoodProfile.current);
          });
        }
      } catch {
        /* Non-fatal */
      }
    }, SESSION_GUARD_MS);
  }, []);

  // ── Auth state machine ─────────────────────────────────────────────────────
  useEffect(() => {
    let resolved = false;
    const resolve = () => {
      if (!resolved) {
        resolved = true;
        if (isMounted.current) setLoading(false);
      }
    };

    const hasPKCECode = new URLSearchParams(window.location.search).has("code");

    const init = async () => {
      try {
        if (hasPKCECode) {
          await new Promise((r) => setTimeout(r, 800));
          const {
            data: { session },
          } = await supabase.auth.getSession();
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

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        if (!isMounted.current) {
          resolve();
          return;
        }

        if (error) {
          console.warn(
            "[AuthContext] Startup getSession error:",
            error.message,
          );
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
        if (lastGoodUser.current && isMounted.current) {
          setUser(lastGoodUser.current);
          if (lastGoodProfile.current) setProfile(lastGoodProfile.current);
        }
        resolve();
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted.current) return;

      // ── SIGNED_OUT ──────────────────────────────────────────────────────────
      if (event === "SIGNED_OUT") {
        if (!explicitSignOutRef.current) {
          console.warn(
            "[AuthContext] Ignoring spurious SIGNED_OUT — recovering silently",
          );
          setTimeout(() => {
            if (!isMounted.current || explicitSignOutRef.current) return;
            if (lastGoodUser.current) setUser(lastGoodUser.current);
            if (lastGoodProfile.current) setProfile(lastGoodProfile.current);
            sessionRefreshManager.getValidSession().then((recovered) => {
              if (!isMounted.current || explicitSignOutRef.current) return;
              if (recovered?.user) {
                lastGoodUser.current = recovered.user;
                setUser(recovered.user);
                if (
                  recovered.user.id !== lastFetchedUserId.current ||
                  !lastGoodProfile.current
                ) {
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
        // [NEW] Also clear enforcement on explicit sign-out
        clearInterval(enforcementInterval.current);
        window.removeEventListener("focus", handleWindowFocus.current);
        setUser(null);
        setProfile(null);
        setIsAdmin(false);
        setAdminData(null);
        setPaid(false);
        lastFetchedUserId.current = null;
        lastGoodProfile.current = null;
        lastGoodUser.current = null;
        profileRetryCount.current = 0;
        initDoneRef.current = false;
        resolve();
        return;
      }

      // ── TOKEN_REFRESHED ─────────────────────────────────────────────────────
      if (event === "TOKEN_REFRESHED") {
        if (session?.user) {
          lastGoodUser.current = session.user;
          setUser(session.user);
        }
        resolve();
        return;
      }

      // ── SIGNED_IN / USER_UPDATED ────────────────────────────────────────────
      if (session?.user) {
        lastGoodUser.current = session.user;
        setUser(session.user);
        if (
          session.user.id !== lastFetchedUserId.current ||
          !lastGoodProfile.current
        ) {
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

  // ── Explicit sign-out ─────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    explicitSignOutRef.current = true;
    clearTimeout(profileRetryTimer.current);
    clearInterval(sessionGuardInterval.current);
    // [NEW] Clean up enforcement on sign-out
    clearInterval(enforcementInterval.current);
    window.removeEventListener("focus", handleWindowFocus.current);
    sessionRefreshManager.cleanup();
    initDoneRef.current = false;

    if (isMounted.current) {
      setUser(null);
      setProfile(null);
      setIsAdmin(false);
      setAdminData(null);
      setPaid(false);
      setKickReason(null); // [NEW] Clear any kick reason on manual sign-out
      lastGoodProfile.current = null;
      lastGoodUser.current = null;
      lastFetchedUserId.current = null;
    }

    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch (err) {
      console.warn("[AuthContext] signOut error:", err?.message);
    }
  }, [setPaid]);

  // ── signOutAllDevices ─────────────────────────────────────────────────────
  const signOutAllDevices = useCallback(async () => {
    explicitSignOutRef.current = true;
    clearTimeout(profileRetryTimer.current);
    clearInterval(sessionGuardInterval.current);
    // [NEW] Clean up enforcement
    clearInterval(enforcementInterval.current);
    window.removeEventListener("focus", handleWindowFocus.current);
    sessionRefreshManager.cleanup();
    initDoneRef.current = false;

    if (isMounted.current) {
      setUser(null);
      setProfile(null);
      setIsAdmin(false);
      setAdminData(null);
      setPaid(false);
      setKickReason(null); // [NEW]
      lastGoodProfile.current = null;
      lastGoodUser.current = null;
      lastFetchedUserId.current = null;
    }

    try {
      await supabase.auth.signOut({ scope: "global" });
    } catch (err) {
      console.warn("[AuthContext] signOutAllDevices error:", err?.message);
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {}
    }
  }, [setPaid]);

  // ── Force refresh profile ─────────────────────────────────────────────────
  const refreshProfile = useCallback(async () => {
    const userId = lastGoodUser.current?.id || profile?.id;
    if (!userId) return;
    clearTimeout(profileRetryTimer.current);
    profileRetryCount.current = 0;
    lastFetchedUserId.current = null;
    await loadProfile(userId, { force: true });
  }, [profile?.id, loadProfile]);

  const getIsPaidCached = useCallback(() => {
    const stored = readPaidCache();
    if (stored && !paidCacheRef.current) paidCacheRef.current = true;
    return paidCacheRef.current;
  }, []);

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
        signOutAllDevices,
        refreshProfile,
        getIsPaidCached,
        kickReason, // [NEW] { reason: "suspended"|"deleted", message: string } | null
        clearKickReason: () => setKickReason(null), // [NEW] Call this after showing the message
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function isPaidProfileData(profile) {
  if (!profile) return false;
  return (
    profile.account_activated === true ||
    profile.payment_status === "paid" ||
    profile.payment_status === "vip" ||
    profile.payment_status === "free" ||
    profile.subscription_tier === "standard" ||
    profile.subscription_tier === "pro" ||
    profile.subscription_tier === "vip" ||
    profile.subscription_tier === "whitelist"
  );
}
