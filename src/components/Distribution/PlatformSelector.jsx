// ============================================================================
// src/components/Distribution/PlatformSelector.jsx
// Platform selection UI for cross-posting
// ============================================================================

import React, { useState, useEffect } from "react";
import {
  Check, X as XIcon, Facebook as FacebookIcon, Linkedin as LinkedInIcon,
  Camera, ChevronDown, ToggleRight, ToggleLeft, Settings, Info,
} from "lucide-react";
import distributionService from "../../services/distribution/distributionService";
import "../Distribution/PlatformSelector.css";

const PlatformSelector = ({ userId, onSelection, initialSelection = [] }) => {
  const [selectedPlatforms, setSelectedPlatforms] = useState(initialSelection);
  const [connectedPlatforms, setConnectedPlatforms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [useGlobalDefault, setUseGlobalDefault] = useState(true);

  const platforms = {
    x: {
      name: "X",
      icon: "𝕏",
      color: "#000000",
      description: "Tweet & retweet",
    },
    facebook: {
      name: "Facebook",
      icon: FacebookIcon,
      color: "#1877F2",
      description: "Share with friends",
    },
    instagram: {
      name: "Instagram",
      icon: Camera,
      color: "#E4405F",
      description: "Visual stories",
    },
    linkedin: {
      name: "LinkedIn",
      icon: LinkedInIcon,
      color: "#0A66C2",
      description: "Professional network",
    },
  };

  // Load connected platforms and preferences
  useEffect(() => {
    const loadData = async () => {
      try {
        const connected = await distributionService.getConnectedPlatforms(userId);
        const prefs = await distributionService.getPlatformPreferences(userId);

        setConnectedPlatforms(connected);
        setPreferences(prefs);
        setUseGlobalDefault(prefs?.global_default_enabled ?? true);

        // Pre-select based on preferences
        if (!initialSelection.length) {
          if (prefs?.global_default_enabled) {
            setSelectedPlatforms(connected);
          } else {
            const enabledPlatforms = Object.keys(prefs?.platform_preferences || {})
              .filter(p => prefs.platform_preferences[p]?.enabled);
            setSelectedPlatforms(enabledPlatforms);
          }
        }
      } catch (error) {
        console.error("Error loading platform data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [userId, initialSelection]);

  const togglePlatform = (platform) => {
    setSelectedPlatforms(prev => {
      if (prev.includes(platform)) {
        return prev.filter(p => p !== platform);
      } else {
        return [...prev, platform];
      }
    });
  };

  const toggleGlobalDefault = async () => {
    const newValue = !useGlobalDefault;
    setUseGlobalDefault(newValue);

    try {
      await distributionService.setPlatformPreferences(userId, {
        ...preferences,
        global_default_enabled: newValue,
      });

      // Auto-select all connected if enabling global default
      if (newValue) {
        setSelectedPlatforms(connectedPlatforms);
      }
    } catch (error) {
      console.error("Error updating preferences:", error);
      setUseGlobalDefault(!newValue); // Revert on error
    }
  };

  const savePreferences = async () => {
    try {
      // Save individual platform preferences
      const platformPrefs = Object.keys(platforms).reduce((acc, platform) => {
        acc[platform] = {
          enabled: selectedPlatforms.includes(platform),
        };
        return acc;
      }, {});

      await distributionService.setPlatformPreferences(userId, {
        platform_preferences: platformPrefs,
        global_default_enabled: useGlobalDefault,
        auto_retry: preferences?.auto_retry ?? true,
      });

      setShowSettings(false);
    } catch (error) {
      console.error("Error saving preferences:", error);
    }
  };

  // Notify parent of selection
  useEffect(() => {
    onSelection?.(selectedPlatforms);
  }, [selectedPlatforms]);

  if (loading) {
    return <div className="platform-selector loading">Loading platforms...</div>;
  }

  return (
    <div className="platform-selector-container">
      {/* Main selector */}
      <div className="platform-selector">
        <div className="selector-header">
          <h3>📢 Distribute To</h3>
          <button
            className="settings-btn"
            onClick={() => setShowSettings(!showSettings)}
            title="Distribution settings"
          >
            <Settings size={18} />
          </button>
        </div>

        <div className="platforms-grid">
          {Object.entries(platforms).map(([key, platform]) => {
            const isConnected = connectedPlatforms.includes(key);
            const isSelected = selectedPlatforms.includes(key);

            return (
              <div
                key={key}
                className={`platform-card ${
                  isConnected ? "connected" : "disconnected"
                } ${isSelected ? "selected" : ""}`}
                onClick={() => isConnected && togglePlatform(key)}
              >
                <div className="platform-icon" style={{ borderColor: platform.color }}>
                  {typeof platform.icon === "string" ? (
                    <span className="text-icon">{platform.icon}</span>
                  ) : (
                    <platform.icon size={24} color={platform.color} />
                  )}
                </div>

                <div className="platform-info">
                  <h4>{platform.name}</h4>
                  <p className="description">{platform.description}</p>
                </div>

                {isConnected ? (
                  <div className="status-indicator">
                    {isSelected ? (
                      <Check size={20} className="check-icon" />
                    ) : (
                      <div className="unchecked" />
                    )}
                  </div>
                ) : (
                  <div className="status-indicator disconnected-badge">
                    <XIcon size={16} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="selection-summary">
          {selectedPlatforms.length > 0 ? (
            <>
              <Check size={16} className="check-icon" />
              <span>
                Posting to {selectedPlatforms.length} platform{selectedPlatforms.length !== 1 ? "s" : ""}
              </span>
            </>
          ) : (
            <>
              <Info size={16} />
              <span>No platforms selected - post will only be on Xeevia</span>
            </>
          )}
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="platform-settings-panel">
          <div className="settings-header">
            <h4>⚙️ Distribution Settings</h4>
            <button
              className="close-btn"
              onClick={() => setShowSettings(false)}
            >
              ✕
            </button>
          </div>

          <div className="settings-content">
            <div className="setting-item">
              <div className="setting-label">
                <h5>Post Everywhere (Default)</h5>
                <p>Automatically post to all connected platforms</p>
              </div>
              <button
                className={`toggle-btn ${useGlobalDefault ? "enabled" : ""}`}
                onClick={toggleGlobalDefault}
              >
                {useGlobalDefault ? (
                  <ToggleRight size={24} />
                ) : (
                  <ToggleLeft size={24} />
                )}
              </button>
            </div>

            <div className="divider" />

            <div className="setting-info">
              <h5>Per-Platform Settings</h5>
              {Object.entries(platforms).map(([key, platform]) => {
                const isConnected = connectedPlatforms.includes(key);
                const isEnabled = selectedPlatforms.includes(key);

                return (
                  <div key={key} className="platform-setting">
                    <label>
                      <input
                        type="checkbox"
                        checked={isEnabled && isConnected}
                        onChange={() => isConnected && togglePlatform(key)}
                        disabled={!isConnected}
                      />
                      <span className={!isConnected ? "disabled" : ""}>
                        {platform.name}
                      </span>
                    </label>
                    {!isConnected && (
                      <span className="not-connected">Not connected</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="settings-footer">
              <button
                className="save-btn"
                onClick={savePreferences}
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlatformSelector;
