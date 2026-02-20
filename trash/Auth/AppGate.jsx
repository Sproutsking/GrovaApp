// ============================================================================
// src/components/Auth/AppGate.jsx — v14 FINAL
//
// WHAT THIS DOES:
//   1. Detects OAuth callback URL → renders AuthCallback instead
//   2. Checks localStorage for session synchronously (< 1ms) → fast path
//   3. Fetches profile + admin in ONE parallel round trip
//   4. Opens app immediately — onboarding handled by OnboardingGate inside app
//
// CONTEXT PROVIDED:
//   { user, profile, isAdmin, adminData }
//   All consumers use useAuth() to read these.
// ============================================================================

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  createContext,
  useContext,
} from "react";
import AuthFlow from "./AuthFlow";
import AuthCallback from "./AuthCallback";
import { supabase } from "../../services/config/supabase";

// ── Context ───────────────────────────────────────────────────────────────────
export const AuthContext = createContext({
  user: null,
  profile: null,
  isAdmin: false,
  adminData: null,
});
export const useAuth = () => useContext(AuthContext);

const log = (...a) => {
  if (process.env.NODE_ENV === "development") console.log("[AppGate]", ...a);
};

// ── OAuth callback detection — runs once at module load ──────────────────────
const IS_CALLBACK = (() => {
  try {
    const { pathname, search, hash } = window.location;
    const full = pathname + search + hash;
    return (
      full.includes("code=") ||
      full.includes("access_token=") ||
      full.includes("type=recovery") ||
      full.includes("type=signup") ||
      pathname.includes("/auth/callback") ||
      pathname.includes("/callback")
    );
  } catch {
    return false;
  }
})();

// ── Sync localStorage session check — zero network, < 1ms ───────────────────
function readStoredSession() {
  try {
    const raw = localStorage.getItem("xeevia-auth-token");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const session = parsed?.currentSession ?? parsed;
    if (!session?.access_token || !session?.user?.id) return null;
    const nowSecs = Math.floor(Date.now() / 1000);
    if ((session.expires_at ?? 0) > 0 && nowSecs > session.expires_at + 120)
      return null;
    return session;
  } catch {
    return null;
  }
}

// ── Parallel profile + admin fetch — one round trip ──────────────────────────
async function fetchUserData(userId) {
  const [profileRes, adminRes] = await Promise.allSettled([
    supabase
      .from("profiles")
      .select(
        "id,username,full_name,account_activated,security_level,avatar_id,is_pro,verified,payment_status",
      )
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("admin_team")
      .select("role,status,permissions,full_name,email,user_id")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  const profile =
    profileRes.status === "fulfilled" ? (profileRes.value.data ?? null) : null;
  const adminRow =
    adminRes.status === "fulfilled" ? (adminRes.value.data ?? null) : null;

  return { profile, adminData: adminRow, isAdmin: !!adminRow };
}

// ── Loading Screen ────────────────────────────────────────────────────────────
const LoadingScreen = React.memo(() => (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "linear-gradient(160deg, #000 0%, #060806 50%, #020202 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "24px",
      zIndex: 9999,
    }}
  >
    <div style={{ position: "relative" }}>
      <div
        style={{
          fontSize: "clamp(44px, 11vw, 68px)",
          fontWeight: 900,
          letterSpacing: "-3px",
          lineHeight: 1,
          background:
            "linear-gradient(135deg, #c8f542 0%, #84cc16 55%, #65a30d 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          fontFamily: "'Syne', 'Space Grotesk', sans-serif",
        }}
      >
        XEEVIA
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse, rgba(132,204,22,0.1) 0%, transparent 70%)",
          filter: "blur(24px)",
        }}
      />
    </div>
    <div
      style={{
        fontSize: 10,
        letterSpacing: "4px",
        color: "#1a2a05",
        textTransform: "uppercase",
        fontWeight: 700,
        marginTop: "-8px",
      }}
    >
      Own Your Social
    </div>
    <div
      style={{
        width: 30,
        height: 30,
        border: "2px solid rgba(132,204,22,0.07)",
        borderTop: "2px solid #84cc16",
        borderRadius: "50%",
        animation: "xvSpin 0.72s linear infinite",
      }}
    />
    <style>{`@keyframes xvSpin { to { transform: rotate(360deg); } }`}</style>
  </div>
));
LoadingScreen.displayName = "LoadingScreen";

// ── Root ──────────────────────────────────────────────────────────────────────
export default function AppGate({ children }) {
  if (IS_CALLBACK) return <AuthCallback />;
  return <AppGateInner>{children}</AppGateInner>;
}

// ── AppGateInner ──────────────────────────────────────────────────────────────
function AppGateInner({ children }) {
  const [phase, setPhase] = useState("loading");
  const [authCtx, setAuthCtx] = useState({
    user: null,
    profile: null,
    isAdmin: false,
    adminData: null,
  });

  const mounted = useRef(true);
  const settled = useRef(false);
  const inApp = useRef(false);
  const entering = useRef(false);
  const cache = useRef({});

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const fetchData = useCallback(async (userId) => {
    if (cache.current[userId]) return cache.current[userId];
    const data = await fetchUserData(userId);
    cache.current[userId] = data;
    return data;
  }, []);

  const enterApp = useCallback(
    async (authUser) => {
      if (!authUser?.id || !mounted.current || entering.current) return;
      entering.current = true;
      inApp.current = true;
      log("enterApp →", authUser.id.slice(0, 8));

      try {
        const data = await fetchData(authUser.id);
        if (!mounted.current) return;
        setAuthCtx({ user: authUser, ...data });
        settled.current = true;
        setPhase("app");
        log("enterApp complete");
      } catch {
        // Auth succeeded — still open app even if profile fetch failed
        if (mounted.current) {
          setAuthCtx({
            user: authUser,
            profile: null,
            isAdmin: false,
            adminData: null,
          });
          settled.current = true;
          setPhase("app");
        }
      } finally {
        entering.current = false;
      }
    },
    [fetchData],
  );

  const showAuth = useCallback(() => {
    if (!mounted.current) return;
    settled.current = true;
    inApp.current = false;
    entering.current = false;
    setAuthCtx({ user: null, profile: null, isAdmin: false, adminData: null });
    setPhase("auth");
  }, []);

  useEffect(() => {
    log("Boot");

    // FAST PATH — stored session found
    const stored = readStoredSession();
    if (stored?.user?.id) {
      log("Fast path →", stored.user.id.slice(0, 8));
      enterApp(stored.user);
      supabase.auth.getSession().catch(() => {});
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted.current) return;
      log(`${event} | settled=${settled.current} inApp=${inApp.current}`);

      switch (event) {
        case "INITIAL_SESSION": {
          if (settled.current) break;
          if (session?.user) enterApp(session.user);
          else showAuth();
          break;
        }

        case "SIGNED_IN": {
          if (!session?.user) break;
          if (!inApp.current) {
            entering.current = false;
            await enterApp(session.user);
          } else {
            // Token refresh while in app — update user silently
            setAuthCtx((prev) => ({ ...prev, user: session.user }));
          }
          break;
        }

        case "TOKEN_REFRESHED": {
          if (inApp.current && session?.user && mounted.current) {
            setAuthCtx((prev) => ({ ...prev, user: session.user }));
          }
          break;
        }

        case "USER_UPDATED": {
          if (inApp.current && session?.user && mounted.current) {
            delete cache.current[session.user.id];
            const data = await fetchData(session.user.id);
            if (mounted.current) setAuthCtx({ user: session.user, ...data });
          }
          break;
        }

        case "SIGNED_OUT": {
          log("SIGNED_OUT");
          settled.current = false;
          inApp.current = false;
          entering.current = false;
          cache.current = {};
          showAuth();
          break;
        }

        default:
          break;
      }
    });

    // SLOW PATH — no stored session, wait for INITIAL_SESSION or getSession()
    if (!stored?.user?.id) {
      supabase.auth
        .getSession()
        .then(({ data: { session } }) => {
          if (!mounted.current || settled.current) return;
          if (session?.user) enterApp(session.user);
          else showAuth();
        })
        .catch(() => {
          if (!settled.current && mounted.current) showAuth();
        });
    }

    return () => {
      try {
        subscription?.unsubscribe();
      } catch {}
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Called by AuthFlow after email OTP verify (non-OAuth path)
  const handleAuthComplete = useCallback(
    (authUser, authProfile = null, authAdmin = null) => {
      if (!mounted.current || !authUser?.id) return;

      cache.current[authUser.id] = {
        profile: authProfile,
        isAdmin: !!authAdmin,
        adminData: authAdmin,
      };

      inApp.current = true;
      settled.current = true;
      entering.current = false;

      setAuthCtx({
        user: authUser,
        profile: authProfile,
        isAdmin: !!authAdmin,
        adminData: authAdmin,
      });
      setPhase("app");
      log("handleAuthComplete → app");
    },
    [],
  );

  if (phase === "loading") return <LoadingScreen />;

  if (phase === "auth") {
    return (
      <AuthContext.Provider
        value={{ user: null, profile: null, isAdmin: false, adminData: null }}
      >
        <AuthFlow onAuthComplete={handleAuthComplete} />
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={authCtx}>{children}</AuthContext.Provider>
  );
}
