import React, { useState, useEffect, useRef } from "react";
import {
  Edit3,
  Flag,
  Trash2,
  Share2,
  X,
  Copy,
  BookmarkPlus,
  ThumbsDown,
} from "lucide-react";

const ActionMenu = ({
  position,
  isOwnPost,
  content,
  contentType = "post",
  currentUser,
  onClose,
  onEdit,
  onDelete,
  onShare,
  onSave,
  onReport,
}) => {
  const [showSaveFolders, setShowSaveFolders] = useState(false);
  const [folders] = useState(["Favorites", "Inspiration", "Later"]);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const menuRef = useRef(null);

  const menuWidth = 280;
  const baseMenuHeight = isOwnPost ? 420 : 380;

  useEffect(() => {
    const calculatePosition = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const padding = 16; // Safe padding from edges

      // Get actual menu height if available
      const actualMenuHeight = menuRef.current
        ? menuRef.current.offsetHeight
        : baseMenuHeight;

      let left = position.x - menuWidth - 10;
      let top = position.y;

      // Horizontal positioning
      if (left < padding) {
        left = position.x + 10;
      }
      if (left + menuWidth > viewportWidth - padding) {
        left = viewportWidth - menuWidth - padding;
      }
      // Center horizontally on very small screens
      if (viewportWidth < menuWidth + padding * 2) {
        left = padding;
      }

      // Vertical positioning - CRITICAL FIX for mobile
      // If menu would go below viewport, position it above the trigger point
      if (top + actualMenuHeight > viewportHeight - padding) {
        top = Math.max(padding, viewportHeight - actualMenuHeight - padding);
      }

      // Always ensure minimum top padding
      if (top < padding) {
        top = padding;
      }

      // On mobile, if still doesn't fit, limit height and enable scroll
      if (actualMenuHeight > viewportHeight - padding * 2) {
        top = padding;
      }

      setMenuPosition({ top, left });
    };

    calculatePosition();

    // Recalculate on window resize or orientation change
    const handleResize = () => calculatePosition();
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, [position, isOwnPost, showSaveFolders, baseMenuHeight]);

  const handleSave = async (folder) => {
    try {
      if (onSave) await onSave(folder);
      onClose();
    } catch (error) {
      console.error("Save error:", error);
    }
  };

  const handleCopyLink = async () => {
    try {
      const url = `${window.location.origin}/post/${content?.id}`;
      await navigator.clipboard.writeText(url);

      // Better user feedback
      if (window.innerWidth < 768) {
        alert("Link copied!");
      } else {
        // Could show a toast notification here
        alert("Link copied to clipboard!");
      }
      onClose();
    } catch (error) {
      alert("Failed to copy link");
    }
  };

  const handleDelete = async () => {
    const confirmMessage = `Delete this ${contentType} permanently? This cannot be undone.`;

    if (window.confirm(confirmMessage)) {
      try {
        console.log("🗑️ ActionMenu: Initiating delete for:", content?.id);

        if (!onDelete) {
          console.error("❌ ActionMenu: onDelete handler not provided");
          alert("Delete function not available");
          return;
        }

        if (!content?.id) {
          console.error("❌ ActionMenu: No content ID provided");
          alert("Cannot delete: Invalid post");
          return;
        }

        await onDelete(content.id);
        console.log("✅ ActionMenu: Delete completed successfully");
        onClose();
      } catch (error) {
        console.error("❌ ActionMenu: Delete failed:", error);
        alert(error.message || "Failed to delete. Please try again.");
      }
    }
  };

  const handleEdit = () => {
    if (onEdit) {
      onEdit(content);
    }
    onClose();
  };

  const handleShare = () => {
    if (onShare) {
      onShare(content);
    }
    onClose();
  };

  const handleReport = () => {
    if (
      window.confirm(
        `Report this ${contentType} for violating community guidelines?`,
      )
    ) {
      if (onReport) onReport(content.id);
      alert("Report submitted. We will review it shortly.");
      onClose();
    }
  };

  const handleNotInterested = () => {
    alert("You'll see less content like this");
    onClose();
  };

  return (
    <>
      <div className="action-menu-overlay" onClick={onClose}></div>

      <div
        ref={menuRef}
        className="action-menu"
        style={{
          top: `${menuPosition.top}px`,
          left: `${menuPosition.left}px`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="action-menu-header">
          <span className="action-menu-title">
            {isOwnPost ? `Manage ${contentType}` : `${contentType} Options`}
          </span>
        </div>

        <div className="action-menu-items">
          {isOwnPost ? (
            <>
              <button className="action-item" onClick={handleEdit}>
                <Edit3 size={18} />
                <div className="action-item-content">
                  <div className="action-item-label">Edit {contentType}</div>
                  <div className="action-item-desc">Modify content</div>
                </div>
              </button>

              <button className="action-item" onClick={handleCopyLink}>
                <Copy size={18} />
                <div className="action-item-content">
                  <div className="action-item-label">Copy Link</div>
                  <div className="action-item-desc">Share via link</div>
                </div>
              </button>

              <button className="action-item" onClick={handleShare}>
                <Share2 size={18} />
                <div className="action-item-content">
                  <div className="action-item-label">Share {contentType}</div>
                  <div className="action-item-desc">
                    Share to profile or story
                  </div>
                </div>
              </button>

              <div className="action-divider"></div>

              <button
                className="action-item action-delete"
                onClick={handleDelete}
              >
                <Trash2 size={18} />
                <div className="action-item-content">
                  <div className="action-item-label">Delete {contentType}</div>
                  <div className="action-item-desc">Permanently remove</div>
                </div>
              </button>
            </>
          ) : (
            <>
              <button
                className="action-item"
                onClick={() => setShowSaveFolders(!showSaveFolders)}
              >
                <BookmarkPlus size={18} />
                <div className="action-item-content">
                  <div className="action-item-label">Save {contentType}</div>
                  <div className="action-item-desc">Add to saved items</div>
                </div>
              </button>

              {showSaveFolders && (
                <div className="save-folders-list">
                  {folders.map((folder) => (
                    <button
                      key={folder}
                      className="folder-option"
                      onClick={() => handleSave(folder)}
                    >
                      {folder}
                    </button>
                  ))}
                </div>
              )}

              <button className="action-item" onClick={handleCopyLink}>
                <Copy size={18} />
                <div className="action-item-content">
                  <div className="action-item-label">Copy Link</div>
                  <div className="action-item-desc">Share via link</div>
                </div>
              </button>

              <button className="action-item" onClick={handleShare}>
                <Share2 size={18} />
                <div className="action-item-content">
                  <div className="action-item-label">Share {contentType}</div>
                  <div className="action-item-desc">
                    Share to profile or story
                  </div>
                </div>
              </button>

              <div className="action-divider"></div>

              <button className="action-item" onClick={handleNotInterested}>
                <ThumbsDown size={18} />
                <div className="action-item-content">
                  <div className="action-item-label">Not Interested</div>
                  <div className="action-item-desc">See less like this</div>
                </div>
              </button>

              <div className="action-divider"></div>

              <button
                className="action-item action-report"
                onClick={handleReport}
              >
                <Flag size={18} />
                <div className="action-item-content">
                  <div className="action-item-label">Report {contentType}</div>
                  <div className="action-item-desc">
                    Report inappropriate content
                  </div>
                </div>
              </button>
            </>
          )}

          <div className="action-divider"></div>

          <button className="action-item action-cancel" onClick={onClose}>
            <X size={18} />
            <div className="action-item-content">
              <div className="action-item-label">Cancel</div>
            </div>
          </button>
        </div>
      </div>

      <style jsx>{`
        .action-menu-overlay {
          position: fixed;
          inset: 0;
          z-index: 9998;
          background: rgba(0, 0, 0, 0.3);
          -webkit-tap-highlight-color: transparent;
        }

        .action-menu {
          position: fixed;
          width: ${menuWidth}px;
          max-width: calc(100vw - 32px);
          max-height: calc(100vh - 32px);
          background: #0f0f0f;
          border: 1px solid rgba(132, 204, 22, 0.3);
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.9);
          z-index: 9999;
          overflow: hidden;
          animation: menuSlideIn 0.2s;
          display: flex;
          flex-direction: column;
        }

        @keyframes menuSlideIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .action-menu-header {
          padding: 16px;
          background: rgba(132, 204, 22, 0.05);
          border-bottom: 1px solid rgba(132, 204, 22, 0.2);
          flex-shrink: 0;
        }

        .action-menu-title {
          font-size: 14px;
          font-weight: 700;
          color: #84cc16;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .action-menu-items {
          padding: 8px;
          max-height: calc(100vh - 100px);
          overflow-y: auto;
          overflow-x: hidden;
          -webkit-overflow-scrolling: touch;
          flex: 1;
        }

        /* Better scrollbar for desktop */
        .action-menu-items::-webkit-scrollbar {
          width: 6px;
        }

        .action-menu-items::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 3px;
        }

        .action-menu-items::-webkit-scrollbar-thumb {
          background: rgba(132, 204, 22, 0.3);
          border-radius: 3px;
        }

        .action-menu-items::-webkit-scrollbar-thumb:hover {
          background: rgba(132, 204, 22, 0.5);
        }

        .action-item {
          width: 100%;
          padding: 12px 14px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 10px;
          display: flex;
          align-items: center;
          gap: 12px;
          color: #e5e5e5;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          margin-bottom: 6px;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
        }

        .action-item:hover {
          background: rgba(132, 204, 22, 0.08);
          border-color: rgba(132, 204, 22, 0.3);
          transform: translateX(4px);
        }

        .action-item:active {
          transform: scale(0.98) translateX(4px);
        }

        .action-item svg {
          flex-shrink: 0;
          opacity: 0.8;
        }

        .action-item-content {
          flex: 1;
          text-align: left;
        }

        .action-item-label {
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 2px;
        }

        .action-item-desc {
          font-size: 11px;
          color: #737373;
        }

        .action-delete {
          background: rgba(239, 68, 68, 0.05);
          border-color: rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }

        .action-delete:hover {
          background: rgba(239, 68, 68, 0.15);
          border-color: #ef4444;
        }

        .action-report {
          background: rgba(251, 146, 60, 0.05);
          border-color: rgba(251, 146, 60, 0.2);
          color: #fb923c;
        }

        .action-report:hover {
          background: rgba(251, 146, 60, 0.15);
          border-color: #fb923c;
        }

        .action-cancel {
          background: rgba(115, 115, 115, 0.05);
          border-color: rgba(115, 115, 115, 0.2);
          color: #737373;
        }

        .action-cancel:hover {
          background: rgba(115, 115, 115, 0.15);
          border-color: #737373;
        }

        .action-divider {
          height: 1px;
          background: rgba(255, 255, 255, 0.1);
          margin: 8px 0;
        }

        .save-folders-list {
          padding: 8px;
          background: rgba(132, 204, 22, 0.05);
          border-radius: 8px;
          margin: 0 0 8px 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .folder-option {
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(132, 204, 22, 0.2);
          border-radius: 6px;
          color: #84cc16;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
          -webkit-tap-highlight-color: transparent;
        }

        .folder-option:hover {
          background: rgba(132, 204, 22, 0.2);
          border-color: #84cc16;
        }

        .folder-option:active {
          transform: scale(0.97);
        }

        /* Mobile optimizations */
        @media (max-width: 768px) {
          .action-menu {
            width: calc(100vw - 32px);
          }

          .action-item {
            padding: 14px 12px;
          }

          .action-item-label {
            font-size: 15px;
          }

          .action-item-desc {
            font-size: 12px;
          }
        }

        /* Handle very small screens */
        @media (max-height: 600px) {
          .action-menu-items {
            max-height: calc(100vh - 80px);
          }
        }
      `}</style>
    </>
  );
};

export default ActionMenu;
