import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Play,
  Pause,
  Scissors,
  Layers,
  Wand2,
  Image as ImageIcon,
  Film,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Download,
  Music,
  Volume2,
  VolumeX,
  Sparkles,
  Zap,
  Clock,
  Type,
  Palette,
  Filter,
  RotateCw,
  Crop,
  Sliders,
} from "lucide-react";
import videoEditorService from "../../services/media/videoEditorService";
import "./MediaUploader.css";

const MediaUploader = ({
  onMediaReady,
  maxItems = 10,
  allowMixed = true,
  defaultType = "image",
  showToast,
}) => {
  const [mediaItems, setMediaItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("fade");
  const [processing, setProcessing] = useState(false);
  const [editorTab, setEditorTab] = useState("template");
  const [videoSettings, setVideoSettings] = useState({
    duration: 3,
    transition: "fade",
    aspectRatio: "16:9",
    fps: 30,
    quality: "high",
  });
  const [audioSettings, setAudioSettings] = useState({
    music: null,
    volume: 70,
    fadeIn: true,
    fadeOut: true,
  });
  const [textOverlays, setTextOverlays] = useState([]);
  const [filters, setFilters] = useState({
    brightness: 100,
    contrast: 100,
    saturation: 100,
    blur: 0,
  });
  const [selectedEffect, setSelectedEffect] = useState("none");

  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const audioInputRef = useRef(null);

  const templates = [
    {
      id: "fade",
      name: "Smooth Fade",
      icon: "✨",
      desc: "Classic fade transitions",
      transition: "fade",
      duration: 3,
    },
    {
      id: "slide",
      name: "Slide Show",
      icon: "➡️",
      desc: "Sliding transitions",
      transition: "slide",
      duration: 2.5,
    },
    {
      id: "zoom",
      name: "Ken Burns",
      icon: "🔍",
      desc: "Zoom & pan effect",
      transition: "zoom",
      duration: 4,
    },
    {
      id: "flip",
      name: "Flip Cards",
      icon: "🔄",
      desc: "3D flip transitions",
      transition: "flip",
      duration: 2,
    },
    {
      id: "wipe",
      name: "Wipe",
      icon: "↔️",
      desc: "Directional wipes",
      transition: "wipe",
      duration: 2,
    },
    {
      id: "dissolve",
      name: "Dissolve",
      icon: "💫",
      desc: "Smooth dissolve",
      transition: "dissolve",
      duration: 3,
    },
    {
      id: "bounce",
      name: "Bounce",
      icon: "⚡",
      desc: "Energetic bounce",
      transition: "bounce",
      duration: 1.5,
    },
    {
      id: "glitch",
      name: "Glitch",
      icon: "📺",
      desc: "Modern glitch effect",
      transition: "glitch",
      duration: 2,
    },
  ];

  const effects = [
    { id: "none", name: "None", icon: "⭕" },
    { id: "vintage", name: "Vintage", icon: "📷" },
    { id: "cinematic", name: "Cinematic", icon: "🎬" },
    { id: "bw", name: "Black & White", icon: "⚫" },
    { id: "sepia", name: "Sepia", icon: "🟤" },
    { id: "vhs", name: "VHS", icon: "📼" },
    { id: "neon", name: "Neon", icon: "💡" },
    { id: "warm", name: "Warm", icon: "🔥" },
    { id: "cool", name: "Cool", icon: "❄️" },
    { id: "dramatic", name: "Dramatic", icon: "⚡" },
  ];

  const aspectRatios = [
    { id: "16:9", name: "Landscape", desc: "YouTube, TV" },
    { id: "9:16", name: "Portrait", desc: "Stories, Reels" },
    { id: "1:1", name: "Square", desc: "Instagram" },
    { id: "4:5", name: "Portrait+", desc: "Feed posts" },
    { id: "21:9", name: "Cinematic", desc: "Ultra-wide" },
  ];

  useEffect(() => {
    // Listen for clear event
    const handleClear = () => {
      clearAll();
    };
    window.addEventListener("clearMediaUploader", handleClear);

    return () => {
      window.removeEventListener("clearMediaUploader", handleClear);
      mediaItems.forEach((item) => {
        if (item.preview) URL.revokeObjectURL(item.preview);
      });
    };
  }, [mediaItems]);

  useEffect(() => {
    if (onMediaReady) {
      onMediaReady({
        items: mediaItems,
        type: mediaItems.length === 1 ? mediaItems[0].type : "mixed",
      });
    }
  }, [mediaItems]);

  const clearAll = () => {
    mediaItems.forEach((item) => {
      if (item.preview) URL.revokeObjectURL(item.preview);
      if (item.thumbnail) URL.revokeObjectURL(item.thumbnail);
    });
    setMediaItems([]);
    setSelectedItem(null);
    setShowEditor(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);

    if (mediaItems.length + files.length > maxItems) {
      showToast?.(
        "warning",
        "Too many items",
        `Maximum ${maxItems} items allowed`,
      );
      return;
    }

    const newItems = [];

    for (const file of files) {
      const isVideo = file.type.startsWith("video/");
      const isImage = file.type.startsWith("image/");

      if (!isVideo && !isImage) continue;

      if (isVideo && file.size > 100 * 1024 * 1024) {
        showToast?.("warning", "File too large", "Videos must be under 100MB");
        continue;
      }

      if (isImage && file.size > 10 * 1024 * 1024) {
        showToast?.("warning", "File too large", "Images must be under 10MB");
        continue;
      }

      const item = {
        id: Date.now() + Math.random(),
        file: file,
        type: isVideo ? "video" : "image",
        preview: URL.createObjectURL(file),
        name: file.name,
      };

      if (isVideo) {
        try {
          const metadata = await videoEditorService.generateVideoPreview(file);
          item.duration = metadata.duration;
          item.thumbnail = URL.createObjectURL(metadata.thumbnail);
          item.width = metadata.width;
          item.height = metadata.height;
        } catch (err) {
          console.error("Failed to generate preview:", err);
        }
      }

      newItems.push(item);
    }

    setMediaItems((prev) => [...prev, ...newItems]);
    showToast?.("success", "Files added", `${newItems.length} file(s) ready`);
  };

  const removeItem = (itemId) => {
    setMediaItems((prev) => {
      const item = prev.find((i) => i.id === itemId);
      if (item?.preview) URL.revokeObjectURL(item.preview);
      if (item?.thumbnail) URL.revokeObjectURL(item.thumbnail);
      return prev.filter((i) => i.id !== itemId);
    });
    if (selectedItem?.id === itemId) setSelectedItem(null);
  };

  const moveItem = (index, direction) => {
    const newItems = [...mediaItems];
    const newIndex = direction === "left" ? index - 1 : index + 1;

    if (newIndex < 0 || newIndex >= newItems.length) return;

    [newItems[index], newItems[newIndex]] = [
      newItems[newIndex],
      newItems[index],
    ];
    setMediaItems(newItems);
  };

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template.id);
    setVideoSettings((prev) => ({
      ...prev,
      transition: template.transition,
      duration: template.duration,
    }));
  };

  const handleAudioUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith("audio/")) {
        showToast?.("warning", "Invalid file", "Please select an audio file");
        return;
      }
      setAudioSettings((prev) => ({
        ...prev,
        music: file,
      }));
      showToast?.("success", "Music added", file.name);
    }
  };

  const addTextOverlay = () => {
    const newOverlay = {
      id: Date.now(),
      text: "Add your text",
      position: "center",
      fontSize: 32,
      color: "#ffffff",
      background: "rgba(0,0,0,0.5)",
      animation: "fade",
      startTime: 0,
      endTime: videoSettings.duration,
    };
    setTextOverlays((prev) => [...prev, newOverlay]);
  };

  const removeTextOverlay = (id) => {
    setTextOverlays((prev) => prev.filter((overlay) => overlay.id !== id));
  };

  const updateTextOverlay = (id, updates) => {
    setTextOverlays((prev) =>
      prev.map((overlay) =>
        overlay.id === id ? { ...overlay, ...updates } : overlay,
      ),
    );
  };

  const handleCreateVideo = async () => {
    if (mediaItems.length === 0) {
      showToast?.("warning", "No media", "Add images or videos first");
      return;
    }

    try {
      setProcessing(true);
      showToast?.("info", "Processing", "Creating your masterpiece...");

      const images = mediaItems
        .filter((i) => i.type === "image")
        .map((i) => i.file);
      const videos = mediaItems
        .filter((i) => i.type === "video")
        .map((i) => i.file);

      const config = {
        template: selectedTemplate,
        transition: videoSettings.transition,
        duration: videoSettings.duration,
        aspectRatio: videoSettings.aspectRatio,
        fps: videoSettings.fps,
        quality: videoSettings.quality,
        audio: audioSettings.music,
        audioVolume: audioSettings.volume / 100,
        audioFadeIn: audioSettings.fadeIn,
        audioFadeOut: audioSettings.fadeOut,
        textOverlays: textOverlays,
        filters: filters,
        effect: selectedEffect,
      };

      let result;

      if (images.length > 0 && videos.length === 0) {
        result = await videoEditorService.createVideoFromImages(images, config);
      } else if (videos.length > 0 && images.length === 0) {
        result = await videoEditorService.mergeVideos(videos, config);
      } else {
        const mixedItems = mediaItems.map((item) => ({
          file: item.file,
          type: item.type,
        }));
        result = await videoEditorService.createMixedMedia(mixedItems, config);
      }

      showToast?.("success", "Video ready! 🎉", "Your masterpiece is complete");

      if (onMediaReady) {
        onMediaReady({
          type: "video",
          url: result.url,
          duration: result.duration,
          items: mediaItems,
        });
      }

      setShowEditor(false);
    } catch (err) {
      console.error("Failed to create video:", err);
      showToast?.("error", "Processing failed", err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleDone = () => {
    if (mediaItems.length === 0) {
      showToast?.("warning", "No media", "Please add some files first");
      return;
    }

    if (onMediaReady) {
      onMediaReady({
        items: mediaItems,
        type: mediaItems.every((i) => i.type === "image")
          ? "images"
          : mediaItems.every((i) => i.type === "video")
            ? "videos"
            : "mixed",
      });
    }
  };

  return (
    <div className="media-uploader">
      <div className="uploader-header">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleFileSelect}
          style={{ display: "none" }}
        />

        <button
          className="add-media-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={mediaItems.length >= maxItems}
        >
          <Plus size={20} />
          Add Media ({mediaItems.length}/{maxItems})
        </button>

        {mediaItems.length > 1 && (
          <button
            className="create-video-btn"
            onClick={() => setShowEditor(true)}
          >
            <Wand2 size={20} />
            Create Video
          </button>
        )}

        {mediaItems.length > 0 && (
          <button className="done-btn" onClick={handleDone}>
            Done
          </button>
        )}
      </div>

      {mediaItems.length === 0 ? (
        <div
          className="empty-state"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="empty-icon">
            {allowMixed ? (
              <Layers size={48} />
            ) : defaultType === "video" ? (
              <Film size={48} />
            ) : (
              <ImageIcon size={48} />
            )}
          </div>
          <p className="empty-title">Add your media</p>
          <p className="empty-subtitle">
            {allowMixed
              ? "Images and videos"
              : defaultType === "video"
                ? "Videos only"
                : "Images only"}
          </p>
        </div>
      ) : (
        <div className="media-grid">
          {mediaItems.map((item, index) => (
            <div key={item.id} className="media-card">
              <div
                className="media-preview"
                onClick={() => setSelectedItem(item)}
              >
                {item.type === "video" ? (
                  <>
                    <video
                      src={item.preview}
                      poster={item.thumbnail}
                      className="preview-video"
                    />
                    <div className="video-overlay">
                      <Play size={32} />
                      <span className="duration">
                        {Math.floor(item.duration / 60)}:
                        {String(Math.floor(item.duration % 60)).padStart(
                          2,
                          "0",
                        )}
                      </span>
                    </div>
                  </>
                ) : (
                  <img
                    src={item.preview}
                    alt={item.name}
                    className="preview-image"
                  />
                )}
              </div>

              <div className="media-actions">
                <button
                  className="move-btn"
                  onClick={() => moveItem(index, "left")}
                  disabled={index === 0}
                >
                  <ChevronLeft size={16} />
                </button>

                <span className="item-number">{index + 1}</span>

                <button
                  className="move-btn"
                  onClick={() => moveItem(index, "right")}
                  disabled={index === mediaItems.length - 1}
                >
                  <ChevronRight size={16} />
                </button>

                <button
                  className="remove-btn"
                  onClick={() => removeItem(item.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Advanced Video Editor Modal */}
      {showEditor && (
        <div className="editor-modal">
          <div className="editor-content">
            <div className="editor-header">
              <h3>
                <Sparkles size={24} />
                Video Studio
              </h3>
              <button
                className="modal-close"
                onClick={() => setShowEditor(false)}
              >
                <X size={24} />
              </button>
            </div>

            {/* Editor Tabs */}
            <div className="editor-tabs">
              <button
                className={`editor-tab ${editorTab === "template" ? "active" : ""}`}
                onClick={() => setEditorTab("template")}
              >
                <Wand2 size={18} />
                Templates
              </button>
              <button
                className={`editor-tab ${editorTab === "audio" ? "active" : ""}`}
                onClick={() => setEditorTab("audio")}
              >
                <Music size={18} />
                Audio
              </button>
              <button
                className={`editor-tab ${editorTab === "text" ? "active" : ""}`}
                onClick={() => setEditorTab("text")}
              >
                <Type size={18} />
                Text
              </button>
              <button
                className={`editor-tab ${editorTab === "effects" ? "active" : ""}`}
                onClick={() => setEditorTab("effects")}
              >
                <Filter size={18} />
                Effects
              </button>
              <button
                className={`editor-tab ${editorTab === "settings" ? "active" : ""}`}
                onClick={() => setEditorTab("settings")}
              >
                <Sliders size={18} />
                Settings
              </button>
            </div>

            <div className="editor-body">
              {/* Template Tab */}
              {editorTab === "template" && (
                <div className="templates-section">
                  <h4>Choose Your Style</h4>
                  <div className="templates-grid">
                    {templates.map((template) => (
                      <button
                        key={template.id}
                        className={`template-card ${selectedTemplate === template.id ? "active" : ""}`}
                        onClick={() => handleTemplateSelect(template)}
                      >
                        <span className="template-icon">{template.icon}</span>
                        <span className="template-name">{template.name}</span>
                        <span className="template-desc">{template.desc}</span>
                      </button>
                    ))}
                  </div>

                  <div className="aspect-ratio-section">
                    <h4>Aspect Ratio</h4>
                    <div className="aspect-ratio-grid">
                      {aspectRatios.map((ratio) => (
                        <button
                          key={ratio.id}
                          className={`aspect-btn ${videoSettings.aspectRatio === ratio.id ? "active" : ""}`}
                          onClick={() =>
                            setVideoSettings((prev) => ({
                              ...prev,
                              aspectRatio: ratio.id,
                            }))
                          }
                        >
                          <span className="aspect-name">{ratio.name}</span>
                          <span className="aspect-ratio">{ratio.id}</span>
                          <span className="aspect-desc">{ratio.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Audio Tab */}
              {editorTab === "audio" && (
                <div className="audio-section">
                  <h4>Add Music</h4>
                  <input
                    ref={audioInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={handleAudioUpload}
                    style={{ display: "none" }}
                  />
                  <button
                    className="upload-audio-btn"
                    onClick={() => audioInputRef.current?.click()}
                  >
                    <Music size={20} />
                    {audioSettings.music
                      ? audioSettings.music.name
                      : "Upload Music"}
                  </button>

                  {audioSettings.music && (
                    <>
                      <div className="audio-control">
                        <label>
                          <Volume2 size={18} />
                          Volume: {audioSettings.volume}%
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={audioSettings.volume}
                          onChange={(e) =>
                            setAudioSettings((prev) => ({
                              ...prev,
                              volume: parseInt(e.target.value),
                            }))
                          }
                          className="volume-slider"
                        />
                      </div>

                      <div className="audio-options">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={audioSettings.fadeIn}
                            onChange={(e) =>
                              setAudioSettings((prev) => ({
                                ...prev,
                                fadeIn: e.target.checked,
                              }))
                            }
                          />
                          <span>Fade In</span>
                        </label>
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={audioSettings.fadeOut}
                            onChange={(e) =>
                              setAudioSettings((prev) => ({
                                ...prev,
                                fadeOut: e.target.checked,
                              }))
                            }
                          />
                          <span>Fade Out</span>
                        </label>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Text Tab */}
              {editorTab === "text" && (
                <div className="text-section">
                  <div className="text-header">
                    <h4>Text Overlays</h4>
                    <button className="add-text-btn" onClick={addTextOverlay}>
                      <Plus size={18} />
                      Add Text
                    </button>
                  </div>

                  {textOverlays.length === 0 ? (
                    <div className="empty-text">
                      <Type size={48} />
                      <p>No text overlays yet</p>
                      <small>Click "Add Text" to get started</small>
                    </div>
                  ) : (
                    <div className="text-overlays-list">
                      {textOverlays.map((overlay) => (
                        <div key={overlay.id} className="text-overlay-item">
                          <input
                            type="text"
                            value={overlay.text}
                            onChange={(e) =>
                              updateTextOverlay(overlay.id, {
                                text: e.target.value,
                              })
                            }
                            className="text-input"
                            placeholder="Enter text..."
                          />
                          <div className="text-controls">
                            <select
                              value={overlay.position}
                              onChange={(e) =>
                                updateTextOverlay(overlay.id, {
                                  position: e.target.value,
                                })
                              }
                              className="text-position"
                            >
                              <option value="top">Top</option>
                              <option value="center">Center</option>
                              <option value="bottom">Bottom</option>
                            </select>
                            <input
                              type="color"
                              value={overlay.color}
                              onChange={(e) =>
                                updateTextOverlay(overlay.id, {
                                  color: e.target.value,
                                })
                              }
                              className="color-picker"
                            />
                            <button
                              className="remove-text-btn"
                              onClick={() => removeTextOverlay(overlay.id)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Effects Tab */}
              {editorTab === "effects" && (
                <div className="effects-section">
                  <h4>Visual Effects</h4>
                  <div className="effects-grid">
                    {effects.map((effect) => (
                      <button
                        key={effect.id}
                        className={`effect-card ${selectedEffect === effect.id ? "active" : ""}`}
                        onClick={() => setSelectedEffect(effect.id)}
                      >
                        <span className="effect-icon">{effect.icon}</span>
                        <span className="effect-name">{effect.name}</span>
                      </button>
                    ))}
                  </div>

                  <div className="filters-section">
                    <h4>Filters</h4>
                    {Object.keys(filters).map((filter) => (
                      <div key={filter} className="filter-control">
                        <label>
                          {filter.charAt(0).toUpperCase() + filter.slice(1)}:{" "}
                          {filters[filter]}
                          {filter !== "blur" && "%"}
                        </label>
                        <input
                          type="range"
                          min={filter === "blur" ? 0 : 0}
                          max={filter === "blur" ? 10 : 200}
                          value={filters[filter]}
                          onChange={(e) =>
                            setFilters((prev) => ({
                              ...prev,
                              [filter]: parseInt(e.target.value),
                            }))
                          }
                          className="filter-slider"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Settings Tab */}
              {editorTab === "settings" && (
                <div className="settings-section">
                  <h4>Video Settings</h4>

                  <div className="setting-control">
                    <label>
                      <Clock size={18} />
                      Image Duration: {videoSettings.duration}s
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="0.5"
                      value={videoSettings.duration}
                      onChange={(e) =>
                        setVideoSettings((prev) => ({
                          ...prev,
                          duration: parseFloat(e.target.value),
                        }))
                      }
                      className="duration-slider"
                    />
                  </div>

                  <div className="setting-control">
                    <label>Frame Rate (FPS)</label>
                    <select
                      value={videoSettings.fps}
                      onChange={(e) =>
                        setVideoSettings((prev) => ({
                          ...prev,
                          fps: parseInt(e.target.value),
                        }))
                      }
                      className="fps-select"
                    >
                      <option value="24">24 FPS (Cinematic)</option>
                      <option value="30">30 FPS (Standard)</option>
                      <option value="60">60 FPS (Smooth)</option>
                    </select>
                  </div>

                  <div className="setting-control">
                    <label>Quality</label>
                    <select
                      value={videoSettings.quality}
                      onChange={(e) =>
                        setVideoSettings((prev) => ({
                          ...prev,
                          quality: e.target.value,
                        }))
                      }
                      className="quality-select"
                    >
                      <option value="low">Low (720p)</option>
                      <option value="medium">Medium (1080p)</option>
                      <option value="high">High (1080p+)</option>
                      <option value="ultra">Ultra (4K)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Preview Section */}
            <div className="editor-preview">
              <h4>
                <Film size={18} />
                Preview ({mediaItems.length} items)
              </h4>
              <div className="preview-timeline">
                {mediaItems.map((item, index) => (
                  <div key={item.id} className="timeline-item">
                    <div className="timeline-thumb">
                      {item.type === "video" ? (
                        <Film size={16} />
                      ) : (
                        <ImageIcon size={16} />
                      )}
                    </div>
                    <span className="timeline-number">{index + 1}</span>
                  </div>
                ))}
              </div>
              <div className="preview-info">
                <span>
                  Total Duration: ~
                  {Math.ceil(
                    mediaItems.filter((i) => i.type === "image").length *
                      videoSettings.duration,
                  )}
                  s
                </span>
                <span>Format: {videoSettings.aspectRatio}</span>
                <span>Quality: {videoSettings.quality}</span>
              </div>
            </div>

            {/* Editor Actions */}
            <div className="editor-actions">
              <button
                className="cancel-btn"
                onClick={() => setShowEditor(false)}
                disabled={processing}
              >
                Cancel
              </button>
              <button
                className="create-btn"
                onClick={handleCreateVideo}
                disabled={processing}
              >
                {processing ? (
                  <>
                    <Zap size={18} className="spinner" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    Create Video
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MediaUploader;
