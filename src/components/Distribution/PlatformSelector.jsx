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
//   - Only postable platforms with a valid connection and token are shown as available
//   - No Settings panel complexity — clean and direct
// ============================================================================

import React, { useState, useEffect, useCallback } from "react";
import { Link2, RefreshCw } from "lucide-react";
import distributionService from "../../services/distribution/distributionService";
import { POSTABLE_PLATFORM_KEYS } from "../../services/distribution/platformAdapterFactory";
import { PLATFORMS } from "../Account/IdentitySection";

// ── Scoped styles ─────────────────────────────────────────────────────────────
const CSS = `
  @keyframes psIn   { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  @keyframes psSpin { to{transform:rotate(360deg)} }

  .psWrap {
    display:flex; flex-direction:column; gap:10px;
  }

  .psHeader {
    display:flex; align-items:center; justify-content:space-between; gap:12px;
    padding:2px 1px 0;
  }
  .psHeaderCopy { min-width:0; }
  .psEyebrow { margin:0; color:#e5e5e5; font-size:12.5px; font-weight:800; letter-spacing:.01em; }
  .psDescription { margin:3px 0 0; color:#777; font-size:10.5px; line-height:1.45; }
  .psRefresh {
    display:inline-flex; align-items:center; justify-content:center; flex-shrink:0;
    width:30px; height:30px; border:1px solid rgba(132,204,22,.24); border-radius:9px;
    color:#84cc16; background:rgba(132,204,22,.07); cursor:pointer;
    transition:background .18s, border-color .18s, transform .18s;
  }
  .psRefresh:hover { background:rgba(132,204,22,.14); border-color:rgba(132,204,22,.48); transform:translateY(-1px); }
  .psRefresh:disabled { opacity:.55; cursor:wait; transform:none; }
  .psRefreshIcon { animation:psSpin .8s linear infinite; }

  /* ── Platform grid ── */
  .psGrid {
    display:grid; grid-template-columns:repeat(2,1fr); gap:8px;
  }
  @media(max-width:400px) { .psGrid { grid-template-columns:1fr; } }

  /* ── Platform toggle card ── */
  .psCard {
    position:relative;
    border:1px solid rgba(255,255,255,.07);
    border-radius:12px; padding:10px 12px;
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

  .psSpin { animation:psSpin .8s linear infinite; }
`;

// ── Component ─────────────────────────────────────────────────────────────────
const PlatformSelector = ({ userId, onSelection, initialSelection = [] }) => {
  const [connected,   setConnected]   = useState([]);   // array of provider strings
  const [selected,    setSelected]    = useState(() => initialSelection);
  const [loadError,   setLoadError]   = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasLoadedRef = React.useRef(false);
  const selectedRef = React.useRef(selected);

  // ── Load connected platforms ───────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!userId) return;
    setIsRefreshing(true);
    setLoadError("");
    try {
      // Only adapter-supported platforms with a valid token are returned.
      const connectedList = await Promise.race([
        distributionService.getConnectedPlatforms(userId),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Connection refresh timed out")), 8000)),
      ]);
      const nextConnected = Array.isArray(connectedList) ? connectedList : [];
      setConnected(nextConnected);

      // Auto-select only on the first successful load. Manual refreshes keep
      // the user's explicit on/off choices and remove only disconnected ones.
      const nextSelection = hasLoadedRef.current
        ? selectedRef.current.filter((platform) => nextConnected.includes(platform))
        : initialSelection.length > 0
          ? initialSelection.filter((platform) => nextConnected.includes(platform))
          : nextConnected;
      hasLoadedRef.current = true;
      selectedRef.current = nextSelection;
      setSelected(nextSelection);
      onSelection?.(nextSelection);

    } catch (err) {
      console.warn("[PlatformSelector] load error:", err?.message);
      setLoadError(err?.message || "Could not check connected platforms.");
    } finally {
      setIsRefreshing(false);
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
      selectedRef.current = next;
      onSelection?.(next);
      return next;
    });
  }, [connected, onSelection]);

  const noneConnected = connected.length === 0;

  return (
    <>
      <style>{CSS}</style>
      <div className="psWrap">

        <div className="psHeader">
          <div className="psHeaderCopy">
            <p className="psEyebrow">Distribution destinations</p>
            <p className="psDescription">Choose the linked platforms that should receive this post.</p>
          </div>
          <button className="psRefresh" type="button" onClick={load} disabled={isRefreshing} aria-label="Refresh linked platforms" title="Refresh linked platforms">
            <RefreshCw size={14} className={isRefreshing ? "psRefreshIcon" : ""} />
          </button>
        </div>

        {/* ── Platform cards ── */}
        <div className="psGrid">
          {POSTABLE_PLATFORM_KEYS.map(key => {
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
            {loadError
              ? <>{loadError}</>
              : selected.length > 0
              ? <><strong>{selected.length} destination{selected.length !== 1 ? "s" : ""}</strong> selected for this post</>
              : noneConnected
                ? <>No linked destinations yet. This post stays on Xeevia.</>
                : <>No destinations selected. This post stays on Xeevia.</>
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
          {loadError && <button className="psLinkBtn" onClick={load}>Retry</button>}
        </div>

      </div>
    </>
  );
};

export default PlatformSelector;