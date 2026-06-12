// ============================================================================
// src/components/Distribution/DistributionStatus.jsx
// Distribution status dashboard - shows where post was published
// ============================================================================

import React, { useState, useEffect } from "react";
import {
  Check, AlertCircle, Clock, RefreshCw, ExternalLink, Copy, Loader,
} from "lucide-react";
import distributionService from "../../services/distribution/distributionService";
import "../Distribution/DistributionStatus.css";

const DistributionStatus = ({ postId, isVisible = true }) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(null);
  const [retrying, setRetrying] = useState(null);

  const platformColors = {
    x: "#000000",
    facebook: "#1877F2",
    instagram: "#E4405F",
    linkedin: "#0A66C2",
  };

  const platformLabels = {
    x: "X",
    facebook: "Facebook",
    instagram: "Instagram",
    linkedin: "LinkedIn",
  };

  // Fetch distribution status
  useEffect(() => {
    if (!isVisible || !postId) return;

    const loadStatus = async () => {
      try {
        const result = await distributionService.getDistributionStatus(postId);
        setStatus(result);
      } catch (error) {
        console.error("Error loading distribution status:", error);
      } finally {
        setLoading(false);
      }
    };

    loadStatus();
    // Poll for updates every 5 seconds
    const interval = setInterval(loadStatus, 5000);

    return () => clearInterval(interval);
  }, [postId, isVisible]);

  const handleRetry = async (platform) => {
    try {
      setRetrying(platform);
      await distributionService.retryFailedDistribution(postId, platform);
      // Reload status
      const result = await distributionService.getDistributionStatus(postId);
      setStatus(result);
    } catch (error) {
      console.error("Error retrying distribution:", error);
    } finally {
      setRetrying(null);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) {
    return (
      <div className="distribution-status loading">
        <Loader size={20} className="spinner" />
        <span>Loading distribution status...</span>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  const { total, successful, failed, pending, byPlatform } = status;

  return (
    <div className="distribution-status-container">
      <div className="status-header">
        <h3>📊 Distribution Status</h3>
        <div className="status-badges">
          <div className="badge success">
            <Check size={14} /> {successful} Success
          </div>
          {failed > 0 && (
            <div className="badge error">
              <AlertCircle size={14} /> {failed} Failed
            </div>
          )}
          {pending > 0 && (
            <div className="badge pending">
              <Clock size={14} /> {pending} Pending
            </div>
          )}
        </div>
      </div>

      <div className="platforms-status">
        {Object.entries(byPlatform).map(([platform, platformStatus]) => (
          <div
            key={platform}
            className={`platform-status-item ${platformStatus.status}`}
          >
            <div className="platform-header">
              <div
                className="platform-dot"
                style={{ backgroundColor: platformColors[platform] }}
              />
              <span className="platform-name">
                {platformLabels[platform] || platform}
              </span>
              <span className={`status-badge ${platformStatus.status}`}>
                {platformStatus.status === "success" && (
                  <>
                    <Check size={14} /> Published
                  </>
                )}
                {platformStatus.status === "failed" && (
                  <>
                    <AlertCircle size={14} /> Failed
                  </>
                )}
                {platformStatus.status === "pending" && (
                  <>
                    <Clock size={14} /> Pending
                  </>
                )}
              </span>
            </div>

            {platformStatus.status === "success" && platformStatus.externalPostId && (
              <div className="platform-details">
                <div className="post-id-row">
                  <span className="label">Post ID:</span>
                  <code>{platformStatus.externalPostId}</code>
                  <button
                    className="copy-btn"
                    onClick={() => copyToClipboard(platformStatus.externalPostId)}
                    title="Copy post ID"
                  >
                    {copied === platformStatus.externalPostId ? (
                      <Check size={14} />
                    ) : (
                      <Copy size={14} />
                    )}
                  </button>
                </div>

                {platformStatus.publishedAt && (
                  <div className="published-at">
                    Published: {new Date(platformStatus.publishedAt).toLocaleString()}
                  </div>
                )}

                <a
                  href={`https://${platform}.com`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="view-btn"
                >
                  <ExternalLink size={14} />
                  View on {platformLabels[platform]}
                </a>
              </div>
            )}

            {platformStatus.status === "failed" && (
              <div className="platform-details error-details">
                {platformStatus.error && (
                  <div className="error-message">
                    <AlertCircle size={14} />
                    <span>{platformStatus.error}</span>
                  </div>
                )}

                <button
                  className="retry-btn"
                  onClick={() => handleRetry(platform)}
                  disabled={retrying === platform}
                >
                  {retrying === platform ? (
                    <>
                      <Loader size={14} className="spinner" />
                      Retrying...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={14} />
                      Retry
                    </>
                  )}
                </button>

                <div className="fallback-notice">
                  <p>
                    💡 Try manual posting or check your platform connection
                  </p>
                </div>
              </div>
            )}

            {platformStatus.status === "pending" && (
              <div className="platform-details pending-details">
                <p>Your post is being published to {platformLabels[platform]}...</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {failed === 0 && pending === 0 && (
        <div className="success-summary">
          <Check size={20} className="check-icon" />
          <div className="summary-text">
            <h4>All platforms updated!</h4>
            <p>Your post has been successfully distributed across all selected platforms.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DistributionStatus;
