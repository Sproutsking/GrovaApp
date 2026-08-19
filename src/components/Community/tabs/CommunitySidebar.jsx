import React, { useState } from "react";
import { Home, Plus } from "lucide-react";
import CommunityAvatar from "../utils/communityVisuals";

const CommunitySidebar = ({
  myCommunities,
  selectedCommunity,
  onSelectCommunity,
  onCreateCommunity,
  onGoHome,
  onPrefetchCommunity,
  view,
}) => {
  const [contextMenu, setContextMenu] = useState(null);

  const handleCreate = () => {
    if (typeof onCreateCommunity === "function") {
      // Signal to parent to show create modal
      onCreateCommunity();
    }
  };

  const handleContextMenu = (e, community) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, community });
  };

  const handlePrefetch = (communityId) => {
    if (typeof onPrefetchCommunity === "function") onPrefetchCommunity(communityId);
  };

  return (
    <>
      <div className="community-sidebar" onClick={() => setContextMenu(null)}>
        <div
          className={`community-icon home ${view === "discover" ? "active" : ""}`}
          onClick={onGoHome}
          title="Discover Communities"
        >
          <Home size={20} />
        </div>

        <div className="community-divider"></div>

        <div className="community-list">
          {myCommunities.map((community) => (
            <div
              key={community.id}
              className={`community-icon-wrap${selectedCommunity?.id === community.id ? " active" : ""}`}
              onClick={() => onSelectCommunity(community)}
              onMouseEnter={() => handlePrefetch(community.id)}
              onContextMenu={(e) => handleContextMenu(e, community)}
              title={community.name}
            >
              <CommunityAvatar
                icon={community.icon || "🌟"}
                gradientCss={community.banner_gradient}
                borderStyle={community.icon_border}
                size={50}
                radius={14}
                className="community-avatar-slot"
              />
            </div>
          ))}
        </div>

        <div
          className="community-icon create"
          onClick={handleCreate}
          title="Create Community"
        >
          <Plus size={20} />
        </div>
      </div>

      {contextMenu && (
        <div
          className="context-menu"
          style={{
            top: Math.min(contextMenu.y, window.innerHeight - 200),
            left: Math.min(contextMenu.x, window.innerWidth - 200),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="context-item"
            onClick={() => {
              onSelectCommunity(contextMenu.community);
              setContextMenu(null);
            }}
          >
            <span>👁️</span>
            View Community
          </div>
          <div className="context-item" onClick={() => setContextMenu(null)}>
            <span>🔔</span>
            Notification Settings
          </div>
        </div>
      )}

      <style jsx>{`
        .community-sidebar {
          width: 72px;
          background: linear-gradient(180deg, var(--panel-strong) 0%, var(--panel) 100%);
          border-right: 2px solid var(--surface-border);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 16px 0 12px 0;
          gap: 8px;
          overflow-y: auto;
          overflow-x: hidden;
          box-shadow: inset -1px 0 0 rgba(255,255,255,0.02);
        }

        .community-sidebar::-webkit-scrollbar {
          width: 4px;
        }

        .community-sidebar::-webkit-scrollbar-track {
          background: transparent;
        }

        .community-sidebar::-webkit-scrollbar-thumb {
          background: var(--accent-bg-strong);
          border-radius: 2px;
        }

        /* Sidebar header: fixed height, always bordered on the bottom —
           the rail's own "title bar", not a hover-revealed affordance. */
        .sidebar-top {
          width: 100%;
          height: 52px;
          min-height: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-bottom: 1.5px solid var(--accent-border, rgba(156,255,0,0.16));
          background: linear-gradient(180deg, rgba(156,255,0,0.06) 0%, transparent 100%);
          margin-bottom: 8px;
          flex-shrink: 0;
        }
        .sidebar-mark {
          width: 32px;
          height: 32px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accent);
          background: rgba(156,255,0,0.1);
          border: 1px solid rgba(156,255,0,0.22);
          box-shadow: 0 0 16px -4px rgba(156,255,0,0.4);
        }

        .community-list {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 0 12px;
        }

        .community-icon {
          width: 50px;
          height: 50px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
          position: relative;
          flex-shrink: 0;
          border: 1.5px solid transparent;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          background-size: 100% 100%;
          background-position: center;
          background-repeat: no-repeat;
        }

        .community-icon:hover {
          transform: translateY(-3px) scale(1.05);
          box-shadow: 0 8px 20px rgba(0,0,0,0.4);
        }

        .community-icon:active {
          transform: translateY(-1px) scale(1.02);
        }

        .community-icon.home {
          background: rgba(0, 0, 0, 0.3);
          color: var(--accent);
          border: 1.5px solid rgba(156, 255, 0, 0.3);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 4px 12px rgba(0, 0, 0, 0.4);
        }

        .community-icon.home:hover {
          background: rgba(0, 0, 0, 0.4);
          border-color: rgba(156, 255, 0, 0.5);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 8px 24px rgba(156, 255, 0, 0.2);
          transform: translateY(-3px) scale(1.05);
        }

        .community-icon.home.active {
          background: rgba(0, 0, 0, 0.5);
          color: var(--accent);
          border: 2px solid var(--accent);
          box-shadow: inset 0 1px 0 rgba(156, 255, 0, 0.2), 0 0 24px rgba(156, 255, 0, 0.35);
        }

        /* Community icon wrapper — the CommunityAvatar handles its own
           gradient/sheen/glow; this wrapper only handles hover-lift,
           the active rail indicator, and click affordance. */
        .community-icon-wrap {
          position: relative;
          cursor: pointer;
          transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
          flex-shrink: 0;
        }
        .community-icon-wrap:hover { transform: translateY(-3px); }
        .community-icon-wrap:active { transform: translateY(-1px) scale(0.98); }

        .community-icon-wrap.active .cav-root {
          box-shadow:
            0 0 0 2px var(--accent),
            0 10px 26px rgba(0,0,0,.45),
            0 0 0 1px rgba(255,255,255,.09) inset,
            0 0 34px -4px var(--cav-glow);
        }

        .community-icon-wrap.active::before {
          content: "";
          position: absolute;
          left: -12px;
          top: 50%;
          transform: translateY(-50%);
          width: 4px;
          height: 26px;
          background: linear-gradient(180deg, var(--accent), transparent);
          border-radius: 0 2px 2px 0;
          box-shadow: 0 0 8px rgba(156,255,0,0.5);
        }

        .community-icon.create {
          background: rgba(156,255,0,0.08);
          border: 1.5px dashed rgba(156,255,0,0.4);
          color: var(--accent);
          font-weight: 700;
        }

        .community-icon.create:hover {
          background: rgba(156,255,0,0.15);
          border-color: rgba(156,255,0,0.6);
          box-shadow: 0 8px 24px rgba(156,255,0,0.2), inset 0 0 8px rgba(156,255,0,0.1);
          transform: scale(1.08);
        }

        .community-divider {
          width: 32px;
          height: 2px;
          background: var(--accent-bg-strong);
          border-radius: 1px;
          margin: 4px 0;
          flex-shrink: 0;
        }

        .context-menu {
          position: fixed;
          background: var(--glass-strong);
          border: 2px solid var(--accent-border);
          border-radius: 12px;
          padding: 8px;
          min-width: 200px;
          z-index: 10000;
          box-shadow: 0 8px 32px var(--shadow);
          animation: contextMenuSlide 0.2s ease;
        }

        @keyframes contextMenuSlide {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-8px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .context-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          cursor: pointer;
          border-radius: 8px;
          color: var(--text);
          font-size: 14px;
          font-weight: 600;
          transition: all 0.2s;
        }

        .context-item:hover {
          background: var(--accent-bg-soft);
          color: var(--accent);
        }

        .context-item span {
          font-size: 18px;
        }

        @media (max-width: 768px) {
          .community-sidebar {
            width: 56px;
            border-right: 1px solid var(--surface-border);
            border-top: 1px solid var(--surface-border);
            padding: 12px 0px 15px;
          }

          .sidebar-top { height: 40px; min-height: 40px; margin-bottom: 6px; }
          .sidebar-mark { width: 26px; height: 26px; border-radius: 7px; }

          .community-list {
            padding: 0;
          }

          .community-icon {
            width: 39px;
            height: 39px;
            border: 1px solid var(--surface-border);
          }

          .community-icon-wrap.active::before {
            left: auto;
            top: auto;
            bottom: -7px;
            left: 50%;
            transform: translateX(-50%);
            width: 22px;
            height: 3px;
            border-radius: 3px;
            background: linear-gradient(180deg, var(--accent), transparent);
            box-shadow: 0 0 7px rgba(156,255,0,0.35);
          }
        }
      `}</style>
    </>
  );
};

export default CommunitySidebar;