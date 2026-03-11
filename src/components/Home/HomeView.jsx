// src/components/Home/HomeView.jsx
// Optimistic publish: new content appears instantly via tab refs.
// Realtime: other users' content pushed live via Supabase subscriptions.
// To wire CreateView: call homeViewRef.current?.publishSuccess(newItem)
// OR emit a custom event: window.dispatchEvent(new CustomEvent("grova:publish", { detail: newItem }))
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Image, Film, BookOpen, RefreshCw } from "lucide-react";

import PostTab from "./PostTab";
import ReelsTab from "./ReelsTab";
import StoryTab from "./StoryTab";

import postService from "../../services/home/postService";
import reelService from "../../services/home/reelService";
import storyService from "../../services/home/storyService";
import authService from "../../services/auth/authService";
import realtimeService from "../../services/home/realtimeService";
import SaveModel from "../../models/SaveModel";

import UserProfileModal from "../Modals/UserProfileModal";
import ActionMenu from "../Shared/ActionMenu";
import CommentModal from "../Modals/CommentModal";
import TransactionPinModal from "../Modals/TransactionPinModal";
import TwoFAModal from "../Modals/TwoFAModal";
import SaveFolderModal from "../Modals/SaveFolderModal";
import EditPostModal from "../Modals/EditPostModal";
import UnifiedLoader from "../Shared/UnifiedLoader";

const HomeView = () => {
  const [activeTab, setActiveTab] = useState("posts");
  const [posts, setPosts] = useState([]);
  const [reels, setReels] = useState([]);
  const [stories, setStories] = useState([]);

  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Modals
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

  // Tab refs for imperative prepend (avoids prop-drilling)
  const postTabRef = useRef(null);
  const storyTabRef = useRef(null);

  const hasLoadedContent = useRef(false);
  const rtCleanup = useRef([]);
  const currentUserRef = useRef(null);

  useEffect(() => {
    initializeHome();
    // Listen for publish events from CreateView (custom event bus)
    const onPublish = (e) => handlePublishSuccess(e.detail);
    window.addEventListener("grova:publish", onPublish);
    return () => {
      rtCleanup.current.forEach((fn) => fn?.());
      window.removeEventListener("grova:publish", onPublish);
    };
  }, []);

  const initializeHome = async () => {
    try {
      const user = await authService.getCurrentUser();
      setCurrentUser(user);
      currentUserRef.current = user;

      const timeout = new Promise((_, rej) =>
        setTimeout(
          () =>
            rej(new Error("Request timeout. Please check your connection.")),
          10000,
        ),
      );
      await Promise.race([loadContent(user), timeout]);
      hasLoadedContent.current = true;
    } catch (err) {
      if (!hasLoadedContent.current)
        setError(err.message || "Failed to load content");
    } finally {
      setInitialLoading(false);
    }
  };

  const loadContent = async (user) => {
    const [postsData, reelsData, storiesData] = await Promise.all([
      postService.getPosts({ limit: 20 }).catch(() => []),
      reelService.getReels({ limit: 20 }).catch(() => []),
      storyService.getStories({ limit: 20 }).catch(() => []),
    ]);
    setPosts(postsData || []);
    setReels(Array.isArray(reelsData) ? reelsData : []);
    setStories(storiesData || []);
    setupRealtime(user);
  };

  // ── Realtime ──────────────────────────────────────────────────────────────
  const setupRealtime = useCallback((user) => {
    rtCleanup.current.forEach((fn) => fn?.());

    const myId = user?.id || currentUserRef.current?.id;

    const addIfNew = (setter, tabRef, item) => {
      if (item.user_id === myId) return; // own items already optimistic
      tabRef?.current?.prepend(item);
      setter((prev) =>
        prev.some((x) => x.id === item.id) ? prev : [item, ...prev],
      );
    };

    const unsubPosts = realtimeService.subscribeToNewPosts((p) =>
      addIfNew(setPosts, postTabRef, p),
    );
    const unsubReels = realtimeService.subscribeToNewReels((r) =>
      addIfNew(setReels, null, r),
    );
    const unsubStories = realtimeService.subscribeToNewStories((s) =>
      addIfNew(setStories, storyTabRef, s),
    );

    rtCleanup.current = [unsubPosts, unsubReels, unsubStories];
  }, []);

  // ── Optimistic publish (own new content) ─────────────────────────────────
  // Called from CreateView via: window.dispatchEvent(new CustomEvent("grova:publish", { detail: item }))
  // OR directly: postTabRef is internal — so expose via the event bus above.
  const handlePublishSuccess = useCallback((newItem) => {
    if (!newItem?.id) return;
    const type = newItem.type || newItem.content_type || "post";

    if (type === "post") {
      const item = { ...newItem, type: "post" };
      postTabRef.current?.prepend(item);
      setPosts((prev) =>
        prev.some((p) => p.id === item.id) ? prev : [item, ...prev],
      );
      setActiveTab("posts");
    } else if (type === "reel") {
      const item = { ...newItem, type: "reel" };
      setReels((prev) =>
        prev.some((r) => r.id === item.id) ? prev : [item, ...prev],
      );
      setActiveTab("reels");
    } else if (type === "story") {
      const item = { ...newItem, type: "story" };
      storyTabRef.current?.prepend(item);
      setStories((prev) =>
        prev.some((s) => s.id === item.id) ? prev : [item, ...prev],
      );
      setActiveTab("stories");
    }
  }, []);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      setError(null);
      await loadContent(currentUserRef.current);
    } catch (err) {
      setError(err.message || "Failed to refresh");
    } finally {
      setTimeout(() => setRefreshing(false), 300);
    }
  };

  // ── Comment count sync ───────────────────────────────────────────────────
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

  // ── Modals ────────────────────────────────────────────────────────────────
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
  const handleShare = () => {
    setShowActionMenu(false);
  };
  const handleReport = () => {
    setShowActionMenu(false);
  };

  const handleDelete = async () => {
    if (!selectedContent || !currentUser) return;
    const { type = "post", id } = selectedContent;

    // Optimistic
    if (type === "post") {
      setPosts((p) => p.filter((x) => x.id !== id));
      postTabRef.current?.deletePost(id);
    } else if (type === "reel") {
      setReels((r) => r.filter((x) => x.id !== id));
    } else if (type === "story") {
      setStories((s) => s.filter((x) => x.id !== id));
      storyTabRef.current?.deleteStory(id);
    }

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

  // ── Render ────────────────────────────────────────────────────────────────
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

        <div className="app-header">
          <div className="tabs">
            <button
              className={`tab ${activeTab === "posts" ? "active" : ""}`}
              onClick={() => setActiveTab("posts")}
            >
              <Image size={18} /> Posts
            </button>
            <button
              className={`tab ${activeTab === "reels" ? "active" : ""}`}
              onClick={() => setActiveTab("reels")}
            >
              <Film size={18} /> Reels
            </button>
            <button
              className={`tab ${activeTab === "stories" ? "active" : ""}`}
              onClick={() => setActiveTab("stories")}
            >
              <BookOpen size={18} /> Stories
            </button>
          </div>
        </div>

        <div className="feed-container">
          {activeTab === "posts" &&
            (posts.length > 0 ? (
              <PostTab
                ref={postTabRef}
                posts={posts}
                currentUser={currentUser}
              />
            ) : (
              <EmptyState
                icon={<Image size={40} />}
                title="No posts yet"
                text="Be the first to create a post!"
              />
            ))}
          {activeTab === "reels" &&
            (reels.length > 0 ? (
              <ReelsTab
                reels={reels}
                currentUser={currentUser}
                onAuthorClick={handleAuthorClick}
                onActionMenu={handleActionMenu}
                onComment={handleComment}
              />
            ) : (
              <EmptyState
                icon={<Film size={40} />}
                title="No reels yet"
                text="Be the first to create a reel!"
              />
            ))}
          {activeTab === "stories" &&
            (stories.length > 0 ? (
              <StoryTab
                ref={storyTabRef}
                stories={stories}
                currentUser={currentUser}
                onAuthorClick={handleAuthorClick}
                onActionMenu={handleActionMenu}
                onUnlock={handleUnlock}
              />
            ) : (
              <EmptyState
                icon={<BookOpen size={40} />}
                title="No stories yet"
                text="Be the first to share a story!"
              />
            ))}
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
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
          currentUser={currentUser}
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
          currentUser={currentUser}
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
            if (type === "post")
              setPosts((p) =>
                p.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)),
              );
            else if (type === "reel")
              setReels((r) =>
                r.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)),
              );
            else if (type === "story")
              setStories((s) =>
                s.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)),
              );
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
