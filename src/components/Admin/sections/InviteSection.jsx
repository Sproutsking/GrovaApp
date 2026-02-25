// =============================================================================
// src/components/Admin/sections/InviteSection.jsx
// Admin invite management — black + lime platform colors
// Self-contained. Zero mock data. Metadata-only pricing (no missing DB columns).
// =============================================================================

import React, { useState, useCallback, useEffect } from "react";
import { useInvites } from "../useAdminData";

const CATEGORY_OPTIONS = [
  { value: "community", label: "Community" },
  { value: "user", label: "User" },
  { value: "vip", label: "VIP" },
];

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtCents(cents) {
  if (cents == null) return "—";
  if (cents === 0) return "Free";
  return `$${(cents / 100).toFixed(2)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// WaitlistModal
// ─────────────────────────────────────────────────────────────────────────────
function WaitlistModal({
  invite,
  getDisplayName,
  getWaitlistEntries,
  promoteWaitlist,
  updateWaitlistOpenTime,
  onClose,
}) {
  const [entries, setEntries] = useState([]);
  const [loadingWL, setLoadingWL] = useState(true);
  const [promoting, setPromoting] = useState(false);
  const [promoteCount, setPromoteCount] = useState("");
  const [opensAt, setOpensAt] = useState(
    invite.whitelist_opens_at ? invite.whitelist_opens_at.slice(0, 16) : "",
  );
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    setLoadingWL(true);
    try {
      setEntries(await getWaitlistEntries(invite.id));
    } catch (e) {
      setMsg({ type: "error", text: e.message });
    } finally {
      setLoadingWL(false);
    }
  }, [invite.id, getWaitlistEntries]);

  useEffect(() => {
    load();
  }, [load]);

  const waiting = entries.filter((e) => e.status === "waiting");
  const whitelisted = entries.filter((e) => e.status === "whitelisted");
  const wlPrice =
    invite.whitelist_price_cents ??
    invite.metadata?.whitelist_price_cents ??
    null;
  const isFree = wlPrice === 0;

  async function handlePromote(rawN) {
    const n = Number(rawN);
    if (!n || n < 1) {
      setMsg({ type: "error", text: "Enter a valid count." });
      return;
    }
    setPromoting(true);
    setMsg(null);
    try {
      let adminId = null;
      try {
        const { supabase } = await import("../../../services/config/supabase");
        const {
          data: { user },
        } = await supabase.auth.getUser();
        adminId = user?.id ?? null;
      } catch (_) {}
      const count = await promoteWaitlist(invite.id, n, adminId);
      setMsg({
        type: "success",
        text: `✓ Promoted ${count} user${count !== 1 ? "s" : ""}.`,
      });
      setPromoteCount("");
      await load();
    } catch (e) {
      setMsg({ type: "error", text: e.message });
    } finally {
      setPromoting(false);
    }
  }

  async function handleSaveTime() {
    setMsg(null);
    try {
      await updateWaitlistOpenTime(
        invite.id,
        opensAt ? new Date(opensAt).toISOString() : null,
      );
      setMsg({ type: "success", text: "Open time saved." });
    } catch (e) {
      setMsg({ type: "error", text: e.message });
    }
  }

  const inviteName = invite.invite_name || invite.metadata?.invite_name || "";

  return (
    <div className="xv-overlay" onClick={onClose}>
      <div className="xv-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="xv-modal-hdr">
          <div>
            <h2 className="xv-modal-ttl">Waitlist Control Panel</h2>
            <div className="xv-modal-meta">
              <code className="xv-chip">{invite.code}</code>
              {inviteName && (
                <span className="xv-modal-name">{inviteName}</span>
              )}
              <span className="xv-modal-cat">{getDisplayName(invite)}</span>
              <span className="xv-modal-price">
                WL price:{" "}
                <strong style={{ color: isFree ? "#84cc16" : "#a5b4fc" }}>
                  {fmtCents(wlPrice)}
                </strong>
              </span>
            </div>
          </div>
          <button className="xv-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Stats */}
        <div className="xv-stats-row">
          {[
            { n: waiting.length, l: "Waiting", c: "#f59e0b" },
            { n: whitelisted.length, l: "Whitelisted", c: "#84cc16" },
            { n: entries.length, l: "Total", c: "#64748b" },
          ].map(({ n, l, c }) => (
            <div key={l} className="xv-stat-card" style={{ borderTopColor: c }}>
              <span className="xv-stat-n" style={{ color: c }}>
                {n}
              </span>
              <span className="xv-stat-l">{l}</span>
            </div>
          ))}
        </div>

        {/* Promotion */}
        {waiting.length > 0 && (
          <div className="xv-box">
            <h3 className="xv-box-ttl">Promote Users</h3>
            {isFree ? (
              <p className="xv-muted" style={{ color: "#84cc16" }}>
                ✓ Free whitelist — promoted users activate immediately, no
                payment needed.
              </p>
            ) : (
              <p className="xv-muted">
                Promoted users pay{" "}
                <strong style={{ color: "#84cc16" }}>
                  {fmtCents(wlPrice)}
                </strong>{" "}
                on their next visit to complete activation.
              </p>
            )}
            <div className="xv-promote-row">
              <button
                className="xv-btn xv-lime"
                disabled={promoting}
                onClick={() => handlePromote(waiting.length)}
              >
                {promoting ? "Promoting…" : `Whitelist All (${waiting.length})`}
              </button>
              <div
                style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}
              >
                <input
                  type="number"
                  min="1"
                  max={waiting.length}
                  placeholder="N"
                  value={promoteCount}
                  onChange={(e) => setPromoteCount(e.target.value)}
                  className="xv-inp-sm"
                  style={{ width: 64 }}
                />
                <button
                  className="xv-btn xv-outline"
                  disabled={promoting || !promoteCount}
                  onClick={() => handlePromote(promoteCount)}
                >
                  Whitelist {promoteCount || "N"}
                </button>
              </div>
            </div>
            <p
              className="xv-muted"
              style={{ marginTop: "0.5rem", color: "#475569" }}
            >
              FIFO — earliest joiners promoted first.
            </p>
          </div>
        )}

        {/* Re-open time */}
        <div className="xv-box">
          <h3 className="xv-box-ttl">Estimated Re-open Time</h3>
          <p className="xv-muted">Shown to waitlisted users while they wait.</p>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input
              type="datetime-local"
              value={opensAt}
              onChange={(e) => setOpensAt(e.target.value)}
              className="xv-inp-sm"
            />
            <button className="xv-btn xv-outline" onClick={handleSaveTime}>
              Save
            </button>
          </div>
        </div>

        {msg && <div className={`xv-msg ${msg.type}`}>{msg.text}</div>}

        {/* Waiting table */}
        <div>
          <h3 className="xv-box-ttl">Waiting Queue ({waiting.length})</h3>
          {loadingWL ? (
            <p className="xv-muted">Loading…</p>
          ) : waiting.length === 0 ? (
            <p className="xv-muted" style={{ color: "#334155" }}>
              No users in queue.
            </p>
          ) : (
            <div className="xv-tbl-wrap">
              <table className="xv-tbl">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Authenticated</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {waiting.map((e, i) => (
                    <tr key={e.id}>
                      <td className="xv-td-pos">{e.position ?? i + 1}</td>
                      <td>{e.full_name || "—"}</td>
                      <td className="xv-td-mono">{e.email || "—"}</td>
                      <td className={e.authenticated_at ? "xv-yes" : "xv-no"}>
                        {e.authenticated_at
                          ? `✓ ${fmtDate(e.authenticated_at)}`
                          : "Pending sign-in"}
                      </td>
                      <td style={{ fontSize: "0.78rem", color: "#64748b" }}>
                        {fmtDate(e.joined_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {whitelisted.length > 0 && (
            <>
              <h3 className="xv-box-ttl" style={{ marginTop: "1.5rem" }}>
                Whitelisted ({whitelisted.length})
              </h3>
              <div className="xv-tbl-wrap">
                <table className="xv-tbl">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Activated</th>
                      <th>Promoted At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {whitelisted.map((e) => (
                      <tr key={e.id} className="xv-wl-row">
                        <td>{e.full_name || "—"}</td>
                        <td className="xv-td-mono">{e.email || "—"}</td>
                        <td
                          className={e.account_activated ? "xv-yes" : "xv-no"}
                        >
                          {e.account_activated ? "✓ Active" : "Pending payment"}
                        </td>
                        <td style={{ fontSize: "0.78rem", color: "#64748b" }}>
                          {fmtDate(e.whitelisted_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="xv-modal-footer">
          <button className="xv-btn xv-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      <style>{MODAL_CSS}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CreateInviteForm
// ─────────────────────────────────────────────────────────────────────────────
function CreateInviteForm({ onCreate, onCancel }) {
  const [inviteName, setInviteName] = useState("");
  const [category, setCategory] = useState("community");
  const [customLabel, setCustomLabel] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [code, setCode] = useState("");
  const [maxUses, setMaxUses] = useState(100);
  const [entryPriceCents, setEntryPriceCents] = useState(400);
  const [whitelistPriceCents, setWhitelistPriceCents] = useState(0);
  const [expiresAt, setExpiresAt] = useState("");
  const [batchSize, setBatchSize] = useState(50);
  const [opensAt, setOpensAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function generateCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let c = "";
    for (let i = 0; i < 8; i++)
      c += chars[Math.floor(Math.random() * chars.length)];
    setCode(c);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!code.trim()) {
      setError("Enter or generate an invite code.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onCreate({
        invite_name: inviteName.trim(),
        code: code.trim().toUpperCase(),
        invite_category: showCustomInput ? "custom" : category,
        invite_label_custom: showCustomInput ? customLabel.trim() : null,
        max_uses: Number(maxUses),
        entry_price_cents: Number(entryPriceCents),
        whitelist_price_cents: Number(whitelistPriceCents),
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        waitlist_batch_size: Number(batchSize),
        whitelist_opens_at: opensAt ? new Date(opensAt).toISOString() : null,
      });
      onCancel();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="xv-create-wrap">
      <h3 className="xv-form-ttl">Create New Invite</h3>

      <div className="xv-info-box">
        <span style={{ color: "#84cc16" }}>⚡</span>&nbsp;
        <strong style={{ color: "#e2ffa0" }}>Payment integration:</strong>&nbsp;
        <span style={{ color: "#94a3b8" }}>
          The <em style={{ color: "#e2e8f0" }}>Public Price</em> is exactly what
          users are charged (Paystack or Web3) when they authenticate via this
          link. Once full, the waitlist activates automatically. Promoted users
          pay the&nbsp;
          <em style={{ color: "#e2e8f0" }}>Whitelist Price</em> (or activate
          free if 0).
        </span>
      </div>

      <form onSubmit={handleSubmit} className="xv-form">
        {/* Invite name */}
        <div className="xv-frow">
          <label className="xv-lbl">
            Invite Name{" "}
            <span className="xv-optional">(helps you identify it)</span>
          </label>
          <input
            className="xv-inp"
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
            placeholder="e.g. Lagos Community Wave 1, VIP Early Access…"
          />
        </div>

        {/* Code */}
        <div className="xv-frow">
          <label className="xv-lbl">Invite Code</label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              className="xv-inp"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
              }
              placeholder="e.g. XEEVIA24"
              required
              maxLength={20}
            />
            <button
              type="button"
              className="xv-btn xv-ghost xv-sm"
              onClick={generateCode}
            >
              Generate
            </button>
          </div>
        </div>

        {/* Category */}
        <div className="xv-frow">
          <label className="xv-lbl">Category</label>
          <div className="xv-cat-row">
            {CATEGORY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`xv-cat ${!showCustomInput && category === opt.value ? "active" : ""}`}
                onClick={() => {
                  setCategory(opt.value);
                  setShowCustomInput(false);
                }}
              >
                {opt.label}
              </button>
            ))}
            <button
              type="button"
              className={`xv-cat xv-cat-dashed ${showCustomInput ? "active" : ""}`}
              onClick={() => setShowCustomInput(true)}
            >
              ＋ Custom
            </button>
          </div>
          {showCustomInput && (
            <input
              className="xv-inp"
              style={{ marginTop: "0.5rem" }}
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="Custom category name…"
              required={showCustomInput}
              autoFocus
            />
          )}
        </div>

        {/* Pricing */}
        <div className="xv-2col">
          <div className="xv-fcol">
            <label className="xv-lbl">
              Public Price <span className="xv-optional">(cents)</span>
            </label>
            <input
              type="number"
              min="0"
              step="1"
              className="xv-inp"
              value={entryPriceCents}
              onChange={(e) =>
                setEntryPriceCents(Math.max(0, parseInt(e.target.value) || 0))
              }
            />
            <span className="xv-hint">
              <span className="xv-lime-text">
                {fmtCents(Number(entryPriceCents))}
              </span>
              &nbsp;· charged when users authenticate via this link
            </span>
          </div>
          <div className="xv-fcol">
            <label className="xv-lbl">
              Whitelist Price <span className="xv-optional">(cents)</span>
            </label>
            <input
              type="number"
              min="0"
              step="1"
              className="xv-inp"
              value={whitelistPriceCents}
              onChange={(e) =>
                setWhitelistPriceCents(
                  Math.max(0, parseInt(e.target.value) || 0),
                )
              }
            />
            <span className="xv-hint">
              <span className="xv-lime-text">
                {fmtCents(Number(whitelistPriceCents))}
              </span>
              &nbsp;·&nbsp;
              {Number(whitelistPriceCents) === 0
                ? "free (instant activation on promote)"
                : "paid after promotion"}
            </span>
          </div>
        </div>

        {/* Slots + batch */}
        <div className="xv-2col">
          <div className="xv-fcol">
            <label className="xv-lbl">Max Public Entries</label>
            <input
              type="number"
              min="1"
              className="xv-inp"
              value={maxUses}
              onChange={(e) =>
                setMaxUses(Math.max(1, parseInt(e.target.value) || 1))
              }
            />
            <span className="xv-hint">
              Waitlist auto-enables when this fills
            </span>
          </div>
          <div className="xv-fcol">
            <label className="xv-lbl">Default Promo Batch</label>
            <input
              type="number"
              min="1"
              className="xv-inp"
              value={batchSize}
              onChange={(e) =>
                setBatchSize(Math.max(1, parseInt(e.target.value) || 1))
              }
            />
            <span className="xv-hint">
              Suggested count for each promotion round
            </span>
          </div>
        </div>

        {/* Dates */}
        <div className="xv-2col">
          <div className="xv-fcol">
            <label className="xv-lbl">
              Expires At <span className="xv-optional">(optional)</span>
            </label>
            <input
              type="datetime-local"
              className="xv-inp"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
          <div className="xv-fcol">
            <label className="xv-lbl">
              Est. Whitelist Open{" "}
              <span className="xv-optional">(optional)</span>
            </label>
            <input
              type="datetime-local"
              className="xv-inp"
              value={opensAt}
              onChange={(e) => setOpensAt(e.target.value)}
            />
            <span className="xv-hint">Shown to waitlisted users</span>
          </div>
        </div>

        {error && <div className="xv-err">{error}</div>}

        <div className="xv-form-actions">
          <button type="button" className="xv-btn xv-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="xv-btn xv-lime" disabled={saving}>
            {saving ? "Creating…" : "Create Invite"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// InviteCard
// ─────────────────────────────────────────────────────────────────────────────
function InviteCard({
  invite,
  displayName,
  onWaitlistClick,
  onToggle,
  onDelete,
}) {
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const uses = invite.uses_count ?? 0;
  const max = invite.max_uses ?? 1;
  const isFull = uses >= max;
  const isActive = invite.is_active;
  const pct = Math.min(100, max > 0 ? (uses / max) * 100 : 0);

  const waitlistCount =
    invite.metadata?.waitlist_count ??
    invite.metadata?.waitlist_entries?.length ??
    0;

  const entryPriceCents =
    invite.entry_price_cents ??
    (invite.entry_price != null
      ? Math.round(Number(invite.entry_price) * 100)
      : null);
  const wlPriceCents =
    invite.whitelist_price_cents ??
    invite.metadata?.whitelist_price_cents ??
    null;

  const inviteName = invite.invite_name || invite.metadata?.invite_name || "";

  async function handleToggle() {
    setToggling(true);
    try {
      await onToggle(invite.id, !isActive);
    } catch (e) {
      alert(e.message);
    } finally {
      setToggling(false);
    }
  }

  async function handleDelete() {
    if (
      !window.confirm(
        `Delete invite "${invite.code}"${inviteName ? ` (${inviteName})` : ""}? Cannot be undone.`,
      )
    )
      return;
    setDeleting(true);
    try {
      await onDelete(invite.id);
    } catch (e) {
      alert(e.message);
      setDeleting(false);
    }
  }

  // Progress color
  const progColor = pct >= 100 ? "#ef4444" : pct > 75 ? "#f59e0b" : "#84cc16";

  return (
    <div className={`xv-card ${!isActive ? "xv-card-off" : ""}`}>
      {/* Header */}
      <div className="xv-card-hdr">
        <div className="xv-card-left">
          <code className="xv-code-chip">{invite.code}</code>
          {inviteName && <span className="xv-invite-name">{inviteName}</span>}
          <span
            className={`xv-catbadge xv-cat-${invite.invite_category ?? "standard"}`}
          >
            {displayName}
          </span>
          {isFull && <span className="xv-pill xv-pill-full">Full</span>}
          {invite.enable_waitlist && (
            <span className="xv-pill xv-pill-wl">Waitlist On</span>
          )}
          {!isActive && <span className="xv-pill xv-pill-off">Inactive</span>}
          {invite.expires_at && new Date(invite.expires_at) < new Date() && (
            <span className="xv-pill xv-pill-exp">Expired</span>
          )}
        </div>
        <div style={{ display: "flex", gap: "0.2rem", flexShrink: 0 }}>
          <button
            className="xv-icon-btn"
            title={isActive ? "Deactivate" : "Activate"}
            onClick={handleToggle}
            disabled={toggling}
          >
            {toggling ? "…" : isActive ? "⏸" : "▶"}
          </button>
          <button
            className="xv-icon-btn xv-danger-icon"
            title="Delete"
            disabled={deleting}
            onClick={handleDelete}
          >
            🗑
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="xv-card-stats">
        <div className="xv-s">
          <span className="xv-sl">Entries</span>
          <span className="xv-sv">
            {uses}&nbsp;<span style={{ color: "#334155" }}>/</span>&nbsp;{max}
          </span>
          <div className="xv-prog-bar">
            <div
              className="xv-prog-fill"
              style={{ width: `${pct}%`, background: progColor }}
            />
          </div>
          <span
            style={{
              fontSize: "0.68rem",
              color: progColor,
              fontWeight: 700,
              marginTop: "2px",
            }}
          >
            {pct.toFixed(0)}%
          </span>
        </div>

        <div className="xv-s">
          <span className="xv-sl">Public Price</span>
          <span className="xv-sv xv-lime-text">
            {fmtCents(entryPriceCents)}
          </span>
        </div>

        <div className="xv-s">
          <span className="xv-sl">Whitelist Price</span>
          <span
            className="xv-sv"
            style={{ color: wlPriceCents === 0 ? "#84cc16" : "#a5b4fc" }}
          >
            {fmtCents(wlPriceCents)}
          </span>
        </div>

        <div className="xv-s">
          <span className="xv-sl">Expires</span>
          <span
            className="xv-sv"
            style={{ fontSize: "0.78rem", color: "#64748b" }}
          >
            {fmtDate(invite.expires_at)}
          </span>
        </div>
      </div>

      {/* Waitlist button */}
      <div className="xv-card-wl">
        <button
          className={`xv-wl-btn ${waitlistCount > 0 ? "xv-wl-active" : ""}`}
          onClick={() => onWaitlistClick(invite)}
        >
          <span>⏳</span>
          <span className="xv-wl-n">{waitlistCount}</span>
          <span>on waitlist</span>
          <span className="xv-wl-arrow">→</span>
        </button>
        {invite.whitelist_opens_at && (
          <span style={{ fontSize: "0.74rem", color: "#475569" }}>
            Opens: {fmtDate(invite.whitelist_opens_at)}
          </span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// InviteSection — main export
// ─────────────────────────────────────────────────────────────────────────────
export default function InviteSection() {
  const {
    invites,
    loading,
    error,
    refetch,
    createInvite,
    toggleInvite,
    deleteInvite,
    getWaitlistEntries,
    promoteWaitlist,
    updateWaitlistOpenTime,
    getInviteDisplayName,
  } = useInvites();

  const [showCreate, setShowCreate] = useState(false);
  const [waitlistTarget, setWaitlistTarget] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = invites.filter((inv) => {
    const q = search.toLowerCase();
    if (
      q &&
      !(
        (inv.code ?? "").toLowerCase().includes(q) ||
        (inv.invite_name ?? "").toLowerCase().includes(q) ||
        (inv.metadata?.invite_name ?? "").toLowerCase().includes(q) ||
        getInviteDisplayName(inv).toLowerCase().includes(q)
      )
    )
      return false;
    if (filter === "active") return inv.is_active && !inv.is_full;
    if (filter === "inactive") return !inv.is_active;
    if (filter === "full") return inv.is_full;
    return true;
  });

  const totalWaiting = invites.reduce(
    (s, inv) => s + (inv.metadata?.waitlist_count ?? 0),
    0,
  );

  return (
    <div className="xv-section">
      {/* Header */}
      <div className="xv-section-hdr">
        <div>
          <h2 className="xv-section-ttl">Invite Management</h2>
          <p className="xv-section-sub">
            {invites.length} invite{invites.length !== 1 ? "s" : ""}
            {totalWaiting > 0 && (
              <span className="xv-waiting-badge">
                ⏳ {totalWaiting} waiting
              </span>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button
            className="xv-btn xv-ghost xv-sm"
            onClick={refetch}
            title="Refresh"
          >
            ⟳ Refresh
          </button>
          <button
            className={`xv-btn ${showCreate ? "xv-ghost" : "xv-lime"}`}
            onClick={() => setShowCreate((v) => !v)}
          >
            {showCreate ? "✕ Cancel" : "＋ New Invite"}
          </button>
        </div>
      </div>

      {showCreate && (
        <CreateInviteForm
          onCreate={createInvite}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Filters */}
      <div className="xv-filterbar">
        <input
          className="xv-inp xv-srch"
          placeholder="Search code, name or category…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div style={{ display: "flex", gap: "0.3rem" }}>
          {["all", "active", "inactive", "full"].map((f) => (
            <button
              key={f}
              className={`xv-ftab ${filter === f ? "active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="xv-state">Loading invites…</div>}
      {error && <div className="xv-state xv-state-err">{error}</div>}
      {!loading && filtered.length === 0 && (
        <div className="xv-state xv-state-empty">
          {invites.length === 0
            ? "No invites yet — create one above."
            : "No invites match your search or filter."}
        </div>
      )}

      <div className="xv-list">
        {filtered.map((inv) => (
          <InviteCard
            key={inv.id}
            invite={inv}
            displayName={getInviteDisplayName(inv)}
            onWaitlistClick={setWaitlistTarget}
            onToggle={toggleInvite}
            onDelete={deleteInvite}
          />
        ))}
      </div>

      {waitlistTarget && (
        <WaitlistModal
          invite={waitlistTarget}
          getDisplayName={getInviteDisplayName}
          getWaitlistEntries={getWaitlistEntries}
          promoteWaitlist={promoteWaitlist}
          updateWaitlistOpenTime={updateWaitlistOpenTime}
          onClose={() => setWaitlistTarget(null)}
        />
      )}

      <style>{SECTION_CSS}</style>
    </div>
  );
}

// =============================================================================
// Platform CSS — black + lime (matches Xeevia's AuthWall / PaywallGate)
// =============================================================================
const SECTION_CSS = `
  /* ── Root ── */
  .xv-section   { padding:1.5rem; max-width:1100px; margin:0 auto; font-family:'DM Sans','Outfit',system-ui,sans-serif; color:#e2e8f0; }

  /* ── Section header ── */
  .xv-section-hdr   { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.5rem; }
  .xv-section-ttl   { font-size:1.45rem; font-weight:800; color:#f1f5f9; margin:0; letter-spacing:-0.3px; }
  .xv-section-sub   { font-size:0.84rem; color:#475569; margin-top:0.25rem; display:flex; align-items:center; gap:0.5rem; }
  .xv-waiting-badge { background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.25); color:#f59e0b; border-radius:20px; padding:0.1rem 0.55rem; font-size:0.75rem; font-weight:700; }

  /* ── Buttons ── */
  .xv-btn    { padding:0.5rem 1.1rem; border-radius:10px; font-size:0.88rem; font-weight:700; cursor:pointer; border:none; transition:all 0.15s; font-family:inherit; line-height:1; }
  .xv-lime   { background:linear-gradient(135deg,#a3e635,#5c9b0a); color:#071200; box-shadow:0 3px 14px rgba(132,204,22,0.18); }
  .xv-lime:hover:not(:disabled) { background:linear-gradient(135deg,#bef264,#72b811); }
  .xv-outline { background:transparent; color:#84cc16; border:1px solid rgba(132,204,22,0.35); }
  .xv-outline:hover:not(:disabled) { background:rgba(132,204,22,0.06); }
  .xv-ghost  { background:transparent; color:#64748b; border:1px solid rgba(255,255,255,0.08); }
  .xv-ghost:hover { background:rgba(255,255,255,0.04); color:#94a3b8; }
  .xv-sm     { padding:0.35rem 0.7rem; font-size:0.8rem; }
  .xv-btn:disabled { opacity:0.45; cursor:not-allowed; }

  /* ── Inputs ── */
  .xv-inp      { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.09); color:#f1f5f9; border-radius:10px; padding:0.52rem 0.8rem; font-size:0.88rem; width:100%; box-sizing:border-box; font-family:inherit; transition:border-color 0.15s; }
  .xv-inp:focus { outline:none; border-color:rgba(132,204,22,0.5); box-shadow:0 0 0 2px rgba(132,204,22,0.08); }
  .xv-inp::placeholder { color:#334155; }
  .xv-inp-sm   { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.09); color:#f1f5f9; border-radius:8px; padding:0.4rem 0.6rem; font-size:0.84rem; font-family:inherit; }

  /* ── Filter bar ── */
  .xv-filterbar { display:flex; gap:0.75rem; align-items:center; margin-bottom:1.25rem; flex-wrap:wrap; }
  .xv-srch      { max-width:280px; }
  .xv-ftab      { padding:0.28rem 0.8rem; border-radius:20px; font-size:0.78rem; font-weight:700; cursor:pointer; background:rgba(255,255,255,0.03); color:#475569; border:1px solid rgba(255,255,255,0.07); font-family:inherit; transition:all 0.15s; }
  .xv-ftab.active { background:rgba(132,204,22,0.1); color:#84cc16; border-color:rgba(132,204,22,0.35); }
  .xv-ftab:hover:not(.active) { color:#94a3b8; border-color:rgba(255,255,255,0.12); }

  /* ── Create form ── */
  .xv-create-wrap { background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.07); border-radius:14px; padding:1.5rem; margin-bottom:1.5rem; }
  .xv-form-ttl    { font-size:1rem; font-weight:800; color:#f1f5f9; margin:0 0 0.6rem; }
  .xv-info-box    { background:rgba(132,204,22,0.04); border:1px solid rgba(132,204,22,0.14); border-radius:9px; padding:0.65rem 0.9rem; font-size:0.8rem; line-height:1.6; margin-bottom:1rem; }
  .xv-form        { display:flex; flex-direction:column; gap:1rem; }
  .xv-frow        { display:flex; flex-direction:column; gap:0.38rem; }
  .xv-2col        { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
  .xv-fcol        { display:flex; flex-direction:column; gap:0.3rem; }
  .xv-lbl         { font-size:0.73rem; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:0.07em; }
  .xv-optional    { color:#334155; font-weight:400; text-transform:none; letter-spacing:0; font-size:0.78em; }
  .xv-hint        { font-size:0.72rem; color:#475569; line-height:1.45; }
  .xv-lime-text   { color:#84cc16; font-weight:700; }
  .xv-err         { background:rgba(239,68,68,0.07); border:1px solid rgba(239,68,68,0.2); color:#fca5a5; padding:0.6rem 0.9rem; border-radius:9px; font-size:0.84rem; }
  .xv-form-actions { display:flex; gap:0.7rem; justify-content:flex-end; padding-top:0.5rem; }
  .xv-cat-row     { display:flex; gap:0.4rem; flex-wrap:wrap; }
  .xv-cat         { padding:0.32rem 0.85rem; border-radius:20px; font-size:0.82rem; font-weight:700; cursor:pointer; background:rgba(255,255,255,0.03); color:#475569; border:1px solid rgba(255,255,255,0.08); font-family:inherit; transition:all 0.15s; }
  .xv-cat.active  { background:rgba(132,204,22,0.1); color:#84cc16; border-color:rgba(132,204,22,0.35); }
  .xv-cat:hover:not(.active) { color:#94a3b8; border-color:rgba(255,255,255,0.13); }
  .xv-cat-dashed  { border-style:dashed; }

  /* ── Invite cards ── */
  .xv-list        { display:flex; flex-direction:column; gap:0.9rem; }
  .xv-card        { background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07); border-radius:14px; padding:1.15rem 1.35rem; transition:border-color 0.2s, background 0.2s; }
  .xv-card:hover  { border-color:rgba(132,204,22,0.2); background:rgba(132,204,22,0.02); }
  .xv-card-off    { opacity:0.45; }
  .xv-card-hdr    { display:flex; justify-content:space-between; align-items:center; margin-bottom:0.85rem; gap:0.5rem; }
  .xv-card-left   { display:flex; align-items:center; gap:0.45rem; flex-wrap:wrap; }

  .xv-code-chip   { font-family:'DM Mono',monospace; font-size:1rem; font-weight:700; color:#e2ffa0; background:rgba(132,204,22,0.1); border:1px solid rgba(132,204,22,0.2); padding:0.18rem 0.55rem; border-radius:7px; letter-spacing:1.5px; }
  .xv-invite-name { font-size:0.82rem; font-weight:600; color:#94a3b8; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.07); padding:0.15rem 0.5rem; border-radius:6px; max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

  .xv-icon-btn    { background:transparent; border:none; cursor:pointer; font-size:0.95rem; padding:0.28rem 0.4rem; border-radius:7px; color:#475569; transition:all 0.15s; }
  .xv-icon-btn:hover { background:rgba(255,255,255,0.06); color:#94a3b8; }
  .xv-danger-icon:hover { background:rgba(239,68,68,0.1) !important; color:#fca5a5 !important; }
  .xv-icon-btn:disabled { opacity:0.35; cursor:not-allowed; }

  /* ── Category badges ── */
  .xv-catbadge     { font-size:0.68rem; font-weight:800; padding:0.15rem 0.5rem; border-radius:20px; text-transform:uppercase; letter-spacing:0.06em; }
  .xv-cat-community { background:rgba(14,165,233,0.12); color:#38bdf8; border:1px solid rgba(14,165,233,0.2); }
  .xv-cat-user     { background:rgba(132,204,22,0.1); color:#84cc16; border:1px solid rgba(132,204,22,0.2); }
  .xv-cat-vip      { background:rgba(245,158,11,0.1); color:#f59e0b; border:1px solid rgba(245,158,11,0.2); }
  .xv-cat-custom   { background:rgba(139,92,246,0.1); color:#a78bfa; border:1px solid rgba(139,92,246,0.2); }
  .xv-cat-standard { background:rgba(99,102,241,0.1); color:#818cf8; border:1px solid rgba(99,102,241,0.2); }
  .xv-cat-whitelist { background:rgba(132,204,22,0.08); color:#84cc16; border:1px solid rgba(132,204,22,0.18); }
  .xv-cat-admin    { background:rgba(239,68,68,0.08); color:#f87171; border:1px solid rgba(239,68,68,0.18); }

  /* ── Status pills ── */
  .xv-pill        { font-size:0.66rem; font-weight:800; padding:0.12rem 0.45rem; border-radius:20px; text-transform:uppercase; letter-spacing:0.04em; }
  .xv-pill-full   { background:rgba(239,68,68,0.1); color:#f87171; border:1px solid rgba(239,68,68,0.2); }
  .xv-pill-wl     { background:rgba(14,165,233,0.1); color:#38bdf8; border:1px solid rgba(14,165,233,0.2); }
  .xv-pill-off    { background:rgba(71,85,105,0.2); color:#64748b; border:1px solid rgba(71,85,105,0.2); }
  .xv-pill-exp    { background:rgba(239,68,68,0.06); color:#f87171; border:1px solid rgba(239,68,68,0.15); }

  /* ── Card stats ── */
  .xv-card-stats  { display:flex; gap:1.5rem; flex-wrap:wrap; margin-bottom:0.85rem; }
  .xv-s           { display:flex; flex-direction:column; gap:0.12rem; min-width:82px; }
  .xv-sl          { font-size:0.65rem; color:#334155; text-transform:uppercase; letter-spacing:0.06em; font-weight:700; }
  .xv-sv          { font-size:0.9rem; font-weight:700; color:#e2e8f0; }
  .xv-prog-bar    { height:3px; background:rgba(255,255,255,0.06); border-radius:3px; margin-top:4px; width:82px; overflow:hidden; }
  .xv-prog-fill   { height:100%; border-radius:3px; transition:width 0.4s; }

  /* ── Waitlist row ── */
  .xv-card-wl     { display:flex; align-items:center; gap:1rem; border-top:1px solid rgba(255,255,255,0.05); padding-top:0.75rem; flex-wrap:wrap; }
  .xv-wl-btn      { display:flex; align-items:center; gap:0.4rem; padding:0.35rem 0.75rem; background:transparent; border:1px solid rgba(255,255,255,0.07); border-radius:8px; color:#334155; cursor:pointer; font-size:0.8rem; font-family:inherit; transition:all 0.15s; }
  .xv-wl-active   { border-color:rgba(132,204,22,0.25) !important; color:#84cc16 !important; background:rgba(132,204,22,0.04) !important; }
  .xv-wl-btn:hover { border-color:rgba(132,204,22,0.3); color:#84cc16; }
  .xv-wl-n        { font-weight:800; font-size:0.95rem; }
  .xv-wl-arrow    { margin-left:0.1rem; opacity:0.6; }

  /* ── State messages ── */
  .xv-state       { text-align:center; padding:3rem; color:#334155; font-size:0.88rem; }
  .xv-state-err   { color:#fca5a5; }
  .xv-state-empty { color:#1e293b; }

  @media (max-width:640px) {
    .xv-2col { grid-template-columns:1fr; }
    .xv-card-stats { gap:1rem; }
    .xv-filterbar { flex-direction:column; align-items:stretch; }
    .xv-srch { max-width:100%; }
    .xv-card-hdr { flex-wrap:wrap; }
  }
`;

const MODAL_CSS = `
  .xv-overlay    { position:fixed; inset:0; background:rgba(0,0,0,0.82); display:flex; align-items:center; justify-content:center; z-index:1000; padding:1rem; backdrop-filter:blur(6px); }
  .xv-modal      { background:#020403; border:1px solid rgba(132,204,22,0.15); border-radius:16px; width:100%; max-width:820px; max-height:90vh; overflow-y:auto; display:flex; flex-direction:column; gap:1.2rem; padding:1.5rem; box-shadow:0 20px 60px rgba(0,0,0,0.6); }
  .xv-modal-hdr  { display:flex; justify-content:space-between; align-items:flex-start; }
  .xv-modal-ttl  { font-size:1.2rem; font-weight:800; color:#f1f5f9; margin:0; letter-spacing:-0.2px; }
  .xv-modal-meta { display:flex; align-items:center; gap:0.5rem; margin-top:0.3rem; flex-wrap:wrap; }
  .xv-modal-name { font-size:0.8rem; color:#94a3b8; font-weight:600; }
  .xv-modal-cat  { font-size:0.73rem; color:#64748b; }
  .xv-modal-price { font-size:0.8rem; color:#64748b; }
  .xv-close      { background:transparent; border:none; font-size:1rem; color:#475569; cursor:pointer; padding:0.25rem 0.45rem; border-radius:6px; line-height:1; }
  .xv-close:hover { background:rgba(255,255,255,0.06); color:#94a3b8; }
  .xv-modal-footer { display:flex; justify-content:flex-end; padding-top:0.75rem; border-top:1px solid rgba(255,255,255,0.05); }
  .xv-chip       { font-family:'DM Mono',monospace; background:rgba(132,204,22,0.08); border:1px solid rgba(132,204,22,0.18); padding:0.12rem 0.45rem; border-radius:5px; color:#e2ffa0; font-size:0.82rem; letter-spacing:1px; }

  .xv-stats-row  { display:flex; gap:0.75rem; }
  .xv-stat-card  { flex:1; background:rgba(255,255,255,0.025); border-radius:10px; padding:1rem; text-align:center; border-top:2px solid transparent; }
  .xv-stat-n     { display:block; font-size:1.9rem; font-weight:900; line-height:1; }
  .xv-stat-l     { font-size:0.68rem; color:#475569; text-transform:uppercase; letter-spacing:0.06em; display:block; margin-top:0.3rem; font-weight:700; }

  .xv-box        { background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.07); border-radius:10px; padding:1rem 1.2rem; }
  .xv-box-ttl    { font-size:0.85rem; font-weight:800; color:#cbd5e1; margin:0 0 0.65rem; text-transform:uppercase; letter-spacing:0.04em; }
  .xv-muted      { font-size:0.78rem; color:#475569; margin:0 0 0.7rem; line-height:1.6; }
  .xv-promote-row { display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap; }

  .xv-msg        { padding:0.65rem 1rem; border-radius:9px; font-size:0.84rem; font-weight:600; }
  .xv-msg.success { background:rgba(132,204,22,0.06); border:1px solid rgba(132,204,22,0.2); color:#84cc16; }
  .xv-msg.error   { background:rgba(239,68,68,0.06); border:1px solid rgba(239,68,68,0.18); color:#fca5a5; }

  .xv-tbl-wrap   { overflow-x:auto; border-radius:9px; border:1px solid rgba(255,255,255,0.06); margin-top:0.5rem; }
  .xv-tbl        { width:100%; border-collapse:collapse; font-size:0.82rem; }
  .xv-tbl th     { background:rgba(255,255,255,0.03); color:#334155; font-weight:800; text-transform:uppercase; font-size:0.65rem; letter-spacing:0.07em; padding:0.55rem 0.75rem; text-align:left; white-space:nowrap; }
  .xv-tbl td     { padding:0.6rem 0.75rem; color:#94a3b8; border-bottom:1px solid rgba(255,255,255,0.04); }
  .xv-tbl tr:last-child td { border-bottom:none; }
  .xv-tbl tr:hover td { background:rgba(132,204,22,0.02); }
  .xv-wl-row td  { color:#84cc16; }
  .xv-td-pos     { color:#84cc16; font-weight:800; width:2rem; }
  .xv-td-mono    { font-family:'DM Mono',monospace; font-size:0.77rem; color:#64748b; }
  .xv-yes        { color:#84cc16 !important; font-size:0.78rem; }
  .xv-no         { color:#334155 !important; font-size:0.78rem; }
`;
