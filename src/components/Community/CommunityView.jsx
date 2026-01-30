import React, { useState, useEffect, useRef } from "react";
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
  
  // Aggressive caching for instant switching
  const communityCache = useRef({});
  const channelCache = useRef({});
  const lastLoadTime = useRef({});
  const currentCommunityRef = useRef(null);
  const switchTimeoutRef = useRef(null);

  useEffect(() => {
    loadCommunities();
    checkPendingInvite();
  }, [userId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (switchTimeoutRef.current) {
        clearTimeout(switchTimeoutRef.current);
      }
      communityCache.current = {};
      channelCache.current = {};
      lastLoadTime.current = {};
      currentCommunityRef.current = null;
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
      
      // Aggressive caching - store all communities
      userComms.forEach(comm => {
        communityCache.current[comm.id] = comm;
        lastLoadTime.current[comm.id] = Date.now();
      });
    } catch (error) {
      console.error("Error loading communities:", error);
      alert("Failed to load communities. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCommunity = async (community) => {
    // Clear any pending switch timeout
    if (switchTimeoutRef.current) {
      clearTimeout(switchTimeoutRef.current);
    }

    // INSTANT CLEANUP - Clear previous community data immediately
    if (currentCommunityRef.current !== community.id) {
      setSelectedChannel(null);
      currentCommunityRef.current = community.id;
    }

    // INSTANT SWITCH - Use cached data immediately
    const cached = communityCache.current[community.id];
    const cacheAge = Date.now() - (lastLoadTime.current[community.id] || 0);
    const cacheExpiry = 5 * 60 * 1000; // 5 minutes

    if (cached && cacheAge < cacheExpiry) {
      // Use cache instantly with no delay
      setSelectedCommunity(cached);
      setView("chat");
      
      // Load fresh data in background silently
      switchTimeoutRef.current = setTimeout(async () => {
        try {
          const fresh = await communityService.fetchCommunityDetails(community.id);
          communityCache.current[fresh.id] = fresh;
          lastLoadTime.current[fresh.id] = Date.now();
          // Only update if still on this community
          if (currentCommunityRef.current === fresh.id) {
            setSelectedCommunity(fresh);
          }
        } catch (error) {
          console.error("Background refresh error:", error);
        }
      }, 100);
    } else {
      // Still show old cache immediately while loading
      if (cached) {
        setSelectedCommunity(cached);
        setView("chat");
      }
      
      // Load fresh data
      try {
        const fresh = await communityService.fetchCommunityDetails(community.id);
        communityCache.current[fresh.id] = fresh;
        lastLoadTime.current[fresh.id] = Date.now();
        // Only update if still on this community
        if (currentCommunityRef.current === fresh.id) {
          setSelectedCommunity(fresh);
        }
      } catch (error) {
        console.error("Error loading community details:", error);
        // Still use cache on error
        if (cached && currentCommunityRef.current === community.id) {
          setSelectedCommunity(cached);
          setView("chat");
        }
      }
    }
  };

  const handleCreateCommunity = async (communityData) => {
    try {
      const newCommunity = await communityService.createCommunity(
        communityData,
        userId
      );

      // Add to cache
      communityCache.current[newCommunity.id] = newCommunity;
      lastLoadTime.current[newCommunity.id] = Date.now();
      
      // Reload communities
      await loadCommunities();
      
      // Select the newly created community
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
      
      // Reload communities
      await loadCommunities();

      // Get the full community details and navigate to it
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
      // Reload communities
      await loadCommunities();
      
      // Get the community details
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

      // Remove from cache
      delete communityCache.current[communityId];
      delete lastLoadTime.current[communityId];
      delete channelCache.current[communityId];

      // INSTANT CLEANUP - If we're currently viewing this community
      if (selectedCommunity?.id === communityId) {
        setSelectedCommunity(null);
        setSelectedChannel(null);
        setView("discover");
        currentCommunityRef.current = null;
      }

      // Reload communities
      await loadCommunities();
    } catch (error) {
      console.error("Error leaving community:", error);
      alert(error.message || "Failed to leave community");
    }
  };

  const handleDeleteCommunity = async (communityId) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this community? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      await communityService.deleteCommunity(communityId, userId);

      // Remove from cache
      delete communityCache.current[communityId];
      delete lastLoadTime.current[communityId];
      delete channelCache.current[communityId];

      // INSTANT CLEANUP
      if (selectedCommunity?.id === communityId) {
        setSelectedCommunity(null);
        setSelectedChannel(null);
        setView("discover");
        currentCommunityRef.current = null;
      }

      // Reload communities
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
        selectedCommunity.id
      );
      communityCache.current[updated.id] = updated;
      lastLoadTime.current[updated.id] = Date.now();
      // Only update if still on this community
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

  if (loading) {
    return (
      <div className="community-loading">
        <div className="spinner"></div>
        <p>Loading communities...</p>
      </div>
    );
  }

  return (
    <div className="community-view">
      <CommunitySidebar
        myCommunities={myCommunities}
        selectedCommunity={selectedCommunity}
        onSelectCommunity={handleSelectCommunity}
        onCreateCommunity={() => setShowCreateCommunity(true)}
        onGoHome={() => {
          // INSTANT CLEANUP
          setSelectedCommunity(null);
          setSelectedChannel(null);
          setView("discover");
          currentCommunityRef.current = null;
        }}
        view={view}
      />

      <div className="community-content">
        {view === "discover" ? (
          <DiscoverTab
            communities={allCommunities}
            myCommunities={myCommunities}
            onJoin={handleJoinCommunity}
            onSelect={handleSelectCommunity}
          />
        ) : (
          selectedCommunity && (
            <ChatTab
              key={selectedCommunity.id}
              community={selectedCommunity}
              userId={userId}
              currentUser={currentUser}
              selectedChannel={selectedChannel}
              setSelectedChannel={setSelectedChannel}
              onLeaveCommunity={() => handleLeaveCommunity(selectedCommunity.id)}
              onCommunityUpdate={handleCommunityUpdate}
              onOpenInvite={handleOpenInvite}
              onDeleteCommunity={() =>
                handleDeleteCommunity(selectedCommunity.id)
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
    </div>
  );
};

export default CommunityView;