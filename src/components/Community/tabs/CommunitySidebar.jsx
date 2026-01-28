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
          background: rgba(15, 15, 15, 0.95);
          border-right: 2px solid rgba(156, 255, 0, 0.1);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 12px 0;
          gap: 8px;
          overflow-y: auto;
          overflow-x: hidden;
        }

        .community-sidebar::-webkit-scrollbar {
          width: 4px;
        }

        .community-sidebar::-webkit-scrollbar-track {
          background: transparent;
        }

        .community-sidebar::-webkit-scrollbar-thumb {
          background: rgba(156, 255, 0, 0.3);
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
        }

        .community-icon.home {
          background: rgba(26, 26, 26, 0.8);
          color: #999;
        }

        .community-icon.home:hover {
          background: rgba(156, 255, 0, 0.15);
          color: #9cff00;
          border-radius: 12px;
        }

        .community-icon.home.active {
          background: linear-gradient(135deg, #9cff00 0%, #667eea 100%);
          color: #000;
          border-radius: 12px;
          box-shadow: 0 0 20px rgba(156, 255, 0, 0.4);
        }

        .community-icon:not(.home):not(.create):hover {
          border-radius: 12px;
          transform: translateX(-4px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        }

        .community-icon.active:not(.home):not(.create) {
          border-radius: 12px;
          box-shadow: 0 0 20px rgba(156, 255, 0, 0.3);
        }

        .community-icon.active:not(.home):not(.create)::before {
          content: "";
          position: absolute;
          left: -12px;
          width: 4px;
          height: 24px;
          background: #9cff00;
          border-radius: 0 4px 4px 0;
        }

        .community-icon.create {
          background: rgba(26, 26, 26, 0.8);
          color: #9cff00;
          border: 2px dashed rgba(156, 255, 0, 0.4);
        }

        .community-icon.create:hover {
          background: rgba(156, 255, 0, 0.15);
          border-color: rgba(156, 255, 0, 0.8);
          border-radius: 12px;
          transform: scale(1.05);
        }

        .community-divider {
          width: 32px;
          height: 2px;
          background: rgba(156, 255, 0, 0.2);
          border-radius: 1px;
          margin: 4px 0;
          flex-shrink: 0;
        }

        .context-menu {
          position: fixed;
          background: rgba(15, 15, 15, 0.98);
          border: 2px solid rgba(156, 255, 0, 0.3);
          border-radius: 12px;
          padding: 8px;
          min-width: 200px;
          z-index: 10000;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
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
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          transition: all 0.2s;
        }

        .context-item:hover {
          background: rgba(156, 255, 0, 0.15);
          color: #9cff00;
        }

        .context-item span {
          font-size: 18px;
        }

        @media (max-width: 768px) {
          .community-sidebar {
            width: 54px;
            border-right: 1px solid rgba(156, 255, 0, 0.1);
            border-top: 1px solid rgba(156, 255, 0, 0.1);
            padding: 8px 0px;
          }

          .community-list {
            padding: 0;
          }

          .community-icon {
            width: 40px;
            height: 40px;
            border: 1px solid #444444;
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
