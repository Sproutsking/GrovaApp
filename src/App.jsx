// src/App.jsx
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

import { supabase } from "./services/config/supabase";
import mediaUrlService from "./services/shared/mediaUrlService";
import { pushService } from "./services/notifications/pushService";
import { useNavigation } from "./hooks/useNavigation";
import { useBackButton } from "./hooks/useBackButton";
import { usePullToRefresh } from "./hooks/usePullToRefresh";

import AuthProvider, { useAuth } from "./components/Auth/AuthContext";
import AuthWall, { Splash } from "./components/Auth/AuthWall";

import DesktopHeader        from "./components/Shared/DesktopHeader";
import MobileHeader         from "./components/Shared/MobileHeader";
import MobileBottomNav      from "./components/Shared/MobileBottomNav";
import Sidebar              from "./components/Shared/Sidebar";
import AdminSidebar         from "./components/Shared/AdminSidebar";
import SupportSidebar       from "./components/Shared/SupportSidebar";
import NotificationSidebar  from "./components/Shared/NotificationSidebar";
import PullToRefreshIndicator from "./components/Shared/PullToRefreshIndicator";
import AdminDashboard       from "./components/Admin/AdminDashboard";
import NetworkError         from "./components/Shared/NetworkError";

const HomeView      = lazy(() => import("./components/Home/HomeView"));
const ExploreView   = lazy(() => import("./components/Explore/ExploreView"));
const CreateView    = lazy(() => import("./components/Create/CreateView"));
const AccountView   = lazy(() => import("./components/Account/AccountView"));
const WalletView    = lazy(() => import("./components/wallet/WalletView"));
const CommunityView = lazy(() => import("./components/Community/CommunityView"));
const TrendingSidebar = lazy(() => import("./components/Shared/TrendingSidebar"));

// ── Helpers ───────────────────────────────────────────────────────────────────
const checkMobile = () => window.innerWidth <= 768;

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

const OfflineBanner = memo(({ visible }) => {
  if (!visible) return null;
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 99998,
      background: "rgba(239,68,68,0.96)", color: "#fff",
      textAlign: "center", padding: "9px 16px", fontSize: "12.5px",
      fontWeight: "600", display: "flex", alignItems: "center",
      justifyContent: "center", gap: "8px", backdropFilter: "blur(4px)",
    }}>
      <span>📡</span> No internet connection — your session is safe.
    </div>
  );
});
OfflineBanner.displayName = "OfflineBanner";

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
  // adminData comes directly from context — built from admin_team table
  const { user, profile, isAdmin, adminData, signOut } = useAuth();

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
  const [isMobile,           setIsMobile]           = useState(checkMobile);   // fn ref — correct on mount
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

  const feedRef        = useRef(null);
  const refreshTimeout = useRef(null);
  const pushInit       = useRef(false);
  const netCheckRef    = useRef(null);
  const initDone       = useRef(false);

  const { isAtRoot } = useNavigation(
    activeTab, homeSection, accountSection,
    setActiveTab, setHomeSection, setAccountSection,
  );
  const { showExitPrompt } = useBackButton(isAtRoot);

  // ── Responsive: standalone effect, always active ─────────────────────────
  useEffect(() => {
    const onResize = () => {
      const mobile = checkMobile();
      setIsMobile(mobile);
      if (mobile) setShowAdminDashboard(false); // admin dashboard is desktop-only
    };
    onResize(); // sync immediately on mount
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── Network ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const goOnline  = () => { setIsOnline(true);  setShowOfflineBanner(false); };
    const goOffline = () => { setIsOnline(false); setShowOfflineBanner(true);  };
    window.addEventListener("online",  goOnline);
    window.addEventListener("offline", goOffline);
    netCheckRef.current = setInterval(() => {
      if (navigator.onLine !== isOnline) navigator.onLine ? goOnline() : goOffline();
    }, 5000);
    return () => {
      window.removeEventListener("online",  goOnline);
      window.removeEventListener("offline", goOffline);
      clearInterval(netCheckRef.current);
    };
  }, [isOnline]);

  // ── One-time init ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (initDone.current || !user?.id) return;
    initDone.current = true;
    loadWalletAndAvatar(user.id, profile).catch(() => {});
    if (!pushInit.current && navigator.onLine) {
      setTimeout(() => { initPush(user.id); pushInit.current = true; }, 2000);
    }
    preloadTabs();
    return () => clearTimeout(refreshTimeout.current);
  }, [user?.id]); // eslint-disable-line

  // ── Desktop auto-refresh ──────────────────────────────────────────────────
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

  // ── Load wallet + avatar ──────────────────────────────────────────────────
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
        setCurrentUser({
          id: p.id || userId, name: p.full_name || "User",
          username: p.username || "user",
          avatar: avatarUrl || p.full_name?.charAt(0)?.toUpperCase() || "X",
          verified: p.verified || false, fullName: p.full_name || "User",
        });
        setProfileData({ id: p.id, fullName: p.full_name, username: p.username,
          avatar: avatarUrl, verified: p.verified, isPro: p.is_pro });
        setIsSubscribed(p.is_pro || false);
      }
    } catch {}
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
      ...prev, fullName: up.fullName, username: up.username,
      avatar: up.avatar, verified: up.verified,
    }));
  }, []);

  const handleSignOut = useCallback(async () => {
    try { if (user?.id) await pushService.unsubscribe(user.id).catch(() => {}); } catch {}
    await signOut();
  }, [user?.id, signOut]);

  const initPush = async (userId) => {
    try {
      if (!pushService.isSupported()) return;
      const perm = pushService.getPermission();
      if (perm === "granted") await pushService.subscribe(userId);
      else if (perm === "default") {
        setTimeout(async () => {
          const g = await pushService.requestPermission();
          if (g) await pushService.subscribe(userId);
        }, 3000);
      }
    } catch {}
  };

  const getGreeting = useCallback(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  }, []);

  const handleTabChange = useCallback((newTab) => {
    if (newTab === "admin") {
      if (isAdmin) { setShowAdminDashboard(true); return; }
      return;
    }
    setActiveTab(newTab);
    setShowAdminDashboard(false);
    setMountedTabs((prev) => {
      if (prev.has(newTab)) return prev;
      const next = new Set(prev);
      next.add(newTab);
      return next;
    });
  }, [isAdmin]);

  const viewProps = { currentUser, userId: user.id, refreshTrigger };

  // ── Content ───────────────────────────────────────────────────────────────
  const renderContent = () => {
    if (showAdminDashboard && isAdmin) {
      return (
        <AdminDashboard
          adminData={adminData}         // comes straight from context/admin_team
          onClose={() => setShowAdminDashboard(false)}
        />
      );
    }

    const tabs = [
      { id: "home", el: (
        <Suspense fallback={<TabSkeleton />}>
          <div ref={feedRef}>
            <HomeView {...viewProps} homeSection={homeSection} setHomeSection={setHomeSection} />
          </div>
        </Suspense>
      )},
      { id: "search",    el: <Suspense fallback={<TabSkeleton />}><ExploreView {...viewProps} /></Suspense> },
      { id: "create",    el: <Suspense fallback={<TabSkeleton />}><CreateView currentUser={currentUser} userId={user.id} /></Suspense> },
      { id: "community", el: <Suspense fallback={<TabSkeleton />}><CommunityView {...viewProps} /></Suspense> },
      { id: "account",   el: (
        <Suspense fallback={<TabSkeleton />}>
          <AccountView {...viewProps} accountSection={accountSection}
            setAccountSection={setAccountSection} isSubscribed={isSubscribed}
            onSignOut={handleSignOut} onProfileLoad={handleProfileUpdate} />
        </Suspense>
      )},
      { id: "wallet", el: (
        <Suspense fallback={<TabSkeleton />}>
          <WalletView userBalance={userBalance} setUserBalance={setUserBalance}
            isMobile={isMobile} userId={user.id} refreshTrigger={refreshTrigger} />
        </Suspense>
      )},
    ];

    return (
      <>
        {tabs.map(({ id, el }) => {
          if (!mountedTabs.has(id)) return null;
          const isActive = activeTab === id && !showAdminDashboard;
          return (
            <div key={id} style={{
              visibility:    isActive ? "visible" : "hidden",
              pointerEvents: isActive ? "auto"    : "none",
              position:      isActive ? "relative" : "absolute",
              top:           isActive ? "auto" : 0,
              left:          isActive ? "auto" : 0,
              right:         isActive ? "auto" : 0,
              height:        isActive ? "auto" : 0,
              overflow:      isActive ? "visible" : "hidden",
            }}>
              {el}
            </div>
          );
        })}
      </>
    );
  };

  // ── Sidebar ───────────────────────────────────────────────────────────────
  // isMobile and isAdmin are both reactive — React re-renders when either changes.
  // isAdmin flips once AuthContext finishes fetching admin_team row.
  const renderSidebar = () => {
    if (isMobile)            return null;  // mobile uses bottom nav
    if (showAdminDashboard)  return null;  // admin dashboard has its own layout

    if (isAdmin) {
      return (
        <AdminSidebar
          activeTab={activeTab}
          setActiveTab={handleTabChange}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          onSignOut={handleSignOut}
          user={user}
          adminData={adminData}           // role, permissions, name from admin_team
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
      {renderSidebar()}

      {!isMobile && !showAdminDashboard && (
        <DesktopHeader
          activeTab={activeTab} setActiveTab={handleTabChange}
          userBalance={userBalance} currentUser={currentUser}
          getGreeting={getGreeting} setSidebarOpen={setSidebarOpen}
          onNotificationClick={() => setShowNotifications(true)}
          onSupportClick={() => setShowSupport(true)}
          profile={profileData} userId={user?.id}
        />
      )}
      {isMobile && !showAdminDashboard && (
        <MobileHeader
          userBalance={userBalance} getGreeting={getGreeting}
          setActiveTab={handleTabChange}
          onNotificationClick={() => setShowNotifications(true)}
          onSupportClick={() => setShowSupport(true)}
          profile={profileData} userId={user?.id} currentUser={currentUser}
        />
      )}

      <div className="desktop-layout">
        {!isMobile && sidebarOpen && !showAdminDashboard && (
          <div className="left-sidebar-placeholder" />
        )}
        <main
          ref={containerRef}
          className={
            showAdminDashboard ? "admin-content"
            : isMobile         ? "main-content-mobile"
            :                    "main-content-desktop"
          }
          style={{ position: "relative", overflowY: "auto", overflowX: "hidden" }}
        >
          {isMobile && !showAdminDashboard && (
            <PullToRefreshIndicator
              pullDistance={pullDistance}
              isRefreshing={isRefreshing || isPulling}
            />
          )}
          {renderContent()}
        </main>
        {!isMobile && activeTab !== "community" && !showAdminDashboard && (
          <Suspense fallback={<div style={{ width: "300px" }} />}>
            <TrendingSidebar />
          </Suspense>
        )}
      </div>

      {/* Bottom nav — mobile only, not when admin dashboard open */}
      {isMobile && !showAdminDashboard && (
        <MobileBottomNav activeTab={activeTab} setActiveTab={handleTabChange} />
      )}

      {showExitPrompt && (
        <div style={{
          position: "fixed",
          bottom: isMobile ? "80px" : "20px",
          left: "50%", transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.9)", color: "#84cc16",
          padding: "12px 24px", borderRadius: "8px",
          fontSize: "14px", fontWeight: "600",
          zIndex: 10000, border: "1px solid #84cc16",
          animation: "xSlideUp .3s ease-out",
        }}>
          Press back again to exit
        </div>
      )}

      <NotificationSidebar
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        isMobile={isMobile} userId={user?.id}
      />
      <SupportSidebar
        isOpen={showSupport}
        onClose={() => setShowSupport(false)}
        isMobile={isMobile}
      />

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
        .admin-content { width: 100%; margin: 0; padding: 0; }
      `}</style>
    </div>
  );
});
MainApp.displayName = "MainApp";

// ── AppRouter ─────────────────────────────────────────────────────────────────
function AppRouter() {
  const { user, profile, loading } = useAuth();
  if (loading)                        return <Splash />;
  if (!user)                          return <AuthWall />;
  if (!profile?.account_activated)    return <AuthWall paywall />;
  return <MainApp />;
}

// ── Root ──────────────────────────────────────────────────────────────────────
const App = () => (
  <AuthProvider>
    <AppRouter />
  </AuthProvider>
);

export default App;