import React, { useEffect } from "react";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicy() {
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
        .privacy-header {
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
        .privacy-back-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 16px;
          border-radius: 10px;
          border: 1.5px solid rgba(168, 230, 61, 0.4);
          background: rgba(168, 230, 61, 0.12);
          color: #d4fc72;
          cursor: pointer;
          text-decoration: none;
          font-size: 13px;
          font-weight: 700;
          transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
          user-select: none;
          min-width: 120px;
          min-height: 44px;
          text-shadow: 0 0 8px rgba(212, 252, 114, 0.2);
          box-shadow: 0 4px 16px rgba(168, 230, 61, 0.08);
        }
        .privacy-back-btn:hover {
          background: rgba(168, 230, 61, 0.2);
          border-color: rgba(212, 252, 114, 0.8);
          transform: translateX(-3px);
          box-shadow: 0 12px 32px rgba(168, 230, 61, 0.25);
          text-shadow: 0 0 16px rgba(212, 252, 114, 0.4);
        }
        .privacy-back-btn:active {
          transform: translateX(-1px);
        }
        @media (max-width: 480px) {
          .privacy-back-btn {
            min-height: 48px;
            min-width: 100%;
            font-size: 14px;
            padding: 14px 18px;
          }
        }
        .privacy-header-title {
          font-size: 15px;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: "-0.3px";
        }
        .privacy-container {
          max-width: 780px;
          margin: 0 auto;
          padding-top: 80px;
        }
        .privacy-container h1 {
          font-size: 36px;
          font-weight: 900;
          margin-bottom: 8px;
          color: #ffffff;
          letter-spacing: "-0.8px";
          text-shadow: 0 0 24px rgba(168, 230, 61, 0.2);
          background: linear-gradient(135deg, #ffffff 0%, #d4fc72 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .privacy-container .updated-date {
          font-size: 13px;
          color: #5a7a5a;
          margin-bottom: 32px;
          font-weight: 500;
        }
        .privacy-container h2 {
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
        .privacy-container h2::before {
          content: '';
          display: inline-block;
          width: 4px;
          height: 4px;
          background: #a8e63d;
          border-radius: 50%;
        }
        .privacy-container p, .privacy-container li {
          font-size: 14px;
          line-height: 1.8;
          color: #c8d8b0;
          margin-bottom: 14px;
          font-weight: 500;
        }
        .privacy-container strong {
          color: #d4fc72;
          font-weight: 700;
        }
        .privacy-container ul {
          margin: 14px 0 14px 24px;
          padding: 0;
        }
        .privacy-container li {
          margin-bottom: 10px;
          color: #b8d8a0;
        }
        .privacy-container li::marker {
          color: #a8e63d;
        }
        .privacy-footer {
          margin-top: 48px;
          padding-top: 24px;
          padding-bottom: 24px;
          border-top: 1px solid rgba(168, 230, 61, 0.2);
          border-bottom: 1px solid rgba(168, 230, 61, 0.1);
          color: #7a9a7a;
          font-size: 12px;
          text-align: center;
          font-weight: 500;
          letter-spacing: "0.2px";
        }
        @media (max-width: 640px) {
          .privacy-header {
            padding: 14px 16px;
          }
          .privacy-header-title {
            font-size: 13px;
          }
          .privacy-container {
            padding-top: 70px;
            padding-bottom: 24px;
          }
          .privacy-container h1 {
            font-size: 28px;
          }
          .privacy-container h2 {
            font-size: 18px;
          }
          .privacy-container p, .privacy-container li {
            font-size: 13px;
          }
        }
      `}</style>

      <div className="privacy-header">
        <button
          className="privacy-back-btn"
          onClick={handleBackClick}
          title="Return to Authentication"
        >
          <ArrowLeft size={16} />
          Back to Auth
        </button>
        <div className="privacy-header-title">Privacy Policy</div>
      </div>

      <div className="privacy-container">
        <h1>Privacy Policy</h1>
        <div className="updated-date">Last updated: January 2026</div>

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
          Email: <strong>privacy@xeevia.com</strong>
        </p>

        <h2>7. Changes to This Privacy Policy</h2>
        <p>
          Xeevia reserves the right to modify this privacy policy at any time. Changes and clarifications will take effect immediately upon their posting to the website. If we make material changes to this policy, we will notify you here that it has been updated.
        </p>

        <h2>8. California Privacy Rights</h2>
        <p>
          California residents have the right to know what personal information is collected, used, shared, or sold. If you are a California resident, you may have additional rights under the California Consumer Privacy Act (CCPA). For more information about your privacy rights, please contact us at privacy@xeevia.com.
        </p>

        <div className="privacy-footer">
          <p>© 2026 Xeevia. All rights reserved. This policy is binding and protected.</p>
        </div>
      </div>
    </div>
  );
}
