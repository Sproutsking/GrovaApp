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
    category: "What Xeevia is",
    icon: "🌱",
    questions: [
      {
        q: "What is Xeevia?",
        a: "Xeevia is a creator-first social and financial platform where people post, earn, trade attention, and build communities inside a single app. It combines social feeds, creator monetization, wallet activity, direct messages, and community spaces into one ecosystem.",
      },
      {
        q: "What makes Xeevia different from a normal social app?",
        a: "Xeevia is built around real value exchange. Engagement has weight, creators earn from participation, the wallet is native, and trust signals are recorded so actions and reputation carry meaning beyond a simple feed.",
      },
      {
        q: "Is Xeevia still growing, or is it fully launched?",
        a: "We are building toward a full social-finance ecosystem. The app is live and evolving, with the core experience already in place: feed, stories, communities, direct messaging, wallet, and creator tools. We continue to expand features as the platform matures.",
      },
    ],
  },
  {
    category: "How it works",
    icon: "⚙️",
    questions: [
      {
        q: "How do I get started on Xeevia?",
        a: "Create your account, complete your profile, and start using the app. You can post updates, join communities, message people, and explore creator content immediately. Your wallet is there to help you manage EP, earnings, and deposits.",
      },
      {
        q: "What is EP and why does it matter?",
        a: "EP is the platform’s engagement currency. It powers interaction, creator earnings, and wallet activity. You spend EP to engage; you earn EP when others engage with your content.",
      },
      {
        q: "What is XEV?",
        a: "XEV is the ecosystem ownership token. It is tied to the platform’s value and long-term growth. It complements EP by giving users a shared stake in the network while still keeping everyday activity fluid through EP.",
      },
      {
        q: "Do I need to pay to publish?",
        a: "No. Publishing posts, stories, reels, and community content is generally free. The app is designed to make expression accessible without forcing users to pay just to participate.",
      },
      {
        q: "Is there a $1 entry or activation fee?",
        a: "No. Xeevia no longer charges a paywall or $1 entry fee for account access. You can join and use the platform without an entry charge. A $1 minimum applies only when you choose to fund your wallet and receive EP.",
      },
      {
        q: "Does following someone cost EP?",
        a: "Yes. Following a user costs 2 EP. The cost applies when you follow someone; unfollowing does not create a new follow charge. This keeps following an intentional form of participation while supporting the platform economy.",
      },
    ],
  },
  {
    category: "Creator economy",
    icon: "💸",
    questions: [
      {
        q: "How do creators make money on Xeevia?",
        a: "Creators earn from engagement, story unlocks, community value, and ecosystem participation. The app is designed so that attention and contribution translate into tangible rewards rather than vanity metrics alone.",
      },
      {
        q: "What is the creator share?",
        a: "Creator earnings are distributed based on engagement and the app’s revenue structure. Tiered access and subscriptions can increase creator benefits as the platform grows, but the core idea remains straightforward: quality attention earns real value.",
      },
      {
        q: "Can I build a following and grow inside Xeevia?",
        a: "Yes. The app supports creator discovery, communities, direct relationships, and content ecosystems. The experience is built to help people grow audiences and build durable communities rather than chase temporary engagement spikes.",
      },
    ],
  },
  {
    category: "Communities & DMs",
    icon: "🏘️",
    questions: [
      {
        q: "How do communities work?",
        a: "Communities give people a space for focused discussion, role-based member management, and shared channels. They can be used for groups, niche interest spaces, creator hubs, and support conversations.",
      },
      {
        q: "Can I delete my own message in a community?",
        a: "Yes. If you are the owner of the message, you can delete it from the app’s own delete tray. It works inside the in-app experience without triggering browser popups or external dialogs.",
      },
      {
        q: "What about direct messages and group chats?",
        a: "Direct messages and group DM conversations support the same internal delete experience. Users can remove their own messages cleanly and keep the flow consistent across the app.",
      },
    ],
  },
  {
    category: "App experience",
    icon: "📱",
    questions: [
      {
        q: "How do I install the app without opening a browser tab?",
        a: "Use the Install App section in Support. It triggers the in-app install flow so the experience stays inside the Xeevia UI and feels native instead of browser-based.",
      },
      {
        q: "Why do I see a different experience on mobile and desktop?",
        a: "The app supports both mobile and desktop layouts. The experiences are designed to feel native on each device while sharing the same core ecosystem, wallet, and social features.",
      },
      {
        q: "What are we building toward?",
        a: "We are building a complete social-finance platform: stronger creator monetization, richer communities, better trust signals, and deeper wallet-to-content integration as the ecosystem expands.",
      },
    ],
  },
  {
    category: "Safety & support",
    icon: "🛡️",
    questions: [
      {
        q: "How do I get help?",
        a: "Use the Help center for product guidance, the FAQ for common questions, or the Contact page to create a support ticket with our team.",
      },
      {
        q: "What happens if I see something abusive or unsafe?",
        a: "Use the reporting tools in the app and contact support if the issue needs moderation review. We review reports to keep the platform safe while keeping the experience approachable for everyone.",
      },
      {
        q: "Can I contact support directly?",
        a: "Yes. You can open a support ticket from the app and track updates through the support center without leaving the app shell.",
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