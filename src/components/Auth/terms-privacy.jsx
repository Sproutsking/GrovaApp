import React, { useEffect, useState } from "react";
import { ArrowBigLeft } from "lucide-react";

return (
  <div className="terms-privacy-container">
    <div className="terms-privacy-header">
      <div className="terms-privacy-title">Terms & Privacy</div>
      <button className="arrow-back-close">
        <ArrowUpLeft size={20} />
      </button>
    </div>
    <div className="terms">
      <div className="terms-header">
        <h3 className="terms-title">terms</h3>
      </div>
      <div className="terms-content-container">
        <div className="terms-contents"></div>
        <div className="terms-footer"></div>
      </div>
    </div>
    <div className="privacy">
      <div className="privacy-header">
        <div className="privacy-title">Privacy</div>
      </div>
      <div className="Privacy-content-container">
        <div className="Privacy-contents"></div>
        <div className="Privacy-footer"></div>
      </div>
    </div>
  </div>
);

export default terms - privacy;
