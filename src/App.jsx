// ============================================================================
// src/App.jsx — v20 BULLETPROOF PUSH
// ============================================================================
//
// BASE: v19 LIVE_STREAMING — every line preserved verbatim.
//
// ADDITIONS vs v19:
//   [APP-1]  MessageNotificationService imported and initialized with a
//            toastCallback that pipes DM toasts into InAppNotificationToast.
//            This service was imported but never initialized before — it was
//            completely dead. Now DM in-app toasts work when app is active.
//   [APP-2]  handleNotificationNavigate now handles "/messages" path so
//            tapping a DM toast (or OS notification) navigates correctly.
//            Previously the /messages path fell through to nothing.
//   [APP-3]  pushService.on("sw_updated") listener replaces the no-op
//            sw_update_available handler. The SW now posts SW_UPDATED on
//            activate — this listener receives it and can prompt reload.
//   [APP-4]  InAppNotificationToast receives an addToast ref via a callback
//            ref pattern so MessageNotificationService can feed toasts into
//            it without prop-drilling or re-renders.
//   [APP-5]  MessageNotificationService.cleanup() called on sign-out.
//   [APP-6]  DMMessagesView state added — showMessages + dmTargetUserId —
//            so /messages navigation from toast actually opens the DM panel.
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

import { supabase }              from "./services/config/supabase";
import mediaUrlService           from "./services/shared/mediaUrlService";
import { pushService }           from "./services/notifications/pushService";
import notificationService       from "./services/notifications/notificationService";
import MessageNotificationService from "./services/messages/MessageNotificationService"; // [APP-1]
import { useNavigation }         from "./hooks/useNavigation";
import { useBackButton }         from "./hooks/useBackButton";
import { usePullToRefresh }      from "./hooks/usePullToRefresh";

// Auth system
import AuthProvider, { useAuth } from "./components/Auth/AuthContext";
import AuthWall, { Splash }      from "./components/Auth/AuthWall";
import BoostStyles               from "./components/Boost/BoostStyles";

// Payment gate
import { canAccessApp } from "./services/auth/paymentGate";

// Shared UI
import DesktopHeader           from "./components/Shared/DesktopHeader";
import MobileHeader            from "./components/Shared/MobileHeader";
import MobileBottomNav         from "./components/Shared/MobileBottomNav";
import Sidebar                 from "./components/Shared/Sidebar";
import AdminSidebar            from "./components/Shared/AdminSidebar";
import SupportSidebar          from "./components/Shared/SupportSidebar";
import NotificationSidebar     from "./components/Shared/NotificationSidebar";
import InAppNotificationToast  from "./components/Shared/InAppNotificationToast";
import PullToRefreshIndicator  from "./components/Shared/PullToRefreshIndicator";
import NetworkError            from "./components/Shared/NetworkError";

// Admin dashboard
import AdminDashboard from "./components/Admin/AdminDashboard";

// ── TRACK A: Keep-alive tab views ─────────────────────────────────────────────
const HomeView      = lazy(() => import("./components/Home/HomeView"));
const ExploreView   = lazy(() => import("./components/Explore/ExploreView"));
const CreateView    = lazy(() => import("./components/Create/CreateView"));
const AccountView   = lazy(() => import("./components/Account/AccountView"));
const WalletView    = lazy(() => import("./components/wallet/WalletView"));
const CommunityView = lazy(() => import("./components/Community/CommunityView"));
const TrendingSidebar = lazy(() => import("./components/Shared/TrendingSidebar"));

// ── TRACK B: Full-screen overlay views ───────────────────────────────────────
const AnalyticsView = lazy(() => import("./components/Analytics/AnalyticsView"));
const UpgradeView   = lazy(() => import("./components/Upgrade/UpgradeView"));
const RewardsView   = lazy(() => import("./components/Rewards/RewardsView"));
const StreamView    = lazy(() => import("./components/Stream/StreamView"));
const GiftCardsView = lazy(() => import("./components/GiftCards/GiftCardsView"));
const DMMessagesView = lazy(() => import("./components/Messages/DMMessagesView")); // [APP-6]

// ── Overlay tab IDs ───────────────────────────────────────────────────────────
const OVERLAY_TABS = new Set(["analytics", "upgrade", "rewards", "stream", "giftcards"]);
const PSEUDO_TABS  = new Set(["support", "notifications", "trending"]); // eslint-disable-line

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
          height: "80px",
          background: "rgba(255,255,255,0.03)",
          borderRadius: "12px",
          marginBottom: "12px",
          animation: "skPulse 1.4s ease-in-out infinite",
          animationDelay: `${i * 0.15}s`,
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
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 99998,
        background: "rgba(239,68,68,0.96)",
        color: "#fff",
        textAlign: "center",
        padding: "9px 16px",
        fontSize: "12.5px",
        fontWeight: "600",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
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
    () => import("./components/Explore/ExploreView"),
    () => import("./components/wallet/WalletView"),
    () => import("./components/Account/AccountView"),
    () => import("./components/Community/CommunityView"),
    () => import("./components/Create/CreateView"),
  ].forEach((fn, i) => setTimeout(() => fn().catch(() => {}), 1500 + i * 400));
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
  const [mountedTabs,        setMountedTabs]        = useState(new Set(["home"]));
  const [deepLinkTarget,     setDeepLinkTarget]     = useState(null);

  // [APP-6] DM panel state
  const [showMessages,    setShowMessages]    = useState(false);
  const [dmTargetUserId,  setDmTargetUserId]  = useState(null);

  // [LS-1] Feed filter for tag/post drill-down from TrendingSidebar
  const [feedFilter,    setFeedFilter]    = useState(null);
  // [LS-2] Live stream session
  const [streamSession, setStreamSession] = useState(null);

  const feedRef        = useRef(null);
  const refreshTimeout = useRef(null);
  const netCheckRef    = useRef(null);
  const initDone       = useRef(false);

  // [APP-4] Ref so MessageNotificationService can call addToast without re-renders
  const addToastRef = useRef(null);

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

  // ── [APP-2] Notification deep-link navigate ──────────────────────────────
  const handleNotificationNavigate = useCallback((path) => {
    if (!path || path === "/") return;

    // [APP-2] Handle DM navigation — open the messages panel
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
      setActiveTab("home");
      setHomeSection("newsfeed");
      setDeepLinkTarget({ type: "post", id: postMatch[1] });
      setMountedTabs((p) => new Set([...p, "home"]));
    } else if (reelMatch) {
      setActiveTab("home");
      setHomeSection("reels");
      setDeepLinkTarget({ type: "reel", id: reelMatch[1] });
      setMountedTabs((p) => new Set([...p, "home"]));
    } else if (storyMatch) {
      setActiveTab("home");
      setHomeSection("stories");
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
    if (initDone.current || !user?.id) return;
    initDone.current = true;

    // Init notification service
    notificationService.init(user.id).catch(() => {});

    // [APP-1] Init DM notification service with toast callback
    // The toastCallback calls addToastRef.current (set by InAppNotificationToast)
    MessageNotificationService.init(user.id, (toast) => {
      addToastRef.current?.(toast);
    });

    // Start push service (SW registration + subscription)
    if (navigator.onLine) {
      setTimeout(() => pushService.start(user.id).catch(() => {}), 2000);
    }

    loadWalletAndAvatar(user.id, profile).catch(() => {});
    preloadTabs();

    // [FIX-1] Kill any stale live sessions from a previous login/crash
    setTimeout(() => {
      try {
        supabase
          .rpc("end_my_live_sessions", { p_user_id: user.id })
          .then(() => {})
          .catch(() => {});
      } catch (_) {}
    }, 3000);

    return () => clearTimeout(refreshTimeout.current);
  }, [user?.id]); // eslint-disable-line

  // ── Push listeners ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;

    // OS notification tapped → navigate in-app
    const unsubClick = pushService.on("notification_clicked", ({ url }) => {
      if (url) handleNotificationNavigate(url);
    });

    // [APP-3] SW updated — could prompt user to refresh
    const unsubUpdate = pushService.on("sw_updated", ({ version }) => {
      console.log("[App] SW updated to", version);
      // Optionally show a "New version available, refresh?" banner here
    });

    return () => { unsubClick(); unsubUpdate(); };
  }, [user?.id, handleNotificationNavigate]);

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
        .select("grova_tokens,engagement_points")
        .eq("user_id", userId)
        .maybeSingle();
      if (w) setUserBalance({ tokens: w.grova_tokens || 0, points: w.engagement_points || 0 });
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
          id:       p.id || userId,
          name:     p.full_name || "User",
          username: p.username  || "user",
          avatar:   avatarUrl || p.full_name?.charAt(0)?.toUpperCase() || "X",
          verified: p.verified || false,
          fullName: p.full_name || "User",
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
        MessageNotificationService.cleanup(); // [APP-5]
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

  // [LS-3] Join a live stream as viewer
  const handleJoinStream = useCallback((session) => {
    setStreamSession(session);
    setOverlayTab("stream");
  }, []);

  // ── MASTER NAVIGATION HANDLER ────────────────────────────────────────────
  const handleTabChange = useCallback((newTab) => {
    if (newTab === "support")       { setShowSupport(true);       return; }
    if (newTab === "notifications") { setShowNotifications(true); return; }
    if (newTab === "messages")      { setShowMessages(true);      return; } // [APP-6]
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

  // [LS-7] Overlay close helpers
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

  const viewProps    = { currentUser, userId: user.id, refreshTrigger, deepLinkTarget };
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
              />
            </div>
          </Suspense>
        ),
      },
      {
        id: "search",
        el: (
          <Suspense fallback={<TabSkeleton />}>
            <ExploreView {...viewProps} />
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
            <AnalyticsView currentUser={currentUser} userId={user.id} onClose={closeOverlayToAccount} />
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
            <RewardsView currentUser={currentUser} userId={user.id} onClose={closeOverlayToAccount} />
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
            <GiftCardsView currentUser={currentUser} userId={user.id} onClose={closeOverlayToAccount} />
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
        <AdminSidebar
          activeTab={activeTab}
          setActiveTab={handleTabChange}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          onSignOut={handleSignOut}
          user={user}
          adminData={adminData}
          onOpenDashboard={() => setShowAdminDashboard(true)}
        />
      );
    }
    return (
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        onSignOut={handleSignOut}
        user={user}
      />
    );
  };

  return (
    <div className="app-container">
      <OfflineBanner visible={showOfflineBanner} />

      {showAdminDashboard && isAdmin && (
        <AdminDashboard adminData={adminData} onClose={() => setShowAdminDashboard(false)} />
      )}

      {renderOverlay()}

      <div
        style={{
          visibility:    showAdminDashboard ? "hidden" : "visible",
          pointerEvents: showAdminDashboard ? "none"   : "auto",
          display: "contents",
        }}
      >
        {!isMobile && (
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
          />
        )}
        {isMobile && (
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
          />
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
            <PullToRefreshIndicator
              pullDistance={pullDistance}
              isRefreshing={isRefreshing || isPulling}
            />
            {renderContent()}
          </main>
        )}

        {isMobile && (
          <MobileBottomNav
            activeTab={activeTab}
            setActiveTab={handleTabChange}
            currentUser={currentUser}
          />
        )}
      </div>

      {showExitPrompt && (
        <div
          style={{
            position: "fixed",
            bottom: isMobile ? "68px" : "20px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.9)",
            color: "#84cc16",
            padding: "12px 24px",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: "600",
            zIndex: 10000,
            border: "1px solid #84cc16",
            animation: "xSlideUp .3s ease-out",
          }}
        >
          Press back again to exit
        </div>
      )}

      <NotificationSidebar
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        userId={user?.id}
        currentUser={currentUser}
        onNavigate={handleNotificationNavigate}
      />
      <SupportSidebar
        isOpen={showSupport}
        onClose={() => setShowSupport(false)}
        isMobile={isMobile}
      />

      {/* [APP-6] DM panel — shown from toast tap or nav */}
      {showMessages && (
        <Suspense fallback={null}>
          <DMMessagesView
            currentUser={currentUser}
            onClose={() => { setShowMessages(false); setDmTargetUserId(null); }}
            initialOtherUserId={dmTargetUserId}
          />
        </Suspense>
      )}

      {/* [APP-4] addToastRef is set inside InAppNotificationToast so
          MessageNotificationService can call it without prop drilling */}
      <InAppNotificationToast
        navigate={handleNotificationNavigate}
        addToastRef={addToastRef}
      />

      {showOfflineBanner && (
        <NetworkError
          onRetry={() => {
            setShowOfflineBanner(false);
            handleRefresh();
          }}
        />
      )}

      <style>{`
        @keyframes xSlideUp {
          from { transform: translateX(-50%) translateY(20px); opacity: 0; }
          to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
        }

        /* ── GLOBAL Z-INDEX HIERARCHY ─────────────────────────────────────────
           Stack (low to high):
             .sidebar / .xv-sidebar : 10    (layout only)
             DM panel               : 9990–9999
             Notification sidebar   : 9999–10001
             Stream overlay         : 10001
             InAppToast             : 99999
             .sdm-portal            : 10050
             Offline banner         : 99998
        ──────────────────────────────────────────────────────────────────── */
        .sidebar,
        .xv-sidebar {
          z-index: 10 !important;
        }

        .sdm-portal {
          position: fixed !important;
          inset: 0 !important;
          z-index: 10050 !important;
        }
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
      console.warn("[AppRouter] Profile load timeout (15s) — rendering with available state");
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