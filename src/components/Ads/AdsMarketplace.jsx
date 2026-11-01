import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowUpRight, BadgeCheck, BarChart3, Check, CircleDollarSign,
  Clock3, Handshake, Megaphone, ShieldCheck,
  Sparkles, Target, Upload, Users, X,
} from "lucide-react";
import adCampaignService from "../../services/ads/adCampaignService";
import { calculateCampaignEconomics } from "../../services/ads/adCampaignEconomics";
import uploadService from "../../services/upload/uploadService";

const TOPICS = [
  "art", "business", "community", "design", "education", "entertainment",
  "fashion", "food", "gaming", "health", "music", "technology", "travel", "writing",
];
const OBJECTIVES = [
  ["awareness", "Introduce a product or idea"],
  ["community_growth", "Grow a relevant community"],
  ["qualified_action", "Earn an on-platform action"],
  ["conversion", "Drive a measurable visit"],
];
const localDateTime = (date) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export default function AdsMarketplace({ onClose, userId, initialView = "overview" }) {
  const [view, setView] = useState(initialView);
  const [campaigns, setCampaigns] = useState([]);
  const [balance, setBalance] = useState(0);
  const [offers, setOffers] = useState([]);
  const [preferences, setPreferences] = useState({ enabled: false, topics: [] });
  const [form, setForm] = useState({
    name: "", objective: "awareness", budget: "", feeMode: "included",
    topics: [], creatorCount: "5", minFollowers: "0",
    startsAt: localDateTime(new Date()), endsAt: localDateTime(new Date(Date.now() + 7 * 86400000)),
    destinationUrl: "", creativeUrl: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reports, setReports] = useState({});
  const [openReport, setOpenReport] = useState(null);

  const economics = useMemo(
    () => calculateCampaignEconomics(form.budget, form.feeMode),
    [form.budget, form.feeMode],
  );

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [nextCampaigns, nextBalance, nextOffers, nextPreferences] = await Promise.all([
        adCampaignService.listCampaigns(userId),
        adCampaignService.getWallet(userId),
        adCampaignService.listCreatorOffers(),
        adCampaignService.getCreatorPreferences(userId),
      ]);
      setCampaigns(nextCampaigns);
      setBalance(nextBalance);
      setOffers(nextOffers);
      setPreferences({ enabled: Boolean(nextPreferences.enabled), topics: nextPreferences.topics || [] });
      setError("");
    } catch (loadError) {
      setError(loadError?.message || "Ads Centre could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setView(initialView); }, [initialView]);

  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const toggleTopic = (topics, topic) => topics.includes(topic)
    ? topics.filter((item) => item !== topic)
    : [...topics, topic];

  const uploadCreative = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    setNotice("");
    try {
      const result = await uploadService.uploadVideo(file, "grova/ads", setUploadProgress);
      if (!result?.url) throw new Error("Video upload completed without a secure URL.");
      updateForm("creativeUrl", result.url);
      setNotice("Campaign video uploaded and ready.");
    } catch (uploadError) {
      setError(uploadError?.message || "Video upload failed.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      event.target.value = "";
    }
  };

  const createCampaign = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      if (form.topics.length === 0) throw new Error("Choose at least one creator topic.");
      if (!form.creativeUrl) throw new Error("Upload a campaign video first.");
      if (new Date(form.endsAt) - new Date(form.startsAt) < 3600000) {
        throw new Error("Campaign duration must be at least one hour.");
      }
      if (new Date(form.endsAt) - new Date(form.startsAt) > 30 * 86400000) {
        throw new Error("Campaign duration cannot exceed 30 days.");
      }
      await adCampaignService.createCampaign({
        name: form.name,
        objective: form.objective,
        budgetEp: form.budget,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        audienceDefinition: {
          creator_topics: form.topics,
          creator_count: Number(form.creatorCount),
          min_followers: Number(form.minFollowers),
          fee_mode: form.feeMode,
          creative_url: form.creativeUrl,
          destination_url: form.destinationUrl,
        },
      });
      await load();
      setView("campaigns");
      setNotice("Campaign funded. Matching creators have been invited to review it.");
    } catch (saveError) {
      setError(saveError?.message || "Campaign could not be created.");
    } finally {
      setSaving(false);
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await adCampaignService.saveCreatorPreferences(preferences.enabled, preferences.topics);
      setNotice("Creator preferences saved. Matching opportunities will appear here.");
    } catch (saveError) {
      setError(saveError?.message || "Creator preferences could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const respond = async (offer, accept) => {
    setSaving(true);
    setError("");
    try {
      await adCampaignService.respondToOffer(offer.offer_id, accept);
      await load();
      setNotice(accept ? "Campaign accepted. It can now be delivered to your followers." : "Campaign declined.");
    } catch (responseError) {
      setError(responseError?.message || "Your response could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const settle = async (campaign) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await adCampaignService.settleCampaign(campaign.id, false);
      await load();
      setNotice(`Campaign settled: ${Number(result?.creator_paid_ep || 0)} EP to creators; ${Number(result?.refund_ep || 0)} EP returned.`);
    } catch (settleError) {
      setError(settleError?.message || "Campaign settlement failed.");
    } finally {
      setSaving(false);
    }
  };

  const toggleReport = async (campaignId) => {
    if (openReport === campaignId) {
      setOpenReport(null);
      return;
    }
    setOpenReport(campaignId);
    if (reports[campaignId]) return;
    try {
      const report = await adCampaignService.getCampaignReport(campaignId);
      setReports((current) => ({ ...current, [campaignId]: report }));
    } catch (reportError) {
      setError(reportError?.message || "Campaign report could not be loaded.");
      setOpenReport(null);
    }
  };

  const estimatedFee = economics.commission;
  const pool = economics.creatorPool;

  return (
    <div className="am-shell" role="dialog" aria-modal="true" aria-label="Ads Centre">
      <header className="am-header">
        <button className="am-icon" onClick={onClose} aria-label="Close Ads Centre"><ArrowLeft size={18} /></button>
        <div className="am-brand"><div><Megaphone size={18} /></div><span><b>Ads Centre</b><small>Creator economy</small></span></div>
        <span className="am-balance"><CircleDollarSign size={16} /> {balance.toLocaleString()} EP</span>
        <button className="am-icon am-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
      </header>
      <nav className="am-nav" aria-label="Ads Centre sections">
        {[["overview", "Overview"], ["create", "Create campaign"], ["offers", `Creator offers${offers.filter((offer) => offer.status === "pending").length ? ` · ${offers.filter((offer) => offer.status === "pending").length}` : ""}`], ["campaigns", "My campaigns"]].map(([key, label]) => (
          <button key={key} className={view === key ? "active" : ""} onClick={() => setView(key)}>{label}</button>
        ))}
      </nav>
      <main className="am-main">
        {error && <div className="am-alert error" role="alert">{error}</div>}
        {notice && <div className="am-alert success" role="status">{notice}</div>}
        {loading ? <div className="am-loading">Loading your creator marketplace…</div> : null}

        {view === "overview" && !loading && <section>
          <div className="am-hero">
            <div className="am-eyebrow"><Sparkles size={14} /> CREATOR-LED CAMPAIGNS</div>
            <h1>Growth on<br /><em>your terms.</em></h1>
            <p>Brands fund. Creators choose. Every outcome is accountable.</p>
            <div className="am-hero-actions">
              <button className="am-primary" onClick={() => setView("create")}>New campaign <ArrowUpRight size={16} /></button>
              <button className="am-secondary" onClick={() => setView("offers")}>Creator offers</button>
            </div>
          </div>
          <div className="am-metrics">
            <article><span>Campaigns</span><strong>{campaigns.length}</strong><small>Funded by EP</small></article>
            <article><span>Creator offers</span><strong>{offers.length}</strong><small>Acceptance is always theirs</small></article>
            <article><span>Creator pool</span><strong>70 / 30</strong><small>Reach · outcomes</small></article>
          </div>
          <div className="am-grid">
            <article className="am-panel"><ShieldCheck size={19} /><h2>Clear economics</h2><p>10% commission. The creator pool rewards reach and outcomes.</p></article>
            <article className="am-panel"><Users size={19} /><h2>Relevance by choice</h2><p>Creators opt in by topic. Ads reach their followers—not private messages.</p></article>
            <article className="am-panel"><BadgeCheck size={19} /><h2>People stay in control</h2><p>Creators accept. Viewers can hide or report. Every placement is labeled.</p></article>
          </div>
          <div className="am-note"><ShieldCheck size={16} /> Age targeting is off until age assurance is reliable.</div>
        </section>}

        {view === "create" && <section className="am-form-layout">
          <form className="am-panel am-form" onSubmit={createCampaign}>
            <div className="am-heading"><span className="am-eyebrow">01 / CAMPAIGN</span><h1>Set the direction.</h1><p>Creators review before anything goes live.</p></div>
            <label>Campaign name<input required minLength={3} maxLength={120} value={form.name} onChange={(event) => updateForm("name", event.target.value)} placeholder="What are you building?" /></label>
            <label>Campaign goal<select value={form.objective} onChange={(event) => updateForm("objective", event.target.value)}>{OBJECTIVES.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
            <fieldset><legend>Creator topics</legend><p className="am-help">Match with opted-in creators.</p><div className="am-topics">{TOPICS.map((topic) => <button type="button" className={form.topics.includes(topic) ? "selected" : ""} key={topic} onClick={() => updateForm("topics", toggleTopic(form.topics, topic))}>{topic}</button>)}</div></fieldset>
            <div className="am-two">
              <label>Invite creators<input type="number" min="1" max="50" step="1" value={form.creatorCount} onChange={(event) => updateForm("creatorCount", event.target.value)} /><small>Each creator chooses.</small></label>
              <label>Minimum followers<input type="number" min="0" max="10000000" step="1" value={form.minFollowers} onChange={(event) => updateForm("minFollowers", event.target.value)} /></label>
            </div>
            <div className="am-two">
              <label>Starts<input type="datetime-local" required value={form.startsAt} onChange={(event) => updateForm("startsAt", event.target.value)} /></label>
              <label>Ends<input type="datetime-local" required value={form.endsAt} onChange={(event) => updateForm("endsAt", event.target.value)} /></label>
            </div>
            <label>Secure destination URL<input required type="url" pattern="https://.*" value={form.destinationUrl} onChange={(event) => updateForm("destinationUrl", event.target.value)} placeholder="https://example.com/learn-more" /></label>
            <div className="am-upload">
              <label className="am-upload-button"><Upload size={17} /> {uploading ? `Uploading ${Math.round(uploadProgress)}%` : form.creativeUrl ? "Replace campaign video" : "Upload campaign video"}
                <input type="file" accept="video/*" onChange={uploadCreative} disabled={uploading} />
              </label>
              {uploading && <progress max="100" value={uploadProgress} />}
              {form.creativeUrl && <video src={form.creativeUrl} controls playsInline preload="metadata" aria-label="Campaign video preview" />}
              <small>Upload your campaign video.</small>
            </div>
            <label>Campaign budget (EP)<input required type="number" min="100" step="1" value={form.budget} onChange={(event) => updateForm("budget", event.target.value)} placeholder={`Available: ${balance} EP`} /></label>
            <fieldset><legend>How should the 10% commission be charged?</legend>
              <label className="am-radio"><input type="radio" name="feeMode" checked={form.feeMode === "included"} onChange={() => updateForm("feeMode", "included")} /> Included in my budget</label>
              <label className="am-radio"><input type="radio" name="feeMode" checked={form.feeMode === "on_top"} onChange={() => updateForm("feeMode", "on_top")} /> Charged on top of creator budget</label>
            </fieldset>
            <div className="am-economics">
              <div><span>Creator pool</span><b>{pool.toLocaleString()} EP</b></div>
              <div><span>Platform commission</span><b>{estimatedFee.toLocaleString()} EP</b></div>
              <div><span>Total reserved</span><b>{economics.totalEscrow.toLocaleString()} EP</b></div>
              <small>70% reach · 30% outcomes. Unused EP returns after settlement.</small>
            </div>
            <button className="am-primary am-submit" disabled={saving || uploading}>{saving ? "Reserving campaign EP…" : "Fund campaign and invite creators"}</button>
          </form>
          <aside className="am-aside"><div className="am-panel"><Target size={19} /><h2>How it works</h2><ol><li>EP is reserved.</li><li>Creators review your offer.</li><li>Accepted campaigns reach their followers.</li><li>Results determine settlement.</li></ol></div><div className="am-panel am-caution"><Clock3 size={18} /><h2>Age targeting off</h2><p>We don’t have reliable age assurance yet.</p></div></aside>
        </section>}

        {view === "offers" && !loading && <section>
          <div className="am-heading"><span className="am-eyebrow">CREATOR CONTROL</span><h1>Your offers.</h1><p>You choose what belongs in your feed.</p></div>
          <article className="am-panel am-preferences">
            <div className="am-preferences-title"><div><Handshake size={18} /><strong>Creator opportunities</strong></div><label className="am-toggle"><input type="checkbox" checked={preferences.enabled} onChange={(event) => setPreferences((p) => ({ ...p, enabled: event.target.checked }))} /><span />{preferences.enabled ? "Opted in" : "Paused"}</label></div>
            <p className="am-help">Choose topics. Pause offers whenever you like.</p>
            <div className="am-topics">{TOPICS.map((topic) => <button type="button" className={preferences.topics.includes(topic) ? "selected" : ""} key={topic} onClick={() => setPreferences((p) => ({ ...p, topics: toggleTopic(p.topics, topic) }))}>{topic}</button>)}</div>
            <button className="am-secondary" disabled={saving} onClick={savePreferences}>Save preferences</button>
          </article>
          <div className="am-offers">
            {offers.length === 0 ? <div className="am-empty"><Handshake size={22} /><strong>No offers yet</strong><p>Matching campaigns will show up here.</p></div> : offers.map((offer) => (
              <article className="am-offer" key={offer.offer_id}>
                <div className="am-offer-head"><div><span className="am-eyebrow">{offer.objective?.replaceAll("_", " ")}</span><h2>{offer.campaign_name}</h2><p>From {offer.owner_name || "Xeevia advertiser"}</p></div><span className={`am-status ${offer.status}`}>{offer.status}</span></div>
                <video src={offer.creative_url} controls playsInline preload="metadata" aria-label={`${offer.campaign_name} campaign creative`} />
                <div className="am-offer-facts"><span><CircleDollarSign size={15} /> Campaign pool: {Number(offer.creator_pool_ep || 0).toLocaleString()} EP</span><span>10% commission: {Number(offer.commission_ep || 0).toLocaleString()} EP ({offer.fee_mode === "on_top" ? "on top" : "included"})</span><span><Clock3 size={15} /> {new Date(offer.starts_at).toLocaleDateString()} – {new Date(offer.ends_at).toLocaleDateString()}</span></div>
                <p className="am-help">Your share depends on measured reach and outcomes.</p>
                {offer.status === "pending" && <div className="am-offer-actions"><button className="am-secondary" disabled={saving} onClick={() => respond(offer, false)}>Decline</button><button className="am-primary" disabled={saving} onClick={() => respond(offer, true)}><Check size={15} /> Accept campaign</button></div>}
              </article>
            ))}
          </div>
        </section>}

        {view === "campaigns" && !loading && <section>
          <div className="am-heading"><span className="am-eyebrow">CAMPAIGN LEDGER</span><h1>Campaigns.</h1><p>Budgets, outcomes, settlement.</p></div>
          {!campaigns.length ? <div className="am-empty"><BarChart3 size={22} /><strong>No campaigns yet</strong><p>Your campaigns will appear here.</p><button className="am-primary" onClick={() => setView("create")}>Create campaign</button></div> : <div className="am-campaigns">{campaigns.map((campaign) => (
            <article className="am-campaign" key={campaign.id}>
              <div><span className="am-eyebrow">{campaign.objective?.replaceAll("_", " ")}</span><h2>{campaign.name}</h2><p>{new Date(campaign.starts_at).toLocaleDateString()} – {new Date(campaign.ends_at).toLocaleDateString()}</p><small className="am-help">Creator pool {Number(campaign.audience_definition?.creator_pool_ep || 0).toLocaleString()} EP · commission {Number(campaign.audience_definition?.commission_ep || 0).toLocaleString()} EP ({campaign.audience_definition?.fee_mode === "on_top" ? "on top" : "included"})</small></div>
              <div className="am-campaign-meta"><strong>{Number(campaign.escrow_ep || 0).toLocaleString()} EP</strong><span className={`am-status ${campaign.status}`}>{campaign.status}</span></div>
              <button className="am-secondary" onClick={() => toggleReport(campaign.id)}>{openReport === campaign.id ? "Hide report" : "View report"}</button>
              {["active", "funded", "paused"].includes(campaign.status) && (new Date(campaign.ends_at).getTime() + 7 * 86400000 <= Date.now()
                ? <button className="am-secondary" disabled={saving} onClick={() => settle(campaign)}>Settle campaign</button>
                : <span className="am-help">Settlement opens after the campaign ends and its 7-day attribution window closes.</span>)}
              {campaign.status === "completed" && <span className="am-settled"><Check size={15} /> Settled</span>}
              {openReport === campaign.id && reports[campaign.id] && <div className="am-report">
                <div><span>Accepted creators</span><b>{reports[campaign.id].accepted_creators}</b></div>
                <div><span>Viewable impressions</span><b>{reports[campaign.id].impressions}</b></div>
                <div><span>Clicks</span><b>{reports[campaign.id].clicks}</b></div>
                <div><span>Follows</span><b>{reports[campaign.id].follows}</b></div>
                <div><span>Community joins</span><b>{reports[campaign.id].community_joins}</b></div>
                <div><span>Creator EP paid</span><b>{Number(reports[campaign.id].creator_paid_ep).toLocaleString()}</b></div>
                <div><span>Commission / refund</span><b>{Number(reports[campaign.id].commission_ep).toLocaleString()} / {Number(reports[campaign.id].refund_ep).toLocaleString()} EP</b></div>
                <small>Reach is a viewability signal, not proof of human attention. Follow and community outcomes require a campaign click in the prior 7 days.</small>
              </div>}
            </article>
          ))}</div>}
        </section>}
      </main>
      <style>{`
        .am-shell{position:fixed;inset:0;z-index:120000;background:#07100c;color:#f1f5ef;font-family:Manrope,Inter,system-ui,sans-serif;overflow:auto}
        .am-header{height:68px;display:flex;align-items:center;gap:14px;padding:0 clamp(16px,4vw,48px);border-bottom:1px solid #ffffff14;background:#09120eee;position:sticky;top:0;z-index:3;backdrop-filter:blur(16px)}
        .am-icon{width:36px;height:36px;border:1px solid #ffffff1b;border-radius:11px;background:#ffffff08;color:inherit;display:grid;place-items:center;cursor:pointer}.am-close{margin-left:auto}
        .am-brand{display:flex;align-items:center;gap:10px}.am-brand>div{width:35px;height:35px;border-radius:11px;display:grid;place-items:center;color:#b8fa69;background:#9be34a1a}.am-brand span{display:grid;gap:2px}.am-brand b{font-size:14px}.am-brand small{color:#819187;font-size:10px}.am-balance{margin-left:auto;display:flex;align-items:center;gap:7px;color:#c5f58f;font-size:13px;font-weight:700}
        .am-nav{position:sticky;top:68px;z-index:2;display:flex;gap:8px;overflow-x:auto;padding:12px clamp(16px,4vw,48px);background:#07100cf2;border-bottom:1px solid #ffffff10}.am-nav button{white-space:nowrap;border:1px solid transparent;border-radius:10px;padding:9px 13px;background:transparent;color:#9aa99f;cursor:pointer;font:600 12px/1.2 Manrope,Inter,system-ui,sans-serif}.am-nav button.active{border-color:#b4ed7233;background:#a5e84916;color:#cdf49e}
        .am-main{max-width:1120px;margin:0 auto;padding:32px clamp(16px,4vw,46px) 70px}.am-hero{position:relative;overflow:hidden;padding:clamp(28px,6vw,64px);border:1px solid #b1e77325;border-radius:26px;background:radial-gradient(ellipse at 82% 10%,#8adb2a22,transparent 36%),linear-gradient(130deg,#101d14,#0b130e 70%)}.am-eyebrow{display:flex;align-items:center;gap:7px;color:#b4e881;text-transform:uppercase;letter-spacing:.14em;font-size:10px;font-weight:800}.am-hero h1,.am-heading h1{font-size:clamp(34px,6vw,62px);line-height:1.04;letter-spacing:-.05em;margin:19px 0 14px}.am-hero p,.am-heading p{max-width:650px;color:#a6b2a8;line-height:1.7;font-size:14px}.am-hero-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:24px}
        .am-primary,.am-secondary{min-height:42px;display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:11px;padding:0 15px;font:700 12px/1.2 Manrope,Inter,system-ui,sans-serif;cursor:pointer}.am-primary{border:1px solid #bbf47c;background:#b9ef76;color:#10200b}.am-secondary{border:1px solid #ffffff25;background:#ffffff08;color:#e5eee4}.am-primary:disabled,.am-secondary:disabled{opacity:.5;cursor:wait}
        .am-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:16px 0}.am-metrics article,.am-panel{border:1px solid #ffffff12;border-radius:17px;background:#0d1711;padding:20px}.am-metrics article{display:grid;gap:9px}.am-metrics span{color:#a7b3a9;font-size:12px}.am-metrics strong{font-size:25px;letter-spacing:-.04em}.am-metrics small{color:#78877b;font-size:10px}
        .am-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.am-panel>svg{color:#b4e881}.am-panel h2{font-size:15px;margin:14px 0 8px}.am-panel p,.am-panel li{color:#9aa79d;font-size:12px;line-height:1.7}.am-note{display:flex;align-items:center;gap:9px;margin-top:14px;padding:13px 15px;border:1px solid #e6bd6340;border-radius:12px;color:#d9c58f;font-size:11px}
        .am-form-layout{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(240px,.8fr);gap:14px;align-items:start}.am-form{display:grid;gap:16px}.am-heading h1{font-size:clamp(30px,5vw,46px);margin:10px 0}.am-form label{display:grid;gap:7px;color:#e3e9e2;font-size:12px;font-weight:700}.am-form input:not([type=radio]),.am-form select{min-height:42px;border:1px solid #ffffff20;border-radius:10px;padding:0 12px;background:#08100b;color:#eff4ed;font:500 13px/1.4 Manrope,Inter,system-ui,sans-serif;outline:none}.am-form input:focus,.am-form select:focus{border-color:#b4e881}.am-form small,.am-help{color:#829087;font-size:10px;line-height:1.55}.am-form fieldset{margin:0;padding:14px;border:1px solid #ffffff16;border-radius:12px}.am-form legend{padding:0 5px;color:#eef3ec;font-size:12px;font-weight:700}.am-form fieldset>.am-help{margin:0 0 12px}.am-topics{display:flex;flex-wrap:wrap;gap:7px}.am-topics button{border:1px solid #ffffff1b;border-radius:20px;background:#ffffff07;color:#9eaca1;padding:7px 10px;font-size:10px;text-transform:capitalize;cursor:pointer}.am-topics button.selected{border-color:#b1e77366;background:#a4e84b19;color:#cef59f}.am-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}.am-radio{display:flex!important;grid-template-columns:none!important;align-items:center;gap:9px!important;margin:10px 0}.am-radio input{accent-color:#a6e458}.am-upload{display:grid;gap:8px}.am-upload-button{display:flex!important;align-items:center;justify-content:center;min-height:48px;border:1px dashed #bbeb7b55;border-radius:12px;background:#a4e8460b;color:#c3ed9b!important;cursor:pointer}.am-upload-button input{display:none}.am-upload video,.am-offer video{width:100%;max-height:360px;object-fit:contain;background:#000;border-radius:12px}.am-upload progress{width:100%;accent-color:#a8e55e}.am-economics{padding:14px;border:1px solid #b8ed7333;border-radius:12px;background:#a1e64b0b;display:grid;gap:10px}.am-economics div{display:flex;justify-content:space-between;font-size:12px}.am-economics span{color:#a6b3a8}.am-economics b{color:#d5f8ac}.am-economics small{color:#89998d;line-height:1.6}.am-submit{width:100%;min-height:48px}.am-aside{display:grid;gap:12px}.am-panel ol{padding-left:18px}.am-panel li{padding:4px 0}.am-caution{border-color:#e5bd6530}.am-caution>svg{color:#e5bd65}
        .am-preferences{margin:18px 0}.am-preferences-title,.am-preferences-title>div{display:flex;align-items:center;gap:10px}.am-preferences-title{justify-content:space-between}.am-preferences-title svg{color:#b5ed7c}.am-preferences-title strong{font-size:13px}.am-preferences>.am-help{margin:12px 0}.am-toggle{display:flex;align-items:center;gap:8px;color:#aab8ad;font-size:10px;cursor:pointer}.am-toggle input{position:absolute;opacity:0}.am-toggle span{width:32px;height:18px;border-radius:20px;background:#344239;position:relative}.am-toggle span:after{content:"";position:absolute;left:3px;top:3px;width:12px;height:12px;border-radius:50%;background:#bec9c0;transition:.15s}.am-toggle input:checked+span{background:#75ad3d}.am-toggle input:checked+span:after{left:17px;background:#efffe2}.am-preferences>.am-secondary{margin-top:14px}
        .am-offers,.am-campaigns{display:grid;gap:12px;margin-top:18px}.am-offer,.am-campaign{padding:18px;border:1px solid #ffffff15;border-radius:16px;background:#0d1711}.am-offer-head,.am-campaign{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.am-offer h2,.am-campaign h2{font-size:18px;margin:7px 0}.am-offer-head p,.am-campaign p{color:#88968b;font-size:11px;margin:0 0 13px}.am-status{display:inline-flex;padding:6px 9px;border-radius:20px;background:#ffffff0e;color:#aab8ad;font-size:10px;text-transform:capitalize}.am-status.pending,.am-status.active{background:#8acb3818;color:#c4ef95}.am-offer video{max-height:280px}.am-offer-facts{display:flex;flex-wrap:wrap;gap:15px;margin:14px 0;color:#d6e5d6;font-size:11px}.am-offer-facts span{display:flex;align-items:center;gap:6px}.am-offer-facts svg{color:#b4e881}.am-offer-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}.am-campaign{align-items:center;flex-wrap:wrap}.am-campaign>div:first-child{flex:1;min-width:180px}.am-campaign-meta{display:grid;justify-items:end;gap:8px}.am-campaign-meta strong{font-size:13px}.am-settled{display:flex;align-items:center;gap:5px;color:#b9ee8c;font-size:11px}.am-empty{min-height:200px;display:grid;place-content:center;justify-items:center;gap:9px;border:1px dashed #ffffff22;border-radius:16px;text-align:center;padding:20px}.am-empty svg{color:#b5e982}.am-empty strong{font-size:14px}.am-empty p{max-width:420px;color:#8c9a8f;font-size:11px;line-height:1.6}.am-alert{margin:0 0 14px;padding:12px 14px;border-radius:10px;font-size:12px}.am-alert.error{border:1px solid #ef777744;background:#ef777714;color:#ffb1ab}.am-alert.success{border:1px solid #a9e76b44;background:#a9e76b12;color:#c8f49f}.am-loading{padding:22px;color:#91a096;font-size:12px}
        .am-report{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;width:100%;padding:14px;border:1px solid #ffffff13;border-radius:12px;background:#070e09}.am-report div{display:grid;gap:5px}.am-report span,.am-report small{color:#89988d;font-size:10px}.am-report b{font-size:12px}.am-report small{grid-column:1/-1;line-height:1.5;margin-top:4px}
        @media(max-width:760px){.am-grid{grid-template-columns:1fr}.am-form-layout{grid-template-columns:1fr}.am-aside{grid-template-columns:1fr 1fr}.am-metrics{grid-template-columns:1fr}.am-metrics article{grid-template-columns:1fr auto}.am-metrics small{grid-column:1/-1}.am-main{padding-top:20px}}
        @media(max-width:520px){.am-brand small{display:none}.am-header{gap:9px}.am-balance{font-size:11px}.am-nav{top:68px}.am-aside{grid-template-columns:1fr}.am-two{grid-template-columns:1fr}.am-offer-actions{justify-content:stretch}.am-offer-actions button{flex:1}}
        .am-shell{isolation:isolate;background:#060b09;scrollbar-color:#344539 #080e0b}
        .am-shell:before,.am-shell:after{position:fixed;inset:0;content:"";pointer-events:none}
        .am-shell:before{z-index:-2;background:radial-gradient(ellipse at 12% 8%,rgba(116,210,61,.16),transparent 30%),radial-gradient(ellipse at 88% 26%,rgba(67,160,139,.12),transparent 33%),radial-gradient(ellipse at 48% 100%,rgba(109,82,186,.12),transparent 38%),linear-gradient(145deg,#07100c 0%,#080d0c 54%,#070a0f 100%)}
        .am-shell:after{z-index:-1;opacity:.23;background-image:linear-gradient(rgba(196,255,200,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(196,255,200,.055) 1px,transparent 1px);background-size:48px 48px;mask-image:linear-gradient(to bottom,black,transparent 88%)}
        .am-header{background:rgba(7,13,10,.78);border-color:rgba(216,255,220,.1);box-shadow:0 12px 40px rgba(0,0,0,.16)}
        .am-icon{transition:background .2s ease,border-color .2s ease,transform .2s ease}.am-icon:hover{background:#ffffff13;border-color:#c5f58f55;transform:translateY(-1px)}
        .am-brand>div{box-shadow:0 0 24px rgba(159,233,88,.19);border:1px solid rgba(184,250,105,.18)}
        .am-brand b{letter-spacing:-.02em}
        .am-balance{padding:9px 12px;border:1px solid rgba(193,245,143,.16);border-radius:999px;background:rgba(151,215,84,.07)}
        .am-nav{background:rgba(7,13,10,.72);backdrop-filter:blur(18px);border-color:rgba(216,255,220,.08)}
        .am-nav button{transition:color .2s ease,background .2s ease,border-color .2s ease}.am-nav button:hover{color:#eaf8e3;background:#ffffff08}
        .am-nav button.active{background:linear-gradient(120deg,rgba(177,239,113,.16),rgba(75,172,140,.1));box-shadow:inset 0 0 0 1px rgba(186,239,135,.06)}
        .am-main>section{animation:am-enter .38s cubic-bezier(.2,.7,.25,1) both}
        .am-hero{min-height:320px;display:flex;flex-direction:column;justify-content:center;border-color:rgba(196,255,149,.17);background:radial-gradient(ellipse at 80% 6%,rgba(173,239,105,.18),transparent 34%),radial-gradient(ellipse at 100% 100%,rgba(78,180,158,.14),transparent 43%),linear-gradient(125deg,rgba(19,34,25,.92),rgba(10,18,14,.86) 55%,rgba(10,17,19,.9));box-shadow:0 30px 90px rgba(0,0,0,.2),inset 0 1px rgba(255,255,255,.06)}
        .am-hero:after{position:absolute;content:"";width:min(38vw,400px);aspect-ratio:1;right:4%;top:50%;border:1px solid rgba(193,255,145,.13);border-radius:50%;transform:translateY(-50%);box-shadow:0 0 0 34px rgba(177,239,113,.025),0 0 0 78px rgba(177,239,113,.018),inset 0 0 70px rgba(177,239,113,.05);pointer-events:none}
        .am-hero:before{position:absolute;content:"";width:min(23vw,245px);aspect-ratio:1;right:calc(4% + min(7.5vw,78px));top:50%;border-radius:50%;transform:translateY(-50%);background:radial-gradient(circle at 35% 32%,rgba(213,255,177,.15),rgba(115,188,85,.045) 42%,transparent 70%);filter:blur(1px);pointer-events:none}
        .am-hero>*{position:relative;z-index:1}
        .am-hero h1{max-width:680px;font-size:clamp(42px,7vw,78px);font-weight:750;letter-spacing:-.065em}.am-hero h1 em{font-style:normal;color:#c5f58f;text-shadow:0 0 34px rgba(180,237,120,.2)}
        .am-hero p{max-width:420px;color:#b1beb3;font-size:14px}
        .am-eyebrow{letter-spacing:.16em}
        .am-primary,.am-secondary{transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease,background .2s ease}
        .am-primary:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 9px 28px rgba(177,239,113,.18);background:#c9f693}
        .am-secondary:hover:not(:disabled){transform:translateY(-1px);border-color:#b9ed7755;background:#b9ed7710}
        .am-metrics article,.am-panel,.am-offer,.am-campaign{position:relative;overflow:hidden;border-color:rgba(211,255,222,.1);background:linear-gradient(145deg,rgba(20,31,24,.82),rgba(10,17,13,.83));box-shadow:0 15px 44px rgba(0,0,0,.12),inset 0 1px rgba(255,255,255,.035);backdrop-filter:blur(14px)}
        .am-metrics article:before,.am-panel:before,.am-offer:before,.am-campaign:before{position:absolute;inset:0 0 auto;height:1px;content:"";background:linear-gradient(90deg,transparent,rgba(196,255,160,.28),transparent);opacity:.6;pointer-events:none}
        .am-metrics article{min-height:112px;align-content:center;transition:transform .22s ease,border-color .22s ease}
        .am-metrics article:hover,.am-grid .am-panel:hover{transform:translateY(-3px);border-color:rgba(193,245,143,.24)}
        .am-metrics strong{color:#f3f8ef;font-size:28px}
        .am-panel{transition:transform .22s ease,border-color .22s ease}
        .am-grid .am-panel{min-height:158px}
        .am-grid .am-panel>svg{filter:drop-shadow(0 0 8px rgba(183,239,125,.3))}
        .am-form,.am-preferences{border-color:rgba(211,255,222,.12)}
        .am-form input:not([type=radio]),.am-form select{background:rgba(4,10,7,.78);border-color:rgba(214,255,220,.14);transition:border-color .2s ease,box-shadow .2s ease}
        .am-form input:focus,.am-form select:focus{border-color:#b4e881;box-shadow:0 0 0 3px rgba(180,232,129,.1)}
        .am-form fieldset{border-color:rgba(214,255,220,.13);background:rgba(3,10,7,.2)}
        .am-topics button{transition:all .18s ease}.am-topics button:hover{border-color:rgba(194,242,151,.42);color:#e4f7d8;transform:translateY(-1px)}
        .am-topics button.selected{box-shadow:0 0 18px rgba(164,232,75,.09)}
        .am-economics{background:linear-gradient(120deg,rgba(145,207,69,.09),rgba(70,165,143,.06));border-color:rgba(184,237,115,.25)}
        .am-upload-button{transition:background .2s ease,border-color .2s ease}.am-upload-button:hover{background:#a4e84616;border-color:#bbeb7b99}
        .am-offer,.am-campaign{transition:border-color .2s ease,transform .2s ease}.am-offer:hover,.am-campaign:hover{border-color:rgba(193,245,143,.2)}
        .am-status{border:1px solid rgba(255,255,255,.08)}
        .am-status.active,.am-status.pending{border-color:rgba(177,239,113,.2)}
        .am-empty{border-color:rgba(214,255,220,.2);background:rgba(12,21,15,.36)}
        .am-alert{backdrop-filter:blur(14px)}
        .am-report{border-color:rgba(214,255,220,.1);background:rgba(4,10,7,.58)}
        .am-campaign .am-help{display:block}
        .am-note{background:rgba(186,152,69,.06);border-color:rgba(230,189,101,.22)}
        @keyframes am-enter{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @media(max-width:760px){.am-hero{min-height:290px}.am-hero:after{right:-16%;opacity:.55}.am-hero:before{right:-3%;opacity:.55}.am-grid .am-panel{min-height:0}}
        @media(max-width:520px){.am-hero{min-height:280px;padding:26px 22px}.am-hero h1{font-size:46px}.am-hero:after{width:230px;right:-110px}.am-hero:before{width:140px;right:-62px}.am-main{padding-bottom:40px}.am-metrics{gap:8px}.am-metrics article{min-height:82px;padding:14px 16px}.am-nav{gap:4px;padding-top:9px;padding-bottom:9px}.am-nav button{padding:9px 11px;font-size:11px}.am-report{grid-template-columns:repeat(2,1fr)}}
        @media(prefers-reduced-motion:reduce){.am-main>section{animation:none}.am-icon,.am-primary,.am-secondary,.am-panel,.am-metrics article,.am-topics button{transition:none}}
      `}</style>
    </div>
  );
}
