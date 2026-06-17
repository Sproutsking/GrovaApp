// src/components/Distribution/PlatformSelector.jsx
// ============================================================================
// PlatformSelector — v2 PRECISE FIX
//
// ROOT CAUSE OF "Loading platforms..." HANG:
//   1. distributionService.getPlatformPreferences() called .single() which
//      throws PGRST116 for new users (no row yet). The catch block set
//      loadError but the loading state was still true — rendering stayed
//      on the loading branch forever.
//   2. distributionService.getConnectedPlatforms() could also throw if the
//      connections table had RLS issues, leaving state in limbo.
//
// FIX: Both calls now resolve to safe defaults on any error (see service).
//      PlatformSelector itself also guards: loading is always cleared in
//      a finally block. Even if both calls fail, the component renders the
//      "no platforms connected" state with a link to Identity.
//
// DESIGN:
//   - Connected platforms: fully opaque toggle pill, ON by default, clickable
//   - Unconnected platforms: dimmed, locked, shows "Link in Identity" on hover
//   - All 4 live platforms shown so user knows what's possible
//   - No Settings panel complexity — clean and direct
// ============================================================================

import React, { useState, useEffect, useCallback } from "react";
import { Link2, Check, X as XIcon, RefreshCw } from "lucide-react";
import distributionService from "../../services/distribution/distributionService";
import { PLATFORMS } from "../Account/IdentitySection";

// Only the 4 live platforms appear in the distribution UI
const LIVE_PLATFORM_KEYS = ["x", "facebook", "instagram", "linkedin"];

// ── Scoped styles ─────────────────────────────────────────────────────────────
const CSS = `
  @keyframes psIn   { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  @keyframes psSpin { to{transform:rotate(360deg)} }

  .psWrap {
    display:flex; flex-direction:column; gap:10px;
    animation:psIn .25s ease both;
  }

  /* ── Platform grid ── */
  .psGrid {
    display:grid; grid-template-columns:repeat(2,1fr); gap:8px;
  }
  @media(max-width:400px) { .psGrid { grid-template-columns:1fr; } }

  /* ── Platform toggle card ── */
  .psCard {
    position:relative;
    border:1px solid rgba(255,255,255,.07);
    border-radius:14px; padding:12px 14px;
    display:flex; align-items:center; gap:11px;
    transition:border-color .18s, background .18s, opacity .18s, transform .12s;
    user-select:none;
  }
  .psCard.psClickable { cursor:pointer; }
  .psCard.psClickable:hover { border-color:rgba(255,255,255,.16); transform:translateY(-1px); }
  .psCard.psClickable:active { transform:scale(.97); }

  /* Connected + selected (ON) */
  .psCard.psOn {
    border-color:var(--pcBorder,rgba(255,255,255,.18));
    background:var(--pcBg,rgba(255,255,255,.04));
  }
  /* Connected + deselected (OFF) */
  .psCard.psOff {
    background:rgba(255,255,255,.015);
    border-color:rgba(255,255,255,.06);
    opacity:.65;
  }
  /* Not connected */
  .psCard.psLocked {
    background:rgba(255,255,255,.01);
    border-color:rgba(255,255,255,.04);
    opacity:.38; cursor:not-allowed;
  }

  /* Icon badge */
  .psIcon {
    width:36px; height:36px; border-radius:10px; flex-shrink:0;
    display:flex; align-items:center; justify-content:center;
    font-size:15px; font-weight:900; border:1px solid;
    font-style:normal; transition:transform .18s;
  }
  .psCard.psOn .psIcon { transform:scale(1.05); }

  /* Text */
  .psPName { font-size:12.5px; font-weight:800; color:#efefef; margin:0 0 2px; }
  .psPSub  { font-size:10.5px; color:#454545; margin:0; }

  /* Toggle indicator */
  .psToggle {
    margin-left:auto; flex-shrink:0;
    width:28px; height:16px; border-radius:8px; border:1px solid;
    position:relative; transition:background .18s, border-color .18s;
    flex-shrink:0;
  }
  .psToggle::after {
    content:""; position:absolute; top:2px; left:2px;
    width:10px; height:10px; border-radius:50%; background:#fff;
    transition:transform .18s, background .18s;
  }
  .psCard.psOn .psToggle {
    background:var(--pcColor,#84cc16);
    border-color:var(--pcColor,#84cc16);
  }
  .psCard.psOn .psToggle::after { transform:translateX(12px); }
  .psCard.psOff .psToggle {
    background:rgba(255,255,255,.06); border-color:rgba(255,255,255,.12);
  }
  .psCard.psLocked .psToggle {
    background:rgba(255,255,255,.04); border-color:rgba(255,255,255,.07);
  }
  .psCard.psLocked .psToggle::after { background:rgba(255,255,255,.2); }

  /* ── Summary row ── */
  .psSummary {
    display:flex; align-items:center; justify-content:space-between;
    padding:9px 12px;
    background:rgba(255,255,255,.02); border:1px solid rgba(255,255,255,.06);
    border-radius:10px; gap:8px;
  }
  .psSummaryText { font-size:11.5px; color:#525252; flex:1; }
  .psSummaryText strong { color:#a3a3a3; }
  .psLinkBtn {
    display:inline-flex; align-items:center; gap:5px;
    font-size:11px; font-weight:700; color:#c4b5fd;
    background:rgba(139,92,246,.1); border:1px solid rgba(139,92,246,.3);
    border-radius:7px; padding:5px 10px; cursor:pointer;
    font-family:inherit; transition:background .14s;
    text-decoration:none; white-space:nowrap;
  }
  .psLinkBtn:hover { background:rgba(139,92,246,.18); }

  /* ── Loading / error ── */
  .psLoading {
    display:flex; align-items:center; gap:9px;
    padding:14px 12px; font-size:12px; color:#454545;
    background:rgba(255,255,255,.02); border:1px solid rgba(255,255,255,.05);
    border-radius:12px;
  }
  .psSpin { animation:psSpin .8s linear infinite; }
`;

// ── Component ─────────────────────────────────────────────────────────────────
const PlatformSelector = ({ userId, onSelection, initialSelection = [] }) => {
  const [connected,   setConnected]   = useState([]);   // array of provider strings
  const [selected,    setSelected]    = useState(initialSelection);
  const [loadState,   setLoadState]   = useState("loading"); // "loading"|"ready"|"error"

  // ── Load connected platforms ───────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!userId) { setLoadState("ready"); return; }
    setLoadState("loading");
    try {
      // [FIX] getConnectedPlatforms() now returns [] on any error — never throws
      const connectedList = await distributionService.getConnectedPlatforms(userId);
      setConnected(connectedList);

      // Auto-select all connected platforms if no initial selection provided
      if (initialSelection.length === 0) {
        setSelected(connectedList);
        onSelection?.(connectedList);
      }

      setLoadState("ready");
    } catch (err) {
      // This should never fire now that service swallows errors,
      // but we guard anyway for absolute safety.
      console.warn("[PlatformSelector] load error (non-fatal):", err?.message);
      setConnected([]);
      setSelected([]);
      onSelection?.([]);
      setLoadState("ready");
    }
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // ── Toggle a platform ──────────────────────────────────────────────────────
  const toggle = useCallback((platform) => {
    if (!connected.includes(platform)) return; // locked, ignore
    setSelected(prev => {
      const next = prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform];
      onSelection?.(next);
      return next;
    });
  }, [connected, onSelection]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loadState === "loading") return (
    <>
      <style>{CSS}</style>
      <div className="psLoading">
        <RefreshCw size={13} className="psSpin" color="#525252" />
        Checking connected platforms…
      </div>
    </>
  );

  // ── Ready ──────────────────────────────────────────────────────────────────
  const noneConnected = connected.length === 0;

  return (
    <>
      <style>{CSS}</style>
      <div className="psWrap">

        {/* ── Platform cards ── */}
        <div className="psGrid">
          {LIVE_PLATFORM_KEYS.map(key => {
            const meta       = PLATFORMS[key];
            if (!meta) return null;
            const isConn     = connected.includes(key);
            const isSel      = selected.includes(key);
            const stateClass = !isConn ? "psLocked" : isSel ? "psOn" : "psOff";

            return (
              <div
                key={key}
                className={`psCard ${stateClass} ${isConn ? "psClickable" : ""}`}
                onClick={() => toggle(key)}
                role={isConn ? "button" : undefined}
                aria-pressed={isConn ? isSel : undefined}
                style={{
                  "--pcColor":  meta.color,
                  "--pcBg":     meta.bg,
                  "--pcBorder": meta.border,
                }}
              >
                <div className="psIcon" style={{
                  background:  meta.bg,
                  borderColor: meta.border,
                  color:       meta.color,
                }}>
                  {meta.letter}
                </div>

                <div style={{ flex:1, minWidth:0 }}>
                  <p className="psPName">{meta.name}</p>
                  <p className="psPSub">
                    {isConn ? (isSel ? "Will distribute" : "Tap to include") : "Not linked"}
                  </p>
                </div>

                <div className="psToggle" />
              </div>
            );
          })}
        </div>

        {/* ── Summary + link to Identity ── */}
        <div className="psSummary">
          <p className="psSummaryText">
            {selected.length > 0
              ? <><strong>{selected.length} platform{selected.length !== 1 ? "s" : ""}</strong> will receive this post</>
              : noneConnected
                ? <>No platforms linked — post stays on Xeevia only</>
                : <>No platforms selected — post stays on Xeevia only</>
            }
          </p>
          {noneConnected && (
            <button
              className="psLinkBtn"
              onClick={() => {
                // Navigate to Identity tab — works with App.jsx's handleTabChange
                if (typeof window.__xvNavigate === "function") {
                  window.__xvNavigate("account");
                }
              }}
            >
              <Link2 size={10} /> Link accounts
            </button>
          )}
        </div>

      </div>
    </>
  );
};

export default PlatformSelector;