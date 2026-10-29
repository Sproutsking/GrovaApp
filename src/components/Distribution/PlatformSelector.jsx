// src/components/Distribution/PlatformSelector.jsx
// ============================================================================
// PlatformSelector — connection-aware distribution destinations
//
// DESIGN:
//   - Linked platforms are selectable; unlinked platforms remain disabled.
//   - Publishing readiness is reported separately from the user's selection.
//   - Community destinations are selectable only when their integration is active.
//   - Manual refresh preserves the user's destination choices.
// ============================================================================

import React, { useState, useEffect, useCallback } from "react";
import { Bot, Check, Link2, RefreshCw } from "lucide-react";
import { supabase } from "../../services/config/supabase";
import distributionService from "../../services/distribution/distributionService";
import socialConnectService from "../../services/distribution/socialConnectService";
import { POSTABLE_PLATFORM_KEYS } from "../../services/distribution/platformAdapterFactory";
import { PLATFORMS, PLATFORM_ICONS } from "../Account/IdentitySection";

export async function resolveCommunityQuery(query) {
  try {
    return await query;
  } catch (error) {
    return { data: null, error };
  }
}

export function filterReadyDestinations(selection = [], connectionStates = {}, communityTargets = []) {
  const readyCommunities = new Set(communityTargets.filter((target) => target.ready).map((target) => target.target));
  return selection.filter((platform) => platform.startsWith("community:")
    ? readyCommunities.has(platform)
    : connectionStates[platform]?.status === "ready" && connectionStates[platform]?.canPublish !== false);
}

// ── Scoped styles ─────────────────────────────────────────────────────────────
const CSS = `
  @keyframes psSpin { to { transform:rotate(360deg) } }
  .psWrap { display:flex; flex-direction:column; gap:12px; color:#f5f5f5; }
  .psHeader { display:flex; align-items:center; justify-content:space-between; gap:12px; }
  .psHeaderCopy { min-width:0; }
  .psEyebrow { margin:0; color:#f4f4f5; font-size:calc((13px) + 1px); font-weight:750; letter-spacing:-.01em; }
  .psDescription { margin:3px 0 0; color:#87878f; font-size:calc((11px) + 1px); line-height:1.5; }
  .psRefresh { display:grid; place-items:center; width:32px; height:32px; flex:none; border:1px solid rgba(255,255,255,.11); border-radius:9px; color:#c4f075; background:transparent; cursor:pointer; transition:background .16s ease,border-color .16s ease,color .16s ease; }
  .psRefresh:hover:not(:disabled) { border-color:rgba(190,242,100,.4); background:rgba(190,242,100,.08); }
  .psRefresh:disabled { opacity:.48; cursor:wait; }
  .psRefreshIcon,.psSpin { animation:psSpin .8s linear infinite; }
  .psGrid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
  .psCard { min-width:0; min-height:56px; padding:8px 10px; display:flex; align-items:center; gap:9px; color:inherit; font:inherit; text-align:left; border:1px solid rgba(255,255,255,.085); border-radius:10px; background:rgba(255,255,255,.018); transition:border-color .16s ease,background .16s ease; }
  .psCard.psClickable { cursor:pointer; }
  .psCard.psClickable:hover { border-color:rgba(255,255,255,.2); background:rgba(255,255,255,.035); }
  .psCard.psOn { border-color:rgba(190,242,100,.48); background:rgba(190,242,100,.075); }
  .psCard.psOn:hover { border-color:rgba(190,242,100,.68); background:rgba(190,242,100,.1); }
  .psCard:disabled { cursor:not-allowed; }
  .psCard.psLocked { border-color:rgba(255,255,255,.055); background:rgba(255,255,255,.012); opacity:.48; }
  .psCard.psReconnect:not(.psOn) { border-color:rgba(251,191,36,.2); background:rgba(251,191,36,.025); }
  .psIcon { width:34px; height:34px; display:grid; place-items:center; flex:none; border:1px solid; border-radius:9px; font-size:calc((14px) + 1px); font-weight:800; }
  .psCopy { min-width:0; flex:1; }
  .psPName { margin:0; color:#f3f4f6; font-size:calc((12px) + 1px); font-weight:720; letter-spacing:-.01em; }
  .psPSub { margin:3px 0 0; overflow:hidden; color:#8c8c94; font-size:calc((10px) + 1px); line-height:1.35; text-overflow:ellipsis; white-space:nowrap; }
  .psReconnect .psPSub { color:#d6a843; }
  .psState { width:19px; height:19px; display:grid; place-items:center; padding:0; flex:none; border:1px solid rgba(255,255,255,.15); border-radius:50%; color:#73737b; background:transparent; }
  button.psState { cursor:pointer; }
  button.psState:disabled { cursor:not-allowed; opacity:.55; }
  .psOn .psState,.psCommunityCard.psOn .psState { border-color:#bef264; color:#17220a; background:#bef264; }
  .psToggle { position:relative; width:30px; height:18px; flex:none; border:1px solid rgba(255,255,255,.16); border-radius:10px; background:rgba(255,255,255,.06); transition:background .18s ease,border-color .18s ease; }
  .psToggle::after { position:absolute; top:3px; left:3px; width:10px; height:10px; border-radius:50%; background:#8b8b94; content:""; transition:transform .18s ease,background .18s ease; }
  .psCard.psOn .psToggle { border-color:#bef264; background:#bef264; }
  .psCard.psOn .psToggle::after { transform:translateX(12px); background:#17220a; }
  .psCard:disabled .psToggle { border-color:rgba(255,255,255,.08); background:rgba(255,255,255,.025); }
  .psCard:disabled .psToggle::after { background:#62626a; }
  .psNotice { display:flex; align-items:flex-start; gap:7px; padding:8px 10px; border:1px solid rgba(255,255,255,.07); border-radius:9px; color:#a1a1aa; font-size:calc((10.5px) + 1px); line-height:1.45; }
  .psNotice svg { flex:none; margin-top:1px; color:#fbbf24; }
  .psNotice.psError { border-color:rgba(248,113,113,.24); color:#fca5a5; }
  .psNotice.psError svg { color:#f87171; }
  .psSummary { display:flex; align-items:center; justify-content:space-between; gap:10px; min-height:36px; padding:7px 9px; border-top:1px solid rgba(255,255,255,.07); }
  .psSummaryText { margin:0; flex:1; color:#96969e; font-size:calc((10.5px) + 1px); line-height:1.4; }
  .psSummaryText strong { color:#d9f99d; font-weight:700; }
  .psCopy { display:block; min-width:0; flex:1; padding:0; border:0; background:transparent; color:inherit; font:inherit; text-align:left; cursor:pointer; }
  .psCard:focus-visible,.psLinkBtn:focus-visible,.psRefresh:focus-visible,.psState:focus-visible { outline:2px solid #bef264; outline-offset:2px; }
  .psLinkBtn { display:inline-flex; align-items:center; justify-content:center; gap:5px; min-height:28px; padding:0 8px; flex:none; border:1px solid rgba(190,242,100,.23); border-radius:7px; color:#d9f99d; background:rgba(190,242,100,.045); font-family:inherit; font-size:calc((10px) + 1px); font-weight:650; text-decoration:none; white-space:nowrap; cursor:pointer; transition:background .16s ease,border-color .16s ease; }
  .psLinkBtn:hover { border-color:rgba(190,242,100,.42); background:rgba(190,242,100,.09); }
  .psSectionLabel { display:flex; align-items:center; gap:6px; margin:2px 0 -4px; color:#c4c4cc; font-size:calc((10px) + 1px); font-weight:700; }
  .psSectionLabel svg { color:#bef264; }
  .psCommunityGrid { display:grid; grid-template-columns:1fr; gap:7px; }
  .psCommunityCard { min-height:46px; padding:7px 9px; display:flex; align-items:center; gap:9px; border:1px solid rgba(255,255,255,.08); border-radius:9px; background:rgba(255,255,255,.015); }
  .psCommunityCard.psOn { border-color:rgba(190,242,100,.4); background:rgba(190,242,100,.055); }
  .psCommunityIcon { width:28px; height:28px; display:grid; place-items:center; flex:none; border-radius:8px; color:#bef264; background:rgba(190,242,100,.09); }
  .psCommunityCopy { min-width:0; flex:1; }
  .psCommunityName { margin:0; overflow:hidden; color:#ededf0; font-size:calc((11px) + 1px); font-weight:700; text-overflow:ellipsis; white-space:nowrap; }
  .psCommunitySub { margin:2px 0 0; overflow:hidden; color:#85858d; font-size:calc((9.5px) + 1px); text-overflow:ellipsis; white-space:nowrap; }
  .psCommunityStatus { flex:none; color:#bef264; font-size:calc((9px) + 1px); font-weight:750; }
  .psCommunityCard .psState { width:18px; height:18px; border-radius:6px; }
  @media(max-width:460px) { .psGrid { grid-template-columns:1fr; } .psCard { min-height:52px; } }
`;

// ── Component ─────────────────────────────────────────────────────────────────
const PlatformSelector = ({ userId, onSelection, selectedPlatforms = [] }) => {
  const [connectionStates, setConnectionStates] = useState({});
  const [communityTargets, setCommunityTargets] = useState([]);
  const [selected,    setSelected]    = useState(() => selectedPlatforms);
  const [loadError,   setLoadError]   = useState("");
  const [connectionLoadError, setConnectionLoadError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(true);
  const hasLoadedRef = React.useRef(false);
  const identitySyncUserIdRef = React.useRef(null);
  const selectedRef = React.useRef(selected);
  const externalSelectedRef = React.useRef(selectedPlatforms);
  externalSelectedRef.current = selectedPlatforms;

  useEffect(() => {
    const next = Array.isArray(selectedPlatforms) ? selectedPlatforms : [];
    const unchanged = next.length === selectedRef.current.length
      && next.every((platform, index) => platform === selectedRef.current[index]);
    if (unchanged) return;
    selectedRef.current = next;
    setSelected(next);
  }, [selectedPlatforms]);

  // ── Load connected platforms ───────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!userId) {
      setConnectionStates({});
      setCommunityTargets([]);
      setSelected([]);
      selectedRef.current = [];
      onSelection?.([]);
      setLoadError("");
      setConnectionLoadError("");
      setIsRefreshing(false);
      return;
    }
    setIsRefreshing(true);
    setLoadError("");
    setConnectionLoadError("");
    try {
      if (identitySyncUserIdRef.current !== userId) {
        identitySyncUserIdRef.current = userId;
        await socialConnectService.checkAndImportExistingIdentities(userId);
      }
      const [platformStates, ownedCommunities] = await Promise.all([
        distributionService.getPlatformConnectionStates(userId),
        resolveCommunityQuery(
          supabase.from("communities").select("id,name").eq("owner_id", userId).is("deleted_at", null),
        ),
      ]);
      let communityLoadError = ownedCommunities.error
        ? `Social platforms loaded, but community destinations could not be loaded: ${ownedCommunities.error.message}`
        : "";
      const nextConnectionStates = platformStates && typeof platformStates === "object" ? platformStates : {};
      const communities = (ownedCommunities?.data || []).filter(Boolean);
      const communityIds = Array.from(new Set(communities.map((community) => community.id)));
      let nextCommunityTargets = [];
      if (communityIds.length) {
        const { data: destinations, error: destinationError } = await resolveCommunityQuery(
          supabase
            .from("community_bot_destinations")
            .select("id,community_id,provider,display_name,enabled,integration:community_bot_integrations(status)")
            .in("community_id", communityIds),
        );
        if (destinationError) {
          communityLoadError = `Social platforms loaded, but community destinations could not be loaded: ${destinationError.message}`;
        }
        nextCommunityTargets = (destinations || []).map((destination) => {
          const integrationStatus = Array.isArray(destination.integration) ? destination.integration[0]?.status : destination.integration?.status;
          const normalizedStatus = String(integrationStatus || "").toLowerCase();
          const ready = Boolean(destination.enabled) && normalizedStatus === "active";
          return {
            ...destination,
            communityName: communities.find((community) => community.id === destination.community_id)?.name || "Community",
            target: `community:${destination.id}`,
            integrationStatus,
            ready,
          };
        });
      }
      setConnectionStates(nextConnectionStates);
      setCommunityTargets(nextCommunityTargets);
      setLoadError(communityLoadError);

      // Auto-select only on the first successful load. Manual refreshes keep
      // the user's explicit on/off choices and remove only disconnected ones.
      const readyPlatforms = Object.keys(nextConnectionStates)
        .filter((platform) => nextConnectionStates[platform]?.status === "ready" && nextConnectionStates[platform]?.canPublish !== false);
      const availableTargets = [...readyPlatforms, ...nextCommunityTargets.filter((destination) => destination.ready).map((destination) => destination.target)];
      const nextSelection = hasLoadedRef.current
        ? filterReadyDestinations(selectedRef.current, nextConnectionStates, nextCommunityTargets)
        : externalSelectedRef.current.length > 0
          ? filterReadyDestinations(externalSelectedRef.current, nextConnectionStates, nextCommunityTargets)
          : availableTargets;
      hasLoadedRef.current = true;
      selectedRef.current = nextSelection;
      setSelected(nextSelection);
      onSelection?.(nextSelection);

    } catch (err) {
      console.warn("[PlatformSelector] load error:", err?.message);
      const message = err?.message || "Could not check connected platforms.";
      setConnectionLoadError(message);
      setLoadError(message);
    } finally {
      setIsRefreshing(false);
    }
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("xeevia:connections-changed", load);
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("xeevia:connections-changed", load);
    };
  }, [load]);

  // ── Toggle a platform ──────────────────────────────────────────────────────
  const toggle = useCallback((platform) => {
    const communityTarget = communityTargets.find((destination) => destination.target === platform);
    if (!(connectionStates[platform]?.status === "ready" && connectionStates[platform]?.canPublish !== false) && !communityTarget?.ready) return;
    setSelected(prev => {
      const next = prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform];
      selectedRef.current = next;
      onSelection?.(next);
      return next;
    });
  }, [connectionStates, communityTargets, onSelection]);

  const manageConnections = () => {
    window.dispatchEvent(new Event("xeevia:open-identity"));
    if (typeof window.__xvNavigate === "function") window.__xvNavigate("account");
  };

  const linkedPlatforms = Object.keys(connectionStates)
    .filter((platform) => ["ready", "reconnect"].includes(connectionStates[platform]?.status));
  const readyPlatforms = Object.keys(connectionStates)
    .filter((platform) => connectionStates[platform]?.status === "ready" && connectionStates[platform]?.canPublish !== false);
  const readyCommunityTargets = communityTargets.filter((destination) => destination.ready);
  const noneConnected = linkedPlatforms.length === 0 && readyCommunityTargets.length === 0;

  return (
    <>
      <style>{CSS}</style>
      <div className="psWrap">

        <div className="psHeader">
          <div className="psHeaderCopy">
            <p className="psEyebrow">Distribution destinations</p>
            <p className="psDescription">Choose linked platforms to include. Turn a platform on to share this post there.</p>
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
            const connection = connectionStates[key];
            const isLinked = !isRefreshing && !connectionLoadError
              && ["ready", "reconnect"].includes(connection?.status);
            const canPublish = connection?.canPublish ?? connection?.status === "ready";
            const needsReconnect = !connectionLoadError && connection?.status === "reconnect";
            const isSel      = selected.includes(key);
            const stateClass = isLinked
              ? (isSel ? "psOn" : "psOff")
              : "psLocked";

            return (
              <button
                type="button"
                key={key}
                className={`psCard ${stateClass} ${canPublish ? "psClickable" : ""} ${needsReconnect ? "psReconnect" : ""}`}
                onClick={() => toggle(key)}
                disabled={!canPublish || !isLinked}
                aria-pressed={isLinked && isSel}
                aria-label={`${meta.name}: ${needsReconnect ? "reconnect required" : isLinked ? isSel ? "included in this post" : "linked, not included" : "not linked"}`}
                style={{ "--pcColor": meta.color, "--pcBg": meta.bg, "--pcBorder": meta.border }}
              >
                <div className="psIcon" style={{ background:meta.bg, borderColor:meta.border, color:meta.color }}>
                  {(() => {
                    const Icon = PLATFORM_ICONS[key];
                    return Icon ? <Icon size={15} /> : meta.letter;
                  })()}
                </div>
                <div className="psCopy">
                  <p className="psPName">{meta.name}</p>
                  <p className="psPSub">
                    {connectionLoadError ? "Connection status unavailable" : isLinked
                      ? isSel ? "Included in this post" : canPublish ? "Connected · tap to include" : "Reconnect to enable publishing"
                      : isRefreshing ? "Checking connection…" : "Not linked"}
                  </p>
                </div>
                <span className="psToggle" aria-hidden="true" />
              </button>
            );
          })}
        </div>

        {communityTargets.length > 0 && (
          <>
            <div className="psSectionLabel"><Bot size={12} /> Owned community destinations</div>
            <div className="psCommunityGrid">
              {communityTargets.map((destination) => {
                const isSelected = selected.includes(destination.target);
                const isReady = destination.ready;
                return (
                  <div key={destination.id} className={`psCommunityCard ${isReady ? isSelected ? "psOn" : "psOff" : "psLocked"}`}>
                    <div className="psCommunityIcon"><Bot size={14} /></div>
                    <div className="psCommunityCopy">
                      <p className="psCommunityName">{destination.communityName} · {destination.display_name}</p>
                      <p className="psCommunitySub">{destination.provider === "discord" ? "Discord channel" : destination.provider === "telegram" ? "Telegram chat" : "Bot destination"} · {isReady ? isSelected ? "Will receive this post" : "Available" : "Bot setup required"}</p>
                    </div>
                    <span className="psCommunityStatus">{isReady ? isSelected ? "ON" : "OFF" : "SETUP"}</span>
                    <button type="button" className={`psState${isSelected ? " psStateOn" : ""}`} disabled={!isReady || isRefreshing || Boolean(loadError)} onClick={() => toggle(destination.target)} aria-label={`Toggle ${destination.display_name}`} aria-pressed={isSelected}>{isSelected && <Check size={12} strokeWidth={3} />}</button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {(connectionLoadError || loadError) && (
          <div className={`psNotice ${(connectionLoadError || loadError).toLowerCase().includes("could not") ? "psError" : ""}`} role="status">
            {connectionLoadError || loadError}
          </div>
        )}

        <div className="psSummary">
          <p className="psSummaryText">
            {selected.length > 0
              ? <><strong>{selected.length} destination{selected.length !== 1 ? "s" : ""}</strong> selected for this post</>
              : isRefreshing && !hasLoadedRef.current
                ? <>Checking linked destinations…</>
              : noneConnected
                ? <>No linked destinations yet. This post stays on Xeevia.</>
                : <>No destinations selected. This post stays on Xeevia.</>
            }
          </p>
          {(!isRefreshing || hasLoadedRef.current) && (
            <button
              className="psLinkBtn"
              onClick={manageConnections}
            >
              <Link2 size={12} /> Manage accounts
            </button>
          )}
          {(loadError || connectionLoadError) && <button className="psLinkBtn" onClick={load}><RefreshCw size={11} /> Retry</button>}
        </div>

      </div>
    </>
  );
};

export default PlatformSelector;