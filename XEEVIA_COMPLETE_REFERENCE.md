# XEEVIA: COMPLETE ARCHITECTURE REFERENCE

**Purpose:** Single source of truth for Xeevia's complete state, transformation path, and scaling guide  
**Status:** Current production state → Definitive target state  
**Audience:** Any developer (human or AI) continuing this work from any point  

---

## PART 1: WHAT XEEVIA IS (Current Reality)

### Executive Foundation
Xeevia is a **trust infrastructure platform** masked as a social app. The current implementation is a **monolithic single-instance** architecture trying to do 10 things across one database, one auth system, one media store, and one payment processor.

### Current Infrastructure Stack

```
FRONTEND LAYER
├─ React 18.3.1 SPA (PWA)
├─ Lucide icons, OTP libraries
└─ Service Workers for offline + push

AUTH LAYER
├─ Supabase Auth (SINGLE INSTANCE)
│  ├─ OAuth Providers: Google, X, Facebook, TikTok, Discord
│  ├─ Email auth: configured but minimal
│  ├─ Phone auth: configured but unused
│  └─ 2FA: TOTP only (in two_factor_auth table)
├─ Session Management: user_sessions table (active, devices, timestamps)
└─ Security Events: Logged but not actionable

DATABASE LAYER
├─ PostgreSQL (SINGLE SUPABASE INSTANCE)
├─ 138 tables across 10 logical domains (mixed in one schema)
├─ RLS policies: Complex, 847+ rules
├─ Row-level security: User-owned data partially isolated
└─ Backup: Daily snapshots (retention: 7 days)

MEDIA LAYER
├─ Cloudinary (SINGLE ACCOUNT: xeevia-production)
├─ All content types: avatars, posts, videos, stories, reels
├─ Transformations: Limited (basic resize)
├─ CDN: Standard tier
└─ Rate limiting: 100 req/sec (shared across all content types)

PAYMENT LAYER
├─ Stripe: Subscriptions + one-time payments
├─ Paystack: NGN deposits/withdrawals (Nigeria-focused)
├─ Flutterwave: Alternative processor
├─ Web3: XRC settlement (custom edge functions)
└─ Internal: EP (engagement points) economy

NOTIFICATION LAYER
├─ OneSignal: Push notifications (configured)
├─ EmailJS: Transactional email (configured)
├─ Twilio: SMS (configured)
└─ Service Workers: Background sync, offline notifications

EDGE FUNCTIONS LAYER
├─ 35+ Supabase Edge Functions deployed
├─ Functions: OAuth, webhooks, settlement, push, deposits, withdrawals
└─ Invocation: Triggered by database changes or API calls

EVIDENCE LAYER (XRC)
├─ xrc_records table: Immutable chain of events
├─ xrc_root_chain table: Stream heads (XTRC, XERC, XARC, XCRC, XPRC, XSRC, XWRC)
├─ Purpose: Audit trail, not verification (UI not exposed)
└─ Status: Functional but unused
```

---

## PART 2: DATABASE SCHEMA BLUEPRINT (138 Tables Categorized)

### DOMAIN 1: IDENTITY & AUTHENTICATION (31 tables)
**Purpose:** User identity, session management, security, and trust signals  
**Criticality:** HIGHEST (every API call validates against this)  
**Current Issues:** Mixed with other concerns, hard to audit

| Table | Current Use | Dependencies | Status |
|-------|------------|--------------|--------|
| auth.users | Supabase auth IDs | Keycloak-like | ✓ Working |
| profiles | User identity | FK: auth.users | ✓ Working, missing: xeevia_as_oauth_provider |
| oauth_clients | NOT CREATED YET | N/A | ✗ Needed for Xeevia-as-OAuth |
| oauth_codes | NOT CREATED YET | N/A | ✗ Needed for Xeevia-as-OAuth |
| oauth_tokens | NOT CREATED YET | N/A | ✗ Needed for Xeevia-as-OAuth |
| oauth_consent | NOT CREATED YET | N/A | ✗ Needed for Xeevia-as-OAuth |
| two_factor_auth | 2FA secrets | FK: profiles | ✓ TOTP only, SMS/email not wired |
| device_fingerprints | Device tracking | FK: profiles | ✓ Stored, not enforced |
| trusted_devices | Device trust whitelist | FK: profiles, device_fingerprints | ✓ Stored, not used in login flow |
| webauthn_credentials | NOT CREATED YET | N/A | ✗ Needed for biometric 2FA |
| verification_codes | OTP codes (hashed) | Generic email field | ⚠️ Works, but code_type generic |
| user_sessions | Session tracking | FK: profiles | ✓ Working, unused for device trust |
| security_events | Audit log | FK: profiles | ✓ Logged, not surfaced to users |
| rate_limits | Rate limiting | FK: profiles, ip_address | ✓ Tracked, not enforced |
| user_recovery_phrases | Wallet recovery | FK: profiles | ✓ Working |
| xrc_records | Immutable records | FK: profiles | ✓ Working, not exposed in UI |
| xrc_root_chain | Chain head tracking | FK: xrc_records | ✓ Working, not exposed in UI |
| admin_team | Admin users | FK: profiles, created_by | ✓ Working |
| audit_logs | Action audit trail | FK: profiles | ✓ Working, not accessible to users |
| blocked_ips | IP blocklist | FK: profiles (blocked_by) | ✓ Working |
| push_subscriptions | Push tokens | FK: profiles | ✓ Working |
| notification_preferences | Per-user notification settings | FK: profiles | ✓ Working |
| invite_codes | Invite system | FK: profiles (created_by) | ✓ Working |
| invite_code_usage | Invite tracking | FK: invite_codes, profiles (used_by) | ✓ Working |
| platform_settings | Global config | FK: profiles (updated_by) | ✓ Working |
| platform_freeze | Regional freeze state | FK: profiles (frozen_by) | ✓ Works |
| waitlist_entries | Waitlist tracking | FK: profiles, invite_codes | ✓ Works |
| notification_badge_state | Badge clear tracking | FK: profiles | ✓ Works |
| support_tickets | Support tracking | FK: profiles | ✓ Works |
| support_messages | Support messages | FK: support_tickets, profiles | ✓ Works |
| comment_reports | Report system | FK: comments, profiles (reporter_id) | ✓ Works |

**Action Required:**
- Create 4 missing OAuth tables
- Create webauthn_credentials table
- Wire SMS/email OTP to login flow
- Enforce device trust + time-lock in login

---

### DOMAIN 2: CONTENT & COMMUNITY (62 tables)
**Purpose:** Posts, reels, stories, comments, communities, messaging  
**Criticality:** HIGH (core app feature)  
**Current Issues:** Complex RLS policies, high volume, mixed with notifications

| Table | Current Use | Issue |
|-------|------------|-------|
| posts | Main feed content | ✓ Working |
| reels | Video content | ✓ Working, streaming not optimized |
| stories | Long-form content | ✓ Working, unlock cost enforced |
| comments | Nested comments | ✓ Working, threading UI basic |
| post_likes, reel_likes, story_likes, comment_likes | Like tracking (4 tables) | ✓ Working |
| communities | Community hubs | ✓ Created, governance UI missing |
| community_members | Member tracking | ✓ Working |
| community_roles | Role-based access | ✓ Defined, not enforced |
| community_channels | Channel organization | ✓ Created, not fully featured |
| community_messages | Community chat | ✓ Working |
| follows | Social graph | ✓ Working, recommendation engine not wired |
| conversations | 1-1 DM threads | ✓ Working |
| messages | DM content | ✓ Working, rich media limited |
| notifications | In-app notifications | ✓ Working, push not rich |
| message_reactions | Emoji reactions | ✓ Working |
| message_reads | Read receipts | ✓ Working |
| deleted_messages | Soft-delete tracking | ✓ Working |
| hidden_conversations | Archive 1-1 DMs | ✓ Working |
| drafts | Draft posts | ✓ Working, collaboration missing |
| shares | Share tracking | ✓ Working |
| saved_content | Bookmarks | ✓ Working |
| unlocked_stories | Unlock tracking | ✓ Working |
| sounds | Sound library | ✓ Minimal, trending not exposed |
| profile_views | Analytics tracking | ✓ Working, UI not exposed |
| live_sessions | Live streaming setup | ✓ Working, LiveKit/CF Stream configured, UI incomplete |
| stream_viewers | Live viewer tracking | ✓ Working |
| stream_usage_logs | Streaming analytics | ✓ Working, not exposed |
| stream_tier_limits | Streaming limits by tier | ✓ Defined, not enforced |
| news_posts | News feed | ✓ Working |
| news_bookmarks | News saves | ✓ Working |
| news_reactions | News engagement | ✓ Working |
| news_comments | News comments | ✓ Working |
| news_views | News tracking | ✓ Working |
| status_updates | Story-like status | ✓ Working |
| status_likes | Status engagement | ✓ Working |
| daily_task_completions | Gamification | ✓ Working, not surfaced |
| gift_cards | Gift card system | ✓ Working |
| call_logs | Call history | ✓ Tracked, UI basic |
| group_chats | Group DM setup | ✓ Working |
| active_calls | Call state tracking | ✓ Tracked, not real-time |
| news_fetch_log | News fetcher tracking | ✓ Working |
| ep_dashboard | EP metrics | ✓ Working, not exposed |
| scholarship_applications | Scholarship system | ✓ Working, UI not exposed |
| Plus 15 more community/content tables | Various | ✓ Mostly working |

**Action Required:**
- Move all to SUPABASE-CORE instance
- Simplify RLS policies (move user auth to separate instance)
- Enable real-time features (typing indicators, live viewers)
- Expose unused features (analytics, gamification, community governance)

---

### DOMAIN 3: PAYMENTS & WALLET (24 tables)
**Purpose:** Financial transactions, staking, cards, revenue tracking  
**Criticality:** CRITICAL (PCI-DSS compliance required)  
**Current Issues:** Mixed with regular data, audit trail weak, revenue distribution manual

| Table | Current Use | Issue |
|-------|------------|-------|
| wallets | User wallet balance | ✓ Working |
| transactions | Transfer history | ✓ Working |
| payments | Payment intents | ✓ Working |
| payment_intents | Payment setup | ✓ Working |
| payment_products | Subscription products | ✓ Working |
| subscriptions | Active subscriptions | ✓ Working |
| webhook_events | Payment webhooks | ✓ Working |
| ep_transactions | EP ledger | ✓ Working, no manual spending |
| ep_dashboard | EP metrics | ✓ Working |
| ep_treasury | EP reserve management | ✓ Defined, not automated |
| ep_treasury_config | EP distribution rules | ✓ Defined, manual updates |
| staking_positions | Locked EP | ✓ Working, UI not exposed |
| savings_plans | Savings goals | ✓ Working, UI not exposed |
| user_cards | Card management | ✓ Working, virtual cards not created |
| reward_pools | Weekly reward pools | ✓ Defined, distribution manual |
| reward_level_history | Reward tier tracking | ✓ Logged, not real-time |
| boost_ep_prices | Boost pricing | ✓ Defined, not dynamic |
| profile_boosts | Active boosts | ✓ Working, renewal not automated |
| wallet_history | Wallet ledger | ✓ Working |
| wallet_addresses | Blockchain addresses | ✓ Working |
| user_recovery_phrases | Seed recovery | ✓ Working |
| Plus 4 more finance tables | Various | ✓ Mostly working |

**Action Required:**
- Move to separate SUPABASE-WALLET instance (PCI-DSS compliance)
- Implement real-time auditing
- Automate reward distribution
- Enable staking/savings UI
- Implement card creation service

---

## PART 3: WHAT XEEVIA HAS (Actual Capabilities)

### Implemented But Unused (Treasure List)

#### 1. Real-Time Presence & Notifications
```sql
-- Tables exist:
- push_subscriptions (1-to-many per user)
- notifications (all types tracked)
- message_reactions (real-time updates possible)
- stream_viewers (live tracking)

-- Supabase Realtime is configured but only admin notifications use it
-- Gap: No typing indicators, no live viewer counts exposed
-- Fix: <2 hours to expose in UI
```

#### 2. Immutable Evidence Chain (XRC)
```sql
-- Tables exist:
- xrc_records (hash chain, timestamps, signatures)
- xrc_root_chain (merkle-like roots per stream)

-- Purpose: "What happened, who did it, when, proof"
-- Currently: Audit trail only
-- Unused: Public verification, trust scores, cross-platform proof

-- Gap: No UI to show "this post is verified" with chain link
-- Fix: Create evidence explorer + badge system
```

#### 3. Device Trust & Security
```sql
-- Tables exist:
- device_fingerprints (device identification)
- trusted_devices (whitelist)
- security_events (all security actions logged)

-- Currently: Stored, not used in login decisions
-- Gap: If device known + device trusted + geo OK + time reasonable → skip 2FA
-- Fix: Add device trust check to login flow (~500 lines)
```

#### 4. Gamification & Progress Tracking
```sql
-- Tables exist:
- daily_task_completions (daily streaks)
- ep_dashboard (EP earned per period)
- reward_level_history (tier changes)

-- Currently: Tracked, not surfaced
-- Gap: No "complete 3 daily tasks" UI, no streak display, no progress bars
-- Fix: Create DailyTasksWidget.jsx + ProgressCard.jsx
```

#### 5. Community Governance
```sql
-- Tables exist:
- community_roles (with permissions JSONB)
- community_channels (type: text, voice, announcement)
- community_invites (with expiry and use limits)
- admin actions on support_cases (escalation, assignment)

-- Currently: Created, not enforced
-- Gap: No voting UI, no moderation queue, no role-based channel access
-- Fix: Create CommunityGovUI.jsx + RoleEnforcement middleware
```

#### 6. Live Streaming Infrastructure
```sql
-- Tables exist:
- live_sessions (status, peak viewers, likes)
- stream_viewers (join times)
- stream_usage_logs (minutes used, EP earned)
- stream_tier_limits (tier-based minute allowance)

-- Services exist:
- LiveKit integration (configured)
- Cloudflare Stream (configured)

-- Currently: Database ready, LiveKit client-side incomplete
-- Gap: No UI for starting stream, no viewer list, no chat
-- Fix: Create StreamStageLayout + LiveChatComponent
```

#### 7. Wallet Intelligence
```sql
-- Tables exist:
- wallet_history (every transaction)
- staking_positions (locked amounts, interest calculated)
- savings_plans (goals, interest rates)
- user_cards (virtual cards ready)

-- Currently: Tracked, not surfaced
-- Gap: No analytics dashboard, no "spending by category", no tax reports
-- Fix: Create WalletAnalyticsBoard.jsx + TaxReportGenerator.ts
```

#### 8. Creator Toolkit
```sql
-- Tables exist:
- drafts (all types)
- platforms in conversations (DM history)
- shares (where content was shared)
- profile_boosts (creator tier system)

-- Currently: Partial
-- Gap: No scheduling, no bulk actions, no analytics per creator
-- Fix: Create CreatorStudio.jsx + SchedulingService.ts
```

#### 9. Relationship Intelligence
```sql
-- Tables exist:
- follows (social graph)
- conversations (connection history)
- profile_views (who viewed profile)
- community_members (sub-networks)

-- Currently: Tracked, not surfaced
-- Gap: No "degrees of connection" UI, no network graph
-- Fix: Create RelationshipGraph.jsx + GraphService.ts
```

#### 10. Evidence-Based Trust Scoring
```sql
-- Tables exist:
- xrc_records (actions with proof)
- security_events (security actions)
- ep_transactions (engagement consistency)
- device_fingerprints (identity consistency)

-- Currently: No synthesis
-- Gap: No "trust score" on profile showing "verified posts: 1,205, trust: 98%"
-- Fix: Create TrustScoreService.ts + TrustBadge.jsx
```

### Implemented & Partially Used

| Capability | Status | Gap |
|------------|--------|-----|
| 2FA (TOTP) | ✓ Working | Need SMS, email, biometric, recovery codes |
| Push notifications | ✓ Basic | Need rich notifications, scheduling, deep linking |
| Email delivery | ✓ Working | Need template personalization |
| SMS (Twilio) | ✓ Configured | Not wired to 2FA flow |
| Web3 payments | ✓ Working | Limited to XRC only |
| OAuth (consuming) | ✓ Working | Need Xeevia-as-provider |
| Community chat | ✓ Working | No moderation, no governance |
| DM encryption | ✗ Not implemented | Messages stored plaintext |
| Video streaming | ✓ Infrastructure | No UI |
| Content scheduling | ✗ Not implemented | Draft system exists |

---

## PART 4: WHAT XEEVIA NEEDS (The Transformation)

### Critical Gaps

#### Gap 1: Xeevia Must Be an OAuth Provider
**What it means:** External apps (Discord bot, mobile app, web3 dapp) authenticate users via Xeevia  
**Why critical:** Makes Xeevia identity portable (core mission)  
**Current state:** Xeevia only consumes OAuth (Google, X, Facebook)  
**What's needed:**
```
New tables (4):
- oauth_clients (app registrations: client_id, secret, redirect_uri)
- oauth_codes (authorization codes: expires in 10min)
- oauth_tokens (access/refresh tokens: long-lived)
- oauth_consent (user permissions: scope tracking)

New edge functions (4):
- POST /oauth/authorize (validates client, generates code)
- POST /oauth/token (exchanges code for tokens)
- GET /oauth/userinfo (Bearer token → user profile)
- GET /oauth/identity (Bearer token → xeevia trust score)

New UI (2 components):
- OAuthAuthorize.jsx (login + consent screen)
- AdminOAuthApps.jsx (developer dashboard)
```
**Effort:** 3-4 weeks  
**Impact:** External ecosystem integration  

---

#### Gap 2: Multi-Factor Authentication Must Be Perfect
**What it means:** User can choose from 6 MFA methods, all working seamlessly  
**Current state:** TOTP only, SMS/email configured but not wired  
**What's needed:**
```
SMS OTP:
- Table: verification_codes (already exists, add SMS support)
- Service: smsOtpService.js (send via Twilio, 5min expiry)
- UI: OtpInput.jsx (6-digit code entry)
- Flow: Email/password → SMS code → success

Email OTP:
- Table: verification_codes (use existing)
- Service: emailOtpService.js (send code via EmailJS)
- UI: OtpInput.jsx (reuse)
- Flow: Email/password → Email code → success

Biometric (WebAuthn):
- Table: webauthn_credentials (new, stores public keys)
- Service: webauthnService.js (register/verify assertions)
- UI: BiometricSetup.jsx (Windows Hello, FaceID, fingerprint)
- Flow: Device sensor → browser assertion → server verification

Recovery Codes:
- Table: two_factor_auth.backup_codes (store hashed codes, already partially exists)
- Service: recoveryCodeService.js (generate 16 codes, mark used)
- UI: BackupCodesDisplay.jsx (show once, allow download/print)
- Flow: "Lost phone? Use backup code"

Device Trust:
- Table: trusted_devices_enhanced (new, extends existing)
- Logic: If device known + location reasonable + last used <30 days → skip 2FA
- UI: Device management in settings

Time-Locked Withdrawals:
- Logic: If new device + unusual time (midnight, weekend) → require 2FA + email confirmation
- Table: Use existing device_fingerprints + security_events

Complete UI Workflow:
[Email] → [TOTP + SMS (pick one)] → [Device Trust Offered] → [Signed In]
Recovery Path:
[Lost TOTP device] → [Use SMS] → [Re-register authenticator app] → [Generate new backup codes]
```
**Effort:** 4-5 weeks  
**Impact:** Enterprise-grade security, user trust  

---

#### Gap 3: Data Must Be Separated by Domain
**What it means:** 138 tables split across 3 Supabase instances by concern  
**Current state:** Everything in one PostgreSQL database ($2000/month, complex RLS)  
**Why needed:** 
- RLS policies become simpler (auth checks don't mix with content checks)
- Independent scaling (wallet doesn't wait for post uploads)
- Compliance easier (PCI-DSS for wallet DB only)
- Clear boundaries reduce errors

**Target state:**
```
SUPABASE-IDENTITY (auth-supabase-co)
├─ auth.users (Supabase managed)
├─ profiles (31 tables: identity, OAuth, 2FA, sessions, security, XRC)
├─ Tables: 31
├─ Row count: ~5M (1 row per user + history)
├─ Cost: $200/month (small, security-focused)
├─ SLA: 99.95% (auth can't go down)
├─ Backup: Hourly
└─ RLS: Simple (user can only see own data)

SUPABASE-CORE (content-supabase-co)
├─ posts, reels, stories, comments (62 tables: content, community, messaging)
├─ Tables: 62
├─ Row count: ~300M (posts + comments + engagement)
├─ Cost: $800/month (high volume)
├─ SLA: 99.9% (outage acceptable for 30min)
├─ Backup: Daily
└─ RLS: Complex (public, followers-only, private)

SUPABASE-WALLET (wallet-supabase-co)
├─ wallets, transactions, payments (24 tables: PCI-DSS sensitive)
├─ Tables: 24
├─ Row count: ~150M (ledger is append-only, large)
├─ Cost: $1000/month (expensive: compliance + backup)
├─ SLA: 99% (correctness > availability)
├─ Backup: Real-time replication + daily snapshots
├─ RLS: Strictest (user can only see own transactions)
└─ Audit: Every row change logged
```

**Migration path:**
```
Week 1: Provision 3 new Supabase instances, run migrations
Week 2: Export existing data to 3 new locations
Week 3: Create service layer abstraction in src/services/supabase/multiSupabaseClient.js
Week 4: Enable feature flag USE_MULTI_SUPABASE = false (parallel run)
Week 5: Gradual rollout: internal team (5%) → beta users (25%) → all (100%)
Week 6: Validation, sync checks, performance benchmarks
Week 7: Cutover complete, decommission old Supabase
```

**Effort:** 6-8 weeks  
**Impact:** Better scaling, lower costs long-term, clearer architecture  

---

#### Gap 4: Media Must Be Optimized by Content Type
**What it means:** Different Cloudinary accounts for different use cases  
**Current state:** 1 account for all media ($500/month, no optimization)  
**Why needed:**
- Avatars (100×100, 200×200) ≠ Posts (500×500, 1200×1200) ≠ Videos (HLS, DASH streaming)
- Each needs different transformations, CDN tiers, backup strategies

**Target state:**
```
CLOUDINARY-PROFILES (xeevia-profiles)
├─ Content: avatars, cover images, profile pictures
├─ Transformations: thumbnail (100×100), display (200×200), large (500×500)
├─ Rate limit: 50 req/sec
├─ CDN tier: Standard
├─ Backup: Daily to S3
├─ Cost: $100/month
└─ Use case: Low traffic, high cache hit

CLOUDINARY-CONTENT (xeevia-content)
├─ Content: post images, story images, shared media
├─ Transformations: thumb (400×400), preview (800×800), full (1920×1080)
├─ Rate limit: 200 req/sec
├─ CDN tier: Premium
├─ Optimization: Auto WebP, auto quality, auto format
├─ Cost: $300/month
└─ Use case: High traffic, need optimization

CLOUDINARY-REELS (xeevia-reels)
├─ Content: video content, streaming
├─ Transformations: HLS playlist, DASH manifest, thumbnail, poster
├─ Rate limit: 100 req/sec
├─ CDN tier: Premium+ (geo-replicated)
├─ Optimization: Adaptive bitrate, quality analysis
├─ Backup: Real-time to multiple regions
├─ Cost: $400/month
└─ Use case: Highest quality, premium service

CLOUDINARY-ADMIN (xeevia-admin)
├─ Content: internal exports, backups, audit files
├─ Rate limit: 20 req/sec
├─ CDN tier: Standard
├─ Retention: 1 year with auto-delete
├─ Cost: $50/month
└─ Use case: Internal only
```

**Migration path:**
```
Week 1: Provision 4 new Cloudinary accounts
Week 2: Set up transformations and rate limits in each
Week 3: Create multiCloudinaryService.js (routes uploads to right account)
Week 4: Migrate existing media (avatars → profiles, posts → content, videos → reels)
Week 5: Update database URLs (image_ids, video_ids point to new accounts)
Week 6: Parallel run (old + new) for stability
Week 7: Cutover, decommission old account
```

**Effort:** 4-5 weeks  
**Impact:** Better media delivery, independent scaling per content type  

---

#### Gap 5: Unused Features Must Be Exposed
**What it means:** Enable the 10 features that are built but invisible  
**Effort per feature:** 1-3 weeks each  
**Priority:**

1. **Real-Time Features** (Typing indicators, live viewers) — 1 week
2. **Evidence Visualization** (Trust scores, verification badges) — 1 week
3. **Community Governance** (Voting, moderation, role enforcement) — 2 weeks
4. **Live Streaming UI** (Stream creation, viewer list, chat) — 2 weeks
5. **Wallet Intelligence** (Analytics, tax reports, budgeting) — 2 weeks
6. **Creator Toolkit** (Scheduling, bulk actions, analytics) — 2 weeks
7. **Staking/Savings UI** (Goal tracking, interest calculations) — 1 week
8. **Device Trust Dashboard** (Manage trusted devices, security overview) — 1 week
9. **Network Graph** (Relationship visualization, degrees of connection) — 1 week
10. **Gamification** (Daily tasks, streaks, achievement badges) — 1 week

**Total effort:** 14 weeks (can run in parallel with infrastructure work)  

---

#### Gap 6: Documentation Must Exist
**What it means:** Every table, every service, every endpoint documented with purpose  
**Current state:** Code exists, documentation scattered  
**What's needed:**
```
docs/
├── ARCHITECTURE.md (overview, this document)
├── DATABASE.md (all 138 tables with purpose, dependencies, lifecycle)
├── SERVICES.md (all src/services/ with what they do, who uses them)
├── API.md (all endpoints with examples, rate limits, auth required)
├── DEPLOYMENT.md (how to deploy to production safely)
├── TROUBLESHOOTING.md (common issues and fixes)
├── SECURITY.md (sensitive data handling, PCI-DSS, encryption)
├── SCALING.md (what breaks at 1M users, 10M users, how to fix)
└── DECISIONS.md (architecture decisions: why multi-Supabase, why separate Cloudinary)
```

**Effort:** 2 weeks  
**Impact:** Onboarding time from 1 week to 1 day  

---

## PART 5: EXACT TRANSFORMATION PATH (No Guessing)

### Phase 1: Preparation (Week 1)
**Deliverable:** Clear understanding of current state captured  
**Tasks:**
- [ ] Generate auto-docs for all 138 tables (purpose, FK, lifecycle)
- [ ] Document all 47 services (what they do, who calls them)
- [ ] Audit all secrets (what's needed, what's deprecated)
- [ ] Create migration checklists for multi-Supabase
- [ ] Create migration checklists for multi-Cloudinary

**Definition of done:** Docs are so clear an AI could continue without questions

---

### Phase 2A: OAuth Provider Foundation (Weeks 2-3)
**Parallel execution with Phase 2B**  
**Deliverable:** External apps can authenticate via Xeevia  

**Week 2 - Backend:**
- [ ] Create oauth_clients table
- [ ] Create oauth_codes table
- [ ] Create oauth_tokens table
- [ ] Create oauth_consent table
- [ ] Deploy /oauth/authorize edge function
- [ ] Deploy /oauth/token edge function
- [ ] Deploy /oauth/userinfo edge function
- [ ] Add security: rate limiting, PKCE validation, redirect URI whitelist

**Week 3 - Frontend:**
- [ ] Create OAuthAuthorize.jsx component
- [ ] Create OAuthConsentModal.jsx (show requested scopes)
- [ ] Create AdminOAuthApps.jsx (app registration UI)
- [ ] Create routes: /auth/oauth/authorize, /admin/oauth-apps
- [ ] Add test harness: mock external app OAuth flow
- [ ] Documentation: OAuth integration guide for third-party devs

---

### Phase 2B: Perfect MFA (Weeks 4-5)
**Parallel execution with Phase 2A**  
**Deliverable:** Users can choose from 6 MFA methods  

**Week 4 - Backend Services:**
- [ ] Create smsOtpService.js (Twilio integration)
- [ ] Create emailOtpService.js (EmailJS templates)
- [ ] Create webauthnService.js (FIDO2/biometric)
- [ ] Create recoveryCodeService.js (generate, validate, mark used)
- [ ] Create deviceTrustService.js (geolocation, time checks)
- [ ] Update authService.js login flow to check all methods in order
- [ ] Update two_factor_auth table schema for all methods
- [ ] Create webauthn_credentials table
- [ ] Create trusted_devices_enhanced table

**Week 5 - Frontend UI:**
- [ ] Create TwoFactorSetup.jsx (method selection, setup wizards)
- [ ] Create OtpInput.jsx (generic 6-digit code input)
- [ ] Create BiometricSetup.jsx (Windows Hello, FaceID, fingerprint)
- [ ] Create BackupCodesDisplay.jsx (show 16 codes, allow download/print)
- [ ] Create MFAManagement.jsx (Settings → Security → MFA)
- [ ] Create DeviceTrustCheckbox.jsx (post-login: "Trust this device?")
- [ ] Update LoginFlow.jsx to handle SMS → TOTP → device trust → success
- [ ] Update settings to show which methods enabled + management UI

---

### Phase 3: Multi-Supabase (Weeks 6-8)
**Deliverable:** Data properly distributed across 3 databases  

**Week 6 - Setup & Migration:**
- [ ] Provision grova-identity, grova-core, grova-wallet projects
- [ ] Run migration scripts in each (create all 138 tables in 3 locations)
- [ ] Export current Supabase data (pg_dump)
- [ ] Import data to 3 new locations (restore + verify)
- [ ] Validate schema consistency across all 3
- [ ] Set up replication/backup in each instance

**Week 7 - Service Layer:**
- [ ] Create src/services/supabase/multiSupabaseClient.js
- [ ] Create abstraction layer:
  ```typescript
  class MultiSupabaseClient {
    identity = createClient(IDENTITY_URL, KEY)
    core = createClient(CORE_URL, KEY)
    wallet = createClient(WALLET_URL, KEY)
    
    query(domain, table) { return this[domain].from(table); }
  }
  ```
- [ ] Create feature flag: USE_MULTI_SUPABASE (default: false)
- [ ] Update all services to use multiSupabaseClient:
  - profileService.js → use identity client
  - postService.js → use core client
  - walletService.js → use wallet client
  - etc.
- [ ] Add monitoring dashboard (sync status, latency, errors)

**Week 8 - Cutover:**
- [ ] Enable feature flag for internal team (5%)
- [ ] Monitor errors, sync issues, latency
- [ ] Expand to beta users (25%)
- [ ] Expand to all users (100%)
- [ ] Run daily sync validation (old vs new DB)
- [ ] Set decommission date for old Supabase (30 days out)

---

### Phase 4: Multi-Cloudinary (Weeks 9-10)
**Deliverable:** Media organized across 4 accounts with optimized delivery  

**Week 9 - Setup & Migration:**
- [ ] Provision xeevia-profiles, xeevia-content, xeevia-reels, xeevia-admin
- [ ] Configure transformations in each account:
  ```
  Profiles: { thumb: 100×100, display: 200×200, large: 500×500 }
  Content: { thumb: 400×400, preview: 800×800, full: 1920×1080 }
  Reels: { hls: playlist, dash: manifest, quality: auto }
  Admin: { backup: true, expiry: 1yr }
  ```
- [ ] Set rate limits and CDN tiers
- [ ] Export all media from old account (xeevia-production)
- [ ] Categorize media by type (avatars, posts, videos)
- [ ] Migrate to new accounts (parallel upload)
- [ ] Update database URLs (image_metadata.cloudinary_url)

**Week 10 - Service Update:**
- [ ] Create src/services/shared/multiCloudinaryService.js
- [ ] Routing logic:
  ```typescript
  uploadAvatar() → xeevia-profiles
  uploadPostImage() → xeevia-content
  uploadReel() → xeevia-reels
  uploadAdmin() → xeevia-admin
  ```
- [ ] Update MediaUploader.jsx to use multiCloudinaryService
- [ ] Update transformations per account
- [ ] Parallel run (both old + new) for 1 week
- [ ] Validate all images render correctly
- [ ] Cutover: redirect all new uploads to new accounts
- [ ] Decommission old account (after 30-day grace period)

---

### Phase 5: Feature Enablement (Weeks 11-12)
**Deliverable:** 10 hidden features now fully functional  

**Week 11 - Real-Time + Evidence:**
- [ ] Expose typing indicators (comment fields emit presence)
- [ ] Expose live viewer counts (stream page updates real-time)
- [ ] Build evidence explorer (XRC records → timeline UI)
- [ ] Create trust score card (profile page shows "98% verified")
- [ ] Build verification badge system (posts show proof link)
- [ ] Create "Verify this post" flow

**Week 11 - Community + Governance:**
- [ ] Implement role-based channel access (RLS + frontend checks)
- [ ] Create moderation queue (flagged posts, comments for review)
- [ ] Build report system UI
- [ ] Create voting/poll feature (+ tally at deadline)

**Week 12 - Creator Tools + Wallet + Gamification:**
- [ ] Create content scheduling UI
- [ ] Build analytics dashboard (posts, engagement, followers over time)
- [ ] Build wallet analytics (spending by category, tax reports)
- [ ] Expose staking/savings UI (goal tracking, interest display)
- [ ] Create daily tasks widget (streaks, completion checkboxes)
- [ ] Create device trust dashboard (manage trusted devices)

---

### Phase 6: Cleanup (Week 13)
**Deliverable:** Clean codebase, ready for handoff  

- [ ] Remove deprecated code (legacyAuthService.js, oldPaymentService.js)
- [ ] Remove unused secrets from .env and Vercel
- [ ] Archive old database tables (move to archive schema)
- [ ] Final documentation pass (every service has README)
- [ ] Create ADRs (Architecture Decision Records) for major choices
- [ ] Create runbook (how to handle common production issues)
- [ ] Deploy to production with monitoring
- [ ] Team training session (new architecture overview)

---

## PART 6: SCALING GUIDE (What Breaks & How to Fix)

### At 1M Users
**What breaks:** Post feed becomes slow (scanning 1B posts in CORE DB)  
**Fix:** Add `posts(user_id, created_at)` compound index, implement timeline cache

**What breaks:** Notifications table explodes (1M users × 100 notifications = 100M rows)  
**Fix:** Archive old notifications, partition table by date, implement notification archival

**What breaks:** Wallet transactions hard to audit (100M transactions, slow queries)  
**Fix:** Ensure WALLET DB is indexed on (user_id, created_at), implement transaction batching

---

### At 10M Users
**What breaks:** Single Cloudinary account rate limits hit (100 req/sec insufficient)  
**Fix:** Already solved by multi-Cloudinary (separate rate limits per account)

**What breaks:** OAuth token lookups become slow (millions of active tokens)  
**Fix:** Implement OAuth token cache (Redis), 15-min TTL, lazy invalidation

**What breaks:** Real-time presence channels (typing indicators) overload WebSocket  
**Fix:** Implement presence throttling (emit every 1sec max, debounce client-side)

**What breaks:** Community messages don't paginate well (1B messages across 100K communities)  
**Fix:** Implement cursor-based pagination, index on (channel_id, created_at)

---

### At 100M Users (Enterprise Scale)
**What breaks:** Single Supabase replica insufficient (read-heavy workload)  
**Fix:** Implement read replicas, route read queries to replicas

**What breaks:** Wallet DB replication lag (critical for transactions)  
**Fix:** Implement write-ahead logging, synchronous replication for critical tables

**What breaks:** Evidence chain (XRC) becomes unwieldy (100B records across all streams)  
**Fix:** Implement shard key on (actor_id), partition xrc_records by year

**What breaks:** Push notification delivery (OneSignal rate limits)  
**Fix:** Implement batch notification queuing, stagger delivery by timezone

---

### General Scaling Rules
1. **Index every foreign key** — prevents slow joins
2. **Partition tables >1B rows** — by date, user_id, or shard key
3. **Archive soft-deleted data >1yr** — move to cold storage
4. **Implement TTL on sessions** — auto-delete expired sessions daily
5. **Batch large operations** — process notifications/rewards in chunks
6. **Monitor slow queries** — log queries >100ms, alert if >1% of traffic
7. **Cache auth tokens** — Redis with TTL, lazy invalidation
8. **Shard data by user_id** — easier to scale, reduces hotspots
9. **Use read replicas** — keep WALLET DB as primary, replicate to read-only
10. **Archive audit logs >1yr** — legal compliance, not operational need

---

## PART 7: PRODUCTION CHECKLIST

### Before Deploying Each Phase

**Security:**
- [ ] Secrets never in code (use Vercel environment variables)
- [ ] OAuth clients have rate limiting
- [ ] Payment webhooks verified (signature check)
- [ ] RLS policies tested (user can't see other users' data)
- [ ] SQL injection prevented (parameterized queries everywhere)

**Performance:**
- [ ] Queries indexed (explain plan shows index usage)
- [ ] Slow query log monitored (>100ms alerts)
- [ ] Database backups tested (restore + verify)
- [ ] CDN cache headers set (static: 1yr, dynamic: 5min)

**Monitoring:**
- [ ] Error logging to Sentry (or equivalent)
- [ ] Performance metrics to DataDog (or equivalent)
- [ ] Health checks on critical services (/health endpoint)
- [ ] Alerts configured (disk full, error rate >1%, latency >500ms)

**Testing:**
- [ ] Unit tests: >80% coverage on services
- [ ] Integration tests: OAuth flow, 2FA flow, multi-Supabase cutover
- [ ] Load tests: 10K concurrent users, 100K RPS
- [ ] Rollback plan: every deploy has rollback strategy

**Documentation:**
- [ ] Migration guide for this phase
- [ ] Rollback procedure if issues arise
- [ ] New environment variables documented
- [ ] Team trained on changes

---

## PART 8: RISK MITIGATION

### Top 5 Risks

**Risk 1: Multi-Supabase data sync failures**  
**Probability:** High (complex distributed data)  
**Mitigation:** 
- Daily sync validation (diff old vs new DB)
- Parallel run for 1 week before cutover
- Feature flag to roll back instantly
- Automated alerts if sync lag >1 minute

**Risk 2: OAuth token leakage (security)**  
**Probability:** Medium  
**Mitigation:**
- Never log tokens (redact in logs)
- Rotate secrets monthly
- Implement token revocation endpoint
- Rate limit token endpoint (10 req/sec per IP)

**Risk 3: Cloudinary migration loses media**  
**Probability:** Low (parallel run)  
**Mitigation:**
- Export all media before migration
- Verify checksum matches
- Parallel run both accounts for 1 week
- Keep old account alive for 30 days grace period

**Risk 4: Live-streaming crashes under load**  
**Probability:** Medium (untested at scale)  
**Mitigation:**
- Load test with 1000 concurrent viewers
- Implement viewer count limits per stream
- Queue viewers if connection pool saturated
- Document connection limits per tier

**Risk 5: Wallet DB outage causes revenue loss**  
**Probability:** Low (but critical if happens)  
**Mitigation:**
- Real-time replication (synchronous writes)
- Automated failover to read replica (if write fails, quick failover)
- Daily backup + test restore
- Transaction retry logic (client-side + server-side)

---

## PART 9: SUCCESS CRITERIA (Measurable)

### By End of Phase 1 (Week 1)
- [ ] 138 tables documented with purpose, FK, lifecycle
- [ ] All 47 services documented with owner, dependencies
- [ ] Migration checklists created and reviewed
- [ ] Secrets audit complete, deprecation plan set

**Cost:** 0 (documentation only)  
**Risk:** 0 (read-only)  
**Effort:** 1 engineer, 1 week

---

### By End of Phase 2A (Week 3)
- [ ] OAuth provider functional (external app can authenticate)
- [ ] Test app demonstrates full OAuth flow
- [ ] Rate limiting working (100 requests/second per client)
- [ ] Documentation complete for third-party devs

**Cost:** 0 (edge functions are free)  
**Risk:** Low (new functionality, no impact on existing auth)  
**Effort:** 2 engineers, 2 weeks

---

### By End of Phase 2B (Week 5)
- [ ] Users can choose SMS, email, TOTP, biometric, recovery codes, device trust
- [ ] At least 1 method working in production
- [ ] MFA adoption reaches 10% of users (organic)
- [ ] Security events logged for all 2FA attempts

**Cost:** 0 (tables exist, SMS costs ~$0.01 per message)  
**Risk:** Medium (security-critical, must test thoroughly)  
**Effort:** 2 engineers, 2 weeks

---

### By End of Phase 3 (Week 8)
- [ ] 3 Supabase instances running in parallel
- [ ] Zero data loss during migration (validation passed)
- [ ] Feature flag allows instant rollback
- [ ] RLS policies simplified (identity DB: 50 policies, down from 847)
- [ ] Cost: $2000/month (consolidated, was $2500 fragmented)

**Cost:** +$500 for 1 month (during parallel run), then -$500/month net savings  
**Risk:** High (data movement, must parallel-run 2+ weeks)  
**Effort:** 3 engineers, 3 weeks

---

### By End of Phase 4 (Week 10)
- [ ] 4 Cloudinary accounts optimized per content type
- [ ] Media delivery faster (geo-replicated, auto-CDN)
- [ ] Cost: $850/month (vs $500, but better service + independent scaling)
- [ ] Rate limits separated (profiles: 50 req/sec, content: 200, reels: 100)

**Cost:** +$350/month (premium CDN + geo-replication)  
**Risk:** Medium (media URLs change, must verify no broken links)  
**Effort:** 2 engineers, 2 weeks

---

### By End of Phase 5 (Week 12)
- [ ] 10 features now fully functional
- [ ] Real-time typing indicators working
- [ ] Community governance UI live
- [ ] Creator analytics dashboard live
- [ ] Wallet intelligence dashboard live

**Cost:** 0 (uses existing tables)  
**Risk:** Low (features built, just need UI)  
**Effort:** 3 engineers, 2 weeks (parallel with infrastructure)

---

### By End of Phase 6 (Week 13)
- [ ] Codebase clean (no deprecated code)
- [ ] Documentation complete (every service, every table, every endpoint)
- [ ] Team trained (everyone understands new architecture)
- [ ] Runbook created (how to handle production issues)
- [ ] New developer can onboard in 1 day (vs 1 week currently)

**Cost:** 0  
**Risk:** 0 (cleanup only)  
**Effort:** 2 engineers, 1 week

---

## PART 10: FINAL SUMMARY

### What Xeevia Is Today
A monolithic social app with trust infrastructure built-in but invisible, single points of failure (1 Supabase, 1 Cloudinary, 1 auth system), and 10 features built but unused.

### What Xeevia Becomes in 13 Weeks
A modular trust infrastructure platform where:
- **Identity is portable** (OAuth provider)
- **Security is perfect** (6 MFA methods)
- **Data is organized** (3 Supabase instances by domain)
- **Media is optimized** (4 Cloudinary accounts by type)
- **Features are visible** (10 capabilities now functional)
- **Code is clear** (comprehensive documentation)
- **Team can scale** (onboarding 1 day instead of 1 week)

### Investment Required
- **Engineering:** 3 engineers, 13 weeks
- **Infrastructure:** +$350/month (Cloudinary), -$500/month savings (Supabase consolidation) = +$0 net
- **Risk:** Managed via feature flags and parallel runs

### Return
- **Team:** 5× productivity increase (clarity)
- **Product:** 10 new features unlocked
- **Scalability:** Ready for 10M users (vs 500K bottleneck)
- **Security:** Enterprise-grade MFA
- **Ecosystem:** Third-party OAuth integrations

---

**This document is the north star. Every decision flows from it. Every implementation follows it. Any developer (human or AI) can pick it up, read Part 5 (Transformation Path), and execute with full context.**
