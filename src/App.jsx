// ============================================================================
// src/App.jsx — v25 PUSH STARTUP RACE FIXED
// ============================================================================
//
// CHANGES vs v24:
//   [PUSH-FIX-1] pushService.start() is no longer inside a setTimeout(2000).
//                The bridge is now attached in index.js before React renders
//                (via attachBridgeEarly()), so there is no race. start() can
//                be called immediately after the 2s guard was just protecting
//                against. Removing the delay means subscriptions are created
//                faster and PENDING_PAYLOADS are drained without a 2-second gap.
//   [PUSH-FIX-2] push:needs_permission listener added inside the init useEffect
//                so when the SW dispatches the event (on first visit with
//                Notification.permission === "default") a non-blocking nudge
//                can show the permission prompt on the next user gesture.
//                This uses window.__pushUserId set by index.js + a custom
//                window.__xvRequestPushPermission hook that any component
//                (e.g. AccountView settings) can call from a button click.
//   [PUSH-FIX-3] The unified push useEffect now also handles "push_received"
//                for general notifications that are NOT incoming_call — they
//                are forwarded directly to the InAppNotificationToast via
//                addToastRef so in-app toasts fire even when the user has
//                not scrolled to the notifications tab.
//   All v24 logic preserved exactly.
// ============================================================================

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  lazy,
  Suspense,
  memo,
} from "react";
import "./styles/global.css";
import "./styles/comment.css";
import "./styles/SideBar.css";
import "./styles/create.css";
import "./styles/HomeView.css";
import "./styles/PostCard.css";
import "./styles/ReelCard.css";
import "./styles/StoryCard.css";
import "./styles/ProfileModal.css";
import "./styles/Draft.css";
import "./styles/lightTheme.css";

import { supabase }               from "./services/config/supabase";
import mediaUrlService             from "./services/shared/mediaUrlService";
import { pushService }             from "./services/notifications/pushService";
import notificationService         from "./services/notifications/notificationService";
import MessageNotificationService  from "./services/messages/MessageNotificationService";
import callService                 from "./services/messages/callService";
import { useNavigation }           from "./hooks/useNavigation";
import { useBackButton }           from "./hooks/useBackButton";
import { usePullToRefresh }        from "./hooks/usePullToRefresh";

// Auth system
import AuthProvider, { useAuth } from "./components/Auth/AuthContext";
import AuthWall, { Splash }      from "./components/Auth/AuthWall";
import BoostStyles               from "./components/Boost/BoostStyles";

// Payment gate
import { canAccessApp } from "./services/auth/paymentGate";

// Shared UI
const DesktopHeader = lazy(() => import("./components/Shared/DesktopHeader"));
const MobileHeader = lazy(() => import("./components/Shared/MobileHeader"));
const MobileBottomNav = lazy(() => import("./components/Shared/MobileBottomNav"));
const Sidebar = lazy(() => import("./components/Shared/Sidebar"));
const AdminSidebar = lazy(() => import("./components/Shared/AdminSidebar"));
const SupportSidebar = lazy(() => import("./components/Shared/SupportSidebar"));
const NotificationSidebar = lazy(() => import("./components/Shared/NotificationSidebar"));
const InAppNotificationToast = lazy(() => import("./components/Shared/InAppNotificationToast"));
const PushPermissionNudge = lazy(() => import("./components/Shared/PushPermissionNudge"));
const AccountSwitchPrompt = lazy(() => import("./components/Shared/AccountSwitchPrompt"));
const PullToRefreshIndicator = lazy(() => import("./components/Shared/PullToRefreshIndicator"));
const NetworkError = lazy(() => import("./components/Shared/NetworkError"));
const IncomingCallToast = lazy(() => import("./components/Messages/IncomingCallToast"));
import xrcService              from "./services/xrc";
// DEV REMINDER: Keep account/security/profile writes inside XRC-aware services.
// Never bypass `xrcService.writeRecord` or direct profile updates for verified user writes.
// This ensures audit trails can trace posts, wallet transfers, profile changes, and security updates.

// Admin dashboard
const AdminDashboard = lazy(() => import("./components/Admin/AdminDashboard"));

// ── TRACK A: Keep-alive tab views ─────────────────────────────────────────────
const HomeView        = lazy(() => import("./components/Home/HomeView"));
const ExploreView     = lazy(() => import("./components/Explore/ExploreView"));
const CreateView      = lazy(() => import("./components/Create/CreateView"));
const AccountView     = lazy(() => import("./components/Account/AccountView"));
const WalletView      = lazy(() => import("./components/wallet/WalletView"));
const CommunityView   = lazy(() => import("./components/Community/CommunityView"));
const TrendingSidebar = lazy(() => import("./components/Shared/TrendingSidebar"));

// ── TRACK B: Full-screen overlay views ───────────────────────────────────────
const AnalyticsView  = lazy(() => import("./components/Analytics/AnalyticsView"));
const UpgradeView    = lazy(() => import("./components/Upgrade/UpgradeView"));
const RewardsView    = lazy(() => import("./components/Rewards/RewardsView"));
const StreamView     = lazy(() => import("./components/Stream/StreamView"));
const GiftCardsView  = lazy(() => import("./components/GiftCards/GiftCardsView"));
const DMMessagesView = lazy(() => import("./components/Messages/DMMessagesView"));
const ActiveCall     = lazy(() => import("./components/Messages/ActiveCall"));
const AmbassadorView = lazy(() => import("./components/Ambassador/AmbassadorView"));

// ── Overlay tab IDs ───────────────────────────────────────────────────────────
const OVERLAY_TABS = new Set([
  "analytics", "upgrade", "rewards", "stream", "giftcards", "ambassador",
]);
const PSEUDO_TABS = new Set(["support", "notifications", "trending"]); // eslint-disable-line

// ── Helpers ───────────────────────────────────────────────────────────────────
const checkMobile = () => window.innerWidth <= 768;

function hasOAuthCodeInUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has("error") || params.has("error_code")) {
      const url = new URL(window.location.href);
      ["error", "error_code", "error_description", "state", "code"].forEach(
        (k) => url.searchParams.delete(k),
      );
      window.history.replaceState({}, "", url.toString());
      return false;
    }
    const code = params.get("code");
    return !!(code && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(code));
  } catch {
    return false;
  }
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
const TabSkeleton = memo(() => (
  <div style={{ padding: "24px 16px" }}>
    {[1, 2, 3].map((i) => (
      <div
        key={i}
        style={{
          height:          "80px",
          background:      "var(--surface)",
          borderRadius:    "12px",
          marginBottom:    "12px",
          animation:       "skPulse 1.4s ease-in-out infinite",
          animationDelay:  `${i * 0.15}s`,
        }}
      />
    ))}
    <style>{`@keyframes skPulse{0%,100%{opacity:.5}50%{opacity:.15}}`}</style>
  </div>
));
TabSkeleton.displayName = "TabSkeleton";

// ── Offline banner ────────────────────────────────────────────────────────────
const OfflineBanner = memo(({ visible }) => {
  if (!visible) return null;
  return (
    <div
      style={{
        position:       "fixed",
        top:            0,
        left:           0,
        right:          0,
        zIndex:         99998,
        background:     "var(--danger-bg)",
        color:          "var(--accent-inverse-text)",
        textAlign:      "center",
        padding:        "9px 16px",
        fontSize:       "12.5px",
        fontWeight:     "600",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        gap:            "8px",
        backdropFilter: "blur(4px)",
      }}
    >
      <span>📡</span> No internet connection — your session is safe, reconnecting…
    </div>
  );
});
OfflineBanner.displayName = "OfflineBanner";

// ── Preload tabs ──────────────────────────────────────────────────────────────
function preloadTabs() {
  [
    () => import("./components/Home/HomeView"),
    () => import("./components/Explore/ExploreView"),
    () => import("./components/wallet/WalletView"),
    () => import("./components/Account/AccountView"),
    () => import("./components/Community/CommunityView"),
    () => import("./components/Create/CreateView"),
    () => import("./components/Shared/TrendingSidebar"),
    () => import("./components/Analytics/AnalyticsView"),
    () => import("./components/Upgrade/UpgradeView"),
    () => import("./components/Rewards/RewardsView"),
    () => import("./components/Stream/StreamView"),
    () => import("./components/GiftCards/GiftCardsView"),
    () => import("./components/Messages/DMMessagesView"),
    () => import("./components/Messages/ActiveCall"),
    () => import("./components/Ambassador/AmbassadorView"),
  ].forEach((fn, i) => setTimeout(() => fn().catch(() => {}), 300 + i * 250));
}

// ── MainApp ───────────────────────────────────────────────────────────────────
const MainApp = memo(() => {
  const { user, profile, isAdmin, adminData, signOut, signOutAllDevices } = useAuth(); // eslint-disable-line

  const [currentUser, setCurrentUser] = useState(() => ({
    id:       user?.id,
    name:     profile?.full_name || "User",
    username: profile?.username  || "user",
    avatar:   profile?.full_name?.charAt(0)?.toUpperCase() || "X",
    verified: profile?.verified  || false,
    fullName: profile?.full_name || "User",
  }));

  const [userBalance,        setUserBalance]        = useState({ tokens: 0, points: 0 });
  const [profileData,        setProfileData]        = useState(null);
  const [activeTab,          setActiveTab]          = useState("home");
  const [overlayTab,         setOverlayTab]         = useState(null);
  const [isMobile,           setIsMobile]           = useState(checkMobile);
  const [sidebarOpen,        setSidebarOpen]        = useState(true);
  const [accountSection,     setAccountSection]     = useState("profile");
  const [homeSection,        setHomeSection]        = useState("newsfeed");
  const [isSubscribed,       setIsSubscribed]       = useState(profile?.is_pro || false);
  const [showNotifications,  setShowNotifications]  = useState(false);
  const [showSupport,        setShowSupport]        = useState(false);
  const [refreshTrigger,     setRefreshTrigger]     = useState(0);
  const [lastRefreshTime,    setLastRefreshTime]    = useState(Date.now());
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [isOnline,           setIsOnline]           = useState(navigator.onLine);
  const [showOfflineBanner,  setShowOfflineBanner]  = useState(false);
  const [mountedTabs,        setMountedTabs]        = useState(new Set(["home", "search", "create", "community", "account", "wallet"]));
  const [deepLinkTarget,     setDeepLinkTarget]     = useState(null);
  const [themeMode,         setThemeMode]         = useState(() => {
    if (typeof window === "undefined") return "dark";
    const stored = window.localStorage.getItem("xv_theme_mode");
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
  });

  // DM panel state
  const [showMessages,   setShowMessages]   = useState(false);
  const [dmTargetUserId, setDmTargetUserId] = useState(null);

  // Active call overlay
  const [showActiveCall,   setShowActiveCall]   = useState(false);
  const [acceptedCallData, setAcceptedCallData] = useState(null);

  // Feed / stream state
  const [feedFilter,    setFeedFilter]    = useState(null);
  const [streamSession, setStreamSession] = useState(null);

  const [activeHomeTab, setActiveHomeTab] = useState("feed");

  const feedRef        = useRef(null);
  const refreshTimeout = useRef(null);
  const netCheckRef    = useRef(null);
  const initDone       = useRef(false);
  const addToastRef    = useRef(null);

  const { isAtRoot } = useNavigation(
    activeTab, homeSection, accountSection,
    setActiveTab, setHomeSection, setAccountSection,
  );
  const { showExitPrompt } = useBackButton(isAtRoot);

  // ── Resize ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const onResize = () => {
      const mobile = checkMobile();
      setIsMobile(mobile);
      if (mobile) setShowAdminDashboard(false);
    };
    onResize();
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── Network ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const goOnline  = () => { setIsOnline(true);  setShowOfflineBanner(false); };
    const goOffline = () => { setIsOnline(false); setShowOfflineBanner(true);  };
    window.addEventListener("online",  goOnline);
    window.addEventListener("offline", goOffline);
    netCheckRef.current = setInterval(() => {
      if (navigator.onLine !== isOnline) {
        navigator.onLine ? goOnline() : goOffline();
      }
    }, 5000);
    return () => {
      window.removeEventListener("online",  goOnline);
      window.removeEventListener("offline", goOffline);
      clearInterval(netCheckRef.current);
    };
  }, [isOnline]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.toggle("theme-light", themeMode === "light");
    root.classList.toggle("theme-dark", themeMode === "dark");
    window.localStorage.setItem("xv_theme_mode", themeMode);
  }, [themeMode]);

  useEffect(() => {
    const pref = profile?.preferences?.theme_mode || profile?.preferences?.themeMode;
    const normalized = pref === "light" ? "light" : pref === "dark" ? "dark" : null;
    if (normalized && normalized !== themeMode) {
      setThemeMode(normalized);
    }
  }, [profile?.preferences]);

  // ── Notification deep-link navigate ──────────────────────────────────────
  const handleNotificationNavigate = useCallback((path) => {
    if (!path || path === "/") return;

    if (path === "/messages" || path.startsWith("/messages")) {
      setShowMessages(true);
      setDmTargetUserId(null);
      return;
    }

    const postMatch    = path.match(/^\/post\/(.+)$/);
    const reelMatch    = path.match(/^\/reel\/(.+)$/);
    const storyMatch   = path.match(/^\/story\/(.+)$/);
    const profileMatch = path.match(/^\/profile\/(.+)$/);

    if (postMatch) {
      setActiveTab("home"); setHomeSection("newsfeed");
      setDeepLinkTarget({ type: "post", id: postMatch[1] });
      setMountedTabs((p) => new Set([...p, "home"]));
    } else if (reelMatch) {
      setActiveTab("home"); setHomeSection("reels");
      setDeepLinkTarget({ type: "reel", id: reelMatch[1] });
      setMountedTabs((p) => new Set([...p, "home"]));
    } else if (storyMatch) {
      setActiveTab("home"); setHomeSection("stories");
      setDeepLinkTarget({ type: "story", id: storyMatch[1] });
      setMountedTabs((p) => new Set([...p, "home"]));
    } else if (profileMatch) {
      const targetId = profileMatch[1];
      if (targetId === user?.id) {
        setActiveTab("account");
        setMountedTabs((p) => new Set([...p, "account"]));
      } else {
        setActiveTab("search");
        setDeepLinkTarget({ type: "profile", id: targetId });
        setMountedTabs((p) => new Set([...p, "search"]));
      }
    } else if (path === "/account") {
      setActiveTab("account");
      setMountedTabs((p) => new Set([...p, "account"]));
    }

    setShowAdminDashboard(false);
    setOverlayTab(null);
  }, [user?.id]);

  // ── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (initDone.current || !user?.id || !profile) return;
    initDone.current = true;

    callService.init(
      user.id,
      profile.full_name || "User",
      profile.avatar_id || null,
    );

    notificationService.init(user.id).catch(() => {});

    MessageNotificationService.init(user.id, (toast) => {
      addToastRef.current?.(toast);
    });

    // [PUSH-FIX-1] No setTimeout — bridge is already attached via
    // attachBridgeEarly() in index.js. start() is safe to call immediately.
    if (navigator.onLine) {
      pushService.start(user.id).catch(() => {});
    } else {
      // If offline at mount, start() when connectivity returns.
      // pushService.start() itself handles the online event internally,
      // but we still need to call it to set _userId and attach the visibility check.
      pushService.start(user.id).catch(() => {});
    }

    // [PUSH-FIX-2] Expose a hook so any component (e.g. account settings
    // "Enable notifications" button) can trigger the permission flow from
    // within a user gesture without importing pushService directly.
    window.__xvRequestPushPermission = async () => {
      const granted = await pushService.enablePushNotifications(user.id);
      if (granted) {
        console.log("[App] Push permission granted and subscription created");
      }
      return granted;
    };

    loadWalletAndAvatar(user.id, profile).catch(() => {});
    preloadTabs();

    setTimeout(() => {
      try {
        supabase
          .rpc("end_my_live_sessions", { p_user_id: user.id })
          .then(() => {})
          .catch(() => {});
      } catch (_) {}
    }, 3000);

    return () => clearTimeout(refreshTimeout.current);
  }, [user?.id, profile]); // eslint-disable-line

  // ── UNIFIED PUSH + CALL EVENT HANDLER ────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;

    // ── OS / SW notification tapped → navigate ──────────────────────────
    const unsubClick = pushService.on("notification_clicked", ({ url }) => {
      if (url) handleNotificationNavigate(url);
    });

    // ── SW updated ───────────────────────────────────────────────────────
    const unsubSwUpdate = pushService.on("sw_updated", ({ version }) => {
      console.log("[App] SW updated to", version);
    });

    // ── Incoming call arrived via push (app backgrounded/closed) ─────────
    const unsubCallPush = pushService.on("incoming_call_push", (callData) => {
      if (!callData) return;
      callService._onIncomingCall({
        callId:         callData.call_id          || callData.callId,
        callType:       callData.call_type         || callData.callType        || "audio",
        type:           callData.call_type         || callData.callType        || "audio",
        callerId:       callData.actor_user_id     || callData.callerId,
        callerName:     callData.caller_name       || callData.callerName      || "Caller",
        name:           callData.caller_name       || callData.callerName      || "Caller",
        callerAvatarId: callData.caller_avatar_id  || callData.callerAvatarId  || null,
        callerAvId:     callData.caller_avatar_id  || callData.callerAvatarId  || null,
        caller: {
          id:        callData.actor_user_id     || null,
          full_name: callData.caller_name       || "Caller",
          avatar_id: callData.caller_avatar_id  || null,
        },
      });
    });

    // ── OS notification: user tapped "Accept" on call notification ────────
    const unsubAcceptNotif = pushService.on("call_accepted_from_notification", (callData) => {
      if (!callData) return;
      setAcceptedCallData({
        callId:   callData.call_id     || callData.callId,
        name:     callData.caller_name || callData.callerName || "Caller",
        type:     callData.call_type   || callData.callType   || "audio",
        outgoing: false,
        user: {
          id:        callData.actor_user_id    || null,
          full_name: callData.caller_name      || "Caller",
          avatar_id: callData.caller_avatar_id || null,
        },
      });
      setShowActiveCall(true);
      setShowMessages(false);
    });

    // ── OS notification: user tapped "Decline" on call notification ───────
    const unsubDeclineNotif = pushService.on("call_declined_from_notification", (callData) => {
      if (!callData) return;
      const callId   = callData.call_id || callData.callId;
      const callerId = callData.actor_user_id || null;
      if (callId) callService.declineCall(callId, callerId);
    });

    // ── [PUSH-FIX-3] General push_received → in-app toast ─────────────────
    // Ensures non-call push notifications show an in-app toast when the app
    // is open. InAppNotificationToast also subscribes to this via pushService
    // directly, so dedup in that component prevents double-toasts.
    const unsubPushReceived = pushService.on("push_received", (payload) => {
      if (!payload) return;
      const type = payload?.data?.type || "general";
      // incoming_call handled by IncomingCallToast, not a toast
      if (type === "incoming_call") return;
      // dm handled by MessageNotificationService
      if (type === "dm") return;
      // All other types: forward to InAppNotificationToast via addToastRef
      if (addToastRef.current) {
        addToastRef.current({
          type,
          title:   payload.title  || null,
          message: payload.body   || payload?.data?.message || "",
          data:    payload.data   || {},
        });
      }
    });

    // ── In-app toast: user tapped "Accept" inside the app ────────────────
    const handleInAppAccept = (e) => {
      const callData = e.detail;
      if (!callData) return;
      setAcceptedCallData({ ...callData, outgoing: false });
      setShowActiveCall(true);
      setShowMessages(false);
    };
    window.addEventListener("nova:accept_call", handleInAppAccept);

    // ── Cold start: app opened via ?accept_call=<id> deep link ───────────
    const params           = new URLSearchParams(window.location.search);
    const coldAcceptCallId = params.get("accept_call");
    if (coldAcceptCallId) {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("accept_call");
      window.history.replaceState({}, "", cleanUrl.toString());
      setShowMessages(true);
    }

    return () => {
      unsubClick();
      unsubSwUpdate();
      unsubCallPush();
      unsubAcceptNotif();
      unsubDeclineNotif();
      unsubPushReceived();
      window.removeEventListener("nova:accept_call", handleInAppAccept);
    };
  }, [user?.id, handleNotificationNavigate]); // eslint-disable-line

  // ── Auto-refresh (desktop) ───────────────────────────────────────────────
  useEffect(() => {
    if (!isMobile && isOnline) {
      const tick = () => {
        setRefreshTrigger((p) => p + 1);
        refreshTimeout.current = setTimeout(tick, 30_000);
      };
      refreshTimeout.current = setTimeout(tick, 30_000);
    }
    return () => clearTimeout(refreshTimeout.current);
  }, [isMobile, isOnline]);

  // ── Visibility / focus recovery ──────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    let lastHidden = 0;

    const onVisible = async () => {
      if (document.hidden) { lastHidden = Date.now(); return; }
      const awayMs = Date.now() - lastHidden;
      if (awayMs < 30_000) return;
      try {
        const { error } = await supabase.auth.refreshSession();
        if (error) {
          console.warn("[Session] Token refresh failed after background:", error.message);
          return;
        }
        loadWalletAndAvatar(user.id, null).catch(() => {});
        setRefreshTrigger((p) => p + 1);
      } catch { /* Network offline */ }
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [user?.id]); // eslint-disable-line

  // ── Load wallet + avatar ─────────────────────────────────────────────────
  const loadWalletAndAvatar = async (userId, p) => {
    try {
      const { data: w } = await supabase
        .from("wallets")
        .select("xev_tokens,engagement_points")
        .eq("user_id", userId)
        .maybeSingle();
      if (w) setUserBalance({ tokens: w.xev_tokens || 0, points: w.engagement_points || 0 });
      if (p) {
        let avatarUrl = null;
        if (p.avatar_id) {
          const base = mediaUrlService.getImageUrl(p.avatar_id);
          if (base && typeof base === "string") {
            const clean = base.split("?")[0];
            avatarUrl = clean.includes("supabase")
              ? `${clean}?quality=100&width=400&height=400&resize=cover&format=webp&t=${Date.now()}`
              : base;
          }
        }
        const userObj = {
          id:        p.id || userId,
          name:      p.full_name || "User",
          username:  p.username  || "user",
          avatar:    avatarUrl || p.full_name?.charAt(0)?.toUpperCase() || "X",
          verified:  p.verified || false,
          fullName:  p.full_name || "User",
          avatarId:  p.avatar_id || null,
          avatar_id: p.avatar_id || null,
        };
        setCurrentUser(userObj);
        setProfileData({
          id:       p.id,
          fullName: p.full_name,
          username: p.username,
          avatar:   avatarUrl,
          verified: p.verified,
          isPro:    p.is_pro,
        });
        setIsSubscribed(p.is_pro || false);
        callService.init(userId, p.full_name, p.avatar_id);
      }
    } catch { /* Silent */ }
  };

  const handleRefresh = useCallback(async () => {
    if (!isOnline) return;
    const now = Date.now();
    if (now - lastRefreshTime < 2000) return;
    setLastRefreshTime(now);
    setRefreshTrigger((p) => p + 1);
    loadWalletAndAvatar(user.id, profile).catch(() => {});
  }, [isOnline, lastRefreshTime, user?.id, profile]); // eslint-disable-line

  const { containerRef, isPulling, pullDistance, isRefreshing } =
    usePullToRefresh(handleRefresh, isMobile && !!user);

  const handleProfileUpdate = useCallback((up) => {
    setProfileData(up);
    setCurrentUser((prev) => ({
      ...prev,
      fullName: up.fullName,
      username: up.username,
      avatar:   up.avatar,
      verified: up.verified,
    }));
  }, []);

  // ── Sign out ─────────────────────────────────────────────────────────────
  const handleSignOut = useCallback(async () => {
    try {
      if (user?.id) {
        await pushService.unsubscribe(user.id).catch(() => {});
        notificationService.destroy();
        MessageNotificationService.cleanup();
        callService.cleanup();
      }
    } catch {}
    await signOut();
  }, [user?.id, signOut]);

  const getGreeting = useCallback(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  }, []);

  const handleJoinStream = useCallback((session) => {
    setStreamSession(session);
    setOverlayTab("stream");
  }, []);

  // ── MASTER NAVIGATION HANDLER ────────────────────────────────────────────
  const handleTabChange = useCallback((newTab) => {
    if (newTab === "support")       { setShowSupport(true);       return; }
    if (newTab === "notifications") { setShowNotifications(true); return; }
    if (newTab === "messages")      { setShowMessages(true);      return; }
    if (newTab === "trending") {
      if (isMobile) {
        setActiveTab("search");
        setMountedTabs((p) => new Set([...p, "search"]));
        setShowAdminDashboard(false);
      }
      return;
    }
    if (newTab === "admin") {
      if (isAdmin) setShowAdminDashboard(true);
      return;
    }
    if (OVERLAY_TABS.has(newTab)) {
      if (newTab !== "stream") setStreamSession(null);
      setOverlayTab(newTab);
      return;
    }
    if (newTab !== "home") setFeedFilter(null);
    setOverlayTab(null);
    setActiveTab(newTab);
    setShowAdminDashboard(false);
    setMountedTabs((p) => { if (p.has(newTab)) return p; return new Set([...p, newTab]); });
  }, [isAdmin, isMobile]);

  const closeOverlayToAccount = useCallback(() => {
    setOverlayTab(null);
    setStreamSession(null);
    setActiveTab("account");
    setMountedTabs((p) => new Set([...p, "account"]));
  }, []);

  const closeOverlayToHome = useCallback(() => {
    setOverlayTab(null);
    setStreamSession(null);
    setActiveTab("home");
    setMountedTabs((p) => new Set([...p, "home"]));
  }, []);

  const viewProps    = { currentUser, userId: user.id, refreshTrigger, deepLinkTarget, themeMode, setThemeMode };
  const showTrending = activeTab !== "community" && activeTab !== "wallet";

  // ── Tab content ──────────────────────────────────────────────────────────
  const renderContent = () => {
    const tabs = [
      {
        id: "home",
        el: (
          <Suspense fallback={<TabSkeleton />}>
            <div ref={feedRef}>
              <HomeView
                {...viewProps}
                homeSection={homeSection}
                setHomeSection={setHomeSection}
                feedFilter={feedFilter}
                onClearFilter={() => setFeedFilter(null)}
                onJoinStream={handleJoinStream}
                activeHomeTab={activeHomeTab}
                setActiveHomeTab={setActiveHomeTab}
              />
            </div>
          </Suspense>
        ),
      },
      {
        id: "search",
        el: (
          <Suspense fallback={<TabSkeleton />}>
            <ExploreView {...viewProps} xrcService={xrcService} />
          </Suspense>
        ),
      },
      {
        id: "create",
        el: (
          <Suspense fallback={<TabSkeleton />}>
            <CreateView currentUser={currentUser} userId={user.id} />
          </Suspense>
        ),
      },
      {
        id: "community",
        el: (
          <Suspense fallback={<TabSkeleton />}>
            <CommunityView {...viewProps} />
          </Suspense>
        ),
      },
      {
        id: "account",
        el: (
          <Suspense fallback={<TabSkeleton />}>
            <AccountView
              {...viewProps}
              accountSection={accountSection}
              setAccountSection={setAccountSection}
              setActiveTab={handleTabChange}
              isSubscribed={isSubscribed}
              onSignOut={handleSignOut}
              onProfileLoad={handleProfileUpdate}
              onNavigate={handleTabChange}
            />
          </Suspense>
        ),
      },
      {
        id: "wallet",
        el: (
          <Suspense fallback={<TabSkeleton />}>
            <WalletView
              userBalance={userBalance}
              setUserBalance={setUserBalance}
              isMobile={isMobile}
              userId={user.id}
              refreshTrigger={refreshTrigger}
            />
          </Suspense>
        ),
      },
    ];

    return (
      <>
        {tabs.map(({ id, el }) => {
          if (!mountedTabs.has(id)) return null;
          const isActive = activeTab === id && !showAdminDashboard && !overlayTab;
          return (
            <div key={id} style={{ display: isActive ? "block" : "none", width: "100%" }}>
              {el}
            </div>
          );
        })}
      </>
    );
  };

  // ── Overlay views ────────────────────────────────────────────────────────
  const renderOverlay = () => {
    if (!overlayTab) return null;
    switch (overlayTab) {
      case "analytics":
        return (
          <Suspense fallback={null}>
            <AnalyticsView
              currentUser={currentUser}
              userId={user.id}
              onClose={closeOverlayToAccount}
            />
          </Suspense>
        );
      case "upgrade":
        return (
          <Suspense fallback={null}>
            <UpgradeView currentUser={currentUser} onClose={closeOverlayToAccount} />
          </Suspense>
        );
      case "rewards":
        return (
          <Suspense fallback={null}>
            <RewardsView
              currentUser={currentUser}
              userId={user.id}
              onClose={closeOverlayToAccount}
            />
          </Suspense>
        );
      case "stream":
        return (
          <Suspense fallback={null}>
            <StreamView
              currentUser={currentUser}
              userId={user.id}
              onClose={closeOverlayToHome}
              streamSession={streamSession}
            />
          </Suspense>
        );
      case "giftcards":
        return (
          <Suspense fallback={null}>
            <GiftCardsView
              currentUser={currentUser}
              userId={user.id}
              onClose={closeOverlayToAccount}
            />
          </Suspense>
        );
      case "ambassador":
        return (
          <Suspense fallback={null}>
            <div
              style={{
                position:   "fixed",
                inset:      0,
                zIndex:     9500,
                background: "var(--bg-strong)",
                overflowY:  "auto",
                fontFamily: "'DM Sans','Inter',system-ui,sans-serif",
              }}
            >
              <div
                style={{
                  position:     "sticky",
                  top:          0,
                  zIndex:       10,
                  display:      "flex",
                  alignItems:   "center",
                  gap:          10,
                  padding:      isMobile ? "12px 16px" : "14px 24px",
                  background:   "var(--surface-strong)",
                  backdropFilter: "blur(12px)",
                  borderBottom: "1px solid var(--surface-border)",
                }}
              >
                <button
                  onClick={closeOverlayToAccount}
                  style={{
                    display:    "flex",
                    alignItems: "center",
                    gap:        7,
                    background: "transparent",
                    border:     "none",
                    color:      "var(--accent)",
                    fontWeight: 700,
                    fontSize:   13,
                    cursor:     "pointer",
                    fontFamily: "inherit",
                    padding:    "6px 0",
                  }}
                >
                  ← Back
                </button>
              </div>
              <AmbassadorView userId={user.id} userProfile={currentUser} />
            </div>
          </Suspense>
        );
      default:
        return null;
    }
  };

  // ── Sidebar ──────────────────────────────────────────────────────────────
  const renderSidebar = () => {
    if (isMobile || showAdminDashboard) return null;
    if (isAdmin) {
      return (
        <Suspense fallback={null}>
          <AdminSidebar
            activeTab={activeTab}
            setActiveTab={handleTabChange}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            onSignOut={handleSignOut}
            user={user}
            adminData={adminData}
            onOpenDashboard={() => setShowAdminDashboard(true)}
            xrcService={xrcService}
          />
        </Suspense>
      );
    }
    return (
      <Suspense fallback={null}>
        <Sidebar
          activeTab={activeTab}
          setActiveTab={handleTabChange}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          onSignOut={handleSignOut}
          user={user}
          xrcService={xrcService}
        />
      </Suspense>
    );
  };

  const currentUserNorm = {
    id:        currentUser.id,
    name:      currentUser.fullName || currentUser.name || "User",
    fullName:  currentUser.fullName || currentUser.name || "User",
    username:  currentUser.username || "user",
    avatar:    currentUser.avatar,
    avatarId:  currentUser.avatarId || currentUser.avatar_id,
    avatar_id: currentUser.avatar_id || currentUser.avatarId,
    verified:  currentUser.verified || false,
  };

  return (
    <div className="app-container">
      <OfflineBanner visible={showOfflineBanner} />

      {showAdminDashboard && isAdmin && (
        <AdminDashboard
          adminData={adminData}
          onClose={() => setShowAdminDashboard(false)}
          xrcService={xrcService}
        />
      )}

      {renderOverlay()}

      <div
        style={{
          visibility:    showAdminDashboard ? "hidden" : "visible",
          pointerEvents: showAdminDashboard ? "none"   : "auto",
          display:       "contents",
        }}
      >
        {!isMobile && (
        <Suspense fallback={null}>
          <DesktopHeader
            activeTab={activeTab}
            setActiveTab={handleTabChange}
            userBalance={userBalance}
            currentUser={currentUser}
            getGreeting={getGreeting}
            setSidebarOpen={setSidebarOpen}
            onNotificationClick={() => setShowNotifications(true)}
            onSupportClick={() => setShowSupport(true)}
            profile={profileData}
            userId={user?.id}
            onSignOut={handleSignOut}
            activeHomeTab={activeHomeTab}
            setActiveHomeTab={setActiveHomeTab}
          />
        </Suspense>
      )}
      {isMobile && (
        <Suspense fallback={null}>
          <MobileHeader
            userBalance={userBalance}
            getGreeting={getGreeting}
            setActiveTab={handleTabChange}
            onNotificationClick={() => setShowNotifications(true)}
            onSupportClick={() => setShowSupport(true)}
            profile={profileData}
            userId={user?.id}
            currentUser={currentUser}
            onSignOut={handleSignOut}
            activeTab={activeTab}
            activeHomeTab={activeHomeTab}
            setActiveHomeTab={setActiveHomeTab}
          />
        </Suspense>
      )}

      {renderSidebar()}

      {!isMobile && (
        <div className="desktop-layout">
          {sidebarOpen && <div className="left-sidebar-placeholder" />}
          <main ref={containerRef} className="main-content-desktop">
            {renderContent()}
          </main>
          {showTrending && (
            <Suspense fallback={null}>
              <TrendingSidebar
                currentUser={currentUser}
                isMobile={false}
                setActiveTab={handleTabChange}
                setFeedFilter={setFeedFilter}
                onJoinStream={handleJoinStream}
              />
            </Suspense>
          )}
        </div>
      )}

      {isMobile && (
        <main ref={containerRef} className="main-content-mobile">
          <Suspense fallback={null}>
            <PullToRefreshIndicator
              pullDistance={pullDistance}
              isRefreshing={isRefreshing || isPulling}
            />
          </Suspense>
          {renderContent()}
        </main>
      )}

      {isMobile && (
        <Suspense fallback={null}>
          <MobileBottomNav
            activeTab={activeTab}
            setActiveTab={handleTabChange}
            currentUser={currentUser}
            xrcService={xrcService}
          />
        </Suspense>
      )}
    </div>

      {showExitPrompt && (
        <div
          style={{
            position:   "fixed",
            bottom:     isMobile ? "68px" : "20px",
            left:       "50%",
            transform:  "translateX(-50%)",
            background: "var(--panel)",
            color:      "var(--accent)",
            padding:    "12px 24px",
            borderRadius: "8px",
            fontSize:   "14px",
            fontWeight: "600",
            zIndex:     10000,
            border:     "1px solid var(--accent)",
            animation:  "xSlideUp .3s ease-out",
          }}
        >
          Press back again to exit
        </div>
      )}

      <Suspense fallback={null}>
        <NotificationSidebar
          isOpen={showNotifications}
          onClose={() => setShowNotifications(false)}
          userId={user?.id}
          currentUser={currentUser}
          onNavigate={handleNotificationNavigate}
        />
      </Suspense>
      <Suspense fallback={null}>
        <SupportSidebar
          isOpen={showSupport}
          onClose={() => setShowSupport(false)}
          isMobile={isMobile}
        />
      </Suspense>

      {showMessages && (
        <Suspense fallback={null}>
          <DMMessagesView
            currentUser={currentUserNorm}
            onClose={() => { setShowMessages(false); setDmTargetUserId(null); }}
            initialOtherUserId={dmTargetUserId}
          />
        </Suspense>
      )}

      {showActiveCall && acceptedCallData && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100001, background: "var(--overlay)" }}>
          <Suspense fallback={null}>
            <ActiveCall
              call={acceptedCallData}
              onEnd={() => { setShowActiveCall(false); setAcceptedCallData(null); }}
              currentUser={currentUserNorm}
            />
          </Suspense>
        </div>
      )}

      <Suspense fallback={null}>
        <IncomingCallToast
          onAccept={(callData) => {
            setAcceptedCallData({ ...callData, outgoing: false });
            setShowActiveCall(true);
          }}
          onDecline={(callId) => {
            callService.declineCall(callId);
          }}
        />
      </Suspense>

      <Suspense fallback={null}>
        <InAppNotificationToast
          navigate={handleNotificationNavigate}
          addToastRef={addToastRef}
        />
      </Suspense>

      <Suspense fallback={null}>
        <PushPermissionNudge userId={user?.id} />
      </Suspense>
      <Suspense fallback={null}>
        <AccountSwitchPrompt
          userId={user?.id}
          userName={currentUser?.name || profile?.full_name || null}
          onSwitchAccount={() => {
            try {
              window.dispatchEvent(new CustomEvent("xv:request_account_switch"));
            } catch {}
          }}
        />
      </Suspense>

      {showOfflineBanner && (
        <Suspense fallback={null}>
          <NetworkError
            onRetry={() => {
              setShowOfflineBanner(false);
              handleRefresh();
            }}
          />
        </Suspense>
      )}

      <style>{`
        @keyframes xSlideUp {
          from { transform: translateX(-50%) translateY(20px); opacity: 0; }
          to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
        }
        .sidebar, .xv-sidebar { z-index: 10 !important; }
        .sdm-portal { position: fixed !important; inset: 0 !important; z-index: 10050 !important; }
      `}</style>
    </div>
  );
});
MainApp.displayName = "MainApp";

// ── AppRouter ─────────────────────────────────────────────────────────────────
function AppRouter() {
  const {
    user, profile, isAdmin, adminData,
    loading, profileLoading,
    getIsPaidCached,
  } = useAuth();

  const [forceResolve,    setForceResolve]    = useState(false);
  const [profileTimedOut, setProfileTimedOut] = useState(false);
  const oauthInProgress = hasOAuthCodeInUrl();

  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => {
      console.warn("[AppRouter] Auth loading timeout (10s) — forcing resolution");
      setForceResolve(true);
    }, 10_000);
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    if (!user || profile) return;
    const timer = setTimeout(() => {
      console.warn("[AppRouter] Profile load timeout (15s)");
      setProfileTimedOut(true);
    }, 15_000);
    return () => clearTimeout(timer);
  }, [user, profile]);

  useEffect(() => {
    if (profile) setProfileTimedOut(false);
  }, [profile]);

  if (!forceResolve && (loading || oauthInProgress)) return <Splash />;
  if (!user)                                          return <AuthWall />;
  if (!profileTimedOut && profileLoading && !profile) return <Splash />;
  if (!profile) {
    const paidCache = getIsPaidCached ? getIsPaidCached() : false;
    if (isAdmin || paidCache) return <MainApp />;
    return <Splash />;
  }
  const paidCache = getIsPaidCached ? getIsPaidCached() : false;
  if (canAccessApp({ profile, isAdmin, adminData, paidCache })) return <MainApp />;
  return <AuthWall paywall />;
}

// ── Root ──────────────────────────────────────────────────────────────────────
const App = () => (
  <AuthProvider>
    <AppRouter />
  </AuthProvider>
);

export default App;