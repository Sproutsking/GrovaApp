import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { Check, ChevronDown, Link2, Plus, RefreshCw, Wifi } from "lucide-react";
import socialUpdatesService, { SOCIAL_PROVIDERS, SOCIAL_UPDATE_PROVIDER_IDS, SOCIAL_PUBLIC_PROFILE_PROVIDER_IDS } from "../../../services/community/socialUpdatesService";
import channelService from "../../../services/community/channelService";
import { getInboundReadyPlatforms, getPlatformCapabilities } from "../../../services/community/platformCapabilities";
import CreateChannelModal from "../modals/CreateChannelModal";
import { PLATFORM_ICONS } from "../../Account/IdentitySection";

export default function SocialUpdatesDashboard({
  communityId,
  userId,
  channels = [],
  linkedSources = [],
  canManage = false,
  onCreateChannel,
  sourceConnected = false,
  onConnectXeevia,
  sourceProvider = "",
  onSourceProviderChange,
  availableProviders = [],
  onLinkSocialSource,
  sourceError = "",
}) {
  const [connections, setConnections] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [provider, setProvider] = useState("youtube");
  const [profileUrl, setProfileUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncingId, setSyncingId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [openRouteMenu, setOpenRouteMenu] = useState(null);
  const [routeMenuBounds, setRouteMenuBounds] = useState(null);
  const routeTriggerRefs = useRef(new Map());
  const routeMenuRef = useRef(null);
  const [linkingAccount, setLinkingAccount] = useState(false);

  const textChannels = useMemo(() => channels.filter((channel) => channel.type !== "voice"), [channels]);
  const inboundProviderLabels = getInboundReadyPlatforms()
    .map((providerId) => getPlatformCapabilities(providerId)?.label)
    .filter(Boolean)
    .join(", ");
  const liveProviderLabels = getInboundReadyPlatforms()
    .filter((providerId) => getPlatformCapabilities(providerId)?.canDetectLive)
    .map((providerId) => getPlatformCapabilities(providerId)?.label)
    .filter(Boolean)
    .join(", ");

  const refresh = useCallback(async () => {
    const [nextConnections, nextRoutes] = await Promise.all([
      socialUpdatesService.listConnections(communityId),
      socialUpdatesService.listRouting(communityId),
    ]);
    setConnections(nextConnections);
    setRoutes(nextRoutes);
  }, [communityId]);

  useEffect(() => {
    refresh().catch((loadError) => setError(loadError.message || "Could not load social sources."));
  }, [refresh]);

  const positionRouteMenu = useCallback((providerId) => {
    const trigger = routeTriggerRefs.current.get(providerId);
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const gutter = 12;
    const width = Math.min(Math.max(rect.width, 260), window.innerWidth - gutter * 2);
    const left = Math.max(gutter, Math.min(rect.left, window.innerWidth - width - gutter));
    const top = rect.bottom + 8;
    setRouteMenuBounds({
      top,
      left,
      width,
      maxHeight: Math.max(0, window.innerHeight - top - gutter),
    });
  }, []);

  const toggleRouteMenu = (providerId, trigger) => {
    if (openRouteMenu === providerId) {
      setOpenRouteMenu(null);
      setRouteMenuBounds(null);
      return;
    }
    routeTriggerRefs.current.set(providerId, trigger);
    const triggerRect = trigger.getBoundingClientRect();
    const minimumMenuHeight = Math.min(240, window.innerHeight - 24);
    if (window.innerHeight - triggerRect.bottom - 12 < minimumMenuHeight) {
      trigger.scrollIntoView?.({ block: "start" });
    }
    setOpenRouteMenu(providerId);
    positionRouteMenu(providerId);
  };

  useEffect(() => {
    if (!openRouteMenu) return undefined;
    const reposition = () => positionRouteMenu(openRouteMenu);
    const closeOutside = (event) => {
      const trigger = routeTriggerRefs.current.get(openRouteMenu);
      if (trigger?.contains(event.target) || routeMenuRef.current?.contains(event.target)) return;
      setOpenRouteMenu(null);
      setRouteMenuBounds(null);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setOpenRouteMenu(null);
        setRouteMenuBounds(null);
      }
    };
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    reposition();
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openRouteMenu, positionRouteMenu]);

  const inboundProviders = new Set(SOCIAL_UPDATE_PROVIDER_IDS);
  const linkedSourceKeys = new Set(linkedSources
    .filter((source) => source.auth_status === "active")
    .map((source) => `${source.provider}:${source.platform_user_id}`));
  const allConnections = connections.filter((connection) => {
    if (!inboundProviders.has(connection.provider) || !["active", "error"].includes(connection.status)) return false;
    if (connection.source_url) return true;
    if (connection.provider === "xeevia") return true;
    return linkedSourceKeys.has(`${connection.provider}:${connection.provider_account_id}`);
  });
  const knownKeys = new Set(allConnections.map((connection) => `${connection.provider}:${connection.provider_account_id}`));
  linkedSources.forEach((source) => {
    const key = `${source.provider}:${source.platform_user_id}`;
    if (!knownKeys.has(key)) {
      allConnections.push({
        id: `identity:${key}`,
        provider: source.provider,
        provider_account_id: source.platform_user_id,
        display_name: source.platform_user_id,
        status: source.auth_status,
      });
    }
  });

  const byProvider = new Map();
  allConnections.forEach((connection) => {
    if (!byProvider.has(connection.provider)) byProvider.set(connection.provider, []);
    byProvider.get(connection.provider).push(connection);
  });

  const routesByProvider = new Map();
  routes.forEach((route) => {
    const providerKey = route.connection?.provider || route.provider;
    if (!providerKey) return;
    if (!routesByProvider.has(providerKey)) routesByProvider.set(providerKey, []);
    routesByProvider.get(providerKey).push(route);
  });

  const addProfile = async (event) => {
    event.preventDefault();
    if (!canManage || !profileUrl.trim()) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await socialUpdatesService.saveProfileConnection({ communityId, userId, provider, profileUrl: profileUrl.trim() });
      setProfileUrl("");
      await refresh();
      setNotice(`${getPlatformCapabilities(provider)?.label || provider} source added. Route it to a channel to activate sync.`);
    } catch (saveError) {
      setError(saveError.message || "Could not add source.");
    } finally {
      setBusy(false);
    }
  };

  const ensureConnection = async (connection) => {
    if (!connection || !connection.provider) throw new Error("Choose a platform first.");
    if (!connection.id || !String(connection.id).startsWith("identity:")) return connection;
    return socialUpdatesService.connectLinkedSource({
      communityId,
      userId,
      provider: connection.provider,
      providerAccountId: connection.provider_account_id,
    });
  };

  const saveRoute = async (connection, channelId, enabled = false) => {
    if (!channelId || !canManage) return;
    setBusy(true);
    setError("");
    try {
      const persisted = await ensureConnection(connection);
      const capability = getPlatformCapabilities(connection.provider);
      if (!capability?.inboundReady || !capability.inboundAdapter) {
        throw new Error(`${capability?.label || connection.provider} inbound updates are not available yet.`);
      }
      await socialUpdatesService.saveRouting({
        communityId,
        channelId,
        connectionId: persisted.id,
        contentTypes: capability?.inboundReady ? ["post", "video", "clip", "live"] : [],
        includeInLiveFeed: Boolean(capability?.canDetectLive),
        enabled,
      });
      await refresh();
      setNotice(`Route saved to #${textChannels.find((channel) => channel.id === channelId)?.name || "channel"}.`);
    } catch (routeError) {
      setError(routeError.message || "Could not save this route.");
    } finally {
      setBusy(false);
    }
  };

  const setProviderRoutesEnabled = async (providerId, enabled) => {
    if (!canManage) return;
    setBusy(true);
    setError("");
    try {
      const providerRoutes = routesByProvider.get(providerId) || [];
      await Promise.all(providerRoutes.map((route) => socialUpdatesService.setRoutingEnabled(route.id, enabled)));
      await refresh();
      setNotice(enabled ? "Updates are active for this platform." : "Updates are paused. Your channel route is saved.");
    } catch (routeError) {
      setError(routeError.message || "Could not update this platform route.");
    } finally {
      setBusy(false);
    }
  };

  const sync = async (connectionId = null) => {
    setSyncingId(connectionId || "all");
    setError("");
    setNotice("");
    try {
      const result = await socialUpdatesService.requestSync(communityId, connectionId);
      await refresh();
      const failed = (result?.results || []).filter((item) => item.status === "failed");
      setNotice(
        failed.length
          ? `${failed.length} source${failed.length > 1 ? "s" : ""} could not sync.${failed[0]?.error ? ` ${failed[0].error}` : ""}`
          : "Sync completed. New activity will appear in routed channels.",
      );
    } catch (syncError) {
      setError(syncError.message || "Sync could not be started.");
    } finally {
      setSyncingId(null);
    }
  };

  const linkAccount = async () => {
    if (!onLinkSocialSource) return;
    setLinkingAccount(true);
    setError("");
    try {
      await onLinkSocialSource();
    } catch (linkError) {
      setError(linkError.message || "The account could not be linked.");
    } finally {
      setLinkingAccount(false);
    }
  };

  const connectXeevia = async () => {
    if (!onConnectXeevia) return;
    setBusy(true);
    setError("");
    try {
      await onConnectXeevia();
      await refresh();
    } catch (connectError) {
      setError(connectError.message || "Could not connect Xeevia.");
    } finally {
      setBusy(false);
    }
  };

  const togglePlatform = async (providerId) => {
    if (!canManage) return;
    const capability = getPlatformCapabilities(providerId);
    if (!capability?.inboundReady || !capability.inboundAdapter) {
      setError(`${capability?.label || providerId} inbound updates are not available yet.`);
      return;
    }
    const connection = byProvider.get(providerId)?.[0];
    if (!connection) return;
    const providerRoutes = routesByProvider.get(providerId) || [];
    if (providerRoutes.some((route) => route.enabled !== false)) {
      await setProviderRoutesEnabled(providerId, false);
      return;
    }

    if (providerRoutes.length) {
      await setProviderRoutesEnabled(providerId, true);
      return;
    }

    if (!textChannels.length) {
      if (onCreateChannel) {
        onCreateChannel();
      } else {
        setShowCreateChannel(true);
      }
      setNotice("Create a channel first, then turn the platform on.");
      return;
    }

    await saveRoute(connection, textChannels[0].id, true);
  };

  const openCreateChannel = () => {
    if (onCreateChannel) {
      onCreateChannel();
      return;
    }
    setShowCreateChannel(true);
  };

  return (
    <div className="social-updates-dashboard">
      <div className="social-dashboard-summary-row">
        <span><Check size={12} /> Ready inbound: {inboundProviderLabels}</span>
        <span><Wifi size={12} /> Live detection: {liveProviderLabels}</span>
        <button type="button" className="social-dashboard-refresh" onClick={() => refresh().catch((loadError) => setError(loadError.message))} aria-label="Refresh sources">
          <RefreshCw size={14} />
        </button>
      </div>

      {canManage && (
        <div className="social-dashboard-link-controls">
          <div>
            <strong>Connect an account</strong>
            <small>Authorize a supported platform or enable updates from your Xeevia account.</small>
          </div>
          <div className="social-dashboard-link-actions">
            <select
              aria-label="Platform to connect"
              value={sourceProvider}
              onChange={(event) => onSourceProviderChange?.(event.target.value)}
              disabled={!availableProviders.length}
            >
              {availableProviders.map((providerId) => {
                const platform = SOCIAL_PROVIDERS.find((item) => item.id === providerId);
                return <option key={providerId} value={providerId}>{platform?.label || providerId}</option>;
              })}
            </select>
            <button type="button" onClick={linkAccount} disabled={!sourceProvider || !availableProviders.includes(sourceProvider) || linkingAccount}>
              <Link2 size={14} /> {linkingAccount ? "Linking..." : "Link account"}
            </button>
            <button type="button" onClick={connectXeevia} disabled={sourceConnected || busy}>
              <Check size={14} /> {sourceConnected ? "Xeevia connected" : "Connect Xeevia"}
            </button>
          </div>
        </div>
      )}
      {sourceError && <div className="social-dashboard-error" role="alert">{sourceError}</div>}

      {canManage && (
        <form className="social-dashboard-form" onSubmit={addProfile}>
          <div className="social-dashboard-form-head">
            <strong>Add a public source link</strong>
            <small>Use a profile or channel URL. Linked accounts appear automatically below.</small>
          </div>
          <div className="social-dashboard-form-row">
            <select value={provider} onChange={(event) => setProvider(event.target.value)}>
              {SOCIAL_PROVIDERS.filter((item) => SOCIAL_PUBLIC_PROFILE_PROVIDER_IDS.includes(item.id)).map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
            <input value={profileUrl} onChange={(event) => setProfileUrl(event.target.value)} placeholder="https://youtube.com/@creator" type="url" required />
            <button type="submit" disabled={busy}>
              <Plus size={14} /> Add source
            </button>
          </div>
        </form>
      )}

      <div className="social-platform-grid">
        {SOCIAL_PROVIDERS.map((item) => {
          const connection = byProvider.get(item.id)?.[0];
          const platformRoutes = routesByProvider.get(item.id) || [];
          const configuredRoute = platformRoutes[0];
          const capability = getPlatformCapabilities(item.id);
          const available = Boolean(capability?.inboundReady && capability.inboundAdapter);
          const connected = Boolean(connection);
          const active = Boolean(available && platformRoutes.some((route) => route.enabled !== false) && connected);
          const status = !available ? "Unavailable" : !connected ? "Not linked" : connection.status === "error" ? "Sync error" : active ? "Active" : "Inactive";
          const routeChannel = configuredRoute ? textChannels.find((channel) => channel.id === configuredRoute.channel_id) : null;
          const PlatformIcon = PLATFORM_ICONS[item.id] || null;

          return (
            <article key={item.id} className={`social-platform-card ${active ? "active" : "inactive"} ${connected ? "connected" : "missing"}`}>
              <div className="social-platform-topline">
                <div className="social-platform-name-wrap">
                  <div className="social-platform-badge">
                    {PlatformIcon ? <PlatformIcon size={15} /> : item.label.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <strong>{item.label}</strong>
                    <small>{connected ? connection.display_name || connection.provider_account_id || "Connected" : "Not linked yet"}</small>
                  </div>
                </div>
                <span className={`social-platform-tag ${active ? "active" : "inactive"}`}>{status}</span>
              </div>

              <div className="social-platform-actions">
                <div className="social-platform-meta">
                  <span>{!available ? "Inbound adapter unavailable" : connected ? "Source linked" : "Source missing"}</span>
                  {active && routeChannel && <span>#{routeChannel.name}</span>}
                </div>

                <button
                  type="button"
                  className={`social-platform-toggle ${active ? "on" : "off"}`}
                  onClick={() => togglePlatform(item.id)}
                  disabled={!canManage || !available || !connected || busy}
                  aria-label={`${item.label} ${active ? "active" : "inactive"}`}
                  aria-checked={active}
                  role="switch"
                  title={!available ? `${item.label} inbound updates are not available yet` : connected ? `${active ? "Deactivate" : "Activate"} ${item.label} updates` : `Link ${item.label} before activating updates`}
                >
                  <span />
                </button>
              </div>

              <div className="social-platform-route-row">
                <div className="route-menu-wrap">
                  <button
                    type="button"
                    className={`route-menu-trigger${configuredRoute ? " selected" : ""}`}
                      ref={(element) => {
                        if (element) routeTriggerRefs.current.set(item.id, element);
                        else routeTriggerRefs.current.delete(item.id);
                      }}
                      onClick={(event) => toggleRouteMenu(item.id, event.currentTarget)}
                    disabled={!canManage || !available || !connected || busy}
                    aria-expanded={openRouteMenu === item.id}
                    aria-haspopup="listbox"
                  >
                    <span className="route-menu-trigger-copy">
                      <span className="route-menu-label">{configuredRoute ? "Sending updates to" : "Route updates to"}</span>
                      <strong>{routeChannel ? `#${routeChannel.name}` : "Choose a channel"}</strong>
                    </span>
                    <ChevronDown size={14} className={openRouteMenu === item.id ? "route-menu-chevron open" : "route-menu-chevron"} />
                  </button>
                  {openRouteMenu === item.id && routeMenuBounds && ReactDOM.createPortal(
                    <div
                      ref={routeMenuRef}
                      className="route-menu-panel"
                      role="listbox"
                      aria-label={`${item.label} update channel`}
                      style={{
                        position: "fixed",
                        top: routeMenuBounds.top,
                        left: routeMenuBounds.left,
                        width: routeMenuBounds.width,
                        maxHeight: routeMenuBounds.maxHeight,
                      }}
                    >
                      <div className="route-menu-heading">Choose destination</div>
                      {textChannels.length ? textChannels.map((channel) => (
                        <button
                          type="button"
                          role="option"
                          aria-selected={configuredRoute?.channel_id === channel.id}
                          className={`route-menu-option${configuredRoute?.channel_id === channel.id ? " selected" : ""}`}
                          key={channel.id}
                          onClick={() => {
                            setOpenRouteMenu(null);
                            setRouteMenuBounds(null);
                            saveRoute(connection || { provider: item.id }, channel.id, active);
                          }}
                        >
                          <span className="route-menu-channel-icon">#</span>
                          <span className="route-menu-option-copy"><strong>{channel.name}</strong><small>Community channel</small></span>
                          {configuredRoute?.channel_id === channel.id && <Check size={14} />}
                        </button>
                      )) : (
                        <div className="route-menu-empty">Create a channel to receive updates.</div>
                      )}
                      <button type="button" className="route-menu-create" onClick={() => { setOpenRouteMenu(null); setRouteMenuBounds(null); openCreateChannel(); }}>
                        <Plus size={14} /> Create a new channel
                      </button>
                    </div>,
                    document.body,
                  )}
                </div>

              </div>
            </article>
          );
        })}
      </div>

      {canManage && textChannels.length > 0 && (
        <button type="button" className="social-dashboard-sync-all" onClick={() => sync()} disabled={syncingId !== null}>
          <RefreshCw size={14} /> {syncingId === "all" ? "Syncing sources..." : "Sync all routed sources"}
        </button>
      )}

      {!allConnections.length && !canManage && (
        <div className="social-dashboard-empty">
          <Link2 size={18} />
          <strong>No social sources configured</strong>
          <span>Link a platform in Account → Identity to activate updates.</span>
        </div>
      )}

      {notice && <div className="social-dashboard-notice">{notice}</div>}
      {error && <div className="social-dashboard-error">{error}</div>}

      {showCreateChannel && ReactDOM.createPortal(
        <CreateChannelModal
          communityId={communityId}
          onClose={() => setShowCreateChannel(false)}
          onCreate={async (channelData) => {
            try {
              const created = await channelService.createChannel(channelData, communityId);
              if (created) {
                await refresh();
              }
              setShowCreateChannel(false);
              setNotice("Channel created. You can route this platform to it now.");
            } catch (createError) {
              setError(createError.message || "Could not create channel.");
              throw createError;
            }
          }}
        />,
        document.body,
      )}

      <style>{`
        .social-updates-dashboard {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .social-dashboard-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding-bottom: 8px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .social-dashboard-kicker {
          color: #9ae6b4;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-size: calc((9px) + 1px);
          font-weight: 800;
        }
        .social-dashboard-header h2 {
          margin: 6px 0 2px;
          color: #f2f2f2;
          font-size: calc((20px) + 1px);
          font-weight: 800;
        }
        .social-dashboard-header p {
          margin: 0;
          color: rgba(255,255,255,0.62);
          font-size: calc((11px) + 1px);
          line-height: 1.5;
        }
        .social-dashboard-refresh {
          width: 32px;
          height: 32px;
          border-radius: 9px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.02);
          color: rgba(255,255,255,0.74);
          cursor: pointer;
        }
        .social-dashboard-summary-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }
        .social-dashboard-summary-row span {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 8px;
          border-radius: 999px;
          background: rgba(134,239,172,0.06);
          border: 1px solid rgba(134,239,172,0.14);
          color: #d8fbe5;
          font-size: calc((10px) + 1px);
        }
        .social-dashboard-summary-row .social-dashboard-refresh {
          margin-left: auto;
        }
        .social-dashboard-link-controls {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 12px;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          background: rgba(255,255,255,0.02);
        }
        .social-dashboard-link-controls > div:first-child {
          display: grid;
          gap: 4px;
        }
        .social-dashboard-link-controls strong {
          color: #f2f2f2;
          font-size: calc((12px) + 1px);
        }
        .social-dashboard-link-controls small {
          color: rgba(255,255,255,0.65);
          font-size: calc((10px) + 1px);
          line-height: 1.45;
        }
        .social-dashboard-link-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          align-items: center;
        }
        .social-dashboard-link-actions select,
        .social-dashboard-link-actions button {
          min-height: 36px;
          padding: 0 10px;
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 8px;
          background: rgba(10,12,14,0.8);
          color: #f5f5f5;
          font-size: calc((10px) + 1px);
        }
        .social-dashboard-link-actions button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          border-color: rgba(154,230,180,0.3);
          background: rgba(134,239,172,0.08);
          color: #b9f7cc;
          cursor: pointer;
          font-weight: 700;
        }
        .social-dashboard-link-actions button:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }
        .social-dashboard-form {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 12px;
          border-radius: 12px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
        }
        .social-dashboard-form-head {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .social-dashboard-form-head strong {
          font-size: calc((13px) + 1px);
          color: #f2f2f2;
        }
        .social-dashboard-form-head small {
          color: rgba(255,255,255,0.65);
          font-size: calc((11px) + 1px);
          line-height: 1.5;
        }
        .social-dashboard-form-row {
          display: flex;
          gap: 8px;
          align-items: stretch;
        }
        .social-dashboard-form-row select,
        .social-dashboard-form-row input,
        .social-platform-route-row select {
          min-width: 0;
          flex: 1;
          padding: 10px 12px;
          border-radius: 9px;
          border: 1px solid rgba(255,255,255,0.09);
          background: rgba(10,12,14,0.8);
          color: #f5f5f5;
          font-size: calc((12px) + 1px);
          outline: none;
        }
        .social-dashboard-form-row button,
        .social-platform-create,
        .social-dashboard-sync-all {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          border: 1px solid rgba(154, 230, 180, 0.35);
          border-radius: 9px;
          background: rgba(134,239,172,0.08);
          color: #b9f7cc;
          cursor: pointer;
          font-weight: 700;
          font-size: calc((11px) + 1px);
          padding: 0 12px;
          min-height: 40px;
          white-space: nowrap;
        }
        .social-platform-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
          gap: 10px;
        }
        .social-platform-card {
          position: relative;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 12px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.02);
          transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
        }
        .social-platform-card.active {
          border-color: rgba(154, 230, 180, 0.28);
          background: rgba(154, 230, 180, 0.04);
        }
        .social-platform-card.inactive {
          opacity: 0.82;
        }
        .social-platform-topline {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .social-platform-name-wrap {
          display: flex;
          align-items: center;
          gap: 9px;
          min-width: 0;
        }
        .social-platform-badge {
          width: 28px;
          height: 28px;
          border-radius: 9px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          color: #f3f4f6;
          font-size: calc((12px) + 1px);
          font-weight: 800;
          flex-shrink: 0;
        }
        .social-platform-name-wrap strong {
          display: block;
          color: #f5f5f5;
          font-size: calc((13px) + 1px);
        }
        .social-platform-name-wrap small {
          display: block;
          color: rgba(255,255,255,0.6);
          font-size: calc((10px) + 1px);
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 140px;
        }
        .social-platform-tag {
          padding: 4px 7px;
          border-radius: 999px;
          font-size: calc((9px) + 1px);
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          border: 1px solid transparent;
        }
        .social-platform-tag.active {
          background: rgba(134,239,172,0.12);
          color: #8ef0b2;
          border-color: rgba(134,239,172,0.24);
        }
        .social-platform-tag.inactive {
          background: rgba(255,255,255,0.04);
          color: rgba(255,255,255,0.66);
          border-color: rgba(255,255,255,0.08);
        }
        .social-platform-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          min-height: 24px;
        }
        .social-platform-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
        }
        .social-platform-meta span {
          display: inline-flex;
          align-items: center;
          padding: 4px 6px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 6px;
          color: rgba(255,255,255,0.7);
          font-size: calc((9px) + 1px);
        }
        .social-platform-toggle {
          position: relative;
          width: 36px;
          height: 20px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.06);
          cursor: pointer;
          padding: 0;
          transition: all 0.15s ease;
          flex: 0 0 auto;
          align-self: center;
        }
        .social-platform-toggle span {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #f1f5f9;
          transition: transform 0.15s ease;
        }
        .social-platform-toggle.on {
          background: rgba(154, 230, 180, 0.22);
          border-color: rgba(154, 230, 180, 0.35);
        }
        .social-platform-toggle.on span {
          transform: translateX(16px);
          background: #9ae6b4;
        }
        .social-platform-toggle:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .social-platform-route-row {
          display: flex;
          gap: 8px;
          align-items: center;
          min-width: 0;
        }
        .route-menu-wrap {
          position: relative;
          flex: 1;
          min-width: 0;
        }
        .route-menu-trigger {
          width: 100%;
          min-height: 44px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 8px 11px;
          border-radius: 9px;
          border: 1px solid rgba(255,255,255,0.09);
          background: linear-gradient(135deg, rgba(255,255,255,0.045), rgba(255,255,255,0.018));
          color: #f5f5f5;
          text-align: left;
          cursor: pointer;
        }
        .route-menu-trigger:hover:not(:disabled),
        .route-menu-trigger[aria-expanded="true"] {
          border-color: rgba(154,230,180,0.42);
          background: rgba(154,230,180,0.08);
        }
        .route-menu-trigger:disabled {
          opacity: .52;
          cursor: not-allowed;
        }
        .route-menu-trigger-copy {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
        }
        .route-menu-label {
          color: rgba(255,255,255,0.52);
          font-size: calc((9px) + 1px);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .06em;
        }
        .route-menu-trigger strong {
          overflow: hidden;
          color: #f5f5f5;
          font-size: calc((11px) + 1px);
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .route-menu-chevron {
          flex-shrink: 0;
          color: rgba(255,255,255,0.62);
          transition: transform .16s ease;
        }
        .route-menu-chevron.open {
          transform: rotate(180deg);
          color: #9ae6b4;
        }
        .route-menu-panel {
          z-index: 10050;
          display: flex;
          flex-direction: column;
          gap: 4px;
          box-sizing: border-box;
          padding: 7px;
          border: 1px solid rgba(154,230,180,0.28);
          border-radius: 11px;
          background: #151a17;
          box-shadow: 0 18px 42px rgba(0,0,0,.48), 0 0 0 1px rgba(255,255,255,.025);
          overflow-y: auto;
          overscroll-behavior: contain;
        }
        .route-menu-heading {
          padding: 4px 6px 6px;
          color: rgba(255,255,255,0.52);
          font-size: calc((9px) + 1px);
          font-weight: 800;
          letter-spacing: .08em;
          text-transform: uppercase;
        }
        .route-menu-option,
        .route-menu-create {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 8px;
          min-height: 38px;
          padding: 7px 8px;
          border: 1px solid transparent;
          border-radius: 8px;
          background: transparent;
          color: #f5f5f5;
          text-align: left;
          cursor: pointer;
        }
        .route-menu-option:hover,
        .route-menu-option.selected {
          border-color: rgba(154,230,180,0.2);
          background: rgba(154,230,180,0.1);
        }
        .route-menu-channel-icon {
          width: 23px;
          height: 23px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          border-radius: 7px;
          background: rgba(154,230,180,0.12);
          color: #9ae6b4;
          font-size: calc((12px) + 1px);
          font-weight: 800;
        }
        .route-menu-option-copy {
          display: flex;
          flex: 1;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }
        .route-menu-option-copy strong {
          overflow: hidden;
          font-size: calc((11px) + 1px);
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .route-menu-option-copy small {
          color: rgba(255,255,255,0.48);
          font-size: calc((9px) + 1px);
        }
        .route-menu-empty {
          padding: 9px 7px;
          color: rgba(255,255,255,0.58);
          font-size: calc((10px) + 1px);
          line-height: 1.4;
        }
        .route-menu-create {
          justify-content: center;
          margin-top: 2px;
          border-color: rgba(154,230,180,0.26);
          background: rgba(154,230,180,0.08);
          color: #b9f7cc;
          font-size: calc((10px) + 1px);
          font-weight: 800;
        }
        .route-menu-create:hover {
          background: rgba(154,230,180,0.15);
        }
        .select-wrap select {
          width: 100%;
          appearance: none;
          padding: 10px 32px 10px 12px;
          border-radius: 9px;
          border: 1px solid rgba(255,255,255,0.09);
          background: rgba(10,12,14,0.8);
          color: #f5f5f5;
          font-size: calc((12px) + 1px);
        }
        .select-wrap svg {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
          color: rgba(255,255,255,0.6);
        }
        .social-dashboard-sync-all {
          width: fit-content;
          min-height: 38px;
          align-self: center;
          padding: 0 16px;
        }
        .social-dashboard-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 20px 16px;
          border: 1px dashed rgba(255,255,255,0.12);
          border-radius: 12px;
          color: rgba(255,255,255,0.6);
          text-align: center;
        }
        .social-dashboard-empty strong {
          color: #f5f5f5;
          font-size: calc((13px) + 1px);
        }
        .social-dashboard-notice,
        .social-dashboard-error {
          padding: 10px 12px;
          border-radius: 10px;
          font-size: calc((11px) + 1px);
          line-height: 1.5;
        }
        .social-dashboard-notice {
          background: rgba(34,197,94,0.08);
          border: 1px solid rgba(34,197,94,0.2);
          color: #bbf7d0;
        }
        .social-dashboard-error {
          background: rgba(248,113,113,0.08);
          border: 1px solid rgba(248,113,113,0.2);
          color: #fca5a5;
        }
        @media (max-width: 620px) {
          .social-updates-dashboard {
            gap: 11px;
          }
          .social-dashboard-summary-row {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 6px;
          }
          .social-dashboard-summary-row span {
            grid-column: 1 / -1;
            width: 100%;
            box-sizing: border-box;
            line-height: 1.35;
          }
          .social-dashboard-summary-row .social-dashboard-refresh {
            grid-column: 2;
            grid-row: 1;
            margin: 0;
          }
          .social-dashboard-form-row {
            flex-direction: column;
          }
          .social-dashboard-link-controls,
          .social-dashboard-link-actions {
            align-items: stretch;
            flex-direction: column;
          }
          .social-dashboard-link-actions select,
          .social-dashboard-link-actions button {
            width: 100%;
          }
          .social-dashboard-form-row select,
          .social-dashboard-form-row input,
          .social-dashboard-form-row button {
            width: 100%;
            box-sizing: border-box;
            min-height: 42px;
          }
          .social-platform-grid {
            grid-template-columns: minmax(0, 1fr);
            gap: 9px;
          }
          .social-platform-card {
            min-width: 0;
            padding: 12px;
          }
          .social-platform-route-row {
            flex-direction: column;
            align-items: stretch;
          }
          .route-menu-wrap,
          .social-platform-create {
            width: 100%;
            box-sizing: border-box;
          }
          .social-platform-create {
            min-height: 40px;
          }
        }
      `}</style>
    </div>
  );
}
