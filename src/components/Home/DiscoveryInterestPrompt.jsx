import React, { useEffect, useState, useCallback } from "react";
import { Button } from "../Shared/Buttons"; // optional, fallback to native if missing
import { recordSignal } from "../../services/discovery/discoveryPersonalizationModel";

const DiscoveryInterestPrompt = ({ item, onClose }) => {
  const [visible, setVisible] = useState(!!item);

  useEffect(() => { setVisible(!!item); }, [item]);

  const handleInterest = useCallback(() => {
    if (item) {
      recordSignal(item, "INTEREST");
    }
    setVisible(false);
    onClose?.();
  }, [item, onClose]);

  const handleNotInterested = useCallback(() => {
    if (item) {
      recordSignal(item, "HIDE");
    }
    setVisible(false);
    onClose?.();
  }, [item, onClose]);

  if (!visible || !item) return null;

  return (
    <div className="dip-root" role="dialog" aria-live="polite">
      <div className="dip-card">
        <div className="dip-thumb" style={{ backgroundImage: `url(${item.thumbnailUrl || item.videoUrl || ""})` }} />
        <div className="dip-body">
          <div className="dip-title">Love to see more of this?</div>
          <div className="dip-sub">{item.title}</div>
          <div className="dip-actions">
            <button className="dip-btn dip-btn--primary" onClick={handleInterest}>Yes — show more</button>
            <button className="dip-btn" onClick={handleNotInterested}>No — not for me</button>
          </div>
        </div>
      </div>
      <style>{`
      .dip-root{position:fixed;left:12px;right:12px;bottom:18px;z-index:1200;display:flex;justify-content:center}
      .dip-card{width:100%;max-width:760px;background:rgba(6,6,7,0.92);border:1px solid rgba(255,255,255,0.06);border-radius:14px;display:flex;gap:12px;padding:10px;align-items:center;box-shadow:0 10px 30px rgba(0,0,0,0.6)}
      .dip-thumb{width:72px;height:72px;border-radius:10px;background-size:cover;background-position:center;flex-shrink:0}
      .dip-body{flex:1;color:rgba(255,255,255,0.9)}
      .dip-title{font-weight:800;font-size:14px}
      .dip-sub{font-size:12px;color:rgba(255,255,255,0.6);margin-top:4px}
      .dip-actions{margin-top:8px;display:flex;gap:8px}
      .dip-btn{padding:8px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.06);background:transparent;color:rgba(255,255,255,0.9);cursor:pointer}
      .dip-btn--primary{background:linear-gradient(90deg,#84cc16,#06b6d4);border:none;color:#000;font-weight:800}
      `}</style>
    </div>
  );
};

export default DiscoveryInterestPrompt;
