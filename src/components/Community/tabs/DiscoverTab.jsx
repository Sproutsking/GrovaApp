// components/Community/tabs/DiscoverTab.jsx
// UI TRANSFER: Design system from prototype. All backend props/logic untouched.
import React, { useState, useEffect, useRef } from "react";
import {
  Search, Users, Eye, UserPlus, CheckCircle, TrendingUp,
  Star, Zap, Globe, Crown, Sparkles, ChevronDown, X,
  Info, Lock, Hash, MessageCircle, Calendar, Shield,
} from "lucide-react";

// ─── Detail modal ─────────────────────────────────────────────────────────────
const CommunityDetailModal = ({ community, isMember, onClose, onJoin }) => {
  if (!community) return null;
  const icon = community.icon;
  return (
    <>
      <div className="dm-overlay" onClick={onClose}>
        <div className="dm-modal" onClick={(e) => e.stopPropagation()}>
          <button className="dm-close" onClick={onClose}><X size={18} /></button>
          <div className="dm-banner" style={{ background: community.banner_gradient || "linear-gradient(135deg,#667eea,#764ba2)" }}>
            <div className="dm-banner-fade" />
            <div className="dm-icon-wrap">
              {icon?.startsWith("http")
                ? <img src={icon} alt={community.name} style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                : <span style={{ fontSize:34,lineHeight:1 }}>{icon || community.name?.[0] || "🌟"}</span>
              }
            </div>
          </div>
          <div className="dm-body">
            <div className="dm-name-row">
              <h2 className="dm-name">{community.name}</h2>
              {community.is_verified && <CheckCircle size={18} fill="#9cff00" color="#000" />}
              {community.is_premium  && <Crown size={16} fill="#FFD700" color="#000" />}
              {community.is_private  && <span className="dm-private"><Lock size={12}/> Private</span>}
            </div>
            <div className="dm-stats">
              <span className="dm-stat"><Users size={13}/>{(community.member_count||0).toLocaleString()} members</span>
              <span className="dm-stat online"><span className="dm-online-dot"/>{(community.online_count||0).toLocaleString()} online</span>
              <span className="dm-stat"><Calendar size={13}/>{new Date(community.created_at).toLocaleDateString()}</span>
            </div>
            {community.description && <p className="dm-desc">{community.description}</p>}
            {community.tags?.length > 0 && (
              <div className="dm-tags">{community.tags.map((t,i)=><span key={i} className="dm-tag">{t}</span>)}</div>
            )}
            <div className="dm-features">
              {[[Hash,"Text Channels"],[MessageCircle,"Voice"],[Star,"Custom Roles"],[Shield,"Moderation"]].map(([Icon,label])=>(
                <div key={label} className="dm-feature"><Icon size={13}/>{label}</div>
              ))}
            </div>
            <div className="dm-actions">
              {!isMember
                ? <button className="dm-join-btn" onClick={()=>onJoin(community.id)}><UserPlus size={16}/> Join Community</button>
                : <div className="dm-joined"><CheckCircle size={16}/> You're a member</div>
              }
            </div>
          </div>
        </div>
      </div>
      <style>{`
        .dm-overlay{position:fixed;inset:0;background:rgba(0,0,0,.8);backdrop-filter:blur(12px);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;animation:dmFadeIn .22s ease}
        @keyframes dmFadeIn{from{opacity:0}to{opacity:1}}
        .dm-modal{width:100%;max-width:520px;max-height:88vh;background:#090909;border:1.5px solid rgba(156,255,0,.2);border-radius:20px;overflow:hidden;display:flex;flex-direction:column;animation:dmSlide .28s cubic-bezier(.32,.72,0,1);position:relative}
        @keyframes dmSlide{from{opacity:0;transform:translateY(24px) scale(.97)}to{opacity:1;transform:none}}
        .dm-close{position:absolute;top:12px;right:12px;width:32px;height:32px;border-radius:50%;background:rgba(0,0,0,.7);border:1.5px solid rgba(255,255,255,.1);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;z-index:10}
        .dm-close:hover{background:rgba(255,107,107,.22);color:#ff6b6b;transform:rotate(90deg)}
        .dm-banner{height:120px;position:relative;flex-shrink:0;overflow:hidden;display:flex;align-items:flex-end;justify-content:center}
        .dm-banner-fade{position:absolute;inset:0;background:linear-gradient(180deg,transparent 30%,rgba(9,9,9,1) 100%)}
        .dm-icon-wrap{width:64px;height:64px;border-radius:14px;background:rgba(0,0,0,.4);border:2px solid rgba(9,9,9,1);display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;z-index:2;margin-bottom:-22px}
        .dm-body{padding:32px 22px 20px;overflow-y:auto}
        .dm-body::-webkit-scrollbar{width:4px}
        .dm-body::-webkit-scrollbar-thumb{background:rgba(156,255,0,.18);border-radius:2px}
        .dm-name-row{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:10px}
        .dm-name{font-size:22px;font-weight:900;color:#fff;margin:0;font-family:'Outfit',sans-serif}
        .dm-private{display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:20px;background:rgba(156,255,0,.08);border:1px solid rgba(156,255,0,.2);color:#9cff00;font-size:10px;font-weight:700}
        .dm-stats{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,.06)}
        .dm-stat{display:flex;align-items:center;gap:4px;font-size:11px;color:#888;font-weight:600}
        .dm-stat.online{color:#10b981}
        .dm-online-dot{width:6px;height:6px;border-radius:50%;background:#10b981;box-shadow:0 0 6px #10b981}
        .dm-desc{color:#aaa;font-size:13px;line-height:1.55;margin-bottom:12px}
        .dm-tags{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:12px}
        .dm-tag{padding:3px 8px;border-radius:6px;background:rgba(156,255,0,.07);border:1px solid rgba(156,255,0,.18);color:#9cff00;font-size:10px;font-weight:700}
        .dm-features{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-bottom:16px}
        .dm-feature{display:flex;align-items:center;gap:7px;padding:9px 10px;background:rgba(16,16,16,.95);border:1px solid rgba(30,30,30,.9);border-radius:9px;color:#bbb;font-size:11px;font-weight:600}
        .dm-actions{display:flex;justify-content:center}
        .dm-join-btn{display:flex;align-items:center;gap:7px;padding:12px 26px;border-radius:11px;background:linear-gradient(135deg,#9cff00,#667eea);border:none;color:#000;font-size:14px;font-weight:800;cursor:pointer;transition:all .25s;box-shadow:0 4px 14px rgba(156,255,0,.28);font-family:'Outfit',sans-serif}
        .dm-join-btn:hover{transform:translateY(-2px);box-shadow:0 8px 22px rgba(156,255,0,.45)}
        .dm-joined{display:flex;align-items:center;gap:7px;padding:12px 26px;border-radius:11px;background:rgba(156,255,0,.1);border:2px solid rgba(156,255,0,.3);color:#9cff00;font-size:14px;font-weight:800}
      `}</style>
    </>
  );
};

// ─── Filter categories ─────────────────────────────────────────────────────────
const CATEGORIES = [
  {id:"all",label:"All",Icon:Globe},{id:"blockchain",label:"Blockchain",Icon:Crown},
  {id:"technology",label:"Tech",Icon:Zap},{id:"creative",label:"Creative",Icon:Sparkles},
  {id:"gaming",label:"Gaming",Icon:Star},{id:"business",label:"Business",Icon:TrendingUp},
];
const SORT_OPTIONS = [
  {id:"trending",label:"Trending"},{id:"members",label:"Members"},
  {id:"active",label:"Active"},{id:"newest",label:"Newest"},
];

const DiscoverTab = ({ communities, myCommunities, onJoin, onSelect }) => {
  const [search, setSearch]         = useState("");
  const [category, setCategory]     = useState("all");
  const [sort, setSort]             = useState("trending");
  const [showSearch, setShowSearch] = useState(false);
  const [showCatDd, setShowCatDd]   = useState(false);
  const [showSortDd, setShowSortDd] = useState(false);
  const [detail, setDetail]         = useState(null);
  const catRef  = useRef(null);
  const sortRef = useRef(null);

  useEffect(() => {
    const h = (e) => {
      if (showCatDd  && catRef.current  && !catRef.current.contains(e.target))  setShowCatDd(false);
      if (showSortDd && sortRef.current && !sortRef.current.contains(e.target)) setShowSortDd(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showCatDd, showSortDd]);

  const isMember  = (id) => myCommunities.some((c) => c.id === id);
  const pub       = communities.filter((c) => !c.is_private);
  const audience  = pub.reduce((a,c)=>a+(c.member_count||0),0);

  const filtered = pub
    .filter((c) => {
      const q = search.toLowerCase();
      return (c.name.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q)) &&
             (category === "all" || c.category === category);
    })
    .sort((a,b) => {
      if (sort==="members") return (b.member_count||0)-(a.member_count||0);
      if (sort==="active")  return (b.online_count||0)-(a.online_count||0);
      if (sort==="newest")  return new Date(b.created_at)-new Date(a.created_at);
      return (b.trending_score||b.member_count||0)-(a.trending_score||a.member_count||0);
    });

  const selCat  = CATEGORIES.find(c=>c.id===category);
  const selSort = SORT_OPTIONS.find(s=>s.id===sort);

  return (
    <>
      <div className="disc-root">
        <div className="disc-bg" />

        {/* Top bar */}
        <div className="disc-topbar">
          <div className="disc-stats-row">
            <span className="disc-stat-chip"><Globe size={10}/>{pub.length} communities</span>
            <span className="disc-stat-dot">·</span>
            <span className="disc-stat-chip"><Users size={10}/>{audience.toLocaleString()} members</span>
          </div>
          <div className="disc-controls">
            <button className={`disc-ctrl${showSearch?" on":""}`} onClick={()=>setShowSearch(!showSearch)} title="Search">
              <Search size={13}/>
            </button>
            <div className="disc-dd" ref={catRef}>
              <button className={`disc-ctrl has-lbl${showCatDd?" on":""}`} onClick={()=>setShowCatDd(!showCatDd)}>
                {selCat&&<selCat.Icon size={13}/>}
                <span>{selCat?.label}</span>
                <ChevronDown size={10} style={{transition:"transform .18s",transform:showCatDd?"rotate(180deg)":"none"}}/>
              </button>
              {showCatDd&&(
                <div className="disc-dd-menu">
                  {CATEGORIES.map(({id,label,Icon})=>(
                    <button key={id} className={`disc-dd-item${category===id?" on":""}`} onClick={()=>{setCategory(id);setShowCatDd(false);}}>
                      <Icon size={12}/>{label}
                      {category===id&&<CheckCircle size={11} style={{marginLeft:"auto",color:"#9cff00"}}/>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="disc-dd" ref={sortRef}>
              <button className={`disc-ctrl has-lbl${showSortDd?" on":""}`} onClick={()=>setShowSortDd(!showSortDd)}>
                <TrendingUp size={13}/><span>{selSort?.label}</span>
                <ChevronDown size={10} style={{transition:"transform .18s",transform:showSortDd?"rotate(180deg)":"none"}}/>
              </button>
              {showSortDd&&(
                <div className="disc-dd-menu disc-dd-right">
                  {SORT_OPTIONS.map(({id,label})=>(
                    <button key={id} className={`disc-dd-item${sort===id?" on":""}`} onClick={()=>{setSort(id);setShowSortDd(false);}}>
                      {label}{sort===id&&<CheckCircle size={11} style={{marginLeft:"auto",color:"#9cff00"}}/>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search bar */}
        {showSearch&&(
          <div className="disc-search-bar">
            <Search size={13} color="#555"/>
            <input className="disc-search-inp" placeholder="Search communities…" value={search} onChange={e=>setSearch(e.target.value)} autoFocus/>
            {search&&<button className="disc-search-x" onClick={()=>setSearch("")}><X size={12}/></button>}
            <button className="disc-search-x" onClick={()=>setShowSearch(false)}><X size={13}/></button>
          </div>
        )}

        {/* Card grid */}
        <div className="disc-grid">
          {filtered.length===0 ? (
            <div className="disc-empty">
              <span className="disc-empty-emoji">🔍</span>
              <h3>No communities found</h3>
              <p>Try different filters or search terms</p>
            </div>
          ) : (
            filtered.map((c,idx)=>{
              const member = isMember(c.id);
              const icon   = c.icon;
              return (
                <div
                  key={c.id}
                  className="disc-card"
                  style={{animationDelay:`${Math.min(idx*.04,.28)}s`}}
                >
                  {/* Accent layer — pointer-events:none prevents click blocking */}
                  <div
                    className="disc-card-accent"
                    style={{background:c.banner_gradient||"linear-gradient(135deg,#667eea,#764ba2)"}}
                  />

                  <div className="disc-card-body">
                    {/* Head row */}
                    <div className="disc-card-head">
                      <div
                        className="disc-avatar"
                        style={{
                          background: icon?.startsWith("http") ? "transparent" : (c.banner_gradient||"linear-gradient(135deg,#667eea,#764ba2)"),
                          overflow: icon?.startsWith("http") ? "hidden" : "visible",
                        }}
                      >
                        {icon?.startsWith("http")
                          ? <img src={icon} alt={c.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                          : (icon||c.name?.[0]||"🌟")
                        }
                        {c.is_premium&&<div className="disc-premium"><Crown size={8} fill="#FFD700" color="#000"/></div>}
                      </div>
                      <div className="disc-card-info">
                        <div className="disc-card-name">
                          {c.name}
                          {c.is_verified&&<CheckCircle size={12} fill="#9cff00" color="#000"/>}
                          {c.is_private&&<Lock size={10} color="#888"/>}
                        </div>
                        <div className="disc-card-meta">
                          <span className="disc-cs"><Users size={10}/>{(c.member_count||0).toLocaleString()}</span>
                          <span className="disc-cs-dot">·</span>
                          <span className="disc-cs online"><span className="disc-pulse"/>{(c.online_count||0).toLocaleString()} online</span>
                        </div>
                      </div>
                    </div>

                    {c.description&&<p className="disc-card-desc">{c.description}</p>}

                    {c.tags?.length>0&&(
                      <div className="disc-card-tags">
                        {c.tags.slice(0,3).map((t,i)=><span key={i} className="disc-tag">{t}</span>)}
                      </div>
                    )}

                    {/* Action buttons — z-index:2 ensures always clickable above accent */}
                    <div className="disc-card-actions">
                      {!member ? (
                        <>
                          <button className="dca-btn join" onClick={e=>{e.stopPropagation();onJoin(c.id);}}>
                            <UserPlus size={13}/> Join
                          </button>
                          <button className="dca-btn details" onClick={e=>{e.stopPropagation();setDetail(c);}}>
                            <Info size={13}/> Details
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="dca-btn joined" onClick={e=>e.stopPropagation()}>
                            <CheckCircle size={13}/> Joined
                          </button>
                          <button className="dca-btn view" onClick={e=>{e.stopPropagation();onSelect(c);}}>
                            <Eye size={13}/> View
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {detail&&(
        <CommunityDetailModal
          community={detail} isMember={isMember(detail.id)}
          onClose={()=>setDetail(null)}
          onJoin={async(id)=>{await onJoin(id);setDetail(null);}}
        />
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&family=JetBrains+Mono:wght@400;600&display=swap');

        .disc-root {
          flex: 1;
          overflow-y: auto;
          padding: 10px 12px 20px;
          position: relative;
          background: var(--bg);
          color: var(--text);
          font-family: 'Outfit', sans-serif;
        }
        .disc-root::-webkit-scrollbar { width: 4px; }
        .disc-root::-webkit-scrollbar-thumb { background: var(--accent-bg-strong); border-radius: 2px; }

        .disc-bg {
          position: absolute; inset: 0; opacity: .035; pointer-events: none;
          background-image:
            repeating-linear-gradient(0deg,transparent,transparent 2px,var(--accent-bg-soft) 2px,var(--accent-bg-soft) 4px),
            repeating-linear-gradient(90deg,transparent,transparent 2px,rgba(22,163,74,.08) 2px,rgba(22,163,74,.08) 4px);
        }

        /* Topbar */
        .disc-topbar {
          display: flex; align-items: center; justify-content: space-between;
          gap: 8px; margin-bottom: 10px; position: relative; z-index: 10;
        }
        .disc-stats-row { display: flex; align-items: center; gap: 5px; flex-shrink: 0; }
        .disc-stat-chip { display: flex; align-items: center; gap: 3px; color: var(--text-secondary); font-size: 11px; font-weight: 700; }
        .disc-stat-dot { color: var(--text-muted); font-size: 11px; }
        .disc-controls { display: flex; align-items: center; gap: 5px; flex-shrink: 0; }

        .disc-ctrl {
          display: flex; align-items: center; gap: 4px;
          padding: 5px 8px; border-radius: 8px;
          background: var(--surface); border: 1px solid var(--surface-border);
          color: var(--text-secondary); font-size: 11px; font-weight: 700; cursor: pointer;
          transition: all .14s; line-height: 1; font-family: 'Outfit', sans-serif;
        }
        .disc-ctrl:hover, .disc-ctrl.on {
          background: var(--accent-bg-soft);
          border-color: var(--accent-border); color: var(--accent);
        }
        .disc-ctrl.has-lbl { gap: 5px; }

        .disc-dd { position: relative; }
        .disc-dd-menu {
          position: absolute; top: calc(100% + 5px); left: 0;
          min-width: 155px; background: var(--glass-strong);
          border: 1px solid var(--surface-border); border-radius: 10px;
          padding: 5px; z-index: 200;
          box-shadow: 0 10px 28px var(--shadow);
          animation: ddIn .14s ease;
        }
        .disc-dd-right { left: auto; right: 0; }
        @keyframes ddIn { from{opacity:0;transform:translateY(-5px)} to{opacity:1;transform:translateY(0)} }
        .disc-dd-item {
          width: 100%; display: flex; align-items: center; gap: 7px;
          padding: 8px 10px; background: transparent; border: none; border-radius: 7px;
          color: var(--text-secondary); font-size: 11.5px; font-weight: 700; cursor: pointer;
          transition: all .12s; text-align: left; font-family: 'Outfit', sans-serif;
        }
        .disc-dd-item:hover { background: var(--accent-bg-soft); color: var(--text); }
        .disc-dd-item.on { background: var(--accent-bg-soft); color: var(--accent); }

        /* Search */
        .disc-search-bar {
          display: flex; align-items: center; gap: 7px;
          padding: 9px 11px; border-radius: 10px; margin-bottom: 10px;
          background: var(--surface-elevated); border: 1px solid var(--surface-border);
          animation: ddIn .18s ease; position: relative; z-index: 9;
        }
        .disc-search-inp { flex:1; background:transparent; border:none; color:var(--text); font-size:13px; outline:none; font-family:'Outfit',sans-serif; }
        .disc-search-inp::placeholder { color:var(--text-muted); }
        .disc-search-x { background:none; border:none; color:var(--text-muted); cursor:pointer; display:flex; align-items:center; padding:0; transition:color .12s; }
        .disc-search-x:hover { color:var(--accent); }

        /* Grid */
        .disc-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 10px;
          position: relative;
          z-index: 1;
        }

        /* Card — isolation:isolate creates new stacking context */
        .disc-card {
          position: relative; overflow: hidden;
          border-radius: 14px;
          background: linear-gradient(135deg, var(--surface-elevated) 0%, var(--panel) 100%);
          border: 1.5px solid var(--surface-border);
          transition: border-color .28s, transform .28s, box-shadow .28s;
          animation: cardIn .36s ease backwards;
          isolation: isolate;
          box-shadow: 0 10px 28px var(--shadow-soft);
        }
        @keyframes cardIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .disc-card:hover {
          border-color: var(--accent-border-strong);
          transform: translateY(-3px);
          box-shadow: 0 14px 36px var(--accent-shadow);
        }

        /* Accent — pointer-events:none is KEY, never blocks clicks */
        .disc-card-accent {
          position: absolute; inset: 0;
          opacity: 0; transition: opacity .28s;
          pointer-events: none;
          z-index: 0;
        }
        .disc-card:hover .disc-card-accent { opacity: .055; }

        /* Body at z-index:1 */
        .disc-card-body { padding: 12px; position: relative; z-index: 1; }

        .disc-card-head { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 8px; }
        .disc-avatar {
          width: 46px; height: 46px; border-radius: 11px;
          flex-shrink: 0; display: flex; align-items: center;
          justify-content: center; font-size: 22px; position: relative;
          box-shadow: 0 3px 12px var(--shadow);
          transition: transform .28s cubic-bezier(.4,0,.2,1);
        }
        .disc-card:hover .disc-avatar { transform: scale(1.05) rotate(2deg); }
        .disc-premium {
          position: absolute; top: -3px; right: -3px;
          width: 15px; height: 15px; border-radius: 50%;
          background: var(--panel-strong); border: 1.5px solid #ffd700;
          display: flex; align-items: center; justify-content: center;
        }

        .disc-card-info { flex: 1; min-width: 0; }
        .disc-card-name {
          font-size: 13.5px; font-weight: 800; color: var(--text);
          margin-bottom: 3px; display: flex; align-items: center; gap: 4px;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .disc-card-meta { display: flex; align-items: center; gap: 4px; }
        .disc-cs { display: flex; align-items: center; gap: 3px; color: var(--text-secondary); font-size: 10.5px; font-weight: 600; }
        .disc-cs.online { color: var(--brand-success); }
        .disc-cs-dot { color: var(--text-muted); font-size: 10px; }
        .disc-pulse { width: 5px; height: 5px; border-radius: 50%; background: var(--brand-success); box-shadow: 0 0 5px var(--brand-success); }

        .disc-card-desc {
          color: var(--text-secondary); font-size: 11.5px; line-height: 1.45; margin-bottom: 8px;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }
        .disc-card-tags { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 8px; }
        .disc-tag {
          padding: 2px 7px; border-radius: 5px; font-size: 10px; font-weight: 700;
          background: var(--accent-bg-soft); border: 1px solid var(--accent-border); color: var(--accent);
        }

        /* Buttons — z-index:2, always above accent */
        .disc-card-actions { display: flex; gap: 6px; position: relative; z-index: 2; }
        .dca-btn {
          flex: 1; padding: 8px; border-radius: 8px; font-size: 11.5px; font-weight: 800;
          cursor: pointer; border: none; transition: all .2s;
          display: flex; align-items: center; justify-content: center; gap: 4px;
          font-family: 'Outfit', sans-serif;
        }
        .dca-btn.join { background: var(--accent-gradient); color: var(--accent-contrast); box-shadow: 0 2px 8px var(--accent-shadow); }
        .dca-btn.join:hover { box-shadow: 0 4px 16px var(--accent-shadow-strong); transform: translateY(-1px); }
        .dca-btn.joined { background: var(--accent-bg-soft); border: 1.5px solid var(--accent-border); color: var(--accent); }
        .dca-btn.details { background: var(--surface); border: 1.5px solid var(--surface-border); color: var(--text-secondary); }
        .dca-btn.details:hover { border-color: var(--accent-border); color: var(--accent); transform: translateY(-1px); }
        .dca-btn.view { background: var(--surface); border: 1.5px solid var(--surface-border); color: var(--text-secondary); }
        .dca-btn.view:hover { border-color: var(--accent-border); color: var(--accent); transform: translateY(-1px); }

        /* Empty state */
        .disc-empty {
          grid-column: 1/-1; text-align: center; padding: 48px 20px;
          display: flex; flex-direction: column; align-items: center; gap: 8px;
        }
        .disc-empty-emoji { font-size: 48px; opacity: .28; animation: float 3s ease-in-out infinite; }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        .disc-empty h3 { font-size: 16px; font-weight: 800; color: var(--text); margin: 0; }
        .disc-empty p { color: var(--text-secondary); font-size: 12px; margin: 0; }

        @media (max-width: 768px) {
          .disc-root { padding: 7px 9px 20px; }
          .disc-grid { grid-template-columns: 1fr; gap: 8px; }
        }
        @media (max-width: 360px) {
          .disc-ctrl.has-lbl span { display: none; }
          .disc-ctrl.has-lbl { padding: 5px 7px; }
        }
      `}</style>
    </>
  );
};

export default DiscoverTab;