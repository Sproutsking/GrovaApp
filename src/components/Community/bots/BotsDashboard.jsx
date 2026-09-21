import React, { useEffect, useMemo, useState } from "react";
import { Bot, Check, ExternalLink, Plus, RefreshCw, Send, Trash2, X } from "lucide-react";
import communityBotService from "../../../services/community/communityBotService";

const BOT_META = {
  discord: { label: "Discord bot", help: "Send Xeevia posts to selected Discord channels.", color: "#5865f2", destination: "Channel", env: "REACT_APP_DISCORD_BOT_CLIENT_ID" },
  telegram: { label: "Telegram bot", help: "Send Xeevia posts to selected Telegram chats or channels.", color: "#2ea6da", destination: "Chat or channel", env: "REACT_APP_TELEGRAM_BOT_USERNAME" },
};

export default function BotsDashboard({ communityId, userId, canManage = false }) {
  const [provider, setProvider] = useState("discord");
  const [integrations, setIntegrations] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [form, setForm] = useState({ externalId: "", parentExternalId: "", displayName: "" });
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const meta = BOT_META[provider];
  const integration = useMemo(() => integrations.find((item) => item.provider === provider), [integrations, provider]);
  const providerDestinations = destinations.filter((item) => item.provider === provider);

  const refresh = async () => {
    const next = await communityBotService.listIntegrations(communityId);
    setIntegrations(next.integrations);
    setDestinations(next.destinations);
  };

  useEffect(() => {
    refresh().catch((loadError) => setError(loadError.message || "Could not load bot settings."));
  }, [communityId]);

  const connectBot = async () => {
    if (!canManage) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await communityBotService.saveIntegration({ communityId, userId, provider, status: "pending" });
      const clientId = provider === "discord" ? process.env.REACT_APP_DISCORD_BOT_CLIENT_ID : "";
      if (provider === "discord" && clientId) {
        const url = `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(clientId)}&permissions=18432&scope=bot%20applications.commands`;
        window.open(url, "xeevia-discord-bot", "noopener,noreferrer,width=520,height=760");
        setNotice("Discord opened. Choose the server, authorize the bot, then add its channel below.");
      } else if (provider === "telegram") {
        setNotice("Telegram bot access is ready for configuration. Add the bot to the target chat, then enter its chat ID below.");
      } else {
        setNotice(`Add ${meta.env} to the frontend environment before opening the ${meta.label} installer.`);
      }
      await refresh();
    } catch (connectError) { setError(connectError.message || "Could not start bot setup."); }
    finally { setBusy(false); }
  };

  const addDestination = async (event) => {
    event.preventDefault();
    if (!canManage || !integration || !form.externalId.trim() || !form.displayName.trim()) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await communityBotService.saveDestination({ communityId, integrationId: integration.id, provider, externalId: form.externalId, parentExternalId: form.parentExternalId, displayName: form.displayName, destinationType: provider === "discord" ? "channel" : "chat" });
      setForm({ externalId: "", parentExternalId: "", displayName: "" });
      await refresh();
      setNotice(`${meta.destination} added. It is ready to receive selected posts.`);
    } catch (saveError) { setError(saveError.message || "Could not save destination."); }
    finally { setBusy(false); }
  };

  const check = async () => {
    if (!integration) return;
    setChecking(provider); setError("");
    try {
      await communityBotService.checkBot(provider, communityId);
      await refresh();
      setNotice(`${meta.label} connection checked.`);
    } catch (checkError) { setError(checkError.message || "Bot check needs the server function and secrets configured."); }
    finally { setChecking(null); }
  };

  const toggle = async (destination) => {
    try { await communityBotService.toggleDestination(destination.id, !destination.enabled); await refresh(); }
    catch (toggleError) { setError(toggleError.message || "Could not update destination."); }
  };

  const remove = async (destination) => {
    try { await communityBotService.removeDestination(destination.id); await refresh(); }
    catch (removeError) { setError(removeError.message || "Could not remove destination."); }
  };

  return (
    <div className="bots-dashboard">
      <div className="bots-dashboard-head">
        <div><span className="bots-kicker">Community tool dashboard</span><h2>Publishing bots</h2><p>Connect a bot once, then route posts to as many destinations as you need.</p></div>
        <button type="button" className="bots-refresh" onClick={() => refresh().catch((e) => setError(e.message))} aria-label="Refresh bot settings"><RefreshCw size={14} /></button>
      </div>
      <div className="bot-provider-tabs">
        {Object.entries(BOT_META).map(([id, item]) => <button type="button" key={id} className={provider === id ? "active" : ""} onClick={() => { setProvider(id); setError(""); setNotice(""); }}><Bot size={14} />{item.label}</button>)}
      </div>
      <section className="bot-panel" style={{ "--bot-color": meta.color }}>
        <div className="bot-panel-title"><div className="bot-mark"><Bot size={18} /></div><div><strong>{meta.label}</strong><small>{meta.help}</small></div><span className={`bot-status ${integration?.status || "pending"}`}>{integration?.status || "Not connected"}</span></div>
        <div className="bot-actions"><button type="button" className="bot-primary" onClick={connectBot} disabled={!canManage || busy}><ExternalLink size={14} /> {integration ? "Connect another server" : "Connect bot"}</button><button type="button" className="bot-secondary" onClick={check} disabled={!integration || checking}><RefreshCw size={13} className={checking ? "bot-spin" : ""} /> Check connection</button></div>
        <div className="bot-help">Bot credentials are kept in Supabase secrets. This dashboard stores only destination IDs and display names.</div>
      </section>
      <section className="bot-panel">
        <div className="bot-section-head"><div><strong>Connected destinations</strong><small>Each enabled destination receives posts selected in the distribution control.</small></div><span>{providerDestinations.filter((item) => item.enabled).length} active</span></div>
        <div className="bot-destination-list">{providerDestinations.map((destination) => <div className={`bot-destination ${destination.enabled ? "enabled" : "disabled"}`} key={destination.id}><div><strong>{destination.display_name}</strong><small>{meta.destination} ID: {destination.external_id}</small></div><button type="button" onClick={() => toggle(destination)} aria-label={`Toggle ${destination.display_name}`}><span /></button><button type="button" className="bot-delete" onClick={() => remove(destination)} aria-label={`Remove ${destination.display_name}`}><Trash2 size={13} /></button></div>)}{!providerDestinations.length && <div className="bot-empty">No {provider} destinations configured yet.</div>}</div>
        {integration && <form className="bot-add-form" onSubmit={addDestination}><strong><Plus size={14} /> Add {meta.destination.toLowerCase()}</strong><input value={form.displayName} onChange={(e) => setForm((current) => ({ ...current, displayName: e.target.value }))} placeholder="Display name" required /><input value={form.externalId} onChange={(e) => setForm((current) => ({ ...current, externalId: e.target.value }))} placeholder={provider === "discord" ? "Channel ID" : "Chat ID"} required /><input value={form.parentExternalId} onChange={(e) => setForm((current) => ({ ...current, parentExternalId: e.target.value }))} placeholder={provider === "discord" ? "Server ID (optional)" : "Thread ID (optional)"} /><button type="submit" disabled={!canManage || busy}><Send size={13} /> Save destination</button></form>}
      </section>
      {notice && <p className="bots-notice"><Check size={14} />{notice}</p>}{error && <p className="bots-error"><X size={14} />{error}</p>}
      <style>{`.bots-dashboard{display:flex;flex-direction:column;gap:12px}.bots-dashboard-head,.bot-section-head,.bot-panel-title{display:flex;align-items:center;gap:11px}.bots-dashboard-head{justify-content:space-between}.bots-kicker{color:var(--accent);font-size:9px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.bots-dashboard h2{margin:3px 0;font-size:20px;color:var(--text)}.bots-dashboard p{margin:0;color:var(--text-secondary);font-size:11px;line-height:1.5}.bots-refresh,.bot-delete{display:grid;place-items:center;border:0;background:var(--surface);color:var(--text-secondary);border-radius:8px;cursor:pointer}.bots-refresh{width:30px;height:30px}.bot-provider-tabs{display:grid;grid-template-columns:1fr 1fr;gap:7px}.bot-provider-tabs button{display:flex;align-items:center;justify-content:center;gap:7px;padding:9px;border:1px solid var(--surface-border);border-radius:9px;background:var(--surface);color:var(--text-secondary);font:700 11px inherit;cursor:pointer}.bot-provider-tabs button.active{border-color:var(--accent-border-strong);background:var(--accent-bg);color:var(--accent)}.bot-panel{display:flex;flex-direction:column;gap:11px;padding:12px;border:1px solid var(--surface-border);border-radius:11px;background:rgba(0,0,0,.12)}.bot-mark{width:32px;height:32px;display:grid;place-items:center;border-radius:9px;background:color-mix(in srgb,var(--bot-color,#84cc16) 16%,transparent);color:var(--bot-color,#84cc16)}.bot-panel-title>div:nth-child(2){display:flex;flex-direction:column;gap:2px;flex:1}.bot-panel-title strong,.bot-section-head strong{font-size:12px;color:var(--text)}.bot-panel-title small,.bot-section-head small,.bot-destination small{font-size:10px;color:var(--text-secondary)}.bot-status{font-size:9px;font-weight:800;text-transform:uppercase;color:var(--text-secondary)}.bot-status.active{color:var(--accent)}.bot-actions{display:flex;gap:7px}.bot-actions button,.bot-add-form button{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:8px 10px;border-radius:8px;border:1px solid var(--surface-border);font:700 10px inherit;cursor:pointer}.bot-primary{background:var(--accent);color:#101010;border-color:var(--accent)!important}.bot-secondary{background:var(--surface);color:var(--text-secondary)}.bot-help{padding-top:8px;border-top:1px solid var(--surface-border);font-size:10px;color:var(--text-secondary);line-height:1.4}.bot-section-head{justify-content:space-between}.bot-section-head>span{color:var(--accent);font-size:10px;font-weight:800}.bot-destination-list{display:flex;flex-direction:column;gap:5px}.bot-destination{display:flex;align-items:center;gap:8px;padding:8px;border-radius:8px;background:var(--surface);border:1px solid var(--surface-border)}.bot-destination>div{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}.bot-destination strong{font-size:11px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bot-destination button:not(.bot-delete){width:28px;height:16px;border:1px solid var(--surface-border);border-radius:9px;background:#222;cursor:pointer}.bot-destination button:not(.bot-delete) span{display:block;width:10px;height:10px;border-radius:50%;background:#777;transition:transform .15s}.bot-destination.enabled button:not(.bot-delete){background:var(--accent);border-color:var(--accent)}.bot-destination.enabled button:not(.bot-delete) span{background:#111;transform:translateX(11px)}.bot-delete{width:25px;height:25px;color:#ef7777}.bot-empty{padding:12px;text-align:center;color:var(--text-secondary);font-size:11px}.bot-add-form{display:grid;grid-template-columns:1fr 1fr;gap:7px;padding-top:10px;border-top:1px solid var(--surface-border)}.bot-add-form strong{grid-column:1/-1;display:flex;align-items:center;gap:5px;color:var(--text);font-size:11px}.bot-add-form input{min-width:0;padding:8px;border:1px solid var(--surface-border);border-radius:7px;background:var(--surface);color:var(--text);font:11px inherit}.bot-add-form button{grid-column:1/-1;background:var(--accent);color:#111;border-color:var(--accent)}.bots-notice,.bots-error{display:flex;align-items:center;gap:6px;padding:8px 10px;border-radius:8px}.bots-notice{color:var(--accent)!important;background:var(--accent-bg)}.bots-error{color:var(--danger)!important;background:rgba(239,68,68,.08)}.bot-spin{animation:botSpin .8s linear infinite}@keyframes botSpin{to{transform:rotate(360deg)}}@media(max-width:520px){.bot-actions{flex-direction:column}.bot-add-form{grid-template-columns:1fr}.bot-add-form input{grid-column:1/-1}}`}</style>
    </div>
  );
}
