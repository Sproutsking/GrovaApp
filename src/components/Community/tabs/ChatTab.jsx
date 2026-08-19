// components/Community/tabs/ChatTab.jsx
// REVISION: instant-feel channel rail (cache-first + prefetch aware),
// permission-correct header (no hover-reveal, ever), and an elevated
// "next generation" visual pass on the channel sidebar.
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Menu, ChevronLeft, ChevronRight, Plus, Lock, Palette,
  ChevronDown, ArrowLeft, Settings2, Hash, Megaphone,
} from "lucide-react";
import MessageList from "../components/MessageList";
import ContextMenu from "../components/ContextMenu";
import ChannelContextMenu from "../components/ChannelContextMenu";
import CommunityMenu from "../components/CommunityMenu";
import CreateChannelModal from "../modals/CreateChannelModal";
import EditChannelModal from "../modals/EditChannelModal";
import ChannelPermissionsModal from "../modals/ChannelPermissionsModal";
import BackgroundDropdown from "../components/BackgroundDropdown";
import ChatBackground from "../components/ChatBackground";
import CommunityMessageInput from "../components/CommunityMessageInput";
import channelService from "../../../services/community/channelService";
import communityMessageService from "../../../services/community/communityMessageService";
import communityState from "../../../services/community/CommunityStateManager";
import backgroundService from "../../../services/community/CommunityBackgroundService";
import permissionService from "../../../services/community/permissionService";
import communityService from "../../../services/community/communityService";
import communityCache from "../../../services/community/communityCache";
import roleService from "../../../services/community/roleService";
import UserProfileModal from "../../Modals/UserProfileModal";
import CommunityProfileModal from "../components/CommunityProfileModal";
import ForwardMessageModal from "../components/ForwardMessageModal";

const CHANNEL_TYPE_ICON = {
  text: Hash,
  announcement: Megaphone,
};

const ChatTab = ({
  community,
  userId,
  currentUser,
  selectedChannel,
  setSelectedChannel,
  onLeaveCommunity,
  onCommunityUpdate,
  onOpenInvite,
  onDeleteCommunity,
  onBack,
  onToggleSidebar,
}) => {
  // Seed channels from the shared cache synchronously — if this community
  // was ever hovered/visited before, the rail paints on the very first
  // frame with zero blank state.
  const [channels, setChannels] = useState(() => communityCache.getChannels(community?.id) || []);
  const [channelsReady, setChannelsReady] = useState(() => !!communityCache.getChannels(community?.id));
  const [channelsRefreshing, setChannelsRefreshing] = useState(false);
  const [messages, setMessages] = useState(() =>
    selectedChannel ? [...(communityState.getMessages(selectedChannel.id) || [])] : []
  );
  const [messageInput, setMessageInput] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [sending, setSending] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [channelContextMenu, setChannelContextMenu] = useState(null);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showEditChannel, setShowEditChannel] = useState(false);
  const [showChannelPerms, setShowChannelPerms] = useState(false);
  const [permsChannel, setPermsChannel] = useState(null);
  const [editingChannel, setEditingChannel] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [userPermissions, setUserPermissions] = useState({});
  const [roles, setRoles] = useState([]);
  const [members, setMembers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [showBgDropdown, setShowBgDropdown] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [backgroundId, setBackgroundId] = useState("minimal");
  const [isMobile, setIsMobile] = useState(false);
  const [profileTarget, setProfileTarget] = useState(null);
  const [communityProfileTarget, setCommunityProfileTarget] = useState(null);
  const [forwardMessage, setForwardMessage] = useState(null);
  const [replyTo, setReplyTo] = useState(null);

  const backgroundTheme = backgroundService.getTheme(backgroundId);
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const unsubscribeChannel = useRef(null);
  const unsubscribeTyping = useRef(null);
  const typingTimeout = useRef(null);
  const isAtBottom = useRef(true);

  // ── Mobile detection ──────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Background ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (community) {
      const bg = backgroundService.getBackground(userId, community.id);
      setBackgroundId(bg);
    }
  }, [community?.id, userId]);

  useEffect(() => {
    const unsub = backgroundService.subscribe(() => {
      if (community) setBackgroundId(backgroundService.getBackground(userId, community.id));
    });
    return unsub;
  }, [community?.id, userId]);

  // ── Mark online on mount, offline on unmount ──────────────────────────────
  useEffect(() => {
    if (community && userId) {
      communityService.markOnline(community.id, userId, currentUser?.username || "");
    }
    return () => {
      if (community && userId) {
        communityService.markOffline(community.id, userId);
      }
    };
  }, [community?.id, userId]);

  const scrollToBottom = (behavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 60;
    isAtBottom.current = atBottom;
    setShowJump(!atBottom && messages.length >= 2);
  };

  // ── Load channels + permissions + roles ───────────────────────────────────
  useEffect(() => {
    if (community) {
      loadChannels();
      loadPermissions();
      loadRoles();
      loadMembers();
    }
  }, [community?.id]);

  const loadChannels = async () => {
    // 1) Instant paint from cache (if any) — no spinner, no blank rail.
    const cached = communityCache.getChannels(community.id);
    if (cached) {
      roleService.getVisibleChannels(community.id, userId, cached).then((visibleChannels) => {
        setChannels(visibleChannels);
        if (visibleChannels.length > 0 && !selectedChannel) setSelectedChannel(visibleChannels[0]);
      }).catch(() => setChannels([]));
      setChannelsReady(true);
    }
    // 2) Revalidate in the background. Only the very first, never-cached
    // load shows the skeleton state; every other visit is silent.
    setChannelsRefreshing(!!cached);
    try {
      const data = await channelService.fetchChannels(community.id);
      communityCache.setChannels(community.id, data);
      const visibleChannels = await roleService.getVisibleChannels(community.id, userId, data);
      setChannels(visibleChannels);
      setChannelsReady(true);
      if (visibleChannels.length > 0 && !selectedChannel) {
        setSelectedChannel(visibleChannels[0]);
      }
    } catch (error) {
      console.error("Error loading channels:", error);
      setChannelsReady(true);
    } finally {
      setChannelsRefreshing(false);
    }
  };

  const loadPermissions = async () => {
    try {
      const perms = await permissionService.getUserPermissions(community.id, userId);
      setUserPermissions(perms || {});
    } catch (error) {
      console.error("Error loading permissions:", error);
    }
  };

  const loadRoles = async () => {
    try {
      const data = await permissionService.fetchRoles(community.id);
      setRoles(data || []);
    } catch (error) {
      console.error("Error loading roles:", error);
    }
  };

  const loadMembers = async () => {
    try {
      const data = await roleService.fetchMembers(community.id);
      setMembers(data || []);
    } catch (error) {
      console.error("Error loading community members:", error);
    }
  };

  const handleCommunityMenuUpdate = async (payload) => {
    if (!payload) return;
    if (payload.type === "community") {
      await onCommunityUpdate(payload);
      return;
    }
    if (payload.type === "role") {
      await roleService.updateRole(payload.roleId, payload.updates);
      await loadRoles();
      await loadMembers();
      return;
    }
    if (payload.type === "createRole") {
      await roleService.createRole(payload.roleData, community.id);
      await loadRoles();
      return;
    }
    if (payload.type === "assignRole") {
      await roleService.updateMemberRole(payload.memberId, payload.roleId, userId);
      await loadMembers();
    }
  };

  // ── Messages + subscriptions ──────────────────────────────────────────────
  useEffect(() => {
    if (selectedChannel) {
      // Seed synchronously from whatever's already in the state manager for
      // this channel. This does two things: (a) if we've visited this
      // channel before in this session, its messages appear the instant
      // you click — no flash of empty; (b) it immediately clears the
      // previous channel's messages instead of leaving them on screen
      // until the async load resolves.
      setMessages([...(communityState.getMessages(selectedChannel.id) || [])]);
      communityState.setActive(selectedChannel.id);
      communityMessageService.init(userId);
      loadMessages();
      subscribeToChannel();
      subscribeToTyping();
    }
    return () => {
      stopTyping();
      if (unsubscribeChannel.current) unsubscribeChannel.current();
      if (unsubscribeTyping.current) unsubscribeTyping.current();
    };
  }, [selectedChannel?.id]);

  useEffect(() => {
    const unsub = communityState.subscribe(() => {
      const msgs = communityState.getMessages(selectedChannel?.id);
      const typing = communityState.getTyping(selectedChannel?.id);
      setMessages([...msgs]);
      setTypingUsers(typing);
    });
    return unsub;
  }, [selectedChannel?.id]);

  // ── Typing detection ──────────────────────────────────────────────────────
  useEffect(() => {
    if (messageInput.length > 0) {
      if (!isTyping) {
        setIsTyping(true);
        communityMessageService.sendTyping(
          selectedChannel?.id, true,
          currentUser?.username || currentUser?.full_name || ""
        );
      }
      clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(stopTyping, 3000);
    } else {
      if (isTyping) stopTyping();
    }
    return () => clearTimeout(typingTimeout.current);
  }, [messageInput, selectedChannel?.id]);

  const loadMessages = async () => {
    if (!selectedChannel?.id) return;
    try {
      await communityMessageService.loadMessages(selectedChannel.id);
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  const subscribeToChannel = () => {
    if (unsubscribeChannel.current) unsubscribeChannel.current();
    unsubscribeChannel.current = communityMessageService.subscribeToChannel(
      selectedChannel.id,
      () => { if (isAtBottom.current) setTimeout(scrollToBottom, 10); }
    );
  };

  const subscribeToTyping = () => {
    if (unsubscribeTyping.current) unsubscribeTyping.current();
    unsubscribeTyping.current = communityMessageService.subscribeToTyping(
      selectedChannel.id,
      (typing) => { if (typing.length > 0 && isAtBottom.current) setTimeout(scrollToBottom, 100); }
    );
  };

  const stopTyping = () => {
    if (isTyping) {
      setIsTyping(false);
      communityMessageService.sendTyping(selectedChannel?.id, false);
    }
    clearTimeout(typingTimeout.current);
  };

  const handleSendMessage = async () => {
    const content = messageInput.trim();
    if (!content || sending || !selectedChannel?.id) return;

    if (editingMessage) {
      try {
        setSending(true);
        await communityMessageService.editMessage(editingMessage.id, userId, content);
        setEditingMessage(null);
        setMessageInput("");
        await loadMessages();
      } catch (error) {
        console.error("Error editing message:", error);
      } finally {
        setSending(false);
      }
      return;
    }
    if (payload.type === "reorderRoles") {
      await Promise.all(payload.roles.map((role, index) => roleService.updateRole(role.id, { position: index })));
      await loadRoles();
    }

    setMessageInput("");
    stopTyping();

    try {
      let avatarId = currentUser?.avatar_id;
      if (!avatarId && currentUser?.avatar?.includes("/")) {
        const parts = currentUser.avatar.split("/");
        avatarId = parts[parts.length - 1].split("?")[0];
      }
      await communityMessageService.sendMessage(
        selectedChannel.id, userId, content,
        {
          user: {
            id: userId,
            username: currentUser?.username,
            full_name: currentUser?.full_name || currentUser?.fullName,
            avatar_id: avatarId,
            avatar_metadata: currentUser?.avatar_metadata,
            verified: currentUser?.verified || false,
          },
          reply_to_id: replyTo?.id || null,
        }
      );
      setReplyTo(null);
      setTimeout(scrollToBottom, 10);
    } catch (error) {
      console.error("Error sending message:", error);
      setMessageInput(content);
      alert("Failed to send message. Please try again.");
    }
  };

  const handleBackgroundChange = (bgId) => {
    backgroundService.setBackground(userId, community.id, bgId);
  };

  // ── Derived state ─────────────────────────────────────────────────────────
  const currentChannelIndex = channels.findIndex((ch) => ch.id === selectedChannel?.id);
  const isOwner = community?.owner_id === userId;
  const canManageChannels = userPermissions.manageChannels || isOwner;
  const canManageRoles = userPermissions.manageRoles || isOwner;
  const canSendMessages = userPermissions.sendMessages || isOwner;

  // ── Channel icon renderer ─────────────────────────────────────────────────
  const renderChannelIcon = (channel) => {
    const icon = channel.icon;
    if (!icon) return <Hash size={14} />;
    if (icon.startsWith("http")) return <img src={icon} alt="" className="ch-icon-img" />;
    if (icon.length <= 2) return <span className="ch-emoji">{icon}</span>;
    const Icon = CHANNEL_TYPE_ICON[channel.type] || Hash;
    return <Icon size={14} />;
  };

  const showSkeleton = !channelsReady && channels.length === 0;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="chat-tab" onClick={() => { setContextMenu(null); setChannelContextMenu(null); }}>
      <ChatBackground key={backgroundId} theme={backgroundTheme.id} />

      {/* ── Channels container ── */}
      <div className="channels-container">
        {/* Sidebar header. No permission → single centered Menu button.
            Has "manage channels" → Plus sits left, Menu sits right.
            Both states are pure conditional rendering; nothing here ever
            depends on :hover to appear. */}
        <div className={`channels-header${canManageChannels ? " has-manage" : " no-manage"}`}>
          {canManageChannels && (
            <button
              className="channels-plus-btn"
              onClick={() => setShowCreateChannel(true)}
              title="Create channel"
              aria-label="Create channel"
            >
              <Plus size={16} />
            </button>
          )}
          <button
            className="channels-menu-btn"
            onClick={() => setShowMenu(true)}
            title="Community menu"
            aria-label="Community menu"
          >
            <Menu size={16} />
            <span className="menu-label">Menu</span>
          </button>
        </div>

        {/* Channels list below header */}
        <div className="channels-list">
          <div className="channels-eyebrow">
            <span>Channels</span>
            {channelsRefreshing && <span className="channels-refresh-dot" aria-hidden="true" />}
          </div>

          {showSkeleton ? (
            <div className="channels-skeleton" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="skel-item" style={{ animationDelay: `${i * 70}ms` }} />
              ))}
            </div>
          ) : (
            channels.map((channel) => (
              <div
                key={channel.id}
                className={`channel-item${selectedChannel?.id === channel.id ? " active" : ""}`}
                onClick={() => setSelectedChannel(channel)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (canManageChannels || canManageRoles) {
                    setChannelContextMenu({ x: e.clientX, y: e.clientY, channel });
                  }
                }}
                title={channel.name}
              >
                <span className="channel-item-icon">{renderChannelIcon(channel)}</span>
                <span className="channel-item-name">{channel.name}</span>
                {channel.is_private && <Lock size={12} className="channel-item-lock" />}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="chat-main">
        {isMobile && (
          <div className="mobile-chat-header">
            <button className="mobile-back-btn" onClick={onBack || (() => setSelectedChannel(null))} aria-label="Back">
              <ArrowLeft size={18} />
            </button>
            <div className="mobile-chat-title">#{selectedChannel?.name || "channel"}</div>
            <button className="mobile-menu-btn" onClick={() => setShowMenu(true)} aria-label="Open menu">
              <Menu size={18} />
            </button>
          </div>
        )}

        {/* ── Messages ── */}
        <div className="chat-msgs" ref={containerRef} onScroll={handleScroll}>
          <MessageList
            messages={messages}
            pendingMessages={[]}
            loading={false}
            userId={userId}
            currentUser={currentUser}
            messagesEndRef={messagesEndRef}
            onContextMenu={(e, msg) => {
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY, message: msg });
            }}
            onProfileClick={(user) => user?.id && setCommunityProfileTarget(user)}
            onReply={(message) => { setReplyTo(message); setContextMenu(null); }}
            onReactionClick={async (msgId, emoji) => {
              try {
                const msg = messages.find((m) => m.id === msgId);
                const hasReacted = msg?.reactions?.[emoji]?.users?.includes(userId);
                if (hasReacted) {
                  await communityMessageService.removeReaction(msgId, userId, emoji);
                } else {
                  await communityMessageService.addReaction(msgId, userId, emoji);
                }
                await loadMessages();
              } catch (error) {
                console.error("Error toggling reaction:", error);
              }
            }}
          />
          {showJump && (
            <button className="jump-btn" onClick={() => scrollToBottom()}>
              <ChevronDown size={18} />
            </button>
          )}
        </div>

        {/* ── Input area ── */}
        <div className="chat-input-area">
          <BackgroundDropdown
            currentTheme={backgroundId}
            onThemeChange={handleBackgroundChange}
            show={showBgDropdown}
            onClose={() => setShowBgDropdown(false)}
          />
          <CommunityMessageInput
            value={messageInput}
            onChange={setMessageInput}
            onSend={handleSendMessage}
            disabled={sending || !canSendMessages}
            placeholder={`Message #${selectedChannel?.name || "channel"}`}
            editingMessage={editingMessage}
            onCancelEdit={() => { setEditingMessage(null); setMessageInput(""); }}
            typingUsers={typingUsers}
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
          />
        </div>
      </div>

      {/* ── Community menu ── */}
      <CommunityMenu
        show={showMenu}
        onClose={() => setShowMenu(false)}
        community={community}
        userId={userId}
        onLeave={onLeaveCommunity}
        onUpdate={handleCommunityMenuUpdate}
        onCreateChannel={() => setShowCreateChannel(true)}
        onOpenInvite={onOpenInvite}
        onDeleteCommunity={() => { setShowMenu(false); onDeleteCommunity(); }}
        onOpenBackgroundSwitcher={() => { setShowMenu(false); setShowBgDropdown(true); }}
        roles={roles}
        members={members}
      />

      {/* ── Message context menu ── */}
      {contextMenu && (
        <ContextMenu
          position={contextMenu}
          message={contextMenu.message}
          userId={userId}
          permissions={userPermissions}
          isOwner={isOwner}
          onClose={() => setContextMenu(null)}
          onEdit={() => {
            setEditingMessage(contextMenu.message);
            setMessageInput(contextMenu.message.content);
            setContextMenu(null);
          }}
          onDelete={async () => {
            if (!window.confirm("Delete this message?")) { setContextMenu(null); return; }
            try {
              await communityMessageService.deleteMessage(contextMenu.message.id, userId, community.id);
              await loadMessages();
            } catch (error) {
              console.error("Error deleting message:", error);
            }
            setContextMenu(null);
          }}
          onReaction={async (emoji) => {
            try {
              const msg = contextMenu.message;
              const hasReacted = msg?.reactions?.[emoji]?.users?.includes(userId);
              if (hasReacted) {
                await communityMessageService.removeReaction(msg.id, userId, emoji);
              } else {
                await communityMessageService.addReaction(msg.id, userId, emoji);
              }
              await loadMessages();
            } catch (error) {
              console.error("Error toggling reaction:", error);
            }
            setContextMenu(null);
          }}
          onReply={() => {
            setReplyTo(contextMenu.message);
            setContextMenu(null);
          }}
          onCopy={() => { navigator.clipboard.writeText(contextMenu.message.content); setContextMenu(null); }}
          onForward={() => { setForwardMessage(contextMenu.message); setContextMenu(null); }}
          onReport={() => { alert("Message reported to community moderators."); setContextMenu(null); }}
        />
      )}

      {profileTarget && (
        <UserProfileModal
          user={profileTarget}
          currentUser={currentUser}
          onClose={() => setProfileTarget(null)}
        />
      )}

      {forwardMessage && (
        <ForwardMessageModal
          message={forwardMessage}
          userId={userId}
          onOpenDm={(recipientId) => window.dispatchEvent(new CustomEvent("community:open-dm", { detail: { userId: recipientId } }))}
          onClose={() => setForwardMessage(null)}
        />
      )}

      {communityProfileTarget && (
        <CommunityProfileModal
          user={communityProfileTarget}
          community={community}
          member={members.find((item) => item.user_id === communityProfileTarget.id)}
          roles={roles}
          canManageRoles={canManageRoles}
          currentUserId={userId}
          onAssignRole={async (memberId, roleId) => {
            await roleService.updateMemberRole(memberId, roleId);
            await loadMembers();
          }}
          onOpenProfile={(user) => { setProfileTarget(user); setCommunityProfileTarget(null); }}
          onOpenDm={(user) => {
            window.dispatchEvent(new CustomEvent("community:open-dm", { detail: { userId: user.id } }));
            setCommunityProfileTarget(null);
          }}
          onClose={() => setCommunityProfileTarget(null)}
        />
      )}

      {/* ── Channel context menu (with Permissions option) ── */}
      {channelContextMenu && (
        <ChannelContextMenu
          position={channelContextMenu}
          channel={channelContextMenu.channel}
          isOwner={isOwner}
          hasManagePermission={canManageChannels}
          isAdministrator={userPermissions.administrator || isOwner}
          onClose={() => setChannelContextMenu(null)}
          onEdit={() => {
            setEditingChannel(channelContextMenu.channel);
            setShowEditChannel(true);
            setChannelContextMenu(null);
          }}
          onPermissions={() => {
            setPermsChannel(channelContextMenu.channel);
            setShowChannelPerms(true);
            setChannelContextMenu(null);
          }}
          onDelete={async () => {
            if (!window.confirm(`Delete #${channelContextMenu.channel.name}? Cannot be undone.`)) return;
            try {
              await channelService.deleteChannel(channelContextMenu.channel.id);
              communityCache.clearCommunity(community.id);
              await loadChannels();
              setChannelContextMenu(null);
              if (selectedChannel?.id === channelContextMenu.channel.id) {
                const remaining = channels.filter((ch) => ch.id !== channelContextMenu.channel.id);
                if (remaining.length > 0) setSelectedChannel(remaining[0]);
              }
            } catch (error) {
              console.error("Error deleting channel:", error);
              alert("Failed to delete channel");
            }
          }}
          onTogglePrivacy={async () => {
            try {
              await channelService.updateChannel(channelContextMenu.channel.id, {
                is_private: !channelContextMenu.channel.is_private,
              });
              communityCache.clearCommunity(community.id);
              await loadChannels();
              setChannelContextMenu(null);
            } catch (error) {
              console.error("Error updating channel:", error);
            }
          }}
        />
      )}

      {/* ── Modals ── */}
      {showCreateChannel && (
        <CreateChannelModal
          onClose={() => setShowCreateChannel(false)}
          onCreate={async (channelData) => {
            try {
              await channelService.createChannel(channelData, community.id);
              communityCache.clearCommunity(community.id);
              await loadChannels();
              setShowCreateChannel(false);
            } catch (error) {
              throw error;
            }
          }}
          communityId={community.id}
        />
      )}

      {showEditChannel && editingChannel && (
        <EditChannelModal
          channel={editingChannel}
          onClose={() => { setShowEditChannel(false); setEditingChannel(null); }}
          onUpdate={async (channelData) => {
            try {
              await channelService.updateChannel(editingChannel.id, channelData);
              communityCache.clearCommunity(community.id);
              await loadChannels();
              setShowEditChannel(false);
              setEditingChannel(null);
            } catch (error) {
              throw error;
            }
          }}
        />
      )}

      {showChannelPerms && permsChannel && (
        <ChannelPermissionsModal
          channel={permsChannel}
          communityId={community.id}
          roles={roles}
          onClose={() => { setShowChannelPerms(false); setPermsChannel(null); }}
          onSave={loadChannels}
        />
      )}

      <style>{`
        .chat-tab {
          display: flex;
          flex-direction: row;
          height: 100%;
          width: 100%;
          position: relative;
          background: var(--bg);
          color: var(--text);
          overflow: hidden;
        }

        .chat-main {
          flex: 1;
          min-width: 0;
          height: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .mobile-chat-header {
          display: none;
        }

        /* ── Channel rail: the whole "channel section" gets a proper
           premium treatment — layered background, crisp border-right,
           and a header that always has a bottom border. ── */
        .channels-container {
          width: 212px;
          min-width: 212px;
          max-width: 212px;
          height: 100%;
          position: relative;
          background:
            radial-gradient(120% 60% at 0% 0%, rgba(156,255,0,0.07), transparent 55%),
            radial-gradient(140% 70% at 100% 100%, rgba(102,126,234,0.08), transparent 55%),
            linear-gradient(180deg, rgba(15,17,22,0.99) 0%, rgba(9,10,14,0.98) 55%, rgba(7,8,11,0.99) 100%);
          border-right: 1.5px solid rgba(156,255,0,0.14);
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
          overflow: hidden;
          box-shadow:
            inset -1px 0 0 rgba(255,255,255,0.025),
            8px 0 24px -18px rgba(0,0,0,0.6);
        }

        .channels-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 14px 12px 12px;
          border-bottom: 1.5px solid rgba(156,255,0,0.14);
          background: linear-gradient(180deg, rgba(156,255,0,0.045) 0%, rgba(10,12,16,0) 100%);
          flex-shrink: 0;
        }
        .channels-header.has-manage { justify-content: space-between; }
        .channels-header.no-manage  { justify-content: center; }

        .channels-plus-btn {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          border: 1px solid rgba(156,255,0,0.16);
          background: rgba(156,255,0,0.07);
          color: var(--accent);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease;
        }
        .channels-plus-btn:hover {
          background: rgba(156,255,0,0.14);
          border-color: rgba(156,255,0,0.3);
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(156,255,0,0.14);
        }
        .channels-plus-btn:active { transform: translateY(0) scale(0.96); }

        .channels-menu-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0 12px;
          height: 34px;
          border-radius: 10px;
          border: 1px solid rgba(156,255,0,0.16);
          background: rgba(156,255,0,0.07);
          color: var(--accent);
          font-size: 10px;
          font-weight: 800;
          cursor: pointer;
          transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .channels-header.has-manage .channels-menu-btn { flex-shrink: 0; }
        .channels-menu-btn:hover {
          background: rgba(156,255,0,0.14);
          border-color: rgba(156,255,0,0.3);
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(156,255,0,0.14);
        }
        .channels-menu-btn:active { transform: translateY(0) scale(0.97); }

        .channels-list {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 12px 8px 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .channels-list::-webkit-scrollbar { width: 4px; }
        .channels-list::-webkit-scrollbar-track { background: transparent; }
        .channels-list::-webkit-scrollbar-thumb {
          background: rgba(156,255,0,0.22);
          border-radius: 2px;
        }

        .channels-eyebrow {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 2px 8px 10px;
          font-size: 10px;
          font-weight: 800;
          color: rgba(255,255,255,0.32);
          text-transform: uppercase;
          letter-spacing: 0.8px;
        }
        .channels-refresh-dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: var(--accent);
          box-shadow: 0 0 8px var(--accent);
          animation: chRefreshPulse 1.1s ease-in-out infinite;
        }
        @keyframes chRefreshPulse { 0%,100%{opacity:.35} 50%{opacity:1} }

        /* Skeleton — shown only on a truly first, never-cached load, so the
           rail still communicates "content is arriving" instead of a dead
           blank panel while never blocking anything already known. */
        .channels-skeleton { display: flex; flex-direction: column; gap: 8px; padding: 2px 4px; }
        .skel-item {
          height: 40px;
          border-radius: 11px;
          background: linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.03) 100%);
          background-size: 200% 100%;
          animation: skelShimmer 1.3s ease-in-out infinite;
        }
        @keyframes skelShimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

        .channel-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          min-height: 42px;
          padding: 0 11px;
          border-radius: 11px;
          border: 1px solid rgba(255,255,255,0.055);
          background: rgba(255,255,255,0.018);
          color: rgba(255,255,255,0.72);
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
          position: relative;
        }

        .channel-item:hover {
          background: rgba(156,255,0,0.065);
          border-color: rgba(156,255,0,0.22);
          transform: translateX(2px);
          color: rgba(255,255,255,0.92);
        }

        .channel-item.active {
          background: linear-gradient(135deg, rgba(156,255,0,0.14), rgba(102,126,234,0.06));
          border-color: rgba(156,255,0,0.3);
          color: var(--accent);
          box-shadow: inset 0 0 0 1px rgba(156,255,0,0.08), 0 4px 16px -6px rgba(156,255,0,0.25);
        }

        .channel-item.active::before {
          content: "";
          position: absolute;
          left: -8px;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 18px;
          border-radius: 999px;
          background: linear-gradient(180deg, rgba(156,255,0,1), rgba(156,255,0,0.2));
          box-shadow: 0 0 10px rgba(156,255,0,0.6);
        }

        .channel-item-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          flex-shrink: 0;
          opacity: 0.85;
        }

        .ch-icon-img { width: 16px; height: 16px; border-radius: 4px; object-fit: cover; }

        .channel-item-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .channel-item-lock {
          margin-left: auto;
          opacity: 0.5;
          flex-shrink: 0;
        }

        .chat-msgs {
          flex: 1;
          min-width: 0;
          overflow-y: auto;
          overflow-x: hidden;
          position: relative;
        }

        .chat-msgs::-webkit-scrollbar { width: 5px; }
        .chat-msgs::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
        .chat-msgs::-webkit-scrollbar-thumb { background: rgba(156,255,0,0.25); border-radius: 3px; }

        .chat-input-area {
          position: relative;
          flex-shrink: 0;
        }

        .jump-btn {
          position: fixed;
          bottom: 80px;
          right: 18px;
          z-index: 5;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: var(--panel-strong);
          border: 1.5px solid var(--accent-border-strong);
          color: var(--accent);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 6px 16px rgba(0,0,0,0.4);
          transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .jump-btn:hover {
          transform: scale(1.1) translateY(-2px);
          box-shadow: 0 8px 24px var(--accent-shadow);
        }

        @media (max-width: 768px) {
          .chat-tab {
            flex-direction: column;
            height: 100%;
          }

          .chat-main {
            width: 100%;
            height: 100%;
            flex: 1;
          }

          .mobile-chat-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            height: 52px;
            padding: 0 12px;
            border-bottom: 1px solid rgba(156,255,0,0.12);
            background: rgba(10, 12, 16, 0.96);
            z-index: 11;
            flex-shrink: 0;
          }

          .mobile-back-btn,
          .mobile-menu-btn {
            width: 36px;
            height: 36px;
            border-radius: 10px;
            border: 1px solid rgba(156,255,0,0.14);
            background: rgba(156,255,0,0.06);
            color: var(--accent);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            flex-shrink: 0;
            transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
          }

          .mobile-back-btn:hover,
          .mobile-menu-btn:hover {
            background: rgba(156,255,0,0.12);
            border-color: rgba(156,255,0,0.2);
            transform: translateY(-1px);
          }

          .mobile-chat-title {
            flex: 1;
            text-align: center;
            font-size: 13px;
            font-weight: 800;
            color: var(--text);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            letter-spacing: 0.3px;
          }

          .channels-container {
            display: none;
          }

          .jump-btn {
            bottom: 72px;
            right: 12px;
            width: 36px;
            height: 36px;
          }
        }
      `}</style>
    </div>
  );
};

export default ChatTab;