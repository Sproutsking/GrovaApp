// ============================================================================
// src/components/Home/NewsVideoStrip.jsx  — v7  LIVE + CONTINUOUS
//
// FIXES:
//  [F1] Timestamps tick every 30s — no more "immortal just now".
//  [F2] Auto-refreshes video feed every 8 minutes silently.
//  [F3] Fetches max 8 videos per channel (88 total) for rich content.
//  [F4] Cache TTL reduced to 3 min to stay fresh.
//  [F5] More YouTube channels added for volume.
//  [F6] No garish red play button — frosted glass hover only.
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import {
  X,
  ChevronLeft,
  Volume2,
  VolumeX,
  ExternalLink,
  Play,
} from "lucide-react";

// ── YouTube channels (expanded for max volume) ────────────────────────────────
const YT_CHANNELS = [
  { id: "UCnUYZLuoy1rq1aVMwx4aTzw", name: "BBC News", category: "global" },
  { id: "UCknLrEdhRCp1aegoMqRaCZg", name: "DW News", category: "global" },
  { id: "UCNye-wNBqNL5ZzHSJdde7RA", name: "Al Jazeera", category: "global" },
  { id: "UCQfwfsi5VrQ8yKZ-UWmAEFg", name: "France 24", category: "global" },
  { id: "UC7fWeaHhqgM4Ry-RMpM2YYw", name: "TRT World", category: "global" },
  { id: "UC-7dRiGmmKOUkBu-gKVQf2g", name: "Sky News", category: "global" },
  { id: "UCIdojUGDCXFLiGTEMeL5kxQ", name: "CGTN", category: "global" },
  { id: "UCIALMKvObZNtJ6AmdCLP7Lg", name: "Bloomberg TV", category: "global" },
  { id: "UCupvZG-5ko_eiXAupbDfxWw", name: "CNN", category: "global" },
  { id: "UCVSNOxehfALut52-3bfvSHg", name: "VOA News", category: "global" },
  { id: "UChqUTb7kYRX8-EiaN3XFrSQ", name: "Reuters", category: "global" },
  { id: "UC8nNHDCBk5RoUg10L-Lktjg", name: "AP", category: "global" },
  { id: "UCJXGnHCHApDirWSmAZ0uxkQ", name: "Arise News", category: "africa" },
  { id: "UCCjyq_K1Pd2QkMOoAc73yqA", name: "Channels TV", category: "africa" },
  { id: "UCG9_Hz8tMHdM5i5EzQpSPaQ", name: "Africa News", category: "africa" },
  { id: "UCrbatV49TNrqfoPLEJqJiuw", name: "CoinDesk TV", category: "crypto" },
  { id: "UCAl9Ld79qaZxp9JzEOwd3aA", name: "Bankless", category: "crypto" },
];

const YT_RSS = (id) =>
  `https://www.youtube.com/feeds/videos.xml?channel_id=${id}`;
const YT_THUMB = (id) => `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
const YT_EMBED = (id, muted = true) =>
  `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=${muted ? 1 : 0}&rel=0&modestbranding=1&playsinline=1`;

// ── [F1] Live-ticking relTime hook ───────────────────────────────────────────
function useRelTime(dateStr) {
  const calc = useCallback(() => {
    if (!dateStr) return "";
    const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (s < 10) return "just now";
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }, [dateStr]);

  const [label, setLabel] = useState(calc);
  useEffect(() => {
    setLabel(calc());
    const id = setInterval(() => setLabel(calc()), 30_000);
    return () => clearInterval(id);
  }, [calc]);
  return label;
}

// Static relTime for use outside hooks (lists)
function relTimeStatic(dateStr) {
  if (!dateStr) return "";
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const CAT_STYLES = {
  global: { bg: "rgba(59,130,246,0.22)", dot: "#3b82f6", tx: "#93c5fd" },
  africa: { bg: "rgba(249,115,22,0.22)", dot: "#f97316", tx: "#fdba74" },
  crypto: { bg: "rgba(234,179,8,0.22)", dot: "#eab308", tx: "#fde68a" },
  default: { bg: "rgba(132,204,22,0.18)", dot: "#84cc16", tx: "#bef264" },
};
const catStyle = (c) =>
  CAT_STYLES[(c || "").toLowerCase()] || CAT_STYLES.default;

// ── [F4] Cache TTL: 3 minutes ─────────────────────────────────────────────────
const YT_CACHE_KEY = "nvs_yt_v7";
const YT_CACHE_TTL = 3 * 60_000;

async function fetchOneChannel(ch) {
  const feedUrl = YT_RSS(ch.id);
  const proxies = [
    (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
    (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  ];
  for (const makeProxy of proxies) {
    try {
      const res = await fetch(makeProxy(feedUrl), {
        signal: AbortSignal.timeout(9_000),
      });
      if (!res.ok) continue;
      const ct = res.headers.get("content-type") || "";
      const xml = ct.includes("json")
        ? (await res.json())?.contents || ""
        : await res.text();
      if (!xml || xml.length < 100) continue;

      const items = [];
      const seen = new Set();
      const re = /<entry>([\s\S]*?)<\/entry>/gi;
      let m;
      while ((m = re.exec(xml)) !== null) {
        const blk = m[1];
        const vidId = (
          blk.match(/<yt:videoId>([^<]+)<\/yt:videoId>/i)?.[1] || ""
        ).trim();
        if (!vidId || seen.has(vidId)) continue;
        seen.add(vidId);
        const raw =
          blk.match(
            /<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i,
          )?.[1] || "";
        const title = raw.replace(/<!\[CDATA\[|\]\]>/g, "").trim();
        if (!title) continue;
        const pub = blk.match(/<published>([^<]+)<\/published>/i)?.[1] || "";
        const ms = pub ? new Date(pub).getTime() : Date.now();
        // Allow up to 14 days for volume
        if (Date.now() - ms > 14 * 86_400_000) continue;
        items.push({
          videoId: vidId,
          title,
          channelName: ch.name,
          category: ch.category,
          thumbnail: YT_THUMB(vidId),
          // [F3] up to 8 per channel
          published_at: pub
            ? new Date(pub).toISOString()
            : new Date().toISOString(),
        });
        if (items.length >= 8) break;
      }
      return items;
    } catch {
      /* try next proxy */
    }
  }
  return [];
}

// [F2] bust=true skips cache, forces fresh fetch
async function fetchAllVideos(bust = false) {
  if (!bust) {
    try {
      const c = JSON.parse(sessionStorage.getItem(YT_CACHE_KEY) || "null");
      if (c && Date.now() - c.at < YT_CACHE_TTL) return c.videos;
    } catch {
      /* ignore */
    }
  }

  // All channels in parallel
  const results = await Promise.allSettled(YT_CHANNELS.map(fetchOneChannel));
  const videos = [];
  const seen = new Set();
  for (const r of results) {
    if (r.status === "fulfilled") {
      for (const v of r.value) {
        if (!seen.has(v.videoId)) {
          seen.add(v.videoId);
          videos.push(v);
        }
      }
    }
  }
  videos.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
  // Keep up to 80 videos for rich volume
  const result = videos.slice(0, 80);
  try {
    sessionStorage.setItem(
      YT_CACHE_KEY,
      JSON.stringify({ at: Date.now(), videos: result }),
    );
  } catch {
    /* ignore */
  }
  return result;
}

// ── Timestamp component with live ticking ────────────────────────────────────
const LiveTs = ({ dateStr, className }) => {
  const label = useRelTime(dateStr);
  return <span className={className}>{label}</span>;
};

// ══════════════════════════════════════════════════════════════════════════════
// Full-screen YouTube Player
// ══════════════════════════════════════════════════════════════════════════════
const YouTubePlayer = ({ videos, startIndex, onClose }) => {
  const [idx, setIdx] = useState(startIndex);
  const [muted, setMuted] = useState(false);
  const touchY = useRef(null);
  const cur = videos[idx];
  const cs = catStyle(cur?.category);
  const tsLabel = useRelTime(cur?.published_at);

  useEffect(() => {
    const y = window.scrollY;
    Object.assign(document.body.style, {
      overflow: "hidden",
      position: "fixed",
      top: `-${y}px`,
      left: "0",
      right: "0",
    });
    document.body.dataset.ytY = y;
    const esc = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", esc);
    return () => {
      document.body.style.cssText = "";
      window.scrollTo(0, parseInt(document.body.dataset.ytY || "0"));
      window.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  const goPrev = () => {
    if (idx > 0) setIdx((i) => i - 1);
  };
  const goNext = () => {
    if (idx < videos.length - 1) setIdx((i) => i + 1);
  };

  return ReactDOM.createPortal(
    <>
      <div
        className="ytp-root"
        onTouchStart={(e) => {
          touchY.current = e.touches[0].clientY;
        }}
        onTouchEnd={(e) => {
          if (touchY.current === null) return;
          const d = touchY.current - e.changedTouches[0].clientY;
          if (d > 50) goNext();
          else if (d < -50) goPrev();
          touchY.current = null;
        }}
      >
        <button className="ytp-btn ytp-close" onClick={onClose}>
          <X size={18} />
        </button>
        <button
          className="ytp-btn ytp-mute"
          onClick={() => setMuted((v) => !v)}
        >
          {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </button>
        <div className="ytp-frame-wrap">
          <iframe
            key={`yt-${idx}`}
            src={YT_EMBED(cur.videoId, muted)}
            title={cur.title}
            allow="autoplay; fullscreen; accelerometer; gyroscope; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
            className="ytp-iframe"
            style={{ border: "none" }}
          />
          <div className="ytp-gradient" />
          <div className="ytp-info">
            <div className="ytp-channel-row">
              <div className="ytp-yt-badge">▶ {cur.channelName}</div>
              <span className="ytp-ts">{tsLabel}</span>
            </div>
            <h3 className="ytp-title">{cur.title}</h3>
            {cur.category && (
              <span
                className="ytp-cat"
                style={{ background: cs.bg, color: cs.tx }}
              >
                <span
                  style={{
                    background: cs.dot,
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    display: "inline-block",
                  }}
                />
                {cur.category.toUpperCase()}
              </span>
            )}
          </div>
          {idx > 0 && (
            <button className="ytp-nav ytp-nav-up" onClick={goPrev}>
              <ChevronLeft size={18} style={{ transform: "rotate(90deg)" }} />
            </button>
          )}
          {idx < videos.length - 1 && (
            <button className="ytp-nav ytp-nav-dn" onClick={goNext}>
              <ChevronLeft size={18} style={{ transform: "rotate(-90deg)" }} />
            </button>
          )}
        </div>
        <div className="ytp-dots">
          {videos.slice(0, 12).map((_, i) => (
            <button
              key={i}
              className={`ytp-dot${i === idx ? " ytp-dot-on" : ""}`}
              onClick={() => setIdx(i)}
            />
          ))}
        </div>
        <a
          href={`https://www.youtube.com/watch?v=${cur.videoId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ytp-yt-link"
        >
          <ExternalLink size={10} /> Watch on YouTube
        </a>
        <div className="ytp-prog">
          <div
            className="ytp-prog-fill"
            style={{ width: `${((idx + 1) / videos.length) * 100}%` }}
          />
        </div>
      </div>
      <style>{YTP_CSS}</style>
    </>,
    document.body,
  );
};

const YTP_CSS = `
.ytp-root{position:fixed;inset:0;z-index:99990;background:#000;display:flex;flex-direction:column;align-items:center;overflow:hidden;}
.ytp-btn{position:absolute;top:16px;z-index:20;width:38px;height:38px;border-radius:50%;background:rgba(0,0,0,0.6);border:1px solid rgba(255,255,255,0.12);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;}
.ytp-close{left:16px;}.ytp-mute{right:16px;}
.ytp-frame-wrap{position:relative;width:100%;flex:1;max-width:640px;display:flex;align-items:center;}
.ytp-iframe{position:absolute;inset:0;width:100%;height:100%;}
.ytp-gradient{position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,rgba(0,0,0,0.94) 100%);pointer-events:none;}
.ytp-info{position:absolute;bottom:24px;left:14px;right:56px;z-index:5;display:flex;flex-direction:column;gap:7px;}
.ytp-channel-row{display:flex;align-items:center;gap:8px;}
.ytp-yt-badge{background:rgba(220,38,38,0.85);color:#fff;font-size:9px;padding:3px 8px;border-radius:5px;font-weight:800;}
.ytp-ts{font-size:10px;color:rgba(255,255,255,0.38);}
.ytp-title{font-size:16px;font-weight:800;color:#fff;line-height:1.4;margin:0;text-shadow:0 1px 8px rgba(0,0,0,0.9);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}
.ytp-cat{display:inline-flex;align-items:center;gap:4px;padding:2px 8px 2px 5px;border-radius:999px;font-size:9px;font-weight:800;width:fit-content;}
.ytp-nav{position:absolute;z-index:10;right:12px;width:34px;height:34px;border-radius:50%;background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.1);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;}
.ytp-nav-up{top:72px;}.ytp-nav-dn{bottom:100px;}
.ytp-dots{position:absolute;right:12px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:5px;z-index:10;}
.ytp-dot{width:4px;height:4px;border-radius:50%;background:rgba(255,255,255,0.2);border:none;padding:0;cursor:pointer;transition:all .15s;}
.ytp-dot-on{background:#ef4444;transform:scale(1.6);}
.ytp-yt-link{position:absolute;bottom:12px;left:50%;transform:translateX(-50%);display:inline-flex;align-items:center;gap:5px;padding:5px 14px;border-radius:999px;background:rgba(0,0,0,0.65);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.6);font-size:10px;font-weight:600;text-decoration:none;z-index:10;white-space:nowrap;}
.ytp-prog{position:absolute;bottom:0;left:0;right:0;height:2px;background:rgba(255,255,255,0.07);}
.ytp-prog-fill{height:100%;background:#ef4444;transition:width .3s ease;}
@media(max-width:768px){.ytp-frame-wrap{max-width:100%;}.ytp-title{font-size:14px;}.ytp-dots,.ytp-nav{display:none;}}
`;

// ── Individual video card with live timestamp ─────────────────────────────────
const VideoCard = ({ vid, idx, onPlay }) => {
  const [hov, setHov] = useState(false);
  const ts = useRelTime(vid.published_at);
  const cs = catStyle(vid.category);

  return (
    <button
      className="nvs-card"
      onClick={() => onPlay(idx)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div className="nvs-thumb-wrap">
        <img
          src={vid.thumbnail}
          alt={vid.title}
          className="nvs-thumb"
          loading={idx < 5 ? "eager" : "lazy"}
          onError={(e) => {
            e.target.src = `https://img.youtube.com/vi/${vid.videoId}/hqdefault.jpg`;
          }}
        />
        <div className="nvs-thumb-grad" />
        <div className={`nvs-play-hint${hov ? " nvs-play-hint--visible" : ""}`}>
          <Play size={14} fill="white" color="white" />
        </div>
        <div className="nvs-yt-chip">▶</div>
        {vid.category && (
          <div className="nvs-cat-pill" style={{ background: cs.bg }}>
            <span
              style={{
                background: cs.dot,
                width: 4,
                height: 4,
                borderRadius: "50%",
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                color: cs.tx,
                fontSize: 8,
                fontWeight: 800,
                letterSpacing: "0.05em",
              }}
            >
              {vid.category.toUpperCase()}
            </span>
          </div>
        )}
      </div>
      <div className="nvs-foot">
        <div className="nvs-meta-row">
          <span className="nvs-channel">{vid.channelName}</span>
          <span className="nvs-ts">{ts}</span>
        </div>
        <p className="nvs-title">{vid.title}</p>
      </div>
    </button>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// NewsVideoStrip — main component
// ══════════════════════════════════════════════════════════════════════════════
const NewsVideoStrip = ({ preferCategory = null }) => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ytPlayer, setYtPlayer] = useState(null); // { idx }
  const scrollRef = useRef(null);
  const refreshRef = useRef(null);

  const loadVideos = useCallback(
    async (bust = false) => {
      try {
        const vids = await fetchAllVideos(bust);
        setVideos(
          preferCategory
            ? vids.filter((v) => v.category === preferCategory)
            : vids,
        );
      } catch (e) {
        console.warn("[NewsVideoStrip] fetch:", e);
      } finally {
        setLoading(false);
      }
    },
    [preferCategory],
  );

  // Initial load
  useEffect(() => {
    loadVideos(false);
  }, [loadVideos]);

  // [F2] Auto-refresh every 8 minutes
  useEffect(() => {
    refreshRef.current = setInterval(() => loadVideos(true), 8 * 60_000);
    return () => clearInterval(refreshRef.current);
  }, [loadVideos]);

  if (!loading && videos.length === 0) return null;

  return (
    <>
      <div className="nvs-root">
        <div className="nvs-header">
          <div className="nvs-header-left">
            <div className="nvs-live-pill">
              <span className="nvs-live-pulse" />
              NEWS LINE
            </div>
            {!loading && (
              <span className="nvs-count">{videos.length} videos</span>
            )}
          </div>
          <div className="nvs-header-right">
            <button
              className="nvs-arr"
              onClick={() =>
                scrollRef.current?.scrollBy({ left: -200, behavior: "smooth" })
              }
            >
              <ChevronLeft size={13} />
            </button>
            <button
              className="nvs-arr"
              onClick={() =>
                scrollRef.current?.scrollBy({ left: 200, behavior: "smooth" })
              }
            >
              <ChevronLeft size={13} style={{ transform: "scaleX(-1)" }} />
            </button>
          </div>
        </div>

        <div className="nvs-strip" ref={scrollRef}>
          {loading &&
            [1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="nvs-skel" />)}
          {!loading &&
            videos.map((vid, idx) => (
              <VideoCard
                key={vid.videoId}
                vid={vid}
                idx={idx}
                onPlay={(i) => setYtPlayer({ idx: i })}
              />
            ))}
        </div>
      </div>

      {ytPlayer !== null && videos.length > 0 && (
        <YouTubePlayer
          videos={videos}
          startIndex={ytPlayer.idx}
          onClose={() => setYtPlayer(null)}
        />
      )}
      <style>{NVS_CSS}</style>
    </>
  );
};

const NVS_CSS = `
.nvs-root{width:100%;overflow:hidden;border-radius: 0 0 12px 12px;border-bottom:1px solid rgba(255,255,255,0.055);}
.nvs-header{display:flex;align-items:center;justify-content:space-between;padding:9px 14px 5px;}
.nvs-header-left{display:flex;align-items:center;gap:8px;}
.nvs-header-right{display:flex;gap:4px;}
.nvs-live-pill{display:inline-flex;align-items:center;gap:6px;padding:3px 10px 3px 7px;border-radius:999px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.09);font-size:10px;font-weight:800;color:rgba(255,255,255,0.5);letter-spacing:0.08em;text-transform:uppercase;}
.nvs-live-pulse{width:6px;height:6px;border-radius:50%;background:#ef4444;flex-shrink:0;animation:nvsPulse 1.8s ease-in-out infinite;}
@keyframes nvsPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.35;transform:scale(0.65)}}
.nvs-count{font-size:10px;color:rgba(255,255,255,0.2);font-weight:600;}
.nvs-arr{width:24px;height:24px;border-radius:7px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);color:rgba(255,255,255,0.3);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;}
.nvs-arr:hover{background:rgba(255,255,255,0.09);color:rgba(255,255,255,0.65);}
.nvs-strip{display:flex;align-items:flex-start;gap:10px;padding:0 14px 14px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;}
.nvs-strip::-webkit-scrollbar{display:none;}
.nvs-skel{width:148px;min-width:148px;height:192px;border-radius:13px;flex-shrink:0;background:rgba(255,255,255,0.05);scroll-snap-align:start;animation:nvsSkel 1.5s ease-in-out infinite;}
@keyframes nvsSkel{0%,100%{opacity:0.5}50%{opacity:0.15}}
.nvs-card{width:148px;min-width:148px;display:flex;flex-direction:column;background:transparent;border:none;padding:0;cursor:pointer;text-align:left;scroll-snap-align:start;flex-shrink:0;transition:transform .18s cubic-bezier(0.34,1.2,0.64,1);}
.nvs-card:hover{transform:scale(1.035);}.nvs-card:active{transform:scale(0.965);}
.nvs-thumb-wrap{position:relative;width:148px;height:148px;border-radius:12px;overflow:hidden;background:#0d0d0d;border:1px solid rgba(255,255,255,0.07);box-shadow:0 4px 16px rgba(0,0,0,0.4);}
.nvs-card:hover .nvs-thumb-wrap{border-color:rgba(255,255,255,0.14);box-shadow:0 8px 28px rgba(0,0,0,0.55);}
.nvs-thumb{width:100%;height:100%;object-fit:cover;display:block;transition:transform .35s ease;}
.nvs-card:hover .nvs-thumb{transform:scale(1.08);}
.nvs-thumb-grad{position:absolute;inset:0;background:linear-gradient(to bottom,transparent 30%,rgba(0,0,0,0.68));pointer-events:none;}
.nvs-play-hint{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.12);border:1.5px solid rgba(255,255,255,0.35);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);opacity:0;transition:opacity .2s ease;pointer-events:none;}
.nvs-play-hint--visible{opacity:1;}
.nvs-yt-chip{position:absolute;bottom:6px;right:6px;padding:2px 6px;border-radius:4px;background:rgba(0,0,0,0.72);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.75);font-size:8px;font-weight:900;backdrop-filter:blur(4px);}
.nvs-cat-pill{position:absolute;bottom:6px;left:6px;display:inline-flex;align-items:center;gap:3px;padding:2px 7px 2px 5px;border-radius:999px;backdrop-filter:blur(6px);}
.nvs-foot{padding:6px 2px 0;}
.nvs-meta-row{display:flex;align-items:center;gap:5px;margin-bottom:3px;}
.nvs-channel{font-size:10px;font-weight:700;color:rgba(255,255,255,0.3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:80px;}
.nvs-ts{font-size:9px;color:rgba(255,255,255,0.22);margin-left:auto;white-space:nowrap;flex-shrink:0;font-variant-numeric:tabular-nums;}
.nvs-title{font-size:11px;font-weight:700;color:rgba(255,255,255,0.75);line-height:1.45;margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word;}
@media(max-width:768px){.nvs-header{padding:7px 12px 4px;}.nvs-strip{padding:0 12px 12px;gap:9px;}.nvs-arr{display:none;}}
`;

export default NewsVideoStrip;
