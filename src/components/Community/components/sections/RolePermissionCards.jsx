import React, { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { ROLE_PERMISSION_GROUPS } from "./rolePermissionCatalog";
import { DANGEROUS_PERMS } from "../../verification/verificationConfig";

export default function RolePermissionCards({ value = {}, onChange, disabled = false }) {
  const [search, setSearch] = useState("");
  const groups = useMemo(() => ROLE_PERMISSION_GROUPS.map((group) => {
    const permissions = group.perms.map((permission) => ({
      ...permission,
      danger: permission.danger || DANGEROUS_PERMS.includes(permission.key),
    }));
    return {
      ...group,
      allPerms: permissions,
      perms: permissions.filter((permission) =>
        !search
        || permission.label.toLowerCase().includes(search.toLowerCase())
        || permission.desc.toLowerCase().includes(search.toLowerCase()),
      ),
    };
  }).filter((group) => group.perms.length), [search]);
  const supportedPermissions = ROLE_PERMISSION_GROUPS.flatMap((group) => group.perms);
  const enabledCount = supportedPermissions.filter((permission) => value[permission.key] === true).length;

  const setGroup = (group, enabled) => {
    const groupPermissions = group.allPerms.filter((permission) => !permission.danger);
    onChange?.({
      ...value,
      ...Object.fromEntries(groupPermissions.map((permission) => [permission.key, enabled])),
    });
  };

  const clearGroup = (group) => {
    onChange?.({
      ...value,
      ...Object.fromEntries(group.allPerms.map((permission) => [permission.key, false])),
    });
  };

  return (
    <div className="role-permission-cards">
      <div className="role-permission-summary">
        <div><strong>Role capabilities</strong><span>{enabledCount} enabled</span></div>
        <label className="role-permission-search">
          <Search size={14} aria-hidden="true" />
          <input aria-label="Search permissions" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a permission" />
        </label>
      </div>
      {groups.map((group) => {
        const enabledInGroup = group.allPerms.filter((permission) => value[permission.key] === true).length;
        const bulkPermissions = group.allPerms.filter((permission) => !permission.danger);
        const allEnabled = bulkPermissions.every((permission) => value[permission.key] === true);
        return (
          <section className="role-permission-group" key={group.label}>
            <header>
              <div><strong>{group.label}</strong><span>{enabledInGroup} / {group.allPerms.length} on</span></div>
              <div className="role-permission-group-actions" role="group" aria-label={`${group.label} group permissions`}>
                <button type="button" disabled={disabled} aria-label={`Enable safe ${group.label} permissions`} aria-pressed={allEnabled} onClick={() => setGroup(group, true)}>Enable safe</button>
                <button type="button" disabled={disabled} aria-label={`Clear ${group.label} permissions`} aria-pressed={enabledInGroup === 0} onClick={() => clearGroup(group)}>Clear all</button>
              </div>
            </header>
            <div className="role-permission-grid">
              {group.perms.map((permission) => {
                const enabled = value[permission.key] === true;
                return (
                  <div key={permission.key} className={`role-permission-card${enabled ? " enabled" : ""}${permission.danger ? " danger" : ""}`}>
                    <span className="role-permission-card-copy">
                      <strong>{permission.label}</strong>
                      <small>{permission.desc}{permission.danger ? " · Enable individually" : ""}</small>
                    </span>
                    <div className="role-permission-choice" role="group" aria-label={`${permission.label} permission`}>
                      <button
                        type="button"
                        disabled={disabled}
                        aria-label={`${permission.label} permission On`}
                        aria-pressed={enabled}
                        onClick={() => onChange?.({ ...value, [permission.key]: true })}
                      >
                        {enabled && <Check size={11} />} On
                      </button>
                      <button
                        type="button"
                        disabled={disabled}
                        aria-label={`${permission.label} permission Off`}
                        aria-pressed={!enabled}
                        onClick={() => onChange?.({ ...value, [permission.key]: false })}
                      >
                        Off
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
      {!groups.length && <p className="role-permission-empty">No permissions match that search.</p>}
      <style>{`.role-permission-cards{display:flex;flex-direction:column;gap:15px}.role-permission-summary,.role-permission-group>header{display:flex;align-items:center;justify-content:space-between;gap:9px}.role-permission-summary>div,.role-permission-group>header>div:first-child{display:flex;align-items:center;gap:7px;min-width:0}.role-permission-summary strong,.role-permission-group>header strong{color:var(--text,#eef4ee);font-size:calc((12px) + 1px)}.role-permission-summary>div>span,.role-permission-group>header>div>span{color:var(--text-secondary,#8ea08f);font-size:calc((9px) + 1px);white-space:nowrap}.role-permission-search{display:flex;align-items:center;gap:6px;width:min(210px,52%);padding:7px 8px;border:1px solid var(--surface-border,rgba(255,255,255,.1));border-radius:8px;background:var(--surface,rgba(0,0,0,.16));color:var(--text-secondary,#8ea08f)}.role-permission-search input{width:100%;min-width:0;border:0;outline:0;background:transparent;color:var(--text,#eef4ee);font:inherit;font-size:calc((10px) + 1px)}.role-permission-search input::placeholder{color:var(--text-secondary,#8ea08f)}.role-permission-group{display:grid;gap:8px}.role-permission-group>header{flex-wrap:wrap;padding:0 2px}.role-permission-group-actions{display:inline-flex!important;flex-wrap:nowrap!important;align-items:center;gap:3px;flex-shrink:0;padding:3px;border:1px solid var(--surface-border,rgba(255,255,255,.12));border-radius:9px;background:rgba(0,0,0,.18)}.role-permission-group-actions button{min-width:86px;white-space:nowrap;padding:6px 8px;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--text-secondary,#9aa39c);font:700 9px inherit;cursor:pointer}.role-permission-group-actions button:first-child[aria-pressed=true]{border-color:rgba(156,255,0,.25);background:rgba(156,255,0,.1);color:var(--accent,#bafa72)}.role-permission-group-actions button:last-child[aria-pressed=true]{border-color:rgba(255,255,255,.13);background:rgba(255,255,255,.08);color:var(--text,#eef4ee)}.role-permission-group-actions button:disabled{opacity:.48;cursor:not-allowed}.role-permission-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,235px),1fr));gap:7px}.role-permission-card{min-height:64px;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 11px;border:1px solid var(--surface-border,rgba(255,255,255,.1));border-radius:10px;background:linear-gradient(135deg,rgba(22,27,24,.96),rgba(13,15,14,.96));color:var(--text,#eef4ee);transition:border-color .15s,background .15s}.role-permission-card.enabled{border-color:var(--accent-border,rgba(156,255,0,.38));background:linear-gradient(135deg,rgba(156,255,0,.12),rgba(18,22,19,.96))}.role-permission-card.danger{border-color:rgba(255,107,107,.25)}.role-permission-card.danger.enabled{border-color:rgba(255,107,107,.48);background:linear-gradient(135deg,rgba(255,107,107,.14),rgba(18,22,19,.96))}.role-permission-card-copy{display:grid;gap:4px;min-width:0}.role-permission-card-copy strong{font-size:calc((10px) + 1px);line-height:1.3}.role-permission-card-copy small{color:var(--text-secondary,#8ea08f);font-size:calc((9px) + 1px);line-height:1.35}.role-permission-card.enabled .role-permission-card-copy strong{color:var(--accent,#caff9a)}.role-permission-card.danger.enabled .role-permission-card-copy strong{color:#ffaaaa}.role-permission-choice{display:inline-flex;align-items:center;gap:2px;flex-shrink:0;padding:3px;border:1px solid var(--surface-border,rgba(255,255,255,.12));border-radius:8px;background:rgba(0,0,0,.2)}.role-permission-choice button{min-width:39px;display:inline-flex;align-items:center;justify-content:center;gap:3px;padding:5px 6px;border:1px solid transparent;border-radius:5px;background:transparent;color:var(--text-secondary,#9aa39c);font:800 9px inherit;cursor:pointer}.role-permission-choice button:first-child[aria-pressed=true]{border-color:rgba(156,255,0,.25);background:rgba(156,255,0,.11);color:var(--accent,#caff9a)}.role-permission-card.danger .role-permission-choice button:first-child[aria-pressed=true]{border-color:rgba(255,107,107,.38);background:rgba(255,107,107,.13);color:#ff9e9e}.role-permission-choice button:last-child[aria-pressed=true]{border-color:rgba(255,255,255,.13);background:rgba(255,255,255,.09);color:var(--text,#eef4ee)}.role-permission-choice button:disabled{cursor:default}.role-permission-choice button:focus-visible,.role-permission-group-actions button:focus-visible{outline:2px solid var(--accent,#9cff00);outline-offset:2px}.role-permission-empty{margin:0;color:var(--text-secondary,#8ea08f);font-size:calc((10px) + 1px)}@media(max-width:520px){.role-permission-summary{align-items:flex-start;flex-direction:column}.role-permission-search{width:100%;box-sizing:border-box}.role-permission-grid{grid-template-columns:1fr}.role-permission-card{align-items:flex-start;flex-direction:column}.role-permission-choice{align-self:flex-end}.role-permission-group>header{align-items:flex-start;flex-direction:column}.role-permission-group-actions{align-self:stretch}.role-permission-group-actions button{flex:1}}`}</style>
    </div>
  );
}
