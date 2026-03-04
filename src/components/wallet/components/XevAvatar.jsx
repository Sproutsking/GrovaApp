// src/components/wallet/components/XevAvatar.jsx
// ══════════════════════════════════════════════════════════════════
//  XevAvatar — Universal profile image component for Xeevia Wallet
//
//  Resolves images from:
//    1. avatar_metadata.publicUrl  (direct CDN url stored on profile)
//    2. avatar_id → Supabase storage bucket "avatars"
//    3. avatar_url  (legacy direct url field)
//    4. Graceful fallback: stylised monogram with hashed gradient
//
//  Usage:
//    <XevAvatar profile={user} size={40} />
//    <XevAvatar avatarId="abc123" avatarMeta={{publicUrl:"…"}} name="Alice" size={40} />
//    <XevAvatar name="Bob" size={32} />   ← monogram fallback only
// ══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef } from "react";

// ── Supabase base URL — read from env or window global ───────────
const getSupabaseUrl = () => {
  try {
    if (typeof window !== "undefined") {
      if (window.__SUPABASE_URL__)                return window.__SUPABASE_URL__;
      if (window._env_?.REACT_APP_SUPABASE_URL)   return window._env_.REACT_APP_SUPABASE_URL;
      if (window._env_?.NEXT_PUBLIC_SUPABASE_URL) return window._env_.NEXT_PUBLIC_SUPABASE_URL;
    }
    if (typeof process !== "undefined" && process.env) {
      return (
        process.env.REACT_APP_SUPABASE_URL   ||
        process.env.NEXT_PUBLIC_SUPABASE_URL  ||
        process.env.SUPABASE_URL             ||
        ""
      );
    }
  } catch (_) {}
  return "";
};

const isHttpUrl = (v) =>
  typeof v === "string" && v.length > 10 &&
  (v.startsWith("http://") || v.startsWith("https://"));

// ── Build a full avatar URL from available data ──────────────────
// Priority (most → least reliable in real Supabase projects):
//   1. avatar_url          — plain https string column (MOST COMMON)
//   2. avatar_metadata     — if it IS a string URL itself
//   3. avatar_metadata.*   — object keys: publicUrl / url / signedUrl / path
//   4. avatar_id           — construct Supabase Storage URL
export function resolveAvatarUrl(avatarId, avatarMeta, avatarUrl) {
  // NOTE: profiles table has NO avatar_url column.
  // Images are stored via avatar_id (storage key) + avatar_metadata (jsonb).

  // 1. avatar_metadata as a raw string URL (unlikely but guard it)
  if (avatarMeta && typeof avatarMeta === "string" && avatarMeta.startsWith("http")) {
    return avatarMeta;
  }

  // 2. avatar_metadata as an object — try every known Supabase response shape
  if (avatarMeta && typeof avatarMeta === "object") {
    // Direct URL keys
    const urlKeys = ["publicUrl", "url", "signedUrl", "href", "src"];
    for (const k of urlKeys) {
      if (avatarMeta[k] && typeof avatarMeta[k] === "string" && avatarMeta[k].startsWith("http")) {
        return avatarMeta[k];
      }
    }
    // Supabase getPublicUrl() returns { data: { publicUrl } }
    if (avatarMeta.data && typeof avatarMeta.data === "object") {
      for (const k of urlKeys) {
        if (avatarMeta.data[k] && typeof avatarMeta.data[k] === "string" && avatarMeta.data[k].startsWith("http")) {
          return avatarMeta.data[k];
        }
      }
    }
    // Supabase upload response contains path / fullPath
    const rawPath = avatarMeta.fullPath || avatarMeta.path || avatarMeta.Key;
    if (rawPath && typeof rawPath === "string") {
      const base = getSupabaseUrl();
      if (base) {
        const clean = rawPath.replace(/^avatars\//, "");
        return `${base}/storage/v1/object/public/avatars/${clean}`;
      }
    }
  }

  // 4. avatar_id — construct Supabase Storage public URL
  if (avatarId && typeof avatarId === "string" && avatarId.trim()) {
    if (avatarId.startsWith("http")) return avatarId;
    const base = getSupabaseUrl();
    if (base) return `${base}/storage/v1/object/public/avatars/${avatarId.trim()}`;
  }

  return null;
}

// ── Gradient palette — deterministic from name hash ──────────────
const GRADIENTS = [
  ["#a3e635", "#65a30d"],   // lime
  ["#22d3ee", "#0891b2"],   // cyan
  ["#f59e0b", "#b45309"],   // amber
  ["#a855f7", "#7c3aed"],   // purple
  ["#ec4899", "#be185d"],   // pink
  ["#38bdf8", "#0284c7"],   // sky
  ["#fb923c", "#ea580c"],   // orange
  ["#34d399", "#059669"],   // emerald
];

function nameToGradient(name) {
  if (!name) return GRADIENTS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return GRADIENTS[hash % GRADIENTS.length];
}

// ── XevAvatar ─────────────────────────────────────────────────────
const XevAvatar = ({
  // Full profile object shorthand
  profile,

  // Or individual props
  avatarId,
  avatarMeta,   // avatar_metadata object
  avatarUrl,    // legacy direct url
  name,

  // Display
  size = 40,
  style = {},
  className = "",
  onClick,
  showRing = false,      // lime ring for "selected" state
  ringColor,             // override ring color
  badge,                 // optional JSX badge overlaid bottom-right
}) => {
  // Merge — explicit props take priority over profile fields
  const _avatarId   = avatarId   != null ? avatarId   : (profile?.avatar_id   ?? profile?.avatarId   ?? null);
  const _avatarMeta = avatarMeta != null ? avatarMeta : (profile?.avatar_metadata ?? profile?.avatarMeta ?? null);
  // avatar_url does not exist in profiles table — kept for pre-resolved avatar strings passed directly
  const _avatarUrl  = avatarUrl  != null ? avatarUrl  : (profile?.avatar ?? profile?.avatarUrl ?? null);
  // Full name fallback — never "?"
  const _name = (
    profile?.full_name || profile?.fullName || profile?.display_name ||
    profile?.username  || name              || "User"
  );

  // Stringify meta so effect detects deep-object changes without infinite loops
  const metaKey = (() => {
    if (!_avatarMeta) return "";
    if (typeof _avatarMeta === "string") return _avatarMeta;
    try { return JSON.stringify(_avatarMeta); } catch (_) { return ""; }
  })();

  const [imgSrc, setImgSrc]       = useState(() => resolveAvatarUrl(_avatarId, _avatarMeta, _avatarUrl));
  const [imgFailed, setImgFailed] = useState(false);
  const [loaded, setLoaded]       = useState(false);
  const mounted                   = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Re-resolve whenever any avatar input changes (no stale-closure on imgSrc)
  useEffect(() => {
    if (!mounted.current) return;
    const next = resolveAvatarUrl(_avatarId, _avatarMeta, _avatarUrl);
    setImgSrc(next);
    setImgFailed(false);
    setLoaded(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_avatarId, _avatarUrl, metaKey]);

  const initial = (_name || "U").trim().charAt(0).toUpperCase();
  const [gradA, gradB] = nameToGradient(_name || "User");
  const fontSize = Math.max(10, Math.round(size * 0.38));
  const showImage = imgSrc && !imgFailed;

  const ringStyle = showRing
    ? { boxShadow: `0 0 0 2px ${ringColor || "#a3e635"}, 0 0 0 4px rgba(163,230,53,0.2)` }
    : {};

  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        position: "relative",
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        cursor: onClick ? "pointer" : "default",
        ...style,
      }}
    >
      {/* ── Image layer ── */}
      {showImage && (
        <img
          src={imgSrc}
          alt={_name}
          onLoad={() => { if (mounted.current) setLoaded(true); }}
          onError={() => { if (mounted.current) { setImgFailed(true); setLoaded(false); } }}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            objectFit: "cover",
            objectPosition: "center top",
            opacity: loaded ? 1 : 0,
            transition: "opacity 0.25s ease",
            ...ringStyle,
          }}
        />
      )}

      {/* ── Monogram fallback (always rendered, hidden behind image) ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${gradA} 0%, ${gradB} 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize,
          fontWeight: 800,
          color: "#000",
          letterSpacing: "-0.02em",
          userSelect: "none",
          opacity: showImage && loaded ? 0 : 1,
          transition: "opacity 0.25s ease",
          ...ringStyle,
        }}
      >
        {initial}
      </div>

      {/* ── Optional badge slot ── */}
      {badge && (
        <div style={{
          position: "absolute",
          bottom: -1,
          right: -1,
          zIndex: 2,
        }}>
          {badge}
        </div>
      )}
    </div>
  );
};

export default XevAvatar;