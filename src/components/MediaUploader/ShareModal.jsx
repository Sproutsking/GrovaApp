import React, { useState } from "react";
import {
  X,
  Download,
  Share2,
  Facebook,
  Instagram,
  Twitter,
  Link,
  Check,
} from "lucide-react";
import "./ShareModal.css";

const ShareModal = ({ videoFile, onClose, onDownload }) => {
  const [copied, setCopied] = useState(false);
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const shareOptions = [
    {
      id: "download",
      name: "Download Video",
      icon: <Download size={24} />,
      color: "#84cc16",
      action: () => {
        if (onDownload) onDownload();
        const url = URL.createObjectURL(videoFile);
        const a = document.createElement("a");
        a.href = url;
        a.download = videoFile.name || "grova_video.webm";
        a.click();
        URL.revokeObjectURL(url);
      },
    },
    {
      id: "copy-link",
      name: "Copy Link",
      icon: <Link size={24} />,
      color: "#6366f1",
      action: async () => {
        try {
          const url = URL.createObjectURL(videoFile);
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch (err) {
          console.error("Failed to copy:", err);
        }
      },
    },
    {
      id: "facebook",
      name: "Facebook",
      icon: <Facebook size={24} />,
      color: "#1877f2",
      action: () => {
        window.open("https://www.facebook.com/sharer/sharer.php", "_blank");
      },
    },
    {
      id: "instagram",
      name: "Instagram",
      icon: <Instagram size={24} />,
      color: "#e4405f",
      action: () => {
        alert("Please download and share to Instagram app");
      },
    },
    {
      id: "twitter",
      name: "Twitter/X",
      icon: <Twitter size={24} />,
      color: "#1da1f2",
      action: () => {
        window.open("https://twitter.com/intent/tweet", "_blank");
      },
    },
  ];

  const handleTouchStart = (e) => {
    setStartY(e.touches[0].clientY);
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const deltaY = e.touches[0].clientY - startY;
    if (deltaY > 0) {
      setCurrentY(deltaY);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (currentY > 150) {
      onClose();
    }
    setCurrentY(0);
  };

  return (
    <>
      <div className="share-modal-overlay" onClick={onClose} />
      <div
        className="share-modal-content"
        style={{
          transform: `translateY(${currentY}px)`,
          transition: isDragging ? "none" : "transform 0.3s ease",
        }}
      >
        <div
          className="share-modal-handle"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="share-modal-knob" />
        </div>

        <div className="share-modal-header">
          <h3>Share Video</h3>
          <button className="share-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="share-options-grid">
          {shareOptions.map((option) => (
            <button
              key={option.id}
              className="share-option"
              onClick={option.action}
              style={{ "--option-color": option.color }}
            >
              <div
                className="share-option-icon"
                style={{ background: option.color }}
              >
                {option.id === "copy-link" && copied ? (
                  <Check size={24} />
                ) : (
                  option.icon
                )}
              </div>
              <span className="share-option-name">
                {option.id === "copy-link" && copied ? "Copied!" : option.name}
              </span>
            </button>
          ))}
        </div>

        <div className="share-modal-footer">
          <p className="share-watermark-notice">
            <span>🌟</span> All shared videos include Grova branding
          </p>
        </div>
      </div>
    </>
  );
};

export default ShareModal;
