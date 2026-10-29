import React, { useState } from "react";
import { Plus } from "lucide-react";

export default function CreateVerificationRoleControl({ disabled = false, onCreateRole, onCreated }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const create = async (event) => {
    event.preventDefault();
    const roleName = name.trim();
    if (!roleName || !onCreateRole) return;
    setBusy(true);
    setError("");
    try {
      const role = await onCreateRole(roleName);
      if (!role?.id) throw new Error("The role was created but could not be loaded. Refresh roles and try again.");
      onCreated?.(role);
      setName("");
      setOpen(false);
    } catch (createError) {
      setError(createError.message || "Could not create a role.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="verification-role-create">
      {!open ? (
        <button type="button" disabled={disabled || !onCreateRole} onClick={() => setOpen(true)}>
          <Plus size={13} /> Create a safe role
        </button>
      ) : (
        <form onSubmit={create}>
          <label>
            New role name
            <input autoFocus value={name} maxLength={40} onChange={(event) => setName(event.target.value)} placeholder="e.g. Verified member" disabled={busy} />
          </label>
          <button type="submit" disabled={busy || !name.trim()}>{busy ? "Creating..." : "Create role"}</button>
          <button type="button" disabled={busy} onClick={() => { setOpen(false); setError(""); }}>Cancel</button>
        </form>
      )}
      <p>Created with no management permissions and placed above the default member role for verification access.</p>
      {error && <div role="alert">{error}</div>}
      <style>{`.verification-role-create{display:grid;gap:5px}.verification-role-create>button,.verification-role-create form button{display:inline-flex;align-items:center;justify-content:center;gap:5px;width:max-content;padding:6px 9px;border:1px solid var(--accent-border);border-radius:7px;background:var(--accent-bg);color:var(--accent);font:700 10px inherit;cursor:pointer}.verification-role-create>button:disabled,.verification-role-create form button:disabled{opacity:.55;cursor:not-allowed}.verification-role-create form{display:flex;flex-wrap:wrap;align-items:flex-end;gap:6px}.verification-role-create form label{display:grid;gap:4px;color:var(--text-secondary);font-size:calc((10px) + 1px)}.verification-role-create form input{min-width:190px;padding:7px;border:1px solid var(--surface-border);border-radius:7px;background:var(--surface);color:var(--text);font:inherit}.verification-role-create>p{margin:0;color:var(--text-secondary);font-size:calc((9px) + 1px);line-height:1.4}.verification-role-create [role=alert]{color:var(--danger);font-size:calc((10px) + 1px)}`}</style>
    </div>
  );
}
