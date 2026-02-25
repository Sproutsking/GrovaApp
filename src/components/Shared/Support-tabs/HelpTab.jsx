import React, { useState } from "react";
import { ChevronRight, Clock, Book, Search, ArrowLeft } from "lucide-react";

// ─── HELP TOPICS DATA ────────────────────────────────────────────────────────

const HELP_TOPICS = [
  {
    id: "tokens",
    icon: "💰",
    title: "Grova Tokens & Wallet",
    description: "How to earn, spend, and manage your GT",
    color: "#f59e0b",
    articles: [
      {
        id: "tokens-1",
        title: "Understanding the Dual Token System (EP + XEV)",
        readTime: "5 min",
        content: `## The Two Currencies That Power Xeevia

Xeevia runs on a carefully designed two-token economy built so that every interaction has real value — and that value flows to the people creating it, not just the platform.

### Engagement Points (EP)
Engagement Points are your **social fuel**. Think of them like electricity: you use them to power every action you take on the platform, and when you receive them, it means someone valued what you created.

**How EP works:**
- **$1 = 100 EP** — fixed, transparent, and predictable
- EP is minted when you deposit funds
- EP is burned (destroyed) when you spend it on interactions
- This means there's no inflation, no hoarding, no manipulation

**What you spend EP on:**
| Action | Cost |
|--------|------|
| Like a post | 2 EP |
| Comment | 4 EP |
| Post content | 10 EP |

**What makes EP special:** Unlike points on other platforms, EP is backed 1:1 by real money. When you receive EP, you're receiving real value.

---

### XEV Token ($XEV)
XEV is your **ownership stake** in the Xeevia network. While EP powers your daily interactions, XEV represents long-term value.

**Key facts about XEV:**
- Fixed total supply: **1,000,000,000,000 (1 Trillion) XEV** — never more, ever
- 40% of your monthly EP earnings auto-convert to XEV
- XEV can be staked to earn a share of platform revenue
- XEV gives you governance voting rights
- XEV can be withdrawn as real cash

**Why this matters:** As Xeevia grows, the total value represented by XEV grows — but the supply never increases. This is the economic engine that makes early adoption genuinely rewarding.

---

### Your Wallet Dashboard
Your wallet shows you in real time:
- **EP Balance** — your spending power
- **XEV Holdings** — your ownership position
- **Monthly Earnings** — track your creator income
- **Conversion History** — see your EP → XEV conversions

To access your wallet: tap the **Wallet** tab in navigation.`,
      },
      {
        id: "tokens-2",
        title: "How to Deposit Funds & Get EP",
        readTime: "3 min",
        content: `## Funding Your Xeevia Account

Getting EP is straightforward. Here's everything you need to know.

### Payment Methods
Xeevia accepts:
- **Credit/Debit Cards** (Visa, Mastercard, American Express)
- **Paystack** (for Nigerian users — supports local bank transfer, USSD, and cards)
- **Cryptocurrency** (ETH, USDC, USDT via Web3 wallet)

### Minimum Deposit
The minimum deposit is **$1.00**, which gives you **100 EP** — enough to make 50 likes, 25 comments, or 10 posts.

### How to Deposit
1. Open the **Wallet** tab
2. Tap **Add Funds** or **Deposit**
3. Choose your payment method
4. Enter the amount (minimum $1)
5. Complete the payment
6. EP appears in your wallet instantly

### Security
All payments are processed through PCI-DSS compliant payment processors. Xeevia never stores your card details.

### Deposit Limits
| Account Type | Daily Limit |
|-------------|------------|
| Standard | $500/day |
| Verified | Higher limits available |
| VIP | Custom limits |

### What Happens to Your Money
Your deposit is converted to EP at the fixed rate of $1 = 100 EP. The platform keeps a 2% protocol fee on transactions. The rest flows to creators.`,
      },
      {
        id: "tokens-3",
        title: "Withdrawing Your Earnings",
        readTime: "4 min",
        content: `## Getting Your Money Out

Every EP you earn as a creator is real money. Here's how to withdraw it.

### Withdrawal Eligibility
You can withdraw when you have at least **1,000 EP** in earned (not purchased) EP.

### Setting Up Your Withdrawal PIN
Before your first withdrawal, you'll need to set a 6-digit PIN. This is a security layer that protects your funds.

1. Go to **Wallet → Security Settings**
2. Tap **Set Withdrawal PIN**
3. Enter and confirm your 6-digit PIN
4. PIN is now required for every withdrawal

### Withdrawal Methods
- **Bank Transfer** — processed in 24-48 hours
- **Paystack** — for Nigerian bank accounts
- **Crypto Wallet** — for ETH/USDC withdrawals

### Withdrawal Limits
| Account Type | Daily Limit |
|-------------|------------|
| Standard | $500 |
| Pro | $2,000 |
| VIP | $10,000 |

### Processing Time
- Bank transfers: 1-3 business days
- Crypto: 30 minutes to 2 hours (blockchain confirmation)

### Fees
Xeevia charges no withdrawal fees. You receive the full amount. Your bank may charge standard transfer fees.

### XEV Withdrawals
To withdraw XEV, you first convert it to EP at the current exchange rate, then withdraw EP normally.`,
      },
      {
        id: "tokens-4",
        title: "Understanding Your Creator Earnings",
        readTime: "3 min",
        content: `## How Creator Earnings Work

When someone engages with your content, you earn EP directly. Here's the exact breakdown.

### Creator Revenue Share
- **Subscribed (Pro) Creators:** 84% of every engagement
- **Standard Creators:** 80% of every engagement
- **Platform protocol fee:** 2% (supports infrastructure)
- **Ecosystem fund:** 14-18% (stakers, community rewards)

### Example Calculation
If someone pays **10 EP** to post a comment on your story:
- You receive: **8.4 EP** (Pro) or **8 EP** (Standard)
- Protocol fee: **0.2 EP**
- Rest goes to ecosystem rewards

### Monthly XEV Conversion
At the end of every calendar month, **40% of your earned EP** automatically converts to XEV tokens.

Example: If you earned 10,000 EP in March:
- 6,000 EP stays as EP (usable for interactions or withdrawal)
- 4,000 EP converts to XEV at current rate

### Tracking Your Earnings
Your earnings dashboard shows:
- Daily, weekly, monthly, and annual EP earned
- Top-performing content
- Engagement breakdown by type
- XEV accumulation over time`,
      },
      {
        id: "tokens-5",
        title: "Staking XEV for Passive Income",
        readTime: "4 min",
        content: `## Earn Passive Income by Staking XEV

XEV staking lets you earn a share of the platform's total revenue without doing anything extra.

### How Staking Works
When you stake XEV, you lock it into the platform's revenue-sharing pool. In return, you receive a proportional share of the 20% of platform revenue allocated to XEV stakers.

### What You Earn
- **20% of total platform revenue** is distributed to stakers monthly
- Your share = (Your staked XEV / Total staked XEV) × 20% of monthly revenue
- Earnings are distributed as EP, which you can spend or withdraw

### Staking Terms
- **Minimum stake:** 100 XEV
- **Lock period:** 30 days minimum
- **Unstaking period:** 7-day cooldown after requesting unstake

### Governance Rights
Staked XEV gives you voting power on platform decisions:
- Protocol upgrades
- Fee structure changes
- Ecosystem fund allocations
- New feature priorities

1 staked XEV = 1 vote.

### How to Stake
1. Open **Wallet → XEV Holdings**
2. Tap **Stake XEV**
3. Enter amount to stake
4. Confirm with your withdrawal PIN
5. Staking begins immediately`,
      },
    ],
  },
  {
    id: "publishing",
    icon: "📖",
    title: "Publishing Stories",
    description: "Tips for creating engaging content",
    color: "#8b5cf6",
    articles: [
      {
        id: "pub-1",
        title: "Writing Stories That People Pay to Read",
        readTime: "6 min",
        content: `## The Art of the Paid Story

On Xeevia, your stories are products. Unlike free content that competes for attention, paid stories create a selection effect — only genuinely interested readers pay to unlock them.

### What Makes a Story Worth Paying For

**Exclusive depth.** Your preview (the free part) should be compelling enough to create desire. Your full story should be so good that readers feel the unlock was worth every EP.

**Categories that convert well:**
- Personal essays with real stakes and transformation
- How-to guides based on genuine expertise
- Fiction with strong hooks and satisfying arcs
- Investigative takes on industry topics
- Cultural commentary with sharp perspective

### Pricing Your Stories

| Content Type | Suggested Range |
|-------------|----------------|
| Short reads (under 500 words) | 10-30 EP |
| Medium essays (500-1500 words) | 30-80 EP |
| Long-form (1500+ words) | 80-200 EP |
| Premium guides & tutorials | 100-500 EP |

Don't underprice. Readers use price as a quality signal. A 200 EP story signals value that a 10 EP story doesn't.

### The Preview Is Everything
Your preview (max 500 characters) is your sales pitch. It should:
- Open with a hook that creates tension or curiosity
- Hint at the transformation or revelation inside
- Not give away the ending
- Leave the reader wanting more`,
      },
      {
        id: "pub-2",
        title: "Story Categories & Finding Your Niche",
        readTime: "4 min",
        content: `## Finding Your Story Category

Your category determines who discovers your work. Choose strategically.

### Available Categories
- **Folklore** — Legends, myths, cultural stories, tradition
- **Fiction** — Short stories, flash fiction, serialized narratives
- **Personal Essay** — First-person experiences, life lessons, reflection
- **Business & Finance** — Entrepreneurship, money, career insights
- **Technology** — Tech culture, product insights, digital life
- **Health & Wellness** — Mental health, fitness, lifestyle
- **Social Commentary** — Culture, society, politics (balanced perspective)
- **Spirituality** — Faith, philosophy, inner life
- **Entertainment** — Pop culture, reviews, fan perspectives
- **Education** — Explainers, how-tos, academic takes

### Niche Strategy
The platform rewards specificity. "Tech" is broad. "Building SaaS products with no funding in Africa" is a niche. Niches build loyal readers who will consistently pay to read your work.

### Trending vs. Evergreen
**Trending content** performs well immediately but fades. **Evergreen content** (timeless advice, universal experiences) continues to earn EP months after publishing.

Aim for 70% evergreen, 30% trending in your content mix.`,
      },
      {
        id: "pub-3",
        title: "Understanding the Story Preview System",
        readTime: "3 min",
        content: `## Mastering Your Story Preview

The preview is the single most important element of your story on Xeevia.

### Preview Structure (Max 500 Characters)

**Formula that works:**
> [Hook sentence that creates tension] + [1-2 sentences that deepen it] + [Implication of what they'll get if they read on]

**Example — Bad preview:**
> "This is my story about how I lost everything and built it back up. Read on to find out what happened."

**Example — Good preview:**
> "I had $7 in my account the morning my company got featured in TechCrunch. Here's what nobody tells you about what happens the day your life is supposed to change — and why it almost destroyed me instead."

### The Unlock Rate Metric
Unlock rate = (unlocks / views) × 100

| Rate | Meaning |
|------|---------|
| Under 1% | Preview needs rework |
| 1-3% | Baseline performance |
| 3-8% | Good performance |
| 8-15% | Excellent |
| 15%+ | Exceptional |`,
      },
      {
        id: "pub-4",
        title: "Content Policies & What's Allowed",
        readTime: "4 min",
        content: `## Xeevia Content Guidelines

Xeevia is a platform for human expression. We have minimal restrictions — but some things are non-negotiable.

### What's Always Allowed
- Personal stories, including difficult experiences
- Opinion and commentary on any topic
- Fiction, including mature themes with appropriate notice
- Business, financial, and technical content
- Cultural criticism and social commentary
- Humor, satire, and parody (clearly labeled)

### What's Never Allowed
- Sexual content involving minors — immediate permanent ban
- Doxxing (publishing someone's private information)
- Incitement to violence against specific individuals or groups
- Coordinated harassment campaigns
- Financial fraud or deliberate misinformation presented as fact

### Enforcement
Reports are reviewed by our moderation team within 24 hours. Valid violations result in:
1. **Warning** (first offense, minor)
2. **Content removal** (first offense, serious)
3. **30-day suspension** (second offense)
4. **Permanent ban** (severe violations or repeated offenses)

You can appeal any moderation decision through the support ticket system.`,
      },
      {
        id: "pub-5",
        title: "Drafts — Save & Come Back Later",
        readTime: "2 min",
        content: `## Never Lose Your Work With Drafts

Xeevia automatically saves your work as you write.

### Auto-Save
Every 30 seconds, your work is automatically saved to your drafts. Even if your browser closes or your connection drops, your content is safe.

### Draft Management
Access your drafts from: **Create → My Drafts**

Your drafts show:
- Content type (Post, Story, Reel)
- Title (for stories)
- Last edited timestamp
- Preview of your content

### Draft Limits
You can have up to **50 drafts** at once. When you reach the limit, you'll need to delete old drafts before saving new ones.

### Draft Security
Drafts are private by default. No one can see your drafts except you. Even Xeevia staff cannot access your unpublished drafts.`,
      },
    ],
  },
  {
    id: "reels",
    icon: "🎬",
    title: "Reels & Videos",
    description: "Best practices for video content",
    color: "#ef4444",
    articles: [
      {
        id: "reel-1",
        title: "Creating Reels That Earn",
        readTime: "5 min",
        content: `## Making Reels That Generate Real Income

Reels on Xeevia work differently from other platforms. Every view is priced — meaning every watch is a genuine signal of interest.

### First 3 Seconds Rule
In a paid engagement environment, viewers are more selective. Your reel must hook in under 3 seconds.

**Hook strategies that work:**
- **The contrarian open:** Start by saying something that challenges a common belief
- **The visual hook:** Open with your most visually striking moment
- **The stakes hook:** "I almost [lost/quit/failed] because of this..."
- **The utility hook:** "In the next 60 seconds, you'll learn how to..."

### Optimal Reel Length
| Length | Best For |
|--------|----------|
| 15-30 seconds | Impressions, shares, discovery |
| 30-60 seconds | Education, entertainment (sweet spot) |
| 60-90 seconds | Narrative, deep dives, tutorials |
| 90+ seconds | Only for truly compelling content |

### Audio Strategy
Reels with music or clear voiceover outperform silent reels by 3-4x.

### Thumbnail Selection
A strong thumbnail increases click-through on your reel in the explore feed. Select the frame that is:
- Visually clearest (no blurry frames)
- Emotionally expressive (if a face is shown)
- Representative of the best moment`,
      },
      {
        id: "reel-2",
        title: "Technical Specs for Reel Uploads",
        readTime: "3 min",
        content: `## Reel Upload Specifications

### Video Requirements
| Setting | Spec |
|---------|------|
| Format | MP4 (H.264 codec) |
| Resolution | Minimum 720p, recommended 1080p |
| Aspect Ratio | 9:16 (vertical) for full-screen |
| Max Duration | 10 minutes |
| Max File Size | 500MB |
| Frame Rate | 24fps, 30fps, or 60fps |

### Upload Process
1. Tap the **+** (Create) button
2. Select **Reel**
3. Upload your video file
4. While uploading, add caption, music, and category
5. Select or upload a thumbnail
6. Tap **Publish**

### Processing Time
| File Size | Processing Time |
|-----------|----------------|
| Under 100MB | 1-3 minutes |
| 100-300MB | 3-8 minutes |
| 300MB+ | 8-20 minutes |

### Common Upload Errors
- **File too large:** Compress with HandBrake or Adobe Premiere
- **Unsupported format:** Convert to MP4 using VLC or CloudConvert
- **Upload failed:** Check your connection; your progress is saved`,
      },
      {
        id: "reel-3",
        title: "Reel Categories & Discovery",
        readTime: "3 min",
        content: `## Getting Your Reels Discovered

Category selection is your primary lever for discovery on Xeevia.

### How the Explore Feed Works
Xeevia's explore algorithm surfaces content based on:
1. Category relevance to the viewer's history
2. Engagement velocity (likes + comments in first hour)
3. Creator credibility score
4. Content freshness

The best way to get into the explore feed: post consistently, engage actively in the first hour after publishing.

### Engagement Momentum
Comment on at least 5-10 other reels in your category before and after posting. This signals activity to the algorithm and often results in those creators discovering your work.

### Categories for Reels
Entertainment, Education, Lifestyle, Business, Technology, Sports & Fitness, Comedy, Art & Music, Food & Cooking, Travel`,
      },
    ],
  },
  {
    id: "security",
    icon: "🔒",
    title: "Account & Security",
    description: "Protect your account and data",
    color: "#10b981",
    articles: [
      {
        id: "sec-1",
        title: "Securing Your Xeevia Account",
        readTime: "5 min",
        content: `## Complete Account Security Guide

Your Xeevia account holds real money and real content. Protecting it requires multiple security layers.

### Layer 1: Strong Authentication
Xeevia supports sign-in via Google, X (Twitter), Facebook, and Discord.

**Recommendation:** Use whichever provider has the strongest security you maintain. If your Google account has 2FA, your Xeevia account benefits from that protection.

### Layer 2: Withdrawal PIN
Your withdrawal PIN is a separate 6-digit code required for all financial transactions on Xeevia. Even if someone accesses your account, they cannot withdraw your funds without this PIN.

**Rules:**
- Don't use sequential numbers (123456)
- Don't use your birth year
- Don't share with anyone — Xeevia support will **never** ask for your PIN

### Layer 3: Trusted Devices
Xeevia tracks your login devices. You can view and manage trusted devices in: **Account → Security → Trusted Devices**

Remove any device you don't recognize immediately.

### Suspicious Activity
Signs your account may be compromised:
- Login notifications from locations you don't recognize
- Content posted that you didn't create
- Wallet transactions you didn't authorize

**What to do:** Immediately go to **Account → Security → Active Sessions → End All Sessions**. Then change your connected provider's password.`,
      },
      {
        id: "sec-2",
        title: "Privacy Controls & Data Management",
        readTime: "4 min",
        content: `## Controlling Your Privacy on Xeevia

### Profile Privacy Settings

**Public Profile (Default):** Your profile, posts, and reels are visible to everyone.

**Private Profile:** Only approved followers can see your content.

To switch: **Account → Privacy → Profile Visibility**

### What Xeevia Collects
- Account information: Email, name, username
- Content: Posts, stories, reels you create
- Engagement: Content you like, comment on, or unlock
- Device information: Browser type, device model, IP address (for security)
- Financial: Transaction history (never card numbers)

### What Xeevia Does NOT Collect
- Your contact lists
- Location (unless you share it in content)
- Microphone or camera when not in use
- Browsing history outside of Xeevia

### Data Export
You can request a full export of your data: **Account → Privacy → Export My Data**

### Account Deletion
- All your content is removed within 30 days
- Financial data is retained for 7 years (legal requirement)
- Your username becomes available after 90 days`,
      },
      {
        id: "sec-3",
        title: "Recognizing & Reporting Scams",
        readTime: "4 min",
        content: `## Protecting Yourself From Scams on Xeevia

### Common Scam Types

**The "Boost Your Views" Scam**
Fake services promise to buy EP engagement cheaply. These steal your money, your credentials, or deliver fake engagement that gets your account penalized.

**The "Investment" Scam**
Someone offers to multiply your XEV through an "exclusive staking pool" outside the platform. XEV can only be staked through the official Xeevia wallet.

**The "Verification" Scam**
A message claiming to be from Xeevia support asking for your PIN or password. Xeevia will **never** ask for these. Ever.

**Phishing**
Fake Xeevia websites designed to steal your login. Always verify the URL: it must be **app.xeevia.com** or a subdomain of **xeevia.com**.

### Red Flags
🚩 Anyone asking for your withdrawal PIN
🚩 Requests to send EP "to unlock a bigger reward"
🚩 Login links sent via DM
🚩 Urgent language about your account being "at risk"

### How to Report
1. Go to the user's profile or suspicious message
2. Tap the **⋮** menu → **Report**
3. Select "Scam or Fraud"
4. Describe what happened
5. Submit — our team reviews within 24 hours`,
      },
    ],
  },
  {
    id: "payments",
    icon: "💳",
    title: "Payments & Withdrawals",
    description: "How to cash out your earnings",
    color: "#3b82f6",
    articles: [
      {
        id: "pay-1",
        title: "Complete Payments Guide",
        readTime: "5 min",
        content: `## Everything About Payments on Xeevia

### Supported Payment Methods

**For Deposits:**
| Method | Regions | Processing Time |
|--------|---------|----------------|
| Credit/Debit Card | Global | Instant |
| Paystack | Nigeria, Ghana, Kenya | Instant |
| Bank Transfer | Select regions | 1-3 days |
| USDC/USDT | Global | 15-30 min |
| ETH | Global | 15-30 min |

**For Withdrawals:**
| Method | Regions | Processing Time |
|--------|---------|----------------|
| Bank Transfer | Global | 1-3 business days |
| Paystack (NGN) | Nigeria | Same day |
| USDC | Global | 30 min |

### Fees
- **Deposits:** No Xeevia fee. Your payment provider may charge fees.
- **Withdrawals:** No Xeevia fee. Bank transfer fees vary by institution.
- **Platform fee:** 2% on every interaction (funds the ecosystem, not withdrawals)

### Transaction History
Every transaction is logged: **Wallet → Transaction History**

You can filter by date, type, and amount, and export as CSV.`,
      },
      {
        id: "pay-2",
        title: "Transaction Disputes & Refunds",
        readTime: "4 min",
        content: `## Handling Transaction Issues

### Unauthorized Transaction
If you see a transaction you didn't make:
1. Check if someone else has access to your account
2. End all active sessions: **Account → Security → End All Sessions**
3. Submit a support ticket immediately with the transaction ID
4. We investigate within 24 hours

### Failed Deposit
If your payment processed but EP didn't appear:
1. Wait 15 minutes (crypto can be slow)
2. Check your bank/card statement to confirm payment completed
3. Submit a support ticket with your transaction reference number
4. We typically resolve within 2 hours

### Refund Policy

| Situation | Refund |
|-----------|--------|
| Deposits not used | Full refund if EP not credited |
| Story Unlocks | Non-refundable |
| Fraudulent transactions | Full refund to wallet balance |

### What to Include in Your Dispute
- Transaction ID (found in **Wallet → Transaction History**)
- Date and amount
- What you expected vs. what happened
- Screenshots if relevant`,
      },
    ],
  },
];

// ─── MARKDOWN RENDERER ────────────────────────────────────────────────────────

function renderMarkdown(text) {
  if (!text) return null;
  const lines = text.trim().split("\n");
  const elements = [];
  let i = 0;
  let tableBuffer = [];
  let inTable = false;

  const flushTable = () => {
    if (tableBuffer.length < 2) {
      tableBuffer = [];
      inTable = false;
      return;
    }
    const headers = tableBuffer[0]
      .split("|")
      .map((h) => h.trim())
      .filter(Boolean);
    const rows = tableBuffer.slice(2).map((r) =>
      r
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean),
    );
    elements.push(
      <div key={`tbl-${i}`} style={{ overflowX: "auto", margin: "16px 0" }}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
        >
          <thead>
            <tr>
              {headers.map((h, hi) => (
                <th
                  key={hi}
                  style={{
                    padding: "8px 12px",
                    background: "rgba(132,204,22,0.08)",
                    borderBottom: "2px solid rgba(132,204,22,0.25)",
                    textAlign: "left",
                    color: "#a3e635",
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    style={{
                      padding: "8px 12px",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                      color: "#9ca3af",
                      fontSize: 13,
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>,
    );
    tableBuffer = [];
    inTable = false;
  };

  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("|")) {
      inTable = true;
      tableBuffer.push(line);
      continue;
    }
    if (inTable) flushTable();

    if (line.startsWith("## ")) {
      elements.push(
        <h2
          key={i}
          style={{
            fontSize: 17,
            fontWeight: 800,
            color: "#fff",
            margin: "24px 0 8px",
            fontFamily: "'Syne', sans-serif",
            lineHeight: 1.3,
          }}
        >
          {line.slice(3)}
        </h2>,
      );
    } else if (line.startsWith("### ")) {
      elements.push(
        <h3
          key={i}
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "#e5e7eb",
            margin: "18px 0 6px",
          }}
        >
          {line.slice(4)}
        </h3>,
      );
    } else if (line.startsWith("- ")) {
      elements.push(
        <div
          key={i}
          style={{
            display: "flex",
            gap: 8,
            margin: "5px 0",
            color: "#9ca3af",
            fontSize: 13,
            lineHeight: 1.7,
          }}
        >
          <span style={{ color: "#a3e635", marginTop: 3, flexShrink: 0 }}>
            ▸
          </span>
          <span
            dangerouslySetInnerHTML={{
              __html: line
                .slice(2)
                .replace(
                  /\*\*(.*?)\*\*/g,
                  '<strong style="color:#e5e7eb">$1</strong>',
                ),
            }}
          />
        </div>,
      );
    } else if (/^\d+\. /.test(line)) {
      const num = line.match(/^(\d+)\. /)[1];
      elements.push(
        <div
          key={i}
          style={{
            display: "flex",
            gap: 10,
            margin: "5px 0",
            color: "#9ca3af",
            fontSize: 13,
            lineHeight: 1.7,
          }}
        >
          <span
            style={{
              color: "#a3e635",
              fontWeight: 700,
              flexShrink: 0,
              minWidth: 18,
            }}
          >
            {num}.
          </span>
          <span
            dangerouslySetInnerHTML={{
              __html: line
                .replace(/^\d+\. /, "")
                .replace(
                  /\*\*(.*?)\*\*/g,
                  '<strong style="color:#e5e7eb">$1</strong>',
                ),
            }}
          />
        </div>,
      );
    } else if (line.startsWith("> ")) {
      elements.push(
        <blockquote
          key={i}
          style={{
            borderLeft: "3px solid #a3e635",
            paddingLeft: 14,
            margin: "14px 0",
            color: "#9ca3af",
            fontSize: 13,
            fontStyle: "italic",
            lineHeight: 1.8,
          }}
        >
          {line.slice(2)}
        </blockquote>,
      );
    } else if (line.startsWith("---")) {
      elements.push(
        <hr
          key={i}
          style={{
            border: "none",
            borderTop: "1px solid rgba(255,255,255,0.07)",
            margin: "20px 0",
          }}
        />,
      );
    } else if (
      line.startsWith("**") &&
      line.endsWith("**") &&
      !line.slice(2).includes("**")
    ) {
      elements.push(
        <p
          key={i}
          style={{
            fontWeight: 700,
            color: "#fff",
            margin: "10px 0 4px",
            fontSize: 13,
          }}
        >
          {line.slice(2, -2)}
        </p>,
      );
    } else if (line.trim()) {
      elements.push(
        <p
          key={i}
          style={{
            color: "#9ca3af",
            lineHeight: 1.85,
            margin: "7px 0",
            fontSize: 13,
          }}
          dangerouslySetInnerHTML={{
            __html: line
              .replace(
                /\*\*(.*?)\*\*/g,
                '<strong style="color:#e5e7eb">$1</strong>',
              )
              .replace(
                /`(.*?)`/g,
                '<code style="background:rgba(132,204,22,0.1);color:#a3e635;padding:2px 6px;border-radius:4px;font-size:12px;font-family:monospace">$1</code>',
              ),
          }}
        />,
      );
    }
  }
  if (inTable) flushTable();
  return elements;
}

// ─── ARTICLE VIEW ─────────────────────────────────────────────────────────────

function ArticleView({ article, topic, onBack, onContact }) {
  return (
    <div>
      {/* Breadcrumb */}
      <div
        style={{
          padding: "16px 20px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <button
          onClick={onBack}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#6b7280",
            fontSize: 12,
            padding: 0,
            marginBottom: 10,
          }}
        >
          <ArrowLeft size={13} /> Back to {topic.title}
        </button>
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            marginBottom: 6,
          }}
        >
          <span style={{ fontSize: 14 }}>{topic.icon}</span>
          <span style={{ fontSize: 11, color: topic.color, fontWeight: 600 }}>
            {topic.title}
          </span>
        </div>
        <h1
          style={{
            fontSize: 17,
            fontWeight: 800,
            color: "#fff",
            fontFamily: "'Syne', sans-serif",
            lineHeight: 1.35,
            margin: 0,
          }}
        >
          {article.title}
        </h1>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginTop: 8,
          }}
        >
          <Clock size={12} style={{ color: "#6b7280" }} />
          <span style={{ fontSize: 11, color: "#6b7280" }}>
            {article.readTime} read
          </span>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px 20px 16px" }}>
        {renderMarkdown(article.content)}
      </div>

      {/* Still need help CTA */}
      <div
        style={{
          margin: "8px 20px 24px",
          padding: "18px 20px",
          background: "rgba(132,204,22,0.04)",
          border: "1px solid rgba(132,204,22,0.12)",
          borderRadius: 14,
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "#fff",
            marginBottom: 5,
          }}
        >
          Still need help?
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 14 }}>
          Our support team is ready to assist you directly.
        </div>
        <button
          onClick={onContact}
          style={{
            padding: "9px 20px",
            background: "linear-gradient(135deg, #84cc16, #65a30d)",
            border: "none",
            borderRadius: 10,
            color: "#000",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Open a Support Ticket →
        </button>
      </div>
    </div>
  );
}

// ─── TOPIC VIEW ───────────────────────────────────────────────────────────────

function TopicView({ topic, onSelectArticle, onBack }) {
  return (
    <div>
      <div
        style={{
          padding: "20px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          background: `${topic.color}06`,
        }}
      >
        <button
          onClick={onBack}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#6b7280",
            fontSize: 12,
            padding: 0,
            marginBottom: 14,
          }}
        >
          <ArrowLeft size={13} /> All Topics
        </button>
        <div style={{ fontSize: 38, marginBottom: 10 }}>{topic.icon}</div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: "#fff",
            fontFamily: "'Syne', sans-serif",
            marginBottom: 4,
          }}
        >
          {topic.title}
        </div>
        <div style={{ fontSize: 12, color: "#6b7280" }}>
          {topic.articles.length} articles in this section
        </div>
      </div>

      <div
        style={{
          padding: "14px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {topic.articles.map((article) => (
          <button
            key={article.id}
            onClick={() => onSelectArticle(article)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "14px 16px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 13,
              cursor: "pointer",
              textAlign: "left",
              width: "100%",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = `${topic.color}40`;
              e.currentTarget.style.background = `${topic.color}07`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
              e.currentTarget.style.background = "rgba(255,255,255,0.02)";
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: `${topic.color}15`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Book size={15} style={{ color: topic.color }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#fff",
                  marginBottom: 3,
                  lineHeight: 1.4,
                }}
              >
                {article.title}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Clock size={11} style={{ color: "#6b7280" }} />
                <span style={{ fontSize: 11, color: "#6b7280" }}>
                  {article.readTime} read
                </span>
              </div>
            </div>
            <ChevronRight
              size={15}
              style={{ color: "#6b7280", flexShrink: 0 }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN HELP TAB ────────────────────────────────────────────────────────────

export default function HelpTab({ onNavigateToContact, onViewChange }) {
  const [view, setView] = useState("topics"); // topics | topic | article
  const [activeTopic, setActiveTopic] = useState(null);
  const [activeArticle, setActiveArticle] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const setViewTracked = (v) => {
    setView(v);
    onViewChange?.(v);
  };

  const filteredTopics = HELP_TOPICS.filter((t) =>
    searchQuery
      ? t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.articles.some((a) =>
          a.title.toLowerCase().includes(searchQuery.toLowerCase()),
        )
      : true,
  );

  // Search results flat list
  const searchResults = searchQuery
    ? HELP_TOPICS.flatMap((t) =>
        t.articles
          .filter((a) =>
            a.title.toLowerCase().includes(searchQuery.toLowerCase()),
          )
          .map((a) => ({ ...a, topic: t })),
      )
    : [];

  if (view === "article" && activeArticle && activeTopic) {
    return (
      <ArticleView
        article={activeArticle}
        topic={activeTopic}
        onBack={() => setViewTracked("topic")}
        onContact={onNavigateToContact}
      />
    );
  }

  if (view === "topic" && activeTopic) {
    return (
      <TopicView
        topic={activeTopic}
        onSelectArticle={(a) => {
          setActiveArticle(a);
          setViewTracked("article");
        }}
        onBack={() => {
          setActiveTopic(null);
          setViewTracked("topics");
        }}
      />
    );
  }

  return (
    <div>
      {/* Hero */}
      <div
        style={{
          padding: "22px 20px 18px",
          background:
            "linear-gradient(135deg, rgba(132,204,22,0.07) 0%, transparent 60%)",
          borderBottom: "1px solid rgba(132,204,22,0.1)",
        }}
      >
        <div style={{ fontSize: 34, marginBottom: 8 }}>🌿</div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 800,
            color: "#fff",
            fontFamily: "'Syne', sans-serif",
            marginBottom: 4,
          }}
        >
          How can we help?
        </div>
        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
          Find answers in our knowledge base
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
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search help articles..."
            style={{
              flex: 1,
              background: "none",
              border: "none",
              color: "#fff",
              fontSize: 14,
              outline: "none",
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
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
      </div>

      {/* Search results */}
      {searchQuery && (
        <div style={{ padding: "14px 16px" }}>
          {searchResults.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "30px 0",
                color: "#6b7280",
                fontSize: 13,
              }}
            >
              No articles found for "{searchQuery}"
            </div>
          ) : (
            <>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#6b7280",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 10,
                }}
              >
                {searchResults.length} result
                {searchResults.length !== 1 ? "s" : ""}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => {
                      setActiveTopic(result.topic);
                      setActiveArticle(result);
                      setViewTracked("article");
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 14px",
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 12,
                      cursor: "pointer",
                      textAlign: "left",
                      width: "100%",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor =
                        "rgba(132,204,22,0.3)";
                      e.currentTarget.style.background =
                        "rgba(132,204,22,0.04)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor =
                        "rgba(255,255,255,0.06)";
                      e.currentTarget.style.background =
                        "rgba(255,255,255,0.02)";
                    }}
                  >
                    <span style={{ fontSize: 18, flexShrink: 0 }}>
                      {result.topic.icon}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#fff",
                          marginBottom: 2,
                        }}
                      >
                        {result.title}
                      </div>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>
                        {result.topic.title} · {result.readTime} read
                      </div>
                    </div>
                    <ChevronRight
                      size={14}
                      style={{ color: "#6b7280", flexShrink: 0 }}
                    />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Topic list */}
      {!searchQuery && (
        <div style={{ padding: "14px 16px 20px" }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#6b7280",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 12,
            }}
          >
            Browse Topics
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {filteredTopics.map((topic) => (
              <button
                key={topic.id}
                onClick={() => {
                  setActiveTopic(topic);
                  setViewTracked("topic");
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "15px 16px",
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 14,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.2s",
                  width: "100%",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = `${topic.color}08`;
                  e.currentTarget.style.borderColor = `${topic.color}35`;
                  e.currentTarget.style.transform = "translateX(3px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                  e.currentTarget.style.transform = "translateX(0)";
                }}
              >
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 13,
                    background: `${topic.color}14`,
                    border: `1px solid ${topic.color}28`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                    flexShrink: 0,
                  }}
                >
                  {topic.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#fff",
                      marginBottom: 3,
                    }}
                  >
                    {topic.title}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    {topic.description}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: topic.color,
                      background: `${topic.color}14`,
                      padding: "3px 9px",
                      borderRadius: 20,
                      fontWeight: 600,
                    }}
                  >
                    {topic.articles.length} articles
                  </span>
                  <ChevronRight size={15} style={{ color: "#6b7280" }} />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
