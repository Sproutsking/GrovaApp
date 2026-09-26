import React, { useEffect, useMemo, useState } from "react";
import { Plus, Sparkles } from "lucide-react";
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

const StatusBubble = ({ status, currentUser, isMe, onClick, isCompact = false }) => {
  const [imageError, setImageError] = useState(false);
  const avatar = getMediaUrl(status?.profile?.avatar_id || currentUser?.avatar_id);
  const statusMedia = !imageError ? getMediaUrl(status?.image_id) : null;
  const label = isMe ? "Your status" : formatDisplayName(status?.profile || currentUser);

  return (
    <button
      type="button"
      onClick={onClick}
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
        minWidth: isCompact ? 54 : 68,
      }}
    >
      <div
        style={{
          position: "relative",
          width: isCompact ? 52 : 62,
          height: isCompact ? 52 : 62,
          borderRadius: "50%",
          padding: 2,
          background: "linear-gradient(135deg, rgba(132,204,22,.9), rgba(168,85,247,.7), rgba(59,130,246,.8))",
          boxShadow: "0 10px 26px rgba(132,204,22,.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            background: "#121416",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px solid rgba(255,255,255,.08)",
          }}
        >
          {statusMedia ? (
            <img
              src={statusMedia}
              alt={label}
              onError={() => setImageError(true)}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
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
              {isMe ? <Plus size={18} /> : (label || "U").charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>
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
    </button>
  );
};

export default function StatusUpdatesStrip({ currentUser, onOpenStatus }) {
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const { data = [] } = await statusUpdateService.loadAll(0, 10);
        if (!mounted) return;
        const filtered = (data || []).filter((item) => item && item.user_id);
        setStatuses(filtered);
      } catch {
        if (mounted) setStatuses([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  const items = useMemo(() => {
    const me = currentUser ? [{ user_id: currentUser.id, profile: currentUser, isMe: true, image_id: null }] : [];
    const existing = (statuses || []).slice(0, 7);
    return [...me, ...existing].slice(0, 8);
  }, [currentUser, statuses]);

  return (
    <div style={{
      padding: "12px 12px 4px",
      background: "rgba(6,8,10,0.24)",
      borderBottom: "1px solid rgba(255,255,255,0.04)",
    }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          overflowX: "auto",
          padding: "4px 2px 8px",
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
                  status={item}
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
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#e5f7bf", fontSize: 12, fontWeight: 700, paddingLeft: 4 }}>
        <Sparkles size={12} />
        Status updates
      </div>
    </div>
  );
}
