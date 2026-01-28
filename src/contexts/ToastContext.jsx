// src/contexts/ToastContext.jsx - COMPLETE ALL-IN-ONE FILE
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X, Sparkles } from 'lucide-react';

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// ADVANCED TOAST COMPONENT - BUILT INTO THIS FILE
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
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (duration && !isPaused) {
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
  }, [duration, isPaused]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose && onClose();
    }, 300);
  };

  const icons = {
    success: { 
      Icon: CheckCircle, 
      color: '#22c55e', 
      bg: 'rgba(34, 197, 94, 0.15)',
      borderColor: 'rgba(34, 197, 94, 0.3)'
    },
    error: { 
      Icon: XCircle, 
      color: '#ef4444', 
      bg: 'rgba(239, 68, 68, 0.15)',
      borderColor: 'rgba(239, 68, 68, 0.3)'
    },
    warning: { 
      Icon: AlertCircle, 
      color: '#f59e0b', 
      bg: 'rgba(245, 158, 11, 0.15)',
      borderColor: 'rgba(245, 158, 11, 0.3)'
    },
    info: { 
      Icon: Info, 
      color: '#3b82f6', 
      bg: 'rgba(59, 130, 246, 0.15)',
      borderColor: 'rgba(59, 130, 246, 0.3)'
    },
    premium: { 
      Icon: Sparkles, 
      color: '#a855f7', 
      bg: 'rgba(168, 85, 247, 0.15)',
      borderColor: 'rgba(168, 85, 247, 0.3)'
    }
  };

  const { Icon, color, bg, borderColor } = icons[type] || icons.info;

  const positions = {
    'top-right': { 
      top: '24px', 
      right: '24px' 
    },
    'top-left': { 
      top: '24px', 
      left: '24px' 
    },
    'bottom-right': { 
      bottom: '24px', 
      right: '24px' 
    },
    'bottom-left': { 
      bottom: '24px', 
      left: '24px' 
    },
    'top-center': { 
      top: '24px', 
      left: '50%', 
      transform: 'translateX(-50%)' 
    },
    'bottom-center': { 
      bottom: '24px', 
      left: '50%', 
      transform: 'translateX(-50%)' 
    }
  };

  return (
    <>
      <style>{`
        @keyframes toastSlideIn {
          from {
            opacity: 0;
            transform: translateX(${position.includes('right') ? '400px' : position.includes('left') ? '-400px' : '0'}) 
                       translateY(${position.includes('top') ? '-20px' : position.includes('bottom') ? '20px' : '0'})
                       scale(0.9);
          }
          to {
            opacity: 1;
            transform: translateX(0) translateY(0) scale(1);
          }
        }

        @keyframes toastSlideOut {
          from {
            opacity: 1;
            transform: translateX(0) translateY(0) scale(1);
          }
          to {
            opacity: 0;
            transform: translateX(${position.includes('right') ? '400px' : position.includes('left') ? '-400px' : '0'}) 
                       translateY(${position.includes('top') ? '-20px' : position.includes('bottom') ? '20px' : '0'})
                       scale(0.9);
          }
        }

        @keyframes iconPulse {
          0%, 100% { 
            transform: scale(1); 
            opacity: 1;
          }
          50% { 
            transform: scale(1.15); 
            opacity: 0.8;
          }
        }

        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }

        .advanced-toast {
          color: white;
          position: fixed;
          min-width: 340px;
          max-width: 440px;
          z-index: 10000;
          animation: ${isClosing ? 'toastSlideOut' : 'toastSlideIn'} 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          pointer-events: auto;
        }

        .toast-container {
          color: white;
          background: linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%);
          border: 1px solid ${borderColor};
          border-radius: 16px;
          box-shadow: 0 25px 70px rgba(0, 0, 0, 0.95), 
                      0 0 0 1px rgba(255, 255, 255, 0.06),
                      0 0 50px ${bg};
          backdrop-filter: blur(24px);
          overflow: hidden;
          transition: all 0.3s ease;
        }

        .toast-container:hover {
          transform: translateY(-2px);
          box-shadow: 0 30px 80px rgba(0, 0, 0, 0.95), 
                      0 0 0 1px rgba(255, 255, 255, 0.08),
                      0 0 60px ${bg};
        }

        .toast-content {
        color: white;
          padding: 20px 22px;
          display: flex;
          gap: 16px;
          align-items: flex-start;
        }

        .toast-icon-wrapper {
          flex-shrink: 0;
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: ${bg};
          display: flex;
          align-items: center;
          justify-content: center;
          animation: iconPulse 2.5s ease-in-out infinite;
          position: relative;
          overflow: hidden;
        }

        .toast-icon-wrapper::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: linear-gradient(
            90deg, 
            transparent 0%, 
            ${color}22 50%, 
            transparent 100%
          );
          background-size: 200% 100%;
          animation: shimmer 3s ease-in-out infinite;
        }

        .toast-text {
          color: #ffffff;
          flex: 1;
          min-width: 0;
        }

        .toast-message {
          font-size: 15px;
          font-weight: 700;
          color: #ffffff;
          margin: 0 0 4px 0;
          line-height: 1.5;
          letter-spacing: -0.01em;
        }

        .toast-description {
          font-size: 13px;
          color: #ffffff;
          margin: 0;
          line-height: 1.6;
        }

        .toast-close-btn {
          flex-shrink: 0;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #737373;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .toast-close-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
          color: #ffffff;
          transform: scale(1.1);
        }

        .toast-close-btn:active {
          transform: scale(0.95);
        }

        .toast-progress {
          height: 4px;
          background: rgba(255, 255, 255, 0.08);
          overflow: hidden;
          position: relative;
        }

        .toast-progress-bar {
          height: 100%;
          background: linear-gradient(90deg, ${color} 0%, ${color}dd 100%);
          transition: width 0.1s linear;
          box-shadow: 0 0 12px ${color}88, 0 0 4px ${color};
          position: relative;
        }

        .toast-progress-bar::after {
          content: '';
          position: absolute;
          top: 0;
          right: 0;
          width: 40px;
          height: 100%;
          background: linear-gradient(90deg, transparent 0%, ${color} 100%);
          opacity: 0.6;
        }

        @media (max-width: 640px) {
          .advanced-toast {
            left: 12px !important;
            right: 12px !important;
            min-width: auto;
            max-width: none;
            transform: none !important;
          }

          .toast-content {
            padding: 16px 18px;
          }

          .toast-icon-wrapper {
            width: 40px;
            height: 40px;
          }

          .toast-message {
            font-size: 14px;
          }

          .toast-description {
            font-size: 12px;
          }
        }
      `}</style>

      <div 
        className="advanced-toast" 
        style={positions[position]}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div className="toast-container">
          <div className="toast-content">
            <div className="toast-icon-wrapper">
              <Icon size={22} color={color} strokeWidth={2.5} style={{ zIndex: 1 }} />
            </div>
            
            <div className="toast-text">
              <p className="toast-message">{message}</p>
              {description && <p className="toast-description">{description}</p>}
            </div>
            
            <button 
              className="toast-close-btn" 
              onClick={handleClose}
              aria-label="Close notification"
            >
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

// TOAST PROVIDER WITH BUILT-IN COMPONENT
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback(({
    type = 'success',
    message,
    description,
    duration = 5000,
    position = 'top-right',
    showProgress = true
  }) => {
    const id = Date.now() + Math.random();
    
    const newToast = {
      id,
      type,
      message,
      description,
      duration,
      position,
      showProgress
    };

    setToasts(prev => [...prev, newToast]);

    if (duration) {
      setTimeout(() => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
      }, duration + 500);
    }

    return id;
  }, []);

  const hideToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const hideAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const success = useCallback((message, description, options = {}) => {
    return showToast({ type: 'success', message, description, ...options });
  }, [showToast]);

  const error = useCallback((message, description, options = {}) => {
    return showToast({ type: 'error', message, description, ...options });
  }, [showToast]);

  const warning = useCallback((message, description, options = {}) => {
    return showToast({ type: 'warning', message, description, ...options });
  }, [showToast]);

  const info = useCallback((message, description, options = {}) => {
    return showToast({ type: 'info', message, description, ...options });
  }, [showToast]);

  const premium = useCallback((message, description, options = {}) => {
    return showToast({ type: 'premium', message, description, ...options });
  }, [showToast]);

  const value = {
    showToast,
    hideToast,
    hideAllToasts,
    success,
    error,
    warning,
    info,
    premium
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.map(toast => (
        <AdvancedToast
          key={toast.id}
          type={toast.type}
          message={toast.message}
          description={toast.description}
          duration={toast.duration}
          position={toast.position}
          showProgress={toast.showProgress}
          onClose={() => hideToast(toast.id)}
        />
      ))}
    </ToastContext.Provider>
  );
};

export default ToastProvider;