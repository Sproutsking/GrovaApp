import React, { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import statusUpdateService from "../../services/messages/statusUpdateService";
import mediaUrlService from "../../services/shared/mediaUrlService";

const formatDisplayName = (user) => {
  if (!user) return "You";
  const name = user.full_name || user.username || "You";
  return name.length > 10 ? `${name.slice(0, 9)}…` : name;
};

const getMediaUrl = (imageId) => {
  if (!imageId) return null;
  if (typeof imageId === "string" && imageId.startsWith("http")) return imageId;
  try {
    const url = mediaUrlService.getImageUrl?.(imageId, { width: 240, quality: "auto:good", format: "auto" });
    return url || null;
  } catch {
    return null;
  }
};

const StatusBubble = ({ group, currentUser, isMe, onClick, isCompact = false }) => {
  const [imageError, setImageError] = useState(false);
  const status = group.latest;
  const profile = group.profile || status?.profile || currentUser;
  const avatar = mediaUrlService.getAvatarUrl?.(profile?.avatar_id, 120) || getMediaUrl(profile?.avatar_id);
  const statusMedia = !imageError ? getMediaUrl(status?.image_id) : null;
  const label = isMe ? "Your status" : formatDisplayName(profile);
  const statuses = group.statuses || [];
  const ringColors = ["#a3e635", "#22d3ee", "#60a5fa", "#c084fc"];
  const ringSize = isCompact ? 52 : 62;
  const ringCenter = ringSize / 2;
  const ringRadius = ringCenter - 2.5;
  const circumference = 2 * Math.PI * ringRadius;
  const gap = statuses.length > 1 ? Math.min(5, circumference / statuses.length * 0.18) : 0;
  const segment = statuses.length ? circumference / statuses.length - gap : circumference;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}${statuses.length ? `, ${statuses.length} active ${statuses.length === 1 ? "status" : "statuses"}` : ", create a status"}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: "pointer",
        color: "inherit",
        minWidth: isCompact ? 58 : 68,
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
          {statuses.length ? statuses.map((item, index) => (
            <circle
              key={item.id || index}
              cx={ringCenter}
              cy={ringCenter}
              r={ringRadius}
              fill="none"
              stroke={ringColors[index % ringColors.length]}
              strokeWidth="2.5"
              strokeDasharray={`${segment} ${circumference - segment}`}
              strokeDashoffset={-(index * circumference / statuses.length)}
              strokeLinecap="round"
            />
          )) : <circle cx={ringCenter} cy={ringCenter} r={ringRadius} fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="2" strokeDasharray="2 4"/>}
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 5,
            borderRadius: "50%",
            background: "#121416",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid rgba(255,255,255,.08)",
          }}
        >
          {statusMedia ? (
            <img
              src={statusMedia}
              alt={label}
              onError={() => setImageError(true)}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : avatar ? (
            <img src={avatar} alt="" onError={() => setImageError(true)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
                fontSize: 16,
              }}
            >
              {isMe && statuses.length === 0 ? <Plus size={18} /> : (label || "U").charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        {isMe && statuses.length === 0 && <span aria-hidden="true" style={{ position: "absolute", right: -1, bottom: -1, width: 20, height: 20, borderRadius: "50%", display: "grid", placeItems: "center", color: "#071000", background: "#a3e635", border: "2px solid #07090b" }}><Plus size={12}/></span>}
      </div>
      <span
        style={{
          fontSize: 10,
          color: "#dfe7f2",
          lineHeight: 1.2,
          maxWidth: isCompact ? 58 : 60,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </button>
  );
};

export default function StatusUpdatesStrip({ currentUser, onOpenStatus }) {
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!currentUser?.id) {
        setStatuses([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [{ data = [] }, mine = []] = await Promise.all([
          statusUpdateService.loadAll(0, 60),
          statusUpdateService.loadForUser(currentUser.id),
        ]);
        if (!mounted) return;
        const unique = new Map();
        [...(data || []), ...(mine || [])].forEach((item) => {
          if (item?.id && item?.user_id) unique.set(item.id, item);
        });
        const filtered = Array.from(unique.values()).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setStatuses(filtered);
      } catch {
        if (mounted) setStatuses([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    const refresh = () => load();
    window.addEventListener("status-updates:changed", refresh);
    return () => {
      mounted = false;
      window.removeEventListener("status-updates:changed", refresh);
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
    return [...me, ...groups.values()].slice(0, 8);
  }, [currentUser, statuses]);

  return (
    <div style={{
      padding: "9px 16px 5px",
      background: "linear-gradient(90deg,rgba(132,204,22,.035),rgba(6,8,10,.3) 36%,rgba(34,211,238,.025))",
      borderBottom: "1px solid rgba(255,255,255,0.04)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 2px 7px", color: "rgba(255,255,255,.42)", fontSize: 9, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase" }}>
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#a3e635", boxShadow: "0 0 8px rgba(163,230,53,.7)" }} />
        Status
        <span style={{ flex: 1, height: 1, background: "linear-gradient(90deg,rgba(255,255,255,.1),transparent)" }} />
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          overflowX: "auto",
          padding: "2px 2px 5px",
          scrollbarWidth: "none",
        }}
      >
        {loading ? (
          <div style={{ display: "flex", gap: 12 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ width: 62, height: 62, borderRadius: 999, background: "rgba(255,255,255,0.05)" }} />
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
