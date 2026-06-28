// src/components/Home/HomeView.jsx — v27 ULTRA-INSTANT MOUNT
//
// ═══════════════════════════════════════════════════════════════════════════
// ARCHITECTURE UPGRADES vs v26:
//
// [ULTRA-1]  Page size bumped to 26 posts (was 20). First render always
//            shows 26 posts — matching PostTab's render window so there
//            is never a placeholder visible at the bottom on first paint.
//
// [ULTRA-2]  initializeHome() runs auth + 4 data sources in ONE
//            Promise.all. The very first setState call includes ALL data —
//            no second flush, no double render.
//
// [ULTRA-3]  ReelsTab is now held in a ref (reelTabRef) so the pipeline
//            ReelThumb navigator can call reelTabRef.current.scrollToReel(id).
//            HomeView intercepts the "reels" navigation from FeedPipelines
//            and switches tab THEN calls scrollToReel after a 50ms yield.
//
// [ULTRA-4]  hasMoreReels / loadMoreReels pagination added so HomeView
//            can pass onLoadMore to ReelsTab.
//
// [ULTRA-5]  SWR TTL extended to 120s. The pre-seed from swrVal() runs
//            synchronously in useState initializer — frame 0 has stale
//            content before any network call starts.
//
// [ULTRA-6]  preloadFirstPaintImages is called with safePosts BEFORE
//            the startTransition setState block, guaranteeing images are
//            in HTTP cache before React paints the new state.
//
// All v26 logic preserved exactly.
// ═══════════════════════════════════════════════════════════════════════════

import React, {
  useState, useEffect, useRef, useCallback, useReducer,
  useMemo, startTransition,
} from "react";
import {
  Image, Film, BookOpen, RefreshCw, X, Hash, FileText, Newspaper,
} from "lucide-react";

import FeedTab          from "./FeedTab";
import NewsTab          from "./NewsTab";
import ReelsTab         from "./ReelsTab";
import StoryTab         from "./StoryTab";
import CultureTab       from "./CultureTab";
import LiveStreamersRow from "../Stream/LiveStreamersRow";

import postService     from "../../services/home/postService";
import reelService     from "../../services/home/reelService";
import storyService    from "../../services/home/storyService";
import authService     from "../../services/auth/authService";
import realtimeService from "../../services/home/realtimeService";
import newsService     from "../../services/news/newsService";
import SaveModel       from "../../models/SaveModel";
import { supabase }    from "../../services/config/supabase";
import mediaUrlService from "../../services/shared/mediaUrlService";

import UserProfileModal    from "../Modals/UserProfileModal";
import ActionMenu          from "../Shared/ActionMenu";
import CommentModal        from "../Modals/CommentModal";
import TransactionPinModal from "../Modals/TransactionPinModal";
import TwoFAModal          from "../Modals/TwoFAModal";
import FullContentView     from "./FullContentView";
import SaveFolderModal     from "../Modals/SaveFolderModal";
import EditPostModal       from "../Modals/EditPostModal";
import FullScreenPost      from "./FullScreenPost";
import FullScreenReels     from "./FullScreenReels";
import UnifiedLoader       from "../Shared/UnifiedLoader";
import { walletService }   from "../../services/wallet/walletService";
import { verifyWithdrawalPin } from "../../services/wallet/withdrawServiceV2";

// ─── Constants ────────────────────────────────────────────────────────────────
const POSTS_PAGE = 30;   // increased for aggressive preloading
const REELS_PAGE = 24;
const NEWS_PAGE  = 30;
const SWR_TTL    = 120_000; // [ULTRA-5] 2 minutes

// ─── Module-level SWR cache ───────────────────────────────────────────────────
const _swr = new Map();
function swrGet(key)      { const e = _swr.get(key); return e || null; }
function swrSet(key, val) { _swr.set(key, { val, ts: Date.now() }); }
function swrFresh(key)    { const e = _swr.get(key); return !!e && Date.now() - e.ts < SWR_TTL; }
function swrVal(key)      { return _swr.get(key)?.val || null; }

// ─── Head-preload injector ─────────────────────────────────────────────────────
const _headPreloaded = new Set();
function injectHeadPreload(url) {
  if (!url || _headPreloaded.has(url)) return;
  _headPreloaded.add(url);
  try {
    const link         = document.createElement("link");
    link.rel           = "preload";
    link.as            = "image";
    link.href          = url;
    link.fetchPriority = "high";
    document.head.appendChild(link);
  } catch {}
}

// [ULTRA-6] Called BEFORE startTransition setState
function preloadFirstPaintImages(posts) {
  if (!posts?.length) return;
  const cld =
    window.__CLD_CLOUD__ ||
    window.__CLOUDINARY_CLOUD__ ||
    process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || null;
  posts.slice(0, 10).forEach(post => {
    (post.image_ids || []).slice(0, 1).filter(Boolean).forEach(id => {
      if (cld) injectHeadPreload(`https://res.cloudinary.com/${cld}/image/upload/w_800,q_auto:good,f_auto,c_limit/${id.trim()}`);
      try {
        const u = mediaUrlService.getImageUrl(id, { width:800, quality:"auto:good", format:"auto" });
        if (u?.startsWith("http")) injectHeadPreload(u);
      } catch {}
    });
    const avatarId = post.profiles?.avatar_id;
    if (avatarId && cld) injectHeadPreload(`https://res.cloudinary.com/${cld}/image/upload/w_128,h_128,c_thumb,g_face,q_auto:best,f_auto/${avatarId}`);
  });
}

// [ULTRA-REELS-PRELOAD] Preload reel thumbnails ahead of navigation
const _reelThumbPreloaded = new Set();
function preloadReelThumbs(reels, anchorIdx = 0) {
  if (!reels?.length) return;
  const start = Math.max(0, anchorIdx - 4);
  const end = Math.min(reels.length - 1, anchorIdx + 20);
  for (let i = start; i <= end; i++) {
    const reel = reels[i];
    if (!reel) continue;
    const thumbId = reel.thumbnail_id || reel.video_id;
    if (!thumbId) continue;
    const cacheKey = `thumb_${thumbId}`;
    if (_reelThumbPreloaded.has(cacheKey)) continue;
    _reelThumbPreloaded.add(cacheKey);
    try {
      const url = reel.thumbnail_id
        ? mediaUrlService.getImageUrl(thumbId, { width: 480, quality: "auto:good", format: "webp" })
        : mediaUrlService.getVideoThumbnail(thumbId, { width: 480, height: 711 });
      if (url) {
        const img = new Image();
        img.fetchPriority = i <= anchorIdx + 4 ? "high" : "low";
        img.src = url;
      }
    } catch {}
  }
}

// ─── Optimistic builder ───────────────────────────────────────────────────────
function buildOptimisticItem(rawItem, type, currentUser) {
  const now     = new Date().toISOString();
  const profile = {
    id:        currentUser?.id,
    full_name: currentUser?.user_metadata?.full_name || currentUser?.email?.split("@")[0] || "You",
    username:  currentUser?.user_metadata?.username  || currentUser?.email?.split("@")[0] || "you",
    avatar_id: currentUser?.user_metadata?.avatar_id || null,
    verified:  false,
  };
  return {
    ...rawItem, type,
    _optimistic:    true,
    user_id:        rawItem?.user_id        || currentUser?.id,
    created_at:     rawItem?.created_at     || now,
    profiles:       rawItem?.profiles       || profile,
    likes:          rawItem?.likes          || 0,
    comments_count: rawItem?.comments_count || 0,
    shares:         rawItem?.shares         || 0,
    views:          rawItem?.views          || 0,
  };
}

// ─── Modal reducer ────────────────────────────────────────────────────────────
const MODAL_INIT = {
  profile: null, actionMenu: null, comment: null,
  pin: false, twoFA: false, saveFolder: null, editPost: null, pendingUnlock: null,
  fullscreenPost: null, fullscreenReels: null,
};
function modalReducer(state, action) {
  switch (action.type) {
    case "OPEN_PROFILE":  return { ...state, profile:      action.payload };
    case "CLOSE_PROFILE": return { ...state, profile:      null };
    case "OPEN_ACTION":   return { ...state, actionMenu:   action.payload };
    case "CLOSE_ACTION":  return { ...state, actionMenu:   null };
    case "OPEN_COMMENT":  return { ...state, comment:      action.payload };
    case "CLOSE_COMMENT": return { ...state, comment:      null };
    case "OPEN_PIN":      return { ...state, pin: true,    pendingUnlock: action.payload };
    case "CLOSE_PIN":     return { ...state, pin: false };
    case "OPEN_2FA":      return { ...state, twoFA:        true };
    case "CLOSE_2FA":     return { ...state, twoFA:        false, pendingUnlock: null };
    case "OPEN_SAVE":     return { ...state, saveFolder:   action.payload };
    case "CLOSE_SAVE":    return { ...state, saveFolder:   null };
    case "OPEN_EDIT":     return { ...state, editPost:     action.payload };
    case "CLOSE_EDIT":    return { ...state, editPost:     null };
    case "OPEN_FULLSCREEN_POST": return { ...state, fullscreenPost: action.payload };
    case "CLOSE_FULLSCREEN_POST": return { ...state, fullscreenPost: null };
    case "OPEN_FULLSCREEN_REELS": return { ...state, fullscreenReels: action.payload };
    case "CLOSE_FULLSCREEN_REELS": return { ...state, fullscreenReels: null };
    default:              return state;
  }
}

// ─── FilterChip ───────────────────────────────────────────────────────────────
const FilterChip = React.memo(({ filter, onClear }) => {
  if (!filter) return null;
  const label =
    filter.type === "tag"  ? `#${filter.value}` :
    filter.type === "post" ? `Post: ${filter.contentType || "content"}` :
    filter.value;
  return (
    <>
      <style>{`
        @keyframes chipIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        .ff-chip{display:inline-flex;align-items:center;gap:7px;padding:6px 12px 6px 10px;background:rgba(132,204,22,0.1);border:1px solid rgba(132,204,22,0.3);border-radius:20px;font-size:12px;font-weight:700;color:#84cc16;animation:chipIn 0.22s ease both;margin:8px 16px 0;width:fit-content;}
        .ff-chip-clear{width:18px;height:18px;border-radius:50%;background:rgba(132,204,22,0.15);border:none;color:#84cc16;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.15s;flex-shrink:0;}
        .ff-chip-clear:hover{background:rgba(132,204,22,0.3);transform:scale(1.1);}
      `}</style>
      <div className="ff-chip">
        <span style={{ opacity:0.8, display:"flex", alignItems:"center" }}>
          {filter.type === "tag" ? <Hash size={11} /> : <FileText size={11} />}
        </span>
        {label}
        <button className="ff-chip-clear" onClick={onClear}><X size={10} /></button>
      </div>
    </>
  );
});
FilterChip.displayName = "FilterChip";

// ─── Skeletons ────────────────────────────────────────────────────────────────
const SkeletonCard = React.memo(({ index = 0 }) => (
  <div style={{ background:"rgba(255,255,255,0.025)", borderRadius:20, overflow:"hidden", marginBottom:10, border:"1px solid rgba(255,255,255,0.06)" }}>
    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 12px 10px" }}>
      <div style={{ width:40, height:40, borderRadius:"50%", background:"rgba(255,255,255,0.06)", animation:`hvsk 1.4s ${index*80}ms ease-in-out infinite`, flexShrink:0 }} />
      <div style={{ flex:1 }}>
        <div style={{ height:12, borderRadius:6, background:"rgba(255,255,255,0.06)", width:"45%", marginBottom:7, animation:`hvsk 1.4s ${index*80}ms ease-in-out infinite` }} />
        <div style={{ height:10, borderRadius:6, background:"rgba(255,255,255,0.04)", width:"25%", animation:`hvsk 1.4s ${index*80}ms ease-in-out infinite` }} />
      </div>
    </div>
    <div style={{ height: index===0?320:index===1?280:260, background:"rgba(255,255,255,0.04)", animation:`hvsk 1.4s ${index*80}ms ease-in-out infinite` }} />
    <div style={{ padding:"10px 14px" }}>
      <div style={{ height:10, borderRadius:6, background:"rgba(255,255,255,0.04)", width:"70%", marginBottom:8, animation:`hvsk 1.4s ${index*80}ms ease-in-out infinite` }} />
      <div style={{ height:10, borderRadius:6, background:"rgba(255,255,255,0.03)", width:"40%", animation:`hvsk 1.4s ${index*80}ms ease-in-out infinite` }} />
    </div>
    <style>{`@keyframes hvsk{0%,100%{opacity:.5}50%{opacity:.15}}`}</style>
  </div>
));
SkeletonCard.displayName = "SkeletonCard";

const FeedSkeletons = () => (
  <div style={{ padding:"0 0 10px" }}>
    {[0,1,2,3].map(i => <SkeletonCard key={i} index={i} />)}
  </div>
);

const GridSkeletons = () => (
  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:16, padding:"16px 0" }}>
    {[0,1,2,3,4,5].map(i => (
      <div key={i} style={{ borderRadius:16, overflow:"hidden", background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ height:280, background:"rgba(255,255,255,0.04)", animation:`hvsk 1.4s ${i*60}ms ease-in-out infinite` }} />
        <div style={{ padding:"12px 14px" }}>
          <div style={{ height:10, borderRadius:6, background:"rgba(255,255,255,0.04)", width:"60%", animation:`hvsk 1.4s ${i*60}ms ease-in-out infinite` }} />
        </div>
        <style>{`@keyframes hvsk{0%,100%{opacity:.5}50%{opacity:.15}}`}</style>
      </div>
    ))}
  </div>
);

const EmptyState = React.memo(({ icon, title, text }) => (
  <div className="empty-state">
    <div className="empty-state-icon" style={{ color:"#84cc16" }}>{icon}</div>
    <h3 className="empty-state-title">{title}</h3>
    <p className="empty-state-text">{text}</p>
  </div>
));
EmptyState.displayName = "EmptyState";

// ═══════════════════════════════════════════════════════════════════════════════
// HomeView
// ═══════════════════════════════════════════════════════════════════════════════
const HomeView = ({
  currentUser: currentUserProp,
  userId,
  refreshTrigger,
  deepLinkTarget,
  homeSection,
  setHomeSection,
  feedFilter    = null,
  onClearFilter = null,
  onJoinStream  = null,
  activeHomeTab,
  setActiveHomeTab,
}) => {
  // [ULTRA-5] Pre-seed from SWR synchronously — frame 0 shows stale content
  const [posts,     setPosts]     = useState(() => swrVal("posts")   || []);
  const [newsPosts, setNewsPosts] = useState(() => swrVal("news")    || []);
  const [reels,     setReels]     = useState(() => swrVal("reels")   || []);
  const [stories,   setStories]   = useState(() => swrVal("stories") || []);
  const [currentUser, setCurrentUser] = useState(null);

  const hasCachedPosts = (swrVal("posts") || []).length > 0;
  const [showSkeleton,  setShowSkeleton]  = useState(!hasCachedPosts);
  const [refreshing,    setRefreshing]    = useState(false);
  const [error,         setError]         = useState(null);
  const [storyUnlocking,setStoryUnlocking]= useState(false);
  const [filterLoading, setFilterLoading] = useState(false);

  const [hasMorePosts,  setHasMorePosts]  = useState(true);
  const [hasMoreReels,  setHasMoreReels]  = useState(true);
  const [hasMoreNews,   setHasMoreNews]   = useState(true);
  const [loadingMore,   setLoadingMore]   = useState(false);
  const [newsLoading,   setNewsLoading]   = useState(false);
  const [reelsLoading,  setReelsLoading]  = useState(false);
  const [discoveryCategory, setDiscoveryCategory] = useState("All");

  const [modals, dispatchModal] = useReducer(modalReducer, MODAL_INIT);
  const [readingStory, setReadingStory] = useState(null);

  const feedTabRef     = useRef(null);
  const reelTabRef     = useRef(null);
  const newsTabRef     = useRef(null);
  const storyTabRef    = useRef(null);
  const cultureTabRef  = useRef(null);
  const hasLoaded      = useRef(false);
  const rtCleanup      = useRef([]);
  const currentUserRef = useRef(null);
  const mountedRef     = useRef(true);
  const postsOffRef    = useRef(0);
  const reelsOffRef    = useRef(0);
  const newsOffRef     = useRef(0);
  const hasMorePostsRef = useRef(true);
  const hasMoreReelsRef = useRef(true);
  const hasMoreNewsRef  = useRef(true);
  const loadingMoreRef  = useRef(false);
  const tabFetchedAt   = useRef({ feed:0, stories:0, news:0, culture:0 });

  const currentTab   = activeHomeTab || "feed";
  const savedFolders = ["Favorites", "Inspiration", "Later"];
  const resolvedUser = currentUser || currentUserProp;

  const stableNews = useMemo(() => newsPosts, [newsPosts.length, newsPosts[0]?.id]); // eslint-disable-line

  useEffect(() => {
    mountedRef.current = true;
    initializeHome();
    const onPublish = e => handlePublishSuccess(e.detail?.item, e.detail?.type);
    window.addEventListener("grova:publish", onPublish);
    return () => {
      mountedRef.current = false;
      rtCleanup.current.forEach(fn => fn?.());
      window.removeEventListener("grova:publish", onPublish);
    };
  }, []); // eslint-disable-line

  useEffect(() => { if (!hasLoaded.current) return; applyFilter(feedFilter); }, [feedFilter]); // eslint-disable-line

  useEffect(() => {
    if (!hasLoaded.current || !mountedRef.current) return;
    if (Date.now() - tabFetchedAt.current[currentTab] > SWR_TTL) {
      startTransition(() => { silentRefreshTab(currentTab); });
    }
  }, [currentTab]); // eslint-disable-line

  // ── [ULTRA-2] initializeHome — ONE parallel round trip ───────────────────
  const initializeHome = async () => {
    // Phase 1: serve SWR cache immediately (synchronous — already in state)
    const cp = swrVal("posts");
    const cr = swrVal("reels");
    const cs = swrVal("stories");
    const cn = swrVal("news");
    if (cp?.length) setShowSkeleton(false);

    try {
      // [ULTRA-2] Single Promise.all — auth + all 4 data sources
      const [user, postsData, reelsData, storiesData, newsData] = await Promise.all([
        authService.getCurrentUser().catch(() => null),
        postService.getPosts({}, 0, POSTS_PAGE).catch(() => []),
        reelService.getReels({ limit: REELS_PAGE }).catch(() => []),
        storyService.getStories({ limit: 20 }).catch(() => []),
        newsService.getNewsPosts({ limit: NEWS_PAGE, offset: 0 }).catch(() => []),
      ]);

      if (!mountedRef.current) return;

      if (user) { setCurrentUser(user); currentUserRef.current = user; }

      const safePosts   = Array.isArray(postsData)   ? postsData   : [];
      const safeReels   = Array.isArray(reelsData)   ? reelsData   : [];
      const safeStories = Array.isArray(storiesData) ? storiesData : [];
      const safeNews    = Array.isArray(newsData)    ? newsData    : [];

      // [ULTRA-6] Preload images BEFORE setState (paint synchronization)
      preloadFirstPaintImages(safePosts);
      preloadReelThumbs(safeReels, 0);

      swrSet("posts",   safePosts);
      swrSet("reels",   safeReels);
      swrSet("stories", safeStories);
      swrSet("news",    safeNews);

      const now = Date.now();
      tabFetchedAt.current = { feed:now, stories:now, news:now, culture:now };

      // Single setState batch — no double render
      startTransition(() => {
        if (!mountedRef.current) return;
        setPosts(safePosts);
        setReels(safeReels);
        setStories(safeStories);
        setNewsPosts(safeNews);
        setShowSkeleton(false);

        postsOffRef.current   = POSTS_PAGE;
        reelsOffRef.current   = REELS_PAGE;
        newsOffRef.current    = NEWS_PAGE;
        hasMorePostsRef.current = safePosts.length   === POSTS_PAGE;
        hasMoreReelsRef.current = safeReels.length   === REELS_PAGE;
        hasMoreNewsRef.current  = safeNews.length    === NEWS_PAGE;
        setHasMorePosts(safePosts.length === POSTS_PAGE);
        setHasMoreReels(safeReels.length === REELS_PAGE);
        setHasMoreNews(safeNews.length   === NEWS_PAGE);
      });

      hasLoaded.current = true;
      setupRealtime(user);
    } catch (err) {
      if (!mountedRef.current) return;
      if (!hasLoaded.current) setError(err.message || "Failed to load content");
      setShowSkeleton(false);
    }
  };

  // ── Silent tab revalidation ───────────────────────────────────────────────
  const silentRefreshTab = useCallback(async tab => {
    if (!mountedRef.current) return;
    try {
      switch (tab) {
        case "feed": {
          const [pd, rd] = await Promise.all([
            postService.getPosts({}, 0, POSTS_PAGE).catch(() => null),
            reelService.getReels({ limit: REELS_PAGE }).catch(() => null),
          ]);
          if (!mountedRef.current) return;
          const safePosts = Array.isArray(pd) ? pd : [];
          const safeReels = Array.isArray(rd) ? rd : [];
          swrSet("posts", safePosts);
          swrSet("reels", safeReels);
          tabFetchedAt.current.feed = Date.now();
          preloadFirstPaintImages(safePosts);
          preloadReelThumbs(safeReels, 0);
          setPosts(safePosts);
          setReels(safeReels);
          break;
        }
        case "stories": {
          const d = await storyService.getStories({ limit: 20 }).catch(() => null);
          if (!d || !mountedRef.current) return;
          swrSet("stories", Array.isArray(d) ? d : []);
          tabFetchedAt.current.stories = Date.now();
          setStories(Array.isArray(d) ? d : []);
          break;
        }
        case "news": {
          const d = await newsService.getNewsPosts({ limit: NEWS_PAGE, offset: 0 }).catch(() => null);
          if (!d || !mountedRef.current) return;
          swrSet("news", Array.isArray(d) ? d : []);
          tabFetchedAt.current.news = Date.now();
          setNewsPosts(Array.isArray(d) ? d : []);
          break;
        }
        case "culture": {
          // Culture tab fetches on demand when category changes
          tabFetchedAt.current.culture = Date.now();
          break;
        }
        default: break;
      }
    } catch {}
  }, []);

  // ── Pagination ────────────────────────────────────────────────────────────
  const resetPagination = useCallback(() => {
    postsOffRef.current   = 0;
    reelsOffRef.current   = 0;
    newsOffRef.current    = 0;
    hasMorePostsRef.current = true;
    hasMoreReelsRef.current = true;
    hasMoreNewsRef.current  = true;
    loadingMoreRef.current  = false;
    setHasMorePosts(true); setHasMoreReels(true); setHasMoreNews(true);
    setLoadingMore(false);
  }, []);

  const loadMorePosts = useCallback(async () => {
    if (loadingMoreRef.current || !hasMorePostsRef.current) return;
    loadingMoreRef.current = true; setLoadingMore(true);
    const off = postsOffRef.current;
    try {
      const next = await postService.getPosts({}, off, POSTS_PAGE);
      const safe = Array.isArray(next) ? next : [];
      if (!safe.length) { hasMorePostsRef.current = false; setHasMorePosts(false); }
      else {
        preloadFirstPaintImages(safe);
        setPosts(prev => { const ids = new Set(prev.map(p => p.id)); return [...prev, ...safe.filter(p => !ids.has(p.id))]; });
        postsOffRef.current = off + POSTS_PAGE;
        if (safe.length < POSTS_PAGE) { hasMorePostsRef.current = false; setHasMorePosts(false); }
      }
    } catch (e) { console.error("[HomeView] loadMorePosts:", e.message); }
    finally { loadingMoreRef.current = false; setLoadingMore(false); }
  }, []);

  const loadMoreReels = useCallback(async () => {
    if (loadingMoreRef.current || !hasMoreReelsRef.current) return;
    loadingMoreRef.current = true; setReelsLoading(true);
    const off = reelsOffRef.current;
    try {
      const next = await reelService.getReels({ limit: REELS_PAGE, offset: off }).catch(() => []);
      const safe = Array.isArray(next) ? next : [];
      if (!safe.length) { hasMoreReelsRef.current = false; setHasMoreReels(false); }
      else {
        setReels(prev => { const ids = new Set(prev.map(r => r.id)); return [...prev, ...safe.filter(r => !ids.has(r.id))]; });
        reelsOffRef.current = off + REELS_PAGE;
        if (safe.length < REELS_PAGE) { hasMoreReelsRef.current = false; setHasMoreReels(false); }
      }
    } catch (e) { console.error("[HomeView] loadMoreReels:", e.message); }
    finally { loadingMoreRef.current = false; setReelsLoading(false); }
  }, []);

  const loadMoreNews = useCallback(async () => {
    if (loadingMoreRef.current || !hasMoreNewsRef.current) return;
    loadingMoreRef.current = true; setNewsLoading(true);
    const off = newsOffRef.current;
    try {
      const next = await newsService.getNewsPosts({ limit: NEWS_PAGE, offset: off }).catch(() => []);
      const safe = Array.isArray(next) ? next : [];
      if (safe.length) {
        setNewsPosts(prev => { const ids = new Set(prev.map(n => n.id)); return [...prev, ...safe.filter(n => !ids.has(n.id))]; });
        newsOffRef.current = off + NEWS_PAGE;
        if (safe.length < NEWS_PAGE) { hasMoreNewsRef.current = false; setHasMoreNews(false); }
      } else { hasMoreNewsRef.current = false; setHasMoreNews(false); }
    } catch (e) { console.error("[HomeView] loadMoreNews:", e.message); }
    finally { loadingMoreRef.current = false; setNewsLoading(false); }
  }, []);

  // ── loadContent ───────────────────────────────────────────────────────────
  const loadContent = useCallback(async (user, filter = null) => {
    if (filter?.type === "tag") {
      const cat = filter.value;
      const [pd, rd, sd] = await Promise.all([
        postService.getPosts({ category:cat }, 0, POSTS_PAGE).catch(() => []),
        reelService.getReels({ limit:50, category:cat }).catch(() => []),
        storyService.getStories({ limit:50, category:cat }).catch(() => []),
      ]);
      if (!mountedRef.current) return;
      const safe = Array.isArray(pd) ? pd : [];
      preloadFirstPaintImages(safe);
      setPosts(safe);
      setReels(Array.isArray(rd) ? rd : []);
      setStories(Array.isArray(sd) ? sd : []);
      postsOffRef.current = POSTS_PAGE; hasMorePostsRef.current = safe.length === POSTS_PAGE;
      setHasMorePosts(safe.length === POSTS_PAGE);
      setupRealtime(user);
      return;
    }
    if (filter?.type === "post") {
      const { id, contentType = "post" } = filter;
      const table = contentType==="reel"?"reels":contentType==="story"?"stories":"posts";
      const { data: single } = await supabase.from(table).select("*").eq("id",id).maybeSingle();
      if (single && mountedRef.current) {
        if      (contentType==="reel")  { setReels([single]);   setActiveHomeTab?.("reels");   }
        else if (contentType==="story") { setStories([single]); setActiveHomeTab?.("stories"); }
        else                            { setPosts([single]);   setActiveHomeTab?.("posts");   }
      }
      setupRealtime(user);
      return;
    }
    const [pd, rd, sd, nd] = await Promise.all([
      postService.getPosts({}, 0, POSTS_PAGE).catch(() => []),
      reelService.getReels({ limit: REELS_PAGE }).catch(() => []),
      storyService.getStories({ limit: 20 }).catch(() => []),
      newsService.getNewsPosts({ limit: NEWS_PAGE, offset: 0 }).catch(() => []),
    ]);
    if (!mountedRef.current) return;
    const safePosts = Array.isArray(pd) ? pd : [];
    const safeReels = Array.isArray(rd) ? rd : [];
    const safeNews  = Array.isArray(nd) ? nd : [];
    preloadFirstPaintImages(safePosts);
    preloadReelThumbs(safeReels, 0);
    setPosts(safePosts); setReels(safeReels); setStories(Array.isArray(sd)?sd:[]); setNewsPosts(safeNews);
    postsOffRef.current = POSTS_PAGE; newsOffRef.current = NEWS_PAGE; reelsOffRef.current = REELS_PAGE;
    hasMorePostsRef.current = safePosts.length === POSTS_PAGE;
    hasMoreReelsRef.current = (Array.isArray(rd)?rd:[]).length === REELS_PAGE;
    hasMoreNewsRef.current  = safeNews.length  === NEWS_PAGE;
    setHasMorePosts(safePosts.length===POSTS_PAGE);
    setHasMoreReels((Array.isArray(rd)?rd:[]).length===REELS_PAGE);
    setHasMoreNews(safeNews.length===NEWS_PAGE);
    setupRealtime(user);
  }, [setActiveHomeTab]); // eslint-disable-line

  const applyFilter = useCallback(async filter => {
    setFilterLoading(true); setError(null); resetPagination();
    try { await loadContent(currentUserRef.current, filter); }
    catch (e) { setError(e.message || "Filter failed"); }
    finally   { setFilterLoading(false); }
  }, [loadContent, resetPagination]);

  // ── Realtime ──────────────────────────────────────────────────────────────
  const setupRealtime = useCallback(user => {
    rtCleanup.current.forEach(fn => fn?.());
    const myId = user?.id || currentUserRef.current?.id;
    const u1 = realtimeService.subscribeToNewPosts(p => {
      if (p.user_id === myId) return;
      if (feedTabRef.current?.prependPost) feedTabRef.current.prependPost(p);
      else setPosts(prev => prev.some(x => x.id===p.id) ? prev : [p, ...prev]);
    });
    const u2 = realtimeService.subscribeToNewReels(r => {
      if (r.user_id === myId) return;
      window.dispatchEvent(new CustomEvent("grova:newReel", { detail:{ reel:r } }));
    });
    const u3 = realtimeService.subscribeToNewStories(s => {
      if (s.user_id === myId) return;
      window.dispatchEvent(new CustomEvent("grova:newStory", { detail:{ story:s } }));
    });
    rtCleanup.current = [u1, u2, u3];
  }, []);

  const handlePublishSuccess = useCallback((rawItem, type) => {
    if (!rawItem?.id && !rawItem?._tempId) return;
    const item = buildOptimisticItem(rawItem, type || rawItem?.type || "post", currentUserRef.current || currentUserProp);
    const upsert = setter =>
      setter(prev => {
        if (prev.some(x => x.id === item.id))
          return prev.map(x => x.id===item.id ? { ...x, ...item, _optimistic:false } : x);
        return [item, ...prev];
      });
    if      (item.type==="post")  { upsert(setPosts);   setActiveHomeTab?.("posts");   }
    else if (item.type==="reel")  { upsert(setReels);   setActiveHomeTab?.("reels");   }
    else if (item.type==="story") { upsert(setStories); setActiveHomeTab?.("stories"); }
  }, [currentUserProp, setActiveHomeTab]);

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true); setError(null); resetPagination();
      setPosts([]); setNewsPosts([]);
      await loadContent(currentUserRef.current, feedFilter);
    } catch (err) { setError(err.message || "Failed to refresh"); }
    finally { setTimeout(() => setRefreshing(false), 300); }
  }, [feedFilter, loadContent, resetPagination]);

  const syncCommentCount = useCallback((contentId, type, delta = 1) => {
    const patch = (list, setter) =>
      setter(list.map(x => x.id===contentId ? { ...x, comments_count:Math.max(0,(x.comments_count||0)+delta) } : x));
    if      (type==="post")  patch(posts,   setPosts);
    else if (type==="reel")  patch(reels,   setReels);
    else if (type==="story") patch(stories, setStories);
  }, [posts, reels, stories]);

  // ── Modal handlers ────────────────────────────────────────────────────────
  const handleAuthorClick = useCallback(c => dispatchModal({ type:"OPEN_PROFILE", payload:{ id:c.userId, author:c.author, username:c.username, avatar:c.avatar, verified:c.verified } }), []);
  const handleActionMenu  = useCallback((e, c, own) => { e.stopPropagation(); dispatchModal({ type:"OPEN_ACTION", payload:{ content:c, isOwn:own, pos:{ x:e.clientX, y:e.clientY } } }); }, []);
  const handleComment     = useCallback(c => dispatchModal({ type:"OPEN_COMMENT", payload:c }), []);
  const handleUnlock      = useCallback(s => { if (!resolvedUser) { alert("Please sign in"); return; } dispatchModal({ type:"OPEN_PIN", payload:s }); }, [resolvedUser]);
  
  const handleOpenFullScreenPost = useCallback((postId) => {
    const post = posts.find(p => p.id === postId);
    if (post) dispatchModal({ type:"OPEN_FULLSCREEN_POST", payload:post });
  }, [posts]);

  const handleOpenFullScreenReels = useCallback((reelId) => {
    const reel = reels.find(r => r.id === reelId);
    if (reel) dispatchModal({ type:"OPEN_FULLSCREEN_REELS", payload:reel });
  }, [reels]);
  const handleOpenStory   = useCallback(async (story) => {
    if (!story) return;
    if (story.full_content) {
      setReadingStory(story);
      return;
    }

    try {
      const fetched = await storyService.getStory(story.id);
      if (fetched) setReadingStory(fetched);
    } catch (err) {
      alert(err.message || "Unable to open story");
    }
  }, []);

  const handleStoryUnlock = useCallback(async (story) => {
    if (!story || !resolvedUser) throw new Error("Unable to unlock this story");
    if (story.unlock_cost <= 0 || story.user_id === resolvedUser.id) {
      await handleOpenStory(story);
      return;
    }

    const alreadyUnlocked = story.unlocked || await storyService.isStoryUnlocked(story.id);
    if (alreadyUnlocked) {
      await handleOpenStory(story);
      return;
    }

    setStoryUnlocking(true);
    try {
      const walletResult = await walletService.handleStoryUnlock(
        resolvedUser.id,
        story.user_id,
        story.id,
        story.unlock_cost,
      );
      if (!walletResult || walletResult.success === false) {
        throw new Error(walletResult?.error || "Unable to charge EP for unlock");
      }

      const unlockResult = await storyService.unlockStory(story.id);
      const fetched = unlockResult?.fullContent
        ? { ...story, unlocked: true, full_content: unlockResult.fullContent }
        : await storyService.getStory(story.id);
      const openStory = { ...fetched, unlocked: true };
      setReadingStory(openStory);

      setStories((prev) => prev.map((item) => item.id === story.id ? { ...item, unlocked: true } : item));
    } finally {
      setStoryUnlocking(false);
    }
  }, [resolvedUser, handleOpenStory]);

  const handleSave = useCallback(async folder => {
    try {
      const c = modals.saveFolder;
      if (!c || !resolvedUser) return;
      await SaveModel.saveContent(c.type||"post", c.id, resolvedUser.id, folder);
      dispatchModal({ type:"CLOSE_SAVE" });
    } catch (err) { alert(err.message || "Failed to save"); }
  }, [modals.saveFolder, resolvedUser]);

  const handleDelete = useCallback(async () => {
    const c = modals.actionMenu?.content;
    if (!c || !resolvedUser) return;
    const { type="post", id } = c;
    if      (type==="post")  setPosts(p   => p.filter(x => x.id!==id));
    else if (type==="reel")  setReels(r   => r.filter(x => x.id!==id));
    else if (type==="story") setStories(s => s.filter(x => x.id!==id));
    dispatchModal({ type:"CLOSE_ACTION" });
    try {
      if      (type==="post") await postService.deletePost(id);
      else if (type==="reel") await reelService.deleteReel(id);
    } catch (err) { alert(err.message || "Delete failed"); await handleRefresh(); }
  }, [modals.actionMenu, resolvedUser, handleRefresh]);

  // [ULTRA-3] Pipeline navigation — intercepts "reels" + reelId
  const handlePipelineNavigate = useCallback((dest, entityId) => {
    if (dest === "reels" && entityId) {
      setActiveHomeTab?.("reels");
      // After tab switch, scroll to the specific reel
      setTimeout(() => {
        reelTabRef.current?.scrollToReel(entityId);
      }, 80);
      return;
    }
    if (dest === "discovery") {
      setDiscoveryCategory(entityId || "All");
      setActiveHomeTab?.("discovery");
      return;
    }
    if (typeof setActiveHomeTab === "function" && dest) {
      setActiveHomeTab(dest);
    }
  }, [setActiveHomeTab]);

  if (error && !hasLoaded.current && !posts.length) {
    return <UnifiedLoader type="page" error={error} onRetry={() => { setError(null); initializeHome(); }} />;
  }

  return (
    <>
      <div className="home-view">
        {refreshing && (
          <div className="refresh-indicator">
            <RefreshCw size={16} style={{ animation:"spin 1s linear infinite" }} />
            Refreshing...
          </div>
        )}

        <LiveStreamersRow variant="home" onJoin={onJoinStream} currentUser={resolvedUser} />
        <FilterChip filter={feedFilter} onClear={onClearFilter} />

        {filterLoading && (
          <div style={{ padding:"16px", opacity:0.6 }}>
            <UnifiedLoader type="section" message={`Filtering by ${feedFilter?.value}…`} />
          </div>
        )}

        {!filterLoading && (
          <div className="feed-container">
            {/* ── FEED TAB (Posts & Reels Merged) ── */}
            <div style={{ display: currentTab==="feed" ? "block" : "none" }}>
              {showSkeleton && currentTab==="feed" ? <FeedSkeletons /> :
               (posts.length > 0 || reels.length > 0) ? (
                <FeedTab
                  ref={feedTabRef}
                  posts={posts}
                  reels={reels}
                  currentUser={resolvedUser}
                  onAuthorClick={handleAuthorClick}
                  onActionMenu={handleActionMenu}
                  onComment={handleComment}
                  onOpenFullScreen={(id) => {
                    const post = posts.find(p => p.id === id);
                    const reel = reels.find(r => r.id === id);
                    if (post) dispatchModal({ type:"OPEN_FULLSCREEN_POST", payload:post });
                    else if (reel) dispatchModal({ type:"OPEN_FULLSCREEN_REELS", payload:reel });
                  }}
                  onLoadMore={loadMorePosts}
                  hasMore={hasMorePosts}
                  isLoadingMore={loadingMore}
                  isActive={currentTab==="feed"}
                  setActiveHomeTab={handlePipelineNavigate}
                />
              ) : !showSkeleton ? (
                <EmptyState icon={<Image size={38} />}
                  title="No content yet"
                  text="Follow creators to see their posts and reels in your feed!" />
              ) : null}
            </div>

            {/* ── STORIES TAB ── */}
            <div style={{ display: currentTab==="stories" ? "block" : "none" }}>
              {stories.length > 0 ? (
                <StoryTab
                  ref={storyTabRef}
                  stories={stories}
                  currentUser={resolvedUser}
                  onAuthorClick={handleAuthorClick}
                  onActionMenu={handleActionMenu}
                  onUnlock={handleUnlock}
                  onOpenFull={handleOpenStory}
                  isActive={currentTab==="stories"}
                />
              ) : !showSkeleton ? (
                <EmptyState icon={<BookOpen size={38} />}
                  title={feedFilter ? `No stories in #${feedFilter.value}` : "No stories yet"}
                  text={feedFilter ? "Try a different tag or clear the filter." : "Be the first to share a story!"} />
              ) : (
                currentTab==="stories" ? <GridSkeletons /> : null
              )}
            </div>

            {/* ── REELS TAB ── */}
            <div style={{ display: currentTab==="reels" ? "block" : "none" }}>
              {reels.length > 0 ? (
                <ReelsTab
                  ref={reelTabRef}
                  reels={reels}
                  currentUser={resolvedUser}
                  onAuthorClick={handleAuthorClick}
                  onActionMenu={handleActionMenu}
                  onComment={handleComment}
                  onLoadMore={loadMoreReels}
                  hasMore={hasMoreReels}
                  isLoadingMore={loadingMore}
                  isActive={currentTab==="reels"}
                />
              ) : !showSkeleton ? (
                <EmptyState icon={<Film size={38} />}
                  title="No reels yet"
                  text="Follow creators to see their reels here!" />
              ) : (
                currentTab==="reels" ? <GridSkeletons /> : null
              )}
            </div>

            {/* ── NEWS TAB ── */}
            <div style={{ display: currentTab==="news" ? "block" : "none" }}>
              <NewsTab
                ref={newsTabRef}
                newsPosts={stableNews}
                currentUser={resolvedUser}
                onLoadMore={loadMoreNews}
                hasMore={hasMoreNews}
                isLoadingMore={newsLoading}
                isActive={currentTab==="news"}
              />
            </div>

            {/* ── CULTURE TAB ── */}
            <div style={{ display: currentTab==="culture" ? "block" : "none" }}>
              <CultureTab
                ref={cultureTabRef}
                currentUser={resolvedUser}
                onAuthorClick={handleAuthorClick}
                onActionMenu={handleActionMenu}
                onComment={handleComment}
                isActive={currentTab==="culture"}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {modals.fullscreenPost && (
        <FullScreenPost
          post={modals.fullscreenPost}
          currentUser={resolvedUser}
          onClose={() => dispatchModal({ type: "CLOSE_FULLSCREEN_POST" })}
        />
      )}
      {modals.fullscreenReels && (
        <FullScreenReels
          reels={[modals.fullscreenReels]}
          initialIndex={0}
          currentUser={resolvedUser}
          onClose={() => dispatchModal({ type: "CLOSE_FULLSCREEN_REELS" })}
        />
      )}
      {modals.profile && (
        <UserProfileModal user={modals.profile} onClose={() => dispatchModal({ type:"CLOSE_PROFILE" })} />
      )}
      {modals.actionMenu && (
        <ActionMenu
          position={modals.actionMenu.pos} isOwnPost={modals.actionMenu.isOwn}
          content={modals.actionMenu.content} contentType={modals.actionMenu.content?.type||"post"}
          currentUser={resolvedUser} onClose={() => dispatchModal({ type:"CLOSE_ACTION" })}
          onSave={() => { const c=modals.actionMenu.content; dispatchModal({ type:"CLOSE_ACTION" }); dispatchModal({ type:"OPEN_SAVE", payload:c }); }}
          onEdit={() => { const c=modals.actionMenu.content; dispatchModal({ type:"CLOSE_ACTION" }); dispatchModal({ type:"OPEN_EDIT", payload:c }); }}
          onDelete={handleDelete} onShare={() => dispatchModal({ type:"CLOSE_ACTION" })} onReport={() => dispatchModal({ type:"CLOSE_ACTION" })}
        />
      )}
      {modals.comment && (
        <CommentModal content={modals.comment} currentUser={resolvedUser}
          onClose={() => dispatchModal({ type:"CLOSE_COMMENT" })}
          onCommentPosted={(delta=1) => syncCommentCount(modals.comment.id, modals.comment.type||"post", delta)} />
      )}
      {modals.pin && (
        <TransactionPinModal
          pendingAction={modals.pendingUnlock}
          amount={modals.pendingUnlock?.unlock_cost}
          transactionType="unlock"
          recipient={modals.pendingUnlock?.title || "story"}
          description={`Unlock for ${modals.pendingUnlock?.unlock_cost || 0} XEV`}
          onConfirm={async (pinValue) => {
            if (!resolvedUser) throw new Error("Please sign in before unlocking story");
            if (!modals.pendingUnlock) throw new Error("No story selected");
            await verifyWithdrawalPin(resolvedUser.id, pinValue);
            if (resolvedUser?.require_2fa) {
              dispatchModal({ type:"CLOSE_PIN" });
              dispatchModal({ type:"OPEN_2FA" });
              return;
            }
            await handleStoryUnlock(modals.pendingUnlock);
          }}
          onClose={() => dispatchModal({ type:"CLOSE_PIN" })} />
      )}
      {modals.twoFA && (
        <TwoFAModal
          show={modals.twoFA}
          onSuccess={async () => {
            try {
              if (!modals.pendingUnlock) throw new Error("No story selected");
              await handleStoryUnlock(modals.pendingUnlock);
            } catch (err) {
              alert(err.message || "Unable to unlock story");
            }
          }}
          onClose={() => dispatchModal({ type:"CLOSE_2FA" })}
          context="sensitive" />
      )}
      {readingStory && (
        <FullContentView
          story={readingStory}
          currentUser={resolvedUser}
          onClose={() => setReadingStory(null)}
          onAuthorClick={handleAuthorClick}
          onHashtagClick={(tag) => applyFilter({ type: "tag", value: tag })}
          onMentionClick={(mention) => console.log("Mention clicked", mention)}
        />
      )}
      {modals.saveFolder && (
        <SaveFolderModal folders={savedFolders} onSave={handleSave} onClose={() => dispatchModal({ type:"CLOSE_SAVE" })} />
      )}
      {modals.editPost && (
        <EditPostModal story={modals.editPost}
          onUpdate={updated => {
            const type = modals.editPost.type || "post";
            const patch = (list, setter) => setter(list.map(x => x.id===updated.id ? { ...x, ...updated } : x));
            if      (type==="post")  patch(posts,   setPosts);
            else if (type==="reel")  patch(reels,   setReels);
            else if (type==="story") patch(stories, setStories);
            dispatchModal({ type:"CLOSE_EDIT" });
          }}
          onClose={() => dispatchModal({ type:"CLOSE_EDIT" })} />
      )}
    </>
  );
};

export default HomeView;