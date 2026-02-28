// src/components/Home/HomeView.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Image, Film, BookOpen, RefreshCw } from 'lucide-react';

import PostTab from './PostTab';
import ReelsTab from './ReelsTab';
import StoryTab from './StoryTab';

import postService from '../../services/home/postService';
import reelService from '../../services/home/reelService';
import storyService from '../../services/home/storyService';
import authService from '../../services/auth/authService';
import SaveModel from '../../models/SaveModel';

// Import modals
import UserProfileModal from '../Modals/UserProfileModal';
import ActionMenu from '../Shared/ActionMenu';
import CommentModal from '../Modals/CommentModal';
import TransactionPinModal from '../Modals/TransactionPinModal';
import TwoFAModal from '../Modals/TwoFAModal';
import SaveFolderModal from '../Modals/SaveFolderModal';
import EditPostModal from '../Modals/EditPostModal';
import UnifiedLoader from '../Shared/UnifiedLoader';

const HomeView = () => {
  const [activeTab, setActiveTab] = useState('posts');
  const [posts, setPosts] = useState([]);
  const [reels, setReels] = useState([]);
  const [stories, setStories] = useState([]);

  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const [currentUser, setCurrentUser] = useState(null);

  // Modal states
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

  const savedFolders = ['Favorites', 'Inspiration', 'Later'];
  const hasLoadedContent = useRef(false);

  useEffect(() => {
    initializeHome();
  }, []);

  const initializeHome = async () => {
    try {
      console.log('🏠 Initializing HomeView...');
      const startTime = Date.now();

      const user = await authService.getCurrentUser();
      setCurrentUser(user);

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout. Please check your connection.')), 10000)
      );

      const contentPromise = loadContent();

      try {
        await Promise.race([contentPromise, timeoutPromise]);
        hasLoadedContent.current = true;
        console.log(`✅ Content loaded in ${Date.now() - startTime}ms`);
      } catch (err) {
        if (err.message.includes('timeout')) {
          setError('Request timeout. Please check your connection.');
        } else {
          setError(err.message || 'Failed to load content');
        }
      }
    } catch (err) {
      console.error('❌ Failed to initialize home:', err);
      setError(err.message || 'Failed to load content');
    } finally {
      setInitialLoading(false);
    }
  };

  const loadContent = async () => {
    try {
      const [postsData, reelsData, storiesData] = await Promise.all([
        postService.getPosts({ limit: 20 }).catch(() => []),
        reelService.getReels({ limit: 20 }).catch(() => []),
        storyService.getStories({ limit: 20 }).catch(() => []),
      ]);

      console.log('📊 Raw reels data:', reelsData);
      console.log('📊 Is array?', Array.isArray(reelsData));

      setPosts(postsData || []);
      setReels(Array.isArray(reelsData) ? reelsData : []);
      setStories(storiesData || []);
    } catch (err) {
      console.error('❌ Failed to load content:', err);
      throw err;
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      setError(null);
      await loadContent();
      setTimeout(() => setRefreshing(false), 300);
    } catch (err) {
      console.error('❌ Failed to refresh:', err);
      setError(err.message || 'Failed to refresh content');
      setRefreshing(false);
    }
  };

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
    console.log('🎯 Action menu opened for:', content.type || 'post', content.id);
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
      alert('Please sign in to unlock stories');
      return;
    }
    setPendingUnlock(story);
    setShowPinModal(true);
  };

  const handlePinConfirm = (pin) => {
    setShowPinModal(false);
    setShowTwoFA(true);
  };

  const handleTwoFAConfirm = async (code) => {
    try {
      alert(`Unlocked: ${pendingUnlock.title}`);
      setShowTwoFA(false);
      setPendingUnlock(null);
      await handleRefresh();
    } catch (err) {
      console.error('Failed to unlock:', err);
      alert(err.message);
    }
  };

  // ========== ACTION MENU HANDLERS ==========

  const handleSave = async (folder) => {
    try {
      if (!selectedContent || !currentUser) return;
      const contentType = selectedContent.type || 'post';
      await SaveModel.saveContent(contentType, selectedContent.id, currentUser.id, folder);
      alert(`Saved to ${folder}`);
      setShowSaveFolder(false);
    } catch (err) {
      console.error('Failed to save:', err);
      alert(err.message || 'Failed to save');
    }
  };

  const handleEdit = () => {
    setShowActionMenu(false);
    setShowEditModal(true);
  };

  const handleDelete = async () => {
    try {
      if (!selectedContent || !currentUser) {
        console.error('❌ No content or user');
        return;
      }

      const contentType = selectedContent.type || 'post';
      const contentId = selectedContent.id;

      console.log('🗑️ Deleting:', contentType, contentId);

      if (contentType === 'post') {
        await postService.deletePost(contentId);
        setPosts((prev) => prev.filter((p) => p.id !== contentId));
      } else if (contentType === 'reel') {
        await reelService.deleteReel(contentId);
        setReels((prev) => prev.filter((r) => r.id !== contentId));
      } else if (contentType === 'story') {
        await storyService.deleteStory(contentId);
        setStories((prev) => prev.filter((s) => s.id !== contentId));
      }

      setShowActionMenu(false);
      setSelectedContent(null);
      alert('Deleted successfully!');
    } catch (err) {
      console.error('❌ Failed to delete:', err);
      alert(err.message || 'Failed to delete');
    }
  };

  const handleShare = () => {
    setShowActionMenu(false);
    alert('Share functionality coming soon!');
  };

  const handleReport = () => {
    setShowActionMenu(false);
    alert('Report submitted. Thank you for keeping our community safe!');
    console.log('Reported content:', selectedContent);
  };

  // ========== RENDER ==========

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
    return <UnifiedLoader type="page" message="Loading content..." minDisplay={200} />;
  }

  return (
    <>
      <div className="home-view">
        {refreshing && (
          <div className="refresh-indicator">
            <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
            Refreshing...
          </div>
        )}

        {/* Tab bar — sticky inside .main-content-desktop/.main-content-mobile */}
        <div className="app-header">
          <div className="tabs">
            <button
              className={`tab ${activeTab === 'posts' ? 'active' : ''}`}
              onClick={() => setActiveTab('posts')}
            >
              <Image size={18} /> Posts
            </button>
            <button
              className={`tab ${activeTab === 'reels' ? 'active' : ''}`}
              onClick={() => setActiveTab('reels')}
            >
              <Film size={18} /> Reels
            </button>
            <button
              className={`tab ${activeTab === 'stories' ? 'active' : ''}`}
              onClick={() => setActiveTab('stories')}
            >
              <BookOpen size={18} /> Stories
            </button>
          </div>
        </div>

        {/* Scrollable feed — flex:1, overflow-y:auto */}
        <div className="feed-container">
          {activeTab === 'posts' &&
            (posts.length > 0 ? (
              <PostTab
                posts={posts}
                currentUser={currentUser}
                onAuthorClick={handleAuthorClick}
                onActionMenu={handleActionMenu}
                onComment={handleComment}
              />
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <Image size={40} style={{ color: '#84cc16' }} />
                </div>
                <h3 className="empty-state-title">No posts yet</h3>
                <p className="empty-state-text">Be the first to create a post!</p>
              </div>
            ))}

          {activeTab === 'reels' &&
            (reels.length > 0 ? (
              <ReelsTab
                reels={reels}
                currentUser={currentUser}
                onAuthorClick={handleAuthorClick}
                onActionMenu={handleActionMenu}
                onComment={handleComment}
              />
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <Film size={40} style={{ color: '#84cc16' }} />
                </div>
                <h3 className="empty-state-title">No reels yet</h3>
                <p className="empty-state-text">Be the first to create a reel!</p>
              </div>
            ))}

          {activeTab === 'stories' &&
            (stories.length > 0 ? (
              <StoryTab
                stories={stories}
                currentUser={currentUser}
                onAuthorClick={handleAuthorClick}
                onActionMenu={handleActionMenu}
                onComment={handleComment}
                onUnlock={handleUnlock}
              />
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <BookOpen size={40} style={{ color: '#84cc16' }} />
                </div>
                <h3 className="empty-state-title">No stories yet</h3>
                <p className="empty-state-text">Be the first to share a story!</p>
              </div>
            ))}
        </div>
      </div>

      {/* ========== ALL MODALS ========== */}

      {showProfile && selectedUser && (
        <UserProfileModal user={selectedUser} onClose={() => setShowProfile(false)} />
      )}

      {showActionMenu && selectedContent && (
        <ActionMenu
          position={actionMenuPos}
          isOwnPost={isOwnContent}
          content={selectedContent}
          contentType={selectedContent.type || 'post'}
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
          story={selectedContent}
          comments={selectedContent.comments || []}
          onClose={() => setShowCommentModal(false)}
          storyId={selectedContent.id}
          isMobile={window.innerWidth <= 768}
          currentUser={currentUser}
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
            const contentType = selectedContent.type || 'post';
            if (contentType === 'post') {
              setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
            } else if (contentType === 'reel') {
              setReels((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
            } else if (contentType === 'story') {
              setStories((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
            }
            alert('Updated successfully!');
            setShowEditModal(false);
          }}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </>
  );
};

export default HomeView;