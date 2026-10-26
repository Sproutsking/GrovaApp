import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { MoreVertical, Settings2, Trash2 } from "lucide-react";

export default function VerificationRoleActions({ role, canManage = false, onManageRole, onDeleteRole }) {
  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [menuPosition, setMenuPosition] = useState({ top: 8, left: 8 });
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const protectedRole = role.is_default || role.name?.trim().toLowerCase() === "owner";

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) {
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

  const toggleMenu = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const width = 208;
    const height = protectedRole ? 120 : 100;
    const below = rect.bottom + height + 8 <= window.innerHeight;
    setMenuPosition({
      top: below ? rect.bottom + 5 : Math.max(8, rect.top - height - 5),
      left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)),
    });
    setOpen((current) => !current);
    setConfirmingDelete(false);
    setError("");
  };

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
    <>
      <div className="verification-role-actions" ref={rootRef}>
        <button
          type="button"
          className="verification-role-actions-trigger"
          aria-label={`Actions for ${role.name} role`}
          aria-haspopup="menu"
          aria-expanded={open}
          disabled={!canManage}
          onClick={toggleMenu}
        >
          <MoreVertical size={15} />
        </button>
      </div>
      {open && ReactDOM.createPortal(
        <div
          ref={menuRef}
          className="verification-role-actions-menu"
          role="menu"
          aria-label={`${role.name} role actions`}
          style={{ top: menuPosition.top, left: menuPosition.left }}
          onClick={(event) => event.stopPropagation()}
        >
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
              {onManageRole && <button type="button" role="menuitem" onClick={() => { setOpen(false); onManageRole(role.id); }}><Settings2 size={14} /> Manage role</button>}
              <button type="button" role="menuitem" className="danger" disabled={protectedRole || !onDeleteRole} title={protectedRole ? "Default and owner roles are protected" : undefined} onClick={() => { setConfirmingDelete(true); setError(""); }}><Trash2 size={14} /> Delete role</button>
              {protectedRole && <small className="verification-role-action-hint">Default and owner roles are protected.</small>}
            </>
          )}
        </div>,
        document.body,
      )}
      <style>{`.verification-role-actions{position:relative;flex-shrink:0;margin-left:auto}.verification-role-actions-trigger{display:grid;place-items:center;width:28px;height:28px;border:1px solid transparent;border-radius:7px;background:transparent;color:var(--text-secondary);cursor:pointer}.verification-role-actions-trigger:hover,.verification-role-actions-trigger[aria-expanded=true]{border-color:var(--surface-border);background:var(--surface-strong);color:var(--text)}.verification-role-actions-trigger:disabled{opacity:.45;cursor:not-allowed}.verification-role-actions-menu{position:fixed;z-index:100110;width:208px;display:grid;gap:4px;padding:7px;border:1px solid rgba(156,255,0,.28);border-radius:9px;background:#111611;color:#edf2e9;box-shadow:0 16px 42px rgba(0,0,0,.72)}.verification-role-actions-menu>button{display:flex;align-items:center;gap:8px;width:100%;min-height:36px;padding:8px 9px;border:0;border-radius:6px;background:transparent;color:#edf2e9;font:600 11px inherit;text-align:left;cursor:pointer}.verification-role-actions-menu>button:hover{background:#20271f;color:#c8ff78}.verification-role-actions-menu>button.danger{color:#ff9b9b}.verification-role-actions-menu>button:disabled{opacity:.55;cursor:not-allowed}.verification-role-action-hint{padding:4px 9px;color:#afb8ac;font-size:9px;line-height:1.4}.verification-role-delete-confirm{display:grid;gap:7px;padding:7px}.verification-role-delete-confirm strong{color:#f1f5ee;font-size:12px}.verification-role-delete-confirm small{color:#b0baad;font-size:10px}.verification-role-delete-confirm>div{display:flex;justify-content:flex-end;gap:6px;margin-top:4px}.verification-role-delete-confirm>div button{padding:7px 9px;border:1px solid rgba(255,255,255,.12);border-radius:6px;background:#1a201a;color:#e7ece3;font:700 10px inherit;cursor:pointer}.verification-role-delete-confirm>div button.danger{border-color:rgba(255,107,107,.35);background:rgba(255,107,107,.12);color:#ff9b9b}.verification-role-action-error{color:#ff9b9b!important}`}</style>
    </>
  );
}