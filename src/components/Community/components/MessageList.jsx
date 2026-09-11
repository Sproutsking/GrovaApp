// components/Community/components/MessageList.jsx - 0.5PX SHIFT UP ⚡
import React from "react";
import { MoreHorizontal, Reply } from "lucide-react";
import mediaUrlService from "../../../services/shared/mediaUrlService";
import LinkifiedText, { SharedContentMessage, parseSharedContent } from "../../Shared/LinkifiedText";
import { getBoostNameDesign } from "../../../services/boost/boostThemes";
import BoostAvatarRing from "../../Shared/BoostAvatarRing";
import { MessageReactionArea } from "./ReactionSystem";

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

const MessageList = ({
  messages,
  pendingMessages,
  loading,
  userId,
  currentUser,
  messagesEndRef,
  onContextMenu,
  onReactionClick,
  onProfileClick,
  onReply,
  onChannelMention,
  onRoleMention,
  onNavigate,
  channelType,
  avatarImageBleed = 0,
  avatarSize = 36,
  onMessageClick,
  onMessageLongPress,
  onPostNavigate,
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
  const touchStart = React.useRef(null);
  const longPressTimer = React.useRef(null);

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

  const renderContent = (content) => {
    const parts = String(content || "").split(/(#[\w-]+|@[\w.-]+)/g);
    return parts.map((part, index) => {
      if (part.startsWith("#")) return <button key={index} className="msg-mention channel" onClick={() => onChannelMention?.(part.slice(1))}>{part}</button>;
      if (part.startsWith("@")) return <button key={index} className="msg-mention user" onClick={() => onRoleMention?.(part.slice(1))}>{part}</button>;
      return <React.Fragment key={index}><LinkifiedText onNavigate={onNavigate}>{part}</LinkifiedText></React.Fragment>;
    });
  };

  return (
    <div className="msg-list-wrapper">
      {loading && (
        <div className="msg-loading">
          <div className="msg-spinner" />
        </div>
      )}

      {!loading &&
        allMessages.map((msg, idx) => {
          const isMe = String(msg.user_id) === String(userId);
          const prev = allMessages[idx - 1];
          
          // Show tail on first message in a cluster (for both "me" and "them")
          const isAnnouncement = channelType === "announcement";
          const announcementMatch = String(msg.content || "").match(/^\[\[announcement:(.*?)\]\]\n([\s\S]*)$/);
          const announcement = announcementMatch ? parseAnnouncementMetadata(announcementMatch[1]) : null;
          const isAnnouncementMessage = isAnnouncement || Boolean(announcement);
          const showTail = !isAnnouncementMessage && (!prev || prev.user_id !== msg.user_id);
          const postReplyMatch = String(msg.content || "").match(/^\[\[post-reply:(.*?)\]\]\n([\s\S]*)$/);
          const postReply = postReplyMatch ? parsePostReplyMetadata(postReplyMatch[1]) : null;
          const messageTitle = announcement?.title || "";
          const messageBody = announcementMatch?.[2] || postReplyMatch?.[2] || msg.content;
          const showAvatar = isAnnouncementMessage || (!isMe && showTail);
          const originalReply = msg.reply_to_id ? allMessages.find((item) => item.id === msg.reply_to_id) : null;
          const originalReplyAnnouncementMatch = originalReply ? String(originalReply.content || "").match(/^\[\[announcement:(.*?)\]\]\n([\s\S]*)$/) : null;
          const originalReplyAnnouncementMeta = originalReplyAnnouncementMatch ? parseAnnouncementMetadata(originalReplyAnnouncementMatch[1]) : null;
          const hasBoostedProfile = ["silver", "gold", "diamond"].includes(msg.user?.subscription_tier);
          const avatarFootprint = avatarSize + (hasBoostedProfile ? 10 : 4);
          
          const avatarUrl = getAvatar(msg.user);
          const initial = getInitial(msg.user);
          const nameDesign = getBoostNameDesign(msg.user?.subscription_tier, msg.user?.boost_selections?.fontId, msg.user?.boost_selections?.colorId);

          return (
            <div
              key={msg.id || msg.tempId || msg._tempId}
              data-message-id={msg.id || msg.tempId || msg._tempId}
              className={`msg-item ${isMe ? "me" : "them"} ${isAnnouncementMessage ? "announcement" : ""} ${msg._optimistic ? "optimistic" : ""} ${msg._failed ? "failed" : ""}`}
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
                <div className="msg-avatar" style={{ width: avatarFootprint, height: avatarFootprint, border: "0", boxShadow: "none", overflow: "visible" }} onClick={() => onProfileClick?.(msg.user)} role="button" tabIndex={0} aria-label={`View ${msg.user?.full_name || msg.user?.username || "user"}'s profile`}>
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
              {!showAvatar && !isMe && <div className="msg-avatar-spacer" style={{ width: avatarFootprint }} />}

              <MessageReactionArea message={msg} userId={userId} onToggle={onReactionClick} isAnnouncement={isAnnouncementMessage}>
                {({ reactionRow }) => <>
                  <div className={`msg-bubble ${isMe ? "me" : "them"} ${showTail ? 'has-tail' : ''}${announcement ? ` announcement-border-${announcement.borderStyle}` : ""}`} style={{ margin: 0, ...(announcement ? { "--announcement-color": announcement.borderColor } : {}) }}>
                  <button
                    type="button"
                    className="msg-card-menu-btn"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      const rect = event.currentTarget.getBoundingClientRect();
                      onContextMenu?.({ preventDefault() {}, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }, msg);
                    }}
                    aria-label="Message options"
                  >
                    <MoreHorizontal size={12} />
                  </button>
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
                    <div className={`msg-reply-quote${originalReplyAnnouncementMeta ? " announcement" : ""}`} style={originalReplyAnnouncementMeta ? { "--announcement-color": originalReplyAnnouncementMeta.borderColor } : {}}>
                      <span>{originalReplyAnnouncementMeta ? "Announcement" : `Replying to ${originalReply.user?.full_name || "member"}`}</span>
                      <strong>{originalReplyAnnouncementMeta ? (originalReplyAnnouncementMeta.title || "Announcement") : (originalReply.content || "...")}</strong>
                    </div>
                  )}
                  {!isMe && showAvatar && (
                    <button className="msg-user-name" style={{ color: nameDesign.color?.color || undefined, fontFamily: nameDesign.font?.family, fontWeight: nameDesign.font?.weight, letterSpacing: nameDesign.font?.spacing }} onClick={() => onProfileClick?.(msg.user)}>
                      {msg.user?.full_name || msg.user?.username || "Unknown"}
                      {(msg.user?.verified || hasBoostedProfile) && <span className={`msg-verified${hasBoostedProfile ? ` tier-${msg.user?.subscription_tier}` : ""}`} aria-label={hasBoostedProfile ? `${msg.user.subscription_tier} profile` : "Verified account"}>{hasBoostedProfile ? (msg.user.subscription_tier === "silver" ? "◇" : msg.user.subscription_tier === "gold" ? "✦" : "◆") : "✓"}</span>}
                    </button>
                  )}
                  {messageTitle && <div className="announcement-title">{messageTitle}</div>}
                  <div className="msg-content">{parseSharedContent(messageBody) ? <SharedContentMessage onNavigate={onNavigate}>{messageBody}</SharedContentMessage> : renderContent(messageBody)}</div>
                  <div className="msg-meta">
                    <span className="msg-time">{formatTime(msg.created_at)}</span>
                    {msg.edited && <span className="msg-edited">(edited)</span>}
                  </div>
                  {reactionRow}
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
                </>}
              </MessageReactionArea>
            </div>
          );
        })}

      <div ref={messagesEndRef} />

      <style>{`
        .msg-list-wrapper {
          position: relative;
          z-index: 1;
          width: 100%;
          box-sizing: border-box;
          align-items: stretch;
          padding: 4px 12px 8px;
          display: flex;
          flex-direction: column;
          gap: 0;
        }

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
          align-items: flex-end;
          gap: 2px;
          margin-bottom: 1px;
          animation: slideIn 0.2s ease-out;
          position: relative;
          transition: transform 0.18s ease-out;
        }
        .msg-item.announcement { align-items: flex-start; gap: 8px; }
        .msg-item.announcement .msg-avatar { margin-top: 2px; }
        .msg-item.announcement .mra-wrapper { width: fit-content; max-width: calc(100% - 48px); }
        .msg-item.announcement .msg-bubble { width: fit-content; max-width: 100%; }
        .msg-item.announcement.me .mra-wrapper { align-items: flex-end; }
        .msg-item.announcement.them .mra-wrapper { align-items: flex-start; }
        .msg-item .msg-bubble { min-width: 148px; padding-bottom: 6px; }
        .msg-item.announcement .msg-bubble { min-width: min(280px, calc(100vw - 92px)); }
        .msg-card-menu-btn {
          position: absolute;
          top: 8px;
          right: 8px;
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
        .msg-card-menu-btn:hover {
          transform: translateY(-1px);
          background: rgba(156,255,0,0.10);
          border-color: rgba(156,255,0,0.35);
        }

        .msg-item.me .msg-bubble,
        .msg-item.them .msg-bubble {
          margin: 0;
        }

        .msg-swipe-reply{position:absolute;top:50%;width:28px;height:28px;margin-top:-14px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(156,255,0,.14);border:1px solid rgba(156,255,0,.4);color:#9cff00;font-size:17px;pointer-events:none}
        .msg-swipe-reply.incoming{left:-2px}.msg-swipe-reply.outgoing{right:-2px}
        .msg-reply-quote{display:flex;flex-direction:column;gap:2px;margin-bottom:6px;padding:5px 7px;border-left:2px solid var(--accent);background:rgba(156,255,0,.06);border-radius:4px;color:var(--text-secondary);font-size:10px;line-height:1.25}
        .msg-reply-quote.announcement{border:1px solid color-mix(in srgb,var(--announcement-color, var(--accent)) 35%, transparent);border-left:4px solid var(--announcement-color, var(--accent));border-radius:12px;padding:10px 11px;background:linear-gradient(135deg,rgba(156,255,0,.1),rgba(255,255,255,.035));box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 6px 18px rgba(0,0,0,.12);transition:transform .18s ease,box-shadow .18s ease,background .18s ease}
        .msg-reply-quote strong{color:var(--text);font-size:11px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        button.msg-reply-quote{width:100%;text-align:left;font:inherit;cursor:pointer}
        button.msg-reply-quote:hover{border-color:rgba(156,255,0,.8);background:linear-gradient(135deg,rgba(156,255,0,.17),rgba(255,255,255,.06));box-shadow:0 8px 24px rgba(156,255,0,.14),inset 0 1px 0 rgba(255,255,255,.1);transform:translateY(-1px)}
        button.msg-reply-quote:focus-visible{outline:2px solid #38bdf8;outline-offset:2px}
        .msg-item.post-navigation-target .msg-bubble{animation:postTargetPulse 2.2s cubic-bezier(.22,.61,.36,1);}
        @keyframes postTargetPulse{0%{box-shadow:0 0 0 0 rgba(156,255,0,0),0 0 0 rgba(156,255,0,0)}35%{box-shadow:0 0 0 4px rgba(156,255,0,.28),0 0 30px rgba(156,255,0,.34)}100%{box-shadow:0 0 0 2px rgba(156,255,0,.12),0 0 18px rgba(156,255,0,.18)}}

        .msg-item.me {
          flex-direction: row-reverse;
          justify-content: flex-start;
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
        }

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
          font-size: 10px;
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
          font-size: 14px;
          font-weight: 700;
          color: var(--accent);
        }

        .msg-avatar-spacer {
          width: 56px;
          flex-shrink: 0;
        }

        .msg-bubble {
          max-width: 70%;
          padding: 4px 8px 3px;
          border-radius: 14px;
          backdrop-filter: blur(10px);
          position: relative;
          box-shadow: 0 4px 16px rgba(0,0,0,.12);
          margin: 0;
        }
        .msg-item.them .msg-bubble { margin-right: auto; }
        .msg-item.me .msg-bubble { margin-left: auto; }
        .msg-item.announcement .msg-bubble {
          max-width: min(92%, 760px);
          padding: 18px 22px 8px;
          border-radius: 18px;
          background: linear-gradient(145deg, rgba(14,18,14,.94), rgba(8,12,9,.98));
          border: 1px solid rgba(156,255,0,.28);
          box-shadow: 0 10px 32px rgba(0,0,0,.24), inset 0 1px 0 rgba(255,255,255,.06);
        }
        .msg-item.announcement .msg-content { font-size: 15px; line-height: 1.7; }
        .msg-item.announcement .msg-meta { margin-top: 10px; }
        .msg-item.announcement .msg-bubble{border-top:3px solid var(--announcement-color,#9cff00);border-bottom-left-radius:0;border-bottom-right-radius:0}.msg-item.announcement .msg-bubble.announcement-border-double{border-top-style:double;border-top-width:6px}.msg-item.announcement .msg-bubble.announcement-border-dashed{border-top-style:dashed}.msg-item.announcement .msg-bubble.announcement-border-glow{box-shadow:0 0 26px color-mix(in srgb,var(--announcement-color,#9cff00) 22%,transparent),0 10px 32px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.06)}
        .announcement-title{font-size:18px;line-height:1.25;font-weight:900;color:#eaffd8;margin-bottom:9px;padding-bottom:9px;border-bottom:1px solid color-mix(in srgb,var(--announcement-color,#9cff00) 28%,transparent)}
        .mra-wrapper { position: relative; display: flex; flex: 0 1 auto; width: min(70%, max-content); max-width: 70%; flex-direction: column; align-items: flex-end; min-width: 0; }
        .mra-wrapper .msg-bubble { width: auto; max-width: 100%; }
        .msg-item.them .mra-wrapper { margin-right: auto; }
        .msg-item.me .mra-wrapper { margin-left: auto; }
        .mra-ann { align-items: flex-start; width: fit-content; max-width: min(760px, calc(100vw - 92px)); }
        .mra-ann .mra-picker-wrap { left: 0; right: auto; }

        /* Base bubble styles */
        .msg-bubble.them,
        .msg-bubble.me {
          background: linear-gradient(145deg, rgba(23,29,26,.98), rgba(11,16,14,.99));
          border: 1px solid rgba(196,214,202,.14);
          box-shadow: 0 8px 24px rgba(0,0,0,.2), inset 0 1px 0 rgba(255,255,255,.06);
        }
        .msg-bubble.them {
          border-bottom-left-radius: 4px;
        }

        .msg-bubble.me {
          border-bottom-right-radius: 4px;
        }

        .msg-bubble.me .msg-content { color: #f1f9e8; }

        .msg-bubble.them.has-tail {
          border-bottom-left-radius: 4px;
        }

        .msg-bubble.them.has-tail::before {
          content: '';
          position: absolute;
          bottom: 0;
          left: -7px;
          width: 0;
          height: 0;
          border-style: solid;
          border-width: 0 0 10px 8px;
          border-color: transparent transparent rgba(18,20,19,.97) transparent;
        }

        .msg-bubble.them.has-tail::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: -8px;
          width: 0;
          height: 0;
          border-style: solid;
          border-width: 0 0 11px 9px;
          border-color: transparent transparent rgba(255,255,255,.08) transparent;
          z-index: -1;
        }

        .msg-bubble.me.has-tail {
          border-bottom-right-radius: 4px;
        }

        .msg-bubble.me.has-tail::before {
          content: '';
          position: absolute;
          bottom: 1px;
          right: -7px;
          width: 0;
          height: 0;
          border-style: solid;
          border-width: 0 0 10px 8px;
          border-color: transparent transparent rgba(23,29,26,.98) transparent;
          transform: scaleX(-1);
        }

        .msg-bubble.me.has-tail::after {
          content: '';
          position: absolute;
          bottom: 1px;
          right: -8px;
          width: 0;
          height: 0;
          border-style: solid;
          border-width: 0 0 11px 9px;
          border-color: transparent transparent rgba(196,214,202,.14) transparent;
          z-index: -1;
          transform: scaleX(-1);
        }

        .msg-user-name {
          border: 0;
          background: transparent;
          padding: 0;
          cursor: pointer;
          text-align: left;
          font-size: 12px;
          font-weight: 700;
          color: var(--accent);
          margin-bottom: 2px;
          line-height: 1.2;
        }

        .msg-content {
          font-size: 14px;
          color: var(--text);
          line-height: 1.5;
          word-break: break-word;
        }
        .msg-mention{border:0;border-radius:4px;padding:1px 3px;font:inherit;cursor:pointer}.msg-mention.channel{color:#8fc9ff;background:rgba(96,165,250,.12)}.msg-mention.user{color:#baff82;background:rgba(156,255,0,.1)}.msg-mention:hover{filter:brightness(1.2)}

        .msg-meta {
          display: flex;
          align-items: center;
          gap: 7px;
          justify-content: flex-end;
          gap: 4px;
          margin-top: 3px;
        }
        .msg-item.me .msg-meta { justify-content: flex-start; }
        .announcement-reply-button{display:inline-flex;align-items:center;gap:5px;align-self:flex-start;margin-top:2px;padding:6px 10px;border:1px solid rgba(156,255,0,.24);border-radius:999px;background:linear-gradient(180deg,rgba(156,255,0,.12),rgba(156,255,0,.04));color:#cfeabf;font:700 10px/1 inherit;cursor:pointer;transition:all .18s ease}
        .announcement-reply-button:hover{background:rgba(156,255,0,.17);border-color:rgba(156,255,0,.55);color:#9cff00;transform:translateY(1px)}

        .msg-time {
          font-size: 10px;
          color: var(--text-muted);
        }

        .msg-edited {
          font-size: 10px;
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
          font-size: 11px;
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

          .msg-avatar-spacer {
            width: 56px;
          }

          .msg-avatar-fallback {
            font-size: 14px;
          }

          .msg-bubble {
            max-width: 80%;
            padding: 5px 9px;
            border-radius: 14px;
          }

          .msg-user-name {
            font-size: 11px;
          }

          .msg-content {
            font-size: 13px;
          }

          .msg-bubble.them.has-tail::before {
            border-width: 0 0 9px 7px;
            left: -6px;
          }

          .msg-bubble.them.has-tail::after {
            border-width: 0 0 10px 8px;
            left: -7px;
          }

          .msg-bubble.me.has-tail::before {
            border-width: 0 0 9px 7px;
            bottom: -0.5px;
            right: -6.5px;
          }

          .msg-bubble.me.has-tail::after {
            border-width: 0 0 10px 8px;
            bottom: -0.5px;
            right: -7.5px;
          }
        }
      `}</style>
    </div>
  );
};

export default MessageList;