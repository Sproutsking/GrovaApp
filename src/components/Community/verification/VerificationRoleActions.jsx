import React, { useEffect, useRef, useState } from "react";
import { MoreVertical, Settings2, Trash2 } from "lucide-react";

export default function VerificationRoleActions({ role, canManage = false, onManageRole, onDeleteRole }) {
  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const rootRef = useRef(null);
  const protectedRole = role.is_default || role.name?.trim().toLowerCase() === "owner";

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
        setConfirmingDelete(false);
        setError("");
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        setConfirmingDelete(false);
        setError("");
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const deleteRole = async () => {
    if (!onDeleteRole || busy) return;
    setBusy(true);
    setError("");
    try {
      await onDeleteRole(role.id);
      setOpen(false);
      setConfirmingDelete(false);
    } catch (deleteError) {
      setError(deleteError.message || "Could not delete this role.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="verification-role-actions" ref={rootRef}>
      <button
        type="button"
        className="verification-role-actions-trigger"
        aria-label={`Actions for ${role.name} role`}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={!canManage}
        onClick={() => {
          setOpen((current) => !current);
          setConfirmingDelete(false);
          setError("");
        }}
      >
        <MoreVertical size={15} />
      </button>
      {open && (
        <div className="verification-role-actions-menu" role="menu" aria-label={`${role.name} role actions`}>
          {confirmingDelete ? (
            <div className="verification-role-delete-confirm">
              <strong>Delete {role.name}?</strong>
              <small>This cannot be undone.</small>
              {error && <small className="verification-role-action-error" role="alert">{error}</small>}
              <div>
                <button type="button" role="menuitem" disabled={busy} onClick={() => setConfirmingDelete(false)}>Cancel</button>
                <button type="button" role="menuitem" className="danger" disabled={busy} onClick={deleteRole}>{busy ? "Deleting…" : "Delete role"}</button>
              </div>
            </div>
          ) : (
            <>
              {onManageRole && (
                <button type="button" role="menuitem" onClick={() => { setOpen(false); onManageRole(role.id); }}>
                  <Settings2 size={13} /> Manage role
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                className="danger"
                disabled={protectedRole || !onDeleteRole}
                title={protectedRole ? "Default and owner roles are protected" : undefined}
                onClick={() => { setConfirmingDelete(true); setError(""); }}
              >
                <Trash2 size={13} /> Delete role
              </button>
              {protectedRole && <small className="verification-role-action-hint">Default and owner roles are protected.</small>}
            </>
          )}
        </div>
      )}
      <style>{`.verification-role-actions{position:relative;flex-shrink:0;margin-left:auto}.verification-role-actions-trigger{display:grid;place-items:center;width:28px;height:28px;border:1px solid transparent;border-radius:7px;background:transparent;color:var(--text-secondary);cursor:pointer}.verification-role-actions-trigger:hover,.verification-role-actions-trigger[aria-expanded=true]{border-color:var(--surface-border);background:var(--surface-strong);color:var(--text)}.verification-role-actions-trigger:disabled{opacity:.45;cursor:not-allowed}.verification-role-actions-menu{position:absolute;z-index:25;top:calc(100% + 4px);right:0;width:184px;display:grid;gap:3px;padding:5px;border:1px solid var(--surface-border);border-radius:9px;background:var(--surface-strong,#171a18);box-shadow:0 8px 24px rgba(0,0,0,.3)}.verification-role-actions-menu>button{display:flex;align-items:center;gap:7px;width:100%;padding:7px 8px;border:0;border-radius:6px;background:transparent;color:var(--text);font:600 10px inherit;text-align:left;cursor:pointer}.verification-role-actions-menu>button:hover{background:var(--surface);color:var(--accent)}.verification-role-actions-menu>button.danger{color:#ff8b8b}.verification-role-actions-menu>button:disabled{opacity:.45;cursor:not-allowed}.verification-role-action-hint{padding:3px 8px 5px;color:var(--text-secondary);font-size:8px;line-height:1.4}.verification-role-delete-confirm{display:grid;gap:5px;padding:5px}.verification-role-delete-confirm strong{color:var(--text);font-size:10px}.verification-role-delete-confirm small{color:var(--text-secondary);font-size:8px}.verification-role-delete-confirm>div{display:flex;justify-content:flex-end;gap:5px;margin-top:3px}.verification-role-delete-confirm>div button{padding:5px 7px;border:1px solid var(--surface-border);border-radius:5px;background:var(--surface);color:var(--text);font:700 8px inherit;cursor:pointer}.verification-role-delete-confirm>div button.danger{border-color:rgba(255,107,107,.3);background:rgba(255,107,107,.1);color:#ff8b8b}.verification-role-delete-confirm>div button:disabled{opacity:.5;cursor:not-allowed}.verification-role-delete-confirm .verification-role-action-error{color:var(--danger)}`}</style>
    </div>
  );
}
