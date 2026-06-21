// src/components/Home/NewsTab.jsx  — v18
// FIX: NewBanner (position:fixed portal) is strictly gated by isActive prop.
// Only renders the portal when News tab is the active tab.
// Prevents "new articles" badge from bleeding into Posts/Reels/Stories.

import React, { useState, useEffect, useRef, useCallback, useImperativeHandle, useMemo } from "react";
import ReactDOM from "react-dom";
import { Globe, Bitcoin, MapPin, Newspaper, ArrowUp, RefreshCw, Zap } from "lucide-react";
import SectionHeader from "../Shared/SectionHeader";
import { supabase } from "../../services/config/supabase";
import {
  getNewsEngine, TIER, getTier, detectLiveStatus,
  articleKey, filterByAge, getPrefetchedArticles, bustAndRefetch,
} from "../../services/news/newsRealtime";
import NewsCard  from "./NewsCard";
import VideoCard from "./VideoCard";

const CATEGORIES = [
  { id:null,     label:"All",    Icon:Newspaper },
  { id:"global", label:"Global", Icon:Globe     },
  { id:"africa", label:"Africa", Icon:MapPin    },
  { id:"crypto", label:"Crypto", Icon:Bitcoin   },
];

function makeDbQuery(category) {
  let cancelled = false;
  const promise = (async () => {
    try {
      let q = supabase.from("news_posts")
        .select("id,title,description,image_url,source_name,source_url,article_url,category,region,asset_tag,url_hash,published_at,is_active")
        .eq("is_active", true).order("published_at",{ascending:false}).limit(200);
      if (category) q = q.eq("category", category);
      const { data, error } = await q;
      if (cancelled||error) return [];
      return filterByAge(data||[]).map(r => {
        const liveStatus = detectLiveStatus(r.title||"", r.published_at||"");
        return { ...r, liveStatus, tier: liveStatus==="live" ? TIER.LIVE : getTier(r.published_at) };
      });
    } catch { return []; }
  })();
  return { promise, cancel: () => { cancelled = true; } };
}

function mergeArticles(existing, incoming) {
  const map = new Map();
  for (const a of existing) { const k=articleKey(a); if(k) map.set(k,a); }
  for (const a of incoming) {
    const k=articleKey(a); if(!k) continue;
    const prev=map.get(k);
    if(!prev||(a.tier??TIER.ARCHIVE)<=(prev.tier??TIER.ARCHIVE)) map.set(k,a);
  }
  return filterByAge(Array.from(map.values())).sort((a,b)=>{
    const ta=a.tier??TIER.ARCHIVE,tb=b.tier??TIER.ARCHIVE;
    return ta!==tb?ta-tb:new Date(b.published_at)-new Date(a.published_at);
  });
}

function mergeVideos(existing, incoming) {
  const map = new Map(existing.map(v=>[v.videoId,v]));
  for (const v of incoming) {
    const prev=map.get(v.videoId);
    if(!prev||v.isLiveBroadcast||(v.tier??TIER.ARCHIVE)<(prev.tier??TIER.ARCHIVE)) map.set(v.videoId,v);
  }
  return Array.from(map.values())
    .sort((a,b)=>{const ta=a.tier??TIER.RECENT,tb=b.tier??TIER.RECENT;return ta!==tb?ta-tb:new Date(b.published_at)-new Date(a.published_at);})
    .slice(0,100);
}

function getMeasuredSafeTop() {
  let max=0;
  try {
    for (const el of document.querySelectorAll("*")) {
      const s=window.getComputedStyle(el),p=s.position;
      if(p!=="fixed"&&p!=="sticky") continue;
      const r=el.getBoundingClientRect();
      if(r.top<10&&r.bottom>max&&r.width>60) max=r.bottom;
    }
  } catch {}
  return Math.max(max,56)+10;
}

// ── NewBanner — STRICTLY gated by isActive===true ────────────────────────────
// This component is the single source of truth for the "new articles" portal.
// It MUST NOT render unless isActive is true. Any parent that mounts NewsTab
// hidden (display:none) must pass isActive=false so the portal stays suppressed.
const NewBanner = ({ count, onShow, isActive }) => {
  const [topPx, setTopPx] = useState(()=>getMeasuredSafeTop());
  useEffect(()=>{
    const id=requestAnimationFrame(()=>setTopPx(getMeasuredSafeTop()));
    const onR=()=>setTopPx(getMeasuredSafeTop());
    window.addEventListener("resize",onR,{passive:true});
    return()=>{cancelAnimationFrame(id);window.removeEventListener("resize",onR);};
  },[]);

  // Hard gate — both conditions required before we even touch the DOM
  if (!isActive || !count) return null;

  return ReactDOM.createPortal(
    <>
      <button className="ntb-pill" style={{top:topPx}} onClick={onShow}>
        <ArrowUp size={13}/>{count} new article{count!==1?"s":""}
      </button>
      <style>{`
        .ntb-pill{
          position:fixed;left:50%;transform:translateX(-50%);z-index:9999;
          display:inline-flex;align-items:center;gap:7px;
          padding:9px 22px;border-radius:999px;
          background:rgba(37,99,235,0.97);
          border:1px solid rgba(255,255,255,0.22);
          color:#fff;font-size:13px;font-weight:700;cursor:pointer;
          white-space:nowrap;font-family:inherit;
          box-shadow:0 6px 30px rgba(37,99,235,0.5);
          backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
          animation:ntbIn .35s cubic-bezier(0.34,1.2,0.64,1) both;
        }
        .ntb-pill:hover{background:rgba(29,78,216,1);transform:translateX(-50%) scale(1.04);}
        .ntb-pill:active{transform:translateX(-50%) scale(0.97);}
        @keyframes ntbIn{
          from{opacity:0;transform:translateX(-50%) translateY(-20px) scale(0.88);}
          to{opacity:1;transform:translateX(-50%) translateY(0) scale(1);}
        }
      `}</style>
    </>,
    document.body
  );
};

const ScrollFAB = () => {
  const [show,setShow]=useState(false),[atTop,setAtTop]=useState(true),[atBot,setAtBot]=useState(false);
  const getS=useCallback(()=>{for(const s of[".main-content-desktop",".main-content-mobile"]){const el=document.querySelector(s);if(el&&el.scrollHeight>el.clientHeight)return el;}return null;},[]);
  useEffect(()=>{
    const u=()=>{const el=getS(),top=el?el.scrollTop:window.scrollY,sh=el?el.scrollHeight:document.documentElement.scrollHeight,ch=el?el.clientHeight:window.innerHeight;setAtTop(top<120);setAtBot(top+ch>=sh-120);setShow(top>300);};
    const t=getS()||window;t.addEventListener("scroll",u,{passive:true});u();return()=>t.removeEventListener("scroll",u);
  },[getS]);
  const go=(dir)=>{const el=getS(),t=dir==="top"?0:el?el.scrollHeight:document.documentElement.scrollHeight;if(el)el.scrollTo({top:t,behavior:"smooth"});else window.scrollTo({top:t,behavior:"smooth"});};
  if(!show)return null;
  return(
    <>
      <div className="ntfab-pill">
        <button className={`ntfab-btn${atTop?" ntfab-dim":""}`} onClick={()=>!atTop&&go("top")} disabled={atTop}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
        </button>
        <div className="ntfab-sep"/>
        <button className={`ntfab-btn${atBot?" ntfab-dim":""}`} onClick={()=>!atBot&&go("bottom")} disabled={atBot}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
      </div>
      <style>{`.ntfab-pill{position:fixed;right:18px;top:50%;transform:translateY(-50%);z-index:7900;display:flex;flex-direction:column;align-items:center;background:rgba(12,12,12,0.94);border:1px solid rgba(59,130,246,0.22);border-radius:14px;overflow:hidden;backdrop-filter:blur(16px);box-shadow:0 8px 32px rgba(0,0,0,0.55);animation:ntfabIn .25s cubic-bezier(0.34,1.2,0.64,1) both;}@keyframes ntfabIn{from{opacity:0;transform:translateY(-50%) scale(0.8)}to{opacity:1;transform:translateY(-50%) scale(1)}}.ntfab-btn{width:38px;height:38px;display:flex;align-items:center;justify-content:center;background:transparent;border:none;color:#60a5fa;cursor:pointer;transition:background .15s,transform .1s;padding:0;}.ntfab-btn:not(.ntfab-dim):hover{background:rgba(59,130,246,0.12);transform:scale(1.1);}.ntfab-btn.ntfab-dim{color:rgba(255,255,255,0.15);cursor:default;}.ntfab-sep{width:22px;height:1px;background:rgba(59,130,246,0.12);}@media(max-width:768px){.ntfab-pill{right:10px;}}`}</style>
    </>
  );
};

const ScrollSentinel = ({ onVisible, disabled }) => {
  const ref=useRef(null),cool=useRef(false);
  useEffect(()=>{
    if(!ref.current||disabled)return;
    const obs=new IntersectionObserver(([e])=>{if(e.isIntersecting&&!cool.current){cool.current=true;onVisible();setTimeout(()=>{cool.current=false;},2000);}},{rootMargin:"500px",threshold:0});
    obs.observe(ref.current);return()=>obs.disconnect();
  },[disabled,onVisible]);
  return <div ref={ref} style={{height:4}} aria-hidden="true"/>;
};

const LoadingMore=()=>(<div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,padding:"24px 16px",color:"rgba(255,255,255,0.32)",fontSize:13,fontWeight:600}}><div style={{width:17,height:17,border:"2px solid rgba(59,130,246,0.18)",borderTopColor:"#60a5fa",borderRadius:"50%",animation:"ntSpin .8s linear infinite"}}/>Loading more…<style>{`@keyframes ntSpin{to{transform:rotate(360deg)}}`}</style></div>);
const EndOfFeed=()=>(<div style={{display:"flex",alignItems:"center",gap:12,padding:"28px 20px",color:"rgba(255,255,255,0.18)",fontSize:12,fontWeight:600,letterSpacing:"0.05em",textTransform:"uppercase"}}><div style={{flex:1,height:1,background:"rgba(255,255,255,0.06)"}}/>You're all caught up<div style={{flex:1,height:1,background:"rgba(255,255,255,0.06)"}}/></div>);
const SkeletonCard=({tall})=>(<div style={{margin:"0 0 6px",background:"rgba(255,255,255,0.025)",overflow:"hidden",borderRadius:4}}><div style={{height:tall?240:210,background:"rgba(255,255,255,0.055)",animation:"ntSkel 1.4s ease-in-out infinite"}}/><div style={{padding:"12px 14px"}}><div style={{height:13,borderRadius:7,background:"rgba(255,255,255,0.055)",marginBottom:8,width:"82%",animation:"ntSkel 1.4s ease-in-out infinite"}}/><div style={{height:11,borderRadius:6,background:"rgba(255,255,255,0.035)",width:"55%",animation:"ntSkel 1.4s ease-in-out infinite"}}/></div><style>{`@keyframes ntSkel{0%,100%{opacity:.55}50%{opacity:.18}}`}</style></div>);
const BreakingWrapper=({post,currentUser})=>(<div style={{marginBottom:6}}><div className="ntbrk-bar"><Zap size={11}/> BREAKING NEWS<span className="ntbrk-src">{post.source_name}</span></div><NewsCard post={post} currentUser={currentUser}/><style>{`.ntbrk-bar{display:flex;align-items:center;gap:6px;padding:5px 14px;background:rgba(239,68,68,0.12);border-bottom:1px solid rgba(239,68,68,0.2);font-size:10px;font-weight:900;color:#f87171;letter-spacing:.08em;animation:ntbrkP 2s ease-in-out infinite;}@keyframes ntbrkP{0%,100%{background:rgba(239,68,68,0.12)}50%{background:rgba(239,68,68,0.22)}}.ntbrk-src{margin-left:auto;font-size:9px;font-weight:700;color:rgba(255,255,255,0.35);letter-spacing:0;}`}</style></div>);

// ── NewsTab ───────────────────────────────────────────────────────────────────
const NewsTab = React.forwardRef(function NewsTab(
  { newsPosts:initialNews=[], hasMore=false, isLoadingMore=false, onLoadMore, currentUser, isActive=false },
  ref
) {
  const { sync:prefetchedSync } = getPrefetchedArticles();
  const initialArticles = prefetchedSync
    ? prefetchedSync
    : filterByAge(initialNews.map(a=>({...a,liveStatus:detectLiveStatus(a.title||"",a.published_at||""),tier:getTier(a.published_at)})));

  const [articles,    setArticles]    = useState(initialArticles);
  const [videos,      setVideos]      = useState([]);
  const [activeFilter,setActiveFilter]= useState(null);
  const [pendingCount,setPendingCount]= useState(0);
  const [fetching,    setFetching]    = useState(!prefetchedSync&&initialNews.length===0);
  const [initialDone, setInitialDone] = useState(prefetchedSync?true:initialNews.length>0);

  const firstBatchRef=useRef(false),pendingRef=useRef([]),cancelDbRef=useRef(null),filterMountRef=useRef(false);

  useImperativeHandle(ref,()=>({
    prependNews:(items)=>setArticles(prev=>mergeArticles(prev,items.map(a=>({...a,liveStatus:detectLiveStatus(a.title||"",a.published_at||""),tier:getTier(a.published_at)})))),
  }));

  useEffect(()=>{
    const engine=getNewsEngine(); engine.start();
    if(prefetchedSync){engine.seedSeen(prefetchedSync,[]);engine.seedInFeed(prefetchedSync);setInitialDone(true);setFetching(false);return;}
    setFetching(true);
    const {promise}=getPrefetchedArticles(); let cancelled=false;
    (promise||Promise.resolve([])).then(data=>{if(cancelled)return;setFetching(false);setInitialDone(true);if(data.length){engine.seedSeen(data,[]);engine.seedInFeed(data);setArticles(data);}});
    const timer=setTimeout(()=>setInitialDone(true),5000);
    return()=>{cancelled=true;clearTimeout(timer);};
  },[]); // eslint-disable-line

  useEffect(()=>{
    const engine=getNewsEngine();
    const unsubArt=engine.on("newArticles",items=>{
      setInitialDone(true);
      const filtered=activeFilter?items.filter(a=>(a.category||"").toLowerCase()===activeFilter):items;
      if(!filtered.length)return;
      const urgent=filtered.filter(a=>(a.tier??TIER.RECENT)<=TIER.BREAKING);
      const nonUrgent=filtered.filter(a=>(a.tier??TIER.RECENT)>TIER.BREAKING);
      if(urgent.length){engine.markInFeed(urgent);setArticles(prev=>mergeArticles(prev,urgent));}
      if(!firstBatchRef.current){firstBatchRef.current=true;if(nonUrgent.length){engine.markInFeed(nonUrgent);setArticles(prev=>mergeArticles(prev,nonUrgent));}}
      else{const trulyNew=nonUrgent.filter(a=>engine.isNewForFeed(a.url_hash||a.id||""));if(trulyNew.length){pendingRef.current=[...trulyNew,...pendingRef.current];setPendingCount(pendingRef.current.length);}}
    });
    const unsubVid=engine.on("newVideos",items=>setVideos(prev=>mergeVideos(prev,items)));
    const unsubLive=engine.on("liveDetected",streams=>setVideos(prev=>mergeVideos(prev,streams)));
    return()=>{unsubArt();unsubVid();unsubLive();};
  },[]); // eslint-disable-line

  useEffect(()=>{
    if(!filterMountRef.current){filterMountRef.current=true;return;}
    if(cancelDbRef.current)cancelDbRef.current();
    setFetching(true);
    const{promise,cancel}=makeDbQuery(activeFilter);cancelDbRef.current=cancel;
    promise.then(data=>{setFetching(false);if(data.length)setArticles(data);});
    return()=>cancel();
  },[activeFilter]);

  const flushPending=useCallback(()=>{
    if(!pendingRef.current.length)return;
    const toAdd=pendingRef.current;pendingRef.current=[];setPendingCount(0);
    const engine=getNewsEngine();engine.markInFeed(toAdd);setArticles(prev=>mergeArticles(prev,toAdd));
    const s=document.querySelector(".main-content-desktop,.main-content-mobile");
    if(s)s.scrollTo({top:0,behavior:"smooth"});else window.scrollTo({top:0,behavior:"smooth"});
  },[]);

  const handleRefresh=useCallback(async()=>{
    if(fetching)return;setFetching(true);pendingRef.current=[];setPendingCount(0);firstBatchRef.current=false;
    if(cancelDbRef.current)cancelDbRef.current();
    const engine=getNewsEngine();engine._fetchAllSources?.();engine._fetchAllVideos?.();
    const refetchPromise=bustAndRefetch();
    const{promise,cancel}=activeFilter?makeDbQuery(activeFilter):{promise:refetchPromise,cancel:()=>{}};
    cancelDbRef.current=cancel;const data=await promise;
    if(data.length){engine.seedInFeed(data);setArticles(data);}setFetching(false);
  },[fetching,activeFilter]);

  const handleSentinel=useCallback(()=>{if(!isLoadingMore&&hasMore&&onLoadMore)onLoadMore();},[isLoadingMore,hasMore,onLoadMore]);

  const feed=useMemo(()=>{
    const cat=activeFilter;
    const fArt=cat?articles.filter(a=>(a.category||"").toLowerCase()===cat):articles;
    const fVid=cat?videos.filter(v=>v.category===cat):videos;
    const liveVid=fVid.filter(v=>v.isLiveBroadcast||v.tier===TIER.LIVE);
    const regularVid=fVid.filter(v=>!v.isLiveBroadcast&&v.tier!==TIER.LIVE);
    const breaking=fArt.filter(a=>a.tier===TIER.BREAKING);
    const fresh=fArt.filter(a=>a.tier===TIER.FRESH);
    const rest=fArt.filter(a=>a.tier>=TIER.RECENT);
    const result=[...liveVid,...breaking,...fresh];let vi=0;
    for(let i=0;i<rest.length;i++){if(i%4===0&&vi<regularVid.length){result.push(regularVid[vi]);vi++;}result.push(rest[i]);}
    while(vi<regularVid.length&&vi<8){result.push(regularVid[vi]);vi++;}
    return result;
  },[articles,videos,activeFilter]);

  const allFeedVideos=useMemo(()=>feed.filter(f=>f._type==="video"),[feed]);

  return (
    <div className="nt-root">
      {/* Banner — portal, strictly gated: isActive AND count > 0 */}
      <NewBanner count={pendingCount} onShow={flushPending} isActive={isActive}/>
      <SectionHeader icon={Newspaper} title="News" subtitle="Top headlines and live updates" />

      <div className="nt-bar">
        {CATEGORIES.map(({id,label,Icon})=>(
          <button key={String(id)} className={`nt-chip${activeFilter===id?" nt-chip--on":""}`} onClick={()=>setActiveFilter(id)}>
            <Icon size={11}/>{label}
          </button>
        ))}
        <button className={`nt-ref${fetching?" nt-ref--spin":""}`} onClick={handleRefresh} disabled={fetching} title="Refresh"><RefreshCw size={13}/></button>
        {fetching&&<span className="nt-dot"/>}
      </div>

      {!initialDone&&[1,2,3,4].map(i=><SkeletonCard key={i} tall={i%2===0}/>)}

      {initialDone&&feed.map(item=>{
        if(item._type==="video")return(<div key={item.videoId} style={{marginBottom:6}}><VideoCard video={item} allVideos={allFeedVideos}/></div>);
        if(item.tier===TIER.BREAKING)return<BreakingWrapper key={articleKey(item)} post={item} currentUser={currentUser}/>;
        return(<div key={articleKey(item)} style={{marginBottom:6}}><NewsCard post={item} currentUser={currentUser}/></div>);
      })}

      {initialDone&&feed.length===0&&(
        <div style={{padding:"48px 20px",textAlign:"center"}}>
          <Newspaper size={36} style={{opacity:0.15,marginBottom:12,color:"#fff"}}/>
          <p style={{fontSize:15,fontWeight:600,color:"rgba(255,255,255,0.3)",margin:"0 0 14px"}}>No {activeFilter?activeFilter+" ":""}news yet.</p>
          <button onClick={handleRefresh} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"8px 18px",borderRadius:999,background:"rgba(59,130,246,0.1)",border:"1px solid rgba(59,130,246,0.25)",color:"#60a5fa",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}><RefreshCw size={12}/> Try again</button>
        </div>
      )}

      <ScrollSentinel onVisible={handleSentinel} disabled={!hasMore||isLoadingMore}/>
      {isLoadingMore&&<LoadingMore/>}
      {!hasMore&&feed.length>0&&<EndOfFeed/>}
      <ScrollFAB/>
      <style>{NT_CSS}</style>
    </div>
  );
});

const NT_CSS=`.nt-root{width:100%;}.nt-bar{display:flex;align-items:center;gap:7px;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.05);overflow-x:auto;scrollbar-width:none;position:sticky;top:0;z-index:50;background:rgba(8,8,8,0.98);backdrop-filter:blur(16px);}.nt-bar::-webkit-scrollbar{display:none;}.nt-chip{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:999px;border:1px solid rgba(255,255,255,0.09);background:rgba(255,255,255,0.03);color:rgba(255,255,255,0.4);font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;font-family:inherit;transition:all .18s;flex-shrink:0;}.nt-chip:hover{background:rgba(59,130,246,0.08);border-color:rgba(59,130,246,0.24);color:#60a5fa;}.nt-chip--on{background:rgba(59,130,246,0.12);border-color:rgba(59,130,246,0.34);color:#60a5fa;}.nt-ref{margin-left:auto;flex-shrink:0;width:30px;height:30px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);color:rgba(255,255,255,0.32);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;}.nt-ref:hover{background:rgba(59,130,246,0.1);color:#60a5fa;border-color:rgba(59,130,246,0.24);}.nt-ref:disabled{cursor:default;}@keyframes ntRS{to{transform:rotate(360deg)}}.nt-ref--spin svg{animation:ntRS .8s linear infinite;}.nt-dot{width:6px;height:6px;border-radius:50%;background:#60a5fa;flex-shrink:0;animation:ntDP 1s ease-in-out infinite;}@keyframes ntDP{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.28;transform:scale(.55)}}`;

export default NewsTab;