import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X, Sparkles } from 'lucide-react';

const AdvancedToast = ({ 
  type = 'success', 
  message, 
  description,
  onClose, 
  duration = 5000,
  position = 'top-right',
  showProgress = true 
}) => {
  const [progress, setProgress] = useState(100);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (duration) {
      const interval = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev - (100 / (duration / 100));
          if (newProgress <= 0) {
            handleClose();
            return 0;
          }
          return newProgress;
        });
      }, 100);

      return () => clearInterval(interval);
    }
  }, [duration]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose && onClose();
    }, 300);
  };

  const icons = {
    success: { Icon: CheckCircle, color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)' },
    error: { Icon: XCircle, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
    warning: { Icon: AlertCircle, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
    info: { Icon: Info, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
    premium: { Icon: Sparkles, color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)' }
  };

  const { Icon, color, bg } = icons[type] || icons.info;

  const positions = {
    'top-right': { top: '24px', right: '24px' },
    'top-left': { top: '24px', left: '24px' },
    'bottom-right': { bottom: '24px', right: '24px' },
    'bottom-left': { bottom: '24px', left: '24px' },
    'top-center': { top: '24px', left: '50%', transform: 'translateX(-50%)' },
    'bottom-center': { bottom: '24px', left: '50%', transform: 'translateX(-50%)' }
  };

  return (
    <>
      <style>{`
        @keyframes toastSlideIn {
          from {
            opacity: 0;
            transform: translateX(${position.includes('right') ? '400px' : position.includes('left') ? '-400px' : '0'}) 
                       translateY(${position.includes('top') ? '-20px' : position.includes('bottom') ? '20px' : '0'});
          }
          to {
            opacity: 1;
            transform: translateX(0) translateY(0);
          }
        }

        @keyframes toastSlideOut {
          from {
            opacity: 1;
            transform: translateX(0) translateY(0);
          }
          to {
            opacity: 0;
            transform: translateX(${position.includes('right') ? '400px' : position.includes('left') ? '-400px' : '0'}) 
                       translateY(${position.includes('top') ? '-20px' : position.includes('bottom') ? '20px' : '0'});
          }
        }

        @keyframes progressBar {
          from { width: 100%; }
          to { width: 0%; }
        }

        .advanced-toast {
          position: fixed;
          min-width: 320px;
          max-width: 420px;
          z-index: 10000;
          animation: ${isClosing ? 'toastSlideOut' : 'toastSlideIn'} 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .toast-container {
          background: #0f0f0f;
          border: 1px solid rgba(132, 204, 22, 0.3);
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.9), 
                      0 0 0 1px rgba(255, 255, 255, 0.05),
                      0 0 40px ${bg};
          backdrop-filter: blur(20px);
          overflow: hidden;
        }

        .toast-content {
          padding: 18px 20px;
          display: flex;
          gap: 14px;
        }

        .toast-icon-wrapper {
          flex-shrink: 0;
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: ${bg};
          display: flex;
          align-items: center;
          justify-content: center;
          animation: iconPulse 2s ease-in-out infinite;
        }

        @keyframes iconPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }

        .toast-text {
          flex: 1;
          min-width: 0;
        }

        .toast-message {
          font-size: 15px;
          font-weight: 700;
          color: #ffffff;
          margin: 0 0 4px 0;
          line-height: 1.4;
        }

        .toast-description {
          font-size: 13px;
          color: #a3a3a3;
          margin: 0;
          line-height: 1.5;
        }

        .toast-close-btn {
          flex-shrink: 0;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #737373;
          cursor: pointer;
          transition: all 0.2s;
        }

        .toast-close-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
          color: #ffffff;
        }

        .toast-progress {
          height: 3px;
          background: rgba(255, 255, 255, 0.1);
          overflow: hidden;
        }

        .toast-progress-bar {
          height: 100%;
          background: linear-gradient(90deg, ${color} 0%, ${color}cc 100%);
          transition: width 0.1s linear;
          box-shadow: 0 0 10px ${color};
        }

        @media (max-width: 640px) {
          .advanced-toast {
            left: 16px !important;
            right: 16px !important;
            min-width: auto;
            max-width: none;
            transform: none !important;
          }
        }
      `}</style>

      <div className="advanced-toast" style={positions[position]}>
        <div className="toast-container">
          <div className="toast-content">
            <div className="toast-icon-wrapper">
              <Icon size={22} color={color} strokeWidth={2.5} />
            </div>
            
            <div className="toast-text">
              <p className="toast-message">{message}</p>
              {description && <p className="toast-description">{description}</p>}
            </div>
            
            <button className="toast-close-btn" onClick={handleClose}>
              <X size={16} />
            </button>
          </div>
          
          {showProgress && duration && (
            <div className="toast-progress">
              <div 
                className="toast-progress-bar" 
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default AdvancedToast;