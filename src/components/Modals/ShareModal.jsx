// ============================================================================
// src/components/Modals/ShareModal.jsx - ENHANCED VERSION
// ============================================================================

import React, { useState, useEffect } from "react";
import {
  X,
  Copy,
  Users,
  Globe,
  Check,
  Share2,
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  MessageCircle,
  Mail,
  Send,
} from "lucide-react";
import ShareModel from "../../models/ShareModel";
import { supabase } from "../../services/config/supabase";
import mediaUrlService from "../../services/shared/mediaUrlService";
import { useToast } from "../../contexts/ToastContext";

const ShareModal = ({ content, onClose, currentUser }) => {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [mutualFollowers, setMutualFollowers] = useState([]);
  const [loadingFollowers, setLoadingFollowers] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const { showToast } = useToast();

  const shareUrl = `${window.location.origin}/${content.type}/${content.id}`;
  const shareTitle = `Check out this ${content.type} on Grova`;
  const shareText =
    content.type === "profile"
      ? `Check out ${content.name}'s profile on Grova!`
      : `Check out this amazing ${content.type} on Grova!`;

  useEffect(() => {
    if (currentUser?.id) {
      loadMutualFollowers();
    } else {
      setLoadingFollowers(false);
    }
  }, [currentUser?.id]);

  const loadMutualFollowers = async () => {
    try {
      setLoadingFollowers(true);

      // Get users that current user follows
      const { data: following, error: followingError } = await supabase
        .from("follows")
        .select(
          `
          following_id,
          created_at,
          profiles!follows_following_id_fkey (
            id,
            full_name,
            username,
            avatar_id,
            verified
          )
        `,
        )
        .eq("follower_id", currentUser.id);

      if (followingError) throw followingError;

      if (!following || following.length === 0) {
        setMutualFollowers([]);
        return;
      }

      const followingIds = following.map((f) => f.following_id);

      // Get users that also follow current user back (mutual)
      const { data: followers, error: followersError } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("following_id", currentUser.id)
        .in("follower_id", followingIds);

      if (followersError) throw followersError;

      const mutualIds = followers?.map((f) => f.follower_id) || [];

      // Get engagement data for ranking
      const { data: engagementData, error: engagementError } = await supabase
        .from("comment_likes")
        .select("user_id, created_at")
        .eq("user_id", mutualIds)
        .order("created_at", { ascending: false })
        .limit(100);

      // Calculate engagement scores
      const engagementScores = {};
      const now = Date.now();

      engagementData?.forEach((engagement) => {
        const userId = engagement.user_id;
        const engagementTime = new Date(engagement.created_at).getTime();
        const recencyScore = Math.max(
          0,
          100 - (now - engagementTime) / (1000 * 60 * 60 * 24),
        ); // Decay over days

        if (!engagementScores[userId]) {
          engagementScores[userId] = { count: 0, recency: 0 };
        }

        engagementScores[userId].count += 1;
        engagementScores[userId].recency = Math.max(
          engagementScores[userId].recency,
          recencyScore,
        );
      });

      // Map and rank followers
      const rankedFollowers = following
        .filter((f) => mutualIds.includes(f.following_id))
        .map((f) => {
          const profile = f.profiles;
          const engagement = engagementScores[f.following_id] || {
            count: 0,
            recency: 0,
          };
          const score = engagement.count * 10 + engagement.recency;

          return {
            id: profile.id,
            name: profile.full_name || "User",
            username: profile.username || "user",
            avatar: profile.avatar_id
              ? mediaUrlService.getAvatarUrl(profile.avatar_id, 200)
              : null,
            verified: profile.verified || false,
            engagementScore: score,
          };
        })
        .sort((a, b) => b.engagementScore - a.engagementScore)
        .slice(0, 8); // Top 8 mutual followers

      setMutualFollowers(rankedFollowers);
    } catch (error) {
      console.error("Failed to load mutual followers:", error);
      setMutualFollowers([]);
    } finally {
      setLoadingFollowers(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      showToast("success", "Link copied to clipboard!");

      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      showToast("error", "Failed to copy link");
    }
  };

  const handleShare = async (shareType) => {
    if (!currentUser?.id) {
      showToast("warning", "Please login to share");
      return;
    }

    try {
      setSharing(true);

      await ShareModel.shareContent(
        content.type,
        content.id,
        currentUser.id,
        shareType,
      );

      showToast("success", "Shared successfully!", "+10 EP earned");

      setTimeout(() => onClose(), 1000);
    } catch (error) {
      console.error("Share error:", error);
      showToast("error", "Failed to share");
    } finally {
      setSharing(false);
    }
  };

  const handleExternalShare = (platform) => {
    let shareLink = "";

    switch (platform) {
      case "facebook":
        shareLink = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
        break;
      case "twitter":
        shareLink = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
        break;
      case "linkedin":
        shareLink = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
        break;
      case "whatsapp":
        shareLink = `https://wa.me/?text=${encodeURIComponent(shareText + " " + shareUrl)}`;
        break;
      case "telegram":
        shareLink = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
        break;
      case "email":
        shareLink = `mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(shareText + "\n\n" + shareUrl)}`;
        break;
      default:
        break;
    }

    if (shareLink) {
      window.open(shareLink, "_blank", "width=600,height=600");
      handleShare("external");
    }
  };

  const toggleUserSelection = (userId) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const handleSendToSelected = async () => {
    if (selectedUsers.length === 0) {
      showToast("warning", "Please select users to share with");
      return;
    }

    try {
      setSharing(true);

      // Share to selected users (implement direct message logic here)
      await handleShare("direct");

      showToast("success", `Shared with ${selectedUsers.length} user(s)!`);
      setTimeout(() => onClose(), 1000);
    } catch (error) {
      showToast("error", "Failed to send");
    } finally {
      setSharing(false);
    }
  };

  return (
    <>
      <div className="share-modal-overlay" onClick={onClose}>
        <div className="share-modal" onClick={(e) => e.stopPropagation()}>
          <div className="share-modal-header">
            <h3>Share</h3>
            <button onClick={onClose}>
              <X size={24} />
            </button>
          </div>

          {/* Mutual Followers Section */}
          {currentUser?.id && (
            <>
              <div className="share-section-title">Share with friends</div>
              <div className="mutual-followers-section">
                {loadingFollowers ? (
                  <div className="followers-loading">
                    <div className="mini-spinner"></div>
                  </div>
                ) : mutualFollowers.length > 0 ? (
                  <div className="followers-grid">
                    {mutualFollowers.map((follower) => (
                      <div
                        key={follower.id}
                        className={`follower-card ${selectedUsers.includes(follower.id) ? "selected" : ""}`}
                        onClick={() => toggleUserSelection(follower.id)}
                      >
                        <div className="follower-avatar">
                          {follower.avatar ? (
                            <img src={follower.avatar} alt={follower.name} />
                          ) : (
                            follower.name.charAt(0).toUpperCase()
                          )}
                          {selectedUsers.includes(follower.id) && (
                            <div className="follower-check">
                              <Check size={16} />
                            </div>
                          )}
                        </div>
                        <div className="follower-name">{follower.name}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-followers">
                    <p>No mutual followers found</p>
                  </div>
                )}
              </div>

              {selectedUsers.length > 0 && (
                <button
                  className="send-to-selected-btn"
                  onClick={handleSendToSelected}
                >
                  <Send size={18} />
                  <span>Send to {selectedUsers.length} user(s)</span>
                </button>
              )}

              <div className="share-divider">
                <span>or share via</span>
              </div>
            </>
          )}

          {/* Share Options */}
          <div className="share-options">
            <button
              className="share-option"
              onClick={() => handleShare("profile")}
              disabled={sharing}
            >
              <div className="share-option-icon">
                <Users size={24} />
              </div>
              <div className="share-option-text">
                <div className="share-option-title">Share to Profile</div>
                <div className="share-option-desc">Post to your feed</div>
              </div>
            </button>

            <button
              className="share-option"
              onClick={() => handleShare("story")}
              disabled={sharing}
            >
              <div className="share-option-icon">
                <Share2 size={24} />
              </div>
              <div className="share-option-text">
                <div className="share-option-title">Share to Story</div>
                <div className="share-option-desc">Add to your story</div>
              </div>
            </button>
          </div>

          {/* External Platforms */}
          <div className="external-platforms">
            <button
              className="platform-btn"
              onClick={() => handleExternalShare("whatsapp")}
            >
              <MessageCircle size={20} />
            </button>
            <button
              className="platform-btn"
              onClick={() => handleExternalShare("facebook")}
            >
              <Facebook size={20} />
            </button>
            <button
              className="platform-btn"
              onClick={() => handleExternalShare("twitter")}
            >
              <Twitter size={20} />
            </button>
            <button
              className="platform-btn"
              onClick={() => handleExternalShare("telegram")}
            >
              <Send size={20} />
            </button>
            <button
              className="platform-btn"
              onClick={() => handleExternalShare("linkedin")}
            >
              <Linkedin size={20} />
            </button>
            <button
              className="platform-btn"
              onClick={() => handleExternalShare("email")}
            >
              <Mail size={20} />
            </button>
          </div>

          <div className="share-divider">
            <span>or copy link</span>
          </div>

          {/* Copy Link Section */}
          <div className="share-link-section">
            <div className="share-link-box">
              <div className="link-icon">
                <Globe size={18} />
              </div>
              <input type="text" value={shareUrl} readOnly />
              <button className="copy-link-btn" onClick={handleCopyLink}>
                {copied ? <Check size={20} /> : <Copy size={20} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .share-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.95);
          backdrop-filter: blur(20px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .share-modal {
          width: 90%;
          max-width: 520px;
          max-height: 90vh;
          background: #000;
          border: 1px solid rgba(132, 204, 22, 0.3);
          border-radius: 20px;
          overflow-y: auto;
          animation: slideUp 0.3s ease;
        }

        .share-modal::-webkit-scrollbar {
          width: 6px;
        }

        .share-modal::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
        }

        .share-modal::-webkit-scrollbar-thumb {
          background: rgba(132, 204, 22, 0.3);
          border-radius: 3px;
        }

        @keyframes slideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .share-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid rgba(132, 204, 22, 0.2);
          background: rgba(132, 204, 22, 0.05);
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .share-modal-header h3 {
          font-size: 18px;
          font-weight: 700;
          color: #fff;
          margin: 0;
        }

        .share-modal-header button {
          background: none;
          border: none;
          color: #737373;
          cursor: pointer;
          padding: 4px;
          transition: all 0.2s;
        }

        .share-modal-header button:hover {
          color: #84cc16;
        }

        .share-section-title {
          padding: 16px 20px 8px;
          font-size: 13px;
          font-weight: 600;
          color: #737373;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .mutual-followers-section {
          padding: 8px 20px 16px;
        }

        .followers-loading {
          display: flex;
          justify-content: center;
          padding: 40px 0;
        }

        .mini-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid rgba(132, 204, 22, 0.2);
          border-top-color: #84cc16;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .followers-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        @media (max-width: 500px) {
          .followers-grid {
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
          }
        }

        .follower-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 12px 8px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .follower-card:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(132, 204, 22, 0.3);
        }

        .follower-card.selected {
          background: rgba(132, 204, 22, 0.1);
          border-color: rgba(132, 204, 22, 0.5);
        }

        .follower-avatar {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 20px;
          color: #000;
          position: relative;
          overflow: hidden;
        }

        .follower-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .follower-check {
          position: absolute;
          bottom: -2px;
          right: -2px;
          width: 24px;
          height: 24px;
          background: #84cc16;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #000;
          border: 2px solid #000;
        }

        .follower-name {
          font-size: 12px;
          font-weight: 600;
          color: #fff;
          text-align: center;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          width: 100%;
        }

        .no-followers {
          text-align: center;
          padding: 40px 20px;
          color: #737373;
          font-size: 14px;
        }

        .send-to-selected-btn {
          margin: 0 20px 16px;
          width: calc(100% - 40px);
          padding: 14px;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          color: #000;
          border: none;
          border-radius: 12px;
          font-weight: 700;
          font-size: 15px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s;
        }

        .send-to-selected-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(132, 204, 22, 0.4);
        }

        .share-options {
          padding: 8px 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .share-option {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          width: 100%;
          text-align: left;
        }

        .share-option:hover:not(:disabled) {
          background: rgba(132, 204, 22, 0.1);
          border-color: rgba(132, 204, 22, 0.3);
          transform: translateX(4px);
        }

        .share-option:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .share-option-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: rgba(132, 204, 22, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #84cc16;
          flex-shrink: 0;
        }

        .share-option-text {
          flex: 1;
        }

        .share-option-title {
          font-size: 15px;
          font-weight: 600;
          color: #fff;
          margin-bottom: 4px;
        }

        .share-option-desc {
          font-size: 13px;
          color: #737373;
        }

        .external-platforms {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 12px;
          padding: 16px 20px;
        }

        @media (max-width: 500px) {
          .external-platforms {
            grid-template-columns: repeat(6, 1fr);
            gap: 8px;
          }
        }

        .platform-btn {
          width: 100%;
          aspect-ratio: 1;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .platform-btn:hover {
          background: rgba(132, 204, 22, 0.1);
          border-color: rgba(132, 204, 22, 0.3);
          transform: translateY(-2px);
        }

        .share-divider {
          display: flex;
          align-items: center;
          padding: 16px 20px;
        }

        .share-divider::before,
        .share-divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: rgba(255, 255, 255, 0.1);
        }

        .share-divider span {
          padding: 0 12px;
          color: #737373;
          font-size: 13px;
        }

        .share-link-section {
          padding: 0 20px 20px;
        }

        .share-link-box {
          display: flex;
          gap: 8px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(132, 204, 22, 0.2);
          border-radius: 12px;
          padding: 4px;
          align-items: center;
        }

        .link-icon {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          background: rgba(132, 204, 22, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #84cc16;
          flex-shrink: 0;
        }

        .share-link-box input {
          flex: 1;
          padding: 12px 8px;
          background: none;
          border: none;
          color: #fff;
          font-size: 14px;
          outline: none;
        }

        .copy-link-btn {
          width: 48px;
          height: 48px;
          border-radius: 8px;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          border: none;
          color: #000;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .copy-link-btn:hover {
          transform: scale(1.05);
        }

        @media (max-width: 768px) {
          .share-modal {
            width: 100%;
            max-width: 100%;
            border-radius: 20px 20px 0 0;
            position: fixed;
            bottom: 0;
            max-height: 85vh;
          }
        }
      `}</style>
    </>
  );
};

export default ShareModal;
