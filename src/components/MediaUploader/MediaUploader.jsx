import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Play,
  Pause,
  Scissors,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Check,
  Image as ImageIcon,
  Film,
  Wand2,
  Upload,
  Eye,
} from "lucide-react";
import VideoEditor from "./VideoEditor";
import "./MediaUploader.css";

const MediaUploader = ({
  onMediaReady,
  onPostClick, // NEW: Callback when user wants to post
  maxItems = 10,
  allowMixed = true,
  defaultType = "image",
  showToast,
  layout = "slide",
  gridType = "auto",
}) => {
  const [mediaItems, setMediaItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showAdvancedEditor, setShowAdvancedEditor] = useState(false);
  const [editingVideo, setEditingVideo] = useState(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [isCreatingVideo, setIsCreatingVideo] = useState(false);
  const [creationProgress, setCreationProgress] = useState(0);
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const [previewingVideo, setPreviewingVideo] = useState(null);

  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const previewVideoRef = useRef(null);

  const videoTemplates = [
    { id: "fade", name: "Fade", icon: "🌫️" },
    { id: "slide-left", name: "Slide Left", icon: "←" },
    { id: "slide-right", name: "Slide Right", icon: "→" },
    { id: "slide-up", name: "Slide Up", icon: "↑" },
    { id: "slide-down", name: "Slide Down", icon: "↓" },
    { id: "zoom-in", name: "Zoom In", icon: "🔍" },
    { id: "zoom-out", name: "Zoom Out", icon: "🔎" },
    { id: "pan-left", name: "Pan Left", icon: "⬅️" },
    { id: "pan-right", name: "Pan Right", icon: "➡️" },
    { id: "rotate", name: "Rotate", icon: "🔄" },
    { id: "blur-focus", name: "Blur Focus", icon: "💫" },
    { id: "ken-burns", name: "Ken Burns", icon: "✨" },
  ];

  useEffect(() => {
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
    setShowAdvancedEditor(false);
    if (imageInputRef.current) imageInputRef.current.value = "";
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  const handleFileSelect = async (e, fileType) => {
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
          const video = document.createElement("video");
          video.src = item.preview;
          await new Promise((resolve) => {
            video.onloadedmetadata = () => {
              item.duration = video.duration;
              item.width = video.videoWidth;
              item.height = video.videoHeight;

              video.currentTime = 1;
              video.onseeked = () => {
                const canvas = document.createElement("canvas");
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                canvas.getContext("2d").drawImage(video, 0, 0);
                canvas.toBlob((blob) => {
                  item.thumbnail = URL.createObjectURL(blob);
                  resolve();
                });
              };
            };
          });
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
    if (selectedItem?.id === itemId) {
      setSelectedItem(null);
      setShowAdvancedEditor(false);
    }
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

  const swapItems = (index1, index2) => {
    const newItems = [...mediaItems];
    [newItems[index1], newItems[index2]] = [newItems[index2], newItems[index1]];
    setMediaItems(newItems);
  };

  const openAdvancedEditor = (item) => {
    setEditingVideo(item);
    setShowAdvancedEditor(true);
  };

  const handleAdvancedEditorSave = (editedFile) => {
    const newPreview = URL.createObjectURL(editedFile);

    setMediaItems((prev) =>
      prev.map((item) =>
        item.id === editingVideo.id
          ? {
              ...item,
              file: editedFile,
              preview: newPreview,
              name: editedFile.name,
            }
          : item,
      ),
    );

    if (editingVideo.preview) URL.revokeObjectURL(editingVideo.preview);

    setShowAdvancedEditor(false);
    setEditingVideo(null);
    showToast?.("success", "Video updated", "Edited video saved");
  };

  const openTemplateSelector = () => {
    const images = mediaItems.filter((item) => item.type === "image");
    if (images.length < 2) {
      showToast?.(
        "warning",
        "Need more images",
        "Upload 2+ images to create video",
      );
      return;
    }
    setShowTemplateModal(true);
  };

  const createVideoFromImages = async (templateId) => {
    setIsCreatingVideo(true);
    setCreationProgress(0);
    setShowTemplateModal(false);

    try {
      const images = mediaItems.filter((item) => item.type === "image");
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      canvas.width = 1080;
      canvas.height = 1920;

      const fps = 30;
      const imageDuration = 1.5;
      const transitionDuration = 0.5;
      const framesPerImage = Math.floor(imageDuration * fps);
      const transitionFrames = Math.floor(transitionDuration * fps);

      const stream = canvas.captureStream(fps);
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9",
        videoBitsPerSecond: 5000000,
      });

      const chunks = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);

      const videoBlob = await new Promise(async (resolve) => {
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: "video/webm" });
          resolve(blob);
        };

        mediaRecorder.start();

        const loadedImages = await Promise.all(
          images.map((item) => {
            return new Promise((res) => {
              const img = new Image();
              img.onload = () => res(img);
              img.src = item.preview;
            });
          }),
        );

        let totalFrames = 0;
        for (let i = 0; i < loadedImages.length; i++) {
          const img = loadedImages[i];
          const nextImg = loadedImages[i + 1];

          for (let frame = 0; frame < framesPerImage; frame++) {
            const progress = frame / framesPerImage;

            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            applyTemplate(
              ctx,
              img,
              progress,
              templateId,
              canvas.width,
              canvas.height,
            );

            totalFrames++;
            setCreationProgress(
              Math.floor(
                (totalFrames / (loadedImages.length * framesPerImage)) * 90,
              ),
            );

            await new Promise((resolve) => setTimeout(resolve, 1000 / fps));
          }

          if (nextImg) {
            for (let frame = 0; frame < transitionFrames; frame++) {
              const progress = frame / transitionFrames;

              ctx.fillStyle = "#000";
              ctx.fillRect(0, 0, canvas.width, canvas.height);

              ctx.globalAlpha = 1 - progress;
              applyTemplate(
                ctx,
                img,
                1,
                templateId,
                canvas.width,
                canvas.height,
              );

              ctx.globalAlpha = progress;
              applyTemplate(
                ctx,
                nextImg,
                0,
                templateId,
                canvas.width,
                canvas.height,
              );

              ctx.globalAlpha = 1;

              await new Promise((resolve) => setTimeout(resolve, 1000 / fps));
            }
          }
        }

        await addGrovaWatermark(ctx, canvas.width, canvas.height, fps);
        setCreationProgress(100);

        mediaRecorder.stop();
      });

      const videoFile = new File(
        [videoBlob],
        `grova_video_${Date.now()}.webm`,
        {
          type: "video/webm",
        },
      );

      const videoURL = URL.createObjectURL(videoBlob);

      const newVideoItem = {
        id: Date.now(),
        file: videoFile,
        type: "video",
        preview: videoURL,
        name: videoFile.name,
        duration: images.length * imageDuration + 2,
        width: canvas.width,
        height: canvas.height,
      };

      setMediaItems((prev) => [...prev, newVideoItem]);
      showToast?.("success", "Video created! 🎬", "Your video is ready");
    } catch (error) {
      console.error("Video creation failed:", error);
      showToast?.("error", "Creation failed", error.message);
    } finally {
      setIsCreatingVideo(false);
      setCreationProgress(0);
    }
  };

  const applyTemplate = (ctx, img, progress, templateId, width, height) => {
    const scale = Math.min(width / img.width, height / img.height);
    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;
    const x = (width - scaledWidth) / 2;
    const y = (height - scaledHeight) / 2;

    ctx.save();

    switch (templateId) {
      case "fade":
        ctx.globalAlpha = progress;
        ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
        break;

      case "slide-left":
        ctx.translate(width * (1 - progress), 0);
        ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
        break;

      case "slide-right":
        ctx.translate(-width * (1 - progress), 0);
        ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
        break;

      case "slide-up":
        ctx.translate(0, height * (1 - progress));
        ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
        break;

      case "slide-down":
        ctx.translate(0, -height * (1 - progress));
        ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
        break;

      case "zoom-in":
        const zoomScale = 0.5 + 0.5 * progress;
        ctx.translate(width / 2, height / 2);
        ctx.scale(zoomScale, zoomScale);
        ctx.translate(-width / 2, -height / 2);
        ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
        break;

      case "zoom-out":
        const zoomOutScale = 1.5 - 0.5 * progress;
        ctx.translate(width / 2, height / 2);
        ctx.scale(zoomOutScale, zoomOutScale);
        ctx.translate(-width / 2, -height / 2);
        ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
        break;

      case "pan-left":
        ctx.translate(width * 0.2 * progress, 0);
        ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
        break;

      case "pan-right":
        ctx.translate(-width * 0.2 * progress, 0);
        ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
        break;

      case "rotate":
        ctx.translate(width / 2, height / 2);
        ctx.rotate((Math.PI * 2 * progress) / 4);
        ctx.translate(-width / 2, -height / 2);
        ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
        break;

      case "blur-focus":
        const blurAmount = 10 * (1 - progress * 2);
        if (blurAmount > 0) {
          ctx.filter = `blur(${blurAmount}px)`;
        }
        ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
        ctx.filter = "none";
        break;

      case "ken-burns":
        const kbScale = 1 + 0.2 * progress;
        const kbX = x - scaledWidth * 0.1 * progress;
        const kbY = y - scaledHeight * 0.1 * progress;
        ctx.drawImage(
          img,
          kbX,
          kbY,
          scaledWidth * kbScale,
          scaledHeight * kbScale,
        );
        break;

      default:
        ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
    }

    ctx.restore();
  };

  const addGrovaWatermark = async (ctx, width, height, fps) => {
    const watermarkDuration = 2;
    const totalFrames = fps * watermarkDuration;
    const fadeInFrames = Math.floor(fps * 0.3);

    for (let frame = 0; frame < totalFrames; frame++) {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, width, height);

      if (frame < fadeInFrames) {
        ctx.globalAlpha = frame / fadeInFrames;
      } else {
        ctx.globalAlpha = 1;
      }

      ctx.font = "bold 120px Arial";
      ctx.fillStyle = "#84cc16";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = 20;
      ctx.fillText("GROVA", width / 2, height / 2);

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      await new Promise((resolve) => setTimeout(resolve, 1000 / fps));
    }
  };

  const handleVideoPreview = (item) => {
    setPreviewingVideo(item);
    setShowVideoPreview(true);
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getAcceptType = (type) => {
    if (type === "video") return "video/*";
    if (type === "image") return "image/*";
    return "image/*,video/*";
  };

  const images = mediaItems.filter((item) => item.type === "image");
  const videos = mediaItems.filter((item) => item.type === "video");
  const canCreateVideo = images.length >= 2;
  const canPost = mediaItems.length > 0;

  return (
    <div className="media-uploader">
      <div className="uploader-header">
        <div className="upload-actions">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple={maxItems > 1}
            onChange={(e) => handleFileSelect(e, "image")}
            style={{ display: "none" }}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            multiple={maxItems > 1}
            onChange={(e) => handleFileSelect(e, "video")}
            style={{ display: "none" }}
          />

          <button
            className="upload-btn image-upload"
            onClick={() => imageInputRef.current?.click()}
            disabled={mediaItems.length >= maxItems}
          >
            <ImageIcon size={18} />
            <span>Upload Images</span>
          </button>

          <button
            className="upload-btn video-upload"
            onClick={() => videoInputRef.current?.click()}
            disabled={mediaItems.length >= maxItems}
          >
            <Film size={18} />
            <span>Upload Video</span>
          </button>
        </div>

        {canCreateVideo && (
          <button
            className="create-video-btn-compact"
            onClick={openTemplateSelector}
            disabled={isCreatingVideo}
          >
            <Wand2 size={18} />
            Create Video
          </button>
        )}
      </div>

      {isCreatingVideo && (
        <div className="creation-progress-compact">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${creationProgress}%` }}
            />
          </div>
          <span className="progress-text">{creationProgress}%</span>
        </div>
      )}

      {mediaItems.length > 0 && (
        <>
          <div className="media-grid">
            {mediaItems.map((item, index) => (
              <div
                key={item.id}
                className="media-card"
                draggable
                onDragStart={(e) => e.dataTransfer.setData("index", index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const fromIndex = parseInt(e.dataTransfer.getData("index"));
                  swapItems(fromIndex, index);
                }}
              >
                <div className="media-preview">
                  {item.type === "video" ? (
                    <>
                      <img
                        src={item.thumbnail || item.preview}
                        alt={item.name}
                        className="preview-image"
                      />
                      <button
                        className="video-play-btn"
                        onClick={() => handleVideoPreview(item)}
                      >
                        <Play size={28} />
                      </button>
                      <div className="video-badge">
                        <Film size={14} />
                        <span>{formatTime(item.duration)}</span>
                      </div>
                    </>
                  ) : (
                    <img
                      src={item.preview}
                      alt={item.name}
                      className="preview-image"
                    />
                  )}

                  <button
                    className="media-remove-btn"
                    onClick={() => removeItem(item.id)}
                  >
                    <X size={14} />
                  </button>

                  {item.type === "video" && (
                    <button
                      className="media-edit-btn"
                      onClick={() => openAdvancedEditor(item)}
                    >
                      <Scissors size={14} />
                    </button>
                  )}
                </div>

                <div className="media-actions">
                  <button
                    className="move-btn"
                    onClick={() => moveItem(index, "left")}
                    disabled={index === 0}
                  >
                    <ChevronLeft size={14} />
                  </button>

                  <span className="item-number">{index + 1}</span>

                  <button
                    className="move-btn"
                    onClick={() => moveItem(index, "right")}
                    disabled={index === mediaItems.length - 1}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {canPost && onPostClick && (
            <button className="post-now-btn" onClick={onPostClick}>
              <Check size={18} />
              Continue to Post
            </button>
          )}
        </>
      )}

      {showTemplateModal && (
        <div
          className="template-modal-overlay"
          onClick={() => setShowTemplateModal(false)}
        >
          <div
            className="template-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="template-modal-header">
              <h3>Choose Template</h3>
              <button onClick={() => setShowTemplateModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="template-grid">
              {videoTemplates.map((template) => (
                <button
                  key={template.id}
                  className="template-option"
                  onClick={() => createVideoFromImages(template.id)}
                >
                  <span className="template-icon">{template.icon}</span>
                  <span className="template-name">{template.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showVideoPreview && previewingVideo && (
        <div
          className="video-preview-modal"
          onClick={() => setShowVideoPreview(false)}
        >
          <div
            className="video-preview-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="preview-close-btn"
              onClick={() => setShowVideoPreview(false)}
            >
              <X size={24} />
            </button>
            <video
              ref={previewVideoRef}
              src={previewingVideo.preview}
              controls
              autoPlay
              className="preview-video-player"
            />
          </div>
        </div>
      )}

      {showAdvancedEditor && editingVideo && (
        <VideoEditor
          videoFile={editingVideo.file}
          onSave={handleAdvancedEditorSave}
          onClose={() => {
            setShowAdvancedEditor(false);
            setEditingVideo(null);
          }}
          onPost={onPostClick} // NEW: Pass post callback to editor
        />
      )}
    </div>
  );
};

export default MediaUploader;
