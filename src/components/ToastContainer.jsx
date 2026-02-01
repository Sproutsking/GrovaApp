import React, { useState, useEffect, useCallback } from "react";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";

// Toast types
const TOAST_TYPES = {
  SUCCESS: "success",
  ERROR: "error",
  INFO: "info",
  WARNING: "warning",
};

const TOAST_DURATION = 3000;

// Toast manager singleton
class ToastManager {
  constructor() {
    this.listeners = [];
    this.toasts = [];
    this.idCounter = 0;
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach((listener) => listener(this.toasts));
  }

  show(message, type = TOAST_TYPES.INFO, duration = TOAST_DURATION) {
    const id = ++this.idCounter;
    const toast = { id, message, type, duration };
    this.toasts.push(toast);
    this.notify();

    if (duration > 0) {
      setTimeout(() => this.remove(id), duration);
    }

    return id;
  }

  remove(id) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notify();
  }

  success(message, duration) {
    return this.show(message, TOAST_TYPES.SUCCESS, duration);
  }

  error(message, duration) {
    return this.show(message, TOAST_TYPES.ERROR, duration);
  }

  info(message, duration) {
    return this.show(message, TOAST_TYPES.INFO, duration);
  }

  warning(message, duration) {
    return this.show(message, TOAST_TYPES.WARNING, duration);
  }

  clear() {
    this.toasts = [];
    this.notify();
  }
}

export const toast = new ToastManager();

const Toast = ({ id, message, type, onClose }) => {
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onClose(id), 300);
  };

  const getIcon = () => {
    switch (type) {
      case TOAST_TYPES.SUCCESS:
        return <CheckCircle size={20} />;
      case TOAST_TYPES.ERROR:
        return <AlertCircle size={20} />;
      case TOAST_TYPES.WARNING:
        return <AlertTriangle size={20} />;
      default:
        return <Info size={20} />;
    }
  };

  const getColor = () => {
    switch (type) {
      case TOAST_TYPES.SUCCESS:
        return {
          bg: "rgba(34, 197, 94, 0.15)",
          border: "rgba(34, 197, 94, 0.5)",
          color: "#22c55e",
        };
      case TOAST_TYPES.ERROR:
        return {
          bg: "rgba(239, 68, 68, 0.15)",
          border: "rgba(239, 68, 68, 0.5)",
          color: "#ef4444",
        };
      case TOAST_TYPES.WARNING:
        return {
          bg: "rgba(245, 158, 11, 0.15)",
          border: "rgba(245, 158, 11, 0.5)",
          color: "#f59e0b",
        };
      default:
        return {
          bg: "rgba(59, 130, 246, 0.15)",
          border: "rgba(59, 130, 246, 0.5)",
          color: "#3b82f6",
        };
    }
  };

  const colors = getColor();

  return (
    <div
      className={`toast-item ${isExiting ? "toast-exit" : ""}`}
      style={{ background: colors.bg, borderColor: colors.border }}
    >
      <div className="toast-icon" style={{ color: colors.color }}>
        {getIcon()}
      </div>
      <div className="toast-message">{message}</div>
      <button
        className="toast-close"
        onClick={handleClose}
        style={{ color: colors.color }}
      >
        <X size={16} />
      </button>
    </div>
  );
};

const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    return toast.subscribe(setToasts);
  }, []);

  const handleClose = useCallback((id) => {
    toast.remove(id);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <Toast
          key={t.id}
          id={t.id}
          message={t.message}
          type={t.type}
          onClose={handleClose}
        />
      ))}

      <style>{`
        .toast-container {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 100000;
          display: flex;
          flex-direction: column;
          gap: 12px;
          pointer-events: none;
        }
        .toast-item {
          pointer-events: all;
          min-width: 320px;
          max-width: 450px;
          padding: 16px 20px;
          border-radius: 12px;
          border: 2px solid;
          backdrop-filter: blur(20px);
          display: flex;
          align-items: center;
          gap: 12px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
          animation: toastSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .toast-item.toast-exit {
          animation: toastSlideOut 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateX(100%) scale(0.95); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes toastSlideOut {
          from { opacity: 1; transform: translateX(0) scale(1); }
          to { opacity: 0; transform: translateX(100%) scale(0.95); }
        }
        .toast-icon {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .toast-message {
          flex: 1;
          color: #fff;
          font-size: 14px;
          font-weight: 500;
          line-height: 1.5;
        }
        .toast-close {
          flex-shrink: 0;
          width: 28px;
          height: 28px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.1);
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .toast-close:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: scale(1.1);
        }
        @media (max-width: 768px) {
          .toast-container { top: 10px; right: 10px; left: 10px; }
          .toast-item { min-width: unset; width: 100%; }
        }
      `}</style>
    </div>
  );
};

export default ToastContainer;
export { TOAST_TYPES };
