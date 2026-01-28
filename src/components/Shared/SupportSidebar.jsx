import React, { useState } from 'react';
import { X, HelpCircle, MessageCircle, Book, FileText, Mail, Send, CheckCircle } from 'lucide-react';

const SupportSidebar = ({ isOpen, onClose, isMobile }) => {
  const [activeSection, setActiveSection] = useState('help');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const helpTopics = [
    {
      icon: '💰',
      title: 'Grova Tokens & Wallet',
      description: 'How to earn, spend, and manage your GT',
      articles: 5
    },
    {
      icon: '📖',
      title: 'Publishing Stories',
      description: 'Tips for creating engaging content',
      articles: 8
    },
    {
      icon: '🎬',
      title: 'Reels & Videos',
      description: 'Best practices for video content',
      articles: 6
    },
    {
      icon: '🔒',
      title: 'Account & Security',
      description: 'Protect your account and data',
      articles: 7
    },
    {
      icon: '💳',
      title: 'Payments & Withdrawals',
      description: 'How to cash out your earnings',
      articles: 4
    },
    {
      icon: '📊',
      title: 'Analytics & Insights',
      description: 'Understanding your performance',
      articles: 5
    }
  ];

  const faqs = [
    {
      question: 'How do I earn Grova Tokens?',
      answer: 'Create engaging content! Post stories, reels, and posts. Earn GT when users unlock your stories, view your reels, and interact with your posts.'
    },
    {
      question: 'When can I withdraw my earnings?',
      answer: 'You can withdraw anytime you have at least 1,000 GT. Withdrawals are processed within 24-48 hours to your linked payment method.'
    },
    {
      question: 'How does story pricing work?',
      answer: 'You set the price (10-500 GT) when publishing. Users pay once to unlock permanently. You earn 90% of each unlock (10% platform fee).'
    },
    {
      question: 'What happens if my content is reported?',
      answer: 'Our team reviews reports within 24 hours. Valid violations result in content removal and possible account restrictions based on severity.'
    }
  ];

  const handleSubmit = () => {
    if (message.trim()) {
      setSubmitted(true);
      setTimeout(() => {
        setMessage('');
        setSubmitted(false);
      }, 3000);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <style>{`
        .support-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          z-index: 999;
          animation: fadeIn 0.2s ease;
        }

        .support-sidebar {
          position: fixed;
          top: 0;
          right: 0;
          width: 100%;
          max-width: ${isMobile ? '100%' : '420px'};
          height: 100vh;
          background: #0a0a0a;
          border-left: 1px solid rgba(132, 204, 22, 0.2);
          z-index: 1000;
          display: flex;
          flex-direction: column;
          animation: slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .support-header {
          padding: 8px 20px;
          border-bottom: 1px solid rgba(132, 204, 22, 0.2);
          background: rgba(132, 204, 22, 0.03);
        }

        .support-header-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }

        .support-title-section {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .support-icon-wrapper {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
        }

        .support-title {
          font-size: 20px;
          font-weight: 800;
          color: #fff;
          margin: 0;
        }

        .support-close-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #a3a3a3;
          cursor: pointer;
          transition: all 0.2s;
        }

        .support-close-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #3b82f6;
          border-color: rgba(59, 130, 246, 0.3);
        }

        .support-tabs {
          display: flex;
          gap: 6px;
        }

        .support-tab {
          flex: 1;
          padding: 6px 16px;
          background: rgba(0, 0, 0, 0.35);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: #a3a3a3;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .support-tab.active {
          background: rgba(59, 130, 246, 0.15);
          border-color: rgba(59, 130, 246, 0.4);
          color: #3b82f6;
        }

        .support-content {
          flex: 1;
          overflow-y: auto;
          padding: 10px;
        }

        .help-topic {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 5px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .help-topic:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(59, 130, 246, 0.3);
          transform: translateX(-2px);
        }

        .help-topic-header {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 8px;
        }

        .help-topic-icon {
          font-size: 32px;
          flex-shrink: 0;
        }

        .help-topic-info {
          flex: 1;
        }

        .help-topic-title {
          font-size: 15px;
          font-weight: 700;
          color: #fff;
          margin: 0 0 4px 0;
        }

        .help-topic-desc {
          font-size: 13px;
          color: #737373;
          margin: 0;
        }

        .help-topic-count {
          font-size: 12px;
          color: #3b82f6;
          font-weight: 600;
          margin-top: 8px;
        }

        .faq-item {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 5px;
        }

        .faq-question {
          font-size: 14px;
          font-weight: 700;
          color: #fff;
          margin: 0 0 8px 0;
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }

        .faq-answer {
          font-size: 13px;
          color: #a3a3a3;
          line-height: 1.6;
          margin: 0;
          padding-left: 24px;
        }

        .contact-form {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 20px;
        }

        .form-label {
          font-size: 13px;
          font-weight: 600;
          color: #fff;
          margin-bottom: 8px;
          display: block;
        }

        .form-textarea {
          width: 100%;
          min-height: 120px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: #fff;
          font-size: 14px;
          font-family: inherit;
          resize: vertical;
          margin-bottom: 12px;
          box-sizing: border-box;
        }

        .form-textarea:focus {
          outline: none;
          border-color: rgba(59, 130, 246, 0.5);
          background: rgba(255, 255, 255, 0.08);
        }

        .submit-btn {
          width: 100%;
          padding: 12px;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          border: none;
          border-radius: 8px;
          color: #fff;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s;
        }

        .submit-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(59, 130, 246, 0.4);
        }

        .submit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .success-message {
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.3);
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          color: #22c55e;
        }

        .support-content::-webkit-scrollbar {
          width: 6px;
        }

        .support-content::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.03);
        }

        .support-content::-webkit-scrollbar-thumb {
          background: rgba(59, 130, 246, 0.3);
          border-radius: 3px;
        }

        .support-content::-webkit-scrollbar-thumb:hover {
          background: rgba(59, 130, 246, 0.5);
        }
      `}</style>

      <div className="support-overlay" onClick={onClose}></div>
      
      <div className="support-sidebar">
        <div className="support-header">
          <div className="support-header-top">
            <div className="support-title-section">
              <div className="support-icon-wrapper">
                <HelpCircle size={20} />
              </div>
              <h2 className="support-title">Help & Support</h2>
            </div>
            <button className="support-close-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>

          <div className="support-tabs">
            <button 
              className={`support-tab ${activeSection === 'help' ? 'active' : ''}`}
              onClick={() => setActiveSection('help')}
            >
              <Book size={16} />
              Help
            </button>
            <button 
              className={`support-tab ${activeSection === 'faq' ? 'active' : ''}`}
              onClick={() => setActiveSection('faq')}
            >
              <FileText size={16} />
              FAQ
            </button>
            <button 
              className={`support-tab ${activeSection === 'contact' ? 'active' : ''}`}
              onClick={() => setActiveSection('contact')}
            >
              <Mail size={16} />
              Contact
            </button>
          </div>
        </div>

        <div className="support-content">
          {activeSection === 'help' && (
            <>
              {helpTopics.map((topic, index) => (
                <div key={index} className="help-topic">
                  <div className="help-topic-header">
                    <div className="help-topic-icon">{topic.icon}</div>
                    <div className="help-topic-info">
                      <h3 className="help-topic-title">{topic.title}</h3>
                      <p className="help-topic-desc">{topic.description}</p>
                      <div className="help-topic-count">{topic.articles} articles</div>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {activeSection === 'faq' && (
            <>
              {faqs.map((faq, index) => (
                <div key={index} className="faq-item">
                  <div className="faq-question">
                    <HelpCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                    {faq.question}
                  </div>
                  <p className="faq-answer">{faq.answer}</p>
                </div>
              ))}
            </>
          )}

          {activeSection === 'contact' && (
            <>
              {submitted && (
                <div className="success-message">
                  <CheckCircle size={20} />
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>Message sent!</div>
                    <div style={{ fontSize: 13, opacity: 0.8 }}>
                      We'll get back to you within 24 hours.
                    </div>
                  </div>
                </div>
              )}
              
              <div className="contact-form">
                <label className="form-label">How can we help you?</label>
                <textarea
                  className="form-textarea"
                  placeholder="Describe your issue or question in detail..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <button 
                  onClick={handleSubmit} 
                  className="submit-btn" 
                  disabled={!message.trim()}
                >
                  <Send size={16} />
                  Send Message
                </button>
              </div>

              <div style={{ marginTop: 20, padding: 16, background: 'rgba(59, 130, 246, 0.05)', borderRadius: 8, border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <MessageCircle size={16} style={{ color: '#3b82f6' }} />
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#3b82f6' }}>
                    Quick Response Times
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#737373', lineHeight: 1.6 }}>
                  Our support team typically responds within 2-4 hours during business hours (9 AM - 6 PM WAT, Mon-Fri).
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default SupportSidebar;