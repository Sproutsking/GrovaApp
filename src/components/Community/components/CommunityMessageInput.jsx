import React, { useState, useRef, useCallback, useEffect } from "react";
import ReactDOM from "react-dom";
import { Send, Plus, X, Eye, Palette } from "lucide-react";
import MediaPopup from "../../Messages/MediaPopup";

const ANNOUNCEMENT_BORDER_STYLES = [
  { id: "solid", label: "Solid" },
  { id: "double", label: "Double" },
  { id: "dashed", label: "Dashed" },
  { id: "glow", label: "Glow" },
];

const ANNOUNCEMENT_COLORS = ["#9cff00", "#38bdf8", "#f59e0b", "#f472b6", "#a78bfa"];

const CommunityMessageInput = ({ 
  value, 
  onChange, 
  onSend, 
  disabled = false,
  placeholder = "Type a message...",
  editingMessage = null,
  onCancelEdit = null,
  typingUsers = [],
  replyTo = null,
  onCancelReply = null,
  members = [],
  roles = [],
  channels = [],
  onMentionSelect = null,
  channelType = "text",
  canManageAnnouncement = true,
}) => {
  const [showMediaPopup, setShowMediaPopup] = useState(false);
  const [triggerRect, setTriggerRect] = useState(null);
  const [selectedEmojis, setSelectedEmojis] = useState([]);
  const [selectedGif, setSelectedGif] = useState(null);
  const [selectedMeme, setSelectedMeme] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBorderStyle, setAnnouncementBorderStyle] = useState("solid");
  const [announcementBorderColor, setAnnouncementBorderColor] = useState("#9cff00");
  const [showAnnouncementPreview, setShowAnnouncementPreview] = useState(false);
  
  const inputRef = useRef(null);
  const plusBtnRef = useRef(null);
  const [mentionQuery, setMentionQuery] = useState(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    const hasContent = trimmed || selectedEmojis.length > 0 || selectedGif || selectedMeme || selectedFiles.length > 0;
    const isAnnouncementLocked = channelType === "announcement" && !canManageAnnouncement && !replyTo;

    if (!hasContent || disabled || isAnnouncementLocked) return;

    onSend(channelType === "announcement" && canManageAnnouncement ? {
      title: announcementTitle.trim(),
      borderStyle: announcementBorderStyle,
      borderColor: announcementBorderColor,
    } : undefined);
    
    // Clear all media
    setSelectedEmojis([]);
    setSelectedGif(null);
    setSelectedMeme(null);
    setSelectedFiles([]);
    if (channelType === "announcement") setAnnouncementTitle("");
    
    if (inputRef.current) inputRef.current.focus();
  }, [value, selectedEmojis, selectedGif, selectedMeme, selectedFiles, announcementTitle, announcementBorderStyle, announcementBorderColor, channelType, disabled, canManageAnnouncement, replyTo, onSend]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
      if (e.key === "Escape" && editingMessage && onCancelEdit) {
        onCancelEdit();
      }
      if (mentionQuery && e.key === "ArrowDown") { e.preventDefault(); return; }
      if (mentionQuery && e.key === "Tab") { e.preventDefault(); return; }
    },
    [handleSend, editingMessage, onCancelEdit, mentionQuery],
  );

  const handleChange = (event) => {
    const nextValue = event.target.value;
    onChange(nextValue);
    const cursor = event.target.selectionStart;
    const before = nextValue.slice(0, cursor);
    const match = before.match(/(^|\s)([@#])([^\s@#]*)$/);
    setMentionQuery(match ? { trigger: match[2], query: match[3].toLowerCase(), start: cursor - match[3].length - 1 } : null);
  };

  const mentionOptions = mentionQuery ? (mentionQuery.trigger === "#"
    ? channels.filter((channel) => channel.name.toLowerCase().includes(mentionQuery.query)).slice(0, 6)
    : [
      { id: "everyone", name: "everyone", type: "everyone" },
      { id: "here", name: "here", type: "here" },
      ...roles.map((role) => ({ ...role, type: "role" })),
      ...members.map((member) => ({ ...member.user, type: "user" })),
    ].filter((item) => (item.name || item.full_name || item.username || "").toLowerCase().includes(mentionQuery.query)).slice(0, 8)
  ) : [];

  const selectMention = (item) => {
    const label = item.type === "user" ? (item.username || item.full_name) : item.name;
    const replacement = `${mentionQuery.trigger}${label} `;
    const before = value.slice(0, mentionQuery.start);
    const cursor = value.length;
    onChange(`${before}${replacement}${value.slice(cursor)}`);
    onMentionSelect?.(item, mentionQuery.trigger);
    setMentionQuery(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handlePlusClick = () => {
    if (plusBtnRef.current) {
      setTriggerRect(plusBtnRef.current.getBoundingClientRect());
    }
    setShowMediaPopup(true);
  };

  const handleEmojiSelect = (emoji) => {
    setSelectedEmojis(prev => [...prev, { id: Date.now() + Math.random(), emoji }]);
  };

  const handleGifSelect = (gif) => {
    setSelectedGif({
      id: Date.now(),
      emoji: gif.emoji || "🎬",
      title: gif.category || gif.title || "GIF"
    });
  };

  const handleMemeSelect = (meme) => {
    setSelectedMeme({
      id: Date.now(),
      emoji: meme.emoji,
      title: meme.text
    });
  };

  const handleFileSelect = (file) => {
    if (selectedFiles.length >= 10) return;
    setSelectedFiles(prev => [...prev, {
      id: Date.now() + Math.random(),
      file,
      name: file.name,
      size: (file.size / 1024).toFixed(1) + "KB"
    }]);
  };

  const removeEmoji = (id) => {
    setSelectedEmojis(prev => prev.filter(e => e.id !== id));
  };

  const removeGif = () => setSelectedGif(null);
  const removeMeme = () => setSelectedMeme(null);
  
  const removeFile = (id) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== id));
  };

  const formatTypingText = () => {
    if (typingUsers.length === 0) return null;
    if (typingUsers.length === 1) return `${typingUsers[0].userName} is typing`;
    if (typingUsers.length === 2) return `${typingUsers[0].userName} and ${typingUsers[1].userName} are typing`;
    if (typingUsers.length <= 9) {
      const names = typingUsers.slice(0, 2).map(u => u.userName).join(", ");
      return `${names} and ${typingUsers.length - 2} others are typing`;
    }
    const names = typingUsers.slice(0, 2).map(u => u.userName).join(", ");
    return `${names} and many others are typing`;
  };

  const typingText = formatTypingText();
  const allMedia = [...selectedEmojis, selectedGif, selectedMeme, ...selectedFiles].filter(Boolean);
  const isAnnouncementLocked = channelType === "announcement" && !canManageAnnouncement && !replyTo;

  return (
    <div className="comm-msg-input-wrapper">
      {showMediaPopup && triggerRect && (
        <MediaPopup
          onEmojiSelect={handleEmojiSelect}
          onGifSelect={handleGifSelect}
          onMemeSelect={handleMemeSelect}
          onFileSelect={handleFileSelect}
          onClose={() => setShowMediaPopup(false)}
          triggerRect={triggerRect}
        />
      )}

      {typingText && (
        <div className="comm-typing-indicator">
          <div className="comm-typing-bubble">
            <div className="comm-typing-dots">
              <span /><span /><span />
            </div>
          </div>
          <span className="comm-typing-text">{typingText}</span>
        </div>
      )}

      {editingMessage && (
        <div className="comm-edit-banner">
          <span>Editing message</span>
          <button onClick={onCancelEdit}>Cancel</button>
        </div>
      )}

      {replyTo && (
        <div className="comm-reply-banner">
          <div className="comm-reply-banner-copy">
            <strong>Replying to {replyTo.user?.full_name || replyTo.user?.username || "member"}</strong>
            <span>{replyTo.content}</span>
          </div>
          <button onClick={onCancelReply} aria-label="Cancel reply"><X size={14} /></button>
        </div>
      )}

      {/* PREVIEW CARDS - Above input */}
      {allMedia.length > 0 && (
        <div className="comm-media-preview-bar">
          {selectedEmojis.map(item => (
            <div key={item.id} className="comm-preview-card emoji">
              <span className="comm-preview-emoji">{item.emoji}</span>
              <button className="comm-preview-remove" onClick={() => removeEmoji(item.id)}>
                <X size={12} />
              </button>
            </div>
          ))}
          
          {selectedGif && (
            <div className="comm-preview-card">
              <div className="comm-preview-icon">{selectedGif.emoji}</div>
              <div className="comm-preview-title">{selectedGif.title}</div>
              <button className="comm-preview-remove" onClick={removeGif}>
                <X size={12} />
              </button>
            </div>
          )}
          
          {selectedMeme && (
            <div className="comm-preview-card">
              <div className="comm-preview-icon">{selectedMeme.emoji}</div>
              <div className="comm-preview-title">{selectedMeme.title}</div>
              <button className="comm-preview-remove" onClick={removeMeme}>
                <X size={12} />
              </button>
            </div>
          )}
          
          {selectedFiles.map(file => (
            <div key={file.id} className="comm-preview-card">
              <div className="comm-preview-icon">📎</div>
              <div className="comm-preview-info">
                <div className="comm-preview-title">{file.name}</div>
                <div className="comm-preview-size">{file.size}</div>
              </div>
              <button className="comm-preview-remove" onClick={() => removeFile(file.id)}>
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={`comm-msg-input-bar${channelType === "announcement" ? " announcement-input" : ""}`}>
        {channelType === "announcement" && canManageAnnouncement && <>
          <div className="comm-announcement-tools">
            <div className="comm-announcement-tool-group">
              <span className="comm-announcement-tool-label"><Palette size={12} /> Border</span>
              <div className="comm-announcement-style-list">
                {ANNOUNCEMENT_BORDER_STYLES.map((style) => <button key={style.id} type="button" className={`comm-announcement-style ${announcementBorderStyle === style.id ? "selected" : ""}`} onClick={() => setAnnouncementBorderStyle(style.id)}>{style.label}</button>)}
              </div>
            </div>
            <div className="comm-announcement-colors" aria-label="Announcement border color">
              {ANNOUNCEMENT_COLORS.map((color) => <button key={color} type="button" className={`comm-announcement-color ${announcementBorderColor === color ? "selected" : ""}`} style={{ backgroundColor: color }} onClick={() => setAnnouncementBorderColor(color)} aria-label={`Use ${color} border`} />)}
            </div>
            <button type="button" className="comm-announcement-preview-btn" onClick={() => setShowAnnouncementPreview(true)}><Eye size={14} /> Preview</button>
          </div>
          <input className="comm-announcement-title" value={announcementTitle} onChange={(event) => setAnnouncementTitle(event.target.value)} placeholder="Announcement title (optional)" maxLength={150} />
        </>}
        <button
          ref={plusBtnRef}
          className={`comm-plus-btn ${showMediaPopup ? "active" : ""}`}
          onClick={handlePlusClick}
          disabled={disabled || isAnnouncementLocked}
        >
          <Plus size={20} />
        </button>

        <textarea
          ref={inputRef}
          className="comm-textarea"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={isAnnouncementLocked ? "Locked for members — reply to continue" : placeholder}
          rows={1}
          disabled={disabled || isAnnouncementLocked}
        />

        {mentionQuery && mentionOptions.length > 0 && (
          <div className="comm-mention-menu">
            {mentionOptions.map((item) => <button key={`${item.type}-${item.id}`} onMouseDown={(event) => { event.preventDefault(); selectMention(item); }}>
              <span className="comm-mention-icon">{item.type === "user" ? (item.full_name || item.username || "?").charAt(0).toUpperCase() : item.type === "role" ? (item.icon || "♟") : item.type === "channel" ? "#" : "@"}</span>
              <span><strong>{item.name || item.full_name || item.username}</strong><small>{item.type === "user" ? `@${item.username || "user"}` : item.type}</small></span>
            </button>)}
          </div>
        )}

        <button
          className={`comm-send-btn ${value.trim() || allMedia.length > 0 ? "active" : ""}`}
          onClick={handleSend}
          disabled={(!value.trim() && allMedia.length === 0) || disabled || isAnnouncementLocked}
        >
          <Send size={18} />
        </button>
      </div>

      {showAnnouncementPreview && channelType === "announcement" && ReactDOM.createPortal(
        <div className="comm-announcement-preview-overlay" onClick={() => setShowAnnouncementPreview(false)}>
          <section className="comm-announcement-preview-modal" onClick={(event) => event.stopPropagation()}>
            <header className="comm-announcement-preview-header"><div><span>Announcement preview</span><strong>How your post will appear</strong></div><button type="button" onClick={() => setShowAnnouncementPreview(false)} aria-label="Close preview"><X size={18} /></button></header>
            <div className="comm-announcement-preview-stage">
              <article className={`comm-announcement-preview-card announcement-border-${announcementBorderStyle}`} style={{ "--announcement-color": announcementBorderColor }}>
                {announcementTitle.trim() && <h3>{announcementTitle.trim()}</h3>}
                <p>{value.trim() || "Your announcement message will appear here."}</p>
                <small>Now · You</small>
              </article>
            </div>
            <footer><button type="button" className="comm-announcement-preview-close" onClick={() => setShowAnnouncementPreview(false)}>Back to editor</button></footer>
          </section>
        </div>,
        document.body,
      )}

      <style>{`
        .comm-msg-input-wrapper {
          position: relative;
          width: 100%;
          background: var(--panel);
          border-top: 1px solid var(--surface-border);
          z-index: 1;
        }

        .comm-typing-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
        }
        .comm-reply-banner{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:8px 12px;border-top:1px solid rgba(156,255,0,.18);background:linear-gradient(180deg, rgba(156,255,0,.08), rgba(156,255,0,.02));color:#9cff00;box-shadow:inset 0 1px 0 rgba(255,255,255,.04)}
        .comm-reply-banner-copy{display:flex;flex-direction:column;gap:3px;min-width:0}.comm-reply-banner strong{font-size:10px;letter-spacing:.08em;text-transform:uppercase}.comm-reply-banner span{font-size:11px;color:#c9d8c5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-left:8px;border-left:2px solid rgba(156,255,0,.38);max-width:100%}.comm-reply-banner button{width:25px;height:25px;display:flex;align-items:center;justify-content:center;border:0;border-radius:7px;background:rgba(255,255,255,.06);color:#8aa68a;cursor:pointer;flex-shrink:0}
        .comm-typing-bubble {
          padding: 4px 8px;
          background: var(--surface);
          border: 1px solid var(--surface-border);
          border-radius: 12px;
        }

        .comm-typing-dots {
          display: flex;
          gap: 3px;
        }

        .comm-typing-dots span {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--text-muted);
          animation: bounce 1.2s ease infinite;
        }

        .comm-typing-dots span:nth-child(2) { animation-delay: 0.15s; }
        .comm-typing-dots span:nth-child(3) { animation-delay: 0.3s; }

        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-3px); opacity: 1; }
        }

        .comm-typing-text {
          font-size: 11px;
          color: var(--text-secondary);
          font-style: italic;
        }

        .comm-edit-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 12px;
          background: var(--accent-bg-soft);
          border-bottom: 1px solid var(--accent-border);
          font-size: 12px;
          color: var(--accent);
        }

        .comm-edit-banner button {
          padding: 3px 10px;
          background: transparent;
          border: 1px solid var(--accent-border);
          border-radius: 6px;
          color: var(--accent);
          font-size: 11px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .comm-edit-banner button:hover {
          background: var(--accent-bg-soft);
        }

        /* PREVIEW CARDS - Above input */
        .comm-media-preview-bar {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          padding: 8px 12px;
          border-bottom: 1px solid var(--surface-border);
          max-height: 180px;
          overflow-y: auto;
          scrollbar-width: thin;
        }

        .comm-media-preview-bar::-webkit-scrollbar { width: 4px; }
        .comm-media-preview-bar::-webkit-scrollbar-thumb { background: rgba(156, 255, 0, 0.3); }

        .comm-preview-card {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          background: var(--surface);
          border: 1px solid var(--surface-border);
          border-radius: 10px;
          max-width: 180px;
          animation: slideIn 0.2s ease-out;
        }

        .comm-preview-card.emoji {
          padding: 4px 8px;
        }

        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .comm-preview-emoji {
          font-size: 24px;
          line-height: 1;
        }

        .comm-preview-icon {
          font-size: 20px;
          line-height: 1;
        }

        .comm-preview-info {
          flex: 1;
          min-width: 0;
        }

        .comm-preview-title {
          font-size: 11px;
          font-weight: 600;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .comm-preview-size {
          font-size: 9px;
          color: var(--text-secondary);
          margin-top: 1px;
        }

        .comm-preview-remove {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--danger-bg);
          border: 1px solid var(--danger-border);
          color: var(--danger);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .comm-preview-remove:hover {
          background: var(--danger-bg-strong);
          transform: scale(1.1);
        }

        .comm-msg-input-bar {
          position: relative;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
        }
        .comm-msg-input-bar.announcement-input{align-items:flex-end;flex-wrap:wrap;border-top:1px solid rgba(156,255,0,.2);background:linear-gradient(180deg,rgba(156,255,0,.06),transparent)}
        .comm-announcement-tools{order:-2;flex:1 0 100%;display:flex;align-items:center;gap:10px;min-width:0;padding:2px 0 1px}.comm-announcement-tool-group{display:flex;align-items:center;gap:7px;min-width:0}.comm-announcement-tool-label{display:inline-flex;align-items:center;gap:4px;color:var(--text-secondary);font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em}.comm-announcement-style-list{display:flex;gap:4px}.comm-announcement-style,.comm-announcement-preview-btn{border:1px solid var(--surface-border);border-radius:7px;background:var(--surface);color:var(--text-secondary);font-size:10px;font-weight:700;padding:6px 8px;cursor:pointer;white-space:nowrap}.comm-announcement-style:hover,.comm-announcement-style.selected,.comm-announcement-preview-btn:hover{color:var(--accent);border-color:var(--accent-border);background:var(--accent-bg-soft)}.comm-announcement-colors{display:flex;align-items:center;gap:5px;margin-left:auto}.comm-announcement-color{width:17px;height:17px;padding:0;border:2px solid transparent;border-radius:50%;cursor:pointer;box-shadow:0 0 0 1px rgba(255,255,255,.16)}.comm-announcement-color.selected{box-shadow:0 0 0 2px var(--panel),0 0 0 4px currentColor}.comm-announcement-preview-btn{display:inline-flex;align-items:center;gap:5px;color:var(--accent)}
        .comm-announcement-title{order:-1;flex:1 0 calc(100% - 48px);min-width:0;padding:9px 12px;border:1px solid rgba(156,255,0,.24);border-radius:10px;background:rgba(0,0,0,.2);color:var(--text);font:700 13px inherit;outline:none}
        .comm-announcement-title:focus{border-color:var(--accent-border-strong);box-shadow:0 0 0 3px var(--accent-glow)}
        .comm-announcement-preview-overlay{position:fixed;inset:0;z-index:100200;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(2,5,3,.78);backdrop-filter:blur(12px)}.comm-announcement-preview-modal{width:min(680px,100%);overflow:hidden;border:1px solid var(--accent-border);border-radius:18px;background:var(--panel);box-shadow:0 24px 80px rgba(0,0,0,.65),0 0 40px var(--accent-shadow)}.comm-announcement-preview-header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 20px;border-bottom:1px solid var(--surface-border)}.comm-announcement-preview-header div{display:flex;flex-direction:column;gap:3px}.comm-announcement-preview-header span{color:var(--accent);font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}.comm-announcement-preview-header strong{color:var(--text);font-size:17px}.comm-announcement-preview-header button{display:grid;place-items:center;width:32px;height:32px;border:1px solid var(--surface-border);border-radius:8px;background:var(--surface);color:var(--text-secondary);cursor:pointer}.comm-announcement-preview-stage{min-height:250px;display:grid;place-items:center;padding:40px 28px;background:radial-gradient(circle at 50% 10%,rgba(156,255,0,.1),transparent 55%),linear-gradient(145deg,#0d1510,#090d0b)}.comm-announcement-preview-card{width:min(560px,100%);padding:22px 24px 18px;border:1px solid color-mix(in srgb,var(--announcement-color) 32%,transparent);border-top:4px solid var(--announcement-color);border-radius:16px;background:linear-gradient(145deg,rgba(28,42,25,.98),rgba(10,20,13,.98));color:#f1f9e8;box-shadow:0 16px 40px rgba(0,0,0,.3)}.comm-announcement-preview-card h3{margin:0 0 10px;padding-bottom:10px;border-bottom:1px solid color-mix(in srgb,var(--announcement-color) 28%,transparent);font-size:20px}.comm-announcement-preview-card p{margin:0;white-space:pre-wrap;color:#dbe9d8;font-size:15px;line-height:1.7}.comm-announcement-preview-card small{display:block;margin-top:14px;color:#829783;font-size:10px}.announcement-border-double{border-top-style:double;border-top-width:6px}.announcement-border-dashed{border-top-style:dashed}.announcement-border-glow{box-shadow:0 0 26px color-mix(in srgb,var(--announcement-color) 26%,transparent),0 16px 40px rgba(0,0,0,.3)}.comm-announcement-preview-modal footer{display:flex;justify-content:flex-end;padding:14px 20px;border-top:1px solid var(--surface-border)}.comm-announcement-preview-close{padding:9px 13px;border:1px solid var(--accent-border);border-radius:8px;background:var(--accent-bg-soft);color:var(--accent);font-weight:800;cursor:pointer}
        .comm-mention-menu{position:absolute;bottom:calc(100% + 8px);left:48px;width:min(280px,calc(100vw - 70px));max-height:240px;overflow-y:auto;padding:6px;background:rgba(9,15,11,.98);border:1px solid rgba(156,255,0,.3);border-radius:11px;box-shadow:0 16px 36px rgba(0,0,0,.65);z-index:20}.comm-mention-menu button{width:100%;display:flex;align-items:center;gap:8px;padding:7px;border:0;border-radius:7px;background:transparent;color:#d9eadb;text-align:left;cursor:pointer}.comm-mention-menu button:hover{background:rgba(156,255,0,.1)}.comm-mention-icon{width:25px;height:25px;display:flex;align-items:center;justify-content:center;border-radius:7px;background:rgba(156,255,0,.12);color:#9cff00;font-weight:800}.comm-mention-menu button span:nth-child(2){display:flex;flex-direction:column;gap:2px}.comm-mention-menu strong{font-size:11px}.comm-mention-menu small{font-size:9px;color:#6d876f}

        .comm-plus-btn {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: var(--surface);
          border: 1px solid var(--surface-border);
          color: var(--text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.2s;
        }

        .comm-plus-btn:hover {
          background: var(--accent-bg-soft);
          border-color: var(--accent-border);
          color: var(--accent);
        }

        .comm-plus-btn.active {
          background: var(--accent-bg-soft);
          border-color: var(--accent-border-strong);
          color: var(--accent);
          box-shadow: 0 0 12px var(--accent-shadow);
        }

        .comm-textarea {
          flex: 1;
          min-width: 0;
          background: var(--surface);
          border: 1px solid var(--surface-border);
          border-radius: 20px;
          padding: 10px 16px;
          color: var(--text);
          font-size: 14px;
          font-family: inherit;
          resize: none;
          outline: none;
          line-height: 1.5;
          max-height: 120px;
          overflow-y: auto;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .comm-textarea:focus {
          border-color: var(--accent-border-strong);
          box-shadow: 0 0 0 3px var(--accent-glow-strong);
        }

        .comm-textarea::placeholder {
          color: var(--text-muted);
        }

        .comm-send-btn {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: var(--surface);
          border: 1px solid var(--surface-border);
          color: var(--text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.2s;
        }

        .comm-send-btn.active {
          background: var(--accent-gradient);
          border-color: transparent;
          color: var(--accent-contrast);
          box-shadow: 0 3px 12px var(--accent-shadow);
        }

        .comm-send-btn.active:hover {
          transform: scale(1.08);
        }

        @media(max-width:700px){.comm-announcement-tools{align-items:flex-start;flex-wrap:wrap;gap:7px}.comm-announcement-tool-group{flex:1 0 100%;justify-content:space-between}.comm-announcement-colors{margin-left:0}.comm-announcement-preview-btn{margin-left:auto}.comm-announcement-preview-overlay{padding:0;align-items:stretch}.comm-announcement-preview-modal{width:100%;height:100%;max-height:none;border:0;border-radius:0;display:flex;flex-direction:column}.comm-announcement-preview-stage{flex:1;min-height:0;padding:24px 16px;overflow:auto}.comm-announcement-preview-modal footer{padding:14px 16px}.comm-announcement-preview-close{width:100%;padding:12px}}
      `}</style>
    </div>
  );
};

export default CommunityMessageInput;