// ============================================================================
// src/components/Oracle/XRCOracleExplorer.jsx
//
// ═══════════════════════════════════════════════════════════════════════════
// THE XRC ORACLE — XEEVIA RECORD CHAIN NETWORK INTELLIGENCE TOOL
// ═══════════════════════════════════════════════════════════════════════════
//
// WHAT THIS IS:
//   The living use-point of the entire XRC system. Without this, XRC is
//   just a codebase. With this, every recorded action becomes explorable,
//   every connection becomes visible, every story becomes traceable.
//
// DISTINCT FROM ExploreView (Platform Explorer):
//   ExploreView  → browse platform content: posts, reels, people, tags
//   XRC Oracle   → navigate the immutable record of every action ever taken
//                  on the platform — transactions, engagement, permissions,
//                  content events, wallet state — ALL of it, connected
//
// THE CORE IDEA — You don't "search records". You ENTER THE CHAIN:
//   Pull one thread → its entire web of connections unfolds
//   A "post_liked" event shows: who posted it, what post, what engagement
//   followed, whether tokens changed hands, the actor's full activity history
//   THAT is what XRC captures. THAT is what this shows.
//
// 4-PHASE JOURNEY:
//   IDLE     → ambient observatory: live feed + "enter anything" invitation
//   SEARCHING → oracle intelligence: tries 4 strategies to find your query
//   NETWORK  → constellation view: found event at center, connections radiating
//               prev chain event ← center → next chain event
//               same-actor history (left) / linked content events (right)
//               chain thread timeline at bottom — click any node to navigate
//   TRACE    → full chain walk backwards to genesis with hash verification
//
// OPENED FROM: ServicesModal → "XRC Oracle" tile → fullscreen overlay
// PROPS: onClose, xrcService, currentUser
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import {
  X, Search, Loader, ArrowLeft, Copy, Check,
  Clock, Link2, Zap, Activity, Shield, CheckCircle,
  AlertTriangle, RefreshCw, Maximize2,
} from "lucide-react";
import { STREAM_REGISTRY, listStreams } from "../../services/xrc/streamRegistry";

// ─── STREAM VISUAL IDENTITY ───────────────────────────────────────────────────
// Each stream has its own color frequency, glyph symbol, and glow signature.
// This gives every event card an instant visual identity — no label needed.
const SV = {
  XTRC: { color:"#f59e0b", glow:"rgba(245,158,11,.35)", dim:"rgba(245,158,11,.07)", glyph:"◈", label:"Transaction"  },
  XERC: { color:"#22d3ee", glow:"rgba(34,211,238,.35)",  dim:"rgba(34,211,238,.07)",  glyph:"◉", label:"Engagement"   },
  XARC: { color:"#e2e8f0", glow:"rgba(226,232,240,.3)",  dim:"rgba(226,232,240,.05)", glyph:"◎", label:"Account"      },
  XCRC: { color:"#84cc16", glow:"rgba(132,204,22,.35)",  dim:"rgba(132,204,22,.07)",  glyph:"◆", label:"Content"      },
  XPRC: { color:"#f43f5e", glow:"rgba(244,63,94,.35)",   dim:"rgba(244,63,94,.07)",   glyph:"◇", label:"Permission"   },
  XSRC: { color:"#94a3b8", glow:"rgba(148,163,184,.3)",  dim:"rgba(148,163,184,.05)", glyph:"○", label:"System"       },
  XWRC: { color:"#fb923c", glow:"rgba(251,146,60,.35)",  dim:"rgba(251,146,60,.07)",  glyph:"◐", label:"Wallet"       },
};
const sv = (stream) => SV[stream] || SV.XSRC;

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const trunc   = (s, n=8) => s ? `${s.slice(0,n)}\u2026${s.slice(-4)}` : "\u2014";
const fmtAgo  = (ms) => {
  if (!ms) return "\u2014";
  const d = Date.now() - (typeof ms==="string" ? new Date(ms).getTime() : Number(ms));
  if (d < 5000)     return "just now";
  if (d < 60000)    return `${Math.floor(d/1000)}s ago`;
  if (d < 3600000)  return `${Math.floor(d/60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d/3600000)}h ago`;
  return `${Math.floor(d/86400000)}d ago`;
};
const fmtFull = (ms) => {
  if (!ms) return "\u2014";
  return new Date(typeof ms==="string" ? ms : Number(ms))
    .toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit"});
};
const EVENT_MAP = {
  post_created:"Published a Post",     post_updated:"Edited a Post",
  post_deleted:"Removed a Post",       reel_created:"Published a Reel",
  reel_deleted:"Removed a Reel",       story_created:"Published a Story",
  story_deleted:"Removed a Story",     story_unlocked:"Unlocked a Story",
  post_liked:"Liked a Post",           post_unliked:"Unliked a Post",
  comment_added:"Left a Comment",      comment_deleted:"Deleted a Comment",
  content_shared:"Shared Content",     post_viewed:"Viewed a Post",
  token_transfer:"Sent Tokens",        wallet_deposit:"Deposited Tokens",
  wallet_withdrawal:"Withdrew Tokens", staking_started:"Started Staking",
  staking_withdrawn:"Withdrew Stake",  account_created:"Account Created",
  account_deleted:"Account Deleted",   profile_updated:"Updated Profile",
  follow_added:"Followed a User",      follow_removed:"Unfollowed a User",
  role_assigned:"Role Assigned",       role_revoked:"Role Revoked",
  permission_granted:"Permission Granted", permission_denied:"Permission Denied",
  session_started:"Session Started",   session_ended:"Session Ended",
};
const ICON_MAP = {
  post_created:"📝", post_deleted:"🗑", reel_created:"🎬", story_created:"📖",
  story_unlocked:"🔓", post_liked:"❤️", comment_added:"💬", content_shared:"↗️",
  token_transfer:"💸", wallet_deposit:"⬆️", wallet_withdrawal:"⬇️",
  account_created:"👤", profile_updated:"✏️", role_assigned:"🔐",
  staking_started:"🔒", follow_added:"➕", session_started:"⚡", post_viewed:"👁",
};
const humanEvent = (payload) =>
  EVENT_MAP[payload?.event] || (payload?.event?.replace(/_/g," ") || "Event");
const eventIcon = (payload) => ICON_MAP[payload?.event] || "◎";

// ─── COPY BUTTON ──────────────────────────────────────────────────────────────
const CopyBtn = ({ text, size=11 }) => {
  const [c, setC] = useState(false);
  return (
    <button className="xo-cp" onClick={e=>{
      e.stopPropagation();
      navigator.clipboard?.writeText(text).then(()=>{ setC(true); setTimeout(()=>setC(false),1400); });
    }}>
      {c ? <Check size={size} color="#84cc16"/> : <Copy size={size}/>}
    </button>
  );
};

// ─── PARTICLE FIELD ───────────────────────────────────────────────────────────
const ParticleField = React.memo(() => {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d");
    let W = c.width = c.offsetWidth, H = c.height = c.offsetHeight;
    const pts = Array.from({length:55}, ()=>({
      x:Math.random()*W, y:Math.random()*H,
      vx:(Math.random()-.5)*.22, vy:(Math.random()-.5)*.22,
      r:Math.random()*1.1+.3,
      col:["rgba(132,204,22,","rgba(34,211,238,","rgba(245,158,11,"][Math.floor(Math.random()*3)],
    }));
    let raf;
    const draw = () => {
      ctx.clearRect(0,0,W,H);
      for (let i=0;i<pts.length;i++) {
        const p = pts[i];
        p.x = (p.x+p.vx+W)%W; p.y = (p.y+p.vy+H)%H;
        for (let j=i+1;j<pts.length;j++) {
          const q=pts[j], dx=p.x-q.x, dy=p.y-q.y, dist=Math.hypot(dx,dy);
          if (dist<110) {
            ctx.beginPath(); ctx.strokeStyle=`rgba(132,204,22,${.032*(1-dist/110)})`;
            ctx.lineWidth=.5; ctx.moveTo(p.x,p.y); ctx.lineTo(q.x,q.y); ctx.stroke();
          }
        }
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fillStyle=p.col+".45)"; ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    const onResize=()=>{ W=c.width=c.offsetWidth; H=c.height=c.offsetHeight; };
    window.addEventListener("resize",onResize);
    return ()=>{ cancelAnimationFrame(raf); window.removeEventListener("resize",onResize); };
  },[]);
  return <canvas ref={ref} className="xo-bg-canvas"/>;
});

// ─── EVENT NODE CARD ──────────────────────────────────────────────────────────
const EventNode = React.forwardRef(({ record, role, onClick, delay=0, compact=false }, ref) => {
  const s = sv(record?.stream_type);
  if (!record) return null;
  const roleTag = { prev:"← PRECEDES", next:"FOLLOWS →", actor:"SAME ACTOR", related:"LINKED" }[role];
  return (
    <div ref={ref}
      className={`xo-node xo-node--${role}${compact?" xo-node--compact":""}`}
      style={{"--c":s.color,"--g":s.glow,"--d":s.dim,animationDelay:`${delay}ms`}}
      onClick={()=>onClick?.(record)}
    >
      <div className="xo-node__glow"/>
      <div className="xo-node__top">
        <span className="xo-node__badge">{record.stream_type}</span>
        {roleTag && <span className="xo-node__role">{roleTag}</span>}
      </div>
      <div className="xo-node__glyph">{s.glyph}</div>
      <div className="xo-node__ev">
        <span className="xo-node__em">{eventIcon(record.payload)}</span>
        <span className="xo-node__name">{humanEvent(record.payload)}</span>
      </div>
      <div className="xo-node__meta">
        <span className="xo-node__time"><Clock size={9}/> {fmtAgo(record.timestamp)}</span>
        <span className="xo-node__hash">{trunc(record.record_hash,6)}</span>
      </div>
      {role==="center" && <>
        <div className="xo-node__pulse xo-node__pulse--a"/>
        <div className="xo-node__pulse xo-node__pulse--b"/>
      </>}
    </div>
  );
});

// ─── CONNECTOR ────────────────────────────────────────────────────────────────
const Conn = ({ color="#84cc16" }) => (
  <div className="xo-conn" style={{"--c":color}}>
    <div className="xo-conn__line"/>
    <div className="xo-conn__flow"/>
  </div>
);

// ─── CHAIN THREAD ─────────────────────────────────────────────────────────────
const ChainThread = ({ chain, centerIdx, onSelect }) => {
  const ref = useRef(null);
  useEffect(()=>{
    if (!ref.current || centerIdx<0) return;
    const nodes = ref.current.querySelectorAll(".xo-thr__node");
    nodes[centerIdx]?.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"});
  },[centerIdx]);
  if (!chain||chain.length<2) return null;
  return (
    <div className="xo-thr">
      <div className="xo-thr__label"><Link2 size={10}/> CHAIN THREAD &mdash; {chain.length} RECORDS &mdash; CLICK ANY NODE TO NAVIGATE</div>
      <div className="xo-thr__track" ref={ref}>
        <div className="xo-thr__rail"/>
        {chain.map((rec,i)=>{
          const s=sv(rec.stream_type); const isC=i===centerIdx;
          return (
            <React.Fragment key={rec.record_id}>
              {i>0 && <div className="xo-thr__seg" style={{"--c":s.color}}/>}
              <div className={`xo-thr__node${isC?" xo-thr__node--c":""}`}
                style={{"--c":s.color,"--g":s.glow}} onClick={()=>onSelect(rec)}
                title={humanEvent(rec.payload)}>
                <div className="xo-thr__dot"/>
                {isC && <div className="xo-thr__ring"/>}
                <div className="xo-thr__tip">{humanEvent(rec.payload)}</div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

// ─── DETAIL PANEL ─────────────────────────────────────────────────────────────
const DetailPanel = ({ record, onClose, onExpand, onTrace }) => {
  if (!record) return null;
  const s = sv(record.stream_type);
  const data = Object.entries(record.payload||{}).filter(([k])=>k!=="event");
  return (
    <div className="xo-detail" style={{"--c":s.color,"--g":s.glow,"--d":s.dim}}>
      <div className="xo-detail__hdr">
        <div className="xo-detail__stream">
          <span className="xo-detail__glyph">{s.glyph}</span>
          <div>
            <div className="xo-detail__sname">{s.label}</div>
            <div className="xo-detail__stype">{record.stream_type}</div>
          </div>
        </div>
        <div className="xo-detail__acts">
          <button className="xo-detail__btn" onClick={()=>onExpand(record)} title="Make center — expand its network"><Maximize2 size={12}/></button>
          <button className="xo-detail__btn" onClick={onClose}><X size={12}/></button>
        </div>
      </div>
      <div className="xo-detail__event">
        <span className="xo-detail__ei">{eventIcon(record.payload)}</span>
        {humanEvent(record.payload)}
      </div>
      <div className="xo-detail__time">{fmtFull(record.timestamp)}</div>
      <div className="xo-detail__rows">
        {[["Record ID",record.record_id],["Actor",record.actor_id],["Hash",record.record_hash],["Prev Hash",record.previous_hash]].map(([l,v])=>(
          <div key={l} className="xo-detail__row">
            <span className="xo-detail__rl">{l}</span>
            <div className="xo-detail__rv"><code>{trunc(v,10)}</code><CopyBtn text={v}/></div>
          </div>
        ))}
      </div>
      {data.length>0 && (
        <div className="xo-detail__payload">
          <div className="xo-detail__ptitle">Event Data</div>
          {data.map(([k,v])=>(
            <div key={k} className="xo-detail__kv">
              <span className="xo-detail__kk">{k.replace(/_/g," ")}</span>
              <span className="xo-detail__kv-v">{String(v).slice(0,80)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="xo-detail__footer">
        <button className="xo-detail__action" onClick={()=>onTrace(record.record_id)}><Link2 size={11}/> Trace to Genesis</button>
        <button className="xo-detail__action xo-detail__action--p" onClick={()=>onExpand(record)}><Zap size={11}/> Expand Network</button>
      </div>
    </div>
  );
};

// ─── TRACE VIEW ───────────────────────────────────────────────────────────────
const TraceView = ({ chain, loading, onNodeClick }) => {
  if (loading) return (
    <div className="xo-tloading">
      <Loader size={26} className="xo-spin"/>
      <span>Tracing chain to genesis\u2026</span>
    </div>
  );
  return (
    <div className="xo-trace">
      <div className="xo-trace__hdr">Chain trace \u00b7 {chain.length} events \u00b7 walking backwards to the beginning \u2014 click any block to expand its network</div>
      {chain.map((rec,i)=>{
        const s=sv(rec.stream_type); const isLast=i===chain.length-1;
        return (
          <div key={rec.record_id} className="xo-trace__item">
            <div className="xo-trace__left">
              <div className="xo-trace__dot" style={{"--c":s.color,"--g":s.glow}}/>
              {!isLast && <div className="xo-trace__line"/>}
            </div>
            <div className="xo-trace__block" style={{"--c":s.color}} onClick={()=>onNodeClick(rec)}>
              <div className="xo-trace__btop">
                <span className="xo-trace__bstream" style={{color:s.color}}>{s.glyph} {rec.stream_type}</span>
                <span className="xo-trace__bdepth">#{rec._depth??i}</span>
                {rec._hashValid!==false ? <CheckCircle size={11} color="#84cc16"/> : <AlertTriangle size={11} color="#f87171"/>}
              </div>
              <div className="xo-trace__bevent">{eventIcon(rec.payload)} {humanEvent(rec.payload)}</div>
              <div className="xo-trace__bhash">{trunc(rec.record_hash,14)}</div>
              <div className="xo-trace__btime">{fmtFull(rec.timestamp)}</div>
            </div>
          </div>
        );
      })}
      {chain.length>0 && (
        <div className="xo-trace__gen">
          <div className="xo-trace__genline"/>
          <div className="xo-trace__genbadge">\u26d3 GENESIS \u2014 Origin of This Chain</div>
        </div>
      )}
    </div>
  );
};

// ─── IDLE VIEW ────────────────────────────────────────────────────────────────
const IdleView = ({ recentFeed, stats, error, onEnterRecord, onQuickSearch }) => {
  const total = stats?.totalRecords??stats?.total_records??0;
  return (
    <div className="xo-idle">
      <div className="xo-idle__orb">
        <div className="xo-idle__core">\u26d3</div>
        <div className="xo-idle__ring xo-idle__ring--1"/>
        <div className="xo-idle__ring xo-idle__ring--2"/>
        <div className="xo-idle__ring xo-idle__ring--3"/>
      </div>
      <h1 className="xo-idle__title">Enter <span>the Chain</span></h1>
      <p className="xo-idle__desc">
        Every action on Xeevia is permanently recorded and linked.<br/>
        Search any record, actor, transaction, or event type \u2014<br/>
        and see its entire network of connections unfold around it.
      </p>
      <div className="xo-idle__chips">
        {["post_created","token_transfer","story_unlocked","wallet_deposit","account_created","post_liked","content_shared","follow_added"].map(ev=>(
          <button key={ev} className="xo-idle__chip" onClick={()=>onQuickSearch(ev)}>
            {ICON_MAP[ev]||"\u25ce"} {EVENT_MAP[ev]||ev}
          </button>
        ))}
      </div>
      {error && <div className="xo-idle__error"><AlertTriangle size={13}/>{error}</div>}
      {total>0 && (
        <div className="xo-idle__stats">
          <div className="xo-idle__stat"><span>{total.toLocaleString()}</span><label>Chain Records</label></div>
          <div className="xo-idle__sep"/>
          <div className="xo-idle__stat"><span>7</span><label>Event Streams</label></div>
          <div className="xo-idle__sep"/>
          <div className="xo-idle__stat"><span style={{color:"#84cc16",fontSize:11}}>\u25cf LIVE</span><label>Chain Status</label></div>
        </div>
      )}
      {recentFeed.length>0 && (
        <div className="xo-idle__feed">
          <div className="xo-idle__ftitle"><Activity size={10}/> LIVE CHAIN ACTIVITY</div>
          <div className="xo-idle__fgrid">
            {recentFeed.slice(0,9).map(rec=>{
              const s=sv(rec.stream_type);
              return (
                <div key={rec.record_id} className="xo-idle__fi"
                  style={{"--c":s.color,"--d":s.dim}} onClick={()=>onEnterRecord(rec)}>
                  <span className="xo-idle__fi-stream" style={{color:s.color}}>{s.glyph} {rec.stream_type}</span>
                  <span className="xo-idle__fi-ev">{eventIcon(rec.payload)} {humanEvent(rec.payload)}</span>
                  <span className="xo-idle__fi-time">{fmtAgo(rec.timestamp)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── NETWORK VIEW ─────────────────────────────────────────────────────────────
const NetworkView = ({
  centerRecord, network, loading,
  onNodeClick, onChainSelect, chain, chainCenterIdx,
  showDetail, selectedNode, onDetailClose, onExpand, onTrace,
}) => {
  const { prev, next, actorEvents, relatedEvents } = network;
  const cs = sv(centerRecord?.stream_type);
  return (
    <div className="xo-net">
      {showDetail && selectedNode && (
        <DetailPanel record={selectedNode} onClose={onDetailClose} onExpand={onExpand} onTrace={onTrace}/>
      )}
      <div className="xo-net__canvas">
        {loading && (
          <div className="xo-net__loading">
            <Loader size={28} className="xo-spin" style={{color:cs.color}}/>
            <div className="xo-net__ltxt">Building network around this event\u2026</div>
            <div className="xo-net__lsub">tracing chain \u00b7 scanning actor history \u00b7 finding linked events</div>
          </div>
        )}
        {!loading && (
          <div className="xo-constellation">
            {prev && (
              <div className="xo-const__top">
                <div className="xo-clabel">PRECEDES IN CHAIN</div>
                <EventNode record={prev} role="prev" onClick={onNodeClick} delay={60}/>
                <Conn color={sv(prev.stream_type).color}/>
              </div>
            )}
            <div className="xo-const__mid">
              {actorEvents.length>0 && (
                <div className="xo-const__side xo-const__side--L">
                  <div className="xo-clabel">SAME ACTOR</div>
                  {actorEvents.slice(0,3).map((rec,i)=>(
                    <React.Fragment key={rec.record_id}>
                      <EventNode record={rec} role="actor" onClick={onNodeClick} delay={80+i*55} compact/>
                      {i<Math.min(actorEvents.length,3)-1 && <Conn color={sv(rec.stream_type).color}/>}
                    </React.Fragment>
                  ))}
                </div>
              )}
              <div className="xo-const__ctr">
                <EventNode record={centerRecord} role="center" onClick={onNodeClick}/>
              </div>
              {relatedEvents.length>0 && (
                <div className="xo-const__side xo-const__side--R">
                  <div className="xo-clabel">LINKED EVENTS</div>
                  {relatedEvents.slice(0,3).map((rec,i)=>(
                    <React.Fragment key={rec.record_id}>
                      <EventNode record={rec} role="related" onClick={onNodeClick} delay={100+i*55} compact/>
                      {i<Math.min(relatedEvents.length,3)-1 && <Conn color={sv(rec.stream_type).color}/>}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
            {next && (
              <div className="xo-const__bot">
                <Conn color={sv(next.stream_type).color}/>
                <div className="xo-clabel">FOLLOWS IN CHAIN</div>
                <EventNode record={next} role="next" onClick={onNodeClick} delay={60}/>
              </div>
            )}
            {!prev && !next && !actorEvents.length && !relatedEvents.length && (
              <div className="xo-const__empty">
                This event has no discoverable connections yet.<br/>
                It may be the first of its kind in the chain.
              </div>
            )}
          </div>
        )}
      </div>
      <ChainThread chain={chain} centerIdx={chainCenterIdx} onSelect={onChainSelect}/>
    </div>
  );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
const XRCOracleExplorer = ({ onClose, xrcService, currentUser }) => {
  const [phase,           setPhase]           = useState("idle");
  const [query,           setQuery]           = useState("");
  const [focused,         setFocused]         = useState(false);
  const [searching,       setSearching]       = useState(false);
  const [error,           setError]           = useState(null);
  const [centerRecord,    setCenterRecord]    = useState(null);
  const [network,         setNetwork]         = useState({prev:null,next:null,actorEvents:[],relatedEvents:[]});
  const [netLoading,      setNetLoading]      = useState(false);
  const [chain,           setChain]           = useState([]);
  const [chainIdx,        setChainIdx]        = useState(0);
  const [traceChain,      setTraceChain]      = useState([]);
  const [traceLoading,    setTraceLoading]    = useState(false);
  const [selectedNode,    setSelectedNode]    = useState(null);
  const [showDetail,      setShowDetail]      = useState(false);
  const [stats,           setStats]           = useState(null);
  const [feed,            setFeed]            = useState([]);
  const inputRef = useRef(null);

  useEffect(()=>{ loadOverview(); setTimeout(()=>inputRef.current?.focus(),450); },[]);

  const loadOverview = async () => {
    if (!xrcService) return;
    try {
      const [s,f] = await Promise.all([
        xrcService.getChainStats().catch(()=>null),
        xrcService.getRecentActivity(12).catch(()=>[]),
      ]);
      setStats(s); setFeed(f);
    } catch {}
  };

  // Oracle intelligence — 4-strategy search
  const oracleSearch = useCallback(async (q) => {
    if (!xrcService||!q.trim()) return;
    const raw=q.trim();
    setSearching(true); setError(null); setPhase("searching");
    try {
      let found=null;
      // 1. Exact record UUID
      if (/^[0-9a-f-]{36}$/i.test(raw)) {
        const v=await xrcService.verifyRecord(raw).catch(()=>null);
        if (v?.record) found=v.record;
      }
      // 2. Actor UUID
      if (!found && /^[0-9a-f-]{36}$/i.test(raw)) {
        const r=await xrcService.getActorHistory(raw,1).catch(()=>[]);
        if (r.length>0) found=r[0];
      }
      // 3. Event type keyword
      if (!found) {
        const r=await xrcService.searchRecords({eventType:raw,limit:1}).catch(()=>null);
        if (r?.records?.length>0) found=r.records[0];
      }
      // 4. General payload search
      if (!found) {
        const r=await xrcService.searchRecords({searchTerm:raw,limit:1}).catch(()=>null);
        if (r?.records?.length>0) found=r.records[0];
      }
      if (found) { await expandNetwork(found); }
      else { setError(`Nothing found for "${raw}". Try a Record ID, User UUID, or event type like "post_created".`); setPhase("idle"); }
    } catch { setError("Oracle is unreachable. Verify the chain service is running."); setPhase("idle"); }
    finally { setSearching(false); }
  },[xrcService]);

  // Expand network around a record — the heart of the Oracle
  const expandNetwork = useCallback(async (record) => {
    setCenterRecord(record); setSelectedNode(null); setShowDetail(false);
    setPhase("network"); setNetLoading(true);
    try {
      const [traceRes, actorRecs, afterRes] = await Promise.all([
        xrcService.traceHistory(record.record_id,10).catch(()=>({chain:[]})),
        xrcService.getActorHistory(record.actor_id,8).catch(()=>[]),
        xrcService.searchRecords({streamType:record.stream_type,fromTimestamp:Number(record.timestamp)+1,limit:4}).catch(()=>({records:[]})),
      ]);
      const fullChain = traceRes?.chain||[];
      // Related content events
      let relatedEvents=[];
      const cid=record.payload?.post_id||record.payload?.story_id||record.payload?.reel_id||record.payload?.content_id;
      if (cid) {
        const rel=await xrcService.searchRecords({searchTerm:cid,limit:6}).catch(()=>({records:[]}));
        relatedEvents=(rel.records||[]).filter(r=>r.record_id!==record.record_id);
      }
      const prev=fullChain.find(r=>r.record_hash===record.previous_hash)||(fullChain.length>1?fullChain[1]:null);
      const next=(afterRes.records||[])[0]||null;
      const actorEvents=actorRecs.filter(r=>r.record_id!==record.record_id).slice(0,4);
      const ci=fullChain.findIndex(r=>r.record_id===record.record_id);
      setChain(fullChain); setChainIdx(ci>=0?ci:0);
      setNetwork({prev,next,actorEvents,relatedEvents:relatedEvents.slice(0,3)});
    } catch(e){ console.error("[XRC Oracle] expandNetwork:",e); }
    finally { setNetLoading(false); }
  },[xrcService]);

  const traceToGenesis = useCallback(async (recordId) => {
    if (!xrcService) return;
    setPhase("trace"); setTraceLoading(true);
    try { const r=await xrcService.traceHistory(recordId,40); setTraceChain(r?.chain||[]); }
    catch {} finally { setTraceLoading(false); }
  },[xrcService]);

  const handleSearch=(e)=>{ e.preventDefault(); if(query.trim()) oracleSearch(query.trim()); };
  const handleNodeClick=(rec)=>{ setSelectedNode(rec); setShowDetail(true); };
  const handleExpand=(rec)=>{ setShowDetail(false); setQuery(trunc(rec.record_id,18)); expandNetwork(rec); };
  const handleChainSelect=(rec)=>{ setQuery(trunc(rec.record_id,18)); expandNetwork(rec); };
  const handleBack=()=>{
    setPhase("idle"); setCenterRecord(null);
    setNetwork({prev:null,next:null,actorEvents:[],relatedEvents:[]});
    setChain([]); setTraceChain([]); setSelectedNode(null); setShowDetail(false); setError(null);
    setTimeout(()=>inputRef.current?.focus(),180);
  };

  const total=stats?.totalRecords??stats?.total_records??0;

  return ReactDOM.createPortal(
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@400;500;600;700;800&display=swap');

        @keyframes xo-fi   { from{opacity:0} to{opacity:1} }
        @keyframes xo-su   { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
        @keyframes xo-sr   { from{opacity:0;transform:translateX(18px)} to{opacity:1;transform:none} }
        @keyframes xo-sci  { from{opacity:0;transform:scale(.88)} to{opacity:1;transform:scale(1)} }
        @keyframes xo-ni   { from{opacity:0;transform:scale(.7) translateY(6px)} to{opacity:1;transform:none} }
        @keyframes xo-spin { to{transform:rotate(360deg)} }
        @keyframes xo-pls  { 0%,100%{transform:scale(1);opacity:.45} 50%{transform:scale(1.7);opacity:0} }
        @keyframes xo-ob1  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes xo-ob2  { from{transform:rotate(180deg)} to{transform:rotate(-180deg)} }
        @keyframes xo-ob3  { from{transform:rotate(60deg)} to{transform:rotate(420deg)} }
        @keyframes xo-glw  { 0%,100%{opacity:.3} 50%{opacity:.8} }
        @keyframes xo-flw  { 0%{transform:translateY(-100%)} 100%{transform:translateY(200%)} }
        @keyframes xo-srng { 0%,100%{box-shadow:0 0 0 0 rgba(132,204,22,.18)} 50%{box-shadow:0 0 0 8px rgba(132,204,22,0)} }
        @keyframes xo-shim { 0%{opacity:.35} 50%{opacity:1} 100%{opacity:.35} }

        .xo-root {
          position:fixed;inset:0;z-index:100000;background:#030507;
          font-family:'DM Sans',sans-serif;display:flex;flex-direction:column;
          overflow:hidden;animation:xo-fi .2s ease;
        }
        .xo-bg-canvas { position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0; }

        /* ── Top bar ── */
        .xo-bar {
          position:relative;z-index:10;display:flex;align-items:center;gap:12px;
          padding:12px 18px;border-bottom:1px solid rgba(132,204,22,.06);
          background:rgba(3,5,7,.93);backdrop-filter:blur(24px);flex-shrink:0;
        }
        .xo-brand { display:flex;align-items:center;gap:9px;flex-shrink:0; }
        .xo-brand__mark {
          width:33px;height:33px;border-radius:9px;
          background:linear-gradient(135deg,rgba(132,204,22,.12),rgba(34,211,238,.06));
          border:1px solid rgba(132,204,22,.2);
          display:flex;align-items:center;justify-content:center;font-size:15px;
        }
        .xo-brand__name { font-size:15px;font-weight:800;color:#fff;letter-spacing:-.2px;line-height:1.1; }
        .xo-brand__sub  { font-size:9.5px;color:rgba(132,204,22,.45);font-family:'Space Mono',monospace; }
        .xo-bar__back {
          display:flex;align-items:center;gap:5px;padding:6px 11px;
          background:transparent;border:1px solid rgba(255,255,255,.09);border-radius:7px;
          color:rgba(255,255,255,.38);font-size:11px;font-weight:600;cursor:pointer;
          transition:all .14s;flex-shrink:0;font-family:'DM Sans',sans-serif;
        }
        .xo-bar__back:hover { color:#fff;border-color:rgba(255,255,255,.2); }

        /* Search */
        .xo-bar__srch { flex:1; }
        .xo-sf { display:flex;align-items:center;gap:8px; }
        .xo-sbox {
          flex:1;display:flex;align-items:center;gap:10px;
          background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);
          border-radius:10px;padding:9px 14px;transition:all .2s;
        }
        .xo-sbox--f {
          border-color:rgba(132,204,22,.38);background:rgba(132,204,22,.025);
          animation:xo-srng 2.5s ease infinite;
        }
        .xo-sicon { color:rgba(132,204,22,.42);flex-shrink:0; }
        .xo-sinput {
          flex:1;background:transparent;border:none;outline:none;
          color:#e5e5e5;font-size:13px;font-family:'Space Mono',monospace;
          caret-color:#84cc16;min-width:0;
        }
        .xo-sinput::placeholder { color:rgba(255,255,255,.2); }
        .xo-sclr { background:transparent;border:none;color:rgba(255,255,255,.25);cursor:pointer;padding:2px;display:flex;transition:color .12s; }
        .xo-sclr:hover { color:rgba(255,255,255,.6); }
        .xo-ssub {
          padding:9px 18px;background:#84cc16;border:none;border-radius:8px;
          color:#000;font-size:12px;font-weight:800;cursor:pointer;
          font-family:'DM Sans',sans-serif;letter-spacing:.3px;
          transition:all .14s;flex-shrink:0;
        }
        .xo-ssub:hover:not(:disabled) { background:#a3e635;transform:translateY(-1px); }
        .xo-ssub:disabled { opacity:.5;cursor:not-allowed; }
        .xo-spin { animation:xo-spin .75s linear infinite; }

        .xo-bar__stats { display:flex;gap:16px;flex-shrink:0; }
        .xo-bstat { display:flex;flex-direction:column;align-items:flex-end; }
        .xo-bstat__n { font-size:14px;font-weight:800;color:#e5e5e5;font-family:'Space Mono',monospace;line-height:1; }
        .xo-bstat__l { font-size:9px;color:rgba(132,204,22,.38);text-transform:uppercase;letter-spacing:.5px; }
        .xo-bar__btn {
          width:31px;height:31px;border-radius:7px;
          background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);
          display:flex;align-items:center;justify-content:center;
          color:rgba(255,255,255,.32);cursor:pointer;transition:all .14s;flex-shrink:0;
        }
        .xo-bar__btn:hover { background:rgba(255,255,255,.08);color:#fff; }

        /* Stage */
        .xo-stage { flex:1;position:relative;z-index:1;overflow:hidden;display:flex;flex-direction:column; }

        /* ══ IDLE ══ */
        .xo-idle {
          flex:1;display:flex;flex-direction:column;align-items:center;
          padding:30px 20px 20px;overflow-y:auto;animation:xo-fi .3s ease;
        }
        .xo-idle::-webkit-scrollbar{width:3px}
        .xo-idle::-webkit-scrollbar-thumb{background:rgba(132,204,22,.14);border-radius:2px}

        .xo-idle__orb { position:relative;width:96px;height:96px;display:flex;align-items:center;justify-content:center;margin-bottom:22px;flex-shrink:0; }
        .xo-idle__core { font-size:32px;z-index:2;position:relative;animation:xo-glw 3s ease-in-out infinite;filter:drop-shadow(0 0 14px rgba(132,204,22,.4)); }
        .xo-idle__ring { position:absolute;border-radius:50%;border:1px solid rgba(132,204,22,.14); }
        .xo-idle__ring--1 { inset:-9px;animation:xo-ob1 18s linear infinite; }
        .xo-idle__ring--2 { inset:-21px;border-color:rgba(34,211,238,.09);animation:xo-ob2 28s linear infinite; }
        .xo-idle__ring--3 { inset:-34px;border-color:rgba(245,158,11,.06);animation:xo-ob3 42s linear infinite; }

        .xo-idle__title { font-size:25px;font-weight:800;color:#fff;letter-spacing:-.4px;text-align:center;margin:0 0 9px; }
        .xo-idle__title span { color:#84cc16; }
        .xo-idle__desc { font-size:11px;color:rgba(255,255,255,.32);text-align:center;line-height:1.75;margin:0 0 22px;font-family:'Space Mono',monospace;max-width:460px; }
        .xo-idle__chips { display:flex;flex-wrap:wrap;gap:7px;justify-content:center;margin-bottom:26px; }
        .xo-idle__chip {
          padding:5px 12px;background:rgba(255,255,255,.025);
          border:1px solid rgba(255,255,255,.07);border-radius:20px;
          font-size:11px;color:rgba(255,255,255,.38);cursor:pointer;transition:all .14s;
        }
        .xo-idle__chip:hover { border-color:rgba(132,204,22,.3);color:#84cc16;background:rgba(132,204,22,.04);transform:translateY(-1px); }
        .xo-idle__error {
          display:flex;align-items:center;gap:8px;padding:10px 16px;
          background:rgba(244,63,94,.05);border:1px solid rgba(244,63,94,.2);border-radius:8px;
          font-size:11.5px;color:rgba(244,63,94,.9);margin-bottom:18px;max-width:500px;
          font-family:'Space Mono',monospace;
        }
        .xo-idle__stats {
          display:flex;align-items:center;background:rgba(255,255,255,.02);
          border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:11px 18px;margin-bottom:26px;
        }
        .xo-idle__stat { display:flex;flex-direction:column;align-items:center; }
        .xo-idle__stat span { font-size:17px;font-weight:800;color:#e5e5e5;font-family:'Space Mono',monospace;line-height:1; }
        .xo-idle__stat label { font-size:9px;color:rgba(132,204,22,.4);text-transform:uppercase;letter-spacing:.5px;margin-top:3px; }
        .xo-idle__sep { width:1px;height:28px;background:rgba(255,255,255,.06);margin:0 18px; }
        .xo-idle__feed { width:100%;max-width:700px; }
        .xo-idle__ftitle { font-size:9px;font-weight:700;color:rgba(132,204,22,.38);text-transform:uppercase;letter-spacing:1px;margin-bottom:9px;display:flex;align-items:center;gap:6px; }
        .xo-idle__fgrid { display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:7px; }
        .xo-idle__fi {
          padding:10px 12px;background:var(--d,rgba(132,204,22,.04));
          border:1px solid rgba(255,255,255,.05);border-radius:9px;
          cursor:pointer;transition:all .15s;display:flex;flex-direction:column;gap:3px;
        }
        .xo-idle__fi:hover { border-color:color-mix(in srgb,var(--c,#84cc16) 28%,transparent);transform:translateY(-2px);box-shadow:0 4px 14px rgba(0,0,0,.28); }
        .xo-idle__fi-stream { font-size:9.5px;font-weight:700;font-family:'Space Mono',monospace; }
        .xo-idle__fi-ev    { font-size:11px;color:rgba(255,255,255,.72);font-weight:600; }
        .xo-idle__fi-time  { font-size:9.5px;color:rgba(255,255,255,.24);font-family:'Space Mono',monospace; }

        /* ══ SEARCHING ══ */
        .xo-srching { flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:13px; }
        .xo-srching__ring { width:60px;height:60px;border-radius:50%;border:2px solid rgba(132,204,22,.1);border-top:2px solid #84cc16;animation:xo-spin .72s linear infinite; }
        .xo-srching__txt { font-size:13px;color:rgba(255,255,255,.33); }
        .xo-srching__q   { font-size:11px;color:rgba(132,204,22,.45);font-family:'Space Mono',monospace;animation:xo-shim 1.6s ease infinite; }

        /* ══ NETWORK ══ */
        .xo-net { flex:1;display:flex;flex-direction:column;overflow:hidden;position:relative; }
        .xo-net__canvas { flex:1;overflow:auto;display:flex;align-items:center;justify-content:center;padding:24px 20px;position:relative; }
        .xo-net__canvas::-webkit-scrollbar{width:4px;height:4px}
        .xo-net__canvas::-webkit-scrollbar-thumb{background:rgba(132,204,22,.12);border-radius:2px}
        .xo-net__loading { position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:13px;background:rgba(3,5,7,.8);backdrop-filter:blur(8px); }
        .xo-net__ltxt { font-size:12px;color:rgba(255,255,255,.38); }
        .xo-net__lsub { font-size:10px;color:rgba(132,204,22,.32);font-family:'Space Mono',monospace;animation:xo-shim 1.8s ease infinite; }

        /* Constellation */
        .xo-constellation { display:flex;flex-direction:column;align-items:center;gap:0;min-width:300px;animation:xo-sci .28s cubic-bezier(.34,1.12,.64,1); }
        .xo-const__top  { display:flex;flex-direction:column;align-items:center; }
        .xo-const__bot  { display:flex;flex-direction:column;align-items:center; }
        .xo-const__mid  { display:flex;align-items:center;gap:14px;flex-wrap:nowrap; }
        .xo-const__ctr  { display:flex;align-items:center;justify-content:center;flex-shrink:0; }
        .xo-const__side { display:flex;flex-direction:column;align-items:center;gap:0;max-width:172px; }
        .xo-const__side .xo-clabel { margin-bottom:8px; }
        .xo-clabel      { font-size:8px;font-weight:700;color:rgba(255,255,255,.18);text-transform:uppercase;letter-spacing:1px;text-align:center;margin-bottom:5px; }
        .xo-const__empty { padding:30px 20px;text-align:center;font-size:12px;color:rgba(255,255,255,.22);font-family:'Space Mono',monospace;line-height:1.8; }

        /* Node cards */
        .xo-node {
          position:relative;cursor:pointer;width:168px;padding:14px 13px;
          background:rgba(255,255,255,.018);
          border:1px solid color-mix(in srgb,var(--c,#84cc16) 17%,transparent);
          border-radius:13px;display:flex;flex-direction:column;gap:6px;
          transition:all .2s cubic-bezier(.34,1.4,.64,1);
          animation:xo-ni .3s cubic-bezier(.34,1.4,.64,1) both;
          backdrop-filter:blur(5px);flex-shrink:0;
        }
        .xo-node:hover { transform:translateY(-5px) scale(1.04);border-color:var(--c,#84cc16);box-shadow:0 8px 28px var(--g,rgba(132,204,22,.28));background:var(--d,rgba(132,204,22,.06)); }
        .xo-node--center { width:208px;padding:18px 16px;background:var(--d,rgba(132,204,22,.05));border-color:var(--c,#84cc16);box-shadow:0 0 36px var(--g,rgba(132,204,22,.22)); }
        .xo-node--compact { width:146px;padding:10px 10px; }
        .xo-node__glow { position:absolute;inset:-1px;border-radius:13px;pointer-events:none;background:radial-gradient(circle at 25% 25%,color-mix(in srgb,var(--c,#84cc16) 9%,transparent),transparent 58%); }
        .xo-node__top { display:flex;align-items:center;justify-content:space-between; }
        .xo-node__badge { font-size:8.5px;font-weight:700;color:var(--c,#84cc16);font-family:'Space Mono',monospace;letter-spacing:.4px; }
        .xo-node__role  { font-size:7.5px;font-weight:800;color:rgba(255,255,255,.26);letter-spacing:.4px;text-transform:uppercase; }
        .xo-node__glyph { font-size:21px;line-height:1;color:var(--c,#84cc16);filter:drop-shadow(0 0 7px var(--g,rgba(132,204,22,.5))); }
        .xo-node--center .xo-node__glyph { font-size:28px; }
        .xo-node--compact .xo-node__glyph { font-size:15px; }
        .xo-node__ev  { display:flex;align-items:flex-start;gap:5px; }
        .xo-node__em  { font-size:12px;flex-shrink:0;margin-top:1px; }
        .xo-node__name { font-size:11.5px;font-weight:700;color:rgba(255,255,255,.84);line-height:1.3; }
        .xo-node--center .xo-node__name { font-size:13px; }
        .xo-node--compact .xo-node__name { font-size:10.5px; }
        .xo-node__meta { display:flex;align-items:center;justify-content:space-between;margin-top:2px; }
        .xo-node__time { display:flex;align-items:center;gap:4px;font-size:9.5px;color:rgba(255,255,255,.26);font-family:'Space Mono',monospace; }
        .xo-node__hash { font-size:8.5px;color:rgba(255,255,255,.18);font-family:'Space Mono',monospace; }
        .xo-node__pulse { position:absolute;inset:-10px;border-radius:23px;border:1px solid var(--c,#84cc16);pointer-events:none;animation:xo-pls 2.4s ease-out infinite; }
        .xo-node__pulse--b { inset:-22px;border-radius:35px;animation-delay:.85s;opacity:.35; }

        /* Connector */
        .xo-conn { display:flex;align-items:center;justify-content:center;position:relative;flex-shrink:0;height:26px;width:2px; }
        .xo-conn__line { position:absolute;width:2px;height:100%;background:linear-gradient(180deg,var(--c,#84cc16),transparent);opacity:.22;border-radius:1px; }
        .xo-conn__flow { position:absolute;width:2px;height:50%;overflow:hidden; }
        .xo-conn__flow::after { content:'';display:block;width:100%;height:100%;background:linear-gradient(180deg,transparent,var(--c,#84cc16),transparent);animation:xo-flw 1.4s ease infinite;opacity:.5; }

        /* Detail panel */
        .xo-detail {
          position:absolute;right:0;top:0;bottom:0;width:296px;
          background:rgba(3,5,8,.96);backdrop-filter:blur(24px);
          border-left:1px solid color-mix(in srgb,var(--c,#84cc16) 17%,transparent);
          padding:17px;overflow-y:auto;z-index:20;display:flex;flex-direction:column;gap:11px;
          animation:xo-sr .2s ease;
        }
        .xo-detail::-webkit-scrollbar{width:3px}
        .xo-detail::-webkit-scrollbar-thumb{background:rgba(132,204,22,.13);border-radius:2px}
        .xo-detail__hdr { display:flex;align-items:flex-start;justify-content:space-between; }
        .xo-detail__stream { display:flex;align-items:center;gap:9px; }
        .xo-detail__glyph { font-size:20px; }
        .xo-detail__sname { font-size:13px;font-weight:800;color:var(--c,#84cc16); }
        .xo-detail__stype { font-size:9.5px;color:rgba(255,255,255,.28);font-family:'Space Mono',monospace; }
        .xo-detail__acts { display:flex;gap:5px; }
        .xo-detail__btn { width:25px;height:25px;border-radius:6px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);color:rgba(255,255,255,.32);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .13s; }
        .xo-detail__btn:hover { color:#fff;background:rgba(255,255,255,.1); }
        .xo-detail__event { font-size:15px;font-weight:800;color:#fff;line-height:1.3;display:flex;align-items:center;gap:8px; }
        .xo-detail__ei { font-size:18px;flex-shrink:0; }
        .xo-detail__time { font-size:9.5px;color:rgba(255,255,255,.22);font-family:'Space Mono',monospace; }
        .xo-detail__rows { display:flex;flex-direction:column;gap:3px; }
        .xo-detail__row { display:flex;justify-content:space-between;align-items:center;font-size:10.5px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04); }
        .xo-detail__rl { color:rgba(255,255,255,.26);flex-shrink:0;margin-right:8px; }
        .xo-detail__rv { display:flex;align-items:center;gap:5px;min-width:0; }
        .xo-detail__rv code { color:var(--c,#84cc16);font-family:'Space Mono',monospace;font-size:9.5px; }
        .xo-cp { background:transparent;border:none;color:rgba(255,255,255,.2);cursor:pointer;padding:2px;display:flex;transition:color .12s;flex-shrink:0; }
        .xo-cp:hover { color:var(--c,#84cc16); }
        .xo-detail__ptitle { font-size:8.5px;font-weight:800;color:rgba(255,255,255,.2);text-transform:uppercase;letter-spacing:.7px;margin-bottom:6px; }
        .xo-detail__kv { display:flex;flex-direction:column;gap:2px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.05);border-radius:6px;padding:5px 8px;margin-bottom:4px; }
        .xo-detail__kk { font-size:9px;font-weight:700;color:var(--c,#84cc16);text-transform:uppercase;letter-spacing:.3px; }
        .xo-detail__kv-v { font-size:10.5px;color:rgba(255,255,255,.68);word-break:break-all; }
        .xo-detail__footer { display:flex;gap:7px;margin-top:auto;padding-top:11px;border-top:1px solid rgba(255,255,255,.04); }
        .xo-detail__action { flex:1;display:flex;align-items:center;justify-content:center;gap:5px;padding:8px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:8px;color:rgba(255,255,255,.52);font-size:11px;font-weight:700;cursor:pointer;transition:all .14s;font-family:'DM Sans',sans-serif; }
        .xo-detail__action:hover { background:rgba(255,255,255,.07);color:#fff; }
        .xo-detail__action--p { background:rgba(132,204,22,.07);border-color:rgba(132,204,22,.22);color:#84cc16; }
        .xo-detail__action--p:hover { background:rgba(132,204,22,.15); }

        /* Chain thread */
        .xo-thr { flex-shrink:0;padding:11px 18px 13px;background:rgba(0,0,0,.62);backdrop-filter:blur(12px);border-top:1px solid rgba(132,204,22,.06); }
        .xo-thr__label { font-size:8.5px;font-weight:700;color:rgba(132,204,22,.32);text-transform:uppercase;letter-spacing:1px;margin-bottom:9px;display:flex;align-items:center;gap:6px; }
        .xo-thr__track { display:flex;align-items:center;overflow-x:auto;padding:2px 0 7px;scrollbar-width:thin;scrollbar-color:rgba(132,204,22,.13) transparent;position:relative; }
        .xo-thr__track::-webkit-scrollbar{height:3px}
        .xo-thr__track::-webkit-scrollbar-thumb{background:rgba(132,204,22,.12);border-radius:2px}
        .xo-thr__rail { position:absolute;top:7px;left:0;right:0;height:1px;background:rgba(132,204,22,.07);pointer-events:none; }
        .xo-thr__seg { width:18px;height:1px;flex-shrink:0;background:linear-gradient(90deg,color-mix(in srgb,var(--c,#84cc16) 25%,transparent),color-mix(in srgb,var(--c,#84cc16) 8%,transparent)); }
        .xo-thr__node { position:relative;display:flex;flex-direction:column;align-items:center;flex-shrink:0;cursor:pointer;padding:0 2px;gap:5px; }
        .xo-thr__dot { width:10px;height:10px;border-radius:50%;background:var(--c,#84cc16);box-shadow:0 0 7px var(--g,rgba(132,204,22,.38));transition:transform .13s;flex-shrink:0; }
        .xo-thr__node:hover .xo-thr__dot { transform:scale(1.5); }
        .xo-thr__node--c .xo-thr__dot { width:14px;height:14px; }
        .xo-thr__ring { position:absolute;top:-4px;left:50%;transform:translateX(-50%);width:22px;height:22px;border-radius:50%;border:1px solid var(--c,#84cc16);animation:xo-pls 1.8s ease-out infinite;pointer-events:none; }
        .xo-thr__tip { font-size:8.5px;color:rgba(255,255,255,.25);white-space:nowrap;max-width:70px;overflow:hidden;text-overflow:ellipsis;text-align:center;line-height:1.2; }
        .xo-thr__node--c .xo-thr__tip { color:rgba(132,204,22,.65);font-weight:700; }

        /* Trace */
        .xo-trace { flex:1;overflow-y:auto;padding:20px 20px 30px;animation:xo-su .24s ease; }
        .xo-trace::-webkit-scrollbar{width:3px}
        .xo-trace::-webkit-scrollbar-thumb{background:rgba(132,204,22,.12);border-radius:2px}
        .xo-trace__hdr { font-size:10px;color:rgba(255,255,255,.24);font-family:'Space Mono',monospace;margin-bottom:18px;line-height:1.6; }
        .xo-trace__item { display:flex;gap:12px; }
        .xo-trace__left { display:flex;flex-direction:column;align-items:center;width:15px;flex-shrink:0;padding-top:3px; }
        .xo-trace__dot { width:11px;height:11px;border-radius:50%;flex-shrink:0;background:var(--g,rgba(132,204,22,.28));border:2px solid var(--c,#84cc16);box-shadow:0 0 7px var(--g,rgba(132,204,22,.28)); }
        .xo-trace__line { width:2px;flex:1;min-height:14px;background:linear-gradient(180deg,rgba(132,204,22,.16),rgba(132,204,22,.04));margin:3px 0; }
        .xo-trace__block { flex:1;padding:10px 12px;border-radius:9px;margin-bottom:7px;border:1px solid rgba(255,255,255,.05);border-left:3px solid var(--c,#84cc16);background:rgba(255,255,255,.017);cursor:pointer;transition:all .14s; }
        .xo-trace__block:hover { background:rgba(255,255,255,.034); }
        .xo-trace__btop { display:flex;align-items:center;gap:8px;margin-bottom:4px; }
        .xo-trace__bstream { font-size:10.5px;font-weight:700;font-family:'Space Mono',monospace; }
        .xo-trace__bdepth  { font-size:9px;color:rgba(255,255,255,.18);margin-left:auto; }
        .xo-trace__bevent  { font-size:12.5px;font-weight:700;color:rgba(255,255,255,.83);margin-bottom:4px; }
        .xo-trace__bhash   { font-size:9px;color:rgba(255,255,255,.2);font-family:'Space Mono',monospace;margin-bottom:3px; }
        .xo-trace__btime   { font-size:9px;color:rgba(255,255,255,.18);font-family:'Space Mono',monospace; }
        .xo-tloading { flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:rgba(255,255,255,.32);font-size:12px; }
        .xo-trace__gen { display:flex;flex-direction:column;align-items:flex-start;padding-left:19px;margin-top:4px;gap:7px; }
        .xo-trace__genline { width:2px;height:18px;background:rgba(132,204,22,.09);margin-left:-5px; }
        .xo-trace__genbadge { padding:7px 16px;background:rgba(168,85,247,.07);border:1px solid rgba(168,85,247,.18);border-radius:7px;font-size:11px;font-weight:700;color:#a855f7;font-family:'Space Mono',monospace; }

        /* Responsive */
        @media(max-width:768px){
          .xo-bar__stats{display:none}
          .xo-brand__sub{display:none}
          .xo-const__mid{flex-wrap:wrap;justify-content:center}
          .xo-const__side{max-width:unset;flex-direction:row;flex-wrap:wrap;justify-content:center}
          .xo-node{width:140px}
          .xo-node--center{width:176px}
          .xo-node--compact{width:128px}
          .xo-detail{position:fixed;inset:auto 0 0 0;width:100%;height:56vh;border-left:none;border-top:1px solid rgba(132,204,22,.14);border-radius:17px 17px 0 0}
          .xo-idle__fgrid{grid-template-columns:repeat(2,1fr)}
        }
      `}</style>

      <div className="xo-root">
        <ParticleField/>

        {/* Top bar */}
        <div className="xo-bar">
          <div className="xo-brand">
            <div className="xo-brand__mark">\u26d3</div>
            <div>
              <div className="xo-brand__name">XRC Oracle</div>
              <div className="xo-brand__sub">xeevia record chain</div>
            </div>
          </div>
          {phase!=="idle" && <button className="xo-bar__back" onClick={handleBack}><ArrowLeft size={12}/> New Search</button>}
          <div className="xo-bar__srch">
            <form className="xo-sf" onSubmit={handleSearch}>
              <div className={`xo-sbox${focused?" xo-sbox--f":""}`}>
                <Search size={14} className="xo-sicon"/>
                <input ref={inputRef} className="xo-sinput"
                  value={query} onChange={e=>setQuery(e.target.value)}
                  onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
                  placeholder="record ID \u00b7 user UUID \u00b7 post_created \u00b7 token_transfer \u00b7 any hash prefix\u2026"
                  autoComplete="off" spellCheck={false}/>
                {query && <button type="button" className="xo-sclr" onClick={()=>setQuery("")}><X size={13}/></button>}
              </div>
              <button type="submit" className="xo-ssub" disabled={searching||!query.trim()}>
                {searching ? <Loader size={12} className="xo-spin"/> : "Enter Chain"}
              </button>
            </form>
          </div>
          {stats && (
            <div className="xo-bar__stats">
              <div className="xo-bstat"><span className="xo-bstat__n">{total.toLocaleString()}</span><span className="xo-bstat__l">Records</span></div>
              <div className="xo-bstat"><span className="xo-bstat__n">7</span><span className="xo-bstat__l">Streams</span></div>
            </div>
          )}
          <button className="xo-bar__btn" onClick={loadOverview} title="Refresh"><RefreshCw size={13}/></button>
          <button className="xo-bar__btn" onClick={onClose}><X size={14}/></button>
        </div>

        {/* Stage */}
        <div className="xo-stage">
          {phase==="idle" && (
            <IdleView recentFeed={feed} stats={stats} error={error}
              onEnterRecord={expandNetwork} onQuickSearch={q=>{setQuery(q);oracleSearch(q);}}/>
          )}
          {phase==="searching" && (
            <div className="xo-srching">
              <div className="xo-srching__ring"/>
              <div className="xo-srching__txt">Querying the chain\u2026</div>
              <div className="xo-srching__q">"{query}"</div>
            </div>
          )}
          {phase==="network" && centerRecord && (
            <NetworkView
              centerRecord={centerRecord} network={network} loading={netLoading}
              onNodeClick={handleNodeClick} onChainSelect={handleChainSelect}
              chain={chain} chainCenterIdx={chainIdx}
              showDetail={showDetail} selectedNode={selectedNode}
              onDetailClose={()=>setShowDetail(false)} onExpand={handleExpand} onTrace={traceToGenesis}
            />
          )}
          {phase==="trace" && (
            <TraceView chain={traceChain} loading={traceLoading} onNodeClick={handleExpand}/>
          )}
        </div>
      </div>
    </>,
    document.body
  );
};

export default XRCOracleExplorer;