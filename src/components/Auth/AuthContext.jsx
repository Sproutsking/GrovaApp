// src/components/Auth/AuthContext.jsx — FIXED
// KEY FIX: cleanOAuthUrl() now runs AFTER Supabase fires SIGNED_IN,
// not before. Previously it was stripping ?code= from the URL before
// Supabase JS could exchange it, so SIGNED_IN never fired.

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { supabase } from "../../services/config/supabase";

const AuthContext = createContext({
  user: null,
  profile: null,
  isAdmin: false,
  adminData: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

// ── Fetch profile from profiles table ────────────────────────────────────────
async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id,full_name,username,avatar_id,verified,is_pro,account_activated,is_admin",
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) console.warn("[AuthContext] profile fetch:", error.message);
  return data ?? null;
}

// ── Fetch admin record from admin_team table ──────────────────────────────────
async function fetchAdminRecord(userId) {
  const { data, error } = await supabase
    .from("admin_team")
    .select("id,role,permissions,status,email,full_name")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (error) console.warn("[AuthContext] admin_team fetch:", error.message);
  return data ?? null;
}

// ── Clean OAuth ?code= from URL ───────────────────────────────────────────────
// FIXED: Only call this AFTER Supabase has already exchanged the code.
// Never call it on mount before onAuthStateChange has fired.
function cleanOAuthUrl() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("code") && !url.searchParams.has("state")) return;
    url.searchParams.delete("code");
    url.searchParams.delete("state");
    url.searchParams.delete("error");
    url.searchParams.delete("error_description");
    window.history.replaceState(
      {},
      "",
      url.pathname + (url.search !== "?" ? url.search : "") + url.hash,
    );
  } catch {}
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminData, setAdminData] = useState(null);
  const [loading, setLoading] = useState(true);

  const mounted = useRef(true);
  const busy = useRef(false);
  const initialized = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // ── Core loader ───────────────────────────────────────────────────────────
  const loadUser = useCallback(async (authUser) => {
    if (!authUser?.id || !mounted.current) return;
    if (busy.current) return;
    busy.current = true;

    try {
      const [p, a] = await Promise.all([
        fetchProfile(authUser.id),
        fetchAdminRecord(authUser.id),
      ]);

      if (!mounted.current) return;

      const adminRecord = a ?? null;
      const isAdminUser = !!adminRecord || p?.is_admin === true;

      setUser(authUser);
      setProfile(p);
      setIsAdmin(isAdminUser);
      setAdminData(
        isAdminUser
          ? {
              role: adminRecord?.role || "a_admin",
              permissions: adminRecord?.permissions || ["all"],
              email: adminRecord?.email || authUser.email || "",
              full_name: adminRecord?.full_name || p?.full_name || "Admin",
            }
          : null,
      );
    } catch (err) {
      console.warn("[AuthContext] loadUser error:", err?.message);
      if (mounted.current) {
        setUser(authUser);
        setProfile(null);
        setIsAdmin(false);
        setAdminData(null);
      }
    } finally {
      busy.current = false;
      if (mounted.current) setLoading(false);
    }
  }, []);

  const clearUser = useCallback(() => {
    if (!mounted.current) return;
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
    setAdminData(null);
    setLoading(false);
    busy.current = false;
  }, []);

  // ── Auth state listener ───────────────────────────────────────────────────
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // !! FIXED: cleanOAuthUrl() is NOT called here on mount.
    // It is now called inside the SIGNED_IN handler, AFTER Supabase
    // has successfully exchanged the ?code= and fired the event.

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
          // Clean the URL now — Supabase has already used the ?code=
          cleanOAuthUrl();
          if (session?.user && !busy.current) await loadUser(session.user);
          break;

        case "SIGNED_OUT":
          clearUser();
          break;

        case "TOKEN_REFRESHED":
          if (session?.user && mounted.current) setUser(session.user);
          break;

        case "USER_UPDATED":
          if (session?.user) await loadUser(session.user);
          break;

        default:
          break;
      }
    });

    // Fallback in case INITIAL_SESSION doesn't fire
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!mounted.current || busy.current) return;
        if (session?.user) loadUser(session.user);
        else if (mounted.current) setLoading(false);
      })
      .catch(() => {
        if (mounted.current) setLoading(false);
      });

    return () => {
      try {
        subscription?.unsubscribe();
      } catch {}
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      try {
        localStorage.removeItem("xeevia-auth-token");
        await supabase.auth.signOut({ scope: "local" });
      } catch {}
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user?.id) return;
    const [p, a] = await Promise.all([
      fetchProfile(user.id),
      fetchAdminRecord(user.id),
    ]);
    if (!mounted.current) return;
    const isAdminUser = !!a || p?.is_admin === true;
    setProfile(p);
    setIsAdmin(isAdminUser);
    setAdminData(
      isAdminUser
        ? {
            role: a?.role || "a_admin",
            permissions: a?.permissions || ["all"],
            email: a?.email || user.email || "",
            full_name: a?.full_name || p?.full_name || "Admin",
          }
        : null,
    );
  }, [user?.id, user?.email]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isAdmin,
        adminData,
        loading,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;
