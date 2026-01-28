import React, { useState, useEffect } from "react";
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

  useEffect(() => {
    loadCommunities();
    checkPendingInvite();
  }, [userId]);

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
    setSelectedCommunity(community);
    setView("chat");
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
        setView("discover");
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
        setView("discover");
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
      setSelectedCommunity(updated);
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
          setSelectedCommunity(null);
          setView("discover");
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
          <ChatTab
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
