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
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [loading, setLoading] = useState(true);
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
  const [backgroundTheme, setBackgroundTheme] = useState("security");
  const [showBackgroundSwitcher, setShowBackgroundSwitcher] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const unsubscribeRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const typingSubscriptionRef = useRef(null);

  useEffect(() => {
    if (community) {
      loadChannels();
      loadPermissions();
      loadBackgroundPreference();
    }
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      if (typingSubscriptionRef.current) {
        typingSubscriptionRef.current();
      }
    };
  }, [community]);

  useEffect(() => {
    if (selectedChannel) {
      loadMessages();
      subscribeToMessages();
      subscribeToTyping();
    }
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      if (typingSubscriptionRef.current) {
        typingSubscriptionRef.current();
      }
      stopTyping();
    };
  }, [selectedChannel]);

  const loadBackgroundPreference = () => {
    const saved = localStorage.getItem(`bg-theme-${community.id}`);
    if (saved) {
      setBackgroundTheme(saved);
    }
  };

  const handleBackgroundChange = (theme) => {
    setBackgroundTheme(theme);
    localStorage.setItem(`bg-theme-${community.id}`, theme);
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

  const loadMessages = async () => {
    try {
      setLoading(true);
      const data = await messageService.fetchMessages(selectedChannel.id);
      setMessages(data);
    } catch (error) {
      console.error("Error loading messages:", error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToMessages = () => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    unsubscribeRef.current = messageService.subscribeToMessages(
      selectedChannel.id,
      (newMessage) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMessage.id)) return prev;
          return [...prev, newMessage];
        });
      },
    );
  };

  const subscribeToTyping = () => {
    if (typingSubscriptionRef.current) {
      typingSubscriptionRef.current();
    }

    // Subscribe to typing indicators via Supabase realtime
    typingSubscriptionRef.current = messageService.subscribeToTyping?.(
      selectedChannel.id,
      (typingData) => {
        setTypingUsers(
          typingData
            .filter((t) => t.userId !== userId)
            .map((t) => t.userName || t.username)
        );
      }
    );
  };

  const broadcastTyping = async () => {
    if (!isTyping && messageInput.length > 0) {
      setIsTyping(true);
      await messageService.startTyping?.(selectedChannel.id, userId, currentUser?.username || currentUser?.full_name);
    }

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 3000);
  };

  const stopTyping = async () => {
    if (isTyping) {
      setIsTyping(false);
      await messageService.stopTyping?.(selectedChannel.id, userId);
    }
    clearTimeout(typingTimeoutRef.current);
  };

  const handleSendMessage = async () => {
    const content = messageInput.trim();
    if (!content || sending) return;

    if (editingMessage) {
      try {
        setSending(true);
        await messageService.editMessage(editingMessage.id, userId, content);
        setEditingMessage(null);
        setMessageInput("");
        await loadMessages();
      } catch (error) {
        console.error("Error editing message:", error);
        alert("Failed to edit message");
      } finally {
        setSending(false);
      }
      return;
    }

    setSending(true);
    const tempInput = messageInput;
    setMessageInput("");
    stopTyping();

    try {
      await messageService.sendMessage(selectedChannel.id, userId, content, {
        replyToId: null,
        attachments: [],
      });
    } catch (error) {
      console.error("Error sending message:", error);
      setMessageInput(tempInput);
      alert("Failed to send message. Please try again.");
    } finally {
      setSending(false);
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

  const handleDeleteMessage = async (message) => {
    if (!window.confirm("Delete this message?")) {
      setContextMenu(null);
      return;
    }

    try {
      const isOwner = community.owner_id === userId;
      const hasPermission = userPermissions.manageMessages || isOwner;
      await messageService.deleteMessage(message.id, userId, hasPermission);
      setMessages((prev) => prev.filter((m) => m.id !== message.id));
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
      const message = messages.find((m) => m.id === messageId);
      const hasReacted = message?.reactions?.[emoji]?.users?.includes(userId);

      if (hasReacted) {
        const reactions = await messageService.removeReaction(
          messageId,
          userId,
          emoji,
        );
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, reactions } : m)),
        );
      } else {
        const reactions = await messageService.addReaction(
          messageId,
          userId,
          emoji,
        );
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, reactions } : m)),
        );
      }
    } catch (error) {
      console.error("Error toggling reaction:", error);
    }
  };

  const currentChannelIndex = channels.findIndex(
    (ch) => ch.id === selectedChannel?.id,
  );
  const isOwner = community?.owner_id === userId;
  const canManageChannels = userPermissions.manageChannels || isOwner;

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
        messages={messages}
        loading={loading}
        userId={userId}
        messagesEndRef={messagesEndRef}
        onContextMenu={handleContextMenu}
        onReactionClick={handleReactionClick}
        typingUsers={typingUsers}
        channelId={selectedChannel?.id}
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
          onClose={() => setContextMenu(null)}
          onEdit={() => handleEditMessage(contextMenu.message)}
          onDelete={() => handleDeleteMessage(contextMenu.message)}
          onReaction={(emoji) => handleReactionClick(contextMenu.message.id, emoji)}
          onCopy={() => {
            navigator.clipboard.writeText(contextMenu.message.content);
            setContextMenu(null);
          }}
        />
      )}

      {channelContextMenu && (
        <ChannelContextMenu
          position={channelContextMenu}
          channel={channelContextMenu.channel}
          isOwner={isOwner}
          hasManagePermission={canManageChannels}
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