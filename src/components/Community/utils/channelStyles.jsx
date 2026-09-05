// components/Community/utils/channelStyles.jsx
// Single source of truth for channel-button appearance. Owners pick a
// buttonStyle + dividerStyle in Settings → Channel Appearance; every
// channel rail (desktop ChatTab, mobile ChannelsView) renders through
// <ChannelButton/> so both stay visually identical.
import React from "react";
import { Hash, Megaphone, Volume2, Lock } from "lucide-react";

export const CHANNEL_BUTTON_STYLES = [
  { id: "fill-rounded",   label: "Filled rounded" },
  { id: "pill",           label: "Pill" },
  { id: "border-bottom",  label: "Underline" },
  { id: "no-radius",      label: "Sharp corners" },
  { id: "dashed-outline", label: "Dashed outline" },
  { id: "ghost-hover",    label: "Ghost" },
  { id: "left-accent",    label: "Left accent bar" },
  { id: "glass",          label: "Glass" },
  { id: "minimal-text",   label: "Minimal text" },
  { id: "gradient-glow",  label: "Gradient glow" },
];

export const CHANNEL_DIVIDER_STYLES = [
  { id: "none",           label: "None" },
  { id: "dot-solid",      label: "Solid dot" },
  { id: "dot-outline",    label: "Outline dot" },
  { id: "line-thin",      label: "Thin line" },
  { id: "line-gradient",  label: "Gradient line" },
  { id: "bracket",        label: "Bracket ›" },
];

const CHANNEL_TYPE_ICON = { text: Hash, announcement: Megaphone, voice: Volume2 };

export function renderChannelIcon(channel) {
  const icon = channel.icon;
  if (!icon) return <Hash size={14} />;
  if (icon.startsWith("http")) return <img src={icon} alt="" className="chb-icon-img" />;
  if (icon.length <= 2) return <span className="chb-emoji">{icon}</span>;
  const Icon = CHANNEL_TYPE_ICON[channel.type] || Hash;
  return <Icon size={14} />;
}

let _injected = false;
function injectChannelButtonStyles() {
  if (_injected || typeof document === "undefined") return;
  const el = document.createElement("style");
  el.textContent = CHANNEL_BUTTON_CSS;
  document.head.appendChild(el);
  _injected = true;
}

export default function ChannelButton({
  channel,
  active,
  buttonStyle = "fill-rounded",
  dividerStyle = "none",
  onClick,
  onContextMenu,
  draggable = false,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}) {
  injectChannelButtonStyles();
  return (
    <button
      type="button"
      className={`chb chb--${buttonStyle}${active ? " active" : ""}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      title={channel.name}
    >
      <span className="chb-icon">{renderChannelIcon(channel)}</span>
      {dividerStyle !== "none" && <span className={`chb-div chb-div--${dividerStyle}`} />}
      <span className="chb-name">{channel.name}</span>
      {(channel.is_private || channel.is_locked) && <Lock size={12} className="chb-lock" />}
    </button>
  );
}

const CHANNEL_BUTTON_CSS = `
.chb{display:flex;align-items:center;gap:8px;width:100%;min-height:40px;padding:0 11px;border:1px solid transparent;background:transparent;color:rgba(255,255,255,.72);font-size:13px;font-weight:700;cursor:pointer;position:relative;transition:all .18s cubic-bezier(.34,1.56,.64,1);text-align:left;font-family:inherit;border-radius:12px}
.chb:hover{color:rgba(255,255,255,.92)}
.chb-icon{display:flex;align-items:center;justify-content:center;width:16px;height:16px;flex-shrink:0;opacity:.85}
.chb-icon-img{width:16px;height:16px;border-radius:4px;object-fit:cover}
.chb-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
.chb-lock{margin-left:auto;opacity:.5;flex-shrink:0}

.chb-div--dot-solid{width:4px;height:4px;border-radius:50%;background:currentColor;opacity:.5;flex-shrink:0}
.chb-div--dot-outline{width:5px;height:5px;border-radius:50%;border:1px solid currentColor;opacity:.5;flex-shrink:0}
.chb-div--line-thin{width:1px;height:14px;background:rgba(255,255,255,.14);flex-shrink:0}
.chb-div--line-gradient{width:2px;height:16px;background:linear-gradient(180deg,rgba(156,255,0,.6),transparent);flex-shrink:0}
.chb-div--bracket{font-size:10px;opacity:.4;flex-shrink:0}
.chb-div--bracket::before{content:"›"}

.chb--fill-rounded{border-radius:12px;background:linear-gradient(180deg,rgba(255,255,255,.025),rgba(255,255,255,.01));border-color:rgba(255,255,255,.05)}
.chb--fill-rounded:hover{background:linear-gradient(180deg,rgba(156,255,0,.08),rgba(92,105,255,.04));border-color:rgba(156,255,0,.22)}
.chb--fill-rounded.active{background:linear-gradient(135deg,rgba(156,255,0,.13),rgba(92,105,255,.07));border-color:rgba(156,255,0,.3);color:var(--accent)}

.chb--pill{border-radius:999px;background:rgba(255,255,255,.02);padding:0 14px}
.chb--pill:hover{background:rgba(156,255,0,.08)}
.chb--pill.active{background:rgba(156,255,0,.14);color:var(--accent)}

.chb--border-bottom{border-radius:0;border-bottom:2px solid transparent;padding-left:6px}
.chb--border-bottom:hover{border-bottom-color:rgba(156,255,0,.3)}
.chb--border-bottom.active{border-bottom-color:var(--accent);color:var(--accent)}

.chb--no-radius{border-radius:0;border:1px solid rgba(255,255,255,.05)}
.chb--no-radius:hover{border-color:rgba(156,255,0,.2)}
.chb--no-radius.active{border-color:rgba(156,255,0,.35);background:rgba(156,255,0,.06);color:var(--accent)}

.chb--dashed-outline{border-radius:10px;border:1px dashed rgba(255,255,255,.14);background:transparent}
.chb--dashed-outline:hover{border-color:rgba(156,255,0,.4)}
.chb--dashed-outline.active{border-color:var(--accent);color:var(--accent)}

.chb--ghost-hover{border-radius:10px}
.chb--ghost-hover:hover{background:rgba(255,255,255,.04)}
.chb--ghost-hover.active{color:var(--accent);font-weight:800}

.chb--left-accent{border-radius:8px;padding-left:14px}
.chb--left-accent::before{content:"";position:absolute;left:2px;top:50%;transform:translateY(-50%);width:2px;height:0;background:var(--accent);transition:height .18s;border-radius:2px}
.chb--left-accent.active::before{height:60%}
.chb--left-accent.active{color:var(--accent);background:rgba(156,255,0,.05)}

.chb--glass{border-radius:12px;background:rgba(255,255,255,.03);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.06)}
.chb--glass:hover{background:rgba(255,255,255,.06)}
.chb--glass.active{background:rgba(156,255,0,.1);border-color:rgba(156,255,0,.25);color:var(--accent)}

.chb--minimal-text{padding-left:4px}
.chb--minimal-text:hover{color:#fff}
.chb--minimal-text.active{color:var(--accent);font-weight:900}

.chb--gradient-glow{border-radius:12px}
.chb--gradient-glow.active{background:linear-gradient(135deg,rgba(156,255,0,.18),rgba(92,105,255,.1));box-shadow:0 0 20px -6px rgba(156,255,0,.4);color:var(--accent)}
.chb--gradient-glow:hover{background:linear-gradient(135deg,rgba(156,255,0,.08),rgba(92,105,255,.04))}
`;