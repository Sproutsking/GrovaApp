import React from "react";

export default function PrivacyPolicy() {
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
        .privacy-container {
          max-width: 720px;
          margin: 0 auto;
        }
        .privacy-container h1 {
          font-size: 32px;
          font-weight: 700;
          margin-bottom: 12px;
          color: #a8e63d;
        }
        .privacy-container h2 {
          font-size: 20px;
          font-weight: 600;
          margin-top: 32px;
          margin-bottom: 12px;
          color: #c8f56a;
        }
        .privacy-container p, .privacy-container li {
          font-size: 14px;
          line-height: 1.8;
          color: #dde8dd;
          margin-bottom: 12px;
        }
        .privacy-container ul {
          margin: 12px 0 12px 24px;
          padding: 0;
        }
        .privacy-container li {
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
      <div className="privacy-container">
        <button
          className="back-btn"
          onClick={() => (window.location.href = "/login")}
        >
          ← Back to Login
        </button>

        <h1>Privacy Policy</h1>
        <p style={{ color: "#a8a8a8", marginBottom: 28 }}>
          Last updated: January 2026
        </p>

        <h2>1. Introduction</h2>
        <p>
          Xeevia ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website and use our service.
        </p>

        <h2>2. Information We Collect</h2>
        <p>We may collect information about you in a variety of ways. The information we may collect on the site includes:</p>
        <ul>
          <li>
            <strong>Personal Data:</strong> Name, email address, phone number, and other information you provide during registration
          </li>
          <li>
            <strong>OAuth Data:</strong> Information from your OAuth provider accounts (Google, Facebook, X, Discord) such as your public profile information
          </li>
          <li>
            <strong>Usage Data:</strong> Information about how you interact with our service, including IP address, browser type, and pages visited
          </li>
          <li>
            <strong>Device Data:</strong> Information about the device you use to access our service
          </li>
        </ul>

        <h2>3. How We Use Your Information</h2>
        <p>Xeevia uses the information we collect or receive for various purposes:</p>
        <ul>
          <li>To provide and maintain our service</li>
          <li>To process your transactions and send related information</li>
          <li>To email you regarding your account or subscription</li>
          <li>To fulfill and manage your requests, orders, and payments</li>
          <li>To generate a personal profile about you</li>
          <li>To increase the efficiency and operation of our site</li>
          <li>To monitor and analyze trends, usage, and activities</li>
          <li>To detect, prevent, and address technical and security issues</li>
        </ul>

        <h2>4. Disclosure of Your Information</h2>
        <p>
          We do not sell, trade, or rent users' personally identifiable information to others. We may share your information in the following situations:
        </p>
        <ul>
          <li>
            <strong>By Law or to Protect Rights:</strong> If we believe the release of information is necessary to comply with the law
          </li>
          <li>
            <strong>Third-Party Service Providers:</strong> We may share your information with third parties who perform services for us, including payment processing, data analysis, email delivery, and customer service
          </li>
          <li>
            <strong>Business Transfers:</strong> Your information may be transferred as part of a merger, acquisition, or sale of assets
          </li>
        </ul>

        <h2>5. Security of Your Information</h2>
        <p>
          We use administrative, technical, and physical security measures to help protect your personal information. However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security of your information.
        </p>

        <h2>6. Contact Us</h2>
        <p>
          If you have questions or comments about this Privacy Policy, please contact us at:
        </p>
        <p>
          Email: privacy@xeevia.com
        </p>

        <h2>7. Changes to This Privacy Policy</h2>
        <p>
          Xeevia reserves the right to modify this privacy policy at any time. Changes and clarifications will take effect immediately upon their posting to the website. If we make material changes to this policy, we will notify you here that it has been updated.
        </p>

        <h2>8. California Privacy Rights</h2>
        <p>
          California residents have the right to know what personal information is collected, used, shared, or sold. If you are a California resident, you may have additional rights under the California Consumer Privacy Act (CCPA). For more information about your privacy rights, please contact us at privacy@xeevia.com.
        </p>

        <h2>9. Children's Privacy</h2>
        <p>
          Xeevia does not knowingly collect personal information from children under the age of 13. If we become aware that a child under 13 has provided us with personal information, we will delete such information and terminate the child's account.
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
