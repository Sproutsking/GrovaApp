// src/components/Admin/sections/InviteSection.jsx — v14
// ─────────────────────────────────────────────────────────────────────────────
// BASE: v13 (TYPE-SLIDES + DATA-SYNC) — preserved exactly.
// SURGICAL ADDITIONS:
//  [A] APP_URL — reads REACT_APP_APP_URL env, falls back to window.location.origin
//  [B] Copy Code button — copies raw invite code string (e.g. "SDTW5HV2")
//  [C] Share sheet — ↗ Share opens native share on mobile / dropdown on desktop
//      Channels: WhatsApp, Twitter/X, Telegram, Copy Link, Copy Code
//  [D] Waitlist manager modal — clicking "⏳ N waiting" badge opens modal with
//      per-user Approve/Deny + bulk Approve All / Approve N.
//      Approve: moves user_id → whitelisted_user_ids (PaywallGate v39 fix [5] picks it up)
//  [E] Public entry link card — live APP_URL as copyable+shareable link row
//      + optional "Override app URL" field that saves to paywall_config.app_url
// ─────────────────────────────────────────────────────────────────────────────
/* eslint-disable no-unused-vars */
import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import { supabase } from "../../../services/config/supabase";
import {
  fetchPaywallConfig,
  updatePaywallConfig,
} from "../../../services/auth/paywallDataService";

// ── [A] APP URL ───────────────────────────────────────────────────────────────
const APP_URL =
  process.env.REACT_APP_APP_URL ||
  (typeof window !== "undefined" ? window.location.origin : "");

// ── Constants ─────────────────────────────────────────────────────────────────
const CATEGORY_OPTIONS = [
  { id: "whitelist", label: "⭐ Whitelist" },
  { id: "vip", label: "💎 VIP" },
  { id: "community", label: "🏠 Community" },
  { id: "standard", label: "🎟 Standard" },
  { id: "custom", label: "✏️ Custom" },
];

const ACC_COLORS = {
  whitelist: "#f59e0b",
  vip: "#a78bfa",
  community: "#34d399",
  standard: "#94a3b8",
  admin: "#f87171",
  custom: "#38bdf8",
};

const INVITE_SELECT =
  "id, code, type, max_uses, uses_count, created_at, updated_at, expires_at, status, metadata, price_override, entry_price";

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) =>
  typeof n === "number" && !isNaN(n)
    ? n % 1 === 0
      ? n.toFixed(0)
      : n.toFixed(2)
    : "—";

const mono = { fontFamily: "'JetBrains Mono', 'Fira Mono', monospace" };

function resolveInvitePrice(invite) {
  if (!invite) return 4;
  const po = invite.price_override;
  if (po != null && !isNaN(Number(po))) return Number(po);
  const meta = invite?.metadata ?? {};
  if (meta.entry_price_cents != null)
    return Number(meta.entry_price_cents) / 100;
  if (invite.entry_price != null) return Number(invite.entry_price);
  return 4;
}

function buildInviteLink(code) {
  return `${APP_URL}?ref=${code}`;
}

function enrichInvite(row) {
  if (!row) return null;
  const meta = row.metadata ?? {};
  const uses = row.uses_count ?? 0;
  const max = row.max_uses ?? null;
  return {
    ...row,
    metadata: meta,
    is_full: max !== null && uses >= max,
    enable_waitlist: meta.enable_waitlist ?? (meta.waitlist_slots ?? 0) > 0,
  };
}

// ── [C] Share helpers ─────────────────────────────────────────────────────────
function buildShareItems(link, code) {
  const enc = encodeURIComponent(link);
  const txt = encodeURIComponent("Join me on Xeevia 🌿");
  return [
    { icon: "📋", label: "Copy Link", action: "copy-link" },
    ...(code ? [{ icon: "🔑", label: "Copy Code", action: "copy-code" }] : []),
    {
      icon: "💬",
      label: "WhatsApp",
      action: "wa",
      url: `https://wa.me/?text=${txt}%20${enc}`,
    },
    {
      icon: "𝕏",
      label: "Twitter/X",
      action: "tw",
      url: `https://twitter.com/intent/tweet?text=${txt}&url=${enc}`,
    },
    {
      icon: "✈️",
      label: "Telegram",
      action: "tg",
      url: `https://t.me/share/url?url=${enc}&text=${txt}`,
    },
  ];
}

// ── Atoms ─────────────────────────────────────────────────────────────────────
function Pill({ label, color = "#a3e635" }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: "1.8px",
        textTransform: "uppercase",
        color,
        background: `${color}14`,
        border: `1px solid ${color}33`,
        borderRadius: 20,
        padding: "3px 9px",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function FieldLabel({ children }) {
  return (
    <div
      style={{
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: "2px",
        textTransform: "uppercase",
        color: "#555",
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

function Input({
  value,
  onChange,
  onBlur,
  placeholder,
  prefix,
  type = "text",
  style = {},
}) {
  return (
    <div style={{ position: "relative" }}>
      {prefix && (
        <span
          style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            color: "#666",
            fontSize: 13,
            pointerEvents: "none",
          }}
        >
          {prefix}
        </span>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          background: "#0e0e0e",
          border: "1.5px solid #222",
          borderRadius: 10,
          padding: prefix ? "10px 12px 10px 26px" : "10px 12px",
          color: "#f0f0f0",
          fontSize: 13,
          outline: "none",
          transition: "border-color .15s",
          fontFamily: "inherit",
          ...style,
        }}
        onFocus={(e) => (e.target.style.borderColor = "rgba(163,230,53,.4)")}
        onBlur={(e) => {
          e.target.style.borderColor = "#222";
          onBlur?.();
        }}
      />
    </div>
  );
}

function Textarea({ value, onChange, onBlur, placeholder, rows = 2 }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        width: "100%",
        background: "#0e0e0e",
        border: "1.5px solid #222",
        borderRadius: 10,
        padding: "10px 12px",
        color: "#f0f0f0",
        fontSize: 12,
        outline: "none",
        resize: "vertical",
        lineHeight: 1.7,
        fontFamily: "inherit",
        transition: "border-color .15s",
      }}
      onFocus={(e) => (e.target.style.borderColor = "rgba(163,230,53,.4)")}
      onBlur={(e) => {
        e.target.style.borderColor = "#222";
        onBlur?.();
      }}
    />
  );
}

function Toggle({ checked, onChange }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        width: 36,
        height: 20,
        borderRadius: 20,
        flexShrink: 0,
        background: checked ? "#a3e635" : "#252525",
        border: `1.5px solid ${checked ? "#a3e635" : "#333"}`,
        position: "relative",
        transition: "all .2s",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 16 : 2,
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: checked ? "#061000" : "#555",
          transition: "left .2s",
        }}
      />
    </div>
  );
}

function SaveIndicator({ state }) {
  if (state === "idle") return null;
  const map = {
    saving: { label: "Saving…", color: "#888" },
    saved: { label: "✓ Saved", color: "#a3e635" },
    error: { label: "✗ Failed", color: "#f87171" },
  };
  const { label, color } = map[state] ?? map.saved;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color, marginLeft: 6 }}>
      {label}
    </span>
  );
}

function Btn({
  onClick,
  children,
  danger,
  accent,
  disabled,
  small,
  style = {},
}) {
  const bg = danger
    ? "rgba(239,68,68,.08)"
    : accent
      ? "linear-gradient(135deg,#a3e635,#65a30d)"
      : "transparent";
  const border = danger
    ? "rgba(239,68,68,.3)"
    : accent
      ? "transparent"
      : "#252525";
  const color = danger ? "#f87171" : accent ? "#061000" : "#666";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: small ? "6px 11px" : "9px 14px",
        borderRadius: 9,
        border: `1px solid ${border}`,
        background: disabled ? "#111" : bg,
        color: disabled ? "#333" : color,
        fontWeight: 700,
        fontSize: small ? 10 : 11,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "inherit",
        transition: "all .15s",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// ── [B] Copy buttons ──────────────────────────────────────────────────────────
function CopyLinkButton({ code, label = "Copy invite link" }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const url = code ? buildInviteLink(code) : APP_URL;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      style={{
        flex: 1,
        padding: "9px",
        borderRadius: 10,
        fontFamily: "inherit",
        border: `1.5px solid ${copied ? "rgba(163,230,53,.4)" : "#222"}`,
        background: copied ? "rgba(163,230,53,.06)" : "transparent",
        color: copied ? "#a3e635" : "#555",
        fontWeight: 700,
        fontSize: 11,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        transition: "all .15s",
      }}
    >
      {copied ? "✓ Copied!" : `🔗 ${label}`}
    </button>
  );
}

function CopyCodeButton({ code }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      style={{
        flex: 1,
        padding: "9px",
        borderRadius: 10,
        fontFamily: "inherit",
        border: `1.5px solid ${copied ? "rgba(163,230,53,.4)" : "#222"}`,
        background: copied ? "rgba(163,230,53,.06)" : "transparent",
        color: copied ? "#a3e635" : "#555",
        fontWeight: 700,
        fontSize: 11,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        transition: "all .15s",
      }}
    >
      {copied ? "✓ Code Copied!" : "🔑 Copy Code"}
    </button>
  );
}

function LinkRow({ code, label }) {
  const [copied, setCopied] = useState(false);
  const url = buildInviteLink(code);
  const copy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "#080808",
        border: "1px solid #1a1a1a",
        borderRadius: 10,
        padding: "8px 12px",
      }}
    >
      <span
        style={{ fontSize: 10, color: "#555", flexShrink: 0, fontWeight: 700 }}
      >
        {label}
      </span>
      <span
        style={{
          flex: 1,
          fontSize: 11,
          color: "#666",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          ...mono,
        }}
      >
        {url}
      </span>
      <button
        onClick={copy}
        style={{
          flexShrink: 0,
          padding: "4px 10px",
          borderRadius: 7,
          border: `1px solid ${copied ? "rgba(163,230,53,.3)" : "#252525"}`,
          background: copied ? "rgba(163,230,53,.06)" : "transparent",
          color: copied ? "#a3e635" : "#555",
          fontSize: 10,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "inherit",
          whiteSpace: "nowrap",
        }}
      >
        {copied ? "✓" : "Copy"}
      </button>
    </div>
  );
}

// [E] Plain link row (for APP_URL — no ?ref=)
function PlainLinkRow({ url, label }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "#080808",
        border: "1px solid rgba(163,230,53,.1)",
        borderRadius: 10,
        padding: "8px 12px",
      }}
    >
      <span
        style={{
          fontSize: 10,
          color: "#5a8a35",
          flexShrink: 0,
          fontWeight: 700,
        }}
      >
        {label}
      </span>
      <span
        style={{
          flex: 1,
          fontSize: 11,
          color: "#666",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          ...mono,
        }}
      >
        {url}
      </span>
      <button
        onClick={copy}
        style={{
          flexShrink: 0,
          padding: "4px 10px",
          borderRadius: 7,
          border: `1px solid ${copied ? "rgba(163,230,53,.3)" : "#252525"}`,
          background: copied ? "rgba(163,230,53,.06)" : "transparent",
          color: copied ? "#a3e635" : "#555",
          fontSize: 10,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "inherit",
          whiteSpace: "nowrap",
        }}
      >
        {copied ? "✓" : "Copy"}
      </button>
    </div>
  );
}

// ── [C] ShareSheet ────────────────────────────────────────────────────────────
function ShareSheet({ link, code, onClose }) {
  const ref = useRef(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    const onOut = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const onEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onOut);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onOut);
      document.removeEventListener("keydown", onEsc);
    };
  }, [onClose]);

  const items = buildShareItems(link, code);

  const handleItem = (item) => {
    if (item.action === "copy-link") {
      navigator.clipboard.writeText(link).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 1800);
      });
      return;
    }
    if (item.action === "copy-code") {
      navigator.clipboard.writeText(code).then(() => {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 1800);
      });
      return;
    }
    window.open(item.url, "_blank");
    onClose();
  };

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        top: "calc(100% + 6px)",
        right: 0,
        background: "#111",
        border: "1px solid #282828",
        borderRadius: 13,
        zIndex: 400,
        minWidth: 192,
        overflow: "hidden",
        boxShadow: "0 12px 48px rgba(0,0,0,.75)",
        animation: "ssIn .17s cubic-bezier(.23,1,.32,1)",
      }}
    >
      {items.map((item) => {
        const isCopied =
          item.action === "copy-link"
            ? copiedLink
            : item.action === "copy-code"
              ? copiedCode
              : false;
        return (
          <div
            key={item.action}
            onClick={() => handleItem(item)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              color: isCopied ? "#a3e635" : "#ccc",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#191919")}
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            <span
              style={{
                width: 18,
                textAlign: "center",
                fontSize: 14,
                flexShrink: 0,
              }}
            >
              {item.icon}
            </span>
            {isCopied
              ? item.action === "copy-link"
                ? "Link Copied ✓"
                : "Code Copied ✓"
              : item.label}
          </div>
        );
      })}
    </div>
  );
}

function ShareButton({ link, code, small }) {
  const [open, setOpen] = useState(false);

  const handleClick = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join Xeevia",
          text: "Use my invite link 🌿",
          url: link,
        });
        return;
      } catch {
        /* fall through */
      }
    }
    setOpen((p) => !p);
  };

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={handleClick}
        style={{
          padding: small ? "6px 11px" : "9px 13px",
          borderRadius: 10,
          border: "1.5px solid #232323",
          background: "transparent",
          color: "#666",
          fontWeight: 700,
          fontSize: small ? 10 : 11,
          cursor: "pointer",
          fontFamily: "inherit",
          transition: "all .15s",
          display: "flex",
          alignItems: "center",
          gap: 5,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "#363636";
          e.currentTarget.style.color = "#aaa";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "#232323";
          e.currentTarget.style.color = "#666";
        }}
      >
        ↗ Share
      </button>
      {open && (
        <ShareSheet link={link} code={code} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}

// ── [D] WaitlistManagerModal ──────────────────────────────────────────────────
function WaitlistManagerModal({ invite, onClose, onUpdate }) {
  const meta = invite?.metadata ?? {};
  const entries = meta.waitlist_entries ?? [];
  const whitelistedIds = meta.whitelisted_user_ids ?? [];
  const pending = entries.filter((e) => !whitelistedIds.includes(e.user_id));

  const [actionState, setActionState] = useState({});
  const [bulkN, setBulkN] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (text, ok = true) => {
    setToast({ text, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const mutate = async (fn, msg) => {
    try {
      const { data: fresh, error: fe } = await supabase
        .from("invite_codes")
        .select("metadata")
        .eq("id", invite.id)
        .single();
      if (fe) throw fe;
      const updated = fn(fresh.metadata ?? {});
      const { error: ue } = await supabase
        .from("invite_codes")
        .update({ metadata: updated, updated_at: new Date().toISOString() })
        .eq("id", invite.id);
      if (ue) throw ue;
      showToast(msg, true);
      onUpdate({ ...invite, metadata: updated });
    } catch (e) {
      showToast(`Error: ${e.message}`, false);
    }
  };

  const approveUser = async (entry) => {
    setActionState((p) => ({ ...p, [entry.user_id]: "approving" }));
    await mutate(
      (m) => {
        const wl = m.whitelisted_user_ids ?? [];
        const ents = m.waitlist_entries ?? [];
        if (wl.includes(entry.user_id)) return m;
        return {
          ...m,
          whitelisted_user_ids: [...wl, entry.user_id],
          waitlist_entries: ents.filter((e) => e.user_id !== entry.user_id),
          waitlist_count: Math.max(0, ents.length - 1),
        };
      },
      `✅ ${entry.full_name || entry.email || "User"} approved`,
    );
    setActionState((p) => {
      const n = { ...p };
      delete n[entry.user_id];
      return n;
    });
  };

  const denyUser = async (entry) => {
    setActionState((p) => ({ ...p, [entry.user_id]: "denying" }));
    await mutate(
      (m) => {
        const ents = (m.waitlist_entries ?? []).filter(
          (e) => e.user_id !== entry.user_id,
        );
        return { ...m, waitlist_entries: ents, waitlist_count: ents.length };
      },
      `🚫 ${entry.full_name || entry.email || "User"} removed`,
    );
    setActionState((p) => {
      const n = { ...p };
      delete n[entry.user_id];
      return n;
    });
  };

  const approveBulk = async (n) => {
    setBulkBusy(true);
    await mutate(
      (m) => {
        const wl = m.whitelisted_user_ids ?? [];
        const pend = (m.waitlist_entries ?? []).filter(
          (e) => !wl.includes(e.user_id),
        );
        const batch = n === "all" ? pend : pend.slice(0, Number(n));
        const newWl = [...wl, ...batch.map((e) => e.user_id)];
        const remain = (m.waitlist_entries ?? []).filter(
          (e) => !batch.some((b) => b.user_id === e.user_id),
        );
        return {
          ...m,
          whitelisted_user_ids: newWl,
          waitlist_entries: remain,
          waitlist_count: remain.length,
        };
      },
      n === "all"
        ? `✅ All ${pending.length} approved`
        : `✅ ${n} users approved`,
    );
    setBulkBusy(false);
    setBulkN("");
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.88)",
        zIndex: 10500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        backdropFilter: "blur(10px)",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <style>{`
        @keyframes wlIn  { from{opacity:0;transform:translateY(14px) scale(.97)} to{opacity:1;transform:none} }
        @keyframes wlSp  { to{transform:rotate(360deg)} }
        .wl-spin { display:inline-block;width:12px;height:12px;border-radius:50%;border:2px solid rgba(163,230,53,.15);border-top-color:#a3e635;animation:wlSp .55s linear infinite; }
        .wl-row:hover { background:rgba(255,255,255,.025)!important; }
      `}</style>
      <div
        style={{
          background: "#0c0c0c",
          border: "1px solid #222",
          borderRadius: 20,
          width: "100%",
          maxWidth: 580,
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 80px rgba(0,0,0,.8)",
          animation: "wlIn .28s cubic-bezier(.23,1,.32,1)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px 16px",
            borderBottom: "1px solid #181818",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 900,
                  color: "#e8e8e8",
                  letterSpacing: "-0.3px",
                }}
              >
                ⏳ Waitlist Manager
              </div>
              <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>
                <span style={{ color: "#38bdf8", fontWeight: 700 }}>
                  {pending.length} pending
                </span>
                {" · "}
                <span style={{ color: "#a3e635", fontWeight: 700 }}>
                  {whitelistedIds.length} approved
                </span>
                {" · "}
                <span style={{ color: "#444" }}>
                  {meta.invite_name || invite.code}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "1px solid #252525",
                borderRadius: 8,
                color: "#555",
                fontSize: 16,
                cursor: "pointer",
                padding: "3px 9px",
                fontFamily: "inherit",
                lineHeight: 1,
                transition: "all .15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#f87171";
                e.currentTarget.style.color = "#f87171";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#252525";
                e.currentTarget.style.color = "#555";
              }}
            >
              ×
            </button>
          </div>
          {toast && (
            <div
              style={{
                marginTop: 10,
                padding: "8px 12px",
                borderRadius: 9,
                background: toast.ok
                  ? "rgba(163,230,53,.07)"
                  : "rgba(239,68,68,.07)",
                border: `1px solid ${toast.ok ? "rgba(163,230,53,.2)" : "rgba(239,68,68,.2)"}`,
                fontSize: 12,
                fontWeight: 600,
                color: toast.ok ? "#a3e635" : "#f87171",
              }}
            >
              {toast.text}
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", flex: 1, padding: "12px 24px" }}>
          {pending.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "36px 0",
                color: "#444",
                fontSize: 13,
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 10 }}>🎉</div>
              No pending entries
              {whitelistedIds.length > 0 && (
                <div style={{ fontSize: 11, color: "#38bdf8", marginTop: 6 }}>
                  {whitelistedIds.length} user
                  {whitelistedIds.length !== 1 ? "s" : ""} already approved ✓
                </div>
              )}
            </div>
          ) : (
            pending.map((entry, idx) => {
              const busy = actionState[entry.user_id];
              return (
                <div
                  key={entry.user_id}
                  className="wl-row"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 6px",
                    borderBottom: "1px solid #141414",
                    borderRadius: 8,
                    transition: "background .12s",
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: "50%",
                      flexShrink: 0,
                      background: "linear-gradient(135deg,#38bdf8,#0284c7)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontWeight: 800,
                      color: "#001a26",
                    }}
                  >
                    {(entry.full_name || entry.email || "?")
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#e4e4e4",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {entry.full_name || "Anonymous"}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "#555",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {entry.email ||
                        (entry.user_id
                          ? entry.user_id.slice(0, 24) + "…"
                          : "—")}
                    </div>
                    <div style={{ fontSize: 9, color: "#333", marginTop: 1 }}>
                      #{idx + 1} ·{" "}
                      {entry.joined_at
                        ? new Date(entry.joined_at).toLocaleDateString()
                        : "—"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                    <button
                      disabled={!!busy}
                      onClick={() => approveUser(entry)}
                      style={{
                        padding: "5px 11px",
                        borderRadius: 8,
                        border: "none",
                        background:
                          busy === "approving"
                            ? "#1a1a1a"
                            : "linear-gradient(135deg,#a3e635,#65a30d)",
                        color: busy === "approving" ? "#555" : "#061000",
                        fontWeight: 800,
                        fontSize: 10,
                        cursor: busy ? "not-allowed" : "pointer",
                        fontFamily: "inherit",
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        transition: "all .15s",
                      }}
                    >
                      {busy === "approving" ? (
                        <span className="wl-spin" />
                      ) : (
                        "✓ Approve"
                      )}
                    </button>
                    <button
                      disabled={!!busy}
                      onClick={() => denyUser(entry)}
                      style={{
                        padding: "5px 11px",
                        borderRadius: 8,
                        border: "1.5px solid rgba(239,68,68,.25)",
                        background: "rgba(239,68,68,.06)",
                        color: busy === "denying" ? "#555" : "#f87171",
                        fontWeight: 700,
                        fontSize: 10,
                        cursor: busy ? "not-allowed" : "pointer",
                        fontFamily: "inherit",
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        transition: "all .15s",
                      }}
                    >
                      {busy === "denying" ? (
                        <span className="wl-spin" />
                      ) : (
                        "✕ Deny"
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bulk footer */}
        {pending.length > 0 && (
          <div
            style={{
              padding: "14px 24px 18px",
              borderTop: "1px solid #181818",
              flexShrink: 0,
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            <button
              disabled={bulkBusy}
              onClick={() => approveBulk("all")}
              style={{
                flex: 2,
                padding: "11px",
                borderRadius: 10,
                border: "none",
                background: bulkBusy
                  ? "#1a1a1a"
                  : "linear-gradient(135deg,#a3e635,#65a30d)",
                color: bulkBusy ? "#333" : "#061000",
                fontWeight: 800,
                fontSize: 12,
                cursor: bulkBusy ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              {bulkBusy ? (
                <>
                  <span className="wl-spin" /> Working…
                </>
              ) : (
                `✅ Approve All (${pending.length})`
              )}
            </button>
            <div style={{ display: "flex", gap: 6, flex: 1 }}>
              <input
                type="number"
                min="1"
                max={pending.length}
                value={bulkN}
                onChange={(e) => setBulkN(e.target.value)}
                placeholder="N"
                style={{
                  width: 52,
                  padding: "10px 8px",
                  textAlign: "center",
                  background: "#111",
                  border: "1.5px solid #252525",
                  borderRadius: 9,
                  color: "#e0e0e0",
                  fontSize: 12,
                  outline: "none",
                  fontFamily: "inherit",
                  transition: "border-color .15s",
                }}
                onFocus={(e) =>
                  (e.target.style.borderColor = "rgba(163,230,53,.35)")
                }
                onBlur={(e) => (e.target.style.borderColor = "#252525")}
              />
              <button
                disabled={bulkBusy || !bulkN || Number(bulkN) < 1}
                onClick={() => approveBulk(bulkN)}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: 9,
                  border: "1.5px solid rgba(163,230,53,.25)",
                  background: "rgba(163,230,53,.05)",
                  color: "#a3e635",
                  fontWeight: 700,
                  fontSize: 11,
                  cursor: bulkBusy || !bulkN ? "not-allowed" : "pointer",
                  opacity: !bulkN || Number(bulkN) < 1 ? 0.35 : 1,
                  fontFamily: "inherit",
                  transition: "all .15s",
                }}
              >
                Approve N
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── PaywallHeroPreview (v13 — unchanged) ──────────────────────────────────────
function PaywallHeroPreview({ paywallConfig, customInvites, liveStats }) {
  const [displayIdx, setDisplayIdx] = useState(0);
  const [fading, setFading] = useState(false);
  const timerRef = useRef(null);

  const publicPrice = paywallConfig?.price_usd ?? 4;
  const publicEP = paywallConfig?.ep_grant ?? 300;
  const isActive = paywallConfig?.is_active ?? true;
  const heroMessage = paywallConfig?.hero_message ?? "";
  const stats = liveStats ?? {
    memberCount: 0,
    waitlistCount: 0,
    whitelistTotal: 0,
    whitelistFilled: 0,
  };

  const activeWLInvites = useMemo(
    () =>
      (customInvites || []).filter(
        (i) =>
          i.status === "active" &&
          (i.type === "whitelist" ||
            i.metadata?.invite_category === "whitelist"),
      ),
    [customInvites],
  );
  const openWLInvites = useMemo(
    () => activeWLInvites.filter((i) => !i.is_full),
    [activeWLInvites],
  );
  const fullWLInvites = useMemo(
    () => activeWLInvites.filter((i) => i.is_full),
    [activeWLInvites],
  );
  const wlAggregateMax = useMemo(
    () => activeWLInvites.reduce((s, i) => s + (i.max_uses ?? 0), 0),
    [activeWLInvites],
  );
  const wlAggregateFilled = useMemo(
    () => activeWLInvites.reduce((s, i) => s + (i.uses_count ?? 0), 0),
    [activeWLInvites],
  );

  const repWLInvite = useMemo(() => {
    if (openWLInvites.length === 0) return null;
    return [...openWLInvites].sort(
      (a, b) => resolveInvitePrice(a) - resolveInvitePrice(b),
    )[0];
  }, [openWLInvites]);

  const hasWaitlistSlots = useMemo(
    () =>
      (customInvites || []).some(
        (i) => i.status === "active" && (i.metadata?.waitlist_slots ?? 0) > 0,
      ),
    [customInvites],
  );
  const hasVIPSlots = useMemo(
    () =>
      (customInvites || []).some(
        (i) => i.status === "active" && (i.metadata?.vip_slots ?? 0) > 0,
      ),
    [customInvites],
  );
  const allWLFull = activeWLInvites.length > 0 && openWLInvites.length === 0;

  const totalWaitlistCapacity = useMemo(
    () =>
      (customInvites || []).reduce(
        (s, i) => s + (i.metadata?.waitlist_slots ?? 0),
        0,
      ),
    [customInvites],
  );
  const totalVIPSlots = useMemo(
    () =>
      (customInvites || []).reduce(
        (s, i) => s + (i.metadata?.vip_slots ?? 0),
        0,
      ),
    [customInvites],
  );

  const previewSlides = useMemo(() => {
    const slides = [{ id: "public", type: "public_entry" }];
    if (openWLInvites.length > 0)
      slides.push({
        id: "whitelist",
        type: "whitelist_entry",
        linkCount: openWLInvites.length,
        aggregateMax: wlAggregateMax,
        aggregateFilled: wlAggregateFilled,
        repInvite: repWLInvite,
      });
    if (hasWaitlistSlots && (fullWLInvites.length > 0 || allWLFull))
      slides.push({ id: "waitlist", type: "waitlist_entry" });
    if (hasVIPSlots) slides.push({ id: "vip", type: "vip_entry" });
    return slides;
  }, [
    openWLInvites,
    fullWLInvites,
    allWLFull,
    hasWaitlistSlots,
    hasVIPSlots,
    wlAggregateMax,
    wlAggregateFilled,
    repWLInvite,
  ]);

  useEffect(() => {
    if (displayIdx >= previewSlides.length) setDisplayIdx(0);
  }, [previewSlides.length, displayIdx]);

  useEffect(() => {
    clearInterval(timerRef.current);
    if (previewSlides.length <= 1) return;
    timerRef.current = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setDisplayIdx((p) => (p + 1) % previewSlides.length);
        setFading(false);
      }, 200);
    }, 3600);
    return () => clearInterval(timerRef.current);
  }, [previewSlides.length]);

  const goTo = (i) => {
    clearInterval(timerRef.current);
    setFading(true);
    setTimeout(() => {
      setDisplayIdx(i);
      setFading(false);
    }, 200);
  };

  const current =
    previewSlides[Math.min(displayIdx, previewSlides.length - 1)] ??
    previewSlides[0];

  const accentFor = (s) => {
    if (!s || s.type === "public_entry") return "#a3e635";
    if (s.type === "whitelist_entry") {
      const p = s.repInvite ? resolveInvitePrice(s.repInvite) : publicPrice;
      return p === 0 ? "#a3e635" : "#f59e0b";
    }
    if (s.type === "waitlist_entry") return "#38bdf8";
    if (s.type === "vip_entry") return "#a78bfa";
    return "#a3e635";
  };
  const accent = accentFor(current);

  const renderSlide = (s) => {
    if (!s) return null;

    if (s.type === "public_entry")
      return (
        <div>
          <div style={{ marginBottom: 10 }}>
            {!isActive && (
              <div
                style={{
                  background: "rgba(239,68,68,.12)",
                  border: "1px solid rgba(239,68,68,.3)",
                  borderRadius: 8,
                  padding: "6px 10px",
                  fontSize: 9,
                  color: "#f87171",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "1.5px",
                  marginBottom: 8,
                }}
              >
                ⚠ Paywall Closed
              </div>
            )}
            <span
              style={{
                display: "inline-flex",
                fontSize: 8,
                fontWeight: 800,
                letterSpacing: "2px",
                textTransform: "uppercase",
                color: "#a3e635",
                background: "rgba(163,230,53,.1)",
                border: "1px solid rgba(163,230,53,.25)",
                borderRadius: 20,
                padding: "3px 10px",
              }}
            >
              PUBLIC ENTRY
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                <span style={{ fontSize: 20, color: "#444", fontWeight: 600 }}>
                  $
                </span>
                <span
                  style={{
                    fontSize: 44,
                    fontWeight: 900,
                    color: "#fff",
                    letterSpacing: "-3px",
                    lineHeight: 1,
                    ...mono,
                  }}
                >
                  {fmt(publicPrice)}
                </span>
              </div>
              <div
                style={{
                  fontSize: 9,
                  color: "#666",
                  fontWeight: 600,
                  marginTop: 4,
                }}
              >
                one-time · instant activation
              </div>
            </div>
            <div
              style={{
                background: "#111",
                border: "1px solid rgba(163,230,53,.15)",
                borderRadius: 10,
                padding: "8px 12px",
                textAlign: "center",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 900,
                  color: "#a3e635",
                  lineHeight: 1,
                }}
              >
                {publicEP} EP
              </div>
              <div
                style={{
                  fontSize: 7,
                  fontWeight: 700,
                  color: "#444",
                  textTransform: "uppercase",
                  marginTop: 2,
                }}
              >
                instant reward
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#0a0a0a",
              border: "1px solid #1a1a1a",
              borderRadius: 8,
              padding: "7px 10px",
              marginBottom: 4,
            }}
          >
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#a3e635",
                boxShadow: "0 0 5px #a3e63570",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 11, fontWeight: 800, color: "#e0e0e0" }}>
              {stats.memberCount > 0 ? stats.memberCount.toLocaleString() : "—"}
            </span>
            <span style={{ fontSize: 9.5, color: "#444", fontWeight: 600 }}>
              members joined
            </span>
            <span
              style={{
                marginLeft: "auto",
                fontSize: 8,
                fontWeight: 800,
                color: "#a3e63588",
                letterSpacing: "1px",
              }}
            >
              LIVE
            </span>
          </div>
          {heroMessage && (
            <div
              style={{
                marginTop: 6,
                fontSize: 9,
                color: "#555",
                lineHeight: 1.6,
              }}
            >
              {heroMessage}
            </div>
          )}
          <div
            style={{
              marginTop: 10,
              background: "linear-gradient(135deg,#a3e635,#65a30d)",
              borderRadius: 9,
              padding: "9px 14px",
              fontSize: 11,
              fontWeight: 800,
              color: "#061000",
              textAlign: "center",
            }}
          >
            Get Access Now →
          </div>
        </div>
      );

    if (s.type === "whitelist_entry") {
      const inv = s.repInvite;
      const wlPrice = inv ? resolveInvitePrice(inv) : publicPrice;
      const isFree = wlPrice === 0;
      const epGrant = inv?.metadata?.ep_grant ?? 500;
      const wlAccent = isFree ? "#a3e635" : "#f59e0b";
      const pPct =
        s.aggregateMax > 0
          ? Math.min(
              100,
              Math.round((s.aggregateFilled / s.aggregateMax) * 100),
            )
          : 0;
      const pLeft = Math.max(0, s.aggregateMax - s.aggregateFilled);
      return (
        <div>
          <div style={{ marginBottom: 10 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  fontSize: 8,
                  fontWeight: 800,
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                  color: wlAccent,
                  background: `${wlAccent}18`,
                  border: `1px solid ${wlAccent}33`,
                  borderRadius: 20,
                  padding: "3px 10px",
                }}
              >
                {isFree ? "FREE ACCESS" : "WHITELIST ENTRY"}
              </span>
              {s.linkCount > 1 && (
                <span
                  style={{
                    fontSize: 8,
                    fontWeight: 700,
                    color: "#555",
                    background: "#111",
                    border: "1px solid #1e1e1e",
                    borderRadius: 10,
                    padding: "2px 7px",
                  }}
                >
                  {s.linkCount} active links
                </span>
              )}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                {!isFree && (
                  <span
                    style={{ fontSize: 20, color: "#444", fontWeight: 600 }}
                  >
                    $
                  </span>
                )}
                <span
                  style={{
                    fontSize: isFree ? 32 : 44,
                    fontWeight: 900,
                    color: wlAccent,
                    letterSpacing: "-3px",
                    lineHeight: 1,
                    ...mono,
                  }}
                >
                  {isFree ? "FREE" : fmt(wlPrice)}
                </span>
              </div>
              <div style={{ fontSize: 9, color: "#555", marginTop: 4 }}>
                {isFree
                  ? "whitelisted · free activation"
                  : "exclusive whitelist pricing"}
              </div>
            </div>
            <div
              style={{
                background: "#111",
                border: `1px solid ${wlAccent}18`,
                borderRadius: 10,
                padding: "8px 12px",
                textAlign: "center",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 900,
                  color: wlAccent,
                  lineHeight: 1,
                }}
              >
                {epGrant} EP
              </div>
              <div
                style={{
                  fontSize: 7,
                  fontWeight: 700,
                  color: "#444",
                  textTransform: "uppercase",
                  marginTop: 2,
                }}
              >
                instant reward
              </div>
            </div>
          </div>
          {s.aggregateMax > 0 && (
            <div
              style={{
                background: "#0a0a0a",
                border: `1px solid ${wlAccent}15`,
                borderRadius: 8,
                padding: "7px 10px",
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 4,
                }}
              >
                <span style={{ fontSize: 9, color: "#555", fontWeight: 600 }}>
                  Whitelist slots
                  {s.linkCount > 1 ? ` (${s.linkCount} links)` : ""}
                </span>
                <span style={{ fontSize: 9, color: wlAccent, fontWeight: 800 }}>
                  {s.aggregateFilled.toLocaleString()} /{" "}
                  {s.aggregateMax.toLocaleString()}
                </span>
              </div>
              <div
                style={{ height: 3, background: "#1a1a1a", borderRadius: 3 }}
              >
                <div
                  style={{
                    width: `${pPct}%`,
                    height: "100%",
                    borderRadius: 3,
                    background: `linear-gradient(90deg,${wlAccent}60,${wlAccent})`,
                    transition: "width .6s ease",
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 3,
                }}
              >
                <span style={{ fontSize: 8, color: "#333" }}>
                  {pPct}% claimed
                </span>
                <span
                  style={{
                    fontSize: 8,
                    color: pLeft === 0 ? "#f87171" : "#333",
                  }}
                >
                  {pLeft > 0 ? `${pLeft} left` : "FULL"}
                </span>
              </div>
            </div>
          )}
          <div
            style={{
              background: isFree
                ? "linear-gradient(135deg,#a3e635,#22c55e)"
                : "linear-gradient(135deg,#f59e0b,#d97706)",
              borderRadius: 9,
              padding: "9px 14px",
              fontSize: 11,
              fontWeight: 800,
              color: "#061000",
              textAlign: "center",
            }}
          >
            {isFree ? "🎉 Activate Free Access →" : "Claim Whitelist Spot →"}
          </div>
        </div>
      );
    }

    if (s.type === "waitlist_entry")
      return (
        <div>
          <div style={{ marginBottom: 8 }}>
            <span
              style={{
                display: "inline-flex",
                fontSize: 8,
                fontWeight: 800,
                letterSpacing: "2px",
                textTransform: "uppercase",
                color: "#38bdf8",
                background: "rgba(56,189,248,.08)",
                border: "1px solid rgba(56,189,248,.22)",
                borderRadius: 20,
                padding: "3px 10px",
                marginBottom: 6,
              }}
            >
              WAITLIST
            </span>
            <div
              style={{
                background: "rgba(239,68,68,.08)",
                border: "1px solid rgba(239,68,68,.2)",
                borderRadius: 8,
                padding: "6px 10px",
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ fontSize: 10 }}>🔒</span>
              <span style={{ fontSize: 9, color: "#f87171", fontWeight: 700 }}>
                Whitelist slots exhausted — no payment needed now
              </span>
            </div>
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: "#c0e0f0",
              lineHeight: 1.4,
              marginBottom: 4,
            }}
          >
            Get whitelisted when a spot opens
          </div>
          <div style={{ fontSize: 9, color: "#3a5a6a", marginBottom: 10 }}>
            Join the waitlist · you'll be notified instantly · enter free today
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#0a1418",
              border: "1px solid rgba(56,189,248,.14)",
              borderRadius: 8,
              padding: "7px 10px",
              marginBottom: 10,
            }}
          >
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#38bdf8",
                boxShadow: "0 0 5px #38bdf870",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 11, fontWeight: 800, color: "#e0e0e0" }}>
              {stats.waitlistCount > 0
                ? stats.waitlistCount.toLocaleString()
                : "—"}
            </span>
            <span style={{ fontSize: 9.5, color: "#2a4a5a", fontWeight: 600 }}>
              people waiting
            </span>
            <span
              style={{
                marginLeft: "auto",
                fontSize: 11,
                fontWeight: 900,
                color: "#38bdf8",
              }}
            >
              200 EP
            </span>
          </div>
          {totalWaitlistCapacity > 0 && (
            <div
              style={{
                fontSize: 9,
                color: "#2a5060",
                marginBottom: 8,
                textAlign: "center",
              }}
            >
              {totalWaitlistCapacity.toLocaleString()} waitlist spots available
            </div>
          )}
          <div
            style={{
              background: "linear-gradient(135deg,#38bdf8,#0284c7)",
              borderRadius: 9,
              padding: "9px 14px",
              fontSize: 11,
              fontWeight: 800,
              color: "#001a26",
              textAlign: "center",
            }}
          >
            Join Waitlist Now →
          </div>
        </div>
      );

    if (s.type === "vip_entry")
      return (
        <div>
          <div style={{ marginBottom: 10 }}>
            <span
              style={{
                display: "inline-flex",
                fontSize: 8,
                fontWeight: 800,
                letterSpacing: "2px",
                textTransform: "uppercase",
                color: "#a78bfa",
                background: "rgba(167,139,250,.1)",
                border: "1px solid rgba(167,139,250,.3)",
                borderRadius: 20,
                padding: "3px 10px",
              }}
            >
              👑 VIP LOTTERY
            </span>
          </div>
          <div
            style={{
              fontSize: 44,
              fontWeight: 900,
              color: "#fff",
              letterSpacing: "-2px",
              lineHeight: 1,
              marginBottom: 4,
            }}
          >
            FREE
          </div>
          <div style={{ fontSize: 9, color: "#555", marginBottom: 12 }}>
            VIP access · {totalVIPSlots} lucky{" "}
            {totalVIPSlots === 1 ? "slot" : "slots"} total
          </div>
          <div
            style={{
              background: "#0d0a18",
              border: "1px solid rgba(167,139,250,.14)",
              borderRadius: 8,
              padding: "7px 10px",
              marginBottom: 10,
            }}
          >
            <span style={{ fontSize: 9, color: "#7a5fa0", fontWeight: 600 }}>
              🎲 Random selection · Winners notified by email
            </span>
          </div>
          <div
            style={{
              background: "linear-gradient(135deg,#a78bfa,#7c3aed)",
              borderRadius: 9,
              padding: "9px 14px",
              fontSize: 11,
              fontWeight: 800,
              color: "#fff",
              textAlign: "center",
            }}
          >
            Enter VIP Lottery →
          </div>
        </div>
      );

    return null;
  };

  const slideLabel = (s) => {
    if (!s) return "";
    if (s.type === "public_entry") return "Public Entry";
    if (s.type === "whitelist_entry")
      return s.linkCount > 1
        ? `Whitelist (${s.linkCount} links)`
        : "Whitelist Access";
    if (s.type === "waitlist_entry") return "Waitlist Queue";
    if (s.type === "vip_entry") return "VIP Lottery";
    return "Slide";
  };
  const slideIcon = (s) => {
    if (!s) return "🎞";
    if (s.type === "public_entry") return "🌐";
    if (s.type === "whitelist_entry") return "⭐";
    if (s.type === "waitlist_entry") return "⏳";
    if (s.type === "vip_entry") return "👑";
    return "🎞";
  };
  const slideDesc = (s) => {
    if (!s) return "";
    if (s.type === "public_entry")
      return `$${fmt(publicPrice)} · ${publicEP} EP`;
    if (s.type === "whitelist_entry") {
      const p = s.repInvite ? resolveInvitePrice(s.repInvite) : publicPrice;
      return p === 0 ? "Free access" : `$${fmt(p)} · exclusive pricing`;
    }
    if (s.type === "waitlist_entry") return "Auto-activates when WL full";
    if (s.type === "vip_entry")
      return `${totalVIPSlots} free slots · random draw`;
    return "";
  };

  return (
    <div style={{ position: "sticky", top: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div
          style={{
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "2.5px",
            textTransform: "uppercase",
            color: "#444",
          }}
        >
          ◆ Live Paywall Preview
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: isActive ? "#a3e635" : "#f87171",
              boxShadow: `0 0 6px ${isActive ? "#a3e635" : "#f87171"}`,
            }}
          />
          <span style={{ fontSize: 9, color: "#555", fontWeight: 700 }}>
            {isActive ? "Live" : "Closed"}
          </span>
        </div>
      </div>
      <div
        style={{
          background: "#0d0d0d",
          border: "1.5px solid #1e1e1e",
          borderRadius: 22,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            background: "#080808",
            padding: "8px 14px 5px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #111",
          }}
        >
          <span
            style={{ fontSize: 8, color: "#333", fontWeight: 700, ...mono }}
          >
            9:41
          </span>
          <div
            style={{
              width: 36,
              height: 5,
              background: "#151515",
              borderRadius: 3,
            }}
          />
          <div style={{ display: "flex", gap: 3 }}>
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                style={{
                  width: 2.5,
                  height: 4 + i * 1.5,
                  background: i < 3 ? "#333" : "#151515",
                  borderRadius: 1,
                }}
              />
            ))}
          </div>
        </div>
        <div
          style={{ position: "relative", overflow: "hidden", minHeight: 290 }}
        >
          <div
            style={{
              position: "absolute",
              top: -50,
              right: -50,
              width: 160,
              height: 160,
              borderRadius: "50%",
              background: `radial-gradient(circle,${accent}28 0%,transparent 70%)`,
              pointerEvents: "none",
              zIndex: 0,
              transition: "background .5s",
            }}
          />
          <div
            style={{
              position: "relative",
              zIndex: 1,
              padding: "18px 16px 14px",
              opacity: fading ? 0 : 1,
              transition: "opacity .2s ease",
            }}
          >
            {renderSlide(current)}
          </div>
        </div>
        {previewSlides.length > 1 && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 5,
              padding: "8px 0 4px",
            }}
          >
            {previewSlides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => goTo(i)}
                style={{
                  height: 5,
                  borderRadius: 3,
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  width: i === displayIdx ? 16 : 5,
                  background: i === displayIdx ? accentFor(s) : "#252525",
                  transition: "all .28s",
                }}
              />
            ))}
          </div>
        )}
        <div
          style={{
            borderTop: "1px solid #101010",
            padding: "8px 14px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 8,
                textTransform: "uppercase",
                letterSpacing: "1.5px",
                color: accent,
                fontWeight: 700,
              }}
            >
              {slideLabel(current)}
            </div>
            <div style={{ fontSize: 9, color: "#333", marginTop: 1 }}>
              {displayIdx + 1} / {previewSlides.length}
            </div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {["<", ">"].map((ch, i) => (
              <button
                key={i}
                onClick={() =>
                  goTo(
                    i === 0
                      ? (displayIdx - 1 + previewSlides.length) %
                          previewSlides.length
                      : (displayIdx + 1) % previewSlides.length,
                  )
                }
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  border: "1px solid #252525",
                  background: "transparent",
                  color: "#555",
                  cursor: "pointer",
                  fontSize: 11,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {ch}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div
        style={{
          marginTop: 10,
          background: "#090909",
          border: "1px solid #161616",
          borderRadius: 12,
          padding: "10px 12px",
        }}
      >
        <div
          style={{
            fontSize: 8,
            fontWeight: 800,
            color: "#333",
            marginBottom: 7,
            textTransform: "uppercase",
            letterSpacing: "1.5px",
          }}
        >
          Slides in rotation
        </div>
        {previewSlides.length === 0 ? (
          <div style={{ fontSize: 9, color: "#333", padding: "4px 0" }}>
            No slides yet
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {previewSlides.map((s, i) => {
              const ac = accentFor(s);
              const isAct = i === displayIdx;
              return (
                <button
                  key={s.id}
                  onClick={() => goTo(i)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "5px 8px",
                    borderRadius: 7,
                    border: `1px solid ${isAct ? `${ac}33` : "#141414"}`,
                    background: isAct ? `${ac}08` : "transparent",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "left",
                    width: "100%",
                  }}
                >
                  <span style={{ fontSize: 11, flexShrink: 0 }}>
                    {slideIcon(s)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 9.5,
                        fontWeight: 700,
                        color: isAct ? ac : "#555",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {slideLabel(s)}
                    </div>
                    <div style={{ fontSize: 8, color: "#333", marginTop: 1 }}>
                      {slideDesc(s)}
                    </div>
                  </div>
                  {isAct && (
                    <div
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: ac,
                        boxShadow: `0 0 5px ${ac}`,
                        flexShrink: 0,
                      }}
                    />
                  )}
                  {s.type === "waitlist_entry" && (
                    <span
                      style={{
                        fontSize: 7,
                        fontWeight: 800,
                        color: "#38bdf8",
                        background: "rgba(56,189,248,.08)",
                        border: "1px solid rgba(56,189,248,.2)",
                        borderRadius: 4,
                        padding: "1px 5px",
                        flexShrink: 0,
                      }}
                    >
                      AUTO
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
        {hasWaitlistSlots && (
          <div
            style={{
              marginTop: 8,
              padding: "6px 8px",
              background: "rgba(56,189,248,.04)",
              border: "1px solid rgba(56,189,248,.12)",
              borderRadius: 7,
              fontSize: 8,
              color: "#2a5a6a",
              lineHeight: 1.6,
            }}
          >
            ⏳ <strong style={{ color: "#38bdf8" }}>Waitlist</strong>{" "}
            auto-activates when whitelist slots fill up — users on full-link see
            "Join Waitlist" instead of payment.
          </div>
        )}
      </div>
      <div
        style={{
          marginTop: 8,
          padding: "8px 10px",
          background: "#080808",
          border: "1px solid #111",
          borderRadius: 9,
          fontSize: 9,
          color: "#333",
          lineHeight: 1.7,
        }}
      >
        ↳ Changes sync instantly via Supabase Realtime to{" "}
        <span style={{ color: "#555" }}>/paywall</span>
        <br />
        <span style={{ color: "#2a4a2a" }}>
          ✓ Writing to{" "}
          <span style={{ color: "#3a6a3a" }}>
            platform_settings.paywall_config
          </span>{" "}
          — same source PaywallGate reads
        </span>
      </div>
    </div>
  );
}

// ── PublicEntryCard ────────────────────────────────────────────────────────────
// [E] Enhanced: live APP_URL as copyable+shareable link + override field
function PublicEntryCard({ config, onConfigUpdate }) {
  const [expanded, setExpanded] = useState(true);
  const [saveState, setSaveState] = useState("idle");
  const [price, setPrice] = useState(String(config?.price_usd ?? 4));
  const [ep, setEp] = useState(String(config?.ep_grant ?? 300));
  const [slots, setSlots] = useState(String(config?.slots_total ?? 0));
  const [claimed, setClaimed] = useState(String(config?.slots_claimed ?? 0));
  const [heroMsg, setHeroMsg] = useState(config?.hero_message ?? "");
  const [isActive, setIsActive] = useState(config?.is_active ?? true);
  const [appUrl, setAppUrl] = useState(config?.app_url || APP_URL);
  const [editingAppUrl, setEditingAppUrl] = useState(false);

  useEffect(() => {
    if (!config) return;
    setPrice(String(config.price_usd ?? 4));
    setEp(String(config.ep_grant ?? 300));
    setSlots(String(config.slots_total ?? 0));
    setClaimed(String(config.slots_claimed ?? 0));
    setHeroMsg(config.hero_message ?? "");
    setIsActive(config.is_active ?? true);
    setAppUrl(config.app_url || APP_URL);
  }, [
    config?.price_usd,
    config?.ep_grant,
    config?.slots_total,
    config?.slots_claimed,
    config?.hero_message,
    config?.is_active,
    config?.app_url,
  ]); // eslint-disable-line

  const save = async (patch = {}) => {
    setSaveState("saving");
    try {
      const updatePayload = {
        price_usd: parseFloat(patch.price ?? price) || 4,
        ep_grant: parseInt(patch.ep ?? ep, 10) || 300,
        slots_total: parseInt(patch.slots ?? slots, 10) || 0,
        slots_claimed: parseInt(patch.claimed ?? claimed, 10) || 0,
        hero_message: patch.heroMsg !== undefined ? patch.heroMsg : heroMsg,
        is_active: patch.is_active !== undefined ? patch.is_active : isActive,
        app_url:
          patch.app_url !== undefined
            ? patch.app_url
            : config?.app_url || APP_URL,
      };
      await updatePaywallConfig(updatePayload);
      onConfigUpdate?.(updatePayload);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch (e) {
      console.error("[PublicEntryCard] save error:", e?.message);
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
    }
  };

  const toggleActive = async () => {
    const next = !isActive;
    setIsActive(next);
    await save({ is_active: next });
  };
  const saveAppUrl = async () => {
    await save({ app_url: appUrl.trim() });
    setEditingAppUrl(false);
  };
  const effectiveUrl = config?.app_url || APP_URL;

  return (
    <div
      style={{
        background: "#0c0c0c",
        border: "1.5px solid #1e1e1e",
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      <div
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 16px",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "rgba(163,230,53,.1)",
            border: "1px solid rgba(163,230,53,.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            flexShrink: 0,
          }}
        >
          🌐
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 800, color: "#e0e0e0" }}>
              PUBLIC ENTRY
            </span>
            <Pill label="paywall_config" color="#a3e635" />
            <Pill label="Non-deletable" color="#444" />
            {!isActive && <Pill label="CLOSED" color="#f87171" />}
          </div>
          <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>
            Controls paywall hero ·{" "}
            <span style={{ color: "#a3e635", ...mono }}>
              ${fmt(parseFloat(price) || 4)}
            </span>{" "}
            public price
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Toggle checked={isActive} onChange={toggleActive} />
          <SaveIndicator state={saveState} />
          <span style={{ color: "#555", fontSize: 16 }}>
            {expanded ? "▲" : "▼"}
          </span>
        </div>
      </div>

      {expanded && (
        <div
          style={{
            padding: "0 16px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
            borderTop: "1px solid #141414",
          }}
        >
          <div style={{ paddingTop: 14 }}>
            <div
              style={{
                background: "rgba(163,230,53,.03)",
                border: "1px solid rgba(163,230,53,.08)",
                borderRadius: 10,
                padding: 12,
                fontSize: 11,
                color: "#4a6a30",
                lineHeight: 1.7,
              }}
            >
              <strong style={{ color: "#6a9a40" }}>
                ↑ platform_settings.paywall_config
              </strong>{" "}
              — single source of truth for the public entry price, EP grant, and
              slot progress bar. Changes here sync instantly to PaywallGate via
              Realtime.
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr 1fr",
              gap: 10,
            }}
          >
            <div>
              <FieldLabel>Public Price</FieldLabel>
              <Input
                value={price}
                onChange={setPrice}
                onBlur={() => save({ price })}
                prefix="$"
                placeholder="4.00"
              />
            </div>
            <div>
              <FieldLabel>EP Grant</FieldLabel>
              <Input
                value={ep}
                onChange={setEp}
                onBlur={() => save({ ep })}
                placeholder="300"
              />
            </div>
            <div>
              <FieldLabel>Total Slots</FieldLabel>
              <Input
                value={slots}
                onChange={setSlots}
                onBlur={() => save({ slots })}
                placeholder="0 = unlimited"
              />
            </div>
            <div>
              <FieldLabel>Claimed</FieldLabel>
              <Input
                value={claimed}
                onChange={setClaimed}
                onBlur={() => save({ claimed })}
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <FieldLabel>Hero Message (shown under price)</FieldLabel>
            <Textarea
              value={heroMsg}
              onChange={setHeroMsg}
              onBlur={() => save({ heroMsg })}
              placeholder="Optional tagline shown below the price…"
              rows={2}
            />
          </div>

          {/* [E] Public entry link */}
          <div>
            <FieldLabel>Public Join Link</FieldLabel>
            <div
              style={{
                display: "flex",
                gap: 6,
                alignItems: "stretch",
                marginBottom: 8,
              }}
            >
              <div style={{ flex: 1 }}>
                <PlainLinkRow url={effectiveUrl} label="🌐 Link" />
              </div>
              <ShareButton link={effectiveUrl} code={null} />
            </div>
            {editingAppUrl ? (
              <div>
                <FieldLabel>Override app domain</FieldLabel>
                <div style={{ display: "flex", gap: 6 }}>
                  <div style={{ flex: 1 }}>
                    <Input
                      value={appUrl}
                      onChange={setAppUrl}
                      placeholder="https://yourdomain.com"
                    />
                  </div>
                  <Btn accent small onClick={saveAppUrl}>
                    Save
                  </Btn>
                  <Btn
                    small
                    onClick={() => {
                      setEditingAppUrl(false);
                      setAppUrl(effectiveUrl);
                    }}
                  >
                    Cancel
                  </Btn>
                </div>
                <div style={{ fontSize: 9, color: "#444", marginTop: 5 }}>
                  Saves to paywall_config.app_url · syncs to PaywallGate
                </div>
              </div>
            ) : (
              <button
                onClick={() => setEditingAppUrl(true)}
                style={{
                  background: "transparent",
                  border: "1px dashed #252525",
                  borderRadius: 8,
                  color: "#444",
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "5px 12px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all .15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#3a3a3a";
                  e.currentTarget.style.color = "#888";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#252525";
                  e.currentTarget.style.color = "#444";
                }}
              >
                ✏️ Override app URL
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── InviteCard ─────────────────────────────────────────────────────────────────
// [B] Copy Code button · [C] Share button · [D] Clickable waitlist badge
function InviteCard({ invite, onOptimisticUpdate, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [saveState, setSaveState] = useState("idle");
  const [deleting, setDeleting] = useState(false);
  const [showWaitlistMgr, setShowWaitlistMgr] = useState(false);

  const meta = invite?.metadata ?? {};
  const category = meta.invite_category ?? invite.type ?? "standard";
  const accent = ACC_COLORS[category] ?? "#94a3b8";
  const currentPrice = resolveInvitePrice(invite);
  const isWhitelist = category === "whitelist" || meta.has_whitelist_access;
  const hasWaitlist = (meta.waitlist_slots ?? 0) > 0;
  const hasVip = (meta.vip_slots ?? 0) > 0;
  const waitlistCount =
    meta.waitlist_count ?? meta.waitlist_entries?.length ?? 0;
  const inviteLink = buildInviteLink(invite.code);

  const [name, setName] = useState(meta.invite_name ?? "");
  const [price, setPrice] = useState(String(currentPrice));
  const [wlPrice, setWlPrice] = useState(
    String(
      meta.whitelist_price_cents != null
        ? meta.whitelist_price_cents / 100
        : currentPrice,
    ),
  );
  const [maxUses, setMaxUses] = useState(String(invite.max_uses ?? ""));
  const [waitlistSlots, setWaitlistSlots] = useState(
    String(meta.waitlist_slots ?? ""),
  );
  const [vipSlots, setVipSlots] = useState(String(meta.vip_slots ?? ""));
  const [epGrant, setEpGrant] = useState(String(meta.ep_grant ?? 500));
  const [expiresAt, setExpiresAt] = useState(
    invite.expires_at ? invite.expires_at.slice(0, 10) : "",
  );

  useEffect(() => {
    const m = invite?.metadata ?? {};
    setName(m.invite_name ?? "");
    setPrice(String(resolveInvitePrice(invite)));
    setWlPrice(
      String(
        m.whitelist_price_cents != null
          ? m.whitelist_price_cents / 100
          : resolveInvitePrice(invite),
      ),
    );
    setMaxUses(String(invite.max_uses ?? ""));
    setWaitlistSlots(String(m.waitlist_slots ?? ""));
    setVipSlots(String(m.vip_slots ?? ""));
    setEpGrant(String(m.ep_grant ?? 500));
    setExpiresAt(invite.expires_at ? invite.expires_at.slice(0, 10) : "");
  }, [invite?.id]); // eslint-disable-line

  const save = async (patch = {}) => {
    setSaveState("saving");
    try {
      const newPrice = parseFloat(patch.price ?? price);
      const newWlPrice = parseFloat(patch.wlPrice ?? wlPrice);
      const newMaxUses = parseInt(patch.maxUses ?? maxUses, 10) || null;
      const newEp = parseInt(patch.epGrant ?? epGrant, 10) || 500;
      const newWlSlots =
        parseInt(patch.waitlistSlots ?? waitlistSlots, 10) || 0;
      const newVipSlots = parseInt(patch.vipSlots ?? vipSlots, 10) || 0;
      const newName = patch.name !== undefined ? patch.name : name;
      const newMeta = {
        ...meta,
        invite_name: newName,
        invite_category: category,
        entry_price_cents: Math.round(newPrice * 100),
        whitelist_price_cents: Math.round(newWlPrice * 100),
        waitlist_slots: newWlSlots,
        vip_slots: newVipSlots,
        ep_grant: newEp,
        has_whitelist_access: isWhitelist,
        enable_waitlist: newWlSlots > 0,
      };
      const payload = {
        metadata: newMeta,
        price_override: newPrice,
        entry_price: newPrice,
        max_uses: newMaxUses,
        expires_at:
          (patch.expiresAt !== undefined ? patch.expiresAt : expiresAt) || null,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("invite_codes")
        .update(payload)
        .eq("id", invite.id);
      if (error) throw error;
      onOptimisticUpdate?.({ ...invite, ...payload, metadata: newMeta });
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch (e) {
      console.error("[InviteCard] save error:", e?.message);
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
    }
  };

  const toggleStatus = async () => {
    const newStatus = invite.status === "active" ? "inactive" : "active";
    setSaveState("saving");
    try {
      const { error } = await supabase
        .from("invite_codes")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", invite.id);
      if (error) throw error;
      onOptimisticUpdate?.({ ...invite, status: newStatus });
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1500);
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
    }
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        `Delete invite "${meta.invite_name || invite.code}"? This cannot be undone.`,
      )
    )
      return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("invite_codes")
        .delete()
        .eq("id", invite.id);
      if (error) throw error;
      onDelete?.(invite.id);
    } catch {
      setDeleting(false);
    }
  };

  const usedPct =
    invite.max_uses > 0
      ? Math.min(
          100,
          Math.round(((invite.uses_count ?? 0) / invite.max_uses) * 100),
        )
      : 0;
  const wlSlotsUsed = invite.uses_count ?? 0;
  const wlSlotsTotal = invite.max_uses ?? 0;

  return (
    <>
      {showWaitlistMgr && (
        <WaitlistManagerModal
          invite={invite}
          onClose={() => setShowWaitlistMgr(false)}
          onUpdate={(updated) => onOptimisticUpdate?.(updated)}
        />
      )}

      <div
        style={{
          background: "#0c0c0c",
          border: `1.5px solid ${expanded ? `${accent}33` : "#1e1e1e"}`,
          borderRadius: 16,
          overflow: "hidden",
          transition: "border-color .2s",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 14px",
            cursor: "pointer",
          }}
          onClick={() => setExpanded((v) => !v)}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: `${accent}18`,
              border: `1px solid ${accent}33`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              flexShrink: 0,
            }}
          >
            {category === "whitelist"
              ? "⭐"
              : category === "vip"
                ? "💎"
                : category === "community"
                  ? "🏠"
                  : "🎟"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 800, color: "#e0e0e0" }}>
                {meta.invite_name || "Untitled Invite"}
              </span>
              <Pill label={category} color={accent} />
              {invite.status !== "active" && (
                <Pill label="inactive" color="#555" />
              )}
              {invite.is_full && <Pill label="full" color="#f87171" />}
              {hasWaitlist && <Pill label="waitlist" color="#38bdf8" />}
              {hasVip && <Pill label="VIP lottery" color="#a78bfa" />}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 3,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: 10, color: accent, fontWeight: 700 }}>
                ${fmt(currentPrice)}
              </span>
              {invite.max_uses && (
                <span style={{ fontSize: 10, color: "#555" }}>
                  {invite.uses_count ?? 0}/{invite.max_uses} used
                </span>
              )}
              <span style={{ fontSize: 10, color: "#333", ...mono }}>
                ?ref={invite.code}
              </span>
              {/* [D] Clickable waitlist count badge */}
              {waitlistCount > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowWaitlistMgr(true);
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 9,
                    fontWeight: 800,
                    color: "#38bdf8",
                    background: "rgba(56,189,248,.08)",
                    border: "1px solid rgba(56,189,248,.2)",
                    borderRadius: 20,
                    padding: "2px 8px",
                    cursor: "pointer",
                    transition: "background .15s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "rgba(56,189,248,.16)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "rgba(56,189,248,.08)")
                  }
                  title="Open waitlist manager"
                >
                  ⏳ {waitlistCount} waiting
                </button>
              )}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexShrink: 0,
            }}
          >
            <SaveIndicator state={saveState} />
            <Toggle
              checked={invite.status === "active"}
              onChange={toggleStatus}
            />
            <span style={{ color: "#555", fontSize: 14 }}>
              {expanded ? "▲" : "▼"}
            </span>
          </div>
        </div>

        {invite.max_uses > 0 && (
          <div style={{ height: 2, background: "#111", margin: "0 14px" }}>
            <div
              style={{
                width: `${usedPct}%`,
                height: "100%",
                background: `linear-gradient(90deg,${accent}88,${accent})`,
                borderRadius: 1,
                transition: "width .4s",
              }}
            />
          </div>
        )}

        {expanded && (
          <div
            style={{
              padding: "14px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              borderTop: "1px solid #141414",
            }}
          >
            {/* Share link block */}
            <div
              style={{
                background: `${accent}08`,
                border: `1px solid ${accent}22`,
                borderRadius: 12,
                padding: "12px",
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                  color: accent,
                  marginBottom: 8,
                }}
              >
                🔗 Shareable Link
              </div>
              <LinkRow code={invite.code} label="WL Link" />
              {/* [B][C] Copy Code + Share buttons */}
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <CopyLinkButton code={invite.code} label="Copy Link" />
                <CopyCodeButton code={invite.code} />
                <ShareButton link={inviteLink} code={invite.code} />
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 10,
                  color: "#555",
                  lineHeight: 1.7,
                }}
              >
                Anyone who clicks this link gets auto-applied.{" "}
                {hasWaitlist
                  ? "When whitelist is full, link auto-converts to waitlist mode."
                  : "Set waitlist slots below to enable auto-waitlist when full."}
              </div>
            </div>

            <div>
              <FieldLabel>Invite Name</FieldLabel>
              <Input
                value={name}
                onChange={setName}
                onBlur={() => save({ name })}
                placeholder="e.g. CryptoTwitter Community WL"
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: isWhitelist
                  ? "1fr 1fr 1fr 1fr"
                  : "1fr 1fr 1fr",
                gap: 10,
              }}
            >
              <div>
                <FieldLabel>Entry Price</FieldLabel>
                <Input
                  value={price}
                  onChange={setPrice}
                  onBlur={() => save({ price })}
                  prefix="$"
                  placeholder="4.00"
                />
              </div>
              {isWhitelist && (
                <div>
                  <FieldLabel>Whitelist Price</FieldLabel>
                  <Input
                    value={wlPrice}
                    onChange={setWlPrice}
                    onBlur={() => save({ wlPrice })}
                    prefix="$"
                    placeholder="0 = free"
                  />
                </div>
              )}
              <div>
                <FieldLabel>WL Slots (max_uses)</FieldLabel>
                <Input
                  value={maxUses}
                  onChange={setMaxUses}
                  onBlur={() => save({ maxUses })}
                  placeholder="100"
                />
              </div>
              <div>
                <FieldLabel>EP Grant</FieldLabel>
                <Input
                  value={epGrant}
                  onChange={setEpGrant}
                  onBlur={() => save({ epGrant })}
                  placeholder="500"
                />
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 10,
              }}
            >
              <div>
                <FieldLabel>Waitlist Slots</FieldLabel>
                <Input
                  value={waitlistSlots}
                  onChange={setWaitlistSlots}
                  onBlur={() => save({ waitlistSlots })}
                  placeholder="0 = disabled"
                />
                <div style={{ fontSize: 9, color: "#444", marginTop: 4 }}>
                  Link auto-converts when WL full
                </div>
              </div>
              <div>
                <FieldLabel>VIP Lottery Slots</FieldLabel>
                <Input
                  value={vipSlots}
                  onChange={setVipSlots}
                  onBlur={() => save({ vipSlots })}
                  placeholder="0 = disabled"
                />
              </div>
              <div>
                <FieldLabel>Expires</FieldLabel>
                <Input
                  value={expiresAt}
                  onChange={setExpiresAt}
                  onBlur={() => save({ expiresAt })}
                  type="date"
                />
              </div>
            </div>

            {(invite.max_uses > 0 || (meta.waitlist_slots ?? 0) > 0) && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3,1fr)",
                  gap: 8,
                  background: "#080808",
                  border: "1px solid #141414",
                  borderRadius: 10,
                  padding: 10,
                }}
              >
                {[
                  {
                    label: "WL Claimed",
                    value: `${wlSlotsUsed}${wlSlotsTotal ? `/${wlSlotsTotal}` : ""}`,
                    color: accent,
                  },
                  {
                    label: "Waitlisted",
                    value: meta.waitlist_count ?? 0,
                    color: "#38bdf8",
                  },
                  {
                    label: "VIP Winners",
                    value: (meta.vip_winners ?? []).length,
                    color: "#a78bfa",
                  },
                ].map((st) => (
                  <div key={st.label} style={{ textAlign: "center" }}>
                    <div
                      style={{ fontSize: 18, fontWeight: 900, color: st.color }}
                    >
                      {st.value}
                    </div>
                    <div style={{ fontSize: 9, color: "#444", marginTop: 2 }}>
                      {st.label}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* [D] Waitlist manager button */}
            {waitlistCount > 0 && (
              <button
                onClick={() => setShowWaitlistMgr(true)}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(56,189,248,.25)",
                  background: "rgba(56,189,248,.04)",
                  color: "#38bdf8",
                  fontWeight: 700,
                  fontSize: 11,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all .15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(56,189,248,.1)";
                  e.currentTarget.style.borderColor = "rgba(56,189,248,.4)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(56,189,248,.04)";
                  e.currentTarget.style.borderColor = "rgba(56,189,248,.25)";
                }}
              >
                ⏳ Manage Waitlist — {waitlistCount} pending
              </button>
            )}

            <div
              style={{
                display: "flex",
                gap: 6,
                paddingTop: 4,
                borderTop: "1px solid #111",
              }}
            >
              <CopyLinkButton code={invite.code} label="Copy Link" />
              <CopyCodeButton code={invite.code} />
              <Btn small danger onClick={handleDelete} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete"}
              </Btn>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── CreateInviteDrawer (v13 — unchanged) ──────────────────────────────────────
function CreateInviteDrawer({ onClose, onCreate }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("whitelist");
  const [price, setPrice] = useState("4");
  const [wlPrice, setWlPrice] = useState("0");
  const [maxUses, setMaxUses] = useState("100");
  const [waitlistSlots, setWaitlistSlots] = useState("");
  const [vipSlots, setVipSlots] = useState("");
  const [epGrant, setEpGrant] = useState("500");
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState("");

  const generate = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from(
      { length: 8 },
      () => chars[Math.floor(Math.random() * chars.length)],
    ).join("");
  };

  const create = async () => {
    if (!name.trim()) {
      setErr("Invite name is required.");
      return;
    }
    setCreating(true);
    setErr("");
    try {
      const code = generate();
      const priceNum = parseFloat(price) || 4;
      const wlPriceNum = parseFloat(wlPrice) || 0;
      const typeMap = { vip: "vip", whitelist: "whitelist", admin: "admin" };
      const type = typeMap[category] ?? "standard";
      const isWl = category === "whitelist";
      const effectivePriceNum = isWl && wlPriceNum >= 0 ? wlPriceNum : priceNum;
      const wlSlots = parseInt(waitlistSlots, 10) || 0;
      const metadata = {
        admin_created: true,
        invite_name: name.trim(),
        invite_category: category,
        entry_price_cents: Math.round(effectivePriceNum * 100),
        whitelist_price_cents: Math.round(wlPriceNum * 100),
        waitlist_slots: wlSlots,
        waitlist_count: 0,
        waitlist_entries: [],
        whitelisted_user_ids: [],
        vip_slots: parseInt(vipSlots, 10) || 0,
        vip_winners: [],
        ep_grant: parseInt(epGrant, 10) || 500,
        has_whitelist_access: isWl,
        enable_waitlist: wlSlots > 0,
      };
      const record = {
        code,
        type,
        status: "active",
        max_uses: parseInt(maxUses, 10) || null,
        uses_count: 0,
        entry_price: effectivePriceNum,
        price_override: effectivePriceNum,
        metadata,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from("invite_codes")
        .insert(record)
        .select(INVITE_SELECT)
        .single();
      if (error) throw error;
      onCreate?.(enrichInvite(data));
      onClose();
    } catch (e) {
      setErr(e?.message ?? "Failed to create invite.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.85)",
        zIndex: 10001,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        backdropFilter: "blur(8px)",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 640,
          background: "#0d0d0d",
          border: "1px solid #252525",
          borderRadius: "20px 20px 0 0",
          padding: "28px 28px 40px",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#e0e0e0" }}>
              Create Community Link
            </div>
            <div style={{ fontSize: 11, color: "#555", marginTop: 3 }}>
              Share the generated link — no codes needed
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "1px solid #252525",
              borderRadius: 8,
              color: "#555",
              cursor: "pointer",
              padding: "4px 10px",
              fontFamily: "inherit",
            }}
          >
            ✕
          </button>
        </div>
        <div
          style={{
            background: "rgba(163,230,53,.04)",
            border: "1px solid rgba(163,230,53,.12)",
            borderRadius: 12,
            padding: "12px 14px",
            marginBottom: 18,
            fontSize: 12,
            color: "#5a8a30",
            lineHeight: 1.8,
          }}
        >
          <strong style={{ color: "#a3e635" }}>🔗 Link-first model:</strong> One
          smart link per community. When whitelist slots fill, the link
          auto-converts to waitlist mode — users see a "Join Waitlist Now" CTA
          automatically.
        </div>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
        >
          <div style={{ gridColumn: "1/-1" }}>
            <FieldLabel>Community / Campaign Name *</FieldLabel>
            <Input
              value={name}
              onChange={setName}
              placeholder="e.g. CryptoTwitter WL, DeFi Discord, NFT Community"
            />
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <FieldLabel>Category</FieldLabel>
            <div style={{ display: "flex", gap: 6 }}>
              {CATEGORY_OPTIONS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  style={{
                    flex: 1,
                    padding: "9px 6px",
                    borderRadius: 9,
                    border: "none",
                    cursor: "pointer",
                    background:
                      category === c.id
                        ? `${ACC_COLORS[c.id] ?? "#94a3b8"}18`
                        : "#111",
                    borderWidth: 1.5,
                    borderStyle: "solid",
                    borderColor:
                      category === c.id
                        ? `${ACC_COLORS[c.id] ?? "#94a3b8"}55`
                        : "#1e1e1e",
                    color:
                      category === c.id
                        ? (ACC_COLORS[c.id] ?? "#94a3b8")
                        : "#666",
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: "inherit",
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <FieldLabel>Whitelist Slots</FieldLabel>
            <Input
              value={maxUses}
              onChange={setMaxUses}
              placeholder="e.g. 100"
            />
            <div style={{ fontSize: 9, color: "#444", marginTop: 4 }}>
              How many get WL access
            </div>
          </div>
          <div>
            <FieldLabel>Waitlist Slots (0=off)</FieldLabel>
            <Input
              value={waitlistSlots}
              onChange={setWaitlistSlots}
              placeholder="e.g. 500"
            />
            <div style={{ fontSize: 9, color: "#38bdf8", marginTop: 4 }}>
              ↑ Auto-activates when WL full
            </div>
          </div>
          <div>
            <FieldLabel>Entry Price</FieldLabel>
            <Input
              value={price}
              onChange={setPrice}
              prefix="$"
              placeholder="4.00"
            />
          </div>
          {category === "whitelist" && (
            <div>
              <FieldLabel>Whitelist Price (0=free)</FieldLabel>
              <Input
                value={wlPrice}
                onChange={setWlPrice}
                prefix="$"
                placeholder="0 = free"
              />
            </div>
          )}
          <div>
            <FieldLabel>EP Grant</FieldLabel>
            <Input value={epGrant} onChange={setEpGrant} placeholder="500" />
          </div>
          <div>
            <FieldLabel>VIP Lottery Slots (0=off)</FieldLabel>
            <Input
              value={vipSlots}
              onChange={setVipSlots}
              placeholder="e.g. 5"
            />
          </div>
        </div>
        {err && (
          <div
            style={{
              marginTop: 14,
              padding: "10px 13px",
              background: "rgba(239,68,68,.07)",
              border: "1px solid rgba(239,68,68,.22)",
              borderRadius: 10,
              fontSize: 12,
              color: "#f87171",
            }}
          >
            {err}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "13px",
              borderRadius: 12,
              border: "1px solid #252525",
              background: "transparent",
              color: "#666",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Cancel
          </button>
          <button
            onClick={create}
            disabled={creating}
            style={{
              flex: 2,
              padding: "13px",
              borderRadius: 12,
              border: "none",
              background: creating
                ? "#1a1a1a"
                : "linear-gradient(135deg,#a3e635,#65a30d)",
              color: creating ? "#333" : "#061000",
              fontWeight: 800,
              fontSize: 14,
              cursor: creating ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {creating ? "Creating…" : "Create Link →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main InviteSection ────────────────────────────────────────────────────────
export default function InviteSection() {
  const [paywallConfig, setPaywallConfig] = useState(null);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [liveStats, setLiveStats] = useState({
    memberCount: 0,
    waitlistCount: 0,
    whitelistTotal: 0,
    whitelistFilled: 0,
  });
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [cfg, { data: rows, error: invErr }] = await Promise.all([
        fetchPaywallConfig(),
        supabase
          .from("invite_codes")
          .select(INVITE_SELECT)
          .eq("status", "active")
          .order("created_at", { ascending: false }),
      ]);
      if (invErr) throw invErr;
      setPaywallConfig(cfg);
      setInvites((rows ?? []).map(enrichInvite).filter(Boolean));
    } catch (e) {
      setError(e?.message ?? "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const fetchLiveStatsData = useCallback(async () => {
    try {
      const [r1, r2, r3, r4] = await Promise.allSettled([
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("account_activated", true),
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .in("payment_status", ["paid", "vip", "free"]),
        supabase
          .from("invite_codes")
          .select("max_uses, uses_count")
          .eq("type", "whitelist")
          .eq("status", "active"),
        supabase
          .from("waitlist_entries")
          .select("*", { count: "exact", head: true }),
      ]);
      if (!mountedRef.current) return;
      setLiveStats((prev) => {
        const next = { ...prev };
        const c1 =
          r1.status === "fulfilled" && r1.value.count != null
            ? r1.value.count
            : 0;
        const c2 =
          r2.status === "fulfilled" && r2.value.count != null
            ? r2.value.count
            : 0;
        const best = Math.max(c1, c2);
        if (best > 0) next.memberCount = best;
        if (r3.status === "fulfilled" && r3.value.data) {
          next.whitelistTotal = r3.value.data.reduce(
            (s, r) => s + (Number(r.max_uses) || 0),
            0,
          );
          next.whitelistFilled = r3.value.data.reduce(
            (s, r) => s + (Number(r.uses_count) || 0),
            0,
          );
        }
        if (r4.status === "fulfilled" && r4.value.count != null)
          next.waitlistCount = r4.value.count;
        return next;
      });
      const bestCount = Math.max(
        r1.status === "fulfilled" && r1.value.count != null
          ? r1.value.count
          : 0,
        r2.status === "fulfilled" && r2.value.count != null
          ? r2.value.count
          : 0,
      );
      if (bestCount > 0)
        updatePaywallConfig({ member_count: bestCount }).catch(() => {});
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchLiveStatsData();
    const id = setInterval(() => {
      if (mountedRef.current) fetchLiveStatsData();
    }, 30_000);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [fetchLiveStatsData]);

  // Realtime: platform_settings
  useEffect(() => {
    const ch = supabase
      .channel("invite-section-paywall-config")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "platform_settings" },
        async (payload) => {
          const key = payload?.new?.key ?? payload?.old?.key ?? "";
          if (key && key !== "paywall_config") return;
          try {
            const cfg = await fetchPaywallConfig();
            setPaywallConfig(cfg);
          } catch {}
        },
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  // Realtime: invite_codes
  useEffect(() => {
    const ch = supabase
      .channel("invite-section-invite-codes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invite_codes" },
        () => load(),
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [load]);

  const handleOptimisticUpdate = useCallback((updated) => {
    setInvites((prev) =>
      prev.map((inv) =>
        inv.id === updated.id ? enrichInvite({ ...inv, ...updated }) : inv,
      ),
    );
  }, []);
  const handleDelete = useCallback((id) => {
    setInvites((prev) => prev.filter((inv) => inv.id !== id));
  }, []);
  const handleCreate = useCallback((newInvite) => {
    if (newInvite) setInvites((prev) => [newInvite, ...prev]);
  }, []);

  const filtered = searchQuery
    ? invites.filter(
        (i) =>
          (i.metadata?.invite_name ?? "")
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          i.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (i.metadata?.invite_category ?? "")
            .toLowerCase()
            .includes(searchQuery.toLowerCase()),
      )
    : invites;

  const waitlistTotal = invites.reduce(
    (s, i) => s + (i.metadata?.waitlist_count ?? 0),
    0,
  );
  const vipTotal = invites.reduce(
    (s, i) => s + (i.metadata?.vip_winners?.length ?? 0),
    0,
  );

  return (
    <>
      <style>{`
        @keyframes xvFadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes xvFadeIn { from{opacity:0} to{opacity:1} }
        @keyframes ssIn     { from{opacity:0;transform:translateY(6px) scale(.97)} to{opacity:1;transform:none} }
      `}</style>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 360px",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* LEFT */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 900,
                  color: "#e0e0e0",
                  letterSpacing: "-0.5px",
                }}
              >
                Invite Control
              </div>
              <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>
                Link-first model ·{" "}
                <span style={{ color: "#a3e635" }}>?ref=CODE</span> auto-applies
                on click · Waitlist activates when full
              </div>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "10px 16px",
                borderRadius: 11,
                border: "none",
                background: "linear-gradient(135deg,#a3e635,#65a30d)",
                color: "#061000",
                fontWeight: 800,
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "inherit",
                flexShrink: 0,
                boxShadow: "0 4px 18px rgba(163,230,53,.25)",
              }}
            >
              + New Link
            </button>
          </div>

          {/* Stats */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 8,
            }}
          >
            {[
              {
                label: "Public Price",
                value: `$${fmt(paywallConfig?.price_usd ?? 4)}`,
                color: "#a3e635",
              },
              {
                label: "Active Links",
                value: invites.filter((i) => i.status === "active").length,
                color: "#f59e0b",
              },
              { label: "On Waitlist", value: waitlistTotal, color: "#38bdf8" },
              { label: "VIP Winners", value: vipTotal, color: "#a78bfa" },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                style={{
                  background: "#0c0c0c",
                  border: "1px solid #1a1a1a",
                  borderRadius: 12,
                  padding: "12px 14px",
                }}
              >
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 900,
                    color,
                    letterSpacing: "-1px",
                  }}
                >
                  {value}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "#444",
                    fontWeight: 600,
                    marginTop: 3,
                  }}
                >
                  {label}
                </div>
              </div>
            ))}
          </div>

          {loading ? (
            <div
              style={{
                background: "#0c0c0c",
                border: "1px solid #1a1a1a",
                borderRadius: 16,
                padding: 24,
                textAlign: "center",
                color: "#444",
                fontSize: 12,
              }}
            >
              Loading…
            </div>
          ) : (
            <PublicEntryCard
              config={paywallConfig}
              onConfigUpdate={(patch) =>
                setPaywallConfig((prev) => ({ ...prev, ...patch }))
              }
            />
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, height: 1, background: "#151515" }} />
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#333",
                letterSpacing: "2px",
                textTransform: "uppercase",
              }}
            >
              Community Links
            </span>
            <div style={{ flex: 1, height: 1, background: "#151515" }} />
          </div>

          {invites.length > 2 && (
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, code, category…"
              style={{
                width: "100%",
                background: "#0e0e0e",
                border: "1.5px solid #1e1e1e",
                borderRadius: 10,
                padding: "10px 14px",
                color: "#c0c0c0",
                fontSize: 12,
                outline: "none",
                fontFamily: "inherit",
              }}
              onFocus={(e) =>
                (e.target.style.borderColor = "rgba(163,230,53,.3)")
              }
              onBlur={(e) => (e.target.style.borderColor = "#1e1e1e")}
            />
          )}

          {error && (
            <div
              style={{
                padding: "12px 16px",
                background: "rgba(239,68,68,.06)",
                border: "1px solid rgba(239,68,68,.18)",
                borderRadius: 11,
                fontSize: 12,
                color: "#f87171",
              }}
            >
              {error}{" "}
              <button
                onClick={load}
                style={{
                  marginLeft: 8,
                  color: "#a3e635",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Retry
              </button>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {!loading && filtered.length === 0 && (
              <div
                style={{
                  padding: 32,
                  textAlign: "center",
                  background: "#0a0a0a",
                  border: "1px dashed #1e1e1e",
                  borderRadius: 14,
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 10 }}>🔗</div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#444",
                    marginBottom: 6,
                  }}
                >
                  No community links yet
                </div>
                <div style={{ fontSize: 11, color: "#333", marginBottom: 14 }}>
                  Create a whitelist link for each community you want to target
                </div>
                <button
                  onClick={() => setShowCreate(true)}
                  style={{
                    padding: "9px 18px",
                    borderRadius: 10,
                    border: "1px solid rgba(163,230,53,.3)",
                    background: "rgba(163,230,53,.06)",
                    color: "#a3e635",
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  + Create First Link
                </button>
              </div>
            )}
            {filtered.map((invite) => (
              <InviteCard
                key={invite.id}
                invite={invite}
                onOptimisticUpdate={handleOptimisticUpdate}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>

        {/* RIGHT — live preview */}
        <PaywallHeroPreview
          paywallConfig={paywallConfig}
          customInvites={invites}
          liveStats={liveStats}
        />
      </div>

      {showCreate && (
        <CreateInviteDrawer
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}
    </>
  );
}
