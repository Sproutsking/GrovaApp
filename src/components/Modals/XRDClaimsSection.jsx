import React, { useState } from "react";
import {
  AlertTriangle, ArrowRight, BadgeCheck, Check, ChevronDown,
  CircleHelp, Clock3, Download, FileCheck2, FileText, Github, Link2,
  LoaderCircle, Plus, RefreshCw, ShieldCheck, Unplug, WifiOff,
} from "lucide-react";
import { buildPortableXrdPortfolio, downloadPortableXrdPortfolio } from "../../services/evidence/xrdPortableCredential";

const RECORD_TYPES = [
  ["contribution", "Contribution"],
  ["project", "Project"],
  ["employment", "Employment"],
  ["education", "Education"],
  ["credential", "Credential"],
  ["community", "Community"],
  ["achievement", "Achievement"],
  ["other", "Other"],
];

const SOURCE_CHECK_COPY = {
  matched: [Check, "Snapshot matched", "tone-good"],
  changed: [AlertTriangle, "Source changed", "tone-warn"],
  not_found: [FileText, "Not returned", "tone-warn"],
  unavailable: [WifiOff, "Source unavailable", "tone-neutral"],
  indeterminate: [CircleHelp, "Inconclusive", "tone-neutral"],
};

const statusLabel = (record) => {
  if (record.lifecycle_status === "withdrawn") return "Withdrawn";
  if (record.lifecycle_status === "superseded") return "Superseded";
  return "Self-asserted";
};

const XRDClaimsSection = ({
  own,
  claims = [],
  evidenceItems = [],
  identityBindings = [],
  profile,
  connection,
  binding,
  sourceBusy = "",
  loading = false,
  error = "",
  notice = "",
  onRetry,
  onConnect,
  onSync,
  onDisconnect,
  onCreateClaim,
  onRunSourceCheck,
  onOpenEvidence,
}) => {
  const [composerOpen, setComposerOpen] = useState(false);
  const [recordType, setRecordType] = useState("contribution");
  const [title, setTitle] = useState("");
  const [claimText, setClaimText] = useState("");
  const [structuredClaim, setStructuredClaim] = useState({
    role: "",
    organization: "",
    startDate: "",
    endDate: "",
    projectUrl: "",
  });
  const [visibility, setVisibility] = useState("private");
  const [evidenceId, setEvidenceId] = useState("");
  const [relation, setRelation] = useState("supports");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const [selectedRecordIds, setSelectedRecordIds] = useState([]);
  const [portfolioError, setPortfolioError] = useState("");
  const connected = connection?.auth_status === "active";
  const githubEvidence = evidenceItems.filter((item) => String(item.provider || "").toLowerCase() === "github");

  const submitClaim = async (event) => {
    event.preventDefault();
    if (!own || saving || title.trim().length < 2 || claimText.trim().length < 5) return;
    if (evidenceId && !evidenceItems.some((item) => item.id === evidenceId)) {
      setFormError("Choose evidence that is currently available in your XRD.");
      return;
    }
    if (structuredClaim.startDate && structuredClaim.endDate && structuredClaim.endDate < structuredClaim.startDate) {
      setFormError("The end date must be on or after the start date.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await onCreateClaim({
        recordType,
        title: title.trim(),
        claimText: claimText.trim(),
        structuredClaim: Object.fromEntries(Object.entries(structuredClaim).filter(([, value]) => value.trim())),
        visibility,
        evidenceId,
        relation,
      });
      setTitle("");
      setClaimText("");
      setStructuredClaim({ role: "", organization: "", startDate: "", endDate: "", projectUrl: "" });
      setEvidenceId("");
      setComposerOpen(false);
    } catch (submitError) {
      setFormError(submitError?.message || "The claim could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const openPortfolio = () => {
    setSelectedRecordIds(claims
      .filter((claim) => claim.lifecycle_status === "published" && claim.visibility === "public")
      .map((claim) => claim.id));
    setPortfolioError("");
    setPortfolioOpen(true);
  };

  const exportPortfolio = () => {
    setPortfolioError("");
    try {
      const selectedClaims = claims.filter((claim) => selectedRecordIds.includes(claim.id));
      const portfolio = buildPortableXrdPortfolio({
        claims: selectedClaims,
        profile,
        bindings: identityBindings,
        evidenceItems,
      });
      downloadPortableXrdPortfolio(portfolio);
      setPortfolioOpen(false);
    } catch (exportError) {
      setPortfolioError(exportError?.message || "The hiring record could not be exported.");
    }
  };

  return (
    <section className="xrd-claims-section" aria-labelledby="xrd-claims-heading">
      <style>{`
        .xrd-claims-section{display:grid;gap:14px}
        .xrd-claims-section button,.xrd-claims-section input,.xrd-claims-section select,.xrd-claims-section textarea{font:inherit}
        .xrd-github-slice{position:relative;overflow:hidden;padding:15px;border:1px solid rgba(163,230,53,.28);border-radius:14px;background:radial-gradient(ellipse at 100% 0,rgba(16,185,129,.08),transparent 42%),linear-gradient(145deg,#090c08,#030403)}
        .xrd-github-slice:before{position:absolute;left:16px;right:16px;top:0;height:1px;background:linear-gradient(90deg,transparent,rgba(163,230,53,.6),transparent);content:""}
        .xrd-github-head{position:relative;display:flex;align-items:flex-start;gap:11px}
        .xrd-github-icon{width:37px;height:37px;display:grid;place-items:center;flex:none;border:1px solid rgba(255,255,255,.12);border-radius:10px;background:#111510;color:#e5e7eb}
        .xrd-github-copy{min-width:0;flex:1}.xrd-github-copy h3{margin:0;color:#e8eee4;font-size:13px;font-weight:800}.xrd-github-copy p{margin:4px 0 0;color:#879181;font-size:10px;line-height:1.5}
        .xrd-github-state{display:inline-flex;align-items:center;gap:5px;margin-top:8px;color:#aab5a4;font-size:9px;font-weight:700}.xrd-github-state.active{color:#bef264}.xrd-github-state svg{flex:none}
        .xrd-github-actions{position:relative;display:flex;flex-wrap:wrap;justify-content:flex-end;gap:7px;margin-top:12px}
        .xrd-github-actions button,.xrd-claim-add,.xrd-claim-submit{min-height:32px;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 10px;border:1px solid #30372e;border-radius:8px;background:#070907;color:#d4ddce;font-size:10px;font-weight:700;cursor:pointer;transition:border-color .15s,background .15s,transform .15s}
        .xrd-github-actions button:hover,.xrd-claim-add:hover{border-color:rgba(163,230,53,.55);background:rgba(163,230,53,.06)}
        .xrd-github-actions button.primary,.xrd-claim-submit{border-color:#a3e635;background:linear-gradient(180deg,#b8f34e,#84cc16);color:#10170a}
        .xrd-github-actions button.danger{border-color:rgba(248,113,113,.25);color:#fca5a5}
        .xrd-github-actions button:disabled,.xrd-claim-submit:disabled{opacity:.55;cursor:wait}
        .xrd-github-disclosure{position:relative;display:flex;gap:7px;margin:12px 0 0;padding-top:10px;border-top:1px solid #20251f;color:#929c8c;font-size:9px;line-height:1.5}
        .xrd-github-disclosure svg{flex:none;color:#a3e635}
        .xrd-claims-titlebar{display:flex;align-items:center;gap:10px}.xrd-claims-titlebar h3{margin:0;color:#e8eee4;font-size:14px;font-weight:800}.xrd-claims-titlebar p{margin:3px 0 0;color:#7f897b;font-size:10px;line-height:1.45}.xrd-claims-titlebar>div{flex:1;min-width:0}
        .xrd-claim-add{flex:none}.xrd-claim-add svg{color:#a3e635}
        .xrd-claim-form{display:grid;gap:10px;padding:14px;border:1px solid rgba(163,230,53,.27);border-radius:12px;background:linear-gradient(155deg,rgba(12,17,10,.94),rgba(4,6,4,.98))}
        .xrd-claim-form-grid{display:grid;grid-template-columns:1fr 1.2fr;gap:9px}
        .xrd-claim-form label{display:grid;gap:5px;color:#aab4a5;font-size:9px;font-weight:750}.xrd-claim-form input,.xrd-claim-form select,.xrd-claim-form textarea{width:100%;min-width:0;padding:9px 10px;border:1px solid #2a3228;border-radius:8px;outline:none;background:#050705;color:#e7eee2;font-size:11px}.xrd-claim-form textarea{min-height:84px;resize:vertical;line-height:1.5}.xrd-claim-form input:focus,.xrd-claim-form select:focus,.xrd-claim-form textarea:focus{border-color:#84cc16;box-shadow:0 0 0 2px rgba(132,204,22,.1)}
        .xrd-claim-form-row{display:grid;grid-template-columns:1fr 1fr;gap:9px}.xrd-claim-form-actions{display:flex;justify-content:flex-end;gap:7px}.xrd-claim-form-actions .cancel{border:1px solid #2a3228;border-radius:8px;padding:0 10px;background:transparent;color:#aab4a5;font-size:10px;cursor:pointer}
        .xrd-claim-error{margin:0;color:#fca5a5;font-size:10px}.xrd-claim-notice{margin:0;padding:9px 10px;border:1px solid rgba(163,230,53,.2);border-radius:8px;background:rgba(163,230,53,.04);color:#c6dfa7;font-size:10px;line-height:1.5}
        .xrd-claim-list{display:grid;gap:9px}.xrd-claim-card{overflow:hidden;border:1px solid #252b24;border-radius:12px;background:linear-gradient(140deg,rgba(255,255,255,.025),rgba(255,255,255,.008))}.xrd-claim-card-head{display:flex;align-items:flex-start;gap:10px;padding:13px}.xrd-claim-mark{width:34px;height:34px;display:grid;place-items:center;flex:none;border:1px solid rgba(163,230,53,.2);border-radius:9px;background:rgba(163,230,53,.055);color:#a3e635}
        .xrd-claim-main{flex:1;min-width:0}.xrd-claim-top{display:flex;align-items:flex-start;justify-content:space-between;gap:9px}.xrd-claim-top h4{margin:0;color:#e7eee2;font-size:12px;font-weight:800;line-height:1.4}.xrd-claim-type{display:block;margin-top:3px;color:#747e70;font:650 8px/1.4 ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase}.xrd-claim-state{flex:none;padding:4px 7px;border:1px solid rgba(251,191,36,.24);border-radius:99px;background:rgba(251,191,36,.045);color:#fcd34d;font:700 8px/1.2 ui-monospace,monospace;text-transform:uppercase}
        .xrd-claim-body{margin:9px 0 0;color:#b8c2b2;font-size:11px;line-height:1.55}.xrd-claim-professional-details{margin:5px 0 0;color:#9eae94;font-size:10px;line-height:1.45}.xrd-claim-meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}.xrd-claim-meta span{display:inline-flex;align-items:center;gap:5px;padding:4px 7px;border:1px solid #252b24;border-radius:6px;color:#8f9a89;background:#050705;font-size:8px}.xrd-claim-meta svg{color:#a3e635}
        .xrd-claim-expand{display:flex;align-items:center;gap:5px;margin-left:auto;border:0;background:transparent;color:#91a187;font-size:9px;font-weight:700;cursor:pointer}.xrd-claim-expand svg{transition:transform .15s}.xrd-claim-expand[aria-expanded="true"] svg{transform:rotate(180deg)}
        .xrd-claim-detail{padding:0 13px 13px 57px}.xrd-claim-path{display:grid;gap:0;margin-top:2px}.xrd-claim-path-row{position:relative;display:grid;grid-template-columns:13px minmax(0,1fr);gap:8px;min-height:23px;color:#9da897;font-size:9px;line-height:1.45}.xrd-claim-path-row:not(:last-child):before{position:absolute;top:10px;bottom:-3px;left:4px;width:1px;background:#353d32;content:""}.xrd-claim-path-row i{z-index:1;width:9px;height:9px;margin-top:2px;border:1.5px solid #789355;border-radius:50%;background:#070907}.xrd-claim-path-row.is-evidence i{border-color:#60a5fa}.xrd-claim-path-row.is-check i{border-color:#fbbf24}
        .xrd-claim-check{display:flex;align-items:flex-start;gap:7px;margin-top:10px;padding:9px;border:1px solid #252b24;border-radius:8px;background:#060806;color:#a8b2a1;font-size:9px;line-height:1.5}.xrd-claim-check svg{flex:none;margin-top:1px}.xrd-claim-check.tone-good svg{color:#a3e635}.xrd-claim-check.tone-warn svg{color:#fbbf24}.xrd-claim-check.tone-neutral svg{color:#8aa2bf}
        .xrd-claim-card-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}.xrd-claim-card-actions button{display:inline-flex;align-items:center;gap:5px;padding:6px 8px;border:1px solid #2c3429;border-radius:7px;background:#050705;color:#bfccb8;font-size:9px;font-weight:700;cursor:pointer}.xrd-claim-card-actions button:hover{border-color:rgba(163,230,53,.45);color:#d9f99d}.xrd-claim-card-actions button:disabled{opacity:.55;cursor:wait}
        .xrd-claim-empty,.xrd-claim-loading,.xrd-claim-error-state{display:grid;justify-items:center;gap:8px;min-height:115px;align-content:center;padding:18px;border:1px dashed #30372e;border-radius:11px;text-align:center;background:rgba(0,0,0,.24)}.xrd-claim-empty svg,.xrd-claim-loading svg,.xrd-claim-error-state svg{color:#8b9784}.xrd-claim-empty strong,.xrd-claim-loading strong,.xrd-claim-error-state strong{color:#dce5d7;font-size:11px}.xrd-claim-empty p,.xrd-claim-loading p,.xrd-claim-error-state p{max-width:42ch;margin:0;color:#7f897b;font-size:9px;line-height:1.5}.xrd-claim-loading svg{animation:xrdClaimsSpin .9s linear infinite}@keyframes xrdClaimsSpin{to{transform:rotate(360deg)}}
        .xrd-portfolio-panel{display:grid;gap:10px;padding:14px;border:1px solid rgba(163,230,53,.28);border-radius:12px;background:radial-gradient(ellipse at 100% 0,rgba(16,185,129,.08),transparent 42%),#050705}.xrd-portfolio-panel h4{margin:0;color:#e8eee4;font-size:12px}.xrd-portfolio-panel p{margin:0;color:#929c8c;font-size:10px;line-height:1.5}.xrd-portfolio-options{display:grid;gap:6px;max-height:210px;overflow:auto}.xrd-portfolio-options label{display:flex;align-items:flex-start;gap:8px;padding:8px;border:1px solid #252b24;border-radius:8px;color:#c5cec0;font-size:10px}.xrd-portfolio-options input{accent-color:#a3e635}.xrd-portfolio-actions{display:flex;justify-content:flex-end;gap:7px}.xrd-portfolio-actions button{min-height:32px;padding:0 10px;border:1px solid #30372e;border-radius:8px;background:#070907;color:#d4ddce;font-size:10px;font-weight:700;cursor:pointer}.xrd-portfolio-actions .primary{border-color:#a3e635;background:linear-gradient(180deg,#b8f34e,#84cc16);color:#10170a}
        @media(max-width:600px){.xrd-claim-form-grid,.xrd-claim-form-row{grid-template-columns:1fr}.xrd-claim-top{flex-direction:column}.xrd-claim-state{align-self:flex-start}.xrd-claim-detail{padding-left:13px}.xrd-github-actions{justify-content:flex-start}}
        @media(prefers-reduced-motion:reduce){.xrd-claim-expand svg,.xrd-claim-loading svg{transition:none;animation:none}}
      `}</style>

      <div className="xrd-github-slice">
        <div className="xrd-github-head">
          <span className="xrd-github-icon"><Github size={19} /></span>
          <div className="xrd-github-copy">
            <h3>GitHub evidence slice</h3>
            <p>{connected ? `${connection.platform_user_id || "GitHub account"} · ${githubEvidence.length} stored evidence item${githubEvidence.length === 1 ? "" : "s"}` : "Connect one provider to build a traceable record from source to claim."}</p>
            {connected && <span className="xrd-github-state active"><BadgeCheck size={12} />Connected · account control bound</span>}
            {!connected && <span className="xrd-github-state"><Link2 size={12} />Not connected</span>}
            {binding && <span className="xrd-github-state"><ShieldCheck size={12} />Binding: {binding.status} · {String(binding.assurance_scope || "account_control").replaceAll("_", " ")}</span>}
          </div>
          {connected && <span className="xrd-claim-state">OAUTH</span>}
        </div>
        {own && <div className="xrd-github-actions">
          {!connected ? <button type="button" className="primary" disabled={sourceBusy === "github"} onClick={onConnect}>{sourceBusy === "github" ? <><LoaderCircle size={12} />Connecting…</> : <><Link2 size={12} />Connect GitHub</>}</button> : <>
            <button type="button" disabled={sourceBusy === "github"} onClick={onSync}>{sourceBusy === "github" ? <><LoaderCircle size={12} />Syncing…</> : <><RefreshCw size={12} />Sync evidence</>}</button>
            <button type="button" className="danger" disabled={sourceBusy === "github"} onClick={onDisconnect}><Unplug size={12} />Revoke connection</button>
          </>}
        </div>}
        <p className="xrd-github-disclosure"><ShieldCheck size={12} />OAuth supports control of this GitHub account. Public profile/activity observations are source-linked evidence, not proof of employment, authorship, or every claim.</p>
      </div>

      <div className="xrd-claims-titlebar">
        <div><h3 id="xrd-claims-heading">XRD claims</h3><p>Claims are self-authored until a source-specific method checks them.</p></div>
        {own && <button type="button" className="xrd-claim-add" onClick={openPortfolio}><Download size={13} />Hiring pack</button>}
        {own && <button type="button" className="xrd-claim-add" onClick={() => setComposerOpen((open) => !open)}><Plus size={13} />Add claim</button>}
      </div>

      {portfolioOpen && own && <div className="xrd-portfolio-panel" aria-label="Prepare a portable hiring record">
        <div><h4>Prepare a portable hiring record</h4><p>Choose the published records to include. Private records start unchecked; selecting one copies its claim and linked source observations into a local file. No raw provider payloads or access tokens are included. The export is unsigned and does not imply independent verification.</p></div>
        <div className="xrd-portfolio-options">
          {claims.filter((claim) => claim.lifecycle_status === "published").map((claim) => <label key={claim.id}>
            <input type="checkbox" checked={selectedRecordIds.includes(claim.id)} onChange={(event) => setSelectedRecordIds((current) => event.target.checked ? [...current, claim.id] : current.filter((id) => id !== claim.id))} />
            <span><strong>{claim.title}</strong><br />{claim.record_type} · {claim.visibility}{claim.visibility !== "public" ? " · private" : ""}</span>
          </label>)}
          {!claims.some((claim) => claim.lifecycle_status === "published") && <p>No published records are available to export.</p>}
        </div>
        {portfolioError && <p className="xrd-claim-error" role="alert">{portfolioError}</p>}
        <div className="xrd-portfolio-actions"><button type="button" onClick={() => setPortfolioOpen(false)}>Cancel</button><button type="button" className="primary" disabled={!selectedRecordIds.length} onClick={exportPortfolio}><Download size={12} />Download {selectedRecordIds.length} record{selectedRecordIds.length === 1 ? "" : "s"}</button></div>
      </div>}

      {notice && <p className="xrd-claim-notice" role="status">{notice}</p>}
      {error && <div className="xrd-claim-error-state" role="alert"><AlertTriangle size={17} /><strong>Claims could not be loaded</strong><p>{error}</p>{onRetry && <button type="button" className="xrd-claim-add" onClick={onRetry}><RefreshCw size={12} />Retry</button>}</div>}

      {composerOpen && own && <form className="xrd-claim-form" onSubmit={submitClaim}>
        <div className="xrd-section-heading"><div><span className="xrd-kicker">NEW XRD RECORD</span><h3>Write the claim first; attach evidence separately</h3></div></div>
        <div className="xrd-claim-form-grid">
          <label>Record type<select value={recordType} onChange={(event) => setRecordType(event.target.value)}>{RECORD_TYPES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <label>Title<input required minLength={2} maxLength={180} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Maintains the Atlas open-source library" /></label>
        </div>
        <label>Claim<textarea required minLength={5} maxLength={4000} value={claimText} onChange={(event) => setClaimText(event.target.value)} placeholder="State the specific contribution, dates, and scope you want this record to represent." /></label>
        <div className="xrd-claim-form-grid">
          <label>Role<input maxLength={200} value={structuredClaim.role} onChange={(event) => setStructuredClaim((current) => ({ ...current, role: event.target.value }))} placeholder="Project lead, maintainer, researcher" /></label>
          <label>Organization or project<input maxLength={200} value={structuredClaim.organization} onChange={(event) => setStructuredClaim((current) => ({ ...current, organization: event.target.value }))} placeholder="Organization or project name" /></label>
        </div>
        <div className="xrd-claim-form-grid">
          <label>Start date<input type="date" value={structuredClaim.startDate} onChange={(event) => setStructuredClaim((current) => ({ ...current, startDate: event.target.value }))} /></label>
          <label>End date<input type="date" value={structuredClaim.endDate} onChange={(event) => setStructuredClaim((current) => ({ ...current, endDate: event.target.value }))} /></label>
        </div>
        <label>Project or source URL (optional)<input type="url" maxLength={2000} value={structuredClaim.projectUrl} onChange={(event) => setStructuredClaim((current) => ({ ...current, projectUrl: event.target.value }))} placeholder="https://…" /></label>
        <div className="xrd-claim-form-row">
          <label>Visibility<select value={visibility} onChange={(event) => setVisibility(event.target.value)}><option value="private">Private to you</option><option value="public">Public record</option></select></label>
          <label>Link GitHub evidence (optional)<select value={evidenceId} onChange={(event) => setEvidenceId(event.target.value)}><option value="">No evidence selected</option>{evidenceItems.map((item) => <option key={item.id} value={item.id}>{item.provider} · {item.title || item.evidence_type || "Evidence"}</option>)}</select></label>
        </div>
        {evidenceId && <label>Relationship<select value={relation} onChange={(event) => setRelation(event.target.value)}><option value="supports">Evidence supports this claim</option><option value="contradicts">Evidence contradicts this claim</option></select></label>}
        {formError && <p className="xrd-claim-error" role="alert">{formError}</p>}
        <div className="xrd-claim-form-actions"><button type="button" className="cancel" onClick={() => setComposerOpen(false)}>Cancel</button><button type="submit" className="xrd-claim-submit" disabled={saving || title.trim().length < 2 || claimText.trim().length < 5}>{saving ? <><LoaderCircle size={13} />Saving…</> : <><Check size={13} />Save self-authored claim</>}</button></div>
      </form>}

      {loading ? <div className="xrd-claim-loading" role="status"><LoaderCircle size={19} /><strong>Loading XRD claims</strong><p>Reading claim records, visible evidence links, and recent source checks.</p></div>
        : !error && !claims.length ? <div className="xrd-claim-empty"><FileText size={20} /><strong>No XRD claims yet</strong><p>Connect GitHub and add a claim to create the first traceable path. Example fixtures above are synthetic and are not saved to your profile.</p></div>
          : <div className="xrd-claim-list">{claims.map((claim) => {
            const expanded = expandedId === claim.id;
            const latestCheck = claim.latest_source_check;
            const checkInfo = latestCheck && SOURCE_CHECK_COPY[latestCheck.result_status];
            const CheckIcon = checkInfo?.[0];
            const details = claim.structured_claim || {};
            const dateRange = [details.startDate, details.endDate].filter(Boolean).join(" – ");
            const professionalDetails = [details.role, details.organization, dateRange].filter(Boolean);
            const linkedEvidence = (claim.evidence_links || []).map((link) => ({
              ...link,
              item: evidenceItems.find((item) => item.id === link.evidence_item_id),
            })).filter((link) => link.item);
            return <article className="xrd-claim-card" key={claim.id}>
              <div className="xrd-claim-card-head">
                <span className="xrd-claim-mark"><FileCheck2 size={16} /></span>
                <div className="xrd-claim-main">
                  <div className="xrd-claim-top"><div><h4>{claim.title}</h4><span className="xrd-claim-type">{String(claim.record_type || "other").replaceAll("_", " ")} · {claim.visibility}</span></div><span className="xrd-claim-state">{statusLabel(claim)}</span></div>
                  <p className="xrd-claim-body">{claim.claim_text}</p>
                  {professionalDetails.length > 0 && <p className="xrd-claim-professional-details">{professionalDetails.join(" · ")}</p>}
                  <div className="xrd-claim-meta"><span><Clock3 size={10} />{new Date(claim.created_at).toLocaleDateString()}</span><span><FileText size={10} />{linkedEvidence.length} linked evidence</span><button type="button" className="xrd-claim-expand" aria-expanded={expanded} onClick={() => setExpandedId((current) => current === claim.id ? null : claim.id)}>{expanded ? "Hide provenance" : "Trace provenance"}<ChevronDown size={12} /></button></div>
                  {latestCheck && checkInfo && <div className={`xrd-claim-check ${checkInfo[2]}`}><CheckIcon size={13} /><span><b>{checkInfo[1]}</b> · {latestCheck.summary} · {new Date(latestCheck.completed_at).toLocaleString()}</span></div>}
                  {own && linkedEvidence.some((link) => link.item.provider.toLowerCase() === "github") && <div className="xrd-claim-card-actions"><button type="button" disabled={sourceBusy === "github"} onClick={() => onRunSourceCheck?.(claim, linkedEvidence.find((link) => link.item.provider.toLowerCase() === "github")?.item)}><RefreshCw size={11} />Check GitHub source</button></div>}
                </div>
              </div>
              {expanded && <div className="xrd-claim-detail">
                <div className="xrd-claim-path">
                  <div className="xrd-claim-path-row"><i /><span>Xeevia profile · {claim.profile_id}</span></div>
                  <div className="xrd-claim-path-row"><i /><span>Self-authored XRD claim · {statusLabel(claim)}</span></div>
                  {linkedEvidence.map((link) => <div className="xrd-claim-path-row is-evidence" key={link.id}><i /><span>{link.relation.replaceAll("_", " ")} · {link.item.provider} · {link.item.title || link.item.evidence_type}</span></div>)}
                  {latestCheck && <div className="xrd-claim-path-row is-check"><i /><span>Source observation · {latestCheck.provider} · {latestCheck.result_status}</span></div>}
                  {claim.latest_audit_event && <div className="xrd-claim-path-row"><i /><span>XRD audit event · {claim.latest_audit_event.event_type}</span></div>}
                </div>
                {linkedEvidence.map((link) => <div className="xrd-claim-check tone-neutral" key={`detail-${link.id}`}><Link2 size={12} /><span>{link.relation === "supports" ? "Linked as supporting evidence" : "Linked as contradicting evidence"}: {link.item.summary || link.item.title || "Source observation"}. This stored relationship does not independently verify the claim.</span></div>)}
                <div className="xrd-claim-card-actions"><button type="button" onClick={() => onOpenEvidence?.(linkedEvidence[0]?.item)} disabled={!linkedEvidence[0]?.item}><ArrowRight size={11} />Open linked evidence</button></div>
              </div>}
            </article>;
          })}</div>}
    </section>
  );
};

export default XRDClaimsSection;