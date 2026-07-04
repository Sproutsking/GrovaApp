XEEVIA — Help & FAQ (internal summary)

Purpose
- Consolidated help and FAQ copy aligned to the public website (Singular Source of Truth). Use this file as the canonical internal reference for Support, Docs, and UI help components.

Key sections (mirror site)
- Getting Started: account creation, $1 activation (100 EP), username rules, availability.
- Tokens & Earning: EP vs XEV, earning mechanics, monthly conversion (40% auto-convert), earned vs purchased EP rules.
- Subscription Tiers: Free / Silver / Gold / Diamond and differences (creator share, EP bonuses, themes, limits).
- Content Creation: Posts, Reels, Stories (pricing, previews, categories, editing rules).
- Payments & Finance: deposits, withdrawals, limits, fees, gift cards.
- Account & Security: statuses, security levels (1–5), 2FA, PINs, data export & deletion.
- Communities: treasuries, roles, monetization, governance, discovery.
- Live Streaming: modes, recording, stream monetization and limits.
- Participation Economy: why EP costs, conversation-value payouts, no reward-for-presence.
- XRC Protocol & Oracle: XRC chains (XTRC, XERC, XARC, XCRC, XPRC, XSRC) and Oracle proofs.
- Oracle & Verification: query surface, authorized access, deterministic signed proofs.
- Portable Trust: identity graph, machine-readable evidence, AI-readable proofs.
- Developers & API: API endpoints, Oracle proof endpoint, SDK pointers, webhooks.

Support expectations
- Search first: the in-app Help and FAQ are primary UX entry points.
- Response SLAs: support tickets answered in 2–4 hours on weekdays; disputes & payment issues within 24–48 hours as documented.

Content notes for engineers
- Keep help articles in `src/components/Shared/Support-tabs/HelpTab.jsx` as markdown strings; `renderMarkdown()` handles simple tables, lists, headings.
- Add FAQ entries to `FAQTab.jsx` (structured objects). Keep language precise and declarative — avoid marketing.
- For any new public-facing copy, update this doc and the FAQ/Help components together.

Design/UX pointers
- Use short, scannable headings and clear examples where money or security is involved.
- For protocol/oracle content, include short definitions and one example use-case (bank KYC, AI verification).
- For Participation Economy articles, call out non-negotiables: publishing free; EP spent by engager; earned EP eligible for XEV conversion.

Maintenance
- Update this doc when the website hero sections (Truth, XRC, Oracle, Participation Economy, Ecosystem) change.
- Keep the HelpTab article IDs stable for analytics and bookmarks.

Contact
- Support owner: support@xeevia.com
- Docs owner: docs@xeevia.com
