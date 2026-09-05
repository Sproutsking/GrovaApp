import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { X, Hash, Volume2, Bell, ArrowLeft, Upload, Smile } from "lucide-react";
import EmojiPanel from "../components/EmojiPanel";
import { supabase } from "../../../services/config/supabase";

const CreateChannelModal = ({ onClose, onCreate, communityId }) => {
  const [formData, setFormData] = useState({
    name: "",
    icon: "💬",
    description: "",
    type: "text",
    isPrivate: false,
    category: "",
    categoryId: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [iconFile, setIconFile] = useState(null);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [categories, setCategories] = useState([]);
  const [categoryMode, setCategoryMode] = useState("existing");
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.from("community_channel_categories").select("id,name,position").eq("community_id", communityId).order("position", { ascending: true }).then(({ data }) => {
      if (!active) return;
      const next = data || [];
      setCategories(next);
      if (next.length && !formData.categoryId) {
        setFormData((current) => ({ ...current, category: next[0].name, categoryId: next[0].id }));
      } else if (!next.length) {
        setCategoryMode("new");
      }
      setCategoriesLoading(false);
    });
    return () => { active = false; };
  }, [communityId]);

  const channelTypes = [
    {
      value: "text",
      label: "Text Channel",
      icon: Hash,
      gradient: "linear-gradient(135deg, #9cff00 0%, #667eea 100%)",
    },
    {
      value: "voice",
      label: "Voice Channel",
      icon: Volume2,
      gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    },
    {
      value: "announcement",
      label: "Announcement",
      icon: Bell,
      gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    },
  ];

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError("Channel name is required");
      return;
    }

    if (formData.name.length < 1 || formData.name.length > 50) {
      setError("Channel name must be between 1 and 50 characters");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await onCreate({
        community_id: communityId,
        name: formData.name.trim().toLowerCase().replace(/\s+/g, "-"),
        icon: formData.icon || "💬",
        iconFile,
        description: formData.description || null,
        type: formData.type || "text",
        is_private: formData.isPrivate,
        category: formData.category.trim() || "Channels",
        category_id: formData.categoryId || null,
        create_category: categoryMode === "new",
      });
      onClose();
    } catch (err) {
      console.error("Error creating channel:", err);
      setError(err.message || "Failed to create channel");
    } finally {
      setLoading(false);
    }
  };

  return ReactDOM.createPortal(
    <>
      <div className="channel-modal-overlay" onClick={onClose}>
        <div className="channel-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header channel-modal-header">
            <button className="modal-back" onClick={onClose} title="Back"><ArrowLeft size={20} /></button>
            <span className="modal-title">Create Channel</span>
            <button className="close-modal" onClick={onClose}>
              <X size={20} />
            </button>
          </div>

          <div className="modal-body channel-modal-body">
            {error && <div className="error-message">{error}</div>}

            <div className="form-group">
              <label className="form-label">Channel Type</label>
              <div className="channel-type-grid">
                {channelTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <div
                      key={type.value}
                      className={`channel-type-card ${formData.type === type.value ? "selected" : ""}`}
                      onClick={() =>
                        setFormData({ ...formData, type: type.value })
                      }
                    >
                      <div
                        className="type-icon"
                        style={{ background: type.gradient }}
                      >
                        <Icon size={20} />
                      </div>
                      <span>{type.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Channel Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g., general, announcements"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                maxLength={50}
              />
              <small className="help-text">
                Will be formatted as:{" "}
                {formData.name.toLowerCase().replace(/\s+/g, "-") ||
                  "channel-name"}
              </small>
            </div>

            <div className="form-group">
              <label className="form-label">Category</label>
              <div className="category-choice-row">
                <select className="form-input" value={categoryMode === "new" ? "__new__" : formData.categoryId} disabled={categoriesLoading} onChange={(event) => {
                  if (event.target.value === "__new__") {
                    setCategoryMode("new");
                    setFormData((current) => ({ ...current, categoryId: "", category: "" }));
                    return;
                  }
                  const selected = categories.find((category) => category.id === event.target.value);
                  setCategoryMode("existing");
                  setFormData((current) => ({ ...current, categoryId: selected?.id || "", category: selected?.name || "" }));
                }}>
                  {categoriesLoading && <option value="">Loading categories...</option>}
                  {!categoriesLoading && categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  {!categoriesLoading && <option value="__new__">+ Create new category</option>}
                </select>
              </div>
              {categoryMode === "new" && <input type="text" className="form-input category-new-input" placeholder="New category name" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} maxLength={50} autoFocus />}
            </div>

            <div className="form-group">
              <label className="form-label">Channel Icon</label>
              <div className="channel-icon-row">
                <input type="text" className="form-input" placeholder="Enter emoji" value={formData.icon} onChange={(e) => setFormData({ ...formData, icon: e.target.value })} maxLength={2} />
                <button type="button" className="channel-icon-picker-btn" onClick={() => setShowIconPicker((open) => !open)}><Smile size={15} /> Pick emoji</button>
                {showIconPicker && ReactDOM.createPortal(<div className="channel-icon-picker"><EmojiPanel onSelect={(icon) => { setFormData({ ...formData, icon }); setShowIconPicker(false); }} onClose={() => setShowIconPicker(false)} style={{ position: "fixed", left: 24, top: 120 }} /></div>, document.body)}
              </div>
              <label className="channel-icon-upload"><Upload size={14} /> Upload image<input type="file" accept="image/*" onChange={(e) => setIconFile(e.target.files?.[0] || null)} /></label>
              {iconFile && <small className="help-text">{iconFile.name}</small>}
            </div>

            <div className="form-group">
              <label className="form-label">Description (Optional)</label>
              <textarea
                className="form-textarea"
                placeholder="Describe the purpose of this channel..."
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
              />
            </div>

            <div className="form-group">
              <div className="checkbox-item">
                <div
                  className={`checkbox ${formData.isPrivate ? "checked" : ""}`}
                  onClick={() =>
                    setFormData({ ...formData, isPrivate: !formData.isPrivate })
                  }
                >
                  {formData.isPrivate && <span>✓</span>}
                </div>
                <span className="checkbox-label">
                  Make this channel private
                </span>
              </div>
            </div>

            <div className="modal-actions channel-modal-actions">
              <button
                type="button"
                className="action-btn secondary"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="action-btn primary"
                disabled={loading || !formData.name.trim()}
              >
                {loading ? "Creating..." : "Create Channel"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .channel-modal-overlay{position:fixed;top:57px;right:0;bottom:0;left:0;background:rgba(5,7,10,.72);backdrop-filter:blur(12px);z-index:100000;display:flex;align-items:center;justify-content:center;padding:14px;}
        .channel-modal{width:min(620px,100%);max-height:calc(100vh - 85px);background:linear-gradient(180deg,#171d18,#0b0f0c);border:1px solid rgba(156,255,0,.28);border-radius:14px;box-shadow:0 24px 80px rgba(0,0,0,.7),0 0 40px rgba(156,255,0,.08);overflow:auto;position:relative;}
        .channel-modal-header{position:sticky;top:0;z-index:3;display:flex;align-items:center;justify-content:space-between;padding:16px 20px;background:rgba(15,20,16,.96);border-bottom:1px solid rgba(156,255,0,.18);}
        .channel-modal-body{padding:20px;}
        .channel-modal-actions{display:flex;gap:10px;justify-content:flex-end;}
        .channel-icon-row{display:flex;align-items:center;gap:8px;position:relative;}
        .channel-icon-preview{width:44px;height:44px;border-radius:12px;border:1px solid rgba(156,255,0,.35);background:rgba(156,255,0,.1);font-size:24px;cursor:pointer;flex-shrink:0;}
        .channel-icon-picker-btn{height:40px;border:1px solid rgba(156,255,0,.25);border-radius:9px;background:rgba(156,255,0,.08);color:#caff9a;display:flex;align-items:center;gap:5px;padding:0 10px;cursor:pointer;white-space:nowrap;}
        .channel-icon-picker{position:absolute;left:0;top:100%;z-index:20;}
        @media(max-width:768px){.channel-modal-overlay{top:47px;bottom:56px;padding:8px;align-items:flex-end}.channel-modal{max-height:calc(100vh - 63px);border-radius:14px 14px 8px 8px}.channel-modal-body{padding:14px}.channel-icon-row .form-input{min-width:0}.channel-icon-picker-btn{font-size:0}.channel-icon-picker-btn svg{margin:0}}
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

        .modal {
          width: 100%;
          max-width: 600px;
          height: calc(100vh - 57px);
          background: #0f0f0f;
          border-left: 2px solid rgba(156, 255, 0, 0.3);
          box-shadow: -18px 0 60px rgba(0, 0, 0, 0.6), 0 0 60px rgba(156,255,0,0.08);
          overflow: hidden;
          animation: modalSlideIn 0.35s cubic-bezier(.34,1.56,.64,1);
          display: flex;
          flex-direction: column;
        }

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
          .modal {
            width: 100%;
            height: calc(100vh - 103px);
            max-height: calc(100vh - 103px);
            border: 2px solid rgba(156, 255, 0, 0.3);
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

        .modal-header {
          padding: 10px 16px;
          border-bottom: 2px solid rgba(156, 255, 0, 0.2);
          background: linear-gradient(180deg, rgba(26, 26, 26, 0.9) 0%, rgba(15, 15, 15, 0) 100%);
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
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
          letter-spacing: -0.5px;
          flex: 1;
          text-align: center;
        }

        .close-modal {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(26, 26, 26, 0.6);
          border: none;
          color: #999;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .close-modal:hover {
          background: rgba(26, 26, 26, 0.9);
          border-color: rgba(255, 107, 107, 0.6);
          color: #ff6b6b;
          transform: rotate(90deg);
        }

        .modal-body {
          padding: 24px;
          overflow-y: auto;
          flex: 1;
        }

        .modal-body::-webkit-scrollbar {
          width: 8px;
        }

        .modal-body::-webkit-scrollbar-track {
          background: rgba(26, 26, 26, 0.5);
          border-radius: 4px;
        }

        .modal-body::-webkit-scrollbar-thumb {
          background: rgba(156, 255, 0, 0.4);
          border-radius: 4px;
        }

        .modal-body::-webkit-scrollbar-thumb:hover {
          background: rgba(156, 255, 0, 0.6);
        }

        .error-message {
          padding: 14px 16px;
          background: rgba(255, 107, 107, 0.15);
          border: 2px solid rgba(255, 107, 107, 0.4);
          border-radius: 12px;
          color: #ff6b6b;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 20px;
          animation: shake 0.4s;
        }

        @keyframes shake {
          0%,
          100% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(-8px);
          }
          75% {
            transform: translateX(8px);
          }
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-label {
          display: block;
          font-size: 13px;
          font-weight: 700;
          color: #9cff00;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .channel-type-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        .channel-type-card {
          padding: 16px;
          background: rgba(26, 26, 26, 0.8);
          border: 2px solid rgba(42, 42, 42, 0.8);
          border-radius: 12px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          color: #999;
        }

        .channel-type-card:hover {
          background: rgba(26, 26, 26, 1);
          border-color: rgba(156, 255, 0, 0.4);
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
        }

        .channel-type-card.selected {
          background: rgba(156, 255, 0, 0.1);
          border-color: #9cff00;
          color: #9cff00;
          box-shadow: 0 0 24px rgba(156, 255, 0, 0.3);
        }

        .type-icon {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
        }

        .channel-type-card span {
          font-size: 12px;
          font-weight: 600;
          text-align: center;
        }

        .form-input,
        .form-textarea {
          width: 100%;
          padding: 14px 16px;
          background: rgba(26, 26, 26, 0.8);
          border: 2px solid rgba(42, 42, 42, 0.8);
          border-radius: 12px;
          color: #fff;
          font-size: 14px;
          font-family: inherit;
          transition: all 0.3s;
          outline: none;
        }

        .form-input:focus,
        .form-textarea:focus {
          background: rgba(26, 26, 26, 1);
          border-color: rgba(156, 255, 0, 0.6);
          box-shadow: 0 0 0 4px rgba(156, 255, 0, 0.1);
        }

        .form-input::placeholder,
        .form-textarea::placeholder {
          color: #666;
        }

        .form-textarea {
          resize: vertical;
          min-height: 80px;
        }

        .help-text {
          font-size: 11px;
          color: #666;
          margin-top: 6px;
          display: block;
        }

        .checkbox-item {
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
        }

        .checkbox {
          width: 24px;
          height: 24px;
          border-radius: 6px;
          background: rgba(26, 26, 26, 0.8);
          border: 2px solid rgba(42, 42, 42, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s;
          flex-shrink: 0;
        }

        .checkbox.checked {
          background: rgba(156, 255, 0, 0.3);
          border-color: #9cff00;
        }

        .checkbox span {
          color: #9cff00;
          font-weight: 800;
          font-size: 14px;
        }

        .checkbox-label {
          font-size: 14px;
          color: #fff;
          font-weight: 500;
        }

        .modal-actions {
          display: flex;
          gap: 12px;
          margin-top: 28px;
        }
        .channel-icon-upload{display:inline-flex;align-items:center;gap:6px;margin-top:8px;padding:7px 10px;border:1px dashed rgba(156,255,0,.35);border-radius:8px;color:#9cff00;font-size:11px;font-weight:700;cursor:pointer;background:rgba(156,255,0,.05)}
        .channel-icon-upload input{display:none}

        .action-btn {
          flex: 1;
          padding: 14px 24px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border: 2px solid transparent;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .action-btn.secondary {
          background: rgba(26, 26, 26, 0.8);
          color: #999;
          border-color: rgba(42, 42, 42, 0.8);
        }

        .action-btn.secondary:hover:not(:disabled) {
          background: rgba(26, 26, 26, 1);
          color: #fff;
          border-color: rgba(156, 255, 0, 0.4);
        }

        .action-btn.primary {
          background: linear-gradient(135deg, #9cff00 0%, #667eea 100%);
          color: #000;
          border-color: transparent;
          box-shadow: 0 4px 16px rgba(156, 255, 0, 0.4);
        }

        .action-btn.primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(156, 255, 0, 0.6);
        }

        .action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        @media (max-width: 768px) {
          .modal-title {
            font-size: 16px;
          }
          .channel-type-grid {
            grid-template-columns: 1fr;
          }

          .modal-actions {
            flex-direction: column-reverse;
          }
        }

        @media (max-width: 480px) {
          .modal-header {
            padding: 14px 16px;
          }

          .modal-body {
            padding: 18px 16px;
          }
        }
      `}</style>
    </>,
    document.body
  );
};

export default CreateChannelModal;
