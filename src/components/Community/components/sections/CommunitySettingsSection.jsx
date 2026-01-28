import React, { useState, useEffect } from "react";
import {
  Save,
  X,
  Lock,
  Globe,
  Eye,
  EyeOff,
  Bell,
  Shield,
  Palette,
  Image,
  Check,
} from "lucide-react";

const CommunitySettingsSection = ({ community, userId, onUpdate, onClose }) => {
  const [settings, setSettings] = useState({
    name: "",
    description: "",
    icon: "",
    isPrivate: false,
    backgroundTheme: "security",
    bannerGradient: "",
  });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const backgroundThemes = [
    {
      id: "security",
      name: "Security",
      preview: "🔒",
      description: "Tech security icons with subtle glow",
      gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    },
    {
      id: "space",
      name: "Space",
      preview: "🌍",
      description: "Cosmic planets and stars",
      gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    },
    {
      id: "neon",
      name: "Neon Emoji",
      preview: "😊",
      description: "Vibrant neon emoji with glow",
      gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    },
    {
      id: "tech",
      name: "Tech",
      preview: "⚛️",
      description: "Technology and science symbols",
      gradient: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
    },
    {
      id: "minimal",
      name: "Minimal",
      preview: "○",
      description: "Clean geometric shapes",
      gradient: "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
    },
    {
      id: "matrix",
      name: "Matrix",
      preview: "λ",
      description: "Digital matrix code style",
      gradient:
        "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
    },
  ];

  const bannerGradients = [
    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
    "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
    "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
    "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
    "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)",
    "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)",
    "linear-gradient(135deg, #ff6e7f 0%, #bfe9ff 100%)",
    "linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)",
    "linear-gradient(135deg, #f77062 0%, #fe5196 100%)",
  ];

  useEffect(() => {
    if (community) {
      setSettings({
        name: community.name || "",
        description: community.description || "",
        icon: community.icon || "🌟",
        isPrivate: community.is_private || false,
        backgroundTheme: community.background_theme || "security",
        bannerGradient:
          community.banner_gradient ||
          "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      });
    }
  }, [community]);

  const handleSave = async () => {
    try {
      setLoading(true);
      await onUpdate(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  const isOwner = community?.owner_id === userId;

  if (!isOwner) {
    return (
      <div className="settings-unauthorized">
        <Shield size={48} color="#666" />
        <h3>Access Denied</h3>
        <p>Only the community owner can modify settings</p>
      </div>
    );
  }

  return (
    <>
      <div className="settings-section">
        <div className="settings-header">
          <h2>Community Settings</h2>
          <p>Customize your community appearance and privacy</p>
        </div>

        <div className="settings-form">
          {/* Basic Info */}
          <div className="setting-group">
            <label className="setting-label">
              <Image size={16} />
              Community Name
            </label>
            <input
              type="text"
              className="setting-input"
              value={settings.name}
              onChange={(e) =>
                setSettings({ ...settings, name: e.target.value })
              }
              placeholder="Enter community name"
              maxLength={100}
            />
            <span className="setting-hint">
              {settings.name.length}/100 characters
            </span>
          </div>

          <div className="setting-group">
            <label className="setting-label">
              <Image size={16} />
              Description
            </label>
            <textarea
              className="setting-textarea"
              value={settings.description}
              onChange={(e) =>
                setSettings({ ...settings, description: e.target.value })
              }
              placeholder="Describe your community..."
              rows={4}
              maxLength={500}
            />
            <span className="setting-hint">
              {settings.description.length}/500 characters
            </span>
          </div>

          <div className="setting-group">
            <label className="setting-label">
              <Palette size={16} />
              Community Icon (Emoji)
            </label>
            <input
              type="text"
              className="setting-input icon-input"
              value={settings.icon}
              onChange={(e) =>
                setSettings({ ...settings, icon: e.target.value })
              }
              placeholder="🌟"
              maxLength={2}
            />
          </div>

          {/* Privacy */}
          <div className="setting-group">
            <label className="setting-label">
              {settings.isPrivate ? <Lock size={16} /> : <Globe size={16} />}
              Privacy
            </label>
            <div className="privacy-toggle">
              <button
                className={`privacy-btn ${!settings.isPrivate ? "active" : ""}`}
                onClick={() => setSettings({ ...settings, isPrivate: false })}
              >
                <Globe size={18} />
                <div>
                  <div className="privacy-title">Public</div>
                  <div className="privacy-desc">Anyone can join</div>
                </div>
              </button>
              <button
                className={`privacy-btn ${settings.isPrivate ? "active" : ""}`}
                onClick={() => setSettings({ ...settings, isPrivate: true })}
              >
                <Lock size={18} />
                <div>
                  <div className="privacy-title">Private</div>
                  <div className="privacy-desc">Invite only</div>
                </div>
              </button>
            </div>
          </div>

          {/* Background Theme */}
          <div className="setting-group">
            <label className="setting-label">
              <Palette size={16} />
              Chat Background Theme
            </label>
            <div className="theme-grid">
              {backgroundThemes.map((theme) => (
                <button
                  key={theme.id}
                  className={`theme-card ${settings.backgroundTheme === theme.id ? "selected" : ""}`}
                  onClick={() =>
                    setSettings({ ...settings, backgroundTheme: theme.id })
                  }
                >
                  <div
                    className="theme-preview"
                    style={{ background: theme.gradient }}
                  >
                    <span className="theme-icon">{theme.preview}</span>
                    {settings.backgroundTheme === theme.id && (
                      <div className="theme-check">
                        <Check size={16} />
                      </div>
                    )}
                  </div>
                  <div className="theme-info">
                    <div className="theme-name">{theme.name}</div>
                    <div className="theme-desc">{theme.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Banner Gradient */}
          <div className="setting-group">
            <label className="setting-label">
              <Palette size={16} />
              Banner Gradient
            </label>
            <div className="gradient-grid">
              {bannerGradients.map((gradient, index) => (
                <button
                  key={index}
                  className={`gradient-option ${settings.bannerGradient === gradient ? "selected" : ""}`}
                  style={{ background: gradient }}
                  onClick={() =>
                    setSettings({ ...settings, bannerGradient: gradient })
                  }
                >
                  {settings.bannerGradient === gradient && (
                    <Check size={18} color="#fff" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <div className="settings-actions">
            <button
              className="save-btn"
              onClick={handleSave}
              disabled={loading || saved}
            >
              {saved ? (
                <>
                  <Check size={18} />
                  Saved!
                </>
              ) : loading ? (
                "Saving..."
              ) : (
                <>
                  <Save size={18} />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .settings-section {
          padding: 0;
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .settings-unauthorized {
          padding: 60px 20px;
          text-align: center;
        }

        .settings-unauthorized h3 {
          font-size: 20px;
          font-weight: 800;
          color: #fff;
          margin: 16px 0 8px 0;
        }

        .settings-unauthorized p {
          color: #999;
          font-size: 14px;
        }

        .settings-header {
          padding: 20px;
          border-bottom: 2px solid rgba(156, 255, 0, 0.1);
          background: linear-gradient(
            180deg,
            rgba(26, 26, 26, 0.6) 0%,
            transparent 100%
          );
        }

        .settings-header h2 {
          font-size: 20px;
          font-weight: 800;
          color: #fff;
          margin-bottom: 4px;
        }

        .settings-header p {
          font-size: 13px;
          color: #999;
        }

        .settings-form {
          padding: 20px;
        }

        .setting-group {
          margin-bottom: 28px;
        }

        .setting-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 700;
          color: #9cff00;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 10px;
        }

        .setting-input,
        .setting-textarea {
          width: 100%;
          padding: 14px 16px;
          background: rgba(26, 26, 26, 0.6);
          border: 2px solid rgba(42, 42, 42, 0.8);
          border-radius: 12px;
          color: #fff;
          font-size: 14px;
          font-family: inherit;
          transition: all 0.3s;
          resize: none;
        }

        .setting-input:focus,
        .setting-textarea:focus {
          outline: none;
          border-color: rgba(156, 255, 0, 0.6);
          background: rgba(26, 26, 26, 0.9);
          box-shadow: 0 0 0 3px rgba(156, 255, 0, 0.1);
        }

        .setting-input.icon-input {
          font-size: 32px;
          text-align: center;
          padding: 20px;
        }

        .setting-hint {
          display: block;
          margin-top: 6px;
          font-size: 11px;
          color: #666;
        }

        .privacy-toggle {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .privacy-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: rgba(26, 26, 26, 0.6);
          border: 2px solid rgba(42, 42, 42, 0.8);
          border-radius: 12px;
          color: #999;
          cursor: pointer;
          transition: all 0.3s;
        }

        .privacy-btn:hover {
          border-color: rgba(156, 255, 0, 0.3);
          background: rgba(26, 26, 26, 0.9);
        }

        .privacy-btn.active {
          border-color: rgba(156, 255, 0, 0.6);
          background: rgba(156, 255, 0, 0.1);
          color: #9cff00;
        }

        .privacy-title {
          font-size: 14px;
          font-weight: 700;
          margin-bottom: 2px;
        }

        .privacy-desc {
          font-size: 11px;
          opacity: 0.7;
        }

        .theme-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .theme-card {
          background: rgba(26, 26, 26, 0.6);
          border: 2px solid rgba(42, 42, 42, 0.8);
          border-radius: 12px;
          padding: 12px;
          cursor: pointer;
          transition: all 0.3s;
          text-align: left;
        }

        .theme-card:hover {
          border-color: rgba(156, 255, 0, 0.3);
          transform: translateY(-2px);
        }

        .theme-card.selected {
          border-color: rgba(156, 255, 0, 0.6);
          background: rgba(156, 255, 0, 0.05);
        }

        .theme-preview {
          width: 100%;
          height: 80px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 10px;
          position: relative;
          overflow: hidden;
        }

        .theme-icon {
          font-size: 32px;
          filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.5));
        }

        .theme-check {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 28px;
          height: 28px;
          background: #9cff00;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #000;
        }

        .theme-info {
          text-align: center;
        }

        .theme-name {
          font-size: 13px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 4px;
        }

        .theme-desc {
          font-size: 11px;
          color: #999;
        }

        .gradient-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }

        .gradient-option {
          height: 60px;
          border-radius: 10px;
          border: 3px solid transparent;
          cursor: pointer;
          transition: all 0.3s;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
        }

        .gradient-option:hover {
          transform: scale(1.05);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        }

        .gradient-option.selected {
          border-color: #9cff00;
          box-shadow: 0 0 0 3px rgba(156, 255, 0, 0.2);
        }

        .settings-actions {
          margin-top: 32px;
          padding-top: 20px;
          border-top: 2px solid rgba(156, 255, 0, 0.1);
        }

        .save-btn {
          width: 100%;
          padding: 16px;
          background: linear-gradient(135deg, #9cff00 0%, #667eea 100%);
          border: none;
          border-radius: 12px;
          color: #000;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          box-shadow: 0 4px 16px rgba(156, 255, 0, 0.3);
        }

        .save-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(156, 255, 0, 0.5);
        }

        .save-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        @media (max-width: 768px) {
          .theme-grid {
            grid-template-columns: 1fr;
          }

          .gradient-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
      `}</style>
    </>
  );
};

export default CommunitySettingsSection;
