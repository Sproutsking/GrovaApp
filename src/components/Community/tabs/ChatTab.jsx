// components/Community/tabs/ChatTab.jsx
// FULL REWRITE: No entry loader, channel permissions, reactions, image icons,
// accurate online tracking, permission-aware channels, elegant UI
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
  const [channels, setChannels] = useState([]);
  const [messages, setMessages] = useState([]);
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
  const [typingUsers, setTypingUsers] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [showBgDropdown, setShowBgDropdown] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [backgroundId, setBackgroundId] = useState("minimal");
  const [isMobile, setIsMobile] = useState(false);

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
    }
  }, [community?.id]);

  const loadChannels = async () => {
    try {
      const data = await channelService.fetchChannels(community.id);
      setChannels(data);
      if (data.length > 0 && !selectedChannel) {
        setSelectedChannel(data[0]);
      }
    } catch (error) {
      console.error("Error loading channels:", error);
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

  // ── Messages + subscriptions ──────────────────────────────────────────────
  useEffect(() => {
    if (selectedChannel) {
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
        }
      );
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

  // ── Channel icon renderer ─────────────────────────────────────────────────
  const renderChannelIcon = (channel) => {
    const icon = channel.icon;
    if (!icon) return <Hash size={14} />;
    if (icon.startsWith("http")) return <img src={icon} alt="" className="ch-icon-img" />;
    if (icon.length <= 2) return <span className="ch-emoji">{icon}</span>;
    const Icon = CHANNEL_TYPE_ICON[channel.type] || Hash;
    return <Icon size={14} />;
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="chat-tab" onClick={() => { setContextMenu(null); setChannelContextMenu(null); }}>
      <ChatBackground key={backgroundId} theme={backgroundTheme.id} />

      {/* ── Channels bar ── */}
      <div className="channels-bar">
        {isMobile && onBack && (
          <button className="bar-btn back-btn" onClick={onBack} title="Back">
            <ArrowLeft size={18} />
          </button>
        )}

        <button className="bar-btn menu-btn" onClick={() => setShowMenu(true)} title="Community menu">
          <Menu size={17} />
        </button>

        <div className="channels-scroll">
          {channels.map((channel) => (
            <div
              key={channel.id}
              className={`ch-pill${selectedChannel?.id === channel.id ? " active" : ""}`}
              onClick={() => setSelectedChannel(channel)}
              onContextMenu={(e) => {
                e.preventDefault();
                if (canManageChannels || canManageRoles) {
                  setChannelContextMenu({ x: e.clientX, y: e.clientY, channel });
                }
              }}
            >
              <span className="ch-pill-icon">{renderChannelIcon(channel)}</span>
              <span className="ch-pill-name">{channel.name}</span>
              {channel.is_private && <Lock size={10} className="ch-lock" />}
            </div>
          ))}
        </div>

        <div className="bar-actions">
          <button
            className="bar-btn"
            onClick={() => { if (currentChannelIndex > 0) setSelectedChannel(channels[currentChannelIndex - 1]); }}
            disabled={currentChannelIndex <= 0}
          ><ChevronLeft size={15} /></button>
          <button
            className="bar-btn"
            onClick={() => { if (currentChannelIndex < channels.length - 1) setSelectedChannel(channels[currentChannelIndex + 1]); }}
            disabled={currentChannelIndex >= channels.length - 1}
          ><ChevronRight size={15} /></button>
          {canManageChannels && (
            <button className="bar-btn" onClick={() => setShowCreateChannel(true)} title="Create channel">
              <Plus size={15} />
            </button>
          )}
          <button className="bar-btn" onClick={() => setShowBgDropdown(!showBgDropdown)} title="Change background">
            <Palette size={15} />
          </button>
        </div>
      </div>

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
          disabled={sending}
          placeholder={`Message #${selectedChannel?.name || "channel"}`}
          editingMessage={editingMessage}
          onCancelEdit={() => { setEditingMessage(null); setMessageInput(""); }}
          typingUsers={typingUsers}
        />
      </div>

      {/* ── Community menu ── */}
      <CommunityMenu
        show={showMenu}
        onClose={() => setShowMenu(false)}
        community={community}
        userId={userId}
        onLeave={onLeaveCommunity}
        onUpdate={onCommunityUpdate}
        onCreateChannel={() => setShowCreateChannel(true)}
        onOpenInvite={onOpenInvite}
        onDeleteCommunity={() => { setShowMenu(false); onDeleteCommunity(); }}
        onOpenBackgroundSwitcher={() => { setShowMenu(false); setShowBgDropdown(true); }}
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
          onCopy={() => { navigator.clipboard.writeText(contextMenu.message.content); setContextMenu(null); }}
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
          display: flex; flex-direction: column;
          height: 100vh; position: relative; background: #000;
        }

        /* ── Channels bar ── */
        .channels-bar {
          display: flex; align-items: center; gap: 6px;
          padding: 7px 10px;
          background: rgba(0,0,0,0.96);
          border-bottom: 1px solid rgba(156,255,0,0.1);
          z-index: 10; flex-shrink:0;
        }

        .bar-btn {
          width: 32px; height: 32px; border-radius: 8px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          color: #666; cursor: pointer; flex-shrink:0;
          display:flex; align-items:center; justify-content:center;
          transition: all .18s;
        }
        .bar-btn:hover:not(:disabled) {
          background: rgba(156,255,0,0.1);
          border-color: rgba(156,255,0,0.25); color: #9cff00;
        }
        .bar-btn:disabled { opacity:.28; cursor:not-allowed; }
        .back-btn { color: #9cff00; }
        .menu-btn { color: #9cff00; }

        .channels-scroll {
          flex:1; display:flex; gap:5px;
          overflow-x:auto; padding:1px 0;
        }
        .channels-scroll::-webkit-scrollbar { height:3px; }
        .channels-scroll::-webkit-scrollbar-thumb { background:rgba(156,255,0,.25); border-radius:2px; }

        /* Channel pills */
        .ch-pill {
          display:flex; align-items:center; gap:5px;
          padding:6px 10px; border-radius:7px;
          background:rgba(20,20,20,.8);
          border:1px solid rgba(36,36,36,.9);
          color:#888; font-size:12px; font-weight:700;
          cursor:pointer; white-space:nowrap; flex-shrink:0;
          transition:all .18s;
        }
        .ch-pill:hover { background:rgba(30,30,30,.95); border-color:rgba(156,255,0,.2); color:#ccc; }
        .ch-pill.active {
          background:rgba(156,255,0,.12);
          border-color:rgba(156,255,0,.4); color:#9cff00;
        }
        .ch-pill-icon {
          display:flex; align-items:center; justify-content:center;
          width:16px; flex-shrink:0;
        }
        .ch-icon-img { width:14px; height:14px; object-fit:cover; border-radius:3px; }
        .ch-emoji { font-size:13px; line-height:1; }
        .ch-lock { opacity:.5; flex-shrink:0; }

        .bar-actions { display:flex; gap:3px; flex-shrink:0; }

        /* Messages */
        .chat-msgs {
          flex:1; overflow-y:auto; overflow-x:hidden; position:relative;
        }
        .chat-msgs::-webkit-scrollbar { width:5px; }
        .chat-msgs::-webkit-scrollbar-track { background:rgba(20,20,20,.2); }
        .chat-msgs::-webkit-scrollbar-thumb { background:rgba(156,255,0,.25); border-radius:3px; }

        /* Input area */
        .chat-input-area { position:relative; flex-shrink:0; }

        /* Jump button */
        .jump-btn {
          position:fixed; bottom:80px; right:18px; z-index:5;
          width:36px; height:36px; border-radius:50%;
          background:rgba(10,10,10,.95);
          border:1.5px solid rgba(156,255,0,.45);
          color:#9cff00; cursor:pointer;
          display:flex; align-items:center; justify-content:center;
          box-shadow:0 4px 12px rgba(0,0,0,.5); transition:all .2s;
        }
        .jump-btn:hover { transform:scale(1.08); box-shadow:0 6px 16px rgba(156,255,0,.3); }

        @media(max-width:768px){
          .channels-bar { padding:5px 8px; gap:5px; }
          .bar-btn { width:28px; height:28px; }
          .ch-pill { padding:5px 8px; font-size:11px; }
          .jump-btn { bottom:72px; right:12px; }
        }
      `}</style>
    </div>
  );
};

export default ChatTab;