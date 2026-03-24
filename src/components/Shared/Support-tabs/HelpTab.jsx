import React, { useState } from "react";
import { ChevronRight, Clock, Book, Search, ArrowLeft, Sparkles } from "lucide-react";

// ─── HELP TOPICS DATA ────────────────────────────────────────────────────────
// Key facts:
// - Publishing posts/reels/stories is FREE
// - EP is spent on interactions: like = 2 EP, comment = 4 EP
// - Subscription tiers: free | whitelist | standard | vip | silver | gold | diamond
// - Reward levels: none | silver | gold | diamond (earned by activity score)
// - Profile boost tiers: silver | gold | diamond
// - Security level 1–5 controls withdrawal limits
// - Stream tier controls minutes/month, can_record, max_quality

const HELP_TOPICS = [
  {
    id:          "tokens",
    icon:        "💰",
    title:       "Xeevia Tokens & Wallet",
    description: "How to earn, spend, and manage your EP & XEV",
    color:       "#f59e0b",
    articles: [
      {
        id:       "tokens-1",
        title:    "Understanding the Dual Token System (EP + XEV)",
        readTime: "5 min",
        content: `## The Two Currencies That Power Xeevia

Xeevia runs on a carefully designed two-token economy where every interaction has real value — and that value flows to creators, not the platform.

### Engagement Points (EP)
EP is your **social fuel**. It is spent when you interact with content, and it flows to you when others interact with yours.

**The critical distinction — what costs EP:**
| Action | EP Cost |
|--------|---------|
| Like a post or reel | 2 EP (you pay) |
| Comment on content | 4 EP (you pay) |
| Unlock a story | Story price (you pay) |
| Publish a post/reel/story | **Free** |

**Publishing is always free.** EP is only spent on interactions.

**How EP is created:**
- **$1 = 100 EP** — fixed, transparent, backed 1:1 by the liquidity pool
- EP is minted when a user deposits real money
- EP is burned (destroyed) when spent on interactions
- No inflation by design

---

### XEV Token ($XEV)
XEV is your **ownership stake** in the Xeevia network.

**Key facts:**
- Fixed total supply: **1,000,000,000,000 (1 Trillion) XEV** — never more, ever
- 40% of your monthly EP earnings auto-convert to XEV at month end
- XEV can be staked to earn a share of platform revenue
- XEV gives you governance voting rights
- XEV can be withdrawn as real cash

---

### Your Wallet Dashboard
- **EP Balance** — your spending power for interactions
- **XEV Holdings** — your ownership position
- **Monthly Earnings** — your creator income breakdown
- **Conversion History** — your EP → XEV auto-conversions

Tap the **Wallet** tab in navigation to access yours.`,
      },
      {
        id:       "tokens-2",
        title:    "How to Deposit Funds & Get EP",
        readTime: "3 min",
        content: `## Funding Your Xeevia Account

### Payment Methods
Xeevia accepts:
- **Credit/Debit Cards** (Visa, Mastercard, American Express)
- **Paystack** (for Nigerian users — supports local bank transfer, USSD, and cards)
- **Cryptocurrency** (ETH, USDC, USDT via Web3 wallet)

### Minimum Deposit
The minimum deposit is **$1.00**, which gives you **100 EP**.

### How to Deposit
1. Open the **Wallet** tab
2. Tap **Add Funds** or **Deposit**
3. Choose your payment method
4. Enter the amount (minimum $1)
5. Complete the payment
6. EP appears in your wallet instantly (crypto: after blockchain confirmations)

### Security
All payments are processed through PCI-DSS compliant payment processors. Xeevia never stores your card details.

### Deposit Limits
| Account Type | Daily Limit |
|-------------|------------|
| Standard | $500/day |
| Verified | Higher limits available |
| VIP | Custom limits |

### What Happens to Your Money
Your deposit converts to EP at the fixed rate of $1 = 100 EP. A 2% protocol fee applies on EP transactions within the ecosystem.`,
      },
      {
        id:       "tokens-3",
        title:    "Withdrawing Your Earnings",
        readTime: "4 min",
        content: `## Getting Your Money Out

Every EP you earn as a creator is real money. Here's how to withdraw it.

### Withdrawal Eligibility
You can withdraw when you have at least **1,000 EP** in earned (not purchased) EP.

### Setting Up Your Withdrawal PIN
Before your first withdrawal, set a 6-digit PIN:
1. Go to **Wallet → Security Settings**
2. Tap **Set Withdrawal PIN**
3. Enter and confirm your 6-digit PIN
4. PIN is now required for every withdrawal

### Withdrawal Limits by Security Level
Your security level (1–5) determines your daily withdrawal cap:

| Security Level | Daily Limit |
|---------------|------------|
| Level 1 | $100 |
| Level 2 | $250 |
| Level 3 | $500 |
| Level 4 | $2,000 |
| Level 5 | $10,000 |

Raise your level by verifying your phone, enabling 2FA, binding trusted devices, and maintaining a clean security history.

### Withdrawal Methods
- **Bank Transfer** — 1–3 business days
- **Paystack (NGN)** — same day for Nigerian accounts
- **Crypto (USDC/USDT)** — 30 minutes to 2 hours

### Fees
Xeevia charges no withdrawal fees. Your bank may charge standard transfer fees.

### XEV Withdrawals
Convert XEV to EP at the current exchange rate first, then withdraw EP normally.`,
      },
      {
        id:       "tokens-4",
        title:    "Understanding Your Creator Earnings",
        readTime: "3 min",
        content: `## How Creator Earnings Work

When someone engages with your content, they spend EP — and you receive a share of it.

### Creator Revenue Share by Tier

| Tier | Creator Share |
|------|--------------|
| Free | 80% |
| Standard | 80%+ |
| VIP | Higher |
| Silver / Gold / Diamond Boost | Up to 84%+ |

The platform takes a 2% protocol fee on all transactions. The remainder goes to ecosystem rewards, treasury, and operations.

### Example
Someone pays **4 EP** to comment on your story (Free tier):
- You receive: ~**3.2 EP** (80%)
- Protocol fee: **0.08 EP** (2%)
- Remainder: ecosystem/treasury

### Monthly XEV Conversion
At end of each calendar month, **40% of your earned EP** automatically converts to XEV.

Example — 10,000 EP earned in a month:
- **6,000 EP** stays as EP (spendable or withdrawable)
- **4,000 EP** converts to XEV at current rate

### Tracking Your Earnings
Your earnings dashboard shows daily, weekly, monthly, and annual EP earned, plus top-performing content and your XEV accumulation over time.`,
      },
      {
        id:       "tokens-5",
        title:    "Staking XEV for Passive Income",
        readTime: "4 min",
        content: `## Earn Passive Income by Staking XEV

XEV staking lets you earn a share of platform revenue without doing anything extra.

### How Staking Works
Lock XEV into the platform's revenue-sharing pool. You receive a proportional share of the 20% of platform revenue allocated to stakers monthly.

**Your share = (Your staked XEV ÷ Total staked XEV) × 20% of monthly revenue**

Earnings are distributed as EP.

### Staking Terms
| Setting | Detail |
|---------|--------|
| Minimum stake | 100 XEV |
| Minimum lock | 30 days |
| Unstaking cooldown | 7 days |
| Supported durations | 30, 90, 180, 365 days |

Longer durations earn higher rates.

### Governance Rights
Staked XEV gives you voting power on platform decisions:
- Protocol upgrades
- Fee structure changes
- Ecosystem fund allocations

**1 staked XEV = 1 vote.**

### How to Stake
1. Open **Wallet → XEV Holdings**
2. Tap **Stake XEV**
3. Enter amount and choose duration
4. Confirm with your withdrawal PIN`,
      },
    ],
  },
  {
    id:          "publishing",
    icon:        "📖",
    title:       "Publishing Stories",
    description: "Tips for creating engaging content",
    color:       "#8b5cf6",
    articles: [
      {
        id:       "pub-1",
        title:    "Writing Stories That People Pay to Read",
        readTime: "6 min",
        content: `## The Art of the Paid Story

Publishing on Xeevia is free. But the stories worth reading are the ones worth unlocking.

### What Makes a Story Worth Paying For

**Exclusive depth.** Your preview (the free part) should create desire. Your full story should be so good that readers feel the EP was worth it.

**Categories that convert well:**
- Personal essays with real stakes and transformation
- How-to guides based on genuine expertise
- Fiction with strong hooks and satisfying arcs
- Investigative takes on industry topics
- Cultural commentary with sharp perspective

### Pricing Your Stories

| Content Type | Suggested Range |
|-------------|----------------|
| Short reads (under 500 words) | 10–30 EP |
| Medium essays (500–1500 words) | 30–80 EP |
| Long-form (1500+ words) | 80–200 EP |
| Premium guides & tutorials | 100–500 EP |

Don't underprice. Readers use price as a quality signal.

### The Preview Is Everything
Your preview (max 500 characters) is your sales pitch. It should:
- Open with a hook that creates tension or curiosity
- Hint at the transformation or revelation inside
- Not give away the ending`,
      },
      {
        id:       "pub-2",
        title:    "Story Categories & Finding Your Niche",
        readTime: "4 min",
        content: `## Finding Your Story Category

Your category determines who discovers your work.

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
The platform rewards specificity. "Tech" is broad. "Building SaaS products with no funding in Africa" is a niche. Niches build loyal readers who consistently pay to read your work.

### Trending vs. Evergreen
**Trending content** performs well immediately but fades. **Evergreen content** continues to earn EP months after publishing.

Aim for 70% evergreen, 30% trending.`,
      },
      {
        id:       "pub-3",
        title:    "Understanding the Story Preview System",
        readTime: "3 min",
        content: `## Mastering Your Story Preview

The preview is the most important element of your story on Xeevia.

### Preview Structure (Max 500 Characters)

**Formula that works:**
> [Hook sentence that creates tension] + [1–2 sentences that deepen it] + [Implication of what they'll get]

**Example — Bad preview:**
> "This is my story about how I lost everything and built it back up. Read on."

**Example — Good preview:**
> "I had $7 in my account the morning my company got featured in TechCrunch. Here's what nobody tells you about what happens the day your life is supposed to change — and why it almost destroyed me instead."

### The Unlock Rate Metric
Unlock rate = (unlocks / views) × 100

| Rate | Meaning |
|------|---------|
| Under 1% | Preview needs rework |
| 1–3% | Baseline performance |
| 3–8% | Good |
| 8–15% | Excellent |
| 15%+ | Exceptional |`,
      },
      {
        id:       "pub-4",
        title:    "Content Policies & What's Allowed",
        readTime: "4 min",
        content: `## Xeevia Content Guidelines

Xeevia is a platform for human expression with minimal restrictions — but some things are non-negotiable.

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
Reports are reviewed within 24 hours. Valid violations result in:
1. **Warning** (first offense, minor)
2. **Content removal** (first offense, serious)
3. **Account suspension** (second offense)
4. **Permanent ban** (severe violations or repeated offenses)

You can appeal any moderation decision through the support ticket system.`,
      },
      {
        id:       "pub-5",
        title:    "Drafts — Save & Come Back Later",
        readTime: "2 min",
        content: `## Never Lose Your Work With Drafts

Xeevia automatically saves your work as you write.

### Auto-Save
Every 30 seconds, your work is automatically saved. Even if your browser closes or your connection drops, your content is safe.

### Draft Management
Access drafts from: **Create → My Drafts**

Each draft shows:
- Content type (Post, Story, or Reel)
- Title (for stories)
- Last edited timestamp
- Content preview

### Draft Limits
You can have up to **50 drafts** at once. Delete old ones when you reach the limit.

### Draft Security
Drafts are private by default — only you can see them.`,
      },
    ],
  },
  {
    id:          "reels",
    icon:        "🎬",
    title:       "Reels & Videos",
    description: "Best practices for video content",
    color:       "#ef4444",
    articles: [
      {
        id:       "reel-1",
        title:    "Creating Reels That Earn",
        readTime: "5 min",
        content: `## Making Reels That Generate Real Income

Reels on Xeevia work differently. Publishing is free — but viewer engagement (likes and comments) costs them EP, which flows directly to you.

### First 3 Seconds Rule
Viewers are selective because their attention has real cost. Your reel must hook in under 3 seconds.

**Hook strategies:**
- **The contrarian open:** Challenge a common belief immediately
- **The visual hook:** Open with your most striking moment
- **The stakes hook:** "I almost lost everything because of this..."
- **The utility hook:** "In 60 seconds, you'll know how to..."

### Optimal Reel Length
| Length | Best For |
|--------|----------|
| 15–30 seconds | Impressions, shares, discovery |
| 30–60 seconds | Education, entertainment (sweet spot) |
| 60–90 seconds | Narrative, deep dives, tutorials |
| 90+ seconds | Only for truly compelling content |

### Audio Strategy
Reels with music or clear voiceover outperform silent reels by 3–4x.

### Thumbnail Selection
Choose a frame that is:
- Visually clear (no blurry frames)
- Emotionally expressive if a face is shown
- Representative of the best moment in the reel`,
      },
      {
        id:       "reel-2",
        title:    "Technical Specs for Reel Uploads",
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

Publishing is free.

### Processing Time
| File Size | Processing Time |
|-----------|----------------|
| Under 100MB | 1–3 minutes |
| 100–300MB | 3–8 minutes |
| 300MB+ | 8–20 minutes |

### Common Upload Errors
- **File too large:** Compress with HandBrake or Adobe Premiere
- **Unsupported format:** Convert to MP4 using VLC or CloudConvert
- **Upload failed:** Check your connection; your progress is saved`,
      },
      {
        id:       "reel-3",
        title:    "Reel Categories & Discovery",
        readTime: "3 min",
        content: `## Getting Your Reels Discovered

Category selection is your primary lever for discovery.

### How the Explore Feed Works
Xeevia's explore algorithm surfaces content based on:
1. Category relevance to the viewer's history
2. Engagement velocity (likes + comments in first hour)
3. Creator credibility score
4. Content freshness

The best strategy: post consistently, engage actively in the first hour after publishing.

### Engagement Momentum
Comment on at least 5–10 other reels in your category before and after posting. This signals activity to the algorithm and often leads those creators to discover your work in return.

### Categories for Reels
Entertainment, Education, Lifestyle, Business, Technology, Sports & Fitness, Comedy, Art & Music, Food & Cooking, Travel`,
      },
    ],
  },
  {
    id:          "streaming",
    icon:        "📡",
    title:       "Live Streaming",
    description: "Go live, grow your audience, earn EP",
    color:       "#ef4444",
    articles: [
      {
        id:       "stream-1",
        title:    "How Live Streaming Works on Xeevia",
        readTime: "4 min",
        content: `## Going Live on Xeevia

Live streaming is a powerful way to grow your audience and earn EP in real time.

### Stream Modes
You can go live in two modes:
- **Video** — full camera broadcast
- **Audio** — audio-only, like a podcast or radio show

### Public vs. Private Streams
- **Public streams** are visible to everyone and appear in the Live Now section of the trending panel
- **Private streams** are invite-only — they don't appear publicly

### Stream Tier Limits
Your account's stream tier controls three things:

| Setting | What it controls |
|---------|-----------------|
| Minutes per month | How long you can stream total each month |
| Can record | Whether your session can be saved for replay |
| Max quality | The resolution/quality ceiling of your stream |

Higher subscription tiers grant more streaming time, recording capability, and higher quality caps.

### What Viewers See
When you're live, your session appears in the Live Now circles strip on the home feed and in the Trending sidebar. Viewers see your peak viewer count, duration, and category.

### Earning from Streams
Viewers can like your stream in real time. Each like costs them 2 EP. You receive your creator share (80–84% depending on your tier) of every interaction during your stream.`,
      },
      {
        id:       "stream-2",
        title:    "Stream Recordings & Replays",
        readTime: "3 min",
        content: `## Recording Your Live Sessions

Whether your session gets recorded depends on your stream tier.

### How Recording Works
If your tier includes recording:
- Your stream is saved automatically when you end it
- Viewers can replay it from your profile
- The recording appears as an audio or video player depending on your stream mode

### If Recording Is Not Available
When a session was not recorded (either because your tier doesn't include it, or you opted out), viewers who visit your past session will see a **"Session not recorded"** card.

This card still shows:
- Peak viewers from your live session
- Total likes received during the stream
- Duration of the stream
- Your stream category

Your stats are always preserved — even without a recording.

### Upgrading for Recording
To unlock recording capability, upgrade your stream tier through your account settings. Recording is available on mid-tier and higher plans.

### Session History
All your past sessions — recorded or not — appear in your public streamer profile under Stream History. Each session shows its date, title, category, mode, and live stats.`,
      },
      {
        id:       "stream-3",
        title:    "Tips for a Successful Live Stream",
        readTime: "3 min",
        content: `## Making Your Streams Count

### Before You Go Live
- **Set a strong title** — 1–120 characters, makes you discoverable
- **Choose the right category** — this determines who sees you in discovery
- **Test your audio/camera** first on a private stream
- **Announce in advance** — post a teaser before you go live so followers know to tune in

### During the Stream
- Acknowledge new viewers by name when possible
- Keep the energy consistent — dead air kills engagement
- React visibly to likes — viewers can see you reacting, which encourages more
- Keep streams focused — a clear topic outperforms a vague session every time

### After the Stream
Your session stats lock in once you end — peak viewers, total likes, and duration. These contribute permanently to your Top Streamer ranking on the platform.

If your tier includes recording, your replay will be available within minutes of ending the stream.

### Audio vs. Video
Audio streams work extremely well for:
- Interviews and conversations
- Storytelling and narration
- Music and ambient content

They require less bandwidth and are easier to produce consistently.`,
      },
    ],
  },
  {
    id:          "security",
    icon:        "🔒",
    title:       "Account & Security",
    description: "Protect your account and data",
    color:       "#10b981",
    articles: [
      {
        id:       "sec-1",
        title:    "Securing Your Xeevia Account",
        readTime: "5 min",
        content: `## Complete Account Security Guide

Your Xeevia account holds real money and real content. Protecting it requires multiple layers.

### Security Level System (1–5)
Your security level controls your withdrawal limits and platform trust. It increases as you complete these steps:

| Step | Raises Level |
|------|-------------|
| Verify phone number | Yes |
| Enable 2FA | Yes |
| Set withdrawal PIN | Yes |
| Bind trusted devices | Yes |
| Clean security history | Maintained |

Higher security levels unlock higher daily withdrawal limits — up to $10,000/day at Level 5.

### Your Withdrawal PIN
A separate 6-digit code required for all financial transactions. Even if someone accesses your account, they cannot withdraw your funds without this PIN.

**Rules:**
- Don't use sequential numbers (123456)
- Don't use your birth year
- Don't share with anyone — Xeevia support will **never** ask for your PIN

### Trusted Devices
Xeevia tracks your login devices. You can view and manage trusted devices in: **Account → Security → Trusted Devices**

Remove any device you don't recognize immediately.

### Suspicious Activity
Signs your account may be compromised:
- Login notifications from locations you don't recognize
- Content posted that you didn't create
- Wallet transactions you didn't authorize

**Immediate action:** Go to **Account → Security → Active Sessions → End All Sessions**. Then change your connected provider's password.`,
      },
      {
        id:       "sec-2",
        title:    "Privacy Controls & Data Management",
        readTime: "4 min",
        content: `## Controlling Your Privacy on Xeevia

### Profile Privacy Settings
**Public Profile (Default):** Your profile, posts, and reels are visible to everyone.
**Private Profile:** Only approved followers can see your content.

To switch: **Account → Privacy → Profile Visibility**

### Account Status
Your account can be in one of three states:
- **Active** — normal access, full platform features
- **Deactivated** — you temporarily disabled your account; you can reactivate at any time
- **Suspended** — the platform restricted your account due to a policy violation; you'll see the reason and can appeal through support

### What Xeevia Collects
- Account information: email, name, username
- Content you create
- Engagement activity (likes, comments, unlocks you perform)
- Device information for security (browser, device, IP)
- Financial: transaction history only (never card numbers)

### What Xeevia Does NOT Collect
- Your contact lists
- Location (unless you share it in content)
- Microphone or camera when not actively streaming
- Browsing history outside of Xeevia

### Data Export & Deletion
Request your data: **Account → Privacy → Export My Data**

On deletion: content removed within 30 days, financial records retained 7 years (legal requirement), username available after 90 days.`,
      },
      {
        id:       "sec-3",
        title:    "Recognizing & Reporting Scams",
        readTime: "4 min",
        content: `## Protecting Yourself From Scams on Xeevia

### Common Scam Types

**The "Boost Your Views" Scam**
Fake services promise to buy EP engagement cheaply. These steal your money, your credentials, or deliver fake engagement that gets your account penalized.

**The "Investment" Scam**
Someone offers to multiply your XEV through an "exclusive staking pool" outside the platform. XEV can only be staked through the official Xeevia wallet.

**The "Verification" Scam**
A message claiming to be from Xeevia support asking for your withdrawal PIN or password. Xeevia will **never** ask for these. Ever.

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
    id:          "payments",
    icon:        "💳",
    title:       "Payments & Withdrawals",
    description: "How to cash out your earnings",
    color:       "#3b82f6",
    articles: [
      {
        id:       "pay-1",
        title:    "Complete Payments Guide",
        readTime: "5 min",
        content: `## Everything About Payments on Xeevia

### Supported Payment Methods

**For Deposits:**
| Method | Regions | Processing Time |
|--------|---------|----------------|
| Credit/Debit Card | Global | Instant |
| Paystack | Nigeria, Ghana, Kenya | Instant |
| Bank Transfer | Select regions | 1–3 days |
| USDC/USDT | Global | 15–30 min |
| ETH | Global | 15–30 min |

**For Withdrawals:**
| Method | Regions | Processing Time |
|--------|---------|----------------|
| Bank Transfer | Global | 1–3 business days |
| Paystack (NGN) | Nigeria | Same day |
| USDC | Global | ~30 min |

### Fees
- **Deposits:** No Xeevia fee. Your payment provider may charge fees.
- **Withdrawals:** No Xeevia fee. Bank fees vary by institution.
- **Protocol fee:** 2% on all EP ecosystem transactions

### Transaction History
Every transaction is logged: **Wallet → Transaction History**

Filter by date, type, and amount. Export as CSV.`,
      },
      {
        id:       "pay-2",
        title:    "Transaction Disputes & Refunds",
        readTime: "4 min",
        content: `## Handling Transaction Issues

### Unauthorized Transaction
If you see a transaction you didn't make:
1. Check if someone else has access to your account
2. End all active sessions: **Account → Security → End All Sessions**
3. Submit a support ticket immediately with the transaction ID
4. We investigate within 24 hours

### Failed Deposit (Payment Processed but No EP)
1. Wait 15 minutes (crypto can be slow)
2. Check your bank/card statement to confirm payment completed
3. If EP doesn't appear after 1 hour, submit a support ticket with your transaction reference
4. We typically resolve within 2 hours

### Refund Policy
| Situation | Refund |
|-----------|--------|
| EP purchased but not yet used | Full refund within 24 hours |
| EP spent on interactions | Non-refundable |
| Story unlocks | Non-refundable |
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
    if (tableBuffer.length < 2) { tableBuffer = []; inTable = false; return; }
    const headers = tableBuffer[0].split("|").map((h) => h.trim()).filter(Boolean);
    const rows    = tableBuffer.slice(2).map((r) => r.split("|").map((c) => c.trim()).filter(Boolean));
    elements.push(
      <div key={`tbl-${i}`} style={{ overflowX: "auto", margin: "16px 0" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr>
            {headers.map((h, hi) => (
              <th key={hi} style={{ padding: "9px 13px", background: "rgba(132,204,22,0.07)", borderBottom: "2px solid rgba(132,204,22,0.22)", textAlign: "left", color: "#a3e635", fontWeight: 700, fontSize: 11, letterSpacing: ".3px" }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{ padding: "9px 13px", borderBottom: "1px solid rgba(255,255,255,0.04)", color: "#9ca3af", fontSize: 13 }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableBuffer = []; inTable = false;
  };

  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("|")) { inTable = true; tableBuffer.push(line); continue; }
    if (inTable) flushTable();
    if (line.startsWith("## ")) {
      elements.push(<h2 key={i} style={{ fontSize: 17, fontWeight: 800, color: "#fff", margin: "26px 0 9px", letterSpacing: "-.2px", lineHeight: 1.3 }}>{line.slice(3)}</h2>);
    } else if (line.startsWith("### ")) {
      elements.push(<h3 key={i} style={{ fontSize: 14, fontWeight: 700, color: "#e5e7eb", margin: "18px 0 7px" }}>{line.slice(4)}</h3>);
    } else if (line.startsWith("- ")) {
      elements.push(
        <div key={i} style={{ display: "flex", gap: 9, margin: "6px 0", color: "#9ca3af", fontSize: 13, lineHeight: 1.7 }}>
          <span style={{ color: "#a3e635", marginTop: 3, flexShrink: 0 }}>▸</span>
          <span dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong style="color:#e5e7eb">$1</strong>') }} />
        </div>
      );
    } else if (/^\d+\. /.test(line)) {
      const num = line.match(/^(\d+)\. /)[1];
      elements.push(
        <div key={i} style={{ display: "flex", gap: 10, margin: "6px 0", color: "#9ca3af", fontSize: 13, lineHeight: 1.7 }}>
          <span style={{ color: "#a3e635", fontWeight: 800, flexShrink: 0, minWidth: 18 }}>{num}.</span>
          <span dangerouslySetInnerHTML={{ __html: line.replace(/^\d+\. /, "").replace(/\*\*(.*?)\*\*/g, '<strong style="color:#e5e7eb">$1</strong>') }} />
        </div>
      );
    } else if (line.startsWith("> ")) {
      elements.push(
        <blockquote key={i} style={{ borderLeft: "3px solid #a3e635", paddingLeft: 14, margin: "14px 0", color: "#9ca3af", fontSize: 13, fontStyle: "italic", lineHeight: 1.85, background: "rgba(132,204,22,0.03)", padding: "8px 14px", borderRadius: "0 8px 8px 0" }}>{line.slice(2)}</blockquote>
      );
    } else if (line.startsWith("---")) {
      elements.push(<hr key={i} style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.06)", margin: "22px 0" }} />);
    } else if (line.startsWith("**") && line.endsWith("**") && !line.slice(2).includes("**")) {
      elements.push(<p key={i} style={{ fontWeight: 700, color: "#fff", margin: "12px 0 5px", fontSize: 13 }}>{line.slice(2, -2)}</p>);
    } else if (line.trim()) {
      elements.push(
        <p key={i} style={{ color: "#9ca3af", lineHeight: 1.9, margin: "8px 0", fontSize: 13 }}
          dangerouslySetInnerHTML={{ __html: line
            .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#e5e7eb">$1</strong>')
            .replace(/`(.*?)`/g, '<code style="background:rgba(132,204,22,0.1);color:#a3e635;padding:2px 7px;border-radius:5px;font-size:12px;font-family:monospace">$1</code>') }} />
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
      <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: `${topic.color}05` }}>
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "#525252", fontSize: 12, padding: 0, marginBottom: 10, transition: "color .18s" }}
          onMouseEnter={(e) => e.currentTarget.style.color = topic.color}
          onMouseLeave={(e) => e.currentTarget.style.color = "#525252"}>
          <ArrowLeft size={13} /> Back to {topic.title}
        </button>
        <div style={{ display: "flex", gap: 7, alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 15 }}>{topic.icon}</span>
          <span style={{ fontSize: 11, color: topic.color, fontWeight: 700 }}>{topic.title}</span>
        </div>
        <h1 style={{ fontSize: 17, fontWeight: 800, color: "#fff", lineHeight: 1.38, margin: 0, letterSpacing: "-.2px" }}>{article.title}</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
          <Clock size={12} style={{ color: "#484848" }} />
          <span style={{ fontSize: 11, color: "#484848" }}>{article.readTime} read</span>
        </div>
      </div>
      <div style={{ padding: "16px 18px 14px" }}>{renderMarkdown(article.content)}</div>
      <div style={{ margin: "4px 18px 24px", padding: "16px", background: "rgba(132,204,22,0.04)", border: "1px solid rgba(132,204,22,0.14)", borderRadius: 16 }}>
        <div style={{ fontSize: 24, marginBottom: 10 }}>🙋</div>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", marginBottom: 5 }}>Still need help?</div>
        <div style={{ fontSize: 12, color: "#484848", marginBottom: 16 }}>Our support team is ready to assist you directly.</div>
        <button onClick={onContact} style={{ padding: "10px 22px", background: "linear-gradient(135deg, #84cc16, #65a30d)", border: "none", borderRadius: 11, color: "#000", fontSize: 13, fontWeight: 800, cursor: "pointer", boxShadow: "0 3px 14px rgba(132,204,22,.25)" }}>
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
      <div style={{ padding: "16px 18px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: `linear-gradient(135deg, ${topic.color}07, transparent)`, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${topic.color}50, transparent)` }} />
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "#525252", fontSize: 12, padding: 0, marginBottom: 14 }}>
          <ArrowLeft size={13} /> All Topics
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 15, flexShrink: 0, background: `${topic.color}14`, border: `1px solid ${topic.color}28`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, boxShadow: `0 4px 16px ${topic.color}18` }}>
            {topic.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", marginBottom: 4 }}>{topic.title}</div>
            <div style={{ fontSize: 12, color: "#484848", display: "flex", alignItems: "center", gap: 4 }}>
              <Book size={10} style={{ color: topic.color }} />
              {topic.articles.length} articles in this section
            </div>
          </div>
        </div>
      </div>
      <div style={{ padding: "12px 16px 20px", display: "flex", flexDirection: "column", gap: 7 }}>
        {topic.articles.map((article) => (
          <button key={article.id} onClick={() => onSelectArticle(article)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, cursor: "pointer", textAlign: "left", width: "100%", transition: "all .2s" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${topic.color}40`; e.currentTarget.style.background = `${topic.color}07`; e.currentTarget.style.transform = "translateX(3px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.transform = "none"; }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, background: `${topic.color}14`, border: `1px solid ${topic.color}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Book size={15} style={{ color: topic.color }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#e5e5e5", marginBottom: 4, lineHeight: 1.4 }}>{article.title}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Clock size={11} style={{ color: "#484848" }} />
                <span style={{ fontSize: 11, color: "#484848" }}>{article.readTime} read</span>
              </div>
            </div>
            <ChevronRight size={15} style={{ color: "#363636", flexShrink: 0 }} />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN HELP TAB ────────────────────────────────────────────────────────────

export default function HelpTab({ onNavigateToContact, onViewChange }) {
  const [view,          setView]          = useState("topics");
  const [activeTopic,   setActiveTopic]   = useState(null);
  const [activeArticle, setActiveArticle] = useState(null);
  const [searchQuery,   setSearchQuery]   = useState("");

  const setViewTracked = (v) => { setView(v); onViewChange?.(v); };

  const filteredTopics = HELP_TOPICS.filter((t) =>
    searchQuery
      ? t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.articles.some((a) => a.title.toLowerCase().includes(searchQuery.toLowerCase()))
      : true,
  );

  const searchResults = searchQuery
    ? HELP_TOPICS.flatMap((t) =>
        t.articles
          .filter((a) => a.title.toLowerCase().includes(searchQuery.toLowerCase()))
          .map((a) => ({ ...a, topic: t })),
      )
    : [];

  if (view === "article" && activeArticle && activeTopic) {
    return <ArticleView article={activeArticle} topic={activeTopic} onBack={() => setViewTracked("topic")} onContact={onNavigateToContact} />;
  }
  if (view === "topic" && activeTopic) {
    return (
      <TopicView
        topic={activeTopic}
        onSelectArticle={(a) => { setActiveArticle(a); setViewTracked("article"); }}
        onBack={() => { setActiveTopic(null); setViewTracked("topics"); }}
      />
    );
  }

  return (
    <div>
      {/* Hero */}
      <div style={{ padding: "16px 18px 16px", background: "linear-gradient(135deg, rgba(132,204,22,0.07) 0%, transparent 60%)", borderBottom: "1px solid rgba(132,204,22,0.1)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(132,204,22,.4), transparent)" }} />
        <div style={{ position: "absolute", top: -40, right: -40, width: 120, height: 120, borderRadius: "50%", background: "rgba(132,204,22,.04)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
          <div style={{ width: 54, height: 54, borderRadius: 17, flexShrink: 0, background: "rgba(132,204,22,0.1)", border: "1px solid rgba(132,204,22,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, boxShadow: "0 4px 18px rgba(132,204,22,.14)" }}>🌿</div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 4, letterSpacing: "-.3px" }}>How can we help?</div>
            <div style={{ fontSize: 12, color: "#484848", display: "flex", alignItems: "center", gap: 5 }}>
              <Sparkles size={10} color="#84cc16" /> Find answers in our knowledge base
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 13, transition: "border-color .18s" }}
          onFocusCapture={(e) => e.currentTarget.style.borderColor = "rgba(132,204,22,.35)"}
          onBlurCapture={(e)  => e.currentTarget.style.borderColor = "rgba(255,255,255,.09)"}>
          <Search size={15} style={{ color: "#525252", flexShrink: 0 }} />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search help articles..."
            style={{ flex: 1, background: "none", border: "none", color: "#fff", fontSize: 13, outline: "none" }} />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#525252", padding: 0, fontSize: 18, lineHeight: 1 }}>×</button>
          )}
        </div>
      </div>

      {/* Search results */}
      {searchQuery && (
        <div style={{ padding: "12px 16px" }}>
          {searchResults.length === 0 ? (
            <div style={{ textAlign: "center", padding: "36px 0", color: "#484848", fontSize: 13 }}>No articles found for "{searchQuery}"</div>
          ) : (
            <>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#484848", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
                {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {searchResults.map((result) => (
                  <button key={result.id} onClick={() => { setActiveTopic(result.topic); setActiveArticle(result); setViewTracked("article"); }}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 13, cursor: "pointer", textAlign: "left", width: "100%", transition: "all .18s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(132,204,22,0.3)"; e.currentTarget.style.background = "rgba(132,204,22,0.04)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{result.topic.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#e5e5e5", marginBottom: 2 }}>{result.title}</div>
                      <div style={{ fontSize: 11, color: "#484848" }}>{result.topic.title} · {result.readTime} read</div>
                    </div>
                    <ChevronRight size={14} style={{ color: "#363636", flexShrink: 0 }} />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Topic grid */}
      {!searchQuery && (
        <div style={{ padding: "12px 16px 20px" }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#484848", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>Browse Topics</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filteredTopics.map((topic) => (
              <button key={topic.id} onClick={() => { setActiveTopic(topic); setViewTracked("topic"); }}
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 15, cursor: "pointer", textAlign: "left", transition: "all .22s", width: "100%" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = `${topic.color}08`; e.currentTarget.style.borderColor = `${topic.color}35`; e.currentTarget.style.transform = "translateX(4px)"; e.currentTarget.style.boxShadow = `0 4px 18px ${topic.color}12`; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.transform = "translateX(0)"; e.currentTarget.style.boxShadow = "none"; }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0, background: `${topic.color}14`, border: `1px solid ${topic.color}26`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 23 }}>
                  {topic.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#e5e5e5", marginBottom: 4 }}>{topic.title}</div>
                  <div style={{ fontSize: 12, color: "#484848" }}>{topic.description}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: topic.color, background: `${topic.color}14`, padding: "3px 10px", borderRadius: 20, fontWeight: 700, border: `1px solid ${topic.color}20` }}>
                    {topic.articles.length}
                  </span>
                  <ChevronRight size={15} style={{ color: "#363636" }} />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}