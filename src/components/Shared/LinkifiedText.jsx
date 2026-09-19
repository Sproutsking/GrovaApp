import React from "react";

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

const isInternalXeeviaUrl = (url) => {
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
  const handleClick = (event) => {
    event.stopPropagation();
    if (internalType && onNavigate) {
      event.preventDefault();
      onNavigate(getSharedTarget(url).path);
    }
  };

  if (displayMode === "embed" && !internal) {
    return (
      <span className="xeevia-link-wrap" style={{ display: "inline" }}>
        <a className="xeevia-link-card" href={url} target="_blank" rel="noopener noreferrer" onClick={handleClick} style={{ display: "inline-flex", alignItems: "center", gap: 9, width: "min(100%, 320px)", minWidth: 0, boxSizing: "border-box", padding: "8px 10px", border: `1px solid ${platform.color}66`, borderLeft: `3px solid ${platform.color}`, borderRadius: 9, background: "rgba(0,0,0,.28)", color: "#f4f7ee", textDecoration: "none", overflow: "hidden" }}>
          <img className="xeevia-link-icon" style={{ width: 28, height: 28, flex: "0 0 28px", borderRadius: 7, background: "rgba(255,255,255,.08)" }} src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(url).hostname)}&sz=64`} alt="" loading="lazy" />
          <span className="xeevia-link-card-copy" style={{ display: "flex", flexDirection: "column", minWidth: 0, gap: 2 }}><strong style={{ color: platform.color, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{platform.label} link</strong><small style={{ color: "rgba(255,255,255,.58)", fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{new URL(url).hostname}</small></span>
          <span className="xeevia-link-open" style={{ marginLeft: "auto", color: platform.color, flex: "0 0 auto" }} aria-hidden="true">↗</span>
        </a>
        {trailing}
      </span>
    );
  }

  return (
    <span className="xeevia-link-wrap">
      <a className="app-link" href={url} aria-label={internalType ? `View ${internalType.toLowerCase()}` : "Open link"} target={internal ? "_self" : "_blank"} rel={internal ? "noopener" : "noopener noreferrer"} onClick={handleClick} style={{ color: internal ? "#a3e635" : platform.color, textDecoration: "underline", textDecorationColor: `${platform.color}8c`, textUnderlineOffset: 3, overflowWrap: "anywhere" }}>
        {internalType ? `View ${internalType.toLowerCase()}` : url}
      </a>
      {trailing}
    </span>
  );
};

const LinkifiedText = ({ children, className, onNavigate, displayMode = "string" }) => {
  if (typeof children !== "string") return children;

  const parts = children.split(URL_PATTERN);
  const previewUrls = displayMode === "embed"
    ? parts.filter((part) => /^https?:\/\//i.test(part)).map((part) => part.replace(TRAILING_PUNCTUATION, ""))
    : [];
  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (!/^https?:\/\//i.test(part)) return <React.Fragment key={index}>{part}</React.Fragment>;

        const trailingMatch = part.match(TRAILING_PUNCTUATION);
        const trailing = trailingMatch?.[0] || "";
        const url = trailing ? part.slice(0, -trailing.length) : part;
        return <LinkSegment key={index} url={url} trailing={trailing} onNavigate={onNavigate} displayMode={displayMode} />;
      })}
      {previewUrls.map((url) => (
        <span key={`preview-${url}`} style={{ display: "block", width: "100%", marginTop: 10 }}>
          <LinkSegment url={url} trailing="" onNavigate={onNavigate} displayMode="embed" />
        </span>
      ))}
    </span>
  );
};

export const SharedContentMessage = ({ children, onNavigate, isMine = false, showSender = true, senderDisplayName }) => {
  const shared = parseSharedContent(children);
  if (!shared) return <LinkifiedText onNavigate={onNavigate}>{children}</LinkifiedText>;

  const target = getSharedTarget(shared.url);
  const path = target.path;
  const displayType = normalizeContentType(target.type || shared.contentType || "link");
  const prettyType = displayType === "profile" ? "profile" : displayType;
  const senderLabel = senderDisplayName || (isMine ? "You" : (shared.senderName || "Someone"));

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 7, maxWidth: "100%" }}>
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
        style={{ display: "inline-flex", width: "fit-content", padding: "7px 10px", borderRadius: 8, color: "#0b1205", background: "linear-gradient(135deg,#bef264,#84cc16)", fontSize: 12, fontWeight: 800, textDecoration: "none" }}
      >
        View {prettyType}
      </a>
      {shared.note && <span style={{ color: "rgba(255,255,255,.72)", fontSize: 12, whiteSpace: "pre-wrap" }}><LinkifiedText onNavigate={onNavigate}>{shared.note}</LinkifiedText></span>}
    </span>
  );
};

export default LinkifiedText;
