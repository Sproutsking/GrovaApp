import React, { useEffect, useMemo, useState } from "react";
import { Check, Link2, Plus, RefreshCw, Trash2, Wifi } from "lucide-react";
import socialUpdatesService, { SOCIAL_PROVIDERS, SOCIAL_UPDATE_PROVIDER_IDS } from "../../../services/community/socialUpdatesService";
import { getPlatformCapabilities } from "../../../services/community/platformCapabilities";

export default function SocialUpdatesDashboard({ communityId, userId, channels = [], linkedSources = [], canManage = false }) {
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

  useEffect(() => { refresh().catch((loadError) => setError(loadError.message || "Could not load social sources.")); }, [communityId]);

  const inboundProviders = new Set(SOCIAL_UPDATE_PROVIDER_IDS);
  const allConnections = connections.filter((connection) => inboundProviders.has(connection.provider));
  const knownKeys = new Set(connections.map((connection) => `${connection.provider}:${connection.provider_account_id}`));
  linkedSources.forEach((source) => {
    const key = `${source.provider}:${source.platform_user_id}`;
    if (!knownKeys.has(key)) allConnections.push({ id: `identity:${key}`, provider: source.provider, provider_account_id: source.platform_user_id, display_name: source.platform_user_id, status: source.auth_status });
  });

  const addProfile = async (event) => {
    event.preventDefault();
    if (!canManage || !profileUrl.trim()) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await socialUpdatesService.saveProfileConnection({ communityId, userId, provider, profileUrl: profileUrl.trim() });
      setProfileUrl("");
      await refresh();
      setNotice(`${getPlatformCapabilities(provider)?.label || provider} source added. Route it to a channel to activate sync.`);
    } catch (saveError) { setError(saveError.message || "Could not add source."); }
    finally { setBusy(false); }
  };

  const ensureConnection = async (connection) => {
    if (!connection.id.startsWith("identity:")) return connection;
    return socialUpdatesService.connectLinkedSource({ communityId, userId, provider: connection.provider, providerAccountId: connection.provider_account_id });
  };

  const saveRoute = async (connection, event) => {
    const channelId = event.target.value;
    if (!channelId || !canManage) return;
    setBusy(true); setError("");
    try {
      const persisted = await ensureConnection(connection);
      const capability = getPlatformCapabilities(connection.provider);
      await socialUpdatesService.saveRouting({ communityId, channelId, connectionId: persisted.id, contentTypes: capability?.inboundReady ? ["post", "video", "clip", "live"] : [], includeInLiveFeed: Boolean(capability?.canDetectLive) });
      await refresh();
      setNotice(`Route saved to #${textChannels.find((channel) => channel.id === channelId)?.name || "channel"}.`);
    } catch (routeError) { setError(routeError.message || "Could not save this route."); }
    finally { setBusy(false); }
  };

  const removeRoute = async (route) => {
    if (!canManage) return;
    setBusy(true); setError("");
    try { await socialUpdatesService.removeRouting(route.id); await refresh(); setNotice("Source route removed."); }
    catch (removeError) { setError(removeError.message || "Could not remove route."); }
    finally { setBusy(false); }
  };

  const sync = async (connectionId = null) => {
    setSyncingId(connectionId || "all"); setError(""); setNotice("");
    try {
      const result = await socialUpdatesService.requestSync(communityId, connectionId);
      await refresh();
      const failed = (result?.results || []).filter((item) => item.status === "failed");
      setNotice(failed.length ? `${failed.length} source${failed.length > 1 ? "s" : ""} could not sync. See status below.` : "Sync completed. New activity will appear in routed channels.");
    } catch (syncError) { setError(syncError.message || "Sync could not be started."); }
    finally { setSyncingId(null); }
  };

  return (
    <div className="social-dashboard-body">
      <div className="social-dashboard-summary"><div><strong>Sources and routing</strong><p>Connect a platform identity or public profile, then choose the channel that should receive its activity.</p></div><button type="button" className="social-dashboard-icon" onClick={() => refresh().catch((loadError) => setError(loadError.message))} aria-label="Refresh sources"><RefreshCw size={15} /></button></div>
      <div className="social-dashboard-capabilities"><span><Check size={13} /> Working inbound: YouTube, Twitch, Xeevia</span><span><Wifi size={13} /> Live detection: Twitch</span></div>
      {canManage && <form className="social-dashboard-add" onSubmit={addProfile}><strong>Add a public source link</strong><small>Use a profile or channel URL. OAuth-linked sources appear automatically below.</small><div className="social-dashboard-form-row"><select value={provider} onChange={(event) => setProvider(event.target.value)}>{SOCIAL_PROVIDERS.filter((item) => item.id !== "xeevia").map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><input value={profileUrl} onChange={(event) => setProfileUrl(event.target.value)} placeholder="https://youtube.com/@creator" type="url" required /><button type="submit" disabled={busy}><Plus size={14} /> Add source</button></div></form>}
      {!allConnections.length ? <div className="social-dashboard-empty"><Link2 size={18} /><strong>No social sources configured</strong><span>Add a public source link above or link an account in Account &gt; Identity.</span></div> : <div className="social-dashboard-sources">{allConnections.map((connection) => { const capability = getPlatformCapabilities(connection.provider); const sourceRoutes = routes.filter((route) => route.connection_id === connection.id || (route.connection?.provider === connection.provider && route.connection?.provider_account_id === connection.provider_account_id)); const latestRun = syncRuns.find((run) => run.connection_id === connection.id); const canSync = capability?.inboundReady && sourceRoutes.length > 0 && !connection.id.startsWith("identity:"); return <article className="social-dashboard-source" key={`${connection.provider}:${connection.provider_account_id}`}><div className="social-dashboard-source-head"><div><strong>{capability?.label || connection.provider}</strong><small>{connection.display_name || connection.provider_account_id}</small></div><span className={`social-status ${connection.status === "active" ? "active" : "error"}`}>{connection.status || "connected"}</span></div><div className="social-dashboard-source-meta"><span>{capability?.inboundReady ? "Inbound adapter available" : "Setup saved, inbound adapter not available yet"}</span>{capability?.canDetectLive && <span>Live detection</span>}</div>{textChannels.length > 0 && canManage && <div className="social-dashboard-route-row"><select defaultValue="" onChange={(event) => saveRoute(connection, event)} disabled={busy}><option value="">Route to a channel...</option>{textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}</select>{canSync && <button type="button" onClick={() => sync(connection.id)} disabled={syncingId !== null}><RefreshCw size={13} /> Sync source</button>}</div>}{sourceRoutes.map((route) => <div className="social-dashboard-route" key={route.id}><span>#{textChannels.find((channel) => channel.id === route.channel_id)?.name || "channel"}<small>{(route.content_types || []).join(", ") || "No activity types"}</small></span><button type="button" onClick={() => removeRoute(route)} disabled={busy} aria-label="Remove route"><Trash2 size={13} /></button></div>)}{latestRun && <div className={`social-dashboard-run ${latestRun.status}`}><span>{latestRun.status === "succeeded" ? "Last sync completed" : "Last sync needs attention"}</span><small>{latestRun.error_message || `${latestRun.items_written || 0} item${latestRun.items_written === 1 ? "" : "s"} written`}</small></div>}</article>; })}</div>}
      {canManage && <button type="button" className="social-dashboard-sync-all" onClick={() => sync()} disabled={syncingId !== null}><RefreshCw size={14} />{syncingId === "all" ? "Syncing routed sources..." : "Sync all routed sources"}</button>}
      {notice && <div className="social-dashboard-notice">{notice}</div>}{error && <div className="social-dashboard-error">{error}</div>}
      <style>{`.social-dashboard-body{display:flex;flex-direction:column;gap:12px}.social-dashboard-summary{display:flex;justify-content:space-between;gap:12px}.social-dashboard-summary strong{font-size:14px}.social-dashboard-summary p,.social-dashboard-add small{display:block;margin:4px 0 0;color:var(--text-secondary);font-size:11px;line-height:1.45}.social-dashboard-icon{width:30px;height:30px;display:grid;place-items:center;border:1px solid var(--surface-border);border-radius:8px;background:var(--surface);color:var(--text-secondary);cursor:pointer}.social-dashboard-capabilities{display:flex;flex-wrap:wrap;gap:6px}.social-dashboard-capabilities span,.social-dashboard-source-meta span{display:inline-flex;align-items:center;gap:4px;padding:5px 7px;border-radius:7px;background:rgba(132,204,22,.08);color:#c9f99c;font-size:10px}.social-dashboard-add,.social-dashboard-source{padding:12px;border:1px solid var(--surface-border);border-radius:10px;background:rgba(0,0,0,.12)}.social-dashboard-form-row,.social-dashboard-route-row{display:flex;gap:7px;margin-top:9px}.social-dashboard-form-row select,.social-dashboard-form-row input,.social-dashboard-route-row select{min-width:0;flex:1;padding:8px;border:1px solid var(--surface-border);border-radius:7px;background:var(--surface);color:var(--text);font:inherit;font-size:11px}.social-dashboard-form-row button,.social-dashboard-route-row button,.social-dashboard-sync-all{display:inline-flex;align-items:center;justify-content:center;gap:5px;padding:8px 10px;border:1px solid var(--accent-border);border-radius:7px;background:var(--accent-bg);color:var(--accent);font:700 10px inherit;cursor:pointer;white-space:nowrap}.social-dashboard-form-row button:disabled,.social-dashboard-route-row button:disabled,.social-dashboard-sync-all:disabled{opacity:.5;cursor:not-allowed}.social-dashboard-sources{display:flex;flex-direction:column;gap:8px}.social-dashboard-source-head,.social-dashboard-route,.social-dashboard-run{display:flex;align-items:center;justify-content:space-between;gap:8px}.social-dashboard-source-head strong,.social-dashboard-source-head small{display:block}.social-dashboard-source-head small,.social-dashboard-route small,.social-dashboard-run small{margin-top:3px;color:var(--text-secondary);font-size:10px}.social-status{padding:4px 7px;border-radius:99px;font-size:9px;text-transform:uppercase;font-weight:800}.social-status.active{color:#c9f99c;background:rgba(132,204,22,.12)}.social-status.error{color:#ffb4aa;background:rgba(239,68,68,.1)}.social-dashboard-source-meta{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px}.social-dashboard-source-meta span{background:rgba(255,255,255,.05);color:var(--text-secondary)}.social-dashboard-route{margin-top:8px;padding-top:8px;border-top:1px solid var(--surface-border)}.social-dashboard-route button{border:0;background:transparent;color:var(--danger);cursor:pointer}.social-dashboard-run{margin-top:8px;padding-top:8px;border-top:1px solid var(--surface-border);color:var(--text-secondary);font-size:10px}.social-dashboard-run.failed{color:#ffb4aa}.social-dashboard-empty{display:flex;flex-direction:column;align-items:center;gap:7px;padding:28px 12px;border:1px dashed var(--surface-border);border-radius:10px;color:var(--text-secondary);text-align:center;font-size:11px}.social-dashboard-empty strong{color:var(--text)}.social-dashboard-notice,.social-dashboard-error{padding:9px;border-radius:8px;font-size:11px}.social-dashboard-notice{color:#c9f99c;background:rgba(132,204,22,.08)}.social-dashboard-error{color:#ffb4aa;background:rgba(239,68,68,.1)}@media(max-width:560px){.social-dashboard-form-row,.social-dashboard-route-row{flex-wrap:wrap}.social-dashboard-form-row select,.social-dashboard-form-row input,.social-dashboard-route-row select{flex-basis:100%}}`}</style>
    </div>
  );
}
