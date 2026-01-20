// src/App.jsx - ULTRA FAST WITH TOAST PROVIDER (MINIMAL CHANGES)
import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import './styles/global.css';
import './styles/comment.css';
import './styles/SideBar.css';
import './styles/create.css';
import './styles/HomeView.css';
import './styles/PostCard.css';
import './styles/ReelCard.css';
import './styles/reels.css';
import './styles/StoryCard.css';
import './styles/ProfileModal.css';

import authService from './services/auth/authService';
import { supabase } from './services/config/supabase';
import { ToastProvider } from './contexts/ToastContext';

// Eager load critical components
import DesktopHeader from './components/Shared/DesktopHeader';
import MobileHeader from './components/Shared/MobileHeader';
import MobileBottomNav from './components/Shared/MobileBottomNav';
import Sidebar from './components/Shared/Sidebar';
import AuthPage from './components/Auth/AuthPage';
import SupportSidebar from './components/Shared/SupportSidebar';
import NotificationSidebar from './components/Shared/NotificationSidebar';

// Lazy load views
const HomeView = lazy(() => import('./components/Home/HomeView'));
const ExploreView = lazy(() => import('./components/Explore/ExploreView'));
const CreateView = lazy(() => import('./components/Create/CreateView'));
const AccountView = lazy(() => import('./components/Account/AccountView'));
const WalletView = lazy(() => import('./components/wallet/WalletView'));
const TrendingSidebar = lazy(() => import('./components/Shared/TrendingSidebar'));

// Modern loading component
const LoadingFallback = () => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '200px',
    gap: '16px'
  }}>
    <div style={{
      width: '48px',
      height: '48px',
      border: '4px solid rgba(132, 204, 22, 0.2)',
      borderTop: '4px solid #84cc16',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite'
    }}></div>
    <style>{`
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [accountSection, setAccountSection] = useState('profile');
  const [homeSection, setHomeSection] = useState('newsfeed');
  const [userBalance, setUserBalance] = useState({ tokens: 0, points: 0 });
  const [isSubscribed, setIsSubscribed] = useState(false);

  // NEW STATES FOR NOTIFICATIONS AND SUPPORT SIDEBARS
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSupport, setShowSupport] = useState(false);

  const feedRef = useRef(null);
  const authUnsubscribe = useRef(null);

  useEffect(() => {
    initializeApp();

    authUnsubscribe.current = authService.onAuthStateChange((authenticatedUser) => {
      console.log('🔄 Auth changed:', authenticatedUser ? 'Signed in' : 'Signed out');
      
      if (authenticatedUser) {
        setUser(authenticatedUser);
        // Load user data in background, don't block UI
        loadUserDataAsync(authenticatedUser.id);
      } else {
        setUser(null);
        setCurrentUser(null);
        setUserBalance({ tokens: 0, points: 0 });
      }
    });

    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (authUnsubscribe.current) authUnsubscribe.current();
    };
  }, []);

  const initializeApp = async () => {
    try {
      console.log('🚀 Initializing app...');
      const startTime = Date.now();
      
      // Fast timeout - don't wait forever
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), 1500)
      );
      
      const sessionPromise = authService.getSession();
      
      try {
        const session = await Promise.race([sessionPromise, timeoutPromise]);
        
        console.log(`⏱️ Session check: ${Date.now() - startTime}ms`);
        
        if (session?.user) {
          console.log('✅ Existing session found');
          setUser(session.user);
          // Load user data async
          loadUserDataAsync(session.user.id);
        } else {
          console.log('ℹ️ No session found');
        }
      } catch (err) {
        if (err.message === 'timeout') {
          console.warn('⚠️ Session check timeout, proceeding anyway');
        }
      }
    } catch (error) {
      console.error('❌ Init error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserDataAsync = async (userId) => {
    try {
      console.log('📊 Loading user data in background...');
      const startTime = Date.now();
      
      // Set immediate fallback so UI shows
      setCurrentUser({
        name: 'Loading...',
        username: 'user',
        avatar: 'G',
        verified: false
      });
      
      // Fetch data with timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), 5000)
      );

      const fetchPromise = Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('wallets').select('*').eq('user_id', userId).maybeSingle()
      ]);

      let profileResult, walletResult;
      
      try {
        [profileResult, walletResult] = await Promise.race([fetchPromise, timeoutPromise]);
      } catch (err) {
        if (err.message === 'timeout') {
          console.warn('⚠️ Data fetch timeout');
          // Keep fallback data
          return;
        }
        throw err;
      }

      console.log(`⏱️ Data fetch: ${Date.now() - startTime}ms`);

      let userData = null;
      let balance = { tokens: 0, points: 0 };
      let isPro = false;

      if (profileResult.data) {
        const profile = profileResult.data;
        userData = {
          name: profile.full_name || 'Grova User',
          username: profile.username || 'user',
          avatar: profile.avatar_url || profile.avatar_id || profile.full_name?.charAt(0)?.toUpperCase() || 'G',
          verified: profile.verified || false
        };
        isPro = profile.is_pro || false;
      } else {
        // Profile doesn't exist - use fallback
        userData = {
          name: 'Grova User',
          username: 'user_' + userId.substring(0, 8),
          avatar: 'G',
          verified: false
        };
      }

      if (walletResult.data) {
        const wallet = walletResult.data;
        balance = {
          tokens: wallet.grova_tokens || 0,
          points: wallet.engagement_points || 0
        };
      }

      setCurrentUser(userData);
      setUserBalance(balance);
      setIsSubscribed(isPro);

      console.log(`✅ User data loaded (${Date.now() - startTime}ms)`);

    } catch (error) {
      console.error('❌ Load user data error:', error);
      // Keep fallback data
      setCurrentUser({
        name: 'Grova User',
        username: 'user',
        avatar: 'G',
        verified: false
      });
    }
  };

  const handleSignOut = async () => {
    try {
      console.log('👋 Signing out...');
      await authService.signOut();
      setUser(null);
      setCurrentUser(null);
      setUserBalance({ tokens: 0, points: 0 });
    } catch (error) {
      console.error('❌ Sign out error:', error);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const handleNotificationClick = () => {
    setShowNotifications(true);
    setShowSupport(false);
  };

  const handleSupportClick = () => {
    setShowSupport(true);
    setShowNotifications(false);
  };

  const renderContent = () => {
    if (!user || !currentUser) return null;

    switch (activeTab) {
      case 'home':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <div ref={feedRef}>
              <HomeView
                homeSection={homeSection}
                setHomeSection={setHomeSection}
                currentUser={currentUser}
                userId={user.id}
              />
            </div>
          </Suspense>
        );

      case 'search':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <ExploreView currentUser={currentUser} userId={user.id} />
          </Suspense>
        );

      case 'create':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <CreateView currentUser={currentUser} userId={user.id} />
          </Suspense>
        );

      case 'account':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <AccountView
              accountSection={accountSection}
              setAccountSection={setAccountSection}
              currentUser={currentUser}
              isSubscribed={isSubscribed}
              onSignOut={handleSignOut}
              userId={user.id}
            />
          </Suspense>
        );

      case 'wallet':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <WalletView
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
              homeSection={homeSection}
              setHomeSection={setHomeSection}
              currentUser={currentUser}
              userId={user.id}
            />
          </Suspense>
        );
    }
  };

  // Quick loading screen
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #000000 0%, #0a0a0a 100%)'
      }}>
        <div style={{
          fontSize: '64px',
          fontWeight: '900',
          background: 'linear-gradient(135deg, #84cc16 0%, #65a30d 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '32px'
        }}>
          GROVA
        </div>
        
        <div style={{
          width: '64px',
          height: '64px',
          border: '4px solid rgba(132, 204, 22, 0.2)',
          borderTop: '4px solid #84cc16',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }}></div>

        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
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

  // Show app immediately even if currentUser is still loading
  if (!currentUser) {
    return (
      <ToastProvider>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: 'linear-gradient(135deg, #000000 0%, #0a0a0a 100%)'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            border: '4px solid rgba(132, 204, 22, 0.2)',
            borderTop: '4px solid #84cc16',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            marginBottom: '24px'
          }}></div>
          
          <div style={{
            color: '#84cc16',
            fontSize: '18px',
            fontWeight: '600'
          }}>
            Loading your profile...
          </div>

          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
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
            onNotificationClick={handleNotificationClick}
            onSupportClick={handleSupportClick}
          />
        )}

        {isMobile && (
          <MobileHeader
            userBalance={userBalance}
            getGreeting={getGreeting}
            setActiveTab={setActiveTab}
            onNotificationClick={handleNotificationClick}
            onSupportClick={handleSupportClick}
          />
        )}

        <div className="desktop-layout">
          {!isMobile && sidebarOpen && <div className="left-sidebar-placeholder"></div>}
          
          <main className={isMobile ? "main-content-mobile" : "main-content-desktop"}>
            {renderContent()}
          </main>

          {!isMobile && (
            <Suspense fallback={<div style={{ width: '300px' }}></div>}>
              <TrendingSidebar />
            </Suspense>
          )}
        </div>

        {isMobile && (
          <MobileBottomNav
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
        )}

        {/* NOTIFICATION AND SUPPORT SIDEBARS */}
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
      </div>
    </ToastProvider>
  );
};

export default App;