// components/Community/tabs/ChannelsView.jsx
// Mobile-only channel selection view before entering chat.
// REVISION: cache-first instant paint (shares the cache with ChatTab, so if
// desktop/mobile already visited this community, it's instant here too) +
// a premium visual pass matching the rest of the community rewrite.
import React, { useState, useEffect } from "react";
import { ArrowLeft, Plus, Lock, Menu, Hash, Megaphone, Volume2, X } from "lucide-react";
import channelService from "../../../services/community/channelService";
import permissionService from "../../../services/community/permissionService";
import communityCache from "../../../services/community/communityCache";
import CreateChannelModal from "../modals/CreateChannelModal";

const CHANNEL_TYPE_ICON = {
  text: Hash,
  announcement: Megaphone,
  voice: Volume2,
};

const ChannelsView = ({ community, userId, currentUser, onSelectChannel, onBack }) => {
  const [channels, setChannels] = useState(() => (
    communityCache.getChannels(community?.id) || community?.channels || []
  ));
  const [channelsReady, setChannelsReady] = useState(() => (
    !!(communityCache.getChannels(community?.id) || community?.channels?.length)
  ));
  const [userPermissions, setUserPermissions] = useState({});
  const [showMenu, setShowMenu] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);

  useEffect(() => {
    if (community) {
      const immediate = communityCache.getChannels(community.id) || community.channels;
      if (Array.isArray(immediate) && immediate.length) {
        setChannels(immediate);
        setChannelsReady(true);
      }
      loadChannels();
      loadPermissions();
    }
  }, [community?.id]);

  const loadChannels = async () => {
    const cached = communityCache.getChannels(community.id);
    if (cached) {
      setChannels(cached);
      setChannelsReady(true);
    }
    try {
      const data = await communityCache.prefetchChannels(community.id, (id) => channelService.fetchChannels(id));
      setChannels(data);
      setChannelsReady(true);
    } catch (error) {
      console.error("Error loading channels:", error);
      setChannelsReady(true);
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

  const canManageChannels = userPermissions.manage_channels || community?.owner_id === userId;

  const renderChannelIcon = (channel) => {
    const icon = channel.icon;
    if (icon?.startsWith("http")) return <img src={icon} alt="" className="ch-icon-img" />;
    if (icon?.length <= 2) return <span className="ch-emoji">{icon}</span>;
    const Icon = CHANNEL_TYPE_ICON[channel.type] || Hash;
    return <Icon size={14} />;
  };

  const showSkeleton = !channelsReady && channels.length === 0;

  return (
    <div className="channels-view">
      {/* ── Header ── */}
      <div className="channels-view-header">
        <button className="cv-back-btn" onClick={onBack} aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        <div className="cv-title">
          <h2>{community?.name}</h2>
          <p className="cv-member-count">{channels.length} channels</p>
        </div>
        <button className="cv-menu-btn" onClick={() => setShowMenu(true)} aria-label="Menu">
          <Menu size={18} />
        </button>
      </div>

      {/* ── Channels list ── */}
      <div className="channels-view-list">
        {showSkeleton ? (
          <div className="cv-skeleton" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="cv-skel-item" style={{ animationDelay: `${i * 70}ms` }} />
            ))}
          </div>
        ) : (
          <>
            {channels.map((channel) => (
              <button
                key={channel.id}
                className="cv-channel-item"
                onClick={() => onSelectChannel(channel)}
              >
                <span className="cv-channel-icon">{renderChannelIcon(channel)}</span>
                <div className="cv-channel-info">
                  <span className="cv-channel-name">#{channel.name}</span>
                  {channel.description && <p className="cv-channel-desc">{channel.description}</p>}
                </div>
                {channel.is_private && <Lock size={14} className="cv-channel-lock" />}
              </button>
            ))}

            {canManageChannels && (
              <button className="cv-channel-item create" onClick={() => setShowCreateChannel(true)}>
                <Plus size={16} />
                <span>Create Channel</span>
              </button>
            )}

            {channels.length === 0 && (
              <div className="cv-empty">
                <p>No channels yet</p>
                {canManageChannels && <p className="cv-empty-hint">Create one to get started</p>}
              </div>
            )}
          </>
        )}
      </div>

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

      {showMenu && (
        <div className="cv-menu-overlay" onClick={() => setShowMenu(false)}>
          <div className="cv-menu-panel" onClick={(event) => event.stopPropagation()}>
            <div className="cv-menu-head">
              <span>Community menu</span>
              <button onClick={() => setShowMenu(false)} aria-label="Close menu"><X size={17} /></button>
            </div>
            {canManageChannels && (
              <button className="cv-menu-action" onClick={() => { setShowMenu(false); setShowCreateChannel(true); }}>
                <Plus size={16} /> Create channel
              </button>
            )}
            <button className="cv-menu-action" onClick={() => { setShowMenu(false); onBack(); }}>
              <ArrowLeft size={16} /> Back to communities
            </button>
          </div>
        </div>
      )}

      <style>{`
        .channels-view {
          display: flex;
          flex-direction: column;
          height: 100%;
          width: 100%;
          background:
            radial-gradient(120% 60% at 0% 0%, rgba(156,255,0,0.06), transparent 55%),
            radial-gradient(140% 70% at 100% 100%, rgba(102,126,234,0.07), transparent 55%),
            linear-gradient(180deg, rgba(10, 12, 16, 0.98) 0%, rgba(8, 10, 14, 0.96) 100%);
          overflow: hidden;
        }

        .channels-view-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          height: 64px;
          padding: 0 12px;
          border-bottom: 1.5px solid rgba(156, 255, 0, 0.14);
          flex-shrink: 0;
          background: linear-gradient(180deg, rgba(156,255,0,0.045) 0%, rgba(8, 10, 14, 0) 100%);
        }

        .cv-back-btn,
        .cv-menu-btn {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          border: 1.5px solid rgba(156, 255, 0, 0.16);
          background: rgba(156, 255, 0, 0.07);
          color: var(--accent);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
          font-family: inherit;
        }

        .cv-back-btn:hover,
        .cv-menu-btn:hover {
          background: rgba(156, 255, 0, 0.12);
          border-color: rgba(156, 255, 0, 0.25);
          transform: translateY(-1px);
          box-shadow: 0 6px 14px rgba(156, 255, 0, 0.1);
        }

        .cv-title {
          flex: 1;
          text-align: center;
          min-width: 0;
        }

        .cv-title h2 {
          font-size: 14px;
          font-weight: 800;
          color: var(--text);
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          letter-spacing: 0.3px;
        }

        .cv-member-count {
          font-size: 11px;
          color: rgba(156, 255, 0, 0.6);
          margin: 2px 0 0 0;
          font-weight: 600;
        }

        .channels-view-list {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 12px 10px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .channels-view-list::-webkit-scrollbar { width: 4px; }
        .channels-view-list::-webkit-scrollbar-track { background: transparent; }
        .channels-view-list::-webkit-scrollbar-thumb {
          background: rgba(156, 255, 0, 0.2);
          border-radius: 2px;
        }

        .cv-skeleton { display: flex; flex-direction: column; gap: 8px; }
        .cv-skel-item {
          height: 52px;
          border-radius: 12px;
          background: linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.03) 100%);
          background-size: 200% 100%;
          animation: cvShimmer 1.3s ease-in-out infinite;
        }
        @keyframes cvShimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

        .cv-channel-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          min-height: 52px;
          padding: 0 12px;
          border-radius: 12px;
          border: 1px solid rgba(156, 255, 0, 0.14);
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.02));
          color: rgba(255, 255, 255, 0.85);
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
          position: relative;
          font-family: inherit;
        }

        .cv-channel-item:not(.create):hover {
          background: linear-gradient(135deg, rgba(156, 255, 0, 0.1), rgba(156, 255, 0, 0.06));
          border-color: rgba(156, 255, 0, 0.24);
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(156, 255, 0, 0.1);
        }

        .cv-channel-item.create {
          border-style: dashed;
          border-color: rgba(156, 255, 0, 0.2);
          color: rgba(156, 255, 0, 0.8);
          background: rgba(156, 255, 0, 0.05);
          justify-content: center;
          gap: 6px;
          font-weight: 700;
        }

        .cv-channel-item.create:hover {
          background: rgba(156, 255, 0, 0.12);
          border-color: rgba(156, 255, 0, 0.35);
          color: var(--accent);
          box-shadow: 0 6px 16px rgba(156, 255, 0, 0.08);
        }

        .cv-channel-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          flex-shrink: 0;
          opacity: 0.8;
        }

        .cv-channel-info {
          flex: 1;
          min-width: 0;
          text-align: left;
        }

        .cv-channel-name {
          font-size: 13px;
          font-weight: 800;
          color: rgba(255, 255, 255, 0.95);
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          letter-spacing: 0.2px;
        }

        .cv-channel-desc {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.5);
          margin: 3px 0 0 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .cv-channel-lock {
          opacity: 0.6;
          flex-shrink: 0;
        }

        .cv-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          text-align: center;
          color: rgba(255, 255, 255, 0.4);
        }

        .cv-empty p {
          margin: 4px 0;
          font-size: 13px;
        }

        .cv-empty-hint {
          font-size: 11px !important;
          color: rgba(156, 255, 0, 0.4) !important;
          margin-top: 6px !important;
        }

        .cv-menu-overlay {
          position: fixed;
          inset: 0;
          z-index: 1100;
          display: flex;
          justify-content: flex-end;
          align-items: flex-start;
          padding: 76px 14px 14px;
          background: rgba(0,0,0,.28);
          backdrop-filter: blur(5px);
        }

        .cv-menu-panel {
          width: min(280px, calc(100vw - 28px));
          padding: 10px;
          background: rgba(10,12,16,.98);
          border: 1px solid rgba(156,255,0,.2);
          border-radius: 14px;
          box-shadow: 0 18px 50px rgba(0,0,0,.55);
        }

        .cv-menu-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 5px 5px 10px;
          color: #fff;
          font-size: 13px;
          font-weight: 800;
        }

        .cv-menu-head button {
          display: flex;
          padding: 5px;
          border: 0;
          background: transparent;
          color: #888;
          cursor: pointer;
        }

        .cv-menu-action {
          display: flex;
          align-items: center;
          gap: 9px;
          width: 100%;
          padding: 11px 10px;
          border: 1px solid transparent;
          border-radius: 9px;
          background: transparent;
          color: #bbb;
          font-family: inherit;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          text-align: left;
        }

        .cv-menu-action:hover {
          border-color: rgba(156,255,0,.18);
          background: rgba(156,255,0,.08);
          color: #9cff00;
        }
      `}</style>
    </div>
  );
};

export default ChannelsView;