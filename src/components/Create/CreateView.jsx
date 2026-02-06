import React, { useState, useEffect, useRef } from "react";
import {
  Image,
  Film,
  BookOpen,
  Sparkles,
  DollarSign,
  Users,
  Plus,
  Minus,
  Loader,
  Infinity,
  Palette,
  Save,
  FileText,
  CheckCircle,
  Eye,
  Lock,
} from "lucide-react";
import createService from "../../services/create/createService";
import authService from "../../services/auth/authService";
import securityService from "../../services/security/SecurityService";
import draftsService from "../../services/drafts/draftsService";
import MediaUploader from "../MediaUploader/MediaUploader";
import Drafts from "../Drafts/Drafts";

const CreateStudio = ({ onPublishSuccess, showToast, onClose }) => {
  const [activeTab, setActiveTab] = useState("post");
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [showDrafts, setShowDrafts] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState(null);
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);

  const autoSaveTimer = useRef(null);

  const [postContent, setPostContent] = useState("");
  const [postMedia, setPostMedia] = useState([]);
  const [postCategory, setPostCategory] = useState("General");

  const [reelCaption, setReelCaption] = useState("");
  const [reelMedia, setReelMedia] = useState(null);
  const [reelMusic, setReelMusic] = useState("");
  const [reelCategory, setReelCategory] = useState("Entertainment");

  const [storyTitle, setStoryTitle] = useState("");
  const [storyCategory, setStoryCategory] = useState("Folklore");
  const [storyContent, setStoryContent] = useState("");
  const [storyPreview, setStoryPreview] = useState("");
  const [unlockPrice, setUnlockPrice] = useState(10);
  const [maxAccesses, setMaxAccesses] = useState(1000);
  const [isUnlimitedAccess, setIsUnlimitedAccess] = useState(false);
  const [storyCover, setStoryCover] = useState(null);
  const [titleColor, setTitleColor] = useState("#ffffff");
  const [textColor, setTextColor] = useState("#d4d4d4");

  const postCategories = [
    "General",
    "Technology",
    "Art",
    "Music",
    "Photography",
    "Lifestyle",
    "Food",
    "Travel",
    "Blockchain",
    "Crypto",
    "NFTs",
    "Web3",
    "DeFi",
    "Business",
    "Finance",
    "Health",
    "Fitness",
    "Fashion",
    "Gaming",
    "Sports",
    "Education",
    "Science",
    "Nature",
    "Entertainment",
    "News",
    "Comedy",
    "Beauty",
    "DIY",
    "Parenting",
    "Pets",
    "Politics",
    "Real Estate",
    "Sustainability",
    "Spirituality",
    "Automotive",
    "Books",
    "Movies",
  ];

  const reelCategories = [
    "Entertainment",
    "Comedy",
    "Education",
    "Music",
    "Dance",
    "Fashion",
    "Fitness",
    "Gaming",
    "Crypto News",
    "Tech Reviews",
    "Tutorials",
    "Vlogs",
    "Travel",
    "Food",
    "Sports",
    "Art & Design",
    "Blockchain",
    "NFT Showcase",
    "Web3",
    "Lifestyle",
    "Beauty",
    "DIY",
    "Challenges",
    "Pranks",
    "Animals",
    "Nature",
    "Science",
    "ASMR",
    "Magic",
    "Dance Covers",
  ];

  const storyCategories = [
    "Folklore",
    "Life Journey",
    "Philosophy",
    "Innovation",
    "Romance",
    "Adventure",
    "Mystery",
    "Wisdom",
    "Crypto Stories",
    "Blockchain Tales",
    "Tech Fiction",
    "Entrepreneurship",
    "Success Stories",
    "Historical",
    "Fantasy",
    "Thriller",
    "Horror",
    "Biography",
    "Memoir",
    "Self-Help",
    "Poetry",
    "Drama",
    "Comedy",
    "Satire",
    "Dystopian",
    "Utopian",
  ];

  const titleColors = [
    { name: "White", value: "#ffffff" },
    { name: "Green", value: "#84cc16" },
    { name: "Lime", value: "#bef264" },
    { name: "Gold", value: "#fbbf24" },
    { name: "Amber", value: "#f59e0b" },
    { name: "Orange", value: "#f97316" },
    { name: "Red", value: "#ef4444" },
    { name: "Rose", value: "#f43f5e" },
    { name: "Pink", value: "#ec4899" },
  ];

  const textColors = [
    { name: "Light Gray", value: "#d4d4d4" },
    { name: "White", value: "#ffffff" },
    { name: "Gray", value: "#a3a3a3" },
    { name: "Slate", value: "#94a3b8" },
    { name: "Light Green", value: "#bef264" },
    { name: "Light Lime", value: "#d9f99d" },
    { name: "Light Yellow", value: "#fde047" },
    { name: "Light Amber", value: "#fcd34d" },
    { name: "Light Orange", value: "#fdba74" },
  ];

  useEffect(() => {
    loadUser();
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, []);

  useEffect(() => {
    const hasContent =
      (activeTab === "post" && (postContent.trim() || postMedia.length > 0)) ||
      (activeTab === "reel" && (reelCaption.trim() || reelMedia)) ||
      (activeTab === "story" &&
        (storyTitle.trim() || storyPreview.trim() || storyContent.trim()));

    setHasUnsavedChanges(hasContent);

    if (hasContent && currentUser) {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => {
        handleAutoSave();
      }, 5000);
    }
  }, [
    activeTab,
    postContent,
    postMedia,
    reelCaption,
    reelMedia,
    storyTitle,
    storyPreview,
    storyContent,
    postCategory,
    reelMusic,
    reelCategory,
    storyCategory,
    unlockPrice,
    maxAccesses,
    isUnlimitedAccess,
    titleColor,
    textColor,
    currentUser,
  ]);

  const loadUser = async () => {
    try {
      const user = await authService.getCurrentUser();
      if (user) {
        setCurrentUser(user);
        const profile = await authService.getUserProfile(user.id);
        setUserProfile(profile);
      }
    } catch (err) {
      console.error("Failed to load user:", err);
    }
  };

  const handleAutoSave = async () => {
    if (!hasUnsavedChanges || !currentUser) return;

    try {
      setAutoSaving(true);

      const draftData = {
        contentType: activeTab,
        title: getDraftTitle(),
      };

      if (currentDraftId) draftData.draftId = currentDraftId;

      if (activeTab === "post") {
        draftData.content = postContent;
        draftData.category = postCategory;
      } else if (activeTab === "reel") {
        draftData.caption = reelCaption;
        draftData.music = reelMusic;
        draftData.category = reelCategory;
      } else if (activeTab === "story") {
        draftData.storyTitle = storyTitle;
        draftData.preview = storyPreview;
        draftData.content = storyContent;
        draftData.category = storyCategory;
        draftData.unlockCost = unlockPrice;
        draftData.maxAccesses = isUnlimitedAccess ? 999999 : maxAccesses;
        draftData.titleColor = titleColor;
        draftData.textColor = textColor;
      }

      const savedDraft = await draftsService.saveDraft(
        draftData,
        currentUser.id,
      );
      setCurrentDraftId(savedDraft.id);
      setLastSaved(new Date());
    } catch (err) {
      console.error("Auto-save failed:", err);
    } finally {
      setAutoSaving(false);
    }
  };

  const handleManualSave = async () => {
    if (!hasUnsavedChanges) {
      showToast?.("info", "Nothing to save", "No changes detected");
      return;
    }

    if (!currentUser) {
      showToast?.("error", "Not logged in", "Please log in to save drafts");
      return;
    }

    try {
      setAutoSaving(true);
      await handleAutoSave();
      showToast?.("success", "Draft saved! ✅", "Your work is safe");
    } catch (err) {
      showToast?.("error", "Save failed", "Could not save draft");
    } finally {
      setAutoSaving(false);
    }
  };

  const getDraftTitle = () => {
    if (activeTab === "story" && storyTitle) return storyTitle;
    if (activeTab === "reel" && reelCaption)
      return reelCaption.substring(0, 50) || "Untitled Reel";
    if (activeTab === "post" && postContent)
      return postContent.substring(0, 50) || "Untitled Post";
    return `Untitled ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`;
  };

  const handlePostMediaReady = (mediaData) => setPostMedia(mediaData.items);
  const handleReelMediaReady = (mediaData) => {
    if (mediaData.type === "video") {
      setReelMedia({
        type: "created",
        url: mediaData.url,
        duration: mediaData.duration,
      });
    } else if (mediaData.items?.length > 0) {
      setReelMedia({ type: "items", items: mediaData.items });
    }
  };

  const clearForm = () => {
    if (activeTab === "post") {
      setPostContent("");
      setPostMedia([]);
      setPostCategory("General");
    } else if (activeTab === "reel") {
      setReelCaption("");
      setReelMedia(null);
      setReelMusic("");
      setReelCategory("Entertainment");
    } else if (activeTab === "story") {
      setStoryTitle("");
      setStoryCategory("Folklore");
      setStoryContent("");
      setStoryPreview("");
      setUnlockPrice(10);
      setMaxAccesses(1000);
      setIsUnlimitedAccess(false);
      setStoryCover(null);
      setTitleColor("#ffffff");
      setTextColor("#d4d4d4");
    }
    setHasUnsavedChanges(false);
    setCurrentDraftId(null);
    setLastSaved(null);
    window.dispatchEvent(new CustomEvent("clearMediaUploader"));
  };

  const handleTabChange = (newTab) => {
    if (hasUnsavedChanges) {
      setPendingNavigation(() => () => {
        clearForm();
        setActiveTab(newTab);
      });
      setShowExitDialog(true);
    } else {
      clearForm();
      setActiveTab(newTab);
    }
  };

  const handlePublishPost = async () => {
    try {
      setLoading(true);
      if (securityService?.updateActivity) securityService.updateActivity();
      if (!currentUser || !userProfile)
        throw new Error("Please complete your profile setup");
      if (!postContent.trim() && postMedia.length === 0)
        throw new Error("Post must have content or media");

      const images = postMedia
        .filter((m) => m.type === "image")
        .map((m) => m.file);
      const videos = postMedia
        .filter((m) => m.type === "video")
        .map((m) => m.file);

      const newPost = await createService.createPost(
        { content: postContent.trim(), images, videos, category: postCategory },
        currentUser.id,
      );
      if (currentDraftId)
        await draftsService.deleteDraft(currentDraftId, currentUser.id);
      clearForm();
      showToast?.("success", "Post published! 🎉", "Your post is now live");
      if (onPublishSuccess) onPublishSuccess(newPost, "post");
    } catch (err) {
      console.error("Failed to publish post:", err);
      showToast?.(
        "error",
        "Publishing failed",
        err.message || "Failed to publish post",
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePublishReel = async () => {
    try {
      setLoading(true);
      setUploadProgress(0);
      if (securityService?.updateActivity) securityService.updateActivity();
      if (!currentUser || !userProfile)
        throw new Error("Please complete your profile setup");
      if (!reelMedia) throw new Error("Video is required");

      let videoToUpload;
      if (reelMedia.type === "created") {
        videoToUpload = reelMedia.url;
      } else if (reelMedia.items?.length === 1) {
        videoToUpload = reelMedia.items[0].file;
      } else {
        throw new Error("Please create a video from your media first");
      }

      const newReel = await createService.createReel(
        {
          video: videoToUpload,
          caption: reelCaption.trim(),
          music: reelMusic.trim() || "Original Audio",
          category: reelCategory,
        },
        currentUser.id,
        (progress) => setUploadProgress(progress),
      );
      if (currentDraftId)
        await draftsService.deleteDraft(currentDraftId, currentUser.id);
      clearForm();
      setUploadProgress(0);
      showToast?.("success", "Reel published! 🎬", "Your reel is now live");
      if (onPublishSuccess) onPublishSuccess(newReel, "reel");
    } catch (err) {
      console.error("Failed to publish reel:", err);
      showToast?.(
        "error",
        "Publishing failed",
        err.message || "Failed to publish reel",
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePublishStory = async () => {
    try {
      setLoading(true);
      if (securityService?.updateActivity) securityService.updateActivity();
      if (!currentUser || !userProfile)
        throw new Error("Please complete your profile setup");
      if (!storyTitle.trim()) throw new Error("Story title is required");
      if (storyTitle.trim().length < 3 || storyTitle.trim().length > 200)
        throw new Error("Story title must be between 3 and 200 characters");
      if (!storyPreview.trim()) throw new Error("Story preview is required");
      if (storyPreview.trim().length < 10 || storyPreview.trim().length > 500)
        throw new Error("Story preview must be between 10 and 500 characters");
      if (!storyContent.trim()) throw new Error("Story content is required");

      const finalMaxAccesses = isUnlimitedAccess ? 999999 : maxAccesses;

      const newStory = await createService.createStory(
        {
          title: storyTitle.trim(),
          preview: storyPreview.trim(),
          fullContent: storyContent.trim(),
          coverImage: storyCover,
          category: storyCategory,
          unlockCost: unlockPrice,
          maxAccesses: finalMaxAccesses,
          titleColor,
          textColor,
        },
        currentUser.id,
      );
      if (currentDraftId)
        await draftsService.deleteDraft(currentDraftId, currentUser.id);
      clearForm();

      const potentialEarnings =
        unlockPrice === 0
          ? "Free Story"
          : isUnlimitedAccess
            ? "Unlimited earnings!"
            : `${(unlockPrice * finalMaxAccesses).toLocaleString()} GT`;
      showToast?.(
        "success",
        "Story published! 💰",
        `Potential: ${potentialEarnings}`,
      );
      if (onPublishSuccess) onPublishSuccess(newStory, "story");
    } catch (err) {
      console.error("Failed to publish story:", err);
      showToast?.(
        "error",
        "Publishing failed",
        err.message || "Failed to publish story",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCoverUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast?.(
          "warning",
          "Cover too large",
          "Cover image must be less than 5MB",
        );
        return;
      }
      setStoryCover(file);
      showToast?.("info", "Cover image selected", file.name);
    }
  };

  const handleSaveDraft = async () => {
    try {
      setAutoSaving(true);
      await handleAutoSave();
      setShowExitDialog(false);
      showToast?.("success", "Draft saved", "Your work has been saved");
      if (pendingNavigation) {
        pendingNavigation();
        setPendingNavigation(null);
      }
    } catch (err) {
      console.error("Failed to save draft:", err);
      showToast?.("error", "Save failed", "Could not save draft");
    } finally {
      setAutoSaving(false);
    }
  };

  const handleDiscardDraft = async () => {
    if (currentDraftId) {
      try {
        await draftsService.deleteDraft(currentDraftId, currentUser.id);
      } catch (err) {
        console.error("Failed to delete draft:", err);
      }
    }
    clearForm();
    setShowExitDialog(false);
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
  };

  const handleLoadDraft = (draft) => {
    setActiveTab(draft.content_type);
    setCurrentDraftId(draft.id);

    if (draft.content_type === "post") {
      setPostContent(draft.post_content || "");
      setPostCategory(draft.post_category || "General");
    } else if (draft.content_type === "reel") {
      setReelCaption(draft.reel_caption || "");
      setReelMusic(draft.reel_music || "");
      setReelCategory(draft.reel_category || "Entertainment");
    } else if (draft.content_type === "story") {
      setStoryTitle(draft.story_title || "");
      setStoryPreview(draft.story_preview || "");
      setStoryContent(draft.story_content || "");
      setStoryCategory(draft.story_category || "Folklore");
      setUnlockPrice(draft.story_unlock_cost || 10);
      setMaxAccesses(draft.story_max_accesses || 1000);
      setIsUnlimitedAccess(draft.story_max_accesses >= 999999);
      setTitleColor(draft.story_title_color || "#ffffff");
      setTextColor(draft.story_text_color || "#d4d4d4");
    }

    setShowDrafts(false);
    setHasUnsavedChanges(true);
    setLastSaved(new Date(draft.updated_at));
    showToast?.("success", "Draft loaded", "Continue editing your content");
  };

  const formatLastSaved = () => {
    if (!lastSaved) return null;
    const now = new Date();
    const diffMs = now - lastSaved;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Saved just now";
    if (diffMins === 1) return "Saved 1 minute ago";
    if (diffMins < 60) return `Saved ${diffMins} minutes ago`;
    return `Saved at ${lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  };

  return (
    <>
      <div className="create-studio-wrapper">
        <div className="studio-header">
          <h1 className="studio-title">Creator Studio</h1>
          <p className="studio-subtitle">
            Share your creativity, earn Grova Tokens
          </p>

          <div className="studio-header-actions">
            <button
              className="save-draft-btn"
              onClick={handleManualSave}
              disabled={!hasUnsavedChanges || autoSaving}
              title="Save as draft"
            >
              {autoSaving ? (
                <>
                  <Loader size={18} className="spinner" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save size={18} />
                  <span>Save Draft</span>
                </>
              )}
            </button>

            <button
              className="drafts-btn"
              onClick={() => setShowDrafts(true)}
              title="View drafts"
            >
              <FileText size={18} />
              <span>My Drafts</span>
            </button>
          </div>

          {lastSaved && !autoSaving && (
            <div className="auto-save-status">
              <CheckCircle size={14} />
              <span>{formatLastSaved()}</span>
            </div>
          )}
        </div>

        {uploadProgress > 0 && uploadProgress < 100 && (
          <div className="upload-progress-bar">
            <div
              className="upload-progress-fill"
              style={{ width: `${uploadProgress}%` }}
            ></div>
            <span className="upload-progress-text">
              {Math.round(uploadProgress)}%
            </span>
          </div>
        )}

        <div className="content-tabs">
          <button
            className={`content-tab ${activeTab === "post" ? "active" : ""}`}
            onClick={() => handleTabChange("post")}
          >
            <Image size={18} /> Post
          </button>
          <button
            className={`content-tab ${activeTab === "reel" ? "active" : ""}`}
            onClick={() => handleTabChange("reel")}
          >
            <Film size={18} /> Reel
          </button>
          <button
            className={`content-tab ${activeTab === "story" ? "active" : ""}`}
            onClick={() => handleTabChange("story")}
          >
            <BookOpen size={18} /> Story
          </button>
        </div>

        {activeTab === "post" && (
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
                rows={5}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <Image size={16} />
                Media (Images & Videos)
              </label>
              <MediaUploader
                onMediaReady={handlePostMediaReady}
                maxItems={10}
                allowMixed={true}
                defaultType="mixed"
                showToast={showToast}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <Sparkles size={16} />
                Category
              </label>
              <select
                className="category-select"
                value={postCategory}
                onChange={(e) => setPostCategory(e.target.value)}
                disabled={loading}
              >
                {postCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="publish-btn-wrapper">
              <button
                className="publish-btn"
                onClick={handlePublishPost}
                disabled={
                  loading ||
                  (!postContent.trim() && postMedia.length === 0) ||
                  !currentUser
                }
              >
                {loading ? (
                  <>
                    <Loader size={18} className="spinner" /> Publishing...
                  </>
                ) : (
                  "Publish Post"
                )}
              </button>
            </div>
          </div>
        )}

        {activeTab === "reel" && (
          <div className="create-form">
            <div className="form-group">
              <label className="form-label">
                <Film size={16} />
                Create Your Reel
              </label>
              <MediaUploader
                onMediaReady={handleReelMediaReady}
                maxItems={10}
                allowMixed={true}
                defaultType="video"
                showToast={showToast}
              />
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
                rows={3}
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
              <select
                className="category-select"
                value={reelCategory}
                onChange={(e) => setReelCategory(e.target.value)}
                disabled={loading}
              >
                {reelCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="publish-btn-wrapper">
              <button
                className="publish-btn"
                onClick={handlePublishReel}
                disabled={loading || !reelMedia || !currentUser}
              >
                {loading ? (
                  <>
                    <Loader size={18} className="spinner" /> Publishing...
                  </>
                ) : (
                  "Publish Reel"
                )}
              </button>
            </div>
          </div>
        )}

        {activeTab === "story" && (
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
              <select
                className="category-select"
                value={storyCategory}
                onChange={(e) => setStoryCategory(e.target.value)}
                disabled={loading}
              >
                {storyCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
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
                style={{ display: "none" }}
                id="story-cover-upload"
                disabled={loading}
              />
              <label
                htmlFor="story-cover-upload"
                className="upload-area-compact"
              >
                <Image size={20} />
                <span>{storyCover ? storyCover.name : "Upload cover"}</span>
                <small>JPG, PNG up to 5MB</small>
              </label>
            </div>

            <div className="customization-section">
              <div className="customization-header">
                <Palette size={18} />
                <span>Customization</span>
              </div>
              <div className="color-picker-row">
                <div className="color-picker-group">
                  <label className="color-label">Title Color</label>
                  <div className="color-options">
                    {titleColors.map((color) => (
                      <button
                        key={color.value}
                        className={`color-btn ${titleColor === color.value ? "active" : ""}`}
                        style={{ background: color.value }}
                        onClick={() => setTitleColor(color.value)}
                        title={color.name}
                        disabled={loading}
                      />
                    ))}
                  </div>
                </div>

                <div className="color-picker-group">
                  <label className="color-label">Text Color</label>
                  <div className="color-options">
                    {textColors.map((color) => (
                      <button
                        key={color.value}
                        className={`color-btn ${textColor === color.value ? "active" : ""}`}
                        style={{ background: color.value }}
                        onClick={() => setTextColor(color.value)}
                        title={color.name}
                        disabled={loading}
                      />
                    ))}
                  </div>
                </div>
              </div>
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
                rows={3}
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
                placeholder="Write your full story here..."
                value={storyContent}
                onChange={(e) => setStoryContent(e.target.value)}
                rows={10}
                disabled={loading}
              />
            </div>

            <div className="monetization-section">
              <div className="monetization-header">
                <DollarSign size={20} color="#84cc16" />
                <span>Monetization</span>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <Lock size={16} />
                  Unlock Price (GT)
                </label>
                <div className="price-grid">
                  <button
                    className={`price-btn ${unlockPrice === 0 ? "active" : ""}`}
                    onClick={() => setUnlockPrice(0)}
                    disabled={loading}
                  >
                    Free
                  </button>
                  {[10, 20, 50, 100].map((price) => (
                    <button
                      key={price}
                      className={`price-btn ${unlockPrice === price ? "active" : ""}`}
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
                <div className="access-control-row">
                  <div className="number-input-group">
                    <button
                      className="number-btn"
                      onClick={() =>
                        setMaxAccesses(Math.max(100, maxAccesses - 100))
                      }
                      disabled={loading || isUnlimitedAccess}
                    >
                      <Minus size={16} />
                    </button>
                    <div className="number-display">
                      {isUnlimitedAccess ? "∞" : maxAccesses}
                    </div>
                    <button
                      className="number-btn"
                      onClick={() =>
                        setMaxAccesses(Math.min(10000, maxAccesses + 100))
                      }
                      disabled={loading || isUnlimitedAccess}
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  <button
                    className={`unlimited-btn ${isUnlimitedAccess ? "active" : ""}`}
                    onClick={() => setIsUnlimitedAccess(!isUnlimitedAccess)}
                    disabled={loading}
                  >
                    <Infinity size={18} />
                    Unlimited
                  </button>
                </div>
              </div>

              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">Potential Earnings</div>
                  <div className="stat-value">
                    {unlockPrice === 0
                      ? "Free"
                      : isUnlimitedAccess
                        ? "∞ GT"
                        : `${(unlockPrice * maxAccesses).toLocaleString()} GT`}
                  </div>
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
                disabled={
                  loading ||
                  !storyTitle.trim() ||
                  !storyPreview.trim() ||
                  !storyContent.trim() ||
                  !currentUser
                }
              >
                {loading ? (
                  <>
                    <Loader size={18} className="spinner" /> Publishing...
                  </>
                ) : (
                  "Publish Story"
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {showDrafts && (
        <Drafts
          onLoadDraft={handleLoadDraft}
          onClose={() => setShowDrafts(false)}
          showToast={showToast}
        />
      )}

      {showExitDialog && (
        <div className="exit-dialog-overlay">
          <div className="exit-dialog">
            <h3>Save your work?</h3>
            <p>
              You have unsaved changes. Would you like to save them as a draft?
            </p>
            <div className="exit-dialog-actions">
              <button
                className="dialog-btn save-btn"
                onClick={handleSaveDraft}
                disabled={autoSaving}
              >
                {autoSaving ? (
                  <>
                    <Loader size={18} className="spinner" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    Save Draft
                  </>
                )}
              </button>
              <button
                className="dialog-btn discard-btn"
                onClick={handleDiscardDraft}
                disabled={autoSaving}
              >
                Discard
              </button>
              <button
                className="dialog-btn cancel-btn"
                onClick={() => setShowExitDialog(false)}
                disabled={autoSaving}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CreateStudio;
