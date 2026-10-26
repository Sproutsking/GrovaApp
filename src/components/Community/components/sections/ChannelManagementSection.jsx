import React, { useState } from "react";
import { Edit3, Plus, Settings2, Shield } from "lucide-react";
import ChannelPermissionsModal from "../../modals/ChannelPermissionsModal";

export default function ChannelManagementSection({ communityId, channels = [], roles = [], canCreate = true, onCreate, onEdit, onPermissionsChanged }) {
  const [permissionsChannel, setPermissionsChannel] = useState(null);

  return (
    <section className="channel-management-section">
      <div className="channel-management-head"><div><span>Community structure</span><h2>Manage channels</h2><p>Edit names, icons, categories, permissions, privacy, and channel type.</p></div>{canCreate && <button type="button" onClick={onCreate} aria-label="Create channel"><Plus size={16} /> Create</button>}</div>
      <div className="channel-management-list">
        {channels.map((channel) => <div className="channel-management-row" key={channel.id}>
          <button type="button" className="channel-management-edit" onClick={() => onEdit(channel)}>
            <span className="channel-management-icon">{channel.icon || "#"}</span>
            <span><strong>#{channel.name}</strong><small>{channel.category || "Channels"} · {channel.type}</small></span>
            <Edit3 size={15} />
          </button>
          <button type="button" className="channel-management-permissions" title={`Manage permissions for #${channel.name}`} aria-label={`Manage permissions for #${channel.name}`} onClick={() => setPermissionsChannel(channel)}><Shield size={15} /></button>
        </div>)}
      </div>
      {permissionsChannel && <ChannelPermissionsModal channel={permissionsChannel} communityId={communityId} roles={roles} onClose={() => setPermissionsChannel(null)} onSave={onPermissionsChanged} />}
      <div className="channel-management-note"><Settings2 size={14} /> Right-click a category in the channel rail to rename, reorder, or move its channels.</div>
      <style>{`.channel-management-section{padding:12px}.channel-management-head{display:flex;align-items:flex-start;gap:12px;padding:4px 2px 14px}.channel-management-head>div{flex:1}.channel-management-head span{font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--accent)}.channel-management-head h2{margin:4px 0;font-size:19px;color:var(--text)}.channel-management-head p{margin:0;color:var(--text-secondary);font-size:11px;line-height:1.45}.channel-management-head button{display:flex;align-items:center;gap:5px;padding:8px 10px;border:1px solid var(--accent-border);border-radius:8px;background:var(--accent-bg);color:var(--accent);font:800 11px inherit;cursor:pointer}.channel-management-list{display:flex;flex-direction:column;gap:6px}.channel-management-row{display:flex;align-items:center;gap:8px;width:100%;padding:7px 8px;border:1px solid var(--surface-border);border-radius:10px;background:var(--surface);color:var(--text)}.channel-management-row:hover{border-color:var(--accent-border);background:var(--surface-strong)}.channel-management-edit{display:flex;align-items:center;gap:10px;flex:1;min-width:0;padding:3px;border:0;background:transparent;color:inherit;text-align:left;font:inherit;cursor:pointer}.channel-management-edit>span:nth-child(2){display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}.channel-management-icon{width:28px;height:28px;display:grid;place-items:center;flex-shrink:0;border-radius:7px;background:var(--accent-bg);font-size:14px}.channel-management-row strong{font-size:12px}.channel-management-row small{color:var(--text-secondary);font-size:10px}.channel-management-permissions{width:32px;height:32px;display:grid;place-items:center;flex-shrink:0;border:1px solid var(--surface-border);border-radius:8px;background:var(--surface-strong);color:var(--accent);cursor:pointer}.channel-management-permissions:hover{border-color:var(--accent-border);background:var(--accent-bg)}.channel-management-note{display:flex;gap:6px;align-items:center;margin-top:14px;padding:10px;color:var(--text-secondary);font-size:10px;border-top:1px solid var(--surface-border)}`}</style>
    </section>
  );
}
