import React, { useState } from "react";
import { Home, Plus } from "lucide-react";

const CommunitySidebar = ({
  myCommunities,
  selectedCommunity,
  onSelectCommunity,
  onCreateCommunity,
  onGoHome,
  view,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);

  const handleCreate = () => {
    setShowCreateModal(true);
    if (typeof onCreateCommunity === "function") {
      // Signal to parent to show create modal
      onCreateCommunity();
    }
  };

  const handleContextMenu = (e, community) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, community });
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
              className={`community-icon ${selectedCommunity?.id === community.id ? "active" : ""}`}
              style={{
                background:
                  community.banner_gradient ||
                  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              }}
              onClick={() => onSelectCommunity(community)}
              onContextMenu={(e) => handleContextMenu(e, community)}
              title={community.name}
            >
              <span>{community.icon || "🌟"}</span>
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
          padding: 12px 0;
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
          width: 48px;
          height: 48px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          flex-shrink: 0;
          border: 1px solid transparent;
        }

        .community-icon.home {
          background: var(--surface);
          color: var(--text-secondary);
        }

        .community-icon.home:hover {
          background: var(--accent-bg-soft);
          color: var(--accent);
          border-radius: 12px;
        }

        .community-icon.home.active {
          background: var(--accent-gradient);
          color: var(--accent-contrast);
          border-radius: 12px;
          box-shadow: 0 0 20px var(--accent-shadow);
        }

        .community-icon:not(.home):not(.create):hover {
          border-radius: 12px;
          transform: translateX(-4px);
          box-shadow: 0 8px 24px var(--shadow);
        }

        .community-icon.active:not(.home):not(.create) {
          border-radius: 12px;
          box-shadow: 0 0 20px var(--accent-shadow);
        }

        .community-icon.active:not(.home):not(.create)::before {
          content: "";
          position: absolute;
          left: -12px;
          width: 4px;
          height: 24px;
          background: var(--accent);
          border-radius: 0 4px 4px 0;
        }

        .community-icon.create {
          background: var(--surface);
          color: var(--accent);
          border: 2px dashed var(--accent-border);
        }

        .community-icon.create:hover {
          background: var(--accent-bg-soft);
          border-color: var(--accent-border-strong);
          border-radius: 12px;
          transform: scale(1.05);
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
            width: 54px;
            border-right: 1px solid var(--surface-border);
            border-top: 1px solid var(--surface-border);
            padding: 8px 0px;
            padding-bottom: 15px;
          }

          .community-list {
            padding: 0;
          }

          .community-icon {
            width: 40px;
            height: 40px;
            border: 1px solid var(--surface-border);
          }

          .community-icon.active:not(.home):not(.create)::before {
            left: auto;
            top: -8px;
            width: 24px;
            height: 4px;
            border-radius: 0 0 4px 4px;
          }
        }
      `}</style>
    </>
  );
};

export default CommunitySidebar;
