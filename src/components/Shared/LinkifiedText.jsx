import React, { useEffect, useState } from "react";
import postService from "../../services/home/postService";
import mediaUrlService from "../../services/shared/mediaUrlService";

const URL_PATTERN = /(https?:\/\/[^\s<]+)/gi;
const TRAILING_PUNCTUATION = /[.,!?;:)\]}>'"]+$/;
const INTERNAL_TYPES = ["post", "reel", "story", "profile", "community", "invite"];
const PLATFORM_META = {
  facebook: { label: "Facebook", color: "#1877f2" },
  instagram: { label: "Instagram", color: "#e1306c" },
  youtube: { label: "YouTube", color: "#ff0000" },
  x: { label: "X", color: "#f5f5f5" },
  twitter: { label: "X", color: "#f5f5f5" },
  tiktok: { label: "TikTok", color: "#25f4ee" },
  linkedin: { label: "LinkedIn", color: "#0a66c2" },
};

const getPlatformMeta = (url) => {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    const key = Object.keys(PLATFORM_META).find((name) => host === `${name}.com` || host.endsWith(`.${name}.com`));
    return key ? { ...PLATFORM_META[key], key } : { label: host || "External link", color: "#a3e635", key: "link" };
  } catch {
    return { label: "External link", color: "#a3e635", key: "link" };
  }
};

const normalizeContentType = (rawType) => {
  const cleaned = String(rawType || "").toLowerCase().replace(/[^a-z0-9_-]+/g, " ").trim();
  return cleaned || "link";
};

const getSharedTarget = (url) => {
  if (!url) return { path: "/", type: "link" };
  try {
    const parsed = new URL(url, window.location.origin);
    const pathname = parsed.pathname || "/";
    const path = `${pathname}${parsed.search}${parsed.hash}`;

    const typeFromPath = pathname.split("/").filter(Boolean)[0] || "link";
    if (INTERNAL_TYPES.includes(typeFromPath)) {
      return { path, type: typeFromPath };
    }

    if (pathname.includes("/share/")) {
      const shareType = pathname.split("/share/")[1]?.split("/")[0] || "link";
      return { path: pathname.replace(/^\/share\//, "/"), type: shareType };
    }

    return { path, type: "link" };
  } catch {
    return { path: "/", type: "link" };
  }
};

export const isInternalXeeviaUrl = (url) => {
  try {
    const host = new URL(url, window.location.origin).hostname.toLowerCase();
    return host === window.location.hostname.toLowerCase() || host.endsWith(".xeevia.com") || host === "xeevia.com";
  } catch {
    return false;
  }
};

export const parseSharedContent = (text) => {
  if (typeof text !== "string") return null;

  const normalized = text.replace(/^📎\s*/, "").trim();
  const match = normalized.match(/^(.+?)\s+shared\s+(?:a\s+)?([a-z0-9_-]+)(?::\s*"[^"]*")?\n(https?:\/\/[^\s]+)(?:\n\n([\s\S]*))?$/i);
  if (match) {
    const senderName = match[1].trim() || "Someone";
    const contentType = normalizeContentType(match[2]);
    return { senderName, contentType, contentLabel: `a ${contentType}`, url: match[3], note: match[4] || "" };
  }

  const legacy = normalized.match(/^shared\s+(?:a\s+)?([a-z0-9_-]+)(?::\s*"[^"]*")?\n(https?:\/\/[^\s]+)(?:\n\n([\s\S]*))?$/i);
  if (legacy) {
    const contentType = normalizeContentType(legacy[1]);
    return { senderName: "Someone", contentType, contentLabel: `a ${contentType}`, url: legacy[2], note: legacy[3] || "" };
  }

  const urlMatch = normalized.match(/(https?:\/\/[^\s]+)/i);
  if (urlMatch) {
    const url = urlMatch[1];
    const { type } = getSharedTarget(url);
    return { senderName: "Someone", contentType: type, contentLabel: `a ${type}`, url, note: "" };
  }

  return null;
};

const LinkSegment = ({ url, trailing, onNavigate, displayMode = "string" }) => {
  const platform = getPlatformMeta(url);
  const internal = isInternalXeeviaUrl(url);

  const path = (() => {
    try { return new URL(url, window.location.origin).pathname; } catch { return ""; }
  })();
  const internalType = path.match(/^\/(post|reel|story|profile|community|invite)\//i)?.[1];
  const internalLabel = internalType
    ? internalType.charAt(0).toUpperCase() + internalType.slice(1)
    : "Link";
  const handleClick = (event) => {
    event.stopPropagation();
    if (internalType && onNavigate) {
      event.preventDefault();
      onNavigate(getSharedTarget(url).path);
    }
  };

  if (displayMode === "embed") {
    const previewTitle = internal ? `Xeevia ${internalLabel.toLowerCase()}` : `${platform.label} link`;
    const hostLabel = internal ? "Xeevia content" : new URL(url).hostname;
    return (
      <span className="xeevia-link-wrap xeevia-link-preview-wrap">
        <a
          className={`xeevia-link-card${internal ? " xeevia-link-card--internal" : ""}`}
          href={url}
          target={internal ? "_self" : "_blank"}
          rel={internal ? "noopener" : "noopener noreferrer"}
          onClick={handleClick}
          style={{ borderLeftColor: internal ? "#a3e635" : platform.color }}
        >
          <span className="xeevia-link-icon" style={{ width: 28, height: 28, flex: "0 0 28px", borderRadius: 7, background: internal ? "rgba(163,230,53,.14)" : "rgba(255,255,255,.08)", display: "grid", placeItems: "center", color: internal ? "#a3e635" : platform.color, fontSize: 12, fontWeight: 800 }}>{internal ? internalLabel.slice(0, 1) : "↗"}</span>
          <span className="xeevia-link-card-copy" style={{ display: "flex", flexDirection: "column", minWidth: 0, maxWidth: "100%", gap: 2 }}><strong style={{ display: "block", maxWidth: "100%", color: internal ? "#d9f99d" : platform.color, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{previewTitle}</strong><small style={{ display: "block", maxWidth: "100%", color: "rgba(255,255,255,.58)", fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{hostLabel}</small></span>
          <span className="xeevia-link-open" style={{ marginLeft: "auto", color: internal ? "#a3e635" : platform.color, flex: "0 0 auto" }} aria-hidden="true">↗</span>
        </a>
        {trailing}
      </span>
    );
  }

  return (
    <span className="xeevia-link-wrap">
      <a className="app-link" href={url} aria-label={internalType ? `View ${internalType.toLowerCase()}` : "Open link"} target={internal ? "_self" : "_blank"} rel={internal ? "noopener" : "noopener noreferrer"} onClick={handleClick} style={{ color: internal ? "#a3e635" : platform.color, textDecoration: "none", overflowWrap: "anywhere" }}>
        {internalType ? `View ${internalType.toLowerCase()}` : url}
      </a>
      {trailing}
    </span>
  );
};

const LinkifiedText = ({ children, className, onNavigate, displayMode = "embed", previewOnly = false }) => {
  if (typeof children !== "string") return children;

  const parts = children.split(URL_PATTERN);
  if (previewOnly) {
    const url = children.replace(TRAILING_PUNCTUATION, "");
    if (!/^https?:\/\//i.test(url)) return null;
    return <LinkSegment url={url} trailing="" onNavigate={onNavigate} displayMode="embed" />;
  }
  const previewUrls = displayMode === "embed"
    ? parts
      .filter((part) => /^https?:\/\//i.test(part))
      .map((part) => part.replace(TRAILING_PUNCTUATION, ""))
    : [];
  return (
    <span className={`xeevia-linkified-text${className ? ` ${className}` : ""}`}>
      {parts.map((part, index) => {
        if (!/^https?:\/\//i.test(part)) return <React.Fragment key={index}>{part}</React.Fragment>;

        const trailingMatch = part.match(TRAILING_PUNCTUATION);
        const trailing = trailingMatch?.[0] || "";
        const url = trailing ? part.slice(0, -trailing.length) : part;
        return <LinkSegment key={index} url={url} trailing={trailing} onNavigate={onNavigate} displayMode="string" />;
      })}
      {previewUrls.map((url) => (
        <span key={`preview-${url}`} className="xeevia-link-preview-line">
          <LinkSegment url={url} trailing="" onNavigate={onNavigate} displayMode="embed" />
        </span>
      ))}
      <style>{`.xeevia-link-preview-line{display:block;width:100%;margin-top:10px;clear:both}.xeevia-link-preview-wrap{display:block;width:100%;max-width:100%;min-width:0}.xeevia-link-card{display:flex;align-items:center;gap:9px;width:min(100%,420px);max-width:100%;min-width:0;box-sizing:border-box;padding:8px 10px;border:1px solid rgba(163,230,53,.4);border-left:3px solid #a3e635;border-radius:9px;background:rgba(0,0,0,.28);color:#f4f7ee;text-decoration:none;overflow:hidden}.xeevia-link-icon{width:28px;height:28px;flex:0 0 28px;border-radius:7px;background:rgba(255,255,255,.08)}.xeevia-link-open{margin-left:auto;flex:0 0 auto}.xeevia-link-preview-wrap + .xeevia-link-preview-wrap{margin-top:8px}@media(max-width:768px){.xeevia-link-card{width:90%;margin-left:0}.xeevia-link-preview-line{margin-top:12px}}`}</style>
    </span>
  );
};

export const getExternalUrls = (text = "") => String(text).match(URL_PATTERN)?.map((url) => url.replace(TRAILING_PUNCTUATION, "")).filter((url) => !isInternalXeeviaUrl(url)) || [];

export const SharedContentMessage = ({ children, onNavigate, isMine = false, showSender = true, senderDisplayName }) => {
  const shared = parseSharedContent(children);
  if (!shared) return <LinkifiedText onNavigate={onNavigate}>{children}</LinkifiedText>;

  const target = getSharedTarget(shared.url);
  const path = target.path;
  const displayType = normalizeContentType(target.type || shared.contentType || "link");
  const prettyType = displayType === "profile" ? "profile" : displayType;
  const senderLabel = senderDisplayName || (isMine ? "You" : (shared.senderName || "Someone"));
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (displayType !== "post") return undefined;
    const postId = path.split("/").filter(Boolean).pop();
    if (!postId) return undefined;
    let active = true;
    postService.getPost(postId).then((post) => {
      if (!active || !post) return;
      const imageId = Array.isArray(post.image_ids) ? post.image_ids[0] : null;
      const imageMetadata = Array.isArray(post.image_metadata) ? post.image_metadata[0] : null;
      const image = imageMetadata?.url || imageMetadata?.publicUrl || mediaUrlService.getImageUrl(imageId, { width: 720, height: 420, crop: "fill", gravity: "auto", quality: "auto:good", format: "auto" });
      setPreview({ image: image || null, title: post.card_caption || post.content || "Xeevia post", author: post.profiles?.full_name || post.profiles?.username || "Xeevia creator" });
    }).catch(() => {});
    return () => { active = false; };
  }, [displayType, path]);

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 7, maxWidth: "100%", minWidth: 0 }}>
      {showSender && (
        <strong style={{ fontSize: 13, color: "#f4f7ee", fontWeight: 700 }}>
          {senderLabel} shared {shared.contentLabel}
        </strong>
      )}
      <a
        className="app-link shared-content-link"
        href={shared.url}
        aria-label={`View ${prettyType}`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (onNavigate) {
            onNavigate(path);
            return;
          }
          if (typeof window !== "undefined") {
            window.location.assign(shared.url);
          }
        }}
        style={{ display: "flex", flexDirection: "column", width: "min(100%, 420px)", overflow: "hidden", borderRadius: 10, color: "#f4f7ee", background: "rgba(255,255,255,.06)", border: "1px solid rgba(163,230,53,.34)", fontSize: 12, fontWeight: 800, textDecoration: "none" }}
      >
        {preview?.image && <img src={preview.image} alt="" loading="lazy" style={{ display: "block", width: "100%", maxHeight: 220, objectFit: "cover" }} />}
        <span style={{ display: "flex", flexDirection: "column", gap: 3, padding: "9px 11px" }}>
          <span style={{ color: "#bef264", fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em" }}>Xeevia {prettyType}</span>
          <strong style={{ color: "#f4f7ee", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview?.title || `Open ${prettyType}`}</strong>
          {preview?.author && <small style={{ color: "rgba(255,255,255,.58)", fontWeight: 500 }}>{preview.author}</small>}
        </span>
      </a>
      {shared.note && <span style={{ color: "rgba(255,255,255,.72)", fontSize: 12, whiteSpace: "pre-wrap" }}><LinkifiedText onNavigate={onNavigate}>{shared.note}</LinkifiedText></span>}
    </span>
  );
};

export default LinkifiedText;
