// components/Community/CommunityView.jsx
// REVISION: wires a background channel-prefetch into the sidebar (fires on
// pointer-hover, fetches silently, never changes anything visually) so that
// by the time a click lands, ChatTab/ChannelsView already have the data
// cached and paint instantly. Everything else is unchanged from the
// original "no loading gate" architecture.
import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../../services/config/supabase";
import CommunitySidebar from "./tabs/CommunitySidebar";
import DiscoverTab from "./tabs/DiscoverTab";
import ChannelsView from "./tabs/ChannelsView";
import ChatTab from "./tabs/ChatTab";
import CreateCommunityModal from "./modals/CreateCommunityModal";
import InviteModal from "./modals/InviteModal";
import InviteHandler from "./components/InviteHandler";
import ConfirmModal from "../Modals/ConfirmModal";
import communityService from "../../services/community/communityService";
import channelService from "../../services/community/channelService";
import communityCache from "../../services/community/communityCache";
import "../../styles/CommunityView.css";

const CommunityView = ({ userId, currentUser, onNavigate }) => {
  const [view, setView] = useState("discover");
  const [selectedCommunity, setSelectedCommunity] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [myCommunities, setMyCommunities] = useState(() => communityService.getCachedUserCommunities(userId));
  const [allCommunities, setAllCommunities] = useState(() => communityService.getCachedCommunities(userId));
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
  const [confirmAction, setConfirmAction] = useState(null);

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
        subscription_tier: data.subscription_tier || null,
        boost_selections: data.boost_selections || {},
      });
    } catch {
      setFullUserProfile({
        id: userId,
        username: currentUser?.username || "user",
        full_name: currentUser?.fullName || currentUser?.full_name || "User",
        avatar_id: null, avatar_metadata: null, verified: false,
        subscription_tier: null, boost_selections: {},
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
      // Warm every joined community's channel list before the user opens one.
      // The cache deduplicates these requests and lets ChannelsView paint from
      // memory on first navigation instead of waiting on its mount effect.
      userComms.forEach((community) => {
        communityCache.prefetchChannels(community.id, (id) => channelService.fetchChannels(id)).catch(() => {});
      });
    } catch (error) {
      console.error("Error loading communities:", error);
    }
  };

  // ── Background channel prefetch ───────────────────────────────────────────
  // Fired on sidebar hover (see CommunitySidebar). Purely a background
  // network call into the shared cache — nothing renders differently while
  // it runs, so it never conflicts with "no hover reveals" from the UI side.
  const handlePrefetchCommunity = (communityId) => {
    if (!communityId) return;
    communityCache.prefetchChannels(communityId, (id) => channelService.fetchChannels(id)).catch(() => {});
  };

  // ── Community actions ─────────────────────────────────────────────────────
  const handleSelectCommunity = async (community) => {
    if (switchTimeoutRef.current) clearTimeout(switchTimeoutRef.current);
    if (currentCommunityRef.current !== community.id) {
      setSelectedChannel(null);
      currentCommunityRef.current = community.id;
    }
    // Kick a prefetch off immediately too — covers touch devices / clicks
    // that land without a preceding hover.
    handlePrefetchCommunity(community.id);
    setSelectedCommunity(community);
    // On mobile, show channels view; on desktop, go straight to chat
    setView(isMobile ? "channels" : "chat");
    if (isMobile) setSidebarOpen(false);

    switchTimeoutRef.current = setTimeout(async () => {
      try {
        const fresh = await communityService.fetchCommunityDetails(community.id);
        if (currentCommunityRef.current === fresh?.id) setSelectedCommunity(fresh);
      } catch {}
    }, 80);
  };

  const handleSelectChannel = async (channel) => {
    setSelectedChannel(channel);
    setView("chat"); // Move to chat when a channel is selected
  };

  const handleCreateCommunity = async (communityData) => {
    const newCommunity = await communityService.createCommunity(communityData, userId);
    await loadCommunities();
    handleSelectCommunity(newCommunity);
    setShowCreateCommunity(false);
  };

  const handleJoinCommunity = async (communityId) => {
    const community = allCommunities.find((item) => item.id === communityId);
    if (!community || myCommunities.some((item) => item.id === communityId)) return;

    // Update navigation and sidebar state immediately; persistence continues in the background.
    const optimisticCommunity = { ...community, member_count: (community.member_count || 0) + 1 };
    setMyCommunities((current) => [...current, optimisticCommunity]);
    setSelectedCommunity(optimisticCommunity);
    currentCommunityRef.current = communityId;
    setSelectedChannel(null);
    setView(isMobile ? "channels" : "chat");
    if (isMobile) setSidebarOpen(false);

    try {
      await communityService.joinCommunity(communityId, userId);
      await loadCommunities();
      const joined = await communityService.fetchCommunityDetails(communityId);
      if (joined) handleSelectCommunity(joined);
    } catch (error) {
      setMyCommunities((current) => current.filter((item) => item.id !== communityId));
      if (currentCommunityRef.current === communityId) {
        setSelectedCommunity(null);
        setSelectedChannel(null);
        currentCommunityRef.current = null;
        setView("discover");
      }
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
    try {
      await communityService.leaveCommunity(communityId, userId);
      communityCache.clearCommunity(communityId);
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
    const removedCommunity = selectedCommunity?.id === communityId;
    setMyCommunities((current) => current.filter((item) => item.id !== communityId));
    setAllCommunities((current) => current.filter((item) => item.id !== communityId));
    communityCache.clearCommunity(communityId);
    if (removedCommunity) {
      setSelectedCommunity(null); setSelectedChannel(null);
      setView("discover"); currentCommunityRef.current = null;
    }
    try {
      await communityService.deleteCommunity(communityId, userId);
      await loadCommunities();
    } catch (error) {
      await loadCommunities();
      alert(error.message || "Failed to delete community");
    }
  };

  const openConfirm = (title, message, action, dangerous = false) => {
    setConfirmAction({ title, message, action, dangerous });
  };

  const handleCommunityUpdate = async (payload) => {
    if (payload?.type === "community" && selectedCommunity) {
      await communityService.updateCommunity(selectedCommunity.id, userId, payload.settings);
    }
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
          onPrefetchCommunity={handlePrefetchCommunity}
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
        ) : view === "channels" && selectedCommunity ? (
          <ChannelsView
            community={selectedCommunity}
            userId={userId}
            currentUser={fullUserProfile || currentUser || { id: userId }}
            onSelectChannel={handleSelectChannel}
            onBack={() => {
              setSelectedCommunity(null); setSelectedChannel(null);
              setView("discover"); currentCommunityRef.current = null;
            }}
          />
        ) : (
          selectedCommunity && (
            <ChatTab
              key={selectedCommunity.id}
              community={selectedCommunity}
              userId={userId}
              currentUser={fullUserProfile || currentUser || { id: userId }}
              selectedChannel={selectedChannel}
              setSelectedChannel={setSelectedChannel}
              onLeaveCommunity={() => openConfirm("Leave community?", "You can always rejoin later.", () => handleLeaveCommunity(selectedCommunity.id))}
              onCommunityUpdate={handleCommunityUpdate}
              onOpenInvite={handleOpenInvite}
              onDeleteCommunity={() => openConfirm("Delete this community?", "This permanently deletes the community and all of its data. This cannot be undone.", () => handleDeleteCommunity(selectedCommunity.id), true)}
              onBack={isMobile ? () => {
                setSelectedChannel(null);
                setView("channels");
              } : undefined}
              onToggleSidebar={isMobile ? () => setSidebarOpen(!sidebarOpen) : undefined}
              onNavigate={onNavigate}
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

      <ConfirmModal
        show={!!confirmAction}
        title={confirmAction?.title || ""}
        message={confirmAction?.message || ""}
        dangerous={confirmAction?.dangerous}
        confirmText={confirmAction?.dangerous ? "Delete" : "Continue"}
        onConfirm={async () => {
          const action = confirmAction?.action;
          setConfirmAction(null);
          if (action) await action();
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
};

export default CommunityView;