import React, { useState, useEffect } from "react";
import {
  Trash2,
  Clock,
  Image,
  Film,
  BookOpen,
  FileText,
  ArrowLeft,
  RefreshCw,
  Check,
} from "lucide-react";
import draftsService from "../../services/drafts/draftsService";
import authService from "../../services/auth/authService";

const Drafts = ({ onLoadDraft, onClose, showToast }) => {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [filterType, setFilterType] = useState("all");

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadDrafts();
    }
  }, [currentUser, filterType]);

  const loadUser = async () => {
    try {
      const user = await authService.getCurrentUser();
      setCurrentUser(user);
    } catch (err) {
      console.error("Failed to load user:", err);
      showToast?.("error", "Error", "Failed to load user data");
    }
  };

  const loadDrafts = async () => {
    try {
      setLoading(true);
      const contentType = filterType === "all" ? null : filterType;
      const data = await draftsService.getDrafts(currentUser.id, contentType);
      setDrafts(data || []);
    } catch (err) {
      console.error("Failed to load drafts:", err);
      showToast?.("error", "Error", "Failed to load drafts");
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDraft = async (draftId, e) => {
    e.stopPropagation();

    if (!window.confirm("Are you sure you want to delete this draft?")) {
      return;
    }

    try {
      await draftsService.deleteDraft(draftId, currentUser.id);
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));
      showToast?.("success", "Draft deleted", "Draft removed successfully");
    } catch (err) {
      console.error("Failed to delete draft:", err);
      showToast?.("error", "Error", "Failed to delete draft");
    }
  };

  const handleLoadDraft = (draft) => {
    if (onLoadDraft) {
      onLoadDraft(draft);
    }
  };

  const getContentIcon = (type) => {
    switch (type) {
      case "post":
        return <Image size={20} />;
      case "reel":
        return <Film size={20} />;
      case "story":
        return <BookOpen size={20} />;
      default:
        return <FileText size={20} />;
    }
  };

  const getContentPreview = (draft) => {
    if (draft.content_type === "post") {
      return draft.post_content?.substring(0, 100) || "No content";
    } else if (draft.content_type === "reel") {
      return draft.reel_caption?.substring(0, 100) || "No caption";
    } else if (draft.content_type === "story") {
      return (
        draft.story_preview?.substring(0, 100) ||
        draft.story_title ||
        "No preview"
      );
    }
    return "No preview available";
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  const getFilteredCount = (type) => {
    if (type === "all") return drafts.length;
    return drafts.filter((d) => d.content_type === type).length;
  };

  const filteredDrafts =
    filterType === "all"
      ? drafts
      : drafts.filter((d) => d.content_type === filterType);

  return (
    <div className="drafts-overlay">
      <div className="drafts-container">
        <div className="drafts-header">
          <div className="drafts-header-top">
            <button className="back-btn" onClick={onClose}>
              <ArrowLeft size={20} />
            </button>
            <h2 className="drafts-title">My Drafts</h2>
            <button
              className="refresh-btn"
              onClick={loadDrafts}
              disabled={loading}
            >
              <RefreshCw size={18} className={loading ? "spinning" : ""} />
            </button>
          </div>

          <div className="drafts-filters">
            <button
              className={`filter-chip ${filterType === "all" ? "active" : ""}`}
              onClick={() => setFilterType("all")}
            >
              All ({getFilteredCount("all")})
            </button>
            <button
              className={`filter-chip ${filterType === "post" ? "active" : ""}`}
              onClick={() => setFilterType("post")}
            >
              <Image size={16} /> Posts ({getFilteredCount("post")})
            </button>
            <button
              className={`filter-chip ${filterType === "reel" ? "active" : ""}`}
              onClick={() => setFilterType("reel")}
            >
              <Film size={16} /> Reels ({getFilteredCount("reel")})
            </button>
            <button
              className={`filter-chip ${filterType === "story" ? "active" : ""}`}
              onClick={() => setFilterType("story")}
            >
              <BookOpen size={16} /> Stories ({getFilteredCount("story")})
            </button>
          </div>
        </div>

        <div className="drafts-content">
          {loading ? (
            <div className="drafts-loading">
              <RefreshCw size={32} className="spinning" />
              <p>Loading drafts...</p>
            </div>
          ) : filteredDrafts.length === 0 ? (
            <div className="drafts-empty">
              <FileText size={48} />
              <h3>No drafts yet</h3>
              <p>
                {filterType === "all"
                  ? "Your saved drafts will appear here"
                  : `No ${filterType} drafts saved`}
              </p>
            </div>
          ) : (
            <div className="drafts-list">
              {filteredDrafts.map((draft) => (
                <div
                  key={draft.id}
                  className="draft-card"
                  onClick={() => handleLoadDraft(draft)}
                >
                  <div className="draft-card-header">
                    <div className="draft-type-badge">
                      {getContentIcon(draft.content_type)}
                      <span>{draft.content_type}</span>
                    </div>
                    <div className="draft-actions">
                      <button
                        className="draft-delete-btn"
                        onClick={(e) => handleDeleteDraft(draft.id, e)}
                        title="Delete draft"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <h3 className="draft-title">{draft.title}</h3>

                  <p className="draft-preview">{getContentPreview(draft)}</p>

                  <div className="draft-meta">
                    <div className="draft-timestamp">
                      <Clock size={14} />
                      <span>{formatDate(draft.updated_at)}</span>
                    </div>

                    {draft.content_type === "post" &&
                      draft.post_images_data?.length > 0 && (
                        <div className="draft-badge">
                          <Image size={14} />
                          <span>
                            {draft.post_images_data.length} image
                            {draft.post_images_data.length > 1 ? "s" : ""}
                          </span>
                        </div>
                      )}

                    {draft.content_type === "reel" && draft.reel_video_data && (
                      <div className="draft-badge">
                        <Film size={14} />
                        <span>Video</span>
                      </div>
                    )}

                    {draft.content_type === "story" && (
                      <div className="draft-badge">
                        <span>{draft.story_unlock_cost || 0} GT</span>
                      </div>
                    )}
                  </div>

                  <div className="draft-load-overlay">
                    <div className="draft-load-btn">
                      <Check size={16} />
                      <span>Load Draft</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Drafts;
