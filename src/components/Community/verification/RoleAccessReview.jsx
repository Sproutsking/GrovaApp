import React from "react";
import { Check, Eye, EyeOff, MessageSquare } from "lucide-react";
import { categoryIdOf, resolveAccessForRole } from "../../../services/community/accessService";

const formatPermission = (permission) => permission
  .replace(/([A-Z])/g, " $1")
  .replace(/^./, (letter) => letter.toUpperCase());

export default function RoleAccessReview({ role, channels = [], categories = [], accessRules = [] }) {
  const permissions = Object.entries(role.permissions || {})
    .filter(([, enabled]) => enabled === true)
    .map(([permission]) => formatPermission(permission));
  const channelAccess = channels
    .filter((channel) => channel.type !== "voice")
    .map((channel) => {
      const access = resolveAccessForRole({
        roleId: role.id,
        channel,
        categoryId: categoryIdOf(channel, categories),
        rules: accessRules,
        defaultOpen: role.permissions?.viewChannels === true && !channel.is_private,
      });
      return {
        channel,
        access: { ...access, canSend: access.canView && access.canSend && role.permissions?.sendMessages === true },
      };
    });
  const visibleChannels = channelAccess.filter(({ access }) => access.canView);

  return (
    <section className="verification-role-review" aria-label={`${role.name} permissions and channel access`}>
      <div className="verification-role-review-summary">
        <strong><Check size={13} /> Role permission summary</strong>
        <span>{permissions.length ? permissions.join(" · ") : "No role-level permissions enabled"}</span>
      </div>
      <div className="verification-role-review-summary">
        <strong><Eye size={13} /> Channels this role can see</strong>
        <span>{visibleChannels.length} of {channelAccess.length} text channels</span>
      </div>
      <div className="verification-role-review-channels">
        {!channelAccess.length && <p>No text channels are available to preview.</p>}
        {channelAccess.map(({ channel, access }) => (
          <div key={channel.id} className={`verification-role-review-channel${access.canView ? " visible" : " hidden"}`}>
            {access.canView ? <Eye size={12} /> : <EyeOff size={12} />}
            <span>#{channel.name}</span>
            {access.canView && access.canSend && <MessageSquare size={11} aria-label="Can send messages" />}
            {access.canView && !access.canSend && <small>Read only</small>}
            {!access.canView && <small>Hidden</small>}
          </div>
        ))}
      </div>
      <style>{`.verification-role-review{display:grid;gap:7px;padding:9px;border:1px solid var(--surface-border);border-radius:8px;background:rgba(0,0,0,.18)}.verification-role-review-summary{display:grid;gap:3px}.verification-role-review-summary strong{display:flex;align-items:center;gap:5px;color:var(--text);font-size:10px}.verification-role-review-summary strong svg{color:var(--accent)}.verification-role-review-summary span{color:var(--text-secondary);font-size:9px;line-height:1.45}.verification-role-review-channels{display:grid;gap:4px;max-height:190px;overflow:auto;padding-top:4px;border-top:1px solid var(--surface-border)}.verification-role-review-channels>p{margin:0;color:var(--text-secondary);font-size:9px}.verification-role-review-channel{display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:5px;font-size:9px}.verification-role-review-channel span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.verification-role-review-channel.visible{color:#a8dc7b;background:rgba(132,204,22,.06)}.verification-role-review-channel.hidden{color:var(--text-secondary);opacity:.72}.verification-role-review-channel small{font-size:8px}`}</style>
    </section>
  );
}
