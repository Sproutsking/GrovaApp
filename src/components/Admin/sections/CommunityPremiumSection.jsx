import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Crown, RefreshCw, Save, Search } from "lucide-react";
import { C } from "../AdminUI.jsx";
import { supabase } from "../../../services/config/supabase";

const PAGE_SIZE = 50;
const PLAN_LABELS = {
  free: "Free",
  premium: "Premium",
  premium_plus: "Premium Plus",
};

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

function SectionCard({ title, description, children }) {
  return (
    <section style={{ padding: 18, background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 14 }}>
      <h2 style={{ margin: 0, color: C.text, fontSize: 16 }}>{title}</h2>
      {description && <p style={{ margin: "5px 0 16px", color: C.muted, fontSize: 12, lineHeight: 1.5 }}>{description}</p>}
      {children}
    </section>
  );
}

function defaultDraft(config) {
  return {
    enabled: config.enabled,
    trial_days: config.trial_days,
    reminder_days: config.reminder_days,
    plans: config.plans,
  };
}

function normalizePlans(plans) {
  return Object.fromEntries(Object.entries(plans).map(([tier, plan]) => [tier, {
    ...plan,
    members: Number(plan.members),
    custom_channels: Number(plan.custom_channels),
    open_tickets: Number(plan.open_tickets),
    social_connections: Number(plan.social_connections),
    monthly_price_usd: Number(plan.monthly_price_usd),
  }]));
}

export default function CommunityPremiumSection() {
  const [config, setConfig] = useState(null);
  const [draft, setDraft] = useState(null);
  const [communities, setCommunities] = useState([]);
  const [communityEdits, setCommunityEdits] = useState({});
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: loadError } = await supabase.rpc("admin_get_community_premium_config", {
        p_search: search || null,
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
      });
      if (loadError) throw loadError;
      if (!data || !data.plans) throw new Error("The Premium configuration response was incomplete.");
      setConfig(data);
      setDraft(defaultDraft(data));
      setCommunities(data.communities || []);
      setCommunityEdits({});
    } catch (loadFailure) {
      setError(loadFailure.message || "Could not load Community Premium settings.");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    load();
  }, [load]);

  const saveConfig = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const plans = normalizePlans(draft.plans);
      const { error: saveError } = await supabase.rpc("admin_update_community_premium_config", {
        p_enabled: draft.enabled,
        p_trial_days: Number(draft.trial_days),
        p_reminder_days: Number(draft.reminder_days),
        p_plans: plans,
      });
      if (saveError) throw saveError;
      setSuccess("Community Premium settings saved.");
      await load();
    } catch (saveFailure) {
      setError(saveFailure.message || "Could not save Community Premium settings.");
    } finally {
      setSaving(false);
    }
  };

  const saveCommunity = async (community) => {
    const change = communityEdits[community.id] || {};
    const tier = change.tier ?? community.tier ?? "free";
    const expiration = change.accessUntil ?? "";
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const { error: saveError } = await supabase.rpc("admin_set_community_premium_entitlement", {
        p_community_id: community.id,
        p_tier: tier,
        p_access_until: expiration ? new Date(expiration).toISOString() : null,
      });
      if (saveError) throw saveError;
      setSuccess(`Access updated for ${community.name}.`);
      await load();
    } catch (saveFailure) {
      setError(saveFailure.message || "Could not update this community's access.");
    } finally {
      setSaving(false);
    }
  };

  const updatePlan = (tier, key, value) => {
    setDraft((current) => ({
      ...current,
      plans: {
        ...current.plans,
        [tier]: { ...current.plans[tier], [key]: value },
      },
    }));
  };

  const updateCommunity = (id, key, value) => {
    setCommunityEdits((current) => ({
      ...current,
      [id]: { ...current[id], [key]: value },
    }));
  };

  const applySearch = (event) => {
    event.preventDefault();
    setPage(0);
    setSearch(searchInput.trim());
  };

  if (loading && !config) {
    return <div style={{ color: C.muted, padding: 24 }}>Loading Community Premium controls…</div>;
  }
  if (!draft) return <div role="alert" style={{ color: C.danger, padding: 24 }}>{error || "Community Premium controls are unavailable."}</div>;

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
    cursor: saving ? "wait" : "pointer",
  });

  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 1120 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ display: "grid", placeItems: "center", width: 42, height: 42, borderRadius: 12, background: `${C.accent}12`, border: `1px solid ${C.accent}28` }}>
          <Crown size={20} color={C.accent} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, color: C.text }}>Community Premium</h1>
          <p style={{ margin: "4px 0 0", color: C.muted, fontSize: 12 }}>CEO-only controls for trial access, plan limits, pricing, and community entitlements.</p>
        </div>
      </header>

      {error && <div role="alert" style={{ padding: 12, color: "#fca5a5", background: "#ef444414", border: "1px solid #ef444433", borderRadius: 9 }}>{error}</div>}
      {success && <div role="status" style={{ padding: 12, color: C.accent, background: `${C.accent}0c`, border: `1px solid ${C.accent}22`, borderRadius: 9 }}>{success}</div>}

      <form onSubmit={saveConfig} style={{ display: "grid", gap: 16 }}>
        <SectionCard
          title="Global Premium switch"
          description="When turned off, every community immediately uses Free limits. Existing members, channels, tickets, social connections, and data are preserved. Re-enabling restores each community's unexpired trial or manually granted plan."
        >
          <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: 14, background: draft.enabled ? `${C.accent}0a` : "#ef44440c", border: `1px solid ${draft.enabled ? `${C.accent}30` : "#ef444430"}`, borderRadius: 10, cursor: "pointer" }}>
            <span>
              <span style={{ display: "block", color: C.text, fontSize: 14, fontWeight: 800 }}>
                {draft.enabled ? "Community Premium is on" : "Community Premium is off"}
              </span>
              <span style={{ display: "block", marginTop: 3, color: C.muted, fontSize: 12 }}>
                {draft.enabled ? "Trials and Premium entitlements are active." : "All communities are currently restricted to Free access."}
              </span>
            </span>
            <input
              aria-label="Enable Community Premium platform-wide"
              type="checkbox"
              checked={draft.enabled}
              onChange={(event) => setDraft((current) => ({ ...current, enabled: event.target.checked }))}
              style={{ width: 20, height: 20, accentColor: C.accent, flexShrink: 0 }}
            />
          </label>
          {!draft.enabled && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, color: C.warn, fontSize: 12 }}>
              <AlertTriangle size={15} /> Existing over-limit communities remain intact; new capped activity is blocked.
            </div>
          )}
        </SectionCard>

        <SectionCard title="Trial and reminder" description="New communities receive full Premium Plus access for the configured trial duration. Owners see a reminder as their trial approaches expiry.">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <label style={fieldLabel}>Trial duration (days)
              <input style={inputStyle} type="number" min="1" max="365" value={draft.trial_days} onChange={(event) => setDraft((current) => ({ ...current, trial_days: event.target.value }))} />
            </label>
            <label style={fieldLabel}>Reminder lead time (days)
              <input style={inputStyle} type="number" min="1" max="90" value={draft.reminder_days} onChange={(event) => setDraft((current) => ({ ...current, reminder_days: event.target.value }))} />
            </label>
          </div>
        </SectionCard>

        <SectionCard title="Plan limits and pricing" description="Limits are enforced in the database. Prices are stored as plan settings only; subscription checkout and payment collection are not connected yet.">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 12 }}>
            {Object.entries(PLAN_LABELS).map(([tier, label]) => {
              const plan = draft.plans[tier];
              return (
                <div key={tier} style={{ display: "grid", gap: 10, padding: 14, background: C.bg, border: `1px solid ${C.border2}`, borderRadius: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", color: C.text, fontSize: 13, fontWeight: 800 }}>
                    <span>{label}</span>
                    <span style={{ color: C.accent }}>{tier === "free" ? "Free" : Number(plan.monthly_price_usd) > 0 ? `$${plan.monthly_price_usd}/mo` : "Price not set"}</span>
                  </div>
                  <label style={fieldLabel}>Monthly price (USD)
                    <input style={inputStyle} type="number" min="0" max="100000" step="0.01" value={plan.monthly_price_usd} onChange={(event) => updatePlan(tier, "monthly_price_usd", event.target.value)} />
                  </label>
                  {[
                    ["members", "Member limit"],
                    ["custom_channels", "Custom channels"],
                    ["open_tickets", "Open tickets"],
                    ["social_connections", "Social connections"],
                  ].map(([key, title]) => (
                    <label key={key} style={fieldLabel}>{title}
                      <input style={inputStyle} type="number" min={key === "members" ? "1" : "0"} value={plan[key]} onChange={(event) => updatePlan(tier, key, event.target.value)} />
                    </label>
                  ))}
                  <label style={{ display: "flex", alignItems: "center", gap: 8, color: C.text2, fontSize: 12, fontWeight: 700 }}>
                    <input type="checkbox" checked={plan.social_updates} onChange={(event) => updatePlan(tier, "social_updates", event.target.checked)} style={{ accentColor: C.accent }} />
                    Social updates and sync
                  </label>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="submit" disabled={saving} style={buttonStyle(true)}><Save size={14} />{saving ? "Saving…" : "Save Premium settings"}</button>
        </div>
      </form>

      <SectionCard title="Community access" description="Grant or remove plan access manually while subscription checkout is being integrated. Leaving an expiration blank grants the selected tier without an expiry; removing access ends the trial and applies Free limits if the system switch is on.">
        <form onSubmit={applySearch} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input style={inputStyle} aria-label="Search communities" placeholder="Search by community name or ID" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
          <button type="submit" style={buttonStyle()}><Search size={14} />Search</button>
        </form>
        <div style={{ display: "grid", gap: 8 }}>
          {communities.map((community) => {
            const change = communityEdits[community.id] || {};
            const tier = change.tier ?? community.tier ?? "free";
            const trialDate = community.trial_expires_at ? new Date(community.trial_expires_at) : null;
            const inTrial = tier === "free" && trialDate && trialDate > new Date();
            return (
              <div key={community.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: 10, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 9 }}>
                <div style={{ flex: "1 1 180px", minWidth: 0 }}>
                  <div style={{ overflow: "hidden", color: C.text, fontSize: 12, fontWeight: 800, textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{community.name}</div>
                  <div style={{ marginTop: 3, color: C.muted, fontSize: 11 }}>{Number(community.member_count || 0).toLocaleString()} members{inTrial ? ` · trial ends ${trialDate.toLocaleDateString()}` : ""}</div>
                </div>
                <select aria-label={`Plan for ${community.name}`} style={{ ...inputStyle, flex: "1 1 120px", width: "auto" }} value={tier} onChange={(event) => updateCommunity(community.id, "tier", event.target.value)}>
                  {Object.entries(PLAN_LABELS).map(([value, label]) => <option key={value} value={value}>{label}{value === "free" && inTrial ? " (trial active)" : ""}</option>)}
                </select>
                <input aria-label={`Access expiration for ${community.name}`} style={{ ...inputStyle, flex: "1 1 180px", width: "auto" }} type="datetime-local" value={change.accessUntil ?? (community.access_until ? new Date(community.access_until).toISOString().slice(0, 16) : "")} onChange={(event) => updateCommunity(community.id, "accessUntil", event.target.value)} />
                <span style={{ flex: "0 0 auto", color: C.muted, fontSize: 11 }}>{community.id.slice(0, 8)}</span>
                <button type="button" disabled={saving} onClick={() => saveCommunity(community)} style={buttonStyle()}><Save size={13} />Save</button>
              </div>
            );
          })}
          {communities.length === 0 && <div style={{ padding: 18, color: C.muted, textAlign: "center", fontSize: 12 }}>{loading ? "Loading…" : "No communities found."}</div>}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
          <span style={{ color: C.muted, fontSize: 11 }}>Page {page + 1} · {PAGE_SIZE} communities per page</span>
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" disabled={page === 0 || loading} onClick={() => setPage((value) => Math.max(0, value - 1))} style={buttonStyle()}><ChevronLeft size={14} />Previous</button>
            <button type="button" disabled={communities.length < PAGE_SIZE || loading} onClick={() => setPage((value) => value + 1)} style={buttonStyle()}>Next<ChevronRight size={14} /></button>
            <button type="button" disabled={loading} onClick={load} aria-label="Refresh communities" style={buttonStyle()}><RefreshCw size={14} /></button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
