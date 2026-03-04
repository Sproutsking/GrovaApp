// src/components/Admin/sections/InviteSection.jsx — v10 COMMAND CENTER ULTIMATE
// ─────────────────────────────────────────────────────────────────────────────
// ARCHITECTURE:
//  • PUBLIC ENTRY card — system invite, controls /paywall hero price + slides.
//  • CUSTOM INVITE cards — whitelist / waitlist / VIP access per-link.
//  • WHITELIST → auto-becomes WAITLIST when max_uses + waitlist_slots set.
//  • VIP LOTTERY — per-invite: N winners out of M users get free access.
//  • LIVE PAYWALL PREVIEW — right panel shows exactly what /paywall hero renders.
//  • WAITLIST MANAGEMENT — promote, export, see position, status per user.
//  • OPTIMISTIC UI — all updates reflect instantly, rollback on error.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useInvites } from "../useAdminData";
import { supabase } from "../../../services/config/supabase";

// ─── Constants ────────────────────────────────────────────────────────────────
const SLIDE_TYPES = [
  { id: "hero",        icon: "🚀", label: "Hero",         desc: "Big headline + CTA" },
  { id: "countdown",   icon: "⏱",  label: "Countdown",    desc: "Urgency timer" },
  { id: "social",      icon: "👥", label: "Social Proof",  desc: "Member count + faces" },
  { id: "testimonial", icon: "💬", label: "Testimonial",   desc: "Quote from a member" },
  { id: "features",    icon: "✦",  label: "Features",     desc: "3-column feature grid" },
  { id: "offer",       icon: "💎", label: "Offer",        desc: "Price + value stack" },
  { id: "whitelist",   icon: "⭐", label: "Whitelist",    desc: "Exclusive access info" },
  { id: "waitlist",    icon: "⏳", label: "Waitlist",     desc: "Queue position + timer" },
  { id: "vip",         icon: "👑", label: "VIP Lottery",  desc: "Random VIP selection" },
];

const DESIGN_MODELS = [
  { id: "minimal",  label: "Minimal",  preview: "#0a0a0a", accent: "#e8e8e8" },
  { id: "bold",     label: "Bold",     preview: "#0a1a00", accent: "#a3e635" },
  { id: "dark",     label: "Dark",     preview: "#050510", accent: "#818cf8" },
  { id: "glass",    label: "Glass",    preview: "#0f1520", accent: "#38bdf8" },
  { id: "gradient", label: "Gradient", preview: "#1a0a1a", accent: "#f59e0b" },
  { id: "warm",     label: "Warm",     preview: "#1a0a00", accent: "#fb923c" },
];

const CATEGORY_OPTIONS = [
  { id: "community", label: "🏠 Community" },
  { id: "whitelist", label: "⭐ Whitelist" },
  { id: "vip",       label: "💎 VIP" },
  { id: "standard",  label: "🎟 Standard" },
  { id: "custom",    label: "✏️ Custom" },
];

const ACC_COLORS = {
  whitelist: "#f59e0b", vip: "#a78bfa", community: "#34d399",
  standard: "#94a3b8", admin: "#f87171", custom: "#38bdf8",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) =>
  typeof n === "number" && !isNaN(n)
    ? n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)
    : "—";

const mono = { fontFamily: "'JetBrains Mono', 'Fira Mono', monospace" };

function resolvePrice(invite) {
  if (!invite) return 4;
  const po = invite.price_override;
  if (po != null && !isNaN(Number(po))) return Number(po);
  const meta = invite?.metadata ?? {};
  if (meta.entry_price_cents != null) return Number(meta.entry_price_cents) / 100;
  if (invite.entry_price != null) return Number(invite.entry_price);
  return 4;
}

// ─── Atoms ────────────────────────────────────────────────────────────────────
function Pill({ label, color = "#a3e635", bg, border }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 9, fontWeight: 800, letterSpacing: "1.8px", textTransform: "uppercase",
      color, background: bg ?? `${color}14`,
      border: `1px solid ${border ?? `${color}33`}`,
      borderRadius: 20, padding: "3px 9px", whiteSpace: "nowrap",
    }}>{label}</span>
  );
}

function FieldLabel({ children }) {
  return (
    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "2px", textTransform: "uppercase", color: "#3a3a3a", marginBottom: 6 }}>
      {children}
    </div>
  );
}

function Input({ value, onChange, onBlur, placeholder, prefix, mono: isMono, type = "text", style = {} }) {
  return (
    <div style={{ position: "relative" }}>
      {prefix && (
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#555", fontSize: 13, pointerEvents: "none" }}>{prefix}</span>
      )}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        style={{
          width: "100%", background: "#0e0e0e", border: "1.5px solid #222",
          borderRadius: 10, padding: prefix ? "10px 12px 10px 26px" : "10px 12px",
          color: "#f0f0f0", fontSize: 13, outline: "none", transition: "border-color .15s",
          fontFamily: isMono ? "'JetBrains Mono',monospace" : "inherit",
          ...style,
        }}
        onFocus={e => e.target.style.borderColor = "rgba(163,230,53,.4)"}
      />
    </div>
  );
}

function Textarea({ value, onChange, onBlur, placeholder, rows = 2 }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      rows={rows}
      style={{
        width: "100%", background: "#0e0e0e", border: "1.5px solid #222",
        borderRadius: 10, padding: "10px 12px", color: "#f0f0f0", fontSize: 12,
        outline: "none", resize: "vertical", lineHeight: 1.7, fontFamily: "inherit",
        transition: "border-color .15s",
      }}
      onFocus={e => e.target.style.borderColor = "rgba(163,230,53,.4)"}
    />
  );
}

function Toggle({ checked, onChange, size = "md" }) {
  const w = size === "sm" ? 28 : 36;
  const h = size === "sm" ? 16 : 20;
  const d = size === "sm" ? 10 : 12;
  const off = size === "sm" ? 14 : 16;
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        width: w, height: h, borderRadius: h, flexShrink: 0,
        background: checked ? "#a3e635" : "#252525",
        border: `1.5px solid ${checked ? "#a3e635" : "#333"}`,
        position: "relative", transition: "all .2s", cursor: "pointer",
      }}
    >
      <div style={{
        position: "absolute", top: (h - d) / 2 - 1, left: checked ? off : 2,
        width: d, height: d, borderRadius: "50%",
        background: checked ? "#061000" : "#555", transition: "left .2s",
      }} />
    </div>
  );
}

function SaveIndicator({ state }) {
  if (state === "idle") return null;
  const map = { saving: { label: "Saving…", color: "#888" }, saved: { label: "✓ Saved", color: "#a3e635" }, error: { label: "✗ Failed", color: "#f87171" } };
  const { label, color } = map[state] ?? map.saved;
  return <span style={{ fontSize: 10, fontWeight: 700, color, marginLeft: 6 }}>{label}</span>;
}

function Btn({ onClick, children, danger, accent, disabled, small, style = {} }) {
  const bg = danger ? "rgba(239,68,68,.08)" : accent ? "linear-gradient(135deg,#a3e635,#65a30d)" : "transparent";
  const border = danger ? "rgba(239,68,68,.3)" : accent ? "transparent" : "#252525";
  const color = danger ? "#f87171" : accent ? "#061000" : "#555";
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: small ? "6px 11px" : "9px 14px", borderRadius: 9,
      border: `1px solid ${border}`, background: disabled ? "#111" : bg,
      color: disabled ? "#333" : color,
      fontWeight: 700, fontSize: small ? 10 : 11, cursor: disabled ? "not-allowed" : "pointer",
      fontFamily: "inherit", transition: "all .15s", whiteSpace: "nowrap", ...style,
    }}>{children}</button>
  );
}

// ─── useAutoSave ──────────────────────────────────────────────────────────────
function useAutoSave(initial, saveFn, delay = 600) {
  const [local, setLocal] = useState(initial);
  const [saveState, setSaveState] = useState("idle");
  const timerRef = useRef(null);
  const rollbackRef = useRef(initial);

  useEffect(() => { setLocal(initial); rollbackRef.current = initial; }, [initial]); // eslint-disable-line

  const commit = useCallback((val) => {
    rollbackRef.current = local;
    setSaveState("saving");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        await saveFn(val);
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 1800);
      } catch {
        setLocal(rollbackRef.current);
        setSaveState("error");
        setTimeout(() => setSaveState("idle"), 3000);
      }
    }, delay);
  }, [local, saveFn, delay]);

  const change = useCallback((val) => { setLocal(val); commit(val); }, [commit]);
  return [local, change, saveState];
}

// ─── CopyLinkButton ───────────────────────────────────────────────────────────
function CopyLinkButton({ code, label = "Copy invite link" }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const url = code ? `${window.location.origin}?code=${code}` : window.location.origin;
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  return (
    <button onClick={copy} style={{
      flex: 1, padding: "9px", borderRadius: 10, fontFamily: "inherit",
      border: `1.5px solid ${copied ? "rgba(163,230,53,.4)" : "#222"}`,
      background: copied ? "rgba(163,230,53,.06)" : "transparent",
      color: copied ? "#a3e635" : "#444", fontWeight: 700, fontSize: 11,
      cursor: "pointer", transition: "all .15s",
    }}>
      {copied ? "✓ Copied" : `📋 ${label}`}
    </button>
  );
}

// ─── SlideChip ────────────────────────────────────────────────────────────────
function SlideChip({ slide, onRemove }) {
  const type = SLIDE_TYPES.find(t => t.id === slide.type) ?? SLIDE_TYPES[0];
  const model = DESIGN_MODELS.find(m => m.id === slide.design) ?? DESIGN_MODELS[0];
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      background: "#111", border: `1px solid ${model.accent}22`, borderRadius: 10, padding: "7px 10px",
    }}>
      <div style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, background: model.preview, border: `1px solid ${model.accent}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>{type.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#c0c0c0" }}>{type.label}</div>
        <div style={{ fontSize: 9, color: "#444", textTransform: "uppercase", letterSpacing: "1px" }}>{model.label}</div>
      </div>
      <button onClick={onRemove} style={{ background: "transparent", border: "none", color: "#3a3a3a", cursor: "pointer", fontSize: 13, padding: "2px 4px" }}
        onMouseOver={e => e.target.style.color = "#f87171"} onMouseOut={e => e.target.style.color = "#3a3a3a"}>✕</button>
    </div>
  );
}

// ─── AddSlidePanel ────────────────────────────────────────────────────────────
function AddSlidePanel({ onAdd, onClose }) {
  const [selectedType, setSelectedType] = useState(null);
  const [selectedModel, setSelectedModel] = useState("bold");
  return (
    <div style={{ background: "#0a0a0a", border: "1px solid #252525", borderRadius: 14, padding: 18, animation: "xvFadeUp .2s ease" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#a3e635" }}>Add Slide</div>
        <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#444", cursor: "pointer", fontSize: 14 }}>✕</button>
      </div>
      <FieldLabel>Slide Type</FieldLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 14 }}>
        {SLIDE_TYPES.map(t => (
          <button key={t.id} onClick={() => setSelectedType(t.id)} style={{
            padding: "9px 6px", borderRadius: 9, border: "none", cursor: "pointer",
            background: selectedType === t.id ? "rgba(163,230,53,.1)" : "#111",
            borderWidth: 1.5, borderStyle: "solid",
            borderColor: selectedType === t.id ? "rgba(163,230,53,.4)" : "#1e1e1e",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4, fontFamily: "inherit",
          }}>
            <span style={{ fontSize: 18 }}>{t.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: selectedType === t.id ? "#a3e635" : "#666" }}>{t.label}</span>
            <span style={{ fontSize: 9, color: "#333", lineHeight: 1.3, textAlign: "center" }}>{t.desc}</span>
          </button>
        ))}
      </div>
      <FieldLabel>Design Model</FieldLabel>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {DESIGN_MODELS.map(m => (
          <button key={m.id} onClick={() => setSelectedModel(m.id)} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
            borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit",
            background: selectedModel === m.id ? `${m.accent}18` : "#111",
            borderWidth: 1.5, borderStyle: "solid",
            borderColor: selectedModel === m.id ? `${m.accent}55` : "#1e1e1e",
          }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: m.preview, border: `1px solid ${m.accent}66`, flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: selectedModel === m.id ? m.accent : "#555" }}>{m.label}</span>
          </button>
        ))}
      </div>
      <button
        onClick={() => { if (selectedType) { onAdd({ type: selectedType, design: selectedModel }); onClose(); } }}
        disabled={!selectedType}
        style={{
          width: "100%", padding: "11px", borderRadius: 10, border: "none",
          background: selectedType ? "linear-gradient(135deg,#a3e635,#65a30d)" : "#1e1e1e",
          color: selectedType ? "#061000" : "#333",
          fontWeight: 800, fontSize: 13, cursor: selectedType ? "pointer" : "not-allowed", fontFamily: "inherit",
        }}>Add Slide to PaywallGate</button>
    </div>
  );
}

// ─── PAYWALL LIVE PREVIEW ─────────────────────────────────────────────────────
// Mirrors PaywallGate's PriceHero exactly:
//   Slide 0: PUBLIC PRICE  — always (public entry price, EP, slot bar)
//   Slide N: WHITELIST ENTRY — per active whitelist invite (not full)
//   Slide N: WAITLIST — per full whitelist invite with waitlist_slots
//   Slide N: VIP LOTTERY — per invite with vip_slots
//   Slide N: CUSTOM — per custom slide attached to public entry
function PaywallHeroPreview({ publicInvite, customInvites }) {
  const [slideIdx, setSlideIdx] = useState(0);
  const [animDir, setAnimDir] = useState(null); // "in" | null
  const [displayIdx, setDisplayIdx] = useState(0); // what's actually rendered
  const timerRef = useRef(null);

  const publicMeta = publicInvite?.metadata ?? {};
  const publicPrice = resolvePrice(publicInvite);
  const publicEP    = publicMeta.ep_grant ?? 300;
  const publicSlots = publicMeta.slots_total ?? 0;
  const publicClaimed = publicMeta.slots_claimed ?? 0;
  const publicClaimedPct = publicSlots > 0 ? Math.min(100, Math.round((publicClaimed / publicSlots) * 100)) : 73;
  const publicSlides = publicMeta.slides ?? [];

  // Mirror PaywallGate's slide-build logic exactly
  const previewSlides = useMemo(() => {
    const slides = [];
    // Slide 0: PUBLIC PRICE — always
    slides.push({ type: "public_entry" });

    // Active whitelist invites (not full) → WHITELIST ENTRY slide
    customInvites
      .filter(i => i.status !== "inactive" && (
        i.type === "whitelist" ||
        i.metadata?.invite_category === "whitelist" ||
        i.metadata?.has_whitelist_access
      ) && !i.is_full)
      .forEach(inv => slides.push({ type: "whitelist_entry", invite: inv }));

    // Full whitelist invites WITH waitlist_slots → WAITLIST slide
    customInvites
      .filter(i => i.status !== "inactive" && i.is_full &&
        (i.type === "whitelist" || i.metadata?.invite_category === "whitelist") &&
        (i.metadata?.waitlist_slots > 0))
      .forEach(inv => slides.push({ type: "waitlist_entry", invite: inv }));

    // Invites with vip_slots → VIP LOTTERY slide
    customInvites
      .filter(i => i.status !== "inactive" && i.metadata?.vip_slots > 0)
      .forEach(inv => slides.push({ type: "vip_entry", invite: inv }));

    // Custom slides from public entry metadata
    publicSlides.forEach((s, i) => slides.push({ type: "custom_slide", slide: s, idx: i }));

    return slides;
  }, [publicInvite, customInvites, publicSlides]); // eslint-disable-line

  // Auto-rotate: restart whenever slide count changes
  useEffect(() => {
    clearInterval(timerRef.current);
    if (previewSlides.length <= 1) return;
    timerRef.current = setInterval(() => {
      setSlideIdx(prev => {
        const next = (prev + 1) % previewSlides.length;
        // trigger animation
        setAnimDir("in");
        setTimeout(() => {
          setDisplayIdx(next);
          setAnimDir(null);
        }, 220);
        return next;
      });
    }, 3600);
    return () => clearInterval(timerRef.current);
  }, [previewSlides.length]);

  // Keep displayIdx in sync with slideIdx on initial render
  useEffect(() => { setDisplayIdx(slideIdx); }, []); // eslint-disable-line

  const goTo = (idx) => {
    if (idx === slideIdx) return;
    clearInterval(timerRef.current);
    setAnimDir("in");
    setSlideIdx(idx);
    setTimeout(() => { setDisplayIdx(idx); setAnimDir(null); }, 220);
    // Restart timer
    if (previewSlides.length > 1) {
      timerRef.current = setInterval(() => {
        setSlideIdx(prev => {
          const next = (prev + 1) % previewSlides.length;
          setAnimDir("in");
          setTimeout(() => { setDisplayIdx(next); setAnimDir(null); }, 220);
          return next;
        });
      }, 3600);
    }
  };

  const current = previewSlides[displayIdx] ?? previewSlides[0];

  // Per-slide accent color for the glow
  const accentFor = (s) => {
    if (!s) return "#a3e635";
    if (s.type === "public_entry")   return "#a3e635";
    if (s.type === "whitelist_entry") return "#f59e0b";
    if (s.type === "waitlist_entry") return "#38bdf8";
    if (s.type === "vip_entry")      return "#a78bfa";
    return "#a3e635";
  };
  const accent = accentFor(current);

  // ── slide renderers — pixel-matched to PaywallGate's PriceHero ──────────────

  const renderPublicEntry = () => (
    <div>
      {/* Badge */}
      <div style={{ marginBottom: 10 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 8, fontWeight: 800, letterSpacing: "2px", textTransform: "uppercase", color: "#a3e635", background: "rgba(163,230,53,.1)", border: "1px solid rgba(163,230,53,.25)", borderRadius: 20, padding: "3px 10px" }}>PUBLIC PRICE</span>
      </div>
      {/* Price + EP row */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
            <span style={{ fontSize: 20, color: "#444", fontWeight: 600 }}>$</span>
            <span style={{ fontSize: 44, fontWeight: 900, color: "#fff", letterSpacing: "-3px", lineHeight: 1, ...mono }}>{fmt(publicPrice)}</span>
          </div>
          <div style={{ fontSize: 9, color: "#3a3a3a", fontWeight: 600, marginTop: 4 }}>one-time · instant activation</div>
        </div>
        <div style={{ background: "#111", border: "1px solid rgba(163,230,53,.15)", borderRadius: 10, padding: "8px 12px", textAlign: "center", flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#a3e635", letterSpacing: "-0.5px", lineHeight: 1 }}>{publicEP} EP</div>
          <div style={{ fontSize: 7, fontWeight: 700, color: "#333", letterSpacing: "0.8px", textTransform: "uppercase", marginTop: 2 }}>instant reward</div>
        </div>
      </div>
      {/* Slot progress bar */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 9, color: "#333" }}>Early access slots</span>
          <span style={{ fontSize: 9, color: "#a3e635", fontWeight: 700 }}>{publicClaimedPct}% claimed</span>
        </div>
        <div style={{ height: 3, background: "#1a1a1a", borderRadius: 2 }}>
          <div style={{ width: `${publicClaimedPct}%`, height: "100%", borderRadius: 2, background: "linear-gradient(90deg,#a3e635,#f59e0b)", boxShadow: "0 0 6px rgba(163,230,53,.4)", transition: "width .5s" }} />
        </div>
      </div>
      {/* Hero message */}
      {publicMeta.hero_message && (
        <div style={{ marginTop: 10, fontSize: 9, color: "#3a3a3a", lineHeight: 1.6 }}>{publicMeta.hero_message}</div>
      )}
      {/* CTA */}
      <div style={{ marginTop: 14, background: "linear-gradient(135deg,#a3e635,#65a30d)", borderRadius: 10, padding: "10px 16px", fontSize: 11, fontWeight: 800, color: "#061000", textAlign: "center" }}>
        Get Access Now →
      </div>
    </div>
  );

  const renderWhitelistEntry = (inv) => {
    const m = inv?.metadata ?? {};
    const wlPrice = resolvePrice(inv);
    const isFree = wlPrice === 0;
    const usesCount = inv?.uses_count ?? 0;
    const maxUses = inv?.max_uses ?? 0;
    const usedPct = maxUses > 0 ? Math.min(100, Math.round((usesCount / maxUses) * 100)) : 0;
    const epGrant = m.ep_grant ?? 500;
    return (
      <div>
        <div style={{ marginBottom: 10 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 8, fontWeight: 800, letterSpacing: "2px", textTransform: "uppercase", color: isFree ? "#a3e635" : "#f59e0b", background: isFree ? "rgba(163,230,53,.1)" : "rgba(245,158,11,.1)", border: `1px solid ${isFree ? "rgba(163,230,53,.25)" : "rgba(245,158,11,.25)"}`, borderRadius: 20, padding: "3px 10px" }}>
            {isFree ? "FREE ACCESS" : "WHITELIST ENTRY"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
              {!isFree && <span style={{ fontSize: 20, color: "#444", fontWeight: 600 }}>$</span>}
              <span style={{ fontSize: isFree ? 36 : 44, fontWeight: 900, color: isFree ? "#a3e635" : "#f59e0b", letterSpacing: "-3px", lineHeight: 1, ...mono }}>
                {isFree ? "FREE" : fmt(wlPrice)}
              </span>
            </div>
            <div style={{ fontSize: 9, color: "#3a3a3a", marginTop: 4 }}>
              {m.invite_name || inv?.code || "whitelist · exclusive entry"}
            </div>
          </div>
          <div style={{ background: "#111", border: `1px solid ${isFree ? "rgba(163,230,53,.15)" : "rgba(245,158,11,.15)"}`, borderRadius: 10, padding: "8px 12px", textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: isFree ? "#a3e635" : "#f59e0b", letterSpacing: "-0.5px", lineHeight: 1 }}>{epGrant} EP</div>
            <div style={{ fontSize: 7, fontWeight: 700, color: "#333", letterSpacing: "0.8px", textTransform: "uppercase", marginTop: 2 }}>instant reward</div>
          </div>
        </div>
        {maxUses > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 9, color: "#333" }}>Whitelist slots</span>
              <span style={{ fontSize: 9, color: "#f59e0b", fontWeight: 700 }}>{usesCount}/{maxUses}</span>
            </div>
            <div style={{ height: 3, background: "#1a1a1a", borderRadius: 2 }}>
              <div style={{ width: `${usedPct}%`, height: "100%", borderRadius: 2, background: "linear-gradient(90deg,#f59e0b,#f87171)" }} />
            </div>
          </div>
        )}
        <div style={{ marginTop: 14, background: isFree ? "linear-gradient(135deg,#a3e635,#22c55e)" : "linear-gradient(135deg,#f59e0b,#d97706)", borderRadius: 10, padding: "10px 16px", fontSize: 11, fontWeight: 800, color: "#061000", textAlign: "center" }}>
          {isFree ? "🎉 Activate Free Access →" : "Claim Whitelist Spot →"}
        </div>
      </div>
    );
  };

  const renderWaitlistEntry = (inv) => {
    const m = inv?.metadata ?? {};
    const wlCount = m.waitlist_count ?? 0;
    const wlSlots = m.waitlist_slots ?? 0;
    const remaining = Math.max(0, wlSlots - wlCount);
    return (
      <div>
        <div style={{ marginBottom: 10 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 8, fontWeight: 800, letterSpacing: "2px", textTransform: "uppercase", color: "#38bdf8", background: "rgba(56,189,248,.08)", border: "1px solid rgba(56,189,248,.22)", borderRadius: 20, padding: "3px 10px" }}>WAITLIST</span>
        </div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: "#555" }}>{m.invite_name || inv?.code || "Waitlist"}</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#38bdf8", lineHeight: 1.1, marginTop: 4 }}>Join the Queue</div>
          <div style={{ fontSize: 9, color: "#3a3a3a", marginTop: 4 }}>Whitelist is full · secure your spot</div>
        </div>
        <div style={{ display: "flex", gap: 16, marginBottom: 14 }}>
          <div style={{ background: "#111", border: "1px solid rgba(56,189,248,.12)", borderRadius: 9, padding: "8px 12px", textAlign: "center", flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#38bdf8", lineHeight: 1 }}>{wlCount}</div>
            <div style={{ fontSize: 7, color: "#333", textTransform: "uppercase", letterSpacing: "0.8px", marginTop: 2 }}>in queue</div>
          </div>
          <div style={{ background: "#111", border: "1px solid rgba(163,230,53,.12)", borderRadius: 9, padding: "8px 12px", textAlign: "center", flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#a3e635", lineHeight: 1 }}>{remaining > 0 ? remaining : "–"}</div>
            <div style={{ fontSize: 7, color: "#333", textTransform: "uppercase", letterSpacing: "0.8px", marginTop: 2 }}>spots left</div>
          </div>
        </div>
        <div style={{ background: "linear-gradient(135deg,#38bdf8,#0284c7)", borderRadius: 10, padding: "10px 16px", fontSize: 11, fontWeight: 800, color: "#001a26", textAlign: "center" }}>
          Join Waitlist →
        </div>
      </div>
    );
  };

  const renderVipEntry = (inv) => {
    const m = inv?.metadata ?? {};
    const vipSlots = m.vip_slots ?? 0;
    const vipWinners = Array.isArray(m.vip_winners) ? m.vip_winners.length : (m.vip_winners ?? 0);
    const totalUsers = inv?.uses_count ?? 0;
    return (
      <div>
        <div style={{ marginBottom: 10 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 8, fontWeight: 800, letterSpacing: "2px", textTransform: "uppercase", color: "#a78bfa", background: "rgba(167,139,250,.1)", border: "1px solid rgba(167,139,250,.3)", borderRadius: 20, padding: "3px 10px" }}>👑 VIP LOTTERY</span>
        </div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: "#555" }}>Lucky {vipSlots} out of {totalUsers || "??"} users</div>
          <div style={{ fontSize: 44, fontWeight: 900, color: "#fff", letterSpacing: "-2px", lineHeight: 1, marginTop: 4 }}>FREE</div>
          <div style={{ fontSize: 9, color: "#3a3a3a", marginTop: 4 }}>VIP access · randomly selected</div>
        </div>
        <div style={{ display: "flex", gap: 16, marginBottom: 14 }}>
          <div style={{ background: "#111", border: "1px solid rgba(167,139,250,.12)", borderRadius: 9, padding: "8px 12px", textAlign: "center", flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#a78bfa", lineHeight: 1 }}>{vipSlots}</div>
            <div style={{ fontSize: 7, color: "#333", textTransform: "uppercase", letterSpacing: "0.8px", marginTop: 2 }}>VIP slots</div>
          </div>
          <div style={{ background: "#111", border: "1px solid rgba(245,158,11,.12)", borderRadius: 9, padding: "8px 12px", textAlign: "center", flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#f59e0b", lineHeight: 1 }}>{vipWinners}</div>
            <div style={{ fontSize: 7, color: "#333", textTransform: "uppercase", letterSpacing: "0.8px", marginTop: 2 }}>selected</div>
          </div>
        </div>
        <div style={{ background: "linear-gradient(135deg,#a78bfa,#7c3aed)", borderRadius: 10, padding: "10px 16px", fontSize: 11, fontWeight: 800, color: "#fff", textAlign: "center" }}>
          Enter VIP Lottery →
        </div>
      </div>
    );
  };

  const renderSlide = (slide) => {
    if (!slide) return null;
    if (slide.type === "public_entry")   return renderPublicEntry();
    if (slide.type === "whitelist_entry") return renderWhitelistEntry(slide.invite);
    if (slide.type === "waitlist_entry") return renderWaitlistEntry(slide.invite);
    if (slide.type === "vip_entry")      return renderVipEntry(slide.invite);
    // custom slide
    const st = SLIDE_TYPES.find(t => t.id === slide.slide?.type) ?? SLIDE_TYPES[0];
    return (
      <div style={{ textAlign: "center", color: "#555" }}>
        <div style={{ fontSize: 28 }}>{st.icon}</div>
        <div style={{ fontSize: 11, marginTop: 6, fontWeight: 700 }}>{st.label}</div>
        <div style={{ fontSize: 9, color: "#333", marginTop: 3 }}>{st.desc}</div>
      </div>
    );
  };

  // Slide type label for footer
  const slideLabel = (s) => {
    if (!s) return "";
    if (s.type === "public_entry")   return "Public Entry";
    if (s.type === "whitelist_entry") return s.invite?.metadata?.invite_name ? `WL · ${s.invite.metadata.invite_name}` : "Whitelist";
    if (s.type === "waitlist_entry") return s.invite?.metadata?.invite_name ? `Queue · ${s.invite.metadata.invite_name}` : "Waitlist";
    if (s.type === "vip_entry")      return s.invite?.metadata?.invite_name ? `VIP · ${s.invite.metadata.invite_name}` : "VIP Lottery";
    return SLIDE_TYPES.find(t => t.id === s.slide?.type)?.label ?? "Slide";
  };

  const slideIcon = (s) => {
    if (!s) return "🌐";
    if (s.type === "public_entry")   return "🌐";
    if (s.type === "whitelist_entry") return "⭐";
    if (s.type === "waitlist_entry") return "⏳";
    if (s.type === "vip_entry")      return "👑";
    return SLIDE_TYPES.find(t => t.id === s.slide?.type)?.icon ?? "🎞";
  };

  return (
    <div style={{ position: "sticky", top: 24 }}>
      {/* Preview label */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "2.5px", textTransform: "uppercase", color: "#2a2a2a" }}>◆ Live Paywall Preview</div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#a3e635", boxShadow: "0 0 6px rgba(163,230,53,.7)", animation: "xvGlow 2s ease-in-out infinite" }} />
          <span style={{ fontSize: 9, color: "#3a3a3a", fontWeight: 700 }}>Live</span>
        </div>
      </div>

      {/* Phone frame */}
      <div style={{ background: "#0d0d0d", border: "1.5px solid #1e1e1e", borderRadius: 22, overflow: "hidden", position: "relative" }}>

        {/* Status bar */}
        <div style={{ background: "#080808", padding: "8px 14px 5px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #111" }}>
          <span style={{ fontSize: 8, color: "#2a2a2a", fontWeight: 700, ...mono }}>9:41</span>
          <div style={{ width: 36, height: 5, background: "#151515", borderRadius: 3 }} />
          <div style={{ display: "flex", gap: 3 }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{ width: 2.5, height: 4 + i * 1.5, background: i < 3 ? "#333" : "#151515", borderRadius: 1 }} />
            ))}
          </div>
        </div>

        {/* Slide area — matches PaywallGate .xv-card */}
        <div style={{ position: "relative", overflow: "hidden", minHeight: 300 }}>
          {/* Accent glow — changes per slide */}
          <div style={{ position: "absolute", top: -50, right: -50, width: 160, height: 160, borderRadius: "50%", background: `radial-gradient(circle,${accent}28 0%,transparent 70%)`, pointerEvents: "none", transition: "background .5s", zIndex: 0 }} />

          {/* Slide content */}
          <div style={{
            position: "relative", zIndex: 1,
            padding: "18px 16px 14px",
            opacity: animDir === "in" ? 0 : 1,
            transform: animDir === "in" ? "translateX(14px)" : "translateX(0)",
            transition: animDir === "in" ? "none" : "opacity .22s ease, transform .22s ease",
          }}>
            {renderSlide(current)}
          </div>
        </div>

        {/* Slide dots — match PaywallGate .xv-hero-dots */}
        {previewSlides.length > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 5, padding: "8px 0 4px" }}>
            {previewSlides.map((s, i) => (
              <button key={i} onClick={() => goTo(i)} style={{
                height: 5, borderRadius: 3, border: "none", cursor: "pointer", padding: 0,
                width: i === displayIdx ? 16 : 5,
                background: i === displayIdx ? accentFor(s) : "#252525",
                transition: "all .28s",
              }} />
            ))}
          </div>
        )}

        {/* Footer — slide label + nav */}
        <div style={{ borderTop: "1px solid #101010", padding: "8px 14px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: "1.5px", color: accent, fontWeight: 700, transition: "color .3s" }}>{slideLabel(current)}</div>
            <div style={{ fontSize: 9, color: "#252525", marginTop: 1 }}>{displayIdx + 1} / {previewSlides.length}</div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => goTo((displayIdx - 1 + previewSlides.length) % previewSlides.length)}
              style={{ width: 22, height: 22, borderRadius: 6, border: "1px solid #252525", background: "transparent", color: "#3a3a3a", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
            <button onClick={() => goTo((displayIdx + 1) % previewSlides.length)}
              style={{ width: 22, height: 22, borderRadius: 6, border: "1px solid #252525", background: "transparent", color: "#3a3a3a", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
          </div>
        </div>
      </div>

      {/* Slide rotation list */}
      <div style={{ marginTop: 10, background: "#090909", border: "1px solid #161616", borderRadius: 12, padding: "10px 12px" }}>
        <div style={{ fontSize: 8, fontWeight: 800, color: "#2a2a2a", marginBottom: 7, textTransform: "uppercase", letterSpacing: "1.5px" }}>
          Slides in rotation · auto every 3.6s
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {previewSlides.map((s, i) => {
            const ac = accentFor(s);
            const isActive = i === displayIdx;
            return (
              <button key={i} onClick={() => goTo(i)} style={{
                display: "flex", alignItems: "center", gap: 7, padding: "5px 8px",
                borderRadius: 7, border: `1px solid ${isActive ? `${ac}33` : "#141414"}`,
                background: isActive ? `${ac}08` : "transparent",
                cursor: "pointer", fontFamily: "inherit", textAlign: "left", width: "100%",
              }}>
                <span style={{ fontSize: 11, flexShrink: 0 }}>{slideIcon(s)}</span>
                <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: isActive ? ac : "#444", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {slideLabel(s)}
                  </div>
                </div>
                {isActive && (
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: ac, boxShadow: `0 0 5px ${ac}`, flexShrink: 0 }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Connection note */}
      <div style={{ marginTop: 8, padding: "8px 10px", background: "#080808", border: "1px solid #111", borderRadius: 9, fontSize: 9, color: "#252525", lineHeight: 1.7 }}>
        ↳ Edits to price, EP, slots, and invites reflect here instantly and on <span style={{ color: "#3a3a3a" }}>/paywall</span> in real-time via Supabase.
      </div>
    </div>
  );
}

// ─── WaitlistManager ──────────────────────────────────────────────────────────
function WaitlistManager({ invite, onOptimisticUpdate, onClose }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState(false);
  const [promoteCount, setPromoteCount] = useState("5");
  const [err, setErr] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [vipDrawing, setVipDrawing] = useState(false);

  const meta = invite?.metadata ?? {};
  const vipSlots = meta.vip_slots ?? 0;
  const vipWinners = meta.vip_winners ?? [];

  useEffect(() => {
    loadEntries();
  }, [invite?.id]);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const waitlistEntries = meta.waitlist_entries ?? [];
      const whitelistedIds = new Set(meta.whitelisted_user_ids ?? []);
      const vipIds = new Set((meta.vip_winners ?? []).map(w => w.user_id));
      const userIds = waitlistEntries.map(e => e.user_id).filter(Boolean);

      let profiles = {};
      if (userIds.length > 0) {
        const { data: profileRows } = await supabase
          .from("profiles")
          .select("id,full_name,username,avatar_id")
          .in("id", userIds);
        (profileRows ?? []).forEach(p => { profiles[p.id] = p; });
      }

      const enriched = waitlistEntries.map((e, idx) => ({
        ...e,
        position: idx + 1,
        profile: profiles[e.user_id] ?? null,
        isWhitelisted: whitelistedIds.has(e.user_id),
        isVip: vipIds.has(e.user_id),
      }));
      setEntries(enriched);
    } catch (e) {
      setErr(e?.message ?? "Failed to load entries.");
    } finally {
      setLoading(false);
    }
  };

  // Promote top N from waitlist → whitelist (increment max_uses)
  const promoteTop = async () => {
    const n = parseInt(promoteCount, 10);
    if (!n || n < 1) return;
    setPromoting(true); setErr(""); setSuccessMsg("");
    try {
      const toPromote = entries.filter(e => !e.isWhitelisted && !e.isVip).slice(0, n);
      if (toPromote.length === 0) { setErr("No users to promote."); setPromoting(false); return; }

      const newWhitelistedIds = [
        ...(meta.whitelisted_user_ids ?? []),
        ...toPromote.map(e => e.user_id).filter(Boolean),
      ];
      const newWaitlistCount = Math.max(0, (meta.waitlist_count ?? 0) - toPromote.length);
      const newMaxUses = (invite.max_uses ?? 0) + toPromote.length;

      const newMeta = {
        ...meta,
        whitelisted_user_ids: newWhitelistedIds,
        waitlist_count: newWaitlistCount,
      };

      const { error } = await supabase
        .from("invite_codes")
        .update({ metadata: newMeta, max_uses: newMaxUses })
        .eq("id", invite.id);

      if (error) throw error;
      onOptimisticUpdate?.({ ...invite, metadata: newMeta, max_uses: newMaxUses });
      setSuccessMsg(`✓ Promoted ${toPromote.length} users to whitelist.`);
      await loadEntries();
    } catch (e) {
      setErr(e?.message ?? "Promotion failed.");
    } finally {
      setPromoting(false);
    }
  };

  // VIP lottery draw
  const drawVipLottery = async () => {
    if (!vipSlots || vipSlots < 1) return;
    setVipDrawing(true); setErr(""); setSuccessMsg("");
    try {
      const eligible = entries.filter(e => !e.isVip && e.user_id);
      if (eligible.length === 0) { setErr("No eligible users for VIP lottery."); setVipDrawing(false); return; }

      // Fisher-Yates shuffle then pick N
      const shuffled = [...eligible];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const winners = shuffled.slice(0, vipSlots);
      const winnerRecords = winners.map(w => ({
        user_id: w.user_id,
        email: w.email ?? "",
        selected_at: new Date().toISOString(),
      }));

      const newMeta = { ...meta, vip_winners: winnerRecords };
      const { error } = await supabase
        .from("invite_codes")
        .update({ metadata: newMeta })
        .eq("id", invite.id);

      if (error) throw error;
      onOptimisticUpdate?.({ ...invite, metadata: newMeta });
      setSuccessMsg(`🎉 ${winners.length} VIP winners selected!`);
      await loadEntries();
    } catch (e) {
      setErr(e?.message ?? "VIP draw failed.");
    } finally {
      setVipDrawing(false);
    }
  };

  // Export waitlist as CSV
  const exportCSV = () => {
    const rows = [["Position","User ID","Email","Status","Joined At"]];
    entries.forEach(e => rows.push([
      e.position, e.user_id ?? "", e.email ?? "",
      e.isVip ? "VIP" : e.isWhitelisted ? "Whitelisted" : "Waiting",
      e.joined_at ?? "",
    ]));
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `waitlist-${invite.code}-${Date.now()}.csv`; a.click();
  };

  const pendingCount = entries.filter(e => !e.isWhitelisted && !e.isVip).length;

  return (
    <div style={{ background: "#090909", border: "1px solid #1e1e1e", borderRadius: 14, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #1a1a1a", background: "rgba(56,189,248,.03)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>⏳</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#38bdf8" }}>Waitlist Manager</div>
            <div style={{ fontSize: 10, color: "#444" }}>{entries.length} total · {pendingCount} pending</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Btn small onClick={exportCSV} disabled={entries.length === 0}>⬇ CSV</Btn>
          <Btn small onClick={onClose}>✕</Btn>
        </div>
      </div>

      {/* Promote controls */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #111", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: 11, color: "#555", flex: 1 }}>Promote top</div>
        <input
          type="number" min="1" max={pendingCount} value={promoteCount}
          onChange={e => setPromoteCount(e.target.value)}
          style={{ width: 52, background: "#111", border: "1px solid #252525", borderRadius: 8, padding: "6px 8px", color: "#f0f0f0", fontSize: 12, textAlign: "center", fontFamily: "inherit" }}
        />
        <div style={{ fontSize: 11, color: "#555" }}>users →</div>
        <Btn accent small onClick={promoteTop} disabled={promoting || pendingCount === 0}>
          {promoting ? "Promoting…" : "Promote to Whitelist"}
        </Btn>
        {vipSlots > 0 && (
          <Btn small onClick={drawVipLottery} disabled={vipDrawing || entries.length === 0}
            style={{ background: "rgba(167,139,250,.1)", border: "1px solid rgba(167,139,250,.3)", color: "#a78bfa" }}>
            {vipDrawing ? "Drawing…" : `🎲 Draw ${vipSlots} VIP`}
          </Btn>
        )}
      </div>

      {/* Messages */}
      {err && <div style={{ padding: "8px 16px", background: "rgba(239,68,68,.06)", fontSize: 11, color: "#f87171" }}>{err}</div>}
      {successMsg && <div style={{ padding: "8px 16px", background: "rgba(163,230,53,.06)", fontSize: 11, color: "#a3e635" }}>{successMsg}</div>}

      {/* VIP winners */}
      {vipWinners.length > 0 && (
        <div style={{ padding: "10px 16px", borderBottom: "1px solid #111", background: "rgba(167,139,250,.04)" }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#a78bfa", marginBottom: 6, textTransform: "uppercase", letterSpacing: "1.5px" }}>VIP Winners ({vipWinners.length})</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {vipWinners.map((w, i) => (
              <span key={i} style={{ fontSize: 10, color: "#a78bfa", background: "rgba(167,139,250,.1)", border: "1px solid rgba(167,139,250,.2)", borderRadius: 6, padding: "3px 8px", ...mono }}>
                {w.email || w.user_id?.slice(0, 8)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Entry list */}
      <div style={{ maxHeight: 280, overflowY: "auto" }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: "#333", fontSize: 12 }}>Loading…</div>
        ) : entries.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "#2a2a2a", fontSize: 12 }}>No waitlist entries yet.</div>
        ) : entries.map((e, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "9px 16px",
            borderBottom: "1px solid #0f0f0f",
            background: e.isVip ? "rgba(167,139,250,.03)" : e.isWhitelisted ? "rgba(163,230,53,.03)" : "transparent",
          }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: "#111", border: "1px solid #222", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "#444", flexShrink: 0 }}>
              {e.position}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#d0d0d0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {e.profile?.full_name || e.email || e.user_id?.slice(0, 12) + "…"}
              </div>
              {e.email && <div style={{ fontSize: 10, color: "#333", ...mono }}>{e.email}</div>}
            </div>
            <div style={{ flexShrink: 0 }}>
              {e.isVip
                ? <Pill label="VIP" color="#a78bfa" />
                : e.isWhitelisted
                  ? <Pill label="Promoted" color="#a3e635" />
                  : <Pill label={`#${e.position}`} color="#38bdf8" />
              }
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── PublicEntryCard ───────────────────────────────────────────────────────────
// The non-deletable system card that controls the public paywall price + slides
function PublicEntryCard({ invite, onOptimisticUpdate }) {
  const [expanded, setExpanded] = useState(true);
  const [showAddSlide, setShowAddSlide] = useState(false);
  const [saveState, setSaveState] = useState("idle");

  const meta = invite?.metadata ?? {};
  const currentPrice = resolvePrice(invite);
  const slides = meta.slides ?? [];
  const epGrant = meta.ep_grant ?? 300;
  const slotsTotal = meta.slots_total ?? 0;
  const slotsClaimed = meta.slots_claimed ?? 0;
  const heroMessage = meta.hero_message ?? "";

  // Local state for all editable fields
  const [price, setPrice] = useState(String(currentPrice));
  const [ep, setEp] = useState(String(epGrant));
  const [slots, setSlots] = useState(String(slotsTotal));
  const [claimed, setClaimed] = useState(String(slotsClaimed));
  const [heroMsg, setHeroMsg] = useState(heroMessage);

  useEffect(() => {
    setPrice(String(resolvePrice(invite)));
    setEp(String(invite?.metadata?.ep_grant ?? 300));
    setSlots(String(invite?.metadata?.slots_total ?? 0));
    setClaimed(String(invite?.metadata?.slots_claimed ?? 0));
    setHeroMsg(invite?.metadata?.hero_message ?? "");
  }, [invite?.id]); // eslint-disable-line

  const save = async (patch) => {
    setSaveState("saving");
    try {
      const priceCents = Math.round(parseFloat(patch.price ?? price) * 100);
      const newMeta = {
        ...meta,
        entry_price_cents: priceCents,
        ep_grant: parseInt(patch.ep ?? ep, 10) || 300,
        slots_total: parseInt(patch.slots ?? slots, 10) || 0,
        slots_claimed: parseInt(patch.claimed ?? claimed, 10) || 0,
        hero_message: patch.heroMsg ?? heroMsg,
        slides: patch.slides ?? slides,
      };
      const { error } = await supabase
        .from("invite_codes")
        .update({ metadata: newMeta, price_override: parseFloat(patch.price ?? price) })
        .eq("id", invite.id);
      if (error) throw error;
      onOptimisticUpdate?.({ ...invite, metadata: newMeta, price_override: parseFloat(patch.price ?? price) });
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
    }
  };

  const addSlide = (slide) => {
    const newSlides = [...slides, slide];
    save({ slides: newSlides });
  };

  const removeSlide = (idx) => {
    const newSlides = slides.filter((_, i) => i !== idx);
    save({ slides: newSlides });
  };

  return (
    <div style={{ background: "#0c0c0c", border: "1.5px solid #1e1e1e", borderRadius: 16, overflow: "hidden" }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(v => !v)}
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer", userSelect: "none" }}
      >
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(163,230,53,.1)", border: "1px solid rgba(163,230,53,.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>🌐</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#e0e0e0" }}>PUBLIC ENTRY</span>
            <Pill label="System" color="#a3e635" />
            <Pill label="Non-deletable" color="#444" />
          </div>
          <div style={{ fontSize: 11, color: "#3a3a3a", marginTop: 2 }}>
            Controls paywall hero · <span style={{ color: "#a3e635", ...mono }}>${fmt(currentPrice)}</span> public price
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <SaveIndicator state={saveState} />
          <span style={{ color: "#3a3a3a", fontSize: 16 }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 14, borderTop: "1px solid #141414" }}>
          {/* Price + EP row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, paddingTop: 14 }}>
            <div>
              <FieldLabel>Public Entry Price</FieldLabel>
              <Input value={price} onChange={setPrice} onBlur={() => save({ price })} prefix="$" placeholder="4.00" />
            </div>
            <div>
              <FieldLabel>EP Grant</FieldLabel>
              <Input value={ep} onChange={setEp} onBlur={() => save({ ep })} placeholder="300" />
            </div>
            <div>
              <FieldLabel>Total Slots</FieldLabel>
              <Input value={slots} onChange={setSlots} onBlur={() => save({ slots })} placeholder="0 = unlimited" />
            </div>
            <div>
              <FieldLabel>Claimed</FieldLabel>
              <Input value={claimed} onChange={setClaimed} onBlur={() => save({ claimed })} placeholder="0" />
            </div>
          </div>

          {/* Hero message */}
          <div>
            <FieldLabel>Hero Message (shown under price)</FieldLabel>
            <Textarea
              value={heroMsg}
              onChange={setHeroMsg}
              onBlur={() => save({ heroMsg })}
              placeholder="Optional tagline shown below the price in the paywall hero…"
              rows={2}
            />
          </div>

          {/* Slides section */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <FieldLabel>Paywall Slides</FieldLabel>
              <Btn small onClick={() => setShowAddSlide(v => !v)} accent={showAddSlide}>
                {showAddSlide ? "Cancel" : "+ Add Slide"}
              </Btn>
            </div>
            {showAddSlide && <AddSlidePanel onAdd={addSlide} onClose={() => setShowAddSlide(false)} />}
            {slides.length === 0 ? (
              <div style={{ padding: "12px", background: "#0a0a0a", border: "1px dashed #1e1e1e", borderRadius: 10, textAlign: "center", fontSize: 11, color: "#2a2a2a" }}>
                No custom slides — paywall shows default public price view
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {slides.map((s, i) => (
                  <SlideChip key={i} slide={s} onRemove={() => removeSlide(i)} />
                ))}
              </div>
            )}
          </div>

          {/* Invite link */}
          <div>
            <FieldLabel>Paywall Link</FieldLabel>
            <div style={{ display: "flex", gap: 6 }}>
              <div style={{ flex: 1, background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 9, padding: "9px 12px", fontSize: 11, color: "#333", ...mono, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {window.location.origin}
              </div>
              <CopyLinkButton code={null} label="Copy" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── InviteCard ────────────────────────────────────────────────────────────────
// A custom invite (whitelist / standard / VIP / community)
function InviteCard({ invite, onOptimisticUpdate, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [showAddSlide, setShowAddSlide] = useState(false);
  const [saveState, setSaveState] = useState("idle");
  const [deleting, setDeleting] = useState(false);
  const [vipDrawing, setVipDrawing] = useState(false);

  const meta = invite?.metadata ?? {};
  const category = meta.invite_category ?? invite.type ?? "standard";
  const accent = ACC_COLORS[category] ?? "#94a3b8";
  const currentPrice = resolvePrice(invite);
  const isWhitelist = category === "whitelist" || meta.has_whitelist_access;
  const hasWaitlist = meta.waitlist_slots > 0;
  const hasVip = meta.vip_slots > 0;
  const isFull = invite.is_full;

  // Editable local state
  const [name, setName] = useState(meta.invite_name ?? "");
  const [price, setPrice] = useState(String(currentPrice));
  const [wlPrice, setWlPrice] = useState(String(meta.whitelist_price_cents != null ? meta.whitelist_price_cents / 100 : currentPrice));
  const [maxUses, setMaxUses] = useState(String(invite.max_uses ?? ""));
  const [waitlistSlots, setWaitlistSlots] = useState(String(meta.waitlist_slots ?? ""));
  const [vipSlots, setVipSlots] = useState(String(meta.vip_slots ?? ""));
  const [epGrant, setEpGrant] = useState(String(meta.ep_grant ?? 500));
  const [expiresAt, setExpiresAt] = useState(invite.expires_at ? invite.expires_at.slice(0, 10) : "");

  useEffect(() => {
    const m = invite?.metadata ?? {};
    setName(m.invite_name ?? "");
    setPrice(String(resolvePrice(invite)));
    setWlPrice(String(m.whitelist_price_cents != null ? m.whitelist_price_cents / 100 : resolvePrice(invite)));
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
      const newWlSlots = parseInt(patch.waitlistSlots ?? waitlistSlots, 10) || 0;
      const newVipSlots = parseInt(patch.vipSlots ?? vipSlots, 10) || 0;
      const newEp = parseInt(patch.epGrant ?? epGrant, 10) || 500;

      const newMeta = {
        ...meta,
        invite_name: patch.name ?? name,
        invite_category: category,
        entry_price_cents: Math.round(newPrice * 100),
        whitelist_price_cents: Math.round(newWlPrice * 100),
        waitlist_slots: newWlSlots,
        vip_slots: newVipSlots,
        ep_grant: newEp,
        has_whitelist_access: isWhitelist,
      };

      const updatePayload = {
        metadata: newMeta,
        price_override: newPrice,
        max_uses: newMaxUses,
        expires_at: patch.expiresAt ?? expiresAt ? (patch.expiresAt ?? expiresAt) || null : null,
      };

      const { error } = await supabase
        .from("invite_codes")
        .update(updatePayload)
        .eq("id", invite.id);

      if (error) throw error;
      onOptimisticUpdate?.({ ...invite, ...updatePayload, metadata: newMeta });
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
    }
  };

  const toggleStatus = async () => {
    const newStatus = invite.status === "active" ? "inactive" : "active";
    setSaveState("saving");
    try {
      const { error } = await supabase.from("invite_codes").update({ status: newStatus }).eq("id", invite.id);
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
    if (!window.confirm(`Delete invite "${meta.invite_name || invite.code}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("invite_codes").delete().eq("id", invite.id);
      if (error) throw error;
      onDelete?.(invite.id);
    } catch {
      setDeleting(false);
    }
  };

  const drawVip = async () => {
    const n = parseInt(vipSlots, 10);
    if (!n || n < 1) return;
    setVipDrawing(true);
    try {
      const waitlistEntries = meta.waitlist_entries ?? [];
      const eligible = waitlistEntries.filter(e => e.user_id);
      const shuffled = [...eligible];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const winners = shuffled.slice(0, n).map(w => ({
        user_id: w.user_id, email: w.email ?? "", selected_at: new Date().toISOString(),
      }));
      const newMeta = { ...meta, vip_winners: winners };
      const { error } = await supabase.from("invite_codes").update({ metadata: newMeta }).eq("id", invite.id);
      if (error) throw error;
      onOptimisticUpdate?.({ ...invite, metadata: newMeta });
    } catch {}
    finally { setVipDrawing(false); }
  };

  const usedPct = invite.max_uses > 0 ? Math.min(100, Math.round(((invite.uses_count ?? 0) / invite.max_uses) * 100)) : 0;

  return (
    <div style={{ background: "#0c0c0c", border: `1.5px solid ${expanded ? `${accent}33` : "#1e1e1e"}`, borderRadius: 16, overflow: "hidden", transition: "border-color .2s" }}>
      {/* Card header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", cursor: "pointer" }} onClick={() => setExpanded(v => !v)}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: `${accent}18`, border: `1px solid ${accent}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
          {category === "whitelist" ? "⭐" : category === "vip" ? "💎" : category === "community" ? "🏠" : "🎟"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#e0e0e0" }}>{meta.invite_name || "Untitled Invite"}</span>
            <Pill label={category} color={accent} />
            {invite.status !== "active" && <Pill label="inactive" color="#555" />}
            {isFull && <Pill label="full" color="#f87171" />}
            {hasWaitlist && <Pill label="waitlist" color="#38bdf8" />}
            {hasVip && <Pill label="VIP lottery" color="#a78bfa" />}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
            <span style={{ fontSize: 10, color: "#3a3a3a", ...mono }}>{invite.code}</span>
            <span style={{ fontSize: 10, color: accent, fontWeight: 700 }}>${fmt(currentPrice)}</span>
            {invite.max_uses && <span style={{ fontSize: 10, color: "#444" }}>{invite.uses_count ?? 0}/{invite.max_uses} used</span>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <SaveIndicator state={saveState} />
          <Toggle checked={invite.status === "active"} onChange={toggleStatus} size="sm" />
          <span style={{ color: "#3a3a3a", fontSize: 14 }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* Usage bar */}
      {invite.max_uses > 0 && (
        <div style={{ height: 2, background: "#111", margin: "0 14px" }}>
          <div style={{ width: `${usedPct}%`, height: "100%", background: `linear-gradient(90deg,${accent}88,${accent})`, borderRadius: 1, transition: "width .4s" }} />
        </div>
      )}

      {expanded && (
        <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: 12, borderTop: "1px solid #141414" }}>

          {/* Name */}
          <div>
            <FieldLabel>Invite Name</FieldLabel>
            <Input value={name} onChange={setName} onBlur={() => save({ name })} placeholder="e.g. Launch Wave 1" />
          </div>

          {/* Price grid */}
          <div style={{ display: "grid", gridTemplateColumns: isWhitelist ? "1fr 1fr 1fr 1fr" : "1fr 1fr 1fr", gap: 10 }}>
            <div>
              <FieldLabel>Entry Price</FieldLabel>
              <Input value={price} onChange={setPrice} onBlur={() => save({ price })} prefix="$" placeholder="4.00" />
            </div>
            {isWhitelist && (
              <div>
                <FieldLabel>Whitelist Price</FieldLabel>
                <Input value={wlPrice} onChange={setWlPrice} onBlur={() => save({ wlPrice })} prefix="$" placeholder="0 = free" />
              </div>
            )}
            <div>
              <FieldLabel>Max Uses</FieldLabel>
              <Input value={maxUses} onChange={setMaxUses} onBlur={() => save({ maxUses })} placeholder="∞ unlimited" />
            </div>
            <div>
              <FieldLabel>EP Grant</FieldLabel>
              <Input value={epGrant} onChange={setEpGrant} onBlur={() => save({ epGrant })} placeholder="500" />
            </div>
          </div>

          {/* Waitlist + VIP row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div>
              <FieldLabel>Waitlist Slots</FieldLabel>
              <Input value={waitlistSlots} onChange={setWaitlistSlots} onBlur={() => save({ waitlistSlots })} placeholder="0 = disabled" />
              <div style={{ fontSize: 9, color: "#2a2a2a", marginTop: 4 }}>Auto-activates when max uses hit</div>
            </div>
            <div>
              <FieldLabel>VIP Lottery Slots</FieldLabel>
              <Input value={vipSlots} onChange={setVipSlots} onBlur={() => save({ vipSlots })} placeholder="0 = disabled" />
              <div style={{ fontSize: 9, color: "#2a2a2a", marginTop: 4 }}>Free VIP from pool of users</div>
            </div>
            <div>
              <FieldLabel>Expires</FieldLabel>
              <Input value={expiresAt} onChange={setExpiresAt} onBlur={() => save({ expiresAt })} type="date" />
            </div>
          </div>

          {/* VIP lottery draw */}
          {hasVip && (
            <div style={{ background: "rgba(167,139,250,.06)", border: "1px solid rgba(167,139,250,.18)", borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#a78bfa" }}>🎲 VIP Lottery</div>
                  <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>
                    Select {vipSlots} lucky winner{parseInt(vipSlots, 10) !== 1 ? "s" : ""} from {invite.uses_count ?? 0} users for free VIP access
                  </div>
                </div>
                <Btn small onClick={drawVip} disabled={vipDrawing || (invite.uses_count ?? 0) === 0}
                  style={{ background: "rgba(167,139,250,.15)", border: "1px solid rgba(167,139,250,.3)", color: "#a78bfa" }}>
                  {vipDrawing ? "Drawing…" : "Draw Winners"}
                </Btn>
              </div>
              {(meta.vip_winners ?? []).length > 0 && (
                <div style={{ fontSize: 10, color: "#666" }}>
                  {meta.vip_winners.length} winners selected · Last draw: {meta.vip_winners[0]?.selected_at?.slice(0, 10) ?? "—"}
                </div>
              )}
            </div>
          )}

          {/* Waitlist management */}
          {hasWaitlist && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ fontSize: 11, color: "#555" }}>
                  Waitlist: <span style={{ color: "#38bdf8", fontWeight: 700 }}>{meta.waitlist_count ?? 0}</span> / {meta.waitlist_slots} in queue
                </div>
                <Btn small onClick={() => setShowWaitlist(v => !v)}
                  style={{ background: showWaitlist ? "rgba(56,189,248,.1)" : "transparent", border: "1px solid rgba(56,189,248,.25)", color: "#38bdf8" }}>
                  {showWaitlist ? "Hide Waitlist" : "Manage Waitlist"}
                </Btn>
              </div>
              {showWaitlist && (
                <WaitlistManager invite={invite} onOptimisticUpdate={onOptimisticUpdate} onClose={() => setShowWaitlist(false)} />
              )}
            </div>
          )}

          {/* Actions row */}
          <div style={{ display: "flex", gap: 6, paddingTop: 4, borderTop: "1px solid #111" }}>
            <CopyLinkButton code={invite.code} />
            <Btn small danger onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CreateInviteDrawer ────────────────────────────────────────────────────────
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

  const cat = CATEGORY_OPTIONS.find(c => c.id === category) ?? CATEGORY_OPTIONS[0];

  const generate = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  };

  const create = async () => {
    if (!name.trim()) { setErr("Invite name is required."); return; }
    setCreating(true); setErr("");
    try {
      const code = generate();
      const priceNum = parseFloat(price) || 4;
      const wlPriceNum = parseFloat(wlPrice) || 0;
      const newInvite = {
        code,
        type: category === "whitelist" ? "whitelist" : "custom",
        status: "active",
        max_uses: parseInt(maxUses, 10) || null,
        uses_count: 0,
        enable_waitlist: parseInt(waitlistSlots, 10) > 0,
        entry_price: priceNum,
        price_override: priceNum,
        metadata: {
          admin_created: true,
          invite_name: name.trim(),
          invite_category: category,
          entry_price_cents: Math.round(priceNum * 100),
          whitelist_price_cents: Math.round(wlPriceNum * 100),
          waitlist_slots: parseInt(waitlistSlots, 10) || 0,
          waitlist_count: 0,
          waitlist_entries: [],
          whitelisted_user_ids: [],
          vip_slots: parseInt(vipSlots, 10) || 0,
          vip_winners: [],
          ep_grant: parseInt(epGrant, 10) || 500,
          has_whitelist_access: category === "whitelist",
          slides: [],
        },
      };
      const { data, error } = await supabase.from("invite_codes").insert(newInvite).select().single();
      if (error) throw error;
      onCreate?.(data);
      onClose();
    } catch (e) {
      setErr(e?.message ?? "Failed to create invite.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", zIndex: 10001, display: "flex", alignItems: "flex-end", justifyContent: "center", backdropFilter: "blur(8px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: "100%", maxWidth: 640, background: "#0d0d0d", border: "1px solid #252525", borderRadius: "20px 20px 0 0", padding: "28px 28px 40px", animation: "xvFadeUp .25s ease" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#e0e0e0" }}>Create Invite</div>
          <button onClick={onClose} style={{ background: "transparent", border: "1px solid #252525", borderRadius: 8, color: "#555", cursor: "pointer", padding: "4px 10px", fontFamily: "inherit" }}>✕</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ gridColumn: "1/-1" }}>
            <FieldLabel>Invite Name *</FieldLabel>
            <Input value={name} onChange={setName} placeholder="e.g. Launch Wave 1, Beta Users, VIP Cohort" />
          </div>

          <div style={{ gridColumn: "1/-1" }}>
            <FieldLabel>Category</FieldLabel>
            <div style={{ display: "flex", gap: 6 }}>
              {CATEGORY_OPTIONS.map(c => (
                <button key={c.id} onClick={() => setCategory(c.id)} style={{
                  flex: 1, padding: "9px 6px", borderRadius: 9, border: "none", cursor: "pointer",
                  background: category === c.id ? `${ACC_COLORS[c.id] ?? "#94a3b8"}18` : "#111",
                  borderWidth: 1.5, borderStyle: "solid",
                  borderColor: category === c.id ? `${ACC_COLORS[c.id] ?? "#94a3b8"}55` : "#1e1e1e",
                  color: category === c.id ? (ACC_COLORS[c.id] ?? "#94a3b8") : "#555",
                  fontSize: 11, fontWeight: 700, fontFamily: "inherit",
                }}>{c.label}</button>
              ))}
            </div>
          </div>

          <div>
            <FieldLabel>Entry Price</FieldLabel>
            <Input value={price} onChange={setPrice} prefix="$" placeholder="4.00" />
          </div>
          {category === "whitelist" && (
            <div>
              <FieldLabel>Whitelist Price (0 = free)</FieldLabel>
              <Input value={wlPrice} onChange={setWlPrice} prefix="$" placeholder="0 = free" />
            </div>
          )}
          <div>
            <FieldLabel>Max Uses</FieldLabel>
            <Input value={maxUses} onChange={setMaxUses} placeholder="∞ = unlimited" />
          </div>
          <div>
            <FieldLabel>EP Grant</FieldLabel>
            <Input value={epGrant} onChange={setEpGrant} placeholder="500" />
          </div>
          <div>
            <FieldLabel>Waitlist Slots (0 = off)</FieldLabel>
            <Input value={waitlistSlots} onChange={setWaitlistSlots} placeholder="e.g. 100" />
            <div style={{ fontSize: 9, color: "#2a2a2a", marginTop: 4 }}>Auto-activates when max uses hit</div>
          </div>
          <div>
            <FieldLabel>VIP Lottery Slots (0 = off)</FieldLabel>
            <Input value={vipSlots} onChange={setVipSlots} placeholder="e.g. 5" />
            <div style={{ fontSize: 9, color: "#2a2a2a", marginTop: 4 }}>Random free VIP from user pool</div>
          </div>
        </div>

        {err && <div style={{ marginTop: 14, padding: "10px 13px", background: "rgba(239,68,68,.07)", border: "1px solid rgba(239,68,68,.22)", borderRadius: 10, fontSize: 12, color: "#f87171" }}>{err}</div>}

        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "13px", borderRadius: 12, border: "1px solid #252525", background: "transparent", color: "#555", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          <button onClick={create} disabled={creating} style={{ flex: 2, padding: "13px", borderRadius: 12, border: "none", background: creating ? "#1a1a1a" : "linear-gradient(135deg,#a3e635,#65a30d)", color: creating ? "#333" : "#061000", fontWeight: 800, fontSize: 14, cursor: creating ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
            {creating ? "Creating…" : "Create Invite"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main InviteSection ────────────────────────────────────────────────────────
export default function InviteSection() {
  const { invites, loading, error, refresh } = useInvites();
  const [showCreate, setShowCreate] = useState(false);
  const [localInvites, setLocalInvites] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (invites) setLocalInvites(invites);
  }, [invites]);

  // Optimistic update handler
  const handleOptimisticUpdate = useCallback((updated) => {
    setLocalInvites(prev => prev.map(inv => inv.id === updated.id ? updated : inv));
  }, []);

  // Delete handler
  const handleDelete = useCallback((id) => {
    setLocalInvites(prev => prev.filter(inv => inv.id !== id));
  }, []);

  // Add new invite
  const handleCreate = useCallback((newInvite) => {
    setLocalInvites(prev => [newInvite, ...prev]);
  }, []);

  // Split into public entry vs custom invites
  const publicInvite = localInvites.find(i => i.type === "admin" || i.metadata?.is_public_entry || i.code === "PUBLIC");
  const customInvites = localInvites.filter(i => i !== publicInvite);

  const filtered = searchQuery
    ? customInvites.filter(i =>
        (i.metadata?.invite_name ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (i.metadata?.invite_category ?? "").toLowerCase().includes(searchQuery.toLowerCase())
      )
    : customInvites;

  // Stats
  const activeCount = customInvites.filter(i => i.status === "active").length;
  const totalUses = customInvites.reduce((sum, i) => sum + (i.uses_count ?? 0), 0);
  const waitlistTotal = customInvites.reduce((sum, i) => sum + (i.metadata?.waitlist_count ?? 0), 0);
  const vipTotal = customInvites.reduce((sum, i) => sum + (i.metadata?.vip_winners?.length ?? 0), 0);

  return (
    <>
      <style>{`
        @keyframes xvFadeUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes xvFadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes xvGlow    { 0%,100%{box-shadow:0 0 4px rgba(163,230,53,.3)} 50%{box-shadow:0 0 10px rgba(163,230,53,.8)} }
      `}</style>

      {/* Two-column layout: left = controls, right = live preview */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24, alignItems: "start", minHeight: 0 }}>

        {/* LEFT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>

          {/* Section header + stats */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#e0e0e0", letterSpacing: "-0.5px" }}>Invite Control</div>
              <div style={{ fontSize: 11, color: "#3a3a3a", marginTop: 4 }}>Manage paywall access · All changes reflect instantly in PaywallGate</div>
            </div>
            <button onClick={() => setShowCreate(true)} style={{
              display: "flex", alignItems: "center", gap: 7, padding: "10px 16px",
              borderRadius: 11, border: "none", background: "linear-gradient(135deg,#a3e635,#65a30d)",
              color: "#061000", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
              flexShrink: 0, boxShadow: "0 4px 18px rgba(163,230,53,.25)",
            }}>
              + New Invite
            </button>
          </div>

          {/* Stats strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {[
              { label: "Active Invites", value: activeCount, color: "#a3e635" },
              { label: "Total Uses", value: totalUses, color: "#f59e0b" },
              { label: "On Waitlist", value: waitlistTotal, color: "#38bdf8" },
              { label: "VIP Winners", value: vipTotal, color: "#a78bfa" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: "#0c0c0c", border: "1px solid #1a1a1a", borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ fontSize: 22, fontWeight: 900, color, letterSpacing: "-1px" }}>{value}</div>
                <div style={{ fontSize: 10, color: "#333", fontWeight: 600, marginTop: 3 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* PUBLIC ENTRY card */}
          {publicInvite ? (
            <PublicEntryCard invite={publicInvite} onOptimisticUpdate={handleOptimisticUpdate} />
          ) : (
            <div style={{ background: "#0c0c0c", border: "1px dashed #252525", borderRadius: 14, padding: 20, textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "#2a2a2a" }}>No public entry invite found. Create one tagged as admin/public to control paywall pricing.</div>
            </div>
          )}

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, height: 1, background: "#151515" }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: "#2a2a2a", letterSpacing: "2px", textTransform: "uppercase" }}>Custom Invites</span>
            <div style={{ flex: 1, height: 1, background: "#151515" }} />
          </div>

          {/* Search */}
          {customInvites.length > 2 && (
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search invites by name, code, category…"
              style={{ width: "100%", background: "#0e0e0e", border: "1.5px solid #1e1e1e", borderRadius: 10, padding: "10px 14px", color: "#c0c0c0", fontSize: 12, outline: "none", fontFamily: "inherit" }}
              onFocus={e => e.target.style.borderColor = "rgba(163,230,53,.3)"}
              onBlur={e => e.target.style.borderColor = "#1e1e1e"}
            />
          )}

          {/* Loading/Error states */}
          {loading && !localInvites.length && (
            <div style={{ padding: 32, textAlign: "center", color: "#2a2a2a", fontSize: 12 }}>Loading invites…</div>
          )}
          {error && (
            <div style={{ padding: "12px 16px", background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.18)", borderRadius: 11, fontSize: 12, color: "#f87171" }}>
              {error} <button onClick={refresh} style={{ marginLeft: 8, color: "#a3e635", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Retry</button>
            </div>
          )}

          {/* Custom invite cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.length === 0 && !loading && (
              <div style={{ padding: 32, textAlign: "center", background: "#0a0a0a", border: "1px dashed #1e1e1e", borderRadius: 14 }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>🎟</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#3a3a3a", marginBottom: 6 }}>No custom invites yet</div>
                <div style={{ fontSize: 11, color: "#252525", marginBottom: 14 }}>Create whitelist, VIP, or community invites with custom pricing and waitlists</div>
                <button onClick={() => setShowCreate(true)} style={{ padding: "9px 18px", borderRadius: 10, border: "1px solid rgba(163,230,53,.3)", background: "rgba(163,230,53,.06)", color: "#a3e635", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                  + Create First Invite
                </button>
              </div>
            )}
            {filtered.map(invite => (
              <InviteCard
                key={invite.id}
                invite={invite}
                onOptimisticUpdate={handleOptimisticUpdate}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN — sticky live preview */}
        <div>
          <PaywallHeroPreview
            publicInvite={publicInvite}
            customInvites={customInvites}
          />
        </div>
      </div>

      {/* Create drawer */}
      {showCreate && (
        <CreateInviteDrawer
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}
    </>
  );
}