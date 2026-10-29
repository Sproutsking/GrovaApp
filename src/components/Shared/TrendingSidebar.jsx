// src/components/Shared/TrendingSidebar.jsx
// ============================================================================
// Sections (in order):
//   [TS]  Top Streamers — stable historical ranking, never blanks
//   [LV]  Live Now — horizontal scrollable circle cards (currently live)
//   [TAG] Trending Tags — drill-down per row
//   [CRE] Top Creators — profile modal on click
//   Clicking any streamer row opens StreamerDetailModal
//
// REALTIME FIX:
//   - Removed filter:"status=eq.live" from postgres_changes listener.
//     The fix is identical to LiveStreamersRow: listen to ALL changes on
//     live_sessions and re-fetch. The fetch itself filters for status=live.
//     This ensures streams that insert as "pending" then update to "live"
//     are caught immediately.
//   - Added 15s polling interval as belt-and-suspenders fallback.
// ============================================================================

import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import {
  TrendingUp, Search, X, Eye, Sparkles, Flame, Crown, ChevronRight,
  RefreshCw, ArrowRight, ArrowLeft, Hash, FileText, Play,
  BookOpen, Zap, Radio, Tv, BarChart2, Gamepad2, User,
} from "lucide-react";
import useTrinitylens from "../../hooks/useTrinitylens";

import { supabase }         from "../../services/config/supabase";
import mediaUrlService      from "../../services/shared/mediaUrlService";
import exploreService       from "../../services/explore/exploreService";
import UnifiedLoader        from "./UnifiedLoader";
import UserProfileModal     from "../Modals/UserProfileModal";
import StreamerDetailModal  from "./StreamerDetailModal";
import SectionHeader        from "../Shared/SectionHeader";
import ProfilePreview       from "./ProfilePreview";
import PostCard             from "../Home/PostCard";
import ReelCard             from "../Home/ReelCard";
import StoryCard            from "../Home/StoryCard";

// ── Constants ─────────────────────────────────────────────────────────────────
const DESKTOP_HEADER_H  = 58;
const MOBILE_HEADER_H   = 47;
const STREAMERS_PREVIEW = 3;
const MODE_KEYWORDS = {
  gaming: ["gaming", "game", "esports", "sport", "sports"],
  web3: ["web3", "blockchain", "crypto", "defi", "nft", "token", "finance"],
};

const matchesTrinityMode = (item, mode) => {
  if (!mode || mode === "everyday") return true;
  const keywords = MODE_KEYWORDS[mode] || [];
  const value = `${item?.mode || ""} ${item?.category || ""}`.toLowerCase();
  return keywords.some((keyword) => value.includes(keyword));
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) => {
  if (!n) return "0";
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
};

const rankStyle = (rank) => {
  if (rank === 1) return { bg: "var(--brand-warning-gradient)", color: "var(--text)", shadow: "var(--brand-warning-shadow)" };
  if (rank === 2) return { bg: "var(--surface-strong)", color: "var(--text)", shadow: "var(--surface-border)" };
  if (rank === 3) return { bg: "var(--accent-gradient)", color: "var(--text)", shadow: "var(--surface-border)" };
  return { bg: "var(--danger-bg)", color: "var(--danger)", shadow: "transparent" };
};

const TrendingSearch = ({ onNavigate, currentUser }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const triggerRef = useRef(null);
  const popupRef = useRef(null);
  const [popupPosition, setPopupPosition] = useState(null);

  useEffect(() => {
    const onShortcut = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (open && popupPosition && document.activeElement !== inputRef.current) {
      inputRef.current?.focus();
    }
  }, [open, popupPosition]);

  useEffect(() => {
    if (!open) {
      setPopupPosition(null);
      return undefined;
    }

    const positionPopup = () => {
      const trigger = triggerRef.current?.getBoundingClientRect();
      if (!trigger) return;
      const viewportPadding = 12;
      const width = Math.min(680, window.innerWidth - viewportPadding * 2);
      const left = Math.max(
        viewportPadding,
        Math.min(
          trigger.left + trigger.width / 2 - width / 2,
          window.innerWidth - width - viewportPadding,
        ),
      );
      const top = trigger.bottom + 1;
      const availableHeight = Math.max(120, window.innerHeight - top - viewportPadding);
      const height = Math.min(760, availableHeight);
      setPopupPosition({
        top,
        left,
        width,
        height,
        pointerLeft: Math.max(18, Math.min(trigger.left + trigger.width / 2 - left, width - 18)),
      });
    };
    const onOutsidePointer = (event) => {
      if (
        !triggerRef.current?.contains(event.target) &&
        !popupRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    positionPopup();
    window.addEventListener("resize", positionPopup);
    window.addEventListener("scroll", positionPopup, true);
    document.addEventListener("mousedown", onOutsidePointer);
    return () => {
      window.removeEventListener("resize", positionPopup);
      window.removeEventListener("scroll", positionPopup, true);
      document.removeEventListener("mousedown", onOutsidePointer);
    };
  }, [open]);

  useEffect(() => {
    const searchTerm = query.trim();
    if (!open || searchTerm.length < 2) {
      setResults(null);
      setLoading(false);
      setError("");
      return undefined;
    }

    setResults(null);
    setLoading(false);
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const data = await exploreService.searchAll(searchTerm, { limit: 12 }, currentUser?.id);
        if (active) setResults(data);
      } catch (searchError) {
        if (active) {
          setResults(null);
          setError(searchError?.message || "Search is temporarily unavailable.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [open, query, currentUser?.id]);

  const navigate = () => {
    const term = query.trim();
    if (!term) return;
    setOpen(false);
    onNavigate?.(term);
  };

  const contentResults = [
    ...(results?.stories || []).map((item) => ({ item, type: "Story" })),
    ...(results?.posts || []).map((item) => ({ item, type: "Post" })),
    ...(results?.reels || []).map((item) => ({ item, type: "Reel" })),
  ];
  const hasResults = Boolean(
    results?.users?.length || results?.tags?.length || contentResults.length,
  );
  const renderSearchResult = ({ item, type }, index) => {
    if (type === "Post") {
      return (
        <div key={`post-${item.id}`} className="ts-search-native-result">
          <PostCard post={item} currentUser={currentUser} feedIndex={index} />
        </div>
      );
    }
    if (type === "Reel") {
      return (
        <div key={`reel-${item.id}`} className="ts-search-native-result">
          <ReelCard reel={item} currentUser={currentUser} index={index} />
        </div>
      );
    }
    return (
      <div key={`story-${item.id}`} className="ts-search-native-result">
        <StoryCard story={item} currentUser={currentUser} />
      </div>
    );
  };

  const popup = open && popupPosition && (
    <>
      <span
        className="ts-search-pointer"
        aria-hidden="true"
        style={{
          top: popupPosition.top - 6,
          left: popupPosition.left + popupPosition.pointerLeft,
        }}
      />
      <section
        ref={popupRef}
        className="ts-search-modal"
        role="dialog"
        aria-label="Search Xeevia"
        style={{
          top: popupPosition.top,
          left: popupPosition.left,
          width: popupPosition.width,
          height: popupPosition.height,
        }}
      >
        <div className="ts-search-modal-head">
          <div className="ts-search-mark"><Search size={17} /></div>
          <div className="ts-search-input-wrap">
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") navigate();
              }}
              placeholder="Search people, posts, reels, stories, and tags"
              aria-label="Search Xeevia"
            />
            {query && <button className="ts-search-clear" onClick={() => { setQuery(""); inputRef.current?.focus(); }} aria-label="Clear search"><X size={15} /></button>}
          </div>
          <button className="ts-search-escape" onClick={() => setOpen(false)}>Esc</button>
        </div>

        <div className="ts-search-results">
          {!query.trim() && (
            <div className="ts-search-empty">
              <span className="ts-search-empty-icon"><Search size={20} /></span>
              <strong>Find your next connection</strong>
              <span>Search across people, posts, stories, reels, and topics.</span>
            </div>
          )}
          {query.trim().length === 1 && <div className="ts-search-hint">Type one more character to search.</div>}
          {loading && <div className="ts-search-status"><RefreshCw size={15} className="spin" /> Searching Xeevia…</div>}
          {!loading && error && <div className="ts-search-error">{error}</div>}
          {!loading && !error && results && !hasResults && (
            <div className="ts-search-empty">
              <span className="ts-search-empty-icon"><Search size={20} /></span>
              <strong>No matches yet</strong>
              <span>Try another name, phrase, @mention, or #tag.</span>
            </div>
          )}
          {!loading && results?.users?.length > 0 && (
            <div className="ts-search-group">
              <div className="ts-search-group-title"><User size={13} /> People</div>
              {results.users.slice(0, 4).map((user) => (
              <div key={user.id} className="ts-search-user">
                <ProfilePreview
                  profile={{
                    userId: user.id,
                    user_id: user.id,
                    author: user.full_name,
                    username: user.username,
                    avatar_id: user.avatar_id,
                    verified: user.verified,
                  }}
                  currentUser={currentUser}
                  size="small"
                  layout="horizontal"
                  showUsername
                  className="ts-search-profile"
                />
                <button className="ts-search-arrow-button" onClick={navigate} aria-label={`See search results for ${user.full_name || user.username}`}>
                  <ArrowRight size={14} className="ts-search-arrow" />
                </button>
              </div>
              ))}
            </div>
          )}
          {!loading && results?.tags?.length > 0 && (
            <div className="ts-search-group">
              <div className="ts-search-group-title"><Hash size={13} /> Topics</div>
              <div className="ts-search-tags">
                {results.tags.slice(0, 6).map((tag, index) => (
                  <button key={`${tag.tag}-${index}`} onClick={() => { setQuery(tag.tag); }}>
                    <Hash size={12} />{tag.tag.replace(/^#/, "")}<small>{fmt(tag.count)}</small>
                  </button>
                ))}
              </div>
            </div>
          )}
          {!loading && contentResults.length > 0 && (
            <div className="ts-search-group">
              <div className="ts-search-group-title"><FileText size={13} /> Content</div>
              <div className="ts-search-feed-results" aria-label="Matching posts, reels, and stories">
                {contentResults.slice(0, 6).map(renderSearchResult)}
              </div>
            </div>
          )}
        </div>
        {query.trim().length >= 2 && (
          <button className="ts-search-all" onClick={navigate}>See all results for “{query.trim()}” <ArrowRight size={14} /></button>
        )}
      </section>
    </>
  );

  return (
    <>
      <div ref={triggerRef} className="ts-search-anchor">
        <button className="ts-search-trigger" onClick={() => setOpen(true)} aria-label="Search Xeevia" aria-expanded={open}>
          <Search size={15} /><span>Search Xeevia</span><kbd>⌘ K</kbd>
        </button>
      </div>
      {popup && ReactDOM.createPortal(popup, document.body)}
      <style>{`
        .ts-search-anchor{position:relative;width:min(245px,100%);max-width:100%}
        .ts-search-trigger{display:flex;align-items:center;gap:9px;width:100%;max-width:245px;height:38px;padding:0 11px;border-radius:11px;border:1px solid var(--surface-border);background:var(--surface);color:var(--text-secondary);font-family:inherit;font-size:calc((12px) + 1px);font-weight:600;letter-spacing:normal;text-transform:none;white-space:normal;text-align:left;cursor:pointer;transition:border-color .18s,background .18s,box-shadow .18s}
        .ts-search-trigger:hover{border-color:var(--accent-border);background:var(--surface-strong);box-shadow:0 0 0 3px var(--accent-bg-soft)}
        .ts-search-trigger>svg{color:var(--accent);flex-shrink:0}.ts-search-trigger span{flex:1}.ts-search-trigger kbd{padding:2px 5px;border:1px solid var(--surface-border);border-radius:5px;background:var(--surface-strong);font:10px inherit;color:var(--text-secondary)}
        .ts-search-pointer{position:fixed;z-index:100199;width:12px;height:12px;transform:translateX(-50%) rotate(45deg);background:#10130e;border-top:1px solid rgba(132,204,22,.34);border-left:1px solid rgba(132,204,22,.34);pointer-events:none}
        .ts-search-modal{position:fixed;z-index:100200;display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(132,204,22,.25);border-radius:16px;background:linear-gradient(145deg,#10130e,#090a09 65%);box-shadow:0 18px 54px rgba(0,0,0,.42),0 0 36px rgba(132,204,22,.07);animation:tsSearchRise .16s cubic-bezier(.2,.8,.2,1) both}
        .ts-search-modal-head,.ts-search-results,.ts-search-all{position:relative;z-index:1;background:#10130e}
        .ts-search-modal-head{border-radius:15px 15px 0 0}
        .ts-search-results{flex:1;min-height:0}
        .ts-search-all{border-radius:0 0 15px 15px}
        .ts-search-modal-head{display:flex;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid rgba(255,255,255,.08)}
        .ts-search-mark{width:38px;height:38px;display:grid;place-items:center;flex-shrink:0;border-radius:12px;background:rgba(132,204,22,.12);border:1px solid rgba(132,204,22,.24);color:#a8e63d}
        .ts-search-input-wrap{flex:1;display:flex;align-items:center;min-width:0}
        .ts-search-input-wrap input{width:100%;padding:8px 0;border:0;outline:0;background:transparent;color:#f5f8ef;font:500 16px inherit}
        .ts-search-input-wrap input::placeholder{color:#73786e}
        .ts-search-clear,.ts-search-escape{display:grid;place-items:center;flex-shrink:0;border:1px solid rgba(255,255,255,.12);border-radius:7px;background:rgba(255,255,255,.04);color:#a0a49a;cursor:pointer}
        .ts-search-clear{width:27px;height:27px}.ts-search-escape{padding:5px 7px;font:11px inherit}
        .ts-search-results{overflow-y:auto;min-height:0;padding:10px 14px 16px;overscroll-behavior:contain}
        .ts-search-empty{min-height:min(190px,25vh);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;color:#858b7e}
        .ts-search-empty strong{color:#e8eddf;font-size:calc((15px) + 1px)}.ts-search-empty>span:last-child{max-width:330px;font-size:calc((12px) + 1px);line-height:1.5}
        .ts-search-empty-icon{width:42px;height:42px;display:grid;place-items:center;border:1px solid rgba(132,204,22,.2);border-radius:14px;background:rgba(132,204,22,.07);color:#a8e63d}
        .ts-search-hint,.ts-search-status,.ts-search-error{padding:22px 10px;text-align:center;color:#93988d;font-size:calc((13px) + 1px)}
        .ts-search-status{display:flex;justify-content:center;align-items:center;gap:8px}.ts-search-status svg{color:#a8e63d}
        .ts-search-error{color:#fca5a5}
        .ts-search-group{margin:6px 0 16px}.ts-search-group-title{display:flex;align-items:center;gap:7px;padding:5px 5px 8px;color:#a8e63d;font-size:calc((10px) + 1px);font-weight:800;letter-spacing:.09em;text-transform:uppercase}
        .ts-search-user{width:100%;display:flex;align-items:center;gap:11px;padding:10px;border:1px solid rgba(255,255,255,.09);border-radius:12px;background:linear-gradient(135deg,rgba(255,255,255,.045),rgba(255,255,255,.018));color:inherit;text-align:left;box-shadow:inset 0 1px rgba(255,255,255,.035),0 4px 12px rgba(0,0,0,.12);transition:background .16s,border-color .16s,box-shadow .16s,transform .16s}
        .ts-search-user+.ts-search-user{margin-top:7px}
        .ts-search-user{justify-content:space-between}
        .ts-search-user:hover{transform:translateY(-1px);background:linear-gradient(135deg,rgba(132,204,22,.09),rgba(255,255,255,.035));border-color:rgba(132,204,22,.28);box-shadow:inset 0 1px rgba(255,255,255,.055),0 7px 18px rgba(0,0,0,.22)}
        .ts-search-feed-results{display:flex;flex-direction:column;gap:12px}
        .ts-search-native-result{width:100%;min-width:0;max-width:100%}
        .ts-search-native-result>.gvp-card,.ts-search-native-result>.xv-reel-card,.ts-search-native-result>.story-card-premium{width:100%;max-width:100%;margin:0!important}
        .ts-search-user:focus-within,.ts-search-tags button:focus-visible{outline:2px solid rgba(168,230,61,.75);outline-offset:2px}
        .ts-search-profile{flex:1;min-width:0;max-width:none!important;padding:2px 0!important}
        .ts-search-arrow-button{width:30px;height:30px;display:grid;place-items:center;flex-shrink:0;border:1px solid rgba(255,255,255,.1);border-radius:9px;background:rgba(255,255,255,.035);cursor:pointer}
        .ts-search-arrow-button:hover{border-color:rgba(132,204,22,.32);background:rgba(132,204,22,.1)}
        .ts-search-verified{color:#a8e63d}.ts-search-arrow{flex-shrink:0;color:#737a6a;transition:transform .15s,color .15s}.ts-search-user:hover .ts-search-arrow{transform:translateX(2px);color:#a8e63d}
        .ts-search-tags{display:flex;flex-wrap:wrap;gap:8px;padding:0 4px}.ts-search-tags button{display:flex;align-items:center;gap:5px;padding:8px 11px;border:1px solid rgba(132,204,22,.22);border-radius:10px;background:linear-gradient(140deg,rgba(132,204,22,.1),rgba(132,204,22,.035));color:#dce7cf;font:600 11px inherit;box-shadow:inset 0 1px rgba(255,255,255,.04),0 3px 10px rgba(0,0,0,.13);cursor:pointer;transition:background .15s,border-color .15s,transform .15s,box-shadow .15s}.ts-search-tags button:hover{transform:translateY(-1px);border-color:rgba(132,204,22,.48);background:linear-gradient(140deg,rgba(132,204,22,.18),rgba(132,204,22,.07));box-shadow:0 6px 14px rgba(0,0,0,.2)}.ts-search-tags button svg{color:#a8e63d}.ts-search-tags button small{color:#8d9584}
        .ts-search-all{display:flex;align-items:center;justify-content:center;gap:8px;padding:13px;border:0;border-top:1px solid rgba(255,255,255,.08);background:rgba(132,204,22,.06);color:#b9e67b;font:700 12px inherit;cursor:pointer}.ts-search-all:hover{background:rgba(132,204,22,.12)}
        @keyframes tsSearchRise{from{opacity:0;transform:translateY(-4px) scale(.99)}to{opacity:1;transform:translateY(0) scale(1)}}
        @media(max-width:600px){.ts-search-modal{border-radius:15px}.ts-search-modal-head{padding:12px}.ts-search-input-wrap input{font-size:calc((14px) + 1px)}.ts-search-anchor{width:min(210px,100%)}.ts-search-trigger kbd{display:none}}
      `}</style>
    </>
  );
};

// ── Live sessions fetcher (currently live only) ───────────────────────────────
const fetchLiveSessions = async (mode = "everyday") => {
  const { data, error } = await supabase
    .from("live_sessions")
    .select(`id, title, category, mode, peak_viewers, total_likes, started_at, livekit_room, is_private,
             profiles:user_id (id, full_name, username, avatar_id, verified)`)
    .eq("status", "live")
    .eq("is_private", false)
    .order("peak_viewers", { ascending: false })
    .limit(50);
  if (error) {
    if (error.code === "42P01" || error.message?.includes("does not exist")) return [];
    throw error;
  }
  return (data || []).filter((session) => matchesTrinityMode(session, mode)).slice(0, 20);
};

// ── Top streamers fetcher ─────────────────────────────────────────────────────
const fetchTopStreamers = async (mode = "everyday") => {
  let ranked = [];
  try {
    const { data: rpcData, error: rpcError } = mode === "everyday"
      ? await supabase.rpc("get_top_streamers")
      : { data: null, error: new Error("mode filtering requires source rows") };
    if (!rpcError && rpcData && rpcData.length > 0) {
      ranked = rpcData.map((row, i) => ({
        userId:      row.user_id,
        peakViewers: row.peak_viewers  || 0,
        totalLikes:  row.total_likes   || 0,
        sessions:    row.sessions      || 0,
        score:       row.score         || 0,
      }));
    } else {
      const { data, error } = await supabase
        .from("live_sessions")
        .select("user_id, mode, category, peak_viewers, total_likes")
        .not("user_id", "is", null)
        .order("peak_viewers", { ascending: false })
        .limit(1000);
      if (error) {
        if (error.code === "42P01" || error.message?.includes("does not exist")) return [];
        throw error;
      }
      const map = {};
      (data || []).filter((session) => matchesTrinityMode(session, mode)).forEach((s) => {
        const uid = s.user_id;
        if (!map[uid]) map[uid] = { peakViewers: 0, totalLikes: 0, sessions: 0 };
        map[uid].peakViewers  = Math.max(map[uid].peakViewers, s.peak_viewers  || 0);
        map[uid].totalLikes  += s.total_likes  || 0;
        map[uid].sessions    += 1;
      });
      ranked = Object.entries(map)
        .map(([uid, d]) => ({
          userId:      uid,
          peakViewers: d.peakViewers,
          totalLikes:  d.totalLikes,
          sessions:    d.sessions,
          score: d.sessions * 300 + d.peakViewers * 0.6 + d.totalLikes * 0.4,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 30);
    }
  } catch { return []; }

  if (ranked.length === 0) return [];
  const ids = ranked.map((r) => r.userId);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, username, avatar_id, verified")
    .in("id", ids);
  const pm = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
  return ranked
    .map((item, i) => ({
      ...item,
      rank:    i + 1,
      profile: pm[item.userId] || { id: item.userId, full_name: null, username: null, avatar_id: null, verified: false },
    }))
    .filter((item) => pm[item.userId] || item.sessions > 0);
};

// ── Sliding panel ─────────────────────────────────────────────────────────────
const SlidingPanel = ({
  isMobile, onClose, title, subtitle,
  icon: Icon, iconColor = "var(--accent)",
  iconBg = "var(--accent-bg-soft)", iconBorder = "var(--accent-border)",
  children,
}) => {
  const top = isMobile ? MOBILE_HEADER_H : DESKTOP_HEADER_H;
  return (
    <>
      <div className="sp-overlay" style={{ top }} onClick={onClose} />
      <div className="sp-panel" style={{ top, height: `calc(100vh - ${top}px)` }}>
        <div className="sp-hdr">
          <div className="sp-hdr-left">
            <div className="sp-icon" style={{ background: iconBg, borderColor: iconBorder }}>
              <Icon size={14} color={iconColor} />
            </div>
            <div>
              <div className="sp-title">{title}</div>
              {subtitle && <div className="sp-subtitle">{subtitle}</div>}
            </div>
          </div>
          <button className="sp-close" onClick={onClose}><X size={13} /></button>
        </div>
        <div className="sp-body">{children}</div>
      </div>
    </>
  );
};

// ── Post preview card ─────────────────────────────────────────────────────────
const PostPreviewCard = ({ post, onNavigate }) => (
  <button className="pp-card" style={{ animationDelay: `${post._idx * 0.04}s` }} onClick={() => onNavigate(post)}>
    {post.thumbnail && (
      <div className="pp-thumb">
        <img src={post.thumbnail} alt="" />
        {post.contentType === "reel" && <div className="pp-play"><Play size={10} color="var(--accent-contrast)" /></div>}
      </div>
    )}
    <div className="pp-body">
      <div className="pp-author-row">
        <div className="pp-avatar">
          {post.authorAvatar?.startsWith("http") ? <img src={post.authorAvatar} alt="" /> : <span>{post.authorAvatar || "?"}</span>}
        </div>
        <div className="pp-author-info">
          <span className="pp-author-name">{post.authorName}</span>
          <span className="pp-author-handle">@{post.authorUsername}</span>
        </div>
        <div className="pp-type-badge">
          {post.contentType === "reel"  && <Play     size={9} color="var(--danger)" />}
          {post.contentType === "story" && <BookOpen size={9} color="var(--brand-purple)" />}
          {post.contentType === "post"  && <FileText size={9} color="var(--brand-info)" />}
          <span>{post.contentType}</span>
        </div>
      </div>
      {post.caption && <p className="pp-caption">{post.caption.slice(0, 80)}{post.caption.length > 80 ? "…" : ""}</p>}
      <div className="pp-stats">
        <span><Eye size={9} />{fmt(post.views)}</span>
        <span>❤ {fmt(post.likes)}</span>
      </div>
    </div>
    <ChevronRight size={13} className="pp-arrow" />
  </button>
);

// ── Mobile header ─────────────────────────────────────────────────────────────
const MobileHeader = ({ onClose }) => (
  <div className="mob-hdr">
    <div className="mob-hdr-title"><TrendingUp size={18} /><span>Trending</span></div>
    <button className="mob-close" onClick={onClose}><X size={18} /></button>
  </div>
);

// ── Compact streamer row ──────────────────────────────────────────────────────
const AVATAR_GRADIENTS = [
  "var(--accent-gradient)",
  "var(--brand-info-gradient)",
  "var(--brand-purple-gradient)",
  "var(--brand-warning-gradient)",
  "var(--brand-pink-gradient)",
  "var(--brand-success-gradient)",
  "var(--brand-orange-gradient)",
  "var(--brand-info-gradient)",
];
const avatarGradient = (seed = "") => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
};

const readTrendingCache = () => {
  try {
    const cached = JSON.parse(localStorage.getItem("xv_trending_sidebar_cache") || "null");
    return cached && typeof cached === "object" ? cached : {};
  } catch {
    return {};
  }
};

const StreamerRow = ({ streamer, onClick }) => {
  const [imgErr, setImgErr] = useState(false);
  const rc = rankStyle(streamer.rank);
  const pr = streamer.profile || {};
  const avatarUrl =
    !imgErr && pr.avatar_id
      ? mediaUrlService.resolveAvatarUrl(pr.avatar_id, 60)
      : null;
  const initial  = (pr.full_name || pr.username || "?").charAt(0).toUpperCase();
  const fallback = avatarGradient(pr.id || pr.username || String(streamer.rank));

  return (
    <div className="streamer-row" onClick={() => onClick?.(streamer)}>
      <div className="streamer-rank" style={{ background: rc.bg, color: rc.color, boxShadow: `0 2px 8px ${rc.shadow}` }}>
        {streamer.rank}
      </div>
      <div className="streamer-avatar" style={{ background: avatarUrl ? undefined : fallback }}>
        {avatarUrl
          ? <img src={avatarUrl} alt="" onError={() => setImgErr(true)} />
          : <span>{initial}</span>}
      </div>
      <div className="streamer-info">
        <div className="streamer-name">
          {pr.full_name || pr.username || `Streamer #${streamer.rank}`}
          {pr.verified && <span className="v-badge"><Sparkles size={8} /></span>}
        </div>
        <div className="streamer-meta">
          {pr.username && <><span>@{pr.username}</span><span className="dot">·</span></>}
          <Eye size={9} />
          <span className="accent">{fmt(streamer.peakViewers)}</span>
          <span className="dot">·</span>
          <span className="accent">{streamer.sessions}</span>
          <span>{streamer.sessions === 1 ? "stream" : "streams"}</span>
        </div>
      </div>
      <ChevronRight size={13} className="streamer-arrow" />
    </div>
  );
};

// ── Streamer circle card (Live Now strip) ─────────────────────────────────────
const StreamerCircle = ({ session, onJoin, isOwn }) => {
  const profile = session.profiles || {};
  const [imgErr,    setImgErr]    = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const avatarUrl =
    !imgErr && profile.avatar_id
      ? mediaUrlService.resolveAvatarUrl(profile.avatar_id, 100)
      : null;
  const initial = (profile.full_name || profile.username || "?").charAt(0).toUpperCase();

  return (
    <button
      className={`sc-card${isOwn ? " sc-own" : ""}`}
      onClick={() => !isOwn && onJoin(session)}
      title={isOwn ? "Your stream" : `${profile.username || "Streamer"} — ${session.title}`}
    >
      <div className="sc-ring-wrap">
        <div className="sc-ring">
          <div className="sc-spin" />
          <div className="sc-avatar-wrap">
            <div className="sc-avatar-inner">
              <span className="sc-initial">{initial}</span>
              {avatarUrl && (
                <img src={avatarUrl} alt=""
                  onLoad={() => setImgLoaded(true)} onError={() => setImgErr(true)}
                  style={{ opacity: imgLoaded ? 1 : 0 }} />
              )}
            </div>
          </div>
        </div>
        <div className="sc-pulse" />
        <div className="sc-dot" />
        <div className="sc-chip"><Eye size={7} strokeWidth={2.5} />{fmt(session.peak_viewers || 0)}</div>
      </div>
      <span className="sc-name">{(profile.username || profile.full_name || "stream").slice(0, 9)}</span>
      <span className="sc-cat">{(session.category || "").slice(0, 8)}</span>
    </button>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const TrendingSidebar = ({ currentUser, isMobile = false, onClose, setActiveTab, setFeedFilter, onJoinStream, onSearchNavigate }) => {
  const { activeTrinityLens } = useTrinitylens();
  const [liveSessions,    setLiveSessions]    = useState([]);
  const [liveLoading,     setLiveLoading]     = useState(true);
  const [topStreamers,    setTopStreamers]    = useState(() => readTrendingCache().topStreamers || []);
  const [trendingTags,    setTrendingTags]   = useState(() => readTrendingCache().trendingTags || []);
  const [eliteCreators,   setEliteCreators]   = useState(() => readTrendingCache().eliteCreators || []);
  const [loading,         setLoading]         = useState(() => {
    const cached = readTrendingCache();
    return !(cached.topStreamers?.length || cached.trendingTags?.length || cached.eliteCreators?.length);
  });
  const [error,           setError]           = useState(null);
  const [refreshing,      setRefreshing]      = useState(false);

  const streamersCache  = useRef([]);
  const livePollRef     = useRef(null);

  const [streamersPanel,  setStreamersPanel]  = useState(false);
  const [tagsPanel,       setTagsPanel]       = useState(false);
  const [creatorsPanel,   setCreatorsPanel]   = useState(false);
  const [tagPostsPanel,   setTagPostsPanel]   = useState(false);
  const [activeTag,       setActiveTag]       = useState(null);
  const [tagPosts,        setTagPosts]        = useState([]);
  const [tagPostsLoading, setTagPostsLoading] = useState(false);

  const [creatorModal,    setCreatorModal]    = useState(false);
  const [selectedCreator, setSelectedCreator] = useState(null);
  const [streamerDetail,  setStreamerDetail]  = useState(null);

  // ── Live realtime — FIXED ─────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;

    const loadLive = async () => {
      try {
        const d = await fetchLiveSessions(activeTrinityLens);
        if (alive) setLiveSessions(d);
      } catch { /* silent */ }
      finally { if (alive) setLiveLoading(false); }
    };

    loadLive();

    // ── REALTIME FIX ──────────────────────────────────────────────────────
    // No filter: "status=eq.live" — listen to ALL live_sessions changes and
    // re-fetch. This catches the UPDATE from "pending" → "live" reliably.
    const ch = supabase
      .channel("ts_live_v2")
      .on(
        "postgres_changes",
        {
          event: "*",   // INSERT, UPDATE, DELETE — no column filter
          schema: "public",
          table: "live_sessions",
        },
        async () => {
          try {
            const d = await fetchLiveSessions(activeTrinityLens);
            if (alive) setLiveSessions(d);
          } catch { /* silent */ }
        },
      )
      .subscribe();

    // Realtime is primary; poll occasionally as a fallback when a connection drops.
    livePollRef.current = setInterval(async () => {
      if (document.hidden) return;
      try {
        const d = await fetchLiveSessions(activeTrinityLens);
        if (alive) setLiveSessions(d);
      } catch { /* silent */ }
    }, 60_000);

    return () => {
      alive = false;
      supabase.removeChannel(ch);
      clearInterval(livePollRef.current);
    };
  }, [activeTrinityLens]);

  // ── All other data ────────────────────────────────────────────────────────
  useEffect(() => {
    streamersCache.current = [];
    setTopStreamers([]);
    setTrendingTags([]);
    setEliteCreators([]);
    loadAll(true, activeTrinityLens);
    const iv = setInterval(() => loadAll(false), 10 * 60 * 1000);
    return () => clearInterval(iv);
  }, [activeTrinityLens]);

  const loadAll = async (initial = false, mode = activeTrinityLens) => {
    if (initial) setLoading(true);
    setError(null);
    try {
      const [streamers, tags, creators] = await Promise.all([
        fetchTopStreamers(mode),
        loadTrendingTags(mode),
        loadActiveCreators(mode),
      ]);
      if (streamers.length > 0) {
        setTopStreamers(streamers);
        streamersCache.current = streamers;
      } else if (streamersCache.current.length > 0) {
        setTopStreamers(streamersCache.current);
      }
      setTrendingTags(tags);
      setEliteCreators(creators);
      try {
        localStorage.setItem("xv_trending_sidebar_cache", JSON.stringify({
          topStreamers: streamers.length ? streamers : streamersCache.current,
          trendingTags: tags,
          eliteCreators: creators,
        }));
      } catch {}
    } catch (e) {
      setError(e.message);
      if (streamersCache.current.length > 0) setTopStreamers(streamersCache.current);
    } finally {
      if (initial) setLoading(false);
      setRefreshing(false);
    }
  };

  const loadTrendingTags = async (mode = activeTrinityLens) => {
    const [sR, pR, rR] = await Promise.all([
      supabase.from("stories").select("category,views").is("deleted_at", null).order("views", { ascending: false }).limit(100),
      supabase.from("posts"  ).select("category,views").is("deleted_at", null).order("views", { ascending: false }).limit(100),
      supabase.from("reels"  ).select("category,views").is("deleted_at", null).order("views", { ascending: false }).limit(100),
    ]);
    const map = {};
    [...(sR.data || []), ...(pR.data || []), ...(rR.data || [])].forEach((item) => {
      const cat = item.category || "General";
      if (!map[cat]) map[cat] = { views: 0, count: 0 };
      map[cat].views += item.views || 0; map[cat].count++;
    });
    return Object.entries(map)
      .map(([label, d]) => ({ label, views: d.views, posts: d.count, trendScore: d.views * 0.7 + d.count * 100 * 0.3 }))
      .filter((tag) => matchesTrinityMode({ category: tag.label }, mode))
      .sort((a, b) => b.trendScore - a.trendScore).slice(0, 30);
  };

  const loadActiveCreators = async (mode = activeTrinityLens) => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
    const iso = cutoff.toISOString();
    const [pR, rR, sR] = await Promise.all([
      supabase.from("posts"  ).select("user_id,likes,views,comments_count").is("deleted_at", null).gte("created_at", iso),
      supabase.from("reels"  ).select("user_id,likes,views,comments_count").is("deleted_at", null).gte("created_at", iso),
      supabase.from("stories").select("user_id,likes,views,comments_count").is("deleted_at", null).gte("created_at", iso),
    ]);
    const stats = {};
    [...(pR.data || []), ...(rR.data || []), ...(sR.data || [])].filter((item) => matchesTrinityMode(item, mode)).forEach((item) => {
      const uid = item.user_id;
      if (!stats[uid]) stats[uid] = { likes: 0, views: 0, comments: 0, posts: 0 };
      stats[uid].likes += item.likes || 0; stats[uid].views += item.views || 0;
      stats[uid].comments += item.comments_count || 0; stats[uid].posts++;
    });
    const topIds = Object.entries(stats)
      .map(([uid, st]) => ({ uid, score: st.likes * 3 + st.comments * 5 + st.views * 0.1, ...st }))
      .sort((a, b) => b.score - a.score).slice(0, 30).map((u) => u.uid);
    if (!topIds.length) return [];
    const { data: profiles } = await supabase.from("profiles").select("id,full_name,username,avatar_id,verified,bio").in("id", topIds);
    return topIds.map((uid, i) => {
      const pr = profiles?.find((p) => p.id === uid); if (!pr) return null;
      const st = stats[uid];
      const avatar = mediaUrlService.resolveAvatarUrl(pr.avatar_id, 200);
      return {
        userId: pr.id, rank: i + 1, name: pr.full_name || "Creator", username: pr.username || "user",
        avatar: avatar || pr.full_name?.charAt(0) || "G", verified: pr.verified || false, bio: pr.bio || "",
        stats: { likes: st.likes, views: st.views, comments: st.comments, posts: st.posts }, isTopTier: i < 3,
      };
    }).filter(Boolean);
  };

  const loadTagPosts = async (tag) => {
    setTagPostsLoading(true); setTagPosts([]);
    try {
      const [pR, rR, sR] = await Promise.all([
        supabase.from("posts"  ).select("id,user_id,caption,category,views,likes,media_id,created_at"   ).eq("category", tag.label).is("deleted_at", null).order("views", { ascending: false }).limit(10),
        supabase.from("reels"  ).select("id,user_id,caption,category,views,likes,thumbnail_id,created_at").eq("category", tag.label).is("deleted_at", null).order("views", { ascending: false }).limit(10),
        supabase.from("stories").select("id,user_id,caption,category,views,likes,media_id,created_at"   ).eq("category", tag.label).is("deleted_at", null).order("views", { ascending: false }).limit(10),
      ]);
      const all = [
        ...(pR.data || []).map((x) => ({ ...x, contentType: "post",  thumbField: "media_id"     })),
        ...(rR.data || []).map((x) => ({ ...x, contentType: "reel",  thumbField: "thumbnail_id" })),
        ...(sR.data || []).map((x) => ({ ...x, contentType: "story", thumbField: "media_id"     })),
      ];
      const uids = [...new Set(all.map((x) => x.user_id))];
      const { data: profiles } = uids.length
        ? await supabase.from("profiles").select("id,full_name,username,avatar_id").in("id", uids)
        : { data: [] };
      const pm = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
      setTagPosts(all.map((item, idx) => {
        const pr = pm[item.user_id] || {}; const thumbId = item[item.thumbField];
        return {
          id: item.id, contentType: item.contentType, caption: item.caption || "",
          views: item.views || 0, likes: item.likes || 0,
          authorName: pr.full_name || "Creator", authorUsername: pr.username || "user",
          authorAvatar: mediaUrlService.resolveAvatarUrl(pr.avatar_id, 80) || pr.full_name?.charAt(0) || "?",
          thumbnail: thumbId ? mediaUrlService.getImageUrl(thumbId, { width: 160, height: 160, crop: "fill" }) : null,
          _idx: idx,
        };
      }).sort((a, b) => b.views - a.views));
    } catch (e) { console.error(e); }
    finally { setTagPostsLoading(false); }
  };

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleTagNavigate  = (tag)    => { setFeedFilter?.({ type: "tag",  value: tag.label }); setActiveTab?.("home"); onClose?.(); };
  const handleTagDrill     = (e, tag) => { e.stopPropagation(); setActiveTag(tag); setTagPostsPanel(true); setTagsPanel(false); loadTagPosts(tag); };
  const handlePostNavigate = (post)   => { setFeedFilter?.({ type: "post", value: post.id, contentType: post.contentType }); setActiveTab?.("home"); onClose?.(); };
  const handleJoin         = (session) => { onJoinStream?.(session); onClose?.(); };
  const handleStreamerClick = (streamer) => setStreamerDetail(streamer);
  const handleCreatorClick  = (creator) => {
    setSelectedCreator({ id: creator.userId, user_id: creator.userId, name: creator.name, author: creator.name, username: creator.username, avatar: creator.avatar, verified: creator.verified });
    setCreatorModal(true);
  };

  // ── Inner sub-components ──────────────────────────────────────────────────
  const TagRow = ({ tag, index }) => (
    <div className="tag-row" onClick={() => handleTagNavigate(tag)}>
      <div className={`tag-num${index < 3 ? " hot" : ""}`}>{index < 3 ? <Flame size={11} /> : index + 1}</div>
      <div className="tag-body">
        <span className="tag-name">{tag.label}</span>
        <div className="tag-meta">
          <Eye size={10} />{fmt(tag.views)}<span className="dot">·</span>{tag.posts} posts
          {index < 3 && <span className="hot-chip">HOT</span>}
        </div>
      </div>
      <button className="tag-drill-btn" onClick={(e) => handleTagDrill(e, tag)}>
        <ChevronRight size={13} />
      </button>
    </div>
  );

  const CreatorRow = ({ creator }) => {
    const rc = rankStyle(creator.rank);
    return (
      <div className={`creator-row${creator.isTopTier ? " top-tier" : ""}`} onClick={() => handleCreatorClick(creator)}>
        <div className="creator-rank" style={{ background: rc.bg, color: rc.color, boxShadow: `0 3px 10px ${rc.shadow}` }}>{creator.rank}</div>
        <div className="creator-avatar-wrap">
          <div className="creator-avatar">
            {typeof creator.avatar === "string" && creator.avatar.startsWith("http") ? <img src={creator.avatar} alt={creator.name} /> : creator.avatar}
          </div>
          {creator.isTopTier && <div className="crown-pip"><Crown size={8} color="var(--accent-contrast)" /></div>}
        </div>
        <div className="creator-info">
          <div className="creator-name">{creator.name}{creator.verified && <span className="v-badge"><Sparkles size={8} /></span>}</div>
          <div className="creator-meta">
            <span>@{creator.username}</span><span className="dot">·</span>
            <span className="accent">{fmt(creator.stats.likes)}</span> likes<span className="dot">·</span>
            <span className="accent">{creator.stats.posts}</span> posts
          </div>
        </div>
        <ChevronRight size={13} className="creator-arrow" />
      </div>
    );
  };

  const renderDesktopSearchHeader = () => (
    <div className="ts-search-header">
      <TrendingSearch currentUser={currentUser} onNavigate={onSearchNavigate} />
      <button
        className="ts-refresh"
        onClick={() => { setRefreshing(true); loadAll(false); }}
        disabled={refreshing}
        title="Refresh"
        aria-label="Refresh trending"
      >
        <RefreshCw size={11} className={refreshing ? "spin" : ""} />
      </button>
    </div>
  );

  if (loading && topStreamers.length === 0) return (
    <aside className={isMobile ? "trending-mobile-fullscreen" : "trending-sidebar"}>
      {isMobile && <MobileHeader onClose={onClose} />}
      {!isMobile && renderDesktopSearchHeader()}
      <div style={{ padding: "12px" }}>
        <UnifiedLoader type="section" message="Loading trending…" />
      </div>
    </aside>
  );

  const topTags      = trendingTags.slice(0, 3);
  const topCreators  = eliteCreators.slice(0, 3);
  const modeSignals = activeTrinityLens === "web3"
    ? [
        { label: "$XEV momentum", value: "+12.5%", tone: "up" },
        { label: "On-chain activity", value: "Live", tone: "live" },
        { label: "Wallet watchlist", value: "4 assets", tone: "flat" },
      ]
    : activeTrinityLens === "gaming"
      ? [
          { label: "Players online", value: "Live", tone: "live" },
          { label: "Open matches", value: "Find a game", tone: "flat" },
          { label: "Item markets", value: "Active", tone: "up" },
        ]
      : [];

  return (
    <>
      <style>{`
        /* ── DESKTOP STICKY RIGHT COLUMN ── */
        .trending-sidebar, .trending-mobile-fullscreen {
          --bg:#000;
          --surface:#000;
          --surface-strong:#000;
          --surface-muted:#000;
          --surface-border:#2f3336;
          --border:#2f3336;
          --text:#e7e9ea;
          --text-secondary:#71767b;
          background:#000 !important;
        }
        .trending-sidebar { border-left:1px solid #2f3336 !important; border-right:0 !important; }
        .trending-sidebar::-webkit-scrollbar       { width:3px; }
        .trending-sidebar::-webkit-scrollbar-track { background:transparent; }
        .trending-sidebar::-webkit-scrollbar-thumb { background:var(--accent-border); border-radius:2px; }
        @media(max-width:1100px){ .trending-sidebar { width:var(--trending-w); min-width:var(--trending-w); } }
        @media(max-width:768px) { .trending-sidebar:not(.trending-mobile-fullscreen){ display:none !important; } }
        .trending-mobile-fullscreen { position:fixed !important; inset:0 !important; z-index:10000 !important; background: var(--bg) !important; overflow-y:auto !important; animation:slideUp .28s cubic-bezier(.34,1.1,.64,1); }
        @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }

        /* ── MOBILE HEADER ── */
        .mob-hdr {
          position:sticky; top:0; z-index:10;
          background: var(--surface-strong);
          border-bottom:1px solid var(--surface-border);
          padding:12px 16px; display:flex; align-items:center; justify-content:space-between;
        }
        .mob-hdr-title { display:flex; align-items:center; gap:10px; font-size:calc((16px) + 1px); font-weight:800; color: var(--text); }
        .mob-hdr-title svg { color: var(--accent); }
        .mob-close {
          width:34px; height:34px; border-radius:50%;
          background: #030303;
          border:1px solid var(--surface-border);
          color: var(--text-secondary); display:flex; align-items:center; justify-content:center; cursor:pointer;
        }

        /* ── SECTIONS ── */
        .trending-sidebar .ts-section, .trending-mobile-fullscreen .ts-section { margin-bottom:12px; padding:12px; border:1px solid #2f3336 !important; border-radius:14px; background:#000 !important; }
        .ts-section:last-child { margin-bottom:0; }
        .ts-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:9px; padding-bottom:8px; border-bottom:1px solid #2f3336; position:relative; }
        .ts-header::before { content:""; position:absolute; left:0; bottom:-1px; width:32px; height:2px; background:linear-gradient(90deg,var(--ha,var(--accent)),transparent); border-radius:1px; }
        .ts-header-left { display:flex; align-items:center; gap:9px; }

        .ts-icon-pill { width:26px; height:26px; border-radius:8px; background:var(--accent-bg-soft); border:1px solid var(--accent-border); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .ts-icon-pill.red  { background:var(--danger-bg); border-color:var(--danger-border); }
        .ts-icon-pill.gold { background:var(--brand-warning-bg); border-color:var(--brand-warning-border); }

        .ts-title-block { display:flex; flex-direction:column; gap:1px; }
        .ts-title    { font-size:calc((12px) + 1px); font-weight:800; color: var(--text); letter-spacing:.35px; text-transform:uppercase; line-height:1.15; }
        .ts-subtitle { font-size:calc((10px) + 1px); color: var(--text-secondary); font-weight:500; line-height:1; margin-top:2px; }

        .ts-live-count { display:flex; align-items:center; gap:3px; padding:2px 7px; border-radius:5px; background:var(--danger-bg); border:1px solid var(--danger-border); font-size:calc((9px) + 1px); font-weight:800; color:var(--danger); }
        .ts-live-dot { width:5px; height:5px; border-radius:50%; background:var(--danger); animation:tsBlink 1.6s infinite; }
        @keyframes tsBlink { 0%,100%{opacity:1} 50%{opacity:.35} }

        .ts-refresh { width:26px; height:26px; border-radius:7px; background: var(--surface); border:1px solid var(--surface-border); color: var(--text-secondary); display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all .18s; }
        .ts-refresh:hover { background: var(--surface-strong); color: var(--accent); border-color: var(--accent-border); }
        .spin { animation:spin 1s linear infinite; }
        .ts-search-header { position:sticky; top:0; z-index:15; display:grid; grid-template-columns:minmax(0,1fr) 30px; align-items:center; gap:8px; min-height:58px; padding:10px 14px; background:var(--bg); }
        .ts-search-header .ts-search-anchor { justify-self:center; width:min(250px,100%); }
        .ts-search-header .ts-search-trigger { max-width:none; }
        .ts-section > .sh-root { margin-bottom: 10px; padding: 0 0 10px; border-bottom: 1px solid #2f3336; }
        .ts-section > .sh-root::before { display: none; }
        @keyframes spin { to{transform:rotate(360deg);} }

        /* ── STREAMER ROWS ── */
        .streamer-list { display:flex; flex-direction:column; gap:5px; }
        .streamer-row {
          display:flex; align-items:center; gap:9px; padding:8px 10px; border-radius:10px;
          background: var(--surface);
          border:1px solid var(--surface-border);
          cursor:pointer; transition:all .2s;
        }
        .streamer-row:hover { background: #080808; border-color: var(--accent-border); transform:translateX(2px); }
        .streamer-rank { width:20px; height:20px; border-radius:6px; font-size:calc((10px) + 1px); font-weight:900; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .streamer-avatar { width:30px; height:30px; border-radius:50%; flex-shrink:0; background:var(--surface-strong); display:flex; align-items:center; justify-content:center; color: var(--text); font-weight:900; font-size:calc((12px) + 1px); overflow:hidden; border:1.5px solid var(--surface-border); }
        .streamer-avatar img { width:100%; height:100%; object-fit:cover; }
        .streamer-info { flex:1; min-width:0; }
        .streamer-name { font-size:calc((12px) + 1px); font-weight:700; color: var(--text); display:flex; align-items:center; gap:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; transition:color .2s; margin-bottom:2px; }
        .streamer-row:hover .streamer-name { color: var(--text); }
        .streamer-meta { display:flex; align-items:center; gap:4px; font-size:calc((10px) + 1px); color: var(--text-secondary); white-space:nowrap; overflow:hidden; }
        .streamer-meta svg { opacity:.8; flex-shrink:0; }
        .streamer-arrow { color: var(--text-secondary); flex-shrink:0; transition:all .2s; }
        .streamer-row:hover .streamer-arrow { color: var(--accent); transform:translateX(2px); }

        /* ── LIVE NOW STRIP ── */
        .ts-live-strip { background:var(--danger-bg); border-color:var(--danger-border); }
        .sc-scroll { display:flex; flex-direction:row; gap:10px; overflow-x:auto; -webkit-overflow-scrolling:touch; scroll-snap-type:x mandatory; scrollbar-width:none; padding:2px 0 8px; }
        .sc-scroll::-webkit-scrollbar { display:none; }
        .sc-card { display:flex; flex-direction:column; align-items:center; gap:4px; flex-shrink:0; width:54px; background:transparent; border:none; cursor:pointer; padding:2px 0 0; scroll-snap-align:start; -webkit-tap-highlight-color:transparent; transition:transform .18s; }
        .sc-card:hover { transform:translateY(-2px); } .sc-card:active { transform:scale(.93); }
        .sc-card.sc-own { opacity:.45; cursor:default; pointer-events:none; }
        .sc-ring-wrap { position:relative; width:50px; height:50px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .sc-ring { position:absolute; inset:0; border-radius:50%; overflow:hidden; background: var(--surface-strong); }
        .sc-spin { position:absolute; top:50%; left:50%; width:200%; height:200%; margin:-100% 0 0 -100%; background:conic-gradient(var(--danger) 0deg, var(--danger) 40%, var(--danger) 360deg); animation:scSpin 4s linear infinite; z-index:0; }
        @keyframes scSpin { to{transform:rotate(360deg)} }
        .sc-avatar-wrap { position:absolute; inset:3px; border-radius:50%; overflow:hidden; z-index:1; }
        .sc-avatar-inner { width:100%; height:100%; border-radius:50%; background:var(--accent-gradient); display:flex; align-items:center; justify-content:center; position:relative; overflow:hidden; }
        .sc-initial { font-size:calc((13px) + 1px); font-weight:900; color: var(--text); position:absolute; z-index:0; user-select:none; line-height:1; }
        .sc-avatar-inner img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; border-radius:50%; z-index:1; transition:opacity .2s; }
        .sc-pulse { position:absolute; inset:0; border-radius:50%; border:2px solid var(--danger-border); animation:scPulse 2s ease-out infinite; pointer-events:none; z-index:0; }
        @keyframes scPulse { 0%{transform:scale(1);opacity:.6} 100%{transform:scale(1.55);opacity:0} }
        .sc-dot { position:absolute; bottom:1px; right:1px; width:10px; height:10px; border-radius:50%; background:var(--danger); border:2px solid var(--surface-border); animation:scBlink 1.4s ease-in-out infinite; z-index:2; }
        @keyframes scBlink { 0%,100%{opacity:1} 50%{opacity:.4} }
        .sc-chip { position:absolute; top:-3px; right:-5px; display:flex; align-items:center; gap:2px; padding:2px 4px; border-radius:4px; background: var(--surface-strong); border:1px solid var(--surface-border); font-size:calc((7.5px) + 1px); font-weight:800; color: var(--text-secondary); z-index:3; white-space:nowrap; }
        .sc-name { font-size:calc((10px) + 1px); font-weight:700; color: var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:54px; text-align:center; line-height:1.3; transition:color .15s; }
        .sc-card:hover .sc-name { color: var(--text); }
        .sc-cat { font-size:calc((8px) + 1px); font-weight:500; color: var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:54px; text-align:center; }

        /* ── TAG ROWS ── */
        .tag-list { display:flex; flex-direction:column; gap:5px; }
        .tag-row {
          display:flex; align-items:center; gap:9px; padding:8px 10px; border-radius:10px;
          background: #030303;
          border:1px solid var(--surface-border);
          cursor:pointer; transition:all .2s;
        }
        .tag-row:hover { background: #080808; border-color: var(--accent-border); transform:translateX(2px); }
        .tag-num { width:24px; height:24px; border-radius:7px; background: #0a0a0a; color: var(--text-secondary); font-size:calc((10px) + 1px); font-weight:800; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .tag-num.hot { background:var(--danger-bg); color:var(--danger); }
        .tag-body { flex:1; min-width:0; }
        .tag-name { font-size:calc((12px) + 1px); font-weight:700; color: var(--text); display:block; margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; transition:color .2s; }
        .tag-row:hover .tag-name { color: var(--text); }
        .tag-meta { display:flex; align-items:center; gap:5px; font-size:calc((10px) + 1px); color: var(--text-secondary); flex-wrap:wrap; }
        .tag-meta svg { opacity:.7; }
        .hot-chip { font-size:calc((9px) + 1px); font-weight:800; padding:1px 5px; background:var(--danger-bg); color:var(--danger); border-radius:4px; }
        .dot { color: var(--text-secondary); }
        .tag-drill-btn { width:26px; height:26px; border-radius:7px; flex-shrink:0; background: #030303; border:1px solid var(--surface-border); color: var(--text-secondary); display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all .18s; }
        .tag-row:hover .tag-drill-btn { background: var(--accent-bg-soft); border-color: var(--accent-border); color: var(--accent); }

        /* ── CREATOR ROWS ── */
        .creator-list { display:flex; flex-direction:column; gap:5px; }
        .creator-row {
          display:flex; align-items:center; gap:9px; padding:8px 10px; border-radius:10px;
          background: #030303;
          border:1px solid var(--surface-border);
          cursor:pointer; transition:all .2s;
        }
        .creator-row:hover { background:#080808; border-color:var(--accent-border); transform:translateY(-2px); box-shadow:0 6px 18px var(--shadow-soft); }
        .creator-row.top-tier { border-color:var(--brand-warning-border); }
        .creator-row.top-tier:hover { border-color:var(--brand-warning-border-strong); background:#080808; }
        .creator-rank { width:22px; height:22px; border-radius:6px; font-size:calc((10px) + 1px); font-weight:900; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .creator-avatar-wrap { position:relative; flex-shrink:0; }
        .creator-avatar { width:32px; height:32px; border-radius:50%; background:var(--accent-gradient); display:flex; align-items:center; justify-content:center; color:var(--accent-contrast); font-weight:900; font-size:calc((13px) + 1px); overflow:hidden; border:2px solid var(--accent-border); }
        .creator-row.top-tier .creator-avatar { border-color:var(--brand-warning-border); }
        .creator-avatar img { width:100%; height:100%; object-fit:cover; }
        .crown-pip { position:absolute; top:-5px; right:-5px; width:15px; height:15px; background:var(--brand-warning-gradient); border-radius:50%; display:flex; align-items:center; justify-content:center; border:1.5px solid var(--surface-border); }
        .creator-info { flex:1; min-width:0; }
        .creator-name { font-size:calc((12px) + 1px); font-weight:700; color: var(--text); display:flex; align-items:center; gap:5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; transition:color .2s; }
        .creator-row:hover .creator-name { color: var(--text); }
        .v-badge { width:14px; height:14px; background:var(--accent); color: var(--accent-contrast); border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .creator-meta { display:flex; align-items:center; gap:4px; font-size:calc((10px) + 1px); color: var(--text-secondary); margin-top:2px; white-space:nowrap; overflow:hidden; }
        .accent { color:var(--accent); font-weight:700; }
        .creator-arrow { color: var(--text-secondary); flex-shrink:0; transition:all .2s; }
        .creator-row:hover .creator-arrow { color:var(--accent); transform:translateX(2px); }

        /* ── VIEW MORE BUTTONS ── */
        .view-more-btn { width:100%; margin-top:7px; padding:8px 12px; background:var(--accent-bg-soft); border:1px dashed var(--accent-border); border-radius:9px; color:var(--accent); font-size:calc((11px) + 1px); font-weight:700; cursor:pointer; transition:all .22s; display:flex; align-items:center; justify-content:center; gap:6px; }
        .view-more-btn:hover { background:var(--accent-bg-strong); border-color:var(--accent); border-style:solid; transform:translateY(-1px); box-shadow:0 4px 14px var(--shadow-soft); }
        .view-more-btn.red { background:var(--danger-bg); border-color:var(--danger-border); color:var(--danger); }
        .view-more-btn.red:hover { background:var(--danger-bg); border-color:var(--danger); border-style:solid; box-shadow:0 4px 14px var(--shadow-soft); }

        /* ── EMPTY STATES ── */
        .empty-state { text-align:center; padding:20px; color: var(--text-secondary); }
        .empty-icon  { font-size:calc((28px) + 1px); margin-bottom:6px; opacity:.5; color: var(--text-secondary); }
        .empty-text  { font-size:calc((12px) + 1px); font-weight:600; color: var(--text-secondary); }

        /* ── SLIDING PANEL ── */
        .sp-overlay { position:fixed; left:0; right:0; bottom:0; background:transparent; backdrop-filter:none; z-index:9998; animation:fadeIn .22s ease; }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        .sp-panel {
          position:fixed; right:0; bottom:0; width:min(440px,92vw);
          background: var(--bg);
          border-left:1px solid var(--accent-border);
          border-top:1px solid var(--surface-border);
          z-index:9999; animation:panelSlide .28s cubic-bezier(.34,1.1,.64,1);
          display:flex; flex-direction:column; overflow:hidden; box-shadow:-14px 0 44px var(--shadow);
        }
        @keyframes panelSlide { from{transform:translateX(100%)} to{transform:translateX(0)} }
        .sp-hdr { padding:12px 14px; border-bottom:1px solid var(--surface-border); display:flex; align-items:center; justify-content:space-between; flex-shrink:0; }
        .sp-hdr-left { display:flex; align-items:center; gap:10px; }
        .sp-icon { width:28px; height:28px; border-radius:8px; border:1px solid var(--surface-border); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .sp-title    { font-size:calc((13px) + 1px); font-weight:800; color: var(--text); }
        .sp-subtitle { font-size:calc((10px) + 1px); color: var(--text-secondary); font-weight:500; margin-top:1px; }
        .sp-close { width:27px; height:27px; border-radius:8px; background: var(--surface); border:1px solid var(--surface-border); color: var(--text-secondary); cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .18s; }
        .sp-close:hover { background: var(--surface-strong); color: var(--text); transform:rotate(90deg); }
        .sp-body { flex:1; overflow-y:auto; padding:10px; display:flex; flex-direction:column; gap:5px; }
        .sp-body::-webkit-scrollbar { width:3px; }
        .sp-body::-webkit-scrollbar-thumb { background:var(--accent-border); border-radius:2px; }
        .sp-back { display:flex; align-items:center; gap:7px; padding:7px 10px; margin-bottom:4px; background: var(--surface); border:1px solid var(--surface-border); border-radius:9px; color: var(--text-secondary); font-size:calc((11px) + 1px); font-weight:700; cursor:pointer; transition:all .18s; width:100%; }
        .sp-back:hover { background: var(--surface-strong); border-color:var(--accent-border); color: var(--accent); }
        .nav-hint { display:flex; align-items:center; gap:8px; padding:8px 10px; margin-bottom:4px; background:var(--accent-bg-soft); border:1px solid var(--accent-border); border-radius:9px; font-size:calc((10.5px) + 1px); color:var(--accent); font-weight:600; }

        /* ── POST PREVIEW CARDS ── */
        .pp-card { display:flex; align-items:center; gap:10px; padding:10px; border-radius:10px; background: #030303; border:1px solid var(--surface-border); cursor:pointer; text-align:left; width:100%; transition:all .2s; animation:ppIn .22s ease both; }
        @keyframes ppIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .pp-card:hover { background: #080808; border-color: var(--accent-border); transform:translateX(3px); }
        .pp-thumb { width:48px; height:48px; border-radius:8px; overflow:hidden; flex-shrink:0; background: var(--surface-strong); position:relative; }
        .pp-thumb img { width:100%; height:100%; object-fit:cover; }
        .pp-play { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:var(--overlay-secondary); }
        .pp-body { flex:1; min-width:0; }
        .pp-author-row { display:flex; align-items:center; gap:7px; margin-bottom:4px; }
        .pp-avatar { width:20px; height:20px; border-radius:50%; background:var(--accent-bg-soft); overflow:hidden; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:calc((9px) + 1px); font-weight:800; color:var(--accent); }
        .pp-avatar img { width:100%; height:100%; object-fit:cover; }
        .pp-author-info { flex:1; min-width:0; }
        .pp-author-name   { font-size:calc((11px) + 1px); font-weight:700; color: var(--text); display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .pp-author-handle { font-size:calc((9.5px) + 1px); color: var(--text-secondary); }
        .pp-type-badge { display:flex; align-items:center; gap:3px; padding:2px 5px; background:var(--surface-strong); border-radius:5px; font-size:calc((9px) + 1px); font-weight:700; color: var(--text-secondary); flex-shrink:0; text-transform:capitalize; }
        .pp-caption { font-size:calc((11px) + 1px); color: var(--text-secondary); margin:0 0 4px; line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
        .pp-stats { display:flex; gap:10px; font-size:calc((10px) + 1px); color: var(--text-secondary); }
        .pp-stats span { display:flex; align-items:center; gap:3px; }
        .pp-arrow { color: var(--text-secondary); flex-shrink:0; transition:all .2s; }
        .pp-card:hover .pp-arrow { color:var(--accent); transform:translateX(2px); }
      `}</style>

      <aside className={isMobile ? "trending-mobile-fullscreen" : "trending-sidebar"}>
        {isMobile && <MobileHeader onClose={onClose} />}

        {/* Desktop sticky top label */}
        {!isMobile && renderDesktopSearchHeader()}

        {/* Inner content wrapper */}
        <div style={{ padding: "14px 14px 24px" }}>

          {/* ── TOP STREAMERS ── */}
          <div className="ts-section" style={{ "--ha": "var(--danger)" }}>
            <SectionHeader
              icon={Tv}
              iconColor="var(--danger)"
              iconBg="var(--danger-bg)"
              iconBorder="var(--danger-border)"
              title="Top Streamers"
              right={isMobile ? (
                <button className="ts-refresh" onClick={() => { setRefreshing(true); loadAll(false); }} disabled={refreshing}>
                  <RefreshCw size={12} className={refreshing ? "spin" : ""} />
                </button>
              ) : null}
            />
            {topStreamers.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📡</div>
                <p className="empty-text">No streamers yet — be the first to go live!</p>
              </div>
            ) : (
              <>
                <div className="streamer-list">
                  {topStreamers.slice(0, STREAMERS_PREVIEW).map((s) => (
                    <StreamerRow key={s.userId} streamer={s} onClick={handleStreamerClick} />
                  ))}
                </div>
                {topStreamers.length > STREAMERS_PREVIEW && (
                  <button className="view-more-btn red" onClick={() => setStreamersPanel(true)}>
                    View All {topStreamers.length} Streamers <ArrowRight size={13} />
                  </button>
                )}
              </>
            )}
          </div>

          {/* ── LIVE NOW — always rendered when sessions exist, loading handled gracefully ── */}
          {liveSessions.length > 0 && (
            <div className="ts-section ts-live-strip" style={{ "--ha": "var(--danger)" }}>
              <SectionHeader
                icon={Radio}
                iconColor="var(--danger)"
                iconBg="var(--danger-bg)"
                iconBorder="var(--danger-border)"
                title="Live Now"
                right={<div className="ts-live-count"><span className="ts-live-dot" />{liveSessions.length}</div>}
              />
              <div className="sc-scroll">
                {liveSessions.map((s) => <StreamerCircle key={s.id} session={s} onJoin={handleJoin} isOwn={s.profiles?.id === currentUser?.id} />)}
              </div>
            </div>
          )}

          {/* ── TRENDING TAGS ── */}
          <div className="ts-section">
            <SectionHeader
              icon={Flame}
              iconColor="var(--accent)"
              iconBg="var(--accent-bg-soft)"
              iconBorder="var(--accent-border)"
              title="Trending"
              right={isMobile ? (
                <button className="ts-refresh" onClick={() => { setRefreshing(true); loadAll(false); }} disabled={refreshing}>
                  <RefreshCw size={12} className={refreshing ? "spin" : ""} />
                </button>
              ) : null}
            />
            {topTags.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">🔥</div><p className="empty-text">No trending tags yet</p></div>
            ) : (
              <>
                <div className="tag-list">{topTags.map((tag, i) => <TagRow key={tag.label} tag={tag} index={i} />)}</div>
                {trendingTags.length > 3 && (
                  <button className="view-more-btn" onClick={() => setTagsPanel(true)}>View Top 30 Tags <ArrowRight size={13} /></button>
                )}
              </>
            )}
          </div>

          {modeSignals.length > 0 && (
            <div className="ts-section">
              <SectionHeader
                icon={activeTrinityLens === "web3" ? BarChart2 : Gamepad2}
                iconColor="var(--accent)"
                iconBg="var(--accent-bg-soft)"
                iconBorder="var(--accent-border)"
                title={activeTrinityLens === "web3" ? "Signals" : "Gaming Pulse"}
              />
              <div className="tag-list">
                {modeSignals.map((signal) => (
                  <div className="tag-row" key={signal.label}>
                    <div className={`tag-num${signal.tone === "up" ? " hot" : ""}`}>•</div>
                    <div className="tag-body"><span className="tag-name">{signal.label}</span><span className="tag-meta">{signal.value}</span></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TOP CREATORS ── */}
          <div className="ts-section">
            <SectionHeader
              icon={Crown}
              iconColor="var(--brand-warning)"
              iconBg="var(--brand-warning-bg)"
              iconBorder="var(--brand-warning-border)"
              title="Top Creators"
            />
            {topCreators.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">👑</div><p className="empty-text">No creators this week</p></div>
            ) : (
              <>
                <div className="creator-list">{topCreators.map((c) => <CreatorRow key={c.userId} creator={c} />)}</div>
                {eliteCreators.length > 0 && (
                  <button className="view-more-btn" onClick={() => setCreatorsPanel(true)}>View Top 30 Creators <ArrowRight size={13} /></button>
                )}
              </>
            )}
          </div>

        </div>{/* end inner content */}
      </aside>

      {/* ══ Streamers panel ══ */}
      {streamersPanel && (
        <SlidingPanel isMobile={isMobile} onClose={() => setStreamersPanel(false)}
          title="Top Streamers"
          icon={Tv} iconColor="var(--danger)" iconBg="var(--danger-bg)" iconBorder="var(--danger-border)">
          <div className="streamer-list">
            {topStreamers.map((s) => (
              <StreamerRow key={s.userId} streamer={s} onClick={(str) => { setStreamersPanel(false); handleStreamerClick(str); }} />
            ))}
          </div>
        </SlidingPanel>
      )}

      {/* ══ Tags panel ══ */}
      {tagsPanel && (
        <SlidingPanel isMobile={isMobile} onClose={() => setTagsPanel(false)}
          title="Trending Tags" icon={Flame}
          iconColor="var(--accent)" iconBg="var(--accent-bg-soft)" iconBorder="var(--accent-border)">
          <div className="tag-list">{trendingTags.map((tag, i) => <TagRow key={tag.label} tag={tag} index={i} />)}</div>
        </SlidingPanel>
      )}

      {/* ══ Creators panel ══ */}
      {creatorsPanel && (
        <SlidingPanel isMobile={isMobile} onClose={() => setCreatorsPanel(false)}
          title="Top Creators"
          icon={Crown} iconColor="var(--brand-warning)" iconBg="var(--brand-warning-bg)" iconBorder="var(--brand-warning-border)">
          <div className="creator-list">{eliteCreators.map((c) => <CreatorRow key={c.userId} creator={c} />)}</div>
        </SlidingPanel>
      )}

      {/* ══ Tag posts panel ══ */}
      {tagPostsPanel && activeTag && (
        <SlidingPanel isMobile={isMobile} onClose={() => { setTagPostsPanel(false); setActiveTag(null); setTagPosts([]); }}
          title={activeTag.label} subtitle={`${activeTag.posts} posts · ${fmt(activeTag.views)} views`}
          icon={Hash} iconColor="var(--accent)" iconBg="var(--accent-bg-soft)" iconBorder="var(--accent-border)">
          <button className="sp-back" onClick={() => { setTagPostsPanel(false); setTagsPanel(true); }}>
            <ArrowLeft size={12} /> Back to all tags
          </button>
          <div className="nav-hint"><Zap size={13} />Tap any post to open it in your feed</div>
          {tagPostsLoading
            ? <UnifiedLoader type="section" message={`Loading ${activeTag.label} posts…`} />
            : tagPosts.length > 0
              ? tagPosts.map((post) => <PostPreviewCard key={`${post.contentType}-${post.id}`} post={post} onNavigate={handlePostNavigate} />)
              : <div className="empty-state"><div className="empty-icon">📭</div><p className="empty-text">No posts found for {activeTag.label}</p></div>}
        </SlidingPanel>
      )}

      {/* ══ Creator modal ══ */}
      {creatorModal && selectedCreator && (
        <UserProfileModal user={selectedCreator} currentUser={currentUser}
          onClose={() => { setCreatorModal(false); setSelectedCreator(null); }} />
      )}

      {/* ══ Streamer detail modal ══ */}
      {streamerDetail && ReactDOM.createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 10050 }}>
          <StreamerDetailModal
            streamer={streamerDetail}
            onClose={() => setStreamerDetail(null)}
          />
        </div>,
        document.body
      )}
    </>
  );
};

export default TrendingSidebar;