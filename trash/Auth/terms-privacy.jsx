// src/components/Auth/terms-privacy.jsx
import React, { useState } from "react";
import { ArrowLeft, Shield, FileText, Lock } from "lucide-react";
import "./AuthPage.css";

const TermsPrivacy = ({ onClose, isOpen }) => {
  const [activeSection, setActiveSection] = useState("terms");

  // Don't render anything if not open
  if (!isOpen) return null;

  return (
    <>
      <div className="terms-privacy-overlay" onClick={onClose}>
        <div
          className="terms-privacy-container"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="terms-privacy-header">
            <button className="arrow-back-close" onClick={onClose}>
              <ArrowLeft size={24} />
              <span>Back</span>
            </button>
            <div className="terms-privacy-title-wrapper">
              <Shield size={32} className="header-icon" />
              <h1 className="terms-privacy-main-title">Legal Information</h1>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="section-tabs">
            <button
              className={`section-tab ${activeSection === "terms" ? "active" : ""}`}
              onClick={() => setActiveSection("terms")}
            >
              <FileText size={20} />
              Terms of Service
            </button>
            <button
              className={`section-tab ${activeSection === "privacy" ? "active" : ""}`}
              onClick={() => setActiveSection("privacy")}
            >
              <Lock size={20} />
              Privacy Policy
            </button>
          </div>

          {/* Content Area */}
          <div className="terms-privacy-content">
            {activeSection === "terms" ? <TermsOfService /> : <PrivacyPolicy />}
          </div>

          {/* Footer */}
          <div className="terms-privacy-footer">
            <p className="footer-date">Last updated: February 8, 2026</p>
            <p className="footer-contact">
              Questions? Contact us at{" "}
              <a href="mailto:legal@grova.app">legal@grova.app</a>
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .terms-privacy-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.95);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          padding: 20px;
          animation: fadeIn 0.3s ease-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .terms-privacy-container {
          background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
          border: 2px solid rgba(132, 204, 22, 0.3);
          border-radius: 24px;
          max-width: 900px;
          width: 100%;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
          animation: slideUp 0.4s ease-out;
        }

        @keyframes slideUp {
          from {
            transform: translateY(30px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .terms-privacy-header {
          background: linear-gradient(
            135deg,
            rgba(132, 204, 22, 0.1) 0%,
            rgba(132, 204, 22, 0.05) 100%
          );
          padding: 24px 32px;
          border-bottom: 2px solid rgba(132, 204, 22, 0.2);
        }

        .arrow-back-close {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(132, 204, 22, 0.1);
          border: 1px solid rgba(132, 204, 22, 0.3);
          color: #84cc16;
          padding: 10px 20px;
          border-radius: 12px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition: all 0.3s;
          margin-bottom: 16px;
        }

        .arrow-back-close:hover {
          background: rgba(132, 204, 22, 0.2);
          transform: translateX(-4px);
        }

        .terms-privacy-title-wrapper {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .header-icon {
          color: #84cc16;
        }

        .terms-privacy-main-title {
          font-size: 28px;
          font-weight: 900;
          color: #ffffff;
          margin: 0;
        }

        .section-tabs {
          display: flex;
          gap: 8px;
          padding: 16px 32px;
          background: rgba(0, 0, 0, 0.3);
          border-bottom: 1px solid rgba(132, 204, 22, 0.2);
        }

        .section-tab {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px 20px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          color: #a3a3a3;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
        }

        .section-tab:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(132, 204, 22, 0.3);
        }

        .section-tab.active {
          background: linear-gradient(
            135deg,
            rgba(132, 204, 22, 0.2) 0%,
            rgba(132, 204, 22, 0.1) 100%
          );
          border-color: rgba(132, 204, 22, 0.6);
          color: #84cc16;
        }

        .terms-privacy-content {
          flex: 1;
          overflow-y: auto;
          padding: 32px;
        }

        .terms-privacy-content::-webkit-scrollbar {
          width: 8px;
        }

        .terms-privacy-content::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.3);
        }

        .terms-privacy-content::-webkit-scrollbar-thumb {
          background: rgba(132, 204, 22, 0.3);
          border-radius: 4px;
        }

        .terms-privacy-content::-webkit-scrollbar-thumb:hover {
          background: rgba(132, 204, 22, 0.5);
        }

        .terms-privacy-footer {
          background: rgba(132, 204, 22, 0.05);
          padding: 20px 32px;
          border-top: 2px solid rgba(132, 204, 22, 0.2);
          text-align: center;
        }

        .footer-date {
          font-size: 13px;
          color: #737373;
          margin: 0 0 8px 0;
        }

        .footer-contact {
          font-size: 14px;
          color: #a3a3a3;
          margin: 0;
        }

        .footer-contact a {
          color: #84cc16;
          text-decoration: none;
          font-weight: 600;
        }

        .footer-contact a:hover {
          text-decoration: underline;
        }

        /* Document Styles */
        .legal-section {
          margin-bottom: 32px;
        }

        .legal-section-title {
          font-size: 22px;
          font-weight: 800;
          color: #ffffff;
          margin: 0 0 16px 0;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .legal-section-title::before {
          content: "";
          width: 4px;
          height: 24px;
          background: linear-gradient(180deg, #84cc16 0%, #65a30d 100%);
          border-radius: 2px;
        }

        .legal-subsection-title {
          font-size: 18px;
          font-weight: 700;
          color: #84cc16;
          margin: 24px 0 12px 0;
        }

        .legal-text {
          font-size: 15px;
          line-height: 1.8;
          color: #d1d5db;
          margin: 0 0 16px 0;
        }

        .legal-list {
          list-style: none;
          padding: 0;
          margin: 16px 0;
        }

        .legal-list li {
          font-size: 15px;
          line-height: 1.8;
          color: #d1d5db;
          margin-bottom: 12px;
          padding-left: 24px;
          position: relative;
        }

        .legal-list li::before {
          content: "→";
          position: absolute;
          left: 0;
          color: #84cc16;
          font-weight: 700;
        }

        .highlight-box {
          background: rgba(132, 204, 22, 0.1);
          border-left: 4px solid #84cc16;
          padding: 16px 20px;
          border-radius: 8px;
          margin: 20px 0;
        }

        .highlight-box p {
          font-size: 14px;
          line-height: 1.6;
          color: #ffffff;
          margin: 0;
        }

        .warning-box {
          background: rgba(251, 191, 36, 0.1);
          border-left: 4px solid #fbbf24;
          padding: 16px 20px;
          border-radius: 8px;
          margin: 20px 0;
        }

        .warning-box p {
          font-size: 14px;
          line-height: 1.6;
          color: #ffffff;
          margin: 0;
        }

        @media (max-width: 768px) {
          .terms-privacy-container {
            max-height: 95vh;
            border-radius: 16px;
          }

          .terms-privacy-header,
          .section-tabs,
          .terms-privacy-content,
          .terms-privacy-footer {
            padding-left: 20px;
            padding-right: 20px;
          }

          .terms-privacy-main-title {
            font-size: 22px;
          }

          .section-tab {
            font-size: 13px;
            padding: 12px 16px;
          }

          .legal-section-title {
            font-size: 18px;
          }

          .legal-subsection-title {
            font-size: 16px;
          }

          .legal-text,
          .legal-list li {
            font-size: 14px;
          }
        }
      `}</style>
    </>
  );
};

const TermsOfService = () => (
  <div className="legal-document">
    <div className="legal-section">
      <h2 className="legal-section-title">
        <FileText size={24} />
        Terms of Service
      </h2>
      <p className="legal-text">
        Welcome to Grova! These Terms of Service ("Terms") govern your access to
        and use of Grova's platform, services, and applications (collectively,
        the "Services"). By accessing or using our Services, you agree to be
        bound by these Terms.
      </p>
    </div>

    <div className="legal-section">
      <h3 className="legal-subsection-title">1. Acceptance of Terms</h3>
      <p className="legal-text">
        By creating an account, accessing, or using Grova, you acknowledge that
        you have read, understood, and agree to be bound by these Terms, as well
        as our Privacy Policy. If you do not agree to these Terms, you must not
        access or use our Services.
      </p>
      <div className="highlight-box">
        <p>
          <strong>Important:</strong> You must be at least 13 years old to use
          Grova. If you are under 18, you must have parental or guardian consent
          to use our Services.
        </p>
      </div>
    </div>

    <div className="legal-section">
      <h3 className="legal-subsection-title">
        2. Account Security & Verification
      </h3>
      <p className="legal-text">
        Grova takes security seriously. To protect your account and our
        community:
      </p>
      <ul className="legal-list">
        <li>
          You must provide accurate and complete information during registration
        </li>
        <li>
          You are responsible for maintaining the confidentiality of your
          account credentials
        </li>
        <li>
          You must enable Layer 2 security (2FA, facial recognition, or
          fingerprint) within 2 days of account creation
        </li>
        <li>
          Failure to enable Layer 2 security will result in account deactivation
        </li>
        <li>
          You must verify your email address and complete all required
          verification steps
        </li>
        <li>
          You are responsible for all activities that occur under your account
        </li>
      </ul>
      <div className="warning-box">
        <p>
          ⚠️ <strong>Security Requirement:</strong> All accounts must have at
          least one Layer 2 security method enabled within 48 hours of creation.
          This is mandatory to protect your account and our community.
        </p>
      </div>
    </div>

    <div className="legal-section">
      <h3 className="legal-subsection-title">
        3. User Content & Intellectual Property
      </h3>
      <p className="legal-text">
        You retain ownership of the content you create and share on Grova ("User
        Content"). However, by posting User Content, you grant Grova a
        worldwide, non-exclusive, royalty-free license to use, reproduce,
        modify, adapt, publish, and distribute your content on our platform.
      </p>
      <ul className="legal-list">
        <li>You are solely responsible for your User Content</li>
        <li>You must have the rights to all content you post</li>
        <li>
          You agree not to post content that violates copyright, trademark, or
          other intellectual property rights
        </li>
        <li>
          Grova may remove content that violates these Terms or our Community
          Guidelines
        </li>
        <li>
          You grant other users permission to view and interact with your public
          content
        </li>
      </ul>
    </div>

    <div className="legal-section">
      <h3 className="legal-subsection-title">4. Prohibited Conduct</h3>
      <p className="legal-text">You agree NOT to:</p>
      <ul className="legal-list">
        <li>
          Post illegal, harmful, threatening, abusive, harassing, defamatory, or
          otherwise objectionable content
        </li>
        <li>
          Impersonate any person or entity, or falsely state or misrepresent
          your affiliation
        </li>
        <li>Engage in spam, phishing, or other fraudulent activities</li>
        <li>
          Interfere with or disrupt the Services or servers/networks connected
          to the Services
        </li>
        <li>
          Attempt to gain unauthorized access to any portion of the Services
        </li>
        <li>
          Use automated systems (bots, scrapers) without explicit permission
        </li>
        <li>Harass, bully, or threaten other users</li>
        <li>Post content containing viruses, malware, or harmful code</li>
        <li>Violate any applicable laws or regulations</li>
      </ul>
    </div>

    <div className="legal-section">
      <h3 className="legal-subsection-title">
        5. Grova Tokens & Engagement Points
      </h3>
      <p className="legal-text">
        Grova offers a digital economy powered by Grova Tokens and Engagement
        Points:
      </p>
      <ul className="legal-list">
        <li>
          Tokens and Points have no cash value and cannot be exchanged for real
          currency
        </li>
        <li>
          Grova may modify, suspend, or terminate the token system at any time
        </li>
        <li>
          Fraudulent activity related to tokens/points will result in account
          termination
        </li>
        <li>Token balances are non-transferable upon account closure</li>
        <li>
          Grova reserves the right to adjust token balances in case of system
          errors or abuse
        </li>
      </ul>
    </div>

    <div className="legal-section">
      <h3 className="legal-subsection-title">6. Privacy & Data Collection</h3>
      <p className="legal-text">
        Your privacy is important to us. Our collection, use, and protection of
        your personal information is governed by our Privacy Policy. By using
        Grova, you consent to our data practices as described in our Privacy
        Policy.
      </p>
    </div>

    <div className="legal-section">
      <h3 className="legal-subsection-title">7. Termination</h3>
      <p className="legal-text">
        Grova reserves the right to suspend or terminate your account at any
        time, with or without notice, for:
      </p>
      <ul className="legal-list">
        <li>Violation of these Terms or our Community Guidelines</li>
        <li>Fraudulent, abusive, or illegal activity</li>
        <li>Extended inactivity</li>
        <li>
          Failure to enable Layer 2 security within the required timeframe
        </li>
        <li>Any other reason at Grova's sole discretion</li>
      </ul>
      <p className="legal-text">
        You may terminate your account at any time through your account
        settings. Upon termination, your right to access and use the Services
        will immediately cease.
      </p>
    </div>

    <div className="legal-section">
      <h3 className="legal-subsection-title">
        8. Disclaimers & Limitation of Liability
      </h3>
      <p className="legal-text">
        THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES
        OF ANY KIND. GROVA DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED,
        INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
        PURPOSE, AND NON-INFRINGEMENT.
      </p>
      <p className="legal-text">
        GROVA SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
        CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF YOUR USE OF THE
        SERVICES.
      </p>
    </div>

    <div className="legal-section">
      <h3 className="legal-subsection-title">9. Changes to Terms</h3>
      <p className="legal-text">
        Grova reserves the right to modify these Terms at any time. We will
        notify you of material changes via email or through the Services. Your
        continued use of the Services after changes constitutes acceptance of
        the modified Terms.
      </p>
    </div>

    <div className="legal-section">
      <h3 className="legal-subsection-title">10. Contact Information</h3>
      <p className="legal-text">
        If you have questions about these Terms, please contact us at:
        <br />
        <br />
        <strong>Email:</strong> legal@grova.app
        <br />
        <strong>Support:</strong> support@grova.app
      </p>
    </div>
  </div>
);

const PrivacyPolicy = () => (
  <div className="legal-document">
    <div className="legal-section">
      <h2 className="legal-section-title">
        <Lock size={24} />
        Privacy Policy
      </h2>
      <p className="legal-text">
        At Grova, we respect your privacy and are committed to protecting your
        personal information. This Privacy Policy explains how we collect, use,
        disclose, and safeguard your information when you use our Services.
      </p>
    </div>

    <div className="legal-section">
      <h3 className="legal-subsection-title">1. Information We Collect</h3>
      <p className="legal-text">
        We collect information you provide directly to us:
      </p>
      <ul className="legal-list">
        <li>
          <strong>Account Information:</strong> Name, username, email address,
          phone number (optional), password
        </li>
        <li>
          <strong>Profile Information:</strong> Bio, avatar, verification status
        </li>
        <li>
          <strong>Content:</strong> Posts, reels, stories, comments, messages,
          and other content you create
        </li>
        <li>
          <strong>Payment Information:</strong> If applicable, payment details
          for premium features (processed securely)
        </li>
        <li>
          <strong>Communications:</strong> Messages, feedback, and support
          inquiries
        </li>
      </ul>

      <p className="legal-text">
        We automatically collect certain information:
      </p>
      <ul className="legal-list">
        <li>
          <strong>Device Information:</strong> IP address, device type, browser
          type, operating system
        </li>
        <li>
          <strong>Usage Data:</strong> Pages viewed, features used, time spent,
          interaction patterns
        </li>
        <li>
          <strong>Location Data:</strong> Approximate location based on IP
          address (precise location only with permission)
        </li>
        <li>
          <strong>Cookies & Similar Technologies:</strong> For authentication,
          preferences, analytics
        </li>
        <li>
          <strong>Security Data:</strong> Login attempts, device fingerprints,
          security events
        </li>
      </ul>

      <div className="highlight-box">
        <p>
          <strong>Biometric Data:</strong> If you enable facial recognition or
          fingerprint verification, we collect and securely store biometric data
          solely for authentication purposes. This data is encrypted and never
          shared with third parties.
        </p>
      </div>
    </div>

    <div className="legal-section">
      <h3 className="legal-subsection-title">2. How We Use Your Information</h3>
      <p className="legal-text">We use your information to:</p>
      <ul className="legal-list">
        <li>Provide, maintain, and improve our Services</li>
        <li>Create and manage your account</li>
        <li>Authenticate you and secure your account</li>
        <li>Process transactions and send related information</li>
        <li>
          Send you notifications, updates, and promotional content (with your
          consent)
        </li>
        <li>
          Respond to your comments, questions, and customer service requests
        </li>
        <li>Analyze usage patterns and improve user experience</li>
        <li>
          Detect, prevent, and address fraud, security issues, and technical
          problems
        </li>
        <li>Comply with legal obligations</li>
      </ul>
    </div>

    <div className="legal-section">
      <h3 className="legal-subsection-title">
        3. Information Sharing & Disclosure
      </h3>
      <p className="legal-text">
        We do not sell your personal information. We may share your information
        in these circumstances:
      </p>
      <ul className="legal-list">
        <li>
          <strong>With Other Users:</strong> Your public profile and content are
          visible to other users
        </li>
        <li>
          <strong>Service Providers:</strong> Third-party vendors who help us
          operate our Services (e.g., hosting, analytics, email delivery)
        </li>
        <li>
          <strong>Business Transfers:</strong> In connection with a merger,
          acquisition, or sale of assets
        </li>
        <li>
          <strong>Legal Requirements:</strong> To comply with laws, regulations,
          legal processes, or governmental requests
        </li>
        <li>
          <strong>Protection of Rights:</strong> To protect the rights,
          property, or safety of Grova, our users, or others
        </li>
        <li>
          <strong>With Your Consent:</strong> When you explicitly consent to
          sharing
        </li>
      </ul>
    </div>

    <div className="legal-section">
      <h3 className="legal-subsection-title">4. Data Security</h3>
      <p className="legal-text">
        We implement industry-standard security measures to protect your
        information:
      </p>
      <ul className="legal-list">
        <li>End-to-end encryption for sensitive data</li>
        <li>Secure HTTPS connections</li>
        <li>Regular security audits and penetration testing</li>
        <li>Access controls and authentication requirements</li>
        <li>Encrypted database storage</li>
        <li>Multi-factor authentication options</li>
        <li>Biometric authentication with encrypted storage</li>
      </ul>
      <div className="warning-box">
        <p>
          ⚠️ <strong>No system is 100% secure:</strong> While we use
          industry-leading security measures, we cannot guarantee absolute
          security. Please use strong passwords and enable all available
          security features.
        </p>
      </div>
    </div>

    <div className="legal-section">
      <h3 className="legal-subsection-title">5. Your Privacy Rights</h3>
      <p className="legal-text">You have the right to:</p>
      <ul className="legal-list">
        <li>
          <strong>Access:</strong> Request a copy of your personal information
        </li>
        <li>
          <strong>Correction:</strong> Update or correct inaccurate information
        </li>
        <li>
          <strong>Deletion:</strong> Request deletion of your account and data
        </li>
        <li>
          <strong>Data Portability:</strong> Receive your data in a portable
          format
        </li>
        <li>
          <strong>Opt-Out:</strong> Unsubscribe from marketing communications
        </li>
        <li>
          <strong>Restrict Processing:</strong> Limit how we use your data
        </li>
        <li>
          <strong>Object:</strong> Object to certain data processing activities
        </li>
      </ul>
      <p className="legal-text">
        To exercise these rights, contact us at privacy@grova.app
      </p>
    </div>

    <div className="legal-section">
      <h3 className="legal-subsection-title">6. Data Retention</h3>
      <p className="legal-text">
        We retain your information for as long as necessary to provide our
        Services and fulfill the purposes outlined in this Privacy Policy. When
        you delete your account, we will:
      </p>
      <ul className="legal-list">
        <li>Delete your personal information within 30 days</li>
        <li>
          Anonymize user-generated content that cannot be deleted due to
          technical limitations
        </li>
        <li>
          Retain certain data for legal and security purposes (e.g., fraud
          prevention)
        </li>
        <li>
          Backup data may persist for up to 90 days before permanent deletion
        </li>
      </ul>
    </div>

    <div className="legal-section">
      <h3 className="legal-subsection-title">7. Children's Privacy</h3>
      <p className="legal-text">
        Grova is not intended for children under 13. We do not knowingly collect
        personal information from children under 13. If you believe a child
        under 13 has provided us with personal information, please contact us
        immediately.
      </p>
    </div>

    <div className="legal-section">
      <h3 className="legal-subsection-title">
        8. International Data Transfers
      </h3>
      <p className="legal-text">
        Your information may be transferred to and processed in countries other
        than your own. We ensure appropriate safeguards are in place to protect
        your information in accordance with this Privacy Policy.
      </p>
    </div>

    <div className="legal-section">
      <h3 className="legal-subsection-title">
        9. Changes to This Privacy Policy
      </h3>
      <p className="legal-text">
        We may update this Privacy Policy from time to time. We will notify you
        of any material changes by posting the new Privacy Policy on our
        platform and updating the "Last Updated" date. Your continued use of the
        Services after changes constitutes acceptance of the updated Privacy
        Policy.
      </p>
    </div>

    <div className="legal-section">
      <h3 className="legal-subsection-title">10. Contact Us</h3>
      <p className="legal-text">
        If you have questions or concerns about this Privacy Policy, please
        contact us:
        <br />
        <br />
        <strong>Email:</strong> privacy@grova.app
        <br />
        <strong>Support:</strong> support@grova.app
        <br />
        <strong>Mailing Address:</strong> Grova Inc., Legal Department,
        [Address]
      </p>
    </div>
  </div>
);

export default TermsPrivacy;
