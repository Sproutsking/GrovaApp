import React from "react";

const URL_PATTERN = /(https?:\/\/[^\s<]+)/gi;
const TRAILING_PUNCTUATION = /[.,!?;:)\]}>'"]+$/;

export const parseSharedContent = (text) => {
  if (typeof text !== "string") return null;
  const normalized = text.replace(/^📎\s*/, "");
  const match = normalized.match(/^(.+?) shared (?:a )?(post|reel|story)(?::\s*"[^"]*")?\n(https?:\/\/[^\s]+)(?:\n\n([\s\S]*))?$/i);
  if (match) return { senderName: match[1], contentLabel: `a ${match[2].toLowerCase()}`, url: match[3], note: match[4] || "" };

  const legacy = text.match(/^📎\s*Shared a (post|reel|story)(?::\s*"[^"]*")?\n(https?:\/\/[^\s]+)(?:\n\n([\s\S]*))?$/i);
  return legacy ? { senderName: "Someone", contentLabel: `a ${legacy[1].toLowerCase()}`, url: legacy[2], note: legacy[3] || "" } : null;
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

export const SharedContentMessage = ({ children, onNavigate }) => {
  const shared = parseSharedContent(children);
  if (!shared) return <LinkifiedText onNavigate={onNavigate}>{children}</LinkifiedText>;
  let path = shared.url;
  try {
    const url = new URL(shared.url, window.location.origin);
    path = `${url.pathname}${url.search}${url.hash}`;
  } catch {}

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 7, maxWidth: "100%" }}>
      <strong style={{ fontSize: 13, color: "#f4f7ee", fontWeight: 700 }}>{shared.senderName} shared {shared.contentLabel}</strong>
      <a className="app-link shared-content-link" href={shared.url} onClick={(event) => { event.preventDefault(); event.stopPropagation(); onNavigate?.(path); }} style={{ display: "inline-flex", width: "fit-content", padding: "7px 10px", borderRadius: 8, color: "#0b1205", background: "linear-gradient(135deg,#bef264,#84cc16)", fontSize: 12, fontWeight: 800, textDecoration: "none" }}>
        View {shared.contentLabel.replace(/^a /i, "")}
      </a>
      {shared.note && <span style={{ color: "rgba(255,255,255,.72)", fontSize: 12, whiteSpace: "pre-wrap" }}><LinkifiedText onNavigate={onNavigate}>{shared.note}</LinkifiedText></span>}
    </span>
  );
};

export default LinkifiedText;
