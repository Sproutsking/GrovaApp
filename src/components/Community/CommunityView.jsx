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
import communityUnreadService from "../../services/community/communityUnreadService";
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
  const [postCreateGuide, setPostCreateGuide] = useState(null);
  const [fullUserProfile, setFullUserProfile] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [touchCurrent, setTouchCurrent] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const lastLocationKey = `xeevia:last-community-location:${userId}`;
  const readLocations = () => {
    try {
      const stored = JSON.parse(localStorage.getItem(lastLocationKey) || "{}");
      return stored.locations || (stored.communityId ? { [stored.communityId]: stored } : {});
    } catch {
      return {};
    }
  };
  const saveLocation = (communityId, location) => {
    const locations = readLocations();
    locations[communityId] = { communityId, ...locations[communityId], ...location };
    localStorage.setItem(lastLocationKey, JSON.stringify({ locations, lastVisitedCommunityId: communityId }));
  };

  const currentCommunityRef = useRef(null);
  const switchTimeoutRef    = useRef(null);
  const sidebarRef          = useRef(null);
  const communityViewRef    = useRef(null);

  // ── Mobile detection ──────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Keep this surface below the actual root header, including devices where
  // the header height changes because of safe-area or responsive content.
  useEffect(() => {
    if (!isMobile) return undefined;

    const updateHeaderOffset = () => {
      const header = document.querySelector(".mh-header");
      const viewElement = communityViewRef.current;
      if (!header || !viewElement) return;
      const headerBottom = Math.max(0, Math.ceil(header.getBoundingClientRect().bottom));
      viewElement.style.setProperty("--community-mobile-top", `${headerBottom}px`);
    };

    updateHeaderOffset();
    const header = document.querySelector(".mh-header");
    const observer = typeof ResizeObserver !== "undefined" && header
      ? new ResizeObserver(updateHeaderOffset)
      : null;
    observer?.observe(header);
    window.addEventListener("resize", updateHeaderOffset);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateHeaderOffset);
    };
  }, [isMobile]);

  // ── Give the community its own full mobile surface ───────────────────────
  // Only hide the global shell while an actual community surface is open.
  // This prevents the root header/bottom nav from disappearing by default on
  // mobile when the user is elsewhere in the app.
  useEffect(() => {
    if (!isMobile) {
      document.body.classList.remove("community-fullscreen");
      return undefined;
    }

    const shouldHide = !!selectedCommunity && (view === "chat" || view === "channels");
    document.body.classList.toggle("community-fullscreen", shouldHide);

    return () => {
      document.body.classList.remove("community-fullscreen");
    };
  }, [isMobile, selectedCommunity, view]);

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
      communityUnreadService.sync(userId, userComms).catch((error) => console.warn("Community unread sync:", error));
      const locations = readLocations();
      const savedCommunityId = Object.values(locations).sort((a, b) => (b?.lastVisited || 0) - (a?.lastVisited || 0))[0]?.communityId;
      const restoredCommunity = userComms.find((item) => item.id === savedCommunityId);
      if (restoredCommunity && !new URLSearchParams(window.location.search).get("invite")) {
        const restored = await communityService.fetchCommunityDetails(restoredCommunity.id);
        if (restored) handleSelectCommunity(restored);
      }
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
    const mobileViewport = window.innerWidth <= 768;
    if (currentCommunityRef.current !== community.id) {
      setSelectedChannel(null);
      currentCommunityRef.current = community.id;
    }
    // Kick a prefetch off immediately too — covers touch devices / clicks
    // that land without a preceding hover.
    handlePrefetchCommunity(community.id);
    setSelectedCommunity(community);
    saveLocation(community.id, { view: mobileViewport ? "channels" : "chat", lastVisited: Date.now() });
    // On mobile, show channels view; on desktop, go straight to chat
    setView(mobileViewport ? "channels" : "chat");
    if (mobileViewport) setSidebarOpen(false);

    switchTimeoutRef.current = setTimeout(async () => {
      try {
        const fresh = await communityService.fetchCommunityDetails(community.id);
        if (currentCommunityRef.current === fresh?.id) setSelectedCommunity(fresh);
      } catch {}
    }, 80);
  };

  const handleSelectChannel = async (channel) => {
    setSelectedChannel(channel);
    if (channel?.id) communityUnreadService.markRead(channel.id).catch(() => {});
    setView("chat"); // Move to chat when a channel is selected
    if (selectedCommunity?.id && channel?.id) saveLocation(selectedCommunity.id, { channelId: channel.id, view: "chat", lastVisited: Date.now() });
  };

  const handleCreateCommunity = async (communityData) => {
    const newCommunity = await communityService.createCommunity(communityData, userId);
    await loadCommunities();
    setPostCreateGuide({
      id: newCommunity?.id,
      name: newCommunity?.name || communityData.name,
      description: newCommunity?.description || communityData.description || "",
      icon: newCommunity?.icon || communityData.icon || "🌟",
      banner_gradient: newCommunity?.banner_gradient || communityData.bannerGradient || "linear-gradient(135deg,#667eea,#764ba2)",
    });
    handleSelectCommunity(newCommunity);
    setShowCreateCommunity(false);
  };

  useEffect(() => {
    const handleCommunityDeepLink = async (event) => {
      const communityId = event?.detail?.communityId;
      if (!communityId) return;
      const match = myCommunities.find((item) => item.id === communityId) || allCommunities.find((item) => item.id === communityId);
      if (match) {
        await handleSelectCommunity(match);
        return;
      }
      const fetched = await communityService.fetchCommunityDetails(communityId).catch(() => null);
      if (fetched) await handleSelectCommunity(fetched);
    };

    const handleInviteDeepLink = (event) => {
      const inviteCode = event?.detail?.inviteCode;
      if (inviteCode) setPendingInvite(inviteCode);
    };

    window.addEventListener("community:navigate", handleCommunityDeepLink);
    window.addEventListener("community:invite", handleInviteDeepLink);

    return () => {
      window.removeEventListener("community:navigate", handleCommunityDeepLink);
      window.removeEventListener("community:invite", handleInviteDeepLink);
    };
  }, [myCommunities, allCommunities, handleSelectCommunity]);

  const handleJoinCommunity = async (communityId) => {
    const community = allCommunities.find((item) => item.id === communityId);
    if (!community) return;
    if (myCommunities.some((item) => item.id === communityId)) {
      const joined = await communityService.fetchCommunityDetails(communityId).catch(() => null);
      if (joined) handleSelectCommunity(joined);
      return;
    }

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
      const alreadyJoined = /already\s+(a\s+)?member/i.test(error?.message || "");
      if (alreadyJoined) {
        const joined = await communityService.fetchCommunityDetails(communityId).catch(() => null);
        if (joined) handleSelectCommunity(joined);
        return;
      }

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
        const locations = readLocations();
        delete locations[communityId];
        localStorage.setItem(lastLocationKey, JSON.stringify({ locations }));
        setSelectedCommunity(null); setSelectedChannel(null);
        setView("discover"); currentCommunityRef.current = null;
      }
      await loadCommunities();
    } catch (error) {
      alert(error.message || "Failed to leave community");
    }
  };

  const handleDeleteCommunity = async (communityId) => {
    if (!communityId || selectedCommunity?.id !== communityId) {
      alert("The selected community is no longer available. Please reopen it and try again.");
      return;
    }

    try {
      await communityService.deleteCommunity(communityId, userId);
      setMyCommunities((current) => current.filter((item) => item.id !== communityId));
      setAllCommunities((current) => current.filter((item) => item.id !== communityId));
      communityCache.clearCommunity(communityId);
      setSelectedCommunity(null); setSelectedChannel(null);
      setView("discover"); currentCommunityRef.current = null;
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
    if (!isMobile || (view !== "chat" && view !== "channels")) return;
    const tx = e.touches[0].clientX;
    setTouchStart(tx); setTouchCurrent(tx);
    if (view === "chat" && (tx < 30 || sidebarOpen)) setIsSwiping(true);
  };
  const handleTouchMove = (e) => {
    if (!isSwiping || !isMobile) return;
    setTouchCurrent(e.touches[0].clientX);
  };
  const handleTouchEnd = () => {
    if (!isSwiping || !isMobile) return;
    const diff = touchCurrent - touchStart;
    if (view === "chat" && !sidebarOpen && diff > 70 && touchStart > 30) {
      setSelectedChannel(null);
      setView("channels");
    } else if (sidebarOpen && diff < -50) setSidebarOpen(false);
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
      ref={communityViewRef}
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
            onOpenPreviousChannel={handleSelectChannel}
            onLeave={() => openConfirm("Leave community?", "You can always rejoin later.", () => handleLeaveCommunity(selectedCommunity.id))}
            onUpdate={handleCommunityUpdate}
            onOpenInvite={() => { setInviteCommunity(selectedCommunity); setShowInviteModal(true); }}
            onDeleteCommunity={() => openConfirm("Delete this community?", "This permanently deletes the community and all of its data. This cannot be undone.", () => handleDeleteCommunity(selectedCommunity.id), true)}
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

      {postCreateGuide && (
        <div className="community-launch-guide-overlay" onClick={() => setPostCreateGuide(null)}>
          <div className="community-launch-guide" onClick={(e) => e.stopPropagation()}>
            <button className="community-launch-close" onClick={() => setPostCreateGuide(null)}>×</button>
            <div className="community-launch-banner" style={{ background: postCreateGuide.banner_gradient || "linear-gradient(135deg,#667eea,#764ba2)" }}>
              <div className="community-launch-icon">{postCreateGuide.icon?.startsWith("http") ? <img src={postCreateGuide.icon} alt="" /> : (postCreateGuide.icon || "🌟")}</div>
            </div>
            <div className="community-launch-content">
              <div className="community-launch-kicker">Community ready</div>
              <h3>{postCreateGuide.name}</h3>
              <p>{postCreateGuide.description || "Your community is live. Here is the fastest path to making it feel complete."}</p>
              <ul>
                <li>Drag channels to categories and re-order them to match your flow.</li>
                <li>Open roles and permissions to lock the Owner role and set member access.</li>
                <li>Invite people and create a verification or welcome channel to make the experience feel premium.</li>
              </ul>
              <div className="community-launch-docs">
                <div className="community-launch-doc"><strong>Settings</strong><span>Appearance, privacy, and ownership</span></div>
                <div className="community-launch-doc"><strong>Channels</strong><span>Organizer, categories, and defaults</span></div>
                <div className="community-launch-doc"><strong>Roles</strong><span>Owner protection and admin access</span></div>
              </div>
              <button className="community-launch-action" onClick={() => setPostCreateGuide(null)}>Start customizing</button>
            </div>
          </div>
        </div>
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

      <style>{`
        .community-launch-guide-overlay {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(2, 4, 7, 0.82);
          backdrop-filter: blur(10px);
          z-index: 12000;
          padding: 18px;
        }
        .community-launch-guide {
          position: relative;
          width: min(540px, calc(100vw - 32px));
          background: rgba(15, 17, 22, 0.98);
          border: 1.5px solid rgba(156,255,0,0.22);
          border-radius: 22px;
          overflow: hidden;
          box-shadow: 0 18px 54px rgba(0,0,0,0.6), 0 0 36px rgba(156,255,0,0.12);
        }
        .community-launch-close {
          position: absolute;
          top: 12px;
          right: 12px;
          z-index: 2;
          width: 32px;
          height: 32px;
          border: 0;
          border-radius: 50%;
          background: rgba(0,0,0,0.35);
          color: #fff;
          font-size: 22px;
          cursor: pointer;
        }
        .community-launch-banner {
          height: 120px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
        }
        .community-launch-icon {
          width: 72px;
          height: 72px;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0,0,0,0.24);
          border: 2px solid rgba(255,255,255,0.2);
          box-shadow: 0 8px 26px rgba(0,0,0,0.28);
          font-size: 34px;
          font-weight: 900;
        }
        .community-launch-icon img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 18px;
        }
        .community-launch-content {
          padding: 18px 18px 20px;
        }
        .community-launch-kicker {
          font-size: 10.5px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #9cff00;
          font-weight: 800;
          margin-bottom: 8px;
        }
        .community-launch-content h3 {
          margin: 0 0 8px;
          font-size: 24px;
          color: #fff;
        }
        .community-launch-content p {
          margin: 0 0 12px;
          color: #d3d3d3;
          line-height: 1.5;
          font-size: 13px;
        }
        .community-launch-content ul {
          margin: 0 0 14px;
          padding-left: 18px;
          color: #d7d7d7;
          font-size: 12.5px;
          line-height: 1.6;
        }
        .community-launch-docs {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 18px;
        }
        .community-launch-doc {
          background: rgba(26, 26, 26, 0.82);
          border: 1px solid rgba(156,255,0,0.18);
          border-radius: 12px;
          padding: 10px 8px;
        }
        .community-launch-doc strong {
          display: block;
          color: #fff;
          font-size: 12px;
          margin-bottom: 4px;
        }
        .community-launch-doc span {
          color: #a8a8a8;
          font-size: 11px;
          line-height: 1.4;
        }
        .community-launch-action {
          width: 100%;
          padding: 12px 16px;
          border: 0;
          border-radius: 12px;
          background: linear-gradient(135deg,#9cff00,#667eea);
          color: #07120f;
          font-weight: 900;
          cursor: pointer;
        }
        @media (max-width: 560px) {
          .community-launch-docs { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
};

export default CommunityView;