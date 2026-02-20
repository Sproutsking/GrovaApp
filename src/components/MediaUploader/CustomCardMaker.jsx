import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Wand2,
  Palette,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Sliders,
  Minus,
  Plus,
  Maximize2,
} from "lucide-react";
import "./CustomCardMaker.css";

const QUICK_MESSAGES = {
  crypto: [
    { text: "GM", icon: "☀️" },
    { text: "GN", icon: "🌙" },
    { text: "WAGMI", icon: "🚀" },
    { text: "LFG", icon: "🔥" },
    { text: "NGMI", icon: "📉" },
    { text: "DYOR", icon: "🔍" },
    { text: "HODL", icon: "💎" },
    { text: "To The Moon", icon: "🌕" },
  ],
  greetings: [
    { text: "Good Morning", icon: "🌅" },
    { text: "Good Night", icon: "✨" },
    { text: "Hello World", icon: "🌍" },
    { text: "Welcome", icon: "👋" },
  ],
  motivation: [
    { text: "Keep Going", icon: "💪" },
    { text: "Never Give Up", icon: "🔥" },
    { text: "You Got This", icon: "✨" },
    { text: "Stay Strong", icon: "🦁" },
  ],
  celebration: [
    { text: "Congrats", icon: "🎉" },
    { text: "Well Done", icon: "👏" },
    { text: "Cheers", icon: "🥂" },
    { text: "Victory", icon: "🏆" },
  ],
};

const GRADIENTS = [
  { id: 1, from: "#667eea", to: "#764ba2" },
  { id: 2, from: "#f093fb", to: "#f5576c" },
  { id: 3, from: "#4facfe", to: "#00f2fe" },
  { id: 4, from: "#43e97b", to: "#38f9d7" },
  { id: 5, from: "#fa709a", to: "#fee140" },
  { id: 6, from: "#30cfd0", to: "#330867" },
  { id: 7, from: "#84cc16", to: "#65a30d" },
  { id: 8, from: "#ff9a9e", to: "#fecfef" },
  { id: 9, from: "#f7971e", to: "#ffd200" },
  { id: 10, from: "#1a1a2e", to: "#0f3460" },
  { id: 11, from: "#11998e", to: "#38ef7d" },
  { id: 12, from: "#c94b4b", to: "#4b134f" },
];

const FONT_SIZE_PRESETS = [
  { label: "Auto", value: null },
  { label: "S", value: 18 },
  { label: "M", value: 26 },
  { label: "L", value: 38 },
  { label: "XL", value: 52 },
  { label: "XXL", value: 68 },
];

// Smart default for preview
const getAutoSize = (text = "") => {
  const chars = text.trim().length;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words <= 2 && chars <= 10) return 56;
  if (words <= 3 && chars <= 22) return 42;
  if (words <= 6 && chars <= 40) return 32;
  if (words <= 10 && chars <= 65) return 26;
  if (chars <= 100) return 21;
  if (chars <= 160) return 18;
  return 15;
};

const CustomCardMaker = ({
  onApply,
  onClose,
  initialValues = {},
  onTextChange,
}) => {
  const [angle, setAngle] = useState(initialValues.angle ?? 135);
  const [color1, setColor1] = useState(initialValues.color1 ?? "#84cc16");
  const [color2, setColor2] = useState(initialValues.color2 ?? "#65a30d");
  const [textColor, setTextColor] = useState(
    initialValues.textColor ?? "#ffffff",
  );
  const [cardText, setCardText] = useState(initialValues.cardText || "");
  const [activeCategory, setActiveCategory] = useState("crypto");
  const [textAlign, setTextAlign] = useState(initialValues.align || "center");
  const [fontSize, setFontSize] = useState(initialValues.fontSize ?? null);

  // ── CARD HEIGHT STATE ──────────────────────────────────────────────────────
  const [cardHeight, setCardHeight] = useState(initialValues.cardHeight || 200);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartHeight, setDragStartHeight] = useState(0);

  const previewRef = useRef(null);

  const gradient = `linear-gradient(${angle}deg, ${color1} 0%, ${color2} 100%)`;
  const previewSize = fontSize !== null ? fontSize : getAutoSize(cardText);

  const alignItems =
    textAlign === "left"
      ? "flex-start"
      : textAlign === "right"
        ? "flex-end"
        : "center";

  const handleQuickMessage = (msg) => {
    const newText = `${msg.icon} ${msg.text}`;
    setCardText(newText);
    if (onTextChange) onTextChange(newText);
  };

  const handleApply = () => {
    onApply({
      gradient,
      textColor,
      angle,
      color1,
      color2,
      cardText,
      align: textAlign,
      fontSize,
      cardHeight: `${cardHeight}px`, // Pass as string with px
    });
    onClose();
  };

  // ── HEIGHT CONTROL HANDLERS ────────────────────────────────────────────────
  const handleHeightChange = (newHeight) => {
    const clamped = Math.max(120, Math.min(600, newHeight));
    setCardHeight(clamped);
  };

  const handleDragStart = (e) => {
    setIsDragging(true);
    setDragStartY(e.clientY);
    setDragStartHeight(cardHeight);
    e.preventDefault();
  };

  const handleDragMove = (e) => {
    if (!isDragging) return;
    const deltaY = e.clientY - dragStartY;
    // Symmetric: dragging down increases height, dragging up decreases
    const newHeight = dragStartHeight + deltaY;
    handleHeightChange(newHeight);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleDragMove);
      document.addEventListener("mouseup", handleDragEnd);
      return () => {
        document.removeEventListener("mousemove", handleDragMove);
        document.removeEventListener("mouseup", handleDragEnd);
      };
    }
  }, [isDragging, dragStartY, dragStartHeight]);

  return (
    <div
      className="ccm-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="ccm-modal">
        {/* ── HEADER ────────────────────────────────────────────────────────── */}
        <div className="ccm-header">
          <div className="ccm-header-left">
            <Wand2 size={24} className="ccm-icon" />
            <h2>Card Designer</h2>
          </div>
          <button className="ccm-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="ccm-body">
          {/* ── LIVE PREVIEW WITH DRAG HANDLES ───────────────────────────────── */}
          <div className="ccm-section">
            <div
              className="ccm-preview-container"
              style={{ position: "relative" }}
            >
              <div
                ref={previewRef}
                className="ccm-preview"
                style={{
                  background: gradient,
                  height: `${cardHeight}px`,
                  cursor: isDragging ? "ns-resize" : "default",
                }}
              >
                <div className="ccm-preview-noise" />
                <div className="ccm-preview-shine" />
                <div
                  className="ccm-preview-text"
                  style={{ textAlign, alignItems, justifyContent: alignItems }}
                >
                  <p
                    style={{
                      color: textColor,
                      fontSize: previewSize,
                      transition: "font-size 0.2s ease",
                    }}
                  >
                    {cardText || "Your message here..."}
                  </p>
                </div>

                {/* Top drag handle */}
                <div
                  className="ccm-drag-handle ccm-drag-handle-top"
                  onMouseDown={handleDragStart}
                  title="Drag to adjust height"
                >
                  <div className="ccm-drag-line" />
                </div>

                {/* Bottom drag handle */}
                <div
                  className="ccm-drag-handle ccm-drag-handle-bottom"
                  onMouseDown={handleDragStart}
                  title="Drag to adjust height"
                >
                  <div className="ccm-drag-line" />
                </div>
              </div>
            </div>
          </div>

          {/* ── CARD HEIGHT CONTROLS ──────────────────────────────────────────── */}
          <div className="ccm-section">
            <label className="ccm-label">
              <Maximize2 size={16} />
              Card Height
            </label>

            <div className="ccm-height-controls">
              {/* Minus button */}
              <button
                className="ccm-height-btn"
                onClick={() => handleHeightChange(cardHeight - 10)}
                title="Decrease height by 10px"
              >
                <Minus size={16} />
              </button>

              {/* Direct input */}
              <input
                type="number"
                className="ccm-height-input"
                value={cardHeight}
                onChange={(e) =>
                  handleHeightChange(parseInt(e.target.value) || 120)
                }
                min={120}
                max={600}
              />

              {/* Plus button */}
              <button
                className="ccm-height-btn"
                onClick={() => handleHeightChange(cardHeight + 10)}
                title="Increase height by 10px"
              >
                <Plus size={16} />
              </button>

              {/* px label */}
              <span className="ccm-height-unit">px</span>
            </div>

            {/* Height slider */}
            <input
              type="range"
              min={120}
              max={600}
              value={cardHeight}
              onChange={(e) => handleHeightChange(parseInt(e.target.value))}
              className="ccm-slider"
              style={{ marginTop: "8px" }}
            />

            <div className="ccm-height-hint">
              Range: 120px - 600px • Drag handles on preview to adjust
            </div>
          </div>

          {/* ── QUICK MESSAGES ───────────────────────────────────────────────── */}
          <div className="ccm-section">
            <label className="ccm-label">
              <Type size={16} />
              Quick Messages
            </label>
            <div className="ccm-categories">
              {Object.keys(QUICK_MESSAGES).map((cat) => (
                <button
                  key={cat}
                  className={`ccm-cat ${activeCategory === cat ? "active" : ""}`}
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="ccm-quick-grid">
              {QUICK_MESSAGES[activeCategory].map((msg, i) => (
                <button
                  key={i}
                  className="ccm-quick-btn"
                  onClick={() => handleQuickMessage(msg)}
                >
                  <span className="ccm-quick-icon">{msg.icon}</span>
                  <span className="ccm-quick-text">{msg.text}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── FONT SIZE ────────────────────────────────────────────────────── */}
          <div className="ccm-section">
            <label className="ccm-label">
              <Type size={16} />
              Font Size
              {fontSize === null && (
                <span className="ccm-label-hint">Auto-scales with content</span>
              )}
            </label>

            <div className="ccm-fontsize-row">
              {FONT_SIZE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  className={`ccm-fontsize-btn ${fontSize === preset.value ? "active" : ""}`}
                  onClick={() => setFontSize(preset.value)}
                  title={
                    preset.value
                      ? `${preset.value}px`
                      : "Smart automatic sizing"
                  }
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {fontSize !== null && (
              <div className="ccm-fontsize-fine">
                <button
                  className="ccm-fontsize-nudge"
                  onClick={() => setFontSize((p) => Math.max(10, p - 2))}
                >
                  <Minus size={14} />
                </button>
                <input
                  type="range"
                  min={10}
                  max={96}
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value))}
                  className="ccm-slider"
                />
                <button
                  className="ccm-fontsize-nudge"
                  onClick={() => setFontSize((p) => Math.min(96, p + 2))}
                >
                  <Plus size={14} />
                </button>
                <span className="ccm-fontsize-value">{fontSize}px</span>
              </div>
            )}
          </div>

          {/* ── GRADIENT PRESETS ─────────────────────────────────────────────── */}
          <div className="ccm-section">
            <label className="ccm-label">
              <Palette size={16} />
              Gradient Presets
            </label>
            <div className="ccm-gradient-grid">
              {GRADIENTS.map((g) => (
                <button
                  key={g.id}
                  className="ccm-gradient-preset"
                  style={{
                    background: `linear-gradient(135deg, ${g.from}, ${g.to})`,
                  }}
                  onClick={() => {
                    setColor1(g.from);
                    setColor2(g.to);
                  }}
                />
              ))}
            </div>
          </div>

          {/* ── CUSTOM COLORS ────────────────────────────────────────────────── */}
          <div className="ccm-section">
            <label className="ccm-label">Custom Colors</label>
            <div className="ccm-color-row">
              <div className="ccm-color-item">
                <label>Color 1</label>
                <input
                  type="color"
                  value={color1}
                  onChange={(e) => setColor1(e.target.value)}
                />
              </div>
              <div className="ccm-color-item">
                <label>Color 2</label>
                <input
                  type="color"
                  value={color2}
                  onChange={(e) => setColor2(e.target.value)}
                />
              </div>
              <div className="ccm-color-item">
                <label>Text</label>
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* ── GRADIENT ANGLE ───────────────────────────────────────────────── */}
          <div className="ccm-section">
            <label className="ccm-label">
              <Sliders size={16} />
              Gradient Angle: {angle}°
            </label>
            <input
              type="range"
              min={0}
              max={360}
              value={angle}
              onChange={(e) => setAngle(parseInt(e.target.value))}
              className="ccm-slider"
            />
          </div>

          {/* ── TEXT ALIGNMENT ───────────────────────────────────────────────── */}
          <div className="ccm-section">
            <label className="ccm-label">Text Alignment</label>
            <div className="ccm-align-btns">
              <button
                className={`ccm-align-btn ${textAlign === "left" ? "active" : ""}`}
                onClick={() => setTextAlign("left")}
              >
                <AlignLeft size={20} />
              </button>
              <button
                className={`ccm-align-btn ${textAlign === "center" ? "active" : ""}`}
                onClick={() => setTextAlign("center")}
              >
                <AlignCenter size={20} />
              </button>
              <button
                className={`ccm-align-btn ${textAlign === "right" ? "active" : ""}`}
                onClick={() => setTextAlign("right")}
              >
                <AlignRight size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* ── FOOTER ───────────────────────────────────────────────────────── */}
        <div className="ccm-footer">
          <button className="ccm-apply" onClick={handleApply}>
            Apply Card Design
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomCardMaker;
