import React, { useState, useEffect, useRef } from "react";
import {
  Upload,
  X,
  Image as ImageIcon,
  Video,
  Play,
  Loader,
  AlertCircle,
} from "lucide-react";

const MediaUploader = ({
  onMediaReady,
  maxItems = 10,
  allowMixed = false,
  defaultType = "mixed",
  showToast,
}) => {
  const [selectedItems, setSelectedItems] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const getAcceptType = () => {
    if (defaultType === "video") return "video/*";
    if (defaultType === "image") return "image/*";
    return "image/*,video/*";
  };

  const getCaptureMode = () => {
    if (defaultType === "video") return "environment";
    return undefined;
  };

  useEffect(() => {
    const handleClear = () => {
      setSelectedItems([]);
    };

    window.addEventListener("clearMediaUploader", handleClear);
    return () => {
      window.removeEventListener("clearMediaUploader", handleClear);
    };
  }, []);

  useEffect(() => {
    if (onMediaReady) {
      onMediaReady({
        items: selectedItems,
        type: selectedItems.length === 1 ? selectedItems[0].type : "mixed",
      });
    }
  }, [selectedItems, onMediaReady]);

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    if (selectedItems.length + files.length > maxItems) {
      showToast?.(
        "warning",
        "Too many files",
        `Maximum ${maxItems} files allowed`,
      );
      return;
    }

    setUploading(true);

    try {
      const processedFiles = await Promise.all(
        files.map(async (file) => {
          const isVideo = file.type.startsWith("video/");
          const isImage = file.type.startsWith("image/");

          if (!isVideo && !isImage) {
            showToast?.(
              "warning",
              "Invalid file",
              "Only images and videos are supported",
            );
            return null;
          }

          // Check file size
          const maxSize = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024; // 100MB for video, 10MB for image
          if (file.size > maxSize) {
            showToast?.(
              "warning",
              "File too large",
              `${isVideo ? "Videos" : "Images"} must be under ${isVideo ? "100MB" : "10MB"}`,
            );
            return null;
          }

          // Create preview
          const preview = await createPreview(file, isVideo);

          return {
            id: Math.random().toString(36).substr(2, 9),
            file,
            type: isVideo ? "video" : "image",
            preview,
            name: file.name,
            size: file.size,
          };
        }),
      );

      const validFiles = processedFiles.filter((f) => f !== null);

      if (!allowMixed && validFiles.length > 0 && selectedItems.length > 0) {
        const existingType = selectedItems[0].type;
        const newType = validFiles[0].type;
        if (existingType !== newType) {
          showToast?.(
            "warning",
            "Mixed media not allowed",
            `Cannot mix ${existingType}s and ${newType}s`,
          );
          return;
        }
      }

      setSelectedItems((prev) => [...prev, ...validFiles]);
      showToast?.(
        "success",
        "Files added",
        `${validFiles.length} file(s) added`,
      );
    } catch (error) {
      console.error("File processing error:", error);
      showToast?.("error", "Upload failed", "Could not process files");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const createPreview = (file, isVideo) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        if (isVideo) {
          const video = document.createElement("video");
          video.src = e.target.result;
          video.addEventListener("loadeddata", () => {
            const canvas = document.createElement("canvas");
            canvas.width = 200;
            canvas.height = 200;
            const ctx = canvas.getContext("2d");

            const scale = Math.min(
              canvas.width / video.videoWidth,
              canvas.height / video.videoHeight,
            );
            const x = (canvas.width - video.videoWidth * scale) / 2;
            const y = (canvas.height - video.videoHeight * scale) / 2;

            ctx.drawImage(
              video,
              x,
              y,
              video.videoWidth * scale,
              video.videoHeight * scale,
            );
            resolve(canvas.toDataURL());
          });
        } else {
          resolve(e.target.result);
        }
      };

      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const removeItem = (id) => {
    setSelectedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="media-uploader">
      <input
        ref={fileInputRef}
        type="file"
        accept={getAcceptType()}
        multiple={maxItems > 1}
        onChange={handleFileSelect}
        style={{ display: "none" }}
        capture={getCaptureMode()}
      />

      {selectedItems.length === 0 ? (
        <div
          className="upload-area"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="upload-icon">
            {uploading ? (
              <Loader size={40} className="spinner" />
            ) : (
              <Upload size={40} />
            )}
          </div>
          <div className="upload-text">
            <p className="upload-title">
              {uploading
                ? "Processing files..."
                : defaultType === "video"
                  ? "Upload or capture video"
                  : defaultType === "image"
                    ? "Upload or capture images"
                    : "Upload images or videos"}
            </p>
            <p className="upload-subtitle">
              {defaultType === "video"
                ? "MP4, MOV up to 100MB"
                : defaultType === "image"
                  ? "JPG, PNG, GIF up to 10MB"
                  : "Images up to 10MB, Videos up to 100MB"}
            </p>
          </div>
        </div>
      ) : (
        <div className="media-grid">
          {selectedItems.map((item) => (
            <div key={item.id} className="media-item">
              <div className="media-preview">
                <img src={item.preview} alt={item.name} />
                {item.type === "video" && (
                  <div className="video-indicator">
                    <Play size={24} />
                  </div>
                )}
              </div>
              <button
                className="remove-media-btn"
                onClick={() => removeItem(item.id)}
              >
                <X size={16} />
              </button>
              <div className="media-info">
                <span className="media-name">{item.name}</span>
                <span className="media-size">{formatFileSize(item.size)}</span>
              </div>
            </div>
          ))}

          {selectedItems.length < maxItems && (
            <div
              className="add-more-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={32} />
              <span>Add more</span>
            </div>
          )}
        </div>
      )}

      {selectedItems.length > 0 && (
        <div className="media-uploader-footer">
          <div className="media-count">
            {selectedItems.length} / {maxItems} files
          </div>
          <button
            className="clear-all-btn"
            onClick={() => setSelectedItems([])}
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
};

export default MediaUploader;
