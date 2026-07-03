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
          Xeevia ("we," "our," or "us") is committed to protecting your privacy and ensuring transparency about how we handle your data. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website, use our mobile application, and engage with our platform.
        </p>

        <h2>2. Information We Collect</h2>
        <p>We collect information about you in the following ways:</p>
        <ul>
          <li>
            <strong>Account Registration Data:</strong> Name, email address, phone number, username, profile information, and any other data you provide during account creation or profile updates
          </li>
          <li>
            <strong>OAuth Provider Information:</strong> When you sign in using Google, X (Twitter), Facebook, Discord, or TikTok, we collect your public profile information, email address, and authentication tokens as permitted by your OAuth provider settings
          </li>
          <li>
            <strong>Wallet & Transaction Data:</strong> Cryptocurrency wallet addresses, transaction history, balance information, and payment data related to your use of Xeevia's financial features
          </li>
          <li>
            <strong>Content Data:</strong> Posts, stories, videos, comments, messages, and any other user-generated content you share on the platform
          </li>
          <li>
            <strong>Usage & Analytics Data:</strong> Information about how you interact with Xeevia, including IP address, browser type, device type, pages visited, time spent, search queries, and click patterns
          </li>
          <li>
            <strong>Device Data:</strong> Mobile device identifiers, push notification tokens, operating system, and device settings
          </li>
          <li>
            <strong>Location Data:</strong> Approximate location data based on IP address (not precise GPS location unless you explicitly grant permission)
          </li>
          <li>
            <strong>Communication Data:</strong> Messages, support tickets, and any communications you send to our support team or other users
          </li>
        </ul>

        <h2>3. How We Use Your Information</h2>
        <p>Xeevia uses the information we collect for the following purposes:</p>
        <ul>
          <li>To provide, maintain, and improve the Xeevia platform and our services</li>
          <li>To authenticate your identity and secure your account against unauthorized access</li>
          <li>To process transactions, payments, and cryptocurrency operations</li>
          <li>To send you service updates, announcements, and administrative notices</li>
          <li>To respond to your inquiries, support requests, and feedback</li>
          <li>To personalize your experience and deliver content tailored to your interests</li>
          <li>To monitor and analyze platform usage trends, user behavior, and service performance</li>
          <li>To detect, prevent, and investigate fraud, abuse, security incidents, and policy violations</li>
          <li>To send push notifications and in-app messages (with your consent)</li>
          <li>To comply with legal obligations and enforce our Terms of Service</li>
          <li>To conduct research and analytics to improve our services</li>
        </ul>

        <h2>4. Data Sharing & Disclosure</h2>
        <p>Xeevia does not sell, trade, or rent your personally identifiable information to third parties. However, we may share your information in the following circumstances:</p>
        <ul>
          <li>
            <strong>Service Providers:</strong> We share data with third-party service providers (payment processors, analytics providers, hosting services, email services) that assist us in operating the platform. These providers are contractually bound to use your data only for the services they provide.
          </li>
          <li>
            <strong>Legal Requirements:</strong> We may disclose your information if required by law, court order, government request, or to protect the legal rights, privacy, safety, or property of Xeevia, our users, or the public.
          </li>
          <li>
            <strong>Business Transfers:</strong> In the event of a merger, acquisition, bankruptcy, or sale of assets, your information may be transferred as part of that transaction. You will be notified of any material changes.
          </li>
          <li>
            <strong>With Your Consent:</strong> We may share your information for purposes beyond those listed above only with your explicit consent.
          </li>
          <li>
            <strong>Blockchain/Public Data:</strong> Some of your data (public profiles, posts, wallet addresses) may be recorded on blockchain networks and become permanently public by design.
          </li>
        </ul>

        <h2>5. Security & Data Protection</h2>
        <p>
          Xeevia implements industry-standard security measures including encryption, secure authentication, regular security audits, and access controls to protect your personal information. However, no method of transmission over the internet is 100% secure. We cannot guarantee absolute security, and you use the platform at your own risk. We are not responsible for unauthorized access due to factors beyond our control.
        </p>

        <h2>6. Data Retention</h2>
        <p>
          We retain your information for as long as your account is active or as needed to provide services. You can request deletion of your account and associated data, though some information may be retained for legal, compliance, or fraud prevention purposes. Certain data may remain in backups for a limited period.
        </p>

        <h2>7. Your Privacy Rights</h2>
        <p>Depending on your location, you may have the following rights:</p>
        <ul>
          <li><strong>Right to Access:</strong> You can request a copy of the personal information we hold about you</li>
          <li><strong>Right to Correction:</strong> You can request corrections to inaccurate or incomplete data</li>
          <li><strong>Right to Deletion:</strong> You can request deletion of your data (subject to legal retention requirements)</li>
          <li><strong>Right to Data Portability:</strong> You can request your data in a machine-readable format</li>
          <li><strong>Right to Opt-Out:</strong> You can opt out of marketing communications and certain data processing</li>
          <li><strong>Right to Withdraw Consent:</strong> You can withdraw consent for data processing at any time</li>
        </ul>
        <p>To exercise these rights, contact us at <strong>privacy@xeevia.com</strong>.</p>

        <h2>8. Third-Party Links & Services</h2>
        <p>
          Xeevia may contain links to third-party websites and services that are not operated by us. This Privacy Policy does not apply to third-party sites, and we are not responsible for their privacy practices. We encourage you to review their privacy policies before sharing any information.
        </p>

        <h2>9. Children's Privacy</h2>
        <p>
          Xeevia is not intended for children under 13 years of age, and we do not knowingly collect personal information from children. If we become aware that a child under 13 has provided us with personal information, we will delete such information promptly and terminate the child's account. Parents or guardians who believe their child has provided information to Xeevia should contact us immediately.
        </p>

        <h2>10. International Data Transfers</h2>
        <p>
          Your information may be transferred to, stored in, and processed in countries other than your country of residence. These countries may have data protection laws different from your home country. By using Xeevia, you consent to the transfer of your information to countries outside your country of residence.
        </p>

        <h2>11. Changes to This Privacy Policy</h2>
        <p>
          Xeevia reserves the right to modify this Privacy Policy at any time. Changes will be effective immediately upon posting to the platform. If we make material changes, we will notify you via email or a prominent notice on our website. Your continued use of Xeevia constitutes acceptance of the updated Privacy Policy.
        </p>

        <h2>12. Contact Us</h2>
        <p>
          If you have questions, concerns, or requests regarding this Privacy Policy or our privacy practices, please contact us at:
        </p>
        <p>
          Email: <strong>privacy@xeevia.com</strong>
          <br />
          Mailing Address: Xeevia Privacy Team, [Your Address]
        </p>

        <div className="privacy-footer">
          <p>© 2026 Xeevia. All rights reserved. This policy is binding and protected.</p>
        </div>
      </div>
    </div>
  );
}
