// ============================================================================
// src/components/Home/NewsCard.jsx
//
// News monetisation approach:
//  NO likes on news (avoids false endorsement of news publishers' content).
//  SHARE button costs 10 EP — user pays 10 EP to share a news article.
//  This is ethical: we're monetising the amplification action, not the news.
//  The EP is deducted via walletService before the share modal opens.
//
//  [FAV]  Source favicon via Google Favicon API (sz=64) with initials fallback.
//  [EP]   10 EP share gate — shows EP confirmation dialog before sharing.
//  [FSNV] Full-screen news reader — multi-proxy content fetch waterfall.
//  [VID]  GlobalVideoState integrated — news cards with video will respect
//         the global play/mute state shared across all tabs.
// ============================================================================

import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import {
  ExternalLink, Globe, Clock, ChevronDown, ChevronUp,
  Tag, Rss, BookOpen, X, ArrowLeft, Loader,
  AlertCircle, CheckCircle, Share2, Zap, Copy, Check,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────
const relTime = (d) => {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return "just now";
  const m = Math.floor(s / 60);  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);  if (h < 24)  return `${h}h ago`;
  const dy = Math.floor(h / 24); if (dy < 7)  return `${dy}d ago`;
  const wk = Math.floor(dy / 7); if (wk < 5)  return `${wk}w ago`;
  return new Date(d).toLocaleDateString("en-US", { month:"short", day:"numeric" });
};

const fullDate = (d) => {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { weekday:"long", year:"numeric", month:"long", day:"numeric" });
};

function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return null; }
}

function getFaviconUrl(sourceUrl, articleUrl) {
  const domain = getDomain(sourceUrl) || getDomain(articleUrl);
  if (!domain) return null;
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

const CATS = {
  global:  { bg:"rgba(59,130,246,0.12)",  bd:"rgba(59,130,246,0.3)",  dot:"#3b82f6", tx:"#60a5fa"  },
  africa:  { bg:"rgba(249,115,22,0.12)",  bd:"rgba(249,115,22,0.3)",  dot:"#f97316", tx:"#fb923c"  },
  crypto:  { bg:"rgba(234,179,8,0.12)",   bd:"rgba(234,179,8,0.3)",   dot:"#eab308", tx:"#fbbf24"  },
  default: { bg:"rgba(132,204,22,0.08)",  bd:"rgba(132,204,22,0.25)", dot:"#84cc16", tx:"#a3e635"  },
};
const cat = (c) => CATS[(c||"").toLowerCase()] || CATS.default;

// ── Source icon — favicon with initials fallback ──────────────────────────────
const SourceIcon = ({ name, sourceUrl, articleUrl, size=36, radius=10 }) => {
  const [ok, setOk] = useState(true);
  const url = getFaviconUrl(sourceUrl, articleUrl);
  const initials = (name||"N").split(/\s+/).slice(0,2).map(w=>w[0]?.toUpperCase()||"").join("");
  const base = { width:size, height:size, borderRadius:radius, flexShrink:0, overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center", border:"1px solid rgba(59,130,246,0.25)", background:"linear-gradient(135deg,#1e3a5f,#0f2744)" };

  if (url && ok) {
    return (
      <div style={base}>
        <img src={url} alt={name} onError={()=>setOk(false)} style={{ width:"100%",height:"100%",objectFit:"cover",display:"block" }}/>
      </div>
    );
  }
  return (
    <div style={{ ...base, fontSize:size<40?12:14, fontWeight:900, color:"#60a5fa", letterSpacing:"0.5px", userSelect:"none" }}>
      {initials}
    </div>
  );
};

// ── CORS proxy waterfall ──────────────────────────────────────────────────────
const PROXIES = [
  (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
  (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
];

async function fetchArticleText(url) {
  for (const makeProxy of PROXIES) {
    try {
      const res = await fetch(makeProxy(url), {
        signal: AbortSignal.timeout(10_000),
        headers: { Accept:"application/json, text/html, */*" },
      });
      if (!res.ok) continue;
      const ct = res.headers.get("content-type") || "";
      let html = ct.includes("json") ? ((await res.json())?.contents||"") : await res.text();
      if (!html || html.length < 100) continue;
      const text = extractText(html);
      if (text && text.length > 150) return text;
    } catch { /* try next */ }
  }
  return null;
}

function extractText(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  ["script","style","noscript","nav","header","footer","aside","form","iframe","svg",
    "[class*='ad-']","[class*='-ad']","[id*='sidebar']","[class*='sidebar']",
    "[class*='newsletter']","[class*='subscribe']","[class*='related']","[class*='share']",
    "[class*='social']","[class*='cookie']","[class*='popup']","[class*='modal']",
    "[class*='promo']","[role='complementary']","[role='banner']","[role='navigation']",
  ].forEach(s => { try { tmp.querySelectorAll(s).forEach(e=>e.remove()); } catch {} });

  const SELECTORS = [
    "[itemprop='articleBody']","article .entry-content","article .post-content",
    "article .article-content","article .story-body","article .article-body",
    "[class*='article-body']","[class*='story-body']","[class*='post-body']",
    "[class*='entry-content']","[class*='article-content']",
    ".content-wrapper article","article","main .content","main",
  ];
  for (const sel of SELECTORS) {
    try {
      const el = tmp.querySelector(sel);
      if (!el) continue;
      const t = el.textContent.replace(/\s+/g," ").trim();
      if (t.length > 200) return t;
    } catch {}
  }
  const paras = Array.from(tmp.querySelectorAll("p"))
    .map(p=>p.textContent.trim())
    .filter(t=>t.length>60&&!t.toLowerCase().includes("cookie")&&!t.toLowerCase().includes("subscribe")&&!t.startsWith("©"));
  return paras.length ? paras.join("\n\n") : null;
}

// ══════════════════════════════════════════════════════════════════════════════
// [EP] News Share Modal — 10 EP confirmation + share options
// ══════════════════════════════════════════════════════════════════════════════
const NEWS_SHARE_COST_EP = 10;

const NewsShareModal = ({ post, currentUser, onClose, onEpDeducted }) => {
  const { title="", article_url="", source_name="" } = post;
  const [step,    setStep]    = useState("confirm"); // confirm | sharing | done | error
  const [copied,  setCopied]  = useState(false);
  const [errMsg,  setErrMsg]  = useState("");

  // Scroll lock
  useEffect(() => {
    const y = window.scrollY;
    Object.assign(document.body.style, { overflow:"hidden", position:"fixed", top:`-${y}px`, left:"0", right:"0" });
    document.body.dataset.nsmY = y;
    const esc = e => { if (e.key==="Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => {
      document.body.style.cssText = "";
      window.scrollTo(0, parseInt(document.body.dataset.nsmY||"0"));
      window.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  const handleConfirm = async () => {
    if (!currentUser?.id) {
      setErrMsg("Sign in to share news articles.");
      setStep("error");
      return;
    }
    setStep("sharing");
    try {
      // Deduct EP via wallet service — dispatch event so the wallet updates globally
      window.dispatchEvent(new CustomEvent("grova:deductEP", {
        detail: {
          userId: currentUser.id,
          amount: NEWS_SHARE_COST_EP,
          reason: `Shared news: ${title.slice(0,60)}`,
          type: "news_share",
          newsId: post.id,
        },
      }));
      if (onEpDeducted) onEpDeducted(NEWS_SHARE_COST_EP);
      setStep("done");
    } catch (err) {
      setErrMsg(err?.message || "Not enough EP. Top up your balance to share.");
      setStep("error");
    }
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title, text: `${title} — via Xeevia`, url: article_url });
    } catch {
      handleCopy();
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${title}\n${article_url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  };

  const shareTargets = [
    { label:"WhatsApp",  color:"#25D366", icon:"💬", href:`https://wa.me/?text=${encodeURIComponent(`${title} ${article_url}`)}` },
    { label:"Twitter/X", color:"#000",    icon:"🐦", href:`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(article_url)}` },
    { label:"Telegram",  color:"#2AABEE", icon:"✈️", href:`https://t.me/share/url?url=${encodeURIComponent(article_url)}&text=${encodeURIComponent(title)}` },
    { label:"LinkedIn",  color:"#0A66C2", icon:"💼", href:`https://linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(article_url)}` },
  ];

  return ReactDOM.createPortal(
    <>
      <div className="nsm-root" onClick={onClose}>
        <div className="nsm-sheet" onClick={e=>e.stopPropagation()}>

          {/* Handle */}
          <div className="nsm-handle"/>

          {/* Confirm step */}
          {step === "confirm" && (
            <>
              <div className="nsm-icon-wrap">
                <Share2 size={24} color="#84cc16"/>
              </div>
              <h3 className="nsm-title">Share this article</h3>
              <p className="nsm-sub">
                Sharing news costs <strong className="nsm-ep">{NEWS_SHARE_COST_EP} EP</strong> — this is how Xeevia monetises news distribution without owning the content.
              </p>
              <div className="nsm-article-preview">
                <span className="nsm-preview-source">{source_name}</span>
                <p className="nsm-preview-title">{title}</p>
              </div>
              <div className="nsm-ep-cost">
                <Zap size={14} color="#fbbf24"/>
                <span>{NEWS_SHARE_COST_EP} EP will be deducted from your wallet</span>
              </div>
              <div className="nsm-actions">
                <button className="nsm-btn nsm-btn-cancel" onClick={onClose}>Cancel</button>
                <button className="nsm-btn nsm-btn-confirm" onClick={handleConfirm}>
                  <Zap size={13}/> Pay & Share
                </button>
              </div>
            </>
          )}

          {/* Sharing / loading */}
          {step === "sharing" && (
            <div className="nsm-center">
              <div className="nsm-spinner"/>
              <p className="nsm-loading-txt">Deducting EP…</p>
            </div>
          )}

          {/* Done — show share targets */}
          {step === "done" && (
            <>
              <div className="nsm-success-icon">✅</div>
              <h3 className="nsm-title">10 EP deducted!</h3>
              <p className="nsm-sub">Choose where to share:</p>

              <div className="nsm-targets">
                {shareTargets.map(({ label, color, icon, href }) => (
                  <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                    className="nsm-target" onClick={onClose}>
                    <span className="nsm-target-icon">{icon}</span>
                    <span className="nsm-target-label">{label}</span>
                  </a>
                ))}
              </div>

              <div className="nsm-divider">or</div>

              <div className="nsm-copy-row">
                <div className="nsm-url-chip">{article_url.slice(0,48)}…</div>
                <button className="nsm-copy-btn" onClick={handleCopy}>
                  {copied ? <><Check size={13}/> Copied!</> : <><Copy size={13}/> Copy</>}
                </button>
              </div>

              {navigator.share && (
                <button className="nsm-native-share" onClick={handleNativeShare}>
                  <Share2 size={13}/> Share via…
                </button>
              )}
            </>
          )}

          {/* Error */}
          {step === "error" && (
            <>
              <div className="nsm-error-icon">⚠️</div>
              <h3 className="nsm-title">Cannot share</h3>
              <p className="nsm-sub">{errMsg}</p>
              <button className="nsm-btn nsm-btn-cancel" style={{ width:"100%" }} onClick={onClose}>Close</button>
            </>
          )}
        </div>
      </div>
      <style>{NSM_CSS}</style>
    </>,
    document.body
  );
};

const NSM_CSS = `
.nsm-root{position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,0.7);display:flex;align-items:flex-end;justify-content:center;animation:nsmFade 0.2s ease both;}
@keyframes nsmFade{from{opacity:0}to{opacity:1}}
.nsm-sheet{width:100%;max-width:480px;background:#141414;border-radius:20px 20px 0 0;padding:20px 20px 32px;border-top:1px solid rgba(255,255,255,0.08);animation:nsmUp 0.28s cubic-bezier(0.34,1.2,0.64,1) both;display:flex;flex-direction:column;align-items:center;gap:10px;}
@keyframes nsmUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
.nsm-handle{width:40px;height:4px;border-radius:2px;background:rgba(255,255,255,0.12);margin-bottom:4px;}
.nsm-icon-wrap{width:52px;height:52px;border-radius:16px;background:rgba(132,204,22,0.1);border:1px solid rgba(132,204,22,0.25);display:flex;align-items:center;justify-content:center;}
.nsm-title{font-size:18px;font-weight:900;color:#f0f0f0;margin:0;text-align:center;}
.nsm-sub{font-size:13px;color:rgba(255,255,255,0.45);text-align:center;margin:0;line-height:1.65;max-width:320px;}
.nsm-ep{color:#84cc16;}
.nsm-article-preview{width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px 14px;margin-top:2px;}
.nsm-preview-source{font-size:10px;font-weight:800;color:rgba(255,255,255,0.3);letter-spacing:0.07em;text-transform:uppercase;}
.nsm-preview-title{font-size:13px;font-weight:700;color:#e0e0e0;margin:4px 0 0;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.nsm-ep-cost{display:flex;align-items:center;gap:7px;padding:8px 14px;border-radius:10px;background:rgba(234,179,8,0.07);border:1px solid rgba(234,179,8,0.18);font-size:12.5px;font-weight:700;color:rgba(234,179,8,0.8);width:100%;}
.nsm-actions{display:flex;gap:10px;width:100%;margin-top:4px;}
.nsm-btn{flex:1;padding:12px 16px;border-radius:11px;font-size:13.5px;font-weight:800;font-family:inherit;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:all 0.15s;}
.nsm-btn-cancel{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.5);}
.nsm-btn-cancel:hover{background:rgba(255,255,255,0.1);}
.nsm-btn-confirm{background:rgba(132,204,22,0.12);border:1px solid rgba(132,204,22,0.35);color:#84cc16;}
.nsm-btn-confirm:hover{background:rgba(132,204,22,0.2);border-color:rgba(132,204,22,0.55);}
.nsm-center{display:flex;flex-direction:column;align-items:center;gap:14px;padding:24px 0;}
.nsm-spinner{width:36px;height:36px;border:3px solid rgba(132,204,22,0.15);border-top-color:#84cc16;border-radius:50%;animation:nsmSpin 0.8s linear infinite;}
@keyframes nsmSpin{to{transform:rotate(360deg)}}
.nsm-loading-txt{font-size:14px;color:rgba(255,255,255,0.4);font-weight:600;}
.nsm-success-icon,.nsm-error-icon{font-size:44px;line-height:1;}
.nsm-targets{display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%;margin-top:4px;}
.nsm-target{display:flex;align-items:center;gap:10px;padding:11px 14px;border-radius:11px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);text-decoration:none;transition:background 0.15s;}
.nsm-target:hover{background:rgba(255,255,255,0.09);}
.nsm-target-icon{font-size:20px;line-height:1;}
.nsm-target-label{font-size:13px;font-weight:700;color:rgba(255,255,255,0.65);}
.nsm-divider{font-size:11px;font-weight:700;color:rgba(255,255,255,0.2);letter-spacing:0.08em;text-transform:uppercase;margin:4px 0;}
.nsm-copy-row{display:flex;align-items:center;gap:8px;width:100%;}
.nsm-url-chip{flex:1;font-size:11px;color:rgba(255,255,255,0.3);background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:8px 10px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;}
.nsm-copy-btn{display:flex;align-items:center;gap:5px;padding:8px 14px;border-radius:8px;background:rgba(132,204,22,0.1);border:1px solid rgba(132,204,22,0.3);color:#84cc16;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;flex-shrink:0;white-space:nowrap;transition:background 0.15s;}
.nsm-copy-btn:hover{background:rgba(132,204,22,0.18);}
.nsm-native-share{width:100%;display:flex;align-items:center;justify-content:center;gap:7px;padding:10px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);color:rgba(255,255,255,0.4);font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;transition:background 0.15s;}
.nsm-native-share:hover{background:rgba(255,255,255,0.08);}
`;

// ══════════════════════════════════════════════════════════════════════════════
// FullScreenNewsView
// ══════════════════════════════════════════════════════════════════════════════
const FullScreenNewsView = ({ post, currentUser, onClose }) => {
  const {
    title="", description="", image_url,
    source_name, source_url, article_url, category,
    region, published_at, asset_tag,
  } = post;

  const [imgErr,       setImgErr]       = useState(false);
  const [body,         setBody]         = useState(null);
  const [fetchState,   setFetchState]   = useState("loading");
  const [showShare,    setShowShare]    = useState(false);
  const isMobile = window.innerWidth <= 768;
  const c = cat(category);

  // Scroll lock
  useEffect(() => {
    const y = window.scrollY;
    Object.assign(document.body.style, { overflow:"hidden", position:"fixed", top:`-${y}px`, left:"0", right:"0" });
    document.body.dataset.fsnvY = y;
    const esc = e => { if (e.key==="Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => {
      document.body.style.cssText = "";
      window.scrollTo(0, parseInt(document.body.dataset.fsnvY||"0"));
      window.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  useEffect(() => {
    if (!article_url) { setFetchState("failed"); return; }
    let cancelled = false;
    fetchArticleText(article_url).then(text => {
      if (cancelled) return;
      if (text) { setBody(text); setFetchState("done"); }
      else       { setFetchState("failed"); }
    }).catch(() => { if (!cancelled) setFetchState("failed"); });
    return () => { cancelled = true; };
  }, [article_url]);

  const hasImage    = image_url && !imgErr;
  const isFullText  = fetchState==="done" && body && body.length > (description?.length||0)*1.5;
  const displayText = (fetchState==="done" && body) ? body : (description||null);

  const tagsRow = (
    <div className="fsnv-tags">
      {category && (
        <span className="fsnv-tag" style={{ background:c.bg, borderColor:c.bd, color:c.tx }}>
          <span style={{ background:c.dot,width:5,height:5,borderRadius:"50%",display:"inline-block",flexShrink:0 }}/>
          {category.toUpperCase()}
        </span>
      )}
      {region    && <span className="fsnv-tag fsnv-tag-neutral"><Globe size={9}/>{region.toUpperCase()}</span>}
      {asset_tag && <span className="fsnv-tag fsnv-tag-crypto"><Tag size={9}/>{asset_tag}</span>}
      {published_at && <span className="fsnv-tag fsnv-tag-time"><Clock size={9}/>{relTime(published_at)}</span>}
    </div>
  );

  const sourceRow = (
    <div className="fsnv-source-row">
      <SourceIcon name={source_name} sourceUrl={source_url} articleUrl={article_url} size={34} radius={8}/>
      <div className="fsnv-source-info">
        <span className="fsnv-source-name-lg">{source_name}</span>
        {isFullText
          ? <span className="fsnv-badge fsnv-badge-full"><CheckCircle size={9}/> Full article</span>
          : fetchState!=="loading" && <span className="fsnv-badge fsnv-badge-excerpt"><AlertCircle size={9}/> RSS excerpt</span>
        }
      </div>
      {/* Share button inside reader */}
      <button className="fsnv-share-btn" onClick={()=>setShowShare(true)}>
        <Share2 size={14}/><Zap size={10}/>{NEWS_SHARE_COST_EP}EP
      </button>
    </div>
  );

  const articleBody = (
    <>
      {fetchState==="loading" && (
        <div className="fsnv-loading"><Loader size={18} className="fsnv-spin"/><span>Loading full article…</span></div>
      )}
      {fetchState!=="loading" && displayText && (
        <div className="fsnv-article-text">{displayText}</div>
      )}
      {fetchState==="failed" && !displayText && (
        <div className="fsnv-unavailable"><AlertCircle size={24}/><p>Visit the source to read this article.</p></div>
      )}
      <div className="fsnv-attribution"><Rss size={12}/>Published by <strong>{source_name}</strong></div>
    </>
  );

  const footerCta = (
    <div className="fsnv-footer">
      {article_url ? (
        <a href={article_url} target="_blank" rel="noopener noreferrer" className="fsnv-cta">
          <ExternalLink size={14}/>Read on {source_name}
        </a>
      ) : (
        <div className="fsnv-cta fsnv-cta-disabled">No source link</div>
      )}
    </div>
  );

  const topbar = (isM) => (
    <div className="fsnv-topbar">
      <button className="fsnv-close" onClick={onClose} aria-label="Close">
        {isM ? <ArrowLeft size={18}/> : <X size={18}/>}
      </button>
      <div className="fsnv-topbar-info">
        <span className="fsnv-topbar-source">{source_name}</span>
        {published_at && <span className="fsnv-topbar-date">{fullDate(published_at)}</span>}
      </div>
      <div style={{flex:1}}/>
      {!isM && isFullText && <span className="fsnv-badge fsnv-badge-full"><CheckCircle size={9}/> Full article</span>}
      <div className="fsnv-news-tag"><span className="fsnv-live-dot"/>NEWS</div>
    </div>
  );

  const modal = (
    <div className="fsnv-root" role="dialog" aria-modal="true">
      {!isMobile && <div className="fsnv-backdrop" onClick={onClose}/>}
      <div className={isMobile ? "fsnv-sheet" : "fsnv-desktop-card"} onClick={e=>e.stopPropagation()}>
        {topbar(isMobile)}
        <div className="fsnv-body">
          {hasImage && <div className="fsnv-hero-wrap"><img src={image_url} alt={title} className="fsnv-hero-img" onError={()=>setImgErr(true)}/></div>}
          <div className="fsnv-content-wrap">
            {tagsRow}
            <h1 className="fsnv-title">{title}</h1>
            {sourceRow}
            <div className="fsnv-rule"/>
            {articleBody}
          </div>
        </div>
        {footerCta}
      </div>
    </div>
  );

  return ReactDOM.createPortal(
    <>
      {modal}
      {showShare && (
        <NewsShareModal
          post={post}
          currentUser={currentUser}
          onClose={() => setShowShare(false)}
          onEpDeducted={() => {}}
        />
      )}
      <style>{FSNV_CSS}</style>
    </>,
    document.body
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// NewsCard
// ══════════════════════════════════════════════════════════════════════════════
const NewsCard = ({ post, currentUser }) => {
  const [expanded,      setExpanded]      = useState(false);
  const [needsTruncate, setNeedsTruncate] = useState(false);
  const [imgErr,        setImgErr]        = useState(false);
  const [showFull,      setShowFull]      = useState(false);
  const [showShare,     setShowShare]     = useState(false);
  const descRef = useRef(null);

  const {
    title="", description="", image_url,
    source_name, source_url, article_url,
    category, region, asset_tag, published_at,
  } = post;

  const c      = cat(category);
  const hasImg = Boolean(image_url && !imgErr);
  const hasDesc = description.trim().length > 0;

  useEffect(() => {
    if (!descRef.current || !hasDesc) return;
    const measure = () => {
      const el = descRef.current;
      if (!el) return;
      const lh = parseFloat(window.getComputedStyle(el).lineHeight) || 22;
      setNeedsTruncate(el.scrollHeight > lh * 3 + 6);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(descRef.current);
    measure();
    return () => ro.disconnect();
  }, [description, hasDesc]);

  const open    = useCallback((e) => { e?.stopPropagation(); setShowFull(true); }, []);
  const openSrc = useCallback((e) => {
    e.stopPropagation();
    if (article_url) window.open(article_url, "_blank", "noopener,noreferrer");
  }, [article_url]);

  return (
    <>
      <div className="nc-card content-card">

        {/* HEADER */}
        <div className="nc-header">
          <SourceIcon name={source_name} sourceUrl={source_url} articleUrl={article_url} size={36} radius={10}/>
          <div className="nc-source-info">
            <div className="nc-source-row-top">
              <span className="nc-source-name">{source_name || "News"}</span>
              <span className="nc-rss-icon"><Rss size={9}/></span>
            </div>
            <div className="nc-meta">
              {published_at && <span className="nc-ts"><Clock size={10}/>{relTime(published_at)}</span>}
              {region && <span className="nc-region"><Globe size={10}/>{region.toUpperCase()}</span>}
            </div>
          </div>
          <div className="nc-live-badge"><span className="nc-live-dot"/>NEWS</div>
        </div>

        {/* HERO IMAGE */}
        {hasImg && (
          <div className="nc-img-wrap" onClick={open} role="button" tabIndex={0}
            onKeyDown={e=>e.key==="Enter"&&open(e)}>
            <img src={image_url} alt={title} className="nc-img" onError={()=>setImgErr(true)} loading="lazy"/>
            <div className="nc-img-hover">
              <span className="nc-hover-pill"><BookOpen size={12}/> Read more</span>
            </div>
          </div>
        )}

        {/* BODY */}
        <div className="nc-body">
          <h3 className="nc-title" onClick={open} role="button" tabIndex={0}
            onKeyDown={e=>e.key==="Enter"&&open(e)}>
            {title}
          </h3>
          {hasDesc && (
            <>
              <div ref={descRef} className={`nc-desc${!expanded&&needsTruncate?" nc-desc-clamp":""}`}>
                {description}
              </div>
              {needsTruncate && (
                <button className="nc-expand-btn" onClick={()=>setExpanded(v=>!v)}>
                  {expanded?<><ChevronUp size={12}/> Show less</>:<><ChevronDown size={12}/> More</>}
                </button>
              )}
            </>
          )}
        </div>

        {/* TAGS */}
        {(category||region||asset_tag) && (
          <div className="nc-tags-row">
            {category && (
              <span className="nc-tag" style={{background:c.bg,borderColor:c.bd}}>
                <span style={{background:c.dot}} className="nc-tag-dot"/>
                <span style={{color:c.tx}}>{category.toUpperCase()}</span>
              </span>
            )}
            {region    && <span className="nc-tag nc-tag-neutral"><Globe size={9}/>{region.toUpperCase()}</span>}
            {asset_tag && <span className="nc-tag nc-tag-crypto"><Tag size={9}/>{asset_tag}</span>}
          </div>
        )}

        {/* FOOTER — [EP] share costs 10 EP, no like button */}
        <div className="nc-footer">
          <button className="nc-btn-read" onClick={open}><BookOpen size={12}/> Read more</button>

          {/* [EP] 10 EP share button */}
          <button className="nc-btn-share" onClick={()=>setShowShare(true)}>
            <Share2 size={12}/><Zap size={10}/>{NEWS_SHARE_COST_EP} EP
          </button>

          {article_url && <button className="nc-btn-src" onClick={openSrc}>Source <ExternalLink size={11}/></button>}
        </div>
      </div>

      {showFull && <FullScreenNewsView post={post} currentUser={currentUser} onClose={()=>setShowFull(false)}/>}

      {showShare && (
        <NewsShareModal
          post={post}
          currentUser={currentUser}
          onClose={() => setShowShare(false)}
          onEpDeducted={() => {}}
        />
      )}

      <style>{NC_CSS}</style>
    </>
  );
};

const NC_CSS = `
.nc-card{background:var(--card-bg,#111);border:1px solid rgba(255,255,255,0.07);border-radius:16px;overflow:hidden;position:relative;transition:border-color 0.2s;}
.nc-card::before{content:"";position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#3b82f6 0%,#84cc16 50%,#eab308 100%);opacity:0.6;z-index:1;}
.nc-card:hover{border-color:rgba(255,255,255,0.12);}
@media(max-width:768px){.nc-card{border-radius:0!important;border-left:none;border-right:none;}}
.nc-header{display:flex;align-items:center;gap:10px;padding:12px 14px 8px;}
.nc-source-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;}
.nc-source-row-top{display:flex;align-items:center;gap:6px;}
.nc-source-name{font-size:13px;font-weight:700;color:#e0e0e0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:185px;}
.nc-rss-icon{width:15px;height:15px;border-radius:50%;background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.3);display:flex;align-items:center;justify-content:center;color:#60a5fa;flex-shrink:0;}
.nc-meta{display:flex;align-items:center;gap:8px;}
.nc-ts{display:flex;align-items:center;gap:3px;font-size:10.5px;color:rgba(255,255,255,0.35);font-weight:500;}
.nc-region{display:flex;align-items:center;gap:3px;font-size:10px;color:rgba(255,255,255,0.3);font-weight:600;}
.nc-live-badge{display:flex;align-items:center;gap:5px;padding:3px 8px;border-radius:999px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.18);font-size:9px;font-weight:800;color:#f87171;letter-spacing:0.08em;flex-shrink:0;}
.nc-live-dot{width:5px;height:5px;border-radius:50%;background:#ef4444;flex-shrink:0;animation:ncPulse 1.8s ease-in-out infinite;}
@keyframes ncPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(0.7)}}
.nc-img-wrap{position:relative;width:100%;height:200px;overflow:hidden;background:#0a0a0a;cursor:pointer;}
.nc-img{width:100%;height:200px;object-fit:cover;display:block;transition:transform 0.3s;}
.nc-card:hover .nc-img{transform:scale(1.02);}
.nc-img-hover{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.55) 0%,transparent 50%);display:flex;align-items:flex-end;padding:10px 12px;opacity:0;transition:opacity 0.22s;}
.nc-img-wrap:hover .nc-img-hover{opacity:1;}
.nc-hover-pill{display:flex;align-items:center;gap:5px;background:rgba(0,0,0,0.6);border:1px solid rgba(255,255,255,0.15);color:rgba(255,255,255,0.9);font-size:11px;font-weight:700;padding:5px 10px;border-radius:7px;backdrop-filter:blur(6px);}
.nc-body{padding:10px 14px 6px;}
.nc-title{font-size:15px;font-weight:800;color:#f0f0f0;line-height:1.45;margin:0 0 7px;cursor:pointer;transition:color 0.15s;word-break:break-word;}
.nc-title:hover{color:#84cc16;}
.nc-desc{font-size:13px;color:rgba(255,255,255,0.62);line-height:1.65;margin:0;word-break:break-word;}
.nc-desc-clamp{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}
.nc-expand-btn{display:inline-flex;align-items:center;gap:3px;background:none;border:none;padding:3px 0 0;color:rgba(132,204,22,0.7);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;transition:color 0.15s;}
.nc-expand-btn:hover{color:#84cc16;}
.nc-tags-row{display:flex;align-items:center;gap:6px;padding:4px 14px 2px;flex-wrap:wrap;}
.nc-tag{display:inline-flex;align-items:center;gap:4px;padding:3px 8px 3px 7px;border-radius:999px;border:1px solid;font-size:9.5px;font-weight:800;letter-spacing:0.04em;}
.nc-tag-dot{width:5px;height:5px;border-radius:50%;flex-shrink:0;display:inline-block;}
.nc-tag-neutral{background:rgba(255,255,255,0.04);border-color:rgba(255,255,255,0.1);color:rgba(255,255,255,0.45);}
.nc-tag-crypto{background:rgba(234,179,8,0.08);border-color:rgba(234,179,8,0.22);color:#fbbf24;}
.nc-footer{display:flex;align-items:center;gap:8px;padding:8px 14px 11px;border-top:1px solid rgba(255,255,255,0.04);margin-top:6px;}
.nc-btn-read{display:inline-flex;align-items:center;gap:5px;padding:6px 14px;border-radius:8px;background:rgba(132,204,22,0.1);border:1px solid rgba(132,204,22,0.3);color:#84cc16;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;transition:background 0.15s,border-color 0.15s,transform 0.1s;}
.nc-btn-read:hover{background:rgba(132,204,22,0.18);border-color:rgba(132,204,22,0.5);transform:translateY(-1px);}
.nc-btn-share{display:inline-flex;align-items:center;gap:4px;padding:6px 11px;border-radius:8px;background:rgba(234,179,8,0.08);border:1px solid rgba(234,179,8,0.25);color:#fbbf24;font-size:11.5px;font-weight:800;cursor:pointer;font-family:inherit;transition:background 0.15s,transform 0.1s;white-space:nowrap;}
.nc-btn-share:hover{background:rgba(234,179,8,0.15);transform:translateY(-1px);}
.nc-btn-src{display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.4);font-size:11.5px;font-weight:600;cursor:pointer;font-family:inherit;transition:background 0.15s,color 0.15s;white-space:nowrap;margin-left:auto;}
.nc-btn-src:hover{background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.65);}
`;

const FSNV_CSS = `
.fsnv-root{isolation:isolate;position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;}
.fsnv-backdrop{position:absolute;inset:0;background:rgba(0,0,0,0.84);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);animation:fsnvFade 0.2s ease both;}
@keyframes fsnvFade{from{opacity:0}to{opacity:1}}
.fsnv-desktop-card{position:relative;z-index:1;width:min(760px,94vw);max-height:92vh;border-radius:20px;overflow:hidden;background:#0f0f0f;border:1px solid rgba(255,255,255,0.1);box-shadow:0 32px 80px rgba(0,0,0,0.75);display:flex;flex-direction:column;animation:fsnvUp 0.25s cubic-bezier(0.34,1.2,0.64,1) both;}
@keyframes fsnvUp{from{opacity:0;transform:translateY(20px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}
.fsnv-sheet{position:relative;z-index:1;width:100%;height:100%;background:#0f0f0f;display:flex;flex-direction:column;overflow:hidden;}
.fsnv-topbar{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.07);flex-shrink:0;background:rgba(15,15,15,0.98);min-height:56px;}
.fsnv-close{width:36px;height:36px;min-width:36px;border-radius:50%;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.7);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:all 0.15s;}
.fsnv-close:hover{background:rgba(132,204,22,0.12);border-color:rgba(132,204,22,0.3);color:#84cc16;}
.fsnv-topbar-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px;}
.fsnv-topbar-source{font-size:13px;font-weight:700;color:#e0e0e0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.fsnv-topbar-date{font-size:10.5px;color:rgba(255,255,255,0.3);font-weight:500;}
.fsnv-news-tag{display:flex;align-items:center;gap:4px;padding:3px 8px;border-radius:999px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.18);font-size:9px;font-weight:800;color:#f87171;letter-spacing:0.08em;flex-shrink:0;}
.fsnv-live-dot{width:5px;height:5px;border-radius:50%;background:#ef4444;animation:ncPulse 1.8s ease-in-out infinite;flex-shrink:0;}
.fsnv-body{flex:1;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(132,204,22,0.3) rgba(255,255,255,0.03);}
.fsnv-body::-webkit-scrollbar{width:5px;}
.fsnv-body::-webkit-scrollbar-thumb{background:rgba(132,204,22,0.3);border-radius:3px;}
.fsnv-hero-wrap{width:100%;height:220px;overflow:hidden;background:#0a0a0a;flex-shrink:0;}
.fsnv-hero-img{width:100%;height:220px;object-fit:cover;display:block;}
@media(max-width:768px){.fsnv-hero-wrap{height:200px;}.fsnv-hero-img{height:200px;}}
.fsnv-content-wrap{padding:18px 18px 12px;}
@media(max-width:768px){.fsnv-content-wrap{padding:14px 16px 10px;}}
.fsnv-tags{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:12px;}
.fsnv-tag{display:inline-flex;align-items:center;gap:4px;padding:3px 9px 3px 7px;border-radius:999px;border:1px solid;font-size:9.5px;font-weight:800;letter-spacing:0.04em;}
.fsnv-tag-neutral{background:rgba(255,255,255,0.04);border-color:rgba(255,255,255,0.1);color:rgba(255,255,255,0.45);}
.fsnv-tag-crypto{background:rgba(234,179,8,0.08);border-color:rgba(234,179,8,0.22);color:#fbbf24;}
.fsnv-tag-time{background:rgba(255,255,255,0.03);border-color:rgba(255,255,255,0.07);color:rgba(255,255,255,0.3);}
.fsnv-title{font-size:20px;font-weight:900;color:#f5f5f5;line-height:1.35;margin:0 0 14px;word-break:break-word;}
@media(max-width:768px){.fsnv-title{font-size:17px;margin-bottom:12px;}}
.fsnv-source-row{display:flex;align-items:center;gap:10px;margin-bottom:14px;}
.fsnv-source-info{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1;}
.fsnv-source-name-lg{font-size:13px;font-weight:700;color:#d0d0d0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.fsnv-share-btn{display:inline-flex;align-items:center;gap:4px;padding:6px 11px;border-radius:8px;background:rgba(234,179,8,0.08);border:1px solid rgba(234,179,8,0.25);color:#fbbf24;font-size:11px;font-weight:800;cursor:pointer;flex-shrink:0;transition:background 0.15s;}
.fsnv-share-btn:hover{background:rgba(234,179,8,0.15);}
.fsnv-badge{display:inline-flex;align-items:center;gap:4px;padding:2px 7px;border-radius:999px;font-size:9.5px;font-weight:700;width:fit-content;}
.fsnv-badge-full{background:rgba(132,204,22,0.1);border:1px solid rgba(132,204,22,0.25);color:#84cc16;}
.fsnv-badge-excerpt{background:rgba(255,165,0,0.08);border:1px solid rgba(255,165,0,0.2);color:#fb923c;}
.fsnv-rule{height:1px;background:linear-gradient(90deg,transparent,rgba(132,204,22,0.2) 50%,transparent);margin:0 0 16px;}
.fsnv-loading{display:flex;align-items:center;gap:10px;padding:20px 0;color:rgba(255,255,255,0.4);font-size:13px;}
.fsnv-spin{animation:fsnvSpin 1s linear infinite;}
@keyframes fsnvSpin{to{transform:rotate(360deg)}}
.fsnv-article-text{font-size:15.5px;color:rgba(255,255,255,0.82);line-height:1.85;word-break:break-word;white-space:pre-wrap;margin-bottom:20px;}
@media(max-width:768px){.fsnv-article-text{font-size:15px;}}
.fsnv-unavailable{display:flex;flex-direction:column;align-items:center;gap:10px;font-size:14px;color:rgba(255,255,255,0.35);line-height:1.65;text-align:center;padding:24px 16px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);margin-bottom:20px;}
.fsnv-attribution{display:flex;align-items:center;gap:6px;font-size:12px;color:rgba(255,255,255,0.3);font-weight:500;padding-top:12px;border-top:1px solid rgba(255,255,255,0.05);}
.fsnv-attribution strong{color:rgba(255,255,255,0.5);}
.fsnv-footer{padding:12px 16px;border-top:1px solid rgba(255,255,255,0.06);flex-shrink:0;background:rgba(15,15,15,0.98);}
.fsnv-cta{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:12px 16px;border-radius:10px;background:rgba(132,204,22,0.1);border:1px solid rgba(132,204,22,0.3);color:#84cc16;font-size:13.5px;font-weight:700;font-family:inherit;text-decoration:none;cursor:pointer;transition:background 0.15s,transform 0.1s;}
.fsnv-cta:hover{background:rgba(132,204,22,0.18);transform:translateY(-1px);}
.fsnv-cta-disabled{background:rgba(255,255,255,0.04);border-color:rgba(255,255,255,0.1);color:rgba(255,255,255,0.25);cursor:default;}
`;

export default NewsCard;