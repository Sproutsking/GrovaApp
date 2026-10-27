import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import {
  Activity, ArrowLeft, BadgeCheck, BookOpen, Briefcase, CheckCircle2,
  ChevronRight, Clock, Database, FileCheck2, FileText, Fingerprint,
  GitBranch, GraduationCap, Images, Layers3, LockKeyhole, MessageSquareQuote, MoreHorizontal, Network, Search, Send, X,
  Shield, ShieldCheck, Sparkles,
} from "lucide-react";
import { supabase } from "../../services/config/supabase";
import xrcService from "../../services/xrc";
import evidenceService from "../../services/evidence/evidenceService";
import socialConnectService from "../../services/distribution/socialConnectService";
import { useAccountLinking } from "../../contexts/AccountLinkingContext";
import { getRegisteredConnectors, syncUserConnectorEvidence } from "../../services/evidence/connectorService";
import mediaUrlService from "../../services/shared/mediaUrlService";
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
export const SOURCE_PLATFORMS = [
  ["github", "GitHub"], ["linkedin", "LinkedIn"], ["x", "X"], ["facebook", "Facebook"],
  ["instagram", "Instagram"], ["google", "Google"], ["discord", "Discord"], ["tiktok", "TikTok"], ["apple", "Apple"],
];

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

export const getXrdProfileAvatarCandidates = (profile) => {
  const candidates = [
    ...mediaUrlService.resolveAvatarUrls(profile?.avatarUrl, 300),
    ...mediaUrlService.resolveAvatarUrls(profile?.avatar, 300),
    ...(Array.isArray(profile?.avatarFallbackUrls) ? profile.avatarFallbackUrls.flatMap((url) => mediaUrlService.resolveAvatarUrls(url, 300)) : []),
    ...mediaUrlService.resolveAvatarUrls(profile?.avatarId || profile?.avatar_id, 300),
    ...mediaUrlService.resolveAvatarUrls(profile?.avatarMetadata || profile?.avatar_metadata, 300),
    ...mediaUrlService.resolveAvatarUrls(profile?.user_metadata || profile?.userMetadata, 300),
    ...(Array.isArray(profile?.authenticatedAvatarCandidates) ? profile.authenticatedAvatarCandidates : []),
  ];
  return [...new Set(candidates.filter((url) => typeof url === "string" && url.trim()))];
};

export const getXrdPhotoSources = (profile, evidence = [], connections = []) => {
  const sources = [];
  const nativeUrls = getXrdProfileAvatarCandidates(profile);
  if (nativeUrls.length) {
    sources.push({
      id: "xeevia-profile",
      name: "Xeevia",
      handle: profile?.username ? `@${profile.username}` : "Profile image",
      urls: nativeUrls,
      verified: Boolean(profile?.verified),
    });
  }

  evidence.forEach((item) => {
    const type = String(item?.evidence_type || item?.type || "profile").toLowerCase();
    if (!type.includes("profile") && !type.includes("identity")) return;
    const urls = [...new Set([
      ...mediaUrlService.resolveAvatarUrls(item?.metadata, 300),
      ...mediaUrlService.resolveAvatarUrls(item?.raw, 300),
      ...mediaUrlService.resolveAvatarUrls(item?.avatar_url || item?.avatarUrl || item?.profile_image_url || item?.profileImageUrl, 300),
    ].filter((url) => typeof url === "string" && /^https?:\/\//i.test(url)))];
    if (!urls.length) return;
    const name = item.provider || "Connected source";
    sources.push({
      id: item.id || `${name}:${urls[0]}`,
      name,
      handle: item.metadata?.username || item.metadata?.handle || item.title || "Profile image",
      urls,
      verified: Boolean(item.verified),
    });
  });

  connections.forEach((connection) => {
    const urls = mediaUrlService.resolveAvatarUrls(connection?.avatarUrl || connection?.avatar_url || connection?.picture, 300);
    if (!urls.length) return;
    const name = String(connection.provider || "Connected source");
    sources.push({
      id: `connection:${connection.id || name}`,
      name: name.charAt(0).toUpperCase() + name.slice(1),
      handle: connection.platform_user_id || connection.username || "Connected account",
      urls,
      verified: false,
    });
  });

  return [...new Map(sources.map((source) => [`${source.name}:${source.urls[0]}`, source])).values()];
};

export const getXrdIdentityBindings = (profile, connections = []) => {
  const hasNativeProfile = Boolean(profile?.id || profile?.username || profile?.fullName);
  const nativeBinding = hasNativeProfile ? [{
    provider: "Xeevia",
    account: profile.username ? `@${profile.username}` : "Native profile",
    status: "Native profile",
    native: true,
  }] : [];
  const externalBindings = connections
    .filter((connection) => String(connection?.provider || "").toLowerCase() !== "xeevia")
    .map((connection) => ({
      provider: connection.provider,
      account: connection.auth_status === "active"
        ? (connection.hasValidToken ? "Account + token" : "Account linked")
        : connection.auth_status || "Unknown",
      native: false,
    }));
  return [...nativeBinding, ...externalBindings];
};

export const XRD_IDENTITY_FIELDS = [
  { key: "headline", label: "Headline", placeholder: "Product designer · community builder" },
  { key: "location", label: "Location", placeholder: "Paris, FR / Remote" },
  { key: "pronouns", label: "Pronouns", placeholder: "she/her, he/him, they/them" },
  { key: "website", label: "Website", placeholder: "https://example.com" },
  { key: "availability", label: "Availability", placeholder: "Open to collaborations / not currently available" },
  { key: "bio", label: "Short bio", placeholder: "Tell people who you are, what you build, and what you care about." },
  { key: "note", label: "Owner note", placeholder: "Optional note for viewers, such as your mission or availability." },
];

export const getXrdIdentityDetails = (details = {}) => {
  const raw = Array.isArray(details)
    ? Object.fromEntries(details.map((row) => [row.field_key, row.value]))
    : details && typeof details === "object" ? details : {};
  return {
    ...Object.fromEntries(XRD_IDENTITY_FIELDS.map(({ key }) => [key, typeof raw[key] === "string" ? raw[key] : ""])),
  };
};

export const getXrdIdentityFieldVisibility = (rows = []) => Object.fromEntries([
  ...XRD_IDENTITY_FIELDS.map(({ key }) => [key, "private"]),
  ...(Array.isArray(rows) ? rows.map((row) => [row.field_key, row.visibility === "public" ? "public" : "private"]) : []),
]);

export const getXrdIdentityFieldStatuses = (rows = []) => Object.fromEntries([
  ...XRD_IDENTITY_FIELDS.map(({ key }) => [key, "self_asserted"]),
  ...(Array.isArray(rows) ? rows.map((row) => [row.field_key, row.status || "self_asserted"]) : []),
]);

export const getXrdIdentityRowStatus = (row = {}) => {
  const connection = row.connection;
  if (connection) {
    const state = String(connection.auth_status || "").toLowerCase();
    if (state === "active" && connection.connected_via === "profile_link") {
      return { label: "Profile URL · unverified", tone: "pending" };
    }
    if (state === "active" && connection.hasValidToken) {
      return { label: "Connected · token active", tone: "connected" };
    }
    if (state === "active") return { label: "Connected", tone: "connected" };
    if (/revok|disconnect/.test(state)) return { label: "Disconnected", tone: "disconnected" };
    if (/pending|reauth/.test(state)) return { label: "Pending", tone: "pending" };
    return { label: connection.auth_status || "Connection unknown", tone: "neutral" };
  }

  const evidence = Array.isArray(row.evidence) ? row.evidence : [];
  const explicitStatus = evidence.map((item) => String(item?.metadata?.status || "").toLowerCase()).find(Boolean);
  if (explicitStatus && /pending|expired|revoked|disputed|mismatch|unavailable|failed/.test(explicitStatus)) {
    return { label: explicitStatus.replaceAll("_", " "), tone: /revoked|failed/.test(explicitStatus) ? "disconnected" : "pending" };
  }
  if (evidence.some((item) => item?.verified && item?.source !== "first_party" && !item?.metadata?.firstParty)) {
    return { label: "Source-reported", tone: "source" };
  }
  if (evidence.length) return { label: "Tracked", tone: "tracked" };
  return { label: "No evidence", tone: "neutral" };
};

const XrdProfileAvatar = ({ candidates, initials }) => {
  const [failedCandidates, setFailedCandidates] = useState([]);
  const nextCandidate = candidates.find((candidate) => !failedCandidates.includes(candidate));
  if (!nextCandidate) return <span>{initials}</span>;
  return <img src={nextCandidate} alt="" onError={() => setFailedCandidates((failed) => [...failed, nextCandidate])} />;
};

const XrdPhotoImage = ({ source }) => {
  const [failedUrls, setFailedUrls] = useState([]);
  const nextUrl = (source.urls || [source.url]).find((url) => url && !failedUrls.includes(url));
  if (!nextUrl) return <div className="xrd-photo-fallback" aria-label={`${source.name} image unavailable`}>{source.name.slice(0, 1).toUpperCase()}</div>;
  return <img src={nextUrl} alt={`${source.name} profile`} loading="lazy" onError={() => setFailedUrls((current) => [...current, nextUrl])} />;
};

const graphHashKey = (value) => String(value || "").trim().toLowerCase();

function XrdEvidenceGraph({ items, edges, profile, connections = [], records = [], auditResult = {}, traceResult = {}, onPick, onOpenVerification, onOpenChain, onVerifyRecord, onTraceRecord, onOpenIdentity }) {
  const [layer, setLayer] = useState("All");
  const [selected, setSelected] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [selectedSourceName, setSelectedSourceName] = useState(null);
  const [identitySelected, setIdentitySelected] = useState(false);
  const [pan, setPan] = useState([0, 0]);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef(null);
  const didDrag = useRef(false);
  const suppressClick = useRef(false);
  const cx = 480, cy = 300;
  const visibleItems = items.slice(0, 32);
  const connectionByProvider = new Map(connections.map((connection) => [String(connection.provider || "").toLowerCase(), connection]));
  const providerLabels = new Map();
  visibleItems.forEach((item) => {
    const name = item.provider || "Unknown source";
    if (!providerLabels.has(String(name).toLowerCase())) providerLabels.set(String(name).toLowerCase(), name);
  });
  connections.forEach((connection) => {
    const name = connection.provider || "Unknown source";
    if (!providerLabels.has(String(name).toLowerCase())) providerLabels.set(String(name).toLowerCase(), name);
  });
  const sourceNames = [...providerLabels.values()];
  const sourceNodes = sourceNames.map((name, index) => {
    const angle = -Math.PI / 2 + (index / Math.max(sourceNames.length, 1)) * Math.PI * 2;
    return { name, connection: connectionByProvider.get(name.toLowerCase()) || null, x: cx + Math.cos(angle) * 176, y: cy + Math.sin(angle) * 118, angle };
  });
  const sourceMap = new Map(sourceNodes.map((node) => [node.name, node]));
  const evidenceNodes = visibleItems.map((item) => {
    const sourceName = item.provider || "Unknown source";
    const siblings = visibleItems.filter((candidate) => (candidate.provider || "Unknown source") === sourceName);
    const index = siblings.findIndex((candidate) => candidate.id === item.id);
    const source = sourceMap.get(sourceName);
    const spread = (index - (siblings.length - 1) / 2) * 0.22;
    const angle = source.angle + spread;
    return { item, x: cx + Math.cos(angle) * 318, y: cy + Math.sin(angle) * 210 };
  });
  const evidenceMap = new Map(evidenceNodes.map((node) => [node.item.id, node]));
  const linkedEdges = edges.filter((edge) => evidenceMap.has(edge.source_id) && evidenceMap.has(edge.target_id)).slice(0, 80);
  const recordNodes = records.slice(0, 12).map((record, index, list) => {
    const angle = -Math.PI / 2 + (index / Math.max(list.length, 1)) * Math.PI * 2;
    return { record, x: cx + Math.cos(angle) * 246, y: cy + Math.sin(angle) * 160 };
  });
  const recordByHash = new Map(recordNodes.filter(({ record }) => record.record_hash).map(({ record }) => [`${record.stream_type}:${graphHashKey(record.record_hash)}`, record]));
  const recordChainEdges = recordNodes.flatMap((node) => {
    const { record } = node;
    const parent = recordByHash.get(`${record.stream_type}:${graphHashKey(record.previous_hash)}`);
    if (!parent || !record.previous_hash) return [];
    const parentNode = recordNodes.find(({ record: candidate }) => candidate.record_id === parent.record_id);
    return parentNode ? [{ id: `${parent.record_id}:${record.record_id}`, source: parentNode, target: node }] : [];
  });
  const recordEvidenceEdges = recordNodes.flatMap((recordNode) => visibleItems.flatMap((item) => {
    const linkedRecordId = item.metadata?.record_id || item.metadata?.recordId;
    return linkedRecordId === recordNode.record.record_id && evidenceMap.has(item.id)
      ? [{ id: `${recordNode.record.record_id}:${item.id}`, record: recordNode, evidence: evidenceMap.get(item.id) }]
      : [];
  }));
  const recordById = new Map(recordNodes.map((node) => [node.record.record_id, node]));
  const enabled = (name) => layer === "All" || layer === name;
  const showLinkedContext = layer === "Stored links";
  const onDown = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    dragStart.current = { x: event.clientX, y: event.clientY, pan };
    didDrag.current = false;
  };
  const onMove = (event) => {
    if (!dragStart.current) return;
    const dx = event.clientX - dragStart.current.x;
    const dy = event.clientY - dragStart.current.y;
    if (!didDrag.current && Math.hypot(dx, dy) < 5) return;
    if (!didDrag.current) {
      didDrag.current = true;
      setDragging(true);
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch (_) { /* Pointer capture is not available in every browser. */ }
    }
    setPan([dragStart.current.pan[0] + dx, dragStart.current.pan[1] + dy]);
  };
  const onUp = () => {
    if (didDrag.current) {
      suppressClick.current = true;
      window.setTimeout(() => { suppressClick.current = false; }, 0);
    }
    dragStart.current = null;
    didDrag.current = false;
    setDragging(false);
  };
  const pick = (item) => {
    if (suppressClick.current) return;
    setSelected(item.id);
    setSelectedEdgeId(null);
    setSelectedRecordId(null);
    setSelectedSourceName(null);
    setIdentitySelected(false);
    onPick(item);
  };
  const pickEdge = (edge) => {
    if (suppressClick.current) return;
    setSelectedEdgeId(edge.id);
    setSelectedRecordId(null);
    setSelectedSourceName(null);
    setIdentitySelected(false);
  };
  const pickSource = (name) => {
    if (suppressClick.current) return;
    setSelectedSourceName(name);
    setSelectedRecordId(null);
    setSelectedEdgeId(null);
    setIdentitySelected(false);
  };
  const pickIdentity = () => {
    if (suppressClick.current) return;
    setIdentitySelected(true);
    setSelectedRecordId(null);
    setSelectedEdgeId(null);
    setSelectedSourceName(null);
  };
  const pickRecord = (recordId) => {
    if (suppressClick.current) return;
    setSelectedRecordId(recordId);
    setSelectedEdgeId(null);
    setSelectedSourceName(null);
    setIdentitySelected(false);
  };
  const activateOnKey = (event, activate) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activate();
    }
  };
  const selectedEdge = linkedEdges.find((edge) => edge.id === selectedEdgeId);
  const selectedEdgeSource = selectedEdge && evidenceMap.get(selectedEdge.source_id)?.item;
  const selectedEdgeTarget = selectedEdge && evidenceMap.get(selectedEdge.target_id)?.item;
  const selectedSourceItems = selectedSourceName
    ? visibleItems.filter((item) => (item.provider || "Unknown source") === selectedSourceName)
    : [];
  const selectedSource = sourceNodes.find((node) => node.name === selectedSourceName);
  const selectedRecordNode = selectedRecordId ? recordById.get(selectedRecordId) : null;
  const selectedRecordAudit = selectedRecordId ? auditResult[selectedRecordId] : null;
  const selectedRecordTrace = selectedRecordId ? traceResult[selectedRecordId] : null;
  const relationNote = selectedEdge?.relation === "generated"
    ? "The connector returned this activity item from the provider profile. This establishes where the item came from; it does not verify the activity's claims."
    : selectedEdge?.metadata && [selectedEdge.metadata.description, selectedEdge.metadata.reason, selectedEdge.metadata.note]
      .find((value) => typeof value === "string" && value.trim());
  const relationMeaning = !selectedEdge
    ? "Select a saved relation to see what the connection means."
    : selectedEdge.relation === "generated"
      ? "The connector returned this activity item from the provider profile. This establishes where the item came from; it does not verify the activity's claims."
      : relationNote || `This ${String(selectedEdge.relation || "related_to").replaceAll("_", " ")} relationship is stored in the evidence graph. A saved relationship does not independently verify either endpoint.`;

  return <section className="xrd-graph-tool">
    <style>{`.xrd-graph-edge{cursor:pointer}.xrd-graph-edge:focus-visible{outline:none}.xrd-graph-edge:focus-visible .xrd-graph-edge-hit,.xrd-graph-edge.is-selected .xrd-graph-edge-hit{stroke:rgba(163,230,53,.28);stroke-width:13}.xrd-graph-edge.is-selected .xrd-graph-edge-visible{stroke:#a3e635;stroke-width:3}.xrd-graph-edge-hit{fill:none;stroke:transparent;stroke-width:18;pointer-events:stroke}.xrd-graph-edge-visible{fill:none;stroke:#fbbf24;stroke-width:2;stroke-dasharray:3 10;stroke-linecap:round}.xrd-graph-source-node,.xrd-graph-person{cursor:pointer}.xrd-graph-source-node.is-selected circle{stroke:#a3e635;stroke-width:2}.xrd-graph-person:focus-visible{outline:none}.xrd-graph-person:focus-visible circle:first-child,.xrd-graph-person.is-selected circle:first-child{stroke:#a3e635;stroke-width:2}.xrd-graph-inspector{margin-top:12px;padding:14px;border:1px solid rgba(163,230,53,.32);border-radius:13px;background:linear-gradient(180deg,#0a0c0a,#000)}.xrd-graph-inspector-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.xrd-graph-inspector h3{margin:4px 0;color:#e7eee2;font-size:14px;overflow-wrap:anywhere}.xrd-graph-inspector p{margin:8px 0 0;color:#9da797;font-size:11px;line-height:1.55}.xrd-graph-inspector-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}.xrd-graph-inspector-actions button{display:flex;align-items:center;gap:6px;max-width:100%;padding:7px 9px;border:1px solid #2a2d2a;border-radius:8px;background:#000;color:#cfd8c9;font-size:10px;text-align:left;overflow-wrap:anywhere}.xrd-graph-inspector-actions button:hover{border-color:rgba(163,230,53,.5);color:#a3e635}@media(max-width:650px){.xrd-graph-inspector-head{flex-direction:column}.xrd-graph-inspector-actions{flex-direction:column}.xrd-graph-inspector-actions button{width:100%}}`}</style>
    <style>{`.xrd-graph-account-link{fill:none;stroke:#60a5fa;stroke-width:1.6;stroke-opacity:.75}.xrd-graph-account-link.is-profile-url{stroke-dasharray:4 6;stroke:#fbbf24}.xrd-graph-record-link{fill:none;stroke:#a3e635;stroke-width:1.7;stroke-opacity:.72}.xrd-graph-record-evidence-link{fill:none;stroke:#d4d8d2;stroke-width:1.3;stroke-dasharray:2 6;stroke-opacity:.65}.xrd-graph-record-node{cursor:pointer}.xrd-graph-record-node circle{fill:#030503;stroke:#a3e635;stroke-width:1.5}.xrd-graph-record-node.is-selected circle{fill:rgba(163,230,53,.18);stroke-width:3}.xrd-graph-record-node:focus-visible{outline:none}.xrd-graph-record-node:focus-visible circle{stroke-width:3}.xrd-graph-meaning{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:10px}.xrd-graph-meaning span{padding:9px 10px;border:1px solid #252b23;border-radius:9px;background:#050705;color:#99a393;font-size:10px;line-height:1.45}.xrd-graph-meaning b{color:#dce5d7}.xrd-graph-record-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}.xrd-graph-record-actions button{display:flex;align-items:center;gap:6px;padding:8px 10px;border:1px solid #343b30;border-radius:8px;background:#000;color:#dce5d7;font-size:10px}.xrd-graph-record-actions button:hover{border-color:var(--xrd-ac);color:var(--xrd-ac)}@media(max-width:650px){.xrd-graph-meaning{grid-template-columns:minmax(0,1fr)}.xrd-graph-record-actions{flex-direction:column}.xrd-graph-record-actions button{width:100%}}`}</style>
    <style>{`.xrd-graph-account-link{fill:none;stroke:#60a5fa;stroke-width:1.6;stroke-opacity:.75}.xrd-graph-account-link.is-profile-url{stroke-dasharray:4 6;stroke:#fbbf24}.xrd-graph-record-link{fill:none;stroke:#a3e635;stroke-width:1.7;stroke-opacity:.72}.xrd-graph-record-evidence-link{fill:none;stroke:#d4d8d2;stroke-width:1.3;stroke-dasharray:2 6;stroke-opacity:.65}.xrd-graph-record-node{cursor:pointer}.xrd-graph-record-node circle{fill:#030503;stroke:#a3e635;stroke-width:1.5}.xrd-graph-record-node.is-selected circle{fill:rgba(163,230,53,.18);stroke-width:3}.xrd-graph-record-node:focus-visible{outline:none}.xrd-graph-record-node:focus-visible circle{stroke-width:3}.xrd-graph-record-status{fill:#a3e635;font-size:7px;letter-spacing:.5px}.xrd-graph-meaning{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:10px}.xrd-graph-meaning span{padding:9px 10px;border:1px solid #252b23;border-radius:9px;background:#050705;color:#99a393;font-size:10px;line-height:1.45}.xrd-graph-meaning b{color:#dce5d7}.xrd-graph-record-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}.xrd-graph-record-actions button{display:flex;align-items:center;gap:6px;padding:8px 10px;border:1px solid #343b30;border-radius:8px;background:#000;color:#dce5d7;font-size:10px}.xrd-graph-record-actions button:hover{border-color:var(--xrd-ac);color:var(--xrd-ac)}.xrd-graph-legend .record{border-top:1px solid #a3e635}.xrd-graph-legend .account{border-top:1px solid #60a5fa}@media(max-width:650px){.xrd-graph-meaning{grid-template-columns:minmax(0,1fr)}.xrd-graph-record-actions{flex-direction:column}.xrd-graph-record-actions button{width:100%}}`}</style>
    <div className="xrd-graph-tools" role="group" aria-label="Evidence graph layers">
      { ["All", "Identity", "Sources", "XRC records", "Evidence", "Stored links"].map((name) => <button type="button" key={name} className={layer === name ? "active" : ""} onClick={() => setLayer(name)}>{name}</button>)}
      <span className="xrd-graph-count">{sourceNodes.length} PROVIDERS · {recordNodes.length} XRC RECORDS · {visibleItems.length} EVIDENCE · {linkedEdges.length} SAVED LINKS</span>
    </div>
    <div className={`xrd-graph-canvas${dragging ? " is-dragging" : ""}`} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onClickCapture={(event) => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); } }}>
      <div className="xrd-graph-hud"><span><i />XRC EVIDENCE MAP</span><span>DRAG TO PAN</span></div>
      <svg viewBox="0 0 960 600" role="group" aria-label="Interactive provenance graph of profile, connected sources, XRC records, and evidence">
        <defs>
          <radialGradient id="xrd-graph-core"><stop offset="0" stopColor="#a3e635" stopOpacity=".18" /><stop offset="1" stopColor="#10b981" stopOpacity="0" /></radialGradient>
          <filter id="xrd-graph-glow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <g transform={`translate(${pan[0]} ${pan[1]})`}>
          <ellipse cx={cx} cy={cy} rx="350" ry="235" fill="url(#xrd-graph-core)" />
          {[115, 246, 325].map((radius) => <ellipse key={radius} cx={cx} cy={cy} rx={radius} ry={radius * .65} fill="none" stroke="#283126" strokeDasharray={radius === 246 ? "2 7" : "1 8"} />)}
          {["PROFILE", "XRC RECORDS", "EVIDENCE"].map((label, index) => <text key={label} x={cx} y={cy - [109, 159, 214][index]} textAnchor="middle" fill="#7c8879" fontSize="9" letterSpacing="2.5">{label}</text>)}
          {(enabled("Sources") || enabled("Stored links")) && sourceNodes.filter((source) => source.connection?.auth_status === "active").map((source) => <path key={`account:${source.name}`} className={`xrd-graph-account-link${source.connection.connected_via === "profile_link" ? " is-profile-url" : ""}`} d={`M${cx} ${cy} Q${(cx + source.x) / 2 - 12} ${(cy + source.y) / 2} ${source.x} ${source.y}`}><title>{source.connection.connected_via === "profile_link" ? "Profile URL supplied by owner; account ownership not confirmed" : source.connection.hasValidToken ? "Active provider connection with valid token; supports control of this account only" : "Active provider connection; token control not confirmed"}</title></path>)}
          {(enabled("XRC records") || enabled("Stored links")) && recordChainEdges.map((edge) => <path key={edge.id} className="xrd-graph-record-link" d={`M${edge.source.x} ${edge.source.y} Q${(edge.source.x + edge.target.x) / 2} ${(edge.source.y + edge.target.y) / 2 - 12} ${edge.target.x} ${edge.target.y}`}><title>Stored previous-hash link between XRC records</title></path>)}
          {(enabled("XRC records") || enabled("Stored links")) && recordEvidenceEdges.map((edge) => <path key={edge.id} className="xrd-graph-record-evidence-link" d={`M${edge.record.x} ${edge.record.y} Q${(edge.record.x + edge.evidence.x) / 2} ${(edge.record.y + edge.evidence.y) / 2} ${edge.evidence.x} ${edge.evidence.y}`}><title>Evidence metadata references this XRC record</title></path>)}
          {enabled("Stored links") && linkedEdges.map((edge) => {
            const from = evidenceMap.get(edge.source_id), to = evidenceMap.get(edge.target_id);
            const path = `M${from.x} ${from.y} Q${(from.x + to.x) / 2} ${(from.y + to.y) / 2 - 20} ${to.x} ${to.y}`;
            const sourceLabel = from.item.title || from.item.evidence_type || "Evidence";
            const targetLabel = to.item.title || to.item.evidence_type || "Evidence";
            return <g key={edge.id} role="button" tabIndex={0} aria-label={`Inspect ${String(edge.relation || "related_to").replaceAll("_", " ")} relationship: ${sourceLabel} to ${targetLabel}`} className={`xrd-graph-edge${selectedEdgeId === edge.id ? " is-selected" : ""}`} onClick={() => pickEdge(edge)} onKeyDown={(event) => activateOnKey(event, () => pickEdge(edge))}><path className="xrd-graph-edge-hit" d={path} /><path className="xrd-graph-edge-visible" d={path} /><title>{String(edge.relation || "related_to").replaceAll("_", " ")}</title></g>;
          })}
          {(enabled("Sources") || showLinkedContext) && sourceNodes.map((source) => <g key={source.name} role="button" tabIndex={0} aria-label={`Inspect ${source.name} source with ${visibleItems.filter((item) => (item.provider || "Unknown source") === source.name).length} evidence items`} className={`xrd-graph-source-node${selectedSourceName === source.name ? " is-selected" : ""}`} onClick={() => pickSource(source.name)} onKeyDown={(event) => activateOnKey(event, () => pickSource(source.name))}>
            {enabled("Evidence") && !showLinkedContext && visibleItems.filter((item) => (item.provider || "Unknown source") === source.name).map((item) => {
              const node = evidenceMap.get(item.id);
              return <path key={item.id} d={`M${source.x} ${source.y} Q${(source.x + node.x) / 2} ${(source.y + node.y) / 2} ${node.x} ${node.y}`} />;
            })}
            <circle cx={source.x} cy={source.y} r="29" /><Database x={source.x - 8} y={source.y - 8} size={16} color="#a3e635" />
            <text x={source.x} y={source.y + 43} textAnchor="middle">{source.name.slice(0, 20)}</text>
          </g>)}
          {(enabled("Identity") || showLinkedContext) && <g role="button" tabIndex={0} aria-label={`Inspect ${profile?.fullName || "Xeevia profile"} profile record`} className={`xrd-graph-person${identitySelected ? " is-selected" : ""}`} onClick={pickIdentity} onKeyDown={(event) => activateOnKey(event, pickIdentity)}><circle cx={cx} cy={cy} r="38" /><circle cx={cx} cy={cy} r="47" className="xrd-graph-orbit" /><Fingerprint x={cx - 12} y={cy - 12} size={24} color="#071004" /><text x={cx} y={cy + 60} textAnchor="middle">{"XEEVIA PROFILE"}</text></g>}
          {(enabled("XRC records") || showLinkedContext) && recordNodes.map(({ record, x, y }) => {
            const check = auditResult[record.record_id];
            const integrityStatus = check?.loading ? "CHECKING" : check?.result?.status?.toUpperCase() || "NOT CHECKED";
            return <g key={record.record_id} role="button" tabIndex={0} aria-label={`Inspect XRC record ${record.payload?.event || record.stream_type}, integrity ${integrityStatus}`} className={`xrd-graph-record-node${selectedRecordId === record.record_id ? " is-selected" : ""}`} onClick={() => pickRecord(record.record_id)} onKeyDown={(event) => activateOnKey(event, () => pickRecord(record.record_id))}>
              <circle cx={x} cy={y} r="16" /><GitBranch x={x - 7} y={y - 7} size={14} color="#a3e635" />
              <text x={x} y={y + 28} textAnchor="middle">{(record.payload?.event || record.stream_type || "XRC record").replaceAll("_", " ").slice(0, 20)}</text>
              <text x={x} y={y + 39} textAnchor="middle" className="xrd-graph-record-status">{integrityStatus}</text>
            </g>;
          })}
          {(enabled("Evidence") || showLinkedContext) && evidenceNodes.map(({ item, x, y }) => <g key={item.id} role="button" tabIndex={0} aria-label={`Open ${item.title || item.evidence_type || "evidence"}`} className={`xrd-graph-evidence${selected === item.id ? " selected" : ""}`} onClick={() => pick(item)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); pick(item); } }}>
            <circle cx={x} cy={y} r="19" /><FileText x={x - 7} y={y - 7} size={14} color="#e9eee5" />
            <text x={x} y={y + 32} textAnchor="middle">{(item.title || item.evidence_type || "Evidence").slice(0, 18)}</text>
          </g>)}
        </g>
      </svg>
      {(pan[0] || pan[1]) && <button type="button" className="xrd-graph-reset" onPointerDown={(event) => event.stopPropagation()} onClick={() => setPan([0, 0])}>Recenter graph</button>}
      <div className="xrd-graph-legend"><span><i className="source" />Provider grouping</span><span><i className="stored" />Saved evidence relation</span><span><i className="record" />XRC hash link</span><span><i className="account" />Account connection</span></div>
    </div>
    <p className="xrd-graph-caption">Solid links are saved evidence relationships. Dashed links group records by their source and do not claim a verified relationship.</p>
    <div className="xrd-graph-meaning"><span><b>Linked account:</b> account control only, not personhood or claim truth.</span><span><b>Provider grouping:</b> items share a source label; grouping is not a binding.</span><span><b>Source status:</b> reports what the provider returned, not an independent claim check.</span><span><b>XRC hash check:</b> tests whether the stored record data matches its hash.</span><span><b>Chain trace:</b> follows previous-hash links and reports a missing parent or chain start; it does not validate the claim.</span><span><b>Selected relation:</b> {relationMeaning}</span>{selectedSourceName && <span><b>{selectedSourceName}:</b> {selectedSource?.connection ? selectedSource.connection.connected_via === "profile_link" ? "Owner supplied a public URL; ownership is not confirmed." : selectedSource.connection.auth_status === "active" && selectedSource.connection.hasValidToken ? "Active connection and valid token support control of this provider account only." : `Connection status is ${selectedSource.connection.auth_status || "unknown"}; a usable token is not confirmed.` : "Evidence shares this provider label, but no linked account connection is present."}</span>}{identitySelected && <span><b>Profile node:</b> represents the Xeevia profile record; it does not establish personhood.</span>}</div>
    {selectedRecordNode && <section className="xrd-graph-inspector" aria-live="polite"><span className="xrd-kicker">FIRST-PARTY XRC RECORD</span><h3>{selectedRecordNode.record.payload?.event?.replaceAll("_", " ") || selectedRecordNode.record.stream_type}</h3><p>Hash check: {selectedRecordAudit?.loading ? "Checking…" : selectedRecordAudit?.result?.status || selectedRecordAudit?.error || "Not checked"}. This checks whether the stored record data matches its hash. Chain trace separately follows previous-hash links. Neither check verifies the truth of the original claim.{selectedRecordTrace?.result?.chain?.length ? ` Trace returned ${selectedRecordTrace.result.depth} linked record${selectedRecordTrace.result.depth === 1 ? "" : "s"}${selectedRecordTrace.result.reachedGenesis ? " and reached the chain start" : selectedRecordTrace.result.brokenLink ? " and found a broken parent link" : ""}.` : ""}</p><div className="xrd-graph-record-actions"><button type="button" disabled={selectedRecordAudit?.loading} onClick={() => onVerifyRecord(selectedRecordNode.record.record_id)}><ShieldCheck size={13} />Check XRC integrity</button><button type="button" disabled={selectedRecordTrace?.loading} onClick={() => onTraceRecord(selectedRecordNode.record.record_id)}><GitBranch size={13} />Trace hash chain</button><button type="button" onClick={() => onOpenChain(selectedRecordNode.record.record_id)}><ChevronRight size={13} />Open chain history</button></div></section>}
    {selectedEdge && selectedEdgeSource && selectedEdgeTarget && <section className="xrd-graph-inspector" aria-live="polite"><div className="xrd-graph-inspector-head"><div><span className="xrd-kicker">STORED EVIDENCE RELATIONSHIP</span><h3>{selectedEdgeSource.title || selectedEdgeSource.evidence_type || "Evidence"} <span aria-hidden="true">→</span> {selectedEdgeTarget.title || selectedEdgeTarget.evidence_type || "Evidence"}</h3></div><span className="xrd-status">{String(selectedEdge.relation || "related_to").replaceAll("_", " ")}</span></div><p>{relationNote || "This link is stored in the evidence graph. Its relation label describes the saved connection; it does not independently verify either record."}</p><div className="xrd-graph-inspector-actions"><button type="button" onClick={() => onPick(selectedEdgeSource)}><FileText size={13} />Open source evidence</button><button type="button" onClick={() => onPick(selectedEdgeTarget)}><FileText size={13} />Open related evidence</button><button type="button" onClick={() => onOpenVerification(selectedEdgeSource)}><ShieldCheck size={13} />Open verification</button></div></section>}
    {selectedSourceName && <section className="xrd-graph-inspector" aria-live="polite"><span className="xrd-kicker">EVIDENCE SOURCE · {selectedSourceItems.length}</span><h3>{selectedSourceName}</h3><p>Items are grouped by their stored provider field. Select a record to inspect its evidence and source details.</p><div className="xrd-graph-inspector-actions">{selectedSourceItems.map((item) => <button type="button" key={item.id} onClick={() => onPick(item)}><FileText size={13} />{item.title || item.evidence_type || "Evidence record"}<span className={`xrd-status${item.verified ? " is-verified" : ""}`}>{normalizeStatus(item)}</span></button>)}{selectedSourceItems[0] && <button type="button" onClick={() => onOpenVerification(selectedSourceItems[0])}><ShieldCheck size={13} />Open source verification</button>}</div></section>}
    {identitySelected && <section className="xrd-graph-inspector" aria-live="polite"><span className="xrd-kicker">XEEVIA PROFILE RECORD</span><h3>{profile?.fullName || "Profile"}</h3><p>@{profile?.username || "unknown"} · This is the profile stored by Xeevia. It does not by itself establish personhood. Account links, source evidence, and XRC integrity are separate checks.</p><div className="xrd-graph-inspector-actions"><button type="button" onClick={onOpenIdentity}><Fingerprint size={13} />Inspect identity bindings</button><button type="button" onClick={() => onOpenVerification(items.find((item) => ["profile", "identity"].includes(String(item.evidence_type || item.type || "").toLowerCase())) || items[0])}><ShieldCheck size={13} />Inspect profile evidence</button></div></section>}
  </section>;
}

const XRDProfileDashboard = ({
  profile,
  currentUser,
  targetId,
  verificationItems = [],
  initialSection = "Overview",
  onClose,
}) => {
  const { openAccountLink } = useAccountLinking();
  const viewerId = currentUser?.id || currentUser?.uid || currentUser?.userId || currentUser?.user_id;
  const own = Boolean(viewerId && targetId && String(viewerId) === String(targetId));
  const requestedInitialSection = initialSection === "XRC Oracle" ? "Oracle" : initialSection;
  const [section, setSection] = useState(!own && OWNER_ONLY.has(requestedInitialSection) ? "Overview" : requestedInitialSection);
  const [sectionHistory, setSectionHistory] = useState([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [records, setRecords] = useState([]);
  const [securityEvents, setSecurityEvents] = useState([]);
  const [securityEventsLoading, setSecurityEventsLoading] = useState(false);
  const [securityEventsError, setSecurityEventsError] = useState("");
  const [expandedAuditEvent, setExpandedAuditEvent] = useState(null);
  const [evidenceItems, setEvidenceItems] = useState(verificationItems);
  const [evidenceEdges, setEvidenceEdges] = useState([]);
  const [edgesError, setEdgesError] = useState("");
  const [selectedEvidence, setSelectedEvidence] = useState(null);
  const [visibilitySaving, setVisibilitySaving] = useState(false);
  const [visibilityError, setVisibilityError] = useState("");
  const [recordsLoading, setRecordsLoading] = useState(own);
  const [recordsError, setRecordsError] = useState("");
  const [filter, setFilter] = useState("");
  const [auditResult, setAuditResult] = useState({});
  const [verificationTargetId, setVerificationTargetId] = useState(null);
  const [sourceChecks, setSourceChecks] = useState({});
  const [accessRequests, setAccessRequests] = useState([]);
  const [evidenceGrants, setEvidenceGrants] = useState([]);
  const [accessRequestsLoading, setAccessRequestsLoading] = useState(false);
  const [accessRequestsError, setAccessRequestsError] = useState("");
  const [accessRequestStatus, setAccessRequestStatus] = useState("");
  const [accessRequestBusy, setAccessRequestBusy] = useState(false);
  const [grantSelections, setGrantSelections] = useState({});
  const [accessNotice, setAccessNotice] = useState("");
  const [traceResult, setTraceResult] = useState({});
  const [oracleOpen, setOracleOpen] = useState(["Oracle", "XRC Oracle"].includes(initialSection));
  const [settingsGroup, setSettingsGroup] = useState("Visibility");
  const [permissionsDimension, setPermissionsDimension] = useState("Visibility");
  const [sourceConnections, setSourceConnections] = useState([]);
  const [sourceBusy, setSourceBusy] = useState("");
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceNotice, setSourceNotice] = useState("");
  const [userPreferences, setUserPreferences] = useState({});
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [identityDraft, setIdentityDraft] = useState({
    headline: "",
    bio: "",
    location: "",
    pronouns: "",
    website: "",
    note: "",
    availability: "",
  });
  const [identitySaving, setIdentitySaving] = useState(false);
  const [identityNotice, setIdentityNotice] = useState("");
  const [identityDetails, setIdentityDetails] = useState(() => getXrdIdentityDetails());
  const [identityFieldVisibility, setIdentityFieldVisibility] = useState(() => getXrdIdentityFieldVisibility());
  const [identityFieldStatuses, setIdentityFieldStatuses] = useState(() => getXrdIdentityFieldStatuses());
  const [identityLoading, setIdentityLoading] = useState(false);
  const [remarks, setRemarks] = useState([]);
  const [remarksLoading, setRemarksLoading] = useState(false);
  const [remarksError, setRemarksError] = useState("");
  const [remarkType, setRemarkType] = useState("CONTEXT");
  const [remarkEvidenceId, setRemarkEvidenceId] = useState("");
  const [remarkBody, setRemarkBody] = useState("");
  const [remarkResponses, setRemarkResponses] = useState({});
  const [remarksNotice, setRemarksNotice] = useState("");
  const [remarkSaving, setRemarkSaving] = useState(false);
  const [oracleQuery, setOracleQuery] = useState("");
  const [oracleAnswer, setOracleAnswer] = useState(null);
  const [oracleConversation, setOracleConversation] = useState([]);
  const [oracleChatOpen, setOracleChatOpen] = useState(false);
  const [photoHubOpen, setPhotoHubOpen] = useState(false);
  const [photoSyncing, setPhotoSyncing] = useState(false);
  const [photoSyncMessage, setPhotoSyncMessage] = useState("");
  const [photoConnections, setPhotoConnections] = useState([]);
  const [authenticatedAvatarCandidates, setAuthenticatedAvatarCandidates] = useState([]);
  const photoSyncAttempted = useRef(false);

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

  useEffect(() => {
    setEvidenceItems(verificationItems);
  }, [verificationItems]);

  useEffect(() => {
    if (!own || !targetId) return undefined;
    let active = true;
    supabase.auth.getUser().then(({ data, error }) => {
      if (error) throw error;
      if (!active || String(data?.user?.id || "") !== String(targetId)) return;
      const metadata = data.user.user_metadata || {};
      const candidates = [...new Set([
        ...mediaUrlService.resolveAvatarUrls(metadata, 300),
        ...mediaUrlService.resolveAvatarUrls(data.user.identities?.map((identity) => identity?.identity_data || {}), 300),
      ])];
      setAuthenticatedAvatarCandidates(candidates);
    }).catch((error) => {
      if (active) console.warn("[XRD] Could not load the authenticated profile image:", error?.message);
    });
    return () => { active = false; };
  }, [own, targetId]);

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

  const loadSourceConnections = useCallback(async () => {
    if (!own) return;
    setSourceLoading(true);
    setSourceNotice("");
    try {
      const connections = await socialConnectService.getConnections(targetId);
      setSourceConnections(Object.entries(connections || {}).map(([provider, connection]) => ({ provider, ...connection })));
    } catch (error) {
      setSourceNotice(error?.message || "Connected sources could not be loaded.");
    } finally {
      setSourceLoading(false);
    }
  }, [own, targetId]);

    <style>{`.xrd-graph-canvas>svg .xrd-graph-edge .xrd-graph-edge-hit{fill:none;stroke:transparent;stroke-width:18;stroke-dasharray:none;animation:none;pointer-events:stroke}.xrd-graph-canvas>svg .xrd-graph-edge .xrd-graph-edge-visible{fill:none;stroke:#fbbf24;stroke-width:2;stroke-dasharray:3 10;stroke-linecap:round;animation:none;pointer-events:none}.xrd-graph-canvas>svg .xrd-graph-edge.is-selected .xrd-graph-edge-visible{stroke:#a3e635;stroke-width:3}.xrd-graph-canvas>svg .xrd-graph-edge:focus-visible .xrd-graph-edge-hit,.xrd-graph-canvas>svg .xrd-graph-edge.is-selected .xrd-graph-edge-hit{stroke:rgba(163,230,53,.28);stroke-width:13}`}</style>
  useEffect(() => {
    if ((section === "Sources" || section === "Identity" || section === "Graph") && own) loadSourceConnections();
  }, [section, own, loadSourceConnections]);

  const loadUserPreferences = useCallback(async () => {
    if (!own || !targetId) return;
    setSettingsLoading(true);
    setSettingsError("");
    try {
      const { data, error } = await supabase.from("profiles").select("preferences").eq("id", targetId).maybeSingle();
      if (error) throw error;
      const nextPreferences = data?.preferences || {};
      setUserPreferences(nextPreferences);
    } catch (error) {
      setSettingsError(error?.message || "XRD preferences could not be loaded.");
    } finally {
      setSettingsLoading(false);
    }
  }, [own, targetId]);

  useEffect(() => {
    if (section !== "Settings") return undefined;
    if (!own || !targetId) return undefined;
    loadUserPreferences();
    return undefined;
  }, [section, own, targetId, loadUserPreferences]);

  useEffect(() => {
    if (section !== "Identity" || !targetId) return undefined;
    let active = true;
    setIdentityLoading(true);
    setIdentityNotice("");
    supabase.from("xrd_identity_details").select("field_key,value,visibility,status,updated_at").eq("profile_id", targetId)
      .then(({ data, error }) => {
        if (error) throw error;
        if (!active) return;
        const rows = data || [];
        const details = getXrdIdentityDetails(rows);
        setIdentityDetails(details);
        setIdentityFieldVisibility(getXrdIdentityFieldVisibility(rows));
        setIdentityFieldStatuses(getXrdIdentityFieldStatuses(rows));
        if (own) setIdentityDraft(details);
      })
      .catch((error) => {
        if (active) setIdentityNotice(error?.message || "Identity details could not be loaded.");
      })
      .finally(() => {
        if (active) setIdentityLoading(false);
      });
    return () => { active = false; };
  }, [section, targetId, own]);

  useEffect(() => {
    if (section !== "Remarks" || !targetId) return undefined;
    let active = true;
    setRemarksLoading(true);
    setRemarksError("");
    supabase.from("xrd_remarks").select("*").eq("profile_id", targetId).order("created_at", { ascending: false }).limit(100)
      .then(({ data, error }) => {
        if (error) throw error;
        if (active) setRemarks(data || []);
      })
      .catch((error) => {
        if (active) setRemarksError(error?.message || "Remarks could not be loaded.");
      })
      .finally(() => {
        if (active) setRemarksLoading(false);
      });
    return () => { active = false; };
  }, [section, targetId]);

  useEffect(() => {
    if (section !== "Audit" || !own || !targetId) return undefined;
    let active = true;
    setSecurityEventsLoading(true);
    setSecurityEventsError("");
    supabase.from("security_events").select("*").eq("user_id", targetId).order("created_at", { ascending: false }).limit(100)
      .then(({ data, error }) => {
        if (error) throw error;
        if (active) setSecurityEvents(data || []);
      })
      .catch((error) => {
        if (active) setSecurityEventsError(error?.message || "Security audit events could not be loaded.");
      })
      .finally(() => {
        if (active) setSecurityEventsLoading(false);
      });
    return () => { active = false; };
  }, [section, own, targetId]);

  useEffect(() => {
    if (section === "Permissions" && own && targetId) {
      let active = true;
      setAccessRequestsLoading(true);
      setAccessRequestsError("");
      Promise.all([
        supabase.from("xrd_access_requests").select("*").eq("profile_id", targetId).eq("status", "pending").order("created_at", { ascending: false }),
        supabase.from("xrd_evidence_grants").select("*").eq("profile_id", targetId).order("created_at", { ascending: false }),
      ])
        .then(([requestsResult, grantsResult]) => {
          if (requestsResult.error) throw requestsResult.error;
          if (grantsResult.error) throw grantsResult.error;
          if (active) {
            setAccessRequests(requestsResult.data || []);
            setEvidenceGrants(grantsResult.data || []);
          }
        })
        .catch((error) => {
          if (active) setAccessRequestsError(error?.message || "Access requests could not be loaded.");
        })
        .finally(() => { if (active) setAccessRequestsLoading(false); });
      return () => { active = false; };
    }
    if ((section === "Records" || section === "Evidence") && !own && viewerId) {
      let active = true;
      setAccessRequestStatus("");
      supabase.from("xrd_access_requests").select("status").eq("profile_id", targetId).eq("requester_id", viewerId).order("created_at", { ascending: false }).limit(1)
        .then(({ data, error }) => {
          if (error) throw error;
          if (active && data?.[0]) setAccessRequestStatus(data[0].status);
        })
        .catch(() => {});
      return () => { active = false; };
    }
    return undefined;
  }, [section, own, targetId, viewerId]);

  const connectSource = async (provider) => {
    setSourceBusy(provider);
    setSourceNotice("");
    try {
      const result = await openAccountLink({ userId: targetId, platform: provider, readOnly: true, purpose: "evidence" });
      if (result?.cancelled) return;
      await loadSourceConnections();
      setSourceNotice(`${provider} connected for identity evidence.`);
    } catch (error) {
      setSourceNotice(error?.message || `Could not connect ${provider}.`);
    } finally {
      setSourceBusy("");
    }
  };

  const syncSource = async (provider) => {
    setSourceBusy(provider);
    setSourceNotice("");
    try {
      await syncUserConnectorEvidence(targetId, provider);
      const fresh = await evidenceService.getEvidenceForProfile(targetId, { limit: 50 });
      setEvidenceItems((current) => {
        const firstParty = current.filter((item) => item.provider === "Xeevia");
        const merged = new Map([...firstParty, ...fresh].map((item) => [item.id, item]));
        return [...merged.values()];
      });
      await loadSourceConnections();
      setSourceNotice(`${provider} evidence synchronized.`);
    } catch (error) {
      setSourceNotice(error?.message || `${provider} could not be synchronized.`);
    } finally {
      setSourceBusy("");
    }
  };

  const disconnectSource = async (provider) => {
    if (!window.confirm(`Disconnect ${provider}? Existing evidence remains in your XRD.`)) return;
    setSourceBusy(provider);
    setSourceNotice("");
    try {
      await socialConnectService.unlinkPlatform(targetId, provider);
      await loadSourceConnections();
      setSourceNotice(`${provider} disconnected. Existing evidence was kept.`);
    } catch (error) {
      setSourceNotice(error?.message || `${provider} could not be disconnected.`);
    } finally {
      setSourceBusy("");
    }
  };

  const toggleXrdSetting = async (setting) => {
    const key = `${settingsGroup}:${setting}`;
    const current = userPreferences.xrd_settings || {};
    const nextSettings = { ...current, [key]: current[key] === false };
    setSettingsBusy(key);
    setSettingsError("");
    try {
      const preferences = { ...userPreferences, xrd_settings: nextSettings };
      const { error } = await supabase.from("profiles").update({ preferences, updated_at: new Date().toISOString() }).eq("id", targetId);
      if (error) throw error;
      setUserPreferences(preferences);
    } catch (error) {
      setSettingsError(error?.message || "Preference could not be saved.");
    } finally {
      setSettingsBusy("");
    }
  };

  const publishRemark = async () => {
    const evidence = evidenceItems.find((item) => item.id === remarkEvidenceId);
    if (remarkSaving || !viewerId || !evidence || remarkBody.trim().length < 5) return;
    setRemarksNotice("");
    setRemarksError("");
    setRemarkSaving(true);
    try {
      const { data, error } = await supabase.from("xrd_remarks").insert({
        profile_id: targetId,
        evidence_item_id: evidence.id,
        record_title: evidence.title || evidence.evidence_type || "Evidence record",
        remark_type: remarkType,
        body: remarkBody.trim(),
        author_id: viewerId,
        status: "published",
      }).select().single();
      if (error) throw error;
      setRemarks((current) => [data, ...current]);
      setRemarkBody("");
      setRemarksNotice("Remark published.");
    } catch (error) {
      setRemarksError(error?.message || "Remark could not be published.");
    } finally {
      setRemarkSaving(false);
    }
  };

  const saveRemarkResponse = async (remark) => {
    const response = (remarkResponses[remark.id] || "").trim();
    if (remarkSaving || !response) return;
    setRemarksNotice("");
    setRemarksError("");
    setRemarkSaving(true);
    try {
      const { data, error } = await supabase.from("xrd_remarks")
        .update({ owner_response: response, owner_response_at: new Date().toISOString() })
        .eq("id", remark.id).eq("profile_id", targetId).select().single();
      if (error) throw error;
      setRemarks((current) => current.map((item) => item.id === data.id ? data : item));
      setRemarkResponses((current) => ({ ...current, [remark.id]: "" }));
      setRemarksNotice("Owner response saved.");
    } catch (error) {
      setRemarksError(error?.message || "Owner response could not be saved.");
    } finally {
      setRemarkSaving(false);
    }
  };

  const askEvidence = (value = oracleQuery) => {
    const query = value.trim();
    if (!query) return;
    const terms = [...new Set(query.toLowerCase().match(/[a-z0-9@._-]{3,}/g) || [])]
      .filter((term) => !["the", "and", "for", "with", "from", "show", "find", "what", "which", "about", "evidence", "records"].includes(term));
    const matches = evidenceItems.map((item) => {
      const haystack = [item.title, item.summary, item.description, item.provider, item.evidence_type, item.entity_type, JSON.stringify(item.metadata || {})]
        .filter(Boolean).join(" ").toLowerCase();
      return { item, score: terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0) };
    }).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score).slice(0, 8);
    const eventMatches = own ? records.map((record) => {
      const haystack = [record.stream_type, record.payload?.event, JSON.stringify(record.payload || {})].filter(Boolean).join(" ").toLowerCase();
      return { record, score: terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0) };
    }).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score).slice(0, 8) : [];
    const matchedSources = [...new Set(matches.map(({ item }) => item.provider).filter(Boolean))];
    const answer = {
      query,
      matches: matches.map(({ item }) => item),
      recordMatches: eventMatches.map(({ record }) => record),
      response: matches.length || eventMatches.length
        ? `Found ${matches.length} evidence item${matches.length === 1 ? "" : "s"}${matchedSources.length ? ` from ${matchedSources.join(", ")}` : ""} and ${eventMatches.length} first-party XRC event${eventMatches.length === 1 ? "" : "s"}. These are text matches, not a new verification or a conclusion beyond the stored records.`
        : "No accessible evidence text matched that question. XRD will not infer an answer that is not present in the records.",
      };
      setOracleAnswer(answer);
      setOracleConversation((current) => [...current, { id: `${Date.now()}-${current.length}`, ...answer }]);
      return answer;
  };

  const updateEvidenceVisibility = async (item, visibility) => {
    if (!own || item.profile_id !== targetId || visibilitySaving) return;
    setVisibilitySaving(true);
    setVisibilityError("");
    try {
      const metadata = { ...(item.metadata || {}), visibility };
      const { data, error } = await supabase.from("evidence_items")
        .update({ metadata }).eq("id", item.id).eq("profile_id", targetId).select().single();
      if (error) throw error;
      const updated = data || { ...item, metadata };
      setEvidenceItems((current) => current.map((entry) => entry.id === item.id ? updated : entry));
      setSelectedEvidence(updated);
    } catch (error) {
      setVisibilityError(error?.message || "Visibility could not be saved.");
    } finally {
      setVisibilitySaving(false);
    }
  };

  const recheckEvidenceSource = async (item) => {
    if (!own || sourceChecks[item.id]?.loading) return;
    setSourceChecks((current) => ({ ...current, [item.id]: { loading: true } }));
    try {
      const result = await syncUserConnectorEvidence(targetId, String(item.provider || "").toLowerCase());
      const refreshed = await evidenceService.getEvidenceForProfile(targetId, { limit: 100 });
      const sameProvider = refreshed.filter((candidate) => String(candidate.provider || "").toLowerCase() === String(item.provider || "").toLowerCase());
      const found = sameProvider.find((candidate) => candidate.id === item.id || (item.external_id && candidate.external_id === item.external_id));
      const comparedFields = ["title", "summary", "url", "verified", "external_id", "evidence_type"];
      const changedFields = found ? comparedFields.filter((field) => String(found[field] ?? "") !== String(item[field] ?? "")) : [];
      setEvidenceItems((current) => {
        const firstParty = current.filter((entry) => entry.provider === "Xeevia");
        return [...new Map([...firstParty, ...refreshed].map((entry) => [entry.id, entry])).values()];
      });
      setSourceChecks((current) => ({
        ...current,
        [item.id]: {
          status: found ? (changedFields.length ? "changed" : "matched") : "not-found",
          changedFields,
          checkedAt: new Date().toISOString(),
          evidenceCount: result?.evidenceItems?.length || 0,
        },
      }));
    } catch (error) {
      setSourceChecks((current) => ({ ...current, [item.id]: { error: error?.message || "The source could not be checked." } }));
    }
  };

  const requestEvidenceAccess = async () => {
    if (!viewerId || !targetId || accessRequestBusy) return;
    setAccessRequestBusy(true);
    setAccessNotice("");
    try {
      const { error } = await supabase.from("xrd_access_requests").insert({
        profile_id: targetId,
        requester_id: viewerId,
        message: "Please review whether you can share private evidence with me.",
      });
      if (error) throw error;
      setAccessRequestStatus("pending");
      setAccessNotice("Access request sent to the profile owner.");
    } catch (error) {
      setAccessNotice(error?.message || "Access request could not be sent.");
    } finally {
      setAccessRequestBusy(false);
    }
  };

  const respondToAccessRequest = async (request, approve) => {
    const selected = evidenceItems.filter((item) => item.profile_id === targetId && grantSelections[request.id]?.[item.id]);
    if (approve && !selected.length) return;
    setAccessRequestBusy(true);
    setAccessNotice("");
    try {
      if (approve) {
        const selectedIds = selected.map((item) => item.id);
        const { data: existing, error: existingError } = await supabase.from("xrd_evidence_grants")
          .select("evidence_item_id").eq("viewer_id", request.requester_id).in("evidence_item_id", selectedIds);
        if (existingError) throw existingError;
        const existingIds = new Set((existing || []).map((grant) => grant.evidence_item_id));
        const grants = selected.filter((item) => !existingIds.has(item.id)).map((item) => ({
          profile_id: targetId,
          evidence_item_id: item.id,
          viewer_id: request.requester_id,
          request_id: request.id,
        }));
        if (grants.length) {
          const { error: grantError } = await supabase.from("xrd_evidence_grants").insert(grants);
          if (grantError) throw grantError;
        }
      }
      const { error } = await supabase.from("xrd_access_requests")
        .update({ status: approve ? "approved" : "denied", responded_at: new Date().toISOString() })
        .eq("id", request.id).eq("profile_id", targetId);
      if (error) throw error;
      setAccessRequests((current) => current.filter((item) => item.id !== request.id));
      if (approve) {
        const { data: grants } = await supabase.from("xrd_evidence_grants").select("*").eq("request_id", request.id);
        if (grants) setEvidenceGrants((current) => [...grants, ...current.filter((grant) => !grants.some((next) => next.id === grant.id))]);
      }
      setAccessNotice(approve ? `Access granted to ${selected.length} evidence item${selected.length === 1 ? "" : "s"}.` : "Access request declined.");
    } catch (error) {
      setAccessRequestsError(error?.message || "The access request could not be updated.");
    } finally {
      setAccessRequestBusy(false);
    }
  };

  const revokeEvidenceGrant = async (grant) => {
    setAccessRequestBusy(true);
    setAccessNotice("");
    try {
      const { error } = await supabase.from("xrd_evidence_grants").delete().eq("id", grant.id).eq("profile_id", targetId);
      if (error) throw error;
      setEvidenceGrants((current) => current.filter((item) => item.id !== grant.id));
      setAccessNotice("Evidence access revoked.");
    } catch (error) {
      setAccessRequestsError(error?.message || "Evidence access could not be revoked.");
    } finally {
      setAccessRequestBusy(false);
    }
  };

  useEffect(() => {
    let active = true;
    const itemIds = evidenceItems.map((item) => item?.id).filter(Boolean);
    if (!itemIds.length) {
      setEvidenceEdges([]);
      setEdgesError("");
      return () => { active = false; };
    }
    evidenceService.getEvidenceEdgesForItemIds(itemIds, { limit: 300 })
      .then((edges) => {
        if (active) {
          setEvidenceEdges(edges || []);
          setEdgesError("");
        }
      })
      .catch((error) => {
        if (active) {
          setEvidenceEdges([]);
          setEdgesError(error?.message || "Evidence relationships could not be loaded.");
        }
      });
    return () => { active = false; };
  }, [evidenceItems]);

  const sources = useMemo(() => countBySource(evidenceItems), [evidenceItems]);
  const identityRows = useMemo(() => {
    const rows = new Map();
    sourceConnections.forEach((connection) => {
      const key = String(connection.provider || "unknown").trim().toLowerCase();
      rows.set(key, {
        key,
        provider: connection.provider || "Connected source",
        account: connection.platform_user_id || "Account identifier unavailable",
        connection,
        evidence: [],
      });
    });
    evidenceItems.forEach((item) => {
      const provider = item.provider || "Unknown source";
      const key = String(provider).trim().toLowerCase();
      const existing = rows.get(key) || { key, provider, account: "", connection: null, evidence: [] };
      existing.evidence.push(item);
      if (!existing.account) {
        existing.account = item.metadata?.username || item.metadata?.handle || item.external_id || item.title || "Profile evidence";
      }
      rows.set(key, existing);
    });
    return [...rows.values()].sort((left, right) => {
      if (left.key === "xeevia") return -1;
      if (right.key === "xeevia") return 1;
      return left.provider.localeCompare(right.provider);
    });
  }, [evidenceItems, sourceConnections]);
  const verifiedCount = evidenceItems.filter((item) => item?.verified).length;
  const institutionCount = new Set(evidenceItems
    .filter((item) => ["institution", "organization"].includes(String(
      item?.entity_type || item?.entityType || item?.metadata?.entityType || item?.metadata?.entity_type || "",
    ).toLowerCase()))
    .map((item) => item?.provider || item?.metadata?.institution || item?.title)
    .filter(Boolean)).size;
  const filteredEvidence = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return evidenceItems;
    return evidenceItems.filter((item) =>
      [item.title, item.summary, item.provider, item.evidence_type]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [filter, evidenceItems]);
  const filteredRecords = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return records;
    return records.filter((record) =>
      [record.record_id, record.stream_type, record.payload?.event, JSON.stringify(record.payload || {})]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [filter, records]);
  const evidenceById = useMemo(() => new Map(evidenceItems.filter((item) => item?.id).map((item) => [item.id, item])), [evidenceItems]);
  const photoProfile = useMemo(() => ({ ...profile, authenticatedAvatarCandidates }), [authenticatedAvatarCandidates, profile]);
  const photoSources = useMemo(() => getXrdPhotoSources(photoProfile, evidenceItems, photoConnections), [evidenceItems, photoConnections, photoProfile]);
  const profileAvatarCandidates = useMemo(() => getXrdProfileAvatarCandidates(photoProfile), [photoProfile]);
  const visibleEvidenceEdges = useMemo(() => evidenceEdges.filter((edge) => evidenceById.has(edge.source_id) && evidenceById.has(edge.target_id)), [evidenceById, evidenceEdges]);
  const profileName = profile?.fullName || profile?.username || "Xeevia member";
  const initials = profileName.trim().charAt(0).toUpperCase() || "X";

  const openOracle = () => setOracleOpen(true);
  const loadConnectedProfilePhotos = async (retry = false) => {
    setPhotoHubOpen(true);
    if (!own || photoSyncing || (photoSyncAttempted.current && !retry)) return;
    photoSyncAttempted.current = true;
    setPhotoSyncing(true);
    setPhotoSyncMessage("");
    try {
      const connections = await socialConnectService.getConnections(targetId);
      const supportedProviders = new Set(getRegisteredConnectors()
        .filter((connector) => connector.supportedTypes?.includes("profile") && connector.capabilities?.includes("public-profile"))
        .map((connector) => String(connector.provider).toLowerCase()));
      setPhotoConnections(Object.values(connections || {}));
      const syncableConnections = Object.values(connections || {}).filter((connection) =>
        connection?.auth_status === "active"
        && connection.hasValidToken
        && supportedProviders.has(String(connection.provider || "").toLowerCase()),
      );
      const syncResults = await Promise.allSettled(syncableConnections.map((connection) =>
        syncUserConnectorEvidence(targetId, connection.provider),
      ));
      const refreshedEvidence = await evidenceService.getEvidenceForProfile(targetId, { limit: 100 });
      setEvidenceItems((current) => {
        const nativeItems = current.filter((item) => String(item.provider || "").toLowerCase() === "xeevia");
        return [...new Map([...nativeItems, ...refreshedEvidence].map((item) => [item.id, item])).values()];
      });
      const failedCount = syncResults.filter((result) => result.status === "rejected").length;
      if (failedCount) setPhotoSyncMessage(`${failedCount} connected source${failedCount === 1 ? "" : "s"} could not refresh. Saved profile images are still shown.`);
    } catch (error) {
      setPhotoSyncMessage(error?.message || "Connected profile images could not be refreshed.");
    } finally {
      setPhotoSyncing(false);
    }
  };
  const navigateSection = (nextSection) => {
    if (!nextSection || nextSection === section) return;
    setSelectedEvidence(null);
    setSectionHistory((previous) => [...previous, section]);
    setSection(nextSection);
  };
  const openEvidenceVerification = (item) => {
    setVerificationTargetId(item?.id || null);
    if (section === "Verification") return;
    navigateSection("Verification");
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

  const traceRecord = async (recordId) => {
    setTraceResult((previous) => ({ ...previous, [recordId]: { loading: true } }));
    try {
      const result = await xrcService.traceHistory(recordId);
      setTraceResult((previous) => ({ ...previous, [recordId]: { result } }));
    } catch (error) {
      setTraceResult((previous) => ({ ...previous, [recordId]: { error: error?.message || "Record history could not be traced." } }));
    }
  };

  const visibleIdentityDetails = identityDetails;

  const saveIdentityDetails = async () => {
    if (!own || !targetId) return;
    setIdentitySaving(true);
    setIdentityNotice("");
    try {
      const details = getXrdIdentityDetails(identityDraft);
      const { data, error } = await supabase.from("xrd_identity_details").upsert({
        profile_id: targetId,
        details,
        visibility: identityVisibility,
        updated_at: new Date().toISOString(),
      }, { onConflict: "profile_id" }).select("details,visibility").single();
      if (error) throw error;
      setIdentityDetails(getXrdIdentityDetails(data?.details || details));
      setIdentityVisibility(data?.visibility || identityVisibility);
      setIdentityDetailsExists(true);
      setIdentityNotice("Identity details saved to your XRD.");
    } catch (error) {
      setIdentityNotice(error?.message || "Your identity details could not be saved.");
    } finally {
      setIdentitySaving(false);
    }
  };

  const evidenceCard = (item, index) => (
    <button type="button" className="xrd-record xrd-record-button" key={item.id || `${item.provider}-${item.title}-${index}`} onClick={() => setSelectedEvidence(item)} aria-label={`Open evidence details for ${item.title || item.evidence_type || "Evidence record"}`}>
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
    </button>
  );

  const chainCard = (record) => {
    const audit = auditResult[record.record_id];
    const trace = traceResult[record.record_id];
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
            <div className="xrd-integrity-actions"><button type="button" onClick={() => checkRecord(record.record_id)} disabled={audit?.loading}>{audit?.loading ? "Checking" : "Verify record"}</button><button type="button" onClick={() => traceRecord(record.record_id)} disabled={trace?.loading}>{trace?.loading ? "Tracing" : "Trace history"}</button></div>
          </div>
          {trace?.error && <div className="xrd-error" role="alert">{trace.error}</div>}
          {trace?.result?.chain?.length > 0 && <div className="xrd-trace-list"><div className="xrd-trace-heading">{trace.result.depth} linked record{trace.result.depth === 1 ? "" : "s"}{trace.result.reachedGenesis ? " · chain start reached" : trace.result.brokenLink ? " · parent link missing" : " · trace depth reached"}</div>{trace.result.chain.map((entry) => <div className="xrd-trace-row" key={entry.record_id}><GitBranch size={13} /><span><strong>{entry.payload?.event?.replaceAll("_", " ") || entry.stream_type}</strong><small>{dateLabel(entry.timestamp || entry.created_at)} · {entry.record_id}</small></span><b className={entry._hashValid === true ? "is-valid" : entry._hashValid === false ? "is-invalid" : "is-legacy"}>{entry._hashValid === true ? "Hash verified" : entry._hashValid === false ? "Hash mismatch" : "Legacy hash version"}</b></div>)}</div>}
        </div>
      </article>
    );
  };

  const renderSection = () => {
    if (selectedEvidence) {
      const item = selectedEvidence;
      const relatedEdges = visibleEvidenceEdges.filter((edge) => edge.source_id === item.id || edge.target_id === item.id);
      const safeUrl = (() => {
        try {
          const parsed = new URL(item.url);
          return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : null;
        } catch {
          return null;
        }
      })();
      const metadataKeys = ["proofType", "verificationLevel", "kind", "issuer", "visibility", "evidence_access", "external_id", "record_id", "stream_type"];
      const metadataRows = metadataKeys.filter((key) => item.metadata?.[key] != null).map((key) => [key.replaceAll("_", " "), String(item.metadata[key])]);
      const backToSection = () => setSelectedEvidence(null);
      return (
        <>
          <div className="xrd-page-heading xrd-detail-heading">
            <button type="button" className="xrd-detail-back" onClick={backToSection}><ArrowLeft size={14} /> Back to {section}</button>
            <span className="xrd-kicker">EVIDENCE RECORD</span>
            <h2>{item.title || item.evidence_type || "Evidence record"}</h2>
            <p>{item.summary || item.description || "No source description was provided."}</p>
          </div>
          <div className="xrd-panel xrd-detail-panel">
            <div className="xrd-detail-status"><span className={`xrd-status${item.verified ? " is-verified" : ""}`}>{normalizeStatus(item)}</span><span>{item.provider || "Unknown source"}</span></div>
            <div className="xrd-detail-grid">
              <div><small>Evidence type</small><strong>{item.evidence_type || item.type || "Not supplied"}</strong></div>
              <div><small>Entity type</small><strong>{item.entity_type || item.entityType || "Not supplied"}</strong></div>
              <div><small>Confidence</small><strong>{item.confidence || "Not supplied"}</strong></div>
              <div><small>Captured</small><strong>{dateLabel(item.created_at || item.createdAt)}</strong></div>
              <div><small>Source method</small><strong>{item.source || "Not supplied"}</strong></div>
              <div><small>External reference</small><strong>{item.external_id || item.externalId || "Not supplied"}</strong></div>
            </div>
            {safeUrl && <a className="xrd-detail-link" href={safeUrl} target="_blank" rel="noreferrer">Open source record <ChevronRight size={14} /></a>}
          </div>
          {own && item.profile_id === targetId && <div className="xrd-panel xrd-visibility-control">
            <div className="xrd-section-heading"><div><span className="xrd-kicker">VISIBILITY</span><h3>Who can read this evidence?</h3></div></div>
            {visibilityError && <div className="xrd-error" role="alert">{visibilityError}</div>}
            <label>Evidence visibility
              <select aria-label="Evidence visibility" value={String(item.metadata?.visibility || "PUBLIC").toUpperCase() === "PUBLIC" ? "PUBLIC" : "PRIVATE"} disabled={visibilitySaving} onChange={(event) => updateEvidenceVisibility(item, event.target.value)}>
                <option value="PUBLIC">Public</option><option value="PRIVATE">Private to you</option>
              </select>
            </label>
            <p>Public evidence is readable by signed-in profile visitors only when the source has marked it verified. Private evidence remains visible to you.</p>
          </div>}
          {metadataRows.length > 0 && <div className="xrd-panel"><div className="xrd-section-heading"><div><span className="xrd-kicker">SOURCE METADATA</span><h3>Verification context</h3></div></div><div className="xrd-detail-grid">{metadataRows.map(([label, value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div></div>}
          <div className="xrd-panel">
            <div className="xrd-section-heading"><div><span className="xrd-kicker">PROVENANCE</span><h3>Linked evidence</h3></div><span className="xrd-count">{relatedEdges.length}</span></div>
            {edgesError && <div className="xrd-error" role="alert">{edgesError}</div>}
            {relatedEdges.length ? <div className="xrd-record-list">{relatedEdges.map((edge) => {
              const related = evidenceById.get(edge.source_id === item.id ? edge.target_id : edge.source_id);
              return <button type="button" className="xrd-related-edge" key={edge.id} onClick={() => setSelectedEvidence(related)}><span>{edge.relation.replaceAll("_", " ")}</span><strong>{related.title || related.evidence_type || "Evidence record"}</strong><small>{related.provider || "Unknown source"} · {normalizeStatus(related)}</small><ChevronRight size={14} /></button>;
            })}</div> : <EmptyState text="No stored evidence relationships connect this item to another visible record." />}
          </div>
          <div className="xrd-detail-actions">
            <button type="button" className="xrd-primary" onClick={() => navigateSection("Verification")}>Open verification <ShieldCheck size={14} /></button>
            <button type="button" className="xrd-primary" onClick={() => navigateSection("Graph")}>View in evidence graph <Network size={14} /></button>
            {safeUrl && <button type="button" className="xrd-secondary" onClick={() => window.open(safeUrl, "_blank", "noopener,noreferrer")}>Open source</button>}
          </div>
        </>
      );
    }

    if (section === "Oracle" || section === "XRC Oracle") {
      return (
        <>
          <SectionHeading title="XRC Oracle" subtitle="Search only the evidence and, in owner view, first-party XRC events available in this XRD." />
          <div className="xrd-oracle-card">
            <div className="xrd-oracle-glyph"><Sparkles size={24} /></div>
            <form className="xrd-oracle-search" onSubmit={(event) => { event.preventDefault(); askEvidence(); }}>
              <label htmlFor="xrd-oracle-query">Ask about accessible records</label>
              <div><input id="xrd-oracle-query" value={oracleQuery} onChange={(event) => setOracleQuery(event.target.value)} placeholder="Try “education”, “GitHub”, or “employment”…" /><button type="submit" className="xrd-primary" disabled={!oracleQuery.trim()}><Search size={14} />Search</button></div>
            </form>
            <button type="button" className="xrd-secondary" onClick={() => setOracleChatOpen(true)}><MessageSquareQuote size={14} />Open evidence chat</button>
            <button type="button" className="xrd-secondary" onClick={openOracle}>Open full XRC explorer <ChevronRight size={15} /></button>
          </div>
          <div className="xrd-oracle-suggestions">{["Find education evidence", "Search project evidence", "Find employment evidence", "Search GitHub records"].map((question) => <button type="button" key={question} onClick={() => { setOracleQuery(question); askEvidence(question); }}>{question}<ChevronRight size={13} /></button>)}</div>
          {oracleAnswer && <div className="xrd-panel xrd-oracle-result"><div className="xrd-kicker">MATCHED RECORDS FOR “{oracleAnswer.query}”</div><p>{oracleAnswer.response}</p>
            {oracleAnswer.matches.map((item) => <button type="button" className="xrd-record xrd-record-button" key={item.id} onClick={() => setSelectedEvidence(item)}><FileText size={15} /><span>{item.title || item.evidence_type || "Evidence record"} · {item.provider || "Unknown source"}</span><span className="xrd-status">{normalizeStatus(item)}</span></button>)}
            {oracleAnswer.recordMatches.map((record) => <button type="button" className="xrd-record xrd-record-button" key={record.record_id} onClick={() => navigateSection("Chains")}><GitBranch size={15} /><span>{record.payload?.event?.replaceAll("_", " ") || record.stream_type} · {record.record_id}</span><span className="xrd-status">XRC event</span></button>)}
          </div>}
        </>
      );
    }

    if (section === "Overview") {
      const attentionItems = evidenceItems.filter((item) =>
        /expired|mismatch|revoked|failed|disputed|contested|pending/i.test(normalizeStatus(item)),
      );
      const questions = [
        ["WHO?", "Identity and connected accounts", "Identity", Fingerprint],
        ["WHAT?", "Records and evidence", "Records", FileText],
        ["WHEN?", own ? `${records.length} first-party events` : "Evidence timeline when available", own ? "Activity" : "Records", Activity],
        ["WHERE FROM?", `${sources.length} represented sources`, "Graph", Network],
        ["WHO CAN ATTEST?", "Verification and provenance", "Verification", ShieldCheck],
        ["WHAT EVIDENCE?", `${evidenceItems.length} evidence items`, "Evidence", FileCheck2],
        ["IS IT VERIFIED?", `${verifiedCount} verified records`, "Verification", CheckCircle2],
        ["CAN IT BE TRACED?", own ? "Follow available record chains" : "Trace available evidence relationships", own ? "Chains" : "Graph", GitBranch],
      ];
      return (
        <>
          <div className="xrd-overview-hero xrd-prototype-overview">
            <div className="xrd-overview-visual">
              <div className="xrd-hero-avatar">
                <XrdProfileAvatar key={`${targetId}:${profileAvatarCandidates.join("|")}`} candidates={profileAvatarCandidates} initials={initials} />
                <button type="button" className="xrd-photo-trigger" aria-label={`View ${photoSources.length} connected profile photos`} onClick={() => loadConnectedProfilePhotos()}><Images size={14} /><b>{photoSources.length}</b></button>
              </div>
              <div className="xrd-overview-meter" role="img" aria-label={`${verifiedCount} of ${evidenceItems.length} records verified`}>
                <svg viewBox="0 0 130 130" aria-hidden="true">
                  <circle cx="65" cy="65" r="56" />
                  <circle className="xrd-meter-value" cx="65" cy="65" r="56" style={{ strokeDasharray: `${Math.round((verifiedCount / Math.max(evidenceItems.length, 1)) * 352)} 352` }} />
                  <text x="65" y="62">{Math.round((verifiedCount / Math.max(evidenceItems.length, 1)) * 100)}%</text>
                  <text className="xrd-meter-label" x="65" y="82">VERIFIED</text>
                </svg>
              </div>
            </div>
            <div className="xrd-hero-identity">
              <span className="xrd-kicker">XEEVIA RECORD · {own ? "OWNER VIEW" : "PUBLIC VIEW"}</span>
              <h2>{profileName}</h2>
              <p>@{profile?.username || "unknown"}</p>
              <p className="xrd-prototype-copy">A transparent view of identity evidence, provenance, and record integrity. Only available data is shown; an empty section means no records were returned.</p>
              <div className="xrd-overview-actions">
                <button type="button" className="xrd-primary" onClick={() => navigateSection("Records")}>Browse records <ChevronRight size={14} /></button>
                <button type="button" className="xrd-secondary" onClick={() => navigateSection("Oracle")}><Sparkles size={14} />Ask XRC Oracle</button>
              </div>
            </div>
          </div>
          {photoHubOpen && <div className="xrd-photo-modal" role="presentation" onClick={() => setPhotoHubOpen(false)}><section role="dialog" aria-modal="true" aria-label="Profile images across platforms" onClick={(event) => event.stopPropagation()}>
            <header><div><span className="xrd-kicker">IDENTITY MEDIA</span><h2>Profile images</h2><p>Photos from profile and connected-source evidence.</p></div><button type="button" aria-label="Close profile images" onClick={() => setPhotoHubOpen(false)}><X size={18} /></button></header>
            <style>{`.xrd-photo-loading,.xrd-photo-notice{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 12px;padding:10px 12px;border:1px solid rgba(163,230,53,.2);border-radius:10px;background:rgba(163,230,53,.05);color:#b6c0ae;font-size:11px;line-height:1.45}.xrd-photo-notice{border-color:rgba(251,191,36,.25);background:rgba(251,191,36,.06)}.xrd-photo-notice button{flex:none;padding:6px 10px;border:1px solid rgba(163,230,53,.3);border-radius:7px;background:rgba(163,230,53,.08);color:#c7f58d;font-size:10px;cursor:pointer}.xrd-photo-fallback{width:100%;height:100%;display:grid;place-items:center;background:radial-gradient(circle at 30% 20%,rgba(163,230,53,.16),transparent 56%),#101410;color:#a3e635;font-size:30px;font-weight:800}`}</style>
            {photoSyncing && <div className="xrd-photo-loading" role="status">Refreshing profile images from connected sources…</div>}
            {photoSyncMessage && <div className="xrd-photo-notice" role="status">{photoSyncMessage}{own && !photoSyncing && <button type="button" onClick={() => loadConnectedProfilePhotos(true)}>Retry</button>}</div>}
            {photoSources.length ? <div className="xrd-photo-grid">{photoSources.map((source) => <article key={source.id}>
              <div className="xrd-photo-frame"><XrdPhotoImage source={source} />{source.verified && <span><BadgeCheck size={15} />Verified source</span>}</div>
              <strong>{source.name}</strong><small>{source.handle}</small>
            </article>)}</div> : <EmptyState text="No profile photos were returned by connected sources." />}
          </section></div>}
          <div className="xrd-stats">
            {[
              [evidenceItems.length, "Records", FileCheck2],
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
              : <EmptyState text={evidenceItems.length ? "No available evidence is currently marked as disputed, pending, expired, or failed." : "Evidence status will appear here as records are connected."} />}
          </div>
          <div className="xrd-section-heading"><div><span className="xrd-kicker">LATEST PROOF</span><h3>Evidence overview</h3></div><button type="button" onClick={() => navigateSection("Records")}>All records <ChevronRight size={14} /></button></div>
          {evidenceItems.length
            ? <div className="xrd-record-list">{evidenceItems.slice(0, 4).map(evidenceCard)}</div>
            : <EmptyState text="No evidence records are available for this profile yet." />}
        </>
      );
    }

    if (section === "Identity") {
      const identityItems = filteredEvidence.filter((item) =>
        ["person", "identity"].includes(String(item?.entity_type || item?.entityType || item?.metadata?.entityType || "").toLowerCase())
        || ["profile", "identity"].includes(String(item?.evidence_type || item?.type || "").toLowerCase()),
      );
      const selfProof = identityItems.some((item) => String(item.provider || "").toLowerCase() === "self" && item.verified);
      const sourceVerified = identityItems.some((item) => item.verified && item.source !== "first_party");
      const customIdentity = visibleIdentityDetails;
      const identityFields = [
        { key: "headline", label: "Headline", placeholder: "Product designer · community builder" },
        { key: "location", label: "Location", placeholder: "Paris, FR / Remote" },
        { key: "pronouns", label: "Pronouns", placeholder: "she/her, he/him, they/them" },
        { key: "website", label: "Website", placeholder: "https://example.com" },
        { key: "availability", label: "Availability", placeholder: "Open to collaborations / not currently available" },
      ];
      return (
        <>
          <SectionHeading title="Identity" subtitle="Profile identity details and first-party verification evidence." />
          <style>{`.xrd-identity-editor .xrd-section-heading{margin-top:0}.xrd-identity-ownership-note{display:flex;align-items:flex-start;gap:8px;margin:0 0 14px;padding:10px 11px;border:1px solid rgba(96,165,250,.25);border-radius:9px;background:rgba(96,165,250,.055);color:#aab8ca;font-size:10px;line-height:1.45}.xrd-identity-ownership-note svg{flex:none;color:#60a5fa}.xrd-identity-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.xrd-identity-field{display:flex;min-width:0;flex-direction:column;gap:5px;color:#aab3a5;font-size:10px;font-weight:700}.xrd-identity-field-wide{grid-column:1/-1}.xrd-identity-field input,.xrd-identity-field textarea,.xrd-identity-visibility select{width:100%;min-width:0;padding:9px 10px;border:1px solid var(--xrd-border);border-radius:8px;background:#050705;color:#e5ecdf;font:inherit;font-size:11px}.xrd-identity-field textarea{resize:vertical;line-height:1.5}.xrd-identity-field input:focus,.xrd-identity-field textarea:focus,.xrd-identity-visibility select:focus{outline:1px solid var(--xrd-ac);border-color:var(--xrd-ac)}.xrd-identity-visibility{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;color:#dce5d7;font-size:11px;font-weight:700}.xrd-identity-visibility select{width:auto;min-width:180px}.xrd-identity-privacy-note{margin:8px 0 0;color:#829080;font-size:10px;line-height:1.45}.xrd-identity-details-list{display:grid;gap:8px}.xrd-identity-details-list>div{display:grid;grid-template-columns:minmax(90px,.35fr) minmax(0,1fr);gap:10px;padding:8px 0;border-bottom:1px solid #1c211b}.xrd-identity-details-list>div:last-child{border-bottom:0}.xrd-identity-details-list small{color:#7d887a;font-size:10px}.xrd-identity-details-list strong{color:#e0e8dc;font-size:11px;font-weight:500;overflow-wrap:anywhere}.xrd-status-connected{border-color:rgba(96,165,250,.35);background:rgba(96,165,250,.08);color:#93c5fd}.xrd-status-pending{border-color:rgba(251,191,36,.35);background:rgba(251,191,36,.07);color:#fbbf24}.xrd-status-disconnected{border-color:rgba(248,113,113,.35);background:rgba(248,113,113,.07);color:#fca5a5}.xrd-status-source{border-color:rgba(163,230,53,.28);background:rgba(163,230,53,.06);color:#c3e89a}.xrd-status-tracked{border-color:#343b30;background:#070907;color:#a4ae9e}.xrd-status-neutral{border-color:#30352d;background:#060806;color:#818a7c}@media(max-width:650px){.xrd-identity-form-grid{grid-template-columns:minmax(0,1fr)}.xrd-identity-field-wide{grid-column:auto}.xrd-identity-visibility{align-items:flex-start;flex-direction:column}.xrd-identity-visibility select{width:100%}.xrd-identity-details-list>div{grid-template-columns:minmax(0,1fr);gap:3px}}`}</style>
          <div className="xrd-identity-panel">
            <div className="xrd-identity-avatar"><XrdProfileAvatar key={`${targetId}:${profileAvatarCandidates.join("|")}`} candidates={profileAvatarCandidates} initials={initials} /></div>
            <div className="xrd-identity-copy"><h3>{profileName} {profile?.verified && <BadgeCheck size={16} />}</h3><p>@{profile?.username || "unknown"}</p>{(customIdentity.bio || profile?.bio) && <p className="xrd-bio">{customIdentity.bio || profile.bio}</p>}<span>Member since {profile?.joinDate || "date unavailable"}</span></div>
          </div>
          {own && <div className="xrd-panel xrd-identity-editor">
            <div className="xrd-section-heading"><div><span className="xrd-kicker">YOUR IDENTITY</span><h3>Add or edit what you want people to see</h3></div></div>
            <div className="xrd-identity-ownership-note"><ShieldCheck size={14} /><span>These details are self-authored profile information. Adding them does not verify a claim.</span></div>
            <div className="xrd-identity-form-grid">
              {identityFields.map((field) => <label key={field.key} className="xrd-identity-field"><span>{field.label}</span><input value={identityDraft[field.key] || ""} onChange={(event) => setIdentityDraft((current) => ({ ...current, [field.key]: event.target.value }))} placeholder={field.placeholder} /></label>)}
              <label className="xrd-identity-field xrd-identity-field-wide"><span>Short bio</span><textarea value={identityDraft.bio || ""} onChange={(event) => setIdentityDraft((current) => ({ ...current, bio: event.target.value }))} placeholder="Tell people who you are, what you build, and what you care about." rows={4} /></label>
              <label className="xrd-identity-field xrd-identity-field-wide"><span>Owner note</span><textarea value={identityDraft.note || ""} onChange={(event) => setIdentityDraft((current) => ({ ...current, note: event.target.value }))} placeholder="Optional note for viewers, such as your trust profile, mission, or availability." rows={3} /></label>
            </div>
            <label className="xrd-identity-visibility"><span>Who can see these details?</span><select value={identityVisibility} onChange={(event) => setIdentityVisibility(event.target.value)}><option value="private">Only me</option><option value="public">Everyone viewing my XRD</option></select></label>
            {identityVisibility === "public" && <p className="xrd-identity-privacy-note">Your headline, bio, location, pronouns, website, availability, and owner note will be visible to signed-in XRD viewers.</p>}
            {identityNotice && <div className="xrd-inline-success" role="status">{identityNotice}</div>}
            <div className="xrd-detail-actions">
              <button type="button" className="xrd-primary" disabled={identitySaving} onClick={saveIdentityDetails}>{identitySaving ? "Saving…" : "Save identity details"}</button>
            </div>
          </div>}
          {!own && identityLoading && <div className="xrd-loading"><span />Loading public identity details…</div>}
          {!own && identityDetailsExists && identityVisibility === "public" && (customIdentity.headline || customIdentity.bio || customIdentity.location || customIdentity.note || customIdentity.website || customIdentity.availability || customIdentity.pronouns) && <div className="xrd-panel">
            <div className="xrd-section-heading"><div><span className="xrd-kicker">PUBLIC PROFILE</span><h3>Owner-supplied identity details</h3></div><span className="xrd-status">Self-authored</span></div>
            <p className="xrd-identity-privacy-note">These details were supplied by the profile owner; they are not independently verified.</p>
            <div className="xrd-identity-details-list">
              {customIdentity.headline && <div><small>Headline</small><strong>{customIdentity.headline}</strong></div>}
              {customIdentity.bio && <div><small>Bio</small><strong>{customIdentity.bio}</strong></div>}
              {customIdentity.location && <div><small>Location</small><strong>{customIdentity.location}</strong></div>}
              {customIdentity.pronouns && <div><small>Pronouns</small><strong>{customIdentity.pronouns}</strong></div>}
              {customIdentity.website && <div><small>Website</small><strong>{customIdentity.website}</strong></div>}
              {customIdentity.availability && <div><small>Availability</small><strong>{customIdentity.availability}</strong></div>}
              {customIdentity.note && <div><small>Owner note</small><strong>{customIdentity.note}</strong></div>}
            </div>
          </div>}
          <div className="xrd-assurance-panel">
            <div className="xrd-kicker">IDENTITY ASSURANCE · EACH LAYER IS SEPARATE</div>
            <div className="xrd-assurance-steps">
              <div className="is-present"><b>01</b><strong>Profile identity</strong><small>Profile record available</small></div>
              <div className={sourceConnections.length || identityItems.some((item) => item.metadata?.proofType === "social") ? "is-present" : ""}><b>02</b><strong>Account control</strong><small>{sourceConnections.length || identityItems.filter((item) => item.metadata?.proofType === "social").length} linked accounts</small></div>
              <div className={sourceVerified ? "is-present" : ""}><b>03</b><strong>Source evidence</strong><small>{sourceVerified ? "Source-reported verified record" : "No verified external source record"}</small></div>
              <div className={selfProof ? "is-present" : "is-unavailable"}><b>04</b><strong>Personhood</strong><small>{selfProof ? "Self proof stored" : "No personhood proof stored"}</small></div>
            </div>
            <p>Connecting an account proves control of that account only. It does not verify the person's identity or their claims.</p>
          </div>
          <div className="xrd-panel">
            <div className="xrd-section-heading"><div><span className="xrd-kicker">IDENTITY BINDINGS</span><h3>Connected accounts and evidence</h3></div><span className="xrd-count">{identityRows.length}</span></div>
            <p className="xrd-identity-intro">Each account is linked to this profile. Evidence and verification status are shown separately from account ownership.</p>
            {sourceLoading && own && <div className="xrd-loading"><span />Loading account bindings…</div>}
            {identityRows.length > 0 && <div className="xrd-identity-sources">
              {identityRows.map((row) => {
                const state = getXrdIdentityRowStatus(row);
                return <article className="xrd-identity-source" key={row.key}>
                  <span className="xrd-source-glyph"><Fingerprint size={16} /></span>
                  <div className="xrd-identity-source-copy">
                    <strong>{row.provider} account</strong>
                    <small>{row.account}</small>
                    <span>{row.connection ? `${row.evidence.length} profile evidence item${row.evidence.length === 1 ? "" : "s"}` : "Evidence source · not an account connection"}</span>
                  </div>
                  <span className={`xrd-status xrd-status-${state.tone}`}>{state.label}</span>
                </article>;
              })}
            </div>}
            {!identityRows.length && !sourceLoading && <EmptyState text="No connected accounts or identity evidence are available." />}
          </div>
          <div className="xrd-section-heading"><div><span className="xrd-kicker">RELATED RECORDS</span><h3>Identity evidence</h3></div></div>
          {filteredEvidence.filter((item) => ["profile", "identity", "verification"].includes(String(item?.evidence_type || item?.type || "").toLowerCase())).map(evidenceCard)}
          {!evidenceItems.some((item) => ["profile", "identity", "verification"].includes(String(item?.evidence_type || item?.type || "").toLowerCase())) && <EmptyState text="No separate identity evidence has been added." />}
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
          {accessNotice && <div className="xrd-inline-success" role="status">{accessNotice}</div>}
          {!own && viewerId && <div className="xrd-panel xrd-access-request">
            <div><span className="xrd-kicker">RESTRICTED EVIDENCE</span><h3>Need more context?</h3><p>Ask the owner to share specific evidence. They choose exactly which records you can read.</p></div>
            {accessRequestStatus === "pending" ? <span className="xrd-access-state">Request pending</span> : accessRequestStatus === "approved" ? <span className="xrd-access-state is-approved">Access granted · reopen profile to refresh</span> : <button type="button" disabled={accessRequestBusy} onClick={requestEvidenceAccess}>{accessRequestBusy ? "Sending…" : "Request access"}</button>}
          </div>}
        </>
      );
    }

    if (section === "Graph") {
      return (
        <>
          <SectionHeading title="Evidence graph" subtitle="Follow the profile, linked accounts, source evidence, stored relationships, and first-party XRC hash chain. Each connection is labeled by what it actually establishes." />
          {edgesError && <div className="xrd-error" role="alert">{edgesError}</div>}
          {evidenceItems.length ? <XrdEvidenceGraph items={evidenceItems} edges={visibleEvidenceEdges} profile={profile} connections={own ? sourceConnections : []} records={own ? records : []} auditResult={auditResult} traceResult={traceResult} onPick={setSelectedEvidence} onOpenVerification={openEvidenceVerification} onOpenChain={(recordId) => { setFilter(recordId); navigateSection("Chains"); }} onVerifyRecord={checkRecord} onTraceRecord={traceRecord} onOpenIdentity={() => navigateSection("Identity")} /> : <EmptyState text="The graph will appear when evidence sources are connected." />}
        </>
      );
    }

    if (section === "Audit") {
      if (!own) return <RestrictedState />;
      return (
        <>
          <SectionHeading title="Audit" subtitle="Account security events recorded for this profile. XRC content history is shown separately under Activity." />
          {securityEventsError && <div className="xrd-error" role="alert">{securityEventsError}</div>}
          {securityEventsLoading ? <div className="xrd-loading"><span />Loading security events…</div>
            : securityEvents.length ? <div className="xrd-record-list">{securityEvents.map((event) => <article className="xrd-record xrd-audit-event" key={event.id}>
              <div className="xrd-record-mark"><Shield size={16} /></div><div className="xrd-record-body">
                <button type="button" className="xrd-audit-toggle" aria-expanded={expandedAuditEvent === event.id} onClick={() => setExpandedAuditEvent((current) => current === event.id ? null : event.id)}>
                  <span><strong>{String(event.event_type || "Security event").replaceAll("_", " ")}</strong><small>{dateLabel(event.created_at)} · {event.severity || "info"}</small></span><ChevronRight size={15} />
                </button>
                {expandedAuditEvent === event.id && <div className="xrd-audit-detail"><p>{event.metadata?.description || event.metadata?.reason || "Security event recorded by Xeevia."}</p>{event.metadata && Object.keys(event.metadata).length > 0 && <dl>{Object.entries(event.metadata).map(([key, value]) => <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{typeof value === "string" ? value : JSON.stringify(value)}</dd></div>)}</dl>}</div>}
              </div>
            </article>)}</div> : <EmptyState text="No security audit events are recorded for this account." />}
        </>
      );
    }

    if (section === "Chains" || section === "Activity") {
      if (!own) return <RestrictedState />;
      return (
        <>
          <SectionHeading title={section === "Chains" ? "XRC chains" : "Activity"} subtitle={section === "Chains" ? "Trace first-party XRC records, verify their hashes, and inspect ancestors." : "First-party XRC events, separate from security audit events."} />
          <SearchBox value={filter} onChange={setFilter} placeholder="Filter events, streams, and record IDs" />
          {recordsError && <div className="xrd-error" role="alert">{recordsError}<button type="button" onClick={loadRecords}>Retry</button></div>}
          {recordsLoading ? <div className="xrd-loading"><span />Loading your XRC history…</div>
            : filteredRecords.length ? <div className="xrd-record-list">{filteredRecords.map(chainCard)}</div>
              : !recordsError && <EmptyState text="There are no XRC events available for this profile yet." />}
        </>
      );
    }

    if (section === "Sources") {
      const sourceRows = new Map([["xeevia", "Xeevia"], ...SOURCE_PLATFORMS]);
      sourceConnections.forEach((connection) => {
        if (!sourceRows.has(connection.provider)) sourceRows.set(connection.provider, connection.provider);
      });
      sources.forEach(([source]) => {
        const provider = source.toLowerCase();
        if (!sourceRows.has(provider)) sourceRows.set(provider, source);
      });
      return (
        <>
          <SectionHeading title="Sources" subtitle={own ? "Manage connected accounts and synchronize their evidence." : "Evidence providers represented in the records visible to you."} />
          {sourceNotice && <div className="xrd-notice" role="status">{sourceNotice}</div>}
          {sourceLoading && own && <div className="xrd-loading"><span />Loading connected accounts…</div>}
          <div className="xrd-source-list">{[...sourceRows.entries()].map(([provider, label]) => {
            const connection = sourceConnections.find((entry) => entry.provider === provider);
            const active = connection?.auth_status === "active";
            const count = evidenceItems.filter((item) => String(item.provider || "").toLowerCase() === provider).length;
            const nativeProfile = provider === "xeevia";
            if (!own && count === 0 && !nativeProfile) return null;
            const canConnect = SOURCE_PLATFORMS.some(([configuredProvider]) => configuredProvider === provider);
            return (
              <article className="xrd-source" key={provider}>
                <span><Database size={17} /></span>
                <div><strong>{label}</strong><small>{nativeProfile ? `${profile?.username ? `@${profile.username}` : "Native profile"} · ${count} evidence item${count === 1 ? "" : "s"}` : own ? `${connection?.platform_user_id || "Not connected"} · ${count} evidence item${count === 1 ? "" : "s"}` : `${count} evidence item${count === 1 ? "" : "s"}`}</small></div>
                {own && <div className="xrd-source-actions">
                  {nativeProfile ? <span className="xrd-status is-verified">Native</span> : active ? <>
                    <span className="xrd-status is-verified">Connected</span>
                    <button type="button" disabled={sourceBusy === provider} onClick={() => syncSource(provider)}>{sourceBusy === provider ? "Working…" : "Sync"}</button>
                    <button type="button" disabled={sourceBusy === provider} onClick={() => disconnectSource(provider)}>Disconnect</button>
                  </> : canConnect && <button type="button" disabled={sourceBusy === provider} onClick={() => connectSource(provider)}>{sourceBusy === provider ? "Connecting…" : "Connect"}</button>}
                </div>}
              </article>
            );
          })}</div>
          {own && <div className="xrd-notice"><LockKeyhole size={16} /><span>OAuth tokens stay in the existing connection service. Disconnecting revokes future use and preserves evidence already collected.</span></div>}
          {!own && !sources.length && <EmptyState text="No evidence sources are visible on this profile." />}
        </>
      );
    }

    if (section === "Remarks") {
      return (
        <>
          <SectionHeading title="Remarks" subtitle="Record-linked context from Xeevia members. Remarks are statements, not source verification or professional authority." />
          <div className="xrd-notice"><MessageSquareQuote size={16} /><span>Each remark is tied to one visible evidence record. The profile owner can respond; neither a remark nor a response changes the record’s verification status.</span></div>
          {remarksNotice && <div className="xrd-inline-success" role="status">{remarksNotice}</div>}
          {remarksError && <div className="xrd-error" role="alert">{remarksError}</div>}
          {!own && viewerId && <div className="xrd-panel xrd-remark-compose">
            <div className="xrd-section-heading"><div><span className="xrd-kicker">ADD A REMARK</span><h3>What should readers know?</h3></div></div>
            <label className="xrd-remark-label">Evidence record
              <select value={remarkEvidenceId} onChange={(event) => setRemarkEvidenceId(event.target.value)}>
                <option value="">Choose a visible record</option>
                {evidenceItems.map((item) => <option key={item.id} value={item.id}>{item.title || item.evidence_type || "Evidence record"}</option>)}
              </select>
            </label>
            <label className="xrd-remark-label">Remark type
              <select value={remarkType} onChange={(event) => setRemarkType(event.target.value)}>
                {["CONTEXT", "CONFIRM", "CORRECTION", "DISPUTE", "RECOGNITION"].map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <label className="xrd-remark-label">Statement
              <textarea maxLength={3000} rows={4} value={remarkBody} onChange={(event) => setRemarkBody(event.target.value)} placeholder="Add relevant context, correction, or recognition." />
            </label>
            <div className="xrd-remark-submit"><small>{remarkBody.trim().length}/3000 · Minimum 5 characters</small><button type="button" className="xrd-primary" disabled={remarkSaving || !remarkEvidenceId || remarkBody.trim().length < 5} onClick={publishRemark}><Send size={14} />{remarkSaving ? "Publishing…" : "Publish remark"}</button></div>
          </div>}
          {!own && !viewerId && <div className="xrd-notice"><LockKeyhole size={16} /><span>Sign in to publish a remark.</span></div>}
          {remarksLoading && <div className="xrd-loading"><span />Loading remarks…</div>}
          {!remarksLoading && remarks.map((remark) => <article className="xrd-remark" key={remark.id}>
            <div className="xrd-remark-head"><span className="xrd-remark-type">{remark.remark_type}</span><span><Clock size={12} />{dateLabel(remark.created_at)}</span></div>
            <p>{remark.body}</p>
            <div className="xrd-remark-meta">{remark.author_id === viewerId ? "You" : `Member ${String(remark.author_id).slice(0, 8)}`} · regarding <button type="button" onClick={() => { const item = evidenceById.get(remark.evidence_item_id); if (item) setSelectedEvidence(item); }}>{remark.record_title}</button></div>
            {remark.owner_response && <div className="xrd-owner-response"><small>PROFILE OWNER RESPONSE</small><p>{remark.owner_response}</p>{remark.owner_response_at && <time>{dateLabel(remark.owner_response_at)}</time>}</div>}
            {!remark.owner_response && own && <div className="xrd-remark-reply"><textarea rows={2} maxLength={1500} value={remarkResponses[remark.id] || ""} onChange={(event) => setRemarkResponses((current) => ({ ...current, [remark.id]: event.target.value }))} placeholder="Respond as the profile owner" /><button type="button" disabled={remarkSaving || !(remarkResponses[remark.id] || "").trim()} onClick={() => saveRemarkResponse(remark)}>{remarkSaving ? "Saving…" : "Save response"}</button></div>}
          </article>)}
          {!remarksLoading && !remarks.length && !remarksError && <EmptyState text="No remarks have been published for this profile yet." />}
        </>
      );
    }

    if (section === "Projects" || section === "Credentials" || section === "Achievements") {
      const match = section === "Projects"
        ? (item) => item?.metadata?.kind === "project" || item?.evidence_type === "portfolio"
        : section === "Credentials"
          ? (item) => item?.evidence_type === "credential" || item?.metadata?.kind === "credential"
          : section === "Achievements"
            ? (item) => item?.metadata?.kind === "achievement" || item?.evidence_type === "achievement"
            : (item) => item?.metadata?.kind === "achievement" || item?.evidence_type === "achievement";
      const items = filteredEvidence.filter(match);
      return (
        <>
          <SectionHeading title={section} subtitle={{
            Projects: "Project and portfolio evidence supplied by connected sources.",
            Credentials: "Credential evidence supplied by connected issuers.",
            Achievements: "Achievement records that have been added to this profile's evidence.",
          }[section]} />
          {items.length ? <div className="xrd-record-list">{items.map(evidenceCard)}</div> : <EmptyState text={`No ${section.toLowerCase()} evidence is available yet.`} />}
        </>
      );
    }

    if (section === "Verification") {
      const verificationItems = filteredEvidence.toSorted
        ? [...filteredEvidence].sort((left, right) => Number(right.id === verificationTargetId) - Number(left.id === verificationTargetId))
        : filteredEvidence;
      return (
        <>
          <SectionHeading title="Verification" subtitle="Review source-reported status and, as owner, recheck connected profile evidence." />
          <div className="xrd-notice"><ShieldCheck size={16} /><span>A successful source recheck confirms that the connector responded and returned this identity record. It does not independently verify education, employment, or issuer authority.</span></div>
          {verificationItems.length ? <div className="xrd-record-list">{verificationItems.map((item, index) => <div className={`xrd-verification-item${item.id === verificationTargetId ? " is-focused" : ""}`} key={item.id || `${item.provider}-${index}`}>
            {evidenceCard(item, index)}
            {own && item.connection_id && <div className="xrd-source-check">
              <button type="button" disabled={sourceChecks[item.id]?.loading} onClick={() => recheckEvidenceSource(item)}>{sourceChecks[item.id]?.loading ? "Checking source…" : "Recheck source"}</button>
              {sourceChecks[item.id]?.status === "matched" && <span className="is-match">Source returned a record with no changes to the compared fields · {dateLabel(sourceChecks[item.id].checkedAt)}.</span>}
              {sourceChecks[item.id]?.status === "changed" && <span className="is-warning">Source returned changed fields: {sourceChecks[item.id].changedFields.join(", ")}.</span>}
              {sourceChecks[item.id]?.status === "not-found" && <span className="is-warning">Source responded, but the same evidence item was not returned.</span>}
              {sourceChecks[item.id]?.error && <span className="is-warning">{sourceChecks[item.id].error}</span>}
            </div>}
          </div>)}</div> : <EmptyState text="No verification records are available yet." />}
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
            {accessNotice && <div className="xrd-inline-success" role="status">{accessNotice}</div>}
            {accessRequestsError && <div className="xrd-error" role="alert">{accessRequestsError}</div>}
            {(accessRequestsLoading || accessRequests.length > 0) && <div className="xrd-panel xrd-access-queue">
              <div className="xrd-section-heading"><div><span className="xrd-kicker">PRIVATE EVIDENCE</span><h3>Access requests</h3></div><span className="xrd-count">{accessRequests.length}</span></div>
              {accessRequestsLoading && <div className="xrd-loading"><span />Loading requests…</div>}
              {!accessRequestsLoading && accessRequests.map((request) => {
                const privateItems = evidenceItems.filter((item) => item.profile_id === targetId && (String(item.metadata?.visibility || "PUBLIC").toUpperCase() !== "PUBLIC" || !item.verified));
                const selectedCount = Object.values(grantSelections[request.id] || {}).filter(Boolean).length;
                return <article className="xrd-access-request-row" key={request.id}>
                  <div className="xrd-access-request-header"><div><strong>Member {String(request.requester_id).slice(0, 8)}</strong><small>{dateLabel(request.created_at)} · {request.message}</small></div><span className="xrd-status">Pending</span></div>
                  <div className="xrd-access-options">{privateItems.map((item) => <label key={item.id}><input type="checkbox" checked={Boolean(grantSelections[request.id]?.[item.id])} onChange={(event) => setGrantSelections((current) => ({ ...current, [request.id]: { ...(current[request.id] || {}), [item.id]: event.target.checked } }))} /><span>{item.title || item.evidence_type || "Evidence record"}</span></label>)}</div>
                  {!privateItems.length && <p className="xrd-access-empty">No private evidence items are available to grant.</p>}
                  <div className="xrd-access-actions"><button type="button" disabled={accessRequestBusy || selectedCount === 0} onClick={() => respondToAccessRequest(request, true)}>Grant {selectedCount || "selected"} item{selectedCount === 1 ? "" : "s"}</button><button type="button" className="is-secondary" disabled={accessRequestBusy} onClick={() => respondToAccessRequest(request, false)}>Decline</button></div>
                </article>;
              })}
            </div>}
            {evidenceGrants.length > 0 && <div className="xrd-panel xrd-grants-panel">
              <div className="xrd-section-heading"><div><span className="xrd-kicker">ACTIVE SHARES</span><h3>Granted private evidence</h3></div><span className="xrd-count">{evidenceGrants.length}</span></div>
              {evidenceGrants.map((grant) => {
                const evidence = evidenceById.get(grant.evidence_item_id);
                return <div className="xrd-grant-row" key={grant.id}><div><strong>{evidence?.title || evidence?.evidence_type || grant.evidence_item_id}</strong><small>Shared with member {String(grant.viewer_id).slice(0, 8)} · {dateLabel(grant.created_at)}</small></div><button type="button" disabled={accessRequestBusy} onClick={() => revokeEvidenceGrant(grant)}>Revoke</button></div>;
              })}
            </div>}
          {permissionsDimension === "Authority" && <div className="xrd-notice"><LockKeyhole size={16} /><span>Only authority explicitly supplied by a record source is shown. Xeevia does not infer who may attest to a claim.</span></div>}
          {evidenceItems.length ? <div className="xrd-permission-list">
            {evidenceItems.map((item, index) => (
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
            {settingsLoading && <div className="xrd-loading"><span />Loading saved preferences…</div>}
            {settingsError && <div className="xrd-error" role="alert">{settingsError}</div>}
            {SETTING_GROUPS[settingsGroup].map((setting) => (
              <div className="xrd-setting-row" key={setting}>
                {(() => {
                  const key = `${settingsGroup}:${setting}`;
                  const enabled = userPreferences.xrd_settings?.[key] !== false;
                  return <>
                <span>{setting}</span>
                <span className="xrd-setting-state">{settingsBusy === key ? "Saving…" : enabled ? "On" : "Off"}</span>
                <button type="button" role="switch" aria-checked={enabled} aria-label={setting} disabled={settingsLoading || settingsBusy === key} onClick={() => toggleXrdSetting(setting)} className={enabled ? "active" : ""}><i /></button>
                  </>;
                })()}
              </div>
            ))}
            <div className="xrd-notice"><LockKeyhole size={16} /><span>Preferences are saved to your profile. Access enforcement remains governed by database policies; a presentation toggle cannot override those policies.</span></div>
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
        .xrd-root{--xrd-ac:#a3e635;--xrd-panel:#080b08;--xrd-border:#252a24;position:fixed;inset:0;z-index:100050;display:grid;grid-template-columns:248px minmax(0,1fr);overflow:hidden;background:#030403;color:#eef2ea;font-family:inherit;isolation:isolate}
        .xrd-root::before{position:absolute;z-index:-1;inset:0;content:"";pointer-events:none;background-image:linear-gradient(rgba(163,230,53,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(163,230,53,.025) 1px,transparent 1px),radial-gradient(ellipse at 80% 0,rgba(16,185,129,.08),transparent 42%);background-size:30px 30px,30px 30px,auto;mask-image:linear-gradient(135deg,#000,rgba(0,0,0,.25))}
        .xrd-root *{box-sizing:border-box}.xrd-root button{font:inherit;color:inherit}
        .xrd-graph-tool{margin:10px 0 18px}.xrd-graph-tools{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:9px}.xrd-graph-tools button{padding:6px 9px;border:1px solid var(--xrd-border);border-radius:99px;background:#070907;color:#9da696;font-size:9px;cursor:pointer}.xrd-graph-tools button.active{border-color:rgba(163,230,53,.48);background:rgba(163,230,53,.09);color:var(--xrd-ac)}.xrd-graph-count{margin-left:auto;color:#66705f;font:8px ui-monospace,monospace;letter-spacing:.1em}.xrd-graph-canvas{position:relative;overflow:hidden;border:1px solid rgba(163,230,53,.27);border-radius:15px;background:radial-gradient(ellipse at 50% 45%,rgba(163,230,53,.07),transparent 47%),linear-gradient(rgba(163,230,53,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(163,230,53,.035) 1px,transparent 1px),#030503;background-size:auto,24px 24px,24px 24px,auto;cursor:grab;touch-action:none;user-select:none}.xrd-graph-canvas.is-dragging{cursor:grabbing}.xrd-graph-canvas svg{display:block;width:100%;min-width:640px;aspect-ratio:960/600}.xrd-graph-hud{position:absolute;z-index:2;top:12px;left:14px;right:14px;display:flex;justify-content:space-between;color:#6c7866;font:8px ui-monospace,monospace;letter-spacing:.13em;pointer-events:none}.xrd-graph-hud span:first-child{color:var(--xrd-ac)}.xrd-graph-hud i{display:inline-block;width:6px;height:6px;margin-right:6px;border-radius:50%;background:var(--xrd-ac);box-shadow:0 0 8px var(--xrd-ac);animation:xrd-live 1.6s ease-in-out infinite}@keyframes xrd-live{50%{opacity:.25}}.xrd-graph-canvas>svg .xrd-graph-edge path{fill:none;stroke:#fbbf24;stroke-width:2.1;stroke-dasharray:3 13;stroke-linecap:round;animation:xrd-edge-flow 1.7s linear infinite}@keyframes xrd-edge-flow{to{stroke-dashoffset:-32}}.xrd-graph-source-node>path{fill:none;stroke:#64705e;stroke-width:1.1;stroke-dasharray:4 7;opacity:.7}.xrd-graph-source-node>circle{fill:#071007;stroke:#a3e635;stroke-width:1.5;filter:drop-shadow(0 0 7px rgba(163,230,53,.28))}.xrd-graph-source-node>text,.xrd-graph-evidence>text{fill:#dce5d7;font-size:10px;font-weight:700;paint-order:stroke;stroke:#030503;stroke-width:4px;stroke-linejoin:round}.xrd-graph-person>circle:first-child{fill:#a3e635;stroke:#ddff9a;stroke-width:2;filter:drop-shadow(0 0 18px rgba(163,230,53,.55))}.xrd-graph-person .xrd-graph-orbit{fill:none;stroke:#a3e635;stroke-opacity:.5;stroke-dasharray:3 8;animation:xrd-orbit 28s linear infinite;transform-origin:480px 300px}@keyframes xrd-orbit{to{transform:rotate(360deg)}}.xrd-graph-person>text{fill:#a3e635;font:9px ui-monospace,monospace;letter-spacing:1px}.xrd-graph-evidence{cursor:pointer}.xrd-graph-evidence circle{fill:#080c08;stroke:#8a918a;stroke-width:1.5;transition:stroke .15s,filter .15s,fill .15s}.xrd-graph-evidence:hover circle,.xrd-graph-evidence.selected circle,.xrd-graph-evidence:focus-visible circle{fill:#10170b;stroke:#a3e635;filter:drop-shadow(0 0 10px rgba(163,230,53,.55))}.xrd-graph-evidence:focus-visible{outline:none}.xrd-graph-reset{position:absolute;right:12px;bottom:48px;padding:7px 9px;border:1px solid rgba(163,230,53,.35);border-radius:8px;background:#080b08;color:var(--xrd-ac);font-size:9px;cursor:pointer}.xrd-graph-legend{position:absolute;bottom:0;left:0;right:0;display:flex;gap:16px;padding:10px 13px;border-top:1px solid #1d241b;background:rgba(3,5,3,.9);color:#8d9686;font-size:8px}.xrd-graph-legend span{display:flex;align-items:center;gap:6px}.xrd-graph-legend i{width:17px;height:1px;background:#64705e}.xrd-graph-legend i.stored{height:2px;background:#fbbf24}.xrd-graph-caption{margin:8px 2px 0;color:#737d70;font-size:9px;line-height:1.5}
        @media(prefers-reduced-motion:reduce){.xrd-graph-hud i,.xrd-graph-person .xrd-graph-orbit,.xrd-graph-edge path{animation:none!important}.xrd-photo-modal{animation:none}}
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
        .xrd-hero-identity{position:relative;z-index:1;display:flex;align-items:center;gap:14px}.xrd-hero-avatar{position:relative;flex:none;width:54px;height:54px}.xrd-hero-avatar>img,.xrd-hero-avatar>span{width:54px;height:54px;display:grid;place-items:center;border:1px solid rgba(163,230,53,.4);border-radius:50%;object-fit:cover;background:#11180c;color:var(--xrd-ac);font-size:22px;font-weight:900}.xrd-photo-trigger{position:absolute;right:-7px;bottom:-5px;display:flex;align-items:center;gap:3px;padding:4px 5px;border:2px solid #080b08;border-radius:99px;background:var(--xrd-ac);color:#0a1400!important;box-shadow:0 0 12px rgba(163,230,53,.5);cursor:pointer}.xrd-photo-trigger b{font-size:8px}
        .xrd-photo-modal{position:fixed;z-index:100060;inset:0;display:grid;place-items:center;padding:18px;background:rgba(0,0,0,.82);backdrop-filter:blur(9px);animation:xrd-fade .18s ease-out}.xrd-photo-modal>section{width:min(720px,100%);max-height:min(88vh,860px);overflow:auto;padding:20px;border:1px solid rgba(163,230,53,.34);border-radius:18px;background:radial-gradient(ellipse at 0 0,rgba(163,230,53,.11),transparent 50%),#060806;box-shadow:0 32px 90px #000}.xrd-photo-modal header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px}.xrd-photo-modal header h2{margin:4px 0;font-size:20px}.xrd-photo-modal header p{margin:0;color:#8d9589;font-size:11px}.xrd-photo-modal header button{width:34px;height:34px;display:grid;place-items:center;border:1px solid var(--xrd-border);border-radius:50%;background:#090c09;cursor:pointer}.xrd-photo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:11px}.xrd-photo-grid article{display:flex;min-width:0;flex-direction:column;gap:5px;padding:9px;border:1px solid var(--xrd-border);border-radius:12px;background:#080a08}.xrd-photo-frame{position:relative;aspect-ratio:1;overflow:hidden;border-radius:9px;background:#101410}.xrd-photo-frame img{width:100%;height:100%;object-fit:cover}.xrd-photo-frame>span{position:absolute;left:5px;bottom:5px;display:flex;align-items:center;gap:4px;padding:4px 6px;border-radius:99px;background:rgba(0,0,0,.82);color:var(--xrd-ac);font-size:8px}.xrd-photo-grid strong{overflow:hidden;color:#e3e9de;font-size:10px;text-overflow:ellipsis;white-space:nowrap}.xrd-photo-grid small{overflow:hidden;color:#80897d;font-size:9px;text-overflow:ellipsis;white-space:nowrap}
        @keyframes xrd-fade{from{opacity:0}}@keyframes xrd-scan{from{transform:translateY(-120%)}to{transform:translateY(620%)}}@keyframes xrd-shimmer{to{background-position:200% 0}}
        .xrd-oracle-chat{position:fixed;z-index:100070;inset:0;display:flex;flex-direction:column;overflow:hidden;background:#020402;animation:xrd-fade .18s ease-out}.xrd-oracle-chat>header{position:relative;z-index:3;display:flex;align-items:center;gap:10px;padding:calc(10px + env(safe-area-inset-top)) 16px 10px;border-bottom:1px solid #252a24;background:rgba(3,5,3,.9);backdrop-filter:blur(14px)}.xrd-chat-back,.xrd-chat-close{width:34px;height:34px;display:grid;place-items:center;border:1px solid var(--xrd-border);border-radius:50%;background:#080b08;color:#dce5d7;cursor:pointer}.xrd-chat-mark{width:34px;height:34px;display:grid;place-items:center;border-radius:50%;background:radial-gradient(circle at 35% 25%,#ecfccb,#a3e635 45%,#10b981);color:#071004;box-shadow:0 0 18px rgba(163,230,53,.4)}.xrd-chat-heading{min-width:0;flex:1;display:flex;flex-direction:column;gap:3px}.xrd-chat-heading strong{font-size:12px}.xrd-chat-heading small{color:#7d8878;font:8px ui-monospace,monospace;letter-spacing:.08em}.xrd-chat-background{position:absolute;inset:48px 0 0;overflow:hidden;pointer-events:none}.xrd-chat-background>i{position:absolute;inset:-20%;background:radial-gradient(ellipse at 25% 20%,rgba(163,230,53,.18),transparent 43%),radial-gradient(ellipse at 80% 65%,rgba(16,185,129,.15),transparent 42%);filter:blur(24px);animation:xrd-aurora 16s ease-in-out infinite alternate}.xrd-chat-background>i:nth-child(2){opacity:.5;transform:rotate(180deg);animation-duration:22s}.xrd-chat-background>div{position:absolute;left:-20%;right:-20%;bottom:-20%;height:55%;background-image:linear-gradient(rgba(163,230,53,.25) 1px,transparent 1px),linear-gradient(90deg,rgba(163,230,53,.25) 1px,transparent 1px);background-size:40px 40px;transform:perspective(460px) rotateX(62deg);transform-origin:50% 100%;mask-image:linear-gradient(transparent,#000 45%,transparent);animation:xrd-floor 3.2s linear infinite}@keyframes xrd-aurora{to{transform:translate3d(-4%,3%,0) scale(1.08)}}@keyframes xrd-floor{to{background-position:0 40px}}
        .xrd-chat-body{position:relative;z-index:1;flex:1;min-height:0;overflow:auto;padding:22px 16px 30px;overscroll-behavior:contain}.xrd-chat-welcome{width:min(640px,100%);min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;margin:auto;text-align:center}.xrd-chat-orb{width:96px;height:96px;display:grid;place-items:center;margin-bottom:16px;border:1px solid rgba(163,230,53,.65);border-radius:50%;background:radial-gradient(circle at 40% 35%,#eaffc9,#a3e635 35%,rgba(16,185,129,.45) 70%,transparent 73%);color:#071004;box-shadow:0 0 55px rgba(163,230,53,.25);animation:xrd-orb 3.1s ease-in-out infinite}@keyframes xrd-orb{50%{transform:scale(1.06);box-shadow:0 0 75px rgba(163,230,53,.42)}}.xrd-chat-welcome h2{margin:0 0 7px;font-size:25px;background:linear-gradient(90deg,#fff,#d9f2b8);color:transparent;background-clip:text}.xrd-chat-welcome>p{max-width:420px;color:#899386;font-size:11px;line-height:1.55}.xrd-chat-welcome>div:last-child{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;width:min(520px,100%);margin-top:16px}.xrd-chat-welcome>div:last-child button{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:11px;border:1px solid #252c22;border-radius:11px;background:rgba(4,7,4,.75);color:#c8d2c1;font-size:10px;text-align:left;cursor:pointer}.xrd-chat-welcome>div:last-child button:hover{border-color:rgba(163,230,53,.55);color:var(--xrd-ac)}.xrd-chat-turn{width:min(760px,100%);margin:0 auto 18px;animation:xrd-fade .22s ease-out}.xrd-chat-user{width:fit-content;max-width:84%;margin:0 0 12px auto;padding:10px 13px;border-radius:16px 16px 3px 16px;background:linear-gradient(180deg,#b9f54f,#84cc16);color:#0a1400;font-size:11px;font-weight:700;overflow-wrap:anywhere}.xrd-chat-answer{padding:14px;border:1px solid var(--xrd-border);border-left:2px solid var(--xrd-ac);border-radius:5px 14px 14px 14px;background:rgba(5,8,5,.92);backdrop-filter:blur(8px)}.xrd-chat-answer-meta{display:flex;align-items:center;gap:7px;color:#8a9585;font-size:9px}.xrd-chat-answer-meta .xrd-chat-mark{width:24px;height:24px}.xrd-chat-answer-meta strong{color:var(--xrd-ac)}.xrd-chat-answer-meta>span:last-child{margin-left:auto;font:8px ui-monospace,monospace}.xrd-chat-answer>p{margin:10px 0;color:#d4ddd0;font-size:11px;line-height:1.6}.xrd-chat-answer>button{display:flex;align-items:center;gap:8px;width:100%;padding:9px;margin-top:6px;border:1px solid #232a21;border-radius:9px;background:#030503;color:#dce5d7;text-align:left;font-size:9px;cursor:pointer}.xrd-chat-answer>button:hover{border-color:rgba(163,230,53,.4)}.xrd-chat-answer>button>span:nth-child(2){min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.xrd-chat-compose{position:relative;z-index:2;display:flex;align-items:center;gap:9px;padding:10px max(14px,calc((100vw - 780px)/2)) calc(10px + env(safe-area-inset-bottom));border-top:1px solid #252a24;background:rgba(3,5,3,.94);backdrop-filter:blur(14px)}.xrd-chat-compose>svg{flex:none;color:var(--xrd-ac)}.xrd-chat-compose input{min-width:0;flex:1;padding:12px;border:1px solid #2b3228;border-radius:11px;background:#050705;color:#edf2e9;font:inherit;font-size:12px}.xrd-chat-compose input:focus{outline:1px solid var(--xrd-ac);border-color:var(--xrd-ac)}
        @media(max-width:600px){.xrd-chat-welcome>div:last-child{grid-template-columns:1fr}.xrd-chat-orb{width:76px;height:76px}.xrd-chat-welcome h2{font-size:21px}.xrd-chat-body{padding:16px 12px 22px}.xrd-chat-compose{padding-left:10px;padding-right:10px}}
        @media(prefers-reduced-motion:reduce){.xrd-chat-background>i,.xrd-chat-background>div,.xrd-chat-orb,.xrd-chat-turn{animation:none!important}}
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
        .xrd-setting-row button i{position:absolute;left:2px;top:2px;width:13px;height:13px;border-radius:50%;background:#788073;transition:left .18s,background .18s}.xrd-setting-row button.active{border-color:rgba(163,230,53,.55);background:rgba(163,230,53,.22);opacity:1}.xrd-setting-row button.active i{left:17px;background:var(--xrd-ac)}
        .xrd-notice{display:flex;align-items:flex-start;gap:9px;margin:14px 0 0;padding:12px;border:1px solid rgba(163,230,53,.16);border-radius:11px;background:rgba(163,230,53,.035);color:#a2ab9a;font-size:10px;line-height:1.5}
        .xrd-notice svg{flex:none;color:var(--xrd-ac)}
        .xrd-permission-list{display:flex;flex-direction:column;gap:7px}
        .xrd-permission-list article{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px;border:1px solid var(--xrd-border);border-radius:11px;background:#070907}
        .xrd-permission-list article>div{min-width:0;display:flex;flex-direction:column;gap:4px}
        .xrd-permission-list strong{overflow:hidden;color:#e4e9df;font-size:11px;text-overflow:ellipsis;white-space:nowrap}
        .xrd-permission-list small{color:#778073;font-size:9px}
        .xrd-permission-list article>span{max-width:45%;color:#a3e635;font-size:9px;text-align:right;overflow-wrap:anywhere}
        .xrd-inline-success{margin:10px 0;padding:10px 12px;border:1px solid rgba(163,230,53,.25);border-radius:9px;background:rgba(163,230,53,.06);color:#c9f78a;font-size:10px}
        .xrd-assurance-panel{margin:0 0 14px;padding:14px;border:1px solid var(--xrd-border);border-radius:14px;background:radial-gradient(ellipse at 0 0,rgba(163,230,53,.075),transparent 60%),#070907}.xrd-assurance-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin:12px 0 10px}.xrd-assurance-steps>div{position:relative;display:flex;min-height:84px;flex-direction:column;gap:4px;padding:9px;border:1px solid #252b23;border-radius:9px;background:#050705}.xrd-assurance-steps>div::after{position:absolute;top:15px;right:-8px;width:8px;height:1px;background:#3c4538;content:""}.xrd-assurance-steps>div:last-child::after{display:none}.xrd-assurance-steps b{color:#75816d;font:8px ui-monospace,monospace}.xrd-assurance-steps strong{color:#cbd4c5;font-size:9px}.xrd-assurance-steps small{color:#788174;font-size:8px;line-height:1.35}.xrd-assurance-steps .is-present{border-color:rgba(163,230,53,.35)}.xrd-assurance-steps .is-present b,.xrd-assurance-steps .is-present strong{color:var(--xrd-ac)}.xrd-assurance-steps .is-unavailable{border-style:dashed}.xrd-assurance-panel>p{margin:0;color:#818b7d;font-size:9px;line-height:1.5}
        .xrd-grants-panel{margin-top:14px}.xrd-grant-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-top:1px solid var(--xrd-border)}.xrd-grant-row>div{display:flex;min-width:0;flex-direction:column;gap:4px}.xrd-grant-row strong{overflow:hidden;color:#dbe4d6;font-size:10px;text-overflow:ellipsis;white-space:nowrap}.xrd-grant-row small{color:#7f887a;font-size:8px}.xrd-grant-row button{padding:6px 8px;border:1px solid rgba(248,113,113,.35);border-radius:7px;background:rgba(248,113,113,.06);color:#fca5a5;font-size:8px;font-weight:800;cursor:pointer}.xrd-grant-row button:disabled{opacity:.5;cursor:wait}
        .xrd-access-request{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:14px}.xrd-access-request h3{margin:4px 0;font-size:13px}.xrd-access-request p{margin:0;color:#808a7c;font-size:9px;line-height:1.5}.xrd-access-request>button,.xrd-access-actions button{padding:8px 11px;border:1px solid rgba(163,230,53,.34);border-radius:8px;background:rgba(163,230,53,.08);color:var(--xrd-ac);font-size:9px;font-weight:900;white-space:nowrap;cursor:pointer}.xrd-access-request>button:disabled,.xrd-access-actions button:disabled{opacity:.5;cursor:wait}.xrd-access-state{color:#fbbf24;font-size:9px}.xrd-access-state.is-approved{color:#a3e635}.xrd-access-queue{margin-top:16px}.xrd-access-request-row{padding:12px 0;border-top:1px solid var(--xrd-border)}.xrd-access-request-header{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.xrd-access-request-header>div{display:flex;min-width:0;flex-direction:column;gap:4px}.xrd-access-request-header strong{color:#e1e8dc;font-size:10px}.xrd-access-request-header small{color:#7d887a;font-size:9px;overflow-wrap:anywhere}.xrd-access-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin:10px 0}.xrd-access-options label{display:flex;align-items:center;gap:7px;min-width:0;padding:8px;border:1px solid #20251f;border-radius:8px;background:#050705;color:#b8c2b2;font-size:9px;cursor:pointer}.xrd-access-options input{accent-color:#a3e635}.xrd-access-options span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.xrd-access-empty{color:#899284;font-size:9px}.xrd-access-actions{display:flex;justify-content:flex-end;gap:7px}.xrd-access-actions button.is-secondary{border-color:var(--xrd-border);background:#070907;color:#a8b09f}
        .xrd-visibility-control{margin-bottom:14px}.xrd-visibility-control label{display:flex;flex-direction:column;gap:6px;color:#aab3a5;font-size:10px;font-weight:800}.xrd-visibility-control select{max-width:260px;padding:9px 10px;border:1px solid var(--xrd-border);border-radius:8px;background:#050705;color:#e5ecdf;font:inherit}.xrd-visibility-control select:focus{outline:1px solid var(--xrd-ac);border-color:var(--xrd-ac)}.xrd-visibility-control select:disabled{opacity:.55}.xrd-visibility-control p{margin:9px 0 0;color:#7f887b;font-size:9px;line-height:1.5}
        .xrd-verification-item{min-width:0}.xrd-source-check{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:-5px 0 2px 46px}.xrd-source-check button{padding:6px 9px;border:1px solid rgba(163,230,53,.3);border-radius:8px;background:rgba(163,230,53,.06);color:var(--xrd-ac);font-size:9px;font-weight:800;cursor:pointer}.xrd-source-check button:disabled{opacity:.5;cursor:wait}.xrd-source-check span{color:#8b9586;font-size:9px}.xrd-source-check .is-match{color:#a3e635}.xrd-source-check .is-warning{color:#fbbf24}.xrd-audit-toggle{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;padding:0;border:0;background:none;text-align:left;cursor:pointer}.xrd-audit-toggle>span{display:flex;min-width:0;flex-direction:column;gap:5px}.xrd-audit-toggle strong{color:#e1e8dc;font-size:11px;text-transform:capitalize}.xrd-audit-toggle small{color:#7d887a;font-size:9px}.xrd-audit-toggle>svg{flex:none;color:var(--xrd-ac);transition:transform .18s}.xrd-audit-toggle[aria-expanded="true"]>svg{transform:rotate(90deg)}.xrd-audit-detail{margin-top:10px;padding:10px;border-top:1px solid var(--xrd-border);color:#aeb8a9;font-size:10px}.xrd-audit-detail p{margin:0 0 8px}.xrd-audit-detail dl{display:grid;gap:6px;margin:0}.xrd-audit-detail dl>div{display:grid;grid-template-columns:minmax(90px,.4fr) minmax(0,1fr);gap:8px}.xrd-audit-detail dt{color:#778272;text-transform:capitalize}.xrd-audit-detail dd{margin:0;overflow-wrap:anywhere;color:#d5ded0}
        .xrd-remark-compose{margin-top:14px}.xrd-remark-label{display:flex;flex-direction:column;gap:6px;margin:12px 0;color:#a9b1a2;font-size:10px;font-weight:800}.xrd-remark-label select,.xrd-remark-label textarea,.xrd-remark-reply textarea{width:100%;padding:10px;border:1px solid var(--xrd-border);border-radius:9px;background:#050705;color:#e8eee4;font:inherit;font-size:11px;resize:vertical}.xrd-remark-label select:focus,.xrd-remark-label textarea:focus,.xrd-remark-reply textarea:focus{outline:1px solid var(--xrd-ac);border-color:var(--xrd-ac)}.xrd-remark-submit{display:flex;align-items:center;justify-content:space-between;gap:10px}.xrd-remark-submit small{color:#7f887a;font-size:9px}
        .xrd-remark{margin:10px 0;padding:14px;border:1px solid var(--xrd-border);border-radius:12px;background:linear-gradient(180deg,#080a08,#050605)}.xrd-remark-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.xrd-remark-head>span:last-child{display:flex;align-items:center;gap:5px;color:#7e887b;font-size:9px}.xrd-remark-type{padding:4px 7px;border:1px solid rgba(163,230,53,.25);border-radius:99px;color:var(--xrd-ac);font-size:8px;font-weight:900}.xrd-remark>p{margin:12px 0;color:#e2e8dc;font-size:12px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere}.xrd-remark-meta{color:#7e887b;font-size:9px}.xrd-remark-meta button{padding:0;border:0;background:none;color:#b6d88b;font:inherit;text-decoration:underline;cursor:pointer}.xrd-owner-response{margin-top:12px;padding:11px;border-left:2px solid var(--xrd-ac);background:#0a0d08}.xrd-owner-response small{color:var(--xrd-ac);font-size:8px;font-weight:900;letter-spacing:.08em}.xrd-owner-response p{margin:6px 0;color:#dbe4d5;font-size:11px;line-height:1.5;white-space:pre-wrap}.xrd-owner-response time{color:#798273;font-size:8px}.xrd-remark-reply{display:flex;align-items:flex-end;gap:8px;margin-top:12px}.xrd-remark-reply textarea{flex:1}.xrd-remark-reply button{padding:8px 10px;border:1px solid rgba(163,230,53,.25);border-radius:8px;background:rgba(163,230,53,.08);color:var(--xrd-ac);font-size:9px;font-weight:800;cursor:pointer}.xrd-remark-reply button:disabled{opacity:.45}
        .xrd-identity-sources{display:flex;flex-direction:column;gap:7px}
        .xrd-identity-source{display:flex;align-items:center;gap:10px;padding:10px;border:1px solid #222821;border-radius:11px;background:#060806}
        .xrd-source-glyph{width:32px;height:32px;display:grid;place-items:center;flex:none;border:1px solid rgba(163,230,53,.18);border-radius:9px;background:rgba(163,230,53,.06);color:var(--xrd-ac)}
        .xrd-identity-source>div{min-width:0;flex:1;display:flex;flex-direction:column;gap:3px}
        .xrd-identity-source strong{color:#e3e9de;font-size:10px}
        .xrd-identity-source small{overflow:hidden;color:#7f887a;font-size:9px;text-overflow:ellipsis;white-space:nowrap}
        .xrd-count{display:grid;place-items:center;min-width:24px;height:24px;padding:0 6px;border:1px solid rgba(163,230,53,.2);border-radius:99px;color:var(--xrd-ac);font-size:9px}
        .xrd-page-heading{margin-bottom:17px}.xrd-page-heading h2{margin:0 0 5px;font-size:25px;letter-spacing:-.03em}.xrd-page-heading p{margin:0;color:#8d9589;font-size:12px;line-height:1.55}
        .xrd-record-list{display:flex;flex-direction:column;gap:9px}.xrd-record{display:flex;gap:12px;padding:14px;border:1px solid var(--xrd-border);border-radius:13px;background:linear-gradient(125deg,rgba(255,255,255,.035),rgba(255,255,255,.012));min-width:0}
        .xrd-root .xrd-record-button{width:100%;color:inherit;text-align:left;cursor:pointer;transition:border-color .16s,background .16s,transform .16s}.xrd-root .xrd-record-button:hover{border-color:rgba(163,230,53,.38);background:linear-gradient(125deg,rgba(163,230,53,.07),rgba(255,255,255,.015));transform:translateY(-1px)}.xrd-root .xrd-record-button:focus-visible,.xrd-root .xrd-related-edge:focus-visible,.xrd-root .xrd-edge button:focus-visible{outline:2px solid var(--xrd-ac);outline-offset:2px}
        .xrd-detail-back{display:flex;align-items:center;gap:6px;margin:0 0 15px;padding:7px 10px;border:1px solid var(--xrd-border);border-radius:9px;background:#080a08;color:#abb3a5;font-size:10px;cursor:pointer}.xrd-detail-back:hover{border-color:rgba(163,230,53,.35);color:var(--xrd-ac)}.xrd-detail-heading h2{overflow-wrap:anywhere}.xrd-detail-panel{margin-bottom:14px}.xrd-detail-status{display:flex;align-items:center;gap:9px;padding-bottom:13px;border-bottom:1px solid var(--xrd-border);color:#929a8e;font-size:10px}.xrd-detail-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:14px}.xrd-detail-grid>div{min-width:0;padding:10px;border:1px solid #20251f;border-radius:9px;background:#050705}.xrd-detail-grid small{display:block;margin-bottom:5px;color:#7f887b;font-size:8px;text-transform:uppercase}.xrd-detail-grid strong{display:block;color:#dce4d7;font-size:10px;font-weight:700;overflow-wrap:anywhere}.xrd-detail-link{display:inline-flex;align-items:center;gap:5px;margin-top:13px;color:var(--xrd-ac);font-size:10px;font-weight:800;text-decoration:none}.xrd-detail-link:hover{text-decoration:underline}.xrd-root .xrd-related-edge{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:4px;width:100%;padding:12px 34px 12px 12px;border:1px solid var(--xrd-border);border-radius:10px;background:#060806;text-align:left;cursor:pointer}.xrd-root .xrd-related-edge:hover{border-color:rgba(163,230,53,.32)}.xrd-related-edge>span{color:var(--xrd-ac);font-size:8px;font-weight:900;text-transform:uppercase}.xrd-related-edge strong{color:#e3e9de;font-size:11px}.xrd-related-edge small{color:#81897d;font-size:9px}.xrd-related-edge svg{position:absolute;right:12px;top:50%;transform:translateY(-50%);color:#81897d}.xrd-detail-actions{display:flex;flex-wrap:wrap;gap:8px}.xrd-secondary{display:flex;align-items:center;justify-content:center;padding:9px 12px;border:1px solid var(--xrd-border);border-radius:9px;background:#080a08;color:#c5cdc0;font-size:10px;font-weight:800;cursor:pointer}
        .xrd-record-mark{width:34px;height:34px;flex:none;display:grid;place-items:center;border:1px solid rgba(163,230,53,.18);border-radius:10px;background:rgba(163,230,53,.07);color:var(--xrd-ac)}
        .xrd-record-body{min-width:0;flex:1}.xrd-record-top{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.xrd-record-title{color:#f0f3ec;font-size:12px;font-weight:800;overflow-wrap:anywhere}.xrd-status{flex:none;padding:3px 7px;border:1px solid rgba(148,163,184,.2);border-radius:99px;color:#a8b0a4;font-size:8px;font-weight:900;text-transform:uppercase}
        .xrd-status.is-verified{border-color:rgba(163,230,53,.28);background:rgba(163,230,53,.08);color:var(--xrd-ac)}
        .xrd-record-meta{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:6px;color:#7d857a;font-size:9px}.xrd-record-meta i{width:3px;height:3px;border-radius:50%;background:#535b50}.xrd-record-body>p{margin:9px 0 0;color:#b8beb4;font-size:11px;line-height:1.5}
        .xrd-record-foot{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}.xrd-record-foot span{padding:3px 7px;border:1px solid #242a23;border-radius:99px;color:#929a8d;font-size:8px;font-weight:800}
        .xrd-search{display:flex;align-items:center;gap:8px;margin-bottom:13px;padding:0 12px;border:1px solid var(--xrd-border);border-radius:11px;background:#080a08;color:#81887e}.xrd-search input{width:100%;height:40px;border:0;outline:0;background:transparent;color:#eff2eb;font:inherit;font-size:11px}
        .xrd-identity-panel{display:flex;align-items:center;gap:14px;margin-bottom:13px;padding:16px;border:1px solid var(--xrd-border);border-radius:14px;background:#080a08}.xrd-identity-avatar{width:64px;height:64px;display:grid;place-items:center;flex:none;overflow:hidden;border:2px solid rgba(163,230,53,.35);border-radius:50%;background:#11180c;color:var(--xrd-ac);font-size:24px;font-weight:900}.xrd-identity-avatar img{width:100%;height:100%;object-fit:cover}.xrd-identity-copy h3{display:flex;align-items:center;gap:6px;margin:0;font-size:15px}.xrd-identity-copy h3 svg{color:var(--xrd-ac)}.xrd-identity-copy p{margin:3px 0;color:#8b9387;font-size:10px}.xrd-identity-copy .xrd-bio{max-width:620px;color:#c0c6bc;font-size:11px;line-height:1.5}.xrd-identity-copy>span{color:#737b70;font-size:9px}
        .xrd-graph{display:flex;flex-direction:column;gap:12px}.xrd-graph-source{display:grid;grid-template-columns:minmax(150px,.75fr) 50px minmax(0,1.4fr);align-items:center;gap:10px;padding:13px;border:1px solid var(--xrd-border);border-radius:13px;background:#070907}.xrd-graph-node{display:flex;flex-direction:column;gap:5px;color:var(--xrd-ac)}.xrd-graph-node span{color:#e6ecdf;font-size:11px;font-weight:800;overflow-wrap:anywhere}.xrd-graph-node small{color:#788174;font-size:9px}.xrd-graph-links{display:flex;flex-direction:column;gap:6px}.xrd-graph-links i{display:block;height:1px;background:linear-gradient(90deg,rgba(163,230,53,.6),rgba(163,230,53,.05))}
        .xrd-graph-records{display:flex;flex-direction:column;gap:5px}.xrd-graph-record{display:grid;grid-template-columns:16px minmax(0,1fr) auto;align-items:center;gap:7px;padding:7px;border:1px solid #1c211b;border-radius:8px;color:#969f91;font-size:9px}.xrd-graph-record span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.xrd-graph-record b{color:var(--xrd-ac);font-size:8px}.xrd-root .xrd-graph-record-button{width:100%;background:#060806;text-align:left;cursor:pointer}.xrd-root .xrd-graph-record-button:hover{border-color:rgba(163,230,53,.38)}.xrd-edge-list{display:flex;flex-direction:column;gap:7px}.xrd-edge{display:grid;grid-template-columns:minmax(0,1fr) minmax(90px,.65fr) minmax(0,1fr);align-items:center;gap:9px;padding:10px;border:1px solid var(--xrd-border);border-radius:11px;background:#070907}.xrd-root .xrd-edge button{min-width:0;padding:8px;border:1px solid #242a23;border-radius:8px;background:#050705;color:#dce3d7;font-size:9px;text-align:left;overflow-wrap:anywhere;cursor:pointer}.xrd-root .xrd-edge button:hover{border-color:rgba(163,230,53,.35)}.xrd-edge>span{color:var(--xrd-ac);font-size:8px;font-weight:900;text-align:center;text-transform:uppercase;overflow-wrap:anywhere}
        .xrd-source-list{display:flex;flex-direction:column;gap:8px}.xrd-source{display:flex;align-items:center;gap:10px;padding:12px;border:1px solid var(--xrd-border);border-radius:11px;background:#080a08}.xrd-source>span{width:34px;height:34px;display:grid;place-items:center;flex:none;border-radius:10px;background:rgba(163,230,53,.08);color:var(--xrd-ac)}.xrd-source>div{min-width:0;display:flex;flex:1;flex-direction:column;gap:3px}.xrd-source strong{font-size:11px}.xrd-source small{color:#7a8276;font-size:9px;overflow-wrap:anywhere}.xrd-source>svg{color:#687064}.xrd-source-actions{display:flex!important;flex:0 0 auto!important;flex-direction:row!important;align-items:center;gap:5px}.xrd-root .xrd-source-actions button{padding:6px 8px;border:1px solid var(--xrd-border);border-radius:7px;background:#080a08;color:#cbd3c5;font-size:9px;font-weight:800;cursor:pointer}.xrd-root .xrd-source-actions button:hover{border-color:rgba(163,230,53,.4);color:var(--xrd-ac)}.xrd-root .xrd-source-actions button:disabled{opacity:.55;cursor:wait}
        .xrd-chain-mark{border-color:rgba(96,165,250,.2);background:rgba(96,165,250,.07);color:#60a5fa}.xrd-hash{margin-top:7px;color:#92a7bc;font:9px ui-monospace,monospace;overflow-wrap:anywhere}.xrd-integrity{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px;color:#899286;font-size:9px;text-transform:capitalize}.xrd-integrity b{color:#d8e2d3}.xrd-integrity button,.xrd-error button{padding:6px 9px;border:1px solid rgba(163,230,53,.25);border-radius:7px;background:rgba(163,230,53,.08);color:var(--xrd-ac);font-size:9px;font-weight:800;cursor:pointer}.xrd-integrity button:disabled{opacity:.5;cursor:wait}
        .xrd-empty{display:flex;flex-direction:column;align-items:center;gap:8px;padding:38px 16px;border:1px dashed #292f28;border-radius:13px;color:#90988b;text-align:center;font-size:11px}.xrd-empty svg{color:#7f9f52}.xrd-restricted{display:flex;align-items:flex-start;gap:12px;padding:16px;border:1px solid rgba(251,191,36,.2);border-radius:12px;background:rgba(251,191,36,.04);color:#fbbf24}.xrd-restricted p{margin:4px 0 0;color:#a9a391;font-size:11px;line-height:1.5}.xrd-error{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;padding:10px;border:1px solid rgba(248,113,113,.25);border-radius:10px;color:#fca5a5;font-size:10px}.xrd-loading{display:flex;align-items:center;gap:9px;padding:22px;color:#9ca397;font-size:11px}.xrd-loading span{width:14px;height:14px;border:2px solid #394431;border-top-color:var(--xrd-ac);border-radius:50%;animation:xrd-spin .8s linear infinite}
        .xrd-integrity-actions{display:flex;gap:6px}.xrd-trace-list{display:flex;flex-direction:column;gap:6px;margin-top:11px;padding-top:10px;border-top:1px solid var(--xrd-border)}.xrd-trace-heading{color:#929a8e;font-size:9px}.xrd-trace-row{display:grid;grid-template-columns:16px minmax(0,1fr) auto;align-items:center;gap:8px;padding:7px;border:1px solid #20251f;border-radius:8px;background:#050705;color:#8c9688}.xrd-trace-row>span{min-width:0;display:flex;flex-direction:column;gap:3px}.xrd-trace-row strong{color:#dce4d7;font-size:9px;text-transform:capitalize}.xrd-trace-row small{color:#778073;font-size:8px;overflow-wrap:anywhere}.xrd-trace-row>b{font-size:8px;text-align:right}.xrd-trace-row .is-valid{color:var(--xrd-ac)}.xrd-trace-row .is-invalid{color:#f87171}.xrd-trace-row .is-legacy{color:#fbbf24}
        @keyframes xrd-spin{to{transform:rotate(360deg)}}.xrd-oracle-card{display:flex;align-items:center;gap:16px;padding:20px;border:1px solid rgba(163,230,53,.22);border-radius:16px;background:radial-gradient(circle at 0 0,rgba(163,230,53,.1),transparent 50%),#080a08}.xrd-oracle-glyph{width:44px;height:44px;display:grid;place-items:center;flex:none;border:1px solid rgba(163,230,53,.28);border-radius:13px;color:var(--xrd-ac)}.xrd-oracle-card>div:nth-child(2){flex:1}.xrd-oracle-card h2{margin:0 0 5px;font-size:16px}.xrd-oracle-card p{margin:0;color:#929a8f;font-size:11px;line-height:1.5}.xrd-primary{display:flex;align-items:center;gap:6px;padding:9px 12px;border:0;border-radius:9px;background:var(--xrd-ac);color:#10170a!important;font-size:10px;font-weight:900;white-space:nowrap;cursor:pointer}
        .xrd-oracle-search{min-width:0;flex:1;display:flex;flex-direction:column;gap:8px}.xrd-oracle-search label{color:#c8d2c1;font-size:11px;font-weight:800}.xrd-oracle-search>div{display:flex;gap:8px}.xrd-oracle-search input{min-width:0;flex:1;padding:10px 12px;border:1px solid var(--xrd-border);border-radius:9px;background:#030503;color:#edf2e9;font:inherit;font-size:11px}.xrd-oracle-search input:focus{outline:1px solid var(--xrd-ac);border-color:var(--xrd-ac)}.xrd-oracle-search .xrd-primary{margin:0}.xrd-primary:disabled{opacity:.45;cursor:default}.xrd-oracle-suggestions{display:flex;flex-wrap:wrap;gap:7px;margin:12px 0}.xrd-oracle-suggestions button{display:flex;align-items:center;gap:6px;padding:7px 9px;border:1px solid var(--xrd-border);border-radius:99px;background:#070907;color:#b5c0ae;font-size:9px;cursor:pointer}.xrd-oracle-suggestions button:hover{border-color:rgba(163,230,53,.4);color:var(--xrd-ac)}.xrd-oracle-result>p{margin:8px 0 12px;color:#c5cec0;font-size:11px;line-height:1.55}.xrd-oracle-result .xrd-record{width:100%;align-items:center;margin-top:7px;text-align:left;cursor:pointer}
        .xrd-mobile-nav{display:none}
        @media(max-width:850px){.xrd-root{grid-template-columns:205px minmax(0,1fr)}.xrd-content{padding:22px 20px 42px}}
        @media(max-width:650px){.xrd-root{display:flex;flex-direction:column}.xrd-sidebar{display:none}.xrd-view{height:100dvh;padding-bottom:60px}.xrd-topbar{height:52px;padding:0 12px;gap:9px}.xrd-owner-tag{font-size:8px}.xrd-content{padding:16px 13px 28px}.xrd-overview-hero{min-height:0;padding:17px}.xrd-hero-identity img,.xrd-hero-identity>span{width:46px;height:46px;font-size:18px}.xrd-hero-identity h2{font-size:17px}.xrd-hero-mark{right:14px;top:14px;width:36px;height:36px;border-radius:11px}.xrd-hero-mark svg{width:22px}.xrd-hero-copy{margin-top:14px!important;font-size:10px}.xrd-stats{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-bottom:22px}.xrd-stat{padding:10px}.xrd-stat strong{font-size:16px}.xrd-stat span{font-size:9px}.xrd-page-heading h2{font-size:21px}.xrd-graph-source{grid-template-columns:minmax(0,1fr);gap:9px}.xrd-graph-links{flex-direction:row;padding-left:7px}.xrd-graph-links i{width:18px}.xrd-oracle-card{align-items:flex-start;flex-wrap:wrap;padding:14px}.xrd-oracle-card>div:nth-child(2){min-width:calc(100% - 66px)}.xrd-oracle-search{flex-basis:calc(100% - 60px)}.xrd-oracle-search>div{flex-direction:column}.xrd-oracle-search .xrd-primary{justify-content:center}.xrd-oracle-card>.xrd-secondary{margin-left:60px}.xrd-detail-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.xrd-edge{grid-template-columns:minmax(0,1fr);gap:6px}.xrd-edge>span{text-align:left;padding-left:8px}.xrd-integrity{align-items:flex-start;flex-direction:column}.xrd-integrity-actions{width:100%}.xrd-trace-row{grid-template-columns:14px minmax(0,1fr)}.xrd-trace-row>b{grid-column:2;text-align:left}.xrd-source{align-items:flex-start;flex-wrap:wrap}.xrd-source-actions{width:100%;justify-content:flex-end}.xrd-remark-submit,.xrd-remark-reply{align-items:stretch;flex-direction:column}.xrd-remark-reply button{align-self:flex-end}.xrd-mobile-nav{position:fixed;z-index:2;bottom:0;left:0;right:0;display:flex;align-items:stretch;justify-content:space-around;padding:5px 4px calc(5px + env(safe-area-inset-bottom));border-top:1px solid #252a24;background:rgba(5,7,5,.97);backdrop-filter:blur(14px)}.xrd-mobile-nav button{display:flex;min-width:0;flex:1;flex-direction:column;align-items:center;justify-content:center;gap:3px;border:0;border-radius:8px;background:transparent;color:#828a7e;font-size:8px;cursor:pointer}.xrd-mobile-nav button.active{background:rgba(163,230,53,.08);color:var(--xrd-ac)}}
      `}</style>
      <style>{`.xrd-root{width:100vw;min-width:0}.xrd-root>.xrd-view{width:100%;min-width:0}.xrd-content{width:100%;min-width:0;box-sizing:border-box}.xrd-content>*{min-width:0;max-width:100%}@media(max-width:850px){.xrd-root{grid-template-columns:minmax(0,205px) minmax(0,1fr)}.xrd-view{min-width:0}.xrd-content{min-width:0}}@media(max-width:650px){.xrd-root{width:100vw;min-width:0;align-items:stretch}.xrd-view{width:100%;min-width:0;flex:1}.xrd-content{width:100%;min-width:0;flex:1;padding:16px 13px 28px}.xrd-overview-hero,.xrd-panel,.xrd-stats,.xrd-page-heading{width:100%;min-width:0;max-width:100%}.xrd-overview-hero{overflow:hidden}.xrd-hero-identity{min-width:0}.xrd-hero-identity>div:last-child{min-width:0}.xrd-question-grid{grid-template-columns:minmax(0,1fr)}}`}</style>
      <style>{`.xrd-root{width:100vw;min-width:0}.xrd-root>.xrd-view{width:100%;min-width:0}.xrd-content{width:100%;min-width:0;box-sizing:border-box}.xrd-content>*{min-width:0;max-width:100%}@media(max-width:850px){.xrd-root{grid-template-columns:minmax(0,205px) minmax(0,1fr)}.xrd-sidebar,.xrd-view{min-width:0}.xrd-content{width:100%;min-width:0}}@media(max-width:650px){.xrd-root{width:100vw;min-width:0;align-items:stretch}.xrd-view{width:100%;min-width:0;flex:1}.xrd-content{width:100%;min-width:0;flex:1;padding:16px 13px 28px}.xrd-overview-hero,.xrd-panel,.xrd-stats,.xrd-page-heading{width:100%;min-width:0;max-width:100%}.xrd-overview-hero{overflow:hidden}.xrd-hero-identity,.xrd-hero-identity>div:last-child{min-width:0}.xrd-hero-identity h2{overflow-wrap:anywhere}.xrd-question-grid{grid-template-columns:minmax(0,1fr)}}`}</style>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');.xrd-root{font-family:'DM Sans',ui-sans-serif,system-ui,sans-serif;background:#000}.xrd-content{background-image:linear-gradient(rgba(163,230,53,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(163,230,53,.025) 1px,transparent 1px);background-size:22px 22px}.xrd-sidebar{background:#000;border-right-color:#2a2d2a}.xrd-nav-label,.xrd-kicker,.xrd-owner-tag,.xrd-status{font-family:'JetBrains Mono',ui-monospace,monospace}.xrd-nav{gap:4px}.xrd-nav button{position:relative;min-height:40px;padding:0 12px;border-radius:12px;transition:background .15s,color .15s,border-color .15s}.xrd-nav button.active{border-color:transparent;background:#0d0d0d;color:var(--xrd-ac)}.xrd-nav button.active:before{position:absolute;left:0;top:50%;width:2px;height:16px;transform:translateY(-50%);border-radius:0 2px 2px 0;background:var(--xrd-ac);box-shadow:0 0 8px var(--xrd-ac);content:""}.xrd-topbar{background:rgba(0,0,0,.94)}.xrd-content{padding-top:24px}.xrd-overview-hero.xrd-prototype-overview{display:flex;align-items:center;gap:22px;min-height:0;padding:22px;border-color:rgba(163,230,53,.45);border-radius:20px;background-color:#000;background-image:linear-gradient(rgba(163,230,53,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(163,230,53,.05) 1px,transparent 1px);background-size:22px 22px;box-shadow:inset 0 0 60px rgba(163,230,53,.05)}.xrd-overview-visual{display:flex;align-items:center;gap:22px;flex:none}.xrd-overview-visual .xrd-hero-avatar{width:132px;height:132px}.xrd-overview-visual .xrd-hero-avatar>img,.xrd-overview-visual .xrd-hero-avatar>span{width:116px;height:116px;border:2px solid #060706;box-shadow:0 0 0 2px rgba(163,230,53,.72),0 0 28px rgba(163,230,53,.3);font-size:38px}.xrd-overview-meter{width:130px;height:130px;flex:none}.xrd-overview-meter svg{display:block;width:100%;height:100%;overflow:visible}.xrd-overview-meter circle{fill:none;stroke:rgba(255,255,255,.08);stroke-width:9}.xrd-overview-meter .xrd-meter-value{stroke:#a3e635;stroke-linecap:round;filter:drop-shadow(0 0 8px #a3e635);transform:rotate(-90deg);transform-origin:65px 65px}.xrd-overview-meter text{fill:#e9f1e4;font-size:28px;font-weight:800;text-anchor:middle}.xrd-overview-meter .xrd-meter-label{fill:#7e8b78;font-size:9px;font-weight:600;letter-spacing:1.2px}.xrd-prototype-overview .xrd-hero-identity{display:block;min-width:220px;flex:1}.xrd-prototype-overview .xrd-hero-identity h2{margin:5px 0;font-size:28px;letter-spacing:0}.xrd-prototype-overview .xrd-hero-identity p{margin:0;color:#cfe8b8;font-size:13px}.xrd-prototype-copy{max-width:62ch;margin:12px 0 0!important;color:#a8b0a3!important;font-size:13px!important;line-height:1.55}.xrd-overview-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}.xrd-photo-trigger{right:-2px;bottom:2px;width:40px;height:40px;padding:0;justify-content:center;border:2px solid #060706;border-radius:50%;background:#a3e635;color:#06100a;box-shadow:0 0 18px rgba(163,230,53,.35)}.xrd-photo-trigger b{font-size:10px}.xrd-stats{gap:10px;margin:14px 0 24px}.xrd-stat{display:block;padding:12px;border-color:#2a2d2a;border-radius:12px;background:#000;text-align:center}.xrd-stat svg{display:none}.xrd-stat strong{display:block;font-size:22px}.xrd-stat span{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:9px;letter-spacing:.09em;text-transform:uppercase}.xrd-panel{border-color:#2a2d2a;border-radius:16px;background:linear-gradient(180deg,#050605,#000);box-shadow:inset 0 1px 0 rgba(255,255,255,.035)}.xrd-section-heading{margin-top:20px}.xrd-section-heading h3{font-size:15px}.xrd-question-grid button{min-height:118px;flex-direction:column;align-items:stretch;justify-content:space-between;padding:14px;border-color:#2a2d2a;border-radius:16px;background:radial-gradient(120% 140% at 100% 0%,rgba(163,230,53,.07),transparent 60%),linear-gradient(180deg,#0a0c0a,#000);transition:transform .2s,border-color .2s,box-shadow .25s}.xrd-question-grid button:hover{border-color:rgba(163,230,53,.55);transform:translateY(-2px);box-shadow:0 10px 24px -14px #a3e635}.xrd-question-icon{width:38px;height:38px;border-radius:11px;background:#0a0a0a}.xrd-question-grid b{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.08em}.xrd-question-grid small{font-size:11px}.xrd-record{border-color:#2a2d2a;border-radius:14px;background-color:#000;background-image:radial-gradient(rgba(255,255,255,.07) 1px,transparent 1px);background-size:14px 14px}.xrd-root .xrd-record-button:hover{border-color:rgba(163,230,53,.55);transform:translateY(-1px)}`}</style>
      <style>{`.xrd-prototype-heading{position:relative;display:flex;align-items:flex-start;gap:14px;margin-bottom:22px;padding-bottom:16px}.xrd-prototype-heading:after{position:absolute;right:0;bottom:0;left:0;height:1px;background:linear-gradient(90deg,var(--xrd-ac),rgba(163,230,53,.15) 30%,transparent);content:""}.xrd-heading-mark{width:56px;height:62px;flex:none;display:grid;place-items:center;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);background:linear-gradient(135deg,#a3e635,#10b981)}.xrd-heading-mark>span{width:52px;height:58px;display:grid;place-items:center;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);background:#050805;color:#a3e635}.xrd-prototype-heading h2{margin:0 0 5px;font-size:28px;letter-spacing:0}.xrd-prototype-heading p{margin:0;color:#8d9589;font-size:12px;line-height:1.55}.xrd-prototype-heading>div:last-child{min-width:0;flex:1}@media(max-width:650px){.xrd-overview-hero.xrd-prototype-overview{align-items:flex-start;flex-direction:column;gap:16px;padding:18px}.xrd-overview-visual{width:100%;justify-content:flex-start;gap:16px}.xrd-overview-visual .xrd-hero-avatar{width:112px;height:112px}.xrd-overview-visual .xrd-hero-avatar>img,.xrd-overview-visual .xrd-hero-avatar>span{width:100px;height:100px;font-size:34px}.xrd-overview-meter{width:108px;height:108px}.xrd-prototype-overview .xrd-hero-identity{width:100%;min-width:0}.xrd-prototype-overview .xrd-hero-identity h2{font-size:22px;overflow-wrap:anywhere}.xrd-prototype-copy{font-size:11px!important}.xrd-overview-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.xrd-overview-actions>*{justify-content:center;min-width:0;padding:9px 7px;font-size:10px}.xrd-prototype-heading h2{font-size:22px}.xrd-heading-mark{width:48px;height:54px}.xrd-heading-mark>span{width:44px;height:50px}.xrd-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.xrd-question-grid button{min-height:0;flex-direction:row;align-items:center;justify-content:flex-start}.xrd-question-grid button>span:nth-child(2){flex:1}.xrd-question-grid button>svg:last-child{flex:none}}`}</style>
      <style>{`.xrd-prototype-heading{position:relative;display:flex;align-items:flex-start;gap:14px;margin-bottom:22px;padding-bottom:16px}.xrd-prototype-heading:after{position:absolute;right:0;bottom:0;left:0;height:1px;background:linear-gradient(90deg,var(--xrd-ac),rgba(163,230,53,.15) 30%,transparent);content:""}.xrd-heading-mark{width:56px;height:62px;flex:none;display:grid;place-items:center;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);background:linear-gradient(135deg,#a3e635,#10b981)}.xrd-heading-mark>span{width:52px;height:58px;display:grid;place-items:center;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);background:#050805;color:#a3e635}.xrd-prototype-heading h2{margin:0 0 5px;font-size:28px;letter-spacing:0}.xrd-prototype-heading p{margin:0;color:#8d9589;font-size:12px;line-height:1.55}.xrd-heading-copy{min-width:0;flex:1}.xrd-mobile-more-backdrop{position:fixed;inset:0;z-index:100052;border:0;background:rgba(0,0,0,.72);backdrop-filter:blur(5px)}.xrd-mobile-more-sheet{position:fixed;right:0;bottom:0;left:0;z-index:100053;max-height:min(78dvh,680px);overflow:auto;padding:12px 16px calc(24px + env(safe-area-inset-bottom));border:1px solid #2a2d2a;border-bottom:0;border-radius:22px 22px 0 0;background:#050605;box-shadow:0 -24px 70px rgba(0,0,0,.7);animation:xrd-mobile-sheet-up .24s cubic-bezier(.2,.9,.3,1)}@keyframes xrd-mobile-sheet-up{from{transform:translateY(100%)}}.xrd-mobile-more-grab{width:40px;height:4px;margin:0 auto 15px;border-radius:4px;background:#3a3e3a}.xrd-mobile-more-sheet>header{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}.xrd-mobile-more-sheet h2{margin:3px 0 0;font-size:19px}.xrd-mobile-more-sheet>header button{width:34px;height:34px;display:grid;place-items:center;border:1px solid #2a2d2a;border-radius:50%;background:#000;color:#dce5d7}.xrd-mobile-more-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.xrd-mobile-more-grid button{display:flex;min-width:0;min-height:82px;flex-direction:column;align-items:center;justify-content:center;gap:9px;padding:10px 6px;border:1px solid #2a2d2a;border-radius:14px;background:linear-gradient(180deg,#0a0c0a,#000);color:#c4cbbf;font-size:11px;font-weight:600}.xrd-mobile-more-grid button svg{color:#a3e635}.xrd-mobile-more-grid button.active{border-color:rgba(163,230,53,.55);background:rgba(163,230,53,.08);color:#a3e635}@media(max-width:650px){.xrd-prototype-heading h2{font-size:22px}.xrd-heading-mark{width:48px;height:54px}.xrd-heading-mark>span{width:44px;height:50px}.xrd-mobile-nav{grid-template-columns:repeat(5,minmax(0,1fr))}.xrd-mobile-nav button{min-width:0;font-size:9px}.xrd-mobile-more-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}`}</style>
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
          <button type="button" className={mobileMenuOpen ? "active" : ""} onClick={() => setMobileMenuOpen(true)}><MoreHorizontal size={17} />More</button>
        </nav>
      </main>
      {mobileMenuOpen && <><button type="button" className="xrd-mobile-more-backdrop" aria-label="Close XRD sections" onClick={() => setMobileMenuOpen(false)} /><section className="xrd-mobile-more-sheet" role="dialog" aria-modal="true" aria-label="All XRD sections"><div className="xrd-mobile-more-grab" /><header><div><span className="xrd-kicker">XEEVIA RECORD</span><h2>All sections</h2></div><button type="button" aria-label="Close" onClick={() => setMobileMenuOpen(false)}><X size={17} /></button></header><div className="xrd-mobile-more-grid">{NAV_GROUPS.flatMap(([group, names]) => names.filter((name) => own || !OWNER_ONLY.has(name)).map((name) => { const Icon = NAV.find(([navName]) => navName === name)?.[1] || Sparkles; const label = name === "Oracle" ? "XRC Oracle" : name; return <button type="button" key={`${group}-${name}`} className={section === name ? "active" : ""} onClick={() => { setMobileMenuOpen(false); navigateSection(name); }}><Icon size={20} /><span>{label}</span></button>; }))}</div></section></>}
      {oracleChatOpen && <section className="xrd-oracle-chat" role="dialog" aria-modal="true" aria-label="XRD evidence chat">
        <header><button type="button" className="xrd-chat-back" onClick={() => setOracleChatOpen(false)} aria-label="Close evidence chat"><ArrowLeft size={18} /></button><div className="xrd-chat-mark"><Sparkles size={17} /></div><div className="xrd-chat-heading"><strong>XRD Evidence Oracle</strong><small>{evidenceItems.length} available evidence items · text matches only</small></div><button type="button" className="xrd-chat-close" onClick={() => setOracleConversation([])} aria-label="Clear conversation"><X size={16} /></button></header>
        <div className="xrd-chat-background" aria-hidden="true"><i /><i /><div /></div>
        <div className="xrd-chat-body">
          {!oracleConversation.length && <div className="xrd-chat-welcome"><div className="xrd-chat-orb"><Sparkles size={28} /></div><h2>Ask your evidence</h2><p>Answers use only accessible records and show the matches used. No claim is inferred or re-verified here.</p>
            <div>{["Find education evidence", "Search project evidence", "Find employment evidence", "Search GitHub records"].map((question) => <button type="button" key={question} onClick={() => { askEvidence(question); }}>{question}<ChevronRight size={13} /></button>)}</div>
          </div>}
          {oracleConversation.map((turn) => <article className="xrd-chat-turn" key={turn.id}>
            <div className="xrd-chat-user">{turn.query}</div>
            <div className="xrd-chat-answer"><div className="xrd-chat-answer-meta"><span className="xrd-chat-mark"><Sparkles size={13} /></span><strong>Evidence search</strong><span>{turn.matches.length + turn.recordMatches.length} matches</span></div><p>{turn.response}</p>
              {turn.matches.map((item) => <button type="button" key={item.id} onClick={() => { setOracleChatOpen(false); setSelectedEvidence(item); }}><FileText size={13} /><span>{item.title || item.evidence_type || "Evidence"} · {item.provider || "Unknown source"}</span><span className="xrd-status">{normalizeStatus(item)}</span></button>)}
              {turn.recordMatches.map((record) => <button type="button" key={record.record_id} onClick={() => { setOracleChatOpen(false); navigateSection("Chains"); }}><GitBranch size={13} /><span>{record.payload?.event?.replaceAll("_", " ") || record.stream_type} · {record.record_id}</span><span className="xrd-status">XRC event</span></button>)}
            </div>
          </article>)}
        </div>
        <form className="xrd-chat-compose" onSubmit={(event) => { event.preventDefault(); askEvidence(); setOracleQuery(""); }}><Sparkles size={17} /><input autoFocus value={oracleQuery} onChange={(event) => setOracleQuery(event.target.value)} placeholder="Ask about accessible evidence…" aria-label="Ask XRD Evidence Oracle" /><button type="submit" className="xrd-primary" disabled={!oracleQuery.trim()} aria-label="Send question"><Send size={15} /></button></form>
      </section>}
    </div>,
    document.body,
  );
};

const SectionHeading = ({ title, subtitle }) => {
  const Icon = NAV.find(([name]) => name === title || (title === "Evidence graph" && name === "Graph") || (title === "XRC Oracle" && name === "Oracle"))?.[1] || Layers3;
  return (
    <div className="xrd-page-heading xrd-prototype-heading">
      <div className="xrd-heading-mark"><span><Icon size={18} /></span></div>
      <div><span className="xrd-kicker">XEEVIA RECORD</span><h2>{title}</h2><p>{subtitle}</p></div>
    </div>
  );
};

const SearchBox = ({ value, onChange, placeholder }) => (
  <label className="xrd-search"><Search size={15} /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>
);

const EmptyState = ({ text }) => <div className="xrd-empty"><Database size={20} /><span>{text}</span></div>;

const RestrictedState = () => (
  <div className="xrd-restricted"><LockKeyhole size={18} /><div><strong>Owner-only section</strong><p>Private XRC activity and controls are only available to the profile owner. Public views only show evidence permitted by the data access policy.</p></div></div>
);

export default XRDProfileDashboard;
