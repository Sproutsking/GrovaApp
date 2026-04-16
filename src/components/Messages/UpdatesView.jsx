// components/Messages/UpdatesView.jsx — NOVA UPDATES v5 BEAUTIFUL
// ============================================================================
// FIXES:
//  [CRASH-FIX]   No supabase.rpc().catch() — uses async/await + try/catch only
//  [DESIGN]      WhatsApp-style status rings elevated with segmented arcs,
//                progress bars, fullscreen viewer, reactions, DM reply
//  [SEEN]        Local seen-tracking via localStorage (no extra DB table)
//  [BADGE]       registerUpdatesBadgeSetter API preserved for DMMessagesView
//  [ADD-STATUS]  Text status with gradient backgrounds + color picker
// ============================================================================

import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import { supabase } from "../../services/config/supabase";
import mediaUrlService from "../../services/shared/mediaUrlService";

// ── Badge setter ──────────────────────────────────────────────────────────────
let _badgeSetter = null;
export const registerUpdatesBadgeSetter = (fn) => { _badgeSetter = fn; };

const STORY_DURATION = 6000;

const BG_PRESETS = [
  { bg: "linear-gradient(135deg,#0d1117,#161b22)", label: "Void" },
  { bg: "linear-gradient(135deg,#0a1628,#0d2137)", label: "Navy" },
  { bg: "linear-gradient(135deg,#0d1a00,#1a3300)", label: "Forest" },
  { bg: "linear-gradient(135deg,#1a001a,#35006b)", label: "Royal" },
  { bg: "linear-gradient(135deg,#1a0000,#400000)", label: "Ember" },
  { bg: "linear-gradient(135deg,#00101a,#001f33)", label: "Ocean" },
  { bg: "linear-gradient(135deg,#1a0d00,#332000)", label: "Amber" },
  { bg: "linear-gradient(135deg,#002a00,#004d00)", label: "Jade" },
];

const TEXT_COLORS = ["#ffffff","#84cc16","#60a5fa","#f59e0b","#ef4444","#a855f7","#06b6d4","#10b981","#f97316","#ec4899"];

// ── Helpers ───────────────────────────────────────────────────────────────────
const timeAgo = (date) => {
  if (!date) return "";
  const ms = Date.now() - new Date(date).getTime();
  if (ms < 60000) return "just now";
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
  return "1d ago";
};

const getSeenKey = (userId) => `uv_seen_${userId}`;

// ── Avatar ────────────────────────────────────────────────────────────────────
const Av = memo(({ user, size = 48, ringColor = null, ringWidth = 2.5 }) => {
  const [err, setErr] = useState(false);
  const avId = user?.avatar_id || user?.avatarId;
  const url = !err && avId ? mediaUrlService.getAvatarUrl(avId, 200) : null;
  const ini = (user?.full_name || user?.name || user?.fullName || "?").charAt(0).toUpperCase();

  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", overflow: "hidden",
      background: "linear-gradient(135deg,#0d1a00,#1a3300)",
      border: ringColor ? `${ringWidth}px solid ${ringColor}` : `${ringWidth}px solid rgba(255,255,255,0.08)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 700, color: "#84cc16",
      flexShrink: 0, boxSizing: "border-box",
    }}>
      {url
        ? <img src={url} alt={ini} onError={() => setErr(true)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : ini
      }
    </div>
  );
});
Av.displayName = "Av";

// ── Segmented story ring ──────────────────────────────────────────────────────
const StoryRing = memo(({ group, isMe, onOpen }) => {
  const { user, statuses, hasUnseen } = group;
  const firstName = isMe ? "My Status" : (user?.full_name || user?.name || "?").split(" ")[0];
  const total = statuses.length;

  const RADIUS = 27;
  const CIRCUM = 2 * Math.PI * RADIUS;
  const GAP = total > 1 ? 4 : 0;
  const segLen = total > 0 ? (CIRCUM - GAP * total) / total : CIRCUM;

  const ringColor = isMe && total === 0 ? "#555" : hasUnseen ? "#84cc16" : "rgba(255,255,255,0.2)";

  return (
    <button
      onClick={onOpen}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
        cursor: "pointer", flexShrink: 0, background: "none", border: "none",
        padding: "2px 4px", transition: "transform .15s",
      }}
      onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
      onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
    >
      <div style={{ position: "relative", width: 62, height: 62, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width={62} height={62} style={{ position: "absolute", inset: 0 }}>
          {total === 0 ? (
            <circle cx={31} cy={31} r={RADIUS} fill="none" stroke={ringColor} strokeWidth={2.5} strokeDasharray={`${CIRCUM} ${CIRCUM}`} transform="rotate(-90 31 31)" />
          ) : (
            statuses.map((s, i) => {
              const offset = CIRCUM - i * (segLen + GAP);
              const seenColor = s._seen ? "rgba(255,255,255,0.18)" : "#84cc16";
              return (
                <circle
                  key={i}
                  cx={31} cy={31} r={RADIUS}
                  fill="none"
                  stroke={isMe ? "#60a5fa" : seenColor}
                  strokeWidth={2.5}
                  strokeDasharray={`${segLen} ${CIRCUM - segLen}`}
                  strokeDashoffset={-offset + CIRCUM}
                  transform="rotate(-90 31 31)"
                  strokeLinecap="round"
                />
              );
            })
          )}
        </svg>
        <Av user={user} size={50} ringColor="transparent" ringWidth={0} />
        {isMe && total === 0 && (
          <div style={{
            position: "absolute", bottom: 2, right: 2, width: 20, height: 20,
            borderRadius: "50%", background: "#84cc16", border: "2px solid #000",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 800, color: "#000", zIndex: 2,
          }}>+</div>
        )}
      </div>
      <span style={{
        fontSize: 10, color: "#777", maxWidth: 64, textAlign: "center",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block",
      }}>
        {firstName}
      </span>
    </button>
  );
});
StoryRing.displayName = "StoryRing";

// ── Story Viewer ──────────────────────────────────────────────────────────────
const StoryViewer = memo(({ groups, startGroupIdx, startStoryIdx, userId, onClose, onOpenDM, onMarkSeen }) => {
  const [gIdx, setGIdx] = useState(startGroupIdx);
  const [sIdx, setSIdx] = useState(startStoryIdx);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [replyText, setReplyText] = useState("");
  const [showReply, setShowReply] = useState(false);

  const timerRef = useRef(null);
  const touchX = useRef(null);
  const touchY = useRef(null);

  const currentGroup = groups[gIdx];
  const currentStory = currentGroup?.statuses?.[sIdx];
  const isMyStory = currentGroup?.user?.id === userId || currentGroup?.isMe;

  useEffect(() => {
    if (!currentStory) return;
    setProgress(0);
    setLikeCount(currentStory.likes || 0);
    setLiked(false);
    onMarkSeen?.(currentStory.id);
  }, [gIdx, sIdx]);

  useEffect(() => {
    if (paused || !currentStory) return;
    clearInterval(timerRef.current);
    const step = 100 / (STORY_DURATION / 50);
    timerRef.current = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { advanceStory(); return 0; }
        return p + step;
      });
    }, 50);
    return () => clearInterval(timerRef.current);
  }, [gIdx, sIdx, paused]);

  const advanceStory = useCallback(() => {
    const group = groups[gIdx];
    if (!group) return;
    if (sIdx < group.statuses.length - 1) { setSIdx(s => s + 1); setProgress(0); }
    else if (gIdx < groups.length - 1) { setGIdx(g => g + 1); setSIdx(0); setProgress(0); }
    else { onClose(); }
  }, [gIdx, sIdx, groups, onClose]);

  const retreatStory = useCallback(() => {
    if (sIdx > 0) { setSIdx(s => s - 1); setProgress(0); }
    else if (gIdx > 0) { setGIdx(g => g - 1); setSIdx(0); setProgress(0); }
  }, [gIdx, sIdx]);

  const handleTap = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX - rect.left < rect.width * 0.35) retreatStory();
    else advanceStory();
  };

  const handleLike = async () => {
    if (!currentStory || isMyStory) return;
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount(c => Math.max(0, c + (newLiked ? 1 : -1)));
    try {
      if (newLiked) {
        await supabase.from("status_likes").insert({ status_id: currentStory.id, user_id: userId });
        const { data: s } = await supabase.from("status_updates").select("likes").eq("id", currentStory.id).maybeSingle();
        if (s) await supabase.from("status_updates").update({ likes: (s.likes || 0) + 1 }).eq("id", currentStory.id);
      } else {
        await supabase.from("status_likes").delete().eq("status_id", currentStory.id).eq("user_id", userId);
        const { data: s } = await supabase.from("status_updates").select("likes").eq("id", currentStory.id).maybeSingle();
        if (s) await supabase.from("status_updates").update({ likes: Math.max(0, (s.likes || 1) - 1) }).eq("id", currentStory.id);
      }
    } catch {}
  };

  const handleReply = () => {
    if (!replyText.trim()) return;
    onOpenDM?.({
      userId: currentGroup.user?.id,
      replyToStatus: { ...currentStory, text: replyText.trim() || currentStory.text },
    });
    onClose();
  };

  if (!currentGroup || !currentStory) return null;

  const bg = currentStory.bg || "linear-gradient(135deg,#0d1117,#161b22)";
  const textColor = currentStory.text_color || "#ffffff";
  const imageUrl = currentStory.image_id
    ? (mediaUrlService.getImageUrl?.(currentStory.image_id) || mediaUrlService.getAvatarUrl?.(currentStory.image_id, 800))
    : null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99990, background: "#000",
      display: "flex", alignItems: "stretch", justifyContent: "center",
    }}>
      {/* Desktop prev area */}
      <div
        style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 24, cursor: "pointer" }}
        onClick={retreatStory}
      >
        {window.innerWidth > 540 && (
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 20 }}>‹</div>
        )}
      </div>

      {/* Story card */}
      <div style={{ width: "100%", maxWidth: 420, position: "relative", overflow: "hidden", background: imageUrl ? "#000" : bg }}>

        {/* Progress bars */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, zIndex: 20,
          padding: "10px 10px 0", display: "flex", gap: 3,
          background: "linear-gradient(180deg,rgba(0,0,0,0.55),transparent)",
          paddingBottom: 10,
        }}>
          {currentGroup.statuses.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 2.5, borderRadius: 2, background: "rgba(255,255,255,0.25)", overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 2, background: "#fff",
                width: i < sIdx ? "100%" : i === sIdx ? `${progress}%` : "0%",
                transition: i === sIdx ? "none" : "width 0s",
              }} />
            </div>
          ))}
        </div>

        {/* Header */}
        <div style={{
          position: "absolute", top: 22, left: 0, right: 0, zIndex: 20,
          display: "flex", alignItems: "center", gap: 10, padding: "6px 14px",
        }}>
          <Av user={currentGroup.user} size={38} ringColor="rgba(255,255,255,0.35)" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: "-.2px" }}>
              {currentGroup.user?.full_name || currentGroup.user?.name}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{timeAgo(currentStory.created_at)}</div>
          </div>
          {!isMyStory && (
            <button
              onClick={handleLike}
              style={{
                background: liked ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.1)",
                border: `1px solid ${liked ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.2)"}`,
                width: 36, height: 36, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", fontSize: 16, transition: "all .15s",
              }}>
              {liked ? "❤️" : "🤍"}
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.35)",
              border: "1px solid rgba(255,255,255,0.15)", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 16,
            }}>✕</button>
        </div>

        {/* Content area — tap zone */}
        <div
          style={{
            position: "absolute", inset: 0, display: "flex",
            alignItems: "center", justifyContent: "center",
            padding: "90px 24px 100px", cursor: "pointer",
          }}
          onClick={handleTap}
          onTouchStart={e => { touchX.current = e.touches[0].clientX; touchY.current = e.touches[0].clientY; setPaused(true); }}
          onTouchEnd={e => {
            const dx = e.changedTouches[0].clientX - (touchX.current || 0);
            const dy = e.changedTouches[0].clientY - (touchY.current || 0);
            setPaused(false);
            if (dy > 80) { onClose(); return; }
            if (Math.abs(dx) > 50) { dx > 0 ? retreatStory() : advanceStory(); }
          }}
        >
          {imageUrl && (
            <img src={imageUrl} alt="" style={{
              position: "absolute", inset: 0, width: "100%", height: "100%",
              objectFit: "cover", zIndex: 0,
            }} />
          )}
          {currentStory.text && (
            <div style={{
              position: "relative", zIndex: 1,
              fontSize: currentStory.text.length > 120 ? 18 : currentStory.text.length > 60 ? 22 : 28,
              fontWeight: 800, color: textColor, textAlign: "center",
              lineHeight: 1.45, letterSpacing: "-.3px",
              textShadow: imageUrl ? "0 2px 12px rgba(0,0,0,0.9), 0 0 32px rgba(0,0,0,0.7)" : "none",
              maxWidth: "100%", wordBreak: "break-word",
              background: imageUrl ? "rgba(0,0,0,0.35)" : "transparent",
              padding: imageUrl ? "14px 18px" : 0,
              borderRadius: imageUrl ? 12 : 0,
            }}>
              {currentStory.text}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 20,
          padding: "0 14px calc(env(safe-area-inset-bottom,0px) + 20px)",
          background: "linear-gradient(0deg,rgba(0,0,0,0.75) 0%,transparent 100%)",
          paddingTop: 40,
        }}>
          {isMyStory ? (
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", gap: 5 }}>
                <span>👁</span> {currentStory.views || 0}
              </span>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", gap: 5 }}>
                <span>❤️</span> {likeCount}
              </span>
            </div>
          ) : showReply ? (
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder={`Reply to ${(currentGroup.user?.full_name || "").split(" ")[0]}...`}
                autoFocus
                onKeyDown={e => e.key === "Enter" && handleReply()}
                style={{
                  flex: 1, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)",
                  borderRadius: 22, padding: "10px 16px", color: "#fff", fontSize: 13,
                  outline: "none", caretColor: "#84cc16",
                }}
              />
              <button
                onClick={handleReply}
                style={{
                  width: 42, height: 42, borderRadius: "50%", background: "#84cc16", border: "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", fontSize: 18, color: "#000",
                }}>➤</button>
              <button onClick={() => setShowReply(false)} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "50%", width: 42, height: 42, color: "#fff", cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button
                onClick={() => { setPaused(true); setShowReply(true); }}
                style={{
                  flex: 1, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: 24, padding: "11px 16px", color: "rgba(255,255,255,0.8)", fontSize: 13,
                  textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                }}>
                <span>💬</span> Reply...
              </button>
              <button
                onClick={() => { onOpenDM?.({ userId: currentGroup.user?.id, replyToStatus: currentStory }); onClose(); }}
                style={{
                  width: 44, height: 44, borderRadius: "50%", background: "rgba(132,204,22,0.15)",
                  border: "1px solid rgba(132,204,22,0.35)", color: "#84cc16",
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 18,
                }}>📤</button>
            </div>
          )}
        </div>
      </div>

      {/* Desktop next area */}
      <div
        style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-start", paddingLeft: 24, cursor: "pointer" }}
        onClick={advanceStory}
      >
        {window.innerWidth > 540 && (
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 20 }}>›</div>
        )}
      </div>
    </div>
  );
});
StoryViewer.displayName = "StoryViewer";

// ── Add Status Modal ──────────────────────────────────────────────────────────
const AddStatusModal = memo(({ currentUser, userId, onClose, onAdded }) => {
  const [text, setText] = useState("");
  const [bg, setBg] = useState(BG_PRESETS[0].bg);
  const [textColor, setTextColor] = useState("#ffffff");
  const [posting, setPosting] = useState(false);
  const taRef = useRef(null);

  useEffect(() => { taRef.current?.focus(); }, []);

  const handlePost = async () => {
    if (!text.trim() || posting) return;
    setPosting(true);
    try {
      const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const { data, error } = await supabase
        .from("status_updates")
        .insert({
          user_id: userId,
          text: text.trim(),
          bg,
          text_color: textColor,
          media_type: "text",
          duration_h: 24,
          expires_at: expiresAt,
          views: 0,
          likes: 0,
        })
        .select()
        .single();
      if (error) throw error;
      onAdded?.(data);
      onClose();
    } catch (e) {
      console.warn("[AddStatus]", e.message);
    } finally {
      setPosting(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99992, background: "rgba(0,0,0,0.9)",
      backdropFilter: "blur(16px)", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: 24, gap: 16,
      animation: "uvFadeIn .3s cubic-bezier(.34,1.56,.64,1)",
    }}>
      <div style={{ position: "absolute", top: 16, right: 16 }}>
        <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", cursor: "pointer", fontSize: 16 }}>✕</button>
      </div>

      {/* Preview */}
      <div style={{
        width: "100%", maxWidth: 340, height: 220, borderRadius: 20, overflow: "hidden",
        background: bg, display: "flex", alignItems: "center", justifyContent: "center",
        border: "1px solid rgba(255,255,255,0.08)",
        fontSize: text.length > 80 ? 18 : 24, fontWeight: 700, color: textColor,
        padding: 24, textAlign: "center", lineHeight: 1.45, wordBreak: "break-word",
        letterSpacing: text.length > 80 ? "-.2px" : "-.3px",
      }}>
        {text || <span style={{ opacity: 0.25 }}>Preview your status...</span>}
      </div>

      <textarea
        ref={taRef}
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="What's on your mind?"
        maxLength={280}
        rows={3}
        style={{
          width: "100%", maxWidth: 340, background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14,
          color: "#fff", fontSize: 15, padding: "12px 16px", outline: "none",
          resize: "none", fontFamily: "inherit", caretColor: "#84cc16",
          lineHeight: 1.5,
        }}
        onFocus={e => e.target.style.borderColor = "rgba(132,204,22,.35)"}
        onBlur={e => e.target.style.borderColor = "rgba(255,255,255,.1)"}
      />

      {/* BG presets */}
      <div style={{ width: "100%", maxWidth: 340 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#444", textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 8 }}>Background</div>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
          {BG_PRESETS.map((p, i) => (
            <button key={i} onClick={() => setBg(p.bg)} style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: p.bg, border: bg === p.bg ? "2.5px solid #84cc16" : "2px solid rgba(255,255,255,0.08)",
              cursor: "pointer", transition: "border .15s",
            }} title={p.label} />
          ))}
        </div>
      </div>

      {/* Text color */}
      <div style={{ width: "100%", maxWidth: 340 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#444", textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 8 }}>Text color</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {TEXT_COLORS.map((c, i) => (
            <button key={i} onClick={() => setTextColor(c)} style={{
              width: 28, height: 28, borderRadius: "50%", background: c,
              border: textColor === c ? "2.5px solid #84cc16" : "2px solid rgba(255,255,255,0.12)",
              cursor: "pointer", transition: "border .15s",
            }} />
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, width: "100%", maxWidth: 340 }}>
        <button onClick={onClose} style={{
          flex: 1, padding: 13, borderRadius: 14, background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.1)", color: "#888", fontSize: 14, fontWeight: 700, cursor: "pointer",
        }}>Cancel</button>
        <button onClick={handlePost} disabled={!text.trim() || posting} style={{
          flex: 2, padding: 13, borderRadius: 14, fontSize: 14, fontWeight: 800,
          background: text.trim() ? "linear-gradient(135deg,#84cc16,#65a30d)" : "rgba(255,255,255,0.04)",
          color: text.trim() ? "#000" : "#333", border: "none",
          cursor: text.trim() ? "pointer" : "not-allowed", transition: "all .15s",
        }}>
          {posting ? "Sharing..." : "Share Status ✓"}
        </button>
      </div>
    </div>
  );
});
AddStatusModal.displayName = "AddStatusModal";

// ── Status List Item ──────────────────────────────────────────────────────────
const StatusItem = memo(({ group, isSeen, onClick }) => {
  const latest = group.statuses[group.statuses.length - 1];
  const preview = latest?.text ? latest.text.slice(0, 55) + (latest.text.length > 55 ? "…" : "") : "📷 Photo";

  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 14, padding: "12px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.035)", cursor: "pointer",
        transition: "background .15s", opacity: isSeen ? 0.65 : 1,
      }}
      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.025)"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      <div style={{ position: "relative", flexShrink: 0 }}>
        <svg width={58} height={58} style={{ position: "absolute", top: -4, left: -4 }}>
          {group.statuses.map((s, i) => {
            const total = group.statuses.length;
            const RADIUS = 27;
            const CIRCUM = 2 * Math.PI * RADIUS;
            const GAP = total > 1 ? 3 : 0;
            const segLen = (CIRCUM - GAP * total) / total;
            const offset = CIRCUM - i * (segLen + GAP);
            const color = isSeen ? "rgba(255,255,255,0.18)" : "#84cc16";
            return (
              <circle key={i} cx={29} cy={29} r={RADIUS} fill="none" stroke={color} strokeWidth={2.5}
                strokeDasharray={`${segLen} ${CIRCUM - segLen}`} strokeDashoffset={-offset + CIRCUM}
                transform="rotate(-90 29 29)" strokeLinecap="round" />
            );
          })}
        </svg>
        <Av user={group.user} size={50} ringColor="transparent" ringWidth={0} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: isSeen ? "#666" : "#fff", marginBottom: 3, display: "flex", alignItems: "center", gap: 8 }}>
          {group.user?.full_name}
        </div>
        <div style={{ fontSize: 12, color: "#444", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {preview} · {timeAgo(latest?.created_at)}
        </div>
      </div>
      {!isSeen && (
        <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#84cc16", flexShrink: 0 }} />
      )}
    </div>
  );
});
StatusItem.displayName = "StatusItem";

// ── Main UpdatesView ──────────────────────────────────────────────────────────
const UpdatesView = ({ currentUser, userId, onOpenDM }) => {
  const [myStatuses, setMyStatuses] = useState([]);
  const [feedGroups, setFeedGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewer, setViewer] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const seenRef = useRef(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(getSeenKey(userId));
      if (raw) seenRef.current = new Set(JSON.parse(raw));
    } catch {}
  }, [userId]);

  const markSeen = useCallback(async (statusId) => {
    if (!statusId || seenRef.current.has(statusId)) return;
    seenRef.current.add(statusId);
    try { localStorage.setItem(getSeenKey(userId), JSON.stringify([...seenRef.current])); } catch {}
    try {
      // ✅ CRASH FIX: Use await + try/catch instead of .rpc().catch()
      const { data: curr } = await supabase
        .from("status_updates")
        .select("views")
        .eq("id", statusId)
        .maybeSingle();
      if (curr !== null && curr !== undefined) {
        await supabase
          .from("status_updates")
          .update({ views: (curr?.views || 0) + 1 })
          .eq("id", statusId);
      }
    } catch {}
  }, [userId]);

  const loadStatuses = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const now = new Date().toISOString();

      // ✅ My statuses
      const { data: mine } = await supabase
        .from("status_updates")
        .select("*")
        .eq("user_id", userId)
        .gt("expires_at", now)
        .order("created_at", { ascending: true });

      setMyStatuses((mine || []).map(s => ({ ...s, _seen: seenRef.current.has(s.id) })));

      // ✅ Followed user IDs
      const { data: followData } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", userId);

      const followedIds = (followData || []).map(f => f.following_id).filter(Boolean);

      if (followedIds.length === 0) {
        setFeedGroups([]);
        _badgeSetter?.(0);
        setLoading(false);
        return;
      }

      // ✅ Their statuses
      const { data: statuses } = await supabase
        .from("status_updates")
        .select(`*, user:profiles!status_updates_user_id_fkey(id,full_name,username,avatar_id,verified)`)
        .in("user_id", followedIds)
        .gt("expires_at", now)
        .order("created_at", { ascending: true });

      // Group by user
      const groupMap = new Map();
      (statuses || []).forEach(s => {
        if (!s.user_id) return;
        if (!groupMap.has(s.user_id)) {
          groupMap.set(s.user_id, { user: s.user, statuses: [], hasUnseen: false });
        }
        const seen = seenRef.current.has(s.id);
        if (!seen) groupMap.get(s.user_id).hasUnseen = true;
        groupMap.get(s.user_id).statuses.push({ ...s, _seen: seen });
      });

      const groups = Array.from(groupMap.values()).sort((a, b) => (b.hasUnseen ? 1 : 0) - (a.hasUnseen ? 1 : 0));
      setFeedGroups(groups);

      const unseenCount = groups.reduce((acc, g) => acc + (g.hasUnseen ? 1 : 0), 0);
      _badgeSetter?.(unseenCount);

    } catch (e) {
      console.warn("[UpdatesView] loadStatuses:", e.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { loadStatuses(); }, [loadStatuses]);

  useEffect(() => {
    const h = () => setShowAdd(true);
    document.addEventListener("dm:addStory", h);
    return () => document.removeEventListener("dm:addStory", h);
  }, []);

  // Subscribe to realtime new statuses from followed users
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`status_feed_${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "status_updates" }, () => {
        loadStatuses();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, loadStatuses]);

  const myUser = {
    id: userId,
    full_name: currentUser?.fullName || currentUser?.full_name || currentUser?.name || "You",
    avatar_id: currentUser?.avatarId || currentUser?.avatar_id,
  };

  const myGroup = { user: myUser, statuses: myStatuses, hasUnseen: false, isMe: true };
  const allGroups = [myGroup, ...feedGroups];

  const openViewer = (groupIdx, storyIdx = 0) => {
    const story = allGroups[groupIdx]?.statuses?.[storyIdx];
    if (story) markSeen(story.id);
    setViewer({ groupIdx, storyIdx });
  };

  const unseenGroups = feedGroups.filter(g => g.hasUnseen);
  const seenGroups = feedGroups.filter(g => !g.hasUnseen);

  return (
    <div style={{ height: "100%", overflowY: "auto", background: "#000", display: "flex", flexDirection: "column" }}>

      {/* ── Story rings strip ── */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(4,4,4,0.6)" }}>
        <div style={{
          display: "flex", gap: 6, padding: "12px 14px",
          overflowX: "auto", scrollbarWidth: "none",
        }}>
          <StoryRing
            group={myGroup}
            isMe
            onOpen={() => myStatuses.length > 0 ? openViewer(0) : setShowAdd(true)}
          />
          {feedGroups.map((g, i) => (
            <StoryRing key={g.user?.id || i} group={g} onOpen={() => openViewer(i + 1)} />
          ))}
          {loading && [0, 1, 2, 3].map(i => (
            <div key={i} style={{
              width: 62, height: 62, borderRadius: "50%",
              background: "rgba(255,255,255,0.04)",
              animation: `uvPulse 1.4s ${i * 0.15}s ease-in-out infinite`,
              flexShrink: 0,
            }} />
          ))}
        </div>
      </div>

      {/* ── My status card ── */}
      <div
        onClick={() => myStatuses.length > 0 ? openViewer(0) : setShowAdd(true)}
        style={{
          display: "flex", alignItems: "center", gap: 14, padding: "13px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", transition: "background .15s",
        }}
        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
      >
        <div style={{ position: "relative" }}>
          <Av user={myUser} size={54} ringColor={myStatuses.length > 0 ? "#60a5fa" : "rgba(255,255,255,0.08)"} />
          {myStatuses.length === 0 && (
            <div style={{
              position: "absolute", bottom: 0, right: 0, width: 20, height: 20, borderRadius: "50%",
              background: "#84cc16", border: "2.5px solid #000", display: "flex",
              alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#000",
            }}>+</div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>My Status</div>
          <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>
            {myStatuses.length === 0
              ? "Tap to add a status update"
              : `${myStatuses.length} update${myStatuses.length > 1 ? "s" : ""} · expires in 24h`}
          </div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); setShowAdd(true); }}
          style={{
            padding: "6px 14px", borderRadius: 20, background: "rgba(132,204,22,0.1)",
            border: "1px solid rgba(132,204,22,0.3)", color: "#84cc16",
            fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0,
          }}>
          + Add
        </button>
      </div>

      {/* ── Recent updates ── */}
      {!loading && unseenGroups.length > 0 && (
        <>
          <div style={{ padding: "10px 16px 3px", fontSize: 10, fontWeight: 700, color: "#333", textTransform: "uppercase", letterSpacing: ".7px" }}>
            Recent updates
          </div>
          {unseenGroups.map(g => (
            <StatusItem
              key={g.user?.id}
              group={g}
              isSeen={false}
              onClick={() => openViewer(allGroups.indexOf(g))}
            />
          ))}
        </>
      )}

      {/* ── Viewed updates ── */}
      {!loading && seenGroups.length > 0 && (
        <>
          <div style={{ padding: "10px 16px 3px", fontSize: 10, fontWeight: 700, color: "#333", textTransform: "uppercase", letterSpacing: ".7px" }}>
            Viewed
          </div>
          {seenGroups.map(g => (
            <StatusItem
              key={g.user?.id}
              group={g}
              isSeen
              onClick={() => openViewer(allGroups.indexOf(g))}
            />
          ))}
        </>
      )}

      {/* ── Empty ── */}
      {!loading && feedGroups.length === 0 && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 24px", gap: 12, textAlign: "center" }}>
          <div style={{ fontSize: 52 }}>📡</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#555" }}>No status updates yet</div>
          <div style={{ fontSize: 13, color: "#333", lineHeight: 1.6 }}>Follow people to see their status updates here, or add your own.</div>
          <button onClick={() => setShowAdd(true)} style={{
            marginTop: 8, padding: "10px 22px", borderRadius: 22,
            background: "rgba(132,204,22,0.1)", border: "1px solid rgba(132,204,22,0.3)",
            color: "#84cc16", fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}>Add My First Status</button>
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading && (
        <div style={{ padding: "8px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} style={{
              height: 74, borderRadius: 14, background: "rgba(255,255,255,0.03)",
              animation: `uvPulse 1.4s ${i * 0.1}s ease-in-out infinite`,
            }} />
          ))}
        </div>
      )}

      {/* ── Viewer ── */}
      {viewer && (
        <StoryViewer
          groups={allGroups}
          startGroupIdx={viewer.groupIdx}
          startStoryIdx={viewer.storyIdx}
          userId={userId}
          onClose={() => setViewer(null)}
          onOpenDM={onOpenDM}
          onMarkSeen={markSeen}
        />
      )}

      {/* ── Add status ── */}
      {showAdd && (
        <AddStatusModal
          currentUser={currentUser}
          userId={userId}
          onClose={() => setShowAdd(false)}
          onAdded={(s) => setMyStatuses(prev => [...prev, { ...s, _seen: true }])}
        />
      )}

      <style>{`
        @keyframes uvPulse { 0%,100%{opacity:.5}50%{opacity:.12} }
        @keyframes uvFadeIn { from{opacity:0;transform:scale(.96)} to{opacity:1;transform:scale(1)} }
      `}</style>
    </div>
  );
};

export default UpdatesView;