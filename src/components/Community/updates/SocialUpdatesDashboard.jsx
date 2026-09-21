import React, { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Link2, Plus, RefreshCw, Wifi } from "lucide-react";
import socialUpdatesService, { SOCIAL_PROVIDERS, SOCIAL_UPDATE_PROVIDER_IDS } from "../../../services/community/socialUpdatesService";
import { getPlatformCapabilities } from "../../../services/community/platformCapabilities";

export default function SocialUpdatesDashboard({ communityId, userId, channels = [], linkedSources = [], canManage = false, onCreateChannel }) {
  const [connections, setConnections] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [syncRuns, setSyncRuns] = useState([]);
  const [provider, setProvider] = useState("youtube");
  const [profileUrl, setProfileUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncingId, setSyncingId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const textChannels = useMemo(() => channels.filter((channel) => channel.type !== "voice"), [channels]);

  const refresh = async () => {
    const [nextConnections, nextRoutes, nextRuns] = await Promise.all([
      socialUpdatesService.listConnections(communityId),
      socialUpdatesService.listRouting(communityId),
      socialUpdatesService.listRecentSyncRuns(communityId),
    ]);
    setConnections(nextConnections);
    setRoutes(nextRoutes);
    setSyncRuns(nextRuns);
  };

  useEffect(() => {
    refresh().catch((loadError) => setError(loadError.message || "Could not load social sources."));
  }, [communityId]);

  const inboundProviders = new Set(SOCIAL_UPDATE_PROVIDER_IDS);
  const allConnections = connections.filter((connection) => inboundProviders.has(connection.provider));
  const knownKeys = new Set(connections.map((connection) => `${connection.provider}:${connection.provider_account_id}`));
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

  const saveRoute = async (connection, channelId) => {
    if (!channelId || !canManage) return;
    setBusy(true);
    setError("");
    try {
      const persisted = await ensureConnection(connection);
      const capability = getPlatformCapabilities(connection.provider);
      await socialUpdatesService.saveRouting({
        communityId,
        channelId,
        connectionId: persisted.id,
        contentTypes: capability?.inboundReady ? ["post", "video", "clip", "live"] : [],
        includeInLiveFeed: Boolean(capability?.canDetectLive),
      });
      await refresh();
      setNotice(`Route saved to #${textChannels.find((channel) => channel.id === channelId)?.name || "channel"}.`);
    } catch (routeError) {
      setError(routeError.message || "Could not save this route.");
    } finally {
      setBusy(false);
    }
  };

  const removeRoute = async (route) => {
    if (!canManage) return;
    setBusy(true);
    setError("");
    try {
      await socialUpdatesService.removeRouting(route.id);
      await refresh();
      setNotice("Source route removed.");
    } catch (removeError) {
      setError(removeError.message || "Could not remove route.");
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
          ? `${failed.length} source${failed.length > 1 ? "s" : ""} could not sync. See status below.`
          : "Sync completed. New activity will appear in routed channels.",
      );
    } catch (syncError) {
      setError(syncError.message || "Sync could not be started.");
    } finally {
      setSyncingId(null);
    }
  };

  const togglePlatform = async (providerId) => {
    if (!canManage) return;
    const connection = byProvider.get(providerId)?.[0];
    if (!connection) {
      setError("Link this platform in Account → Identity before activating it.");
      return;
    }

    const activeRoute = (routesByProvider.get(providerId) || []).find((route) => route.enabled !== false);

    if (activeRoute) {
      await removeRoute(activeRoute);
      return;
    }

    if (!textChannels.length) {
      if (onCreateChannel) {
        onCreateChannel();
      } else {
        setError("Create a channel before activating this platform.");
      }
      setNotice("Create a channel first, then turn the platform on.");
      return;
    }

    await saveRoute(connection, textChannels[0].id);
  };

  return (
    <div className="social-updates-dashboard">
      <div className="social-dashboard-header">
        <div>
          <div className="social-dashboard-kicker">Community tool dashboard</div>
          <h2>Social updates</h2>
          <p>Connect sources, route activity, and sync inbound updates.</p>
        </div>
        <button type="button" className="social-dashboard-refresh" onClick={() => refresh().catch((loadError) => setError(loadError.message))} aria-label="Refresh sources">
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="social-dashboard-summary-row">
        <span><Check size={12} /> Ready inbound: Xeevia, X, Facebook, Instagram, YouTube, Twitch, Reddit, GitHub</span>
        <span><Wifi size={12} /> Live detection: YouTube, Twitch, Facebook, Instagram</span>
      </div>

      {canManage && (
        <form className="social-dashboard-form" onSubmit={addProfile}>
          <div className="social-dashboard-form-head">
            <strong>Add a public source link</strong>
            <small>Use a profile or channel URL. Linked accounts appear automatically below.</small>
          </div>
          <div className="social-dashboard-form-row">
            <select value={provider} onChange={(event) => setProvider(event.target.value)}>
              {SOCIAL_PROVIDERS.filter((item) => item.id !== "xeevia").map((item) => (
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
          const activeRoute = (routesByProvider.get(item.id) || []).find((route) => route.enabled !== false);
          const active = Boolean(activeRoute);
          const connected = Boolean(connection);
          const status = active ? "Active" : "Inactive";
          const routeChannel = activeRoute ? textChannels.find((channel) => channel.id === activeRoute.channel_id) : null;

          return (
            <article key={item.id} className={`social-platform-card ${active ? "active" : "inactive"} ${connected ? "connected" : "missing"}`}>
              <div className="social-platform-topline">
                <div className="social-platform-name-wrap">
                  <div className="social-platform-badge">{item.label.slice(0, 1).toUpperCase()}</div>
                  <div>
                    <strong>{item.label}</strong>
                    <small>{connected ? connection.display_name || connection.provider_account_id || "Connected" : "Not linked yet"}</small>
                  </div>
                </div>
                <span className={`social-platform-tag ${active ? "active" : "inactive"}`}>{status}</span>
              </div>

              <div className="social-platform-actions">
                <div className="social-platform-meta">
                  <span>{connected ? "Source linked" : "Source missing"}</span>
                  {active && routeChannel && <span>#{routeChannel.name}</span>}
                </div>

                <button
                  type="button"
                  className={`social-platform-toggle ${active ? "on" : "off"}`}
                  onClick={() => togglePlatform(item.id)}
                  disabled={!canManage}
                  aria-label={`${item.label} ${active ? "active" : "inactive"}`}
                >
                  <span />
                </button>
              </div>

              <div className="social-platform-route-row">
                <div className="select-wrap">
                  <select
                    value={activeRoute?.channel_id || ""}
                    onChange={(event) => saveRoute(connection || { provider: item.id }, event.target.value)}
                    disabled={!canManage || !connected}
                  >
                    <option value="">Route to channel</option>
                    {textChannels.map((channel) => (
                      <option key={channel.id} value={channel.id}>#{channel.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={13} />
                </div>

                {!textChannels.length && canManage && (
                  <button type="button" className="social-platform-create" onClick={() => onCreateChannel ? onCreateChannel() : setError("Create a channel to route updates.")}>
                    <Plus size={13} /> Create channel
                  </button>
                )}
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
          font-size: 9px;
          font-weight: 800;
        }
        .social-dashboard-header h2 {
          margin: 6px 0 2px;
          color: #f2f2f2;
          font-size: 20px;
          font-weight: 800;
        }
        .social-dashboard-header p {
          margin: 0;
          color: rgba(255,255,255,0.62);
          font-size: 11px;
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
          font-size: 10px;
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
          font-size: 13px;
          color: #f2f2f2;
        }
        .social-dashboard-form-head small {
          color: rgba(255,255,255,0.65);
          font-size: 11px;
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
          font-size: 12px;
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
          font-size: 11px;
          padding: 0 12px;
          min-height: 40px;
          white-space: nowrap;
        }
        .social-platform-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 10px;
        }
        .social-platform-card {
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
          font-size: 12px;
          font-weight: 800;
          flex-shrink: 0;
        }
        .social-platform-name-wrap strong {
          display: block;
          color: #f5f5f5;
          font-size: 13px;
        }
        .social-platform-name-wrap small {
          display: block;
          color: rgba(255,255,255,0.6);
          font-size: 10px;
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 140px;
        }
        .social-platform-tag {
          padding: 4px 7px;
          border-radius: 999px;
          font-size: 9px;
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
          font-size: 9px;
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
        }
        .select-wrap {
          position: relative;
          flex: 1;
        }
        .select-wrap select {
          width: 100%;
          appearance: none;
          padding: 10px 32px 10px 12px;
          border-radius: 9px;
          border: 1px solid rgba(255,255,255,0.09);
          background: rgba(10,12,14,0.8);
          color: #f5f5f5;
          font-size: 12px;
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
          font-size: 13px;
        }
        .social-dashboard-notice,
        .social-dashboard-error {
          padding: 10px 12px;
          border-radius: 10px;
          font-size: 11px;
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
      `}</style>
    </div>
  );
}
