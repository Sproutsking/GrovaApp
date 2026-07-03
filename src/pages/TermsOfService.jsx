import React, { useEffect } from "react";
import { ArrowLeft } from "lucide-react";

export default function TermsOfService() {
  // Secure back button handling - prevents bridging into the app
  const handleBackClick = () => {
    // Clear any app state when going back
    if (window.localStorage) {
      const tempData = {
        ...JSON.parse(localStorage.getItem("grova_auth_temp") || "{}"),
        auth_wall_return: true,
      };
      localStorage.setItem("grova_auth_temp", JSON.stringify(tempData));
    }
    // Navigate back to auth wall, not into app
    window.location.href = "/";
  };

  useEffect(() => {
    // Prevent any accidental navigation into the app
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        handleBackClick();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "linear-gradient(135deg, #020804 0%, #050706 100%)",
        color: "#d4e1d4",
        fontFamily: "'DM Sans', sans-serif",
        padding: "24px 20px",
      }}
    >
      <style>{`
        .terms-header {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          background: rgba(5, 7, 6, 0.95);
          backdrop-filter: blur(8px);
          border-bottom: 1px solid rgba(168, 230, 61, 0.1);
          padding: 16px 20px;
          z-index: 200;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .terms-back-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 10px;
          border: 1.5px solid rgba(168, 230, 61, 0.3);
          background: rgba(168, 230, 61, 0.08);
          color: #a8e63d;
          cursor: pointer;
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
          transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
          user-select: none;
        }
        .terms-back-btn:hover {
          background: rgba(168, 230, 61, 0.15);
          border-color: rgba(168, 230, 61, 0.6);
          transform: translateX(-3px);
          box-shadow: 0 8px 24px rgba(168, 230, 61, 0.15);
        }
        .terms-back-btn:active {
          transform: translateX(-1px);
        }
        .terms-header-title {
          font-size: 15px;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: "-0.3px";
        }
        .terms-container {
          max-width: 780px;
          margin: 0 auto;
          padding-top: 80px;
        }
        .terms-container h1 {
          font-size: 36px;
          font-weight: 900;
          margin-bottom: 8px;
          color: #ffffff;
          letter-spacing: "-0.8px";
          text-shadow: 0 0 20px rgba(168, 230, 61, 0.15);
        }
        .terms-container .updated-date {
          font-size: 13px;
          color: #5a7a5a;
          margin-bottom: 32px;
          font-weight: 500;
        }
        .terms-container h2 {
          font-size: 20px;
          font-weight: 700;
          margin-top: 36px;
          margin-bottom: 14px;
          color: #c8f56a;
          letter-spacing: "-0.3px";
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .terms-container h2::before {
          content: '';
          display: inline-block;
          width: 4px;
          height: 4px;
          background: #a8e63d;
          border-radius: 50%;
        }
        .terms-container p, .terms-container li {
          font-size: 14px;
          line-height: 1.8;
          color: #b8d8a0;
          margin-bottom: 14px;
          font-weight: 500;
        }
        .terms-container strong {
          color: #d4fc72;
          font-weight: 700;
        }
        .terms-container ul {
          margin: 14px 0 14px 24px;
          padding: 0;
        }
        .terms-container li {
          margin-bottom: 10px;
          color: #b8d8a0;
        }
        .terms-container li::marker {
          color: #a8e63d;
        }
        .terms-footer {
          margin-top: 48px;
          padding-top: 24px;
          border-top: 1px solid rgba(168, 230, 61, 0.1);
          color: #5a7a5a;
          font-size: 12px;
          text-align: center;
        }
        @media (max-width: 640px) {
          .terms-header {
            padding: 14px 16px;
          }
          .terms-header-title {
            font-size: 13px;
          }
          .terms-container {
            padding-top: 70px;
            padding-bottom: 24px;
          }
          .terms-container h1 {
            font-size: 28px;
          }
          .terms-container h2 {
            font-size: 18px;
          }
          .terms-container p, .terms-container li {
            font-size: 13px;
          }
        }
      `}</style>

      <div className="terms-header">
        <button
          className="terms-back-btn"
          onClick={handleBackClick}
          title="Return to Authentication"
        >
          <ArrowLeft size={16} />
          Back to Auth
        </button>
        <div className="terms-header-title">Terms of Service</div>
      </div>

      <div className="terms-container">
        <h1>Terms of Service</h1>
        <div className="updated-date">Last updated: January 2026</div>

        <h2>1. Agreement to Terms</h2>
        <p>
          By accessing and using Xeevia, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
        </p>

        <h2>2. Use License</h2>
        <p>
          Permission is granted to temporarily download one copy of the materials (information or software) on Xeevia for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
        </p>
        <ul>
          <li>Modify or copy the materials</li>
          <li>Use the materials for any commercial purpose or for any public display</li>
          <li>Attempt to decompile or reverse engineer any software contained on Xeevia</li>
          <li>Remove any copyright or other proprietary notations from the materials</li>
          <li>Transfer the materials to another person or "mirror" the materials on any other server</li>
        </ul>

        <h2>3. Disclaimer</h2>
        <p>
          The materials on Xeevia are provided on an 'as is' basis. Xeevia makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
        </p>

        <h2>4. Limitations</h2>
        <p>
          In no event shall Xeevia or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on Xeevia, even if Xeevia or an authorized representative has been notified of the possibility of such damage.
        </p>

        <h2>5. Accuracy of Materials</h2>
        <p>
          The materials appearing on Xeevia could include technical, typographical, or photographic errors. Xeevia does not warrant that any of the materials on Xeevia are accurate, complete, or current. Xeevia may make changes to the materials contained on its platform at any time without notice.
        </p>

        <h2>6. Links</h2>
        <p>
          Xeevia has not reviewed all of the sites linked to its platform and is not responsible for the contents of any such linked site. The inclusion of any link does not imply endorsement by Xeevia of the site. Use of any such linked website is at the user's own risk.
        </p>

        <h2>7. Modifications</h2>
        <p>
          Xeevia may revise these terms of service for its platform at any time without notice. By using this platform, you are agreeing to be bound by the then current version of these terms of service.
        </p>

        <h2>8. Governing Law</h2>
        <p>
          These terms and conditions are governed by and construed in accordance with the laws of the jurisdiction in which Xeevia is incorporated, and you irrevocably submit to the exclusive jurisdiction of the courts in that location.
        </p>

        <h2>9. User Responsibilities</h2>
        <p>
          You agree that you will not:
        </p>
        <ul>
          <li>Use the platform for any unlawful purpose or in violation of any laws or regulations</li>
          <li>Harass, abuse, or harm other users</li>
          <li>Post content that is defamatory, obscene, or otherwise objectionable</li>
          <li>Attempt to gain unauthorized access to the platform or its systems</li>
          <li>Interfere with the operation of the platform or services</li>
        </ul>

        <h2>10. Contact Information</h2>
        <p>
          If you have any questions about these Terms of Service, please contact us at:
        </p>
        <p>
          Email: <strong>terms@xeevia.com</strong>
        </p>

        <div className="terms-footer">
          <p>© 2026 Xeevia. All rights reserved. These terms are binding and enforceable.</p>
        </div>
      </div>
    </div>
  );
}
          In no event shall Xeevia or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on Xeevia, even if Xeevia or a Xeevia authorized representative has been notified orally or in writing of the possibility of such damage.
        </p>

        <h2>5. Accuracy of Materials</h2>
        <p>
          The materials appearing on Xeevia could include technical, typographical, or photographic errors. Xeevia does not warrant that any of the materials on Xeevia are accurate, complete, or current. Xeevia may make changes to the materials contained on Xeevia at any time without notice.
        </p>

        <h2>6. Links</h2>
        <p>
          Xeevia has not reviewed all of the sites linked to its website and is not responsible for the contents of any such linked site. The inclusion of any link does not imply endorsement by Xeevia of the site. Use of any such linked website is at the user's own risk.
        </p>

        <h2>7. Modifications</h2>
        <p>
          Xeevia may revise these terms of service for its website at any time without notice. By using this website, you are agreeing to be bound by the then current version of these terms of service.
        </p>

        <h2>8. Governing Law</h2>
        <p>
          These terms and conditions are governed by and construed in accordance with the laws of the jurisdiction in which Xeevia operates, and you irrevocably submit to the exclusive jurisdiction of the courts in that location.
        </p>

        <h2>9. User Content</h2>
        <p>
          You retain all rights to any content you submit, post or display on or through Xeevia. By submitting, posting or displaying content on or through Xeevia, you grant us a worldwide, non-exclusive, royalty-free license to use, copy, reproduce, process, adapt, modify, publish, transmit, display and distribute such content in any media or medium and for any purposes.
        </p>

        <h2>10. Prohibited Conduct</h2>
        <p>You agree not to use Xeevia to:</p>
        <ul>
          <li>Harass, threaten, embarrass or cause distress or discomfort to any person</li>
          <li>Engage in any form of abuse, harassment, or discrimination</li>
          <li>Post or transmit any unlawful, threatening, abusive, vulgar, obscene, or otherwise objectionable material</li>
          <li>Attempt to hack, bypass, or circumvent any security measures</li>
          <li>Violate any applicable laws or regulations</li>
        </ul>

        <h2>11. Contact</h2>
        <p>
          If you have any questions about these Terms of Service, please contact us at support@xeevia.com
        </p>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid rgba(168,230,61,0.1)" }}>
          <button
            className="back-btn"
            onClick={() => (window.location.href = "/login")}
            style={{ marginBottom: 0 }}
          >
            ← Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}
