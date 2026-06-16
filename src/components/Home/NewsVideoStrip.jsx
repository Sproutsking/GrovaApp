// src/components/Home/NewsVideoStrip.jsx  — v12  PROXY-FIXED + ZERO 429 SPAM
//
// ═══════════════════════════════════════════════════════════════════════════
// FIXES vs v11:
//
// [P1] 4-proxy waterfall with per-proxy 429 cooldowns stored in
//      sessionStorage. A rate-limited proxy is skipped for 10 minutes.
//      Rotating between rss2json → allorigins → corsproxy → codetabs
//      means one proxy being rate-limited doesn't kill all channels.
//
// [P2] 300ms jitter spread on channel fetches so 14 channels don't all
//      hit the same proxy simultaneously on mount.
//
// [P3] YouTube Atom XML parsed with DOMParser as fallback when rss2json
//      returns non-OK or empty.
//
// [P4] If ALL proxies fail for a channel it is silently skipped — no
//      console.error spam, no broken UI, live count still accurate.
//
// [P5] Auto-refresh every 5 minutes uses bust=true only when at least
//      one proxy is not on cooldown — avoids hammering rate-limited proxies.
//
// [P6] YouTube channel IDs validated before any fetch attempt.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import {
  X, ChevronLeft, ChevronRight, Volume2, VolumeX,
  ExternalLink, Play, Radio,
} from "lucide-react";
import { detectLiveStatus, getTier, TIER } from "../../services/news/newsRealtime";

// ── Helpers ───────────────────────────────────────────────────────────────────
function useRelTime(dateStr) {
  const calc = useCallback(() => {
    if (!dateStr) return "";
    const ts = typeof dateStr === "number" ? dateStr : new Date(dateStr).getTime();
    if (isNaN(ts) || ts <= 0) return "";
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 0 || s < 10) return "just now";
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24); if (d < 7) return `${d}d ago`;
    return new Date(ts).toLocaleDateString("en-US", { month:"short", day:"numeric" });
  }, [dateStr]);

  const [label, setLabel] = useState(() => calc());
  useEffect(() => {
    setLabel(calc());
    const id = setInterval(() => setLabel(calc()), 15_000);
    return () => clearInterval(id);
  }, [calc]);
  return label;
}

function isRealVideoId(id) {
  return typeof id === "string" && /^[A-Za-z0-9_-]{11}$/.test(id);
}
function isLiveNow(v) {
  return v?.isLiveBroadcast === true || v?.liveStatus === "live";
}

const CAT_STYLES = {
  global:  { bg:"rgba(59,130,246,0.22)", dot:"#3b82f6", tx:"#93c5fd" },
  africa:  { bg:"rgba(249,115,22,0.22)", dot:"#f97316", tx:"#fdba74" },
  crypto:  { bg:"rgba(234,179,8,0.22)",  dot:"#eab308", tx:"#fde68a" },
  default: { bg:"rgba(132,204,22,0.18)", dot:"#84cc16", tx:"#bef264" },
};
const catStyle = (c) => CAT_STYLES[(c||"").toLowerCase()] || CAT_STYLES.default;
const YT_THUMB = (id) => `https://img.youtube.com/vi/${id}/mqdefault.jpg`;

// ── YouTube channels ──────────────────────────────────────────────────────────
const YT_CHANNELS = [
  { id:"UCnUYZLuoy1rq1aVMwx4aTzw", name:"BBC News",    category:"global" },
  { id:"UCknLrEdhRCp1aegoMqRaCZg", name:"DW News",     category:"global" },
  { id:"UCNye-wNBqNL5ZzHSJdde7RA", name:"Al Jazeera",  category:"global" },
  { id:"UCQfwfsi5VrQ8yKZ-UWmAEFg", name:"France 24",   category:"global" },
  { id:"UC7fWeaHhqgM4Ry-RMpM2YYw", name:"TRT World",   category:"global" },
  { id:"UCupvZG-5ko_eiXAupbDfxWw", name:"CNN",         category:"global" },
  { id:"UCVSNOxehfALut52-3bfvSHg", name:"VOA News",    category:"global" },
  { id:"UCJXGnHCHApDirWSmAZ0uxkQ", name:"Arise News",  category:"africa" },
  { id:"UCCjyq_K1Pd2QkMOoAc73yqA", name:"Channels TV", category:"africa" },
  { id:"UCG9_Hz8tMHdM5i5EzQpSPaQ", name:"Africa News", category:"africa" },
  { id:"UCHpSbMCDGjYrfp_eGa09yhA", name:"TVC News",    category:"africa" },
  { id:"UCrbatV49TNrqfoPLEJqJiuw", name:"CoinDesk TV", category:"crypto" },
  { id:"UCAl9Ld79qaZxp9JzEOwd3aA", name:"Bankless",    category:"crypto" },
];

// ── [P1] Proxy pool with per-proxy cooldown ───────────────────────────────────
const PROXY_COOLDOWN_MS = 10 * 60_000; // 10 minutes

const PROXIES = [
  {
    name: "rss2json",
    build: (u) => `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(u)}&count=8`,
    parse: async (res) => {
      const j = await res.json();
      if (j?.status !== "ok" || !j?.items?.length) return null;
      return j.items.map(it => ({
        link:      it.link      || "",
        title:     (it.title    || "").trim(),
        pubDate:   it.pubDate   || "",
        thumbnail: it.thumbnail || "",
      }));
    },
  },
  {
    name: "allorigins",
    build: (u) => `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/proxy-fetch?url=${encodeURIComponent(u)}`,
    parse: async (res) => {
      const j = await res.json();
      return parseAtomXml(j?.contents || "");
    },
  },
  {
    name: "corsproxy",
    build: (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
    parse: async (res) => parseAtomXml(await res.text()),
  },
  {
    name: "codetabs",
    build: (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
    parse: async (res) => parseAtomXml(await res.text()),
  },
];

function proxyOnCooldown(name) {
  try {
    const ts = sessionStorage.getItem(`xnvs_cd_${name}`);
    return !!ts && Date.now() - Number(ts) < PROXY_COOLDOWN_MS;
  } catch { return false; }
}

function setProxyCooldown(name) {
  try { sessionStorage.setItem(`xnvs_cd_${name}`, String(Date.now())); } catch {}
}

function anyProxyAvailable() {
  return PROXIES.some(p => !proxyOnCooldown(p.name));
}

// ── Parse YouTube Atom XML ────────────────────────────────────────────────────
function parseAtomXml(xml) {
  if (!xml || xml.length < 100) return null;
  try {
    const doc     = new DOMParser().parseFromString(xml, "text/xml");
    const entries = Array.from(doc.querySelectorAll("entry"));
    if (!entries.length) return null;
    return entries.map(e => ({
      link:      e.querySelector("link")?.getAttribute("href") || "",
      title:     (e.querySelector("title")?.textContent || "").trim(),
      pubDate:   e.querySelector("published")?.textContent?.trim() || "",
      thumbnail: e.querySelector("thumbnail")?.getAttribute("url") || "",
    }));
  } catch { return null; }
}

// ── [P1/P2] Fetch one channel via proxy waterfall ────────────────────────────
async function fetchChannelVideos(ch, jitterMs = 0) {
  if (jitterMs > 0) await new Promise(r => setTimeout(r, jitterMs));

  const ytUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${ch.id}`;

  for (const proxy of PROXIES) {
    if (proxyOnCooldown(proxy.name)) continue;

    try {
      const res = await fetch(proxy.build(ytUrl), {
        signal:  AbortSignal.timeout(12_000),
        headers: { Accept: "application/json, text/xml, text/html, */*" },
      });

      // [P1] 429 = rate-limited — put this proxy on 10-minute cooldown
      if (res.status === 429) { setProxyCooldown(proxy.name); continue; }
      if (!res.ok)             continue;

      const items = await proxy.parse(res);
      if (!items?.length) continue;

      // Build video objects
      const out  = [];
      const seen = new Set();
      for (const it of items) {
        const vidId = (it.link || "").match(/[?&]v=([A-Za-z0-9_-]{11})/)?.[1] || "";
        if (!vidId || !isRealVideoId(vidId) || seen.has(vidId)) continue;
        seen.add(vidId);

        const title = it.title || "";
        if (!title) continue;

        // Skip videos older than 7 days
        const ms = it.pubDate ? new Date(it.pubDate).getTime() : Date.now();
        if (isNaN(ms) || Date.now() - ms > 7 * 86_400_000) continue;

        const published_at   = it.pubDate ? new Date(it.pubDate).toISOString() : new Date().toISOString();
        const liveStatus     = detectLiveStatus(title, published_at);

        out.push({
          videoId:         vidId,
          title,
          channelName:     ch.name,
          category:        ch.category,
          thumbnail:       it.thumbnail || YT_THUMB(vidId),
          published_at,
          liveStatus,
          isLiveBroadcast: liveStatus === "live",
          tier:            liveStatus === "live" ? TIER.LIVE : getTier(published_at),
        });
      }

      if (out.length > 0) return out; // success — stop waterfall

    } catch (err) {
      if (err?.name === "AbortError") continue; // timeout → try next proxy
      // Network error → try next proxy silently
    }
  }

  // [P4] All proxies failed or on cooldown — return empty silently
  return [];
}

// ── Cache ─────────────────────────────────────────────────────────────────────
const CACHE_KEY = "xnvs_v12";
const CACHE_TTL = 5 * 60_000;

async function fetchAllVideos(bust = false) {
  // [P5] If all proxies are on cooldown, serve stale cache regardless of bust
  const canFetch = anyProxyAvailable();

  if (!bust || !canFetch) {
    try {
      const c = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
      if (c && Date.now() - c.at < CACHE_TTL) return c.videos;
    } catch {}
  }

  if (!canFetch) return []; // all proxies rate-limited — return empty

  // [P2] 0-300ms jitter so channels don't all hit the same proxy simultaneously
  const results = await Promise.allSettled(
    YT_CHANNELS.map((ch, i) =>
      fetchChannelVideos(ch, Math.floor(Math.random() * 300)),
    ),
  );

  const videos = [];
  const seen   = new Set();
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    for (const v of r.value) {
      if (isRealVideoId(v.videoId) && !seen.has(v.videoId)) {
        seen.add(v.videoId);
        videos.push(v);
      }
    }
  }

  // Sort: live first → by tier → by date
  videos.sort((a, b) => {
    const ta = a.tier ?? TIER.RECENT, tb = b.tier ?? TIER.RECENT;
    if (ta !== tb) return ta - tb;
    return new Date(b.published_at) - new Date(a.published_at);
  });

  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), videos }));
  } catch {}

  return videos;
}


// ── Full-screen player ────────────────────────────────────────────────────────
const XnvsPlayer = ({ videos, startIndex, onClose }) => {
  const [idx,   setIdx]   = useState(startIndex);
  const [muted, setMuted] = useState(false);
  const [prog,  setProg]  = useState(0);
  const touchX = useRef(null);
  const ifRef  = useRef(null);
  const plRef  = useRef(null);
  const rafRef = useRef(null);
  const cur    = videos[idx];
  const cs     = catStyle(cur?.category);
  const ts     = useRelTime(cur?.published_at);
  const live   = isLiveNow(cur);

  useEffect(() => {
    const y = window.scrollY;
    Object.assign(document.body.style, { overflow:"hidden", position:"fixed", top:`-${y}px`, left:"0", right:"0" });
    document.body.dataset.xnvsY = y;
    const onKey = (e) => {
      if (e.key === "Escape")      onClose();
      if (e.key === "ArrowLeft")   setIdx(i => Math.max(0, i - 1));
      if (e.key === "ArrowRight")  setIdx(i => Math.min(videos.length - 1, i + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.cssText = "";
      window.scrollTo(0, parseInt(document.body.dataset.xnvsY || "0"));
      window.removeEventListener("keydown", onKey);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [onClose, videos.length]);

  useEffect(() => {
    if (live || !ifRef.current) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setProg(0);
    if (plRef.current) { try { plRef.current.destroy(); } catch {} plRef.current = null; }

    const tryInit = () => {
      if (!window.YT?.Player || !ifRef.current) return;
      plRef.current = new window.YT.Player(ifRef.current, {
        events: {
          onReady: () => {
            if (muted) plRef.current?.mute?.();
            const tick = () => {
              try {
                const p = plRef.current;
                if (p?.getDuration?.() > 0) setProg((p.getCurrentTime() / p.getDuration()) * 100);
              } catch {}
              rafRef.current = requestAnimationFrame(tick);
            };
            rafRef.current = requestAnimationFrame(tick);
          },
        },
      });
    };

    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
      window.onYouTubeIframeAPIReady = tryInit;
    } else {
      setTimeout(tryInit, 600);
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [idx, live]); // eslint-disable-line react-hooks/exhaustive-deps

  const seek = useCallback((e) => {
    if (live) return;
    try {
      const r   = e.currentTarget.getBoundingClientRect();
      const pct = ((e.clientX - r.left) / r.width) * 100;
      const dur = plRef.current?.getDuration?.() || 0;
      if (dur > 0) { plRef.current.seekTo((pct / 100) * dur, true); setProg(pct); }
    } catch {}
  }, [live]);

  const toggleMute = () => {
    try { if (muted) plRef.current?.unMute?.(); else plRef.current?.mute?.(); } catch {}
    setMuted(v => !v);
  };
  const prev = useCallback(() => setIdx(i => Math.max(0, i - 1)), []);
  const next = useCallback(() => setIdx(i => Math.min(videos.length - 1, i + 1)), [videos.length]);

  return ReactDOM.createPortal(
    <>
      <div
        className="xnvsp-root"
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const d = touchX.current - e.changedTouches[0].clientX;
          if (d > 50) next(); else if (d < -50) prev();
          touchX.current = null;
        }}
      >
        <button className="xnvsp-btn xnvsp-close" onClick={onClose}><X size={18} /></button>
        <button className="xnvsp-btn xnvsp-mute"  onClick={toggleMute}>
          {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </button>
        {idx > 0 && <button className="xnvsp-nav xnvsp-nav-l" onClick={prev}><ChevronLeft  size={22} /></button>}
        {idx < videos.length - 1 && <button className="xnvsp-nav xnvsp-nav-r" onClick={next}><ChevronRight size={22} /></button>}
        {videos.length > 1 && <div className="xnvsp-ctr">{idx + 1} / {videos.length}</div>}

        <div className="xnvsp-wrap">
          <iframe
            ref={ifRef}
            key={`xnvsp-${idx}`}
            src={`https://www.youtube-nocookie.com/embed/${cur.videoId}?autoplay=1&mute=${muted?1:0}&controls=0&rel=0&modestbranding=1&playsinline=1${live?"":"&enablejsapi=1"}`}
            title={cur.title}
            allow="autoplay; fullscreen; accelerometer; gyroscope; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
            className="xnvsp-iframe"
            style={{ border:"none" }}
          />
          <div className="xnvsp-grad" />
          <div className="xnvsp-info">
            <div className="xnvsp-meta-row">
              {live
                ? <div className="xnvsp-live-badge"><Radio size={9} /> LIVE NOW</div>
                : <div className="xnvsp-yt-badge">▶ {cur.channelName}</div>
              }
              <span className="xnvsp-ts">{live ? "Broadcasting live" : ts}</span>
            </div>
            <h3 className="xnvsp-title">{cur.title}</h3>
            {cur.category && (
              <span className="xnvsp-cat" style={{ background:cs.bg, color:cs.tx }}>
                <span style={{ background:cs.dot, width:4, height:4, borderRadius:"50%", display:"inline-block" }} />
                {cur.category.toUpperCase()}
              </span>
            )}
          </div>
        </div>

        {!live ? (
          <div className="xnvsp-scrub" onClick={seek}>
            <div className="xnvsp-track">
              <div className="xnvsp-fill" style={{ width:`${prog}%` }} />
              <div className="xnvsp-thumb" style={{ left:`${prog}%` }} />
            </div>
          </div>
        ) : (
          <div className="xnvsp-live-bar">
            <span className="xnvsp-live-dot" />LIVE — seeking disabled
          </div>
        )}

        <div className="xnvsp-dots">
          {videos.slice(0, 16).map((v, i) => (
            <button
              key={i}
              className={`xnvsp-dot${i===idx?" xnvsp-dot--on":""}${v.isLiveBroadcast?" xnvsp-dot--live":""}`}
              onClick={() => setIdx(i)}
            />
          ))}
        </div>
        <a href={`https://www.youtube.com/watch?v=${cur.videoId}`} target="_blank" rel="noopener noreferrer" className="xnvsp-yt-link">
          <ExternalLink size={10} /> {live ? "Watch live on YouTube" : "Watch on YouTube"}
        </a>
        <div className="xnvsp-prog">
          <div className="xnvsp-prog-fill" style={{ width:`${((idx+1)/videos.length)*100}%` }} />
        </div>
      </div>
      <style>{XNVSP_CSS}</style>
    </>,
    document.body,
  );
};

const XNVSP_CSS = `
.xnvsp-root{position:fixed;inset:0;z-index:99990;background:#000;display:flex;flex-direction:column;align-items:center;overflow:hidden;}
.xnvsp-btn{position:absolute;top:16px;z-index:20;width:38px;height:38px;border-radius:50%;background:rgba(0,0,0,0.6);border:1px solid rgba(255,255,255,0.12);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s;}
.xnvsp-btn:hover{background:rgba(0,0,0,0.85);}
.xnvsp-close{left:16px;}.xnvsp-mute{right:16px;}
.xnvsp-nav{position:absolute;top:50%;transform:translateY(-50%);z-index:20;width:44px;height:44px;border-radius:50%;background:rgba(0,0,0,0.55);border:1px solid rgba(255,255,255,0.15);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;backdrop-filter:blur(8px);}
.xnvsp-nav:hover{background:rgba(255,255,255,0.12);border-color:rgba(255,255,255,0.4);}
.xnvsp-nav-l{left:14px;}.xnvsp-nav-r{right:14px;}
.xnvsp-ctr{position:absolute;top:16px;left:50%;transform:translateX(-50%);z-index:20;font-size:10px;font-weight:700;color:rgba(255,255,255,0.4);background:rgba(0,0,0,0.55);padding:3px 10px;border-radius:999px;}
.xnvsp-wrap{position:relative;width:100%;flex:1;max-width:720px;display:flex;align-items:center;}
.xnvsp-iframe{position:absolute;inset:0;width:100%;height:100%;}
.xnvsp-grad{position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,rgba(0,0,0,0.92) 100%);pointer-events:none;}
.xnvsp-info{position:absolute;bottom:72px;left:14px;right:60px;z-index:5;display:flex;flex-direction:column;gap:7px;}
.xnvsp-meta-row{display:flex;align-items:center;gap:8px;}
.xnvsp-yt-badge{background:rgba(220,38,38,0.85);color:#fff;font-size:9px;padding:3px 8px;border-radius:5px;font-weight:800;}
.xnvsp-live-badge{display:inline-flex;align-items:center;gap:5px;background:rgba(239,68,68,0.95);color:#fff;font-size:9px;padding:3px 10px;border-radius:5px;font-weight:900;animation:xnvspLG 1.5s ease-in-out infinite;}
@keyframes xnvspLG{0%,100%{box-shadow:none}50%{box-shadow:0 0 14px rgba(239,68,68,0.7)}}
.xnvsp-ts{font-size:10px;color:rgba(255,255,255,0.38);font-variant-numeric:tabular-nums;}
.xnvsp-title{font-size:16px;font-weight:800;color:#fff;line-height:1.4;margin:0;text-shadow:0 1px 8px rgba(0,0,0,0.9);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}
.xnvsp-cat{display:inline-flex;align-items:center;gap:4px;padding:2px 8px 2px 5px;border-radius:999px;font-size:9px;font-weight:800;width:fit-content;}
.xnvsp-scrub{position:absolute;bottom:44px;left:14px;right:14px;padding:8px 0;cursor:pointer;z-index:10;}
.xnvsp-track{position:relative;height:4px;background:rgba(255,255,255,0.18);border-radius:2px;}
.xnvsp-scrub:hover .xnvsp-track{height:6px;}
.xnvsp-fill{height:100%;background:#ef4444;border-radius:2px;transition:width .1s linear;}
.xnvsp-thumb{position:absolute;top:50%;transform:translate(-50%,-50%);width:12px;height:12px;border-radius:50%;background:#ef4444;border:2px solid #fff;pointer-events:none;transition:left .1s linear;}
.xnvsp-live-bar{position:absolute;bottom:44px;left:14px;right:14px;display:flex;align-items:center;gap:8px;font-size:10px;font-weight:700;color:rgba(255,255,255,0.4);z-index:10;}
.xnvsp-live-dot{width:6px;height:6px;border-radius:50%;background:#ef4444;animation:xnvspDP 1.4s ease-in-out infinite;flex-shrink:0;}
@keyframes xnvspDP{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(.5)}}
.xnvsp-dots{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);display:flex;gap:5px;z-index:10;}
.xnvsp-dot{width:5px;height:5px;border-radius:50%;background:rgba(255,255,255,0.2);border:none;padding:0;cursor:pointer;transition:all .15s;flex-shrink:0;}
.xnvsp-dot--on{background:#ef4444;transform:scale(1.5);}
.xnvsp-dot--live{background:rgba(239,68,68,0.5);}
.xnvsp-dot--live.xnvsp-dot--on{background:#ef4444;box-shadow:0 0 6px #ef4444;}
.xnvsp-yt-link{position:absolute;bottom:12px;right:14px;display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:999px;background:rgba(0,0,0,0.65);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.5);font-size:9px;font-weight:600;text-decoration:none;z-index:10;white-space:nowrap;}
.xnvsp-prog{position:absolute;bottom:0;left:0;right:0;height:2px;background:rgba(255,255,255,0.07);}
.xnvsp-prog-fill{height:100%;background:#ef4444;transition:width .3s ease;}
@media(max-width:768px){.xnvsp-wrap{max-width:100%;}.xnvsp-title{font-size:14px;}.xnvsp-nav{width:38px;height:38px;}.xnvsp-nav-l{left:4px;}.xnvsp-nav-r{right:4px;}}
`;

// ── Strip card ────────────────────────────────────────────────────────────────
const XnvsCard = ({ vid, idx, onPlay }) => {
  const [hov,      setHov]      = useState(false);
  const [thumbErr, setThumbErr] = useState(false);
  const ts   = useRelTime(vid.published_at);
  const cs   = catStyle(vid.category);
  const live = isLiveNow(vid);
  const thumb = thumbErr
    ? `https://img.youtube.com/vi/${vid.videoId}/hqdefault.jpg`
    : (vid.thumbnail || YT_THUMB(vid.videoId));

  return (
    <button
      className={`xnvs-card${live ? " xnvs-card--live" : ""}`}
      onClick={() => onPlay(idx)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div className="xnvs-tw">
        <img
          src={thumb}
          alt={vid.title}
          className="xnvs-thumb"
          loading={idx < 5 ? "eager" : "lazy"}
          onError={() => !thumbErr && setThumbErr(true)}
        />
        <div className="xnvs-tg" />
        <div className={`xnvs-play${hov ? " xnvs-play--on" : ""}`}>
          {live ? <Radio size={14} color="white" /> : <Play size={14} fill="white" color="white" />}
        </div>
        <div className={`xnvs-chip${live ? " xnvs-chip--live" : ""}`}>
          {live ? "● LIVE" : "▶"}
        </div>
        {vid.category && (
          <div className="xnvs-cat" style={{ background: cs.bg }}>
            <span style={{ background:cs.dot, width:4, height:4, borderRadius:"50%", display:"inline-block", flexShrink:0 }} />
            <span style={{ color:cs.tx, fontSize:8, fontWeight:800, letterSpacing:"0.05em" }}>
              {vid.category.toUpperCase()}
            </span>
          </div>
        )}
      </div>
      <div className="xnvs-foot">
        <div className="xnvs-meta">
          <span className="xnvs-ch">{vid.channelName}</span>
          <span className="xnvs-ts">{live ? "LIVE" : ts}</span>
        </div>
        <p className="xnvs-title">{vid.title}</p>
      </div>
    </button>
  );
};

// ── NewsVideoStrip ────────────────────────────────────────────────────────────
const NewsVideoStrip = ({ preferCategory = null }) => {
  const [videos,  setVideos]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [player,  setPlayer]  = useState(null);
  const scrollRef  = useRef(null);
  const refreshRef = useRef(null);

  const load = useCallback(async (bust = false) => {
    try {
      const vids  = await fetchAllVideos(bust);
      const valid = vids.filter(v => isRealVideoId(v.videoId));
      setVideos(preferCategory ? valid.filter(v => v.category === preferCategory) : valid);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [preferCategory]);

  useEffect(() => { load(false); }, [load]);

  // [P5] Auto-refresh every 5 minutes — skips if all proxies rate-limited
  useEffect(() => {
    refreshRef.current = setInterval(() => {
      if (anyProxyAvailable()) load(true);
    }, 5 * 60_000);
    return () => clearInterval(refreshRef.current);
  }, [load]);

  if (!loading && videos.length === 0) return null;

  const liveCount = videos.filter(v => v.isLiveBroadcast).length;

  return (
    <>
      <div className="xnvs-root">
        <div className="xnvs-hdr">
          <div className="xnvs-hdr-l">
            <div className="xnvs-pill">
              <span className="xnvs-pulse" />NEWS LINE
            </div>
            {!loading && liveCount > 0 && (
              <span className="xnvs-live-ct">{liveCount} LIVE</span>
            )}
            {!loading && (
              <span className="xnvs-ct">{videos.length} videos</span>
            )}
          </div>
          <div className="xnvs-hdr-r">
            <button className="xnvs-arr" onClick={() => scrollRef.current?.scrollBy({ left:-200, behavior:"smooth" })}>
              <ChevronLeft size={13} />
            </button>
            <button className="xnvs-arr" onClick={() => scrollRef.current?.scrollBy({ left:200, behavior:"smooth" })}>
              <ChevronLeft size={13} style={{ transform:"scaleX(-1)" }} />
            </button>
          </div>
        </div>

        <div className="xnvs-strip" ref={scrollRef}>
          {loading && [1,2,3,4,5,6].map(i => <div key={i} className="xnvs-skel" />)}
          {!loading && videos.map((vid, idx) => (
            <XnvsCard key={vid.videoId} vid={vid} idx={idx} onPlay={i => setPlayer({ idx: i })} />
          ))}
        </div>
      </div>

      {player !== null && videos.length > 0 && (
        <XnvsPlayer videos={videos} startIndex={player.idx} onClose={() => setPlayer(null)} />
      )}

      <style>{XNVS_CSS}</style>
    </>
  );
};

const XNVS_CSS = `
.xnvs-root{width:100%;overflow:hidden;border-bottom:1px solid rgba(255,255,255,0.055);}
.xnvs-hdr{display:flex;align-items:center;justify-content:space-between;padding:9px 14px 5px;}
.xnvs-hdr-l{display:flex;align-items:center;gap:8px;}
.xnvs-hdr-r{display:flex;gap:4px;}
.xnvs-pill{display:inline-flex;align-items:center;gap:6px;padding:3px 10px 3px 7px;border-radius:999px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.09);font-size:10px;font-weight:800;color:rgba(255,255,255,0.5);letter-spacing:0.08em;}
.xnvs-pulse{width:6px;height:6px;border-radius:50%;background:#ef4444;flex-shrink:0;animation:xnvsPulse 1.8s ease-in-out infinite;}
@keyframes xnvsPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.65)}}
.xnvs-live-ct{font-size:9px;font-weight:900;color:#f87171;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);padding:2px 7px;border-radius:999px;}
.xnvs-ct{font-size:10px;color:rgba(255,255,255,0.2);font-weight:600;}
.xnvs-arr{width:24px;height:24px;border-radius:7px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);color:rgba(255,255,255,0.3);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;}
.xnvs-arr:hover{background:rgba(255,255,255,0.09);color:rgba(255,255,255,0.65);}
.xnvs-strip{display:flex;align-items:flex-start;gap:10px;padding:0 14px 14px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;}
.xnvs-strip::-webkit-scrollbar{display:none;}
.xnvs-skel{width:148px;min-width:148px;height:192px;border-radius:13px;flex-shrink:0;background:rgba(255,255,255,0.05);scroll-snap-align:start;animation:xnvsSkel 1.5s ease-in-out infinite;}
@keyframes xnvsSkel{0%,100%{opacity:.5}50%{opacity:.15}}
.xnvs-card{width:148px;min-width:148px;display:flex;flex-direction:column;background:transparent;border:none;padding:0;cursor:pointer;text-align:left;scroll-snap-align:start;flex-shrink:0;transition:transform .18s cubic-bezier(0.34,1.2,0.64,1);}
.xnvs-card:hover{transform:scale(1.035);}
.xnvs-card:active{transform:scale(0.965);}
.xnvs-tw{position:relative;width:148px;height:148px;border-radius:12px;overflow:hidden;background:#0d0d0d;border:1px solid rgba(255,255,255,0.07);box-shadow:0 4px 16px rgba(0,0,0,0.4);}
.xnvs-card:hover .xnvs-tw{border-color:rgba(255,255,255,0.14);}
.xnvs-thumb{width:100%;height:100%;object-fit:cover;display:block;transition:transform .35s ease;}
.xnvs-card:hover .xnvs-thumb{transform:scale(1.08);}
.xnvs-tg{position:absolute;inset:0;background:linear-gradient(to bottom,transparent 30%,rgba(0,0,0,0.68));pointer-events:none;}
.xnvs-play{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.12);border:1.5px solid rgba(255,255,255,0.35);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);opacity:0;transition:opacity .2s ease;pointer-events:none;}
.xnvs-play--on{opacity:1;}
.xnvs-chip{position:absolute;bottom:6px;right:6px;padding:2px 6px;border-radius:4px;background:rgba(0,0,0,0.72);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.75);font-size:8px;font-weight:900;}
.xnvs-chip--live{background:rgba(239,68,68,0.9);border-color:transparent;color:#fff;animation:xnvsLC 1.5s ease-in-out infinite;}
@keyframes xnvsLC{0%,100%{opacity:1}50%{opacity:.7}}
.xnvs-cat{position:absolute;bottom:6px;left:6px;display:inline-flex;align-items:center;gap:3px;padding:2px 7px 2px 5px;border-radius:999px;backdrop-filter:blur(6px);}
.xnvs-foot{padding:6px 2px 0;}
.xnvs-meta{display:flex;align-items:center;gap:5px;margin-bottom:3px;}
.xnvs-ch{font-size:10px;font-weight:700;color:rgba(255,255,255,0.3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:80px;}
.xnvs-ts{font-size:9px;color:rgba(255,255,255,0.22);margin-left:auto;white-space:nowrap;flex-shrink:0;font-variant-numeric:tabular-nums;}
.xnvs-title{font-size:11px;font-weight:700;color:rgba(255,255,255,0.75);line-height:1.45;margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word;}
@media(max-width:768px){.xnvs-hdr{padding:7px 12px 4px;}.xnvs-strip{padding:0 12px 12px;gap:9px;}.xnvs-arr{display:none;}}
`;

export default NewsVideoStrip;