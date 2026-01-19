import React, { useState, useEffect } from 'react';
import { Image, Film, BookOpen, X, Upload, Eye, Lock, Sparkles, DollarSign, Users, Plus, Minus, Loader } from 'lucide-react';
import createService from '../../services/create/createService';
import authService from '../../services/auth/authService';
import securityService from '../../services/security/SecurityService';

const CreateStudio = ({ onPublishSuccess, showToast }) => {
  const [activeTab, setActiveTab] = useState('post');
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  // Post State
  const [postContent, setPostContent] = useState('');
  const [postImages, setPostImages] = useState([]);
  const [postCategory, setPostCategory] = useState('General');

  // Reel State
  const [reelCaption, setReelCaption] = useState('');
  const [reelVideo, setReelVideo] = useState(null);
  const [reelMusic, setReelMusic] = useState('');
  const [reelCategory, setReelCategory] = useState('Entertainment');
  const [reelThumbnail, setReelThumbnail] = useState(null);

  // Story State
  const [storyTitle, setStoryTitle] = useState('');
  const [storyCategory, setStoryCategory] = useState('Folklore');
  const [storyContent, setStoryContent] = useState('');
  const [storyPreview, setStoryPreview] = useState('');
  const [unlockPrice, setUnlockPrice] = useState(10);
  const [maxAccesses, setMaxAccesses] = useState(1000);
  const [storyCover, setStoryCover] = useState(null);

  const postCategories = ['General', 'Technology', 'Art', 'Music', 'Photography', 'Lifestyle', 'Food', 'Travel'];
  const reelCategories = ['Entertainment', 'Comedy', 'Education', 'Music', 'Dance', 'Fashion', 'Fitness', 'Gaming'];
  const storyCategories = ['Folklore', 'Life Journey', 'Philosophy', 'Innovation', 'Romance', 'Adventure', 'Mystery', 'Wisdom'];

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const user = await authService.getCurrentUser();
      if (user) {
        setCurrentUser(user);
        const profile = await authService.getUserProfile(user.id);
        setUserProfile(profile);
      }
    } catch (err) {
      console.error('Failed to load user:', err);
    }
  };

  const handlePublishPost = async () => {
    try {
      setLoading(true);
      securityService.updateActivity();

      if (!currentUser) {
        await loadUser();
        if (!currentUser) {
          throw new Error('You must be logged in to create a post');
        }
      }

      if (!userProfile) {
        throw new Error('Please complete your profile setup before creating posts');
      }

      if (!postContent.trim() && postImages.length === 0) {
        throw new Error('Post must have content or images');
      }

      const newPost = await createService.createPost({
        content: postContent.trim(),
        images: postImages,
        category: postCategory
      }, currentUser.id);

      // Reset form
      setPostContent('');
      setPostImages([]);
      setPostCategory('General');

      showToast?.('success', 'Post published! 🎉', 'Your post is now live');

      if (onPublishSuccess) {
        onPublishSuccess(newPost, 'post');
      }

    } catch (err) {
      console.error('Failed to publish post:', err);
      showToast?.('error', 'Publishing failed', err.message || 'Failed to publish post');
    } finally {
      setLoading(false);
    }
  };

  const handlePublishReel = async () => {
    try {
      setLoading(true);
      setUploadProgress(0);
      securityService.updateActivity();

      if (!currentUser) {
        await loadUser();
        if (!currentUser) {
          throw new Error('You must be logged in to create a reel');
        }
      }

      if (!userProfile) {
        throw new Error('Please complete your profile setup before creating reels');
      }

      if (!reelVideo) {
        throw new Error('Video is required');
      }

      const newReel = await createService.createReel({
        video: reelVideo,
        thumbnail: reelThumbnail,
        caption: reelCaption.trim(),
        music: reelMusic.trim() || 'Original Audio',
        category: reelCategory
      }, currentUser.id, (progress) => {
        setUploadProgress(progress);
      });

      // Reset form
      setReelCaption('');
      setReelVideo(null);
      setReelMusic('');
      setReelCategory('Entertainment');
      setReelThumbnail(null);
      setUploadProgress(0);

      showToast?.('success', 'Reel published! 🎬', 'Your reel is now live');

      if (onPublishSuccess) {
        onPublishSuccess(newReel, 'reel');
      }

    } catch (err) {
      console.error('Failed to publish reel:', err);
      showToast?.('error', 'Publishing failed', err.message || 'Failed to publish reel');
    } finally {
      setLoading(false);
    }
  };

  const handlePublishStory = async () => {
    try {
      setLoading(true);
      securityService.updateActivity();

      if (!currentUser) {
        await loadUser();
        if (!currentUser) {
          throw new Error('You must be logged in to create a story');
        }
      }

      if (!userProfile) {
        throw new Error('Please complete your profile setup before creating stories');
      }

      if (!storyTitle.trim()) {
        throw new Error('Story title is required');
      }

      if (storyTitle.trim().length < 3 || storyTitle.trim().length > 200) {
        throw new Error('Story title must be between 3 and 200 characters');
      }

      if (!storyPreview.trim()) {
        throw new Error('Story preview is required');
      }

      if (storyPreview.trim().length < 10 || storyPreview.trim().length > 500) {
        throw new Error('Story preview must be between 10 and 500 characters');
      }

      if (!storyContent.trim()) {
        throw new Error('Story content is required');
      }

      const newStory = await createService.createStory({
        title: storyTitle.trim(),
        preview: storyPreview.trim(),
        fullContent: storyContent.trim(),
        coverImage: storyCover,
        category: storyCategory,
        unlockCost: unlockPrice,
        maxAccesses: maxAccesses
      }, currentUser.id);

      // Reset form
      setStoryTitle('');
      setStoryCategory('Folklore');
      setStoryContent('');
      setStoryPreview('');
      setUnlockPrice(10);
      setMaxAccesses(1000);
      setStoryCover(null);

      const potentialEarnings = unlockPrice * maxAccesses;
      showToast?.('success', 'Story published! 💰', `Start earning! Potential: ${potentialEarnings.toLocaleString()} GT`);

      if (onPublishSuccess) {
        onPublishSuccess(newStory, 'story');
      }

    } catch (err) {
      console.error('Failed to publish story:', err);
      showToast?.('error', 'Publishing failed', err.message || 'Failed to publish story');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + postImages.length > 10) {
      showToast?.('warning', 'Too many images', 'Maximum 10 images allowed per post');
      return;
    }

    const oversizedFiles = files.filter(f => f.size > 10 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      showToast?.('warning', 'File too large', 'Each image must be under 10MB');
      return;
    }

    setPostImages(prev => [...prev, ...files]);
    showToast?.('info', 'Images added', `${files.length} image(s) ready to upload`);
  };

  const removeImage = (index) => {
    setPostImages(prev => prev.filter((_, i) => i !== index));
    showToast?.('info', 'Image removed');
  };

  const handleVideoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 100 * 1024 * 1024) {
        showToast?.('warning', 'Video too large', 'Video must be less than 100MB');
        return;
      }
      setReelVideo(file);
      showToast?.('info', 'Video selected', file.name);
    }
  };

  const handleThumbnailUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast?.('warning', 'Thumbnail too large', 'Thumbnail must be less than 5MB');
        return;
      }
      setReelThumbnail(file);
      showToast?.('info', 'Thumbnail selected', file.name);
    }
  };

  const handleCoverUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast?.('warning', 'Cover too large', 'Cover image must be less than 5MB');
        return;
      }
      setStoryCover(file);
      showToast?.('info', 'Cover image selected', file.name);
    }
  };

  return (
    <>
      <div className="create-studio-wrapper">
        <div className="studio-header">
          <h1 className="studio-title">Creator Studio</h1>
          <p className="studio-subtitle">Share your creativity, earn Grova Tokens</p>
        </div>

        {uploadProgress > 0 && uploadProgress < 100 && (
          <div className="upload-progress-bar">
            <div className="upload-progress-fill" style={{ width: `${uploadProgress}%` }}></div>
            <span className="upload-progress-text">{Math.round(uploadProgress)}%</span>
          </div>
        )}

        <div className="content-tabs">
          <button className={`content-tab ${activeTab === 'post' ? 'active' : ''}`} onClick={() => setActiveTab('post')}>
            <Image size={20} /> Post
          </button>
          <button className={`content-tab ${activeTab === 'reel' ? 'active' : ''}`} onClick={() => setActiveTab('reel')}>
            <Film size={20} /> Reel
          </button>
          <button className={`content-tab ${activeTab === 'story' ? 'active' : ''}`} onClick={() => setActiveTab('story')}>
            <BookOpen size={20} /> Story
          </button>
        </div>

        {activeTab === 'post' && (
          <div className="create-form">
            <div className="form-group">
              <label className="form-label">
                <Sparkles size={16} />
                What's on your mind?
              </label>
              <textarea
                className="form-textarea"
                placeholder="Share your thoughts, ideas, or moments..."
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                rows={6}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <Image size={16} />
                Add Images
              </label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                style={{ display: 'none' }}
                id="post-image-upload"
                disabled={loading}
              />
              <label htmlFor="post-image-upload" className="upload-area">
                <div className="upload-icon">
                  <Upload size={28} />
                </div>
                <div className="upload-text">Click to upload images</div>
                <div className="upload-hint">PNG, JPG, GIF up to 10MB each (Max 10 images)</div>
              </label>

              {postImages.length > 0 && (
                <div className="image-preview-grid">
                  {postImages.map((img, index) => (
                    <div key={index} className="image-preview">
                      <img src={URL.createObjectURL(img)} alt={`Preview ${index + 1}`} />
                      <button
                        className="remove-image-btn"
                        onClick={() => removeImage(index)}
                        disabled={loading}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">
                <Sparkles size={16} />
                Category
              </label>
              <div className="category-grid">
                {postCategories.map(cat => (
                  <button
                    key={cat}
                    className={`category-chip ${postCategory === cat ? 'active' : ''}`}
                    onClick={() => setPostCategory(cat)}
                    disabled={loading}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="publish-btn-wrapper">
              <button 
                className="publish-btn" 
                onClick={handlePublishPost}
                disabled={loading || (!postContent.trim() && postImages.length === 0) || !currentUser}
              >
                {loading ? <><Loader size={18} className="spinner" /> Publishing...</> : 'Publish Post'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'reel' && (
          <div className="create-form">
            <div className="form-group">
              <label className="form-label">
                <Film size={16} />
                Upload Video
              </label>
              <input
                type="file"
                accept="video/*"
                onChange={handleVideoUpload}
                style={{ display: 'none' }}
                id="reel-video-upload"
                disabled={loading}
              />
              <label htmlFor="reel-video-upload" className="upload-area">
                <div className="upload-icon">
                  <Film size={28} />
                </div>
                <div className="upload-text">
                  {reelVideo ? reelVideo.name : 'Click to upload video'}
                </div>
                <div className="upload-hint">MP4, MOV up to 100MB • Vertical format recommended</div>
              </label>
            </div>

            <div className="form-group">
              <label className="form-label">
                <Image size={16} />
                Custom Thumbnail (Optional)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleThumbnailUpload}
                style={{ display: 'none' }}
                id="reel-thumbnail-upload"
                disabled={loading}
              />
              <label htmlFor="reel-thumbnail-upload" className="upload-area">
                <div className="upload-icon">
                  <Image size={28} />
                </div>
                <div className="upload-text">
                  {reelThumbnail ? reelThumbnail.name : 'Upload thumbnail (optional)'}
                </div>
                <div className="upload-hint">JPG, PNG up to 5MB</div>
              </label>
            </div>

            <div className="form-group">
              <label className="form-label">
                <Sparkles size={16} />
                Caption
              </label>
              <textarea
                className="form-textarea"
                placeholder="Write a catchy caption for your reel..."
                value={reelCaption}
                onChange={(e) => setReelCaption(e.target.value)}
                rows={4}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Music Track (Optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="Add music name or sound (e.g., 'Original Audio')"
                value={reelMusic}
                onChange={(e) => setReelMusic(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <Sparkles size={16} />
                Category
              </label>
              <div className="category-grid">
                {reelCategories.map(cat => (
                  <button
                    key={cat}
                    className={`category-chip ${reelCategory === cat ? 'active' : ''}`}
                    onClick={() => setReelCategory(cat)}
                    disabled={loading}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="publish-btn-wrapper">
              <button 
                className="publish-btn" 
                onClick={handlePublishReel}
                disabled={loading || !reelVideo || !currentUser}
              >
                {loading ? <><Loader size={18} className="spinner" /> Publishing...</> : 'Publish Reel'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'story' && (
          <div className="create-form">
            <div className="form-group">
              <label className="form-label">
                <BookOpen size={16} />
                Story Title
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="Enter your story title (3-200 characters)..."
                value={storyTitle}
                onChange={(e) => setStoryTitle(e.target.value)}
                disabled={loading}
                maxLength={200}
              />
              <div className="char-count">{storyTitle.length}/200</div>
            </div>

            <div className="form-group">
              <label className="form-label">
                <Sparkles size={16} />
                Category
              </label>
              <div className="category-grid">
                {storyCategories.map(cat => (
                  <button
                    key={cat}
                    className={`category-chip ${storyCategory === cat ? 'active' : ''}`}
                    onClick={() => setStoryCategory(cat)}
                    disabled={loading}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                <Image size={16} />
                Cover Image (Optional)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleCoverUpload}
                style={{ display: 'none' }}
                id="story-cover-upload"
                disabled={loading}
              />
              <label htmlFor="story-cover-upload" className="upload-area">
                <div className="upload-icon">
                  <Image size={28} />
                </div>
                <div className="upload-text">
                  {storyCover ? storyCover.name : 'Upload cover image'}
                </div>
                <div className="upload-hint">JPG, PNG up to 5MB • 16:9 ratio recommended</div>
              </label>
            </div>

            <div className="form-group">
              <label className="form-label">
                <Eye size={16} />
                Story Preview (Free)
              </label>
              <textarea
                className="form-textarea"
                placeholder="Write a preview to hook readers (10-500 characters)..."
                value={storyPreview}
                onChange={(e) => setStoryPreview(e.target.value)}
                rows={4}
                disabled={loading}
                maxLength={500}
              />
              <div className="char-count">{storyPreview.length}/500</div>
            </div>

            <div className="form-group">
              <label className="form-label">
                <Lock size={16} />
                Full Story Content (Locked)
              </label>
              <textarea
                className="form-textarea"
                placeholder="Write your full story here... (This will be locked behind payment)"
                value={storyContent}
                onChange={(e) => setStoryContent(e.target.value)}
                rows={12}
                disabled={loading}
              />
            </div>

            <div className="monetization-section">
              <div className="monetization-header">
                <DollarSign size={22} color="#84cc16" />
                <span className="monetization-title">Monetization Settings</span>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <Lock size={16} />
                  Unlock Price (GT)
                </label>
                <div className="price-grid">
                  {[10, 20, 50, 100].map(price => (
                    <button
                      key={price}
                      className={`price-btn ${unlockPrice === price ? 'active' : ''}`}
                      onClick={() => setUnlockPrice(price)}
                      disabled={loading}
                    >
                      {price} GT
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <Users size={16} />
                  Maximum Accesses
                </label>
                <div className="number-input-group">
                  <button
                    className="number-btn"
                    onClick={() => setMaxAccesses(Math.max(100, maxAccesses - 100))}
                    disabled={loading}
                  >
                    <Minus size={16} />
                  </button>
                  <div className="number-display">{maxAccesses}</div>
                  <button
                    className="number-btn"
                    onClick={() => setMaxAccesses(Math.min(10000, maxAccesses + 100))}
                    disabled={loading}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">Potential Earnings</div>
                  <div className="stat-value">{(unlockPrice * maxAccesses).toLocaleString()} GT</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Per Access</div>
                  <div className="stat-value">{unlockPrice} GT</div>
                </div>
              </div>
            </div>

            <div className="publish-btn-wrapper">
              <button 
                className="publish-btn" 
                onClick={handlePublishStory}
                disabled={loading || !storyTitle.trim() || !storyPreview.trim() || !storyContent.trim() || !currentUser}
              >
                {loading ? <><Loader size={18} className="spinner" /> Publishing...</> : 'Publish Story'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default CreateStudio;