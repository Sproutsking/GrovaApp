import React from "react";

export default function TermsOfService() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#050706",
        color: "#dde8dd",
        fontFamily: "'DM Sans', sans-serif",
        padding: "40px 24px",
      }}
    >
      <style>{`
        .terms-container {
          max-width: 720px;
          margin: 0 auto;
        }
        .terms-container h1 {
          font-size: 32px;
          font-weight: 700;
          margin-bottom: 12px;
          color: #a8e63d;
        }
        .terms-container h2 {
          font-size: 20px;
          font-weight: 600;
          margin-top: 32px;
          margin-bottom: 12px;
          color: #c8f56a;
        }
        .terms-container p, .terms-container li {
          font-size: 14px;
          line-height: 1.8;
          color: #dde8dd;
          margin-bottom: 12px;
        }
        .terms-container ul {
          margin: 12px 0 12px 24px;
          padding: 0;
        }
        .terms-container li {
          margin-bottom: 8px;
        }
        .back-btn {
          display: inline-block;
          margin-bottom: 32px;
          padding: 10px 16px;
          border-radius: 8px;
          border: 1px solid rgba(168, 230, 61, 0.2);
          background: rgba(168, 230, 61, 0.05);
          color: #a8e63d;
          cursor: pointer;
          text-decoration: none;
          font-size: 13px;
          font-weight: 500;
          transition: all 0.2s;
        }
        .back-btn:hover {
          background: rgba(168, 230, 61, 0.1);
          border-color: rgba(168, 230, 61, 0.4);
        }
      `}</style>
      <div className="terms-container">
        <button
          className="back-btn"
          onClick={() => (window.location.href = "/login")}
        >
          ← Back to Login
        </button>

        <h1>Terms of Service</h1>
        <p style={{ color: "#a8a8a8", marginBottom: 28 }}>
          Last updated: January 2026
        </p>

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
