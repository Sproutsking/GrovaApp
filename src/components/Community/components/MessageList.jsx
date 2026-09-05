// components/Community/components/MessageList.jsx - 0.5PX SHIFT UP ⚡
import React from "react";
import mediaUrlService from "../../../services/shared/mediaUrlService";
import LinkifiedText, { SharedContentMessage, parseSharedContent } from "../../Shared/LinkifiedText";
import { getBoostNameDesign } from "../../../services/boost/boostThemes";
import BoostAvatarRing from "../../Shared/BoostAvatarRing";

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
          const showTail = !isAnnouncement && (!prev || prev.user_id !== msg.user_id);
          const announcementMatch = isAnnouncement ? String(msg.content || "").match(/^\[\[announcement:(.*?)\]\]\n([\s\S]*)$/) : null;
          const messageTitle = announcementMatch?.[1] || "";
          const messageBody = announcementMatch?.[2] || msg.content;
          const showAvatar = !isMe && showTail;
          const hasBoostedProfile = ["silver", "gold", "diamond"].includes(msg.user?.subscription_tier);
          const avatarFootprint = avatarSize + (hasBoostedProfile ? 10 : 4);
          
          const avatarUrl = getAvatar(msg.user);
          const initial = getInitial(msg.user);
          const nameDesign = getBoostNameDesign(msg.user?.subscription_tier, msg.user?.boost_selections?.fontId, msg.user?.boost_selections?.colorId);

          return (
            <div
              key={msg.id || msg.tempId || msg._tempId}
              className={`msg-item ${isMe ? "me" : "them"} ${channelType === "announcement" ? "announcement" : ""} ${msg._optimistic ? "optimistic" : ""} ${msg._failed ? "failed" : ""}`}
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

              <div className={`msg-bubble ${isMe ? "me" : "them"} ${showTail ? 'has-tail' : ''}`} style={{ margin: 0 }}>
                {msg.reply_to_id && (() => {
                  const original = allMessages.find((item) => item.id === msg.reply_to_id);
                  return original ? <div className="msg-reply-quote"><span>Replying to {original.user?.full_name || "member"}</span><strong>{original.content}</strong></div> : null;
                })()}
                {!isMe && showAvatar && (
                  <button className="msg-user-name" style={{ color: nameDesign.color?.color || undefined, fontFamily: nameDesign.font?.family, fontWeight: nameDesign.font?.weight, letterSpacing: nameDesign.font?.spacing }} onClick={() => onProfileClick?.(msg.user)}>
                    {msg.user?.full_name || msg.user?.username || "Unknown"}
                    {(msg.user?.verified || hasBoostedProfile) && <span className="msg-verified" aria-label="Verified account">✓</span>}
                  </button>
                )}
                {messageTitle && <div className="announcement-title">{messageTitle}</div>}
                <div className="msg-content">{parseSharedContent(messageBody) ? <SharedContentMessage onNavigate={onNavigate}>{messageBody}</SharedContentMessage> : renderContent(messageBody)}</div>
                <div className="msg-meta">
                  <span className="msg-time">{formatTime(msg.created_at)}</span>
                  {msg.edited && <span className="msg-edited">(edited)</span>}
                </div>

                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                  <div className="msg-reactions">
                    {Object.entries(msg.reactions).map(([emoji, data]) => (
                      <button
                        key={emoji}
                        className={`reaction-btn ${data.users?.includes(userId) ? "reacted" : ""}`}
                        onClick={() => onReactionClick?.(msg.id, emoji)}
                      >
                        {emoji} {data.count}
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
          padding: 8px 12px;
          display: flex;
          flex-direction: column;
          gap: 2px;
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
          margin-bottom: 4px;
          animation: slideIn 0.2s ease-out;
          position: relative;
          transition: transform 0.18s ease-out;
        }

        .msg-item.me .msg-bubble,
        .msg-item.them .msg-bubble {
          margin: 0;
        }

        .msg-swipe-reply{position:absolute;top:50%;width:28px;height:28px;margin-top:-14px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(156,255,0,.14);border:1px solid rgba(156,255,0,.4);color:#9cff00;font-size:17px;pointer-events:none}
        .msg-swipe-reply.incoming{left:-2px}.msg-swipe-reply.outgoing{right:-2px}
        .msg-reply-quote{display:flex;flex-direction:column;gap:2px;margin-bottom:6px;padding:5px 7px;border-left:2px solid var(--accent);background:rgba(156,255,0,.06);border-radius:4px;color:var(--text-secondary);font-size:10px;line-height:1.25}
        .msg-reply-quote strong{color:var(--text);font-size:11px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

        .msg-item.me {
          flex-direction: row-reverse;
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
          padding: 3px 7px 2px;
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
          padding: 18px 22px 16px;
          border-radius: 18px;
          background: linear-gradient(145deg, rgba(28,42,25,.98), rgba(10,20,13,.98));
          border: 1px solid rgba(156,255,0,.28);
          box-shadow: 0 10px 32px rgba(0,0,0,.24), inset 0 1px 0 rgba(255,255,255,.06);
        }
        .msg-item.announcement .msg-content { font-size: 15px; line-height: 1.7; }
        .msg-item.announcement .msg-meta { margin-top: 10px; }
        .msg-item.announcement .msg-bubble{border-top:3px solid rgba(156,255,0,.72);border-bottom-left-radius:18px;border-bottom-right-radius:18px}
        .announcement-title{font-size:18px;line-height:1.25;font-weight:900;color:#eaffd8;margin-bottom:9px;padding-bottom:9px;border-bottom:1px solid rgba(156,255,0,.18)}

        /* Base bubble styles */
        .msg-bubble.them {
          background: rgba(18,20,19,.97);
          border: 1px solid rgba(255,255,255,.08);
          border-bottom-left-radius: 4px;
        }

        .msg-bubble.me {
          background: linear-gradient(135deg, rgba(31,84,34,.98), rgba(17,38,20,.99) 62%, rgba(9,21,13,1));
          border: 1px solid rgba(156,255,0,.26);
          box-shadow: 0 6px 18px rgba(0,0,0,.2), inset 0 1px 0 rgba(255,255,255,.06);
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
          border-color: transparent transparent rgba(31,84,34,.98) transparent;
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
          border-color: transparent transparent rgba(156,255,0,.26) transparent;
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
          margin-bottom: 3px;
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
          justify-content: flex-end;
          gap: 4px;
          margin-top: 3px;
        }
        .msg-item.me .msg-meta { justify-content: flex-start; }

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
          border-radius: 12px;
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