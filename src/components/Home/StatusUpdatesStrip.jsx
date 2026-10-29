import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import statusUpdateService, { isVideoStatus } from "../../services/messages/statusUpdateService";
import mediaUrlService from "../../services/shared/mediaUrlService";
import { supabase } from "../../services/config/supabase";

const formatDisplayName = (user) => {
  if (!user) return "You";
  const name = user.full_name || user.username || "You";
  return name.length > 10 ? `${name.slice(0, 9)}…` : name;
};

const getMediaUrl = (imageId) => {
  if (!imageId) return null;
  if (typeof imageId === "string" && imageId.startsWith("http")) return imageId;
  try {
    return mediaUrlService.getImageUrl?.(imageId, { width: 240, quality: "auto:good", format: "auto" }) || null;
  } catch {
    return null;
  }
};

const getStatusMediaUrl = (imageId, isVideo = false) => {
  if (!imageId) return null;
  if (typeof imageId === "string" && imageId.startsWith("http")) return imageId;
  const statusUrl = statusUpdateService.getMediaUrl?.(imageId);
  if (statusUrl) return statusUrl;
  if (isVideo) return mediaUrlService.getVideoUrl?.(imageId, { quality: "auto", format: "mp4" }) || null;
  return getMediaUrl(imageId);
};

const getProfileAvatarUrls = (profile) => {
  const profileAvatar = profile?.avatar;
  const isImageUrl = (value) => typeof value === "string" && /^(https?:\/\/|data:image\/|blob:)/i.test(value);
  const avatarIsImage = profileAvatar && (
    typeof profileAvatar === "object" || isImageUrl(profileAvatar)
  );
  const sources = [
    profile?.avatar_url,
    profile?.avatarUrl,
    avatarIsImage ? profileAvatar : null,
    profile?.avatar_id,
    profile?.avatarId,
    profile?.user_metadata?.avatar_url,
    profile?.user_metadata?.picture,
  ].filter(Boolean);

  return [...new Set(sources.flatMap((source) => {
    const resolved = mediaUrlService.resolveAvatarUrls?.(source, 120);
    return resolved?.length ? resolved : [mediaUrlService.getAvatarUrl?.(source, 120)];
  }).filter(Boolean))];
};

export const StatusBubble = ({ group, currentUser, isMe, onClick, isCompact = false }) => {
  const [imageError, setImageError] = useState(false);
  const [avatarIndex, setAvatarIndex] = useState(0);
  const status = group.latest;
  useEffect(() => setImageError(false), [status?.id]);
  const profile = group.profile || status?.profile || currentUser;
  const avatarUrls = getProfileAvatarUrls(profile);
  const avatar = avatarUrls[avatarIndex] || null;
  useEffect(() => setAvatarIndex(0), [profile?.avatar, profile?.avatar_id, profile?.avatarId, profile?.avatar_url, profile?.avatarUrl]);
  const videoStatus = isVideoStatus(status);
  const statusMedia = !imageError ? getStatusMediaUrl(status?.image_id, videoStatus) : null;
  const videoPoster = videoStatus && statusMedia
    ? mediaUrlService.getVideoThumbnail?.(statusMedia, { width: 160, height: 160, time: "0.2" })
    : null;
  const label = isMe ? "Your status" : formatDisplayName(profile);
  const statusText = status?.text?.trim();
  const statuses = group.statuses || [];
  const ringSize = isMe ? 64 : isCompact ? 58 : 68;
  const ringCenter = ringSize / 2;
  const ringStroke = 3;
  const ringRadius = ringCenter - ringStroke - 3;
  const circumference = 2 * Math.PI * ringRadius;
  const gapDegrees = statuses.length > 1 ? (statuses.length <= 4 ? 4 : 3) : 0;
  const segmentDegrees = statuses.length ? (360 - gapDegrees * statuses.length) / statuses.length : 360;
  const segment = segmentDegrees / 360 * circumference;

  return (
    <button
      type="button"
      className={isMe ? "status-owner-card" : undefined}
      onClick={onClick}
      aria-label={`${label}${statuses.length ? `, ${statuses.length} active ${statuses.length === 1 ? "status" : "statuses"}` : ", create a status"}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: isMe ? 0 : 6,
        background: "transparent",
        border: "none",
        borderRadius: 0,
        padding: 0,
        cursor: "pointer",
        color: "inherit",
        minWidth: isMe ? ringSize : isCompact ? 48 : 74,
        minHeight: ringSize,
        textAlign: "center",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: "relative",
          width: ringSize,
          height: ringSize,
          borderRadius: "50%",
          padding: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg aria-hidden="true" viewBox={`0 0 ${ringSize} ${ringSize}`} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
          <circle cx={ringCenter} cy={ringCenter} r={ringRadius} fill="none" stroke="rgba(132,204,22,.25)" strokeWidth={ringStroke} />
          {statuses.length ? statuses.map((item, index) => (
            <circle
              key={item.id || index}
              cx={ringCenter}
              cy={ringCenter}
              r={ringRadius}
              fill="none"
              stroke="#84cc16"
              strokeWidth={ringStroke}
              strokeDasharray={`${segment} ${circumference - segment}`}
              strokeDashoffset={-(index * (segmentDegrees + gapDegrees) / 360) * circumference}
              strokeLinecap="butt"
              opacity=".95"
            />
          )) : <circle cx={ringCenter} cy={ringCenter} r={ringRadius} fill="none" stroke="rgba(132,204,22,.25)" strokeWidth={ringStroke} strokeDasharray="4 4"/>}
        </svg>
        <div
          style={{
            position: "absolute",
            inset: ringStroke + 3,
            borderRadius: "50%",
            background: "#121416",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
          }}
        >
          {isMe ? (avatar && !imageError
            ? <img src={avatar} alt="" onError={() => setAvatarIndex((index) => index + 1)} style={{ display: "block", width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }} />
            : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", background: "linear-gradient(145deg,rgba(132,204,22,.2),rgba(255,255,255,.04))", color: "#d7f9ad", fontWeight: 800 }}>{(label || "U").charAt(0).toUpperCase()}</div>
          ) : statusMedia && videoStatus ? (
            <video
              src={statusMedia}
              poster={videoPoster || undefined}
              muted
              playsInline
              preload="metadata"
              onError={() => setImageError(true)}
              onLoadedData={(event) => {
                const video = event.currentTarget;
                if (video.duration > 0 && video.currentTime === 0) video.currentTime = Math.min(0.2, video.duration / 2);
              }}
              style={{ width: "100%", height: "100%", objectFit: "cover", background: status.bg || "#121416" }}
            />
          ) : statusMedia ? (
            <img
              src={statusMedia}
              alt={label}
              onError={() => setImageError(true)}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : status ? (
            <div
              style={{
                width: "100%",
                height: "100%",
                padding: 5,
                boxSizing: "border-box",
                display: "grid",
                placeItems: "center",
                overflow: "hidden",
                background: status.bg || "linear-gradient(145deg,#13210a,#263a16)",
                color: status.text_color || "#fff",
                fontSize: statusText?.length > 50 ? 8 : statusText?.length > 25 ? 9 : 10,
                lineHeight: 1.15,
                fontWeight: 800,
                textAlign: "center",
                wordBreak: "break-word",
              }}
            >
              {statusText || (status.media_type === "video" ? "▶" : "Status")}
            </div>
          ) : avatar ? (
            <img src={avatar} alt="" onError={() => setAvatarIndex((index) => index + 1)} style={{ display: "block", width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }} />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "linear-gradient(145deg, rgba(132,204,22,.16), rgba(255,255,255,.04))",
                color: "#d7f9ad",
                fontWeight: 800,
                fontSize: 17,
              }}
            >
              {(label || "U").charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        {isMe && statuses.length === 0 && (
          <span aria-hidden="true" style={{ position:"absolute", right:1, bottom:1, width:19, height:19, display:"grid", placeItems:"center", border:"2px solid #080a07", borderRadius:"50%", color:"#17210b", background:"#bef264" }}>
            <Plus size={9} strokeWidth={3} />
          </span>
        )}
      </div>
      {!isMe && (
        <span
          style={{
            fontSize: 10,
            color: "#dfe7f2",
            lineHeight: 1.2,
            maxWidth: isCompact ? 52 : 60,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
      )}
    </button>
  );
};

export default function StatusUpdatesStrip({ currentUser, onOpenStatus }) {
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const hasLoaded = useRef(false);

  useEffect(() => {
    let mounted = true;
    let requestVersion = 0;
    let refreshTimer = null;
    const load = async () => {
      if (!currentUser?.id) {
        hasLoaded.current = false;
        setStatuses([]);
        setLoading(false);
        return;
      }
      const request = ++requestVersion;
      if (!hasLoaded.current) setLoading(true);
      try {
        const { data: followRows, error: followError } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", currentUser.id)
          .order("created_at", { ascending: false })
          .limit(1000);
        if (followError) throw followError;
        const followedIds = (followRows || []).map((row) => row.following_id).filter(Boolean);
        const data = await statusUpdateService.loadForUsers([currentUser.id, ...followedIds]);
        if (!mounted || request !== requestVersion) return;
        const filtered = (data || []).filter((item) => item?.id && item?.user_id)
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setStatuses(filtered);
        hasLoaded.current = true;
      } catch {
        if (mounted && request === requestVersion && !hasLoaded.current) {
          setStatuses([]);
          hasLoaded.current = true;
        }
      } finally {
        if (mounted && request === requestVersion) setLoading(false);
      }
    };
    hasLoaded.current = false;
    setStatuses([]);
    setLoading(Boolean(currentUser?.id));
    load();
    const refresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(load, 120);
    };
    window.addEventListener("status-updates:changed", refresh);
    window.addEventListener("xeevia:follows-changed", refresh);
    const channel = currentUser?.id ? supabase.channel(`home-status-strip:${currentUser.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "status_updates" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "follows", filter: `follower_id=eq.${currentUser.id}` }, refresh)
      .subscribe() : null;
    return () => {
      mounted = false;
      window.clearTimeout(refreshTimer);
      window.removeEventListener("status-updates:changed", refresh);
      window.removeEventListener("xeevia:follows-changed", refresh);
      if (channel) supabase.removeChannel(channel);
    };
  }, [currentUser?.id]);

  const items = useMemo(() => {
    const mine = statuses.filter((status) => status.user_id === currentUser?.id);
    const me = currentUser ? [{
      id: mine[0]?.id || `me-${currentUser.id}`,
      user_id: currentUser.id,
      profile: currentUser,
      latest: mine[0] || null,
      statuses: mine,
      isMe: true,
    }] : [];
    const groups = new Map();
    statuses.filter((status) => status.user_id !== currentUser?.id).forEach((status) => {
      if (!groups.has(status.user_id)) {
        groups.set(status.user_id, { id: status.user_id, user_id: status.user_id, profile: status.profile, latest: status, statuses: [] });
      }
      groups.get(status.user_id).statuses.push(status);
    });
    return [...me, ...groups.values()];
  }, [currentUser, statuses]);

  return (
    <div style={{
      padding: "4px 12px",
      background: "rgba(6,8,10,.16)",
      borderBottom: "1px solid var(--surface-border)",
    }}>
      <style>{`.status-owner-card{border-radius:50%;}.status-owner-card:hover{filter:brightness(1.08)}.status-owner-card:focus-visible{outline:2px solid #bef264;outline-offset:3px;border-radius:50%;}`}</style>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          overflowX: "auto",
          padding: "1px 1px",
          scrollbarWidth: "none",
        }}
      >
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,0.035)" }} />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ width: 42, height: 42, borderRadius: 999, background: "rgba(255,255,255,0.035)" }} />
            ))}
          </div>
        ) : (
          items.map((item, idx) => {
            const isMe = Boolean(item.isMe);
            const onClick = () => {
              if (typeof onOpenStatus === "function") onOpenStatus(item);
            };
            return (
              <div key={item?.id || `${item?.user_id || "me"}-${idx}`} style={{ display: "flex" }}>
                <StatusBubble
                  group={item}
                  currentUser={currentUser}
                  isMe={isMe}
                  onClick={onClick}
                  isCompact={true}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
