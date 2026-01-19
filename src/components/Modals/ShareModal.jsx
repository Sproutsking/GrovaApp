// ============================================================================
// src/components/Modals/ShareModal.jsx - SHARE INTERFACE
// ============================================================================

import React, { useState } from 'react';
import { X, Copy, Users, Globe, Check, Share2 } from 'lucide-react';
import ShareModel from '../../models/ShareModel';
import { useToast } from '../../contexts/ToastContext';

const ShareModal = ({ content, onClose, currentUser }) => {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const { showToast } = useToast();

  const shareUrl = `${window.location.origin}/${content.type}/${content.id}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      showToast('success', 'Link copied!');
      
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      showToast('error', 'Failed to copy link');
    }
  };

  const handleShare = async (shareType) => {
    if (!currentUser?.id) {
      showToast('warning', 'Please login to share');
      return;
    }

    try {
      setSharing(true);
      
      await ShareModel.shareContent(content.type, content.id, currentUser.id, shareType);
      
      showToast('success', 'Shared successfully!', '+10 EP earned');
      
      setTimeout(() => onClose(), 1000);

    } catch (error) {
      console.error('Share error:', error);
      showToast('error', 'Failed to share');
    } finally {
      setSharing(false);
    }
  };

  return (
    <>
      <div className="share-modal-overlay" onClick={onClose}>
        <div className="share-modal" onClick={(e) => e.stopPropagation()}>
          <div className="share-modal-header">
            <h3>Share</h3>
            <button onClick={onClose}>
              <X size={24} />
            </button>
          </div>

          <div className="share-options">
            <button 
              className="share-option"
              onClick={() => handleShare('profile')}
              disabled={sharing}
            >
              <div className="share-option-icon">
                <Users size={24} />
              </div>
              <div className="share-option-text">
                <div className="share-option-title">Share to Profile</div>
                <div className="share-option-desc">Post to your feed</div>
              </div>
            </button>

            <button 
              className="share-option"
              onClick={() => handleShare('story')}
              disabled={sharing}
            >
              <div className="share-option-icon">
                <Share2 size={24} />
              </div>
              <div className="share-option-text">
                <div className="share-option-title">Share to Story</div>
                <div className="share-option-desc">Add to your story</div>
              </div>
            </button>

            <button 
              className="share-option"
              onClick={() => handleShare('external')}
              disabled={sharing}
            >
              <div className="share-option-icon">
                <Globe size={24} />
              </div>
              <div className="share-option-text">
                <div className="share-option-title">Share Externally</div>
                <div className="share-option-desc">Share outside Grova</div>
              </div>
            </button>
          </div>

          <div className="share-divider">
            <span>or</span>
          </div>

          <div className="share-link-section">
            <div className="share-link-box">
              <input 
                type="text" 
                value={shareUrl} 
                readOnly 
              />
              <button 
                className="copy-link-btn"
                onClick={handleCopyLink}
              >
                {copied ? <Check size={20} /> : <Copy size={20} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .share-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.95);
          backdrop-filter: blur(20px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .share-modal {
          width: 90%;
          max-width: 480px;
          background: #000;
          border: 1px solid rgba(132, 204, 22, 0.3);
          border-radius: 20px;
          overflow: hidden;
        }

        .share-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid rgba(132, 204, 22, 0.2);
          background: rgba(132, 204, 22, 0.05);
        }

        .share-modal-header h3 {
          font-size: 18px;
          font-weight: 700;
          color: #fff;
          margin: 0;
        }

        .share-modal-header button {
          background: none;
          border: none;
          color: #fff;
          cursor: pointer;
          padding: 4px;
          transition: all 0.2s;
        }

        .share-modal-header button:hover {
          color: #84cc16;
        }

        .share-options {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .share-option {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          width: 100%;
          text-align: left;
        }

        .share-option:hover:not(:disabled) {
          background: rgba(132, 204, 22, 0.1);
          border-color: rgba(132, 204, 22, 0.3);
          transform: translateX(4px);
        }

        .share-option:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .share-option-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: rgba(132, 204, 22, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #84cc16;
          flex-shrink: 0;
        }

        .share-option-text {
          flex: 1;
        }

        .share-option-title {
          font-size: 15px;
          font-weight: 600;
          color: #fff;
          margin-bottom: 4px;
        }

        .share-option-desc {
          font-size: 13px;
          color: #737373;
        }

        .share-divider {
          display: flex;
          align-items: center;
          padding: 0 20px;
          margin: 12px 0;
        }

        .share-divider::before,
        .share-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: rgba(255, 255, 255, 0.1);
        }

        .share-divider span {
          padding: 0 12px;
          color: #737373;
          font-size: 13px;
        }

        .share-link-section {
          padding: 20px;
        }

        .share-link-box {
          display: flex;
          gap: 8px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(132, 204, 22, 0.2);
          border-radius: 12px;
          padding: 4px;
        }

        .share-link-box input {
          flex: 1;
          padding: 12px;
          background: none;
          border: none;
          color: #fff;
          font-size: 14px;
          outline: none;
        }

        .copy-link-btn {
          width: 48px;
          height: 48px;
          border-radius: 8px;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          border: none;
          color: #000;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .copy-link-btn:hover {
          transform: scale(1.05);
        }

        @media (max-width: 768px) {
          .share-modal {
            width: 100%;
            max-width: 100%;
            border-radius: 20px 20px 0 0;
            position: fixed;
            bottom: 0;
          }
        }
      `}</style>
    </>
  );
};

export default ShareModal;