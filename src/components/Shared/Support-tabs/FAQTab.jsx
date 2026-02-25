import React, { useState } from "react";
import { Search, ChevronDown, ChevronUp } from "lucide-react";

// ─── FAQ DATA ─────────────────────────────────────────────────────────────────

const FAQ_DATA = [
  {
    category: "Getting Started",
    icon: "🚀",
    questions: [
      {
        q: "How do I create a Xeevia account?",
        a: "Sign up using Google, X (Twitter), Facebook, or Discord. Click \"Sign In\" and choose your provider. After connecting, you'll be prompted to choose a username and complete your profile. You'll need to pay a one-time $1 activation fee to unlock full platform access.",
      },
      {
        q: "What is the $1 activation fee?",
        a: "The $1 activation fee converts to 100 EP and gets you started on the platform. This fee exists to prevent spam accounts and ensure every user has a stake in the platform. It's a one-time payment — you never pay it again.",
      },
      {
        q: "What do I get with a Xeevia account?",
        a: "A standard Xeevia account lets you post, create reels, publish stories (with paywall), follow creators, and earn EP from engagement. You get a wallet, analytics dashboard, and full community access. Upgrading to Pro unlocks 84% revenue share (vs. 80%), advanced analytics, and priority discovery.",
      },
      {
        q: "Is Xeevia available in my country?",
        a: "Xeevia is globally accessible. However, payment methods vary by region. Nigerian users have full Paystack support (NGN deposits and withdrawals). International users can use cards and crypto. We're continuously expanding local payment options.",
      },
      {
        q: "How do I choose my username?",
        a: "Choose a username between 3-30 characters, using letters, numbers, and underscores. Your username appears in your profile URL and is how people @ mention you. Choose carefully — username changes are limited to once every 60 days.",
      },
    ],
  },
  {
    category: "Tokens & Earning",
    icon: "💰",
    questions: [
      {
        q: "How do I earn EP?",
        a: "You earn EP when other users engage with your content. Every like (2 EP), comment (4 EP), and story unlock (whatever price you set) generates EP for you at 80-84% of the face value. The more quality content you create, the more EP you earn.",
      },
      {
        q: "What is the difference between EP and XEV?",
        a: "EP (Engagement Points) is your day-to-day currency — you earn it, spend it, and can withdraw it. XEV is your ownership stake in the network. It has a fixed supply of 1 trillion, appreciates with platform growth, and gives you governance rights. 40% of your monthly earned EP automatically converts to XEV.",
      },
      {
        q: "When does the EP to XEV conversion happen?",
        a: "At the end of every calendar month (last day, 11:59 PM UTC), 40% of your earned EP from that month converts to XEV at the current exchange rate. This is automatic — you don't need to do anything.",
      },
      {
        q: "Can I convert XEV back to EP?",
        a: "Yes, you can convert XEV back to EP at the current exchange rate through your wallet. The rate updates monthly. Converting XEV to EP makes it available for immediate use or withdrawal.",
      },
      {
        q: "How much can I realistically earn?",
        a: "Earnings vary enormously based on content quality, consistency, and audience size. Early creators who publish consistently report earning anywhere from a few hundred to several thousand EP per month within their first 6 months. Top creators earn tens of thousands of EP monthly. There is no cap on earnings.",
      },
      {
        q: "What is the Pro subscription and is it worth it?",
        a: "Pro increases your creator revenue share from 80% to 84%. At 100,000 EP earned monthly, that's 4,000 EP difference — likely more than the Pro subscription cost. Pro also gives you advanced analytics, priority support, and increased visibility in the explore feed.",
      },
      {
        q: "Do my EP earnings expire?",
        a: "Purchased EP (EP you bought with real money) expires after 12 months of account inactivity. Earned EP (from content engagement) never expires as long as your account is active.",
      },
    ],
  },
  {
    category: "Content Creation",
    icon: "✏️",
    questions: [
      {
        q: "What types of content can I create?",
        a: "You can create Posts (text + images + video), Reels (short-form video), and Stories (long-form text content with a paywall). Communities allow you to create channels and engage groups around your content.",
      },
      {
        q: "How do I set the price for my story?",
        a: "When publishing a story, you choose an unlock price between 10 and 500 EP. Consider your content length, quality, and audience. New creators often start at 20-50 EP and increase as they build reputation. The right price is whatever the market will bear — test and adjust.",
      },
      {
        q: "Can I edit content after publishing?",
        a: "Posts can be edited after publishing with the edit recorded. Stories can be edited for minor corrections, but major edits to content that has already been unlocked by readers are flagged. Reels cannot be edited after publishing — you can only delete and re-upload.",
      },
      {
        q: "How does the story access limit work?",
        a: "When publishing a story, you can set a maximum number of people who can unlock it (default: 1,000). Once this limit is reached, the story shows as sold out. You can increase the limit at any time from your content management screen.",
      },
      {
        q: "Are there limits on how much I can post?",
        a: "No hard limits on posts or stories. Note that posting too frequently can actually hurt your engagement rate as your audience gets fatigued. Quality beats quantity on Xeevia.",
      },
      {
        q: "What file types are supported for images?",
        a: "Images: JPG, PNG, WebP, GIF (static). Video in posts: MP4 (H.264). Reels: MP4 (H.264), MOV. Maximum image size: 20MB per image, up to 10 images per post. Maximum reel video size: 500MB.",
      },
    ],
  },
  {
    category: "Payments & Finance",
    icon: "💳",
    questions: [
      {
        q: "When can I withdraw my earnings?",
        a: "You can withdraw when you have a minimum of 1,000 EP in earned (not purchased) EP. Withdrawals are processed within 1-3 business days for bank transfers, same day for Paystack (NGN), and within 30-60 minutes for crypto.",
      },
      {
        q: "Is there a fee to withdraw?",
        a: "Xeevia charges no withdrawal fees. You receive the full EP value as cash. Your bank may charge standard incoming transfer fees, and crypto transactions incur network gas fees — these are not controlled by Xeevia.",
      },
      {
        q: "What currency do I receive?",
        a: "EP is priced in USD (100 EP = $1). When withdrawing to NGN bank accounts, Xeevia converts at the current official exchange rate via Paystack. Crypto withdrawals are in USDC or USDT (stablecoins pegged to USD).",
      },
      {
        q: "My payment was successful but I didn't receive EP. What do I do?",
        a: "Wait 15 minutes for processing. For crypto deposits, wait for blockchain confirmations (usually 15-30 minutes). If EP doesn't appear after 1 hour, submit a support ticket with your transaction reference. We resolve these within 2-4 hours.",
      },
      {
        q: "Can I get a refund on EP I purchased?",
        a: "Purchased EP that has not been used can be refunded within 24 hours of purchase. Contact support with your transaction ID. EP that has been spent on content interactions is non-refundable. Story unlocks are always non-refundable.",
      },
      {
        q: "How do withdrawal limits work?",
        a: "Your daily withdrawal limit depends on your security level (1-5). Level 1: $100/day. Level 3: $500/day. Level 5: $10,000/day. Increase your limit by verifying your phone, setting a withdrawal PIN, and maintaining an account in good standing.",
      },
    ],
  },
  {
    category: "Account & Security",
    icon: "🔒",
    questions: [
      {
        q: "How do I change my username?",
        a: "Go to Account → Edit Profile → Username. You can change your username once every 60 days. Your old username becomes available to others immediately. All your content and followers transfer to your new username automatically.",
      },
      {
        q: "Can I have multiple Xeevia accounts?",
        a: "You may have one personal and one business account connected to different social providers. Using multiple accounts to manipulate the platform (coordinated engagement, spam) is a violation of our terms and results in a permanent ban of all associated accounts.",
      },
      {
        q: "What happens to my content and earnings if I delete my account?",
        a: "Before deleting, withdraw all your earnings. Once deletion is confirmed, content is removed within 30 days. Financial records are retained for 7 years per legal requirements. EP and XEV balances that are not withdrawn before deletion are forfeited.",
      },
      {
        q: "How do I report a bug or technical issue?",
        a: "Use the Support section (this sidebar) to open a ticket. Describe the issue, your device/browser, and what you were doing when it occurred. Screenshots are extremely helpful. Our technical team investigates bugs within 48 hours.",
      },
      {
        q: "Is my private messaging encrypted?",
        a: "Direct messages on Xeevia are stored encrypted in transit and at rest. However, they are not end-to-end encrypted in the same way as Signal or WhatsApp — Xeevia staff can access messages if required by a valid legal order.",
      },
    ],
  },
  {
    category: "Communities",
    icon: "🏘️",
    questions: [
      {
        q: "How do I create a community?",
        a: "Go to the Community tab → Create Community. Set your community name (3-100 characters), description, icon, and privacy settings. You'll be the owner and can assign roles (admin, moderator, member) to other users.",
      },
      {
        q: "What is the difference between public and private communities?",
        a: "Public communities are discoverable and anyone can join. Private communities require an invitation or approval from the owner/admin. Premium communities can require EP payment to join.",
      },
      {
        q: "How do community roles work?",
        a: "As community owner, you can create custom roles with specific permissions. Default roles: Owner (all permissions), Admin (manage members and content), Moderator (moderate content), Member (post and interact).",
      },
      {
        q: "Can I monetize my community?",
        a: "Yes. Premium communities charge an EP fee for joining. All community monetization revenue goes to the community owner at the standard creator revenue share.",
      },
    ],
  },
  {
    category: "XRC Protocol",
    icon: "⛓️",
    questions: [
      {
        q: "What is the XRC Protocol?",
        a: "XRC (Xeevia Record Chain) is our proprietary off-chain verification system. It creates an immutable, cryptographically-linked record of every transaction, engagement, account event, and content action on the platform — providing blockchain-grade transparency without blockchain costs or delays.",
      },
      {
        q: "Is XRC the same as a blockchain?",
        a: "XRC is inspired by blockchain architecture but operates off-chain. It uses hash-chaining (linking records cryptographically) without requiring distributed consensus or mining. This makes it 100-1000x faster and cheaper to operate while maintaining verifiability.",
      },
      {
        q: 'What does "deterministic" mean in XRC?',
        a: "Deterministic means every input produces a predictable, verifiable output. In XRC's case, given the same starting state and the same transaction, the record will always be identical — meaning no one can alter records secretly. This is the foundation of trustless transparency.",
      },
    ],
  },
];

// ─── FAQ ITEM ─────────────────────────────────────────────────────────────────

function FAQItem({ question, answer, isOpen, onToggle }) {
  return (
    <div
      style={{
        background: isOpen
          ? "rgba(132,204,22,0.03)"
          : "rgba(255,255,255,0.015)",
        border: `1px solid ${isOpen ? "rgba(132,204,22,0.2)" : "rgba(255,255,255,0.06)"}`,
        borderRadius: 12,
        overflow: "hidden",
        transition: "border-color 0.2s, background 0.2s",
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          padding: "14px 16px",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: isOpen ? "#fff" : "#e5e7eb",
            lineHeight: 1.5,
            flex: 1,
          }}
        >
          {question}
        </span>
        <div
          style={{
            flexShrink: 0,
            marginTop: 1,
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: isOpen
              ? "rgba(132,204,22,0.15)"
              : "rgba(255,255,255,0.05)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {isOpen ? (
            <ChevronUp size={13} style={{ color: "#a3e635" }} />
          ) : (
            <ChevronDown size={13} style={{ color: "#6b7280" }} />
          )}
        </div>
      </button>
      {isOpen && (
        <div
          style={{
            padding: "0 16px 16px",
            fontSize: 13,
            color: "#9ca3af",
            lineHeight: 1.85,
            borderTop: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          <div style={{ paddingTop: 12 }}>{answer}</div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN FAQ TAB ─────────────────────────────────────────────────────────────

export default function FAQTab({ onNavigateToContact }) {
  const [expandedFaqs, setExpandedFaqs] = useState({});
  const [faqSearch, setFaqSearch] = useState("");
  const [openCategory, setOpenCategory] = useState(null);

  const toggle = (key) => setExpandedFaqs((p) => ({ ...p, [key]: !p[key] }));

  const filteredData = faqSearch
    ? (() => {
        const q = faqSearch.toLowerCase();
        return FAQ_DATA.map((cat) => ({
          ...cat,
          questions: cat.questions.filter(
            (faq) =>
              faq.q.toLowerCase().includes(q) ||
              faq.a.toLowerCase().includes(q),
          ),
        })).filter((cat) => cat.questions.length > 0);
      })()
    : FAQ_DATA;

  const totalResults = filteredData.reduce(
    (acc, cat) => acc + cat.questions.length,
    0,
  );

  return (
    <div>
      {/* Header */}
      <div
        style={{
          padding: "22px 20px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          background:
            "linear-gradient(135deg, rgba(139,92,246,0.06) 0%, transparent 60%)",
        }}
      >
        <div style={{ fontSize: 34, marginBottom: 8 }}>❓</div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 800,
            color: "#fff",
            fontFamily: "'Syne', sans-serif",
            marginBottom: 4,
          }}
        >
          Frequently Asked Questions
        </div>
        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
          {FAQ_DATA.reduce((acc, c) => acc + c.questions.length, 0)} questions
          across {FAQ_DATA.length} categories
        </div>

        {/* Search */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: 12,
          }}
        >
          <Search size={15} style={{ color: "#6b7280", flexShrink: 0 }} />
          <input
            value={faqSearch}
            onChange={(e) => setFaqSearch(e.target.value)}
            placeholder="Search questions..."
            style={{
              flex: 1,
              background: "none",
              border: "none",
              color: "#fff",
              fontSize: 14,
              outline: "none",
            }}
          />
          {faqSearch && (
            <button
              onClick={() => setFaqSearch("")}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#6b7280",
                padding: 0,
                fontSize: 16,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          )}
        </div>

        {faqSearch && (
          <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
            {totalResults} result{totalResults !== 1 ? "s" : ""} for "
            {faqSearch}"
          </div>
        )}
      </div>

      {/* Category pills (when not searching) */}
      {!faqSearch && (
        <div
          style={{
            padding: "12px 16px 4px",
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          {FAQ_DATA.map((cat) => (
            <button
              key={cat.category}
              onClick={() =>
                setOpenCategory(
                  openCategory === cat.category ? null : cat.category,
                )
              }
              style={{
                padding: "5px 12px",
                borderRadius: 20,
                border: `1px solid ${openCategory === cat.category ? "rgba(132,204,22,0.4)" : "rgba(255,255,255,0.08)"}`,
                background:
                  openCategory === cat.category
                    ? "rgba(132,204,22,0.1)"
                    : "rgba(255,255,255,0.03)",
                color: openCategory === cat.category ? "#a3e635" : "#9ca3af",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <span>{cat.icon}</span> {cat.category}
            </button>
          ))}
        </div>
      )}

      {/* FAQ content */}
      <div style={{ padding: "12px 16px 20px" }}>
        {filteredData.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🤔</div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "#fff",
                marginBottom: 8,
              }}
            >
              No questions found
            </div>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 18 }}>
              Try different keywords or browse all categories.
            </div>
            <button
              onClick={onNavigateToContact}
              style={{
                padding: "10px 20px",
                background: "rgba(132,204,22,0.1)",
                border: "1px solid rgba(132,204,22,0.3)",
                borderRadius: 10,
                color: "#a3e635",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Ask our support team →
            </button>
          </div>
        ) : (
          filteredData
            .filter(
              (cat) =>
                !openCategory || cat.category === openCategory || faqSearch,
            )
            .map((cat, ci) => (
              <div key={ci} style={{ marginBottom: 24 }}>
                {/* Category header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <span style={{ fontSize: 18 }}>{cat.icon}</span>
                  <span
                    style={{ fontSize: 13, fontWeight: 700, color: "#a3e635" }}
                  >
                    {cat.category}
                  </span>
                  <span
                    style={{ fontSize: 11, color: "#4b5563", marginLeft: 2 }}
                  >
                    ({cat.questions.length})
                  </span>
                </div>

                {/* Questions */}
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 5 }}
                >
                  {cat.questions.map((faq, fi) => {
                    const key = `${ci}-${fi}`;
                    return (
                      <FAQItem
                        key={key}
                        question={faq.q}
                        answer={faq.a}
                        isOpen={!!expandedFaqs[key]}
                        onToggle={() => toggle(key)}
                      />
                    );
                  })}
                </div>
              </div>
            ))
        )}

        {/* Bottom CTA */}
        {filteredData.length > 0 && (
          <div
            style={{
              marginTop: 8,
              padding: "18px 20px",
              background: "rgba(132,204,22,0.04)",
              border: "1px solid rgba(132,204,22,0.12)",
              borderRadius: 14,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "#fff",
                marginBottom: 6,
              }}
            >
              Didn't find your answer?
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 14 }}>
              Our support team responds within 2-4 hours on weekdays.
            </div>
            <button
              onClick={onNavigateToContact}
              style={{
                padding: "9px 22px",
                background: "linear-gradient(135deg, #84cc16, #65a30d)",
                border: "none",
                borderRadius: 10,
                color: "#000",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Contact Support →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
