// components/Community/CommunityView.jsx - MOBILE-OPTIMIZED WITH SWIPEABLE SIDEBAR
import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../../services/config/supabase";
import CommunitySidebar from "./tabs/CommunitySidebar";
import DiscoverTab from "./tabs/DiscoverTab";
import ChatTab from "./tabs/ChatTab";
import CreateCommunityModal from "./modals/CreateCommunityModal";
import InviteModal from "./modals/InviteModal";
import InviteHandler from "./components/InviteHandler";
import communityService from "../../services/community/communityService";
import "../../styles/CommunityView.css";

const CommunityView = ({ userId, currentUser }) => {
  const [view, setView] = useState("discover");
  const [selectedCommunity, setSelectedCommunity] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [myCommunities, setMyCommunities] = useState([]);
  const [allCommunities, setAllCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateCommunity, setShowCreateCommunity] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteCommunity, setInviteCommunity] = useState(null);
  const [pendingInvite, setPendingInvite] = useState(null);
  const [fullUserProfile, setFullUserProfile] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [touchCurrent, setTouchCurrent] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const currentCommunityRef = useRef(null);
  const switchTimeoutRef = useRef(null);
  const sidebarRef = useRef(null);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Load full user profile with avatar_id
  useEffect(() => {
    loadFullUserProfile();
  }, [userId]);

  const loadFullUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;

      console.log("✅ [COMMUNITY] Loaded full profile:", data);

      setFullUserProfile({
        id: data.id,
        username: data.username,
        full_name: data.full_name,
        avatar_id: data.avatar_id,
        avatar_metadata: data.avatar_metadata,
        verified: data.verified || false,
      });
    } catch (error) {
      console.error("❌ Failed to load user profile:", error);
      setFullUserProfile({
        id: userId,
        username: currentUser?.username || "user",
        full_name: currentUser?.fullName || currentUser?.full_name || "User",
        avatar_id: null,
        avatar_metadata: null,
        verified: false,
      });
    }
  };

  useEffect(() => {
    loadCommunities();
    checkPendingInvite();
  }, [userId]);

  useEffect(() => {
    return () => {
      if (switchTimeoutRef.current) {
        clearTimeout(switchTimeoutRef.current);
      }
    };
  }, []);

  const checkPendingInvite = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const inviteCode = urlParams.get("invite");

    if (inviteCode) {
      setPendingInvite(inviteCode);
      window.history.replaceState({}, "", window.location.pathname);
    }
  };

  const loadCommunities = async () => {
    try {
      setLoading(true);
      const [userComms, allComms] = await Promise.all([
        communityService.fetchUserCommunities(userId),
        communityService.fetchCommunities(userId),
      ]);

      setMyCommunities(userComms);
      setAllCommunities(allComms);
    } catch (error) {
      console.error("Error loading communities:", error);
      alert("Failed to load communities. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCommunity = async (community) => {
    if (switchTimeoutRef.current) {
      clearTimeout(switchTimeoutRef.current);
    }

    if (currentCommunityRef.current !== community.id) {
      setSelectedChannel(null);
      currentCommunityRef.current = community.id;
    }

    setSelectedCommunity(community);
    setView("chat");

    // Close sidebar on mobile after selection
    if (isMobile) {
      setSidebarOpen(false);
    }

    switchTimeoutRef.current = setTimeout(async () => {
      try {
        const fresh = await communityService.fetchCommunityDetails(
          community.id,
        );
        if (currentCommunityRef.current === fresh.id) {
          setSelectedCommunity(fresh);
        }
      } catch (error) {
        console.error("Background refresh error:", error);
      }
    }, 100);
  };

  const handleCreateCommunity = async (communityData) => {
    try {
      const newCommunity = await communityService.createCommunity(
        communityData,
        userId,
      );
      await loadCommunities();
      handleSelectCommunity(newCommunity);
      setShowCreateCommunity(false);
    } catch (error) {
      console.error("Error creating community:", error);
      throw error;
    }
  };

  const handleJoinCommunity = async (communityId) => {
    try {
      await communityService.joinCommunity(communityId, userId);
      await loadCommunities();

      const joinedCommunity =
        await communityService.fetchCommunityDetails(communityId);
      if (joinedCommunity) {
        handleSelectCommunity(joinedCommunity);
      }
    } catch (error) {
      console.error("Error joining community:", error);
      alert(error.message || "Failed to join community");
    }
  };

  const handleInviteSuccess = async (communityId) => {
    try {
      await loadCommunities();
      const community =
        await communityService.fetchCommunityDetails(communityId);
      if (community) {
        handleSelectCommunity(community);
      }
      setPendingInvite(null);
    } catch (error) {
      console.error("Error after invite success:", error);
      setPendingInvite(null);
      await loadCommunities();
    }
  };

  const handleInviteError = (error) => {
    console.error("Invite error:", error);
    alert(error.message || "Failed to join community");
    setPendingInvite(null);
  };

  const handleLeaveCommunity = async (communityId) => {
    if (!window.confirm("Are you sure you want to leave this community?")) {
      return;
    }

    try {
      await communityService.leaveCommunity(communityId, userId);

      if (selectedCommunity?.id === communityId) {
        setSelectedCommunity(null);
        setSelectedChannel(null);
        setView("discover");
        currentCommunityRef.current = null;
      }

      await loadCommunities();
    } catch (error) {
      console.error("Error leaving community:", error);
      alert(error.message || "Failed to leave community");
    }
  };

  const handleDeleteCommunity = async (communityId) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this community? This action cannot be undone.",
      )
    ) {
      return;
    }

    try {
      await communityService.deleteCommunity(communityId, userId);

      if (selectedCommunity?.id === communityId) {
        setSelectedCommunity(null);
        setSelectedChannel(null);
        setView("discover");
        currentCommunityRef.current = null;
      }

      await loadCommunities();
    } catch (error) {
      console.error("Error deleting community:", error);
      alert(error.message || "Failed to delete community");
    }
  };

  const handleCommunityUpdate = async () => {
    await loadCommunities();
    if (selectedCommunity) {
      const updated = await communityService.fetchCommunityDetails(
        selectedCommunity.id,
      );
      if (currentCommunityRef.current === updated.id) {
        setSelectedCommunity(updated);
      }
    }
  };

  const handleOpenInvite = (community) => {
    setInviteCommunity(community || selectedCommunity);
    setShowInviteModal(true);
  };

  const handleCloseInvite = () => {
    setShowInviteModal(false);
    setInviteCommunity(null);
  };

  const handleBackToDiscover = () => {
    setSelectedCommunity(null);
    setSelectedChannel(null);
    setView("discover");
    currentCommunityRef.current = null;
  };

  // Touch handlers for swipe gesture
  const handleTouchStart = (e) => {
    if (!isMobile || view !== "chat") return;

    const touch = e.touches[0];
    setTouchStart(touch.clientX);
    setTouchCurrent(touch.clientX);

    // Only initiate swipe from left edge (first 30px) or if sidebar is already open
    if (touch.clientX < 30 || sidebarOpen) {
      setIsSwiping(true);
    }
  };

  const handleTouchMove = (e) => {
    if (!isSwiping || !isMobile) return;

    const touch = e.touches[0];
    setTouchCurrent(touch.clientX);
  };

  const handleTouchEnd = () => {
    if (!isSwiping || !isMobile) return;

    const diff = touchCurrent - touchStart;

    // If sidebar is open and swiping left, close it
    if (sidebarOpen && diff < -50) {
      setSidebarOpen(false);
    }
    // If sidebar is closed and swiping right from edge, open it
    else if (!sidebarOpen && diff > 50 && touchStart < 30) {
      setSidebarOpen(true);
    }
    // If already swiping right significantly, open it
    else if (!sidebarOpen && diff > 100) {
      setSidebarOpen(true);
    }

    setIsSwiping(false);
    setTouchStart(0);
    setTouchCurrent(0);
  };

  // Calculate sidebar transform for smooth swipe animation
  const getSidebarTransform = () => {
    if (!isMobile || view !== "chat") return "translateX(0)";

    if (isSwiping) {
      const diff = touchCurrent - touchStart;

      if (sidebarOpen) {
        // Sidebar is open, can only swipe left to close
        const offset = Math.min(0, diff);
        return `translateX(${offset}px)`;
      } else {
        // Sidebar is closed, can swipe right to open
        if (touchStart < 30 || diff > 0) {
          const offset = Math.max(-280, -280 + diff);
          return `translateX(${offset}px)`;
        }
      }
    }

    return sidebarOpen ? "translateX(0)" : "translateX(-280px)";
  };

  if (loading) {
    return (
      <div className="community-loading">
        <div className="spinner"></div>
        <p>Loading communities...</p>
      </div>
    );
  }

  const showMobileCommunityView =
    isMobile && view === "chat" && selectedCommunity;

  return (
    <div
      className={`community-view ${showMobileCommunityView ? "mobile-community-active" : ""}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Sidebar overlay for mobile */}
      {isMobile && view === "chat" && sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        ref={sidebarRef}
        className={`sidebar-container ${showMobileCommunityView ? "mobile-sidebar" : ""} ${sidebarOpen ? "open" : ""}`}
        style={{
          transform:
            isMobile && view === "chat" ? getSidebarTransform() : undefined,
          transition: isSwiping
            ? "none"
            : "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <CommunitySidebar
          myCommunities={myCommunities}
          selectedCommunity={selectedCommunity}
          onSelectCommunity={handleSelectCommunity}
          onCreateCommunity={() => setShowCreateCommunity(true)}
          onGoHome={() => {
            setSelectedCommunity(null);
            setSelectedChannel(null);
            setView("discover");
            currentCommunityRef.current = null;
            setSidebarOpen(false);
          }}
          view={view}
        />
      </div>

      <div className="community-content">
        {view === "discover" ? (
          <DiscoverTab
            communities={allCommunities}
            myCommunities={myCommunities}
            onJoin={handleJoinCommunity}
            onSelect={handleSelectCommunity}
          />
        ) : (
          selectedCommunity &&
          fullUserProfile && (
            <ChatTab
              key={selectedCommunity.id}
              community={selectedCommunity}
              userId={userId}
              currentUser={fullUserProfile}
              selectedChannel={selectedChannel}
              setSelectedChannel={setSelectedChannel}
              onLeaveCommunity={() =>
                handleLeaveCommunity(selectedCommunity.id)
              }
              onCommunityUpdate={handleCommunityUpdate}
              onOpenInvite={handleOpenInvite}
              onDeleteCommunity={() =>
                handleDeleteCommunity(selectedCommunity.id)
              }
              onBack={isMobile ? handleBackToDiscover : undefined}
              onToggleSidebar={
                isMobile ? () => setSidebarOpen(!sidebarOpen) : undefined
              }
            />
          )
        )}
      </div>

      {showCreateCommunity && (
        <CreateCommunityModal
          onClose={() => setShowCreateCommunity(false)}
          onCreate={handleCreateCommunity}
        />
      )}

      {showInviteModal && inviteCommunity && (
        <InviteModal
          community={inviteCommunity}
          userId={userId}
          onClose={handleCloseInvite}
        />
      )}

      {pendingInvite && (
        <InviteHandler
          inviteCode={pendingInvite}
          userId={userId}
          onSuccess={handleInviteSuccess}
          onError={handleInviteError}
          onClose={() => setPendingInvite(null)}
        />
      )}

      <style jsx>{`
        .sidebar-container {
          position: relative;
          z-index: 100;
        }

        .community-content {
          flex: 1;
          overflow: hidden;
          position: relative;
        }

        .community-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          background: #000;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(156, 255, 0, 0.2);
          border-top-color: #9cff00;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin-bottom: 16px;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .community-loading p {
          color: #9cff00;
          font-size: 14px;
          font-weight: 600;
        }

        /* Mobile-specific styles */
        @media (max-width: 768px) {
          .community-view.mobile-community-active {
            position: fixed;
            inset: 0;
            z-index: 1000;
          }

          .sidebar-container.mobile-sidebar {
            position: fixed;
            left: 0;
            top: 0;
            bottom: 0;
            width: 280px;
            z-index: 1002;
            transform: translateX(-280px);
          }

          .sidebar-container.mobile-sidebar.open {
            transform: translateX(0);
          }

          .sidebar-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(4px);
            z-index: 1001;
            animation: fadeIn 0.3s ease;
          }

          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }

          .mobile-community-active .community-content {
            position: fixed;
            inset: 0;
            z-index: 1000;
          }
        }
      `}</style>
    </div>
  );
};

export default CommunityView;
