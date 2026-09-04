import React, { useEffect, useState } from "react";
import { Check, ChevronRight, Crown, Link2, ShieldCheck, Ticket, UserPlus, Users2, Radio } from "lucide-react";
import { supabase } from "../../../../services/config/supabase";

const TOOL_CATALOG = [
  { type: "verification", label: "Verification", description: "Confirm rules before members enter.", icon: ShieldCheck },
  { type: "social_updates", label: "Social updates", description: "Deliver connected updates to selected channels.", icon: Radio },
  { type: "tickets", label: "Tickets", description: "Give members a private support entry point.", icon: Ticket },
];

export default function ToolsSection({ communityId, channels = [], canManage = false, onOpenInvite, onOpenUpgrade, onOpenModeration }) {
  const [rows, setRows] = useState([]);
  const [openTool, setOpenTool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
    return () => { active = false; };
  }, [communityId]);

  const getRow = (type) => rows.find((row) => row.tool_type === type) || { tool_type: type, enabled: false, config: {} };
  const selectedIds = (type) => {
    const row = getRow(type);
    const configured = row.config?.channel_ids;
    if (Array.isArray(configured)) return new Set(configured);
    return row.channel_id ? new Set([row.channel_id]) : new Set();
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
            <button type="button" className="community-tool-card" onClick={() => setOpenTool(open ? null : tool.type)}>
              <span className="community-tool-icon"><tool.icon size={17} /></span><span className="community-tool-copy"><strong>{tool.label}</strong><small>{tool.description}</small></span><em>{selected.size ? `${selected.size} channel${selected.size > 1 ? "s" : ""}` : "Off"}</em><ChevronRight size={15} />
            </button>
            {open && <div className="community-tool-picker"><span>{loading ? "Loading channels..." : canManage ? "Send member-facing panel to:" : "Configured channels:"}</span>{channels.filter((channel) => channel.type !== "voice").map((channel) => <button type="button" disabled={!canManage} className={`community-tool-channel${selected.has(channel.id) ? " selected" : ""}`} key={channel.id} onClick={() => toggleChannel(tool.type, channel.id)}><i>{selected.has(channel.id) ? <Check size={12} /> : null}</i>#{channel.name}</button>)}</div>}
          </div>
        );
      })}
      {error && <p className="community-tools-error">{error}</p>}
      <style>{`
        .community-tools-section{padding:10px;display:flex;flex-direction:column;gap:7px}.tools-intro{display:flex;flex-direction:column;gap:4px;padding:5px 3px 9px}.tools-intro strong{color:var(--text);font-size:16px}.tools-intro span{color:var(--text-secondary);font-size:11px;line-height:1.5}.community-tool-card{display:flex;align-items:center;gap:10px;width:100%;padding:12px;border:1px solid var(--surface-border);border-radius:11px;background:var(--surface);color:var(--text);text-align:left;cursor:pointer;font:inherit}.community-tool-card:hover{border-color:var(--accent-border);background:var(--surface-strong)}.community-tool-icon{width:34px;height:34px;display:grid;place-items:center;flex-shrink:0;border-radius:9px;background:var(--accent-bg);color:var(--accent)}.community-tool-copy{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}.community-tool-copy strong{font-size:12px}.community-tool-copy small{color:var(--text-secondary);font-size:10px;line-height:1.3}.community-tool-card em{font-style:normal;color:var(--accent);font-size:10px;font-weight:800}.community-tool-group.open>.community-tool-card svg:last-child{transform:rotate(90deg)}.community-tool-picker{display:flex;flex-direction:column;gap:3px;padding:8px 9px 9px;margin-top:-2px;border:1px solid var(--accent-border);border-top:0;border-radius:0 0 10px 10px;background:rgba(0,0,0,.18)}.community-tool-picker>span{padding:2px 3px 5px;color:var(--text-secondary);font-size:10px}.community-tool-channel{display:flex;align-items:center;gap:8px;padding:8px;border:0;border-radius:7px;background:transparent;color:var(--text-secondary);font:600 12px inherit;text-align:left;cursor:pointer}.community-tool-channel:hover,.community-tool-channel.selected{background:var(--accent-bg);color:var(--accent)}.community-tool-channel i{width:15px;height:15px;display:grid;place-items:center;border:1px solid var(--accent-border);border-radius:4px;font-style:normal}.community-tools-error{margin:4px 2px;color:var(--danger);font-size:11px}
      `}</style>
    </section>
  );
}
