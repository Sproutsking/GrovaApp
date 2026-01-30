import React, { useState, useEffect, useRef } from "react";
import {
  Menu,
  ChevronLeft,
  ChevronRight,
  Send,
  Smile,
  Image,
  Plus,
  Lock,
  Edit3,
  MoreVertical,
  Palette,
} from "lucide-react";
import MessageList from "../components/MessageList";
import EmojiPanel from "../components/EmojiPanel";
import ContextMenu from "../components/ContextMenu";
import ChannelContextMenu from "../components/ChannelContextMenu";
import CommunityMenu from "../components/CommunityMenu";
import CreateChannelModal from "../modals/CreateChannelModal";
import EditChannelModal from "../modals/EditChannelModal";
import BackgroundSwitcher from "../components/BackgroundSwitcher";
import ChatBackground from "../components/ChatBackground";
import channelService from "../../../services/community/channelService";
import messageService from "../../../services/community/messageService";
import permissionService from "../../../services/community/permissionService";

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
}) => {
  const [channels, setChannels] = useState([]);
  const [channelMessages, setChannelMessages] = useState({});
  const [pendingMessages, setPendingMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [sending, setSending] = useState(false);
  const [inputExpanded, setInputExpanded] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [channelContextMenu, setChannelContextMenu] = useState(null);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showEditChannel, setShowEditChannel] = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [userPermissions, setUserPermissions] = useState({});
  const [typingUsers, setTypingUsers] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [backgroundTheme, setBackgroundTheme] = useState("elegant");
  const [showBackgroundSwitcher, setShowBackgroundSwitcher] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const unsubscribeRefs = useRef({});
  const typingTimeoutRef = useRef(null);
  const typingSubscriptionRef = useRef(null);
  const messageIdCounter = useRef(0);
  const messageCache = useRef({});
  const currentChannelRef = useRef(null);

  // Load personal background preference (user + community specific)
  useEffect(() => {
    if (userId && community?.id) {
      const saved = localStorage.getItem(`bg-theme-${userId}-${community.id}`);
      if (saved) {
        setBackgroundTheme(saved);
      }
    }
  }, [userId, community?.id]);

  useEffect(() => {
    if (community) {
      loadChannels();
      loadPermissions();
    }
    return () => {
      // Cleanup on unmount
      Object.values(unsubscribeRefs.current).forEach((unsub) => {
        if (unsub) unsub();
      });
      if (typingSubscriptionRef.current) {
        typingSubscriptionRef.current();
      }
      messageCache.current = {};
      currentChannelRef.current = null;
    };
  }, [community?.id]);

  useEffect(() => {
    if (selectedChannel) {
      // INSTANT CLEAR - Clear old channel data immediately
      if (currentChannelRef.current !== selectedChannel.id) {
        setPendingMessages([]);
        setTypingUsers([]);
        currentChannelRef.current = selectedChannel.id;
      }

      // ALWAYS RELOAD - Don't trust cache for user data
      loadMessages(selectedChannel.id);
      subscribeToMessages(selectedChannel.id);
      subscribeToTyping(selectedChannel.id);
    }
    return () => {
      stopTyping();
    };
  }, [selectedChannel?.id]);

  const handleBackgroundChange = (theme) => {
    setBackgroundTheme(theme);
    // Personal preference: user + community specific
    localStorage.setItem(`bg-theme-${userId}-${community.id}`, theme);
  };

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
      const role = await permissionService.getUserRole(community.id, userId);
      setUserPermissions(role?.permissions || {});
    } catch (error) {
      console.error("Error loading permissions:", error);
    }
  };

  const loadMessages = async (channelId) => {
    try {
      console.log(`📥 Loading messages for channel ${channelId}`);
      const data = await messageService.fetchMessages(channelId);
      
      console.log(`✅ Loaded ${data.length} messages with complete user data`);
      
      // CRITICAL: Only update state, DO NOT cache messages with user data
      // Caching causes stale user data on refresh
      setChannelMessages((prev) => ({
        ...prev,
        [channelId]: data,
      }));
    } catch (error) {
      console.error("❌ Error loading messages:", error);
      setChannelMessages((prev) => ({
        ...prev,
        [channelId]: [],
      }));
    }
  };

  const subscribeToMessages = (channelId) => {
    if (unsubscribeRefs.current[channelId]) {
      unsubscribeRefs.current[channelId]();
    }

    unsubscribeRefs.current[channelId] = messageService.subscribeToMessages(
      channelId,
      (newMessage) => {
        console.log('📨 New message received:', newMessage);
        
        // Only update if still on this channel
        if (currentChannelRef.current === channelId) {
          setChannelMessages((prev) => {
            const channelMsgs = prev[channelId] || [];
            
            // Check if message already exists
            if (channelMsgs.some((m) => m.id === newMessage.id)) {
              return prev;
            }
            
            // Add new message with complete user data
            const updated = [...channelMsgs, newMessage];
            
            return {
              ...prev,
              [channelId]: updated,
            };
          });

          // Remove from pending if it was pending
          setPendingMessages((prev) =>
            prev.filter((pm) => pm.tempId !== newMessage.tempId)
          );
        }
      }
    );
  };

  const subscribeToTyping = (channelId) => {
    if (typingSubscriptionRef.current) {
      typingSubscriptionRef.current();
    }

    typingSubscriptionRef.current = messageService.subscribeToTyping?.(
      channelId,
      (typingData) => {
        // Only update if still on this channel
        if (currentChannelRef.current === channelId) {
          setTypingUsers(
            typingData
              .filter((t) => t.userId !== userId)
              .map((t) => t.userName || t.username)
          );
        }
      }
    );
  };

  const broadcastTyping = async () => {
    // CRITICAL FIX: Check if selectedChannel exists before accessing
    if (!selectedChannel?.id) {
      return; // Silently return if no channel selected
    }

    if (!isTyping && messageInput.length > 0) {
      setIsTyping(true);
      try {
        await messageService.startTyping?.(
          selectedChannel.id,
          userId,
          currentUser?.username || currentUser?.full_name
        );
      } catch (error) {
        console.error('Error broadcasting typing:', error);
      }
    }

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 3000);
  };

  const stopTyping = async () => {
    // CRITICAL FIX: Check if selectedChannel exists before accessing
    if (!selectedChannel?.id) {
      return; // Silently return if no channel selected
    }

    if (isTyping) {
      setIsTyping(false);
      try {
        await messageService.stopTyping?.(selectedChannel.id, userId);
      } catch (error) {
        console.error('Error stopping typing:', error);
      }
    }
    clearTimeout(typingTimeoutRef.current);
  };

  const handleSendMessage = async () => {
    // CRITICAL FIX: Check selectedChannel exists FIRST
    if (!selectedChannel?.id) {
      console.error('❌ Cannot send message: no channel selected');
      alert('Please select a channel first');
      return;
    }

    const content = messageInput.trim();
    if (!content || sending) return;

    if (editingMessage) {
      try {
        setSending(true);
        await messageService.editMessage(editingMessage.id, userId, content);
        setEditingMessage(null);
        setMessageInput("");
        await loadMessages(selectedChannel.id);
      } catch (error) {
        console.error("Error editing message:", error);
        alert("Failed to edit message");
      } finally {
        setSending(false);
      }
      return;
    }

    const tempId = `temp_${Date.now()}_${messageIdCounter.current++}`;
    
    // Create pending message with COMPLETE user data
    const pendingMessage = {
      tempId,
      id: tempId,
      content,
      user_id: userId,
      channel_id: selectedChannel.id,
      user: {
        id: userId,
        user_id: userId,
        username: currentUser?.username || 'You',
        full_name: currentUser?.full_name || 'You',
        avatar: currentUser?.avatar,
        avatar_id: currentUser?.avatar_id,
        avatar_metadata: currentUser?.avatar_metadata,
        verified: currentUser?.verified || false,
      },
      role: null, // Will be populated by subscription
      created_at: new Date().toISOString(),
      reactions: {},
      edited: false,
      isPending: true,
      isSent: false,
      isDelivered: false,
    };

    console.log('📤 Sending message with user data:', pendingMessage.user);

    // Add to pending immediately
    setPendingMessages((prev) => [...prev, pendingMessage]);
    setMessageInput("");
    stopTyping();

    try {
      // Send in background
      await messageService.sendMessage(selectedChannel.id, userId, content, {
        replyToId: null,
        attachments: [],
        tempId,
      });
    } catch (error) {
      console.error("Error sending message:", error);
      // Remove from pending on error
      setPendingMessages((prev) => prev.filter((m) => m.tempId !== tempId));
      setMessageInput(content);
      alert("Failed to send message. Please try again.");
    }
  };

  const handleInputChange = (e) => {
    setMessageInput(e.target.value);
    broadcastTyping();
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
    if (e.key === "Escape" && editingMessage) {
      setEditingMessage(null);
      setMessageInput("");
    }
  };

  const handleContextMenu = (e, message) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, message });
  };

  const handleChannelContextMenu = (e, channel) => {
    e.preventDefault();
    if (userPermissions.manageChannels || isOwner) {
      setChannelContextMenu({ x: e.clientX, y: e.clientY, channel });
    }
  };

  const handleCreateChannel = async (channelData) => {
    try {
      await channelService.createChannel(channelData, community.id);
      await loadChannels();
      setShowCreateChannel(false);
    } catch (error) {
      console.error("Error creating channel:", error);
      throw error;
    }
  };

  const handleUpdateChannel = async (channelData) => {
    try {
      await channelService.updateChannel(editingChannel.id, channelData);
      await loadChannels();
      setShowEditChannel(false);
      setEditingChannel(null);
    } catch (error) {
      console.error("Error updating channel:", error);
      throw error;
    }
  };

  const handleDeleteChannel = async (channel) => {
    if (
      !window.confirm(`Delete #${channel.name}? This action cannot be undone.`)
    ) {
      return;
    }

    try {
      await channelService.deleteChannel(channel.id);
      await loadChannels();
      setChannelContextMenu(null);

      if (selectedChannel?.id === channel.id && channels.length > 1) {
        const remaining = channels.filter((ch) => ch.id !== channel.id);
        if (remaining.length > 0) {
          setSelectedChannel(remaining[0]);
        }
      }
    } catch (error) {
      console.error("Error deleting channel:", error);
      alert("Failed to delete channel");
    }
  };

  const handleToggleChannelPrivacy = async (channel) => {
    try {
      await channelService.updateChannel(channel.id, {
        is_private: !channel.is_private,
      });
      await loadChannels();
      setChannelContextMenu(null);
    } catch (error) {
      console.error("Error updating channel:", error);
      alert("Failed to update channel");
    }
  };

  const handleWipeChannel = async (channel) => {
    if (
      !window.confirm(
        `Wipe ALL messages in #${channel.name}? This will permanently delete all messages and cannot be undone. Only proceed if you're absolutely sure.`
      )
    ) {
      return;
    }

    try {
      const isAdministrator = userPermissions.administrator || isOwner;
      await messageService.wipeChannelMessages(
        channel.id,
        userId,
        community.id,
        isAdministrator
      );
      
      // Reload messages to get fresh data
      await loadMessages(channel.id);
      
      setChannelContextMenu(null);
      alert("Channel messages wiped successfully");
    } catch (error) {
      console.error("Error wiping channel:", error);
      alert(error.message || "Failed to wipe channel");
    }
  };

  const handleDeleteUserMessages = async (targetUserId) => {
    if (!selectedChannel) return;

    if (
      !window.confirm(
        "Delete ALL messages from this user in this channel? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      const hasPermission = userPermissions.manageMessages || isOwner;
      await messageService.deleteUserMessagesInChannel(
        selectedChannel.id,
        targetUserId,
        userId,
        hasPermission
      );
      
      // Reload messages to get fresh data
      await loadMessages(selectedChannel.id);
      
      alert("User messages deleted successfully");
    } catch (error) {
      console.error("Error deleting user messages:", error);
      alert(error.message || "Failed to delete user messages");
    }
  };

  const handleDeleteMessage = async (message) => {
    if (!window.confirm("Delete this message?")) {
      setContextMenu(null);
      return;
    }

    try {
      const isOwnerUser = community.owner_id === userId;
      await messageService.deleteMessage(message.id, userId, community.id);
      
      // Reload messages to get fresh data
      await loadMessages(selectedChannel.id);
    } catch (error) {
      console.error("Error deleting message:", error);
      alert("Failed to delete message");
    }
    setContextMenu(null);
  };

  const handleEditMessage = (message) => {
    setEditingMessage(message);
    setMessageInput(message.content);
    inputRef.current?.focus();
    setContextMenu(null);
  };

  const handleReactionClick = async (messageId, emoji) => {
    try {
      const messages = channelMessages[selectedChannel.id] || [];
      const message = messages.find((m) => m.id === messageId);
      const hasReacted = message?.reactions?.[emoji]?.users?.includes(userId);

      if (hasReacted) {
        const reactions = await messageService.removeReaction(
          messageId,
          userId,
          emoji
        );
        updateMessageReactions(messageId, reactions);
      } else {
        const reactions = await messageService.addReaction(
          messageId,
          userId,
          emoji
        );
        updateMessageReactions(messageId, reactions);
      }
    } catch (error) {
      console.error("Error toggling reaction:", error);
    }
  };

  const updateMessageReactions = (messageId, reactions) => {
    setChannelMessages((prev) => {
      const channelMsgs = prev[selectedChannel.id] || [];
      const updated = channelMsgs.map((m) =>
        m.id === messageId ? { ...m, reactions } : m
      );
      
      return {
        ...prev,
        [selectedChannel.id]: updated,
      };
    });
  };

  const currentChannelIndex = channels.findIndex(
    (ch) => ch.id === selectedChannel?.id
  );
  const isOwner = community?.owner_id === userId;
  const canManageChannels = userPermissions.manageChannels || isOwner;
  const currentMessages = channelMessages[selectedChannel?.id] || [];

  return (
    <div
      className="chat-tab"
      onClick={() => {
        setContextMenu(null);
        setChannelContextMenu(null);
        setShowEmoji(false);
      }}
    >
      <ChatBackground theme={backgroundTheme} />

      <div className="channels-bar">
        <div className="menu-button" onClick={() => setShowMenu(true)}>
          <Menu size={18} />
        </div>

        <div className="channels-scroll">
          {channels.map((channel) => (
            <div
              key={channel.id}
              className={`channel-item ${selectedChannel?.id === channel.id ? "active" : ""}`}
              onClick={() => setSelectedChannel(channel)}
              onContextMenu={(e) => handleChannelContextMenu(e, channel)}
            >
              <span className="channel-icon">{channel.icon || "💬"}</span>
              <span className="channel-name">{channel.name}</span>
              {channel.is_private && <Lock size={10} />}
            </div>
          ))}
        </div>

        <div className="channel-nav-btns">
          <button
            className="channel-nav-btn"
            onClick={() => {
              if (currentChannelIndex > 0) {
                setSelectedChannel(channels[currentChannelIndex - 1]);
              }
            }}
            disabled={currentChannelIndex === 0}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            className="channel-nav-btn"
            onClick={() => {
              if (currentChannelIndex < channels.length - 1) {
                setSelectedChannel(channels[currentChannelIndex + 1]);
              }
            }}
            disabled={currentChannelIndex === channels.length - 1}
          >
            <ChevronRight size={16} />
          </button>
          {canManageChannels && (
            <button
              className="channel-nav-btn"
              onClick={() => setShowCreateChannel(true)}
              title="Create Channel"
            >
              <Plus size={16} />
            </button>
          )}
          <button
            className="channel-nav-btn"
            onClick={() => setShowBackgroundSwitcher(true)}
            title="Change Background"
          >
            <Palette size={16} />
          </button>
        </div>
      </div>

      <MessageList
        messages={currentMessages}
        pendingMessages={pendingMessages}
        loading={false}
        userId={userId}
        currentUser={currentUser}
        messagesEndRef={messagesEndRef}
        onContextMenu={handleContextMenu}
        onReactionClick={handleReactionClick}
        typingUsers={typingUsers}
        channelId={selectedChannel?.id}
        userPermissions={userPermissions}
        isOwner={isOwner}
        communityId={community?.id}
      />

      {editingMessage && (
        <div className="editing-bar">
          <div className="editing-content">
            <Edit3 size={16} />
            <div className="editing-text">
              <span className="editing-label">Editing message</span>
              <span className="editing-preview">
                {editingMessage.content.substring(0, 50)}...
              </span>
            </div>
            <button
              className="cancel-edit"
              onClick={() => {
                setEditingMessage(null);
                setMessageInput("");
              }}
            >
              <MoreVertical size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="message-input-container">
        {showEmoji && (
          <div
            className="emoji-panel-wrapper"
            onClick={(e) => e.stopPropagation()}
          >
            <EmojiPanel
              onSelect={(emoji) => {
                setMessageInput((prev) => prev + emoji);
                setShowEmoji(false);
                inputRef.current?.focus();
              }}
              onClose={() => setShowEmoji(false)}
            />
          </div>
        )}

        <div className="input-wrapper">
          <div
            className={`input-left-actions ${inputExpanded ? "hidden" : ""}`}
          >
            <button
              className="input-btn"
              onClick={(e) => {
                e.stopPropagation();
                setShowEmoji(!showEmoji);
              }}
            >
              <Smile size={16} />
            </button>
            <button className="input-btn">
              <Image size={16} />
            </button>
          </div>

          {inputExpanded && (
            <button
              className="expand-toggle"
              onClick={() => setInputExpanded(false)}
            >
              <ChevronRight size={16} />
            </button>
          )}

          <input
            ref={inputRef}
            type="text"
            className="message-input"
            placeholder={`Message #${selectedChannel?.name || "channel"}`}
            value={messageInput}
            onChange={handleInputChange}
            onFocus={() => setInputExpanded(true)}
            onKeyPress={handleKeyPress}
            onBlur={stopTyping}
            disabled={sending}
          />

          <div className="input-actions">
            <button
              className="input-btn send-btn"
              onClick={handleSendMessage}
              disabled={!messageInput.trim() || sending}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>

      <CommunityMenu
        show={showMenu}
        onClose={() => setShowMenu(false)}
        community={community}
        userId={userId}
        onLeave={onLeaveCommunity}
        onUpdate={onCommunityUpdate}
        onCreateChannel={() => setShowCreateChannel(true)}
        onOpenInvite={onOpenInvite}
        onDeleteCommunity={() => {
          setShowMenu(false);
          onDeleteCommunity();
        }}
        onOpenBackgroundSwitcher={() => {
          setShowMenu(false);
          setShowBackgroundSwitcher(true);
        }}
      />

      {contextMenu && (
        <ContextMenu
          position={contextMenu}
          message={contextMenu.message}
          userId={userId}
          permissions={userPermissions}
          isOwner={isOwner}
          onClose={() => setContextMenu(null)}
          onEdit={() => handleEditMessage(contextMenu.message)}
          onDelete={() => handleDeleteMessage(contextMenu.message)}
          onReaction={(emoji) =>
            handleReactionClick(contextMenu.message.id, emoji)
          }
          onCopy={() => {
            navigator.clipboard.writeText(contextMenu.message.content);
            setContextMenu(null);
          }}
          onDeleteUserMessages={() => handleDeleteUserMessages(contextMenu.message.user_id)}
        />
      )}

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
          onDelete={() => handleDeleteChannel(channelContextMenu.channel)}
          onTogglePrivacy={() =>
            handleToggleChannelPrivacy(channelContextMenu.channel)
          }
          onWipeChannel={() => handleWipeChannel(channelContextMenu.channel)}
        />
      )}

      {showCreateChannel && (
        <CreateChannelModal
          onClose={() => setShowCreateChannel(false)}
          onCreate={handleCreateChannel}
          communityId={community.id}
        />
      )}

      {showEditChannel && editingChannel && (
        <EditChannelModal
          channel={editingChannel}
          onClose={() => {
            setShowEditChannel(false);
            setEditingChannel(null);
          }}
          onUpdate={handleUpdateChannel}
        />
      )}

      {showBackgroundSwitcher && (
        <BackgroundSwitcher
          show={showBackgroundSwitcher}
          onClose={() => setShowBackgroundSwitcher(false)}
          currentTheme={backgroundTheme}
          onThemeChange={handleBackgroundChange}
        />
      )}
    </div>
  );
};

export default ChatTab;