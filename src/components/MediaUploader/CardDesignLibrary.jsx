import React from "react";
import "./CardDesignLibrary.css";

export const DESIGN_LIBRARY_PRESETS = [
  {
    id: "sunrise-glow",
    name: "Sunrise Glow",
    category: "library",
    description: "Warm and bright",
    from: "#FFCF8C",
    to: "#FF6A5C",
    textColor: "#ffffff",
    angle: 135,
  },
  {
    id: "midnight-mist",
    name: "Midnight Mist",
    category: "library",
    description: "Deep and cinematic",
    from: "#0F0C29",
    to: "#302B63",
    textColor: "#ffffff",
    angle: 135,
  },
  {
    id: "mint-rose",
    name: "Mint Rose",
    category: "library",
    description: "Soft and airy",
    from: "#A8E6CF",
    to: "#FFB4B4",
    textColor: "#1b1b1b",
    angle: 135,
  },
  {
    id: "violet-echo",
    name: "Violet Echo",
    category: "library",
    description: "Rich and moody",
    from: "#2E1065",
    to: "#7C3AED",
    textColor: "#ffffff",
    angle: 135,
  },
  {
    id: "golden-hour",
    name: "Golden Hour",
    category: "library",
    description: "Light and radiant",
    from: "#F7971E",
    to: "#FFD200",
    textColor: "#1f1a12",
    angle: 135,
  },
  {
    id: "citrus-pop",
    name: "Citrus Pop",
    category: "library",
    description: "Playful energy",
    from: "#FDE68A",
    to: "#F97316",
    textColor: "#1f1a12",
    angle: 135,
  },
  {
    id: "ocean-depth",
    name: "Ocean Depth",
    category: "library",
    description: "Cool and clean",
    from: "#003973",
    to: "#7FB3D5",
    textColor: "#ffffff",
    angle: 135,
  },
  {
    id: "rose-silk",
    name: "Rose Silhouette",
    category: "library",
    description: "Soft luxury",
    from: "#F857A6",
    to: "#FF5858",
    textColor: "#ffffff",
    angle: 135,
  },
  {
    id: "forest-ink",
    name: "Forest Ink",
    category: "texture",
    description: "Dark green luxe",
    from: "#04202C",
    to: "#0C4A3E",
    textColor: "#eefaf5",
    angle: 135,
  },
  {
    id: "plum-night",
    name: "Plum Night",
    category: "texture",
    description: "Noir with softness",
    from: "#3C1053",
    to: "#AD5389",
    textColor: "#fff7fb",
    angle: 135,
  },
  {
    id: "stone-warmth",
    name: "Stone Warmth",
    category: "texture",
    description: "Neutral sunlight",
    from: "#EDEBE6",
    to: "#DAD5CC",
    textColor: "#1c1b19",
    angle: 135,
  },
  {
    id: "neon-night",
    name: "Neon Night",
    category: "texture",
    description: "Bold edge glow",
    from: "#0A0A0F",
    to: "#1E1B4B",
    textColor: "#f8f8ff",
    angle: 135,
  },
];

const TABS = [
  { id: "library", label: "Library" },
  { id: "texture", label: "Texture" },
  { id: "gradient", label: "Gradient" },
];

const CardDesignLibrary = ({
  activePresetId,
  onSelectPreset,
  onSelectGradient,
  gradientPresets,
  activeGradientId,
}) => {
  const [activeTab, setActiveTab] = React.useState("library");

  const filteredPresets = DESIGN_LIBRARY_PRESETS.filter(
    (preset) => preset.category === activeTab || activeTab === "library"
  );

  return (
    <div className="cdl-wrap">
      <div className="cdl-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`cdl-tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "gradient" ? (
        <div className="cdl-gradient-grid">
          {gradientPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`cdl-gradient-swatch ${activeGradientId === preset.id ? "active" : ""}`}
              style={{ background: `linear-gradient(135deg, ${preset.from}, ${preset.to})` }}
              onClick={() => onSelectGradient(preset)}
              aria-label={preset.name || "Gradient preset"}
            />
          ))}
        </div>
      ) : (
        <div className="cdl-grid">
          {filteredPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`cdl-card ${activePresetId === preset.id ? "active" : ""}`}
              onClick={() => onSelectPreset(preset)}
            >
              <div
                className="cdl-preview"
                style={{
                  background: `linear-gradient(${preset.angle ?? 135}deg, ${preset.from}, ${preset.to})`,
                  color: preset.textColor || "#ffffff",
                }}
              >
                <span className="cdl-preview-tag">{preset.name}</span>
                <span className="cdl-preview-title">Good morning</span>
              </div>
              <div className="cdl-meta">
                <strong>{preset.name}</strong>
                <span>{preset.description}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CardDesignLibrary;
