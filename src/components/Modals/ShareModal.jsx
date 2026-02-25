// ============================================================================
// src/components/Modals/ShareModal.jsx - FIXED
// - Top 3 recent interactions (from DMs / follows)
// - Working user search
// - All social platform links work correctly
// ============================================================================

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Send,
  Link2,
  Twitter,
  Facebook,
  MessageCircle,
  Check,
  Search,
  Loader,
  ExternalLink,
} from "lucide-react";
import { supabase } from "../../services/config/supabase";
import postService from "../../services/home/postService";
import reelService from "../../services/home/reelService";
import storyService from "../../services/home/storyService";
import mediaUrlService from "../../services/shared/mediaUrlService";

// ─── AVATAR ──────────────────────────────────────────────────────────────────
const Avatar = ({ profile, size = 40 }) => {
  const avatarUrl = profile?.avatar_id
    ? mediaUrlService.getAvatarUrl(profile.avatar_id, size * 2)
    : null;
  const letter = (profile?.full_name || profile?.username || "?")[0]?.toUpperCase();

  return (
    <div
      className="sm-avatar"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt={profile?.full_name} />
      ) : (
        <span>{letter}</span>
      )}
    </div>
  );
};

// ─── SHARE MODAL ─────────────────────────────────────────────────────────────
const ShareModal = ({
  content,
  contentType = "post",
  currentUser,
  onClose,
}) => {
  const [topInteractions, setTopInteractions] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [shareMessage, setShareMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [toast, setToast] = useState(null);
  const searchTimeout = useRef(null);

  const shareUrl = `${window.location.origin}/${contentType}/${content?.id}`;

  // ── Load top 3 recent DM contacts on mount ────────────────────────────────
  useEffect(() => {
    const load = async () => {
      if (!currentUser?.id) {
        setLoadingContacts(false);
        return;
      }
      try {
        let service = postService;
        if (contentType === "reel") service = reelService;
        if (contentType === "story") service = storyService;

        // Get top 3 recent interactions
        const top = await service.getTopInteractions(currentUser.id, 3);
        setTopInteractions(top);
      } catch (e) {
        console.error("Failed to load top interactions:", e);
        setTopInteractions([]);
      } finally {
        setLoadingContacts(false);
      }
    };
    load();
  }, [currentUser, contentType]);

  // ── Search users ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const q = searchQuery.trim();
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, username, avatar_id, verified")
          .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
          .neq("id", currentUser?.id || "00000000-0000-0000-0000-000000000000")
          .is("deleted_at", null)
          .limit(8);

        if (error) throw error;
        setSearchResults(data || []);
      } catch (e) {
        console.error("Search error:", e);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(searchTimeout.current);
  }, [searchQuery, currentUser]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const toggleUser = (profile) => {
    setSelectedUsers((prev) =>
      prev.find((u) => u.id === profile.id)
        ? prev.filter((u) => u.id !== profile.id)
        : [...prev, profile]
    );
  };

  const isSelected = (id) => selectedUsers.some((u) => u.id === id);

  // ── Send DMs ──────────────────────────────────────────────────────────────
  const handleSendDMs = async () => {
    if (selectedUsers.length === 0 || !currentUser?.id) return;
    try {
      setSending(true);
      const contentPreview =
        content?.title ||
        content?.caption ||
        content?.content ||
        "Check this out!";
      const shortPreview = contentPreview.substring(0, 60);
      const shareLink = shareMessage
        ? `📎 Shared a ${contentType}: "${shortPreview}${contentPreview.length > 60 ? "..." : ""}"\n${shareUrl}\n\n${shareMessage}`
        : `📎 Shared a ${contentType}: "${shortPreview}${contentPreview.length > 60 ? "..." : ""}"\n${shareUrl}`;

      await Promise.all(
        selectedUsers.map(async (user) => {
          // Find or create conversation
          const { data: existingConv } = await supabase
            .from("conversations")
            .select("id")
            .or(
              `and(user1_id.eq.${currentUser.id},user2_id.eq.${user.id}),and(user1_id.eq.${user.id},user2_id.eq.${currentUser.id})`
            )
            .maybeSingle();

          let convId = existingConv?.id;

          if (!convId) {
            const { data: newConv, error: convError } = await supabase
              .from("conversations")
              .insert([{ user1_id: currentUser.id, user2_id: user.id }])
              .select("id")
              .single();
            if (convError) throw convError;
            convId = newConv?.id;
          }

          if (!convId) throw new Error("Could not create conversation");

          // Send message
          const { error: msgError } = await supabase.from("messages").insert([{
            conversation_id: convId,
            sender_id: currentUser.id,
            content: shareLink,
          }]);
          if (msgError) throw msgError;

          // Update conversation timestamp
          await supabase
            .from("conversations")
            .update({ last_message_at: new Date().toISOString() })
            .eq("id", convId);
        })
      );

      // Record share (non-blocking)
      try {
        if (contentType === "post") await postService.sharePost?.(content.id, "direct");
        else if (contentType === "reel") await reelService.shareReel?.(content.id, "direct");
        else if (contentType === "story") await storyService.shareStory?.(content.id, "direct");
      } catch (e) { /* non-blocking */ }

      setSent(true);
      showToast(`Sent to ${selectedUsers.length} person${selectedUsers.length > 1 ? "s" : ""}!`);
      setTimeout(onClose, 1800);
    } catch (e) {
      console.error("Send DM error:", e);
      showToast("Failed to send. Try again.", "error");
    } finally {
      setSending(false);
    }
  };

  // ── Copy link ─────────────────────────────────────────────────────────────
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      showToast("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      try {
        const ta = document.createElement("textarea");
        ta.value = shareUrl;
        ta.style.cssText = "position:fixed;opacity:0;pointer-events:none";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        showToast("Link copied!");
        setTimeout(() => setCopied(false), 2500);
      } catch {
        showToast("Could not copy link", "error");
      }
    }
  };

  // ── External social share - all properly wired ───────────────────────────
  const shareExternal = async (platform) => {
    const title = content?.title || content?.caption || content?.content || "Check this out on Grova!";
    const shortTitle = title.substring(0, 120);
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(shortTitle);

    const platformUrls = {
      twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`${shortTitle}\n${shareUrl}`)}`,
      telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    };

    const url = platformUrls[platform];
    if (!url) return;

    window.open(url, "_blank", "width=600,height=500,noopener,noreferrer");

    // Record as external share (non-blocking)
    try {
      if (contentType === "post") await postService.sharePost?.(content.id, "external");
      else if (contentType === "reel") await reelService.shareReel?.(content.id, "external");
      else if (contentType === "story") await storyService.shareStory?.(content.id, "external");
    } catch (e) { /* non-blocking */ }
  };

  // ── Native share (mobile) ─────────────────────────────────────────────────
  const handleNativeShare = async () => {
    if (!navigator.share) {
      handleCopyLink();
      return;
    }
    try {
      await navigator.share({
        title: content?.title || "Check this out on Grova!",
        text: content?.caption || content?.content || "",
        url: shareUrl,
      });
    } catch (e) {
      if (e.name !== "AbortError") console.error("Native share error:", e);
    }
  };

  // Close on overlay click
  useEffect(() => {
    const handle = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [onClose]);

  const displayUsers = searchQuery.trim() ? searchResults : topInteractions;
  const noResults = searchQuery.trim() && !searching && searchResults.length === 0;

  return (
    <>
      <div className="sm-overlay" onClick={onClose} />

      <div className="sm-modal" onClick={(e) => e.stopPropagation()}>
        {/* Toast */}
        {toast && (
          <div className={`sm-toast ${toast.type === "error" ? "sm-toast-error" : ""}`}>
            {toast.type === "success" ? <Check size={13} /> : <X size={13} />}
            <span>{toast.msg}</span>
          </div>
        )}

        {/* Header */}
        <div className="sm-header">
          <h3 className="sm-title">Share {contentType}</h3>
          <button className="sm-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Search bar */}
        <div className="sm-search-wrap">
          <div className="sm-search-row">
            <Search size={15} className="sm-search-icon" />
            <input
              className="sm-search"
              type="text"
              placeholder="Search people by name or username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
            />
            {searching && <Loader size={14} className="sm-spin" />}
            {searchQuery && !searching && (
              <button
                className="sm-search-clear"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Contacts section */}
        <div className="sm-contacts-section">
          {!searchQuery && (
            <p className="sm-section-label">
              {loadingContacts
                ? "Loading recent contacts..."
                : topInteractions.length > 0
                ? "Recent conversations"
                : "People you follow"}
            </p>
          )}
          {searchQuery && !searching && (
            <p className="sm-section-label">
              {searchResults.length > 0
                ? `${searchResults.length} result${searchResults.length > 1 ? "s" : ""}`
                : "No results"}
            </p>
          )}

          {noResults && (
            <div className="sm-no-results">
              <span>No users found for "{searchQuery}"</span>
            </div>
          )}

          {loadingContacts && !searchQuery && (
            <div className="sm-loading-row">
              <Loader size={16} className="sm-spin" />
              <span>Loading...</span>
            </div>
          )}

          {displayUsers.length > 0 && (
            <div className="sm-contacts-grid">
              {displayUsers.map((profile) => (
                <button
                  key={profile.id}
                  className={`sm-contact ${isSelected(profile.id) ? "selected" : ""}`}
                  onClick={() => toggleUser(profile)}
                  type="button"
                >
                  <div className="sm-contact-avatar-wrap">
                    <Avatar profile={profile} size={46} />
                    {isSelected(profile.id) && (
                      <div className="sm-contact-check">
                        <Check size={10} />
                      </div>
                    )}
                  </div>
                  <span className="sm-contact-name">
                    {profile.full_name?.split(" ")[0] || profile.username}
                  </span>
                  <span className="sm-contact-username">@{profile.username}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected users + message */}
        {selectedUsers.length > 0 && (
          <div className="sm-message-section">
            <div className="sm-selected-chips">
              {selectedUsers.map((u) => (
                <span key={u.id} className="sm-chip">
                  {u.full_name?.split(" ")[0] || u.username}
                  <button onClick={() => toggleUser(u)} type="button">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
            <input
              className="sm-message-input"
              type="text"
              placeholder="Add a message (optional)..."
              value={shareMessage}
              onChange={(e) => setShareMessage(e.target.value)}
              maxLength={200}
            />
          </div>
        )}

        {/* Send button */}
        {selectedUsers.length > 0 && (
          <div className="sm-send-wrap">
            <button
              className="sm-send-btn"
              onClick={handleSendDMs}
              disabled={sending || sent}
              type="button"
            >
              {sent ? (
                <><Check size={16} /> Sent!</>
              ) : sending ? (
                <><Loader size={16} className="sm-spin" /> Sending...</>
              ) : (
                <><Send size={16} /> Send to {selectedUsers.length} person{selectedUsers.length > 1 ? "s" : ""}</>
              )}
            </button>
          </div>
        )}

        <div className="sm-divider">
          <span>or share via</span>
        </div>

        {/* External share buttons - all wired to correct platforms */}
        <div className="sm-external-grid">
          <button className="sm-ext-btn sm-copy" onClick={handleCopyLink} type="button">
            {copied ? <Check size={18} /> : <Link2 size={18} />}
            <span>{copied ? "Copied!" : "Copy Link"}</span>
          </button>

          <button className="sm-ext-btn sm-whatsapp" onClick={() => shareExternal("whatsapp")} type="button">
            {/* WhatsApp icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            <span>WhatsApp</span>
          </button>

          <button className="sm-ext-btn sm-twitter" onClick={() => shareExternal("twitter")} type="button">
            {/* X (Twitter) icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            <span>Twitter/X</span>
          </button>

          <button className="sm-ext-btn sm-facebook" onClick={() => shareExternal("facebook")} type="button">
            <Facebook size={18} />
            <span>Facebook</span>
          </button>

          <button className="sm-ext-btn sm-telegram" onClick={() => shareExternal("telegram")} type="button">
            {/* Telegram icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
            </svg>
            <span>Telegram</span>
          </button>

          {typeof navigator !== "undefined" && navigator.share ? (
            <button className="sm-ext-btn sm-native" onClick={handleNativeShare} type="button">
              <ExternalLink size={18} />
              <span>More</span>
            </button>
          ) : (
            <button className="sm-ext-btn sm-linkedin" onClick={() => shareExternal("linkedin")} type="button">
              {/* LinkedIn icon */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              <span>LinkedIn</span>
            </button>
          )}
        </div>
      </div>

      <style>{`
        .sm-overlay {
          position: fixed;
          inset: 0;
          z-index: 9990;
          background: rgba(0,0,0,0.65);
          backdrop-filter: blur(3px);
          -webkit-backdrop-filter: blur(3px);
          animation: smFadeIn 0.15s ease;
        }
        @keyframes smFadeIn { from { opacity:0 } to { opacity:1 } }

        .sm-modal {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 9991;
          background: #0d0d0d;
          border-top: 1px solid rgba(132,204,22,0.25);
          border-radius: 20px 20px 0 0;
          padding: 0 0 max(20px, env(safe-area-inset-bottom,0)) 0;
          max-height: 90vh;
          overflow-y: auto;
          animation: smSlideUp 0.25s cubic-bezier(0.34,1.2,0.64,1);
        }
        @keyframes smSlideUp { from { transform:translateY(100%) } to { transform:translateY(0) } }

        @media (min-width: 600px) {
          .sm-modal {
            bottom: auto;
            top: 50%;
            left: 50%;
            right: auto;
            transform: translate(-50%,-50%);
            width: 440px;
            border-radius: 20px;
            border: 1px solid rgba(132,204,22,0.25);
            animation: smPopIn 0.22s cubic-bezier(0.34,1.2,0.64,1);
          }
          @keyframes smPopIn {
            from { transform:translate(-50%,-50%) scale(0.9); opacity:0 }
            to   { transform:translate(-50%,-50%) scale(1); opacity:1 }
          }
        }

        .sm-toast {
          position: sticky;
          top: 0;
          z-index: 5;
          background: rgba(132,204,22,0.14);
          border-bottom: 1px solid rgba(132,204,22,0.3);
          color: #84cc16;
          font-size: 13px;
          font-weight: 600;
          padding: 10px 16px;
          display: flex;
          align-items: center;
          gap: 7px;
        }
        .sm-toast-error {
          background: rgba(239,68,68,0.12);
          border-color: rgba(239,68,68,0.3);
          color: #ef4444;
        }

        .sm-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 16px 14px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          position: sticky;
          top: 0;
          background: #0d0d0d;
          z-index: 2;
        }
        .sm-title {
          font-size: 16px;
          font-weight: 700;
          color: #fff;
          margin: 0;
          text-transform: capitalize;
        }
        .sm-close {
          background: rgba(255,255,255,0.07);
          border: none;
          border-radius: 8px;
          color: #737373;
          cursor: pointer;
          padding: 6px;
          display: flex;
          align-items: center;
          transition: all 0.15s;
        }
        .sm-close:hover { color:#fff; background:rgba(255,255,255,0.14); }

        .sm-search-wrap { padding: 12px 16px 0; }
        .sm-search-row {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          padding: 10px 14px;
          transition: border-color 0.15s;
        }
        .sm-search-row:focus-within { border-color: rgba(132,204,22,0.4); }
        .sm-search-icon { color: #555; flex-shrink:0; }
        .sm-search {
          flex: 1;
          background: none;
          border: none;
          color: #fff;
          font-size: 14px;
          outline: none;
        }
        .sm-search::placeholder { color: #555; }
        .sm-search-clear {
          background: none;
          border: none;
          color: #555;
          cursor: pointer;
          padding: 2px;
          display: flex;
          align-items: center;
          transition: color 0.15s;
        }
        .sm-search-clear:hover { color:#a3a3a3; }
        .sm-spin { animation: spin 0.8s linear infinite; color:#84cc16; flex-shrink:0; }
        @keyframes spin { to { transform:rotate(360deg) } }

        .sm-contacts-section { padding: 14px 16px 4px; }
        .sm-section-label {
          font-size: 11px;
          font-weight: 600;
          color: #555;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          margin: 0 0 10px;
        }
        .sm-no-results {
          color: #555;
          font-size: 13px;
          text-align: center;
          padding: 16px 0;
        }
        .sm-loading-row {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #555;
          font-size: 13px;
          padding: 8px 0;
        }

        .sm-contacts-grid {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 6px;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .sm-contacts-grid::-webkit-scrollbar { display:none; }

        .sm-contact {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          background: none;
          border: 1px solid transparent;
          border-radius: 12px;
          cursor: pointer;
          padding: 8px;
          transition: all 0.15s;
          flex-shrink: 0;
          min-width: 66px;
          max-width: 72px;
        }
        .sm-contact:hover { background:rgba(255,255,255,0.05); }
        .sm-contact.selected {
          background: rgba(132,204,22,0.08);
          border-color: rgba(132,204,22,0.3);
        }
        .sm-contact-avatar-wrap { position: relative; }

        .sm-avatar {
          border-radius: 50%;
          overflow: hidden;
          background: linear-gradient(135deg, #84cc16, #3f6212);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          color: #fff;
          flex-shrink: 0;
        }
        .sm-avatar img { width:100%; height:100%; object-fit:cover; }

        .sm-contact-check {
          position: absolute;
          bottom: -2px;
          right: -2px;
          width: 18px;
          height: 18px;
          background: #84cc16;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #000;
          border: 2px solid #0d0d0d;
          font-weight: 700;
        }
        .sm-contact-name {
          font-size: 11px;
          color: #d4d4d4;
          font-weight: 600;
          max-width: 64px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-align: center;
        }
        .sm-contact.selected .sm-contact-name { color:#84cc16; }
        .sm-contact-username {
          font-size: 10px;
          color: #555;
          max-width: 64px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-align: center;
        }

        .sm-message-section { padding: 4px 16px 10px; display:flex; flex-direction:column; gap:8px; }
        .sm-selected-chips { display:flex; flex-wrap:wrap; gap:6px; }
        .sm-chip {
          display: flex;
          align-items: center;
          gap: 5px;
          background: rgba(132,204,22,0.12);
          border: 1px solid rgba(132,204,22,0.3);
          border-radius: 20px;
          padding: 4px 10px;
          font-size: 12px;
          color: #84cc16;
          font-weight: 600;
        }
        .sm-chip button {
          background:none; border:none; color:#84cc16;
          cursor:pointer; padding:0; display:flex; opacity:0.7;
        }
        .sm-chip button:hover { opacity:1; }
        .sm-message-input {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          padding: 10px 14px;
          color: #fff;
          font-size: 14px;
          outline: none;
          width: 100%;
          box-sizing: border-box;
          transition: border-color 0.15s;
        }
        .sm-message-input:focus { border-color:rgba(132,204,22,0.4); }
        .sm-message-input::placeholder { color:#555; }

        .sm-send-wrap { padding: 0 16px 8px; }
        .sm-send-btn {
          width: 100%;
          padding: 13px;
          background: linear-gradient(135deg,#84cc16,#65a30d);
          border: none;
          border-radius: 12px;
          color: #000;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.15s;
        }
        .sm-send-btn:hover:not(:disabled) { background:linear-gradient(135deg,#a3e635,#84cc16); }
        .sm-send-btn:disabled { opacity:0.6; cursor:not-allowed; }

        .sm-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 16px;
          color: #555;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.6px;
        }
        .sm-divider::before, .sm-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,0.08);
        }

        .sm-external-grid {
          display: grid;
          grid-template-columns: repeat(3,1fr);
          gap: 8px;
          padding: 0 16px 16px;
        }
        .sm-ext-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 12px 8px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.15s;
          color: #d4d4d4;
          font-size: 11px;
          font-weight: 600;
        }
        .sm-ext-btn:hover { background:rgba(255,255,255,0.09); transform:translateY(-1px); }
        .sm-ext-btn:active { transform:scale(0.96); }

        .sm-copy { color:#84cc16; }
        .sm-copy:hover { border-color:rgba(132,204,22,0.3); background:rgba(132,204,22,0.08); }
        .sm-whatsapp { color:#25d366; }
        .sm-whatsapp:hover { border-color:rgba(37,211,102,0.3); background:rgba(37,211,102,0.08); }
        .sm-twitter { color:#e7e7e7; }
        .sm-twitter:hover { border-color:rgba(231,231,231,0.3); background:rgba(231,231,231,0.06); }
        .sm-facebook { color:#1877f2; }
        .sm-facebook:hover { border-color:rgba(24,119,242,0.3); background:rgba(24,119,242,0.08); }
        .sm-telegram { color:#0088cc; }
        .sm-telegram:hover { border-color:rgba(0,136,204,0.3); background:rgba(0,136,204,0.08); }
        .sm-linkedin { color:#0a66c2; }
        .sm-linkedin:hover { border-color:rgba(10,102,194,0.3); background:rgba(10,102,194,0.08); }
        .sm-native { color:#a3a3a3; }
        .sm-native:hover { border-color:rgba(163,163,163,0.3); background:rgba(163,163,163,0.08); }
      `}</style>
    </>
  );
};

export default ShareModal;