// src/components/Modals/ShareModal.jsx — No toast, top 10 recent interactions scrollable X axis, EP on share
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
  Linkedin,
  MessageCircle,
  Mail,
  Send,
} from "lucide-react";
import ShareModel from "../../models/ShareModel";
import { supabase } from "../../services/config/supabase";
import mediaUrlService from "../../services/shared/mediaUrlService";

const EP_SHARE_REWARD = 10;

async function deductEP(userId, amount, reason) {
  const { data } = await supabase.rpc("deduct_ep", {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
  });
  return !!data;
}

const ShareModal = ({ content, onClose, currentUser }) => {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [recentFollowers, setRecentFollowers] = useState([]);
  const [loadingFollowers, setLoadingFollowers] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [feedback, setFeedback] = useState(null); // {type:'ok'|'err', msg}

  const shareUrl = `${window.location.origin}/${content.type}/${content.id}`;
  const shareText =
    content.type === "profile"
      ? `Check out ${content.name}'s profile on Xeevia!`
      : `Check out this ${content.type} on Xeevia!`;

  const showFeedback = (type, msg) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 2800);
  };

  useEffect(() => {
    if (currentUser?.id) loadRecentFollowers();
    else setLoadingFollowers(false);
  }, [currentUser?.id]);

  // Top 10 people we FOLLOW that we've interacted with most recently
  const loadRecentFollowers = async () => {
    try {
      setLoadingFollowers(true);

      // Get who we follow
      const { data: following } = await supabase
        .from("follows")
        .select(
          "following_id, profiles!follows_following_id_fkey(id,full_name,username,avatar_id,verified)",
        )
        .eq("follower_id", currentUser.id)
        .limit(80);

      if (!following?.length) {
        setRecentFollowers([]);
        return;
      }

      const followingIds = following.map((f) => f.following_id);

      // Get recent interactions (comments, likes) with these users' content
      const [{ data: commentData }, { data: likeData }] = await Promise.all([
        supabase
          .from("comments")
          .select("user_id, created_at")
          .eq("user_id", currentUser.id)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("post_likes")
          .select("user_id, created_at, posts(user_id)")
          .eq("user_id", currentUser.id)
          .order("created_at", { ascending: false })
          .limit(200),
      ]);

      // Score by recency — we want people whose content WE engaged with
      const scores = {};
      const now = Date.now();

      (commentData || []).forEach((c) => {
        // We can't easily get who owns the post from comments alone, so score the commenter by recency
        const decay = Math.max(
          0,
          100 -
            (now - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24),
        );
        if (!scores[c.user_id]) scores[c.user_id] = 0;
        scores[c.user_id] += decay + 20;
      });

      // Rank the people we follow
      const ranked = following
        .map((f) => {
          const p = f.profiles;
          return {
            id: p.id,
            name: p.full_name || "User",
            username: p.username || "",
            avatar: p.avatar_id
              ? mediaUrlService.getAvatarUrl?.(p.avatar_id, 160)
              : null,
            verified: p.verified,
            score: scores[p.id] || Math.random() * 10,
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

      setRecentFollowers(ranked);
    } catch (e) {
      console.error("loadRecentFollowers:", e);
      setRecentFollowers([]);
    } finally {
      setLoadingFollowers(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      showFeedback("ok", "Link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showFeedback("err", "Could not copy link");
    }
  };

  const handleShare = async (shareType) => {
    if (!currentUser?.id) return;
    try {
      setSharing(true);
      await ShareModel.shareContent(
        content.type,
        content.id,
        currentUser.id,
        shareType,
      );
      // Award sharer EP
      await supabase.rpc("award_ep", {
        p_user_id: currentUser.id,
        p_amount: EP_SHARE_REWARD,
        p_reason: "shared_content",
      });
      showFeedback("ok", `Shared! +${EP_SHARE_REWARD} EP earned`);
      setTimeout(() => onClose(), 1400);
    } catch {
      showFeedback("err", "Failed to share");
    } finally {
      setSharing(false);
    }
  };

  const handleExternalShare = (platform) => {
    const links = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(shareText + " " + shareUrl)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
      email: `mailto:?subject=${encodeURIComponent("Check this on Xeevia")}&body=${encodeURIComponent(shareText + "\n\n" + shareUrl)}`,
    };
    if (links[platform]) {
      window.open(links[platform], "_blank", "width=600,height=600");
      handleShare("external");
    }
  };

  const toggleUser = (id) =>
    setSelectedUsers((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : [...p, id],
    );

  const handleSendToSelected = async () => {
    if (!selectedUsers.length) return;
    try {
      setSharing(true);
      await handleShare("direct");
    } finally {
      setSharing(false);
    }
  };

  return (
    <>
      <div className="share-modal-overlay" onClick={onClose}>
        <div className="share-modal" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="share-modal-header">
            <h3>Share</h3>
            <button onClick={onClose}>
              <X size={22} />
            </button>
          </div>

          {/* Feedback bar */}
          {feedback && (
            <div
              style={{
                margin: "0 20px 0",
                padding: "9px 14px",
                borderRadius: 10,
                background:
                  feedback.type === "ok"
                    ? "rgba(132,204,22,.1)"
                    : "rgba(239,68,68,.1)",
                border: `1px solid ${feedback.type === "ok" ? "rgba(132,204,22,.3)" : "rgba(239,68,68,.3)"}`,
                color: feedback.type === "ok" ? "#a3e635" : "#f87171",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {feedback.msg}
            </div>
          )}

          {/* Top 10 recent interactions — horizontal scrollable */}
          {currentUser?.id && (
            <>
              <div className="share-section-title">
                People you interact with
              </div>
              <div style={{ padding: "0 20px 4px" }}>
                {loadingFollowers ? (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      padding: "24px 0",
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        border: "3px solid rgba(132,204,22,.2)",
                        borderTopColor: "#84cc16",
                        borderRadius: "50%",
                        animation: "spin .8s linear infinite",
                      }}
                    />
                    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                  </div>
                ) : recentFollowers.length > 0 ? (
                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      overflowX: "auto",
                      paddingBottom: 8,
                      scrollbarWidth: "none",
                    }}
                  >
                    <style>{`.share-people::-webkit-scrollbar{display:none}`}</style>
                    {recentFollowers.map((f) => (
                      <div
                        key={f.id}
                        onClick={() => toggleUser(f.id)}
                        style={{
                          flexShrink: 0,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 6,
                          cursor: "pointer",
                          width: 60,
                        }}
                      >
                        <div
                          style={{
                            position: "relative",
                            width: 52,
                            height: 52,
                            borderRadius: "50%",
                            background:
                              "linear-gradient(135deg,#84cc16,#65a30d)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 20,
                            color: "#000",
                            fontWeight: 700,
                            overflow: "hidden",
                            border: selectedUsers.includes(f.id)
                              ? "2.5px solid #c8f542"
                              : "2.5px solid transparent",
                            boxShadow: selectedUsers.includes(f.id)
                              ? "0 0 0 2px rgba(200,245,66,.3)"
                              : "none",
                            transition: "all .2s",
                          }}
                        >
                          {f.avatar ? (
                            <img
                              src={f.avatar}
                              alt={f.name}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                              }}
                            />
                          ) : (
                            f.name.charAt(0).toUpperCase()
                          )}
                          {selectedUsers.includes(f.id) && (
                            <div
                              style={{
                                position: "absolute",
                                inset: 0,
                                background: "rgba(0,0,0,.45)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Check size={20} color="#c8f542" />
                            </div>
                          )}
                        </div>
                        <span
                          style={{
                            fontSize: 10,
                            color: "#a3a3a3",
                            textAlign: "center",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            width: 56,
                            fontWeight: 600,
                          }}
                        >
                          {f.name.split(" ")[0]}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p
                    style={{
                      color: "#52525b",
                      fontSize: 13,
                      padding: "12px 0",
                    }}
                  >
                    Follow people to share with them
                  </p>
                )}
              </div>

              {selectedUsers.length > 0 && (
                <button
                  onClick={handleSendToSelected}
                  disabled={sharing}
                  style={{
                    margin: "8px 20px 0",
                    width: "calc(100% - 40px)",
                    padding: "13px",
                    background: "linear-gradient(135deg,#84cc16,#65a30d)",
                    border: "none",
                    borderRadius: 12,
                    color: "#000",
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <Send size={16} /> Send to {selectedUsers.length} person
                  {selectedUsers.length > 1 ? "s" : ""}
                </button>
              )}

              <div className="share-divider">
                <span>or share via</span>
              </div>
            </>
          )}

          {/* Share options */}
          <div className="share-options">
            <button
              className="share-option"
              onClick={() => handleShare("profile")}
              disabled={sharing}
            >
              <div className="share-option-icon">
                <Users size={22} />
              </div>
              <div className="share-option-text">
                <div className="share-option-title">Share to Profile</div>
                <div className="share-option-desc">
                  Post to your feed · +{EP_SHARE_REWARD} EP
                </div>
              </div>
            </button>
            <button
              className="share-option"
              onClick={() => handleShare("story")}
              disabled={sharing}
            >
              <div className="share-option-icon">
                <Share2 size={22} />
              </div>
              <div className="share-option-text">
                <div className="share-option-title">Share to Story</div>
                <div className="share-option-desc">
                  Add to your story · +{EP_SHARE_REWARD} EP
                </div>
              </div>
            </button>
          </div>

          {/* External platforms */}
          <div className="external-platforms">
            {[
              ["whatsapp", <MessageCircle size={18} />],
              ["facebook", <Facebook size={18} />],
              ["twitter", <Twitter size={18} />],
              ["telegram", <Send size={18} />],
              ["linkedin", <Linkedin size={18} />],
              ["email", <Mail size={18} />],
            ].map(([p, icon]) => (
              <button
                key={p}
                className="platform-btn"
                onClick={() => handleExternalShare(p)}
              >
                {icon}
              </button>
            ))}
          </div>

          <div className="share-divider">
            <span>or copy link</span>
          </div>

          {/* Copy link */}
          <div className="share-link-section">
            <div className="share-link-box">
              <div className="link-icon">
                <Globe size={16} />
              </div>
              <input type="text" value={shareUrl} readOnly />
              <button className="copy-link-btn" onClick={handleCopyLink}>
                {copied ? <Check size={18} /> : <Copy size={18} />}
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
          max-width: 500px;
          max-height: 88vh;
          background: #000;
          border: 1px solid rgba(132, 204, 22, 0.28);
          border-radius: 20px;
          overflow-y: auto;
          animation: slideUp 0.3s ease;
          display: flex;
          flex-direction: column;
          gap: 0;
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
        .share-modal::-webkit-scrollbar {
          width: 5px;
        }
        .share-modal::-webkit-scrollbar-thumb {
          background: rgba(132, 204, 22, 0.25);
          border-radius: 3px;
        }
        .share-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 18px 20px;
          border-bottom: 1px solid rgba(132, 204, 22, 0.18);
          background: rgba(132, 204, 22, 0.04);
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .share-modal-header h3 {
          font-size: 17px;
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
          transition: color 0.2s;
        }
        .share-modal-header button:hover {
          color: #84cc16;
        }
        .share-section-title {
          padding: 14px 20px 6px;
          font-size: 11px;
          font-weight: 700;
          color: #737373;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .share-options {
          padding: 4px 20px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .share-option {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          width: 100%;
          text-align: left;
        }
        .share-option:hover:not(:disabled) {
          background: rgba(132, 204, 22, 0.08);
          border-color: rgba(132, 204, 22, 0.28);
          transform: translateX(3px);
        }
        .share-option:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .share-option-icon {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          background: rgba(132, 204, 22, 0.18);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #84cc16;
          flex-shrink: 0;
        }
        .share-option-title {
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          margin-bottom: 3px;
        }
        .share-option-desc {
          font-size: 12px;
          color: #737373;
        }
        .external-platforms {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 10px;
          padding: 10px 20px;
        }
        .platform-btn {
          aspect-ratio: 1;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .platform-btn:hover {
          background: rgba(132, 204, 22, 0.1);
          border-color: rgba(132, 204, 22, 0.28);
          transform: translateY(-2px);
        }
        .share-divider {
          display: flex;
          align-items: center;
          padding: 10px 20px;
        }
        .share-divider::before,
        .share-divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: rgba(255, 255, 255, 0.08);
        }
        .share-divider span {
          padding: 0 10px;
          color: #737373;
          font-size: 12px;
        }
        .share-link-section {
          padding: 0 20px 20px;
        }
        .share-link-box {
          display: flex;
          gap: 7px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(132, 204, 22, 0.18);
          border-radius: 12px;
          padding: 4px;
          align-items: center;
        }
        .link-icon {
          width: 36px;
          height: 36px;
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
          padding: 10px 7px;
          background: none;
          border: none;
          color: #fff;
          font-size: 13px;
          outline: none;
        }
        .copy-link-btn {
          width: 42px;
          height: 42px;
          border-radius: 8px;
          background: linear-gradient(135deg, #84cc16, #65a30d);
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
          transform: scale(1.06);
        }
        @media (max-width: 768px) {
          .share-modal {
            width: 100%;
            max-width: 100%;
            border-radius: 20px 20px 0 0;
            position: fixed;
            bottom: 0;
            max-height: 88vh;
          }
        }
      `}</style>
    </>
  );
};

export default ShareModal;
