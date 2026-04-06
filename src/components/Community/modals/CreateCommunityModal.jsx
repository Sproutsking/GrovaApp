// components/Community/modals/CreateCommunityModal.jsx
// Full rewrite: supports device image upload OR emoji icon
import React, { useState, useRef } from "react";
import { X, Upload, ImagePlus, Shuffle } from "lucide-react";

const GRADIENTS = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
  "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)",
  "linear-gradient(135deg, #9cff00 0%, #00c9ff 100%)",
  "linear-gradient(135deg, #f7971e 0%, #ffd200 100%)",
  "linear-gradient(135deg, #ee0979 0%, #ff6a00 100%)",
];

const QUICK_EMOJIS = [
  "🚀","🌟","🔥","💎","⚡","🎯","🌊","🎨","🏆","🦁",
  "🦋","🌈","🎭","🎪","🎮","🎵","🌙","☀️","🌺","🦊",
];

const CreateCommunityModal = ({ onClose, onCreate }) => {
  const [step, setStep] = useState(1); // 1 = icon, 2 = details
  const [iconMode, setIconMode] = useState("emoji"); // "emoji" | "image"
  const [selectedEmoji, setSelectedEmoji] = useState("🌟");
  const [iconFile, setIconFile] = useState(null);
  const [iconPreview, setIconPreview] = useState(null);
  const [bannerGradient, setBannerGradient] = useState(GRADIENTS[0]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fileInputRef = useRef(null);

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

  const randomGradient = () => {
    const next = GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)];
    setBannerGradient(next);
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

  const currentIcon = iconMode === "image" && iconPreview ? iconPreview : selectedEmoji;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="create-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-head">
          <div className="modal-title">Create Community</div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Preview banner */}
        <div className="banner-preview" style={{ background: bannerGradient }}>
          <div className="banner-overlay" />
          <div className="banner-icon">
            {iconMode === "image" && iconPreview
              ? <img src={iconPreview} alt="icon" className="icon-img" />
              : <span className="icon-emoji">{selectedEmoji}</span>
            }
          </div>
          <button className="shuffle-btn" onClick={randomGradient} title="Random gradient">
            <Shuffle size={14} />
          </button>
        </div>

        {/* Gradient picker */}
        <div className="section-label">Banner Color</div>
        <div className="gradient-row">
          {GRADIENTS.map((g, i) => (
            <div
              key={i}
              className={`grad-swatch${bannerGradient === g ? " active" : ""}`}
              style={{ background: g }}
              onClick={() => setBannerGradient(g)}
            />
          ))}
        </div>

        {/* Icon section */}
        <div className="section-label">Community Icon</div>
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
          <div
            className="upload-zone"
            onClick={() => fileInputRef.current?.click()}
          >
            {iconPreview
              ? <img src={iconPreview} alt="preview" className="upload-preview" />
              : <>
                  <Upload size={24} color="#9cff00" />
                  <span>Click to upload image</span>
                  <span className="upload-hint">PNG, JPG, GIF · max 5 MB</span>
                </>
            }
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden-file"
          onChange={handleFileChange}
        />

        {/* Details */}
        <div className="section-label">Details</div>

        <input
          className="field-input"
          placeholder="Community name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
        />

        <textarea
          className="field-textarea"
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={300}
          rows={3}
        />

        <label className="toggle-row">
          <div className="toggle-info">
            <div className="toggle-label">Private Community</div>
            <div className="toggle-hint">Only invited members can join</div>
          </div>
          <div
            className={`toggle-switch${isPrivate ? " on" : ""}`}
            onClick={() => setIsPrivate(!isPrivate)}
          >
            <div className="toggle-thumb" />
          </div>
        </label>

        {error && <div className="error-msg">{error}</div>}

        <button
          className="create-btn"
          onClick={handleCreate}
          disabled={loading || !name.trim()}
        >
          {loading ? <div className="btn-spinner" /> : "Create Community"}
        </button>
      </div>

      <style>{`
        .modal-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.75);
          backdrop-filter: blur(10px);
          z-index: 50000;
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
        }

        .create-modal {
          width: 100%; max-width: 440px;
          max-height: 90vh;
          background: #0c0c0c;
          border: 1.5px solid rgba(156,255,0,0.18);
          border-radius: 20px;
          overflow-y: auto;
          overflow-x: hidden;
          animation: modalIn 0.3s cubic-bezier(.4,0,.2,1);
          scrollbar-width: thin;
          scrollbar-color: rgba(156,255,0,0.2) transparent;
        }
        .create-modal::-webkit-scrollbar { width: 5px; }
        .create-modal::-webkit-scrollbar-thumb { background: rgba(156,255,0,0.2); border-radius: 3px; }

        @keyframes modalIn {
          from { opacity:0; transform:translateY(24px) scale(.97); }
          to   { opacity:1; transform:translateY(0)   scale(1);    }
        }

        .modal-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 20px 0;
        }
        .modal-title { font-size: 18px; font-weight: 800; color: #fff; }
        .modal-close {
          width: 32px; height: 32px; border-radius: 8px;
          background: rgba(255,255,255,0.06); border: none;
          color: #888; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all .2s;
        }
        .modal-close:hover { background: rgba(255,100,100,0.15); color: #ff6b6b; }

        /* Banner */
        .banner-preview {
          margin: 16px 20px 0;
          height: 100px; border-radius: 14px;
          position: relative; overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.4s;
        }
        .banner-overlay {
          position:absolute; inset:0;
          background: linear-gradient(180deg,transparent 40%,rgba(0,0,0,.5) 100%);
        }
        .banner-icon {
          width: 60px; height: 60px; border-radius: 14px;
          background: rgba(0,0,0,0.4); backdrop-filter: blur(10px);
          display: flex; align-items: center; justify-content: center;
          font-size: 30px; z-index: 2;
          border: 2px solid rgba(255,255,255,0.12);
        }
        .icon-img { width:100%; height:100%; object-fit:cover; border-radius:12px; }
        .icon-emoji { font-size:30px; line-height:1; }
        .shuffle-btn {
          position:absolute; bottom:8px; right:10px;
          width:28px; height:28px; border-radius:8px;
          background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.1);
          color:#aaa; cursor:pointer;
          display:flex; align-items:center; justify-content:center;
          z-index:3; transition:all .2s;
        }
        .shuffle-btn:hover { color:#9cff00; border-color:rgba(156,255,0,0.4); }

        /* Gradient row */
        .gradient-row {
          display: flex; gap: 7px; padding: 0 20px;
          overflow-x: auto; padding-bottom: 2px;
        }
        .gradient-row::-webkit-scrollbar { height: 3px; }
        .gradient-row::-webkit-scrollbar-thumb { background: rgba(156,255,0,0.2); }
        .grad-swatch {
          width: 30px; height: 30px; border-radius: 8px; cursor: pointer;
          flex-shrink: 0; border: 2px solid transparent;
          transition: all .2s;
        }
        .grad-swatch.active {
          border-color: #9cff00;
          box-shadow: 0 0 12px rgba(156,255,0,0.5);
          transform: scale(1.12);
        }

        .section-label {
          font-size: 11px; font-weight: 700; color: #555;
          text-transform: uppercase; letter-spacing: .6px;
          padding: 14px 20px 6px;
        }

        /* Icon tabs */
        .icon-tabs {
          display: flex; gap: 6px; padding: 0 20px;
        }
        .icon-tab {
          display: flex; align-items: center; gap: 5px;
          padding: 7px 14px; border-radius: 8px; font-size: 12px; font-weight: 700;
          cursor: pointer; border: 1.5px solid rgba(42,42,42,.9);
          background: rgba(18,18,18,.95); color: #888;
          transition: all .2s;
        }
        .icon-tab.active {
          border-color: rgba(156,255,0,.5); color: #9cff00;
          background: rgba(156,255,0,.1);
        }

        /* Emoji grid */
        .emoji-grid-sm {
          display: grid; grid-template-columns: repeat(10,1fr);
          gap: 4px; padding: 8px 20px;
        }
        .emoji-btn {
          aspect-ratio:1; border-radius:8px; font-size:18px;
          background:rgba(18,18,18,.95); border:1.5px solid rgba(30,30,30,.9);
          cursor:pointer; display:flex; align-items:center; justify-content:center;
          transition:all .18s;
        }
        .emoji-btn:hover  { background:rgba(156,255,0,.1); border-color:rgba(156,255,0,.3); transform:scale(1.1); }
        .emoji-btn.active { background:rgba(156,255,0,.18); border-color:rgba(156,255,0,.6); }

        /* Upload zone */
        .upload-zone {
          margin: 0 20px;
          height: 90px; border-radius: 12px;
          border: 2px dashed rgba(156,255,0,0.25);
          background: rgba(156,255,0,0.03);
          display:flex; flex-direction:column; align-items:center; justify-content:center;
          gap:6px; cursor:pointer; transition:all .2s;
          color:#666; font-size:13px; font-weight:600;
          position:relative; overflow:hidden;
        }
        .upload-zone:hover { border-color:rgba(156,255,0,.5); background:rgba(156,255,0,.06); }
        .upload-preview {
          width:100%; height:100%; object-fit:cover;
          position:absolute; inset:0; border-radius:10px;
        }
        .upload-hint { font-size:10px; color:#444; font-weight:500; }

        .hidden-file { display:none; }

        /* Fields */
        .field-input, .field-textarea {
          display:block; width:100%; box-sizing:border-box;
          margin: 0 0 10px; padding: 11px 14px;
          background: rgba(18,18,18,.95); border:1.5px solid rgba(42,42,42,.9);
          border-radius:10px; color:#fff; font-size:14px; font-family:inherit;
          outline:none; resize:none; transition:border-color .2s;
        }
        .field-input { margin-left:0; margin-right:0; }
        /* wrap in padding container */
        .field-input, .field-textarea {
          margin-left:20px; margin-right:20px; width:calc(100% - 40px);
        }
        .field-input:focus, .field-textarea:focus {
          border-color: rgba(156,255,0,.45);
        }
        .field-input::placeholder, .field-textarea::placeholder { color:#444; }

        /* Toggle */
        .toggle-row {
          display:flex; align-items:center; justify-content:space-between;
          padding: 10px 20px; cursor:pointer;
        }
        .toggle-label { font-size:13px; font-weight:700; color:#ddd; }
        .toggle-hint  { font-size:11px; color:#555; margin-top:2px; }
        .toggle-switch {
          width:44px; height:24px; border-radius:12px;
          background:rgba(42,42,42,.9); position:relative;
          transition:background .25s; flex-shrink:0;
        }
        .toggle-switch.on { background:rgba(156,255,0,.8); }
        .toggle-thumb {
          position:absolute; top:3px; left:3px;
          width:18px; height:18px; border-radius:50%;
          background:#fff; transition:transform .25s;
          box-shadow:0 1px 4px rgba(0,0,0,.3);
        }
        .toggle-switch.on .toggle-thumb { transform:translateX(20px); }

        /* Error */
        .error-msg {
          margin:0 20px 10px; padding:10px 14px;
          background:rgba(255,100,100,.1); border:1px solid rgba(255,100,100,.3);
          border-radius:8px; color:#ff6b6b; font-size:12px; font-weight:600;
        }

        /* Create btn */
        .create-btn {
          display:flex; align-items:center; justify-content:center;
          width:calc(100% - 40px); margin:0 20px 20px;
          padding:14px; border-radius:12px;
          background:linear-gradient(135deg,#9cff00,#667eea);
          border:none; color:#000; font-size:15px; font-weight:800;
          cursor:pointer; transition:all .25s;
          box-shadow:0 4px 16px rgba(156,255,0,.25);
        }
        .create-btn:hover:not(:disabled) {
          transform:translateY(-2px);
          box-shadow:0 8px 24px rgba(156,255,0,.4);
        }
        .create-btn:disabled { opacity:.5; cursor:not-allowed; }

        .btn-spinner {
          width:20px; height:20px; border:2.5px solid rgba(0,0,0,.3);
          border-top-color:#000; border-radius:50%;
          animation:spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform:rotate(360deg); } }

        @media (max-width:480px) {
          .create-modal { border-radius:16px; }
          .emoji-grid-sm { grid-template-columns: repeat(8,1fr); }
        }
      `}</style>
    </div>
  );
};

export default CreateCommunityModal;