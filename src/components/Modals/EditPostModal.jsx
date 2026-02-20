import React, { useState, useEffect } from "react";
import { X, Globe, Users, Lock, Save } from "lucide-react";
import postService from "../../services/home/postService";

const EditPostModal = ({ post, onClose, onUpdate, currentUser }) => {
  const [content, setContent] = useState(post?.content || "");
  const [category, setCategory] = useState(post?.category || "General");
  const [audience, setAudience] = useState("public"); // public, followers, private
  const [isSaving, setIsSaving] = useState(false);

  const categories = [
    "General",
    "Technology",
    "Entertainment",
    "Sports",
    "News",
    "Art",
    "Music",
    "Food",
    "Travel",
    "Fashion",
    "Gaming",
    "Education",
  ];

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleSave = async () => {
    if (
      !content.trim() &&
      (!post.image_ids || post.image_ids.length === 0) &&
      (!post.video_ids || post.video_ids.length === 0)
    ) {
      alert("Post must have content or media");
      return;
    }

    setIsSaving(true);
    try {
      const updates = {
        content: content.trim(),
        category: category,
      };

      const updatedPost = await postService.updatePost(post.id, updates);

      if (onUpdate) {
        onUpdate(updatedPost);
      }

      onClose();
    } catch (error) {
      console.error("Failed to update post:", error);
      alert("Failed to update post. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="edit-modal-overlay" onClick={onClose}></div>

      <div className="edit-modal-container">
        <div className="edit-modal-header">
          <h2>Edit Post</h2>
          <button className="close-btn" onClick={onClose} disabled={isSaving}>
            <X size={24} />
          </button>
        </div>

        <div className="edit-modal-body">
          {/* Caption */}
          <div className="edit-section">
            <label>Caption</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's on your mind?"
              maxLength={2000}
              disabled={isSaving}
            />
            <div className="char-count">{content.length}/2000</div>
          </div>

          {/* Category */}
          <div className="edit-section">
            <label>Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={isSaving}
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Audience (Read-only for now - future feature) */}
          <div className="edit-section">
            <label>Audience</label>
            <div className="audience-options">
              <div
                className={`audience-option ${audience === "public" ? "active" : ""}`}
              >
                <Globe size={20} />
                <div>
                  <div className="audience-label">Public</div>
                  <div className="audience-desc">Anyone can see this</div>
                </div>
              </div>
            </div>
            <small className="note">
              Note: Media files cannot be changed after posting. Only caption
              and category can be edited.
            </small>
          </div>
        </div>

        <div className="edit-modal-footer">
          <button className="cancel-btn" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button className="save-btn" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <div className="spinner"></div>
                Saving...
              </>
            ) : (
              <>
                <Save size={18} />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      <style jsx>{`
        .edit-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.9);
          z-index: 10000;
          animation: fadeIn 0.2s;
        }

        .edit-modal-container {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 90%;
          max-width: 600px;
          max-height: 90vh;
          background: #1a1a1a;
          border-radius: 16px;
          border: 1px solid rgba(132, 204, 22, 0.3);
          z-index: 10001;
          display: flex;
          flex-direction: column;
          animation: slideUp 0.3s;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translate(-50%, -40%);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%);
          }
        }

        .edit-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px;
          border-bottom: 1px solid rgba(132, 204, 22, 0.2);
        }

        .edit-modal-header h2 {
          font-size: 20px;
          font-weight: 700;
          color: #fff;
          margin: 0;
        }

        .close-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .close-btn:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.2);
          border-color: #ef4444;
        }

        .close-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .edit-modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
        }

        .edit-section {
          margin-bottom: 24px;
        }

        .edit-section label {
          display: block;
          font-size: 14px;
          font-weight: 600;
          color: #84cc16;
          margin-bottom: 8px;
        }

        .edit-section textarea {
          width: 100%;
          min-height: 120px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          color: #fff;
          font-size: 15px;
          line-height: 1.5;
          resize: vertical;
          font-family: inherit;
        }

        .edit-section textarea:focus {
          outline: none;
          border-color: #84cc16;
          background: rgba(132, 204, 22, 0.05);
        }

        .edit-section textarea:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .char-count {
          text-align: right;
          font-size: 12px;
          color: #737373;
          margin-top: 4px;
        }

        .edit-section select {
          width: 100%;
          padding: 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          color: #fff;
          font-size: 14px;
          cursor: pointer;
        }

        .edit-section select:focus {
          outline: none;
          border-color: #84cc16;
        }

        .edit-section select:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .audience-options {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .audience-option {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .audience-option.active {
          background: rgba(132, 204, 22, 0.1);
          border-color: #84cc16;
        }

        .audience-option svg {
          color: #84cc16;
          flex-shrink: 0;
        }

        .audience-label {
          font-size: 14px;
          font-weight: 600;
          color: #fff;
        }

        .audience-desc {
          font-size: 12px;
          color: #737373;
        }

        .note {
          display: block;
          margin-top: 8px;
          font-size: 12px;
          color: #fb923c;
        }

        .edit-modal-footer {
          display: flex;
          gap: 12px;
          padding: 16px 20px;
          border-top: 1px solid rgba(132, 204, 22, 0.2);
        }

        .cancel-btn,
        .save-btn {
          flex: 1;
          padding: 12px 24px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: none;
        }

        .cancel-btn {
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .cancel-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.1);
        }

        .save-btn {
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          color: #000;
        }

        .save-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(132, 204, 22, 0.4);
        }

        .cancel-btn:disabled,
        .save-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(0, 0, 0, 0.2);
          border-top-color: #000;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 768px) {
          .edit-modal-container {
            width: 95%;
            max-height: 95vh;
          }

          .edit-modal-footer {
            flex-direction: column;
          }
        }
      `}</style>
    </>
  );
};

export default EditPostModal;
