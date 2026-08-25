import React from "react";

const URL_PATTERN = /(https?:\/\/[^\s<]+)/gi;
const TRAILING_PUNCTUATION = /[.,!?;:)\]}>'"]+$/;

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
    if (["post", "reel", "story", "profile", "community", "invite"].includes(typeFromPath)) {
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

const LinkifiedText = ({ children, className, onNavigate }) => {
  if (typeof children !== "string") return children;

  const parts = children.split(URL_PATTERN);
  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (!/^https?:\/\//i.test(part)) return <React.Fragment key={index}>{part}</React.Fragment>;

        const trailingMatch = part.match(TRAILING_PUNCTUATION);
        const trailing = trailingMatch?.[0] || "";
        const url = trailing ? part.slice(0, -trailing.length) : part;
        const path = (() => {
          try { return new URL(url).pathname; } catch { return ""; }
        })();
        const linkLabel = path.match(/^\/(post|reel|story)\//i)?.[1];
        const label = linkLabel ? `View ${linkLabel.toLowerCase()}` : "Open link";

        return (
          <React.Fragment key={index}>
            <a
              className="app-link"
              href={url}
              target="_self"
              rel="noopener"
              onClick={(event) => {
                event.stopPropagation();
                if (linkLabel && onNavigate) {
                  event.preventDefault();
                  onNavigate(path);
                }
              }}
              style={{ color: "#a3e635", textDecoration: "underline", textDecorationColor: "rgba(163,230,53,.55)", textUnderlineOffset: 3, overflowWrap: "anywhere" }}
            >
              {label}
            </a>
            {trailing}
          </React.Fragment>
        );
      })}
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
