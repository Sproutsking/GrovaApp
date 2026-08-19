// components/Community/modals/CreateCommunityModal.jsx
// REVISION: restyled to match the admin-section design language
// (RolesPermissionsSection / AnalyticsSection — bordered cards, uppercase
// icon+label section headers, consistent buttons) and upgraded the
// gradient/icon picker to the shared premium system (Aurora / Mesh /
// Cosmic / Sunset / Pixel / Glass) with a layered, glowing preview.
import React, { useState, useRef } from "react";
import { X, Upload, ImagePlus, Shuffle, Check, Sparkles, AlignLeft, Lock, Globe, Palette, ArrowLeft } from "lucide-react";
import { PREMIUM_GRADIENTS, CATEGORY_ORDER, CATEGORY_BLURB, getGradientById } from "../utils/communityVisuals";

const QUICK_EMOJIS = [
  "🚀","🌟","🔥","💎","⚡","🎯","🌊","🎨","🏆","🦁",
  "🦋","🌈","🎭","🎪","🎮","🎵","🌙","☀️","🌺","🦊",
];

const CreateCommunityModal = ({ onClose, onCreate }) => {
  const [iconMode, setIconMode] = useState("emoji"); // "emoji" | "image"
  const [selectedEmoji, setSelectedEmoji] = useState("🌟");
  const [iconFile, setIconFile] = useState(null);
  const [iconPreview, setIconPreview] = useState(null);

  const [activeCategory, setActiveCategory] = useState(CATEGORY_ORDER[0]);
  const [bannerGradientId, setBannerGradientId] = useState(PREMIUM_GRADIENTS[0].id);
  const [bannerGradient, setBannerGradient] = useState(PREMIUM_GRADIENTS[0].css);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fileInputRef = useRef(null);
  const activePreset = getGradientById(bannerGradientId);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5 MB");
      return;
    }
    setIconFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setIconPreview(reader.result);
    reader.readAsDataURL(file);
    setIconMode("image");
    setError("");
  };

  const selectGradient = (preset) => {
    setBannerGradientId(preset.id);
    setBannerGradient(preset.css);
  };

  const randomGradient = () => {
    const next = PREMIUM_GRADIENTS[Math.floor(Math.random() * PREMIUM_GRADIENTS.length)];
    setActiveCategory(next.category);
    selectGradient(next);
  };

  const handleCreate = async () => {
    if (!name.trim()) { setError("Community name is required"); return; }
    setLoading(true);
    setError("");
    try {
      await onCreate({
        name: name.trim(),
        description: description.trim(),
        icon: iconMode === "emoji" ? selectedEmoji : null,
        iconFile: iconMode === "image" ? iconFile : null,
        bannerGradient,
        isPrivate,
      });
    } catch (err) {
      setError(err.message || "Failed to create community");
    } finally {
      setLoading(false);
    }
  };

  const categoryPresets = PREMIUM_GRADIENTS.filter((g) => g.category === activeCategory);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="create-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-head">
          <button className="modal-back" onClick={onClose} title="Back"><ArrowLeft size={20} /></button>
          <div className="modal-title">Create Community</div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="cc-body">
          {/* ── Banner & Icon card ───────────────────────────────── */}
          <div className="cc-card">
            <div className="cc-section-header"><Palette size={14} /><span>Banner &amp; Icon</span></div>

            {/* Live preview */}
            <div
              className={`banner-preview${activePreset?.animated ? " is-animated" : ""}`}
              style={{
                backgroundImage: bannerGradient,
                backgroundSize: activePreset?.backgroundSize || "cover",
                "--cc-glow": activePreset?.glow || "#9cff00",
              }}
            >
              <div className="banner-sheen" />
              <div className="banner-vignette" />
              <div className="banner-icon">
                {iconMode === "image" && iconPreview
                  ? <img src={iconPreview} alt="icon" className="icon-img" />
                  : <span className="icon-emoji">{selectedEmoji}</span>
                }
              </div>
              <button className="shuffle-btn" onClick={randomGradient} title="Surprise me">
                <Shuffle size={14} />
              </button>
            </div>

            {/* Category tabs */}
            <div className="cc-cat-row">
              {CATEGORY_ORDER.map((cat) => (
                <button
                  key={cat}
                  className={`cc-cat-tab${activeCategory === cat ? " active" : ""}`}
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="cc-cat-blurb">{CATEGORY_BLURB[activeCategory]}</div>

            <div className="cc-gradient-grid">
              {categoryPresets.map((g) => (
                <button
                  key={g.id}
                  className={`cc-grad-swatch${bannerGradientId === g.id ? " active" : ""}`}
                  style={{ backgroundImage: g.css, backgroundSize: g.backgroundSize || "cover" }}
                  onClick={() => selectGradient(g)}
                  title={g.label}
                >
                  {bannerGradientId === g.id && <Check size={12} className="cc-grad-check" />}
                  <span className="cc-grad-label">{g.label}</span>
                </button>
              ))}
            </div>

            {/* Icon source tabs */}
            <div className="cc-subhead">Icon Source</div>
            <div className="icon-tabs">
              <button
                className={`icon-tab${iconMode === "emoji" ? " active" : ""}`}
                onClick={() => setIconMode("emoji")}
              >Emoji</button>
              <button
                className={`icon-tab${iconMode === "image" ? " active" : ""}`}
                onClick={() => { setIconMode("image"); if (!iconFile) fileInputRef.current?.click(); }}
              >
                <ImagePlus size={14} /> Image
              </button>
            </div>

            {iconMode === "emoji" ? (
              <div className="emoji-grid-sm">
                {QUICK_EMOJIS.map((em) => (
                  <button
                    key={em}
                    className={`emoji-btn${selectedEmoji === em ? " active" : ""}`}
                    onClick={() => setSelectedEmoji(em)}
                  >{em}</button>
                ))}
              </div>
            ) : (
              <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
                {iconPreview
                  ? <img src={iconPreview} alt="preview" className="upload-preview" />
                  : <>
                      <Upload size={22} color="#9cff00" />
                      <span>Click to upload image</span>
                      <span className="upload-hint">PNG, JPG, GIF · max 5 MB</span>
                    </>
                }
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden-file" onChange={handleFileChange} />
          </div>

          {/* ── Details card ─────────────────────────────────────── */}
          <div className="cc-card">
            <div className="cc-section-header"><Sparkles size={14} /><span>Details</span></div>

            <div className="cc-field-label">Community Name</div>
            <input
              className="field-input"
              placeholder="e.g. Builders Collective"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
            />

            <div className="cc-field-label" style={{ marginTop: 12 }}>
              <AlignLeft size={11} /> Description <span className="cc-optional">Optional</span>
            </div>
            <textarea
              className="field-textarea"
              placeholder="What is this community about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={300}
              rows={3}
            />
          </div>

          {/* ── Privacy card ─────────────────────────────────────── */}
          <div className="cc-card cc-card-tight">
            <div className="cc-section-header">
              {isPrivate ? <Lock size={14} /> : <Globe size={14} />}
              <span>Privacy</span>
            </div>
            <label className="toggle-row">
              <div className="toggle-info">
                <div className="toggle-label">Private Community</div>
                <div className="toggle-hint">Only invited members can join</div>
              </div>
              <button
                type="button"
                className={`cc-toggle${isPrivate ? " on" : ""}`}
                onClick={() => setIsPrivate(!isPrivate)}
                role="switch"
                aria-checked={isPrivate}
              >
                <span className="cc-toggle-thumb" />
              </button>
            </label>
          </div>

          {error && <div className="error-msg">{error}</div>}

          <button className="create-btn" onClick={handleCreate} disabled={loading || !name.trim()}>
            {loading ? <div className="btn-spinner" /> : "Create Community"}
          </button>
        </div>
      </div>

      <style>{`
        .modal-overlay {
          position: fixed;
          top: 57px;
          right: 0;
          bottom: 0;
          left: 0;
          background: rgba(5, 7, 10, 0.66);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          z-index: 1000;
          display: flex;
          align-items: stretch;
          justify-content: flex-end;
          padding: 0;
          animation: overlayFadeIn 0.3s ease;
        }

        @keyframes overlayFadeIn {
          from { background-color: rgba(5, 7, 10, 0); }
          to { background-color: rgba(5, 7, 10, 0.66); }
        }

        .create-modal {
          width: 100%;
          max-width: 600px;
          height: 100vh;
          background: rgba(10, 12, 16, 0.97);
          border-left: 1.5px solid rgba(156,255,0,0.18);
          overflow-y: auto;
          overflow-x: hidden;
          animation: modalSlideIn 0.35s cubic-bezier(.34,1.56,.64,1);
          scrollbar-width: thin;
          scrollbar-color: rgba(156,255,0,0.2) transparent;
          box-shadow: -18px 0 60px rgba(0, 0, 0, 0.6), 0 0 60px rgba(156,255,0,0.08);
          display: flex;
          flex-direction: column;
        }
        .create-modal::-webkit-scrollbar { width: 5px; }
        .create-modal::-webkit-scrollbar-thumb { background: rgba(156,255,0,0.2); border-radius: 3px; }

        @keyframes modalSlideIn {
          from {
            opacity:0;
            transform: translateX(100px);
          }
          to   {
            opacity:1;
            transform: translateX(0);
          }
        }

        @media (max-width: 768px) {
          .modal-overlay {
            top: 47px;
            bottom: 56px;
            justify-content: center;
            align-items: flex-end;
            padding: 0;
          }
          .create-modal {
            width: 100%;
            height: 100%;
            max-height: 100%;
            border: 1.5px solid rgba(156,255,0,0.18);
            border-radius: 20px 20px 0 0;
            border-bottom: none;
            box-shadow: 0 -18px 60px rgba(0,0,0,0.45), 0 0 60px rgba(156,255,0,0.08);
            max-width: 100%;
            animation: modalSlideUp 0.35s cubic-bezier(.34,1.56,.64,1);
          }
        }

        @keyframes modalSlideUp {
          from {
            opacity:0;
            transform: translateY(100%);
          }
          to   {
            opacity:1;
            transform: translateY(0);
          }
        }

        @media (max-width: 480px) {
          .create-modal {
            max-height: calc(100vh - 50px);
            border-radius: 18px 18px 0 0;
          }
        }

        .modal-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 16px 20px;
          border-bottom: 1.5px solid rgba(156,255,0,0.1);
          flex-shrink: 0;
          background: rgba(10, 12, 16, 0.97);
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .modal-back {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(156, 255, 0, 0.1);
          border: 1.5px solid rgba(156, 255, 0, 0.2);
          color: #9cff00;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .modal-back:hover {
          background: rgba(156, 255, 0, 0.2);
          border-color: rgba(156, 255, 0, 0.4);
          box-shadow: 0 4px 12px rgba(156, 255, 0, 0.15);
        }

        .modal-back:active {
          transform: scale(0.95);
        }

        .modal-title {
          font-size: 18px;
          font-weight: 800;
          color: #fff;
          flex: 1;
          text-align: center;
        }

        .modal-close {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(255,255,255,0.06);
          border: none;
          color: #888;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .modal-close:hover {
          background: rgba(255,100,100,0.15);
          color: #ff6b6b;
        }

        .cc-body {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          flex: 1;
          overflow-y: auto;
        }

        /* ── Card language shared with RolesPermissionsSection / AnalyticsSection ── */
        .cc-card {
          background: rgba(26, 26, 26, 0.4);
          border: 2px solid rgba(42, 42, 42, 0.6);
          border-radius: 16px;
          padding: 16px;
        }
        .cc-card-tight { padding: 14px 16px; }

        .cc-section-header {
          display: flex; align-items: center; gap: 9px;
          font-size: 12.5px; font-weight: 800; color: #9cff00;
          text-transform: uppercase; letter-spacing: 0.6px;
          margin-bottom: 14px; padding-bottom: 11px;
          border-bottom: 1.5px solid rgba(156,255,0,0.16);
        }

        .cc-subhead {
          font-size: 10.5px; font-weight: 800; color: #555;
          text-transform: uppercase; letter-spacing: 0.6px;
          margin: 14px 0 8px;
        }

        .cc-field-label {
          display: flex; align-items: center; gap: 5px;
          font-size: 10.5px; font-weight: 800; color: #666;
          text-transform: uppercase; letter-spacing: 0.6px;
          margin-bottom: 7px;
        }
        .cc-optional { font-weight: 600; text-transform: none; color: #444; letter-spacing: 0; margin-left: 2px; }

        /* Banner preview — layered, glowing, next-gen */
        .banner-preview {
          height: 128px; border-radius: 14px;
          position: relative; overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          background-position: center; background-repeat: no-repeat;
          box-shadow:
            0 10px 30px -8px var(--cc-glow),
            inset 0 0 0 1px rgba(255,255,255,.08);
          transition: box-shadow .4s ease;
        }
        .banner-preview.is-animated { background-size: 220% 220% !important; animation: bpDrift 16s ease-in-out infinite; }
        @keyframes bpDrift { 0%,100%{ background-position: 15% 25%; } 50%{ background-position: 85% 75%; } }
        .banner-sheen {
          position: absolute; inset: 0; pointer-events: none;
          background: linear-gradient(125deg, rgba(255,255,255,.28) 0%, rgba(255,255,255,0) 30%, rgba(255,255,255,0) 70%, rgba(255,255,255,.12) 100%);
          mix-blend-mode: overlay;
        }
        .banner-vignette {
          position: absolute; inset: 0; pointer-events: none;
          background: linear-gradient(180deg, transparent 35%, rgba(0,0,0,.55) 100%);
        }
        .banner-icon {
          width: 60px; height: 60px; border-radius: 15px;
          background: rgba(0,0,0,0.4); backdrop-filter: blur(10px);
          display: flex; align-items: center; justify-content: center;
          font-size: 30px; z-index: 2;
          border: 2px solid rgba(255,255,255,0.14);
          box-shadow: 0 8px 22px -6px var(--cc-glow), inset 0 0 0 1px rgba(255,255,255,.06);
        }
        .icon-img { width:100%; height:100%; object-fit:cover; border-radius:13px; }
        .icon-emoji { font-size:30px; line-height:1; filter: drop-shadow(0 2px 6px rgba(0,0,0,.4)); }
        .shuffle-btn {
          position:absolute; bottom:9px; right:10px;
          width:28px; height:28px; border-radius:8px;
          background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.14);
          color:#eee; cursor:pointer;
          display:flex; align-items:center; justify-content:center;
          z-index:3; transition:all .2s;
        }
        .shuffle-btn:hover { color:#9cff00; border-color:rgba(156,255,0,0.5); transform: rotate(18deg); }

        /* Category tabs */
        .cc-cat-row { display:flex; gap:6px; margin-top:14px; overflow-x:auto; padding-bottom:2px; }
        .cc-cat-row::-webkit-scrollbar { height: 3px; }
        .cc-cat-tab {
          flex-shrink:0; padding:6px 12px; border-radius:8px;
          background: rgba(18,18,18,.95); border:1.5px solid rgba(42,42,42,.9);
          color:#888; font-size:11px; font-weight:800; cursor:pointer;
          transition: all .16s; white-space:nowrap;
        }
        .cc-cat-tab:hover { border-color: rgba(156,255,0,.3); color:#ccc; }
        .cc-cat-tab.active { background: rgba(156,255,0,.12); border-color: rgba(156,255,0,.5); color:#9cff00; }
        .cc-cat-blurb { font-size: 11px; color: #555; margin: 6px 2px 10px; }

        .cc-gradient-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
        .cc-grad-swatch {
          position:relative; height:52px; border-radius:11px; cursor:pointer;
          border:2px solid transparent; overflow:hidden;
          background-position:center; background-repeat:no-repeat;
          display:flex; align-items:flex-end; justify-content:flex-start;
          transition: transform .18s, border-color .18s, box-shadow .18s;
        }
        .cc-grad-swatch:hover { transform: translateY(-2px); }
        .cc-grad-swatch.active { border-color:#fff; box-shadow: 0 6px 18px rgba(0,0,0,.4); }
        .cc-grad-label {
          font-size:9.5px; font-weight:800; color:#fff; text-shadow:0 1px 3px rgba(0,0,0,.7);
          padding:4px 6px; text-transform:uppercase; letter-spacing:.3px;
        }
        .cc-grad-check {
          position:absolute; top:5px; right:5px; color:#fff;
          background: rgba(0,0,0,.45); border-radius:50%; padding:2px;
        }

        /* Icon tabs */
        .icon-tabs { display: flex; gap: 6px; }
        .icon-tab {
          display: flex; align-items: center; gap: 5px;
          padding: 7px 14px; border-radius: 8px; font-size: 12px; font-weight: 700;
          cursor: pointer; border: 1.5px solid rgba(42,42,42,.9);
          background: rgba(18,18,18,.95); color: #888;
          transition: all .2s;
        }
        .icon-tab.active { border-color: rgba(156,255,0,.5); color: #9cff00; background: rgba(156,255,0,.1); }

        .emoji-grid-sm { display: grid; grid-template-columns: repeat(10,1fr); gap: 4px; margin-top: 8px; }
        .emoji-btn {
          aspect-ratio:1; border-radius:8px; font-size:18px;
          background:rgba(18,18,18,.95); border:1.5px solid rgba(30,30,30,.9);
          cursor:pointer; display:flex; align-items:center; justify-content:center;
          transition:all .18s;
        }
        .emoji-btn:hover  { background:rgba(156,255,0,.1); border-color:rgba(156,255,0,.3); transform:scale(1.1); }
        .emoji-btn.active { background:rgba(156,255,0,.18); border-color:rgba(156,255,0,.6); }

        .upload-zone {
          margin-top: 8px;
          height: 84px; border-radius: 12px;
          border: 2px dashed rgba(156,255,0,0.25);
          background: rgba(156,255,0,0.03);
          display:flex; flex-direction:column; align-items:center; justify-content:center;
          gap:5px; cursor:pointer; transition:all .2s;
          color:#666; font-size:12.5px; font-weight:600;
          position:relative; overflow:hidden;
        }
        .upload-zone:hover { border-color:rgba(156,255,0,.5); background:rgba(156,255,0,.06); }
        .upload-preview { width:100%; height:100%; object-fit:cover; position:absolute; inset:0; border-radius:10px; }
        .upload-hint { font-size:10px; color:#444; font-weight:500; }
        .hidden-file { display:none; }

        /* Fields */
        .field-input, .field-textarea {
          display:block; width:100%; box-sizing:border-box;
          padding: 11px 14px;
          background: rgba(18,18,18,.95); border:1.5px solid rgba(42,42,42,.9);
          border-radius:10px; color:#fff; font-size:14px; font-family:inherit;
          outline:none; resize:none; transition:border-color .2s;
        }
        .field-input:focus, .field-textarea:focus { border-color: rgba(156,255,0,.45); }
        .field-input::placeholder, .field-textarea::placeholder { color:#444; }

        /* Toggle */
        .toggle-row { display:flex; align-items:center; justify-content:space-between; cursor:pointer; }
        .toggle-label { font-size:13px; font-weight:700; color:#ddd; }
        .toggle-hint  { font-size:11px; color:#555; margin-top:2px; }
        .cc-toggle {
          width: 38px; height: 20px; border-radius: 10px;
          background: rgba(40,40,40,.9); border: none; cursor: pointer;
          position: relative; flex-shrink: 0; padding: 0;
          transition: background .22s;
        }
        .cc-toggle.on { background: rgba(156,255,0,.75); }
        .cc-toggle-thumb {
          position: absolute; top: 3px; left: 3px;
          width: 14px; height: 14px; border-radius: 50%;
          background: #fff; transition: transform .22s;
          box-shadow: 0 1px 3px rgba(0,0,0,.4);
        }
        .cc-toggle.on .cc-toggle-thumb { transform: translateX(18px); }

        /* Error */
        .error-msg {
          padding:10px 14px;
          background:rgba(255,100,100,.1); border:1px solid rgba(255,100,100,.3);
          border-radius:10px; color:#ff6b6b; font-size:12px; font-weight:600;
        }

        /* Create btn */
        .create-btn {
          display:flex; align-items:center; justify-content:center;
          width:100%; padding:14px; border-radius:12px;
          background:linear-gradient(135deg,#9cff00,#667eea);
          border:none; color:#000; font-size:15px; font-weight:800;
          cursor:pointer; transition:all .25s;
          box-shadow:0 4px 16px rgba(156,255,0,.25);
        }
        .create-btn:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 8px 24px rgba(156,255,0,.4); }
        .create-btn:disabled { opacity:.5; cursor:not-allowed; }

        .btn-spinner {
          width:20px; height:20px; border:2.5px solid rgba(0,0,0,.3);
          border-top-color:#000; border-radius:50%;
          animation:spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform:rotate(360deg); } }

        @media (max-width:480px) {
          .modal-title { font-size: 16px; }
          .emoji-grid-sm { grid-template-columns: repeat(8,1fr); }
          .cc-gradient-grid { grid-template-columns: repeat(2,1fr); }
          .cc-cat-row { gap: 4px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .banner-preview.is-animated { animation: none; }
          .modal-overlay { animation: none; }
          .create-modal { animation: none; }
        }
      `}</style>
    </div>
  );
};

export default CreateCommunityModal;