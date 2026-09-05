import React, { useEffect, useState } from "react";
import { Check, ChevronRight, Crown, Link2, ShieldCheck, Ticket, UserPlus, Users2, Radio, Sparkles } from "lucide-react";
import { supabase } from "../../../../services/config/supabase";

import { X, Settings2 } from "lucide-react";
const TOOL_CATALOG = [
  { type: "verification", label: "Verification", description: "Choose how members prove access before entering.", icon: ShieldCheck, modes: [
    { id: "rules_gate", label: "Rules gate", description: "Members accept your rules before access is granted." },
    { id: "reaction_verification", label: "Reaction verification", description: "Members verify by selecting a reaction." },
    { id: "wallet_verification", label: "Wallet verification", description: "Require a supported wallet identity." },
    { id: "email_verification", label: "Email verification", description: "Verify a member through an approved email flow." },
  ] },
  { type: "social_updates", label: "Social updates", description: "Deliver connected updates to selected channels.", icon: Radio },
  { type: "tickets", label: "Tickets", description: "Give members a private support entry point.", icon: Ticket },
  { type: "welcome", label: "Welcome", description: "Show a polished introduction in a selected channel.", icon: Sparkles },
];

export default function ToolsSection({ communityId, channels = [], canManage = false, onOpenInvite, onOpenUpgrade, onOpenModeration }) {
  const [rows, setRows] = useState([]);
  const [openTool, setOpenTool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sourceConnected, setSourceConnected] = useState(false);
  const [dashboardTool, setDashboardTool] = useState(null);
  const [draft, setDraft] = useState({});

  useEffect(() => {
    let active = true;
    if (!communityId) return undefined;
    setLoading(true);
    supabase.from("community_tool_settings").select("*").eq("community_id", communityId)
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) setError(queryError.message);
        setRows(data || []);
        setLoading(false);
      });
    supabase.from("community_social_connections").select("id").eq("community_id", communityId).eq("provider", "xeevia").eq("status", "active").maybeSingle()
      .then(({ data }) => { if (active) setSourceConnected(Boolean(data)); });
    return () => { active = false; };
  }, [communityId]);

  const getRow = (type) => rows.find((row) => row.tool_type === type) || { tool_type: type, enabled: false, config: {} };
  const selectedIds = (type) => {
    const row = getRow(type);
    const configured = row.config?.channel_ids;
    if (Array.isArray(configured)) return new Set(configured);
    return row.channel_id ? new Set([row.channel_id]) : new Set();
  };

  const connectXeevia = async () => {
    if (!canManage) return;
    const { data: user } = await supabase.auth.getUser();
    const userId = user?.user?.id;
    if (!userId) return;
    const { error: connectionError } = await supabase.from("community_social_connections").upsert({ community_id: communityId, connected_by: userId, provider: "xeevia", provider_account_id: userId, display_name: "Xeevia account", status: "active", scopes: ["internal:posts"], updated_at: new Date().toISOString() }, { onConflict: "community_id,provider,provider_account_id" });
    if (connectionError) setError(connectionError.message); else setSourceConnected(true);
  };

  const toggleChannel = async (type, channelId) => {
    if (!canManage) return;
    const row = getRow(type);
    const nextIds = selectedIds(type);
    if (nextIds.has(channelId)) nextIds.delete(channelId); else nextIds.add(channelId);
    const ids = [...nextIds];
    const nextRow = {
      community_id: communityId,
      tool_type: type,
      enabled: ids.length > 0,
      channel_id: ids[0] || null,
      config: { ...(row.config || {}), channel_ids: ids },
      updated_at: new Date().toISOString(),
    };
    setError("");
    setRows((current) => [...current.filter((item) => item.tool_type !== type), { ...row, ...nextRow }]);
    const { error: saveError } = await supabase.from("community_tool_settings").upsert(nextRow, { onConflict: "community_id,tool_type" });
    if (saveError) { setError(saveError.message); return; }
    const { error: clearError } = await supabase.from("community_channels").update({ tool_type: null, updated_at: new Date().toISOString() }).eq("community_id", communityId).eq("tool_type", type);
    if (clearError) { setError(clearError.message); return; }
    if (ids.length) {
      const { error: markerError } = await supabase.from("community_channels").update({ tool_type: type, updated_at: new Date().toISOString() }).in("id", ids);
      if (markerError) setError(markerError.message);
    }
  };

  const updateWelcomeConfig = async (field, value) => {
    if (!canManage) return;
    const row = getRow("welcome");
    const nextRow = { ...row, community_id: communityId, tool_type: "welcome", enabled: true, channel_id: row.channel_id || null, config: { ...(row.config || {}), [field]: value }, updated_at: new Date().toISOString() };
    setRows((current) => [...current.filter((item) => item.tool_type !== "welcome"), nextRow]);
    const { error: saveError } = await supabase.from("community_tool_settings").upsert(nextRow, { onConflict: "community_id,tool_type" });
    if (saveError) setError(saveError.message);
  };

  const openDashboard = (tool) => {
    const row = getRow(tool.type);
    setDashboardTool(tool);
    setDraft({ ...(row.config || {}), mode: row.config?.mode || tool.modes?.[0]?.id || "default" });
  };

  const saveDashboard = async () => {
    if (!canManage || !dashboardTool) return;
    const row = getRow(dashboardTool.type);
    const nextRow = { ...row, community_id: communityId, tool_type: dashboardTool.type, enabled: Boolean(row.enabled || selectedIds(dashboardTool.type).size), channel_id: row.channel_id || null, config: { ...(row.config || {}), ...draft }, updated_at: new Date().toISOString() };
    const { error: saveError } = await supabase.from("community_tool_settings").upsert(nextRow, { onConflict: "community_id,tool_type" });
    if (saveError) { setError(saveError.message); return; }
    setRows((current) => [...current.filter((item) => item.tool_type !== dashboardTool.type), nextRow]);
    setDashboardTool(null);
  };

  const navigation = [
    { label: "Invite people", description: "Create or manage invite links.", icon: UserPlus, onClick: onOpenInvite },
    { label: "Upgrade community", description: "Boost visibility and unlock premium controls.", icon: Crown, onClick: onOpenUpgrade },
    { label: "Roles & moderation", description: "Manage roles, permissions, and member access.", icon: Users2, onClick: onOpenModeration },
  ];

  return (
    <section className="community-tools-section">
      <div className="tools-intro"><strong>Community tools</strong><span>Choose a tool, then send its member-facing panel to one or more channels.</span></div>
      {navigation.map((item) => (
        <button type="button" className="community-tool-card" key={item.label} onClick={item.onClick}>
          <span className="community-tool-icon"><item.icon size={17} /></span><span className="community-tool-copy"><strong>{item.label}</strong><small>{item.description}</small></span><ChevronRight size={15} />
        </button>
      ))}
      {TOOL_CATALOG.map((tool) => {
        const open = openTool === tool.type;
        const selected = selectedIds(tool.type);
        return (
          <div className={`community-tool-group${open ? " open" : ""}`} key={tool.type}>
            <button type="button" className="community-tool-card" onClick={() => openDashboard(tool)}>
              <span className="community-tool-icon"><tool.icon size={17} /></span><span className="community-tool-copy"><strong>{tool.label}</strong><small>{tool.description}</small></span><em>{selected.size ? `${selected.size} channel${selected.size > 1 ? "s" : ""}` : "Off"}</em><ChevronRight size={15} />
            </button>
            {open && <div className="community-tool-picker"><span>{loading ? "Loading channels..." : canManage ? "Send member-facing panel to:" : "Configured channels:"}</span>{channels.filter((channel) => channel.type !== "voice").map((channel) => <button type="button" disabled={!canManage} className={`community-tool-channel${selected.has(channel.id) ? " selected" : ""}`} key={channel.id} onClick={() => toggleChannel(tool.type, channel.id)}><i>{selected.has(channel.id) ? <Check size={12} /> : null}</i>#{channel.name}</button>)}{tool.type === "welcome" && <div className="community-tool-config"><input disabled={!canManage} value={getRow("welcome").config?.title || "Welcome to our community"} onChange={(event) => updateWelcomeConfig("title", event.target.value)} placeholder="Welcome title" maxLength={150} /><textarea disabled={!canManage} value={getRow("welcome").config?.description || "Introduce yourself and join the conversation."} onChange={(event) => updateWelcomeConfig("description", event.target.value)} placeholder="Welcome description" rows={3} maxLength={500} /></div>}</div>}
            {open && tool.type === "social_updates" && canManage && <button type="button" className="community-tool-source" onClick={connectXeevia}>{sourceConnected ? "Xeevia connected" : "Connect Xeevia source"}</button>}
          </div>
        );
      })}
      {error && <p className="community-tools-error">{error}</p>}
      {dashboardTool && <div className="tool-dashboard-overlay" onClick={() => setDashboardTool(null)}><section className="tool-dashboard" onClick={(event) => event.stopPropagation()}><header><div><span className="tool-dashboard-kicker">Community tool dashboard</span><h2>{dashboardTool.label}</h2><p>{dashboardTool.description}</p></div><button type="button" onClick={() => setDashboardTool(null)} aria-label="Close tool dashboard"><X size={18} /></button></header><div className="tool-dashboard-body"><div className="tool-dashboard-block"><strong>Tool type</strong><div className="tool-mode-grid">{(dashboardTool.modes || [{ id: "default", label: "Standard", description: "Use the standard configuration for this tool." }]).map((mode) => <button type="button" key={mode.id} className={`tool-mode-card${draft.mode === mode.id ? " selected" : ""}`} onClick={() => setDraft((current) => ({ ...current, mode: mode.id }))}><span>{draft.mode === mode.id ? <Check size={14} /> : null}</span><b>{mode.label}</b><small>{mode.description}</small></button>)}</div></div><div className="tool-dashboard-block"><strong>Member-facing channels</strong><p className="tool-dashboard-help">Choose where this tool is available. Selecting a channel opens it in the channel list without changing your existing channel arrangement.</p><div className="tool-channel-grid">{channels.filter((channel) => channel.type !== "voice").map((channel) => <button type="button" disabled={!canManage} className={`community-tool-channel${selectedIds(dashboardTool.type).has(channel.id) ? " selected" : ""}`} key={channel.id} onClick={() => toggleChannel(dashboardTool.type, channel.id)}><i>{selectedIds(dashboardTool.type).has(channel.id) ? <Check size={12} /> : null}</i>#{channel.name}</button>)}</div></div>{dashboardTool.type === "verification" && <div className="tool-dashboard-block"><strong>Verification setup</strong><input disabled={!canManage} value={draft.message || ""} onChange={(event) => setDraft((current) => ({ ...current, message: event.target.value }))} placeholder="Message shown before verification" maxLength={300} /><small className="tool-dashboard-help">Some verification types require an enabled Xeevia platform integration before members can use them.</small></div>}{dashboardTool.type === "welcome" && <div className="tool-dashboard-block"><strong>Welcome content</strong><input disabled={!canManage} value={draft.title || "Welcome to our community"} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Welcome title" maxLength={150} /><textarea disabled={!canManage} value={draft.description || "Introduce yourself and join the conversation."} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Welcome description" rows={4} maxLength={500} /></div>}</div><footer><button type="button" className="tool-dashboard-cancel" onClick={() => setDashboardTool(null)}>Cancel</button><button type="button" className="tool-dashboard-save" disabled={!canManage} onClick={saveDashboard}>Save tool setup</button></footer></section></div>}
      <style>{`
        .community-tools-section{padding:10px;display:flex;flex-direction:column;gap:7px}.tools-intro{display:flex;flex-direction:column;gap:4px;padding:5px 3px 9px}.tools-intro strong{color:var(--text);font-size:16px}.tools-intro span{color:var(--text-secondary);font-size:11px;line-height:1.5}.community-tool-card{display:flex;align-items:center;gap:10px;width:100%;padding:12px;border:1px solid var(--surface-border);border-radius:11px;background:var(--surface);color:var(--text);text-align:left;cursor:pointer;font:inherit}.community-tool-card:hover{border-color:var(--accent-border);background:var(--surface-strong)}.community-tool-icon{width:34px;height:34px;display:grid;place-items:center;flex-shrink:0;border-radius:9px;background:var(--accent-bg);color:var(--accent)}.community-tool-copy{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}.community-tool-copy strong{font-size:12px}.community-tool-copy small{color:var(--text-secondary);font-size:10px;line-height:1.3}.community-tool-card em{font-style:normal;color:var(--accent);font-size:10px;font-weight:800}.community-tool-group.open>.community-tool-card svg:last-child{transform:rotate(90deg)}.community-tool-picker{display:flex;flex-direction:column;gap:3px;padding:8px 9px 9px;margin-top:-2px;border:1px solid var(--accent-border);border-top:0;border-radius:0 0 10px 10px;background:rgba(0,0,0,.18)}.community-tool-picker>span{padding:2px 3px 5px;color:var(--text-secondary);font-size:10px}.community-tool-channel{display:flex;align-items:center;gap:8px;padding:8px;border:0;border-radius:7px;background:transparent;color:var(--text-secondary);font:600 12px inherit;text-align:left;cursor:pointer}.community-tool-channel:hover,.community-tool-channel.selected{background:var(--accent-bg);color:var(--accent)}.community-tool-channel i{width:15px;height:15px;display:grid;place-items:center;border:1px solid var(--accent-border);border-radius:4px;font-style:normal}.community-tools-error{margin:4px 2px;color:var(--danger);font-size:11px}
      `}</style>
      <style>{`.tool-dashboard-overlay{position:fixed;inset:0;z-index:20000;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.58);backdrop-filter:blur(8px)}.tool-dashboard{width:min(680px,100%);max-height:min(760px,calc(100vh - 36px));display:flex;flex-direction:column;overflow:hidden;background:var(--surface-strong);border:1px solid var(--accent-border);border-radius:16px;box-shadow:0 24px 90px rgba(0,0,0,.65)}.tool-dashboard header,.tool-dashboard footer{display:flex;align-items:center;gap:12px;padding:16px 18px;border-color:var(--surface-border)}.tool-dashboard header{justify-content:space-between;border-bottom:1px solid var(--surface-border)}.tool-dashboard header h2{margin:3px 0;font-size:20px;color:var(--text)}.tool-dashboard header p,.tool-dashboard-help{margin:0;color:var(--text-secondary);font-size:11px;line-height:1.5}.tool-dashboard header button{display:grid;place-items:center;width:30px;height:30px;border:0;border-radius:8px;background:var(--surface);color:var(--text-secondary);cursor:pointer}.tool-dashboard-body{overflow:auto;padding:16px 18px;display:flex;flex-direction:column;gap:14px}.tool-dashboard-kicker{color:var(--accent);font-size:9px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.tool-dashboard-block{display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid var(--surface-border);border-radius:11px;background:rgba(0,0,0,.12)}.tool-dashboard-block strong{font-size:12px;color:var(--text)}.tool-mode-grid,.tool-channel-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:7px}.tool-mode-card{display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:10px;border:1px solid var(--surface-border);border-radius:9px;background:var(--surface);color:var(--text);text-align:left;cursor:pointer}.tool-mode-card.selected{border-color:var(--accent-border-strong);background:var(--accent-bg)}.tool-mode-card span{color:var(--accent);height:14px}.tool-mode-card b{font-size:11px}.tool-mode-card small{color:var(--text-secondary);font-size:10px;line-height:1.4}.tool-dashboard-block input,.tool-dashboard-block textarea{width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--surface-border);border-radius:8px;background:var(--surface);color:var(--text);font:inherit}.tool-dashboard footer{justify-content:flex-end;border-top:1px solid var(--surface-border)}.tool-dashboard-cancel,.tool-dashboard-save{padding:10px 14px;border-radius:8px;font:800 11px inherit;cursor:pointer}.tool-dashboard-cancel{border:1px solid var(--surface-border);background:var(--surface);color:var(--text-secondary)}.tool-dashboard-save{border:1px solid var(--accent-border);background:var(--accent-bg);color:var(--accent)}`}</style>
    </section>
  );
}
