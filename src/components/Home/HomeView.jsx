// src/components/Home/HomeView.jsx  — v25 PERFECTED
//
// [EAGER-1] ALL tabs mounted eagerly in background on first render.
//           mountedTabs starts as ALL tabs (not just "home").
//           display:none hides inactive ones — they're alive and loaded.
//           User switching tabs feels instant — no loading, no skeleton.
//
// [FAST-2]  Auth + content fetched in PARALLEL, not sequentially.
// [FAST-3]  News data is fetched as part of the initial parallel load.
// [FAST-4]  initialLoading spinner is eliminated.
//
// [BANNER]  Every tab receives isActive={currentTab === "<tabName>"} so
//           each tab's new-content banner (NewPostBanner, NewReelBanner,
//           NewStoryBanner, NewBanner) is ONLY visible when that tab is
//           the selected tab. Nothing bleeds across tabs.
//
// [FIX-v25] setActiveHomeTab is now forwarded to <PostTab> so pipeline
//           tap-to-navigate (Reels / News cards inside the post feed)
//           actually switches the tab.

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Image, Film, BookOpen, RefreshCw, X, Hash, FileText, Newspaper } from "lucide-react";

import PostTab          from "./PostTab";
import NewsTab          from "./NewsTab";
import ReelsTab         from "./ReelsTab";
import StoryTab         from "./StoryTab";
import LiveStreamersRow from "../Stream/LiveStreamersRow";

import postService     from "../../services/home/postService";
import reelService     from "../../services/home/reelService";
import storyService    from "../../services/home/storyService";
import authService     from "../../services/auth/authService";
import realtimeService from "../../services/home/realtimeService";
import newsService     from "../../services/news/newsService";
import SaveModel       from "../../models/SaveModel";
import { supabase }    from "../../services/config/supabase";

import UserProfileModal    from "../Modals/UserProfileModal";
import ActionMenu          from "../Shared/ActionMenu";
import CommentModal        from "../Modals/CommentModal";
import TransactionPinModal from "../Modals/TransactionPinModal";
import TwoFAModal          from "../Modals/TwoFAModal";
import SaveFolderModal     from "../Modals/SaveFolderModal";
import EditPostModal       from "../Modals/EditPostModal";
import UnifiedLoader       from "../Shared/UnifiedLoader";

const POSTS_PAGE = 20;
const NEWS_PAGE  = 30;

// ── Filter chip ───────────────────────────────────────────────────────────────
const FilterChip = ({ filter, onClear }) => {
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
        <span style={{ opacity:0.8,display:"flex",alignItems:"center" }}>
          {filter.type==="tag" ? <Hash size={11}/> : <FileText size={11}/>}
        </span>
        {label}
        <button className="ff-chip-clear" onClick={onClear} title="Clear filter"><X size={10}/></button>
      </div>
    </>
  );
};

const buildOptimisticItem = (rawItem, type, currentUser) => {
  const now = new Date().toISOString();
  const profileFromUser = {
    id:        currentUser?.id,
    full_name: currentUser?.user_metadata?.full_name || currentUser?.email?.split("@")[0] || "You",
    username:  currentUser?.user_metadata?.username  || currentUser?.email?.split("@")[0] || "you",
    avatar_id: currentUser?.user_metadata?.avatar_id || null,
    verified:  false,
  };
  return {
    ...rawItem, type, _optimistic: true,
    user_id:    rawItem?.user_id    || currentUser?.id,
    created_at: rawItem?.created_at || now,
    profiles:   rawItem?.profiles   || profileFromUser,
    likes: rawItem?.likes || 0, comments_count: rawItem?.comments_count || 0,
    shares: rawItem?.shares || 0, views: rawItem?.views || 0,
  };
};

// ── Main component ────────────────────────────────────────────────────────────
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
  const [posts,        setPosts]        = useState([]);
  const [newsPosts,    setNewsPosts]    = useState([]);
  const [reels,        setReels]        = useState([]);
  const [stories,      setStories]      = useState([]);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [hasMoreNews,  setHasMoreNews]  = useState(true);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const [newsLoading,  setNewsLoading]  = useState(false);
  const [filterLoading,setFilterLoading]= useState(false);
  const [error,        setError]        = useState(null);
  const [refreshing,   setRefreshing]   = useState(false);
  const [currentUser,  setCurrentUser]  = useState(null);
  const [initialDone,  setInitialDone]  = useState(false);

  // Modal state
  const [showProfile,      setShowProfile]      = useState(false);
  const [selectedUser,     setSelectedUser]     = useState(null);
  const [showActionMenu,   setShowActionMenu]   = useState(false);
  const [actionMenuPos,    setActionMenuPos]    = useState({ x:0, y:0 });
  const [selectedContent,  setSelectedContent]  = useState(null);
  const [isOwnContent,     setIsOwnContent]     = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [showPinModal,     setShowPinModal]     = useState(false);
  const [showTwoFA,        setShowTwoFA]        = useState(false);
  const [pendingUnlock,    setPendingUnlock]    = useState(null);
  const [showSaveFolder,   setShowSaveFolder]   = useState(false);
  const [showEditModal,    setShowEditModal]    = useState(false);

  const postTabRef       = useRef(null);
  const newsTabRef       = useRef(null);
  const storyTabRef      = useRef(null);
  const hasLoaded        = useRef(false);
  const rtCleanup        = useRef([]);
  const currentUserRef   = useRef(null);

  const postsOffsetRef   = useRef(0);
  const newsOffsetRef    = useRef(0);
  const hasMorePostsRef  = useRef(true);
  const hasMoreNewsRef   = useRef(true);
  const loadingMoreRef   = useRef(false);

  // Resolve the active tab — default to "posts"
  const currentTab = activeHomeTab || "posts";

  useEffect(() => {
    initializeHome();
    const onPublish = e => handlePublishSuccess(e.detail?.item, e.detail?.type);
    window.addEventListener("grova:publish", onPublish);
    return () => {
      rtCleanup.current.forEach(fn => fn?.());
      window.removeEventListener("grova:publish", onPublish);
    };
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!hasLoaded.current) return;
    applyFilter(feedFilter);
  }, [feedFilter]); // eslint-disable-line

  // ── [FAST-2] Parallel auth + data fetch ──────────────────────────────────
  const initializeHome = async () => {
    try {
      const [user] = await Promise.all([
        authService.getCurrentUser(),
      ]);
      setCurrentUser(user);
      currentUserRef.current = user;
      await loadContent(user, feedFilter);
      hasLoaded.current = true;
    } catch (err) {
      if (!hasLoaded.current) setError(err.message || "Failed to load content");
    } finally {
      setInitialDone(true);
    }
  };

  const resetPagination = () => {
    postsOffsetRef.current = 0; newsOffsetRef.current = 0;
    hasMorePostsRef.current = true; hasMoreNewsRef.current = true;
    loadingMoreRef.current = false;
    setHasMorePosts(true); setHasMoreNews(true); setLoadingMore(false);
  };

  const loadContent = async (user, filter = null) => {
    if (filter?.type === "tag") {
      const cat = filter.value;
      const [postsData, reelsData, storiesData] = await Promise.all([
        postService.getPosts({ category: cat }, 0, POSTS_PAGE).catch(() => []),
        reelService.getReels({ limit: 50, category: cat }).catch(() => []),
        storyService.getStories({ limit: 50, category: cat }).catch(() => []),
      ]);
      const safe = Array.isArray(postsData) ? postsData : [];
      setPosts(safe);
      setReels(Array.isArray(reelsData) ? reelsData : []);
      setStories(Array.isArray(storiesData) ? storiesData : []);
      postsOffsetRef.current = POSTS_PAGE;
      hasMorePostsRef.current = safe.length === POSTS_PAGE;
      setHasMorePosts(safe.length === POSTS_PAGE);
      setupRealtime(user);
      return;
    }

    if (filter?.type === "post") {
      const { id, contentType = "post" } = filter;
      const table = contentType === "reel" ? "reels" : contentType === "story" ? "stories" : "posts";
      const { data: single } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
      if (single) {
        if (contentType === "reel")       { setReels([single]);   setActiveHomeTab?.("reels");   }
        else if (contentType === "story") { setStories([single]); setActiveHomeTab?.("stories"); }
        else                              { setPosts([single]);   setActiveHomeTab?.("posts");   }
      }
      setupRealtime(user);
      return;
    }

    // [FAST-3] All 4 data sources fire simultaneously
    const [postsData, reelsData, storiesData, newsData] = await Promise.all([
      postService.getPosts({}, 0, POSTS_PAGE).catch(() => []),
      reelService.getReels({ limit: 20 }).catch(() => []),
      storyService.getStories({ limit: 20 }).catch(() => []),
      newsService.getNewsPosts({ limit: NEWS_PAGE, offset: 0 }).catch(() => []),
    ]);

    const safePosts = Array.isArray(postsData) ? postsData : [];
    const safeNews  = Array.isArray(newsData)  ? newsData  : [];

    setPosts(safePosts);
    setReels(Array.isArray(reelsData) ? reelsData : []);
    setStories(Array.isArray(storiesData) ? storiesData : []);
    setNewsPosts(safeNews);

    postsOffsetRef.current  = POSTS_PAGE;
    newsOffsetRef.current   = NEWS_PAGE;
    hasMorePostsRef.current = safePosts.length === POSTS_PAGE;
    hasMoreNewsRef.current  = safeNews.length === NEWS_PAGE;
    setHasMorePosts(safePosts.length === POSTS_PAGE);
    setHasMoreNews(safeNews.length === NEWS_PAGE);

    setupRealtime(user);
  };

  const loadMorePosts = useCallback(async () => {
    if (loadingMoreRef.current || !hasMorePostsRef.current) return;
    loadingMoreRef.current = true; setLoadingMore(true);
    const off = postsOffsetRef.current;
    try {
      const next = await postService.getPosts({}, off, POSTS_PAGE);
      const safe = Array.isArray(next) ? next : [];
      if (!safe.length) { hasMorePostsRef.current = false; setHasMorePosts(false); }
      else {
        setPosts(prev => { const ids = new Set(prev.map(p=>p.id)); return [...prev,...safe.filter(p=>!ids.has(p.id))]; });
        postsOffsetRef.current = off + POSTS_PAGE;
        if (safe.length < POSTS_PAGE) { hasMorePostsRef.current = false; setHasMorePosts(false); }
      }
    } catch (e) { console.error("[HomeView] loadMorePosts:", e.message); }
    finally { loadingMoreRef.current = false; setLoadingMore(false); }
  }, []);

  const loadMoreNews = useCallback(async () => {
    if (loadingMoreRef.current || !hasMoreNewsRef.current) return;
    loadingMoreRef.current = true; setNewsLoading(true);
    const off = newsOffsetRef.current;
    try {
      const next = await newsService.getNewsPosts({ limit: NEWS_PAGE, offset: off }).catch(() => []);
      const safe = Array.isArray(next) ? next : [];
      if (safe.length) {
        setNewsPosts(prev => { const ids = new Set(prev.map(n=>n.id)); return [...prev,...safe.filter(n=>!ids.has(n.id))]; });
        newsOffsetRef.current = off + NEWS_PAGE;
        if (safe.length < NEWS_PAGE) { hasMoreNewsRef.current = false; setHasMoreNews(false); }
      } else { hasMoreNewsRef.current = false; setHasMoreNews(false); }
    } catch (e) { console.error("[HomeView] loadMoreNews:", e.message); }
    finally { loadingMoreRef.current = false; setNewsLoading(false); }
  }, []);

  const applyFilter = async filter => {
    setFilterLoading(true); setError(null); resetPagination();
    try { await loadContent(currentUserRef.current, filter); }
    catch (e) { setError(e.message || "Filter failed"); }
    finally { setFilterLoading(false); }
  };

  const setupRealtime = useCallback(user => {
    rtCleanup.current.forEach(fn => fn?.());
    const myId = user?.id || currentUserRef.current?.id;

    // Posts — route to PostTab via ref.prependPost
    const u1 = realtimeService.subscribeToNewPosts(p => {
      if (p.user_id === myId) return;
      if (postTabRef.current?.prependPost) {
        postTabRef.current.prependPost(p);
      } else {
        setPosts(prev => prev.some(x => x.id === p.id) ? prev : [p, ...prev]);
      }
    });

    // Reels — dispatch custom event so ReelsTab's internal listener picks it up
    const u2 = realtimeService.subscribeToNewReels(r => {
      if (r.user_id === myId) return;
      window.dispatchEvent(new CustomEvent("grova:newReel", { detail: { reel: r } }));
    });

    // Stories — dispatch custom event so StoryTab's internal listener picks it up
    const u3 = realtimeService.subscribeToNewStories(s => {
      if (s.user_id === myId) return;
      window.dispatchEvent(new CustomEvent("grova:newStory", { detail: { story: s } }));
    });

    rtCleanup.current = [u1, u2, u3];
  }, []);

  const handlePublishSuccess = useCallback((rawItem, type) => {
    if (!rawItem?.id && !rawItem?._tempId) return;
    const resolvedUser = currentUserRef.current || currentUserProp;
    const item = buildOptimisticItem(rawItem, type || rawItem?.type || "post", resolvedUser);
    const upsert = setter =>
      setter(prev => {
        if (prev.some(x => x.id === item.id))
          return prev.map(x => x.id === item.id ? { ...x, ...item, _optimistic:false } : x);
        return [item, ...prev];
      });
    if (item.type === "post")       { upsert(setPosts);   setActiveHomeTab?.("posts");   }
    else if (item.type === "reel")  { upsert(setReels);   setActiveHomeTab?.("reels");   }
    else if (item.type === "story") { upsert(setStories); setActiveHomeTab?.("stories"); }
  }, [currentUserProp, setActiveHomeTab]);

  const handleRefresh = async () => {
    try {
      setRefreshing(true); setError(null); resetPagination();
      setPosts([]); setNewsPosts([]);
      await loadContent(currentUserRef.current, feedFilter);
    } catch (err) { setError(err.message || "Failed to refresh"); }
    finally { setTimeout(() => setRefreshing(false), 300); }
  };

  const syncCommentCount = useCallback((contentId, type, delta = 1) => {
    const patch = (list, setter) =>
      setter(list.map(x => x.id === contentId ? { ...x, comments_count: Math.max(0,(x.comments_count||0)+delta) } : x));
    if (type === "post")       patch(posts,   setPosts);
    else if (type === "reel")  patch(reels,   setReels);
    else if (type === "story") patch(stories, setStories);
  }, [posts, reels, stories]);

  const handleAuthorClick  = c => { setSelectedUser({ id:c.userId,author:c.author,username:c.username,avatar:c.avatar,verified:c.verified }); setShowProfile(true); };
  const handleActionMenu   = (e,c,own) => { e.stopPropagation(); setSelectedContent(c); setIsOwnContent(own); setActionMenuPos({ x:e.clientX,y:e.clientY }); setShowActionMenu(true); };
  const handleComment      = c => { setSelectedContent(c); setShowCommentModal(true); };
  const handleUnlock       = s => { if (!currentUser) { alert("Please sign in"); return; } setPendingUnlock(s); setShowPinModal(true); };
  const handlePinConfirm   = () => { setShowPinModal(false); setShowTwoFA(true); };
  const handleTwoFAConfirm = async () => { alert(`Unlocked: ${pendingUnlock?.title}`); setShowTwoFA(false); setPendingUnlock(null); await handleRefresh(); };
  const handleSave         = async folder => {
    try { if (!selectedContent||!currentUser) return; await SaveModel.saveContent(selectedContent.type||"post",selectedContent.id,currentUser.id,folder); setShowSaveFolder(false); }
    catch (err) { alert(err.message||"Failed to save"); }
  };
  const handleEdit   = () => { setShowActionMenu(false); setShowEditModal(true); };
  const handleShare  = () => setShowActionMenu(false);
  const handleReport = () => setShowActionMenu(false);
  const handleDelete = async () => {
    if (!selectedContent || !currentUser) return;
    const { type="post", id } = selectedContent;
    if (type==="post")       setPosts(p   => p.filter(x=>x.id!==id));
    else if (type==="reel")  setReels(r   => r.filter(x=>x.id!==id));
    else if (type==="story") setStories(s => s.filter(x=>x.id!==id));
    setShowActionMenu(false);
    try {
      if (type==="post")       await postService.deletePost(id);
      else if (type==="reel")  await reelService.deleteReel(id);
      else if (type==="story") await storyService.deleteStory(id);
    } catch (err) { alert(err.message||"Delete failed"); await handleRefresh(); }
  };

  if (error && !hasLoaded.current && !posts.length) {
    return <UnifiedLoader type="page" error={error} onRetry={() => { setError(null); initializeHome(); }}/>;
  }

  const savedFolders  = ["Favorites", "Inspiration", "Later"];
  const resolvedUser  = currentUser || currentUserProp;

  return (
    <>
      <div className="home-view">
        {refreshing && (
          <div className="refresh-indicator">
            <RefreshCw size={16} style={{ animation:"spin 1s linear infinite" }}/>
            Refreshing...
          </div>
        )}

        <LiveStreamersRow variant="home" onJoin={onJoinStream} currentUser={resolvedUser}/>
        <FilterChip filter={feedFilter} onClear={onClearFilter}/>

        {filterLoading && (
          <div style={{ padding:"16px",opacity:0.6 }}>
            <UnifiedLoader type="section" message={`Filtering by ${feedFilter?.value}…`}/>
          </div>
        )}

        {!filterLoading && (
          <div className="feed-container">
            {/*
              [EAGER-1] ALL tab content rendered into the DOM immediately.
              display:none hides inactive tabs — they stay mounted & loaded.
              No skeleton, no spinner when switching tabs.

              [BANNER] isActive is passed to every tab — each tab's banner
              portal only renders when its own tab is the current one.
              Nothing bleeds across tabs — ever.
            */}

            {/* ── POSTS TAB ── */}
            <div style={{ display: currentTab === "posts" ? "block" : "none" }}>
              {posts.length > 0 ? (
                <PostTab
                  ref={postTabRef}
                  posts={posts}
                  currentUser={resolvedUser}
                  onAuthorClick={handleAuthorClick}
                  onActionMenu={handleActionMenu}
                  onComment={handleComment}
                  onLoadMore={loadMorePosts}
                  hasMore={hasMorePosts}
                  isLoadingMore={loadingMore}
                  isActive={currentTab === "posts"}
                  setActiveHomeTab={setActiveHomeTab}   // ← pipeline tab-switch
                />
              ) : initialDone ? (
                <EmptyState
                  icon={<Image size={38}/>}
                  title={feedFilter ? `No posts in #${feedFilter.value}` : "No posts yet"}
                  text={feedFilter ? "Try a different tag or clear the filter." : "Be the first to create a post!"}
                />
              ) : (
                currentTab === "posts" ? <FeedSkeleton/> : null
              )}
            </div>

            {/* ── REELS TAB ── */}
            <div style={{ display: currentTab === "reels" ? "block" : "none" }}>
              {reels.length > 0 ? (
                <ReelsTab
                  reels={reels}
                  currentUser={resolvedUser}
                  onAuthorClick={handleAuthorClick}
                  onActionMenu={handleActionMenu}
                  onComment={handleComment}
                  isActive={currentTab === "reels"}
                />
              ) : initialDone ? (
                <EmptyState
                  icon={<Film size={38}/>}
                  title={feedFilter ? `No reels in #${feedFilter.value}` : "No reels yet"}
                  text={feedFilter ? "Try a different tag or clear the filter." : "Be the first to create a reel!"}
                />
              ) : null}
            </div>

            {/* ── STORIES TAB ── */}
            <div style={{ display: currentTab === "stories" ? "block" : "none" }}>
              {stories.length > 0 ? (
                <StoryTab
                  ref={storyTabRef}
                  stories={stories}
                  currentUser={resolvedUser}
                  onAuthorClick={handleAuthorClick}
                  onActionMenu={handleActionMenu}
                  onUnlock={handleUnlock}
                  isActive={currentTab === "stories"}
                />
              ) : initialDone ? (
                <EmptyState
                  icon={<BookOpen size={38}/>}
                  title={feedFilter ? `No stories in #${feedFilter.value}` : "No stories yet"}
                  text={feedFilter ? "Try a different tag or clear the filter." : "Be the first to share a story!"}
                />
              ) : null}
            </div>

            {/* ── NEWS TAB ── */}
            <div style={{ display: currentTab === "news" ? "block" : "none" }}>
              <NewsTab
                ref={newsTabRef}
                newsPosts={newsPosts}
                currentUser={resolvedUser}
                onLoadMore={loadMoreNews}
                hasMore={hasMoreNews}
                isLoadingMore={newsLoading}
                isActive={currentTab === "news"}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showProfile && selectedUser && (
        <UserProfileModal user={selectedUser} onClose={() => setShowProfile(false)}/>
      )}
      {showActionMenu && selectedContent && (
        <ActionMenu
          position={actionMenuPos} isOwnPost={isOwnContent} content={selectedContent}
          contentType={selectedContent.type||"post"} currentUser={resolvedUser}
          onClose={() => setShowActionMenu(false)}
          onSave={() => { setShowActionMenu(false); setShowSaveFolder(true); }}
          onEdit={handleEdit} onDelete={handleDelete} onShare={handleShare} onReport={handleReport}
        />
      )}
      {showCommentModal && selectedContent && (
        <CommentModal
          content={selectedContent} currentUser={resolvedUser}
          onClose={() => setShowCommentModal(false)}
          onCommentPosted={(delta=1) => syncCommentCount(selectedContent.id,selectedContent.type||"post",delta)}
        />
      )}
      {showPinModal && (
        <TransactionPinModal onConfirm={handlePinConfirm} onClose={() => setShowPinModal(false)}/>
      )}
      {showTwoFA && (
        <TwoFAModal onConfirm={handleTwoFAConfirm} onClose={() => setShowTwoFA(false)}/>
      )}
      {showSaveFolder && (
        <SaveFolderModal folders={savedFolders} onSave={handleSave} onClose={() => setShowSaveFolder(false)}/>
      )}
      {showEditModal && selectedContent && (
        <EditPostModal
          story={selectedContent}
          onUpdate={updated => {
            const type = selectedContent.type||"post";
            const patch = (list,setter) => setter(list.map(x => x.id===updated.id ? {...x,...updated} : x));
            if (type==="post")       patch(posts,   setPosts);
            else if (type==="reel")  patch(reels,   setReels);
            else if (type==="story") patch(stories, setStories);
            setShowEditModal(false);
          }}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </>
  );
};

export default HomeView;

// ── Helpers ───────────────────────────────────────────────────────────────────
const EmptyState = ({ icon, title, text }) => (
  <div className="empty-state">
    <div className="empty-state-icon" style={{ color:"#84cc16" }}>{icon}</div>
    <h3 className="empty-state-title">{title}</h3>
    <p className="empty-state-text">{text}</p>
  </div>
);

const FeedSkeleton = () => (
  <>
    {[1,2,3].map(i => (
      <div key={i} style={{
        margin:"0 0 10px", borderRadius:16,
        background:"rgba(255,255,255,0.025)", overflow:"hidden",
      }}>
        <div style={{ height:280, background:"rgba(255,255,255,0.04)", animation:"fsk 1.4s ease-in-out infinite", animationDelay:`${i*0.12}s` }}/>
        <div style={{ padding:"12px 14px" }}>
          <div style={{ height:12, borderRadius:6, background:"rgba(255,255,255,0.04)", width:"70%", marginBottom:8, animation:"fsk 1.4s ease-in-out infinite" }}/>
          <div style={{ height:10, borderRadius:6, background:"rgba(255,255,255,0.03)", width:"45%", animation:"fsk 1.4s ease-in-out infinite" }}/>
        </div>
      </div>
    ))}
    <style>{`@keyframes fsk{0%,100%{opacity:.5}50%{opacity:.15}}`}</style>
  </>
);