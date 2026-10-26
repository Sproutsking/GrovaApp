import React, { useEffect, useState } from "react";
import { Check, Save } from "lucide-react";
import RoleAccessPanel from "../components/sections/RoleAccessPanel";
import RolePermissionCards from "../components/sections/RolePermissionCards";

export default function RoleAccessReview({
  role,
  communityId,
  roles = [],
  canManage = false,
  onUpdateRole,
}) {
  const [permissions, setPermissions] = useState(role.permissions || {});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setPermissions(role.permissions || {});
    setSaved(false);
    setError("");
  }, [role.id, role.permissions]);

  const savePermissions = async () => {
    if (!canManage || !onUpdateRole || saving) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await onUpdateRole(role.id, { permissions });
      setSaved(true);
    } catch (saveError) {
      setError(saveError.message || "Could not save role permissions.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="verification-role-review" aria-label={`${role.name} permissions and channel access`}>
      <div className="verification-role-review-heading">
        <div>
          <strong><Check size={13} /> Role capabilities</strong>
          <span>These same role permissions are editable in Roles &amp; Permissions.</span>
        </div>
        <button
          type="button"
          disabled={!canManage || saving}
          onClick={savePermissions}
          aria-label="Save role permissions"
        >
          {saving ? "Saving..." : saved ? <><Check size={12} /> Saved</> : <><Save size={12} /> Save</>}
        </button>
      </div>
      <p className="verification-role-review-safety">Keep verification roles free of management privileges. Roles with administrator, role, channel, or community management access cannot be offered as member verification rewards.</p>
      <RolePermissionCards
        value={permissions}
        onChange={(next) => {
          setPermissions(next);
          setSaved(false);
        }}
        disabled={!canManage || saving}
      />
      {error && <p className="verification-role-review-error" role="alert">{error}</p>}
      <div className="verification-role-channel-access">
        <div className="verification-role-review-heading">
          <div>
            <strong>Channel access</strong>
            <span>Set whether this role can view or post in each channel. Changes save immediately.</span>
          </div>
        </div>
        {communityId ? (
          <RoleAccessPanel
            communityId={communityId}
            role={{ ...role, permissions }}
            roles={roles}
            canManage={canManage}
          />
        ) : (
          <p className="verification-role-review-error">Channel permissions are unavailable without a community.</p>
        )}
      </div>
      <style>{`.verification-role-review{display:grid;gap:14px;padding:12px;border:1px solid var(--surface-border);border-radius:10px;background:rgba(0,0,0,.18)}.verification-role-review-heading{display:flex;align-items:center;justify-content:space-between;gap:10px}.verification-role-review-heading>div{display:grid;gap:4px}.verification-role-review-heading strong{display:flex;align-items:center;gap:6px;color:var(--text);font-size:11px}.verification-role-review-heading strong svg{color:var(--accent)}.verification-role-review-heading span{color:var(--text-secondary);font-size:9px;line-height:1.4}.verification-role-review-heading>button{display:flex;align-items:center;gap:5px;flex-shrink:0;padding:6px 9px;border:1px solid var(--accent-border);border-radius:7px;background:var(--accent-bg);color:var(--accent);font:700 9px inherit;cursor:pointer}.verification-role-review-heading>button:disabled{opacity:.55;cursor:not-allowed}.verification-role-review-safety{margin:0;padding:8px 9px;border:1px solid rgba(255,190,92,.22);border-radius:8px;background:rgba(255,190,92,.06);color:#eac88e;font-size:9px;line-height:1.45}.verification-role-channel-access{display:grid;gap:10px;padding-top:13px;border-top:1px solid var(--surface-border)}.verification-role-review-error{margin:0;color:var(--danger);font-size:10px}`}</style>
    </section>
  );
}
