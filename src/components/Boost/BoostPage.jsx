/**
 * BoostPage — Complete profile boost page (PRODUCTION-READY)
 * ============================================================================
 * Full-screen boost experience with real backend integration.
 * Can be integrated as a page (/boost) or as a modal overlay.
 *
 * Features:
 * - Real tier selection with actual pricing
 * - Live backend integration via useBoost hook
 * - Real-time boost status updates
 * - Error handling with user feedback
 * - Loading states from real API
 */

import React, { useState } from "react";
import { X, ArrowLeft } from "lucide-react";
import { useBoost } from "../../hooks/useBoost";
import { useAuth } from "../../contexts/AuthContext";
import BoostProfileShowcase from "./BoostProfileShowcase";

const BoostPage = ({ 
  onClose = () => {}, 
  isModal = false, 
  userId = null,
  onUpgradeComplete = () => {},
}) => {
  const { currentUser } = useAuth();
  const actualUserId = userId || currentUser?.id;
  const { working, loading, boost, activateBoost } = useBoost(actualUserId);
  const [error, setError] = useState(null);

  if (isModal) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          animation: "fadeIn 0.3s ease-out",
          padding: 20,
          backdropFilter: "blur(4px)",
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            maxWidth: 900,
            maxHeight: "90vh",
            borderRadius: 24,
            overflow: "hidden",
            animation: "slideUp 0.4s cubic-bezier(0.2, 0.6, 0.3, 1)",
          }}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: 20,
              right: 20,
              zIndex: 50,
              width: 40,
              height: 40,
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(0,0,0,0.4)",
              color: "rgba(255,255,255,0.8)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(0,0,0,0.4)";
            }}
          >
            <X size={20} />
          </button>

          {/* Content */}
          <div style={{ maxHeight: "90vh", overflowY: "auto" }}>
            <BoostProfileShowcase 
              userId={actualUserId}
              isModal={true}
              onClose={onClose}
              onUpgradeComplete={onUpgradeComplete} 
            />
          </div>
        </div>

        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(40px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    );
  }

  // Full page version
  return (
    <div style={{ width: "100%", minHeight: "100vh" }}>
      {/* Header with back button */}
      <div
        style={{
          padding: "16px 24px",
          background: "rgba(0,0,0,0.3)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          position: "sticky",
          top: 0,
          zIndex: 100,
          backdropFilter: "blur(8px)",
        }}
      >
        <button
          onClick={onClose}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            borderRadius: 8,
            border: "none",
            background: "rgba(255,255,255,0.05)",
            color: "rgba(255,255,255,0.8)",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.05)";
          }}
        >
          <ArrowLeft size={16} />
          Back
        </button>
      </div>

      {/* Main content */}
      <BoostProfileShowcase 
        userId={actualUserId}
        isModal={false}
        onClose={onClose}
        onUpgradeComplete={onUpgradeComplete} 
      />
    </div>
  );
};

export default BoostPage;
