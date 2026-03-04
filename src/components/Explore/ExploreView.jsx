// ============================================================================
// src/components/Explore/ExploreView.jsx
// ORACLE EDITION — Full content search + XRC Chain Explorer
//
// WHAT'S NEW (additive only — original search/content unchanged):
//   1. XRC Oracle tab — chain explorer with live feed, stream search,
//      actor trace, integrity verification, chain visualization
//   2. User cards are now clickable → opens UserProfileModal
//   3. Oracle search modes: by stream, actor, event, time range, payload
//   4. Real-time XRC activity feed
//   5. Chain health dashboard
//
// UNCHANGED: All existing post/reel/story/user/tag search functionality
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Search, Filter, ChevronDown, X, Loader, Hash, AtSign,
  User, ChevronRight, BookOpen, Film, FileText,
  Link2, Shield, Activity, Database, Clock, Zap,
  Eye, AlertTriangle, CheckCircle, RefreshCw, TrendingUp,
  Lock, Unlock, ArrowRight, Copy, Check
} from "lucide-react";
import exploreService from "../../services/explore/exploreService";
import mediaUrlService from "../../services/shared/mediaUrlService";
import PostCard from "../Home/PostCard";
import ReelCard from "../Home/ReelCard";
import StoryCard from "../Home/StoryCard";
import ProfilePreview from "../Shared/ProfilePreview";
import { STREAM_REGISTRY, listStreams } from "../../services/xrc/streamRegistry";

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) => (n || 0).toLocaleString();
const timeAgo = (ms) => {
  if (!ms) return "never";
  const diff = Date.now() - (typeof ms === "string" ? new Date(ms).getTime() : ms);
  if (diff < 60000)   return `${Math.floor(diff/1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
  return `${Math.floor(diff/86400000)}d ago`;
};
const truncHash = (h, n = 8) => h ? `${h.slice(0, n)}…${h.slice(-4)}` : "—";

// ── CopyButton ────────────────────────────────────────────────────────────────
const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button onClick={copy} className="xo-copy-btn" title="Copy">
      {copied ? <Check size={11} color="#84cc16" /> : <Copy size={11} />}
    </button>
  );
};

// ── SubSection (collapsible) ──────────────────────────────────────────────────
const SubSection = ({ icon: Icon, label, count, children }) => {
  const [open, setOpen] = useState(true);
  if (!count) return null;
  return (
    <div className="xpl-subsection">
      <button className="xpl-subsection-hd" onClick={() => setOpen(o => !o)}>
        <span className="xpl-subsection-left">
          <Icon size={15} />{label}<span className="xpl-badge">{count}</span>
        </span>
        <ChevronRight size={14} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform .2s" }} />
      </button>
      {open && <div className="xpl-subsection-body">{children}</div>}
    </div>
  );
};

// ── UserContextPanel ──────────────────────────────────────────────────────────
const UserContextPanel = ({ userContext, currentUser, onAuthorClick, onActionMenu }) => {
  const [activeTab, setActiveTab] = useState("mentioned");
  if (!userContext) return null;
  const { resolvedUser, mentionedInPosts, mentionedInReels, mentionedInStories, byUser } = userContext;
  const mentionedTotal = (mentionedInPosts?.length || 0) + (mentionedInReels?.length || 0) + (mentionedInStories?.length || 0);
  const authoredTotal  = (byUser?.posts?.length || 0) + (byUser?.reels?.length || 0) + (byUser?.stories?.length || 0);
  if (mentionedTotal === 0 && authoredTotal === 0) return null;
  const avatarUrl = resolvedUser.avatar_id ? mediaUrlService.getAvatarUrl(resolvedUser.avatar_id) : null;

  return (
    <div className="xpl-user-ctx">
      <div className="xpl-ctx-identity" onClick={() => onAuthorClick?.(resolvedUser)}>
        <div className="xpl-ctx-avatar">
          {avatarUrl ? <img src={avatarUrl} alt={resolvedUser.full_name} /> : resolvedUser.full_name?.[0]?.toUpperCase() || "U"}
        </div>
        <div className="xpl-ctx-info">
          <div className="xpl-ctx-name">{resolvedUser.full_name}{resolvedUser.verified && <span className="xpl-verified">✓</span>}</div>
          <div className="xpl-ctx-un">@{resolvedUser.username}</div>
          {resolvedUser.bio && <div className="xpl-ctx-bio">{resolvedUser.bio}</div>}
        </div>
        <div className="xpl-ctx-stats">
          {mentionedTotal > 0 && <span className="xpl-ctx-stat"><span>{mentionedTotal}</span> mentions</span>}
          {authoredTotal  > 0 && <span className="xpl-ctx-stat"><span>{authoredTotal}</span> posts</span>}
        </div>
      </div>
      <div className="xpl-ctx-tabs">
        {mentionedTotal > 0 && <button className={`xpl-ctx-tab ${activeTab === "mentioned" ? "active" : ""}`} onClick={() => setActiveTab("mentioned")}>Mentioned in ({mentionedTotal})</button>}
        {authoredTotal  > 0 && <button className={`xpl-ctx-tab ${activeTab === "authored"  ? "active" : ""}`} onClick={() => setActiveTab("authored") }>Posted by them ({authoredTotal})</button>}
      </div>
      <div className="xpl-ctx-content">
        {activeTab === "mentioned" && <>
          {mentionedInPosts?.length   > 0 && <SubSection icon={FileText} label="Posts"   count={mentionedInPosts.length}>{mentionedInPosts.map(p => <PostCard key={p.id} post={p} currentUser={currentUser} onAuthorClick={onAuthorClick} onActionMenu={onActionMenu} />)}</SubSection>}
          {mentionedInReels?.length   > 0 && <SubSection icon={Film}     label="Reels"   count={mentionedInReels.length}><div className="xpl-reels-grid">{mentionedInReels.map((r,i) => <ReelCard key={r.id} reel={r} currentUser={currentUser} onAuthorClick={onAuthorClick} onActionMenu={onActionMenu} index={i} />)}</div></SubSection>}
          {mentionedInStories?.length > 0 && <SubSection icon={BookOpen} label="Stories" count={mentionedInStories.length}>{mentionedInStories.map(s => <StoryCard key={s.id} story={s} currentUser={currentUser} onAuthorClick={onAuthorClick} onActionMenu={onActionMenu} />)}</SubSection>}
        </>}
        {activeTab === "authored" && <>
          {byUser?.posts?.length   > 0 && <SubSection icon={FileText} label="Posts"   count={byUser.posts.length}>{byUser.posts.map(p => <PostCard key={p.id} post={p} currentUser={currentUser} onAuthorClick={onAuthorClick} onActionMenu={onActionMenu} />)}</SubSection>}
          {byUser?.reels?.length   > 0 && <SubSection icon={Film}     label="Reels"   count={byUser.reels.length}><div className="xpl-reels-grid">{byUser.reels.map((r,i) => <ReelCard key={r.id} reel={r} currentUser={currentUser} onAuthorClick={onAuthorClick} onActionMenu={onActionMenu} index={i} />)}</div></SubSection>}
          {byUser?.stories?.length > 0 && <SubSection icon={BookOpen} label="Stories" count={byUser.stories.length}>{byUser.stories.map(s => <StoryCard key={s.id} story={s} currentUser={currentUser} onAuthorClick={onAuthorClick} onActionMenu={onActionMenu} />)}</SubSection>}
        </>}
      </div>
    </div>
  );
};

// ── XRC Record Card ───────────────────────────────────────────────────────────
const XRCRecordCard = ({ record, onTrace, onVerify }) => {
  const stream = STREAM_REGISTRY[record.stream_type] || {};
  const event  = record.payload?.event || "unknown";
  return (
    <div className="xo-record-card">
      <div className="xo-record-top">
        <span className="xo-stream-badge" style={{ borderColor: stream.color, color: stream.color }}>
          {stream.icon} {record.stream_type}
        </span>
        <span className="xo-record-event">{event}</span>
        <span className="xo-record-time">{timeAgo(record.timestamp)}</span>
      </div>
      <div className="xo-record-hashes">
        <span className="xo-hash-row">
          <span className="xo-hash-label">HASH</span>
          <code className="xo-hash">{truncHash(record.record_hash)}</code>
          <CopyButton text={record.record_hash} />
        </span>
        <span className="xo-hash-row">
          <span className="xo-hash-label">PREV</span>
          <code className="xo-hash">{truncHash(record.previous_hash)}</code>
        </span>
      </div>
      {record.payload && Object.keys(record.payload).length > 1 && (
        <div className="xo-record-payload">
          {Object.entries(record.payload)
            .filter(([k]) => k !== 'event')
            .slice(0, 3)
            .map(([k, v]) => (
              <span key={k} className="xo-payload-kv">
                <span className="xo-pk">{k}:</span>
                <span className="xo-pv">{String(v).slice(0, 40)}</span>
              </span>
            ))}
        </div>
      )}
      <div className="xo-record-actions">
        <button className="xo-rec-btn" onClick={() => onTrace?.(record.record_id)}>
          <Link2 size={12} /> Trace
        </button>
        <button className="xo-rec-btn" onClick={() => onVerify?.(record.record_id)}>
          <Shield size={12} /> Verify
        </button>
        <span className="xo-actor-id">actor: {truncHash(record.actor_id, 6)}</span>
      </div>
    </div>
  );
};

// ── Stream Health Card ────────────────────────────────────────────────────────
const StreamHealthCard = ({ stream, onClick }) => {
  const meta = STREAM_REGISTRY[stream.stream_type] || {};
  const count = stream.record_count || 0;
  return (
    <div className="xo-stream-card" onClick={() => onClick?.(stream.stream_type)} style={{ '--sc': meta.color || '#84cc16' }}>
      <div className="xo-stream-icon">{meta.icon || '📦'}</div>
      <div className="xo-stream-info">
        <div className="xo-stream-type">{stream.stream_type}</div>
        <div className="xo-stream-label">{meta.label}</div>
        <div className="xo-stream-count">{fmt(count)} records</div>
      </div>
      {stream.last_updated_at && (
        <div className="xo-stream-time">{timeAgo(stream.last_updated_at)}</div>
      )}
      {stream.is_genesis && (
        <div className="xo-stream-genesis">GENESIS</div>
      )}
    </div>
  );
};

// ── Chain Trace Visualizer ────────────────────────────────────────────────────
const ChainTrace = ({ chain, reachedGenesis, onClose }) => {
  if (!chain || chain.length === 0) return null;
  return (
    <div className="xo-trace-panel">
      <div className="xo-trace-header">
        <div className="xo-trace-title"><Link2 size={16} /> Chain Trace</div>
        <button className="xo-close-btn" onClick={onClose}><X size={16} /></button>
      </div>
      <div className="xo-trace-chain">
        {chain.map((rec, i) => {
          const stream = STREAM_REGISTRY[rec.stream_type] || {};
          return (
            <div key={rec.record_id} className="xo-trace-node">
              <div className="xo-trace-connector">
                {i < chain.length - 1 && <div className="xo-trace-line" />}
              </div>
              <div className={`xo-trace-block ${rec._hashValid ? "valid" : "invalid"}`}>
                <div className="xo-tb-top">
                  <span className="xo-tb-stream" style={{ color: stream.color }}>{stream.icon} {rec.stream_type}</span>
                  <span className="xo-tb-depth">#{rec._depth}</span>
                  {rec._hashValid
                    ? <CheckCircle size={13} color="#84cc16" />
                    : <AlertTriangle size={13} color="#f87171" />
                  }
                </div>
                <div className="xo-tb-hash"><code>{truncHash(rec.record_hash)}</code></div>
                <div className="xo-tb-event">{rec.payload?.event || "—"}</div>
                <div className="xo-tb-time">{timeAgo(rec.timestamp)}</div>
              </div>
            </div>
          );
        })}
        {reachedGenesis && (
          <div className="xo-trace-genesis">
            <div className="xo-trace-line" />
            <div className="xo-genesis-block">⛓️ GENESIS</div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Verify Result Panel ───────────────────────────────────────────────────────
const VerifyResult = ({ result, onClose }) => {
  if (!result) return null;
  const isValid = result.status === "valid";
  return (
    <div className={`xo-verify-panel ${isValid ? "valid" : "invalid"}`}>
      <div className="xo-verify-header">
        <div className="xo-verify-title">
          {isValid
            ? <><CheckCircle size={16} color="#84cc16" /> Integrity Verified</>
            : <><AlertTriangle size={16} color="#f87171" /> Integrity Failure</>
          }
        </div>
        <button className="xo-close-btn" onClick={onClose}><X size={16} /></button>
      </div>
      <div className="xo-verify-status">Status: <strong style={{ color: isValid ? "#84cc16" : "#f87171" }}>{result.status?.toUpperCase()}</strong></div>
      {result.record && <>
        <div className="xo-verify-row"><span>Stream:</span><span>{result.record.stream_type}</span></div>
        <div className="xo-verify-row"><span>Actor:</span><code>{truncHash(result.record.actor_id, 8)}</code></div>
        <div className="xo-verify-row"><span>Hash:</span><code>{truncHash(result.record.record_hash, 12)}</code></div>
        <div className="xo-verify-row"><span>Time:</span><span>{new Date(result.record.timestamp).toLocaleString()}</span></div>
      </>}
    </div>
  );
};

// ── XRC Oracle Panel ──────────────────────────────────────────────────────────
const XRCOraclePanel = ({ xrcService, currentUserId }) => {
  const [oracleMode, setOracleMode]         = useState("feed");      // feed | streams | search | actor | validate
  const [chainStats, setChainStats]         = useState(null);
  const [streamHeads, setStreamHeads]       = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading]               = useState(false);
  const [searchParams, setSearchParams]     = useState({ streamType: "", actorId: "", eventType: "", searchTerm: "", fromDate: "", toDate: "" });
  const [searchResults, setSearchResults]   = useState(null);
  const [traceResult, setTraceResult]       = useState(null);
  const [verifyResult, setVerifyResult]     = useState(null);
  const [validateResult, setValidateResult] = useState(null);
  const [selectedStream, setSelectedStream] = useState("");
  const [actorQuery, setActorQuery]         = useState("");
  const [traceId, setTraceId]               = useState("");
  const [verifyId, setVerifyId]             = useState("");
  const [chainValidating, setChainValidating] = useState(false);

  // Load initial data
  useEffect(() => {
    if (!xrcService) return;
    loadOverview();
  }, [xrcService]);

  const loadOverview = async () => {
    if (!xrcService) return;
    setLoading(true);
    try {
      const [stats, heads, recent] = await Promise.all([
        xrcService.getChainStats().catch(() => null),
        xrcService.getAllStreamHeads().catch(() => []),
        xrcService.getRecentActivity(30).catch(() => []),
      ]);
      setChainStats(stats);
      setStreamHeads(heads);
      setRecentActivity(recent);
    } catch (e) {
      console.error("[Oracle] loadOverview:", e);
    } finally {
      setLoading(false);
    }
  };

  const doSearch = async () => {
    if (!xrcService) return;
    setLoading(true);
    try {
      const params = {
        streamType: searchParams.streamType || undefined,
        actorId:    searchParams.actorId    || undefined,
        eventType:  searchParams.eventType  || undefined,
        searchTerm: searchParams.searchTerm || undefined,
        fromTimestamp: searchParams.fromDate ? new Date(searchParams.fromDate).getTime() : undefined,
        toTimestamp:   searchParams.toDate   ? new Date(searchParams.toDate).getTime()   : undefined,
        limit: 50,
      };
      const results = await xrcService.searchRecords(params);
      setSearchResults(results);
    } catch (e) {
      console.error("[Oracle] search:", e);
    } finally {
      setLoading(false);
    }
  };

  const doTrace = async (id = traceId) => {
    if (!xrcService || !id) return;
    setLoading(true);
    try {
      const result = await xrcService.traceHistory(id.trim(), 30);
      setTraceResult(result);
    } catch (e) {
      console.error("[Oracle] trace:", e);
    } finally {
      setLoading(false);
    }
  };

  const doVerify = async (id = verifyId) => {
    if (!xrcService || !id) return;
    setLoading(true);
    try {
      const result = await xrcService.verifyRecord(id.trim());
      setVerifyResult(result);
    } catch (e) {
      console.error("[Oracle] verify:", e);
    } finally {
      setLoading(false);
    }
  };

  const doValidateChain = async () => {
    if (!xrcService || !selectedStream) return;
    setChainValidating(true);
    try {
      const result = await xrcService.validateChain(selectedStream, 500);
      setValidateResult(result);
    } catch (e) {
      console.error("[Oracle] validate:", e);
    } finally {
      setChainValidating(false);
    }
  };

  const doActorSearch = async () => {
    if (!xrcService || !actorQuery.trim()) return;
    setLoading(true);
    try {
      const results = await xrcService.getActorHistory(actorQuery.trim(), 50);
      setSearchResults({ records: results, total: results.length, fromActor: true });
    } catch (e) {
      console.error("[Oracle] actorSearch:", e);
    } finally {
      setLoading(false);
    }
  };

  const streams = listStreams();

  const modes = [
    { id: "feed",     label: "Live Feed",  icon: Activity },
    { id: "streams",  label: "Streams",    icon: Database },
    { id: "search",   label: "Search",     icon: Search },
    { id: "actor",    label: "Actor Trace",icon: User },
    { id: "validate", label: "Validate",   icon: Shield },
  ];

  return (
    <div className="xo-oracle">
      {/* Oracle Header */}
      <div className="xo-header">
        <div className="xo-header-top">
          <div className="xo-oracle-title">
            <Link2 size={20} />
            <span>XRC Oracle</span>
            <span className="xo-oracle-sub">Chain of Chains Explorer</span>
          </div>
          <button className="xo-refresh-btn" onClick={loadOverview} disabled={loading}>
            <RefreshCw size={14} className={loading ? "xo-spin" : ""} />
          </button>
        </div>

        {/* Stats bar */}
        {chainStats && (
          <div className="xo-stats-bar">
            <div className="xo-stat"><span>{fmt(chainStats.totalRecords || chainStats.total_records)}</span><label>Total Records</label></div>
            <div className="xo-stat"><span>{chainStats.streams || Object.keys(chainStats.byStream || chainStats.by_stream || {}).length}</span><label>Active Streams</label></div>
            <div className="xo-stat"><span>{timeAgo(chainStats.lastActivity || chainStats.last_activity)}</span><label>Last Activity</label></div>
            <div className="xo-stat xo-stat-health"><CheckCircle size={14} color="#84cc16" /><label>Chain Healthy</label></div>
          </div>
        )}

        {/* Mode tabs */}
        <div className="xo-mode-tabs">
          {modes.map(m => (
            <button key={m.id} className={`xo-mode-tab ${oracleMode === m.id ? "active" : ""}`} onClick={() => setOracleMode(m.id)}>
              <m.icon size={14} /> {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Oracle Content */}
      <div className="xo-body">

        {/* ── LIVE FEED ── */}
        {oracleMode === "feed" && (
          <div className="xo-feed">
            <div className="xo-feed-title"><Activity size={15} /> Real-Time Activity</div>
            {loading ? (
              <div className="xo-loading"><Loader size={24} className="xo-spin" /></div>
            ) : recentActivity.length === 0 ? (
              <div className="xo-empty-state">No chain activity yet. Records will appear here once users interact with the platform in production.</div>
            ) : (
              <div className="xo-feed-list">
                {recentActivity.map(rec => (
                  <XRCRecordCard key={rec.record_id} record={rec} onTrace={doTrace} onVerify={doVerify} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── STREAMS ── */}
        {oracleMode === "streams" && (
          <div className="xo-streams">
            <div className="xo-streams-title"><Database size={15} /> Chain of Chains — 7 Streams</div>
            <div className="xo-streams-grid">
              {streamHeads.length > 0
                ? streamHeads.map(s => <StreamHealthCard key={s.stream_type} stream={s} onClick={(st) => { setSelectedStream(st); setOracleMode("validate"); }} />)
                : streams.map(s => (
                  <StreamHealthCard key={s.type} stream={{ stream_type: s.type, record_count: 0, is_genesis: true }} onClick={(st) => { setSelectedStream(st); setOracleMode("validate"); }} />
                ))
              }
            </div>

            {/* Chain HEAD detail */}
            {streamHeads.length > 0 && (
              <div className="xo-chain-heads">
                <div className="xo-ch-title">Stream HEAD Hashes</div>
                {streamHeads.map(s => {
                  const meta = STREAM_REGISTRY[s.stream_type] || {};
                  return (
                    <div key={s.stream_type} className="xo-ch-row">
                      <span className="xo-ch-stream" style={{ color: meta.color }}>{meta.icon} {s.stream_type}</span>
                      <code className="xo-ch-hash">{truncHash(s.current_head_hash, 12)}</code>
                      <CopyButton text={s.current_head_hash} />
                      <span className="xo-ch-count">{fmt(s.record_count)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── SEARCH ── */}
        {oracleMode === "search" && (
          <div className="xo-search-panel">
            <div className="xo-sp-title"><Search size={15} /> Oracle Search</div>
            <div className="xo-search-grid">
              <div className="xo-field">
                <label>Stream</label>
                <select value={searchParams.streamType} onChange={e => setSearchParams(p => ({ ...p, streamType: e.target.value }))} className="xo-select">
                  <option value="">All Streams</option>
                  {streams.map(s => <option key={s.type} value={s.type}>{s.icon} {s.type} — {s.label}</option>)}
                </select>
              </div>
              <div className="xo-field">
                <label>Event Type</label>
                <input className="xo-input" placeholder="e.g. post_created" value={searchParams.eventType} onChange={e => setSearchParams(p => ({ ...p, eventType: e.target.value }))} />
              </div>
              <div className="xo-field">
                <label>Actor UUID</label>
                <input className="xo-input" placeholder="User UUID (partial OK)" value={searchParams.actorId} onChange={e => setSearchParams(p => ({ ...p, actorId: e.target.value }))} />
              </div>
              <div className="xo-field">
                <label>Payload Search</label>
                <input className="xo-input" placeholder="Search inside payload JSON" value={searchParams.searchTerm} onChange={e => setSearchParams(p => ({ ...p, searchTerm: e.target.value }))} />
              </div>
              <div className="xo-field">
                <label>From Date</label>
                <input className="xo-input" type="date" value={searchParams.fromDate} onChange={e => setSearchParams(p => ({ ...p, fromDate: e.target.value }))} />
              </div>
              <div className="xo-field">
                <label>To Date</label>
                <input className="xo-input" type="date" value={searchParams.toDate} onChange={e => setSearchParams(p => ({ ...p, toDate: e.target.value }))} />
              </div>
            </div>
            <button className="xo-action-btn" onClick={doSearch} disabled={loading}>
              {loading ? <Loader size={14} className="xo-spin" /> : <Search size={14} />} Search Chain
            </button>

            {searchResults && (
              <div className="xo-search-results">
                <div className="xo-sr-header">
                  {searchResults.total > 0
                    ? <span>{fmt(searchResults.total)} record{searchResults.total !== 1 ? "s" : ""} found</span>
                    : <span>No records match your query</span>
                  }
                </div>
                <div className="xo-feed-list">
                  {(searchResults.records || []).map(rec => (
                    <XRCRecordCard key={rec.record_id} record={rec} onTrace={doTrace} onVerify={doVerify} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ACTOR TRACE ── */}
        {oracleMode === "actor" && (
          <div className="xo-actor-panel">
            <div className="xo-sp-title"><User size={15} /> Actor Chain Trace</div>
            <div className="xo-actor-search">
              <input
                className="xo-input xo-input-wide"
                placeholder="Paste User UUID to see their full chain history…"
                value={actorQuery}
                onChange={e => setActorQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && doActorSearch()}
              />
              <button className="xo-action-btn" onClick={doActorSearch} disabled={loading || !actorQuery}>
                {loading ? <Loader size={14} className="xo-spin" /> : <ArrowRight size={14} />} Trace Actor
              </button>
            </div>
            {currentUserId && (
              <button className="xo-my-history-btn" onClick={() => { setActorQuery(currentUserId); doActorSearch(); }}>
                <Eye size={13} /> View My Chain History
              </button>
            )}

            <div className="xo-record-trace-section">
              <div className="xo-sp-title" style={{ marginTop: 20 }}><Link2 size={15} /> Record Trace (by Record ID)</div>
              <div className="xo-actor-search">
                <input className="xo-input xo-input-wide" placeholder="Paste Record ID to trace its chain history…" value={traceId} onChange={e => setTraceId(e.target.value)} onKeyDown={e => e.key === "Enter" && doTrace()} />
                <button className="xo-action-btn" onClick={() => doTrace()} disabled={loading || !traceId}>
                  {loading ? <Loader size={14} className="xo-spin" /> : <Link2 size={14} />} Trace Record
                </button>
              </div>
            </div>

            {searchResults?.fromActor && (
              <div className="xo-search-results">
                <div className="xo-sr-header">{fmt(searchResults.total)} records by this actor</div>
                <div className="xo-feed-list">
                  {searchResults.records.map(rec => (
                    <XRCRecordCard key={rec.record_id} record={rec} onTrace={doTrace} onVerify={doVerify} />
                  ))}
                </div>
              </div>
            )}

            {traceResult && (
              <ChainTrace chain={traceResult.chain} reachedGenesis={traceResult.reachedGenesis} onClose={() => setTraceResult(null)} />
            )}
          </div>
        )}

        {/* ── VALIDATE ── */}
        {oracleMode === "validate" && (
          <div className="xo-validate-panel">
            <div className="xo-sp-title"><Shield size={15} /> Chain Integrity Validation</div>

            <div className="xo-validate-section">
              <div className="xo-val-label">Validate Full Stream</div>
              <div className="xo-actor-search">
                <select className="xo-select xo-select-wide" value={selectedStream} onChange={e => setSelectedStream(e.target.value)}>
                  <option value="">Select a stream…</option>
                  {streams.map(s => <option key={s.type} value={s.type}>{s.icon} {s.type} — {s.label}</option>)}
                </select>
                <button className="xo-action-btn xo-validate-btn" onClick={doValidateChain} disabled={chainValidating || !selectedStream}>
                  {chainValidating ? <><Loader size={14} className="xo-spin" /> Validating…</> : <><Shield size={14} /> Validate Chain</>}
                </button>
              </div>
              {validateResult && (
                <div className={`xo-validate-result ${validateResult.valid ? "valid" : "invalid"}`}>
                  <div className="xo-vr-status">
                    {validateResult.valid
                      ? <><CheckCircle size={16} color="#84cc16" /> Chain integrity confirmed</>
                      : <><AlertTriangle size={16} color="#f87171" /> Chain integrity issues detected</>
                    }
                  </div>
                  <div className="xo-vr-detail">{validateResult.message}</div>
                  {validateResult.invalidRecords?.length > 0 && (
                    <div className="xo-vr-errors">
                      {validateResult.invalidRecords.map((r, i) => (
                        <div key={i} className="xo-vr-error">{r.reason}: {truncHash(r.id)}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="xo-validate-section" style={{ marginTop: 20 }}>
              <div className="xo-val-label">Verify Single Record Hash</div>
              <div className="xo-actor-search">
                <input className="xo-input xo-input-wide" placeholder="Paste Record ID to verify its hash…" value={verifyId} onChange={e => setVerifyId(e.target.value)} onKeyDown={e => e.key === "Enter" && doVerify()} />
                <button className="xo-action-btn" onClick={() => doVerify()} disabled={loading || !verifyId}>
                  {loading ? <Loader size={14} className="xo-spin" /> : <Shield size={14} />} Verify
                </button>
              </div>
              {verifyResult && <VerifyResult result={verifyResult} onClose={() => setVerifyResult(null)} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── MAIN ExploreView ──────────────────────────────────────────────────────────
const ExploreView = ({ currentUser, userId, onAuthorClick, onActionMenu, xrcService }) => {
  const [searchQuery, setSearchQuery]         = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [activeTab, setActiveTab]             = useState("all");
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [showTabsPanel, setShowTabsPanel]     = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [loading, setLoading]                 = useState(false);
  const [content, setContent] = useState({ stories: [], posts: [], reels: [], users: [], tags: [], mentions: [], userContext: null, searchType: null });

  const searchRef = useRef(null);
  const tabsRef   = useRef(null);
  const filterRef = useRef(null);

  const tabs = [
    { id: "all",     label: "All" },
    { id: "stories", label: "Stories" },
    { id: "posts",   label: "Posts" },
    { id: "reels",   label: "Reels" },
    { id: "users",   label: "People" },
    { id: "tags",    label: "Tags" },
    { id: "oracle",  label: "⛓ Oracle" },  // ← NEW
  ];

  const categories = ["All","Folklore","Life Journey","Philosophy","Innovation","Romance","Adventure","Mystery","Wisdom","Entertainment"];

  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowSearchPanel(false);
      if (tabsRef.current   && !tabsRef.current.contains(e.target))   setShowTabsPanel(false);
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilterPanel(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!searchQuery && activeTab !== "oracle") loadContent();
  }, [activeTab, selectedCategory]);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      const t = setTimeout(performSearch, 350);
      return () => clearTimeout(t);
    }
    if (searchQuery.length === 0) loadContent();
  }, [searchQuery]);

  const loadContent = async () => {
    if (activeTab === "oracle") return;
    try {
      setLoading(true);
      const data = await exploreService.getTrending(activeTab, 50, userId);
      setContent({ ...data, userContext: null, searchType: null });
    } catch (err) { console.error("Failed to load:", err); }
    finally { setLoading(false); }
  };

  const performSearch = async () => {
    if (activeTab === "oracle") return;
    try {
      setLoading(true);
      const results = await exploreService.searchAll(searchQuery, { category: selectedCategory === "All" ? null : selectedCategory }, userId);
      setContent(results);
    } catch (err) { console.error("Search failed:", err); }
    finally { setLoading(false); }
  };

  const getDisplayContent = () => {
    const { stories=[], posts=[], reels=[], users=[], tags=[], mentions=[] } = content;
    switch (activeTab) {
      case "stories": return { stories, posts:[], reels:[], users:[], tags:[], mentions:[] };
      case "posts":   return { stories:[], posts, reels:[], users:[], tags:[], mentions:[] };
      case "reels":   return { stories:[], posts:[], reels, users:[], tags:[], mentions:[] };
      case "users":   return { stories:[], posts:[], reels:[], users, tags:[], mentions:[] };
      case "tags":    return { stories:[], posts:[], reels:[], users:[], tags, mentions:[] };
      default:        return { stories, posts, reels, users, tags, mentions };
    }
  };

  const displayContent = getDisplayContent();
  const totalCount = (displayContent.stories?.length||0) + (displayContent.posts?.length||0) + (displayContent.reels?.length||0) + (displayContent.users?.length||0) + (displayContent.tags?.length||0);
  const currentTabLabel = tabs.find(t => t.id === activeTab)?.label || "All";

  const getSearchTypeInfo = () => {
    if (!searchQuery) return null;
    if (searchQuery.startsWith("#")) return { icon: Hash,   text: "Hashtag", color: "#3b82f6" };
    if (searchQuery.startsWith("@")) return { icon: AtSign, text: "Mention", color: "#ec4899" };
    return { icon: Search, text: "General", color: "#84cc16" };
  };
  const sti = getSearchTypeInfo();

  const getAvatarEl = (user) => {
    if (user.avatar_id) {
      const url = mediaUrlService.getAvatarUrl(user.avatar_id);
      if (url) return <img src={url} alt={user.full_name} />;
    }
    return user.full_name?.[0]?.toUpperCase() || "U";
  };

  return (
    <>
      <style>{`
        /* ═══════════════════════════════════════════════════════════════
           EXPLORE STYLES — original preserved + Oracle additions
        ═══════════════════════════════════════════════════════════════ */
        .xpl-wrapper { max-width:1200px; margin:0 auto; }

        .xpl-header { position:sticky; top:0; background:#000; z-index:100; border-bottom:1px solid rgba(132,204,22,.12); }
        .xpl-controls { display:flex; align-items:center; gap:6px; padding:6px 10px; }
        .xpl-btn { display:flex; align-items:center; gap:6px; padding:7px 12px; background:transparent; border:1px solid rgba(132,204,22,.25); border-radius:6px; color:#84cc16; font-size:13px; font-weight:600; cursor:pointer; transition:all .12s; }
        .xpl-btn:hover  { background:rgba(132,204,22,.06); border-color:rgba(132,204,22,.4); }
        .xpl-btn.active { background:rgba(132,204,22,.12); border-color:#84cc16; }
        .xpl-tabs-btn   { flex:1; justify-content:space-between; }
        .xpl-oracle-tab { border-color:rgba(138,43,226,.4); color:#a855f7; }
        .xpl-oracle-tab:hover { background:rgba(168,85,247,.06); }
        .xpl-oracle-tab.active { background:rgba(168,85,247,.12); border-color:#a855f7; }

        .xpl-search-dd { width:100%; position:absolute!important; top:calc(100% + 5px)!important; left:0!important; right:0!important; display:flex!important; flex-direction:column; gap:8px; background:#000!important; border:1.5px solid rgba(132,204,22,.3)!important; border-radius:0 0 12px 12px!important; padding:12px 16px!important; box-shadow:0 10px 40px rgba(0,0,0,.95)!important; animation:dropIn .15s ease!important; z-index:200!important; }
        .xpl-search-input-wrap { display:flex; align-items:center; gap:12px; }
        .xpl-search-input { flex:1; background:none; border:none; color:#fff; font-size:14px; outline:none; font-weight:500; }
        .xpl-search-input::placeholder { color:#555; }
        .xpl-search-type-badge { display:inline-flex; align-items:center; gap:4px; padding:4px 8px; background:rgba(132,204,22,.1); border:1px solid rgba(132,204,22,.25); border-radius:4px; font-size:11px; font-weight:600; color:#84cc16; }
        .xpl-clear { background:none; border:1px solid #444; color:#5e5e5e; cursor:pointer; padding:5px; display:flex; transition:all .12s; border-radius:4px; }
        .xpl-clear:hover { color:lime; transform:scale(1.1); }
        .xpl-search-hint { font-size:11px; color:#666; padding:0 4px; }
        .xpl-search-hint strong { color:#84cc16; }

        .xpl-tabs-dd { position:absolute; top:calc(100% + 4px); left:10px; right:10px; background:#0a0a0a; border:1px solid rgba(132,204,22,.2); border-radius:10px; padding:8px; box-shadow:0 12px 48px rgba(0,0,0,.9); animation:dropIn .15s ease; z-index:150; }
        .xpl-tab-opt { padding:10px 14px; background:transparent; border:none; border-radius:6px; color:#fff; font-size:13px; font-weight:600; cursor:pointer; transition:all .12s; width:100%; text-align:left; }
        .xpl-tab-opt:hover  { background:rgba(132,204,22,.08); }
        .xpl-tab-opt.active { background:rgba(132,204,22,.15); color:#84cc16; }
        .xpl-tab-opt.oracle-opt { color:#a855f7; }
        .xpl-tab-opt.oracle-opt:hover { background:rgba(168,85,247,.08); }
        .xpl-tab-opt.oracle-opt.active { background:rgba(168,85,247,.15); }

        .xpl-filter-dd { position:absolute; top:calc(100% + 4px); right:10px; background:#0a0a0a; border:1px solid rgba(132,204,22,.2); border-radius:10px; padding:12px; min-width:260px; box-shadow:0 12px 48px rgba(0,0,0,.9); animation:dropIn .15s ease; z-index:150; }
        .xpl-filter-label { font-size:10px; font-weight:700; color:#84cc16; text-transform:uppercase; letter-spacing:.6px; margin-bottom:8px; }
        .xpl-cat-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:5px; }
        .xpl-cat-btn { padding:7px 10px; background:transparent; border:1px solid rgba(132,204,22,.15); border-radius:5px; color:#fff; font-size:11px; font-weight:600; cursor:pointer; transition:all .12s; text-align:center; }
        .xpl-cat-btn:hover  { background:rgba(132,204,22,.06); border-color:rgba(132,204,22,.3); }
        .xpl-cat-btn.active { background:#84cc16; color:#000; border-color:#84cc16; }

        .xpl-content { padding:10px; }
        .xpl-results { margin-bottom:12px; padding:0 2px; font-size:13px; color:#666; }
        .xpl-results strong { color:#84cc16; font-weight:700; }
        .xpl-section { margin-bottom:24px; }
        .xpl-section-title { font-size:15px; font-weight:700; color:#fff; margin:0 0 10px 2px; display:flex; align-items:center; gap:6px; }
        .xpl-badge { font-size:12px; color:#84cc16; font-weight:600; }

        /* People grid — uses ProfilePreview which has its own card styles */
        .xpl-people-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:10px; }
        .xpl-profile-preview-card { width:100% !important; max-width:100% !important; }

        .xpl-tag-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:10px; }
        .xpl-tag-card { background:rgba(59,130,246,.05); border:1px solid rgba(59,130,246,.2); border-radius:8px; padding:12px 14px; cursor:pointer; transition:all .15s; }
        .xpl-tag-card:hover { background:rgba(59,130,246,.1); border-color:rgba(59,130,246,.4); transform:translateY(-2px); }
        .xpl-tag-name { font-size:15px; font-weight:700; color:#3b82f6; margin-bottom:4px; display:flex; align-items:center; gap:6px; }
        .xpl-tag-count { font-size:12px; color:#666; }

        .xpl-reels-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:14px; }

        /* User Context Panel */
        .xpl-user-ctx { background:rgba(132,204,22,.02); border:1px solid rgba(132,204,22,.2); border-radius:12px; margin-bottom:24px; overflow:hidden; }
        .xpl-ctx-identity { display:flex; align-items:center; gap:14px; padding:16px; cursor:pointer; transition:background .15s; border-bottom:1px solid rgba(132,204,22,.1); }
        .xpl-ctx-identity:hover { background:rgba(132,204,22,.04); }
        .xpl-ctx-avatar { width:56px; height:56px; border-radius:50%; flex-shrink:0; overflow:hidden; background:linear-gradient(135deg,#84cc16,#65a30d); display:flex; align-items:center; justify-content:center; color:#000; font-weight:800; font-size:20px; border:2px solid rgba(132,204,22,.4); }
        .xpl-ctx-avatar img { width:100%; height:100%; object-fit:cover; }
        .xpl-ctx-info { flex:1; min-width:0; }
        .xpl-ctx-name { font-size:15px; font-weight:700; color:#fff; display:flex; align-items:center; gap:5px; }
        .xpl-ctx-un   { font-size:12px; color:#666; margin-top:2px; }
        .xpl-ctx-bio  { font-size:11px; color:#888; margin-top:4px; }
        .xpl-ctx-stats { display:flex; flex-direction:column; gap:4px; text-align:right; flex-shrink:0; }
        .xpl-ctx-stat { font-size:11px; color:#666; }
        .xpl-ctx-stat span { color:#84cc16; font-weight:700; font-size:13px; margin-right:3px; }
        .xpl-ctx-tabs { display:flex; border-bottom:1px solid rgba(132,204,22,.1); background:rgba(0,0,0,.3); }
        .xpl-ctx-tab { flex:1; padding:10px; background:transparent; border:none; color:#666; font-size:12px; font-weight:600; cursor:pointer; transition:all .15s; }
        .xpl-ctx-tab:hover  { color:#fff; }
        .xpl-ctx-tab.active { color:#84cc16; border-bottom:2px solid #84cc16; }
        .xpl-ctx-content { padding:12px; }

        .xpl-subsection { margin-bottom:16px; }
        .xpl-subsection-hd { width:100%; display:flex; align-items:center; justify-content:space-between; background:rgba(132,204,22,.04); border:1px solid rgba(132,204,22,.12); border-radius:8px; padding:9px 12px; cursor:pointer; transition:all .15s; margin-bottom:10px; color:#fff; }
        .xpl-subsection-hd:hover { background:rgba(132,204,22,.08); }
        .xpl-subsection-left { display:flex; align-items:center; gap:8px; font-size:13px; font-weight:600; color:#84cc16; }

        .xpl-loading { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:60px 20px; gap:10px; }
        .xpl-spinner { animation:spin .9s linear infinite; color:#84cc16; }
        .xpl-loading-text { font-size:13px; color:#666; }
        .xpl-empty { text-align:center; padding:60px 20px; }
        .xpl-empty-icon  { font-size:48px; margin-bottom:10px; opacity:.25; }
        .xpl-empty-title { font-size:16px; font-weight:700; color:#fff; margin:0 0 5px 0; }
        .xpl-empty-text  { font-size:13px; color:#666; }

        /* ═══════════════════════════════════════════════════════════════
           XRC ORACLE STYLES
        ═══════════════════════════════════════════════════════════════ */
        .xo-oracle { background:#030303; border:1px solid rgba(138,43,226,.2); border-radius:16px; overflow:hidden; }

        .xo-header { background:linear-gradient(135deg, rgba(138,43,226,.08) 0%, rgba(0,0,0,0) 100%); border-bottom:1px solid rgba(138,43,226,.15); padding:16px; }
        .xo-header-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
        .xo-oracle-title { display:flex; align-items:center; gap:10px; }
        .xo-oracle-title svg { color:#a855f7; }
        .xo-oracle-title span:first-of-type { font-size:18px; font-weight:800; color:#a855f7; letter-spacing:.5px; }
        .xo-oracle-sub { font-size:12px; color:#6b21a8; font-weight:500; padding:3px 8px; background:rgba(168,85,247,.1); border-radius:4px; }
        .xo-refresh-btn { background:transparent; border:1px solid rgba(138,43,226,.3); border-radius:6px; color:#a855f7; cursor:pointer; padding:6px; display:flex; transition:all .12s; }
        .xo-refresh-btn:hover { background:rgba(168,85,247,.1); }

        .xo-stats-bar { display:flex; gap:16px; flex-wrap:wrap; margin-bottom:14px; }
        .xo-stat { display:flex; flex-direction:column; }
        .xo-stat span { font-size:18px; font-weight:800; color:#e9d5ff; }
        .xo-stat label { font-size:10px; color:#7c3aed; text-transform:uppercase; letter-spacing:.5px; }
        .xo-stat-health { flex-direction:row; align-items:center; gap:6px; }
        .xo-stat-health label { font-size:12px; color:#84cc16; }

        .xo-mode-tabs { display:flex; gap:6px; overflow-x:auto; padding-bottom:2px; }
        .xo-mode-tab { display:flex; align-items:center; gap:6px; padding:7px 14px; background:transparent; border:1px solid rgba(138,43,226,.2); border-radius:6px; color:#7c3aed; font-size:12px; font-weight:600; cursor:pointer; transition:all .12s; white-space:nowrap; }
        .xo-mode-tab:hover  { background:rgba(168,85,247,.08); border-color:rgba(138,43,226,.4); }
        .xo-mode-tab.active { background:rgba(168,85,247,.15); border-color:#a855f7; color:#e9d5ff; }

        .xo-body { padding:16px; }

        /* Feed */
        .xo-feed-title { font-size:13px; font-weight:700; color:#e9d5ff; margin-bottom:12px; display:flex; align-items:center; gap:8px; }
        .xo-feed-title svg { color:#a855f7; }
        .xo-feed-list { display:flex; flex-direction:column; gap:10px; }
        .xo-loading { display:flex; align-items:center; justify-content:center; padding:40px; }
        .xo-empty-state { text-align:center; padding:40px 20px; color:#4c1d95; font-size:13px; line-height:1.6; }

        /* Record Cards */
        .xo-record-card { background:rgba(138,43,226,.04); border:1px solid rgba(138,43,226,.12); border-radius:10px; padding:12px; transition:all .15s; }
        .xo-record-card:hover { border-color:rgba(138,43,226,.3); background:rgba(138,43,226,.07); }
        .xo-record-top { display:flex; align-items:center; gap:8px; margin-bottom:8px; flex-wrap:wrap; }
        .xo-stream-badge { font-size:11px; font-weight:700; padding:3px 8px; border-radius:4px; border:1px solid; background:transparent; }
        .xo-record-event { font-size:12px; color:#c4b5fd; font-weight:600; }
        .xo-record-time  { font-size:11px; color:#6d28d9; margin-left:auto; }
        .xo-record-hashes { display:flex; flex-direction:column; gap:4px; margin-bottom:8px; }
        .xo-hash-row { display:flex; align-items:center; gap:6px; }
        .xo-hash-label { font-size:9px; font-weight:700; color:#7c3aed; text-transform:uppercase; width:32px; flex-shrink:0; }
        .xo-hash { font-size:11px; color:#a78bfa; font-family:monospace; }
        .xo-copy-btn { background:transparent; border:none; color:#6d28d9; cursor:pointer; padding:2px; display:flex; transition:color .12s; }
        .xo-copy-btn:hover { color:#a855f7; }
        .xo-record-payload { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px; }
        .xo-payload-kv { font-size:10px; background:rgba(138,43,226,.08); border:1px solid rgba(138,43,226,.15); border-radius:4px; padding:2px 6px; display:flex; gap:4px; }
        .xo-pk { color:#7c3aed; font-weight:700; }
        .xo-pv { color:#c4b5fd; }
        .xo-record-actions { display:flex; align-items:center; gap:8px; }
        .xo-rec-btn { display:flex; align-items:center; gap:4px; padding:4px 10px; background:transparent; border:1px solid rgba(138,43,226,.2); border-radius:4px; color:#a78bfa; font-size:11px; cursor:pointer; transition:all .12s; }
        .xo-rec-btn:hover { background:rgba(138,43,226,.1); border-color:#a855f7; }
        .xo-actor-id { font-size:10px; color:#6d28d9; margin-left:auto; font-family:monospace; }

        /* Streams grid */
        .xo-streams-title { font-size:13px; font-weight:700; color:#e9d5ff; margin-bottom:14px; display:flex; align-items:center; gap:8px; }
        .xo-streams-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:10px; margin-bottom:20px; }
        .xo-stream-card { background:rgba(0,0,0,.4); border:1px solid rgba(var(--sc-rgb,138,43,226),.2); border-color:color-mix(in srgb, var(--sc, #a855f7) 30%, transparent); border-radius:10px; padding:14px; cursor:pointer; transition:all .15s; display:flex; flex-direction:column; gap:4px; position:relative; }
        .xo-stream-card:hover { transform:translateY(-2px); border-color:var(--sc, #a855f7); background:rgba(var(--sc-rgb,138,43,226),.06); }
        .xo-stream-icon { font-size:22px; margin-bottom:4px; }
        .xo-stream-type  { font-size:13px; font-weight:800; color:#e9d5ff; }
        .xo-stream-label { font-size:11px; color:#7c3aed; }
        .xo-stream-count { font-size:12px; color:#a78bfa; font-weight:600; margin-top:4px; }
        .xo-stream-time  { font-size:10px; color:#4c1d95; margin-top:auto; }
        .xo-stream-genesis { position:absolute; top:8px; right:8px; font-size:9px; color:#4c1d95; font-weight:700; text-transform:uppercase; }

        /* Chain heads */
        .xo-chain-heads { margin-top:20px; border:1px solid rgba(138,43,226,.1); border-radius:10px; overflow:hidden; }
        .xo-ch-title { padding:10px 14px; background:rgba(138,43,226,.06); font-size:11px; font-weight:700; color:#7c3aed; text-transform:uppercase; letter-spacing:.5px; }
        .xo-ch-row { display:flex; align-items:center; gap:10px; padding:9px 14px; border-top:1px solid rgba(138,43,226,.07); }
        .xo-ch-row:hover { background:rgba(138,43,226,.04); }
        .xo-ch-stream { font-size:12px; font-weight:700; width:80px; flex-shrink:0; }
        .xo-ch-hash { font-size:11px; color:#a78bfa; flex:1; font-family:monospace; }
        .xo-ch-count { font-size:11px; color:#6d28d9; width:60px; text-align:right; }

        /* Search panel */
        .xo-sp-title { font-size:13px; font-weight:700; color:#e9d5ff; margin-bottom:14px; display:flex; align-items:center; gap:8px; }
        .xo-search-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:12px; margin-bottom:14px; }
        .xo-field { display:flex; flex-direction:column; gap:5px; }
        .xo-field label { font-size:11px; font-weight:700; color:#7c3aed; text-transform:uppercase; letter-spacing:.4px; }
        .xo-input { background:rgba(138,43,226,.06); border:1px solid rgba(138,43,226,.2); border-radius:6px; color:#e9d5ff; padding:8px 12px; font-size:13px; outline:none; transition:border-color .12s; }
        .xo-input:focus { border-color:#a855f7; }
        .xo-input::placeholder { color:#4c1d95; }
        .xo-input-wide { flex:1; }
        .xo-select { background:#0a0a14; border:1px solid rgba(138,43,226,.2); border-radius:6px; color:#e9d5ff; padding:8px 12px; font-size:13px; outline:none; cursor:pointer; }
        .xo-select-wide { flex:1; }
        .xo-action-btn { display:flex; align-items:center; gap:8px; padding:10px 20px; background:rgba(168,85,247,.15); border:1px solid rgba(138,43,226,.4); border-radius:8px; color:#e9d5ff; font-size:13px; font-weight:700; cursor:pointer; transition:all .15s; }
        .xo-action-btn:hover:not(:disabled) { background:rgba(168,85,247,.25); border-color:#a855f7; }
        .xo-action-btn:disabled { opacity:.5; cursor:not-allowed; }
        .xo-validate-btn { background:rgba(132,204,22,.1); border-color:rgba(132,204,22,.3); color:#84cc16; }
        .xo-validate-btn:hover:not(:disabled) { background:rgba(132,204,22,.2); }
        .xo-search-results { margin-top:20px; }
        .xo-sr-header { font-size:13px; color:#7c3aed; margin-bottom:12px; padding-bottom:8px; border-bottom:1px solid rgba(138,43,226,.1); }

        /* Actor panel */
        .xo-actor-panel { }
        .xo-actor-search { display:flex; gap:10px; align-items:center; margin-bottom:10px; }
        .xo-my-history-btn { display:flex; align-items:center; gap:6px; padding:7px 14px; background:transparent; border:1px solid rgba(132,204,22,.25); border-radius:6px; color:#84cc16; font-size:12px; font-weight:600; cursor:pointer; transition:all .12s; margin-bottom:12px; }
        .xo-my-history-btn:hover { background:rgba(132,204,22,.08); }
        .xo-record-trace-section { }

        /* Validate panel */
        .xo-validate-panel { }
        .xo-validate-section { }
        .xo-val-label { font-size:12px; font-weight:700; color:#7c3aed; text-transform:uppercase; letter-spacing:.4px; margin-bottom:10px; }
        .xo-validate-result { padding:14px; border-radius:8px; margin-top:12px; }
        .xo-validate-result.valid   { background:rgba(132,204,22,.06); border:1px solid rgba(132,204,22,.2); }
        .xo-validate-result.invalid { background:rgba(248,113,113,.05); border:1px solid rgba(248,113,113,.2); }
        .xo-vr-status { display:flex; align-items:center; gap:8px; font-size:14px; font-weight:700; margin-bottom:8px; color:#fff; }
        .xo-vr-detail  { font-size:12px; color:#888; }
        .xo-vr-errors  { margin-top:8px; display:flex; flex-direction:column; gap:4px; }
        .xo-vr-error   { font-size:11px; color:#f87171; font-family:monospace; }

        /* Chain Trace */
        .xo-trace-panel { background:rgba(0,0,0,.5); border:1px solid rgba(138,43,226,.2); border-radius:12px; margin-top:14px; overflow:hidden; }
        .xo-trace-header { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid rgba(138,43,226,.1); }
        .xo-trace-title { display:flex; align-items:center; gap:8px; font-size:13px; font-weight:700; color:#e9d5ff; }
        .xo-close-btn { background:transparent; border:1px solid #333; border-radius:4px; color:#666; cursor:pointer; padding:4px; display:flex; transition:all .12s; }
        .xo-close-btn:hover { color:#fff; border-color:#555; }
        .xo-trace-chain { padding:16px; display:flex; flex-direction:column; gap:0; }
        .xo-trace-node { display:flex; gap:12px; }
        .xo-trace-connector { width:24px; flex-shrink:0; display:flex; flex-direction:column; align-items:center; }
        .xo-trace-line { width:2px; flex:1; background:linear-gradient(180deg, rgba(138,43,226,.4), rgba(138,43,226,.1)); min-height:20px; }
        .xo-trace-block { flex:1; padding:10px 12px; border-radius:8px; margin-bottom:8px; border:1px solid rgba(138,43,226,.15); background:rgba(138,43,226,.04); }
        .xo-trace-block.valid   { border-color:rgba(132,204,22,.2); }
        .xo-trace-block.invalid { border-color:rgba(248,113,113,.3); background:rgba(248,113,113,.04); }
        .xo-tb-top { display:flex; align-items:center; gap:8px; margin-bottom:5px; }
        .xo-tb-stream { font-size:11px; font-weight:700; }
        .xo-tb-depth  { font-size:10px; color:#6d28d9; margin-left:auto; }
        .xo-tb-hash   { font-size:10px; color:#a78bfa; font-family:monospace; margin-bottom:4px; }
        .xo-tb-event  { font-size:11px; color:#c4b5fd; }
        .xo-tb-time   { font-size:10px; color:#4c1d95; margin-top:3px; }
        .xo-trace-genesis { display:flex; flex-direction:column; align-items:center; gap:6px; margin-top:4px; }
        .xo-genesis-block { padding:8px 20px; background:rgba(138,43,226,.1); border:1px solid rgba(138,43,226,.25); border-radius:8px; font-size:12px; font-weight:700; color:#a855f7; }

        /* Verify result */
        .xo-verify-panel { padding:14px; border-radius:10px; margin-top:12px; border:1px solid; }
        .xo-verify-panel.valid   { background:rgba(132,204,22,.05); border-color:rgba(132,204,22,.25); }
        .xo-verify-panel.invalid { background:rgba(248,113,113,.05); border-color:rgba(248,113,113,.25); }
        .xo-verify-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
        .xo-verify-title { display:flex; align-items:center; gap:8px; font-size:13px; font-weight:700; color:#fff; }
        .xo-verify-status { font-size:13px; color:#888; margin-bottom:10px; }
        .xo-verify-row { display:flex; gap:10px; font-size:12px; padding:5px 0; border-bottom:1px solid rgba(255,255,255,.04); }
        .xo-verify-row span:first-child { color:#666; width:60px; flex-shrink:0; }
        .xo-verify-row code { color:#a78bfa; font-family:monospace; }

        /* Spin */
        .xo-spin { animation:spin .8s linear infinite; }

        @keyframes dropIn { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin   { to{transform:rotate(360deg)} }

        @media (max-width:768px) {
          .xpl-controls { gap:4px; padding:5px 8px; }
          .xpl-btn { padding:6px 10px; font-size:12px; }
          .xpl-filter-dd { position:fixed; top:auto; bottom:0; left:0; right:0; border-radius:14px 14px 0 0; max-height:65vh; overflow-y:auto; }
          .xpl-reels-grid { grid-template-columns:1fr; }
          .xpl-user-grid  { grid-template-columns:1fr; }
          .xo-stats-bar   { gap:12px; }
          .xo-mode-tabs   { gap:4px; }
          .xo-search-grid { grid-template-columns:1fr; }
          .xo-streams-grid { grid-template-columns:repeat(2,1fr); }
          .xo-actor-search { flex-direction:column; }
          .xo-action-btn, .xo-input-wide { width:100%; }
        }
      `}</style>

      <div className="xpl-wrapper">
        {/* ── HEADER ── */}
        <div className="xpl-header">
          <div className="xpl-controls">
            {/* Search */}
            <div ref={searchRef} style={{ position: "relative", width: "100%" }}>
              <button className={`xpl-btn ${showSearchPanel ? "active" : ""}`} onClick={() => { setShowSearchPanel(p => !p); setShowTabsPanel(false); setShowFilterPanel(false); }}>
                <Search size={15} /> Search
              </button>
              {showSearchPanel && (
                <div className="xpl-search-dd">
                  <div className="xpl-search-input-wrap">
                    {sti ? <sti.icon size={18} style={{ color: sti.color }} /> : <Search size={18} style={{ color: "#84cc16" }} />}
                    <input type="text" placeholder="Search stories, posts, reels, people, #tags…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="xpl-search-input" autoFocus />
                    {searchQuery && <button className="xpl-clear" onClick={() => setSearchQuery("")}><X size={16} /></button>}
                  </div>
                  {sti && <div className="xpl-search-type-badge"><sti.icon size={12} /> {sti.text} Search</div>}
                  <div className="xpl-search-hint">💡 Try: <strong>#storytelling</strong> for tags · <strong>@username</strong> for people · or just type a name</div>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div ref={tabsRef} style={{ position: "relative", flex: 1 }}>
              <button className={`xpl-btn xpl-tabs-btn ${showTabsPanel ? "active" : ""} ${activeTab === "oracle" ? "xpl-oracle-tab" : ""}`} onClick={() => { setShowTabsPanel(p => !p); setShowSearchPanel(false); setShowFilterPanel(false); }}>
                <span>{currentTabLabel}</span>
                <ChevronDown size={15} />
              </button>
              {showTabsPanel && (
                <div className="xpl-tabs-dd">
                  {tabs.map(tab => (
                    <button key={tab.id} className={`xpl-tab-opt ${activeTab === tab.id ? "active" : ""} ${tab.id === "oracle" ? "oracle-opt" : ""}`} onClick={() => { setActiveTab(tab.id); setShowTabsPanel(false); }}>
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Filter */}
            {activeTab !== "oracle" && (
              <div ref={filterRef} style={{ position: "relative" }}>
                <button className={`xpl-btn ${showFilterPanel ? "active" : ""}`} onClick={() => { setShowFilterPanel(p => !p); setShowSearchPanel(false); setShowTabsPanel(false); }}>
                  <Filter size={15} /> Filter
                </button>
                {showFilterPanel && (
                  <div className="xpl-filter-dd">
                    <div className="xpl-filter-label">Category</div>
                    <div className="xpl-cat-grid">
                      {categories.map(cat => (
                        <button key={cat} className={`xpl-cat-btn ${selectedCategory === cat ? "active" : ""}`} onClick={() => setSelectedCategory(cat)}>
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── CONTENT ── */}
        <div className="xpl-content">

          {/* ── ORACLE TAB ── */}
          {activeTab === "oracle" ? (
            <XRCOraclePanel xrcService={xrcService} currentUserId={userId} />
          ) : loading ? (
            <div className="xpl-loading">
              <Loader size={32} className="xpl-spinner" />
              <p className="xpl-loading-text">{searchQuery ? "Searching…" : "Loading…"}</p>
            </div>
          ) : totalCount === 0 && !content.userContext ? (
            <div className="xpl-empty">
              <div className="xpl-empty-icon">{searchQuery ? "🔍" : "📭"}</div>
              <h3 className="xpl-empty-title">{searchQuery ? "No results found" : "No content available"}</h3>
              <p className="xpl-empty-text">{searchQuery ? "Try different keywords, #tags, or @mentions" : "Check back later"}</p>
            </div>
          ) : (
            <>
              {searchQuery && <div className="xpl-results">Found <strong>{totalCount}</strong> result{totalCount !== 1 ? "s" : ""}{content.searchType && ` · ${content.searchType} search`}</div>}

              {/* User Context Panel */}
              {content.userContext && <UserContextPanel userContext={content.userContext} currentUser={currentUser} onAuthorClick={onAuthorClick} onActionMenu={onActionMenu} />}

              {/* People — ProfilePreview handles avatar, name, and UserProfileModal internally */}
              {displayContent.users?.length > 0 && (
                <div className="xpl-section">
                  <h2 className="xpl-section-title"><User size={18} /> People <span className="xpl-badge">{displayContent.users.length}</span></h2>
                  <div className="xpl-people-grid">
                    {displayContent.users.map(user => (
                      <ProfilePreview
                        key={user.id}
                        profile={{
                          userId:    user.id,
                          user_id:   user.id,
                          author:    user.full_name,
                          username:  user.username,
                          avatar_id: user.avatar_id,
                          verified:  user.verified,
                          bio:       user.bio,
                        }}
                        currentUser={currentUser}
                        size="medium"
                        layout="horizontal"
                        showUsername={true}
                        className="xpl-profile-preview-card"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {displayContent.tags?.length > 0 && (
                <div className="xpl-section">
                  <h2 className="xpl-section-title"><Hash size={18} /> Tags <span className="xpl-badge">{displayContent.tags.length}</span></h2>
                  <div className="xpl-tag-grid">
                    {displayContent.tags.map((tag, idx) => (
                      <div key={idx} className="xpl-tag-card" onClick={() => setSearchQuery(tag.tag)}>
                        <div className="xpl-tag-name"><Hash size={16} />{tag.tag.replace("#", "")}</div>
                        <div className="xpl-tag-count">{tag.count} {tag.count === 1 ? "post" : "posts"}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stories */}
              {displayContent.stories?.length > 0 && (
                <div className="xpl-section">
                  <h2 className="xpl-section-title">Stories <span className="xpl-badge">{displayContent.stories.length}</span></h2>
                  {displayContent.stories.map(story => <StoryCard key={story.id} story={story} currentUser={currentUser} onAuthorClick={onAuthorClick} onActionMenu={onActionMenu} />)}
                </div>
              )}

              {/* Posts */}
              {displayContent.posts?.length > 0 && (
                <div className="xpl-section">
                  <h2 className="xpl-section-title">Posts <span className="xpl-badge">{displayContent.posts.length}</span></h2>
                  {displayContent.posts.map(post => <PostCard key={post.id} post={post} currentUser={currentUser} onAuthorClick={onAuthorClick} onActionMenu={onActionMenu} />)}
                </div>
              )}

              {/* Reels */}
              {displayContent.reels?.length > 0 && (
                <div className="xpl-section">
                  <h2 className="xpl-section-title">Reels <span className="xpl-badge">{displayContent.reels.length}</span></h2>
                  <div className="xpl-reels-grid">
                    {displayContent.reels.map((reel, idx) => <ReelCard key={reel.id} reel={reel} currentUser={currentUser} onAuthorClick={onAuthorClick} onActionMenu={onActionMenu} index={idx} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default ExploreView;