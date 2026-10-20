import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import {
  Activity, ArrowLeft, BadgeCheck, BookOpen, Briefcase, CheckCircle2,
  ChevronRight, Database, FileCheck2, FileText, Fingerprint,
  GitBranch, GraduationCap, Layers3, LockKeyhole, Network, Search,
  Shield, ShieldCheck, Sparkles,
} from "lucide-react";
import { supabase } from "../../services/config/supabase";
import xrcService from "../../services/xrc";
const XRCOracleExplorer = lazy(() => import("../Oracle/XRCOracleExplorer"));

const NAV = [
  ["Overview", Layers3],
  ["Identity", Fingerprint],
  ["Records", FileText],
  ["Evidence", FileCheck2],
  ["Graph", Network],
  ["Chains", GitBranch],
  ["Verification", ShieldCheck],
  ["Sources", Database],
  ["Projects", Briefcase],
  ["Credentials", GraduationCap],
  ["Achievements", BookOpen],
  ["Remarks", FileText],
  ["Activity", Activity],
  ["Permissions", LockKeyhole],
  ["Audit", Shield],
  ["Settings", LockKeyhole],
  ["Oracle", Sparkles],
];

const NAV_GROUPS = [
  ["CORE", ["Overview", "Identity"]],
  ["GRAPH", ["Records", "Evidence", "Graph", "Chains", "Remarks", "Verification", "Sources"]],
  ["COLLECTIONS", ["Projects", "Credentials", "Achievements"]],
  ["CONTROL", ["Activity", "Permissions", "Audit", "Oracle", "Settings"]],
];

const OWNER_ONLY = new Set(["Chains", "Activity", "Audit", "Permissions", "Settings"]);

const SETTING_GROUPS = {
  Visibility: ["Default visibility for new records", "Show record counts to visitors", "Hide restricted records from search"],
  "Record Display": ["Pin selected records first", "Show evidence counts publicly", "Show provenance where permitted"],
  Remarks: ["Allow people to request remark access", "Show remarks publicly", "Enable owner responses", "Require evidence for remarks", "Show contested remarks publicly"],
  Verification: ["Allow public verification checks", "Show verification history", "Notify me when a record is verified"],
  Connections: ["Show connection-only records to followers", "Allow connections to request evidence"],
  Permissions: ["Require approval for evidence access", "Allow verifiers to view restricted records"],
  Sharing: ["Allow share links to XRD", "Share links expire after 30 days"],
  Notifications: ["New remark on my records", "Remark access requests", "Evidence access requests"],
  Privacy: ["Hide XRD from search engines", "Show XRD stats on profile"],
  Security: ["Require re-authentication for visibility changes", "Alert on new sign-ins"],
  Sources: ["Require approval before a source syncs new records", "Notify me when a source fails to sync"],
  Account: ["Show my XRD link on my profile", "Allow XRC Oracle to cite public records"],
  Audit: ["Keep my own audit view enabled"],
  Oracle: ["Let Oracle answer public questions", "Include restricted records in my private Oracle"],
};

const dateLabel = (value) => {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};

const countBySource = (items) => {
  const sources = new Map();
  items.forEach((item) => {
    const name = typeof item?.provider === "string" && item.provider.trim()
      ? item.provider.trim()
      : "Unknown source";
    sources.set(name, (sources.get(name) || 0) + 1);
  });
  return [...sources.entries()].sort((a, b) => b[1] - a[1]);
};

const normalizeStatus = (item) => {
  if (item?.metadata?.status) return String(item.metadata.status);
  return item?.verified ? "Verified" : "Tracked";
};

const XRDProfileDashboard = ({
  profile,
  currentUser,
  targetId,
  verificationItems = [],
  initialSection = "Overview",
  onClose,
}) => {
  const viewerId = currentUser?.id || currentUser?.uid || currentUser?.userId || currentUser?.user_id;
  const own = Boolean(viewerId && targetId && String(viewerId) === String(targetId));
  const requestedInitialSection = initialSection === "XRC Oracle" ? "Oracle" : initialSection;
  const [section, setSection] = useState(!own && OWNER_ONLY.has(requestedInitialSection) ? "Overview" : requestedInitialSection);
  const [sectionHistory, setSectionHistory] = useState([]);
  const [records, setRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(own);
  const [recordsError, setRecordsError] = useState("");
  const [filter, setFilter] = useState("");
  const [auditResult, setAuditResult] = useState({});
  const [oracleOpen, setOracleOpen] = useState(["Oracle", "XRC Oracle"].includes(initialSection));
  const [settingsGroup, setSettingsGroup] = useState("Visibility");
  const [permissionsDimension, setPermissionsDimension] = useState("Visibility");

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    setFilter("");
  }, [section]);

  const loadRecords = useCallback(async () => {
    if (!own) return;
    setRecordsLoading(true);
    setRecordsError("");
    try {
      const { data, error } = await supabase
        .from("xrc_records")
        .select("record_id,stream_type,previous_hash,record_hash,actor_id,payload,timestamp,version,created_at")
        .eq("actor_id", targetId)
        .order("timestamp", { ascending: false })
        .limit(100);
      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error("[XRD] Could not load the owner's XRC records:", error);
      setRecordsError(error?.message || "XRC records could not be loaded.");
    } finally {
      setRecordsLoading(false);
    }
  }, [own, targetId]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const sources = useMemo(() => countBySource(verificationItems), [verificationItems]);
  const verifiedCount = verificationItems.filter((item) => item?.verified).length;
  const institutionCount = new Set(verificationItems
    .filter((item) => ["institution", "organization"].includes(String(
      item?.entity_type || item?.entityType || item?.metadata?.entityType || item?.metadata?.entity_type || "",
    ).toLowerCase()))
    .map((item) => item?.provider || item?.metadata?.institution || item?.title)
    .filter(Boolean)).size;
  const filteredEvidence = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return verificationItems;
    return verificationItems.filter((item) =>
      [item.title, item.summary, item.provider, item.evidence_type]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [filter, verificationItems]);
  const filteredRecords = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return records;
    return records.filter((record) =>
      [record.record_id, record.stream_type, record.payload?.event, JSON.stringify(record.payload || {})]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [filter, records]);
  const profileName = profile?.fullName || profile?.username || "Xeevia member";
  const initials = profileName.trim().charAt(0).toUpperCase() || "X";

  const openOracle = () => setOracleOpen(true);
  const navigateSection = (nextSection) => {
    if (!nextSection || nextSection === section) return;
    setSectionHistory((previous) => [...previous, section]);
    setSection(nextSection);
  };
  const goBack = () => {
    if (!sectionHistory.length) {
      onClose();
      return;
    }
    setSection(sectionHistory[sectionHistory.length - 1]);
    setSectionHistory((previous) => previous.slice(0, -1));
  };
  const checkRecord = async (recordId) => {
    setAuditResult((previous) => ({ ...previous, [recordId]: { loading: true } }));
    try {
      const result = await xrcService.verifyRecord(recordId);
      setAuditResult((previous) => ({
        ...previous,
        [recordId]: result?.error
          ? { error: result.error }
          : { result },
      }));
    } catch (error) {
      console.error("[XRD] Record integrity check failed:", error);
      setAuditResult((previous) => ({ ...previous, [recordId]: { error: error?.message || "Integrity check failed." } }));
    }
  };

  const evidenceCard = (item, index) => (
    <article className="xrd-record" key={item.id || `${item.provider}-${item.title}-${index}`}>
      <div className="xrd-record-mark"><FileCheck2 size={17} /></div>
      <div className="xrd-record-body">
        <div className="xrd-record-top">
          <span className="xrd-record-title">{item.title || item.evidence_type || "Evidence record"}</span>
          <span className={`xrd-status${item.verified ? " is-verified" : ""}`}>{normalizeStatus(item)}</span>
        </div>
        <div className="xrd-record-meta">{item.provider || "Unknown source"} <i /> {item.evidence_type || "profile"} <i /> {dateLabel(item.created_at || item.createdAt)}</div>
        {item.summary && <p>{item.summary}</p>}
        <div className="xrd-record-foot">
          <span>{item.proofLabel || "Evidence"}</span>
          {item.verificationLevel && <span>{String(item.verificationLevel).toUpperCase()} TRUST</span>}
        </div>
      </div>
    </article>
  );

  const chainCard = (record) => {
    const audit = auditResult[record.record_id];
    const status = audit?.loading ? "Checking…" : audit?.error || (audit?.result?.status
      ? audit.result.status.replaceAll("_", " ")
      : "Not checked");
    return (
      <article className="xrd-record xrd-chain-record" key={record.record_id}>
        <div className="xrd-record-mark xrd-chain-mark"><GitBranch size={17} /></div>
        <div className="xrd-record-body">
          <div className="xrd-record-top">
            <span className="xrd-record-title">{record.payload?.event?.replaceAll("_", " ") || record.stream_type}</span>
            <span className="xrd-status">{record.stream_type || "XRC"}</span>
          </div>
          <div className="xrd-hash">{record.record_id}</div>
          <div className="xrd-record-meta">{dateLabel(record.timestamp || record.created_at)} <i /> v{record.version || 1}</div>
          <div className="xrd-integrity">
            <span>Integrity: <b>{status}</b></span>
            <button type="button" onClick={() => checkRecord(record.record_id)} disabled={audit?.loading}>
              {audit?.loading ? "Checking" : "Verify record"}
            </button>
          </div>
        </div>
      </article>
    );
  };

  const renderSection = () => {
    if (section === "Oracle" || section === "XRC Oracle") {
      return (
        <div className="xrd-oracle-card">
          <div className="xrd-oracle-glyph"><Sparkles size={24} /></div>
          <div><h2>XRC Oracle</h2><p>Search XRC records, events, content IDs, hashes, and profiles in the existing XRC explorer.</p></div>
          <button type="button" className="xrd-primary" onClick={openOracle}>Open Oracle <ChevronRight size={15} /></button>
        </div>
      );
    }

    if (section === "Overview") {
      const attentionItems = verificationItems.filter((item) =>
        /expired|mismatch|revoked|failed|disputed|contested|pending/i.test(normalizeStatus(item)),
      );
      const questions = [
        ["WHO?", "Identity and connected accounts", "Identity", Fingerprint],
        ["WHAT?", "Records and evidence", "Records", FileText],
        ["WHEN?", own ? `${records.length} first-party events` : "Evidence timeline when available", own ? "Activity" : "Records", Activity],
        ["WHERE FROM?", `${sources.length} represented sources`, "Graph", Network],
        ["WHO CAN ATTEST?", "Verification and provenance", "Verification", ShieldCheck],
        ["WHAT EVIDENCE?", `${verificationItems.length} evidence items`, "Evidence", FileCheck2],
        ["IS IT VERIFIED?", `${verifiedCount} verified records`, "Verification", CheckCircle2],
        ["CAN IT BE TRACED?", own ? "Follow available record chains" : "Trace available evidence relationships", own ? "Chains" : "Graph", GitBranch],
      ];
      return (
        <>
          <div className="xrd-overview-hero">
            <div className="xrd-hero-orbit" aria-hidden="true" />
            <div className="xrd-hero-identity">
              {profile?.avatarUrl
                ? <img src={profile.avatarUrl} alt="" />
                : <span>{initials}</span>}
              <div><span className="xrd-kicker">XEEVIA RECORD</span><h2>{profileName}</h2><p>@{profile?.username || "unknown"} · {own ? "Owner workspace" : "Public record"}</p></div>
            </div>
            <div className="xrd-hero-mark"><ShieldCheck size={32} /></div>
            <p className="xrd-hero-copy">A transparent view of identity evidence, provenance, and record integrity. Only available data is shown; an empty section means no records were returned.</p>
          </div>
          <div className="xrd-stats">
            {[
              [verificationItems.length, "Records", FileCheck2],
              [verifiedCount, "Verified", CheckCircle2],
              [sources.length, "Sources", Database],
              [institutionCount, "Institutions", GraduationCap],
            ].map(([value, label, Icon]) => <div className="xrd-stat" key={label}><Icon size={17} /><strong>{value}</strong><span>{label}</span></div>)}
          </div>
          <div className="xrd-panel">
            <div className="xrd-section-heading"><div><span className="xrd-kicker">XRD MAP</span><h3>What this record can answer</h3></div></div>
            <div className="xrd-question-grid">
              {questions.map(([question, description, destination, Icon]) => (
                <button type="button" key={question} onClick={() => navigateSection(destination)}>
                  <span className="xrd-question-icon"><Icon size={16} /></span>
                  <span><b>{question}</b><small>{description}</small></span>
                  <ChevronRight size={14} />
                </button>
              ))}
            </div>
          </div>
          <div className="xrd-panel">
            <div className="xrd-section-heading"><div><span className="xrd-kicker">REVIEW</span><h3>Needs attention</h3></div><button type="button" onClick={() => navigateSection("Verification")}>All states <ChevronRight size={14} /></button></div>
            {attentionItems.length
              ? <div className="xrd-record-list">{attentionItems.slice(0, 4).map(evidenceCard)}</div>
              : <EmptyState text={verificationItems.length ? "No available evidence is currently marked as disputed, pending, expired, or failed." : "Evidence status will appear here as records are connected."} />}
          </div>
          <div className="xrd-section-heading"><div><span className="xrd-kicker">LATEST PROOF</span><h3>Evidence overview</h3></div><button type="button" onClick={() => navigateSection("Records")}>All records <ChevronRight size={14} /></button></div>
          {verificationItems.length
            ? <div className="xrd-record-list">{verificationItems.slice(0, 4).map(evidenceCard)}</div>
            : <EmptyState text="No evidence records are available for this profile yet." />}
        </>
      );
    }

    if (section === "Identity") {
      const identityItems = filteredEvidence.filter((item) =>
        ["person", "identity"].includes(String(item?.entity_type || item?.entityType || item?.metadata?.entityType || "").toLowerCase())
        || ["profile", "identity"].includes(String(item?.evidence_type || item?.type || "").toLowerCase()),
      );
      return (
        <>
          <SectionHeading title="Identity" subtitle="Profile identity details and first-party verification evidence." />
          <div className="xrd-identity-panel">
            <div className="xrd-identity-avatar">{profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : initials}</div>
            <div className="xrd-identity-copy"><h3>{profileName} {profile?.verified && <BadgeCheck size={16} />}</h3><p>@{profile?.username || "unknown"}</p>{profile?.bio && <p className="xrd-bio">{profile.bio}</p>}<span>Member since {profile?.joinDate || "date unavailable"}</span></div>
          </div>
          <div className="xrd-panel">
            <div className="xrd-section-heading"><div><span className="xrd-kicker">IDENTITY SOURCES</span><h3>Connected identity evidence</h3></div><span className="xrd-count">{identityItems.length}</span></div>
            {identityItems.length ? <div className="xrd-identity-sources">
              {identityItems.map((item, index) => (
                <article className="xrd-identity-source" key={item.id || `${item.provider}-${index}`}>
                  <span className="xrd-source-glyph"><Fingerprint size={16} /></span>
                  <div><strong>{item.provider || "Identity source"}</strong><small>{item.metadata?.username || item.metadata?.handle || item.url || item.title || "No public account handle supplied"}</small></div>
                  <span className={`xrd-status${item.verified ? " is-verified" : ""}`}>{normalizeStatus(item)}</span>
                </article>
              ))}
            </div> : <EmptyState text="Connected accounts and identity proofs will appear here when their sources provide them." />}
          </div>
          <div className="xrd-section-heading"><div><span className="xrd-kicker">RELATED RECORDS</span><h3>Identity evidence</h3></div></div>
          {filteredEvidence.filter((item) => ["profile", "identity", "verification"].includes(String(item?.evidence_type || item?.type || "").toLowerCase())).map(evidenceCard)}
          {!verificationItems.some((item) => ["profile", "identity", "verification"].includes(String(item?.evidence_type || item?.type || "").toLowerCase())) && <EmptyState text="No separate identity evidence has been added." />}
        </>
      );
    }

    if (section === "Records" || section === "Evidence") {
      const items = section === "Records" ? filteredEvidence : filteredEvidence.filter((item) => item?.verified);
      return (
        <>
          <SectionHeading title={section} subtitle={section === "Records" ? "Evidence-backed profile records available to this viewer." : "Evidence records marked as verified by their source."} />
          <SearchBox value={filter} onChange={setFilter} placeholder="Filter records and sources" />
          {items.length ? <div className="xrd-record-list">{items.map(evidenceCard)}</div> : <EmptyState text={section === "Evidence" ? "No verified evidence is available yet." : "No evidence records match this filter."} />}
        </>
      );
    }

    if (section === "Graph") {
      return (
        <>
          <SectionHeading title="Evidence graph" subtitle="A source-to-record map generated from this profile’s available evidence." />
          {sources.length ? <div className="xrd-graph">
            {sources.map(([source, count]) => (
              <div className="xrd-graph-source" key={source}>
                <div className="xrd-graph-node"><Database size={16} /><span>{source}</span><small>{count} record{count === 1 ? "" : "s"}</small></div>
                <div className="xrd-graph-links" aria-hidden="true"><i /><i /><i /></div>
                <div className="xrd-graph-records">{verificationItems.filter((item) => (item.provider || "Unknown source") === source).slice(0, 4).map((item, index) => <div className="xrd-graph-record" key={item.id || `${source}-${index}`}><FileText size={13} /><span>{item.title || item.evidence_type || "Evidence"}</span><b>{item.verified ? "Verified" : "Tracked"}</b></div>)}</div>
              </div>
            ))}
          </div> : <EmptyState text="The graph will appear when evidence sources are connected." />}
        </>
      );
    }

    if (section === "Chains" || section === "Activity" || section === "Audit") {
      if (!own) return <RestrictedState />;
      return (
        <>
          <SectionHeading title={section === "Chains" ? "XRC chains" : section} subtitle={section === "Audit" ? "Run integrity checks against records in your own XRC history." : "Your first-party XRC event history. This view is private to the account owner."} />
          <SearchBox value={filter} onChange={setFilter} placeholder="Filter events, streams, and record IDs" />
          {recordsError && <div className="xrd-error" role="alert">{recordsError}<button type="button" onClick={loadRecords}>Retry</button></div>}
          {recordsLoading ? <div className="xrd-loading"><span />Loading your XRC history…</div>
            : filteredRecords.length ? <div className="xrd-record-list">{filteredRecords.map(chainCard)}</div>
              : !recordsError && <EmptyState text="There are no XRC events available for this profile yet." />}
        </>
      );
    }

    if (section === "Sources") {
      return (
        <>
          <SectionHeading title="Sources" subtitle="Distinct providers represented by the evidence available to this viewer." />
          {sources.length ? <div className="xrd-source-list">{sources.map(([source, count]) => (
            <article className="xrd-source" key={source}><span><Database size={17} /></span><div><strong>{source}</strong><small>{count} evidence record{count === 1 ? "" : "s"}</small></div><ChevronRight size={15} /></article>
          ))}</div> : <EmptyState text="No evidence sources are connected to this profile yet." />}
        </>
      );
    }

    if (section === "Projects" || section === "Credentials" || section === "Achievements" || section === "Remarks") {
      const match = section === "Projects"
        ? (item) => item?.metadata?.kind === "project" || item?.evidence_type === "portfolio"
        : section === "Credentials"
          ? (item) => item?.evidence_type === "credential" || item?.metadata?.kind === "credential"
          : section === "Achievements"
            ? (item) => item?.metadata?.kind === "achievement" || item?.evidence_type === "achievement"
            : (item) => item?.metadata?.kind === "remark" || item?.evidence_type === "remark";
      const items = filteredEvidence.filter(match);
      return (
        <>
          <SectionHeading title={section} subtitle={{
            Projects: "Project and portfolio evidence supplied by connected sources.",
            Credentials: "Credential evidence supplied by connected issuers.",
            Achievements: "Achievement records that have been added to this profile's evidence.",
            Remarks: "Remarks included in the evidence visible to this profile viewer.",
          }[section]} />
          {items.length ? <div className="xrd-record-list">{items.map(evidenceCard)}</div> : <EmptyState text={`No ${section.toLowerCase()} evidence is available yet.`} />}
        </>
      );
    }

    if (section === "Verification") {
      return (
        <>
          <SectionHeading title="Verification" subtitle="Verification state is reported by the evidence source; this page does not imply a new verification." />
          {filteredEvidence.length ? <div className="xrd-record-list">{filteredEvidence.map(evidenceCard)}</div> : <EmptyState text="No verification records are available yet." />}
        </>
      );
    }

    if (section === "Permissions") {
      if (!own) return <RestrictedState />;
      const dimensions = ["Visibility", "Evidence access", "Authority"];
      const describeEvidence = (item) => {
        const metadata = item?.metadata || {};
        const value = permissionsDimension === "Visibility"
          ? metadata.visibility || metadata.audience
          : permissionsDimension === "Evidence access"
            ? metadata.evidence_access || metadata.access
            : metadata.issuer || metadata.authority || item?.provider;
        if (typeof value === "string" || typeof value === "number") return String(value);
        if (Array.isArray(value)) return value.map((entry) => typeof entry === "string" ? entry : "").filter(Boolean).join(", ") || "Policy-controlled";
        return permissionsDimension === "Authority" ? "Not supplied by source" : "Policy-controlled";
      };
      return (
        <>
          <SectionHeading title="Permissions" subtitle="Visibility, evidence access, and authority are separate decisions. This dashboard reports source-provided values and does not override database access policies." />
          <div className="xrd-control-tabs" role="tablist" aria-label="Permission dimensions">
            {dimensions.map((dimension) => <button type="button" role="tab" aria-selected={permissionsDimension === dimension} className={permissionsDimension === dimension ? "active" : ""} key={dimension} onClick={() => setPermissionsDimension(dimension)}>{dimension}</button>)}
          </div>
          {permissionsDimension === "Authority" && <div className="xrd-notice"><LockKeyhole size={16} /><span>Only authority explicitly supplied by a record source is shown. Xeevia does not infer who may attest to a claim.</span></div>}
          {verificationItems.length ? <div className="xrd-permission-list">
            {verificationItems.map((item, index) => (
              <article key={item.id || `${item.provider}-${index}`}>
                <div><strong>{item.title || item.evidence_type || "Evidence record"}</strong><small>{item.provider || "Unknown source"} · {item.evidence_type || item.type || "record"}</small></div>
                <span>{describeEvidence(item)}</span>
              </article>
            ))}
          </div> : <EmptyState text="Permission details will appear when records include source-provided visibility and access metadata." />}
          <div className="xrd-notice"><Shield size={16} /><span>Record access remains governed by the existing Supabase policies. This view is informational and does not expose database controls.</span></div>
        </>
      );
    }

    if (section === "Settings") {
      if (!own) return <RestrictedState />;
      return (
        <>
          <SectionHeading title="XRD settings" subtitle="Presentation and notification preferences. Integrity and required system records cannot be disabled." />
          <div className="xrd-control-tabs xrd-settings-tabs" role="tablist" aria-label="XRD setting groups">
            {Object.keys(SETTING_GROUPS).map((group) => <button type="button" role="tab" aria-selected={settingsGroup === group} className={settingsGroup === group ? "active" : ""} key={group} onClick={() => setSettingsGroup(group)}>{group}</button>)}
          </div>
          <div className="xrd-settings-card">
            {SETTING_GROUPS[settingsGroup].map((setting) => (
              <div className="xrd-setting-row" key={setting}>
                <span>{setting}</span>
                <span className="xrd-setting-state">Not configured</span>
                <button type="button" role="switch" aria-checked="false" aria-label={setting} disabled><i /></button>
              </div>
            ))}
            <div className="xrd-notice"><LockKeyhole size={16} /><span>These settings are shown as designed, but a persistent XRD preference store is not configured yet. No preference is being silently saved or simulated.</span></div>
          </div>
        </>
      );
    }

    return <EmptyState text="There is no data for this section yet." />;
  };

  if (oracleOpen) {
    return (
      <Suspense fallback={<div role="status" style={{ position: "fixed", inset: 0, zIndex: 100051, display: "grid", placeItems: "center", background: "#030403", color: "#a3e635", fontSize: 13 }}>Loading XRC Oracle…</div>}>
        <XRCOracleExplorer currentUser={currentUser} xrcService={xrcService} onClose={() => setOracleOpen(false)} />
      </Suspense>
    );
  }

  return ReactDOM.createPortal(
    <div className="xrd-root" role="dialog" aria-modal="true" aria-label={`${profileName} Xeevia Record`}>
      <style>{`
        .xrd-root{--xrd-ac:#a3e635;--xrd-panel:#080b08;--xrd-border:#252a24;position:fixed;inset:0;z-index:100050;display:grid;grid-template-columns:248px minmax(0,1fr);background:#030403;color:#eef2ea;font-family:inherit}
        .xrd-root *{box-sizing:border-box}.xrd-root button{font:inherit;color:inherit}
        .xrd-sidebar{min-width:0;display:flex;flex-direction:column;padding:18px 13px;border-right:1px solid var(--xrd-border);background:linear-gradient(180deg,#080b08,#050605)}
        .xrd-brand{display:flex;align-items:center;gap:11px;padding:5px 8px 20px}
        .xrd-brand-mark{width:38px;height:38px;display:grid;place-items:center;border:1px solid rgba(163,230,53,.35);border-radius:12px;background:rgba(163,230,53,.1);color:var(--xrd-ac);font-weight:900;font-size:12px}
        .xrd-brand strong{display:block;font-size:13px}.xrd-brand small{display:block;margin-top:3px;color:#81877d;font-size:10px}
        .xrd-back{display:flex;align-items:center;gap:8px;padding:9px 10px;margin-bottom:18px;border:1px solid var(--xrd-border);border-radius:10px;background:#070907;color:#c7cec1!important;font-size:11px;cursor:pointer}
        .xrd-nav-label{padding:12px 10px 6px;color:#737b70;font-size:9px;font-weight:900;letter-spacing:.14em}
        .xrd-nav{display:flex;flex-direction:column;gap:3px;overflow:auto}
        .xrd-nav button{display:flex;align-items:center;gap:10px;min-height:39px;padding:0 10px;border:1px solid transparent;border-radius:9px;background:transparent;color:#9ca398;font-size:11px;text-align:left;cursor:pointer}
        .xrd-nav button:hover{background:#10140e;color:#e8f0df}.xrd-nav button.active{border-color:rgba(163,230,53,.2);background:linear-gradient(90deg,rgba(163,230,53,.13),rgba(163,230,53,.025));color:var(--xrd-ac)}
        .xrd-nav button svg{flex:none}.xrd-view{min-width:0;height:100dvh;display:flex;flex-direction:column;overflow:hidden}
        .xrd-topbar{height:58px;flex:none;display:flex;align-items:center;gap:14px;padding:0 24px;border-bottom:1px solid var(--xrd-border);background:rgba(5,7,5,.95)}
        .xrd-topbar button{width:32px;height:32px;display:grid;place-items:center;border:1px solid var(--xrd-border);border-radius:50%;background:#090b09;cursor:pointer}
        .xrd-crumb{min-width:0;flex:1;overflow:hidden;color:#7c8479;font-size:11px;text-overflow:ellipsis;white-space:nowrap}
        .xrd-crumb b{color:#dce5d5}.xrd-owner-tag{padding:5px 8px;border:1px solid rgba(163,230,53,.19);border-radius:99px;color:var(--xrd-ac);font-size:9px;font-weight:800}
        .xrd-content{width:min(100%,1060px);margin:0 auto;padding:28px 34px 50px;overflow:auto;overscroll-behavior:contain}
        .xrd-content h2,.xrd-content h3,.xrd-content p{margin-top:0}
        .xrd-overview-hero{position:relative;overflow:hidden;min-height:188px;padding:25px;border:1px solid rgba(163,230,53,.3);border-radius:19px;background:radial-gradient(ellipse at 2% 0%,rgba(163,230,53,.15),transparent 48%),linear-gradient(135deg,#0b1009,#050605 70%);box-shadow:inset 0 0 50px rgba(163,230,53,.035)}
        .xrd-hero-orbit{position:absolute;right:74px;top:-78px;width:245px;height:245px;border:1px solid rgba(163,230,53,.13);border-radius:50%;box-shadow:0 0 0 25px rgba(163,230,53,.025),0 0 0 56px rgba(163,230,53,.018)}
        .xrd-hero-identity{position:relative;z-index:1;display:flex;align-items:center;gap:14px}.xrd-hero-identity img,.xrd-hero-identity>span{width:54px;height:54px;display:grid;place-items:center;border:1px solid rgba(163,230,53,.4);border-radius:50%;object-fit:cover;background:#11180c;color:var(--xrd-ac);font-size:22px;font-weight:900}
        .xrd-kicker{color:var(--xrd-ac);font-size:9px;font-weight:900;letter-spacing:.16em}.xrd-hero-identity h2{margin:3px 0;font-size:21px;letter-spacing:-.025em}.xrd-hero-identity p{margin:0;color:#82897e;font-size:11px}
        .xrd-hero-mark{position:absolute;right:26px;top:27px;width:52px;height:52px;display:grid;place-items:center;border:1px solid rgba(163,230,53,.24);border-radius:16px;background:rgba(163,230,53,.08);color:var(--xrd-ac)}
        .xrd-hero-copy{position:relative;z-index:1;max-width:690px;margin:19px 0 0!important;color:#a8b0a3;font-size:12px;line-height:1.6}
        .xrd-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:14px 0 30px}.xrd-stat{display:grid;grid-template-columns:22px 1fr;align-items:center;gap:4px 8px;padding:13px;border:1px solid var(--xrd-border);border-radius:13px;background:linear-gradient(180deg,#0a0c09,#060706)}.xrd-stat svg{grid-row:span 2;color:var(--xrd-ac)}.xrd-stat strong{font-size:18px}.xrd-stat span{color:#81887d;font-size:10px}
        .xrd-section-heading{display:flex;align-items:end;justify-content:space-between;gap:12px;margin:22px 0 12px}.xrd-section-heading h3{margin:4px 0 0;font-size:18px}.xrd-section-heading button{display:flex;align-items:center;gap:4px;border:0;background:none;color:var(--xrd-ac);font-size:10px;font-weight:800;cursor:pointer}
        .xrd-panel{margin:0 0 14px;padding:16px;border:1px solid var(--xrd-border);border-radius:15px;background:linear-gradient(180deg,#080a08,#050605)}
        .xrd-question-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
        .xrd-question-grid button{min-width:0;display:flex;align-items:center;gap:9px;padding:10px;border:1px solid #242a23;border-radius:11px;background:#050705;text-align:left;cursor:pointer}
        .xrd-question-grid button:hover{border-color:rgba(163,230,53,.35);background:rgba(163,230,53,.045)}
        .xrd-question-icon{width:30px;height:30px;display:grid;place-items:center;flex:none;border:1px solid rgba(163,230,53,.2);border-radius:9px;color:var(--xrd-ac);background:rgba(163,230,53,.06)}
        .xrd-question-grid button>span:nth-child(2){min-width:0;flex:1;display:flex;flex-direction:column;gap:3px}
        .xrd-question-grid b{color:#dce3d7;font-size:9px;letter-spacing:.04em}
        .xrd-question-grid small{color:#838b7f;font-size:9px;line-height:1.35}
        .xrd-question-grid button>svg:last-child{flex:none;color:#687064}
        .xrd-control-tabs{display:flex;flex-wrap:wrap;gap:6px;margin:16px 0 12px}
        .xrd-control-tabs button{min-height:34px;padding:0 12px;border:1px solid #282e27;border-radius:999px;background:#070907;color:#9ba394;font-size:10px;cursor:pointer}
        .xrd-control-tabs button.active{border-color:rgba(163,230,53,.38);background:rgba(163,230,53,.09);color:var(--xrd-ac)}
        .xrd-settings-tabs{flex-wrap:nowrap;overflow:auto;padding-bottom:5px;scrollbar-width:thin}
        .xrd-settings-tabs button{flex:none}
        .xrd-settings-card{padding:4px 16px 16px;border:1px solid var(--xrd-border);border-radius:15px;background:linear-gradient(180deg,#080a08,#050605)}
        .xrd-setting-row{display:flex;align-items:center;gap:12px;min-height:54px;border-bottom:1px solid #1c211b;color:#dce2d7;font-size:11px}
        .xrd-setting-row>span:first-child{flex:1}
        .xrd-setting-state{color:#747d70;font-size:9px}
        .xrd-setting-row button{position:relative;width:34px;height:19px;padding:0;border:1px solid #353b33;border-radius:99px;background:#151815;opacity:.68}
        .xrd-setting-row button i{position:absolute;left:2px;top:2px;width:13px;height:13px;border-radius:50%;background:#788073}
        .xrd-notice{display:flex;align-items:flex-start;gap:9px;margin:14px 0 0;padding:12px;border:1px solid rgba(163,230,53,.16);border-radius:11px;background:rgba(163,230,53,.035);color:#a2ab9a;font-size:10px;line-height:1.5}
        .xrd-notice svg{flex:none;color:var(--xrd-ac)}
        .xrd-permission-list{display:flex;flex-direction:column;gap:7px}
        .xrd-permission-list article{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px;border:1px solid var(--xrd-border);border-radius:11px;background:#070907}
        .xrd-permission-list article>div{min-width:0;display:flex;flex-direction:column;gap:4px}
        .xrd-permission-list strong{overflow:hidden;color:#e4e9df;font-size:11px;text-overflow:ellipsis;white-space:nowrap}
        .xrd-permission-list small{color:#778073;font-size:9px}
        .xrd-permission-list article>span{max-width:45%;color:#a3e635;font-size:9px;text-align:right;overflow-wrap:anywhere}
        .xrd-identity-sources{display:flex;flex-direction:column;gap:7px}
        .xrd-identity-source{display:flex;align-items:center;gap:10px;padding:10px;border:1px solid #222821;border-radius:11px;background:#060806}
        .xrd-source-glyph{width:32px;height:32px;display:grid;place-items:center;flex:none;border:1px solid rgba(163,230,53,.18);border-radius:9px;background:rgba(163,230,53,.06);color:var(--xrd-ac)}
        .xrd-identity-source>div{min-width:0;flex:1;display:flex;flex-direction:column;gap:3px}
        .xrd-identity-source strong{color:#e3e9de;font-size:10px}
        .xrd-identity-source small{overflow:hidden;color:#7f887a;font-size:9px;text-overflow:ellipsis;white-space:nowrap}
        .xrd-count{display:grid;place-items:center;min-width:24px;height:24px;padding:0 6px;border:1px solid rgba(163,230,53,.2);border-radius:99px;color:var(--xrd-ac);font-size:9px}
        .xrd-page-heading{margin-bottom:17px}.xrd-page-heading h2{margin:0 0 5px;font-size:25px;letter-spacing:-.03em}.xrd-page-heading p{margin:0;color:#8d9589;font-size:12px;line-height:1.55}
        .xrd-record-list{display:flex;flex-direction:column;gap:9px}.xrd-record{display:flex;gap:12px;padding:14px;border:1px solid var(--xrd-border);border-radius:13px;background:linear-gradient(125deg,rgba(255,255,255,.035),rgba(255,255,255,.012));min-width:0}
        .xrd-record-mark{width:34px;height:34px;flex:none;display:grid;place-items:center;border:1px solid rgba(163,230,53,.18);border-radius:10px;background:rgba(163,230,53,.07);color:var(--xrd-ac)}
        .xrd-record-body{min-width:0;flex:1}.xrd-record-top{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.xrd-record-title{color:#f0f3ec;font-size:12px;font-weight:800;overflow-wrap:anywhere}.xrd-status{flex:none;padding:3px 7px;border:1px solid rgba(148,163,184,.2);border-radius:99px;color:#a8b0a4;font-size:8px;font-weight:900;text-transform:uppercase}
        .xrd-status.is-verified{border-color:rgba(163,230,53,.28);background:rgba(163,230,53,.08);color:var(--xrd-ac)}
        .xrd-record-meta{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:6px;color:#7d857a;font-size:9px}.xrd-record-meta i{width:3px;height:3px;border-radius:50%;background:#535b50}.xrd-record-body>p{margin:9px 0 0;color:#b8beb4;font-size:11px;line-height:1.5}
        .xrd-record-foot{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}.xrd-record-foot span{padding:3px 7px;border:1px solid #242a23;border-radius:99px;color:#929a8d;font-size:8px;font-weight:800}
        .xrd-search{display:flex;align-items:center;gap:8px;margin-bottom:13px;padding:0 12px;border:1px solid var(--xrd-border);border-radius:11px;background:#080a08;color:#81887e}.xrd-search input{width:100%;height:40px;border:0;outline:0;background:transparent;color:#eff2eb;font:inherit;font-size:11px}
        .xrd-identity-panel{display:flex;align-items:center;gap:14px;margin-bottom:13px;padding:16px;border:1px solid var(--xrd-border);border-radius:14px;background:#080a08}.xrd-identity-avatar{width:64px;height:64px;display:grid;place-items:center;flex:none;overflow:hidden;border:2px solid rgba(163,230,53,.35);border-radius:50%;background:#11180c;color:var(--xrd-ac);font-size:24px;font-weight:900}.xrd-identity-avatar img{width:100%;height:100%;object-fit:cover}.xrd-identity-copy h3{display:flex;align-items:center;gap:6px;margin:0;font-size:15px}.xrd-identity-copy h3 svg{color:var(--xrd-ac)}.xrd-identity-copy p{margin:3px 0;color:#8b9387;font-size:10px}.xrd-identity-copy .xrd-bio{max-width:620px;color:#c0c6bc;font-size:11px;line-height:1.5}.xrd-identity-copy>span{color:#737b70;font-size:9px}
        .xrd-graph{display:flex;flex-direction:column;gap:12px}.xrd-graph-source{display:grid;grid-template-columns:minmax(150px,.75fr) 50px minmax(0,1.4fr);align-items:center;gap:10px;padding:13px;border:1px solid var(--xrd-border);border-radius:13px;background:#070907}.xrd-graph-node{display:flex;flex-direction:column;gap:5px;color:var(--xrd-ac)}.xrd-graph-node span{color:#e6ecdf;font-size:11px;font-weight:800;overflow-wrap:anywhere}.xrd-graph-node small{color:#788174;font-size:9px}.xrd-graph-links{display:flex;flex-direction:column;gap:6px}.xrd-graph-links i{display:block;height:1px;background:linear-gradient(90deg,rgba(163,230,53,.6),rgba(163,230,53,.05))}
        .xrd-graph-records{display:flex;flex-direction:column;gap:5px}.xrd-graph-record{display:grid;grid-template-columns:16px minmax(0,1fr) auto;align-items:center;gap:7px;padding:7px;border:1px solid #1c211b;border-radius:8px;color:#969f91;font-size:9px}.xrd-graph-record span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.xrd-graph-record b{color:var(--xrd-ac);font-size:8px}
        .xrd-source-list{display:flex;flex-direction:column;gap:8px}.xrd-source{display:flex;align-items:center;gap:10px;padding:12px;border:1px solid var(--xrd-border);border-radius:11px;background:#080a08}.xrd-source>span{width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:rgba(163,230,53,.08);color:var(--xrd-ac)}.xrd-source>div{display:flex;flex:1;flex-direction:column;gap:3px}.xrd-source strong{font-size:11px}.xrd-source small{color:#7a8276;font-size:9px}.xrd-source>svg{color:#687064}
        .xrd-chain-mark{border-color:rgba(96,165,250,.2);background:rgba(96,165,250,.07);color:#60a5fa}.xrd-hash{margin-top:7px;color:#92a7bc;font:9px ui-monospace,monospace;overflow-wrap:anywhere}.xrd-integrity{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px;color:#899286;font-size:9px;text-transform:capitalize}.xrd-integrity b{color:#d8e2d3}.xrd-integrity button,.xrd-error button{padding:6px 9px;border:1px solid rgba(163,230,53,.25);border-radius:7px;background:rgba(163,230,53,.08);color:var(--xrd-ac);font-size:9px;font-weight:800;cursor:pointer}.xrd-integrity button:disabled{opacity:.5;cursor:wait}
        .xrd-empty{display:flex;flex-direction:column;align-items:center;gap:8px;padding:38px 16px;border:1px dashed #292f28;border-radius:13px;color:#90988b;text-align:center;font-size:11px}.xrd-empty svg{color:#7f9f52}.xrd-restricted{display:flex;align-items:flex-start;gap:12px;padding:16px;border:1px solid rgba(251,191,36,.2);border-radius:12px;background:rgba(251,191,36,.04);color:#fbbf24}.xrd-restricted p{margin:4px 0 0;color:#a9a391;font-size:11px;line-height:1.5}.xrd-error{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;padding:10px;border:1px solid rgba(248,113,113,.25);border-radius:10px;color:#fca5a5;font-size:10px}.xrd-loading{display:flex;align-items:center;gap:9px;padding:22px;color:#9ca397;font-size:11px}.xrd-loading span{width:14px;height:14px;border:2px solid #394431;border-top-color:var(--xrd-ac);border-radius:50%;animation:xrd-spin .8s linear infinite}
        @keyframes xrd-spin{to{transform:rotate(360deg)}}.xrd-oracle-card{display:flex;align-items:center;gap:16px;padding:20px;border:1px solid rgba(163,230,53,.22);border-radius:16px;background:radial-gradient(circle at 0 0,rgba(163,230,53,.1),transparent 50%),#080a08}.xrd-oracle-glyph{width:44px;height:44px;display:grid;place-items:center;flex:none;border:1px solid rgba(163,230,53,.28);border-radius:13px;color:var(--xrd-ac)}.xrd-oracle-card>div:nth-child(2){flex:1}.xrd-oracle-card h2{margin:0 0 5px;font-size:16px}.xrd-oracle-card p{margin:0;color:#929a8f;font-size:11px;line-height:1.5}.xrd-primary{display:flex;align-items:center;gap:6px;padding:9px 12px;border:0;border-radius:9px;background:var(--xrd-ac);color:#10170a!important;font-size:10px;font-weight:900;white-space:nowrap;cursor:pointer}
        .xrd-mobile-nav{display:none}
        @media(max-width:850px){.xrd-root{grid-template-columns:205px minmax(0,1fr)}.xrd-content{padding:22px 20px 42px}}
        @media(max-width:650px){.xrd-root{display:flex;flex-direction:column}.xrd-sidebar{display:none}.xrd-view{height:100dvh;padding-bottom:60px}.xrd-topbar{height:52px;padding:0 12px;gap:9px}.xrd-owner-tag{font-size:8px}.xrd-content{padding:16px 13px 28px}.xrd-overview-hero{min-height:0;padding:17px}.xrd-hero-identity img,.xrd-hero-identity>span{width:46px;height:46px;font-size:18px}.xrd-hero-identity h2{font-size:17px}.xrd-hero-mark{right:14px;top:14px;width:36px;height:36px;border-radius:11px}.xrd-hero-mark svg{width:22px}.xrd-hero-copy{margin-top:14px!important;font-size:10px}.xrd-stats{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-bottom:22px}.xrd-stat{padding:10px}.xrd-stat strong{font-size:16px}.xrd-stat span{font-size:9px}.xrd-page-heading h2{font-size:21px}.xrd-graph-source{grid-template-columns:minmax(0,1fr);gap:9px}.xrd-graph-links{flex-direction:row;padding-left:7px}.xrd-graph-links i{width:18px}.xrd-oracle-card{align-items:flex-start;flex-wrap:wrap;padding:14px}.xrd-oracle-card>div:nth-child(2){min-width:calc(100% - 66px)}.xrd-primary{margin-left:60px}.xrd-mobile-nav{position:fixed;z-index:2;bottom:0;left:0;right:0;display:flex;align-items:stretch;justify-content:space-around;padding:5px 4px calc(5px + env(safe-area-inset-bottom));border-top:1px solid #252a24;background:rgba(5,7,5,.97);backdrop-filter:blur(14px)}.xrd-mobile-nav button{display:flex;min-width:0;flex:1;flex-direction:column;align-items:center;justify-content:center;gap:3px;border:0;border-radius:8px;background:transparent;color:#828a7e;font-size:8px;cursor:pointer}.xrd-mobile-nav button.active{background:rgba(163,230,53,.08);color:var(--xrd-ac)}}
      `}</style>
      <aside className="xrd-sidebar">
        <div className="xrd-brand"><span className="xrd-brand-mark">XRD</span><div><strong>Xeevia Record</strong><small>Profile evidence layer</small></div></div>
        <button type="button" className="xrd-back" onClick={onClose}><ArrowLeft size={14} /> Back to profile</button>
        <nav className="xrd-nav" aria-label="XRD sections">
          {NAV_GROUPS.map(([group, items]) => {
            const visibleItems = items.filter((name) => own || !OWNER_ONLY.has(name));
            if (!visibleItems.length) return null;
            return (
              <div key={group}>
                <div className="xrd-nav-label">{!own && group === "CONTROL" ? "DISCOVER" : group}</div>
                {visibleItems.map((name) => {
                  const Icon = NAV.find(([navName]) => navName === name)?.[1] || Sparkles;
                  const label = name === "Oracle" ? "XRC Oracle" : name;
                  return (
                    <button key={name} type="button" className={section === name ? "active" : ""} onClick={() => navigateSection(name)}>
                      <Icon size={15} />{label}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </aside>
      <main className="xrd-view">
        <header className="xrd-topbar">
          <button type="button" onClick={goBack} aria-label={sectionHistory.length ? "Back to previous section" : "Back to profile"}><ArrowLeft size={15} /></button>
          <div className="xrd-crumb">xeevia.app / @{profile?.username || "profile"} / <b>XRD</b> / {section === "Oracle" ? "XRC Oracle" : section}</div>
          <span className="xrd-owner-tag">{own ? "OWNER" : "PUBLIC"}</span>
        </header>
        <div className="xrd-content" key={section}>{renderSection()}</div>
        <nav className="xrd-mobile-nav" aria-label="XRD quick navigation">
          {["Overview", "Records", "Graph", "Oracle"].map((name) => {
            const Icon = NAV.find(([navName]) => navName === name)?.[1] || Sparkles;
            return <button key={name} type="button" className={section === name ? "active" : ""} onClick={() => name === "Oracle" ? openOracle() : navigateSection(name)}><Icon size={17} />{name}</button>;
          })}
        </nav>
      </main>
    </div>,
    document.body,
  );
};

const SectionHeading = ({ title, subtitle }) => (
  <div className="xrd-page-heading"><span className="xrd-kicker">XEEVIA RECORD</span><h2>{title}</h2><p>{subtitle}</p></div>
);

const SearchBox = ({ value, onChange, placeholder }) => (
  <label className="xrd-search"><Search size={15} /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>
);

const EmptyState = ({ text }) => <div className="xrd-empty"><Database size={20} /><span>{text}</span></div>;

const RestrictedState = () => (
  <div className="xrd-restricted"><LockKeyhole size={18} /><div><strong>Owner-only section</strong><p>Private XRC activity and controls are only available to the profile owner. Public views only show evidence permitted by the data access policy.</p></div></div>
);

export default XRDProfileDashboard;
