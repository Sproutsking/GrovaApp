import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
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

import authService from "./services/auth/authService";
import { supabase } from "./services/config/supabase";
import mediaUrlService from "./services/shared/mediaUrlService";
import { ToastProvider } from "./contexts/ToastContext";
import { useNavigation } from "./hooks/useNavigation";
import { useBackButton } from "./hooks/useBackButton";
import { usePullToRefresh } from "./hooks/usePullToRefresh";

import DesktopHeader from "./components/Shared/DesktopHeader";
import MobileHeader from "./components/Shared/MobileHeader";
import MobileBottomNav from "./components/Shared/MobileBottomNav";
import Sidebar from "./components/Shared/Sidebar";
import AuthPage from "./components/Auth/AuthPage";
import SupportSidebar from "./components/Shared/SupportSidebar";
import NotificationSidebar from "./components/Shared/NotificationSidebar";
import PullToRefreshIndicator from "./components/Shared/PullToRefreshIndicator";

const HomeView = lazy(() => import("./components/Home/HomeView"));
const ExploreView = lazy(() => import("./components/Explore/ExploreView"));
const CreateView = lazy(() => import("./components/Create/CreateView"));
const AccountView = lazy(() => import("./components/Account/AccountView"));
const WalletView = lazy(() => import("./components/wallet/WalletView"));
const CommunityView = lazy(
  () => import("./components/Community/CommunityView"),
);
const TrendingSidebar = lazy(
  () => import("./components/Shared/TrendingSidebar"),
);

const LoadingFallback = () => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "200px",
      gap: "16px",
    }}
  >
    <div
      style={{
        width: "48px",
        height: "48px",
        border: "4px solid rgba(132, 204, 22, 0.2)",
        borderTop: "4px solid #84cc16",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }}
    ></div>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [activeTab, setActiveTab] = useState("home");
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [accountSection, setAccountSection] = useState("profile");
  const [homeSection, setHomeSection] = useState("newsfeed");
  const [userBalance, setUserBalance] = useState({ tokens: 0, points: 0 });
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const feedRef = useRef(null);
  const authUnsubscribe = useRef(null);
  const isStandalone = useRef(
    window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true,
  );

  const { isAtRoot } = useNavigation(
    activeTab,
    homeSection,
    accountSection,
    setActiveTab,
    setHomeSection,
    setAccountSection,
  );

  const { showExitPrompt } = useBackButton(isAtRoot);

  // Pull to refresh handler
  const handleRefresh = async () => {
    console.log("🔄 Refreshing content...");

    // Force reload user data
    if (user?.id) {
      await loadUserDataAsync(user.id);
    }

    // Trigger content refresh by updating key
    setRefreshKey((prev) => prev + 1);

    // Small delay for smooth UX
    await new Promise((resolve) => setTimeout(resolve, 500));
  };

  const { containerRef, isPulling, pullDistance, isRefreshing } =
    usePullToRefresh(handleRefresh, isMobile && user !== null);

  useEffect(() => {
    initializeApp();

    authUnsubscribe.current = authService.onAuthStateChange(
      (authenticatedUser) => {
        if (authenticatedUser) {
          setUser(authenticatedUser);
          loadUserDataAsync(authenticatedUser.id);
        } else {
          setUser(null);
          setCurrentUser(null);
          setProfileData(null);
          setUserBalance({ tokens: 0, points: 0 });
        }
      },
    );

    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);

    // Clear service worker cache on PWA load if needed
    if (isStandalone.current && "serviceWorker" in navigator) {
      console.log("🔧 PWA detected - ensuring fresh data");
      // Force cache bypass for API calls
      navigator.serviceWorker.controller?.postMessage({ type: "CLEAR_CACHE" });
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      if (authUnsubscribe.current) authUnsubscribe.current();
    };
  }, []);

  const initializeApp = async () => {
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 2000),
      );

      const sessionPromise = authService.getSession();

      try {
        const session = await Promise.race([sessionPromise, timeoutPromise]);
        if (session?.user) {
          setUser(session.user);
          await loadUserDataAsync(session.user.id);
        }
      } catch (err) {
        if (err.message !== "timeout") throw err;
        console.log("⚠️ Session check timed out, continuing...");
      }
    } catch (error) {
      console.error("Init error:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserDataAsync = async (userId) => {
    try {
      console.log("🔄 Loading user data for:", userId);

      setCurrentUser({
        name: "Loading...",
        username: "user",
        avatar: "G",
        verified: false,
        fullName: "Loading...",
      });

      // Force network request, bypass cache
      const fetchOptions = {
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      };

      const [profileResult, walletResult] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase
          .from("wallets")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);

      let userData = null;
      let headerProfile = null;
      let balance = { tokens: 0, points: 0 };
      let isPro = false;

      if (profileResult.data) {
        const profile = profileResult.data;

        let avatarUrl = null;
        if (profile.avatar_id) {
          const baseUrl = mediaUrlService.getImageUrl(profile.avatar_id);
          if (baseUrl && typeof baseUrl === "string") {
            const cleanUrl = baseUrl.split("?")[0];
            if (cleanUrl.includes("supabase")) {
              avatarUrl = `${cleanUrl}?quality=100&width=400&height=400&resize=cover&format=webp&t=${Date.now()}`;
            } else {
              avatarUrl = baseUrl;
            }
          }
        }

        console.log("✅ Avatar URL processed:", avatarUrl);

        userData = {
          id: profile.id,
          name: profile.full_name || "Grova User",
          username: profile.username || "user",
          avatar: profile.avatar_id
            ? avatarUrl
            : profile.full_name?.charAt(0)?.toUpperCase() || "G",
          verified: profile.verified || false,
          fullName: profile.full_name || "Grova User",
        };

        headerProfile = {
          id: profile.id,
          fullName: profile.full_name,
          username: profile.username,
          avatar: avatarUrl,
          verified: profile.verified,
          isPro: profile.is_pro,
        };

        isPro = profile.is_pro || false;

        console.log("✅ Header profile ready:", headerProfile);
      } else {
        userData = {
          id: userId,
          name: "Grova User",
          username: "user_" + userId.substring(0, 8),
          avatar: "G",
          verified: false,
          fullName: "Grova User",
        };
        headerProfile = {
          id: userId,
          fullName: "Grova User",
          username: "user",
          avatar: null,
          verified: false,
        };
      }

      if (walletResult.data) {
        const wallet = walletResult.data;
        balance = {
          tokens: wallet.grova_tokens || 0,
          points: wallet.engagement_points || 0,
        };
      }

      setCurrentUser(userData);
      setProfileData(headerProfile);
      setUserBalance(balance);
      setIsSubscribed(isPro);

      console.log("✅ User data loaded successfully");
    } catch (error) {
      console.error("❌ Load user data error:", error);
      setCurrentUser({
        id: userId,
        name: "Grova User",
        username: "user",
        avatar: "G",
        verified: false,
        fullName: "Grova User",
      });
      setProfileData({
        id: userId,
        fullName: "Grova User",
        username: "user",
        avatar: null,
        verified: false,
      });
    }
  };

  const handleProfileUpdate = (updatedProfile) => {
    console.log("🔄 Profile updated, refreshing header:", updatedProfile);
    setProfileData(updatedProfile);
    setCurrentUser((prev) => ({
      ...prev,
      fullName: updatedProfile.fullName,
      username: updatedProfile.username,
      avatar: updatedProfile.avatar,
      verified: updatedProfile.verified,
    }));
  };

  const handleSignOut = async () => {
    try {
      await authService.signOut();
      setUser(null);
      setCurrentUser(null);
      setProfileData(null);
      setUserBalance({ tokens: 0, points: 0 });
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const renderContent = () => {
    if (!user || !currentUser) return null;

    switch (activeTab) {
      case "home":
        return (
          <Suspense fallback={<LoadingFallback />}>
            <div ref={feedRef}>
              <HomeView
                key={`home-${refreshKey}`}
                homeSection={homeSection}
                setHomeSection={setHomeSection}
                currentUser={currentUser}
                userId={user.id}
              />
            </div>
          </Suspense>
        );

      case "search":
        return (
          <Suspense fallback={<LoadingFallback />}>
            <ExploreView
              key={`explore-${refreshKey}`}
              currentUser={currentUser}
              userId={user.id}
            />
          </Suspense>
        );

      case "create":
        return (
          <Suspense fallback={<LoadingFallback />}>
            <CreateView currentUser={currentUser} userId={user.id} />
          </Suspense>
        );

      case "community":
        return (
          <Suspense fallback={<LoadingFallback />}>
            <CommunityView
              key={`community-${refreshKey}`}
              currentUser={currentUser}
              userId={user.id}
            />
          </Suspense>
        );

      case "account":
        return (
          <Suspense fallback={<LoadingFallback />}>
            <AccountView
              key={`account-${refreshKey}`}
              accountSection={accountSection}
              setAccountSection={setAccountSection}
              currentUser={currentUser}
              isSubscribed={isSubscribed}
              onSignOut={handleSignOut}
              userId={user.id}
              onProfileLoad={handleProfileUpdate}
            />
          </Suspense>
        );

      case "wallet":
        return (
          <Suspense fallback={<LoadingFallback />}>
            <WalletView
              key={`wallet-${refreshKey}`}
              userBalance={userBalance}
              setUserBalance={setUserBalance}
              isMobile={isMobile}
              userId={user.id}
            />
          </Suspense>
        );

      default:
        return (
          <Suspense fallback={<LoadingFallback />}>
            <HomeView
              key={`home-default-${refreshKey}`}
              homeSection={homeSection}
              setHomeSection={setHomeSection}
              currentUser={currentUser}
              userId={user.id}
            />
          </Suspense>
        );
    }
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "linear-gradient(135deg, #000000 0%, #0a0a0a 100%)",
        }}
      >
        <div
          style={{
            fontSize: "64px",
            fontWeight: "900",
            background: "linear-gradient(135deg, #84cc16 0%, #65a30d 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            marginBottom: "32px",
          }}
        >
          GROVA
        </div>

        <div
          style={{
            width: "64px",
            height: "64px",
            border: "4px solid rgba(132, 204, 22, 0.2)",
            borderTop: "4px solid #84cc16",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        ></div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) {
    return (
      <ToastProvider>
        <AuthPage />
      </ToastProvider>
    );
  }

  if (!currentUser) {
    return (
      <ToastProvider>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            background: "linear-gradient(135deg, #000000 0%, #0a0a0a 100%)",
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              border: "4px solid rgba(132, 204, 22, 0.2)",
              borderTop: "4px solid #84cc16",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              marginBottom: "24px",
            }}
          ></div>

          <div
            style={{
              color: "#84cc16",
              fontSize: "18px",
              fontWeight: "600",
            }}
          >
            Loading your profile...
          </div>

          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <div className="app-container">
        {!isMobile && (
          <Sidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
          />
        )}

        {!isMobile && (
          <DesktopHeader
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            userBalance={userBalance}
            currentUser={currentUser}
            getGreeting={getGreeting}
            setSidebarOpen={setSidebarOpen}
            onNotificationClick={() => setShowNotifications(true)}
            onSupportClick={() => setShowSupport(true)}
            profile={profileData}
            userId={user?.id}
          />
        )}

        {isMobile && (
          <MobileHeader
            userBalance={userBalance}
            getGreeting={getGreeting}
            setActiveTab={setActiveTab}
            onNotificationClick={() => setShowNotifications(true)}
            onSupportClick={() => setShowSupport(true)}
            profile={profileData}
            userId={user?.id}
            currentUser={currentUser}
          />
        )}

        <div className="desktop-layout">
          {!isMobile && sidebarOpen && (
            <div className="left-sidebar-placeholder"></div>
          )}

          <main
            ref={containerRef}
            className={
              isMobile ? "main-content-mobile" : "main-content-desktop"
            }
            style={{
              position: "relative",
              overflowY: "auto",
              overflowX: "hidden",
            }}
          >
            {isMobile && (
              <PullToRefreshIndicator
                pullDistance={pullDistance}
                isRefreshing={isRefreshing || isPulling}
              />
            )}

            {renderContent()}
          </main>

          {!isMobile && activeTab !== "community" && (
            <Suspense fallback={<div style={{ width: "300px" }}></div>}>
              <TrendingSidebar />
            </Suspense>
          )}
        </div>

        {isMobile && (
          <MobileBottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
        )}

        {showExitPrompt && (
          <div
            style={{
              position: "fixed",
              bottom: isMobile ? "80px" : "20px",
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(0, 0, 0, 0.9)",
              color: "#84cc16",
              padding: "12px 24px",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "600",
              zIndex: 10000,
              border: "1px solid #84cc16",
              boxShadow: "0 4px 12px rgba(132, 204, 22, 0.3)",
              animation: "slideUp 0.3s ease-out",
            }}
          >
            Press back again to exit
          </div>
        )}

        <NotificationSidebar
          isOpen={showNotifications}
          onClose={() => setShowNotifications(false)}
          isMobile={isMobile}
        />

        <SupportSidebar
          isOpen={showSupport}
          onClose={() => setShowSupport(false)}
          isMobile={isMobile}
        />

        <style>{`
          @keyframes slideUp {
            from {
              transform: translateX(-50%) translateY(20px);
              opacity: 0;
            }
            to {
              transform: translateX(-50%) translateY(0);
              opacity: 1;
            }
          }
        `}</style>
      </div>
    </ToastProvider>
  );
};

export default App;
