// components/Community/CommunityView.jsx
// FULL REWRITE: No entry loader, online presence, invite auto-redirect, image icons
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
  // NO loading state — we render immediately with empty data, fill as it arrives
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
  const switchTimeoutRef    = useRef(null);
  const sidebarRef          = useRef(null);

  // ── Mobile detection ──────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Hide mobile nav when in chat ──────────────────────────────────────────
  useEffect(() => {
    const shouldHide = isMobile && view === "chat";
    document.body.classList.toggle("community-chat-open", shouldHide);
    return () => document.body.classList.remove("community-chat-open");
  }, [isMobile, view]);

  // ── User profile ──────────────────────────────────────────────────────────
  useEffect(() => { loadFullUserProfile(); }, [userId]);

  const loadFullUserProfile = async () => {
    try {
      const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
      setFullUserProfile({
        id: data.id,
        username: data.username,
        full_name: data.full_name,
        avatar_id: data.avatar_id,
        avatar_metadata: data.avatar_metadata,
        verified: data.verified || false,
      });
    } catch {
      setFullUserProfile({
        id: userId,
        username: currentUser?.username || "user",
        full_name: currentUser?.fullName || currentUser?.full_name || "User",
        avatar_id: null, avatar_metadata: null, verified: false,
      });
    }
  };

  // ── Load communities (no loading gate) ───────────────────────────────────
  useEffect(() => {
    loadCommunities();
    checkPendingInvite();
    return () => { if (switchTimeoutRef.current) clearTimeout(switchTimeoutRef.current); };
  }, [userId]);

  const checkPendingInvite = () => {
    const code = new URLSearchParams(window.location.search).get("invite");
    if (code) {
      setPendingInvite(code);
      window.history.replaceState({}, "", window.location.pathname);
    }
  };

  const loadCommunities = async () => {
    try {
      const [userComms, allComms] = await Promise.all([
        communityService.fetchUserCommunities(userId),
        communityService.fetchCommunities(userId),
      ]);
      setMyCommunities(userComms);
      setAllCommunities(allComms);
    } catch (error) {
      console.error("Error loading communities:", error);
    }
  };

  // ── Community actions ─────────────────────────────────────────────────────
  const handleSelectCommunity = async (community) => {
    if (switchTimeoutRef.current) clearTimeout(switchTimeoutRef.current);
    if (currentCommunityRef.current !== community.id) {
      setSelectedChannel(null);
      currentCommunityRef.current = community.id;
    }
    setSelectedCommunity(community);
    setView("chat");
    if (isMobile) setSidebarOpen(false);

    switchTimeoutRef.current = setTimeout(async () => {
      try {
        const fresh = await communityService.fetchCommunityDetails(community.id);
        if (currentCommunityRef.current === fresh?.id) setSelectedCommunity(fresh);
      } catch {}
    }, 80);
  };

  const handleCreateCommunity = async (communityData) => {
    const newCommunity = await communityService.createCommunity(communityData, userId);
    await loadCommunities();
    handleSelectCommunity(newCommunity);
    setShowCreateCommunity(false);
  };

  const handleJoinCommunity = async (communityId) => {
    try {
      await communityService.joinCommunity(communityId, userId);
      await loadCommunities();
      const joined = await communityService.fetchCommunityDetails(communityId);
      if (joined) handleSelectCommunity(joined);
    } catch (error) {
      console.error("Error joining community:", error);
      alert(error.message || "Failed to join community");
    }
  };

  // Invite success: reload and navigate straight into community
  const handleInviteSuccess = async (communityId) => {
    try {
      await loadCommunities();
      const community = await communityService.fetchCommunityDetails(communityId);
      if (community) handleSelectCommunity(community);
      setPendingInvite(null);
    } catch {
      setPendingInvite(null);
      await loadCommunities();
    }
  };

  const handleInviteError = (error) => {
    console.error("Invite error:", error);
    setPendingInvite(null);
  };

  const handleLeaveCommunity = async (communityId) => {
    if (!window.confirm("Are you sure you want to leave this community?")) return;
    try {
      await communityService.leaveCommunity(communityId, userId);
      if (selectedCommunity?.id === communityId) {
        setSelectedCommunity(null); setSelectedChannel(null);
        setView("discover"); currentCommunityRef.current = null;
      }
      await loadCommunities();
    } catch (error) {
      alert(error.message || "Failed to leave community");
    }
  };

  const handleDeleteCommunity = async (communityId) => {
    if (!window.confirm("Delete this community? This cannot be undone.")) return;
    try {
      await communityService.deleteCommunity(communityId, userId);
      if (selectedCommunity?.id === communityId) {
        setSelectedCommunity(null); setSelectedChannel(null);
        setView("discover"); currentCommunityRef.current = null;
      }
      await loadCommunities();
    } catch (error) {
      alert(error.message || "Failed to delete community");
    }
  };

  const handleCommunityUpdate = async () => {
    await loadCommunities();
    if (selectedCommunity) {
      const updated = await communityService.fetchCommunityDetails(selectedCommunity.id);
      if (currentCommunityRef.current === updated?.id) setSelectedCommunity(updated);
    }
  };

  const handleOpenInvite = (community) => {
    setInviteCommunity(community || selectedCommunity);
    setShowInviteModal(true);
  };

  // ── Touch swipe ───────────────────────────────────────────────────────────
  const handleTouchStart = (e) => {
    if (!isMobile || view !== "chat") return;
    const tx = e.touches[0].clientX;
    setTouchStart(tx); setTouchCurrent(tx);
    if (tx < 30 || sidebarOpen) setIsSwiping(true);
  };
  const handleTouchMove = (e) => {
    if (!isSwiping || !isMobile) return;
    setTouchCurrent(e.touches[0].clientX);
  };
  const handleTouchEnd = () => {
    if (!isSwiping || !isMobile) return;
    const diff = touchCurrent - touchStart;
    if (sidebarOpen && diff < -50) setSidebarOpen(false);
    else if (!sidebarOpen && diff > 50 && touchStart < 30) setSidebarOpen(true);
    else if (!sidebarOpen && diff > 100) setSidebarOpen(true);
    setIsSwiping(false); setTouchStart(0); setTouchCurrent(0);
  };

  const getSidebarTransform = () => {
    if (!isMobile || view !== "chat") return undefined;
    if (isSwiping) {
      const diff = touchCurrent - touchStart;
      if (sidebarOpen) return `translateX(${Math.min(0, diff)}px)`;
      if (touchStart < 30 || diff > 0) return `translateX(${Math.max(-280, -280 + diff)}px)`;
    }
    return undefined;
  };

  // ── Render — NO loading spinner or gate ───────────────────────────────────
  return (
    <div
      className="community-view"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {isMobile && view === "chat" && sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <div
        ref={sidebarRef}
        className={`sidebar-container${isMobile && view === "chat" ? " mobile-sidebar" : ""}${sidebarOpen ? " open" : ""}`}
        style={isSwiping ? { transform: getSidebarTransform(), transition: "none" } : undefined}
      >
        <CommunitySidebar
          myCommunities={myCommunities}
          selectedCommunity={selectedCommunity}
          onSelectCommunity={handleSelectCommunity}
          onCreateCommunity={() => setShowCreateCommunity(true)}
          onGoHome={() => {
            setSelectedCommunity(null); setSelectedChannel(null);
            setView("discover"); currentCommunityRef.current = null;
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
          selectedCommunity && fullUserProfile && (
            <ChatTab
              key={selectedCommunity.id}
              community={selectedCommunity}
              userId={userId}
              currentUser={fullUserProfile}
              selectedChannel={selectedChannel}
              setSelectedChannel={setSelectedChannel}
              onLeaveCommunity={() => handleLeaveCommunity(selectedCommunity.id)}
              onCommunityUpdate={handleCommunityUpdate}
              onOpenInvite={handleOpenInvite}
              onDeleteCommunity={() => handleDeleteCommunity(selectedCommunity.id)}
              onBack={isMobile ? () => {
                setSelectedCommunity(null); setSelectedChannel(null);
                setView("discover"); currentCommunityRef.current = null;
              } : undefined}
              onToggleSidebar={isMobile ? () => setSidebarOpen(!sidebarOpen) : undefined}
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
          onClose={() => { setShowInviteModal(false); setInviteCommunity(null); }}
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