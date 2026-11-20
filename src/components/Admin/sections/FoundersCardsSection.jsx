import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Crown, RefreshCw, Save, ShieldCheck, Upload } from "lucide-react";
import { C } from "../AdminUI.jsx";
import { foundersCardService, parseFoundersCardsCsv } from "../../../services/foundersCardService";

const TIER_ORDER = ["Silver", "Gold", "Diamond", "VIP"];

function SectionCard({ title, description, children }) {
  return (
    <section style={{ padding: 18, background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 14 }}>
      <h2 style={{ margin: 0, color: C.text, fontSize: 16 }}>{title}</h2>
      {description && <p style={{ margin: "5px 0 16px", color: C.muted, fontSize: 12, lineHeight: 1.5 }}>{description}</p>}
      {children}
    </section>
  );
}

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "9px 10px",
  color: C.text,
  background: C.bg,
  border: `1px solid ${C.border2}`,
  borderRadius: 8,
  font: "inherit",
};

function createDraft(tier) {
  return {
    list_price: String(tier.list_price ?? ""),
    price_currency: tier.price_currency || "",
    max_per_user: String(tier.max_per_user ?? 1),
    sale_enabled: Boolean(tier.sale_enabled),
    transfers_enabled: Boolean(tier.transfers_enabled),
  };
}

export default function FoundersCardsSection() {
  const [config, setConfig] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [policyDraft, setPolicyDraft] = useState({ reservation_hours: "24", late_paystack_action: "auto_refund" });
  const [loading, setLoading] = useState(true);
  const [savingTier, setSavingTier] = useState(null);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const updateConfiguredTier = (tierName, update) => {
    setConfig((current) => current && ({
      ...current,
      tiers: current.tiers.map((tier) => (
        tier.tier === tierName ? { ...tier, ...update } : tier
      )),
    }));
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await foundersCardService.getAdminConfig();
      const nextDrafts = Object.fromEntries((result.tiers || []).map((tier) => [tier.tier, createDraft(tier)]));
      setConfig(result);
      setDrafts(nextDrafts);
      setPolicyDraft({
        reservation_hours: String(result.policy?.reservation_hours ?? 24),
        late_paystack_action: result.policy?.late_paystack_action || "auto_refund",
      });
    } catch (loadError) {
      setError(loadError.message || "Could not load founders-card controls.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateDraft = (tier, key, value) => {
    setDrafts((current) => ({
      ...current,
      [tier]: { ...current[tier], [key]: value },
    }));
  };

  const saveTier = async (event, tier) => {
    event.preventDefault();
    const configuredTier = config?.tiers?.find((item) => item.tier === tier);
    if (!configuredTier) return;
    const nextTier = {
      ...configuredTier,
      list_price: Number(drafts[tier].list_price),
      price_currency: drafts[tier].price_currency || null,
      max_per_user: Number(drafts[tier].max_per_user),
      sale_enabled: Boolean(drafts[tier].sale_enabled),
      transfers_enabled: Boolean(drafts[tier].transfers_enabled),
    };
    updateConfiguredTier(tier, nextTier);
    setSavingTier(tier);
    setError("");
    setSuccess("");
    try {
      await foundersCardService.updateTier(tier, drafts[tier]);
      setSuccess(`${tier} settings saved.`);
    } catch (saveError) {
      updateConfiguredTier(tier, configuredTier);
      setError(saveError.message || `Could not save ${tier} settings.`);
    } finally {
      setSavingTier(null);
    }
  };

  const toggleTierSales = async (tierName, enabled) => {
    if (savingTier !== null) return;
    const configuredTier = config?.tiers?.find((item) => item.tier === tierName);
    if (!configuredTier) return;
    if (enabled && (!registryReady || configuredTier.price_currency !== "USD")) {
      setError("Import the complete registry and save a confirmed USD price before enabling sales.");
      return;
    }

    const previousEnabled = Boolean(configuredTier.sale_enabled);
    setSavingTier(tierName);
    setError("");
    setSuccess("");
    updateConfiguredTier(tierName, { sale_enabled: enabled });
    setDrafts((current) => ({
      ...current,
      [tierName]: { ...current[tierName], sale_enabled: enabled },
    }));

    try {
      await foundersCardService.updateTier(tierName, {
        ...createDraft(configuredTier),
        sale_enabled: enabled,
      });
      setSuccess(`${tierName} sales ${enabled ? "enabled" : "paused"}.`);
    } catch (saveError) {
      updateConfiguredTier(tierName, { sale_enabled: previousEnabled });
      setDrafts((current) => ({
        ...current,
        [tierName]: { ...current[tierName], sale_enabled: previousEnabled },
      }));
      setError(saveError.message || `Could not ${enabled ? "enable" : "pause"} ${tierName} sales.`);
    } finally {
      setSavingTier(null);
    }
  };

  const savePolicy = async (event) => {
    event.preventDefault();
    setSavingPolicy(true);
    setError("");
    setSuccess("");
    try {
      await foundersCardService.updatePolicy(policyDraft);
      setSuccess("Reservation and late-payment policy saved. It applies to new reservations and payment attempts; existing reservations keep their current expiry.");
      await load();
    } catch (saveError) {
      setError(saveError.message || "Could not save the founders-card policy.");
    } finally {
      setSavingPolicy(false);
    }
  };

  const importRegistry = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImporting(true);
    setError("");
    setSuccess("");
    try {
      const cards = parseFoundersCardsCsv(await file.text());
      const count = await foundersCardService.importRegistry(cards);
      setSuccess(`Imported ${Number(count).toLocaleString()} cards from the supplied registry.`);
      await load();
    } catch (importError) {
      setError(importError.message || "Could not import the founders-card registry.");
    } finally {
      setImporting(false);
    }
  };

  if (loading && !config) {
    return <div style={{ color: C.muted, padding: 24 }}>Loading founders-card controls…</div>;
  }

  const registryCount = Number(config?.registry_count || 0);
  const registryReady = registryCount === 1400;
  const latePayments = Array.isArray(config?.late_payments) ? config.late_payments : [];
  const fieldLabel = { display: "grid", gap: 6, color: C.text2, fontSize: 12, fontWeight: 700 };
  const buttonStyle = (primary = false) => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minHeight: 36,
    padding: "8px 12px",
    color: primary ? "#111" : C.text2,
    background: primary ? C.accent : C.bg3,
    border: `1px solid ${primary ? C.accent : C.border2}`,
    borderRadius: 8,
    font: "inherit",
    fontSize: 12,
    fontWeight: 800,
    cursor: importing || savingTier || savingPolicy ? "wait" : "pointer",
  });

  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 1120 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ display: "grid", placeItems: "center", width: 42, height: 42, borderRadius: 12, background: `${C.accent}12`, border: `1px solid ${C.accent}28` }}>
          <Crown size={20} color={C.accent} />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, color: C.text }}>Founders Cards</h1>
          <p style={{ margin: "4px 0 0", color: C.muted, fontSize: 12 }}>Registry, sales limits, pricing, and internal transfer controls.</p>
        </div>
        <button type="button" onClick={load} disabled={loading} style={buttonStyle()} aria-label="Refresh founders-card controls">
          <RefreshCw size={14} />Refresh
        </button>
      </header>

      {error && <div role="alert" style={{ padding: 12, color: "#fca5a5", background: "#ef444414", border: "1px solid #ef444433", borderRadius: 9 }}>{error}</div>}
      {success && <div role="status" style={{ padding: 12, color: C.accent, background: `${C.accent}0c`, border: `1px solid ${C.accent}22`, borderRadius: 9 }}>{success}</div>}

      <SectionCard
        title="Fixed serial registry"
        description="Import the supplied founders_cards.csv exactly once. Serial numbers and codes are the permanent collection identity; do not regenerate or replace this registry after issuing cards."
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 14, background: C.bg, border: `1px solid ${C.border2}`, borderRadius: 10 }}>
          <div>
            <div style={{ color: C.text, fontSize: 14, fontWeight: 800 }}>{registryCount.toLocaleString()} / 1,400 cards registered</div>
            <div style={{ marginTop: 4, color: registryReady ? C.accent : C.warn, fontSize: 12 }}>
              {registryReady ? "Registry imported and locked." : "Sales remain unavailable until the complete registry is imported."}
            </div>
          </div>
          <label style={{ ...buttonStyle(true), cursor: importing ? "wait" : "pointer" }}>
            <Upload size={14} />{importing ? "Importing…" : registryReady ? "Registry locked" : "Import CSV registry"}
            <input
              type="file"
              accept=".csv,text/csv"
              aria-label="Import founders-card CSV registry"
              disabled={importing || registryReady}
              onChange={importRegistry}
              style={{ display: "none" }}
            />
          </label>
        </div>
        {!registryReady && (
          <div style={{ display: "flex", gap: 8, marginTop: 12, color: C.warn, fontSize: 12, lineHeight: 1.5 }}>
            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            The registry includes private one-time card codes. Only an active CEO can import it, and the codes are never included in the public catalog.
          </div>
        )}
      </SectionCard>

      {latePayments.length > 0 && (
        <SectionCard
          title={`Late-payment follow-up · ${latePayments.length}`}
          description="Expired Paystack charges trigger a refund request automatically; refund-pending entries must be checked in Paystack, and refund-required entries need manual follow-up. Late crypto transactions awaiting verification are listed here; confirmed late crypto payments require a manual refund. No card is issued after its serial has been released."
        >
          <div style={{ display: "grid", gap: 8 }}>
            {latePayments.map((payment) => (
              <div key={payment.order_id} style={{ display: "grid", gap: 5, padding: 12, background: C.bg, border: `1px solid ${C.border2}`, borderRadius: 9 }}>
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, color: C.text, fontSize: 12, fontWeight: 800 }}>
                  <span>{payment.tier} · {payment.provider} · {payment.status.replace(/_/g, " ")}</span>
                  <span>{new Intl.NumberFormat("en-US", { style: "currency", currency: payment.currency, minimumFractionDigits: 2 }).format(Number(payment.amount_minor) / 100)}</span>
                </div>
                <div style={{ color: C.muted, fontSize: 11, overflowWrap: "anywhere" }}>Order: {payment.order_id} · User: {payment.user_id}</div>
                <div style={{ color: C.muted, fontSize: 11, overflowWrap: "anywhere" }}>Provider reference: {payment.provider_reference}</div>
                {payment.failure_reason && <div style={{ color: C.warn, fontSize: 11, lineHeight: 1.5 }}>{payment.failure_reason}</div>}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard
        title="Reservation and late-payment policy"
        description="These settings apply collection-wide. Changing them does not alter expiry times on orders that already exist. Crypto refunds always require manual handling because Xeevia does not control users' sending wallets."
      >
        <form onSubmit={savePolicy} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", alignItems: "end", gap: 12 }}>
          <label style={fieldLabel}>Reservation duration (hours)
            <input
              style={inputStyle}
              type="number"
              min="1"
              max="168"
              step="1"
              required
              value={policyDraft.reservation_hours}
              onChange={(event) => setPolicyDraft((current) => ({ ...current, reservation_hours: event.target.value }))}
            />
          </label>
          <label style={fieldLabel}>Late Paystack payment
            <select
              style={inputStyle}
              value={policyDraft.late_paystack_action}
              onChange={(event) => setPolicyDraft((current) => ({ ...current, late_paystack_action: event.target.value }))}
            >
              <option value="auto_refund">Automatically request a refund</option>
              <option value="manual_review">Flag for manual refund review</option>
            </select>
          </label>
          <button type="submit" disabled={savingPolicy || savingTier !== null} style={buttonStyle(true)}>
            <Save size={13} />{savingPolicy ? "Saving policy…" : "Save policy"}
          </button>
        </form>
      </SectionCard>

      <SectionCard
        title="Tier controls"
        description="Prices use USD as the settlement base: Paystack converts to NGN at checkout, while crypto payments use verified USD stablecoins. The CSV prices have no currency, so sales start off until you explicitly confirm each tier's denomination."
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 12 }}>
          {TIER_ORDER.map((tierName) => {
            const tier = (config?.tiers || []).find((item) => item.tier === tierName);
            const draft = drafts[tierName];
            if (!tier || !draft) return null;
            const canEnableSales = registryReady && tier.price_currency === "USD";
            return (
              <form key={tierName} onSubmit={(event) => saveTier(event, tierName)} style={{ display: "grid", gap: 10, padding: 14, background: C.bg, border: `1px solid ${C.border2}`, borderRadius: 10 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <strong style={{ color: C.text, fontSize: 14 }}>{tierName}</strong>
                  <span style={{ color: C.muted, fontSize: 11 }}>{tier.owned} owned · {tier.available} available · {tier.reserved} reserved</span>
                </div>
                <div style={{ color: C.muted, fontSize: 11 }}>Fixed supply: {tier.supply.toLocaleString()}</div>
                <label style={fieldLabel}>Price (USD)
                  <input style={inputStyle} type="number" min="0.01" max="10000000" step="0.01" required disabled={savingTier !== null} value={draft.list_price} onChange={(event) => updateDraft(tierName, "list_price", event.target.value)} />
                </label>
                <label style={fieldLabel}>Confirm price currency
                  <select style={inputStyle} disabled={savingTier !== null} value={draft.price_currency} onChange={(event) => updateDraft(tierName, "price_currency", event.target.value)}>
                    <option value="">Not confirmed</option>
                    <option value="USD">USD</option>
                  </select>
                </label>
                <label style={fieldLabel}>Maximum cards per user
                  <input style={inputStyle} type="number" min="1" max="50" step="1" required disabled={savingTier !== null} value={draft.max_per_user} onChange={(event) => updateDraft(tierName, "max_per_user", event.target.value)} />
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, color: C.text2, fontSize: 12, fontWeight: 700 }}>
                  <input
                    type="checkbox"
                    role="switch"
                    aria-label={`Enable ${tierName} sales`}
                    checked={draft.sale_enabled}
                    disabled={savingTier !== null || (!canEnableSales && !draft.sale_enabled)}
                    onChange={(event) => toggleTierSales(tierName, event.target.checked)}
                    style={{ accentColor: C.accent }}
                  />
                  {draft.sale_enabled ? "Sales on" : "Sales off"}{canEnableSales ? "" : " · requires registry and saved USD price"}
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, color: C.text2, fontSize: 12, fontWeight: 700 }}>
                  <input type="checkbox" checked={draft.transfers_enabled} disabled={savingTier !== null} onChange={(event) => updateDraft(tierName, "transfers_enabled", event.target.checked)} style={{ accentColor: C.accent }} />
                  Allow internal Xeevia transfers
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.muted, fontSize: 11 }}>
                  <ShieldCheck size={13} />Transfers change Xeevia ownership only, not blockchain ownership.
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 2 }}>
                  <button type="submit" disabled={savingTier !== null || savingPolicy} style={buttonStyle(true)}>
                    <Save size={13} />{savingTier === tierName ? "Saving…" : "Save tier settings"}
                  </button>
                </div>
              </form>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
