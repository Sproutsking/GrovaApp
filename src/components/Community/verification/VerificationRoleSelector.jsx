import React from "react";
import { Check } from "lucide-react";
import { getVerificationRoleCandidates, getVerificationRoleIssue, groupVerificationRoles } from "./verificationConfig";
import VerificationRoleActions from "./VerificationRoleActions";

const issueLabel = {
  default: "Default member role cannot be granted.",
  owner: "Owner role is protected.",
  rank: "Move above the default member role to make this eligible.",
  permissions: "High-impact permissions prevent this role from being granted.",
};

export default function VerificationRoleSelector({
  roles = [],
  selectedRoleId = "",
  onSelect,
  onPromoteRole,
  onManageRole,
  onDeleteRole,
  canManageRoles = false,
  disabled = false,
}) {
  const candidates = groupVerificationRoles(getVerificationRoleCandidates(roles));

  return (
    <div className="verification-role-picker-grid" role="group" aria-label="Roles available after verification">
      {candidates.map((roleGroup) => {
        const role = roleGroup.roles.find((candidate) => !getVerificationRoleIssue(candidate, roles)) || roleGroup.role;
        const issue = getVerificationRoleIssue(role, roles);
        const eligible = !issue;
        const groupSelected = roleGroup.roles.some((entry) => entry.id === selectedRoleId);
        return (
          <div className={`verification-role-picker-card${groupSelected ? " selected" : ""}${eligible ? "" : " unavailable"}`} key={roleGroup.key}>
            <button
              type="button"
              className="verification-role-picker-choice"
              aria-label={`${eligible ? "Select" : "Unavailable"} ${role.name} role${roleGroup.roles.length > 1 ? ` (${roleGroup.roles.length} entries)` : ""}`}
              aria-pressed={groupSelected}
              disabled={disabled || !eligible}
              onClick={() => onSelect?.(role.id)}
            >
              <span className="verification-role-picker-icon" style={{ "--role-color": role.color || "var(--accent)" }}>
                {role.icon || "♟"}
                {selectedRoleId === role.id && <Check size={12} />}
              </span>
              <strong>{role.name}</strong>
              {roleGroup.roles.length > 1 && <small>{roleGroup.roles.length} matching role entries</small>}
              <small>Rank {Number(role.position) + 1}</small>
              {!eligible && <small className="verification-role-picker-reason">{issueLabel[issue]}</small>}
            </button>
            {canManageRoles && (
              <VerificationRoleActions
                role={role}
                canManage={canManageRoles}
                onManageRole={onManageRole}
                onDeleteRole={onDeleteRole}
              />
            )}
            {issue === "rank" && (
              <button
                type="button"
                className="verification-role-picker-promote"
                aria-label={`Move ${role.name} above default role`}
                disabled={disabled || !onPromoteRole}
                onClick={() => onPromoteRole?.(role.id)}
              >
                Move above default
              </button>
            )}
          </div>
        );
      })}
      {!candidates.length && <p className="verification-role-picker-empty">No community roles are available yet.</p>}
      <style>{`.verification-role-picker-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,145px),1fr));gap:8px;margin-top:7px}.verification-role-picker-card{position:relative;display:flex;min-width:0;flex-direction:column;border:1px solid var(--surface-border);border-radius:10px;background:var(--surface);overflow:visible}.verification-role-picker-card.selected{border-color:var(--accent-border-strong);background:var(--accent-bg-soft)}.verification-role-picker-card.unavailable{opacity:.7}.verification-role-picker-choice{display:flex;min-height:104px;flex:1;flex-direction:column;align-items:flex-start;gap:5px;padding:10px;padding-right:38px;border:0;border-radius:inherit;background:transparent;color:var(--text);text-align:left;cursor:pointer}.verification-role-picker-choice:disabled{cursor:not-allowed}.verification-role-picker-choice strong{font-size:calc((11px) + 1px)}.verification-role-picker-choice small{color:var(--text-secondary);font-size:calc((9px) + 1px);line-height:1.35}.verification-role-picker-icon{position:relative;display:grid;place-items:center;width:27px;height:27px;border-radius:8px;background:color-mix(in srgb,var(--role-color) 17%,transparent);color:var(--role-color);font-size:calc((15px) + 1px)}.verification-role-picker-icon svg{position:absolute;right:-4px;bottom:-4px;padding:2px;border-radius:50%;background:var(--accent);color:#071000}.verification-role-picker-reason{color:var(--warning,#eac88e)!important}.verification-role-picker-card>.verification-role-actions{position:absolute;top:5px;right:5px;z-index:3}.verification-role-picker-promote{margin:0 8px 8px;padding:6px;border:1px solid var(--surface-border);border-radius:6px;background:var(--surface-strong);color:var(--accent);font-size:calc((9px) + 1px);font-weight:700;cursor:pointer}.verification-role-picker-promote:disabled{opacity:.5;cursor:not-allowed}.verification-role-picker-empty{grid-column:1/-1;color:var(--text-secondary);font-size:calc((10px) + 1px)}`}</style>
    </div>
  );
}
