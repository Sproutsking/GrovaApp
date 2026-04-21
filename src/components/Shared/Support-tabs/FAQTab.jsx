// src/components/Support/FAQTab.jsx
// ============================================================================
// TIER LANGUAGE UPDATED to match clean architecture:
//   Subscription tiers: free | silver | gold | diamond
//   Reward levels:      none | silver | gold | diamond (earned, not bought)
//   Profile boosts:     silver | gold | diamond (cosmetic/EP bonus upgrades)
//   Gift cards:         value denominations only — NOT tiers
//   Removed all references to: is_pro, whitelist, standard, pro, vip
// ============================================================================
import React, { useState } from "react";
import { Search, ChevronDown, ChevronUp, MessageCircle } from "lucide-react";

const FAQ_DATA = [
  {
    category: "Getting Started",
    icon: "🚀",
    questions: [
      {
        q: "How do I create a Xeevia account?",
        a: "Sign up using Google, X (Twitter), Facebook, or Discord. Click \"Sign In\" and choose your provider. After connecting, you'll choose a username and complete your profile. A one-time $1 activation fee (= 100 EP) unlocks full platform access.",
      },
      {
        q: "What is the $1 activation fee?",
        a: "The $1 activation fee converts to 100 EP and activates your account. It prevents spam and ensures every user has a stake in the platform. It's a one-time payment — you never pay it again.",
      },
      {
        q: "What do I get with a free Xeevia account?",
        a: "A free account lets you publish posts, reels, and stories at no cost, follow creators, earn EP from engagement, and access your full wallet. Your creator revenue share starts at 80%. You can upgrade to Silver, Gold, or Diamond for higher creator shares, EP bonuses, increased withdrawal limits, and exclusive profile themes.",
      },
      {
        q: "Is Xeevia available in my country?",
        a: "Xeevia is globally accessible. Nigerian users have full Paystack support (NGN deposits and withdrawals). International users can use cards and crypto. We're continuously expanding local payment options.",
      },
      {
        q: "How do I choose my username?",
        a: "Choose a username between 3–30 characters using letters, numbers, and underscores. Username changes are limited to once every 60 days.",
      },
    ],
  },
  {
    category: "Tokens & Earning",
    icon: "💰",
    questions: [
      {
        q: "How do I earn EP?",
        a: "You earn EP when others engage with your content. Every like costs the liker 2 EP — you receive your creator share. Every comment costs 4 EP. Story unlocks are priced by you. The more quality content you create, the more EP flows to you.",
      },
      {
        q: "Does publishing content cost EP?",
        a: "No. Publishing posts, reels, and stories is completely free. EP is only spent on interactions — when someone likes or comments on content. The person engaging pays, not the creator.",
      },
      {
        q: "What is the difference between EP and XEV?",
        a: "EP (Engagement Points) is your day-to-day currency — earn it, spend it on interactions, withdraw it. XEV is your ownership stake in the network with a fixed supply of 1 trillion. It appreciates with platform growth and gives governance rights. 40% of your monthly earned EP automatically converts to XEV.",
      },
      {
        q: "When does the EP to XEV conversion happen?",
        a: "At the end of every calendar month, 40% of your earned EP converts to XEV at the current exchange rate. This is automatic — you don't need to do anything.",
      },
      {
        q: "Can I convert XEV back to EP?",
        a: "Yes, you can convert XEV back to EP at the current exchange rate through your wallet. Converting makes it available for immediate use or withdrawal.",
      },
      {
        q: "Do my EP earnings expire?",
        a: "Purchased EP expires after 12 months of account inactivity. Earned EP (from content engagement) never expires as long as your account remains active.",
      },
    ],
  },
  {
    category: "Subscription Tiers",
    icon: "🏆",
    questions: [
      {
        q: "What subscription tiers does Xeevia have?",
        a: "Xeevia has four subscription tiers: Free, Silver, Gold, and Diamond. Each higher tier increases your creator revenue share, unlocks EP earning bonuses, gives you exclusive profile themes and animated avatar rings, and raises your withdrawal limits.",
      },
      {
        q: "What is my 'reward level' and how is it different from my subscription tier?",
        a: "These are two separate things. Your subscription tier (Free, Silver, Gold, Diamond) is what you purchase — it determines your creator share and perks. Your reward level (also None, Silver, Gold, Diamond) is earned through activity score and platform engagement — it determines your share of the weekly revenue pool. You can have a Free subscription but earn a Gold reward level through consistent activity.",
      },
      {
        q: "What does the Silver tier unlock?",
        a: "Silver gives you an animated silver ring on your avatar, a silver name color across the platform, access to the Moonlit Chrome profile card theme, priority in follower suggestions, and an EP bonus on your earnings.",
      },
      {
        q: "What does the Gold tier unlock?",
        a: "Gold gives you an animated gold shimmer ring, gold name color, 2 exclusive profile card designs, a +10% EP bonus on all earnings, and priority content ranking in feeds.",
      },
      {
        q: "What does the Diamond tier unlock?",
        a: "Diamond is the top tier — 5 spectacular animated ring themes (Cosmos, Glacier, Emerald, Rose, Void), theme-colored name across the platform, +25% EP on all earnings, top priority in all platform rankings, and an exclusive diamond badge.",
      },
      {
        q: "How does the weekly reward pool work?",
        a: "Every week, a portion of platform revenue is split into three pools — Silver, Gold, and Diamond. Users who have reached those reward levels through activity score share proportionally from their respective pool. Your reward level is separate from your subscription tier and is earned through consistent engagement.",
      },
    ],
  },
  {
    category: "Content Creation",
    icon: "✏️",
    questions: [
      {
        q: "What types of content can I create?",
        a: "You can create Posts (text + images + video), Reels (short-form video), and Stories (long-form text with a paywall). Communities allow group channels. All content types are free to publish.",
      },
      {
        q: "How do I set the price for my story?",
        a: "When publishing a story, choose an unlock price between 10 and 500 EP. New creators often start at 20–50 EP and increase as they build reputation.",
      },
      {
        q: "Can I edit content after publishing?",
        a: "Posts can be edited after publishing. Stories can be edited for minor corrections. Reels cannot be edited — delete and re-upload.",
      },
      {
        q: "How does the story access limit work?",
        a: "When publishing a story, you can set a maximum number of people who can unlock it (default 1,000). Once the limit is reached, the story shows as sold out. You can increase the limit at any time from your content management screen.",
      },
      {
        q: "What file types are supported?",
        a: "Images: JPG, PNG, WebP, GIF (static), up to 20MB each, max 10 per post. Post video: MP4 (H.264). Reels: MP4, MOV, up to 500MB.",
      },
    ],
  },
  {
    category: "Payments & Finance",
    icon: "💳",
    questions: [
      {
        q: "When can I withdraw my earnings?",
        a: "You can withdraw when you have a minimum of 1,000 EP in earned (not purchased) EP. Withdrawals process within 1–3 business days for bank transfers, same day for Paystack (NGN), and within 30–60 minutes for crypto.",
      },
      {
        q: "Is there a fee to withdraw?",
        a: "Xeevia charges no withdrawal fees. Your bank may charge standard incoming transfer fees, and crypto transactions incur network gas fees — these are not controlled by Xeevia.",
      },
      {
        q: "How do withdrawal limits work?",
        a: "Your daily withdrawal limit is tied to your security level (1–5). Level 1: $100/day. Level 2: $250/day. Level 3: $500/day. Level 4: $2,000/day. Level 5: $10,000/day. Raise your level by verifying your phone, enabling 2FA, and setting a withdrawal PIN.",
      },
      {
        q: "What currency do I receive?",
        a: "EP is priced in USD (100 EP = $1). When withdrawing to NGN bank accounts, Xeevia converts at the current official exchange rate via Paystack. Crypto withdrawals are in USDC or USDT.",
      },
      {
        q: "My payment was successful but I didn't receive EP. What do I do?",
        a: "Wait 15 minutes for processing. For crypto deposits, wait for blockchain confirmations (usually 15–30 minutes). If EP doesn't appear after 1 hour, submit a support ticket with your transaction reference. We resolve these within 2–4 hours.",
      },
      {
        q: "Can I get a refund on EP I purchased?",
        a: "Purchased EP that has not been used can be refunded within 24 hours of purchase. Contact support with your transaction ID. Spent EP and story unlocks are non-refundable.",
      },
      {
        q: "What are gift cards?",
        a: "Xeevia gift cards let you send EP value to others for any occasion. They come in several denominations (Starter, Plus, Premium, Ultra, Max, Elite) representing different EP values. Gift cards can have a custom message and occasion set by the sender, and are redeemed directly into the recipient's wallet.",
      },
    ],
  },
  {
    category: "Account & Security",
    icon: "🔒",
    questions: [
      {
        q: "What account statuses exist and what do they mean?",
        a: "Active (normal access), Deactivated (you temporarily disabled it — reactivate any time), or Suspended (restricted by platform due to a policy violation). Suspended accounts can appeal through the support ticket system.",
      },
      {
        q: "How do I change my username?",
        a: "Go to Account → Edit Profile → Username. You can change your username once every 60 days. Your old username becomes available to others immediately.",
      },
      {
        q: "How do I increase my security level?",
        a: "Your security level (1–5) determines withdrawal limits. Increase it by: verifying your phone number (+1), enabling 2FA (+2), and setting a transaction PIN (+1). Level 5 unlocks a $10,000/day withdrawal limit.",
      },
      {
        q: "What happens to my content and earnings if I delete my account?",
        a: "Before deleting, withdraw all your earnings. Content is removed within 30 days of deletion. Financial records are retained for 7 years per legal requirements. Unspent EP and XEV not withdrawn before deletion are forfeited.",
      },
      {
        q: "Is my private messaging encrypted?",
        a: "Direct messages are stored encrypted in transit and at rest. They are not end-to-end encrypted in the same way as Signal — Xeevia staff can access messages if required by a valid legal order.",
      },
    ],
  },
  {
    category: "Communities",
    icon: "🏘️",
    questions: [
      {
        q: "How do I create a community?",
        a: "Go to the Community tab → Create Community. Set your community name (3–100 characters), description, icon, and privacy settings. You'll be the owner and can assign roles to other users.",
      },
      {
        q: "What is the difference between public and private communities?",
        a: "Public communities are discoverable and anyone can join. Private communities require an invitation or approval from the owner or admin. Premium communities can require an EP payment to join.",
      },
      {
        q: "How do community roles work?",
        a: "As community owner you can create custom roles. Default roles: Owner (all permissions), Admin (manage members and content), Moderator (moderate content), Member (post and interact).",
      },
      {
        q: "Can I monetize my community?",
        a: "Yes. Premium communities charge an EP fee for joining. All community monetization revenue goes to the community owner at the standard creator revenue share.",
      },
    ],
  },
  {
    category: "Live Streaming",
    icon: "📡",
    questions: [
      {
        q: "How does live streaming work on Xeevia?",
        a: "You can go live in video or audio mode. Your stream can be public or private. Viewers can interact in real time, and you earn EP from their engagement. Your stream tier (based on subscription) determines monthly broadcast minutes, recording capability, and maximum stream quality.",
      },
      {
        q: "Can I record my live streams?",
        a: "Recording depends on your subscription tier. When a stream is recorded, viewers can replay it from your profile. Sessions without recording show a summary card with your peak viewers, likes, duration, and stream category.",
      },
    ],
  },
  {
    category: "XRC Protocol",
    icon: "⛓️",
    questions: [
      {
        q: "What is the XRC Protocol?",
        a: "XRC (Xeevia Record Chain) is our proprietary off-chain verification system. It creates an immutable, cryptographically-linked record of every transaction, engagement, account event, and content action — providing blockchain-grade transparency without blockchain costs or delays.",
      },
      {
        q: "Is XRC the same as a blockchain?",
        a: "XRC uses hash-chaining (linking records cryptographically) but operates off-chain without distributed consensus or mining. This makes it 100–1000x faster and cheaper while maintaining verifiability.",
      },
    ],
  },
];

// ── FAQ Item ──────────────────────────────────────────────────────────────────
function FAQItem({ question, answer, isOpen, onToggle }) {
  return (
    <div style={{
      background:   isOpen ? "rgba(132,204,22,0.04)" : "rgba(255,255,255,0.015)",
      border:       `1px solid ${isOpen ? "rgba(132,204,22,0.22)" : "rgba(255,255,255,0.06)"}`,
      borderRadius: 13,
      overflow:     "hidden",
      transition:   "border-color .2s, background .2s",
      boxShadow:    isOpen ? "0 4px 20px rgba(132,204,22,.06)" : "none",
    }}>
      <button onClick={onToggle} style={{
        width: "100%", padding: "14px 16px",
        display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12,
        background: "none", border: "none", cursor: "pointer", textAlign: "left",
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: isOpen ? "#fff" : "#d4d4d4", lineHeight: 1.55, flex: 1 }}>
          {question}
        </span>
        <div style={{
          flexShrink: 0, marginTop: 2, width: 22, height: 22, borderRadius: "50%",
          background:  isOpen ? "rgba(132,204,22,0.18)" : "rgba(255,255,255,0.05)",
          display:     "flex", alignItems: "center", justifyContent: "center",
          transition:  "all .18s",
        }}>
          {isOpen
            ? <ChevronUp   size={13} style={{ color: "#a3e635" }} />
            : <ChevronDown size={13} style={{ color: "#525252" }} />
          }
        </div>
      </button>
      {isOpen && (
        <div style={{
          padding: "0 16px 16px", fontSize: 13, color: "#6b7280",
          lineHeight: 1.9, borderTop: "1px solid rgba(255,255,255,0.05)",
        }}>
          <div style={{ paddingTop: 13 }}>{answer}</div>
        </div>
      )}
    </div>
  );
}

// ── Main FAQ Tab ──────────────────────────────────────────────────────────────
export default function FAQTab({ onNavigateToContact }) {
  const [expandedFaqs, setExpandedFaqs] = useState({});
  const [faqSearch,    setFaqSearch]    = useState("");
  const [openCategory, setOpenCategory] = useState(null);

  const toggle = (key) => setExpandedFaqs((p) => ({ ...p, [key]: !p[key] }));

  const filteredData = faqSearch
    ? (() => {
        const q = faqSearch.toLowerCase();
        return FAQ_DATA.map((cat) => ({
          ...cat,
          questions: cat.questions.filter(
            (faq) => faq.q.toLowerCase().includes(q) || faq.a.toLowerCase().includes(q),
          ),
        })).filter((cat) => cat.questions.length > 0);
      })()
    : FAQ_DATA;

  const totalResults = filteredData.reduce((acc, cat) => acc + cat.questions.length, 0);

  return (
    <div>
      {/* Hero */}
      <div style={{
        padding: "16px 18px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        background: "linear-gradient(135deg, rgba(139,92,246,0.06) 0%, transparent 60%)",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(139,92,246,.3), transparent)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0, background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>❓</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 3 }}>Frequently Asked Questions</div>
            <div style={{ fontSize: 11, color: "#484848" }}>
              {FAQ_DATA.reduce((acc, c) => acc + c.questions.length, 0)} questions across {FAQ_DATA.length} categories
            </div>
          </div>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: 13, transition: "border-color .18s",
        }}
          onFocusCapture={(e) => e.currentTarget.style.borderColor = "rgba(132,204,22,.3)"}
          onBlurCapture={(e)  => e.currentTarget.style.borderColor = "rgba(255,255,255,.09)"}
        >
          <Search size={15} style={{ color: "#525252", flexShrink: 0 }} />
          <input
            value={faqSearch}
            onChange={(e) => setFaqSearch(e.target.value)}
            placeholder="Search questions…"
            style={{ flex: 1, background: "none", border: "none", color: "#fff", fontSize: 13, outline: "none" }}
          />
          {faqSearch && (
            <button onClick={() => setFaqSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#525252", padding: 0, fontSize: 18, lineHeight: 1 }}>×</button>
          )}
        </div>
        {faqSearch && (
          <div style={{ marginTop: 10, fontSize: 12, color: "#484848" }}>
            {totalResults} result{totalResults !== 1 ? "s" : ""} for "{faqSearch}"
          </div>
        )}
      </div>

      {/* Category pills */}
      {!faqSearch && (
        <div style={{ padding: "10px 16px 4px", display: "flex", gap: 6, flexWrap: "wrap" }}>
          {FAQ_DATA.map((cat) => {
            const active = openCategory === cat.category;
            return (
              <button key={cat.category} onClick={() => setOpenCategory(active ? null : cat.category)} style={{
                padding: "5px 13px", borderRadius: 20,
                border: `1px solid ${active ? "rgba(132,204,22,0.42)" : "rgba(255,255,255,0.08)"}`,
                background: active ? "rgba(132,204,22,0.1)" : "rgba(255,255,255,0.03)",
                color: active ? "#a3e635" : "#6b7280",
                fontSize: 12, fontWeight: 600, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 5, transition: "all .18s",
                boxShadow: active ? "0 2px 10px rgba(132,204,22,.1)" : "none",
              }}>
                <span>{cat.icon}</span> {cat.category}
              </button>
            );
          })}
        </div>
      )}

      {/* FAQ content */}
      <div style={{ padding: "10px 16px 20px" }}>
        {filteredData.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 20px" }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, margin: "0 auto 18px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>🤔</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 8 }}>No questions found</div>
            <div style={{ fontSize: 13, color: "#484848", marginBottom: 20 }}>Try different keywords or browse all categories.</div>
            <button onClick={onNavigateToContact} style={{ padding: "10px 22px", background: "rgba(132,204,22,0.1)", border: "1px solid rgba(132,204,22,0.3)", borderRadius: 11, color: "#a3e635", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Ask our support team →
            </button>
          </div>
        ) : (
          filteredData
            .filter((cat) => !openCategory || cat.category === openCategory || faqSearch)
            .map((cat, ci) => (
              <div key={ci} style={{ marginBottom: 28 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 11 }}>
                  <span style={{ fontSize: 17 }}>{cat.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#a3e635", letterSpacing: ".3px" }}>{cat.category}</span>
                  <span style={{ fontSize: 11, color: "#363636" }}>({cat.questions.length})</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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

        {filteredData.length > 0 && (
          <div style={{ marginTop: 10, padding: "20px", background: "rgba(132,204,22,0.03)", border: "1px solid rgba(132,204,22,0.12)", borderRadius: 16, textAlign: "center" }}>
            <div style={{ fontSize: 22, marginBottom: 10 }}>💬</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", marginBottom: 6 }}>Didn't find your answer?</div>
            <div style={{ fontSize: 12, color: "#484848", marginBottom: 16 }}>Our support team responds within 2–4 hours on weekdays.</div>
            <button onClick={onNavigateToContact} style={{ padding: "10px 24px", background: "linear-gradient(135deg, #84cc16, #65a30d)", border: "none", borderRadius: 11, color: "#000", fontSize: 13, fontWeight: 800, cursor: "pointer", boxShadow: "0 3px 14px rgba(132,204,22,.25)", display: "inline-flex", alignItems: "center", gap: 7 }}>
              <MessageCircle size={13} /> Contact Support →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}