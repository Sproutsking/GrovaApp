// ============================================================================
// src/App.jsx — v15 WATER-FLOW
// ============================================================================
//
// KEY FIXES vs v14:
//   [A] oauthInProgress is now imported from AuthContext as a MODULE-LEVEL
//       CONSTANT. It is evaluated ONCE when JS loads and never again.
//       Mobile resume, re-renders, and tab switches can NEVER accidentally
//       see stale OAuth params and show a Splash screen.
//
//   [B] AppRouter no longer calls hasOAuthCodeInUrl() (deleted). It reads
//       the imported constant. This eliminates the #1 cause of infinite
//       loading on mobile return.
//
//   [C] sessionRefreshManager.initialize() is called inside MainApp once
//       after confirmed auth, not on import. This prevents it from running
//       during the OAuth exchange.
//
//   [D] sessionManager.startSession() is called on mount AND on
//       visibilitychange (resume), so the heartbeat always runs correctly
//       after the app comes back from background.
//
//   [E] All other logic is unchanged from v14.
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
import "./styles/reels.css";
import "./styles/StoryCard.css";
import "./styles/ProfileModal.css";
import "./styles/Draft.css";

import { supabase }        from "./services/config/supabase";
import mediaUrlService     from "./services/shared/mediaUrlService";
import { pushService }     from "./services/notifications/pushService";
import notificationService from "./services/notifications/notificationService";
import { useNavigation }   from "./hooks/useNavigation";
import { useBackButton }   from "./hooks/useBackButton";
import { usePullToRefresh } from "./hooks/usePullToRefresh";

// Auth system
import AuthProvider, { useAuth, oauthInProgress } from "./components/Auth/AuthContext";
import AuthWall, { Splash }                        from "./components/Auth/AuthWall";

// Session services
import sessionRefreshManager from "./services/auth/sessionRefresh";
import sessionManager        from "./services/auth/sessionManager";

// Payment gate
import { canAccessApp } from "./services/auth/paymentGate";

// Shared UI
import DesktopHeader          from "./components/Shared/DesktopHeader";
import MobileHeader           from "./components/Shared/MobileHeader";
import MobileBottomNav        from "./components/Shared/MobileBottomNav";
import Sidebar                from "./components/Shared/Sidebar";
import AdminSidebar           from "./components/Shared/AdminSidebar";
import SupportSidebar         from "./components/Shared/SupportSidebar";
import NotificationSidebar    from "./components/Shared/NotificationSidebar";
import InAppNotificationToast from "./components/Shared/InAppNotificationToast";
import PullToRefreshIndicator from "./components/Shared/PullToRefreshIndicator";
import NetworkError           from "./components/Shared/NetworkError";

// Admin dashboard
import AdminDashboard from "./components/Admin/AdminDashboard";

// Lazy-loaded tabs
const HomeView        = lazy(() => import("./components/Home/HomeView"));
const ExploreView     = lazy(() => import("./components/Explore/ExploreView"));
const CreateView      = lazy(() => import("./components/Create/CreateView"));
const AccountView     = lazy(() => import("./components/Account/AccountView"));
const WalletView      = lazy(() => import("./components/wallet/WalletView"));
const CommunityView   = lazy(() => import("./components/Community/CommunityView"));
const TrendingSidebar = lazy(() => import("./components/Shared/TrendingSidebar"));

// Lazy-loaded overlay views
const AnalyticsView = lazy(() => import("./components/Analytics/AnalyticsView"));
const UpgradeView   = lazy(() => import("./components/Upgrade/UpgradeView"));
const RewardsView   = lazy(() => import("./components/Rewards/RewardsView"));
const StreamView    = lazy(() => import("./components/Stream/StreamView"));
const GiftCardsView = lazy(() => import("./components/GiftCards/GiftCardsView"));

// ── Overlay tab IDs ───────────────────────────────────────────────────────────
const OVERLAY_TABS = new Set(["analytics", "upgrade", "rewards", "stream", "giftcards"]);

// ── Helpers ───────────────────────────────────────────────────────────────────
const checkMobile = () => window.innerWidth <= 768;

// ── Skeleton ──────────────────────────────────────────────────────────────────
const TabSkeleton = memo(() => (
  <div style={{ padding: "24px 16px" }}>
    {[1, 2, 3].map((i) => (
      <div key={i} style={{
        height: "80px", background: "rgba(255,255,255,0.03)",
        borderRadius: "12px", marginBottom: "12px",
        animation: "skPulse 1.4s ease-in-out infinite",
        animationDelay: `${i * 0.15}s`,
      }} />
    ))}
    <style>{`@keyframes skPulse{0%,100%{opacity:.5}50%{opacity:.15}}`}</style>
  </div>
));
TabSkeleton.displayName = "TabSkeleton";

const OverlaySkeleton = memo(() => null);
OverlaySkeleton.displayName = "OverlaySkeleton";

// ── Offline banner ────────────────────────────────────────────────────────────
const OfflineBanner = memo(({ visible }) => {
  if (!visible) return null;
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 99998,
      background: "rgba(239,68,68,0.96)", color: "#fff", textAlign: "center",
      padding: "9px 16px", fontSize: "12.5px", fontWeight: "600",
      display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
      backdropFilter: "blur(4px)",
    }}>
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
  const { user, profile, isAdmin, adminData, signOut } = useAuth();

  const [currentUser, setCurrentUser] = useState(() => ({
    id:       user?.id,
    name:     profile?.full_name || "User",
    username: profile?.username  || "user",
    avatar:   profile?.full_name?.charAt(0)?.toUpperCase() || "X",
    verified: profile?.verified  || false,
    fullName: profile?.full_name || "User",
  }));

  const [userBalance,       setUserBalance]       = useState({ tokens: 0, points: 0 });
  const [profileData,       setProfileData]       = useState(null);
  const [activeTab,         setActiveTab]         = useState("home");
  const [overlayTab,        setOverlayTab]        = useState(null);
  const [isMobile,          setIsMobile]          = useState(checkMobile);
  const [sidebarOpen,       setSidebarOpen]       = useState(true);
  const [accountSection,    setAccountSection]    = useState("profile");
  const [homeSection,       setHomeSection]       = useState("newsfeed");
  const [isSubscribed,      setIsSubscribed]      = useState(profile?.is_pro || false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSupport,       setShowSupport]       = useState(false);
  const [refreshTrigger,    setRefreshTrigger]    = useState(0);
  const [lastRefreshTime,   setLastRefreshTime]   = useState(Date.now());
  const [showAdminDashboard,setShowAdminDashboard]= useState(false);
  const [isOnline,          setIsOnline]          = useState(navigator.onLine);
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);
  const [mountedTabs,       setMountedTabs]       = useState(new Set(["home"]));
  const [deepLinkTarget,    setDeepLinkTarget]    = useState(null);

  const feedRef        = useRef(null);
  const refreshTimeout = useRef(null);
  const netCheckRef    = useRef(null);
  const initDone       = useRef(false);

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
      if (navigator.onLine !== isOnline) { navigator.onLine ? goOnline() : goOffline(); }
    }, 5000);
    return () => {
      window.removeEventListener("online",  goOnline);
      window.removeEventListener("offline", goOffline);
      clearInterval(netCheckRef.current);
    };
  }, [isOnline]);

  // ── Init: session services + preload ────────────────────────────────────
  useEffect(() => {
    if (initDone.current || !user?.id) return;
    initDone.current = true;

    // Boot session refresh manager (non-blocking)
    sessionRefreshManager.initialize().catch(() => {});

    // Start session tracking
    sessionManager.startSession(user.id).catch(() => {});

    notificationService.init(user.id).catch(() => {});

    if (navigator.onLine) {
      setTimeout(() => pushService.start(user.id).catch(() => {}), 2000);
    }

    loadWalletAndAvatar(user.id, profile).catch(() => {});
    preloadTabs();

    return () => clearTimeout(refreshTimeout.current);
  }, [user?.id]); // eslint-disable-line

  // ── Session heartbeat on app resume (visibility) ────────────────────────
  // AuthContext already handles token refresh on resume.
  // Here we just ensure the sessionManager heartbeat is still running.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible" && user?.id) {
        sessionManager.startSession(user.id).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [user?.id]);

  // ── Push event listeners ────────────────────────────────────────────────
  const handleNotificationNavigate = useCallback((path) => {
    if (!path || path === "/") return;

    const postMatch    = path.match(/^\/post\/(.+)$/);
    const reelMatch    = path.match(/^\/reel\/(.+)$/);
    const storyMatch   = path.match(/^\/story\/(.+)$/);
    const profileMatch = path.match(/^\/profile\/(.+)$/);

    if (postMatch) {
      setActiveTab("home"); setHomeSection("newsfeed");
      setDeepLinkTarget({ type: "post", id: postMatch[1] });
      setMountedTabs((prev) => new Set([...prev, "home"]));
    } else if (reelMatch) {
      setActiveTab("home"); setHomeSection("reels");
      setDeepLinkTarget({ type: "reel", id: reelMatch[1] });
      setMountedTabs((prev) => new Set([...prev, "home"]));
    } else if (storyMatch) {
      setActiveTab("home"); setHomeSection("stories");
      setDeepLinkTarget({ type: "story", id: storyMatch[1] });
      setMountedTabs((prev) => new Set([...prev, "home"]));
    } else if (profileMatch) {
      const targetId = profileMatch[1];
      if (targetId === user?.id) {
        setActiveTab("account");
        setMountedTabs((prev) => new Set([...prev, "account"]));
      } else {
        setActiveTab("search");
        setDeepLinkTarget({ type: "profile", id: targetId });
        setMountedTabs((prev) => new Set([...prev, "search"]));
      }
    } else if (path === "/account") {
      setActiveTab("account");
      setMountedTabs((prev) => new Set([...prev, "account"]));
    }

    setShowAdminDashboard(false);
    setOverlayTab(null);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const unsubClick  = pushService.on("notification_clicked", ({ url }) => {
      if (url) handleNotificationNavigate(url);
    });
    const unsubUpdate = pushService.on("sw_update_available", () => {});
    return () => { unsubClick(); unsubUpdate(); };
  }, [user?.id, handleNotificationNavigate]);

  // ── Auto-refresh (desktop) ──────────────────────────────────────────────
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

  const loadWalletAndAvatar = async (userId, p) => {
    try {
      const { data: w } = await supabase
        .from("wallets")
        .select("grova_tokens,engagement_points")
        .eq("user_id", userId)
        .maybeSingle();

      if (w) {
        setUserBalance({ tokens: w.grova_tokens || 0, points: w.engagement_points || 0 });
      }

      if (p) {
        let avatarUrl = null;
        if (p.avatar_id) {
          const base = mediaUrlService.getImageUrl(p.avatar_id);
          if (base && typeof base === "string") {
            const clean = base.split("?")[0];
            avatarUrl   = clean.includes("supabase")
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
    } catch {
      // Silent
    }
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

  const handleSignOut = useCallback(async () => {
    try {
      if (user?.id) {
        await pushService.unsubscribe(user.id).catch(() => {});
        notificationService.destroy();
        await sessionManager.stopSession().catch(() => {});
        sessionRefreshManager.cleanup();
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

  // ── Tab change ──────────────────────────────────────────────────────────
  const handleTabChange = useCallback((newTab) => {
    if (newTab === "admin") {
      if (isAdmin) { setShowAdminDashboard(true); return; }
      return;
    }
    if (OVERLAY_TABS.has(newTab)) {
      setOverlayTab(newTab);
      return;
    }
    setOverlayTab(null);
    setActiveTab(newTab);
    setShowAdminDashboard(false);
    setMountedTabs((prev) => {
      if (prev.has(newTab)) return prev;
      return new Set([...prev, newTab]);
    });
  }, [isAdmin]);

  const closeOverlay          = useCallback(() => setOverlayTab(null), []);
  const closeOverlayToAccount = useCallback(() => {
    setOverlayTab(null);
    setActiveTab("account");
    setMountedTabs((prev) => new Set([...prev, "account"]));
  }, []);

  const viewProps   = { currentUser, userId: user.id, refreshTrigger, deepLinkTarget };
  const showTrending = activeTab !== "community" && activeTab !== "wallet";

  // ── Tab render ──────────────────────────────────────────────────────────
  const renderContent = () => {
    const tabs = [
      {
        id: "home",
        el: (
          <Suspense fallback={<TabSkeleton />}>
            <div ref={feedRef}>
              <HomeView {...viewProps} homeSection={homeSection} setHomeSection={setHomeSection} />
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
          const isActive = activeTab === id && !showAdminDashboard;
          return (
            <div key={id} style={{ display: isActive ? "block" : "none", width: "100%" }}>
              {el}
            </div>
          );
        })}
      </>
    );
  };

  // ── Overlay render ──────────────────────────────────────────────────────
  const renderOverlay = () => {
    if (!overlayTab) return null;
    switch (overlayTab) {
      case "analytics":
        return (
          <Suspense fallback={<OverlaySkeleton />}>
            <AnalyticsView currentUser={currentUser} userId={user.id} onClose={closeOverlayToAccount} />
          </Suspense>
        );
      case "upgrade":
        return (
          <Suspense fallback={<OverlaySkeleton />}>
            <UpgradeView currentUser={currentUser} onClose={closeOverlayToAccount} />
          </Suspense>
        );
      case "rewards":
        return (
          <Suspense fallback={<OverlaySkeleton />}>
            <RewardsView currentUser={currentUser} userId={user.id} onClose={closeOverlayToAccount} />
          </Suspense>
        );
      case "stream":
        return (
          <Suspense fallback={<OverlaySkeleton />}>
            <StreamView currentUser={currentUser} onClose={closeOverlay} />
          </Suspense>
        );
      case "giftcards":
        return (
          <Suspense fallback={<OverlaySkeleton />}>
            <GiftCardsView currentUser={currentUser} userId={user.id} onClose={closeOverlayToAccount} />
          </Suspense>
        );
      default:
        return null;
    }
  };

  const renderSidebar = () => {
    if (isMobile || showAdminDashboard) return null;
    if (isAdmin) {
      return (
        <AdminSidebar
          activeTab={activeTab} setActiveTab={handleTabChange}
          sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}
          onSignOut={handleSignOut} user={user} adminData={adminData}
          onOpenDashboard={() => setShowAdminDashboard(true)}
        />
      );
    }
    return (
      <Sidebar
        activeTab={activeTab} setActiveTab={handleTabChange}
        sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}
        onSignOut={handleSignOut} user={user}
      />
    );
  };

  return (
    <div className="app-container">
      <OfflineBanner visible={showOfflineBanner} />

      {showAdminDashboard && isAdmin && (
        <AdminDashboard adminData={adminData} onClose={() => setShowAdminDashboard(false)} />
      )}

      <div style={{
        visibility:    showAdminDashboard ? "hidden" : "visible",
        pointerEvents: showAdminDashboard ? "none"   : "auto",
        display:       "contents",
      }}>
        {!isMobile && (
          <DesktopHeader
            activeTab={activeTab} setActiveTab={handleTabChange}
            userBalance={userBalance} currentUser={currentUser}
            getGreeting={getGreeting} setSidebarOpen={setSidebarOpen}
            onNotificationClick={() => setShowNotifications(true)}
            onSupportClick={() => setShowSupport(true)}
            profile={profileData} userId={user?.id}
          />
        )}
        {isMobile && (
          <MobileHeader
            userBalance={userBalance} getGreeting={getGreeting}
            setActiveTab={handleTabChange}
            onNotificationClick={() => setShowNotifications(true)}
            onSupportClick={() => setShowSupport(true)}
            profile={profileData} userId={user?.id} currentUser={currentUser}
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
                <TrendingSidebar />
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
            activeTab={activeTab} setActiveTab={handleTabChange}
            currentUser={currentUser}
          />
        )}
      </div>

      {renderOverlay()}

      {showExitPrompt && (
        <div style={{
          position: "fixed",
          bottom: isMobile ? "68px" : "20px",
          left: "50%", transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.9)", color: "#84cc16",
          padding: "12px 24px", borderRadius: "8px",
          fontSize: "14px", fontWeight: "600", zIndex: 10000,
          border: "1px solid #84cc16",
          animation: "xSlideUp .3s ease-out",
        }}>
          Press back again to exit
        </div>
      )}

      <NotificationSidebar
        isOpen={showNotifications} onClose={() => setShowNotifications(false)}
        userId={user?.id} currentUser={currentUser}
        onNavigate={handleNotificationNavigate}
      />
      <SupportSidebar
        isOpen={showSupport} onClose={() => setShowSupport(false)}
        isMobile={isMobile}
      />
      <InAppNotificationToast navigate={handleNotificationNavigate} />

      {showOfflineBanner && (
        <NetworkError
          onRetry={() => { setShowOfflineBanner(false); handleRefresh(); }}
        />
      )}

      <style>{`
        @keyframes xSlideUp {
          from { transform: translateX(-50%) translateY(20px); opacity: 0; }
          to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
});
MainApp.displayName = "MainApp";

// ── AppRouter ─────────────────────────────────────────────────────────────────
// oauthInProgress is a MODULE-LEVEL CONSTANT imported from AuthContext.
// It is NEVER re-evaluated — it was computed once when the page loaded
// and the URL was already cleaned at that point.
function AppRouter() {
  const { user, profile, isAdmin, loading, profileLoading } = useAuth();

  // Show Splash if:
  //   1. Auth context is still initializing, OR
  //   2. This is the first page load during an OAuth redirect
  //      (oauthInProgress is true only on the initial load, never on resume)
  if (loading || profileLoading || oauthInProgress) return <Splash />;
  if (!user)    return <AuthWall />;
  if (!profile) return <Splash />;
  if (canAccessApp({ profile, isAdmin })) return <MainApp />;
  return <AuthWall paywall />;
}

// ── Root ──────────────────────────────────────────────────────────────────────
const App = () => (
  <AuthProvider>
    <AppRouter />
  </AuthProvider>
);

export default App;