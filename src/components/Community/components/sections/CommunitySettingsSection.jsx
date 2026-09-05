import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
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
  Upload,
  Wrench,
  Sparkles,
} from "lucide-react";
import { supabase } from "../../../../services/config/supabase";
import EmojiPanel from "../EmojiPanel";
import { CHANNEL_BUTTON_STYLES, CHANNEL_DIVIDER_STYLES } from "../../utils/channelStyles";
import { CATEGORY_FOLDER_STYLES } from "../../utils/CategoryGroup";

const CommunitySettingsSection = ({ community, userId, channels = [], onUpdate, onClose }) => {
  const [settings, setSettings] = useState({
    name: "",
    description: "",
    icon: "",
    isPrivate: false,
    backgroundTheme: "security",
    bannerGradient: "",
    iconBorder: "default",
    channelAppearance: { buttonStyle: "fill-rounded", dividerStyle: "none", folderStyle: "simple" },
  });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [iconFile, setIconFile] = useState(null);
  const [iconPreview, setIconPreview] = useState(null);
  const [error, setError] = useState("");
  const [tools, setTools] = useState([]);
  const [selectedToolType, setSelectedToolType] = useState(null);
  const [selectedToolMode, setSelectedToolMode] = useState(null);
  const fileInputRef = useRef(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

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

  const toolCatalog = {
    verification: {
      label: "Verification",
      modes: [
        { id: "rules_gate", label: "Rules gate", description: "Members must confirm the community rules before access." },
        { id: "custom_message", label: "Custom message", description: "Show a custom verification note to new members." },
      ],
    },
    social_updates: {
      label: "Social updates",
      modes: [
        { id: "news_feed", label: "News feed", description: "Broadcast updates and announcements in one place." },
        { id: "brand_broadcast", label: "Brand broadcast", description: "Push official creator and brand updates through the channel." },
      ],
    },
    tickets: {
      label: "Tickets",
      modes: [
        { id: "support_queue", label: "Support queue", description: "Create a support ticket thread for member requests." },
        { id: "private_inbox", label: "Private inbox", description: "Route member issues into a private support channel." },
      ],
    },
  };

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
        iconBorder: community.icon_border || "default",
        channelAppearance: {
          buttonStyle: community.settings?.channel_appearance?.buttonStyle || "fill-rounded",
          dividerStyle: community.settings?.channel_appearance?.dividerStyle || "none",
          folderStyle: community.settings?.channel_appearance?.folderStyle || "simple",
        },
      });
      setIconPreview(community.icon?.startsWith("http") ? community.icon : null);
      setIconFile(null);
    }
  }, [community]);

  useEffect(() => {
    if (!community?.id) return;
    supabase.from("community_tool_settings").select("*").eq("community_id", community.id)
      .then(({ data }) => setTools(data || []));
  }, [community?.id]);

  const handleIconChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5 MB");
      return;
    }
    setError("");
    setIconFile(file);
    setIconPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError("");
      const payload = { ...settings, iconFile };
      payload.settings = {
        ...(community.settings || {}),
        channel_appearance: settings.channelAppearance,
      };
      await onUpdate(payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error("Error saving settings:", error);
      setError(error.message || "Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  const isOwner = community?.owner_id === userId;

  const updateTool = async (tool, patch) => {
    const next = { ...tool, ...patch };
    setTools((current) => current.some((item) => item.tool_type === tool.tool_type)
      ? current.map((item) => item.tool_type === tool.tool_type ? next : item)
      : [...current, next]);
    const { error: toolError } = await supabase.from("community_tool_settings").upsert({
      community_id: community.id,
      tool_type: tool.tool_type,
      enabled: next.enabled,
      channel_id: next.channel_id || null,
      config: next.config || {},
      updated_by: userId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "community_id,tool_type" });
    if (toolError) {
      setError(toolError.message);
      setTools((current) => current.map((item) => item.tool_type === tool.tool_type ? tool : item));
    }
    if (next.channel_id) {
      await supabase.from("community_channels")
        .update({ tool_type: next.enabled ? tool.tool_type : null, updated_at: new Date().toISOString() })
        .eq("id", next.channel_id);
    }
    onUpdate?.({ type: "tool", tool: next });
  };

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
          <div className="setting-group">
            <label className="setting-label"><Palette size={16} /> Channel appearance</label>
            <p className="setting-hint">Choose the visual language for channel buttons, icon dividers, and category folders.</p>
            <div className="appearance-setting-block">
              <strong>Channel button</strong>
              <div className="border-options">{CHANNEL_BUTTON_STYLES.map((style) => <button type="button" key={style.id} className={`border-option ${settings.channelAppearance.buttonStyle === style.id ? "selected" : ""}`} onClick={() => setSettings((current) => ({ ...current, channelAppearance: { ...current.channelAppearance, buttonStyle: style.id } }))}>{style.label}</button>)}</div>
              <strong>Icon / text divider</strong>
              <div className="border-options">{CHANNEL_DIVIDER_STYLES.map((style) => <button type="button" key={style.id} className={`border-option ${settings.channelAppearance.dividerStyle === style.id ? "selected" : ""}`} onClick={() => setSettings((current) => ({ ...current, channelAppearance: { ...current.channelAppearance, dividerStyle: style.id } }))}>{style.label}</button>)}</div>
              <strong>Category folder</strong>
              <div className="border-options">{CATEGORY_FOLDER_STYLES.map((style) => <button type="button" key={style.id} className={`border-option ${settings.channelAppearance.folderStyle === style.id ? "selected" : ""}`} onClick={() => setSettings((current) => ({ ...current, channelAppearance: { ...current.channelAppearance, folderStyle: style.id } }))}>{style.label}</button>)}</div>
            </div>
          </div>

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
              Community Image
            </label>
            <div className="icon-editor">
              <div className="icon-preview" style={{ background: settings.bannerGradient }}>
                {iconPreview ? <img src={iconPreview} alt="Community preview" /> : <span>{settings.icon || "🌟"}</span>}
              </div>
              <div className="icon-editor-actions">
                <button type="button" className="upload-image-btn" onClick={() => fileInputRef.current?.click()}>
                  <Upload size={15} /> Choose image
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleIconChange} hidden />
                <input
                  type="text"
                  className="setting-input icon-input"
                  value={settings.icon}
                  onChange={(e) => setSettings({ ...settings, icon: e.target.value })}
                  placeholder="Or use an emoji"
                  maxLength={2}
                />
                <button type="button" className="pick-emoji-btn" onClick={() => setShowEmojiPicker((open) => !open)}>
                  <Sparkles size={14} /> Pick emoji
                </button>
                {showEmojiPicker && ReactDOM.createPortal(
                  <div className="community-emoji-picker">
                    <EmojiPanel onSelect={(emoji) => { setSettings((current) => ({ ...current, icon: emoji })); setIconPreview(null); setShowEmojiPicker(false); }} onClose={() => setShowEmojiPicker(false)} />
                  </div>, document.body
                )}
              </div>
            </div>
            <span className="setting-hint">PNG, JPG, GIF up to 5 MB</span>
          </div>

          <div className="setting-group">
            <label className="setting-label">
              <Palette size={16} />
              Image Border
            </label>
            <div className="border-options">
              {["default", "lime", "glass", "dashed", "none"].map((border) => (
                <button
                  type="button"
                  key={border}
                  className={`border-option ${settings.iconBorder === border ? "selected" : ""} border-${border}`}
                  onClick={() => setSettings({ ...settings, iconBorder: border })}
                >
                  {border}
                </button>
              ))}
            </div>
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

          {error && <div className="settings-error">{error}</div>}

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

        .tools-group {
          margin: -20px -20px 28px;
          padding: 20px;
          border-bottom: 1px solid rgba(156, 255, 0, 0.2);
        }

        .tool-row {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 0;
          border-top: 1px solid rgba(255, 255, 255, 0.07);
        }

        .tool-main-button {
          width: 100%;
          border: 1px solid rgba(156, 255, 0, 0.18);
          background: rgba(13, 17, 12, 0.75);
          border-radius: 10px;
          color: #f3f5f0;
          padding: 12px 14px;
          font: inherit;
          text-align: left;
          cursor: pointer;
        }

        .tool-title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          font-size: 13px;
          font-weight: 700;
        }

        .tool-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 58px;
          padding: 4px 8px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .tool-badge.active { background: rgba(156,255,0,0.14); color: #9cff00; }
        .tool-badge.idle { background: rgba(255,255,255,0.05); color: #8b8b8b; }

        .tool-layer-panel {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 4px;
        }

        .tool-layer-box {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 12px;
          border-radius: 10px;
          border: 1px solid rgba(156,255,0,.18);
          background: rgba(17, 21, 17, 0.8);
        }

        .tool-layer-label {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #9cff00;
        }

        .tool-option-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
        }

        .tool-option {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(24, 28, 24, 0.8);
          color: #e8efe7;
          padding: 10px 12px;
          text-align: left;
          cursor: pointer;
        }

        .tool-option strong {
          font-size: 12px;
          font-weight: 700;
        }

        .tool-option span {
          font-size: 11px;
          color: #9ca89d;
          line-height: 1.4;
        }

        .tool-option.selected {
          border-color: rgba(156,255,0,.45);
          background: rgba(156,255,0,.08);
        }

        .tool-channel-row {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .tool-channel-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #aaa;
        }

        .tool-finish-btn {
          border: none;
          border-radius: 8px;
          background: linear-gradient(135deg, #9cff00, #75ec8d);
          color: #0c130d;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          padding: 10px 12px;
          cursor: pointer;
        }

        .tool-config-input { width: 100%; box-sizing: border-box; padding: 10px 12px; resize: vertical; border-radius: 8px; border: 1px solid rgba(156,255,0,.25); background: #161a17; color: #eee; font: inherit; font-size: 12px; }

        .tool-toggle { display: flex; align-items: center; gap: 9px; min-width: 0; color: #eee; font-size: 13px; font-weight: 700; }
        .tool-toggle input { accent-color: #9cff00; }
        .tool-row select { min-width: 150px; max-width: 55%; padding: 8px 10px; border-radius: 8px; border: 1px solid rgba(156,255,0,.25); background: #161a17; color: #eee; }

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

        .icon-editor {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 12px;
          background: rgba(26, 26, 26, 0.5);
          border: 1px solid rgba(42, 42, 42, 0.8);
          border-radius: 12px;
        }

        .icon-preview {
          width: 72px;
          height: 72px;
          flex-shrink: 0;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          font-size: 34px;
        }

        .icon-preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .icon-editor-actions { flex: 1; min-width: 0; }

        .upload-image-btn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 9px 12px;
          margin-bottom: 8px;
          border-radius: 8px;
          background: rgba(156, 255, 0, 0.1);
          border: 1px solid rgba(156, 255, 0, 0.3);
          color: #9cff00;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .icon-editor .icon-input {
          width: 100%;
          box-sizing: border-box;
          font-size: 14px;
          padding: 10px 12px;
        }

        .pick-emoji-btn { display:inline-flex; align-items:center; gap:6px; padding:9px 12px; margin:0 0 8px; border-radius:8px; border:1px solid rgba(156,255,0,.3); background:rgba(156,255,0,.08); color:#caff9a; font-size:12px; font-weight:700; cursor:pointer; }
        .community-emoji-picker { position:fixed; z-index:100001; top:50%; left:50%; transform:translate(-50%,-50%); max-width:calc(100vw - 20px); max-height:calc(100vh - 20px); }

        .border-options { display: flex; flex-wrap: wrap; gap: 8px; }

        .border-option {
          padding: 9px 12px;
          border-radius: 9px;
          background: rgba(26, 26, 26, 0.7);
          border: 1px solid rgba(42, 42, 42, 0.9);
          color: #999;
          font-size: 12px;
          font-weight: 700;
          text-transform: capitalize;
          cursor: pointer;
        }

        .border-option.selected {
          border-color: #9cff00;
          color: #9cff00;
          background: rgba(156, 255, 0, 0.1);
        }

        .border-lime { border-color: rgba(156, 255, 0, 0.5); }
        .border-glass { border-color: rgba(255, 255, 255, 0.35); }
        .border-dashed { border-style: dashed; border-color: rgba(156, 255, 0, 0.5); }
        .border-none { border-color: transparent; }

        .settings-error {
          padding: 10px 12px;
          margin-bottom: 14px;
          border-radius: 9px;
          background: rgba(255, 107, 107, 0.1);
          border: 1px solid rgba(255, 107, 107, 0.35);
          color: #ff8b8b;
          font-size: 12px;
          font-weight: 600;
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
