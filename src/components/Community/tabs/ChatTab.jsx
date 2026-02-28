// components/Community/tabs/ChatTab.jsx - MOBILE BACK BUTTON & SIDEBAR TOGGLE
import React, { useState, useEffect, useRef } from "react";
import {
  Menu,
  ChevronLeft,
  ChevronRight,
  Plus,
  Lock,
  Palette,
  ChevronDown,
  ArrowLeft,
} from "lucide-react";
import MessageList from "../components/MessageList";
import ContextMenu from "../components/ContextMenu";
import ChannelContextMenu from "../components/ChannelContextMenu";
import CommunityMenu from "../components/CommunityMenu";
import CreateChannelModal from "../modals/CreateChannelModal";
import EditChannelModal from "../modals/EditChannelModal";
import BackgroundDropdown from "../components/BackgroundDropdown";
import ChatBackground from "../components/ChatBackground";
import CommunityMessageInput from "../components/CommunityMessageInput";
import channelService from "../../../services/community/channelService";
import communityMessageService from "../../../services/community/communityMessageService";
import communityState from "../../../services/community/CommunityStateManager";
import backgroundService from "../../../services/community/CommunityBackgroundService";
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
  const [editingChannel, setEditingChannel] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [userPermissions, setUserPermissions] = useState({});
  const [typingUsers, setTypingUsers] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [showBgDropdown, setShowBgDropdown] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [backgroundId, setBackgroundId] = useState('minimal');
  const [isMobile, setIsMobile] = useState(false);

  const backgroundTheme = backgroundService.getTheme(backgroundId);

  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const unsubscribeChannel = useRef(null);
  const unsubscribeTyping = useRef(null);
  const typingTimeout = useRef(null);
  const isAtBottom = useRef(true);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (community) {
      const bg = backgroundService.getBackground(userId, community.id);
      setBackgroundId(bg);
    }
  }, [community?.id, userId]);

  useEffect(() => {
    const unsubscribe = backgroundService.subscribe(() => {
      if (community) {
        const bg = backgroundService.getBackground(userId, community.id);
        setBackgroundId(bg);
      }
    });
    return unsubscribe;
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

  useEffect(() => {
    if (community) {
      loadChannels();
      loadPermissions();
    }
  }, [community?.id]);

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

  // TYPING DETECTION: Track input changes - send typing on every change
  useEffect(() => {
    if (messageInput.length > 0) {
      // User is typing - send indicator
      if (!isTyping) {
        setIsTyping(true);
        communityMessageService.sendTyping(
          selectedChannel?.id,
          true,
          currentUser?.username || currentUser?.full_name || currentUser?.fullName
        );
      }

      // Reset the stop timer on every keystroke
      clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => {
        stopTyping();
      }, 3000);
    } else {
      // Input is empty - stop immediately
      if (isTyping) {
        stopTyping();
      }
    }

    // Cleanup on unmount or channel change
    return () => {
      clearTimeout(typingTimeout.current);
    };
  }, [messageInput, selectedChannel?.id]);

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
    if (!selectedChannel?.id) return;
    
    try {
      await communityMessageService.loadMessages(selectedChannel.id);
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  const subscribeToChannel = () => {
    if (unsubscribeChannel.current) {
      unsubscribeChannel.current();
    }

    unsubscribeChannel.current = communityMessageService.subscribeToChannel(
      selectedChannel.id,
      (message) => {
        if (isAtBottom.current) {
          setTimeout(scrollToBottom, 10);
        }
      }
    );
  };

  const subscribeToTyping = () => {
    if (unsubscribeTyping.current) {
      unsubscribeTyping.current();
    }

    unsubscribeTyping.current = communityMessageService.subscribeToTyping(
      selectedChannel.id,
      (typing) => {
        if (typing.length > 0 && isAtBottom.current) {
          setTimeout(scrollToBottom, 100);
        }
      }
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
        alert("Failed to edit message");
      } finally {
        setSending(false);
      }
      return;
    }

    setMessageInput("");
    stopTyping();

    try {
      let avatarId = currentUser?.avatar_id;
      
      if (!avatarId && currentUser?.avatar && typeof currentUser.avatar === 'string') {
        if (currentUser.avatar.includes('/')) {
          const parts = currentUser.avatar.split('/');
          avatarId = parts[parts.length - 1].split('?')[0];
        }
      }

      await communityMessageService.sendMessage(
        selectedChannel.id,
        userId,
        content,
        {
          user: {
            id: userId,
            username: currentUser?.username,
            full_name: currentUser?.full_name || currentUser?.fullName,
            avatar_id: avatarId,
            avatar_metadata: currentUser?.avatar_metadata,
            verified: currentUser?.verified || false
          }
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

  const currentChannelIndex = channels.findIndex((ch) => ch.id === selectedChannel?.id);
  const isOwner = community?.owner_id === userId;
  const canManageChannels = userPermissions.manageChannels || isOwner;

  return (
    <div className="chat-tab" onClick={() => {
      setContextMenu(null);
      setChannelContextMenu(null);
    }}>
      <ChatBackground key={backgroundId} theme={backgroundTheme.id} />

      <div className="channels-bar">
        {isMobile && onBack && (
          <button className="back-button" onClick={onBack} title="Back to Discover">
            <ArrowLeft size={20} />
          </button>
        )}

        <div className="menu-button" onClick={() => setShowMenu(true)}>
          <Menu size={18} />
        </div>

        <div className="channels-scroll">
          {channels.map((channel) => (
            <div
              key={channel.id}
              className={`channel-item ${selectedChannel?.id === channel.id ? "active" : ""}`}
              onClick={() => setSelectedChannel(channel)}
              onContextMenu={(e) => {
                e.preventDefault();
                if (canManageChannels) {
                  setChannelContextMenu({ x: e.clientX, y: e.clientY, channel });
                }
              }}
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
            onClick={() => setShowBgDropdown(!showBgDropdown)}
            title="Change Background"
          >
            <Palette size={16} />
          </button>
        </div>
      </div>

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

      {/* Input area wrapper — gives BackgroundDropdown a relative parent to anchor to */}
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
          onCancelEdit={() => {
            setEditingMessage(null);
            setMessageInput("");
          }}
          typingUsers={typingUsers}
        />
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
          setShowBgDropdown(true);
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
          onEdit={() => {
            setEditingMessage(contextMenu.message);
            setMessageInput(contextMenu.message.content);
            setContextMenu(null);
          }}
          onDelete={async () => {
            if (!window.confirm("Delete this message?")) {
              setContextMenu(null);
              return;
            }

            try {
              await communityMessageService.deleteMessage(
                contextMenu.message.id,
                userId,
                community.id
              );
              await loadMessages();
            } catch (error) {
              console.error("Error deleting message:", error);
              alert("Failed to delete message");
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
          isAdministrator={userPermissions.administrator || isOwner}
          onClose={() => setChannelContextMenu(null)}
          onEdit={() => {
            setEditingChannel(channelContextMenu.channel);
            setShowEditChannel(true);
            setChannelContextMenu(null);
          }}
          onDelete={async () => {
            if (!window.confirm(`Delete #${channelContextMenu.channel.name}? This action cannot be undone.`)) {
              return;
            }

            try {
              await channelService.deleteChannel(channelContextMenu.channel.id);
              await loadChannels();
              setChannelContextMenu(null);

              if (selectedChannel?.id === channelContextMenu.channel.id && channels.length > 1) {
                const remaining = channels.filter((ch) => ch.id !== channelContextMenu.channel.id);
                if (remaining.length > 0) {
                  setSelectedChannel(remaining[0]);
                }
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
              alert("Failed to update channel");
            }
          }}
        />
      )}

      {showCreateChannel && (
        <CreateChannelModal
          onClose={() => setShowCreateChannel(false)}
          onCreate={async (channelData) => {
            try {
              await channelService.createChannel(channelData, community.id);
              await loadChannels();
              setShowCreateChannel(false);
            } catch (error) {
              console.error("Error creating channel:", error);
              throw error;
            }
          }}
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
          onUpdate={async (channelData) => {
            try {
              await channelService.updateChannel(editingChannel.id, channelData);
              await loadChannels();
              setShowEditChannel(false);
              setEditingChannel(null);
            } catch (error) {
              console.error("Error updating channel:", error);
              throw error;
            }
          }}
        />
      )}

      <style>{`
        .chat-tab {
          display: flex;
          flex-direction: column;
          height: 100vh;
          position: relative;
          background: #000;
        }

        .channels-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: rgba(0, 0, 0, 0.95);
          border-bottom: 1px solid rgba(156, 255, 0, 0.12);
          z-index: 10;
        }

        .back-button {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #9cff00;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .back-button:hover {
          background: rgba(156, 255, 0, 0.1);
          border-color: rgba(156, 255, 0, 0.3);
          transform: translateX(-2px);
        }

        .menu-button {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #9cff00;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .menu-button:hover {
          background: rgba(156, 255, 0, 0.1);
          border-color: rgba(156, 255, 0, 0.3);
        }

        .channels-scroll {
          flex: 1;
          display: flex;
          gap: 6px;
          overflow-x: auto;
          padding: 2px;
        }

        .channels-scroll::-webkit-scrollbar {
          height: 4px;
        }

        .channels-scroll::-webkit-scrollbar-track {
          background: rgba(26, 26, 26, 0.3);
        }

        .channels-scroll::-webkit-scrollbar-thumb {
          background: rgba(156, 255, 0, 0.3);
          border-radius: 2px;
        }

        .channel-item {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          background: rgba(26, 26, 26, 0.4);
          border: 1px solid rgba(42, 42, 42, 0.6);
          border-radius: 8px;
          color: #ccc;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .channel-item:hover {
          background: rgba(26, 26, 26, 0.8);
          border-color: rgba(156, 255, 0, 0.3);
          color: #fff;
        }

        .channel-item.active {
          background: rgba(156, 255, 0, 0.15);
          border-color: rgba(156, 255, 0, 0.5);
          color: #9cff00;
        }

        .channel-icon {
          font-size: 16px;
        }

        .channel-nav-btns {
          display: flex;
          gap: 4px;
          flex-shrink: 0;
        }

        .channel-nav-btn {
          width: 32px;
          height: 32px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #999;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .channel-nav-btn:hover:not(:disabled) {
          background: rgba(156, 255, 0, 0.1);
          border-color: rgba(156, 255, 0, 0.3);
          color: #9cff00;
        }

        .channel-nav-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .chat-msgs {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          position: relative;
        }

        .chat-msgs::-webkit-scrollbar {
          width: 6px;
        }

        .chat-msgs::-webkit-scrollbar-track {
          background: rgba(26, 26, 26, 0.2);
        }

        .chat-msgs::-webkit-scrollbar-thumb {
          background: rgba(156, 255, 0, 0.3);
          border-radius: 3px;
        }

        /* Wrapper gives BackgroundDropdown a relative anchor
           so bottom: calc(100% + 8px) sits just above the input */
        .chat-input-area {
          position: relative;
          flex-shrink: 0;
        }

        .jump-btn {
          position: fixed;
          bottom: 90px;
          right: 20px;
          z-index: 5;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(10, 10, 10, 0.95);
          border: 2px solid rgba(156, 255, 0, 0.5);
          color: #9cff00;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
          transition: all 0.2s;
        }

        .jump-btn:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 16px rgba(156, 255, 0, 0.3);
        }

        @media (max-width: 768px) {
          .channels-bar {
            padding: 6px 8px;
            gap: 6px;
          }

          .back-button,
          .menu-button {
            width: 32px;
            height: 32px;
          }

          .channel-item {
            padding: 6px 10px;
            font-size: 12px;
          }

          .channel-nav-btns {
            gap: 3px;
          }

          .channel-nav-btn {
            width: 28px;
            height: 28px;
          }

          .jump-btn {
            bottom: 80px;
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