// components/Community/components/MessageList.jsx - 0.5PX SHIFT UP ⚡
import React from "react";
import ReactDOM from "react-dom";
import { MoreVertical, Reply } from "lucide-react";
import mediaUrlService from "../../../services/shared/mediaUrlService";
import LinkifiedText, { SharedContentMessage, getExternalUrls, parseSharedContent } from "../../Shared/LinkifiedText";
import { getBoostNameDesign } from "../../../services/boost/boostThemes";
import BoostAvatarRing from "../../Shared/BoostAvatarRing";
import { VerifiedBadgeCircle } from "../../Shared/VerifiedBadges";
import { MessageReactionArea } from "./ReactionSystem";
import WelcomeMemberCard, { getWelcomeMemberId } from "../verification/WelcomeMemberCard";
import { COMMUNITY_MENTION_PATTERN, resolveCommunityMention } from "../communityMentions";

const ANNOUNCEMENT_BORDER_STYLES = new Set(["solid", "double", "dashed", "glow"]);
const ANNOUNCEMENT_COLORS = new Set(["#9cff00", "#38bdf8", "#f59e0b", "#f472b6", "#a78bfa"]);

const parseAnnouncementMetadata = (token) => {
  const fallback = { title: token || "", borderStyle: "solid", borderColor: "#9cff00" };
  try {
    const parsed = JSON.parse(decodeURIComponent(token));
    return {
      title: String(parsed.title || ""),
      borderStyle: ANNOUNCEMENT_BORDER_STYLES.has(parsed.borderStyle) ? parsed.borderStyle : fallback.borderStyle,
      borderColor: ANNOUNCEMENT_COLORS.has(parsed.borderColor) ? parsed.borderColor : fallback.borderColor,
    };
  } catch {
    return fallback;
  }
};

const parsePostReplyMetadata = (token) => {
  try {
    const parsed = JSON.parse(decodeURIComponent(token));
    return {
      title: String(parsed.title || "Announcement"),
      body: String(parsed.body || ""),
      channelName: String(parsed.channelName || "announcements"),
      channelId: parsed.channelId || null,
      messageId: parsed.messageId || null,
      postId: parsed.postId || null,
      externalPost: Boolean(parsed.externalPost),
      borderColor: ANNOUNCEMENT_COLORS.has(parsed.borderColor) ? parsed.borderColor : "#9cff00",
      borderStyle: ANNOUNCEMENT_BORDER_STYLES.has(parsed.borderStyle) ? parsed.borderStyle : "solid",
    };
  } catch {
    return { title: "Announcement", body: "", channelName: "announcements", channelId: null, messageId: null, postId: null, externalPost: false, borderColor: "#9cff00", borderStyle: "solid" };
  }
};

const MessageAttachments = ({ message, onImageClick }) => {
  const items = Array.isArray(message?.attachments) && message.attachments.length
    ? message.attachments
    : message?.media_url ? [{ url: message.media_url, type: message.media_type || "file", name: "Attachment" }] : [];
  if (!items.length) return null;
  return (
    <div style={{ display: "grid", gap: 5, marginTop: 5, maxWidth: "100%" }}>
      {items.map((item, index) => {
        const url = item?.url;
        if (!url) return null;
        if (item.type === "image") return <button key={`${url}-${index}`} type="button" onClick={(event) => { event.stopPropagation(); onImageClick?.(url); }} aria-label="Open image in full size" title="Open image in full size" style={{ display: "block", maxWidth: "100%", padding: 0, border: 0, borderRadius: 10, background: "transparent", cursor: "zoom-in", textAlign: "left" }}><img src={url} alt={item.name && item.name !== "Attachment" ? item.name : "Message image"} style={{ display: "block", maxWidth: "100%", maxHeight: 360, borderRadius: 10, objectFit: "contain" }} loading="lazy" /></button>;
        if (item.type === "video") return <video key={`${url}-${index}`} src={url} controls preload="metadata" style={{ display: "block", width: "100%", maxHeight: 360, borderRadius: 10 }} />;
        return <a key={`${url}-${index}`} href={url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", maxWidth: "100%", color: "#bef264", overflowWrap: "anywhere" }}>{item.name || "Download attachment"}</a>;
      })}
    </div>
  );
};

const MessageList = ({
  messages,
  pendingMessages,
  loading,
  userId,
  currentUser,
  messagesEndRef,
  onContextMenu,
  onReactionClick,
  canAddReactions = true,
  onProfileClick,
  onReply,
  onChannelMention,
  onRoleMention,
  onNavigate,
  getMessageStatus,
  channelType,
  avatarImageBleed = 0,
  avatarSize = 36,
  onMessageClick,
  onMessageLongPress,
  onPostNavigate,
  onReplyNavigate,
  communityId,
  community,
  communityMembers = [],
  communityRoles = [],
  communityChannels = [],
  onWelcomeProfileClick,
  onWelcomeIntroduce,
  onWelcomeBrowse,
  newMessageId,
}) => {
  const formatTime = (d) => {
    if (!d) return "";
    const date = new Date(d);
    const h = date.getHours() % 12 || 12;
    const m = date.getMinutes().toString().padStart(2, "0");
    return `${h}:${m} ${date.getHours() >= 12 ? "PM" : "AM"}`;
  };

  const getAvatar = (user) => {
    if (!user) return null;

    const metadata = user.avatar_metadata || user.avatarMetadata || {};
    return mediaUrlService.resolveAvatarUrl(
      user.avatar_url || user.avatarUrl || user.avatar || user.avatar_id || metadata.url || metadata.publicUrl || metadata.avatar_url,
      200,
    );
  };

  const getInitial = (user) => {
    if (!user) return "?";
    return (user.full_name || user.username || "?").charAt(0).toUpperCase();
  };

  const allMessages = [...messages, ...pendingMessages];
  const [swipe, setSwipe] = React.useState(null);
  const [viewingImage, setViewingImage] = React.useState(null);
  const touchStart = React.useRef(null);
  const longPressTimer = React.useRef(null);

  React.useEffect(() => {
    if (!viewingImage) return undefined;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setViewingImage(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [viewingImage]);

  const beginSwipe = (event, message) => {
    touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY, message };
  };
  const moveSwipe = (event, message) => {
    if (!touchStart.current) return;
    const dx = event.touches[0].clientX - touchStart.current.x;
    const dy = Math.abs(event.touches[0].clientY - touchStart.current.y);
    if (dy > 18) return;
    const direction = message.user_id === userId ? -1 : 1;
    const distance = Math.max(0, Math.min(76, dx * direction));
    if (distance > 4) setSwipe({ id: message.id, distance });
  };
  const endSwipe = () => {
    clearTimeout(longPressTimer.current);
    if (swipe?.distance >= 52) onReply?.(allMessages.find((message) => message.id === swipe.id));
    touchStart.current = null;
    setSwipe(null);
  };

  const startLongPress = (event, message) => {
    clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      onMessageLongPress?.(event, message);
      touchStart.current = null;
      setSwipe(null);
    }, 500);
  };

  const renderInlineContent = (content, keyPrefix = "line") => {
    const markdownParts = String(content || "").split(/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*]+\*)/g).filter(Boolean);
    return markdownParts.map((part, index) => {
      const key = `${keyPrefix}-${index}`;
      const boldMatch = part.match(/^(?:\*\*|__)(.+)(?:\*\*|__)$/s);
      if (boldMatch) return <strong key={key}>{renderInlineContent(boldMatch[1], key)}</strong>;
      const italicMatch = part.match(/^\*([^*]+)\*$/s);
      if (italicMatch) return <em key={key}>{renderInlineContent(italicMatch[1], key)}</em>;
      const codeMatch = part.match(/^`([^`]+)`$/s);
      if (codeMatch) return <code key={key} className="msg-inline-code">{codeMatch[1]}</code>;

      return String(part).split(COMMUNITY_MENTION_PATTERN).map((mentionPart, mentionIndex) => {
        const mentionKey = `${key}-${mentionIndex}`;
        const mention = resolveCommunityMention(mentionPart, {
          members: communityMembers,
          roles: communityRoles,
          channels: communityChannels,
        });
        if (mention?.type === "channel") return <button key={mentionKey} type="button" className="msg-mention channel" title={mention.entity ? `Open #${mention.entity.name}` : "Channel mention"} onClick={() => onChannelMention?.(mention.entity?.name || mention.slug)}>{mention.label}</button>;
        if (mention?.type === "role") return <button key={mentionKey} type="button" className="msg-mention role" style={mention.entity ? { "--mention-color": mention.entity.color || "#9cff00" } : undefined} title={mention.entity ? `View members with ${mention.entity.name}` : "Role mention"} onClick={() => onRoleMention?.(mention.entity?.name || mention.slug)}>{mention.label}</button>;
        if (mention?.type === "user") return <button key={mentionKey} type="button" className="msg-mention user" title={`Open ${mention.entity.full_name || mention.entity.username || "member"}'s profile`} onClick={() => onProfileClick?.(mention.entity)}>{mention.label}</button>;
        if (mention?.type === "everyone") return <button key={mentionKey} type="button" className="msg-mention everyone" onClick={() => onRoleMention?.(mention.slug)}>{mention.label}</button>;
        if (mention?.type === "unknown") return <button key={mentionKey} type="button" className="msg-mention user" onClick={() => onRoleMention?.(mention.slug)}>{mention.label}</button>;
        return <React.Fragment key={mentionKey}><LinkifiedText displayMode="string" onNavigate={onNavigate}>{mentionPart}</LinkifiedText></React.Fragment>;
      });
    });
  };

  const renderContent = (content) => String(content || "").split("\n").map((line, index) => (
    <React.Fragment key={`row-${index}`}>
      {index > 0 && <br />}
      {!line.trim() && <span className="msg-content-blank-line" aria-hidden="true" />}
      {line.trim() && renderInlineContent(line, `row-${index}`)}
    </React.Fragment>
  ));

  return (
    <div className={`msg-list-wrapper ${channelType === "announcement" ? "announcement-channel" : "text-channel"}`}>
      {loading && (
        <div className="msg-loading">
          <div className="msg-spinner" />
        </div>
      )}

      {!loading && allMessages.map((msg, idx) => {
          const isMe = String(msg.user_id) === String(userId);
          const prev = allMessages[idx - 1];
          const isAnnouncement = channelType === "announcement";
          const announcementMatch = String(msg.content || "").match(/^\[\[announcement:(.*?)\]\]\n([\s\S]*)$/);
          const announcement = announcementMatch ? parseAnnouncementMetadata(announcementMatch[1]) : null;
          const isAnnouncementMessage = isAnnouncement || Boolean(announcement);
          const prevCreatedAt = prev ? new Date(prev.created_at).getTime() : null;
          const currentCreatedAt = msg.created_at ? new Date(msg.created_at).getTime() : null;
          const isWithinCluster = prev && prev.user_id === msg.user_id && prevCreatedAt !== null && currentCreatedAt !== null && (currentCreatedAt - prevCreatedAt) <= 10 * 60 * 1000;
          const showTail = !isAnnouncementMessage && (!prev || prev.user_id !== msg.user_id || !isWithinCluster);
          const postReplyMatch = String(msg.content || "").match(/^\[\[post-reply:(.*?)\]\]\n([\s\S]*)$/);
          const postReply = postReplyMatch ? parsePostReplyMetadata(postReplyMatch[1]) : null;
          const welcomeMemberId = getWelcomeMemberId(msg.content);
          const messageTitle = announcement?.title || "";
          const messageBody = announcementMatch?.[2] || postReplyMatch?.[2] || String(msg.content || "").replace(/^\[\[welcome-member:[^\]]+\]\]\n?/, "");
          const hasMessageMedia = (Array.isArray(msg.attachments) && msg.attachments.length > 0) || Boolean(msg.media_url);
          const showMessageBody = !(hasMessageMedia && messageBody.trim().toLowerCase() === "attachment");
          const showAvatar = isAnnouncementMessage || showTail;
          const showSenderHeader = isAnnouncementMessage || Boolean(msg.user);
          const isReactionChannel = isAnnouncementMessage || channelType === "social_updates";
          const hasReactionRow = isReactionChannel || canAddReactions
            || Object.values(msg.reactions || {}).some((reaction) => Number(reaction?.count) > 0);
          const originalReply = msg.reply_to_id ? allMessages.find((item) => item.id === msg.reply_to_id) : null;
          const originalReplyAnnouncementMatch = originalReply ? String(originalReply.content || "").match(/^\[\[announcement:(.*?)\]\]\n([\s\S]*)$/) : null;
          const originalReplyAnnouncementMeta = originalReplyAnnouncementMatch ? parseAnnouncementMetadata(originalReplyAnnouncementMatch[1]) : null;
          const replyTier = ["silver", "gold", "diamond"].includes(originalReply?.user?.subscription_tier) ? originalReply.user.subscription_tier : "normal";
          const replyColor = replyTier === "normal" ? "#9cff00" : getBoostNameDesign(replyTier, originalReply?.user?.boost_selections?.fontId, originalReply?.user?.boost_selections?.colorId).color?.color || "#9cff00";
          const profileTier = ["silver", "gold", "diamond"].includes(msg.user?.subscription_tier) ? msg.user.subscription_tier : "normal";
          const hasBoostedProfile = ["silver", "gold", "diamond"].includes(msg.user?.subscription_tier);
          const avatarFootprint = avatarSize + (hasBoostedProfile ? 10 : 4);
          
          const avatarUrl = getAvatar(msg.user);
          const initial = getInitial(msg.user);
          const nameDesign = getBoostNameDesign(msg.user?.subscription_tier, msg.user?.boost_selections?.fontId, msg.user?.boost_selections?.colorId);
          const communityRole = communityMembers.find((member) => String(member.user_id || member.user?.id) === String(msg.user_id))?.role;
          const communityNameColor = communityRole?.color || nameDesign.color?.color;

          return (
            <React.Fragment key={msg.id || msg.tempId || msg._tempId}>
            {String(msg.id) === String(newMessageId) && newMessageId && (
              <div
                data-new-message-divider
                role="separator"
                aria-label={`New messages, ${formatTime(msg.created_at)}`}
                style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 6px", color: "#fb7185", fontSize: 12, fontWeight: 800, letterSpacing: ".04em" }}
              >
                <span style={{ height: 1, flex: 1, background: "rgba(251,113,133,.62)" }} />
                <span>NEW MESSAGES · {formatTime(msg.created_at)}</span>
                <span style={{ height: 1, flex: 1, background: "rgba(251,113,133,.62)" }} />
              </div>
            )}
            {welcomeMemberId ? <WelcomeMemberCard communityId={communityId} memberId={welcomeMemberId} viewerId={userId} community={community} createdAt={msg.created_at} onProfileClick={onWelcomeProfileClick} onIntroduce={onWelcomeIntroduce} onBrowse={onWelcomeBrowse} /> : (
            <div
              data-message-id={msg.id || msg.tempId || msg._tempId}
              className={`msg-item ${isMe ? "me" : "them"} ${isWithinCluster ? "clustered" : ""} ${isAnnouncementMessage ? "announcement" : ""} ${msg._optimistic ? "optimistic" : ""} ${msg._failed ? "failed" : ""}`}
              onClick={(event) => onMessageClick?.(event, msg)}
              onContextMenu={(e) => onContextMenu?.(e, msg)}
              onTouchStart={(e) => { beginSwipe(e, msg); startLongPress(e, msg); }}
              onTouchMove={(e) => { clearTimeout(longPressTimer.current); moveSwipe(e, msg); }}
              onTouchEnd={endSwipe}
              onTouchCancel={endSwipe}
              style={{ transform: swipe?.id === msg.id ? `translateX(${(msg.user_id === userId ? -1 : 1) * swipe.distance}px)` : undefined }}
            >
              {swipe?.id === msg.id && <div className={`msg-swipe-reply ${msg.user_id === userId ? "outgoing" : "incoming"}`}><span>↩</span></div>}
              {showAvatar && (
                <div className="msg-avatar" style={{ width: avatarFootprint, height: avatarFootprint, border: "0", boxShadow: "none", overflow: "visible" }} onPointerUp={(event) => { event.stopPropagation(); onProfileClick?.(msg.user); }} onClick={(event) => { event.stopPropagation(); onProfileClick?.(msg.user); }} role="button" tabIndex={0} aria-label={`View ${msg.user?.full_name || msg.user?.username || "user"}'s profile`}>
                  <BoostAvatarRing
                    tier={msg.user?.subscription_tier}
                    themeId={msg.user?.boost_selections?.themeId}
                    accentColor={nameDesign.color?.color}
                    size={avatarSize}
                    src={avatarUrl}
                    letter={initial}
                    showBadge={false}
                    imageBleed={avatarImageBleed}
                    style={{ cursor: "pointer" }}
                  />
                </div>
              )}
              {!showAvatar && <div className={`msg-avatar-spacer ${isMe ? "outgoing" : "incoming"}`} style={{ width: avatarFootprint }} aria-hidden="true" />}

              <MessageReactionArea message={msg} userId={userId} onToggle={onReactionClick} isAnnouncement={isReactionChannel} isOutgoing={isMe} showReactionTrigger={isReactionChannel || canAddReactions} canReact={canAddReactions} footerMeta={hasReactionRow ? (
                <div className={`msg-meta${isMe && getMessageStatus ? " dm-meta dm-meta-outgoing" : ""}`}>
                  <span className="msg-time">{formatTime(msg.created_at)}</span>
                  {isMe && getMessageStatus && <span className={`dm-message-status dm-message-status-${getMessageStatus(msg)}`} aria-label={`Message ${getMessageStatus(msg)}`}>
                    {getMessageStatus(msg) === "failed" ? "!" : getMessageStatus(msg) === "read" || getMessageStatus(msg) === "delivered" ? "✓✓" : "✓"}
                  </span>}
                  {msg.edited && <span className="msg-edited">(edited)</span>}
                </div>
              ) : null}>
                {({ reactionRow }) => <>
                  <div className={`msg-bubble ${isMe ? "me" : "them"} profile-${profileTier} ${showTail ? 'has-tail' : ''}${announcement ? ` announcement-border-${announcement.borderStyle}` : ""}`} style={{ margin: 0, textAlign: isAnnouncementMessage && isMe ? "right" : undefined, ...(announcement ? { "--announcement-color": announcement.borderColor } : {}) }}>
                  <div className={`msg-card-header ${isMe ? "outgoing" : "incoming"}`}>
                    {showSenderHeader && (
                      <button className="msg-user-name" style={{ color: communityNameColor || undefined, fontFamily: nameDesign.font?.family, fontWeight: nameDesign.font?.weight, letterSpacing: nameDesign.font?.spacing }} onClick={() => onProfileClick?.(msg.user)}>
                        <span className="msg-user-name-text">{isMe ? (currentUser?.fullName || currentUser?.name || msg.user?.full_name || msg.user?.name || "You") : (msg.user?.full_name || msg.user?.name || msg.user?.username || "Unknown")}</span>
                        {(msg.user?.verified || hasBoostedProfile) && <VerifiedBadgeCircle tier={hasBoostedProfile ? msg.user?.subscription_tier : "silver"} size={16} />}
                      </button>
                    )}
                    <button type="button" className={`msg-card-menu-btn ${isMe ? "me" : "them"}`} onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      const rect = event.currentTarget.getBoundingClientRect();
                      onContextMenu?.({ preventDefault() {}, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }, msg);
                    }} aria-label="Message options"><MoreVertical size={12} /></button>
                  </div>
                  {postReply && (
                    <button
                      type="button"
                      className={`msg-reply-quote announcement post-reply-quote announcement-border-${postReply.borderStyle || "solid"}`}
                      style={{ "--announcement-color": postReply.borderColor || "#9cff00" }}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClickCapture={(event) => { event.preventDefault(); event.stopPropagation(); onPostNavigate?.(postReply); }}
                      aria-label={`Open original post in #${postReply.channelName}`}
                    >
                      <span>Reply to #{postReply.channelName}</span>
                      <strong>{postReply.title}</strong>
                      {postReply.body && <small>{postReply.body}</small>}
                    </button>
                  )}
                  {msg.reply_to_id && originalReply && !postReply && (
                    <button type="button" className={`msg-reply-quote${originalReplyAnnouncementMeta ? " announcement" : ""} reply-tier-${replyTier}`} style={{ "--reply-color": originalReplyAnnouncementMeta?.borderColor || replyColor }} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.preventDefault(); event.stopPropagation(); onReplyNavigate?.(originalReply, msg.reply_to_id); }} aria-label="Jump to the message being replied to">
                      <span>{originalReplyAnnouncementMeta ? "Announcement" : `Replying to ${originalReply.user?.full_name || "member"}`}</span>
                      <strong>{originalReplyAnnouncementMeta ? (originalReplyAnnouncementMeta.title || "Announcement") : (originalReply.content || "...")}</strong>
                    </button>
                  )}
                  {messageTitle && <div className="announcement-title">{messageTitle}</div>}
                  {showMessageBody && <div className="msg-content">{parseSharedContent(messageBody) ? <SharedContentMessage onNavigate={onNavigate}>{messageBody}</SharedContentMessage> : renderContent(messageBody)}</div>}
                  <MessageAttachments message={msg} onImageClick={setViewingImage} />
                  <div className="msg-footer">
                    {reactionRow}
                    {!hasReactionRow && <div className={`msg-meta${isMe && getMessageStatus ? " dm-meta dm-meta-outgoing" : ""}`}>
                      <span className="msg-time">{formatTime(msg.created_at)}</span>
                      {isMe && getMessageStatus && <span className={`dm-message-status dm-message-status-${getMessageStatus(msg)}`} aria-label={`Message ${getMessageStatus(msg)}`}>
                        {getMessageStatus(msg) === "failed" ? "!" : getMessageStatus(msg) === "read" || getMessageStatus(msg) === "delivered" ? "✓✓" : "✓"}
                      </span>}
                      {msg.edited && <span className="msg-edited">(edited)</span>}
                    </div>}
                  </div>
                </div>
                {isAnnouncementMessage && (
                  <button
                    type="button"
                    className="announcement-reply-button"
                    onClick={(event) => { event.stopPropagation(); onReply?.({ ...msg, isAnnouncement: true, borderColor: announcement?.borderColor || postReply?.borderColor || "#9cff00", borderStyle: announcement?.borderStyle || postReply?.borderStyle || "solid" }); }}
                    aria-label="Reply to announcement"
                  >
                    <Reply size={12} />
                    <span>Reply</span>
                  </button>
                )}
                {getExternalUrls(messageBody).map((url) => (
                  <div className="msg-external-preview" key={`message-preview-${url}`}>
                    <LinkifiedText previewOnly onNavigate={onNavigate}>{url}</LinkifiedText>
                  </div>
                ))}
                </>}
              </MessageReactionArea>
            </div>
          )}
          </React.Fragment>
          );
        })}

      <div ref={messagesEndRef} />
      {viewingImage && ReactDOM.createPortal(
        <div role="dialog" aria-modal="true" aria-label="Full-size message image" onClick={() => setViewingImage(null)} style={{ position: "fixed", inset: 0, zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "rgba(0,0,0,.92)" }}>
          <button type="button" onClick={() => setViewingImage(null)} aria-label="Close image viewer" style={{ position: "fixed", top: 16, right: 16, width: 40, height: 40, border: "1px solid rgba(255,255,255,.25)", borderRadius: "50%", background: "rgba(20,20,20,.8)", color: "white", fontSize: 25, lineHeight: 1, cursor: "pointer" }}>×</button>
          <img src={viewingImage} alt="Full-size message" onClick={(event) => event.stopPropagation()} style={{ display: "block", maxWidth: "min(94vw, 1400px)", maxHeight: "92vh", objectFit: "contain", borderRadius: 4 }} />
        </div>,
        document.body,
      )}

      <style>{`
        .msg-list-wrapper {
          position: relative;
          z-index: 1;
          width: 100%;
          box-sizing: border-box;
          align-items: stretch;
          padding: 6px 10px 8px;
          display: flex;
          flex-direction: column;
          gap: 0;
        }
.dm-message-status{font-size:calc((12px) + 1px);font-weight:800;line-height:1;letter-spacing:-2px;margin-left:0;display:inline-flex;align-items:flex-end;justify-content:center;min-width:15px;line-height:1.1;align-self:flex-end;transform:translateY(-1px);}
.dm-message-status-sent{color:#9ca3af;}
.dm-message-status-delivered{color:#d1d5db;}
.dm-message-status-read{color:#9cff00;text-shadow:0 0 7px rgba(156,255,0,.48);}
.msg-meta.dm-meta-outgoing{justify-content:flex-end;align-items:flex-end;gap:6px;width:100%;}
.msg-time{display:inline-flex;align-items:flex-end;}

        .msg-loading {
          display: flex;
          justify-content: center;
          padding: 20px;
        }

        .msg-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid var(--accent-glow);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .msg-item {
          display: flex;
          width: 100%;
          box-sizing: border-box;
          align-items: flex-start;
          gap: 4px;
          margin: 0 0 4px;
          animation: slideIn 0.2s ease-out;
          position: relative;
          transition: transform 0.18s ease-out;
        }
        .msg-item.announcement { align-items: flex-start; gap: 8px; }
        .msg-item.clustered { margin-bottom: 2px; }
        .msg-item.announcement .msg-avatar { margin-top: 2px; }
        .msg-item.announcement .mra-wrapper { width: 100%; max-width: 70%; }
        .msg-item.announcement .msg-bubble { width: 100%; max-width: 100%; }
        .msg-item.announcement.me .mra-wrapper { align-items: flex-end; }
        .msg-item.announcement.them .mra-wrapper { align-items: flex-start; }
        .msg-item .msg-bubble { min-width: 0; padding-bottom: 3px; }
        .msg-item.me .msg-bubble { padding-left: 3px; padding-right: 3px; }
        .msg-item.them .msg-bubble { padding-left: 3px; padding-right: 3px; }
        .msg-external-preview{display:block;width:100%;margin:8px 0 0;padding:0 4px;box-sizing:border-box;}
        .msg-external-preview .xeevia-link-card{width:100%;max-width:420px;}
        @media(max-width:768px){.msg-external-preview{width:90%;margin-left:5%;}.msg-external-preview .xeevia-link-card{width:100%;}}
        .msg-item.announcement .msg-bubble { min-width: min(280px, 100%); }
        .msg-card-menu-btn {
          position: relative;
          top: 6px;
          width: 22px;
          height: 22px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 7px;
          border: 1px solid rgba(156,255,0,0.22);
          background: rgba(10,12,10,0.72);
          color: #dfffc8;
          cursor: pointer;
          padding: 0;
          z-index: 4;
          box-shadow: 0 8px 18px rgba(0,0,0,0.28);
          transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease;
        }
        .msg-card-menu-btn.them,
        .msg-card-menu-btn.me { inset: auto; }
        .msg-card-menu-btn svg {
          transform: rotate(90deg);
        }
        .msg-card-menu-btn:hover {
          transform: translateY(-1px);
          background: rgba(156,255,0,0.10);
          border-color: rgba(156,255,0,0.35);
        }

        .msg-item.me .msg-bubble,
        .msg-item.them .msg-bubble { margin: 0; }

        .msg-swipe-reply{position:absolute;top:50%;width:28px;height:28px;margin-top:-14px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(156,255,0,.14);border:1px solid rgba(156,255,0,.4);color:#9cff00;font-size:calc((17px) + 1px);pointer-events:none}
        .msg-swipe-reply.incoming{left:-2px}.msg-swipe-reply.outgoing{right:-2px}
        .msg-reply-quote{display:flex;flex-direction:column;gap:2px;width:100%;max-width:100%;min-width:0;box-sizing:border-box;margin-bottom:4px;padding:6px 8px;border:1px solid color-mix(in srgb,var(--reply-color,#9cff00) 28%, transparent);border-left:3px solid var(--reply-color,#9cff00);background:linear-gradient(135deg,color-mix(in srgb,var(--reply-color,#9cff00) 13%, transparent),rgba(255,255,255,.035));border-radius:8px;color:var(--text-secondary);font-size:calc((11px) + 1px);line-height:1.3;transition:transform .18s ease,box-shadow .18s ease,background .18s ease;box-shadow:inset 0 1px 0 rgba(255,255,255,.05);overflow:hidden}
        .msg-reply-quote.reply-tier-silver{border-left-color:#cbd5e1;background:linear-gradient(135deg,rgba(148,163,184,.13),rgba(255,255,255,.04));box-shadow:inset 0 0 0 1px rgba(148,163,184,.18)}
        .msg-reply-quote.reply-tier-gold{border-left-color:#fbbf24;background:linear-gradient(135deg,rgba(251,191,36,.16),rgba(255,255,255,.04));box-shadow:inset 0 0 0 1px rgba(251,191,36,.18)}
        .msg-reply-quote.reply-tier-diamond{border-left-color:#7dd3fc;background:linear-gradient(135deg,rgba(125,211,252,.15),rgba(167,139,250,.09));box-shadow:inset 0 0 0 1px rgba(125,211,252,.2),0 0 12px rgba(125,211,252,.12)}
        .msg-reply-quote.announcement{border:1px solid color-mix(in srgb,var(--announcement-color, var(--accent)) 35%, transparent);border-left:3px solid var(--announcement-color, var(--accent));border-radius:9px;padding:7px 8px;background:linear-gradient(135deg,rgba(156,255,0,.1),rgba(255,255,255,.035));box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 6px 18px rgba(0,0,0,.12);transition:transform .18s ease,box-shadow .18s ease,background .18s ease}
        .msg-reply-quote span{font-size:calc((10px) + 1px);font-weight:800;letter-spacing:.03em;text-transform:uppercase;color:#a8c59f;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .msg-reply-quote strong{display:block;min-width:0;max-width:100%;color:var(--text);font-size:calc((12px) + 1px);font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        button.msg-reply-quote{width:100%;text-align:left;font:inherit;cursor:pointer}
        button.msg-reply-quote:hover{border-color:rgba(156,255,0,.8);background:linear-gradient(135deg,rgba(156,255,0,.17),rgba(255,255,255,.06));box-shadow:0 8px 24px rgba(156,255,0,.14),inset 0 1px 0 rgba(255,255,255,.1);transform:translateY(-1px)}
        button.msg-reply-quote:focus-visible{outline:2px solid #38bdf8;outline-offset:2px}
        .msg-card-header { display:flex; align-items:center; justify-content:space-between; width:100%; min-width:max-content; min-height:20px; padding-top:3px; margin-bottom:2px; box-sizing:border-box; gap:6px; }
        .msg-card-header .msg-card-menu-btn { position:relative; top:auto; left:auto; right:auto; flex:0 0 22px; }
        .msg-card-header.incoming .msg-user-name { order:1; }
        .msg-card-header.incoming .msg-card-menu-btn { order:2; }
        .msg-card-header.outgoing .msg-card-menu-btn { order:1; }
        .msg-card-header.outgoing .msg-user-name { order:2; }
        .msg-card-header.outgoing,
        .msg-card-header.incoming { justify-content:space-between; }
        .msg-card-header.outgoing .msg-user-name { flex-direction:row-reverse; }
        .msg-card-header .msg-user-name { flex:1 1 auto; min-width:max-content; margin:0; padding:0; text-align:inherit; white-space:nowrap; }
        .msg-card-header .msg-card-menu-btn { inset:auto; margin:0; }
        .msg-item.post-navigation-target .msg-bubble{animation:postTargetPulse 2.2s cubic-bezier(.22,.61,.36,1);}
        .msg-item.reply-navigation-target .msg-bubble{animation:replyTargetPulse 1.5s ease-out;}
        @keyframes replyTargetPulse{0%{box-shadow:0 0 0 0 rgba(156,255,0,0),0 0 0 rgba(156,255,0,0)}35%{box-shadow:0 0 0 4px rgba(156,255,0,.38),0 0 28px rgba(156,255,0,.32)}100%{box-shadow:0 0 0 1px rgba(156,255,0,.12),0 0 10px rgba(156,255,0,.12)}}
        @keyframes postTargetPulse{0%{box-shadow:0 0 0 0 rgba(156,255,0,0),0 0 0 rgba(156,255,0,0)}35%{box-shadow:0 0 0 4px rgba(156,255,0,.28),0 0 30px rgba(156,255,0,.34)}100%{box-shadow:0 0 0 2px rgba(156,255,0,.12),0 0 18px rgba(156,255,0,.18)}}

        .msg-item.me {
          flex-direction: row-reverse;
          justify-content: flex-start;
          padding-right: 4px;
        }

        .msg-item.optimistic {
          opacity: 0.7;
        }

        .msg-item.failed {
          opacity: 0.5;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .msg-avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          border: 2px solid var(--accent-border);
          overflow: visible;
          flex-shrink: 0;
          position: relative;
          box-shadow: 0 2px 8px var(--shadow);
          padding: 0;
          cursor: pointer;
          margin-right: 4px;
        }
        .msg-item.me .msg-avatar {
          margin-left: 2px;
          margin-right: 0;
        }
        .msg-item.them .msg-avatar { margin-right: 0; }

        .msg-verified,
        .community-profile-verified {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 15px;
          height: 15px;
          margin-left: 5px;
          border-radius: 50%;
          background: #84cc16;
          color: #071007;
          font-size: calc((10px) + 1px);
          font-weight: 900;
          line-height: 1;
          vertical-align: middle;
        }
        .msg-verified.tier-silver{background:linear-gradient(135deg,#f8fafc,#64748b);color:#17202a}.msg-verified.tier-gold{background:linear-gradient(135deg,#fff7ae,#d97706);color:#3f2500}.msg-verified.tier-diamond{background:linear-gradient(135deg,#e0f2fe,#22d3ee 52%,#a78bfa);color:#10243b}

        .msg-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .msg-avatar-fallback {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, var(--surface-elevated), var(--surface));
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: calc((14px) + 1px);
          font-weight: 700;
          color: var(--accent);
        }

        .msg-avatar-spacer {
          width: 56px;
          flex-shrink: 0;
        }

        .msg-bubble {
          max-width: 70%;
          padding: 0 2px 2px;
          border-radius: 12px;
          backdrop-filter: blur(10px);
          position: relative;
          box-shadow: 0 4px 16px rgba(0,0,0,.12);
          margin: 0;
        }
        .msg-item.them .msg-bubble { margin-right: auto; }
        .msg-item.me .msg-bubble { margin-left: auto; }
        .msg-item.announcement .msg-bubble {
          width: 100%;
          max-width: min(760px, 100%);
          padding: 0 10px 4px;
          border-radius: 16px;
          background: linear-gradient(145deg, rgba(14,18,14,.94), rgba(8,12,9,.98));
          border: 1px solid rgba(156,255,0,.28);
          box-shadow: 0 10px 32px rgba(0,0,0,.24), inset 0 1px 0 rgba(255,255,255,.06);
        }
        .msg-item.announcement .msg-content { font-size: calc((15px) + 1px); line-height: 1.55; white-space: normal; }
        .msg-content-blank-line { display: block; height: .85em; }
        .msg-inline-code { padding: 1px 5px; border-radius: 4px; background: rgba(255,255,255,.08); color: #d9ffaf; font: .9em ui-monospace, SFMono-Regular, Menlo, monospace; }
        .msg-item.announcement .msg-meta { margin-top: 5px; }
        .msg-item.announcement .msg-bubble{border-top:3px solid var(--announcement-color,#9cff00);border-bottom-left-radius:0;border-bottom-right-radius:0}.msg-item.announcement .msg-bubble.announcement-border-double{border-top-style:double;border-top-width:6px}.msg-item.announcement .msg-bubble.announcement-border-dashed{border-top-style:dashed}.msg-item.announcement .msg-bubble.announcement-border-glow{box-shadow:0 0 26px color-mix(in srgb,var(--announcement-color,#9cff00) 22%,transparent),0 10px 32px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.06)}
        .msg-item.announcement.me .msg-bubble { border-bottom-left-radius: 16px; border-bottom-right-radius: 0; }
        .msg-item.announcement.them .msg-bubble { border-bottom-left-radius: 0; border-bottom-right-radius: 16px; }
        .announcement-title{font-size:calc((18px) + 1px);line-height:1.25;font-weight:900;color:#eaffd8;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid color-mix(in srgb,var(--announcement-color,#9cff00) 28%,transparent)}
        .mra-wrapper { position: relative; display: flex; flex: 0 1 auto; width: fit-content; max-width: 70%; flex-direction: column; align-items: flex-end; min-width: 0; overflow: visible; }
        .mra-wrapper .msg-bubble { width: fit-content; max-width: 100%; min-width: 0; }
        .msg-item.them .mra-wrapper { margin-right: auto; align-items:flex-start; }
        .msg-item.me .mra-wrapper { margin-left: auto; align-items:flex-end; }
        .mra-ann { align-items: flex-start; width: min(70%, 760px); max-width: min(70%, 760px); }
        .mra-ann .mra-picker-wrap { left: 0; right: auto; }

        /* Base bubble styles */
        .msg-bubble {
          --bubble-bg: linear-gradient(145deg, rgba(23,29,26,.98), rgba(11,16,14,.99));
          --bubble-border: rgba(196,214,202,.14);
          --bubble-shadow: 0 8px 24px rgba(0,0,0,.2), inset 0 1px 0 rgba(255,255,255,.06);
          --message-tail-fill: rgba(19,29,23,.99);
          --message-tail-edge: rgba(196,214,202,.22);
          background: var(--bubble-bg);
          border: 1px solid var(--bubble-border);
          box-shadow: var(--bubble-shadow);
        }
        .msg-bubble.profile-normal {
          --bubble-bg: linear-gradient(145deg, rgba(23,29,26,.98), rgba(11,16,14,.99));
          --bubble-border: rgba(196,214,202,.14);
          --message-tail-fill: rgba(19,29,23,.99);
          --message-tail-edge: rgba(196,214,202,.18);
        }
        .msg-bubble.profile-silver {
          --bubble-bg: linear-gradient(145deg, rgba(23,31,39,.98), rgba(15,21,30,.98));
          --bubble-border: rgba(148,163,184,.24);
          --message-tail-fill: rgba(17,22,29,.99);
          --message-tail-edge: rgba(148,163,184,.26);
        }
        .msg-bubble.profile-gold {
          --bubble-bg: linear-gradient(145deg, rgba(39,29,16,.99), rgba(24,18,10,.99));
          --bubble-border: rgba(251,191,36,.22);
          --message-tail-fill: rgba(34,25,15,.99);
          --message-tail-edge: rgba(251,191,36,.28);
        }
        .msg-bubble.profile-diamond {
          --bubble-bg: linear-gradient(145deg, rgba(12,26,36,.99), rgba(10,16,23,.99));
          --bubble-border: rgba(125,211,252,.26);
          --message-tail-fill: rgba(10,18,27,.99);
          --message-tail-edge: rgba(125,211,252,.3);
        }
        .msg-bubble.them {
          border-bottom-left-radius: 2px;
        }

        .msg-bubble.me {
          border-bottom-right-radius: 2px;
        }

        .msg-list-wrapper.text-channel .msg-bubble.them,
        .msg-list-wrapper.text-channel .msg-bubble.me {
          border-bottom-left-radius: 12px !important;
          border-bottom-right-radius: 12px !important;
        }

        .msg-bubble.me .msg-content { color: #f1f9e8; }

        @media (max-width: 768px) {
          .msg-list-wrapper.text-channel { padding-left: 4px; padding-right: 4px; }
          .msg-list-wrapper.announcement-channel { padding-left: 4px; padding-right: 4px; }
          .msg-item.announcement .mra-wrapper { max-width: 80%; }
          .msg-list-wrapper.announcement-channel .msg-item.me { padding-left: 10px; padding-right: 4px; }
          .msg-list-wrapper.announcement-channel .msg-item.them { padding-left: 4px; padding-right: 10px; }
          .msg-list-wrapper.announcement-channel .msg-item.announcement .msg-bubble { padding-left: 10px; padding-right: 4px; }
          .msg-list-wrapper.announcement-channel .msg-item.announcement.them .msg-bubble { padding-left: 4px; padding-right: 10px; }
        }

        .msg-item .mra-wrapper { overflow: visible; }
        .msg-bubble.them.has-tail { border-top-left-radius: 0; }
        .msg-bubble.me.has-tail { border-top-right-radius: 0; }
        .msg-bubble.them.has-tail::before,
        .msg-bubble.them.has-tail::after,
        .msg-bubble.me.has-tail::before,
        .msg-bubble.me.has-tail::after {
          content: "";
          position: absolute;
          top: 1px;
          width: 0;
          height: 0;
          border-style: solid;
          pointer-events: none;
        }
        .msg-bubble.them.has-tail::before {
          left: -8px;
          border-width: 9px 0 0 8px;
          border-color: var(--message-tail-edge) transparent transparent transparent;
        }
        .msg-bubble.them.has-tail::after {
          left: -6px;
          top: 2px;
          border-width: 7px 0 0 6px;
          border-color: var(--message-tail-fill) transparent transparent transparent;
        }
        .msg-bubble.me.has-tail::before {
          right: -8px;
          border-width: 9px 8px 0 0;
          border-color: var(--message-tail-edge) transparent transparent transparent;
        }
        .msg-bubble.me.has-tail::after {
          right: -6px;
          top: 2px;
          border-width: 7px 6px 0 0;
          border-color: var(--message-tail-fill) transparent transparent transparent;
        }

        .msg-user-name {
          border: 0;
          background: transparent;
          padding: 0;
          cursor: pointer;
          text-align: left;
          font-size: calc((13px) + 1px);
          font-weight: 700;
          color: var(--accent);
          margin-bottom: 2px;
          line-height: 1.2;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .msg-user-name-text {
          display: inline-block;
        }

        .msg-content {
          font-size: calc((14px) + 1px);
          color: var(--text);
          line-height: 1.5;
          word-break: break-word;
          margin-inline: 1px;
        }
        .msg-item.me .msg-content { text-align: right; }
        .msg-item.me .msg-reply-quote { text-align: right; }
        .msg-mention{display:inline-flex;align-items:center;vertical-align:baseline;border:1px solid transparent;border-radius:6px;padding:1px 5px;font:inherit;font-weight:650;line-height:1.35;cursor:pointer;transition:background .16s,border-color .16s,color .16s,transform .16s}.msg-mention:hover{transform:translateY(-1px);filter:brightness(1.18)}.msg-mention:focus-visible{outline:2px solid currentColor;outline-offset:2px}.msg-mention.channel{color:#9bd4ff;background:rgba(79,157,255,.13);border-color:rgba(79,157,255,.12)}.msg-mention.user{color:#c5f7a4;background:rgba(156,255,0,.1);border-color:rgba(156,255,0,.1)}.msg-mention.role{color:var(--mention-color,#c7a7ff);background:color-mix(in srgb,var(--mention-color,#9b75df) 15%,transparent);border-color:color-mix(in srgb,var(--mention-color,#9b75df) 23%,transparent)}.msg-mention.everyone{color:#ffc979;background:rgba(245,158,11,.12);border-color:rgba(245,158,11,.12)}

        .msg-footer {
          width: 100%;
          min-width: 0;
          margin-top: 3px;
        }
        .msg-meta {
          display: flex;
          align-items: center;
          gap: 4px;
          justify-content: flex-end;
          margin-inline: 1px;
        }
        .msg-time { white-space: nowrap; }
        .msg-item.me .announcement-reply-button{align-self:flex-end}
        .msg-item.them .announcement-reply-button{align-self:flex-start}
  .announcement-reply-button{display:inline-flex;align-items:center;gap:5px;margin-top:-1px;padding:6px 10px;border:1px solid rgba(156,255,0,.24);border-top:0;border-radius:0 0 10px 10px;background:linear-gradient(180deg,rgba(156,255,0,.1),rgba(156,255,0,.035));color:#cfeabf;font:700 10px/1 inherit;cursor:pointer;transition:all .18s ease}
        .announcement-reply-button:hover{background:rgba(156,255,0,.17);border-color:rgba(156,255,0,.55);color:#9cff00;transform:translateY(1px)}

        .msg-time {
          font-size: calc((10px) + 1px);
          color: var(--text-muted);
        }

        .msg-edited {
          font-size: calc((10px) + 1px);
          color: var(--text-secondary);
          font-style: italic;
        }

        .msg-reactions {
          display: flex;
          gap: 4px;
          margin-top: 4px;
          flex-wrap: wrap;
        }

        .reaction-btn {
          padding: 2px 6px;
          background: var(--surface);
          border: 1px solid var(--surface-border);
          border-radius: 8px;
          font-size: calc((11px) + 1px);
          cursor: pointer;
          transition: all 0.2s;
          color: var(--text-secondary);
        }

        .reaction-btn:hover {
          background: var(--accent-bg-soft);
          border-color: var(--accent-border);
          color: var(--accent);
        }

        .reaction-btn.reacted {
          background: var(--accent-bg-soft);
          border-color: var(--accent-border-strong);
          color: var(--accent);
        }

        .msg-item.them .rb-pill{background:rgba(255,255,255,.055);border-color:rgba(255,255,255,.14);color:#c5ceca}
        .msg-item.them .rb-pill:hover,.msg-item.them .rb-pill.reacted{background:rgba(255,255,255,.1);border-color:rgba(210,220,215,.35);color:#eef5ef}
        .msg-item.me .rb-pill{background:rgba(156,255,0,.08);border-color:rgba(156,255,0,.24);color:#cfeabf}
        .msg-item.me .rb-pill:hover,.msg-item.me .rb-pill.reacted{background:rgba(156,255,0,.15);border-color:rgba(156,255,0,.45);color:#eaffd8}

        @media (max-width: 768px) {
          .msg-avatar {
            width: 56px;
            height: 56px;
          }
          .mra-ann { width: min(80%, 760px); max-width: min(80%, 760px); }

          .msg-avatar-spacer {
            width: 56px;
          }

          .msg-avatar-fallback {
            font-size: calc((14px) + 1px);
          }

          .msg-bubble {
            max-width: 80%;
            min-width: max-content;
            padding: 0 5px 4px;
            border-radius: 12px;
          }

          .msg-user-name {
            font-size: calc((11px) + 1px);
          }

          .msg-content {
            font-size: calc((13px) + 1px);
          }

          .msg-list-wrapper {
            padding-left: 2px;
            padding-right: 2px;
          }

        }
      `}</style>
    </div>
  );
};

export default MessageList;