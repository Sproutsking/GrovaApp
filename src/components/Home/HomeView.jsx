// ============================================================================
// src/components/Home/HomeView.jsx  — v22  (4-TAB MODEL, REALTIME FIX)
//
// CHANGES vs v21:
//   [RT-FIX] Removed the HomeView-level newsService.startPolling() call.
//            HomeView was calling startPolling() AFTER NewsTab had already
//            called startRealtime(). startRealtime() internally called stopAll()
//            which cleared the poll-cb — then HomeView's startPolling() set a
//            NEW poll-cb on top. On the next filter change NewsTab called
//            stopAll() again, killing HomeView's poll. Net result: nothing
//            ever fired. The fix is to let NewsTab own all news subscriptions.
//   [RT-FIX] HomeView no longer manages pollingStarted ref or calls any
//            newsService subscription methods. NewsService subscriptions are
//            purely NewsTab's responsibility.
//   [KEEP]   All other HomeView logic (posts, reels, stories, pagination,
//            modals, realtime for non-news content) is unchanged.
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Image,
  Film,
  BookOpen,
  RefreshCw,
  X,
  Hash,
  FileText,
  Newspaper,
} from "lucide-react";

import PostTab from "./PostTab";
import NewsTab from "./NewsTab";
import ReelsTab from "./ReelsTab";
import StoryTab from "./StoryTab";
import LiveStreamersRow from "../Stream/LiveStreamersRow";

import postService from "../../services/home/postService";
import reelService from "../../services/home/reelService";
import storyService from "../../services/home/storyService";
import authService from "../../services/auth/authService";
import realtimeService from "../../services/home/realtimeService";
import newsService from "../../services/news/newsService";
import SaveModel from "../../models/SaveModel";
import { supabase } from "../../services/config/supabase";

import UserProfileModal from "../Modals/UserProfileModal";
import ActionMenu from "../Shared/ActionMenu";
import CommentModal from "../Modals/CommentModal";
import TransactionPinModal from "../Modals/TransactionPinModal";
import TwoFAModal from "../Modals/TwoFAModal";
import SaveFolderModal from "../Modals/SaveFolderModal";
import EditPostModal from "../Modals/EditPostModal";
import UnifiedLoader from "../Shared/UnifiedLoader";

// ── Page sizes ────────────────────────────────────────────────────────────────
const POSTS_PAGE = 20;
const NEWS_PAGE = 30;

// ── Filter chip ───────────────────────────────────────────────────────────────
const FilterChip = ({ filter, onClear }) => {
  if (!filter) return null;
  const label =
    filter.type === "tag"
      ? `#${filter.value}`
      : filter.type === "post"
        ? `Post: ${filter.contentType || "content"}`
        : filter.value;
  return (
    <>
      <style>{`
        @keyframes chipIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        .ff-chip{display:inline-flex;align-items:center;gap:7px;padding:6px 12px 6px 10px;background:rgba(132,204,22,0.1);border:1px solid rgba(132,204,22,0.3);border-radius:20px;font-size:12px;font-weight:700;color:#84cc16;animation:chipIn 0.22s ease both;margin:8px 16px 0;width:fit-content;}
        .ff-chip-clear{width:18px;height:18px;border-radius:50%;background:rgba(132,204,22,0.15);border:none;color:#84cc16;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.15s;flex-shrink:0;}
        .ff-chip-clear:hover{background:rgba(132,204,22,0.3);transform:scale(1.1);}
      `}</style>
      <div className="ff-chip">
        <span style={{ opacity: 0.8, display: "flex", alignItems: "center" }}>
          {filter.type === "tag" ? <Hash size={11} /> : <FileText size={11} />}
        </span>
        {label}
        <button
          className="ff-chip-clear"
          onClick={onClear}
          title="Clear filter"
        >
          <X size={10} />
        </button>
      </div>
    </>
  );
};

// ── Optimistic item builder ───────────────────────────────────────────────────
const buildOptimisticItem = (rawItem, type, currentUser) => {
  const now = new Date().toISOString();
  const profileFromUser = {
    id: currentUser?.id,
    full_name:
      currentUser?.user_metadata?.full_name ||
      currentUser?.email?.split("@")[0] ||
      "You",
    username:
      currentUser?.user_metadata?.username ||
      currentUser?.email?.split("@")[0] ||
      "you",
    avatar_id: currentUser?.user_metadata?.avatar_id || null,
    verified: false,
  };
  return {
    ...rawItem,
    type,
    _optimistic: true,
    user_id: rawItem?.user_id || currentUser?.id,
    created_at: rawItem?.created_at || now,
    profiles: rawItem?.profiles || profileFromUser,
    likes: rawItem?.likes || 0,
    comments_count: rawItem?.comments_count || 0,
    shares: rawItem?.shares || 0,
    views: rawItem?.views || 0,
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
  feedFilter = null,
  onClearFilter = null,
  onJoinStream = null,
  activeHomeTab,
  setActiveHomeTab,
}) => {
  const [posts, setPosts] = useState([]);
  const [newsPosts, setNewsPosts] = useState([]);
  const [reels, setReels] = useState([]);
  const [stories, setStories] = useState([]);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [hasMoreNews, setHasMoreNews] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [newsLoading, setNewsLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Modal state
  const [showProfile, setShowProfile] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [actionMenuPos, setActionMenuPos] = useState({ x: 0, y: 0 });
  const [selectedContent, setSelectedContent] = useState(null);
  const [isOwnContent, setIsOwnContent] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showTwoFA, setShowTwoFA] = useState(false);
  const [pendingUnlock, setPendingUnlock] = useState(null);
  const [showSaveFolder, setShowSaveFolder] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const postTabRef = useRef(null);
  const newsTabRef = useRef(null);
  const storyTabRef = useRef(null);
  const hasLoadedContent = useRef(false);
  const rtCleanup = useRef([]);
  const currentUserRef = useRef(null);

  // Pagination refs — always current, no closure staleness
  const postsOffsetRef = useRef(0);
  const newsOffsetRef = useRef(0);
  const hasMorePostsRef = useRef(true);
  const hasMoreNewsRef = useRef(true);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    initializeHome();
    const onPublish = (e) =>
      handlePublishSuccess(e.detail?.item, e.detail?.type);
    window.addEventListener("grova:publish", onPublish);
    return () => {
      rtCleanup.current.forEach((fn) => fn?.());
      // [RT-FIX] Do NOT call newsService.stopAll() here — NewsTab manages
      // its own realtime subscription and will clean up on its own unmount.
      window.removeEventListener("grova:publish", onPublish);
    };
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!hasLoadedContent.current) return;
    applyFilter(feedFilter);
  }, [feedFilter]); // eslint-disable-line

  const initializeHome = async () => {
    try {
      const user = await authService.getCurrentUser();
      setCurrentUser(user);
      currentUserRef.current = user;
      const timeout = new Promise((_, rej) =>
        setTimeout(() => rej(new Error("Request timeout.")), 12000),
      );
      await Promise.race([loadContent(user, feedFilter), timeout]);
      hasLoadedContent.current = true;
    } catch (err) {
      if (!hasLoadedContent.current)
        setError(err.message || "Failed to load content");
    } finally {
      setInitialLoading(false);
    }
  };

  const resetPagination = () => {
    postsOffsetRef.current = 0;
    newsOffsetRef.current = 0;
    hasMorePostsRef.current = true;
    hasMoreNewsRef.current = true;
    loadingMoreRef.current = false;
    setHasMorePosts(true);
    setHasMoreNews(true);
    setLoadingMore(false);
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
      const table =
        contentType === "reel"
          ? "reels"
          : contentType === "story"
            ? "stories"
            : "posts";
      const { data: single } = await supabase
        .from(table)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (single) {
        if (contentType === "reel") {
          setReels([single]);
          setActiveHomeTab?.("reels");
        } else if (contentType === "story") {
          setStories([single]);
          setActiveHomeTab?.("stories");
        } else {
          setPosts([single]);
          setActiveHomeTab?.("posts");
        }
      }
      setupRealtime(user);
      return;
    }

    // Default — first page of everything in parallel
    const [postsData, reelsData, storiesData, newsData] = await Promise.all([
      postService.getPosts({}, 0, POSTS_PAGE).catch(() => []),
      reelService.getReels({ limit: 20 }).catch(() => []),
      storyService.getStories({ limit: 20 }).catch(() => []),
      newsService.getNewsPosts({ limit: NEWS_PAGE, offset: 0 }).catch(() => []),
    ]);

    const safePosts = Array.isArray(postsData) ? postsData : [];
    const safeNews = Array.isArray(newsData) ? newsData : [];

    setPosts(safePosts);
    setReels(Array.isArray(reelsData) ? reelsData : []);
    setStories(Array.isArray(storiesData) ? storiesData : []);
    setNewsPosts(safeNews);

    postsOffsetRef.current = POSTS_PAGE;
    newsOffsetRef.current = NEWS_PAGE;
    hasMorePostsRef.current = safePosts.length === POSTS_PAGE;
    hasMoreNewsRef.current = safeNews.length === NEWS_PAGE;
    setHasMorePosts(safePosts.length === POSTS_PAGE);
    setHasMoreNews(safeNews.length === NEWS_PAGE);

    setupRealtime(user);

    // [RT-FIX] Do NOT call newsService.startPolling() here.
    // NewsTab owns all news subscriptions via its own useEffect.
  };

  // Load more posts (posts tab pagination)
  const loadMorePosts = useCallback(async () => {
    if (loadingMoreRef.current) return;
    if (!hasMorePostsRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const currentOffset = postsOffsetRef.current;
    try {
      const nextPosts = await postService.getPosts(
        {},
        currentOffset,
        POSTS_PAGE,
      );
      const safe = Array.isArray(nextPosts) ? nextPosts : [];
      if (safe.length === 0) {
        hasMorePostsRef.current = false;
        setHasMorePosts(false);
      } else {
        setPosts((prev) => {
          const ids = new Set(prev.map((p) => p.id));
          return [...prev, ...safe.filter((p) => !ids.has(p.id))];
        });
        postsOffsetRef.current = currentOffset + POSTS_PAGE;
        if (safe.length < POSTS_PAGE) {
          hasMorePostsRef.current = false;
          setHasMorePosts(false);
        }
      }
    } catch (err) {
      console.error("[HomeView] loadMorePosts:", err.message);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, []);

  // Load more news (news tab pagination)
  const loadMoreNews = useCallback(async () => {
    if (loadingMoreRef.current) return;
    if (!hasMoreNewsRef.current) return;
    loadingMoreRef.current = true;
    setNewsLoading(true);
    const currentNewsOffset = newsOffsetRef.current;
    try {
      const nextNews = await newsService
        .getNewsPosts({
          limit: NEWS_PAGE,
          offset: currentNewsOffset,
        })
        .catch(() => []);
      const safeNews = Array.isArray(nextNews) ? nextNews : [];
      if (safeNews.length > 0) {
        setNewsPosts((prev) => {
          const ids = new Set(prev.map((n) => n.id));
          return [...prev, ...safeNews.filter((n) => !ids.has(n.id))];
        });
        newsOffsetRef.current = currentNewsOffset + NEWS_PAGE;
        if (safeNews.length < NEWS_PAGE) {
          hasMoreNewsRef.current = false;
          setHasMoreNews(false);
        }
      } else {
        hasMoreNewsRef.current = false;
        setHasMoreNews(false);
      }
    } catch (err) {
      console.error("[HomeView] loadMoreNews:", err.message);
    } finally {
      loadingMoreRef.current = false;
      setNewsLoading(false);
    }
  }, []);

  const applyFilter = async (filter) => {
    setFilterLoading(true);
    setError(null);
    resetPagination();
    try {
      await loadContent(currentUserRef.current, filter);
    } catch (e) {
      setError(e.message || "Filter failed");
    } finally {
      setFilterLoading(false);
    }
  };

  const setupRealtime = useCallback((user) => {
    rtCleanup.current.forEach((fn) => fn?.());
    const myId = user?.id || currentUserRef.current?.id;
    const addIfNew = (setter, item) => {
      if (item.user_id === myId) return;
      setter((prev) =>
        prev.some((x) => x.id === item.id) ? prev : [item, ...prev],
      );
    };
    const u1 = realtimeService.subscribeToNewPosts((p) =>
      addIfNew(setPosts, p),
    );
    const u2 = realtimeService.subscribeToNewReels((r) =>
      addIfNew(setReels, r),
    );
    const u3 = realtimeService.subscribeToNewStories((s) =>
      addIfNew(setStories, s),
    );
    rtCleanup.current = [u1, u2, u3];
  }, []);

  const handlePublishSuccess = useCallback(
    (rawItem, type) => {
      if (!rawItem?.id && !rawItem?._tempId) return;
      const resolvedUser = currentUserRef.current || currentUserProp;
      const item = buildOptimisticItem(
        rawItem,
        type || rawItem?.type || "post",
        resolvedUser,
      );
      const upsert = (setter) =>
        setter((prev) => {
          if (prev.some((x) => x.id === item.id))
            return prev.map((x) =>
              x.id === item.id ? { ...x, ...item, _optimistic: false } : x,
            );
          return [item, ...prev];
        });
      if (item.type === "post") {
        upsert(setPosts);
        setActiveHomeTab?.("posts");
      } else if (item.type === "reel") {
        upsert(setReels);
        setActiveHomeTab?.("reels");
      } else if (item.type === "story") {
        upsert(setStories);
        setActiveHomeTab?.("stories");
      }
    },
    [currentUserProp, setActiveHomeTab],
  );

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      setError(null);
      resetPagination();
      setPosts([]);
      setNewsPosts([]);
      await loadContent(currentUserRef.current, feedFilter);
    } catch (err) {
      setError(err.message || "Failed to refresh");
    } finally {
      setTimeout(() => setRefreshing(false), 300);
    }
  };

  const syncCommentCount = useCallback(
    (contentId, type, delta = 1) => {
      const patch = (list, setter) =>
        setter(
          list.map((x) =>
            x.id === contentId
              ? {
                  ...x,
                  comments_count: Math.max(0, (x.comments_count || 0) + delta),
                }
              : x,
          ),
        );
      if (type === "post") patch(posts, setPosts);
      else if (type === "reel") patch(reels, setReels);
      else if (type === "story") patch(stories, setStories);
    },
    [posts, reels, stories],
  );

  const handleAuthorClick = (content) => {
    setSelectedUser({
      id: content.userId,
      author: content.author,
      username: content.username,
      avatar: content.avatar,
      verified: content.verified,
    });
    setShowProfile(true);
  };
  const handleActionMenu = (e, content, isOwn) => {
    e.stopPropagation();
    setSelectedContent(content);
    setIsOwnContent(isOwn);
    setActionMenuPos({ x: e.clientX, y: e.clientY });
    setShowActionMenu(true);
  };
  const handleComment = (content) => {
    setSelectedContent(content);
    setShowCommentModal(true);
  };
  const handleUnlock = (story) => {
    if (!currentUser) {
      alert("Please sign in");
      return;
    }
    setPendingUnlock(story);
    setShowPinModal(true);
  };
  const handlePinConfirm = () => {
    setShowPinModal(false);
    setShowTwoFA(true);
  };
  const handleTwoFAConfirm = async () => {
    alert(`Unlocked: ${pendingUnlock?.title}`);
    setShowTwoFA(false);
    setPendingUnlock(null);
    await handleRefresh();
  };
  const handleSave = async (folder) => {
    try {
      if (!selectedContent || !currentUser) return;
      await SaveModel.saveContent(
        selectedContent.type || "post",
        selectedContent.id,
        currentUser.id,
        folder,
      );
      setShowSaveFolder(false);
    } catch (err) {
      alert(err.message || "Failed to save");
    }
  };
  const handleEdit = () => {
    setShowActionMenu(false);
    setShowEditModal(true);
  };
  const handleShare = () => setShowActionMenu(false);
  const handleReport = () => setShowActionMenu(false);
  const handleDelete = async () => {
    if (!selectedContent || !currentUser) return;
    const { type = "post", id } = selectedContent;
    if (type === "post") setPosts((p) => p.filter((x) => x.id !== id));
    else if (type === "reel") setReels((r) => r.filter((x) => x.id !== id));
    else if (type === "story") setStories((s) => s.filter((x) => x.id !== id));
    setShowActionMenu(false);
    try {
      if (type === "post") await postService.deletePost(id);
      else if (type === "reel") await reelService.deleteReel(id);
      else if (type === "story") await storyService.deleteStory(id);
    } catch (err) {
      alert(err.message || "Delete failed");
      await handleRefresh();
    }
  };

  if (error && !hasLoadedContent.current) {
    return (
      <UnifiedLoader
        type="page"
        error={error}
        onRetry={() => {
          setError(null);
          setInitialLoading(true);
          initializeHome();
        }}
      />
    );
  }
  if (initialLoading && !hasLoadedContent.current) {
    return (
      <UnifiedLoader
        type="page"
        message="Loading content..."
        minDisplay={200}
      />
    );
  }

  const savedFolders = ["Favorites", "Inspiration", "Later"];
  const resolvedUser = currentUser || currentUserProp;
  const currentTab = activeHomeTab || "posts";

  return (
    <>
      <div className="home-view">
        {refreshing && (
          <div className="refresh-indicator">
            <RefreshCw
              size={16}
              style={{ animation: "spin 1s linear infinite" }}
            />
            Refreshing...
          </div>
        )}

        <LiveStreamersRow
          variant="home"
          onJoin={onJoinStream}
          currentUser={resolvedUser}
        />
        <FilterChip filter={feedFilter} onClear={onClearFilter} />

        {filterLoading && (
          <div style={{ padding: "16px", opacity: 0.6 }}>
            <UnifiedLoader
              type="section"
              message={`Filtering by ${feedFilter?.value}…`}
            />
          </div>
        )}

        {!filterLoading && (
          <div className="feed-container">
            {/* ── POSTS TAB ── */}
            {currentTab === "posts" &&
              (posts.length > 0 ? (
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
                />
              ) : (
                <EmptyState
                  icon={<Image size={38} />}
                  title={
                    feedFilter
                      ? `No posts in #${feedFilter.value}`
                      : "No posts yet"
                  }
                  text={
                    feedFilter
                      ? "Try a different tag or clear the filter."
                      : "Be the first to create a post!"
                  }
                />
              ))}

            {/* ── REELS TAB ── */}
            {currentTab === "reels" &&
              (reels.length > 0 ? (
                <ReelsTab
                  reels={reels}
                  currentUser={resolvedUser}
                  onAuthorClick={handleAuthorClick}
                  onActionMenu={handleActionMenu}
                  onComment={handleComment}
                />
              ) : (
                <EmptyState
                  icon={<Film size={38} />}
                  title={
                    feedFilter
                      ? `No reels in #${feedFilter.value}`
                      : "No reels yet"
                  }
                  text={
                    feedFilter
                      ? "Try a different tag or clear the filter."
                      : "Be the first to create a reel!"
                  }
                />
              ))}

            {/* ── STORIES TAB ── */}
            {currentTab === "stories" &&
              (stories.length > 0 ? (
                <StoryTab
                  ref={storyTabRef}
                  stories={stories}
                  currentUser={resolvedUser}
                  onAuthorClick={handleAuthorClick}
                  onActionMenu={handleActionMenu}
                  onUnlock={handleUnlock}
                />
              ) : (
                <EmptyState
                  icon={<BookOpen size={38} />}
                  title={
                    feedFilter
                      ? `No stories in #${feedFilter.value}`
                      : "No stories yet"
                  }
                  text={
                    feedFilter
                      ? "Try a different tag or clear the filter."
                      : "Be the first to share a story!"
                  }
                />
              ))}

            {/* ── NEWS TAB ── */}
            {currentTab === "news" && (
              <NewsTab
                ref={newsTabRef}
                newsPosts={newsPosts}
                currentUser={resolvedUser}
                onLoadMore={loadMoreNews}
                hasMore={hasMoreNews}
                isLoadingMore={newsLoading}
              />
            )}
          </div>
        )}
      </div>

      {showProfile && selectedUser && (
        <UserProfileModal
          user={selectedUser}
          onClose={() => setShowProfile(false)}
        />
      )}
      {showActionMenu && selectedContent && (
        <ActionMenu
          position={actionMenuPos}
          isOwnPost={isOwnContent}
          content={selectedContent}
          contentType={selectedContent.type || "post"}
          currentUser={resolvedUser}
          onClose={() => setShowActionMenu(false)}
          onSave={() => {
            setShowActionMenu(false);
            setShowSaveFolder(true);
          }}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onShare={handleShare}
          onReport={handleReport}
        />
      )}
      {showCommentModal && selectedContent && (
        <CommentModal
          content={selectedContent}
          currentUser={resolvedUser}
          onClose={() => setShowCommentModal(false)}
          onCommentPosted={(delta = 1) =>
            syncCommentCount(
              selectedContent.id,
              selectedContent.type || "post",
              delta,
            )
          }
        />
      )}
      {showPinModal && (
        <TransactionPinModal
          onConfirm={handlePinConfirm}
          onClose={() => setShowPinModal(false)}
        />
      )}
      {showTwoFA && (
        <TwoFAModal
          onConfirm={handleTwoFAConfirm}
          onClose={() => setShowTwoFA(false)}
        />
      )}
      {showSaveFolder && (
        <SaveFolderModal
          folders={savedFolders}
          onSave={handleSave}
          onClose={() => setShowSaveFolder(false)}
        />
      )}
      {showEditModal && selectedContent && (
        <EditPostModal
          story={selectedContent}
          onUpdate={(updated) => {
            const type = selectedContent.type || "post";
            const patch = (list, setter) =>
              setter(
                list.map((x) =>
                  x.id === updated.id ? { ...x, ...updated } : x,
                ),
              );
            if (type === "post") patch(posts, setPosts);
            else if (type === "reel") patch(reels, setReels);
            else if (type === "story") patch(stories, setStories);
            setShowEditModal(false);
          }}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </>
  );
};

export default HomeView;

const EmptyState = ({ icon, title, text }) => (
  <div className="empty-state">
    <div className="empty-state-icon" style={{ color: "#84cc16" }}>
      {icon}
    </div>
    <h3 className="empty-state-title">{title}</h3>
    <p className="empty-state-text">{text}</p>
  </div>
);
