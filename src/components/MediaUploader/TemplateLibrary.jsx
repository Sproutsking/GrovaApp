import React, { useState, useEffect } from "react";
import {
  X,
  Image,
  Film,
  BookOpen,
  Play,
  TrendingUp,
  Clock,
  Users,
  Sparkles,
} from "lucide-react";
import templateService from "../../services/templates/templateService";
import "./TemplateLibrary.css";

const TEMPLATE_TABS = [
  { id: "post", name: "Post Templates", icon: <Image size={18} /> },
  { id: "reel", name: "Reel Templates", icon: <Film size={18} /> },
  { id: "story", name: "Story Templates", icon: <BookOpen size={18} /> },
];

const TemplateLibrary = ({ onClose, onSelectTemplate, currentUser }) => {
  const [activeTab, setActiveTab] = useState("reel");
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, [activeTab]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await templateService.getTemplates(activeTab);
      setTemplates(data);
    } catch (error) {
      console.error("Failed to load templates:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateClick = (template) => {
    setSelectedTemplate(template);
    setShowPreview(true);
  };

  const handleUseTemplate = () => {
    if (selectedTemplate && onSelectTemplate) {
      onSelectTemplate(selectedTemplate);
      onClose();
    }
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <div className="template-library-overlay" onClick={onClose}>
      <div className="template-library" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="template-header">
          <div className="template-header-content">
            <Sparkles size={24} />
            <div>
              <h2 className="template-title">Template Library</h2>
              <p className="template-subtitle">
                Professional templates for your content
              </p>
            </div>
          </div>
          <button className="template-close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="template-tabs">
          {TEMPLATE_TABS.map((tab) => (
            <button
              key={tab.id}
              className={`template-tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              <span>{tab.name}</span>
            </button>
          ))}
        </div>

        {/* Templates Grid */}
        <div className="template-content">
          {loading ? (
            <div className="template-loading">
              <div className="spinner" />
              <p>Loading templates...</p>
            </div>
          ) : templates.length === 0 ? (
            <div className="template-empty">
              <Sparkles size={48} />
              <p>No templates available yet</p>
              <p className="template-empty-sub">
                Check back soon for new templates!
              </p>
            </div>
          ) : (
            <div className="templates-grid">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="template-card"
                  onClick={() => handleTemplateClick(template)}
                >
                  <div className="template-preview">
                    {template.thumbnail_url ? (
                      <img src={template.thumbnail_url} alt={template.name} />
                    ) : (
                      <div className="template-placeholder">
                        {activeTab === "post" && <Image size={40} />}
                        {activeTab === "reel" && <Film size={40} />}
                        {activeTab === "story" && <BookOpen size={40} />}
                      </div>
                    )}

                    {template.is_premium && (
                      <div className="template-premium-badge">
                        <Sparkles size={12} />
                        Premium
                      </div>
                    )}

                    {template.is_trending && (
                      <div className="template-trending-badge">
                        <TrendingUp size={12} />
                        Trending
                      </div>
                    )}

                    <div className="template-overlay">
                      <button className="template-preview-btn">
                        <Play size={24} fill="white" />
                        Preview
                      </button>
                    </div>
                  </div>

                  <div className="template-info">
                    <h4 className="template-name">{template.name}</h4>
                    <p className="template-description">
                      {template.description}
                    </p>

                    <div className="template-meta">
                      <span className="template-meta-item">
                        <Clock size={14} />
                        {template.duration}s
                      </span>
                      <span className="template-meta-item">
                        <Users size={14} />
                        {formatNumber(template.uses || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Preview Modal */}
        {showPreview && selectedTemplate && (
          <div
            className="template-preview-modal"
            onClick={() => setShowPreview(false)}
          >
            <div
              className="template-preview-content"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="template-preview-close"
                onClick={() => setShowPreview(false)}
              >
                <X size={20} />
              </button>

              <div className="template-preview-video">
                {selectedTemplate.thumbnail_url ? (
                  <img
                    src={selectedTemplate.thumbnail_url}
                    alt={selectedTemplate.name}
                  />
                ) : (
                  <div className="template-preview-placeholder">
                    <Sparkles size={64} />
                  </div>
                )}
              </div>

              <div className="template-preview-details">
                <h3>{selectedTemplate.name}</h3>
                <p>{selectedTemplate.description}</p>

                <div className="template-features">
                  <h4>Features:</h4>
                  <ul>
                    {selectedTemplate.features?.map((feature, idx) => (
                      <li key={idx}>{feature}</li>
                    ))}
                  </ul>
                </div>

                <button
                  className="template-use-btn"
                  onClick={handleUseTemplate}
                >
                  <Sparkles size={20} />
                  Use This Template
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TemplateLibrary;
